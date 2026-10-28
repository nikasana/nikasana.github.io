#!/usr/bin/env node
// Batch 6 checks with Playwright: Auralis, the Aurora Chain, lone sky coins, the full milestone set,
// the completed DNA tree, tide-sealed capsules, the Sky Choir theme, aurora ribbons on the globe,
// and co-op polish (Crew Roles, crew milestones, host migration with three tabs).
// Usage: node incremental/tools/batch6.mjs [--port 8123] [--out dir] [--skip-coop]   (needs a static server on incremental/)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = dirname(fileURLToPath(import.meta.url));
const out = opt('--out', join(here, 'shots', 'batch6'));
mkdirSync(out, { recursive: true });
const base = `http://localhost:${opt('--port', '8123')}/index.html`;
const results = [], errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const watch = (page, label) => {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e.message}`.slice(0, 300)));
};
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
watch(page, 'solo');
const ev = (fn, a, p = page) => p.evaluate(fn, a);
const wait = (ms, p = page) => p.waitForTimeout(ms);
const shot = async (name, p = page) => { await p.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82, timeout: 240000 }); console.log(`      shot ${name}.jpg`); };
async function until(p, fn, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await p.evaluate(fn)) return true; await p.waitForTimeout(500); }
  return false;
}

await page.goto(`${base}?force&preset=low&dev=1&slot=batch6`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click());
await page.waitForFunction(() => window.__game.started, null, { timeout: 90000 });

// travel to Auralis
await ev(() => { const g = window.__game; g.econ.total = g.econ.total.constructor.fromNumber(2e9); g.econ.time = 3600; g.econ.depth = 1000; g.travelTo('auralis', 'N'); });
await wait(15000);
const a6 = await ev(() => {
  const g = window.__game;
  return { planet: g.econ.planet, theme: g.music.theme.id, choir: g.music.theme.choir, ambient: g.aurora.ambient,
    mutants: [...new Set(g.mutants.map((m) => m.type))].sort().join(','), capsules: g.frozen.items.filter((i) => i.kind === 'capsule').length, needle: g.frozen.items.some((i) => i.kind === 'needle') };
});
check('Auralis loads with its Sky Choir theme and a standing aurora', a6.planet === 'auralis' && a6.theme === 'auralis' && a6.choir > 0 && a6.ambient > 0, JSON.stringify(a6));
check('Auralis has its own mutant ice, three capsules and a Golden Needle', a6.mutants === 'lumice,prismice' && a6.capsules === 3 && a6.needle, JSON.stringify(a6));
await ev(() => { const g = window.__game; g.input.locked = true; g.clickPlay.hidden = true; g.ctl.pitch = 0.5; g.startAurora(); });
await wait(6000);
await shot('01-auralis-aurora');

// the Aurora Chain: catch sky coins one after another; each is worth more
const chain = await ev(async () => {
  const g = window.__game, gains = [];
  g.chain.n = 0;
  for (let k = 0; k < 4; k++) {
    const c = g.coins.loose.find((x) => x.sky);
    if (!c) break;
    c.value = 100;   // equal coins, so the gains show the chain multiplier alone
    const v0 = g.econ.total.toNumber(), n0 = g.chain.n;
    g.ctl.teleport(c.p.x, c.floorY + 0.1, c.p.z);
    const t0 = performance.now();
    while (g.chain.n === n0 && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 200));
    gains.push(g.econ.total.toNumber() - v0);
  }
  return { n: g.chain.n, gains: gains.map((x) => Math.round(x)) };
});
check('Catching sky coins in a row builds the Aurora Chain', chain.n >= 3, JSON.stringify(chain));
check('Each catch in the chain is worth more than the last', chain.gains.length >= 3 && chain.gains[2] > chain.gains[0] * 1.3, chain.gains.join(' < '));
await wait(500);
await shot('02-aurora-chain');
const miss = await ev(() => {
  const g = window.__game, before = g.chain.n;
  const c = g.coins.loose.find((x) => x.sky) || (g.dropSkyCoin(false), g.coins.loose.find((x) => x.sky));
  c.p.set(g.ctl.pos.x + 12, c.p.y, g.ctl.pos.z); c.t = c.life + 1;
  return new Promise((r) => setTimeout(() => r({ before, after: g.chain.n }), 1500));
});
check('A sky coin that fades uncaught breaks the chain', miss.before > 0 && miss.after === 0, JSON.stringify(miss));
const lone = await ev(() => { const g = window.__game, n0 = g.coins.loose.filter((c) => c.sky && c.tier === 4).length; g.dropSkyCoin(true); return g.coins.loose.filter((c) => c.sky && c.tier === 4).length - n0; });
check('Lone sky coins (relic tier) fall between auroras on Auralis', lone === 1);

// milestones: the full set, per planet, including the Aurora Chain
const ms = await ev(() => {
  const g = window.__game;
  g.countMax('chainBest', 10);
  g.checkMilestones();
  return { chain: g.econ.milestones.aur_chain !== undefined, n: Object.keys(g.econ.milestones).length };
});
check('The Aurora Chain milestone pays out', ms.chain, JSON.stringify(ms));
await ev(() => { const g = window.__game; g.devMilestone('crater100'); g.menus.show('collections'); });
await wait(2500);
await ev(() => [...document.querySelectorAll('.tab')].find((b) => b.dataset.t === 'milestones')?.click());
await wait(1500);
const msCards = await ev(() => document.querySelectorAll('.coll .card').length);
check('Notebook lists this planet\'s milestones (general plus Auralis)', msCards >= 13, `${msCards} cards`);
await shot('03-milestones');
await ev(() => window.__game.menus.close());

// DNA: Auralis mutant ice, its DNA, and the Apex Form capstone
await ev(() => { const g = window.__game; for (let y = 0; y >= -3; y -= 0.5) g.applyOp({ kind: 'dig', x: 6, y, z: 2, r: 1.6, seed: 2 }, 'local'); g.ctl.teleport(6, -3.2, 2); g.ctl.yaw = 0; g.ctl.pitch = 0; });
await wait(4000);
const mut = await ev(() => {
  const g = window.__game, type = g.devMutant();
  const m = g.mutants.find((x) => x.type === type && Math.hypot(x.x - g.ctl.pos.x, x.z - g.ctl.pos.z) < 8);
  const sky0 = g.coins.loose.filter((c) => c.sky).length;
  g.lumT = -99;
  g.onStrike({ point: new window.__THREE.Vector3(m.x, m.y, m.z), normal: new window.__THREE.Vector3(0, 0, 1), removed: 0.1, crit: false, heavy: false, drill: false, pre: false, rich: 0.3, depth: 3, hard: 1 });
  return { type, found: !!g.econ.mutations[type], sky: g.coins.loose.filter((c) => c.sky).length - sky0 };
});
check('Auralis mutant ice is discovered (Lumice calls a sky coin)', mut.found && (mut.type !== 'lumice' || mut.sky >= 1), JSON.stringify(mut));
await wait(3000);
await shot('04-auralis-mutant');
const dna = await ev(() => {
  const g = window.__game;
  for (const id of ['glowice', 'springice', 'tarfrost', 'chimeice', 'emberice', 'obsidice', 'brineice', 'pearlice', 'ventice', 'stormglass', 'lumice', 'prismice']) g.econ.mutations[id] = true;
  for (const id of ['dna_legs', 'dna_arms', 'dna_steady', 'dna_hands', 'dna_salt', 'dna_wind', 'dna_sky']) g.devLevel(id, 1);
  const walk0 = g.stats.walkSpeed;
  g.devLevel('dna_apex', 1);
  return { types: 12, apex: g.econ.levels.dna_apex || 0, walk0, walk1: g.stats.walkSpeed };
});
check('DNA tree completed: every mutant type has DNA and the Apex Form capstone unlocks', dna.apex === 1 && dna.walk1 > dna.walk0, JSON.stringify(dna));
await ev(() => { const g = window.__game; g.econ.coins = g.econ.coins.constructor.fromNumber(1e9); g.menus.show('upgrades'); });
await wait(9000);
await ev(() => { const t = window.__game.menus.tree; t.scale = 0.6; t.ox = 640; t.oy = -160; t.apply(); });
await wait(1000);
await shot('05-dna-tree');
await ev(() => window.__game.menus.close());

// tide-sealed capsule: freed, it opens once you wait beside it
const tide = await ev(() => {
  const g = window.__game, it = g.frozen.items.find((i) => i.kind === 'capsule' && i.data.puzzle?.kind === 'tide');
  if (!it) return { found: false };
  for (let k = 0; k < 40; k++) g.frozen.puzzle('tide', it.mesh.position, 0.25, 1);
  return { found: true, open: (it.progress || 0) >= it.data.puzzle.need };
});
check('Tide-sealed capsules open after the tide turns', tide.found && tide.open, JSON.stringify(tide));

// planet view with aurora ribbons
await ev(() => { window.__game.input.locked = true; window.__game.togglePlanet(true); });
await until(page, () => window.__game.view === 'planet' && window.__game.planetView.dist > 3, 60000);
check('Aurora ribbons ring the Auralis globe', await ev(() => window.__game.planetView.ribbons.visible));
await shot('06-planet-ribbons');
await ev(() => window.__game.togglePlanet(false));

const code = await ev(() => window.__game.exportSave());
writeFileSync(join(here, 'saves', 'batch6-auralis.code.txt'), code);
check('Auralis save code exported for the fixtures', /^MTP\d+[zr]:/.test(code), `${code.length} chars`);
await page.close();

// ---------- co-op: Crew Roles, crew milestones, host migration (three tabs) ----------
if (!args.includes('--skip-coop')) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  const openTab = async (q, label) => {
    const p = await ctx.newPage(); watch(p, label);
    await p.goto(`${base}?force&preset=low&coopdebug=1&dev=1&${q}`);
    await p.waitForFunction(() => window.__game && window.__game.econ, null, { timeout: 90000 });
    return p;
  };
  const host = await openTab('slot=c6host', 'host');
  await ev(() => localStorage.clear(), null, host);
  await host.reload();
  await host.waitForFunction(() => window.__game?.menus?.cur === 'start', null, { timeout: 90000 });
  await ev(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Begin')).click(), null, host);
  await until(host, () => window.__game.started);
  await ev(async () => { const g = window.__game; g.settings.crewRole = 'digger'; await g.crewCreate(); }, null, host);
  const code6 = await ev(() => window.__game.crew.code, null, host);
  const m1 = await openTab(`slot=c6m1&join=${code6}`, 'member1');
  const j1 = await until(m1, () => window.__game.crew.active && window.__game.started && window.__game.slot.startsWith('crew.'), 300000);
  await ev(() => { window.__game.settings.crewRole = 'melter'; }, null, m1);
  const m2 = await openTab(`slot=c6m2&join=${code6}`, 'member2');
  const j2 = await until(m2, () => window.__game.crew.active && window.__game.started && window.__game.slot.startsWith('crew.'), 300000);
  await ev(() => { window.__game.settings.crewRole = 'seer'; }, null, m2);
  const three = await until(host, () => window.__game.crew.members.size >= 2, 120000);   // three tabs on software WebGL load slowly
  check('Three crewmates in one crew', three, `joined ${j1} ${j2}`);
  const mixed = await until(m1, () => window.__game.crew.mix > 1.07, 60000);
  const roles = await ev(() => ({ mix: window.__game.crew.mix, role: window.__game.econ.role, mult: window.__game.stats.meltPower }), null, m1);
  check('Crew Roles: three roles share a mixed-crew bonus, and your role boosts its tree', mixed && roles.role === 'melter', JSON.stringify(roles));
  // a member's sky catch counts toward the crew milestone on the host
  await ev(() => { const g = window.__game; g.dropSkyCoin(false); const c = g.coins.loose.find((x) => x.sky); g.catchSky(c, g.ctl.pos.clone()); }, null, m1);
  const sky = await until(host, () => (window.__game.crew.progress.crewSky || 0) >= 1, 30000);
  check('A crewmate\'s sky catch counts toward the crew milestone', sky);
  await ev(() => window.__game.menus.show('crew'), null, host);
  await wait(1500, host);
  const msRows = await ev(() => document.querySelectorAll('.coop .ms > div').length, null, host);
  check('Crew screen lists the full crew milestone set', msRows >= 11, `${msRows} rows`);
  await shot('07-crew-roles', host);
  await ev(() => window.__game.menus.close(), null, host);
  // host migration: the host closes; one member takes over, the other rejoins the new host
  await host.close();
  const took = await until(m1, () => window.__game.crew.isHost, 60000) || await until(m2, () => window.__game.crew.isHost, 5000);
  const hosts = (await ev(() => window.__game.crew.isHost, null, m1) ? 1 : 0) + (await ev(() => window.__game.crew.isHost, null, m2) ? 1 : 0);
  check('Host migration: a member takes over the crew on their own', took && hosts === 1, `hosts ${hosts}`);
  const [nh, other] = (await ev(() => window.__game.crew.isHost, null, m1)) ? [m1, m2] : [m2, m1];
  const back = await until(other, () => window.__game.crew.active && !window.__game.crew.lostHost && !window.__game.crew.isHost, 90000);
  const seesOther = await until(nh, () => window.__game.crew.members.size >= 1, 30000);
  check('The other member rejoins the new host', back && seesOther);
  await ev(() => window.__game.applyOp({ kind: 'dig', x: -6, y: -1, z: -6, r: 1.5, seed: 5 }, 'local'), null, nh);
  const synced = await until(other, () => window.__game.volume.sample(-6, -1, -6) < 100, 60000);
  check('The crater keeps syncing after migration', synced);
  await ev(() => window.__game.menus.show('crew'), null, nh);
  await wait(1500, nh);
  await shot('08-after-migration', nh);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(out, 'report.md'), [`# Batch 6 checks`, '', `${results.length - failed.length}/${results.length} checks passed.`, '',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`), '', '## Console errors', '', errors.length ? errors.map((e) => `- ${e}`).join('\n') : 'None.', ''].join('\n'));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${errors.length} console errors`);
process.exitCode = failed.length || errors.length ? 1 : 0;
