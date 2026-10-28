// Coins: embedded in the ice (deterministic per chunk), freed by edits, then loose with simple
// physics until collected. Rendered with one instanced mesh per tier for each state.
import * as THREE from 'three';
import { CHUNK_M, ISO, richness, surfaceY, sampleHeightmap } from './field.js';
import { keyOf } from './volume.js';
import { rng, hash32 } from '../core/rng.js';
import { COINS, tierWeights, CHEST, chestChance, sizeOf, sizeValue } from '../econ/data/coins.js';
import { LAYERS } from '../render/graphics.js';

// Frozen coins are drawn after the ice, tested against its depth: a coin up to SEE_DEPTH behind
// an ice face shows through it, tinted and fading with depth; deeper coins stay hidden.
const SEE_DEPTH = 1.3;
function frozenCoinMaterial(tier, gfx) {
  const c = COINS[tier];
  return new THREE.ShaderMaterial({
    uniforms: {
      tDepth: { value: gfx.rtMain.depthTexture }, uResolution: { value: gfx.size },
      uNearFar: { value: new THREE.Vector2(gfx.camera.near, gfx.camera.far) },
      uColor: { value: new THREE.Color(...c.color) }, uLight: { value: 1 }, uTime: { value: 0 }, uSee: { value: SEE_DEPTH },
    },
    vertexShader: `varying vec3 vN; varying float vDepth; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4( position, 1.0 );
        vW = w.xyz;
        vN = normalize( mat3( modelMatrix * instanceMatrix ) * normal );
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D tDepth; uniform vec2 uResolution; uniform vec2 uNearFar; uniform vec3 uColor; uniform float uLight; uniform float uTime; uniform float uSee;
      varying vec3 vN; varying float vDepth; varying vec3 vW;
      float linDepth( float d ) { float n = uNearFar.x, f = uNearFar.y; float z = d * 2.0 - 1.0; return 2.0 * n * f / ( f + n - z * ( f - n ) ); }
      void main() {
        float scene = linDepth( texture2D( tDepth, gl_FragCoord.xy / uResolution ).x );
        float behind = vDepth - scene;            // how far behind the nearest surface this coin is
        if ( behind > uSee ) discard;
        float vis = 1.0 - smoothstep( 0.05, uSee, behind );
        vec3 n = normalize( vN );
        float lit = 0.55 + 0.45 * abs( n.y ) + 0.35 * pow( abs( n.z ), 4.0 );
        float sparkle = pow( max( 0.0, sin( dot( vW, vec3( 7.0, 11.0, 5.0 ) ) + uTime * 2.5 ) ), 24.0 );
        vec3 col = uColor * lit * uLight * 1.25 + sparkle * 0.8;
        // seen through ice: shifted toward the ice colour with depth
        col = mix( col, col * vec3( 0.55, 0.8, 0.95 ) + vec3( 0.02, 0.05, 0.07 ), smoothstep( 0.0, uSee, behind ) * 0.7 );
        gl_FragColor = vec4( col, behind > 0.02 ? vis * 0.92 : 1.0 );
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
}

const VIS_R = 11;              // embedded coins drawn within this distance
const NEAR_R2 = 4 * 4;         // loose coins this close get the detailed, shadow-casting model
// Coins in the field are giant: about 0.8 m across (a relic 1.5 m), drawn GIANT times the minted size
// (the vault pile keeps minted coins). There are COUNT_PER_M3 of them, six times fewer than before and
// each worth six times more, and one only comes free once you have dug most of the way around it.
export const GIANT = 2.6;
const COUNT_PER_M3 = 0.32;
const _sv = new THREE.Vector3();
const MAX_R = Math.max(...COINS.map((c) => c.radius)) * GIANT * 1.5;   // the biggest coin of the biggest kind
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _n = new THREE.Vector3();

// ---------- coin art ----------
// Every type has a shape (disc, square, hex, ring, star, gem, emerald, vase, orb, pebble, bar, shard, chest)
// and a material kind (engraved metal, gem, stone, glowing, chest). Geometry faces along z, like a coin.

// Gems are cut crystals, not discs.
function gemGeometry(r, detail = 0) {
  const g = new THREE.OctahedronGeometry(r, detail).scale(0.8, 1.15, 0.8);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// Relics are tiny turned vases, not coins.
function relicGeometry(r, segs = 18) {
  const pts = [[0, -0.5], [0.42, -0.5], [0.55, -0.32], [0.62, -0.05], [0.5, 0.2], [0.26, 0.34], [0.22, 0.46], [0.32, 0.5], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x * r, y * r * 1.9));
  return new THREE.LatheGeometry(pts, segs);
}

function planarUv(g, r) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / (r * 2) + 0.5; uv[i * 2 + 1] = p.getY(i) / (r * 2) + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// a flat 2D outline pushed out to the coin's thickness, with a small bevel
function extruded(shape, t, r) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t * 0.6, bevelEnabled: true, bevelThickness: t * 0.2, bevelSize: Math.min(t * 0.3, r * 0.06), bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -t * 0.3);
  g.computeVertexNormals();
  return planarUv(g, r);
}
function polygon(n, r, rot = 0) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const a = rot + (i / n) * Math.PI * 2; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  return sh;
}
function starShape(r) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
  return sh;
}
function withHole(sh, hr, n = 16) { const hole = new THREE.Path(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; hole[i ? 'lineTo' : 'moveTo'](Math.cos(a) * hr, Math.sin(a) * hr); } sh.holes.push(hole); return sh; }

// several simple meshes as one (non-indexed) geometry
function merge(parts) {
  const list = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = list.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// a small treasure chest: a box, a rounded lid and two metal bands
function chestGeometry(r) {
  const w = r * 2, d = r * 1.3, hh = r * 1.0;
  const body = new THREE.BoxGeometry(w, hh, d).translate(0, -hh * 0.2, 0);
  const lid = new THREE.CylinderGeometry(d / 2, d / 2, w, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, hh * 0.3, 0);
  const bands = [-0.55, 0.55].map((f) => new THREE.BoxGeometry(r * 0.16, hh * 1.15, d * 1.04).translate(f * r, -hh * 0.12, 0));
  const lock = new THREE.BoxGeometry(r * 0.3, r * 0.34, r * 0.12).translate(0, 0, d / 2 + r * 0.04);
  return merge([body, lid, ...bands, lock]);
}

function discGeometry(c, segs) {
  const r = c.radius, t = c.thick;
  // lathe profile: raised rim, recessed field, raised centre boss
  const pts = [];
  const hole = c.shape === 'ring' ? r * 0.45 : c.hole ? r * 0.22 : 0;
  pts.push(new THREE.Vector2(hole, t * 0.35));
  if (c.shape !== 'ring') { pts.push(new THREE.Vector2(r * 0.42, t * 0.38)); pts.push(new THREE.Vector2(r * 0.48, t * 0.3)); }
  pts.push(new THREE.Vector2(r * 0.8, t * 0.28));
  pts.push(new THREE.Vector2(r * 0.86, t * 0.5));
  pts.push(new THREE.Vector2(r * 0.97, t * 0.5));
  pts.push(new THREE.Vector2(r, t * 0.3));
  pts.push(new THREE.Vector2(r, -t * 0.3));
  pts.push(new THREE.Vector2(r * 0.97, -t * 0.5));
  pts.push(new THREE.Vector2(r * 0.86, -t * 0.5));
  pts.push(new THREE.Vector2(r * 0.8, -t * 0.28));
  if (c.shape !== 'ring') { pts.push(new THREE.Vector2(r * 0.48, -t * 0.3)); pts.push(new THREE.Vector2(r * 0.42, -t * 0.38)); }
  pts.push(new THREE.Vector2(hole, -t * 0.35));
  if (hole) pts.push(new THREE.Vector2(hole, t * 0.35));
  const g = new THREE.LatheGeometry(pts, segs ?? (c.edge === 'milled' ? 32 : 22));
  g.rotateX(Math.PI / 2); // face along z
  const pos = g.attributes.position;
  if (c.edge === 'milled') {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      if (Math.hypot(x, y) > r * 0.985) { const k = 1 + 0.035 * Math.sign(Math.sin(Math.atan2(y, x) * 40)); pos.setXY(i, x * k, y * k); }
    }
  }
  if (c.edge === 'points') {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      if (Math.hypot(x, y) > r * 0.84) { const k = 1 + 0.06 * Math.cos(Math.atan2(y, x) * 7); pos.setXY(i, x * k, y * k); }
    }
  }
  g.computeVertexNormals();
  return planarUv(g, r);
}

function coinGeometry(tier, segs, low = false) {
  const c = COINS[tier], r = c.radius, t = c.thick;
  switch (c.shape) {
    case 'gem': { const g = gemGeometry(r * 0.9, 0); g.computeVertexNormals(); return g; }
    case 'emerald': { const g = new THREE.CylinderGeometry(r * 0.75, r, r * 1.3, 8).rotateX(Math.PI / 2).toNonIndexed(); g.computeVertexNormals(); return g; }
    case 'vase': return relicGeometry(r * 0.7, low ? 8 : 18);
    case 'orb': return new THREE.SphereGeometry(r, low ? 8 : 18, low ? 6 : 12);
    case 'pebble': return new THREE.SphereGeometry(r, low ? 8 : 16, low ? 6 : 10).scale(1, 0.8, 0.45);
    case 'shard': { const g = new THREE.OctahedronGeometry(r, 0).scale(0.55, 1.7, 0.55).toNonIndexed(); g.computeVertexNormals(); return g; }
    case 'chest': return chestGeometry(r);
    case 'square': return extruded(withHole(polygon(4, r * 1.2, Math.PI / 4), r * 0.22), t, r);
    case 'hex': return extruded(polygon(6, r, Math.PI / 6), t, r);
    case 'star': return extruded(starShape(r), t, r);
    case 'bar': { const sh = new THREE.Shape(); sh.moveTo(-r, -r * 0.4); sh.lineTo(r, -r * 0.4); sh.lineTo(r * 0.8, r * 0.4); sh.lineTo(-r * 0.8, r * 0.4); sh.lineTo(-r, -r * 0.4); return extruded(sh, t * 1.6, r); }
    default: {
      if (low) {
        const g = new THREE.CylinderGeometry(r, r, t, 10, 1).rotateX(Math.PI / 2);
        return planarUv(g, r);
      }
      return discGeometry(c, segs);
    }
  }
}

// Engraving: a height field drawn on canvas, converted to a normal map, plus a wear roughness map.
const ENGRAVINGS = {};
function engravingMaps(tier) {
  const kind = COINS[tier].engrave || 'sun';
  if (ENGRAVINGS[kind]) return ENGRAVINGS[kind];
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  x.lineCap = 'round';
  if (kind === 'frost') {
    // copper: a six-armed frost crystal around the hole
    x.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      x.save(); x.rotate((i / 6) * Math.PI * 2);
      x.beginPath(); x.moveTo(0, 34); x.lineTo(0, 92); x.stroke();
      x.beginPath(); x.moveTo(0, 62); x.lineTo(16, 78); x.moveTo(0, 62); x.lineTo(-16, 78); x.stroke();
      x.restore();
    }
  } else if (kind === 'rings') {
    // silver: concentric survey rings and a meridian cross
    x.lineWidth = 5;
    for (const rr of [36, 58, 80]) { x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); x.stroke(); }
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(-86, 0); x.lineTo(86, 0); x.moveTo(0, -86); x.lineTo(0, 86); x.stroke();
    x.beginPath(); x.arc(0, 0, 14, 0, Math.PI * 2); x.fill();
  } else if (kind === 'wave') {
    // bronze: three rolling waves under a crescent
    x.lineWidth = 7;
    for (const yy of [10, 34, 58]) { x.beginPath(); for (let i = -90; i <= 90; i += 6) x[i === -90 ? 'moveTo' : 'lineTo'](i, yy + Math.sin(i / 14) * 8); x.stroke(); }
    x.beginPath(); x.arc(0, -40, 30, Math.PI * 0.15, Math.PI * 0.85, true); x.stroke();
  } else if (kind === 'spiral') {
    // electrum and storm tokens: a spiral, like wind
    x.lineWidth = 7;
    x.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.1) { const rr = 8 + a * 4.2; x[a === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    x.stroke();
  } else {
    // gold: a radiant sun over a polar horizon line
    x.lineWidth = 6;
    x.beginPath(); x.arc(0, -8, 30, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 14; i++) {
      x.save(); x.rotate((i / 14) * Math.PI * 2);
      x.beginPath(); x.moveTo(0, -42); x.lineTo(0, -64 - (i % 2) * 14); x.stroke();
      x.restore();
    }
    x.lineWidth = 8;
    x.beginPath(); x.moveTo(-84, 50); x.lineTo(84, 50); x.stroke();
    x.lineWidth = 4;
    x.beginPath(); x.moveTo(-60, 66); x.lineTo(60, 66); x.stroke();
  }
  const src = x.getImageData(0, 0, S, S).data;
  // blur a little for soft relief
  const h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = src[i * 4] / 255;
  const hb = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let s = 0, n = 0;
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const ii = Math.min(S - 1, Math.max(0, i + a)), jj = Math.min(S - 1, Math.max(0, j + b));
      s += h[jj * S + ii]; n++;
    }
    hb[j * S + i] = s / n;
  }
  const r = rng(77 + kind.length * 7 + kind.charCodeAt(0));
  const nrm = new Uint8Array(S * S * 4);
  const rough = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const g = (ii, jj) => hb[Math.min(S - 1, Math.max(0, jj)) * S + Math.min(S - 1, Math.max(0, ii))];
    const dx = (g(i + 1, j) - g(i - 1, j)) * 3.2;
    const dy = (g(i, j + 1) - g(i, j - 1)) * 3.2;
    const l = Math.hypot(dx, dy, 1);
    const o = (j * S + i) * 4;
    nrm[o] = ((-dx / l) * 0.5 + 0.5) * 255;
    nrm[o + 1] = ((dy / l) * 0.5 + 0.5) * 255;
    nrm[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
    nrm[o + 3] = 255;
    // raised relief is polished by handling; recesses keep grime
    const grime = (1 - hb[j * S + i]) * 0.35 + r() * 0.12;
    const v = Math.min(255, Math.max(0, (0.35 + grime) * 255));
    rough[o] = rough[o + 1] = rough[o + 2] = v;
    rough[o + 3] = 255;
  }
  const nt = new THREE.DataTexture(nrm, S, S);
  nt.needsUpdate = true;
  nt.generateMipmaps = true;
  nt.minFilter = THREE.LinearMipmapLinearFilter;
  nt.magFilter = THREE.LinearFilter;
  const rt = new THREE.DataTexture(rough, S, S);
  rt.needsUpdate = true;
  rt.generateMipmaps = true;
  rt.minFilter = THREE.LinearMipmapLinearFilter;
  return (ENGRAVINGS[kind] = { normal: nt, rough: rt });
}

export function coinMaterial(atmo, tier) {
  const c = COINS[tier];
  const col = new THREE.Color(...c.color);
  const glow = c.glow || 0;
  let mat;
  if (c.kind === 'gem') mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.1, roughness: 0.04, envMapIntensity: 2.2, emissive: col.clone().multiplyScalar(0.22), flatShading: true });
  else if (c.kind === 'stone') mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.15, roughness: c.rough + 0.1, emissive: col.clone().multiplyScalar(0.08 + glow * 0.5) });
  else if (c.kind === 'glow') mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.2, roughness: c.rough, emissive: col.clone().multiplyScalar(0.4 + glow), flatShading: c.shape === 'shard' });
  else if (c.kind === 'chest') mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.35, roughness: 0.55, emissive: new THREE.Color(0.12, 0.08, 0.02) });
  else {
    const maps = engravingMaps(tier);
    mat = new THREE.MeshStandardMaterial({
      color: col, metalness: 1, roughness: c.rough * 2.2, emissive: col.clone().multiplyScalar(glow * 0.5),
      normalMap: maps.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: maps.rough, envMapIntensity: 1.25,
    });
  }
  atmo.register(mat, `coin_${c.id}`);
  return mat;
}

// ---------- system ----------

const chunkDist = (c, p) => ((c.cx + 0.5) * CHUNK_M - p.x) ** 2 + ((c.cy + 0.5) * CHUNK_M - p.y) ** 2 + ((c.cz + 0.5) * CHUNK_M - p.z) ** 2;

export class CoinSystem {
  constructor(scene, volume, atmo, tiersUnlocked) {
    this.scene = scene;
    this.volume = volume;
    this.tiers = tiersUnlocked;
    this.geos = COINS.map((_, i) => coinGeometry(i));
    // seen blurred through the ice (or far away): simpler versions
    this.lowGeos = COINS.map((_, i) => coinGeometry(i, 10, true));
    this.mats = COINS.map((_, i) => coinMaterial(atmo, i));
    this.embedded = new Map();       // chunk key -> [{tier, x, y, z, q, id}]
    this.loose = [];                 // {tier, p, v, q, w, sleep, value, id, t}
    // frozen coins glow faintly in their own colour so they read through the ice
    this.embMats = this.mats.map((m, i) => { const e = m.clone(); e.emissive = new THREE.Color(...COINS[i].color).multiplyScalar(0.35); atmo.register(e, `coinEmb${i}`); return e; });
    this.embMesh = this.lowGeos.map((g, i) => this.mkInst(g, this.embMats[i], 7000, false));
    this.frozenMats = null;
    // loose coins: full detail with shadows close to the eye, the plain disc further away
    this.looseMesh = this.geos.map((g, i) => this.mkInst(g, this.mats[i], 400));
    this.looseFar = this.lowGeos.map((g, i) => this.mkInst(g, this.mats[i], 2500, false));
    this.lastBuild = new THREE.Vector3(1e9, 0, 0);
    this.dirty = true;
    this.planetCtx = null;
    this.onCollect = null;
    this.collectedIds = new Set();   // ids collected this session (coins in still-loaded chunks)
    // seeding a chunk's coins is costly (noise per candidate), so loads are queued and seeded a few per
    // frame, nearest first; chunks touched by an edit are seeded at once (see flushBox / syncSpawn)
    this.pending = new Map();
    volume.on('load', (c) => { if (this.syncSpawn) this.spawnChunk(c); else this.pending.set(c.key, c); });
    volume.on('drop', (c) => { this.pending.delete(c.key); this.embedded.delete(c.key); this.dirty = true; });
    volume.on('edit', (op, res) => this.onEdit(op, res));
  }

  mkInst(g, m, n, shadows = true) {
    const im = new THREE.InstancedMesh(g, m, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0;
    im.frustumCulled = false;
    im.castShadow = shadows;
    im.receiveShadow = true;
    this.scene.add(im);
    return im;
  }

  setContext(ctx) { this.planetCtx = ctx; }

  // Switch frozen coins to the see-through-ice pass (needs the main depth buffer).
  useIcePass(gfx) {
    this.frozenMats = this.embMesh.map((m, i) => {
      const mat = frozenCoinMaterial(i, gfx);
      m.material = mat;
      m.layers.set(LAYERS.FX);
      m.renderOrder = 0;
      return mat;
    });
  }

  // see: how deep into the ice frozen coins show (X-ray extends it)
  setLight(light, time, see = SEE_DEPTH) { if (this.frozenMats) for (const m of this.frozenMats) { m.uniforms.uLight.value = light; m.uniforms.uTime.value = time; m.uniforms.uSee.value = see; } }

  // Deterministic coins for a freshly generated chunk; coins already in carved space are skipped.
  spawnChunk(c) {
    const ctx = this.planetCtx;
    if (!ctx) return;
    const r = rng(hash32(ctx.seed, c.cx, c.cy, c.cz, 91));
    const ox = c.cx * CHUNK_M, oy = c.cy * CHUNK_M, oz = c.cz * CHUNK_M;
    const tries = Math.round(CHUNK_M ** 3 * COUNT_PER_M3 * 1.6);
    const list = [];
    for (let i = 0; i < tries; i++) {
      const x = ox + r() * CHUNK_M, y = oy + r() * CHUNK_M, z = oz + r() * CHUNK_M;
      const a = r(), b = r(), cc = r(), tierRoll = r(), sizeRoll = r(), chestRoll = r();
      const top = surfaceY(x, z);
      if (y > top - 0.42 - 0.5) continue; // fully under the snow (the smoothed mesh sits a little below the analytic surface)
      const rich = richness(x, y, z);
      if (a > (0.06 + Math.pow(rich, 1.6) * 1.45) / 1.6) continue;
      const depth = top - y;
      const id = hash32(ctx.seed, c.cx, c.cy, c.cz, i);
      if (this.collectedIds.has(id)) continue;
      if (c.data && this.volume.sample(x, y, z) < ISO + 20) continue; // already dug out
      const w = tierWeights(depth, this.tiers);
      let tier = 0, acc = 0;
      for (let t = 0; t < w.length; t++) { acc += w[t]; if (tierRoll <= acc) { tier = t; break; } }
      if (chestRoll < chestChance(depth)) tier = CHEST;   // now and then a treasure chest instead
      _q.setFromEuler(new THREE.Euler(b * 6.28, cc * 6.28, a * 6.28));
      list.push({ tier, x, y, z, q: _q.clone(), id, depth, s: tier === CHEST ? 1 : sizeOf(sizeRoll) });
    }
    // the first metre under the starting spot holds a small frozen hoard, so the first swing pays
    if (c.cy === -1 && c.cx === 0 && c.cz === 0) {
      for (let i = 0; i < 5; i++) {
        const x = 1.0 + r() * 2.8, z = 1.3 + r() * 2.8, y = surfaceY(x, z) - 0.95 - r() * 0.5;
        const id = hash32(ctx.seed, 7, i);
        if (this.collectedIds.has(id) || this.volume.sample(x, y, z) < ISO + 20) continue;
        _q.setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
        list.push({ tier: 0, x, y, z, q: _q.clone(), id, depth: 0.5, hoard: true, s: 1.2 });
      }
    }
    list.cx = ox + CHUNK_M / 2; list.cy = oy + CHUNK_M / 2; list.cz = oz + CHUNK_M / 2;
    this.embedded.set(c.key, list);
    this.dirty = true;
  }

  // seed queued chunks inside a box now (before an edit changes their ice)
  flushBox(x0, y0, z0, x1, y1, z1) {
    if (!this.pending.size) return;
    for (let cx = Math.floor(x0 / CHUNK_M); cx <= Math.floor(x1 / CHUNK_M); cx++)
      for (let cy = Math.floor(y0 / CHUNK_M); cy <= Math.floor(y1 / CHUNK_M); cy++)
        for (let cz = Math.floor(z0 / CHUNK_M); cz <= Math.floor(z1 / CHUNK_M); cz++) {
          const k = keyOf(cx, cy, cz), c = this.pending.get(k);
          if (c) { this.pending.delete(k); this.spawnChunk(c); }
        }
  }

  seedPending(camPos, budgetMs = 1.5) {
    if (!this.pending.size) return;
    const t0 = performance.now();
    // only chunks near enough to show their coins (VIS_R) need seeding now; the rest wait until you come
    // close or an edit reaches them
    const near = (VIS_R + CHUNK_M * 1.2) ** 2;
    const list = [...this.pending.values()].filter((c) => chunkDist(c, camPos) < near).sort((a, b) => chunkDist(a, camPos) - chunkDist(b, camPos));
    for (const c of list) {
      this.pending.delete(c.key);
      this.spawnChunk(c);
      if (performance.now() - t0 > budgetMs) break;
    }
  }

  // Free embedded coins whose ice is gone.
  onEdit(op, res) {
    const b = res.bounds;
    const freed = [];
    // only the chunks the edit's bounds overlap
    const lists = [];
    // a giant coin reaches past the edit: look a coin's radius beyond it
    const R = MAX_R;
    for (let cx = Math.floor((b.x0 - R) / CHUNK_M); cx <= Math.floor((b.x1 + R) / CHUNK_M); cx++)
      for (let cy = Math.floor((b.y0 - R) / CHUNK_M); cy <= Math.floor((b.y1 + R) / CHUNK_M); cy++)
        for (let cz = Math.floor((b.z0 - R) / CHUNK_M); cz <= Math.floor((b.z1 + R) / CHUNK_M); cz++) {
          const l = this.embedded.get(keyOf(cx, cy, cz));
          if (l) lists.push(l);
        }
    for (const list of lists) {
      for (let i = list.length - 1; i >= 0; i--) {
        const k = list[i];
        if (k.x < b.x0 - R || k.x > b.x1 + R || k.y < b.y0 - R || k.y > b.y1 + R || k.z < b.z0 - R || k.z > b.z1 + R) continue;
        if (this.exposed(k)) {
          list.splice(i, 1);
          freed.push(k);
        }
      }
    }
    if (!freed.length) return;
    this.dirty = true;
    for (const k of freed) this.release(k, op);
    if (this.onFreed) this.onFreed(freed, op);
  }

  // fully dug out: the centre and at least 9 of 10 points around the rim and on both faces are in open air
  exposed(k) {
    const v = this.volume;
    if (v.sample(k.x, k.y, k.z) >= ISO - 6) return false;
    const c = COINS[k.tier], sc = k.s || 1, r = c.radius * GIANT * sc * 0.9, t = Math.max(0.04, c.thick * GIANT * sc * 0.6);
    let air = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      _p.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyQuaternion(k.q);
      if (v.sample(k.x + _p.x, k.y + _p.y, k.z + _p.z) < ISO) air++;
    }
    for (const f of [-1, 1]) {
      _p.set(0, 0, f * t).applyQuaternion(k.q);
      if (v.sample(k.x + _p.x, k.y + _p.y, k.z + _p.z) < ISO) air++;
    }
    return air >= 9;
  }

  release(k, op) {
    const ctx = this.planetCtx;
    const dir = new THREE.Vector3(k.x - op.x, k.y - op.y + 0.3, k.z - op.z).normalize();
    const pop = op.kind === 'dig' ? 2.2 : 0.6;
    this.loose.push({
      tier: k.tier, id: k.id, p: new THREE.Vector3(k.x, k.y, k.z), v: dir.multiplyScalar(pop * (0.5 + Math.random())),
      q: k.q.clone(), w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18),
      sleep: 0, t: 0, value: (ctx ? ctx.coinValue(k.tier, k.depth) : COINS[k.tier].value) * (k.tier === CHEST ? 1 : sizeValue(k.s || 1)), depth: k.depth, magnet: false, s: k.s || 1,
    });
    this.collectedIds.add(k.id);
    if (this.loose.length > 2400) this.loose.shift();
  }

  // Physics, magnet and collection. `collectors`: [{ pos: Vector3 (chest), range, canTake(coin) }]
  // Aurora sky coins: they drift down and hover above the snow until caught.
  // life: seconds before an uncaught sky coin fades (onSkyMiss is called then).
  spawnSky(p, tier, value, floorY, life = 1e9) {
    this.skyId = (this.skyId || 0) - 1;
    this.loose.push({ tier, id: this.skyId, p: p.clone(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(0, 2.5, 0),
      sleep: 0, t: 0, value, depth: 0, magnet: false, sky: true, floorY, life });
  }

  update(dt, camPos, collectors, autoCollect = 0) {
    this.seedPending(camPos);
    const vol = this.volume;
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const c = this.loose[i];
      c.t += dt;
      // magnet toward the nearest collector in range
      let target = null, best = Infinity;
      for (const col of collectors) {
        const d = col.pos.distanceTo(c.p);
        if (c.t > 0.8 && (d < col.range || c.magnet) && d < best && col.canTake(c)) { best = d; target = col; }
      }
      if (!target && autoCollect > 0 && c.t > 0.6 && !c.magnet && Math.random() < autoCollect * dt) c.magnet = true;
      if (c.magnet && !target && collectors.length) target = collectors[0];
      if (target && c.t > 0.25) {
        _p.copy(target.pos).sub(c.p);
        const d = _p.length();
        if (d < 0.9) {   // giant coins: taken a little further out
          this.loose.splice(i, 1);
          target.take(c);
          continue;
        }
        c.v.lerp(_p.multiplyScalar(Math.min(14, 4 + 10 / Math.max(0.3, d)) / d), Math.min(1, dt * 7));
        c.p.addScaledVector(c.v, dt);
        c.sleep = 0;
        _q.setFromEuler(new THREE.Euler(c.w.x * dt, c.w.y * dt, c.w.z * dt));
        c.q.multiply(_q);
        continue;
      }
      // Tidalis: the current keeps sliding loose coins along the ice, so they drift downstream
      if (this.current) {
        const cur = this.current(c.p.x, c.p.z);
        c.v.x += (cur[0] - c.v.x) * Math.min(1, dt * 1.5);
        c.v.z += (cur[1] - c.v.z) * Math.min(1, dt * 1.5);
        // contact friction would cancel most of that push: the current also carries the coin along directly
        if (vol.sdf(c.p.x + cur[0] * dt * 0.7, c.p.y + 0.05, c.p.z + cur[1] * dt * 0.7) < -0.04) { c.p.x += cur[0] * dt * 0.7; c.p.z += cur[1] * dt * 0.7; }
        c.sleep = Math.min(c.sleep, 0.5);
      }
      if (c.sky) {
        if (c.t > c.life) { this.loose.splice(i, 1); if (this.onSkyMiss) this.onSkyMiss(c); continue; }
        c.p.y = Math.max(c.floorY + 1.3 + Math.sin(c.t * 2 + c.id) * 0.15, c.p.y - 1.6 * dt);
        _q.setFromEuler(new THREE.Euler(0, 2.5 * dt, 0));
        c.q.multiply(_q);
        continue;
      }
      if (c.sleep > 1) continue;
      c.v.y -= 16 * dt;
      c.p.addScaledVector(c.v, dt);
      const rad = Math.max(0.07, COINS[c.tier].thick * GIANT * (c.s || 1) * 0.5);   // a giant coin rests on its face; gems and relics are thicker
      const s = vol.sdf(c.p.x, c.p.y, c.p.z);
      if (s > -rad) {
        vol.normalAt(c.p.x, c.p.y, c.p.z, _n);
        c.p.addScaledVector(_n, s + rad);
        const vn = c.v.dot(_n);
        if (vn < 0) c.v.addScaledVector(_n, -vn * 1.35);
        c.v.multiplyScalar(0.72);
        c.w.multiplyScalar(0.7);
        if (c.v.lengthSq() < 0.04) {
          c.sleep += dt * 4;
          // settle flat against the surface
          _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _n);
          c.q.slerp(_q, Math.min(1, dt * 8));
        }
        if (c.v.lengthSq() < 0.0004) c.sleep = 2;
      } else {
        _q.setFromEuler(new THREE.Euler(c.w.x * dt, c.w.y * dt, c.w.z * dt));
        c.q.multiply(_q);
      }
      if (c.p.y < -2000) this.loose.splice(i, 1);
    }
    this.drawLoose(camPos);
    if (this.dirty || this.lastBuild.distanceToSquared(camPos) > 0.6) this.drawEmbedded(camPos);
  }

  drawLoose(camPos) {
    const n = this.looseMesh.map(() => 0), f = this.looseFar.map(() => 0);
    for (const c of this.loose) {
      const near = c.p.distanceToSquared(camPos) < NEAR_R2 && n[c.tier] < 60;
      const m = near ? this.looseMesh[c.tier] : this.looseFar[c.tier];
      const cnt = near ? n : f;
      if (cnt[c.tier] >= m.instanceMatrix.count) continue;
      _m.compose(c.p, c.q, _sv.setScalar(GIANT * (c.s || 1)));
      m.setMatrixAt(cnt[c.tier]++, _m);
    }
    this.looseMesh.forEach((m, i) => { m.count = n[i]; m.visible = n[i] > 0; if (n[i]) m.instanceMatrix.needsUpdate = true; });
    this.looseFar.forEach((m, i) => { m.count = f[i]; m.visible = f[i] > 0; if (f[i]) m.instanceMatrix.needsUpdate = true; });
  }

  drawEmbedded(camPos) {
    this.lastBuild.copy(camPos);
    this.dirty = false;
    const n = this.embMesh.map(() => 0);
    const R2 = VIS_R * VIS_R;
    const RC = (VIS_R + CHUNK_M) ** 2;
    for (const list of this.embedded.values()) {
      if (list.cx !== undefined && (list.cx - camPos.x) ** 2 + (list.cy - camPos.y) ** 2 + (list.cz - camPos.z) ** 2 > RC) continue;
      for (const k of list) {
        const dx = k.x - camPos.x, dy = k.y - camPos.y, dz = k.z - camPos.z;
        if (dx * dx + dy * dy + dz * dz > R2) continue;
        // just under untouched snow: keep hidden (snow is opaque); dug ground shows them
        if (k.depth < 1.2 && !this.volume.edited.has(keyOf(Math.floor(k.x / CHUNK_M), Math.floor(k.y / CHUNK_M), Math.floor(k.z / CHUNK_M)))) continue;
        const m = this.embMesh[k.tier];
        if (n[k.tier] >= 7000) continue;
        _p.set(k.x, k.y, k.z);
        _m.compose(_p, k.q, _sv.setScalar(GIANT * (k.s || 1)));
        m.setMatrixAt(n[k.tier]++, _m);
      }
    }
    this.embMesh.forEach((m, i) => { m.count = n[i]; m.visible = n[i] > 0; if (n[i]) m.instanceMatrix.needsUpdate = true; });   // unused kinds cost no draw call
  }

  // nearest embedded coin to a point (for hints/needle sense)
  nearestEmbedded(p, maxD = 8) {
    let best = null, bd = maxD * maxD;
    for (const list of this.embedded.values()) for (const k of list) {
      const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2 + (k.z - p.z) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  clear() {
    this.pending.clear();
    this.embedded.clear();
    this.loose.length = 0;
    this.collectedIds.clear();
    this.dirty = true;
  }

  // Bank-time totals for whatever is still loose (used when leaving a planet or saving).
  looseValue() { return this.loose.reduce((a, c) => a + c.value, 0); }
}
