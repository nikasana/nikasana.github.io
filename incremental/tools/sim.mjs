#!/usr/bin/env node
// Headless economy simulation. Imports the same pure econ modules the game uses.
// Usage: node incremental/tools/sim.mjs [--write] [--minutes 120] [--seeds 5]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as M from '../src/econ/model.js';
import { PLANETS } from '../src/econ/data/planets.js';
import { SYNERGIES } from '../src/econ/data/synergies.js';
import { rng } from '../src/core/rng.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const WRITE = args.includes('--write');
const MAX_MIN = opt('--minutes', 120);
const SEEDS = opt('--seeds', 5);
const DT = 0.25;
export const SIMCFG = { horizon: 6 };
let RANDOM_HORIZON = 6;

// ---------------- bots ----------------

function incomeWith(e, id) {
  const before = e.levels[id] || 0;
  e.levels[id] = before + 1;
  const ord = e.order[id];
  if (ord === undefined) e.order[id] = e.purchases;
  const inc = M.rates(e, M.computeStats(e)).income;
  e.levels[id] = before;
  if (before === 0) delete e.levels[id];
  if (ord === undefined) delete e.order[id];
  return inc;
}

// Long-run value of a node beyond its immediate income (unlocks children, tool tiers).
function strategicValue(e, n) {
  let v = 0;
  if (n.gate) v += 0.6;
  if ((e.levels[n.id] || 0) === 0) {
    const kids = M.NODES.filter((c) => c.parents.includes(n.id));
    v += 0.03 * kids.length;
  }
  return v;
}

const bots = {
  random: (r) => {
    // A naive player: picks uniformly at random among nodes priced up to RANDOM_HORIZON times
    // the cheapest one, ignoring value and synergies.
    let target = null;
    return (e) => {
      const av = M.available(e);
      if (!av.length) return [];
      if (!target || !av.find((n) => n.id === target)) {
        const t = M.costTable(e);
        const cheapest = Math.min(...av.map((n) => t[n.id].cost.toNumber()));
        const lim = Math.max(cheapest * RANDOM_HORIZON, e.coins.toNumber());
        const near = av.filter((n) => t[n.id].cost.toNumber() <= lim);
        target = near.length ? r.pick(near).id : av.reduce((a, b) => (t[a.id].cost.lt(t[b.id].cost) ? a : b)).id;
      }
      if (e.coins.gte(M.costOf(e, target))) { const id = target; target = null; return [id]; }
      return [];
    };
  },
  cheapest: () => (e) => {
    const t = M.costTable(e);
    let best = null;
    for (const n of M.available(e)) if (!best || t[n.id].cost.lt(t[best].cost)) best = n.id;
    return best && e.coins.gte(t[best].cost) ? [best] : [];
  },
  roi: () => {
    let target = null;
    return (e) => {
      if (!target || M.isMaxed(e, target)) {
        const t = M.costTable(e);
        const inc = M.rates(e, M.computeStats(e)).income;
        let best = null, bestScore = Infinity;
        for (const n of M.available(e)) {
          const c = t[n.id].cost.toNumber();
          const gain = Math.max(1e-12, incomeWith(e, n.id) - inc) + inc * strategicValue(e, n) * 0.05;
          const score = c / gain + c / inc; // payback + time to afford
          if (score < bestScore) { bestScore = score; best = n.id; }
        }
        target = best;
      }
      if (target && e.coins.gte(M.costOf(e, target))) { const id = target; target = null; return [id]; }
      return [];
    };
  },
  synergy: () => {
    // ROI play plus knowledge of the resonances: respects order rules, never breaks
    // an active pairing, and counts cost-growth reductions as part of a node's value.
    let target = null;
    const orderRules = SYNERGIES.filter((s) => s.when.type === 'order').map((s) => s.when);
    const pairs = SYNERGIES.filter((s) => s.when.type === 'balance' || s.when.type === 'equal');
    function breaks(e, id) {
      let pen = 0;
      for (const s of pairs) {
        const w = s.when;
        if (id !== w.a && id !== w.b) continue;
        const a = (e.levels[w.a] || 0) + (id === w.a ? 1 : 0), b = (e.levels[w.b] || 0) + (id === w.b ? 1 : 0);
        const lim = w.type === 'equal' ? 1 : w.maxDiff; // equal pairs may sit one apart for one purchase
        if (Math.abs(a - b) > lim) pen += 1 + s.gives.red.nodes.length * 0.4;
      }
      return pen;
    }
    return (e) => {
      if (!target || M.isMaxed(e, target)) {
        const t = M.costTable(e);
        const inc = M.rates(e, M.computeStats(e)).income;
        let best = null, bestScore = Infinity;
        for (const n of M.available(e)) {
          // honour an order rule only while the first node is not much dearer than the second
          if (orderRules.some((o) => n.id === o.then && !(e.levels[o.first] >= 1) && M.isUnlocked(e, o.first)
            && t[o.first].cost.toNumber() < 2.5 * t[n.id].cost.toNumber())) continue;
          const c = t[n.id].cost.toNumber();
          const gain = Math.max(1e-12, incomeWith(e, n.id) - inc) + inc * strategicValue(e, n) * 0.05;
          const disc = Math.pow(t[n.id].growth / M.TUNE.gb, 4);
          const score = (c / gain + c / inc) * disc * (1 + breaks(e, n.id));
          if (score < bestScore) { bestScore = score; best = n.id; }
        }
        target = best;
      }
      if (target && e.coins.gte(M.costOf(e, target))) { const id = target; target = null; return [id]; }
      return [];
    };
  },
};

