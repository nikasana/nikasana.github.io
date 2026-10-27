// Planet data. Each pole has its own starting strata (Pole Pick Variations).
// Strata: from depth `d` (m) down to the next entry. hard: dig resistance, rich: coin richness.

export const PLANETS = [
  {
    id: 'frostara', name: 'Frostara', icon: '🌍', rule: 'Classic ice sheet', available: true,
    radiusM: 1400, goalDepth: 1000, density: 7.5, depthScale: 9, richExp: 1.32,
    coinTiers: ['copper', 'silver', 'gold'],
    exposure: 0.82, fog: [0.66, 0.77, 0.88], fogDensity: 0.0011,
    sky: { turbidity: 2.2, rayleigh: 1.1, mieCoefficient: 0.004, mieDirectionalG: 0.82 },
    sunElevation: 14, dayLength: 600,
    grade: { lift: [0.0, 0.008, 0.02], gain: [0.98, 1.0, 1.03], sat: 1.08, contrast: 1.12 },
    ice: { tint: [0.55, 0.85, 0.95], deep: [0.05, 0.25, 0.42], snow: [0.93, 0.96, 1.0] },
    ocean: [0.04, 0.16, 0.3], land: [0.35, 0.33, 0.3], seed: 1701,
    theme: 'frostara',
    poles: {
      N: {
        name: 'Glacier Crown', desc: 'Soft firn on top, dense blue ice below. Easy start.',
        strata: [
          { d: 0, name: 'Fresh firn', color: [0.95, 0.97, 1.0], hard: 0.7, rich: 0.85 },
          { d: 6, name: 'Packed firn', color: [0.84, 0.92, 0.98], hard: 0.85, rich: 0.95 },
          { d: 22, name: 'Bubble ice', color: [0.62, 0.84, 0.95], hard: 1.0, rich: 1.0 },
          { d: 70, name: 'Blue glacier ice', color: [0.38, 0.7, 0.9], hard: 1.1, rich: 1.08 },
          { d: 220, name: 'Ancient blue', color: [0.24, 0.55, 0.82], hard: 1.2, rich: 1.15 },
          { d: 520, name: 'Pressure ice', color: [0.18, 0.42, 0.72], hard: 1.3, rich: 1.22 },
          { d: 850, name: 'Heart lattice', color: [0.32, 0.36, 0.82], hard: 1.4, rich: 1.4 },
        ],
      },
      S: {
        name: 'Old Shelf', desc: 'Hard shelf ice right away, but silver seams run shallow.',
        strata: [
          { d: 0, name: 'Wind crust', color: [0.9, 0.94, 0.98], hard: 1.0, rich: 1.1 },
          { d: 3, name: 'Shelf ice', color: [0.68, 0.86, 0.95], hard: 1.15, rich: 1.2 },
          { d: 30, name: 'Silver seam', color: [0.72, 0.8, 0.88], hard: 1.15, rich: 1.18 },
          { d: 90, name: 'Banded ice', color: [0.42, 0.68, 0.88], hard: 1.15, rich: 1.1 },
          { d: 260, name: 'Ancient blue', color: [0.24, 0.55, 0.82], hard: 1.2, rich: 1.15 },
          { d: 560, name: 'Pressure ice', color: [0.18, 0.42, 0.72], hard: 1.3, rich: 1.22 },
          { d: 850, name: 'Heart lattice', color: [0.32, 0.36, 0.82], hard: 1.4, rich: 1.4 },
        ],
      },
    },
  },
  { id: 'mistral', name: 'Mistral', icon: '🌫️', rule: 'Fog, so vision matters', available: false },
  { id: 'cinderice', name: 'Cinderice', icon: '🌋', rule: 'Lava under ice, so melting is risky', available: false },
  { id: 'tidalis', name: 'Tidalis', icon: '🌊', rule: 'Ocean ice, so currents carry coins', available: false },
  { id: 'gale', name: 'Gale', icon: '🌪️', rule: 'Storms, so wind decides what works', available: false },
  { id: 'auralis', name: 'Auralis', icon: '🌌', rule: 'Aurora world with rare sky coins', available: false },
  { id: 'omega', name: 'Omega', icon: '🔮', rule: 'Every rule combined', available: false },
];

export const PLANET_BY_ID = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

export function stratumAt(planet, pole, depth) {
  const s = planet.poles[pole].strata;
  let cur = s[0];
  for (const x of s) if (depth >= x.d) cur = x;
  return cur;
}

// Smoothly blended stratum properties (no hard steps in the economy).
export function strataProps(planet, pole, depth) {
  const s = planet.poles[pole].strata;
  let i = 0;
  while (i < s.length - 1 && depth >= s[i + 1].d) i++;
  const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  const span = Math.max(1, b.d - a.d);
  const t = a === b ? 0 : Math.min(1, Math.max(0, (depth - a.d) / span));
  const k = Math.max(0, (t - 0.8) / 0.2); // blend only in the last 20% of a layer
  return {
    hard: a.hard + (b.hard - a.hard) * k,
    rich: a.rich + (b.rich - a.rich) * k,
    color: a.color.map((c, j) => c + (b.color[j] - c) * k),
    name: a.name,
  };
}
