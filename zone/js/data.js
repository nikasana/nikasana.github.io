'use strict';
// ---------- weapons ----------
// stats(l) returns the stats for level l (1..max)
const WEAPONS = {
  pistol: {
    name: 'PM Pistol', icon: '🔫', max: 6,
    desc: 'Auto-fires at the nearest mutant.',
    ups: ['', '+Damage', 'Fires 2 bullets', 'Bullets pierce 1', 'Fires 3 bullets', 'Rapid fire + damage'],
    stats: (l) => ({ dmg: 13 + l * 4, cd: l >= 6 ? 0.3 : 0.62 - l * 0.04, count: l >= 5 ? 3 : l >= 3 ? 2 : 1, pierce: l >= 4 ? 1 : 0, spd: 720 }),
  },
  ak: {
    name: 'AK-74', icon: '🪖', max: 6,
    desc: 'Rapid automatic fire. Sprays the closest target.',
    ups: ['', '+Fire rate', '+Damage', 'Twin barrels', '+Fire rate', 'Armor-piercing rounds'],
    stats: (l) => ({ dmg: 7 + l * 2.5, cd: 0.17 - l * 0.012, count: l >= 4 ? 2 : 1, pierce: l >= 6 ? 2 : 0, spd: 820 }),
  },
  shotgun: {
    name: 'Sawn-off', icon: '💥', max: 6,
    desc: 'Close-range pellet blast with heavy knockback.',
    ups: ['', '+2 pellets', '+Damage', '+2 pellets', 'Faster reload', 'Dragon breath: 360° blast'],
    stats: (l) => ({ dmg: 8 + l * 2, cd: 1.15 - l * 0.08, pellets: 5 + Math.floor(l / 2) * 2, spread: 0.55, spd: 760, full: l >= 6 }),
  },
  grenade: {
    name: 'F1 Grenades', icon: '💣', max: 6,
    desc: 'Lobs grenades into the thickest crowd.',
    ups: ['', '+Blast radius', 'Throw 2', '+Damage', 'Faster throws', 'Throw 3, cluster blast'],
    stats: (l) => ({ dmg: 36 + l * 12, cd: 2.5 - l * 0.2, count: l >= 6 ? 3 : l >= 3 ? 2 : 1, radius: 80 + l * 9 }),
  },
  bolts: {
    name: 'Bolts', icon: '🔩', max: 6,
    desc: 'The stalker\'s best friend. Ricochets between mutants.',
    ups: ['', '+1 bounce', '+Damage', 'Throw 2', '+1 bounce', 'Throw 3, super bolts'],
    stats: (l) => ({ dmg: 12 + l * 4, cd: 1.1 - l * 0.07, bounces: 2 + Math.floor((l + 1) / 2), count: l >= 6 ? 3 : l >= 4 ? 2 : 1, spd: 620 }),
  },
  gauss: {
    name: 'Gauss Rifle', icon: '⚡', max: 6,
    desc: 'Charged beam that pierces everything in a line.',
    ups: ['', '+Damage', 'Wider beam', 'Faster charge', '+Damage', 'Double beam'],
    stats: (l) => ({ dmg: 55 + l * 25, cd: 2.9 - l * 0.22, width: 12 + l * 3, count: l >= 6 ? 2 : 1 }),
  },
  knife: {
    name: 'Combat Knife', icon: '🔪', max: 6,
    desc: 'Slashes everything around you.',
    ups: ['', '+Damage', '+Reach', 'Faster slashes', '+Damage', 'Whirlwind: full circle'],
    stats: (l) => ({ dmg: 18 + l * 7, cd: 0.9 - l * 0.07, radius: 72 + l * 8, arc: l >= 6 ? TAU : 2.3 }),
  },
};

// ---------- passive perks ----------
const PERKS = {
  vitality: { name: 'Vitality', icon: '❤️', max: 5, desc: '+20 max HP and heal 20', apply: (P) => { P.maxhp += 20; P.hp = Math.min(P.maxhp, P.hp + 20); } },
  athlete: { name: 'Athlete', icon: '👟', max: 5, desc: '+8% move speed', apply: (P) => { P.spdMul += 0.08; } },
  marksman: { name: 'Marksman', icon: '🎯', max: 5, desc: '+10% damage', apply: (P) => { P.dmgMul += 0.1; } },
  trigger: { name: 'Trigger Finger', icon: '☝️', max: 5, desc: '+8% attack speed', apply: (P) => { P.rateMul += 0.08; } },
  magnet: { name: 'Scavenger', icon: '🧲', max: 4, desc: '+35% pickup range', apply: (P) => { P.pickup *= 1.35; } },
  armor: { name: 'SEVA Plating', icon: '🛡️', max: 5, desc: '-6% damage taken', apply: (P) => { P.dr += 0.06; } },
  regen: { name: 'Field Medic', icon: '💉', max: 5, desc: '+0.4 HP/s regeneration', apply: (P) => { P.regen += 0.4; } },
  area: { name: 'Demolitions', icon: '🧨', max: 4, desc: '+12% area of effect', apply: (P) => { P.areaMul += 0.12; } },
};
const FALLBACK = [
  { kind: 'heal', name: 'Army Medkit', icon: '🩹', desc: 'Restore 50% HP' },
  { kind: 'vodka', name: 'Cossacks Vodka', icon: '🍾', desc: '+5% damage, permanently' },
];

