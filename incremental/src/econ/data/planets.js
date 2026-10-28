import { coinTypesFor } from './coins.js';
// Planet data. Each pole has its own starting strata (Pole Pick Variations).
// Strata: from depth `d` (m) down to the next entry. hard: dig resistance, rich: coin richness.

export const PLANETS = [
  {
    id: 'frostara', name: 'Frostara', icon: '🌍', rule: 'Classic ice sheet', available: true,
    radiusM: 1400, goalDepth: 1000, density: 7.5, depthScale: 9, richExp: 1.32,
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
  {
    id: 'mistral', name: 'Mistral', icon: '🌫️', rule: 'Fog, so vision matters', available: true,
    radiusM: 1800, goalDepth: 1200, density: 7.5, depthScale: 9, richExp: 1.34,
    // thick, low fog: past a few dozen metres everything is pearl grey unless your lamp cuts it
    exposure: 0.74, fog: [0.7, 0.71, 0.76], fogDensity: 0.022, skyVeil: 0.88, skyVeilBright: 0.9,
    sky: { turbidity: 9, rayleigh: 0.5, mieCoefficient: 0.02, mieDirectionalG: 0.7 },
    sunElevation: 9, dayLength: 720,
    grade: { lift: [0.02, 0.02, 0.03], gain: [0.96, 0.97, 1.0], sat: 0.88, contrast: 1.04 },
    ice: { tint: [0.68, 0.8, 0.86], deep: [0.18, 0.2, 0.34], snow: [0.9, 0.91, 0.94] },
    ocean: [0.12, 0.16, 0.22], land: [0.4, 0.39, 0.42], seed: 2903,
    theme: 'mistral',
    poles: {
      N: {
        name: 'Pearl Hollow', desc: 'Soft rime and pearl firn. Thick fog, but rich silver close to the top.',
        strata: [
          { d: 0, name: 'Rime crust', color: [0.9, 0.91, 0.95], hard: 0.75, rich: 0.95 },
          { d: 5, name: 'Pearl firn', color: [0.82, 0.84, 0.92], hard: 0.85, rich: 1.05 },
          { d: 25, name: 'Vapour ice', color: [0.66, 0.7, 0.84], hard: 1.0, rich: 1.08 },
          { d: 80, name: 'Glassfog layer', color: [0.55, 0.6, 0.8], hard: 1.1, rich: 1.12 },
          { d: 240, name: 'Silver mist ice', color: [0.48, 0.52, 0.74], hard: 1.2, rich: 1.2 },
          { d: 560, name: 'Deep pearl', color: [0.4, 0.4, 0.66], hard: 1.3, rich: 1.28 },
          { d: 950, name: 'Cloud heart', color: [0.52, 0.44, 0.7], hard: 1.4, rich: 1.45 },
        ],
      },
      S: {
        name: 'Grey Reach', desc: 'Hard grey shelf with gem pockets early on. The fog never lifts here.',
        strata: [
          { d: 0, name: 'Hoar shelf', color: [0.86, 0.87, 0.9], hard: 1.05, rich: 1.1 },
          { d: 4, name: 'Grey shelf', color: [0.7, 0.72, 0.8], hard: 1.15, rich: 1.15 },
          { d: 28, name: 'Gem pocket ice', color: [0.6, 0.7, 0.85], hard: 1.2, rich: 1.22 },
          { d: 100, name: 'Banded mist ice', color: [0.5, 0.56, 0.76], hard: 1.2, rich: 1.15 },
          { d: 280, name: 'Silver mist ice', color: [0.48, 0.52, 0.74], hard: 1.25, rich: 1.2 },
          { d: 600, name: 'Deep pearl', color: [0.4, 0.4, 0.66], hard: 1.3, rich: 1.28 },
          { d: 950, name: 'Cloud heart', color: [0.52, 0.44, 0.7], hard: 1.4, rich: 1.45 },
        ],
      },
    },
  },
  {
    id: 'cinderice', name: 'Cinderice', icon: '🌋', rule: 'Lava under ice, so melting is risky', available: true,
    radiusM: 2200, goalDepth: 1400, density: 7.5, depthScale: 9, richExp: 1.36,
    // ash-dark ice over a hot core: a dim red sky, embers in the air, lava glowing through the deep ice
    exposure: 0.78, fog: [0.42, 0.33, 0.3], fogDensity: 0.004, skyVeil: 0.55, skyVeilBright: 0.85,
    sky: { turbidity: 12, rayleigh: 0.6, mieCoefficient: 0.012, mieDirectionalG: 0.8 },
    sunElevation: 7, dayLength: 540,
    grade: { lift: [0.03, 0.01, 0.0], gain: [1.04, 0.97, 0.92], sat: 1.05, contrast: 1.12 },
    ice: { tint: [0.62, 0.66, 0.72], deep: [0.18, 0.08, 0.06], snow: [0.6, 0.56, 0.55] },
    ocean: [0.16, 0.06, 0.04], land: [0.22, 0.18, 0.17], seed: 4417,
    theme: 'cinderice',
    lava: { from: 12, pockets: 90, veins: 8 },
    poles: {
      N: {
        name: 'Ash Crown', desc: 'Ash-banded ice over shallow lava. Rich and quick, but the heat comes early.',
        strata: [
          { d: 0, name: 'Ash crust', color: [0.62, 0.6, 0.6], hard: 0.8, rich: 1.0 },
          { d: 6, name: 'Cinder firn', color: [0.55, 0.52, 0.54], hard: 0.9, rich: 1.08 },
          { d: 24, name: 'Smoke ice', color: [0.48, 0.48, 0.55], hard: 1.05, rich: 1.12 },
          { d: 70, name: 'Ember band', color: [0.55, 0.38, 0.32], hard: 1.15, rich: 1.2 },
          { d: 220, name: 'Basalt ice', color: [0.3, 0.3, 0.36], hard: 1.3, rich: 1.26 },
          { d: 600, name: 'Magma glass', color: [0.36, 0.2, 0.2], hard: 1.45, rich: 1.35 },
          { d: 1100, name: 'Furnace heart', color: [0.5, 0.18, 0.1], hard: 1.6, rich: 1.55 },
        ],
      },
      S: {
        name: 'Cold Caldera', desc: 'A thick cold cap over an old caldera. Safe for longer, then the deep gets very rich.',
        strata: [
          { d: 0, name: 'Frost ash', color: [0.78, 0.76, 0.76], hard: 0.85, rich: 1.0 },
          { d: 8, name: 'Caldera ice', color: [0.58, 0.6, 0.66], hard: 1.1, rich: 1.0 },
          { d: 40, name: 'Smoke ice', color: [0.48, 0.48, 0.55], hard: 1.15, rich: 1.12 },
          { d: 120, name: 'Ember band', color: [0.55, 0.38, 0.32], hard: 1.2, rich: 1.25 },
          { d: 300, name: 'Basalt ice', color: [0.3, 0.3, 0.36], hard: 1.3, rich: 1.3 },
          { d: 650, name: 'Magma glass', color: [0.36, 0.2, 0.2], hard: 1.45, rich: 1.4 },
          { d: 1100, name: 'Furnace heart', color: [0.5, 0.18, 0.1], hard: 1.6, rich: 1.6 },
        ],
      },
    },
  },
  {
    id: 'tidalis', name: 'Tidalis', icon: '🌊', rule: 'Ocean ice, so currents carry coins', available: true,
    radiusM: 2600, goalDepth: 1500, density: 7.5, depthScale: 9, richExp: 1.38,
    // a frozen ocean: green-blue sea ice, a low bright sky, and currents running under the ice
    exposure: 0.86, fog: [0.62, 0.78, 0.82], fogDensity: 0.0018,
    sky: { turbidity: 3, rayleigh: 1.6, mieCoefficient: 0.005, mieDirectionalG: 0.8 },
    sunElevation: 16, dayLength: 660,
    grade: { lift: [0.0, 0.015, 0.02], gain: [0.96, 1.02, 1.02], sat: 1.1, contrast: 1.08 },
    ice: { tint: [0.45, 0.85, 0.82], deep: [0.03, 0.22, 0.3], snow: [0.9, 0.96, 0.97] },
    ocean: [0.03, 0.2, 0.26], land: [0.3, 0.34, 0.32], seed: 6131,
    theme: 'tidalis',
    current: { speed: 0.9, turn: 0.004 },
    poles: {
      N: {
        name: 'Pack Ice', desc: 'Young pack ice over a strong current: coins drift far, and gems sit shallow.',
        strata: [
          { d: 0, name: 'Pancake ice', color: [0.86, 0.95, 0.96], hard: 0.75, rich: 1.0 },
          { d: 5, name: 'Pack ice', color: [0.66, 0.9, 0.9], hard: 0.85, rich: 1.08 },
          { d: 22, name: 'Brine channels', color: [0.48, 0.82, 0.84], hard: 0.95, rich: 1.14 },
          { d: 80, name: 'Old sea ice', color: [0.32, 0.68, 0.76], hard: 1.1, rich: 1.2 },
          { d: 260, name: 'Pressure ridge', color: [0.22, 0.52, 0.66], hard: 1.25, rich: 1.28 },
          { d: 700, name: 'Abyssal ice', color: [0.12, 0.34, 0.52], hard: 1.4, rich: 1.4 },
          { d: 1250, name: 'Ocean heart', color: [0.1, 0.3, 0.6], hard: 1.6, rich: 1.6 },
        ],
      },
      S: {
        name: 'Shelf Front', desc: 'Thick shelf ice where the current is slow. Steadier, with relics deeper down.',
        strata: [
          { d: 0, name: 'Shelf snow', color: [0.9, 0.95, 0.97], hard: 0.85, rich: 1.0 },
          { d: 7, name: 'Shelf ice', color: [0.62, 0.86, 0.9], hard: 0.95, rich: 1.05 },
          { d: 40, name: 'Brine channels', color: [0.48, 0.82, 0.84], hard: 1.05, rich: 1.14 },
          { d: 120, name: 'Old sea ice', color: [0.32, 0.68, 0.76], hard: 1.15, rich: 1.22 },
          { d: 320, name: 'Pressure ridge', color: [0.22, 0.52, 0.66], hard: 1.25, rich: 1.3 },
          { d: 760, name: 'Abyssal ice', color: [0.12, 0.34, 0.52], hard: 1.4, rich: 1.42 },
          { d: 1250, name: 'Ocean heart', color: [0.1, 0.3, 0.6], hard: 1.6, rich: 1.62 },
        ],
      },
    },
  },
  {
    id: 'gale', name: 'Gale', icon: '🌪️', rule: 'Storms, so wind decides what works', available: true,
    radiusM: 3000, goalDepth: 1600, density: 7.5, depthScale: 9, richExp: 1.4,
    // a wind-scoured world: storms blow the heat away from melting; short calm windows open between them
    exposure: 0.84, fog: [0.7, 0.74, 0.78], fogDensity: 0.004, skyVeil: 0.35, skyVeilBright: 0.95,
    sky: { turbidity: 6, rayleigh: 1.2, mieCoefficient: 0.008, mieDirectionalG: 0.8 },
    sunElevation: 12, dayLength: 600,
    grade: { lift: [0.01, 0.01, 0.02], gain: [0.98, 0.99, 1.0], sat: 0.95, contrast: 1.12 },
    ice: { tint: [0.6, 0.78, 0.9], deep: [0.1, 0.18, 0.32], snow: [0.88, 0.9, 0.93] },
    ocean: [0.08, 0.14, 0.22], land: [0.32, 0.32, 0.34], seed: 7759,
    theme: 'gale',
    weather: { storm: [55, 85], calm: [12, 20], meltInStorm: 0.4, calmBonus: 2 },
    poles: {
      N: {
        name: 'Howling Shelf', desc: 'Long storms and short calms, but the calm windows pay double.',
        strata: [
          { d: 0, name: 'Wind slab', color: [0.88, 0.9, 0.94], hard: 0.8, rich: 1.0 },
          { d: 5, name: 'Scoured firn', color: [0.74, 0.82, 0.9], hard: 0.9, rich: 1.06 },
          { d: 26, name: 'Drift ice', color: [0.58, 0.72, 0.86], hard: 1.0, rich: 1.12 },
          { d: 90, name: 'Storm bands', color: [0.46, 0.6, 0.8], hard: 1.15, rich: 1.2 },
          { d: 280, name: 'Gale glass', color: [0.34, 0.48, 0.72], hard: 1.3, rich: 1.3 },
          { d: 760, name: 'Pressure ice', color: [0.22, 0.34, 0.6], hard: 1.45, rich: 1.42 },
          { d: 1350, name: 'Eye of the storm', color: [0.5, 0.62, 0.86], hard: 1.6, rich: 1.65 },
        ],
      },
      S: {
        name: 'Lee Basin', desc: 'Sheltered from the worst of it: gentler storms, steadier digging.',
        strata: [
          { d: 0, name: 'Lee drift', color: [0.9, 0.92, 0.95], hard: 0.85, rich: 1.0 },
          { d: 6, name: 'Basin firn', color: [0.72, 0.8, 0.9], hard: 0.95, rich: 1.05 },
          { d: 34, name: 'Drift ice', color: [0.58, 0.72, 0.86], hard: 1.05, rich: 1.12 },
          { d: 110, name: 'Storm bands', color: [0.46, 0.6, 0.8], hard: 1.15, rich: 1.22 },
          { d: 320, name: 'Gale glass', color: [0.34, 0.48, 0.72], hard: 1.3, rich: 1.3 },
          { d: 800, name: 'Pressure ice', color: [0.22, 0.34, 0.6], hard: 1.45, rich: 1.42 },
          { d: 1350, name: 'Eye of the storm', color: [0.5, 0.62, 0.86], hard: 1.6, rich: 1.66 },
        ],
      },
    },
  },
  {
    id: 'auralis', name: 'Auralis', icon: '🌌', rule: 'Aurora world with rare sky coins', available: true,
    radiusM: 3200, goalDepth: 1700, density: 6.4, depthScale: 9, richExp: 1.42,
    // a world of long twilight: the ice is poorer, but the sky pays. Auroras come often, and between
    // them a lone sky coin drifts down now and then. Catching sky coins one after another builds the Aurora Chain.
    exposure: 0.8, fog: [0.26, 0.3, 0.42], fogDensity: 0.0016,
    sky: { turbidity: 1.6, rayleigh: 0.7, mieCoefficient: 0.004, mieDirectionalG: 0.82 },
    sunElevation: 5, dayLength: 720,
    grade: { lift: [0.01, 0.0, 0.03], gain: [0.96, 1.0, 1.04], sat: 1.12, contrast: 1.1 },
    ice: { tint: [0.55, 0.85, 0.9], deep: [0.12, 0.1, 0.32], snow: [0.86, 0.9, 0.98] },
    ocean: [0.05, 0.08, 0.2], land: [0.24, 0.24, 0.3], seed: 8803,
    theme: 'auralis',
    clouds: 0.04,   // clear twilight skies, so the aurora reads
    // every: seconds between auroras; skyEvery: seconds between lone sky coins; share: income from the sky
    aurora: { N: { every: [70, 110], skyEvery: [25, 45], share: 0.34 }, S: { every: [110, 160], skyEvery: [40, 70], share: 0.2 }, dur: 50, coins: 18 },
    poles: {
      N: {
        name: 'Crown of Lights', desc: 'Auroras almost every minute and a sky full of coins, over thin, poor ice.',
        strata: [
          { d: 0, name: 'Star frost', color: [0.88, 0.92, 0.98], hard: 0.8, rich: 0.95 },
          { d: 5, name: 'Glimmer firn', color: [0.7, 0.86, 0.94], hard: 0.9, rich: 1.0 },
          { d: 24, name: 'Ribbon ice', color: [0.52, 0.82, 0.8], hard: 1.0, rich: 1.08 },
          { d: 90, name: 'Veil ice', color: [0.46, 0.6, 0.86], hard: 1.12, rich: 1.16 },
          { d: 280, name: 'Twilight glass', color: [0.38, 0.4, 0.78], hard: 1.28, rich: 1.26 },
          { d: 760, name: 'Night ice', color: [0.24, 0.2, 0.56], hard: 1.42, rich: 1.38 },
          { d: 1400, name: 'Heart of light', color: [0.62, 0.9, 0.78], hard: 1.6, rich: 1.62 },
        ],
      },
      S: {
        name: 'Quiet Pole', desc: 'Rarer auroras, but deeper, richer ice to fall back on.',
        strata: [
          { d: 0, name: 'Quiet snow', color: [0.9, 0.92, 0.97], hard: 0.85, rich: 1.0 },
          { d: 6, name: 'Glimmer firn', color: [0.7, 0.86, 0.94], hard: 0.95, rich: 1.06 },
          { d: 34, name: 'Ribbon ice', color: [0.52, 0.82, 0.8], hard: 1.05, rich: 1.14 },
          { d: 110, name: 'Veil ice', color: [0.46, 0.6, 0.86], hard: 1.15, rich: 1.22 },
          { d: 320, name: 'Twilight glass', color: [0.38, 0.4, 0.78], hard: 1.3, rich: 1.32 },
          { d: 800, name: 'Night ice', color: [0.24, 0.2, 0.56], hard: 1.44, rich: 1.44 },
          { d: 1400, name: 'Heart of light', color: [0.62, 0.9, 0.78], hard: 1.6, rich: 1.68 },
        ],
      },
    },
  },
  {
    id: 'omega', name: 'Omega', icon: '🔮', rule: 'Every rule combined', available: true,
    radiusM: 3600, goalDepth: 2000, density: 7.0, depthScale: 9, richExp: 1.44,
    // the last world: fog, lava, currents, storms and auroras all at once, over ice that holds every kind of mutant
    exposure: 0.8, fog: [0.5, 0.48, 0.56], fogDensity: 0.009, skyVeil: 0.5, skyVeilBright: 0.9, clouds: 0.18,
    sky: { turbidity: 7, rayleigh: 0.9, mieCoefficient: 0.01, mieDirectionalG: 0.8 },
    sunElevation: 8, dayLength: 660,
    grade: { lift: [0.02, 0.01, 0.03], gain: [1.0, 0.98, 1.02], sat: 1.06, contrast: 1.12 },
    ice: { tint: [0.6, 0.72, 0.86], deep: [0.2, 0.08, 0.28], snow: [0.82, 0.82, 0.88] },
    ocean: [0.1, 0.08, 0.2], land: [0.28, 0.24, 0.3], seed: 9901,
    theme: 'omega',
    allMutants: true,
    lava: { from: 20, pockets: 60, veins: 6 },
    current: { speed: 0.6, turn: 0.005 },
    weather: { storm: [45, 70], calm: [14, 22], meltInStorm: 0.55, calmBonus: 1.8 },
    aurora: { N: { every: [120, 180], skyEvery: [45, 80], share: 0.15 }, S: { every: [150, 220], skyEvery: [60, 100], share: 0.1 }, dur: 50, coins: 16 },
    // the final 15%: the core wakes. Storms fall silent, a gold aurora hangs over the crater, and sky coins come thick.
    climax: { from: 0.85, every: [35, 55], skyEvery: [12, 22] },
    poles: {
      N: {
        name: 'Convergence', desc: 'Every rule at full strength: lava early, strong currents, the long storms.',
        strata: [
          { d: 0, name: 'Ash-frost', color: [0.82, 0.8, 0.86], hard: 0.8, rich: 1.0 },
          { d: 6, name: 'Veiled firn', color: [0.68, 0.74, 0.84], hard: 0.9, rich: 1.05 },
          { d: 30, name: 'Brine glass', color: [0.46, 0.74, 0.76], hard: 1.02, rich: 1.12 },
          { d: 110, name: 'Ember bands', color: [0.62, 0.38, 0.36], hard: 1.15, rich: 1.2 },
          { d: 330, name: 'Storm glass', color: [0.36, 0.42, 0.72], hard: 1.3, rich: 1.3 },
          { d: 900, name: 'Night ice', color: [0.26, 0.16, 0.48], hard: 1.45, rich: 1.42 },
          { d: 1700, name: 'The waking core', color: [0.95, 0.72, 0.4], hard: 1.6, rich: 1.68 },
        ],
      },
      S: {
        name: 'Still Point', desc: 'The rules arrive one at a time: gentler storms, lava deeper, a slower current.',
        strata: [
          { d: 0, name: 'Quiet frost', color: [0.86, 0.86, 0.9], hard: 0.85, rich: 1.0 },
          { d: 8, name: 'Veiled firn', color: [0.68, 0.74, 0.84], hard: 0.95, rich: 1.05 },
          { d: 40, name: 'Brine glass', color: [0.46, 0.74, 0.76], hard: 1.05, rich: 1.13 },
          { d: 130, name: 'Ember bands', color: [0.62, 0.38, 0.36], hard: 1.17, rich: 1.22 },
          { d: 360, name: 'Storm glass', color: [0.36, 0.42, 0.72], hard: 1.3, rich: 1.32 },
          { d: 940, name: 'Night ice', color: [0.26, 0.16, 0.48], hard: 1.45, rich: 1.44 },
          { d: 1700, name: 'The waking core', color: [0.95, 0.72, 0.4], hard: 1.6, rich: 1.7 },
        ],
      },
    },
  },
];

// coin types per planet: the general kinds up to its place in the journey, plus its own signature coin
PLANETS.forEach((p, i) => { p.coinTiers = coinTypesFor(p.id, i); });

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
