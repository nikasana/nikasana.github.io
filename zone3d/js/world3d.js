'use strict';
// ---------- ZoneBonk 3D: anomalies, trees, rocks, barrels, crates and artifacts in 3D ----------
// Anomalies get a living 3D shape on top of their glow on the ground: crackling arcs, flame columns, swirling
// debris, bubbling acid, ice shards, shimmering domes… Scenery that used to be a flat picture (trees, dead trees,
// bushes, rocks, barrels, tanks), supply crates and artifacts are 3D now too, drawn with the same shared shapes.
const W3S = { cx: 1e9, cy: 1e9, props: null, n: -1, v: 0 };
const W3_PICK = new Set(['med', 'magnet', 'art', 'stash', 'poistash', 'labstash']);
const W3_PROPS = new Set(['tree', 'deadtree', 'bush', 'rock', 'barrel', 'tank', 'guide']);
const W3_ANOM = new Set(['electro', 'tesla', 'burner', 'comet', 'vortex', 'magnet', 'flip', 'acid', 'gas', 'spring', 'geyser', 'teleport', 'timeloop', 'mirror', 'cryo', 'mincer', 'fuzz', 'psifield', 'sound']);
(function w3Init() {
  if (!MDL.ready) return;
  const m = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1, Z3_PHONE ? 6 : 9), new THREE.MeshLambertMaterial({ color: 0xffffff }), 5000);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(5000 * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.count = 0; m.cap = 5000; m.frustumCulled = false; m.castShadow = true; Z3.scene.add(m); MDL.cone = m;
  // scenery never moves: it goes into its own lower-detail instance buffers, rebuilt only after you walk a bit
  const mk = (geo, cap, mat) => { const t = new THREE.InstancedMesh(geo, mat || new THREE.MeshLambertMaterial({ color: 0xffffff }), cap); t.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); t.count = 0; t.cap = cap; t.frustumCulled = false; t.castShadow = true; Z3.scene.add(t); return t; };
  W3S.box = mk(new THREE.BoxGeometry(1, 1, 1), 3000); W3S.sph = mk(new THREE.SphereGeometry(0.5, 8, 6), 9000); W3S.cyl = mk(new THREE.CylinderGeometry(0.5, 0.5, 1, 7), 9000);
  W3S.cone = mk(new THREE.ConeGeometry(0.5, 1, 7), 6000); W3S.tsph = mk(W3S.sph.geometry, 600, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }));
  W3S.tsph.renderOrder = 2;
  W3S.shd = new THREE.InstancedMesh(MDL.shd.geometry, MDL.shd.material, 3000); W3S.shd.count = 0; W3S.shd.cap = 3000; W3S.shd.frustumCulled = false; W3S.shd.renderOrder = 1; Z3.scene.add(W3S.shd);
  MDL.extra = MDL.extra || [];
  MDL.extra.push(w3Props, w3Anoms);
})();
const w3c = (a, k = 1) => '#' + ((Math.round(a[0] * k) << 16) | (Math.round(a[1] * k) << 8) | Math.round(a[2] * k)).toString(16).padStart(6, '0');
const w3hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

