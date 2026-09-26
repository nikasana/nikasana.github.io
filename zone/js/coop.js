'use strict';
// ---------- online co-op for up to 4 players: lobby, ready-up, the host runs the Zone ----------
// Transport: PeerJS (WebRTC, loaded on demand). ?coopdebug=1 swaps in a BroadcastChannel transport so tabs can test offline.
const CO_MAX = 4;
const CO = { active: false, role: null, me: 'h', conn: null, conns: new Map(), peer: null, code: '', pw: '', players: new Map(), settings: null, ready: false,
  hits: [], kills: [], mirror: new Map(), dead: new Map(), sendT: 0, pingT: 0, uid: 0, start: null, startMsg: null, reviveT: 0, hbl: [], nextPid: 1, stats: {} };
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
function bcConn(code, me) {
  const ch = new BroadcastChannel('zb-' + code), h = {};
  const c = { open: true, send: (d) => ch.postMessage({ from: me, d }), on: (ev, fn) => { h[ev] = fn; }, close: () => { ch.postMessage({ from: me, bye: 1 }); ch.close(); c.open = false; } };
  ch.onmessage = (m) => { if (m.data.from === me) return; if (m.data.bye) { c.open = false; h.close && h.close(); return; } h.data && h.data(m.data.d); };
  return c;
}
function coNick() { return (Save.data.nick || '').trim() || (CHARACTERS.find((x) => x.id === Save.data.char) || CHARACTERS[0]).name; }
function coPal(char) { const c = CHARACTERS.find((x) => x.id === char) || CHARACTERS[0]; return { ...PAL_PLAYER, ...c.pal }; }
function coClock() { return performance.now() / 1000; } // real time: keeps ticking in background tabs
function coStatus(s) { const el = $('coStatus'); if (el) el.innerHTML = s; }

