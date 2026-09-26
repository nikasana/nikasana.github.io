'use strict';
// ---------- weapons ----------
// stats(l) returns the stats for level l (1..max)
const WEAPONS = {
  pistol: {
    name: 'PM Pistol', icon: '🔫', max: 6, tag: null,
    desc: 'Auto-fires at the nearest mutant.',
    ups: ['', '+Damage', 'Fires 2 bullets', 'Bullets pierce 1', 'Fires 3 bullets', 'Rapid fire + damage'],
    stats: (l) => ({ dmg: 13 + l * 4, cd: l >= 6 ? 0.3 : 0.62 - l * 0.04, count: l >= 5 ? 3 : l >= 3 ? 2 : 1, pierce: l >= 4 ? 1 : 0, spd: 720 }),
  },
  ak: {
    name: 'AK-74', icon: '🪖', max: 6, tag: null,
    desc: 'Rapid automatic fire. Sprays the closest target.',
    ups: ['', '+Fire rate', '+Damage', 'Twin barrels', '+Fire rate', 'Armor-piercing rounds'],
    stats: (l) => ({ dmg: 7 + l * 2.5, cd: 0.17 - l * 0.012, count: l >= 4 ? 2 : 1, pierce: l >= 6 ? 2 : 0, spd: 820 }),
  },
  shotgun: {
    name: 'Sawn-off', icon: '💥', max: 6, tag: 'fire',
    desc: 'Close-range pellet blast with heavy knockback.',
    ups: ['', '+2 pellets', '+Damage', '+2 pellets', 'Faster reload', '360° blast'],
    stats: (l) => ({ dmg: 8 + l * 2, cd: 1.15 - l * 0.08, pellets: 5 + Math.floor(l / 2) * 2, spread: 0.55, spd: 760, full: l >= 6 }),
  },
  grenade: {
    name: 'F1 Grenades', icon: '💣', max: 6, tag: 'fire',
    desc: 'Lobs grenades into the thickest crowd.',
    ups: ['', '+Blast radius', 'Throw 2', '+Damage', 'Faster throws', 'Throw 3'],
    stats: (l) => ({ dmg: 36 + l * 12, cd: 2.5 - l * 0.2, count: l >= 6 ? 3 : l >= 3 ? 2 : 1, radius: 80 + l * 9 }),
  },
  bolts: {
    name: 'Bolts', icon: '🔩', max: 6, tag: 'gravity',
    desc: 'The stalker\'s best friend. Ricochets between mutants.',
    ups: ['', '+1 bounce', '+Damage', 'Throw 2', '+1 bounce', 'Throw 3'],
    stats: (l) => ({ dmg: 12 + l * 4, cd: 1.1 - l * 0.07, bounces: 2 + Math.floor((l + 1) / 2), count: l >= 6 ? 3 : l >= 4 ? 2 : 1, spd: 620 }),
  },
  gauss: {
    name: 'Gauss Rifle', icon: '⚡', max: 6, tag: 'electric',
    desc: 'Charged beam that pierces everything in a line.',
    ups: ['', '+Damage', 'Wider beam', 'Faster charge', '+Damage', 'Double beam'],
    stats: (l) => ({ dmg: 55 + l * 25, cd: 2.9 - l * 0.22, width: 12 + l * 3, count: l >= 6 ? 2 : 1 }),
  },
  knife: {
    name: 'Combat Knife', icon: '🔪', max: 6, tag: 'bio',
    desc: 'Slashes everything around you.',
    ups: ['', '+Damage', '+Reach', 'Faster slashes', '+Damage', 'Whirlwind: full circle'],
    stats: (l) => ({ dmg: 18 + l * 7, cd: 0.9 - l * 0.07, radius: 72 + l * 8, arc: l >= 6 ? TAU : 2.3 }),
  },
};
// max-level weapon + matching artifact => evolution
const EVOLUTIONS = {
  pistol: { art: 'kolobok', name: 'Hand Cannon', icon: '🔫', desc: 'Huge rounds: triple damage, pierce 4, brutal knockback.' },
  ak: { art: 'jellyfish', name: 'Groza', icon: '🪖', desc: 'Explosive rounds at a blistering fire rate.' },
  shotgun: { art: 'fireball', name: "Dragon's Breath", icon: '🐉', desc: '360° blast of burning pellets every shot.' },
  grenade: { art: 'crystal', name: 'Cluster RPG', icon: '🚀', desc: 'Rockets that split into 5 cluster bombs.' },
  bolts: { art: 'gravi', name: 'Gravity Bolts', icon: '🌀', desc: 'Bolts rip open mini-vortexes on impact.' },
  gauss: { art: 'battery', name: 'Storm Railgun', icon: '⚡', desc: 'Every enemy the beam touches arcs lightning.' },
  knife: { art: 'stoneblood', name: 'Bloodletter', icon: '🩸', desc: 'Huge whirlwind slashes that heal you.' },
};

