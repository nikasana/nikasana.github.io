// GPU-instanced billboard particles with soft depth fade against the scene.
// Two pools: alpha-blended (shards, frost dust, steam, drips) and additive (sparks, glints, motes).
import * as THREE from 'three';
import { LAYERS } from './graphics.js';

// sprite atlas: 0 soft disc, 1 shard, 2 star glint, 3 wispy puff
function atlas() {
  const S = 128, cv = document.createElement('canvas');
  cv.width = S * 4; cv.height = S;
  const x = cv.getContext('2d');
  // soft disc
  let g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // shard: an irregular faceted splinter
  x.save(); x.translate(S * 1.5, S / 2);
  x.fillStyle = 'rgba(255,255,255,1)';
  x.beginPath(); x.moveTo(-8, -44); x.lineTo(14, -18); x.lineTo(10, 30); x.lineTo(-4, 46); x.lineTo(-16, 8); x.closePath(); x.fill();
  x.fillStyle = 'rgba(200,230,255,0.6)';
  x.beginPath(); x.moveTo(-8, -44); x.lineTo(2, 0); x.lineTo(-4, 46); x.lineTo(-16, 8); x.closePath(); x.fill();
  x.restore();
  // star glint
  x.save(); x.translate(S * 2.5, S / 2);
  g = x.createRadialGradient(0, 0, 0, 0, 0, 20);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(-64, -64, 128, 128);
  for (const [w, l] of [[3, 60], [2, 34]]) {
    for (let k = 0; k < 2; k++) {
      x.rotate(k ? Math.PI / 2 : 0);
      const lg = x.createLinearGradient(-l, 0, l, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = lg; x.fillRect(-l, -w / 2, l * 2, w);
    }
    x.rotate(Math.PI / 4);
  }
  x.restore();
  // wispy puff from overlapping discs
  x.save(); x.translate(S * 3.5, S / 2);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 10 + (i % 5) * 6;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    g = x.createRadialGradient(px, py, 0, px, py, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, 30, 0, Math.PI * 2); x.fill();
  }
  x.restore();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const VERT = /* glsl */`
attribute vec4 aPos;     // xyz, size
attribute vec4 aCol;     // rgb, alpha
attribute vec2 aMisc;    // rotation, sprite index
varying vec2 vUv;
varying vec4 vCol;
varying float vSprite;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4( aPos.xyz, 1.0 );
  float c = cos( aMisc.x ), s = sin( aMisc.x );
  vec2 q = position.xy;
  mv.xy += vec2( q.x * c - q.y * s, q.x * s + q.y * c ) * aPos.w;
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vCol = aCol;
  vSprite = aMisc.y;
  vDepth = -mv.z;
}`;

const FRAG = /* glsl */`
uniform sampler2D tAtlas;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform vec2 uNearFar;
uniform float uSoft;
varying vec2 vUv;
varying vec4 vCol;
varying float vSprite;
varying float vDepth;
float linDepth( float d ) { float n = uNearFar.x, f = uNearFar.y; float z = d * 2.0 - 1.0; return 2.0 * n * f / ( f + n - z * ( f - n ) ); }
void main() {
  // sprite >= 4: the same sprite drawn through the scene (x-ray), dimmed when occluded
  float sp = floor( vSprite + 0.5 );
  bool xray = sp > 3.5;
  if ( xray ) sp -= 4.0;
  vec2 uv = vec2( ( vUv.x + sp ) * 0.25, vUv.y );
  vec4 t = texture2D( tAtlas, uv );
  float scene = linDepth( texture2D( tDepth, gl_FragCoord.xy / uResolution ).x );
  float fade = clamp( ( scene - vDepth ) / uSoft, 0.0, 1.0 );
  if ( xray ) fade = max( fade, 0.55 );
  float a = t.a * vCol.a * fade;
  if ( a < 0.003 ) discard;
  vec3 pc = vCol.rgb * t.rgb; if ( any( isnan( pc ) ) || isnan( a ) ) discard;
  gl_FragColor = vec4( min( pc, vec3( 64.0 ) ), clamp( a, 0.0, 1.0 ) );
}`;

export const P = { SHARD: 1, DUST: 2, STEAM: 3, SPARK: 4, DRIP: 5, GLINT: 6, MOTE: 7, CHIP: 8, FLAME: 9 };

class Pool {
  constructor(scene, cap, additive, shared) {
    this.cap = cap;
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.size = new Float32Array(cap * 2);   // start, end
    this.col = new Float32Array(cap * 4);
    this.rot = new Float32Array(cap * 2);    // angle, spin
    this.kind = new Uint8Array(cap);
    this.sprite = new Uint8Array(cap);
    this.drag = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aMisc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos);
    g.setAttribute('aCol', this.aCol);
    g.setAttribute('aMisc', this.aMisc);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: shared, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYERS.FX);
    this.mesh.renderOrder = additive ? 2 : 1;
    scene.add(this.mesh);
    this.geo = g;
  }

  spawn(kind, sprite, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag, grav, spin) {
    let i = this.n;
    if (i >= this.cap) { i = Math.floor(Math.random() * this.cap); } else this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = 0; this.maxLife[i] = life;
    this.size[i * 2] = s0; this.size[i * 2 + 1] = s1;
    this.col.set([r, g, b, a], i * 4);
    this.rot[i * 2] = Math.random() * 6.28; this.rot[i * 2 + 1] = spin;
    this.kind[i] = kind; this.sprite[i] = sprite;
    this.drag[i] = drag; this.grav[i] = grav;
  }

  update(dt, volume) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) { this.copy(n - 1, i); n--; i--; continue; }
      const o = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[o] *= d; this.vel[o + 1] = this.vel[o + 1] * d - this.grav[i] * dt; this.vel[o + 2] *= d;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      this.rot[i * 2] += this.rot[i * 2 + 1] * dt;
      // shards and drips stop on the ice
      if ((this.kind[i] === P.SHARD || this.kind[i] === P.DRIP || this.kind[i] === P.CHIP) && volume && this.vel[o + 1] < 0 && volume.sdf(this.pos[o], this.pos[o + 1], this.pos[o + 2]) > -0.02) {
        this.vel[o] *= 0.3; this.vel[o + 1] *= -0.25; this.vel[o + 2] *= 0.3; this.rot[i * 2 + 1] *= 0.3;
      }
    }
    this.n = n;
    const P4 = this.aPos.array, C4 = this.aCol.array, M2 = this.aMisc.array;
    for (let i = 0; i < n; i++) {
      const t = this.life[i] / this.maxLife[i];
      P4[i * 4] = this.pos[i * 3]; P4[i * 4 + 1] = this.pos[i * 3 + 1]; P4[i * 4 + 2] = this.pos[i * 3 + 2];
      P4[i * 4 + 3] = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t;
      const fadeIn = Math.min(1, t * 8), fadeOut = 1 - t * t;
      C4[i * 4] = this.col[i * 4]; C4[i * 4 + 1] = this.col[i * 4 + 1]; C4[i * 4 + 2] = this.col[i * 4 + 2];
      C4[i * 4 + 3] = this.col[i * 4 + 3] * fadeIn * fadeOut;
      M2[i * 2] = this.rot[i * 2]; M2[i * 2 + 1] = this.sprite[i];
    }
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aMisc.needsUpdate = true;
    this.aPos.addUpdateRange(0, n * 4); this.aCol.addUpdateRange(0, n * 4); this.aMisc.addUpdateRange(0, n * 2);
  }

  copy(from, to) {
    if (from === to) return;
    for (const [arr, k] of [[this.pos, 3], [this.vel, 3], [this.size, 2], [this.col, 4], [this.rot, 2]]) for (let j = 0; j < k; j++) arr[to * k + j] = arr[from * k + j];
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.kind[to] = this.kind[from]; this.sprite[to] = this.sprite[from];
    this.drag[to] = this.drag[from]; this.grav[to] = this.grav[from];
  }

  clear() { this.n = 0; }
}

