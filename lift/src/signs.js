// Pure Signs and Anchors. One sign means nothing; two that agree mean something.
import { CFG } from './config.js';
import { hash32, hashFloat } from './rng.js';
import * as Game from './game.js';

export const ANCHORS = ['clock', 'notebook', 'coin', 'phone', 'mirror', 'window'];
export const SYMBOLS = ['rings', 'triangle', 'diamond', 'wave', 'spiral', 'cross', 'dots', 'arc'];
const C = CFG.signs;

export const regionOf = (x, z) => [Math.floor(x / C.region), Math.floor(z / C.region)];
// The Anchor of a region: a room placed by the seed, never the lift's neighbourhood.
export function anchorRoom(seed, f, rx, rz) {
  let tries = 0, x, z;
  do {
    x = rx * C.region + (hash32(seed, f, rx, rz, 61, tries) % C.region);
    z = rz * C.region + (hash32(seed, f, rx, rz, 62, tries) % C.region);
    tries++;
  } while (Math.abs(x) + Math.abs(z) <= 2 && tries < 20);
  const kind = ANCHORS[hash32(seed, f, rx, rz, 63) % ANCHORS.length];
  const cell = 40 + (hash32(seed, f, rx, rz, 64) % 176);  // a cell away from the walls
  return { x, z, kind, cell };
}
export function anchorFor(s, f, x, z) { const [rx, rz] = regionOf(x, z); return anchorRoom(s.house.seed, f, rx, rz); }
export const anchorFound = (s, f, a) => !!(s.house.anchorsFound && s.house.anchorsFound[`${f}:${a.x}:${a.z}`]);

// Sign in a room (or null). salt differs per player in co-op: false signs differ, true ones are shared.
export function signAt(s, f, x, z, opts = {}) {
  if (Math.abs(x) + Math.abs(z) <= 1) return null;
  const seed = s.house.seed;
  const echo = opts.echo ? 2 : 1;
  const r0 = hashFloat(seed, f, x, z, 71);
  const coin = (s.player.anchors.coin || 0) > 0;
  const trueShare = coin ? 0.75 : C.trueShare;
  const isTrueRoom = r0 < C.roomShare * trueShare;              // shared between players
  const salt = opts.salt || 0;
  const rf = hashFloat(seed, f, x, z, 72, salt);
  const falseShare = C.roomShare * (1 - trueShare) * echo;
  const isFalseRoom = !isTrueRoom && rf < falseShare / (1 - C.roomShare * trueShare);
  if (!isTrueRoom && !isFalseRoom) return null;
  const a = anchorFor(s, f, x, z);
  const S = 1;
  let angle;
  if (isTrueRoom) angle = Math.atan2(a.z - z, a.x - x);
  else angle = hashFloat(seed, f, x, z, 73, salt) * Math.PI * 2;
  const cell = 34 + (hash32(seed, f, x, z, 74, isTrueRoom ? 0 : salt) % 188);
  const symbol = SYMBOLS[hash32(seed, f, x, z, 75, isTrueRoom ? 0 : salt) % SYMBOLS.length];
  return { x, z, f, true: isTrueRoom && !(a.x === x && a.z === z), angle, cell, symbol, key: `${f}:${x}:${z}` };
}
// Signs appear only on polished floors.
export function visibleSign(s, f, x, z, opts) {
  const r = Game.room(s, f, x, z);
  if (!r.polishedDone) return null;
  const sg = signAt(s, f, x, z, opts);
  if (!sg) return null;
  const st = (s.player.signs ||= {})[sg.key];
  if (st === 'false') return null;              // dissolved
  // Clock "Wait": untested false signs fade
  if (!st && !sg.true && (s.player.anchors.clock || 0) > 0 && hashFloat(s.house.seed, f, x, z, 76) < 0.5) return null;
  return { ...sg, state: st || null };
}
export const testTime = (s) => C.testTime * ((s.player.anchors.notebook || 0) > 0 ? 0.55 : 1);

// Holding the tool on a sign for testTime tests it. Returns {done, true} when finished.
export function testStep(s, sg, dt) {
  const p = s.player;
  p.signT ||= {};
  p.signT[sg.key] = (p.signT[sg.key] || 0) + dt;
  if (p.signT[sg.key] < testTime(s)) return { done: false, progress: p.signT[sg.key] / testTime(s) };
  delete p.signT[sg.key];
  p.signs[sg.key] = sg.true ? 'true' : 'false';
  p.stats.signs++;
  if (sg.true) (p.rays ||= []).push({ f: sg.f, x: sg.x, z: sg.z, angle: sg.angle });
  else Game.addGlow(s, C.falseReward * Math.pow(4, sg.f) * Game.glowMult(s, sg.f));
  return { done: true, true: sg.true };
}

// The Anchor shows once its cell is cleared; E nearby takes it.
export function anchorHere(s, f, x, z) {
  const a = anchorFor(s, f, x, z);
  if (a.x !== x || a.z !== z || anchorFound(s, f, a)) return null;
  const r = Game.room(s, f, x, z);
  return r.c[a.cell] > 0 ? { ...a, buried: true } : { ...a, buried: false };
}
export function takeAnchor(s, f, x, z) {
  const a = anchorHere(s, f, x, z);
  if (!a || a.buried) return null;
  (s.house.anchorsFound ||= {})[`${f}:${a.x}:${a.z}`] = 1;
  s.player.anchors[a.kind] = (s.player.anchors[a.kind] || 0) + 1;
  return a;
}
// Phone "Ask someone": a periodic true ray toward the nearest unfound Anchor.
export function phoneRay(s, f, px, pz) {
  const a = anchorFor(s, f, px, pz);
  if (anchorFound(s, f, a)) return null;
  const ray = { f, x: px, z: pz, angle: Math.atan2(a.z - pz, a.x - px), phone: true };
  (s.player.rays ||= []).push(ray);
  return ray;
}
