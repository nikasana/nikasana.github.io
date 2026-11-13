// Pure game state and rules. No DOM, no Three.js.
import { CFG, roomSide, floorScale } from './config.js';
import { roomInfo, roomKey, parseKey, MATERIALS, BIOMES, rareCell, rareKind } from './world.js';
import * as R from './roomstate.js';

export const ENABLED_BIOMES = { n: BIOMES.length };
export const SIDE_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function newPlayer() {
  return {
    glow: 0, nightGlow: 0, lifetimeGlow: 0,
    upgrades: { power: 0, reach: 0, speed: 0, shine: 0, bright: 0, wiring: 0 },
    helpers: { sweeper: 0, mop: 0, firefly: 0 },
    materials: Object.fromEntries(MATERIALS.map((m) => [m, 0])),
    gadgets: {}, clarity: 0, anchors: {}, catalog: [], notes: [], achievements: [], diary: [],
    rested: 0, stats: { cleared: 0, polished: 0, lamps: 0, rooms: 0, wavesHeld: 0, sorties: 0, signs: 0 },
  };
}

export function newFloor() {
  return { rank: 0, meters: { clear: 0, polish: 0, light: 0 }, noise: 100, waves: 0, quiet: false, ease: 0,
    lamps: 0, litCount: 0, strengthSum: 0 };
}

