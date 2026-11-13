// Scene manager: loads the 3x3 rooms around the player, lights, post-processing by graphics level,
// tool ring, flying items and per-frame hooks (Tide, signs, pings...).
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../vendor/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../../vendor/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from '../../vendor/addons/environments/RoomEnvironment.js';
import { CFG, roomSide } from '../config.js';
import { RoomView, itemGeometry, makeMat, detailFor } from './roomview.js';
import { buildSetPiece, buildCabin } from './props.js';
import * as Game from '../game.js';
import { roomKey } from '../world.js';

const G = CFG.grid;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0 }, uVignette: { value: 0.32 }, uWarm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 7.31) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.92, 0.97, 1.08), highTint = mix(vec3(1.04, 1.0, 0.95), vec3(1.08, 1.0, 0.9), uWarm);
      c.rgb *= mix(shadowTint, highTint, smoothstep(0.05, 0.7, l));
      c.rgb = mix(vec3(l), c.rgb, 1.12);
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d) * 1.35);
      c.rgb += (h(vUv * 913.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

export class World {
  constructor(canvas, game, opts) {
    this.game = game; this.opts = opts; this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.mobile, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.bg = new THREE.Color(0x56607e);
    this.scene.background = this.bg;
    this.scene.fog = new THREE.Fog(this.bg, 8, 22);
    this.camera = new THREE.PerspectiveCamera(opts.fov || 75, innerWidth / innerHeight, 0.05, 200);
    this.camera.rotation.order = 'YXZ';
    this.hemi = new THREE.HemisphereLight(0xc4d2ff, 0x8a8090, 2.6);
    this.scene.add(this.hemi);
    this.lights = [];
    for (let i = 0; i < CFG.perf.maxLights; i++) { const l = new THREE.PointLight(0xffd9a8, 0, 12, 1.2); this.scene.add(l); this.lights.push(l); }
    this.views = new Map();
    this.floor = -1;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.55, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 2; this.scene.add(this.ring);
    this.ringFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.08, depthWrite: false }));
    this.ringFill.rotation.x = -Math.PI / 2; this.scene.add(this.ringFill);
    this.flyN = opts.mobile ? 80 : 200;
    this.flyMesh = null; this.flyKind = null; this.fly = []; this.flyHead = 0;
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3(); this.tmpE = new THREE.Euler();
    this.extras = [];
    this.fovKick = 0; this.time = 0;
    this.setQuality(opts.quality || 3);
    addEventListener('resize', () => this.resize());
  }

  setQuality(level) {
    const q = CFG.quality[Math.max(1, Math.min(5, level)) - 1];
    this.q = q; this.level = q.id;
    const pr = Math.min(devicePixelRatio, q.pr, this.opts.mobile ? CFG.perf.mobilePixelRatio + (q.id >= 4 ? 0.5 : 0) : 9);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.toneMapping = q.tone ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = q.std ? 0.9 : 1;
    this.hemi.intensity = q.std ? 1.35 : 2.6;
    if (q.env && !this.envTex) {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envTex = pm.fromScene(new RoomEnvironment(this.renderer), 0.04).texture; pm.dispose();
    }
    this.scene.environment = q.env ? this.envTex : null;
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    if (q.bloom > 0 || q.grade) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.opts.mobile ? 0 : 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      if (q.bloom > 0) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * q.bloomRes, size.y * q.bloomRes), q.bloom, 0.5, 1.15);
        this.composer.addPass(this.bloom);
      } else this.bloom = null;
      this.grade = new ShaderPass(GradeShader);
      this.grade.uniforms.uGrain.value = q.grain;
      this.composer.addPass(this.grade);
      this.composer.addPass(new OutputPass());
    }
    if (this.flyMesh) { this.scene.remove(this.flyMesh); this.flyMesh.dispose(); this.flyMesh = null; this.flyKind = null; }
    if (this.floor >= 0) { const f = this.floor; this.floor = -1; this.setFloor(f); }
    if (this.onQuality) this.onQuality(q);
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    if (this.composer) { const s = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.composer.setSize(innerWidth, innerHeight); if (this.bloom) this.bloom.resolution.set(s.x * this.q.bloomRes, s.y * this.q.bloomRes); }
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }

  viewFor(f, x, z) { return this.views.get(roomKey(f, x, z)); }
  mat(opts) { return makeMat(this.q, opts); }

  setFloor(f) {
    for (const v of this.views.values()) { this.scene.remove(v.group); v.dispose(); }
    this.views.clear(); this.floor = f;
    const S = roomSide(f);
    this.scene.fog.near = S * 0.7; this.scene.fog.far = S * 2.4;
    for (const l of this.lights) l.distance = S * 1.6;
    if (this.onFloor) this.onFloor(f);
  }

  // Exactly the current room plus its 8 neighbours.
  updateLoaded(f, rx, rz) {
    if (f !== this.floor) this.setFloor(f);
    const want = new Set();
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) want.add(roomKey(f, rx + dx, rz + dz));
    for (const [k, v] of this.views) if (!want.has(k)) { this.scene.remove(v.group); v.dispose(); this.views.delete(k); if (this.onViewRemoved) this.onViewRemoved(v); }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = rx + dx, z = rz + dz, k = roomKey(f, x, z);
      if (this.views.has(k)) continue;
      const info = Game.info(this.game, f, x, z), room = Game.room(this.game, f, x, z);
      const ipu = this.opts.mobile ? Math.min(this.q.ipu, CFG.perf.itemsPerUnitMobile + (this.q.id >= 4 ? 1 : 0)) : this.q.ipu;
      const v = new RoomView(info, room, { q: this.q, itemsPerUnit: ipu, buildSetPiece });
      if (info.cabin) buildCabin(v, this.game);
      v.applyLight(0, true, this.game.settings.warmMode);
      this.views.set(k, v); this.scene.add(v.group);
      if (this.onViewCreated) this.onViewCreated(v);
    }
  }
  rebuildView(f, x, z) {
    const k = roomKey(f, x, z), v = this.views.get(k);
    if (v) { this.scene.remove(v.group); v.dispose(); this.views.delete(k); if (this.onViewRemoved) this.onViewRemoved(v); }
  }

  setGame(game) { this.game = game; const f = this.floor < 0 ? 0 : this.floor; this.floor = -1; this.setFloor(f); }

  spawnFlyers(view, cells) {
    if (!view.clutter) return;
    const kind = view.info.biome.item;
    if (this.flyKind !== kind) {
      if (this.flyMesh) { this.scene.remove(this.flyMesh); this.flyMesh.dispose(); }
      this.flyMesh = new THREE.InstancedMesh(itemGeometry(kind, detailFor(this.q)), this.mat({ color: 0xffffff, emissive: 0x332211, roughness: 0.4 }), this.flyN);
      this.flyMesh.frustumCulled = false; this.flyKind = kind;
      const z = new THREE.Matrix4().makeScale(0, 0, 0), w = new THREE.Color(1, 1, 1);
      for (let i = 0; i < this.flyN; i++) { this.flyMesh.setMatrixAt(i, z); this.flyMesh.setColorAt(i, w); }
      this.scene.add(this.flyMesh); this.fly = []; this.flyHead = 0;
    }
    const S = view.info.side, cell = S / G, gx = view.group.position.x, gz = view.group.position.z;
    const items = view.info.biome.items;
    let n = 0;
    for (const k of cells) {
      if (n++ > 6) break;
      const i = k % G, j = (k / G) | 0;
      const id = this.flyHead; this.flyHead = (this.flyHead + 1) % this.flyN;
      const c = items[(k + id) % items.length];
      this.flyMesh.setColorAt(id, new THREE.Color(c[0], c[1], c[2]));
      this.fly[id] = { t: 0, x: gx - S / 2 + (i + 0.5) * cell, y: 0.15, z: gz - S / 2 + (j + 0.5) * cell, size: view.info.biome.size * Math.min(1.6, Math.max(1, S / 12)), spin: Math.random() * 6 };
    }
    if (this.flyMesh.instanceColor) this.flyMesh.instanceColor.needsUpdate = true;
  }

  updateFlyers(dt, px, py, pz) {
    if (!this.flyMesh) return;
    let any = false;
    for (let id = 0; id < this.fly.length; id++) {
      const f = this.fly[id]; if (!f) continue;
      f.t += dt * 2.6; any = true;
      if (f.t >= 1) { this.fly[id] = null; this.flyMesh.setMatrixAt(id, this.tmpM.makeScale(0, 0, 0)); continue; }
      const t = f.t, e = t * t;
      const x = f.x + (px - f.x) * e, z = f.z + (pz - f.z) * e, y = f.y + (py - 0.5 - f.y) * e + Math.sin(t * Math.PI) * 0.9;
      const s = f.size * (1 - t * 0.7);
      this.tmpE.set(f.spin + t * 8, t * 6, 0); this.tmpQ.setFromEuler(this.tmpE);
      this.flyMesh.setMatrixAt(id, this.tmpM.compose(this.tmpV.set(x, y, z), this.tmpQ, this.tmpS.set(s, s, s)));
    }
    if (any) this.flyMesh.instanceMatrix.needsUpdate = true;
  }

  placeRing(x, z, r, mode) {
    this.ring.position.set(x, 0.02, z); this.ring.scale.setScalar(r);
    this.ringFill.position.set(x, 0.015, z); this.ringFill.scale.setScalar(r);
    const col = mode === 'clear' ? 0xffd27a : mode === 'polish' ? 0xbfefff : mode === 'test' ? 0xe0c0ff : 0xfff0c8;
    this.ring.material.color.setHex(col); this.ringFill.material.color.setHex(col);
    this.ringFill.material.opacity = mode && mode !== 'idle' ? 0.16 : 0.06;
  }

  updateLights(px, pz) {
    const lit = [];
    for (const v of this.views.values()) if (v.room.lit || v.tempLight) {
      const dx = v.group.position.x - px, dz = v.group.position.z - pz;
      lit.push([dx * dx + dz * dz, v]);
    }
    lit.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], e = lit[i];
      if (!e) { l.intensity = 0; continue; }
      const v = e[1];
      l.position.set(v.group.position.x, v.info.ceil - 0.6, v.group.position.z);
      l.intensity = (this.q.std ? 3.2 : 9) * Math.max(v.warm, v.tempLight ? 0.7 : 0) * (v.lampBoost || 1) * Math.min(2.2, v.info.side / 8);
    }
  }

  frame(dt, cam, warmMode, warmth = 0) {
    this.time += dt;
    for (const v of this.views.values()) { v.applyLight(dt, false, warmMode); v.tick(dt); }
    for (const h of this.extras) h(dt);
    this.camera.position.set(cam.x, cam.y, cam.z);
    this.camera.rotation.set(cam.pitch, cam.yaw, cam.roll || 0);
    const fov = (cam.fov || 75) + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.updateLights(cam.x, cam.z);
    const dusk = new THREE.Color(warmMode ? 0x7a6a5e : 0x56607e).lerp(new THREE.Color(0x8a7058), warmth * 0.6);
    this.bg.copy(dusk); this.scene.fog.color.copy(dusk);
    if (this.composer) {
      this.grade.uniforms.uTime.value = this.time; this.grade.uniforms.uWarm.value = warmth;
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
  }
}
