// Meltwater: pools gather at the lowest floor near where ice is melted, ripple and reflect,
// pull light loose coins toward their centre, and refreeze into clear ice if left alone.
import * as THREE from 'three';
import { LAYERS } from '../render/graphics.js';

const MAX_POOLS = 12;

const VERT = /* glsl */`
varying vec3 vW;
varying vec2 vL;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz;
  vL = position.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
uniform sampler2D tOpaque;
uniform vec2 uResolution;
uniform float uTime;
uniform float uFrozen;
uniform float uRadius;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uLight;
varying vec3 vW;
varying vec2 vL;
float h21( vec2 p ) { return fract( sin( dot( p, vec2( 41.3, 289.1 ) ) ) * 43758.5 ); }
float n2( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
  float r = length( vL ) / uRadius;
  if ( r > 1.0 ) discard;
  float t = uTime * ( 1.0 - uFrozen );
  vec2 p = vW.xz * 3.0;
  float hh = n2( p + vec2( t * 0.6, t * 0.4 ) ) + 0.5 * n2( p * 2.3 - vec2( t * 0.8, -t * 0.5 ) );
  vec2 grad = vec2( n2( p + vec2( 0.05, 0 ) + t * 0.6 ) - n2( p - vec2( 0.05, 0 ) + t * 0.6 ), n2( p + vec2( 0, 0.05 ) + t * 0.4 ) - n2( p - vec2( 0, 0.05 ) + t * 0.4 ) ) * ( 1.0 - uFrozen * 0.85 );
  vec3 N = normalize( vec3( -grad.x * 1.4, 1.0, -grad.y * 1.4 ) );
  vec3 V = normalize( cameraPosition - vW );
  float F = 0.02 + 0.98 * pow( 1.0 - max( dot( N, V ), 0.0 ), 5.0 );
  vec2 suv = gl_FragCoord.xy / uResolution + N.xz * 0.025;
  vec3 below = texture2D( tOpaque, suv ).rgb * vec3( 0.62, 0.86, 0.92 );
  vec3 R = reflect( -V, N );
  vec3 refl = mix( uSky * 0.6, uSky * 1.2, clamp( R.y, 0.0, 1.0 ) ) * uLight;
  float spec = pow( max( dot( R, normalize( uSunDir ) ), 0.0 ), 180.0 ) * 6.0;
  vec3 col = mix( below + vec3( 0.02, 0.07, 0.09 ) * uLight, refl, F ) + uSunCol * spec * uLight;
  // refreezing: a milky skin creeps in from the edge
  float skin = smoothstep( 1.0 - uFrozen * 1.1, 1.05 - uFrozen * 1.1, r + n2( vW.xz * 6.0 ) * 0.15 );
  col = mix( col, vec3( 0.78, 0.9, 0.96 ) * uLight, skin * 0.7 );
  float edge = smoothstep( 0.82, 1.0, r );
  if ( any( isnan( col ) ) ) discard;
  gl_FragColor = vec4( min( col, vec3( 64.0 ) ), ( 0.88 - edge * 0.6 ) );
}`;

export class Water {
  constructor(gfx, volume) {
    this.gfx = gfx;
    this.volume = volume;
    this.pools = [];
    this.geo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
    this.onRefreeze = null;
    this.antiRefreeze = 1;
  }

