'use strict';
// ---------- variety: mutant variants, golden mutants, boss modifiers, themed hordes, new events, weather combos,
// ---------- mini-biomes, shrines, wandering stalkers and treasure maps ----------
const VAR = {
  armored: { name: 'Armored', col: '#9aa4b0', f(e) { e.hp *= 2; e.maxhp *= 2; e.spd *= 0.85; } },
  swift: { name: 'Swift', col: '#7fe3ff', f(e) { e.spd *= 1.35; e.hp *= 0.8; e.maxhp *= 0.8; } },
  giant: { name: 'Giant', col: '#ff9a4a', f(e) { e.sc = (e.sc || 1) * 1.4; e.r *= 1.4; e.hp *= 2.5; e.maxhp *= 2.5; e.dmg *= 1.3; } },
  tiny: { name: 'Tiny', col: '#c8ff7a', f(e) { e.sc = (e.sc || 1) * 0.7; e.r *= 0.7; e.hp *= 0.5; e.maxhp *= 0.5; e.spd *= 1.2; } },
};
const BOSS_MODS = {
  enraged: { name: 'ENRAGED', f(e) { e.spd *= 1.3; e.dmg *= 1.2; } },
  shielded: { name: 'SHIELDED', f(e) { e.hp *= 1.5; e.maxhp *= 1.5; } },
  summoner: { name: 'SUMMONER', f(e) { e.sumT = 6; } },
  splitting: { name: 'SPLITTING', f(e) { e.splits = true; } },
};
const THEMES = [['dog', '🐕 DOG NIGHT', 'Only dogs. Lots of dogs.'], ['zombie', '🧟 ZOMBIE PARADE', 'The dead walk together.'], ['snork', '🦵 SNORK SEASON', 'Snorks everywhere, hopping mad.'], ['flesh', '🐖 FLESH FEAST', 'A herd of flesh roams the land.']];
const V = { themeT: 0, themeId: null, nextTheme: 200, npcT: 150, npc: null, combo: null, comboT: 0 };

// ----- spawning: variants, golden mutants, themed hordes, boss modifiers -----
const _vaSpawn = spawnEnemy;
spawnEnemy = function (id, x, y, o = {}) {
  if (G && !G.title && V.themeT > 0 && !o.noTheme && ENEMIES[id] && !ENEMIES[id].boss && Math.random() < 0.7 && ENEMIES[V.themeId]) id = V.themeId;
  const e = _vaSpawn(id, x, y, o);
  if (!e || e.boss || !G || G.title || G.coGuest || o.noElite) return e;
  if (G.t > 30 && Math.random() < 1 / 300) { e.golden = true; e.hp *= 3; e.maxhp *= 3; e.spd *= 1.25; e.goldT = 25; e.name = 'Golden ' + e.name; text(e.x, e.y - 50, '✨ GOLDEN MUTANT!', '#ffd700', true, true); }
  else if (G.t > 60 && Math.random() < 0.08) { const k = pick(Object.keys(VAR)); VAR[k].f(e); e.variant = k; e.name = VAR[k].name + ' ' + e.name; }
  return e;
};
const _vaBoss = spawnBoss;
spawnBoss = function (id, o = {}) {
  const e = _vaBoss(id, o);
  if (e && G && !G.coGuest && !o.labBoss && Math.random() < 0.5) { const k = pick(Object.keys(BOSS_MODS)); BOSS_MODS[k].f(e); e.bmod = k; e.name = BOSS_MODS[k].name + ' ' + e.name; }
  return e;
};
const _vaKill = killEnemy;
killEnemy = function (e, ...a) {
  const was = e && e.dead, r = _vaKill(e, ...a);
  if (e && !was && e.dead && G && !G.coGuest) {
    if (e.golden) { G.rubles += 400; G.pickups.push({ type: 'art', x: e.x, y: e.y, t: 0 }); banner('✨ GOLDEN MUTANT', '+400 ₽ and an artifact!', 2.5, 'good'); }
    if (e.splits) for (let i = 0; i < 2; i++) { const m = _vaSpawn(pick(['pseudodog', 'snork', 'boar']), e.x + rand(-60, 60), e.y + rand(-40, 40), { noElite: true }); if (m) { m.hp *= 3; m.maxhp *= 3; } }
    if (V.goldRainT > 0) G.rubles += 3;
    if (G.t > 90 && !World.treasure && World.kind === 'over' && Math.random() < 0.004) treasureMap();
  }
  return r;
};