// ---------- scenery ----------
function w3Props() {
  if (!MDL.cone) return;
  MDL.cone.count = 0;
  const px = P.x, py = P.y, V = Z3.view + 120;
  if (Math.hypot(px - W3S.cx, py - W3S.cy) > 60 || W3S.props !== World.props || W3S.n !== World.props.length || Math.abs(W3S.v - V) > 50) w3Static(px, py, V);
  const V2 = Z3.view * Z3.view;
  // the guide and other standing stalker props, parked bikes and jeeps
  for (const g of W3S.guides || []) { if (dist2(g.x, g.y, px, py) > V2) continue; const st = g._m || (g._m = { yaw: g.x * 0.01, ph: 0, move: 0, seed: 1, atk: false }); st.yaw += (Math.atan2(py - g.y, px - g.x) - st.yaw) * 0.05; mdlHuman(g.x, g.y, 0, st.yaw, 0.95, typeof PAL_PLAYER !== 'undefined' ? PAL_PLAYER : {}, st, null); }
  for (const v of World.vehicles || []) {
    if (v === P.veh || dist2(v.x, v.y, px, py) > V2) continue;
    const a = v.a || 0, c = Math.cos(a), sn = Math.sin(a), at = (u, w) => [v.x + c * u - sn * w, v.y + sn * u + c * w];
    if (v.kind === 'bike') {
      for (const u of [-14, 14]) { const [x, y] = at(u, 0); mdlPart(MDL.cyl, x, 7, y, -a, Math.PI / 2, 0, 14, 4, 14, '#151515'); }
      const [bx, by] = at(0, 0); mdlPart(MDL.box, bx, 15, by, -a, 0, 0, 26, 6, 6, '#b8342a'); mdlPart(MDL.box, bx - c * 3, 19, by - sn * 3, -a, 0, 0, 12, 3, 8, '#222');
      const [hx, hy] = at(12, 0); mdlPart(MDL.box, hx, 24, hy, -a, 0, 0, 3, 3, 18, '#333');
    } else {
      const [x, y] = at(0, 0);
      mdlPart(MDL.box, x, 16, y, -a, 0, 0, 72, 18, 40, '#4e5a3a'); mdlPart(MDL.box, x - c * 6, 31, y - sn * 6, -a, 0, 0, 40, 14, 36, '#5e6a44');
      mdlPart(MDL.box, x + c * 14, 31, y + sn * 14, -a, 0, 0.35, 2, 13, 34, '#20262a');
      for (const [u, w] of [[-24, -20], [-24, 20], [24, -20], [24, 20]]) { const [wx, wy] = at(u, w); mdlPart(MDL.cyl, wx, 8, wy, -a, Math.PI / 2, 0, 16, 7, 16, '#111'); }
      const [lx, ly] = at(37, -13); mdlPart(MDL.gbox, lx, 17, ly, -a, 0, 0, 1, 4, 5, '#ffe070'); const [rx, ry] = at(37, 13); mdlPart(MDL.gbox, rx, 17, ry, -a, 0, 0, 1, 4, 5, '#ffe070');
    }
  }
  // XP gems: little glowing crystals that bob and spin (green, blue, pink by value)
  let ng = 0;
  for (const g of G.gems) {
    if (ng > 400) break; const dx = g.x - px, dy = g.y - py; if (dx * dx + dy * dy > 800 * 800) continue; ng++;
    const big = g.v >= 20, mid = g.v >= 5, s = big ? 9 : mid ? 7 : 5, h = 8 + (g.z || 0) + Math.sin(NOW * 4 + g.x) * 2;
    mdlPart(MDL.gbox, g.x, h, g.y, NOW * 2 + g.x, 0.785, 0.785, s, s, s, big ? '#ff6ad5' : mid ? '#6ad0ff' : '#7dff8a');
  }
  // explosions: a fireball that swells and fades over the scorch on the ground
  for (const f of G.fx) {
    if (f.k !== 'boom' || f.delay > 0) continue; const dx = f.x - px, dy = f.y - py; if (dx * dx + dy * dy > V2) continue;
    const k = clamp(f.life / f.max, 0, 1), r = (f.r || 60) * (1.1 - k * 0.5);
    mdlPart(MDL.gsph, f.x, r * 0.35, f.y, 0, 0, 0, r * 0.7 * k, r * 0.6 * k, r * 0.7 * k, '#fff0c0');
    mdlPart(MDL.tsph, f.x, r * 0.4, f.y, NOW, 0, 0, r * 1.6, r * 1.2 * (0.6 + k * 0.4), r * 1.6, k > 0.5 ? '#ff9a30' : '#5a4a40');
  }
  // labs: light panels in the ceiling, some flickering
  if (World.kind === 'lab' && World.lab && World.lab.grid) {
    const gr = World.lab.grid;
    for (let ty = 0; ty < LAB_N; ty += 2) for (let tx = (ty / 2) % 2; tx < LAB_N; tx += 2) {
      if (gr[ty * LAB_N + tx] !== 1) continue; const x = tx * LAB_T + LAB_T / 2, y = ty * LAB_T + LAB_T / 2; if (dist2(x, y, px, py) > V2) continue;
      const fl = w3hash(tx * 31 + ty) < 0.15 ? (Math.sin(NOW * 23 + tx) > 0.3 ? 1 : 0.25) : 1;
      mdlPart(MDL.gbox, x, 120, y, 0, 0, 0, 34, 1.5, 10, fl > 0.5 ? '#d8f0e8' : '#3a4440');
    }
  }
  // pickups: medkits, magnets, artifacts lying around, stash chests
  for (const k of G.pickups) {
    if (!W3_PICK.has(k.type)) continue; const dx = k.x - px, dy = k.y - py; if (dx * dx + dy * dy > V2) continue;
    const bob = Math.sin(NOW * 4 + k.x) * 3, h = 14 + bob, rot = NOW * 1.5 + k.x;
    if (k.type === 'med') {
      mdlPart(MDL.box, k.x, h, k.y, rot, 0, 0, 18, 13, 12, '#e8e8e4');
      mdlPart(MDL.gbox, k.x, h, k.y, rot, 0, 0, 4, 9, 12.5, '#e02a20'); mdlPart(MDL.gbox, k.x, h, k.y, rot, 0, 0, 10, 3.5, 12.5, '#e02a20');
    } else if (k.type === 'magnet') {
      for (const sd of [-1, 1]) mdlPart(MDL.box, k.x + Math.cos(rot + 1.57) * sd * 5, h, k.y + Math.sin(rot + 1.57) * sd * 5, rot, 0, 0, 4, 14, 4, '#d23a2a');
      mdlPart(MDL.box, k.x, h + 7, k.y, rot, 0, 0, 4, 4, 14, '#d23a2a');
      for (const sd of [-1, 1]) mdlPart(MDL.gbox, k.x + Math.cos(rot + 1.57) * sd * 5, h - 7, k.y + Math.sin(rot + 1.57) * sd * 5, rot, 0, 0, 4.5, 3, 4.5, '#e0e0e0');
    } else if (k.type === 'art') {
      mdlPart(MDL.gsph, k.x, h + 4, k.y, rot, rot * 0.7, 0, 10, 12, 10, '#d4f2ff');
      mdlPart(MDL.tsph, k.x, h + 4, k.y, 0, 0, 0, 28, 28, 28, '#8ab8ff');
    } else { // stash chests
      mdlPart(MDL.box, k.x, 13, k.y, 0.3, 0, 0, 46, 24, 30, '#8a6a2a');
      mdlPart(MDL.box, k.x, 28, k.y, 0.3, 0, 0, 48, 8, 32, '#c9a040');
      mdlPart(MDL.gbox, k.x, 20, k.y, 0.3, 0, 0, 47, 3, 31, '#ffe070');
      mdlPart(MDL.tsph, k.x, 25, k.y, 0, 0, 0, 90 + Math.sin(NOW * 4) * 8, 60, 90 + Math.sin(NOW * 4) * 8, '#ffd250');
    }
  }
  // supply crates: a wooden box with a lid that flies off when opened
  for (const k of G.crates) {
    if (k.open >= 1.5) continue; const dx = k.x - px, dy = k.y - py; if (dx * dx + dy * dy > V2) continue;
    const bob = k.open ? 0 : Math.sin(NOW * 3 + k.x) * 1.5, o = k.open || 0;
    mdlPart(MDL.box, k.x, 11 + bob, k.y, 0.3, 0, 0, 28, 20, 28, '#6a4e2e');
    mdlPart(MDL.box, k.x, 22 + bob + o * 40, k.y, 0.3 + o * 4, o * 2, 0, 30, 5, 30, '#86653c');
    if (!k.open) mdlPart(MDL.gsph, k.x, 42 + bob + Math.sin(NOW * 4) * 3, k.y, 0, 0, 0, 5, 5, 5, '#ffdc78');
  }
  // artifacts your detector has found: glowing stones, slowly turning
  const detR = 330 * (P.detect || 1);
  for (const f of World.fields) {
    const a = f.art; if (!a) continue; const d = Math.hypot(a.x - px, a.y - py); if (d > detR) continue;
    const A = typeof ARTIFACTS !== 'undefined' && ARTIFACTS[a.type] || {}, h = 18 + Math.sin(NOW * 3 + a.x) * 4;
    mdlPart(MDL.gsph, a.x, h, a.y, NOW, NOW * 0.7, 0, 10, 12, 10, A.color || '#d4f2ff');
    MDL.ghost = true; mdlPart(MDL.tsph, a.x, h, a.y, 0, 0, 0, 30, 30, 30, A.c2 || A.color || '#8ab8ff'); MDL.ghost = false;
  }
  mdlUpload(MDL.cone);
}

