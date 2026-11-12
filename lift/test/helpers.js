import { CFG, roomSide } from '../src/config.js';
import * as Game from '../src/game.js';

// Sweep a room in a lawnmower pattern at a given tool speed until it is cleared and polished.
// Returns seconds taken (or Infinity past the limit).
export function sweepRoom(s, f, x, z, { speedMult = 1, limit = 300, dt = 1 / 30, onEvent } = {}) {
  const S = roomSide(f);
  const R = Game.toolRadius(s.player);
  const v = Game.walkSpeed(f) * 0.8 * speedMult;
  const r = Game.room(s, f, x, z);
  const lane = R * 1.5;
  let t = 0, lx = -S / 2 + R * 0.6, lz = -S / 2 + R * 0.6, dir = 1, pass = 0;
  const step = () => {
    lx += dir * v * dt;
    if (lx > S / 2 - R * 0.6 || lx < -S / 2 + R * 0.6) {
      dir = -dir; lx = Math.max(-S / 2 + R * 0.6, Math.min(S / 2 - R * 0.6, lx));
      const maxZ = S / 2 - R * 0.6;
      if (lz >= maxZ - 1e-6) { lz = -S / 2 + R * 0.6; pass++; } else lz = Math.min(maxZ, lz + lane);
      t += lane / v;
    }
  };
  while (t < limit && !(r.clearedDone && r.polishedDone)) {
    const ev = Game.toolStep(s, f, x, z, lx, lz, dt);
    if (onEvent && ev) onEvent(ev, t);
    // the player lingers a little while something is under the tool
    if (!ev || ev.mode === 'idle' || (ev.mode === 'clear' && ev.units < 0.02) || (ev.mode === 'polish' && ev.polished < 0.02)) step();
    else if (ev.mode === 'clear' || ev.mode === 'polish') { step(); }
    t += dt;
  }
  return r.clearedDone && r.polishedDone ? t : Infinity;
}
