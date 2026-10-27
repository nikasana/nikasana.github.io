// Height and depth fog with sun in-scatter, shared by every material through onBeforeCompile.
import * as THREE from 'three';

export const FOG = {
  uFogParams: { value: new THREE.Vector4(0.0011, 0.004, 0.0, 0.012) }, // density, height falloff, base height, crater mist
  uFogSun: { value: new THREE.Vector4(0, 0.3, -1, 6) },                // sun dir, in-scatter power
  uFogSunColor: { value: new THREE.Color(1.0, 0.78, 0.55) },
  uFogDeep: { value: new THREE.Color(0.02, 0.07, 0.11) },              // mist colour deep in the crater
  uFogSurfaceY: { value: 0 },
};

const PARS_V = `
#ifdef USE_FOG
  varying vec3 vFogWorld;
#endif
`;
const VERT = `
#ifdef USE_FOG
  {
    vec4 fw = vec4( transformed, 1.0 );
    #ifdef USE_BATCHING
      fw = batchingMatrix * fw;
    #endif
    #ifdef USE_INSTANCING
      fw = instanceMatrix * fw;
    #endif
    vFogWorld = ( modelMatrix * fw ).xyz;
  }
#endif
`;
const PARS_F = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogWorld;
  uniform vec4 uFogParams;
  uniform vec4 uFogSun;
  uniform vec3 uFogSunColor;
  uniform vec3 uFogDeep;
  uniform float uFogSurfaceY;
  vec3 applyFog( vec3 col ) {
    vec3 ray = vFogWorld - cameraPosition;
    float dist = length( ray );
    vec3 dir = ray / max( dist, 1e-4 );
    // exponential height fog, integrated along the ray
    float b = uFogParams.y;
    float h0 = cameraPosition.y - uFogParams.z;
    float dy = ray.y;
    float k = abs( dy ) > 1e-3 ? ( 1.0 - exp( -b * dy ) ) / ( b * dy ) : 1.0;
    float fogAmt = 1.0 - exp( -uFogParams.x * exp( -b * max( h0, -40.0 ) ) * k * dist );
    // cold mist inside the crater, thicker the deeper the ray goes
    float below = clamp( ( uFogSurfaceY - min( cameraPosition.y, vFogWorld.y ) ) / 120.0, 0.0, 1.0 );
    float mist = 1.0 - exp( -uFogParams.w * below * dist );
    float sun = pow( max( dot( dir, normalize( uFogSun.xyz ) ), 0.0 ), uFogSun.w );
    vec3 fc = fogColor + uFogSunColor * sun * 0.9;
    col = mix( col, fc, clamp( fogAmt, 0.0, 1.0 ) );
    col = mix( col, uFogDeep, clamp( mist, 0.0, 0.92 ) );
    return col;
  }
#endif
`;
const FRAG = `
#ifdef USE_FOG
  gl_FragColor.rgb = applyFog( gl_FragColor.rgb );
#endif
`;

let installed = false;
export function installFog() {
  if (installed) return;
  installed = true;
  THREE.ShaderChunk.fog_pars_vertex = PARS_V;
  THREE.ShaderChunk.fog_vertex = VERT;
  THREE.ShaderChunk.fog_pars_fragment = PARS_F;
  THREE.ShaderChunk.fog_fragment = FRAG;
}

// Attach the shared fog uniforms to an unlit material. `key` keeps its shader program unique.
export function withFog(mat, key, extra) {
  mat.onBeforeCompile = (shader, r) => {
    Object.assign(shader.uniforms, FOG);
    if (extra) extra(shader, r);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
