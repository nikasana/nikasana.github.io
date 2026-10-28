#!/usr/bin/env node
// Second feedback round: many coin types by layer, coin sizes that change the value, rare chests, the depot
// at the surface with an upgradable delivery speed, upgrade levels that vary (★ milestones), and a depth
// gauge that shows where you are, the deepest point dug and the Golden Needle's depth.
// Usage: node incremental/tools/polish2.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'polish2'));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${opt('--port', '8123')}/index.html`;
const results = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`.slice(0, 300)));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82, timeout: 240000 }); console.log(`      shot ${name}.jpg`); };
async function until(fn, ms = 60000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(300); } return false; }

await page.goto(`${base}?force&dev=1&preset=low&slot=polish2`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; });

// coin types: many, more on later planets, each with its own look
const types = await ev(async () => {
  const P = await import('./src/econ/data/planets.js'), C = await import('./src/econ/data/coins.js');
  const shapes = new Set(C.COINS.map((c) => c.shape));
  return { counts: P.PLANETS.map((p) => p.coinTiers.length), shapes: shapes.size, total: C.COINS.length, sig: P.PLANETS.filter((p) => p.coinTiers.some((id) => C.COIN_BY_ID[id].planet === p.id)).length,
    deepest: Math.max(...C.COINS.map((c) => c.minDepth)), big: C.sizeValue(C.sizeOf(1)) / C.sizeValue(C.sizeOf(0)) };
});
check('Many coin types, more on each later planet', types.counts[0] >= 10 && types.counts.every((n, i) => i === 0 || n >= types.counts[i - 1]) && types.counts.at(-1) >= 16, `${types.total} types, per planet ${types.counts.join('/')}`);
check('Coin types look different (shapes) and reach far down', types.shapes >= 10 && types.deepest >= 1000, `${types.shapes} shapes, deepest from ${types.deepest} m, ${types.sig} planets with a signature coin`);
check('A big coin is worth more than a small one of the same kind', types.big > 4, `largest/smallest value ×${types.big.toFixed(2)}`);

// sizes and chests in the actual ice: dig a shaft so many chunks seed, then count
await ev(() => window.__game.devShaft(60));
await until(() => window.__game.volume.pending() < 4, 90000);
await wait(3000);
const seeded = await ev(() => {
  const g = window.__game, all = [...g.coins.embedded.values()].flat();
  const s = all.map((k) => k.s || 1);
  return { n: all.length, smin: Math.min(...s), smax: Math.max(...s), kinds: new Set(all.map((k) => k.tier)).size };
});
const chestIdx = await ev(async () => (await import('./src/econ/data/coins.js')).CHEST);
const chests = await ev((ci) => [...window.__game.coins.embedded.values()].flat().filter((k) => k.tier === ci).length, chestIdx);
check('Coins in the ice come in different sizes', seeded.smin < 0.8 && seeded.smax > 1.3, `${seeded.n} coins, sizes ${seeded.smin.toFixed(2)}-${seeded.smax.toFixed(2)}, ${seeded.kinds} kinds`);
const share = chests / Math.max(1, seeded.n);
check('Chests are rare: about 1-2.3% of coins', share > 0.004 && share < 0.04, `${chests} chests in ${seeded.n} coins (${(share * 100).toFixed(2)}%)`);
const cv = await ev((ci) => { const g = window.__game; return { chest: g.coinValue(ci, 40), copper: g.coinValue(0, 40) }; }, chestIdx);
check('A chest pays far more than a coin', cv.chest > cv.copper * 20, `chest ${cv.chest.toFixed(2)} vs copper ${cv.copper.toFixed(3)}`);

// the gauge: you are the dot, deep in the shaft; the needle band is gold
const gauge = await ev(() => {
  const d = document.querySelector('.hud-depth'), you = d.querySelector('.you'), nd = d.querySelector('.needle');
  const ticks = [...d.querySelectorAll('.tk span')].map((x) => x.textContent);
  return { top: parseFloat(you.style.top), label: you.textContent, ticks, needle: !nd.hidden, needleTitle: nd.title, oldLines: d.querySelectorAll('u').length };
});
check('Depth gauge: every mark is labelled, from the surface to the goal', gauge.ticks.includes('SURFACE') && gauge.ticks.some((t) => t.startsWith('GOAL')) && gauge.oldLines === 0, gauge.ticks.join(' · '));
check('Depth gauge: a dot shows your depth', gauge.top > 15 && /\d m/.test(gauge.label), `dot at ${gauge.top.toFixed(0)}% "${gauge.label}"`);
check('Depth gauge: the Golden Needle’s depth band shows in gold', gauge.needle, gauge.needleTitle);
await shot('01-gauge-deep');
// climb back up: the dot follows you, the deepest point stays marked
await ev(() => { const g = window.__game, p = g.ctl.pos; g.ctl.teleport(p.x, window.__surfaceY(p.x, p.z) - 10, p.z); });
await wait(1500);
const up = await ev(() => { const d = document.querySelector('.hud-depth'); return { you: parseFloat(d.querySelector('.you').style.top), max: parseFloat(d.querySelector('.max').style.top), maxShown: !d.querySelector('.max').hidden }; });
check('The dot follows you up; the deepest point stays marked', up.you < gauge.top - 5 && up.maxShown && up.max > up.you, JSON.stringify(up));
// needle sense: a diamond at its depth, and a readout with distance and direction when close
await ev(() => { const g = window.__game; g.devLevel('vis_hint', 1); g.ctl.noclip = true; const it = g.frozen.items.find((i) => i.kind === 'needle' && !i.done); const p = it.mesh.position; g.ctl.teleport(p.x + 6, p.y + 3, p.z); });
await wait(2000);
const sense = await ev(() => ({ at: !document.querySelector('.hud-depth .needle-at').hidden, text: document.querySelector('.needle-text')?.hidden ? '' : document.querySelector('.needle-text').textContent }));
check('With Needle Sense: the needle’s depth on the gauge and a distance readout nearby', sense.at && /Needle \d+ m/.test(sense.text), JSON.stringify(sense));
await shot('02-needle-sense');
await ev(() => { window.__game.ctl.noclip = false; });

// the depot: the pack pours in only at the depot, at the delivery speed; upgrades make it faster
const depot = await ev(async () => {
  const g = window.__game, d = g.works.depotPos, c = g.state.carried;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fill = () => { c.count = 60; c.value = 600; c.ids = []; };
  g.ctl.teleport(d.x + 12, g.volume.floorBelow(d.x + 12, d.y + 4, d.z + 10, 10) + 0.05, d.z + 10);
  fill(); await sleep(1500);
  const away = c.count;
  g.ctl.teleport(d.x + 1.2, g.volume.floorBelow(d.x + 1.2, d.y + 3, d.z, 8) + 0.05, d.z);
  await sleep(300); const n0 = c.count, t0 = g.time; await sleep(2000);
  const slow = (n0 - c.count) / (g.time - t0);   // game time: a slow software frame is clamped
  const base = g.stats.deliver;
  g.devLevel('dep_belt', 5); await sleep(300);
  fill(); await sleep(300); const n1 = c.count, t1 = g.time; await sleep(1000);
  const fast = (n1 - c.count) / (g.time - t1);
  return { away, slow, fast, base, up: g.stats.deliver, atDepot: g.atDepot };
});
check('Away from the depot the pack stays full', depot.away === 60, JSON.stringify(depot));
check('At the depot the pack pours in at the delivery speed', depot.slow > depot.base * 0.5 && depot.atDepot, `${depot.slow.toFixed(1)} slots/s (stat ${depot.base})`);
check('Depot upgrades deliver faster', depot.up > depot.base * 1.5 && depot.fast > depot.slow * 1.3, `${depot.slow.toFixed(1)} → ${depot.fast.toFixed(1)} slots/s`);
await ev(() => { const g = window.__game; g.ctl.yaw = 0.6; g.ctl.pitch = -0.1; });
await wait(2500);
await shot('03-depot');

// upgrade levels vary: every 5th level is a ★ milestone that counts three times and costs double
const ms = await ev(async () => {
  const M = await import('./src/econ/model.js');
  const g = window.__game, e = g.econ, id = 'dig_edge', L0 = e.levels[id] || 0;
  const cost = (L) => { e.levels[id] = L; return M.costOf(e, id).toNumber(); };
  const r34 = cost(4) / cost(3), r23 = cost(3) / cost(2), r56 = cost(5) / cost(4);
  e.levels[id] = L0; if (!L0) delete e.levels[id];
  const nodes = M.NODES.length, maxSum = M.NODES.reduce((a, n) => a + n.max, 0);
  const w = (L) => M.milestoneWeight(L, 20);
  return { cost: M.MS_COST, jump: (w(5) - w(4)) / (w(4) - w(3)), w5: w(5), w10: w(10), r34: r34 / r23, r56: r56 / r23, nodes, maxSum };
});
check('Every 5th level is a ★ milestone: counts three times (five levels add up as before)', Math.abs(ms.jump - 3) < 1e-9 && Math.abs(ms.w5 - 5) < 1e-9 && Math.abs(ms.w10 - 10) < 1e-9, JSON.stringify(ms));
check('…and costs more (×MS_COST); the next level drops back', ms.cost >= 1.5 && Math.abs(ms.r34 - ms.cost) < 0.05 && Math.abs(ms.r56 - 1 / ms.cost) < 0.05, `×${ms.r34.toFixed(2)} into level 5, ×${ms.r56.toFixed(2)} after it`);
check('A big tree to keep upgrading', ms.nodes >= 150 && ms.maxSum >= 2000, `${ms.nodes} upgrades, ${ms.maxSum} levels in all`);
await ev(() => { const g = window.__game; g.econ.levels.dig_edge = 4; g.statsDirty = true; g.input.unlock(); g.menus.show('upgrades'); });
await until(() => window.__game.menus.cur === 'upgrades', 10000);
await wait(1500);
const star = await ev(() => { const t = window.__game.menus.tree; t.showTip('dig_edge'); return { star: !!t.nodes.dig_edge.querySelector('.star'), tip: t.tip.textContent.includes('milestone') }; });
check('The tree marks the next milestone level with ★', star.star && star.tip, JSON.stringify(star));
await shot('04-tree-milestone');

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Second feedback round checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
