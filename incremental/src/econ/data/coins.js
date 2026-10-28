// Coin types. Value is in copper units (relative: the game turns it into money per m³ of ice, see
// game.coinValue). The first five keep their index (old saves and the vault pile rely on it); the rest
// add new kinds layer by layer, so digging deeper keeps turning up coins you have not seen yet.
//   minDepth: m below the surface where it starts to appear    from: first planet (index) it appears on
//   planet:   a planet's signature coin, found only there        shape / kind / engrave: how it looks
export const COINS = [
  { id: 'copper', name: 'Copper', icon: '🟤', value: 1, color: [0.955, 0.638, 0.538], rough: 0.38, minDepth: 0, radius: 0.153, thick: 0.025, shape: 'disc', hole: true, kind: 'metal', engrave: 'frost' },
  { id: 'silver', name: 'Silver', icon: '⚪', value: 10, color: [0.972, 0.96, 0.915], rough: 0.22, minDepth: 4, radius: 0.162, thick: 0.023, shape: 'disc', edge: 'milled', kind: 'metal', engrave: 'rings' },
  { id: 'gold', name: 'Gold', icon: '🟡', value: 100, color: [1.0, 0.766, 0.336], rough: 0.16, minDepth: 30, radius: 0.180, thick: 0.029, shape: 'disc', edge: 'points', kind: 'metal', engrave: 'sun' },
  { id: 'gem', name: 'Sapphire', icon: '💎', value: 1000, color: [0.55, 0.85, 1.0], rough: 0.05, minDepth: 25, radius: 0.144, thick: 0.144, shape: 'gem', kind: 'gem', from: 1 },
  { id: 'relic', name: 'Relic', icon: '🏺', value: 10000, color: [0.8, 0.5, 0.3], rough: 0.5, minDepth: 60, radius: 0.288, thick: 0.180, shape: 'vase', kind: 'stone', from: 3 },
  // general kinds, by depth
  { id: 'bronze', name: 'Bronze Square', icon: '🟫', value: 3, color: [0.8, 0.52, 0.3], rough: 0.4, minDepth: 2, radius: 0.15, thick: 0.03, shape: 'square', kind: 'metal', engrave: 'wave' },
  { id: 'electrum', name: 'Electrum Hex', icon: '⬡', value: 30, color: [0.9, 0.86, 0.55], rough: 0.25, minDepth: 12, radius: 0.16, thick: 0.03, shape: 'hex', kind: 'metal', engrave: 'spiral' },
  { id: 'platinum', name: 'Platinum Ring', icon: '⭕', value: 300, color: [0.82, 0.86, 0.92], rough: 0.14, minDepth: 45, radius: 0.18, thick: 0.03, shape: 'ring', kind: 'metal', engrave: 'rings' },
  { id: 'starcoin', name: 'Star Coin', icon: '⭐', value: 3000, color: [1.0, 0.88, 0.45], rough: 0.12, minDepth: 110, radius: 0.2, thick: 0.04, shape: 'star', kind: 'metal', glow: 0.25 },
  { id: 'moonstone', name: 'Moonstone', icon: '🌕', value: 9000, color: [0.85, 0.9, 1.0], rough: 0.25, minDepth: 180, radius: 0.15, thick: 0.15, shape: 'orb', kind: 'stone', glow: 0.2 },
  { id: 'ruby', name: 'Ruby', icon: '♦️', value: 20000, color: [1.0, 0.25, 0.32], rough: 0.05, minDepth: 260, radius: 0.15, thick: 0.15, shape: 'gem', kind: 'gem', from: 2 },
  { id: 'ingot', name: 'Black Ingot', icon: '▬', value: 50000, color: [0.22, 0.2, 0.26], rough: 0.2, minDepth: 360, radius: 0.22, thick: 0.08, shape: 'bar', kind: 'metal', glow: 0.1 },
  { id: 'emerald', name: 'Emerald', icon: '💚', value: 120000, color: [0.25, 0.95, 0.5], rough: 0.05, minDepth: 480, radius: 0.16, thick: 0.16, shape: 'emerald', kind: 'gem', from: 3 },
  { id: 'sunshard', name: 'Sun Shard', icon: '🔆', value: 300000, color: [1.0, 0.62, 0.2], rough: 0.1, minDepth: 640, radius: 0.13, thick: 0.13, shape: 'shard', kind: 'glow', glow: 0.9 },
  { id: 'voidcoin', name: 'Void Coin', icon: '🌑', value: 800000, color: [0.45, 0.25, 0.85], rough: 0.1, minDepth: 860, radius: 0.2, thick: 0.035, shape: 'ring', kind: 'glow', glow: 0.6 },
  { id: 'corestone', name: 'Corestone', icon: '🟠', value: 2500000, color: [1.0, 0.5, 0.15], rough: 0.2, minDepth: 1250, radius: 0.18, thick: 0.18, shape: 'orb', kind: 'glow', glow: 1.2, from: 4 },
  // each world's signature coin, found only there
  { id: 'pearl', name: 'Fog Pearl', icon: '🦪', value: 250, color: [0.96, 0.95, 0.92], rough: 0.2, minDepth: 18, radius: 0.12, thick: 0.12, shape: 'orb', kind: 'stone', glow: 0.15, planet: 'mistral' },
  { id: 'emberglass', name: 'Emberglass', icon: '🔥', value: 400, color: [1.0, 0.35, 0.12], rough: 0.08, minDepth: 25, radius: 0.12, thick: 0.12, shape: 'shard', kind: 'glow', glow: 0.8, planet: 'cinderice' },
  { id: 'seaglass', name: 'Sea Glass', icon: '🫧', value: 180, color: [0.4, 0.95, 0.85], rough: 0.15, minDepth: 15, radius: 0.15, thick: 0.07, shape: 'pebble', kind: 'gem', planet: 'tidalis' },
  { id: 'stormtoken', name: 'Storm Token', icon: '🌀', value: 500, color: [0.7, 0.8, 1.0], rough: 0.15, minDepth: 30, radius: 0.17, thick: 0.03, shape: 'hex', kind: 'metal', engrave: 'spiral', glow: 0.2, planet: 'gale' },
  { id: 'aurorite', name: 'Aurorite', icon: '🌌', value: 650, color: [0.45, 1.0, 0.7], rough: 0.08, minDepth: 20, radius: 0.12, thick: 0.12, shape: 'shard', kind: 'glow', glow: 0.7, planet: 'auralis' },
  { id: 'omegacoin', name: 'Omega Coin', icon: '🔮', value: 2000, color: [0.85, 0.55, 1.0], rough: 0.1, minDepth: 40, radius: 0.2, thick: 0.04, shape: 'star', kind: 'metal', glow: 0.5, planet: 'omega' },
  // a treasure chest: rare (1% of coins near the surface, 2.3% deep), worth CHEST_VALUE coins
  { id: 'chest', name: 'Chest', icon: '🧰', value: 0, color: [0.55, 0.36, 0.2], rough: 0.6, minDepth: 0, radius: 0.24, thick: 0.3, shape: 'chest', kind: 'chest', special: true },
];

