// Renderer, frame pipeline and post-processing.
//
// Frame: opaque scene -> rtOpaque (colour + depth, mipmapped)
//        ice back faces -> rtBack (depth only, true ice thickness)
//        rtMain = opaque copy + ice (refracting rtOpaque) + water
//        composer: main -> GTAO (from rtMain depth) -> FX (particles, viewmodel) -> bloom
//                  -> output (tone map, sRGB) -> grade (lift/gamma/gain, vignette, grain) -> SMAA
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export const LAYERS = { OPAQUE: 0, ICE: 1, FX: 2, WATER: 3, VIEW: 4, PLANET: 5 };

export const PRESETS = {
  low: { renderScale: 0.7, shadows: { size: 1024, cascades: 2, far: 90 }, ao: false, bloom: false, smaa: false, grain: false, iceQuality: 0, particles: 0.5, fog: true },
  medium: { renderScale: 0.85, shadows: { size: 1024, cascades: 3, far: 140 }, ao: false, bloom: true, smaa: true, grain: true, iceQuality: 1, particles: 0.75, fog: true },
  high: { renderScale: 1, shadows: { size: 2048, cascades: 3, far: 180 }, ao: true, bloom: true, smaa: true, grain: true, iceQuality: 2, particles: 1, fog: true },
  ultra: { renderScale: 1, shadows: { size: 4096, cascades: 4, far: 260 }, ao: true, bloom: true, smaa: true, grain: true, iceQuality: 2, particles: 1.4, fog: true },
};

