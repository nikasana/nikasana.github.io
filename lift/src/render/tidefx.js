// The Tide, drawn: a readable wave of instanced clutter with a crest and a glowing front line,
// motion per biome, sparks where it breaks on a lit doorway, and a graceful ebb into rising motes.
import * as THREE from 'three';
import { CFG, roomSide, doorWidth } from '../config.js';
import * as Game from '../game.js';
import { itemGeometry, glowTexture } from './roomview.js';

const MAX_LANES = 6;
function h3(a, b, c) { let h = Math.imul(a ^ 0x27d4eb2f, 0x165667b1) ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(c + 7, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }

const crestVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const crestFS = `uniform vec3 uColor; uniform float uTime, uAlpha; varying vec2 vUv;
  void main(){
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
    float wave = 0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 3.0);
    float band = exp(-pow((vUv.y - 0.82 - 0.04 * sin(vUv.x * 18.0 + uTime * 2.0)) * 9.0, 2.0)) * 1.6 + 0.35 * smoothstep(0.0, 0.9, vUv.y) * (1.0 - vUv.y);
    gl_FragColor = vec4(uColor * band * wave * 1.4, band * edge * uAlpha);
  }`;

export class TideFX {
  constructor(world, audio) {
    this.world = world; this.audio = audio; this.scene = world.scene;
    this.meshes = new Map(); // kind -> InstancedMesh
    this.crests = [];
    this.t = 0;
    this.ebbs = []; // { lane snapshot, t }
    this.sparks = this.makePoints(world.opts.mobile ? 160 : 420, 0xffe2a8, 0.09);
    this.motes = this.makePoints(world.opts.mobile ? 160 : 500, 0xffe6b8, 0.07);
    this.vents = [];
    for (let i = 0; i < 4; i++) {
      const v = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.9, 32), new THREE.MeshBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      v.rotation.x = -Math.PI / 2; v.visible = false; this.scene.add(v); this.vents.push(v);
    }
    this.slowmo = 0;
    for (let i = 0; i < MAX_LANES; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(1, 0.86, 0.6) }, uTime: { value: 0 }, uAlpha: { value: 0 } },
        vertexShader: crestVS, fragmentShader: crestFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 4; this.scene.add(m); this.crests.push(m);
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  get cap() { const q = this.world.q.id; const mob = this.world.opts.mobile; return mob ? [250, 400, 700, 900, 1100][q - 1] : [500, 900, 1600, 2400, 3200][q - 1]; }

  makePoints(n, color, size) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-999), 3));
    const mat = new THREE.PointsMaterial({ map: glowTexture(), color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; this.scene.add(pts);
    return { pts, n, head: 0, vel: new Float32Array(n * 3), life: new Float32Array(n) };
  }
  emit(sys, x, y, z, vx, vy, vz, life) {
    const i = sys.head; sys.head = (sys.head + 1) % sys.n;
    const a = sys.pts.geometry.attributes.position.array; a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    sys.vel[i * 3] = vx; sys.vel[i * 3 + 1] = vy; sys.vel[i * 3 + 2] = vz; sys.life[i] = life;
  }
  stepPoints(sys, dt, gravity, drag) {
    const a = sys.pts.geometry.attributes.position.array; let any = false;
    for (let i = 0; i < sys.n; i++) {
      if (sys.life[i] <= 0) continue;
      any = true; sys.life[i] -= dt;
      if (sys.life[i] <= 0) { a[i * 3 + 1] = -999; continue; }
      sys.vel[i * 3 + 1] -= gravity * dt;
      for (let k = 0; k < 3; k++) { sys.vel[i * 3 + k] *= 1 - drag * dt; a[i * 3 + k] += sys.vel[i * 3 + k] * dt; }
    }
    if (any) sys.pts.geometry.attributes.position.needsUpdate = true;
  }

  meshFor(kind) {
    let m = this.meshes.get(kind);
    const cap = this.cap;
    if (m && m.userData.cap !== cap) { this.scene.remove(m); m.dispose(); m = null; }
    if (!m) {
      m = new THREE.InstancedMesh(itemGeometry(kind), this.world.mat({ color: 0xffffff, roughness: 0.45, emissive: 0x000000, envMapIntensity: 0.4 }), cap);
      m.userData.cap = cap; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const c = new THREE.Color(1, 1, 1); for (let i = 0; i < cap; i++) m.setColorAt(i, c);
      this.scene.add(m); this.meshes.set(kind, m);
    }
    return m;
  }

  // Called by the game when a front meets a lit doorway: a brief slow-motion beat, sparks and a swell.
  onContact(lane, x, z, lit) {
    if (!lit) return;
    this.slowmo = 0.55;
    if (this.audio) this.audio.swell();
    this.burstAt(lane, 60);
  }
  burstAt(lane, n) {
    const S = roomSide(this.world.floor), prev = lane.path[Math.max(0, lane.i - 1)], cur = lane.path[lane.i];
    const dx = cur[0] - prev[0], dz = cur[1] - prev[1];
    const ox = (prev[0] + cur[0]) / 2 * S, oz = (prev[1] + cur[1]) / 2 * S;
    for (let i = 0; i < n; i++) {
      const across = (Math.random() - 0.5) * S * 0.3;
      this.emit(this.sparks, ox - dz * across, 0.3 + Math.random() * 1.6, oz + dx * across,
        -dx * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2, 1 + Math.random() * 3.5, -dz * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.8);
    }
  }
  onEnd(w) {
    if (w.result === 'held' || w.result === 'bounced') {
      for (const fr of w.fronts) for (const l of fr.lanes) this.ebbs.push({ lane: { path: l.path, i: l.i, p: l.p, state: l.state }, t: 0 });
    }
  }

  // Draw all fronts near the player. s: game state.
  update(dt, s, playerRoom) {
    this.t += dt;
    this.stepPoints(this.sparks, dt, 6, 0.6);
    this.stepPoints(this.motes, dt, -0.35, 0.4);
    const w = s.tide;
    const S = roomSide(this.world.floor);
    const lanes = [];
    if (w && !w.result && w.f === this.world.floor) for (const fr of w.fronts) {
      if (w.t < fr.start - 6) continue;  // visible a little before it moves
      for (const l of fr.lanes) {
        if (l.state === 'held' || l.state === 'arrived') continue;
        const cur = l.path[l.i], prev = l.path[Math.max(0, l.i - 1)];
        const d = Math.min(Math.max(Math.abs(cur[0] - playerRoom[0]), Math.abs(cur[1] - playerRoom[1])), Math.max(Math.abs(prev[0] - playerRoom[0]), Math.abs(prev[1] - playerRoom[1])));
        if (d <= 2) lanes.push({ l, d, ebb: 0, start: w.t < fr.start });
      }
    }
    for (let i = this.ebbs.length - 1; i >= 0; i--) {
      const e = this.ebbs[i]; e.t += dt;
      if (e.t > 4.5) { this.ebbs.splice(i, 1); continue; }
      const cur = e.lane.path[e.lane.i];
      const d = Math.max(Math.abs(cur[0] - playerRoom[0]), Math.abs(cur[1] - playerRoom[1]));
      if (d <= 2) lanes.push({ l: e.lane, d, ebb: e.t });
    }
    let vi = 0;
    if (w && !w.result && w.f === this.world.floor) for (const fr of w.fronts) {
      if (vi >= 4 || fr.sourceLit) continue;
      const v = this.vents[vi++]; v.visible = true;
      v.position.set(fr.source[0] * S, 0.03, fr.source[1] * S); v.scale.setScalar(Math.sqrt(S / 8) * (1 + 0.08 * Math.sin(this.t * 3)));
      v.material.opacity = 0.35 + 0.2 * Math.sin(this.t * 2);
      if (Math.random() < dt * 8) this.emit(this.motes, fr.source[0] * S + (Math.random() - 0.5), 0.2, fr.source[1] * S + (Math.random() - 0.5), 0, 0.5, 0, 2);
    }
    for (let i = vi; i < 4; i++) this.vents[i].visible = false;
    lanes.sort((a, b) => a.d - b.d);
    const show = lanes.slice(0, MAX_LANES);
    // budget per biome mesh
    const byKind = new Map();
    for (const it of show) {
      const cur = it.l.path[it.l.i];
      const inf = Game.info(s, this.world.floor, cur[0], cur[1]);
      it.biome = inf.biome; it.lit = Game.room(s, this.world.floor, cur[0], cur[1]).lit;
      if (!byKind.has(inf.biome.item)) byKind.set(inf.biome.item, []);
      byKind.get(inf.biome.item).push(it);
    }
    for (const [kind, m] of this.meshes) if (!byKind.has(kind)) { m.count = 0; }
    let crestI = 0;
    for (const [kind, list] of byKind) {
      const m = this.meshFor(kind);
      const per = Math.floor(m.userData.cap / list.length);
      let idx = 0;
      for (const it of list) idx = this.drawLane(m, idx, per, it, S, crestI < MAX_LANES ? this.crests[crestI++] : null, dt);
      m.count = idx; m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (let i = crestI; i < MAX_LANES; i++) this.crests[i].visible = false;
    // sound: surf follows the nearest front
    let near = Infinity; for (const it of lanes) if (!it.ebb) near = Math.min(near, it.d);
    if (this.audio) this.audio.setSurf(near === Infinity ? 0 : near === 0 ? 1 : near === 1 ? 0.6 : 0.25);
    this.slowmo = Math.max(0, this.slowmo - dt);
  }

  drawLane(m, idx, per, it, S, crest, dt) {
    const l = it.l, b = it.biome, t = this.t;
    const cur = l.path[l.i], prev = l.path[Math.max(0, l.i - 1)];
    let dx = cur[0] - prev[0], dz = cur[1] - prev[1];
    if (!dx && !dz) { const nx = l.path[Math.min(l.path.length - 1, l.i + 1)]; dx = nx[0] - cur[0]; dz = nx[1] - cur[1]; }
    const ox = (prev[0] + cur[0]) / 2 * S, oz = (prev[1] + cur[1]) / 2 * S;   // the doorway the front pushes through
    const nx = -dz, nz = dx;                                                   // across the lane
    const scale = Math.sqrt(S / 8);
    const H0 = b.tideHeight * 1.25 * scale;
    // front position along the lane (metres past the doorway)
    let front = l.state === 'contact' ? -0.25 + Math.sin(t * 2.2) * 0.12 : (l.p - 0.02) * S;
    if (it.start) front = -S * 0.9;
    const ebb = it.ebb;
    if (ebb) front -= ebb * ebb * 1.4;
    const fade = ebb ? Math.max(0, 1 - ebb / 4) : 1;
    const L = S * 1.6, W = S * 0.96;
    const size = b.size * 1.35 * Math.min(1.6, Math.max(1, S / 12));
    const style = b.tide;
    const warm = it.lit ? 1 : 0;
    const col = new THREE.Color();
    for (let i = 0; i < per; i++) {
      const a = h3(i, l.path[0][0] * 31 + l.path[0][1], 1), bb = h3(i, 2, l.path[0][1]), c = h3(i, 3, l.path[0][0]), e = h3(i, 4, 9);
      const back = L * Math.pow(a, 0.75);
      const s0 = front - back;
      // crest profile: a curl just behind the front, a long low body behind it
      const prof = H0 * (0.25 + 0.75 * Math.exp(-Math.pow((back - 0.5 * scale) / (1.3 * scale), 2))) * (1 - 0.35 * a);
      let along = s0, across = (bb - 0.5) * W, y = size * 0.6 + prof * c;
      let rx = e * 6, ry = a * 6, rz = c * 6, sc = size * (0.75 + 0.5 * e) * fade;
      const ph = t * b.tideSpeed + e * 6.28;
      switch (style) {
        case 'roll': along += Math.sin(ph) * 0.15; y += Math.abs(Math.sin(ph * 1.7)) * 0.25 * (1 - a); rz = -t * 4 * b.tideSpeed + e; break;
        case 'rise': y += Math.sin(ph * 0.6) * 0.18 * H0; sc *= 1 + 0.18 * Math.sin(ph * 1.3); break;
        case 'gust': y += 0.35 * H0 * Math.abs(Math.sin(ph * 0.9)); rx = Math.sin(ph * 3) * 0.9; rz = Math.cos(ph * 2.3) * 0.9; across += Math.sin(ph * 0.7) * 0.3; break;
        case 'swirl': { const r = 0.35 * (1 - a); across += Math.cos(ph * 1.4) * r; along += Math.sin(ph * 1.4) * r; y += Math.sin(ph * 0.8) * 0.25 * H0; ry = ph * 2; break; }
        case 'stack': y = size * 0.5 + Math.floor(c * 6) * size * 0.55 * (prof / H0) ; rx = 0; rz = 0; ry = e * 0.4; along += Math.sin(ph * 0.4) * 0.05; break;
        case 'burst': { const pop = Math.max(0, Math.sin(ph * 1.6)); y += pop * pop * 0.9 * H0 * (1 - a * 0.7); break; }
      }
      if (ebb) { y += ebb * ebb * 0.25 * e; }
      // only the doorway lets items through the wall line
      const half = doorWidth(S) / 2 - size;
      if (along > -0.25 && Math.abs(across) > half) along = -0.25 - size;
      if (along > -0.25 && y > CFG.room.doorH - size) y = CFG.room.doorH - size;
      const x = ox + dx * along + nx * across, z = oz + dz * along + nz * across;
      this._e.set(rx, ry, rz); this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sc, sc, sc));
      m.setMatrixAt(idx, this._m);
      const pal = b.items[(i + (l.path[0][0] & 7)) % b.items.length];
      // items catch the warm light of lit rooms near the front
      const glow = warm * Math.max(0, 1 - back / (S * 0.5)) * 0.35;
      col.setRGB(pal[0] * (1 + glow), pal[1] * (1 + glow * 0.8), pal[2] * (1 + glow * 0.4)); m.setColorAt(idx, col);
      idx++;
      if (ebb && fade > 0 && Math.random() < 0.004) this.emit(this.motes, x, y, z, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, 2.5);
    }
    if (crest) {
      crest.visible = true;
      crest.position.set(ox + dx * (front + 0.05), H0 * 0.55, oz + dz * (front + 0.05));
      crest.scale.set(W, H0 * 1.25, 1);
      crest.rotation.set(0, Math.atan2(dx, dz), 0);
      crest.material.uniforms.uTime.value = this.t;
      crest.material.uniforms.uAlpha.value = (0.55 + 0.45 * warm) * fade * (it.start ? 0.4 : 1);
      crest.material.uniforms.uColor.value.setRGB(1, 0.82 + 0.1 * (1 - warm), 0.55 + 0.35 * (1 - warm));
    }
    // a continuous fine spray where the front breaks on a lit doorway
    if (l.state === 'contact' && warm && !ebb && Math.random() < dt * 30) this.burstAt(l, 2);
    return idx;
  }

  clear() { for (const m of this.meshes.values()) m.count = 0; for (const c of this.crests) c.visible = false; this.ebbs = []; }
}
