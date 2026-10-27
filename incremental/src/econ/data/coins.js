// Coin tiers. Value is in copper units.
export const COINS = [
  { id: 'copper', name: 'Copper', icon: '🟤', value: 1, color: [0.955, 0.638, 0.538], rough: 0.38, minDepth: 0, radius: 0.153, thick: 0.025 },
  { id: 'silver', name: 'Silver', icon: '⚪', value: 10, color: [0.972, 0.96, 0.915], rough: 0.22, minDepth: 4, radius: 0.162, thick: 0.023 },
  { id: 'gold', name: 'Gold', icon: '🟡', value: 100, color: [1.0, 0.766, 0.336], rough: 0.16, minDepth: 30, radius: 0.180, thick: 0.029 },
  { id: 'gem', name: 'Gem', icon: '💎', value: 1000, color: [0.55, 0.85, 1.0], rough: 0.05, minDepth: 1e9, radius: 0.144, thick: 0.144 },
  { id: 'relic', name: 'Relic', icon: '🏺', value: 10000, color: [0.8, 0.5, 0.3], rough: 0.5, minDepth: 1e9, radius: 0.288, thick: 0.180 },
];

export const COIN_BY_ID = Object.fromEntries(COINS.map((c) => [c.id, c]));

// Share of each tier (by count) at a depth, before planet modifiers. Only tiers unlocked for the batch are used.
export function tierWeights(depth, unlocked) {
  const w = [];
  for (let i = 0; i < COINS.length; i++) {
    const c = COINS[i];
    if (!unlocked.includes(c.id) || depth < c.minDepth) { w.push(0); continue; }
    const into = depth - c.minDepth;
    // each tier ramps in, then thins as the next tier takes over
    const base = i === 0 ? 1 : Math.min(1, 0.15 + into / (c.minDepth * 3 + 20));
    w.push(base / Math.pow(1 + into / 400, 0.2 * i));
  }
  // copper thins out with depth
  w[0] *= 1 / (1 + depth / 60);
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / s);
}
