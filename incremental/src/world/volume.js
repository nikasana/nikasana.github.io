// Destructible ice volume: chunked density field, edits, heightmap persistence, worker meshing.
import * as THREE from 'three';
import {
  VOXEL, CHUNK, CHUNK_M, DOMAIN_CHUNKS, HALF, MARGIN, HM_RES, ISO, GRAD,
  surfaceY, generateChunk, sampleHeightmap, inDomain, setFieldSeed, fieldNoise, idx, protectedAt,
} from './field.js';
import { P, PAD } from './mesher.js';
import { clamp } from '../core/rng.js';

export const LAYER_ICE = 1;

const C3 = CHUNK * CHUNK * CHUNK;
export const keyOf = (cx, cy, cz) => ((cx + 512) * 1024 + (cz + 512)) * 8192 + (cy + 4096);
const unkey = (k) => { const cy = (k % 8192) - 4096, r = Math.floor(k / 8192); return [Math.floor(r / 1024) - 512, cy, (r % 1024) - 512]; };
const occ = (d) => clamp((d - ISO) / GRAD + 0.5, 0, 1);

export class IceVolume {
  constructor(scene, material, seed) {
    this.scene = scene;
    this.material = material;
    this.seed = seed;
    setFieldSeed(seed);
    this.hm = new Float32Array(HM_RES * HM_RES);
    this.chunks = new Map();
    this.group = new THREE.Group();
    this.group.name = 'ice';
    scene.add(this.group);
    this.queue = new Set();
    this.inflight = new Map();
    this.nextJob = 1;
    this.listeners = { load: [], drop: [], edit: [] };
    this.edited = new Map();   // chunk key -> exact density of every chunk ever edited (survives unloading and saves)
    this.window = { cyMin: -2, cyMax: 1 };
    this.keepMeshDist = 170;
    this.maxDepthDug = 0;
    const n = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    this.workers = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./mesher.worker.js', import.meta.url), { type: 'module' });
      w.busy = false;
      w.onmessage = (ev) => this.onMeshed(w, ev.data);
      this.workers.push(w);
    }
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev]) f(...a); }

  // ---------- chunks ----------

  static chunkInDomain(cx, cz) {
    const h = DOMAIN_CHUNKS / 2;
    return cx >= -h && cx < h && cz >= -h && cz < h;
  }

  getChunk(cx, cy, cz, create = true) {
    const k = keyOf(cx, cy, cz);
    let c = this.chunks.get(k);
    if (c && c.data) return c;
    if (!create) return c || null;
    if (!c) {
      c = { key: k, cx, cy, cz, data: null, solid: 0, mesh: null, dirty: true, version: 0, meshedVersion: -1, inDomain: IceVolume.chunkInDomain(cx, cz) };
      this.chunks.set(k, c);
    }
    const kept = this.edited.get(k);
    if (kept) { c.data = kept; c.edited = true; recount(c); }
    else { const g = generateChunk(cx, cy, cz, this.hm); c.data = g.data; c.solid = g.solid; }
    c.version++;
    c.dirty = true;
    if (c.inDomain) this.emit('load', c);
    return c;
  }

  // Raw padded density sample in voxel coordinates (global voxel indices).
  densityAtVoxel(gi, gj, gk) {
    const cx = Math.floor(gi / CHUNK), cy = Math.floor(gj / CHUNK), cz = Math.floor(gk / CHUNK);
    let c = this._last;
    if (!c || c.cx !== cx || c.cy !== cy || c.cz !== cz || !c.data) {
      c = this.chunks.get(keyOf(cx, cy, cz));
      if (c && c.data) this._last = c;
    }
    if (c && c.data) return c.data[idx(gi - cx * CHUNK, gj - cy * CHUNK, gk - cz * CHUNK)];
    const kept = this.edited.get(keyOf(cx, cy, cz));
    if (kept) return kept[idx(gi - cx * CHUNK, gj - cy * CHUNK, gk - cz * CHUNK)];
    // not loaded: analytic from heightmap
    const x = gi * VOXEL, y = gj * VOXEL, z = gk * VOXEL;
    const top = surfaceY(x, z) - (inDomain(x, z, MARGIN) ? sampleHeightmap(this.hm, x, z) : 0);
    return clamp(ISO + ((top - y) / VOXEL) * GRAD, 0, 255);
  }

  // Trilinear density at a world point (0..255).
  sample(x, y, z) {
    const fx = x / VOXEL, fy = y / VOXEL, fz = z / VOXEL;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    const tx = fx - i, ty = fy - j, tz = fz - k;
    const d = (a, b, c) => this.densityAtVoxel(i + a, j + b, k + c);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(d(0, 0, 0), d(1, 0, 0), tx), l(d(0, 0, 1), d(1, 0, 1), tx), tz),
      l(l(d(0, 1, 0), d(1, 1, 0), tx), l(d(0, 1, 1), d(1, 1, 1), tx), tz),
      ty,
    );
  }

  // Approximate signed distance (m), positive inside ice.
  sdf(x, y, z) { return ((this.sample(x, y, z) - ISO) / GRAD) * VOXEL; }

  normalAt(x, y, z, out = new THREE.Vector3()) {
    const h = VOXEL * 0.5;
    out.set(
      this.sample(x - h, y, z) - this.sample(x + h, y, z),
      this.sample(x, y - h, z) - this.sample(x, y + h, z),
      this.sample(x, y, z - h) - this.sample(x, y, z + h),
    );
    if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
    return out.normalize();
  }

  raycast(origin, dir, maxDist, step = 0.06) {
    let t = 0, prev = this.sample(origin.x, origin.y, origin.z);
    if (prev >= ISO) return { hit: true, dist: 0, point: origin.clone(), normal: new THREE.Vector3(0, 1, 0) };
    while (t < maxDist) {
      t += step;
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      const d = this.sample(x, y, z);
      if (d >= ISO) {
        const f = (ISO - prev) / (d - prev || 1);
        const tt = t - step + step * f;
        const point = origin.clone().addScaledVector(dir, tt);
        return { hit: true, dist: tt, point, normal: this.normalAt(point.x, point.y, point.z) };
      }
      prev = d;
    }
    return { hit: false, dist: maxDist };
  }

  // ---------- edits ----------

  // op: { kind: 'dig'|'melt'|'fill', x, y, z, r, amount?, level?, seed }
  applyOp(op) {
    const r = op.r;
    const pad = r + VOXEL * 2;
    const lim = HALF - MARGIN;
    const x0 = Math.max(-lim, op.x - pad), x1 = Math.min(lim, op.x + pad);
    const z0 = Math.max(-lim, op.z - pad), z1 = Math.min(lim, op.z + pad);
    const y0 = op.y - pad, y1 = op.y + pad;
    if (x0 >= x1 || z0 >= z1) return { removed: 0, added: 0 };
    const gi0 = Math.ceil(x0 / VOXEL), gi1 = Math.floor(x1 / VOXEL);
    const gj0 = Math.ceil(y0 / VOXEL), gj1 = Math.floor(y1 / VOXEL);
    const gk0 = Math.ceil(z0 / VOXEL), gk1 = Math.floor(z1 / VOXEL);
    const noise = fieldNoise();
    let removed = 0, added = 0;
    const touched = new Set();
    const rough = op.kind === 'dig' ? 0.2 : 0.06;
    const ns = 1 / Math.max(0.35, r * 0.6);
    const amount = op.amount ?? 0;
    for (let gj = gj0; gj <= gj1; gj++) {
      const cy = Math.floor(gj / CHUNK);
      for (let gk = gk0; gk <= gk1; gk++) {
        const cz = Math.floor(gk / CHUNK);
        for (let gi = gi0; gi <= gi1; gi++) {
          const cx = Math.floor(gi / CHUNK);
          const c = this.getChunk(cx, cy, cz);
          const li = idx(gi - cx * CHUNK, gj - cy * CHUNK, gk - cz * CHUNK);
          const old = c.data[li];
          const x = gi * VOXEL, y = gj * VOXEL, z = gk * VOXEL;
          const dx = x - op.x, dy = y - op.y, dz = z - op.z;
          if (op.kind !== 'fill' && protectedAt(x, y, z)) continue;
          let nd = old;
          if (op.kind === 'dig') {
            if (old === 0) continue;
            const n = noise.n3(x * ns * 2.1 + op.seed, y * ns * 2.1, z * ns * 2.1) * rough * r;
            const s = Math.sqrt(dx * dx + dy * dy * 1.15 + dz * dz) - r - n;
            nd = Math.min(old, clamp(ISO + (s / VOXEL) * GRAD, 0, 255));
          } else if (op.kind === 'melt') {
            if (old === 0) continue;
            const dist = Math.sqrt(dx * dx + dy * dy * 0.8 + dz * dz);
            if (dist > r) continue;
            const f = 1 - dist / r;
            nd = Math.max(0, old - amount * f);
          } else if (op.kind === 'fill') {
            if (y > op.level) continue;
            const s = Math.hypot(dx, dz) - r;
            const sd = Math.max(s, y - op.level);
            nd = Math.max(old, clamp(ISO - (sd / VOXEL) * GRAD, 0, 255));
          }
          nd = nd | 0;
          if (nd === old) continue;
          const dv = occ(old) - occ(nd);
          if (dv > 0) removed += dv; else added -= dv;
          this.writeVoxel(c, gi, gj, gk, nd, touched);
        }
      }
    }
    // Overlapping craters leave one-voxel ridges and plates that are hard to see, aim at or break:
    // erode any solid sample that has open space on both sides along an axis, or almost no solid neighbours.
    if (op.kind === 'dig' || op.kind === 'melt') {
      for (let pass = 0; pass < 2; pass++) {
        for (let gj = gj0 - 1; gj <= gj1 + 1; gj++) for (let gk = gk0 - 1; gk <= gk1 + 1; gk++) for (let gi = gi0 - 1; gi <= gi1 + 1; gi++) {
          if (Math.abs(gi * VOXEL) > lim || Math.abs(gk * VOXEL) > lim) continue;
          const v = this.densityAtVoxel(gi, gj, gk);
          if (v < ISO || protectedAt(gi * VOXEL, gj * VOXEL, gk * VOXEL)) continue;
          const xm = this.densityAtVoxel(gi - 1, gj, gk) < ISO, xp = this.densityAtVoxel(gi + 1, gj, gk) < ISO;
          const ym = this.densityAtVoxel(gi, gj - 1, gk) < ISO, yp = this.densityAtVoxel(gi, gj + 1, gk) < ISO;
          const zm = this.densityAtVoxel(gi, gj, gk - 1) < ISO, zp = this.densityAtVoxel(gi, gj, gk + 1) < ISO;
          const open = xm + xp + ym + yp + zm + zp;
          if (!((xm && xp) || (ym && yp) || (zm && zp) || open >= 5)) continue;
          const cx = Math.floor(gi / CHUNK), cy = Math.floor(gj / CHUNK), cz = Math.floor(gk / CHUNK);
          const c = this.getChunk(cx, cy, cz);
          const nd = ISO - 30;
          removed += occ(v) - occ(nd);
          this.writeVoxel(c, gi, gj, gk, nd, touched);
        }
      }
    }
    for (const c of touched) {
      c.version++;
      c.dirty = true;
      c.priority = true;
      this.queue.add(c);
    }
    removed *= VOXEL ** 3;
    added *= VOXEL ** 3;
    this.updateColumns(x0, x1, z0, z1, y0);
    const res = { removed, added, bounds: { x0, x1, y0, y1, z0, z1 } };
    this.emit('edit', op, res);
    return res;
  }

  writeVoxel(c, gi, gj, gk, v, touched) {
    const cx = c.cx, cy = c.cy, cz = c.cz;
    const lx = gi - cx * CHUNK, ly = gj - cy * CHUNK, lz = gk - cz * CHUNK;
    c.data[idx(lx, ly, lz)] = v;
    if (!c.edited) { c.edited = true; this.edited.set(c.key, c.data); }
    touched.add(c);
    // samples near a chunk face live in a neighbour's padding too
    if (lx < PAD || lx >= CHUNK - PAD || ly < PAD || ly >= CHUNK - PAD || lz < PAD || lz >= CHUNK - PAD) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
        if ((a && !(a < 0 ? lx < PAD : lx >= CHUNK - PAD)) || (b && !(b < 0 ? ly < PAD : ly >= CHUNK - PAD)) || (e && !(e < 0 ? lz < PAD : lz >= CHUNK - PAD))) continue;
        const nc = this.chunks.get(keyOf(cx + a, cy + b, cz + e));
        if (nc) touched.add(nc);
      }
    }
  }

  // Recompute carved depth for heightmap columns in a box (first solid voxel from the top).
  updateColumns(x0, x1, z0, z1, yBottom) {
    const i0 = clamp(Math.floor((x0 + HALF) / VOXEL), 0, HM_RES - 1), i1 = clamp(Math.ceil((x1 + HALF) / VOXEL), 0, HM_RES - 1);
    const k0 = clamp(Math.floor((z0 + HALF) / VOXEL), 0, HM_RES - 1), k1 = clamp(Math.ceil((z1 + HALF) / VOXEL), 0, HM_RES - 1);
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const x = -HALF + (i + 0.5) * VOXEL, z = -HALF + (k + 0.5) * VOXEL;
      if (!inDomain(x, z, MARGIN)) continue;
      const top = surfaceY(x, z);
      let y = top + VOXEL;
      const floor = Math.min(yBottom, top - this.hm[k * HM_RES + i]) - VOXEL * 2;
      let found = null;
      while (y > floor) {
        if (this.sample(x, y, z) >= ISO) { found = y; break; }
        y -= VOXEL * 0.5;
      }
      const depth = Math.max(0, top - (found ?? floor));
      this.hm[k * HM_RES + i] = depth;
      if (depth > this.maxDepthDug) this.maxDepthDug = depth;
    }
  }

  // Deepest floor near a point (for the lift beacon and depth readouts).
  floorBelow(x, y, z, maxDown = 400) {
    let t = 0;
    while (t < maxDown) {
      if (this.sample(x, y - t, z) >= ISO) return y - t;
      t += 0.25;
    }
    return y - maxDown;
  }

  craterDepth() {
    let m = 0;
    for (let i = 0; i < this.hm.length; i++) if (this.hm[i] > m) m = this.hm[i];
    this.maxDepthDug = m;
    return m;
  }

  // ---------- streaming ----------

  update(camPos, budgetMs = 4) {
    const pcy = Math.floor(camPos.y / CHUNK_M);
    const nearSurface = camPos.y > -40;
    const cyMin = pcy - 3, cyMax = Math.max(pcy + 4, nearSurface ? 0 : -1e9);
    const cyLo = nearSurface ? Math.min(cyMin, -2) : cyMin;
    this.window = { cyMin: cyLo, cyMax };
    const h = DOMAIN_CHUNKS / 2;
    const t0 = performance.now();
    // load in-window chunks nearest first
    const want = [];
    for (let cy = cyLo; cy <= cyMax; cy++) for (let cz = -h; cz < h; cz++) for (let cx = -h; cx < h; cx++) {
      const c = this.chunks.get(keyOf(cx, cy, cz));
      if (c && c.data) continue;
      const dy = (cy + 0.5) * CHUNK_M - camPos.y, dx = (cx + 0.5) * CHUNK_M - camPos.x, dz = (cz + 0.5) * CHUNK_M - camPos.z;
      want.push([dx * dx + dy * dy * 2 + dz * dz, cx, cy, cz]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cy, cz] of want) {
      const c = this.getChunk(cx, cy, cz);
      this.queue.add(c);
      if (performance.now() - t0 > budgetMs) break;
    }
    // drop data outside the window; dispose far meshes
    for (const c of this.chunks.values()) {
      const out = c.cy < cyLo - 1 || c.cy > cyMax + 1;
      if (out && c.data && !this.inflightChunk(c)) {
        this.emit('drop', c);
        c.data = null;
        c.dirty = true;
        this.queue.delete(c);
      }
      if (c.mesh) {
        const dy = Math.abs((c.cy + 0.5) * CHUNK_M - camPos.y);
        if (dy > this.keepMeshDist) this.disposeMesh(c);
        c.mesh && (c.mesh.visible = dy < this.keepMeshDist);
      }
      if (!c.data && !c.mesh) this.chunks.delete(c.key);
    }
    this.pump(camPos);
  }

  inflightChunk(c) { for (const v of this.inflight.values()) if (v.c === c) return true; return false; }

  // Send queued chunks to idle workers, edited chunks first, then nearest.
  pump(camPos = this.lastCam) {
    if (!camPos) return;
    this.lastCam = camPos;
    if (!this.queue.size) return;
    const idle = this.workers.filter((w) => !w.busy);
    if (!idle.length) return;
    const list = [...this.queue].filter((c) => c.data && c.inDomain && !this.inflightChunk(c));
    list.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || distSq(a, camPos) - distSq(b, camPos));
    const t0 = performance.now();
    for (const w of idle) {
      let c = null;
      // uniform chunks (all ice or all air, with matching neighbours) need no mesh: settle them inline
      while (list.length) {
        const cand = list.shift();
        this.queue.delete(cand);
        if (performance.now() - t0 < 3 && this.isUniform(cand)) { cand.dirty = false; cand.meshedVersion = cand.version; this.disposeMesh(cand); continue; }
        c = cand;
        break;
      }
      if (!c) break;
      const dens = this.gatherPadded(c);
      const id = this.nextJob++;
      this.inflight.set(id, { c, version: c.version });
      c.priority = false;
      w.busy = true;
      w.postMessage({ id, dens, ox: c.cx * CHUNK_M, oy: c.cy * CHUNK_M, oz: c.cz * CHUNK_M, seed: this.seed }, [dens.buffer]);
    }
  }

  isUniform(c) {
    if (c.solid !== 0 && c.solid !== C3) return false;
    const full = c.solid === C3;
    for (const [a, b, e] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = this.chunks.get(keyOf(c.cx + a, c.cy + b, c.cz + e));
      if (n && n.data) {
        recount(n);
        if ((n.solid === C3) !== full || (n.solid !== 0 && n.solid !== C3)) return false;
      } else {
        // unloaded neighbour: check analytic samples on the shared face
        const ox = (c.cx + a * 0.5 + 0.5) * CHUNK_M, oy = (c.cy + b * 0.5 + 0.5) * CHUNK_M, oz = (c.cz + e * 0.5 + 0.5) * CHUNK_M;
        if ((this.sample(ox, oy, oz) >= ISO) !== full) return false;
      }
    }
    recount(c);
    return c.solid === 0 || c.solid === C3;
  }

  gatherPadded(c) {
    const dens = new Uint8Array(P * P * P);
    const bi = c.cx * CHUNK, bj = c.cy * CHUNK, bk = c.cz * CHUNK;
    const cache = new Map();
    const blockOf = (cx, cy, cz) => {
      const k = keyOf(cx, cy, cz);
      if (cache.has(k)) return cache.get(k);
      let ch = this.chunks.get(k);
      let d = ch && ch.data;
      if (!d) d = this.edited.get(k) || generateChunk(cx, cy, cz, this.hm).data;
      cache.set(k, d);
      return d;
    };
    for (let j = -PAD; j < CHUNK + PAD; j++) {
      const gj = bj + j, cy = Math.floor(gj / CHUNK), lj = gj - cy * CHUNK;
      for (let k = -PAD; k < CHUNK + PAD; k++) {
        const gk = bk + k, cz = Math.floor(gk / CHUNK), lk = gk - cz * CHUNK;
        for (let i = -PAD; i < CHUNK + PAD; i++) {
          const gi = bi + i, cx = Math.floor(gi / CHUNK), li = gi - cx * CHUNK;
          const d = (cx === c.cx && cy === c.cy && cz === c.cz) ? c.data : blockOf(cx, cy, cz);
          dens[(i + PAD) + P * ((k + PAD) + P * (j + PAD))] = d[idx(li, lj, lk)];
        }
      }
    }
    return dens;
  }

  onMeshed(w, msg) {
    w.busy = false;
    const job = this.inflight.get(msg.id);
    this.inflight.delete(msg.id);
    this.pump();
    if (!job) return;
    const c = job.c;
    if (!this.chunks.has(c.key)) return;
    if (job.version !== c.version) this.queue.add(c);
    c.meshedVersion = job.version;
    c.dirty = c.version !== job.version;
    if (!msg.indices.length) { this.disposeMesh(c); return; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(msg.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(msg.normals, 3));
    g.setAttribute('iceAttr', new THREE.BufferAttribute(msg.attribs, 2));
    g.setIndex(new THREE.BufferAttribute(msg.indices, 1));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-VOXEL, -VOXEL, -VOXEL), new THREE.Vector3(CHUNK_M + VOXEL, CHUNK_M + VOXEL, CHUNK_M + VOXEL));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(CHUNK_M / 2, CHUNK_M / 2, CHUNK_M / 2), CHUNK_M);
    if (c.mesh) {
      c.mesh.geometry.dispose();
      c.mesh.geometry = g;
    } else {
      const m = new THREE.Mesh(g, this.material);
      m.position.set(c.cx * CHUNK_M, c.cy * CHUNK_M, c.cz * CHUNK_M);
      m.castShadow = true;
      m.receiveShadow = true;
      m.layers.set(LAYER_ICE);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      c.mesh = m;
      this.group.add(m);
    }
  }

  disposeMesh(c) {
    if (!c.mesh) return;
    this.group.remove(c.mesh);
    c.mesh.geometry.dispose();
    c.mesh = null;
  }

  pending() { return this.queue.size + this.inflight.size; }

  // ---------- persistence ----------

  serialize() {
    // carved depth per column, quantised to 5 cm
    const q = new Uint16Array(this.hm.length);
    for (let i = 0; i < q.length; i++) q[i] = Math.min(65535, Math.round(this.hm[i] * 20));
    return u16ToB64(q);
  }

  load(b64) {
    this.reset();
    if (!b64) return;
    const q = b64ToU16(b64);
    if (q.length !== this.hm.length) return;
    for (let i = 0; i < q.length; i++) this.hm[i] = q[i] / 20;
    this.craterDepth();
  }

  // Exact edited chunks, run-length encoded: [cx, cy, cz, base64] per chunk.
  serializeEdits() {
    const out = [];
    for (const [k, d] of this.edited) {
      const c = this.chunks.get(k);
      const [cx, cy, cz] = c ? [c.cx, c.cy, c.cz] : unkey(k);
      out.push([cx, cy, cz, rleEncode(d)]);
    }
    return out;
  }

  loadEdits(list) {
    if (!Array.isArray(list)) return;
    for (const [cx, cy, cz, b64] of list) {
      const d = rleDecode(b64, CHUNK * CHUNK * CHUNK);
      if (!d) continue;
      const k = keyOf(cx, cy, cz);
      this.edited.set(k, d);
      const c = this.chunks.get(k);
      if (c && c.data) { c.data = d; c.edited = true; recount(c); c.version++; c.dirty = true; this.queue.add(c); }
    }
  }

  reset() {
    for (const c of this.chunks.values()) { if (c.data && c.inDomain) this.emit('drop', c); this.disposeMesh(c); }
    this.chunks.clear();
    this._last = null;
    this.queue.clear();
    this.inflight.clear();
    for (const w of this.workers) w.busy = false;
    this.hm.fill(0);
    this.edited.clear();
    this.maxDepthDug = 0;
  }

  setSeed(seed) { this.seed = seed; setFieldSeed(seed); }
}