// The synergy bot also plays well in the world: it warms ice before digging and reads the gradient.
function worldActions(e, botName, st, dt, r) {
  const skilled = botName === 'synergy';
  const rate = skilled ? 1 : botName === 'roi' ? 0.3 : botName === 'cheapest' ? 0.12 : 0.01;
  if (st.meltTier >= 1 && r() < rate * dt * 0.2) e.actions.meltThenDig++;
  if (st.visionTier >= 1 && r() < rate * dt * 0.5) e.actions.richDig++;
}

// ---------------- run ----------------

function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }

function slope(xs, ys) {
  const n = xs.length; if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : 0;
}

export function runBot(planetId, pole, botName, seed) {
  RANDOM_HORIZON = SIMCFG.horizon;
  const r = rng(seed * 7919 + botName.length);
  const e = M.createEcon(planetId, pole);
  const choose = bots[botName](r);
  const p = PLANETS.find((x) => x.id === planetId);
  const waits = [], growths = [], times = [];
  let last = 0, goalAt = null, st = M.computeStats(e);
  const activeCount = {}, lastCost = {};
  while (e.time < MAX_MIN * 60) {
    const rr = M.simTick(e, DT, st);
    worldActions(e, botName, st, DT, r);
    M.checkMilestones(e, rr.income);
    let changed = M.discover(e).length > 0;
    for (const id of choose(e)) {
      const res = M.buy(e, id);
      if (!res) continue;
      // effective growth: this level's price over the previous level's price of the same node
      if (lastCost[id]) growths.push(res.cost.ratio(lastCost[id]));
      lastCost[id] = res.cost;
      waits.push(e.time - last); times.push(e.time);
      if (process.env.SIM_TRACE) for (const a of M.activeSynergies(e)) activeCount[a.id] = (activeCount[a.id] || 0) + 1;
      last = e.time; changed = true;
    }
    if (changed || e.time % 5 < DT) st = M.computeStats(e);
    if (goalAt === null && e.depth >= p.goalDepth) { goalAt = e.time; break; }
  }
  // rolling median wait
  const W = 21, idx = [], med = [];
  for (let i = 0; i < waits.length; i++) {
    const s = waits.slice(Math.max(0, i - W + 1), i + 1);
    idx.push(i); med.push(median(s));
  }
  const tail = Math.floor(waits.length * 0.05);
  const drift = slope(idx.slice(tail), med.slice(tail)) * 100; // seconds per 100 purchases
  const phase = (a, b) => median(waits.filter((_, i) => times[i] >= a * 60 && times[i] < b * 60));
  const lastMin = (goalAt ?? e.time) / 60;
  return {
    bot: botName, purchases: waits.length, first: waits[0] ?? null,
    drift, growth: Math.exp(growths.reduce((a, b) => a + Math.log(b), 0) / Math.max(1, growths.length)),
    early: phase(0, 10), mid: phase(lastMin * 0.45, lastMin * 0.55), late: phase(lastMin * 0.85, lastMin),
    peak: Math.max(...waits), p95: [...waits].sort((a, b) => a - b)[Math.floor(waits.length * 0.95)] ?? 0,
    goalMin: goalAt !== null ? goalAt / 60 : null, depth: e.depth, synergies: Object.keys(e.found).length,
    sea: M.seaLevelCm(e), milestones: Object.keys(e.milestones),
    waveShare: waveShare(waits), activeCount, waits,
  };
}

