// Pure economy model. No DOM, no three.js: shared by the game and tools/sim.mjs.
import { Big } from '../core/big.js';
import { NODES, NODE_BY_ID, BASE_STATS, TREES } from './data/nodes.js';
import { SYNERGIES, SYNERGY_BY_ID } from './data/synergies.js';
import { PLANET_BY_ID, strataProps } from './data/planets.js';
import { MILESTONES, CREW_MILESTONES, ROLE_BY_ID } from './data/milestones.js';

export const GROWTH_BASE = 1.25;  // per-level node cost growth with no synergy help
export const RED_CAP = 0.65;      // max growth reduction (1 + 0.25 * 0.35 = 1.09)
export const ACTIVITY = 0.8;      // fraction of time an average player is actively using a tool
// Global tuning knobs (swept by tools/sim.mjs --sweep).
export const TUNE = { area: 1, rich: 1, red: 1, infl: 1.04, damp: 0.08, eff: 1, gb: GROWTH_BASE };

export function createEcon(planetId = 'frostara', pole = 'N', opts = {}) {
  return {
    planet: planetId,
    pole,
    coins: Big.ZERO,
    total: Big.ZERO,          // lifetime earned on this planet
    levels: {},
    order: {},                // nodeId -> purchase index of first level
    purchases: 0,
    inflation: 0,             // log10 of accumulated purchase inflation (damped by active resonances)
    buyLog: [],               // recent [{id, tree, t}]
    time: 0,
    depth: 0,
    volume: 0,                // m³ removed
    melted: 0,                // m³ melted (drives sea level)
    actions: { meltThenDig: 0, richDig: 0 },
    mutations: {},            // mutant ice types found (unlock DNA nodes)
    found: {},                // synergyId -> time discovered
    burstUntil: 0,
    milestones: {},
    scale: opts.scale ?? 1,   // cost scale (re-scaling on planet arrival)
    legacy: opts.legacy ?? 1, // income multiplier carried from earlier planets
    crew: {},                 // crew milestone bonuses {income, dig}
    devFlag: false,
  };
}

export const level = (e, id) => e.levels[id] || 0;

// Choice nodes share an `excl` group: owning one locks the others for this planet.
export function lockedBy(e, id) {
  const n = NODE_BY_ID[id];
  if (!n.excl) return null;
  return NODES.find((o) => o.excl === n.excl && o.id !== id && level(e, o.id) >= 1) || null;
}

export function isUnlocked(e, id) {
  const n = NODE_BY_ID[id];
  return n.parents.every((p) => level(e, p) >= 1) && !lockedBy(e, id) && (!n.mutation || !!(e.mutations || {})[n.mutation]);
}

export function isMaxed(e, id) { return level(e, id) >= NODE_BY_ID[id].max; }

export function available(e) {
  return NODES.filter((n) => isUnlocked(e, n.id) && !isMaxed(e, n.id));
}

// ---------- synergies ----------

function condHolds(e, s) {
  const w = s.when;
  switch (w.type) {
    case 'order': return e.order[w.first] !== undefined && e.order[w.then] !== undefined && e.order[w.first] < e.order[w.then];
    case 'levels': return Object.entries(w.req).every(([id, l]) => level(e, id) >= l);
    case 'balance': {
      const a = level(e, w.a), b = level(e, w.b);
      return a >= w.min && b >= w.min && Math.abs(a - b) <= w.maxDiff;
    }
    case 'equal': { const a = level(e, w.a), b = level(e, w.b); return a >= w.min && a === b; }
    case 'action': return (e.actions[w.action] || 0) >= w.count;
    case 'burst': return e.time < e.burstUntil;
    default: return false;
  }
}

// Active now. Order/action synergies stay on once found; balance/equal/burst can lapse.
export function activeSynergies(e) {
  const out = [];
  for (const s of SYNERGIES) {
    const t = s.when.type;
    if ((t === 'order' || t === 'action') && e.found[s.id] !== undefined) { out.push(s); continue; }
    if (condHolds(e, s)) out.push(s);
  }
  return out;
}

// Returns synergies newly discovered by the current state (and records them).
export function discover(e) {
  const fresh = [];
  for (const s of SYNERGIES) {
    if (e.found[s.id] !== undefined) continue;
    if (condHolds(e, s)) { e.found[s.id] = e.time; fresh.push(s); }
  }
  return fresh;
}

const ALL_IDS = NODES.map((n) => n.id);

