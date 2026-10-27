// Pure economy model. No DOM, no three.js: shared by the game and tools/sim.mjs.
import { Big } from '../core/big.js';
import { NODES, NODE_BY_ID, BASE_STATS, TREES } from './data/nodes.js';
import { SYNERGIES, SYNERGY_BY_ID } from './data/synergies.js';
import { PLANET_BY_ID, strataProps } from './data/planets.js';
import { MILESTONES, CREW_MILESTONES } from './data/milestones.js';

export const GROWTH_BASE = 1.25;  // per-level node cost growth with no synergy help
export const RED_CAP = 0.65;      // max growth reduction (1 + 0.25 * 0.35 = 1.09)
export const ACTIVITY = 0.8;      // fraction of time an average player is actively using a tool
// Global tuning knobs (swept by tools/sim.mjs --sweep).
export const TUNE = { area: 1, rich: 1, red: 1, infl: 1.02, damp: 0.08, eff: 1, gb: GROWTH_BASE };

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

export function isUnlocked(e, id) {
  const n = NODE_BY_ID[id];
  return n.parents.every((p) => level(e, p) >= 1);
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
  st.incomeMult = income;
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

export function digVolumeRate(st) {
  const perHit = (4 / 3) * Math.PI * st.digRadius ** 3 * 0.5;
  return perHit * st.digRate * (1 + st.crit * (st.critMult - 1));
}

export function meltVolumeRate(st) {
  if (st.meltTier < 1) return 0;
  return st.meltPower * st.meltEff * (0.6 + 0.45 * st.meltRadius);
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

export function rates(e, st = computeStats(e), activity = ACTIVITY) {
  const hard = hardnessAt(e);
  const d = digVolumeRate(st) / hard;
  const m = meltVolumeRate(st) / hard;
  const dShare = d >= m ? 1 : 0.5, mShare = d >= m ? 0.5 : 1;
  const activeValueVol = (d * dShare * st.digYield + m * mShare);
  const activeVol = d * dShare + m * mShare;
  const autoVol = (st.autoDig + st.autoMelt) / hard;
  const V = baseValuePerM3(e) * valueMult(e, st) * collectEff(st) * bankEff(st);
  const income = (activeValueVol * activity + autoVol) * V;
  const passive = autoVol * V;
  return { income, passive, activeVol: activeVol * activity, autoVol, V, digVol: d, meltVol: m };
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

export function checkMilestones(e, incomePerSec) {
  const hit = [];
  for (const m of MILESTONES) {
    if (e.milestones[m.id]) continue;
    if (m.planet !== '*' && m.planet !== e.planet) continue;
    const ok = (m.kind === 'depth' && e.depth >= m.value) || (m.kind === 'sea' && seaLevelCm(e) >= m.value);
    if (ok) {
      const bonus = Big.fromNumber(Math.max(25, incomePerSec * m.bonusSec));
      e.milestones[m.id] = e.time;
      e.coins = e.coins.add(bonus);
      e.total = e.total.add(bonus);
      hit.push({ m, bonus });
    }
  }
  return hit;
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
  e.melted += (r.meltVol * (r.digVol >= r.meltVol ? 0.5 : 1) * activity + st.autoMelt / hardnessAt(e)) * dt;
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
