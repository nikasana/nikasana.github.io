'use strict';
// ---------- core ----------
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, ZOOM = 1, NOW = 0;
const CAM = { x: START.x, y: START.y };
let G = null, P = null;
const keys = {};
const $ = (id) => document.getElementById(id);

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = innerWidth; VH = innerHeight;
  cv.width = Math.floor(VW * DPR); cv.height = Math.floor(VH * DPR);
  ZOOM = clamp(Math.min(VW, VH) / 720, 0.55, 1.2);
}
addEventListener('resize', resize);

// spatial hash for enemies
const EG = {
  n: WORLD / 64, cells: [], used: [],
  init() { for (let i = 0; i < this.n * this.n; i++) this.cells.push([]); },
  clear() { for (const i of this.used) this.cells[i].length = 0; this.used.length = 0; },
  add(e) {
    const i = clamp(Math.floor(e.y / 64), 0, this.n - 1) * this.n + clamp(Math.floor(e.x / 64), 0, this.n - 1);
    const c = this.cells[i]; if (!c.length) this.used.push(i); c.push(e);
  },
  query(x, y, r, out) {
    out.length = 0; const n = this.n;
    const x0 = clamp(Math.floor((x - r) / 64), 0, n - 1), x1 = clamp(Math.floor((x + r) / 64), 0, n - 1);
    const y0 = clamp(Math.floor((y - r) / 64), 0, n - 1), y1 = clamp(Math.floor((y + r) / 64), 0, n - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const c = this.cells[cy * n + cx]; for (let i = 0; i < c.length; i++) out.push(c[i]); }
    return out;
  },
};
const TMP = [], TMP2 = [];

const xpNeed = (l) => Math.floor(5 + l * 5 + Math.pow(l, 1.75));

function newGame() {
  G = {
    t: 0, state: 'play', kills: 0, level: 1, xp: 0, xpNeed: xpNeed(1), pendingLv: 0,
    enemies: [], bullets: [], ebullets: [], gems: [], pickups: [], particles: [], texts: [], decals: [], fx: [], throws: [],
    bosses: [], bossIdx: 0, spawnAcc: 0, rushT: 80, emIdx: 0, em: null, shake: 0, flash: 0, flashCol: '255,255,255', psi: 0,
    zone: '', arts: 0, dmg: 0, crates: [], lightT: 0, auraT: 0, detT: 0, won: false, bannerT: 0, regionT: 0, geigerT: 0,
  };
  P = {
    x: START.x, y: START.y, z: 0, r: 13, hp: 120, maxhp: 120, face: 1, aim: 0, anim: 0, moving: false, inv: 0, muzzle: 0,
    dashCd: 0, dashT: 0, dashVx: 0, dashVy: 0, lastMx: 0, lastMy: 1, kvx: 0, kvy: 0, slow: 0, slowNext: 0,
    dmgMul: 1, rateMul: 1, areaMul: 1, spdMul: 1, pickup: 85, xpMul: 1, dr: 0, regen: 0, pierce: 0,
    shards: 0, lightning: 0, aura: 0, soul: 0, soulAcc: 0,
    weapons: [{ id: 'pistol', lv: 1, cd: 0.5 }], perks: {}, arts: {},
  };
  for (const f of World.fields) spawnArtifact(f);
  G.crates = World.crateSpots.map((s) => ({ x: s.x, y: s.y, open: 0 }));
  for (const a of World.anomalies) { a.cd = Math.random() * 2; a.act = 0; }
  CAM.x = P.x; CAM.y = P.y;
  hudBuild();
  banner('WELCOME TO THE ZONE', 'Survive. Hunt artifacts inside anomalies. Reach 15:00 and destroy the Monolith.', 6);
}
function spawnArtifact(f) {
  const a = pick(f.anoms), an = Math.random() * TAU, d = a.r * 0.45 * Math.random();
  f.art = { x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d, type: pick(ANOM_ARTS[f.type]), t: Math.random() * 10 };
}

// ---------- helpers: fx ----------
function part(x, y, o) {
  if (G.particles.length > 1400) return;
  G.particles.push({ x, y, z: o.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g ?? 400, life: o.life || 0.6, max: o.life || 0.6, s: o.s || 3, c: o.c || '255,255,255', add: !!o.add, drag: o.drag ?? 1 });
}
function burst(x, y, n, c, spd = 160, o = {}) {
  for (let i = 0; i < n; i++) { const a = rand(TAU), s = rand(spd * 0.3, spd); part(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(50, 220), z: o.z ?? 10, c, s: rand(1.5, o.s || 3.5), life: rand(0.3, o.life || 0.8), add: o.add, g: o.g }); }
}
function text(x, y, s, c = '#fff', big = false) {
  if (G.texts.length > 70) G.texts.shift();
  G.texts.push({ x: x + rand(-8, 8), y, s, c, life: 0.8, big });
}
function decal(x, y, r, c) {
  if (G.decals.length > 160) G.decals.shift();
  G.decals.push({ x, y, r, c, a: rand(TAU), life: 40 });
}
function shake(v) { G.shake = Math.min(24, G.shake + v); }
function flash(v, c = '255,255,255') { G.flash = Math.max(G.flash, v); G.flashCol = c; }
let bannerTimer = 0;
function banner(title, sub, t = 3.5, cls = '') {
  const b = $('banner'); b.className = 'show ' + cls; $('bTitle').textContent = title; $('bSub').textContent = sub || ''; bannerTimer = t;
}

// ---------- damage ----------
function hurtEnemy(e, dmg, kx = 0, ky = 0, raw = false) {
  if (e.dead) return;
  let crit = false;
  if (!raw) { dmg *= P.dmgMul; if (Math.random() < 0.07) { crit = true; dmg *= 2; } }
  if (e.shield > 0) dmg *= 0.15;
  e.hp -= dmg; e.flash = 0.09; G.dmg += dmg;
  const m = e.d.mass; e.kvx += kx / m; e.kvy += ky / m;
  if (e.id === 'bloodsucker') e.reveal = 1.2;
  if (dmg >= 1) text(e.x, e.y - e.r * 2 - e.z - 10, Math.round(dmg), crit ? '#ffd23a' : raw ? '#9fd4ff' : '#fff', crit);
  Sfx.play('hit');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; G.kills++;
  const xp = e.d.xp;
  if (e.d.boss) {
    for (let i = 0; i < 40; i++) dropGem(e.x + rand(-60, 60), e.y + rand(-60, 60), Math.ceil(xp / 40) + 2);
    if (e.id !== 'monolith') G.pickups.push({ type: 'stash', x: e.x, y: e.y, t: 0 });
    burst(e.x, e.y, 70, '200,40,30', 380, { s: 6, life: 1.4 });
    shake(20); flash(0.5, '255,200,160'); Sfx.play('boom');
    for (let i = 0; i < 6; i++) decal(e.x + rand(-50, 50), e.y + rand(-30, 30), rand(20, 40), '90,10,10');
    if (e.id === 'monolith') winGame();
    else banner(e.d.name + ' SLAIN', 'It dropped a boss stash — grab it!', 4, 'good');
  } else {
    dropGem(e.x, e.y, xp);
    if (Math.random() < 0.012) G.pickups.push({ type: 'med', x: e.x, y: e.y, t: 0 });
    else if (Math.random() < 0.003) G.pickups.push({ type: 'magnet', x: e.x, y: e.y, t: 0 });
    const bc = e.id === 'poltergeist' ? '255,170,70' : e.id === 'controller' ? '170,120,200' : '140,20,20';
    burst(e.x, e.y - e.z, 10, bc, 180, { add: e.id === 'poltergeist' });
    if (e.id !== 'poltergeist') decal(e.x, e.y, e.r * rand(0.8, 1.3), '80,12,10');
    Sfx.play('kill');
  }
  if (P.soul) { P.soulAcc += P.soul / 3; if (P.soulAcc >= 1) { const h = Math.floor(P.soulAcc); P.soulAcc -= h; P.hp = Math.min(P.maxhp, P.hp + h); } }
}
function dropGem(x, y, v) {
  if (G.gems.length > 450) { const g = G.gems[(Math.random() * G.gems.length) | 0]; g.v += v; return; }
  G.gems.push({ x, y, v, z: 8, vz: rand(120, 200), vx: rand(-40, 40), vy: rand(-30, 30), mag: false });
}
function hurtPlayer(d, src, ignoreInv = false) {
  if (G.state !== 'play') return;
  if (!ignoreInv && (P.inv > 0 || P.dashT > 0)) return;
  d *= 1 - Math.min(0.75, P.dr);
  P.hp -= d;
  if (!ignoreInv) P.inv = 0.6;
  text(P.x, P.y - 50, '-' + Math.round(d), '#ff5a4a');
  shake(ignoreInv ? 2 : 6); flash(ignoreInv ? 0.08 : 0.25, '255,30,20'); Sfx.play('hurt');
  if (P.hp <= 0) { P.hp = 0; gameOver(src); }
}
function explode(x, y, r, dmg, fromPlayer = true) {
  EG.query(x, y, r + 40, TMP);
  for (const e of TMP) { const d = dist(x, y, e.x, e.y); if (d < r + e.r) hurtEnemy(e, dmg, ((e.x - x) / (d || 1)) * 300, ((e.y - y) / (d || 1)) * 300, !fromPlayer); }
  if (!fromPlayer && dist(x, y, P.x, P.y) < r + P.r) hurtPlayer(dmg * 0.6, 'explosion');
  G.fx.push({ k: 'boom', x, y, r, life: 0.45, max: 0.45 });
  burst(x, y, 26, '255,170,60', r * 3, { add: true, s: 4, life: 0.6 });
  for (let i = 0; i < 10; i++) part(x + rand(-r / 2, r / 2), y + rand(-r / 3, r / 3), { vz: rand(20, 60), z: 10, g: -30, c: '70,65,60', s: rand(8, 16), life: rand(0.8, 1.5) });
  decal(x, y, r * 0.6, '20,18,16');
  shake(8); Sfx.play('boom');
}