// trees, dead trees, bushes, rocks, barrels and tanks around you, into the static buffers
function w3Static(px, py, V) {
  W3S.cx = px; W3S.cy = py; W3S.props = World.props; W3S.n = World.props.length; W3S.v = V;
  if (W3S.gp !== World.props) { W3S.gp = World.props; W3S.guides = World.props.filter((p) => p.kind === 'guide'); }
  for (const k of ['box', 'sph', 'cyl', 'cone', 'tsph', 'shd']) W3S[k].count = 0;
  const V2 = V * V, lowQ = lowGfx(), PC = WORLD / PCELL, st = ++World.stamp, B = W3S;
  const cx0 = Math.max(0, Math.floor((px - V) / PCELL)), cx1 = Math.min(PC - 1, Math.floor((px + V) / PCELL));
  const cy0 = Math.max(0, Math.floor((py - V) / PCELL)), cy1 = Math.min(PC - 1, Math.floor((py + V) / PCELL));
  const shadow = (x, y, r) => { if (B.shd.count >= B.shd.cap) return; _mM.compose(_v.set(x, 0.6, y), _q.identity(), _vS.set(r, 1, r)); B.shd.setMatrixAt(B.shd.count++, _mM); };
  for (let gy = cy0; gy <= cy1; gy++) for (let gx = cx0; gx <= cx1; gx++) {
    const cell = World.propGrid[gy * PC + gx]; if (!cell) continue;
    for (const p of cell) {
      if (p._s === st || !W3_PROPS.has(p.kind)) continue; p._s = st;
      const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy; if (d2 > V2) continue;
      const near = d2 < 90 * 90; // you stand in it: see-through so it does not fill the view
      if (p.kind === 'tree') {
        const k = p.s || 1, C = p.red ? TREE_COLS.red : p.pine ? TREE_COLS.pine : TREE_COLS.n, h = (p.pine ? 120 : 92) * k * 1.25;
        mdlPart(B.cyl, p.x, h * 0.3, p.y, 0, 0, 0, 7 * k, h * 0.6, 7 * k, '#4a3a2a');
        if (p.pine) for (let i = 0; i < 3; i++) mdlPart(near ? B.tsph : B.cone, p.x, h * (0.42 + i * 0.2), p.y, (p.seed || 0) + i, 0, 0, (62 - i * 16) * k, h * 0.38, (62 - i * 16) * k, w3c(C[Math.min(2, i)]));
        else {
          const R = [[0, 0.78, 0, 34], [-14, 0.72, 10, 26], [13, 0.7, -9, 26], [3, 0.92, 4, 24]];
          for (let i = 0; i < (lowQ ? 2 : 4); i++) { const [ox, oy, oz, r] = R[i]; mdlPart(near ? B.tsph : B.sph, p.x + ox * k, h * oy, p.y + oz * k, 0, 0, 0, r * 2 * k, r * 1.6 * k, r * 2 * k, w3c(C[i % 3])); }
        }
        shadow(p.x, p.y, 70 * k);
      } else if (p.kind === 'deadtree') {
        const k = p.s || 1, h = 88 * k * 1.25, col = p.red ? '#5a2e1e' : '#4d463c';
        mdlPart(B.cyl, p.x, h * 0.5, p.y, 0, 0, 0, 6 * k, h, 6 * k, col);
        for (let i = 0; i < (lowQ ? 2 : 4); i++) { const a = (p.seed || 0) + i * 1.7, hh = h * (0.45 + i * 0.13); mdlPart(B.cyl, p.x + Math.cos(a) * 9 * k, hh + 7 * k, p.y + Math.sin(a) * 9 * k, -a, 0, 0.9, 2.5 * k, 26 * k, 2.5 * k, col); }
      } else if (p.kind === 'bush') {
        const k = p.s || 1;
        mdlPart(near ? B.tsph : B.sph, p.x, 9 * k, p.y, 0, 0, 0, 36 * k, 22 * k, 34 * k, '#3e5a2e');
        mdlPart(near ? B.tsph : B.sph, p.x + 8 * k, 14 * k, p.y - 5 * k, 0, 0, 0, 22 * k, 18 * k, 22 * k, '#4e6a36');
      } else if (p.kind === 'rock') {
        const r = p.r || 20, a = (p.x * 0.01 + p.y * 0.013);
        mdlPart(B.sph, p.x, r * 0.32, p.y, a, 0.1, 0, r * 2.1, r * 1.3, r * 1.8, '#6c675e');
        if (!lowQ) mdlPart(B.sph, p.x + r * 0.3, r * 0.55, p.y - r * 0.2, a + 1, 0, 0.2, r * 1.1, r * 0.9, r * 1.0, '#7c776d');
      } else if (p.kind === 'barrel') {
        mdlPart(B.cyl, p.x, 14, p.y, 0, 0, 0, 20, 28, 20, p.ex ? '#a8382a' : p.rad ? '#b8a030' : '#4e5a48');
        mdlPart(B.cyl, p.x, 20, p.y, 0, 0, 0, 21, 2, 21, '#2a2a28'); mdlPart(B.cyl, p.x, 8, p.y, 0, 0, 0, 21, 2, 21, '#2a2a28');
      } else if (p.kind === 'tank') {
        const r = p.r || 40, h = p.h || 90;
        mdlPart(B.cyl, p.x, h / 2, p.y, 0, 0, 0, r * 2, h, r * 2, '#7a7a72');
        mdlPart(B.sph, p.x, h, p.y, 0, 0, 0, r * 2, r * 0.6, r * 2, '#86867e');
        mdlPart(B.cyl, p.x, h * 0.7, p.y, 0, 0, 0, r * 2.04, 4, r * 2.04, '#5e5e58');
      }
    }
  }
  for (const k of ['box', 'sph', 'cyl', 'cone', 'tsph', 'shd']) mdlUpload(B[k]);
}

