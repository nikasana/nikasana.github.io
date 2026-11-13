// Pure action layer: abilities (Dash, Gloss, Flash), Flow, on-the-spot lamp boosts.
import { CFG, roomSide } from './config.js';
import * as Game from './game.js';
import * as Tide from './tide.js';
import { roomOf } from './movement.js';

const A = CFG.ability;
export const ABILITIES = { dash: { track: 'shovel', stage: 'sweeper', key: 1 }, gloss: { track: 'brush', stage: 'mop', key: 2 }, flash: { track: 'lamp', stage: 'firefly', key: 3 } };
export const unlocked = (s, id) => Game.trackLevel(s.player, ABILITIES[id].track) >= A.unlockLevel;
// Each cooldown shortens with that stage's helper count.
export function cooldown(s, id) { const n = s.player.helpers[ABILITIES[id].stage] || 0; return A[id].cd * Math.max(A.cdMin, 1 - A.cdPerHelper * n); }
const st = (s) => (s.abil ||= { dash: 0, gloss: 0, flash: 0 });
export const ready = (s, id) => unlocked(s, id) && st(s)[id] <= 0;
export function tick(s, dt) {
  const a = st(s); for (const k of Object.keys(a)) a[k] = Math.max(0, a[k] - dt);
  if (s.glossT > 0) s.glossT -= dt;
}

// Dash: a lunge that ploughs a clear trench. Returns the target point (main moves the player with collision) and cells cleared.
export function dash(s) {
  if (!ready(s, 'dash')) return null;
  st(s).dash = cooldown(s, 'dash');
  const f = s.pos.floor, S = roomSide(f), dist = A.dash.dist * Math.sqrt(S / 8);
  const fx = -Math.sin(s.pos.yaw), fz = -Math.cos(s.pos.yaw);
  let units = 0, glow = 0; const rooms = new Set();
  const R = Game.toolRadius(s.player) * 1.25;
  for (let d = 0; d <= dist + 1.5; d += 0.3) {
    const x = s.pos.x + fx * d, z = s.pos.z + fz * d;
    const [rx, rz] = roomOf(x, z, S);
    if (rx === 0 && rz === 0) continue;
    const ev = Game.toolStep(s, f, rx, rz, x - rx * S, z - rz * S, 0.25, { radius: R, rateMult: 12 });
    if (ev && ev.mode === 'clear') { units += ev.units; glow += ev.glow; rooms.add(`${rx}:${rz}`); }
  }
  return { tx: s.pos.x + fx * dist, tz: s.pos.z + fz * dist, units, glow, rooms: [...rooms] };
}

// Gloss: 5 s of instant polish; the Tide slides back off gloss.
export function gloss(s) {
  if (!ready(s, 'gloss')) return null;
  st(s).gloss = cooldown(s, 'gloss'); s.glossT = A.gloss.dur;
  const f = s.pos.floor, [rx, rz] = roomOf(s.pos.x, s.pos.z, roomSide(f));
  let pushed = 0;
  for (const c of Tide.contacts(s)) if (Math.abs(c.x - rx) + Math.abs(c.z - rz) <= 1) { c.lane.contactT = 0; c.lane.boost = Math.min(CFG.tide.playerMax, c.lane.boost + 0.3); pushed++; }
  return { pushed };
}
export const glossing = (s) => s.glossT > 0;

// Flash: nearby lamps pulse, push the wave back and relight fading lamps.
export function flash(s) {
  if (!ready(s, 'flash')) return null;
  st(s).flash = cooldown(s, 'flash');
  const f = s.pos.floor, [px, pz] = roomOf(s.pos.x, s.pos.z, roomSide(f)), R = A.flash.radius;
  const fl = Game.floorState(s, f);
  let relit = 0, pushed = 0; const pulsed = [];
  for (let x = px - R; x <= px + R; x++) for (let z = pz - R; z <= pz + R; z++) {
    if (!Game.hasRoom(s, f, x, z)) continue;
    const r = Game.room(s, f, x, z);
    if (r.flags.out) { delete r.flags.out; r.lit = true; fl.litCount++; Game.updateStrength(s, f, x, z); relit++; }
    if (r.lit) { pulsed.push([x, z]); if (s.tide && !s.tide.result) Tide.addRoomBoost(s, x, z, 0.3); }
  }
  for (const c of Tide.contacts(s)) if (Math.max(Math.abs(c.x - px), Math.abs(c.z - pz)) <= R) {
    c.lane.contactT = 0; c.lane.state = 'moving'; c.lane.p = 0; c.lane.i = Math.max(0, c.lane.i - 1); pushed++;
  }
  return { relit, pushed, pulsed };
}

// Flow: filled by continuous action, three times faster when cycling Clear, Polish, Light.
export function flowStep(s, dt, action) {
  s.flow ||= 0; s.flowLast ||= { a: null, t: 99 };
  const L = s.flowLast; L.t += dt;
  if (action) {
    const cycle = L.a && L.a !== action && L.t < 4;
    if (L.a !== action) { L.a = action; L.t = 0; }
    s.flowCycle = cycle ? 3 : Math.max(1, (s.flowCycle || 1) - dt);
    s.flow = Math.min(1, s.flow + CFG.flow.gain * dt * (s.flowCycle > 1 ? CFG.flow.cycleMult : 1));
  } else s.flow = Math.max(0, s.flow - CFG.flow.decay * dt);
  if (s.flow >= 1) s.flowFull = true; else if (s.flow < 0.7) s.flowFull = false;
  return s.flow;
}
// Aura: helpers in your room work twice as fast; at full Flow the aura covers the neighbouring rooms.
export const auraRadius = (s) => (s.flowFull ? 1 : 0);

// Spend Glow at a lit room's switch during a wave to boost that lamp for the wave.
export const boostCost = (s, f) => Math.round(Game.lampCost(s, f) * 0.5);
export function boostLamp(s, f, x, z) {
  const r = Game.room(s, f, x, z);
  if (!s.tide || s.tide.result || !r.lit) return { ok: false };
  const c = boostCost(s, f);
  if (s.player.glow < c) return { ok: false, why: 'glow', cost: c };
  s.player.glow -= c; Tide.addRoomBoost(s, x, z, 0.3);
  return { ok: true, cost: c };
}