// ---------- enemies ----------
function spawnEnemy(id, x, y) {
  const d = ENEMIES[id], m = G.t / 60;
  const hpMul = d.boss ? 1 + Math.max(0, m - 3) * 0.08 : 1 + m * 0.2 + m * m * 0.01;
  const e = {
    id, d, x, y, z: 0, vz: 0, r: d.r, hp: d.hp * hpMul, maxhp: d.hp * hpMul, spd: d.spd * (d.boss ? 1 : 1 + Math.min(0.3, m * 0.018)),
    dmg: d.dmg * (d.boss ? 1 : 1 + m * 0.05), kvx: 0, kvy: 0, face: 1, aim: 0, anim: rand(10), flash: 0, t: 0, cd: rand(1, 3), cd2: rand(4, 8), state: 0, st: 0,
    seed: rand(100), alpha: 1, reveal: 0, vt: 0, shield: 0, cast: 0, slowT: 0, lx: x, ly: y, stuck: 0,
  };
  G.enemies.push(e);
  if (d.boss) G.bosses.push(e);
  return e;
}
function ringPos(extra = 0) {
  const R = Math.hypot(VW, VH) / 2 / ZOOM + 70 + extra;
  for (let i = 0; i < 12; i++) {
    const a = rand(TAU), x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R;
    if (World.free(x, y, 22)) return [x, y];
  }
  return null;
}
function spawnBoss(id) {
  const a = rand(TAU);
  let x = P.x + Math.cos(a) * 650, y = P.y + Math.sin(a) * 650;
  for (let i = 0; i < 20 && !World.free(x, y, 50); i++) { const b = rand(TAU); x = P.x + Math.cos(b) * 650; y = P.y + Math.sin(b) * 650; }
  x = clamp(x, 100, WORLD - 100); y = clamp(y, 100, WORLD - 100);
  const e = spawnEnemy(id, x, y);
  banner('⚠ ' + ENEMIES[id].name + ' ⚠', id === 'monolith' ? 'The heart of the Zone awakens. Destroy it!' : 'A massive mutant is hunting you.', 4.5, 'bad');
  Sfx.play('boss'); shake(12);
  return e;
}
function director(dt) {
  const m = G.t / 60, reg = World.region(P.x, P.y);
  const cap = Math.min(330, 22 + m * 22);
  const rate = (0.6 + m * 0.6 + (m > 5 ? (m - 5) * 0.3 : 0)) * (0.75 + reg.danger * 0.13) * (G.em && G.em.phase === 'blast' ? 0 : 1);
  G.spawnAcc += rate * dt;
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length >= cap) break;
    const tab = spawnTable(m); let tot = 0; for (const k in tab) tot += tab[k];
    let r = rand(tot), id = 'dog'; for (const k in tab) { r -= tab[k]; if (r <= 0) { id = k; break; } }
    const p = ringPos(); if (!p) continue;
    const n = id === 'dog' ? randi(m < 1 ? 1 : 2, m < 3 ? 2 : 4) : 1;
    for (let i = 0; i < n; i++) spawnEnemy(id, p[0] + rand(-30, 30), p[1] + rand(-30, 30));
  }
  // mutant rush
  G.rushT -= dt;
  if (G.rushT <= 0 && !(G.em && G.em.phase !== 'after')) {
    G.rushT = 70;
    const n = Math.floor(12 + m * 3.5), R = Math.hypot(VW, VH) / 2 / ZOOM + 40;
    const kind = m > 6 ? 'snork' : 'dog';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R;
      if (World.free(x, y, 14)) spawnEnemy(i % 3 === 0 && m > 3 ? kind : 'dog', x, y);
    }
    banner('MUTANT RUSH!', 'They are coming from every direction.', 2.5, 'bad'); Sfx.play('roar');
  }
  // bosses
  if (G.bossIdx < BOSS_SCHEDULE.length && G.t >= BOSS_SCHEDULE[G.bossIdx].t) {
    const b = BOSS_SCHEDULE[G.bossIdx++];
    spawnBoss(b.id); if (b.extra) spawnBoss(b.extra);
  }
  // emissions
  if (G.emIdx < EMISSIONS.length && G.t >= EMISSIONS[G.emIdx]) {
    G.emIdx++; G.em = { phase: 'warn', t: 30 };
    banner('☢ EMISSION IMMINENT ☢', 'Get to a shelter (green bunker) within 30 seconds!', 5, 'bad');
    Sfx.play('siren');
  }
}
function inShelter(x, y) { for (const s of World.shelters) if (dist2(x, y, s.x, s.y) < s.r * s.r) return s; return null; }
function nearestShelter() { let b = null, bd = 1e12; for (const s of World.shelters) { const d = dist2(P.x, P.y, s.x, s.y); if (d < bd) { bd = d; b = s; } } return b; }
function updateEmission(dt) {
  const em = G.em; if (!em) return;
  em.t -= dt;
  if (em.phase === 'warn') {
    if (Math.floor(em.t) % 10 === 9 && Math.floor(em.t + dt) !== Math.floor(em.t)) Sfx.play('siren');
    if (Math.random() < dt * 0.6) { G.fx.push({ k: 'sky', x: P.x + rand(-500, 500), y: P.y + rand(-400, 300), life: 0.25, max: 0.25 }); Sfx.play('thunder'); }
    if (em.t <= 0) {
      em.phase = 'blast'; em.t = 8;
      Sfx.play('emission'); flash(1, '255,120,80'); shake(24);
      for (const e of G.enemies) if (!e.d.boss && !inShelter(e.x, e.y)) { burst(e.x, e.y, 6, '200,40,30', 120); killEnemy(e); }
      banner('EMISSION!', inShelter(P.x, P.y) ? 'Stay inside the shelter!' : 'YOU ARE EXPOSED — RUN TO SHELTER!', 3, 'bad');
    }
  } else if (em.phase === 'blast') {
    if (!inShelter(P.x, P.y)) {
      P.emAcc = (P.emAcc || 0) + 17 * dt; G.psi = Math.max(G.psi, 0.8);
      if (P.emAcc > 5) { hurtPlayer(P.emAcc, 'the Emission', true); P.emAcc = 0; }
    }
    if (Math.random() < dt * 5) { G.fx.push({ k: 'sky', x: P.x + rand(-600, 600), y: P.y + rand(-450, 350), life: 0.3, max: 0.3 }); Sfx.play('thunder'); shake(4); }
    if (em.t <= 0) {
      em.phase = 'after'; em.t = 3;
      for (const f of World.fields) spawnArtifact(f);
      banner('THE EMISSION IS OVER', 'New artifacts have been born inside the anomalies.', 5, 'good');
    }
  } else if (em.t <= 0) G.em = null;
}

function enemyShoot(e, a, spd, dmg, k, r = 6) {
  if (G.ebullets.length > 500) return;
  G.ebullets.push({ x: e.x, y: e.y - (e.d.fly ? 0 : 20), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, k, r, life: 4 });
}
function updateEnemies(dt) {
  EG.clear();
  for (const e of G.enemies) if (!e.dead) EG.add(e);
  const farR = Math.hypot(VW, VH) / 2 / ZOOM + 500;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash -= dt; e.cd -= dt; e.cd2 -= dt; e.cast -= dt; e.shield -= dt; e.reveal -= dt; e.slowT -= dt;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    let sp = e.spd * (e.slowT > 0 ? 0.55 : 1), vx = ux * sp, vy = uy * sp;
    // leash far enemies back
    if (!e.d.boss && d > farR) { const p = ringPos(); if (p) { e.x = p[0]; e.y = p[1]; } continue; }
    switch (e.id) {
      case 'dog': { const w = Math.sin(e.t * 5 + e.seed) * 0.45; vx += -uy * sp * w; vy += ux * sp * w; break; }
      case 'zombie':
        if (d < 380) { vx *= 0.35; vy *= 0.35; }
        if (e.cd <= 0 && d < 460) { e.cd = rand(2.4, 3.4); enemyShoot(e, Math.atan2(dy, dx) + rand(-0.1, 0.1), 300, e.dmg, 'bullet', 4); Sfx.play('pistol'); }
        break;
      case 'snork':
        if (e.state === 0 && d < 240 && e.cd <= 0) { e.state = 1; e.st = 0.35; }
        if (e.state === 1) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 2; e.st = 0.42; e.lvx = ux * 560; e.lvy = uy * 560; e.vz = 260; } }
        else if (e.state === 2) { vx = e.lvx; vy = e.lvy; e.st -= dt; if (e.st <= 0) { e.state = 0; e.cd = rand(2, 3); } }
        break;
      case 'bloodsucker': {
        const vis = d < 110 || e.reveal > 0 || e.flash > 0;
        e.alpha = lerp(e.alpha, vis ? 1 : 0.1, dt * 6);
        if (e.cd <= 0 && d < 280) { e.cd = rand(3, 5); e.st = 0.7; }
        if (e.st > 0) { e.st -= dt; vx *= 2.3; vy *= 2.3; }
        break;
      }
      case 'poltergeist': {
        e.z = 22 + Math.sin(e.t * 3) * 6;
        const orbit = d < 300 ? 1 : 0; vx = vx * (1 - orbit) + (-uy * sp) * orbit - ux * sp * 0.3 * orbit; vy = vy * (1 - orbit) + (ux * sp) * orbit - uy * sp * 0.3 * orbit;
        if (e.cd <= 0 && d < 520) { e.cd = rand(2, 2.8); enemyShoot(e, Math.atan2(dy, dx), 260, 12, 'fire', 8); }
        if (e.cd2 <= 0) { e.cd2 = rand(6, 9); burst(e.x, e.y - e.z, 14, '255,170,70', 120, { add: true }); const a = rand(TAU); const nx = P.x + Math.cos(a) * 240, ny = P.y + Math.sin(a) * 240; if (World.free(nx, ny, 10)) { e.x = nx; e.y = ny; } burst(e.x, e.y - e.z, 14, '255,170,70', 120, { add: true }); }
        break;
      }
      case 'controller':
        if (d < 300) { vx = -ux * sp * 0.6; vy = -uy * sp * 0.6; } else if (d < 420) { vx = vy = 0; }
        if (d < 480) { G.psi = Math.max(G.psi, (1 - d / 480) * 0.7); P.slowNext = Math.max(P.slowNext, 0.2 * (1 - d / 480)); }
        if (e.cd <= 0 && d < 560) { e.cd = rand(2.6, 3.4); e.cast = 0.5; enemyShoot(e, Math.atan2(dy, dx), 210, 16, 'psi', 11); Sfx.play('psi'); }
        break;
      case 'pseudogiant':
        if (e.state === 0 && e.cd <= 0 && d < 520) { e.state = 1; e.st = 0.85; }
        if (e.state === 1) {
          vx = vy = 0; e.st -= dt; e.z = (0.85 - e.st) * 45;
          if (e.st <= 0) { e.state = 0; e.z = 0; e.cd = rand(3, 4.2); G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 560, max: 460, dmg: e.dmg, hit: false, life: 1, maxl: 1 }); shake(16); Sfx.play('stomp'); burst(e.x, e.y, 30, '120,100,80', 300, { s: 5 }); decal(e.x, e.y, 60, '30,25,20'); }
        }
        break;
      case 'chimera':
        if (e.state === 0) { vx *= 1.1; vy *= 1.1; if (e.cd <= 0 && d < 620) { e.state = 1; e.st = 0.6; e.tx = P.x; e.ty = P.y; G.fx.push({ k: 'target', x: P.x, y: P.y, r: 110, life: 1.15, max: 1.15 }); Sfx.play('roar'); } }
        else if (e.state === 1) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 2; e.st = 0.55; e.sx = e.x; e.sy = e.y; } }
        else if (e.state === 2) {
          vx = vy = 0; e.st -= dt; const t = 1 - Math.max(0, e.st) / 0.55;
          e.x = lerp(e.sx, e.tx, t); e.y = lerp(e.sy, e.ty, t); e.z = Math.sin(t * Math.PI) * 140;
          if (e.st <= 0) {
            e.state = 0; e.z = 0; e.cd = rand(2, 2.8); shake(14); Sfx.play('stomp');
            if (dist(e.x, e.y, P.x, P.y) < 110) hurtPlayer(e.dmg * 1.3, 'the Chimera');
            burst(e.x, e.y, 26, '110,95,80', 260, { s: 5 }); G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 110, life: 0.35, max: 0.35, c: '255,200,150' });
          }
        }
        break;
      case 'burer':
        if (d < 320) { vx = -ux * sp * 0.5; vy = -uy * sp * 0.5; }
        if (e.cd <= 0 && d < 650) {
          e.cd = rand(2.2, 3); e.cast = 0.6; const a = Math.atan2(dy, dx);
          for (let i = 0; i < 9; i++) enemyShoot(e, a + (i - 4) * 0.13, 340 + rand(-30, 30), 18, 'debris', 8);
          Sfx.play('throw');
        }
        if (e.cd2 <= 0) { e.cd2 = rand(8, 10); e.shield = 2.4; Sfx.play('psi'); }
        if (e.shield > 0 && d < 500) { P.kvx += ux * -140 * dt * 4; P.kvy += uy * -140 * dt * 4; }
        break;
      case 'monolith': {
        e.z = 30 + Math.sin(e.t * 1.5) * 10;
        if (d < 260) { vx = -ux * sp; vy = -uy * sp; } else if (d < 380) { vx = vy = 0; }
        const phase2 = e.hp < e.maxhp * 0.5;
        e.spin = (e.spin || 0) + dt * (phase2 ? 2.4 : 1.6);
        e.st -= dt;
        if (e.st <= 0) { e.st = phase2 ? 0.1 : 0.16; const arms = phase2 ? 4 : 3; for (let i = 0; i < arms; i++) enemyShoot(e, e.spin + (i * TAU) / arms, 200, 14, 'mono', 7); }
        if (e.cd <= 0) { e.cd = phase2 ? 2.6 : 3.6; for (let i = 0; i < 28; i++) enemyShoot(e, (i / 28) * TAU + e.spin * 0.5, 170, 16, 'mono', 7); Sfx.play('psi'); }
        if (e.cd2 <= 0) { e.cd2 = 11; for (let i = 0; i < 6; i++) { const p = ringPos(-200); if (p) spawnEnemy(i === 0 ? 'controller' : 'snork', p[0], p[1]); } }
        if (d < 700) G.psi = Math.max(G.psi, 0.25);
        break;
      }
    }
    // separation
    EG.query(e.x, e.y, e.r + 24, TMP);
    for (const o of TMP) {
      if (o === e || o.dead) continue;
      const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, m = e.r + o.r;
      if (dd < m * m && dd > 0.01) { const l = Math.sqrt(dd), push = ((m - l) / l) * 0.5 * Math.min(1, o.d.mass / e.d.mass); e.x += ox * push; e.y += oy * push; }
    }
    e.x += (vx + e.kvx) * dt; e.y += (vy + e.kvy) * dt;
    const kd = Math.pow(0.004, dt); e.kvx *= kd; e.kvy *= kd;
    if (e.id === 'snork' || e.id === 'dog') { if (e.vz || e.z > 0) { e.z += e.vz * dt; e.vz -= 900 * dt; if (e.z <= 0) { e.z = 0; e.vz = 0; } } }
    if (!e.d.fly && e.state !== 2) World.collide(e);
    if (Math.abs(vx) > 4) e.face = vx > 0 ? 1 : -1;
    e.anim += dt * (4 + Math.hypot(vx, vy) / 18);
    // contact damage
    if (d < e.r + P.r + 2 && e.z < 20) hurtPlayer(e.dmg, e.d.name);
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
  G.bosses = G.bosses.filter((e) => !e.dead);
}

