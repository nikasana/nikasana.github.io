// Surface works: an overhead gantry crane spanning the crater, whose trolley lowers the lift beacon
// to wherever the digging is, and the coin vault at the rim where banked coins pile up.
import * as THREE from 'three';
import { HALF, surfaceY } from './field.js';
import { COINS } from '../econ/data/coins.js';
import { rng } from '../core/rng.js';

const RAIL_X = HALF + 2.6;
const BRIDGE_Y = 10.5;
const VAULT = { x: 0, z: -(HALF + 10.5), w: 7.5, d: 5, depth: 1.6 };

function steel(atmo, color, rough, metal, key) {
  return atmo.register(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), key);
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// A lattice girder from (x0) to (x1) along x: top and bottom chords plus diagonal web.
function girder(len, h, mat, webMat) {
  const g = new THREE.Group();
  g.add(box(len, 0.22, 0.32, mat, 0, h / 2, 0));
  g.add(box(len, 0.22, 0.32, mat, 0, -h / 2, 0));
  const n = Math.round(len / h);
  const step = len / n;
  const geo = new THREE.BoxGeometry(0.09, Math.hypot(step, h), 0.09);
  const web = new THREE.InstancedMesh(geo, webMat, n * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const ang = Math.atan2(step, h);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + step * (i + 0.5);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), i % 2 ? ang : -ang);
    m4.compose(new THREE.Vector3(x, 0, 0.12), q, new THREE.Vector3(1, 1, 1));
    web.setMatrixAt(i * 2, m4);
    m4.compose(new THREE.Vector3(x, 0, -0.12), q, new THREE.Vector3(1, 1, 1));
    web.setMatrixAt(i * 2 + 1, m4);
  }
  web.castShadow = true;
  g.add(web);
  return g;
}

export class Works {
  constructor(scene, atmo, coinGeos, coinMats) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'works';
    scene.add(this.group);
    const paint = steel(atmo, 0xc8692c, 0.55, 0.35, 'paintSteel');
    const dark = steel(atmo, 0x22272b, 0.42, 0.8, 'darkSteel');
    const galv = steel(atmo, 0x8a949a, 0.35, 0.9, 'galv');
    this.colliders = [];