export function newGame(seed) {
  return {
    v: CFG.version, seed: seed >>> 0,
    player: newPlayer(),
    house: { seed: seed >>> 0, maxFloor: 0, floors: { 0: newFloor() } },
    rooms: new Map(), infos: new Map(),
    pos: { floor: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    lastTs: 0, combo: 1, comboT: 0, settings: {}, doors: new Map(), mods: {}, sortie: null, tide: null,
  };
}

export const floorState = (s, f) => (s.house.floors[f] ||= newFloor());

export function info(s, f, x, z) {
  const k = roomKey(f, x, z);
  let i = s.infos.get(k);
  if (!i) {
    i = roomInfo(s.house.seed, f, x, z, ENABLED_BIOMES.n);
    if (s.house.halls && s.house.halls.includes(k)) i = { ...i, modifier: 'hall', hall: true, setPiece: null, ceil: i.ceil + 3, props: [] };
    s.infos.set(k, i);
  }
  return i;
}
export function room(s, f, x, z) {
  const k = roomKey(f, x, z);
  let r = s.rooms.get(k);
  if (!r) { r = R.createRoom(info(s, f, x, z)); s.rooms.set(k, r); if (r.lit) { addLit(s, f, x, z, r, false); updateStrength(s, f, x, z); } }
  return r;
}
export const hasRoom = (s, f, x, z) => s.rooms.has(roomKey(f, x, z));

// Forget rooms nobody changed, far from the player.
export function pruneRooms(s, f, x, z, keep = 6) {
  for (const [k, r] of s.rooms) {
    if (r.touched || r.visited || r.lit) continue;
    const [rf, rx, rz] = parseKey(k);
    if (rf !== f || Math.abs(rx - x) > keep || Math.abs(rz - z) > keep) { s.rooms.delete(k); s.infos.delete(k); }
  }
}

// ---------- derived numbers ----------
export const trackLevel = (p, track) => {
  let l = 0; for (const [id, u] of Object.entries(CFG.upgrades)) if (u.track === track) l += p.upgrades[id] || 0; return l;
};
export const lowestTrack = (p) => Math.min(trackLevel(p, 'shovel'), trackLevel(p, 'brush'), trackLevel(p, 'lamp'));
export const toolRadius = (p) => CFG.tool.baseRadius * (1 + CFG.tool.reachStep * p.upgrades.reach);
export const clearRate = (p, f, mods) => CFG.clear.baseRate * Math.pow(4, p.upgrades.power - f) * ((mods && mods.clearMult) || 1);
export const polishRate = (p) => CFG.polish.baseRate * (1 + CFG.polish.speedStep * p.upgrades.speed);
export const shine = (p) => 1 + CFG.polish.shineStep * p.upgrades.shine;
export const lampLevel = (p) => 1 + p.upgrades.bright;
export const wiringReach = (p) => 1 + p.upgrades.wiring;
export const walkSpeed = (f) => CFG.player.walkBase + CFG.player.walkPerM * roomSide(f);

export function anchorBonus(p) { let n = 0; for (const v of Object.values(p.anchors)) n += Math.max(0, v - 1); return 1 + 0.1 * n; }
export function glowMult(s, f) {
  const p = s.player, fl = floorState(s, f);
  return (1 + CFG.clarityBonus * p.clarity) * (1 + CFG.catalogBonus * p.catalog.length) *
    (1 + CFG.balanceBonus * lowestTrack(p)) * (1 + CFG.rankBonus * fl.rank) * (fl.quiet ? CFG.quietMult : 1) * anchorBonus(p);
}

// ---------- strength & income ----------
export function updateStrength(s, f, x, z) {
  const r = room(s, f, x, z);
  const fl = floorState(s, f);
  const old = r.strength || 0;
  r.strength = x === 0 && z === 0 ? 0 : R.roomStrength(r, lampLevel(s.player), shine(s.player)) * ((s.mods && s.mods.strengthMult) || 1);
  fl.strengthSum += r.strength - old;
  return r.strength;
}
export function recomputeAll(s) {
  for (const fl of Object.values(s.house.floors)) { fl.strengthSum = 0; fl.litCount = 0; }
  for (const [k, r] of s.rooms) {
    const [f, x, z] = parseKey(k); const fl = floorState(s, f);
    r.strength = x === 0 && z === 0 ? 0 : R.roomStrength(r, lampLevel(s.player), shine(s.player));
    fl.strengthSum += r.strength; if (r.lit && !(x === 0 && z === 0)) fl.litCount++;
  }
}
export const avgStrength = (s, f) => { const fl = floorState(s, f); return fl.litCount ? fl.strengthSum / fl.litCount : 0; };

export function incomeRate(s) {
  let t = 0;
  for (const [f, fl] of Object.entries(s.house.floors)) t += fl.strengthSum * CFG.income.perStrength * floorScale(+f) * glowMult(s, +f);
  return t;
}

export function addGlow(s, amt) {
  s.player.glow += amt; s.player.nightGlow += amt; s.player.lifetimeGlow += amt;
}

// Income from timestamps; works across background tabs.
export function tickIncome(s, now) {
  if (!s.lastTs) { s.lastTs = now; return 0; }
  const dt = Math.max(0, (now - s.lastTs) / 1000);
  s.lastTs = now;
  const g = incomeRate(s) * dt;
  addGlow(s, g);
  return g;
}

// ---------- lamps ----------
export function lampCost(s, f) { return CFG.lamp.base * floorScale(f) * Math.pow(CFG.lamp.growth, floorState(s, f).lamps); }
export function wiringDistance(s, f, x, z) {
  let best = Math.abs(x) + Math.abs(z);
  for (const [k, r] of s.rooms) {
    if (!r.lit) continue; const [rf, rx, rz] = parseKey(k);
    if (rf === f) best = Math.min(best, Math.abs(rx - x) + Math.abs(rz - z));
  }
  return best;
}
export function canWire(s, f, x, z) {
  const r = room(s, f, x, z);
  if (r.lit) return false;
  return wiringDistance(s, f, x, z) <= wiringReach(s.player);
}
function addLit(s, f, x, z, r, counted) {
  const fl = floorState(s, f);
  if (!(x === 0 && z === 0)) fl.litCount++;
  if (counted) fl.lamps++;
}
export function buyLamp(s, f, x, z) {
  const r = room(s, f, x, z);
  if (r.lit) return { ok: false, why: 'lit' };
  if (!canWire(s, f, x, z)) return { ok: false, why: 'wire' };
  const cost = lampCost(s, f);
  if (s.player.glow < cost) return { ok: false, why: 'glow', cost };
  s.player.glow -= cost; r.lit = true; r.touched = true; r.lampFade = 0;
  addLit(s, f, x, z, r, true);
  s.player.stats.lamps++;
  updateStrength(s, f, x, z);
  return { ok: true, cost };
}
export function loseLamp(s, f, x, z) {
  const r = room(s, f, x, z);
  if (!r.lit || (x === 0 && z === 0)) return false;
  r.lit = false; r.touched = true;
  const fl = floorState(s, f); fl.litCount--; fl.lamps = Math.max(0, fl.lamps - 1);
  updateStrength(s, f, x, z);
  return true;
}

// ---------- the tool ----------
const tmpCells = [];
// cx, cz: tool centre in the room's local metres (origin at room centre).
export function toolStep(s, f, x, z, lx, lz, dt, opts = {}) {
  const inf = info(s, f, x, z);
  if (inf.cabin) return null;
  const r = room(s, f, x, z);
  const cell = inf.side / CFG.grid;
  const rc = (opts.radius ?? toolRadius(s.player)) / cell;
  const cx = (lx + inf.side / 2) / cell, cz = (lz + inf.side / 2) / cell;
  R.cellsInCircle(cx, cz, rc, tmpCells);
  const p = s.player;
  const ev = { mode: null, units: 0, polished: 0, cells: [], glow: 0, finishedClear: false, finishedPolish: false, rare: null };
  const wasC = r.clearedDone, wasP = r.polishedDone;
  let hasClutter = false; for (const k of tmpCells) if (r.c[k] > 0) { hasClutter = true; break; }
  const hand = incomeRate(s) * CFG.glow.handSeconds * (opts.handMult ?? 1);
  const mult = glowMult(s, f);
  if (hasClutter) {
    const res = R.clearAt(r, tmpCells, clearRate(p, f, s.mods) * (opts.rateMult ?? 1), dt);
    ev.mode = 'clear'; ev.units = res.units; ev.cells = res.cells;
    const worth = CFG.glow.cellWorth * floorScale(f) * mult * s.combo * ((s.mods && s.mods.glowMult) || 1) * (s.snackT > 0 ? 2 : 1);
    ev.glow = res.units * (worth + hand);
    p.materials[inf.biome.mat] = (p.materials[inf.biome.mat] || 0) + res.units;
    p.stats.cleared += res.units;
    const rc2 = rareCell(inf);
    if (rc2 >= 0 && res.cells.includes(rc2) && r.c[rc2] <= 0 && !r.flags.rare) { r.flags.rare = 1; ev.rare = rareKind(inf, rc2); }
  } else {
    const amt = R.polishAt(r, tmpCells, polishRate(p) * (opts.rateMult ?? 1) * (opts.polishMult ?? 1), dt);
    ev.mode = amt > 0 ? 'polish' : 'idle'; ev.polished = amt;
    ev.glow = amt * hand * s.combo;
    p.stats.polished += amt;
  }
  if (ev.glow > 0) addGlow(s, ev.glow);
  ev.finishedClear = !wasC && r.clearedDone;
  ev.finishedPolish = !wasP && r.polishedDone;
  if (ev.mode === 'clear' || ev.mode === 'polish') {
    s.comboT = 0;
    s.combo = Math.min(CFG.clear.comboMax * (opts.comboCap ?? 1), s.combo + CFG.clear.comboGain * dt);
  }
  if (r.lit) updateStrength(s, f, x, z);
  return ev;
}
export function tickCombo(s, dt, active) {
  if (active) return;
  s.comboT += dt;
  if (s.comboT > 0.6) s.combo = Math.max(1, s.combo - CFG.clear.comboDecay * dt);
}

export function tickRooms(s, dt) {
  // dust settles in unlit rooms
  for (const [k, r] of s.rooms) if (!r.lit && r.touched && r.clearedDone) R.settleDust(r, dt);
}

export function addCatalog(s, id) {
  if (s.player.catalog.includes(id)) return false;
  s.player.catalog.push(id); return true;
}
// Returns a list of events: 'new', 'set:<kind>' when a catalog entry is found.
export function visit(s, f, x, z) {
  const r = room(s, f, x, z);
  if (r.visited) return null;
  r.visited = true; r.touched = true; s.player.stats.rooms++;
  const inf = info(s, f, x, z), ev = { first: true };
  if (inf.setPiece && addCatalog(s, 'set:' + inf.setPiece)) ev.catalog = 'set:' + inf.setPiece;
  return ev;
}

// ---------- doors, sealed rooms ----------
export const isSealed = (s, f, x, z) => info(s, f, x, z).modifier === 'sealed' && !room(s, f, x, z).flags.open;
export const sealCost = (f) => CFG.sealed.openCost * floorScale(f);
export function openSealed(s, f, x, z) {
  if (!isSealed(s, f, x, z)) return { ok: false };
  const c = sealCost(f);
  if (s.player.glow < c) return { ok: false, why: 'glow', cost: c };
  s.player.glow -= c; const r = room(s, f, x, z); r.flags.open = 1; r.touched = true;
  return { ok: true, cost: c };
}
export function edgeKey(f, x, z, side) {
  const [dx, dz] = SIDE_DIR[side];
  // canonical: the west/north room of the pair, with side 1 (east) or 2 (south)
  if (side === 0) return `${f}:${x}:${z - 1}:2`;
  if (side === 3) return `${f}:${x - 1}:${z}:1`;
  return `${f}:${x}:${z}:${side}`;
}
export function doorShut(s, f, x, z, side) { return (s.doors.get(edgeKey(f, x, z, side)) || 0) > 0; }
export function shutDoor(s, f, x, z, side, secs) { s.doors.set(edgeKey(f, x, z, side), secs); }
export function tickDoors(s, dt) { for (const [k, v] of s.doors) { if (v - dt <= 0) s.doors.delete(k); else s.doors.set(k, v - dt); } }
export function edgeBlocked(s, f, x, z, side) {
  const [dx, dz] = SIDE_DIR[side];
  return doorShut(s, f, x, z, side) || isSealed(s, f, x, z) || isSealed(s, f, x + dx, z + dz);
}

// ---------- floors ----------
export const floorUnlocked = (s, f) => f >= 0 && f <= s.house.maxFloor;
export function travel(s, f) {
  if (!floorUnlocked(s, f)) return false;
  floorState(s, f);
  s.pos.floor = f; s.pos.x = 0; s.pos.z = 0.8; s.pos.yaw = 0;
  return true;
}
// The next floor opens when this floor is Quiet (its Great Tide was held). See tide.js.
export function checkFloorUnlock(s, f) {
  if (f === s.house.maxFloor && floorState(s, f).quiet) { s.house.maxFloor = f + 1; floorState(s, f + 1); return true; }
  return false;
}

// ---------- save ----------
export function serialize(s) {
  const rooms = {};
  for (const [k, r] of s.rooms) if (r.touched || r.visited || r.lit) rooms[k] = R.serializeRoom(r);
  return { v: s.v, seed: s.seed, player: s.player, house: { ...s.house, rooms }, pos: s.pos, lastTs: s.lastTs, settings: s.settings, sortie: s.sortie, bookmark: s.bookmark || null };
}
export function deserialize(o) {
  const s = newGame(o.seed);
  Object.assign(s.player, o.player);
  for (const k of Object.keys(newPlayer())) if (s.player[k] === undefined) s.player[k] = newPlayer()[k];
  s.player.upgrades = { ...newPlayer().upgrades, ...o.player.upgrades };
  s.player.helpers = { ...newPlayer().helpers, ...o.player.helpers };
  s.player.stats = { ...newPlayer().stats, ...o.player.stats };
  const { rooms, ...house } = o.house;
  s.house = { ...s.house, ...house };
  for (const f of Object.keys(s.house.floors)) s.house.floors[f] = { ...newFloor(), ...s.house.floors[f] };
  for (const [k, ro] of Object.entries(rooms || {})) { const r = R.deserializeRoom(ro); if (r.flags.out) { delete r.flags.out; r.lit = true; } s.rooms.set(k, r); }
  s.pos = { ...s.pos, ...o.pos };
  s.lastTs = o.lastTs || 0;
  s.settings = o.settings || {};
  s.sortie = o.sortie || null; s.bookmark = o.bookmark || null;
  if (s.sortie && s.sortie.state === 'extract') s.sortie.extractT = Math.max(s.sortie.extractT, 30);
  recomputeAll(s);
  for (const fl of Object.values(s.house.floors)) {
    fl.lamps = 0;
  }
  for (const [k, r] of s.rooms) { const [f, x, z] = parseKey(k); if (r.lit && !(x === 0 && z === 0) && !r.flags.free) floorState(s, f).lamps++; }
  return s;
}
