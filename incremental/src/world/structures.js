// Surface works: the lift beacon that follows you (it flies on its own, so there is no crane), the coin
// vault at the rim where banked coins pile up, and the Outfitter's hut with its upgrade terminal.
import * as THREE from 'three';
import { HALF, surfaceY, OUTFITTER, DEPOT } from './field.js';
import { COINS } from '../econ/data/coins.js';
import { rng } from '../core/rng.js';

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

// a building's footing: the highest ground under its footprint, so no corner is buried
function padY(x, z, w, d) {
  let y = -Infinity;
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) y = Math.max(y, surfaceY(x + a * w / 2, z + b * d / 2));
  return y;
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
    // a soft column of light rising from the beacon, so you can find it from anywhere in the crater
    const beamGeo = new THREE.CylinderGeometry(0.16, 0.34, 60, 16, 1, true).translate(0, 30, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPulse: { value: 0 } },
      vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main() { vH = position.y / 60.0; vec4 w = modelMatrix * vec4( position, 1.0 ); vN = normalize( mat3( modelMatrix ) * normal ); vV = normalize( cameraPosition - w.xyz ); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; uniform float uPulse; varying float vH; varying vec3 vN; varying vec3 vV;
        void main() { float rim = pow( 1.0 - abs( dot( vN, vV ) ), 1.5 );
          float a = ( 1.0 - rim ) * pow( 1.0 - vH, 2.2 ) * ( 0.32 + 0.08 * sin( vH * 40.0 - uTime * 3.0 ) + uPulse * 0.5 );
          gl_FragColor = vec4( vec3( 0.45, 0.85, 1.0 ) * a, a ); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.beam.frustumCulled = false;
    this.group.add(this.beam);
    this.beaconVel = new THREE.Vector3();
    this.pulse = 0;

    // vault: a lined bin at the north rim with a railing around its apron
    const vy = padY(VAULT.x, VAULT.z, VAULT.w + 2.4, VAULT.d + 2.4);
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
    // the Outfitter's hut: a room you walk into, a short walk from the start. Its doorway faces the claim,
    // and the upgrade terminal stands against the back wall: aim at it and click to buy upgrades.
    {
      const hx = OUTFITTER.x, hz = OUTFITTER.z, W = 4.6, D = 3.8, H = 2.8, T = 0.16, DOOR = 1.5;
      const hy = padY(hx, hz, W, D);
      const wall = steel(atmo, 0x2f6f86, 0.65, 0.15, 'outfitter');
      const trim = steel(atmo, 0xd8e2e6, 0.5, 0.2, 'outfitterTrim');
      // matte inside: metal here would mirror the bright snow sky and read as a snow bank
      const floorMat = steel(atmo, 0x6e4c33, 0.9, 0.0, 'outfitterFloor');     // wooden planks
      const deskMat = steel(atmo, 0x262c31, 0.75, 0.05, 'outfitterDesk');
      const lining = steel(atmo, 0xb9c6cc, 0.85, 0.0, 'outfitterLining');
      const zb = hz + D / 2, zf = hz - D / 2, side = (W - DOOR) / 2;
      const walls = [
        [W, H, T, hx, zb - T / 2],                                  // back
        [T, H, D, hx - W / 2 + T / 2, hz], [T, H, D, hx + W / 2 - T / 2, hz],   // sides
        [side, H, T, hx - W / 2 + side / 2, zf + T / 2], [side, H, T, hx + W / 2 - side / 2, zf + T / 2],   // front, either side of the door
      ];
      for (const [w, h, d, x, z] of walls) {
        this.group.add(box(w, h + 0.6, d, wall, x, hy + h / 2 - 0.3, z));   // 0.3 m of footing below the snow
        this.colliders.push({ min: new THREE.Vector3(x - w / 2 - 0.05, hy - 1, z - d / 2 - 0.05), max: new THREE.Vector3(x + w / 2 + 0.05, hy + h, z + d / 2 + 0.05) });
      }
      this.group.add(box(DOOR, H - 2.25, T, wall, hx, hy + 2.25 + (H - 2.25) / 2, zf + T / 2));   // lintel over the door
      this.group.add(box(W - 2 * T - 0.02, H - 0.05, 0.02, lining, hx, hy + H / 2, zb - T - 0.011));            // inner lining
      for (const sx of [-1, 1]) this.group.add(box(0.02, H - 0.05, D - 2 * T - 0.02, lining, hx + sx * (W / 2 - T - 0.011), hy + H / 2, hz));
      this.group.add(box(W + 0.4, 0.2, D + 0.4, dark, hx, hy + H + 0.1, hz));                       // roof
      this.group.add(box(W - 0.1, 0.06, D - 0.1, floorMat, hx, hy + 0.02, hz));                     // floor
      for (const sx of [-1, 1]) this.group.add(box(0.08, 2.25, 0.2, trim, hx + sx * (DOOR / 2 + 0.04), hy + 1.12, zf));   // door frame
      this.group.add(box(W - 0.2, 0.12, 2.2, paint, hx, hy + 0.0, zf - 1.1));                      // apron in front of the door
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.06), this.ringMat);
      sign.position.set(hx, hy + H + 0.45, zf - 0.05);
      this.group.add(sign);
      this.outfitterSign = sign;
      // the upgrade terminal: a desk console and a big screen on the back wall
      const desk = box(2.0, 0.9, 0.7, deskMat, hx, hy + 0.45, zb - T - 0.4);
      this.group.add(desk);
      this.colliders.push({ min: new THREE.Vector3(hx - 1.05, hy - 1, zb - T - 0.8), max: new THREE.Vector3(hx + 1.05, hy + 0.95, zb) });
      this.group.add(box(1.9, 1.1, 0.08, deskMat, hx, hy + 1.75, zb - T - 0.04));   // screen bezel
      this.termCanvas = document.createElement('canvas');
      this.termCanvas.width = 1024; this.termCanvas.height = 576;
      this.termTex = new THREE.CanvasTexture(this.termCanvas);
      this.termTex.colorSpace = THREE.SRGBColorSpace;
      this.screen = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.99), new THREE.MeshBasicMaterial({ map: this.termTex, toneMapped: false }));
      this.screen.position.set(hx, hy + 1.75, zb - T - 0.09);
      this.screen.rotation.y = Math.PI;   // faces the doorway
      this.group.add(this.screen);
      this.drawTerminal(null);
      this.outfitterLight = new THREE.PointLight(0xffe8c8, 2.2, 7, 1.6);   // a warm room light
      this.outfitterLight.position.set(hx, hy + H - 0.3, hz);
      this.group.add(this.outfitterLight);
      this.hut = { x0: hx - W / 2, x1: hx + W / 2, z0: zf, z1: zb, y: hy };
      this.outfitterPos = new THREE.Vector3(hx, hy, hz);
      this.terminalPos = new THREE.Vector3(hx, hy + 1.2, zb - T - 0.4);
    }
    // the depot: deliver your pack here. A squat shed with a glowing intake facing the claim; coins
    // poured in go down the chute to the vault.
    {
      const dx = DEPOT.x, dz = DEPOT.z, W = 4.0, D = 3.2, H = 3.0;
      const dy = padY(dx, dz, W, D);
      const shed = steel(atmo, 0x8a6a2c, 0.6, 0.35, 'depot');
      this.group.add(box(W, H + 0.6, D, shed, dx, dy + H / 2 - 0.3, dz));
      this.group.add(box(W + 0.4, 0.2, D + 0.4, dark, dx, dy + H + 0.1, dz));
      this.colliders.push({ min: new THREE.Vector3(dx - W / 2 - 0.05, dy - 1, dz - D / 2 - 0.05), max: new THREE.Vector3(dx + W / 2 + 0.05, dy + H, dz + D / 2 + 0.05) });
      // the intake: a hopper on the front wall with a glowing collection ring
      const zf = dz - D / 2;
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 0.9, 16, 1, true), dark);
      hopper.material = dark; hopper.position.set(dx, dy + 1.25, zf - 0.55); hopper.castShadow = true;
      this.group.add(hopper);
      this.group.add(box(0.5, 0.9, 0.5, dark, dx, dy + 0.45, zf - 0.55));      // its stand
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.05, 10, 40), this.ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(dx, dy + 1.7, zf - 0.55);
      this.group.add(ring);
      this.group.add(box(W - 0.3, 0.12, 2.4, paint, dx, dy, zf - 1.2));          // apron
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.06), this.ringMat);
      sign.position.set(dx, dy + H + 0.45, zf - 0.05);
      this.group.add(sign);
      this.depotLight = new THREE.PointLight(0xffd59a, 3, 8, 1.6);
      this.depotLight.position.set(dx, dy + 2.4, zf - 1.4);
      this.group.add(this.depotLight);
      this.depotPos = new THREE.Vector3(dx, dy + 1.0, zf - 0.55);   // where you pour the pack in
      this.depotRing = ring;
    }
    // a little survey hut by the vault, for scale
    this.group.add(box(3.2, 2.4, 2.6, steel(atmo, 0xb24d22, 0.7, 0.1, 'hut'), VAULT.x + VAULT.w / 2 + 4.6, vy + 1.15, VAULT.z + 0.4));
    this.group.add(box(3.5, 0.18, 2.9, dark, VAULT.x + VAULT.w / 2 + 4.6, vy + 2.42, VAULT.z + 0.4));
    this.colliders.push({ min: new THREE.Vector3(VAULT.x + VAULT.w / 2 + 3.0, vy - 1, VAULT.z - 0.9), max: new THREE.Vector3(VAULT.x + VAULT.w / 2 + 6.2, vy + 2.5, VAULT.z + 1.7) });
    this.colliders.push({ min: new THREE.Vector3(VAULT.x - VAULT.w / 2 - 0.25, vy - 1, VAULT.z - VAULT.d / 2 - 0.25), max: new THREE.Vector3(VAULT.x + VAULT.w / 2 + 0.25, this.vaultY + VAULT.depth + 0.6, VAULT.z + VAULT.d / 2 + 0.25) });

    // coin pile: a settling height field of coin instances
    this.pileRes = 0.12;
    this.pw = Math.floor(VAULT.w / this.pileRes);
    this.pd = Math.floor(VAULT.d / this.pileRes);
    this.pileH = new Float32Array(this.pw * this.pd);
    this.pileCount = 0;
    this.pileMesh = coinGeos.slice(0, 3).map((g, i) => {   // the vault piles copper, silver and gold
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
    // the lift flies to wherever you dig
    const tx = target.x, tz = target.z;
    // hover above the floor at the target, never inside the ice
    const floor = volume.floorBelow(tx, target.y + 2.5, tz, 60);
    const ty = target.overhead ? target.y + 1.3 : Math.max(floor + 1.5, Math.min(target.y + 1.2, surfaceY(tx, tz) + 3));
    const hs = liftSpeed * 2.4, vs = liftSpeed * 1.8;
    const dx = tx - b.x, dz = tz - b.z, dy = ty - b.y;
    const dh = Math.hypot(dx, dz);
    const mh = Math.min(dh, hs * dt);
    if (dh > 1e-3) { b.x += (dx / dh) * mh; b.z += (dz / dh) * mh; }
    b.y += Math.sign(dy) * Math.min(Math.abs(dy), vs * dt);
    // keep out of walls: step back toward the open target rather than climbing out of the crater
    const s = volume.sdf(b.x, b.y, b.z);
    if (s > -0.8 && !target.overhead) {
      const ox = tx - b.x, oz = tz - b.z, ol = Math.hypot(ox, oz);
      if (ol > 0.05) { b.x += (ox / ol) * Math.min(ol, 0.05 + (s + 0.8) * 0.5); b.z += (oz / ol) * Math.min(ol, 0.05 + (s + 0.8) * 0.5); }
      else b.y += (s + 0.8) * 0.5;
    }
    // never above the crater rim: the lift lives in the crater
    b.y = Math.min(b.y, surfaceY(b.x, b.z) + 4);
    this.beacon.rotation.y += dt * 0.6;
    this.beam.position.set(b.x, b.y + 0.5, b.z);
    this.beam.material.uniforms.uTime.value = time;
    this.beam.material.uniforms.uPulse.value = this.pulse;


    this.pulse = Math.max(0, this.pulse - dt * 2.5);
    this.ringMat.emissiveIntensity = 1.8 + Math.sin(time * 3) * 0.3 + this.pulse * 6;
    this.light.intensity = 6 + this.pulse * 18;

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

  // inside the Outfitter's hut (on its floor)
  insideHut(p) { const h = this.hut; return !!h && p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1 && p.y < h.y + 3; }

  // is the player aiming at the upgrade terminal (screen or desk), within reach?
  terminalHit(eye, dir, reach = 3.2) {
    if (!this.screen) return false;
    (this._ray ||= new THREE.Raycaster()).set(eye, dir);
    this._ray.far = reach;
    return this._ray.intersectObject(this.screen, false).length > 0 || (eye.distanceTo(this.terminalPos) < 1.6 && dir.dot(this.terminalPos.clone().sub(eye).normalize()) > 0.8);
  }

  // the terminal's screen: the vault, and the cheapest upgrades you can buy next
  drawTerminal(info) {
    const c = this.termCanvas, x = c.getContext('2d'), W = c.width, H = c.height;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b2230'); g.addColorStop(1, '#06121a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(143,214,236,0.35)'; x.lineWidth = 4; x.strokeRect(10, 10, W - 20, H - 20);
    x.fillStyle = '#8fd6ec'; x.font = "700 40px 'Big Shoulders Display', sans-serif";
    x.fillText(info?.reverse ? "OUTFITTER · FREEZE WORKS" : "OUTFITTER · UPGRADES", 40, 72);
    if (!info) { x.fillStyle = '#9fb8c2'; x.font = "500 28px 'IBM Plex Mono', monospace"; x.fillText('Starting up…', 40, 140); this.termTex.needsUpdate = true; return; }
    x.textAlign = 'right'; x.fillStyle = '#e2b25e'; x.font = "700 40px 'IBM Plex Mono', monospace";
    x.fillText(`${info.coins} coins`, W - 40, 72);
    x.textAlign = 'left';
    x.font = "500 26px 'IBM Plex Mono', monospace";
    info.list.slice(0, 5).forEach((n, i) => {
      const y = 140 + i * 72;
      x.fillStyle = n.can ? 'rgba(143,214,236,0.16)' : 'rgba(255,255,255,0.04)';
      x.fillRect(32, y - 44, W - 64, 62);
      x.fillStyle = n.can ? '#e6f1f4' : '#7f98a3';
      x.font = "600 30px 'IBM Plex Mono', monospace";
      x.fillText(`${n.icon}  ${n.name}`, 48, y);
      x.textAlign = 'right'; x.fillStyle = n.can ? '#e2b25e' : '#7f98a3';
      x.fillText(n.can ? `${n.cost} · ready` : n.cost, W - 48, y);
      x.textAlign = 'left';
    });
    x.fillStyle = info.ready ? '#e6f1f4' : '#9fb8c2'; x.font = "600 28px 'IBM Plex Mono', monospace";
    const act = info.touch ? 'tap USE' : 'click';
    x.fillText(info.aimed ? `▶ ${act[0].toUpperCase() + act.slice(1)} to open the upgrade tree` : `Aim at this screen and ${act} to open the upgrade tree`, 40, H - 36);
    this.termTex.needsUpdate = true;
  }

  beaconPos() { return this.beacon.position; }
}
