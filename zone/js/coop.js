'use strict';
// ---------- online co-op (2 players): the host runs the Zone, the friend joins with one link ----------
// Transport: PeerJS (WebRTC, loaded on demand). A local BroadcastChannel transport (?coopdebug=1) lets two tabs test it offline.
const CO = { active: false, role: null, conn: null, peer: null, code: '', pw: '', partner: null, hits: [], kills: [], dmgQ: [], mirror: new Map(), dead: new Map(), sendT: 0, uid: 0, start: null, gInv: 0, reviveT: 0, hbl: [] };
const CO_PREFIX = 'zonebonk-v1-';
const CO_DEBUG = /[?&]coopdebug=1/.test(location.search);

function coCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function coLink() { return location.origin + location.pathname + '?join=' + CO.code + (CO.pw ? '&pw=' + encodeURIComponent(CO.pw) : '') + (CO_DEBUG ? '&coopdebug=1' : ''); }
function loadPeer() {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the co-op library. Check your connection.'));
    document.head.appendChild(s);
  });
}
// local test transport: behaves like a PeerJS connection
function bcConn(code, me) {
  const ch = new BroadcastChannel('zb-' + code), h = {};
  const c = { open: true, send: (d) => ch.postMessage({ from: me, d }), on: (ev, fn) => { h[ev] = fn; }, close: () => { ch.postMessage({ from: me, bye: 1 }); ch.close(); } };
  ch.onmessage = (m) => { if (m.data.from === me) return; if (m.data.bye) { h.close && h.close(); return; } h.data && h.data(m.data.d); };
  return c;
}
const Net = {
  async host() {
    CO.code = coCode(); CO.role = 'host';
    if (CO_DEBUG) {
      const lobby = new BroadcastChannel('zb-lobby-' + CO.code);
      lobby.onmessage = (m) => { if (CO.conn) return; const c = bcConn(CO.code + '-' + m.data, 'host'); Net.bind(c); lobby.postMessage(m.data); };
      return;
    }
    await loadPeer();
    await new Promise((res, rej) => {
      CO.peer = new Peer(CO_PREFIX + CO.code);
      CO.peer.on('open', res);
      CO.peer.on('error', (e) => { if (e.type === 'unavailable-id') { CO.peer.destroy(); CO.code = coCode(); Net.host().then(res, rej); } else { coStatus('⚠️ ' + (e.message || e.type)); rej(e); } });
      CO.peer.on('connection', (c) => { if (CO.conn) { c.on('open', () => { c.send({ t: 'deny', why: 'The room is full.' }); setTimeout(() => c.close(), 300); }); return; } c.on('open', () => Net.bind(c)); });
    });
  },
  async join(code, pw) {
    CO.code = code.toUpperCase().trim(); CO.pw = pw || ''; CO.role = 'guest';
    if (CO_DEBUG) {
      const lobby = new BroadcastChannel('zb-lobby-' + CO.code);
      const sid = Math.random().toString(36).slice(2);
      lobby.onmessage = (m) => { if (m.data !== sid) return; const c = bcConn(CO.code + '-' + sid, 'guest'); Net.bind(c); c.send({ t: 'hello', pw: CO.pw, name: coName() }); };
      lobby.postMessage(sid);
      return;
    }
    await loadPeer();
    CO.peer = new Peer();
    CO.peer.on('error', (e) => coStatus('⚠️ ' + (e.type === 'peer-unavailable' ? 'Room ' + CO.code + ' not found. Is the host still waiting?' : e.message || e.type)));
    CO.peer.on('open', () => { const c = CO.peer.connect(CO_PREFIX + CO.code, { reliable: true }); c.on('open', () => { Net.bind(c); c.send({ t: 'hello', pw: CO.pw, name: coName() }); }); });
  },
  bind(c) {
    CO.conn = c;
    c.on('data', (m) => Coop.onMsg(m));
    c.on('close', () => Coop.onClose());
  },
  send(m) { if (CO.conn && CO.conn.open !== false) try { CO.conn.send(m); } catch (e) { /* dropped packet */ } },
  leave() { try { CO.conn && CO.conn.close(); } catch (e) { /* already closed */ } try { CO.peer && CO.peer.destroy(); } catch (e) { /* already gone */ } CO.conn = null; CO.peer = null; CO.active = false; CO.partner = null; },
};
function coName() { const c = CHARACTERS.find((x) => x.id === Save.data.char) || CHARACTERS[0]; return c.name; }
function coStatus(s) { const el = $('coStatus'); if (el) el.innerHTML = s; }

