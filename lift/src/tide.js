// Pure Tide simulation: the clutter itself returning, in waves, through doorways toward the lift.
// It attacks order (lit rooms), never the player.
import { CFG, floorScale } from './config.js';
import * as Game from './game.js';
import * as R from './roomstate.js';
import { parseKey } from './world.js';
import * as Econ from './economy.js';

const T = CFG.tide;
export const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W (direction the front comes FROM)

// ---------- floor meters, rank, noise ----------
export function meters(s, f) {
  const fl = Game.floorState(s, f), m = { clear: 0, polish: 0, light: 0 };
  for (const [k, r] of s.rooms) {
    const [rf, rx, rz] = parseKey(k);
    if (rf !== f || (rx === 0 && rz === 0) || r.flags.free) continue;
    if (r.clearedDone) m.clear++;
    if (r.polishedDone) m.polish++;
    if (r.lit || r.flags.out) m.light++;
  }
  const b = fl.sortiePts || {};
  m.clear += b.clear || 0; m.polish += b.polish || 0; m.light += b.light || 0;
  return m;
}
export const ROOMS_PER_RANK = 4;
export function rank(s, f) { const m = meters(s, f); return Math.floor(Math.min(m.clear, m.polish, m.light) / ROOMS_PER_RANK); }
export function updateRank(s, f) {
  const fl = Game.floorState(s, f), r = rank(s, f);
  const up = r > fl.rank; fl.rank = r; return up;
}
export const wavesOnFloor = (f) => (f === 0 ? T.wavesFloor0 : T.wavesLater);
export function pressureShare(f, k) { // k: 1-based wave index
  const n = wavesOnFloor(f);
  if (f === 0) return T.pressureFloor0[Math.min(k, n) - 1];
  return T.pressure[Math.min(k, n) - 1];
}
export const frontsFor = (f, k) => (k === wavesOnFloor(f) ? 4 : Math.min(3, k)); // grows from one direction to four
export const isGreat = (f, k) => k === wavesOnFloor(f);
export function noiseFor(s, f) { const fl = Game.floorState(s, f); return Math.round(100 * (1 - fl.waves / wavesOnFloor(f))); }

export function helperShare(s, great) {
  if (great) return 0;
  const p = Econ.pipeline(s);
  return Math.min(T.helperMax, p.cellsPerSec * 0.04);
}

// Forecast before the call.
export function forecast(s, f, players = 1) {
  const fl = Game.floorState(s, f), k = fl.waves + 1;
  const avg = Game.avgStrength(s, f);
  const P = pressureShare(f, k) * avg * (1 - (fl.ease || 0)) * Math.pow(T.coopPerPlayer, players - 1);
  const S = avg * (1 + helperShare(s, isGreat(f, k)));
  const ratio = S > 0 ? P / S : Infinity;
  const mood = ratio < 0.8 ? 'calm' : ratio <= 1.05 ? 'close' : 'hard';
  const fronts = frontsFor(f, k);
  const open = openSides(s, f);
  const exposed = fronts === 4 ? open : open.length > 4 - fronts ? open.slice(0, fronts - (4 - open.length)) : [];
  return { k, pressure: P, strength: avg, held: S, mood: exposed.length && mood === 'calm' ? 'close' : mood, great: isGreat(f, k), fronts, open: exposed,
    unlocked: fl.rank >= k && k <= wavesOnFloor(f) && !fl.quiet, done: k > wavesOnFloor(f) || fl.quiet };
}

// ---------- building a wave ----------
function territory(s, f) {
  const out = [];
  for (const [k, r] of s.rooms) { const [rf, x, z] = parseKey(k); if (rf === f && r.lit && !(x === 0 && z === 0)) out.push([x, z]); }
  return out;
}
export function sideOrder(terr) {
  const n = [0, 0, 0, 0];
  for (const [x, z] of terr) { if (z < 0) n[0]++; if (x > 0) n[1]++; if (z > 0) n[2]++; if (x < 0) n[3]++; }
  return [0, 1, 2, 3].sort((a, b) => n[b] - n[a] || a - b);
}
export function openSides(s, f) {
  const n = [0, 0, 0, 0];
  for (const [x, z] of territory(s, f)) { if (z < 0) n[0]++; if (x > 0) n[1]++; if (z > 0) n[2]++; if (x < 0) n[3]++; }
  return [0, 1, 2, 3].filter((i) => n[i] === 0);
}
// Path for a lane: straight in from outside along the front's axis, then along the axis to the lift.
function lanePath(side, lane, extent) {
  const [dx, dz] = SIDES[side];
  const path = [];
  if (dx !== 0) {
    for (let x = dx * (extent + 2); x !== 0; x -= dx) path.push([x, lane]);
    for (let z = lane; z !== 0; z -= Math.sign(lane)) path.push([0, z]);
  } else {
    for (let z = dz * (extent + 2); z !== 0; z -= dz) path.push([lane, z]);
    for (let x = lane; x !== 0; x -= Math.sign(lane)) path.push([x, 0]);
  }
  path.push([0, 0]);
  return path;
}

