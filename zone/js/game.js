'use strict';
// ---------- core simulation ----------
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
const TMP = [], TMP2 = [], TMP3 = [];
const xpNeed = (l) => Math.floor(5 + l * 5 + Math.pow(l, 1.75));
const stageDef = () => STAGES.find((s) => s.id === G.stage);

function newGame(stageId, charId, mode, spawnIdx = 0) {
  const ch = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
  World.genStage(stageId, (Math.random() * 1e9) | 0, spawnIdx);
  G = {
    t: 0, state: 'play', stage: stageId, char: ch.id, kills: 0, level: 1, xp: 0, xpNeed: xpNeed(1), pendingLv: 0,
    enemies: [], bullets: [], ebullets: [], gems: [], pickups: [], particles: [], texts: [], decals: [], fx: [], throws: [], timers: [],
    bosses: [], bossIdx: 0, spawnAcc: 0, rushT: 80, emIdx: 0, em: null, shake: 0, flash: 0, flashCol: '255,255,255', psi: 0,
    zone: '', arts: 0, dmg: 0, crates: [], lightT: 0, auraT: 0, thunderT: 4, detT: 0, won: false, regionT: 0, fade: 1,
    rubles: 0, questsDone: 0, elites: 0, levelCrates: {}, levelPickups: {}, labsVisited: 0, returnPos: null, healT: 0, healRate: 0,
    lowHpT: 0, streak: 100, bossKills: 0, flowT: 0, rerollsUsed: 0,
    endless: mode === 'endless', tier: 1, tierT: 900, shotBudget: 5, wave: 0, waveT: 150, waveMut: null, nextBossT: 150, bossN: -1, paidR: 0, paidMin: 0,
  };
  const M = (id) => Save.meta(id), mod = ch.mod;
  P = {
    x: World.start.x, y: World.start.y, z: 0, r: 13, hp: 120, maxhp: 120, face: 1, aim: 0, lookA: -Math.PI / 2, anim: 0, moving: false, inv: 0, muzzle: 0,
    dashCd: 0, dashT: 0, dashVx: 0, dashVy: 0, lastMx: 0, lastMy: -1, kvx: 0, kvy: 0, slow: 0, slowNext: 0, psiSlowT: 0,
    dmgMul: 1, rateMul: 1, areaMul: 1, spdMul: 1, pickup: 85, xpMul: 1, dr: 0, regen: 0, pierce: 0, crit: 0, thorns: 0, dashMul: 1,
    shards: 0, lightning: 0, aura: 0, soul: 0, soulAcc: 0, luck: 0, rerolls: 0, revives: 0, anomRes: 0, psiImmune: false, detect: 1,
    weapons: [{ id: ch.weapon, lv: 1, cd: 0.5 }], perks: {}, arts: {}, tags: {}, syn: {}, actSel: 0, actCd: {}, shieldT: 0, dodge: 0, lvlHeal: 0,
    execute: 0, bossDmg: 0, critMul: 2, dropMul: 1, rubMul: 1, dashDmg: 0, medMul: 1, adren: 0, adrenT: 0, berserk: 0, standFirm: 0, zapChance: 0,
    lifesteal: 0, lsAcc: 0, exChance: 0, frostChance: 0, hunter: 0, actCdMul: 1, actPow: 0, burnMul: 1, lowRegen: 1, momentum: 0, sprint: 0, hatchT: 0, bioHp: 0,
    pal: { ...PAL_PLAYER, ...ch.pal },
  };
  // meta upgrades
  P.maxhp += M('hp') * 10; P.dmgMul += M('dmg') * 0.05; P.spdMul += M('spd') * 0.03; P.dr += M('armor') * 0.03; P.xpMul += M('xp') * 0.06;
  P.pickup *= 1 + M('magnet') * 0.1; P.luck = M('luck'); P.rerolls = M('reroll'); P.dashMul = 1 - M('dash') * 0.08; P.revives = M('revive');
  G.pendingLv = M('start');
  // character
  P.maxhp += mod.maxhp || 0; P.spdMul += mod.spdMul || 0; P.dr += mod.dr || 0; P.dmgMul += mod.dmgMul || 0; P.luck += mod.luck || 0;
  P.anomRes = mod.anomRes || 0; P.psiImmune = !!mod.psiImmune; P.detect = mod.detect || 1;
  P.hp = P.maxhp;
  if (mod.art) { P.arts[mod.art] = 1; ARTIFACTS[mod.art].apply(P); }
  for (const f of World.fields) spawnArtifact(f);
  G.crates = World.crateSpots.map((s) => ({ x: s.x, y: s.y, open: 0 }));
  CAM.x = P.x; CAM.y = P.y;
  Env.reset(); Radio.reset(); Hints.reset(); Quests.reset();
  recomputeTags(); hudBuild();
  const sd = stageDef();
  banner(sd.name.toUpperCase() + (G.endless ? ' · ENDLESS' : ''), G.endless ? 'Bosses never stop coming. How long can you last?' : 'Survive 15:00. Hunt artifacts. Destroy ' + sd.final.name + '.', 5, '', 2);
  Radio.say('start', true);
  Save.data.runs++; Save.save();
}
function spawnArtifact(f) {
  const a = pick(f.anoms), an = Math.random() * TAU, d = a.r * 0.45 * Math.random();
  if (ANOMALIES[f.type].moving) { f.art = { x: f.x + rand(-30, 30), y: f.y + rand(-20, 20), type: pick(ANOM_ARTS[f.type]), t: Math.random() * 10 }; return; }
  f.art = { x: a.x + Math.cos(an) * d, y: a.y + Math.sin(an) * d, type: pick(ANOM_ARTS[f.type]), t: Math.random() * 10 };
}

// ---------- fx helpers ----------
function part(x, y, o) {
  if (G.particles.length > (Save.set.quality === 'low' ? 500 : 1400)) return;
  G.particles.push({ x, y, z: o.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g ?? 400, life: o.life || 0.6, max: o.life || 0.6, s: o.s || 3, c: o.c || '255,255,255', add: !!o.add });
}
function burst(x, y, n, c, spd = 160, o = {}) {
  for (let i = 0; i < n; i++) { const a = rand(TAU), s = rand(spd * 0.3, spd); part(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(50, 220), z: o.z ?? 10, c, s: rand(1.5, o.s || 3.5), life: rand(0.3, o.life || 0.8), add: o.add, g: o.g }); }
}
function text(x, y, s, c = '#fff', big = false, force = false) {
  if (!force && !Save.set.numbers) return;
  if (!force && !big && G.texts.length > 24) return;
  if (G.texts.length > 70) G.texts.shift();
  G.texts.push({ x: x + rand(-8, 8), y, s, c, life: 0.8, big });
}
function decal(x, y, r, c) { if (G.decals.length > 160) G.decals.shift(); G.decals.push({ x, y, r, c, a: rand(TAU), life: 40 }); }
function shake(v) { if (Save.set.shake) G.shake = Math.min(24, G.shake + v); }
function flash(v, c = '255,255,255') { G.flash = Math.max(G.flash, v); G.flashCol = c; }
// banners queue up instead of stacking; priority 2 (bosses, emissions) cuts in line
let bannerTimer = 0, bannerCur = '';
const BQ = [];
function banner(title, sub, t = 3.5, cls = '', prio = 1) {
  if (title === bannerCur && bannerTimer > 0) return;
  if (bannerTimer > 0.6 && prio < 2) { if (BQ.length < 3 && !BQ.some((b) => b.title === title)) BQ.push({ title, sub, t, cls }); return; }
  const b = $('banner'); b.className = 'show ' + cls; $('bTitle').textContent = title; $('bSub').textContent = sub || ''; bannerTimer = t; bannerCur = title;
}
function bannerTick(dt) {
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) { $('banner').className = ''; bannerCur = ''; } }
  else if (BQ.length) { const n = BQ.shift(); banner(n.title, n.sub, Math.min(n.t, 2.6), n.cls, 2); }
}