// ---------- anomalies ----------
function updateAnomalies(dt) {
  for (const a of World.anomalies) {
    if (Math.abs(a.x - P.x) > 1300 || Math.abs(a.y - P.y) > 1100) continue;
    a.cd -= dt; a.act = Math.max(0, a.act - dt);
    const pd = dist(a.x, a.y, P.x, P.y), pin = pd < a.r + P.r * 0.5 && P.dashT <= 0;
    EG.query(a.x, a.y, a.r, TMP2);
    switch (a.type) {
      case 'electro':
        if (a.cd <= 0 && (pin || TMP2.some((e) => dist(a.x, a.y, e.x, e.y) < a.r && !e.d.fly))) {
          a.cd = 1.7; a.act = 0.28;
          for (const e of TMP2) if (dist(a.x, a.y, e.x, e.y) < a.r && !e.d.fly) hurtEnemy(e, 45, 0, 0, true);
          if (pd < a.r) hurtPlayer(22, 'an Electro anomaly');
          if (pd < 700) { Sfx.play('zap'); burst(a.x, a.y, 12, '150,210,255', 200, { add: true }); }
        }
        break;
      case 'burner':
        if (a.cd <= 0 && a.act <= 0 && (pin || TMP2.some((e) => dist(a.x, a.y, e.x, e.y) < a.r * 0.9 && !e.d.fly))) { a.act = 1.4; a.cd = 2.8; if (pd < 700) Sfx.play('fire'); }
        if (a.act > 0) {
          for (const e of TMP2) if (dist(a.x, a.y, e.x, e.y) < a.r * 0.9) { e.burnAcc = (e.burnAcc || 0) + 70 * dt; if (e.burnAcc > 10) { hurtEnemy(e, e.burnAcc, 0, 0, true); e.burnAcc = 0; } }
          if (pd < a.r * 0.9) { P.burnAcc = (P.burnAcc || 0) + 38 * dt; if (P.burnAcc > 8) { hurtPlayer(P.burnAcc, 'a Burner anomaly', true); P.burnAcc = 0; } }
          if (Math.random() < 0.6) part(a.x + rand(-a.r * 0.4, a.r * 0.4), a.y, { z: rand(0, 40), vz: rand(150, 300), g: -50, c: '255,150,50', add: true, s: rand(3, 7), life: rand(0.3, 0.7), vx: rand(-20, 20) });
        }
        break;
      case 'vortex': {
        const pull = (o, str) => {
          const ox = a.x - o.x, oy = a.y - o.y, dd = Math.hypot(ox, oy) || 1;
          if (dd > a.r) return false;
          const f = (1 - dd / a.r) * str;
          o.x += (ox / dd) * f * dt; o.y += (oy / dd) * f * dt;
          return dd < 28;
        };
        for (const e of TMP2) {
          if (e.d.boss || e.d.fly) continue;
          if (pull(e, 380)) { e.vt += dt; if (e.vt > 0.5) { e.vt = 0; hurtEnemy(e, 120, rand(-600, 600), rand(-600, 600), true); a.act = 0.5; burst(a.x, a.y, 16, '130,20,20', 260); if (pd < 700) Sfx.play('vortex'); } }
        }
        if (P.dashT <= 0 && pull(P, 250)) {
          P.vt = (P.vt || 0) + dt;
          if (P.vt > 0.55) { P.vt = 0; hurtPlayer(30, 'a Vortex anomaly'); const an = rand(TAU); P.kvx = Math.cos(an) * 700; P.kvy = Math.sin(an) * 700; a.act = 0.5; Sfx.play('vortex'); shake(10); }
        } else P.vt = 0;
        break;
      }
      case 'acid':
        for (const e of TMP2) if (!e.d.fly && dist(a.x, a.y, e.x, e.y) < a.r * 0.85) { e.slowT = 0.2; e.acidAcc = (e.acidAcc || 0) + 22 * dt; if (e.acidAcc > 6) { hurtEnemy(e, e.acidAcc, 0, 0, true); e.acidAcc = 0; } }
        if (pd < a.r * 0.85 && P.dashT <= 0) {
          P.slowNext = Math.max(P.slowNext, 0.4); P.acidAcc = (P.acidAcc || 0) + 11 * dt;
          if (P.acidAcc > 5) { hurtPlayer(P.acidAcc, 'a Fruit Punch anomaly', true); P.acidAcc = 0; }
          if (Math.random() < 0.3) part(P.x + rand(-8, 8), P.y, { vz: 60, z: 2, g: 0, c: '160,255,80', add: true, s: 3, life: 0.5 });
        }
        break;
      case 'spring':
        if (a.cd <= 0) {
          let fired = false;
          for (const e of TMP2) {
            const dd = dist(a.x, a.y, e.x, e.y);
            if (dd < a.r && !e.d.boss && !e.d.fly) { fired = true; hurtEnemy(e, 40, ((e.x - a.x) / (dd || 1)) * 900, ((e.y - a.y) / (dd || 1)) * 900, true); }
          }
          if (pin) { fired = true; hurtPlayer(16, 'a Springboard'); P.kvx = ((P.x - a.x) / (pd || 1)) * 650; P.kvy = ((P.y - a.y) / (pd || 1)) * 650; }
          if (fired) { a.cd = 1.3; a.act = 0.35; if (pd < 700) Sfx.play('spring'); burst(a.x, a.y, 14, '200,200,190', 220); }
        }
        break;
    }
  }
}