const Net = {
  // fixed: a crew's own room code (the same on every teammate's device); rejects with type 'taken' when a teammate already hosts it
  async host(fixed, tries = 0) {
    Net.leave(); CO.code = fixed || coCode(); CO.role = 'host'; CO.me = 'h'; CO.nextPid = 1;
    CO.players = new Map([['h', { pid: 'h', name: coNick(), char: Save.data.char, ready: true, ping: 0 }]]);
    CO.settings = coDefaultSettings();
    if (CO_DEBUG) {
      const lobby = new BroadcastChannel('zb-lobby-' + CO.code); CO.lobbyCh = lobby;
      if (fixed && await Net.probe(fixed)) { lobby.close(); Net.leave(); const e = new Error('taken'); e.type = 'taken'; throw e; }
      lobby.onmessage = (m) => { if (String(m.data).startsWith('probe')) { lobby.postMessage('here' + m.data); return; } if (String(m.data).startsWith('here')) return; const c = bcConn(CO.code + '-' + m.data, 'host'); Net.accept(c); lobby.postMessage(m.data); };
      return;
    }
    await loadPeer();
    await new Promise((res, rej) => {
      const peer = new Peer(CO_PREFIX + CO.code); CO.peer = peer;
      peer.on('open', res);
      peer.on('error', (e) => {
        if (CO.peer !== peer) return;
        if (e.type === 'unavailable-id') { peer.destroy(); if (fixed) { Net.leave(); const t = new Error('taken'); t.type = 'taken'; rej(t); } else Net.host(null, tries).then(res, rej); }
        else if (/server-error|network|socket-error|socket-closed/.test(e.type) && tries < 4) { peer.destroy(); coStatus('⏳ Connecting to the server… (try ' + (tries + 2) + '/5)'); setTimeout(() => Net.host(fixed, tries + 1).then(res, rej), 1000 + tries * 1200); }
        else { coStatus('⚠️ ' + (e.message || e.type)); rej(e); }
      });
      CO.peer.on('connection', (c) => c.on('open', () => Net.accept(c)));
      CO.peer.on('disconnected', () => { if (CO.peer && !CO.peer.destroyed) try { CO.peer.reconnect(); } catch (e) { /* retry later */ } });
    });
  },
  // host a room under a given code, keeping the current players (host migration)
  async hostAt(code) {
    CO.code = code;
    if (CO_DEBUG) { const lobby = new BroadcastChannel('zb-lobby-' + code); CO.lobbyCh = lobby; lobby.onmessage = (m) => { const c = bcConn(code + '-' + m.data, 'host'); Net.accept(c); lobby.postMessage(m.data); }; return; }
    await loadPeer();
    await new Promise((res, rej) => {
      try { CO.peer && CO.peer.destroy(); } catch (e) { /* already gone */ }
      CO.peer = new Peer(CO_PREFIX + code);
      CO.peer.on('open', res); CO.peer.on('error', rej);
      CO.peer.on('connection', (c) => c.on('open', () => Net.accept(c)));
    });
  },
  // reconnect a guest to a (new) host without leaving the running game
  async rejoin(code) {
    const hello = { t: 'hello', build: ZB_BUILD, pw: CO.pw, name: coNick(), char: Save.data.char, rejoin: CO.me, inGame: true };
    if (CO_DEBUG) { const lobby = new BroadcastChannel('zb-lobby-' + code), sid = Math.random().toString(36).slice(2); lobby.onmessage = (m) => { if (m.data !== sid) return; const c = bcConn(code + '-' + sid, 'guest'); Net.bindGuest(c); c.send(hello); }; lobby.postMessage(sid); return; }
    await loadPeer();
    try { CO.peer && CO.peer.destroy(); } catch (e) { /* already gone */ }
    CO.peer = new Peer();
    CO.peer.on('open', () => { const c = CO.peer.connect(CO_PREFIX + code, { reliable: true }); c.on('open', () => { Net.bindGuest(c); c.send(hello); }); });
  },
  // host: a new connection waits for its hello before it becomes a player
  accept(c) {
    c.on('data', (m) => { if (m && m.t === 'hello') Coop.hello(c, m); else if (c.pid) { const p = CO.players.get(c.pid); if (p) p.heard = coClock(); Coop.onMsg(m, c.pid); } });
    c.on('close', () => { if (c.pid && CO.conns.get(c.pid) === c) Coop.dropped(c.pid); });
  },
  async join(code, pw) {
    code = code.toUpperCase().trim();
    if (CO.role === 'guest' && CO.code === code && (CO.joining || CO.conn)) { coStatus(CO.conn ? '✅ Already in the room.' : '⏳ Still connecting to room ' + code + '…'); return; }
    Net.leave(); CO.closeWhy = null;
    CO.code = code; CO.pw = pw || ''; CO.role = 'guest'; CO.joining = true; coUI();
    let rj = CO.rejoinId || null; try { rj = rj || sessionStorage.getItem('zb_rejoin_' + code); } catch (e) { /* storage blocked */ }
    const hello = { t: 'hello', build: ZB_BUILD, pw: CO.pw, name: coNick(), char: Save.data.char, rejoin: rj };
    if (CO_DEBUG) {
      const lobby = new BroadcastChannel('zb-lobby-' + CO.code), sid = Math.random().toString(36).slice(2);
      const nf = setTimeout(() => { if (CO.joining && !CO.conn && CO.code === code) { CO.joining = false; coUI(); coStatus('⚠️ Room ' + code + ' not found. Is the host still waiting?'); if (CO.onJoinFail) { const f = CO.onJoinFail; CO.onJoinFail = null; f(true); } } }, 1500);
      lobby.onmessage = (m) => { if (m.data !== sid) return; clearTimeout(nf); CO.joining = false; CO.onJoinFail = null; const c = bcConn(CO.code + '-' + sid, 'guest'); Net.bindGuest(c); c.send(hello); coUI(); };
      lobby.postMessage(sid);
      return;
    }
    await loadPeer();
    Net.tryJoin(hello, 1);
  },
  // the public broker sometimes fails the first time ("server-error"): quietly try again a few times
  tryJoin(hello, n) {
    if (!CO.joining || CO.role !== 'guest') return;
    try { CO.peer && CO.peer.destroy(); } catch (e) { /* already gone */ }
    const code = CO.code, peer = new Peer(); CO.peer = peer;
    let done = false;
    const retry = (why, missing) => {
      if (done || CO.peer !== peer || !CO.joining) return;
      done = true; try { peer.destroy(); } catch (e) { /* already gone */ }
      if (n < (missing ? 3 : 5)) { coStatus('⏳ Connecting to room ' + code + '… (try ' + (n + 1) + ')'); setTimeout(() => Net.tryJoin(hello, n + 1), 900 + n * 700); return; }
      CO.joining = false; coUI(); coStatus('⚠️ ' + why); if (CO.onJoinFail) { const f = CO.onJoinFail; CO.onJoinFail = null; f(missing); }
    };
    peer.on('error', (e) => retry(e.type === 'peer-unavailable' ? 'Room ' + code + ' not found. Is the host still waiting?' : e.message || e.type, e.type === 'peer-unavailable'));
    peer.on('open', () => { const c = peer.connect(CO_PREFIX + code, { reliable: true }); c.on('open', () => { if (CO.peer !== peer || done) return; done = true; CO.joining = false; CO.onJoinFail = null; Net.bindGuest(c); c.send(hello); coUI(); }); c.on('error', (e) => retry(e.message || e.type)); });
    setTimeout(() => retry('Could not reach room ' + code + '. Check the code and that the host is still waiting, then press JOIN again.'), 8000);
  },
  // debug transport: is somebody already hosting this code?
  probe(code) {
    return new Promise((res) => { const ch = new BroadcastChannel('zb-lobby-' + code), id = 'probe' + Math.random().toString(36).slice(2); ch.onmessage = (m) => { if (m.data === 'here' + id) { ch.close(); res(true); } }; ch.postMessage(id); setTimeout(() => { try { ch.close(); } catch (e) { /* closed */ } res(false); }, 450); });
  },
  bindGuest(c) {
    CO.conn = c; CO.lastHostMsg = coClock();
    c.on('data', (m) => { if (CO.conn === c) CO.lastHostMsg = coClock(); Coop.onMsg(m, 'h'); });
    c.on('close', () => { if (CO.conn === c) { CO.conn = null; Coop.onClose(); } });
  },
  send(m) { const c = CO.conn; if (c && c.open !== false) try { c.send(m); } catch (e) { /* dropped packet */ } },
  sendTo(pid, m) { const c = CO.conns.get(pid); if (c && c.open !== false) try { c.send(m); } catch (e) { /* dropped packet */ } },
  bcast(m, except) { for (const pid of CO.conns.keys()) if (pid !== except) this.sendTo(pid, m); },
  leave() {
    CO.joining = false;
    for (const c of [CO.conn, ...CO.conns.values()]) try { c && c.close(); } catch (e) { /* already closed */ }
    try { CO.peer && CO.peer.destroy(); } catch (e) { /* already gone */ }
    try { CO.lobbyCh && CO.lobbyCh.close(); } catch (e) { /* already closed */ }
    CO.conn = null; CO.conns = new Map(); CO.peer = null; CO.lobbyCh = null; CO.active = false; CO.players = new Map(); CO.ready = false; CO.role = null; CO.startMsg = null;
  },
};
function coDefaultSettings() { const S = Save.data, st = S.stages.includes(S.stage) ? S.stage : 'zone'; return { stage: st, spawn: (S.spawn || {})[st] || 0, diff: S.diff || 'rookie' }; }
function coOthers() { return [...CO.players.values()].filter((p) => p.pid !== CO.me); }
function coLobbyMsg() { return { t: 'lobby', players: [...CO.players.values()].map(({ pid, name, char, ready, ping }) => ({ pid, name, char, ready, ping })), settings: CO.settings }; }

