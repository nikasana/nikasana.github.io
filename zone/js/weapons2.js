'use strict';
// ---------- 20 extra weapons, deployables, consumables and the in-run talent tree ----------
Object.assign(WEAPONS, {
  crossbow: { name: 'Crossbow', icon: '🏹', max: 6, tag: 'fire', desc: 'Heavy bolts that pierce and explode.',
    ups: ['', '+Damage', '+Blast radius', 'Fires 2 bolts', '+Damage', 'Fires 3 bolts'], stats: (l) => ({ dmg: 28 + l * 9, cd: 1.3 - l * 0.08, count: l >= 6 ? 3 : l >= 4 ? 2 : 1, radius: 55 + l * 6 }) },
  flamer: { name: 'Flamethrower', icon: '🔥', max: 6, tag: 'fire', desc: 'Short cone of fire that ignites everything.',
    ups: ['', '+Range', '+Damage', 'Wider cone', '+Burn', 'Inferno'], stats: (l) => ({ dmg: 5 + l * 1.6, cd: 0.09, range: 0.32 + l * 0.03, spread: l >= 4 ? 0.7 : 0.45 }) },
  c4: { name: 'C4 Charges', icon: '🧨', max: 6, tag: 'fire', desc: 'Plants charges that blow up when mutants come close.',
    ups: ['', '+Damage', '+Radius', 'Plant 2', 'Faster planting', 'Plant 3'], stats: (l) => ({ dmg: 70 + l * 25, cd: 3.4 - l * 0.25, count: l >= 6 ? 3 : l >= 4 ? 2 : 1, radius: 90 + l * 10 }) },
  boomerang: { name: 'Boomerang Blade', icon: '🪃', max: 6, tag: 'gravity', desc: 'A blade that flies out and comes back.',
    ups: ['', '+Damage', 'Throw 2', 'Longer flight', '+Damage', 'Throw 3'], stats: (l) => ({ dmg: 16 + l * 6, cd: 1.5 - l * 0.08, count: l >= 6 ? 3 : l >= 3 ? 2 : 1, range: 320 + l * 25 }) },
  sniper: { name: 'Sniper Rifle', icon: '🎯', max: 6, tag: null, desc: 'Picks off the toughest mutant in sight.',
    ups: ['', '+Damage', '+Pierce', 'Faster bolt action', '+Damage', 'Headshots always crit'], stats: (l) => ({ dmg: 90 + l * 35, cd: 2.4 - l * 0.18, pierce: 1 + Math.floor(l / 2) }) },
  dual: { name: 'Dual Pistols', icon: '🔫', max: 6, tag: null, desc: 'Two guns, two targets, very fast.',
    ups: ['', '+Fire rate', '+Damage', 'Pierce 1', '+Fire rate', 'Four targets'], stats: (l) => ({ dmg: 8 + l * 2.5, cd: 0.34 - l * 0.025, targets: l >= 6 ? 4 : 2, pierce: l >= 4 ? 1 : 0 }) },
  acid: { name: 'Acid Launcher', icon: '🧪', max: 6, tag: 'bio', desc: 'Lobs acid that leaves corrosive puddles.',
    ups: ['', '+Puddle size', '+Damage', 'Fire 2', 'Longer puddles', 'Fire 3'], stats: (l) => ({ dmg: 14 + l * 5, cd: 2.2 - l * 0.15, count: l >= 6 ? 3 : l >= 4 ? 2 : 1, radius: 70 + l * 8, life: 3 + l * 0.4 }) },
  tesla: { name: 'Tesla Gun', icon: '🔌', max: 6, tag: 'electric', desc: 'Continuous arc that jumps between mutants.',
    ups: ['', '+1 jump', '+Damage', '+Range', '+1 jump', 'Overcharge'], stats: (l) => ({ dmg: 7 + l * 2.5, cd: 0.22, jumps: 1 + Math.ceil(l / 2), range: 260 + l * 20 }) },
  gravgun: { name: 'Gravity Gun', icon: '🌀', max: 6, tag: 'gravity', desc: 'Fires a slow singularity that drags mutants along.',
    ups: ['', '+Pull', '+Damage', 'Bigger core', 'Faster', 'Twin orbs'], stats: (l) => ({ dmg: 30 + l * 12, cd: 3 - l * 0.2, count: l >= 6 ? 2 : 1, radius: 110 + l * 10 }) },
  axe: { name: 'Fire Axe', icon: '🪓', max: 6, tag: 'bio', desc: 'Huge spinning swing with massive knockback.',
    ups: ['', '+Damage', '+Reach', 'Faster swings', '+Damage', 'Double spin'], stats: (l) => ({ dmg: 38 + l * 12, cd: 1.7 - l * 0.12, radius: 100 + l * 10, spins: l >= 6 ? 2 : 1 }) },
  drone: { name: 'Combat Drone', icon: '🛸', max: 6, tag: 'electric', desc: 'A drone that orbits you and shoots.',
    ups: ['', '+Fire rate', '+Damage', 'Second drone', '+Fire rate', 'Third drone'], stats: (l) => ({ dmg: 9 + l * 3, cd: 0.55 - l * 0.04, drones: l >= 6 ? 3 : l >= 4 ? 2 : 1 }) },
  turret: { name: 'Auto-Turret', icon: '🗼', max: 6, tag: null, desc: 'Deploys a turret that guards the area.',
    ups: ['', '+Damage', 'Longer lifetime', '+Fire rate', 'Two turrets', 'Rocket turret'], stats: (l) => ({ dmg: 8 + l * 3, cd: 8 - l * 0.5, life: 10 + l * 2, rate: 0.35 - l * 0.03, max: l >= 5 ? 2 : 1 }) },
  bell: { name: 'Psi Bell', icon: '🔔', max: 6, tag: 'psi', desc: 'Its toll stuns every mutant around you.',
    ups: ['', '+Radius', '+Stun', '+Damage', 'Faster tolls', 'Echo toll'], stats: (l) => ({ dmg: 12 + l * 6, cd: 4.5 - l * 0.3, radius: 200 + l * 20, stun: 0.8 + l * 0.15 }) },
  rpg: { name: 'RPG-7', icon: '🚀', max: 6, tag: 'fire', desc: 'A rocket into the biggest crowd.',
    ups: ['', '+Damage', '+Radius', 'Faster reload', '+Damage', 'Two rockets'], stats: (l) => ({ dmg: 90 + l * 30, cd: 3.2 - l * 0.22, radius: 120 + l * 10, count: l >= 6 ? 2 : 1 }) },
  traps: { name: 'Bear Traps', icon: '🪤', max: 6, tag: null, desc: 'Drops traps that snap shut on mutants.',
    ups: ['', '+Damage', 'More traps', 'Longer hold', '+Damage', 'Explosive traps'], stats: (l) => ({ dmg: 40 + l * 14, cd: 1.6 - l * 0.1, max: 4 + l, hold: 1.5 + l * 0.2 }) },
  radgun: { name: 'Radiation Gun', icon: '☢️', max: 6, tag: 'bio', desc: 'Shots leave radioactive zones behind.',
    ups: ['', '+Zone damage', '+Zone size', 'Faster', 'Longer zones', 'Twin shots'], stats: (l) => ({ dmg: 14 + l * 4, cd: 1.5 - l * 0.1, radius: 70 + l * 7, life: 3 + l * 0.4, count: l >= 6 ? 2 : 1 }) },
  freeze: { name: 'Freeze Ray', icon: '🧊', max: 6, tag: 'psi', desc: 'An icy beam that freezes mutants solid.',
    ups: ['', '+Damage', '+Freeze time', 'Wider beam', '+Damage', 'Shatter: frozen take +50%'], stats: (l) => ({ dmg: 25 + l * 10, cd: 2.2 - l * 0.15, width: 14 + l * 2, freeze: 0.8 + l * 0.15 }) },
  flare: { name: 'Flare Gun', icon: '🎆', max: 6, tag: 'fire', desc: 'Flares that burn the ground and light the night.',
    ups: ['', '+Burn', '+Area', 'Fire 2', 'Longer burn', 'Fire 3'], stats: (l) => ({ dmg: 18 + l * 6, cd: 2.4 - l * 0.15, count: l >= 6 ? 3 : l >= 4 ? 2 : 1, radius: 85 + l * 8, life: 3.5 + l * 0.3 }) },
  swarm: { name: 'Swarm Launcher', icon: '🐝', max: 6, tag: null, desc: 'Homing micro-rockets that hunt mutants down.',
    ups: ['', '+2 rockets', '+Damage', '+2 rockets', 'Faster reload', '+4 rockets'], stats: (l) => ({ dmg: 14 + l * 4, cd: 2.6 - l * 0.15, count: 4 + Math.floor(l / 2) * 2 + (l >= 6 ? 2 : 0) }) },
  guitar: { name: 'Cheeki Guitar', icon: '🎸', max: 6, tag: 'psi', desc: 'Power chords send out crushing sound waves.',
    ups: ['', '+Damage', '+Radius', 'Faster riffs', '+Knockback', 'Encore: double chord'], stats: (l) => ({ dmg: 20 + l * 8, cd: 2.2 - l * 0.15, radius: 230 + l * 20, knock: 300 + l * 60, echo: l >= 6 }) },
});

