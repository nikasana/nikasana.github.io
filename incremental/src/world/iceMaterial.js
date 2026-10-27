// The ice: a physically lit surface over a refractive, absorbing, scattering body.
// Lighting is evaluated for a white Lambertian surface (so sun, CSM shadows and IBL all count),
// then the ice body is composed from the refracted scene behind it, Beer-Lambert absorption by
// true thickness, strata-tinted in-scatter, internal bubbles and fractures, frost, wetness and heat.
import * as THREE from 'three';

export const MAX_HEAT = 8;
export const MAX_CRACK = 10;
export const MAX_STRATA = 8;

export function createIceMaterial() {
  // Standard (not Physical) PBR: the physical variant's indirect specular produced NaNs on some
  // GL backends, and ice's F0 (0.018) is close enough to the standard 0.04.
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.14, metalness: 0, envMapIntensity: 0.85 });
  const u = {
    tOpaque: { value: null },
    tOpaqueDepth: { value: null },
    tIceBack: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNearFar: { value: new THREE.Vector2(0.05, 6000) },
    uAbsorb: { value: new THREE.Vector3(0.62, 0.2, 0.11) },
    uTime: { value: 0 },
    uHeat: { value: Array.from({ length: MAX_HEAT }, () => new THREE.Vector4(0, -1e5, 0, 0)) },
    uHeatI: { value: new Float32Array(MAX_HEAT) },
    uCrack: { value: Array.from({ length: MAX_CRACK }, () => new THREE.Vector4(0, -1e5, 0, 0)) },
    uCrackA: { value: new Float32Array(MAX_CRACK) },
    uStrataY: { value: new Float32Array(MAX_STRATA).fill(-1e5) },
    uStrataCol: { value: Array.from({ length: MAX_STRATA }, () => new THREE.Color(0.6, 0.85, 0.95)) },
    uStrataHard: { value: new Float32Array(MAX_STRATA).fill(1) },
    uSunDirW: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, 0.9, 0.8) },
    uGradient: { value: 0.35 },
    uSurfaceY: { value: 0 },
    uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },
    uLampDir: { value: new THREE.Vector3(0, 0, -1) },
    uQuality: { value: 2 },
    uDebug: { value: 0 },
  };
  mat.userData.uniforms = u;
  mat.userData.hook = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 iceAttr;
        varying vec2 vIce;
        varying vec3 vWPos;
        varying vec3 vWNrm;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vIce = iceAttr;
        vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        vWNrm = normalize( mat3( modelMatrix ) * objectNormal );`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        ${ICE_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        IceState ice = iceState();
        diffuseColor.rgb = vec3( 1.0 );`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.035, ice.wet );
        roughnessFactor = mix( roughnessFactor, 0.55, ice.frost );
        roughnessFactor = mix( roughnessFactor, 0.85, ice.snow );
        roughnessFactor = mix( roughnessFactor, 0.6, ice.crack );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize( normal + mat3( viewMatrix ) * iceBump( ice ) );`)
      .replace('#include <opaque_fragment>', `${ICE_COMPOSE}
        #include <opaque_fragment>`);
  };
  return mat;
}

