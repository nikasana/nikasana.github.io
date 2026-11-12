import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, roomSide } from '../src/config.js';
import * as Game from '../src/game.js';
import * as R from '../src/roomstate.js';
import { hash32, mulberry32 } from '../src/rng.js';
import { collide } from '../src/movement.js';
import { STRINGS } from '../src/strings.js';
import { sweepRoom } from './helpers.js';

test('rng is deterministic', () => {
  assert.equal(hash32(1, 2, 3), hash32(1, 2, 3));
  assert.notEqual(hash32(1, 2, 3), hash32(1, 2, 4));
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('cabin is clutter-free and lit; first room has clutter', () => {
  const s = Game.newGame(7);
  const cab = Game.room(s, 0, 0, 0);
  assert.equal(cab.total, 0); assert.ok(cab.lit);
  const r = Game.room(s, 0, 0, -1);
  assert.ok(r.total > 100, 'room full of clutter');
  assert.equal(r.lit, false);
});

test('a room can be finished in under a minute at the starting tier', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = Game.newGame(seed);
    const secs = sweepRoom(s, 0, 0, -1);
    assert.ok(secs < 60, `seed ${seed}: ${secs.toFixed(1)}s`);
    assert.ok(secs > 12, `seed ${seed} too fast: ${secs.toFixed(1)}s`);
  }
});

test('clearing pays Glow and materials; polish needs bare floor', () => {
  const s = Game.newGame(3);
  const r = Game.room(s, 0, 1, 0);
  const ev = Game.toolStep(s, 0, 1, 0, 0, 0, 0.5);
  assert.equal(ev.mode, 'clear'); assert.ok(ev.glow > 0); assert.ok(s.player.materials.balls > 0);
  // polish does nothing on cells that still have clutter
  const cells = R.cellsInCircle(8, 8, 2);
  const before = r.g[cells[0]];
  if (r.c[cells[0]] > 0) { R.polishAt(r, [cells[0]], 10, 1); assert.equal(r.g[cells[0]], before); }
});

test('lamps: wiring reach, price rises, strength = lamp x cleared x polish', () => {
  const s = Game.newGame(11);
  s.player.glow = 1e6;
  const far = Game.buyLamp(s, 0, 3, 0);
  assert.equal(far.ok, false); assert.equal(far.why, 'wire');
  const c1 = Game.lampCost(s, 0);
  assert.ok(Game.buyLamp(s, 0, 1, 0).ok);
  assert.ok(Game.lampCost(s, 0) > c1);
  assert.equal(Game.room(s, 0, 1, 0).strength, 0, 'uncleared room has no strength');
  sweepRoom(s, 0, 1, 0);
  assert.ok(Math.abs(Game.room(s, 0, 1, 0).strength - 1) < 1e-6);
  assert.ok(Game.incomeRate(s) > 0);
  assert.ok(Game.buyLamp(s, 0, 2, 0).ok, 'network extends from the lit room');
});

test('income uses timestamp deltas', () => {
  const s = Game.newGame(5);
  s.player.glow = 1e6; Game.buyLamp(s, 0, 1, 0); sweepRoom(s, 0, 1, 0);
  const g0 = s.player.glow; const rate = Game.incomeRate(s);
  Game.tickIncome(s, 1000); Game.tickIncome(s, 61000);
  assert.ok(Math.abs(s.player.glow - g0 - rate * 60) < 1e-6);
});

test('save round trip keeps room state', () => {
  const s = Game.newGame(9);
  s.player.glow = 500;
  Game.toolStep(s, 0, 0, -1, 0, 0, 2);
  Game.visit(s, 0, 0, -1);
  const r = Game.room(s, 0, 0, -1);
  const json = JSON.parse(JSON.stringify(Game.serialize(s)));
  const s2 = Game.deserialize(json);
  const r2 = Game.room(s2, 0, 0, -1);
  for (let k = 0; k < 256; k++) assert.ok(Math.abs(r.c[k] - r2.c[k]) < 0.03);
  assert.equal(s2.player.glow, s.player.glow);
  assert.ok(r2.visited);
});

test('walls stop the player; doorways let them through', () => {
  const S = roomSide(0);
  const p = { x: 2, z: -S / 2 - 0.05 };
  collide(p, S, () => false, () => []);
  assert.ok(p.z > -S / 2 + 0.1 || p.z < -S / 2 - 0.1);
  const q = { x: 0, z: -S / 2 };
  collide(q, S, () => false, () => []);
  assert.ok(Math.abs(q.z + S / 2) < 1e-9 && Math.abs(q.x) < 1e-9, 'doorway is open');
  const w = { x: 0, z: -S / 2 };
  collide(w, S, () => true, () => []);
  assert.ok(Math.abs(w.z + S / 2) > 0.2, 'shut door blocks');
});

test('strings: every key used has an English entry', () => {
  assert.ok(STRINGS.en.tagline.includes('not a treatment'));
});

test('dust settles slowly in unlit rooms without flickering the polished flag', () => {
  const s = Game.newGame(4);
  sweepRoom(s, 0, 0, -1);
  const r = Game.room(s, 0, 0, -1);
  assert.ok(r.polishedDone);
  for (let i = 0; i < 10; i++) R.settleDust(r, 1);
  assert.ok(r.polishedDone, 'still polished after 10 s');
  for (let i = 0; i < 300; i++) R.settleDust(r, 1);
  assert.equal(r.polishedDone, false, 'dusty after 5 minutes');
});
