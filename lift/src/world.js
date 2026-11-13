// Pure world generation: rooms are a function of hash(seed, floor, x, z).
import { CFG, roomSide } from './config.js';
import { hash32, hashFloat, mulberry32 } from './rng.js';

// Biomes are data. Adding a row needs no new code.
export const BIOMES = [
  { id: 'playroom', mat: 'balls', item: 'ball', tide: 'roll',
    floor: [0.86, 0.80, 0.70], wall: [0.80, 0.84, 0.92], ceil: [0.92, 0.92, 0.95],
    items: [[0.95, 0.35, 0.35], [0.35, 0.65, 0.95], [0.98, 0.82, 0.30], [0.45, 0.85, 0.50], [0.85, 0.50, 0.90]],
    size: 0.16, ceilH: [2.8, 3.4], tideSpeed: 1.4, tideHeight: 0.5 },
  { id: 'pools', mat: 'foam', item: 'foam', tide: 'rise',
    floor: [0.62, 0.84, 0.88], wall: [0.78, 0.90, 0.92], ceil: [0.90, 0.95, 0.96],
    items: [[0.96, 0.98, 1.0], [0.86, 0.94, 0.98], [0.80, 0.92, 0.96]],
    size: 0.2, ceilH: [3.6, 5.0], tideSpeed: 0.7, tideHeight: 1.0 },
  { id: 'office', mat: 'paper', item: 'paper', tide: 'gust',
    floor: [0.62, 0.64, 0.68], wall: [0.86, 0.85, 0.80], ceil: [0.93, 0.93, 0.90],
    items: [[0.97, 0.97, 0.95], [0.92, 0.93, 0.98], [0.98, 0.95, 0.80]],
    size: 0.2, ceilH: [2.6, 3.0], tideSpeed: 1.2, tideHeight: 0.6 },
  { id: 'greenhouse', mat: 'leaves', item: 'leaf', tide: 'swirl',
    floor: [0.70, 0.66, 0.55], wall: [0.82, 0.90, 0.84], ceil: [0.90, 0.96, 0.92],
    items: [[0.45, 0.70, 0.30], [0.75, 0.60, 0.25], [0.85, 0.45, 0.20], [0.55, 0.78, 0.35]],
    size: 0.15, ceilH: [3.4, 4.6], tideSpeed: 1.0, tideHeight: 0.8 },
  { id: 'library', mat: 'books', item: 'book', tide: 'stack',
    floor: [0.55, 0.40, 0.30], wall: [0.78, 0.70, 0.60], ceil: [0.85, 0.80, 0.72],
    items: [[0.60, 0.20, 0.20], [0.20, 0.35, 0.55], [0.25, 0.45, 0.30], [0.75, 0.62, 0.35]],
    size: 0.2, ceilH: [3.0, 4.2], tideSpeed: 0.6, tideHeight: 0.9 },
  { id: 'cinema', mat: 'popcorn', item: 'popcorn', tide: 'burst',
    floor: [0.50, 0.25, 0.30], wall: [0.55, 0.35, 0.42], ceil: [0.40, 0.30, 0.38],
    items: [[0.99, 0.95, 0.80], [0.98, 0.90, 0.60], [0.90, 0.30, 0.30], [0.95, 0.85, 0.40]],
    size: 0.12, ceilH: [3.2, 4.0], tideSpeed: 1.3, tideHeight: 0.6 },
];
export const MATERIALS = BIOMES.map((b) => b.mat);
export const biomeById = (id) => BIOMES.find((b) => b.id === id) || BIOMES[0];

export const SET_PIECES = ['tree', 'chair', 'stairs', 'aquarium', 'door', 'moon'];

export function floorBiomes(seed, floor, enabled = BIOMES.length) {
  const n = Math.max(1, Math.min(enabled, BIOMES.length));
  if (floor === 0 || n === 1) return [0, Math.min(1, n - 1)];
  const a = hash32(seed, floor, 77) % n;
  let b = hash32(seed, floor, 78) % (n - 1);
  if (b >= a) b++;
  return [a, b];
}

export function biomeAt(seed, floor, x, z, enabled = BIOMES.length) {
  const [a, b] = floorBiomes(seed, floor, enabled);
  if (Math.abs(x) <= 2 && Math.abs(z) <= 2) return BIOMES[a];   // the lift's neighbourhood is the floor's main biome
  const px = Math.floor(x / CFG.patch), pz = Math.floor(z / CFG.patch);
  return hashFloat(seed, floor, px, pz, 91) < CFG.biomeMix ? BIOMES[a] : BIOMES[b];
}

export function roomModifier(seed, floor, x, z) {
  if (Math.abs(x) + Math.abs(z) <= 1) return 'normal';   // the first ring is always plain
  const r = hashFloat(seed, floor, x, z, 13);
  const m = CFG.modifiers;
  if (r < m.normal) return 'normal';
  if (r < m.normal + m.deep) return 'deep';
  if (r < m.normal + m.deep + m.warm) return 'warm';
  return 'sealed';
}

