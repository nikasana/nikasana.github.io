// Batch 9: the targets under "Design pillars" and "Performance", measured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, roomSide } from '../src/config.js';
import * as Game from '../src/game.js';
import * as Tide from '../src/tide.js';
import * as E from '../src/economy.js';
import { sweepRoom, spiral } from './helpers.js';

// matched tier: upgrades that a player reaching floor f would have
const tier = (s, f) => Object.assign(s.player.upgrades, { power: f, reach: f, speed: f, shine: 0, bright: 0, wiring: 0 });

test('a room always takes 20-40 s at the matching tier (floors 0, 3, 6, 9)', () => {
  for (const f of [0, 3, 6, 9]) {
    const times = [];
    for (const seed of [1, 2, 3, 4]) {
      const s = Game.newGame(seed); s.house.maxFloor = f; tier(s, f);
      let x = 1; while (Game.info(s, f, x, 0).modifier !== 'normal' || Game.info(s, f, x, 0).setPiece) x++;
      times.push(sweepRoom(s, f, x, 0));
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`floor ${f} (room ${roomSide(f)} m): ${times.map((t) => t.toFixed(0)).join(', ')} s`);
    assert.ok(avg >= 20 && avg <= 40, `floor ${f}: ${avg.toFixed(1)} s`);
  }
});

test('a wave lasts 1-2 minutes', () => {
  for (const [f, k] of [[0, 1], [0, 3], [3, 1], [3, 5]]) {
    const s = Game.newGame(5); s.house.maxFloor = f; Game.floorState(s, f).waves = k - 1;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) { if (!x && !z) continue; const r = Game.room(s, f, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.lit = true; Game.floorState(s, f).litCount++; Game.updateStrength(s, f, x, z); }
    s.player.helpers = { sweeper: 10, mop: 10, firefly: 10 };
    Tide.startWave(s, f);
    let w = s.tide; while (!w.result) { for (const c of Tide.contacts(s)) Tide.sweepBoost(s, f, c.x, c.z, 0.1); w = Tide.tick(s, 0.1); }
    console.log(`floor ${f} wave ${k}: ${w.t.toFixed(0)} s, ${w.result}`);
    assert.ok(w.t >= 60 && w.t <= 120, `${w.t}`);
  }
});

test('skill moves the result by about ±40 % (same upgrades, different hands)', () => {
  // Glow from five minutes of sweeping at three skill levels: careful-but-slow, typical, sharp.
  const run = (speedMult) => { const s = Game.newGame(9); tier(s, 0); let t = 0; for (const [x, z] of spiral(60)) { if (t > 300) break; if (Game.info(s, 0, x, z).modifier === 'sealed') continue; t += 3 / speedMult + sweepRoom(s, 0, x, z, { speedMult }); } return s.player.nightGlow / t; };
  const slow = run(0.6), mid = run(1), sharp = run(1.4);
  console.log(`Glow/s by skill: slow ${slow.toFixed(1)}, typical ${mid.toFixed(1)}, sharp ${sharp.toFixed(1)} (${(100 * (slow / mid - 1)).toFixed(0)} % / +${(100 * (sharp / mid - 1)).toFixed(0)} %)`);
  assert.ok(slow / mid > 0.5 && slow / mid < 0.8, 'slow hands earn roughly 40 % less');
  assert.ok(sharp / mid > 1.15 && sharp / mid < 1.5, 'sharp hands earn roughly 40 % more');
});

test('growth gates scale: deeper floors need the matching tier', () => {
  const s = Game.newGame(2); s.house.maxFloor = 3; tier(s, 0);
  let x = 1; while (Game.info(s, 3, x, 0).modifier !== 'normal' || Game.info(s, 3, x, 0).setPiece) x++;
  const t = sweepRoom(s, 3, x, 0, { limit: 300 });
  assert.ok(t > 120, `floor 3 with floor-0 tools takes ${t.toFixed(0)} s`);
});

test('first minute: the first upgrade in about 30 s, the first lamp sooner', () => {
  const s = Game.newGame(5);
  let tUp = 0, tLamp = 0, base = 0;
  const cheapest = Math.min(...E.UPGRADE_IDS.map((id) => E.upgradeCost(id, 0)));
  for (const [x, z] of [[0, -1], [1, 0], [0, 1]]) { if (tUp) break; base += 3 + sweepRoom(s, 0, x, z, { onEvent: (ev, tt) => { if (!tLamp && s.player.glow >= Game.lampCost(s, 0)) tLamp = base + 3 + tt; if (!tUp && s.player.glow >= cheapest) tUp = base + 3 + tt; } }); }
  console.log(`first lamp affordable at ${tLamp.toFixed(1)} s, first upgrade at ${tUp.toFixed(1)} s (efficient sweeping)`);
  assert.ok(tLamp < tUp && tUp < 40);
});