// ---------- weapons ----------
function nearest(x, y, range, skip) {
  let best = null, bd = range * range;
  for (const e of G.enemies) {
    if (e.dead || (skip && skip.includes(e))) continue;
    if (e.id === 'bloodsucker' && e.alpha < 0.3) continue;
    const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function shoot(x, y, a, spd, dmg, o = {}) {
  G.bullets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, r: o.r || 4, life: o.life || 1.1, pierce: (o.pierce || 0) + P.pierce, hits: [], k: o.k || 'bullet', knock: o.knock || 60, bounces: o.bounces || 0, c: o.c });
}
function fireWeapon(w, s) {
  const gx = P.x, gy = P.y - 22;
  switch (w.id) {
    case 'pistol': {
      const t = nearest(P.x, P.y, 650); if (!t) return false;
      const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx); P.aim = a;
      for (let i = 0; i < s.count; i++) shoot(gx, gy, a + (i - (s.count - 1) / 2) * 0.13, s.spd, s.dmg, { pierce: s.pierce });
      P.muzzle = 0.05; Sfx.play('pistol'); return true;
    }
    case 'ak': {
      const t = nearest(P.x, P.y, 600); if (!t) return false;
      const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx) + rand(-0.07, 0.07); P.aim = a;
      for (let i = 0; i < s.count; i++) { const o = (i - (s.count - 1) / 2) * 8; shoot(gx - Math.sin(a) * o, gy + Math.cos(a) * o, a, s.spd, s.dmg, { pierce: s.pierce, r: 3.5 }); }
      P.muzzle = 0.05; Sfx.play('ak'); return true;
    }
    case 'shotgun': {
      const t = nearest(P.x, P.y, 360); if (!t) return false;
      const a = Math.atan2(t.y - gy, t.x - gx); P.aim = a;
      const n = s.full ? s.pellets * 2 : s.pellets;
      for (let i = 0; i < n; i++) { const aa = s.full ? (i / n) * TAU : a + rand(-s.spread, s.spread) / 2; shoot(gx, gy, aa, s.spd * rand(0.85, 1.1), s.dmg, { life: 0.42, knock: 240, r: 3.5 }); }
      P.muzzle = 0.07; shake(2); Sfx.play('shotgun'); return true;
    }
    case 'grenade': {
      const cands = G.enemies.filter((e) => dist2(P.x, P.y, e.x, e.y) < 520 * 520);
      if (!cands.length) return false;
      for (let i = 0; i < s.count; i++) {
        let best = null, bn = -1;
        for (let k = 0; k < 8; k++) { const c = pick(cands); EG.query(c.x, c.y, 80, TMP); if (TMP.length > bn) { bn = TMP.length; best = c; } }
        G.throws.push({ x0: P.x, y0: P.y - 20, x1: best.x + rand(-20, 20), y1: best.y + rand(-20, 20), t: 0, T: 0.65, dmg: s.dmg, r: s.radius * P.areaMul, k: 'grenade' });
      }
      Sfx.play('throw'); return true;
    }
    case 'bolts': {
      const t = nearest(P.x, P.y, 520); if (!t) return false;
      const a = Math.atan2(t.y - gy, t.x - gx);
      for (let i = 0; i < s.count; i++) shoot(gx, gy, a + (i - (s.count - 1) / 2) * 0.4, s.spd, s.dmg, { k: 'bolt', bounces: s.bounces, life: 2, r: 5, knock: 80 });
      Sfx.play('throw'); return true;
    }
    case 'gauss': {
      const t = nearest(P.x, P.y, 850); if (!t) return false;
      for (let i = 0; i < s.count; i++) {
        const a = Math.atan2(t.y - t.z - gy, t.x - gx) + (i ? Math.PI : 0); P.aim = a;
        const L = 1000, x2 = gx + Math.cos(a) * L, y2 = gy + Math.sin(a) * L, wdt = s.width * P.areaMul;
        for (const e of G.enemies) {
          const ex = e.x - gx, ey = e.y - e.z - 12 - gy, along = ex * Math.cos(a) + ey * Math.sin(a);
          if (along < 0 || along > L) continue;
          const perp = Math.abs(-ex * Math.sin(a) + ey * Math.cos(a));
          if (perp < wdt + e.r) hurtEnemy(e, s.dmg, Math.cos(a) * 200, Math.sin(a) * 200);
        }
        G.fx.push({ k: 'beam', x: gx, y: gy, x2, y2, w: wdt, life: 0.3, max: 0.3 });
      }
      shake(4); Sfx.play('gauss'); return true;
    }
    case 'knife': {
      const R = s.radius * P.areaMul, t = nearest(P.x, P.y, R + 20); if (!t) return false;
      const a = Math.atan2(t.y - P.y, t.x - P.x);
      EG.query(P.x, P.y, R + 30, TMP);
      for (const e of TMP) {
        const d = dist(P.x, P.y, e.x, e.y); if (d > R + e.r) continue;
        if (s.arc < TAU && Math.abs(angDiff(a, Math.atan2(e.y - P.y, e.x - P.x))) > s.arc / 2) continue;
        hurtEnemy(e, s.dmg, ((e.x - P.x) / d) * 160, ((e.y - P.y) / d) * 160);
      }
      G.fx.push({ k: 'slash', x: P.x, y: P.y - 16, a, arc: s.arc, r: R, life: 0.22, max: 0.22 });
      Sfx.play('knife'); return true;
    }
  }
  return false;
}
function updateWeapons(dt) {
  for (const w of P.weapons) {
    w.cd -= dt * P.rateMul;
    if (w.cd > 0) continue;
    const s = WEAPONS[w.id].stats(w.lv);
    w.cd = fireWeapon(w, s) ? Math.max(0.05, s.cd) : 0.12;
  }
  // artifact: moonlight shards
  if (P.shards) {
    const R = 78 * P.areaMul, n = P.shards;
    for (let i = 0; i < n; i++) {
      const a = NOW * 2.8 + (i / n) * TAU, x = P.x + Math.cos(a) * R, y = P.y - 14 + Math.sin(a) * R * 0.7;
      EG.query(x, y + 14, 30, TMP);
      for (const e of TMP) if (dist2(x, y + 14, e.x, e.y) < (e.r + 12) ** 2 && (e.shardT || 0) < NOW) { e.shardT = NOW + 0.35; hurtEnemy(e, 10 + n * 3, Math.cos(a) * 120, Math.sin(a) * 120); }
    }
  }
  // artifact: battery chain lightning
  if (P.lightning) {
    G.lightT -= dt * P.rateMul;
    if (G.lightT <= 0) {
      let t = nearest(P.x, P.y, 460);
      if (t) {
        G.lightT = 1.5;
        const hit = [], pts = [[P.x, P.y - 30]];
        for (let i = 0; i < 1 + P.lightning * 2 && t; i++) {
          hit.push(t); pts.push([t.x, t.y - t.z - 14]);
          hurtEnemy(t, 18 + P.lightning * 8, 0, 0);
          t = nearest(t.x, t.y, 220, hit);
        }
        G.fx.push({ k: 'lightning', pts, life: 0.22, max: 0.22 }); Sfx.play('zap');
      } else G.lightT = 0.2;
    }
  }
  // artifact: fireball aura
  if (P.aura) {
    G.auraT -= dt;
    if (G.auraT <= 0) {
      G.auraT = 0.3;
      const R = (70 + P.aura * 16) * P.areaMul;
      EG.query(P.x, P.y, R, TMP);
      for (const e of TMP) if (dist2(P.x, P.y, e.x, e.y) < (R + e.r) ** 2) hurtEnemy(e, (8 + P.aura * 6) * 0.3 * 3, 0, 0);
    }
  }
}
function updateBullets(dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (World.solidAt(b.x, b.y + 22)) {
      if (b.k === 'bolt' && b.bounces > 0) { b.bounces--; b.vx *= -1; b.vy *= -1; b.x += b.vx * dt * 2; b.y += b.vy * dt * 2; }
      else { b.dead = true; burst(b.x, b.y + 20, 4, '220,200,160', 90, { z: 20, life: 0.3 }); continue; }
    }
    EG.query(b.x, b.y + 16, 50, TMP);
    for (const e of TMP) {
      if (e.dead || b.hits.includes(e)) continue;
      if (e.id === 'bloodsucker' && e.alpha < 0.3 && b.k !== 'bolt') continue;
      const ex = e.x, ey = e.y - e.z - e.r;
      if (dist2(b.x, b.y, ex, ey) < (e.r + b.r + 6) ** 2) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        hurtEnemy(e, b.dmg, (b.vx / sp) * b.knock, (b.vy / sp) * b.knock);
        b.hits.push(e);
        burst(b.x, b.y, 3, '160,30,30', 80, { z: 20, life: 0.3 });
        if (b.k === 'bolt') {
          if (b.bounces-- > 0) { const n = nearest(e.x, e.y, 320, b.hits); if (n) { const a = Math.atan2(n.y - b.y - n.z - 10, n.x - b.x); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.life = 1.2; } else b.dead = true; }
          else b.dead = true;
        } else if (b.pierce-- <= 0) b.dead = true;
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
  for (const b of G.ebullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || World.solidAt(b.x, b.y + 20)) { b.dead = true; continue; }
    if (dist2(b.x, b.y, P.x, P.y - 20) < (b.r + P.r) ** 2) {
      b.dead = true;
      if (P.dashT > 0 || P.inv > 0) continue;
      hurtPlayer(b.dmg, b.k === 'psi' ? 'a Controller' : b.k === 'mono' ? 'the Monolith' : b.k === 'fire' ? 'a Poltergeist' : b.k === 'debris' ? 'the Burer' : 'a Zombie');
      if (b.k === 'psi') { P.slowNext = 0.5; G.psi = 1; }
    }
  }
  G.ebullets = G.ebullets.filter((b) => !b.dead);
  for (const t of G.throws) {
    t.t += dt;
    if (t.t >= t.T) { t.dead = true; explode(t.x1, t.y1, t.r, t.dmg); }
  }
  G.throws = G.throws.filter((t) => !t.dead);
}