// ---------- firing ----------
function farthestCluster(range) {
  const c = G.enemies.filter((e) => dist2(P.x, P.y, e.x, e.y) < range * range);
  if (!c.length) return null;
  let best = null, bn = -1;
  for (let k = 0; k < 8; k++) { const e = pick(c); EG.query(e.x, e.y, 90, TMP); if (TMP.length > bn) { bn = TMP.length; best = e; } }
  return best;
}
function fireWeapon2(w, s, bm) {
  const gx = P.x, gy = P.y - 22;
  switch (w.id) {
    case 'crossbow': {
      const t = nearest(P.x, P.y, 700); if (!t) return false;
      const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx);
      for (let i = 0; i < s.count; i++) shoot(gx, gy, a + (i - (s.count - 1) / 2) * 0.16, 820, s.dmg * bm, { pierce: 2, r: 5, ex: s.radius * P.areaMul, k: 'arrow', knock: 160 });
      Sfx.play('throw'); return true;
    }
    case 'flamer': {
      const t = nearest(P.x, P.y, 280); if (!t) return false;
      const a = Math.atan2(t.y - gy, t.x - gx); P.aim = a;
      for (let i = 0; i < 2; i++) shoot(gx, gy, a + rand(-s.spread, s.spread) / 2, 520, s.dmg * bm, { k: 'flame', life: s.range, pierce: 99, r: 9, ignite: true, knock: 10 });
      if (Math.random() < 0.3) Sfx.play('fire');
      return true;
    }
    case 'c4': {
      if (!G.enemies.some((e) => dist2(P.x, P.y, e.x, e.y) < 600 * 600)) return false;
      for (let i = 0; i < s.count; i++) G.owned.push({ k: 'c4', x: P.x + rand(-30, 30), y: P.y + rand(-20, 20), life: 6, arm: 0.6, dmg: s.dmg * bm, r: s.radius * P.areaMul });
      Sfx.play('stash'); return true;
    }
    case 'boomerang': {
      const t = nearest(P.x, P.y, 500); if (!t) return false;
      const a0 = Math.atan2(t.y - gy, t.x - gx);
      for (let i = 0; i < s.count; i++) {
        const a = a0 + (i - (s.count - 1) / 2) * 0.5;
        const b = { x: gx, y: gy, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: s.dmg * bm, r: 12, life: 4, pierce: 999, hits: [], k: 'boom', knock: 120, dist: 0, range: s.range, back: false };
        b.update = boomUpdate; G.bullets.push(b);
      }
      Sfx.play('throw'); return true;
    }
    case 'sniper': {
      let t = null, hp = -1;
      for (const e of G.enemies) if (dist2(P.x, P.y, e.x, e.y) < 1100 * 1100 && e.hp > hp && !(e.alpha < 0.3)) { hp = e.hp; t = e; }
      if (!t) return false;
      const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx); P.aim = a;
      shoot(gx, gy, a, 1600, s.dmg * bm * (w.lv >= 6 ? 2 : 1), { pierce: s.pierce, r: 5, life: 0.9, knock: 300, big: true });
      G.fx.push({ k: 'beam', x: gx, y: gy, x2: gx + Math.cos(a) * 1100, y2: gy + Math.sin(a) * 1100, w: 2, life: 0.12, max: 0.12 });
      P.muzzle = 0.08; shake(3); Sfx.play('gauss'); return true;
    }
    case 'dual': {
      const ts = [...G.enemies].filter((e) => dist2(P.x, P.y, e.x, e.y) < 560 * 560).sort((a, b) => dist2(P.x, P.y, a.x, a.y) - dist2(P.x, P.y, b.x, b.y)).slice(0, s.targets);
      if (!ts.length) return false;
      ts.forEach((t, i) => { const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx); shoot(gx + (i % 2 ? 8 : -8), gy, a, 760, s.dmg * bm, { pierce: s.pierce, r: 3.5 }); });
      P.muzzle = 0.04; Sfx.play('pistol'); return true;
    }
    case 'acid': {
      for (let i = 0; i < s.count; i++) {
        const t = farthestCluster(480); if (!t) return i > 0;
        G.throws.push({ x0: P.x, y0: P.y - 20, x1: t.x + rand(-25, 25), y1: t.y + rand(-25, 25), t: 0, T: 0.6, dmg: s.dmg * bm, r: s.radius * P.areaMul, k: 'acid', life: s.life });
      }
      Sfx.play('throw'); return true;
    }
    case 'tesla': {
      let t = nearest(P.x, P.y, s.range); if (!t) return false;
      const hit = [], pts = [[P.x, P.y - 30]];
      for (let i = 0; i <= s.jumps && t; i++) { hit.push(t); pts.push([t.x, t.y - t.z - 14]); hurtEnemy(t, s.dmg * bm, 0, 0, false, i === 0); t = nearest(t.x, t.y, 200, hit); }
      G.fx.push({ k: 'lightning', pts, life: 0.12, max: 0.12 });
      if (Math.random() < 0.25) Sfx.play('zap');
      return true;
    }
    case 'gravgun': {
      const t = nearest(P.x, P.y, 600); if (!t) return false;
      for (let i = 0; i < s.count; i++) {
        const a = Math.atan2(t.y - gy, t.x - gx) + (i ? 0.4 : 0);
        const b = { x: gx, y: gy, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: s.dmg * P.dmgMul * bm, r: 14, life: 2.4, pierce: 999, hits: [], k: 'gorb', knock: 0, pull: s.radius * P.areaMul };
        b.update = gorbUpdate; b.endFn = (o) => { explode(o.x, o.y + 20, o.pull * 0.6, o.dmg * 2.5 / P.dmgMul, true); }; G.bullets.push(b);
      }
      Sfx.play('vortex'); return true;
    }
    case 'axe': {
      const R = s.radius * P.areaMul; if (!nearest(P.x, P.y, R + 30)) return false;
      for (let k = 0; k < s.spins; k++) G.timers.push({ t: k * 0.25, fn: () => {
        EG.query(P.x, P.y, R + 30, TMP);
        for (const e of TMP) { const d = dist(P.x, P.y, e.x, e.y); if (d < R + e.r) hurtEnemy(e, s.dmg * bm, ((e.x - P.x) / (d || 1)) * 520, ((e.y - P.y) / (d || 1)) * 520); }
        G.fx.push({ k: 'slash', x: P.x, y: P.y - 16, a: NOW * 3, arc: TAU, r: R, life: 0.28, max: 0.28 }); Sfx.play('knife');
      } });
      return true;
    }
    case 'drone': {
      const n = s.drones; let fired = false;
      for (let i = 0; i < n; i++) {
        const a = NOW * 1.6 + (i / n) * TAU, x = P.x + Math.cos(a) * 60, y = P.y - 60 + Math.sin(a) * 20;
        const t = nearest(x, y + 60, 520); if (!t) continue;
        shoot(x, y, Math.atan2(t.y - t.z - 12 - y, t.x - x), 700, s.dmg * bm, { r: 3, k: 'laser' }); fired = true;
      }
      if (fired && Math.random() < 0.3) Sfx.play('ak');
      return fired;
    }
    case 'turret': {
      if (!G.enemies.some((e) => dist2(P.x, P.y, e.x, e.y) < 600 * 600)) return false;
      const mine = G.owned.filter((o) => o.k === 'turret');
      if (mine.length >= s.max) mine[0].life = 0;
      G.owned.push({ k: 'turret', x: P.x + rand(-40, 40), y: P.y + 30, life: s.life, max: s.life, cd: 0, rate: s.rate, dmg: s.dmg * bm, rocket: w.lv >= 6 });
      Sfx.play('stash'); return true;
    }
    case 'bell': {
      const R = s.radius * P.areaMul; if (!nearest(P.x, P.y, R)) return false;
      const toll = (m) => {
        EG.query(P.x, P.y, R, TMP);
        for (const e of TMP) if (dist2(P.x, P.y, e.x, e.y) < R * R) { if (!e.boss) e.stun = Math.max(e.stun, s.stun * m); hurtEnemy(e, s.dmg * bm * m, 0, 0, false, false); }
        G.fx.push({ k: 'ring', x: P.x, y: P.y, r: R, life: 0.5, max: 0.5, c: '220,190,255' });
        Inst.bell(330, 0, 1.8, 0.1, Sfx.sfx);
      };
      toll(1); if (w.lv >= 6) G.timers.push({ t: 0.6, fn: () => toll(0.6) });
      return true;
    }
    case 'rpg': {
      let fired = false;
      for (let i = 0; i < s.count; i++) {
        const t = farthestCluster(700); if (!t) break;
        const a = Math.atan2(t.y - gy, t.x - gx) + (i ? 0.15 : 0);
        const b = { x: gx, y: gy, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, dmg: s.dmg * bm, r: 7, life: 1.6, pierce: 0, hits: [], k: 'bullet', rocket: s.radius * P.areaMul, knock: 0, rpg: true };
        G.bullets.push(b); fired = true;
      }
      if (fired) { shake(4); Sfx.play('shotgun'); }
      return fired;
    }
    case 'traps': {
      if (!G.enemies.some((e) => dist2(P.x, P.y, e.x, e.y) < 700 * 700)) return false;
      const mine = G.owned.filter((o) => o.k === 'trap');
      if (mine.length >= s.max) mine[0].life = 0;
      G.owned.push({ k: 'trap', x: P.x, y: P.y + 10, life: 30, dmg: s.dmg * bm, hold: s.hold, boom: w.lv >= 6 });
      return true;
    }
    case 'radgun': {
      const t = nearest(P.x, P.y, 560); if (!t) return false;
      for (let i = 0; i < s.count; i++) {
        const a = Math.atan2(t.y - gy, t.x - gx) + (i ? 0.25 : 0);
        const b = { x: gx, y: gy, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: s.dmg * bm, r: 7, life: 1.1, pierce: 0, hits: [], k: 'radball', knock: 0, zr: s.radius * P.areaMul, zl: s.life };
        b.endFn = (o) => G.owned.push({ k: 'zone', x: o.x, y: o.y + 20, r: o.zr, life: o.zl, max: o.zl, dps: o.dmg * P.dmgMul, tick: 0, c: '200,230,60' });
        b.hitFn = (e, o) => { o.dead = true; o.endFn(o); };
        G.bullets.push(b);
      }
      Sfx.play('geiger'); return true;
    }
    case 'freeze': {
      const t = nearest(P.x, P.y, 700); if (!t) return false;
      const a = Math.atan2(t.y - t.z - gy, t.x - gx), L = 720, wdt = s.width * P.areaMul;
      for (const e of G.enemies) {
        const ex = e.x - gx, ey = e.y - e.z - 12 - gy, al = ex * Math.cos(a) + ey * Math.sin(a);
        if (al < 0 || al > L || Math.abs(-ex * Math.sin(a) + ey * Math.cos(a)) > wdt + e.r) continue;
        const shatter = w.lv >= 6 && e.stun > 0 ? 1.5 : 1;
        hurtEnemy(e, s.dmg * bm * shatter, 0, 0);
        if (!e.boss) e.stun = Math.max(e.stun, s.freeze); e.slowT = 3; e.frozen = s.freeze;
      }
      G.fx.push({ k: 'beam', x: gx, y: gy, x2: gx + Math.cos(a) * L, y2: gy + Math.sin(a) * L, w: wdt, life: 0.3, max: 0.3, ice: true });
      Sfx.play('zap'); return true;
    }
    case 'flare': {
      for (let i = 0; i < s.count; i++) {
        const t = farthestCluster(560); if (!t) return i > 0;
        G.throws.push({ x0: P.x, y0: P.y - 20, x1: t.x + rand(-40, 40), y1: t.y + rand(-40, 40), t: 0, T: 0.7, dmg: s.dmg * bm, r: s.radius * P.areaMul, k: 'flare', life: s.life });
      }
      Sfx.play('throw'); return true;
    }
    case 'swarm': {
      if (!nearest(P.x, P.y, 650)) return false;
      for (let i = 0; i < s.count; i++) {
        const a = -Math.PI / 2 + (i - (s.count - 1) / 2) * 0.35;
        const b = { x: gx, y: gy, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: s.dmg * bm, r: 5, life: 2.4, pierce: 0, hits: [], k: 'swarm', knock: 40, tgt: null };
        b.update = swarmUpdate; b.hitFn = (e, o) => { o.dead = true; explode(o.x, o.y + 16, 45 * P.areaMul, o.dmg * 0.5, true); };
        G.bullets.push(b);
      }
      Sfx.play('throw'); return true;
    }
    case 'guitar': {
      const R = s.radius * P.areaMul; if (!nearest(P.x, P.y, R)) return false;
      const riff = (m) => {
        G.fx.push({ k: 'sound', x: P.x, y: P.y, r: 20, max: R, life: 0.6, maxl: 0.6 });
        EG.query(P.x, P.y, R, TMP);
        for (const e of TMP) { const d = dist(P.x, P.y, e.x, e.y); if (d < R) hurtEnemy(e, s.dmg * bm * m, ((e.x - P.x) / (d || 1)) * s.knock, ((e.y - P.y) / (d || 1)) * s.knock); }
        [0, 7, 12].forEach((iv, i) => Inst.dist(FM.hz(40 + iv), i * 0.01, 0.6, 0.05, Sfx.sfx));
      };
      riff(1); if (s.echo) G.timers.push({ t: 0.4, fn: () => riff(0.7) });
      return true;
    }
  }
  return false;
}
function boomUpdate(b, dt) {
  const sp = Math.hypot(b.vx, b.vy); b.dist += sp * dt; b.spin = (b.spin || 0) + dt * 20;
  if (!b.back && b.dist > b.range) { b.back = true; b.hits = []; }
  if (b.back) { const a = Math.atan2(P.y - 22 - b.y, P.x - b.x); b.vx = Math.cos(a) * 680; b.vy = Math.sin(a) * 680; if (dist2(b.x, b.y, P.x, P.y - 22) < 30 * 30) b.dead = true; }
  b.noWall = true;
}
function gorbUpdate(b, dt) {
  EG.query(b.x, b.y + 20, b.pull, TMP2);
  for (const e of TMP2) { if (e.boss) continue; const dx = b.x - e.x, dy = b.y + 20 - e.y, d = Math.hypot(dx, dy) || 1; if (d < b.pull) { const f = (1 - d / b.pull) * 420 + 60; e.x += (dx / d) * f * dt; e.y += (dy / d) * f * dt; } }
  b.tick = (b.tick || 0) - dt; if (b.tick <= 0) { b.tick = 0.3; for (const e of TMP2) if (dist2(b.x, b.y + 20, e.x, e.y) < 40 * 40) hurtEnemy(e, b.dmg * 0.3, 0, 0, true); }
  b.hits.length = 0; b.noHit = true;
}
function swarmUpdate(b, dt) {
  if (!b.tgt || b.tgt.dead) b.tgt = nearest(b.x, b.y + 20, 500);
  if (b.tgt) {
    const a = Math.atan2(b.tgt.y - b.tgt.z - 12 - b.y, b.tgt.x - b.x), cur = Math.atan2(b.vy, b.vx), na = cur + clamp(angDiff(cur, a), -6 * dt, 6 * dt);
    const sp = Math.min(760, Math.hypot(b.vx, b.vy) + 900 * dt); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
  }
  if (Math.random() < 0.6) part(b.x, b.y + 20, { z: 20, c: '220,220,220', s: 3, life: 0.35, g: -10 });
}

