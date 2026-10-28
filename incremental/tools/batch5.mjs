#!/usr/bin/env node
// Batch 5 checks with Playwright: Gale weather and Wind Windows, storm shields, Auto Swing, Quartermaster,
// Luck and Secrets, and the collection pages. Reaches each through dev hooks and screenshots it.
// Usage: node incremental/tools/batch5.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch5'));
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

await page.goto(`${base}?force&preset=low&dev=1&slot=batch5`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });

// travel to Gale
await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(5e9); g.econ.time = 3600; g.econ.depth = 1000; g.travelTo('gale', 'N'); });
await wait(15000);
const g5 = await ev(() => ({ planet: window.__game.econ.planet, theme: window.__game.music.theme.id, weather: window.__game.weather && window.__game.weather.state }));
check('Gale loads in a storm with its own theme', g5.planet === 'gale' && g5.theme === 'gale' && g5.weather === 'storm', JSON.stringify(g5));
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; g.ctl.pitch = -0.05; });
await wait(5000);
await shot('01-gale-storm');
const storm = await ev(() => ({ melt: window.__game.tools.meltFactor, bonus: window.__game.calmBonus }));
check('In a storm melting is weakened', storm.melt < 0.5 && storm.bonus === 1, JSON.stringify(storm));
await ev(() => { window.__game.weather.left = 0; });
await wait(3000);
const calm = await ev(() => ({ state: window.__game.weather.state, melt: window.__game.tools.meltFactor, bonus: window.__game.calmBonus }));
check('A Wind Window opens: full melting that pays double', calm.state === 'calm' && calm.melt === 1 && calm.bonus === 2, JSON.stringify(calm));
await shot('02-gale-calm');
await ev(() => { window.__game.weather.left = 0; });
await wait(1500);
await ev(() => { const g = window.__game; g.devLevel('cl_soot', 1); g.devLevel('cl_sea', 1); g.devLevel('cl_shield', 5); });
await wait(1500);
const shielded = await ev(() => window.__game.tools.meltFactor);
check('Storm Shields soften the storm', shielded > 0.7, `melt x${shielded.toFixed(2)}`);

// Auto Swing: aiming at ice and standing still, the pick works on its own
await ev(() => { const g = window.__game; for (let y = 0; y >= -2; y -= 0.5) g.applyOp({ kind: 'dig', x: 6, y, z: 2, r: 1.4, seed: 2 }, 'local'); g.ctl.teleport(6, -2.1, 2.6); g.ctl.yaw = 0; g.ctl.pitch = -0.1; g.tools.select(0, g.stats); g.devLevel('auto_tool', 1); });
await wait(2000);
const auto = await ev(async () => { const g = window.__game, v0 = g.econ.volume; await new Promise((r) => setTimeout(r, 12000)); return { autoUse: g.tools.autoUse, dug: g.econ.volume - v0 }; });
check('Auto Swing keeps the tool working while you stand still', auto.dug > 0, JSON.stringify(auto));

// Quartermaster
const qm = await ev(async () => { const g = window.__game; g.devLevel('auto_buyer', 1); g.econ.coins = g.econ.coins.constructor.fromNumber(1e9); const p0 = g.econ.purchases; await new Promise((r) => setTimeout(r, 15000)); return g.econ.purchases - p0; });
check('Quartermaster buys upgrades on its own', qm > 0, `${qm} bought`);
await ev(() => { const g = window.__game; g.menus.show('upgrades'); });
await wait(9000);
await ev(() => { const t = window.__game.menus.tree; t.scale = 0.5; t.ox = 640; t.oy = 300; t.apply(); });
await wait(1000);
await shot('03-trees-luck-auto');
check('Upgrade screen offers the Quartermaster and Auto Swing toggles', await ev(() => [...document.querySelectorAll('.tree-zoom button')].some((b) => b.textContent.startsWith('Quartermaster'))));

// Luck: capsules hold more
const luck = await ev(() => { const g = window.__game; g.menus.close(); g.devLevel('lk_capsule', 6); return g.stats.capsuleMult; });
check('Lucky Seals raise capsule rewards', luck >= 1.4, `x${(1 + luck).toFixed(2)}`);

// collections: finds page
await ev(() => { const g = window.__game; g.devBring('find'); });
await wait(4000);
await ev(() => window.__game.menus.show('collections'));
await wait(2500);
await ev(() => [...document.querySelectorAll('button.tab')].find((b) => b.textContent === 'Finds').click());
await wait(1500);
await shot('04-finds-collection');
check('Finds page shows found kinds and silhouettes', await ev(() => document.querySelectorAll('.coll .card').length >= 10 && document.querySelectorAll('.coll .card:not(.blank)').length >= 1));

const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch5-gale.code.txt'), code);
check('Gale save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 5 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
