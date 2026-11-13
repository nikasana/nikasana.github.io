import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, roomSide } from '../src/config.js';
import * as Game from '../src/game.js';
import * as Act from '../src/action.js';
import * as Tide from '../src/tide.js';
import * as So from '../src/sorties.js';
import * as E from '../src/economy.js';
import { sweepRoom, spiral } from './helpers.js';

function state(f, seed = 1) {
  const s = Game.newGame(seed); s.house.maxFloor = f; s.pos = { floor: f, x: 0, z: 0, yaw: 0, pitch: 0 };
  Object.assign(s.player.upgrades, { power: f, reach: f, speed: f, shine: Math.floor(f / 2), bright: Math.floor(f / 2), wiring: 1 + Math.floor(f / 3) });
  s.player.helpers = { sweeper: 2 + 2 * f, mop: 2 + 2 * f, firefly: 2 + 2 * f };
  const rooms = spiral(80); let lit = 0;
  for (const [x, z] of rooms) { if (lit >= 10 + 3 * f) break; const r = Game.room(s, f, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = true; if (!r.lit) { r.lit = true; Game.floorState(s, f).litCount++; } lit++; }
  Game.recomputeAll(s); Game.floorState(s, f).rank = 2;
  return { s, next: rooms.slice(lit) };
}
export function activeRatio(f, seed = 1) {
  const { s, next } = state(f, seed);
  const idlePerMin = Game.incomeRate(s) * 60;
  const g0 = s.player.nightGlow; let t = 0, i = 0;
  while (t < 60) { const [x, z] = next[i++]; if (Game.info(s, f, x, z).modifier === 'sealed') continue; t += 3; t += Math.min(60 - t, sweepRoom(s, f, x, z, { limit: 60 - t })); }
  return (s.player.nightGlow - g0 + idlePerMin) / idlePerMin;
}

test('an active minute is worth 5-10 idle minutes at floors 0, 3 and 6', () => {
  for (const f of [0, 3, 6]) for (const seed of [1, 2]) {
    const r = activeRatio(f, seed);
    console.log(`floor ${f} seed ${seed}: active minute = ${r.toFixed(2)} idle minutes`);
    assert.ok(r >= 5 && r <= 10, `floor ${f}: ${r.toFixed(2)}`);
  }
});

test('abilities unlock at track level 5; cooldowns shorten with helpers', () => {
  const s = Game.newGame(1);
  assert.equal(Act.ready(s, 'dash'), false);
  s.player.upgrades.power = 2; s.player.upgrades.reach = 3;
  assert.ok(Act.ready(s, 'dash'));
  const cd0 = Act.cooldown(s, 'dash'); s.player.helpers.sweeper = 10;
  assert.ok(Act.cooldown(s, 'dash') < cd0);
  s.player.helpers.sweeper = 1000; assert.ok(Act.cooldown(s, 'dash') >= CFG.ability.dash.cd * CFG.ability.cdMin - 1e-9);
});

test('Dash ploughs a clear trench', () => {
  const s = Game.newGame(2); s.player.upgrades.power = 3; s.player.upgrades.reach = 2;
  s.pos = { floor: 0, x: 0, z: -4.5, yaw: 0, pitch: 0 };   // at the north doorway of the lift, facing the first room
  const r = Game.room(s, 0, 0, -1); const before = r.c.reduce((a, b) => a + b, 0);
  const d = Act.dash(s);
  assert.ok(d.units > 0 && d.glow > 0);
  const after = r.c.reduce((a, b) => a + b, 0);
  assert.ok(before - after > 0.15 * before, `trench cleared ${(before - after).toFixed(1)} of ${before.toFixed(1)}`);
  assert.equal(Act.dash(s), null, 'on cooldown');
});

test('Gloss: 5 s of fast polish, and the Tide slides back off it', () => {
  const { s } = state(1);
  s.player.upgrades.speed = 3; s.player.upgrades.shine = 2;
  Game.floorState(s, 1).waves = 0; Tide.startWave(s, 1);
  for (let i = 0; i < 400 && !Tide.contacts(s).length; i++) Tide.tick(s, 0.1);
  const c = Tide.contacts(s)[0]; c.lane.contactT = 3;
  const S = roomSide(1); s.pos.x = c.x * S; s.pos.z = c.z * S;
  assert.ok(Act.gloss(s).pushed >= 1); assert.equal(c.lane.contactT, 0); assert.ok(Act.glossing(s));
  Act.tick(s, 5.1); assert.equal(Act.glossing(s), false);
});

test('Flash relights fading lamps and pushes the wave back', () => {
  const { s } = state(1);
  s.player.upgrades.bright = 3; s.player.upgrades.wiring = 2;
  const r = Game.room(s, 1, 1, 0); r.lit = false; r.flags.out = 1; Game.floorState(s, 1).litCount--;
  Tide.startWave(s, 1);
  for (let i = 0; i < 400 && !Tide.contacts(s).length; i++) Tide.tick(s, 0.1);
  const c = Tide.contacts(s)[0]; const S = roomSide(1); s.pos.x = c.x * S; s.pos.z = c.z * S;
  const res = Act.flash(s);
  assert.ok(res.relit >= 1 && r.lit, 'relit'); assert.ok(res.pushed >= 1); assert.equal(c.lane.state, 'moving');
});

test('Flow fills three times faster when cycling actions; full Flow widens the aura', () => {
  const a = Game.newGame(1), b = Game.newGame(1);
  for (let t = 0; t < 5; t += 0.1) { Act.flowStep(a, 0.1, 'clear'); Act.flowStep(b, 0.1, Math.floor(t) % 2 ? 'clear' : 'polish'); }
  assert.ok(b.flow > a.flow * 2, `${a.flow.toFixed(2)} vs ${b.flow.toFixed(2)}`);
  for (let t = 0; t < 20; t += 0.1) Act.flowStep(b, 0.1, Math.floor(t) % 2 ? 'clear' : 'polish');
  assert.equal(Act.auraRadius(b), 1); assert.equal(Act.auraRadius(a), 0);
  // aura covering a neighbour room doubles helper work there
  const s = Game.newGame(3); s.player.helpers = { sweeper: 2, mop: 2, firefly: 2 }; Game.visit(s, 0, 1, 0);
  const cnt = () => Game.room(s, 0, 1, 0).c.filter((v) => v > 0).length; const c0 = cnt();
  E.tickHelpers(s, 10, 0, 0, 0, 1); const withAura = c0 - cnt();
  const s2 = Game.newGame(3); s2.player.helpers = { sweeper: 2, mop: 2, firefly: 2 }; Game.visit(s2, 0, 1, 0);
  const c1 = Game.room(s2, 0, 1, 0).c.filter((v) => v > 0).length; E.tickHelpers(s2, 10, 0, 0, 0, 0);
  assert.ok(withAura > 1.6 * (c1 - Game.room(s2, 0, 1, 0).c.filter((v) => v > 0).length));
});

test('Glow at the front: boosting a lamp during a wave', () => {
  const { s } = state(1); s.player.glow = 1e6;
  assert.equal(Act.boostLamp(s, 1, 1, 0).ok, false, 'only during a wave');
  Tide.startWave(s, 1);
  assert.ok(Act.boostLamp(s, 1, 1, 0).ok); assert.ok(s.tide.boosts['1:0'] >= 0.3 - 1e-9);
});

test('Loud mode: Quiet floors offer it for double reward, and Tides come back', () => {
  const { s } = state(1); Game.floorState(s, 1).quiet = true;
  So.start(s, { type: 'chain', action: 'light', goal: 1, reward: 1000, mutator: 'gold', floor: 1 }, 1, true);
  assert.ok(s.sortie.loud);
  assert.ok(Tide.maybeRandom(s, 1, 1e4), 'Tides return');
  Tide.clearTide(s); So.update(s, 0.1); assert.equal(So.finish(s, false).pay, 2000);
});