// ---------- pickups & xp ----------
function updatePickups(dt) {
  const pr2 = P.pickup * P.pickup;
  for (const g of G.gems) {
    if (g.z > 0 || g.vz) { g.z += g.vz * dt; g.vz -= 700 * dt; g.x += g.vx * dt; g.y += g.vy * dt; if (g.z <= 0) { g.z = 0; g.vz = 0; g.vx = g.vy = 0; } }
    const d2 = dist2(g.x, g.y, P.x, P.y);
    if (d2 < pr2) g.mag = true;
    if (g.mag) {
      const d = Math.sqrt(d2) || 1; g.sp = (g.sp || 150) + 900 * dt;
      g.x += ((P.x - g.x) / d) * g.sp * dt; g.y += ((P.y - g.y) / d) * g.sp * dt;
      if (d < P.r + 8) { g.dead = true; addXp(g.v); Sfx.play('gem'); }
    }
  }
  G.gems = G.gems.filter((g) => !g.dead);
  for (const p of G.pickups) {
    p.t += dt;
    if (dist2(p.x, p.y, P.x, P.y) < 32 * 32) {
      p.dead = true;
      if (p.type === 'med') { P.hp = Math.min(P.maxhp, P.hp + 35); text(P.x, P.y - 50, '+35 HP', '#6f6'); Sfx.play('heal'); }
      else if (p.type === 'magnet') { for (const g of G.gems) g.mag = true; banner('MAGNET', 'All XP pulled in!', 1.5, 'good'); Sfx.play('heal'); }
      else if (p.type === 'stash') {
        P.hp = P.maxhp; const t = pick(Object.keys(ARTIFACTS)); takeArtifact(t, true); G.pendingLv++;
      }
    }
  }
  G.pickups = G.pickups.filter((p) => !p.dead);
  // crates
  for (const c of G.crates) {
    if (c.open) { c.open += dt; continue; }
    if (dist2(c.x, c.y, P.x, P.y) < 34 * 34) {
      c.open = 0.001; Sfx.play('stash'); burst(c.x, c.y, 14, '140,100,60', 160, { s: 4 });
      const r = Math.random();
      if (r < 0.45) G.pickups.push({ type: 'med', x: c.x + 10, y: c.y + 10, t: 0 });
      else if (r < 0.85) for (let i = 0; i < 6; i++) dropGem(c.x, c.y, 3 + Math.floor(G.t / 60));
      else G.pickups.push({ type: 'magnet', x: c.x + 10, y: c.y + 10, t: 0 });
    }
  }
  // artifacts
  for (const f of World.fields) {
    const a = f.art; if (!a) continue;
    if (dist2(a.x, a.y, P.x, P.y) < 24 * 24) { f.art = null; takeArtifact(a.type); }
  }
}
function takeArtifact(type, fromBoss) {
  const A = ARTIFACTS[type];
  P.arts[type] = (P.arts[type] || 0) + 1; A.apply(P); G.arts++;
  banner('ARTIFACT: ' + A.name.toUpperCase(), A.desc + (fromBoss ? '  •  +full heal, +1 level' : ''), 3.5, 'art');
  Sfx.play('artifact'); flash(0.3, '200,240,255');
  burst(P.x, P.y - 20, 30, '220,240,255', 260, { add: true });
  hudBuild();
}
function addXp(v) {
  G.xp += v * P.xpMul;
  while (G.xp >= G.xpNeed) { G.xp -= G.xpNeed; G.level++; G.xpNeed = xpNeed(G.level); G.pendingLv++; }
}

// ---------- level up ----------
let choices = [];
function rollChoices() {
  const pool = [];
  for (const w of P.weapons) if (w.lv < WEAPONS[w.id].max) pool.push({ kind: 'wup', id: w.id, w: 3 });
  if (P.weapons.length < 6) for (const id in WEAPONS) if (!P.weapons.some((w) => w.id === id)) pool.push({ kind: 'wnew', id, w: 2.2 });
  for (const id in PERKS) if ((P.perks[id] || 0) < PERKS[id].max) pool.push({ kind: 'perk', id, w: 1.4 });
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = 0; for (const p of pool) tot += p.w;
    let r = rand(tot), i = 0; for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  for (let i = 0; out.length < 3; i++) out.push({ kind: FALLBACK[i % 2].kind });
  return out;
}
function openLevelUp() {
  G.state = 'levelup'; G.pendingLv--;
  choices = rollChoices();
  const box = $('cards'); box.innerHTML = '';
  choices.forEach((c, i) => {
    let icon, name, tag, desc;
    if (c.kind === 'wup' || c.kind === 'wnew') {
      const W = WEAPONS[c.id], w = P.weapons.find((x) => x.id === c.id);
      icon = W.icon; name = W.name;
      tag = c.kind === 'wnew' ? 'NEW WEAPON' : `LV ${w.lv} → ${w.lv + 1}`;
      desc = c.kind === 'wnew' ? W.desc : W.ups[w.lv];
    } else if (c.kind === 'perk') {
      const p = PERKS[c.id], lv = P.perks[c.id] || 0; icon = p.icon; name = p.name; tag = lv ? `LV ${lv} → ${lv + 1}` : 'NEW PERK'; desc = p.desc;
    } else { const f = FALLBACK.find((x) => x.kind === c.kind); icon = f.icon; name = f.name; tag = 'SUPPLY'; desc = f.desc; }
    const el = document.createElement('button');
    el.className = 'card ' + (c.kind === 'wnew' ? 'new' : c.kind === 'perk' ? 'perk' : '');
    el.style.animationDelay = i * 0.07 + 's';
    el.innerHTML = `<div class="ckey">${i + 1}</div><div class="cicon">${icon}</div><div class="ctag">${tag}</div><div class="cname">${name}</div><div class="cdesc">${desc}</div>`;
    el.onclick = () => chooseCard(i);
    box.appendChild(el);
  });
  $('lvTitle').textContent = 'LEVEL ' + G.level;
  show('levelup');
  Sfx.play('level');
}
function chooseCard(i) {
  if (G.state !== 'levelup' || !choices[i]) return;
  const c = choices[i];
  if (c.kind === 'wup') P.weapons.find((w) => w.id === c.id).lv++;
  else if (c.kind === 'wnew') P.weapons.push({ id: c.id, lv: 1, cd: 0.2 });
  else if (c.kind === 'perk') { P.perks[c.id] = (P.perks[c.id] || 0) + 1; PERKS[c.id].apply(P); }
  else if (c.kind === 'heal') P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.5);
  else if (c.kind === 'vodka') P.dmgMul += 0.05;
  hide('levelup'); G.state = 'play';
  burst(P.x, P.y - 20, 24, '255,220,120', 220, { add: true });
  hudBuild();
}

// ---------- player ----------
function updatePlayer(dt) {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my--; if (keys.KeyS || keys.ArrowDown) my++;
  if (keys.KeyA || keys.ArrowLeft) mx--; if (keys.KeyD || keys.ArrowRight) mx++;
  if (joy.active) { mx += joy.dx; my += joy.dy; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  P.moving = ml > 0.1;
  P.slow = P.slowNext; P.slowNext = 0;
  const spd = 200 * P.spdMul * (1 - P.slow);
  if (P.dashT > 0) {
    P.dashT -= dt; P.x += P.dashVx * dt; P.y += P.dashVy * dt;
    part(P.x + rand(-6, 6), P.y, { z: rand(5, 30), c: '180,220,160', s: 5, life: 0.25, g: 0, add: true });
  } else { P.x += mx * spd * dt; P.y += my * spd * dt; }
  P.x += P.kvx * dt; P.y += P.kvy * dt;
  const kd = Math.pow(0.01, dt); P.kvx *= kd; P.kvy *= kd;
  if (P.moving) {
    P.anim += dt * 13; P.lastMx = mx; P.lastMy = my;
    if (Math.abs(mx) > 0.15) P.face = mx > 0 ? 1 : -1;
    if (Math.random() < dt * 8) part(P.x + rand(-5, 5), P.y, { z: 1, vz: 20, g: 0, c: '120,110,90', s: 3, life: 0.4 });
  }
  if (Math.cos(P.aim) * P.face < 0 && P.muzzle <= -0.3) P.aim = P.face > 0 ? 0 : Math.PI;
  P.muzzle -= dt;
  World.collide(P);
  P.dashCd -= dt; P.inv -= dt;
  if (P.regen) P.hp = Math.min(P.maxhp, P.hp + P.regen * dt);
  // radiation
  let rad = 0;
  for (const r of World.rads) { const d = dist(P.x, P.y, r.x, r.y); if (d < r.r) rad = Math.max(rad, 1 - d / r.r); }
  if (rad > 0) {
    P.radAcc = (P.radAcc || 0) + (2 + rad * 7) * dt;
    if (P.radAcc > 3) { hurtPlayer(P.radAcc, 'radiation', true); P.radAcc = 0; }
    if (Math.random() < rad * 0.6) Sfx.play('geiger');
  }
  G.rad = rad;
  // region name
  const reg = World.region(P.x, P.y);
  if (reg.name !== G.zone) { G.zone = reg.name; $('zoneName').textContent = reg.name; $('zoneName').className = 'show'; G.regionT = 3; $('dangerLvl').textContent = '☢'.repeat(reg.danger); $('zoneName2').textContent = reg.name; }
  if (G.regionT > 0) { G.regionT -= dt; if (G.regionT <= 0) $('zoneName').className = ''; }
}
function tryDash() {
  if (!G || G.state !== 'play' || P.dashCd > 0) return;
  let dx = P.lastMx, dy = P.lastMy; if (!dx && !dy) dx = P.face;
  const l = Math.hypot(dx, dy) || 1;
  P.dashVx = (dx / l) * 760; P.dashVy = (dy / l) * 760; P.dashT = 0.18; P.dashCd = 1.4; P.inv = Math.max(P.inv, 0.28);
  Sfx.play('dash');
}

// ---------- fx update ----------
function updateFx(dt) {
  for (const p of G.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt;
    if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const t of G.texts) { t.life -= dt; t.y -= 40 * dt; }
  G.texts = G.texts.filter((t) => t.life > 0);
  for (const d of G.decals) d.life -= dt;
  G.decals = G.decals.filter((d) => d.life > 0);
  for (const f of G.fx) {
    f.life -= dt;
    if (f.k === 'shock') {
      f.r += f.spd * dt;
      const d = dist(P.x, P.y, f.x, f.y);
      if (!f.hit && Math.abs(d - f.r) < 24 && P.dashT <= 0) { f.hit = true; hurtPlayer(f.dmg, 'the Pseudogiant'); P.kvx = ((P.x - f.x) / d) * 400; P.kvy = ((P.y - f.y) / d) * 400; }
      if (f.r > f.max) f.life = 0;
    }
  }
  G.fx = G.fx.filter((f) => f.life > 0);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2.5);
  G.psi = Math.max(0, G.psi - dt * 0.8);
}

