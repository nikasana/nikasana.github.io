'use strict';
// ---------- anomalies ----------
const ANOMALIES = {
  electro: { name: 'Electro', r: 58, color: '#6cc4ff' },
  burner: { name: 'Burner', r: 44, color: '#ff7a2a' },
  vortex: { name: 'Vortex', r: 120, color: '#b9a7ff' },
  acid: { name: 'Fruit Punch', r: 62, color: '#8cff5a' },
  spring: { name: 'Springboard', r: 48, color: '#d8e0ff' },
  teleport: { name: 'Teleport', r: 36, color: '#9ad8ff' },
  cryo: { name: 'Frost', r: 62, color: '#bfe8ff' },
  gas: { name: 'Chemical Gas', r: 72, color: '#c8e040' },
  mincer: { name: 'Mincer', r: 95, color: '#ff5a5a' },
  tesla: { name: 'Tesla', r: 70, color: '#6cf0ff', moving: true },
  comet: { name: 'Comet', r: 42, color: '#ff9a3a', moving: true },
  fuzz: { name: 'Burnt Fuzz', r: 52, color: '#b0a070' },
  psifield: { name: 'Psi-Field', r: 115, color: '#d08aff' },
};

// ---------- artifact actives (the Q ability; each artifact carries one) ----------
const ACTIVES = {
  thunder: { name: 'Thunderstorm', desc: 'Lightning strikes every mutant around you' },
  chain: { name: 'Chain Lightning', desc: 'A bolt that jumps through 14 mutants' },
  nova: { name: 'Fire Nova', desc: 'A ring of fire that burns everything nearby' },
  meteor: { name: 'Meteor Shower', desc: 'Burning rocks fall on the nearest mutants' },
  psi: { name: 'Psi Blast', desc: 'Stun every mutant on screen and erase their shots' },
  hole: { name: 'Black Hole', desc: 'A singularity that swallows the horde' },
  heal: { name: 'Healing Spores', desc: 'Heal 35% HP inside a toxic cloud' },
  shield: { name: 'Anomaly Shield', desc: 'Become invulnerable for a few seconds' },
  blink: { name: 'Blink', desc: 'Teleport forward, exploding along the way' },
  frost: { name: 'Frost Nova', desc: 'Freeze and slow everything around you' },
  toxic: { name: 'Toxic Bloom', desc: 'A lingering poison cloud on the biggest crowd' },
  shards: { name: 'Shard Burst', desc: 'Fire a ring of piercing crystal shards' },
  wave: { name: 'Gravity Wave', desc: 'Blast mutants away with a crushing shockwave' },
  magnet: { name: 'Attractor', desc: 'Pull in all XP on the map and heal 10%' },
};