const ICE_PARS = /* glsl */`
uniform sampler2D tOpaque;
uniform sampler2D tOpaqueDepth;
uniform sampler2D tIceBack;
uniform vec2 uResolution;
uniform vec2 uNearFar;
uniform vec3 uAbsorb;
uniform float uTime;
uniform vec4 uHeat[ ${MAX_HEAT} ];
uniform float uHeatI[ ${MAX_HEAT} ];
uniform vec4 uCrack[ ${MAX_CRACK} ];
uniform float uCrackA[ ${MAX_CRACK} ];
uniform float uStrataY[ ${MAX_STRATA} ];
uniform vec3 uStrataCol[ ${MAX_STRATA} ];
uniform float uStrataHard[ ${MAX_STRATA} ];
uniform vec3 uSunDirW;
uniform vec3 uSunCol;
uniform float uGradient;
uniform float uSurfaceY;
uniform vec4 uLamp;
uniform vec3 uLampDir;
uniform float uQuality;
uniform float uDebug;
varying vec2 vIce;
varying vec3 vWPos;
varying vec3 vWNrm;

float h31( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
vec3 h33( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.xxy + p.yxx ) * p.zyx ); }
float vn( vec3 p ) {
  vec3 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( h31( i ), h31( i + vec3( 1, 0, 0 ) ), f.x ), mix( h31( i + vec3( 0, 1, 0 ) ), h31( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( h31( i + vec3( 0, 0, 1 ) ), h31( i + vec3( 1, 0, 1 ) ), f.x ), mix( h31( i + vec3( 0, 1, 1 ) ), h31( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
float fbm3( vec3 p ) { return vn( p ) * 0.55 + vn( p * 2.03 + 7.1 ) * 0.3 + vn( p * 4.11 - 3.3 ) * 0.15; }

// distance to the nearest Voronoi edge (fracture lines)
float voroEdge( vec3 p ) {
  vec3 i = floor( p ), f = fract( p );
  float d1 = 9.0, d2 = 9.0;
  for ( int z = -1; z <= 1; z ++ ) for ( int y = -1; y <= 1; y ++ ) for ( int x = -1; x <= 1; x ++ ) {
    vec3 g = vec3( x, y, z );
    vec3 o = h33( i + g );
    float d = length( g + o - f );
    if ( d < d1 ) { d2 = d1; d1 = d; } else if ( d < d2 ) d2 = d;
  }
  return d2 - d1;
}

float linDepth( float d ) {
  float n = uNearFar.x, f = uNearFar.y;
  float z = d * 2.0 - 1.0;
  return 2.0 * n * f / ( f + n - z * ( f - n ) );
}

struct IceState { float snow; float frost; float wet; float heat; float crack; float crackLine; float depth; vec3 strata; float hard; float rich; float cav; };

vec3 strataAt( float y, out float hard ) {
  float depth = uSurfaceY - y;
  // wobble the boundaries so layers read as natural deposits
  float wob = ( fbm3( vWPos * vec3( 0.07, 0.0, 0.07 ) ) - 0.5 ) * 3.0;
  vec3 col = uStrataCol[ 0 ];
  hard = uStrataHard[ 0 ];
  for ( int i = 1; i < ${MAX_STRATA}; i ++ ) {
    float t = smoothstep( uStrataY[ i ] - 0.6, uStrataY[ i ] + 0.6, depth + wob );
    col = mix( col, uStrataCol[ i ], t );
    hard = mix( hard, uStrataHard[ i ], t );
  }
  // fine annual bands and thin dust lines
  float band = sin( ( depth + wob * 0.3 ) * 7.0 + fbm3( vWPos * 0.4 ) * 4.0 ) * 0.5 + 0.5;
  col *= 0.93 + 0.07 * band;
  float dust = smoothstep( 0.965, 1.0, sin( ( depth + wob * 0.2 ) * 1.37 + 1.3 ) * 0.5 + 0.5 );
  col = mix( col, vec3( 0.32, 0.36, 0.4 ), dust * 0.55 * step( 1.5, depth ) );
  return col;
}

IceState iceState() {
  IceState s;
  vec3 n = normalize( vWNrm );
  s.depth = uSurfaceY - vWPos.y;
  s.rich = vIce.x;
  s.cav = vIce.y;
  s.strata = strataAt( vWPos.y, s.hard );
  // heat: wet sheen and glow around active melt points
  float wet = 0.0, heat = 0.0;
  for ( int i = 0; i < ${MAX_HEAT}; i ++ ) {
    vec4 h = uHeat[ i ];
    if ( h.w <= 0.0 ) continue;
    float d = length( vWPos - h.xyz );
    if ( d > h.w * 3.0 ) continue;
    float k = 1.0 - smoothstep( h.w * 0.35, h.w * 1.6, d );
    wet = max( wet, k * ( 0.35 + 0.65 * clamp( uHeatI[ i ] + 0.4, 0.0, 1.0 ) ) );
    // glow on the edge of the melt, plus drips running down walls below the point
    float rim = ( 1.0 - smoothstep( h.w * 0.7, h.w * 1.25, d ) ) * smoothstep( h.w * 0.2, h.w * 0.75, d );
    float below = clamp( ( h.y - vWPos.y ) / ( h.w * 2.5 ), 0.0, 1.0 ) * ( 1.0 - abs( n.y ) );
    float drip = smoothstep( 0.72, 0.95, vn( vec3( vWPos.x * 9.0, vWPos.y * 1.2 + uTime * 1.6, vWPos.z * 9.0 ) ) ) * below * ( 1.0 - smoothstep( h.w * 0.8, h.w * 2.2, length( vWPos.xz - h.xz ) ) );
    heat = max( heat, uHeatI[ i ] * ( rim + drip * 0.6 ) );
    wet = max( wet, drip * 0.8 * clamp( uHeatI[ i ] + 0.5, 0.0, 1.0 ) );
  }
  s.wet = clamp( wet, 0.0, 1.0 );
  s.heat = heat;
  // fresh fractures where the pick bit in
  float crack = 0.0, line = 0.0;
  for ( int i = 0; i < ${MAX_CRACK}; i ++ ) {
    vec4 c = uCrack[ i ];
    if ( c.w <= 0.0 ) continue;
    float d = length( vWPos - c.xyz );
    if ( d > c.w * 1.6 ) continue;
    float k = ( 1.0 - smoothstep( c.w * 0.5, c.w * 1.6, d ) ) * uCrackA[ i ];
    float e = voroEdge( ( vWPos - c.xyz ) * ( 2.4 / max( c.w, 0.2 ) ) + float( i ) * 3.1 );
    line = max( line, k * ( 1.0 - smoothstep( 0.0, 0.07, e ) ) );
    crack = max( crack, k * 0.6 );
  }
  s.crack = crack;
  s.crackLine = line;
  // snow on the original surface, frost on cold up-facing ice
  float top = smoothstep( -0.75, -0.15, vWPos.y - uSurfaceY );
  s.snow = clamp( top * smoothstep( 0.2, 0.7, n.y ) + top * 0.35, 0.0, 1.0 ) * ( 1.0 - s.wet );
  float fr = smoothstep( 0.45, 0.95, n.y ) * smoothstep( 0.35, 0.75, fbm3( vWPos * 1.7 ) );
  fr += 0.22 * smoothstep( 0.55, 0.85, fbm3( vWPos * 3.1 + 5.0 ) );
  s.frost = clamp( fr, 0.0, 1.0 ) * ( 1.0 - s.wet ) * ( 1.0 - s.snow ) * ( 1.0 - crack );
  return s;
}

// Small-scale surface relief: melt scallops on walls, crunchy chips where dug, granular snow.
vec3 iceBump( IceState s ) {
  vec3 p = vWPos;
  float e = 0.06;
  float sc = 1.6;
  float b0 = fbm3( p * sc );
  vec3 g = vec3( fbm3( ( p + vec3( e, 0, 0 ) ) * sc ) - b0, fbm3( ( p + vec3( 0, e, 0 ) ) * sc ) - b0, fbm3( ( p + vec3( 0, 0, e ) ) * sc ) - b0 ) / e;
  float amt = 0.06 + 0.18 * s.crack - 0.03 * s.snow - 0.05 * s.wet;
  return -g * amt;
}
`;