// ---------- main update ----------
function update(dt) {
  if (G.state !== 'play') return;
  G.t += dt;
  updatePlayer(dt);
  director(dt);
  updateEmission(dt);
  updateEnemies(dt);
  updateAnomalies(dt);
  updateWeapons(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateFx(dt);
  // detector beeps
  const art = nearestArtifact();
  if (art && art.d < 1200) {
    G.detT -= dt;
    if (G.detT <= 0) { G.detT = clamp(art.d / 700, 0.12, 1.6); Sfx.play('beep'); $('detLed').classList.add('on'); setTimeout(() => $('detLed').classList.remove('on'), 60); }
  }
  // camera
  const k = 1 - Math.exp(-dt * 6);
  CAM.x = lerp(CAM.x, P.x + P.lastMx * 50, k); CAM.y = lerp(CAM.y, P.y - 20 + P.lastMy * 40, k);
  if (G.pendingLv > 0 && G.state === 'play') openLevelUp();
}
function nearestArtifact() {
  let best = null, bd = 1e12;
  for (const f of World.fields) { if (!f.art) continue; const d = dist2(P.x, P.y, f.art.x, f.art.y); if (d < bd) { bd = d; best = f.art; } }
  return best ? { a: best, d: Math.sqrt(bd) } : null;
}

// ---------- render ----------
const DRAW = [];
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#15130f'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!G) return;
  const sc = ZOOM * DPR;
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  const cx = CAM.x + sx, cy = CAM.y + sy;
  ctx.setTransform(sc, 0, 0, sc, cv.width / 2 - cx * sc, cv.height / 2 - cy * sc);
  const hw = VW / 2 / ZOOM, hh = VH / 2 / ZOOM;
  const x0 = cx - hw - 20, x1 = cx + hw + 20, y0 = cy - hh - 20, y1 = cy + hh + 20;
  // ground
  for (let gy = Math.max(0, Math.floor(y0 / CHUNK)); gy <= Math.min(Math.ceil(WORLD / CHUNK) - 1, Math.floor(y1 / CHUNK)); gy++)
    for (let gx = Math.max(0, Math.floor(x0 / CHUNK)); gx <= Math.min(Math.ceil(WORLD / CHUNK) - 1, Math.floor(x1 / CHUNK)); gx++)
      ctx.drawImage(World.chunk(gx, gy), gx * CHUNK, gy * CHUNK, CHUNK + 1, CHUNK + 1);
  // edge of the world: dense fog
  ctx.fillStyle = '#0d0c09';
  if (x0 < 0) ctx.fillRect(x0 - 10, y0 - 10, -x0 + 10, y1 - y0 + 20);
  if (y0 < 0) ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, -y0 + 10);
  if (x1 > WORLD) ctx.fillRect(WORLD, y0 - 10, x1 - WORLD + 10, y1 - y0 + 20);
  if (y1 > WORLD) ctx.fillRect(x0 - 10, WORLD, x1 - x0 + 20, y1 - WORLD + 10);
  // decals
  for (const d of G.decals) {
    if (d.x < x0 - 60 || d.x > x1 + 60 || d.y < y0 - 60 || d.y > y1 + 60) continue;
    ctx.fillStyle = `rgba(${d.c},${Math.min(0.55, d.life / 10)})`;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, d.a, 0, TAU); ctx.fill();
  }
  // radiation
  for (const r of World.rads) {
    if (r.x + r.r < x0 || r.x - r.r > x1 || r.y + r.r < y0 || r.y - r.r > y1) continue;
    const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.r);
    g.addColorStop(0, 'rgba(230,220,60,0.22)'); g.addColorStop(1, 'rgba(230,220,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,220,60,0.25)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  // shelters pads
  for (const s of World.shelters) {
    if (s.x < x0 - 100 || s.x > x1 + 100 || s.y < y0 - 100 || s.y > y1 + 150) continue;
    const em = G.em && G.em.phase !== 'after';
    ctx.fillStyle = 'rgba(90,95,88,0.7)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = em ? `rgba(90,255,120,${0.5 + Math.sin(NOW * 8) * 0.4})` : 'rgba(90,255,120,0.35)'; ctx.lineWidth = em ? 4 : 2;
    ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,255,120,0.5)'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('SHELTER', s.x, s.y + 5);
  }
  // anomalies (ground)
  for (const a of World.anomalies) if (a.x > x0 - a.r && a.x < x1 + a.r && a.y > y0 - a.r && a.y < y1 + a.r) drawAnomalyGround(a);
  // gems
  for (const g of G.gems) {
    if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
    const big = g.v >= 20, mid = g.v >= 5, s = big ? 7 : mid ? 5.5 : 4, c = big ? '#ff6ad5' : mid ? '#6ad0ff' : '#7dff8a';
    const y = g.y - g.z - 5 - Math.sin(NOW * 4 + g.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(g.x - s * 0.6, g.y - 1, s * 1.2, 2);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(g.x, y - s); ctx.lineTo(g.x + s * 0.7, y); ctx.lineTo(g.x, y + s); ctx.lineTo(g.x - s * 0.7, y); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(g.x - 1, y - s * 0.6, 2, s * 0.5);
  }
  // collect sortables
  DRAW.length = 0;
  const PC = WORLD / PCELL, st = ++World.stamp;
  for (let gy = Math.max(0, Math.floor((y0 - 60) / PCELL)); gy <= Math.min(PC - 1, Math.floor((y1 + 300) / PCELL)); gy++)
    for (let gx = Math.max(0, Math.floor((x0 - 60) / PCELL)); gx <= Math.min(PC - 1, Math.floor((x1 + 60) / PCELL)); gx++)
      for (const p of World.propGrid[gy * PC + gx]) {
        if (p._s === st) continue; p._s = st;
        if (p.bx1 < x0 || p.bx0 > x1 || p.by1 < y0 || p.by0 > y1) continue;
        DRAW.push({ y: p.sy, t: 0, o: p });
      }
  for (const e of G.enemies) if (e.x > x0 - 80 && e.x < x1 + 80 && e.y > y0 - 40 && e.y < y1 + 160) DRAW.push({ y: e.y, t: 1, o: e });
  DRAW.push({ y: P.y, t: 2, o: P });
  for (const c of G.crates) if (c.open < 1.5 && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1 + 40) DRAW.push({ y: c.y, t: 3, o: c });
  for (const p of G.pickups) if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 + 40) DRAW.push({ y: p.y, t: 4, o: p });
  for (const f of World.fields) if (f.art) { const a = f.art, d = dist(a.x, a.y, P.x, P.y); if (d < 330 && a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) DRAW.push({ y: a.y, t: 5, o: a, d }); }
  DRAW.sort((a, b) => a.y - b.y);
  // entity shadows first
  for (const it of DRAW) if (it.t === 1) { const e = it.o; shadow(e.x, e.y, e.r * 1.1 * (1 - Math.min(0.5, e.z / 200)), e.r * 0.4, e.id === 'poltergeist' ? 0.15 : 0.3 * (e.alpha ?? 1)); }
  shadow(P.x, P.y, 14, 5, 0.35);
  for (const it of DRAW) {
    const o = it.o;
    if (it.t === 0) PROP_DRAW[o.kind](o);
    else if (it.t === 1) { FL = o.flash > 0; ENEMY_DRAW[o.id](o); FL = false; }
    else if (it.t === 2) drawPlayer();
    else if (it.t === 3) drawCrate(o);
    else if (it.t === 4) drawPickup(o);
    else if (it.t === 5) drawArtifact(o, clamp((330 - it.d) / 120, 0, 1));
  }
  // anomalies (top)
  for (const a of World.anomalies) if (a.x > x0 - a.r && a.x < x1 + a.r && a.y > y0 - 150 && a.y < y1 + a.r) drawAnomalyTop(a);
  // player-owned fx
  drawPlayerFx();
  // bullets
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const b of G.bullets) {
    if (b.k === 'bolt') continue;
    ctx.strokeStyle = 'rgba(255,220,140,0.9)'; ctx.lineWidth = b.r * 0.9;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke();
  }
  for (const b of G.ebullets) {
    const c = b.k === 'psi' ? '200,100,255' : b.k === 'fire' ? '255,140,40' : b.k === 'mono' ? '140,220,255' : b.k === 'debris' ? '200,170,120' : '255,90,60';
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, `rgba(${c},0.9)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  for (const b of G.bullets) if (b.k === 'bolt') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(NOW * 20);
    ctx.fillStyle = '#b8b8b0'; ctx.fillRect(-6, -2, 12, 4); ctx.fillStyle = '#888'; ctx.fillRect(-7, -4, 4, 8); ctx.restore();
  }
  // grenades in flight
  for (const t of G.throws) {
    const k = t.t / t.T, x = lerp(t.x0, t.x1, k), y = lerp(t.y0, t.y1, k), z = Math.sin(k * Math.PI) * 120;
    shadow(x, y + 20 * (1 - k), 5, 2, 0.3);
    ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.arc(x, y - z, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#aaa'; ctx.fillRect(x - 1, y - z - 8, 3, 4);
  }
  // fx
  drawFx();
  // particles
  for (const p of G.particles) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 + 50) continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.add) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${p.c},${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.s * (p.add ? 1 : 0.6 + a * 0.4), 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // floating texts
  ctx.textAlign = 'center';
  for (const t of G.texts) {
    ctx.globalAlpha = clamp(t.life * 2, 0, 1);
    ctx.font = `bold ${t.big ? 20 : 14}px Oswald, Impact, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(t.s, t.x + 1.5, t.y + 1.5);
    ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  // emission / shelter guide arrow
  if (G.em && G.em.phase !== 'after' && !inShelter(P.x, P.y)) {
    const s = nearestShelter();
    if (s) {
      const a = Math.atan2(s.y - P.y, s.x - P.x), r = 60;
      ctx.save(); ctx.translate(P.x + Math.cos(a) * r, P.y - 16 + Math.sin(a) * r); ctx.rotate(a);
      ctx.fillStyle = `rgba(90,255,120,${0.6 + Math.sin(NOW * 10) * 0.3})`;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-6, -11); ctx.lineTo(-1, 0); ctx.lineTo(-6, 11); ctx.fill(); ctx.restore();
    }
  }
  // drifting cloud shadows (world space)
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 5; i++) {
    const wx = ((i * 1733 + NOW * 22) % 2600) - 1300 + Math.floor(cx / 2600) * 2600, wy = ((i * 977 + NOW * 9) % 2000) - 1000 + Math.floor(cy / 2000) * 2000;
    for (const ox of [0, 2600]) for (const oy of [0, 2000]) {
      const X = wx + ox, Y = wy + oy; if (X < x0 - 600 || X > x1 + 600 || Y < y0 - 600 || Y > y1 + 600) continue;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, 520);
      g.addColorStop(0, 'rgba(150,150,160,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 520, Y - 520, 1040, 1040);
    }
  }
  ctx.restore();
  // ---- screen space ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // atmosphere tint
  let tint = 'rgba(40,50,30,0.12)';
  if (G.em) { const k = G.em.phase === 'warn' ? (1 - G.em.t / 30) * 0.3 : G.em.phase === 'blast' ? 0.42 + Math.sin(NOW * 12) * 0.1 : 0.3 * (G.em.t / 3); tint = `rgba(160,30,20,${k})`; }
  ctx.fillStyle = tint; ctx.fillRect(0, 0, VW, VH);
  if (G.rad > 0) { ctx.fillStyle = `rgba(200,200,40,${G.rad * 0.12})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.psi > 0) {
    ctx.fillStyle = `rgba(120,40,180,${G.psi * 0.18})`; ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = `rgba(200,120,255,${G.psi * 0.25})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const r = ((NOW * 300 + i * 200) % 600); ctx.beginPath(); ctx.arc(VW / 2, VH / 2, r, 0, TAU); ctx.stroke(); }
  }
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${P.hp / P.maxhp < 0.3 ? 0.75 : 0.6})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (P.hp / P.maxhp < 0.3) { ctx.fillStyle = `rgba(200,0,0,${(0.3 - P.hp / P.maxhp) * (0.5 + Math.sin(NOW * 6) * 0.3)})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashCol},${G.flash * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
  // offscreen boss indicators
  for (const b of G.bosses) {
    const sxp = (b.x - cx) * ZOOM + VW / 2, syp = (b.y - cy) * ZOOM + VH / 2;
    if (sxp > 0 && sxp < VW && syp > 0 && syp < VH) continue;
    const a = Math.atan2(syp - VH / 2, sxp - VW / 2), ex = clamp(sxp, 30, VW - 30), ey = clamp(syp, 90, VH - 30);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = '#ff3a2a';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.fill(); ctx.restore();
    ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💀', ex - Math.cos(a) * 22, ey - Math.sin(a) * 22 + 6);
  }
}
function drawPlayer() {
  const blink = P.inv > 0 && P.dashT <= 0 && Math.floor(NOW * 20) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.5;
  drawStalker(P, PAL_PLAYER, true);
  ctx.globalAlpha = 1;
}
function drawPlayerFx() {
  if (P.aura) {
    const R = (70 + P.aura * 16) * P.areaMul;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(P.x, P.y, R * 0.3, P.x, P.y, R);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(0.8, `rgba(255,110,30,${0.14 + Math.sin(NOW * 8) * 0.05})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(P.x, P.y, R, R * 0.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.5) { const a = rand(TAU); part(P.x + Math.cos(a) * R * 0.9, P.y + Math.sin(a) * R * 0.63, { vz: 80, g: -40, c: '255,140,40', add: true, s: 3, life: 0.5 }); }
  }
  if (P.shards) {
    const R = 78 * P.areaMul;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.shards; i++) {
      const a = NOW * 2.8 + (i / P.shards) * TAU, x = P.x + Math.cos(a) * R, y = P.y - 14 + Math.sin(a) * R * 0.7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 18); g.addColorStop(0, 'rgba(230,250,255,1)'); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(x, y); ctx.rotate(a * 2); ctx.fillRect(-3, -6, 6, 12); ctx.restore();
    }
    ctx.restore();
  }
}
function drawFx() {
  ctx.save(); ctx.lineCap = 'round';
  for (const f of G.fx) {
    const k = f.life / f.max;
    switch (f.k) {
      case 'boom': {
        ctx.globalCompositeOperation = 'lighter';
        const r = f.r * (1.1 - k * 0.5);
        const g = ctx.createRadialGradient(f.x, f.y - 10, 0, f.x, f.y - 10, r);
        g.addColorStop(0, `rgba(255,250,200,${k})`); g.addColorStop(0.4, `rgba(255,150,40,${k * 0.8})`); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - 10, r, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'beam':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(90,180,255,${k * 0.6})`; ctx.lineWidth = f.w * 2 * k + 4;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(230,250,255,${k})`; ctx.lineWidth = f.w * 0.6 * k + 1;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'slash': {
        ctx.globalCompositeOperation = 'lighter';
        const prog = 1 - k, arc = f.arc >= TAU ? TAU : f.arc, a0 = f.a - arc / 2, a1 = a0 + arc * Math.min(1, prog * 2.2);
        ctx.strokeStyle = `rgba(230,240,255,${k})`; ctx.lineWidth = 10 * k + 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, a0, a1); ctx.stroke();
        ctx.strokeStyle = `rgba(150,200,255,${k * 0.5})`; ctx.lineWidth = 22 * k;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 0.56, 0, a0, a1); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'lightning':
        ctx.globalCompositeOperation = 'lighter';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(240,250,255,${k})` : `rgba(90,160,255,${k * 0.7})`; ctx.lineWidth = pass ? 2 : 6;
          for (let i = 0; i < f.pts.length - 1; i++) jag(f.pts[i][0], f.pts[i][1], f.pts[i + 1][0], f.pts[i + 1][1], 6, 10);
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'shock': {
        ctx.strokeStyle = `rgba(200,170,130,${1 - f.r / f.max})`; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,230,180,${(1 - f.r / f.max) * 0.8})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r - 4, (f.r - 4) * 0.62, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'target':
        ctx.strokeStyle = `rgba(255,50,40,${0.4 + Math.sin(NOW * 25) * 0.3})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,40,30,0.12)'; ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(${f.c},${k})`; ctx.lineWidth = 6 * k;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1.4 - k * 0.4), f.r * (1.4 - k * 0.4) * 0.62, 0, 0, TAU); ctx.stroke();
        break;
      case 'sky': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,200,180,${k})`; ctx.lineWidth = 3;
        jag(f.x + rand(-80, 80), f.y - 900, f.x, f.y, 12, 26);
        ctx.fillStyle = `rgba(255,120,80,${k * 0.4})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 60, 30, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }
  }
  ctx.restore();
}
function drawCrate(c) {
  const a = c.open ? clamp(1 - c.open / 1.5, 0, 1) : 1;
  ctx.globalAlpha = a;
  shadow(c.x + 4, c.y + 2, 18, 6, 0.3);
  if (!c.open) {
    const bob = Math.sin(NOW * 3 + c.x) * 1;
    ctx.fillStyle = '#6a4e2e'; ctx.fillRect(c.x - 15, c.y - 20 + bob, 30, 20);
    ctx.fillStyle = '#86653c'; ctx.fillRect(c.x - 15, c.y - 26 + bob, 30, 7);
    ctx.strokeStyle = '#3e2c18'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 15, c.y - 20 + bob, 30, 20);
    ctx.beginPath(); ctx.moveTo(c.x - 15, c.y - 20 + bob); ctx.lineTo(c.x + 15, c.y + bob); ctx.stroke();
    ctx.fillStyle = `rgba(255,220,120,${0.5 + Math.sin(NOW * 4) * 0.3})`; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▼', c.x, c.y - 34 + bob);
  } else {
    ctx.fillStyle = '#5a4026'; ctx.fillRect(c.x - 18, c.y - 5, 14, 5); ctx.fillRect(c.x + 3, c.y - 7, 15, 5); ctx.fillRect(c.x - 6, c.y - 3, 12, 4);
  }
  ctx.globalAlpha = 1;
}
function drawPickup(p) {
  const y = p.y - 14 - Math.sin(NOW * 4 + p.x) * 3;
  shadow(p.x, p.y, 10, 4, 0.3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const c = p.type === 'med' ? '120,255,120' : p.type === 'magnet' ? '120,180,255' : '255,210,80';
  const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, p.type === 'stash' ? 50 : 26); g.addColorStop(0, `rgba(${c},0.5)`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, y, p.type === 'stash' ? 50 : 26, 0, TAU); ctx.fill(); ctx.restore();
  if (p.type === 'med') {
    ctx.fillStyle = '#eee'; ctx.fillRect(p.x - 9, y - 7, 18, 14); ctx.fillStyle = '#d22'; ctx.fillRect(p.x - 2, y - 5, 4, 10); ctx.fillRect(p.x - 5, y - 2, 10, 4);
  } else if (p.type === 'magnet') {
    ctx.strokeStyle = '#d33'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, y, 7, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.fillRect(p.x - 9.5, y, 5, 5); ctx.fillRect(p.x + 4.5, y, 5, 5);
  } else {
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(p.x - 16, y - 10, 32, 20); ctx.fillStyle = '#c9a040'; ctx.fillRect(p.x - 16, y - 13, 32, 6); ctx.fillStyle = '#ffe070'; ctx.fillRect(p.x - 3, y - 6, 6, 7);
  }
}