function reductions(active) {
  const red = {};
  for (const s of active) {
    const r = s.gives.red;
    if (!r) continue;
    const ids = r.nodes === '*' ? ALL_IDS : r.nodes;
    for (const id of ids) red[id] = 1 - (1 - (red[id] || 0)) * (1 - Math.min(0.9, r.r * TUNE.red));
  }
  return red;
}

// ---------- stats ----------

export function computeStats(e, active = activeSynergies(e)) {
  const st = { ...BASE_STATS };
  const muls = {};
  for (const n of NODES) {
    const L = level(e, n.id);
    if (!L) continue;
    for (const [stat, op, v] of n.effects) {
      if (op === 'add') st[stat] += v * L * TUNE.eff;
      else if (op === 'mul') muls[stat] = (muls[stat] || 1) * Math.pow(1 + v * TUNE.eff, L);
      else if (op === 'set') st[stat] = Math.max(st[stat], v);
    }
  }
  for (const [k, m] of Object.entries(muls)) st[k] *= m;
  let income = e.legacy;
  for (const s of active) {
    if (s.gives.income) income *= s.gives.income;
    if (s.gives.stats) for (const [k, m] of Object.entries(s.gives.stats)) st[k] *= m;
  }
  if (e.crew.income) income *= e.crew.income;
  if (e.crew.dig) st.digRate *= e.crew.dig;
  if (e.crew.melt) st.meltPower *= e.crew.melt;
  // Crew Roles: your specialty, and the shared bonus for a mixed crew (set by the game while in a crew)
  const role = e.role && ROLE_BY_ID[e.role];
  if (role) st[role.stat[0]] *= role.stat[1];
  if (e.roleMix) income *= e.roleMix;
  st.incomeMult = income;
  st.autoDig += st.autoMelt * st.pipes;
  st.autoDig *= st.autoAll;
  st.autoMelt *= st.autoAll;
  return st;
}

// ---------- costs ----------

export function growthOf(e, id, red) {
  red = red || reductions(activeSynergies(e));
  const r = Math.min(RED_CAP, red[id] || 0);
  return 1 + (TUNE.gb - 1) * (1 - r);
}

export function costOf(e, id, red) {
  const n = NODE_BY_ID[id];
  const L = level(e, id);
  const g = growthOf(e, id, red);
  // per-level growth (strategy dependent) plus gentle inflation from total purchases on this planet
  return Big.fromNumber(n.c0 * e.scale).mul(Big.pow10(L * Math.log10(g) + e.inflation));
}

export function costTable(e) {
  const red = reductions(activeSynergies(e));
  const out = {};
  for (const n of NODES) out[n.id] = { cost: costOf(e, n.id, red), growth: growthOf(e, n.id, red) };
  return out;
}

// Every purchase inflates all prices a little; each active resonance damps that inflation.
// A coherent build therefore keeps its costs flat for longer.
export function inflationStep(activeCount) {
  return Math.log10(TUNE.infl) * (1 - Math.min(0.85, TUNE.damp * activeCount));
}

export function buy(e, id) {
  if (!isUnlocked(e, id) || isMaxed(e, id)) return null;
  const c = costOf(e, id);
  if (e.coins.lt(c)) return null;
  e.coins = e.coins.sub(c);
  const n = NODE_BY_ID[id];
  const g = growthOf(e, id);
  e.inflation += inflationStep(activeSynergies(e).length);
  e.levels[id] = level(e, id) + 1;
  if (e.order[id] === undefined) e.order[id] = e.purchases;
  e.purchases++;
  e.buyLog.push({ id, tree: n.tree, t: e.time });
  if (e.buyLog.length > 12) e.buyLog.shift();
  const recent = e.buyLog.filter((b) => b.tree === n.tree && e.time - b.t <= SYNERGY_BY_ID.rhythm.when.within);
  if (recent.length >= SYNERGY_BY_ID.rhythm.when.count) {
    e.burstUntil = e.time + SYNERGY_BY_ID.rhythm.when.hold;
    e.buyLog = e.buyLog.filter((b) => b.tree !== n.tree);
  }
  const fresh = discover(e);
  return { cost: c, growth: g, fresh };
}

// ---------- income ----------

export function planetOf(e) { return PLANET_BY_ID[e.planet]; }

export function baseValuePerM3(e, depth = e.depth) {
  const p = planetOf(e);
  const sp = strataProps(p, e.pole, depth);
  return p.density * Math.pow(1 + depth / p.depthScale, p.richExp * TUNE.rich) * sp.rich;
}

export function hardnessAt(e, depth = e.depth) {
  return strataProps(planetOf(e), e.pole, depth).hard * (1 + depth / 2500);
}

