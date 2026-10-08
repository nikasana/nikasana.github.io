'use strict';
// ---------- ZoneBonk 3D: a first-person view over the unchanged game ----------
// The game keeps simulating on its flat map (x, y on the ground). This file draws that same state with three.js from
// the player's eyes and turns mouse/touch looking into the game's own movement and aiming:
//  - world (x, y) is three.js (x, height, y); one game unit is one 3D unit
//  - the ground is the game's own terrain tiles; everything the game paints flat on the ground (anomalies, gems,
//    hazards, explosions, decals…) comes from running the original renderer top-down into a texture under you
//  - buildings, fences and wrecks are 3D blocks; trees, props, mutants and pickups are upright sprites made by the
//    game's own drawing functions (classic shooter style), so new mutants and props show up without extra work
//  - movement keys and the joystick are turned by where you look; weapons aim where you look (or 360° like before)
const Z3 = {
  ok: false, on: false, yaw: -Math.PI / 2, pitch: 0, locked: false, wasLocked: false,
  eye: 50, fov: 75, A: 0.42, farK: 1, // aim cone half-angle (radians); view distance factor (adapts to FPS)
  ovN: 1024, ovR: 760, view: 1500,
  chunks: new Map(), chunkSrc: null, propsRef: null, propsLen: -1, stamp: 1,
  target: null, prof: { flat: 0, build: 0, gl: 0, ov: 0 },
};
const Z3_PHONE = typeof IS_PHONE !== 'undefined' && IS_PHONE;
if (Z3_PHONE) Z3.A = 0.52; // thumbs aim less precisely than a mouse
const z3Tr = (s) => (typeof I18n !== 'undefined' && I18n.cur !== 'en' && I18n.tc ? I18n.tc(s) : s);
const z3Set = () => (Save.set || (Save.set = {}));
const z3AimMode = () => z3Set().aim3d || 'look';
const z3Sens = () => +(z3Set().sens3d || 1);
const z3Fov = () => +(z3Set().fov3d || 75);

// ---------- canvases ----------
const Z3C = { gl: null, ov: null, og: null, hint: null };
(function z3Init() {
  if (typeof THREE === 'undefined') return;
  THREE.ColorManagement.enabled = false;
  const gl = document.createElement('canvas'); gl.id = 'z3gl';
  gl.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:none;';
  const ov = document.createElement('canvas'); ov.id = 'z3ov';
  ov.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:none;pointer-events:none;';
  cv.parentNode.insertBefore(gl, cv); cv.parentNode.insertBefore(ov, cv);
  let R;
  try { R = new THREE.WebGLRenderer({ canvas: gl, antialias: !Z3_PHONE, powerPreference: 'high-performance' }); } catch (e) { return; }
  R.outputColorSpace = THREE.LinearSRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.autoClear = true;
  Z3.R = R; Z3C.gl = gl; Z3C.ov = ov; Z3C.og = ov.getContext('2d');
  Z3.scene = new THREE.Scene();
  Z3.fog = new THREE.Fog(0x8a9088, 250, 1500); Z3.scene.fog = Z3.fog;
  Z3.scene.background = new THREE.Color(0x8a9088);
  Z3.cam = new THREE.PerspectiveCamera(75, 1, 2, 4000);
  Z3.aniso = Math.min(8, R.capabilities.getMaxAnisotropy());
  Z3.PAGE = Z3_PHONE ? 1024 : 2048;
  // the flat-effects layer: the original renderer runs top-down into the game canvas, which becomes this texture
  Z3.ovTex = new THREE.CanvasTexture(cv); Z3.ovTex.generateMipmaps = false; Z3.ovTex.minFilter = THREE.LinearFilter;
  Z3.ovMat = new THREE.MeshBasicMaterial({ map: Z3.ovTex, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  Z3.ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), Z3.ovMat); Z3.ovMesh.rotation.x = -Math.PI / 2; Z3.ovMesh.renderOrder = 1;
  Z3.ovMesh.frustumCulled = false; Z3.scene.add(Z3.ovMesh);
  Z3.chunkGeo = new THREE.PlaneGeometry(CHUNK, CHUNK); Z3.chunkGeo.rotateX(-Math.PI / 2);
  {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 2600; i++) { const v = 90 + Math.random() * 80; g.fillStyle = `rgb(${v},${v},${v})`; const s = 1 + Math.random() * 3; g.fillRect(Math.random() * N, Math.random() * N, s, s); }
    g.lineWidth = 1.2; for (let i = 0; i < 900; i++) { const x = Math.random() * N, y = Math.random() * N, v = 100 + Math.random() * 70; g.strokeStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 5); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Z3.aniso; Z3.detailTex = t;
  }
  Z3.solid = new THREE.Group(); Z3.scene.add(Z3.solid);
  Z3.hemi = new THREE.HemisphereLight(0xdfe6ef, 0x4a4434, 0.7); Z3.scene.add(Z3.hemi);
  Z3.sun = new THREE.DirectionalLight(0xfff0d8, 1.0); Z3.sun.position.set(-0.55, 1, 0.35); Z3.scene.add(Z3.sun); Z3.scene.add(Z3.sun.target);
  { const sc = Z3.sun.shadow.camera; sc.left = -650; sc.right = 650; sc.top = 650; sc.bottom = -650; sc.near = 10; sc.far = 3200; Z3.sun.shadow.mapSize.set(2048, 2048); Z3.sun.shadow.bias = -0.0008; Z3.sun.shadow.normalBias = 1.5; }
  // sky: a dome that follows you, lighter at the horizon; stars come out at night
  {
    const g = new THREE.SphereGeometry(3200, 24, 12), n = g.attributes.position.count, col = new Float32Array(n * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    Z3.skyGeo = g; Z3.sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    Z3.sky.renderOrder = -1; Z3.sky.frustumCulled = false; Z3.scene.add(Z3.sky);
    const sp = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) { const a = Math.random() * TAU, e = 0.15 + Math.random() * 1.3, r = 3000; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    Z3.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdde6ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
    Z3.stars.renderOrder = -1; Z3.stars.frustumCulled = false; Z3.scene.add(Z3.stars);
  }
  Z3.ok = true;
  // desktop: a short hint until the mouse is captured
  const h = document.createElement('div'); h.id = 'z3hint';
  h.style.cssText = 'position:fixed;left:50%;bottom:26%;transform:translateX(-50%);z-index:30;display:none;pointer-events:none;background:rgba(10,10,8,0.75);color:#ffe9b0;border:1px solid #6a5a2a;border-radius:8px;padding:8px 14px;font:14px Oswald,sans-serif;text-align:center';
  document.body.appendChild(h); Z3C.hint = h;
})();

// ---------- sprite atlas: the game's own drawings, rendered once into shared GPU pages ----------
const SPR3 = {
  map: new Map(), pages: [], cur: 0, S: Z3_PHONE ? 1.15 : 1.6, MAXP: Z3_PHONE ? 6 : 8,
  newPage() {
    const N = Z3.PAGE, t = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
    Z3.R.initTexture(t); t.image.data = null; // only the GPU copy is needed from here on
    const pg = { t, x: 0, y: 0, rh: 0, bb: new BB3(t) };
    this.pages.push(pg); Z3.scene.add(pg.bb.mesh);
    return pg;
  },
  // (ox, oy, w, h): the box (relative to the anchor, y down like the game) that draw() may paint into
  get(key, ox, oy, w, h, draw, sk = 1) {
    let sp = this.map.get(key);
    if (sp) return sp;
    const tc = performance.now(); let s = this.S * sk;
    s = Math.min(s, (Z3.PAGE - 8) / w, (Z3.PAGE - 8) / h);
    const W = Math.max(1, Math.ceil(w * s)), H = Math.max(1, Math.ceil(h * s));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    z3Offscreen(g, draw);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    try {
      const d = g.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y++) for (let x = 0, i = y * W * 4 + 3; x < W; x++, i += 4) if (d[i] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    } catch (e) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
    if (x1 < 0) { sp = { none: true }; this.map.set(key, sp); return sp; }
    const tw = x1 - x0 + 1, th = y1 - y0 + 1, N = Z3.PAGE, pad = 2;
    let pg = this.pages[this.cur];
    if (pg && pg.x + tw + pad > N) { pg.y += pg.rh + pad; pg.x = 0; pg.rh = 0; }
    if (!pg || pg.y + th + pad > N) {
      if (this.cur + 1 < this.pages.length) this.cur++;
      else if (this.pages.length < this.MAXP) { this.newPage(); this.cur = this.pages.length - 1; }
      else { this.map.clear(); this.cur = 0; } // every page is full: start over, sprites are drawn again as they are needed
      pg = this.pages[this.cur]; pg.x = 0; pg.y = 0; pg.rh = 0;
    }
    const t = document.createElement('canvas'); t.width = tw; t.height = th;
    t.getContext('2d').drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
    Z3.R.copyTextureToTexture(new THREE.Vector2(pg.x, pg.y), { image: t }, pg.t);
    sp = { pg, u0: pg.x / N, v0: pg.y / N, u1: (pg.x + tw) / N, v1: (pg.y + th) / N, x: ox + x0 / s, y: oy + y0 / s, w: tw / s, h: th / s };
    pg.x += tw + pad; if (th > pg.rh) pg.rh = th;
    this.map.set(key, sp); this.made = (this.made || 0) + 1; this.ms = (this.ms || 0) + performance.now() - tc;
    return sp;
  },
};
// run one of the game's drawing functions into another canvas, with no ground shadow and no see-through fading
function z3Offscreen(g, draw) {
  const main = ctx, sh = shadow, oc = occludes, cam = { x: CAM.x, y: CAM.y }, fl = FL;
  ctx = g; shadow = () => {}; occludes = () => false; CAM.x = 0; CAM.y = 0;
  try { draw(); } catch (e) { /* needs live state: leave it empty */ } finally { ctx = main; shadow = sh; occludes = oc; CAM.x = cam.x; CAM.y = cam.y; FL = fl; }
}