// ---------- HUD ----------
let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function hudBuild() {
  const wb = $('weapons'); wb.innerHTML = '';
  for (const w of P.weapons) {
    const d = document.createElement('div'); d.className = 'slot';
    d.innerHTML = `<span>${WEAPONS[w.id].icon}</span><b>${w.lv >= WEAPONS[w.id].max ? 'MAX' : w.lv}</b>`; d.title = WEAPONS[w.id].name;
    wb.appendChild(d);
  }
  for (const id in P.perks) {
    const d = document.createElement('div'); d.className = 'slot perk';
    d.innerHTML = `<span>${PERKS[id].icon}</span><b>${P.perks[id]}</b>`; d.title = PERKS[id].name;
    wb.appendChild(d);
  }
  const ab = $('artbelt'); ab.innerHTML = '';
  for (const id in P.arts) {
    const A = ARTIFACTS[id], d = document.createElement('div'); d.className = 'art';
    d.style.setProperty('--c', A.color); d.title = A.name + ': ' + A.desc;
    d.innerHTML = `<i></i>${P.arts[id] > 1 ? '<b>' + P.arts[id] + '</b>' : ''}`;
    ab.appendChild(d);
  }
}
function hud() {
  $('hpFill').style.width = (P.hp / P.maxhp) * 100 + '%';
  setText('hpText', Math.ceil(P.hp) + ' / ' + Math.round(P.maxhp));
  $('xpFill').style.width = (G.xp / G.xpNeed) * 100 + '%';
  setText('lvl', 'LV ' + G.level);
  setText('timer', fmtTime(G.t));
  setText('kills', '☠ ' + G.kills);
  $('dashFill').style.transform = `scaleY(${clamp(1 - P.dashCd / 1.4, 0, 1)})`;
  $('dashBtn').classList.toggle('ready', P.dashCd <= 0);
  // boss bar
  const b = G.bosses[0];
  if (b) { $('boss').style.display = 'block'; setText('bossName', b.d.name + (G.bosses.length > 1 ? ' + ' + G.bosses[1].d.name : '')); $('bossFill').style.width = (b.hp / b.maxhp) * 100 + '%'; }
  else $('boss').style.display = 'none';
  // emission
  const em = G.em;
  if (em && em.phase !== 'after') {
    $('emission').style.display = 'block';
    const safe = inShelter(P.x, P.y);
    setText('emText', em.phase === 'warn' ? `EMISSION IN ${Math.ceil(em.t)}s — ${safe ? 'YOU ARE SAFE' : 'FIND SHELTER!'}` : safe ? 'EMISSION — STAY IN SHELTER' : 'EMISSION — YOU ARE DYING!');
    $('emission').classList.toggle('safe', !!safe);
  } else $('emission').style.display = 'none';
  // next event
  const nb = BOSS_SCHEDULE[G.bossIdx];
  setText('nextEvt', nb ? `☠ ${ENEMIES[nb.id].name} in ${fmtTime(nb.t - G.t)}` : '');
  // banner
  if (bannerTimer > 0) { bannerTimer -= 1 / 60; if (bannerTimer <= 0) $('banner').className = ''; }
  drawDetector(); drawMinimap();
}
const mm = $('minimap'), mmx = mm.getContext('2d');
function drawMinimap() {
  const S = mm.width, span = 2000, k = WORLD / World.mapImg.width;
  mmx.fillStyle = '#111'; mmx.fillRect(0, 0, S, S);
  mmx.imageSmoothingEnabled = false;
  const sx = (P.x - span / 2) / k, sy = (P.y - span / 2) / k, sw = span / k;
  mmx.drawImage(World.mapImg, sx, sy, sw, sw, 0, 0, S, S);
  const f = S / span, tx = (x) => (x - P.x + span / 2) * f, ty = (y) => (y - P.y + span / 2) * f;
  for (const fl of World.fields) { const x = tx(fl.x), y = ty(fl.y); if (x < -5 || x > S + 5 || y < -5 || y > S + 5) continue; mmx.fillStyle = ANOMALIES[fl.type].color; mmx.globalAlpha = 0.55; mmx.beginPath(); mmx.arc(x, y, 5, 0, TAU); mmx.fill(); mmx.globalAlpha = 1; }
  for (const s of World.shelters) { const x = tx(s.x), y = ty(s.y); mmx.fillStyle = '#5f5'; mmx.fillRect(x - 3, y - 3, 6, 6); }
  mmx.fillStyle = '#f44';
  for (const e of G.enemies) { const x = tx(e.x), y = ty(e.y); if (x < 0 || x > S || y < 0 || y > S) continue; if (e.d.boss) { mmx.font = '14px sans-serif'; mmx.fillText('💀', x - 7, y + 5); } else mmx.fillRect(x - 1, y - 1, 2, 2); }
  mmx.fillStyle = '#fff'; mmx.beginPath(); mmx.arc(S / 2, S / 2, 4, 0, TAU); mmx.fill();
  mmx.strokeStyle = '#000'; mmx.lineWidth = 1.5; mmx.stroke();
}
const det = $('detector'), dtx = det.getContext('2d');
function drawDetector() {
  const S = det.width; dtx.clearRect(0, 0, S, S);
  const art = nearestArtifact();
  dtx.strokeStyle = 'rgba(120,255,140,0.3)'; dtx.lineWidth = 1;
  for (const r of [18, 32]) { dtx.beginPath(); dtx.arc(S / 2, S / 2, r, 0, TAU); dtx.stroke(); }
  if (art && art.d < 1500) {
    const a = Math.atan2(art.a.y - P.y, art.a.x - P.x), c = ARTIFACTS[art.a.type].color;
    dtx.save(); dtx.translate(S / 2, S / 2); dtx.rotate(a);
    dtx.fillStyle = art.d < 300 ? c : '#7dff8a';
    dtx.beginPath(); dtx.moveTo(34, 0); dtx.lineTo(12, -9); dtx.lineTo(16, 0); dtx.lineTo(12, 9); dtx.fill(); dtx.restore();
    setText('detDist', Math.round(art.d / 10) + 'm');
  } else setText('detDist', '---');
}