// ---------- damage ----------
function critChance() { return 0.07 + P.crit + (P.syn.psi ? 0.15 : 0); }
function hurtEnemy(e, dmg, kx = 0, ky = 0, raw = false, proc = true) {
  if (e.dead) return;
  let crit = false;
  if (!raw) {
    dmg *= P.dmgMul;
    if (P.execute && e.hp < e.maxhp * 0.3) dmg *= 1 + P.execute;
    if (P.bossDmg && (e.boss || e.mini || e.affix)) dmg *= 1 + P.bossDmg;
    if (P.hunter && !e.boss && !e.mini) dmg *= 1 + P.hunter;
    if (P.berserk) dmg *= 1 + P.berserk * (1 - P.hp / P.maxhp);
    if (P.momentum) dmg *= 1 + Math.min(0.3, G.kills * 0.0004 * P.momentum);
    if (Math.random() < critChance()) { crit = true; dmg *= P.critMul; }
    if (P.lifesteal && P.lsAcc < 5) { const h = Math.min(5 - P.lsAcc, dmg * P.lifesteal); P.lsAcc += h; P.hp = Math.min(P.maxhp, P.hp + h); }
  }
  if (e.shield > 0) dmg *= 0.15;
  if (e.affix === 'armored') dmg *= 0.5;
  e.hp -= dmg; e.flash = 0.09; G.dmg += dmg;
  const m = e.d.mass * (e.sc || 1); e.kvx += kx / m; e.kvy += ky / m;
  if (e.id === 'bloodsucker' || e.id === 'cat') e.reveal = 1.2;
  if (dmg >= 1) text(e.x, e.y - e.r * 2 - e.z - 10, Math.round(dmg), crit ? '#ffd23a' : raw ? '#9fd4ff' : '#fff', crit);
  Sfx.play(crit ? 'crit' : 'hit');
  if (!raw && proc) {
    if (P.syn.fire) { e.burnT = 2.2; e.burnDps = Math.max(e.burnDps || 0, dmg * 0.35); }
    if (P.frostChance && Math.random() < P.frostChance) e.slowT = 1.5;
    if (P.exChance && Math.random() < P.exChance) { const x = e.x, y = e.y; G.timers.push({ t: 0, fn: () => explode(x, y, 55 * P.areaMul, dmg * 0.5, true) }); }
    if (P.zapChance && Math.random() < P.zapChance) {
      const n = nearestTo(e.x, e.y, 200, e);
      if (n) { G.fx.push({ k: 'lightning', pts: [[e.x, e.y - e.z - 14], [n.x, n.y - n.z - 14]], life: 0.15, max: 0.15 }); hurtEnemy(n, dmg * 0.6, 0, 0, true); }
    }
    if (P.syn.electric && Math.random() < 0.1) {
      const n = nearestTo(e.x, e.y, 180, e);
      if (n) { G.fx.push({ k: 'lightning', pts: [[e.x, e.y - e.z - 14], [n.x, n.y - n.z - 14]], life: 0.15, max: 0.15 }); hurtEnemy(n, dmg * 0.5, 0, 0, true); }
    }
  }
  if (e.hp <= 0) killEnemy(e);
  else if (e.boss && !e.enraged && e.hp < e.maxhp * 0.5) enrage(e);
}
function enrage(e) {
  e.enraged = true; e.spd *= 1.25;
  banner(e.name + ' IS ENRAGED!', 'New attack patterns incoming.', 2.5, 'bad', 2);
  Sfx.play('enrage'); shake(14); flash(0.3, '255,60,40');
  burst(e.x, e.y - 30, 40, '255,60,40', 300, { add: true });
}
function killEnemy(e) {
  e.dead = true;
  if (e.id === 'phantom') { burst(e.x, e.y - 10, 10, '170,120,255', 120, { add: true }); return; }
  G.kills++;
  if (G.kills >= G.streak) { G.streak += 150; Radio.say('streak'); }
  Quests.prog('kill', (q) => q.id === e.id);
  if (e.boss) {
    G.bossKills++; G.rubles += 100;
    for (let i = 0; i < 40; i++) dropGem(e.x + rand(-60, 60), e.y + rand(-60, 60), Math.ceil(e.d.xp / 40) + 2);
    if (e.labBoss) { G.pickups.push({ type: 'labstash', x: e.x, y: e.y, t: 0 }); World.lab.cleared = true; }
    else if (!e.final) G.pickups.push({ type: 'stash', x: e.x, y: e.y, t: 0 });
    burst(e.x, e.y, 70, '200,40,30', 380, { s: 6, life: 1.4 });
    shake(20); flash(0.5, '255,200,160'); Sfx.play('boom');
    for (let i = 0; i < 6; i++) decal(e.x + rand(-50, 50), e.y + rand(-30, 30), rand(20, 40), '90,10,10');
    if (e.final) winGame();
    else { banner(e.name + ' SLAIN', 'It dropped a stash. Grab it!', 4, 'good'); Radio.say('bossdead', true); }
  } else {
    let xp = e.d.xp * 1.35;
    if (e.affix || e.mini) {
      xp *= e.mini ? 14 : 6; G.rubles += e.mini ? 40 : 10; G.elites++;
      Quests.prog('elite');
      if (e.mini) { for (let i = 0; i < 12; i++) dropGem(e.x + rand(-40, 40), e.y + rand(-40, 40), Math.ceil(xp / 12)); }
      else dropGem(e.x, e.y, xp);
      const r = Math.random();
      if (!e.mini) {
        if (r < 0.15) G.pickups.push({ type: 'art', x: e.x, y: e.y, t: 0 });
        else if (r < 0.55) G.pickups.push({ type: 'med', x: e.x, y: e.y, t: 0 });
        else if (r < 0.65) G.pickups.push({ type: 'magnet', x: e.x, y: e.y, t: 0 });
      }
      if (e.affix === 'volatile') { G.timers.push({ t: 0.25, fn: () => explode(e.x, e.y, 95, 35, false) }); }
    } else {
      dropGem(e.x, e.y, xp);
      if (Math.random() < 0.012 * P.dropMul) G.pickups.push({ type: 'med', x: e.x, y: e.y, t: 0 });
      else if (Math.random() < 0.003 * P.dropMul) G.pickups.push({ type: 'magnet', x: e.x, y: e.y, t: 0 });
    }
    G.rubles += 0.5;
    if (e.mut) mutDeath(e);
    const bc = e.id === 'poltergeist' ? '255,170,70' : e.id === 'controller' || e.id === 'psydog' ? '170,120,200' : '140,20,20';
    burst(e.x, e.y - e.z, 10, bc, 180, { add: e.id === 'poltergeist' });
    if (e.id !== 'poltergeist') decal(e.x, e.y, e.r * rand(0.8, 1.3), '80,12,10');
    Sfx.play('kill');
    // synergy on-kill effects
    if (P.syn.fire === 2 && e.burnT > 0) G.timers.push({ t: 0.05, fn: () => explode(e.x, e.y, 70 * P.areaMul, 30, true) });
    if (P.syn.psi === 2 && Math.random() < 0.2) G.timers.push({ t: 0.05, fn: () => psiWave(e.x, e.y) });
    if (P.syn.gravity === 2 && Math.random() < 0.08) G.fx.push({ k: 'hole', x: e.x, y: e.y, r: 120, life: 1.5, max: 1.5, dps: 30, pull: 320, end: 40, tick: 0 });
    if (P.syn.bio === 2 && G.kills % 10 === 0 && P.bioHp < 100) { P.bioHp++; P.maxhp++; P.hp++; }
  }
  if (P.soul) { P.soulAcc += P.soul / 3; if (P.soulAcc >= 1) { const h = Math.floor(P.soulAcc); P.soulAcc -= h; P.hp = Math.min(P.maxhp, P.hp + h); } }
}
function mutDeath(e) {
  const d = dist(e.x, e.y, P.x, P.y);
  if (e.mut === 'electric' && d < 130) { G.fx.push({ k: 'lightning', pts: [[e.x, e.y - 14], [P.x, P.y - 24]], life: 0.2, max: 0.2 }); hurtPlayer(8, e.name, false, 'anomaly'); Sfx.play('zap'); }
  else if (e.mut === 'burning') patch(e.x, e.y, 'fire', 40, 2.5);
  else if (e.mut === 'toxic') patch(e.x, e.y, 'toxic', 44, 4);
  else if (e.mut === 'irradiated' && World.rads.length < 80) World.rads.push({ x: e.x, y: e.y, r: 70, life: 8 });
}
function patch(x, y, type, r, life) {
  let n = 0; for (const f of G.fx) if (f.k === 'patch') n++;
  if (n > 36) return;
  G.fx.push({ k: 'patch', x, y, type, r, life, max: life, seed: rand(10) });
}
function updateMutation(e, dt, d, ux, uy) {
  e.mutT -= dt;
  const B = e.boss;
  switch (e.mut) {
    case 'burning':
      if (e.mutT <= 0) { e.mutT = B ? 4.5 : 1.4; if (B) { for (let i = 0; i < 12; i++) enemyShoot(e, (i / 12) * TAU + e.t, 210, 14, 'fire', 8); } else patch(e.x, e.y, 'fire', 30, 2.5); }
      break;
    case 'toxic':
      if (e.mutT <= 0) {
        e.mutT = B ? 5 : 1.8;
        if (B) { const x = P.x, y = P.y; G.fx.push({ k: 'target', x, y, r: 100, life: 0.9, max: 0.9 }); G.timers.push({ t: 0.9, fn: () => patch(x, y, 'toxic', 100, 6) }); }
        else patch(e.x, e.y, 'toxic', 32, 3.5);
      }
      break;
    case 'electric':
      if (B && e.mutT <= 0) {
        e.mutT = 5;
        for (let i = 0; i < 3; i++) { const x = P.x + rand(-120, 120), y = P.y + rand(-90, 90); G.fx.push({ k: 'target', x, y, r: 75, life: 1, max: 1, blue: true }); G.timers.push({ t: 1, fn: () => strike(x, y, 60, 75, true) }); }
      }
      break;
    case 'psi':
      if (e.mutT <= 0) {
        if (B) { e.mutT = 6; G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 480, max: 520, dmg: e.dmg * 0.7, hit: false, life: 1.2, maxl: 1.2, psi: true }); Sfx.play('psi'); }
        else if (d > 160 && d < 520) { e.mutT = rand(4, 6); burst(e.x, e.y - 12, 8, '192,122,255', 100, { add: true }); const nx = P.x - ux * 120, ny = P.y - uy * 120; if (World.free(nx, ny, e.r)) { e.x = nx; e.y = ny; } burst(e.x, e.y - 12, 8, '192,122,255', 100, { add: true }); }
        else e.mutT = 1;
      }
      break;
    case 'gravity': {
      const R = B ? 340 : 170;
      if (d < R && P.dashT <= 0) { const f = (1 - d / R) * (B ? 150 : 60); P.x -= ux * f * dt; P.y -= uy * f * dt; }
      if (B && e.mutT <= 0) { e.mutT = 8; const x = P.x, y = P.y; G.fx.push({ k: 'target', x, y, r: 200, life: 1, max: 1 }); G.timers.push({ t: 1, fn: () => G.fx.push({ k: 'ehole', x, y, r: 220, life: 3.5, max: 3.5 }) }); }
      break;
    }
    case 'irradiated': {
      const R = B ? 190 : 80;
      if (d < R) { P.mradAcc = (P.mradAcc || 0) + (B ? 9 : 5) * dt; if (P.mradAcc > 4) { hurtPlayer(P.mradAcc, e.name, true, 'rad'); P.mradAcc = 0; } if (Math.random() < 0.5) Sfx.play('geiger'); }
      break;
    }
  }
}
function psiWave(x, y) {
  G.fx.push({ k: 'ring', x, y, r: 120, life: 0.35, max: 0.35, c: '200,130,255' });
  EG.query(x, y, 150, TMP3);
  for (const e of TMP3) if (dist2(x, y, e.x, e.y) < 130 * 130) hurtEnemy(e, 25, 0, 0, true);
}
function dropGem(x, y, v) {
  if (G.gems.length > 450) { const g = G.gems[(Math.random() * G.gems.length) | 0]; g.v += v; return; }
  G.gems.push({ x, y, v, z: 8, vz: rand(120, 200), vx: rand(-40, 40), vy: rand(-30, 30), mag: false });
}
function hurtPlayer(d, src, ignoreInv = false, kind = '') {
  if (G.state !== 'play') return;
  if (!ignoreInv && (P.inv > 0 || P.dashT > 0)) return;
  if (P.shieldT > 0) { if (!ignoreInv) { P.inv = 0.3; text(P.x, P.y - 50, 'BLOCK', '#9fe8ff', false, true); } return; }
  if (!ignoreInv && P.dodge && Math.random() < P.dodge) { P.inv = 0.3; text(P.x, P.y - 50, 'DODGE', '#d0a0ff', false, true); return; }
  if (kind === 'anomaly' || kind === 'rad') d *= 1 - P.anomRes;
  d *= 1 - Math.min(0.75, P.dr + (!P.moving ? P.standFirm : 0));
  if (P.adren && !ignoreInv) P.adrenT = 2;
  P.hp -= d;
  if (!ignoreInv) P.inv = 0.6;
  text(P.x, P.y - 50, '-' + Math.round(d), '#ff5a4a', false, true);
  shake(ignoreInv ? 2 : 6); flash(ignoreInv ? 0.08 : 0.25, '255,30,20'); Sfx.play('hurt');
  if (P.hp < P.maxhp * 0.25 && G.t - G.lowHpT > 30) { G.lowHpT = G.t; Radio.say('lowhp'); }
  if (P.hp <= 0) {
    if (P.revives > 0) {
      P.revives--; P.hp = P.maxhp * 0.5; P.inv = 2.5;
      banner('SECOND WIND', 'You cling to life! Revives left: ' + P.revives, 3, 'good');
      explode(P.x, P.y, 260, 200, true); flash(0.8, '120,255,160'); Sfx.play('heal');
    } else { P.hp = 0; gameOver(src); }
  }
}
function explode(x, y, r, dmg, fromPlayer = true) {
  EG.query(x, y, r + 40, TMP3);
  for (const e of TMP3) { const d = dist(x, y, e.x, e.y); if (d < r + e.r) hurtEnemy(e, dmg, ((e.x - x) / (d || 1)) * 300, ((e.y - y) / (d || 1)) * 300, !fromPlayer, false); }
  if (!fromPlayer && dist(x, y, P.x, P.y) < r + P.r) hurtPlayer(dmg * 0.6, 'an explosion');
  G.fx.push({ k: 'boom', x, y, r, life: 0.45, max: 0.45 });
  burst(x, y, 26, '255,170,60', r * 3, { add: true, s: 4, life: 0.6 });
  for (let i = 0; i < 10; i++) part(x + rand(-r / 2, r / 2), y + rand(-r / 3, r / 3), { vz: rand(20, 60), z: 10, g: -30, c: '70,65,60', s: rand(8, 16), life: rand(0.8, 1.5) });
  decal(x, y, r * 0.6, '20,18,16');
  shake(8); Sfx.play('boom');
  const obs = World.destructiblesNear(x, y, r + 20);
  if (obs.length) G.timers.push({ t: 0.12, fn: () => { for (const ob of obs) damageOb(ob, dmg); } });
}
function damageOb(ob, dmg) {
  if (!ob.hp || ob.dead) return;
  ob.hp -= dmg;
  if (ob.hp > 0) { if (ob.kind === 'fence') burst(ob.x + ob.w / 2, ob.y, 3, '120,90,60', 80); if (ob.kind === 'lair') { ob.lair.hitT = 0.1; text(ob.x, ob.y - 60, Math.round(dmg), '#ffcf6a'); } return; }
  ob.dead = true;
  World.destroy(ob);
  if (ob.kind === 'lair') {
    const L = ob.lair; L.dead = true;
    explode(L.x, L.y, 140, 60, true); shake(14);
    G.rubles += 40; G.elites++;
    for (let i = 0; i < 10; i++) dropGem(L.x + rand(-60, 60), L.y + rand(-50, 50), 4 + Math.floor(G.t / 60));
    G.pickups.push({ type: Math.random() < 0.4 ? 'art' : 'med', x: L.x, y: L.y + 30, t: 0 });
    banner('LAIR DESTROYED', '+40 ₽ and loot', 2.5, 'good');
    Quests.prog('lair');
    return;
  }
  if (ob.kind === 'barrel') { explode(ob.x, ob.y, 115 * P.areaMul, 80, true); G.fx.push({ k: 'ring', x: ob.x, y: ob.y, r: 115, life: 0.4, max: 0.4, c: '255,160,60' }); }
  else { burst(ob.x + (ob.w || 0) / 2, ob.y, 14, '130,95,60', 200, { s: 5 }); Sfx.play('break'); }
}

