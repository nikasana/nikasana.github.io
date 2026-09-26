'use strict';
// ---------- story & contracts: factions, new contract types, main quest, campfires, endings hooks ----------
const FACTIONS = {
  loner: { name: 'Loners', icon: '🎒', color: '#c8b070' },
  duty: { name: 'Duty', icon: '🛡️', color: '#d05040' },
  freedom: { name: 'Freedom', icon: '🍀', color: '#60c050' },
  bandit: { name: 'Bandits', icon: '🔪', color: '#9a9a9a' },
};
const REP_TIERS = [[0, 'Neutral'], [100, 'Friendly'], [300, 'Ally'], [600, 'Hero']];
function repTier(f) { const r = (Save.data.rep || {})[f] || 0; let t = 0; for (let i = 0; i < REP_TIERS.length; i++) if (r >= REP_TIERS[i][0]) t = i; return t; }
function addRep(f, v) { const R = Save.data.rep; if (!R || !f) return; const t0 = repTier(f); R[f] = Math.max(-300, (R[f] || 0) + v); const t1 = repTier(f); if (t1 > t0 && G && !G.title) banner(FACTIONS[f].icon + ' ' + FACTIONS[f].name.toUpperCase() + ': ' + REP_TIERS[t1][1].toUpperCase(), 'New gear unlocked at their base (Bunker → Factions).', 3, 'good'); }

// who shot what: weapon attribution for "kill with weapon" contracts
let CUR_W = null;
const _s6Fire = fireWeapon;
fireWeapon = function (w, s, bm) {
  const nb = G.bullets.length, nt = G.throws.length, no = (G.owned || []).length;
  CUR_W = w.id;
  const r = _s6Fire(w, s, bm);
  for (let i = nb; i < G.bullets.length; i++) G.bullets[i].wid = w.id;
  for (let i = nt; i < G.throws.length; i++) G.throws[i].wid = w.id;
  if (G.owned) for (let i = no; i < G.owned.length; i++) G.owned[i].wid = w.id;
  CUR_W = null;
  return r;
};
const _s6Hurt = hurtEnemy;
hurtEnemy = function (e, dmg, kx, ky, raw, proc) { if (CUR_W) e.lastW = CUR_W; return _s6Hurt(e, dmg, kx, ky, raw, proc); };
const _s6Kill = killEnemy;
killEnemy = function (e) { const was = e.dead; _s6Kill(e); if (!was && e.id !== 'phantom') Story.onKill(e); };
const _s6Art = takeArtifact;
takeArtifact = function (type, extra) { _s6Art(type, extra); Story.onArt(type); };
const _s6HurtP = hurtPlayer;
hurtPlayer = function (d, src, ig, kind) { const h = P.hp; _s6HurtP(d, src, ig, kind); if (P.hp < h) G.lastHurtT = G.t; };
const _s6Veh = toggleVehicle;
toggleVehicle = function () { const v = !P.veh && nearVehicle(); if (v && v.broken) { banner('🔧 BROKEN DOWN', 'Find the 3 missing parts first (contract).', 1.8, 'bad'); return; } _s6Veh(); };

// ----- helpers -----
function s6Spot(minD, maxD, r = 30, from = P) {
  for (let i = 0; i < 60; i++) {
    const a = rand(TAU), d = rand(minD, maxD), x = clamp(from.x + Math.cos(a) * d, 300, WORLD - 300), y = clamp(from.y + Math.sin(a) * d * 0.8, 300, WORLD - 300);
    if (World.free(x, y, r)) return { x, y };
  }
  return null;
}
const near = (o, r) => dist2(o.x, o.y, P.x, P.y) < r * r;
function npcHurt(n, dt) { EG.query(n.x, n.y, 60, TMP3); for (const e of TMP3) if (!e.dead && dist2(e.x, e.y, n.x, n.y) < (e.r + 22) ** 2) n.hp -= 14 * dt; }
const SCI_PAL = { ...PAL_PLAYER, jacket: '#c8b040', jacket2: '#a89030', hood: '#d8c050', mask: true, gun: false };
const HURT_PAL = { ...PAL_PLAYER, jacket: '#6a5a3e', jacket2: '#4a3e2a', hood: '#5a4a32', mask: false };
const LEGENDS = ['boar', 'bloodsucker', 'snork', 'dog', 'flesh', 'cat'];
const PHOTO = ['bloodsucker', 'controller', 'poltergeist', 'izlom', 'psydog', 'cat'];