export function startWave(s, f, opts = {}) {
  const fl = Game.floorState(s, f);
  const kind = opts.kind || 'wave';
  const k = kind === 'wave' ? fl.waves + 1 : 1;
  const avg = Game.avgStrength(s, f);
  const share = kind === 'random' ? T.randomPressure : kind === 'final' ? (opts.share || 0.6) : pressureShare(f, k);
  const players = opts.players || 1;
  const P = share * avg * (kind === 'wave' ? 1 - (fl.ease || 0) : 1) * Math.pow(T.coopPerPlayer, players - 1) * (opts.risk || 1);
  const great = kind === 'wave' && isGreat(f, k);
  const nFronts = kind === 'wave' ? frontsFor(f, k) : 1;
  const terr = territory(s, f);
  const w = { kind, f, k, P, great, t: 0, fronts: [], result: null, flooded: [], contacts: 0, boosts: {}, seed: opts.seed ?? (s.seed + fl.waves * 7919 + (s.tideCount = (s.tideCount || 0) + 1)) };
  // bounce: overwhelming strength turns the wave away at once
  if (kind === 'wave' && avg > 0 && avg >= T.bounce * P) { w.result = 'bounced'; w.t = 0; s.tide = w; return w; }
  // fronts come first from the sides where the house is strongest
  const order = sideOrder(terr);
  for (let i = 0; i < nFronts; i++) {
    const side = nFronts === 4 ? [1, 2, 3, 0][i] : order[i];
    const [dx, dz] = SIDES[side];
    // lanes: rows (or columns) of the territory facing this side; extent = how far the territory reaches that way
    const lanesSet = new Map();
    for (const [x, z] of terr) {
      const lane = dx !== 0 ? z : x, along = dx !== 0 ? x * dx : z * dz;
      if (along < 0 || (along === 0 && lane === 0)) continue;   // rooms on the far side of the lift face other fronts
      lanesSet.set(lane, Math.max(lanesSet.get(lane) ?? 0, along));
    }
    if (!lanesSet.size) lanesSet.set(0, 1);
    let extent = 1; for (const v of lanesSet.values()) extent = Math.max(extent, v);
    const lanes = [...lanesSet.keys()].sort((a, b) => a - b).map((lane) => ({ lane, path: lanePath(side, lane, extent), i: 0, p: 0, state: 'moving', contactT: 0, pulses: 0, boost: 0 }));
    const mid = lanes[Math.floor(lanes.length / 2)];
    w.fronts.push({ side, lanes, start: i * T.frontStagger, source: mid.path[0], sourceLit: false });
  }
  w.duration = opts.duration || T.duration + 10 * (nFronts - 1);
  s.tide = w;
  return w;
}

// Pressure ramps up to its peak at 60 % of the wave, then eases.
export function pressureAt(w) { const u = Math.min(1, w.t / (w.duration * 0.6)); return w.P * (0.6 + 0.4 * Math.sin(u * Math.PI / 2)); }

export function defense(s, w, f, x, z, lane) {
  const r = Game.room(s, f, x, z);
  if (!r.lit) return 0;
  const player = Math.min(T.playerMax, lane.boost + (w.boosts[`${x}:${z}`] || 0));
  return r.strength * (1 + player + helperShare(s, w.great));
}

// Advance the wave. hooks: { onContact(lane, x, z), onFlood(x, z), onHold(lane), onEnd(result) } (optional, for effects).
export function tick(s, dt, hooks = {}) {
  const w = s.tide; if (!w || w.result) return w;
  const f = w.f;
  w.t += dt;
  let anyActive = false;
  for (const fr of w.fronts) {
    if (w.t < fr.start) { anyActive = true; continue; }
    // lighting the source room (a vent in a dark room) ends the flow from that side
    if (!fr.sourceLit && (Game.room(s, f, ...fr.source).lit || Game.room(s, f, ...fr.source).flags.glowT > 0)) { fr.sourceLit = true; for (const l of fr.lanes) if (l.state === 'moving' || l.state === 'contact') l.state = 'held'; }
    for (const l of fr.lanes) {
      if (l.state === 'held' || l.state === 'arrived') continue;
      anyActive = true;
      const [x, z] = l.path[l.i];
      if (x === 0 && z === 0) { l.state = 'arrived'; w.result = 'lost'; break; }
      const r = Game.room(s, f, x, z);
      l.boost = Math.max(0, l.boost - 0.03 * dt);
      if (l.state === 'moving') {
        // entering a lit room: contact at its doorway
        if (r.lit && l.p < 0.05 && !r.flags.sprout) { l.state = 'contact'; l.contactT = 0; w.contacts++; hooks.onContact && hooks.onContact(l, x, z); continue; }
        if (r.lit && r.flags.sprout) { l.state = 'held'; hooks.onHold && hooks.onHold(l, x, z); continue; }
        const slow = doorSlow(s, f, l);
        l.p += dt * ((s.mods && s.mods.tideSpeed) || 1) / (T.step * slow);
        if (l.p >= 1) { l.p = 0; l.i++; }
      } else if (l.state === 'contact') {
        const prev = l.path[Math.max(0, l.i - 1)];
        const door = doorBetween(prev, [x, z]);
        const shut = door && l.i > 0 && Game.doorShut(s, f, prev[0], prev[1], door);
        if (!shut) l.contactT += dt / doorSlow(s, f, l);
        if (l.contactT >= T.contact) {
          l.contactT = 0; l.pulses++;
          // the front keeps pressing in pulses until the wave ebbs; each pulse the room must out-shine it
          if (defense(s, w, f, x, z, l) >= pressureAt(w)) {
            l.holding = true; if (l.pulses === 1) hooks.onHold && hooks.onHold(l, x, z);
          } else {
            floodRoom(s, w, f, x, z); hooks.onFlood && hooks.onFlood(x, z);
            l.state = 'moving'; l.p = 0.05; l.pulses = 0;
          }
        }
      }
    }
    if (w.result) break;
  }
  if (!w.result && (w.t >= w.duration || !anyActive)) w.result = 'held';
  if (w.result) finish(s, w, hooks);
  return w;
}
function doorBetween(a, b) { const dx = b[0] - a[0], dz = b[1] - a[1]; return dx === 1 ? 1 : dx === -1 ? 3 : dz === 1 ? 2 : dz === -1 ? 0 : null; }
function doorSlow(s, f, l) {
  if (l.i === 0) return 1;
  const prev = l.path[l.i - 1], cur = l.path[l.i];
  const side = doorBetween(prev, cur);
  return side !== null && s.soap && s.soap.has(Game.edgeKey(f, prev[0], prev[1], side)) ? 3 : 1;
}
function floodRoom(s, w, f, x, z) {
  const r = Game.room(s, f, x, z);
  if (r.lit) { r.lit = false; r.flags.out = 1; }
  R.flood(r, Game.info(s, f, x, z));
  Game.updateStrength(s, f, x, z);
  const fl = Game.floorState(s, f); fl.litCount = Math.max(0, fl.litCount - 1);
  w.flooded.push([x, z]);
}

