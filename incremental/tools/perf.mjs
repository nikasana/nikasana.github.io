#!/usr/bin/env node
// Performance pass: the heaviest scene in the game (Omega in its climax: every rule at once, an aurora with
// sky coins falling, lava in the wall, a dug crater) at the Low and Ultra presets. Reports draw calls,
// triangles, game logic time (tick without the render call) and particle/coin counts, and checks budgets.
// Software WebGL (SwiftShader) makes absolute frame times meaningless here, so the budgets are on the
// things the game controls: draw calls, triangles and logic time.
// Usage: node incremental/tools/perf.mjs [--port 8123] [--out dir]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch7'));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${opt('--port', '8123')}/index.html`;
// budgets for the heaviest scene
const BUDGET = { low: { calls: 260, tris: 1.2e6, logicMs: 8 }, ultra: { calls: 420, tris: 2.5e6, logicMs: 8 } };
const results = [], rows = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const preset of ['low', 'ultra']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${preset}] ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', (e) => errors.push(`[${preset}] pageerror ${e.message}`.slice(0, 300)));
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(`${base}?force&preset=${preset}&dev=1&slot=perf-${preset}`);
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
  await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
  await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });
  await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(1e10); g.econ.time = 3600; g.econ.depth = 1000; g.travelTo('omega', 'N'); });
  await page.waitForTimeout(15000);
  // the heaviest scene: a dug crater, lava in the wall, the climax, an aurora and a storm of sky coins
  await ev(() => {
    const g = window.__game;
    g.input.locked = true; g.clickPlay.hidden = true;
    for (let y = 0; y >= -4; y -= 0.5) for (let x = -3; x <= 3; x += 1.5) g.applyOp({ kind: 'dig', x: 6 + x, y, z: 2, r: 1.6, seed: 2 }, 'local');
    g.ctl.teleport(6, -4.2, 2); g.ctl.yaw = 0; g.ctl.pitch = 0.25;
    g.devLava();
    g.econ.depth = g.planet.goalDepth * 0.9;
    g.startAurora();
    for (let i = 0; i < 20; i++) g.dropSkyCoin(i % 4 === 0);
  });
  // measure steady play: wait until chunk streaming and coin seeding around you have settled
  const settle = await ev(async () => {
    const g = window.__game, t0 = performance.now();
    const near = (c) => ((c.cx + 0.5) * 8 - g.ctl.pos.x) ** 2 + ((c.cy + 0.5) * 8 - g.ctl.pos.y) ** 2 + ((c.cz + 0.5) * 8 - g.ctl.pos.z) ** 2 < 21 ** 2;
    while (performance.now() - t0 < 120000) {
      if (!g.volume.queue.size && !g.volume.inflight.size && ![...g.coins.pending.values()].some(near)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    return (performance.now() - t0) / 1000;
  });
  await page.waitForTimeout(3000);
  // instrument: logic time = tick minus the render call
  const m = await ev(async () => {
    const g = window.__game, gfx = g.gfx, orig = gfx.render.bind(gfx);
    let rMs = 0;
    gfx.render = (...a) => { const t = performance.now(); orig(...a); rMs = performance.now() - t; };
    const s = { logic: [], calls: [], tris: [] };
    const t0 = performance.now();
    let last = g.frameMs;
    while (performance.now() - t0 < 12000) {
      await new Promise((r) => requestAnimationFrame(r));
      if (g.frameMs === last) continue;
      last = g.frameMs;
      const i = gfx.info();
      s.logic.push(Math.max(0, g.frameMs - rMs)); s.calls.push(i.calls); s.tris.push(i.tris);
    }
    gfx.render = orig;
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
    const p95 = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.95)] || 0; };
    const P = g.particles;
    return {
      frames: s.logic.length, logicMed: med(s.logic), logicP95: p95(s.logic), calls: Math.max(...s.calls), tris: Math.max(...s.tris),
      particles: [P.alpha, P.add].filter(Boolean).reduce((a, b) => a + (b.n || 0), 0), loose: g.coins.loose.length, sky: g.coins.loose.filter((c) => c.sky).length,
      climax: g.climaxOn, aurora: g.aurora.active, scale: gfx.settings?.renderScale ?? null,
    };
  });
  await page.screenshot({ path: join(out, `perf-${preset}.jpg`), type: 'jpeg', quality: 82, timeout: 240000 });
  rows.push({ preset, settle, ...m });
  const B = BUDGET[preset];
  check(`${preset}: the heaviest scene is set up (climax, aurora, sky coins)`, m.climax && m.aurora && m.sky >= 10, JSON.stringify({ climax: m.climax, aurora: m.aurora, sky: m.sky }));
  check(`${preset}: draw calls within budget (${B.calls})`, m.calls <= B.calls, `${m.calls}`);
  check(`${preset}: triangles within budget (${(B.tris / 1e6).toFixed(1)}M)`, m.tris <= B.tris, `${(m.tris / 1e3).toFixed(0)}k`);
  check(`${preset}: game logic within budget (${B.logicMs} ms median)`, m.logicMed <= B.logicMs, `median ${m.logicMed.toFixed(2)} ms, p95 ${m.logicP95.toFixed(2)} ms over ${m.frames} frames`);
  await page.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'perf.md'), [
  '# Performance pass (Omega climax, the heaviest scene)', '',
  'Measured under software WebGL (SwiftShader), so render time is not representative; the budgets are on draw calls, triangles and game logic time (each frame\'s tick without the render call).', '',
  '| preset | settle after teleport (s) | draw calls | triangles | logic median (ms) | logic p95 (ms) | particles | loose coins (sky) |', '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.preset} | ${r.settle.toFixed(1)} | ${r.calls} | ${(r.tris / 1e3).toFixed(0)}k | ${r.logicMed.toFixed(2)} | ${r.logicP95.toFixed(2)} | ${r.particles} | ${r.loose} (${r.sky}) |`), '',
  `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