const Coop = {
  onMsg(m) {
    if (!m || !m.t) return;
    if (m.t === 'hello' && CO.role === 'host') {
      if (CO.pw && m.pw !== CO.pw) { Net.send({ t: 'deny', why: 'Wrong password.' }); setTimeout(() => { CO.conn && CO.conn.close(); CO.conn = null; }, 300); coStatus('⚠️ Someone tried to join with a wrong password.'); return; }
      CO.partnerName = m.name; Net.send({ t: 'welcome', name: coName() });
      coStatus('✅ <b>' + m.name + '</b> joined! Press START when ready.'); $('coStart').disabled = false; Sfx.init(); Sfx.play('quest');
    } else if (m.t === 'welcome') { CO.partnerName = m.name; coStatus('✅ Connected to <b>' + m.name + '</b>. Waiting for the host to start…'); }
    else if (m.t === 'deny') { coStatus('⛔ ' + m.why); Net.leave(); }
    else if (m.t === 'start' && CO.role === 'guest') { CO.start = m; NEXT_RUN = { mode: 'standard', mutators: [], ngplus: false }; hide('coop'); startGame(); }
    else if (m.t === 'snap' && CO.role === 'guest' && G && CO.active) this.applySnap(m);
    else if (m.t === 'me' && CO.role === 'host' && G && CO.active) this.applyMe(m);
    else if (m.t === 'dmg' && CO.role === 'guest' && G && G.state === 'play') { P.inv = 0; hurtPlayer(m.d, m.src); }
    else if (m.t === 'end' && G && CO.active) { CO.active = false; endRun(m.kind === 'win' ? 'win' : 'quit'); $('overSub').textContent = m.kind === 'win' ? 'Your team conquered the Zone!' : 'The co-op run is over.'; }
    else if (m.t === 'leave' && G && CO.active) { banner('👋 PARTNER LEFT', 'You continue alone.', 2.5, 'bad'); this.solo(); }
  },
  onClose() { if (G && CO.active && !G.ended) { banner('📡 CONNECTION LOST', 'Your partner disconnected. You continue alone.', 3, 'bad'); this.solo(); } coStatus('Connection closed.'); CO.conn = null; },
  solo() {
    CO.active = false; CO.partner = null;
    if (G && G.coGuest) { G.coGuest = false; G.nextBossT = G.t + 60; for (const e of G.enemies) e.cd = rand(1, 3); }
  },
  onNewGame() {
    CO.mirror.clear(); CO.dead.clear(); CO.hits = []; CO.kills = []; CO.partner = null; CO.hbl = []; CO.uid = 0;
    if (CO.role === 'guest') { G.coGuest = true; G.nextBossT = 1e9; G.emIdx = G.emIdx || 0; }
    G.coop = true;
  },
  // ----- host -----
  applyMe(m) {
    const q = CO.partner || (CO.partner = { tx: m.x, ty: m.y, x: m.x, y: m.y });
    Object.assign(q, { tx: m.x, ty: m.y, face: m.face, hp: m.hp, maxhp: m.maxhp, ghost: m.ghost, veh: m.veh, dash: m.dash, inv: m.inv, moving: m.moving, pal: m.pal, name: m.name, last: NOW });
    for (const [u, d, kx, ky] of m.hits || []) { const e = CO.byUid && CO.byUid.get(u); if (e && !e.dead) { e.lastW = null; hurtEnemy(e, d, kx, ky, true); } }
  },
  hostSnap() {
    const Q = CO.partner; if (!Q) return;
    const E = [], EB = [], HB = [], R2 = 1700 * 1700;
    CO.byUid = new Map();
    for (const e of G.enemies) {
      if (e.dead) continue; CO.byUid.set(e.uid, e);
      if (dist2(e.x, e.y, Q.x, Q.y) > R2 && !e.boss) continue;
      E.push([e.uid, e.id, e.x | 0, e.y | 0, Math.round((e.hp / e.maxhp) * 100), (e.boss ? 1 : 0) | (e.affix ? 2 : 0) | (e.mini ? 4 : 0), e.face || 1, e.boss || e.mini ? e.name : 0, e.affix || 0]);
    }
    for (const b of G.ebullets) { if (!b.uid) b.uid = ++CO.uid; if (Math.abs(b.x - Q.x) < 1100 && Math.abs(b.y - Q.y) < 900) EB.push([b.uid, b.x | 0, b.y | 0, b.vx | 0, b.vy | 0, b.r, b.k || 0, b.dmg | 0]); }
    for (const b of G.bullets) { if (HB.length > 50) break; if (Math.abs(b.x - Q.x) < 900 && Math.abs(b.y - Q.y) < 700) HB.push([b.x | 0, b.y | 0, b.vx | 0, b.vy | 0]); }
    Net.send({ t: 'snap', gt: G.t, w: Env.weather, p: [P.x | 0, P.y | 0, P.face, P.hp | 0, P.maxhp | 0, P.ghost > 0 ? 1 : 0, P.veh ? P.veh.kind : 0, P.moving ? 1 : 0], pal: P.pal, name: coName(), e: E, eb: EB, hb: HB, k: CO.kills.splice(0), lvl: G.level });
  },
  // ----- guest -----
  applySnap(m) {
    const now = NOW;
    G.t = lerp(G.t, m.gt, 0.5);
    if (m.w && m.w !== Env.weather && WEATHER[m.w]) Env.weather = m.w;
    const q = CO.partner || (CO.partner = { x: m.p[0], y: m.p[1] });
    Object.assign(q, { tx: m.p[0], ty: m.p[1], face: m.p[2], hp: m.p[3], maxhp: m.p[4], ghost: m.p[5], veh: m.p[6], moving: m.p[7], pal: m.pal, name: m.name, last: now });
    const seen = new Set();
    for (const [u, id, x, y, hp, fl, face, name, affix] of m.e) {
      seen.add(u);
      if (CO.dead.has(u) && now - CO.dead.get(u) < 1.5) continue;
      let e = CO.mirror.get(u);
      if (!e) {
        if (!ENEMIES[id]) continue;
        e = coMirror(id, x, y); e.uid = u; if (fl & 1) { e.boss = true; if (!G.bosses.includes(e)) G.bosses.push(e); } if (fl & 4) e.mini = true; if (name) e.name = name; if (affix) e.affix = affix;
        CO.mirror.set(u, e); G.enemies.push(e);
      }
      e.tx = x; e.ty = y; e.face = face; e.hp = (hp / 100) * e.maxhp; e.seen = now;
    }
    for (const [u, e] of CO.mirror) if (!seen.has(u)) { e.dead = true; CO.mirror.delete(u); }
    // enemy bullets become local bullets that can hit you
    const hitSet = CO.bHit || (CO.bHit = new Set());
    G.ebullets = m.eb.filter((b) => !hitSet.has(b[0])).map(([uid, x, y, vx, vy, r, k, dmg]) => ({ uid, x, y, vx, vy, r, k: k || undefined, dmg, life: 1 }));
    CO.hbl = m.hb.map(([x, y, vx, vy]) => ({ x, y, vx, vy, life: 0.1 }));
    for (const [id, xp, x, y, boss] of m.k || []) {
      G.kills++; addXp(xp * 0.8); Quests.prog('kill', (q2) => q2.id === id);
      Story.onKill({ id, boss: !!boss, lastW: null });
      if (Math.random() < 0.3) burst(x, y, 6, '140,40,30', 80);
    }
  },
  guestUpdateEnemies(dt) {
    EG.clear();
    const k = 1 - Math.exp(-dt * 12);
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (e.tx !== undefined) { const dx = e.tx - e.x, dy = e.ty - e.y; e.moving = Math.abs(dx) + Math.abs(dy) > 2; e.x += dx * k; e.y += dy * k; }
      e.anim += dt * (e.moving ? 8 : 2); e.t += dt; if (e.flash > 0) e.flash -= dt;
      EG.add(e);
    }
    G.enemies = G.enemies.filter((e) => !e.dead && e.uid !== undefined); // anything spawned locally belongs to the host's world
    G.bosses = G.bosses.filter((e) => !e.dead && e.uid !== undefined);
  },
  update(dt) {
    if (!CO.active || !G) return;
    const q = CO.partner;
    if (q) { const k = 1 - Math.exp(-dt * 12); q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; q.anim = (q.anim || 0) + dt * (q.moving ? 9 : 0); }
    CO.gInv = Math.max(0, CO.gInv - dt);
    // downed players come back as a ghost after 15s, or sooner when the partner walks over
    if (P.ghost > 0) {
      P.ghost -= dt; P.hp = 1;
      if (q && !q.ghost && dist2(q.x, q.y, P.x, P.y) < 80 * 80) { CO.reviveT += dt; if (CO.reviveT > 1.5) P.ghost = 0; } else CO.reviveT = 0;
      if (P.ghost <= 0) { P.ghost = 0; P.weapons = P.wBak || P.weapons; P.hp = P.maxhp * 0.5; P.inv = 2.5; banner('💚 REVIVED', 'Back in the fight!', 2, 'good'); Sfx.play('heal'); hudBuild(); }
    }
    if (CO.role === 'host' && P.ghost > 0 && q && q.ghost) { Net.send({ t: 'end', kind: 'dead' }); CO.active = false; endRun('dead', 'the Zone'); return; }
    CO.sendT -= dt;
    if (CO.sendT <= 0) {
      CO.sendT = 1 / 15;
      if (CO.role === 'host') this.hostSnap();
      else Net.send({ t: 'me', x: P.x | 0, y: P.y | 0, face: P.face, hp: P.hp | 0, maxhp: P.maxhp | 0, ghost: P.ghost > 0 ? 1 : 0, veh: P.veh ? P.veh.kind : 0, dash: P.dashT > 0 ? 1 : 0, inv: P.inv > 0 ? 1 : 0, moving: P.moving ? 1 : 0, pal: P.pal, name: coName(), hits: CO.hits.splice(0) });
    }
    for (const b of CO.hbl) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  },
};
// a mirrored enemy: a normal enemy object the guest only draws and shoots at
function coMirror(id, x, y) {
  const n = G.enemies.length, e = _c7Spawn(id, x, y, { noElite: true });
  if (G.enemies.length > n) G.enemies.pop();
  if (e.boss) G.bosses = G.bosses.filter((b) => b !== e);
  return e;
}
function coDown() {
  P.ghost = 15; P.hp = 1; P.wBak = P.weapons; P.weapons = []; CO.reviveT = 0;
  banner('💀 DOWNED', 'Walk to your partner to be revived, or wait 15s.', 3, 'bad', 2); hudBuild();
}

