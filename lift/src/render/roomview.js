// Three.js view of one room: floor (cell texture), walls with doorways, ceiling, props, lamp, switch, clutter.
// Visual detail follows the graphics level q (see CFG.quality).
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/addons/utils/BufferGeometryUtils.js';
import { CFG, doorWidth } from '../config.js';

const G = CFG.grid;
const DUSK = new THREE.Color(0.56, 0.64, 0.86);
const WARMDUSK = new THREE.Color(0.82, 0.70, 0.56);
const WARM = new THREE.Color(1.0, 0.84, 0.62);
const TMP = new THREE.Color();

const geoCache = {};
// detail: 0 low (levels 1-2), 1 medium (level 3), 2 high (levels 4-5)
export function itemGeometry(kind, detail = 1) {
  const key = kind + detail;
  if (geoCache[key]) return geoCache[key];
  let g;
  switch (kind) {
    case 'ball': g = new THREE.IcosahedronGeometry(1, detail); break;
    case 'foam': g = new THREE.IcosahedronGeometry(1, Math.max(0, detail - 1)); break;
    case 'paper': g = new THREE.BoxGeometry(1.4, 0.05, 1.0); break;
    case 'leaf': { g = new THREE.CircleGeometry(1, detail ? 7 : 5); g.scale(1.1, 0.6, 1); g.rotateX(-Math.PI / 2); break; }
    case 'book': g = new THREE.BoxGeometry(1.3, 0.45, 1.0); break;
    case 'popcorn': g = detail ? new THREE.DodecahedronGeometry(1, 0) : new THREE.OctahedronGeometry(1, 0); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  geoCache[key] = g; return g;
}
export const detailFor = (q) => (q.id <= 2 ? 0 : q.id === 3 ? 1 : 2);
const ITEM_ROUGH = { ball: 0.28, foam: 0.55, paper: 0.9, leaf: 0.7, book: 0.75, popcorn: 0.85 };

function hashf(a, b, c) { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x1b873593, 0x27d4eb2f); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }

export function makeMat(q, opts) {
  if (q.std) return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.22, ...opts });
  const { roughness, metalness, roughnessMap, envMapIntensity, ...rest } = opts;
  return new THREE.MeshLambertMaterial(rest);
}

// Shared soft glow texture for shafts and motes (generated, not an asset).
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
let shaftGeo = null;
function shaftGeometry() {
  if (shaftGeo) return shaftGeo;
  shaftGeo = new THREE.CylinderGeometry(0.45, 1.6, 1, 24, 1, true);
  shaftGeo.translate(0, -0.5, 0);
  // fade toward the floor via vertex colours
  const pos = shaftGeo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const v = 1 + pos.getY(i); col.set([v, v, v], i * 3); }
  shaftGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return shaftGeo;
}

export class RoomView {
  constructor(info, room, opts) {
    this.info = info; this.room = room; this.opts = opts; this.q = opts.q;
    const q = this.q;
    const S = info.side, half = S / 2;
    this.group = new THREE.Group();
    this.group.position.set(info.x * S, 0, info.z * S);
    const b = info.biome;
    this.baseFloor = new THREE.Color(...b.floor).multiplyScalar(info.tint);
    this.baseWall = new THREE.Color(...b.wall);
    this.baseCeil = new THREE.Color(...b.ceil);
    if (info.cabin) { this.baseFloor = new THREE.Color(0.55, 0.38, 0.26); this.baseWall = new THREE.Color(0.86, 0.74, 0.58); this.baseCeil = new THREE.Color(0.9, 0.82, 0.7); }
    this.warm = room.lit ? 1 : 0;
    this.lampBoost = 1;

    // floor: colour texture + roughness texture (polished = glossy)
    this.tex = new THREE.DataTexture(new Uint8Array(G * G * 4), G, G);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter; this.tex.colorSpace = THREE.SRGBColorSpace;
    const fopts = { map: this.tex };
    if (q.std && q.env) {
      this.rough = new THREE.DataTexture(new Uint8Array(G * G * 4), G, G);
      this.rough.magFilter = THREE.LinearFilter; this.rough.minFilter = THREE.LinearFilter;
      fopts.roughnessMap = this.rough; fopts.roughness = 1; fopts.envMapIntensity = 0.28;
    }
    this.floorMat = makeMat(q, fopts);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // walls: one merged mesh per room
    this.wallMat = makeMat(q, { color: this.baseWall.clone(), roughness: 0.92 });
    const H = info.ceil, T = CFG.room.wallT / 2, dw = doorWidth(S), dh = CFG.room.doorH;
    const seg = half - dw / 2;
    const parts = [], trims = [];
    const box = (w, h, d, x, y, z, list = parts) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };
    for (let side = 0; side < 4; side++) {
      const horiz = side === 0 || side === 2, sign = side === 0 || side === 3 ? -1 : 1;
      const off = sign * (half - T / 2), offIn = sign * (half - T - 0.02);
      for (const s2 of [-1, 1]) {
        const c = s2 * (dw / 2 + seg / 2);
        if (horiz) { box(seg, H, T, c, H / 2, off); box(seg, 0.14, 0.04, c, 0.07, offIn, trims); }
        else { box(T, H, seg, off, H / 2, c); box(0.04, 0.14, seg, offIn, 0.07, c, trims); }
      }
      if (horiz) box(dw, H - dh, T, 0, dh + (H - dh) / 2, off); else box(T, H - dh, dw, off, dh + (H - dh) / 2, 0);
    }
    this.group.add(new THREE.Mesh(mergeGeometries(parts), this.wallMat));
    parts.forEach((g) => g.dispose());
    this.trimMat = makeMat(q, { color: this.baseWall.clone().multiplyScalar(0.62), roughness: 0.6 });
    this.group.add(new THREE.Mesh(mergeGeometries(trims), this.trimMat));
    trims.forEach((g) => g.dispose());

