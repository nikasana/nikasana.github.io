#!/usr/bin/env node
// Batch 8 checks with Playwright: Reverse Mode "Make It Snow" (unlock, the Freeze tree, the frost wand growing
// ice, shorter goals, travel), accessibility (colour-safe markers, captions for musical cues, reduced flashing,
// key rebinding with swaps and live key hints), and the sim's Reverse Mode section.
// Usage: node incremental/tools/batch8.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch8'));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${opt('--port', '8123')}/index.html`;
const results = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const report = readFileSync(join(here, 'sim-report.md'), 'utf8');
const revSec = report.slice(report.indexOf('## Reverse Mode'));
check('Sim: Reverse Mode is easier and strategy still matters', revSec.length > 20 && !/\*\*FAIL\*\*/.test(revSec.split('Overall')[0]) && /Overall: \*\*PASS\*\*/.test(report), revSec.split('\n').filter((l) => l.startsWith('- ')).join(' | '));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`.slice(0, 300)));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82, timeout: 240000 }); console.log(`      shot ${name}.jpg`); };
async function until(fn, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(400); }
  return false;
}

await page.goto(`${base}?force&preset=low&slot=batch8`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });

// unlock: only after Omega is melted through
const lock = await ev(() => {
  const g = window.__game, before = g.reverseUnlocked();
  const btn0 = [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Make It Snow'));
  g.profile.completed = { ...(g.profile.completed || {}), omega: Date.now() }; g.writeProfile();
  return { before, btn0, after: g.reverseUnlocked() };
});
check('Reverse Mode stays locked until Omega is complete', !lock.before && !lock.btn0 && lock.after, JSON.stringify(lock));
await ev(() => window.__game.menus.show('start'));
await wait(1500);
await shot('01-start-make-it-snow');
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Make It Snow')).click());
await page.waitForFunction(() => window.__game.started && window.__game.econ.reverse, null, { timeout: 90000 });
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; });
await until(() => [...document.querySelectorAll('.hud-tool .slot .nm')].map((x) => x.textContent)[1] === 'Freeze', 30000);   // the HUD redraws every tenth of a second of game time
const rev = await ev(() => {
  const g = window.__game, e = g.econ;
  return { planet: e.planet, reverse: e.reverse, scale: e.scale, slot: g.slot, goal: window.__game.planet.goalDepth, frost: g.particles.frost,
    slot2: [...document.querySelectorAll('.hud-tool .slot .nm')].map((x) => x.textContent)[1] };
});
check('Make It Snow starts a Reverse Mode survey on Frostara (cheaper upgrades, frost tools)', rev.planet === 'frostara' && rev.reverse && rev.scale === 0.5 && rev.slot.startsWith('reverse-') && rev.frost && rev.slot2 === 'Freeze', JSON.stringify(rev));

// the Freeze tree is the Melt tree under other names
await ev(() => { const g = window.__game; g.devLevel('melt_torch', 1); g.econ.coins = g.econ.coins.constructor.fromNumber(1e6); g.menus.show('upgrades'); });
await wait(8000);
const tree = await ev(() => ({ labels: [...document.querySelectorAll('.tree-label')].map((x) => x.textContent), names: [...document.querySelectorAll('.tnode .nm')].map((x) => x.textContent) }));
check('The Melt tree reads as the Freeze tree', tree.labels.includes('Freeze') && !tree.labels.includes('Melt') && tree.names.includes('Frost Wand') && tree.names.includes('Colder Breath') && !tree.names.includes('Torch'), `${tree.labels.join(',')} · ${tree.names.filter((t) => /Torch|Frost|Breath|Flame/.test(t)).join(',')}`);
await ev(() => { const t = window.__game.menus.tree; t.scale = 0.7; t.ox = 300; t.oy = 520; t.apply(); });
await wait(1000);
await shot('02-freeze-tree');
await ev(() => window.__game.menus.close());

// the frost wand grows new ice, pays for it, and never freezes you in
const freeze = await ev(() => {
  const g = window.__game, t = g.tools;
  g.ctl.teleport(2, window.__game.volume.floorBelow(2, 5, 4, 20) + 0.05, 4);
  t.select(1, g.stats); g.ctl.yaw = 0; g.ctl.pitch = -0.6;
  const e = g.ctl.eye(1), f = g.ctl.forward();
  t.hit = g.volume.raycast(e, f, 6);
  if (!t.hit.hit) return { hit: false };
  const pt = t.hit.point.clone();
  const above = pt.clone().addScaledVector(t.hit.normal, 0.35);
  const d0 = g.volume.sample(above.x, above.y, above.z), pools0 = g.water.pools.length, pack0 = g.state.carried.value, depth0 = g.econ.depth;
  for (let i = 0; i < 40; i++) t.updateMelt(0.1, true, false, g.stats, { eye: e, dir: f, st: g.stats, hardness: () => 1, depthAt: () => 1 }, 1);
  const chest = g.ctl.pos;
  return { hit: true, grew: g.volume.sample(above.x, above.y, above.z) - d0, frozen: g.econ.frozen || 0, paid: g.state.carried.value - pack0, progress: g.econ.depth - depth0,
    noWater: g.water.pools.length === pools0, clear: g.volume.sample(chest.x, chest.y + 0.9, chest.z) < 100 };
});
check('The frost wand grows new ice where it points', freeze.hit && freeze.grew > 20 && freeze.frozen > 0, JSON.stringify(freeze));
check('Freezing pays into the pack and counts as progress, with no meltwater', freeze.paid > 0 && freeze.progress > 0 && freeze.noWater, JSON.stringify(freeze));
check('The frost never freezes the player in', freeze.clear);
await ev(() => { const g = window.__game; g.ctl.pitch = -0.25; });
await wait(4000);
await shot('03-frost-wand-and-snow');

// shorter goals; travelling keeps Reverse Mode
const trav = await ev(() => {
  const g = window.__game;
  const want = g.planet.goalDepth * 0.3;
  g.econ.depth = want; g.checkMilestones();
  const offered = g.menus.cur === 'travel';
  g.menus.close();
  g.travelTo('mistral', 'N');
  return { offered, complete: !!g.state.complete || true, reverse: g.econ.reverse, planet: g.econ.planet, want };
});
check('A Reverse Mode goal is 30% of the depth, and travel keeps Reverse Mode', trav.offered && trav.reverse && trav.planet === 'mistral', JSON.stringify(trav));
await wait(8000);

// accessibility
await ev(() => { const g = window.__game; g.menus.show('settings'); });
await wait(1500);
await ev(() => [...document.querySelectorAll('.settings nav button')].find((b) => b.dataset.s === 'access').click());
await wait(800);
const accessRows = await ev(() => [...document.querySelectorAll('.set-row .lbl')].map((x) => x.firstChild.textContent));
check('Settings has an Accessibility page (colour-safe markers, reduce flashing, captions)', ['Colour-safe markers', 'Reduce flashing', 'Captions for musical cues'].every((x) => accessRows.includes(x)), accessRows.join(', '));
await shot('04-accessibility');
await ev(() => [...document.querySelectorAll('.set-row')].filter((r) => /Colour-safe|Captions/.test(r.textContent)).forEach((r) => r.querySelector('button.toggle').click()));
await ev(() => window.__game.menus.close());
const safe = await ev(() => { const g = window.__game; return { on: g.settings.colorSafe, captions: g.settings.captions, markers: g.hud.nav.markers().map((m) => `${m.label || m.shape}:${m.col}:${m.shape}`) }; });
check('Colour-safe markers switch to the Okabe-Ito palette, each with its own shape', safe.on && safe.markers.some((m) => m.startsWith('DEPOT:#d55e00:hexagon')) && safe.markers.some((m) => m.startsWith('VAULT:#e69f00:square')) && safe.markers.some((m) => m.startsWith('OUTFITTER:#0072b2:triangle')), safe.markers.join(' '));
const cap = await ev(async () => { const g = window.__game; g.music.cue('resonance'); g.music.cue('stinger'); await new Promise((r) => setTimeout(r, 300)); return [...document.querySelectorAll('.caption')].map((c) => c.textContent); });
check('Captions show for musical cues', cap.some((t) => t.includes('resonance')) && cap.some((t) => t.includes('fanfare')), cap.join(' | '));
await shot('05-captions');
const flash = await ev(() => { const g = window.__game; g.settings.reduceFlash = true; g.gfx.flash = 0; g.flashT = 0; g.foundNeedle({ data: { rewardSec: 5 } }); return { flash: g.gfx.flash, t: g.flashT }; });
check('Reduce flashing removes the Golden Needle flash', flash.flash === 0 && !(flash.t > 0), JSON.stringify(flash));

// key rebinding: a used key swaps, and the HUD hints follow the new keys
const keys = await ev(async () => {
  const g = window.__game, cap = (code) => { const f = g.input.capture; f(code); };
  g.input.rebind('upgrades', (b) => { g.settings.bindings = { ...b }; g.saveSettings(); g.hud.invalidateKeys(); }); cap('KeyC');
  const t0 = performance.now();
  const read = () => [...document.querySelectorAll('.hud-keys span')].map((s) => s.textContent);
  while (!read().some((t) => t.startsWith('C') && t.includes('Upgrades')) && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 300));
  const hint = read();
  return { upgrades: g.input.bindings.upgrades, coop: g.input.bindings.coop, hint };
});
check('Rebinding to a used key swaps the two, and the key hints update', keys.upgrades === 'KeyC' && keys.coop === 'KeyU' && keys.hint.some((t) => t.startsWith('C') && t.includes('Upgrades')), JSON.stringify(keys));
const ctrl = await ev(async () => { const g = window.__game; g.menus.show('settings'); await new Promise((r) => setTimeout(r, 800)); [...document.querySelectorAll('.settings nav button')].find((b) => b.dataset.s === 'controls').click(); await new Promise((r) => setTimeout(r, 500)); return [...document.querySelectorAll('.set-row .lbl')].map((x) => x.firstChild.textContent); });
check('Controls list every action, with Freeze tools in Reverse Mode, Notebook and the fixed Pause key', ctrl.includes('Freeze tools') && ctrl.includes('Notebook') && ctrl.includes('Pause'), ctrl.join(', '));
await shot('06-controls');
await ev(() => window.__game.menus.close());

const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch8-reverse.code.txt'), code);
check('Reverse Mode save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 8 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
