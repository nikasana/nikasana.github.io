#!/usr/bin/env node
// Scripted play session with Playwright: dig, collect, bank, buy, open every screen, planet view,
// dev-menu features, and a two-tab co-op test (?coopdebug=1). Screenshots go to tools/shots/<batch>/.
// Usage: node incremental/tools/playtest.mjs [--batch batch1] [--port 8123] [--preset low] [--skip-coop | --coop-only] [--out dir]
// Needs a static server on the incremental/ folder (python3 -m http.server 8123).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BATCH = opt('--batch', 'batch1');
const PORT = opt('--port', '8123');
const PRESET = opt('--preset', 'low');
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', BATCH));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${PORT}/index.html`;
const results = [];
const errors = [];
const W = 960, H = 540;

function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); }

async function open(browser, query, label, context = null) {
  // co-op tabs must share one browser context, like two tabs in one real browser
  const page = context ? await context.newPage() : await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`.slice(0, 400)); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e.message}`.slice(0, 400)));
  await page.goto(`${base}?force&preset=${PRESET}&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.econ, null, { timeout: 60000 });
  return page;
}

const shot = async (page, name) => { await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82, timeout: 240000 }); console.log(`      shot ${name}.jpg`); };
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const wait = (page, ms) => page.waitForTimeout(ms);
// run until a condition holds in the page (software WebGL is slow, so game time is the clock)
async function until(page, fn, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(500); }
  return false;
}

async function begin(page) {
  await ev(page, () => { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.menus && window.__game.menus.cur === 'start', null, { timeout: 60000 });
  await shot(page, '00-start-pole-pick');
  await ev(page, () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
  await until(page, () => window.__game.started);
  // headless browsers cannot take pointer lock: mark it as held so input flows like in play
  await ev(page, () => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; });
}

async function main() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  if (!args.includes('--coop-only')) await solo(browser);
  if (!args.includes('--skip-coop')) await coop(browser);
  await browser.close();
  finish();
}

async function solo(browser) {
  const page = await open(browser, 'dev=1&slot=playtest', 'solo');
  await begin(page);
  await wait(page, 3000);
  await shot(page, '01-first-person');

  // dig: look at the ice in front and hold the mouse
  await ev(page, () => { const g = window.__game; g.ctl.pitch = -0.75; });
  const c0 = await ev(page, () => window.__game.econ.coins.toNumber());
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down();
  const dug = await until(page, () => window.__game.econ.volume > 0.6 && window.__game.state.carried.value > 0, 150000);
  await shot(page, '02-digging');
  await page.mouse.up();
  check('Digging removes ice and fills the pack', dug, JSON.stringify(await ev(page, () => ({ vol: window.__game.econ.volume.toFixed(2), carried: window.__game.state.carried }))));
  const banked = await until(page, () => window.__game.econ.coins.toNumber() > 0, 60000);
  const c1 = await ev(page, () => window.__game.econ.coins.toNumber());
  check('Banking at the lift beacon credits the vault', banked && c1 > c0, `coins ${c0} -> ${c1}`);
  check('First upgrade affordable within seconds of digging', await until(page, () => { const g = window.__game; const n = g.econ.coins.toNumber(); return n >= 2.6; }, 90000), `coins ${await ev(page, () => window.__game.econ.coins.toNumber())}`);

  // buy through the upgrade graph
  await page.keyboard.press('KeyU');
  await until(page, () => window.__game.menus.cur === 'upgrades');
  await wait(page, 1500);
  await shot(page, '03-upgrade-tree');
  const bought = await ev(page, () => { const g = window.__game; const ids = ['dig_edge', 'auto_pack', 'vis_lamp', 'melt_torch']; let n = 0; for (const id of ids) if (g.buy(id)) n++; return n; });
  check('Buying from the upgrade tree', bought >= 1, `${bought} bought`);
  await page.keyboard.press('Escape');

  // dev: fast-forward the economy so later features are reachable
  await ev(page, () => { const g = window.__game; g.devCoins(new (g.econ.coins.constructor)(5, 4)); for (const id of ['melt_torch', 'vis_lamp', 'melt_flame', 'melt_fan', 'auto_pack', 'auto_lift', 'auto_stake']) g.buy(id); g.devLevel('auto_stake', 3); g.statsDirty = true; });

  // torch + meltwater
  await ev(page, () => { const g = window.__game; g.input.locked = true; g.menus.close(); g.tools.select(1, g.stats); g.ctl.pitch = -0.7; });
  await page.mouse.down();
  const melted = await until(page, () => window.__game.econ.melted > 0.05 && window.__game.water.pools.length > 0, 120000);
  await shot(page, '04-torch-meltwater');
  await page.mouse.up();
  check('Torch melts ice and leaves meltwater', melted, JSON.stringify(await ev(page, () => { const g = window.__game; return { melted: g.econ.melted.toFixed(3), pools: g.water.pools.length, down: [...g.input.down], locked: g.input.locked, block: g.input.blockGame, menu: g.menus.cur, view: g.view, hit: !!g.tools.hit, fam: g.tools.family, tier: g.stats.meltTier }; })));

  // lamp
  await ev(page, () => { const g = window.__game; g.tools.select(3, g.stats); g.ctl.pitch = -0.4; });
  await wait(page, 2000);
  await shot(page, '05-lamp');

  // dig a shaft with the dev menu to show the crater, strata and beacon following
  await ev(page, () => { const g = window.__game; g.devMenu.toggle(); });
  await wait(page, 1200);
  await shot(page, '06-dev-menu');
  await ev(page, () => { const g = window.__game; g.devMenu.toggle(); g.input.locked = true; g.devShaft(22); g.ctl.pitch = 0.9; });
  await until(page, () => window.__game.volume.pending() < 4, 90000);
  await wait(page, 4000);
  await shot(page, '07-crater-walls-strata');
  await ev(page, () => { const g = window.__game; g.ctl.pitch = -0.2; g.ctl.yaw += 1.4; });
  await wait(page, 3000);
  await shot(page, '08-beacon-in-crater');
  check('Crater depth tracked', (await ev(page, () => window.__game.craterDepth())) > 15, `${(await ev(page, () => window.__game.craterDepth())).toFixed(1)} m`);

  // milestone + capsule + needle via dev menu
  await ev(page, () => { const g = window.__game; g.devMilestone('crater25'); g.devMilestone('sea5'); });
  check('Milestones pay out', await ev(page, () => Object.keys(window.__game.econ.milestones).length >= 2));
  await ev(page, () => window.__game.devBring('capsule'));
  const cap = await until(page, () => Object.keys(window.__game.state.capsules).length > 0, 60000);
  await shot(page, '09-time-capsule');
  check('Time capsule opens when freed and reached', cap);
  await ev(page, () => window.__game.devBring('needle'));
  const needle = await until(page, () => window.__game.state.needle, 60000);
  check('Golden Needle found', needle);
  await ev(page, () => window.__game.devResonance('matched'));
  check('Resonance logged in the notebook', await ev(page, () => window.__game.econ.found.matched !== undefined));

  // screens
  for (const [key, name, file] of [['KeyJ', 'collections', '10-notebook'], ['KeyC', 'crew', '11-crew'], ['KeyM', 'music', '12-music']]) {
    await ev(page, () => { window.__game.input.locked = true; });
    await page.keyboard.press(key);
    const ok = await until(page, (n) => window.__game.menus.cur === n, 20000).catch(() => false) || await ev(page, (n) => window.__game.menus.cur === n, name);
    await wait(page, 800);
    await shot(page, file);
    check(`Screen opens: ${name}`, await ev(page, (n) => window.__game.menus.cur === n, name));
    await page.keyboard.press('Escape');
  }
  await ev(page, () => window.__game.menus.show('settings'));
  await wait(page, 800);
  await shot(page, '13-settings-graphics');
  await ev(page, () => { const g = window.__game; g.menus.close(); g.menus.show('pause'); });
  await wait(page, 800);
  await shot(page, '14-pause');
  await ev(page, () => window.__game.menus.close());

  // planet view
  await ev(page, () => { window.__game.input.locked = true; window.__game.togglePlanet(true); });
  const pv = await until(page, () => window.__game.view === 'planet', 30000);
  await until(page, () => window.__game.gfx.flash < 0.02 && window.__game.planetView.dist > 3, 60000);
  await shot(page, '15-planet-view');
  check('Planet view opens', pv);
  await ev(page, () => window.__game.togglePlanet(false));
  check('Planet view returns to first person', await until(page, () => window.__game.view === 'fp', 30000));

  // settings: V-Sync off + frame cap + perf overlay
  await ev(page, () => { const g = window.__game; Object.assign(g.settings, { vsync: false, fpsCap: 60, perfOverlay: true }); g.applySettings(); });
  await wait(page, 3000);
  await shot(page, '16-perf-overlay');
  const perf = await ev(page, () => document.querySelector('.perf')?.textContent || '');
  check('Performance overlay shows frame time', /ms/.test(perf), perf);

  // saves: autosave, export, import
  await ev(page, () => window.__game.save());
  const code = await ev(page, () => window.__game.exportSave());
  check('Save code exports', typeof code === 'string' && /^MTP\d+[zr]:/.test(code), `${code.length} chars`);
  const before = await ev(page, () => window.__game.econ.purchases);
  await ev(page, async (c) => { await window.__game.importSave(c); }, code);
  check('Save code imports', (await ev(page, () => window.__game.econ.purchases)) === before);
  writeFileSync(join(here, 'saves', `${BATCH}-playtest.code.txt`), code);

  // offline return
  await ev(page, () => { const g = window.__game; Object.assign(g.settings, { vsync: true, fpsCap: 0, perfOverlay: false }); g.applySettings(); g.devOffline(3600); });
  await wait(page, 800);
  await shot(page, '17-offline-summary');
  check('Offline summary shown', await ev(page, () => window.__game.menus.cur === 'offline'));
  await ev(page, () => window.__game.menus.close());
  await page.close();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  const report = [`# Playtest ${BATCH}`, '', `Preset ${PRESET}, ${W}x${H}, software WebGL. ${results.length - failed.length}/${results.length} checks passed.`, '',
    ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '',
    '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n');
  writeFileSync(join(out, 'report.md'), report);
  console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
  process.exitCode = failed.length || errors.length ? 1 : 0;
}