// ---------- enemies ----------
function spawnEnemy(id, x, y, o = {}) {
  const d = ENEMIES[id], m = G.t / 60, sm = stageDef().hpMul;
  const hpMul = (d.boss ? 1 + Math.max(0, m - 2.5) * 0.1 : hpScale(m)) * sm * (o.hpMul || 1);
  const e = {
    id, d, x, y, z: 0, vz: 0, r: d.r, hp: d.hp * hpMul, maxhp: d.hp * hpMul, spd: d.spd * (d.boss ? 1 : 1 + Math.min(0.3, m * 0.018)),
    dmg: d.dmg * (d.boss ? 1 : 1 + m * 0.05) * (0.8 + sm * 0.2), kvx: 0, kvy: 0, face: 1, aim: 0, anim: rand(10), flash: 0, t: 0, cd: rand(1, 3), cd2: rand(4, 8), cd3: rand(5, 8),
    state: 0, st: 0, seed: rand(100), alpha: 1, reveal: 0, vt: 0, shield: 0, cast: 0, slowT: 0, stun: 0, burnT: 0, burnDps: 0, burnTick: 0, sc: 1,
    name: o.name || d.name, boss: !!d.boss,
  };
  if (d.boss && G.endless) { e.hp *= 1 + (G.tier - 1) * 0.7; e.maxhp = e.hp; e.dmg *= 1 + (G.tier - 1) * 0.15; }
  if (!d.boss && !o.noElite && id !== 'phantom' && Math.random() < Math.min(0.06, 0.004 + m * 0.0035) * (World.kind === 'lab' ? 2 : 1)) o.affix = pick(Object.keys(ELITE_AFFIX));
  if (o.affix) {
    e.affix = o.affix; e.hp *= 4; e.maxhp *= 4; e.sc = 1.3; e.r *= 1.3;
    e.name = ELITE_AFFIX[o.affix].name + ' ' + d.name;
    if (o.affix === 'swift') e.spd *= 1.5;
    Hints.show('elite'); Radio.say('elite');
  }
  if (!d.boss && id !== 'phantom' && !o.mini && G.waveMut && o.mut === undefined && Math.random() < 0.35) o.mut = G.waveMut;
  if (d.boss && o.mut === undefined && (G.endless ? G.bossN >= BOSS_POOL.length : G.bossIdx >= 3) && !o.final && !o.labBoss) o.mut = pick(Object.keys(MUTATIONS));
  if (o.mut) {
    e.mut = o.mut; e.hp *= d.boss ? 1.15 : 1.4; e.maxhp = e.hp; e.mutT = rand(1, 3);
    e.name = (d.boss ? MUTATIONS[o.mut].name.toUpperCase() : MUTATIONS[o.mut].name) + ' ' + e.name;
  }
  if (d.boss && G.endless && G.tier > 1) e.name = BOSS_TITLES[Math.min(G.tier - 1, BOSS_TITLES.length - 1)] + ' ' + e.name;
  if (o.mini) { e.mini = true; e.hp *= 10; e.maxhp *= 10; e.sc = 1.55; e.r *= 1.55; e.dmg *= 1.5; e.name = 'ALPHA ' + d.name.toUpperCase(); }
  G.enemies.push(e);
  if (d.boss) G.bosses.push(e);
  return e;
}
// fewer but tougher mutants; keeps growing smoothly for multi-hour endless runs
function hpScale(m) {
  if (m <= 15) return 1.3 + m * 0.26 + m * m * 0.012;
  const k = m - 15;
  return 1.3 + 15 * 0.26 + 225 * 0.012 + k * 0.7 + Math.pow(k, 1.5) * 0.04;
}
function ringPos(extra = 0) {
  if (World.kind === 'lab') {
    const F = World.lab.floor;
    for (let i = 0; i < 40; i++) {
      const t = F[(Math.random() * F.length) | 0], x = ((t % LAB_N) + 0.5) * LAB_T, y = (Math.floor(t / LAB_N) + 0.5) * LAB_T, d = dist(x, y, P.x, P.y);
      if (d > 480 + extra && d < 1100 + extra && World.free(x, y, 16)) return [x, y];
    }
    return null;
  }
  const R = Math.hypot(VW, VH) / 2 / ZOOM + 70 + extra;
  for (let i = 0; i < 12; i++) {
    const a = rand(TAU), x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R;
    if (World.free(x, y, 22)) return [x, y];
  }
  return null;
}
function spawnBoss(id, o = {}) {
  let x, y, p = World.kind === 'lab' ? ringPos(-200) : null;
  if (p) [x, y] = p;
  else {
    const a = rand(TAU); x = P.x + Math.cos(a) * 650; y = P.y + Math.sin(a) * 650;
    for (let i = 0; i < 20 && !World.free(x, y, 50); i++) { const b = rand(TAU); x = P.x + Math.cos(b) * 650; y = P.y + Math.sin(b) * 650; }
  }
  x = clamp(x, 100, WORLD - 100); y = clamp(y, 100, WORLD - 100);
  if (o.at) { x = o.at.x; y = o.at.y; }
  const e = spawnEnemy(id, x, y, o);
  if (o.final) e.final = true;
  if (o.labBoss) e.labBoss = true;
  banner('⚠ ' + e.name + ' ⚠', o.final ? 'The heart of the Zone awakens. Destroy it!' : o.labBoss ? 'The laboratory guardian awakens.' : 'A massive mutant is hunting you.', 4.5, 'bad', 2);
  Sfx.play('boss'); shake(12); Radio.say('boss');
  return e;
}
function director(dt) {
  const m = G.t / 60, reg = World.region(P.x, P.y), lab = World.kind === 'lab', night = Env.isNight();
  const bossUp = G.bosses.length > 0;
  const cap = Math.min(170 + (G.tier - 1) * 10, 18 + m * 13) * (lab ? 0.6 : 1) * (bossUp ? 0.6 : 1);
  const rate = Math.min(7, 0.5 + m * 0.42) * (0.75 + reg.danger * 0.13) * (night ? 1.25 : 1) * (G.em && G.em.phase === 'blast' ? 0 : 1) * (lab ? 0.7 : 1) * (bossUp ? 0.4 : 1);
  G.spawnAcc += rate * dt;
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length >= cap) break;
    const tab = spawnTable(m, lab);
    if (night && !lab) { tab.bloodsucker = (tab.bloodsucker || 0) + 10; tab.snork = (tab.snork || 0) + 8; }
    if (Env.weather === 'psi' && !lab) { tab.controller = (tab.controller || 0) + 6; tab.psydog = (tab.psydog || 0) + 6; }
    let tot = 0; for (const k in tab) tot += tab[k];
    let r = rand(tot), id = 'dog'; for (const k in tab) { r -= tab[k]; if (r <= 0) { id = k; break; } }
    const p = ringPos(); if (!p) continue;
    const n = id === 'dog' ? randi(m < 1 ? 1 : 2, m < 3 ? 2 : 3) : id === 'rat' ? randi(3, 5) : id === 'pseudodog' ? 2 : 1;
    for (let i = 0; i < n; i++) spawnEnemy(id, p[0] + rand(-30, 30), p[1] + rand(-30, 30), i ? { noElite: true } : {});
  }
  G.rushT -= dt;
  if (G.rushT <= 0 && !lab && !bossUp && !(G.em && G.em.phase !== 'after')) {
    G.rushT = 80;
    const n = Math.floor(Math.min(28, 10 + m * 2)), R = Math.hypot(VW, VH) / 2 / ZOOM + 40;
    const kind = m > 6 ? 'snork' : m > 2 ? 'rat' : 'dog';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R;
      if (World.free(x, y, 14)) spawnEnemy(i % 3 === 0 && m > 2 ? kind : 'dog', x, y, { noElite: true });
    }
    banner('MUTANT RUSH!', 'They are coming from every direction.', 2.5, 'bad'); Sfx.play('roar');
  }
  // bosses never stack with each other or with an emission (they wait up to 40s for the stage to clear)
  const due = nextBossTime();
  if (due !== null && G.t >= due) {
    const busy = (bossUp || (G.em && G.em.phase !== 'after')) && G.t < due + 40;
    if (!busy) spawnNextBoss();
  }
  if (G.t >= G.waveT) {
    G.wave++; G.waveT += 150;
    if (G.t >= 280 || G.endless) {
      const opts = Object.keys(MUTATIONS).filter((k) => k !== G.waveMut);
      G.waveMut = pick(opts);
      const M = MUTATIONS[G.waveMut];
      banner('WAVE ' + (G.wave + 1) + ' · ' + M.name.toUpperCase() + ' MUTANTS', 'Mutated mutants ' + M.desc + '.', 3, 'bad');
    }
  }
  if (G.endless && G.t >= G.tierT) {
    G.tier++; G.tierT += 900;
    const nx = unlockNextStage();
    if (nx) G.timers.push({ t: 4.5, fn: () => banner('🔓 NEW STAGE UNLOCKED', nx.icon + ' ' + nx.name + ' is now open on the PLAY screen.', 4, 'good', 2) });
    banner('☢ ZONE TIER ' + G.tier + ' ☢', 'The Zone grows stronger. So do its rewards.', 4, 'bad', 2);
    G.rubles += 150;
  }
  const emDue = G.emIdx < EMISSIONS.length ? EMISSIONS[G.emIdx] : G.endless ? EMISSIONS[EMISSIONS.length - 1] + (G.emIdx - EMISSIONS.length + 1) * 360 : Infinity;
  if (G.t >= emDue && !(G.em && G.em.phase !== 'after')) {
    G.emIdx++; G.em = { phase: 'warn', t: 30 };
    banner('☢ EMISSION IMMINENT ☢', lab ? 'You are underground. You are safe down here.' : 'Get to a shelter (green bunker) within 30 seconds!', 5, 'bad', 2);
    Sfx.play('siren'); Radio.say('emission', true); Hints.show('emission');
  }
  // lab guardian
  if (lab && !World.lab.bossSpawned) {
    const r = World.lab.bossRoom, tx = P.x / LAB_T, ty = P.y / LAB_T;
    if (tx > r.x0 - 0.5 && tx < r.x0 + r.w + 0.5 && ty > r.y0 - 0.5 && ty < r.y0 + r.h + 0.5) {
      World.lab.bossSpawned = true;
      const id = ['burer', 'pseudogiant', 'chimera'][World.lab.idx % 3];
      spawnBoss(id, { name: World.lab.name + ' GUARDIAN', hpMul: 0.5 + G.t / 900, labBoss: true, at: { x: (r.mx + 0.5) * LAB_T, y: (r.my + 0.5) * LAB_T } });
    }
  }
}
// next stage in the chain; unlocked by winning Standard or reaching Tier 2 (15:00) in Endless
function unlockNextStage() {
  const S = Save.data, i = STAGES.findIndex((s) => s.id === G.stage), nx = STAGES[i + 1];
  if (!nx || S.stages.includes(nx.id)) return null;
  S.stages.push(nx.id); Save.save(); G.unlocked = nx;
  return nx;
}
function nextBossTime() {
  if (!G.endless) return G.bossIdx < BOSS_SCHEDULE.length ? BOSS_SCHEDULE[G.bossIdx].t : null;
  return G.nextBossT;
}
function spawnNextBoss() {
  if (!G.endless) {
    const b = BOSS_SCHEDULE[G.bossIdx++];
    if (b.id === 'final') { const f = stageDef().final; spawnBoss(f.id, { name: f.name, hpMul: f.hp || 1, final: true }); }
    else spawnBoss(b.id);
    return;
  }
  G.nextBossT += 150; G.bossN++;
  if ((G.bossN + 1) % 7 === 0) { const f = stageDef().final; spawnBoss(f.id, { name: f.name + ' · TIER ' + G.tier, hpMul: (f.hp || 1) * 0.8 }); return; }
  const id = BOSS_POOL[G.bossN % BOSS_POOL.length];
  spawnBoss(id);
  if (G.tier >= 3 && G.bossN % 4 === 0) spawnBoss(BOSS_POOL[(G.bossN + 3) % BOSS_POOL.length]);
}
function inShelter(x, y) {
  if (World.kind === 'lab') return true;
  for (const s of World.shelters) if (dist2(x, y, s.x, s.y) < s.r * s.r) return s;
  return null;
}
function nearestShelter() { let b = null, bd = 1e12; for (const s of World.shelters) { const d = dist2(P.x, P.y, s.x, s.y); if (d < bd) { bd = d; b = s; } } return b; }
function updateEmission(dt) {
  const em = G.em; if (!em) return;
  em.t -= dt;
  const lab = World.kind === 'lab';
  if (em.phase === 'warn') {
    if (Math.floor(em.t) % 10 === 9 && Math.floor(em.t + dt) !== Math.floor(em.t)) Sfx.play('siren');
    if (!lab && Math.random() < dt * 0.6) { G.fx.push({ k: 'sky', x: P.x + rand(-500, 500), y: P.y + rand(-400, 300), life: 0.25, max: 0.25 }); Sfx.play('thunder'); }
    if (em.t <= 0) {
      em.phase = 'blast'; em.t = 8;
      Sfx.play('emission'); flash(lab ? 0.3 : 1, '255,120,80'); shake(lab ? 8 : 24);
      if (!lab) for (const e of G.enemies) if (!e.boss && !e.mini && !inShelter(e.x, e.y)) { burst(e.x, e.y, 6, '200,40,30', 120); killEnemy(e); }
      banner('EMISSION!', inShelter(P.x, P.y) ? 'Stay in cover!' : 'YOU ARE EXPOSED — RUN TO SHELTER!', 3, 'bad', 2);
    }
  } else if (em.phase === 'blast') {
    if (!inShelter(P.x, P.y)) {
      P.emAcc = (P.emAcc || 0) + 17 * dt; G.psi = Math.max(G.psi, 0.8);
      if (P.emAcc > 5) { hurtPlayer(P.emAcc, 'the Emission', true); P.emAcc = 0; }
    }
    if (!lab && Math.random() < dt * 5) { G.fx.push({ k: 'sky', x: P.x + rand(-600, 600), y: P.y + rand(-450, 350), life: 0.3, max: 0.3 }); Sfx.play('thunder'); shake(4); }
    if (em.t <= 0) {
      em.phase = 'after'; em.t = 3;
      const over = World.cur === 'over' ? World : null;
      for (const f of (over ? World.fields : World.levels.over.fields)) spawnArtifact(f);
      banner('THE EMISSION IS OVER', 'New artifacts have been born inside the anomalies.', 5, 'good');
      Radio.say('emissionEnd', true);
    }
  } else if (em.t <= 0) G.em = null;
}
function enemyShoot(e, a, spd, dmg, k, r = 6, free = false) {
  if (G.ebullets.length > 220) return false;
  if (!e.boss && !free) { if (G.shotBudget < 1) return false; G.shotBudget--; }
  G.ebullets.push({ x: e.x, y: e.y - (e.d.fly ? 0 : 20), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, k, r, life: 4 });
  return true;
}
function tele(x, y, x2, y2, w, t) { G.fx.push({ k: 'tele', x, y, x2, y2, w, life: t, max: t }); }
function updateEnemies(dt) {
  EG.clear();
  for (const e of G.enemies) if (!e.dead) EG.add(e);
  const lab = World.kind === 'lab';
  if (lab) { G.flowT -= dt; if (G.flowT <= 0) { G.flowT = 0.4; World.computeFlow(P.x, P.y); } }
  const farR = lab ? 1500 : Math.hypot(VW, VH) / 2 / ZOOM + 500;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash -= dt; e.cd -= dt; e.cd2 -= dt; e.cd3 -= dt; e.cast -= dt; e.shield -= dt; e.reveal -= dt; e.slowT -= dt; e.stun -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt; e.burnTick -= dt;
      if (e.burnTick <= 0) { e.burnTick = 0.5; hurtEnemy(e, e.burnDps * 0.5 * P.burnMul, 0, 0, true); if (e.dead) continue; }
      if (Math.random() < 0.3) part(e.x + rand(-6, 6), e.y - e.z - 10, { z: 10, vz: 60, g: -20, c: '255,140,40', add: true, s: 3, life: 0.4 });
    } else e.burnDps = 0;
    if (e.affix === 'regen') e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.03 * dt);
    if (e.id === 'phantom') { e.life = (e.life ?? 6) - dt; if (e.life <= 0) { killEnemy(e); continue; } }
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    let ux = dx / d, uy = dy / d;
    if (lab && d > 90) { const f = World.flowDir(e.x, e.y); if (f) { ux = f[0]; uy = f[1]; } }
    let sp = e.spd * (e.slowT > 0 ? 0.55 : 1), vx = ux * sp, vy = uy * sp;
    if (!e.boss && !e.mini && d > farR) { const p = ringPos(); if (p) { e.x = p[0]; e.y = p[1]; } continue; }
    if (e.stun > 0) { vx = vy = 0; }
    else switch (e.id) {
      case 'dog': case 'rat': case 'phantom': case 'pseudodog': { const w = Math.sin(e.t * 5 + e.seed) * (e.id === 'rat' ? 0.7 : 0.45); vx += -uy * sp * w; vy += ux * sp * w; break; }
      case 'psydog':
        if (e.cd2 <= 0 && d < 520) { e.cd2 = rand(6, 8); for (let i = 0; i < 2; i++) { const p = spawnEnemy('phantom', e.x + rand(-40, 40), e.y + rand(-40, 40), { noElite: true }); p.life = 6; } burst(e.x, e.y - 16, 16, '180,120,255', 140, { add: true }); Sfx.play('psi'); }
        break;
      case 'cat':
        e.alpha = lerp(e.alpha, e.reveal > 0 || d < 160 ? 1 : 0.5, dt * 5);
        if (e.cd2 <= 0 && d < 420 && d > 120) {
          e.cd2 = rand(4, 6); burst(e.x, e.y - 10, 10, '120,110,100', 100);
          const a = Math.atan2(-P.lastMy, -P.lastMx) + rand(-0.6, 0.6), nx = P.x + Math.cos(a) * 110, ny = P.y + Math.sin(a) * 110;
          if (World.free(nx, ny, 12)) { e.x = nx; e.y = ny; e.alpha = 0; }
          burst(e.x, e.y - 10, 10, '120,110,100', 100);
        }
        break;
      case 'izlom':
        if (e.state === 0 && d < 90 && e.cd <= 0) { e.state = 1; e.st = 0.45; e.swA = Math.atan2(dy, dx); tele(e.x, e.y, e.x + Math.cos(e.swA) * 100, e.y + Math.sin(e.swA) * 100, 60, 0.45); }
        if (e.state === 1) {
          vx *= 0.15; vy *= 0.15; e.st -= dt;
          if (e.st <= 0) {
            e.state = 0; e.cd = 1.4; G.fx.push({ k: 'slash', x: e.x, y: e.y - 20, a: e.swA, arc: 2, r: 100, life: 0.2, max: 0.2, red: true });
            if (d < 110 && Math.abs(angDiff(e.swA, Math.atan2(dy, dx))) < 1.1) hurtPlayer(e.dmg, 'an Izlom');
          }
        }
        break;
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
        e.alpha = lerp(e.alpha, vis ? 1 : Env.isNight() ? 0.05 : 0.1, dt * 6);
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
        if (d < 480 && !P.psiImmune) { G.psi = Math.max(G.psi, (1 - d / 480) * 0.7); P.slowNext = Math.max(P.slowNext, 0.2 * (1 - d / 480)); }
        if (e.cd <= 0 && d < 560) { e.cd = rand(2.6, 3.4); e.cast = 0.5; enemyShoot(e, Math.atan2(dy, dx), 210, 16, 'psi', 11); Sfx.play('psi'); }
        break;
      case 'pseudogiant':
        if (e.state === 0 && e.cd <= 0 && d < 520) { e.state = 1; e.st = e.enraged ? 0.6 : 0.85; e.wind = e.st; }
        if (e.state === 0 && e.enraged && e.cd2 <= 0 && d > 200 && d < 700) { e.state = 4; e.st = 0.55; e.chA = Math.atan2(dy, dx); tele(e.x, e.y, e.x + Math.cos(e.chA) * 520, e.y + Math.sin(e.chA) * 520, e.r * 2, 0.55); }
        if (e.state === 1) {
          vx = vy = 0; e.st -= dt; e.z = (e.wind - e.st) * 50;
          if (e.st <= 0) {
            e.state = 0; e.z = 0; e.cd = rand(3, 4.2);
            G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 560, max: 460, dmg: e.dmg, hit: false, life: 1, maxl: 1 });
            if (e.enraged) G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 560, max: 460, dmg: e.dmg, hit: false, life: 1.5, maxl: 1.5, delay: 0.4 });
            shake(16); Sfx.play('stomp'); burst(e.x, e.y, 30, '120,100,80', 300, { s: 5 }); decal(e.x, e.y, 60, '30,25,20');
          }
        } else if (e.state === 4) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 3; e.st = 0.8; } }
        else if (e.state === 3) { vx = Math.cos(e.chA) * 650; vy = Math.sin(e.chA) * 650; e.st -= dt; if (Math.random() < 0.5) burst(e.x, e.y, 2, '120,100,80', 80); if (e.st <= 0) { e.state = 0; e.cd2 = rand(5, 7); } }
        break;
      case 'chimera':
        if (e.state === 0) { vx *= 1.1; vy *= 1.1; if (e.cd <= 0 && d < 620) { e.state = 1; e.st = e.chain > 0 ? 0.35 : 0.6; e.tx = P.x; e.ty = P.y; G.fx.push({ k: 'target', x: P.x, y: P.y, r: 110, life: e.st + 0.55, max: e.st + 0.55 }); Sfx.play('roar'); } }
        else if (e.state === 1) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 2; e.st = 0.55; e.sx = e.x; e.sy = e.y; } }
        else if (e.state === 2) {
          vx = vy = 0; e.st -= dt; const t = 1 - Math.max(0, e.st) / 0.55;
          e.x = lerp(e.sx, e.tx, t); e.y = lerp(e.sy, e.ty, t); e.z = Math.sin(t * Math.PI) * 140;
          if (e.st <= 0) {
            e.state = 0; e.z = 0; shake(14); Sfx.play('stomp');
            if (e.enraged && !e.chain) e.chain = 3;
            if (e.chain > 0) { e.chain--; e.cd = 0.15; if (!e.chain) e.cd = rand(2.2, 3); } else e.cd = rand(2, 2.8);
            if (dist(e.x, e.y, P.x, P.y) < 110) hurtPlayer(e.dmg * 1.3, e.name);
            burst(e.x, e.y, 26, '110,95,80', 260, { s: 5 }); G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 110, life: 0.35, max: 0.35, c: '255,200,150' });
          }
        }
        break;
      case 'burer':
        if (d < 320) { vx = -ux * sp * 0.5; vy = -uy * sp * 0.5; }
        if (e.state === 0 && e.cd <= 0 && d < 650) {
          e.state = 1; e.st = 0.5; e.cast = 0.9; e.vA = Math.atan2(dy, dx);
          for (let i = -4; i <= 4; i += 2) tele(e.x, e.y - 20, e.x + Math.cos(e.vA + i * 0.13) * 420, e.y - 20 + Math.sin(e.vA + i * 0.13) * 420, 10, 0.5);
        }
        if (e.state === 1) {
          vx = vy = 0; e.st -= dt;
          if (e.st <= 0) {
            e.state = 0; e.cd = e.enraged ? rand(1.6, 2.2) : rand(2.2, 3);
            for (let i = 0; i < 9; i++) enemyShoot(e, e.vA + (i - 4) * 0.13, 340 + rand(-30, 30), 18, 'debris', 8);
            if (e.enraged) for (let i = 0; i < 16; i++) enemyShoot(e, (i / 16) * TAU, 220, 14, 'debris', 7);
            Sfx.play('throw');
          }
        }
        if (e.cd2 <= 0) { e.cd2 = e.enraged ? rand(5, 7) : rand(8, 10); e.shield = 2.4; Sfx.play('psi'); }
        if (e.shield > 0 && d < 500) { P.kvx += ux * -140 * dt * 4; P.kvy += uy * -140 * dt * 4; }
        break;
      case 'boar': case 'behemoth': {
        const big = e.id === 'behemoth';
        if (e.state === 0 && e.cd <= 0 && d < (big ? 620 : 400) && d > 90) {
          e.state = 4; e.st = big ? 0.7 : 0.55; e.chA = Math.atan2(dy, dx);
          tele(e.x, e.y, e.x + Math.cos(e.chA) * (big ? 650 : 360), e.y + Math.sin(e.chA) * (big ? 650 : 360), e.r * 1.6, e.st);
        }
        if (e.state === 4) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 3; e.st = big ? 0.9 : 0.6; Sfx.play('roar'); } }
        else if (e.state === 3) {
          const s = big ? 720 : 540; vx = Math.cos(e.chA) * s; vy = Math.sin(e.chA) * s; e.st -= dt;
          if (Math.random() < 0.6) burst(e.x, e.y, 2, '120,100,80', 90);
          if (e.st <= 0) {
            e.state = 0; e.cd = big ? (e.enraged ? 1.6 : 2.6) : rand(3, 4.5);
            if (big) { G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 520, max: 380, dmg: e.dmg * 0.8, hit: false, life: 1, maxl: 1 }); shake(12); Sfx.play('stomp'); }
          }
        }
        if (big && e.state === 0 && e.cd2 <= 0) {
          e.cd2 = e.enraged ? 4.5 : 6.5;
          for (let i = 0; i < (e.enraged ? 7 : 5); i++) {
            const x = P.x + rand(-170, 170), y = P.y + rand(-120, 120);
            G.fx.push({ k: 'target', x, y, r: 60, life: 1.1, max: 1.1 });
            G.timers.push({ t: 1.1, fn: () => explode(x, y, 60, 24, false) });
          }
        }
        break;
      }
      case 'karlik':
        if (d < 240) { vx = -ux * sp; vy = -uy * sp; } else if (d < 330) { vx = vy = 0; }
        if (e.cd <= 0 && d < 520) { e.cd = rand(2.4, 3.2); e.cast = 0.5; enemyShoot(e, Math.atan2(dy, dx), 300, e.dmg, 'debris', 7); }
        break;
      case 'spark': {
        e.z = 18 + Math.sin(e.t * 4) * 5;
        if (e.state === 0 && d < 150 && e.cd <= 0) { e.state = 1; e.st = 0.65; G.fx.push({ k: 'target', x: e.x, y: e.y, r: 135, life: 0.65, max: 0.65, blue: true }); }
        if (e.state === 1) {
          vx = vy = 0; e.st -= dt;
          if (e.st <= 0) {
            e.state = 0; e.cd = rand(2.5, 3.5); G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 135, life: 0.3, max: 0.3, c: '160,210,255' }); Sfx.play('zap');
            if (dist(e.x, e.y, P.x, P.y) < 140) hurtPlayer(e.dmg, e.name, false, 'anomaly');
          }
        }
        break;
      }
      case 'msoldier':
        if (d < 280) { vx = -ux * sp * 0.6; vy = -uy * sp * 0.6; } else if (d < 420) { vx = vy = 0; }
        if (e.state === 0 && e.cd <= 0 && d < 560 && G.shotBudget >= 1) {
          G.shotBudget--; e.state = 1; e.st = 0.65; e.aimA = Math.atan2(dy, dx);
          tele(e.x, e.y - 20, e.x + Math.cos(e.aimA) * 600, e.y - 20 + Math.sin(e.aimA) * 600, 5, 0.65);
        }
        if (e.state === 1) {
          vx = vy = 0; e.st -= dt;
          if (e.st <= 0) { e.state = 0; e.cd = rand(3, 4.2); for (let i = 0; i < 3; i++) G.timers.push({ t: i * 0.1, fn: () => { if (!e.dead) enemyShoot(e, e.aimA + rand(-0.04, 0.04), 520, e.dmg, 'bullet', 4, true); } }); Sfx.play('ak'); }
        }
        break;
      case 'matriarch': {
        const vis = e.state >= 3 || e.reveal > 0 || e.flash > 0 || d < 120;
        e.alpha = lerp(e.alpha, vis ? 1 : 0.15, dt * 5);
        if (e.state === 0 && e.cd <= 0 && d < 650) { e.state = 4; e.st = 0.55; e.chA = Math.atan2(dy, dx); e.chain = e.enraged ? 2 : 0; tele(e.x, e.y, e.x + Math.cos(e.chA) * 560, e.y + Math.sin(e.chA) * 560, 40, 0.55); }
        if (e.state === 4) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 3; e.st = 0.6; Sfx.play('roar'); } }
        else if (e.state === 3) {
          vx = Math.cos(e.chA) * 760; vy = Math.sin(e.chA) * 760; e.st -= dt;
          if (e.st <= 0) {
            if (e.chain > 0) { e.chain--; e.state = 4; e.st = 0.35; e.chA = Math.atan2(P.y - e.y, P.x - e.x); tele(e.x, e.y, e.x + Math.cos(e.chA) * 560, e.y + Math.sin(e.chA) * 560, 40, 0.35); }
            else { e.state = 0; e.cd = rand(3, 4); }
          }
        }
        if (e.cd2 <= 0) { e.cd2 = e.enraged ? 10 : 14; for (let i = 0; i < 2; i++) { const p = ringPos(-150); if (p) spawnEnemy('bloodsucker', p[0], p[1], { noElite: true }); } }
        break;
      }
      case 'polterking': {
        e.z = 40 + Math.sin(e.t * 2) * 8;
        if (d < 300) { vx = -uy * sp - ux * sp * 0.3; vy = ux * sp - uy * sp * 0.3; }
        if (e.cd <= 0) {
          e.cd = e.enraged ? 2.4 : 3.4;
          for (let i = 0; i < (e.enraged ? 7 : 5); i++) {
            const x = P.x + rand(-200, 200), y = P.y + rand(-140, 140);
            G.fx.push({ k: 'target', x, y, r: 60, life: 1, max: 1 });
            G.timers.push({ t: 1, fn: () => { explode(x, y, 60, 22, false); patch(x, y, 'fire', 40, 2); } });
          }
        }
        if (e.cd2 <= 0) { e.cd2 = 6; for (let i = 0; i < 14; i++) enemyShoot(e, (i / 14) * TAU, 200, 14, 'fire', 8); }
        if (e.cd3 <= 0) { e.cd3 = 9; burst(e.x, e.y - e.z, 20, '255,170,70', 160, { add: true }); const a = rand(TAU), nx = P.x + Math.cos(a) * 320, ny = P.y + Math.sin(a) * 240; if (World.free(nx, ny, 20)) { e.x = nx; e.y = ny; } }
        break;
      }
      case 'prime':
        if (d < 340) { vx = -ux * sp; vy = -uy * sp; } else if (d < 460) { vx = vy = 0; }
        if (d < 560 && !P.psiImmune) { P.slowNext = Math.max(P.slowNext, 0.15); G.psi = Math.max(G.psi, 0.4); }
        if (e.cd <= 0) {
          e.cd = e.enraged ? 3 : 4.5; e.cast = 0.8;
          G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 430, max: 620, dmg: e.dmg, hit: false, life: 1.6, maxl: 1.6, psi: true });
          if (e.enraged) G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 430, max: 620, dmg: e.dmg, hit: false, life: 2.2, maxl: 2.2, psi: true, delay: 0.55 });
          Sfx.play('psi');
        }
        if (e.cd2 <= 0) { e.cd2 = 12; for (let i = 0; i < 3; i++) { const p = ringPos(-150); if (p) spawnEnemy(i ? 'zombie' : 'psydog', p[0], p[1], { noElite: true }); } }
        break;
      case 'ratqueen':
        if (e.cd <= 0) { e.cd = e.enraged ? 3.2 : 4.8; for (let i = 0; i < 6; i++) { const a = rand(TAU); spawnEnemy('rat', e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 40, { noElite: true }); } Sfx.play('roar'); }
        if (e.cd2 <= 0) { e.cd2 = 5; const x = P.x, y = P.y; G.fx.push({ k: 'target', x, y, r: 90, life: 0.8, max: 0.8 }); G.timers.push({ t: 0.8, fn: () => patch(x, y, 'toxic', 90, 5) }); }
        break;
      case 'packalpha': {
        const w = Math.sin(e.t * 3 + e.seed) * 0.3; vx += -uy * sp * w; vy += ux * sp * w;
        if (e.cd <= 0) { e.cd = 10; for (let i = 0; i < 3; i++) { const p = ringPos(-200); if (p) spawnEnemy('pseudodog', p[0], p[1], { noElite: true }); } Sfx.play('roar'); }
        if (e.state === 0 && d < 280 && e.cd2 <= 0) { e.state = 1; e.st = 0.45; G.fx.push({ k: 'target', x: P.x, y: P.y, r: 70, life: 0.9, max: 0.9 }); }
        if (e.state === 1) { vx = vy = 0; e.st -= dt; if (e.st <= 0) { e.state = 2; e.st = 0.45; e.lvx = ux * 640; e.lvy = uy * 640; e.vz = 280; } }
        else if (e.state === 2) { vx = e.lvx; vy = e.lvy; e.st -= dt; if (e.st <= 0) { e.state = 0; e.cd2 = e.enraged ? 1.6 : 2.6; } }
        break;
      }
      case 'izlomlord':
        if (e.state === 0 && d < 160 && e.cd <= 0) { e.state = 1; e.st = 0.6; e.swA = Math.atan2(dy, dx); tele(e.x, e.y, e.x + Math.cos(e.swA) * 180, e.y + Math.sin(e.swA) * 180, 130, 0.6); }
        if (e.state === 1) {
          vx *= 0.1; vy *= 0.1; e.st -= dt;
          if (e.st <= 0) {
            e.state = 0; e.cd = e.enraged ? 0.9 : 1.5; shake(8);
            G.fx.push({ k: 'slash', x: e.x, y: e.y - 30, a: e.swA, arc: 2.4, r: 180, life: 0.25, max: 0.25, red: true });
            if (d < 190 && Math.abs(angDiff(e.swA, Math.atan2(dy, dx))) < 1.3) hurtPlayer(e.dmg, e.name);
            if (e.enraged) G.fx.push({ k: 'shock', x: e.x, y: e.y, r: 10, spd: 500, max: 340, dmg: e.dmg * 0.6, hit: false, life: 1, maxl: 1 });
          }
        }
        break;
      case 'monolith': {
        e.z = 30 + Math.sin(e.t * 1.5) * 10;
        if (d < 260) { vx = -ux * sp; vy = -uy * sp; } else if (d < 380) { vx = vy = 0; }
        const p2 = e.enraged;
        e.spin = (e.spin || 0) + dt * (p2 ? 2.4 : 1.6);
        e.st -= dt;
        if (e.st <= 0) { e.st = p2 ? 0.15 : 0.22; const arms = p2 ? 3 : 2; for (let i = 0; i < arms; i++) enemyShoot(e, e.spin + (i * TAU) / arms, 200, 14, 'mono', 7); }
        if (e.cd <= 0) { e.cd = p2 ? 2.6 : 3.6; for (let i = 0; i < 20; i++) enemyShoot(e, (i / 20) * TAU + e.spin * 0.5, 170, 16, 'mono', 7); Sfx.play('psi'); }
        if (e.cd2 <= 0) { e.cd2 = 14; for (let i = 0; i < 4; i++) { const p = ringPos(-200); if (p) spawnEnemy(i === 0 ? 'controller' : 'snork', p[0], p[1], { noElite: true }); } }
        if (e.hp < e.maxhp * 0.6 && e.cd3 <= 0) {
          e.cd3 = 6; const a0 = Math.atan2(dy, dx);
          for (const off of [-0.35, 0, 0.35]) {
            const a = a0 + off; tele(e.x, e.y - e.z, e.x + Math.cos(a) * 1100, e.y - e.z + Math.sin(a) * 1100, 26, 1);
            G.timers.push({ t: 1, fn: () => {
              if (e.dead) return;
              G.fx.push({ k: 'beam', x: e.x, y: e.y - e.z, x2: e.x + Math.cos(a) * 1100, y2: e.y - e.z + Math.sin(a) * 1100, w: 22, life: 0.35, max: 0.35, psi: true });
              const px = P.x - e.x, py = P.y - 20 - (e.y - e.z), along = px * Math.cos(a) + py * Math.sin(a), perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a));
              if (along > 0 && along < 1100 && perp < 30) hurtPlayer(30, e.name);
            } });
          }
        }
        if (d < 700 && !P.psiImmune) G.psi = Math.max(G.psi, 0.25);
        break;
      }
    }
    if (e.mut && e.stun <= 0) updateMutation(e, dt, d, dx / d, dy / d);
    EG.query(e.x, e.y, e.r + 24, TMP);
    for (const o of TMP) {
      if (o === e || o.dead) continue;
      const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, m = e.r + o.r;
      if (dd < m * m && dd > 0.01) { const l = Math.sqrt(dd), push = ((m - l) / l) * 0.5 * Math.min(1, (o.d.mass * o.sc) / (e.d.mass * e.sc)); e.x += ox * push; e.y += oy * push; }
    }
    e.x += (vx + e.kvx) * dt; e.y += (vy + e.kvy) * dt;
    const kd = Math.pow(0.004, dt); e.kvx *= kd; e.kvy *= kd;
    if (e.id === 'snork' || e.id === 'dog' || e.id === 'packalpha') { if (e.vz || e.z > 0) { e.z += e.vz * dt; e.vz -= 900 * dt; if (e.z <= 0) { e.z = 0; e.vz = 0; } } }
    if (!e.d.fly && !(e.state === 2 && (e.id === 'chimera' || e.id === 'snork' || e.id === 'packalpha'))) World.collide(e);
    if (Math.abs(vx) > 4) e.face = vx > 0 ? 1 : -1;
    e.anim += dt * (4 + Math.hypot(vx, vy) / 18);
    if (d < e.r + P.r + 2 && e.z < 20 && e.stun <= 0) {
      const had = P.inv <= 0 && P.dashT <= 0;
      hurtPlayer(e.dmg, e.name);
      if (had) {
        if (P.thorns) hurtEnemy(e, P.thorns, -ux * 200, -uy * 200, true);
        if (e.affix === 'vampiric') e.hp = Math.min(e.maxhp, e.hp + e.dmg * 3);
      }
    }
  }
  G.enemies = G.enemies.filter((e) => !e.dead);
  G.bosses = G.bosses.filter((e) => !e.dead);
}