export class Particles {
  constructor(gfx) {
    this.gfx = gfx;
    this.density = 1;
    this.uniforms = {
      tAtlas: { value: atlas() },
      tDepth: { value: gfx.rtMain.depthTexture },
      uResolution: { value: gfx.size },
      uNearFar: { value: new THREE.Vector2(0.05, 6000) },
      uSoft: { value: 0.35 },
    };
    this.alpha = new Pool(gfx.scene, 3000, false, this.uniforms);
    this.add = new Pool(gfx.scene, 2000, true, this.uniforms);
  }

  n(base) { const k = base * this.density; return Math.floor(k) + (Math.random() < k % 1 ? 1 : 0); }

  // ice chips and shards thrown from a strike
  chips(p, normal, power = 1, tint = [0.85, 0.94, 1]) {
    const R = Math.random;
    for (let i = 0, n = this.n(14 * power); i < n; i++) {
      const v = normal.clone().multiplyScalar(2 + R() * 4).add(new THREE.Vector3(R() - 0.5, R() * 0.8, R() - 0.5).multiplyScalar(4));
      const s = 0.03 + R() * 0.07;
      this.alpha.spawn(P.SHARD, 1, p.x, p.y, p.z, v.x, v.y, v.z, 0.9 + R() * 0.8, s, s * 0.8, tint[0], tint[1], tint[2], 0.95, 0.4, 9.8, (R() - 0.5) * 22);
    }
    for (let i = 0, n = this.n(8 * power); i < n; i++) {
      const v = normal.clone().multiplyScalar(0.6 + R()).add(new THREE.Vector3(R() - 0.5, R() * 0.5, R() - 0.5));
      const s = 0.15 + R() * 0.25;
      this.alpha.spawn(P.DUST, 3, p.x, p.y, p.z, v.x, v.y, v.z, 1.4 + R() * 1.2, s, s * 3.2, 0.92, 0.96, 1, 0.42, 1.6, -0.15, (R() - 0.5) * 1.5);
    }
    for (let i = 0, n = this.n(3 * power); i < n; i++) {
      const v = normal.clone().multiplyScalar(1.5).add(new THREE.Vector3(R() - 0.5, R(), R() - 0.5).multiplyScalar(2));
      this.add.spawn(P.GLINT, 2, p.x, p.y, p.z, v.x, v.y, v.z, 0.5 + R() * 0.4, 0.12, 0.02, 1, 1, 1, 0.9, 1.2, 3, 4);
    }
  }

