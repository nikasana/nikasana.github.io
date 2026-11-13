// Pure sorties: a board of three per floor (one per action), extraction, risk, mutators, gadgets.
import { CFG, floorScale } from './config.js';
import { hash32, hashFloat, mulberry32 } from './rng.js';
import * as Game from './game.js';
import * as Signs from './signs.js';
import { floorBiomes, BIOMES, parseKey, roomKey } from './world.js';
import * as Tide from './tide.js';

export const TYPES = { haul: 'clear', check: 'polish', search: 'polish', chain: 'light', line: 'light', hall: 'all' };
export const MUTATORS = ['draft', 'double', 'fog', 'slick', 'echo', 'gold', 'dim', 'quiet'];
export const MUT = {
  draft: { reward: 1.2, tideSpeed: 1.6 },
  double: { reward: 1.3, clearMult: 0.5 },
  fog: { reward: 1.15, fog: 0.45 },
  slick: { reward: 1.1, slick: true },
  echo: { reward: 1.2, echo: true },
  gold: { reward: 1.0, glowMult: 2 },
  dim: { reward: 1.3, strengthMult: 0.6 },
  quiet: { reward: 0.7, noTides: true },
};
export const GADGETS = { balls: 'glowstick', foam: 'soap', paper: 'plane', books: 'bookmark', leaves: 'sprout', popcorn: 'snack' };

const C = CFG.sortie;
export const riskMult = (r) => 1 + C.riskStep * (r - 1);

function reward(s, f, rank) { return Math.round(C.rewardBase * floorScale(f) * Math.pow(C.rewardGrowth, rank)); }

// The board always offers one sortie per action. Every third rank: a Great hall. Rank 10+: a Deep run.
export function board(s, f) {
  const fl = Game.floorState(s, f);
  const n = fl.sortieN || 0;
  if (fl.board && fl.board.n === n) return fl.board.list;
  const rank = fl.rank;
  const rng = mulberry32(hash32(s.house.seed, f, n, 101));
  const list = [];
  const mut = () => MUTATORS[Math.floor(rng() * MUTATORS.length)];
  const [ba, bb] = floorBiomes(s.house.seed, f);
  // clear
  const mat = BIOMES[rng() < 0.7 ? ba : bb].mat;
  list.push({ type: 'haul', action: 'clear', mat, goal: Math.round(180 * (1 + 0.35 * rank)), reward: reward(s, f, rank), mutator: mut() });
  // polish: Search when an unfound Anchor is near, else Check
  const near = Signs.anchorFor(s, f, 0, 0);
  if (rank >= 1 && !Signs.anchorFound(s, f, near) && rng() < 0.5) list.push({ type: 'search', action: 'polish', anchor: [near.x, near.z], goal: 1, reward: Math.round(reward(s, f, rank) * 1.4), mutator: mut() });
  else list.push({ type: 'check', action: 'polish', goal: 2 + Math.floor(rank / 2), reward: reward(s, f, rank), mutator: mut() });
  // light
  if (rng() < 0.5) list.push({ type: 'chain', action: 'light', goal: 3 + Math.floor(rank / 2), reward: reward(s, f, rank), mutator: mut() });
  else {
    const d = 4 + rank, side = Math.floor(rng() * 4), [dx, dz] = Tide.SIDES[side], off = Math.floor((rng() - 0.5) * 3);
    list.push({ type: 'line', action: 'light', target: [dx * d + (dz ? off : 0), dz * d + (dx ? off : 0)], goal: 1, reward: Math.round(reward(s, f, rank) * 1.2), mutator: mut() });
  }
  if (rank > 0 && rank % 3 === 0) {
    const d = 3 + Math.floor(rng() * 2), side = Math.floor(rng() * 4), [dx, dz] = Tide.SIDES[side];
    list.push({ type: 'hall', action: 'all', target: [dx * d, dz * d], goal: 1, reward: reward(s, f, rank) * 3, mutator: mut() });
  }
  if (rank >= 10) list.push({ type: 'deep', action: 'clear', floors: [f, f + 1, f + 2], stage: 0, goal: 3, reward: reward(s, f, rank) * 5, mutator: 'quiet' });
  list.forEach((o, i) => { o.id = `${f}-${n}-${i}`; o.floor = f; });
  fl.board = { n, list };
  return list;
}

export function start(s, offer, risk = 1, loud = false) {
  const so = { ...offer, risk: Math.max(1, Math.min(5, risk)), state: 'active', progress: 0, t: 0, loud: !!(loud && Game.floorState(s, offer.floor).quiet) };
  if (so.type === 'haul') so.base = s.player.materials[so.mat] || 0;
  if (so.type === 'check') so.base = s.player.stats.signs || 0;
  if (so.type === 'hall') { (s.house.halls ||= []).push(roomKey(so.floor, ...so.target)); s.infos.delete(roomKey(so.floor, ...so.target)); s.rooms.delete(roomKey(so.floor, ...so.target)); }
  if (so.type === 'deep') { so.base = s.player.materials; so.stageBase = { ...s.player.materials }; }
  s.sortie = so;
  applyMods(s);
  return so;
}
export function applyMods(s) {
  const so = s.sortie;
  s.mods = so && so.state !== 'done' ? { ...MUT[so.mutator] } : {};
}

