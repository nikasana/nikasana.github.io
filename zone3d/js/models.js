'use strict';
// ---------- ZoneBonk 3D: 3D people and mutants ----------
// Every person and mutant is built from a handful of shared shapes (boxes, spheres, cylinders) and posed every frame:
// walking, running, attacking, flinching when hit, and falling over when killed. All of them go out as instances of
// those three shapes, so a whole horde is three draw calls. People take their colours from the game's own palettes
// (anything the game draws as a stalker: zombies, bandits, soldiers, Monolith, teammates, quest people), so new
// stalker-like enemies are picked up automatically. Mutants without a model yet keep their picture.
const MDL = { ready: false, corpses: [], human: {}, quad: {} };
(function mdlInit() {
  if (!Z3.ok) return;
  const mk = (geo, cap) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.cap = cap; m.castShadow = true; Z3.scene.add(m); return m;
  };
  MDL.box = mk(new THREE.BoxGeometry(1, 1, 1), 7000);
  MDL.sph = mk(new THREE.SphereGeometry(0.5, Z3_PHONE ? 8 : 12, Z3_PHONE ? 6 : 9), 4000);
  MDL.cyl = mk(new THREE.CylinderGeometry(0.5, 0.5, 1, Z3_PHONE ? 6 : 9), 7000);
  const mkT = (m, cap) => { const t = mk(m.geometry, cap); t.material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }); t.renderOrder = 2; return t; };
  MDL.tbox = mkT(MDL.box, 1500); MDL.tsph = mkT(MDL.sph, 1500); MDL.tcyl = mkT(MDL.cyl, 1500);
  // glowing parts (orbs, eyes, the Monolith crystal) ignore the light
  const mkG = (m, cap) => { const t = mk(m.geometry, cap); t.material = new THREE.MeshBasicMaterial({ color: 0xffffff }); return t; };
  MDL.gbox = mkG(MDL.box, 1500); MDL.gsph = mkG(MDL.sph, 1500);
  // soft round shadow under each body
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d');
  const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  const sgeo = new THREE.PlaneGeometry(1, 1); sgeo.rotateX(-Math.PI / 2);
  MDL.shd = new THREE.InstancedMesh(sgeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }), 900);
  MDL.shd.instanceMatrix.setUsage(THREE.DynamicDrawUsage); MDL.shd.count = 0; MDL.shd.frustumCulled = false; MDL.shd.renderOrder = 1; Z3.scene.add(MDL.shd);
  MDL.ready = true;
})();
const M4 = () => new THREE.Matrix4();
const _mT = M4(), _mR = M4(), _mS = M4(), _mJ = [], _mM = M4(), _col = new THREE.Color(), _eul = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
for (let i = 0; i < 24; i++) _mJ.push(M4());
// mark only the used part of an instanced mesh for upload
function mdlUpload(m) {
  const n = Math.max(1, m.count);
  m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, n * 16); m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) { m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, n * 3); m.instanceColor.needsUpdate = true; }
  m.visible = m.count > 0;
}
const hexc = (h, f) => { const c = new THREE.Color(); c.set(h || '#777'); if (f) c.multiplyScalar(f); return c; };

