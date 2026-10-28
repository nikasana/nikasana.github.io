// Atmosphere: procedural sky, a polar sun that circles the horizon, image-based lighting from the
// sky (PMREM), and cascaded shadow maps for the sun.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { CSMShader } from 'three/addons/csm/CSMShader.js';
import { FOG } from './fog.js';

// The CSM addon replaces three's lights_fragment_begin with an older copy that lacks the
// STANDARD block (material.dfg and multi-scattering), which leaves every specular term undefined
// (metals render black). Re-insert that block from the current chunk.
const ORIGINAL_LFB = THREE.ShaderChunk.lights_fragment_begin;
let csmPatched = false;
function patchCSMShader() {
  if (csmPatched) return;
  csmPatched = true;
  const start = ORIGINAL_LFB.indexOf('#ifdef STANDARD');
  const end = ORIGINAL_LFB.indexOf('IncidentLight directLight;');
  if (start < 0 || end < 0) return;
  const block = ORIGINAL_LFB.slice(start, end);
  if (CSMShader.lights_fragment_begin.includes('material.dfg')) return;
  CSMShader.lights_fragment_begin = CSMShader.lights_fragment_begin.replace('IncidentLight directLight;', `${block}\nIncidentLight directLight;`);
}

export class Atmosphere {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    this.sky.name = 'sky';
    this.sky.material.depthWrite = false;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // a second sky for environment captures
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    // a per-planet veil over the sky dome (Mistral's fog hides the sky too)
    this.veil = { uVeil: { value: 0 }, uVeilColor: { value: new THREE.Color() } };
    for (const s of [this.sky, this.envSky]) {
      s.material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, this.veil);
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform float uVeil;\nuniform vec3 uVeilColor;\nvoid main() {')
          .replace('gl_FragColor = vec4( texColor, 1.0 );', `gl_FragColor = vec4( texColor, 1.0 );
            {
              vec3 dir = normalize( vWorldPosition - cameraPosition );
              float sunGlow = pow( max( dot( dir, vSunDirection ), 0.0 ), 8.0 );
              vec3 veil = uVeilColor * ( 1.0 + sunGlow * 0.35 );
              gl_FragColor.rgb = mix( gl_FragColor.rgb, veil, uVeil * ( 0.75 + 0.25 * ( 1.0 - max( dir.y, 0.0 ) ) ) );
            }`);
      };
      s.material.customProgramCacheKey = () => 'skyVeil';
    }
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.lastEnvSun = new THREE.Vector3();
    this.envTimer = 0;

    this.sunDir = new THREE.Vector3(0.6, 0.25, -0.75).normalize();
    this.sunColor = new THREE.Color(1.0, 0.86, 0.7);
    this.sunIntensity = 3.2;
    this.time = 0;
    this.planet = null;
    this.csm = null;
    this.materials = new Map();
    this.quality = 'high';
    this.depthDim = 1;
  }

  setPlanet(p) {
    this.planet = p;
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.turbidity.value = p.sky.turbidity;
      u.rayleigh.value = p.sky.rayleigh;
      u.mieCoefficient.value = p.sky.mieCoefficient;
      u.mieDirectionalG.value = p.sky.mieDirectionalG;
      if (u.cloudCoverage) { u.cloudCoverage.value = p.clouds ?? 0.32; u.cloudDensity.value = 0.45; u.cloudScale.value = 0.00018; u.cloudSpeed.value = 0.00001; u.cloudElevation.value = 0.45; }
    }
    this.veil.uVeil.value = p.skyVeil || 0;
    this.veil.uVeilColor.value.setRGB(...p.fog).multiplyScalar(p.skyVeilBright || 1);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(...p.fog), p.fogDensity);
    FOG.uFogParams.value.x = p.fogDensity;
    this.lastEnvSun.set(0, 0, 0);
  }

  // shadows: { size, cascades, far } from the graphics preset
  setupShadows(cfg) {
    if (this.csm) { this.csm.remove(); this.csm.dispose(); }
    this.csm = null;
    if (!cfg) return;
    patchCSMShader();
    this.csm = new CSM({
      maxFar: cfg.far, cascades: cfg.cascades, shadowMapSize: cfg.size, mode: 'practical',
      parent: this.scene, camera: this.camera, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: this.sunIntensity, lightNear: 1, lightFar: 900, lightMargin: 120, shadowBias: -0.0004,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) {
      l.shadow.camera.layers.enable(1); // ice casts shadows too
      l.shadow.normalBias = 0.22; // the polar sun grazes the snow: needs a generous normal bias
      l.shadow.radius = 3;
      l.color.copy(this.sunColor);
    }
    for (const [m, info] of this.materials) this.applyHooks(m, info);
  }

  // Every lit material goes through here: CSM patch first, then shared fog, then the material's own
  // shader hook. `key` gives the program a unique cache key (hooks share source text otherwise).
  register(mat, key, hook) {
    const info = { key, hook };
    this.materials.set(mat, info);
    this.applyHooks(mat, info);
    return mat;
  }

  applyHooks(mat, { key, hook }) {
    if (this.csm) this.csm.setupMaterial(mat);
    else if (mat.defines) { delete mat.defines.USE_CSM; delete mat.defines.CSM_CASCADES; delete mat.defines.CSM_FADE; }
    const csmHook = this.csm ? mat.onBeforeCompile : null;
    mat.onBeforeCompile = (shader, r) => {
      if (csmHook) csmHook.call(mat, shader, r);
      Object.assign(shader.uniforms, FOG);
      if (hook) hook(shader, r);
    };
    const q = this.csm ? `csm${this.csm.cascades}` : 'nocsm';
    mat.customProgramCacheKey = () => `${key}|${q}`;
    mat.needsUpdate = true;
  }

  update(dt, camPos, depthBelow) {
    this.time += dt;
    const p = this.planet;
    // At the pole the sun circles the sky at a nearly constant, low elevation.
    const az = (this.time / p.dayLength) * Math.PI * 2 + 0.6;
    const el = THREE.MathUtils.degToRad(p.sunElevation + Math.sin(this.time / p.dayLength * Math.PI * 2 * 0.5) * 2.5);
    this.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const sunPos = this.sunDir.clone().multiplyScalar(400);
    this.sky.material.uniforms.sunPosition.value.copy(sunPos);
    if (this.sky.material.uniforms.time) this.sky.material.uniforms.time.value = this.time;
    this.sky.position.copy(camPos);
    // warm low sun
    const warm = THREE.MathUtils.clamp(1 - (p.sunElevation - 5) / 30, 0, 1);
    this.sunColor.setRGB(1.0, 0.9 - warm * 0.12, 0.78 - warm * 0.2);
    FOG.uFogSun.value.set(this.sunDir.x, this.sunDir.y, this.sunDir.z, 7);
    FOG.uFogSunColor.value.copy(this.sunColor).multiplyScalar(0.55);

    if (this.csm) {
      this.csm.lightDirection.copy(this.sunDir).negate();
      for (const l of this.csm.lights) { l.color.copy(this.sunColor); l.intensity = this.sunIntensity; }
      this.csm.update();
    }

    // dim sky light deep in the crater (the shaft only lets in a small disc of sky)
    const dim = 1 / (1 + Math.max(0, depthBelow) / 10);
    this.depthDim = dim;
    this.scene.environmentIntensity = 0.12 + 0.88 * dim;

    this.envTimer -= dt;
    if (this.envTimer <= 0 && this.sunDir.angleTo(this.lastEnvSun) > 0.02) {
      this.envTimer = 3;
      this.captureEnv();
    }
  }

  captureEnv() {
    this.lastEnvSun.copy(this.sunDir);
    const u = this.envSky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(400);
    if (u.showSunDisc) u.showSunDisc.value = 0;
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  dispose() {
    if (this.csm) this.csm.dispose();
    if (this.envRT) this.envRT.dispose();
    this.pmrem.dispose();
  }
}