// ---------- artifacts ----------
const ARTIFACTS = {
  medusa: { name: 'Medusa', color: '#b6e36a', desc: '-7% damage taken', apply: (P) => { P.dr += 0.07; } },
  stoneblood: { name: 'Stone Blood', color: '#d8423a', desc: '+0.8 HP/s regeneration', apply: (P) => { P.regen += 0.8; } },
  flash: { name: 'Flash', color: '#7fe3ff', desc: '+10% move speed', apply: (P) => { P.spdMul += 0.1; } },
  moonlight: { name: 'Moonlight', color: '#d4f2ff', desc: 'Orbiting psi-shard (+1)', apply: (P) => { P.shards++; } },
  battery: { name: 'Battery', color: '#4aa8ff', desc: 'Chain lightning (+1 arc)', apply: (P) => { P.lightning++; } },
  fireball: { name: 'Fireball', color: '#ff8a2a', desc: 'Burning aura (+size, +dmg)', apply: (P) => { P.aura++; } },
  nightstar: { name: 'Night Star', color: '#f0ea72', desc: '+40% pickup range, +10% XP', apply: (P) => { P.pickup *= 1.4; P.xpMul += 0.1; } },
  soul: { name: 'Soul', color: '#ff9ad5', desc: 'Heal 1 HP per 3 kills', apply: (P) => { P.soul++; } },
  kolobok: { name: 'Kolobok', color: '#e0b86a', desc: '+12% damage', apply: (P) => { P.dmgMul += 0.12; } },
  gravi: { name: 'Gravi', color: '#a98cff', desc: '+1 pierce on all projectiles', apply: (P) => { P.pierce++; } },
  crystal: { name: 'Crystal', color: '#ff6464', desc: '+25 max HP', apply: (P) => { P.maxhp += 25; P.hp += 25; } },
  jellyfish: { name: 'Jellyfish', color: '#7df5c6', desc: '+10% attack speed', apply: (P) => { P.rateMul += 0.1; } },
};
const ANOM_ARTS = {
  electro: ['battery', 'flash', 'moonlight', 'jellyfish'],
  burner: ['fireball', 'crystal', 'stoneblood', 'kolobok'],
  vortex: ['gravi', 'medusa', 'nightstar', 'moonlight'],
  acid: ['stoneblood', 'soul', 'medusa', 'jellyfish'],
  spring: ['kolobok', 'flash', 'gravi', 'nightstar', 'soul'],
};
const ANOMALIES = {
  electro: { name: 'Electro', r: 58, color: '#6cc4ff' },
  burner: { name: 'Burner', r: 44, color: '#ff7a2a' },
  vortex: { name: 'Vortex', r: 120, color: '#b9a7ff' },
  acid: { name: 'Fruit Punch', r: 62, color: '#8cff5a' },
  spring: { name: 'Springboard', r: 48, color: '#d8e0ff' },
};

// ---------- enemies ----------
const ENEMIES = {
  dog: { name: 'Blind Dog', hp: 14, spd: 150, dmg: 6, r: 12, xp: 1, mass: 0.6 },
  flesh: { name: 'Flesh', hp: 48, spd: 68, dmg: 14, r: 19, xp: 3, mass: 1.8 },
  zombie: { name: 'Zombie', hp: 36, spd: 52, dmg: 10, r: 13, xp: 3, mass: 1 },
  snork: { name: 'Snork', hp: 42, spd: 90, dmg: 16, r: 14, xp: 4, mass: 1 },
  bloodsucker: { name: 'Bloodsucker', hp: 95, spd: 126, dmg: 22, r: 16, xp: 8, mass: 1.4 },
  poltergeist: { name: 'Poltergeist', hp: 70, spd: 80, dmg: 12, r: 15, xp: 9, mass: 0.8, fly: true },
  controller: { name: 'Controller', hp: 170, spd: 46, dmg: 15, r: 17, xp: 12, mass: 2.2 },
  pseudogiant: { name: 'PSEUDOGIANT', boss: true, hp: 2600, spd: 64, dmg: 30, r: 42, xp: 140, mass: 30 },
  chimera: { name: 'CHIMERA', boss: true, hp: 3600, spd: 100, dmg: 28, r: 32, xp: 170, mass: 25 },
  burer: { name: 'BURER', boss: true, hp: 4400, spd: 56, dmg: 25, r: 26, xp: 200, mass: 25 },
  monolith: { name: 'THE MONOLITH', boss: true, hp: 16000, spd: 42, dmg: 30, r: 48, xp: 0, mass: 999, fly: true },
};
// spawn weights by minute
function spawnTable(m) {
  const t = { dog: 60, flesh: 25 };
  if (m >= 1) { t.zombie = 25; t.dog = 50; }
  if (m >= 2) t.snork = 22;
  if (m >= 3.5) t.bloodsucker = 10 + m * 1.5;
  if (m >= 5) t.poltergeist = 10 + m;
  if (m >= 7) t.controller = 4 + m * 0.6;
  if (m >= 8) t.flesh = 15;
  return t;
}
const BOSS_SCHEDULE = [
  { t: 180, id: 'pseudogiant' },
  { t: 360, id: 'chimera' },
  { t: 540, id: 'burer' },
  { t: 720, id: 'pseudogiant', extra: 'chimera' },
  { t: 900, id: 'monolith' },
];
const EMISSIONS = [255, 615]; // warning start times (blast 30s later)
