#!/usr/bin/env node
// Batch 3 checks with Playwright: Cinderice, lava, heat veins, orbital laser, satellite mirrors, Climate tree,
// new mutant ice and DNA. Reaches each through dev hooks and screenshots it.
// Usage: node incremental/tools/batch3.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch3'));
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
const V = (x, y, z) => ev(([a, b, c]) => new window.__THREE.Vector3(a, b, c), [x, y, z]);

await page.goto(`${base}?force&preset=low&dev=1&slot=batch3`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });

// travel straight to Cinderice (North)
await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(5e7); g.econ.time = 3600; g.econ.depth = 1000; g.travelTo('cinderice', 'N'); });
await wait(15000);
const here3 = await ev(() => ({ planet: window.__game.econ.planet, theme: window.__game.music.theme.id, pockets: window.__game.lava.pockets.length, veins: window.__game.lava.veins.length }));
check('Cinderice loads with lava pockets, heat veins and its theme', here3.planet === 'cinderice' && here3.pockets > 0 && here3.veins > 0 && here3.theme === 'cinderice', JSON.stringify(here3));
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; g.ctl.pitch = -0.1; });
await wait(4000);
await shot('01-cinderice');

// a wall with a lava pocket behind it
await ev(() => { const g = window.__game; for (let y = 0; y >= -3; y -= 0.5) g.applyOp({ kind: 'dig', x: 6, y, z: 2, r: 1.6, seed: 2 }, 'local'); g.ctl.teleport(6, -3.2, 2); g.ctl.yaw = 0; g.ctl.pitch = 0; });
await wait(5000);
await ev(() => window.__game.devLava());
await wait(5000);
await shot('02-lava-in-wall');
// melting next to it pays more, builds heat, and bursts
const lava = await ev(() => {
  const g = window.__game, k = g.lava.pockets[0];
  const p = new window.__THREE.Vector3(k.x, k.y, k.z - k.r - 0.3);
  g.state.carried.value = 100; g.state.carried.count = 10;
  const m = { point: p, normal: new window.__THREE.Vector3(0, 0, -1), removed: 0.01, depth: 3, dt: 0.1 };
  g.onMelt(m);
  const mult = m.lavaMult, heat1 = g.lavaHeat;
  for (let i = 0; i < 80 && g.lavaHeat > 0.01; i++) g.onMelt({ ...m, dt: 0.1 });
  return { mult, heat1, after: g.lavaHeat, carried: g.state.carried.value };
});
check('Melting next to lava pays more and builds heat', lava.mult > 1.2 && lava.heat1 > 0, JSON.stringify(lava));
check('Lava bursts at full heat and scorches the pack', lava.after < 0.2 && lava.carried < 100, `pack ${lava.carried}`);

// heat vein combo
const vein = await ev(() => {
  const g = window.__game, q = g.lava.veins[0][3];
  const m = { point: new window.__THREE.Vector3(q[0], q[1], q[2]), normal: new window.__THREE.Vector3(0, 1, 0), removed: 0.01, depth: 5, dt: 0.1 };
  for (let i = 0; i < 30; i++) g.onMelt({ ...m });
  return { combo: g.veinCombo, mult: (() => { const mm = { ...m }; g.onMelt(mm); return mm.lavaMult; })() };
});
check('Melting along a heat vein builds a combo', vein.combo > 2 && vein.mult > 1.3, JSON.stringify(vein));

// new mutant ice and DNA
await ev(() => window.__game.devMutant());
await wait(4000);
await shot('03-cinderice-mutant');
const mutant = await ev(() => { const g = window.__game, m = g.mutants.find((x) => Math.hypot(x.x - g.ctl.pos.x, x.z - g.ctl.pos.z) < 8); g.onStrike({ point: new window.__THREE.Vector3(m.x, m.y, m.z), normal: new window.__THREE.Vector3(0, 0, 1), removed: 0.1, crit: false, heavy: false, drill: false, pre: false, rich: 0.3, depth: 3, hard: 1 }); return m.type; });
check('Cinderice mutant ice is discovered', ['emberice', 'obsidice'].includes(mutant), mutant);

// tools and trees: orbital laser, satellite mirrors, Climate tree
await ev(() => { const g = window.__game; for (const id of ['melt_torch', 'melt_flame', 'melt_fan', 'melt_lance', 'melt_pressure', 'melt_steam', 'melt_jet', 'melt_heat', 'melt_laser', 'pl_mirror', 'cl_soot', 'cl_dark']) g.devLevel(id, 1); });
const tiers = await ev(() => ({ melt: window.__game.stats.meltTier, planet: window.__game.stats.planetTier, meltEff: window.__game.stats.meltEff }));
check('Orbital laser (Melt tier 3) and satellite mirrors (Planet tool) unlock', tiers.melt >= 3 && tiers.planet >= 1, JSON.stringify(tiers));
check('Climate tree raises melt efficiency', tiers.meltEff > 1, `meltEff ${tiers.meltEff.toFixed(2)}`);
const mirror = await ev(() => {
  const g = window.__game, t = g.tools;
  t.select(2, g.stats);
  const v0 = g.econ.melted;
  const e = g.ctl.eye(1);
  const ctx = { eye: e, dir: g.ctl.forward(), st: g.stats, hardness: () => 1, depthAt: (y) => 3, time: g.time, move: false };
  t.hit = g.volume.raycast(e, g.ctl.forward(), 8);
  for (let i = 0; i < 30; i++) t.updateMirror(0.1, true, false, g.stats, ctx);
  return { melted: g.econ.melted - v0, beam: !!(t.beam && t.beam.visible) };
});
check('Satellite mirror sunbeam melts the ice it points at', mirror.melted > 0 && mirror.beam, JSON.stringify(mirror));
await wait(300);
await shot('04-mirror-beam');
await ev(() => { const g = window.__game; g.econ.coins = g.econ.coins.constructor.fromNumber(1e7); g.menus.show('upgrades'); });
await wait(9000);
await ev(() => { const t = window.__game.menus.tree; t.scale = 0.55; t.ox = 640; t.oy = 360; t.apply(); });
await wait(1000);
await shot('05-trees-planet-climate');

// save fixture
const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch3-cinderice.code.txt'), code);
check('Cinderice save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 3 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