    // doors (shown when shut)
    this.doorMat = makeMat(q, { color: new THREE.Color(0.62, 0.52, 0.42), roughness: 0.7 });
    this.doors = [];
    for (let side = 0; side < 4; side++) {
      const horiz = side === 0 || side === 2, sign = side === 0 || side === 3 ? -1 : 1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? dw : 0.08, dh, horiz ? 0.08 : dw), this.doorMat);
      m.position.set(horiz ? 0 : sign * (half - T / 2 - 0.08), dh / 2, horiz ? sign * (half - T / 2 - 0.08) : 0);
      m.visible = false; this.group.add(m); this.doors.push(m);
    }
    // ceiling
    this.ceilMat = makeMat(q, { color: this.baseCeil.clone(), roughness: 0.95 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(S, S), this.ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.group.add(ceil);

    // lamp fixture: a disc that glows when lit
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x8090a8 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.14, 24), this.lampMat);
    lamp.position.set(0, H - 0.08, 0); this.group.add(lamp); this.lamp = lamp;
    if (q.shafts && !info.cabin) {
      this.shaftMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
      const shaft = new THREE.Mesh(shaftGeometry(), this.shaftMat);
      shaft.position.set(0, H - 0.15, 0); shaft.scale.set(Math.min(2, S / 10), H - 0.15, Math.min(2, S / 10)); shaft.renderOrder = 3;
      this.group.add(shaft); this.shaft = shaft;
    }
    if (q.motes && !info.cabin) this.buildMotes(q.motes, S, H);

    // switch near the north doorway
    if (!info.cabin) {
      this.switchMat = new THREE.MeshBasicMaterial({ color: 0x6a7fa8 });
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.06), this.switchMat);
      this.switchPos = new THREE.Vector3(dw / 2 + 0.45, 1.25, -half + T + 0.04);
      sw.position.copy(this.switchPos); this.group.add(sw); this.switchMesh = sw;
    }

    // props
    for (const p of info.props) {
      let g;
      const r = Math.min(p.w, p.d) / 2;
      if (p.kind === 'cyl') g = new THREE.CylinderGeometry(r, r, p.h, 20);
      else if (p.kind === 'round') g = new THREE.CylinderGeometry(r, r * 0.8, p.h, 6);
      else g = new THREE.BoxGeometry(p.w, p.h, p.d);
      const m = new THREE.Mesh(g, makeMat(q, { color: new THREE.Color(...p.color), roughness: 0.6 }));
      m.position.set(p.x, p.h / 2, p.z); this.group.add(m);
    }
    if (info.setPiece && opts.buildSetPiece) opts.buildSetPiece(this, info);

    this.buildClutter();
    this.refreshFloor();
    this.applyLight(0, true);
  }

  buildMotes(n, S, H) {
    const pos = new Float32Array(n * 3); this.moteSeed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = hashf(i, 1, this.info.x), b = hashf(i, 2, this.info.z), c = hashf(i, 3, this.info.floor);
      this.moteSeed.set([(a - 0.5) * S * 0.5, b * (H - 0.4) + 0.2, (c - 0.5) * S * 0.5], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.moteMat = new THREE.PointsMaterial({ map: glowTexture(), size: 0.05, color: 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.motes = new THREE.Points(g, this.moteMat); this.motes.frustumCulled = false;
    this.group.add(this.motes); this.moteT = hashf(this.info.x, this.info.z, 9) * 100;
  }

  buildClutter() {
    const info = this.info, b = info.biome, q = this.q;
    const ipu = this.opts.itemsPerUnit;
    let maxU = 0; for (let k = 0; k < G * G; k++) maxU = Math.max(maxU, this.room.c[k]);
    const base = CFG.clutterMult[info.modifier] * 1.6 * (info.setPiece ? 0.5 : 1);
    if (this.clutter) { this.group.remove(this.clutter); this.clutter.dispose(); this.clutter = null; }
    if (base === 0 && maxU === 0) return;
    this.K = Math.max(1, Math.ceil(Math.max(maxU, base) * ipu));
    this.ipu = ipu;
    const count = G * G * this.K;
    this.clutterMat = makeMat(q, { color: 0xffffff, roughness: ITEM_ROUGH[b.item] ?? 0.6, envMapIntensity: 0.35 });
    const mesh = new THREE.InstancedMesh(itemGeometry(b.item, detailFor(q)), this.clutterMat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const S = info.side, cell = S / G;
    const col = new THREE.Color();
    this.slots = new Float32Array(count * 7); // x, y, z, scale, rx, ry, rz
    const sizeMul = Math.min(1.6, Math.max(1, S / 12)) * (ipu > 2 ? 0.85 : 1);
    for (let k = 0; k < G * G; k++) {
      const i = k % G, j = (k / G) | 0;
      for (let s = 0; s < this.K; s++) {
        const id = k * this.K + s;
        const r1 = hashf(info.x * 31 + k, info.z * 17 + s, info.floor), r2 = hashf(k, s, info.x + 7 * info.z), r3 = hashf(s, k * 3, info.z);
        const x = -S / 2 + (i + 0.1 + r1 * 0.8) * cell, z = -S / 2 + (j + 0.1 + r2 * 0.8) * cell;
        const size = b.size * (0.7 + r3 * 0.6) * sizeMul;
        const flat = b.item === 'paper' || b.item === 'leaf';
        const y = (flat ? 0.02 : size * 0.85) + (s / Math.max(1, ipu)) * size * (flat ? 0.35 : 1.1);
        const rx = flat ? (r1 - 0.5) * 0.3 : r1 * 6, rz = flat ? (r3 - 0.5) * 0.3 : r3 * 6;
        this.slots.set([x, y, z, size, rx, r2 * 6, rz], id * 7);
        const c = b.items[Math.floor(r3 * b.items.length) % b.items.length];
        col.setRGB(c[0], c[1], c[2]); mesh.setColorAt(id, col);
      }
    }
    this.clutter = mesh;
    this.group.add(mesh);
    this.cellVisible = new Int16Array(G * G).fill(-1);
    for (let k = 0; k < G * G; k++) this.updateCell(k);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  updateCell(k) {
    if (!this.clutter) return;
    const units = this.room.c[k];
    const n = Math.min(this.K, Math.ceil(units * this.ipu - 1e-3));
    if (this.cellVisible[k] === n) return;
    this.cellVisible[k] = n;
    const m = _m, q = _q, e = _e, p = _p, sc = _s;
    for (let s = 0; s < this.K; s++) {
      const id = k * this.K + s, o = id * 7;
      const sz = s < n ? this.slots[o + 3] : 0;
      e.set(this.slots[o + 4], this.slots[o + 5], this.slots[o + 6]); q.setFromEuler(e);
      m.compose(p.set(this.slots[o], this.slots[o + 1], this.slots[o + 2]), q, sc.set(sz, sz, sz));
      this.clutter.setMatrixAt(id, m);
    }
    this.clutter.instanceMatrix.needsUpdate = true;
  }
  syncClutter(cells) {
    if (!this.clutter) { if (cells === undefined) this.buildClutter(); return; }
    if (cells) for (const k of cells) this.updateCell(k);
    else for (let k = 0; k < G * G; k++) this.updateCell(k);
  }

  refreshFloor() {
    const d = this.tex.image.data, r = this.room, base = this.baseFloor, rd = this.rough && this.rough.image.data;
    const contact = this.q.contact;
    for (let k = 0; k < G * G; k++) {
      const i = k % G, j = (k / G) | 0;
      const g = r.c[k] > 0 ? 1 : r.g[k];
      const pol = 1 - g;
      const checker = ((i + j) & 1) ? 1.0 : 0.93;
      let ao = 1;
      if (contact) {
        const edge = Math.min(i, j, G - 1 - i, G - 1 - j);
        ao = edge === 0 ? 0.72 : edge === 1 ? 0.88 : 1;
        if (r.c[k] > 0) ao *= 0.78;
      }
      const lum = (0.78 + 0.34 * pol) * ao;
      const grime = 0.70 * ao;
      const o = ((G - 1 - j) * G + i) * 4;
      d[o] = Math.min(255, 255 * base.r * (checker * lum * pol + grime * (1 - pol)));
      d[o + 1] = Math.min(255, 255 * base.g * (checker * lum * pol + grime * (1 - pol)));
      d[o + 2] = Math.min(255, 255 * base.b * (checker * lum * pol + (grime + 0.04) * (1 - pol)));
      d[o + 3] = 255;
      if (rd) { const rough = 0.3 + 0.65 * g; rd[o] = 0; rd[o + 1] = rough * 255; rd[o + 2] = 0; rd[o + 3] = 255; }
    }
    this.tex.needsUpdate = true;
    if (this.rough) this.rough.needsUpdate = true;
  }

  // Lit rooms glow warm; unlit rooms are soft blue dusk (never black).
  applyLight(dt, snap, warmMode) {
    const target = this.room.lit ? 1 : 0;
    if (snap) this.warm = target; else this.warm += (target - this.warm) * Math.min(1, dt * 1.5);
    const w = this.warm;
    const tone = TMP.copy(warmMode ? WARMDUSK : DUSK).lerp(WARM, w);
    const k = 0.62 + 0.38 * w;
    this.floorMat.color.copy(tone).multiplyScalar(k * 1.12);
    this.floorMat.emissive.copy(WARM).multiplyScalar(0.07 * w);
    this.wallMat.color.copy(this.baseWall).multiply(tone).multiplyScalar(k);
    this.wallMat.emissive.copy(WARM).multiplyScalar(0.05 * w);
    this.trimMat.color.copy(this.baseWall).multiply(tone).multiplyScalar(k * 0.62);
    this.ceilMat.color.copy(this.baseCeil).multiply(tone).multiplyScalar(k * 0.9);
    if (this.clutterMat) { this.clutterMat.color.copy(tone).multiplyScalar(0.88 + 0.3 * w); this.clutterMat.emissive.copy(WARM).multiplyScalar(0.06 * w); }
    const lb = this.lampBoost;
    this.lampMat.color.setRGB(0.5 + 0.9 * w * lb, 0.55 + 0.75 * w * lb, 0.68 + 0.3 * w * lb);
    if (this.shaftMat) this.shaftMat.opacity = 0.085 * w * lb;
    if (this.moteMat) this.moteMat.opacity = 0.25 + 0.55 * w;
    if (this.switchMat) this.switchMat.color.setRGB(0.42 + 0.7 * w, 0.5 + 0.45 * w, 0.66 - 0.2 * w);
  }

  tick(dt) {
    if (this.motes && this.warm > 0.02) {
      this.moteT += dt;
      const a = this.motes.geometry.attributes.position, s = this.moteSeed, t = this.moteT;
      for (let i = 0; i < a.count; i++) {
        const o = i * 3;
        a.array[o] = s[o] + Math.sin(t * 0.11 + i) * 0.4;
        a.array[o + 1] = s[o + 1] + Math.sin(t * 0.07 + i * 1.7) * 0.3;
        a.array[o + 2] = s[o + 2] + Math.cos(t * 0.09 + i * 0.6) * 0.4;
      }
      a.needsUpdate = true;
    }
  }

  setDoors(shut) { for (let i = 0; i < 4; i++) this.doors[i].visible = !!shut[i]; }

  dispose() {
    const shared = new Set([...Object.values(geoCache), shaftGeo]);
    this.group.traverse((o) => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
    this.tex.dispose(); if (this.rough) this.rough.dispose();
    if (this.clutter) this.clutter.dispose();
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
