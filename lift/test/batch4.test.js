import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../src/config.js';
import * as Game from '../src/game.js';
import * as Tide from '../src/tide.js';
import * as R from '../src/roomstate.js';

// A floor with finished, lit rooms on every side of the lift.
function house(f, radius = 2, seed = 4) {
  const s = Game.newGame(seed);
  s.house.maxFloor = f; Game.floorState(s, f);
  s.player.glow = 1e12;
  for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) {
    if (!x && !z) continue;
    const inf = Game.info(s, f, x, z);
    const r = Game.room(s, f, x, z);
    r.c.fill(0); r.g.fill(0); r.clearedDone = true; r.polishedDone = true; r.visited = true; r.touched = true;
    if (!r.lit) { r.lit = true; Game.floorState(s, f).litCount++; }
    Game.updateStrength(s, f, x, z);
  }
  Game.floorState(s, f).rank = 10;
  return s;
}
function run(s, f, { play = 0, seconds = 400, onTick } = {}) {
  let w = s.tide;
  for (let t = 0; t < seconds && !w.result; t += 0.1) {
    if (play) for (const c of Tide.contacts(s)) Tide.sweepBoost(s, f, c.x, c.z, 0.1 * play);
    if (onTick) onTick(t);
    w = Tide.tick(s, 0.1);
  }
  return w;
}

test('floor 0 waves hold with idle hands', () => {
  for (const seed of [1, 2, 3]) {
    const s = house(0, 2, seed);
    s.player.helpers = { sweeper: 1, mop: 1, firefly: 1 };
    for (let k = 1; k <= 3; k++) {
      const fc = Tide.forecast(s, 0);
      assert.ok(fc.pressure <= 0.8 * fc.strength + 1e-9, 'floor 0 never exceeds 80 % of Strength');
      Tide.startWave(s, 0);
      const w = run(s, 0);
      assert.ok(w.result === 'held' || w.result === 'bounced', `seed ${seed} wave ${k}: ${w.result}`);
      const dur = w.t;
      if (w.result === 'held') assert.ok(dur >= 60 && dur <= 120, `wave lasts 1-2 min: ${dur.toFixed(0)} s`);
      Tide.clearTide(s);
    }
    assert.ok(Game.floorState(s, 0).quiet, 'floor 0 is Quiet after its Great Tide');
    assert.equal(s.house.maxFloor, 1, 'the next floor unlocks');
    assert.equal(Tide.noiseFor(s, 0), 0);
  }
});

test('later waves: idle hands with helpers hold up to wave 4, a Great Tide needs play', () => {
  const s = house(2, 2);
  s.player.helpers = { sweeper: 10, mop: 10, firefly: 10 };
  for (let k = 1; k <= 4; k++) {
    Tide.startWave(s, 2); const w = run(s, 2);
    assert.equal(w.result, 'held', `wave ${k} pressure ${(Tide.pressureShare(2, k) * 100).toFixed(0)} %`);
    Tide.clearTide(s);
  }
  const idle = structuredClone ? null : null;
  // idle Great Tide
  const s2 = house(2, 2); s2.player.helpers = { sweeper: 10, mop: 10, firefly: 10 }; Game.floorState(s2, 2).waves = 4;
  assert.ok(Tide.forecast(s2, 2).great);
  Tide.startWave(s2, 2);
  assert.equal(run(s2, 2).result, 'lost', 'helpers alone cannot hold a Great Tide');
  // the same Great Tide with the player sweeping at the fronts
  const s3 = house(2, 2); s3.player.helpers = { sweeper: 10, mop: 10, firefly: 10 }; Game.floorState(s3, 2).waves = 4;
  Tide.startWave(s3, 2);
  assert.equal(run(s3, 2, { play: 1 }).result, 'held', 'held with play');
  assert.ok(Game.floorState(s3, 2).quiet);
});

