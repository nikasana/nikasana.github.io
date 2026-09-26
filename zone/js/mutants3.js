'use strict';
// ---------- phase 3 mutants, humans and bosses ----------
Object.assign(ENEMIES, {
  psideer: { name: 'Psi-Deer', hp: 90, spd: 110, dmg: 16, r: 16, xp: 9, mass: 1.4 },
  wolf: { name: 'Zone Wolf', hp: 32, spd: 165, dmg: 11, r: 13, xp: 3, mass: 0.9, vsc: 1.2 },
  spider: { name: 'Anomalous Spider', hp: 40, spd: 95, dmg: 10, r: 13, xp: 4, mass: 0.8 },
  bat: { name: 'Night Bat', hp: 8, spd: 190, dmg: 4, r: 8, xp: 1, mass: 0.2, fly: true },
  snake: { name: 'Swamp Snake', hp: 45, spd: 120, dmg: 14, r: 12, xp: 5, mass: 0.8 },
  eye: { name: 'Watcher Eye', hp: 35, spd: 70, dmg: 0, r: 14, xp: 6, mass: 0.5, fly: true },
  gorilla: { name: 'Gorilla', hp: 180, spd: 70, dmg: 22, r: 20, xp: 12, mass: 3 },
  larva: { name: 'Burer Larva', hp: 50, spd: 115, dmg: 15, r: 13, xp: 5, mass: 0.8 },
  webctrl: { name: 'Web Controller', hp: 150, spd: 45, dmg: 12, r: 17, xp: 12, mass: 2 },
  ratking: { name: 'Rat King', hp: 160, spd: 80, dmg: 14, r: 20, xp: 14, mass: 2, vsc: 2.2 },
  wraith: { name: 'Wraith', hp: 70, spd: 80, dmg: 12, r: 15, xp: 9, mass: 0.8, fly: true },
  exo: { name: 'Monolith Exo', hp: 320, spd: 45, dmg: 9, r: 18, xp: 20, mass: 4, vsc: 1.3 },
  bandit: { name: 'Bandit', hp: 60, spd: 125, dmg: 8, r: 13, xp: 6, mass: 1 },
  soldier: { name: 'Military', hp: 90, spd: 70, dmg: 12, r: 13, xp: 8, mass: 1.1 },
  mimic: { name: 'Mimic', hp: 120, spd: 100, dmg: 18, r: 16, xp: 10, mass: 1.2 },
  ghost: { name: 'Ghost Stalker', hp: 900, spd: 95, dmg: 16, r: 14, xp: 60, mass: 3 },
  holoclone: { name: 'Hologram', hp: 1, spd: 90, dmg: 6, r: 14, xp: 0, mass: 0.5, fly: true },
  serpent: { name: 'ZONE SERPENT', boss: true, hp: 5000, spd: 150, dmg: 26, r: 30, xp: 220, mass: 99 },
  heli: { name: 'MILITARY GUNSHIP', boss: true, hp: 4600, spd: 120, dmg: 22, r: 40, xp: 220, mass: 99, fly: true },
  hologram: { name: 'C-CONSCIOUSNESS', boss: true, hp: 5400, spd: 60, dmg: 24, r: 30, xp: 240, mass: 99, fly: true, vsc: 1.6 },
});
BOSS_POOL.push('serpent', 'heli', 'hologram');
MUTATIONS.frozen = { name: 'Frozen', color: '#bfe8ff', rgb: '191,232,255', desc: 'chill you to the bone when they hit' };
const HUMANS = new Set(['bandit', 'soldier', 'exo', 'ghost']);