// ---------- passive perks (apply(P, mult)) ----------
const PERKS = {
  vitality: { name: 'Vitality', icon: '❤️', max: 5, desc: (m) => `+${Math.round(20 * m)} max HP and heal`, apply: (P, m) => { P.maxhp += 20 * m; P.hp = Math.min(P.maxhp, P.hp + 20 * m); } },
  athlete: { name: 'Athlete', icon: '👟', max: 5, desc: (m) => `+${Math.round(8 * m)}% move speed`, apply: (P, m) => { P.spdMul += 0.08 * m; } },
  marksman: { name: 'Marksman', icon: '🎯', max: 5, desc: (m) => `+${Math.round(10 * m)}% damage`, apply: (P, m) => { P.dmgMul += 0.1 * m; } },
  trigger: { name: 'Trigger Finger', icon: '☝️', max: 5, desc: (m) => `+${Math.round(8 * m)}% attack speed`, apply: (P, m) => { P.rateMul += 0.08 * m; } },
  magnet: { name: 'Scavenger', icon: '🧲', max: 4, desc: (m) => `+${Math.round(35 * m)}% pickup range`, apply: (P, m) => { P.pickup *= 1 + 0.35 * m; } },
  armor: { name: 'SEVA Plating', icon: '🛡️', max: 5, desc: (m) => `-${Math.round(6 * m)}% damage taken`, apply: (P, m) => { P.dr += 0.06 * m; } },
  regen: { name: 'Field Medic', icon: '💉', max: 5, desc: (m) => `+${(0.4 * m).toFixed(1)} HP/s regeneration`, apply: (P, m) => { P.regen += 0.4 * m; } },
  area: { name: 'Demolitions', icon: '🧨', max: 4, desc: (m) => `+${Math.round(12 * m)}% area of effect`, apply: (P, m) => { P.areaMul += 0.12 * m; } },
  crit: { name: 'Sharpshooter', icon: '✴️', max: 4, desc: (m) => `+${Math.round(5 * m)}% critical chance`, apply: (P, m) => { P.crit += 0.05 * m; } },
  glass: { name: 'Glass Cannon', icon: '🥃', max: 3, desc: (m) => `+${Math.round(25 * m)}% damage, -10% max HP`, apply: (P, m) => { P.dmgMul += 0.25 * m; P.maxhp *= 0.9; P.hp = Math.min(P.hp, P.maxhp); } },
  bloodthirst: { name: 'Bloodthirst', icon: '🩸', max: 4, desc: (m) => `Heal ${(m * 0.4 * 3).toFixed(1)} HP per 3 kills`, apply: (P, m) => { P.soul += 0.4 * m; } },
  execute: { name: 'Executioner', icon: '🪓', max: 4, desc: (m) => `+${Math.round(25 * m)}% damage to mutants below 30% HP`, apply: (P, m) => { P.execute += 0.25 * m; } },
  slayer: { name: 'Giant Slayer', icon: '🗡️', max: 5, desc: (m) => `+${Math.round(15 * m)}% damage to bosses, alphas & elites`, apply: (P, m) => { P.bossDmg += 0.15 * m; } },
  deadeye: { name: 'Deadeye', icon: '👁️', max: 4, desc: (m) => `+${Math.round(30 * m)}% critical damage`, apply: (P, m) => { P.critMul += 0.3 * m; } },
  treasure: { name: 'Treasure Hunter', icon: '💰', max: 3, desc: (m) => `+${Math.round(50 * m)}% medkit & loot drops`, apply: (P, m) => { P.dropMul += 0.5 * m; } },
  haggler: { name: 'Haggler', icon: '🤝', max: 3, desc: (m) => `+${Math.round(20 * m)}% rubles from this run`, apply: (P, m) => { P.rubMul += 0.2 * m; } },
  dashmaster: { name: 'Dash Master', icon: '💨', max: 4, desc: (m) => `-${Math.round(12 * m)}% dash cooldown`, apply: (P, m) => { P.dashMul *= 1 - 0.12 * m; } },
  bladedash: { name: 'Blade Dash', icon: '⚔️', max: 4, desc: (m) => `Dashing through mutants deals ${Math.round(40 * m)} damage`, apply: (P, m) => { P.dashDmg += 40 * m; } },
  medic: { name: 'Combat Medic', icon: '🩺', max: 3, desc: (m) => `Medkits heal +${Math.round(50 * m)}%`, apply: (P, m) => { P.medMul += 0.5 * m; } },
  adrenaline: { name: 'Adrenaline Rush', icon: '⚡', max: 3, desc: (m) => `+${Math.round(20 * m)}% speed for 2s after getting hit`, apply: (P, m) => { P.adren += 0.2 * m; } },
  berserk: { name: 'Berserker', icon: '😡', max: 4, desc: (m) => `Up to +${Math.round(40 * m)}% damage as your HP drops`, apply: (P, m) => { P.berserk += 0.4 * m; } },
  standfirm: { name: 'Stand Firm', icon: '🧱', max: 3, desc: (m) => `-${Math.round(15 * m)}% damage taken while standing still`, apply: (P, m) => { P.standFirm += 0.15 * m; } },
  spikes: { name: 'Spiked Armor', icon: '🦔', max: 4, desc: (m) => `Attackers take ${Math.round(15 * m)} damage`, apply: (P, m) => { P.thorns += 15 * m; } },
  nimble: { name: 'Nimble', icon: '🤸', max: 4, desc: (m) => `+${Math.round(5 * m)}% dodge chance`, apply: (P, m) => { P.dodge = Math.min(0.5, P.dodge + 0.05 * m); } },
  scholar: { name: 'Scholar', icon: '🎓', max: 5, desc: (m) => `+${Math.round(12 * m)}% XP`, apply: (P, m) => { P.xpMul += 0.12 * m; } },
  penetrator: { name: 'Penetrator', icon: '📌', max: 3, desc: (m) => `+${Math.max(1, Math.round(m))} pierce on all projectiles`, apply: (P, m) => { P.pierce += Math.max(1, Math.round(m)); } },
  quickhands: { name: 'Quick Hands', icon: '🖐️', max: 4, desc: (m) => `-${Math.round(10 * m)}% artifact power cooldowns`, apply: (P, m) => { P.actCdMul *= 1 - 0.1 * m; } },
  tuner: { name: 'Artifact Tuner', icon: '🎛️', max: 5, desc: (m) => `+${Math.round(20 * m)}% artifact power strength`, apply: (P, m) => { P.actPow += 0.2 * m; } },
  pyro: { name: 'Pyromaniac', icon: '🔥', max: 4, desc: (m) => `Burning deals +${Math.round(30 * m)}% damage`, apply: (P, m) => { P.burnMul += 0.3 * m; } },
  static: { name: 'Static Charge', icon: '🌩️', max: 4, desc: (m) => `${Math.round(8 * m)}% chance hits zap a nearby mutant`, apply: (P, m) => { P.zapChance += 0.08 * m; } },
  vampire: { name: 'Vampire Rounds', icon: '🧛', max: 4, desc: (m) => `Heal ${(0.6 * m).toFixed(1)}% of damage dealt (max 5 HP/s)`, apply: (P, m) => { P.lifesteal += 0.006 * m; } },
  hollow: { name: 'Hollow Points', icon: '💣', max: 4, desc: (m) => `${Math.round(8 * m)}% chance hits explode`, apply: (P, m) => { P.exChance += 0.08 * m; } },
  cryo: { name: 'Cryo Rounds', icon: '❄️', max: 3, desc: (m) => `${Math.round(20 * m)}% chance hits slow mutants`, apply: (P, m) => { P.frostChance += 0.2 * m; } },
  hunter: { name: 'Mutant Hunter', icon: '🏹', max: 5, desc: (m) => `+${Math.round(10 * m)}% damage to regular mutants`, apply: (P, m) => { P.hunter += 0.1 * m; } },
  marathon: { name: 'Marathon', icon: '🏃', max: 3, desc: (m) => `+${Math.round(6 * m)}% speed, -${Math.round(5 * m)}% dash cooldown`, apply: (P, m) => { P.spdMul += 0.06 * m; P.dashMul *= 1 - 0.05 * m; } },
  ironlung: { name: 'Iron Lung', icon: '🫁', max: 3, desc: (m) => `-${Math.round(25 * m)}% anomaly & radiation damage`, apply: (P, m) => { P.anomRes = Math.min(0.9, P.anomRes + 0.25 * m); } },
  reload: { name: 'Fast Reload', icon: '🔄', max: 5, desc: (m) => `+${Math.round(6 * m)}% attack speed, +${Math.round(3 * m)}% damage`, apply: (P, m) => { P.rateMul += 0.06 * m; P.dmgMul += 0.03 * m; } },
  caliber: { name: 'Heavy Caliber', icon: '🔫', max: 4, desc: (m) => `+${Math.round(8 * m)}% damage, +${Math.round(5 * m)}% area`, apply: (P, m) => { P.dmgMul += 0.08 * m; P.areaMul += 0.05 * m; } },
  secondheart: { name: 'Second Heart', icon: '💗', max: 3, desc: (m) => `Triple regeneration below 30% HP, +${(0.3 * m).toFixed(1)} HP/s`, apply: (P, m) => { P.lowRegen = 3; P.regen += 0.3 * m; } },
  momentum: { name: 'Momentum', icon: '📈', max: 3, desc: (m) => `+1% damage per ${Math.round(25 / m)} kills (up to 30%)`, apply: (P, m) => { P.momentum += m; } },
  looter: { name: 'Looter', icon: '🎒', max: 3, desc: (m) => `+${Math.round(30 * m)}% XP from gems & crates`, apply: (P, m) => { P.xpMul += 0.1 * m; P.dropMul += 0.2 * m; } },
  sprinter: { name: 'Sprinter', icon: '👟', max: 3, desc: (m) => `+${Math.round(10 * m)}% speed when no mutant is close`, apply: (P, m) => { P.sprint += 0.1 * m; } },
  thickskin: { name: 'Thick Skin', icon: '🐘', max: 4, desc: (m) => `+${Math.round(30 * m)} max HP, -3% speed`, apply: (P, m) => { P.maxhp += 30 * m; P.hp += 30 * m; P.spdMul -= 0.03; } },
};
const FALLBACK = [
  { kind: 'heal', name: 'Army Medkit', icon: '🩹', desc: 'Restore 50% HP' },
  { kind: 'vodka', name: 'Cossacks Vodka', icon: '🍾', desc: '+5% damage, permanently' },
];
// never-ending upgrades once perks run out (keeps long endless runs growing)
const INFINITE = {
  overclock: { name: 'Overclock', icon: '⚙️', desc: (m) => `+${Math.round(6 * m)}% damage`, apply: (P, m) => { P.dmgMul += 0.06 * m; } },
  adrenaline: { name: 'Adrenaline', icon: '💊', desc: (m) => `+${Math.round(5 * m)}% attack speed`, apply: (P, m) => { P.rateMul += 0.05 * m; } },
  toughness: { name: 'Toughness', icon: '🦴', desc: (m) => `+${Math.round(15 * m)} max HP, heal fully`, apply: (P, m) => { P.maxhp += 15 * m; P.hp = P.maxhp; } },
};
const RARITY = [
  { id: 'common', name: 'COMMON', mult: 1, w: 64 },
  { id: 'rare', name: 'RARE', mult: 1.5, w: 24 },
  { id: 'epic', name: 'EPIC', mult: 2, w: 9 },
  { id: 'legendary', name: 'LEGENDARY', mult: 3, w: 3 },
];

