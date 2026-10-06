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
  eye: 44, fov: 75, A: 0.42, // aim cone half-angle (radians)
  ovN: 1024, ovR: 760, view: 1500,
  chunks: new Map(), chunkSrc: null, propsRef: null, propsLen: -1, stamp: 1,
  target: null, prof: { flat: 0, build: 0, gl: 0, ov: 0 },
};
const Z3_PHONE = typeof IS_PHONE !== 'undefined' && IS_PHONE;
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
  Z3.solid = new THREE.Group(); Z3.scene.add(Z3.solid);
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
    Z3.R.initTexture(t);
    const pg = { t, x: 0, y: 0, rh: 0, bb: new BB3(t) };
    this.pages.push(pg); Z3.scene.add(pg.bb.mesh);
    return pg;
  },
  // (ox, oy, w, h): the box (relative to the anchor, y down like the game) that draw() may paint into
  get(key, ox, oy, w, h, draw) {
    let sp = this.map.get(key);
    if (sp) return sp;
    const tc = performance.now(); let s = this.S;
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
    if (this.n >= this.cap) return;
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
const RGB3 = new Map();
function z3rgb(s) { // "r,g,b" → [r, g, b] in 0..1
  let v = RGB3.get(s); if (v) return v;
  const m = String(s).split(','); v = [(+m[0] || 0) / 255, (+m[1] || 0) / 255, (+m[2] || 0) / 255];
  if (RGB3.size > 500) RGB3.clear(); RGB3.set(s, v); return v;
}
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
    face(W, x, y + d, x + w, y + d, h, 0.92); face(W, x + w, y, x, y, h, 0.7);
    face(W, x, y, x, y + d, h, 0.62); face(W, x + w, y + d, x + w, y, h, 0.82);
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
  }
  for (const [k, W] of walls) {
    if (!W.p.length) continue;
    let mat = Z3.wallMats.get(k);
    if (!mat) { mat = new THREE.MeshBasicMaterial({ map: z3WallTex(W.style, W.alt), vertexColors: true, side: THREE.DoubleSide }); Z3.wallMats.set(k, mat); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(W.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(W.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(W.c, 3));
    grp.add(new THREE.Mesh(g, mat));
  }
  if (flat.p.length) {
    if (!Z3.flatMat) Z3.flatMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flat.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(flat.c, 3));
    grp.add(new THREE.Mesh(g, Z3.flatMat));
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
    const m = new THREE.Mesh(Z3.chunkGeo, new THREE.MeshBasicMaterial({ map: tex, fog: true }));
    m.position.set(gx * CHUNK + CHUNK / 2, 0, gy * CHUNK + CHUNK / 2); m.renderOrder = 0;
    Z3.scene.add(m); Z3.chunks.set(k, { m, tex, s: st }); made++;
  }
  for (const [k, t] of Z3.chunks) if (t.s !== st && !want.some((w) => w[3] === k)) {
    const gx = k % 1000, gy = Math.floor(k / 1000), d = Math.hypot(gx * CHUNK + CHUNK / 2 - P.x, gy * CHUNK + CHUNK / 2 - P.y);
    if (d > R + CHUNK * 1.2) { Z3.scene.remove(t.m); t.m.material.dispose(); t.tex.dispose(); Z3.chunks.delete(k); }
  }
  for (const t of Z3.chunks.values()) t.m.material.color.setScalar(Z3.bright);
}