// spawn table additions (layered on top of the base table, modest weights)
function spawnTable3(t, m, lab, reg) {
  if (lab) { if (m >= 4) { t.spider = 8; t.larva = 6; } if (m >= 9) t.wraith = 5; return t; }
  if (m >= 2.5) t.wolf = 10;
  if (m >= 3) t.bandit = 5;
  if (m >= 3.5) t.spider = 7;
  if (m >= 4.5) t.eye = 4;
  if (m >= 5) t.larva = 6;
  if (m >= 6) { t.gorilla = 5; t.soldier = 4; t.psideer = 4; }
  if (m >= 7) t.ratking = 3;
  if (m >= 8) t.webctrl = 3;
  if (m >= 9) t.wraith = 4;
  if (m >= 12) t.exo = 3;
  if (reg && reg.water) t.snake = 12;
  if (Env.isNight()) t.bat = 14;
  return t;
}
const PACKS = { wolf: [3, 4], bat: [5, 8], soldier: [3, 3], bandit: [2, 3] };

// ---------- AI (returns new [vx, vy] or null for plain chase) ----------
function aiExtra(e, dt, d, ux, uy, sp, dx, dy) {
  const tan = () => [-uy * sp, ux * sp];
  switch (e.id) {
    case 'psideer':
      if (e.cd2 <= 0 && d < 520) { e.cd2 = rand(6, 8); for (let i = 0; i < 2; i++) { const p = spawnEnemy('phantom', e.x + rand(-50, 50), e.y + rand(-40, 40), { noElite: true }); p.life = 6; } Sfx.play('psi'); }
      if (e.state === 0 && e.cd <= 0 && d < 400) { e.state = 3; e.st = 0.5; e.chA = Math.atan2(dy, dx); tele(e.x, e.y, e.x + Math.cos(e.chA) * 320, e.y + Math.sin(e.chA) * 320, 30, 0.4); }
      if (e.state === 3) { e.st -= dt; if (e.st < 0.1) { if (e.st <= 0) { e.state = 0; e.cd = rand(4, 6); } return [Math.cos(e.chA) * 560, Math.sin(e.chA) * 560]; } return [0, 0]; }
      if (d < 220) return [-ux * sp * 0.6, -uy * sp * 0.6];
      return null;
    case 'wolf':
      if (e.circleT === undefined) e.circleT = rand(1.5, 3.5);
      if (e.circleT > 0 && d < 340) { e.circleT -= dt; const [tx, ty] = tan(); const pull = (d - 200) / 200; return [tx + ux * sp * pull, ty + uy * sp * pull]; }
      return [ux * sp * 1.25, uy * sp * 1.25];
    case 'spider':
      if (e.cd <= 0) { e.cd = rand(2.5, 3.5); patch(e.x, e.y, 'web', 46, 6); }
      return null;
    case 'bat': {
      e.z = 30 + Math.sin(e.t * 9 + e.seed) * 10;
      const w = Math.sin(e.t * 6 + e.seed) * 0.9; return [ux * sp - uy * sp * w, uy * sp + ux * sp * w];
    }
    case 'snake':
      e.alpha = lerp(e.alpha, d < 160 || e.reveal > 0 ? 1 : 0.12, dt * 6);
      if (e.state === 0 && d < 150 && e.cd <= 0) { e.state = 2; e.st = 0.3; e.lvx = ux * 620; e.lvy = uy * 620; }
      if (e.state === 2) { e.st -= dt; if (e.st <= 0) { e.state = 0; e.cd = rand(2, 3); } return [e.lvx, e.lvy]; }
      return [ux * sp * 0.6, uy * sp * 0.6];
    case 'eye':
      e.z = 40 + Math.sin(e.t * 2) * 6;
      if (d < 620) G.markT = 0.25;
      if (d < 260) return [-ux * sp, -uy * sp]; if (d < 340) return tan();
      return null;
    case 'gorilla':
      if (d < 240) return [-ux * sp * 0.6, -uy * sp * 0.6];
      if (e.cd <= 0 && d < 560) {
        e.cd = rand(3, 4); e.cast = 0.6;
        const x = P.x + rand(-40, 40), y = P.y + rand(-30, 30);
        G.fx.push({ k: 'target', x, y, r: 60, life: 1, max: 1 });
        G.throws.push({ x0: e.x, y0: e.y - 40, x1: x, y1: y, t: 0, T: 1, dmg: e.dmg, r: 60, k: 'erock' });
        Sfx.play('throw');
      }
      if (d < 360) return [0, 0];
      return null;
    case 'larva':
      if (e.burrow === undefined) e.burrow = true;
      if (e.burrow) {
        e.alpha = 0; e.hidden = true; if (Math.random() < 0.5) part(e.x + rand(-8, 8), e.y, { z: 2, vz: 60, g: 300, c: '110,90,60', s: 3, life: 0.4 });
        if (d < 80) { e.burrow = false; e.hidden = false; e.alpha = 1; e.st = 3.5; burst(e.x, e.y, 16, '110,90,60', 160, { s: 4 }); Sfx.play('break'); }
        return [ux * sp * 1.4, uy * sp * 1.4];
      }
      e.st -= dt; if (e.st <= 0) e.burrow = true;
      return null;
    case 'webctrl':
      if (d < 300) return [-ux * sp * 0.6, -uy * sp * 0.6];
      if (e.cd <= 0 && d < 520) { e.cd = rand(2.6, 3.4); e.cast = 0.5; enemyShoot(e, Math.atan2(dy, dx), 230, e.dmg, 'web', 10); }
      if (d < 420) return [0, 0];
      return null;
    case 'ratking':
      if (e.cd2 <= 0) { e.cd2 = 5.5; for (let i = 0; i < 3; i++) { const a = rand(TAU); spawnEnemy('rat', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30, { noElite: true }); } }
      return null;
    case 'wraith':
      e.z = 22 + Math.sin(e.t * 3) * 6;
      e.alpha = lerp(e.alpha, d < 130 || e.reveal > 0 || e.flash > 0 ? 0.9 : 0.12, dt * 5);
      if (e.cd <= 0 && d < 480) { e.cd = rand(2.2, 3); enemyShoot(e, Math.atan2(dy, dx), 300, e.dmg, 'debris', 8); }
      if (d < 260) return tan();
      return null;
    case 'exo':
      if (d < 300) return [-ux * sp * 0.5, -uy * sp * 0.5];
      if (e.state === 0 && e.cd <= 0 && d < 560 && G.shotBudget >= 1) { G.shotBudget--; e.state = 1; e.st = 0.8; e.aimA = Math.atan2(dy, dx); tele(e.x, e.y - 20, e.x + Math.cos(e.aimA) * 600, e.y - 20 + Math.sin(e.aimA) * 600, 24, 0.8); }
      if (e.state === 1) { e.st -= dt; if (e.st <= 0) { e.state = 2; e.st = 1.2; } return [0, 0]; }
      if (e.state === 2) { e.st -= dt; e.fireT = (e.fireT || 0) - dt; if (e.fireT <= 0) { e.fireT = 0.1; enemyShoot(e, e.aimA + rand(-0.08, 0.08), 460, e.dmg, 'bullet', 4, true); Sfx.play('ak'); } if (e.st <= 0) { e.state = 0; e.cd = rand(4, 5); } return [0, 0]; }
      if (d < 420) return [0, 0];
      return null;
    case 'bandit':
      if (e.flee > 0) { e.flee -= dt; if (e.flee <= 0 || d > 1300) { e.dead = true; banner('THE BANDIT GOT AWAY', `You lost ${Math.round(e.loot)} ₽`, 2, 'bad'); } return [-ux * sp * 1.3, -uy * sp * 1.3]; }
      return null;
    case 'soldier': {
      let tgt = null, bd = 420 * 420;
      EG.query(e.x, e.y, 420, TMP3);
      for (const o of TMP3) if (!o.dead && !HUMANS.has(o.id) && o.id !== 'phantom') { const q = dist2(e.x, e.y, o.x, o.y); if (q < bd) { bd = q; tgt = o; } }
      const aimP = !tgt || d * d < bd * 0.6;
      if (e.cd <= 0) {
        if (!aimP && tgt) { e.cd = 1.1; hurtEnemy(tgt, e.dmg * 1.5, 0, 0, true); G.fx.push({ k: 'beam', x: e.x, y: e.y - 22, x2: tgt.x, y2: tgt.y - 14, w: 1.5, life: 0.08, max: 0.08 }); Sfx.play('pistol'); }
        else if (d < 460) { e.cd = rand(1.6, 2.2); enemyShoot(e, Math.atan2(dy, dx), 380, e.dmg, 'bullet', 4); Sfx.play('pistol'); }
      }
      if (tgt && !aimP) { const tx = tgt.x - e.x, ty = tgt.y - e.y, td = Math.hypot(tx, ty) || 1; e.face = tx > 0 ? 1 : -1; return td > 200 ? [tx / td * sp, ty / td * sp] : [0, 0]; }
      if (d < 300) return [0, 0];
      return null;
    }
    case 'ghost':
      e.alpha = 0.55 + Math.sin(e.t * 3) * 0.2;
      if (e.cd <= 0 && d < 520) { e.cd = rand(1.2, 1.8); for (let i = -1; i <= 1; i++) enemyShoot(e, Math.atan2(dy, dx) + i * 0.15, 360, e.dmg, 'psi', 7, true); }
      if (d < 240) return tan();
      return null;
    case 'holoclone':
      e.alpha = 0.4 + Math.sin(e.t * 12) * 0.15; e.z = 20;
      e.life = (e.life ?? 8) - dt; if (e.life <= 0) e.dead = true;
      return null;
    // ----- bosses -----
    case 'serpent': {
      e.trail = e.trail || [];
      e.trail.unshift([e.x, e.y]); if (e.trail.length > 90) e.trail.pop();
      for (let i = 8; i < e.trail.length; i += 8) { const [sx, sy] = e.trail[i]; if (dist2(sx, sy, P.x, P.y) < (22 + P.r) ** 2) { hurtPlayer(e.dmg * 0.6, e.name); break; } }
      if (e.state === 0 && e.cd <= 0 && d < 500) { e.state = 4; e.st = 0.6; e.chA = Math.atan2(dy, dx); tele(e.x, e.y, e.x + Math.cos(e.chA) * 520, e.y + Math.sin(e.chA) * 520, 44, 0.6); }
      if (e.state === 4) { e.st -= dt; if (e.st <= 0) { e.state = 3; e.st = 0.7; Sfx.play('roar'); } return [Math.cos(e.chA) * 60, Math.sin(e.chA) * 60]; }
      if (e.state === 3) { e.st -= dt; if (e.st <= 0) { e.state = 0; e.cd = e.enraged ? 2.5 : 4; } return [Math.cos(e.chA) * 820, Math.sin(e.chA) * 820]; }
      const [tx, ty] = tan(), pull = (d - 320) / 220;
      return [tx * 1.1 + ux * sp * pull, ty * 1.1 + uy * sp * pull];
    }
    case 'heli': {
      e.z = 70 + Math.sin(e.t) * 6;
      if (e.cd <= 0) {
        e.cd = e.enraged ? 3 : 4.5;
        for (let i = 0; i < (e.enraged ? 6 : 4); i++) { const x = P.x + rand(-160, 160), y = P.y + rand(-120, 120); G.fx.push({ k: 'target', x, y, r: 70, life: 1.1, max: 1.1 }); G.timers.push({ t: 1.1, fn: () => explode(x, y, 70, 26, false) }); }
        Sfx.play('throw');
      }
      if (e.state === 0 && e.cd2 <= 0) { e.state = 1; e.st = 0.8; e.aimA = Math.atan2(dy, dx); tele(e.x, e.y - e.z, e.x + Math.cos(e.aimA) * 700, e.y - e.z + Math.sin(e.aimA) * 700, 30, 0.8); }
      if (e.state === 1) { e.st -= dt; if (e.st <= 0) { e.state = 0; e.cd2 = e.enraged ? 5 : 7; for (let i = 0; i < 12; i++) G.timers.push({ t: i * 0.06, fn: () => { if (!e.dead) enemyShoot(e, e.aimA + rand(-0.05, 0.05), 520, 14, 'bullet', 5); } }); Sfx.play('ak'); } }
      const [tx, ty] = tan(), pull = (d - 380) / 250;
      return [tx + ux * sp * pull, ty + uy * sp * pull];
    }
    case 'hologram':
      e.z = 30 + Math.sin(e.t * 2) * 8;
      if (e.cd3 <= 0) { e.cd3 = e.enraged ? 3 : 4.5; burst(e.x, e.y - 30, 20, '140,220,255', 180, { add: true }); const a = rand(TAU), nx = P.x + Math.cos(a) * 320, ny = P.y + Math.sin(a) * 240; if (World.free(nx, ny, 30)) { e.x = nx; e.y = ny; } }
      if (e.cd2 <= 0) { e.cd2 = 9; for (let i = 0; i < 3; i++) { const c = spawnEnemy('holoclone', e.x + rand(-80, 80), e.y + rand(-60, 60), { noElite: true }); c.life = 8; } }
      if (e.cd <= 0) { e.cd = e.enraged ? 2 : 3; const off = rand(TAU); for (let i = 0; i < 18; i++) enemyShoot(e, off + (i / 18) * TAU, 190, 16, i % 2 ? 'fake' : 'mono', 7); Sfx.play('psi'); }
      if (d < 280) return [-ux * sp, -uy * sp];
      return null;
  }
  return null;
}
function onKill3(e) {
  if (e.id === 'ratking') for (let i = 0; i < 6; i++) { const a = rand(TAU); spawnEnemy('rat', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30, { noElite: true }); }
  if (e.id === 'bandit' && e.loot) { G.rubles += e.loot * 1.5; banner('LOOT RECOVERED', `+${Math.round(e.loot * 1.5)} ₽`, 2, 'good'); }
  if ((e.id === 'soldier' || e.id === 'exo') && Math.random() < 0.3) G.pickups.push({ type: 'item', id: pick(Object.keys(ITEMS)), x: e.x, y: e.y, t: 0 });
  if (e.id === 'mimic') { G.pickups.push({ type: 'item', id: pick(Object.keys(ITEMS)), x: e.x, y: e.y, t: 0 }); for (let i = 0; i < 5; i++) dropGem(e.x, e.y, 4); }
  if (e.id === 'ghost') { G.pendingLv += 2; G.rubles += 100; banner('THE GHOST IS AT PEACE', '+2 levels, +100 ₽', 3, 'good', 2); Save.data.ghost = null; Save.save(); }
}
function onContact3(e) {
  if (e.id === 'bandit' && !e.flee) {
    const s = Math.min(40, G.rubles * 0.1); G.rubles -= s; e.loot = (e.loot || 0) + s; e.flee = 8;
    if (s >= 1) banner('A BANDIT STOLE ' + Math.round(s) + ' ₽!', 'Kill him before he escapes to get it back.', 2.5, 'bad');
  }
  if (e.mut === 'frozen') P.chillT = 1.5;
}