// Average clean-break chance: rich seams (about 40% of struck ice) add richCrit.
export function critChance(st) { return Math.min(0.9, st.crit + (st.richCrit || 0) * 0.4); }

export function digVolumeRate(st) {
  const perHit = (4 / 3) * Math.PI * st.digRadius ** 3 * 0.5;
  // an occasional heavy strike: its crater grows with the cube of heavyMult
  const heavy = 1 + 0.08 * (Math.pow(st.heavyMult || 1.55, 3) / 3.72 - 1);
  return perHit * st.digRate * (1 + critChance(st) * (st.critMult - 1)) * heavy;
}

export function meltVolumeRate(st) {
  if (st.meltTier < 1 && !(st.planetTier >= 1)) return 0;
  const hand = st.meltTier >= 1 ? st.meltPower * st.meltEff * (0.6 + 0.45 * st.meltRadius) : 0;
  // the satellite mirrors add a gentle, wide melt the player can point while they work
  const mirror = st.planetTier >= 1 ? (st.mirrorPower || 0) * 0.8 * st.meltEff : 0;
  return hand + mirror;
}

// Collection and banking efficiency. Not capped at 1: in the world, the part above 1 is paid
// out as bonus value at banking, so these nodes never go dead.
export function collectEff(st) {
  return 0.42 + 0.22 * Math.log(1 + st.collectRange) + st.collect + st.autoCollect;
}

export function bankEff(st) {
  return 0.55 + 0.11 * Math.log(1 + st.carry / 40) + 0.08 * Math.log(1 + st.liftSpeed / 1.5) + st.bank;
}

// Coin value multiplier applied at banking (tier value x this).
export function valueMult(e, st) {
  return st.valueMult * st.vision * st.incomeMult;
}

// The player holds one tool at a time. Swapping pays: ice warmed by the torch digs out wider
// (shock) and ice cracked by the pick melts faster (seep). The best split of time between the two
// tools decides the active rate, so a build that grows both tools together earns the most.
const SPLITS = [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0];
export function toolMix(st, d, m) {
  const shock = st.shock * (1 + 0.5 * (st.steamBurst || 0));
  let best = { f: 1, vol: d, val: d * st.digYield, meltVol: 0 };
  if (m <= 0) return best;
  for (const f of SPLITS) {
    const warm = Math.min(1, 1.6 * (1 - f) * st.heatLinger);   // share of digging done on warm ice
    const cracked = Math.min(1, 1.6 * f);                        // share of melting done on cracked ice
    const dv = f * d * (1 + shock * warm), mv = (1 - f) * m * (1 + st.seep * cracked);
    const val = dv * st.digYield + mv;
    if (val > best.val) best = { f, vol: dv + mv, val, meltVol: mv };
  }
  return best;
}

// Gale: storms weaken melting; calm windows make it pay double. Averaged over the weather cycle,
// assuming the player melts as much in the calm as they can (Storm Shields soften the storms).
export function weatherMeltFactor(e, st) {
  const w = planetOf(e).weather;
  if (!w) return 1;
  const storm = (w.storm[0] + w.storm[1]) / 2, calm = (w.calm[0] + w.calm[1]) / 2;
  const base = e.pole === 'S' ? (w.meltInStorm + 1) / 2 : w.meltInStorm;   // the South pole is sheltered
  const inStorm = base + (1 - base) * Math.min(1, st.stormShield || 0);
  return (storm * inStorm + calm * w.calmBonus) / (storm + calm);
}

// Auralis: part of the income falls from the sky (auroras and lone sky coins), paid at income rate.
export function skyIncomeFactor(e, st) {
  const a = planetOf(e).aurora;
  if (!a) return 1;
  return 1 + a[e.pole].share * (1 + 0.5 * (st.auroraCoins || 0) + 0.5 * (st.auroraRate || 0));
}

export function rates(e, st = computeStats(e), activity = ACTIVITY) {
  if (activity > 0) activity = Math.min(1, activity + 0.12 * (st.autoTool || 0));   // Auto Swing fills the idle moments
  const hard = hardnessAt(e);
  const d = digVolumeRate(st) / hard;
  const m = meltVolumeRate(st) / hard * weatherMeltFactor(e, st);
  const mix = toolMix(st, d, m);
  const autoVol = (st.autoDig + st.autoMelt) / hard;
  const V = baseValuePerM3(e) * valueMult(e, st) * collectEff(st) * bankEff(st);
  const sky = skyIncomeFactor(e, st);
  const income = (mix.val * activity + autoVol) * V * sky;
  const passive = autoVol * V * sky;
  return { income, passive, activeVol: mix.vol * activity, autoVol, V, digVol: d, meltVol: m, mix };
}

