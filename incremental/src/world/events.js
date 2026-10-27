// Things frozen in the ice: time capsules, the Golden Needle, and fossils in the crater walls.
// All are opaque objects inside the volume, so they show through the ice before you reach them.
import * as THREE from 'three';
import { ISO, HALF, surfaceY } from './field.js';
import { rng, hash32 } from '../core/rng.js';
import { CAPSULES, NEEDLES } from '../econ/data/milestones.js';

function capsuleMesh(atmo) {
  const g = new THREE.Group();
  const brass = atmo.register(new THREE.MeshStandardMaterial({ color: 0xb8893e, metalness: 1, roughness: 0.32 }), 'capBrass');
  const body = atmo.register(new THREE.MeshStandardMaterial({ color: 0x2a3d44, metalness: 0.7, roughness: 0.4 }), 'capBody');
  const seam = new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x7fe2ff, emissiveIntensity: 1.8 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.62, 24), body);
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass); c1.position.y = 0.31;
  const c2 = c1.clone(); c2.rotation.x = Math.PI; c2.position.y = -0.31;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.012, 8, 32), seam); band.rotation.x = Math.PI / 2;
  const ribs = [-0.2, 0.2].map((y) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.166, 0.016, 8, 32), brass); m.rotation.x = Math.PI / 2; m.position.y = y; return m; });
  g.add(tube, c1, c2, band, ...ribs);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData.seam = seam;
  return g;
}

// A surveyor's supply chest: dark iron-bound box with glowing amber seams that show through the ice.
function chestMesh(atmo, relic) {
  const g = new THREE.Group();
  const wood = atmo.register(new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.8, metalness: 0.05 }), 'chestWood');
  const iron = atmo.register(new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.45, metalness: 0.9 }), 'chestIron');
  const glow = new THREE.MeshStandardMaterial({ color: 0x1a0f05, emissive: relic ? 0x9fe6ff : 0xffb347, emissiveIntensity: 2.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.46, 0.52), wood);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.8, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wood);
  lid.position.y = 0.23;
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.035, 0.54), glow); seam.position.y = 0.23;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.04), glow); lock.position.set(0, 0.18, 0.27);
  g.add(body, lid, seam, lock);
  for (const x of [-0.3, 0.3]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.55), iron); band.position.x = x; g.add(band); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.glow = glow;
  return g;
}

function needleMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 1, roughness: 0.12, emissive: 0x6a4200, emissiveIntensity: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.42, 8), gold);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 16), gold);
  eye.position.y = 0.22;
  g.add(shaft, eye);
  const glow = new THREE.PointLight(0xffc860, 0.6, 2.5, 2);
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

// Fossils: a coiled shell, a fish spine, a fern frond.
function fossilGeometry(kind, r) {
  if (kind === 0) {
    const pts = [];
    for (let i = 0; i < 80; i++) { const a = i * 0.16, rr = 0.03 + i * 0.0045; pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.018, 6);
  }
  if (kind === 1) {
    const parts = [];
    const spine = new THREE.CylinderGeometry(0.012, 0.008, 0.7, 6).rotateZ(Math.PI / 2);
    parts.push(spine);
    for (let i = 0; i < 12; i++) {
      const x = -0.28 + i * 0.05, l = 0.16 - Math.abs(i - 5) * 0.012;
      for (const s of [-1, 1]) parts.push(new THREE.CylinderGeometry(0.004, 0.004, l, 4).rotateZ(s * 0.5).translate(x, s * l * 0.4, 0));
    }
    parts.push(new THREE.SphereGeometry(0.05, 8, 6).scale(1.4, 1, 0.5).translate(0.4, 0, 0));
    return mergeGeos(parts);
  }
  const parts = [new THREE.CylinderGeometry(0.008, 0.006, 0.8, 5)];
  for (let i = 0; i < 16; i++) {
    const y = -0.32 + i * 0.045, l = 0.22 * (1 - i / 18);
    for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(l, 0.012, 0.006).translate(s * l / 2, 0, 0).rotateZ(s * 0.35).translate(0, y, 0));
  }
  return mergeGeos(parts);
}

