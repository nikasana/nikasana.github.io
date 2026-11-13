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

// Lawnmower bot: sweeps lanes across a room facing along z, strafing; leftovers go to the cell bot.
const MOWER = `
window.__mow = function (tx, tz) {
  const L = window.__lift, g = L.game, inp = L.input, f = g.pos.floor, S = 8 + 2 * f > 30 ? 30 : 8 + 2 * f;
  const r = L.Game.room(g, f, tx, tz);
  if (r.clearedDone && r.polishedDone) { inp.tool = false; for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) inp.keys.delete(k); inp.move.x = inp.move.y = 0; return true; }
  const m = window.__mowS ||= { lane: 0, dir: 1, pass: 0, stuck: 0, lx: 0, lz: 0, key: '' };
  const key = tx + ':' + tz; if (m.key !== key) Object.assign(m, { lane: 0, dir: 1, pass: 0, stuck: 0, key });
  if (m.pass >= 2) return window.__bot(tx, tz);
  const R = L.Game.toolRadius(g.player), ah = 0.9 + R, lanes = Math.ceil((S - 0.6) / (R * 1.5));
  const zl = tz * S - S / 2 + 0.45 + m.lane * (S - 0.9) / Math.max(1, lanes - 1);
  const north = zl - tz * S < S / 2 - ah - 0.6;   // face north (tool ahead at -z) unless the lane hugs the south wall
  g.pos.yaw = north ? 0 : Math.PI; g.pos.pitch = -0.5;
  const pz = zl + (north ? ah : -ah);
  const xe = tx * S + m.dir * (S / 2 - 0.5);
  const dx = xe - g.pos.x, dz = pz - g.pos.z;
  // strafe along the lane, correcting depth
  const right = north ? 1 : -1;
  const mx = Math.abs(dx) > 0.3 ? Math.sign(dx) * right : 0, my = Math.abs(dz) > 0.15 ? -Math.sign(dz) * (north ? 1 : -1) : 0;
  if (inp.touch) { inp.move.x = mx; inp.move.y = my; }
  else { for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) inp.keys.delete(k); if (my > 0) inp.keys.add('KeyW'); if (my < 0) inp.keys.add('KeyS'); if (mx > 0) inp.keys.add('KeyD'); if (mx < 0) inp.keys.add('KeyA'); }
  inp.tool = true;
  const moved = Math.hypot(g.pos.x - m.lx, g.pos.z - m.lz); m.lx = g.pos.x; m.lz = g.pos.z;
  m.stuck = moved < 0.004 ? m.stuck + 1 : 0;
  if (Math.abs(dx) <= 0.3 || m.stuck > 15) { m.dir = -m.dir; m.lane++; m.stuck = 0; if (m.lane >= lanes) { m.lane = 0; m.pass++; } }
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
    const secs = await page.evaluate(() => { const g = window.__lift.game; g.pos.x = 0; g.pos.z = -3; return window.__lift.simulate(120, () => window.__mow(0, -1)); });
    const done = await page.evaluate(() => window.__mow(0, -1));
    check('B1 room finished < 60 s (game time)', done && secs < 60, `${secs.toFixed(1)} s game time, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: `${shots}/${name}-b1-room.png` });
    const lit = await page.evaluate(() => { const L = window.__lift; return L.Game.buyLamp(L.game, 0, 0, -1); });
    check('B1 lamp bought', lit.ok, JSON.stringify(lit));
    await page.evaluate(() => window.__lift.save());
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
    await page.evaluate(BOT); await page.evaluate(WALK); await page.evaluate(MOWER);
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
    await page.evaluate(BOT); await page.evaluate(WALK); await page.evaluate(MOWER);
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
  async 6(page, check, name, shots) {
    const res = await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game, out = {};
      L.Tide.clearTide(g); g.sortie = null; g.mods = {};
      L.input.keys.clear(); L.input.move.x = L.input.move.y = 0; L.input.tool = false;
      Object.assign(g.player.upgrades, { power: 3, reach: 2, speed: 3, shine: 2, bright: 3, wiring: 2 });
      G.recomputeAll(g);
      g.pos.x = 0; g.pos.z = -10; L.simulate(0.2);
      // Dash: find a cluttered room north of the lift and dash into it
      let z0 = -2; while (G.room(g, 0, 0, z0).clearedDone || G.info(g, 0, 0, z0).modifier === 'sealed') z0--;
      const r = G.room(g, 0, 0, z0); const before = r.c.reduce((a, b) => a + b, 0);
      g.pos.x = 0; g.pos.z = z0 * 8 + 4.3; g.pos.yaw = 0; L.simulate(0.2);
      const x0 = g.pos.z; L.input.events.push({ type: 'key', code: 'Digit1' }); L.simulate(0.3);
      out.dash = { moved: +(x0 - g.pos.z).toFixed(2), cleared: +(before - r.c.reduce((a, b) => a + b, 0)).toFixed(1), fov: L.world.fovKick > 0 };
      // Flash during a wave relights a dark lamp and pushes fronts
      const lr = G.room(g, 0, 1, 0); if (!lr.lit) { lr.lit = true; G.floorState(g, 0).litCount++; }
      g.house.floors[0].quiet = false; g.house.floors[0].waves = 0;
      L.Tide.startWave(g, 0); L.simulate(30, () => L.Tide.contacts(g).length > 0);
      lr.lit = false; lr.flags.out = 1; G.floorState(g, 0).litCount--;
      g.pos.x = 8; g.pos.z = 0; L.simulate(0.1); L.input.events.push({ type: 'key', code: 'Digit3' }); L.simulate(0.1);
      out.flash = { relit: lr.lit };
      L.Tide.clearTide(g);
      // Flow: alternate clearing and polishing
      out.flow0 = g.flow || 0;
      return out;
    });
    check('B6 Dash lunges forward and ploughs a trench', res.dash.moved > 2 && res.dash.cleared > 5 && res.dash.fov, JSON.stringify(res.dash));
    check('B6 Flash relights a fading lamp', res.flash.relit, JSON.stringify(res.flash));
    // active minute vs idle minute at floor 0, through the real loop with the bot
    const ratio = await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      Object.assign(g.player.upgrades, { power: 0, reach: 0, speed: 0, shine: 0, bright: 0, wiring: 1 });
      // a modest territory of ten finished, lit rooms around the lift
      let n = 0; for (let x = -2; x <= 2 && n < 10; x++) for (let z = -1; z <= 1 && n < 10; z++) { if (!x && !z) continue; const r = G.room(g, 0, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; if (!r.lit) { r.lit = true; G.floorState(g, 0).litCount++; } n++; }
      G.recomputeAll(g);
      const idle = G.incomeRate(g) * 60, g0 = g.player.nightGlow;
      let t = 0; const targets = [];
      for (let x = 3; x < 40 && targets.length < 12; x++) if (!G.room(g, 0, x, 7).clearedDone && G.room(g, 0, x, 7).total > 0 && G.info(g, 0, x, 7).modifier === 'normal' && !G.info(g, 0, x, 7).setPiece) targets.push(x);
      for (const x of targets) { if (t >= 60) break; g.pos.x = x * 8; g.pos.z = 7 * 8 + 3; window.__skip = new Set(); t += L.simulate(60 - t, () => window.__bot(x, 7)); }
      return { idle: Math.round(idle), active: Math.round(g.player.nightGlow - g0), ratio: +((g.player.nightGlow - g0) / idle).toFixed(2), secs: Math.round(t) };
    });
    check('B6 an active minute is worth 5-10 idle minutes (floor 0, real loop, bot)', ratio.ratio >= 5 && ratio.ratio <= 10, JSON.stringify(ratio));
    const flow = await page.evaluate(() => window.__lift.game.flow);
    check('B6 Flow fills with continuous action', flow > 0.3, String(flow && flow.toFixed(2)));
    if (shots) await page.screenshot({ path: `${shots}/${name}-b6.png`, timeout: 120000 });
  },
  async 7(page, check, name, shots) {
    const rays = await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      L.Tide.clearTide(g); g.sortie = null; g.mods = {}; L.input.keys.clear(); L.input.move.x = L.input.move.y = 0;
      let a, rx, rz, got = [];
      for (const [qx, qz] of [[25, 25], [35, 25], [25, 35], [45, 45], [-25, 25]]) {
      a = L.Signs.anchorFor(g, 0, qx, qz); [rx, rz] = L.Signs.regionOf(qx, qz);
      got = [];
      const ah = 0.9 + G.toolRadius(g.player);
      for (let x = rx * 10; x < rx * 10 + 10 && got.length < 2; x++) for (let z = rz * 10; z < rz * 10 + 10 && got.length < 2; z++) {
        const sg0 = L.Signs.signAt(g, 0, x, z);
        if (!sg0 || !sg0.true || (got.length && Math.abs(Math.sin(sg0.angle - got[0].angle)) < 0.3) || G.info(g, 0, x, z).props.length) continue;
        const r = G.room(g, 0, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = r.touched = true;
        const i = sg0.cell % 16, j = (sg0.cell / 16) | 0, cx = x * 8 - 4 + (i + 0.5) * 0.5, cz = z * 8 - 4 + (j + 0.5) * 0.5;
        for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
          if (g.player.signs && g.player.signs[sg0.key]) break;
          g.pos.x = cx + Math.sin(yaw) * ah; g.pos.z = cz + Math.cos(yaw) * ah; g.pos.yaw = yaw; g.pos.pitch = -0.6; L.simulate(0.1); L.refreshSigns();
          if (Math.hypot(g.pos.x - Math.sin(yaw) * ah - cx, g.pos.z - Math.cos(yaw) * ah - cz) > 0.2) continue;
          L.input.tool = true; L.simulate(2.5); L.input.tool = false;
        }
        if (g.player.signs[sg0.key] === 'true') got.push(g.player.rays.at(-1));
      }
      if (got.length >= 2) break;
      }
      if (got.length < 2) return { n: got.length };
      const [p, q] = got, d1 = [Math.cos(p.angle), Math.sin(p.angle)], d2 = [Math.cos(q.angle), Math.sin(q.angle)];
      const t1 = ((q.x - p.x) * d2[1] - (q.z - p.z) * d2[0]) / (d1[0] * d2[1] - d1[1] * d2[0]);
      const meet = [p.x + d1[0] * t1, p.z + d1[1] * t1];
      // clear the Anchor's room and take it with E
      const ar = G.room(g, 0, a.x, a.z); ar.c.fill(0); ar.clearedDone = true;
      const ai = a.cell % 16, aj = (a.cell / 16) | 0; g.pos.x = a.x * 8 - 4 + (ai + 0.5) * 0.5; g.pos.z = a.z * 8 - 4 + (aj + 0.5) * 0.5 + 1; L.simulate(0.2); L.refreshSigns();
      const before = g.player.anchors[a.kind] || 0; L.input.events.push({ type: 'key', code: 'KeyE' }); L.simulate(0.1);
      return { n: 2, meet: meet.map((v) => +v.toFixed(3)), anchor: [a.x, a.z], took: (g.player.anchors[a.kind] || 0) - before, kind: a.kind };
    });
    check('B7 two true rays meet on the Anchor', rays.n === 2 && Math.hypot(rays.meet[0] - rays.anchor[0], rays.meet[1] - rays.anchor[1]) < 0.01, JSON.stringify(rays));
    check('B7 the Anchor is taken with E', rays.took === 1, rays.kind);
    if (shots) await page.screenshot({ path: `${shots}/${name}-b7-anchor.png`, timeout: 120000 });
    // map with rays
    if (shots) { await page.evaluate(() => { const L = window.__lift; L.map.toggle(true); L.simulate(0.05); }); await page.screenshot({ path: `${shots}/${name}-b7-map.png`, timeout: 120000 }); await page.evaluate(() => window.__lift.map.toggle(false)); }
    // Dawn from the Diary tab
    const dawn = await page.evaluate(async () => {
      const L = window.__lift, g = L.game;
      g.house.maxFloor = Math.max(3, g.house.maxFloor); g.player.nightGlow = 50000 * 9; const clar = g.player.clarity, anchors = JSON.stringify(g.player.anchors), cat = g.player.catalog.length;
      g.pos.x = 0; g.pos.z = 0.8; L.input.events.push({ type: 'key', code: 'KeyE' }); L.simulate(0.1);
      [...document.querySelectorAll('#panel .tab')].find((b) => b.textContent === 'Diary').click();
      document.querySelector('#panel textarea').value = 'The hallway was warm.';
      return { clar, anchors, cat, seed: g.seed };
    });
    await page.evaluate(() => [...document.querySelectorAll('#panel button.buy')].find((b) => b.textContent === 'Let the night end').click());
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => { const g = window.__lift.game; return { clar: g.player.clarity, anchors: JSON.stringify(g.player.anchors), cat: g.player.catalog.length, seed: g.seed, glow: g.player.glow, power: g.player.upgrades.power, maxFloor: g.house.maxFloor, diary: g.player.diary.at(-1) && g.player.diary.at(-1).line }; });
    check('B7 Dawn grants Clarity and keeps Anchors, catalog and diary', after.clar === dawn.clar + 3 && after.anchors === dawn.anchors && after.cat === dawn.cat && after.diary === 'The hallway was warm.', JSON.stringify({ before: dawn, after }));
    check('B7 Dawn resets Glow, upgrades, floors and the house', after.glow < 1 && after.power === 0 && after.maxFloor === 0 && after.seed !== dawn.seed);
    const cos = await page.evaluate(() => { const L = window.__lift; L.simulate(2.2); const v = L.world.viewFor(0, 0, 0); return v && Object.fromEntries(Object.entries(v.cosmetics).map(([k, m]) => [k, m.visible])); });
    check('B7 cabin keeps its drawing after a Dawn', cos && cos.drawing, JSON.stringify(cos));
    if (shots) await page.screenshot({ path: `${shots}/${name}-b7-cabin.png`, timeout: 120000 });
  },
  async 8(page, check, name, shots, ctx) {
    const code = 'E' + Math.floor(Math.random() * 1e5);
    await page.evaluate(async (code) => {
      const L = window.__lift, g = L.game, G = L.Game;
      L.Tide.clearTide(g); g.sortie = null; g.mods = {}; g.pos.x = 0; g.pos.z = 0.8;
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) { if (!x && !z) continue; const r = G.room(g, 0, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = r.touched = true; if (!r.lit) { r.lit = true; G.floorState(g, 0).litCount++; } G.updateStrength(g, 0, x, z); }
      Object.assign(g.house.floors[0], { quiet: false, waves: 0, rank: 5 }); g.house.maxFloor = Math.max(1, g.house.maxFloor);
      window.__liftLocalNet = true; await L.startHost(code);
    }, code);
    const link = await page.evaluate(() => window.__lift.net.link());
    const pageB = await ctx.newPage();
    const errsB = []; pageB.on('pageerror', (e) => errsB.push(String(e)));
    const urlB = url.replace(/\/?$/, '/') + '?profile=b' + link.slice(link.indexOf('#'));
    await pageB.goto(urlB, { waitUntil: 'load' });
    try {
      await pageB.waitForFunction(() => window.__lift && window.__lift.net && window.__lift.net.alive, null, { timeout: 20000 });
      await pageB.waitForFunction(() => window.__lift.game.rooms.size > 10, null, { timeout: 20000 });
    } catch (e) {
      const dB = await pageB.evaluate(() => ({ lift: !!window.__lift, net: !!(window.__lift && window.__lift.net), alive: window.__lift && window.__lift.net && window.__lift.net.alive, welcomed: window.__lift && window.__lift.net && window.__lift.net.welcomed, rooms: window.__lift && window.__lift.game.rooms.size, hash: location.hash, toasts: document.getElementById('toasts').textContent }));
      const dA = await page.evaluate(() => ({ net: !!window.__lift.net, alive: window.__lift.net && window.__lift.net.alive, host: window.__lift.net && window.__lift.net.isHost(), code: window.__lift.net && window.__lift.net.code, players: window.__lift.net && window.__lift.net.players() }));
      throw new Error('join failed ' + JSON.stringify({ dA, dB, errsB }));
    }
    const seeds = { a: await page.evaluate(() => window.__lift.game.house.seed), b: await pageB.evaluate(() => window.__lift.game.house.seed), players: await page.evaluate(() => window.__lift.net.players()) };
    check('B8 a second browser joins by link and shares the house', seeds.a === seeds.b && seeds.players === 2, JSON.stringify(seeds));
    // the guest clears in a shared room; the host sees it
    const merged = await (async () => {
      const tx = await page.evaluate(() => { const L = window.__lift, g = L.game; for (let x = 3; x < 40; x++) { const r = L.Game.room(g, 0, x, 0); if (!r.clearedDone && r.c.reduce((a, b) => a + b, 0) > 50 && !L.Game.isSealed(g, 0, x, 0)) return x; } return 3; });
      const before = await page.evaluate((tx) => { const r = window.__lift.Game.room(window.__lift.game, 0, tx, 0); return r.c.reduce((a, b) => a + b, 0); }, tx);
      await pageB.evaluate((tx) => { const L = window.__lift, g = L.game; g.pos.x = tx * 8 - 2; g.pos.z = 0; g.pos.yaw = 0; g.pos.pitch = -0.5; L.input.tool = true; L.simulate(3); L.input.tool = false; L.net.tick(0.3); }, tx);
      await page.waitForTimeout(400);
      const after = await page.evaluate((tx) => { const r = window.__lift.Game.room(window.__lift.game, 0, tx, 0); return r.c.reduce((a, b) => a + b, 0); }, tx);
      return { before: +before.toFixed(1), after: +after.toFixed(1) };
    })();
    check('B8 the guest’s clearing reaches the host', merged.after < merged.before - 0.5, JSON.stringify(merged));
    // the host calls a wave; both see it; it holds
    await page.evaluate(() => window.__lift.callWave());
    let sawOnB = false, result = null;
    for (let i = 0; i < 40 && !result; i++) {
      result = await page.evaluate(() => { const L = window.__lift; L.simulate(3); L.net.tick(0.3); return L.game.tide && L.game.tide.result; });
      await page.waitForTimeout(60);
      if (await pageB.evaluate(() => !!(window.__lift.game.tide && window.__lift.game.tide.fronts && window.__lift.game.tide.fronts.length))) sawOnB = true;
    }
    await page.evaluate(() => window.__lift.net.tick(0.3)); await page.waitForTimeout(200);
    const bResult = await pageB.evaluate(() => window.__lift.game.tide && window.__lift.game.tide.result);
    check('B8 two browsers hold a wave together', (result === 'held' || result === 'bounced') && sawOnB, JSON.stringify({ host: result, guestSawWave: sawOnB, guestResult: bResult }));
    if (shots) await pageB.screenshot({ path: `${shots}/${name}-b8-guest.png`, timeout: 120000 });
    // the guest keeps a copy and can host the house after the host leaves
    await pageB.evaluate(() => window.__lift.save()); await pageB.waitForTimeout(300);
    await page.evaluate(() => { window.__lift.leaveCoop(); });
    await pageB.evaluate(() => window.__lift.leaveCoop());
    const code2 = await pageB.evaluate(async (code) => { window.__liftLocalNet = true; await window.__lift.hostShared(code); return window.__lift.net && window.__lift.net.code; }, code);
    const pageC = await ctx.newPage();
    await pageC.goto(url.replace(/\/?$/, '/') + '?profile=c' + '#room=' + code2 + '&local=1', { waitUntil: 'load' });
    await pageC.waitForFunction(() => window.__lift && window.__lift.net && window.__lift.game.rooms.size > 10, null, { timeout: 20000 }).catch(() => {});
    const c = await pageC.evaluate(() => ({ seed: window.__lift.game.house.seed, lit: window.__lift.Game.room(window.__lift.game, 0, 1, 0).lit }));
    check('B8 a guest can host the shared house afterwards', c.seed === seeds.a && c.lit, JSON.stringify(c));
    check('B8 no errors in the other browsers', errsB.length === 0, errsB.slice(0, 3).join(' | '));
    await pageB.evaluate(() => window.__lift.leaveCoop()); await pageC.close(); await pageB.close();
  },
  async 9(page, check, name, shots, ctx) {
    // first minute in a fresh save
    const fresh = await ctx.newPage();
    await fresh.goto(url.replace(/\/?$/, '/') + '?profile=fresh' + Math.floor(Math.random() * 1e6), { waitUntil: 'load' });
    await fresh.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
    await fresh.evaluate(BOT); await fresh.evaluate(MOWER);
    await fresh.click('#begin');
    const fm = await fresh.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      L.world.setQuality(2);
      L.simulate(0.1);
      const out = { inCabin: Math.round(g.pos.x / 8) === 0 && Math.round(g.pos.z / 8) === 0, firstRoom: G.info(g, 0, 0, -1).biome.id, clutter: Math.round(G.room(g, 0, 0, -1).total), hint: document.getElementById('hud').textContent.includes('WASD') || document.getElementById('hud').textContent.includes('thumb') };
      const cheapest = Math.min(...['power', 'reach', 'speed', 'shine', 'bright', 'wiring'].map((id) => L.Game.trackLevel ? 0 : 0) || [0]);
      let tUp = 0; const t0 = L.time;
      const cost = Math.min(...['power', 'reach', 'speed', 'shine', 'bright', 'wiring'].map((id) => L.Econ ? L.Econ.upgradeCost(id, 0) : 320));
      for (const [x, z] of [[0, -1], [1, 0], [-1, 0]]) { if (tUp) break; L.simulate(60, () => { if (!tUp && g.player.glow >= cost) tUp = L.time - t0; return tUp > 0 || window.__mow(x, z); }); }
      out.firstUpgrade = +tUp.toFixed(1);
      return out;
    });
    check('B9 first minute: the lift opens onto a room full of balls, with a line of hints', fm.inCabin && fm.firstRoom === 'playroom' && fm.clutter > 100 && fm.hint, JSON.stringify(fm));
    check('B9 first upgrade affordable in about 30 s (bot)', fm.firstUpgrade > 0 && fm.firstUpgrade <= 45, `${fm.firstUpgrade} s`);
    await fresh.close();
    // CPU cost of the game logic per frame, and the GPU load per graphics level with a wave on screen
    const perf = await page.evaluate(() => {
      const L = window.__lift, g = L.game, G = L.Game;
      L.Tide.clearTide(g); L.leaveCoop && L.net && L.leaveCoop();
      g.pos.x = 0; g.pos.z = 0.8;
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) { if (!x && !z) continue; const r = G.room(g, 0, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; if (!r.lit) { r.lit = true; G.floorState(g, 0).litCount++; } G.updateStrength(g, 0, x, z); }
      g.house.floors[0].quiet = false; g.house.floors[0].waves = 0; g.house.floors[0].rank = 5;
      L.callWave(); L.simulate(16);
      const w = g.tide, l = w.fronts[0].lanes[0], cur = l.path[l.i], prev = l.path[Math.max(0, l.i - 1)];
      g.pos.x = cur[0] * 8 - (cur[0] - prev[0]) * 2; g.pos.z = cur[1] * 8 - (cur[1] - prev[1]) * 2 + 0.01; g.pos.yaw = Math.atan2(-(prev[0] - cur[0]), -(prev[1] - cur[1]));
      L.input.tool = true;
      const t0 = performance.now(); L.simulate(5, null, 1 / 60); const cpu = (performance.now() - t0) / 300;
      L.input.tool = false;
      const levels = {};
      for (const lv of [1, 2, 3, 4, 5]) { L.world.setQuality(lv); L.simulate(0.05); L.world.renderer.info.reset(); L.world.renderer.info.autoReset = false; L.renderBench(1); const i = L.world.renderer.info.render; levels[lv] = { calls: i.calls, tris: i.triangles, pr: +L.world.renderer.getPixelRatio().toFixed(2) }; L.world.renderer.info.autoReset = true; }
      L.world.setQuality(2); L.Tide.clearTide(g);
      return { cpuMsPerFrame: +cpu.toFixed(2), levels, lights: L.world.lights.length };
    });
    check('B9 game logic costs little CPU per frame (with a wave and the tool)', perf.cpuMsPerFrame < 6, `${perf.cpuMsPerFrame} ms/frame`);
    check('B9 at most 4 dynamic lights; draw calls stay bounded at every level', perf.lights <= 4 && Object.values(perf.levels).every((l) => l.calls < 400), JSON.stringify(perf.levels));
    // comfort
    const comfort = await page.evaluate(() => { const L = window.__lift, g = L.game; g.pos.x = 30; g.pos.z = 30; L.input.events.push({ type: 'key', code: 'KeyH' }); L.simulate(0.1);
      L.input.events.push({ type: 'key', code: 'Escape' }); L.simulate(0.05); const txt = document.querySelector('#panel').textContent; L.panel.hide();
      return { home: Math.abs(g.pos.x) < 1 && Math.abs(g.pos.z) < 1.5, warm: txt.includes('Warm mode'), fov: txt.includes('Field of view'), graphics: txt.includes('Graphics') }; });
    check('B9 comfort: H returns to the lift; warm mode, FOV and graphics settings', comfort.home && comfort.warm && comfort.fov && comfort.graphics, JSON.stringify(comfort));
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
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const check = (label, ok, info = '') => { res.checks.push({ label, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'} [${name}] ${label} ${info}`); };
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lift && window.__lift.world, null, { timeout: 20000 });
  await page.evaluate(BOT); await page.evaluate(WALK); await page.evaluate(MOWER);
  await page.click('#begin');
  // software GL in this container is slow: run the checks at level 2, then render each level explicitly
  await page.evaluate(() => { window.__lift.game.settings.quality = '2'; window.__lift.world.setQuality(2); });
  await page.waitForTimeout(500);
  if (shots) await page.screenshot({ path: `${shots}/${name}-start.png`, timeout: 120000 });
  for (const b of which) {
    try { await BATCHES[b](page, check, name, shots, ctx); } catch (e) { check(`B${b} ran`, false, String(e).slice(0, 300)); }
  }
  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
  return res;
}

const which = (process.argv[3] || Object.keys(BATCHES).join(',')).split(',');
const devs = (process.env.DEVICES || 'desktop,phone').split(',');
const results = [];
if (devs.includes('desktop')) results.push(await run('desktop', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, which));
if (devs.includes('phone')) results.push(await run('phone', { ...devices['Pixel 7'] }, which));
const allOk = results.every((r) => r.checks.every((c) => c.ok));
console.log(allOk ? 'ALL PASS' : 'SOME FAILED');
process.exit(allOk ? 0 : 1);