// ---------- deployables (C4, turrets, traps, zones, flares) ----------
function updateOwned(dt) {
  for (const o of G.owned) {
    o.life -= dt;
    if (o.k === 'c4') {
      o.arm -= dt;
      let go = o.life <= 0;
      if (o.arm <= 0) { EG.query(o.x, o.y, 70, TMP); if (TMP.some((e) => !e.dead && dist2(o.x, o.y, e.x, e.y) < 70 * 70)) go = true; }
      if (go) { explode(o.x, o.y, o.r, o.dmg, true); o.life = 0; }
    } else if (o.k === 'turret') {
      o.cd -= dt;
      if (o.cd <= 0) {
        const t = nearest(o.x, o.y, 520);
        if (t) {
          o.cd = o.rate; o.a = Math.atan2(t.y - t.z - 12 - (o.y - 30), t.x - o.x);
          if (o.rocket && Math.random() < 0.15) G.bullets.push({ x: o.x, y: o.y - 30, vx: Math.cos(o.a) * 520, vy: Math.sin(o.a) * 520, dmg: o.dmg * 3, r: 6, life: 1.4, pierce: 0, hits: [], k: 'bullet', rocket: 70, knock: 0, rpg: true });
          else shoot(o.x, o.y - 30, o.a, 760, o.dmg, { r: 3.5 });
          if (Math.random() < 0.3) Sfx.play('ak');
        } else o.cd = 0.2;
      }
    } else if (o.k === 'trap') {
      if (!o.caught) {
        EG.query(o.x, o.y, 30, TMP);
        for (const e of TMP) if (!e.dead && !e.d.fly && dist2(o.x, o.y, e.x, e.y) < (e.r + 14) ** 2) {
          o.caught = e; o.life = o.hold + 0.3; if (!e.boss) e.stun = Math.max(e.stun, o.hold);
          hurtEnemy(e, o.dmg, 0, 0); Sfx.play('break');
          if (o.boom) G.timers.push({ t: o.hold, fn: () => explode(o.x, o.y, 80 * P.areaMul, o.dmg, true) });
          break;
        }
      }
    } else if (o.k === 'zone' || o.k === 'flarezone') {
      o.tick -= dt;
      if (o.tick <= 0) {
        o.tick = 0.3; EG.query(o.x, o.y, o.r, TMP);
        for (const e of TMP) if (dist2(o.x, o.y, e.x, e.y) < o.r * o.r) { hurtEnemy(e, o.dps * 0.3, 0, 0, true); if (o.k === 'flarezone') { e.burnT = 2; e.burnDps = Math.max(e.burnDps, o.dps * 0.3); } else e.slowT = 0.5; }
      }
      if (Math.random() < 0.3) part(o.x + rand(-o.r, o.r) * 0.7, o.y + rand(-o.r, o.r) * 0.4, { z: 2, vz: 50, g: -10, c: o.c, add: true, s: 3, life: 0.6 });
    }
  }
  G.owned = G.owned.filter((o) => o.life > 0);
}
function drawOwned() {
  for (const o of G.owned) {
    if (o.k === 'zone' || o.k === 'flarezone') {
      const a = Math.min(1, o.life / 0.6) * 0.45, g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, `rgba(${o.c},${a})`); g.addColorStop(1, `rgba(${o.c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.6, 0, 0, TAU); ctx.fill();
      if (o.k === 'flarezone') { ctx.fillStyle = `rgba(255,120,60,${0.6 + Math.sin(NOW * 20) * 0.3})`; ctx.beginPath(); ctx.arc(o.x, o.y - 6, 5, 0, TAU); ctx.fill(); }
    } else if (o.k === 'trap') {
      ctx.strokeStyle = '#8a8e90'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 14, 7, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = o.caught ? '#c33' : '#bbb'; ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(o.x + i * 4, o.y - 3); ctx.lineTo(o.x + i * 4, o.caught ? o.y - 1 : o.y - 9); ctx.stroke(); }
    } else if (o.k === 'c4') {
      ctx.fillStyle = '#6a6040'; ctx.fillRect(o.x - 9, o.y - 8, 18, 10);
      ctx.fillStyle = Math.sin(NOW * (o.arm > 0 ? 8 : 20)) > 0 ? '#f33' : '#400'; ctx.beginPath(); ctx.arc(o.x, o.y - 10, 2.5, 0, TAU); ctx.fill();
    } else if (o.k === 'turret') {
      shadow(o.x, o.y, 16, 6, 0.3);
      ctx.strokeStyle = '#4a4e50'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(o.x - 12, o.y); ctx.lineTo(o.x, o.y - 24); ctx.lineTo(o.x + 12, o.y); ctx.stroke();
      ctx.fillStyle = '#6a7074'; ctx.beginPath(); ctx.arc(o.x, o.y - 30, 9, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(o.x, o.y - 30); ctx.rotate(o.a || 0); ctx.fillStyle = '#2a2e30'; ctx.fillRect(0, -2.5, 18, 5); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(o.x - 12, o.y + 6, 24, 3); ctx.fillStyle = '#7dff8a'; ctx.fillRect(o.x - 12, o.y + 6, 24 * (o.life / o.max), 3);
    }
  }
  const dw = P.weapons && P.weapons.find((w) => w.id === 'drone');
  if (dw) {
    const n = WEAPONS.drone.stats(dw.lv).drones;
    for (let i = 0; i < n; i++) {
      const a = NOW * 1.6 + (i / n) * TAU, x = P.x + Math.cos(a) * 60, y = P.y - 60 + Math.sin(a) * 20;
      shadow(x, y + 60, 8, 3, 0.2);
      ctx.fillStyle = '#5a6068'; ctx.fillRect(x - 8, y - 3, 16, 6);
      ctx.fillStyle = '#9fe8ff'; ctx.fillRect(x - 2, y - 1, 4, 3);
      ctx.strokeStyle = 'rgba(200,200,200,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x - 9, y - 5, 6, 1.5, 0, 0, TAU); ctx.ellipse(x + 9, y - 5, 6, 1.5, 0, 0, TAU); ctx.stroke();
    }
  }
}
// landing effects for lobbed shots
function throwLand(t) {
  if (t.k === 'reveal') { revealAt(t.x1, t.y1, 60); burst(t.x1, t.y1, 6, '220,220,200', 80); return true; }
  if (t.k === 'erock') { explode(t.x1, t.y1, t.r, t.dmg, false); return true; }
  if (t.k === 'acid') { G.owned.push({ k: 'zone', x: t.x1, y: t.y1, r: t.r, life: t.life, max: t.life, dps: t.dmg * P.dmgMul, tick: 0, c: '150,255,80' }); Sfx.play('fire'); return true; }
  if (t.k === 'flare') { G.owned.push({ k: 'flarezone', x: t.x1, y: t.y1, r: t.r, life: t.life, max: t.life, dps: t.dmg * P.dmgMul, tick: 0, c: '255,130,50' }); Sfx.play('fire'); return true; }
  return false;
}
function drawBullet2(b) {
  if (b.k === 'flame') {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 16);
    g.addColorStop(0, 'rgba(255,240,160,0.9)'); g.addColorStop(0.5, 'rgba(255,120,30,0.6)'); g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 16, 0, TAU); ctx.fill(); return true;
  }
  if (b.k === 'arrow') { ctx.strokeStyle = 'rgba(220,180,120,1)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.stroke(); return true; }
  if (b.k === 'boom') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin || 0); ctx.fillStyle = '#d8d0c0';
    ctx.beginPath(); ctx.moveTo(-14, -3); ctx.quadraticCurveTo(0, -12, 14, -3); ctx.lineTo(10, 2); ctx.quadraticCurveTo(0, -5, -10, 2); ctx.closePath(); ctx.fill(); ctx.restore(); return true;
  }
  if (b.k === 'gorb') {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 22); g.addColorStop(0, 'rgba(10,0,20,1)'); g.addColorStop(0.4, 'rgba(160,120,255,0.8)'); g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, TAU); ctx.fill(); return true;
  }
  if (b.k === 'radball') { ctx.fillStyle = 'rgba(210,240,60,0.95)'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, TAU); ctx.fill(); return true; }
  if (b.k === 'swarm') { ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, TAU); ctx.fill(); return true; }
  if (b.k === 'laser') { ctx.strokeStyle = 'rgba(160,230,255,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke(); return true; }
  return false;
}

// ---------- consumables ----------
const ITEMS = {
  medkit: { name: 'Medkit', icon: '🩹', key: '1', desc: 'Heal 50 HP', use: () => { P.hp = Math.min(P.maxhp, P.hp + 50 * P.medMul); Sfx.play('heal'); } },
  energy: { name: 'Energy Drink', icon: '🥤', key: '2', desc: '+40% speed & attack speed for 8s', use: () => { P.buffT = 8; Sfx.play('dash'); } },
  vodka: { name: 'Cossacks Vodka', icon: '🍾', key: '3', desc: 'Psi-immune, +20% damage for 20s, heal 15', use: () => { P.vodkaT = 20; P.hp = Math.min(P.maxhp, P.hp + 15); Sfx.play('heal'); } },
  antirad: { name: 'Anti-Rad', icon: '💊', key: '4', desc: 'Immune to radiation & anomalies for 20s', use: () => { P.antiradT = 20; Sfx.play('heal'); } },
};
function useItem(id) {
  if (!G || G.state !== 'play' || !P.items || !P.items[id]) return;
  P.items[id]--; ITEMS[id].use();
  text(P.x, P.y - 60, ITEMS[id].icon + ' ' + ITEMS[id].name, '#ffe070', false, true);
  itemsUI();
}
function giveItem(id, n = 1) { P.items[id] = Math.min(9, (P.items[id] || 0) + n); itemsUI(); text(P.x, P.y - 70, '+' + ITEMS[id].icon, '#ffe070', false, true); }
function itemsUI() {
  const el = document.getElementById('items'); if (!el || !P) return;
  el.innerHTML = Object.keys(ITEMS).map((id) => `<button class="item ${P.items[id] ? '' : 'empty'}" data-item="${id}" title="${ITEMS[id].name}: ${ITEMS[id].desc} (key ${ITEMS[id].key})"><span>${ITEMS[id].icon}</span><b>${P.items[id] || 0}</b><kbd>${ITEMS[id].key}</kbd></button>`).join('');
  for (const b of el.querySelectorAll('[data-item]')) b.onpointerdown = (e) => { e.stopPropagation(); useItem(b.dataset.item); };
}

// ---------- talent tree: a talent point every 5 levels, three branches of five ----------
const TALENTS = {
  gunner: { name: 'Gunner', icon: '🎖️', color: '#ffb830', nodes: [
    ['Steady Aim', '+12% damage', (P) => { P.dmgMul += 0.12; }],
    ['Rapid Fire', '+12% attack speed', (P) => { P.rateMul += 0.12; }],
    ['Armor Piercing', '+1 pierce on all projectiles', (P) => { P.pierce++; }],
    ['Lethal', '+40% critical damage', (P) => { P.critMul += 0.4; }],
    ['Arsenal', 'Carry a 7th weapon', (P) => { P.maxWeapons = 7; }]] },
  survivor: { name: 'Survivor', icon: '🛡️', color: '#7dff8a', nodes: [
    ['Tough', '+30 max HP', (P) => { P.maxhp += 30; P.hp += 30; }],
    ['Recovery', '+1 HP/s regeneration', (P) => { P.regen += 1; }],
    ['Hardened', '-10% damage taken', (P) => { P.dr += 0.1; }],
    ['Nine Lives', '+1 revive', (P) => { P.revives++; }],
    ['Last Stand', 'Below 20% HP: 3s invulnerable (once per minute)', (P) => { P.lastStand = true; }]] },
  anomalist: { name: 'Anomalist', icon: '🔮', color: '#c07aff', nodes: [
    ['Attuned', '-15% artifact cooldowns', (P) => { P.actCdMul *= 0.85; }],
    ['Resonance', '+25% artifact power', (P) => { P.actPow += 0.25; }],
    ['Expansion', '+20% area', (P) => { P.areaMul += 0.2; }],
    ['Zone-Born', '-40% anomaly & radiation damage', (P) => { P.anomRes = Math.min(0.9, P.anomRes + 0.4); }],
    ['Echo', 'Artifact powers trigger twice', (P) => { P.echo = true; }]] },
};
function openTalent() {
  G.state = 'levelup'; G.pendingTal--; choiceMode = 'talent';
  choices = Object.keys(TALENTS).filter((k) => (P.talents[k] || 0) < 5).map((k) => ({ kind: 'tal', id: k, rar: (P.talents[k] || 0) === 4 ? RARITY[3] : RARITY[2] }));
  if (!choices.length) { G.state = 'play'; return; }
  $('lvTitle').textContent = 'TALENT POINT'; $('lvSub').textContent = 'LEVEL ' + G.level + ' · CHOOSE A BRANCH';
  renderCards(); show('levelup'); Sfx.play('legend');
}