// ---------- anomalies ----------
function updateAnomalies(dt) {
  const wet = World.kind === 'over' && (Env.weather === 'rain' || Env.weather === 'storm');
  P.portT = (P.portT || 0) - dt;
  for (const a of World.anomalies) {
    if (Math.abs((a.cx ?? a.x) - P.x) > 1500 || Math.abs((a.cy ?? a.y) - P.y) > 1300) continue;
    a.cd -= dt; a.act = Math.max(0, a.act - dt);
    const R = a.type === 'electro' && wet ? a.r * 1.3 : a.r;
    const pd = dist(a.x, a.y, P.x, P.y), pin = pd < R + P.r * 0.5 && P.dashT <= 0;
    EG.query(a.x, a.y, R, TMP2);
    switch (a.type) {
      case 'electro':
        if (a.cd <= 0 && (pin || TMP2.some((e) => dist(a.x, a.y, e.x, e.y) < R && !e.d.fly))) {
          a.cd = 1.7; a.act = 0.28;
          for (const e of TMP2) if (dist(a.x, a.y, e.x, e.y) < R && !e.d.fly) hurtEnemy(e, 45, 0, 0, true);
          if (pd < R) hurtPlayer(22, 'an Electro anomaly', false, 'anomaly');
          if (pd < 700) { Sfx.play('zap'); burst(a.x, a.y, 12, '150,210,255', 200, { add: true }); }
        }
        break;
      case 'burner':
        if (a.cd <= 0 && a.act <= 0 && (pin || TMP2.some((e) => dist(a.x, a.y, e.x, e.y) < a.r * 0.9 && !e.d.fly))) { a.act = 1.4; a.cd = 2.8; if (pd < 700) Sfx.play('fire'); }
        if (a.act > 0) {
          for (const e of TMP2) if (dist(a.x, a.y, e.x, e.y) < a.r * 0.9) { e.burnAcc = (e.burnAcc || 0) + 70 * dt; if (e.burnAcc > 10) { hurtEnemy(e, e.burnAcc, 0, 0, true); e.burnAcc = 0; } }
          if (pd < a.r * 0.9) { P.burnAcc = (P.burnAcc || 0) + 38 * dt; if (P.burnAcc > 8) { hurtPlayer(P.burnAcc, 'a Burner anomaly', true, 'anomaly'); P.burnAcc = 0; } }
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
          if (e.boss || e.d.fly) continue;
          if (pull(e, 380)) { e.vt += dt; if (e.vt > 0.5) { e.vt = 0; hurtEnemy(e, 120, rand(-600, 600), rand(-600, 600), true); a.act = 0.5; burst(a.x, a.y, 16, '130,20,20', 260); if (pd < 700) Sfx.play('vortex'); } }
        }
        if (P.dashT <= 0 && pull(P, 250 * (1 - P.anomRes * 0.5))) {
          P.vt = (P.vt || 0) + dt;
          if (P.vt > 0.55) { P.vt = 0; hurtPlayer(30, 'a Vortex anomaly', false, 'anomaly'); const an = rand(TAU); P.kvx = Math.cos(an) * 700; P.kvy = Math.sin(an) * 700; a.act = 0.5; Sfx.play('vortex'); shake(10); }
        } else P.vt = 0;
        break;
      }
      case 'acid':
        for (const e of TMP2) if (!e.d.fly && dist(a.x, a.y, e.x, e.y) < a.r * 0.85) { e.slowT = 0.2; e.acidAcc = (e.acidAcc || 0) + 22 * dt; if (e.acidAcc > 6) { hurtEnemy(e, e.acidAcc, 0, 0, true); e.acidAcc = 0; } }
        if (pd < a.r * 0.85 && P.dashT <= 0) {
          P.slowNext = Math.max(P.slowNext, 0.4 * (1 - P.anomRes)); P.acidAcc = (P.acidAcc || 0) + 11 * dt;
          if (P.acidAcc > 5) { hurtPlayer(P.acidAcc, 'a Fruit Punch anomaly', true, 'anomaly'); P.acidAcc = 0; }
          if (Math.random() < 0.3) part(P.x + rand(-8, 8), P.y, { vz: 60, z: 2, g: 0, c: '160,255,80', add: true, s: 3, life: 0.5 });
        }
        break;
      case 'teleport': {
        const port = (o, isP) => {
          const q = a.pair; if (!q) return;
          const an = rand(TAU); o.x = q.x + Math.cos(an) * (q.r + o.r + 14); o.y = q.y + Math.sin(an) * (q.r + o.r + 14) * 0.8;
          a.act = q.act = 0.5; burst(a.x, a.y - 20, 12, '160,220,255', 140, { add: true }); burst(o.x, o.y - 20, 12, '160,220,255', 140, { add: true });
          if (isP) { P.portT = 1.2; P.kvx = P.kvy = 0; Sfx.play('dash'); CAM.x = lerp(CAM.x, P.x, 0.7); CAM.y = lerp(CAM.y, P.y, 0.7); }
        };
        if (pin && !(P.portT > 0)) port(P, true);
        for (const e of TMP2) if (!e.boss && !(e.portT > G.t) && dist2(a.x, a.y, e.x, e.y) < a.r * a.r) { e.portT = G.t + 2; port(e, false); }
        break;
      }
      case 'cryo':
        for (const e of TMP2) if (!e.d.fly && dist(a.x, a.y, e.x, e.y) < a.r) { e.slowT = 0.4; e.coldAcc = (e.coldAcc || 0) + 14 * dt; if (e.coldAcc > 7) { hurtEnemy(e, e.coldAcc, 0, 0, true); e.coldAcc = 0; } }
        if (pd < a.r && P.dashT <= 0) { P.slowNext = Math.max(P.slowNext, 0.55 * (1 - P.anomRes)); P.coldAcc = (P.coldAcc || 0) + 7 * dt; if (P.coldAcc > 5) { hurtPlayer(P.coldAcc, 'a Frost anomaly', true, 'anomaly'); P.coldAcc = 0; } }
        break;
      case 'gas':
        if (a.cd <= 0) {
          a.cd = 2; a.act = 0.6;
          for (const e of TMP2) if (dist(a.x, a.y, e.x, e.y) < a.r) hurtEnemy(e, 22, 0, 0, true);
          if (pd < a.r) hurtPlayer(10, 'Chemical Gas', true, 'anomaly');
        }
        break;
      case 'mincer': {
        const pull = (o, str) => {
          const ox = a.x - o.x, oy = a.y - o.y, dd = Math.hypot(ox, oy) || 1;
          if (dd > a.r) return false;
          const f = (1 - dd / a.r) * str; o.x += (ox / dd) * f * dt + (-oy / dd) * f * 0.5 * dt; o.y += (oy / dd) * f * dt + (ox / dd) * f * 0.5 * dt;
          return dd < 24;
        };
        for (const e of TMP2) { if (e.boss || e.d.fly) continue; if (pull(e, 480)) { e.vt += dt; if (e.vt > 0.35) { e.vt = 0; hurtEnemy(e, 150, 0, 0, true); a.act = 0.5; burst(a.x, a.y - 20, 22, '150,20,20', 300, { s: 4 }); decal(a.x, a.y, 30, '90,10,10'); if (pd < 700) Sfx.play('vortex'); } } }
        if (P.dashT <= 0 && pull(P, 270 * (1 - P.anomRes * 0.5))) {
          P.vt = (P.vt || 0) + dt;
          if (P.vt > 0.5) { P.vt = 0; hurtPlayer(34, 'a Mincer anomaly', false, 'anomaly'); const an = rand(TAU); P.kvx = Math.cos(an) * 800; P.kvy = Math.sin(an) * 800; a.act = 0.5; shake(12); }
        } else P.vt = 0;
        break;
      }
      case 'tesla': {
        a.ang += dt * a.spd; a.x = a.cx + Math.cos(a.ang) * a.orb; a.y = a.cy + Math.sin(a.ang) * a.orb * 0.62;
        if (a.zapT > 0) a.zapT -= dt; else a.zap = null;
        if (a.cd <= 0) {
          let tgt = null, td = 90 * 90;
          if (dist2(a.x, a.y, P.x, P.y) < td && P.dashT <= 0) tgt = P;
          if (!tgt) for (const e of TMP2) if (dist2(a.x, a.y, e.x, e.y) < td) { tgt = e; break; }
          if (tgt) {
            a.cd = 0.7; a.zap = [tgt.x, tgt.y - 20]; a.zapT = 0.15;
            if (tgt === P) hurtPlayer(12, 'a Tesla anomaly', false, 'anomaly'); else hurtEnemy(tgt, 35, 0, 0, true);
            if (pd < 600) Sfx.play('zap');
          }
        }
        break;
      }
      case 'comet': {
        a.ang += dt * a.spd * a.dir; a.x = a.cx + Math.cos(a.ang) * a.orb; a.y = a.cy + Math.sin(a.ang) * a.orb * 0.62;
        if (pd < a.r + P.r && !(P.cometT > G.t) && P.dashT <= 0) { P.cometT = G.t + 1; hurtPlayer(22, 'a Comet anomaly', false, 'anomaly'); P.kvx = (P.x - a.x) * 8; P.kvy = (P.y - a.y) * 8; }
        for (const e of TMP2) if (!(e.cometT > G.t) && dist2(a.x, a.y, e.x, e.y) < (a.r + e.r) ** 2) { e.cometT = G.t + 1; hurtEnemy(e, 60, (e.x - a.x) * 10, (e.y - a.y) * 10, true); e.burnT = 2; e.burnDps = 15; }
        break;
      }
      case 'fuzz':
        for (const e of TMP2) if (!e.d.fly && dist(a.x, a.y, e.x, e.y) < a.r) { e.fuzzAcc = (e.fuzzAcc || 0) + 18 * dt; if (e.fuzzAcc > 9) { hurtEnemy(e, e.fuzzAcc, 0, 0, true); e.fuzzAcc = 0; a.act = 0.3; } }
        if (pd < a.r && P.moving && P.dashT <= 0) { a.act = 0.3; P.fuzzAcc = (P.fuzzAcc || 0) + 12 * dt; if (P.fuzzAcc > 5) { hurtPlayer(P.fuzzAcc, 'Burnt Fuzz', true, 'anomaly'); P.fuzzAcc = 0; } }
        break;
      case 'psifield':
        if (pd < a.r && !P.psiImmune) { G.psi = Math.max(G.psi, 0.6); P.slowNext = Math.max(P.slowNext, 0.2); P.psiAcc = (P.psiAcc || 0) + 5 * dt; if (P.psiAcc > 5) { hurtPlayer(P.psiAcc, 'a Psi-Field', true, 'anomaly'); P.psiAcc = 0; } }
        if (a.cd <= 0) { a.cd = 3; for (const e of TMP2) if (!e.boss && dist(a.x, a.y, e.x, e.y) < a.r) { e.stun = 1; hurtEnemy(e, 15, 0, 0, true); } }
        break;
      case 'spring':
        if (a.cd <= 0) {
          let fired = false;
          for (const e of TMP2) {
            const dd = dist(a.x, a.y, e.x, e.y);
            if (dd < a.r && !e.boss && !e.d.fly) { fired = true; hurtEnemy(e, 40, ((e.x - a.x) / (dd || 1)) * 900, ((e.y - a.y) / (dd || 1)) * 900, true); }
          }
          if (pin) { fired = true; hurtPlayer(16, 'a Springboard', false, 'anomaly'); P.kvx = ((P.x - a.x) / (pd || 1)) * 650; P.kvy = ((P.y - a.y) / (pd || 1)) * 650; }
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
    if ((e.id === 'bloodsucker' || e.id === 'cat') && e.alpha < 0.3) continue;
    const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function nearestTo(x, y, range, not) {
  EG.query(x, y, range, TMP3);
  let best = null, bd = range * range;
  for (const e of TMP3) { if (e === not || e.dead) continue; const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function shoot(x, y, a, spd, dmg, o = {}) {
  const grav = P.syn.gravity ? 1 : 0;
  G.bullets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, r: (o.r || 4) * (grav ? 1.3 : 1), life: o.life || 1.1, pierce: (o.pierce || 0) + P.pierce + grav, hits: [], k: o.k || 'bullet',
    knock: o.knock || 60, bounces: o.bounces || 0, ex: o.ex || 0, ignite: o.ignite, vortex: o.vortex, rocket: o.rocket, big: o.big });
}
function wmul(w) { return 1 + (w.bonus || 0); }
function fireWeapon(w, s) {
  const gx = P.x, gy = P.y - 22, evo = w.evo, bm = wmul(w);
  switch (w.id) {
    case 'pistol': {
      const t = nearest(P.x, P.y, 650); if (!t) return false;
      const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx); P.aim = a;
      if (evo) { for (let i = 0; i < 3; i++) shoot(gx, gy, a + (i - 1) * 0.12, 950, s.dmg * 3 * bm, { pierce: 4, knock: 420, r: 7, big: true }); P.muzzle = 0.08; shake(2); Sfx.play('shotgun'); return true; }
      for (let i = 0; i < s.count; i++) shoot(gx, gy, a + (i - (s.count - 1) / 2) * 0.13, s.spd, s.dmg * bm, { pierce: s.pierce });
      P.muzzle = 0.05; Sfx.play('pistol'); return true;
    }
    case 'ak': {
      const t = nearest(P.x, P.y, 600); if (!t) return false;
      const a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx) + rand(-0.07, 0.07); P.aim = a;
      for (let i = 0; i < s.count; i++) { const o = (i - (s.count - 1) / 2) * 8; shoot(gx - Math.sin(a) * o, gy + Math.cos(a) * o, a, s.spd, s.dmg * bm * (evo ? 1.2 : 1), { pierce: s.pierce, r: 3.5, ex: evo ? 45 : 0 }); }
      P.muzzle = 0.05; Sfx.play('ak'); return true;
    }
    case 'shotgun': {
      const t = nearest(P.x, P.y, evo ? 420 : 360); if (!t) return false;
      const a = Math.atan2(t.y - gy, t.x - gx); P.aim = a;
      const full = s.full || evo, n = full ? s.pellets * 2 : s.pellets;
      for (let i = 0; i < n; i++) { const aa = full ? (i / n) * TAU : a + rand(-s.spread, s.spread) / 2; shoot(gx, gy, aa, s.spd * rand(0.85, 1.1), s.dmg * bm * (evo ? 1.3 : 1), { life: 0.42, knock: 240, r: 3.5, ignite: evo }); }
      P.muzzle = 0.07; shake(2); Sfx.play('shotgun'); return true;
    }
    case 'grenade': {
      const cands = G.enemies.filter((e) => dist2(P.x, P.y, e.x, e.y) < 520 * 520);
      if (!cands.length) return false;
      for (let i = 0; i < s.count; i++) {
        let best = null, bn = -1;
        for (let k = 0; k < 8; k++) { const c = pick(cands); EG.query(c.x, c.y, 80, TMP); if (TMP.length > bn) { bn = TMP.length; best = c; } }
        if (evo) { const a = Math.atan2(best.y - gy, best.x - gx); shoot(gx, gy, a, 700, s.dmg * bm, { k: 'rocket', rocket: s.radius * P.areaMul, life: 1.2, r: 6 }); }
        else G.throws.push({ x0: P.x, y0: P.y - 20, x1: best.x + rand(-20, 20), y1: best.y + rand(-20, 20), t: 0, T: 0.65, dmg: s.dmg * bm, r: s.radius * P.areaMul });
      }
      Sfx.play('throw'); return true;
    }
    case 'bolts': {
      const t = nearest(P.x, P.y, 520); if (!t) return false;
      const a = Math.atan2(t.y - gy, t.x - gx);
      for (let i = 0; i < s.count; i++) shoot(gx, gy, a + (i - (s.count - 1) / 2) * 0.4, s.spd, s.dmg * bm, { k: 'bolt', bounces: s.bounces, life: 2, r: 5, knock: 80, vortex: evo });
      Sfx.play('throw'); return true;
    }
    case 'gauss': {
      const t = nearest(P.x, P.y, 850); if (!t) return false;
      for (let i = 0; i < s.count; i++) {
        const a = Math.atan2(t.y - t.z - gy, t.x - gx) + (i ? Math.PI : 0); P.aim = a;
        const L = 1000, x2 = gx + Math.cos(a) * L, y2 = gy + Math.sin(a) * L, wdt = s.width * P.areaMul;
        const hit = [];
        for (const e of G.enemies) {
          const ex = e.x - gx, ey = e.y - e.z - 12 - gy, along = ex * Math.cos(a) + ey * Math.sin(a);
          if (along < 0 || along > L) continue;
          const perp = Math.abs(-ex * Math.sin(a) + ey * Math.cos(a));
          if (perp < wdt + e.r) hit.push(e);
        }
        for (const e of hit) {
          hurtEnemy(e, s.dmg * bm, Math.cos(a) * 200, Math.sin(a) * 200);
          if (evo) { const n = nearestTo(e.x, e.y, 200, e); if (n) { hurtEnemy(n, s.dmg * 0.4 * bm, 0, 0, false, false); G.fx.push({ k: 'lightning', pts: [[e.x, e.y - e.z - 14], [n.x, n.y - n.z - 14]], life: 0.2, max: 0.2 }); } }
        }
        for (let k = 0; k < L; k += 60) { const ob = World.solidAt(gx + Math.cos(a) * k, gy + 22 + Math.sin(a) * k); if (ob && ob.hp) damageOb(ob, s.dmg); }
        G.fx.push({ k: 'beam', x: gx, y: gy, x2, y2, w: wdt * (evo ? 1.4 : 1), life: 0.3, max: 0.3 });
      }
      shake(4); Sfx.play('gauss'); return true;
    }
    case 'knife': {
      const R = s.radius * P.areaMul * (evo ? 1.45 : 1), t = nearest(P.x, P.y, R + 20); if (!t) return false;
      const a = Math.atan2(t.y - P.y, t.x - P.x), arc = evo ? TAU : s.arc;
      EG.query(P.x, P.y, R + 30, TMP);
      let healed = 0;
      for (const e of TMP) {
        const d = dist(P.x, P.y, e.x, e.y); if (d > R + e.r) continue;
        if (arc < TAU && Math.abs(angDiff(a, Math.atan2(e.y - P.y, e.x - P.x))) > arc / 2) continue;
        hurtEnemy(e, s.dmg * bm * (evo ? 1.4 : 1), ((e.x - P.x) / d) * 160, ((e.y - P.y) / d) * 160);
        if (evo && healed < 8) { healed++; P.hp = Math.min(P.maxhp, P.hp + 1); }
      }
      G.fx.push({ k: 'slash', x: P.x, y: P.y - 16, a, arc, r: R, life: 0.22, max: 0.22, blood: evo });
      Sfx.play('knife'); return true;
    }
  }
  return false;
}
function updateWeapons(dt) {
  for (const w of P.weapons) {
    w.cd -= dt * P.rateMul * (w.evo && w.id === 'ak' ? 1.7 : 1);
    if (w.cd > 0) continue;
    const s = WEAPONS[w.id].stats(w.lv);
    w.cd = fireWeapon(w, s) ? Math.max(0.05, s.cd * (w.evo && w.id === 'shotgun' ? 0.8 : 1)) : 0.12;
  }
  if (P.shards) {
    const R = 78 * P.areaMul, n = P.shards;
    for (let i = 0; i < n; i++) {
      const a = NOW * 2.8 + (i / n) * TAU, x = P.x + Math.cos(a) * R, y = P.y - 14 + Math.sin(a) * R * 0.7;
      EG.query(x, y + 14, 30, TMP);
      for (const e of TMP) if (dist2(x, y + 14, e.x, e.y) < (e.r + 12) ** 2 && (e.shardT || 0) < NOW) { e.shardT = NOW + 0.35; hurtEnemy(e, 10 + n * 3, Math.cos(a) * 120, Math.sin(a) * 120); }
    }
  }
  if (P.lightning) {
    G.lightT -= dt * P.rateMul;
    if (G.lightT <= 0) {
      let t = nearest(P.x, P.y, 460);
      if (t) {
        G.lightT = 1.5;
        const hit = [], pts = [[P.x, P.y - 30]];
        for (let i = 0; i < 1 + P.lightning * 2 + (P.syn.electric ? 2 : 0) && t; i++) {
          hit.push(t); pts.push([t.x, t.y - t.z - 14]);
          hurtEnemy(t, 18 + P.lightning * 8, 0, 0, false, false);
          t = nearest(t.x, t.y, 220, hit);
        }
        G.fx.push({ k: 'lightning', pts, life: 0.22, max: 0.22 }); Sfx.play('zap');
      } else G.lightT = 0.2;
    }
  }
  if (P.aura) {
    G.auraT -= dt;
    if (G.auraT <= 0) {
      G.auraT = 0.3;
      const R = (70 + P.aura * 16) * P.areaMul;
      EG.query(P.x, P.y, R, TMP);
      for (const e of TMP) if (dist2(P.x, P.y, e.x, e.y) < (R + e.r) ** 2) hurtEnemy(e, (8 + P.aura * 6) * 0.9, 0, 0, false, false);
    }
  }
  if (P.syn.electric === 2) {
    G.thunderT -= dt;
    if (G.thunderT <= 0) { G.thunderT = 4; for (let i = 0; i < 5; i++) G.timers.push({ t: i * 0.1, fn: () => { const t = randomEnemyNear(P.x, P.y, 600); if (t) strike(t.x, t.y, 60 * P.dmgMul, 55, false); } }); }
  }
}
function updateBullets(dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; if (b.rocket) rocketBoom(b); continue; }
    if (b.rocket && Math.random() < 0.7) part(b.x, b.y + 20, { z: 20, c: '200,200,200', s: 5, life: 0.5, g: -20 });
    const ob = World.solidAt(b.x, b.y + 22);
    if (ob) {
      if (ob.hp) damageOb(ob, b.dmg);
      if (b.k === 'bolt' && b.bounces > 0) { b.bounces--; b.vx *= -1; b.vy *= -1; b.x += b.vx * dt * 2; b.y += b.vy * dt * 2; }
      else { b.dead = true; if (b.rocket) rocketBoom(b); else if (b.ex) explode(b.x, b.y + 20, b.ex, b.dmg * 0.5, true); else burst(b.x, b.y + 20, 4, '220,200,160', 90, { z: 20, life: 0.3 }); continue; }
    }
    EG.query(b.x, b.y + 16, 50, TMP);
    for (const e of TMP) {
      if (e.dead || b.hits.includes(e)) continue;
      if ((e.id === 'bloodsucker' || e.id === 'cat') && e.alpha < 0.3 && b.k !== 'bolt') continue;
      const ex = e.x, ey = e.y - e.z - e.r;
      if (dist2(b.x, b.y, ex, ey) < (e.r + b.r + 6) ** 2) {
        if (b.rocket) { b.dead = true; rocketBoom(b); break; }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        hurtEnemy(e, b.dmg, (b.vx / sp) * b.knock, (b.vy / sp) * b.knock);
        if (b.ignite) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, b.dmg * P.dmgMul * 0.6); }
        if (b.ex) explode(e.x, e.y, b.ex, b.dmg * 0.4, true);
        if (b.vortex) G.fx.push({ k: 'hole', x: e.x, y: e.y, r: 110, life: 1.2, max: 1.2, dps: 25, pull: 300, end: b.dmg, tick: 0 });
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
      if (b.k === 'psi' && !P.psiImmune) { P.psiSlowT = 1; G.psi = 1; }
    }
  }
  G.ebullets = G.ebullets.filter((b) => !b.dead);
  for (const t of G.throws) { t.t += dt; if (t.t >= t.T) { t.dead = true; explode(t.x1, t.y1, t.r, t.dmg); } }
  G.throws = G.throws.filter((t) => !t.dead);
}
function rocketBoom(b) {
  explode(b.x, b.y + 20, b.rocket, b.dmg, true);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; G.throws.push({ x0: b.x, y0: b.y, x1: b.x + Math.cos(a) * 110, y1: b.y + 20 + Math.sin(a) * 80, t: 0, T: 0.45, dmg: b.dmg * 0.5, r: b.rocket * 0.6 }); }
}