function finish(s, w, hooks) {
  const f = w.f, fl = Game.floorState(s, f);
  // lamps stay: flooded rooms get their lamp back, but their clutter must be cleared again
  for (const [k, r] of s.rooms) {
    if (!r.flags.out) continue;
    const [rf, x, z] = parseKey(k); if (rf !== f) continue;
    delete r.flags.out; r.lit = true; fl.litCount++; Game.updateStrength(s, f, x, z);
  }
  w.reward = 0;
  if (w.kind === 'wave') {
    if (w.result === 'held' || w.result === 'bounced') {
      fl.waves++; fl.ease = 0;
      w.reward = waveReward(s, f, w.k) * (s.player.rested > 0 ? 2 : 1);
      if (s.player.rested > 0) { s.player.rested--; w.rested = true; }
      Game.addGlow(s, w.reward); s.player.stats.wavesHeld++;
      if (fl.waves >= wavesOnFloor(f)) { fl.quiet = true; w.quiet = true; if (s.house.maxFloor === f) { s.house.maxFloor = f + 1; Game.floorState(s, f + 1); } }
    } else {
      fl.ease = Math.min(0.5, (fl.ease || 0) + T.retryEase);
    }
  }
  fl.noise = noiseFor(s, f);
  hooks.onEnd && hooks.onEnd(w);
}
export function waveReward(s, f, k) { return Math.round(Math.max(150 * floorScale(f), Game.incomeRate(s) * 60) * k); }

export function clearTide(s) { s.tide = null; }

// The player helps hold a front: sweeping in a contacted room's doorway adds strength (capped at +60 %).
export function sweepBoost(s, f, x, z, dt) {
  const w = s.tide; if (!w || w.result) return false;
  let hit = false;
  for (const fr of w.fronts) for (const l of fr.lanes) {
    if (l.state !== 'contact') continue;
    const [lx, lz] = l.path[l.i];
    if (lx === x && lz === z) { l.boost = Math.min(T.playerMax, l.boost + T.sweepBoost * dt); hit = true; }
  }
  return hit;
}
export function addRoomBoost(s, x, z, amt) { const w = s.tide; if (!w) return; const k = `${x}:${z}`; w.boosts[k] = Math.min(T.playerMax, (w.boosts[k] || 0) + amt); }
// Every lane currently pressing on a room (for effects and prompts).
export function contacts(s) {
  const w = s.tide, out = []; if (!w || w.result) return out;
  for (const fr of w.fronts) for (const l of fr.lanes) if (l.state === 'contact') out.push({ lane: l, x: l.path[l.i][0], z: l.path[l.i][1], from: l.path[Math.max(0, l.i - 1)] });
  return out;
}

// Random Tides on floors that are not yet Quiet.
export function maybeRandom(s, f, dt) {
  const fl = Game.floorState(s, f);
  const loud = s.sortie && s.sortie.loud;
  if ((fl.quiet && !loud) || s.tide || fl.litCount < 4 || (s.mods && s.mods.noTides)) { s.randomT = 0; return null; }
  s.randomT = (s.randomT || 0) + dt;
  if (s.randomT < T.randomEvery) return null;
  s.randomT = 0;
  return startWave(s, f, { kind: 'random' });
}
