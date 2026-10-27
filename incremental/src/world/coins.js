// Coins: embedded in the ice (deterministic per chunk), freed by edits, then loose with simple
// physics until collected. Rendered with one instanced mesh per tier for each state.
import * as THREE from 'three';
import { CHUNK_M, ISO, richness, surfaceY, sampleHeightmap } from './field.js';
import { keyOf } from './volume.js';
import { rng, hash32 } from '../core/rng.js';
import { COINS, tierWeights } from '../econ/data/coins.js';
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
const COUNT_PER_M3 = 2.0;   // dense enough that every few swings free a coin
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _n = new THREE.Vector3();

// ---------- coin art ----------

// Gems are cut crystals, not discs.
function gemGeometry(r, detail = 0) {
  const g = new THREE.OctahedronGeometry(r, detail).scale(0.8, 1.15, 0.8);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function coinGeometry(tier, segs) {
  const c = COINS[tier];
  if (c.id === 'gem') { const g = gemGeometry(c.radius * 0.9, 0); g.computeVertexNormals(); return g; }
  const r = c.radius, t = c.thick;
  // lathe profile: raised rim, recessed field, raised centre boss
  const pts = [];
  const hole = tier === 0 ? r * 0.22 : 0;
  pts.push(new THREE.Vector2(hole, t * 0.35));
  pts.push(new THREE.Vector2(r * 0.42, t * 0.38));
  pts.push(new THREE.Vector2(r * 0.48, t * 0.3));
  pts.push(new THREE.Vector2(r * 0.8, t * 0.28));
  pts.push(new THREE.Vector2(r * 0.86, t * 0.5));
  pts.push(new THREE.Vector2(r * 0.97, t * 0.5));
  pts.push(new THREE.Vector2(r, t * 0.3));
  pts.push(new THREE.Vector2(r, -t * 0.3));
  pts.push(new THREE.Vector2(r * 0.97, -t * 0.5));
  pts.push(new THREE.Vector2(r * 0.86, -t * 0.5));
  pts.push(new THREE.Vector2(r * 0.8, -t * 0.28));
  pts.push(new THREE.Vector2(r * 0.48, -t * 0.3));
  pts.push(new THREE.Vector2(r * 0.42, -t * 0.38));
  pts.push(new THREE.Vector2(hole, -t * 0.35));
  if (hole) pts.push(new THREE.Vector2(hole, t * 0.35));
  const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, p.y)), segs ?? (tier === 1 ? 32 : 22));
  g.rotateX(Math.PI / 2); // face along z
  if (tier === 1) {
    // milled edge on silver
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const rr = Math.hypot(x, y);
      if (rr > r * 0.985) {
        const a = Math.atan2(y, x);
        const k = 1 + 0.035 * Math.sign(Math.sin(a * 40));
        pos.setXY(i, x * k, y * k);
      }
    }
  }
  if (tier === 2) {
    // gold: seven-pointed edge, thick and heavy
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const rr = Math.hypot(x, y);
      if (rr > r * 0.84) {
        const a = Math.atan2(y, x);
        const k = 1 + 0.06 * Math.cos(a * 7);
        pos.setXY(i, x * k, y * k);
      }
    }
  }
  g.computeVertexNormals();
  // planar uv for the engraving map
  const uv = new Float32Array(g.attributes.position.count * 2);
  for (let i = 0; i < g.attributes.position.count; i++) {
    uv[i * 2] = g.attributes.position.getX(i) / (r * 2) + 0.5;
    uv[i * 2 + 1] = g.attributes.position.getY(i) / (r * 2) + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Engraving: a height field drawn on canvas, converted to a normal map, plus a wear roughness map.
function engravingMaps(tier) {
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
  if (tier === 0) {
    // copper: a six-armed frost crystal around the hole
    x.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      x.save(); x.rotate((i / 6) * Math.PI * 2);
      x.beginPath(); x.moveTo(0, 34); x.lineTo(0, 92); x.stroke();
      x.beginPath(); x.moveTo(0, 62); x.lineTo(16, 78); x.moveTo(0, 62); x.lineTo(-16, 78); x.stroke();
      x.restore();
    }
  } else if (tier === 1) {
    // silver: concentric survey rings and a meridian cross
    x.lineWidth = 5;
    for (const rr of [36, 58, 80]) { x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); x.stroke(); }
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(-86, 0); x.lineTo(86, 0); x.moveTo(0, -86); x.lineTo(0, 86); x.stroke();
    x.beginPath(); x.arc(0, 0, 14, 0, Math.PI * 2); x.fill();
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
  const r = rng(77 + tier);
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
  return { normal: nt, rough: rt };
}

