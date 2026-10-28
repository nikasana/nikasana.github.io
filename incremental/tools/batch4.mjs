#!/usr/bin/env node
// Batch 4 checks with Playwright: Tidalis, currents, flowing meltwater, sonic hammer, heat pipe, relic coins,
// aurora events and the Style tree. Reaches each through dev hooks and screenshots it.
// Usage: node incremental/tools/batch4.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch4'));
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

await page.goto(`${base}?force&preset=low&dev=1&slot=batch4`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });

// travel to Tidalis
await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(5e8); g.econ.time = 3600; g.econ.depth = 1000; g.travelTo('tidalis', 'N'); });
await wait(15000);
const t4 = await ev(() => ({ planet: window.__game.econ.planet, theme: window.__game.music.theme.id, relic: window.__game.coins.tiers.includes('relic'), current: !!window.__game.coins.current }));
check('Tidalis loads with its theme, relic coins and a current', t4.planet === 'tidalis' && t4.theme === 'tidalis' && t4.relic && t4.current, JSON.stringify(t4));
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; g.ctl.pitch = -0.15; });
await wait(4000);
await shot('01-tidalis');

// currents carry loose coins
await ev(() => { const g = window.__game; for (let y = 0; y >= -2; y -= 0.5) for (let x = 0; x <= 10; x += 1) g.applyOp({ kind: 'dig', x: 4 + x, y, z: 4, r: 1.4, seed: 1 }, 'local'); g.ctl.teleport(9, -1.8, 6); });
await wait(3000);
const drift = await ev(async () => {
  const g = window.__game;
  const sy = g.volume.floorBelow(30, 5, 30, 20);
  g.coins.spawnSky(new window.__THREE.Vector3(30, sy + 0.3, 30), 4, 1, sy);   // a coin on open snow (made non-sky below)
  const c = g.coins.loose[g.coins.loose.length - 1]; c.sky = false; c.t = 0; c.magnet = false;
  const p0 = c.p.clone(), t0 = g.time;
  await new Promise((r) => setTimeout(r, 6000));
  const moved = Math.hypot(c.p.x - p0.x, c.p.z - p0.z), secs = g.time - t0;
  return { moved, secs, speed: moved / Math.max(0.01, secs), cur: g.currentAt(30, 30) };
});
check('The current carries a loose coin along the ice (m per game second)', drift.speed > 0.4, JSON.stringify(drift));

// meltwater flows downhill and pools merge
const water = await ev(() => {
  const g = window.__game, V = window.__THREE.Vector3;
  g.water.add(new V(5, -1.4, 4), 0.6); g.water.add(new V(6.2, -1.4, 4), 0.6);
  for (let i = 0; i < 40; i++) g.water.update(0.5, g.time, g.atmo.sunDir, g.atmo.sunColor, 1);
  return g.water.pools.length;
});
check('Meltwater pools that meet merge into one', water === 1, `${water} pool(s)`);

// relic coin model
check('Relic coin tier exists (model, low-poly model, material)', await ev(() => window.__game.coins.geos.length >= 5 && window.__game.coins.lowGeos.length === window.__game.coins.geos.length && window.__game.coins.mats.length === window.__game.coins.geos.length && window.__game.planet.coinTiers.includes('relic')));

// sonic hammer and heat pipe
await ev(() => { const g = window.__game; for (const id of ['dig_swing', 'dig_grip', 'dig_drill', 'dig_bit', 'dig_torque', 'dig_chip', 'dig_frac', 'dig_echo', 'dig_cool', 'dig_wide', 'dig_sonic', 'pl_mirror', 'pl_lens', 'pl_array', 'pl_orbit', 'pl_pipe']) g.devLevel(id, 1); g.tools.select(0, g.stats); g.ctl.yaw = 0; g.ctl.pitch = -0.2; });
await wait(4000);
const hammer = await ev(() => ({ tier: window.__game.stats.digTier, model: window.__game.tools.modelName(window.__game.stats) }));
check('Sonic hammer (Dig tier 3) is the held tool', hammer.tier >= 3 && hammer.model === 'hammer', JSON.stringify(hammer));
await shot('02-sonic-hammer');
const sonic = await ev(() => {
  const g = window.__game, t = g.tools, e = g.ctl.eye(1);
  t.hit = g.volume.raycast(e, g.ctl.forward(), 8);
  if (!t.hit.hit) return { hit: false };
  const v0 = g.econ.volume;
  t.strike(g.stats, { depthAt: () => 2, hardness: () => 1 }, 1, false);
  return { hit: true, removed: g.econ.volume - v0 };
});
check('A sonic hammer blow removes a ring of ice', sonic.hit && sonic.removed > 1, JSON.stringify(sonic));
const pipe = await ev(() => {
  const g = window.__game, t = g.tools, e = g.ctl.eye(1);
  t.select(2, g.stats);
  t.hit = g.volume.raycast(e, g.ctl.forward(), 8);
  const v0 = g.econ.melted;
  for (let i = 0; i < 20; i++) t.updateMirror(0.1, false, true, g.stats, { eye: e, dir: g.ctl.forward(), st: g.stats, hardness: () => 1, depthAt: () => 2 });
  return { tier: g.stats.planetTier, melted: g.econ.melted - v0 };
});
check('Heat pipe (Planet tier 2) melts a column', pipe.tier >= 2 && pipe.melted > 0, JSON.stringify(pipe));

// aurora
await ev(() => { const g = window.__game; g.ctl.teleport(0, 2, 20); g.ctl.pitch = 0.45; g.startAurora(); });
await wait(6000);
const aur = await ev(() => ({ active: window.__game.aurora.active, sky: window.__game.coins.loose.filter((c) => c.sky).length }));
check('Aurora fills the sky and drops sky coins', aur.active && aur.sky > 5, JSON.stringify(aur));
await shot('03-aurora');
const caught = await ev(async () => {
  // sky coins trickle down and fade (Batch 6): take the lowest one, and give it time to reach you
  const g = window.__game;
  if (!g.coins.loose.some((x) => x.sky)) g.dropSkyCoin(false);
  const c = g.coins.loose.filter((x) => x.sky).sort((a, b) => (a.p.y - a.floorY) - (b.p.y - b.floorY))[0];
  c.life = 1e9;
  const v0 = g.econ.total.toNumber();
  g.ctl.teleport(c.p.x, c.floorY + 0.1, c.p.z);
  const t0 = performance.now();
  while (g.econ.total.toNumber() - v0 <= 0 && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 300));
  return g.econ.total.toNumber() - v0;
});
check('A sky coin is caught straight into the vault', caught > 0, `+${caught.toFixed ? caught.toFixed(1) : caught}`);

// Style tree
await ev(() => { const g = window.__game; for (const id of ['sty_gold', 'sty_warm', 'sty_wide']) g.devLevel(id, 1); g.ctl.pitch = -0.2; g.tools.select(0, g.stats); });
await wait(3000);
const style = await ev(() => ({ fov: window.__game.gfx.camera.fov, gold: window.__game.tools.M.steel.color.getHexString() }));
check('Style: gilded tools and the wide lens apply', style.fov >= 88 && style.gold === 'e0b450', JSON.stringify(style));
await shot('04-style-gilded');

const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch4-tidalis.code.txt'), code);
check('Tidalis save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 4 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
