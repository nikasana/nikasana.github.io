#!/usr/bin/env node
// Feedback round after Batch 8: no overhead gantry (the lift flies on its own), a flat camp so the ground
// never hides the buildings, the Outfitter's hut as a room with a clickable upgrade terminal, and giant
// coins that only come free once dug out all round.
// Usage: node incremental/tools/polish1.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'polish1'));
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

// no dev flag: upgrades must really need the hut
await page.goto(`${base}?force&preset=high&slot=polish1`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; });

const camp = await ev(() => {
  const g = window.__game, F = g.works;
  let lo = Infinity, hi = -Infinity;
  for (let x = -45; x <= 45; x += 3) for (let z = -50; z <= 30; z += 3) { const y = window.__surfaceY(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  let girders = 0; F.group.traverse((o) => { if (o.isInstancedMesh && o.count === 12) girders++; });
  return { bridge: !!F.bridge, trolley: !!F.trolley, cable: !!F.cable, relief: hi - lo };
});
check('No overhead gantry, trolley or cable: the lift flies on its own', !camp.bridge && !camp.trolley && !camp.cable, JSON.stringify(camp));
check('The camp stands on flat ground (no ridge can hide the buildings)', camp.relief < 0.25, `relief ${camp.relief.toFixed(2)} m over the camp`);
await ev(() => { const g = window.__game; g.ctl.yaw = 0; g.ctl.pitch = -0.04; });
await wait(6000);
await shot('01-start-view-north');
await ev(() => { const g = window.__game; g.ctl.yaw = 2.6; g.ctl.pitch = -0.05; });
await wait(5000);
await shot('02-outfitter-hut-outside');

// upgrades: only inside the hut, from the terminal
const hut = await ev(async () => {
  const g = window.__game, w = g.works, h = w.hut;
  const outside = g.atOutfitter();
  const cx = (h.x0 + h.x1) / 2, door = h.z0 + 0.8;
  g.ctl.teleport(cx, g.volume.floorBelow(cx, h.y + 2, door, 6) + 0.05, door);
  g.ctl.yaw = Math.PI; g.ctl.pitch = -0.05;   // face the back wall
  const t0 = performance.now();
  while (!(g.aimTerminal && /terminal/i.test(document.querySelector('.hint-prompt')?.textContent || '')) && performance.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 250));
  return { outside, inside: g.atOutfitter(), aimed: g.aimTerminal, prompt: document.querySelector('.hint-prompt')?.textContent || '' };
});
check('Upgrades are only at the hut: outside it they are refused', !hut.outside, JSON.stringify(hut));
check('Walk into the hut and aim at the terminal: it is targeted with a prompt', hut.inside && hut.aimed && /terminal/i.test(hut.prompt), JSON.stringify(hut));
await wait(3000);
await shot('03-upgrade-terminal');
const click = await ev(async () => {
  const g = window.__game, dug0 = g.econ.volume;
  g.input.pressed.add(g.input.bindings.use);
  const t0 = performance.now();   // one software-rendered frame at High can take more than a second
  while (g.menus.cur !== 'upgrades' && performance.now() - t0 < 30000) { if (!g.input.pressed.size) g.input.pressed.add(g.input.bindings.use); await new Promise((r) => setTimeout(r, 200)); }
  return { menu: g.menus.cur, dug: g.econ.volume - dug0 };
});
check('Clicking the terminal opens the upgrade tree (and does not swing the pick)', click.menu === 'upgrades' && click.dug === 0, JSON.stringify(click));
await ev(() => window.__game.menus.close());

// giant coins: few, big, and only free once dug out all round
const coin = await ev(async () => {
  const g = window.__game, C = g.coins;
  g.ctl.teleport(0, 2, 0);
  await new Promise((r) => setTimeout(r, 4000));
  C.flushBox(-12, -14, -12, 12, 2, 12);
  const all = [...C.embedded.values()].flat();
  const vol = C.embedded.size * 512;   // seeded chunks are 8 m cubes
  const k = all.filter((x) => x.tier === 0 && x.depth > 2.5).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  if (!k) return { density: all.length / vol, found: false };
  const id = k.id;
  const free = () => C.collectedIds.has(id);
  g.applyOp({ kind: 'dig', x: k.x, y: k.y, z: k.z, r: 0.25, seed: 1 }, 'local');   // a small bite at its centre
  const afterSmall = free();
  g.applyOp({ kind: 'dig', x: k.x, y: k.y, z: k.z, r: 1.3, seed: 1 }, 'local');    // dig all round it
  const afterBig = free();
  const loose = C.loose.find((c) => c.id === id);
  return { density: all.length / vol, found: true, afterSmall, afterBig, loose: !!loose };
});
check('Coins are fewer (about a third of one per m³ of ice tried, six times fewer than before)', coin.density < 0.12, JSON.stringify(coin));
check('A giant coin stays in the ice until it is dug out all round', coin.found && !coin.afterSmall && coin.afterBig && coin.loose, JSON.stringify(coin));
const slots = await ev(async () => {
  const g = window.__game, c0 = g.state.carried.count;
  const k = g.coins.loose.find((c) => !c.sky);
  if (!k) return { ok: false };
  g.ctl.teleport(k.p.x, k.p.y + 0.2, k.p.z);
  const t0 = performance.now();
  while (g.state.carried.count === c0 && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 200));
  return { ok: true, added: g.state.carried.count - c0 };
});
check('A giant coin takes six pack slots', slots.ok && slots.added >= 6, JSON.stringify(slots));
await ev(() => { const g = window.__game; g.ctl.pitch = -0.6; });
await wait(4000);
await shot('04-giant-coins');

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Feedback round checks (ground, hut terminal, giant coins, no gantry)`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
