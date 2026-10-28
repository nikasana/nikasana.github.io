// Aurora events: curtains of light in the sky for about a minute, while sky coins drift down to be caught.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uAlpha;
uniform vec3 uColA;
uniform vec3 uColB;
varying vec2 vUv;
varying vec3 vW;
float h( float x ) { return fract( sin( x * 127.1 ) * 43758.5 ); }
float n( float x ) { float i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f ); return mix( h( i ), h( i + 1.0 ), f ); }
void main() {
  // vertical rays that ripple sideways, brightest at the bottom edge of the curtain
  float x = vUv.x * 40.0;
  float rays = n( x + uTime * 0.6 ) * 0.6 + n( x * 2.7 - uTime * 0.9 ) * 0.4;
  float base = smoothstep( 0.0, 0.12, vUv.y ) * ( 1.0 - smoothstep( 0.25, 1.0, vUv.y ) );
  float edge = smoothstep( 0.0, 0.08, vUv.x ) * smoothstep( 0.0, 0.08, 1.0 - vUv.x );
  vec3 col = mix( uColA, uColB, smoothstep( 0.2, 0.9, vUv.y ) );
  float a = base * edge * ( 0.35 + rays * 0.9 ) * uAlpha;
  gl_FragColor = vec4( col * a * 1.6, a );
}`;

export class Aurora {
  constructor(scene) {
    this.group = new THREE.Group();
    this.uniforms = { uTime: { value: 0 }, uAlpha: { value: 0 }, uColA: { value: new THREE.Color(0.25, 1.0, 0.55) }, uColB: { value: new THREE.Color(0.55, 0.3, 1.0) } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) {
      // a long curved curtain high in the sky
      const geo = new THREE.PlaneGeometry(900, 160, 80, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(x * 0.006 + k * 1.7) * 120); }
      const m = new THREE.Mesh(geo, mat);
      m.position.set((k - 1) * 60, 230 + k * 25, -200 + k * 140);
      m.rotation.y = 0.3 * (k - 1);
      m.frustumCulled = false;
      m.renderOrder = -1;
      this.group.add(m);
    }
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0;
    this.active = false;
    this.fade = 0;
    this.ambient = 0;   // a faint standing aurora (Auralis)
  }

  // colours: [low edge, high edge]; a new pair is picked for every aurora
  start(duration = 60) {
    this.active = true; this.left = duration; this.group.visible = true;
    const P = [[[0.25, 1.0, 0.55], [0.55, 0.3, 1.0]], [[0.3, 0.95, 0.85], [0.95, 0.35, 0.7]], [[0.6, 1.0, 0.4], [0.3, 0.5, 1.0]], [[1.0, 0.45, 0.6], [0.45, 0.35, 1.0]]];
    const [a, b] = P[Math.floor(Math.random() * P.length)];
    this.uniforms.uColA.value.setRGB(...a); this.uniforms.uColB.value.setRGB(...b);
  }

  update(dt, time, camPos) {
    this.uniforms.uTime.value = time;
    if (this.active) { this.left -= dt; if (this.left <= 0) this.active = false; }
    const want = this.active ? 1 : this.ambient;
    this.fade = Math.max(0, Math.min(1, this.fade + Math.sign(want - this.fade) * Math.min(Math.abs(want - this.fade), dt / (want > this.fade ? 3 : 4))));
    this.uniforms.uAlpha.value = this.fade;
    this.group.visible = this.fade > 0.001;
    this.group.position.set(camPos.x, 0, camPos.z);
  }
}
