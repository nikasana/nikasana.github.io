import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../src/config.js';
import * as Game from '../src/game.js';
import * as E from '../src/economy.js';
import { sweepRoom, spiral } from './helpers.js';

// Simulated play: a strategy decides which actions to take and what to buy. Returns Glow earned.
function play(strategy, seconds = 1200, seed = 1) {
  const s = Game.newGame(seed);
  let now = 1e6; Game.tickIncome(s, now);
  const rooms = spiral(400);
  const buyTracks = { balanced: ['shovel', 'brush', 'lamp'], clear: ['shovel'], polish: ['brush'], light: ['lamp'] }[strategy];
  let t = 0, i = 0, guard = 0;
  const pass = (dt) => { t += dt; now += dt * 1000; Game.tickIncome(s, now); E.tickHelpers(s, dt, 0); };
  while (t < seconds && guard++ < 2000) {
    const [x, z] = rooms[i++];
    if (Game.info(s, 0, x, z).modifier === 'sealed') continue;
    pass(3); Game.visit(s, 0, x, z);
    const doPolish = strategy === 'balanced' || strategy === 'polish';
    const r = Game.room(s, 0, x, z);
    if (!r.clearedDone || (doPolish && !r.polishedDone)) pass(sweepRoom(s, 0, x, z, { phase: doPolish ? 'all' : 'clear', limit: 400 }));
    if ((strategy === 'balanced' || strategy === 'light') && !r.lit) Game.buyLamp(s, 0, x, z);
    // spend: cheapest upgrade in the allowed tracks, keeping tracks even for balanced play
    for (let k = 0; k < 20; k++) {
      let best = null;
      for (const tr of buyTracks) for (const id of E.TRACKS[tr]) {
        const c = E.upgradeCost(id, s.player.upgrades[id]);
        const score = c * (strategy === 'balanced' ? 1 + 0.5 * Game.trackLevel(s.player, tr) : 1);
        if (!best || score < best[1]) best = [id, score, c];
      }
      if (best && s.player.glow >= best[2] * (strategy === 'balanced' ? 1.6 : 1)) E.buyUpgrade(s, best[0]); else break;
    }
    if (strategy === 'balanced') for (let k = 0; k < 10; k++) {
      const kind = E.HELPERS.reduce((a, b) => (s.player.helpers[a] <= s.player.helpers[b] ? a : b));
      const c = E.helperCost(kind, s.player.helpers[kind]);
      if (s.player.glow > c * 3) E.buyHelper(s, kind); else break;
    }
  }
  return { earned: s.player.nightGlow, income: Game.incomeRate(s), s };
}

test('balanced play outpaces any single-action play', () => {
  for (const seed of [1, 2, 3]) {
    const bal = play('balanced', 1200, seed);
    for (const st of ['clear', 'polish', 'light']) {
      const one = play(st, 1200, seed);
      console.log(`seed ${seed} balanced/${st} = ${(bal.earned / one.earned).toFixed(2)}`);
      assert.ok(bal.earned > one.earned * 1.2, `seed ${seed}: balanced ${bal.earned.toFixed(0)} vs ${st} ${one.earned.toFixed(0)}`);
    }
  }
});

test('first upgrade is affordable in about 30 s of play', () => {
  const s = Game.newGame(5);
  let t = 0;
  const cheapest = Math.min(...E.UPGRADE_IDS.map((id) => E.upgradeCost(id, 0)));
  let base = 0;
  for (const [x, z] of [[0, -1], [1, 0], [0, 1]]) {
    if (t) break;
    base += 3 + sweepRoom(s, 0, x, z, { onEvent: (ev, tt) => { if (!t && s.player.glow >= cheapest) t = base + 3 + tt; } });
  }
  assert.ok(t > 15 && t < 45, `first upgrade at ${t.toFixed(1)} s`);
  console.log(`first upgrade affordable at ${t.toFixed(1)} s`);
});

test('a power tier is x4 for about x6 the cost', () => {
  assert.equal(E.upgradeEffect('power', 1) / E.upgradeEffect('power', 0), 4);
  assert.ok(Math.abs(E.upgradeCost('power', 3) / E.upgradeCost('power', 2) - 6) < 0.05);
});

test('helper pipeline runs at the slowest stage and names it', () => {
  const s = Game.newGame(1);
  s.player.helpers = { sweeper: 4, mop: 2, firefly: 3 };
  const p = E.pipeline(s);
  assert.equal(p.bottleneck, 'mop'); assert.equal(p.cellsPerSec, 2 * CFG.helpers.cellsPerSec);
  assert.ok(Math.abs(E.helperCost('mop', 10) / E.helperCost('mop', 9) - 1.15) < 0.01);
});

test('helpers work only in visited rooms, faster near the player', () => {
  const s = Game.newGame(2);
  s.player.helpers = { sweeper: 2, mop: 2, firefly: 2 };
  const unvisited = Game.room(s, 0, 2, 0);
  Game.visit(s, 0, 1, 0); Game.visit(s, 0, -1, 0);
  const cnt = (x) => Game.room(s, 0, x, 0).c.filter((v) => v > 0).length;
  const n0 = cnt(1), f0 = cnt(-1);
  E.tickHelpers(s, 10, 0, 1, 0, 0);
  assert.equal(unvisited.touched, false);
  const near = n0 - cnt(1);
  assert.equal(f0 - cnt(-1), 0, 'helpers start with the room nearest the player');
  const s2 = Game.newGame(2); s2.player.helpers = { sweeper: 2, mop: 2, firefly: 2 };
  Game.visit(s2, 0, 1, 0); const m0 = Game.room(s2, 0, 1, 0).c.filter((v) => v > 0).length;
  E.tickHelpers(s2, 10, 0, 5, 5, 0);   // player far away: no aura
  const without = m0 - Game.room(s2, 0, 1, 0).c.filter((v) => v > 0).length;
  assert.ok(near > without * 1.6, `aura ${near} vs ${without}`);
});

test('balance bonus: +10 % Glow per level of the lowest track', () => {
  const s = Game.newGame(1);
  const m0 = Game.glowMult(s, 0);
  s.player.upgrades.power = 3; s.player.upgrades.speed = 1; s.player.upgrades.bright = 2;
  assert.ok(Math.abs(Game.glowMult(s, 0) / m0 - 1.1) < 1e-9);
});

test('offline: half income up to 8 h, helpers extend territory, rested charges', () => {
  const s = Game.newGame(3);
  s.player.glow = 1e6; Game.buyLamp(s, 0, 1, 0); sweepRoom(s, 0, 1, 0);
  s.player.helpers = { sweeper: 1, mop: 1, firefly: 1 };
  Game.visit(s, 0, 0, -1);
  const rate = Game.incomeRate(s);
  s.lastTs = 1e9; const g0 = s.player.glow;
  const res = E.applyOffline(s, 1e9 + 10 * 3600 * 1000);
  const fromIncome = rate * 8 * 3600 * 0.5;
  assert.ok(res.glow >= fromIncome - 1e-6 && res.glow < fromIncome * 1.5 + 5000, `${res.glow} vs ${fromIncome}`);
  assert.ok(Game.room(s, 0, 0, -1).clearedDone, 'helpers finished the visited room');
  assert.equal(res.rested, 3);
  assert.equal(E.applyOffline(s, 1e9 + 10 * 3600 * 1000 + 30000).glow, 0, 'short gaps are not offline');
});