// ---------- synergy tags ----------
const TAGS = {
  electric: { name: 'Electric', icon: '⚡', color: '#6cc4ff', b3: 'Hits may shock nearby enemies', b6: 'Thunder strikes 5 enemies every 4s',
    ability: 'Thunderstorm', adesc: 'Call down lightning on every mutant around you.' },
  fire: { name: 'Fire', icon: '🔥', color: '#ff7a2a', b3: 'Your hits ignite enemies', b6: 'Burning enemies explode on death',
    ability: 'Fire Nova', adesc: 'A ring of fire that burns everything nearby.' },
  psi: { name: 'Psi', icon: '🧠', color: '#c07aff', b3: '+15% critical chance', b6: 'Kills may release a psi wave',
    ability: 'Psi Blast', adesc: 'Stun every mutant on screen and erase their projectiles.' },
  gravity: { name: 'Gravity', icon: '🌀', color: '#a98cff', b3: '+1 pierce, bigger projectiles', b6: 'Kills may open a mini-vortex',
    ability: 'Black Hole', adesc: 'Tear open a singularity that swallows the horde.' },
  bio: { name: 'Bio', icon: '🧬', color: '#8cff5a', b3: '+1.5 HP/s regeneration', b6: '+1 max HP every 10 kills',
    ability: 'Healing Spores', adesc: 'Heal 35% HP and surround yourself with a toxic cloud.' },
};

