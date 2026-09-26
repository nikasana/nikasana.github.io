'use strict';
// ---------- event director: one Zone event at a time, never during bosses or emissions ----------
function edgeSpawn(id, n, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) { const p = ringPos(o.extra || 0); if (p) out.push(spawnEnemy(id, p[0], p[1], { noElite: true, ...o })); }
  return out;
}
function nearestRoadPath(x, y) {
  let best = null, bd = 1e12;
  for (const r of World.roads) for (let i = 0; i < r.length - 1; i++) { const d = dist2(x, y, r[i][0], r[i][1]); if (d < bd) { bd = d; best = { r, i }; } }
  return best;
}
const EVENTS = {
  stampede: { name: 'Boar Stampede', icon: '🐗', minT: 240, w: 2, dur: 12, desc: 'A herd is charging through. Get out of the way!',
    start(ev) {
      const a = rand(TAU), R = 700, sx = P.x + Math.cos(a) * R, sy = P.y + Math.sin(a) * R, tx = -Math.cos(a), ty = -Math.sin(a);
      ev.herd = [];
      for (let i = 0; i < 10; i++) { const off = (i - 5) * 45; const b = spawnEnemy('boar', sx - ty * off + rand(-20, 20), sy + tx * off, { noElite: true }); b.stamp = [tx, ty]; ev.herd.push(b); }
    },
    update(ev) { for (const b of ev.herd) if (!b.dead && b.stamp) { b.state = 3; b.st = 1; b.chA = Math.atan2(b.stamp[1], b.stamp[0]); } } },
  horde: { name: 'Zombie Horde', icon: '🧟', minT: 300, w: 2, dur: 40, desc: 'The dead march on you in a long line.',
    start(ev) { const a = rand(TAU), R = 650; for (let i = 0; i < 18; i++) { const off = (i - 9) * 40, x = P.x + Math.cos(a) * R - Math.sin(a) * off, y = P.y + Math.sin(a) * R + Math.cos(a) * off; if (World.free(x, y, 14)) spawnEnemy('zombie', x, y, { noElite: true }); } } },
  patrol: { name: 'Military Patrol', icon: '🪖', minT: 200, w: 2, dur: 45, desc: 'Soldiers shoot mutants AND stalkers.',
    start() { const p = ringPos(); if (p) for (let i = 0; i < 4; i++) spawnEnemy('soldier', p[0] + rand(-40, 40), p[1] + rand(-40, 40), { noElite: true }); } },
  siege: { name: 'Siege', icon: '🏰', minT: 260, w: 1.5, dur: 120, goal: 45, desc: 'Defend the shelter: stay inside the ring for 45 seconds.',
    can() { const s = nearestShelter(); return s && dist(s.x, s.y, P.x, P.y) < 1500; },
    start(ev) { ev.s = nearestShelter(); ev.spawnT = 3; ev.loc = ev.s; },
    update(ev, dt) {
      const inside = dist2(ev.s.x, ev.s.y, P.x, P.y) < 260 * 260; if (inside) ev.p += dt;
      ev.spawnT -= dt;
      if (ev.spawnT <= 0 && inside) { ev.spawnT = 4; for (let i = 0; i < 4; i++) { const a = rand(TAU); const x = ev.s.x + Math.cos(a) * 520, y = ev.s.y + Math.sin(a) * 400; if (World.free(x, y, 14)) spawnEnemy(pick(['dog', 'snork', 'zombie', 'flesh']), x, y, { noElite: true }); } }
      if (ev.p >= ev.goal) return 'win';
    },
    win() { G.rubles += 120; G.pickups.push({ type: 'art', x: P.x + 30, y: P.y, t: 0 }); } },
  scorcher: { name: 'Brain Scorcher Pulse', icon: '🧠', minT: 480, w: 1.2, dur: 34, desc: 'Psi pulse incoming in 10s! Hide in a shelter or drink vodka.',
    can() { return G.stage !== 'pripyat'; },
    update(ev, dt) {
      if (ev.t > 10) { G.psi = Math.max(G.psi, 0.9); if (!inShelter(P.x, P.y) && !P.psiImmune) { P.scAcc = (P.scAcc || 0) + 6 * dt; if (P.scAcc > 5) { hurtPlayer(P.scAcc, 'the Brain Scorcher', true); P.scAcc = 0; } } }
    } },
  twins: { name: 'Twin Terror', icon: '👯', minT: 540, w: 0.8, dur: 90, desc: 'Two bosses, one life bar.',
    start(ev) {
      const id = pick(['pseudogiant', 'chimera', 'matriarch', 'burer', 'packalpha']);
      const a = spawnBoss(id, { name: 'TWIN ' + ENEMIES[id].name, hpMul: 0.6 }), b = spawnBoss(id, { name: 'TWIN ' + ENEMIES[id].name, hpMul: 0.6 });
      a.twin = b; b.twin = a; ev.pair = [a, b];
    },
    update(ev) { if (ev.pair.every((b) => b.dead)) return 'win'; },
    win() { G.rubles += 150; } },
  eclipse: { name: 'Eclipse', icon: '🌑', minT: 420, w: 1, dur: 40, desc: 'Darkness. Every new mutant is an elite. Double XP.' },
  carnival: { name: 'Carnival Night', icon: '🎡', minT: 180, w: 3, dur: 45, desc: 'The Ferris wheel lights up. Ghosts and gifts!',
    can() { return G.stage === 'pripyat' && World.kind === 'over'; },
    start(ev) { const w = World.props.find((p) => p.kind === 'wheel'); ev.loc = w ? { x: w.x, y: w.y } : { x: P.x, y: P.y }; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; G.pickups.push({ type: i % 2 ? 'item' : 'med', id: pick(Object.keys(ITEMS)), x: ev.loc.x + Math.cos(a) * 180, y: ev.loc.y + 80 + Math.sin(a) * 110, t: 0 }); } },
    update(ev) { if (Math.random() < 0.02) edgeSpawn('wraith', 1); } },
  flood: { name: 'Flood', icon: '🌊', minT: 300, w: 1, dur: 50, desc: 'Water rises. Everyone on the ground is slowed.',
    start() { Env.setWeather('rain'); } },
  bloodmoon: { name: 'Blood Moon', icon: '🩸', minT: 360, w: 1.5, dur: 55, desc: 'More mutants, double XP.', can() { return Env.isNight(); } },
  ghost: { name: 'Ghost of a Fallen Stalker', icon: '👻', minT: 120, w: 5, dur: 150, desc: 'Your last death left a ghost behind. Put it to rest.',
    can() { const g = Save.data.ghost; return g && g.stage === G.stage && World.kind === 'over'; },
    start(ev) { const g = Save.data.ghost; ev.loc = { x: g.x, y: g.y }; ev.boss = spawnEnemy('ghost', g.x, g.y, { noElite: true, hpMul: 1 + G.t / 600 }); ev.boss.name = 'Ghost of ' + (g.name || 'a Stalker'); },
    update(ev) { if (ev.boss.dead) return 'win'; } },
  surge: { name: 'Anomaly Surge', icon: '🌀', minT: 200, w: 1.5, dur: 45, desc: 'Anomalies swell, and new artifacts appear.',
    start() { for (const a of World.anomalies) { a.baseR = a.baseR || a.r; a.r = a.baseR * 1.5; } for (const f of World.fields) if (!f.art && dist2(f.x, f.y, P.x, P.y) < 2500 * 2500 && Math.random() < 0.5) spawnArtifact(f); },
    end() { for (const a of World.anomalies) if (a.baseR) a.r = a.baseR; } },
  bounty: { name: 'Bounty Hunt', icon: '🎯', minT: 150, w: 2, dur: 90, desc: 'A marked mutant is fleeing. Hunt it down for 150 ₽.',
    start(ev) {
      const id = pick(['bloodsucker', 'snork', 'izlom', 'psydog', 'boar', 'gorilla']), a = rand(TAU);
      ev.boss = spawnEnemy(id, P.x + Math.cos(a) * 650, P.y + Math.sin(a) * 500, { affix: 'swift', hpMul: 2 }); ev.boss.name = 'BOUNTY: ' + ENEMIES[id].name; ev.boss.bounty = true; ev.loc = ev.boss;
    },
    update(ev) { if (ev.boss.dead) return 'win'; },
    win() { G.rubles += 150; } },
  airdrop: { name: 'Supply Airdrop', icon: '📦', minT: 150, w: 2, dur: 70, desc: 'A crate is falling. Reach it and hold it for 2 seconds.',
    start(ev) { const a = rand(TAU), d = rand(500, 800); let x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8; for (let i = 0; i < 20 && !World.free(x, y, 30); i++) { x += rand(-80, 80); y += rand(-80, 80); } ev.loc = { x, y }; ev.hold = 0; ev.spawnT = 2; },
    update(ev, dt) {
      ev.spawnT -= dt; if (ev.spawnT <= 0 && ev.t > 6) { ev.spawnT = 3; const a = rand(TAU); spawnEnemy(pick(['dog', 'snork', 'wolf']), ev.loc.x + Math.cos(a) * 400, ev.loc.y + Math.sin(a) * 300, { noElite: true }); }
      if (ev.t > 6 && dist2(ev.loc.x, ev.loc.y, P.x, P.y) < 50 * 50) { ev.hold += dt; if (ev.hold >= 2) return 'win'; } else ev.hold = 0;
    },
    win(ev) { G.rubles += 60; for (let i = 0; i < 2; i++) giveItem(pick(Object.keys(ITEMS))); G.pickups.push({ type: 'art', x: ev.loc.x, y: ev.loc.y + 20, t: 0 }); } },
  convoy: { name: 'Convoy Escort', icon: '🚚', minT: 240, w: 1.5, dur: 100, desc: 'Keep the supply truck alive until it reaches the end of the road.',
    can() { return World.kind === 'over' && !!nearestRoadPath(P.x, P.y); },
    start(ev) {
      const r = nearestRoadPath(P.x, P.y); ev.path = r.r.slice(r.i); if (ev.path.length < 2) ev.path = r.r.slice(0, 2);
      ev.truck = { x: ev.path[0][0], y: ev.path[0][1], hp: 600, max: 600, seg: 0 }; ev.loc = ev.truck; ev.spawnT = 2; ev.dist = 0;
    },
    update(ev, dt) {
      const T = ev.truck, nx = ev.path[T.seg + 1];
      if (!nx) return 'win';
      const dx = nx[0] - T.x, dy = nx[1] - T.y, d = Math.hypot(dx, dy);
      const sp = 70 * (dist2(T.x, T.y, P.x, P.y) < 500 * 500 ? 1 : 0.2);
      if (d < 8) T.seg++; else { T.x += (dx / d) * sp * dt; T.y += (dy / d) * sp * dt; ev.dist += sp * dt; }
      EG.query(T.x, T.y, 60, TMP3); for (const e of TMP3) if (!e.dead) T.hp -= 8 * dt;
      ev.spawnT -= dt; if (ev.spawnT <= 0) { ev.spawnT = 3.5; const a = rand(TAU); const e = spawnEnemy(pick(['dog', 'zombie', 'snork', 'bandit']), T.x + Math.cos(a) * 480, T.y + Math.sin(a) * 360, { noElite: true }); e.tgt = T; }
      if (ev.dist > 2400) return 'win';
      if (T.hp <= 0) return 'fail';
    },
    win() { G.rubles += 180; G.pendingLv++; } },
  haunted: { name: 'Haunted House', icon: '🏚️', minT: 180, w: 1.5, dur: 120, desc: 'Poltergeists haunt a nearby house. Clear them for its loot.',
    can() { return World.kind === 'over' && World.props.some((p) => p.kind === 'building' && p.style !== 'factory' && dist2(p.x, p.y, P.x, P.y) < 1300 * 1300); },
    start(ev) { const hs = World.props.filter((p) => p.kind === 'building' && p.style !== 'factory' && dist2(p.x, p.y, P.x, P.y) < 1300 * 1300); const h = pick(hs); ev.loc = { x: h.x + h.w / 2, y: h.y + h.h + 40 }; ev.kills = 0; ev.spawned = []; },
    update(ev) {
      if (dist2(ev.loc.x, ev.loc.y, P.x, P.y) < 450 * 450 && ev.spawned.filter((e) => !e.dead).length < 3 && ev.spawned.length < 8) { const e = spawnEnemy(pick(['poltergeist', 'wraith']), ev.loc.x + rand(-80, 80), ev.loc.y - 60, { noElite: true }); ev.spawned.push(e); }
      if (ev.spawned.length >= 8 && ev.spawned.every((e) => e.dead)) return 'win';
    },
    win(ev) { G.pickups.push({ type: 'poistash', x: ev.loc.x, y: ev.loc.y, t: 0 }); } },
  portal: { name: 'Portal Breach', icon: '🌌', minT: 420, w: 1.2, dur: 60, desc: 'A rift pours out mutants from another Zone. Destroy it!',
    can() { return World.kind === 'over'; },
    start(ev) {
      const a = rand(TAU); let x = P.x + Math.cos(a) * 520, y = P.y + Math.sin(a) * 400; for (let i = 0; i < 20 && !World.free(x, y, 50); i++) { x += rand(-60, 60); y += rand(-60, 60); }
      const p = World.addProp({ kind: 'portal', x, y, sy: y, bx0: x - 80, bx1: x + 80, by0: y - 160, by1: y + 40 });
      const ob = World.addOb({ x, y, r: 40, prop: p }); ob.hp = ob.maxhp = 500 * hpScale(G.t / 60); ob.kind = 'portal'; ev.ob = ob; ev.loc = { x, y }; ev.spawnT = 1;
    },
    update(ev, dt) {
      if (ev.ob.dead) return 'win';
      ev.spawnT -= dt; if (ev.spawnT <= 0) { ev.spawnT = 2.6; spawnEnemy(pick(['psideer', 'spider', 'larva', 'wraith', 'psydog', 'cat']), ev.loc.x + rand(-40, 40), ev.loc.y + rand(-30, 30), { noElite: true }); }
    },
    end(ev) { if (!ev.ob.dead) { ev.ob.dead = true; World.destroy(ev.ob); } },
    win() { G.rubles += 100; } },
  laststand: { name: 'Last Stand', icon: '⭕', minT: 360, w: 1, dur: 60, desc: 'The anomaly ring closes in. Stay inside and survive 60 seconds.',
    start(ev) { ev.cx = P.x; ev.cy = P.y; ev.R = 720; ev.spawnT = 2; },
    update(ev, dt) {
      ev.R = Math.max(260, 720 - ev.t * 9);
      if (dist(P.x, P.y, ev.cx, ev.cy) > ev.R) { P.lsRing = (P.lsRing || 0) + 10 * dt; if (P.lsRing > 5) { hurtPlayer(P.lsRing, 'the closing ring', true); P.lsRing = 0; } }
      ev.spawnT -= dt; if (ev.spawnT <= 0) { ev.spawnT = 2.5; for (let i = 0; i < 3; i++) { const a = rand(TAU); spawnEnemy(pick(['dog', 'snork', 'wolf', 'flesh']), ev.cx + Math.cos(a) * ev.R, ev.cy + Math.sin(a) * ev.R * 0.8, { noElite: true }); } }
      if (ev.t >= ev.dur - 0.1) return 'win';
    },
    win() { G.rubles += 120; G.pendingLv++; } },
  gunship: { name: 'Gunship Raid', icon: '🚁', minT: 600, w: 0.7, dur: 120, desc: 'A military gunship hunts you.',
    start(ev) { ev.boss = spawnBoss('heli', { hpMul: 0.7 }); },
    update(ev) { if (ev.boss.dead) return 'win'; } },
};
const Events = {
  cur: null, cd: 100,
  reset() { this.cur = null; this.cd = 100; $('eventBox').style.display = 'none'; },
  busy() { return G.bosses.some((b) => !b.twin && !b.eventBoss) || (G.em && G.em.phase !== 'after'); },
  update(dt) {
    const ev = this.cur;
    if (ev) {
      ev.t += dt;
      const E = EVENTS[ev.id];
      let r = E.update ? E.update(ev, dt) : null;
      if (!r && ev.t >= E.dur) r = E.goal || E.win && ['twins', 'ghost', 'bounty', 'airdrop', 'convoy', 'haunted', 'portal', 'gunship'].includes(ev.id) ? 'fail' : 'done';
      if (r) this.finish(r);
      else this.ui();
      return;
    }
    if (World.kind !== 'over' || G.state !== 'play') return;
    this.cd -= dt;
    if (this.cd > 0 || this.busy()) return;
    const opts = Object.keys(EVENTS).filter((k) => G.t >= EVENTS[k].minT && (!EVENTS[k].can || EVENTS[k].can()) && k !== this.last);
    if (!opts.length) { this.cd = 20; return; }
    let tot = 0; for (const k of opts) tot += EVENTS[k].w;
    let x = rand(tot), id = opts[0]; for (const k of opts) { x -= EVENTS[k].w; if (x <= 0) { id = k; break; } }
    this.start(id);
  },
  start(id) {
    const E = EVENTS[id], ev = { id, t: 0, p: 0 };
    this.cur = ev; this.last = id;
    if (E.start) E.start(ev);
    if (ev.boss) ev.boss.eventBoss = true;
    banner(E.icon + ' ' + E.name.toUpperCase(), E.desc, 3.5, 'bad', 2);
    Sfx.play('siren');
  },
  finish(r) {
    const ev = this.cur, E = EVENTS[ev.id];
    if (E.end) E.end(ev);
    if (r === 'win') { if (E.win) E.win(ev); banner(E.icon + ' ' + E.name.toUpperCase() + ' COMPLETE', 'Rewards collected.', 2.5, 'good'); Sfx.play('quest'); }
    else if (r === 'fail') banner(E.icon + ' ' + E.name.toUpperCase() + ' FAILED', '', 2.2, 'bad');
    this.cur = null; this.cd = rand(80, 140);
    $('eventBox').style.display = 'none';
  },
  ui() {
    const ev = this.cur, E = EVENTS[ev.id], el = $('eventBox');
    el.style.display = 'block';
    const left = Math.max(0, Math.ceil(E.dur - ev.t));
    const prog = E.goal ? ` · ${Math.floor(ev.p)}/${E.goal}s` : ev.truck ? ` · truck ${Math.round((ev.truck.hp / ev.truck.max) * 100)}%` : ev.id === 'scorcher' && ev.t < 10 ? ` · pulse in ${Math.ceil(10 - ev.t)}s` : '';
    setText('eventTxt', `${E.icon} ${E.name}${prog} · ${fmtTime(left)}`);
  },
  mods() {
    const id = this.cur && this.cur.id;
    return { xp: id === 'bloodmoon' || id === 'eclipse' ? 2 : 1, spawn: id === 'bloodmoon' ? 1.6 : id === 'eclipse' ? 0.5 : 1, elite: id === 'eclipse', dark: id === 'eclipse' ? 0.85 : 0, red: id === 'bloodmoon', flood: id === 'flood' };
  },
};
function drawEventWorld() {
  const ev = Events.cur; if (!ev) return;
  if (ev.id === 'siege' && ev.s) { ctx.strokeStyle = `rgba(255,200,80,${0.5 + Math.sin(NOW * 5) * 0.3})`; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.ellipse(ev.s.x, ev.s.y, 260, 160, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (ev.id === 'laststand') { ctx.strokeStyle = 'rgba(200,120,255,0.8)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(ev.cx, ev.cy, ev.R, ev.R * 0.8, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(120,40,200,0.08)'; ctx.fill(); }
  if (ev.id === 'airdrop') {
    const L = ev.loc, fall = Math.max(0, 6 - ev.t) * 60;
    shadow(L.x, L.y, 26, 9, 0.3);
    if (fall > 0) { ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.arc(L.x, L.y - fall - 70, 34, Math.PI, TAU); ctx.fill(); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.x - 34, L.y - fall - 70); ctx.lineTo(L.x - 10, L.y - fall - 20); ctx.moveTo(L.x + 34, L.y - fall - 70); ctx.lineTo(L.x + 10, L.y - fall - 20); ctx.stroke(); }
    drawChest(L.x, L.y - fall, true, false);
    if (ev.hold > 0) { ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(L.x, L.y - 60, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (ev.hold / 2)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,60,40,0.5)'; ctx.fillRect(L.x - 2, L.y - 400 - fall, 4, 330);
  }
  if (ev.id === 'convoy' && ev.truck) {
    const T = ev.truck; shadow(T.x, T.y + 4, 40, 12, 0.3);
    ctx.fillStyle = '#4e5a3a'; ctx.fillRect(T.x - 38, T.y - 34, 56, 30); ctx.fillStyle = '#5e6a44'; ctx.fillRect(T.x + 18, T.y - 30, 22, 26); ctx.fillStyle = '#20262a'; ctx.fillRect(T.x + 24, T.y - 26, 12, 10);
    ctx.fillStyle = '#111'; for (const wx of [T.x - 28, T.x + 26]) { ctx.beginPath(); ctx.arc(wx, T.y - 2, 7, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(T.x - 40, T.y - 48, 80, 6); ctx.fillStyle = '#7dff8a'; ctx.fillRect(T.x - 40, T.y - 48, 80 * (T.hp / T.max), 6);
  }
  if (ev.id === 'haunted' && ev.loc) { ctx.fillStyle = `rgba(160,120,255,${0.15 + Math.sin(NOW * 3) * 0.08})`; ctx.beginPath(); ctx.ellipse(ev.loc.x, ev.loc.y - 60, 180, 110, 0, 0, TAU); ctx.fill(); }
}
function drawPortal(p) {
  const t = NOW;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(p.x, p.y - 50, 4, p.x, p.y - 50, 70); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, 'rgba(170,80,255,0.7)'); g.addColorStop(1, 'rgba(60,0,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y - 50, 40 + Math.sin(t * 5) * 4, 62, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(210,160,255,0.8)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y - 50, 30 + i * 10, 50 + i * 8, 0, t * (2 + i), t * (2 + i) + 3); ctx.stroke(); }
  ctx.restore();
}
PROP_DRAW.portal = drawPortal;
