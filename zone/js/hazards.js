'use strict';
// ---------- phase 4: Zone hazards, vehicles, water, ice, attics, bolts ----------
Object.assign(ANOMALIES, {
  geyser: { name: 'Geyser', r: 46, color: '#e0f0ff' },
  mirror: { name: 'Mirror', r: 44, color: '#e8e8ff' },
  sound: { name: 'Sound Anomaly', r: 80, color: '#ffe0a0' },
  magnet: { name: 'Magnetic', r: 110, color: '#9ab8ff' },
  timeloop: { name: 'Time Loop', r: 42, color: '#ffd0f0' },
  flip: { name: 'Gravity Flip', r: 90, color: '#c0a0ff' },
});
Object.assign(ANOM_ARTS, {
  geyser: ['spring', 'flash', 'bubble', 'droplets'], mirror: ['eye', 'veil', 'moonlight', 'mica'], sound: ['cocoon', 'beads', 'eye'],
  magnet: ['gravi', 'compass', 'nightstar', 'coil'], timeloop: ['compass', 'wanderer', 'cocoon', 'oasis'], flip: ['wrenched', 'blackpearl', 'spring', 'gravi'],
});
const NEW_ANOMS = ['geyser', 'mirror', 'sound', 'magnet', 'timeloop', 'flip'];
Object.assign(WEATHER, {
  heat: { name: 'Heat Wave', icon: '🥵', desc: 'Burner anomalies flare up.' },
  snow: { name: 'Snowfall', icon: '❄️', desc: 'Everyone slows down in the snow.' },
  radstorm: { name: 'Radiation Storm', icon: '☢️', desc: 'Radiation everywhere. Shelter or Anti-Rad!' },
});
ITEMS.scanner = { name: 'Anomaly Scanner', icon: '📡', key: '5', desc: 'Reveal hidden anomalies & nearby artifacts for 2 min', use: () => { P.scanT = 120; for (const a of World.anomalies) if (dist2(a.x, a.y, P.x, P.y) < 2500 * 2500) a.hidden = false; Sfx.play('beep'); } };

// ---------- world extras generated per overworld ----------
function genHazards(R) {
  const W = World;
  W.spores = []; W.crystals = []; W.attics = []; W.vehicles = []; W.tornados = [];
  // spore fields in forests and valleys
  for (let i = 0; i < 400 && W.spores.length < 26; i++) {
    const x = 400 + R() * (WORLD - 800), y = 400 + R() * (WORLD - 800), reg = W.region(x, y);
    if (reg.trees < 0.25 || dist(x, y, W.start.x, W.start.y) < 900 || !W.free(x, y, 60)) continue;
    W.spores.push({ x, y, r: 110 + R() * 70, seed: R() * 100 });
  }
  // growing crystal formations
  for (let i = 0; i < 300 && W.crystals.length < 14; i++) {
    const x = 400 + R() * (WORLD - 800), y = 400 + R() * (WORLD - 800);
    if (dist(x, y, W.start.x, W.start.y) < 1200 || !W.free(x, y, 50) || W.crystals.some((c) => dist(c.x, c.y, x, y) < 1500)) continue;
    const ob = W.addOb({ x, y, r: 28 }); W.crystals.push({ x, y, g: 0.3 + R() * 0.5, seed: R() * 100, ob, hold: 0 });
  }
  // attic ladders on some houses
  for (const p of W.props) if (p.kind === 'building' && (p.style === 'house' || p.style === 'apartment') && R() < 0.14) W.attics.push({ x: p.x + p.w * 0.25, y: p.y + p.h + 12, b: p, looted: false, hold: 0 });
  // parked vehicles near roads
  for (const road of W.roads) for (let i = 0; i < road.length - 1; i++) {
    if (R() > 0.45) continue;
    const t = R(), x = lerp(road[i][0], road[i + 1][0], t) + (R() - 0.5) * 140, y = lerp(road[i][1], road[i + 1][1], t) + (R() - 0.5) * 140;
    if (!W.free(x, y, 30) || dist(x, y, W.start.x, W.start.y) < 300) continue;
    W.vehicles.push({ kind: R() < 0.62 ? 'bike' : 'jeep', x, y, a: R() * TAU, fuel: 100, hp: 1 });
  }
  const bike = { kind: 'bike', x: W.start.x + 90, y: W.start.y + 40, a: 0, fuel: 100 };
  if (W.free(bike.x, bike.y, 20)) W.vehicles.push(bike);
  // wandering tornados
  for (let i = 0; i < 4; i++) W.tornados.push({ x: 800 + R() * (WORLD - 1600), y: 800 + R() * (WORLD - 1600), a: R() * TAU, r: 150, seed: R() * 100 });
}
World.isWater = function (x, y) {
  if (this.kind !== 'over') return false;
  const reg = this.region(x, y); if (!reg.water) return false;
  return fbm(x / 260, y / 260, 5) > 0.6;
};