// artifacts, anomalies and artifact actives live in artifacts.js

// ---------- enemies ----------
const ENEMIES = {
  dog: { name: 'Blind Dog', hp: 14, spd: 150, dmg: 6, r: 12, xp: 1, mass: 0.6 },
  rat: { name: 'Tushkano', hp: 6, spd: 172, dmg: 3, r: 7, xp: 1, mass: 0.3 },
  flesh: { name: 'Flesh', hp: 48, spd: 68, dmg: 14, r: 19, xp: 3, mass: 1.8 },
  zombie: { name: 'Zombie', hp: 36, spd: 52, dmg: 10, r: 13, xp: 3, mass: 1 },
  snork: { name: 'Snork', hp: 42, spd: 90, dmg: 16, r: 14, xp: 4, mass: 1 },
  cat: { name: 'Zone Cat', hp: 30, spd: 140, dmg: 10, r: 11, xp: 4, mass: 0.6 },
  bloodsucker: { name: 'Bloodsucker', hp: 95, spd: 126, dmg: 22, r: 16, xp: 8, mass: 1.4 },
  izlom: { name: 'Izlom', hp: 120, spd: 96, dmg: 24, r: 16, xp: 9, mass: 1.6 },
  poltergeist: { name: 'Poltergeist', hp: 70, spd: 80, dmg: 12, r: 15, xp: 9, mass: 0.8, fly: true },
  psydog: { name: 'Psy-Dog', hp: 60, spd: 118, dmg: 12, r: 14, xp: 8, mass: 1 },
  phantom: { name: 'Phantom', hp: 1, spd: 130, dmg: 4, r: 13, xp: 0, mass: 0.5 },
  controller: { name: 'Controller', hp: 170, spd: 46, dmg: 15, r: 17, xp: 12, mass: 2.2 },
  pseudodog: { name: 'Pseudodog', hp: 70, spd: 150, dmg: 12, r: 15, xp: 6, mass: 1.2, vsc: 1.25 },
  boar: { name: 'Boar', hp: 110, spd: 80, dmg: 20, r: 18, xp: 8, mass: 2.5 },
  karlik: { name: 'Karlik', hp: 60, spd: 70, dmg: 12, r: 12, xp: 8, mass: 0.9, vsc: 0.6 },
  spark: { name: 'Spark', hp: 65, spd: 95, dmg: 14, r: 14, xp: 9, mass: 0.7, fly: true },
  msoldier: { name: 'Monolith Soldier', hp: 120, spd: 62, dmg: 14, r: 14, xp: 12, mass: 1.3 },
  pseudogiant: { name: 'PSEUDOGIANT', boss: true, hp: 2600, spd: 64, dmg: 30, r: 42, xp: 140, mass: 30 },
  chimera: { name: 'CHIMERA', boss: true, hp: 3600, spd: 100, dmg: 28, r: 32, xp: 170, mass: 25 },
  burer: { name: 'BURER', boss: true, hp: 4400, spd: 56, dmg: 25, r: 26, xp: 200, mass: 25 },
  matriarch: { name: 'BLOODSUCKER MATRIARCH', boss: true, hp: 4000, spd: 120, dmg: 30, r: 30, xp: 190, mass: 25, vsc: 1.9 },
  polterking: { name: 'POLTERGEIST KING', boss: true, hp: 3800, spd: 70, dmg: 22, r: 30, xp: 190, mass: 25, fly: true, vsc: 2.2 },
  prime: { name: 'CONTROLLER PRIME', boss: true, hp: 5200, spd: 44, dmg: 26, r: 30, xp: 220, mass: 30, vsc: 1.9 },
  behemoth: { name: 'BEHEMOTH', boss: true, hp: 6500, spd: 70, dmg: 34, r: 48, xp: 260, mass: 60, vsc: 2.6 },
  ratqueen: { name: 'TUSHKANO QUEEN', boss: true, hp: 3600, spd: 90, dmg: 22, r: 34, xp: 180, mass: 25, vsc: 3.6 },
  packalpha: { name: 'PACK ALPHA', boss: true, hp: 4200, spd: 150, dmg: 26, r: 30, xp: 200, mass: 25, vsc: 2.6 },
  izlomlord: { name: 'IZLOM LORD', boss: true, hp: 5600, spd: 90, dmg: 32, r: 34, xp: 230, mass: 40, vsc: 2.2 },
  monolith: { name: 'THE MONOLITH', boss: true, hp: 16000, spd: 42, dmg: 30, r: 48, xp: 0, mass: 999, fly: true },
};
const ELITE_AFFIX = {
  swift: { name: 'Swift', color: '#6cf', desc: 'fast' },
  volatile: { name: 'Volatile', color: '#ff8a2a', desc: 'explodes on death' },
  regen: { name: 'Regenerating', color: '#6f6', desc: 'regenerates' },
  armored: { name: 'Armored', color: '#ddd', desc: 'takes half damage' },
  vampiric: { name: 'Vampiric', color: '#ff3a6a', desc: 'heals when it hits' },
};
// spawn weights by minute (+ night / weather / lab tweaks applied in game)
function spawnTable(m, lab) {
  if (lab) return { zombie: 30, snork: 30, rat: 15, bloodsucker: 12 + m, controller: 4 + m * 0.5, poltergeist: 8, izlom: m > 4 ? 8 : 0, karlik: m > 6 ? 8 : 0, msoldier: m > 9 ? 8 : 0, spark: m > 7 ? 6 : 0 };
  const t = { dog: 60, flesh: 25 };
  if (m >= 1) { t.zombie = 25; t.dog = 50; }
  if (m >= 1.5) t.rat = 12;
  if (m >= 2.5) t.pseudodog = 10;
  if (m >= 4) t.boar = 8 + m * 0.4;
  if (m >= 2) t.snork = 22;
  if (m >= 3) t.cat = 12;
  if (m >= 3.5) t.bloodsucker = 10 + m * 1.5;
  if (m >= 5) { t.poltergeist = 10 + m; t.izlom = 8 + m * 0.5; }
  if (m >= 6) t.psydog = 8 + m * 0.5;
  if (m >= 7) t.controller = 4 + m * 0.6;
  if (m >= 6.5) t.karlik = 6 + m * 0.4;
  if (m >= 8) { t.flesh = 15; t.spark = 6 + m * 0.4; t.dog = 30; }
  if (m >= 10) t.msoldier = 5 + m * 0.4;
  if (m >= 12) { t.dog = 15; t.rat = 8; t.zombie = 12; }
  return t;
}
// standard run: a boss every 2.5 min, final boss at 15:00. Endless keeps cycling BOSS_POOL forever.
const BOSS_SCHEDULE = [
  { t: 150, id: 'pseudogiant' },
  { t: 300, id: 'chimera' },
  { t: 450, id: 'matriarch' },
  { t: 600, id: 'burer' },
  { t: 750, id: 'polterking' },
  { t: 900, id: 'final' },
];
const BOSS_POOL = ['pseudogiant', 'chimera', 'matriarch', 'ratqueen', 'burer', 'polterking', 'packalpha', 'prime', 'izlomlord', 'behemoth'];
const BOSS_TITLES = ['', 'ELDER', 'ANCIENT', 'PRIMORDIAL', 'MYTHIC', 'APEX', 'ETERNAL'];
// wave mutations: any mutant (and later every boss) can carry one
const MUTATIONS = {
  burning: { name: 'Burning', color: '#ff7a2a', rgb: '255,122,42', desc: 'leave fire in their wake' },
  electric: { name: 'Electric', color: '#6cc4ff', rgb: '108,196,255', desc: 'discharge lightning when they die' },
  toxic: { name: 'Toxic', color: '#8cff5a', rgb: '140,255,90', desc: 'leave slowing acid puddles' },
  psi: { name: 'Psionic', color: '#c07aff', rgb: '192,122,255', desc: 'blink toward you' },
  gravity: { name: 'Gravitic', color: '#a98cff', rgb: '169,140,255', desc: 'drag you toward them' },
  irradiated: { name: 'Irradiated', color: '#e8e040', rgb: '232,224,64', desc: 'burn you with radiation up close' },
};
const EMISSIONS = [255, 615]; // warning start times (blast 30s later); endless repeats every 6 min

