import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../src/config.js';
import * as Game from '../src/game.js';
import * as Long from '../src/longgame.js';
import * as Signs from '../src/signs.js';
import * as E from '../src/economy.js';
import { BIOMES } from '../src/world.js';
import { STRINGS } from '../src/strings.js';

test('two true rays meet on the Anchor, and the Anchor can be taken', () => {
  for (const seed of [3, 4, 5]) {
    const s = Game.newGame(seed);
    const a = Signs.anchorFor(s, 0, 15, 15); const [rx, rz] = Signs.regionOf(15, 15);
    const rays = [];
    for (let x = rx * 10; x < rx * 10 + 10 && rays.length < 2; x++) for (let z = rz * 10; z < rz * 10 + 10 && rays.length < 2; z++) {
      const r = Game.room(s, 0, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true;
      const sg = Signs.visibleSign(s, 0, x, z);
      if (sg && sg.true && (!rays.length || Math.abs(Math.sin(sg.angle - rays[0].angle)) > 0.2)) { assert.ok(Signs.testStep(s, sg, 2).true); rays.push(s.player.rays.at(-1)); }
    }
    const [p, q] = rays;
    const d1 = [Math.cos(p.angle), Math.sin(p.angle)], d2 = [Math.cos(q.angle), Math.sin(q.angle)];
    const t1 = ((q.x - p.x) * d2[1] - (q.z - p.z) * d2[0]) / (d1[0] * d2[1] - d1[1] * d2[0]);
    assert.ok(Math.hypot(p.x + d1[0] * t1 - a.x, p.z + d1[1] * t1 - a.z) < 1e-6, `seed ${seed}`);
    assert.equal(Signs.takeAnchor(s, 0, a.x, a.z), null, 'buried under clutter until cleared');
    Game.room(s, 0, a.x, a.z).c.fill(0);
    const got = Signs.takeAnchor(s, 0, a.x, a.z);
    assert.equal(got.kind, a.kind); assert.equal(s.player.anchors[a.kind], 1);
    assert.equal(Signs.takeAnchor(s, 0, a.x, a.z), null, 'only once');
  }
});

test('Anchor habits: Notebook tests faster, Coin fewer false signs, duplicates +10 % Glow', () => {
  const s = Game.newGame(1);
  const t0 = Signs.testTime(s); s.player.anchors.notebook = 1; assert.ok(Signs.testTime(s) < t0);
  let f0 = 0, f1 = 0;
  for (let x = 2; x < 80; x++) for (let z = 2; z < 20; z++) { const sg = Signs.signAt(s, 0, x, z); if (sg && !sg.true) f0++; }
  s.player.anchors.coin = 1;
  for (let x = 2; x < 80; x++) for (let z = 2; z < 20; z++) { const sg = Signs.signAt(s, 0, x, z); if (sg && !sg.true) f1++; }
  assert.ok(f1 < f0 * 0.75, `${f0} -> ${f1}`);
  const m = Game.glowMult(s, 0); s.player.anchors.coin = 3; assert.ok(Math.abs(Game.glowMult(s, 0) / m - 1.2) < 1e-9);
  // Phone: a true ray toward the nearest unfound Anchor
  const ray = Signs.phoneRay(s, 0, 4, 4); const a = Signs.anchorFor(s, 0, 4, 4);
  assert.ok(Math.abs(ray.angle - Math.atan2(a.z - 4, a.x - 4)) < 1e-9);
});

test('Dawn keeps what it should and resets the rest', () => {
  const s = Game.newGame(7);
  s.house.maxFloor = 2; assert.equal(Long.dawnAvailable(s), false);
  s.house.maxFloor = 3;
  s.player.nightGlow = 50000 * 16 + 5; s.player.glow = 123456; s.player.clarity = 1;
  s.player.upgrades.power = 4; s.player.helpers.sweeper = 9; s.player.anchors.clock = 2; s.player.catalog = ['set:tree']; s.player.notes = [0, 5];
  s.player.achievements = ['leftRoom']; s.settings = { fov: 90 }; Game.room(s, 0, 1, 0).lit = true;
  assert.equal(Long.clarityGain(s), 4);
  const { game: n, gain } = Long.dawn(s, 'Slept with the window open.', 99);
  assert.equal(gain, 4); assert.equal(n.player.clarity, 5);
  assert.deepEqual(n.player.anchors, { clock: 2 }); assert.deepEqual(n.player.catalog, ['set:tree']); assert.deepEqual(n.player.notes, [0, 5]);
  assert.deepEqual(n.player.achievements, ['leftRoom']); assert.equal(n.settings.fov, 90);
  assert.equal(n.player.diary.at(-1).line, 'Slept with the window open.');
  assert.equal(n.player.glow, 0); assert.equal(n.player.upgrades.power, 0); assert.equal(n.player.helpers.sweeper, 0);
  assert.equal(n.house.maxFloor, 0); assert.equal(n.rooms.size, 0); assert.notEqual(n.seed, s.seed);
  assert.ok(Math.abs(Game.glowMult(n, 0) - (1 + 0.1 * 5) * (1 + 0.01) * 1.1) < 1e-9, 'Clarity +10 % each, catalog and Anchors kept');
  // round trip through the save keeps it all
  const back = Game.deserialize(JSON.parse(JSON.stringify(Game.serialize(n))));
  assert.equal(back.player.clarity, 5); assert.equal(back.player.diary.length, 1);
});

test('notes: calmer with depth, always in sealed rooms', () => {
  const s = Game.newGame(2);
  let found = [];
  for (let x = 2; x < 400 && found.length < 8; x++) { const r = Game.room(s, 0, x, 1); r.clearedDone = true; const n = Long.findNote(s, 0, x, 1); if (n !== null) found.push(n); }
  assert.ok(found.length >= 5); assert.ok(found.every((i) => Long.noteTier(i) === 0), 'floor 0 only finds the first notes');
  s.house.maxFloor = 6; const deep = [];
  for (let x = 2; x < 600 && deep.length < 20; x++) { const r = Game.room(s, 6, x, 1); r.clearedDone = true; const n = Long.findNote(s, 6, x, 1); if (n !== null) deep.push(n); }
  assert.equal(s.player.notes.length, 20, 'all 20 notes can be found deep down');
  for (let i = 0; i < 20; i++) assert.ok(STRINGS.en['note_' + i]);
  let sealed = null; for (let x = 2; x < 600 && !sealed; x++) if (Game.info(s, 0, x, 2).modifier === 'sealed') sealed = x;
  assert.ok(Long.roomHasNote(s, 0, sealed, 2));
});

test('achievements and cosmetics follow small real wins', () => {
  const s = Game.newGame(3);
  assert.deepEqual(Long.checkAchievements(s), []);
  Game.visit(s, 0, 0, -1); s.player.stats.signs = 1;
  const got = Long.checkAchievements(s);
  assert.ok(got.includes('leftRoom') && got.includes('asked'));
  assert.equal(Long.ACHIEVEMENTS.length, 10);
  for (const a of Long.ACHIEVEMENTS) assert.ok(STRINGS.en['ach_' + a] && STRINGS.en['achd_' + a]);
  assert.deepEqual(Long.cabinItems(s), { mug: false, plant: false, blanket: false, drawing: false });
  s.player.stats.lamps = 1; s.player.stats.wavesHeld = 1; assert.ok(Long.cabinItems(s).mug && Long.cabinItems(s).plant);
  assert.equal(Long.floorWarmth(s, 0), 0); Game.floorState(s, 0).litCount = 15; assert.equal(Long.floorWarmth(s, 0), 0.5);
  Game.floorState(s, 0).quiet = true; assert.equal(Long.floorWarmth(s, 0), 1);
  for (const b of BIOMES) assert.ok(Long.AUTHOR_NOTES.en[b.id], b.id);
});