export function coinMaterial(atmo, tier) {
  const c = COINS[tier];
  if (c.id === 'gem') {
    const gem = new THREE.MeshStandardMaterial({ color: new THREE.Color(...c.color), metalness: 0.1, roughness: 0.04, envMapIntensity: 2.2, emissive: new THREE.Color(0.08, 0.22, 0.3), flatShading: true });
    atmo.register(gem, 'coinGem');
    return gem;
  }
  const maps = engravingMaps(tier);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...c.color), metalness: 1, roughness: c.rough * 2.2,
    normalMap: maps.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: maps.rough, envMapIntensity: 1.25,
  });
  atmo.register(mat, `coin${tier}`);
  return mat;
}

// ---------- system ----------

export class CoinSystem {
  constructor(scene, volume, atmo, tiersUnlocked) {
    this.scene = scene;
    this.volume = volume;
    this.tiers = tiersUnlocked;
    this.geos = COINS.slice(0, 4).map((_, i) => coinGeometry(i));
    // seen blurred through the ice: a plain low-poly disc is enough
    this.lowGeos = COINS.slice(0, 4).map((c) => {
      if (c.id === 'gem') return gemGeometry(c.radius * 0.9, 0);
      const g = new THREE.CylinderGeometry(c.radius, c.radius, c.thick, 10, 1).rotateX(Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const x = g.attributes.position.getX(i), y = g.attributes.position.getY(i); uv.setXY(i, x / (c.radius * 2) + 0.5, y / (c.radius * 2) + 0.5); }
      return g;
    });
    this.mats = COINS.slice(0, 4).map((_, i) => coinMaterial(atmo, i));
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
    volume.on('load', (c) => this.spawnChunk(c));
    volume.on('drop', (c) => { this.embedded.delete(c.key); this.dirty = true; });
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
      const a = r(), b = r(), cc = r(), tierRoll = r();
      const top = surfaceY(x, z);
      if (y > top - 0.42) continue; // the smoothed mesh sits a little below the analytic surface
      const rich = richness(x, y, z);
      if (a > (0.06 + Math.pow(rich, 1.6) * 1.45) / 1.6) continue;
      const depth = top - y;
      const id = hash32(ctx.seed, c.cx, c.cy, c.cz, i);
      if (this.collectedIds.has(id)) continue;
      if (c.data && this.volume.sample(x, y, z) < ISO + 20) continue; // already dug out
      const w = tierWeights(depth, this.tiers);
      let tier = 0, acc = 0;
      for (let t = 0; t < w.length; t++) { acc += w[t]; if (tierRoll <= acc) { tier = t; break; } }
      tier = Math.min(tier, 3);
      _q.setFromEuler(new THREE.Euler(b * 6.28, cc * 6.28, a * 6.28));
      list.push({ tier, x, y, z, q: _q.clone(), id, depth });
    }
    // the first metre under the starting spot holds a small frozen hoard, so the first swing pays
    if (c.cy === -1 && c.cx === 0 && c.cz === 0) {
      for (let i = 0; i < 26; i++) {
        const x = 1.2 + r() * 2.2, z = 1.5 + r() * 2.2, y = surfaceY(x, z) - 0.42 - r() * 0.6;
        const id = hash32(ctx.seed, 7, i);
        if (this.collectedIds.has(id) || this.volume.sample(x, y, z) < ISO + 20) continue;
        _q.setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
        list.push({ tier: 0, x, y, z, q: _q.clone(), id, depth: 0.5, hoard: true });
      }
    }
    list.cx = ox + CHUNK_M / 2; list.cy = oy + CHUNK_M / 2; list.cz = oz + CHUNK_M / 2;
    this.embedded.set(c.key, list);
    this.dirty = true;
  }

  // Free embedded coins whose ice is gone.
  onEdit(op, res) {
    const b = res.bounds;
    const freed = [];
    // only the chunks the edit's bounds overlap
    const lists = [];
    for (let cx = Math.floor(b.x0 / CHUNK_M); cx <= Math.floor(b.x1 / CHUNK_M); cx++)
      for (let cy = Math.floor(b.y0 / CHUNK_M); cy <= Math.floor(b.y1 / CHUNK_M); cy++)
        for (let cz = Math.floor(b.z0 / CHUNK_M); cz <= Math.floor(b.z1 / CHUNK_M); cz++) {
          const l = this.embedded.get(keyOf(cx, cy, cz));
          if (l) lists.push(l);
        }
    for (const list of lists) {
      for (let i = list.length - 1; i >= 0; i--) {
        const k = list[i];
        if (k.x < b.x0 || k.x > b.x1 || k.y < b.y0 || k.y > b.y1 || k.z < b.z0 || k.z > b.z1) continue;
        if (this.volume.sample(k.x, k.y, k.z) < ISO - 6) {
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

  release(k, op) {
    const ctx = this.planetCtx;
    const dir = new THREE.Vector3(k.x - op.x, k.y - op.y + 0.3, k.z - op.z).normalize();
    const pop = op.kind === 'dig' ? 2.2 : 0.6;
    this.loose.push({
      tier: k.tier, id: k.id, p: new THREE.Vector3(k.x, k.y, k.z), v: dir.multiplyScalar(pop * (0.5 + Math.random())),
      q: k.q.clone(), w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18),
      sleep: 0, t: 0, value: ctx ? ctx.coinValue(k.tier, k.depth) : COINS[k.tier].value, depth: k.depth, magnet: false,
    });
    this.collectedIds.add(k.id);
    if (this.loose.length > 2400) this.loose.shift();
  }

  // Physics, magnet and collection. `collectors`: [{ pos: Vector3 (chest), range, canTake(coin) }]
  update(dt, camPos, collectors, autoCollect = 0) {
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
        if (d < 0.45) {
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
      if (c.sleep > 1) continue;
      c.v.y -= 16 * dt;
      c.p.addScaledVector(c.v, dt);
      const rad = 0.05;
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
    const n = [0, 0, 0], f = [0, 0, 0];
    for (const c of this.loose) {
      const near = c.p.distanceToSquared(camPos) < NEAR_R2 && n[c.tier] < 60;
      const m = near ? this.looseMesh[c.tier] : this.looseFar[c.tier];
      const cnt = near ? n : f;
      if (cnt[c.tier] >= m.instanceMatrix.count) continue;
      _m.compose(c.p, c.q, _s);
      m.setMatrixAt(cnt[c.tier]++, _m);
    }
    this.looseMesh.forEach((m, i) => { m.count = n[i]; m.instanceMatrix.needsUpdate = true; });
    this.looseFar.forEach((m, i) => { m.count = f[i]; m.instanceMatrix.needsUpdate = true; });
  }

  drawEmbedded(camPos) {
    this.lastBuild.copy(camPos);
    this.dirty = false;
    const n = [0, 0, 0];
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
        _m.compose(_p, k.q, _s);
        m.setMatrixAt(n[k.tier]++, _m);
      }
    }
    this.embMesh.forEach((m, i) => { m.count = n[i]; m.instanceMatrix.needsUpdate = true; });
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
    this.embedded.clear();
    this.loose.length = 0;
    this.collectedIds.clear();
    this.dirty = true;
  }

  // Bank-time totals for whatever is still loose (used when leaving a planet or saving).
  looseValue() { return this.loose.reduce((a, c) => a + c.value, 0); }
}