function recount(c) {
  if (!c.data) return;
  let s = 0;
  const d = c.data;
  for (let i = 0; i < d.length; i++) if (d[i] >= ISO) s++;
  c.solid = s;
}

function distSq(c, p) {
  const dx = (c.cx + 0.5) * CHUNK_M - p.x, dy = (c.cy + 0.5) * CHUNK_M - p.y, dz = (c.cz + 0.5) * CHUNK_M - p.z;
  return dx * dx + dy * dy + dz * dz;
}

function u16ToB64(u) {
  // simple run-length on zeros keeps fresh saves tiny
  const out = [];
  for (let i = 0; i < u.length;) {
    if (u[i] === 0) { let n = 0; while (i < u.length && u[i] === 0 && n < 65535) { n++; i++; } out.push(0, n); }
    else { out.push(u[i]); i++; }
  }
  const b = new Uint8Array(new Uint16Array(out).buffer);
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return btoa(s);
}

function b64ToU16(s) {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const rl = new Uint16Array(b.buffer, 0, b.length >> 1);
  const out = [];
  for (let i = 0; i < rl.length; i++) {
    if (rl[i] === 0) { const n = rl[++i]; for (let k = 0; k < n; k++) out.push(0); }
    else out.push(rl[i]);
  }
  return new Uint16Array(out);
}

function rleEncode(d) {
  const out = [];
  for (let i = 0; i < d.length;) {
    const v = d[i];
    let n = 1;
    while (i + n < d.length && d[i + n] === v && n < 255) n++;
    out.push(v, n);
    i += n;
  }
  let bin = '';
  for (const b of out) bin += String.fromCharCode(b);
  return btoa(bin);
}

function rleDecode(b64, len) {
  try {
    const bin = atob(b64);
    const d = new Uint8Array(len);
    let o = 0;
    for (let i = 0; i + 1 < bin.length; i += 2) {
      const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1);
      d.fill(v, o, Math.min(len, o + n));
      o += n;
    }
    return o === len ? d : null;
  } catch { return null; }
}
