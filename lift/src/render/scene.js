// Scene manager: loads the 3x3 rooms around the player, lights, tool ring, flying items.
import * as THREE from '../../vendor/three.module.min.js';
import { CFG, roomSide } from '../config.js';
import { RoomView, itemGeometry } from './roomview.js';
import { buildSetPiece, buildCabin } from './props.js';
import * as Game from '../game.js';
import { roomKey } from '../world.js';

const G = CFG.grid;

export class World {
  constructor(canvas, game, opts) {
    this.game = game; this.opts = opts;
    const mobile = opts.mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? CFG.perf.mobilePixelRatio : CFG.perf.desktopPixelRatio));
    this.renderer.setSize(innerWidth, innerHeight, false);
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
    for (let i = 0; i < CFG.perf.maxLights; i++) {
      const l = new THREE.PointLight(0xffd9a8, 0, 12, 1.2); l.visible = true; this.scene.add(l); this.lights.push(l);
    }
    this.views = new Map();
    this.floor = -1;
    // tool ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.55, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 2;
    this.scene.add(this.ring);
    this.ringFill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.08, depthWrite: false }));
    this.ringFill.rotation.x = -Math.PI / 2; this.scene.add(this.ringFill);
    // flying items pool
    this.flyN = mobile ? 80 : 200;
    this.flyMesh = null; this.flyKind = null;
    this.fly = []; this.flyHead = 0;
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3(); this.tmpE = new THREE.Euler();
    this.extras = []; // per-frame hooks
    addEventListener('resize', () => this.resize());
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }

  viewFor(f, x, z) { return this.views.get(roomKey(f, x, z)); }

  setFloor(f) {
    for (const v of this.views.values()) { this.scene.remove(v.group); v.dispose(); }
    this.views.clear(); this.floor = f;
    const S = roomSide(f);
    this.scene.fog.near = S * 0.7; this.scene.fog.far = S * 2.2;
    for (const l of this.lights) l.distance = S * 1.6;
  }

  // Keep exactly the current room plus its 8 neighbours loaded.
  updateLoaded(f, rx, rz) {
    if (f !== this.floor) this.setFloor(f);
    const want = new Set();
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) want.add(roomKey(f, rx + dx, rz + dz));
    for (const [k, v] of this.views) if (!want.has(k)) { this.scene.remove(v.group); v.dispose(); this.views.delete(k); }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = rx + dx, z = rz + dz, k = roomKey(f, x, z);
      if (this.views.has(k)) continue;
      const info = Game.info(this.game, f, x, z), room = Game.room(this.game, f, x, z);
      const v = new RoomView(info, room, { itemsPerUnit: this.opts.mobile ? CFG.perf.itemsPerUnitMobile : CFG.perf.itemsPerUnitDesktop, buildSetPiece });
      if (info.cabin) buildCabin(v, this.game);
      v.applyLight(0, true, this.game.settings.warmMode);
      this.views.set(k, v); this.scene.add(v.group);
      if (this.onViewCreated) this.onViewCreated(v);
    }
  }

  setGame(game) { this.game = game; this.setFloor(this.floor < 0 ? 0 : this.floor); }

  spawnFlyers(view, cells, target) {
    if (!view.clutter) return;
    const kind = view.info.biome.item;
    if (this.flyKind !== kind) {
      if (this.flyMesh) { this.scene.remove(this.flyMesh); this.flyMesh.dispose(); }
      this.flyMesh = new THREE.InstancedMesh(itemGeometry(kind), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x332211 }), this.flyN);
      this.flyMesh.frustumCulled = false; this.flyKind = kind;
      for (let i = 0; i < this.flyN; i++) { this.flyMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); this.flyMesh.setColorAt(i, new THREE.Color(1, 1, 1)); }
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
      this.fly[id] = { t: 0, x: gx - S / 2 + (i + 0.5) * cell, y: 0.15, z: gz - S / 2 + (j + 0.5) * cell, size: view.info.biome.size * Math.min(1.6, Math.max(1, S / 12)), target, spin: Math.random() * 6 };
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
    const col = mode === 'clear' ? 0xffd27a : mode === 'polish' ? 0xbfefff : 0xfff0c8;
    this.ring.material.color.setHex(col); this.ringFill.material.color.setHex(col);
    this.ringFill.material.opacity = mode === 'clear' || mode === 'polish' ? 0.16 : 0.06;
  }

  updateLights(px, pz) {
    const lit = [];
    for (const v of this.views.values()) if (v.room.lit) {
      const dx = v.group.position.x - px, dz = v.group.position.z - pz;
      lit.push([dx * dx + dz * dz, v]);
    }
    lit.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], e = lit[i];
      if (!e) { l.intensity = 0; continue; }
      const v = e[1];
      l.position.set(v.group.position.x, v.info.ceil - 0.6, v.group.position.z);
      l.intensity = 9 * v.warm * (v.lampBoost || 1);
    }
  }

  frame(dt, cam, warmMode) {
    for (const v of this.views.values()) { v.applyLight(dt, false, warmMode); if (v.tick) v.tick(dt); }
    for (const h of this.extras) h(dt);
    this.camera.position.set(cam.x, cam.y, cam.z);
    this.camera.rotation.set(cam.pitch, cam.yaw, 0);
    this.updateLights(cam.x, cam.z);
    const dusk = warmMode ? 0x7a6a5e : 0x56607e;
    this.bg.setHex(dusk); this.scene.fog.color.setHex(dusk);
    this.renderer.render(this.scene, this.camera);
  }
}
