// Co-op crews. A crew is a saved, shared campaign: shared vault, crater and planet progress.
// Host-authoritative: the host owns the economy and the ice; members send seeded brush ops,
// bank requests and purchase requests. Every member keeps a copy of the crew save, so anyone can
// resume as host if the host leaves.
import { makeTransport } from './transport.js';
import { CREW_MILESTONES, roleMix } from '../econ/data/milestones.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_CREW = 4;
const DROP_MS = 25000;   // a crewmate silent this long is gone (connection 'leave' events act sooner)

export function newCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export class Crew {
  constructor(game, debug) {
    this.game = game;
    this.debug = debug;
    this.role = null;            // 'host' | 'member' | null
    this.code = null;
    this.t = null;
    this.members = new Map();    // peerId -> { name, st, seen }
    this.status = 'Not in a crew.';
    this.statusKind = '';
    this.sendT = 0;
    this.econT = 0;
    this.progress = { crewVolume: 0, crewBanked: 0, crewDepth: 0 };
    this.mix = 1;                // shared Crew Roles bonus (host decides)
    this.hostPeer = null;        // member: the host's peer id
    this.done = {};
    this.credited = new Set();   // coin ids already banked (host)
    this.lostHost = false;
    this.retryT = 0;
    this.name = 'Surveyor';
    this.listeners = {};
    // A hidden tab stops drawing frames, which would silence it and make crewmates drop its
    // avatar. Keep the crew ticking from a timer while the page is hidden.
    this.lastTick = performance.now();
    setInterval(() => { if (this.t && performance.now() - this.lastTick > 400) this.tick(0.5); }, 500);
    // closing the tab says goodbye at once instead of leaving crewmates to time it out
    addEventListener('pagehide', () => { if (this.t) try { this.t.send(null, { t: 'bye' }); } catch { /* closed */ } });
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }
  get active() { return !!this.role; }
  get isHost() { return this.role === 'host'; }
  setStatus(s, kind = '') { this.status = s; this.statusKind = kind; this.emit('status', s, kind); }

  link() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('join', this.code);
    if (this.debug) u.searchParams.set('coopdebug', '1');
    return u.toString();
  }

  async create(name) {
    this.name = name || this.name;
    const code = newCode();
    await this.startHost(code, true);
    return code;
  }

  async startHost(code, fresh) {
    this.leave(true);
    this.t = makeTransport(this.debug);
    this.wire();
    this.setStatus('Opening crew…');
    try {
      await this.t.host(code);
    } catch (e) {
      this.setStatus(`Could not open the crew: ${e.type === 'unavailable-id' ? 'that crew is already hosted by someone else.' : e.message || e}`, 'bad');
      this.t.close(); this.t = null;
      return false;
    }
    this.role = 'host';
    this.code = code;
    this.lostHost = false;
    this.emit('started', { code, fresh, host: true });
    this.setStatus(`Hosting crew ${code}. Share the link to invite up to ${MAX_CREW - 1} more.`, 'ok');
    return true;
  }

  async join(code, name) {
    this.name = name || this.name;
    code = code.trim().toUpperCase();
    this.leave(true);
    this.t = makeTransport(this.debug);
    this.wire();
    this.setStatus(`Joining crew ${code}…`);
    try {
      await this.t.join(code);
    } catch (e) {
      this.setStatus(`Could not join crew ${code}: ${e.message || e}`, 'bad');
      this.t.close(); this.t = null;
      return false;
    }
    this.role = 'member';
    this.code = code;
    this.lostHost = false;
    this.t.send(null, { t: 'hello', name: this.name });
    this.setStatus(`Joined crew ${code}. Waiting for the crater…`, 'ok');
    return true;
  }

  leave(silent) {
    if (this.t) { try { this.t.send(null, { t: 'bye' }); } catch { /* closed */ } this.t.close(); }
    this.t = null;
    const was = this.role;
    this.role = null;
    this.members.clear();
    this.lostHost = false;
    if (!silent) { this.setStatus('Left the crew. Playing solo.'); this.emit('left', was); }
  }

  wire() {
    const t = this.t;
    t.on('peer', (p) => {
      if (this.isHost && this.members.size >= MAX_CREW - 1) { t.send(p, { t: 'full' }); return; }
    });
    t.on('message', (from, m) => this.onMessage(from, m));
    t.on('leave', (p) => {
      if (this.isHost) {
        const m = this.members.get(p);
        this.members.delete(p);
        if (m) this.emit('notice', `${m.name} left the crew.`);
        this.emit('members');
      } else if (this.role === 'member' && (!this.hostPeer || p === this.hostPeer || p === this.t?.hostPeer)) this.hostGone();   // another member going quiet is not the host leaving
    });
  }

  // Host migration: when the host leaves, the remaining member with the lowest id takes over the crew
  // from their own copy; everyone else rejoins the new host. Until then each plays on from their copy.
  hostGone() {
    if (this.lostHost) return;
    this.lostHost = true;
    this.retryT = 3;
    if (this.hostPeer) this.members.delete(this.hostPeer);
    const ids = [this.t?.id, ...this.members.keys()].filter(Boolean).sort();
    this.heir = ids[0] === this.t?.id;
    this.setStatus(this.heir ? 'The host left. You are taking over the crew…' : 'The host left. A crewmate is taking over; rejoining automatically.', 'bad');
    this.emit('hostLost');
    if (this.heir) setTimeout(() => this.migrate(), 1500);
  }

  async migrate() {
    if (!this.lostHost || this.isHost) return;
    const ok = await this.resumeAsHost();
    if (ok) { this.setStatus(`The host left, so you now host crew ${this.code}. Crewmates rejoin you automatically.`, 'ok'); this.emit('migrated'); }
    else { await this.tryRejoin(); if (this.lostHost) setTimeout(() => this.migrate(), 4000); }   // the old id may still be held for a moment
  }

  onMessage(from, m) {
    const g = this.game;
    switch (m.t) {
      case 'hello':
        if (!this.isHost) return;
        if (this.members.size >= MAX_CREW - 1) { this.t.send(from, { t: 'full' }); return; }
        this.members.set(from, { name: (m.name || 'Surveyor').slice(0, 18), st: null, seen: performance.now() });
        this.t.send(from, { t: 'welcome', snap: g.crewSnapshot(), crew: { progress: this.progress, done: this.done } });
        this.emit('notice', `${m.name || 'A surveyor'} joined the crew.`);
        this.emit('members');
        break;
      case 'full':
        this.setStatus('That crew is full (4 players).', 'bad');
        this.leave(true);
        break;
      case 'welcome':
        this.hostPeer = from;
        g.crewLoad(m.snap);
        this.progress = m.crew.progress;
        this.done = m.crew.done || {};
        this.emit('crewMilestones', this.done);
        this.emit('started', { code: this.code, host: false });
        this.setStatus(`In crew ${this.code}.`, 'ok');
        break;
      case 'state': {
        const id = m.id || from;
        if (this.t && id === this.t.id) break;
        const mem = this.members.get(id) || { name: m.name || 'Surveyor' };
        mem.st = m.s; mem.seen = performance.now(); mem.name = m.name || mem.name;
        this.members.set(id, mem);
        if (this.isHost) this.relay(from, { ...m, id });
        break;
      }
      case 'op':
        g.applyRemoteOp(m.op);
        if (this.isHost) {
          this.relay(from, m);
          if (m.op.kind !== 'fill') this.progress.crewVolume += m.vol || 0;
        }
        break;
      case 'bank':
        if (!this.isHost) return;
        this.creditBank(m.value, m.ids, from);
        break;
      case 'count':
        if (this.isHost && typeof m.kind === 'string' && m.kind.startsWith('crew')) this.progress[m.kind] = (this.progress[m.kind] || 0) + (+m.n || 0);
        break;
      case 'act':
        if (this.isHost) g.crewAction(m.a, m.n);
        break;
      case 'buy':
        if (this.isHost) g.crewBuy(m.id, from);
        break;
      case 'econ':
        if (!this.isHost) { g.crewEcon(m.e); this.progress = m.p || this.progress; this.mix = m.mix || 1; this.hostPeer = from; }
        break;
      case 'event':
        g.crewEvent(m.ev, !this.isHost ? null : from);
        if (this.isHost) this.relay(from, m);
        break;
      case 'crewms':
        this.done = m.done;
        this.emit('crewMilestones', this.done, m.fresh);
        break;
      case 'bye':
        if (this.isHost) {
          const mem = this.members.get(from);
          this.members.delete(from);
          if (mem) this.emit('notice', `${mem.name} left the crew.`);
          this.emit('members');
        } else if (this.role === 'member' && (!this.hostPeer || from === this.hostPeer)) this.hostGone();
        break;
      default:
    }
  }

  // host: send the whole crew a fresh snapshot (after travelling to a new planet)
  resync() {
    if (!this.t || !this.isHost) return;
    this.t.send(null, { t: 'welcome', snap: this.game.crewSnapshot(), crew: { progress: this.progress, done: this.done } });
  }

  relay(from, m) {
    for (const p of this.members.keys()) if (p !== from) this.t.send(p, m);
  }

  creditBank(value, ids, from) {
    let v = value;
    if (ids && ids.length) {
      const dup = ids.filter((id) => this.credited.has(id)).length;
      v = value * (1 - dup / ids.length);
      for (const id of ids) this.credited.add(id);
      if (this.credited.size > 50000) this.credited.clear();
    }
    this.progress.crewBanked += v;
    this.game.crewCredit(v, from);
  }

  // ---- outgoing ----

  sendOp(op, vol) {
    if (!this.t) return;
    if (this.isHost) { this.t.send(null, { t: 'op', op, vol }); this.progress.crewVolume += op.kind !== 'fill' ? vol || 0 : 0; }
    else if (!this.lostHost) this.t.send(null, { t: 'op', op, vol });
  }

  bank(value, ids) {
    if (this.isHost) this.creditBank(value, ids, null);
    else if (this.t && !this.lostHost) this.t.send(null, { t: 'bank', value, ids });
  }

  // crew milestone progress (host keeps the count; members report theirs)
  count(kind, n) {
    if (!this.t) return;
    if (this.isHost) this.progress[kind] = (this.progress[kind] || 0) + n;
    else if (!this.lostHost) this.t.send(null, { t: 'count', kind, n });
  }

  action(a, n = 1) { if (this.t && !this.isHost && !this.lostHost) this.t.send(null, { t: 'act', a, n }); }
  buy(id) { if (this.t && !this.isHost && !this.lostHost) this.t.send(null, { t: 'buy', id }); }
  // host: tell everyone; member: tell the host, who applies it and passes it on
  event(ev) { if (this.t && (this.isHost || !this.lostHost)) this.t.send(null, { t: 'event', ev }); }

  tick(dt) {
    if (!this.t) return;
    this.lastTick = performance.now();
    const g = this.game;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.1;
      this.t.send(null, { t: 'state', id: this.t.id, name: this.name, s: g.playerState() });
    }
    if (this.isHost) {
      this.econT -= dt;
      if (this.econT <= 0) {
        this.econT = 0.5;
        this.progress.crewDepth = Math.max(this.progress.crewDepth, g.econ.depth);
        if (this.members.size) this.progress.crewTime = (this.progress.crewTime || 0) + 0.5;
        const roles = this.roles();
        this.progress.crewRoles = Math.max(this.progress.crewRoles || 0, roles);
        this.mix = this.members.size ? roleMix(roles) : 1;
        this.t.send(null, { t: 'econ', e: g.crewEconPacket(), p: this.progress, mix: this.mix });
        this.checkMilestones();
      }
    } else if (this.lostHost) {
      this.retryT -= dt;
      if (this.retryT <= 0) { this.retryT = 4; if (!this.heir) this.tryRejoin(); }
    }
    // drop silent members
    const now = performance.now();
    for (const [p, m] of this.members) if (now - m.seen > DROP_MS) { this.members.delete(p); this.emit('members'); }
  }

  async tryRejoin() {
    if (this.rejoining) return;
    this.rejoining = true;
    const code = this.code;
    const t = makeTransport(this.debug);
    try {
      await t.join(code);
      if (this.t) this.t.close();
      this.t = t;
      this.wire();
      this.lostHost = false;
      this.heir = false;
      t.send(null, { t: 'hello', name: this.name });
      this.setStatus(`Rejoined crew ${code}.`, 'ok');
    } catch {
      t.close();
    }
    this.rejoining = false;
  }

  async resumeAsHost() {
    const code = this.code;
    if (!code) return false;
    return this.startHost(code, false);
  }

  checkMilestones() {
    const fresh = [];
    for (const m of CREW_MILESTONES) {
      if (this.done[m.id]) continue;
      if ((this.progress[m.kind] || 0) >= m.value) { this.done[m.id] = Date.now(); fresh.push(m.id); }
    }
    if (fresh.length) {
      this.t.send(null, { t: 'crewms', done: this.done, fresh });
      this.emit('crewMilestones', this.done, fresh);
    }
  }

  // number of different Crew Roles among everyone in the crew right now
  roles() {
    const set = new Set();
    const mine = this.game.settings?.crewRole;
    if (mine) set.add(mine);
    for (const [, m] of this.members) if (m.st && m.st.r) set.add(m.st.r);
    return set.size;
  }

  memberList() {
    const out = [{ name: `${this.name} (you)`, host: this.isHost, role: this.game.settings?.crewRole || null }];
    for (const [id, m] of this.members) out.push({ name: m.name, host: !this.isHost && id === this.hostPeer, role: m.st?.r || null });
    return out;
  }
}
