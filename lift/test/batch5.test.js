import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, roomSide } from '../src/config.js';
import * as Game from '../src/game.js';
import * as So from '../src/sorties.js';
import * as Signs from '../src/signs.js';
import * as Gad from '../src/gadgets.js';
import * as Tide from '../src/tide.js';
import { sweepRoom, spiral } from './helpers.js';

function fresh(seed = 6) { const s = Game.newGame(seed); s.player.glow = 1e9; return s; }
function finishRoom(s, f, x, z, light = true) {
  const r = Game.room(s, f, x, z); r.c.fill(0); r.g.fill(0); r.clearedDone = r.polishedDone = true; r.visited = r.touched = true;
  if (light && !r.lit) { r.lit = true; Game.floorState(s, f).litCount++; }
  Game.updateStrength(s, f, x, z);
}
function run(s, secs = 2) { let ev = null; for (let t = 0; t < secs; t += 0.1) { const e = So.update(s, 0.1); if (e) ev = e; } return ev; }

test('the board offers one sortie per action, a Great hall every third rank, a Deep run at rank 10', () => {
  const s = fresh();
  const b = So.board(s, 0);
  assert.deepEqual(b.map((o) => o.action).sort(), ['clear', 'light', 'polish']);
  Game.floorState(s, 0).rank = 3; Game.floorState(s, 0).sortieN = 1;
  assert.ok(So.board(s, 0).some((o) => o.type === 'hall'));
  Game.floorState(s, 0).rank = 10; Game.floorState(s, 0).sortieN = 2;
  assert.ok(So.board(s, 0).some((o) => o.type === 'deep'));
});

test('every sortie type completes', () => {
  // haul
  let s = fresh(); So.start(s, { type: 'haul', action: 'clear', mat: 'balls', goal: 50, reward: 100, mutator: 'gold', floor: 0 });
  sweepRoom(s, 0, 0, -1, { phase: 'clear' }); assert.equal(run(s).event, 'extract', 'haul');
  // check: test two signs
  s = fresh(11); So.start(s, { type: 'check', action: 'polish', goal: 2, reward: 100, mutator: 'echo', floor: 0 });
  let tested = 0;
  for (const [x, z] of spiral(200)) { if (tested >= 2) break; finishRoom(s, 0, x, z, false); const sg = Signs.visibleSign(s, 0, x, z); if (sg) { Signs.testStep(s, sg, 2); tested++; } }
  assert.equal(run(s).event, 'extract', 'check');
  // search: find the region's Anchor
  s = fresh(12); const a = Signs.anchorFor(s, 0, 0, 0);
  So.start(s, { type: 'search', action: 'polish', anchor: [a.x, a.z], goal: 1, reward: 100, mutator: 'dim', floor: 0 });
  assert.equal(Signs.takeAnchor(s, 0, a.x, a.z), null, 'buried under clutter');
  finishRoom(s, 0, a.x, a.z, false);
  assert.ok(Signs.takeAnchor(s, 0, a.x, a.z)); assert.equal(run(s).event, 'extract', 'search');
  // chain
  s = fresh(); So.start(s, { type: 'chain', action: 'light', goal: 3, reward: 100, mutator: 'slick', floor: 0 });
  for (let i = 1; i <= 3; i++) finishRoom(s, 0, i, 0); assert.equal(run(s).event, 'extract', 'chain');
  // line
  s = fresh(); So.start(s, { type: 'line', action: 'light', target: [2, 2], goal: 1, reward: 100, mutator: 'fog', floor: 0 });
  for (const [x, z] of [[1, 0], [1, 1], [2, 1]]) finishRoom(s, 0, x, z); assert.equal(run(s), null, 'not reached yet');
  finishRoom(s, 0, 2, 2); assert.equal(run(s).event, 'extract', 'line');
  // great hall
  s = fresh(); So.start(s, { type: 'hall', action: 'all', target: [3, 0], goal: 1, reward: 100, mutator: 'double', floor: 0 });
  assert.ok(Game.info(s, 0, 3, 0).hall); assert.ok(Game.room(s, 0, 3, 0).total > 3.5 * Game.room(s, 0, 1, 0).total, 'an enormous hall');
  finishRoom(s, 0, 3, 0); assert.equal(run(s).event, 'extract', 'hall');
  // deep run: three floors in a row
  s = fresh(); s.house.maxFloor = 2;
  So.start(s, { type: 'deep', action: 'clear', floors: [0, 1, 2], stage: 0, goal: 3, reward: 100, mutator: 'quiet', floor: 0 });
  for (const f of [0, 1, 2]) { Game.travel(s, f); for (const [x, z] of spiral(3)) sweepRoom(s, f, x, z, { phase: 'clear' }); run(s, 0.2); }
  assert.equal(s.sortie.state, 'extract', 'deep run');
});

