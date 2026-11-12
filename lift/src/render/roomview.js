// Three.js view of one room: floor (cell texture), walls with doorways, ceiling, props, lamp, switch, clutter.
import * as THREE from '../../vendor/three.module.min.js';
import { CFG, doorWidth } from '../config.js';

const G = CFG.grid;
const DUSK = new THREE.Color(0.55, 0.62, 0.82);
const WARMDUSK = new THREE.Color(0.80, 0.68, 0.55);
const WARM = new THREE.Color(1.0, 0.86, 0.66);

const geoCache = {};
export function itemGeometry(kind) {
  if (geoCache[kind]) return geoCache[kind];
  let g;
  switch (kind) {
    case 'ball': g = new THREE.IcosahedronGeometry(1, 1); break;
    case 'foam': g = new THREE.IcosahedronGeometry(1, 0); break;
    case 'paper': g = new THREE.BoxGeometry(1.4, 0.06, 1.0); break;
    case 'leaf': g = new THREE.BoxGeometry(1.2, 0.05, 0.7); break;
    case 'book': g = new THREE.BoxGeometry(1.3, 0.45, 1.0); break;
    case 'popcorn': g = new THREE.DodecahedronGeometry(1, 0); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  geoCache[kind] = g; return g;
}

function hashf(a, b, c) { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x1b873593, 0x27d4eb2f); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }

