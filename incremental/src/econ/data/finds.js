// Things frozen in the ice besides coins. Which ones turn up depends on depth.
//   sec:   coins worth this many seconds of your income (deeper finds also add depth * 1.6 s)
//   relic: permanent income multiplier for this planet
//   buff:  { stat, mult, dur } a temporary boost to one stat
// look picks the model in world/events.js; glow is the colour that shows through the ice.

export const FINDS = [
  // shallow: lost gear from earlier surveys
  { id: 'lantern', name: 'Lost Lantern', icon: '🏮', look: 'lantern', glow: 0xffc76b, min: 2, max: 30, weight: 5, sec: 25, desc: 'Still warm inside.' },
  { id: 'satchel', name: 'Frozen Satchel', icon: '🎒', look: 'satchel', glow: 0xffa64d, min: 2, max: 40, weight: 4, sec: 40, desc: 'Someone packed it full of coins.' },
  { id: 'pickhead', name: 'Old Pick Head', icon: '⛏️', look: 'pickhead', glow: 0xe8b46a, min: 3, max: 45, weight: 3, sec: 15, buff: { stat: 'digRate', mult: 1.5, dur: 60 }, desc: 'Swing faster for a minute.' },
  // mid: expedition supplies
  { id: 'chest', name: 'Supply Chest', icon: '🧰', look: 'chest', glow: 0xffb347, min: 10, max: 120, weight: 5, sec: 70, desc: 'Expedition rations and coin.' },
  { id: 'thermos', name: 'Fuel Thermos', icon: '🧪', look: 'thermos', glow: 0xff7a45, min: 12, max: 120, weight: 3, sec: 20, buff: { stat: 'meltPower', mult: 1.8, dur: 75 }, desc: 'Your torch burns hotter for a while.' },
  { id: 'drone', name: 'Dead Survey Drone', icon: '🛸', look: 'drone', glow: 0x7fd4ff, min: 15, max: 160, weight: 2, sec: 30, buff: { stat: 'collectRange', mult: 2.5, dur: 90 }, desc: 'Its magnet still works: coins fly to you from far away.' },
  // deep: relics and stranger things
  { id: 'crate', name: 'Expedition Crate', icon: '📦', look: 'crate', glow: 0xffd27a, min: 35, max: 400, weight: 4, sec: 140, desc: 'A whole season of pay, never collected.' },
  { id: 'meteor', name: 'Meteorite Shard', icon: '☄️', look: 'shard', glow: 0xb9a4ff, min: 40, max: 400, weight: 2, sec: 40, relic: 1.03, desc: 'Strange iron. +3% income for good.' },
  { id: 'tusk', name: 'Frozen Tusk', icon: '🦣', look: 'tusk', glow: 0xf3e6c8, min: 50, max: 400, weight: 2, sec: 160, desc: 'From something that walked here long ago.' },
  { id: 'reliquary', name: 'Ancient Reliquary', icon: '🏺', look: 'reliquary', glow: 0x9fe6ff, min: 80, max: 400, weight: 1, sec: 120, relic: 1.05, desc: 'Older than the ice. +5% income for good.' },
];

export const FIND_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

// Pick a find for a depth, given a random number in [0, 1).
export function findForDepth(depth, u) {
  const ok = FINDS.filter((f) => depth >= f.min && depth <= f.max);
  const total = ok.reduce((a, f) => a + f.weight, 0);
  let acc = 0;
  for (const f of ok) { acc += f.weight / total; if (u <= acc) return f; }
  return ok[ok.length - 1] || FINDS[0];
}