function mergeGeos(list) {
  let n = 0, ni = 0;
  for (const g of list) { const gg = g.index ? g : g; n += gg.attributes.position.count; ni += gg.index ? gg.index.count : gg.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.array[i] + o; }
    else for (let i = 0; i < g.attributes.position.count; i++) idx[oi++] = o + i;
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export class FrozenThings {
  constructor(scene, atmo, volume) {
    this.scene = scene;
    this.atmo = atmo;
    this.volume = volume;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.fossilMat = atmo.register(new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.9, metalness: 0 }), 'fossil');
    this.listeners = {};
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  // done: { capsules: {id: true}, needle: bool, chests: {id: true} }
  setup(planet, pole, seed, done) {
    this.group.clear();
    this.items = [];
    const r = rng(hash32(seed, pole === 'N' ? 1 : 2, 333));
    const lim = HALF - 4;
    const place = (depth) => {
      // near the middle of the claim, where digging happens
      const x = (r() * 2 - 1) * lim * 0.55, z = (r() * 2 - 1) * lim * 0.55;
      return new THREE.Vector3(x, surfaceY(x, z) - depth, z);
    };
    for (const c of CAPSULES.filter((c) => c.planet === planet.id)) {
      if (done.capsules?.[c.id]) continue;
      const m = capsuleMesh(this.atmo);
      m.position.copy(place(c.depth));
      m.rotation.set(r() * 0.6, r() * 6, Math.PI / 2 + (r() - 0.5) * 0.5);
      this.group.add(m);
      this.items.push({ kind: 'capsule', data: c, mesh: m, freed: false });
    }
    const nd = NEEDLES[planet.id];
    if (nd && !done.needle) {
      const m = needleMesh();
      m.position.copy(place(nd.depthMin + r() * (nd.depthMax - nd.depthMin)));
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      this.group.add(m);
      this.items.push({ kind: 'needle', data: nd, mesh: m, freed: false });
    }
    // supply chests, set in the coin seams and spread across the claim (rarely right under the start)
    for (let i = 0; i < 44; i++) {
      const id = `chest${i}`;
      const seam = 1 + Math.floor(Math.pow(r(), 1.5) * 22);          // seams every 5.5 m
      let x = 0, z = 0;
      for (let t = 0; t < 8; t++) { x = (r() * 2 - 1) * lim; z = (r() * 2 - 1) * lim; if (Math.hypot(x - 2.4, z - 5.6) > 5) break; }
      const relic = r() < 0.22;
      if (done.chests?.[id]) continue;
      const m = chestMesh(this.atmo, relic);
      m.position.set(x, surfaceY(x, z) - (seam - 0.5) * 5.5, z);
      m.rotation.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5);
      this.group.add(m);
      this.items.push({ kind: 'chest', id, relic, depth: (seam - 0.5) * 5.5, mesh: m, freed: false });
    }
    // fossils down the strata
    const geos = [0, 1, 2].map((k) => fossilGeometry(k));
    for (let i = 0; i < 46; i++) {
      const depth = 2 + Math.pow(r(), 1.6) * 260;
      const p = place(depth);
      p.x = (r() * 2 - 1) * lim; p.z = (r() * 2 - 1) * lim;
      p.y = surfaceY(p.x, p.z) - depth;
      const m = new THREE.Mesh(geos[i % 3], this.fossilMat);
      m.position.copy(p);
      m.rotation.set(r() * 6, r() * 6, r() * 6);
      m.scale.setScalar(0.7 + r() * 1.3);
      this.group.add(m);
      this.items.push({ kind: 'fossil', mesh: m, freed: false });
    }
  }

  // Check for freed items and proximity pickup. Returns hint info for the needle.
  update(dt, time, playerPos, hintLevel) {
    let hint = null;
    for (const it of this.items) {
      if (it.done) continue;
      const p = it.mesh.position;
      const dPlayer = Math.min(p.distanceTo(playerPos), Math.hypot(p.x - playerPos.x, p.y - playerPos.y - 1.1, p.z - playerPos.z));
      it.mesh.visible = dPlayer < 60;
      if (it.kind === 'fossil') continue;
      if (!it.freed && dPlayer < 30) it.freed = this.volume.sample(p.x, p.y, p.z) < ISO - 10;
      if (it.kind === 'capsule') it.mesh.userData.seam.emissiveIntensity = 1.4 + Math.sin(time * 2.2) * 0.6;
      if (it.kind === 'chest') it.mesh.userData.glow.emissiveIntensity = 2.0 + Math.sin(time * 3 + p.x) * 0.9;
      if (it.kind === 'needle') {
        it.mesh.rotation.y += dt * 0.5;
        it.mesh.userData.glow.intensity = 0.4 + Math.sin(time * 5) * 0.3;
        if (hintLevel > 0) {
          const range = 6 + hintLevel * 9;
          if (dPlayer < range) hint = { dir: p.clone().sub(playerPos).normalize(), strength: 1 - dPlayer / range, dist: dPlayer };
        }
      }
      if (it.freed && dPlayer < 2.0) {
        it.done = true;
        this.emit(it.kind, it);
        this.animateOut(it);
      }
    }
    return hint;
  }

  animateOut(it) {
    const m = it.mesh;
    let t = 0;
    const step = () => {
      t += 0.016;
      m.position.y += 0.02;
      m.rotation.y += 0.15;
      m.scale.multiplyScalar(0.97);
      if (t < 0.9) requestAnimationFrame(step); else this.group.remove(m);
    };
    step();
  }

  // dev: move an item right in front of the player and free it
  devBring(kind, pos) {
    const it = this.items.find((i) => i.kind === kind && !i.done);
    if (!it) return false;
    it.mesh.position.copy(pos);
    it.freed = true;
    return true;
  }
}