export class RoomView {
  constructor(info, room, opts) {
    this.info = info; this.room = room; this.opts = opts;
    const S = info.side, half = S / 2;
    this.group = new THREE.Group();
    this.group.position.set(info.x * S, 0, info.z * S);
    const b = info.biome;
    const tint = info.tint;
    this.baseFloor = new THREE.Color(...b.floor).multiplyScalar(tint);
    this.baseWall = new THREE.Color(...b.wall);
    if (info.cabin) { this.baseFloor = new THREE.Color(0.55, 0.38, 0.26); this.baseWall = new THREE.Color(0.86, 0.74, 0.58); }
    this.warm = room.lit ? 1 : 0;

    // floor with per-cell texture
    this.tex = new THREE.DataTexture(new Uint8Array(G * G * 4), G, G);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.floorMat = new THREE.MeshLambertMaterial({ map: this.tex });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // walls with doorways (walls belong to the room on N and W side + E/S drawn by neighbours; we draw all 4 halves inset)
    this.wallMat = new THREE.MeshLambertMaterial({ color: this.baseWall.clone() });
    const H = info.ceil, T = CFG.room.wallT / 2, dw = doorWidth(S), dh = CFG.room.doorH;
    const seg = (half - dw / 2);
    const addBox = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.wallMat); m.position.set(x, y, z); this.group.add(m); return m; };
    for (let side = 0; side < 4; side++) {
      const horiz = side === 0 || side === 2; const sign = side === 0 || side === 3 ? -1 : 1;
      const off = sign * (half - T / 2);
      for (const s2 of [-1, 1]) {
        const c = s2 * (dw / 2 + seg / 2);
        if (horiz) addBox(seg, H, T, c, H / 2, off); else addBox(T, H, seg, off, H / 2, c);
      }
      if (horiz) addBox(dw, H - dh, T, 0, dh + (H - dh) / 2, off); else addBox(T, H - dh, dw, off, dh + (H - dh) / 2, 0);
    }
    // doors (hidden unless shut)
    this.doorMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0.62, 0.52, 0.42) });
    this.doors = [];
    for (let side = 0; side < 4; side++) {
      const horiz = side === 0 || side === 2; const sign = side === 0 || side === 3 ? -1 : 1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? dw : 0.08, dh, horiz ? 0.08 : dw), this.doorMat);
      m.position.set(horiz ? 0 : sign * (half - T / 2 - 0.08), dh / 2, horiz ? sign * (half - T / 2 - 0.08) : 0);
      m.visible = false; this.group.add(m); this.doors.push(m);
    }
    // ceiling
    this.ceilMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(...b.ceil) });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(S, S), this.ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.group.add(ceil);

    // lamp fixture
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x8090a8 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.18, 16), this.lampMat);
    lamp.position.set(0, H - 0.1, 0); this.group.add(lamp); this.lamp = lamp;

    // switch near the north doorway, on the wall to the right as you enter from the north
    if (!info.cabin) {
      this.switchMat = new THREE.MeshBasicMaterial({ color: 0x6a7fa8 });
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.06), this.switchMat);
      this.switchPos = new THREE.Vector3(dw / 2 + 0.45, 1.25, -half + T + 0.04);
      sw.position.copy(this.switchPos); this.group.add(sw); this.switchMesh = sw;
    }

    // props
    this.propMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: false });
    for (const p of info.props) {
      let g;
      if (p.kind === 'cyl') g = new THREE.CylinderGeometry(Math.min(p.w, p.d) / 2, Math.min(p.w, p.d) / 2, p.h, 14);
      else if (p.kind === 'round') g = new THREE.CylinderGeometry(Math.min(p.w, p.d) / 2, Math.min(p.w, p.d) / 2 * 0.8, p.h, 6);
      else g = new THREE.BoxGeometry(p.w, p.h, p.d);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: new THREE.Color(...p.color) }));
      m.position.set(p.x, p.h / 2, p.z); this.group.add(m);
    }
    if (info.setPiece && opts.buildSetPiece) opts.buildSetPiece(this, info);

    // clutter
    this.buildClutter();
    this.refreshFloor();
    this.applyLight(0, true);
  }

  buildClutter() {
    const info = this.info, b = info.biome;
    const ipu = this.opts.itemsPerUnit;
    let maxU = 0; for (let k = 0; k < G * G; k++) maxU = Math.max(maxU, this.room.c[k]);
    const base = CFG.clutterMult[info.modifier] * 1.6 * (info.setPiece ? 0.5 : 1);
    this.K = Math.max(1, Math.ceil(Math.max(maxU, base) * ipu));
    this.ipu = ipu;
    const count = G * G * this.K;
    if (this.clutter) { this.group.remove(this.clutter); this.clutter.dispose(); }
    if (this.K === 0 || base === 0 && maxU === 0) { this.clutter = null; return; }
    this.clutterMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(itemGeometry(b.item), this.clutterMat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const S = info.side, cell = S / G;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const col = new THREE.Color();
    this.slots = new Float32Array(count * 5); // x, y, z, scale, visibleThreshold
    for (let k = 0; k < G * G; k++) {
      const i = k % G, j = (k / G) | 0;
      for (let s = 0; s < this.K; s++) {
        const id = k * this.K + s;
        const r1 = hashf(info.x * 31 + k, info.z * 17 + s, info.floor), r2 = hashf(k, s, info.x + 7 * info.z), r3 = hashf(s, k * 3, info.z);
        const x = -S / 2 + (i + 0.15 + r1 * 0.7) * cell, z = -S / 2 + (j + 0.15 + r2 * 0.7) * cell;
        const size = b.size * (0.7 + r3 * 0.6) * Math.min(1.6, Math.max(1, S / 12));
        const y = size * 0.8 + (s / Math.max(1, ipu * 2)) * size * 1.2;
        this.slots.set([x, y, z, size, (s + 0.5) / ipu], id * 5);
        e.set(r1 * 6, r2 * 6, r3 * 6); q.setFromEuler(e);
        m.compose(p.set(x, y, z), q, sc.set(size, size, size));
        mesh.setMatrixAt(id, m);
        const c = b.items[Math.floor(r3 * b.items.length) % b.items.length];
        col.setRGB(c[0], c[1], c[2]); mesh.setColorAt(id, col);
      }
    }
    this.clutter = mesh;
    this.group.add(mesh);
    this.cellVisible = new Int16Array(G * G).fill(-1);
    for (let k = 0; k < G * G; k++) this.updateCell(k);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  updateCell(k) {
    if (!this.clutter) return;
    const units = this.room.c[k];
    const n = Math.min(this.K, Math.ceil(units * this.ipu - 1e-3));
    if (this.cellVisible[k] === n) return;
    this.cellVisible[k] = n;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let s = 0; s < this.K; s++) {
      const id = k * this.K + s, o = id * 5;
      const vis = s < n;
      const sz = vis ? this.slots[o + 3] : 0;
      e.set(this.slots[o] * 3, this.slots[o + 2] * 3, s); q.setFromEuler(e);
      m.compose(p.set(this.slots[o], this.slots[o + 1], this.slots[o + 2]), q, sc.set(sz, sz, sz));
      this.clutter.setMatrixAt(id, m);
    }
    this.clutter.instanceMatrix.needsUpdate = true;
  }
  syncClutter(cells) {
    if (!this.clutter) return;
    if (cells) for (const k of cells) this.updateCell(k);
    else for (let k = 0; k < G * G; k++) this.updateCell(k);
  }

  refreshFloor() {
    const d = this.tex.image.data, r = this.room;
    const base = this.baseFloor;
    const grime = [0.68, 0.68, 0.72];
    for (let k = 0; k < G * G; k++) {
      const g = r.c[k] > 0 ? 1 : r.g[k];
      const i = k % G, j = (k / G) | 0;
      const checker = ((i + j) & 1) ? 1.0 : 0.94;
      const pol = 1 - g;
      const rr = (base.r * checker * (0.75 + 0.4 * pol)) * pol + grime[0] * base.r * (1 - pol);
      const gg = (base.g * checker * (0.75 + 0.4 * pol)) * pol + grime[1] * base.g * (1 - pol);
      const bb = (base.b * checker * (0.75 + 0.4 * pol)) * pol + grime[2] * base.b * (1 - pol);
      // texture row 0 is at the bottom (v=0) -> local z = +S/2 after rotation, flip j
      const o = ((G - 1 - j) * G + i) * 4;
      d[o] = Math.min(255, rr * 255); d[o + 1] = Math.min(255, gg * 255); d[o + 2] = Math.min(255, bb * 255); d[o + 3] = 255;
    }
    this.tex.needsUpdate = true;
  }

  // Lit rooms glow warm; unlit rooms are soft blue dusk.
  applyLight(dt, snap, warmMode) {
    const target = this.room.lit ? 1 : 0;
    if (snap) this.warm = target; else this.warm += (target - this.warm) * Math.min(1, dt * 1.5);
    const w = this.warm;
    const dusk = warmMode ? WARMDUSK : DUSK;
    const tone = new THREE.Color().copy(dusk).lerp(WARM, w);
    const k = 0.55 + 0.45 * w;
    this.floorMat.color.copy(tone).multiplyScalar(k * 1.15);
    this.floorMat.emissive.copy(WARM).multiplyScalar(0.10 * w);
    this.wallMat.color.copy(this.baseWall).multiply(tone).multiplyScalar(k);
    this.wallMat.emissive.copy(WARM).multiplyScalar(0.06 * w);
    this.ceilMat.color.copy(new THREE.Color(...this.info.biome.ceil)).multiply(tone).multiplyScalar(k * 0.9);
    if (this.clutterMat) { this.clutterMat.color.copy(tone).multiplyScalar(0.85 + 0.35 * w); this.clutterMat.emissive.copy(WARM).multiplyScalar(0.08 * w); }
    this.lampMat.color.setRGB(0.5 + 0.5 * w, 0.55 + 0.4 * w, 0.68 + 0.1 * w);
    if (this.switchMat) this.switchMat.color.setRGB(0.42 + 0.58 * w, 0.5 + 0.35 * w, 0.66 - 0.2 * w);
  }

  setDoors(shut) { for (let i = 0; i < 4; i++) this.doors[i].visible = !!shut[i]; }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry && !Object.values(geoCache).includes(o.geometry)) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
    this.tex.dispose();
    if (this.clutter) this.clutter.dispose();
  }
}