// ---------- runtime ----------
const Hz = {
  hist: [], histT: 0, fires: [], footT: 0, prints: [],
  reset() { this.hist = []; this.fires = []; this.prints = []; this.watcher = null; this.watchT = 200; this.fireT = 30; this.sinkT = 0; P.z = 0; P.vz = 0; P.ivx = 0; P.ivy = 0; P.veh = null; },
  update(dt) {
    const W = World;
    // time-loop history
    this.histT -= dt; if (this.histT <= 0) { this.histT = 0.25; this.hist.push({ x: P.x, y: P.y, hp: P.hp }); if (this.hist.length > 14) this.hist.shift(); }
    // player jump physics (geysers)
    if (P.z > 0 || P.vz > 0) { P.z += P.vz * dt; P.vz -= 900 * dt; if (P.z <= 0) { P.z = 0; P.vz = 0; shake(5); burst(P.x, P.y, 10, '160,150,130', 120); } }
    P.scanT = (P.scanT || 0) - dt; P.flipT = (P.flipT || 0) - dt; P.muffleT = (P.muffleT || 0) - dt;
    if (Sfx.master) Sfx.master.gain.value = (Sfx.muted ? 0 : Sfx.vol.master * 0.4) * (P.muffleT > 0 ? 0.35 : 1);
    if (W.kind !== 'over') return;
    // water & bog
    const wet = W.isWater(P.x, P.y) && !P.veh;
    P.inWater = wet;
    if (wet) {
      P.slowNext = Math.max(P.slowNext, 0.15);
      if (!P.moving) { this.sinkT += dt; if (this.sinkT > 1.5) { P.slowNext = Math.max(P.slowNext, 0.6); P.bogAcc = (P.bogAcc || 0) + 6 * dt; if (P.bogAcc > 4) { hurtPlayer(P.bogAcc, 'the bog', true); P.bogAcc = 0; text(P.x, P.y - 60, 'SINKING! MOVE!', '#8cf', false, true); } } }
      else this.sinkT = Math.max(0, this.sinkT - dt * 2);
      if (Math.random() < dt * 6) part(P.x + rand(-10, 10), P.y, { z: 0, vz: 30, g: 60, c: '150,200,220', s: 2.5, life: 0.4 });
    } else this.sinkT = 0;
    // spores
    for (const s of W.spores) {
      if (Math.abs(s.x - P.x) > 1400 || Math.abs(s.y - P.y) > 1100) continue;
      if (dist2(s.x, s.y, P.x, P.y) < s.r * s.r) { P.sporeAcc = (P.sporeAcc || 0) + 2 * dt; if (P.sporeAcc > 4) { hurtPlayer(P.sporeAcc, 'spores', true, 'anomaly'); P.sporeAcc = 0; } }
      EG.query(s.x, s.y, s.r, TMP3);
      for (const e of TMP3) { const d = dist(s.x, s.y, e.x, e.y); if (d < s.r && !e.boss && !e.d.fly) { e.x += ((e.x - s.x) / (d || 1)) * 90 * dt; e.y += ((e.y - s.y) / (d || 1)) * 90 * dt; e.sporeAcc = (e.sporeAcc || 0) + 15 * dt; if (e.sporeAcc > 8) { hurtEnemy(e, e.sporeAcc, 0, 0, true); e.sporeAcc = 0; } } }
    }
    // crystals grow; stand next to one to harvest
    for (const c of W.crystals) {
      c.g = Math.min(1.6, c.g + dt / 120);
      if (dist2(c.x, c.y, P.x, P.y) < 70 * 70 && c.g > 0.3) {
        c.hold += dt;
        if (c.hold > 1.5) { const v = Math.round(c.g * 10); for (let i = 0; i < v; i++) dropGem(c.x + rand(-40, 40), c.y + rand(-30, 30), 3 + Math.floor(G.t / 60)); G.rubles += v * 3; text(c.x, c.y - 70, '+' + v * 3 + ' ₽', '#ffcf6a', true, true); c.g = 0.05; c.hold = 0; Sfx.play('artifact'); }
      } else c.hold = 0;
    }
    // attic ladders
    for (const a of W.attics) {
      if (a.looted) continue;
      if (dist2(a.x, a.y, P.x, P.y) < 30 * 30) {
        a.hold += dt;
        if (a.hold > 1) { a.looted = true; giveItem(pick(Object.keys(ITEMS))); for (let i = 0; i < 5; i++) dropGem(a.x, a.y, 3 + Math.floor(G.t / 60)); if (Math.random() < 0.25) G.pickups.push({ type: 'art', x: a.x, y: a.y + 20, t: 0 }); banner('ATTIC STASH', 'Someone hid supplies up here.', 2, 'good'); Sfx.play('stash'); }
      } else a.hold = 0;
    }
    // tornados wander and roam toward the player occasionally
    for (const t of W.tornados) {
      const far = dist2(t.x, t.y, P.x, P.y) > 2600 * 2600;
      t.a += rand(-0.5, 0.5) * dt; const sp = far ? 260 : 90;
      if (far && Math.random() < dt * 0.2) t.a = Math.atan2(P.y - t.y, P.x - t.x) + rand(-0.8, 0.8);
      t.x = clamp(t.x + Math.cos(t.a) * sp * dt, 300, WORLD - 300); t.y = clamp(t.y + Math.sin(t.a) * sp * dt, 300, WORLD - 300);
      if (Math.abs(t.x - P.x) > 1200 || Math.abs(t.y - P.y) > 1000) continue;
      const pull = (o, str, isP) => { const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1; if (d > t.r) return; const f = (1 - d / t.r) * str; o.x += (dx / d) * f * dt - (dy / d) * f * dt; o.y += (dy / d) * f * dt + (dx / d) * f * dt; if (d < 40) { if (isP) { if (!(P.tornT > G.t)) { P.tornT = G.t + 1.2; hurtPlayer(12, 'a tornado', false, 'anomaly'); P.vz = 520; const a = rand(TAU); P.kvx = Math.cos(a) * 600; P.kvy = Math.sin(a) * 600; } } else { hurtEnemy(o, 30 * dt * 10, 0, 0, true); o.vz = 300; } } };
      if (P.dashT <= 0) pull(P, 170, true);
      EG.query(t.x, t.y, t.r, TMP3); for (const e of TMP3) if (!e.boss) pull(e, 420, false);
      if (Math.random() < 0.8) part(t.x + rand(-40, 40), t.y, { z: rand(0, 80), vz: rand(80, 200), vx: rand(-80, 80), g: -40, c: '120,110,90', s: rand(2, 5), life: 0.8 });
    }
    // wildfires spread in the Red Forest
    this.fireT -= dt;
    const reg = W.region(P.x, P.y);
    if (this.fireT <= 0) { this.fireT = rand(50, 80); if (reg.red && this.fires.length < 5) { const a = rand(TAU); this.fires.push({ x: P.x + Math.cos(a) * 500, y: P.y + Math.sin(a) * 400, life: 12, spread: 1.5 }); banner('🔥 WILDFIRE', 'The Red Forest is burning. Stay clear of the flames!', 2.5, 'bad'); } }
    for (const f of this.fires) {
      f.life -= dt; f.spread -= dt;
      if (f.spread <= 0 && this.fires.length < 40) { f.spread = rand(1.2, 2.2); const a = rand(TAU), nx = f.x + Math.cos(a) * 110, ny = f.y + Math.sin(a) * 80; if (W.region(nx, ny).red || W.region(nx, ny).trees > 0.3) this.fires.push({ x: nx, y: ny, life: rand(8, 14), spread: rand(1.2, 2.2) }); }
      if (dist2(f.x, f.y, P.x, P.y) < 55 * 55 && P.z <= 0) { P.fireAcc = (P.fireAcc || 0) + 16 * dt; if (P.fireAcc > 5) { hurtPlayer(P.fireAcc, 'a wildfire', true, 'anomaly'); P.fireAcc = 0; } }
      EG.query(f.x, f.y, 60, TMP3); for (const e of TMP3) if (dist2(f.x, f.y, e.x, e.y) < 55 * 55) { e.burnT = 2; e.burnDps = Math.max(e.burnDps, 12); }
      if (Math.random() < 0.5) part(f.x + rand(-25, 25), f.y, { z: rand(0, 30), vz: rand(100, 200), g: -40, c: '255,140,40', add: true, s: rand(3, 6), life: 0.6 });
    }
    this.fires = this.fires.filter((f) => f.life > 0);
    // the Watcher: a slow psi presence that follows you for a while
    this.watchT -= dt;
    if (!this.watcher && this.watchT <= 0 && G.t > 300 && !(G.em && G.em.phase !== 'after')) {
      this.watchT = rand(200, 320); const a = rand(TAU); this.watcher = { x: P.x + Math.cos(a) * 700, y: P.y + Math.sin(a) * 500, life: 60 };
      banner('👁️ THE WATCHER', 'Something follows you. Keep moving.', 2.5, 'bad');
    }
    if (this.watcher) {
      const w = this.watcher, d = dist(w.x, w.y, P.x, P.y); w.life -= dt;
      w.x += ((P.x - w.x) / (d || 1)) * 55 * dt; w.y += ((P.y - w.y) / (d || 1)) * 55 * dt;
      if (d < 100 && !P.psiImmune) { G.psi = Math.max(G.psi, 0.7); P.wAcc = (P.wAcc || 0) + 10 * dt; if (P.wAcc > 5) { hurtPlayer(P.wAcc, 'the Watcher', true); P.wAcc = 0; } }
      if (w.life <= 0) this.watcher = null;
    }
    // emission sinkholes
    if (G.em && G.em.phase === 'blast' && Math.random() < dt * 1.2) {
      const x = P.x + rand(-300, 300), y = P.y + rand(-220, 220);
      G.fx.push({ k: 'target', x, y, r: 70, life: 0.9, max: 0.9 });
      G.timers.push({ t: 0.9, fn: () => { patch(x, y, 'web', 70, 5); if (dist2(x, y, P.x, P.y) < 70 * 70) hurtPlayer(15, 'a sinkhole', false, 'anomaly'); burst(x, y, 20, '90,70,50', 200, { s: 5 }); } });
    }
    // weather effects
    const wx = Env.weather;
    if (wx === 'radstorm' && !inShelter(P.x, P.y)) { P.rsAcc = (P.rsAcc || 0) + 1.6 * dt; if (P.rsAcc > 4) { hurtPlayer(P.rsAcc, 'the radiation storm', true, 'rad'); P.rsAcc = 0; } if (Math.random() < 0.3) Sfx.play('geiger'); }
    if (wx === 'snow') { P.slowNext = Math.max(P.slowNext, 0.12); this.footT -= dt; if (P.moving && this.footT <= 0) { this.footT = 0.18; this.prints.push({ x: P.x + (this.prints.length % 2 ? 5 : -5), y: P.y, life: 12 }); if (this.prints.length > 80) this.prints.shift(); } }
    for (const p of this.prints) p.life -= dt;
  },
  // new anomaly behaviours (called from updateAnomalies)
  anomaly(a, dt, pd, pin) {
    switch (a.type) {
      case 'geyser':
        if (a.cd <= 0 && pin && P.z <= 0) { a.cd = 2.5; a.act = 0.5; P.vz = 620; P.kvx = rand(-300, 300); P.kvy = rand(-300, 300); hurtPlayer(8, 'a Geyser', false, 'anomaly'); Sfx.play('spring'); burst(a.x, a.y, 30, '220,240,255', 260, { add: true }); }
        for (const e of TMP2) if (!e.boss && dist2(a.x, a.y, e.x, e.y) < a.r * a.r && a.cd <= 0) { a.cd = 2.5; a.act = 0.5; e.vz = 500; hurtEnemy(e, 40, rand(-500, 500), rand(-500, 500), true); }
        break;
      case 'mirror':
        if (a.cd <= 0 && pin) {
          a.cd = 20; a.act = 0.6; Sfx.play('psi');
          for (let i = 0; i < 2; i++) { const e = spawnEnemy('mirror', a.x + rand(-60, 60), a.y + rand(-40, 40), { noElite: true }); e.life = 15; }
          banner('MIRROR ANOMALY', 'Your reflections are hunting you!', 2, 'bad');
        }
        break;
      case 'sound':
        if (pd < a.r) { P.muffleT = 0.3; if (!P.psiImmune) { P.sndAcc = (P.sndAcc || 0) + 4 * dt; if (P.sndAcc > 4) { hurtPlayer(P.sndAcc, 'a Sound anomaly', true, 'anomaly'); P.sndAcc = 0; } } if (Math.random() < dt * 2) Sfx.tone(3200, 0.4, 'sine', 0.01, 0, 0, Sfx.amb); }
        break;
      case 'magnet':
        for (const b of G.bullets) { const dx = b.x - a.x, dy = b.y + 20 - a.y, d2 = dx * dx + dy * dy; if (d2 < a.r * a.r) { const d = Math.sqrt(d2) || 1, f = (1 - d / a.r) * 1400 * dt; b.vx += (-dy / d) * f; b.vy += (dx / d) * f; } }
        for (const b of G.ebullets) { const dx = b.x - a.x, dy = b.y + 20 - a.y, d2 = dx * dx + dy * dy; if (d2 < a.r * a.r) { const d = Math.sqrt(d2) || 1, f = (1 - d / a.r) * 1400 * dt; b.vx += (-dy / d) * f; b.vy += (dx / d) * f; } }
        break;
      case 'timeloop':
        if (a.cd <= 0 && pin && this.hist.length > 10) {
          a.cd = 10; a.act = 0.8; const h = this.hist[0];
          burst(P.x, P.y - 20, 24, '255,200,240', 200, { add: true });
          P.x = h.x; P.y = h.y; P.hp = Math.max(P.hp, h.hp); CAM.x = P.x; CAM.y = P.y;
          burst(P.x, P.y - 20, 24, '255,200,240', 200, { add: true });
          banner('TIME LOOP', 'You were rewound 3 seconds.', 1.8, 'art'); Sfx.play('ability');
        }
        break;
      case 'flip':
        if (pd < a.r) P.flipT = 0.3;
        break;
    }
  },
};
ENEMIES.mirror = { name: 'Reflection', hp: 60, spd: 120, dmg: 10, r: 13, xp: 4, mass: 1 };
ENEMY_DRAW.mirror = (e) => { ctx.save(); ctx.globalAlpha = 0.7; drawStalker(e, { ...P.pal, arms: Math.atan2(P.y - e.y, P.x - e.x) }, false); ctx.restore(); };
const _aiExtra3 = aiExtra;
aiExtra = function (e, dt, d, ux, uy, sp, dx, dy) {
  if (e.id === 'mirror') {
    e.life = (e.life ?? 15) - dt; if (e.life <= 0) { e.dead = true; burst(e.x, e.y - 20, 12, '230,230,255', 140, { add: true }); return [0, 0]; }
    if (e.cd <= 0 && d < 480) { e.cd = rand(1, 1.6); enemyShoot(e, Math.atan2(dy, dx), 420, e.dmg, 'bullet', 4, true); Sfx.play('pistol'); }
    if (d < 260) return [-uy * sp, ux * sp];
    return null;
  }
  return _aiExtra3(e, dt, d, ux, uy, sp, dx, dy);
};