// ---------- pickups, crates, artifacts, hatches, POIs ----------
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
    if (dist2(p.x, p.y, P.x, P.y) < 34 * 34) {
      p.dead = true;
      if (p.type === 'med') { const h = Math.round(35 * P.medMul); P.hp = Math.min(P.maxhp, P.hp + h); text(P.x, P.y - 50, '+' + h + ' HP', '#6f6', false, true); Sfx.play('heal'); }
      else if (p.type === 'magnet') { for (const g of G.gems) g.mag = true; banner('MAGNET', 'All XP pulled in!', 1.5, 'good'); Sfx.play('heal'); }
      else if (p.type === 'art') takeArtifact(pick(Object.keys(ARTIFACTS)));
      else if (p.type === 'stash') { P.hp = P.maxhp; takeArtifact(pick(Object.keys(ARTIFACTS)), ' • full heal, +1 level'); G.pendingLv++; }
      else if (p.type === 'poistash') { G.rubles += 60; takeArtifact(pick(Object.keys(ARTIFACTS)), ' • +60 ₽'); for (let i = 0; i < 10; i++) dropGem(p.x + rand(-50, 50), p.y + rand(-50, 50), 4 + Math.floor(G.t / 60)); }
      else if (p.type === 'labstash') { G.rubles += 150; P.hp = P.maxhp; openArtifactChoice(); }
    }
  }
  G.pickups = G.pickups.filter((p) => !p.dead);
  for (const c of G.crates) {
    if (c.open) { c.open += dt; continue; }
    if (dist2(c.x, c.y, P.x, P.y) < 34 * 34) {
      c.open = 0.001; Sfx.play('stash'); burst(c.x, c.y, 14, '140,100,60', 160, { s: 4 });
      const r = Math.random();
      if (r < 0.45) G.pickups.push({ type: 'med', x: c.x + 10, y: c.y + 10, t: 0 });
      else if (r < 0.85) for (let i = 0; i < 6; i++) dropGem(c.x, c.y, 3 + Math.floor(G.t / 60));
      else G.pickups.push({ type: 'magnet', x: c.x + 10, y: c.y + 10, t: 0 });
      G.rubles += 3;
    }
  }
  for (const f of World.fields) {
    const a = f.art; if (!a) continue;
    if (dist2(a.x, a.y, P.x, P.y) < 24 * 24) { f.art = null; takeArtifact(a.type); Quests.prog('artifact'); }
  }
  // hatches: stand on one to travel
  let on = null;
  for (const h of World.hatches) if (dist2(h.x, h.y, P.x, P.y) < 42 * 42) on = h;
  if (on) { P.hatchT += dt; if (P.hatchT > 0.9) { P.hatchT = 0; useHatch(on); } } else P.hatchT = 0;
  G.onHatch = on;
  // mutant lairs
  if (World.kind === 'over') for (const L of World.lairs) {
    if (L.dead) continue;
    const d2 = dist2(L.x, L.y, P.x, P.y);
    if (d2 > 1000 * 1000) continue;
    if (L.state === 0) {
      L.state = 1; L.ob.hp = L.maxhp = 450 * hpScale(G.t / 60) * stageDef().hpMul;
      banner('☣ ' + ENEMIES[L.family].name.toUpperCase() + ' LAIR', 'It keeps spawning mutants. Shoot it to destroy it!', 3, 'bad'); Hints.show('poi');
    }
    L.spawned = L.spawned.filter((e) => !e.dead);
    L.spawnT -= dt;
    if (L.spawnT <= 0 && L.spawned.length < 7 && d2 < 900 * 900) {
      L.spawnT = 3.2;
      const n = L.family === 'rat' ? 3 : L.family === 'dog' || L.family === 'pseudodog' ? 2 : 1;
      for (let i = 0; i < n; i++) { const a = rand(TAU); L.spawned.push(spawnEnemy(L.family, L.x + Math.cos(a) * 70, L.y + Math.sin(a) * 50, { noElite: true })); }
      burst(L.x, L.y - 10, 12, '120,90,60', 140, { s: 4 });
    }
  }
  // points of interest
  if (World.kind === 'over') for (const poi of World.pois) {
    if (poi.state === 0 && dist2(poi.x, poi.y, P.x, P.y) < 560 * 560) {
      poi.state = 1;
      const a = rand(TAU);
      poi.boss = spawnEnemy(poi.guard, poi.x + Math.cos(a) * 120, poi.y + Math.sin(a) * 80, { mini: true, noElite: true });
      for (let i = 0; i < 5; i++) { const b = rand(TAU); spawnEnemy(poi.guard === 'controller' ? 'snork' : poi.guard === 'flesh' ? 'dog' : poi.guard, poi.x + Math.cos(b) * 170, poi.y + Math.sin(b) * 110, { noElite: true }); }
      banner(poi.icon + ' ' + poi.name.toUpperCase(), 'A guarded stash! Kill the ' + poi.boss.name + ' to unlock it.', 3.5, 'bad');
      Radio.say('poi'); Hints.show('poi');
    } else if (poi.state === 1 && poi.boss.dead) {
      poi.state = 2; G.pickups.push({ type: 'poistash', x: poi.x, y: poi.y, t: 0 });
      banner('STASH UNLOCKED', poi.name + ' is clear.', 2.5, 'good');
      Quests.prog('poi', (q) => q.poi === poi);
    }
  }
}
function useHatch(h) {
  Sfx.play('hatch');
  if (h.exit) goLevel('over', G.returnPos || { x: World.start.x, y: World.start.y });
  else { G.returnPos = { x: h.x, y: h.y + 80 }; goLevel('lab' + h.idx); }
}
function goLevel(key, pos) {
  G.levelCrates[World.cur] = G.crates; G.levelPickups[World.cur] = G.pickups;
  for (const g of G.gems) addXp(g.v);
  G.gems = []; G.bullets = []; G.ebullets = []; G.throws = []; G.decals = []; G.particles = []; G.fx = []; G.timers = [];
  if (World.kind === 'lab' && G.bosses.some((b) => b.labBoss)) World.lab.bossSpawned = false; // guardian resets if you flee
  const bosses = G.bosses.filter((b) => !b.labBoss);
  G.enemies = []; G.bosses = [];
  World.enterLevel(key);
  EG.clear();
  if (World.kind === 'lab' && !World.lab.init) { World.lab.init = true; for (const f of World.fields) spawnArtifact(f); }
  G.crates = G.levelCrates[key] || World.crateSpots.map((s) => ({ x: s.x, y: s.y, open: 0 }));
  G.pickups = G.levelPickups[key] || [];
  const p = World.kind === 'lab' ? { x: World.lab.start.x, y: World.lab.start.y + 70 } : pos;
  P.x = p.x; P.y = p.y; P.kvx = P.kvy = 0; P.hatchT = 0; P.inv = 1.5;
  World.collide(P);
  CAM.x = P.x; CAM.y = P.y; G.fade = 1;
  for (const b of bosses) { const q = ringPos(); if (q) { b.x = q[0]; b.y = q[1]; G.enemies.push(b); G.bosses.push(b); } }
  if (World.kind === 'lab') {
    G.labsVisited++; Quests.prog('lab');
    banner(World.lab.name + ' LABORATORY', World.lab.cleared ? 'The guardian is dead. Explore freely.' : 'Find the guardian in the deepest room. Rare loot awaits.', 4, 'bad');
    Radio.say('lab', true);
  } else banner('BACK ON THE SURFACE', '', 2);
  G.zone = '';
}
function takeArtifact(type, extra) {
  const A = ARTIFACTS[type];
  P.arts[type] = (P.arts[type] || 0) + 1; A.apply(P); G.arts++; G.rubles += 10;
  banner('ARTIFACT: ' + A.name.toUpperCase(), `${TAGS[A.tag].icon} ${A.desc}${extra || ''}`, 3.5, 'art');
  Sfx.play('artifact'); flash(0.3, '200,240,255');
  burst(P.x, P.y - 20, 30, '220,240,255', 260, { add: true });
  Radio.say('artifact');
  recomputeTags(); hudBuild();
}
function addXp(v) {
  G.xp += v * P.xpMul;
  while (G.xp >= G.xpNeed) { G.xp -= G.xpNeed; G.level++; G.xpNeed = xpNeed(G.level); G.pendingLv++; if (P.lvlHeal) P.hp = Math.min(P.maxhp, P.hp + P.lvlHeal); }
}

