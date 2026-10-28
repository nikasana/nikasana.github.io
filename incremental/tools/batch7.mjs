#!/usr/bin/env node
// Batch 7 checks with Playwright: Omega (every rule combined), its climax in the final 15%, the All Rivers
// medley theme, Omega's capsules and milestones, travel from Auralis, and the seven-planet sim report.
// Usage: node incremental/tools/batch7.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch7'));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${opt('--port', '8123')}/index.html`;
const results = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

// the economy side first: the sim report covers all seven planets and passes
const report = readFileSync(join(here, 'sim-report.md'), 'utf8');
const planetsInReport = (report.match(/^## .*pole/gm) || []).length;
check('Sim report covers all seven planets (14 poles) and passes', planetsInReport === 14 && /Overall: \*\*PASS\*\*/.test(report) && report.includes('Omega'), `${planetsInReport} poles`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`.slice(0, 300)));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82, timeout: 240000 }); console.log(`      shot ${name}.jpg`); };

await page.goto(`${base}?force&preset=low&dev=1&slot=batch7`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });

// Auralis completed: the travel screen offers Omega
await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(5e9); g.econ.time = 3600; g.econ.depth = 1000; g.travelTo('auralis', 'N'); });
await wait(12000);
await ev(() => { const g = window.__game; g.econ.depth = g.planet.goalDepth; g.completePlanet(); });
await wait(4000);
const travel = await ev(() => ({ menu: window.__game.menus.cur, text: document.querySelector('.menu-body')?.textContent || '' }));
check('Finishing Auralis offers the trip to Omega', travel.menu === 'travel' && travel.text.includes('Omega'), travel.menu);
await shot('01-travel-to-omega');
await ev(() => { const g = window.__game; g.menus.close(); g.travelTo('omega', 'N'); });
await wait(15000);

const o = await ev(() => {
  const g = window.__game;
  return { planet: g.econ.planet, theme: g.music.theme.id, medley: (g.music.theme.medley || []).length, lava: g.lava.pockets.length, veins: g.lava.veins.length,
    current: Math.hypot(...g.currentAt(10, 10)), weather: g.weather?.state, auroraPlanet: !!g.planet.aurora, fog: g.planet.fogDensity,
    mutantTypes: new Set(g.mutants.map((m) => m.type)).size, capsules: g.frozen.items.filter((i) => i.kind === 'capsule').length, needle: g.frozen.items.some((i) => i.kind === 'needle') };
});
check('Omega loads with every rule: fog, lava and veins, a current, storms and auroras', o.planet === 'omega' && o.lava > 0 && o.veins > 0 && o.current > 0.3 && o.weather === 'storm' && o.auroraPlanet && o.fog > 0.005, JSON.stringify(o));
check('Omega holds every kind of mutant ice, three capsules and a Golden Needle', o.mutantTypes === 12 && o.capsules === 3 && o.needle, JSON.stringify({ types: o.mutantTypes, capsules: o.capsules, needle: o.needle }));
check('All Rivers theme carries the six earlier themes', o.theme === 'omega' && o.medley === 6, `${o.theme}, ${o.medley} movements`);
const medley = await ev(() => {
  const m = window.__game.music, seen = [];
  for (let i = 0; i < 6; i++) { m.nextMovement(); seen.push(`${m.theme.root}/${m.theme.mode.join('')}`); }
  return { name: m.theme.name, distinct: new Set(seen).size, choir: m.theme.choir };
});
check('The medley moves through each world\'s key and mode under one choir', medley.name === 'All Rivers' && medley.distinct >= 5 && medley.choir >= 0.5, JSON.stringify(medley));
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; g.ctl.pitch = 0.1; });
await wait(4000);
await shot('02-omega-storm');

// every rule at once, in one crater
const rules = await ev(() => {
  const g = window.__game;
  for (let y = 0; y >= -3; y -= 0.5) g.applyOp({ kind: 'dig', x: 6, y, z: 2, r: 1.6, seed: 2 }, 'local');
  g.ctl.teleport(6, -3.2, 2); g.ctl.yaw = 0; g.ctl.pitch = 0;
  g.devLava();
  const k = g.lava.pockets[0];
  const m = { point: new window.__THREE.Vector3(k.x, k.y, k.z - k.r - 0.3), normal: new window.__THREE.Vector3(0, 0, -1), removed: 0.01, depth: 3, dt: 0.1 };
  g.onMelt(m);
  return { lavaMult: m.lavaMult, melt: g.tools.meltFactor };
});
check('Lava and storms act together (heat pays more, the storm weakens the torch)', rules.lavaMult > 1.2 && rules.melt < 1, JSON.stringify(rules));

// "Every rule" milestone
const allRules = await ev(() => {
  const g = window.__game;
  g.countMax('veinBest', 3); for (let i = 0; i < 3; i++) g.countAction('windows'); g.countMax('chainBest', 5);
  g.checkMilestones();
  return g.econ.milestones.omega_rules !== undefined;
});
check('"Every rule" milestone pays out on Omega', allRules);

// the climax: the final 15%
await ev(() => { const g = window.__game; g.ctl.teleport(0, 2, 20); g.ctl.pitch = 0.45; g.econ.depth = g.planet.goalDepth * 0.86; });
await wait(6000);
const climax = await ev(() => {
  const g = window.__game;
  g.checkMilestones();
  return { on: g.climaxOn, aurora: g.aurora.active, ambient: g.aurora.ambient, melt: g.tools.meltFactor, weather: g.weather?.state, core: g.econ.milestones.omega_core !== undefined, notice: !!g.state.climax };
});
check('The core wakes in the final 15%: storms fall silent and a gold aurora hangs over the crater', climax.on && climax.aurora && climax.ambient > 0.5 && climax.melt === 1 && climax.weather === 'calm' && climax.notice, JSON.stringify(climax));
check('"The core wakes" milestone pays out', climax.core);
const thick = await ev(() => { const g = window.__game; return { gap: g.auroraGap(), lone: g.planet.climax.skyEvery[1] }; });
check('During the climax auroras and sky coins come thick', thick.gap <= 60, JSON.stringify(thick));
await wait(3000);
await shot('03-omega-climax');
await ev(() => { window.__game.input.locked = true; window.__game.togglePlanet(true); });
await page.waitForFunction(() => window.__game.view === 'planet' && window.__game.planetView.dist > 3, null, { timeout: 60000 });
const header = await ev(() => document.querySelector('.ptitle .eyebrow')?.textContent || '');
check('Planet view names Omega as planet 7 of 7', header.includes('7 of 7'), header);
await shot('04-omega-globe');
await ev(() => window.__game.togglePlanet(false));

const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch7-omega.code.txt'), code);
check('Omega save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 7 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