// ---------- stages ----------
const STAGES = [
  { id: 'zone', name: 'The Zone', icon: '☢️', desc: 'From the Cordon to the Radar. Where every stalker begins.', hpMul: 1, final: { id: 'monolith', name: 'THE MONOLITH' }, needs: null },
  { id: 'pripyat', name: 'Pripyat', icon: '🏙️', desc: 'The dead city. Towering ruins, endless packs, harsher mutants.', hpMul: 1.45, final: { id: 'monolith', name: 'THE C-CONSCIOUSNESS', hp: 1.4 }, needs: 'zone' },
  { id: 'npp', name: 'Chernobyl NPP', icon: '⚛️', desc: 'The sarcophagus. Radiation everywhere. The Wish Granter waits.', hpMul: 2, final: { id: 'monolith', name: 'THE WISH GRANTER', hp: 2 }, needs: 'pripyat' },
];

// ---------- characters (bought with rubles) ----------
const CHARACTERS = [
  { id: 'rookie', name: 'Rookie', icon: '🧢', cost: 0, weapon: 'pistol', desc: 'Balanced. Starts with the PM pistol.', mod: {}, pal: { jacket: '#56603f', hood: '#4a5438' } },
  { id: 'loner', name: 'Loner', icon: '🎒', cost: 400, weapon: 'bolts', desc: 'Knows the Zone: +10% speed, detector sees twice as far.', mod: { spdMul: 0.1, detect: 2 }, pal: { jacket: '#6a5a3e', hood: '#5a4a32' } },
  { id: 'duty', name: 'Duty Soldier', icon: '🛡️', cost: 900, weapon: 'ak', desc: 'Exoskeleton: +30 HP, -15% damage taken, -8% speed.', mod: { maxhp: 30, dr: 0.15, spdMul: -0.08 }, pal: { jacket: '#5a2a24', hood: '#3a2a26' } },
  { id: 'freedom', name: 'Freedom Anarchist', icon: '🍀', cost: 1200, weapon: 'shotgun', desc: 'Fast and lucky: +12% speed, much better card rarity.', mod: { spdMul: 0.12, luck: 2 }, pal: { jacket: '#3e6a3a', hood: '#2e5a2a' } },
  { id: 'ecologist', name: 'Ecologist', icon: '🥼', cost: 1800, weapon: 'gauss', desc: 'SEVA suit: -60% anomaly & radiation damage, -20 HP.', mod: { anomRes: 0.6, maxhp: -20 }, pal: { jacket: '#c8b040', hood: '#d8c050' } },
  { id: 'fanatic', name: 'Monolith Fanatic', icon: '💠', cost: 3000, weapon: 'knife', desc: 'Psi-immune, starts with Moonlight. +20% damage, -30 HP.', mod: { psiImmune: 1, dmgMul: 0.2, maxhp: -30, art: 'moonlight' }, pal: { jacket: '#8a8e90', hood: '#6a7074' } },
];