// ----- hooks -----
const _c7Spawn = spawnEnemy;
spawnEnemy = function (id, x, y, o) { const e = _c7Spawn(id, x, y, o); if (e && G && G.coop && CO.role === 'host') e.uid = ++CO.uid; return e; };
const _c7Kill = killEnemy;
killEnemy = function (e) {
  if (G && G.coGuest && CO.active) { if (!e.dead) { e.dead = true; CO.dead.set(e.uid, NOW); CO.mirror.delete(e.uid); burst(e.x, e.y - 10, 12, '140,40,30', 150); } return; }
  const was = e.dead; _c7Kill(e);
  if (!was && G && G.coop && CO.role === 'host' && CO.active && e.id !== 'phantom') CO.kills.push([e.id, e.d.xp || 1, e.x | 0, e.y | 0, e.boss ? 1 : 0]);
};
const _c7Hurt = hurtEnemy;
hurtEnemy = function (e, dmg, kx, ky, raw, proc) {
  if (G && G.coGuest && CO.active && e.uid) { const h = e.hp; const r = _c7Hurt(e, dmg, kx, ky, raw, proc); const d = h - Math.max(0, e.hp); if (d > 0) CO.hits.push([e.uid, Math.round(d * 10) / 10, kx | 0, ky | 0]); return r; }
  return _c7Hurt(e, dmg, kx, ky, raw, proc);
};
const _c7HurtP = hurtPlayer;
hurtPlayer = function (d, src, ig, kind) {
  if (CO.swap) { const q = CO.partner; if (q && !q.ghost && !q.inv && !q.dash && CO.gInv <= 0) { CO.gInv = 0.6; Net.send({ t: 'dmg', d: Math.round(d), src }); } return; }
  if (P.ghost > 0) return;
  _c7HurtP(d, src, ig, kind);
};
// mutants chase whichever player is closer (host side)
const _c7UpEn = updateEnemies;
updateEnemies = function (dt) {
  if (G.coGuest && CO.active) return Coop.guestUpdateEnemies(dt);
  const q = CO.partner;
  if (!(G.coop && CO.active && CO.role === 'host' && q && World.kind === 'over' && NOW - (q.last || 0) < 3) || q.ghost) return _c7UpEn(dt);
  const A = [], B = [];
  for (const e of G.enemies) (!e.dead && !e.boss && dist2(e.x, e.y, q.x, q.y) < dist2(e.x, e.y, P.x, P.y) ? B : A).push(e);
  if (P.ghost > 0) { B.push(...A); A.length = 0; }
  G.enemies = A; _c7UpEn(dt); const A2 = G.enemies;
  const sv = { x: P.x, y: P.y, inv: P.inv, dashT: P.dashT, moving: P.moving };
  P.x = q.x; P.y = q.y; P.inv = 0; P.dashT = 0; CO.swap = true;
  G.enemies = B;
  try { _c7UpEn(dt); } finally { CO.swap = false; Object.assign(P, sv); }
  G.enemies = A2.concat(G.enemies);
  EG.clear(); for (const e of G.enemies) if (!e.dead) EG.add(e);
};
const _c7Hatch = useHatch;
useHatch = function (h) { if (G.coop && CO.active) { banner('🕳️ LAB SEALED', 'Laboratories are closed in co-op.', 1.6, 'bad'); return; } _c7Hatch(h); };
const _c7New = newGame;
newGame = function (st, ch, mode, sp, seed, diff) {
  if (CO.start) { const s = CO.start; CO.start = null; st = s.stage; sp = s.spawn; seed = s.seed; diff = s.diff; mode = 'standard'; CO.active = true; }
  else if (!CO.conn) CO.active = false;
  _c7New(st, ch, mode, sp, seed, diff);
  if (CO.active) Coop.onNewGame();
};
const _c7RS = RunSave.save.bind(RunSave);
RunSave.save = function () { if (G && G.coop) return; _c7RS(); };
const _c7EvUp = Events.update.bind(Events);
Events.update = function (dt) { if (G.coGuest && CO.active) return; _c7EvUp(dt); };