// ---------- artifacts (41) ----------
// shape + color pair give every artifact its own look (world, HUD, cards)
const ARTIFACTS = {
  medusa: { name: 'Medusa', tag: 'bio', shape: 'jelly', color: '#b6e36a', c2: '#f0ffc0', act: 'shield', cd: 26, desc: '-7% damage taken', apply: (P) => { P.dr += 0.07; } },
  stoneblood: { name: 'Stone Blood', tag: 'bio', shape: 'stone', color: '#d8423a', c2: '#ff9a8a', act: 'heal', cd: 24, desc: '+0.8 HP/s regeneration', apply: (P) => { P.regen += 0.8; } },
  flash: { name: 'Flash', tag: 'electric', shape: 'spiky', color: '#7fe3ff', c2: '#ffffff', act: 'blink', cd: 12, desc: '+10% move speed', apply: (P) => { P.spdMul += 0.1; } },
  moonlight: { name: 'Moonlight', tag: 'psi', shape: 'orb', color: '#d4f2ff', c2: '#8ab8ff', act: 'shards', cd: 16, desc: 'Orbiting psi-shard (+1)', apply: (P) => { P.shards++; } },
  battery: { name: 'Battery', tag: 'electric', shape: 'cube', color: '#4aa8ff', c2: '#bfe2ff', act: 'chain', cd: 16, desc: 'Chain lightning (+1 arc)', apply: (P) => { P.lightning++; } },
  fireball: { name: 'Fireball', tag: 'fire', shape: 'sun', color: '#ff8a2a', c2: '#ffe07a', act: 'nova', cd: 18, desc: 'Burning aura (+size, +dmg)', apply: (P) => { P.aura++; } },
  nightstar: { name: 'Night Star', tag: 'gravity', shape: 'star', color: '#f0ea72', c2: '#fffbd0', act: 'magnet', cd: 20, desc: '+40% pickup range, +10% XP', apply: (P) => { P.pickup *= 1.4; P.xpMul += 0.1; } },
  soul: { name: 'Soul', tag: 'psi', shape: 'drop', color: '#ff9ad5', c2: '#ffe0f2', act: 'heal', cd: 24, desc: 'Heal 1 HP per 3 kills', apply: (P) => { P.soul++; } },
  kolobok: { name: 'Kolobok', tag: 'fire', shape: 'spiky', color: '#e0b86a', c2: '#8a5a20', act: 'meteor', cd: 20, desc: '+12% damage', apply: (P) => { P.dmgMul += 0.12; } },
  gravi: { name: 'Gravi', tag: 'gravity', shape: 'ring', color: '#a98cff', c2: '#e0d4ff', act: 'hole', cd: 22, desc: '+1 pierce on all projectiles', apply: (P) => { P.pierce++; } },
  crystal: { name: 'Crystal', tag: 'fire', shape: 'cluster', color: '#ff6464', c2: '#ffd0d0', act: 'nova', cd: 20, desc: '+25 max HP', apply: (P) => { P.maxhp += 25; P.hp += 25; } },
  jellyfish: { name: 'Jellyfish', tag: 'electric', shape: 'jelly', color: '#7df5c6', c2: '#d8fff0', act: 'frost', cd: 20, desc: '+10% attack speed', apply: (P) => { P.rateMul += 0.1; } },
  eye: { name: 'Eye', tag: 'psi', shape: 'eye', color: '#ffd0ff', c2: '#8a3aaa', act: 'psi', cd: 20, desc: '+8% critical chance', apply: (P) => { P.crit += 0.08; } },
  thorn: { name: 'Thorn', tag: 'bio', shape: 'thorn', color: '#9ad04a', c2: '#4a6a1a', act: 'toxic', cd: 18, desc: 'Attackers take 20 damage', apply: (P) => { P.thorns += 20; } },
  compass: { name: 'Compass', tag: 'gravity', shape: 'compass', color: '#ffe8a0', c2: '#c88a2a', act: 'blink', cd: 12, desc: '-20% dash cooldown, +8% speed', apply: (P) => { P.dashMul *= 0.8; P.spdMul += 0.08; } },
  sparkler: { name: 'Sparkler', tag: 'electric', shape: 'star', color: '#9fe0ff', c2: '#ffffff', act: 'thunder', cd: 18, desc: '+1 chain arc, +5% damage', apply: (P) => { P.lightning++; P.dmgMul += 0.05; } },
  snowflake: { name: 'Snowflake', tag: 'electric', shape: 'flake', color: '#cfefff', c2: '#6ab8ff', act: 'frost', cd: 20, desc: '+12% move speed, +5% attack speed', apply: (P) => { P.spdMul += 0.12; P.rateMul += 0.05; } },
  coil: { name: 'Tesla Coil', tag: 'electric', shape: 'coil', color: '#6cf0ff', c2: '#2a6aff', act: 'chain', cd: 15, desc: '+2 chain lightning arcs', apply: (P) => { P.lightning += 2; } },
  thunderstone: { name: 'Thunderstone', tag: 'electric', shape: 'stone', color: '#6a7aff', c2: '#e0f0ff', act: 'thunder', cd: 20, desc: '+10% damage, +5% crit', apply: (P) => { P.dmgMul += 0.1; P.crit += 0.05; } },
  flame: { name: 'Flame', tag: 'fire', shape: 'drop', color: '#ff5a2a', c2: '#ffd060', act: 'nova', cd: 18, desc: '+12% area of effect', apply: (P) => { P.areaMul += 0.12; } },
  droplets: { name: 'Droplets', tag: 'fire', shape: 'beads', color: '#ff9a5a', c2: '#ffe0b0', act: 'heal', cd: 26, desc: '+15 max HP, +0.3 HP/s', apply: (P) => { P.maxhp += 15; P.hp += 15; P.regen += 0.3; } },
  firefly: { name: 'Firefly', tag: 'fire', shape: 'firefly', color: '#ffd040', c2: '#ff6a10', act: 'meteor', cd: 18, desc: 'Burning aura (+1), +5% speed', apply: (P) => { P.aura++; P.spdMul += 0.05; } },
  meteorite: { name: 'Meteorite', tag: 'fire', shape: 'stone', color: '#8a4a3a', c2: '#ff8a3a', act: 'meteor', cd: 22, desc: '+10% damage, +6% area', apply: (P) => { P.dmgMul += 0.1; P.areaMul += 0.06; } },
  stoneflower: { name: 'Stone Flower', tag: 'gravity', shape: 'flower', color: '#c8b8a0', c2: '#8a6cff', act: 'wave', cd: 16, desc: '-5% damage taken, +25% pickup', apply: (P) => { P.dr += 0.05; P.pickup *= 1.25; } },
  goldfish: { name: 'Goldfish', tag: 'gravity', shape: 'fish', color: '#ffcc40', c2: '#ff8a20', act: 'magnet', cd: 18, desc: '+15% XP, +5% crit', apply: (P) => { P.xpMul += 0.15; P.crit += 0.05; } },
  wrenched: { name: 'Wrenched', tag: 'gravity', shape: 'spiral', color: '#b0a0c0', c2: '#6a5a8a', act: 'hole', cd: 22, desc: '+8% damage, +1 pierce', apply: (P) => { P.dmgMul += 0.08; P.pierce++; } },
  spring: { name: 'Spring', tag: 'gravity', shape: 'spring', color: '#e0e0e0', c2: '#9ab0ff', act: 'wave', cd: 14, desc: '-15% dash cooldown, +6% speed', apply: (P) => { P.dashMul *= 0.85; P.spdMul += 0.06; } },
  iceshard: { name: 'Ice Shard', tag: 'gravity', shape: 'cluster', color: '#bfe8ff', c2: '#ffffff', act: 'frost', cd: 18, desc: '+1 pierce, +5% damage', apply: (P) => { P.pierce++; P.dmgMul += 0.05; } },
  blackpearl: { name: 'Black Pearl', tag: 'gravity', shape: 'pearl', color: '#2a2438', c2: '#a98cff', act: 'hole', cd: 20, desc: '+10% damage, +10% attack speed', apply: (P) => { P.dmgMul += 0.1; P.rateMul += 0.1; } },
  wanderer: { name: 'Wanderer', tag: 'gravity', shape: 'cube', color: '#9affd8', c2: '#3a8aff', act: 'blink', cd: 10, desc: '-25% dash cooldown', apply: (P) => { P.dashMul *= 0.75; } },
  mica: { name: 'Mica', tag: 'psi', shape: 'shell', color: '#e0d8c8', c2: '#b89aff', act: 'shield', cd: 24, desc: '-5% damage taken, +5% crit', apply: (P) => { P.dr += 0.05; P.crit += 0.05; } },
  beads: { name: "Mama's Beads", tag: 'psi', shape: 'beads', color: '#ff8ab8', c2: '#ffe0ee', act: 'shards', cd: 16, desc: 'Orbiting psi-shard (+1), +5% XP', apply: (P) => { P.shards++; P.xpMul += 0.05; } },
  cocoon: { name: 'Cocoon', tag: 'psi', shape: 'cocoon', color: '#f0e6c0', c2: '#c07aff', act: 'psi', cd: 22, desc: '+10% XP, heal 20 on level up', apply: (P) => { P.xpMul += 0.1; P.lvlHeal += 20; } },
  veil: { name: 'Veil', tag: 'psi', shape: 'ring', color: '#d0a0ff', c2: '#ffffff', act: 'shield', cd: 22, desc: '10% chance to dodge attacks', apply: (P) => { P.dodge = Math.min(0.5, P.dodge + 0.1); } },
  oasis: { name: 'Heart of the Oasis', tag: 'bio', shape: 'heart', color: '#ff4a6a', c2: '#ffd0d8', act: 'heal', cd: 20, desc: '+3 HP/s regeneration (legendary)', apply: (P) => { P.regen += 3; } },
  bubble: { name: 'Bubble', tag: 'bio', shape: 'bubble', color: '#a0ffe0', c2: '#ffffff', act: 'shield', cd: 26, desc: '-25% anomaly & radiation damage', apply: (P) => { P.anomRes = Math.min(0.9, P.anomRes + 0.25); } },
  urchin: { name: 'Urchin', tag: 'bio', shape: 'spiky', color: '#4a8a3a', c2: '#c8ff8a', act: 'toxic', cd: 18, desc: 'Attackers take 15 damage, +10 HP', apply: (P) => { P.thorns += 15; P.maxhp += 10; P.hp += 10; } },
  shell: { name: 'Shell', tag: 'bio', shape: 'shell', color: '#d8c8a0', c2: '#8aff8a', act: 'shield', cd: 24, desc: '-6% damage taken', apply: (P) => { P.dr += 0.06; } },
  slime: { name: 'Slime', tag: 'bio', shape: 'jelly', color: '#8cff5a', c2: '#e0ffc0', act: 'toxic', cd: 16, desc: '+0.5 HP/s, +5% speed', apply: (P) => { P.regen += 0.5; P.spdMul += 0.05; } },
  needles: { name: 'Needles', tag: 'bio', shape: 'thorn', color: '#c8e070', c2: '#6a8a2a', act: 'shards', cd: 16, desc: 'Attackers take 25 damage', apply: (P) => { P.thorns += 25; } },
  cyst: { name: 'Toxin Cyst', tag: 'bio', shape: 'bubble', color: '#c0e040', c2: '#6a8020', act: 'toxic', cd: 18, desc: '-40% anomaly damage, +0.3 HP/s', apply: (P) => { P.anomRes = Math.min(0.9, P.anomRes + 0.4); P.regen += 0.3; } },
};
const ANOM_ARTS = {
  electro: ['battery', 'flash', 'moonlight', 'jellyfish', 'eye', 'sparkler', 'thunderstone'],
  burner: ['fireball', 'crystal', 'stoneblood', 'kolobok', 'flame', 'firefly'],
  vortex: ['gravi', 'medusa', 'nightstar', 'moonlight', 'compass', 'wrenched', 'stoneflower'],
  acid: ['stoneblood', 'soul', 'medusa', 'jellyfish', 'thorn', 'slime', 'droplets'],
  spring: ['kolobok', 'flash', 'gravi', 'nightstar', 'soul', 'compass', 'spring', 'goldfish'],
  teleport: ['wanderer', 'compass', 'veil', 'flash'],
  cryo: ['snowflake', 'iceshard', 'crystal', 'mica'],
  gas: ['cyst', 'bubble', 'needles', 'urchin'],
  mincer: ['blackpearl', 'wrenched', 'oasis', 'stoneblood'],
  tesla: ['coil', 'battery', 'sparkler', 'thunderstone'],
  comet: ['meteorite', 'firefly', 'flame', 'droplets'],
  fuzz: ['needles', 'thorn', 'urchin', 'shell'],
  psifield: ['cocoon', 'beads', 'veil', 'eye', 'mica'],
};

