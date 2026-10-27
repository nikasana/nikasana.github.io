// Surface-nets mesher. Pure: runs in the worker (and in Node for tests).
// Input: padded density samples covering [-PAD, CHUNK + PAD - 1] per axis (PAD = 2).
// Output: chunk-local positions (m), normals, per-vertex [richness, cavity], triangle indices.
import { CHUNK, VOXEL, ISO, richness } from './field.js';

export const PAD = 2;
export const P = CHUNK + 4; // samples per padded axis (20)

const at = (d, i, j, k) => d[(i + PAD) + P * ((k + PAD) + P * (j + PAD))];

const CUBE_EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7], // x edges
  [0, 2], [1, 3], [4, 6], [5, 7], // y edges? (see corner layout below)
  [0, 4], [1, 5], [2, 6], [3, 7],
];
// corner c: bit0 = +x, bit1 = +y, bit2 = +z
const CORNER = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

export function meshChunk(dens, ox, oy, oz) {
  // cells from -1..CHUNK-1 on each axis -> CHUNK+1 cells
  const C = CHUNK + 1;
  const vmap = new Int32Array(C * C * C).fill(-1);
  const pos = [], nrm = [], att = [];
  const cv = new Float32Array(8);
  let nv = 0;

  for (let j = -1; j < CHUNK; j++) for (let k = -1; k < CHUNK; k++) for (let i = -1; i < CHUNK; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = at(dens, i + CORNER[c][0], j + CORNER[c][1], k + CORNER[c][2]);
      cv[c] = v;
      if (v >= ISO) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of CUBE_EDGES) {
      const ia = cv[a] >= ISO, ib = cv[b] >= ISO;
      if (ia === ib) continue;
      const t = (ISO - cv[a]) / (cv[b] - cv[a]);
      sx += CORNER[a][0] + (CORNER[b][0] - CORNER[a][0]) * t;
      sy += CORNER[a][1] + (CORNER[b][1] - CORNER[a][1]) * t;
      sz += CORNER[a][2] + (CORNER[b][2] - CORNER[a][2]) * t;
      n++;
    }
    const lx = i + sx / n, ly = j + sy / n, lz = k + sz / n;
    // gradient by central differences of trilinear field at the vertex
    const g = gradient(dens, lx, ly, lz);
    const gl = Math.hypot(g[0], g[1], g[2]) || 1;
    pos.push(lx * VOXEL, ly * VOXEL, lz * VOXEL);
    nrm.push(-g[0] / gl, -g[1] / gl, -g[2] / gl);
    const wx = ox + lx * VOXEL, wy = oy + ly * VOXEL, wz = oz + lz * VOXEL;
    att.push(richness(wx, wy, wz), cavity(dens, i, j, k));
    vmap[(i + 1) + C * ((k + 1) + C * (j + 1))] = nv++;
  }

  const idx = [];
  const V = (i, j, k) => vmap[(i + 1) + C * ((k + 1) + C * (j + 1))];
  // For each sample point p in [0, CHUNK) and axis, look at the edge p -> p + axis.
  for (let j = 0; j < CHUNK; j++) for (let k = 0; k < CHUNK; k++) for (let i = 0; i < CHUNK; i++) {
    const d0 = at(dens, i, j, k) >= ISO;
    // x edge: cells around it share (j-1..j, k-1..k)
    if ((at(dens, i + 1, j, k) >= ISO) !== d0) quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), d0);
    if ((at(dens, i, j + 1, k) >= ISO) !== d0) quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), d0);
    if ((at(dens, i, j, k + 1) >= ISO) !== d0) quad(V(i - 1, j - 1, k), V(i - 1, j, k), V(i, j, k), V(i, j - 1, k), !d0);
  }

  function quad(a, b, c, d, flip) {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // split along the shorter diagonal
    const dac = dist2(a, c), dbd = dist2(b, d);
    if (dac < dbd) {
      if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    } else {
      if (flip) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
  }
  function dist2(a, b) {
    const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    attribs: new Float32Array(att),
    indices: nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
  };
}

function tri(d, x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const tx = x - i, ty = y - j, tz = z - k;
  const c = (a, b, t) => a + (b - a) * t;
  const s = (ii, jj, kk) => at(d, Math.max(-PAD, Math.min(CHUNK + 1, ii)), Math.max(-PAD, Math.min(CHUNK + 1, jj)), Math.max(-PAD, Math.min(CHUNK + 1, kk)));
  return c(
    c(c(s(i, j, k), s(i + 1, j, k), tx), c(s(i, j, k + 1), s(i + 1, j, k + 1), tx), tz),
    c(c(s(i, j + 1, k), s(i + 1, j + 1, k), tx), c(s(i, j + 1, k + 1), s(i + 1, j + 1, k + 1), tx), tz),
    ty,
  );
}

function gradient(d, x, y, z) {
  const h = 0.5;
  return [
    tri(d, x + h, y, z) - tri(d, x - h, y, z),
    tri(d, x, y + h, z) - tri(d, x, y - h, z),
    tri(d, x, y, z + h) - tri(d, x, y, z - h),
  ];
}

// How enclosed a vertex is: share of solid samples in the 4x4x4 neighbourhood (crevices -> high).
function cavity(d, i, j, k) {
  let s = 0, n = 0;
  for (let jj = -1; jj <= 2; jj++) for (let kk = -1; kk <= 2; kk++) for (let ii = -1; ii <= 2; ii++) {
    const x = i + ii, y = j + jj, z = k + kk;
    if (x < -PAD || y < -PAD || z < -PAD || x > CHUNK + 1 || y > CHUNK + 1 || z > CHUNK + 1) continue;
    s += at(d, x, y, z) >= ISO ? 1 : 0; n++;
  }
  return n ? s / n : 0.5;
}