// ---------- drawing ----------
function drawDeer(e) {
  const f = e.face, a = e.anim;
  ctx.save(); ctx.globalAlpha = e.id === 'psideer' ? 0.95 : 1; ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.strokeStyle = col('#6a5040'); ctx.lineWidth = 3; ctx.lineCap = 'round'; const l = Math.sin(a) * 6;
  ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(-9 + l, 0); ctx.moveTo(-4, -14); ctx.lineTo(-4 - l, 0); ctx.moveTo(8, -14); ctx.lineTo(8 - l, 0); ctx.moveTo(12, -14); ctx.lineTo(12 + l, 0); ctx.stroke();
  ctx.fillStyle = col('#8a6a52'); ctx.beginPath(); ctx.ellipse(1, -20, 15, 8, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -30, 5, 9, 0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(21, -36, 6, 4, 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = col('#d8c8a8'); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(19, -39); ctx.lineTo(15, -50); ctx.lineTo(10, -53); ctx.moveTo(15, -50); ctx.lineTo(18, -56); ctx.moveTo(22, -39); ctx.lineTo(25, -51); ctx.lineTo(30, -54); ctx.stroke();
  ctx.fillStyle = '#d070ff'; ctx.fillRect(22, -38, 2, 2);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,120,255,0.15)'; ctx.beginPath(); ctx.arc(e.x, e.y - 30, 26, 0, TAU); ctx.fill(); ctx.restore();
}
function drawSpider(e) {
  const a = e.anim;
  ctx.save(); ctx.translate(e.x, e.y - e.z);
  ctx.strokeStyle = col('#2a2420'); ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const k = Math.sin(a + i) * 3; ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(s * (10 + i * 2), -16 - k, s * (14 + i * 3), -2 + k); ctx.stroke(); }
  ctx.fillStyle = col('#3a302a'); ctx.beginPath(); ctx.ellipse(0, -10, 9, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#5a2a2a'); ctx.beginPath(); ctx.ellipse(0, -4, 6, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff3a2a'; for (const x of [-3, -1, 1, 3]) ctx.fillRect(x - 0.5, -14, 1.5, 1.5);
  ctx.restore();
}
function drawBat(e) {
  const w = Math.sin(NOW * 22 + e.seed) * 8;
  ctx.save(); ctx.translate(e.x, e.y - e.z);
  ctx.fillStyle = col('#2a2228');
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-12, -4 - w); ctx.lineTo(-6, 0); ctx.lineTo(0, -1); ctx.lineTo(6, 0); ctx.lineTo(12, -4 - w); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -3, 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff4040'; ctx.fillRect(-2, -4, 1.3, 1.3); ctx.fillRect(1, -4, 1.3, 1.3);
  ctx.restore();
}
function drawSnake(e) {
  ctx.save(); ctx.globalAlpha = e.alpha ?? 1;
  ctx.strokeStyle = col('#4a6a3a'); ctx.lineWidth = 7; ctx.lineCap = 'round';
  const f = e.face, t = NOW * 8 + e.seed;
  ctx.beginPath(); for (let i = 0; i < 7; i++) { const x = e.x - f * i * 5, y = e.y - 6 + Math.sin(t - i * 0.9) * 4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  ctx.fillStyle = col('#5a7a4a'); ctx.beginPath(); ctx.ellipse(e.x + f * 4, e.y - 8, 6, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd040'; ctx.fillRect(e.x + f * 6, e.y - 10, 1.5, 1.5);
  ctx.restore();
}
function drawEye(e) {
  const x = e.x, y = e.y - e.z;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,60,0.15)'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = col('#e8e0d0'); ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  ctx.fillStyle = col('#c83a2a'); ctx.beginPath(); ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = col('#8a3a3a'); ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { const b = i * 1.3 + NOW; ctx.beginPath(); ctx.moveTo(x + Math.cos(b) * 12, y + Math.sin(b) * 12); ctx.quadraticCurveTo(x + Math.cos(b) * 18, y + Math.sin(b) * 18 + 6, x + Math.cos(b) * 22, y + Math.sin(b) * 20 + 10); ctx.stroke(); }
}
function drawGorilla(e) {
  const f = e.face, a = e.anim, throwing = e.cast > 0;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.fillStyle = col('#3a3432'); const l = Math.sin(a) * 4;
  ctx.fillRect(-10 + l, -14, 8, 14); ctx.fillRect(3 - l, -14, 8, 14);
  ctx.beginPath(); ctx.ellipse(0, -32, 18, 18, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#5a524e'); ctx.beginPath(); ctx.ellipse(6, -38, 10, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#8a7a70'); ctx.beginPath(); ctx.ellipse(12, -38, 6, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffcc30'; ctx.fillRect(10, -41, 2, 2);
  ctx.strokeStyle = col('#3a3432'); ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(12, -32); ctx.lineTo(throwing ? 18 : 24, throwing ? -58 : -6); ctx.stroke();
  if (throwing) { ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.arc(18, -62, 7, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawLarva(e) {
  if (e.burrow) { ctx.fillStyle = 'rgba(90,70,50,0.8)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 14, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(120,95,70,0.9)'; ctx.beginPath(); ctx.ellipse(e.x - 3, e.y - 2, 7, 3, 0, 0, TAU); ctx.fill(); return; }
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.face, 1);
  ctx.fillStyle = col('#c8b890');
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-i * 6, -8 - Math.sin(NOW * 8 + i) * 2, 7 - i * 0.6, 6 - i * 0.5, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.arc(5, -9, 3, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawExo(e) { drawStalker(e, { pants: '#4a4e50', pack: '#3a3e40', jacket: '#7a7e78', jacket2: '#5a5e58', hood: '#9a9e98', face: '#101418', gun: true, mask: true, arms: e.state ? e.aimA : Math.atan2(P.y - e.y, P.x - e.x) }, false); }
function drawBandit(e) { drawStalker(e, { pants: '#2a2a2a', pack: '#3a3024', jacket: '#3a2e24', jacket2: '#2a2018', hood: '#1a1a1a', face: '#c8a080', gun: true, arms: Math.atan2(P.y - e.y, P.x - e.x) }, false); if (e.loot) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💰', e.x, e.y - e.z - 52); } }
function drawSoldier(e) { drawStalker(e, { pants: '#3a4a30', pack: '#2e3a26', jacket: '#4e5e3a', jacket2: '#3a4a2a', hood: '#3a4a30', face: '#c8a080', gun: true, arms: e.face > 0 ? 0 : Math.PI }, false); ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.ellipse(e.x, e.y - e.z - 42, 9, 5, 0, Math.PI, TAU); ctx.fill(); }
function drawGhost(e) { ctx.save(); ctx.globalAlpha = e.alpha ?? 0.6; ctx.globalCompositeOperation = 'lighter'; drawStalker(e, { pants: '#6a9aaa', pack: '#5a8a9a', jacket: '#8ac8d8', jacket2: '#6aa8b8', hood: '#9ad8e8', face: '#ddf', gun: true, arms: Math.atan2(P.y - e.y, P.x - e.x) }, false); ctx.restore(); }
function drawMimic(e) {
  const open = Math.abs(Math.sin(NOW * 6 + e.seed)) * 10;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = col('#6a4e2e'); ctx.fillRect(-16, -18, 32, 18);
  ctx.save(); ctx.translate(0, -18); ctx.rotate(-open * 0.04); ctx.fillStyle = col('#86653c'); ctx.fillRect(-16, -8, 32, 8); ctx.restore();
  ctx.fillStyle = '#f0e8d0'; for (let i = -12; i <= 12; i += 6) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i + 3, -12); ctx.lineTo(i + 6, -18); ctx.fill(); }
  ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.ellipse(0, -16 - open * 0.5, 8, 3, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawSerpent(e) {
  const tr = e.trail || [];
  for (let i = tr.length - 1; i >= 0; i -= 6) {
    const [x, y] = tr[i], s = 1 - i / 110;
    shadow(x, y + 4, 22 * s, 8 * s, 0.25);
    ctx.fillStyle = col(i % 12 ? '#4a5a3a' : '#5e6e44'); ctx.beginPath(); ctx.ellipse(x, y - 14, 24 * s, 16 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col('#8a9a5a'); ctx.beginPath(); ctx.ellipse(x, y - 20, 10 * s, 5 * s, 0, 0, TAU); ctx.fill();
  }
  const f = e.face;
  ctx.fillStyle = col('#5e6e44'); ctx.beginPath(); ctx.ellipse(e.x + f * 10, e.y - 20, 30, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffdc30'; ctx.beginPath(); ctx.arc(e.x + f * 26, e.y - 28, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8e0d0'; ctx.fillRect(e.x + f * 30 - 2, e.y - 14, 4, 8);
}
function drawHeli(e) {
  const x = e.x, y = e.y - e.z;
  shadow(e.x, e.y, 70, 20, 0.3);
  ctx.fillStyle = col('#3e4a36'); ctx.beginPath(); ctx.ellipse(x, y, 46, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#20262a'); ctx.beginPath(); ctx.ellipse(x + e.face * 26, y - 2, 16, 11, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col('#3e4a36'); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - e.face * 40, y); ctx.lineTo(x - e.face * 95, y - 8); ctx.stroke();
  ctx.fillStyle = col('#2a2e28'); ctx.fillRect(x - 30, y + 14, 60, 4);
  ctx.strokeStyle = 'rgba(40,40,40,0.55)'; ctx.lineWidth = 4;
  const r = NOW * 30; ctx.beginPath(); ctx.moveTo(x + Math.cos(r) * 90, y - 22 + Math.sin(r) * 16); ctx.lineTo(x - Math.cos(r) * 90, y - 22 - Math.sin(r) * 16); ctx.moveTo(x + Math.cos(r + 1.57) * 90, y - 22 + Math.sin(r + 1.57) * 16); ctx.lineTo(x - Math.cos(r + 1.57) * 90, y - 22 - Math.sin(r + 1.57) * 16); ctx.stroke();
  ctx.fillStyle = Math.sin(NOW * 10) > 0 ? '#ff3030' : '#300'; ctx.beginPath(); ctx.arc(x - e.face * 94, y - 10, 3, 0, TAU); ctx.fill();
}
function drawHologram(e) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 + Math.sin(NOW * 20) * 0.1;
  const x = e.x, y = e.y - e.z;
  const g = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 70); g.addColorStop(0, 'rgba(140,220,255,0.5)'); g.addColorStop(1, 'rgba(60,120,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 30, 70, 0, TAU); ctx.fill();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(150,230,255,${0.12 + (i % 2) * 0.1})`; ctx.fillRect(x - 18, y - 60 + i * 8 + Math.sin(NOW * 6 + i) * 2, 36, 5); }
  ctx.strokeStyle = 'rgba(200,245,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 58, 12, 0, TAU); ctx.stroke();
  ctx.restore();
}
Object.assign(ENEMY_DRAW, {
  psideer: drawDeer, wolf: drawDog,
  spider: drawSpider, bat: drawBat, snake: drawSnake, eye: drawEye, gorilla: drawGorilla, larva: drawLarva,
  webctrl: (e) => { drawController(e); ctx.strokeStyle = 'rgba(240,240,240,0.5)'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.beginPath(); ctx.moveTo(e.x, e.y - 30); ctx.lineTo(e.x + Math.cos(a) * 30, e.y - 30 + Math.sin(a) * 30); ctx.stroke(); } },
  ratking: (e) => { drawRat(e); crown(e, 12, '#ffe070'); },
  wraith: (e) => { ctx.save(); ctx.globalAlpha = e.alpha; drawPoltergeist(e); ctx.restore(); },
  exo: drawExo, bandit: drawBandit, soldier: drawSoldier, mimic: drawMimic, ghost: drawGhost,
  holoclone: (e) => { ctx.save(); ctx.globalAlpha = e.alpha ?? 0.5; drawHologram({ ...e, z: e.z }); ctx.restore(); },
  serpent: drawSerpent, heli: drawHeli, hologram: drawHologram,
});