const ICE_COMPOSE = /* glsl */`
{
  vec3 litW = totalDiffuse;                  // irradiance seen by a white Lambert surface
  vec3 spec = totalSpecular;
  if ( any( isnan( spec ) ) || any( isinf( spec ) ) ) spec = vec3( 0.0 );
  vec3 V = normalize( vViewPosition );       // view-space, from surface to eye
  vec3 nV = normalize( normal );
  vec3 wN = normalize( vWNrm );
  vec3 wV = normalize( cameraPosition - vWPos );

  vec2 suv = gl_FragCoord.xy / uResolution;
  float zf = -vViewPosition.z;
  float zo = linDepth( texture2D( tOpaqueDepth, suv ).x );
  float zb = linDepth( texture2D( tIceBack, suv ).x );
  float t0 = max( min( zo, zb ) - zf, 0.0 );
  // refract: bend the lookup toward the surface normal, more for thicker ice
  vec2 off = nV.xy * ( 0.035 + 0.02 * ice.crack ) * clamp( t0, 0.0, 2.0 );
  vec2 ruv = clamp( suv - off, vec2( 0.001 ), vec2( 0.999 ) );
  float zo2 = linDepth( texture2D( tOpaqueDepth, ruv ).x );
  float zb2 = linDepth( texture2D( tIceBack, ruv ).x );
  if ( min( zo2, zb2 ) < zf ) { ruv = suv; zo2 = zo; zb2 = zb; }
  float pathScale = length( vViewPosition ) / max( zf, 1e-3 );
  float thick = max( min( zo2, zb2 ) - zf, 0.0 ) * pathScale;
  thick = min( thick, 60.0 );

  float density = mix( 0.7, 1.35, clamp( ( ice.hard - 0.7 ) / 0.7, 0.0, 1.0 ) );
  vec3 T = exp( -uAbsorb * thick * density );
  float lod = clamp( log2( 1.0 + thick * 1.6 ) * 1.2, 0.0, 6.0 );   // thin ice stays clear enough to see coins in it
  vec3 behind = texture2DLodEXT( tOpaque, ruv, lod ).rgb;
  // one bad pixel behind the ice would spread through the blurred mips into a black block
  if ( any( isnan( behind ) ) || any( isinf( behind ) ) ) behind = texture2DLodEXT( tOpaque, ruv, 0.0 ).rgb;
  if ( any( isnan( behind ) ) || any( isinf( behind ) ) ) behind = litW * 0.3;
  behind = min( behind, vec3( 64.0 ) );

  // in-scatter: the ice body glows with the light it has absorbed, tinted by its strata
  vec3 tint = ice.strata;
  tint = mix( tint, tint * vec3( 0.78, 1.05, 1.12 ), ice.rich * uGradient );   // rich ice reads a touch deeper and greener
  float glowDeep = exp( -max( ice.depth, 0.0 ) / 90.0 );
  vec3 amb = litW * 0.55 + vec3( 0.015, 0.05, 0.08 ) * glowDeep;
  // light scattered back out of the ice has travelled through it: it carries the absorption colour
  vec3 bodyTint = tint * exp( -uAbsorb * 1.8 ) * 1.35;
  vec3 inscatter = bodyTint * amb * ( 1.0 - T ) * ( 1.0 - ice.cav * 0.45 );
  // light shining through thin ice toward the viewer
  float back = pow( clamp( dot( -wV, normalize( uSunDirW ) ), 0.0, 1.0 ), 5.0 );
  inscatter += uSunCol * tint * back * exp( -thick * 0.45 ) * 0.9 * glowDeep;

  // bubbles and fracture sheets frozen inside, sampled along the refracted ray
  vec3 rd = refract( -wV, wN, 1.0 / 1.31 );
  vec3 inside = vec3( 0.0 );
  if ( uQuality > 0.5 ) {
    for ( int i = 0; i < 5; i ++ ) {
      float d = 0.12 + float( i * i ) * 0.16;
      if ( d > thick ) break;
      vec3 p = vWPos + rd * d;
      // fine bubble trains, denser in bands
      float bub = smoothstep( 0.955, 0.985, vn( p * 16.0 + 13.0 ) ) * smoothstep( 0.45, 0.75, vn( p * vec3( 0.5, 1.6, 0.5 ) ) );
      // rare, thin fracture planes
      float mask = smoothstep( 0.72, 0.85, vn( p * 0.35 + 4.0 ) );
      float sheet = ( 1.0 - smoothstep( 0.0, 0.012, abs( vn( p * vec3( 0.7, 1.9, 0.7 ) ) - 0.5 ) ) ) * mask * 0.35;
      vec3 att = exp( -uAbsorb * d * density );
      inside += ( bub * 0.45 + sheet ) * att * ( litW * 0.7 + 0.02 );
    }
  }
  // the lamp lights the inside of the ice in a soft cone
  vec3 lampTerm = vec3( 0.0 );
  if ( uLamp.w > 0.0 ) {
    vec3 L = vWPos - uLamp.xyz;
    float dl = length( L );
    float cone = smoothstep( 0.82, 0.97, dot( L / dl, uLampDir ) );
    lampTerm = vec3( 0.75, 0.92, 1.0 ) * uLamp.w * cone / ( 1.0 + dl * dl * 0.08 );
    inscatter += tint * lampTerm * ( 1.0 - T ) * 0.6;
  }

  vec3 body = behind * T + inscatter + inside;

  // fresnel split between reflection (already in spec) and transmission
  float cosv = clamp( dot( nV, V ), 0.0, 1.0 );
  float F = 0.018 + 0.982 * pow( 1.0 - cosv, 5.0 );
  vec3 col = body * ( 1.0 - F );

  // frost, snow and crushed ice are opaque scatterers
  // match the outer snowfield's shading (terrain.js): bright in sun, cold blue in shade
  float lumS = dot( litW, vec3( 0.333 ) );
  vec3 snowCol = litW * vec3( 0.96, 0.975, 0.99 ) * mix( vec3( 0.86, 0.94, 1.08 ), vec3( 1.0 ), smoothstep( 0.1, 0.6, lumS ) ) + lampTerm * 0.6;
  float glint = step( 0.992, h31( floor( vWPos * 55.0 ) ) ) * pow( clamp( dot( reflect( -wV, wN ), normalize( uSunDirW ) ), 0.0, 1.0 ), 6.0 );
  snowCol += uSunCol * glint * 6.0 * ( ice.snow + ice.frost );
  col = mix( col, snowCol * 0.92, ice.frost * 0.75 );
  col = mix( col, snowCol, ice.snow );
  col = mix( col, litW * vec3( 0.86, 0.94, 0.98 ) + lampTerm * 0.5, ice.crack * 0.55 );
  col = mix( col, litW * 1.15 + 0.03, ice.crackLine * 0.8 );
  col *= 1.0 - ice.cav * 0.35 * ( 1.0 - ice.snow );

  // the glowing, softening edge of a melt
  col += vec3( 1.0, 0.42, 0.12 ) * ice.heat * 2.4;

  // pit walls cannot see the open sky: occlude reflections with depth and cavity
  float specOcc = mix( 1.0, 0.15, smoothstep( 0.3, 4.0, ice.depth ) ) * ( 1.0 - smoothstep( 0.35, 0.8, ice.cav ) * 0.8 );
  outgoingLight = col + spec * specOcc * ( 1.0 - ice.snow * 0.35 );
  if ( any( isnan( outgoingLight ) ) || any( isinf( outgoingLight ) ) ) outgoingLight = vec3( 0.0 );
  outgoingLight = clamp( outgoingLight, 0.0, 64.0 );
  if ( uDebug > 0.5 ) {
    if ( uDebug < 1.5 ) outgoingLight = vec3( 1.0, 0.0, 0.0 );
    else if ( uDebug < 2.5 ) outgoingLight = litW;
    else if ( uDebug < 3.5 ) outgoingLight = vec3( thick * 0.1 );
    else if ( uDebug < 4.5 ) outgoingLight = behind;
    else if ( uDebug < 5.5 ) outgoingLight = ice.strata;
    else if ( uDebug < 6.5 ) outgoingLight = vec3( ice.snow, ice.frost, ice.wet );
    else if ( uDebug < 7.5 ) outgoingLight = spec;
    else if ( uDebug < 8.5 ) outgoingLight = reflectedLight.directSpecular;
    else if ( uDebug < 9.5 ) outgoingLight = reflectedLight.indirectSpecular;
    else if ( uDebug < 10.5 ) outgoingLight = normal * 0.5 + 0.5;
    else if ( uDebug < 11.5 ) outgoingLight = vec3( roughnessFactor );
    else if ( uDebug < 12.5 ) outgoingLight = col;
    else if ( uDebug < 13.5 ) outgoingLight = body;
    else if ( uDebug < 14.5 ) outgoingLight = inside;
    else if ( uDebug < 15.5 ) outgoingLight = inscatter;
    else outgoingLight = snowCol;
  }
}
`;