// ---------- rigs: [name, parent, joint position, shape, mesh offset, size, colour key] (forward is +x, up is +y) ----------
const RIG_H_ = 0;
const RIG_H = [
  ['hip', -1, [0, 26, 0], 'box', [0, 0, 0], [8, 7, 13], 'pants'],
  ['torso', 0, [0, 3, 0], 'box', [0, 9.5, 0], [9, 19, 14], 'jacket'],
  ['head', 1, [0, 19, 0], 'sph', [0.5, 6, 0], [10, 11.5, 10], 'face'],
  ['hood', 2, [0, 0, 0], 'sph', [-0.8, 7, 0], [11.6, 10.5, 11.8], 'hood'],
  ['mask', 2, [0, 0, 0], 'box', [5.2, 4.2, 0], [3.6, 5, 6.5], 'mask'],
  ['pack', 1, [0, 0, 0], 'box', [-8.5, 10, 0], [6.5, 14, 11], 'pack'],
  ['uarmL', 1, [0, 16.5, -9], 'cyl', [0, -6.5, 0], [4.8, 13, 4.8], 'jacket2'],
  ['larmL', 6, [0, -13, 0], 'cyl', [0, -6, 0], [4.2, 12, 4.2], 'jacket2'],
  ['uarmR', 1, [0, 16.5, 9], 'cyl', [0, -6.5, 0], [4.8, 13, 4.8], 'jacket2'],
  ['larmR', 8, [0, -13, 0], 'cyl', [0, -6, 0], [4.2, 12, 4.2], 'jacket2'],
  ['thighL', 0, [0, -2, -3.8], 'cyl', [0, -7, 0], [5.6, 14, 5.6], 'pants'],
  ['shinL', 10, [0, -14, 0], 'cyl', [0, -6, 0], [5, 12, 5], 'pants'],
  ['bootL', 11, [0, -12, 0], 'box', [1.8, -1.4, 0], [9, 3.6, 5.6], 'boot'],
  ['thighR', 0, [0, -2, 3.8], 'cyl', [0, -7, 0], [5.6, 14, 5.6], 'pants'],
  ['shinR', 13, [0, -14, 0], 'cyl', [0, -6, 0], [5, 12, 5], 'pants'],
  ['bootR', 14, [0, -12, 0], 'box', [1.8, -1.4, 0], [9, 3.6, 5.6], 'boot'],
  ['gun', 1, [9, 12, 4], 'box', [7, 0, 0], [22, 3.4, 2.8], 'gun'],
  ['eyes', 2, [0, 0, 0], 'box', [5, 7, 0], [1.2, 1.6, 6], 'eyes'],
];
const RIG_Q = [
  ['body', -1, [0, 15, 0], 'sph', [0, 0, 0], [28, 12, 12], 'body'],
  ['head', 0, [13, 3, 0], 'sph', [5, 1.5, 0], [11, 9, 9], 'head'],
  ['snout', 1, [0, 0, 0], 'box', [11, -0.5, 0], [7, 4.5, 5], 'snout'],
  ['earL', 1, [3, 5, -2.6], 'box', [0, 2, 0], [2, 4.5, 1.5], 'head'],
  ['earR', 1, [3, 5, 2.6], 'box', [0, 2, 0], [2, 4.5, 1.5], 'head'],
  ['tail', 0, [-13, 2, 0], 'box', [-5, 0, 0], [11, 2.2, 2.2], 'body'],
  ['tuskL', 2, [0, 0, 0], 'box', [3, -3, -3], [6, 1.4, 1.4], 'tusk'],
  ['tuskR', 2, [0, 0, 0], 'box', [3, -3, 3], [6, 1.4, 1.4], 'tusk'],
  ['uFL', 0, [9, -3, -4], 'cyl', [0, -4, 0], [3.8, 8, 3.8], 'leg'],
  ['lFL', 8, [0, -8, 0], 'cyl', [0, -3.5, 0], [3.2, 7, 3.2], 'leg'],
  ['uFR', 0, [9, -3, 4], 'cyl', [0, -4, 0], [3.8, 8, 3.8], 'leg'],
  ['lFR', 10, [0, -8, 0], 'cyl', [0, -3.5, 0], [3.2, 7, 3.2], 'leg'],
  ['uBL', 0, [-9, -3, -4], 'cyl', [0, -4, 0], [4.2, 8, 4.2], 'leg'],
  ['lBL', 12, [0, -8, 0], 'cyl', [0, -3.5, 0], [3.2, 7, 3.2], 'leg'],
  ['uBR', 0, [-9, -3, 4], 'cyl', [0, -4, 0], [4.2, 8, 4.2], 'leg'],
  ['lBR', 14, [0, -8, 0], 'cyl', [0, -3.5, 0], [3.2, 7, 3.2], 'leg'],
  ['eyes', 1, [0, 0, 0], 'box', [9, 3, 0], [1.2, 1.4, 6], 'eyes'],
  ['hornL', 1, [4, 4.5, -3], 'box', [0, 5, -1.5], [1.6, 11, 1.6], 'horn'],
  ['hornR', 1, [4, 4.5, 3], 'box', [0, 5, 1.5], [1.6, 11, 1.6], 'horn'],
  ['head2', 0, [12, 4, 7], 'sph', [5, 1.5, 0], [10, 8.5, 8.5], 'head'],
  ['spikes', 0, [0, 0, 0], 'box', [-2, 7, 0], [20, 4, 3], 'horn'],
];
// four-legged mutants: colours and body shape
const QPAL = {
  dog: { body: '#6b5a48', head: '#655444', snout: '#3e3228', leg: '#55473a' },
  pseudodog: { body: '#7a5a3a', head: '#6e5236', snout: '#3a2a1e', leg: '#5e4630', sz: 1.15 },
  psydog: { body: '#4e4656', head: '#4a4252', snout: '#2e2a34', leg: '#3e3846', eyes: '#c080ff' },
  packalpha: { body: '#5e4a3a', head: '#5a4636', snout: '#2e2420', leg: '#4a3a2e', sz: 1.2, eyes: '#ff4a2a' },
  cat: { body: '#8e8676', head: '#868070', snout: '#5a5448', leg: '#7a7264', bodyS: [1.05, 0.72, 0.72], legL: 1.25, headS: 0.85 },
  rat: { body: '#7a6a5a', head: '#746454', snout: '#5a4a3e', leg: '#5e5044', bodyS: [0.9, 0.8, 0.85], legL: 0.75, tailL: 1.8 },
  ratqueen: { body: '#6e5c4c', head: '#685646', snout: '#4a3c30', leg: '#54463a', bodyS: [1, 1.1, 1.1], tailL: 2 },
  boar: { body: '#5a4636', head: '#4e3c2e', snout: '#3a2c22', leg: '#3e3024', tusk: '#e8e0c8', bodyS: [1.25, 1.4, 1.3], headS: 1.25, legL: 0.85 },
  flesh: { body: '#c28a78', head: '#b27a6a', snout: '#a06a5a', leg: '#9a6656', bodyS: [1.15, 1.6, 1.45], legL: 0.75, headS: 0.9, noTail: 1 },
  wolf: { body: '#6e6a62', head: '#66625a', snout: '#3a3834', leg: '#5a564e', sz: 1.05 },
  psideer: { body: '#8a6a4a', head: '#7e6044', snout: '#4a3826', leg: '#6a5038', bodyS: [1, 0.9, 0.8], legL: 1.6, headS: 0.95, horn: '#cfc4a8', eyes: '#b080ff' },
  chimera: { body: '#6a5848', head: '#625040', snout: '#3a2c22', leg: '#54443a', sz: 1.25, bodyS: [1.25, 1.2, 1.2], headS: 1.2, legL: 1.15, two: 1, horn: '#2e2620', eyes: '#ffb040' },
  behemoth: { body: '#4e4840', head: '#46403a', snout: '#2e2a26', leg: '#3a3630', sz: 1.25, bodyS: [1.35, 1.5, 1.45], headS: 1.3, legL: 0.95, tusk: '#d8d0b8', spikes: '#2e2a26', eyes: '#ff5020' },
  ratking: { body: '#6a5848', head: '#625040', snout: '#4a3a2e', leg: '#4e4034', bodyS: [1.1, 1.15, 1.15], tailL: 2.2, eyes: '#ff4020' },
  spider: { body: '#3a3430', head: '#342e2a', snout: '#2a2420', leg: '#2a2622', bodyS: [0.8, 0.9, 1], legL: 1.7, headS: 0.7, noTail: 1, eyes: '#ff3020' },
};
// people-like mutants that the game does not draw as stalkers
const HPAL_EXTRA = {
  snork: { jacket: '#6a6452', jacket2: '#5a5444', pants: '#4a4638', face: '#8a7a6a', mask: '#3e3a32', pack: null, gun: false, crouch: 0.85, low: 0.7 },
  controller: { jacket: '#6e6458', jacket2: '#64584c', pants: '#4e463c', face: '#b8a890', headS: 1.6, thin: 0.75, gun: false, eyes: '#ffe0a0' },
  karlik: { jacket: '#5a4632', jacket2: '#4e3c2a', pants: '#3e3226', face: '#a08a70', hood: '#4a3a28', gun: false, h: 0.7 },
  burer: { jacket: '#3a342c', jacket2: '#342e26', pants: '#2c2620', face: '#9a8a70', hood: '#2a2620', gun: false, h: 0.78, wide: 1.3 },
  bloodsucker: { jacket: '#8a6a5e', jacket2: '#7e5e54', pants: '#6e524a', face: '#9a7468', mask: '#a0504a', gun: false, crouch: 0.35, thin: 0.95, eyes: '#ff3a20', cloak: 1 },
  matriarch: { jacket: '#7a4e48', jacket2: '#6e4640', pants: '#5e3e38', face: '#8a6058', mask: '#b04a40', gun: false, crouch: 0.3, h: 1.15, wide: 1.2, eyes: '#ff2a10', cloak: 1 },
  izlom: { jacket: '#6a6052', jacket2: '#7a705e', pants: '#4a4438', face: '#9a8a74', gun: false, crouch: 0.45, armR: 1.9, thin: 0.9 },
  izlomlord: { jacket: '#5e5446', jacket2: '#6e6452', pants: '#3e382e', face: '#8a7a64', gun: false, crouch: 0.4, armR: 2, h: 1.25, wide: 1.2, eyes: '#ff8a20' },
  phantom: { jacket: '#9ab0ff', jacket2: '#8aa0ef', pants: '#7a90df', face: '#c8d8ff', gun: false, ghost: 1 },
  wraith: { jacket: '#b0b8c8', jacket2: '#a0a8b8', pants: '#9098a8', face: '#d0d8e8', hood: '#808898', gun: false, ghost: 1, legS: 0.01, float: 18, eyes: '#80c0ff' },
  holoclone: { jacket: '#70e8ff', jacket2: '#60d8ef', pants: '#50c8df', face: '#a0f0ff', gun: true, ghost: 1 },
  hologram: { jacket: '#70e8ff', jacket2: '#60d8ef', pants: '#50c8df', face: '#a0f0ff', gun: true, ghost: 1, h: 1.35 },
  gorilla: { jacket: '#4a4038', jacket2: '#443a32', pants: '#3a322a', face: '#5a4a40', gun: false, crouch: 0.5, wide: 1.7, armR: 1.35, armL: 1.35, h: 1.1 },
  pseudogiant: { jacket: '#9a7a62', jacket2: '#8e6e58', pants: '#7a604c', face: '#a08068', gun: false, crouch: 0.3, wide: 2.4, headS: 0.6, legS: 0.65, h: 1.15, armR: 0.8, armL: 0.8 },
  prime: { jacket: '#6e6458', jacket2: '#64584c', pants: '#4e463c', face: '#c0b098', headS: 1.9, thin: 0.75, gun: false, h: 1.2, eyes: '#ffe0a0' },
  webctrl: { jacket: '#5e6058', jacket2: '#54564e', pants: '#44463e', face: '#b0b0a0', headS: 1.5, thin: 0.75, gun: false, eyes: '#a0ffa0' },
  shrieker: { jacket: '#7a7468', jacket2: '#6e685c', pants: '#5a5448', face: '#a89c88', mask: '#2a1a18', gun: false, thin: 0.8, headS: 1.15 },
  mimic: { jacket: '#5a6a48', jacket2: '#4e5e40', pants: '#3e4834', face: '#9a8a70', hood: '#4a5a38', gun: false, crouch: 0.2 },
};
MDL.kindOf = (id) => (MDL.human[id] ? 'h' : QPAL[id] ? 'q' : null);
// learn which enemies the game draws as stalkers, and with which colours
addEventListener('DOMContentLoaded', () => {
  if (!MDL.ready) return;
  for (const id in ENEMIES) {
    if (HPAL_EXTRA[id]) { MDL.human[id] = HPAL_EXTRA[id]; continue; }
    const fn = ENEMY_DRAW[id]; if (!fn || QPAL[id]) continue;
    const ds = drawStalker; let got = null;
    drawStalker = (e, pal) => { if (!got) got = pal; };
    const main = ctx, p0 = P, g0 = G; ctx = Z3_NULL; if (!P) P = { x: 100, y: 0, z: 0, r: 13, face: 1, anim: 0 }; if (!G) G = { t: 0, enemies: [], fx: [] };
    try { fn({ x: 0, y: 0, z: 0, r: ENEMIES[id].r || 13, anim: 0, face: 1, id, d: ENEMIES[id], hp: 1, maxhp: 1, alpha: 1, seed: 1, t: 0, state: 0, sc: 1 }); } catch (e) { /* needs live state */ } finally { drawStalker = ds; ctx = main; P = p0; G = g0; }
    if (got && !ENEMIES[id].boss) MDL.human[id] = got;
  }
});