const Coop = {
  // ----- lobby (host) -----
  hello(c, m) {
    if (m.build !== ZB_BUILD) { c.send({ t: 'deny', why: 'Different game versions: you have ' + (m.build ? 'v' + m.build : 'an older one') + ', the host has v' + ZB_BUILD + '. Both refresh the page (it updates itself), then join again.' }); setTimeout(() => c.close(), 300); return; }
    if (CO.pw && m.pw !== CO.pw) { c.send({ t: 'deny', why: 'Wrong password.' }); setTimeout(() => c.close(), 300); return; }
    let pid = m.rejoin && CO.players.has(m.rejoin) && m.rejoin !== 'h' ? m.rejoin : null;
    if (pid && CO.conns.has(pid) && CO.conns.get(pid) !== c) { const old = CO.conns.get(pid); old.pid = null; try { old.close(); } catch (e) { /* already closed */ } } // same player back after a refresh: drop the stale connection
    if (!pid) {
      if (CO.players.size >= CO_MAX) { c.send({ t: 'deny', why: 'The room is full (' + CO_MAX + '/' + CO_MAX + ').' }); setTimeout(() => c.close(), 300); return; }
      pid = 'g' + CO.nextPid++;
      CO.players.set(pid, { pid, name: String(m.name || 'Stalker').slice(0, 16), char: CHARACTERS.some((x) => x.id === m.char) ? m.char : 'rookie', ready: false, ping: 0 });
    }
    const p = CO.players.get(pid); p.gone = false; p.last = NOW;
    if (m.inGame && CO.active) banner('📡 ' + p.name.toUpperCase() + ' RECONNECTED', '', 1.8, 'good');
    c.pid = pid; CO.conns.set(pid, c);
    c.send({ t: 'welcome', pid, host: coNick() });
    if (CO.active && CO.startMsg && !m.inGame) { p.ready = true; c.send(CO.startMsg); banner('👋 ' + p.name.toUpperCase() + ' JOINED', 'They drop into the Zone next to you.', 2.5, 'good'); }
    Net.bcast(coLobbyMsg()); coLobbyUI(); Sfx.init(); Sfx.play('quest');
  },
  dropped(pid) {
    const p = CO.players.get(pid); CO.conns.delete(pid);
    if (!p) return;
    if (CO.active && G && !G.ended) { p.gone = true; banner('📡 ' + p.name.toUpperCase() + ' DISCONNECTED', 'They can rejoin with the same link.', 2.5, 'bad'); }
    else CO.players.delete(pid);
    Net.bcast(coLobbyMsg()); coLobbyUI();
  },
  onMsg(m, from) {
    if (!m || !m.t) return;
    const host = CO.role === 'host';
    if (host) {
      const p = CO.players.get(from); if (!p) return;
      if (m.t === 'lobbyMe') { if (m.name) p.name = String(m.name).slice(0, 16); if (m.char && CHARACTERS.some((x) => x.id === m.char)) p.char = m.char; p.ready = !!m.ready; Net.bcast(coLobbyMsg()); coLobbyUI(); }
      else if (m.t === 'pong') { p.ping = Math.round((performance.now() - m.ts)); }
      else if (m.t === 'me' && G && CO.active) this.applyMe(p, m);
      else if (m.t === 'rev') { const r = CO.stats[m.by]; if (r) r.revives++; }
      else if (m.t === 'leave') { CO.conns.delete(from); if (CO.active) { p.gone = true; banner('👋 ' + p.name.toUpperCase() + ' LEFT', '', 2, 'bad'); } else CO.players.delete(from); Net.bcast(coLobbyMsg()); coLobbyUI(); }
      return;
    }
    // guest
    if (m.t === 'welcome') { CO.me = m.pid; CO.rejoinId = m.pid; try { sessionStorage.setItem('zb_rejoin_' + CO.code, m.pid); } catch (e) { /* storage blocked */ } coStatus('✅ Joined the room of ' + String(m.host).replace(/[<>&]/g, '') + '.'); coUI(); }
    else if (m.t === 'deny') { CO.closeWhy = '⛔ ' + m.why; coStatus(CO.closeWhy); Net.leave(); coUI(); }
    else if (m.t === 'lobby') { CO.players = new Map(m.players.map((p) => [p.pid, { ...p, ...(CO.players.get(p.pid) || {}), name: p.name, char: p.char, ready: p.ready, ping: p.ping }])); CO.settings = m.settings; coLobbyUI(); }
    else if (m.t === 'ping') Net.send({ t: 'pong', ts: m.ts });
    else if (m.t === 'count') coCountdown(m.n);
    else if (m.t === 'start') { CO.start = m; NEXT_RUN = { mode: 'standard', mutators: [], ngplus: false }; hide('coop'); coCountdown(0); startGame(); }
    else if (m.t === 'snap' && G && CO.active) this.applySnap(m);
    else if (m.t === 'level' && G && CO.active) coGoLevel(m);
    else if (m.t === 'dmg' && G && G.state === 'play') { P.inv = 0; hurtPlayer(m.d, m.src); }
    else if (m.t === 'end' && G && CO.active) { CO.active = false; CO.results = m.stats; endRun(m.kind === 'win' ? 'win' : 'quit'); $('overSub').textContent = m.kind === 'win' ? 'Your team conquered the Zone!' : m.kind === 'dead' ? 'The whole team went down.' : 'The host ended the run.'; coResults(m.stats); }
  },
  onClose() {
    if (G && CO.active && !G.ended && this.migrate()) return;
    if (G && CO.active && !G.ended) { banner('📡 HOST DISCONNECTED', 'You continue alone. Open the link again to rejoin.', 3.5, 'bad'); this.solo(); }
    CO.conn = null;
    if (!CO.closeWhy) coStatus('⚠️ Lost the connection to the host. Press JOIN to try again.');
    coUI();
  },
  // the host dropped mid-run: the first remaining guest becomes the new host, everyone else reconnects to them
  migrate() {
    const left = [...CO.players.values()].filter((p) => p.pid !== 'h' && !p.gone).map((p) => p.pid).sort();
    if (!left.length || !left.includes(CO.me)) return false;
    const newCode = CO.code.length === 5 ? CO.code + 'B' : CO.code.slice(0, 5) + String.fromCharCode(CO.code.charCodeAt(5) + 1);
    CO.conn = null;
    if (left[0] === CO.me) {
      banner('👑 YOU ARE THE HOST NOW', 'The host left. The run continues with you in charge.', 3.5, 'good', 2);
      const mine = CO.players.get(CO.me); CO.players.delete('h'); CO.players.delete(CO.me);
      const rest = new Map([['h', { ...mine, pid: 'h', ready: true }]]); for (const [k, v] of CO.players) rest.set(k, { ...v, gone: true }); CO.players = rest;
      CO.stats.h = CO.stats[CO.me] || CO.stats.h; delete CO.stats[CO.me];
      CO.me = 'h'; CO.role = 'host'; CO.code = newCode; CO.conns = new Map();
      CO.uid = Math.max(CO.uid, ...[...CO.mirror.keys()].map(Number).filter((n) => n > 0), 0);
      G.coGuest = false; G.nextBossT = G.t + 60; for (const e of G.enemies) e.cd = rand(1, 3);
      CO.startMsg = { t: 'start', stage: G.stage, spawn: G.spawnIdx || 0, seed: G.seed, diff: G.diff };
      Net.hostAt(newCode).catch(() => { banner('📡 COULD NOT RE-HOST', 'You continue alone.', 3, 'bad'); this.solo(); });
    } else {
      banner('📡 HOST LEFT', 'Reconnecting to the new host…', 3, 'bad');
      const code = newCode; CO.code = code;
      let tries = 0; const tryJoin = () => { if (!CO.active || CO.conn || tries++ > 6) { if (!CO.conn && CO.active) { banner('📡 COULD NOT RECONNECT', 'You continue alone.', 3, 'bad'); this.solo(); } return; } Net.rejoin(code); setTimeout(tryJoin, 3000); };
      setTimeout(tryJoin, 2000);
    }
    return true;
  },
  solo() {
    CO.active = false;
    if (G && G.coGuest) { G.coGuest = false; G.nextBossT = G.t + 60; for (const e of G.enemies) e.cd = rand(1, 3); }
  },
  onNewGame() {
    CO.mirror.clear(); CO.dead.clear(); CO.hits = []; CO.kills = []; CO.hbl = []; CO.uid = 0; CO.stats = {};
    for (const p of CO.players.values()) { p.x = p.tx = World.start.x; p.y = p.ty = World.start.y; p.ghost = 0; p.gInv = 0; CO.stats[p.pid] = { name: p.name, char: p.char, kills: 0, dmg: 0, revives: 0 }; }
    if (CO.role === 'guest') { G.coGuest = true; G.nextBossT = 1e9; }
    const n = [...CO.players.values()].filter((p) => !p.gone).length;
    G.coop = true; G.coopMul = 1 + 0.45 * (n - 1); G.coopHp = 1 + 0.35 * (n - 1);
  },
  // ----- in game (host) -----
  applyMe(p, m) {
    Object.assign(p, { tx: m.x, ty: m.y, face: m.face, hp: m.hp, maxhp: m.maxhp, ghost: m.ghost, veh: m.veh, dash: m.dash, inv: m.inv, moving: m.moving, last: NOW });
    if (p.x === undefined) { p.x = m.x; p.y = m.y; }
    for (const [u, d, kx, ky] of m.hits || []) { const e = CO.byUid && CO.byUid.get(u); if (e && !e.dead) { e.lastW = null; e.lastHit = p.pid; if (CO.stats[p.pid]) CO.stats[p.pid].dmg += d; hurtEnemy(e, d, kx, ky, true); } }
  },
  hostSnap(p) {
    const E = [], EB = [], HB = [], R2 = 1700 * 1700;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (dist2(e.x, e.y, p.x, p.y) > R2 && !e.boss) continue;
      E.push([e.uid, e.id, e.x | 0, e.y | 0, Math.round((e.hp / e.maxhp) * 100), (e.boss ? 1 : 0) | (e.affix ? 2 : 0) | (e.mini ? 4 : 0), e.face || 1, e.boss || e.mini ? e.name : 0, e.affix || 0]);
    }
    for (const b of G.ebullets) { if (!b.uid) b.uid = ++CO.uid; if (Math.abs(b.x - p.x) < 1100 && Math.abs(b.y - p.y) < 900) EB.push([b.uid, b.x | 0, b.y | 0, b.vx | 0, b.vy | 0, b.r, b.k || 0, b.dmg | 0]); }
    for (const b of G.bullets) { if (HB.length > 50) break; if (Math.abs(b.x - p.x) < 900 && Math.abs(b.y - p.y) < 700) HB.push([b.x | 0, b.y | 0, b.vx | 0, b.vy | 0]); }
    const pl = [['h', coNick(), Save.data.char, P.x | 0, P.y | 0, P.face, P.hp | 0, P.maxhp | 0, P.ghost > 0 ? 1 : 0, P.veh ? P.veh.kind : 0, P.moving ? 1 : 0, 0]];
    for (const q of CO.players.values()) if (q.pid !== 'h' && q.pid !== p.pid && !q.gone && q.x !== undefined) pl.push([q.pid, q.name, q.char, q.x | 0, q.y | 0, q.face, q.hp | 0, q.maxhp | 0, q.ghost ? 1 : 0, q.veh || 0, q.moving ? 1 : 0, q.ping || 0]);
    Net.sendTo(p.pid, { t: 'snap', lv: World.cur, gt: G.t, w: Env.weather, pl, e: E, eb: EB, hb: HB, k: CO.kills, ping: p.ping || 0 });
  },
  // ----- in game (guest) -----
  applySnap(m) {
    const now = NOW;
    if (m.lv && m.lv !== World.cur) { // the host changed level: follow them
      const h = m.lv === 'over' ? World.hatches.find((x) => x.exit || x.up) : World.hatches.find((x) => 'lab' + x.idx === m.lv);
      if (h) { CO.mirror.clear(); CO.dead.clear(); _c7Hatch(h); }
      return;
    }
    G.t = lerp(G.t, m.gt, 0.5); CO.myPing = m.ping;
    if (m.w && m.w !== Env.weather && WEATHER[m.w]) Env.weather = m.w;
    const seenP = new Set();
    for (const [pid, name, char, x, y, face, hp, maxhp, ghost, veh, moving, ping] of m.pl) {
      seenP.add(pid);
      const q = CO.players.get(pid) || { pid, x, y }; CO.players.set(pid, q);
      if (q.x === undefined) { q.x = x; q.y = y; }
      Object.assign(q, { name, char, tx: x, ty: y, face, hp, maxhp, ghost, veh, moving, ping, gone: false, last: now });
    }
    for (const q of CO.players.values()) if (q.pid !== CO.me && !seenP.has(q.pid)) q.gone = true;
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
    const hitSet = CO.bHit || (CO.bHit = new Set());
    G.ebullets = m.eb.filter((b) => !hitSet.has(b[0])).map(([uid, x, y, vx, vy, r, k, dmg]) => ({ uid, x, y, vx, vy, r, k: k || undefined, dmg, life: 1 }));
    CO.hbl = m.hb.map(([x, y, vx, vy]) => ({ x, y, vx, vy, life: 0.1 }));
    for (const [kid, id, xp, x, y, boss] of m.k || []) {
      if (CO.seenK && CO.seenK.has(kid)) continue; (CO.seenK || (CO.seenK = new Set())).add(kid);
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
    G.enemies = G.enemies.filter((e) => !e.dead && e.uid !== undefined);
    G.bosses = G.bosses.filter((e) => !e.dead && e.uid !== undefined);
  },
  update(dt) {
    const host = CO.role === 'host';
    // lobby pings
    if (host && CO.conns.size) { CO.pingT -= dt; if (CO.pingT <= 0) { CO.pingT = 2; Net.bcast({ t: 'ping', ts: performance.now() }); if (!CO.active) Net.bcast(coLobbyMsg()); } }
    // heartbeat: silence for 6s counts as a disconnect (closing a tab or losing Wi-Fi may never send a goodbye)
    if (CO.role === 'guest' && CO.conn && coClock() - (CO.lastHostMsg || coClock()) > 6) { const c = CO.conn; CO.conn = null; try { c.close(); } catch (e) { /* already closed */ } this.onClose(); }
    if (host) for (const [pid, c] of CO.conns) { const p = CO.players.get(pid); if (p && p.heard && coClock() - p.heard > 6) { c.pid = null; try { c.close(); } catch (e) { /* already closed */ } this.dropped(pid); } }
    if (!CO.active || !G) return;
    const k = 1 - Math.exp(-dt * 12);
    for (const q of coOthers()) { if (q.tx === undefined) continue; q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; q.anim = (q.anim || 0) + dt * (q.moving ? 9 : 0); q.gInv = Math.max(0, (q.gInv || 0) - dt); }
    // downed players come back after 15s, or sooner when any teammate stands next to them
    if (P.ghost > 0) {
      P.ghost -= dt; P.hp = 1;
      const rescuer = coOthers().find((q) => !q.gone && !q.ghost && q.x !== undefined && dist2(q.x, q.y, P.x, P.y) < 80 * 80);
      if (rescuer) { CO.reviveT += dt; if (CO.reviveT > 1.5) { P.ghost = 0; if (host) { if (CO.stats[rescuer.pid]) CO.stats[rescuer.pid].revives++; } else Net.send({ t: 'rev', by: rescuer.pid }); } } else CO.reviveT = 0;
      if (P.ghost <= 0) { P.ghost = 0; P.weapons = P.wBak || P.weapons; P.hp = P.maxhp * 0.5; P.inv = 2.5; banner('💚 REVIVED', 'Back in the fight!', 2, 'good'); Sfx.play('heal'); hudBuild(); }
    }
    if (host) {
      const alive = coOthers().filter((q) => !q.gone && !q.ghost);
      if (P.ghost > 0 && !alive.length) { Net.bcast({ t: 'end', kind: 'dead', stats: CO.stats }); CO.active = false; endRun('dead', 'the Zone'); coResults(CO.stats); return; }
    }
    CO.sendT -= dt;
    if (CO.sendT <= 0) {
      CO.sendT = 1 / 15;
      if (host) { CO.byUid = new Map(); for (const e of G.enemies) if (!e.dead) CO.byUid.set(e.uid, e); for (const q of coOthers()) if (!q.gone && CO.conns.has(q.pid)) this.hostSnap(q); CO.kills = CO.kills.filter((x) => NOW - x[6] < 1); }
      else Net.send({ t: 'me', x: P.x | 0, y: P.y | 0, face: P.face, hp: P.hp | 0, maxhp: P.maxhp | 0, ghost: P.ghost > 0 ? 1 : 0, veh: P.veh ? P.veh.kind : 0, dash: P.dashT > 0 ? 1 : 0, inv: P.inv > 0 ? 1 : 0, moving: P.moving ? 1 : 0, hits: CO.hits.splice(0) });
    }
    for (const b of CO.hbl) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  },
};
function coMirror(id, x, y) {
  const n = G.enemies.length, e = _c7Spawn(id, x, y, { noElite: true });
  if (G.enemies.length > n) G.enemies.pop();
  if (e.boss) G.bosses = G.bosses.filter((b) => b !== e);
  return e;
}
function coDown() {
  P.ghost = 15; P.hp = 1; P.wBak = P.weapons; P.weapons = []; CO.reviveT = 0;
  banner('💀 DOWNED', 'Walk to a teammate to be revived, or wait 15s.', 3, 'bad', 2); hudBuild();
}

