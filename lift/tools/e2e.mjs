// Headless browser check: desktop and phone (touch) sizes. Usage: node tools/e2e.mjs [url] [batch]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] || 'http://localhost:8765/lift/';
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
  const ah = 0.9 + R, tcx = g.pos.x - Math.sin(g.pos.yaw) * ah, tcz = g.pos.z - Math.cos(g.pos.yaw) * ah;
  for (let pass = 0; pass < 2 && !best; pass++)
  for (let jj = 0; jj < 16 && !best; jj++) for (let ii = 0; ii < 16; ii++) {
    const i = jj & 1 ? 15 - ii : ii, k = jj * 16 + i;
    const need = !r.clearedDone ? r.c[k] > 0 : r.g[k] > 0.1;
    if (!need || (window.__skip && window.__skip.has(tx + ',' + tz + ',' + k))) continue;
    // keep moving: cells already under the tool are being worked on (first pass skips them)
    if (pass === 0 && Math.hypot(tx * S - S / 2 + (i + 0.5) * cell - tcx, tz * S - S / 2 + (jj + 0.5) * cell - tcz) < R * 0.75) continue;
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

const WALK = `
window.__walk = function (targetX) {
  const L = window.__lift, g = L.game, inp = L.input, S = 8 + 2 * g.pos.floor;
  const dx = targetX * S - g.pos.x;
  for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) inp.keys.delete(k);
  inp.tool = false;
  if (Math.abs(dx) < 0.3) { inp.move.x = inp.move.y = 0; return true; }
  g.pos.yaw = dx > 0 ? -Math.PI / 2 : Math.PI / 2; g.pos.pitch = 0;
  // open sealed rooms on the way (the player would pay at the door)
  const rx = Math.round(g.pos.x / S) + Math.sign(dx);
  if (L.Game.isSealed(g, g.pos.floor, rx, 0)) { g.player.glow += L.Game.sealCost(g.pos.floor); L.Game.openSealed(g, g.pos.floor, rx, 0); }
  const side = dx > 0 ? -g.pos.z : g.pos.z; // keep on the doorway line z = 0
  if (inp.touch) { inp.move.y = 1; inp.move.x = Math.max(-1, Math.min(1, side * 2)); }
  else { inp.keys.add('KeyW'); if (side > 0.1) inp.keys.add('KeyD'); if (side < -0.1) inp.keys.add('KeyA'); }
  const k = g.pos.floor + ':' + Math.round(g.pos.x / S) + ':0';
  window.__seen ||= {};
  const inf = L.Game.info(g, g.pos.floor, Math.round(g.pos.x / S), 0);
  const fp = JSON.stringify([inf.biome.id, inf.modifier, inf.setPiece, inf.ceil.toFixed(3), inf.props.length, L.Game.room(g, g.pos.floor, Math.round(g.pos.x / S), 0).total.toFixed(3)]);
  if (window.__seen[k] && window.__seen[k] !== fp) window.__mismatch = (window.__mismatch || 0) + 1;
  window.__seen[k] = fp;
  return false;
};`;

const BATCHES = {
  async 1(page, check, name, shots) {
    const t0 = Date.now();
    const secs = await page.evaluate(() => window.__lift.simulate(120, () => window.__bot(0, -1)));
    const done = await page.evaluate(() => window.__bot(0, -1));
    check('B1 room finished < 60 s (game time)', done && secs < 60, `${secs.toFixed(1)} s game time, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: `${shots}/${name}-b1-room.png` });
    const lit = await page.evaluate(() => { const L = window.__lift; return L.Game.buyLamp(L.game, 0, 0, -1); });
    check('B1 lamp bought', lit.ok, JSON.stringify(lit));
    await page.evaluate(() => window.__lift.save());
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
    await page.evaluate(BOT); await page.evaluate(WALK);
    const kept = await page.evaluate(() => { const L = window.__lift; const r = L.Game.room(L.game, 0, 0, -1); return { c: r.clearedDone, p: r.polishedDone, l: r.lit }; });
    check('B1 reload keeps the room', kept.c && kept.p && kept.l, JSON.stringify(kept));
    await page.click('#begin');
  },
  async 2(page, check, name, shots) {
    await page.evaluate(() => { const g = window.__lift.game; g.pos.x = 0; g.pos.z = 0; });
    const bench0 = await page.evaluate(() => window.__lift.renderBench(5));
    const out = await page.evaluate(() => window.__lift.simulate(200, () => window.__walk(30)));
    const at = await page.evaluate(() => ({ x: window.__lift.game.pos.x / 8, views: window.__lift.world.views.size, rooms: window.__lift.game.rooms.size }));
    const bench1 = await page.evaluate(() => window.__lift.renderBench(5));
    if (shots) await page.screenshot({ path: `${shots}/${name}-b2-far.png`, timeout: 120000 });
    await page.evaluate(() => window.__lift.simulate(200, () => window.__walk(0)));
    const back = await page.evaluate(() => ({ x: window.__lift.game.pos.x / 8, mismatch: window.__mismatch || 0, seen: Object.keys(window.__seen || {}).length }));
    check('B2 walked 30 rooms out', at.x > 29.5, `reached room ${at.x.toFixed(1)} in ${out.toFixed(0)} s`);
    check('B2 walked back to the lift', Math.abs(back.x) < 0.2, `x ${back.x.toFixed(2)}`);
    check('B2 same rooms on the way back', back.mismatch === 0 && back.seen >= 31, `${back.seen} rooms, ${back.mismatch} mismatches`);
    check('B2 9 rooms loaded, memory bounded', at.views === 9 && at.rooms < 200, `views ${at.views}, rooms in memory ${at.rooms}`);
    check('B2 steady frame time', bench1 < bench0 * 1.6 + 5, `${bench0.toFixed(1)} ms at the lift, ${bench1.toFixed(1)} ms 30 rooms out (software GL)`);
    for (const lvl of [1, 3, 5]) {
      const ms = await page.evaluate((l) => { const L = window.__lift; L.world.setQuality(l); return L.renderBench(3); }, lvl);
      check(`B2 graphics level ${lvl} renders`, isFinite(ms), `${ms.toFixed(1)} ms/frame (software GL)`);
      if (shots) await page.screenshot({ path: `${shots}/${name}-q${lvl}.png`, timeout: 120000 });
    }
    await page.evaluate(() => window.__lift.world.setQuality(2));
  },
  async 3(page, check, name, shots) {
    await page.evaluate(() => { const L = window.__lift, g = L.game; g.pos.x = 0; g.pos.z = 0.8; g.player.glow += 20000; L.input.events.push({ type: 'key', code: 'KeyE' }); L.simulate(0.1); });
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#panel .tab')].map((b) => b.textContent));
    check('B3 panel opens in the lift with Upgrades and Helpers', tabs.includes('Upgrades') && tabs.includes('Helpers'), tabs.join(', '));
    const bought = await page.evaluate(() => { const b = [...document.querySelectorAll('#panel .body button.buy')].find((x) => !x.disabled); const g = window.__lift.game; const before = JSON.stringify(g.player.upgrades); b && b.click(); return before !== JSON.stringify(g.player.upgrades); });
    check('B3 buying an upgrade from the panel works', bought);
    if (shots) await page.screenshot({ path: `${shots}/${name}-b3-upgrades.png`, timeout: 120000 });
    await page.evaluate(() => { [...document.querySelectorAll('#panel .tab')].find((b) => b.textContent === 'Helpers').click(); });
    const helpers = await page.evaluate(() => { for (let i = 0; i < 3; i++) [...document.querySelectorAll('#panel .body button.buy')][i].click(); return window.__lift.game.player.helpers; });
    check('B3 one of each helper bought', helpers.sweeper === 1 && helpers.mop === 1 && helpers.firefly === 1, JSON.stringify(helpers));
    if (shots) await page.screenshot({ path: `${shots}/${name}-b3-helpers.png`, timeout: 120000 });
    const worked = await page.evaluate(() => {
      const L = window.__lift, g = L.game; L.panel.hide();
      L.Game.visit(g, 0, -1, 0);
      const count = () => { let n = 0; for (const r of g.rooms.values()) if (r.visited) n += r.c.filter((v) => v > 0).length; return n; };
      const c0 = count(); L.simulate(20); return c0 - count(); });
    check('B3 helpers work a visited room', worked > 0, `${worked} cells in 20 s`);
    await page.evaluate(async () => { const g = window.__lift.game; await window.__lift.save(); });
    await page.evaluate(async () => { const L = window.__lift; const S = await import('./src/save.js'); window.__liftNoSave = true; const o = L.Game.serialize(L.game); o.lastTs = Date.now() - 3 * 3600 * 1000; await S.put('main', o); });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
    const welcome = await page.evaluate(() => document.querySelector('#overlay').textContent);
    check('B3 return screen reports time away, Glow and rested charges', /Welcome back/.test(welcome) && /Rested/.test(welcome), welcome.slice(0, 160));
    if (shots) await page.screenshot({ path: `${shots}/${name}-b3-return.png`, timeout: 120000 });
    await page.evaluate(BOT); await page.evaluate(WALK);
    await page.click('#begin');
    await page.evaluate(() => { window.__lift.game.settings.quality = '2'; window.__lift.world.setQuality(2); });
  },
  async 4(page, check, name, shots) {
    // a floor-0 territory: rooms on every side of the lift, finished and lit
    await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      g.pos.x = 0; g.pos.z = 0.8; g.player.glow += 1e6;
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        if (!x && !z) continue;
        const r = G.room(g, 0, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = r.touched = true;
        if (!r.lit) G.buyLamp(g, 0, x, z) || null;
        if (!r.lit) { r.lit = true; G.floorState(g, 0).litCount++; }
        G.updateStrength(g, 0, x, z);
      }
      for (const v of L.world.views.values()) { v.syncClutter(); v.refreshFloor(); }
      L.Tide.updateRank(g, 0);
    });
    const rank = await page.evaluate(() => window.__lift.game.house.floors[0].rank);
    check('B4 rank from the three floor meters', rank >= 3, `rank ${rank}`);
    for (let k = 1; k <= 3; k++) {
      const fc = await page.evaluate(() => { const L = window.__lift; return L.Tide.forecast(L.game, 0); });
      await page.evaluate(() => window.__lift.callWave());
      // stand near the first contact so the wave is on screen
      if (k === 1) {
        await page.evaluate(() => window.__lift.simulate(14));
        await page.evaluate(() => { const L = window.__lift, g = L.game, w = g.tide; const l = w.fronts[0].lanes[Math.floor(w.fronts[0].lanes.length / 2)]; const cur = l.path[l.i], prev = l.path[Math.max(0, l.i - 1)]; const S = 8; g.pos.x = cur[0] * S - (cur[0] - prev[0]) * 1.5; g.pos.z = cur[1] * S - (cur[1] - prev[1]) * 1.5 + 0.01; g.pos.yaw = Math.atan2(-(prev[0] - cur[0]), -(prev[1] - cur[1])); g.pos.pitch = -0.05; L.world.setQuality(4); L.simulate(0.2); L.renderBench(1); });
        const inst = await page.evaluate(() => { let n = 0; for (const m of window.__lift.tidefx.meshes.values()) n += m.count; return n; });
        check('B4 the wave is drawn with many instanced items', inst > 300, `${inst} items on screen`);
        if (shots) await page.screenshot({ path: `${shots}/${name}-b4-wave.png`, timeout: 120000 });
        await page.evaluate(() => window.__lift.world.setQuality(2));
      }
      const res = await page.evaluate(() => { const L = window.__lift; L.simulate(200, () => L.game.tide && L.game.tide.result); const w = L.game.tide; return w ? { r: w.result, t: Math.round(w.t), flooded: w.flooded.length } : null; });
      check(`B4 floor 0 wave ${k} holds with idle hands`, res && (res.r === 'held' || res.r === 'bounced'), `${fc.mood} (pressure ${Math.round(fc.pressure * 100)}, strength ${Math.round(fc.held * 100)}) -> ${JSON.stringify(res)}`);
      await page.evaluate(() => window.__lift.simulate(6));
    }
    const quiet = await page.evaluate(() => ({ q: window.__lift.game.house.floors[0].quiet, max: window.__lift.game.house.maxFloor }));
    check('B4 floor 0 becomes Quiet and floor 1 opens', quiet.q && quiet.max >= 1, JSON.stringify(quiet));
    if (shots) await page.screenshot({ path: `${shots}/${name}-b4-quiet.png`, timeout: 120000 });
  },
  async 5(page, check, name, shots) {
    // start a Haul from the panel's Sorties tab
    await page.evaluate(() => { const L = window.__lift, g = L.game; L.Tide.clearTide(g); g.sortie = null; g.mods = {}; g.pos.x = 0; g.pos.z = 0.8; L.input.events.push({ type: 'key', code: 'KeyE' }); L.simulate(0.1);
      [...document.querySelectorAll('#panel .tab')].find((b) => b.textContent === 'Sorties').click(); });
    if (shots) await page.screenshot({ path: `${shots}/${name}-b5-board.png`, timeout: 120000 });
    const started = await page.evaluate(() => { const L = window.__lift; const rows = [...document.querySelectorAll('#panel .row')]; const haul = rows.find((r) => r.textContent.startsWith('Haul')); haul.querySelector('button.buy').click(); return L.game.sortie && { type: L.game.sortie.type, goal: L.game.sortie.goal, mat: L.game.sortie.mat }; });
    check('B5 a sortie starts from the board', started && started.type === 'haul', JSON.stringify(started));
    // play it: clear rooms of the right biome with the bot until extraction
    const ext = await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      g.sortie.goal = 60; // keep the run short in software GL
      const rooms = []; for (let r = 1; r < 8 && rooms.length < 6; r++) for (const [x, z] of [[r, -r], [-r, r], [r, r], [-r, -r], [0, -r - 2], [r + 2, 0]]) { const inf = G.info(g, 0, x, z); if (inf.biome.mat === g.sortie.mat && !inf.cabin && inf.modifier !== 'sealed') rooms.push([x, z]); }
      for (const [x, z] of rooms) { if (g.sortie.state !== 'active') break; const r = G.room(g, 0, x, z); r.c.fill(0); r.clearedDone = false; for (let k = 0; k < 256; k++) r.c[k] = 0.6; r.total = 153; g.pos.x = x * 8; g.pos.z = z * 8 + 3; window.__skip = new Set(); L.simulate(60, () => window.__bot(x, z) || g.sortie.state !== 'active'); }
      return g.sortie && g.sortie.state;
    });
    check('B5 the Haul fills and the lift bell rings (extraction)', ext === 'extract', String(ext));
    const pay = await page.evaluate(() => {
      const L = window.__lift, g = L.game; const reward = g.sortie.reward * L.So.riskMult(g.sortie.risk) * L.So.MUT[g.sortie.mutator].reward; const g0 = g.player.glow;
      // walk home: the walker heads for room x = 0 along z = 0
      g.pos.z = 0; g.pos.x = Math.round(g.pos.x / 8) * 8; const tz = Math.round(g.pos.z / 8);
      L.simulate(80, () => window.__walk(0) || !g.sortie);
      if (g.sortie) { g.pos.x = 0; g.pos.z = 0.5; L.simulate(0.2); }
      return { reward: Math.round(reward), got: Math.round(g.player.glow - g0), left: g.sortie ? g.sortie.state : 'done' };
    });
    check('B5 clean exit pays +50 %', pay.left === 'done' && pay.got >= Math.round(pay.reward * 1.5) && pay.got < pay.reward * 1.5 + 50000, JSON.stringify(pay));
    // signs: find a polished room with a true sign and test it with the real tool
    const sign = await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      L.input.keys.clear(); L.input.move.x = L.input.move.y = 0; L.input.tool = false;
      const cands = [];
      for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) { const c = L.Signs.signAt(g, 0, x, z); if (c && c.true && Math.abs(x) + Math.abs(z) > 2 && G.info(g, 0, x, z).modifier !== 'sealed' && !G.info(g, 0, x, z).props.length) cands.push(c); }
      const rays0 = (g.player.rays || []).length;
      for (const sg of cands.slice(0, 6)) {
        const r = G.room(g, 0, sg.x, sg.z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = r.touched = true;
        const S = 8, i = sg.cell % 16, j = (sg.cell / 16) | 0; const cx = sg.x * S - 4 + (i + 0.5) * 0.5, cz = sg.z * S - 4 + (j + 0.5) * 0.5;
        const ah = 0.9 + G.toolRadius(g.player);
        for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
          if (g.player.signs && g.player.signs[sg.key]) break;
          g.pos.x = cx + Math.sin(yaw) * ah; g.pos.z = cz + Math.cos(yaw) * ah; g.pos.yaw = yaw; g.pos.pitch = -0.6; L.simulate(0.1); L.refreshSigns();
          if (Math.hypot(g.pos.x - Math.sin(yaw) * ah - cx, g.pos.z - Math.cos(yaw) * ah - cz) > 0.2) continue;   // a wall is in the way
          L.input.tool = true; L.simulate(2.5); L.input.tool = false;
        }
        if (g.player.signs[sg.key]) return { rays: (g.player.rays || []).length - rays0, state: g.player.signs[sg.key], tried: cands.indexOf(sg) + 1 };
      }
      return { rays: 0, candidates: cands.length };
    });
    check('B5 holding the tool on a sign tests it (true sign adds a ray)', sign.state === 'true' && sign.rays === 1, JSON.stringify(sign));
    if (shots) { await page.evaluate(() => { const L = window.__lift; L.world.setQuality(4); L.simulate(0.05); L.renderBench(1); }); await page.screenshot({ path: `${shots}/${name}-b5-sign.png`, timeout: 120000 }); await page.evaluate(() => window.__lift.world.setQuality(2)); }
    // gadgets from the panel, used with G
    const gad = await page.evaluate(() => { const L = window.__lift, g = L.game; g.pos.x = 0; g.pos.z = 0.8; g.pos.yaw = 0; for (const m of Object.keys(g.player.materials)) g.player.materials[m] += 100; L.So.buyGadget(g, 'paper'); g.settings.gadget = 'plane'; L.input.events.push({ type: 'key', code: 'KeyG' }); L.simulate(0.1); return [1, 2, 3, 4, 5].every((i) => L.Game.room(g, 0, 0, -i).flags.mapped); });
    check('B5 gadget: paper plane maps five rooms', gad);
  },
};

async function run(name, ctxOpts, which) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = { name, checks: [] };
  const check = (label, ok, info = '') => { res.checks.push({ label, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'} [${name}] ${label} ${info}`); };
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
  await page.evaluate(BOT); await page.evaluate(WALK);
  await page.click('#begin');
  // software GL in this container is slow: run the checks at level 2, then render each level explicitly
  await page.evaluate(() => { window.__lift.game.settings.quality = '2'; window.__lift.world.setQuality(2); });
  await page.waitForTimeout(500);
  if (shots) await page.screenshot({ path: `${shots}/${name}-start.png`, timeout: 120000 });
  for (const b of which) {
    try { await BATCHES[b](page, check, name, shots); } catch (e) { check(`B${b} ran`, false, String(e).slice(0, 300)); }
  }
  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
  return res;
}

const which = (process.argv[3] || Object.keys(BATCHES).join(',')).split(',');
const results = [await run('desktop', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, which), await run('phone', { ...devices['Pixel 7'] }, which)];
const allOk = results.every((r) => r.checks.every((c) => c.ok));
console.log(allOk ? 'ALL PASS' : 'SOME FAILED');
process.exit(allOk ? 0 : 1);