    // rails on the east and west rims
    const railLen = HALF * 2 + 26;
    for (const sx of [-1, 1]) {
      const x = sx * RAIL_X;
      const y = surfaceY(x, 0);
      this.group.add(box(0.5, 0.35, railLen, dark, x, y + 0.1, -6));
      const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.18, 0.32), galv, 40);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 40; i++) { const z = -6 - railLen / 2 + (i + 0.5) * railLen / 40; m4.makeTranslation(x, surfaceY(x, z) - 0.02, z); sleepers.setMatrixAt(i, m4); }
      sleepers.receiveShadow = true;
      this.group.add(sleepers);
    }

    // the bridge: two girders, end trucks with legs
    this.bridge = new THREE.Group();
    const span = RAIL_X * 2 + 1.2;
    const gA = girder(span, 1.3, paint, paint); gA.position.set(0, BRIDGE_Y, -0.9);
    const gB = girder(span, 1.3, paint, paint); gB.position.set(0, BRIDGE_Y, 0.9);
    this.bridge.add(gA, gB);
    for (const sx of [-1, 1]) {
      const x = sx * RAIL_X;
      const legs = new THREE.Group();
      const base = surfaceY(x, 0);
      for (const sz of [-1, 1]) {
        const leg = box(0.42, BRIDGE_Y - base, 0.42, paint, x, base + (BRIDGE_Y - base) / 2, sz * 1.8);
        leg.rotation.x = -sz * 0.1;
        legs.add(leg);
      }
      legs.add(box(0.9, 0.6, 5.0, dark, x, base + 0.55, 0));        // truck
      legs.add(box(0.7, 0.7, 2.8, paint, x, BRIDGE_Y + 0.1, 0));    // saddle
      legs.add(box(1.2, 1.0, 1.6, dark, x + sx * 0.6, BRIDGE_Y + 1.0, 0)); // motor house
      this.bridge.add(legs);
    }
    // warning lamp on each saddle
    this.lamps = [];
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
      l.position.set(sx * (RAIL_X + 0.6), BRIDGE_Y + 1.65, 0);
      this.bridge.add(l);
      this.lamps.push(l);
    }
    this.group.add(this.bridge);

    // trolley rides the bridge
    this.trolley = new THREE.Group();
    this.trolley.add(box(1.7, 0.8, 2.4, dark, 0, BRIDGE_Y + 0.95, 0));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 20), galv);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, BRIDGE_Y + 0.25, 0);
    drum.castShadow = true;
    this.trolley.add(drum);
    this.drum = drum;
    this.group.add(this.trolley);

    // cable: a thin cylinder stretched each frame
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 6), dark);
    this.cable.castShadow = true;
    this.group.add(this.cable);

    // the beacon: hexagonal cage with a glowing collection ring
    this.beacon = new THREE.Group();
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 1.1, 6, 1, true), steel(atmo, 0x30373c, 0.35, 0.85, 'cage'));
    cage.material.side = THREE.DoubleSide;
    cage.material.wireframe = false;
    cage.castShadow = true;
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), paint, 6);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; m4.makeTranslation(Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68); bars.setMatrixAt(i, m4); }
    bars.castShadow = true;
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x0b1a20, emissive: 0x6fdcff, emissiveIntensity: 2.2, roughness: 0.3 });
    atmo.register(this.ringMat, 'beaconRing');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 10, 48), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.45;
    const ring2 = ring.clone(); ring2.position.y = 0.48; ring2.scale.setScalar(0.88);
    const cap = box(1.1, 0.16, 1.1, dark, 0, 0.62, 0);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.25, 6), dark);
    basket.position.y = -0.55;
    // a glowing lantern dome on top so the lift reads from far away and from below
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.ringMat);
    dome.position.y = 0.7;
    this.beacon.add(bars, ring, ring2, cap, basket, dome);
    this.beacon.scale.setScalar(0.72);
    this.light = new THREE.PointLight(0x9fe6ff, 8, 14, 1.6);
    this.light.position.y = -0.2;
    this.beacon.add(this.light);
    this.beacon.position.set(1.5, surfaceY(1.5, 3) + 1.7, 3);
    this.group.add(this.beacon);
    this.beaconVel = new THREE.Vector3();
    this.pulse = 0;

    // vault: a lined bin at the north rim with a railing around its apron
    const vy = surfaceY(VAULT.x, VAULT.z);
    this.vaultY = vy + 0.15; // a walled bin standing on the snow
    const liner = steel(atmo, 0x3a4248, 0.6, 0.7, 'vaultLiner');
    this.group.add(box(VAULT.w + 0.4, 0.3, VAULT.d + 0.4, liner, VAULT.x, this.vaultY - 0.15, VAULT.z));
    for (const [w, d, x, z] of [[VAULT.w + 0.4, 0.2, 0, -VAULT.d / 2 - 0.1], [VAULT.w + 0.4, 0.2, 0, VAULT.d / 2 + 0.1], [0.2, VAULT.d, -VAULT.w / 2 - 0.1, 0], [0.2, VAULT.d, VAULT.w / 2 + 0.1, 0]]) {
      this.group.add(box(w, VAULT.depth + 0.5, d, liner, VAULT.x + x, this.vaultY + VAULT.depth / 2 + 0.1, VAULT.z + z));
    }
    // a snow-free apron so the pit reads clearly
    const apron = box(VAULT.w + 2.4, 0.12, VAULT.d + 2.4, dark, VAULT.x, vy - 0.02, VAULT.z);
    apron.receiveShadow = true;
    // apron with a hole: approximated by four strips
    this.group.add(box(VAULT.w + 2.4, 0.1, 1.0, galv, VAULT.x, vy + 0.05, VAULT.z - VAULT.d / 2 - 0.7));
    this.group.add(box(VAULT.w + 2.4, 0.1, 1.0, galv, VAULT.x, vy + 0.05, VAULT.z + VAULT.d / 2 + 0.7));
    this.group.add(box(1.0, 0.1, VAULT.d, galv, VAULT.x - VAULT.w / 2 - 0.7, vy + 0.05, VAULT.z));
    this.group.add(box(1.0, 0.1, VAULT.d, galv, VAULT.x + VAULT.w / 2 + 0.7, vy + 0.05, VAULT.z));
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6), paint, 16);
    let k = 0;
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * 4, side = Math.floor(t), f = t - side;
      const hw = VAULT.w / 2 + 1.1, hd = VAULT.d / 2 + 1.1;
      const pts = [[-hw + 2 * hw * f, -hd], [hw, -hd + 2 * hd * f], [hw - 2 * hw * f, hd], [-hw, hd - 2 * hd * f]][side];
      m4.makeTranslation(VAULT.x + pts[0], vy + 0.52, VAULT.z + pts[1]);
      posts.setMatrixAt(k++, m4);
    }
    posts.castShadow = true;
    this.group.add(posts);
    for (const [w, d, x, z] of [[VAULT.w + 2.2, 0.05, 0, -VAULT.d / 2 - 1.1], [VAULT.w + 2.2, 0.05, 0, VAULT.d / 2 + 1.1], [0.05, VAULT.d + 2.2, -VAULT.w / 2 - 1.1, 0], [0.05, VAULT.d + 2.2, VAULT.w / 2 + 1.1, 0]]) {
      this.group.add(box(w, 0.05, d, paint, VAULT.x + x, vy + 1.05, VAULT.z + z));
    }
    // a little survey hut by the vault, for scale
    this.group.add(box(3.2, 2.4, 2.6, steel(atmo, 0xb24d22, 0.7, 0.1, 'hut'), VAULT.x + VAULT.w / 2 + 4.6, vy + 1.15, VAULT.z + 0.4));
    this.group.add(box(3.5, 0.18, 2.9, dark, VAULT.x + VAULT.w / 2 + 4.6, vy + 2.42, VAULT.z + 0.4));
    this.colliders.push({ min: new THREE.Vector3(VAULT.x + VAULT.w / 2 + 3.0, vy - 1, VAULT.z - 0.9), max: new THREE.Vector3(VAULT.x + VAULT.w / 2 + 6.2, vy + 2.5, VAULT.z + 1.7) });
    this.colliders.push({ min: new THREE.Vector3(VAULT.x - VAULT.w / 2 - 0.25, vy - 1, VAULT.z - VAULT.d / 2 - 0.25), max: new THREE.Vector3(VAULT.x + VAULT.w / 2 + 0.25, this.vaultY + VAULT.depth + 0.6, VAULT.z + VAULT.d / 2 + 0.25) });
    for (const sx of [-1, 1]) this.colliders.push({ min: new THREE.Vector3(sx * RAIL_X - 0.3, -100, -1e4), max: new THREE.Vector3(sx * RAIL_X + 0.3, surfaceY(sx * RAIL_X, 0) + 0.3, 1e4) });

    // coin pile: a settling height field of coin instances
    this.pileRes = 0.12;
    this.pw = Math.floor(VAULT.w / this.pileRes);
    this.pd = Math.floor(VAULT.d / this.pileRes);
    this.pileH = new Float32Array(this.pw * this.pd);
    this.pileCount = 0;
    this.pileMesh = coinGeos.map((g, i) => {
      const im = new THREE.InstancedMesh(g, coinMats[i], 3000);
      im.count = 0;
      im.castShadow = true;
      im.receiveShadow = true;
      // cull the whole pile when the vault is off screen
      im.frustumCulled = true;
      im.geometry = g.clone();
      im.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(VAULT.x, this.vaultY + 1, VAULT.z), Math.hypot(VAULT.w, VAULT.d) / 2 + 2);
      im.boundingSphere = im.geometry.boundingSphere.clone();
      this.group.add(im);
      return im;
    });
    this.pileRng = rng(4242);
    this.falling = [];
  }

  // Drop one coin onto the pile: slide downhill until the slope is below the angle of repose.
  addPileCoin(tier, animate = true) {
    const m = this.pileMesh[tier];
    if (m.count >= 3000) return;
    const r = this.pileRng;
    const W = this.pw, D = this.pd;
    let i = Math.floor(W / 2 + r.gauss() * W * 0.12), j = Math.floor(D / 2 + r.gauss() * D * 0.12);
    i = Math.max(1, Math.min(W - 2, i)); j = Math.max(1, Math.min(D - 2, j));
    const repose = 0.55 * this.pileRes; // max height step between cells
    for (let s = 0; s < 400; s++) {
      const h = this.pileH[j * W + i];
      let best = null, bh = h - repose;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= D) continue;
        const hh = this.pileH[jj * W + ii];
        if (hh < bh) { bh = hh; best = [ii, jj]; }
      }
      if (!best) break;
      [i, j] = best;
    }
    const k = j * W + i;
    const top = this.pileH[k];
    this.pileH[k] += COINS[tier].thick * 0.9 + 0.006;
    // tilt to the local slope
    const gx = (this.pileH[Math.min(k + 1, W * D - 1)] - this.pileH[Math.max(k - 1, 0)]) / (2 * this.pileRes);
    const gz = (this.pileH[Math.min(k + W, W * D - 1)] - this.pileH[Math.max(k - W, 0)]) / (2 * this.pileRes);
    const nrm = new THREE.Vector3(-gx, 1, -gz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * 6.28));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (r() - 0.5) * 0.5));
    const pos = new THREE.Vector3(VAULT.x - VAULT.w / 2 + (i + 0.5 + (r() - 0.5) * 0.6) * this.pileRes, this.vaultY + top + COINS[tier].thick / 2, VAULT.z - VAULT.d / 2 + (j + 0.5 + (r() - 0.5) * 0.6) * this.pileRes);
    const idx = m.count++;
    if (animate) {
      this.falling.push({ m, idx, q, to: pos, y: pos.y + 6 + r() * 3, v: 0 });
      m.setMatrixAt(idx, new THREE.Matrix4().compose(new THREE.Vector3(pos.x, pos.y + 8, pos.z), q, new THREE.Vector3(1, 1, 1)));
    } else {
      m.setMatrixAt(idx, new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
    }
    m.instanceMatrix.needsUpdate = true;
    this.pileCount++;
  }

  // Grow the pile toward the target count derived from lifetime banked value.
  syncPile(totalBanked, tierMix, animate) {
    const lg = Math.max(0, Math.log10(1 + totalBanked));
    const target = Math.min(8500, Math.floor(lg * lg * 95));
    let n = 0;
    while (this.pileCount < target && n++ < (animate ? 6 : 9000)) {
      const roll = this.pileRng();
      const tier = roll < tierMix[2] ? 2 : roll < tierMix[2] + tierMix[1] ? 1 : 0;
      this.addPileCoin(tier, animate);
    }
  }

  resetPile() {
    this.pileH.fill(0);
    this.pileCount = 0;
    this.falling.length = 0;
    for (const m of this.pileMesh) m.count = 0;
  }

  vaultCenter() { return new THREE.Vector3(VAULT.x, this.vaultY + 1, VAULT.z); }

  // Beacon follows the player down the crater at lift speed.
  update(dt, time, target, liftSpeed, volume) {
    const b = this.beacon.position;
    const lim = HALF - 2.2;
    const tx = Math.max(-lim, Math.min(lim, target.x)), tz = Math.max(-lim, Math.min(lim, target.z));
    // hover above the floor at the target, never inside the ice
    const floor = volume.floorBelow(tx, target.y + 2.5, tz, 60);
    const ty = Math.max(floor + 1.5, Math.min(target.y + 1.2, surfaceY(tx, tz) + 3));
    const hs = liftSpeed * 2.4, vs = liftSpeed * 1.8;
    const dx = tx - b.x, dz = tz - b.z, dy = ty - b.y;
    const dh = Math.hypot(dx, dz);
    const mh = Math.min(dh, hs * dt);
    if (dh > 1e-3) { b.x += (dx / dh) * mh; b.z += (dz / dh) * mh; }
    b.y += Math.sign(dy) * Math.min(Math.abs(dy), vs * dt);
    // keep out of walls
    const s = volume.sdf(b.x, b.y, b.z);
    if (s > -0.8) b.y += (s + 0.8);
    this.beacon.rotation.y += dt * 0.6;

    this.bridge.position.z = b.z;
    this.trolley.position.set(b.x, 0, b.z);
    this.drum.rotation.x = -b.y * 1.5;
    const top = new THREE.Vector3(b.x, BRIDGE_Y + 0.2, b.z);
    const bot = new THREE.Vector3(b.x, b.y + 0.7, b.z);
    const len = top.distanceTo(bot);
    this.cable.position.copy(top).add(bot).multiplyScalar(0.5);
    this.cable.scale.set(1, len, 1);

    this.pulse = Math.max(0, this.pulse - dt * 2.5);
    this.ringMat.emissiveIntensity = 1.8 + Math.sin(time * 3) * 0.3 + this.pulse * 6;
    this.light.intensity = 6 + this.pulse * 18;
    for (const l of this.lamps) l.material.color.setHSL(0.08, 1, 0.45 + 0.25 * (Math.sin(time * 4) > 0 ? 1 : 0));

    // coins dropping into the vault
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.v += 14 * dt;
      f.y -= f.v * dt;
      if (f.y <= f.to.y) { f.y = f.to.y; this.falling.splice(i, 1); }
      f.m.setMatrixAt(f.idx, new THREE.Matrix4().compose(new THREE.Vector3(f.to.x, f.y, f.to.z), f.q, new THREE.Vector3(1, 1, 1)));
      f.m.instanceMatrix.needsUpdate = true;
    }
  }

  beaconPos() { return this.beacon.position; }
}