// ----- new random events -----
Object.assign(EVENTS, {
  meteors: { name: 'Meteor Shower', icon: '☄️', minT: 200, w: 1.5, dur: 25, desc: 'Rocks fall from the sky. Watch the red circles!',
    start(ev) { ev.m = []; ev.k = 0; },
    update(ev, dt) {
      ev.k -= dt; if (ev.k <= 0) { ev.k = 1.3; const a = rand(TAU), d = rand(60, 380); ev.m.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * 0.7, t: 1.6 }); }
      for (const m of ev.m) { m.t -= dt; if (m.t <= 0 && !m.done) { m.done = 1; explode(m.x, m.y, 85, 22, false); } }
      ev.m = ev.m.filter((m) => !m.done);
    } },
  goldrain: { name: 'Gold Rain', icon: '💰', minT: 150, w: 1.5, dur: 40, desc: 'Every kill pays +3 ₽ extra for a while!',
    start() { V.goldRainT = 40; } },
  whispers: { name: 'Fog of Whispers', icon: '👁️', minT: 240, w: 1, dur: 35, desc: 'Thick fog and voices. Mutants are harder to see.',
    start() { Env.setWeather('fog'); } },
  caravan: { name: 'Trader Caravan', icon: '🐫', minT: 120, w: 1.2, dur: 20, desc: 'A caravan drops supplies nearby. Grab them!',
    start() { for (let i = 0; i < 5; i++) { const a = rand(TAU), d = rand(120, 300); G.pickups.push({ type: i < 3 ? 'med' : 'item', id: pick(Object.keys(ITEMS)), x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * 0.7, t: 0 }); } } },
  ratswarm: { name: 'Rat Swarm', icon: '🐀', minT: 180, w: 1.2, dur: 20, desc: 'A tide of rats pours out of the ground.',
    start() { for (let i = 0; i < 24; i++) { const p = ringPos(); if (p) _vaSpawn('rat', p[0] + rand(-50, 50), p[1] + rand(-50, 50), { noElite: true, noTheme: true }); } } },
});

// ----- weather combos -----
const W_COMBOS = { storm: ['⚡ LIGHTNING STORM', 'Lightning strikes the mutants around you.'], snow: ['🌨️ BLIZZARD', 'Mutants are slowed by the cold.'], fog: ['👻 WHISPERING FOG', 'A faint psi hum in the fog.'], heat: ['🔥 WILDFIRES', 'Fires start in the dry grass.'], rain: ['☢️ ACID RAIN', 'Radiation in the rain: stay near shelters. Artifacts glow brighter.'] };
const _vaWeather = Env.setWeather.bind(Env);
Env.setWeather = function (w) {
  _vaWeather(w);
  V.combo = null;
  if (G && !G.title && W_COMBOS[w] && G.t > 90 && Math.random() < 0.3) { V.combo = w; V.comboT = 1; banner(W_COMBOS[w][0], W_COMBOS[w][1], 3, 'bad'); }
};

