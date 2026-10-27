// Cinderice: lava pockets under the ice and hidden heat veins.
// Pockets glow through the ice (they share the shader's pocket slots with mutant ice). Melting near one
// is faster but builds heat; too much heat and the lava bursts. Veins are winding hot lines through the
// ice: melting along one builds a combo (Heat Vein Mini-Hunt).
import { rng, hash32 } from '../core/rng.js';

export const LAVA_COLOR = [1.0, 0.38, 0.08];

export class Lava {
  constructor() { this.pockets = []; this.veins = []; }

  setup(planet, pole, surfaceY) {
    this.pockets = []; this.veins = [];
    const L = planet.lava;
    if (!L) return;
    const r = rng(hash32(planet.seed, pole === 'N' ? 11 : 12, 4242));
    const from = pole === 'N' ? L.from : L.from * 2;
    for (let i = 0; i < L.pockets; i++) {
      const a = r() * Math.PI * 2, d = 4 + Math.sqrt(r()) * 140;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const depth = from + Math.pow(r(), 1.3) * 120;
      this.pockets.push({ x, y: surfaceY(x, z) - depth, z, r: 1.4 + r() * 1.6, type: 'lava' });
    }
    for (let v = 0; v < L.veins; v++) {
      const pts = [];
      const a = r() * Math.PI * 2, d = 3 + r() * 40;
      let x = Math.cos(a) * d, z = Math.sin(a) * d, y = surfaceY(x, z) - (3 + r() * 12);
      let hx = r() * 2 - 1, hz = r() * 2 - 1;
      for (let k = 0; k < 14; k++) {
        pts.push([x, y, z]);
        hx += (r() - 0.5) * 0.8; hz += (r() - 0.5) * 0.8;
        const hl = Math.hypot(hx, hz) || 1;
        x += (hx / hl) * 2.2; z += (hz / hl) * 2.2; y -= 0.6 + r() * 1.6;
      }
      this.veins.push(pts);
    }
  }

  // nearest lava pocket and how close (0 at the edge of its heat, 1 inside it)
  heatAt(p, reach = 3) {
    let best = 0, pocket = null;
    for (const k of this.pockets) {
      const d = Math.hypot(k.x - p.x, k.y - p.y, k.z - p.z);
      const h = 1 - (d - k.r) / reach;
      if (h > best) { best = Math.min(1, h); pocket = k; }
    }
    return { heat: Math.max(0, best), pocket };
  }

  // distance from a point to the nearest heat vein
  veinDistance(p) {
    let best = Infinity;
    for (const pts of this.veins) for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(p, pts[i], pts[i + 1]));
    return best;
  }

  // a few points on veins near a position (for ember sparks)
  veinPointsNear(p, range, n, rand) {
    const out = [];
    for (const pts of this.veins) for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.hypot(a[0] - p.x, a[1] - p.y, a[2] - p.z) > range + 3) continue;
      const t = rand();
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      if (out.length >= n) return out;
    }
    return out;
  }
}

function segDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const apx = p.x - a[0], apy = p.y - a[1], apz = p.z - a[2];
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz || 1)));
  return Math.hypot(apx - abx * t, apy - aby * t, apz - abz * t);
}
