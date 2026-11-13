import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, roomSide } from '../src/config.js';
import * as Game from '../src/game.js';
import { roomInfo, initialClutter, BIOMES, floorBiomes } from '../src/world.js';

test('rooms are a pure function of seed, floor, x, z', () => {
  const a = roomInfo(123, 2, 17, -40), b = roomInfo(123, 2, 17, -40);
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual([...initialClutter(a)], [...initialClutter(b)]);
  assert.notEqual(JSON.stringify(roomInfo(124, 2, 17, -40)), JSON.stringify(a));
});

test('room size grows 8 + 2 x floor up to 30', () => {
  assert.equal(roomSide(0), 8); assert.equal(roomSide(3), 14); assert.equal(roomSide(11), 30); assert.equal(roomSide(40), 30);
});

test('modifier and set-piece frequencies match the spec', () => {
  const n = 40000, count = { normal: 0, deep: 0, warm: 0, sealed: 0 }; let sets = 0;
  for (let i = 0; i < n; i++) {
    const x = (i % 200) - 100, z = Math.floor(i / 200) - 100;
    if (Math.abs(x) + Math.abs(z) <= 1) continue;
    const inf = roomInfo(9, 1, x, z);
    if (inf.setPiece) sets++; else count[inf.modifier]++;
  }
  const tot = count.normal + count.deep + count.warm + count.sealed;
  assert.ok(Math.abs(count.normal / tot - 0.8) < 0.02, JSON.stringify(count));
  assert.ok(Math.abs(count.deep / tot - 0.1) < 0.01);
  assert.ok(Math.abs(count.warm / tot - 0.05) < 0.01);
  assert.ok(Math.abs(count.sealed / tot - 0.05) < 0.01);
  assert.ok(Math.abs(sets / n - 1 / 40) < 0.005, String(sets / n));
});

test('each floor mixes two biomes about 70/30 in 8x8 patches', () => {
  const [a, b] = floorBiomes(5, 3);
  assert.notEqual(a, b);
  let na = 0, nb = 0;
  for (let px = -20; px < 20; px++) for (let pz = -20; pz < 20; pz++) {
    const inf = roomInfo(5, 3, px * 8 + 4, pz * 8 + 4);
    if (inf.biome === BIOMES[a]) na++; else if (inf.biome === BIOMES[b]) nb++; else assert.fail('third biome');
    // whole patch shares a biome (except the lift's own neighbourhood, which is always the main biome)
    if (px >= -1 && px <= 0 && pz >= -1 && pz <= 0) continue;
    assert.equal(roomInfo(5, 3, px * 8, pz * 8).biome.id, roomInfo(5, 3, px * 8 + 7, pz * 8 + 7).biome.id);
  }
  assert.ok(Math.abs(na / (na + nb) - 0.7) < 0.08, String(na / (na + nb)));
  const seen = new Set(); for (let f = 0; f < 30; f++) for (const i of floorBiomes(77, f)) seen.add(i);
  assert.equal(seen.size, BIOMES.length, 'every biome appears across floors');
});

test('deep rooms hold 3x clutter, warm rooms come finished and lit', () => {
  const s = Game.newGame(31);
  let deep = null, warm = null;
  for (let x = 2; x < 300 && (!deep || !warm); x++) {
    const inf = Game.info(s, 0, x, 3);
    if (!deep && inf.modifier === 'deep') deep = [x, 3];
    if (!warm && inf.modifier === 'warm') warm = [x, 3];
  }
  const rd = Game.room(s, 0, ...deep);
  assert.ok(rd.total > 2.2 * Game.room(s, 0, 1, 0).total);
  const rw = Game.room(s, 0, ...warm);
  assert.ok(rw.lit && rw.clearedDone && rw.polishedDone);
  assert.equal(Game.floorState(s, 0).lamps, 0, 'warm lamps are free');
});

test('sealed rooms block their doorways until opened with Glow', () => {
  const s = Game.newGame(8);
  let sealed = null;
  for (let x = 2; x < 400 && !sealed; x++) if (Game.info(s, 0, x, 0).modifier === 'sealed') sealed = x;
  assert.ok(Game.edgeBlocked(s, 0, sealed - 1, 0, 1), 'east doorway into it is shut');
  assert.equal(Game.openSealed(s, 0, sealed, 0).ok, false);
  s.player.glow = Game.sealCost(0);
  assert.ok(Game.openSealed(s, 0, sealed, 0).ok);
  assert.equal(Game.edgeBlocked(s, 0, sealed - 1, 0, 1), false);
  assert.equal(s.player.glow, 0);
});

test('shut doors hold for their time, then open', () => {
  const s = Game.newGame(1);
  Game.shutDoor(s, 0, 0, -1, 2, 20);
  assert.ok(Game.edgeBlocked(s, 0, 0, 0, 0), 'same doorway seen from the other room');
  Game.tickDoors(s, 19.5); assert.ok(Game.doorShut(s, 0, 0, -1, 2));
  Game.tickDoors(s, 1); assert.equal(Game.doorShut(s, 0, 0, -1, 2), false);
});

test('set pieces enter the catalog once and raise Glow by 1% each', () => {
  const s = Game.newGame(3);
  let sp = null;
  for (let x = 2; x < 2000 && !sp; x++) if (Game.info(s, 0, x, 5).setPiece) sp = x;
  const m0 = Game.glowMult(s, 0);
  const ev = Game.visit(s, 0, sp, 5);
  assert.ok(ev.catalog.startsWith('set:'));
  assert.equal(Game.visit(s, 0, sp, 5), null);
  assert.ok(Math.abs(Game.glowMult(s, 0) / m0 - 1.01) < 1e-9);
});

test('the lift rides only to open floors', () => {
  const s = Game.newGame(2);
  assert.equal(Game.travel(s, 1), false);
  s.house.maxFloor = 1;
  assert.ok(Game.travel(s, 1));
  assert.equal(s.pos.floor, 1); assert.equal(s.pos.x, 0);
});

test('save keeps sealed-open flags and the floor reached', () => {
  const s = Game.newGame(8);
  let sealed = null;
  for (let x = 2; x < 400 && !sealed; x++) if (Game.info(s, 0, x, 0).modifier === 'sealed') sealed = x;
  s.player.glow = 1e6; Game.openSealed(s, 0, sealed, 0); s.house.maxFloor = 2;
  const s2 = Game.deserialize(JSON.parse(JSON.stringify(Game.serialize(s))));
  assert.equal(Game.isSealed(s2, 0, sealed, 0), false);
  assert.equal(s2.house.maxFloor, 2);
});
