// Pure long game: Dawn (prestige), notes, achievements, cosmetic milestones, author's notes.
import { CFG } from './config.js';
import { hashFloat, hash32 } from './rng.js';
import * as Game from './game.js';
import { parseKey } from './world.js';

// ---------- notes from a previous resident (string keys note_0..note_19), calmer with depth ----------
export const NOTE_COUNT = 20;
export const noteTier = (i) => Math.floor(i / 5);              // 0..3
export const tierFloor = [0, 1, 3, 5];
// Does this room hold a note? One room in 25, and every sealed room.
export function roomHasNote(s, f, x, z) {
  if (Math.abs(x) + Math.abs(z) <= 1) return false;
  return Game.info(s, f, x, z).modifier === 'sealed' || hashFloat(s.house.seed, f, x, z, 131) < 1 / 25;
}
// When a room with a note is cleared, the next note allowed at this depth is found.
export function findNote(s, f, x, z) {
  const r = Game.room(s, f, x, z);
  if (r.flags.note || !r.clearedDone || !roomHasNote(s, f, x, z)) return null;
  r.flags.note = 1; r.touched = true;
  const have = new Set(s.player.notes);
  for (let i = 0; i < NOTE_COUNT; i++) {
    if (have.has(i) || tierFloor[noteTier(i)] > f) continue;
    s.player.notes.push(i); return i;
  }
  return null;
}

// ---------- achievements: small real wins ----------
export const ACHIEVEMENTS = ['leftRoom', 'oneThing', 'asked', 'enough', 'whole', 'madeItBack', 'rested', 'night', 'keptGoing', 'noticed'];
export function checkAchievements(s, ctx = {}) {
  const p = s.player, st = p.stats, got = new Set(p.achievements), out = [];
  const give = (id, cond) => { if (cond && !got.has(id)) { p.achievements.push(id); got.add(id); out.push(id); } };
  give('leftRoom', st.rooms > 0);
  give('oneThing', [...s.rooms.values()].some((r) => r.clearedDone && r.polishedDone && r.lit && !r.flags.free && r.total > 0));
  give('asked', st.signs > 0);
  give('enough', st.wavesHeld > 0);
  give('whole', Object.values(s.house.floors).some((f) => f.quiet));
  give('madeItBack', (st.cleanExits || 0) > 0);
  give('rested', !!ctx.restedAway);
  give('night', (p.dawns || 0) > 0);
  give('keptGoing', s.house.maxFloor >= 3);
  give('noticed', p.catalog.length > 0);
  return out;
}

// ---------- cosmetics ----------
// The house warms from blue to amber as a floor is lit.
export function floorWarmth(s, f) { const fl = Game.floorState(s, f); return fl.quiet ? 1 : Math.min(1, fl.litCount / 30); }
// The cabin gains a mug, a plant, a blanket and a drawing at milestones.
export function cabinItems(s) {
  const p = s.player;
  return { mug: p.stats.lamps > 0, plant: p.stats.wavesHeld > 0, blanket: Object.values(s.house.floors).some((f) => f.quiet) || (p.dawns || 0) > 0, drawing: (p.dawns || 0) > 0 || p.achievements.length >= 5 };
}

// ---------- Dawn ----------
export const dawnAvailable = (s) => s.house.maxFloor >= CFG.dawn.minFloor;
export const clarityGain = (s) => Math.floor(Math.sqrt(s.player.nightGlow / CFG.dawn.divisor));
// Resets Glow, upgrades, helpers, floors and room state with a new seed; keeps Clarity, Anchors, catalog, notes, achievements, diary, settings.
export function dawn(s, diaryLine = '', newSeed) {
  if (!dawnAvailable(s)) return null;
  const gain = clarityGain(s);
  const old = s.player;
  const keep = { clarity: old.clarity + gain, anchors: old.anchors, catalog: old.catalog, notes: old.notes, achievements: old.achievements,
    diary: [...old.diary], dawns: (old.dawns || 0) + 1, lifetimeGlow: old.lifetimeGlow, stats: old.stats };
  if (diaryLine && diaryLine.trim()) keep.diary.push({ night: keep.dawns, line: diaryLine.trim().slice(0, 200) });
  const seed = (newSeed ?? hash32(s.seed, keep.dawns, 977)) >>> 0;
  const fresh = Game.newGame(seed);
  Object.assign(fresh.player, keep);
  fresh.settings = s.settings;
  fresh.pos = { floor: 0, x: 0, y: 0, z: 0.8, yaw: 0, pitch: 0 };
  return { game: fresh, gain };
}

// ---------- author's notes: one editable line per biome ----------
export const AUTHOR_NOTES = {
  playroom: 'Draft: the ball room is where it started — mess that is fun to move.',
  pools: 'Draft: pools are for slowness. The foam forgives.',
  office: 'Draft: the office is the worry pile. Paper weighs nothing once it is sorted.',
  greenhouse: 'Draft: leaves come back every season, and that is fine.',
  library: 'Draft: the books are every unanswered thought. Shelve one.',
  cinema: 'Draft: the cinema is the loud part of the night. It goes quiet when you light it.',
};