// ---------- artifact drawing: one shape vocabulary, used in the world and for HUD icons ----------
function artPath(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
function drawArtShape(g, A, x, y, s, t) {
  const c = A.color, c2 = A.c2;
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const hi = () => { g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(-3, -4, 2.5, 1.6, -0.5, 0, TAU); g.fill(); };
  switch (A.shape) {
    case 'orb': case 'pearl': {
      const gr = g.createRadialGradient(-3, -3, 1, 0, 0, 9); gr.addColorStop(0, c2); gr.addColorStop(1, c);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 8.5, 0, TAU); g.fill();
      if (A.shape === 'pearl') { g.strokeStyle = c2; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, 12, 4, t * 0.8, 0, TAU); g.stroke(); }
      hi(); break;
    }
    case 'stone': {
      artPath(g, [-8, 3, -6, -6, 1, -9, 8, -4, 8, 4, 2, 8, -5, 7]); g.fillStyle = c; g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-5, -2); g.lineTo(-1, 1); g.lineTo(3, -4); g.moveTo(-1, 1); g.lineTo(1, 6); g.stroke();
      break;
    }
    case 'spiky': {
      g.fillStyle = c; g.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + t * 0.3, r = i % 2 ? 4.5 : 10; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill(); break;
    }
    case 'cube': {
      artPath(g, [0, -9, 8, -4, 0, 1, -8, -4]); g.fillStyle = c2; g.fill();
      artPath(g, [-8, -4, 0, 1, 0, 10, -8, 5]); g.fillStyle = c; g.fill();
      artPath(g, [8, -4, 0, 1, 0, 10, 8, 5]); g.fillStyle = c; g.globalAlpha = 0.7; g.fill(); g.globalAlpha = 1; break;
    }
    case 'sun': {
      g.strokeStyle = c2; g.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t; g.beginPath(); g.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); g.stroke(); }
      const gr = g.createRadialGradient(0, 0, 1, 0, 0, 7); gr.addColorStop(0, c2); gr.addColorStop(1, c); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); break;
    }
    case 'star': {
      g.fillStyle = c; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 4 : 10; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill(); break;
    }
    case 'drop': {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(8, 0, 6, 5); g.arc(0, 4, 6, 0.2, Math.PI - 0.2); g.quadraticCurveTo(-8, 0, 0, -11); g.fill();
      g.fillStyle = c2; g.beginPath(); g.ellipse(-2, 2, 2, 3, 0.3, 0, TAU); g.fill(); break;
    }
    case 'ring': {
      g.strokeStyle = c; g.lineWidth = 3.5; g.beginPath(); g.ellipse(0, 0, 9, 9, 0, 0, TAU); g.stroke();
      g.strokeStyle = c2; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, 9, 9, 0, t, t + 2); g.stroke();
      g.fillStyle = c2; g.beginPath(); g.arc(Math.cos(t * 2) * 9, Math.sin(t * 2) * 9, 2, 0, TAU); g.fill(); break;
    }
    case 'cluster': {
      for (const [dx, dy, h, w] of [[-5, 3, 12, 3.5], [5, 4, 10, 3], [0, 2, 16, 4]]) { artPath(g, [dx - w, dy, dx, dy - h, dx + w, dy]); g.fillStyle = c; g.fill(); artPath(g, [dx, dy, dx, dy - h, dx + w, dy]); g.fillStyle = c2; g.globalAlpha = 0.6; g.fill(); g.globalAlpha = 1; }
      break;
    }
    case 'jelly': {
      g.fillStyle = c; g.beginPath(); g.arc(0, -1, 8, Math.PI, 0); g.lineTo(8, 1); g.lineTo(-8, 1); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 3.2, 1); g.quadraticCurveTo(i * 3.2 + Math.sin(t * 3 + i) * 3, 6, i * 3.2, 11); g.stroke(); }
      hi(); break;
    }
    case 'eye': {
      g.fillStyle = c; g.beginPath(); g.moveTo(-11, 0); g.quadraticCurveTo(0, -10, 11, 0); g.quadraticCurveTo(0, 10, -11, 0); g.fill();
      g.fillStyle = c2; g.beginPath(); g.arc(Math.sin(t) * 2, 0, 4.5, 0, TAU); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(Math.sin(t) * 2, 0, 2, 0, TAU); g.fill(); break;
    }
    case 'thorn': {
      g.strokeStyle = c2; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-8, 8); g.quadraticCurveTo(0, 0, 8, -9); g.stroke();
      g.fillStyle = c;
      for (const [px, py, a] of [[-5, 4, -2.2], [-1, 0, 0.8], [3, -4, -2.3], [6, -7, 0.9]]) { g.save(); g.translate(px, py); g.rotate(a); artPath(g, [0, -2, 7, 0, 0, 2]); g.fill(); g.restore(); }
      break;
    }
    case 'compass': {
      g.strokeStyle = c2; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke();
      g.fillStyle = c; g.save(); g.rotate(t * 0.7); artPath(g, [0, -8, 3, 0, 0, 8, -3, 0]); g.fill(); g.fillStyle = '#e44'; artPath(g, [0, -8, 3, 0, -3, 0]); g.fill(); g.restore(); break;
    }
    case 'flake': {
      g.strokeStyle = c; g.lineWidth = 1.8;
      for (let i = 0; i < 6; i++) { g.save(); g.rotate((i / 6) * TAU + t * 0.2); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -10); g.moveTo(0, -6); g.lineTo(-3, -8); g.moveTo(0, -6); g.lineTo(3, -8); g.stroke(); g.restore(); }
      g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill(); break;
    }
    case 'coil': {
      g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-9, 8);
      for (let i = 0; i < 7; i++) g.lineTo(i % 2 ? 7 : -7, 6 - i * 2.4);
      g.lineTo(0, -10); g.stroke(); g.fillStyle = c2; g.beginPath(); g.arc(0, -10, 2.5, 0, TAU); g.fill(); break;
    }
    case 'spring': {
      g.strokeStyle = c; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(0, 8 - i * 4, 7, 2.2, 0, Math.PI, TAU); g.stroke(); g.strokeStyle = c2; g.beginPath(); g.ellipse(0, 8 - i * 4, 7, 2.2, 0, 0, Math.PI); g.stroke(); g.strokeStyle = c; }
      break;
    }
    case 'beads': {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.5; g.fillStyle = i % 2 ? c : c2; g.beginPath(); g.arc(Math.cos(a) * 7, Math.sin(a) * 7, 3.2, 0, TAU); g.fill(); }
      break;
    }
    case 'firefly': {
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-5, -5, 5, 2.5, -0.6 + Math.sin(t * 12) * 0.3, 0, TAU); g.ellipse(5, -5, 5, 2.5, 0.6 - Math.sin(t * 12) * 0.3, 0, TAU); g.fill();
      const gr = g.createRadialGradient(0, 1, 0, 0, 1, 7); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, c); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.arc(0, 1, 6, 0, TAU); g.fill(); break;
    }
    case 'flower': {
      g.fillStyle = c;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 4.5, 2.5, a, 0, TAU); g.fill(); }
      g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill(); break;
    }
    case 'fish': {
      g.fillStyle = c; g.beginPath(); g.ellipse(-1, 0, 8, 5, 0, 0, TAU); g.fill();
      g.fillStyle = c2; artPath(g, [6, 0, 12, -6 + Math.sin(t * 6) * 1.5, 12, 6 + Math.sin(t * 6) * 1.5]); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(-5, -1, 1.3, 0, TAU); g.fill(); break;
    }
    case 'spiral': {
      g.strokeStyle = c; g.lineWidth = 2.4; g.beginPath();
      for (let i = 0; i < 40; i++) { const a = i * 0.4 + t, r = i * 0.26; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.stroke(); g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill(); break;
    }
    case 'shell': {
      for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.85 + i * 0.42; g.fillStyle = i % 2 ? c : c2; g.beginPath(); g.moveTo(0, 7); g.arc(0, 7, 13, a, a + 0.42); g.closePath(); g.fill(); }
      break;
    }
    case 'cocoon': {
      g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, 6.5, 10, 0.2, 0, TAU); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(0, i * 3.5, 6.5, 1.5, 0.2, 0, Math.PI); g.stroke(); }
      break;
    }
    case 'heart': {
      const p = 1 + Math.sin(t * 5) * 0.08; g.scale(p, p);
      g.fillStyle = c; g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(-12, 0, -8, -10, 0, -4); g.bezierCurveTo(8, -10, 12, 0, 0, 9); g.fill(); hi(); break;
    }
    case 'bubble': {
      for (const [dx, dy, r] of [[-3, 2, 6], [4, -3, 4.5], [4, 5, 3.5]]) {
        g.fillStyle = c; g.globalAlpha = 0.55; g.beginPath(); g.arc(dx, dy, r, 0, TAU); g.fill(); g.globalAlpha = 1;
        g.strokeStyle = c2; g.lineWidth = 1; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(dx - r * 0.35, dy - r * 0.35, r * 0.25, 0, TAU); g.fill();
      }
      break;
    }
    default: {
      g.fillStyle = c; artPath(g, [0, -9, 7, -2, 4, 7, -4, 7, -7, -2]); g.fill();
    }
  }
  g.restore();
}
// HUD / card icons rendered once from the same drawings
const ART_ICON = {};
function buildArtIcons() {
  for (const id in ARTIFACTS) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), A = ARTIFACTS[id];
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, A.color + 'aa'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    drawArtShape(g, A, 32, 33, 2.2, 0.6);
    ART_ICON[id] = c.toDataURL();
  }
}
const artImg = (id, cls = '') => `<img class="aicon ${cls}" src="${ART_ICON[id]}" alt="${ARTIFACTS[id].name}">`;