// ---------- anomalies: solid glowing parts here, sparks and dust in w3AnomPts ----------
function w3Anoms() {
  const V2 = Z3.view * Z3.view, c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw);
  for (const a of World.anomalies) {
    if (a.hidden || !W3_ANOM.has(a.type)) continue; const dx = a.x - P.x, dy = a.y - P.y; if (dx * dx + dy * dy > V2 || dx * c + dy * s < -a.r - 80) continue;
    const r = a.r, t = NOW + (a.seed || 0), col = (ANOMALIES[a.type] || {}).color || '#ffffff';
    switch (a.type) {
      case 'electro': case 'tesla': { const k = 1 + Math.sin(t * 17) * 0.15; mdlPart(MDL.gsph, a.x, 22, a.y, 0, 0, 0, 12 * k, 12 * k, 12 * k, '#e8f6ff'); break; }
      case 'burner': case 'comet': { const k = 1 + Math.sin(t * 23) * 0.2; mdlPart(MDL.gsph, a.x, 8, a.y, 0, 0, 0, 18 * k, 10 * k, 18 * k, '#ffd070'); break; }
      case 'vortex': case 'magnet': case 'flip': { MDL.ghost = true; mdlPart(MDL.tsph, a.x, 30, a.y, t, 0, 0, r * 0.6, r * 0.5, r * 0.6, a.type === 'vortex' ? '#5a4a8a' : col); MDL.ghost = false; mdlPart(MDL.gsph, a.x, 30, a.y, 0, 0, 0, 10, 10, 10, '#1a1028'); break; }
      case 'acid': case 'gas': { MDL.ghost = true; mdlPart(MDL.tsph, a.x, 4, a.y, 0, 0, 0, r * 1.7, 26, r * 1.7, col); MDL.ghost = false; break; }
      case 'spring': case 'geyser': { const k = 1 + Math.sin(t * 3) * 0.06; MDL.ghost = true; mdlPart(MDL.tsph, a.x, 10, a.y, 0, 0, 0, r * 1.5 * k, r * 0.9 * k, r * 1.5 * k, '#e8f0ff'); MDL.ghost = false; break; }
      case 'teleport': case 'timeloop': { for (let i = 0; i < 8; i++) { const q = t * 2 + i * 0.785; mdlPart(MDL.gbox, a.x + Math.cos(q) * r * 0.7, 36 + Math.sin(q) * r * 0.7, a.y, q, 0, 0, 5, 5, 5, col); } break; }
      case 'mirror': { MDL.ghost = true; mdlPart(MDL.tbox, a.x, 34, a.y, t * 0.4, 0, 0, 2, 60, r * 1.2, '#e8e8ff'); MDL.ghost = false; break; }
      case 'cryo': { for (let i = 0; i < 7; i++) { const q = i * 0.9 + (a.seed || 0), d = r * (0.25 + w3hash(i + (a.seed || 0)) * 0.6); mdlPart(MDL.gbox, a.x + Math.cos(q) * d, 10, a.y + Math.sin(q) * d, q, 0.3, 0.2, 7, 24 + i * 3, 7, '#c8ecff'); } break; }
      case 'mincer': { for (let i = 0; i < 6; i++) { const q = t * 7 + i * 1.05; mdlPart(MDL.gbox, a.x + Math.cos(q) * r * 0.4, 20 + i * 5, a.y + Math.sin(q) * r * 0.4, -q, 0, 0, 30, 1.5, 3, '#ff6a5a'); } break; }
      case 'fuzz': { for (let i = 0; i < 9; i++) { const q = i * 2.4 + (a.seed || 0), d = r * w3hash(i * 3 + (a.seed || 0)) * 0.9, sw = Math.sin(t * 1.5 + i) * 0.15; mdlPart(MDL.cyl, a.x + Math.cos(q) * d, 30, a.y + Math.sin(q) * d, 0, sw, 0, 1.6, 60, 1.6, '#6a5a3a'); } break; }
      default: break;
    }
  }
}
function w3AnomPts(A, N) {
  const V2 = Z3.view * Z3.view, c = Math.cos(Z3.yaw), s = Math.sin(Z3.yaw), q = gfxLevel() >= 3 ? 0.5 : 1;
  for (const a of World.anomalies) {
    if (a.hidden || !W3_ANOM.has(a.type)) continue; const dx = a.x - P.x, dy = a.y - P.y; if (dx * dx + dy * dy > V2 || dx * c + dy * s < -a.r - 80) continue;
    const r = a.r, t = NOW + (a.seed || 0), cc = z3hex((ANOMALIES[a.type] || {}).color || '#ffffff');
    switch (a.type) {
      case 'electro': case 'tesla': { // crackling arcs from the core, a new shape 12 times a second
        const f = Math.floor(t * 12);
        for (let i = 0; i < 4 * q; i++) {
          const ang = w3hash(f * 7 + i) * TAU, d = r * (0.4 + w3hash(f * 13 + i) * 0.6), hz = 4 + w3hash(f * 3 + i) * 50, ex = a.x + Math.cos(ang) * d, ey = a.y + Math.sin(ang) * d;
          for (let k = 0; k <= 8; k++) { const u = k / 8, j = (k > 0 && k < 8) ? 8 : 0; A.push(lerp(a.x, ex, u) + (w3hash(f + i * 9 + k) - 0.5) * j, lerp(22, hz, u) + (w3hash(f * 2 + i + k) - 0.5) * j, lerp(a.y, ey, u) + (w3hash(f * 5 + i + k * 3) - 0.5) * j, 5, cc[0], cc[1], cc[2], 0.9); }
        }
        break;
      }
      case 'burner': case 'comet': for (let i = 0; i < 16 * q; i++) { const u = (t * 1.8 + i / 16) % 1, ang = i * 2.39; A.push(a.x + Math.cos(ang) * 10 * (1 - u), 8 + u * 90, a.y + Math.sin(ang) * 10 * (1 - u), 20 * (1 - u) + 6, 1, 0.4 + u * 0.45, 0.1, 0.6 * (1 - u)); } break;
      case 'vortex': case 'magnet': case 'flip': for (let i = 0; i < 26 * q; i++) { const u = (t * 0.35 + i / 26) % 1, ang = t * 2.5 + i * 1.3 + u * 6, d = r * (1 - u) * 0.95, h = a.type === 'flip' ? 4 + u * 120 : 4 + Math.sin(u * Math.PI) * 30; N.push(a.x + Math.cos(ang) * d, h, a.y + Math.sin(ang) * d, 7, a.type === 'vortex' ? 0.55 : cc[0], a.type === 'vortex' ? 0.5 : cc[1], a.type === 'vortex' ? 0.45 : cc[2], 0.8); } break;
      case 'acid': case 'gas': for (let i = 0; i < 14 * q; i++) { const u = (t * 0.5 + i / 14) % 1, ang = i * 2.1 + (a.seed || 0), d = r * w3hash(i + (a.seed || 0)) * 0.9; A.push(a.x + Math.cos(ang) * d, 3 + u * 34, a.y + Math.sin(ang) * d, 10 + 8 * w3hash(i), cc[0], cc[1], cc[2], 0.55 * (1 - u)); } break;
      case 'geyser': { const ph = (t * 0.25) % 1; if (ph < 0.25) for (let i = 0; i < 24 * q; i++) { const u = (t * 3 + i / 24) % 1; A.push(a.x + Math.sin(i * 7) * 8 * u, u * 160, a.y + Math.cos(i * 5) * 8 * u, 18, 0.85, 0.92, 1, 0.7 * (1 - u)); } break; }
      case 'cryo': for (let i = 0; i < 12 * q; i++) { const u = (t * 0.3 + i / 12) % 1, ang = i * 1.9; N.push(a.x + Math.cos(ang) * r * 0.8 * u, 4 + u * 20, a.y + Math.sin(ang) * r * 0.8 * u, 22, 0.85, 0.94, 1, 0.35 * (1 - u)); } break;
      case 'psifield': case 'sound': for (let i = 0; i < 3; i++) { const u = (t * 0.6 + i / 3) % 1, R = r * u; for (let k = 0; k < 18 * q; k++) { const ang = k / 18 * TAU; A.push(a.x + Math.cos(ang) * R, 10 + Math.sin(ang * 3 + t) * 4, a.y + Math.sin(ang) * R, 7, cc[0], cc[1], cc[2], 0.7 * (1 - u)); } } break;
      case 'mincer': for (let i = 0; i < 12 * q; i++) { const ang = t * 7 + i * 0.52, d = r * 0.4; A.push(a.x + Math.cos(ang) * d, 22 + (i % 6) * 5, a.y + Math.sin(ang) * d, 6, 1, 0.3, 0.25, 0.7); } break;
      default: break;
    }
  }
}