// ----- new contract types (161-180) -----
const QT2 = {
  rescue: { w: () => (World.kind === 'over' ? 1.2 : 0), rw: 1.2,
    make(q) { const s = s6Spot(700, 1100); if (!s) return false; Object.assign(q, { icon: '🆘', loc: s, n: 3, life: 120, base: 'Rescue a wounded stalker', fac: 'loner' }); },
    update(q, dt) { q.life -= dt; if (near(q.loc, 60)) q.p = Math.min(q.n, q.p + dt); if (q.p >= q.n) { giveItem(pick(['medkit', 'energy', 'vodka'])); return 'done'; } if (q.life <= 0) return 'fail'; q.text = q.base + ' (' + Math.ceil(q.life) + 's)'; },
    draw(q) { const { x, y } = q.loc; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); drawStalker({ x: 0, y: 0, z: 0, anim: 0, face: 1, aim: 0, moving: false }, HURT_PAL, false); ctx.restore(); ctx.fillStyle = 'rgba(140,20,10,0.5)'; ctx.beginPath(); ctx.ellipse(x + 10, y + 6, 18, 7, 0, 0, TAU); ctx.fill(); s6Bubble(x, y - 50, '🆘'); s6Ring(x, y - 70, q.p / q.n); } },
  escort: { w: () => (World.kind === 'over' && G.t > 90 && World.shelters.length ? 1 : 0), rw: 1.6,
    make(q) { const sh = World.shelters.filter((s) => { const d = dist(s.x, s.y, P.x, P.y); return d > 900 && d < 2600; }); if (!sh.length) return false; const dst = pick(sh); Object.assign(q, { icon: '🧪', loc: dst, npc: { x: P.x + 60, y: P.y + 40, r: 12, hp: 100 }, n: 1, base: 'Escort the scientist to the shelter', fac: 'loner' }); },
    update(q, dt) { const n = q.npc, d = dist(n.x, n.y, P.x, P.y); if (d > 70) { n.x += ((P.x - n.x) / d) * 175 * dt; n.y += ((P.y - n.y) / d) * 175 * dt; World.collide(n); } npcHurt(n, dt); if (n.hp <= 0) return 'fail'; if (dist2(n.x, n.y, q.loc.x, q.loc.y) < 130 * 130) return 'done'; q.text = q.base + ' (' + Math.ceil(n.hp) + '% hp)'; },
    draw(q) { const n = q.npc; shadow(n.x, n.y, 12, 4, 0.3); drawStalker({ x: n.x, y: n.y, z: 0, anim: NOW * 8, face: P.x > n.x ? 1 : -1, aim: 0, moving: true }, SCI_PAL, false); s6Bar(n.x, n.y - 58, n.hp / 100, '#ffe070'); } },
  measure: { w: () => (World.kind === 'over' && G.t > 120 ? 0.9 : 0), rw: 1.6,
    make(q) { const f = World.fields.filter((f) => { const d = dist(f.x, f.y, P.x, P.y); return d > 500 && d < 1800; }); if (!f.length) return false; const fl = pick(f), s = s6Spot(80, 180, 14, fl) || { x: fl.x + 120, y: fl.y }; Object.assign(q, { icon: '📏', loc: s, npc: { x: s.x, y: s.y, r: 12, hp: 100 }, n: 25, spT: 2, base: 'Guard the scientist\'s measurement', fac: 'loner' }); },
    update(q, dt) { const n = q.npc; if (near(n, 280)) { q.p = Math.min(q.n, q.p + dt); q.spT -= dt; if (q.spT <= 0) { q.spT = 3.5; for (let i = 0; i < 2; i++) { const a = rand(TAU); const x = n.x + Math.cos(a) * 520, y = n.y + Math.sin(a) * 400; if (World.free(x, y, 14)) spawnEnemy(pick(['dog', 'zombie', 'snork', 'flesh']), x, y, { noElite: true }); } } } npcHurt(n, dt); if (n.hp <= 0) return 'fail'; if (q.p >= q.n) return 'done'; q.text = q.base + ' (stay close · ' + Math.ceil(n.hp) + '% hp)'; },
    draw(q) { const n = q.npc; shadow(n.x, n.y, 12, 4, 0.3); drawStalker({ x: n.x, y: n.y, z: 0, anim: 0, face: 1, aim: 0, moving: false }, SCI_PAL, false); ctx.fillStyle = '#556'; ctx.fillRect(n.x + 14, n.y - 30, 4, 30); ctx.fillStyle = `rgba(120,255,160,${0.5 + Math.sin(NOW * 8) * 0.4})`; ctx.fillRect(n.x + 11, n.y - 36, 10, 6); s6Bar(n.x, n.y - 58, n.hp / 100, '#ffe070'); ctx.strokeStyle = 'rgba(255,224,112,0.3)'; ctx.setLineDash([10, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(n.x, n.y, 280, 200, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } },
  missing: { w: () => (World.kind === 'over' ? 0.9 : 0), rw: 1.5,
    make(q) { const c = []; let from = P; for (let i = 0; i < 3; i++) { const s = s6Spot(500, 900, 20, from); if (!s) return false; c.push(s); from = s; } Object.assign(q, { icon: '🔍', clues: c, loc: c[0], n: 3, base: 'Find the missing stalker: follow the clues', fac: 'loner' }); },
    update(q) { if (near(q.loc, 70)) { q.p++; if (q.p >= q.n) { G.rubles += 30; text(q.loc.x, q.loc.y - 50, 'Found him alive!', '#7dff8a', true, true); return 'done'; } q.loc = q.clues[q.p]; text(P.x, P.y - 60, 'A clue! Next one marked.', '#ffe070', true, true); Sfx.play('stash'); } q.text = q.base + ' (' + q.p + '/3)'; },
    draw(q) { const { x, y } = q.loc; s6Bubble(x, y - 30, q.p < 2 ? '📝' : '🧍'); ctx.strokeStyle = 'rgba(255,224,112,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 60, 30, 0, 0, TAU); ctx.stroke(); } },
  deliver: { w: () => (World.kind === 'over' && World.shelters.length > 2 ? 1 : 0), rw: 1.4,
    make(q) { const a = s6Spot(450, 800); if (!a) return false; const sh = World.shelters.filter((s) => { const d = dist(s.x, s.y, a.x, a.y); return d > 1000 && d < 2400; }); if (!sh.length) return false; Object.assign(q, { icon: '📦', a, b: pick(sh), loc: a, st: 0, time: 80, n: 2, base: 'Pick up the package', fac: 'duty' }); },
    update(q, dt) { if (q.st === 0) { if (near(q.a, 50)) { q.st = 1; q.p = 1; q.loc = q.b; Sfx.play('stash'); text(P.x, P.y - 60, 'Package! Run to the shelter!', '#ffe070', true, true); } q.text = q.base; return; } q.time -= dt; if (near(q.b, 110)) { q.p = 2; return 'done'; } if (q.time <= 0) return 'fail'; q.text = 'Deliver it to the shelter (' + Math.ceil(q.time) + 's)'; },
    draw(q) { if (q.st === 0) { const { x, y } = q.a; ctx.fillStyle = '#6a5436'; ctx.fillRect(x - 12, y - 18, 24, 18); ctx.fillStyle = '#c8a060'; ctx.fillRect(x - 12, y - 11, 24, 3); s6Bubble(x, y - 40, '📦'); } } },
  fires: { w: () => (World.kind === 'over' && !World.region(P.x, P.y).snow ? 0.8 : 0), rw: 1.4,
    make(q) { const s = s6Spot(600, 1000, 60); if (!s) return false; const f = []; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; f.push({ x: s.x + Math.cos(a) * 170, y: s.y + Math.sin(a) * 110, hold: 0, out: false }); } Object.assign(q, { icon: '🧯', loc: s, fl: f, time: 75, n: 5, base: 'Put out the fires at the camp', fac: 'freedom' }); },
    update(q, dt) { q.time -= dt; for (const f of q.fl) if (!f.out) { if (near(f, 45)) { f.hold += dt; if (f.hold > 0.8) { f.out = true; q.p++; burst(f.x, f.y, 16, '220,230,240', 120); } } else f.hold = 0; } if (q.p >= q.n) return 'done'; if (q.time <= 0) return 'fail'; q.text = q.base + ' (' + Math.ceil(q.time) + 's)'; },
    draw(q) { ctx.fillStyle = '#6a5a40'; ctx.fillRect(q.loc.x - 40, q.loc.y - 20, 80, 30); for (const f of q.fl) { if (f.out) { ctx.fillStyle = 'rgba(30,24,18,0.6)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 22, 9, 0, 0, TAU); ctx.fill(); continue; } s6Flame(f.x, f.y, 1); if (f.hold > 0) s6Ring(f.x, f.y - 60, f.hold / 0.8); } } },
  power: { w: () => (World.kind === 'lab' && World.lab && !World.lab.powered ? 3 : 0), rw: 1.6,
    make(q) { const rooms = World.lab.rooms.slice().sort(() => Math.random() - 0.5).slice(0, 3); if (rooms.length < 3) return false; Object.assign(q, { icon: '🔌', boxes: rooms.map((r) => ({ x: (r.mx + 0.5) * LAB_T + 60, y: (r.my + 0.5) * LAB_T, hold: 0, on: false })), n: 3, base: 'Restore power: flip 3 fuse boxes', fac: 'loner' }); },
    update(q, dt) { if (World.kind !== 'lab') return; for (const b of q.boxes) if (!b.on) { if (near(b, 50)) { b.hold += dt; if (b.hold > 1.5) { b.on = true; q.p++; Sfx.play('quest'); } } else b.hold = 0; } if (q.p >= q.n) { World.lab.powered = true; World.dark *= 0.35; banner('💡 POWER RESTORED', 'The lab lights flicker on.', 2.5, 'good'); return 'done'; } },
    draw(q) { if (World.kind !== 'lab') return; for (const b of q.boxes) { ctx.fillStyle = '#4a5054'; ctx.fillRect(b.x - 12, b.y - 36, 24, 30); ctx.fillStyle = b.on ? '#7dff8a' : Math.sin(NOW * 6) > 0 ? '#ff4a3a' : '#5a1a1a'; ctx.fillRect(b.x - 4, b.y - 30, 8, 6); if (b.hold > 0) s6Ring(b.x, b.y - 60, b.hold / 1.5); } } },
  antenna: { w: () => (World.kind === 'over' && World.rtowers.filter((t) => !t.on).length >= 2 ? 0.8 : 0), rw: 1.4,
    make(q) { const t = World.rtowers.filter((t) => !t.on).sort((a, b) => dist2(a.x, a.y, P.x, P.y) - dist2(b.x, b.y, P.x, P.y)).slice(0, 2); Object.assign(q, { icon: '📡', ts: t, loc: t[0], n: 2, base: 'Repair 2 radio antennas for map intel', fac: 'duty' }); },
    update(q) { q.p = q.ts.filter((t) => t.on).length; q.loc = q.ts.find((t) => !t.on) || q.ts[0]; if (q.p >= q.n) { for (const p of World.pois) W2.exploreAt(p.x, p.y, 700); for (const l of World.lairs) W2.exploreAt(l.x, l.y, 600); banner('📡 MAP INTEL', 'Points of interest and lairs are revealed on your map.', 2.5, 'good'); return 'done'; } } },
  track: { w: () => (World.kind === 'over' && G.t > 150 ? 0.8 : 0), rw: 2,
    make(q) { let x = P.x, y = P.y, a = rand(TAU); const pts = []; for (let i = 0; i < 24; i++) { a += rand(-0.35, 0.35); x = clamp(x + Math.cos(a) * 70, 300, WORLD - 300); y = clamp(y + Math.sin(a) * 55, 300, WORLD - 300); pts.push({ x, y, a }); } const id = pick(LEGENDS); Object.assign(q, { icon: '🐾', pts, idx: 0, mid: id, loc: pts[3], n: 1, base: 'Track the legendary ' + ENEMIES[id].name, fac: 'freedom' }); },
    update(q) { if (!q.boss) { const nx = q.pts[Math.min(q.idx + 2, q.pts.length - 1)]; if (near(nx, 110)) q.idx = Math.min(q.pts.length - 1, q.idx + 3); q.loc = q.pts[Math.min(q.idx + 3, q.pts.length - 1)]; if (q.idx >= q.pts.length - 1) { const e = spawnEnemy(q.mid, q.loc.x + 120, q.loc.y, { noElite: true, hpMul: 9, name: 'Legendary ' + ENEMIES[q.mid].name }); e.mini = true; e.dmg *= 1.4; q.boss = e; banner('🐾 LEGENDARY ' + ENEMIES[q.mid].name.toUpperCase(), 'You found it. Take it down!', 2.2, 'bad'); } } else { q.loc = q.boss; if (q.boss.dead) { G.pickups.push({ type: 'art', x: q.boss.x, y: q.boss.y, t: 0 }); Save.data.trophies = (Save.data.trophies || 0) + 1; return 'done'; } } },
    draw(q) { if (q.boss) return; for (let i = q.idx; i < Math.min(q.pts.length, q.idx + 9); i++) { const p = q.pts[i]; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = `rgba(60,40,24,${0.7 - (i - q.idx) * 0.06})`; for (const o of [-6, 6]) { ctx.beginPath(); ctx.ellipse(i % 2 ? 8 : -8, o, 5, 3.5, 0, 0, TAU); ctx.fill(); } ctx.restore(); } } },
  wkill: { w: () => (P.weapons.length ? 1.2 : 0), rw: 1.2,
    make(q) { const w = pick(P.weapons).id, n = Math.round(20 + (G.t / 60) * 2); Object.assign(q, { icon: WEAPONS[w].icon, w, n, text: `Kill ${n} mutants with the ${WEAPONS[w].name}`, fac: 'duty' }); } },
  samples: { w: () => (World.kind === 'over' ? 1 : 0), rw: 1.4,
    make(q) { const types = [...new Set(World.anomalies.filter((a) => !a.hidden && dist2(a.x, a.y, P.x, P.y) < 2200 * 2200 && ['electro', 'burner', 'acid', 'cryo', 'gas', 'fuzz', 'spring', 'vortex'].includes(a.type)).map((a) => a.type))]; if (!types.length) return false; const t = pick(types); Object.assign(q, { icon: '🧪', at: t, got: [], hold: 0, n: 3, text: `Collect 3 ${ANOMALIES[t].name} samples (stand at the edge)`, fac: 'loner' }); },
    update(q, dt) { let a = null; for (const x of World.anomalies) if (x.type === q.at && !q.got.includes(x) && Math.abs(x.x - P.x) < 300 && dist2(x.x, x.y, P.x, P.y) < (x.r * 1.25) ** 2) { a = x; break; } if (a) { q.hold += dt; if (q.hold > 1) { q.got.push(a); q.p++; q.hold = 0; text(P.x, P.y - 60, 'Sample taken', '#7dff8a', false, true); Sfx.play('stash'); } } else q.hold = 0; if (q.p >= q.n) return 'done'; } },
  pda: { w: () => (World.kind === 'over' ? 1 : 0), rw: 1.3,
    make(q) { const b = []; for (let i = 0; i < 3; i++) { const s = s6Spot(500, 1400, 20); if (!s) return false; b.push({ ...s, hold: 0, got: false, seed: Math.random() }); } Object.assign(q, { icon: '📟', bodies: b, loc: b[0], n: 3, text: 'Download PDA data from 3 dead stalkers', fac: 'bandit' }); },
    update(q, dt) { for (const b of q.bodies) if (!b.got) { if (near(b, 45)) { b.hold += dt; if (b.hold > 1) { b.got = true; q.p++; G.rubles += 10; Sfx.play('stash'); } } else b.hold = 0; } q.loc = q.bodies.find((b) => !b.got) || q.bodies[0]; if (q.p >= q.n) return 'done'; },
    draw(q) { for (const b of q.bodies) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI / 2 + b.seed); drawStalker({ x: 0, y: 0, z: 0, anim: 0, face: 1, aim: 0, moving: false }, HURT_PAL, false); ctx.restore(); if (!b.got) { s6Bubble(b.x, b.y - 40, '📟'); if (b.hold > 0) s6Ring(b.x, b.y - 60, b.hold); } } } },
  climb: { w: () => (World.kind === 'over' && World.wtowers.some((t) => !t.used) ? 0.7 : 0), rw: 1.8,
    make(q) { const t = World.wtowers.filter((t) => !t.used).sort((a, b) => dist2(a.x, a.y, P.x, P.y) - dist2(b.x, b.y, P.x, P.y))[0]; Object.assign(q, { icon: '🧗', t, loc: t, start: G.t, n: 1, text: 'Climb the watchtower without taking damage', fac: 'freedom' }); },
    update(q) { if ((G.lastHurtT || -1) > q.start) return 'fail'; if (q.t.used) return 'done'; } },
  village: { w: () => (World.kind === 'over' && G.t > 60 ? 0.8 : 0), rw: 1.7,
    make(q) { const hs = World.props.filter((p) => p.kind === 'building' && (p.style === 'house' || p.style === 'hut')); const c = hs.filter((b) => { const d = dist(b.x, b.y, P.x, P.y); return d > 800 && d < 1800; }); if (!c.length) return false; const b = pick(c); Object.assign(q, { icon: '🧟', loc: { x: b.x + b.w / 2, y: b.y + b.h + 60 }, n: 10, zs: null, text: 'Clear the village overrun by zombies', fac: 'duty' }); },
    update(q) { if (!q.zs && near(q.loc, 750)) { q.zs = []; for (let i = 0; i < 10; i++) { const a = rand(TAU), x = q.loc.x + Math.cos(a) * rand(80, 260), y = q.loc.y + Math.sin(a) * rand(60, 180); if (World.free(x, y, 14)) q.zs.push(spawnEnemy('zombie', x, y, { noElite: true })); } q.n = q.zs.length || 1; } if (q.zs) { q.p = q.zs.filter((z) => z.dead).length; if (q.p >= q.n) return 'done'; } } },
  race: { w: () => (World.kind === 'over' ? 0.8 : 0), rw: 1.5,
    make(q) { const c = []; let from = P, a = rand(TAU); for (let i = 0; i < 5; i++) { let s = null; for (let k = 0; k < 20 && !s; k++) { const b = a + rand(-0.9, 0.9), d = rand(350, 520), x = from.x + Math.cos(b) * d, y = from.y + Math.sin(b) * d * 0.8; if (x > 300 && y > 300 && x < WORLD - 300 && y < WORLD - 300 && World.free(x, y, 30)) { s = { x, y }; a = b; } } if (!s) return false; c.push(s); from = s; } Object.assign(q, { icon: '🏁', cps: c, loc: c[0], time: 42, n: 5, base: 'Race through 5 checkpoints', fac: 'freedom' }); },
    update(q, dt) { q.time -= dt; if (near(q.loc, 70)) { q.p++; Sfx.play('hint'); if (q.p >= q.n) return 'done'; q.loc = q.cps[q.p]; } if (q.time <= 0) return 'fail'; q.text = q.base + ' (' + Math.ceil(q.time) + 's)'; },
    draw(q) { for (let i = q.p; i < q.cps.length; i++) { const c = q.cps[i], cur = i === q.p; ctx.strokeStyle = cur ? `rgba(255,224,112,${0.7 + Math.sin(NOW * 8) * 0.3})` : 'rgba(255,224,112,0.3)'; ctx.lineWidth = cur ? 5 : 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, 60, 30, 0, 0, TAU); ctx.stroke(); ctx.font = 'bold 16px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe070'; ctx.fillText(i + 1, c.x, c.y - 40); } } },
  gamble: { w: () => (G.t > 60 ? 0.6 : 0), rw: 1,
    make(q) { const n = Math.round(15 + (G.t / 60) * 2); Object.assign(q, { icon: '🎲', n, time: 55, base: `Double or nothing: kill ${n} in time`, fac: 'bandit' }); },
    update(q, dt) { q.time -= dt; if (q.p >= q.n) { if (Math.random() < 0.5) { q.reward *= 2; text(P.x, P.y - 70, 'DOUBLE!', '#ffe070', true, true); } else { q.reward = 0; text(P.x, P.y - 70, 'NOTHING!', '#ff7a6a', true, true); } return 'done'; } if (q.time <= 0) return 'fail'; q.text = q.base + ' (' + Math.ceil(q.time) + 's)'; } },
  keycard: { w: () => (World.kind === 'lab' && World.lab && World.lab.vault && !World.lab.vault.open ? 2 : 0), rw: 1,
    make(q) { Object.assign(q, { icon: '🗝️', n: 2, text: 'Find the keycard and open the sealed vault', fac: 'loner' }); },
    update(q) { const v = World.lab && World.lab.vault; if (!v) return; q.p = (v.card.got ? 1 : 0) + (v.open ? 1 : 0); q.loc = v.card.got ? v : v.card; if (v.open) return 'done'; } },
  photo: { w: () => (World.kind === 'over' && G.t > 60 ? 0.8 : 0), rw: 1.4,
    make(q) { const id = pick(PHOTO), p = ringPos(); if (!p) return false; const e = spawnEnemy(id, p[0], p[1], { noElite: true }); Object.assign(q, { icon: '📸', e, id, hold: 0, n: 1, text: `Photograph a ${ENEMIES[id].name} (get close)`, fac: 'loner' }); },
    update(q, dt) { if (q.e.dead) { const p = ringPos(); if (p) q.e = spawnEnemy(q.id, p[0], p[1], { noElite: true }); } q.loc = q.e; if (near(q.e, 280)) { q.hold += dt; if (q.hold > 1.8) { flash(0.5, '255,255,255'); Sfx.play('hint'); return 'done'; } } else q.hold = Math.max(0, q.hold - dt); },
    draw(q) { if (q.hold > 0 && !q.e.dead) s6Ring(q.e.x, q.e.y - 70, q.hold / 1.8); } },
  repair: { w: () => (World.kind === 'over' && G.t > 200 && !G.escapeCar ? 0.5 : 0), rw: 2,
    make(q) { const s = s6Spot(800, 1300, 40); if (!s) return false; const v = { kind: 'jeep', x: s.x, y: s.y, a: 0.3, fuel: 100, broken: true }; World.vehicles.push(v); const parts = []; for (let i = 0; i < 3; i++) { const p = s6Spot(400, 900, 20, s); if (!p) return false; parts.push({ ...p, got: false }); } Object.assign(q, { icon: '🔧', v, parts, loc: parts[0], n: 4, text: 'Repair the escape jeep: find 3 parts', fac: 'loner' }); },
    update(q) { for (const p of q.parts) if (!p.got && near(p, 45)) { p.got = true; q.p++; Sfx.play('stash'); } const left = q.parts.find((p) => !p.got); q.loc = left || q.v; if (!left) { q.text = 'Bring the parts back to the jeep'; if (near(q.v, 90)) { q.v.broken = false; q.v.escape = true; G.escapeCar = q.v; q.p = 4; banner('🚙 ESCAPE READY', 'Ride the jeep (F) to the edge of the map to escape with all your loot.', 4, 'good', 2); return 'done'; } } },
    draw(q) { for (const p of q.parts) if (!p.got) { ctx.fillStyle = '#7a7e80'; ctx.beginPath(); ctx.arc(p.x, p.y - 8, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a4e50'; ctx.beginPath(); ctx.arc(p.x, p.y - 8, 4, 0, TAU); ctx.fill(); s6Bubble(p.x, p.y - 34, '⚙️'); } if (q.v.broken && Math.random() < 0.2) part(q.v.x, q.v.y - 20, { z: 20, vz: 40, g: -20, c: '80,80,80', s: 6, life: 1 }); } },
};
function s6Bubble(x, y, ic) { ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ic, x, y + Math.sin(NOW * 3) * 3); }
function s6Ring(x, y, k) { if (k <= 0) return; ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k, 0, 1)); ctx.stroke(); }
function s6Bar(x, y, k, c) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 21, y - 1, 42, 6); ctx.fillStyle = c; ctx.fillRect(x - 20, y, 40 * clamp(k, 0, 1), 4); }
function s6Flame(x, y, s) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const h = (18 + i * 6) * s * (0.85 + Math.sin(NOW * 12 + i + x) * 0.15); ctx.fillStyle = i === 0 ? 'rgba(255,90,20,0.7)' : i === 1 ? 'rgba(255,160,40,0.6)' : 'rgba(255,230,120,0.5)'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, (10 - i * 2.5) * s, h * 0.6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (Math.random() < 0.15) part(x + rand(-6, 6), y - 20, { z: 0, vz: 60, g: -20, c: '255,170,60', add: true, s: 2, life: 0.6 });
}

// contracts: new types, faction givers, chains
const _s6Make = Quests.make.bind(Quests);
Quests.make = function () {
  if (G.tutorial) return;
  const n0 = this.list.length, reward = Math.round(40 + (G.t / 60) * 12);
  const opts = Object.keys(QT2).map((k) => [k, QT2[k].w()]).filter((o) => o[1] > 0 && !this.list.some((q) => q.type === o[0]));
  let made = false;
  if (opts.length && Math.random() < 0.6) {
    let tot = 0; for (const o of opts) tot += o[1];
    let r = rand(tot), k = opts[0][0]; for (const o of opts) { r -= o[1]; if (r <= 0) { k = o[0]; break; } }
    const q = { type: k, n: 1, p: 0, reward: Math.round(reward * (QT2[k].rw || 1.3)), text: '' };
    if (QT2[k].make(q) !== false) { if (!q.text) q.text = q.base; this.list.push(q); Radio.say('quest'); made = true; }
  }
  if (!made) _s6Make();
  const q = this.list[this.list.length - 1];
  if (q && this.list.length > n0) {
    if (!q.fac) q.fac = pick(['loner', 'loner', 'duty', 'freedom', 'bandit']);
    if (this.nextChain) { q.chain = this.nextChain.n; q.reward = Math.round(q.reward * (1 + q.chain * 0.5)); q.fac = this.nextChain.fac; this.nextChain = null; }
    else if (Math.random() < 0.18) q.chain = 1;
    if (q.chain) q.text = '🔗' + q.chain + '/3 ' + q.text, q.base && (q.base = '🔗' + q.chain + '/3 ' + q.base);
    q.text = FACTIONS[q.fac].icon + ' ' + q.text; if (q.base) q.base = FACTIONS[q.fac].icon + ' ' + q.base;
  }
};
const _s6Done = Quests.complete.bind(Quests);
Quests.complete = function (q) {
  if (q.done) return;
  _s6Done(q);
  addRep(q.fac, 10); if (q.fac === 'bandit') addRep('duty', -3);
  Story.stat('contracts', 1);
  if (q.chain && q.chain < 3) { this.nextChain = { n: q.chain + 1, fac: q.fac }; this.nextT = 1.5; }
};
function questFail(q, why) {
  Quests.list = Quests.list.filter((x) => x !== q); Quests.nextT = 6;
  banner('CONTRACT FAILED', why || q.text, 2.5, 'bad'); addRep(q.fac, -4);
}

// ----- main quest chain per stage (161) -----
const MAIN_TITLES = { zone: 'Strelok\'s Trail', pripyat: 'The Dead City', npp: 'The Wish', zaton: 'Operation Fairway', wasteland: 'Scorched Earth', metro: 'Into the Dark', blackout: 'Lights Out', winter: 'Frostbite', mountain: 'The Last Climb' };
function s6Over() { return World.cur === 'over' ? World : World.levels.over; }
const MAIN_STEPS = [
  ['Find your first artifact', () => G.arts >= 1],
  ['Climb a watchtower or activate a radio tower', () => { const L = s6Over(); return L && (L.wtowers.some((t) => t.used) || L.rtowers.some((t) => t.on)); }],
  ['Clear a point of interest', () => { const L = s6Over(); return L && L.pois.some((p) => p.state === 2); }],
  ['Descend into a laboratory', () => G.labsVisited > 0],
  ['Defeat the stage\'s final boss', () => false],
];

// ----- campfire stories (160) -----
const CAMPFIRE = [
  ['Old Stalker', 'They say the Monolith grants any wish... but nobody ever came back to say "thanks".'],
  ['Loner', 'Saw a bloodsucker once. Or it saw me. I only remember the breathing.'],
  ['Freedom Guy', 'Duty wants to burn the Zone. Me? I just want to watch the sunset over Pripyat.'],
  ['Duty Soldier', 'Every mutant we kill is one less that reaches the Big Land. Remember that.'],
  ['Scientist', 'The anomalies move after every emission. It is almost as if the Zone... breathes.'],
  ['Bandit', 'Relax, I\'m off duty. Pass the vodka.'],
  ['Guide', 'Throw a bolt before every step. The Zone forgives nothing.'],
  ['Old Stalker', 'Heard of Strelok? Walked into the Zone three times. Came out twice.'],
];
const CAMP_BUFFS = [['dmg', '🔥 Warm heart: +20% damage for 60s'], ['spd', '🥾 Rested legs: +15% speed for 60s'], ['regen', '❤️ Hot meal: regenerate 3 HP/s for 60s'], ['xp', '📚 Good stories: +30% XP for 60s']];

const Story = {
  reset() { if (this.mq) this.mq._h = null; this.main = { i: 0 }; this.campT = 40; this.campHold = 0; this.buff = null; this.chalT = 2; this.tut = null; this.drawList = []; G.lastHurtT = -1; },
  stat(k, v) { const C = Save.data.chal; if (!C || G.tutorial) return; C.p[k] = (C.p[k] || 0) + v; C.wp[k] = (C.wp[k] || 0) + v; const T = Save.data.totals; T[k] = (T[k] || 0) + v; },
  onKill(e) {
    const S = Save.data; S.seen.m[e.id] = (S.seen.m[e.id] || 0) + 1;
    this.stat('kills', 1); if (e.boss) this.stat('bosses', 1);
    if (e.id === 'bandit') { addRep('duty', 1); addRep('loner', 1); addRep('bandit', -1); }
    if (e.id === 'soldier') { addRep('freedom', 1); addRep('duty', -1); }
    for (const q of Quests.list) {
      if (q.type === 'wkill' && e.lastW === q.w) { q.p = Math.min(q.n, q.p + 1); if (q.p >= q.n) Quests.complete(q); }
      if (q.type === 'gamble') q.p = Math.min(q.n, q.p + 1);
    }
    if (e.final && G.stage === 'npp' && !G.bossrush) G.wish = true;
  },
  onArt(type) { const S = Save.data; S.seen.a[type] = (S.seen.a[type] || 0) + 1; this.stat('arts', 1); },
  update(dt) {
    if (this.buff) { this.buff.t -= dt; if (this.buff.t <= 0) { this.applyBuff(this.buff.k, -1); this.buff = null; } }
    if (G.tutorial) { Tutorial.update(dt); return; }
    // new contract types
    for (const q of Quests.list.slice()) {
      const d = QT2[q.type]; if (!d || !d.update) continue;
      const r = d.update(q, dt);
      if (r === 'done') { q.p = q.n; Quests.complete(q); } else if (r === 'fail') questFail(q);
    }
    // main quest
    const M = this.main;
    if (M.i < MAIN_STEPS.length && MAIN_STEPS[M.i][1]()) {
      M.i++; G.rubles += 60; for (let i = 0; i < 6; i++) dropGem(P.x + rand(-40, 40), P.y + rand(-40, 40), 3 + Math.floor(G.t / 60));
      banner('📜 ' + (MAIN_TITLES[G.stage] || 'MAIN QUEST').toUpperCase() + ' ' + M.i + '/5', M.i < MAIN_STEPS.length ? 'Next: ' + MAIN_STEPS[M.i][0] : 'Destroy the final boss!', 3, 'good');
      Sfx.play('quest');
    }
    const mh = M.i < MAIN_STEPS.length ? `<span>📜</span><div><b>${MAIN_TITLES[G.stage] || 'Main quest'} ${M.i + 1}/5</b><small>${MAIN_STEPS[M.i][0]}</small></div>` : '';
    const el = Story.mq || (Story.mq = $('mainQ')); if (el) { if (el._h !== mh) { el._h = mh; el.innerHTML = mh; el.style.display = mh ? '' : 'none'; } const qb = $('quests'); if (el.parentNode !== qb || qb.firstChild !== el) qb.prepend(el); }
    // campfire stories at quiet shelters
    this.campT -= dt;
    if (World.kind === 'over' && this.campT <= 0 && inShelter(P.x, P.y) && !G.bosses.length && !(G.em && G.em.phase !== 'after')) {
      EG.query(P.x, P.y, 450, TMP3); const calm = !TMP3.some((e) => !e.dead);
      if (calm) { this.campHold += dt; if (this.campHold > 3) { this.campHold = 0; this.campT = 150; this.campfire(); } } else this.campHold = 0;
    } else this.campHold = 0;
    // escape jeep
    if (P.veh && P.veh.escape && (P.x < 260 || P.y < 260 || P.x > WORLD - 260 || P.y > WORLD - 260)) { G.rubles += 150; endRun('escape'); return; }
    // lab vaults & keycards (177)
    if (World.kind === 'lab' && World.lab) {
      const L = World.lab;
      if (!L.vault && L.rooms && L.rooms.length > 3) { const rs = L.rooms.slice().sort(() => Math.random() - 0.5); L.vault = { x: (rs[0].mx + 0.5) * LAB_T, y: (rs[0].my + 0.5) * LAB_T + 40, open: false, card: { x: (rs[1].mx + 0.5) * LAB_T - 50, y: (rs[1].my + 0.5) * LAB_T, got: false } }; }
      const V = L.vault;
      if (V && !V.open) {
        if (!V.card.got && near(V.card, 40)) { V.card.got = true; banner('🗝️ KEYCARD', 'It opens the sealed vault somewhere in this lab.', 2.2, 'good'); Sfx.play('stash'); }
        if (V.card.got && near(V, 70)) { V.open = true; G.rubles += 150; for (let i = 0; i < 2; i++) G.pickups.push({ type: 'art', x: V.x + rand(-40, 40), y: V.y + 40, t: 0 }); banner('🔓 VAULT OPENED', '+150 ₽ and 2 artifacts.', 2.5, 'good'); Sfx.play('quest'); }
      }
    }
    // daily/weekly challenge completion
    this.chalT -= dt; if (this.chalT <= 0) { this.chalT = 2; Meta.checkChallenges(true); }
  },
  applyBuff(k, s) { if (k === 'dmg') P.dmgMul += 0.2 * s; else if (k === 'spd') P.spdMul += 0.15 * s; else if (k === 'regen') P.regen += 3 * s; else if (k === 'xp') P.xpMul += 0.3 * s; },
  campfire() {
    const [who, txt] = pick(CAMPFIRE), b = pick(CAMP_BUFFS);
    Radio.q.push({ who, txt }); if (this.buff) this.applyBuff(this.buff.k, -1);
    this.buff = { k: b[0], t: 60 }; this.applyBuff(b[0], 1);
    banner('🔥 CAMPFIRE STORY', b[1], 3, 'good'); Sfx.play('heal');
  },
};

// ----- drawing (world space, after sprites) -----
function drawStory(x0, y0, x1, y1) {
  for (const q of Quests.list) { const d = QT2[q.type]; if (d && d.draw) d.draw(q); }
  if (World.kind === 'over' && Story.campHold > 0) { s6Flame(P.x + 40, P.y + 10, 1.2); s6Ring(P.x, P.y - 70, Story.campHold / 3); }
  if (Story.buff && World.kind === 'over' && inShelter(P.x, P.y)) s6Flame(P.x + 40, P.y + 10, 0.8);
  for (const v of World.vehicles || []) if (v.broken) { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔧', v.x, v.y - 50); }
  if (G.escapeCar && !P.veh) { ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#7dff8a'; ctx.fillText('ESCAPE JEEP', G.escapeCar.x, G.escapeCar.y - 50); }
  const L = World.kind === 'lab' && World.lab && World.lab.vault;
  if (L) {
    if (!L.card.got) { ctx.fillStyle = '#e8e0c0'; ctx.fillRect(L.card.x - 9, L.card.y - 14, 18, 12); ctx.fillStyle = '#c03a2a'; ctx.fillRect(L.card.x - 9, L.card.y - 14, 18, 4); s6Bubble(L.card.x, L.card.y - 30, '🗝️'); }
    ctx.fillStyle = L.open ? '#3a4a3a' : '#5a5e62'; ctx.fillRect(L.x - 34, L.y - 50, 68, 50); ctx.fillStyle = L.open ? '#7dff8a' : '#ff4a3a'; ctx.beginPath(); ctx.arc(L.x, L.y - 25, 8, 0, TAU); ctx.fill();
    if (!L.open) s6Bubble(L.x, L.y - 64, '🔒');
  }
}