// ----- world: mini-biomes, shrines -----
const PATCHES = { grove: { name: 'Healing Grove', col: '120,220,120' }, tar: { name: 'Tar Pit', col: '40,34,30' }, ember: { name: 'Ember Field', col: '255,110,40' } };
const SHRINES = [
  ['blood', '🩸', 'Blood Shrine', 'Give 25% of your health for +15% damage.'],
  ['gamble', '🎲', 'Gambler\'s Shrine', 'Either +300 ₽ or -100 ₽.'],
  ['luck', '🍀', 'Shrine of Luck', 'Give 20% of your health for +1 luck.'],
  ['sage', '📖', 'Sage\'s Shrine', '+2 rerolls for your upgrade cards.'],
];
LEVEL_KEYS.push('patches', 'shrines', 'treasure');
const _vaNewLevel = World.newLevel;
World.newLevel = function (kind) { _vaNewLevel.call(this, kind); this.patches = []; this.shrines = []; this.treasure = null; };
const _vaW2 = World.genWorld2;
World.genWorld2 = function (R) {
  _vaW2.call(this, R);
  const far = (x, y) => dist(x, y, this.start.x, this.start.y) > 900;
  for (let i = 0, t = 0; i < 7 && t < 400; t++) { const x = 800 + R() * (WORLD - 1600), y = 800 + R() * (WORLD - 1600); if (!far(x, y) || !this.free(x, y, 60) || this.isWater(x, y)) continue; this.patches.push({ x, y, r: 150 + R() * 90, k: ['grove', 'tar', 'ember'][i % 3] }); i++; }
  for (let i = 0, t = 0; i < 4 && t < 400; t++) { const x = 700 + R() * (WORLD - 1400), y = 700 + R() * (WORLD - 1400); if (!far(x, y) || !this.free(x, y, 40) || this.shrines.some((s) => dist(s.x, s.y, x, y) < 2500)) continue; const s = SHRINES[i % SHRINES.length]; this.shrines.push({ x, y, k: s[0], hold: 0 }); this.addOb({ x, y: y - 6, r: 16 }); i++; }
};
function treasureMap() {
  for (let t = 0; t < 200; t++) {
    const a = rand(TAU), d = rand(1400, 2600), x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
    if (x < 300 || y < 300 || x > WORLD - 300 || y > WORLD - 300 || !World.free(x, y, 30)) continue;
    World.treasure = { x, y }; World.labels.push({ x, y: y + 40, name: '✖ Treasure' });
    banner('🗺️ TREASURE MAP', 'A mutant carried a stalker\'s map. Dig at the ✖ (see the map).', 3.5, 'good'); return;
  }
}

