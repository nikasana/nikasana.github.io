#!/usr/bin/env node
// Mobile checks with Playwright: the game opens on a phone (emulated, touch, landscape), detects touch and
// shows the touch controls; the stick moves you, dragging looks around, USE digs, tool slots switch tools,
// ☰ pauses, the hut terminal opens the upgrades with USE, and the upgrade tree pans, previews and buys by tap.
// Usage: node incremental/tools/mobile.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'mobile'));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${opt('--port', '8123')}/index.html`;
const results = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`.slice(0, 300)));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80, timeout: 240000 }); console.log(`      shot ${name}.jpg`); };
async function until(fn, ms = 60000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(300); } return false; }
// pointer events like a finger: down, a few moves, up
const finger = (sel, id, pts, hold = 0) => ev(async ([sel, id, pts, hold]) => {
  const el = document.querySelector(sel);
  const fire = (type, [x, y]) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1 }));
  fire('pointerdown', pts[0]);
  for (const p of pts.slice(1)) { await new Promise((r) => setTimeout(r, 60)); fire('pointermove', p); }
  if (hold) await new Promise((r) => setTimeout(r, hold));
  fire('pointerup', pts[pts.length - 1]);
}, [sel, id, pts, hold]);

// no ?force, no ?touch: a phone must open the game and be detected as touch
await page.goto(`${base}?dev=1&slot=mobile`);
await ev(() => localStorage.clear());
await page.reload();
const opened = await until(() => window.__game?.menus?.cur === 'start', 90000);
const det = await ev(() => ({ touch: !!window.__game?.touch, cls: document.body.classList.contains('touch'), guard: !document.getElementById('guard').hidden, preset: window.__game?.settings.preset, scale: window.__game?.settings.renderScale }));
check('The game opens on a phone (no desktop-only block)', opened && !det.guard, JSON.stringify(det));
check('Touch is detected, with the light preset for phones', det.touch && det.cls && det.preset === 'low', JSON.stringify(det));
await shot('01-start');
await page.tap('text=Begin a new survey');
await until(() => window.__game.started, 90000);
await wait(3000);
await page.tap('.touch-zone', { position: { x: 600, y: 120 } });   // tap to play
const locked = await until(() => window.__game.input.locked && !document.querySelector('.touch').hidden, 20000);
check('Touch controls appear and a tap starts play', locked);
await wait(4000);
await shot('02-play-touch-controls');

// the stick moves you
const p0 = await ev(() => window.__game.ctl.pos.toArray());
await finger('.touch-zone', 1, [[150, 260], [150, 240], [150, 215], [150, 200]], 2500);
const p1 = await ev(() => window.__game.ctl.pos.toArray());
const moved = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
check('Pushing the left stick walks you', moved > 0.4, `${moved.toFixed(2)} m`);
// dragging on the right looks around
const y0 = await ev(() => (window.__yaw0 = window.__game.ctl.yaw));
await finger('.touch-zone', 2, [[600, 200], [570, 200], [540, 200], [500, 200]]);
await until(() => Math.abs(window.__game.ctl.yaw - window.__yaw0) > 0.05, 10000);   // a slow software frame may not have applied it yet
const y1 = await ev(() => window.__game.ctl.yaw);
const lk = await ev(() => ({ locked: window.__game.input.locked, menu: window.__game.menus.cur, view: window.__game.view, hidden: document.querySelector('.touch').hidden, at: document.elementFromPoint(600, 200)?.className }));
check('Dragging on the right turns the view', Math.abs(y1 - y0) > 0.05, `yaw ${y0.toFixed(2)} → ${y1.toFixed(2)} ${JSON.stringify(lk)}`);
// USE digs
await ev(() => { window.__game.ctl.pitch = -0.8; });
await wait(500);
const v0 = await ev(() => window.__game.econ.volume);
await finger('.tbtn.use', 3, [[0, 0]], 4000);
await wait(500);
const v1 = await ev(() => window.__game.econ.volume);
check('Holding USE digs the ice', v1 > v0 + 0.05, `${(v1 - v0).toFixed(2)} m³`);
// tool slots switch tools by tap
await ev(() => window.__game.devLevel('vis_lamp', 1));
await wait(1500);
await ev(() => { const s = document.querySelectorAll('.hud-tool .slot')[3]; s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })); });
const fam = await until(() => window.__game.tools.family === 3, 10000);
check('Tapping a tool slot switches the tool', fam);
// ☰ pauses, and the pause menu returns to play
await ev(() => document.querySelector('.touch-menus .tbtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })));
const paused = await until(() => window.__game.menus.cur === 'pause', 10000);
check('☰ pauses the game', paused);
await shot('03-pause');
await ev(() => window.__game.menus.close());
await until(() => window.__game.input.locked, 10000);

// JUMP and LIFT are different buttons: LIFT shows only by the lift beacon in the crater, and JUMP never rides
const liftAway = await ev(() => document.querySelector('.tbtn.lift').hidden);
await ev(() => { const g = window.__game; g.devShaft(12); });
await until(() => window.__game.volume.pending() < 4, 60000);
await ev(() => { const g = window.__game, b = g.works.beaconPos(), p = g.ctl.pos; b.set(p.x + 0.8, p.y + 1.2, p.z); });
const liftShown = await until(() => !document.querySelector('.tbtn.lift').hidden, 20000);
const y0j = await ev(() => window.__game.ctl.pos.y);
await finger('.tbtn.jump', 6, [[0, 0]], 4000);   // long enough to have ridden, if jump still rode
const jumpRode = await ev(() => !!window.__game.ride);
await shot('03b-lift-button');
await ev(() => { window.__liftY = window.__game.ctl.pos.y; });
await finger('.tbtn.lift', 7, [[0, 0]], 4000);   // a slow software frame takes a while to fill the half-second hold
const rode = await until(() => !!window.__game.ride || window.__game.ctl.pos.y > window.__liftY + 4, 5000);
check('JUMP and LIFT are separate: LIFT appears only by the beacon, JUMP never rides, LIFT does',
  liftAway && liftShown && !jumpRode && rode, JSON.stringify({ liftAway, liftShown, jumpRode, rode, y0j: y0j.toFixed(1) }));
await until(() => !window.__game.ride, 30000);

// the upgrade terminal: walk in, aim, tap USE
await ev(() => { const g = window.__game, h = g.works.hut; g.tools.select(0, g.stats); const cx = (h.x0 + h.x1) / 2, door = h.z0 + 0.8; g.ctl.teleport(cx, g.volume.floorBelow(cx, h.y + 2, door, 6) + 0.05, door); g.ctl.yaw = Math.PI; g.ctl.pitch = -0.05; });
await until(() => window.__game.aimTerminal, 30000);
await finger('.tbtn.use', 4, [[0, 0]], 600);
const up = await until(() => window.__game.menus.cur === 'upgrades', 20000);
check('Tapping USE at the hut terminal opens the upgrade tree', up);
await wait(3000);
// the tree: drag pans; first tap previews, second tap buys
const pan0 = await ev(() => window.__game.menus.tree.ox);
await finger('.tree-canvas', 5, [[400, 250], [350, 250], [300, 250]]);
const pan1 = await ev(() => window.__game.menus.tree.ox);
check('Dragging the upgrade tree pans it', Math.abs(pan1 - pan0) > 40, `${pan0.toFixed(0)} → ${pan1.toFixed(0)}`);
const buy = await ev(async () => {
  const g = window.__game, t = g.menus.tree;
  g.econ.coins = g.econ.coins.constructor.fromNumber(1000);
  t.dragged = false;
  const el = t.nodes.dig_edge, l0 = g.econ.levels.dig_edge || 0;
  el.click();
  await new Promise((r) => setTimeout(r, 300));
  const tip = !t.tip.hidden, afterFirst = g.econ.levels.dig_edge || 0;
  el.click();
  await new Promise((r) => setTimeout(r, 300));
  return { tip, first: afterFirst - l0, second: (g.econ.levels.dig_edge || 0) - l0 };
});
check('In the tree, the first tap shows a node and the second tap buys it', buy.tip && buy.first === 0 && buy.second === 1, JSON.stringify(buy));
await shot('04-upgrade-tree');
await ev(() => window.__game.menus.close());

// portrait: a hint to turn the phone
await page.setViewportSize({ width: 390, height: 844 });
await wait(2500);
const hint = await ev(() => getComputedStyle(document.querySelector('.rotate-hint')).display !== 'none');
check('In portrait a hint suggests turning the phone sideways', hint);
await shot('05-portrait');

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Mobile checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