  // drill: a continuous spray of fine powder
  drillSpray(p, normal) {
    const R = Math.random;
    for (let i = 0, n = this.n(4); i < n; i++) {
      const v = normal.clone().multiplyScalar(2 + R() * 3).add(new THREE.Vector3(R() - 0.5, R() - 0.2, R() - 0.5).multiplyScalar(5));
      this.alpha.spawn(P.CHIP, 1, p.x, p.y, p.z, v.x, v.y, v.z, 0.5 + R() * 0.5, 0.02 + R() * 0.03, 0.01, 0.9, 0.96, 1, 0.9, 0.8, 9.8, (R() - 0.5) * 30);
    }
    if (R() < 0.5 * this.density) {
      const v = normal.clone().multiplyScalar(0.6);
      this.alpha.spawn(P.DUST, 3, p.x, p.y, p.z, v.x, v.y + 0.2, v.z, 1.2, 0.2, 0.9, 0.93, 0.97, 1, 0.3, 1.5, -0.1, 0.6);
    }
  }

  // torch flame (from the nozzle) and steam (from the ice)
  flame(nozzle, dir, power = 1) {
    const R = Math.random;
    for (let i = 0, n = this.n(3 * power); i < n; i++) {
      const v = dir.clone().multiplyScalar(5 + R() * 3).add(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.8));
      const s = 0.05 + R() * 0.05;
      // Reverse Mode sprays frost: ice-blue and slower, drifting down
      if (this.frost) this.add.spawn(P.FLAME, 0, nozzle.x, nozzle.y, nozzle.z, v.x * 0.7, v.y * 0.7, v.z * 0.7, 0.3 + R() * 0.15, s, s * 4, 0.55, 0.85 + R() * 0.1, 1.0, 0.7, 2.5, 1.5, 0);
      else this.add.spawn(P.FLAME, 0, nozzle.x, nozzle.y, nozzle.z, v.x, v.y, v.z, 0.16 + R() * 0.1, s, s * 3.5, 1.0, 0.45 + R() * 0.2, 0.15, 0.85, 2, -2, 0);
    }
    if (R() < 0.6) this.add.spawn(P.FLAME, 0, nozzle.x, nozzle.y, nozzle.z, dir.x * 6, dir.y * 6, dir.z * 6, 0.12, 0.05, 0.2, this.frost ? 0.85 : 0.55, this.frost ? 0.95 : 0.75, 1.0, 0.8, 1, 0, 0);
  }

  steam(p, normal, power = 1) {
    const R = Math.random;
    for (let i = 0, n = this.n(2.2 * power); i < n; i++) {
      const v = normal.clone().multiplyScalar(0.5 + R() * 0.6).add(new THREE.Vector3(R() - 0.5, 0.8 + R() * 0.6, R() - 0.5));
      const s = 0.25 + R() * 0.3;
      this.alpha.spawn(P.STEAM, 3, p.x + (R() - 0.5) * 0.3, p.y, p.z + (R() - 0.5) * 0.3, v.x, v.y, v.z, 2.2 + R() * 1.6, s, s * 5, 0.88, 0.9, 0.93, 0.32, 0.9, -0.35, (R() - 0.5) * 0.6);
    }
  }

  sparks(p, normal, power = 1) {
    const R = Math.random;
    for (let i = 0, n = this.n(6 * power); i < n; i++) {
      const v = normal.clone().multiplyScalar(2 + R() * 3).add(new THREE.Vector3(R() - 0.5, R(), R() - 0.5).multiplyScalar(5));
      this.add.spawn(P.SPARK, 0, p.x, p.y, p.z, v.x, v.y, v.z, 0.35 + R() * 0.4, 0.035, 0.01, 1, 0.6, 0.25, 1, 1.2, 9.8, 0);
    }
  }

  drip(p) {
    const R = Math.random;
    this.alpha.spawn(P.DRIP, 0, p.x + (R() - 0.5) * 0.4, p.y, p.z + (R() - 0.5) * 0.4, 0, -0.5, 0, 1.4, 0.035, 0.03, 0.75, 0.9, 1, 0.8, 0.1, 9.8, 0);
  }

  glint(p, color = [1, 0.9, 0.6], size = 0.18) {
    this.add.spawn(P.GLINT, 2, p.x, p.y, p.z, 0, 0, 0, 0.45, size, size * 0.2, color[0], color[1], color[2], 1, 0, 0, 3);
  }

  // coin streak toward the beacon or the pack
  streak(from, to, color) {
    const v = to.clone().sub(from).multiplyScalar(2.2);
    this.add.spawn(P.MOTE, 0, from.x, from.y, from.z, v.x, v.y, v.z, 0.42, 0.07, 0.03, color[0], color[1], color[2], 0.9, 0, 0, 0);
  }

  motes(center, radius, color) {
    const R = Math.random;
    if (R() > 0.4 * this.density) return;
    const a = R() * 6.28, r = radius * Math.sqrt(R());
    this.add.spawn(P.MOTE, 0, center.x + Math.cos(a) * r, center.y + (R() - 0.5) * 2, center.z + Math.sin(a) * r, 0, 0.15 + R() * 0.2, 0, 3 + R() * 2, 0.04, 0.02, color[0], color[1], color[2], 0.6, 0.2, -0.02, 0);
  }

  update(dt, volume) {
    this.uniforms.uNearFar.value.set(this.gfx.camera.near, this.gfx.camera.far);
    this.uniforms.tDepth.value = this.gfx.rtMain.depthTexture;
    this.alpha.update(dt, volume);
    this.add.update(dt, volume);
  }

  clear() { this.alpha.clear(); this.add.clear(); }
  count() { return this.alpha.n + this.add.n; }
}