// ----- runtime -----
const _vaReset = W2.reset.bind(W2);
W2.reset = function () { _vaReset(); Object.assign(V, { themeT: 0, themeId: null, nextTheme: rand(200, 300), npcT: rand(140, 200), npc: null, combo: null, goldRainT: 0 }); };
const _vaUp = W2.update.bind(W2);
W2.update = function (dt) {
  _vaUp(dt);
  if (!G || G.title || G.state !== 'play') return;
  V.goldRainT = Math.max(0, (V.goldRainT || 0) - dt);
  if (!G.coGuest) {
    // themed hordes
    if (V.themeT > 0) V.themeT -= dt;
    else if (G.t > V.nextTheme && !G.tutorial && !Events.cur) { V.nextTheme = G.t + rand(170, 260); const th = pick(THEMES); V.themeId = th[0]; V.themeT = 35; banner(th[1], th[2], 3, 'bad'); }
    // golden mutants flee after a while; summoner bosses call help
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (e.golden && (e.goldT -= dt) <= 0) { e.dead = true; e.hp = 0; burst(e.x, e.y, 20, '255,215,0', 160, { add: true }); text(e.x, e.y - 40, 'It got away…', '#ffd700', false, true); }
      if (e.sumT !== undefined && (e.sumT -= dt) <= 0) { e.sumT = 8; for (let i = 0; i < 2; i++) _vaSpawn(pick(['dog', 'snork', 'zombie']), e.x + rand(-80, 80), e.y + rand(-60, 60), { noElite: true, noTheme: true }); }
    }
  }
  if (World.kind !== 'over') return;
  // weather combos
  if (V.combo && Env.weather === V.combo) {
    V.comboT -= dt;
    if (V.comboT <= 0) {
      V.comboT = V.combo === 'storm' ? 2.5 : V.combo === 'heat' ? 9 : 1;
      if (V.combo === 'storm' && !G.coGuest) { EG.query(P.x, P.y, 600, TMP3); const e = TMP3.find((q) => !q.dead); if (e) { hurtEnemy(e, 70 * (1 + G.t / 600), 0, 0, true, false); G.fx.push({ k: 'boom', x: e.x, y: e.y, r: 60, life: 0.3, max: 0.3 }); Sfx.play('zap'); } }
      if (V.combo === 'snow') for (const e of G.enemies) if (!e.dead && Math.abs(e.x - P.x) < 1200) e.slowT = Math.max(e.slowT, 1.2);
      if (V.combo === 'fog') G.psi = Math.max(G.psi || 0, 0.25);
      if (V.combo === 'heat' && !G.coGuest) { const a = rand(TAU); Hz.fires.push({ x: P.x + Math.cos(a) * rand(250, 500), y: P.y + Math.sin(a) * rand(200, 350), life: 12, spread: 1 }); }
      if (V.combo === 'rain' && !inShelter(P.x, P.y)) { P.radAcc = (P.radAcc || 0) + 1.2; if (P.radAcc > 3) { hurtPlayer(P.radAcc, 'acid rain', true, 'rad'); P.radAcc = 0; } }
    }
  }
  // mini-biomes
  for (const p of World.patches || []) {
    if (Math.abs(p.x - P.x) > 1400 || Math.abs(p.y - P.y) > 1000) continue;
    const inP = dist2(p.x, p.y, P.x, P.y) < p.r * p.r;
    if (p.k === 'grove' && inP) P.hp = Math.min(P.maxhp, P.hp + 3 * dt);
    if (p.k === 'tar' && inP && !P.veh) P.slowNext = Math.max(P.slowNext, 0.35);
    if (!G.coGuest && p.k !== 'grove') { EG.query(p.x, p.y, p.r, TMP3); for (const e of TMP3) if (!e.dead && dist2(e.x, e.y, p.x, p.y) < p.r * p.r) { if (p.k === 'tar') e.slowT = Math.max(e.slowT, 0.5); else { e.burnT = Math.max(e.burnT, 1); e.burnDps = Math.max(e.burnDps || 0, 10); } } }
  }
  // shrines
  for (const s of World.shrines || []) {
    if (s.used) continue;
    if (dist2(s.x, s.y, P.x, P.y) < 55 * 55) { s.hold += dt; if (s.hold > 1.2) useShrine(s); } else s.hold = 0;
  }
  // treasure
  const T = World.treasure;
  if (T && !T.dug && dist2(T.x, T.y, P.x, P.y) < 60 * 60) { T.dug = true; G.rubles += 250; G.pickups.push({ type: 'art', x: T.x, y: T.y, t: 0 }, { type: 'med', x: T.x + 30, y: T.y, t: 0 }); banner('💎 TREASURE FOUND', '+250 ₽, an artifact and supplies!', 3, 'good'); Sfx.play('stash'); const l = World.labels.find((q) => q.name === '✖ Treasure'); if (l) l.name = '✔ Dug up'; }
  // wandering stalkers
  if (!G.coGuest && !G.tutorial) {
    const n = V.npc;
    if (!n) { if (G.t > V.npcT) { V.npcT = G.t + rand(120, 200); const p = ringPos(-150); if (p) { V.npc = { x: p[0], y: p[1], life: 60, hold: 0, k: pick(['trade', 'gift', 'job', 'ambush']) }; banner('🧍 A STALKER NEARBY', 'Walk up to them and stay a moment.', 2.5, ''); } } }
    else {
      n.life -= dt;
      if (n.job) { if (G.kills >= n.jobGoal) { G.rubles += 220; banner('🧍 JOB DONE', '+220 ₽ from the stalker.', 2.5, 'good'); V.npc = null; } else if (n.life <= 0) { banner('🧍 JOB FAILED', 'The stalker left.', 2, 'bad'); V.npc = null; } }
      else if (n.life <= 0) V.npc = null;
      else if (dist2(n.x, n.y, P.x, P.y) < 70 * 70) { n.hold += dt; if (n.hold > 1) meetNpc(n); } else n.hold = 0;
    }
  }
};
function useShrine(s) {
  s.used = true; Sfx.play('ability'); burst(s.x, s.y - 30, 24, '255,220,140', 160, { add: true });
  if (s.k === 'blood') { P.hp = Math.max(1, P.hp - P.maxhp * 0.25); P.dmgMul += 0.15; banner('🩸 BLOOD SHRINE', '+15% damage for this run.', 2.5, 'good'); }
  else if (s.k === 'gamble') { const w = Math.random() < 0.5; G.rubles = Math.max(0, G.rubles + (w ? 300 : -100)); banner('🎲 ' + (w ? 'YOU WIN' : 'YOU LOSE'), w ? '+300 ₽' : '-100 ₽', 2.5, w ? 'good' : 'bad'); }
  else if (s.k === 'luck') { P.hp = Math.max(1, P.hp - P.maxhp * 0.2); P.luck += 1; banner('🍀 SHRINE OF LUCK', '+1 luck for this run.', 2.5, 'good'); }
  else { P.rerolls = (P.rerolls || 0) + 2; banner('📖 SAGE\'S SHRINE', '+2 rerolls.', 2.5, 'good'); }
}
function meetNpc(n) {
  if (n.k === 'trade') { if (G.rubles >= 100) { G.rubles -= 100; G.pickups.push({ type: 'item', id: pick(Object.keys(ITEMS)), x: P.x + 30, y: P.y, t: 0 }, { type: 'med', x: P.x - 30, y: P.y, t: 0 }); banner('🧍 TRADE', 'You paid 100 ₽ for supplies.', 2.5, 'good'); } else banner('🧍 NO MONEY', 'Come back with 100 ₽.', 2, ''); V.npc = null; }
  else if (n.k === 'gift') { G.pickups.push({ type: 'med', x: P.x + 30, y: P.y, t: 0 }); G.rubles += 60; banner('🧍 A GIFT', '"Take this, you look like you need it." +60 ₽', 2.5, 'good'); V.npc = null; }
  else if (n.k === 'job') { n.k = 'working'; n.job = true; n.jobGoal = G.kills + 25; n.life = 60; banner('🧍 A JOB', 'Kill 25 mutants within 60 seconds for 220 ₽.', 3, ''); }
  else if (n.k === 'ambush') { for (let i = 0; i < 5; i++) _vaSpawn(pick(['snork', 'bloodsucker', 'dog']), n.x + rand(-120, 120), n.y + rand(-90, 90), { noElite: true, noTheme: true }); banner('🧍 IT\'S A TRAP!', 'The "stalker" was bait. Fight!', 2.5, 'bad'); V.npc = null; }
}

