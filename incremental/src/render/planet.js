// Planet view: a procedural globe seen from orbit, with your crater at the pole, the ice caps
// retreating, sea level rising and heat rings spreading from your pole.
import * as THREE from 'three';

const NOISE = /* glsl */`
float ph( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
float pn( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( ph( i ), ph( i + vec3( 1, 0, 0 ) ), f.x ), mix( ph( i + vec3( 0, 1, 0 ) ), ph( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( ph( i + vec3( 0, 0, 1 ) ), ph( i + vec3( 1, 0, 1 ) ), f.x ), mix( ph( i + vec3( 0, 1, 1 ) ), ph( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
float pf( vec3 p ) { float a = 0.5, s = 0.0; for ( int i = 0; i < 6; i ++ ) { s += a * pn( p ); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;

const GLOBE_V = /* glsl */`
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main() { vP = position; vN = normalize( mat3( modelMatrix ) * normal ); vW = ( modelMatrix * vec4( position, 1.0 ) ).xyz; gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 ); }`;

const GLOBE_F = /* glsl */`
uniform vec3 uSun; uniform vec3 uOcean; uniform vec3 uLand; uniform vec3 uIce; uniform vec3 uDeepIce;
uniform float uPole; uniform float uCap; uniform float uSea; uniform float uCrater; uniform float uDepth; uniform float uHeat; uniform float uTime; uniform float uSeed;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main() {
  vec3 p = normalize( vP );
  float lat = asin( clamp( p.y, -1.0, 1.0 ) );
  vec3 q = p * 2.2 + uSeed;
  float h = pf( q ) - 0.5;
  // continents; the sea rises over the low coasts
  float land = smoothstep( 0.02 + uSea, 0.06 + uSea, h );
  vec3 col = mix( uOcean * ( 0.7 + 0.6 * smoothstep( -0.3, 0.05, h ) ), uLand * ( 0.75 + 0.5 * pf( q * 4.0 ) ), land );
  // ice: everywhere poleward of the cap edge, with a ragged fringe
  float poleDist = 1.5707963 - abs( lat );
  float edge = uCap + ( pf( q * 3.0 + 11.0 ) - 0.5 ) * 0.35;
  float ice = 1.0 - smoothstep( edge - 0.05, edge + 0.05, poleDist );
  // sea ice is thinner and breaks up first
  ice *= mix( 0.75, 1.0, land );
  vec3 iceCol = mix( uDeepIce, uIce, 0.6 + 0.4 * pf( q * 6.0 ) );
  // ice flows off the pole: streaks radiate along longitude, with broad drainage basins
  float lon = atan( p.z, p.x );
  float flow = pn( vec3( lon * 14.0, abs( lat ) * 2.5, 3.0 ) ) * 0.6 + pn( vec3( lon * 41.0, abs( lat ) * 6.0, 7.0 ) ) * 0.4;
  iceCol *= 0.9 + 0.1 * flow;
  iceCol = mix( iceCol, iceCol * vec3( 0.86, 0.93, 1.0 ), smoothstep( 0.55, 0.8, pf( q * 1.5 + 4.0 ) ) );
  col = mix( col, iceCol, ice );
  // your pole: heat rings spreading out, a melted fringe and the crater with its glowing core
  vec3 poleV = vec3( 0.0, uPole, 0.0 );
  float d = acos( clamp( dot( p, poleV ), -1.0, 1.0 ) );
  float ringR = uHeat * 0.9;
  float rings = 0.0;
  for ( int i = 0; i < 4; i ++ ) {
    float rr = ringR * ( 1.0 - float( i ) * 0.22 );
    rings += ( 1.0 - smoothstep( 0.0, 0.012, abs( d - rr ) ) ) * ( 0.7 - float( i ) * 0.15 );
  }
  float melt = ( 1.0 - smoothstep( ringR * 0.55, ringR, d ) ) * uHeat;
  col = mix( col, mix( uOcean * 1.2, vec3( 0.45, 0.62, 0.7 ), 0.4 ), melt * 0.35 * ( 0.6 + 0.4 * pn( p * 30.0 ) ) );
  float crater = 1.0 - smoothstep( uCrater * 0.6, uCrater, d );
  col = mix( col, vec3( 0.02, 0.05, 0.08 ), crater );
  float core = 1.0 - smoothstep( 0.0, uCrater * 0.45, d );
  vec3 glow = vec3( 0.5, 0.85, 1.0 ) * core * ( 0.5 + uDepth * 2.5 ) + vec3( 1.0, 0.5, 0.2 ) * core * uDepth * uDepth * 3.0;
  // lighting: soft terminator, ice is glossy
  vec3 N = normalize( vN );
  float ndl = dot( N, normalize( uSun ) );
  float lit = smoothstep( -0.15, 0.35, ndl );
  vec3 V = normalize( cameraPosition - vW );
  float spec = pow( max( dot( reflect( -normalize( uSun ), N ), V ), 0.0 ), 40.0 ) * ( ice * 0.25 + ( 1.0 - land ) * ( 1.0 - ice ) * 0.6 );
  vec3 outc = col * ( 0.04 + 0.82 * lit ) + spec * lit * 0.8;
  outc += glow + vec3( 1.0, 0.5, 0.2 ) * rings * 1.1;
  // night side: the crater still glows
  gl_FragColor = vec4( outc, 1.0 );
}`;

const ATMO_F = /* glsl */`
uniform vec3 uSun; uniform vec3 uTint;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 N = normalize( vN );
  vec3 V = normalize( cameraPosition - vW );
  float rim = pow( 1.0 - max( dot( N, V ), 0.0 ), 3.0 );
  float lit = smoothstep( -0.3, 0.4, dot( N, normalize( uSun ) ) );
  gl_FragColor = vec4( uTint * rim * lit * 1.6, rim * lit );
}`;

const CLOUD_F = /* glsl */`
uniform vec3 uSun; uniform float uTime; uniform float uSeed;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main() {
  vec3 p = normalize( vP );
  float a = uTime * 0.01;
  vec3 q = vec3( p.x * cos( a ) - p.z * sin( a ), p.y, p.x * sin( a ) + p.z * cos( a ) ) * 3.0 + uSeed * 2.0;
  float c = smoothstep( 0.52, 0.75, pf( q + vec3( 0.0, p.y * 2.0, 0.0 ) ) );
  float lit = smoothstep( -0.1, 0.4, dot( normalize( vN ), normalize( uSun ) ) );
  gl_FragColor = vec4( vec3( 0.95 ) * ( 0.15 + 0.85 * lit ), c * 0.75 );
}`;

export class PlanetView {
  constructor(gfx) {
    this.gfx = gfx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 100);
    this.uniforms = {
      uSun: { value: new THREE.Vector3(1, 0.4, 0.6).normalize() },
      uOcean: { value: new THREE.Color(0.04, 0.16, 0.3) }, uLand: { value: new THREE.Color(0.35, 0.33, 0.3) },
      uIce: { value: new THREE.Color(0.93, 0.97, 1.0) }, uDeepIce: { value: new THREE.Color(0.55, 0.78, 0.92) },
      uPole: { value: 1 }, uCap: { value: 1.25 }, uSea: { value: 0 }, uCrater: { value: 0.03 }, uDepth: { value: 0 }, uHeat: { value: 0.05 },
      uTime: { value: 0 }, uSeed: { value: 3.1 }, uTint: { value: new THREE.Color(0.45, 0.7, 1.0) },
    };
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: GLOBE_V, fragmentShader: GLOBE_F }));
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 96), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: GLOBE_V, fragmentShader: CLOUD_F, transparent: true, depthWrite: false }));
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: GLOBE_V, fragmentShader: ATMO_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide }));
    this.scene.add(this.globe, this.clouds, this.atmo);
    // aurora ribbons (Auralis): a wavy curtain ringing each pole
    this.ribbons = new THREE.Group();
    const ribMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h( float x ) { return fract( sin( x * 91.7 ) * 43758.5 ); }
        float n( float x ) { float i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f ); return mix( h( i ), h( i + 1.0 ), f ); }
        void main() {
          float rays = n( vUv.x * 90.0 + uTime * 0.8 ) * 0.6 + n( vUv.x * 230.0 - uTime * 1.3 ) * 0.4;
          float a = smoothstep( 0.0, 0.15, vUv.y ) * ( 1.0 - smoothstep( 0.3, 1.0, vUv.y ) ) * ( 0.3 + rays );
          vec3 col = mix( vec3( 0.25, 1.0, 0.55 ), vec3( 0.6, 0.3, 1.0 ), smoothstep( 0.25, 0.9, vUv.y ) );
          gl_FragColor = vec4( col * a * 0.9, a );
        }`,
    });
    for (const side of [1, -1]) {
      const g = new THREE.CylinderGeometry(0.4, 0.5, 0.22, 160, 1, true);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i), a = Math.atan2(z, x), w = 1 + 0.12 * Math.sin(a * 5) + 0.05 * Math.sin(a * 13);
        pa.setX(i, x * w); pa.setZ(i, z * w);
      }
      const m = new THREE.Mesh(g, ribMat);
      m.position.y = side * 0.97;
      if (side < 0) m.rotation.x = Math.PI;
      this.ribbons.add(m);
    }
    this.ribbons.visible = false;
    this.scene.add(this.ribbons);
    // stars
    const N = 3000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = Math.random();
      col.set([0.7 + t * 0.3, 0.75 + t * 0.2, 0.9 + (1 - t) * 0.1], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.08, vertexColors: true, sizeAttenuation: true }));
    this.scene.add(this.stars);
    this.scene.background = new THREE.Color(0x01040a);
    this.yaw = 0.6; this.pitch = 0.75; this.dist = 3.4; this.target = 3.4;
    this.t = 0;
  }

  setPlanet(p, pole) {
    const u = this.uniforms;
    u.uOcean.value.setRGB(...p.ocean);
    u.uLand.value.setRGB(...p.land);
    u.uSeed.value = (p.seed % 97) / 10;
    u.uPole.value = pole === 'N' ? 1 : -1;
    this.ribbons.visible = !!p.aurora;
  }

  // world-state readouts: depth fraction, heat 0..1, sea cm
  setState({ depthF, heat, seaCm, craterDepth }) {
    const u = this.uniforms;
    u.uDepth.value = depthF;
    u.uHeat.value = 0.04 + heat * 0.96;
    u.uCrater.value = 0.012 + Math.min(0.05, Math.sqrt(craterDepth) * 0.0018);
    u.uSea.value = Math.min(0.12, seaCm * 0.002);
    // caps retreat as heat spreads (angular radius from the pole)
    u.uCap.value = 1.2 - heat * 0.55;
  }

  // entering: start close over the pole and pull back
  enter() {
    const pole = this.uniforms.uPole.value;
    this.pitch = pole > 0 ? 1.45 : -1.45;
    this.dist = 1.25;
    this.target = 3.4;
    this.zoomIn = false;
  }

  leave() { this.zoomIn = true; this.target = 1.2; }

  drag(dx, dy) { this.yaw -= dx * 0.005; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.005)); }
  zoom(d) { this.target = Math.max(1.6, Math.min(7, this.target * (1 + d * 0.1))); }

  update(dt) {
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    if (!this.dragging && !this.zoomIn) this.yaw += dt * 0.05;
    this.ribbons.rotation.y += dt * 0.03;
    const pole = this.uniforms.uPole.value;
    if (this.zoomIn) this.pitch += ((pole > 0 ? 1.45 : -1.45) - this.pitch) * Math.min(1, dt * 3);
    this.dist += (this.target - this.dist) * Math.min(1, dt * (this.zoomIn ? 3.5 : 2.2));
    const c = this.camera;
    c.position.set(Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.sin(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist);
    c.lookAt(0, 0, 0);
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
    // the sun sits off to one side of the camera so the terminator always shows
    const s = new THREE.Vector3(Math.cos(this.yaw + 0.9), 0.35, Math.sin(this.yaw + 0.9)).normalize();
    this.uniforms.uSun.value.copy(s);
  }

  // Render into a target (used by the main pass while the planet view is up).
  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x01040a, 1);
    renderer.clear(true, true, false);
    renderer.render(this.scene, this.camera);
  }
}