async function coop(browser) {
  // two tabs in one browser share a BroadcastChannel: host creates, member joins by link
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const host = await open(browser, 'coopdebug=1&dev=1&slot=coophost', 'host', ctx);
  await begin(host);
  await ev(host, async () => { await window.__game.crewCreate(); });
  const code = await ev(host, () => window.__game.crew.code);
  check('Crew created with a room code', /^[A-Z0-9]{6}$/.test(code || ''), code);
  const link = await ev(host, () => window.__game.crew.link());
  check('Join link carries the code', link.includes(`join=${code}`), link);
  const member = await open(browser, `coopdebug=1&dev=1&slot=coopmember&join=${code}`, 'member', ctx);
  const joined = await until(member, () => window.__game.crew.active && window.__game.started && window.__game.slot.startsWith('crew.'), 150000);  // software WebGL loads the crater slowly
  check('Member joins through the link', joined);
  // host digs, member sees the edit; member banks, host vault grows
  await ev(host, () => { const g = window.__game; g.input.locked = true; g.applyOp({ kind: 'dig', x: 6, y: -1, z: -6, r: 1.5, seed: 3 }, 'local'); });
  const synced = await until(member, () => window.__game.volume.sample(6, -1, -6) < 100, 60000);
  check('Dig edits sync host -> member', synced);
  const hostCoins0 = await ev(host, () => window.__game.econ.coins.toNumber());
  await ev(member, () => { const g = window.__game; g.crew.bank(500, [1, 2, 3]); });
  const credited = await until(host, () => window.__game.econ.coins.toNumber() >= 500, 30000);
  check('Member banking credits the shared vault', credited, `${hostCoins0} -> ${await ev(host, () => window.__game.econ.coins.toNumber())}`);
  const seen = await until(host, () => window.__game.avatars.map.size > 0, 30000);
  check('Crewmate avatar appears', seen);
  await ev(host, () => { const g = window.__game; const [id] = g.avatars.map.keys(); const a = g.avatars.map.get(id); const p = a.root.position; g.ctl.teleport(p.x, p.y, p.z + 4); g.ctl.yaw = 0; g.ctl.pitch = -0.1; });
  await wait(host, 4000);
  await shot(host, '18-coop-avatar');
  await ev(host, () => window.__game.menus.show('crew'));
  await wait(host, 800);
  await shot(host, '19-coop-crew-screen');
  // host leaves: member keeps playing and can resume as host
  await host.close();
  const lost = await until(member, () => window.__game.crew.lostHost, 30000);
  check('Member keeps playing when the host leaves', lost);
  const resumed = await ev(member, async () => window.__game.crew.resumeAsHost());
  check('Member resumes as host from their copy', resumed && (await ev(member, () => window.__game.crew.isHost)));
  await member.close();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