// ----- hooks -----
const _c7Spawn = spawnEnemy;
spawnEnemy = function (id, x, y, o) {
  const e = _c7Spawn(id, x, y, o);
  if (e && G && G.coop && CO.role === 'host') { e.uid = ++CO.uid; if (G.coopHp > 1) { e.hp *= G.coopHp; e.maxhp *= G.coopHp; } }
  return e;
};
let CO_KID = 0;
const _c7Kill = killEnemy;
killEnemy = function (e) {
  if (G && G.coGuest && CO.active) { if (!e.dead) { e.dead = true; CO.dead.set(e.uid, NOW); CO.mirror.delete(e.uid); burst(e.x, e.y - 10, 12, '140,40,30', 150); } return; }
  const was = e.dead; _c7Kill(e);
  if (!was && G && G.coop && CO.role === 'host' && CO.active && e.id !== 'phantom') {
    CO.kills.push([++CO_KID, e.id, e.d.xp || 1, e.x | 0, e.y | 0, e.boss ? 1 : 0, NOW]);
    const s = CO.stats[e.lastHit || 'h']; if (s) s.kills++;
  }
};
const _c7Hurt = hurtEnemy;
hurtEnemy = function (e, dmg, kx, ky, raw, proc) {
  if (G && G.coGuest && CO.active && e.uid) { const h = e.hp; const r = _c7Hurt(e, dmg, kx, ky, raw, proc); const d = h - Math.max(0, e.hp); if (d > 0) CO.hits.push([e.uid, Math.round(d * 10) / 10, kx | 0, ky | 0]); return r; }
  if (G && G.coop && CO.role === 'host' && !raw) { e.lastHit = 'h'; const h = e.hp; const r = _c7Hurt(e, dmg, kx, ky, raw, proc); if (CO.stats.h) CO.stats.h.dmg += Math.max(0, h - Math.max(0, e.hp)); return r; }
  return _c7Hurt(e, dmg, kx, ky, raw, proc);
};
const _c7HurtP = hurtPlayer;
hurtPlayer = function (d, src, ig, kind) {
  if (CO.swap) { const q = CO.players.get(CO.swap); if (q && !q.ghost && !q.inv && !q.dash && !(q.gInv > 0)) { q.gInv = 0.6; Net.sendTo(q.pid, { t: 'dmg', d: Math.round(d), src }); } return; }
  if (P.ghost > 0) return;
  _c7HurtP(d, src, ig, kind);
};
// mutants chase whichever living player is closest (host side)
const _c7UpEn = updateEnemies;
updateEnemies = function (dt) {
  if (G.coGuest && CO.active) return Coop.guestUpdateEnemies(dt);
  const others = G.coop && CO.active && CO.role === 'host' ? coOthers().filter((q) => !q.gone && !q.ghost && q.x !== undefined && NOW - (q.last || 0) < 3) : [];
  if (!others.length) return _c7UpEn(dt);
  const T = (P.ghost > 0 ? [] : [{ pid: 'h', x: P.x, y: P.y }]).concat(others), groups = new Map(T.map((t) => [t.pid, []]));
  for (const e of G.enemies) {
    if (e.dead) continue;
    let best = T[0], bd = 1e18;
    if (!e.boss || T.length) for (const t of T) { const d = dist2(e.x, e.y, t.x, t.y); if (d < bd) { bd = d; best = t; } }
    groups.get(best.pid).push(e);
  }
  const sv = { x: P.x, y: P.y, inv: P.inv, dashT: P.dashT }, out = [];
  for (const t of T) {
    G.enemies = groups.get(t.pid);
    if (t.pid === 'h') { _c7UpEn(dt); out.push(...G.enemies); continue; }
    P.x = t.x; P.y = t.y; P.inv = 0; P.dashT = 0; CO.swap = t.pid;
    try { _c7UpEn(dt); } finally { CO.swap = null; Object.assign(P, sv); }
    out.push(...G.enemies);
  }
  G.enemies = out;
  EG.clear(); for (const e of G.enemies) if (!e.dead) EG.add(e);
};
// labs in co-op: the whole living team gathers at the hatch, then the host takes everyone down (or up) together
const _c7Hatch = useHatch;
useHatch = function (h) {
  if (!(G.coop && CO.active)) return _c7Hatch(h);
  if (CO.role !== 'host') { if (NOW - (CO.hatchMsgT || 0) > 3) { CO.hatchMsgT = NOW; banner('🕳️ GATHER AT THE HATCH', 'The team goes down together when everyone is here.', 2, ''); } return; }
  const team = coOthers().filter((q) => !q.gone && !q.ghost && q.x !== undefined), here = team.filter((q) => dist2(q.x, q.y, h.x, h.y) < 170 * 170);
  if (here.length < team.length) { if (NOW - (CO.hatchMsgT || 0) > 2.5) { CO.hatchMsgT = NOW; banner('🕳️ WAITING FOR THE TEAM', (here.length + 1) + '/' + (team.length + 1) + ' at the hatch. Everyone must stand on it.', 2, ''); } return; }
  Net.bcast({ t: 'level', exit: !!h.exit, idx: h.idx, st: h.st || 0 });
  _c7Hatch(h);
};
function coGoLevel(m) {
  const h = m.exit ? World.hatches.find((x) => x.exit) : World.hatches.find((x) => x.idx === m.idx && (x.st || 0) === (m.st || 0));
  if (!h) return;
  CO.mirror.clear(); CO.dead.clear();
  _c7Hatch(h);
}
const _c7New = newGame;
newGame = function (st, ch, mode, sp, seed, diff) {
  if (CO.start) { const s = CO.start; CO.start = null; st = s.stage; sp = s.spawn; seed = s.seed; diff = s.diff; mode = 'standard'; CO.active = true; }
  else CO.active = false;
  _c7New(st, ch, mode, sp, seed, diff);
  if (CO.active) Coop.onNewGame();
};
const _c7RS = RunSave.save.bind(RunSave);
RunSave.save = function () { if (G && G.coop) return; _c7RS(); };
const _c7EvUp = Events.update.bind(Events);
Events.update = function (dt) { if (G.coGuest && CO.active) return; _c7EvUp(dt); };
for (const k of ['measure', 'track', 'village', 'photo']) { const d = QT2[k], w = d.w; d.w = () => (G && G.coGuest ? 0 : w()); }