test('extraction: a clean exit pays +50 %, H still returns but without the bonus', () => {
  const base = (risk, clean, mut = 'gold') => { const s = fresh(); s.pos = { floor: 0, x: 0, z: 0, yaw: 0, pitch: 0 }; So.start(s, { type: 'chain', action: 'light', goal: 1, reward: 1000, mutator: mut, floor: 0 }, risk); finishRoom(s, 0, 1, 0); run(s, 0.2); const g0 = s.player.glow; const r = So.finish(s, clean); return { pay: r.pay, got: s.player.glow - g0, s }; };
  const clean = base(1, true), plain = base(1, false);
  assert.equal(clean.pay, 1500); assert.equal(plain.pay, 1000); assert.equal(clean.got, 1500);
  assert.equal(base(5, false).pay, 2000, 'risk 5 doubles');
  assert.equal(base(1, false, 'quiet').pay, 700, 'Quiet hour pays less');
  // the timer running out costs only the bonus
  const s = fresh(); So.start(s, { type: 'chain', action: 'light', goal: 1, reward: 1000, mutator: 'gold', floor: 0 }); finishRoom(s, 0, 1, 0); run(s, 0.2);
  assert.equal(s.sortie.state, 'extract');
  const ev = run(s, CFG.sortie.extractTime + 1); assert.equal(ev.event, 'done'); assert.equal(ev.pay, 1000);
});

test('each completed sortie adds to its floor meter; rank rises; +5 % income per rank', () => {
  const s = fresh();
  for (let i = 1; i <= 4; i++) finishRoom(s, 0, i, 0);
  Tide.updateRank(s, 0); const r0 = Game.floorState(s, 0).rank; const m0 = Game.glowMult(s, 0);
  for (const action of ['clear', 'polish', 'light']) { So.start(s, { type: 'chain', action, goal: 1, reward: 10, mutator: 'gold', floor: 0 }); run(s, 0.2); So.finish(s, true); }
  assert.equal(Game.floorState(s, 0).rank, r0 + 1);
  assert.ok(Math.abs(Game.glowMult(s, 0) / m0 - (1 + 0.05 * (r0 + 1)) / (1 + 0.05 * r0)) < 1e-9);
});

test('mutators change the rules while the sortie is out', () => {
  const s = fresh();
  const rate0 = Game.clearRate(s.player, 0, s.mods);
  So.start(s, { type: 'haul', action: 'clear', mat: 'balls', goal: 1e9, reward: 1, mutator: 'double', floor: 0 });
  assert.equal(Game.clearRate(s.player, 0, s.mods), rate0 * 0.5);
  So.abandon(s); So.start(s, { type: 'haul', action: 'clear', mat: 'balls', goal: 1e9, reward: 1, mutator: 'quiet', floor: 0 });
  for (let i = 1; i <= 4; i++) finishRoom(s, 0, i, 0);
  assert.equal(Tide.maybeRandom(s, 0, 1e4), null, 'Quiet hour: no Tides');
  So.abandon(s); So.start(s, { type: 'haul', action: 'clear', mat: 'balls', goal: 1e9, reward: 1, mutator: 'dim', floor: 0 });
  Game.updateStrength(s, 0, 1, 0); assert.ok(Math.abs(Game.room(s, 0, 1, 0).strength - 0.6) < 1e-9, 'Dim lamps');
});

