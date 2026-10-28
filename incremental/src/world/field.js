// Pure world-field functions shared by the main thread and the mesher worker.
// The dig domain is a square patch of the ice sheet at the pole. Inside it the ice is a
// destructible density volume; outside it is an analytic snow surface.
import { makeNoise, clamp } from '../core/rng.js';

export const VOXEL = 0.5;            // m per voxel
export const CHUNK = 16;             // voxels per chunk edge
export const CHUNK_M = CHUNK * VOXEL; // 8 m
export const DOMAIN_CHUNKS = 8;      // chunks across the domain
export const HALF = (DOMAIN_CHUNKS * CHUNK_M) / 2; // 32 m
export const MARGIN = 1.5;           // m of untouchable wall at the domain edge
export const HM_RES = DOMAIN_CHUNKS * CHUNK; // heightmap cells per side (128)
export const ISO = 128;
export const GRAD = 100;             // density units per voxel of signed distance

let noise = makeNoise(1701);
let seedNow = 1701;
export function setFieldSeed(seed) { if (seed !== seedNow) { noise = makeNoise(seed); seedNow = seed; } }
export function fieldNoise() { return noise; }

// Snow surface height (m). Gentle wind-carved sastrugi near the crater, rolling plains further out,
// rising toward distant ridges.
export function surfaceY(x, z) {
  const r = Math.hypot(x, z);
  // the camp (claim, vault, Outfitter's hut) stands on a flat, wind-packed field so nothing low is hidden
  // behind a ridge; the wind ridges and rolling ground start beyond it
  const camp = clamp((r - 55) / 25, 0, 1);
  const sas = noise.fbm2(x * 0.11 + 3.1, z * 0.035 - 1.7, 3) * 0.22 * (0.25 + 0.75 * camp);   // elongated wind ridges
  const roll = noise.fbm2(x * 0.008, z * 0.008, 4) * 3.5 * clamp((r - 55) / 90, 0, 1);
  // a far range of broad, ridged massifs
  const t = clamp((r - 700) / 1100, 0, 1);
  let mount = 0;
  if (t > 0) {
    const rid = 1 - Math.abs(noise.fbm2(x * 0.0011 + 9, z * 0.0011 - 4, 5));
    const base = 0.5 + 0.5 * noise.fbm2(x * 0.0005 - 2, z * 0.0005 + 7, 3);
    mount = t * t * (3 - 2 * t) * (90 + 330 * rid * rid * base);
  }
  return sas + roll + mount;
}

// Richness (0..1): veins of coin-rich ice running through the volume.
// The Outfitter's hut stands on a pad of ground that cannot be dug away.
export const OUTFITTER = { x: -5.5, z: 9.5, r: 3.6 };
// The depot, where you deliver your pack, stands next to it on its own pad.
export const DEPOT = { x: -12.2, z: 9.0, r: 3.4 };
export const protectedAt = (x, y, z) => (Math.hypot(x - OUTFITTER.x, z - OUTFITTER.z) < OUTFITTER.r && y > surfaceY(OUTFITTER.x, OUTFITTER.z) - 6)
  || (Math.hypot(x - DEPOT.x, z - DEPOT.z) < DEPOT.r && y > surfaceY(DEPOT.x, DEPOT.z) - 6);

export function richness(x, y, z) {
  const v = noise.fbm3(x * 0.07, y * 0.09, z * 0.07, 3);
  const vein = 1 - Math.abs(noise.n3(x * 0.035 + 11, y * 0.05, z * 0.035 - 7));
  // coins gather in horizontal seams about every 5.5 m that wander up and down a little:
  // following a seam sideways pays better than digging straight down through the barren ice between
  const band = -y / 5.5 + noise.n3(x * 0.04, 3.7, z * 0.04) * 0.6;
  const f = band - Math.floor(band) - 0.5;
  const seam = Math.exp(-(f * f) / (2 * 0.075 * 0.075));
  return clamp(0.12 + v * 0.3 + (vein - 0.75) * 0.5 + seam * 0.8, 0, 1);
}

// Heightmap of carved depth below the original surface, HM_RES x HM_RES over [-HALF, HALF).
export function sampleHeightmap(hm, x, z) {
  const fx = (x + HALF) / VOXEL - 0.5, fz = (z + HALF) / VOXEL - 0.5;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const g = (i, j) => {
    i = i < 0 ? 0 : i >= HM_RES ? HM_RES - 1 : i;
    j = j < 0 ? 0 : j >= HM_RES ? HM_RES - 1 : j;
    return hm[j * HM_RES + i];
  };
  const a = g(ix, iz), b = g(ix + 1, iz), c = g(ix, iz + 1), d = g(ix + 1, iz + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

export function inDomain(x, z, margin = 0) {
  return Math.abs(x) < HALF - margin && Math.abs(z) < HALF - margin;
}

// Generate the density for one chunk (CHUNK^3 samples at voxel corners) from the heightmap.
export function generateChunk(cx, cy, cz, hm) {
  const data = new Uint8Array(CHUNK * CHUNK * CHUNK);
  const ox = cx * CHUNK_M, oy = cy * CHUNK_M, oz = cz * CHUNK_M;
  let solid = 0;
  const tops = new Float32Array(CHUNK * CHUNK);
  for (let k = 0; k < CHUNK; k++) for (let i = 0; i < CHUNK; i++) {
    const x = ox + i * VOXEL, z = oz + k * VOXEL;
    const edge = !inDomain(x, z, MARGIN);
    tops[k * CHUNK + i] = surfaceY(x, z) - (edge || !hm ? 0 : sampleHeightmap(hm, x, z));
  }
  for (let j = 0; j < CHUNK; j++) {
    const y = oy + j * VOXEL;
    for (let k = 0; k < CHUNK; k++) for (let i = 0; i < CHUNK; i++) {
      const top = tops[k * CHUNK + i];
      const d = clamp(ISO + ((top - y) / VOXEL) * GRAD, 0, 255) | 0;
      data[i + CHUNK * (k + CHUNK * j)] = d;
      if (d >= ISO) solid++;
    }
  }
  return { data, solid };
}

export const idx = (i, j, k) => i + CHUNK * (k + CHUNK * j);