// upright sprites of one atlas page, rebuilt every frame into one draw call; they turn to face you (around the
// vertical axis only). Transparency is dithered, so no sorting is needed.
const BB_VS = `attribute float a; varying vec2 vUv; varying float vA; varying float vD;
void main(){ vUv = uv; vA = a; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
const BB_FS = `uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float bright;
varying vec2 vUv; varying float vA; varying float vD;
float bayer(vec2 p){ vec2 f = mod(floor(p), 4.0); float i = f.x + f.y * 4.0; return mod(i * 7.0, 16.0) / 16.0 + 1.0 / 32.0; }
void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.45) discard; float a = abs(vA); if (a < 0.99 && a < bayer(gl_FragCoord.xy)) discard;
  vec3 c = vA < 0.0 ? mix(t.rgb, vec3(1.0), 0.75) : t.rgb * bright;
  gl_FragColor = vec4(mix(c, fogColor, smoothstep(fogNear, fogFar, vD)), 1.0); }`;
class BB3 {
  constructor(tex) {
    this.cap = 2048; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.cap * 12); this.uv = new Float32Array(this.cap * 8); this.al = new Float32Array(this.cap * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('a', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint32Array(this.cap * 6);
    for (let i = 0; i < this.cap; i++) { const v = i * 4, k = i * 6; idx[k] = v; idx[k + 1] = v + 2; idx[k + 2] = v + 1; idx[k + 3] = v + 1; idx[k + 4] = v + 2; idx[k + 5] = v + 3; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: BB_VS, fragmentShader: BB_FS, uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color() }, fogNear: { value: 250 }, fogFar: { value: 1500 }, bright: { value: 1 } }, side: THREE.DoubleSide });
    this.geo = g; this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
  }
  // sp hangs from the anchor (wx, wy) at height h0; sx/sy scale it, mirror flips it, a fades/flashes it
  push(sp, wx, wy, h0, sx, sy, mirror, a) {
    if (this.n >= this.cap) return;
    const rx = Z3.rx, rz = Z3.rz;
    let l = sp.x * sx, r = (sp.x + sp.w) * sx, u0 = sp.u0, u1 = sp.u1;
    if (mirror) { const t = l; l = -r; r = -t; u0 = sp.u1; u1 = sp.u0; }
    const top = h0 - sp.y * sy, bot = h0 - (sp.y + sp.h) * sy;
    const p = this.pos, i = this.n * 12;
    p[i] = wx + rx * l; p[i + 1] = top; p[i + 2] = wy + rz * l;
    p[i + 3] = wx + rx * r; p[i + 4] = top; p[i + 5] = wy + rz * r;
    p[i + 6] = wx + rx * l; p[i + 7] = bot; p[i + 8] = wy + rz * l;
    p[i + 9] = wx + rx * r; p[i + 10] = bot; p[i + 11] = wy + rz * r;
    const u = this.uv, j = this.n * 8;
    u[j] = u0; u[j + 1] = sp.v0; u[j + 2] = u1; u[j + 3] = sp.v0; u[j + 4] = u0; u[j + 5] = sp.v1; u[j + 6] = u1; u[j + 7] = sp.v1;
    const al = this.al, k = this.n * 4; al[k] = al[k + 1] = al[k + 2] = al[k + 3] = a;
    this.n++;
  }
  begin() { this.n = 0; }
  end() {
    const g = this.geo;
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.a.needsUpdate = true;
    g.setDrawRange(0, this.n * 6); this.mesh.visible = this.n > 0;
    const u = this.mat.uniforms; u.fogColor.value.copy(Z3.fog.color); u.fogNear.value = Z3.fog.near; u.fogFar.value = Z3.fog.far; u.bright.value = Z3.bright;
  }
}
const z3Push = (sp, wx, wy, h0, sx, sy, mirror, a) => { if (sp && !sp.none && sp.pg) sp.pg.bb.push(sp, wx, wy, h0, sx, sy, mirror, a); };

// ---------- glowing points: bullets, enemy shots, sparks, thrown things ----------
const PT_VS = `attribute vec4 c; attribute float s; uniform float k; varying vec4 vC; varying float vD;
void main(){ vC = c; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_PointSize = clamp(s * k / max(1.0, -mv.z), 1.0, 96.0); gl_Position = projectionMatrix * mv; }`;
const PT_FS = `uniform float fogFar; varying vec4 vC; varying float vD;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; float f = 1.0 - smoothstep(fogFar * 0.7, fogFar, vD);
  gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r * 3.2) * f); }`;
class PT3 {
  constructor(add) {
    this.cap = 6000; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.cap * 3); this.c = new Float32Array(this.cap * 4); this.s = new Float32Array(this.cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('c', new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('s', new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PT_VS, fragmentShader: PT_FS, uniforms: { k: { value: 600 }, fogFar: { value: 1500 } }, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.geo = g; this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    Z3.scene.add(this.mesh);
  }
  push(x, h, y, size, r, g, b, a) {
    if (this.n >= this.cap || this.n >= (Z3.ptCap || this.cap)) return;
    const i = this.n * 3, j = this.n * 4;
    this.pos[i] = x; this.pos[i + 1] = h; this.pos[i + 2] = y;
    this.c[j] = r; this.c[j + 1] = g; this.c[j + 2] = b; this.c[j + 3] = a; this.s[this.n] = size; this.n++;
  }
  begin() { this.n = 0; }
  end() {
    const g = this.geo; g.attributes.position.needsUpdate = true; g.attributes.c.needsUpdate = true; g.attributes.s.needsUpdate = true;
    g.setDrawRange(0, this.n); this.mesh.visible = this.n > 0;
    this.mat.uniforms.k.value = Z3.ptK; this.mat.uniforms.fogFar.value = Z3.fog.far;
  }
}
const Z3_BC = { bolt: [0.75, 0.75, 0.7], flame: [1, 0.5, 0.12], arrow: [0.86, 0.7, 0.47], laser: [1, 0.3, 0.25], radball: [0.6, 1, 0.3], swarm: [1, 0.85, 0.3], gorb: [0.7, 0.45, 1], boom: [1, 0.6, 0.2], saw: [0.85, 0.88, 0.92], rivet: [0.7, 0.72, 0.75], acid: [0.55, 1, 0.35] };
const RGB3 = new Map();
function z3rgb(s) { // "r,g,b" → [r, g, b] in 0..1
  let v = RGB3.get(s); if (v) return v;
  const m = String(s).split(','); v = [(+m[0] || 0) / 255, (+m[1] || 0) / 255, (+m[2] || 0) / 255];
  if (RGB3.size > 500) RGB3.clear(); RGB3.set(s, v); return v;
}
function z3hex(h) { let v = RGB3.get(h); if (v) return v; const n = parseInt(String(h).slice(1, 7), 16) || 0; v = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; RGB3.set(h, v); return v; }
if (Z3.ok) { Z3.ptAdd = new PT3(true); Z3.ptNorm = new PT3(false); }

// ---------- buildings, fences and wrecks: 3D blocks ----------
function z3WallTex(style, alt) {
  const S = BSTYLE[style] || BSTYLE.house, wall = alt ? S.wall : S.wall2;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = `rgb(${wall.join(',')})`; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * 128, Math.random() * 64, 6 + Math.random() * 20, 3 + Math.random() * 10); }
  if (style !== 'lab') {
    g.fillStyle = 'rgba(40,58,64,0.95)'; g.fillRect(44, 18, 40, 26);
    g.fillStyle = 'rgba(160,190,200,0.25)'; g.fillRect(48, 30, 12, 10);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(40, 15, 48, 4);
  } else { g.fillStyle = 'rgba(20,22,24,0.8)'; g.fillRect(0, 40, 128, 5); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 60, 128, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Z3.aniso;
  return t;
}
function z3Solids() {
  const grp = Z3.solid;
  for (const m of grp.children.slice()) { grp.remove(m); m.geometry.dispose(); }
  if (!Z3.wallMats) Z3.wallMats = new Map();
  const walls = new Map(), flat = { p: [], c: [] };
  const wallOf = (k) => { let w = walls.get(k); if (!w) walls.set(k, w = { p: [], u: [], c: [] }); return w; };
  // one vertical wall face from (x0,y0) to (x1,y1), height h; shade darkens it by direction like sunlight
  const face = (W, x0, y0, x1, y1, h, shade) => {
    const len = Math.hypot(x1 - x0, y1 - y0), uL = len / 128, vH = h / 64;
    W.p.push(x0, 0, y0, x1, 0, y1, x1, h, y1, x0, 0, y0, x1, h, y1, x0, h, y0);
    W.u.push(0, 0, uL, 0, uL, vH, 0, 0, uL, vH, 0, vH);
    for (let i = 0; i < 6; i++) W.c.push(shade, shade, shade);
  };
  const box = (W, x, y, w, d, h) => { // four walls of an axis-aligned block
    face(W, x, y + d, x + w, y + d, h, 1); face(W, x + w, y, x, y, h, 0.95);
    face(W, x, y, x, y + d, h, 0.95); face(W, x + w, y + d, x + w, y, h, 1);
  };
  const flatQuad = (x, y, w, d, h, col) => { // a flat top (roof) in a solid colour
    const F = flat; F.p.push(x, h, y, x, h, y + d, x + w, h, y + d, x, h, y, x + w, h, y + d, x + w, h, y);
    for (let i = 0; i < 6; i++) F.c.push(col[0] / 255, col[1] / 255, col[2] / 255);
  };
  const colBox = (x, y, w, d, h, col) => { // a block in one colour, sides a little darker
    const F = flat, add = (pts, k) => { for (let i = 0; i < pts.length; i += 3) { F.p.push(pts[i], pts[i + 1], pts[i + 2]); F.c.push(col[0] / 255 * k, col[1] / 255 * k, col[2] / 255 * k); } };
    const q = (ax, az, bx, bz, k) => add([ax, 0, az, bx, 0, bz, bx, h, bz, ax, 0, az, bx, h, bz, ax, h, az], k);
    q(x, y + d, x + w, y + d, 0.92); q(x + w, y, x, y, 0.7); q(x, y, x, y + d, 0.62); q(x + w, y + d, x + w, y, 0.82);
    flatQuad(x, y, w, d, h, col.map((v) => v * 1.05));
  };
  for (const p of World.props) {
    if (p.kind === 'building') {
      const S = BSTYLE[p.style] || BSTYLE.house, alt = p.seed % 2 === 0, k = (p.style || 'house') + (alt ? 'a' : 'b'), W = wallOf(k);
      const h = Math.max(40, p.hgt || 60);
      if (p.open && p.walls) for (const o of p.walls) box(W, o.x, o.y, o.w, o.h, h);
      else box(W, p.x, p.y, p.w, p.h, h);
      flatQuad(p.x, p.y, p.w, p.h, h, alt ? S.roof : S.roof2);
      W.style = p.style; W.alt = alt;
    } else if (p.kind === 'fence') colBox(p.x, p.y, p.w, p.h, 30, [96, 84, 66]);
    else if (p.kind === 'wreck') colBox(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, p.bus ? 46 : 30, p.col || [100, 100, 90]);
  }
  if (World.kind === 'lab' && World.lab && World.lab.grid) {
    const gr = World.lab.grid, fl = (x, y) => x >= 0 && y >= 0 && x < LAB_N && y < LAB_N && gr[y * LAB_N + x] === 1, W = wallOf('lab');
    W.style = 'lab'; W.alt = true;
    for (let y = -1; y <= LAB_N; y++) for (let x = -1; x <= LAB_N; x++) {
      if (fl(x, y)) continue;
      if (!(fl(x - 1, y) || fl(x + 1, y) || fl(x, y - 1) || fl(x, y + 1))) continue;
      const X = x * LAB_T, Y = y * LAB_T, T = LAB_T, h = 120;
      if (fl(x, y + 1)) face(W, X, Y + T, X + T, Y + T, h, 0.92);
      if (fl(x, y - 1)) face(W, X + T, Y, X, Y, h, 0.7);
      if (fl(x - 1, y)) face(W, X, Y, X, Y + T, h, 0.62);
      if (fl(x + 1, y)) face(W, X + T, Y + T, X + T, Y, h, 0.82);
      flatQuad(X, Y, T, T, h, [24, 26, 28]);
    }
    flatQuad(-LAB_T, -LAB_T, (LAB_N + 2) * LAB_T, (LAB_N + 2) * LAB_T, 121, [34, 36, 38]); // the ceiling
  }
  for (const [k, W] of walls) {
    if (!W.p.length) continue;
    let mat = Z3.wallMats.get(k);
    if (!mat) { mat = new THREE.MeshLambertMaterial({ map: z3WallTex(W.style, W.alt), vertexColors: true, side: THREE.DoubleSide }); Z3.wallMats.set(k, mat); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(W.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(W.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(W.c, 3));
    g.computeVertexNormals(); { const mm = new THREE.Mesh(g, mat); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm); }
  }
  if (flat.p.length) {
    if (!Z3.flatMat) Z3.flatMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flat.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(flat.c, 3)); g.computeVertexNormals();
    { const mm = new THREE.Mesh(g, Z3.flatMat); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm); }
  }
}
const Z3_BLOCK = new Set(['building', 'fence', 'wreck']);

// ---------- ground: the game's terrain tiles as 3D tiles ----------
function z3Ground() {
  if (World.chunks !== Z3.chunkSrc) { for (const t of Z3.chunks.values()) { Z3.scene.remove(t.m); t.tex.dispose(); } Z3.chunks.clear(); Z3.chunkSrc = World.chunks; }
  const NC = Math.ceil(WORLD / CHUNK), R = Z3.view;
  const gx0 = Math.max(0, Math.floor((P.x - R) / CHUNK)), gx1 = Math.min(NC - 1, Math.floor((P.x + R) / CHUNK));
  const gy0 = Math.max(0, Math.floor((P.y - R) / CHUNK)), gy1 = Math.min(NC - 1, Math.floor((P.y + R) / CHUNK));
  const st = ++Z3.stamp; let made = 0;
  const want = [];
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const cx = gx * CHUNK + CHUNK / 2, cy = gy * CHUNK + CHUNK / 2, d = Math.hypot(clamp(P.x, gx * CHUNK, gx * CHUNK + CHUNK) - P.x, clamp(P.y, gy * CHUNK, gy * CHUNK + CHUNK) - P.y);
    if (d > R) continue;
    const k = gy * 1000 + gx, t = Z3.chunks.get(k);
    if (t) { t.s = st; continue; }
    want.push([d, gx, gy, k]);
  }
  want.sort((a, b) => a[0] - b[0]);
  for (const [, gx, gy, k] of want) {
    if (made >= (Z3.chunks.size < 4 ? 9 : 2)) break; // a few new tiles a frame keeps walking smooth
    const src = World.chunk(gx, gy), tex = new THREE.CanvasTexture(src);
    tex.anisotropy = Z3.aniso; tex.minFilter = THREE.LinearMipmapLinearFilter;
    if (!Z3.chunkMat) Z3.chunkMat = new Map();
    const mat = new THREE.MeshLambertMaterial({ map: tex, fog: true });
    if (Z3.detailTex && gfxLevel() < 4) {
      mat.onBeforeCompile = (sh) => { sh.uniforms.detailMap = { value: Z3.detailTex }; sh.fragmentShader = 'uniform sampler2D detailMap;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= texture2D(detailMap, vMapUv * 64.0).r * 0.9 + 0.55;'); };
      mat.customProgramCacheKey = () => 'z3detail';
    }
    const m = new THREE.Mesh(Z3.chunkGeo, mat); m.receiveShadow = true;
    m.position.set(gx * CHUNK + CHUNK / 2, 0, gy * CHUNK + CHUNK / 2); m.renderOrder = 0;
    Z3.scene.add(m); Z3.chunks.set(k, { m, tex, s: st }); made++;
  }
  for (const [k, t] of Z3.chunks) if (t.s !== st && !want.some((w) => w[3] === k)) {
    const gx = k % 1000, gy = Math.floor(k / 1000), d = Math.hypot(gx * CHUNK + CHUNK / 2 - P.x, gy * CHUNK + CHUNK / 2 - P.y);
    if (d > R + CHUNK * 1.2) { Z3.scene.remove(t.m); t.m.material.dispose(); t.tex.dispose(); Z3.chunks.delete(k); }
  }
  for (const t of Z3.chunks.values()) t.m.material.color.setScalar(0.74);
}

// the original renderer, top-down around a point ahead of you, into the game canvas: everything it paints flat on the
// ground. Things that stand up (props, mutants, the player, pickups, bullets, numbers) are left out; they are 3D here.
const Z3_NULL = document.createElement('canvas').getContext('2d');
const Z3_FX = new Set(['beam', 'lightning', 'tele']); // drawn in 3D instead
let Z3_PASS = false;
function z3GroundPass(_render, title = false) {
  const N = Z3.ovN, R = Z3.ovR, c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw);
  const gx = P.x + c * R * 0.55, gy = P.y + s * R * 0.55;
  if (cv.width !== N || cv.height !== N) { cv.width = N; cv.height = N; }
  const sv = { VW, VH, DPR, ZOOM, cx: CAM.x, cy: CAM.y, ctx, shake: G.shake, mg: minGfx, lg: lowGfx, gf: drawGroundFast,
    dp: drawPropFast, de: drawEnemyScaled, pl: drawPlayer, cr: drawCrate, pk: drawPickup, ar: drawArtifact, pc: drawPoiChest, pa: typeof drawPartner === 'function' ? drawPartner : null,
    en: G.enemies, bu: G.bullets, eb: G.ebullets, pa2: G.particles, tx: G.texts, th: G.throws, gm: G.gems };
  VW = N; VH = N; DPR = 1; ZOOM = N / (2 * R); CAM.x = gx; CAM.y = gy; G.shake = 0;
  minGfx = () => true; lowGfx = () => true; drawGroundFast = () => {};
  const no = () => {};
  drawPropFast = no; drawEnemyScaled = no; drawPlayer = no; drawCrate = no; drawPickup = no; drawArtifact = no; drawPoiChest = no; if (sv.pa) drawPartner = no;
  G.enemies = []; G.bullets = []; G.ebullets = []; G.particles = []; G.texts = []; G.throws = []; if (typeof MDL !== 'undefined' && MDL.ready) G.gems = [];
  const W = World, sv2 = { at: drawAnomalyTop, veh: drawVehicle, cry: W.crystals, tor: W.tornados, fx: G.fx, wat: typeof Hz !== 'undefined' ? Hz.watcher : null, tr: typeof W2 !== 'undefined' ? W2.train : null };
  drawAnomalyTop = no; drawVehicle = no; W.crystals = []; W.tornados = []; G.fx = G.fx.filter((f) => !Z3_FX.has(f.k));
  if (sv2.wat) Hz.watcher = null; if (sv2.tr) W2.train = Object.assign({}, sv2.tr, { cars: 0 });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, N, N);
  const C = ctx, oArc = C.arc, oFT = C.fillText, rings = Z3.rings = [], labels = Z3.labels = [], ppx = P.x, ppy = P.y;
  C.arc = function (x, y, r, a0, a1) {
    if (typeof C.fillStyle === 'string' && C.fillStyle.startsWith('rgba(70,66,62,')) return; // flat smoke puffs: the 3D columns replace them
    if (Math.abs(a0 + Math.PI / 2) < 0.01 && r >= 8 && r <= 48 && a1 > a0 + 0.03 && a1 <= a0 + TAU + 0.01 && C.lineWidth >= 3 && Math.abs(x - ppx) < 420 && Math.abs(y - ppy) < 420) rings.push({ x, y, k: (a1 - a0) / TAU, c: String(C.strokeStyle) });
    return oArc.apply(this, arguments);
  };
  C.fillText = function (t, x, y) {
    if (typeof t === 'string' && t.length > 2 && /[A-Za-z\u00C0-\uFFFF]/.test(t) && Math.abs(x - ppx) < 220 && Math.abs(y - ppy) < 260 && labels.length < 8) labels.push({ t, x, y, c: String(C.fillStyle), f: C.font });
    return oFT.apply(this, arguments);
  };
  Z3_PASS = true;
  try { _render(title); } finally {
    Z3_PASS = false; delete C.arc; delete C.fillText;
    VW = sv.VW; VH = sv.VH; DPR = sv.DPR; ZOOM = sv.ZOOM; CAM.x = sv.cx; CAM.y = sv.cy; ctx = sv.ctx; G.shake = sv.shake;
    minGfx = sv.mg; lowGfx = sv.lg; drawGroundFast = sv.gf; drawPropFast = sv.dp; drawEnemyScaled = sv.de; drawPlayer = sv.pl; drawCrate = sv.cr; drawPickup = sv.pk; drawArtifact = sv.ar; drawPoiChest = sv.pc; if (sv.pa) drawPartner = sv.pa;
    G.enemies = sv.en; G.bullets = sv.bu; G.ebullets = sv.eb; G.particles = sv.pa2; G.texts = sv.tx; G.throws = sv.th; G.gems = sv.gm;
    drawAnomalyTop = sv2.at; drawVehicle = sv2.veh; W.crystals = sv2.cry; W.tornados = sv2.tor; G.fx = sv2.fx;
    if (sv2.wat) Hz.watcher = sv2.wat; if (sv2.tr) W2.train = sv2.tr;
  }
  Z3.ovMesh.position.set(gx, 0.5, gy); Z3.ovMesh.scale.set(2 * R, 2 * R, 1);
  Z3.ovTex.needsUpdate = true; Z3.ovMat.color.setScalar(Z3.bright);
}
// the screen-space part of the original frame (night mask, tints, arrows) is not wanted in the ground texture: from
// the lighting pass on, it draws into a throwaway canvas
{
  const _er = Env.render;
  Env.render = function () { if (Z3_PASS) { ctx = Z3_NULL; return; } return _er.apply(this, arguments); };
}

// ---------- what stands up in the world ----------
const Z3_SKIP = new Set(['prop', 'ob', '_s', '_z3k', 'x', 'y', 'sy', 'bx0', 'bx1', 'by0', 'by1', 'walls', 'pts']);
// props that look alike share one sprite: kind + rounded size + a few seed variants
function z3PropKey(p) {
  if (p._z3k) return p._z3k;
  let k = p.kind;
  for (const f in p) {
    if (Z3_SKIP.has(f)) continue;
    const v = p[f];
    if (typeof v === 'number') k += '|' + f + (f === 'seed' ? Math.abs(Math.floor(v)) % 4 : v < 8 ? Math.round(v * 4) / 4 : Math.round(v / 6) * 6);
    else if (typeof v === 'boolean' || typeof v === 'string') k += '|' + f + v;
  }
  if (p.pts) k += '|p' + (Math.abs(Math.floor(p.x * 7 + p.y * 3)) % 3);
  return (p._z3k = k);
}
function z3PropSprite(p) {
  const fn = PROP_DRAW[p.kind]; if (!fn) return null;
  const pad = 30, ox = (p.bx0 ?? p.x - 60) - p.x - pad, oy = (p.by0 ?? p.y - 120) - p.y - pad;
  const w = (p.bx1 ?? p.x + 60) - (p.bx0 ?? p.x - 60) + pad * 2, h = (p.by1 ?? p.y + 30) - (p.by0 ?? p.y - 120) + pad * 2;
  return SPR3.get(z3PropKey(p), ox, oy, w, h, () => {
    const q = Object.assign({}, p, { x: 0, y: 0, sy: (p.sy ?? p.y) - p.y, bx0: ox, by0: oy, bx1: ox + w, by1: oy + h });
    if (q.open) q.open = false;
    fn(q);
  });
}
function z3EnemySprite(e) {
  const fn = ENEMY_DRAW[e.id] || ENEMY_DRAW.dog;
  const fr = e.flash > 0 ? 'F' : Math.floor(((((e.anim || 0) % TAU) + TAU) % TAU) / TAU * 4) % 4;
  const R = Math.max(10, e.r || 12), w = R * 7 + 60, h = R * 7 + 60;
  const key = 'e|' + e.id + '|' + (e.boss || e.mini ? (e.affix || '') + (e.mini ? 'm' : '') : '') + '|' + fr + '|' + Math.round(R);
  return SPR3.get(key, -w / 2, -h * 0.8, w, h, () => { FL = fr === 'F'; fn({ ...e, x: 0, y: 0, z: 0, alpha: 1, anim: fr === 'F' ? 0 : ((fr + 0.5) / 4) * TAU, face: 1, frozen: 0, burnT: 0 }); FL = false; });
}
function z3Stand() {
  for (const pg of SPR3.pages) pg.bb.begin();
  const c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw), V = Z3.view, V2 = V * V, px = P.x, py = P.y;
  const ahead = (x, y, m) => (x - px) * c + (y - py) * s > -m;
  // props
  const PC = WORLD / PCELL, st = ++World.stamp;
  const cx0 = Math.max(0, Math.floor((px - V) / PCELL)), cx1 = Math.min(PC - 1, Math.floor((px + V) / PCELL));
  const cy0 = Math.max(0, Math.floor((py - V) / PCELL)), cy1 = Math.min(PC - 1, Math.floor((py + V) / PCELL));
  let made = 0; const lowQ = lowGfx(), potQ = potatoGfx(), w3 = typeof W3_PROPS !== 'undefined' && MDL.cone;
  for (let gy = cy0; gy <= cy1; gy++) for (let gx = cx0; gx <= cx1; gx++) {
    const cell = World.propGrid[gy * PC + gx]; if (!cell) continue;
    for (const p of cell) {
      if (p._s === st) continue; p._s = st;
      if (Z3_BLOCK.has(p.kind) || (lowQ && p.kind === 'grass') || (potQ && p.kind === 'reeds') || (w3 && W3_PROPS.has(p.kind))) continue;
      const dx = p.x - px, dy = p.y - py; if (dx * dx + dy * dy > V2 || !ahead(p.x, p.y, 260)) continue;
      if (!SPR3.map.has(z3PropKey(p)) && ++made > 24) continue; // new sprites are spread over a few frames
      const d2 = dx * dx + dy * dy, near = d2 < 110 * 110 ? clamp((Math.sqrt(d2) - 35) / 75, 0.12, 1) : 1; // see through scenery you stand in
      z3Push(z3PropSprite(p), p.x, p.y, 0, 1, 1, false, near);
    }
  }
  // mutants
  const rxw = -s;
  const hasM = typeof MDL !== 'undefined' && MDL.ready;
  for (const e of G.enemies) {
    if (e.dead && !(e.deadT > 0)) continue;
    if (hasM && MDL.kindOf(e.id)) continue; // drawn as a 3D model
    const dx = e.x - px, dy = e.y - py; if (dx * dx + dy * dy > V2 || !ahead(e.x, e.y, 120)) continue;
    let a = e.alpha === undefined ? 1 : e.alpha;
    if (!e._z3t) e._z3t = NOW; a *= Math.min(1, (NOW - e._z3t) / 0.5); // fade in where they appear
    const dd = dx * dx + dy * dy; if (dd < 60 * 60) a *= clamp(Math.sqrt(dd) / 60, 0.55, 1); // one in your face does not blank the screen
    if (a < 0.03) continue;
    const vs = (e.sc || 1) * (e.d && e.d.vsc || 1), an = typeof animSquash === 'function' ? animSquash(e) : 0;
    z3Push(z3EnemySprite(e), e.x, e.y, e.z || 0, vs * (1 + an), vs * (1 - an), (e.face || 1) * rxw < 0, e.flash > 0 ? -a : a);
  }
  // crates, pickups, artifacts, locked chests
  if (!w3) for (const k of G.crates) {
    if (k.open >= 1.5) continue; const dx = k.x - px, dy = k.y - py; if (dx * dx + dy * dy > V2) continue;
    const sp = SPR3.get('crate|' + (k.open ? 1 : 0), -40, -60, 80, 72, () => drawCrate({ x: 0, y: 0, open: k.open ? 1 : 0, _raw: 1 }));
    z3Push(sp, k.x, k.y, k.open ? 0 : Math.sin(NOW * 3 + k.x), 1, 1, false, k.open ? clamp(1 - k.open / 1.5, 0, 1) : 1);
  }
  for (const k of G.pickups) {
    if (w3 && W3_PICK.has(k.type)) continue; // a 3D object now
    const dx = k.x - px, dy = k.y - py; if (dx * dx + dy * dy > V2) continue;
    const key = 'pk|' + k.type + '|' + (k.id || '');
    const sp = SPR3.get(key, -80, -110, 160, 140, () => { const n = NOW; NOW = 0; try { drawPickup({ ...k, x: 0, y: 0 }); } finally { NOW = n; } });
    z3Push(sp, k.x, k.y, 2 + Math.sin(NOW * 4 + k.x) * 3, 1, 1, false, 1);
  }
  const detR = 330 * (P.detect || 1);
  if (!w3) for (const f of World.fields) {
    const a = f.art; if (!a) continue; const d = Math.hypot(a.x - px, a.y - py); if (d > detR) continue;
    const sp = SPR3.get('art|' + a.type, -60, -90, 120, 120, () => drawArtifact({ ...a, x: 0, y: 0 }, 1));
    z3Push(sp, a.x, a.y, 4 + Math.sin(NOW * 3 + a.x) * 3, 1, 1, false, clamp((detR - d) / 120, 0, 1));
  }
  for (const p of World.pois) {
    if (p.state >= 2) continue; const dx = p.x - px, dy = p.y - py; if (dx * dx + dy * dy > V2) continue;
    z3Push(SPR3.get('poi|' + p.icon + p.name, -140, -100, 280, 110, () => drawPoiChest({ ...p, x: 0, y: 0 })), p.x, p.y, 0, 1, 1, false, 1);
  }
  // quest people (the scientist you escort or guard)
  if (typeof Quests !== 'undefined' && !hasM) for (const q of Quests.list) {
    const n = q.npc; if (!n || n.dead || n.x === undefined) continue; const dx = n.x - px, dy = n.y - py; if (dx * dx + dy * dy > V2) continue;
    const mv = q.type === 'escort' || (n.vx || n.vy), fr = mv ? Math.floor((NOW * 8 / TAU * 4)) % 4 : 0;
    const sp = SPR3.get('npc|sci|' + fr, -70, -110, 140, 130, () => drawStalker({ x: 0, y: 0, z: 0, anim: ((fr + 0.5) / 4) * TAU, face: 1, aim: 0, moving: !!mv }, typeof SCI_PAL !== 'undefined' ? SCI_PAL : PAL_PLAYER, false));
    z3Push(sp, n.x, n.y, 0, 1, 1, (P.x > n.x ? 1 : -1) * rxw < 0, 1);
  }
  // the companion dog
  if (G.pet && !G.pet.dead && !hasM) z3Push(z3EnemySprite(G.pet), G.pet.x, G.pet.y, G.pet.z || 0, 1, 1, (G.pet.face || 1) * rxw < 0, 1);
  // the tall part of anomalies: a few animation frames each, cached
  for (const a of World.anomalies) {
    if (a.hidden || (w3 && W3_ANOM.has(a.type))) continue; const dx = a.x - px, dy = a.y - py; if (dx * dx + dy * dy > V2 || !ahead(a.x, a.y, a.r + 80)) continue;
    const fr = Math.floor((NOW + (a.seed || 0)) * 6) % 4, rq = Math.max(10, Math.round(a.r / 16) * 16), key = 'at|' + a.type + '|' + rq + '|' + fr + (a.big ? 'b' : '');
    if (!SPR3.map.has(key) && ++made > 24) continue;
    const sp = SPR3.get(key, -rq * 1.8 - 40, -rq * 3 - 140, rq * 3.6 + 80, rq * 3.2 + 180, () => { const n = NOW; NOW = fr / 6; try { drawAnomalyTop({ ...a, x: 0, y: 0, r: rq, seed: 0 }); } finally { NOW = n; } }, 0.6);
    z3Push(sp, a.x, a.y, 0, 1, 1, false, 1);
  }
  // vehicles, crystals, the watcher's eye
  if (!w3) for (const v of World.vehicles || []) {
    if (v === P.veh) continue; const dx = v.x - px, dy = v.y - py; if (dx * dx + dy * dy > V2) continue;
    const sp = SPR3.get('veh|' + v.kind, -70, -70, 140, 90, () => drawVehicle({ ...v, a: 0, fuel: 0 }, 0, 0));
    z3Push(sp, v.x, v.y, 0, 1, 1, (Math.cos(v.a || 0) >= 0 ? 1 : -1) * rxw < 0, 1);
  }
  for (const c of World.crystals || []) {
    const dx = c.x - px, dy = c.y - py; if (dx * dx + dy * dy > V2) continue;
    const gq = Math.round((c.g || 0) * 4) / 4;
    const sp = SPR3.get('cry|' + gq, -80, -140, 160, 160, () => { const W = World, sv = [W.crystals, W.vehicles, W.tornados, typeof Hz !== 'undefined' ? Hz.watcher : null];
      W.crystals = [{ ...c, x: 0, y: 0, g: gq, hold: 0 }]; W.vehicles = []; W.tornados = []; if (typeof Hz !== 'undefined') Hz.watcher = null;
      try { drawHazardsTop(-1e9, -1e9, 1e9, 1e9); } finally { W.crystals = sv[0]; W.vehicles = sv[1]; W.tornados = sv[2]; if (typeof Hz !== 'undefined') Hz.watcher = sv[3]; } });
    z3Push(sp, c.x, c.y, 0, 1, 1, false, 1);
  }
  if (typeof Hz !== 'undefined' && Hz.watcher && typeof drawEye === 'function') { const w = Hz.watcher; z3Push(SPR3.get('eye', -60, -100, 120, 120, () => drawEye({ x: 0, y: 0, z: 0 })), w.x, w.y, 40 + Math.sin(NOW * 2) * 8, 1, 1, false, 0.8); }
  // teammates
  if (typeof CO !== 'undefined' && CO.active && typeof coOthers === 'function' && !hasM) for (const q of coOthers()) {
    if (q.gone || q.x === undefined) continue;
    const fr = q.moving ? Math.floor((((q.anim || 0) % TAU) + TAU) % TAU / TAU * 4) % 4 : 0;
    const sp = SPR3.get('co|' + (q.char || '') + '|' + fr, -70, -110, 140, 130, () => drawStalker({ x: 0, y: 0, z: 0, anim: ((fr + 0.5) / 4) * TAU, face: 1, aim: 0, moving: !!q.moving }, coPal(q.char), true));
    z3Push(sp, q.x, q.y, 0, 1, 1, (q.face || 1) * rxw < 0, q.ghost ? 0.4 : 1);
  }
  for (const pg of SPR3.pages) pg.bb.end();
}
function z3Points() {
  const A = Z3.ptAdd, N = Z3.ptNorm; A.begin(); N.begin();
  const V2 = Z3.view * Z3.view, px = P.x, py = P.y;
  for (const b of G.bullets) {
    const dx = b.x - px, dy = b.y - py; if (dx * dx + dy * dy > V2) continue;
    const r = b.r || 4, col = Z3_BC[b.k] || (b.ignite ? [1, 0.55, 0.15] : b.rocket ? [1, 0.7, 0.25] : b.big ? [1, 0.95, 0.7] : [1, 0.86, 0.55]);
    const sz = b.k === 'flame' ? 30 : b.rocket || b.k === 'boom' ? 22 : 8 + r * 2.2;
    A.push(b.x, 24, b.y, sz, col[0], col[1], col[2], 1);
    A.push(b.x - b.vx * 0.012, 24, b.y - b.vy * 0.012, sz * 0.75, col[0], col[1], col[2], 0.55);
    A.push(b.x - b.vx * 0.024, 24, b.y - b.vy * 0.024, sz * 0.5, col[0], col[1], col[2], 0.3);
  }
  for (const b of G.ebullets) {
    const dx = b.x - px, dy = b.y - py; if (dx * dx + dy * dy > V2) continue;
    const c = b.k === 'web' ? '240,240,240' : b.k === 'psi' ? '200,100,255' : b.k === 'fire' ? '255,140,40' : b.k === 'mono' || b.k === 'fake' ? '140,220,255' : b.k === 'debris' ? '200,170,120' : '255,90,60';
    const v = z3rgb(c); A.push(b.x, 22, b.y, (b.r || 6) * 5, v[0], v[1], v[2], 1); A.push(b.x, 22, b.y, (b.r || 6) * 2.4, 1, 1, 1, 0.8);
  }
  for (const p of G.particles) {
    const dx = p.x - px, dy = p.y - py; if (dx * dx + dy * dy > V2) continue;
    const a = clamp(p.life / p.max, 0, 1), v = z3rgb(p.c), sz = p.s * 2.6;
    (p.add ? A : N).push(p.x, (p.z || 0) + 3, p.y, sz, v[0], v[1], v[2], p.add ? a : a * 0.9);
  }
  for (const t of G.throws) {
    const k = t.t / t.T, x = lerp(t.x0, t.x1, k), y = lerp(t.y0, t.y1, k), z = Math.sin(k * Math.PI) * 120 + 20;
    const v = t.k === 'erock' ? [0.42, 0.35, 0.29] : t.k === 'acid' ? [0.55, 1, 0.35] : t.k === 'flare' ? [1, 0.55, 0.23] : [0.3, 0.38, 0.2];
    N.push(x, z, y, t.k === 'erock' ? 22 : 13, v[0], v[1], v[2], 1);
  }
  // elites, alphas and mutated mutants keep their coloured glow on the ground around them
  for (const e of G.enemies) {
    if (e.dead || !(e.affix || e.mini || e.mut)) continue; const dx = e.x - px, dy = e.y - py; if (dx * dx + dy * dy > 1000 * 1000) continue;
    let c; if (e.mut && typeof MUTATIONS !== 'undefined' && MUTATIONS[e.mut]) c = z3rgb(MUTATIONS[e.mut].rgb); else c = z3hex(e.mini ? '#ffb830' : (ELITE_AFFIX[e.affix] || {}).color || '#ffb830');
    const R = e.r * 1.4 * (e.sc || 1), n = 14, a0 = NOW * 1.5, al = 0.55 + Math.sin(NOW * 6 + (e.seed || 0)) * 0.25;
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; A.push(e.x + Math.cos(a) * R, 3, e.y + Math.sin(a) * R, 9, c[0], c[1], c[2], al); }
  }
  // wildfires: flames licking up from the burning ground, and a smoke column above
  if (typeof Hz !== 'undefined' && Hz.fires) for (const f of Hz.fires) {
    if (dist2(f.x, f.y, px, py) > V2) continue;
    for (let i = 0; i < 7; i++) { const t = (NOW * 1.7 + i * 0.37 + f.x * 0.01) % 1, a = i * 2.4 + f.y; A.push(f.x + Math.cos(a) * 30 * (1 - t), 6 + t * 60, f.y + Math.sin(a) * 22 * (1 - t), 26 * (1 - t) + 8, 1, 0.45 + t * 0.35, 0.12, 0.9 * (1 - t)); }
    for (let i = 0; i < 5; i++) { const t = (NOW * 0.12 + i / 5 + f.x * 0.003) % 1; N.push(f.x + t * 90 + Math.sin(t * 6 + i) * 20, 70 + t * 520, f.y - t * 40, 50 + t * 120, 0.28, 0.26, 0.24, 0.32 * (1 - t)); }
  }
  // smoke columns over camps and crash sites (seen from far away, like in the flat game)
  { const ev = typeof Events !== 'undefined' ? Events.cur : null, src = [];
    for (const p of World.pois || []) if (p.state < 2 && p.type === 'camp') src.push(p.x, p.y, 0.6);
    if (ev && ev.loc && (ev.id === 'satellite' || ev.id === 'airdrop')) src.push(ev.loc.x, ev.loc.y, 1.2);
    for (let j = 0; j < src.length; j += 3) {
      const sx = src[j], sy = src[j + 1], k = src[j + 2]; if (dist2(sx, sy, px, py) > V2 * 2.2) continue;
      for (let i = 0; i < 6; i++) { const t = (NOW * 0.1 + i / 6 + sx * 0.003) % 1; N.push(sx + t * 110 * k + Math.sin(t * 6 + i) * 20, 50 + t * 600 * k, sy - t * 40, (50 + t * 140) * k, 0.3, 0.28, 0.26, 0.3 * (1 - t)); }
    } }
  for (const t of World.tornados || []) {
    if (dist2(t.x, t.y, px, py) > V2) continue;
    for (let i = 0; i < 10; i++) { const h = i * 26, w = 18 + i * 9, sw = Math.sin(NOW * 3 + i * 0.6 + (t.seed || 0)) * 10;
      for (let j = 0; j < 9; j++) { const a = NOW * 4 + j * 0.7 + i; N.push(t.x + sw + Math.cos(a) * w, h + 4, t.y + Math.sin(a) * w, 20 + i * 2, 0.59, 0.55, 0.47, 0.5 - i * 0.03); } }
  }
  for (const f of G.fx) {
    if (!Z3_FX.has(f.k) || f.delay > 0) continue;
    const k = clamp(f.life / f.max, 0, 1);
    // shots that start at you come out of the gun: a bit ahead of the eye and to the right
    const fromMe = (x, y) => Math.abs(x - P.x) < 40 && Math.abs(y - P.y) < 50;
    const gx = P.x + Math.cos(Z3.yaw) * 26 + Z3.rx * 9, gy = P.y + Math.sin(Z3.yaw) * 26 + Z3.rz * 9, gh = Z3.cam.position.y - 12;
    const seg = (x0, y0, x1, y1, h0, h1, sz, r, g, b, a, jag) => {
      if (fromMe(x0, y0)) { x0 = gx; y0 = gy; h0 = gh; }
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.min(90, Math.max(2, Math.ceil(L / 7)));
      for (let i = 0; i <= n; i++) { const t = i / n, j = jag && i > 0 && i < n ? jag : 0; A.push(lerp(x0, x1, t) + (Math.random() - 0.5) * j, lerp(h0, h1, t) + (Math.random() - 0.5) * j, lerp(y0, y1, t) + (Math.random() - 0.5) * j, sz, r, g, b, a); }
    };
    if (f.k === 'beam') { const w = 6 + (f.w || 4) * k; if (f.psi) seg(f.x, f.y, f.x2, f.y2, 26, 26, w * 1.6, 0.78, 0.43, 1, k * 0.7); else seg(f.x, f.y, f.x2, f.y2, 26, 26, w * 1.6, 0.35, 0.7, 1, k * 0.6); seg(f.x, f.y, f.x2, f.y2, 26, 26, w * 0.6, 0.94, 0.98, 1, k); }
    else if (f.k === 'tele') seg(f.x, f.y, f.x2, f.y2, 24, 24, (f.w || 3) + 4, 1, 0.16, 0.12, 0.35 + (1 - k) * 0.5);
    else if (f.k === 'lightning' && f.pts) for (let i = 0; i < f.pts.length - 1; i++) {
      const a = f.pts[i], b = f.pts[i + 1], ax = a[0], ay = a[1] + (i === 0 ? 30 : 14), bx = b[0], by = b[1] + 14;
      seg(ax, ay, bx, by, 24, 22, 11, 0.35, 0.63, 1, k * 0.7, 9); seg(ax, ay, bx, by, 24, 22, 4, 0.94, 0.98, 1, k, 5);
    }
  }
  if (typeof z3GunTracers === 'function') z3GunTracers(A);
  if (typeof w3AnomPts === 'function') w3AnomPts(A, N);
  A.end(); N.end();
  z3Train();
}
// the train: real 3D carriages
function z3Train() {
  const T = typeof W2 !== 'undefined' ? W2.train : null;
  if (!Z3.trainMesh) {
    Z3.trainGeo = new THREE.BufferGeometry(); Z3.trainPos = new Float32Array(12 * 36 * 3); Z3.trainCol = new Float32Array(12 * 36 * 3);
    Z3.trainGeo.setAttribute('position', new THREE.BufferAttribute(Z3.trainPos, 3).setUsage(THREE.DynamicDrawUsage)); Z3.trainGeo.setAttribute('color', new THREE.BufferAttribute(Z3.trainCol, 3).setUsage(THREE.DynamicDrawUsage));
    Z3.trainMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); Z3.trainMesh = new THREE.Mesh(Z3.trainGeo, Z3.trainMat); Z3.trainMesh.frustumCulled = false; Z3.scene.add(Z3.trainMesh);
  }
  let n = 0;
  if (T && !(T.warn > 0) && World.kind === 'over') for (let i = 0; i < Math.min(12, T.cars); i++) {
    const [x, y, a0] = W2.railPos(T.r, T.s - T.dir * i * 130), a = a0 + (T.dir < 0 ? Math.PI : 0); if (dist2(x, y, P.x, P.y) > Z3.view * Z3.view) continue;
    const c = Math.cos(a), s = Math.sin(a), L = 60, Wd = 28, H = i === 0 ? 74 : 66, base = T.ghost ? (i === 0 ? [0.23, 0.42, 0.32] : [0.18, 0.33, 0.27]) : i === 0 ? [0.23, 0.23, 0.24] : [0.35, 0.29, 0.23];
    const corner = (u, v) => [x + c * u - s * v, y + s * u + c * v];
    const q = [corner(-L, -Wd), corner(L, -Wd), corner(L, Wd), corner(-L, Wd)];
    const quad = (A, B, h0, h1, k) => { for (const [px, h, py] of [[A[0], h0, A[1]], [B[0], h0, B[1]], [B[0], h1, B[1]], [A[0], h0, A[1]], [B[0], h1, B[1]], [A[0], h1, A[1]]]) { const j = n * 3; Z3.trainPos[j] = px; Z3.trainPos[j + 1] = h; Z3.trainPos[j + 2] = py; Z3.trainCol[j] = base[0] * k * Z3.bright; Z3.trainCol[j + 1] = base[1] * k * Z3.bright; Z3.trainCol[j + 2] = base[2] * k * Z3.bright; n++; } };
    for (let e = 0; e < 4; e++) quad(q[e], q[(e + 1) % 4], 8, H, [0.8, 0.95, 0.7, 0.9][e]);
    const top = (A, B, C, D) => { for (const p of [A, B, C, A, C, D]) { const j = n * 3; Z3.trainPos[j] = p[0]; Z3.trainPos[j + 1] = H; Z3.trainPos[j + 2] = p[1]; Z3.trainCol[j] = base[0] * 1.15 * Z3.bright; Z3.trainCol[j + 1] = base[1] * 1.15 * Z3.bright; Z3.trainCol[j + 2] = base[2] * 1.15 * Z3.bright; n++; } };
    top(q[0], q[1], q[2], q[3]);
  }
  Z3.trainGeo.attributes.position.needsUpdate = true; Z3.trainGeo.attributes.color.needsUpdate = true; Z3.trainGeo.setDrawRange(0, n); Z3.trainMesh.visible = n > 0;
}

// ---------- camera ----------
function z3Camera() {
  const W = innerWidth, H = innerHeight;
  if (Z3.w !== W || Z3.h !== H || Z3.pr !== Z3.pixelRatio()) {
    Z3.w = W; Z3.h = H; Z3.pr = Z3.pixelRatio();
    Z3.R.setPixelRatio(Z3.pr); Z3.R.setSize(W, H, false);
    const od = Z3_PHONE ? 1 : Math.min(2, devicePixelRatio || 1);
    Z3C.ov.width = Math.floor(W * od); Z3C.ov.height = Math.floor(H * od); Z3.od = od;
  }
  const cam = Z3.cam, sh = G.shake || 0;
  let fov = z3Fov(); if (P.dashT > 0) fov += 7;
  if (W < H) fov += (1 - W / H) * 40;
  cam.fov += (fov - cam.fov) * 0.25; cam.aspect = W / H; cam.updateProjectionMatrix();
  const bob = P.moving && !P.veh ? Math.sin((P.anim || 0) * 1) * 1.6 : 0;
  let eye = (P.veh ? 58 : Z3.eye) + (P.z || 0) + bob;
  if (G.state === 'over' && P.hp <= 0) { Z3.deadK = Math.min(1, (Z3.deadK || 0) + 0.025); eye = lerp(eye, 9, Z3.deadK); Z3.pitch = lerp(Z3.pitch, 0.25, Z3.deadK * 0.1); } else Z3.deadK = 0;
  const jx = sh ? (Math.random() - 0.5) * sh * 0.25 : 0, jy = sh ? (Math.random() - 0.5) * sh * 0.25 : 0;
  cam.position.set(P.x + jx, eye + jy, P.y);
  const cp = Math.cos(Z3.pitch);
  cam.lookAt(P.x + jx + Math.cos(Z3.yaw) * cp * 100, eye + jy + Math.sin(Z3.pitch) * 100, P.y + Math.sin(Z3.yaw) * cp * 100);
  // a slight lean into sideways movement
  const side = (P.ivx || 0) * -Math.sin(Z3.yaw) + (P.ivy || 0) * Math.cos(Z3.yaw);
  Z3.roll = (Z3.roll || 0) + (clamp(-side / 200, -1, 1) * 0.025 - (Z3.roll || 0)) * 0.15;
  if (Z3.roll) cam.rotateZ(Z3.roll);
  Z3.rx = -Math.sin(Z3.yaw); Z3.rz = Math.cos(Z3.yaw);
  Z3.ptK = H * Z3.pr * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  // light and air: daylight, night, fog weather and labs
  const dark = clamp(Env.darkness ? Env.darkness() : 0, 0, 1), lab = World.kind === 'lab';
  Z3.bright = lab ? 0.6 + (1 - dark) * 0.3 : 1 - dark * 0.6;
  const fogK = clamp(Env.fogA || 0, 0, 1);
  const Q = z3Q(); Z3.ovN = Q.ovN; Z3.ptCap = Q.pts;
  // slow frames for a while: see a bit less far (and further again once it runs smoothly); this session only
  const fm = typeof FRAME_MS !== 'undefined' ? FRAME_MS : 16;
  if (fm > 0 && fm < 250) { Z3.fmA = (Z3.fmA || 16) * 0.97 + fm * 0.03; Z3.fmT = (Z3.fmT || 0) + 1;
    if (Z3.fmT > 90) { Z3.fmT = 0; if (Z3.fmA > 26 && Z3.farK > 0.6) Z3.farK = Math.max(0.6, Z3.farK - 0.1); else if (Z3.fmA < 18 && Z3.farK < 1) Z3.farK = Math.min(1, Z3.farK + 0.05); } }
  const far = Q.far * Z3.farK * (1 - fogK * 0.55) * (lab ? 0.6 : 1);
  Z3.view = far + 80;
  const base = lab ? [0.04, 0.045, 0.05] : [0.54, 0.565, 0.53];
  const night = lab ? [0.02, 0.02, 0.025] : [0.035, 0.045, 0.1];
  const k = lab ? 0.5 : dark, col = [lerp(base[0], night[0], k), lerp(base[1], night[1], k), lerp(base[2], night[2], k)];
  Z3.fog.color.setRGB(col[0], col[1], col[2]); Z3.scene.background.setRGB(col[0], col[1], col[2]);
  Z3.fog.near = far * 0.18; Z3.fog.far = far;
  // the dome: fog colour at the horizon, deeper above; red in an emission blast, none underground
  Z3.sky.visible = !lab; Z3.sky.position.copy(cam.position); Z3.stars.position.copy(cam.position);
  if (!lab) {
    const em = G.em && G.em.phase === 'blast' ? 0.6 : G.em && G.em.phase === 'warn' ? (1 - G.em.t / 30) * 0.4 : 0, ss = Env.sunset ? Env.sunset() : 0;
    const top = [lerp(0.36, 0.01, dark), lerp(0.42, 0.015, dark), lerp(0.5, 0.05, dark)], P2 = Z3.skyGeo.attributes.position, C = Z3.skyGeo.attributes.color;
    const key = Math.round(dark * 50) + '|' + Math.round(em * 30) + '|' + Math.round(ss * 50) + '|' + Math.round(fogK * 20);
    if (Z3.skyKey !== key) {
      Z3.skyKey = key;
      for (let i = 0; i < P2.count; i++) {
        const h = clamp(P2.getY(i) / 3200, 0, 1), k = Math.pow(h, 0.6) * (1 - fogK * 0.8);
        let r = lerp(col[0], top[0], k), gg = lerp(col[1], top[1], k), b = lerp(col[2], top[2], k);
        const glow = ss * (1 - h) * 1.6; r += glow * 0.9; gg += glow * 0.45; b += glow * 0.15;
        r = lerp(r, 0.55, em * (1 - h * 0.5)); gg = lerp(gg, 0.08, em * (1 - h * 0.5)); b = lerp(b, 0.05, em * (1 - h * 0.5));
        C.setXYZ(i, r, gg, b);
      }
      C.needsUpdate = true;
    }
  }
  Z3.stars.visible = !lab && dark > 0.35 && fogK < 0.5; Z3.stars.material.opacity = clamp((dark - 0.35) * 2.5, 0, 1);
  // daylight: sky light from above and a low sun; at night mostly a dim blue sky light
  Z3.hemi.intensity = (0.45 + Z3.bright * 0.75) * Math.PI * 0.62; Z3.sun.intensity = (lab ? 0.2 : Math.max(0, Z3.bright - 0.3) * 1.1) * Math.PI * 0.62;
  const shOn = gfxLevel() === 0 && !lab && Z3.bright > 0.45;
  if (Z3.sun.castShadow !== shOn) Z3.sun.castShadow = shOn;
  if (shOn) { Z3.sun.target.position.set(P.x + Math.cos(Z3.yaw) * 350, 0, P.y + Math.sin(Z3.yaw) * 350); Z3.sun.position.set(Z3.sun.target.position.x - 900, 1600, Z3.sun.target.position.z + 550); }
  else Z3.sun.position.set(-0.55, 1, 0.35);
  Z3.hemi.color.setRGB(lerp(0.6, 0.87, Z3.bright), lerp(0.66, 0.9, Z3.bright), lerp(0.85, 0.94, Z3.bright));
}
// picture quality follows the game's own graphics setting (phones start on the lighter ones)
const Z3_Q = [
  { far: 1700, ovN: 1024, pts: 6000 }, { far: 1500, ovN: 1024, pts: 5000 }, { far: 1250, ovN: 768, pts: 3000 },
  { far: 1050, ovN: 640, pts: 2000 }, { far: 850, ovN: 512, pts: 1200 },
];
const z3Q = () => Z3_Q[clamp(typeof gfxLevel === 'function' ? gfxLevel() : 0, 0, 4)];
Z3.pixelRatio = () => { const d = devicePixelRatio || 1, q = typeof gfxLevel === 'function' ? gfxLevel() : 0; return q >= 4 ? 0.6 : q >= 2 || Z3_PHONE ? Math.min(d, 1) : q >= 1 ? Math.min(d, 1.25) : Math.min(d, 1.75); };
function z3Project(x, h, y) {
  const v = Z3.pv || (Z3.pv = new THREE.Vector3());
  v.set(x, h, y).project(Z3.cam);
  if (v.z > 1 || v.z < -1) return null;
  return [(v.x + 1) * 0.5 * innerWidth, (1 - v.y) * 0.5 * innerHeight];
}
// the angle of a world point from where you look: 0 straight ahead, ± to the right/left
function z3Rel(x, y) { let a = Math.atan2(y - P.y, x - P.x) - Z3.yaw; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

// ---------- screen layer: crosshair, gun, numbers, tints, arrows ----------
function z3Overlay() {
  const g = Z3C.og, W = innerWidth, H = innerHeight;
  g.setTransform(Z3.od, 0, 0, Z3.od, 0, 0); g.clearRect(0, 0, W, H);
  // damage numbers and labels where things are
  g.textAlign = 'center';
  const fS = 'bold 15px Oswald, Impact, sans-serif', fB = 'bold 22px Oswald, Impact, sans-serif';
  for (const t of G.texts) {
    const p = z3Project(t.x, 46, t.y + 36); if (!p) continue;
    const d = Math.hypot(t.x - P.x, t.y + 36 - P.y); if (d > 900) continue;
    g.globalAlpha = clamp(t.life * 2, 0, 1); g.font = t.big ? fB : fS;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(t.s, p[0] + 1.5, p[1] + 1.5); g.fillStyle = t.c; g.fillText(t.s, p[0], p[1]);
  }
  g.globalAlpha = 1;
  for (const e of G.enemies) {
    if (e.dead || !(e.affix || e.mini || e.boss || e.stun > 0)) continue;
    const d = Math.hypot(e.x - P.x, e.y - P.y); if (d > 1100) continue;
    const vs = (e.sc || 1) * (e.d && e.d.vsc || 1), p = z3Project(e.x, (e.z || 0) + e.r * 2.6 * vs + 22, e.y); if (!p) continue;
    if ((e.affix || e.mini || e.boss) && e.hp < e.maxhp) {
      const w = e.boss ? 90 : e.mini ? 64 : 40;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 7);
      g.fillStyle = e.boss ? '#ff4a3a' : e.mini ? '#ffb830' : (ELITE_AFFIX[e.affix] || {}).color || '#ffb830'; g.fillRect(p[0] - w / 2, p[1], w * clamp(e.hp / e.maxhp, 0, 1), 5);
    }
    if (e.mini || e.boss) { g.font = 'bold 12px Oswald, sans-serif'; g.fillStyle = '#ffcf6a'; g.fillText(z3Tr(e.name || ''), p[0], p[1] - 6); }
    if (e.stun > 0) { g.font = '13px sans-serif'; g.fillStyle = '#ffe070'; g.fillText('✦ ✦', p[0], p[1] - (e.mini || e.boss ? 20 : 4)); }
  }
  for (const e of G.enemies) { // stagger meters (heavy hits fill them; full = stunned and open to an execution)
    if (e.dead || !(e.stg > 0.02 || e.stgT > 0)) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d > 900) continue;
    const vs = (e.sc || 1) * (e.d && e.d.vsc || 1), p = z3Project(e.x, (e.z || 0) + e.r * 2.6 * vs + 14, e.y); if (!p) continue;
    const w = e.boss ? 80 : e.mini ? 60 : 36; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(p[0] - w / 2 - 1, p[1] + 8, w + 2, 5);
    g.fillStyle = e.stgT > 0 ? '#fff' : '#ffe070'; g.fillRect(p[0] - w / 2, p[1] + 9, w * (e.stgT > 0 ? e.stgT / 3 : Math.min(1, e.stg)), 3);
  }
  if (typeof Quests !== 'undefined') for (const q of Quests.list) { const n = q.npc; if (!n || n.dead || !(n.hp >= 0)) continue; const p = z3Project(n.x, 70, n.y); if (!p || Math.hypot(n.x - P.x, n.y - P.y) > 900) continue; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(p[0] - 21, p[1] - 1, 42, 6); g.fillStyle = '#ffe070'; g.fillRect(p[0] - 20, p[1], 40 * clamp(n.hp / 100, 0, 1), 4); }
  if (G.ft) for (const r of G.ft.res || []) { if (r.state) continue; const p = z3Project(r.x, 120, r.y); if (p && Math.hypot(r.x - P.x, r.y - P.y) < 1400) { g.font = 'bold 13px Oswald, sans-serif'; g.fillStyle = '#ffcf6a'; g.fillText(r.name || '', p[0], p[1]); } }
  for (const v of World.vehicles || []) if (v !== P.veh && (v.broken || v === G.escapeCar)) { const p = z3Project(v.x, 64, v.y); if (p && Math.hypot(v.x - P.x, v.y - P.y) < 900) { g.font = 'bold 13px Oswald, sans-serif'; g.fillStyle = '#7dff8a'; g.fillText(v.broken ? '🔧' : z3Tr('ESCAPE JEEP'), p[0], p[1]); } }
  // what the flat game wrote under climbable watchtowers and radio towers you can switch on
  if (typeof W3S !== 'undefined') for (const t of W3S.labels || []) {
    const on = t.kind === 'wtower' ? t.t.used : t.t.on; if (on) continue; const d = Math.hypot(t.x - P.x, t.y - P.y); if (d > 700) continue;
    const p = z3Project(t.x, 60, t.y); if (!p) continue;
    g.font = 'bold 13px Oswald, sans-serif'; g.globalAlpha = 0.6 + Math.sin(NOW * 3) * 0.3; g.fillStyle = 'rgba(0,0,0,0.6)';
    const s = t.kind === 'wtower' ? '▲ ' + z3Tr('CLIMB') : '📡 ' + z3Tr('ACTIVATE'); g.fillText(s, p[0] + 1, p[1] + 1); g.fillStyle = t.kind === 'wtower' ? '#ffdc78' : '#78c8ff'; g.fillText(s, p[0], p[1]); g.globalAlpha = 1;
  }
  if (typeof CO !== 'undefined' && CO.active && typeof coOthers === 'function') for (const q of coOthers()) {
    if (q.gone || q.x === undefined) continue; const p = z3Project(q.x, 74, q.y); if (!p) continue;
    g.font = 'bold 12px Oswald, sans-serif'; g.fillStyle = q.ghost ? '#aaa' : coColor(q.pid); g.fillText((q.ghost ? '💀 ' : '') + (q.name || 'Teammate'), p[0], p[1]);
  }
  // things to find: bosses, quests, events, shelter in an emission. On screen: a marker above; off screen: an arrow at the edge
  const mark = (x, y, color, label, h = 90) => {
    const rel = z3Rel(x, y), half = Z3.cam.fov * Z3.cam.aspect * Math.PI / 360;
    if (Math.abs(rel) < half * 0.92) {
      const p = z3Project(x, h, y); if (!p) return;
      g.font = '18px sans-serif'; g.fillStyle = color; g.fillText(label, p[0], clamp(p[1], 90, H - 60));
      g.font = 'bold 11px Oswald, sans-serif'; g.fillText(Math.round(Math.hypot(x - P.x, y - P.y) / 10) + 'm', p[0], clamp(p[1], 90, H - 60) + 14);
      return;
    }
    const right = rel > 0, ex = right ? W - 34 : 34, ey = clamp(H * 0.42 + Math.abs(rel) * 40, 110, H - 140);
    g.save(); g.translate(ex, ey); g.rotate(right ? 0 : Math.PI); g.fillStyle = color;
    g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -11); g.lineTo(-8, 11); g.fill(); g.restore();
    g.font = '16px sans-serif'; g.fillStyle = color; g.fillText(label, ex + (right ? -26 : 26), ey + 6);
  };
  for (const b of G.bosses) if (!b.dead) mark(b.x, b.y, '#ff3a2a', '💀', 120);
  if (typeof Quests !== 'undefined') for (const q of Quests.list) if (q.loc && World.kind === 'over') mark(q.loc.x, q.loc.y, '#ffcf3a', q.icon);
  if (typeof Events !== 'undefined' && Events.cur && Events.cur.loc) mark(Events.cur.loc.x, Events.cur.loc.y, '#ff8a3a', EVENTS[Events.cur.id].icon);
  // goals from the newer features: stash notes, courier package, evac zone, rescues, the hot zone
  const F3 = G.f3;
  if (F3) {
    const T = F3.notes; if (T && !T.done && T.list && T.list[T.i]) mark(T.list[T.i].x, T.list[T.i].y, '#ffdc8c', '📜', 50);
    const C = F3.courier; if (C) { const x = C.got ? C.bx : C.ax, y = C.got ? C.by : C.ay; mark(x, y, '#ffc85a', '📦 ' + Math.ceil(C.t) + 's', 50); }
    const E = F3.evac; if (E) mark(E.x, E.y, '#9fe8a0', '🚁 ' + Math.ceil(E.t) + 's', 90);
  }
  if (G.ft) { for (const r of G.ft.res || []) if (!r.state) mark(r.x, r.y, '#ff6a4a', '🆘 ' + Math.ceil(r.t) + 's', 95); if (G.ft.hotOn) mark(G.ft.hotOn.x, G.ft.hotOn.y, '#ffb040', '🔥', 60); }
  const em = G.em && G.em.phase !== 'after';
  if (em && !inShelter(P.x, P.y)) { const s = nearestShelter(); if (s) mark(s.x, s.y, `rgba(90,255,120,${0.7 + Math.sin(NOW * 10) * 0.3})`, '🛡️', 40); }
  // tints over the whole view (the same as the flat game)
  if (G.em) { const k = G.em.phase === 'warn' ? (1 - G.em.t / 30) * 0.3 : G.em.phase === 'blast' ? 0.42 + Math.sin(NOW * 12) * 0.1 : 0.3 * (G.em.t / 3); g.fillStyle = `rgba(160,30,20,${World.kind === 'lab' ? k * 0.3 : k})`; g.fillRect(0, 0, W, H); }
  if (G.rad > 0) { g.fillStyle = `rgba(200,200,40,${G.rad * 0.12})`; g.fillRect(0, 0, W, H); }
  if (G.psi > 0) {
    g.fillStyle = `rgba(120,40,180,${G.psi * 0.18})`; g.fillRect(0, 0, W, H);
    g.strokeStyle = `rgba(200,120,255,${G.psi * 0.25})`; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const r = ((NOW * 300 + i * 200) % 600); g.beginPath(); g.arc(W / 2, H / 2, r, 0, TAU); g.stroke(); }
  }
  const lowhp = P.hp / P.maxhp < 0.3;
  if (!minGfx() || lowhp) {
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${lowhp ? 0.7 : 0.4})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  if (lowhp) { g.fillStyle = `rgba(200,0,0,${(0.3 - P.hp / P.maxhp) * (0.5 + Math.sin(NOW * 6) * 0.3)})`; g.fillRect(0, 0, W, H); }
  if (typeof Events !== 'undefined') { const EM = Events.mods(); if (EM.red) { g.fillStyle = `rgba(160,0,0,${0.16 + Math.sin(NOW * 2) * 0.04})`; g.fillRect(0, 0, W, H); } if (EM.flood) { g.fillStyle = 'rgba(30,70,110,0.18)'; g.fillRect(0, 0, W, H); } }
  z3Weather(g, W, H);
  if (P.veh) z3Ride(g, W, H); else if (!(typeof VM !== 'undefined' && VM.gun)) z3Gun(g, W, H);
  // crosshair: brackets the mutant your weapons will shoot at
  const t = Z3.target;
  const cc = t ? '#ff6a4a' : 'rgba(255,240,200,0.85)';
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - 9, H / 2); g.lineTo(W / 2 + 9, H / 2); g.moveTo(W / 2, H / 2 - 9); g.lineTo(W / 2, H / 2 + 9); g.stroke();
  g.strokeStyle = cc; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 8, H / 2); g.lineTo(W / 2 - 3, H / 2); g.moveTo(W / 2 + 3, H / 2); g.lineTo(W / 2 + 8, H / 2); g.moveTo(W / 2, H / 2 - 8); g.lineTo(W / 2, H / 2 - 3); g.moveTo(W / 2, H / 2 + 3); g.lineTo(W / 2, H / 2 + 8); g.stroke();
  if (t && !t.dead && z3AimMode() === 'look') {
    const vs = (t.sc || 1) * (t.d && t.d.vsc || 1), p = z3Project(t.x, (t.z || 0) + t.r * 1.3 * vs, t.y);
    if (p) { const d = Math.hypot(t.x - P.x, t.y - P.y), r = clamp(t.r * 2.2 * vs * (Z3.ptK / Z3.pr) / Math.max(60, d), 10, 70); g.strokeStyle = 'rgba(255,90,60,0.85)'; g.lineWidth = 2; const k = r * 0.4;
      g.beginPath(); g.moveTo(p[0] - r, p[1] - r + k); g.lineTo(p[0] - r, p[1] - r); g.lineTo(p[0] - r + k, p[1] - r); g.moveTo(p[0] + r - k, p[1] - r); g.lineTo(p[0] + r, p[1] - r); g.lineTo(p[0] + r, p[1] - r + k);
      g.moveTo(p[0] - r, p[1] + r - k); g.lineTo(p[0] - r, p[1] + r); g.lineTo(p[0] - r + k, p[1] + r); g.moveTo(p[0] + r - k, p[1] + r); g.lineTo(p[0] + r, p[1] + r); g.lineTo(p[0] + r, p[1] + r - k); g.stroke(); }
  }
  // hold rings (boarding a vehicle, a hatch, a tower, a rescue…) and short prompts near you
  for (const r of Z3.rings || []) {
    const p = z3Project(r.x, 70, r.y + 70); if (p) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 7; g.beginPath(); g.arc(p[0], p[1], 16, 0, TAU); g.stroke(); g.strokeStyle = r.c; g.lineWidth = 5; g.beginPath(); g.arc(p[0], p[1], 16, -Math.PI / 2, -Math.PI / 2 + TAU * r.k); g.stroke(); }
  }
  const near = (Z3.rings || []).filter((r) => Math.hypot(r.x - P.x, r.y + 70 - P.y) < 160).sort((a, b) => b.k - a.k)[0];
  if (near) { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9; g.beginPath(); g.arc(W / 2, H / 2, 30, 0, TAU); g.stroke(); g.strokeStyle = near.c; g.lineWidth = 6; g.beginPath(); g.arc(W / 2, H / 2, 30, -Math.PI / 2, -Math.PI / 2 + TAU * near.k); g.stroke(); }
  let ly = H * 0.62;
  for (const l of Z3.labels || []) { g.font = 'bold 15px Oswald, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(l.t, W / 2 + 1.5, ly + 1.5); g.fillStyle = l.c && l.c[0] === '#' || /^rgb/.test(l.c) ? l.c : '#ffe9b0'; g.fillText(l.t, W / 2, ly); ly += 20; }
  z3Senses(g, W, H);
  if (G.flash > 0) { g.fillStyle = `rgba(${G.flashCol},${G.flash * 0.6})`; g.fillRect(0, 0, W, H); }
  if (G.fade > 0) { g.fillStyle = `rgba(0,0,0,${G.fade})`; g.fillRect(0, 0, W, H); }
}
// weather and darkness on the screen: rain streaks, snowflakes, heat/radiation/psi tints, and at night (or in a
// lab) a flashlight: the view darkens towards the edges and stays lit in the middle
const Z3W = { drops: [], flakes: [] };
function z3Weather(g, W, H) {
  const lab = World.kind === 'lab', dark = clamp(Env.darkness ? Env.darkness() : 0, 0, 1);
  if (!lab && Env.rainA > 0.02) {
    if (Z3W.drops.length < 200) for (let i = 0; i < 200; i++) Z3W.drops.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.4 });
    g.strokeStyle = `rgba(190,205,225,${0.35 * Env.rainA})`; g.lineWidth = 1.2; g.beginPath();
    const n = Math.floor(Z3W.drops.length * Env.rainA), side = Math.sin(Z3.yaw * 3) * 4;
    for (let i = 0; i < n; i++) { const d = Z3W.drops[i]; d.y += 24 * d.s; d.x += side * d.s * 0.3; if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 100) - 50; } g.moveTo(d.x, d.y); g.lineTo(d.x - side * d.s, d.y + 18 * d.s); }
    g.stroke(); g.fillStyle = `rgba(20,30,50,${0.12 * Env.rainA})`; g.fillRect(0, 0, W, H);
  }
  if (!lab && Env.weather === 'snow') {
    if (!Z3W.flakes.length) for (let i = 0; i < 150; i++) Z3W.flakes.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2.5, v: 30 + Math.random() * 40 });
    g.fillStyle = 'rgba(240,245,255,0.85)';
    for (const f of Z3W.flakes) { f.y += f.v / 60; f.x += Math.sin(NOW + f.s * 3) * 0.5; if (f.y > H) { f.y = -5; f.x = Math.random() * W; } g.fillRect(f.x, f.y, f.s, f.s); }
    g.fillStyle = 'rgba(220,230,245,0.1)'; g.fillRect(0, 0, W, H);
  }
  if (!lab && Env.weather === 'heat') { g.fillStyle = `rgba(255,150,40,${0.1 + Math.sin(NOW * 1.5) * 0.03})`; g.fillRect(0, 0, W, H); }
  if (!lab && Env.weather === 'radstorm') { g.fillStyle = `rgba(180,210,40,${0.14 + Math.sin(NOW * 4) * 0.04})`; g.fillRect(0, 0, W, H); }
  if (!lab && Env.weather === 'psi') { g.fillStyle = `rgba(120,40,180,${0.1 + Math.sin(NOW * 2) * 0.04})`; g.fillRect(0, 0, W, H); }
  const k = lab ? 0.55 : clamp((dark - 0.25) * 1.1, 0, 0.7);
  if (k > 0.02) {
    const cx = W / 2, cy = H * 0.55, r0 = Math.min(W, H) * 0.22, r1 = Math.max(W, H) * 0.7;
    const fl = g.createRadialGradient(cx, cy, r0, cx, cy, r1); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, lab ? `rgba(2,3,4,${k})` : `rgba(3,5,14,${k})`);
    g.fillStyle = fl; g.fillRect(0, 0, W, H);
    const warm = g.createRadialGradient(cx, cy, 0, cx, cy, r0 * 1.3); warm.addColorStop(0, `rgba(255,240,200,${k * 0.12})`); warm.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = warm; g.fillRect(0, 0, W, H);
  }
}
// riding: handlebars of the bike or the jeep's hood instead of the gun
function z3Ride(g, W, H) {
  const sc = clamp(Math.min(W, H) / 700, 0.6, 1.3), sh = Math.sin(NOW * 22) * (P.moving ? 1.5 : 0.4);
  g.save(); g.translate(W / 2, H + sh); g.scale(sc, sc);
  if (P.veh.kind === 'bike') {
    g.strokeStyle = '#1d1c19'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-260, -150); g.quadraticCurveTo(0, -200, 260, -150); g.stroke();
    g.fillStyle = '#b8342a'; g.beginPath(); g.moveTo(-90, 0); g.lineTo(-60, -130); g.lineTo(60, -130); g.lineTo(90, 0); g.fill();
    g.fillStyle = '#2b2a25'; g.fillRect(-40, -175, 80, 40); g.fillStyle = '#ffe9a0'; g.fillRect(-22, -165, 44, 18);
    g.fillStyle = '#56603f'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 270, -150, 34, 22, 0, 0, TAU); g.fill(); }
  } else {
    g.fillStyle = '#4e5a3a'; g.beginPath(); g.moveTo(-W, 0); g.lineTo(-W, -70); g.quadraticCurveTo(0, -150, W, -70); g.lineTo(W, 0); g.fill();
    g.fillStyle = '#3e482e'; g.fillRect(-W, -40, W * 2, 40);
    g.strokeStyle = '#1d1c19'; g.lineWidth = 18; g.beginPath(); g.arc(-160, 40, 120, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  }
  g.restore();
  if (P.veh.fuel !== undefined && VEH[P.veh.kind] && VEH[P.veh.kind].fuel) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W / 2 - 50, H - 18, 100, 6); g.fillStyle = '#ffcf6a'; g.fillRect(W / 2 - 50, H - 18, P.veh.fuel, 6); }
}
// which kind of gun you hold: your first weapon decides
function z3GunKind() {
  const w = P.weapons && P.weapons[0], id = w ? w.id : 'pistol', nm = (WEAPONS[id] && WEAPONS[id].name || '').toLowerCase() + ' ' + id;
  if (/pistol|dual|revolver|deagle|makarov|pm\b/.test(nm)) return 'pistol';
  if (/shotgun|sawn|toz/.test(nm)) return 'shotgun';
  if (/launcher|rocket|rpg|acid|flame|c4|grenade|mortar|saw|stasis|mine/.test(nm)) return 'tube';
  if (/tesla|laser|grav|psi|weld|beam|electr|fence|coil|gauss/.test(nm)) return 'energy';
  return 'rifle';
}
// the gun in your hands: kicks back and flashes when your weapons fire, sways while you walk
function z3Gun(g, W, H) {
  const kind = z3GunKind();
  if (kind !== 'rifle') return z3Gun2(g, W, H, kind);
  const fire = P.muzzle > 0 ? 1 : 0, sc = clamp(Math.min(W, H) / 700, 0.6, 1.3);
  const sway = P.moving ? Math.sin((P.anim || 0) * 0.5) * 6 : Math.sin(NOW * 1.6) * 1.5, bob = P.moving ? Math.abs(Math.cos((P.anim || 0) * 0.5)) * 5 : 0;
  const kick = fire * 10;
  g.save(); g.translate(W * 0.68 + sway * sc, H + (bob + kick) * sc); g.scale(sc, sc); g.rotate(-0.12);
  if (fire) { // muzzle flash
    const fx = -38, fy = -232;
    const gr = g.createRadialGradient(fx, fy, 0, fx, fy, 46); gr.addColorStop(0, 'rgba(255,250,210,0.95)'); gr.addColorStop(0.4, 'rgba(255,170,60,0.7)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, 46, 0, TAU); g.fill();
  }
  g.fillStyle = '#1d1c19'; // barrel and body
  g.beginPath(); g.moveTo(-48, -230); g.lineTo(-28, -230); g.lineTo(-6, -70); g.lineTo(-62, -70); g.closePath(); g.fill();
  g.fillStyle = '#2b2a25'; g.beginPath(); g.moveTo(-70, -150); g.lineTo(6, -150); g.lineTo(34, 20); g.lineTo(-96, 20); g.closePath(); g.fill();
  g.fillStyle = '#3a3830'; g.beginPath(); g.moveTo(-58, -146); g.lineTo(-6, -146); g.lineTo(-2, -120); g.lineTo(-62, -120); g.closePath(); g.fill();
  g.fillStyle = '#4a3a26'; g.beginPath(); g.moveTo(-10, -60); g.lineTo(26, -60); g.lineTo(60, 30); g.lineTo(14, 30); g.closePath(); g.fill(); // grip
  g.fillStyle = '#56603f'; g.beginPath(); g.moveTo(10, -40); g.quadraticCurveTo(80, -60, 120, 40); g.lineTo(30, 40); g.closePath(); g.fill(); // sleeve
  g.restore();
}

function z3Gun2(g, W, H, kind) {
  const fire = P.muzzle > 0 ? 1 : 0, sc = clamp(Math.min(W, H) / 700, 0.6, 1.3);
  const sway = P.moving ? Math.sin((P.anim || 0) * 0.5) * 6 : Math.sin(NOW * 1.6) * 1.5, bob = P.moving ? Math.abs(Math.cos((P.anim || 0) * 0.5)) * 5 : 0;
  g.save(); g.translate(W * 0.68 + sway * sc, H + (bob + fire * 12) * sc); g.scale(sc, sc); g.rotate(-0.1);
  const flash = (fx, fy, r, c1, c2) => { if (!fire) return; const gr = g.createRadialGradient(fx, fy, 0, fx, fy, r); gr.addColorStop(0, c1); gr.addColorStop(0.45, c2); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, r, 0, TAU); g.fill(); };
  if (kind === 'pistol') {
    flash(-30, -175, 38, 'rgba(255,250,210,0.95)', 'rgba(255,170,60,0.7)');
    g.fillStyle = '#1d1c19'; g.fillRect(-48, -170, 34, 90); g.fillStyle = '#2b2a25'; g.fillRect(-56, -110, 50, 40);
    g.fillStyle = '#3a2e22'; g.beginPath(); g.moveTo(-50, -72); g.lineTo(-10, -72); g.lineTo(10, 30); g.lineTo(-36, 30); g.fill();
    g.fillStyle = '#56603f'; g.beginPath(); g.moveTo(-20, -30); g.quadraticCurveTo(60, -50, 100, 40); g.lineTo(-10, 40); g.fill();
  } else if (kind === 'shotgun') {
    flash(-34, -240, 56, 'rgba(255,250,210,0.95)', 'rgba(255,150,50,0.75)');
    g.fillStyle = '#1d1c19'; g.fillRect(-56, -240, 20, 180); g.fillRect(-32, -240, 20, 180);
    g.fillStyle = '#4a3a26'; g.beginPath(); g.moveTo(-70, -90); g.lineTo(6, -90); g.lineTo(40, 30); g.lineTo(-90, 30); g.fill();
    g.fillStyle = '#56603f'; g.beginPath(); g.moveTo(10, -40); g.quadraticCurveTo(80, -60, 120, 40); g.lineTo(30, 40); g.fill();
  } else if (kind === 'tube') {
    flash(-30, -230, 50, 'rgba(255,240,200,0.9)', 'rgba(255,120,40,0.6)');
    g.fillStyle = '#3e462e'; g.beginPath(); g.moveTo(-70, -230); g.lineTo(10, -230); g.lineTo(30, 20); g.lineTo(-100, 20); g.fill();
    g.fillStyle = '#1d1c19'; g.beginPath(); g.ellipse(-30, -230, 40, 12, 0, 0, TAU); g.fill();
    g.fillStyle = '#56603f'; g.beginPath(); g.moveTo(10, -40); g.quadraticCurveTo(80, -60, 120, 40); g.lineTo(30, 40); g.fill();
  } else {
    flash(-34, -232, 44, 'rgba(220,240,255,0.95)', 'rgba(90,170,255,0.7)');
    g.fillStyle = '#2b2f36'; g.beginPath(); g.moveTo(-60, -220); g.lineTo(-8, -220); g.lineTo(20, 20); g.lineTo(-90, 20); g.fill();
    g.strokeStyle = `rgba(110,200,255,${0.6 + Math.sin(NOW * 9) * 0.3})`; g.lineWidth = 5;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-34, -190 + i * 34, 30 - i * 1, 8, 0, 0, TAU); g.stroke(); }
    g.fillStyle = '#56603f'; g.beginPath(); g.moveTo(10, -40); g.quadraticCurveTo(80, -60, 120, 40); g.lineTo(30, 40); g.fill();
  }
  g.restore();
}

// ---------- the frame ----------
let Z3_MODE = false;
function z3Enter() {
  if (Z3_MODE) return; Z3_MODE = true;
  Z3C.gl.style.display = 'block'; Z3C.ov.style.display = 'block'; cv.style.opacity = '0';
  if (G && G._z3yaw === undefined) { G._z3yaw = 1; Z3.yaw = -Math.PI / 2; Z3.pitch = 0; }
}
function z3Leave() {
  if (!Z3_MODE) return; Z3_MODE = false;
  Z3C.gl.style.display = 'none'; Z3C.ov.style.display = 'none'; cv.style.opacity = ''; Z3C.hint.style.display = 'none';
  if (document.pointerLockElement) document.exitPointerLock();
  resize();
}
{
  const _render = render;
  render = function (title) {
    if (Z3.ok && title && G && G.title && !potatoGfx()) { try { return z3TitleFrame(_render); } catch (e) { Z3.noTitle = true; } }
    if (!Z3.ok || title || !G || G.title) { z3Leave(); z3TitleOff(); return _render.apply(this, arguments); }
    z3TitleOff();
    z3Enter(); Z3.on = true;
    const T = Z3.prof, t0 = performance.now();
    z3Camera();
    // on the lightest settings the flat layer is redrawn every second frame (it stays put in between)
    Z3.fr = (Z3.fr || 0) + 1;
    if (gfxLevel() < 3 || Z3.fr % 2 === 0 || !Z3.ovMesh.visible) {
      try { z3GroundPass(_render); } catch (e) { if (typeof guardReport === 'function') guardReport('z3ground', e); }
    }
    const t1 = performance.now();
    z3Ground();
    if (World.props !== Z3.propsRef || World.props.length !== Z3.propsLen) { Z3.propsRef = World.props; Z3.propsLen = World.props.length; z3Solids(); }
    z3Stand(); z3Points();
    Z3.target = G.state === 'play' || G.state === 'pause' ? z3Target(1200) : null;
    if (typeof mdlFrame === 'function') mdlFrame();
    const t2 = performance.now();
    Z3.R.render(Z3.scene, Z3.cam);
    if (typeof z3GunDraw === 'function') z3GunDraw();
    if (typeof z3GunUi === 'function') z3GunUi();
    const t3 = performance.now();
    z3Overlay();
    z3Pointer();
    const t4 = performance.now();
    T.flat = T.flat * 0.9 + (t1 - t0) * 0.1; T.build = T.build * 0.9 + (t2 - t1) * 0.1; T.gl = T.gl * 0.9 + (t3 - t2) * 0.1; T.ov = T.ov * 0.9 + (t4 - t3) * 0.1;
  };
}
// the title screen: a slow flight over the Zone behind the menus (the flat game's title camera path, from above the roofs)
let Z3_TITLE = false;
function z3TitleOff() { if (!Z3_TITLE) return; Z3_TITLE = false; if (!Z3_MODE) { Z3C.gl.style.display = 'none'; cv.style.opacity = ''; resize(); } }
function z3TitleFrame(_render) {
  if (Z3.noTitle) throw new Error('off');
  if (Z3_MODE) z3Leave();
  if (!Z3_TITLE) { Z3_TITLE = true; Z3C.gl.style.display = 'block'; Z3C.ov.style.display = 'none'; cv.style.opacity = '0'; }
  const px = P.x, py = P.y; P.x = CAM.x; P.y = CAM.y;
  try {
    Z3.yaw = Math.atan2(-12, 30) + Math.sin(NOW * 0.07) * 0.5; Z3.pitch = -0.3;
    z3Camera();
    const cam = Z3.cam, h = 230; cam.position.y = h;
    cam.lookAt(P.x + Math.cos(Z3.yaw) * 100, h - 31, P.y + Math.sin(Z3.yaw) * 100);
    z3GroundPass(_render, true); z3Ground();
    if (World.props !== Z3.propsRef || World.props.length !== Z3.propsLen) { Z3.propsRef = World.props; Z3.propsLen = World.props.length; z3Solids(); }
    z3Stand(); z3Points();
    Z3.sky.position.copy(cam.position); Z3.stars.position.copy(cam.position);
    Z3.R.render(Z3.scene, cam);
  } finally { P.x = px; P.y = py; }
}
if (typeof GLR !== 'undefined') GLR.want = () => false; // the WebGL 2D layer is not used under the 3D view

// ---------- moving and aiming by where you look ----------
{
  const _up = updatePlayer, MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  updatePlayer = function (dt) {
    if (!Z3_MODE) return _up.apply(this, arguments);
    let mx = 0, my = 0;
    if (keys.KeyW || keys.ArrowUp) my--; if (keys.KeyS || keys.ArrowDown) my++;
    if (keys.KeyA || keys.ArrowLeft) mx--; if (keys.KeyD || keys.ArrowRight) mx++;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw), wx = c * -my - s * mx, wy = s * -my + c * mx;
    const sk = MOVE.map((k) => keys[k]), sj = [joy.active, joy.dx, joy.dy];
    for (const k of MOVE) keys[k] = false;
    joy.active = Math.hypot(wx, wy) > 0.01; joy.dx = wx; joy.dy = wy;
    try { return _up.apply(this, arguments); } finally { MOVE.forEach((k, i) => { keys[k] = sk[i]; }); joy.active = sj[0]; joy.dx = sj[1]; joy.dy = sj[2]; }
  };
}
// the mutant in front of you: inside the aim cone, nearest first (a focused target wins while it is in range)
function z3Target(range, skip) {
  const c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw), tA = Math.tan(Z3.A), R2 = range * range;
  if (G.focus && !G.focus.dead && G.focusT > 0 && dist2(G.focus.x, G.focus.y, P.x, P.y) < R2 && !(skip && skip.includes(G.focus))) return G.focus;
  let best = null, bs = 1e18;
  for (const e of G.enemies) {
    if (e.dead || e.hidden || (skip && skip.includes(e))) continue;
    if ((e.id === 'bloodsucker' || e.id === 'cat' || e.id === 'snake' || e.id === 'wraith') && e.alpha < 0.3) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d2 = dx * dx + dy * dy; if (d2 > R2) continue;
    const f = dx * c + dy * s; if (f <= 0) continue;
    const side = Math.abs(-dx * s + dy * c); if (side > f * tA + (e.r || 12) * 1.2) continue;
    const d = Math.sqrt(d2), sc = d + side * 1.5; if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}
{
  const _near = nearest;
  nearest = function (x, y, range, skip) {
    if (!Z3_MODE || z3AimMode() !== 'look' || !G || G.title || x !== P.x || y !== P.y) return _near.apply(this, arguments);
    return z3Target(range, skip);
  };
}

// in first person you cannot see behind you: most new mutants arrive from in front (or the sides), all of them move a
// little slower than in the flat game, and one closing in from behind is slowed while it is out of sight
{
  const _se = spawnEnemy;
  spawnEnemy = function (id, x, y, o) {
    if (Z3_MODE && G && !G.title && P && !(o && (o.noTheme || o.mini)) && ENEMIES[id] && !ENEMIES[id].boss) {
      const d = Math.hypot(x - P.x, y - P.y);
      if (d > 260) {
        const rel = z3Rel(x, y);
        if (Math.abs(rel) > 1.75 && Math.random() < 0.8) { // behind: mirror it to the front half
          const a = Z3.yaw + (rel > 0 ? Math.PI - rel : -Math.PI - rel), nx = P.x + Math.cos(a) * d, ny = P.y + Math.sin(a) * d;
          if (World.free(nx, ny, 20)) { x = nx; y = ny; }
        }
      }
    }
    const e = _se.call(this, id, x, y, o);
    if (Z3_MODE && e && !e.boss && !e._z3s) { e._z3s = 1; e.spd *= 0.82; }
    return e;
  };
  const _ue = updateEnemies;
  updateEnemies = function (dt) {
    if (!Z3_MODE || !P) return _ue.apply(this, arguments);
    const half = Z3.cam.fov * Z3.cam.aspect * Math.PI / 360 * 0.9, slowed = [];
    for (const e of G.enemies) {
      if (e.dead || e.boss) continue; const dx = e.x - P.x, dy = e.y - P.y, d2 = dx * dx + dy * dy;
      if (d2 < 420 * 420 && Math.abs(z3Rel(e.x, e.y)) > half) { slowed.push([e, e.spd]); e.spd *= d2 < 160 * 160 ? 0.5 : 0.7; }
    }
    try { return _ue.apply(this, arguments); } finally { for (const [e, sp] of slowed) e.spd = sp; }
  };
}

// ---------- mouse and touch look ----------
function z3Playing() { return Z3_MODE && G && !G.title && G.state === 'play'; }
function z3Pointer() {
  const locked = document.pointerLockElement === cv;
  if (locked && !z3Playing()) document.exitPointerLock();
  const want = !Z3_PHONE && z3Playing() && !locked && !('ontouchstart' in window && !matchMedia('(pointer: fine)').matches);
  Z3C.hint.style.display = want ? 'block' : 'none';
  if (want) Z3C.hint.textContent = '🖱️ ' + z3Tr('Click to look around with the mouse') + ' · Esc = ' + z3Tr('pause');
}
addEventListener('DOMContentLoaded', () => {
  for (const f of ['togglePause', 'toggleMap', 'endRun', 'levelUp']) {
    if (typeof window[f] !== 'function') continue;
    const o = window[f]; window[f] = function () { const r = o.apply(this, arguments); if (Z3C.hint) z3Pointer(); return r; };
  }
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === cv;
  if (!locked && Z3.wasLocked && z3Playing()) { togglePause(); Z3.autoPauseT = performance.now(); } // Esc frees the mouse: pause like the flat game does
  Z3.wasLocked = locked;
});
// that same Esc press must not also reach the game and unpause it straight away
addEventListener('keydown', (e) => { if (e.code === 'Escape' && Z3.autoPauseT && performance.now() - Z3.autoPauseT < 250) e.stopImmediatePropagation(); }, true);
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== cv || !Z3_MODE) return;
  const k = 0.0023 * z3Sens(), mx = clamp(e.movementX, -250, 250), my = clamp(e.movementY, -250, 250);
  Z3.yaw += mx * k; Z3.pitch = clamp(Z3.pitch - my * k * (z3Set().inv3d ? -1 : 1), -1.1, 1.1);
});
// right mouse button held and dragged also turns the view (works even where the browser refuses to capture the mouse)
const Z3M = { on: false, x: 0, y: 0 };
addEventListener('mousedown', (e) => { if (Z3_MODE && e.button === 2 && e.target === cv && document.pointerLockElement !== cv) { Z3M.on = true; Z3M.x = e.clientX; Z3M.y = e.clientY; e.preventDefault(); } }, true);
addEventListener('mousemove', (e) => {
  if (!Z3M.on || document.pointerLockElement === cv) return;
  const k = 0.0035 * z3Sens(); Z3.yaw += (e.clientX - Z3M.x) * k; Z3.pitch = clamp(Z3.pitch - (e.clientY - Z3M.y) * k * (z3Set().inv3d ? -1 : 1), -1.1, 1.1); Z3M.x = e.clientX; Z3M.y = e.clientY;
});
addEventListener('mouseup', (e) => { if (e.button === 2) Z3M.on = false; });
addEventListener('contextmenu', (e) => { if (Z3_MODE && e.target === cv) e.preventDefault(); });
// mouse clicks in the 3D view capture the mouse; once captured, a click focuses fire on the mutant under the crosshair
addEventListener('mousedown', (e) => {
  if (!Z3_MODE || e.target !== cv || e.button !== 0) return;
  e.stopImmediatePropagation();
  if (document.pointerLockElement !== cv) { if (z3Playing()) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (er) { /* not allowed */ } } return; }
  if (typeof GUN !== 'undefined') GUN.trig = true; // captured: the left button fires the gun in your hands
}, true);
// captured mouse: the right button marks the mutant under the crosshair for all your weapons (focus fire)
addEventListener('mousedown', (e) => {
  if (!Z3_MODE || e.button !== 2 || document.pointerLockElement !== cv) return;
  const t = z3Target(1400); if (t) { G.focus = t; G.focusT = 8; text(t.x, t.y - 50, '🎯 ' + z3Tr('FOCUS'), '#ff6a4a', true, true); }
}, true);
// phones: the right side of the screen turns the view, the left side stays the movement stick
const Z3T = { id: null, x: 0, y: 0 };
addEventListener('pointerdown', (e) => {
  if (!Z3_MODE || e.pointerType === 'mouse' || e.target !== cv) return;
  if (e.clientX < innerWidth * 0.45 || Z3T.id !== null) return;
  e.stopImmediatePropagation(); Z3T.id = e.pointerId; Z3T.x = e.clientX; Z3T.y = e.clientY;
}, true);
addEventListener('pointermove', (e) => {
  if (e.pointerId !== Z3T.id) return;
  const k = 0.0062 * z3Sens();
  Z3.yaw += (e.clientX - Z3T.x) * k; Z3.pitch = clamp(Z3.pitch - (e.clientY - Z3T.y) * k * 0.7 * (z3Set().inv3d ? -1 : 1), -0.9, 0.9);
  Z3T.x = e.clientX; Z3T.y = e.clientY; e.stopImmediatePropagation();
}, true);
const z3TEnd = (e) => { if (e.pointerId === Z3T.id) { Z3T.id = null; e.stopImmediatePropagation(); } };
addEventListener('pointerup', z3TEnd, true); addEventListener('pointercancel', z3TEnd, true);
// standing still, a dash goes where you look (moving, it follows the movement keys as before)
{
  const _td = tryDash;
  tryDash = function () {
    if (!Z3_MODE || !P || P.moving) return _td.apply(this, arguments);
    const a = P.lastMx, b = P.lastMy; P.lastMx = Math.cos(Z3.yaw); P.lastMy = Math.sin(Z3.yaw);
    try { return _td.apply(this, arguments); } finally { P.lastMx = a; P.lastMy = b; }
  };
}
// after a menu (pause, level-up card, shop…) closes with a click, take the mouse back
addEventListener('click', () => {
  if (Z3_PHONE || !z3Playing() || document.pointerLockElement === cv || !matchMedia('(pointer: fine)').matches) return;
  try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ }
});

// quest people are drawn standing in 3D, not flat on the ground
addEventListener('DOMContentLoaded', () => {
  if (typeof QT2 === 'undefined') return;
  for (const k in QT2) { const d = QT2[k]; if (!d || typeof d.draw !== 'function') continue; const o = d.draw; d.draw = function (q) { if (Z3_PASS && q && q.npc) return; return o.apply(this, arguments); }; }
});

// the minimap shows which way you look: a light cone from your dot
addEventListener('DOMContentLoaded', () => {
  if (typeof drawMinimap !== 'function' || typeof mmx === 'undefined') return;
  const _dm = drawMinimap;
  drawMinimap = function () {
    const r = _dm.apply(this, arguments);
    if (Z3_MODE && P && Z3.cam) {
      const c = mm.width / 2, R = mm.width * 0.3, h = Math.min(1.2, Z3.cam.fov * Z3.cam.aspect * Math.PI / 360);
      mmx.save(); mmx.setTransform(1, 0, 0, 1, 0, 0);
      for (const [k, a] of [[1, 0.16], [0.6, 0.2]]) { mmx.fillStyle = `rgba(255,240,180,${a})`; mmx.beginPath(); mmx.moveTo(c, c); mmx.arc(c, c, R * k, Z3.yaw - h, Z3.yaw + h); mmx.closePath(); mmx.fill(); }
      mmx.restore();
    }
    return r;
  };
});

// ---------- knowing what is around you ----------
// where a hit came from (the nearest mutant or enemy shot when you lose health), and a hit marker when you land one
Z3.hits = [];
{
  const _hp = hurtPlayer;
  hurtPlayer = function () {
    const h0 = P ? P.hp : 0, r = _hp.apply(this, arguments);
    if (Z3_MODE && P && P.hp < h0) {
      let best = null, bd = 160 * 160;
      for (const e of G.enemies) { if (e.dead) continue; const d = dist2(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } }
      if (!best) for (const b of G.ebullets) { const d = dist2(b.x, b.y, P.x, P.y); if (d < 90 * 90 && d < bd) { bd = d; best = b; } }
      if (best) { Z3.hits.push({ a: Math.atan2(best.y - P.y, best.x - P.x), t: NOW }); if (Z3.hits.length > 6) Z3.hits.shift(); }
    }
    return r;
  };
  const _he = hurtEnemy;
  hurtEnemy = function () { const r = _he.apply(this, arguments); if (Z3_MODE) Z3.hmT = NOW; return r; };
}
function z3Senses(g, W, H) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32, half = Z3.cam.fov * Z3.cam.aspect * Math.PI / 360;
  // red arcs towards whatever just hurt you
  for (const h of Z3.hits) {
    const age = NOW - h.t; if (age > 1.2) continue;
    let rel = h.a - Z3.yaw; while (rel > Math.PI) rel -= TAU; while (rel < -Math.PI) rel += TAU;
    const a = rel - Math.PI / 2; g.strokeStyle = `rgba(255,40,30,${0.85 * (1 - age / 1.2)})`; g.lineWidth = 9;
    g.beginPath(); g.arc(cx, cy, R, a - 0.28, a + 0.28); g.stroke();
  }
  // mutants close by but out of sight: chevrons around the crosshair pointing at them
  const near = [];
  for (const e of G.enemies) { if (e.dead || e.hidden || (e.alpha !== undefined && e.alpha < 0.3)) continue; const d2 = dist2(e.x, e.y, P.x, P.y); if (d2 < 280 * 280) near.push([d2, e]); }
  near.sort((a, b) => a[0] - b[0]);
  let n = 0;
  for (const [d2, e] of near) {
    const rel = z3Rel(e.x, e.y); if (Math.abs(rel) < half * 0.85) continue;
    if (++n > 8) break;
    const d = Math.sqrt(d2), k = clamp(1 - d / 280, 0.15, 1), a = rel - Math.PI / 2, x = cx + Math.cos(a) * R * 1.12, y = cy + Math.sin(a) * R * 1.12;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgba(255,${Math.round(150 - k * 120)},60,${0.35 + k * 0.55})`;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -10); g.lineTo(-1, 0); g.lineTo(-6, 10); g.fill(); g.restore();
  }
  // hit marker
  const hm = NOW - (Z3.hmT || -9);
  if (hm < 0.12) { g.strokeStyle = `rgba(255,255,255,${1 - hm / 0.12})`; g.lineWidth = 2; g.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + sx * 6, cy + sy * 6); g.lineTo(cx + sx * 12, cy + sy * 12); } g.stroke(); }
}