// ---------- vehicles ----------
const VEH = { bike: { name: 'Dirt Bike', spd: 2.1, ram: 30, icon: '🏍️' }, jeep: { name: 'UAZ Jeep', spd: 1.75, ram: 60, icon: '🚙', fuel: true, dr: 0.3 } };
function nearVehicle() { if (World.kind !== 'over') return null; let b = null; for (const v of World.vehicles) if (dist2(v.x, v.y, P.x, P.y) < 60 * 60) b = v; return b; }
function toggleVehicle() {
  if (!G || G.state !== 'play') return;
  if (P.veh) { const v = P.veh; P.veh = null; v.x = P.x + 30; v.y = P.y + 10; banner('DISMOUNTED', '', 1, ''); return; }
  const v = nearVehicle(); if (!v) return;
  if (VEH[v.kind].fuel && v.fuel <= 0) { banner('OUT OF FUEL', 'Find a fuel can (supply crates).', 1.8, 'bad'); return; }
  P.veh = v; banner(VEH[v.kind].icon + ' ' + VEH[v.kind].name.toUpperCase(), 'Press F (or the vehicle button) to get off. Ram mutants!', 2, 'good'); Sfx.play('dash');
}
function vehicleUpdate(dt) {
  const v = P.veh; if (!v) return 1;
  const V = VEH[v.kind];
  if (P.moving) v.a = Math.atan2(P.lastMy, P.lastMx);
  v.x = P.x; v.y = P.y;
  if (V.fuel && P.moving) { v.fuel -= dt * 0.9; if (v.fuel <= 0) { v.fuel = 0; toggleVehicle(); banner('OUT OF FUEL', '', 1.5, 'bad'); return 1; } }
  if (P.moving) { EG.query(P.x, P.y, 40, TMP3); for (const e of TMP3) if (!e.dead && dist2(e.x, e.y, P.x, P.y) < (e.r + 22) ** 2 && !(e.ramT > G.t)) { e.ramT = G.t + 0.5; hurtEnemy(e, V.ram * (1 + G.t / 400), P.lastMx * 500, P.lastMy * 500); Sfx.play('stomp'); } }
  if (Math.random() < 0.5) part(P.x - P.lastMx * 20, P.y, { z: 4, vz: 20, g: 0, c: '120,110,90', s: 4, life: 0.4 });
  return V.spd;
}