// ----- drawing teammates -----
const CO_COLORS = ['#7dd8ff', '#ffb070', '#c89bff', '#8aff9a'];
function coColor(pid) { const i = [...CO.players.keys()].indexOf(pid); return CO_COLORS[(i < 0 ? 0 : i) % CO_COLORS.length]; }
function drawPartner() {
  if (!CO.active || !G || G.title) return;
  for (const q of coOthers()) {
    if (q.gone || q.x === undefined) continue;
    const pal = coPal(q.char), col = coColor(q.pid);
    ctx.globalAlpha = q.ghost ? 0.4 : 1;
    shadow(q.x, q.y, 14, 5, 0.35);
    const body = { x: q.x, y: q.y, z: 0, anim: q.anim || 0, face: q.face || 1, aim: q.face > 0 ? 0 : Math.PI, moving: !!q.moving };
    if (q.veh && VEH[q.veh]) { drawVehicle({ kind: q.veh, a: q.face > 0 ? 0 : Math.PI }, q.x, q.y); ctx.save(); ctx.translate(0, q.veh === 'jeep' ? -26 : -12); drawStalker(body, pal, true); ctx.restore(); }
    else drawStalker(body, pal, true);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = q.ghost ? '#aaa' : col;
    ctx.fillText((q.ghost ? '💀 ' : '') + (q.name || 'Teammate'), q.x, q.y - 64);
    if (q.maxhp) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(q.x - 21, q.y - 58, 42, 5); ctx.fillStyle = col; ctx.fillRect(q.x - 20, q.y - 57, 40 * clamp(q.hp / q.maxhp, 0, 1), 3); }
    if (q.ghost) { const pulse = 0.5 + Math.sin(NOW * 6) * 0.3; ctx.strokeStyle = `rgba(125,255,160,${pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(q.x, q.y, 80, 44, 0, 0, TAU); ctx.stroke(); ctx.font = 'bold 14px Oswald, sans-serif'; ctx.fillStyle = '#7dff9a'; ctx.fillText('⬇ STAND HERE TO REVIVE', q.x, q.y - 82); }
    if (P.ghost > 0 && !q.ghost) { ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x, P.y - 20); ctx.lineTo(q.x, q.y - 20); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,140,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (const b of CO.hbl) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); }
  ctx.stroke(); ctx.restore();
}
// team results on the run-over screen
function coResults(stats) {
  if (!stats) return;
  const rows = Object.entries(stats).map(([pid, s]) => ({ pid, ...s })), mvp = rows.slice().sort((a, b) => b.kills + b.dmg / 200 + b.revives * 15 - (a.kills + a.dmg / 200 + a.revives * 15))[0];
  const h = '<div class="coRes"><b>TEAM RESULTS</b>' + rows.map((r) => `<div class="${r.pid === CO.me ? 'me' : ''}"><span>${r.pid === mvp.pid ? '🏅 ' : ''}${(CHARACTERS.find((c) => c.id === r.char) || CHARACTERS[0]).icon} ${r.name}</span><span>${r.kills} kills</span><span>${Math.round(r.dmg)} dmg</span><span>${r.revives} revives</span></div>`).join('') + '</div>';
  const el = $('earned'); if (el && !el.querySelector('.coRes')) el.insertAdjacentHTML('beforeend', h);
}
function coCountdown(n) {
  let el = $('coCount'); if (!el) { el = document.createElement('div'); el.id = 'coCount'; document.body.appendChild(el); }
  if (!n) { el.classList.remove('show'); return; }
  el.textContent = n; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); Sfx.play('hint');
}

// ----- UI: entry view + lobby view -----
function coUI() {
  const inRoom = CO.role === 'host' || (CO.role === 'guest' && CO.conn && CO.me !== 'h');
  const e = $('coEntry'), l = $('coLobby'); if (!e) return;
  e.style.display = inRoom ? 'none' : ''; l.style.display = inRoom ? '' : 'none';
  const jb = $('coJoin'); if (jb) { jb.disabled = !!CO.joining; jb.textContent = CO.joining ? '⏳ JOINING…' : '🔗 JOIN'; }
  if (inRoom) coLobbyUI();
}
function coLobbyUI() {
  if (!$('coLobby') || CO.active) return;
  const host = CO.role === 'host', S = CO.settings || coDefaultSettings(), me = CO.players.get(CO.me);
  $('coCodeTxt').textContent = 'ROOM ' + CO.code; $('coLinkRow').style.display = ''; $('coLink').value = coLink();
  const slots = [...CO.players.values()];
  let h = '';
  for (let i = 0; i < CO_MAX; i++) {
    const p = slots[i];
    if (!p) { h += '<div class="coSlot empty"><div class="pi">➕</div><div><b>Open slot</b><small>send the link to a friend</small></div></div>'; continue; }
    const c = CHARACTERS.find((x) => x.id === p.char) || CHARACTERS[0];
    h += `<div class="coSlot ${p.pid === CO.me ? 'me' : ''}" style="border-color:${coColor(p.pid)}"><div class="pi">${c.icon}</div><div><b>${p.pid === 'h' ? '👑 ' : ''}${p.name}${p.pid === CO.me ? ' (you)' : ''}</b><small>${c.name}${p.pid !== 'h' ? ' · ' + (p.ping ? p.ping + ' ms' : '…') : ''}</small></div><div class="rdy ${p.ready ? 'on' : ''}">${p.ready ? '✅ READY' : '⏳ not ready'}</div></div>`;
  }
  $('coSlots').innerHTML = h;
  // my stalker
  const own = CHARACTERS.filter((c) => Save.data.chars.includes(c.id));
  $('coChar').innerHTML = own.map((c) => `<option value="${c.id}" ${me && me.char === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
  // settings: host edits, guests read
  const st = STAGES.find((x) => x.id === S.stage) || STAGES[0], sp = (STAGE_WORLD[S.stage].spawns[S.spawn] || STAGE_WORLD[S.stage].spawns[0]);
  $('coSetRead').style.display = host ? 'none' : ''; $('coSetEdit').style.display = host ? '' : 'none';
  $('coSetRead').innerHTML = `🗺️ <b>${st.icon} ${st.name}</b> · 📍 ${sp.icon} ${sp.name} · ${diffDef(S.diff).icon} ${diffDef(S.diff).name}`;
  if (host) {
    $('coStage').innerHTML = STAGES.filter((x) => Save.data.stages.includes(x.id)).map((x) => `<option value="${x.id}" ${x.id === S.stage ? 'selected' : ''}>${x.icon} ${x.name}</option>`).join('');
    $('coSpawn').innerHTML = STAGE_WORLD[S.stage].spawns.map((x, i) => `<option value="${i}" ${i === S.spawn ? 'selected' : ''}>${x.icon} ${x.name}</option>`).join('');
    $('coDiff').innerHTML = DIFFICULTIES.map((d) => `<option value="${d.id}" ${d.id === S.diff ? 'selected' : ''}>${d.icon} ${d.name}</option>`).join('');
  }
  const guests = slots.filter((p) => p.pid !== 'h'), allReady = guests.length && guests.every((p) => p.ready);
  const rb = $('coReady'), sb = $('coStart');
  rb.style.display = host ? 'none' : ''; sb.style.display = host ? '' : 'none';
  if (!host) { rb.textContent = CO.ready ? '✅ READY (tap to cancel)' : '👍 I\'M READY'; rb.classList.toggle('pulse', !CO.ready); }
  else { sb.disabled = !allReady; sb.textContent = !guests.length ? '⏳ WAITING FOR PLAYERS…' : allReady ? '▶ START (' + slots.length + ' players)' : '⏳ WAITING FOR EVERYONE TO BE READY'; sb.classList.toggle('pulse', !!allReady); }
  coStatus(host ? (guests.length ? slots.length + '/' + CO_MAX + ' in the room. Everyone presses READY, then you START.' : 'Send the link to your friends. Up to ' + CO_MAX + ' players.') : (CO.ready ? 'Waiting for the host to start…' : 'Pick your stalker, then press READY.'));
}
addEventListener('DOMContentLoaded', () => {
  const t = document.createElement('div'); t.id = 'coop'; t.className = 'screen scroll';
  t.innerHTML = `<div class="hdr"><button class="back" id="coBack">← BACK</button><h2>CO-OP</h2><span></span></div>
  <div class="coBox">
    <label class="set"><span>Your name</span><input id="coNick" type="text" maxlength="16" placeholder="Stalker name"></label>
    <div id="coEntry">
      <div class="sect">HOST A ROOM</div>
      <label class="set"><span>Password (optional)</span><input id="coPw" type="text" maxlength="24" placeholder="leave empty for none"></label>
      <button class="big" id="coHost">🏠 CREATE ROOM</button>
      <div class="sect">JOIN A FRIEND</div>
      <div class="coLinkRow"><input id="coJoinCode" maxlength="5" placeholder="ROOM CODE"><input id="coJoinPw" placeholder="password (if any)"><button class="big ghost" id="coJoin">🔗 JOIN</button></div>
    </div>
    <div id="coLobby" style="display:none">
      <div class="coCode" id="coCodeTxt"></div>
      <div class="coLinkRow" id="coLinkRow"><input id="coLink" readonly><button class="big ghost" id="coCopy">📋 COPY LINK</button></div>
      <div id="coSlots"></div>
      <label class="set"><span>Your stalker</span><select id="coChar"></select></label>
      <div id="coSetRead" class="coSet"></div>
      <div id="coSetEdit"><label class="set"><span>Stage</span><select id="coStage"></select></label><label class="set"><span>Start point</span><select id="coSpawn"></select></label><label class="set"><span>Difficulty</span><select id="coDiff"></select></label></div>
      <button class="big" id="coReady">👍 I'M READY</button>
      <button class="big" id="coStart" disabled>⏳ WAITING FOR PLAYERS…</button>
      <button class="big ghost" id="coLeave">🚪 LEAVE ROOM</button>
    </div>
    <div id="coStatus" class="dim"></div>
    <p class="dim small">Co-op uses a free public connection service (PeerJS) to introduce the browsers, then plays directly between them. Some strict networks can block it.</p>
  </div>`;
  document.body.appendChild(t);
  const btn = document.createElement('button'); btn.className = 'big ghost'; btn.id = 'coopBtn'; btn.textContent = '👥 CO-OP';
  $('bunkerBtn').parentNode.insertBefore(btn, $('bunkerBtn'));
  btn.onclick = () => { Sfx.init(); openScreen('coop'); $('coNick').value = Save.data.nick || ''; coUI(); };
  const _os = openScreen;
  openScreen = function (id) { hide('coop'); _os(id); };
  $('coBack').onclick = () => { hide('coop'); openScreen('title'); };
  $('coNick').oninput = () => { Save.data.nick = $('coNick').value.trim().slice(0, 16); Save.save(); const me = CO.players.get(CO.me); if (me) { me.name = coNick(); if (CO.role === 'host') Net.bcast(coLobbyMsg()); else Net.send({ t: 'lobbyMe', name: me.name, char: me.char, ready: CO.ready }); coLobbyUI(); } };
  $('coPw').oninput = () => { CO.pw = $('coPw').value.trim(); if (CO.role === 'host') $('coLink').value = coLink(); };
  $('coHost').onclick = async () => {
    $('coHost').disabled = true; coStatus('⏳ Creating room…');
    try { CO.pw = $('coPw').value.trim(); await Net.host(); coUI(); }
    catch (e) { coStatus('⚠️ ' + e.message); }
    $('coHost').disabled = false;
  };
  $('coCopy').onclick = () => { const v = $('coLink').value; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => coStatus('📋 Link copied! Send it to your friends.'), () => { $('coLink').select(); document.execCommand('copy'); coStatus('📋 Link copied!'); }); };
  $('coChar').onchange = () => { const c = $('coChar').value; Save.data.char = c; Save.save(); const me = CO.players.get(CO.me); if (me) me.char = c; if (CO.role === 'host') Net.bcast(coLobbyMsg()); else Net.send({ t: 'lobbyMe', name: coNick(), char: c, ready: CO.ready }); coLobbyUI(); };
  const setChange = () => { CO.settings = { stage: $('coStage').value, spawn: +$('coSpawn').value || 0, diff: $('coDiff').value }; if (!STAGE_WORLD[CO.settings.stage].spawns[CO.settings.spawn]) CO.settings.spawn = 0; Net.bcast(coLobbyMsg()); coLobbyUI(); };
  $('coStage').onchange = () => { $('coSpawn').value = 0; setChange(); }; $('coSpawn').onchange = setChange; $('coDiff').onchange = setChange;
  $('coReady').onclick = () => { CO.ready = !CO.ready; const me = CO.players.get(CO.me); if (me) me.ready = CO.ready; Net.send({ t: 'lobbyMe', name: coNick(), char: Save.data.char, ready: CO.ready }); coLobbyUI(); };
  $('coLeave').onclick = () => { if (CO.role === 'guest') Net.send({ t: 'leave' }); try { sessionStorage.removeItem('zb_rejoin_' + CO.code); } catch (e) { /* storage blocked */ } Net.leave(); CO.rejoinId = null; coStatus('You left the room.'); coUI(); };
  $('coStart').onclick = () => {
    if ($('coStart').disabled) return;
    const S = CO.settings, s = { t: 'start', stage: S.stage, spawn: S.spawn, seed: (Math.random() * 1e9) | 0, diff: S.diff };
    $('coStart').disabled = true;
    let n = 3; const tick = () => {
      if (n > 0) { Net.bcast({ t: 'count', n }); coCountdown(n); n--; setTimeout(tick, 900); return; }
      CO.startMsg = s; Net.bcast(s); CO.start = s; coCountdown(0); NEXT_RUN = { mode: 'standard', mutators: [], ngplus: false }; hide('coop'); startGame();
    };
    tick();
  };
  $('coJoin').onclick = async () => { const c = $('coJoinCode').value.trim(); if (c.length < 5) { coStatus('Enter the 5-letter room code.'); return; } coStatus('⏳ Connecting to room ' + c.toUpperCase() + '…'); try { await Net.join(c, $('coJoinPw').value.trim()); } catch (e) { coStatus('⚠️ ' + e.message); } };
  // opened from a shared link: fill in and connect straight away
  const qs = new URLSearchParams(location.search), jc = qs.get('join');
  if (jc) { $('coJoinCode').value = jc; $('coJoinPw').value = qs.get('pw') || ''; openScreen('coop'); $('coNick').value = Save.data.nick || ''; $('coJoin').onclick(); }
  // lobby keeps pinging even on the menu screens
  setInterval(() => { if (!G || G.title || G.state !== 'play') Coop.update(0.25); }, 250);
  // run end: tell the team
  const _er = endRun;
  endRun = function (kind, src) {
    if (G && G.coop && CO.active && !G.ended) {
      if (kind === 'dead' && coOthers().some((q) => !q.gone && !q.ghost)) { coDown(); return; }
      if (CO.role === 'host') Net.bcast({ t: 'end', kind, stats: CO.stats }); else Net.send({ t: 'leave' });
      CO.active = false;
      _er(kind, src);
      if (CO.role === 'host') coResults(CO.stats);
      return;
    }
    _er(kind, src);
  };
  const _dp = drawPlayer;
  drawPlayer = function () {
    if (!(P.ghost > 0)) return _dp();
    ctx.globalAlpha = 0.4; _dp(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(P.x, P.y - 30, 34, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(P.x, P.y - 30, 34, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(CO.reviveT / 1.5, 0, 1)); ctx.stroke();
    ctx.strokeStyle = '#ff7a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y - 30, 42, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(P.ghost / 15, 0, 1)); ctx.stroke();
    ctx.font = 'bold 13px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(CO.reviveT > 0 ? 'REVIVING…' : 'DOWNED · ' + Math.ceil(P.ghost) + 's', P.x, P.y - 80);
  };
  const _mm = drawMinimap;
  drawMinimap = function () {
    _mm(); if (!CO.active || World.kind !== 'over') return;
    const S = mm.width, span = 2000, f = S / span;
    for (const q of coOthers()) { if (q.gone || q.x === undefined) continue; const x = clamp((q.x - P.x + span / 2) * f, 8, S - 8), y = clamp((q.y - P.y + span / 2) * f, 8, S - 8); mmx.fillStyle = coColor(q.pid); mmx.beginPath(); mmx.arc(x, y, 6, 0, TAU); mmx.fill(); mmx.strokeStyle = '#000'; mmx.lineWidth = 2; mmx.stroke(); }
  };
});