// ---------- new anomaly visuals ----------
function drawAnomalyGround2(a) {
  const t = NOW + a.seed, r = a.r;
  switch (a.type) {
    case 'teleport': {
      ctx.strokeStyle = `rgba(160,220,255,${0.4 + Math.sin(t * 4) * 0.15})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(120,200,255,0.15)'; ctx.fill();
      ctx.fillStyle = 'rgba(220,245,255,0.8)';
      for (let i = 0; i < 6; i++) { const an = t * 2.5 + (i / 6) * TAU; ctx.beginPath(); ctx.arc(a.x + Math.cos(an) * r * 0.8, a.y + Math.sin(an) * r * 0.44, 2.2, 0, TAU); ctx.fill(); }
      break;
    }
    case 'cryo': {
      const g = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, r);
      g.addColorStop(0, 'rgba(230,248,255,0.55)'); g.addColorStop(1, 'rgba(160,210,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU + a.seed; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(an) * r * 0.2, a.y + Math.sin(an) * r * 0.12); ctx.lineTo(a.x + Math.cos(an) * r * 0.8, a.y + Math.sin(an) * r * 0.48); ctx.stroke(); }
      break;
    }
    case 'gas': {
      for (let i = 0; i < 4; i++) {
        const an = t * 0.4 + i * 1.6, px = a.x + Math.cos(an) * r * 0.3, py = a.y + Math.sin(an) * r * 0.2, rr = r * (0.6 + 0.15 * Math.sin(t + i));
        const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, `rgba(200,224,64,${a.act > 0 ? 0.4 : 0.2})`); g.addColorStop(1, 'rgba(160,190,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.6, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'mincer': {
      ctx.fillStyle = 'rgba(60,10,10,0.2)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,90,0.22)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const an = -t * 3 + i * 2.1; ctx.beginPath(); ctx.ellipse(a.x, a.y, r * (0.3 + i * 0.25), r * (0.3 + i * 0.25) * 0.6, 0, an, an + 2.4); ctx.stroke(); }
      break;
    }
    case 'tesla': case 'comet': {
      ctx.strokeStyle = a.type === 'tesla' ? 'rgba(108,240,255,0.12)' : 'rgba(255,150,60,0.14)'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.ellipse(a.cx, a.cy, a.orb, a.orb * 0.62, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (a.type === 'comet') { ctx.fillStyle = 'rgba(40,20,10,0.25)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 30, 16, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'fuzz': {
      ctx.fillStyle = 'rgba(50,40,24,0.25)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'psifield': {
      ctx.strokeStyle = 'rgba(208,138,255,0.22)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const rr = ((t * 25 + i * r / 3) % r); ctx.beginPath(); ctx.ellipse(a.x, a.y, rr, rr * 0.6, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = 'rgba(150,60,220,0.08)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      break;
    }
  }
}
function drawAnomalyTop2(a) {
  const t = NOW + a.seed, r = a.r;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  switch (a.type) {
    case 'teleport': {
      const g = ctx.createRadialGradient(a.x, a.y - 20, 0, a.x, a.y - 20, 30); g.addColorStop(0, `rgba(230,250,255,${0.6 + a.act})`); g.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y - 20, 18 + a.act * 30, 30 + a.act * 20, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'cryo':
      if (Math.random() < 0.3) part(a.x + rand(-r, r) * 0.7, a.y + rand(-r, r) * 0.4, { z: rand(10, 40), vz: -20, g: 20, c: '230,245,255', s: 2, life: 1 });
      break;
    case 'mincer':
      ctx.fillStyle = 'rgba(255,120,120,0.35)';
      for (let i = 0; i < 12; i++) { const an = -t * (3 + i * 0.1) + i * 0.52, d = r * (0.15 + (i % 5) / 7), z = 10 + ((t * 40 + i * 13) % 60); ctx.fillRect(a.x + Math.cos(an) * d, a.y + Math.sin(an) * d * 0.6 - z, 3, 3); }
      if (a.act > 0) { ctx.fillStyle = `rgba(255,60,60,${a.act})`; ctx.beginPath(); ctx.arc(a.x, a.y - 20, 30 + (1 - a.act) * 60, 0, TAU); ctx.fill(); }
      break;
    case 'tesla': {
      const g = ctx.createRadialGradient(a.x, a.y - 26, 0, a.x, a.y - 26, 30); g.addColorStop(0, 'rgba(230,255,255,0.95)'); g.addColorStop(0.4, 'rgba(108,240,255,0.6)'); g.addColorStop(1, 'rgba(40,120,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y - 26, 30, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,250,255,0.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const an = rand(TAU); jag(a.x, a.y - 26, a.x + Math.cos(an) * 28, a.y - 26 + Math.sin(an) * 28, 3, 6); }
      if (a.zap) { ctx.lineWidth = 2.5; jag(a.x, a.y - 26, a.zap[0], a.zap[1], 6, 9); }
      break;
    }
    case 'comet': {
      const tx = a.x - Math.cos(a.ang + Math.PI / 2) * 40 * a.dir, ty = a.y - 30 - Math.sin(a.ang + Math.PI / 2) * 25 * a.dir;
      const g = ctx.createLinearGradient(a.x, a.y - 30, tx, ty); g.addColorStop(0, 'rgba(255,220,120,0.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(a.x, a.y - 30); ctx.lineTo(tx, ty); ctx.stroke();
      const g2 = ctx.createRadialGradient(a.x, a.y - 30, 0, a.x, a.y - 30, 24); g2.addColorStop(0, 'rgba(255,250,210,1)'); g2.addColorStop(0.5, 'rgba(255,150,40,0.8)'); g2.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(a.x, a.y - 30, 24, 0, TAU); ctx.fill();
      if (Math.random() < 0.6) part(a.x, a.y, { z: 30, vz: rand(-20, 40), g: 60, c: '255,160,60', add: true, s: 3, life: 0.5 });
      break;
    }
    case 'fuzz':
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(70,56,30,0.75)'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 9; i++) {
        const px = a.x + Math.cos(i * 2.4 + a.seed) * r * 0.6, py = a.y + Math.sin(i * 1.7 + a.seed) * r * 0.35, sw = Math.sin(t * 2 + i) * 4 + (a.act > 0 ? Math.sin(t * 30) * 4 : 0);
        ctx.beginPath(); ctx.moveTo(px, py - 70); ctx.quadraticCurveTo(px + sw, py - 35, px + sw * 1.5, py - 8); ctx.stroke();
      }
      break;
    case 'psifield':
      if (Math.random() < 0.15) part(a.x + rand(-r, r) * 0.7, a.y + rand(-r, r) * 0.4, { z: 5, vz: 50, g: -10, c: '208,138,255', add: true, s: 2.5, life: 1 });
      break;
  }
  ctx.restore();
}

// ---------- artifact actives ----------
function ownedArts() { return Object.keys(P.arts); }
function selectedArt() { const l = ownedArts(); return l.length ? l[((P.actSel % l.length) + l.length) % l.length] : null; }
function cycleActive(d) {
  if (!G || G.title || !P) return;
  const l = ownedArts(); if (l.length < 2) return;
  P.actSel = (((P.actSel + d) % l.length) + l.length) % l.length;
  Sfx.play('beep'); hudBuild();
}
function useAbility() {
  if (!G || G.state !== 'play') return;
  const id = selectedArt(); if (!id) return;
  if ((P.actCd[id] || 0) > 0) return;
  const A = ARTIFACTS[id], pow = (1 + (P.arts[id] - 1) * 0.35 + (P.tags[A.tag] || 0) * 0.05) * (1 + P.actPow);
  P.actCd[id] = A.cd * P.actCdMul;
  Sfx.play('ability'); shake(6);
  banner(ACTIVES[A.act].name.toUpperCase(), A.name, 1.2, 'art', 2);
  runActive(A.act, pow, A);
}
function runActive(k, pow, A) {
  const cloud = (x, y, r, life, dps) => G.fx.push({ k: 'cloud', x, y, r: r * P.areaMul, life, max: life, dps, tick: 0 });
  switch (k) {
    case 'thunder': {
      const n = Math.round(10 + 3 * pow);
      for (let i = 0; i < n; i++) G.timers.push({ t: i * 0.09, fn: () => { const t = randomEnemyNear(P.x, P.y, 650); strike(t ? t.x : P.x + rand(-300, 300), t ? t.y : P.y + rand(-250, 250), 70 * pow, 60, false); } });
      break;
    }
    case 'chain': {
      let t = nearest(P.x, P.y, 520); const hit = [], pts = [[P.x, P.y - 30]];
      for (let i = 0; i < 14 && t; i++) { hit.push(t); pts.push([t.x, t.y - t.z - 14]); hurtEnemy(t, 55 * pow, 0, 0, true); t = nearest(t.x, t.y, 260, hit); }
      G.fx.push({ k: 'lightning', pts, life: 0.4, max: 0.4 }); Sfx.play('zap'); break;
    }
    case 'nova':
      G.fx.push({ k: 'nova', x: P.x, y: P.y, r: 10, max: 340 * P.areaMul, spd: 900, dmg: 110 * pow, hit: new Set(), life: 1, maxl: 1 }); Sfx.play('fire'); break;
    case 'meteor': {
      const n = Math.round(6 + 2 * pow);
      for (let i = 0; i < n; i++) {
        const t = randomEnemyNear(P.x, P.y, 560), x = t ? t.x : P.x + rand(-300, 300), y = t ? t.y : P.y + rand(-220, 220);
        G.fx.push({ k: 'target', x, y, r: 80, life: 0.7 + i * 0.12, max: 0.7 + i * 0.12, blue: false });
        G.timers.push({ t: 0.7 + i * 0.12, fn: () => { explode(x, y, 85 * P.areaMul, 90 * pow, true); G.fx.push({ k: 'sky', x, y, life: 0.2, max: 0.2 }); } });
      }
      break;
    }
    case 'psi':
      for (const e of G.enemies) if (dist2(e.x, e.y, P.x, P.y) < 750 * 750) { e.stun = 2.6; hurtEnemy(e, 45 * pow, 0, 0, true); }
      G.ebullets.length = 0; flash(0.5, '190,120,255'); break;
    case 'hole': {
      let tx = P.x + P.lastMx * 200, ty = P.y + P.lastMy * 200;
      const t = randomEnemyNear(P.x, P.y, 450); if (t) { tx = t.x; ty = t.y; }
      G.fx.push({ k: 'hole', x: tx, y: ty, r: 280 * P.areaMul, life: 3, max: 3, dps: 30 * pow, pull: 520, end: 170 * pow, tick: 0 }); Sfx.play('vortex'); break;
    }
    case 'heal':
      G.healT = 3; G.healRate = (P.maxhp * 0.35) / 3;
      G.fx.push({ k: 'cloud', follow: true, x: P.x, y: P.y, r: 160 * P.areaMul, life: 5, max: 5, dps: 45 * pow, tick: 0 }); Sfx.play('heal'); break;
    case 'shield':
      P.shieldT = 3 + pow; P.shieldC = A.color; Sfx.play('psi'); break;
    case 'blink': {
      let dx = P.lastMx, dy = P.lastMy; if (!dx && !dy) dx = P.face;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      let D = 300; while (D > 40 && !World.free(P.x + dx * D, P.y + dy * D, P.r)) D -= 20;
      for (let i = 1; i <= 4; i++) { const px = P.x + dx * D * (i / 4), py = P.y + dy * D * (i / 4); G.timers.push({ t: i * 0.05, fn: () => explode(px, py, 60 * P.areaMul, 40 * pow, true) }); }
      burst(P.x, P.y - 20, 20, '160,230,255', 200, { add: true });
      P.x += dx * D; P.y += dy * D; P.inv = Math.max(P.inv, 0.5);
      burst(P.x, P.y - 20, 20, '160,230,255', 200, { add: true }); Sfx.play('dash'); break;
    }
    case 'frost':
      for (const e of G.enemies) if (dist2(e.x, e.y, P.x, P.y) < (330 * P.areaMul) ** 2) { e.stun = Math.max(e.stun, e.boss ? 0.6 : 1.6); e.slowT = 4; hurtEnemy(e, 35 * pow, 0, 0, true); }
      G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 330 * P.areaMul, life: 0.6, max: 0.6, c: '200,240,255' });
      for (let i = 0; i < 40; i++) { const a = rand(TAU), d = rand(330 * P.areaMul); part(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.62, { z: 20, vz: 60, g: 60, c: '220,245,255', s: 3, life: 0.8 }); }
      flash(0.25, '200,240,255'); Sfx.play('zap'); break;
    case 'toxic': {
      const t = randomEnemyNear(P.x, P.y, 450);
      cloud(t ? t.x : P.x, t ? t.y : P.y, 170, 6, 50 * pow); Sfx.play('heal'); break;
    }
    case 'shards':
      for (let i = 0; i < 24; i++) shoot(P.x, P.y - 22, (i / 24) * TAU, 700, 30 * pow, { pierce: 3, r: 5, life: 0.8, big: true });
      Sfx.play('gauss'); break;
    case 'wave':
      G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 300 * P.areaMul, life: 0.5, max: 0.5, c: '190,170,255' });
      for (const e of G.enemies) { const d = dist(e.x, e.y, P.x, P.y); if (d < 300 * P.areaMul) hurtEnemy(e, 35 * pow, ((e.x - P.x) / (d || 1)) * 1400, ((e.y - P.y) / (d || 1)) * 1400, true); }
      shake(10); Sfx.play('stomp'); break;
    case 'magnet':
      for (const g of G.gems) g.mag = true;
      P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.1); Sfx.play('heal'); break;
  }
}