test('gadgets: bought with materials, each does its job', () => {
  const s = fresh(); s.pos = { floor: 0, x: 0, z: 0, yaw: 0, pitch: 0 };
  for (const m of Object.keys(s.player.materials)) s.player.materials[m] = 1000;
  for (const m of Object.keys(So.GADGETS)) assert.ok(So.buyGadget(s, m));
  assert.equal(s.player.materials.balls, 1000 - CFG.gadgetCost);
  // glowstick lights the room ahead for a minute (yaw 0 faces north)
  assert.deepEqual(Gad.use(s, 'glowstick').room, [0, -1]); assert.ok(Game.room(s, 0, 0, -1).flags.glowT === 60);
  Gad.tick(s, 61); assert.equal(Game.room(s, 0, 0, -1).flags.glowT, undefined);
  // plane maps five rooms
  Gad.use(s, 'plane'); for (let i = 1; i <= 5; i++) assert.ok(Game.room(s, 0, 0, -i).flags.mapped);
  // soap in the north doorway
  assert.ok(Gad.use(s, 'soap').ok); assert.ok(s.soap.has(Game.edgeKey(0, 0, 0, 0)));
  // bookmark: place, walk away, return
  const S = roomSide(0); s.pos.x = 2 * S; s.pos.z = 0.3; Gad.use(s, 'bookmark'); s.pos.x = 0; s.pos.z = 0; s.player.gadgets.bookmark = 0;
  assert.ok(Gad.use(s, 'bookmark').returned); assert.equal(s.pos.x, 2 * S);
  // sprout: a lit room never floods
  finishRoom(s, 0, 2, 0); assert.ok(Gad.use(s, 'sprout').ok); assert.ok(Game.room(s, 0, 2, 0).flags.sprout);
  // snack: 30 s of double combo
  s.pos.x = 0; Gad.use(s, 'snack'); assert.equal(s.snackT, 30);
});

test('signs: about 35 % of polished rooms, about 60 % true; two true rays meet on the Anchor', () => {
  const s = fresh(21);
  let n = 0, tru = 0, total = 0;
  for (let x = -30; x < 30; x++) for (let z = -30; z < 30; z++) { if (Math.abs(x) + Math.abs(z) <= 1) continue; total++; const sg = Signs.signAt(s, 0, x, z); if (sg) { n++; if (sg.true) tru++; } }
  assert.ok(Math.abs(n / total - 0.35) < 0.03, String(n / total));
  assert.ok(Math.abs(tru / n - 0.6) < 0.05, String(tru / n));
  // pick two true signs in one region and intersect their rays
  const a = Signs.anchorFor(s, 0, 5, 5); const [rx, rz] = Signs.regionOf(5, 5);
  const trues = [];
  for (let x = rx * 10; x < rx * 10 + 10; x++) for (let z = rz * 10; z < rz * 10 + 10; z++) { const sg = Signs.signAt(s, 0, x, z); if (sg && sg.true) trues.push(sg); }
  const [p, q] = trues.filter((t, i) => i === 0 || Math.abs(Math.sin(t.angle - trues[0].angle)) > 0.2).slice(0, 2);
  const d1 = [Math.cos(p.angle), Math.sin(p.angle)], d2 = [Math.cos(q.angle), Math.sin(q.angle)];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const tt = ((q.x - p.x) * d2[1] - (q.z - p.z) * d2[0]) / den;
  const ix = p.x + d1[0] * tt, iz = p.z + d1[1] * tt;
  assert.ok(Math.hypot(ix - a.x, iz - a.z) < 1e-6, `rays meet at ${ix.toFixed(2)},${iz.toFixed(2)}; anchor ${a.x},${a.z}`);
  // in co-op, true signs are shared and false ones differ
  let shared = 0, diff = 0;
  for (let x = 2; x < 60; x++) { const a1 = Signs.signAt(s, 0, x, 3, { salt: 1 }), a2 = Signs.signAt(s, 0, x, 3, { salt: 2 }); if (a1 && a1.true) { assert.ok(a2 && a2.true); shared++; } if (!!a1 !== !!a2) diff++; }
  assert.ok(shared > 0 && diff > 0);
});