// fraction of waits that are "long" (> 2.5x the local median): the wave peaks
function waveShare(w) {
  let long = 0;
  for (let i = 10; i < w.length; i++) if (w[i] > 2.5 * median(w.slice(i - 10, i))) long++;
  return long / Math.max(1, w.length - 10);
}

function avg(rs, k) {
  const v = rs.map((x) => x[k]).filter((x) => x !== null && x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

const fmt = (x, d = 1) => (x === null || x === undefined ? '—' : Number(x).toFixed(d));

function main() {
  const lines = [];
  const L = (s = '') => { lines.push(s); console.log(s); };
  L('# Economy simulation report');
  L();
  L(`Generated by \`tools/sim.mjs\` (${SEEDS} seeds per bot, ${DT}s step, ${MAX_MIN} min cap). Waits are seconds between purchases.`);
  L('Drift is the slope of the rolling median wait (window 21) in seconds per 100 purchases.');
  L('Growth is the effective per-level cost growth a bot felt: geometric mean of each level\'s price over the previous level\'s price of the same node (node growth, synergy reductions and purchase inflation together).');
  L();
  const verdicts = [];
  for (const p of PLANETS.filter((x) => x.available)) {
    for (const pole of ['N', 'S']) {
      L(`## ${p.icon} ${p.name}, ${pole === 'N' ? 'North' : 'South'} pole (${p.poles[pole].name})`);
      L();
      L('| bot | purchases | first wait | early median | mid median | late median | p95 | peak | drift | growth | goal (min) | synergies | wave peaks |');
      L('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
      const res = {};
      for (const b of Object.keys(bots)) {
        const rs = [];
        for (let s = 1; s <= SEEDS; s++) rs.push(runBot(p.id, pole, b, s));
        res[b] = {
          purchases: avg(rs, 'purchases'), first: avg(rs, 'first'), drift: avg(rs, 'drift'), growth: avg(rs, 'growth'),
          early: avg(rs, 'early'), mid: avg(rs, 'mid'), late: avg(rs, 'late'), peak: avg(rs, 'peak'), p95: avg(rs, 'p95'),
          goalMin: avg(rs, 'goalMin'), syn: avg(rs, 'synergies'), wave: avg(rs, 'waveShare'), done: rs.filter((x) => x.goalMin !== null).length,
        };
        const x = res[b];
        L(`| ${b} | ${fmt(x.purchases, 0)} | ${fmt(x.first, 2)} | ${fmt(x.early)} | ${fmt(x.mid)} | ${fmt(x.late)} | ${fmt(x.p95)} | ${fmt(x.peak)} | ${fmt(x.drift, 2)} | ${fmt(x.growth, 3)} | ${x.done ? fmt(x.goalMin) : '—'}${x.done < SEEDS ? ` (${x.done}/${SEEDS})` : ''} | ${fmt(x.syn, 1)} | ${fmt(x.wave * 100, 0)}% |`);
      }
      const order = res.random.drift > res.cheapest.drift && res.cheapest.drift > res.roi.drift && res.roi.drift > res.synergy.drift;
      const flat = Math.abs(res.synergy.drift) < 1.0;
      const first = Object.values(res).every((x) => x.first <= 3);
      L();
      L(`- Drift ordering random > cheapest > ROI > synergy: **${order ? 'PASS' : 'FAIL'}**`);
      L(`- Synergy drift near zero (|drift| < 1 s/100): **${flat ? 'PASS' : 'FAIL'}** (${fmt(res.synergy.drift, 2)})`);
      L(`- First-upgrade wait about 2 s for every bot: **${first ? 'PASS' : 'FAIL'}**`);
      L();
      verdicts.push(order && flat && first);
    }
  }
  L(`Overall: **${verdicts.every(Boolean) ? 'PASS' : 'FAIL'}**`);
  if (WRITE) {
    const here = dirname(fileURLToPath(import.meta.url));
    writeFileSync(join(here, 'sim-report.md'), lines.join('\n') + '\n');
    console.log('\nwrote tools/sim-report.md');
  }
  process.exitCode = verdicts.every(Boolean) ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