// ---------- screens ----------
function show(id) { $(id).classList.add('show'); }
function hide(id) { $(id).classList.remove('show'); }
function gameOver(src) {
  G.state = 'over';
  $('overTitle').textContent = 'YOU DIED';
  $('overSub').textContent = 'Killed by ' + (src || 'the Zone') + '. The Zone claims another stalker.';
  fillStats(); show('over');
}
function winGame() {
  G.state = 'over'; G.won = true;
  $('overTitle').textContent = 'THE ZONE IS FREE';
  $('overSub').textContent = 'The Monolith shatters. You reached the heart of the Zone — legends will be told of you.';
  fillStats(); show('over'); flash(1);
}
function fillStats() {
  let best = 0; try { best = +localStorage.getItem('zonebonk_best') || 0; if (G.t > best) localStorage.setItem('zonebonk_best', G.t); } catch (e) { /* storage unavailable */ }
  $('stats').innerHTML = `<div><b>${fmtTime(G.t)}</b>survived</div><div><b>${G.level}</b>level</div><div><b>${G.kills}</b>kills</div><div><b>${G.arts}</b>artifacts</div><div><b>${Math.round(G.dmg / 1000)}k</b>damage</div><div><b>${fmtTime(Math.max(best, G.t))}</b>best</div>`;
}
function togglePause() {
  if (!G) return;
  if (G.state === 'play') { G.state = 'pause'; buildPause(); show('pause'); }
  else if (G.state === 'pause') { G.state = 'play'; hide('pause'); }
}
function buildPause() {
  let h = '<h3>Weapons</h3>';
  for (const w of P.weapons) h += `<div class="row">${WEAPONS[w.id].icon} ${WEAPONS[w.id].name} <b>Lv ${w.lv}</b></div>`;
  h += '<h3>Artifacts</h3>';
  const ak = Object.keys(P.arts);
  if (!ak.length) h += '<div class="row dim">None yet — look inside anomaly fields (colored circles on the minimap).</div>';
  for (const id of ak) h += `<div class="row"><i class="dot" style="background:${ARTIFACTS[id].color}"></i> ${ARTIFACTS[id].name} ×${P.arts[id]} <span class="dim">${ARTIFACTS[id].desc}</span></div>`;
  $('build').innerHTML = h;
}
function toggleMap() {
  if (!G || (G.state !== 'play' && G.state !== 'map')) return;
  if (G.state === 'play') { G.state = 'map'; drawBigMap(); show('mapScreen'); }
  else { G.state = 'play'; hide('mapScreen'); }
}
function drawBigMap() {
  const c = $('bigmap'), S = Math.min(innerWidth, innerHeight) * 0.86;
  c.width = S * DPR; c.height = S * DPR; c.style.width = S + 'px'; c.style.height = S + 'px';
  const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(World.mapImg, 0, 0, S, S);
  const f = S / WORLD;
  for (const fl of World.fields) { g.fillStyle = ANOMALIES[fl.type].color; g.globalAlpha = 0.6; g.beginPath(); g.arc(fl.x * f, fl.y * f, 5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  for (const s of World.shelters) { g.fillStyle = '#5f5'; g.fillRect(s.x * f - 4, s.y * f - 4, 8, 8); g.strokeStyle = '#000'; g.strokeRect(s.x * f - 4, s.y * f - 4, 8, 8); }
  g.font = 'bold 13px Oswald, sans-serif'; g.textAlign = 'center';
  const seen = new Set();
  for (const r of REGIONS) { if (seen.has(r.name)) continue; seen.add(r.name); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(r.name.toUpperCase(), r.x * f + 1, r.y * f + 1); g.fillStyle = '#e8dcb0'; g.fillText(r.name.toUpperCase(), r.x * f, r.y * f); }
  g.font = '11px Oswald, sans-serif';
  for (const l of World.labels) { g.fillStyle = '#c8c0a0'; g.fillText('• ' + l.name, l.x * f, l.y * f + 16); }
  for (const b of G.bosses) { g.font = '18px sans-serif'; g.fillText('💀', b.x * f, b.y * f + 6); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(P.x * f, P.y * f, 6, 0, TAU); g.fill(); g.strokeStyle = '#e33'; g.lineWidth = 3; g.stroke();
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { tryDash(); e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G && G.state === 'map') toggleMap(); else togglePause(); }
  if (e.code === 'KeyM' || e.code === 'Tab') { toggleMap(); e.preventDefault(); }
  if (G && G.state === 'levelup' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) chooseCard(+e.code.slice(5) - 1);
  if (e.code === 'Enter' && $('title').classList.contains('show')) startGame();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G && G.state === 'play') togglePause(); });
const joy = { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 };
const knob = $('joyKnob'), base = $('joyBase');
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !G || G.state !== 'play') return;
  if (joy.active) { tryDash(); return; }
  joy.active = true; joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.dx = joy.dy = 0;
  base.style.display = 'block'; base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; knob.style.transform = 'translate(-50%,-50%)';
});
addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.sx, dy = e.clientY - joy.sy; const l = Math.hypot(dx, dy), m = 50;
  if (l > m) { dx = (dx / l) * m; dy = (dy / l) * m; }
  joy.dx = dx / m; joy.dy = dy / m;
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; base.style.display = 'none'; } };
addEventListener('pointerup', endJoy); addEventListener('pointercancel', endJoy);
$('dashBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); tryDash(); });
$('pauseBtn').addEventListener('click', () => togglePause());
$('mapBtn').addEventListener('click', () => toggleMap());
$('mapScreen').addEventListener('click', () => toggleMap());
$('muteBtn').addEventListener('click', () => { $('muteBtn').textContent = Sfx.toggle() ? '🔇' : '🔊'; });
$('resumeBtn').addEventListener('click', () => togglePause());
$('quitBtn').addEventListener('click', () => { hide('pause'); startGame(); });
$('againBtn').addEventListener('click', () => { hide('over'); startGame(); });
$('startBtn').addEventListener('click', () => startGame());
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.state === 'play') togglePause(); });

function startGame() {
  Sfx.init();
  hide('title'); hide('over'); hide('pause');
  newGame();
  $('hud').classList.add('show');
  if (matchMedia('(pointer: coarse)').matches) $('touchUi').classList.add('show');
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  NOW += dt;
  if (G) { update(dt); if (G.state === 'play' || G.state === 'levelup' || G.state === 'pause' || G.state === 'map' || G.state === 'over') { render(); hud(); } }
  else renderTitle(dt);
  requestAnimationFrame(frame);
}
// title background: slow drift across the Zone
const titleCam = { x: 3200, y: 4200 };
function renderTitle(dt) {
  titleCam.x += dt * 30; titleCam.y -= dt * 12;
  if (titleCam.x > 5600) titleCam.x = 1000;
  CAM.x = titleCam.x; CAM.y = titleCam.y;
  const fakeG = { decals: [], particles: [], texts: [], fx: [], bullets: [], ebullets: [], throws: [], gems: [], enemies: [], crates: [], pickups: [], bosses: [], shake: 0, flash: 0, psi: 0, em: null, rad: 0 };
  G = fakeG; const fakeP = { x: -9999, y: -9999, hp: 1, maxhp: 1, aura: 0, shards: 0, r: 1, z: 0 }; P = fakeP;
  try { render(); } finally { G = null; P = null; }
}

// ---------- boot ----------
resize();
EG.init();
World.gen();
requestAnimationFrame(frame);