// ---------- posing ----------
// writes one rig into the instance buffers. pose(i) gives each joint's rotation [x, y, z]; colour(key) its colour.
function mdlRig(rig, root, pose, colour, size, hidden) {
  for (let i = 0; i < rig.length; i++) {
    const [, par, at, shape, off, sz, key] = rig[i];
    const r = pose[i];
    _eul.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _q.setFromEuler(_eul);
    const sk = size(i);
    _v.set(at[0] * sk[3], at[1] * sk[4], at[2] * sk[5]);
    _mJ[i].compose(_v, _q, _one).premultiply(par < 0 ? root : _mJ[par]);
    if (hidden(i, key) || (MDL.lite && (key === 'boot' || key === 'eyes' || key === 'mask' || key === 'tusk' || (rig === RIG_Q && (i === 3 || i === 4))))) continue;
    const mesh = MDL.ghost ? (shape === 'box' ? MDL.tbox : shape === 'sph' ? MDL.tsph : MDL.tcyl) : shape === 'box' ? MDL.box : shape === 'sph' ? MDL.sph : MDL.cyl;
    if (mesh.count >= mesh.cap) continue;
    _mT.makeTranslation(off[0] * sk[3], off[1] * sk[4], off[2] * sk[5]); _mS.makeScale(sz[0] * sk[0], sz[1] * sk[1], sz[2] * sk[2]);
    _mM.copy(_mJ[i]).multiply(_mT).multiply(_mS);
    mesh.setMatrixAt(mesh.count, _mM); colour(key, _col); mesh.setColorAt(mesh.count, _col); mesh.count++;
  }
}
const _mRoot = M4(), _vS = new THREE.Vector3();
function mdlRoot(x, y, h, yaw, s, tiltZ, tiltX) {
  _q.setFromEuler(_eul.set(tiltX || 0, -yaw, tiltZ || 0, 'YXZ'));
  _v.set(x, h, y); _vS.set(s, s, s); _mRoot.compose(_v, _q, _vS); _eul.order = 'XYZ'; return _mRoot;
}
const _poseH = []; for (let i = 0; i < RIG_H.length; i++) _poseH.push([0, 0, 0]);
const _poseQ = []; for (let i = 0; i < RIG_Q.length; i++) _poseQ.push([0, 0, 0]);
const ONE6 = [1, 1, 1, 1, 1, 1];
// a person: walking, holding a gun or reaching out (zombies), crouching (snorks), attacking, flinching
function mdlHuman(x, y, h, yaw, s, pal, st, tint) {
  const P_ = _poseH; for (const p of P_) { p[0] = 0; p[1] = 0; p[2] = 0; }
  const m = st.move, ph = st.ph, zomb = pal === (typeof PAL_ZOMBIE !== 'undefined' ? PAL_ZOMBIE : null) || st.zombie;
  const gun = pal.gun !== false && !zomb, crouch = pal.crouch || 0;
  const sw = Math.sin(ph) * 0.6 * m, sw2 = Math.sin(ph + Math.PI) * 0.6 * m;
  P_[10][2] = sw; P_[11][2] = -Math.max(0, Math.sin(ph - 1)) * 0.9 * m - 0.05 - crouch * 0.6;
  P_[13][2] = sw2; P_[14][2] = -Math.max(0, Math.sin(ph + Math.PI - 1)) * 0.9 * m - 0.05 - crouch * 0.6;
  P_[10][2] += crouch * 0.6; P_[13][2] += crouch * 0.6;
  P_[1][2] = -0.08 * m - crouch - (st.atk ? 0.25 : 0) + (st.flinch ? 0.35 : 0);
  P_[1][1] = Math.sin(ph) * 0.12 * m;
  if (zomb) { // arms out, shuffling, head lolling
    P_[6][2] = 1.35 + Math.sin(NOW * 3 + st.seed) * 0.15; P_[8][2] = 1.25 + Math.sin(NOW * 3.3 + st.seed) * 0.15; P_[7][2] = 0.15; P_[9][2] = 0.2;
    P_[2][0] = Math.sin(NOW * 1.7 + st.seed) * 0.25; P_[1][0] = Math.sin(ph * 0.5) * 0.08;
  } else if (gun) { // weapon raised towards the target
    P_[8][2] = 1.25; P_[9][2] = 0.35; P_[8][0] = -0.25; P_[6][2] = 1.15; P_[7][2] = 0.75; P_[6][0] = 0.45;
  } else {
    P_[6][2] = -sw * 0.8 + crouch * 0.6; P_[8][2] = -sw2 * 0.8 + crouch * 0.6; P_[7][2] = 0.35; P_[9][2] = 0.35;
  }
  if (st.atk && !gun) { const k = Math.sin(NOW * 13 + st.seed); P_[8][2] = 1.4 + k * 0.7; P_[6][2] = 1.4 - k * 0.7; }
  P_[2][2] = crouch * 0.7;
  const hs = pal.headS || 1, thin = pal.thin || 1, wide = pal.wide || 1, hh = pal.h || 1, ls = pal.legS || 1, aR = pal.armR || 1, aL = pal.armL || 1;
  const size = (i) => i === 2 || i === 3 || i === 4 || i === 17 ? [hs, hs, hs, 1, 1, 1] : i === 0 ? [wide, 1, wide, 1, ls, 1] : i === 1 ? [thin * wide, 1, thin * wide, 1, 1, wide]
    : i === 6 || i === 7 ? [thin, aL, thin, 1, i === 7 ? aL : 1, wide] : i === 8 || i === 9 ? [thin, aR, thin, 1, i === 9 ? aR : 1, wide]
      : i === 10 || i === 13 || i === 11 || i === 14 ? [thin, ls, thin, 1, i === 11 || i === 14 ? ls : 1, wide] : i === 12 || i === 15 ? [1, 1, 1, 1, ls, 1] : ONE6;
  const hidden = (i, key) => (key === 'hood' && !pal.hood) || (key === 'mask' && !pal.mask) || (key === 'pack' && !pal.pack) || (key === 'gun' && !gun) || (key === 'eyes' && !pal.eyes && !zomb) || (ls < 0.05 && i >= 10 && i <= 15);
  if (pal.float) h += pal.float + Math.sin(NOW * 2 + st.seed) * 3;
  const C = st.cols || (st.cols = mdlColsH(pal, zomb));
  const colour = (key, out) => { out.copy(C[key] || C.jacket); if (tint) out.lerp(tint, tint.k); };
  MDL.ghost = !!pal.ghost || !!st.cloak;
  mdlRig(RIG_H, mdlRoot(x, y, h - (crouch ? crouch * 6 : 0) - (1 - ls) * 26 * s * hh, yaw, s * hh, st.fall || 0, st.fallX || 0), P_, colour, size, hidden);
  MDL.ghost = false;
}
function mdlColsH(pal, zomb) {
  const c = (v, d) => hexc(typeof v === 'string' ? v : d);
  return { pants: c(pal.pants, '#3a3e2e'), jacket: c(pal.jacket, '#56603f'), jacket2: c(pal.jacket2 || pal.jacket, '#3e462e'), face: c(pal.face, '#9a8270'), hood: c(pal.hood, '#4a5438'),
    mask: c(typeof pal.mask === 'string' ? pal.mask : '#2c2e28', '#2c2e28'), pack: c(pal.pack, '#4e4632'), boot: hexc('#2a2622'), gun: hexc('#26272a'), eyes: hexc(pal.eyes || (zomb ? '#ff3a1a' : '#ffffff'), 1.6) };
}
// a four-legged mutant: trotting, leaping, biting
function mdlQuad(x, y, h, yaw, s, Q, st, tint) {
  const P_ = _poseQ; for (const p of P_) { p[0] = 0; p[1] = 0; p[2] = 0; }
  const m = st.move, ph = st.ph, air = st.air;
  const a = Math.sin(ph) * 0.7 * m, b = Math.sin(ph + Math.PI) * 0.7 * m;
  P_[8][2] = air ? 0.9 : a; P_[14][2] = air ? -0.9 : a; P_[10][2] = air ? 0.9 : b; P_[12][2] = air ? -0.9 : b;
  P_[9][2] = -Math.max(0, Math.sin(ph - 1)) * 0.7 * m; P_[15][2] = -Math.max(0, Math.sin(ph - 1)) * 0.7 * m;
  P_[11][2] = -Math.max(0, Math.sin(ph + Math.PI - 1)) * 0.7 * m; P_[13][2] = -Math.max(0, Math.sin(ph + Math.PI - 1)) * 0.7 * m;
  P_[0][2] = Math.sin(ph * 2) * 0.05 * m + (air ? -0.15 : 0);
  P_[1][2] = (st.atk ? -0.35 + Math.sin(NOW * 15 + st.seed) * 0.35 : Math.sin(ph * 2) * 0.08 * m) + (st.flinch ? 0.4 : 0);
  P_[5][1] = Math.sin(NOW * 9 + st.seed) * 0.5; P_[5][2] = 0.35;
  const bs = Q.bodyS || [1, 1, 1], hs = Q.headS || 1, ll = Q.legL || 1, tl = Q.tailL || 1;
  const size = (i) => i === 0 || i === 20 ? [bs[0], bs[1], bs[2], bs[0], bs[1], bs[2]] : i >= 1 && i <= 4 || i === 19 ? [hs, hs, hs, bs[0], bs[1], bs[2]] : i === 5 ? [tl, 1, 1, bs[0], 1, bs[2]] : i >= 8 && i <= 15 ? [1, ll, 1, bs[0], ll, bs[2]] : i === 16 || i === 6 || i === 7 || i === 17 || i === 18 ? [hs, hs, hs, 1, 1, 1] : ONE6;
  const hidden = (i, key) => (key === 'tusk' && !Q.tusk) || (key === 'eyes' && !Q.eyes) || (i === 5 && Q.noTail) || ((i === 17 || i === 18) && !Q.horn) || (i === 19 && !Q.two) || (i === 20 && !Q.spikes);
  P_[17][2] = -0.4; P_[18][2] = -0.4; P_[17][0] = -0.35; P_[18][0] = 0.35; P_[19][2] = P_[1][2] * -1 + 0.1;
  const C = st.cols || (st.cols = { body: hexc(Q.body), head: hexc(Q.head || Q.body), snout: hexc(Q.snout || Q.body), leg: hexc(Q.leg || Q.body), tusk: hexc(Q.tusk || '#ddd'), eyes: hexc(Q.eyes || '#fff', 1.6), horn: hexc(Q.horn || Q.spikes || '#ccc') });
  const colour = (key, out) => { out.copy(C[key] || C.body); if (tint) out.lerp(tint, tint.k); };
  const lift = -(ll - 1) * 15;
  mdlRig(RIG_Q, mdlRoot(x, y, h - lift + Math.abs(Math.sin(ph)) * 1.2 * m, yaw, s * (Q.sz || 1), st.fall || 0, st.fallX || 0), P_, colour, size, hidden);
}

