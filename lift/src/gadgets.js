// Pure gadget effects. Each biome's material buys one consumable in the lift.
import * as Game from './game.js';
import { roomSide } from './config.js';
import { roomOf } from './movement.js';

export const GADGET_ORDER = ['glowstick', 'soap', 'plane', 'bookmark', 'sprout', 'snack'];
const facing = (yaw) => { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); return Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)]; };
const sideOf = ([dx, dz]) => (dx === 1 ? 1 : dx === -1 ? 3 : dz === 1 ? 2 : 0);

// Returns {ok, why, ...} — consumes one gadget when it does something.
export function use(s, kind) {
  const p = s.player, f = s.pos.floor, S = roomSide(f);
  const [rx, rz] = roomOf(s.pos.x, s.pos.z, S);
  if (kind === 'bookmark' && s.bookmark && s.bookmark.f === f && !(s.bookmark.x === rx && s.bookmark.z === rz)) {
    s.pos.x = s.bookmark.px; s.pos.z = s.bookmark.pz; return { ok: true, returned: true };
  }
  if (!(p.gadgets[kind] > 0)) return { ok: false, why: 'none' };
  const dir = facing(s.pos.yaw);
  let res = { ok: true };
  switch (kind) {
    case 'glowstick': {   // thrown: keeps the room ahead (or this one) lit for a minute
      const here = Game.room(s, f, rx, rz);
      const [tx, tz] = here.lit ? [rx + dir[0], rz + dir[1]] : [rx, rz];
      Game.room(s, f, tx, tz).flags.glowT = 60; res.room = [tx, tz]; break;
    }
    case 'soap': {        // laid in the doorway you face: the Tide passes 3x slower
      const k = Game.edgeKey(f, rx, rz, sideOf(dir));
      (s.soapT ||= {})[k] = 120; s.soap = new Set(Object.keys(s.soapT)); res.edge = k; break;
    }
    case 'plane': {       // flies ahead and maps five rooms
      for (let i = 1; i <= 5; i++) { const r = Game.room(s, f, rx + dir[0] * i, rz + dir[1] * i); r.flags.mapped = 1; r.touched = true; }
      break;
    }
    case 'bookmark': s.bookmark = { f, x: rx, z: rz, px: s.pos.x, pz: s.pos.z }; break;
    case 'sprout': {      // planted in a lit room: it never floods again
      const r = Game.room(s, f, rx, rz);
      if (!r.lit || (rx === 0 && rz === 0)) return { ok: false, why: 'unlit' };
      r.flags.sprout = 1; r.touched = true; break;
    }
    case 'snack': s.snackT = 30; break;
    default: return { ok: false };
  }
  p.gadgets[kind]--;
  return res;
}
export function tick(s, dt) {
  if (s.snackT > 0) s.snackT -= dt;
  if (s.soapT) { for (const k of Object.keys(s.soapT)) { s.soapT[k] -= dt; if (s.soapT[k] <= 0) delete s.soapT[k]; } s.soap = new Set(Object.keys(s.soapT)); }
  for (const r of s.rooms.values()) if (r.flags.glowT > 0) { r.flags.glowT -= dt; if (r.flags.glowT <= 0) delete r.flags.glowT; }
}