// ---------- bolt throwing (reveals hidden anomalies) ----------
function throwBolt() {
  if (!G || G.state !== 'play' || (P.boltT || 0) > G.t) return;
  P.boltT = G.t + 0.6;
  let dx = P.lastMx, dy = P.lastMy; if (!dx && !dy) dx = P.face;
  const l = Math.hypot(dx, dy) || 1;
  G.throws.push({ x0: P.x, y0: P.y - 20, x1: P.x + (dx / l) * 230, y1: P.y + (dy / l) * 230, t: 0, T: 0.5, dmg: 0, r: 0, k: 'reveal' });
  Sfx.play('throw');
}
function revealAt(x, y, r) {
  for (const a of World.anomalies) if (a.hidden && dist2(a.x, a.y, x, y) < (a.r + r) ** 2) { a.hidden = false; burst(a.x, a.y - 10, 20, '255,255,200', 180, { add: true }); text(a.x, a.y - 40, ANOMALIES[a.type].name + '!', '#ffe070', true, true); a.cd = 0; }
}

// ---------- drawing ----------
function drawHazardsGround(x0, y0, x1, y1) {
  const W = World; if (W.kind !== 'over') return;
  for (const s of W.spores || []) {
    if (s.x < x0 - s.r || s.x > x1 + s.r || s.y < y0 - s.r || s.y > y1 + s.r) continue;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); g.addColorStop(0, 'rgba(160,200,80,0.28)'); g.addColorStop(1, 'rgba(160,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 9; i++) { const a = i * 2.4 + s.seed, d = s.r * (0.2 + ((i * 37) % 10) / 14), mx = s.x + Math.cos(a) * d, my = s.y + Math.sin(a) * d * 0.55;
      ctx.fillStyle = '#d8d0b0'; ctx.fillRect(mx - 1.5, my - 8, 3, 8); ctx.fillStyle = i % 2 ? '#c84a3a' : '#b8a060'; ctx.beginPath(); ctx.ellipse(mx, my - 8, 6, 3.5, 0, Math.PI, TAU); ctx.fill(); }
    if (Math.random() < 0.2) part(s.x + rand(-s.r, s.r) * 0.7, s.y + rand(-s.r, s.r) * 0.4, { z: 4, vz: 20, g: -5, c: '200,230,120', add: true, s: 2, life: 1.2 });
  }
  for (const a of W.anomalies) if (a.type === 'cryo' && a.x > x0 - 200 && a.x < x1 + 200 && a.y > y0 - 200 && a.y < y1 + 200) {
    ctx.fillStyle = 'rgba(200,235,255,0.25)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * 1.8, a.r * 1.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x - a.r, a.y - 5); ctx.lineTo(a.x - a.r * 0.3, a.y + 8); ctx.moveTo(a.x + a.r * 0.4, a.y - 12); ctx.lineTo(a.x + a.r * 1.2, a.y + 4); ctx.stroke();
  }
  for (const p of Hz.prints) if (p.life > 0) { ctx.fillStyle = `rgba(230,235,245,${Math.min(0.5, p.life / 8)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 3, 5, 0, 0, TAU); ctx.fill(); }
  for (const f of Hz.fires) { const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 60); g.addColorStop(0, 'rgba(255,160,40,0.55)'); g.addColorStop(1, 'rgba(120,20,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, 60, 36, 0, 0, TAU); ctx.fill(); }
  for (const a of W.attics || []) {
    if (a.looted || a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1 + 100) continue;
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x - 8, a.y); ctx.lineTo(a.x - 8, a.y - 70); ctx.moveTo(a.x + 8, a.y); ctx.lineTo(a.x + 8, a.y - 70); ctx.stroke();
    ctx.lineWidth = 2; for (let k = 10; k < 70; k += 12) { ctx.beginPath(); ctx.moveTo(a.x - 8, a.y - k); ctx.lineTo(a.x + 8, a.y - k); ctx.stroke(); }
    if (a.hold > 0) { ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, a.y - 90, 12, -Math.PI / 2, -Math.PI / 2 + TAU * a.hold); ctx.stroke(); }
  }
}
function drawHazardsTop(x0, y0, x1, y1) {
  const W = World; if (W.kind !== 'over') return;
  for (const c of W.crystals || []) {
    if (c.x < x0 - 80 || c.x > x1 + 80 || c.y < y0 - 80 || c.y > y1 + 120) continue;
    const s = 0.5 + c.g * 0.6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y - 30 * s, 0, c.x, c.y - 30 * s, 70 * s); g.addColorStop(0, 'rgba(120,255,230,0.4)'); g.addColorStop(1, 'rgba(60,160,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y - 30 * s, 70 * s, 0, TAU); ctx.fill(); ctx.restore();
    for (const [dx, h, w] of [[-14, 40, 9], [12, 34, 8], [0, 56, 11], [-26, 24, 6], [24, 22, 6]]) { ctx.fillStyle = '#7ff0e0'; artPath(ctx, [c.x + dx * s - w * s, c.y, c.x + dx * s, c.y - h * s, c.x + dx * s + w * s, c.y]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; artPath(ctx, [c.x + dx * s, c.y, c.x + dx * s, c.y - h * s, c.x + dx * s + w * s, c.y]); ctx.fill(); }
    if (c.hold > 0) { ctx.strokeStyle = '#7ff0e0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y - 80, 12, -Math.PI / 2, -Math.PI / 2 + TAU * (c.hold / 1.5)); ctx.stroke(); }
  }
  for (const v of W.vehicles || []) {
    if (v === P.veh || v.x < x0 - 60 || v.x > x1 + 60 || v.y < y0 - 60 || v.y > y1 + 60) continue;
    drawVehicle(v, v.x, v.y);
  }
  for (const t of W.tornados || []) {
    if (t.x < x0 - 200 || t.x > x1 + 200 || t.y < y0 - 300 || t.y > y1 + 200) continue;
    for (let i = 0; i < 9; i++) { const h = i * 22, w = 18 + i * 9, sw = Math.sin(NOW * 3 + i * 0.6 + t.seed) * 10; ctx.strokeStyle = `rgba(150,140,120,${0.5 - i * 0.03})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(t.x + sw, t.y - h, w, w * 0.3, 0, NOW * 6 + i, NOW * 6 + i + 4); ctx.stroke(); }
  }
  if (Hz.watcher) { const w = Hz.watcher; ctx.save(); ctx.globalAlpha = 0.7; drawEye({ x: w.x, y: w.y, z: 40 + Math.sin(NOW * 2) * 8 }); ctx.restore(); ctx.strokeStyle = 'rgba(200,60,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w.x, w.y, 100, 62, 0, 0, TAU); ctx.stroke(); }
}
function drawVehicle(v, x, y) {
  const fx = Math.cos(v.a) >= 0 ? 1 : -1;
  shadow(x, y + 2, v.kind === 'jeep' ? 42 : 24, 8, 0.3);
  ctx.save(); ctx.translate(x, y); ctx.scale(fx, 1);
  if (v.kind === 'bike') {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-14, -7, 7, 0, TAU); ctx.arc(14, -7, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-14, -7, 4, 0, TAU); ctx.moveTo(18, -7); ctx.arc(14, -7, 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#b8342a'; ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(8, -16); ctx.lineTo(12, -10); ctx.lineTo(-6, -8); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(14, -24); ctx.stroke();
  } else {
    ctx.fillStyle = '#4e5a3a'; ctx.fillRect(-36, -30, 72, 22); ctx.fillStyle = '#5e6a44'; ctx.fillRect(-26, -44, 42, 16);
    ctx.fillStyle = '#20262a'; ctx.fillRect(-20, -41, 14, 10); ctx.fillRect(-2, -41, 14, 10);
    ctx.fillStyle = '#111'; for (const wx of [-24, 24]) { ctx.beginPath(); ctx.arc(wx, -8, 8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffe070'; ctx.fillRect(33, -26, 4, 5);
  }
  ctx.restore();
  if (v !== P.veh && VEH[v.kind].fuel) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 20, y + 6, 40, 4); ctx.fillStyle = '#ffcf6a'; ctx.fillRect(x - 20, y + 6, 40 * v.fuel / 100, 4); }
}
// anomaly visuals for the phase 4 types
function drawAnomaly4(a, top) {
  const t = NOW + a.seed, r = a.r;
  if (!top) {
    const c = ANOMALIES[a.type].color;
    ctx.strokeStyle = c + '55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.stroke();
    if (a.type === 'geyser') { ctx.fillStyle = 'rgba(120,110,90,0.5)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 20, 10, 0, 0, TAU); ctx.fill(); }
    if (a.type === 'timeloop') { ctx.strokeStyle = 'rgba(255,200,240,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y - 4, 16, 0, TAU); ctx.moveTo(a.x, a.y - 4); ctx.lineTo(a.x + Math.cos(-t * 3) * 12, a.y - 4 + Math.sin(-t * 3) * 12); ctx.stroke(); }
    if (a.type === 'flip') { ctx.fillStyle = 'rgba(190,150,255,0.12)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill(); }
    if (a.type === 'sound') for (let i = 0; i < 3; i++) { const rr = ((t * 40 + i * r / 3) % r); ctx.strokeStyle = `rgba(255,224,160,${0.3 - rr / r * 0.3})`; ctx.beginPath(); ctx.ellipse(a.x, a.y, rr, rr * 0.6, 0, 0, TAU); ctx.stroke(); }
    if (a.type === 'magnet') { ctx.strokeStyle = 'rgba(150,180,255,0.25)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(a.x, a.y, r * (0.3 + i * 0.2), r * (0.3 + i * 0.2) * 0.6, 0, t + i, t + i + 2); ctx.stroke(); } }
    return;
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (a.type === 'geyser') { if (a.act > 0) { ctx.fillStyle = `rgba(220,240,255,${a.act})`; ctx.fillRect(a.x - 14, a.y - 180 * a.act * 2, 28, 180 * a.act * 2); } else if (Math.random() < 0.2) part(a.x, a.y, { z: 2, vz: 120, g: 200, c: '230,240,255', s: 3, life: 0.6 }); }
  if (a.type === 'mirror') { ctx.fillStyle = `rgba(230,230,255,${0.25 + Math.sin(t * 3) * 0.1})`; ctx.beginPath(); ctx.ellipse(a.x, a.y - 30, 14, 30, 0, 0, TAU); ctx.fill(); }
  if (a.type === 'timeloop' && a.act > 0) { ctx.fillStyle = `rgba(255,200,240,${a.act * 0.5})`; ctx.beginPath(); ctx.arc(a.x, a.y - 10, 60 * (1 - a.act) + 20, 0, TAU); ctx.fill(); }
  ctx.restore();
}