// contracts that spawn their own mutants only make sense on the host
for (const k of ['measure', 'track', 'village', 'photo']) { const d = QT2[k], w = d.w; d.w = () => (G && G.coGuest ? 0 : w()); }

// partner drawing (world space)
function drawPartner() {
  const q = CO.partner; if (!CO.active || !q || !G || G.title) return;
  const pal = q.pal || PAL_PLAYER;
  ctx.globalAlpha = q.ghost ? 0.4 : 1;
  shadow(q.x, q.y, 14, 5, 0.35);
  if (q.veh && VEH[q.veh]) { drawVehicle({ kind: q.veh, a: q.face > 0 ? 0 : Math.PI }, q.x, q.y); ctx.save(); ctx.translate(0, q.veh === 'jeep' ? -26 : -12); drawStalker({ x: q.x, y: q.y, z: 0, anim: q.anim || 0, face: q.face || 1, aim: q.face > 0 ? 0 : Math.PI, moving: q.moving }, pal, true); ctx.restore(); }
  else drawStalker({ x: q.x, y: q.y, z: 0, anim: q.anim || 0, face: q.face || 1, aim: q.face > 0 ? 0 : Math.PI, moving: !!q.moving }, pal, true);
  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = q.ghost ? '#aaa' : '#7dd8ff';
  ctx.fillText((q.ghost ? '💀 ' : '') + (q.name || 'Partner'), q.x, q.y - 64);
  if (q.maxhp) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(q.x - 21, q.y - 58, 42, 5); ctx.fillStyle = '#7dd8ff'; ctx.fillRect(q.x - 20, q.y - 57, 40 * clamp(q.hp / q.maxhp, 0, 1), 3); }
  if (P.ghost > 0 && !q.ghost) { ctx.strokeStyle = 'rgba(125,216,255,0.5)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x, P.y - 20); ctx.lineTo(q.x, q.y - 20); ctx.stroke(); ctx.setLineDash([]); }
  // host bullets seen by the guest
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,140,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (const b of CO.hbl) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); }
  ctx.stroke(); ctx.restore();
}

