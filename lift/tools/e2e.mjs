// Headless browser check: desktop and phone (touch) sizes. Usage: node tools/e2e.mjs [url] [batch]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] || 'http://localhost:8765/lift/';
const batch = +(process.argv[3] || 1);
const shots = process.env.SHOTS || '';

// In-page bot: walks to the nearest unfinished cell in a target room and holds the tool.
const BOT = `
window.__bot = function (tx, tz) {
  const L = window.__lift, g = L.game, inp = L.input;
  const f = g.pos.floor, S = L.Game.walkSpeed ? (8 + 2 * f > 30 ? 30 : 8 + 2 * f) : 8;
  const r = L.Game.room(g, f, tx, tz);
  const done = r.clearedDone && r.polishedDone;
  if (done) { inp.tool = false; for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) inp.keys.delete(k); inp.move.x = inp.move.y = 0; return true; }
  const cell = S / 16; const R = L.Game.toolRadius(g.player);
  let best = null, bd = 0;
  for (let jj = 0; jj < 16 && !best; jj++) for (let ii = 0; ii < 16; ii++) {
    const i = jj & 1 ? 15 - ii : ii, k = jj * 16 + i;
    const need = !r.clearedDone ? r.c[k] > 0 : r.g[k] > 0.1;
    if (!need || (window.__skip && window.__skip.has(tx + ',' + tz + ',' + k))) continue;
    best = [tx * S - S / 2 + (i + 0.5) * cell, tz * S - S / 2 + (jj + 0.5) * cell, jj, k]; break;
  }
  if (!best) return true;
  window.__skip ||= new Set(); const st = window.__stuck ||= { x: 0, z: 0, n: 0, k: -1 };
  if (st.k === best[3] && Math.hypot(st.x - g.pos.x, st.z - g.pos.z) < 0.002) { if (++st.n > 12) { window.__skip.add(tx + ',' + tz + ',' + best[3]); st.n = 0; } } else st.n = 0;
  st.x = g.pos.x; st.z = g.pos.z; st.k = best[3];
  const ahead = 0.9 + R;
  // stand between the cell and the room centre, facing the cell
  const cxr = tx * S, czr = tz * S;
  const ux = 0, uz = best[2] < 12 ? 1 : -1;
  let sx = best[0] + ux * ahead, sz = best[1] + uz * ahead;
  const prx = Math.round(g.pos.x / S), prz = Math.round(g.pos.z / S);
  if (prx !== tx || prz !== tz) { sx = (prx + tx) * S / 2 + (tx - prx) * 0.8; sz = (prz + tz) * S / 2 + (tz - prz) * 0.8; if (Math.abs(g.pos.x - sx) > 0.3 && tx === prx) { sz = prz * S + (tz - prz) * (S / 2 - 1); } }
  g.pos.yaw = Math.atan2(-(best[0] - sx), -(best[1] - sz)); g.pos.pitch = -0.5;
  const dx = sx - g.pos.x, dz = sz - g.pos.z, dl = Math.hypot(dx, dz);
  const fx = -Math.sin(g.pos.yaw), fz = -Math.cos(g.pos.yaw), rx = Math.cos(g.pos.yaw), rz = -Math.sin(g.pos.yaw);
  let my = 0, mx = 0;
  if (dl > 0.25) { my = (dx * fx + dz * fz) / dl; mx = (dx * rx + dz * rz) / dl; }
  if (inp.touch) { inp.move.x = mx; inp.move.y = my; }
  else { for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) inp.keys.delete(k); if (my > 0.3) inp.keys.add('KeyW'); if (my < -0.3) inp.keys.add('KeyS'); if (mx > 0.3) inp.keys.add('KeyD'); if (mx < -0.3) inp.keys.add('KeyA'); }
  inp.tool = true;
  return false;
};`;

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = { name, checks: [] };
  const check = (label, ok, info = '') => { res.checks.push({ label, ok, info }); };
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
  await page.evaluate(BOT);
  await page.click('#begin');
  await page.waitForTimeout(500);
  if (shots) await page.screenshot({ path: `${shots}/${name}-start.png` });

  // Batch 1: finish the first room (0,-1) in under a minute of game time, then reload and verify it was kept.
  const t0 = Date.now();
  const secs = await page.evaluate(() => window.__lift.simulate(120, () => window.__bot(0, -1)));
  const done = await page.evaluate(() => window.__bot(0, -1));
  check('room finished < 60 s (game time)', done && secs < 60, `${secs.toFixed(1)} s game time, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
  await page.waitForTimeout(400);
  if (shots) await page.screenshot({ path: `${shots}/${name}-room.png` });
  const glow = await page.evaluate(() => window.__lift.game.player.glow);
  // light it: walk to the switch is the player's job; here we call the same interaction directly
  const lit = await page.evaluate(() => { const L = window.__lift; L.game.player.glow += 0; return L.Game.buyLamp(L.game, 0, 0, -1); });
  check('lamp bought', lit.ok, JSON.stringify(lit) + ' glow ' + glow.toFixed(0));
  await page.evaluate(() => window.__lift.save());
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
  const kept = await page.evaluate(() => { const L = window.__lift; const r = L.Game.room(L.game, 0, 0, -1); return { c: r.clearedDone, p: r.polishedDone, l: r.lit }; });
  check('reload keeps the room', kept.c && kept.p && kept.l, JSON.stringify(kept));
  // frame rate sample
  await page.click('#begin');
  const f = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const tick = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(tick); else res(n / 2); }; requestAnimationFrame(tick); }));
  check('frame rate sample (software GL)', true, `${f.toFixed(0)} fps`);
  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  if (shots) await page.screenshot({ path: `${shots}/${name}-end.png` });
  await browser.close();
  return res;
}

const desktop = await run('desktop', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const phone = await run('phone', { ...devices['Pixel 7'] });
let allOk = true;
for (const r of [desktop, phone]) for (const c of r.checks) { if (!c.ok) allOk = false; console.log(`${c.ok ? 'PASS' : 'FAIL'} [${r.name}] ${c.label} ${c.info}`); }
process.exit(allOk ? 0 : 1);