// ---------- settings ----------
addEventListener('DOMContentLoaded', () => {
  if (typeof buildSettings !== 'function') return;
  const _bs = buildSettings;
  buildSettings = function () {
    _bs.apply(this, arguments);
    const s = z3Set(), body = $('settingsBody'); if (!body) return;
    const head = document.createElement('div'); head.className = 'set'; head.innerHTML = `<b style="color:#c8ff5a">🎮 ${z3Tr('3D view')}</b>`;
    const row = (html, on) => { const el = document.createElement('label'); el.className = 'set'; el.innerHTML = html; on(el); return el; };
    const aim = row(`<span>${z3Tr('Aiming')}</span><select><option value="look">${z3Tr('🎯 Where you look')}</option><option value="auto">${z3Tr('🔄 Automatic, all around')}</option></select>`, (el) => { const q = el.querySelector('select'); q.value = z3AimMode(); q.onchange = () => { s.aim3d = q.value; Save.save(); }; });
    const sens = row(`<span>${z3Tr('Look sensitivity')}</span><input type="range" min="0.3" max="2.5" step="0.05">`, (el) => { const q = el.querySelector('input'); q.value = z3Sens(); q.oninput = () => { s.sens3d = +q.value; Save.save(); }; });
    const fov = row(`<span>${z3Tr('Field of view')}</span><input type="range" min="60" max="100" step="1">`, (el) => { const q = el.querySelector('input'); q.value = z3Fov(); q.oninput = () => { s.fov3d = +q.value; Save.save(); }; });
    const inv = row(`<span>${z3Tr('Invert up/down look')}</span><input type="checkbox">`, (el) => { const q = el.querySelector('input'); q.checked = !!s.inv3d; q.onchange = () => { s.inv3d = q.checked; Save.save(); }; });
    const ga = row(`<span>${z3Tr('Rifle fires by itself when a mutant is under the crosshair')}</span><input type="checkbox">`, (el) => { const q = el.querySelector('input'); q.checked = typeof z3GunAuto === 'function' ? z3GunAuto() : false; q.onchange = () => { s.gunAuto = q.checked; Save.save(); }; });
    const first = body.firstChild;
    for (const el of [head, aim, ga, sens, fov, inv]) body.insertBefore(el, first);
  };
});
// the tutorial explains looking and aiming the 3D way
if (typeof TUT_STEPS !== 'undefined') {
  TUT_STEPS[0][0] = 'Look around with the mouse (or drag on the right side of a touch screen). Move with WASD (or drag on the left side).';
  TUT_STEPS[2][0] = 'Your weapons fire at what you look at. Turn to the 5 zombies and kill them!';
}
// translations for the 3D screens
(function () {
  if (typeof UI_TR === 'undefined' || typeof U !== 'function') return;
  const T = {
    'Click to look around with the mouse': U('დააწკაპუნე, რომ მაუსით მიმოიხედო', 'Нажми, чтобы осматриваться мышью', 'Натисни, щоб роздивлятися мишею'),
    'pause': U('პაუზა', 'пауза', 'пауза'),
    '3D view': U('3D ხედი', '3D-вид', '3D-вигляд'),
    'Aiming': U('დამიზნება', 'Прицеливание', 'Прицілювання'),
    '🎯 Where you look': U('🎯 სადაც იყურები', '🎯 Куда смотришь', '🎯 Куди дивишся'),
    '🔄 Automatic, all around': U('🔄 ავტომატური, ყველა მხარეს', '🔄 Автоматически, во все стороны', '🔄 Автоматично, на всі боки'),
    'Look sensitivity': U('ხედვის მგრძნობელობა', 'Чувствительность обзора', 'Чутливість огляду'),
    'Field of view': U('ხედვის კუთხე', 'Угол обзора', 'Кут огляду'),
    'Look around with the mouse (or drag on the right side of a touch screen). Move with WASD (or drag on the left side).': U('მიმოიხედე მაუსით (ან სენსორულ ეკრანზე მარჯვენა მხარეს გაასრიალე). იმოძრავე WASD-ით (ან მარცხენა მხარეს გასრიალებით).', 'Осматривайся мышью (или проводи по правой стороне сенсорного экрана). Двигайся WASD (или проводи по левой стороне).', 'Роздивляйся мишею (або проводь по правому боці сенсорного екрана). Рухайся WASD (або проводь по лівому боці).'),
    'Your weapons fire at what you look at. Turn to the 5 zombies and kill them!': U('იარაღი ისვრის იქ, სადაც იყურები. მიბრუნდი 5 ზომბისკენ და მოკალი ისინი!', 'Оружие стреляет туда, куда ты смотришь. Повернись к 5 зомби и убей их!', 'Зброя стріляє туди, куди ти дивишся. Повернися до 5 зомбі та вбий їх!'),
    'Rifle fires by itself when a mutant is under the crosshair': U('შაშხანა თავად ისვრის, როცა მუტანტი სამიზნეშია', 'Винтовка стреляет сама, когда мутант под прицелом', 'Гвинтівка стріляє сама, коли мутант під прицілом'),
    'Stalker Rifle': U('სტალკერის შაშხანა', 'Винтовка сталкера', 'Гвинтівка сталкера'),
    'The rifle in your hands: it shoots exactly where the crosshair points. Hold the left mouse button or FIRE.': U('შაშხანა შენს ხელში: ისვრის ზუსტად იქ, სადაც სამიზნეა. დააჭირე მაუსის მარცხენა ღილაკს ან FIRE-ს.', 'Винтовка в твоих руках: стреляет точно туда, куда смотрит прицел. Держи левую кнопку мыши или FIRE.', 'Гвинтівка у твоїх руках: стріляє точно туди, куди дивиться приціл. Тримай ліву кнопку миші або FIRE.'),
    'Piercing rounds': U('გამჭოლი ტყვიები', 'Бронебойные патроны', 'Бронебійні набої'),
    'Red-dot sight: +damage at range': U('კოლიმატორი: +ზიანი შორს', 'Коллиматор: +урон на дистанции', 'Коліматор: +шкода на відстані'),
    'Double tap': U('ორმაგი გასროლა', 'Двойной выстрел', 'Подвійний постріл'),
    'Heavy rounds': U('მძიმე ტყვიები', 'Тяжёлые патроны', 'Важкі набої'),
    'Drum magazine: +fire rate': U('დოლური მაღაზია: +სისწრაფე', 'Барабанный магазин: +скорострельность', 'Барабанний магазин: +скорострільність'),
    'ESCAPE JEEP': U('გაქცევის ჯიპი', 'ДЖИП ДЛЯ ПОБЕГА', 'ДЖИП ДЛЯ ВТЕЧІ'),
    'FOCUS': U('ფოკუსი', 'ФОКУС', 'ФОКУС'),
    'Invert up/down look': U('ზემოთ/ქვემოთ ხედვის ინვერსია', 'Инвертировать взгляд вверх/вниз', 'Інвертувати погляд вгору/вниз'),
  };
  for (const k in T) { UI_TR[k] = T[k]; if (I18n.dict) I18n.dict.set(k, T[k]); }
})();
