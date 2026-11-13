// Co-op: the same game with a Net module that may be absent. A host plus up to three guests, joined by invite link (#room=CODE).
// The host owns the house (seed, room state, floor progress, the Tide). Each player keeps their own Glow, upgrades, helpers and Clarity.
// Clutter and grime only ever go down by hand, so players' room edits merge by taking the minimum; floods come from the host as "set".
import * as Game from './game.js';
import * as R from './roomstate.js';
import { roomKey, parseKey } from './world.js';

const MAX_GUESTS = 3;
const enc = (a) => { const u = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) u[i] = Math.min(255, Math.round(a[i] * (a.max || 40))); return Array.from(u); };
const pack = (r) => ({ c: Array.from(r.c, (v) => Math.min(255, Math.round(v * 40))), g: Array.from(r.g, (v) => Math.round(v * 255)), l: r.lit ? 1 : 0, f: r.flags, cd: r.clearedDone ? 1 : 0, pd: r.polishedDone ? 1 : 0, t: r.total, v: r.visited ? 1 : 0 });

// ---------- transports ----------
// Local (same browser, other tabs): BroadcastChannel. Used for tests (#room=CODE&local=1).
class LocalTransport {
  constructor(code, id) { this.id = id; this.ch = new BroadcastChannel('lift-' + code); this.ch.onmessage = (e) => { const m = e.data; if (m.to && m.to !== this.id) return; if (m.from === this.id) return; this.onData && this.onData(m.from, m.data); }; }
  send(to, data) { this.ch.postMessage({ from: this.id, to, data }); }
  broadcast(data) { this.ch.postMessage({ from: this.id, to: null, data }); }
  close() { this.ch.close(); }
}
// PeerJS (WebRTC with the public PeerJS broker for the handshake).
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/peerjs.min.js'; s.onload = () => res(window.Peer); s.onerror = rej; document.head.append(s); });
}
class PeerTransport {
  constructor() { this.conns = new Map(); }
  async start(myId, hostId) {
    const Peer = await loadPeer();
    this.peer = new Peer(myId);
    await new Promise((res, rej) => { this.peer.on('open', res); this.peer.on('error', rej); setTimeout(() => rej(new Error('timeout')), 12000); });
    this.id = this.peer.id;
    this.peer.on('connection', (c) => this.add(c));
    this.peer.on('error', (e) => this.onError && this.onError(e));
    if (hostId) {
      const c = this.peer.connect(hostId, { reliable: true });
      await new Promise((res, rej) => { c.on('open', res); c.on('error', rej); setTimeout(() => rej(new Error('timeout')), 12000); });
      this.add(c);
    }
  }
  add(c) { this.conns.set(c.peer, c); c.on('data', (d) => this.onData && this.onData(c.peer, d)); c.on('close', () => { this.conns.delete(c.peer); this.onLeave && this.onLeave(c.peer); }); }
  send(to, data) { const c = this.conns.get(to); if (c && c.open) c.send(data); }
  broadcast(data) { for (const c of this.conns.values()) if (c.open) c.send(data); }
  close() { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
}

export function parseHash(h = location.hash) {
  const m = /room=([A-Za-z0-9]{4,12})/.exec(h); if (!m) return null;
  return { code: m[1].toUpperCase(), local: /local=1/.test(h) };
}
export const newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export class Net {
  // hooks: getGame(), setHouse(houseObj, rooms), onRoom(key), onTide(), onPing(x, z, color), onAnchor(kind), onPeers(), onMessage(text), onFail(err)
  constructor(hooks) {
    this.h = hooks; this.peers = new Map(); this.host = false; this.code = null; this.dirty = new Set(); this.t = 0; this.alive = false;
    this.mySalt = (Math.random() * 1e9) | 0; this.color = Math.random();
  }
  isHost() { return this.host; }
  players() { return 1 + this.peers.size; }
  salt() { return this.mySalt; }
  link() { const base = typeof location !== 'undefined' ? location.origin + location.pathname : ''; return base + '#room=' + this.code + (this.local ? '&local=1' : ''); }

  async hostRoom(code = newCode(), local = false) {
    this.code = code; this.host = true; this.local = local;
    const id = 'lift-' + code;
    await this.open(local, id, null);
    this.alive = true;
    return this.link();
  }
  async join(code, local = false) {
    this.code = code; this.host = false; this.local = local;
    await this.open(local, 'lift-' + code + '-' + newCode(), 'lift-' + code);
    this.alive = true;
    const hello = () => this.tr && this.tr.send('lift-' + code, { t: 'hello', salt: this.mySalt, color: this.color });
    hello();
    // say hello again until the host answers (a message can be missed while the host is busy)
    let tries = 0;
    this.helloTimer = setInterval(() => { if (this.welcomed || !this.alive || ++tries > 12) { clearInterval(this.helloTimer); if (!this.welcomed && this.alive && tries > 12) this.fail(new Error('timeout')); return; } hello(); }, 1000);
  }
  async open(local, myId, hostId) {
    if (local) { this.tr = new LocalTransport(this.code, myId); }
    else { this.tr = new PeerTransport(); await this.tr.start(myId, hostId); }
    this.myId = myId; this.hostId = hostId || myId;
    this.tr.onData = (from, d) => this.recv(from, d);
    this.tr.onLeave = (id) => { this.peers.delete(id); this.h.onPeers && this.h.onPeers(); };
    this.tr.onError = (e) => this.fail(e);
  }
  fail(e) { if (this.h.onFail) this.h.onFail(e); this.close(); }
  close() { clearInterval(this.helloTimer); this.alive = false; if (this.tr) this.tr.close(); this.tr = null; this.peers.clear(); }

  // ---- outgoing ----
  markRoom(key) { this.dirty.add(key); }
  lamp(key) { this.send({ t: 'lamp', key }); }
  ping(x, z) { this.send({ t: 'ping', x, z, color: this.color }); }
  anchor(f, x, z, kind) { this.send({ t: 'anchor', f, x, z, kind }); }
  boost(x, z, amt) { this.send({ t: 'boost', x, z, amt }); }
  door(f, x, z, side, secs) { this.send({ t: 'door', f, x, z, side, secs }); }
  sortiePts(f, action) { this.send({ t: 'pts', f, action }); }
  send(d) { if (!this.tr) return; if (this.host) this.tr.broadcast(d); else this.tr.send(this.hostId, d); }

  // Called every frame.
  tick(dt) {
    if (!this.alive) return;
    this.t += dt;
    const g = this.h.getGame();
    if (this.t >= 0.2) {
      this.t = 0;
      // positions
      this.send({ t: 'pos', id: this.myId, x: g.pos.x, z: g.pos.z, yaw: g.pos.yaw, f: g.pos.floor, color: this.color });
      // rooms I changed (min-merge)
      for (const key of this.dirty) { const r = g.rooms.get(key); if (r) this.send({ t: 'room', key, mode: 'min', r: pack(r) }); }
      this.dirty.clear();
      if (this.host) {
        this.tideT = (this.tideT || 0) + 1;
        this.send({ t: 'tide', tide: g.tide ? { ...g.tide } : null, soap: g.soapT || null });
        if (this.tideT % 5 === 0) this.send({ t: 'house', house: houseOf(g) });
      }
    }
  }

  // ---- incoming ----
  recv(from, d) {
    const g = this.h.getGame();
    switch (d.t) {
      case 'hello': {
        if (!this.host) return;
        if (this.peers.size >= MAX_GUESTS && !this.peers.has(from)) { this.tr.send(from, { t: 'full' }); return; }
        this.peers.set(from, { salt: d.salt, color: d.color });
        const rooms = {}; for (const [k, r] of g.rooms) if (r.touched || r.visited || r.lit) rooms[k] = pack(r);
        this.tr.send(from, { t: 'welcome', house: houseOf(g), rooms, players: this.players() });
        this.h.onPeers && this.h.onPeers();
        break;
      }
      case 'full': this.fail(new Error('full')); break;
      case 'welcome': if (this.welcomed) break; this.welcomed = true; this.h.setHouse(d.house, d.rooms); this.h.onPeers && this.h.onPeers(d.players); break;
      case 'room': {
        applyRoom(g, d.key, d.r, d.mode);
        this.h.onRoom && this.h.onRoom(d.key);
        if (this.host) this.tr.broadcast(d);   // relay to the other guests
        break;
      }
      case 'lamp': {
        const [f, x, z] = parseKey(d.key); const r = Game.room(g, f, x, z);
        if (!r.lit) { r.lit = true; r.touched = true; const fl = Game.floorState(g, f); fl.litCount++; fl.lamps++; Game.updateStrength(g, f, x, z); }
        this.h.onRoom && this.h.onRoom(d.key);
        if (this.host) this.tr.broadcast(d);
        break;
      }
      case 'house': if (!this.host) { Object.assign(g.house, d.house); g.house.floors = { ...d.house.floors }; } break;
      case 'tide': if (!this.host) { g.tide = d.tide; if (d.soap) { g.soapT = d.soap; g.soap = new Set(Object.keys(d.soap)); } this.h.onTide && this.h.onTide(); } break;
      case 'pos': (this.others ||= new Map()).set(d.id, { ...d, at: performance.now() }); if (this.host) this.tr.broadcast(d); break;
      case 'ping': this.h.onPing && this.h.onPing(d.x, d.z, d.color); if (this.host) this.tr.broadcast(d); break;
      case 'anchor': {   // Anchors found go to everyone
        (g.house.anchorsFound ||= {})[`${d.f}:${d.x}:${d.z}`] = 1;
        if (!d.seen || !d.seen.includes(this.myId)) { g.player.anchors[d.kind] = (g.player.anchors[d.kind] || 0) + 1; this.h.onAnchor && this.h.onAnchor(d.kind); }
        if (this.host) this.tr.broadcast({ ...d, seen: [...(d.seen || []), from, this.myId] });
        break;
      }
      case 'boost': if (this.host && g.tide) { const k = `${d.x}:${d.z}`; g.tide.boosts[k] = Math.min(0.6, (g.tide.boosts[k] || 0) + d.amt); } break;
      case 'door': Game.shutDoor(g, d.f, d.x, d.z, d.side, d.secs); if (this.host) this.tr.broadcast(d); break;
      case 'pts': if (this.host) { const fl = Game.floorState(g, d.f); fl.sortiePts ||= { clear: 0, polish: 0, light: 0 }; const p = 4; if (d.action === 'all') { fl.sortiePts.clear += p; fl.sortiePts.polish += p; fl.sortiePts.light += p; } else fl.sortiePts[d.action] += p; } break;
    }
  }
}

export function houseOf(g) {
  const { floors, maxFloor, seed, halls, anchorsFound } = g.house;
  const fl = {}; for (const [k, v] of Object.entries(floors)) { const { board, ...rest } = v; fl[k] = rest; }
  return { floors: fl, maxFloor, seed, halls: halls || [], anchorsFound: anchorsFound || {} };
}
export function applyRoom(g, key, p, mode) {
  const [f, x, z] = parseKey(key);
  const r = Game.room(g, f, x, z);
  const wasLit = r.lit;
  for (let k = 0; k < 256; k++) {
    const c = p.c[k] / 40, gg = p.g[k] / 255;
    if (mode === 'set') { r.c[k] = c; r.g[k] = gg; } else { r.c[k] = Math.min(r.c[k], c); r.g[k] = Math.min(r.g[k], gg); }
  }
  if (mode === 'set') { r.clearedDone = !!p.cd; r.polishedDone = !!p.pd; r.lit = !!p.l; r.flags = { ...p.f }; }
  else { r.clearedDone = r.clearedDone || !!p.cd; r.polishedDone = r.polishedDone || !!p.pd; if (p.l) r.lit = true; r.flags = { ...p.f, ...r.flags }; }
  if (p.v) r.visited = true;
  r.touched = true;
  if (r.lit !== wasLit) { const fl = Game.floorState(g, f); fl.litCount += r.lit ? 1 : -1; }
  Game.updateStrength(g, f, x, z);
}
// The shared house as a save blob, kept in every player's browser.
export function sharedSave(g) {
  const rooms = {}; for (const [k, r] of g.rooms) if (r.touched || r.visited || r.lit) rooms[k] = R.serializeRoom(r);
  return { house: houseOf(g), rooms };
}