const COPY_DEPTH = {
  uniforms: { tColor: { value: null }, tDepth: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
  fragmentShader: `uniform sampler2D tColor; uniform sampler2D tDepth; varying vec2 vUv;
    void main(){ gl_FragColor = texture2D( tColor, vUv ); gl_FragDepth = texture2D( tDepth, vUv ).x; }`,
};

const COPY = {
  uniforms: { tColor: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
  fragmentShader: 'uniform sampler2D tColor; varying vec2 vUv; void main(){ gl_FragColor = texture2D( tColor, vUv ); }',
};

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Vector3(0, 0.01, 0.025) },
    uGain: { value: new THREE.Vector3(0.98, 1, 1.04) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1.05 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.28 },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
    uAberration: { value: 0.0012 },
    uFlash: { value: new THREE.Vector4(0, 0, 0, 0) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 uLift, uGain, uGamma; uniform float uSat, uContrast, uVignette, uGrain, uTime, uAberration; uniform vec4 uFlash;
    varying vec2 vUv;
    float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot( c, c );
      vec3 col;
      col.r = texture2D( tDiffuse, vUv - c * uAberration * r2 * 4.0 ).r;
      col.g = texture2D( tDiffuse, vUv ).g;
      col.b = texture2D( tDiffuse, vUv + c * uAberration * r2 * 4.0 ).b;
      col = pow( max( col * uGain + uLift * ( 1.0 - col ), 0.0 ), 1.0 / uGamma );
      float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = mix( vec3( l ), col, uSat );
      col = ( col - 0.5 ) * uContrast + 0.5;
      col *= 1.0 - uVignette * smoothstep( 0.12, 0.75, r2 * 1.6 );
      col += ( hash( vUv * 1024.0 + fract( uTime * 7.31 ) * 97.0 ) - 0.5 ) * uGrain;
      col = mix( col, uFlash.rgb, uFlash.a );
      gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
    }`,
};

class MainScenePass extends Pass {
  constructor(g) {
    super();
    this.g = g;
    // depthTest must stay on for the depth write to happen (WebGL skips depth writes with the test off): always pass it
    this.copyDepth = new FullScreenQuad(new THREE.ShaderMaterial({ ...COPY_DEPTH, uniforms: THREE.UniformsUtils.clone(COPY_DEPTH.uniforms), depthWrite: true, depthTest: true, depthFunc: THREE.AlwaysDepth }));
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...COPY, uniforms: THREE.UniformsUtils.clone(COPY.uniforms), depthWrite: false, depthTest: false }));
    this.backMat = new THREE.MeshDepthMaterial({ side: THREE.BackSide });
  }

  render(renderer, writeBuffer) {
    const g = this.g, scene = g.scene, cam = g.camera;
    if (g.override) {
      // another scene (the planet view) takes the frame
      g.override(renderer, g.rtMain);
      renderer.setRenderTarget(writeBuffer);
      this.copy.material.uniforms.tColor.value = g.rtMain.texture;
      this.copy.render(renderer);
      return;
    }
    const prevLayers = cam.layers.mask;
    renderer.autoClear = false;
    renderer.shadowMap.needsUpdate = true;

    // 1. opaque world
    cam.layers.set(LAYERS.OPAQUE);
    renderer.setRenderTarget(g.rtOpaque);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);

    // 2. ice back faces, depth only
    cam.layers.set(LAYERS.ICE);
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.backMat;
    renderer.setRenderTarget(g.rtBack);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);
    scene.overrideMaterial = null;

    // 3. main: opaque copy with depth, then ice and water on top
    renderer.setRenderTarget(g.rtMain);
    renderer.clear(true, true, false);
    this.copyDepth.material.uniforms.tColor.value = g.rtOpaque.texture;
    this.copyDepth.material.uniforms.tDepth.value = g.rtOpaque.depthTexture;
    this.copyDepth.render(renderer);
    cam.layers.set(LAYERS.ICE);
    renderer.render(scene, cam);
    cam.layers.set(LAYERS.WATER);
    renderer.render(scene, cam);
    scene.background = bg;

    // 4. hand off to the composer
    renderer.setRenderTarget(writeBuffer);
    this.copy.material.uniforms.tColor.value = g.rtMain.texture;
    this.copy.render(renderer);
    cam.layers.mask = prevLayers;
    renderer.autoClear = true;
  }
}

class FXPass extends Pass {
  constructor(g) {
    super();
    this.g = g;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const g = this.g, cam = g.camera;
    if (g.override) return;
    const prev = cam.layers.mask;
    renderer.autoClear = false;
    renderer.setRenderTarget(readBuffer);
    cam.layers.set(LAYERS.FX);
    renderer.render(g.scene, cam);
    // held tool, drawn last with its own depth so it never clips into walls
    renderer.clearDepth();
    g.viewCam.projectionMatrix.copy(cam.projectionMatrix);
    g.viewCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    renderer.render(g.viewScene, g.viewCam);
    cam.layers.mask = prev;
    renderer.autoClear = true;
  }
}

export class Graphics {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
    if (!r.capabilities.isWebGL2) throw new Error('WebGL2 is required');
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.info.autoReset = false;
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, 16 / 9, 0.05, 6000);
    this.camera.layers.enable(LAYERS.ICE);
    this.scene.add(this.camera);
    this.viewScene = new THREE.Scene();
    this.viewCam = new THREE.PerspectiveCamera(settings.fov, 16 / 9, 0.01, 10);
    this.viewScene.add(this.viewCam);

    const mk = (depth, mips) => {
      const rt = new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.HalfFloatType,
        generateMipmaps: !!mips,
        minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
        depthBuffer: true,
      });
      if (depth) {
        rt.depthTexture = new THREE.DepthTexture(4, 4);
        rt.depthTexture.type = THREE.UnsignedIntType;
      }
      return rt;
    };
    this.rtOpaque = mk(true, true);
    this.rtBack = mk(true, false);
    this.rtMain = mk(true, false);

    this.composer = new EffectComposer(r);
    this.mainPass = new MainScenePass(this);
    this.composer.addPass(this.mainPass);
    // AO from the main depth buffer (normals reconstructed from depth), so the scene is not drawn again.
    // Constructed with its own G-buffer first: the addon dereferences it in setGBuffer.
    this.gtao = new GTAOPass(this.scene, this.camera, 4, 4);
    this.gtao.setGBuffer(this.rtMain.depthTexture);
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.gtao.blendIntensity = 0.85;
    this.composer.addPass(this.gtao);
    this.fxPass = new FXPass(this);
    this.composer.addPass(this.fxPass);
    // Any NaN/Inf pixel from a shader would be smeared into black blocks by AO and bloom: scrub them here.
    this.sanitize = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() { vec4 c = texture2D( tDiffuse, vUv );
          if ( any( isnan( c ) ) || any( isinf( c ) ) ) c = vec4( 0.0, 0.0, 0.0, 1.0 );
          gl_FragColor = vec4( clamp( c.rgb, 0.0, 64.0 ), 1.0 ); }`,
    });
    this.composer.addPass(this.sanitize);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);

    this.iceMaterials = new Set();
    this.size = new THREE.Vector2();
    this.flash = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // Materials that sample the opaque buffer (ice, water) get the targets wired in here.
  linkRefractive(mat) {
    this.iceMaterials.add(mat);
    const u = mat.userData.uniforms;
    u.tOpaque.value = this.rtOpaque.texture;
    u.tOpaqueDepth.value = this.rtOpaque.depthTexture;
    if (u.tIceBack) u.tIceBack.value = this.rtBack.depthTexture;
    u.uResolution.value.copy(this.size);
  }

  pixelRatio() {
    return Math.min(devicePixelRatio || 1, 1.5) * this.settings.renderScale;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    const W = Math.max(1, Math.floor(w * pr)), H = Math.max(1, Math.floor(h * pr));
    for (const rt of [this.rtOpaque, this.rtBack, this.rtMain]) rt.setSize(W, H);
    this.gtao.setSize(W, H);
    this.size.set(W, H);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCam.aspect = w / h;
    this.viewCam.updateProjectionMatrix();
    for (const m of this.iceMaterials) m.userData.uniforms.uResolution.value.set(W, H);
  }

  apply(settings) {
    this.settings = settings;
    this.gtao.enabled = settings.ao;
    this.bloom.enabled = settings.bloom;
    this.smaa.enabled = settings.smaa;
    this.grade.enabled = settings.grade;
    this.grade.uniforms.uGrain.value = settings.grain ? 0.03 : 0;
    this.grade.uniforms.uVignette.value = settings.vignette ? 0.3 : 0;
    this.renderer.toneMapping = settings.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    for (const m of this.iceMaterials) if (m.userData.uniforms.uQuality) m.userData.uniforms.uQuality.value = settings.iceQuality;
    this.resize();
  }

  setGrade(g, exposure) {
    const u = this.grade.uniforms;
    u.uLift.value.set(...g.lift);
    u.uGain.value.set(...g.gain);
    u.uSat.value = g.sat;
    u.uContrast.value = g.contrast;
    this.renderer.toneMappingExposure = exposure;
  }

  render(dt, time) {
    this.grade.uniforms.uTime.value = time;
    this.gtao.enabled = this.settings.ao && !this.override;
    this.grade.uniforms.uFlash.value.w = this.flash;
    const n = this.camera.near, f = this.camera.far;
    for (const m of this.iceMaterials) {
      m.userData.uniforms.uNearFar.value.set(n, f);
      if (m.userData.uniforms.uTime) m.userData.uniforms.uTime.value = time;
    }
    this.renderer.info.reset();
    this.composer.render(dt);
  }

  info() {
    const i = this.renderer.info;
    return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures };
  }
}