// ----- UI -----
addEventListener('DOMContentLoaded', () => {
  const t = document.createElement('div'); t.id = 'coop'; t.className = 'screen scroll';
  t.innerHTML = `<div class="hdr"><button class="back" id="coBack">← BACK</button><h2>CO-OP</h2><span></span></div>
  <div class="coBox">
    <div class="sect">HOST A GAME</div>
    <p class="dim">Pick your stage, stalker and difficulty on the PLAY screen first. Your friend plays with their own stalker.</p>
    <label class="set"><span>Password (optional)</span><input id="coPw" type="text" maxlength="24" placeholder="leave empty for none"></label>
    <button class="big" id="coHost">🏠 CREATE ROOM</button>
    <div id="coRoom" style="display:none"><div class="coCode" id="coCodeTxt"></div><div class="coLinkRow"><input id="coLink" readonly><button class="big ghost" id="coCopy">📋 COPY LINK</button></div>
    <button class="big" id="coStart" disabled>▶ START</button></div>
    <div class="sect">JOIN A FRIEND</div>
    <div class="coLinkRow"><input id="coJoinCode" maxlength="5" placeholder="ROOM CODE"><input id="coJoinPw" placeholder="password (if any)"><button class="big ghost" id="coJoin">🔗 JOIN</button></div>
    <div id="coStatus" class="dim">Share the link: your friend opens it and is in.</div>
    <p class="dim small">Co-op uses a free public connection service (PeerJS) to introduce the two browsers, then plays directly between them. Some strict networks can block it.</p>
  </div>`;
  document.body.appendChild(t);
  const btn = document.createElement('button'); btn.className = 'big ghost'; btn.id = 'coopBtn'; btn.textContent = '👥 CO-OP';
  $('bunkerBtn').parentNode.insertBefore(btn, $('bunkerBtn'));
  btn.onclick = () => { Sfx.init(); openScreen('coop'); };
  const _os = openScreen;
  openScreen = function (id) { hide('coop'); _os(id); };
  $('coBack').onclick = () => { if (!G || G.title) { if (!CO.active && CO.role === 'host' && !CO.conn) Net.leave(); } hide('coop'); openScreen('title'); };
  const upd = () => { CO.pw = $('coPw').value.trim(); if (CO.code) $('coLink').value = coLink(); };
  $('coPw').oninput = upd;
  $('coHost').onclick = async () => {
    $('coHost').disabled = true; coStatus('⏳ Creating room…');
    try { CO.pw = $('coPw').value.trim(); await Net.host(); $('coRoom').style.display = ''; $('coCodeTxt').textContent = 'ROOM ' + CO.code; upd(); coStatus('⏳ Waiting for your friend to open the link…'); }
    catch (e) { coStatus('⚠️ ' + e.message); $('coHost').disabled = false; }
  };
  $('coCopy').onclick = () => { const v = $('coLink').value; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => coStatus('📋 Link copied! Send it to your friend.'), () => { $('coLink').select(); document.execCommand('copy'); coStatus('📋 Link copied!'); }); };
  $('coStart').onclick = () => {
    const S = Save.data, st = S.stages.includes(S.stage) ? S.stage : 'zone';
    const s = { t: 'start', stage: st, spawn: (S.spawn || {})[st] || 0, seed: (Math.random() * 1e9) | 0, diff: S.diff || 'rookie' };
    Net.send(s); CO.start = s; NEXT_RUN = { mode: 'standard', mutators: [], ngplus: false }; hide('coop'); startGame();
  };
  $('coJoin').onclick = async () => { const c = $('coJoinCode').value.trim(); if (c.length < 5) { coStatus('Enter the 5-letter room code.'); return; } coStatus('⏳ Connecting to room ' + c.toUpperCase() + '…'); try { await Net.join(c, $('coJoinPw').value.trim()); } catch (e) { coStatus('⚠️ ' + e.message); } };
  // opened from a shared link: fill in and connect straight away
  const qs = new URLSearchParams(location.search), jc = qs.get('join');
  if (jc) { $('coJoinCode').value = jc; $('coJoinPw').value = qs.get('pw') || ''; openScreen('coop'); $('coJoin').onclick(); }
  // run end: tell the partner
  const _er = endRun;
  endRun = function (kind, src) {
    if (G && G.coop && CO.active && !G.ended) {
      if (kind === 'dead') { if (CO.partner && !CO.partner.ghost) { coDown(); return; } }
      if (CO.role === 'host') Net.send({ t: 'end', kind }); else Net.send({ t: 'leave' });
      CO.active = false;
    }
    _er(kind, src);
  };
  const _dp = drawPlayer;
  drawPlayer = function () { if (P.ghost > 0) { ctx.globalAlpha = 0.4; _dp(); ctx.globalAlpha = 1; ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ddd'; ctx.fillText('DOWNED ' + Math.ceil(P.ghost) + 's', P.x, P.y - 66); } else _dp(); };
  const _mm = drawMinimap;
  drawMinimap = function () { _mm(); const q = CO.partner; if (!CO.active || !q || World.kind !== 'over') return; const S = mm.width, span = 2000, f = S / span, x = clamp((q.x - P.x + span / 2) * f, 8, S - 8), y = clamp((q.y - P.y + span / 2) * f, 8, S - 8); mmx.fillStyle = '#7dd8ff'; mmx.beginPath(); mmx.arc(x, y, 6, 0, TAU); mmx.fill(); mmx.strokeStyle = '#000'; mmx.lineWidth = 2; mmx.stroke(); };
});