// Longest straight run of lit rooms leaving the lift in one direction.
export function chainLength(s, f) {
  let best = 0;
  for (const [dx, dz] of Tide.SIDES) { let n = 0; while (Game.room(s, f, dx * (n + 1), dz * (n + 1)).lit) n++; best = Math.max(best, n); }
  return best;
}
// Is there a 4-connected path of lit rooms from the lift to (tx, tz)?
export function lineReaches(s, f, tx, tz) {
  const seen = new Set(['0:0']), q = [[0, 0]];
  while (q.length) {
    const [x, z] = q.shift();
    if (x === tx && z === tz) return true;
    for (const [dx, dz] of Tide.SIDES) {
      const nx = x + dx, nz = z + dz, k = nx + ':' + nz;
      if (seen.has(k) || !Game.hasRoom(s, f, nx, nz) || !Game.room(s, f, nx, nz).lit) continue;
      seen.add(k); q.push([nx, nz]);
    }
  }
  return false;
}
function closestLit(s, f, tx, tz) {
  let best = Math.abs(tx) + Math.abs(tz);
  for (const [k, r] of s.rooms) { const [rf, x, z] = parseKey(k); if (rf === f && r.lit) best = Math.min(best, Math.abs(tx - x) + Math.abs(tz - z)); }
  return best;
}

// Progress 0..goal; when met the lift bell rings and extraction starts.
export function update(s, dt) {
  const so = s.sortie; if (!so) return null;
  so.t += dt;
  const f = so.floor;
  if (so.state === 'active') {
    switch (so.type) {
      case 'haul': so.progress = Math.floor((s.player.materials[so.mat] || 0) - so.base); break;
      case 'check': so.progress = (s.player.stats.signs || 0) - so.base; break;
      case 'search': so.progress = Signs.anchorFound(s, f, { x: so.anchor[0], z: so.anchor[1] }) ? 1 : 0; break;
      case 'chain': so.progress = chainLength(s, f); break;
      case 'line': so.progress = lineReaches(s, f, ...so.target) ? 1 : 0; so.dist = closestLit(s, f, ...so.target); break;
      case 'hall': { const r = Game.room(s, f, ...so.target); so.progress = r.clearedDone && r.polishedDone && r.lit ? 1 : 0; break; }
      case 'deep': {
        const fl = so.floors[so.stage]; const mats = Object.values(s.player.materials).reduce((a, b) => a + b, 0) - Object.values(so.stageBase).reduce((a, b) => a + b, 0);
        if (s.pos.floor === fl && mats >= 150 * (1 + so.stage)) { so.stage++; so.stageBase = { ...s.player.materials }; }
        so.progress = so.stage; break;
      }
    }
    if (so.progress >= so.goal) {
      so.state = 'extract'; so.extractT = C.extractTime;
      return { event: 'extract' };
    }
    return null;
  }
  if (so.state === 'extract') {
    so.extractT -= dt;
    if (so.extractT <= 0) return finish(s, false);
  }
  return null;
}
export const inCabin = (s) => { const S = 8 + 2 * s.pos.floor > 30 ? 30 : 8 + 2 * s.pos.floor; return Math.round(s.pos.x / S) === 0 && Math.round(s.pos.z / S) === 0; };

// Pay out. clean: reached the cabin within the extraction time (+50 %).
export function finish(s, clean) {
  const so = s.sortie; if (!so || so.state === 'done') return null;
  const fl = Game.floorState(s, so.floor);
  let pay = so.reward * riskMult(so.risk) * (MUT[so.mutator]?.reward || 1) * (so.loud ? 2 : 1);
  if (clean) pay *= 1 + C.cleanExit;
  if (s.player.rested > 0) { pay *= 2; s.player.rested--; so.rested = true; }
  pay = Math.round(pay);
  Game.addGlow(s, pay);
  fl.sortiePts ||= { clear: 0, polish: 0, light: 0 };
  const pts = Tide.ROOMS_PER_RANK;
  if (so.action === 'all') { fl.sortiePts.clear += pts; fl.sortiePts.polish += pts; fl.sortiePts.light += pts; }
  else fl.sortiePts[so.action] += pts;
  fl.sortieN = (fl.sortieN || 0) + 1;
  s.player.stats.sorties++;
  if (clean) s.player.stats.cleanExits = (s.player.stats.cleanExits || 0) + 1;
  so.state = 'done'; so.paid = pay; so.clean = clean;
  s.sortie = null; s.mods = {};
  Tide.updateRank(s, so.floor);
  return { event: 'done', pay, clean, so };
}
export function abandon(s) { s.sortie = null; s.mods = {}; }

// Risk: stronger and more frequent Tides while a sortie is out.
export function riskTide(s, dt) {
  const so = s.sortie; if (!so || so.state !== 'active' || (s.mods && s.mods.noTides) || s.tide) return null;
  s.riskT = (s.riskT || 0) + dt * (0.5 + 0.25 * so.risk);
  if (s.riskT < CFG.tide.randomEvery * 0.6) return null;
  s.riskT = 0;
  if (Game.floorState(s, so.floor).litCount < 2) return null;
  return Tide.startWave(s, so.floor, { kind: 'random', risk: 1 + 0.15 * (so.risk - 1) });
}

// ---------- gadgets: one consumable per biome material ----------
export const gadgetCost = () => CFG.gadgetCost;
export function buyGadget(s, mat) {
  const c = gadgetCost();
  if ((s.player.materials[mat] || 0) < c) return false;
  s.player.materials[mat] -= c;
  const g = GADGETS[mat]; s.player.gadgets[g] = (s.player.gadgets[g] || 0) + 1;
  return true;
}