// ---------- level up / choice cards ----------
let choices = [], choiceMode = 'level';
function rollRarity() {
  const L = P.luck;
  const w = [RARITY[0].w, RARITY[1].w + L * 4, RARITY[2].w + L * 2.5, RARITY[3].w + L * 1.2];
  let r = rand(w[0] + w[1] + w[2] + w[3]);
  for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return RARITY[i]; }
  return RARITY[0];
}
function rollChoices() {
  const pool = [];
  for (const w of P.weapons) {
    const E = EVOLUTIONS[w.id];
    if (w.lv >= WEAPONS[w.id].max && !w.evo && P.arts[E.art]) { pool.push({ kind: 'evo', id: w.id, w: 1000 }); Hints.show('evolution'); }
    else if (w.lv < WEAPONS[w.id].max) pool.push({ kind: 'wup', id: w.id, w: 3 });
    else pool.push({ kind: 'mastery', id: w.id, w: 1.2 });
  }
  const perkOpts = Object.keys(PERKS).filter((id) => (P.perks[id] || 0) < PERKS[id].max).length;
  for (const id in INFINITE) pool.push({ kind: 'inf', id, w: perkOpts < 3 ? 1.5 : 0.2 });
  if (P.weapons.length < 6) for (const id in WEAPONS) if (!P.weapons.some((w) => w.id === id)) pool.push({ kind: 'wnew', id, w: 2.2 });
  // big perk pool: share a fixed total weight so weapons still show up often
  const perkIds = Object.keys(PERKS).filter((id) => (P.perks[id] || 0) < PERKS[id].max);
  for (const id of perkIds) pool.push({ kind: 'perk', id, w: (P.perks[id] ? 2.5 : 1) * (16 / Math.max(8, perkIds.length)) });
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = 0; for (const p of pool) tot += p.w;
    let r = rand(tot), i = 0; for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    const c = pool.splice(i, 1)[0];
    c.rar = c.kind === 'evo' ? RARITY[3] : rollRarity();
    out.push(c);
  }
  for (let i = 0; out.length < 3; i++) out.push({ kind: FALLBACK[i % 2].kind, rar: RARITY[0] });
  return out;
}
function openLevelUp() {
  G.state = 'levelup'; G.pendingLv--; choiceMode = 'level';
  choices = rollChoices();
  $('lvTitle').textContent = 'LEVEL ' + G.level; $('lvSub').textContent = 'CHOOSE AN UPGRADE';
  renderCards();
  show('levelup');
  Sfx.play(choices.some((c) => c.rar.id === 'legendary') ? 'legend' : 'level');
  Hints.show('levelup');
}
function openArtifactChoice() {
  G.state = 'levelup'; choiceMode = 'art';
  const ids = Object.keys(ARTIFACTS).sort(() => Math.random() - 0.5).slice(0, 3);
  choices = ids.map((id) => ({ kind: 'art', id, rar: RARITY[2] }));
  $('lvTitle').textContent = 'LAB STASH'; $('lvSub').textContent = 'CHOOSE AN ARTIFACT  •  +150 ₽  •  FULL HEAL';
  renderCards(); show('levelup'); Sfx.play('legend');
}
function renderCards() {
  const box = $('cards'); box.innerHTML = '';
  choices.forEach((c, i) => {
    let icon, name, tag, desc;
    const m = c.rar.mult;
    if (c.kind === 'evo') { const E = EVOLUTIONS[c.id]; icon = E.icon; name = E.name; tag = 'EVOLUTION'; desc = E.desc; }
    else if (c.kind === 'wup' || c.kind === 'wnew') {
      const W = WEAPONS[c.id], w = P.weapons.find((x) => x.id === c.id);
      icon = W.icon; name = W.name;
      tag = c.kind === 'wnew' ? 'NEW WEAPON' : `LV ${w.lv} → ${w.lv + 1}`;
      desc = (c.kind === 'wnew' ? W.desc : W.ups[w.lv]) + (m > 1 ? ` <em>+${Math.round((m - 1) * 15)}% weapon damage</em>` : '');
      if (W.tag) desc += ` <span class="tagchip" style="color:${TAGS[W.tag].color}">${TAGS[W.tag].icon} ${TAGS[W.tag].name}</span>`;
    } else if (c.kind === 'perk') { const p = PERKS[c.id], lv = P.perks[c.id] || 0; icon = p.icon; name = p.name; tag = lv ? `LV ${lv} → ${lv + 1}` : 'NEW PERK'; desc = p.desc(m); }
    else if (c.kind === 'mastery') { const W = WEAPONS[c.id], w = P.weapons.find((x) => x.id === c.id); icon = w.evo ? EVOLUTIONS[c.id].icon : W.icon; name = (w.evo ? EVOLUTIONS[c.id].name : W.name) + ' Mastery'; tag = 'MASTERY ' + ((w.mast || 0) + 1); desc = `+${Math.round(12 * m)}% weapon damage`; }
    else if (c.kind === 'inf') { const I = INFINITE[c.id]; icon = I.icon; name = I.name; tag = 'LIMITLESS'; desc = I.desc(m); }
    else if (c.kind === 'art') { const A = ARTIFACTS[c.id]; icon = artImg(c.id, 'big'); name = A.name; tag = `${TAGS[A.tag].icon} ${TAGS[A.tag].name.toUpperCase()}`; desc = `${A.desc}<em>Q: ${ACTIVES[A.act].name}</em>`; }
    else { const f = FALLBACK.find((x) => x.kind === c.kind); icon = f.icon; name = f.name; tag = 'SUPPLY'; desc = f.desc; }
    const el = document.createElement('button');
    el.className = `card r-${c.rar.id} ${c.kind}`;
    el.style.animationDelay = i * 0.07 + 's';
    el.innerHTML = `<div class="ckey">${i + 1}</div><div class="crar">${c.kind === 'evo' ? '★ EVOLUTION ★' : c.rar.name}</div><div class="cicon">${icon}</div><div><div class="ctag">${tag}</div><div class="cname">${name}</div><div class="cdesc">${desc}</div></div>`;
    el.onclick = () => chooseCard(i);
    box.appendChild(el);
  });
  const rr = $('rerollBtn');
  rr.style.display = choiceMode === 'level' && P.rerolls > 0 ? 'inline-block' : 'none';
  rr.textContent = `🎲 REROLL (${P.rerolls})`;
}
function reroll() {
  if (G.state !== 'levelup' || choiceMode !== 'level' || P.rerolls <= 0) return;
  P.rerolls--; choices = rollChoices(); renderCards(); Sfx.play('stash');
}
function chooseCard(i) {
  if (G.state !== 'levelup' || !choices[i]) return;
  const c = choices[i], m = c.rar.mult;
  if (c.kind === 'evo') {
    const w = P.weapons.find((x) => x.id === c.id); w.evo = true;
    banner('EVOLUTION: ' + EVOLUTIONS[c.id].name.toUpperCase(), EVOLUTIONS[c.id].desc, 4, 'art');
    Radio.say('evolution', true); flash(0.6, '255,210,120'); Sfx.play('legend');
  } else if (c.kind === 'wup') { const w = P.weapons.find((x) => x.id === c.id); w.lv++; w.bonus = (w.bonus || 0) + (m - 1) * 0.15; }
  else if (c.kind === 'wnew') P.weapons.push({ id: c.id, lv: 1, cd: 0.2, bonus: (m - 1) * 0.15 });
  else if (c.kind === 'perk') { P.perks[c.id] = (P.perks[c.id] || 0) + 1; PERKS[c.id].apply(P, m); }
  else if (c.kind === 'art') takeArtifact(c.id);
  else if (c.kind === 'mastery') { const w = P.weapons.find((x) => x.id === c.id); w.bonus = (w.bonus || 0) + 0.12 * m; w.mast = (w.mast || 0) + 1; }
  else if (c.kind === 'inf') INFINITE[c.id].apply(P, m);
  else if (c.kind === 'heal') P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.5);
  else if (c.kind === 'vodka') P.dmgMul += 0.05;
  hide('levelup'); G.state = 'play';
  burst(P.x, P.y - 20, 24, '255,220,120', 220, { add: true });
  recomputeTags(); hudBuild();
}