export function setPieceAt(seed, floor, x, z) {
  if (Math.abs(x) + Math.abs(z) <= 1) return null;
  if (hashFloat(seed, floor, x, z, 29) >= 1 / CFG.setPieceEvery) return null;
  return SET_PIECES[hash32(seed, floor, x, z, 31) % SET_PIECES.length];
}

// Everything about a room that is not saved state.
export function roomInfo(seed, floor, x, z, enabled = BIOMES.length) {
  const side = roomSide(floor);
  const cabin = x === 0 && z === 0;
  const biome = biomeAt(seed, floor, x, z, enabled);
  const r = mulberry32(hash32(seed, floor, x, z, 5));
  const [h0, h1] = biome.ceilH;
  const setPiece = cabin ? null : setPieceAt(seed, floor, x, z);
  const modifier = cabin || setPiece ? 'normal' : roomModifier(seed, floor, x, z);
  const tint = 0.9 + r() * 0.2;
  const ceil = cabin ? 3.0 : h0 + r() * (h1 - h0) + (setPiece ? 1.5 : 0);
  const props = [];
  if (!cabin && !setPiece) {
    const n = Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const wallSide = Math.floor(r() * 4);
      const along = (r() < 0.5 ? -1 : 1) * (0.22 + r() * 0.2) * side; // away from the doorway
      const w = 0.5 + r() * 1.2, d = 0.5 + r() * 0.8, h = 0.4 + r() * 1.4;
      const inset = side / 2 - CFG.room.wallT - d / 2 - 0.05;
      let px = 0, pz = 0;
      if (wallSide === 0) { px = along; pz = -inset; } else if (wallSide === 1) { px = inset; pz = along; }
      else if (wallSide === 2) { px = along; pz = inset; } else { px = -inset; pz = along; }
      const rot = wallSide % 2 === 1;
      props.push({ kind: ['box', 'cyl', 'box', 'round'][Math.floor(r() * 4)], x: px, z: pz, w: rot ? d : w, d: rot ? w : d, h,
        color: [0.7 + r() * 0.25, 0.7 + r() * 0.25, 0.7 + r() * 0.25] });
    }
  }
  return { seed, floor, x, z, side, cabin, biome, modifier, setPiece, tint, ceil, props };
}

// Initial clutter units per cell (pure). Heaps around a few pile centres.
export function initialClutter(info) {
  const G = CFG.grid, out = new Float32Array(G * G);
  if (info.cabin || info.modifier === 'warm') return out;
  const mult = CFG.clutterMult[info.modifier] * (info.setPiece ? 0.5 : 1);
  const r = mulberry32(hash32(info.seed, info.floor, info.x, info.z, 17));
  const piles = [];
  const np = 3 + Math.floor(r() * 3);
  for (let i = 0; i < np; i++) piles.push([r() * G, r() * G, 2 + r() * 4]);
  const cell = info.side / G;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    let v = 0.45 + r() * 0.25;
    for (const [px, pz, pr] of piles) {
      const d2 = ((i + 0.5 - px) ** 2 + (j + 0.5 - pz) ** 2) / (pr * pr);
      v += 0.9 * Math.exp(-d2);
    }
    // keep clutter off props
    const lx = (i + 0.5) * cell - info.side / 2, lz = (j + 0.5) * cell - info.side / 2;
    for (const p of info.props) if (Math.abs(lx - p.x) < p.w / 2 + 0.15 && Math.abs(lz - p.z) < p.d / 2 + 0.15) v = 0;
    out[j * G + i] = Math.min(v, 1.6) * mult;
  }
  return out;
}

// Cells covered by props: they start and stay polished.
export function propCells(info) {
  const G = CFG.grid, cell = info.side / G, out = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const lx = (i + 0.5) * cell - info.side / 2, lz = (j + 0.5) * cell - info.side / 2;
    for (const p of info.props) if (Math.abs(lx - p.x) < p.w / 2 + 0.15 && Math.abs(lz - p.z) < p.d / 2 + 0.15) { out.push(j * G + i); break; }
  }
  return out;
}

// Rare finds: one cell in 500 hides a catalog entry.
export function rareCell(info) {
  if (info.cabin || info.modifier === 'warm') return -1;
  const G = CFG.grid;
  for (let k = 0; k < G * G; k++) if (hashFloat(info.seed, info.floor, info.x, info.z, k, 41) < CFG.clear.rareChance) return k;
  return -1;
}
export const RARE_FINDS = ['marble', 'key', 'button', 'shell', 'ribbon', 'thimble', 'feather', 'pebble', 'bell', 'star'];
export const rareKind = (info, cell) => RARE_FINDS[hash32(info.seed, info.floor, info.x, info.z, cell, 43) % RARE_FINDS.length];

export const roomKey = (floor, x, z) => `${floor}:${x}:${z}`;
export const parseKey = (k) => k.split(':').map(Number);