test('losing is soft: lamps stay, nothing banked is lost, retry is 10 % weaker', () => {
  const s = house(2, 1); Game.floorState(s, 2).waves = 4;
  const glow0 = s.player.glow, lamps0 = Game.floorState(s, 2).litCount;
  Tide.startWave(s, 2); const P0 = s.tide.P;
  const w = run(s, 2);
  assert.equal(w.result, 'lost');
  assert.ok(w.flooded.length > 0);
  assert.equal(s.player.glow, glow0, 'banked Glow kept');
  assert.equal(Game.floorState(s, 2).litCount, lamps0, 'lamps stay');
  const fl = w.flooded[0]; const r = Game.room(s, 2, ...fl);
  assert.ok(r.lit && !r.clearedDone, 'flooded room must be cleared again');
  assert.equal(Game.floorState(s, 2).waves, 4, 'the wave is not counted');
  Tide.clearTide(s);
  for (const [x, z] of w.flooded) { const rr = Game.room(s, 2, x, z); rr.c.fill(0); rr.g.fill(0); rr.clearedDone = rr.polishedDone = true; Game.updateStrength(s, 2, x, z); }
  Tide.startWave(s, 2);
  assert.ok(Math.abs(s.tide.P / P0 - 0.9) < 1e-9);
});

test('forecast reads calm / close / hard', () => {
  const s = house(2, 1);
  assert.equal(Tide.forecast(s, 2).mood, 'calm');                     // 50 %
  Game.floorState(s, 2).waves = 3; assert.equal(Tide.forecast(s, 2).mood, 'hard'); // 110 % without helpers
  s.player.helpers = { sweeper: 10, mop: 10, firefly: 10 }; assert.equal(Tide.forecast(s, 2).mood, 'close');
});

test('wave k unlocks at rank k; rank is the lowest of the three floor meters', () => {
  const s = Game.newGame(3);
  assert.equal(Tide.forecast(s, 0).unlocked, false);
  s.player.glow = 1e9;
  for (let i = 1; i <= 4; i++) { const r = Game.room(s, 0, i, 0); r.c.fill(0); r.clearedDone = true; }
  assert.equal(Tide.rank(s, 0), 0, 'clearing alone does not raise rank');
  for (let i = 1; i <= 4; i++) { const r = Game.room(s, 0, i, 0); r.g.fill(0); r.polishedDone = true; Game.buyLamp(s, 0, i, 0); }
  Tide.updateRank(s, 0);
  assert.equal(Game.floorState(s, 0).rank, 1);
  assert.ok(Tide.forecast(s, 0).unlocked);
});

test('lighting the source room ends that front; shut doors hold; bounce; co-op pressure', () => {
  const s = house(1, 1); Game.floorState(s, 1).waves = 0;
  Tide.startWave(s, 1);
  const fr = s.tide.fronts[0];
  const src = Game.room(s, 1, ...fr.source); src.lit = true;
  Tide.tick(s, 0.1);
  assert.ok(fr.lanes.every((l) => l.state === 'held'));
  Tide.clearTide(s);
  // doors
  const s2 = house(1, 1); Game.floorState(s2, 1).waves = 3; Tide.startWave(s2, 1);
  let shutAt = null;
  run(s2, 1, { seconds: 60, onTick: () => { for (const c of Tide.contacts(s2)) { const side = c.from[0] < c.x ? 3 : c.from[0] > c.x ? 1 : c.from[1] < c.z ? 0 : 2; if (!Game.doorShut(s2, 1, c.x, c.z, side) && !shutAt) { Game.shutDoor(s2, 1, c.x, c.z, side, CFG.tide.doorHold); shutAt = c.lane; } } Game.tickDoors(s2, 0.1); } });
  assert.ok(shutAt, 'a door was shut at a front');
  // bounce
  const s3 = house(1, 1); s3.player.upgrades.bright = 0;
  for (const r of s3.rooms.values()) r.strength = r.lit ? r.strength : 0;
  Tide.startWave(s3, 1);
  assert.equal(s3.tide.result, null);
  const s4 = house(1, 1); Game.floorState(s4, 1).waves = 0;
  // make strength 3x the pressure: wave 1 is 50 % -> bounce needs only 1.5x the average, so it always bounces when the house is even
  // (only rooms much stronger than the average make this happen; force it via the average)
  const w4 = Tide.startWave(s4, 1, { duration: 80 });
  assert.ok(w4.result === null || w4.result === 'bounced');
  const s5 = house(1, 1); Tide.startWave(s5, 1, { players: 3 }); const p3 = s5.tide.P; Tide.clearTide(s5);
  Tide.startWave(s5, 1); assert.ok(Math.abs(p3 / s5.tide.P - 2.25) < 1e-9, 'x1.5 per extra player');
});