export function shaftArea(st) {
  const r = Math.max(st.digRadius, st.meltTier ? st.meltRadius : 0);
  return (16 + 9 * r * r) * TUNE.area;
}

// Sea level rise (cm) from melted volume; heat spread 0..1 from depth and volume.
export function seaLevelCm(e) { return 5 * Math.pow(e.melted / 6000, 0.6); }
export function heatSpread(e) {
  const p = planetOf(e);
  return Math.min(1, 0.6 * Math.log10(1 + e.volume) / 6 + 0.4 * e.depth / p.goalDepth);
}

// ---------- milestones ----------

// pay: false records milestones without paying their one-off bonus (the sim measures the steady curve)
export function checkMilestones(e, incomePerSec, pay = true) {
  const hit = [];
  for (const m of MILESTONES) {
    if (e.milestones[m.id]) continue;
    if (m.planet !== '*' && m.planet !== e.planet) continue;
    const ok = (m.kind === 'depth' && e.depth >= m.value) || (m.kind === 'sea' && seaLevelCm(e) >= m.value)
      || (m.kind === 'volume' && e.volume >= m.value) || (m.kind === 'heat' && heatSpread(e) >= m.value)
      || (m.kind === 'act' && (e.actions[m.key] || 0) >= m.value);
    if (ok) { if (pay) hit.push(awardMilestone(e, m, incomePerSec)); else e.milestones[m.id] = e.time; }
  }
  return hit;
}

export function awardMilestone(e, m, incomePerSec) {
  const bonus = Big.fromNumber(Math.max(25, incomePerSec * m.bonusSec));
  e.milestones[m.id] = e.time;
  e.coins = e.coins.add(bonus);
  e.total = e.total.add(bonus);
  return { m, bonus };
}

export function applyCrewBonuses(e, crewDone) {
  e.crew = {};
  for (const m of CREW_MILESTONES) {
    if (!crewDone[m.id]) continue;
    for (const [k, v] of Object.entries(m.bonus)) e.crew[k] = (e.crew[k] || 1) * v;
  }
}

// ---------- time ----------

export function earn(e, amount) {
  const b = Big.from(amount);
  e.coins = e.coins.add(b);
  e.total = e.total.add(b);
}

// Abstract tick used by the simulation and by offline progress.
export function simTick(e, dt, st, activity = ACTIVITY) {
  const r = rates(e, st, activity);
  earn(e, r.income * dt);
  const vol = (r.activeVol + r.autoVol) * dt;
  e.volume += vol;
  e.melted += (r.mix.meltVol * activity + st.autoMelt / hardnessAt(e)) * dt;
  e.depth += vol / shaftArea(st);
  e.time += dt;
  return r;
}

export function offlineGain(e, seconds) {
  const st = computeStats(e);
  const t = Math.min(seconds, 8 * 3600);
  const r = rates(e, st, 0);
  const coins = r.passive * t * Math.min(1, st.offline);
  return { seconds: t, coins, volume: r.autoVol * t * Math.min(1, st.offline) };
}

// ---------- planet travel ----------

// Legacy carried to the next planet: grows with coins earned, depth reached and time spent here.
export function legacyFor(e) {
  const p = planetOf(e);
  const total = e.total.toNumber ? e.total.toNumber() : Number(e.total);
  const k = 1 + 0.15 * Math.log10(1 + total) + 0.4 * Math.min(1, e.depth / p.goalDepth) + 0.2 * Math.min(1, e.time / 3600);
  return e.legacy * k;
}

// Arrival on a new planet: income carries the legacy; costs are re-scaled to it (and to the planet's
// coin density), so the first upgrade there is about as quick as the first upgrade on planet 1.
export function travelOpts(e, nextId) {
  const legacy = legacyFor(e);
  const next = PLANET_BY_ID[nextId], first = PLANET_BY_ID.frostara;
  return { legacy, scale: legacy * (next.density / first.density) };
}

export function nextPlanet(e) {
  const list = Object.values(PLANET_BY_ID);
  const i = list.findIndex((p) => p.id === e.planet);
  return list.slice(i + 1).find((p) => p.available) || null;
}

// Next-goal helper: the cheapest affordable-soon node.
export function nextGoal(e) {
  const red = reductions(activeSynergies(e));
  let best = null;
  for (const n of available(e)) {
    const c = costOf(e, n.id, red);
    if (!best || c.lt(best.cost)) best = { id: n.id, cost: c };
  }
  return best;
}

export { NODES, NODE_BY_ID, TREES, SYNERGIES, SYNERGY_BY_ID, reductions };