export const COIN_BY_ID = Object.fromEntries(COINS.map((c) => [c.id, c]));
export const CHEST = COINS.findIndex((c) => c.id === 'chest');
export const CHEST_VALUE = 40;           // a chest pays like this many average coins at its depth
export const CHEST_SLOTS = 18;           // pack slots a chest takes
// chance that a coin spawn is a chest instead: 1% near the surface, 2.3% from about 500 m down
export const chestChance = (depth) => 0.01 + 0.013 * Math.min(1, Math.max(0, depth) / 500);

// Coin sizes vary: a coin is 0.65-1.5 times its type's size, and worth size² over the average size²,
// so a big coin is worth up to about twice a small one of the same kind and the average stays the same.
export const sizeOf = (u) => 0.65 + 0.85 * Math.pow(u, 1.5);
const MEAN_S2 = (() => { let s = 0; const N = 2000; for (let i = 0; i < N; i++) { const v = sizeOf((i + 0.5) / N); s += v * v; } return s / N; })();
export const sizeValue = (s) => (s * s) / MEAN_S2;

// The coin types a planet can hold: the general kinds up to its place in the journey, plus its signature.
export function coinTypesFor(planetId, planetIndex) {
  return COINS.filter((c) => !c.special && (c.planet ? c.planet === planetId : (c.from ?? 0) <= planetIndex)).map((c) => c.id);
}

// Share of each type (by count) at a depth. Each type ramps in from its depth, then thins as the next take
// over; signature coins are a little rarer. Only types in `unlocked` are used.
export function tierWeights(depth, unlocked) {
  const order = COINS.map((c, i) => [c.minDepth, i]).filter(([, i]) => unlocked.includes(COINS[i].id)).sort((a, b) => a[0] - b[0]);
  const rank = {};
  order.forEach(([, i], k) => { rank[i] = k; });
  const w = [];
  for (let i = 0; i < COINS.length; i++) {
    const c = COINS[i];
    if (c.special || !unlocked.includes(c.id) || depth < c.minDepth) { w.push(0); continue; }
    const into = depth - c.minDepth;
    const base = i === 0 ? 1 : Math.min(1, 0.15 + into / (c.minDepth * 3 + 20));
    w.push(base / Math.pow(1 + into / 400, 0.2 * rank[i]) * (c.planet ? 0.6 : 1));
  }
  // copper thins out with depth
  w[0] *= 1 / (1 + depth / 60);
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / s);
}