// ---------- meta upgrades (Sidorovich's bunker) ----------
const META = [
  { id: 'hp', name: 'Thick Skin', icon: '❤️', desc: '+10 max HP', max: 10, base: 60 },
  { id: 'dmg', name: 'Gunsmith', icon: '🔧', desc: '+5% damage', max: 10, base: 80 },
  { id: 'spd', name: 'Light Boots', icon: '👟', desc: '+3% move speed', max: 5, base: 90 },
  { id: 'armor', name: 'Kevlar', icon: '🦺', desc: '-3% damage taken', max: 5, base: 110 },
  { id: 'xp', name: 'Zone Wisdom', icon: '📘', desc: '+6% XP', max: 8, base: 70 },
  { id: 'magnet', name: 'Deep Pockets', icon: '🧲', desc: '+10% pickup range', max: 5, base: 50 },
  { id: 'luck', name: 'Lucky Charm', icon: '🍀', desc: 'Better upgrade rarity', max: 5, base: 120 },
  { id: 'reroll', name: 'Smooth Talker', icon: '🎲', desc: '+1 card reroll per run', max: 5, base: 100 },
  { id: 'dash', name: 'Parkour', icon: '💨', desc: '-8% dash cooldown', max: 5, base: 70 },
  { id: 'start', name: 'Stash Map', icon: '🗺️', desc: '+1 free level-up at start', max: 3, base: 250 },
  { id: 'revive', name: 'Second Wind', icon: '💉', desc: '+1 revive per run', max: 2, base: 600 },
];
const metaCost = (m, lvl) => Math.round(m.base * Math.pow(1.55, lvl));