  makeMesh() {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        tOpaque: { value: this.gfx.rtOpaque.texture },
        uResolution: { value: this.gfx.size },
        uTime: { value: 0 }, uFrozen: { value: 0 }, uRadius: { value: 1 },
        uSky: { value: new THREE.Color(0.55, 0.72, 0.9) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.9, 0.8) },
        uLight: { value: 1 },
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geo, m);
    mesh.layers.set(LAYERS.WATER);
    mesh.renderOrder = 3;
    this.gfx.scene.add(mesh);
    return mesh;
  }

  // Add meltwater (m³) near a melt point.
  add(point, volume) {
    const floor = this.volume.floorBelow(point.x, point.y + 0.3, point.z, 30);
    let p = this.pools.find((q) => Math.hypot(q.x - point.x, q.z - point.z) < q.r + 1.2 && Math.abs(q.floor - floor) < 1.2);
    if (!p) {
      if (this.pools.length >= MAX_POOLS) this.pools.sort((a, b) => a.vol - b.vol).shift()?.mesh.removeFromParent();
      p = { x: point.x, z: point.z, floor, vol: 0, r: 0.3, level: floor, idle: 0, frozen: 0, mesh: this.makeMesh(), maxR: this.holeRadius(point.x, floor + 0.3, point.z) };
      this.pools.push(p);
    }
    p.vol += volume * 0.55; // part of it soaks into the snow or steams off
    p.idle = 0;
    p.frozen = Math.max(0, p.frozen - 0.2);
  }

  update(dt, time, sun, sunColor, light) {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.idle += dt;
      // a shallow lens: radius grows with the square root of the volume
      // a pool spreads to the walls of the hole it lies in, then rises (up to about chest height)
      p.r = Math.min(p.maxR || 4.5, Math.max(0.35, Math.sqrt(p.vol / (Math.PI * 0.12))));
      p.level = p.floor + Math.min(1.6, p.vol / (Math.PI * p.r * p.r) + 0.03);
      // let it settle onto the actual floor as the crater changes, and run downhill to a lower floor nearby
      if (Math.random() < dt) {
        p.floor = this.volume.floorBelow(p.x, p.level + 0.4, p.z, 30);
        let best = null, bestF = p.floor - 0.3;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2, d = p.r + 0.6;
          const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
          if (this.volume.sdf(x, p.level, z) > -0.1) continue;   // a wall: no way through
          const f = this.volume.floorBelow(x, p.level + 0.2, z, 30);
          if (f < bestF) { bestF = f; best = [x, z]; }
        }
        if (best && p.frozen < 0.5) { p.x += (best[0] - p.x) * 0.5; p.z += (best[1] - p.z) * 0.5; p.floor = bestF; p.idle = Math.min(p.idle, 4); }
      }
      // pools that meet become one
      for (let j = i - 1; j >= 0; j--) {
        const q = this.pools[j];
        if (Math.hypot(q.x - p.x, q.z - p.z) < (q.r + p.r) * 0.8 && Math.abs(q.floor - p.floor) < 0.6) {
          q.vol += p.vol; q.frozen = Math.min(q.frozen, p.frozen);
          p.mesh.removeFromParent(); p.mesh.material.dispose();
          this.pools.splice(i, 1);
          p.merged = true;
          break;
        }
      }
      if (p.merged) continue;
      const grace = 14 * this.antiRefreeze;
      if (p.idle > grace) {
        p.frozen = Math.min(1, p.frozen + dt / (10 * this.antiRefreeze));
        if (p.frozen >= 1) {
          // refreeze: the pool becomes a flat lens of clear new ice
          const op = { kind: 'fill', x: p.x, y: p.level, z: p.z, r: p.r * 0.95, level: p.level, seed: 0 };
          if (this.applyFill) this.applyFill(op); else this.volume.applyOp(op);
          if (this.onRefreeze) this.onRefreeze(p);
          p.mesh.removeFromParent();
          p.mesh.material.dispose();
          this.pools.splice(i, 1);
          continue;
        }
      }
      const m = p.mesh;
      m.position.set(p.x, p.level, p.z);
      m.scale.set(p.r, 1, p.r);
      const u = m.material.uniforms;
      u.uTime.value = time;
      u.uFrozen.value = p.frozen;
      u.uRadius.value = 1;
      u.uSunDir.value.copy(sun);
      u.uSunCol.value.copy(sunColor);
      u.uLight.value = light;
    }
  }

  // Loose coins inside a pool drift toward its centre (light coins first).
  carry(coins, dt) {
    for (const p of this.pools) {
      if (p.frozen > 0.6) continue;
      for (const c of coins.loose) {
        if (c.magnet) continue;
        const dx = p.x - c.p.x, dz = p.z - c.p.z;
        const d = Math.hypot(dx, dz);
        if (d > p.r || Math.abs(c.p.y - p.level) > 0.5 || d < 0.2) continue;
        const k = (c.tier === 0 ? 0.6 : c.tier === 1 ? 0.35 : 0.15) * dt;
        c.p.x += dx * k; c.p.z += dz * k;
        c.sleep = Math.min(c.sleep, 0.9);
      }
    }
  }

  // How far the hole around a point extends before hitting a wall (so pools fill shafts instead of spreading thin).
  holeRadius(x, y, z) {
    let best = 4.5;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (let d = 0.3; d < 4.5; d += 0.25) if (this.volume.sdf(x + Math.cos(a) * d, y, z + Math.sin(a) * d) > 0) { best = Math.min(best, Math.max(0.6, d)); break; }
    }
    return best;
  }

  // Water above a point: { depth, level, pool } or null.
  depthAt(x, y, z) {
    for (const p of this.pools) {
      if (p.frozen > 0.85) continue;
      if (Math.hypot(p.x - x, p.z - z) > p.r || y > p.level || y < p.floor - 0.6) continue;
      return { depth: p.level - y, level: p.level, pool: p };
    }
    return null;
  }

  steamAt(point) {
    return this.pools.find((p) => Math.hypot(p.x - point.x, p.z - point.z) < p.r && Math.abs(p.level - point.y) < 0.6);
  }

  clear() {
    for (const p of this.pools) { p.mesh.removeFromParent(); p.mesh.material.dispose(); }
    this.pools.length = 0;
  }
}
