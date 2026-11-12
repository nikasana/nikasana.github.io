// Pure player collision against room walls, doorways and props.
import { CFG, doorWidth } from './config.js';

// sides: 0 = north (-z), 1 = east (+x), 2 = south (+z), 3 = west (-x)
export const SIDE_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function roomOf(px, pz, S) { return [Math.round(px / S), Math.round(pz / S)]; }

function pushOut(p, r, x0, z0, x1, z1) {
  const cx = Math.max(x0, Math.min(p.x, x1)), cz = Math.max(z0, Math.min(p.z, z1));
  const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
  else {
    // centre inside the box: push along the shallowest axis
    const l = p.x - x0 + r, rr = x1 - p.x + r, t = p.z - z0 + r, b = z1 - p.z + r, m = Math.min(l, rr, t, b);
    if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r;
  }
  return true;
}

// blocked(rx, rz, side) -> true if that doorway is shut. props(rx, rz) -> [{x,z,w,d}] in room-local metres.
export function collide(p, S, blocked, props) {
  const r = CFG.player.radius, T = CFG.room.wallT / 2, dw = doorWidth(S) / 2;
  for (let pass = 0; pass < 2; pass++) {
    const [rx, rz] = roomOf(p.x, p.z, S);
    const cx = rx * S, cz = rz * S, h = S / 2;
    for (let side = 0; side < 4; side++) {
      const shut = blocked(rx, rz, side);
      const horiz = side === 0 || side === 2;
      const line = side === 0 ? cz - h : side === 2 ? cz + h : side === 1 ? cx + h : cx - h;
      if (horiz) {
        pushOut(p, r, cx - h - T, line - T, cx - dw, line + T);
        pushOut(p, r, cx + dw, line - T, cx + h + T, line + T);
        if (shut) pushOut(p, r, cx - dw, line - T, cx + dw, line + T);
      } else {
        pushOut(p, r, line - T, cz - h - T, line + T, cz - dw);
        pushOut(p, r, line - T, cz + dw, line + T, cz + h + T);
        if (shut) pushOut(p, r, line - T, cz - dw, line + T, cz + dw);
      }
    }
    if (props) for (const q of props(rx, rz)) pushOut(p, r, cx + q.x - q.w / 2, cz + q.z - q.d / 2, cx + q.x + q.w / 2, cz + q.z + q.d / 2);
  }
  return p;
}