// the original renderer, top-down around a point ahead of you, into the game canvas: everything it paints flat on the
// ground. Things that stand up (props, mutants, the player, pickups, bullets, numbers) are left out; they are 3D here.
const Z3_NULL = document.createElement('canvas').getContext('2d');
let Z3_PASS = false;
function z3GroundPass(_render) {
  const N = Z3.ovN, R = Z3.ovR, c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw);
  const gx = P.x + c * R * 0.55, gy = P.y + s * R * 0.55;
  if (cv.width !== N || cv.height !== N) { cv.width = N; cv.height = N; }
  const sv = { VW, VH, DPR, ZOOM, cx: CAM.x, cy: CAM.y, ctx, shake: G.shake, mg: minGfx, lg: lowGfx, gf: drawGroundFast,
    dp: drawPropFast, de: drawEnemyScaled, pl: drawPlayer, cr: drawCrate, pk: drawPickup, ar: drawArtifact, pc: drawPoiChest, pa: typeof drawPartner === 'function' ? drawPartner : null,
    en: G.enemies, bu: G.bullets, eb: G.ebullets, pa2: G.particles, tx: G.texts, th: G.throws };
  VW = N; VH = N; DPR = 1; ZOOM = N / (2 * R); CAM.x = gx; CAM.y = gy; G.shake = 0;
  minGfx = () => true; lowGfx = () => true; drawGroundFast = () => {};
  const no = () => {};
  drawPropFast = no; drawEnemyScaled = no; drawPlayer = no; drawCrate = no; drawPickup = no; drawArtifact = no; drawPoiChest = no; if (sv.pa) drawPartner = no;
  G.enemies = []; G.bullets = []; G.ebullets = []; G.particles = []; G.texts = []; G.throws = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, N, N);
  Z3_PASS = true;
  try { _render(false); } finally {
    Z3_PASS = false;
    VW = sv.VW; VH = sv.VH; DPR = sv.DPR; ZOOM = sv.ZOOM; CAM.x = sv.cx; CAM.y = sv.cy; ctx = sv.ctx; G.shake = sv.shake;
    minGfx = sv.mg; lowGfx = sv.lg; drawGroundFast = sv.gf; drawPropFast = sv.dp; drawEnemyScaled = sv.de; drawPlayer = sv.pl; drawCrate = sv.cr; drawPickup = sv.pk; drawArtifact = sv.ar; drawPoiChest = sv.pc; if (sv.pa) drawPartner = sv.pa;
    G.enemies = sv.en; G.bullets = sv.bu; G.ebullets = sv.eb; G.particles = sv.pa2; G.texts = sv.tx; G.throws = sv.th;
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
  let made = 0;
  for (let gy = cy0; gy <= cy1; gy++) for (let gx = cx0; gx <= cx1; gx++) {
    const cell = World.propGrid[gy * PC + gx]; if (!cell) continue;
    for (const p of cell) {
      if (p._s === st) continue; p._s = st;
      if (Z3_BLOCK.has(p.kind)) continue;
      const dx = p.x - px, dy = p.y - py; if (dx * dx + dy * dy > V2 || !ahead(p.x, p.y, 260)) continue;
      if (!SPR3.map.has(z3PropKey(p)) && ++made > 24) continue; // new sprites are spread over a few frames
      z3Push(z3PropSprite(p), p.x, p.y, 0, 1, 1, false, 1);
    }
  }
  // mutants
  const rxw = -s;
  for (const e of G.enemies) {
    if (e.dead && !(e.deadT > 0)) continue;
    const dx = e.x - px, dy = e.y - py; if (dx * dx + dy * dy > V2 || !ahead(e.x, e.y, 120)) continue;
    let a = e.alpha === undefined ? 1 : e.alpha;
    if (!e._z3t) e._z3t = NOW; a *= Math.min(1, (NOW - e._z3t) / 0.5); // fade in where they appear
    if (a < 0.03) continue;
    const vs = (e.sc || 1) * (e.d && e.d.vsc || 1), an = typeof animSquash === 'function' ? animSquash(e) : 0;
    z3Push(z3EnemySprite(e), e.x, e.y, e.z || 0, vs * (1 + an), vs * (1 - an), (e.face || 1) * rxw < 0, e.flash > 0 ? -a : a);
  }
  // crates, pickups, artifacts, locked chests
  for (const k of G.crates) {
    if (k.open >= 1.5) continue; const dx = k.x - px, dy = k.y - py; if (dx * dx + dy * dy > V2) continue;
    const sp = SPR3.get('crate|' + (k.open ? 1 : 0), -40, -60, 80, 72, () => drawCrate({ x: 0, y: 0, open: k.open ? 1 : 0, _raw: 1 }));
    z3Push(sp, k.x, k.y, k.open ? 0 : Math.sin(NOW * 3 + k.x), 1, 1, false, k.open ? clamp(1 - k.open / 1.5, 0, 1) : 1);
  }
  for (const k of G.pickups) {
    const dx = k.x - px, dy = k.y - py; if (dx * dx + dy * dy > V2) continue;
    const key = 'pk|' + k.type + '|' + (k.id || '');
    const sp = SPR3.get(key, -80, -110, 160, 140, () => { const n = NOW; NOW = 0; try { drawPickup({ ...k, x: 0, y: 0 }); } finally { NOW = n; } });
    z3Push(sp, k.x, k.y, 2 + Math.sin(NOW * 4 + k.x) * 3, 1, 1, false, 1);
  }
  const detR = 330 * (P.detect || 1);
  for (const f of World.fields) {
    const a = f.art; if (!a) continue; const d = Math.hypot(a.x - px, a.y - py); if (d > detR) continue;
    const sp = SPR3.get('art|' + a.type, -60, -90, 120, 120, () => drawArtifact({ ...a, x: 0, y: 0 }, 1));
    z3Push(sp, a.x, a.y, 4 + Math.sin(NOW * 3 + a.x) * 3, 1, 1, false, clamp((detR - d) / 120, 0, 1));
  }
  for (const p of World.pois) {
    if (p.state >= 2) continue; const dx = p.x - px, dy = p.y - py; if (dx * dx + dy * dy > V2) continue;
    z3Push(SPR3.get('poi|' + p.icon + p.name, -140, -100, 280, 110, () => drawPoiChest({ ...p, x: 0, y: 0 })), p.x, p.y, 0, 1, 1, false, 1);
  }
  // teammates
  if (typeof CO !== 'undefined' && CO.active && typeof coOthers === 'function') for (const q of coOthers()) {
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
    const r = b.r || 4, col = b.k === 'bolt' ? [0.75, 0.75, 0.7] : b.ignite ? [1, 0.55, 0.15] : b.rocket ? [1, 0.7, 0.25] : b.big ? [1, 0.95, 0.7] : [1, 0.86, 0.55];
    const sz = (b.rocket ? 22 : 8 + r * 2.2);
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
  A.end(); N.end();
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
  const eye = (P.veh ? 58 : Z3.eye) + (P.z || 0) + bob;
  const jx = sh ? (Math.random() - 0.5) * sh * 0.25 : 0, jy = sh ? (Math.random() - 0.5) * sh * 0.25 : 0;
  cam.position.set(P.x + jx, eye + jy, P.y);
  const cp = Math.cos(Z3.pitch);
  cam.lookAt(P.x + jx + Math.cos(Z3.yaw) * cp * 100, eye + jy + Math.sin(Z3.pitch) * 100, P.y + Math.sin(Z3.yaw) * cp * 100);
  Z3.rx = -Math.sin(Z3.yaw); Z3.rz = Math.cos(Z3.yaw);
  Z3.ptK = H * Z3.pr * 0.5 / Math.tan(cam.fov * Math.PI / 360);
  // light and air: daylight, night, fog weather and labs
  const dark = clamp(Env.darkness ? Env.darkness() : 0, 0, 1), lab = World.kind === 'lab';
  Z3.bright = lab ? 0.55 + (1 - dark) * 0.35 : 1 - dark * 0.72;
  const fogK = clamp(Env.fogA || 0, 0, 1);
  const far = (Z3_PHONE || minGfx() ? 1150 : 1500) * (1 - fogK * 0.55) * (lab ? 0.6 : 1);
  Z3.view = far + 80;
  const base = lab ? [0.04, 0.045, 0.05] : [0.54, 0.565, 0.53];
  const night = lab ? [0.02, 0.02, 0.025] : [0.035, 0.045, 0.1];
  const k = lab ? 0.5 : dark, col = [lerp(base[0], night[0], k), lerp(base[1], night[1], k), lerp(base[2], night[2], k)];
  Z3.fog.color.setRGB(col[0], col[1], col[2]); Z3.scene.background.setRGB(col[0], col[1], col[2]);
  Z3.fog.near = far * 0.18; Z3.fog.far = far;
  if (Z3.flatMat) Z3.flatMat.color.setScalar(Z3.bright);
  if (Z3.wallMats) for (const m of Z3.wallMats.values()) m.color.setScalar(Z3.bright);
}
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
  z3Gun(g, W, H);
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
  if (G.flash > 0) { g.fillStyle = `rgba(${G.flashCol},${G.flash * 0.6})`; g.fillRect(0, 0, W, H); }
  if (G.fade > 0) { g.fillStyle = `rgba(0,0,0,${G.fade})`; g.fillRect(0, 0, W, H); }
}
// the gun in your hands: kicks back and flashes when your weapons fire, sways while you walk
function z3Gun(g, W, H) {
  if (P.veh) return;
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
    if (!Z3.ok || title || !G || G.title) { z3Leave(); return _render.apply(this, arguments); }
    z3Enter(); Z3.on = true;
    const T = Z3.prof, t0 = performance.now();
    z3Camera();
    try { z3GroundPass(_render); } catch (e) { if (typeof guardReport === 'function') guardReport('z3ground', e); }
    const t1 = performance.now();
    z3Ground();
    if (World.props !== Z3.propsRef || World.props.length !== Z3.propsLen) { Z3.propsRef = World.props; Z3.propsLen = World.props.length; z3Solids(); }
    z3Stand(); z3Points();
    Z3.target = G.state === 'play' || G.state === 'pause' ? z3Target(1200) : null;
    const t2 = performance.now();
    Z3.R.render(Z3.scene, Z3.cam);
    const t3 = performance.now();
    z3Overlay();
    z3Pointer();
    const t4 = performance.now();
    T.flat = T.flat * 0.9 + (t1 - t0) * 0.1; T.build = T.build * 0.9 + (t2 - t1) * 0.1; T.gl = T.gl * 0.9 + (t3 - t2) * 0.1; T.ov = T.ov * 0.9 + (t4 - t3) * 0.1;
  };
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
  const k = 0.0023 * z3Sens();
  Z3.yaw += e.movementX * k; Z3.pitch = clamp(Z3.pitch - e.movementY * k * (z3Set().inv3d ? -1 : 1), -1.1, 1.1);
});
// mouse clicks in the 3D view capture the mouse; once captured, a click focuses fire on the mutant under the crosshair
addEventListener('mousedown', (e) => {
  if (!Z3_MODE || e.target !== cv || e.button !== 0) return;
  e.stopImmediatePropagation();
  if (document.pointerLockElement !== cv) { if (z3Playing()) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (er) { /* not allowed */ } } return; }
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
    const first = body.firstChild;
    for (const el of [head, aim, sens, fov, inv]) body.insertBefore(el, first);
  };
});
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
    'Invert up/down look': U('ზემოთ/ქვემოთ ხედვის ინვერსია', 'Инвертировать взгляд вверх/вниз', 'Інвертувати погляд вгору/вниз'),
  };
  for (const k in T) { UI_TR[k] = T[k]; if (I18n.dict) I18n.dict.set(k, T[k]); }
})();