// ---------- side quests ----------
const QUEST_KILL = [['dog', 25], ['rat', 30], ['flesh', 10], ['zombie', 12], ['snork', 10], ['bloodsucker', 5], ['cat', 8], ['izlom', 4], ['poltergeist', 4], ['controller', 3], ['psydog', 4]];

// ---------- radio chatter ----------
const RADIO = {
  start: [['Sidorovich', 'Alright rookie, get out there. Bring me artifacts and try not to die.'], ['Sidorovich', 'Welcome to the Zone. Nobody here is going to hold your hand.']],
  night: [['Stalker', 'Night is falling... keep your flashlight on and your back to a wall.'], ['Barkeep', 'Bloodsuckers love the dark. Watch the shadows.']],
  day: [['Stalker', 'Sun is up. Made it through another night.'], ['Sidorovich', 'Morning. Still alive? Good, there is work.']],
  rain: [['Stalker', 'Rain again. Electro anomalies are going crazy in this weather.']],
  fog: [['Stalker', 'Fog\'s rolling in... can\'t see a thing past twenty meters.']],
  storm: [['Scientist', 'Lightning storm! Stay away from open ground!']],
  psi: [['Scientist', 'Psi-storm detected. Expect headaches... and worse.'], ['Monolith', 'Come to us... the Monolith calls...']],
  boss: [['Stalker', 'Something big is coming this way! RUN!'], ['Barkeep', 'We\'ve got reports of a huge mutant near you. Good luck, friend.']],
  bossdead: [['Barkeep', 'You killed THAT? Drinks are on me.'], ['Stalker', 'Now that\'s a stalker! Respect, brother.']],
  emission: [['Scientist', 'EMISSION! Find cover immediately!'], ['Sidorovich', 'Blowout coming! Get underground or get cooked!']],
  emissionEnd: [['Scientist', 'The emission is over. New artifacts are forming out there.']],
  artifact: [['Sidorovich', 'An artifact! Now we\'re talking business.'], ['Scientist', 'Fascinating specimen. Handle it carefully.']],
  lowhp: [['Stalker', 'You\'re bleeding out, man! Use a medkit!'], ['Stalker', 'Get out of there, you\'re hurt!']],
  quest: [['Sidorovich', 'Got a job for you. Check your PDA.'], ['Barkeep', 'New contract posted. Pays well.']],
  questDone: [['Sidorovich', 'Job done? Here\'s your money. Don\'t spend it on vodka.'], ['Barkeep', 'Nice work. The money is yours.']],
  lab: [['Scientist', 'You\'re inside an X-lab. The Monolith\'s people guard these places... be careful.']],
  poi: [['Stalker', 'There\'s a stash here, but something is guarding it.']],
  elite: [['Stalker', 'That one looks different... stronger. Careful!']],
  evolution: [['Sidorovich', 'Hah! Where did you get THAT thing? Beautiful.']],
  streak: [['Stalker', 'Cheeki breeki! Look at him go!'], ['Stalker', 'Get down, stalker! ...never mind, he\'s got this.']],
};

