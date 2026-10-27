// The ice sheet beyond the dig domain: square rings of snow out to the horizon ridges,
// and the survey stake line that marks the crater claim.
import * as THREE from 'three';
import { HALF, surfaceY } from './field.js';

export function buildTerrain(atmo) {
  const SEG = 512;          // vertices around each square ring
  const rings = [];
  let s = HALF - 1.0;       // overlap the untouched margin of the volume
  while (s < 3400) { rings.push(s); s += Math.max(0.6, (s - HALF + 1) * 0.075); }
  const pos = new Float32Array(rings.length * SEG * 3);
  const idx = [];
  for (let r = 0; r < rings.length; r++) {
    const h = rings[r];
    for (let i = 0; i < SEG; i++) {
      // walk the square perimeter uniformly
      const t = (i / SEG) * 4;
      const side = Math.floor(t), f = t - side;
      let x, z;
      if (side === 0) { x = -h + 2 * h * f; z = -h; }
      else if (side === 1) { x = h; z = -h + 2 * h * f; }
      else if (side === 2) { x = h - 2 * h * f; z = h; }
      else { x = -h; z = h - 2 * h * f; }
      const o = (r * SEG + i) * 3;
      pos[o] = x; pos[o + 1] = surfaceY(x, z) - (r < 3 ? 0.03 : 0); pos[o + 2] = z;
    }
  }
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < SEG; i++) {
    const a = r * SEG + i, b = r * SEG + ((i + 1) % SEG), c = (r + 1) * SEG + i, d = (r + 1) * SEG + ((i + 1) % SEG);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(SEG * 2) < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }

  const mat = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.82, metalness: 0, envMapIntensity: 0.9 });
  atmo.register(mat, 'snow', (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowW;\nvarying vec3 vSnowN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvSnowW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvSnowN = normalize( mat3( modelMatrix ) * objectNormal );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSnowW;
        varying vec3 vSnowN;
        float sh31( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
        float svn( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( sh31( i ), sh31( i + vec3( 1, 0, 0 ) ), f.x ), mix( sh31( i + vec3( 0, 1, 0 ) ), sh31( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( sh31( i + vec3( 0, 0, 1 ) ), sh31( i + vec3( 1, 0, 1 ) ), f.x ), mix( sh31( i + vec3( 0, 1, 1 ) ), sh31( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // exposed granite on the steep faces of the far ridges, with snow caught on the ledges
          float steep = 1.0 - normalize( vSnowN ).y;
          float ledge = svn( vSnowW * vec3( 0.05, 0.3, 0.05 ) );
          float rock = smoothstep( 0.32, 0.5, steep + ( ledge - 0.5 ) * 0.25 ) * smoothstep( 25.0, 60.0, vSnowW.y );
          vec3 granite = mix( vec3( 0.16, 0.16, 0.17 ), vec3( 0.3, 0.28, 0.27 ), svn( vSnowW * 0.08 ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, granite, rock );
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // wind-carved ripples, finer near the viewer
          vec3 p = vSnowW * vec3( 0.9, 0.0, 2.6 );
          float e = 0.05;
          float b0 = svn( p ) + 0.5 * svn( p * 3.1 );
          float bx = svn( p + vec3( e, 0, 0 ) ) + 0.5 * svn( ( p + vec3( e, 0, 0 ) ) * 3.1 );
          float bz = svn( p + vec3( 0, 0, e ) ) + 0.5 * svn( ( p + vec3( 0, 0, e ) ) * 3.1 );
          float fade = 1.0 / ( 1.0 + length( vViewPosition ) * 0.04 );
          vec3 bw = vec3( -( bx - b0 ) / e, 0.0, -( bz - b0 ) / e ) * 0.08 * fade;
          normal = normalize( normal + mat3( viewMatrix ) * bw );
        }`)
      .replace('#include <opaque_fragment>', `
        {
          // sun glints in the snow
          vec3 wV = normalize( cameraPosition - vSnowW );
          float g = step( 0.993, sh31( floor( vSnowW * 45.0 ) ) );
          float tw = step( 0.6, sh31( floor( vSnowW * 45.0 ) + floor( wV * 30.0 ) ) );
          outgoingLight += vec3( 1.0, 0.92, 0.8 ) * g * tw * 3.5 * ( totalDiffuse.r > 0.25 ? 1.0 : 0.15 ) / ( 1.0 + length( vViewPosition ) * 0.05 );
          // cold blue in shade
          float lum = dot( totalDiffuse, vec3( 0.333 ) );
          outgoingLight *= mix( vec3( 0.86, 0.94, 1.08 ), vec3( 1.0 ), smoothstep( 0.1, 0.6, lum ) );
        }
        #include <opaque_fragment>`);
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain';
  mesh.frustumCulled = false;
  return mesh;
}

// Orange-flagged survey stakes around the claim.
export function buildStakes(atmo) {
  const group = new THREE.Group();
  const poleMat = atmo.register(new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.5, metalness: 0.6 }), 'stakePole');
  const flagMat = atmo.register(new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x3a0d00 }), 'stakeFlag');
  const pole = new THREE.CylinderGeometry(0.025, 0.03, 1.8, 6);
  pole.translate(0, 0.9, 0);
  const flag = new THREE.PlaneGeometry(0.34, 0.2, 4, 1);
  flag.translate(0.17, 1.65, 0);
  const n = 28;
  const poles = new THREE.InstancedMesh(pole, poleMat, n);
  const flags = new THREE.InstancedMesh(flag, flagMat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 4, side = Math.floor(t), f = t - side, h = HALF + 3.5;
    const pts = [[-h + 2 * h * f, -h], [h, -h + 2 * h * f], [h - 2 * h * f, h], [-h, h - 2 * h * f]];
    const [x, z] = pts[side];
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4 + (i % 3) * 0.1);
    m.compose(new THREE.Vector3(x, surfaceY(x, z) - 0.1, z), q, new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m);
    flags.setMatrixAt(i, m);
  }
  poles.castShadow = flags.castShadow = true;
  poles.receiveShadow = flags.receiveShadow = true;
  group.add(poles, flags);
  group.userData.flags = flags;
  return group;
}
