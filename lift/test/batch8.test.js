import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/game.js';
import * as Tide from '../src/tide.js';
import { Net, applyRoom, sharedSave } from '../src/net.js';
import * as R from '../src/roomstate.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function finish(s, f, x, z) { const r = Game.room(s, f, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = r.touched = true; if (!r.lit) { r.lit = true; Game.floorState(s, f).litCount++; } Game.updateStrength(s, f, x, z); }
function pair() {
  const host = Game.newGame(11), guest = Game.newGame(22);
  host.player.glow = 5; guest.player.glow = 777;
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) finish(host, 0, x, z);
  const ev = { anchors: [] };
  const hn = new Net({ getGame: () => host, setHouse() {}, onAnchor: (k) => ev.anchors.push('host:' + k) });
  const gn = new Net({ getGame: () => guest, setHouse: (house, rooms) => { ev.own = { house: guest.house, rooms: guest.rooms }; guest.house = { ...house }; guest.rooms = new Map(); guest.infos = new Map(); for (const [k, p] of Object.entries(rooms)) applyRoom(guest, k, p, 'set'); Game.recomputeAll(guest); ev.joined = true; }, onAnchor: (k) => ev.anchors.push('guest:' + k), onPing: () => { ev.ping = true; } });
  return { host, guest, hn, gn, ev };
}

test('two players join by code and share one house; each keeps their own Glow', async () => {
  const { host, guest, hn, gn, ev } = pair();
  const code = 'T' + Math.floor(Math.random() * 1e5);
  await hn.hostRoom(code, true); await gn.join(code, true);
  for (let i = 0; i < 20 && !ev.joined; i++) await wait(20);
  assert.ok(ev.joined); assert.equal(guest.house.seed, host.house.seed);
  assert.ok(Game.room(guest, 0, 1, 0).lit, 'the host’s lit rooms arrive');
  assert.equal(guest.player.glow, 777, 'own Glow kept'); assert.equal(hn.players(), 2);
  // pressure x1.5 per extra player
  assert.ok(Math.abs(Tide.forecast(host, 0, 2).pressure / Tide.forecast(host, 0, 1).pressure - 1.5) < 1e-9);
  // the guest clears cells; the host merges them (minimum wins)
  const before = Game.room(host, 0, 2, 0).c.reduce((a, b) => a + b, 0);
  Game.toolStep(guest, 0, 2, 0, 0, 0, 2); gn.markRoom('0:2:0'); gn.tick(0.3);
  await wait(50);
  assert.ok(Game.room(host, 0, 2, 0).c.reduce((a, b) => a + b, 0) < before - 1);
  // a flood from the host is authoritative
  const r = Game.room(host, 0, 1, 0); R.flood(r, Game.info(host, 0, 1, 0)); r.lit = false; Game.floorState(host, 0).litCount--;
  hn.send({ t: 'room', key: '0:1:0', mode: 'set', r: { c: Array.from(r.c, (v) => Math.round(v * 40)), g: Array.from(r.g, (v) => Math.round(v * 255)), l: 0, f: {}, cd: 0, pd: 0, t: r.total, v: 1 } });
  await wait(50);
  assert.equal(Game.room(guest, 0, 1, 0).lit, false); assert.equal(Game.room(guest, 0, 1, 0).clearedDone, false);
  // Anchors found go to everyone
  gn.anchor(0, 7, 7, 'clock'); await wait(50);
  assert.equal(host.player.anchors.clock, 1); assert.ok(host.house.anchorsFound['0:7:7']);
  // ping
  hn.ping(1, 2); await wait(50); assert.ok(ev.ping);
  hn.close(); gn.close();
});

test('every browser keeps a copy of the shared house, so a guest can host it later', async () => {
  const { host, guest, hn, gn, ev } = pair();
  const code = 'U' + Math.floor(Math.random() * 1e5);
  await hn.hostRoom(code, true); await gn.join(code, true);
  for (let i = 0; i < 20 && !ev.joined; i++) await wait(20);
  const blob = JSON.parse(JSON.stringify(sharedSave(guest)));
  hn.close(); gn.close();
  // the guest hosts the saved house for a third player
  const g2 = Game.newGame(33); g2.house = { ...blob.house }; g2.rooms = new Map();
  for (const [k, ro] of Object.entries(blob.rooms)) g2.rooms.set(k, R.deserializeRoom(ro));
  Game.recomputeAll(g2);
  const third = Game.newGame(44); let joined = false;
  const n2 = new Net({ getGame: () => g2, setHouse() {} });
  const n3 = new Net({ getGame: () => third, setHouse: (house, rooms) => { third.house = { ...house }; third.rooms = new Map(); third.infos = new Map(); for (const [k, p] of Object.entries(rooms)) applyRoom(third, k, p, 'set'); Game.recomputeAll(third); joined = true; } });
  await n2.hostRoom(code, true); await n3.join(code, true);
  for (let i = 0; i < 20 && !joined; i++) await wait(20);
  assert.ok(joined); assert.equal(third.house.seed, host.house.seed); assert.ok(Game.room(third, 0, -1, 0).lit);
  n2.close(); n3.close();
});

test('a full house turns a fifth player away', async () => {
  const code = 'V' + Math.floor(Math.random() * 1e5);
  const host = Game.newGame(1); const hn = new Net({ getGame: () => host, setHouse() {} }); await hn.hostRoom(code, true);
  const fails = []; const nets = [];
  for (let i = 0; i < 4; i++) { const g = Game.newGame(100 + i); const n = new Net({ getGame: () => g, setHouse() {}, onFail: () => fails.push(i) }); await n.join(code, true); nets.push(n); await wait(30); }
  await wait(80);
  assert.equal(hn.players(), 4); assert.deepEqual(fails, [3]);
  hn.close(); nets.forEach((n) => n.alive && n.close());
});
