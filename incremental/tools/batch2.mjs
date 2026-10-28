#!/usr/bin/env node
// Batch 2 checks with Playwright: reaches every new feature through dev hooks and screenshots it.
// Usage: node incremental/tools/batch2.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch2'));
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

await page.goto(`${base}?force&preset=low&dev=1&slot=batch2`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; });

// a wall to work against
await ev(() => { const g = window.__game; for (let y = 0; y >= -3; y -= 0.5) g.applyOp({ kind: 'dig', x: 6, y, z: 2, r: 1.6, seed: 2 }, 'local'); g.ctl.teleport(6, -3.2, 2); g.ctl.yaw = 0; g.ctl.pitch = 0; });
await wait(6000);

// capsule puzzle: a frost-sealed capsule opens only after melting next to it
const cap = await ev(() => {
  const g = window.__game, it = g.frozen.items.find((i) => i.kind === 'capsule' && i.data.puzzle && i.data.puzzle.kind === 'heat' && !i.done);
  if (!it) return null;
  const e = g.ctl.eye(1); it.mesh.position.set(e.x, e.y - 0.7, e.z - 1.3); it.freed = true;
  return it.data.id;
});
await wait(2500);
const sealed = await ev(() => !window.__game.state.capsules[window.__game.frozen.items.find((i) => i.kind === 'capsule' && i.data.puzzle && i.data.puzzle.kind === 'heat').data.id]);
await ev(() => { const g = window.__game, it = g.frozen.items.find((i) => i.kind === 'capsule' && i.data.puzzle && i.data.puzzle.kind === 'heat'); for (let k = 0; k < 60; k++) g.frozen.warm(it.mesh.position, 0.1); });
await wait(3000);
const opened = await ev((id) => !!window.__game.state.capsules[id], cap);
check('Frost-sealed capsule stays shut until warmed, then opens', cap && sealed && opened, String(cap));

// gem coins: Mistral has them
const gemTier = await ev(() => window.__game.coins.geos.length >= 4 && window.__game.coins.lowGeos.length >= 4 && window.__game.coins.geos.length === window.__game.coins.lowGeos.length);
check('Gem coin tier exists (model, low-poly model, material)', gemTier);

// mutant ice: a pocket in the wall, discovered on strike, unlocks DNA
await ev(() => window.__game.devMutant());
await wait(5000);
await shot('01-mutant-ice');
await ev(() => { const g = window.__game, m = g.mutants.find((x) => Math.hypot(x.x - g.ctl.pos.x, x.z - g.ctl.pos.z) < 6); g.onStrike({ point: new window.__THREE.Vector3(m.x, m.y, m.z), normal: new window.__THREE.Vector3(0, 0, 1), removed: 0.1, crit: false, heavy: false, drill: false, pre: false, rich: 0.3, depth: 3, hard: 1 }); });
await wait(1500);
const mut = await ev(() => Object.keys(window.__game.econ.mutations || {}));
check('Mutant ice is discovered by digging into it', mut.length > 0, mut.join(','));
const dna = await ev(() => { const g = window.__game; return ['dna_eyes', 'dna_legs', 'dna_steady'].filter((id) => window.__game.menus && g.econ.mutations && (id === 'dna_eyes' ? g.econ.mutations.glowice : id === 'dna_legs' ? g.econ.mutations.springice : g.econ.mutations.tarfrost)); });
check('A DNA node unlocks for the found type', dna.length > 0, dna.join(','));
await ev(() => { const g = window.__game; g.econ.coins = g.econ.coins.constructor.fromNumber(5000); g.menus.show('upgrades'); });
await wait(9000);
await ev(() => { const t = window.__game.menus.tree; t.scale = 0.8; t.oy = -150; t.ox = 640; t.apply(); });
await wait(1000);
await shot('02-dna-tree');
await ev(() => window.__game.menus.show('collections'));
await wait(2500);
await ev(() => [...document.querySelectorAll('button.tab')].find((b) => b.textContent === 'Mutation log').click());
await wait(1500);
await shot('03-mutation-log');
check('Mutation Log lists found types and silhouettes', await ev(() => document.querySelectorAll('.coll .card').length >= 4 && document.querySelectorAll('.coll .card.blank').length >= 1));

// audio tree variations
await ev(() => { const g = window.__game; g.menus.close(); g.devLevel('aud_choir', 1); g.devLevel('aud_night', 1); g.menus.show('music'); });
await wait(2500);
await shot('04-music-variations');
const vari = await ev(() => { const b = [...document.querySelectorAll('.music-list button')].find((x) => x.textContent.includes('Night variation')); b.click(); return window.__game.music.theme.bpm[0]; });
check('Night variation slows the theme', vari < 58, `bpm ${vari}`);

// X-ray: coins show deeper while the lamp is focused
await ev(() => { const g = window.__game; g.menus.close(); g.devLevel('vis_lamp', 1); g.devLevel('vis_depth', 1); g.devLevel('vis_gradient', 1); g.devLevel('vis_beam', 1); g.devLevel('vis_xray', 1); });
check('X-ray (Vision tier 2) can be bought', await ev(() => window.__game.stats.visionTier >= 2));

// planet complete: postcard, travel to Mistral
await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(5e6); g.econ.time = 3000; g.econ.depth = g.planet.goalDepth; g.completePlanet(); });
await wait(3500);
check('Completing Frostara opens the travel screen', await ev(() => window.__game.menus.cur === 'travel'));
await shot('05-travel');
check('A postcard of Frostara is saved', await ev(() => !!(window.__game.profile.postcards || {}).frostara));
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Travel to')).click());
await wait(15000);
const arrived = await ev(() => { const g = window.__game; return { planet: g.econ.planet, legacy: g.econ.legacy, scale: g.econ.scale, gem: g.coins.tiers.includes('gem'), theme: g.music.theme.id }; });
check('Arrived on Mistral with legacy and re-scaled costs', arrived.planet === 'mistral' && arrived.legacy > 1 && Math.abs(arrived.scale - arrived.legacy) < 1e-6, JSON.stringify(arrived));
check('Mistral has gem coins and its own theme', arrived.gem && arrived.theme === 'mistral');
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; g.ctl.pitch = -0.1; });
await wait(5000);
await shot('06-mistral-fog');
await ev(() => { window.__game.menus.show('collections'); });
await wait(2500);
await ev(() => [...document.querySelectorAll('button.tab')].find((b) => b.textContent === 'Postcards').click());
await wait(1500);
await shot('07-postcards');
check('Postcard shows in the gallery', await ev(() => !!document.querySelector('.coll .card img')));

// save fixture: a Mistral game, so later batches must keep loading it
const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch2-mistral.code.txt'), code);
check('Mistral save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 2 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
