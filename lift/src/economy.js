// Pure economy: upgrade tracks, the helper pipeline, offline progress.
import { CFG, floorScale } from './config.js';
import * as Game from './game.js';
import * as R from './roomstate.js';
import { parseKey } from './world.js';

export const UPGRADE_IDS = ['power', 'reach', 'speed', 'shine', 'bright', 'wiring'];
export const TRACKS = { shovel: ['power', 'reach'], brush: ['speed', 'shine'], lamp: ['bright', 'wiring'] };
export const HELPERS = ['sweeper', 'mop', 'firefly'];

export const upgradeCost = (id, lvl) => Math.round(CFG.upgrades[id].base * Math.pow(CFG.upgrades[id].growth, lvl));
export function buyUpgrade(s, id) {
  const lvl = s.player.upgrades[id] || 0, c = upgradeCost(id, lvl);
  if (s.player.glow < c) return { ok: false, cost: c };
  s.player.glow -= c; s.player.upgrades[id] = lvl + 1;
  Game.recomputeAll(s);
  return { ok: true, cost: c };
}

// Effect of an upgrade at a level, as numbers for the panel (before -> after).
export function upgradeEffect(id, lvl, floor = 0) {
  const p = { upgrades: { power: 0, reach: 0, speed: 0, shine: 0, bright: 0, wiring: 0, [id]: lvl } };
  switch (id) {
    case 'power': return Game.clearRate(p, floor);
    case 'reach': return Game.toolRadius(p);
    case 'speed': return Game.polishRate(p);
    case 'shine': return Game.shine(p);
    case 'bright': return Game.lampLevel(p);
    case 'wiring': return Game.wiringReach(p);
  }
  return 0;
}

export const helperCost = (kind, n) => Math.round(CFG.helpers[kind] * Math.pow(CFG.helpers.growth, n));
export function buyHelper(s, kind) {
  const n = s.player.helpers[kind] || 0, c = helperCost(kind, n);
  if (s.player.glow < c) return { ok: false, cost: c };
  s.player.glow -= c; s.player.helpers[kind] = n + 1;
  return { ok: true, cost: c };
}
// Throughput equals the slowest stage.
export function pipeline(s) {
  const h = s.player.helpers;
  const min = Math.min(h.sweeper, h.mop, h.firefly);
  let bottleneck = null;
  if (h.sweeper + h.mop + h.firefly > 0) bottleneck = HELPERS.find((k) => h[k] === min);
  return { cellsPerSec: min * CFG.helpers.cellsPerSec, bottleneck, stages: { ...h } };
}

// Helpers work in visited, unfinished rooms of a floor. Near the player (aura) they work twice as fast.
// Each processed cell is cleared and polished; Glow = units x cell worth. Returns {cells, glow, rooms:[keys finished]}.
export function tickHelpers(s, dt, f, px = null, pz = null, auraRooms = 0) {
  const pipe = pipeline(s);
  if (pipe.cellsPerSec <= 0) return { cells: 0, glow: 0, rooms: [] };
  s.helperCarry = (s.helperCarry || 0);
  const out = { cells: 0, glow: 0, rooms: [], touched: [] };
  const mult = Game.glowMult(s, f), worth = CFG.glow.cellWorth * floorScale(f) * mult;
  const work = [];
  for (const [k, r] of s.rooms) {
    if (!r.visited || (r.clearedDone && r.polishedDone)) continue;
    const [rf, rx, rz] = parseKey(k);
    if (rf !== f || (rx === 0 && rz === 0)) continue;
    const near = px !== null && Math.max(Math.abs(rx - px), Math.abs(rz - pz)) <= auraRooms;
    work.push([k, r, rx, rz, near]);
  }
  if (!work.length) return out;
  // helpers finish rooms one at a time, nearest to the player (or the lift) first
  const ox = px ?? 0, oz = pz ?? 0;
  work.sort((a, b) => (Math.abs(a[2] - ox) + Math.abs(a[3] - oz)) - (Math.abs(b[2] - ox) + Math.abs(b[3] - oz)));
  let budget = pipe.cellsPerSec * dt + s.helperCarry;
  for (const [k, r, rx, rz, near] of work) {
    if (budget < 1) break;
    const m = near ? CFG.helpers.auraMult : 1;
    let cells = 0;
    for (let i = 0; i < r.c.length && budget * m >= 1; i++) {
      if (r.c[i] <= 0 && r.g[i] <= 0) continue;
      out.glow += r.c[i] * worth;
      r.c[i] = 0; r.g[i] = 0; budget -= 1 / m; cells++;
    }
    if (cells) {
      out.cells += cells; out.touched.push(k); r.touched = true;
      const wasDone = r.clearedDone && r.polishedDone;
      R.finishClear(r); R.finishPolish(r);
      if (!wasDone && r.clearedDone && r.polishedDone) out.rooms.push(k);
      if (r.lit) Game.updateStrength(s, f, rx, rz);
    }
  }
  s.helperCarry = Math.min(1, budget);
  if (out.glow) Game.addGlow(s, out.glow);
  return out;
}

// Offline: 50 % income for up to 8 h; helpers keep working; rested charges.
export function applyOffline(s, now) {
  const last = s.lastTs || now;
  const secs = Math.max(0, (now - last) / 1000);
  const res = { secs, glow: 0, rooms: 0, rested: 0 };
  s.lastTs = now;
  if (secs < 60) return res;
  const capped = Math.min(secs, CFG.offline.maxHours * 3600);
  const g0 = s.player.glow;
  Game.addGlow(s, Game.incomeRate(s) * capped * CFG.offline.share);
  // helpers extend territory on every floor with visited rooms, in coarse steps
  const floors = Object.keys(s.house.floors).map(Number);
  for (const f of floors) {
    let left = capped * CFG.offline.share, guard = 0;
    while (left > 0 && guard++ < 200) { const step = Math.min(left, 60); const r = tickHelpers(s, step, f); res.rooms += r.rooms.length; left -= step; if (!r.cells) break; }
  }
  res.glow = s.player.glow - g0;
  const charges = Math.floor(secs / (CFG.offline.restedEveryHours * 3600));
  const before = s.player.rested || 0;
  s.player.rested = Math.min(CFG.offline.restedMax, before + charges);
  res.rested = s.player.rested - before;
  return res;
}