// ---------- player ----------
function updatePlayer(dt) {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my--; if (keys.KeyS || keys.ArrowDown) my++;
  if (keys.KeyA || keys.ArrowLeft) mx--; if (keys.KeyD || keys.ArrowRight) mx++;
  if (joy.active) { mx += joy.dx; my += joy.dy; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  P.moving = ml > 0.1;
  P.psiSlowT -= dt;
  P.slow = Math.max(P.slowNext, P.psiSlowT > 0 && !P.psiImmune ? 0.35 : 0); P.slowNext = 0;
  P.adrenT -= dt; P.lsAcc = Math.max(0, P.lsAcc - 5 * dt);
  let spdB = P.adrenT > 0 ? P.adren : 0;
  if (P.sprint) { EG.query(P.x, P.y, 160, TMP); if (!TMP.some((e) => !e.dead && dist2(e.x, e.y, P.x, P.y) < 160 * 160)) spdB += P.sprint; }
  const spd = 200 * (P.spdMul + spdB) * (1 - P.slow);
  if (P.dashT > 0) {
    P.dashT -= dt; P.x += P.dashVx * dt; P.y += P.dashVy * dt;
    if (P.dashDmg) { EG.query(P.x, P.y, 40, TMP); for (const e of TMP) if (!e.dead && !P.dashHit.includes(e) && dist2(e.x, e.y, P.x, P.y) < (e.r + 24) ** 2) { P.dashHit.push(e); hurtEnemy(e, P.dashDmg, P.dashVx * 0.3, P.dashVy * 0.3, false, false); } }
    part(P.x + rand(-6, 6), P.y, { z: rand(5, 30), c: '180,220,160', s: 5, life: 0.25, g: 0, add: true });
  } else { P.x += mx * spd * dt; P.y += my * spd * dt; }
  P.x += P.kvx * dt; P.y += P.kvy * dt;
  const kd = Math.pow(0.01, dt); P.kvx *= kd; P.kvy *= kd;
  if (P.moving) {
    P.anim += dt * 13; P.lastMx = mx; P.lastMy = my;
    if (Math.abs(mx) > 0.15) P.face = mx > 0 ? 1 : -1;
    if (Math.random() < dt * 8) part(P.x + rand(-5, 5), P.y, { z: 1, vz: 20, g: 0, c: '120,110,90', s: 3, life: 0.4 });
    P.lookA = lerpAngle(P.lookA, Math.atan2(my, mx), dt * 8);
  }
  if (Math.cos(P.aim) * P.face < 0 && P.muzzle <= -0.3) P.aim = P.face > 0 ? 0 : Math.PI;
  P.muzzle -= dt;
  World.collide(P);
  P.dashCd -= dt; P.inv -= dt; P.shieldT -= dt;
  for (const k in P.actCd) P.actCd[k] -= dt;
  const regen = (P.regen + (P.syn.bio ? 1.5 : 0)) * (P.hp < P.maxhp * 0.3 ? P.lowRegen : 1);
  if (regen) P.hp = Math.min(P.maxhp, P.hp + regen * dt);
  if (G.healT > 0) { G.healT -= dt; P.hp = Math.min(P.maxhp, P.hp + G.healRate * dt); if (Math.random() < 0.4) part(P.x + rand(-12, 12), P.y - 20, { z: 10, vz: 60, g: -20, c: '120,255,140', add: true, s: 3, life: 0.6 }); }
  let rad = 0;
  for (const r of World.rads) { const d = dist(P.x, P.y, r.x, r.y); if (d < r.r) rad = Math.max(rad, 1 - d / r.r); }
  if (rad > 0) {
    P.radAcc = (P.radAcc || 0) + (2 + rad * 7) * dt;
    if (P.radAcc > 3) { hurtPlayer(P.radAcc, 'radiation', true, 'rad'); P.radAcc = 0; }
    if (Math.random() < rad * 0.6) Sfx.play('geiger');
  }
  G.rad = rad;
  const reg = World.region(P.x, P.y);
  if (reg.name !== G.zone) { G.zone = reg.name; $('zoneName').textContent = reg.name; $('zoneName').className = 'show'; G.regionT = 3; $('dangerLvl').textContent = '☢'.repeat(reg.danger); $('zoneName2').textContent = reg.name; }
  if (G.regionT > 0) { G.regionT -= dt; if (G.regionT <= 0) $('zoneName').className = ''; }
}
function lerpAngle(a, b, t) { return a + angDiff(a, b) * clamp(t, 0, 1); }
function tryDash() {
  if (!G || G.state !== 'play' || P.dashCd > 0) return;
  let dx = P.lastMx, dy = P.lastMy; if (!dx && !dy) dx = P.face;
  const l = Math.hypot(dx, dy) || 1;
  P.dashHit = [];
  P.dashVx = (dx / l) * 760; P.dashVy = (dy / l) * 760; P.dashT = 0.18; P.dashCd = 1.4 * P.dashMul; P.inv = Math.max(P.inv, 0.28);
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
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.life -= dt;
    if (f.k === 'patch') {
      if (dist2(P.x, P.y, f.x, f.y) < f.r * f.r && P.dashT <= 0) {
        P.patchAcc = (P.patchAcc || 0) + (f.type === 'fire' ? 14 : 8) * dt;
        if (f.type === 'toxic') P.slowNext = Math.max(P.slowNext, 0.35);
        if (P.patchAcc > 5) { hurtPlayer(P.patchAcc, f.type === 'fire' ? 'fire' : 'acid', true, 'anomaly'); P.patchAcc = 0; }
      }
    } else if (f.k === 'ehole') {
      const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (d < f.r && P.dashT <= 0) { const s = (1 - d / f.r) * 230 + 40; P.x += (dx / d) * s * dt; P.y += (dy / d) * s * dt; if (d < 34) hurtPlayer(18, 'a gravity well'); }
    } else if (f.k === 'shock') {
      f.r += f.spd * dt;
      const d = dist(P.x, P.y, f.x, f.y);
      if (!f.hit && Math.abs(d - f.r) < 24 && P.dashT <= 0) { f.hit = true; hurtPlayer(f.dmg, f.psi ? 'a psi wave' : 'a shockwave'); P.kvx = ((P.x - f.x) / d) * 400; P.kvy = ((P.y - f.y) / d) * 400; }
      if (f.r > f.max) f.life = 0;
    } else if (f.k === 'nova') {
      f.r += f.spd * dt;
      EG.query(f.x, f.y, f.r + 20, TMP);
      for (const e of TMP) if (!f.hit.has(e) && dist2(f.x, f.y, e.x, e.y) < f.r * f.r) { f.hit.add(e); hurtEnemy(e, f.dmg, (e.x - f.x) * 2, (e.y - f.y) * 2, true); e.burnT = 3; e.burnDps = f.dmg * 0.3; }
      if (Math.random() < 0.9) { const a = rand(TAU); part(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r * 0.62, { z: 5, vz: 100, g: -30, c: '255,140,40', add: true, s: 6, life: 0.5 }); }
      if (f.r > f.max) f.life = 0;
    } else if (f.k === 'hole' || f.k === 'cloud') {
      if (f.follow) { f.x = P.x; f.y = P.y; }
      EG.query(f.x, f.y, f.r, TMP);
      f.tick -= dt;
      for (const e of TMP) {
        const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > f.r) continue;
        if (f.pull && !e.boss) { const s = (1 - d / f.r) * f.pull + 60; e.x += (dx / d) * s * dt; e.y += (dy / d) * s * dt; }
        if (f.tick <= 0) hurtEnemy(e, f.dps * 0.25, 0, 0, true);
      }
      if (f.tick <= 0) f.tick = 0.25;
      if (f.k === 'hole' && f.life <= 0) {
        EG.query(f.x, f.y, f.r * 0.6, TMP);
        for (const e of TMP) if (dist2(f.x, f.y, e.x, e.y) < (f.r * 0.6) ** 2) hurtEnemy(e, f.end, 0, 0, true);
        G.fx.push({ k: 'ring', x: f.x, y: f.y, r: f.r * 0.6, life: 0.4, max: 0.4, c: '190,160,255' }); Sfx.play('vortex');
      }
    }
  }
  G.fx = G.fx.filter((f) => f.life > 0);
  let tmpRad = false;
  for (const r of World.rads) if (r.life !== undefined) { r.life -= dt; tmpRad = true; }
  if (tmpRad) World.rads = World.rads.filter((r) => r.life === undefined || r.life > 0);
  for (const t of G.timers) { t.t -= dt; if (t.t <= 0) { t.done = true; t.fn(); } }
  G.timers = G.timers.filter((t) => !t.done);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2.5);
  G.psi = Math.max(0, G.psi - dt * 0.8);
  G.fade = Math.max(0, G.fade - dt * 1.5);
}

