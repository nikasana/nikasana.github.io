// Mutant ice: rare pockets with strange properties. Finding a type unlocks its DNA nodes and fills
// its page in the Mutation Log. effect is handled in game.js; colour tints the pocket in the ice shader.
import { rng, hash32 } from '../../core/rng.js';

export const MUTANTS = [
  { id: 'glowice', name: 'Glowice', planet: 'frostara', color: [0.45, 1.0, 0.8], glow: 0.9, effect: 'glow',
    desc: 'Shines from the inside, so it shows from far away in the dark.', perk: 'Night Eyes: your lamp reaches farther and the deep is brighter.' },
  { id: 'springice', name: 'Springice', planet: 'frostara', color: [1.0, 0.55, 0.85], glow: 0.15, effect: 'bounce',
    desc: 'Rubbery ice that throws you back up when you land on it.', perk: 'Spring Legs: you walk faster; Long Arms reaches farther.' },
  { id: 'tarfrost', name: 'Tarfrost', planet: 'mistral', color: [0.9, 0.62, 0.25], glow: 0.1, effect: 'sticky',
    desc: 'Thick and slow to cut, but it holds twice the coins.', perk: 'Steady Hands: faster, cleaner digging.' },
  { id: 'chimeice', name: 'Chimeice', planet: 'mistral', color: [0.68, 0.58, 1.0], glow: 0.35, effect: 'chime',
    desc: 'Rings when struck; the echo shows you the finds nearby for a while.', perk: 'Echo Sense: feel for treasure and pull coins from farther.' },
  { id: 'emberice', name: 'Emberice', planet: 'cinderice', color: [1.0, 0.55, 0.22], glow: 0.7, effect: 'ember',
    desc: 'Warm to the touch. Melting it lights a heat-vein combo at once.', perk: 'Heat Skin: lava bursts spare your pack; Ember Heart: hotter melting.' },
  { id: 'obsidice', name: 'Obsidice', planet: 'cinderice', color: [0.3, 0.22, 0.4], glow: 0.08, effect: 'obsidian',
    desc: 'Black volcanic glass. Very hard to cut, but it holds three times the coins.', perk: 'Glass Eye: clean breaks on rich seams.' },
  { id: 'brineice', name: 'Brineice', planet: 'tidalis', color: [0.3, 0.9, 0.75], glow: 0.25, effect: 'brine',
    desc: 'Salty slush that gives way at a touch: melting it pays double.', perk: 'Salt Blood: your torch cuts a wider hole.' },
  { id: 'pearlice', name: 'Pearlice', planet: 'tidalis', color: [0.96, 0.92, 0.84], glow: 0.35, effect: 'pearl',
    desc: 'Layered like a pearl. It holds two and a half times the coins.', perk: 'Deep Lungs: you carry more before you must bank.' },
  { id: 'ventice', name: 'Ventice', planet: 'gale', color: [0.78, 0.88, 1.0], glow: 0.2, effect: 'gust',
    desc: 'Full of trapped wind. Breaking it lets out a gust that sweeps loose coins to you.', perk: 'Wind Runner: you walk faster, and storms steal less heat.' },
  { id: 'stormglass', name: 'Stormglass', planet: 'gale', color: [0.55, 0.6, 0.98], glow: 0.55, effect: 'charge',
    desc: 'Charged by lightning. Melting it opens a short calm of your own.', perk: 'Storm Heart: hotter melting.' },
  { id: 'lumice', name: 'Lumice', planet: 'auralis', color: [0.5, 1.0, 0.7], glow: 1.0, effect: 'lum',
    desc: 'Holds a scrap of aurora. Breaking it calls a sky coin down to you.', perk: 'Sky Eyes: auroras and sky coins come more often.' },
  { id: 'prismice', name: 'Prismice', planet: 'auralis', color: [1.0, 0.7, 0.95], glow: 0.6, effect: 'prism',
    desc: 'Splits light into colours. It holds twice the coins and breaks clean more often.', perk: 'Prism Hands: clean breaks everywhere.' },
];

export const MUTANT_BY_ID = Object.fromEntries(MUTANTS.map((m) => [m.id, m]));

// Pockets for a planet: deterministic from its seed, spread across the open ice and 2-80 m deep.
export function mutantPockets(planet, pole, surfaceY) {
  const types = planet.allMutants ? MUTANTS : MUTANTS.filter((m) => m.planet === planet.id);   // Omega holds every kind
  if (!types.length) return [];
  const r = rng(hash32(planet.seed, pole === 'N' ? 5 : 6, 777));
  const out = [];
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, d = 6 + Math.sqrt(r()) * 150;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const depth = 2 + Math.pow(r(), 1.4) * 78;
    out.push({ x, y: surfaceY(x, z) - depth, z, r: 1.1 + r() * 1.1, type: types[Math.floor(r() * types.length)].id });
  }
  return out;
}
