// Things frozen in the ice: time capsules, the Golden Needle, and fossils in the crater walls.
// All are opaque objects inside the volume, so they show through the ice before you reach them.
import * as THREE from 'three';
import { ISO, HALF, surfaceY } from './field.js';
import { rng, hash32 } from '../core/rng.js';
import { CAPSULES, NEEDLES } from '../econ/data/milestones.js';
import { findForDepth } from '../econ/data/finds.js';

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

// Models for the finds frozen in the ice. Each has glowing parts so it shows through the ice.
function findMesh(atmo, look, glowHex) {
  const g = new THREE.Group();
  const M = (key, color, rough, metal) => atmo.register(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), key);
  const wood = M('findWood', 0x3b2a1e, 0.8, 0.05), iron = M('findIron', 0x2b2f33, 0.45, 0.9), cloth = M('findCloth', 0x5a3d2a, 0.95, 0);
  const bone = M('findBone', 0xe9dcc0, 0.6, 0), brass = M('findBrass', 0xb8893e, 0.32, 1), rock = M('findRock', 0x2a2433, 0.7, 0.4);
  const glow = new THREE.MeshStandardMaterial({ color: 0x100a05, emissive: glowHex, emissiveIntensity: 2.4 });
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  switch (look) {
    case 'lantern':
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 12), iron, 0, -0.16);
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 12), glow);
      add(new THREE.ConeGeometry(0.12, 0.1, 12), iron, 0, 0.18);
      add(new THREE.TorusGeometry(0.06, 0.01, 6, 16), iron, 0, 0.27);
      break;
    case 'satchel':
      add(new THREE.BoxGeometry(0.5, 0.36, 0.2), cloth);
      add(new THREE.BoxGeometry(0.52, 0.16, 0.22), cloth, 0, 0.14, 0.01);
      add(new THREE.BoxGeometry(0.08, 0.08, 0.03), glow, 0, 0.06, 0.12);
      add(new THREE.TorusGeometry(0.22, 0.015, 6, 20, Math.PI), cloth, 0, 0.18, 0);
      break;
    case 'pickhead':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), wood, 0, 0, 0, 0, 0, 0.3);
      add(new THREE.BoxGeometry(0.62, 0.06, 0.06), iron, 0.08, 0.32, 0, 0, 0, 0.3);
      add(new THREE.ConeGeometry(0.04, 0.16, 8), glow, 0.43, 0.42, 0, 0, 0, -1.27);
      break;
    case 'thermos':
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 16), iron);
      add(new THREE.CylinderGeometry(0.104, 0.104, 0.1, 16), glow, 0, 0.05);
      add(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 16), brass, 0, 0.25);
      break;
    case 'drone':
      add(new THREE.SphereGeometry(0.16, 16, 10), iron);
      add(new THREE.SphereGeometry(0.06, 12, 8), glow, 0, 0, 0.14);
      for (const s of [-1, 1]) for (const t of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6), iron, s * 0.18, 0.02, t * 0.18, 0, 0, Math.PI / 2);
        add(new THREE.TorusGeometry(0.09, 0.01, 6, 20), brass, s * 0.3, 0.05, t * 0.3, Math.PI / 2);
      }
      break;
    case 'crate':
      add(new THREE.BoxGeometry(0.9, 0.7, 0.7), wood);
      for (const y of [-0.25, 0.25]) add(new THREE.BoxGeometry(0.92, 0.06, 0.72), iron, 0, y);
      add(new THREE.BoxGeometry(0.4, 0.2, 0.02), glow, 0, 0, 0.36);
      break;
    case 'shard': {
      const geo = new THREE.OctahedronGeometry(0.28, 0).scale(0.7, 1.3, 0.6);
      add(geo, rock, 0, 0, 0, 0.3, 0.4, 0.2);
      add(new THREE.OctahedronGeometry(0.12, 0).scale(0.7, 1.4, 0.6), glow, 0.12, 0.1, 0.1, 0.5, 0.2, 0.4);
      break;
    }
    case 'tusk': {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(-0.1, 0.12, 0), new THREE.Vector3(0.3, 0.32, 0), new THREE.Vector3(0.55, 0.62, 0)]);
      add(new THREE.TubeGeometry(curve, 24, 0.07, 10), bone);
      add(new THREE.TorusGeometry(0.08, 0.02, 6, 16), glow, -0.45, 0.03, 0, 0, Math.PI / 2);
      break;
    }
    case 'reliquary':
      add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), brass);
      add(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass, 0, 0.25);
      add(new THREE.TorusGeometry(0.235, 0.025, 8, 24), glow, 0, 0.02, 0, Math.PI / 2);
      add(new THREE.SphereGeometry(0.05, 10, 8), glow, 0, 0.47);
      break;
    default: // chest
      add(new THREE.BoxGeometry(0.8, 0.46, 0.52), wood);
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.8, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wood, 0, 0.23);
      add(new THREE.BoxGeometry(0.82, 0.035, 0.54), glow, 0, 0.23);
      add(new THREE.BoxGeometry(0.1, 0.12, 0.04), glow, 0, 0.18, 0.27);
      for (const x of [-0.3, 0.3]) add(new THREE.BoxGeometry(0.05, 0.5, 0.55), iron, x);
  }
  g.userData.glow = glow;   // no shadows: finds sit inside the ice
  return g;
}

function needleMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 1, roughness: 0.12, emissive: 0x8a5600, emissiveIntensity: 1.2 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.42, 8), gold);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 16), gold);
  eye.position.y = 0.22;
  g.add(shaft, eye);
  const glow = new THREE.PointLight(0xffc860, 1.2, 4, 2);
  g.add(glow);
  g.userData.glow = glow;
  g.scale.setScalar(2.4);   // about a metre long: easy to spot in the ice
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
    this.needleDepth = null;
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
      const depth = nd.depthMin + r() * (nd.depthMax - nd.depthMin);
      m.position.copy(place(depth));
      this.needleDepth = depth;
      this.needleBand = [nd.depthMin, nd.depthMax];
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      this.group.add(m);
      this.items.push({ kind: 'needle', data: nd, mesh: m, freed: false });
    }
    // finds: lost gear, supplies and relics, set in the coin seams across the claim; which kind depends on depth
    // 60 inside the claim, 90 more scattered across the open ice out to 160 m
    for (let i = 0; i < 150; i++) {
      const id = `find${i}`;
      const seam = 1 + Math.floor(Math.pow(r(), 1.5) * 24);          // seams every 5.5 m
      let x = 0, z = 0;
      if (i < 60) { for (let t = 0; t < 8; t++) { x = (r() * 2 - 1) * lim; z = (r() * 2 - 1) * lim; if (Math.hypot(x - 2.4, z - 5.6) > 5) break; } }
      else { const a = r() * Math.PI * 2, d = 34 + Math.sqrt(r()) * 126; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      const depth = (seam - 0.5) * 5.5;
      const find = findForDepth(depth, r());
      const rx = (r() - 0.5) * 0.6, ry = r() * 6.28, rz = (r() - 0.5) * 0.6;
      if (done.finds?.[id] || done.chests?.[id]) continue;
      const m = findMesh(this.atmo, find.look, find.glow);
      m.position.set(x, surfaceY(x, z) - depth, z);
      m.rotation.set(rx, ry, rz);
      this.group.add(m);
      this.items.push({ kind: 'find', id, find, depth, mesh: m, freed: false });
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
    this.sealedNear = null;
    this.needleNear = null;
    for (const it of this.items) {
      if (it.done) continue;
      const p = it.mesh.position;
      const dPlayer = Math.min(p.distanceTo(playerPos), Math.hypot(p.x - playerPos.x, p.y - playerPos.y - 1.1, p.z - playerPos.z));
      it.mesh.visible = dPlayer < (it.kind === 'find' ? (this.findRange || 25) : 60);
      if (it.kind === 'fossil') continue;
      if (!it.freed && dPlayer < 30) it.freed = this.volume.sample(p.x, p.y, p.z) < ISO - 10 || (it.kind === 'needle' && this.mostlyClear(p));
      if (it.kind === 'capsule') it.mesh.userData.seam.emissiveIntensity = 1.4 + Math.sin(time * 2.2) * 0.6;
      if (it.kind === 'find') it.mesh.userData.glow.emissiveIntensity = 2.0 + Math.sin(time * 3 + p.x) * 0.9;
      if (it.kind === 'needle') {
        it.mesh.rotation.y += dt * 0.5;
        // close by and still in the ice: say so; once free it flies to you
        if (!it.freed && dPlayer < 3.5) this.needleNear = { clear: this.clearShare(p) };
        // once free it drifts to you, but only through open air (never through the ice)
        if (it.freed && dPlayer < 6 && dPlayer > 1.2) {
          const to = playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(p), step = to.multiplyScalar(Math.min(1, dt * 3));
          if (this.volume.sdf(p.x + step.x, p.y + step.y, p.z + step.z) < -0.05) p.add(step);
        }
        it.mesh.userData.glow.intensity = 0.4 + Math.sin(time * 5) * 0.3;
        // everyone feels it once close; Needle Sense and friends reach much further
        const range = hintLevel > 0 ? 10 + hintLevel * 9 : 8;
        if (dPlayer < range) hint = { dir: p.clone().sub(playerPos).normalize(), strength: (1 - dPlayer / range) * (hintLevel > 0 ? 1 : 0.6), dist: dPlayer, dy: p.y - playerPos.y };
      }
      // a sealed capsule waits for its trick (warmth or lamplight), then opens like any other
      const sealed = it.kind === 'capsule' && it.data.puzzle && (it.progress || 0) < it.data.puzzle.need;
      if (sealed && dPlayer < 3.5) this.sealedNear = it;
      // tide-sealed: freed, it opens once you wait beside it for the tide to turn
      if (sealed && it.freed && it.data.puzzle.kind === 'tide' && dPlayer < 3.5) this.puzzle('tide', p, dt, 1);
      if (it.freed && dPlayer < (it.kind === 'needle' ? 2.6 : 2.0) && !sealed) {
        it.done = true;
        this.emit(it.kind, it);
        this.animateOut(it);
      }
    }
    return hint;
  }

  // share of the points around an item that are open air (the needle is thin: digging next to it frees it)
  clearShare(p) {
    let n = 0;
    const o = [[0.4, 0, 0], [-0.4, 0, 0], [0, 0.4, 0], [0, -0.4, 0], [0, 0, 0.4], [0, 0, -0.4]];
    for (const [x, y, z] of o) if (this.volume.sample(p.x + x, p.y + y, p.z + z) < ISO) n++;
    return n / o.length;
  }
  mostlyClear(p) { return this.volume.sample(p.x, p.y, p.z) < ISO + 30 || this.clearShare(p) >= 0.5; }

  // a dig or melt that reaches the needle knocks it free
  hitAt(x, y, z, r) {
    for (const it of this.items) {
      if (it.kind !== 'needle' || it.done || it.freed) continue;
      if (it.mesh.position.distanceTo(new THREE.Vector3(x, y, z)) < r + 0.7) it.freed = true;
    }
  }

  // where the Golden Needle still waits (null once found)
  needlePosition() {
    const it = this.items.find((i) => i.kind === 'needle' && !i.done);
    return it ? it.mesh.position : null;
  }

  // puzzle input from the game: melting next to a capsule, or the focused lamp on it
  warm(point, dt) { this.puzzle('heat', point, dt, 1.8); }
  light(point, dt) { this.puzzle('light', point, dt, 1.0); }
  puzzle(kind, point, dt, range) {
    for (const it of this.items) {
      if (it.kind !== 'capsule' || it.done || !it.data.puzzle || it.data.puzzle.kind !== kind) continue;
      if (it.mesh.position.distanceTo(point) > range) continue;
      it.progress = Math.min(it.data.puzzle.need, (it.progress || 0) + dt);
      it.mesh.userData.seam.emissiveIntensity = 3 + 4 * (it.progress / it.data.puzzle.need);
      if (it.progress >= it.data.puzzle.need && !it.solvedSaid) { it.solvedSaid = true; this.emit('unsealed', it); }
    }
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

  // a crewmate took this one: drop it here too
  removeFind(id) {
    const it = this.items.find((i) => ((i.kind === 'find' && i.id === id) || (i.kind === 'capsule' && i.data.id === id) || (i.kind === 'needle' && id === 'needle')) && !i.done);
    if (it) { it.done = true; this.animateOut(it); }
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
