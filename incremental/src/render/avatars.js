// Crewmate avatars: full body in a survey parka, current tool in hand, walk cycle, name tag.
import * as THREE from 'three';
import { ROLE_BY_ID } from '../econ/data/milestones.js';

const PARKAS = [0xc8692c, 0x2f7f9e, 0x8a5bd6, 0x3f9a5c];

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(6,18,26,0.72)';
  x.fillRect(0, 10, 256, 44);
  x.fillStyle = '#8fd6ec';
  x.fillRect(0, 10, 4, 44);
  x.font = '600 28px "Big Shoulders Display", "Arial Narrow", sans-serif';
  x.fillStyle = '#e6f1f4';
  x.textBaseline = 'middle';
  x.fillText(text.toUpperCase(), 16, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(1.0, 0.25, 1);
  return s;
}

function limb(len, rad, mat) {
  const g = new THREE.CapsuleGeometry(rad, len, 4, 10);
  g.translate(0, -len / 2 - rad, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

export class Avatar {
  constructor(atmo, idx, name) {
    const parka = atmo.register(new THREE.MeshStandardMaterial({ color: PARKAS[idx % 4], roughness: 0.75 }), `parka${idx % 4}`);
    const dark = atmo.register(new THREE.MeshStandardMaterial({ color: 0x1f2428, roughness: 0.8 }), 'avDark');
    const fur = atmo.register(new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 1 }), 'avFur');
    const visor = atmo.register(new THREE.MeshStandardMaterial({ color: 0x10202a, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6 }), 'avVisor');
    const steel = atmo.register(new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.9, roughness: 0.3 }), 'avSteel');
    this.root = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 14), parka);
    torso.position.y = 1.15; torso.scale.set(1, 1, 0.8); torso.castShadow = true;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.18), dark);
    pack.position.set(0, 1.2, 0.24); pack.castShadow = true;
    this.head = new THREE.Group();
    this.head.position.y = 1.62;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), parka);
    hood.scale.set(1, 1.08, 1.02); hood.castShadow = true;
    const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 8, 20), fur);
    ruff.position.z = -0.1;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), visor);
    face.rotation.x = -Math.PI / 2; face.position.z = -0.08; face.scale.set(1, 1, 0.75);
    this.head.add(hood, ruff, face);
    const mk = (x, y, len, rad, mat) => { const g = new THREE.Group(); g.position.set(x, y, 0); const l = limb(len, rad, mat); g.add(l); return g; };
    this.legL = mk(-0.11, 0.86, 0.6, 0.09, dark);
    this.legR = mk(0.11, 0.86, 0.6, 0.09, dark);
    this.armL = mk(-0.3, 1.42, 0.46, 0.075, parka);
    this.armR = mk(0.3, 1.42, 0.46, 0.075, parka);
    // tool in the right hand
    this.tool = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), dark);
    shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), steel);
    head.position.z = -0.55;
    this.tool.add(shaft, head);
    this.tool.position.set(0, -0.58, 0);
    this.armR.add(this.tool);
    this.root.add(torso, pack, this.head, this.legL, this.legR, this.armL, this.armR);
    this.tag = nameTag(name);
    this.tag.position.y = 2.15;
    this.root.add(this.tag);
    this.name = name;
    this.phase = 0;
    this.target = new THREE.Vector3();
    this.lastPos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.using = false;
    this.useT = 0;
  }

  setName(n) {
    if (n === this.name) return;
    this.name = n;
    this.root.remove(this.tag);
    this.tag.material.map.dispose();
    this.tag = nameTag(n);
    this.tag.position.y = 2.15;
    this.root.add(this.tag);
  }

  apply(st) {
    if (!st) return;
    this.target.set(st.p[0], st.p[1], st.p[2]);
    this.yaw = st.y;
    this.pitch = st.pi;
    this.using = st.u;
    this.family = st.f;
  }

  update(dt) {
    const r = this.root;
    if (this.lastPos.lengthSq() === 0) r.position.copy(this.target);
    r.position.lerp(this.target, Math.min(1, dt * 12));
    const sp = r.position.distanceTo(this.lastPos) / Math.max(dt, 1e-3);
    this.lastPos.copy(r.position);
    let dy = this.yaw - r.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    r.rotation.y += dy * Math.min(1, dt * 10);
    this.head.rotation.x = -this.pitch * 0.6;
    this.phase += dt * Math.min(sp, 7) * 2.2;
    const sw = Math.sin(this.phase) * Math.min(1, sp / 3) * 0.7;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.6;
    this.useT += dt;
    if (this.using) this.armR.rotation.x = this.family === 0 ? -1.2 + Math.abs(Math.sin(this.useT * 7)) * 1.4 : -1.25 - this.pitch * 0.5;
    else this.armR.rotation.x = sw * 0.5 - 0.3;
  }
}

export class Avatars {
  constructor(scene, atmo) {
    this.scene = scene;
    this.atmo = atmo;
    this.map = new Map();
  }

  sync(members) {
    let i = 1;
    const seen = new Set();
    for (const [id, m] of members) {
      if (!m.st) continue;
      seen.add(id);
      let a = this.map.get(id);
      if (!a) { a = new Avatar(this.atmo, i, m.name); this.map.set(id, a); this.scene.add(a.root); }
      a.setName(m.st.r && ROLE_BY_ID[m.st.r] ? `${ROLE_BY_ID[m.st.r].icon} ${m.name}` : m.name);
      a.apply(m.st);
      i++;
    }
    for (const [id, a] of this.map) if (!seen.has(id)) { this.scene.remove(a.root); this.map.delete(id); }
  }

  update(dt) { for (const a of this.map.values()) a.update(dt); }
  clear() { for (const a of this.map.values()) this.scene.remove(a.root); this.map.clear(); }
}