// ---------- main update ----------
function update(dt) {
  if (G.state !== 'play') return;
  G.t += dt;
  G.shotBudget = Math.min(5, G.shotBudget + 2.5 * dt);
  updatePlayer(dt);
  director(dt);
  updateEmission(dt);
  Env.update(dt);
  updateEnemies(dt);
  updateAnomalies(dt);
  updateWeapons(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateFx(dt);
  Quests.update(dt); Radio.update(dt); Hints.update(dt);
  const art = nearestArtifact();
  if (art && art.d < 1200 * P.detect) {
    G.detT -= dt;
    if (G.detT <= 0) { G.detT = clamp(art.d / (700 * P.detect), 0.12, 1.6); Sfx.play('beep'); $('detLed').classList.add('on'); setTimeout(() => $('detLed').classList.remove('on'), 60); }
  }
  Music.setIntensity(G.bosses.length || (G.em && G.em.phase !== 'after') ? 2 : G.enemies.length > 50 || Env.isNight() || World.kind === 'lab' ? 1 : 0);
  const k = 1 - Math.exp(-dt * 6);
  CAM.x = lerp(CAM.x, P.x + P.lastMx * 50, k); CAM.y = lerp(CAM.y, P.y - 20 + P.lastMy * 40, k);
  if (G.pendingLv > 0 && G.state === 'play') openLevelUp();
}
function nearestArtifact() {
  let best = null, bd = 1e12;
  for (const f of World.fields) { if (!f.art) continue; const d = dist2(P.x, P.y, f.art.x, f.art.y); if (d < bd) { bd = d; best = f.art; } }
  return best ? { a: best, d: Math.sqrt(bd) } : null;
}