// ---------- the odd ones: built part by part ----------
const _mP = M4(), _vP = new THREE.Vector3(), _sP = new THREE.Vector3(), _qP = new THREE.Quaternion(), _eP = new THREE.Euler();
// one part in world space: position, rotation (yaw/pitch/roll), size, colour; mesh picks box/sphere/cylinder (or glowing)
function mdlPart(mesh, x, h, y, ry, rx, rz, sx, sy, sz, col, k) {
  if (mesh.count >= mesh.cap) return;
  _eP.set(rx, ry, rz, 'YXZ'); _qP.setFromEuler(_eP); _mP.compose(_vP.set(x, h, y), _qP, _sP.set(sx, sy, sz));
  mesh.setMatrixAt(mesh.count, _mP); _col.set(col); if (k) _col.multiplyScalar(k); mesh.setColorAt(mesh.count, _col); mesh.count++;
}
const ODD = {
  // floating balls of energy with bits of rubbish circling them
  orb: (e, st, s, c1, c2) => {
    const h = (e.z || 0) + 32 * s + Math.sin(NOW * 2 + st.seed) * 4, r = 12 * s * (1 + Math.sin(NOW * 9 + st.seed) * 0.08);
    mdlPart(MDL.gsph, e.x, h, e.y, 0, 0, 0, r * 2, r * 2, r * 2, c1);
    MDL.ghost = true; mdlPart(MDL.tsph, e.x, h, e.y, 0, 0, 0, r * 3.4, r * 3.4, r * 3.4, c2); MDL.ghost = false;
    for (let i = 0; i < 5; i++) { const a = NOW * 2.2 + i * 1.26 + st.seed, R = 26 * s; mdlPart(MDL.box, e.x + Math.cos(a) * R, h + Math.sin(a * 1.7) * 8, e.y + Math.sin(a) * R, a, a * 1.3, 0, 5 * s, 4 * s, 6 * s, '#5a5048'); }
  },
  // a huge floating eye that watches you
  eye: (e, st, s) => {
    const h = (e.z || 0) + 40 * s + Math.sin(NOW * 2 + st.seed) * 4, yaw = Math.atan2(P.y - e.y, P.x - e.x), r = 14 * s;
    mdlPart(MDL.sph, e.x, h, e.y, -yaw, 0, 0, r * 2, r * 2, r * 2, '#e8e0d0');
    const fx = Math.cos(yaw) * r * 0.82, fy = Math.sin(yaw) * r * 0.82;
    mdlPart(MDL.gsph, e.x + fx, h, e.y + fy, -yaw, 0, 0, r * 0.5, r * 1.1, r * 1.1, '#c03a20');
    mdlPart(MDL.gsph, e.x + fx * 1.08, h, e.y + fy * 1.08, -yaw, 0, 0, r * 0.3, r * 0.55, r * 0.55, '#000000');
  },
  // bats and crows: a body and two flapping wings
  wings: (e, st, s, col, span) => {
    const h = (e.z || 0) + 40 + Math.sin(NOW * 3 + st.seed) * 6, f = Math.sin(NOW * 22 + st.seed) * 0.9, yaw = st.yaw;
    mdlPart(MDL.sph, e.x, h, e.y, -yaw, 0, 0, 12 * s, 6 * s, 6 * s, col);
    const c = Math.cos(yaw), sn = Math.sin(yaw), rx = -sn, rz = c;
    for (const side of [-1, 1]) mdlPart(MDL.box, e.x + rx * side * 7 * s, h + Math.sin(f) * 4 * s, e.y + rz * side * 7 * s, -yaw, side * f, 0, 8 * s, 1 * s, span * s, col, 0.8);
    mdlPart(MDL.sph, e.x + c * 7 * s, h + 1.5 * s, e.y + sn * 7 * s, -yaw, 0, 0, 5 * s, 5 * s, 5 * s, col, 0.9);
  },
  // snakes, the serpent and larvae: a chain of segments following the head's path
  chain: (e, st, s, col, n, rr, eyes) => {
    const tr = st.trail || (st.trail = []);
    if (!tr.length || Math.hypot(e.x - tr[0][0], e.y - tr[0][1]) > 4 * s) { tr.unshift([e.x, e.y]); if (tr.length > n * 3) tr.length = n * 3; }
    for (let i = 0; i < n; i++) {
      const p = tr[Math.min(tr.length - 1, i * 2)] || [e.x, e.y], k = 1 - i / n * 0.6, w = Math.sin(NOW * 6 - i * 0.6) * 3 * s;
      mdlPart(i === 0 ? MDL.sph : MDL.sph, p[0] + w * 0.3, (e.z || 0) + rr * s * k, p[1] + w * 0.3, 0, 0, 0, rr * 2 * s * k * 1.2, rr * 1.6 * s * k, rr * 2 * s * k * 1.2, col, i % 2 ? 0.88 : 1);
    }
    if (eyes) { const c = Math.cos(st.yaw), sn = Math.sin(st.yaw); for (const sd of [-1, 1]) mdlPart(MDL.gsph, e.x + c * rr * 0.9 * s - sn * sd * rr * 0.5 * s, (e.z || 0) + rr * 1.3 * s, e.y + sn * rr * 0.9 * s + c * sd * rr * 0.5 * s, 0, 0, 0, 3 * s, 3 * s, 3 * s, eyes); }
  },
  // the military gunship
  heli: (e, st, s) => {
    const h = Math.max(90, (e.z || 0) + 110), yaw = st.yaw, c = Math.cos(yaw), sn = Math.sin(yaw), tilt = -0.12;
    mdlPart(MDL.box, e.x, h, e.y, -yaw, 0, tilt, 70 * s, 26 * s, 26 * s, '#3e4a34');
    mdlPart(MDL.sph, e.x + c * 34 * s, h - 2 * s, e.y + sn * 34 * s, -yaw, 0, tilt, 26 * s, 22 * s, 22 * s, '#2a3440');
    mdlPart(MDL.box, e.x - c * 62 * s, h + 6 * s, e.y - sn * 62 * s, -yaw, 0, 0, 70 * s, 7 * s, 7 * s, '#3a4630');
    mdlPart(MDL.box, e.x - c * 96 * s, h + 14 * s, e.y - sn * 96 * s, -yaw, 0, 0, 10 * s, 22 * s, 3 * s, '#3a4630');
    for (const sd of [-1, 1]) mdlPart(MDL.box, e.x - sn * sd * 16 * s, h - 18 * s, e.y + c * sd * 16 * s, -yaw, 0, 0, 60 * s, 3 * s, 3 * s, '#222');
    for (let i = 0; i < 2; i++) mdlPart(MDL.box, e.x, h + 18 * s, e.y, NOW * 30 + i * Math.PI / 2, 0, 0, 150 * s, 1.5 * s, 7 * s, '#151515');
    for (const sd of [-1, 1]) mdlPart(MDL.box, e.x + c * 10 * s - sn * sd * 20 * s, h - 6 * s, e.y + sn * 10 * s + c * sd * 20 * s, -yaw, 0, 0, 22 * s, 5 * s, 5 * s, '#26282a');
  },
  // the Monolith: a slowly turning crystal pillar, glowing
  crystal: (e, st, s) => {
    const h = (e.z || 0) + 10, t = NOW * 0.3 + st.seed;
    mdlPart(MDL.gbox, e.x, h + 75 * s, e.y, t, 0.05, 0, 34 * s, 150 * s, 34 * s, '#a8d8ff');
    mdlPart(MDL.gbox, e.x, h + 75 * s, e.y, -t * 1.3, 0, 0.08, 24 * s, 170 * s, 24 * s, '#e8f6ff');
    MDL.ghost = true; mdlPart(MDL.tsph, e.x, h + 80 * s, e.y, 0, 0, 0, 120 * s, 200 * s, 120 * s, '#80b8ff'); MDL.ghost = false;
    for (let i = 0; i < 6; i++) { const a = t * 2 + i * 1.05, R = 60 * s; mdlPart(MDL.gbox, e.x + Math.cos(a) * R, h + 40 * s + Math.sin(a * 2) * 30 * s, e.y + Math.sin(a) * R, a, a, 0, 8 * s, 20 * s, 8 * s, '#c8e8ff'); }
  },
};
const ODD_OF = {
  spark: (e, st, s) => ODD.orb(e, st, s, '#e8f6ff', '#60b0ff'), poltergeist: (e, st, s) => ODD.orb(e, st, s, '#ffe8c8', '#c08aff'),
  polterking: (e, st, s) => ODD.orb(e, st, s * 1.6, '#ffd8a8', '#ff6aa0'), eye: (e, st, s) => ODD.eye(e, st, s),
  bat: (e, st, s) => ODD.wings(e, st, s, '#2e2a28', 16), crow: (e, st, s) => ODD.wings(e, st, s, '#1e1e22', 14),
  snake: (e, st, s) => ODD.chain(e, st, s, '#5a6a3a', 9, 5, '#ffcc30'), serpent: (e, st, s) => ODD.chain(e, st, s, '#4a5a2e', 14, 11, '#ff5020'),
  larva: (e, st, s) => ODD.chain(e, st, s, '#d8c8a8', 6, 7, null), heli: (e, st, s) => ODD.heli(e, st, s), monolith: (e, st, s) => ODD.crystal(e, st, s),
};
{ const k0 = MDL.kindOf; MDL.kindOf = (id) => k0(id) || (ODD_OF[id] ? 'o' : null); }