// ----- drawing -----
const _vaBase = drawW2Base;
drawW2Base = function (x0, y0, x1, y1, title) {
  _vaBase(x0, y0, x1, y1, title);
  if (World.kind !== 'over') return;
  for (const p of World.patches || []) {
    if (p.x + p.r < x0 || p.x - p.r > x1 || p.y + p.r < y0 || p.y - p.r > y1) continue;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(${PATCHES[p.k].col},${p.k === 'tar' ? 0.55 : 0.28})`); g.addColorStop(1, `rgba(${PATCHES[p.k].col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, TAU); ctx.fill();
    if (p.k !== 'tar' && Math.random() < 0.08) part(p.x + rand(-p.r, p.r) * 0.6, p.y + rand(-p.r, p.r) * 0.4, { z: 2, vz: 30, g: -10, c: PATCHES[p.k].col, add: true, s: 3, life: 0.8 });
  }
  const T = World.treasure;
  if (T && !T.dug) { ctx.strokeStyle = '#c83a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(T.x - 18, T.y - 12); ctx.lineTo(T.x + 18, T.y + 12); ctx.moveTo(T.x + 18, T.y - 12); ctx.lineTo(T.x - 18, T.y + 12); ctx.stroke(); }
};
const _vaTop = drawW2Top;
drawW2Top = function (x0, y0, x1, y1) {
  _vaTop(x0, y0, x1, y1);
  for (const e of G.enemies) {
    if (e.dead || (!e.variant && !e.golden && !e.bmod) || e.x < x0 - 60 || e.x > x1 + 60 || e.y < y0 - 60 || e.y > y1 + 60) continue;
    const c = e.golden ? '#ffd700' : e.bmod ? '#ff4a4a' : VAR[e.variant].col;
    ctx.strokeStyle = c; ctx.globalAlpha = 0.8; ctx.lineWidth = e.golden ? 3 : 2; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, e.r * 1.2, e.r * 0.5, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    if (e.golden && Math.random() < 0.3) part(e.x + rand(-12, 12), e.y - rand(10, 40), { vz: 30, g: -20, c: '255,215,0', add: true, s: 2.5, life: 0.5 });
  }
  const ev = Events.cur;
  if (ev && ev.m) for (const m of ev.m) { ctx.strokeStyle = 'rgba(255,70,40,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(m.x, m.y, 85, 52, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,70,40,0.18)'; ctx.fill(); }
  if (World.kind !== 'over') return;
  for (const s of World.shrines || []) {
    if (s.x < x0 - 80 || s.x > x1 + 80 || s.y < y0 - 120 || s.y > y1 + 60) continue;
    const S = SHRINES.find((q) => q[0] === s.k);
    shadow(s.x, s.y + 2, 22, 7, 0.3);
    ctx.fillStyle = s.used ? '#4a4844' : '#7a7468'; ctx.fillRect(s.x - 12, s.y - 44, 24, 44); ctx.fillStyle = s.used ? '#3a3834' : '#8a8478'; ctx.fillRect(s.x - 16, s.y - 50, 32, 8);
    if (!s.used) { ctx.fillStyle = `rgba(255,220,140,${0.4 + Math.sin(NOW * 3) * 0.2})`; ctx.beginPath(); ctx.arc(s.x, s.y - 62, 10, 0, TAU); ctx.fill(); }
    ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(S[1], s.x, s.y - 22);
    if (!s.used && dist2(s.x, s.y, P.x, P.y) < 300 * 300) { ctx.font = 'bold 12px Oswald, sans-serif'; ctx.fillStyle = '#ffe0a0'; ctx.fillText(S[2] + ': ' + S[3], s.x, s.y + 22); }
    if (s.hold > 0 && !s.used) { ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y - 62, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (s.hold / 1.2)); ctx.stroke(); }
  }
  const n = V.npc;
  if (n && !n.job) {
    drawStalker({ x: n.x, y: n.y, z: 0, anim: NOW * 0.5, face: P.x < n.x ? -1 : 1, aim: 0, moving: false }, GUIDE_PAL, false);
    ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf6a'; ctx.fillText('🧍 STALKER', n.x, n.y - 58);
    if (n.hold > 0) { ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(n.x, n.y - 75, 12, -Math.PI / 2, -Math.PI / 2 + TAU * n.hold); ctx.stroke(); }
  }
};

// ----- auto-pick: level-ups choose an upgrade by themselves without pausing (Settings or the 🤖 button) -----
const _vaLv = openLevelUp;
openLevelUp = function () {
  _vaLv();
  if (!Save.set.autoPick || choiceMode !== 'level' || !choices.length) return;
  let best = 0, bs = -1;
  choices.forEach((c, i) => { const s = RARITY.indexOf(c.rar) * 10 + (c.kind === 'evo' ? 60 : 0) + (c.kind === 'weapon' ? 4 : 0) + Math.random(); if (s > bs) { bs = s; best = i; } });
  const r = choices[best].rar;
  chooseCard(best);
  hide('levelup'); if (G.state === 'levelup') G.state = 'play';
  text(P.x, P.y - 80, '🤖 ' + r.name.toUpperCase() + ' UPGRADE', r.color || '#ffe070', false, true);
};
// auto-pick also covers talent points (every 5 levels) and lab artifact choices
function autoTake(i, label) { if (G.state !== 'levelup' || !choices[i]) return; chooseCard(i); hide('levelup'); if (G.state === 'levelup') G.state = 'play'; text(P.x, P.y - 100, '🤖 ' + label, '#ffe070', false, true); }
const _vaTal = openTalent;
openTalent = function () {
  _vaTal();
  if (!Save.set.autoPick || choiceMode !== 'talent' || !choices.length || G.state !== 'levelup') return;
  let best = 0, bs = -1; // deepen the branch you invested in most
  choices.forEach((c, i) => { const s = (P.talents[c.id] || 0) * 10 + Math.random(); if (s > bs) { bs = s; best = i; } });
  const T = TALENTS[choices[best].id]; autoTake(best, T.icon + ' ' + T.nodes[P.talents[choices[best].id] || 0][0].toUpperCase());
};
const _vaArt = openArtifactChoice;
openArtifactChoice = function () {
  _vaArt();
  if (!Save.set.autoPick || choiceMode !== 'art' || !choices.length || G.state !== 'levelup') return;
  const best = Math.max(0, choices.findIndex((c) => !P.arts[c.id]));
  autoTake(best, ARTIFACTS[choices[best].id].name.toUpperCase());
};
addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('button'); b.id = 'autoBtn'; b.textContent = '🤖';
  const upd = () => { b.style.opacity = Save.set.autoPick ? 1 : 0.45; b.title = 'Auto-pick upgrades: ' + (Save.set.autoPick ? 'ON' : 'OFF'); };
  b.onclick = () => { setAuto(!Save.set.autoPick); upd(); if (G && !G.title) text(P.x, P.y - 80, '🤖 Auto-pick ' + (Save.set.autoPick ? 'ON' : 'OFF'), '#ffe070', false, true); };
  const bt = $('btns'); if (bt) bt.prepend(b); upd();
  const _bs = buildSettings; buildSettings = function (...a) { const r = _bs(...a); upd(); return r; };
});
// the level-up screen itself offers auto-pick, so it is easy to find
addEventListener('DOMContentLoaded', () => {
  const lv = $('levelup'); if (!lv) return;
  const b = document.createElement('button'); b.id = 'autoLvBtn'; b.className = 'big ghost small'; b.textContent = '🤖 Auto-pick from now on (no pause)';
  b.onclick = () => { Save.set.autoPick = true; Save.save(); const ab = $('autoBtn'); if (ab) ab.style.opacity = 1; if (G && G.state === 'levelup' && choiceMode === 'level') { G.pendingLv++; hide('levelup'); G.state = 'play'; openLevelUp(); } };
  lv.appendChild(b);
});
// auto-pick in 3 places: top of Settings (main menu), the pause menu, and in game (🤖 button + level-up screen)
function autoLabel() { return '🤖 Auto-pick upgrades: ' + (Save.set.autoPick ? 'ON' : 'OFF'); }
function setAuto(v) { Save.set.autoPick = v; Save.save(); const ab = $('autoBtn'); if (ab) ab.style.opacity = v ? 1 : 0.45; const pb = $('autoPauseBtn'); if (pb) pb.textContent = autoLabel(); }
addEventListener('DOMContentLoaded', () => {
  const _bs2 = buildSettings;
  buildSettings = function (...a) {
    const r = _bs2(...a);
    const body = $('settingsBody');
    if (body && !$('autoSetRow')) {
      body.insertAdjacentHTML('afterbegin', `<label class="set" id="autoSetRow"><span>🤖 Auto-pick upgrades on level up (no pause)</span><input type="checkbox" id="autoSet" ${Save.set.autoPick ? 'checked' : ''}></label>`);
      $('autoSet').onchange = (e) => setAuto(e.target.checked);
    }
    return r;
  };
  const pz = $('pause');
  if (pz) {
    const b = document.createElement('button'); b.id = 'autoPauseBtn'; b.className = 'big ghost'; b.textContent = autoLabel();
    b.onclick = () => { setAuto(!Save.set.autoPick); };
    const first = pz.querySelector('button'); if (first && first.parentNode) first.parentNode.insertBefore(b, first.nextSibling); else pz.appendChild(b);
  }
});