// ---------- first-run hints ----------
const HINTS = {
  move: 'Move with WASD (or drag on touch). Your weapons fire automatically.',
  anomaly: 'That shimmer is an ANOMALY. It hurts you, but it hurts mutants too. Lure them in!',
  detector: 'Your detector is beeping: an ARTIFACT is hidden in that anomaly field. Grab it!',
  levelup: 'Pick an upgrade. Card color shows rarity, and rarer cards are stronger.',
  crate: 'Walk into supply crates to loot them.',
  ability: 'Every artifact has its own power! Press Q to use it. Switch artifacts with the mouse wheel, E, or the - and + keys.',
  emission: 'Follow the green arrow to a SHELTER bunker, or hide underground in a lab!',
  night: 'Night: it\'s darker and more mutants come out. Your flashlight points where you move.',
  quest: 'Contracts appear on the right. Complete them for rubles to spend in the Bunker.',
  lab: 'An underground LAB. Stand on the hatch to go down. Its boss guards rare loot.',
  poi: 'A GUARDED STASH. Kill the Alpha to unlock it.',
  barrel: 'Red barrels explode when shot. Use them!',
  evolution: 'EVOLUTION available! A max-level weapon plus its matching artifact becomes something much stronger.',
  synergy: 'SYNERGY! 3 items with the same tag grant a set bonus. Get 6 for more.',
  elite: 'ELITE mutant! Glowing ones are much tougher but drop great loot.',
};

// ---------- difficulty (picked first on the setup screen) ----------
const DIFFICULTIES = [
  { id: 'tourist', icon: '🧃', name: 'Tourist', desc: 'Story mode. Weak, slow-spawning mutants, fast healing, 2 extra revives.', hp: 0.5, dmg: 0.35, spawn: 0.6, boss: 0.55, regen: 1.5, rev: 2, xp: 1.3, rub: 0.8, hpBonus: 60 },
  { id: 'rookie', icon: '🌱', name: 'Rookie', desc: 'Relaxed. Softer mutants, gentle healing and 1 extra revive.', hp: 0.72, dmg: 0.55, spawn: 0.8, boss: 0.75, regen: 0.6, rev: 1, xp: 1.15, rub: 0.9, hpBonus: 30 },
  { id: 'stalker', icon: '🎒', name: 'Stalker', desc: 'The intended balance.', hp: 1, dmg: 1, spawn: 1, boss: 1, regen: 0, rev: 0, xp: 1, rub: 1, hpBonus: 0 },
  { id: 'veteran', icon: '🎖️', name: 'Veteran', desc: 'Tougher, hungrier mutants. +40% rubles.', hp: 1.3, dmg: 1.3, spawn: 1.15, boss: 1.3, regen: 0, rev: 0, xp: 1, rub: 1.4, hpBonus: 0 },
  { id: 'legend', icon: '💀', name: 'Legend', desc: 'The Zone wants you dead. Double rubles.', hp: 1.7, dmg: 1.7, spawn: 1.3, boss: 1.6, regen: 0, rev: 0, xp: 1, rub: 2, hpBonus: 0 },
];
function diffDef(id) { return DIFFICULTIES.find((d) => d.id === (id || (G && G.diff))) || DIFFICULTIES[1]; }