// ---------- every frame: who moves how ----------
const _tint = new THREE.Color(); _tint.k = 0;
function mdlState(e) {
  const st = e._m || (e._m = { yaw: Math.atan2(P.y - e.y, P.x - e.x), px: e.x, py: e.y, ph: Math.random() * 6, move: 0, seed: Math.random() * 10 });
  const dx = e.x - st.px, dy = e.y - st.py, d = Math.hypot(dx, dy), dt = Math.max(0.001, NOW - (st.t || NOW - 0.016)); st.t = NOW; st.px = e.x; st.py = e.y;
  const v = d / dt; st.move += (clamp(v / 60, 0, 1) - st.move) * 0.25;
  st.ph += d * 0.16 + (v > 5 ? 0 : 0);
  let want = v > 8 ? Math.atan2(dy, dx) : Math.atan2(P.y - e.y, P.x - e.x);
  let da = want - st.yaw; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; st.yaw += da * 0.25;
  const pd = Math.hypot(P.x - e.x, P.y - e.y); st.atk = pd < (e.r || 12) + 34; st.flinch = e.flash > 0; st.air = (e.z || 0) > 6;
  return st;
}
function mdlFrame() {
  if (!MDL.ready) return;
  for (const m of [MDL.box, MDL.sph, MDL.cyl, MDL.tbox, MDL.tsph, MDL.tcyl, MDL.gbox, MDL.gsph, MDL.shd]) m.count = 0;
  MDL.lite = gfxLevel() >= 3; // phones: no boots, eyes, masks, tusks or ears
  const V2 = Z3.view * Z3.view, c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw);
  const shadow = (x, y, r) => { if (MDL.shd.count >= 900) return; _mM.compose(_v.set(x, 0.7, y), _q.identity(), _vS.set(r, 1, r)); MDL.shd.setMatrixAt(MDL.shd.count++, _mM); };
  for (const e of G.enemies) {
    if (e.dead) continue; const k = MDL.kindOf(e.id); if (!k) continue;
    const dx = e.x - P.x, dy = e.y - P.y; if (dx * dx + dy * dy > V2 || dx * c + dy * s < -150) continue;
    let a = e.alpha === undefined ? 1 : e.alpha; if (a < 0.35) continue;
    const st = mdlState(e), vs = (e.sc || 1) * (e.d && e.d.vsc || 1);
    let tint = null;
    if (e.flash > 0) { _tint.setRGB(1, 1, 1); _tint.k = 0.65; tint = _tint; }
    else if (e.affix || e.mini) { _tint.set(e.mini ? '#ffb830' : (ELITE_AFFIX[e.affix] || {}).color || '#ffb830'); _tint.k = 0.22; tint = _tint; }
    else if (e.frozen && e.stun > 0) { _tint.setRGB(0.65, 0.85, 1); _tint.k = 0.55; tint = _tint; }
    else if (e.state === 1 && !e.boss) { _tint.setRGB(1, 0.45, 0.1); _tint.k = 0.3 + Math.sin(NOW * 18) * 0.2; tint = _tint; } // winding up an attack
    if (k === 'o') { ODD_OF[e.id](e, st, (e.sc || 1) * (e.d && e.d.vsc || 1) * (e.boss ? 1.3 : 1)); continue; }
    st.cloak = e.alpha !== undefined && e.alpha < 0.9;
    if (k === 'h') { const pal = MDL.human[e.id]; mdlHuman(e.x, e.y, e.z || 0, st.yaw, (e.r || 13) / 13 * vs * 0.92, pal, st, tint); shadow(e.x, e.y, (e.r || 13) * 2.2 * vs); }
    else { mdlQuad(e.x, e.y, e.z || 0, st.yaw, (e.r || 12) / 12 * vs, QPAL[e.id], st, tint); shadow(e.x, e.y, (e.r || 12) * 2.8 * vs); }
  }
  // the companion dog, teammates, quest people
  if (G.pet && !G.pet.dead) { const st = mdlState(G.pet); mdlQuad(G.pet.x, G.pet.y, G.pet.z || 0, st.yaw, 0.9, QPAL.dog, st, null); shadow(G.pet.x, G.pet.y, 26); }
  if (typeof CO !== 'undefined' && CO.active && typeof coOthers === 'function') for (const q of coOthers()) {
    if (q.gone || q.x === undefined) continue; const st = mdlState(q); st.atk = false;
    const pal = coPal(q.char); mdlHuman(q.x, q.y, 0, st.yaw, 0.95, pal, st, q.ghost ? (_tint.setRGB(0.6, 0.6, 0.6), _tint.k = 0.5, _tint) : null); shadow(q.x, q.y, 28);
  }
  if (typeof Quests !== 'undefined') for (const q of Quests.list) { const n = q.npc; if (!n || n.dead || n.x === undefined) continue; const st = mdlState(n); st.atk = false; mdlHuman(n.x, n.y, 0, st.yaw, 0.92, typeof SCI_PAL !== 'undefined' ? SCI_PAL : {}, st, null); shadow(n.x, n.y, 28); }
  // the fallen: they drop, lie a while and sink into the ground
  for (let i = MDL.corpses.length - 1; i >= 0; i--) {
    const b = MDL.corpses[i], age = NOW - b.t;
    if (age > 7 || dist2(b.x, b.y, P.x, P.y) > V2) { if (age > 7) MDL.corpses.splice(i, 1); continue; }
    const st = b.st; st.move = 0; st.atk = false; st.flinch = false; st.air = false;
    const f = Math.min(1, age / 0.35); st.fall = b.dir * (Math.PI / 2) * (f * f); const sink = age > 4.5 ? (age - 4.5) * 6 : 0;
    _tint.setRGB(0.25, 0.22, 0.2); _tint.k = clamp((age - 0.5) / 4, 0, 0.4);
    if (b.k === 'h') mdlHuman(b.x, b.y, -sink, st.yaw, b.s, b.pal, st, _tint); else mdlQuad(b.x, b.y, -sink, st.yaw, b.s, b.pal, st, _tint);
  }
  for (const f of MDL.extra || []) { try { f(); } catch (er) { if (typeof guardReport === 'function') guardReport('mdl-extra', er); } }
  for (const m of [MDL.box, MDL.sph, MDL.cyl, MDL.tbox, MDL.tsph, MDL.tcyl, MDL.gbox, MDL.gsph, MDL.shd]) mdlUpload(m);
}
{
  const _ke = killEnemy;
  killEnemy = function (e) {
    const was = e && !e.dead;
    const r = _ke.apply(this, arguments);
    try {
      if (was && Z3_MODE && MDL.ready && e.dead) {
        const k = MDL.kindOf(e.id);
        if (k && k !== 'o' && dist2(e.x, e.y, P.x, P.y) < Z3.view * Z3.view) {
          const st = Object.assign({}, e._m || mdlState(e)); st.cols = e._m && e._m.cols;
          const vs = (e.sc || 1) * (e.d && e.d.vsc || 1);
          MDL.corpses.push({ k, x: e.x, y: e.y, t: NOW, st, dir: Math.random() < 0.5 ? 1 : -1, s: k === 'h' ? (e.r || 13) / 13 * vs * 0.92 : (e.r || 12) / 12 * vs, pal: k === 'h' ? MDL.human[e.id] : QPAL[e.id] });
          if (MDL.corpses.length > 40) MDL.corpses.shift();
        }
      }
    } catch (er) { /* keep the kill */ }
    return r;
  };
}
