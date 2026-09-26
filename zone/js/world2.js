'use strict';
// ---------- world expansion: new stages, rivers, trains, towers, exploration, and visual polish ----------

// ----- new stages (design coordinates, scaled by MS below) -----
const W2_STAGES = {
  zaton: {
    theme: 'zone', wbias: { rain: 2, fog: 2, heat: 0.3 }, hills: 5,
    river: [[0, 3000], [1000, 3200], [1900, 3500], [2600, 3300], [3400, 3500], [4200, 3700], [5000, 3500], [5700, 3200], [6400, 3300]],
    rail: [[0, 2300], [2000, 2200], [3500, 1700], [4800, 1250], [6400, 1200]],
    regions: [
      { id: 'backwater', name: 'Zaton Backwaters', x: 3200, y: 5600, g: [74, 90, 62], a: [62, 78, 56], danger: 1, trees: 0.15, dead: 0.6, reeds: 1, water: 1, kind: 'village', anoms: ['acid', 'electro', 'spring', 'fuzz'] },
      { id: 'port', name: 'Shevchenko Wreck', x: 1200, y: 3900, g: [82, 90, 80], a: [70, 76, 70], danger: 3, trees: 0.08, dead: 0.5, cracks: 1, kind: 'port', anoms: ['electro', 'acid', 'geyser', 'gas'] },
      { id: 'port', name: 'Skadovsk', x: 4900, y: 4200, g: [82, 90, 80], a: [70, 76, 70], danger: 2, trees: 0.08, dead: 0.5, kind: 'port', anoms: ['electro', 'spring', 'acid'] },
      { id: 'sawmill', name: 'Old Sawmill', x: 1500, y: 1500, g: [64, 82, 52], a: [80, 78, 56], danger: 3, trees: 0.5, dead: 0.15, pine: 0.5, kind: 'village', anoms: ['spring', 'vortex', 'cryo', 'sound'] },
      { id: 'station', name: 'Yanov Station', x: 4800, y: 1200, g: [104, 102, 96], a: [90, 94, 74], danger: 4, trees: 0.05, dead: 0.4, cracks: 1, kind: 'factory', anoms: ['electro', 'burner', 'tesla', 'magnet'] },
      { id: 'plateau', name: 'The Plateau', x: 3100, y: 2600, g: [98, 100, 70], a: [86, 90, 62], danger: 3, trees: 0.2, dead: 0.2, anoms: ['vortex', 'spring', 'comet', 'mirror'] },
      { id: 'farm', name: 'Burnt Farmstead', x: 5800, y: 2400, g: [110, 80, 56], a: [92, 70, 50], danger: 4, trees: 0.2, dead: 0.5, red: 1, kind: 'ruins', anoms: ['burner', 'fuzz', 'comet', 'timeloop'] },
    ],
    spawns: [
      { name: 'Backwater Camp', x: 3200, y: 5800, icon: '🛶', desc: 'Calm reeds far from the river. Weakest mutants.' },
      { name: 'Skadovsk Barge', x: 4900, y: 4700, icon: '⚓', desc: 'The stalker ship. Traders nearby, river to the north.' },
      { name: 'Old Sawmill', x: 1600, y: 1900, icon: '🪵', desc: 'Forest north of the river. More dangerous.' },
    ],
    roads: [[[3200, 6400], [3200, 5600], [3300, 4300], [3300, 2600], [3600, 1600], [4800, 1200]], [[4900, 4700], [4000, 5000], [3200, 5600]], [[1500, 1500], [2400, 2200], [3300, 2600]], [[1200, 3900], [2200, 4000], [3300, 4300]], [[4800, 1200], [5800, 2400], [5600, 4000], [4900, 4700]]],
  },
  wasteland: {
    theme: 'npp', wbias: { heat: 4, rain: 0.3, snow: 0, fog: 0.5, storm: 0.6 }, hills: 9,
    rail: [[0, 3700], [2200, 3600], [4200, 3700], [6400, 3500]],
    regions: [
      { id: 'flats', name: 'Salt Flats', x: 3200, y: 5600, g: [176, 160, 116], a: [160, 142, 100], danger: 1, trees: 0.02, dead: 0.3, sand: 1, kind: 'ruins', anoms: ['spring', 'burner', 'geyser', 'fuzz'] },
      { id: 'dunes', name: 'Red Dunes', x: 1200, y: 4200, g: [182, 134, 94], a: [166, 118, 80], danger: 3, trees: 0.02, dead: 0.2, sand: 1, anoms: ['burner', 'comet', 'vortex', 'magnet'] },
      { id: 'oil', name: 'Oil Field', x: 5000, y: 4000, g: [120, 108, 86], a: [100, 90, 70], danger: 3, trees: 0.02, dead: 0.3, cracks: 1, kind: 'factory', anoms: ['burner', 'electro', 'gas'] },
      { id: 'canyon', name: 'Dry Canyon', x: 2800, y: 3000, g: [150, 120, 90], a: [130, 104, 78], danger: 3, trees: 0.03, dead: 0.4, sand: 1, anoms: ['vortex', 'spring', 'sound', 'geyser'] },
      { id: 'town', name: 'Ghost Town', x: 1400, y: 1500, g: [140, 126, 104], a: [120, 110, 92], danger: 4, trees: 0.03, dead: 0.5, cracks: 1, kind: 'town', anoms: ['fuzz', 'gas', 'mirror', 'electro'] },
      { id: 'crater', name: 'Impact Crater', x: 5000, y: 1500, g: [110, 100, 84], a: [90, 84, 70], danger: 5, trees: 0, dead: 0.3, cracks: 1, kind: 'ruins', anoms: ['comet', 'mincer', 'burner', 'timeloop'] },
    ],
    spawns: [
      { name: 'Salt Flats Camp', x: 3200, y: 5800, icon: '🏜️', desc: 'Open sand, easy to see mutants coming.' },
      { name: 'Oil Rig', x: 5200, y: 4600, icon: '🛢️', desc: 'Industrial ruins, burners and gas.' },
      { name: 'Canyon Rim', x: 2400, y: 3300, icon: '🪨', desc: 'High ground over the canyon.' },
    ],
    roads: [[[3200, 6400], [3200, 5000], [2800, 3000], [1400, 1500]], [[3200, 5000], [5000, 4000], [5000, 1500]], [[1200, 4200], [2800, 3000]]],
  },
  metro: {
    theme: 'lab', wbias: { rain: 0, fog: 0, storm: 0, psi: 1, heat: 0, snow: 0, radstorm: 0 }, night: 0.8, hills: 0, metro: 1,
    rail: [[0, 1395], [6400, 1395]], rail2: [[0, 3995], [6400, 3995]], rail3: [[3345, 0], [3345, 6400]],
    regions: [
      { id: 'tunnel', name: 'Red Line Tunnels', x: 3200, y: 5200, g: [70, 70, 72], a: [60, 60, 62], danger: 2, trees: 0, dead: 0.1, cracks: 1, anoms: ['electro', 'gas', 'fuzz', 'acid'] },
      { id: 'station', name: 'Arsenalnaya Station', x: 1500, y: 1500, g: [96, 88, 76], a: [84, 78, 70], danger: 4, trees: 0, dead: 0, kind: 'station', anoms: ['electro', 'burner', 'sound', 'psifield'] },
      { id: 'station', name: 'Polis Station', x: 5000, y: 1700, g: [96, 88, 76], a: [84, 78, 70], danger: 4, trees: 0, dead: 0, kind: 'station', anoms: ['tesla', 'electro', 'mirror', 'gas'] },
      { id: 'depot', name: 'Train Depot', x: 5000, y: 5000, g: [80, 76, 70], a: [70, 66, 60], danger: 3, trees: 0, dead: 0.2, kind: 'station', anoms: ['burner', 'electro', 'magnet'] },
      { id: 'flooded', name: 'Flooded Tunnels', x: 1400, y: 4600, g: [58, 66, 68], a: [50, 58, 60], danger: 3, trees: 0, dead: 0.2, water: 1, anoms: ['acid', 'electro', 'geyser'] },
      { id: 'd6', name: 'Metro-2 Bunker', x: 3200, y: 2800, g: [66, 70, 74], a: [56, 60, 64], danger: 5, trees: 0, dead: 0, cracks: 1, anoms: ['tesla', 'psifield', 'mincer', 'timeloop'] },
    ],
    spawns: [
      { name: 'VDNKh Platform', x: 3345, y: 5295, icon: '🚇', desc: 'The last safe station. Dark tunnels all around.' },
      { name: 'Depot Gate', x: 4645, y: 5295, icon: '🚃', desc: 'Old train yard. Rats everywhere.' },
      { name: 'Flooded Line', x: 1395, y: 4645, icon: '💧', desc: 'Knee-deep water and acid.' },
    ],
    roads: [],
  },
  blackout: {
    theme: 'pripyat', wbias: { fog: 2, storm: 1.2, heat: 0 }, night: 0.72, hills: 4, torch: 1.35,
    river: [[0, 4200], [900, 4000], [1700, 3700], [2400, 3900], [3000, 3600], [3600, 3300], [4300, 3500], [5200, 3300], [6400, 3500]],
    rail: [[0, 1800], [6400, 2100]],
    regions: [
      { id: 'forest', name: 'Black Forest', x: 3200, y: 5600, g: [52, 64, 44], a: [60, 62, 46], danger: 2, trees: 0.5, dead: 0.2, pine: 0.6, kind: 'village', anoms: ['spring', 'electro', 'fuzz', 'sound'] },
      { id: 'village', name: 'Lost Village', x: 1300, y: 4800, g: [70, 76, 54], a: [80, 76, 58], danger: 3, trees: 0.25, dead: 0.3, kind: 'village', anoms: ['fuzz', 'gas', 'mirror', 'electro'] },
      { id: 'bog', name: 'Whisper Bog', x: 1300, y: 1700, g: [56, 66, 52], a: [48, 58, 46], danger: 4, trees: 0.15, dead: 0.7, reeds: 1, water: 1, anoms: ['acid', 'psifield', 'gas', 'timeloop'] },
      { id: 'plant', name: 'Dead Plant', x: 5000, y: 4600, g: [90, 90, 86], a: [80, 82, 70], danger: 4, trees: 0.05, dead: 0.4, cracks: 1, kind: 'factory', anoms: ['electro', 'burner', 'tesla', 'magnet'] },
      { id: 'town', name: 'Dark Town', x: 4800, y: 1500, g: [88, 88, 84], a: [76, 80, 68], danger: 5, trees: 0.08, dead: 0.3, cracks: 1, kind: 'town', anoms: ['psifield', 'vortex', 'teleport', 'flip'] },
      { id: 'hollow', name: 'Red Hollow', x: 3000, y: 2500, g: [110, 66, 44], a: [92, 54, 38], danger: 4, trees: 0.5, dead: 0.15, red: 1, anoms: ['burner', 'comet', 'vortex', 'electro'] },
    ],
    spawns: [
      { name: 'Forest Campfire', x: 3200, y: 5800, icon: '🔥', desc: 'A lonely fire in the Black Forest.' },
      { name: 'Lost Village', x: 1300, y: 5100, icon: '🏚️', desc: 'Empty houses. Something moves between them.' },
      { name: 'Plant Gate', x: 5000, y: 5100, icon: '🏭', desc: 'Industrial east. Electro fields glow in the dark.' },
    ],
    roads: [[[3200, 6400], [3200, 4600], [3000, 2500], [3300, 1200], [4800, 1500]], [[1300, 4800], [3200, 4600], [5000, 4600]], [[1300, 1700], [3000, 2500]], [[5000, 4600], [4800, 1500]]],
  },
  winter: {
    theme: 'zone', wbias: { snow: 6, fog: 1.5, heat: 0, rain: 0.2, radstorm: 0.5 }, hills: 6,
    river: [[800, 0], [1100, 900], [900, 1900], [1300, 2800], [1200, 3600]],
    rail: [[0, 3400], [3000, 3250], [6400, 3300]],
    regions: [
      { id: 'tundra', name: 'Frozen Cordon', x: 3200, y: 5600, g: [206, 212, 222], a: [190, 198, 210], danger: 2, trees: 0.15, dead: 0.2, pine: 1, snow: 1, kind: 'village', anoms: ['cryo', 'electro', 'spring', 'fuzz'] },
      { id: 'lake', name: 'Frozen Lake', x: 1400, y: 4300, g: [168, 196, 214], a: [150, 180, 200], danger: 3, trees: 0.02, dead: 0.1, ice: 1, snow: 1, anoms: ['cryo', 'teleport', 'electro'] },
      { id: 'taiga', name: 'Snowy Taiga', x: 4900, y: 4500, g: [196, 204, 214], a: [180, 190, 202], danger: 3, trees: 0.55, dead: 0.1, pine: 1, snow: 1, anoms: ['cryo', 'vortex', 'spring', 'sound'] },
      { id: 'base', name: 'Radar Outpost', x: 4800, y: 1500, g: [150, 156, 164], a: [130, 136, 146], danger: 5, trees: 0.05, dead: 0.3, cracks: 1, snow: 1, kind: 'factory', anoms: ['tesla', 'electro', 'psifield', 'cryo'] },
      { id: 'village', name: 'Dead Village', x: 1500, y: 1600, g: [196, 200, 208], a: [176, 182, 194], danger: 4, trees: 0.2, dead: 0.4, pine: 0.8, snow: 1, kind: 'village', anoms: ['fuzz', 'gas', 'cryo', 'mirror'] },
      { id: 'ridge', name: 'Ice Ridge', x: 3100, y: 2600, g: [214, 220, 230], a: [196, 204, 216], danger: 4, trees: 0.1, dead: 0.2, pine: 1, snow: 1, anoms: ['cryo', 'comet', 'vortex', 'magnet'] },
    ],
    spawns: [
      { name: 'Frozen Cordon', x: 3200, y: 5800, icon: '❄️', desc: 'Snowed-in village. Slippery lake to the west.' },
      { name: 'Taiga Hut', x: 4900, y: 4900, icon: '🌲', desc: 'Deep pine forest.' },
      { name: 'Lakeside', x: 1700, y: 4900, icon: '🧊', desc: 'Next to the ice. Watch your footing.' },
    ],
    roads: [[[3200, 6400], [3200, 4000], [3100, 2600], [4800, 1500]], [[1700, 4900], [3200, 4000], [4900, 4500]], [[1500, 1600], [3100, 2600]]],
  },
  mountain: {
    theme: 'npp', wbias: { snow: 3, fog: 2, storm: 1, heat: 0 }, hills: 12, ridges: 16,
    river: [[6400, 700], [5600, 1300], [5200, 2200], [5600, 3100], [6400, 3600]],
    rail: [[4200, 6400], [4700, 4800], [5200, 3000], [6400, 2400]],
    regions: [
      { id: 'foothills', name: 'Foothills', x: 3200, y: 5700, g: [110, 118, 84], a: [96, 104, 76], danger: 2, trees: 0.3, dead: 0.1, pine: 0.7, kind: 'village', anoms: ['spring', 'electro', 'fuzz', 'geyser'] },
      { id: 'slope', name: 'Avalanche Slope', x: 3200, y: 3500, g: [206, 212, 220], a: [180, 186, 196], danger: 3, trees: 0.08, dead: 0.2, pine: 1, snow: 1, slope: 1, anoms: ['cryo', 'spring', 'vortex'] },
      { id: 'peak', name: 'The Summit', x: 3200, y: 1100, g: [222, 226, 234], a: [200, 206, 216], danger: 5, trees: 0.02, dead: 0.2, snow: 1, slope: 1, kind: 'ruins', anoms: ['cryo', 'psifield', 'comet', 'tesla'] },
      { id: 'pass', name: 'Western Pass', x: 1100, y: 3000, g: [128, 124, 116], a: [112, 108, 100], danger: 4, trees: 0.1, dead: 0.3, anoms: ['vortex', 'spring', 'magnet', 'sound'] },
      { id: 'mine', name: 'Old Mine', x: 5000, y: 4600, g: [118, 110, 100], a: [100, 94, 86], danger: 4, trees: 0.05, dead: 0.4, cracks: 1, kind: 'factory', anoms: ['electro', 'burner', 'gas', 'mincer'] },
      { id: 'glacier', name: 'Glacier Lake', x: 5100, y: 1500, g: [170, 198, 216], a: [152, 182, 202], danger: 5, trees: 0, dead: 0.1, ice: 1, snow: 1, anoms: ['cryo', 'teleport', 'timeloop'] },
    ],
    spawns: [
      { name: 'Foothill Camp', x: 3200, y: 5900, icon: '⛺', desc: 'Green valley below the mountain.' },
      { name: 'West Pass Hut', x: 1100, y: 3400, icon: '🪨', desc: 'Rocky pass between ridges.' },
      { name: 'Mine Entrance', x: 5000, y: 5000, icon: '⛏️', desc: 'Industrial ruins by the mine rail.' },
    ],
    roads: [[[3200, 6400], [3200, 4400], [2400, 3400], [3200, 2400], [3200, 1100]], [[1100, 3000], [2400, 3400]], [[3200, 4400], [5000, 4600]], [[3200, 2400], [5100, 1500]]],
  },
};
// rivers and rails for the original stages
Object.assign(STAGE_WORLD.zone, { hills: 4, river: [[0, 3200], [700, 3350], [1400, 3150], [2100, 3300], [2700, 3050], [3300, 3150], [3900, 3000], [4600, 3350], [5200, 3150], [5800, 2950], [6400, 2900]], rail: [[0, 1900], [6400, 2100]] });
Object.assign(STAGE_WORLD.pripyat, { hills: 2, river: [[0, 4000], [900, 4300], [1200, 5200], [1000, 6400]], rail: [[0, 5300], [6400, 5300]] });
Object.assign(STAGE_WORLD.npp, { hills: 3, river: [[4200, 4400], [4700, 3700], [5600, 3500], [6400, 3600]], rail: [[0, 2350], [6400, 2350]] });
const W2_SC = (pl) => pl && pl.map(([x, y]) => [x * MS, y * MS]);
for (const k of ['zone', 'pripyat', 'npp']) { const S = STAGE_WORLD[k]; S.river = W2_SC(S.river); S.rail = W2_SC(S.rail); }
for (const k in W2_STAGES) {
  const S = W2_STAGES[k];
  for (const r of S.regions) { r.x *= MS; r.y *= MS; }
  for (const s of S.spawns) { s.x *= MS; s.y *= MS; }
  S.roads = S.roads.map(W2_SC);
  for (const key of ['river', 'rail', 'rail2', 'rail3']) S[key] = W2_SC(S[key]);
  STAGE_WORLD[k] = S;
}
STAGES.push(
  { id: 'zaton', name: 'Zaton', icon: '⚓', desc: 'Wide river, rusting shipwrecks and a ghost train line.', hpMul: 1.25, final: { id: 'serpent', name: 'LEVIATHAN OF ZATON', hp: 2.2 }, needs: 'zone' },
  { id: 'wasteland', name: 'Dry Wasteland', icon: '🏜️', desc: 'Sand, heat waves and an impact crater. Lots of high ground.', hpMul: 1.6, final: { id: 'behemoth', name: 'THE DUNE BEHEMOTH', hp: 2.4 }, needs: 'zaton' },
  { id: 'metro', name: 'Metro Tunnels', icon: '🚇', desc: 'Dark concrete tunnels and stations. Bring a flashlight.', hpMul: 1.7, final: { id: 'ratqueen', name: 'THE METRO QUEEN', hp: 2.8 }, needs: 'pripyat' },
  { id: 'blackout', name: 'Blackout', icon: '🌃', desc: 'Eternal night. Your flashlight is your best friend.', hpMul: 2.1, final: { id: 'polterking', name: 'THE DARK KING', hp: 2.8 }, needs: 'npp' },
  { id: 'winter', name: 'Frozen Zone', icon: '❄️', desc: 'Snowstorms, slippery ice lakes and frozen mutants.', hpMul: 2.2, final: { id: 'chimera', name: 'THE FROST CHIMERA', hp: 3 }, needs: 'npp' },
  { id: 'mountain', name: 'Mountain Pass', icon: '🗻', desc: 'Ridges, cliffs and avalanches. The final climb.', hpMul: 2.4, final: { id: 'monolith', name: 'THE MOUNTAIN HEART', hp: 2.4 }, needs: 'winter' },
);
// branching unlocks: winning a stage opens every stage that needs it
unlockNextStage = function () {
  const S = Save.data, nx = STAGES.filter((s) => s.needs === G.stage && !S.stages.includes(s.id));
  if (!nx.length) return null;
  for (const s of nx) S.stages.push(s.id);
  Save.save(); G.unlocked = { icon: nx.map((s) => s.icon).join(' '), name: nx.map((s) => s.name).join(' + ') };
  return G.unlocked;
};
BSTYLE.ship = { wall: [96, 58, 44], wall2: [74, 62, 54], roof: [86, 72, 58], roof2: [100, 84, 64] };
BSTYLE.tunnel = { wall: [70, 70, 72], wall2: [64, 64, 68], roof: [30, 30, 32], roof2: [34, 33, 34] };
const W2 = { stage: (id) => STAGE_WORLD[id || World.stage] || {} };

// ----- level data -----
LEVEL_KEYS.push('openB', 'riverGrid', 'bridgePosts', 'rails', 'hills', 'wtowers', 'rtowers', 'chalks', 'crows', 'guides');
const _w2NewLevel = World.newLevel;
World.newLevel = function (kind) {
  _w2NewLevel.call(this, kind);
  this.openB = []; this.riverGrid = null; this.bridgePosts = []; this.rails = []; this.hills = []; this.wtowers = []; this.rtowers = []; this.chalks = []; this.crows = []; this.guides = [];
};
const RG_C = 32, RG_N = WORLD / RG_C;
World.riverAt = function (x, y) {
  if (!this.riverGrid) return 0;
  const gx = Math.floor(x / RG_C), gy = Math.floor(y / RG_C);
  if (gx < 0 || gy < 0 || gx >= RG_N || gy >= RG_N) return 0;
  return this.riverGrid[gy * RG_N + gx];
};
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((x - ax) * dx + (y - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}
function polyDist(pl, x, y) { let b = 1e9; for (let i = 0; i < pl.length - 1; i++) b = Math.min(b, segDist(x, y, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return b; }
// rivers are baked into a coarse grid: 1 bank, 2 water, 3 bridge
World.genRiver = function (S) {
  if (!S.river) return;
  const g = new Uint8Array(RG_N * RG_N), RW = 120;
  for (let gy = 0; gy < RG_N; gy++) for (let gx = 0; gx < RG_N; gx++) {
    const x = gx * RG_C + 16, y = gy * RG_C + 16;
    const w = RW + (fbm(x / 700, y / 700, 31) - 0.5) * 90, d = polyDist(S.river, x, y);
    if (d < w) g[gy * RG_N + gx] = this.roadDist(x, y) < 64 ? 3 : 2;
    else if (d < w + 40) g[gy * RG_N + gx] = 1;
  }
  this.riverGrid = g;
  for (let gy = 1; gy < RG_N - 1; gy++) for (let gx = 1; gx < RG_N - 1; gx++) {
    if (g[gy * RG_N + gx] !== 3) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const v = g[(gy + b) * RG_N + gx + a]; return v !== 3 && v !== 2 ? false : v === 2; });
    if (edge && (gx + gy) % 2 === 0) this.bridgePosts.push({ x: gx * RG_C + 16, y: gy * RG_C + 16 });
  }
};
const _w2Free = World.free;
World.free = function (x, y, r) { if (this.riverGrid) { const v = this.riverAt(x, y); if (v === 2) return false; } return _w2Free.call(this, x, y, r); };
const _w2Water = World.isWater;
World.isWater = function (x, y) { if (this.kind !== 'over') return false; const v = this.riverAt(x, y); if (v === 2) return true; if (v === 3) return false; return _w2Water.call(this, x, y); };
World.iceAt = function (x, y) { if (this.kind !== 'over') return false; const r = this.region(x, y); return !!r.ice && fbm(x / 420, y / 420, 23) > 0.5; };
const _w2Ground = World.groundColor;
World.groundColor = function (x, y) {
  let c = _w2Ground.call(this, x, y);
  if (this.kind !== 'over') return c;
  const reg = this.region(x, y);
  if (reg.snow) c = mixc(c, [228, 232, 240], clamp(0.5 + (fbm(x / 300, y / 300, 21) - 0.5) * 1.2, 0.2, 0.9));
  if (reg.ice) { const n = fbm(x / 420, y / 420, 23); if (n > 0.5) c = mixc(c, [150, 196, 226], clamp((n - 0.5) * 8, 0, 0.9)); }
  if (reg.sand) { const n = Math.sin(x / 70 + fbm(x / 500, y / 500, 4) * 8) * 0.5 + 0.5; c = [c[0] + n * 12, c[1] + n * 9, c[2] + n * 5]; }
  const v = this.riverAt(x, y);
  if (v === 2) { const n = vnoise(x / 40, y / 40, 3); c = mixc(c, reg.snow ? [150, 190, 214] : [34, 58, 70], 0.85 + n * 0.1); }
  else if (v === 1) c = mixc(c, reg.snow ? [200, 206, 214] : [118, 108, 82], 0.55);
  else if (v === 3) c = [100, 78, 54];
  return c;
};
const _w2Map = World.buildMap;
World.buildMap = function () {
  _w2Map.call(this);
  if (this.kind !== 'over') return;
  const g = this.mapImg.getContext('2d'), k = this.mapImg.width / WORLD;
  g.save(); g.scale(k, k); g.lineJoin = 'round';
  for (const r of this.rails) { g.beginPath(); r.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = 'rgba(30,26,22,0.9)'; g.lineWidth = 40; g.stroke(); g.setLineDash([60, 60]); g.strokeStyle = 'rgba(160,150,130,0.8)'; g.lineWidth = 14; g.stroke(); g.setLineDash([]); }
  for (const h of this.hills) { g.strokeStyle = 'rgba(40,30,20,0.55)'; g.lineWidth = 24; g.beginPath(); g.ellipse(h.x, h.y, h.r, h.r * 0.8, 0, 0, TAU); g.stroke(); }
  g.restore();
};

// ----- stage generators for the new stages -----
World.genStage2 = function (stage, R) {
  const S = W2.stage(stage);
  if (S.metro) return this.genMetro(R);
  for (const reg of this.regions) {
    const cx = reg.x, cy = reg.y;
    if (reg.kind === 'village') {
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + R() * 0.4, d = 280 + R() * 260; this.building(cx + Math.cos(a) * d - 80, cy + Math.sin(a) * d * 0.8 - 60, 140 + R() * 50, 100 + R() * 30, 55 + R() * 20, R() < 0.6 ? 'house' : 'hut'); }
      for (let i = 0; i < 6; i++) this.addFence(cx - 240 + i * 70, cy + 560, 64, true);
    } else if (reg.kind === 'town') {
      for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) if (R() < 0.7) this.building(cx + gx * 420 + R() * 60, cy + gy * 360 + R() * 60, 180 + R() * 120, 110 + R() * 70, 90 + R() * 90, R() < 0.6 ? 'apartment' : 'ruin');
    } else if (reg.kind === 'factory') {
      for (let i = 0; i < 7; i++) { const w = 240 + R() * 240, h = 150 + R() * 150; this.building(cx + (R() - 0.5) * 1100 - w / 2, cy + (R() - 0.5) * 1100 - h / 2, w, h, 100 + R() * 70, 'factory'); }
      for (let i = 0; i < 5; i++) { const x = cx + (R() - 0.5) * 1200, y = cy + (R() - 0.5) * 1200; if (this.free(x, y, 30)) this.addTank(x, y, R); }
      for (let i = 0; i < 6; i++) { const x = cx + (R() - 0.5) * 1200, y = cy + (R() - 0.5) * 1200; if (this.free(x, y, 16)) this.addBarrel(x, y, true); }
      if (reg.id === 'oil' || reg.id === 'mine') for (let i = 0; i < 4; i++) { const x = cx + (R() - 0.5) * 1400, y = cy + (R() - 0.5) * 1400; if (this.free(x, y, 40)) this.tower(x, y, 200 + R() * 80); }
    } else if (reg.kind === 'ruins') {
      for (let i = 0; i < 10; i++) { const x = cx + (R() - 0.5) * 1400, y = cy + (R() - 0.5) * 1400; if (R() < 0.6) this.building(x, y, 110 + R() * 120, 90 + R() * 70, 40 + R() * 50, 'ruin'); else if (this.free(x, y, 70)) this.heap(x, y, 40 + R() * 40, R); }
    } else if (reg.kind === 'port') {
      for (let i = 0; i < 3; i++) { const w = 460 + R() * 200, h = 120 + R() * 40; this.building(cx + (R() - 0.5) * 900 - w / 2, cy + (R() - 0.5) * 700 - h / 2, w, h, 60 + R() * 30, 'ship'); }
      for (let i = 0; i < 3; i++) { const x = cx + (R() - 0.5) * 1000, y = cy + (R() - 0.5) * 800; if (this.free(x, y, 40)) this.tower(x, y, 240 + R() * 60); }
      for (let i = 0; i < 8; i++) this.building(cx + (R() - 0.5) * 1100, cy + (R() - 0.5) * 900, 110, 50, 45, 'factory');
    }
    if (reg.kind) this.labels.push({ x: cx, y: cy + 60, name: reg.name });
  }
  this.ruins(R, 70);
  this.roadWrecks(R, 0.45);
  if (S.ridges) this.genRidges(R, S.ridges);
};
World.addRock = function (x, y, r, R) {
  this.addOb({ x, y, r: r * 0.9 });
  const pts = []; for (let k = 0; k < 7; k++) pts.push(0.75 + R() * 0.35);
  this.addProp({ kind: 'rock', x, y, r, pts, sy: y, bx0: x - r - 10, bx1: x + r + 10, by0: y - r * 2, by1: y + r });
};
World.genRidges = function (R, n) {
  for (let i = 0; i < n; i++) {
    let x = 600 + R() * (WORLD - 1200), y = 600 + R() * (WORLD - 1200), a = R() * TAU;
    for (let k = 0; k < 22; k++) {
      a += (R() - 0.5) * 0.5; x += Math.cos(a) * 70; y += Math.sin(a) * 70;
      if (k % 7 === 6) continue; // gaps you can squeeze through
      const r = 30 + R() * 26;
      if (dist(x, y, this.start.x, this.start.y) > 500 && this.roadDist(x, y) > 90 && this.free(x, y, r)) this.addRock(x, y, r, R);
    }
  }
};
World.genMetro = function (R) {
  const PD = 1300, CW = 380;
  for (let gy = 0; gy * PD < WORLD; gy++) for (let gx = 0; gx * PD < WORLD; gx++) {
    const x = gx * PD + CW, y = gy * PD + CW, w = PD - CW, h = PD - CW;
    if (x + w > WORLD - 60 || y + h > WORLD - 60) continue;
    const reg = this.region(x + w / 2, y + h / 2);
    if (dist(x + w / 2, y + h / 2, this.start.x, this.start.y) < 500) continue;
    if (reg.kind === 'station') {
      for (let k = 0; k < 6; k++) { const px = x + 140 + (k % 3) * (w - 280) / 2, py = y + 200 + Math.floor(k / 3) * (h - 400); this.addOb({ x: px, y: py, r: 26 }); this.addProp({ kind: 'pillar', x: px, y: py, sy: py, bx0: px - 60, bx1: px + 60, by0: py - 220, by1: py + 30 }); }
      this.labels.push({ x: x + w / 2, y: y + h / 2, name: reg.name });
      continue;
    }
    this.building(x, y, w, h, 44 + R() * 20, 'tunnel');
  }
};
World.genWorld2 = function (R) {
  const S = W2.stage(this.stage), far = (x, y, d) => dist(x, y, this.start.x, this.start.y) > d;
  if (S.metro) for (const p of this.props.filter((p) => p.kind === 'grass' || p.kind === 'bush')) { this.propCells(p, (c) => { const k = c.indexOf(p); if (k >= 0) c.splice(k, 1); }); p.gone = 1; }
  if (S.metro) this.props = this.props.filter((p) => !p.gone);
  // rails
  for (const key of ['rail', 'rail2', 'rail3']) if (S[key]) {
    const pts = S[key], lens = []; let L = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = dist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); lens.push(l); L += l; }
    this.rails.push({ pts, lens, L });
  }
  // hills (high ground)
  for (let i = 0, t = 0; i < (S.hills || 0) && t < 400; t++) {
    const x = 800 + R() * (WORLD - 1600), y = 800 + R() * (WORLD - 1600), r = 240 + R() * 200;
    if (!far(x, y, 900) || this.riverAt(x, y) || this.hills.some((h) => dist(h.x, h.y, x, y) < h.r + r + 300)) continue;
    this.hills.push({ x, y, r, seed: R() * 100 }); i++;
  }
  const spot = (minD, r, list, gap) => {
    for (let t = 0; t < 300; t++) {
      const x = 500 + R() * (WORLD - 1000), y = 500 + R() * (WORLD - 1000);
      if (far(x, y, minD) && this.free(x, y, r) && !list.some((o) => dist(o.x, o.y, x, y) < gap)) return [x, y];
    }
    return null;
  };
  if (!S.metro) for (let i = 0; i < 5; i++) {
    const p = spot(800, 50, this.wtowers, 3000); if (!p) continue;
    const t = { x: p[0], y: p[1], used: false, hold: 0 }; this.wtowers.push(t);
    this.addOb({ x: t.x, y: t.y, r: 20 });
    this.addProp({ kind: 'wtower', x: t.x, y: t.y, t, sy: t.y, bx0: t.x - 120, bx1: t.x + 120, by0: t.y - 300, by1: t.y + 40 });
  }
  for (let i = 0; i < 4; i++) {
    const p = spot(1200, 40, this.rtowers, 3400); if (!p) continue;
    const t = { x: p[0], y: p[1], on: false, hold: 0, name: this.region(p[0], p[1]).name };
    this.rtowers.push(t);
    this.addOb({ x: t.x, y: t.y, r: 16 });
    this.addProp({ kind: 'rtower', x: t.x, y: t.y, t, sy: t.y, bx0: t.x - 100, bx1: t.x + 100, by0: t.y - 360, by1: t.y + 30 });
  }
  // guides at every hub (spawn point)
  for (const sp of STAGE_WORLD[this.stage].spawns) {
    const g = { x: sp.x + 90, y: sp.y + 60, name: sp.name };
    if (!this.free(g.x, g.y, 14)) { g.x = sp.x - 90; }
    this.guides.push(g);
    this.addProp({ kind: 'guide', x: g.x, y: g.y, g, sy: g.y, bx0: g.x - 40, bx1: g.x + 40, by0: g.y - 90, by1: g.y + 20 });
  }
  // chalk stashes near buildings
  const bl = this.props.filter((p) => p.kind === 'building' && p.style !== 'tunnel');
  for (let i = 0, t = 0; i < 14 && t < 200 && bl.length; t++) {
    const b = bl[Math.floor(R() * bl.length)], mx = b.x + R() * b.w, my = b.y + b.h + 26;
    if (!far(mx, my, 400) || this.chalks.some((c) => dist(c.mx, c.my, mx, my) < 1200)) continue;
    const a = Math.PI * 0.5 + (R() - 0.5) * 1.6, d = 120 + R() * 80, x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d;
    if (!this.free(x, y, 20)) continue;
    this.chalks.push({ mx, my, x, y, a, found: false, hold: 0 }); i++;
  }
  // crows
  for (let i = 0; i < 45; i++) { const x = 300 + R() * (WORLD - 600), y = 300 + R() * (WORLD - 600); if (this.free(x, y, 30) && !S.metro) this.crows.push({ x, y, n: 3 + Math.floor(R() * 4), st: 0, t: 0, seed: R() * 100 }); }
  // enterable houses & collapsible buildings
  for (const b of this.props) {
    if (b.kind !== 'building') continue;
    const ob = this.obGrid[Math.floor((b.y + 1) / OBCELL) * (WORLD / OBCELL) + Math.floor((b.x + 1) / OBCELL)].find((o) => o.t === 1 && o.x === b.x && o.y === b.y && o.w === b.w);
    if (!ob) continue;
    b.ob = ob;
    if ((b.style === 'house' || b.style === 'hut') && b.w > 120 && b.h > 88 && R() < 0.4) {
      this.destroy(ob); b.ob = null;
      const T = 12, D = 56, half = (b.w - D) / 2;
      b.walls = [{ t: 1, x: b.x, y: b.y, w: b.w, h: T }, { t: 1, x: b.x, y: b.y, w: T, h: b.h }, { t: 1, x: b.x + b.w - T, y: b.y, w: T, h: b.h },
        { t: 1, x: b.x, y: b.y + b.h - T, w: half, h: T }, { t: 1, x: b.x + half + D, y: b.y + b.h - T, w: half, h: T }].map((o) => this.addOb(o));
      b.open = true; this.openB.push(b);
      this.crateSpots.push({ x: b.x + b.w / 2 + (R() - 0.5) * b.w * 0.3, y: b.y + b.h * 0.42 });
    } else if (b.style === 'house' || b.style === 'hut' || b.style === 'ruin' || b.style === 'apartment') b.chp = b.cmax = 120 + b.w * b.h * 0.004;
  }
  // hospital basement in Pripyat
  if (this.stage === 'pripyat' && this.hatches.length) {
    const hr = this.regions.find((r) => r.id === 'hospital'), h = this.hatches.reduce((a, b) => (dist(b.x, b.y, hr.x, hr.y) < dist(a.x, a.y, hr.x, hr.y) ? b : a));
    h.name = 'Hospital Basement'; h.hospital = true; this.hospIdx = h.idx;
    const l = this.labels.find((l) => l.x === h.x && l.y === h.y + 40); if (l) l.name = '🏥 Hospital';
  }
};
const _w2GenLab = World.genLab;
World.genLab = function (idx) {
  _w2GenLab.call(this, idx);
  if (this.stage === 'pripyat' && idx === this.hospIdx && this.lab) { this.lab.name = 'HOSPITAL'; this.lab.hospital = true; this.regions[0].name = 'Hospital Basement'; }
};

// ----- runtime -----
Object.assign(W2, {
  reset() {
    this.explored = new Uint8Array(64 * 64); this.expCount = 0; this.expT = 0; this.expTier = 0;
    this.train = null; this.trainT = rand(70, 110); this.av = null; this.avT = rand(40, 70); this.hospT = 10;
    this.leaves = []; this.splash = []; this.wet = 0; this.cardT = 0; G.artMarkT = 0; P.high = null;
  },
  explore(r) {
    const cs = WORLD / 64, x0 = Math.max(0, Math.floor((P.x - r) / cs)), x1 = Math.min(63, Math.floor((P.x + r) / cs)), y0 = Math.max(0, Math.floor((P.y - r) / cs)), y1 = Math.min(63, Math.floor((P.y + r) / cs));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const i = gy * 64 + gx;
      if (!this.explored[i] && dist2((gx + 0.5) * cs, (gy + 0.5) * cs, P.x, P.y) < r * r) { this.explored[i] = 1; this.expCount++; }
    }
  },
  fogMask() {
    if (!this.fog) { this.fog = document.createElement('canvas'); this.fog.width = this.fog.height = 64; this.fogCtx = this.fog.getContext('2d'); this.fogImg = this.fogCtx.createImageData(64, 64); this.fogN = -1; }
    if (this.fogN !== this.expCount) {
      this.fogN = this.expCount; const d = this.fogImg.data;
      for (let i = 0; i < 4096; i++) { d[i * 4] = 12; d[i * 4 + 1] = 12; d[i * 4 + 2] = 9; d[i * 4 + 3] = this.explored[i] ? 0 : 215; }
      this.fogCtx.putImageData(this.fogImg, 0, 0);
    }
    return this.fog;
  },
  expPct() { return Math.floor((this.expCount / 4096) * 100); },
  update(dt) {
    const W = World;
    G.artMarkT = Math.max(0, (G.artMarkT || 0) - dt);
    this.wet = lerp(this.wet, Env.rainA > 0.3 ? 1 : 0, dt * (Env.rainA > 0.3 ? 0.08 : 0.02));
    if (W.kind === 'lab') {
      if (W.lab && W.lab.hospital && !W.lab.cleared) { this.hospT -= dt; if (this.hospT <= 0 && G.enemies.length < 90) { this.hospT = 14; const p = ringPos(); if (p) spawnEnemy('controller', p[0], p[1], { noElite: true }); } }
      return;
    }
    // exploration
    P.high = W.hills.find((h) => dist2(h.x, h.y, P.x, P.y) < h.r * h.r * 0.95) || null;
    this.expT -= dt;
    if (this.expT <= 0) {
      this.expT = 0.4; this.explore(P.high ? 1300 : 850);
      const tiers = [5, 10, 20, 35, 50], pct = this.expPct();
      if (this.expTier < tiers.length && pct >= tiers[this.expTier]) {
        const n = tiers[this.expTier]; this.expTier++;
        G.rubles += 25 * this.expTier; if (this.expTier >= 3) G.pickups.push({ type: 'art', x: P.x + 40, y: P.y, t: 0 });
        banner('🧭 ' + n + '% EXPLORED', '+' + 25 * this.expTier + ' ₽' + (this.expTier >= 3 ? ' and an artifact' : '') + '. Keep exploring the map!', 2.2, 'good');
      }
    }
    // high ground: shots from below hit the cliff
    if (P.high) for (const b of G.ebullets) {
      if (b.w2 === undefined) b.w2 = dist2(b.x, b.y, P.high.x, P.high.y) > P.high.r * P.high.r ? 1 : 0;
      if (b.w2 === 1 && dist2(b.x, b.y, P.high.x, P.high.y) < P.high.r * P.high.r * 0.9) { b.w2 = 2; if (Math.random() < 0.5) { b.dead = true; burst(b.x, b.y, 4, '140,120,90', 60); } }
    }
    const near = (o, r) => dist2(o.x, o.y, P.x, P.y) < r * r;
    for (const t of W.wtowers) {
      if (t.used) continue;
      if (near(t, 75)) { t.hold += dt; if (t.hold > 1.2) { t.used = true; this.explore(3200); for (const a of W.anomalies) if (a.hidden && dist2(a.x, a.y, t.x, t.y) < 1500 * 1500) a.hidden = false; G.artMarkT = 45; G.artMarks = World.fields.filter((f) => f.art && dist2(f.art.x, f.art.y, t.x, t.y) < 3200 * 3200); for (let i = 0; i < 6; i++) dropGem(t.x + rand(-40, 40), t.y + rand(10, 40), 3 + Math.floor(G.t / 60)); banner('🗼 WATCHTOWER', 'The area is revealed on your map. Artifacts are marked for 45s.', 2.5, 'good'); Sfx.play('quest'); } }
      else t.hold = Math.max(0, t.hold - dt);
    }
    for (const t of W.rtowers) {
      if (t.on) continue;
      if (near(t, 75)) { t.hold += dt; if (t.hold > 1.5) { t.on = true; banner('📡 RADIO TOWER ONLINE', 'Open the map (M) to fast-travel between active towers.', 2.5, 'good'); Sfx.play('quest'); } }
      else t.hold = Math.max(0, t.hold - dt);
    }
    for (const c of W.chalks) {
      if (c.found) continue;
      if (near(c, 34)) { c.hold += dt; if (c.hold > 1) { c.found = true; const v = 20 + Math.floor(G.t / 20); G.rubles += v; text(c.x, c.y - 40, '+' + v + ' ₽', '#ffcf6a', true, true); if (Math.random() < 0.5) giveItem(pick(Object.keys(ITEMS))); if (Math.random() < 0.2) G.pickups.push({ type: 'art', x: c.x, y: c.y + 20, t: 0 }); for (let i = 0; i < 4; i++) dropGem(c.x + rand(-20, 20), c.y + rand(-10, 20), 3 + Math.floor(G.t / 60)); banner('✖ CHALK STASH', 'You dug up a hidden stash.', 1.8, 'good'); Sfx.play('stash'); } }
      else c.hold = 0;
    }
    G.nearGuide = W.guides.find((g) => near(g, 110)) || null;
    // crows scatter when you come close
    for (const c of W.crows) {
      if (c.st === 0 && near(c, 230)) { c.st = 1; c.t = 0; c.a = Math.atan2(c.y - P.y, c.x - P.x); if (Sfx.ctx) for (let i = 0; i < 3; i++) Sfx.noise(0.12, 0.03, 1500 + i * 200, 'bandpass', i * 0.12, Sfx.amb); }
      else if (c.st === 1) { c.t += dt; if (c.t > 6) { c.st = 0; const a = rand(TAU), d = rand(1800, 3000); c.x = clamp(c.x + Math.cos(a) * d, 300, WORLD - 300); c.y = clamp(c.y + Math.sin(a) * d, 300, WORLD - 300); } }
    }
    this.updateTrain(dt);
    this.updateAvalanche(dt);
    // leaves, snow flurries and dust near the camera
    const reg = W.region(CAM.x, CAM.y), rate = reg.snow ? 0 : reg.sand ? 3 : reg.trees > 0.3 ? 5 : reg.trees > 0.12 ? 1.5 : 0;
    if (Save.set.quality !== 'low' && Math.random() < rate * dt && this.leaves.length < 50) {
      const col = reg.red ? pick(['#c0602a', '#d8883a', '#9a3a1a']) : reg.sand ? '#c8b08a' : pick(['#8a9a3a', '#b0a040', '#6a7a2a', '#c0903a']);
      this.leaves.push({ x: CAM.x + rand(-700, 700), y: CAM.y + rand(-500, 400), z: rand(120, 260), vx: rand(20, 60), a: rand(TAU), s: reg.sand ? 1.5 : rand(3, 5), c: col, life: 8, dust: !!reg.sand });
    }
    for (const l of this.leaves) { l.life -= dt; l.x += (l.vx + Math.sin(NOW * 2 + l.a) * 30) * dt; l.z = Math.max(0, l.z - 22 * dt); l.a += dt * 3; if (l.z <= 0) l.life = Math.min(l.life, 1.5); }
    this.leaves = this.leaves.filter((l) => l.life > 0);
    if (this.wet > 0.2 && Env.rainA > 0.2) for (let i = 0; i < 4; i++) if (Math.random() < Env.rainA) this.splash.push({ x: CAM.x + rand(-VW / ZOOM / 2, VW / ZOOM / 2), y: CAM.y + rand(-VH / ZOOM / 2, VH / ZOOM / 2), t: 0 });
    for (const s of this.splash) s.t += dt;
    this.splash = this.splash.filter((s) => s.t < 0.35);
    // dying wildfires scorch the ground
    for (const f of Hz.fires) if (f.life < dt * 1.5 && !f.scorched) { f.scorched = 1; decal(f.x, f.y, 55, '26,18,12'); }
  },
  // ghost trains run along the rails every couple of minutes
  railPos(r, s) {
    s = clamp(s, 0, r.L);
    for (let i = 0; i < r.lens.length; i++) { if (s <= r.lens[i]) { const k = s / r.lens[i], a = r.pts[i], b = r.pts[i + 1]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])]; } s -= r.lens[i]; }
    const b = r.pts[r.pts.length - 1], a = r.pts[r.pts.length - 2]; return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])];
  },
  updateTrain(dt) {
    const W = World;
    if (!W.rails.length) return;
    if (!this.train) {
      this.trainT -= dt;
      if (this.trainT <= 0) {
        this.trainT = rand(100, 160);
        const r = W.rails.reduce((a, b) => (polyDist(b.pts, P.x, P.y) < polyDist(a.pts, P.x, P.y) ? b : a)), dir = Math.random() < 0.5 ? 1 : -1;
        this.train = { r, dir, s: dir > 0 ? -400 : r.L + 400, warn: 4, cars: 7, ghost: Env.isNight() || W2.stage().night };
        if (polyDist(r.pts, P.x, P.y) < 1600) { banner('🚂 ' + (this.train.ghost ? 'GHOST TRAIN' : 'TRAIN INCOMING'), 'Get off the tracks!', 2.2, 'bad', 2); if (Sfx.ctx) { Sfx.tone(170, 1.5, 'sawtooth', 0.05, -5, 0, Sfx.amb); Sfx.tone(214, 1.5, 'sawtooth', 0.04, -4, 0, Sfx.amb); } }
      }
      return;
    }
    const T = this.train;
    if (T.warn > 0) { T.warn -= dt; return; }
    T.s += T.dir * 1250 * dt;
    for (let i = 0; i < T.cars; i++) {
      const [x, y] = this.railPos(T.r, T.s - T.dir * i * 130);
      if (dist2(x, y, P.x, P.y) < 60 * 60 && !(P.trainT > G.t) && P.z <= 0) { P.trainT = G.t + 1; hurtPlayer(28, 'the ghost train'); const a = rand(TAU); P.kvx = Math.cos(a) * 700; P.kvy = Math.sin(a) * 700; }
      EG.query(x, y, 80, TMP3);
      for (const e of TMP3) if (!e.dead && !e.boss && dist2(e.x, e.y, x, y) < (e.r + 50) ** 2) hurtEnemy(e, 400 + e.maxhp, (e.x - x) * 6, (e.y - y) * 6, true);
    }
    if (Math.random() < 0.5) { const [x, y] = this.railPos(T.r, T.s); part(x, y, { z: 70, vz: 120, g: -30, c: T.ghost ? '140,255,180' : '90,90,90', s: 10, life: 1.4, add: T.ghost }); }
    if (T.s < -2000 || T.s > T.r.L + 2000) this.train = null;
  },
  updateAvalanche(dt) {
    const reg = World.region(P.x, P.y);
    if (!this.av) {
      if (!reg.slope || G.bosses.length) return;
      this.avT -= dt;
      if (this.avT <= 0) { this.avT = rand(50, 85); this.av = { x: P.x, y: P.y - 750, w: 1100, t: 0, hit: false }; banner('🏔️ AVALANCHE!', 'Snow is sliding down the slope. Move sideways!', 2.2, 'bad', 2); shake(8); if (Sfx.ctx) Sfx.noise(3, 0.12, 300, 'lowpass', 0, Sfx.amb); }
      return;
    }
    const A = this.av; A.t += dt;
    if (A.t < 1.5) return;
    A.y += 360 * dt;
    if (!A.hit && Math.abs(P.y - A.y) < 60 && Math.abs(P.x - A.x) < A.w / 2 && P.dashT <= 0) { A.hit = true; hurtPlayer(24, 'an avalanche'); P.kvy = 600; }
    EG.query(A.x, A.y, A.w / 2, TMP3);
    for (const e of TMP3) if (!e.boss && Math.abs(e.y - A.y) < 60 && !(e.avT > G.t)) { e.avT = G.t + 1; hurtEnemy(e, 90, 0, 500, true); }
    if (Math.random() < 0.8) part(A.x + rand(-A.w / 2, A.w / 2), A.y, { z: rand(0, 40), vz: rand(40, 120), g: 60, c: '235,240,250', s: rand(4, 9), life: 0.8 });
    if (A.t > 6) this.av = null;
  },
});
// high ground: +15% damage
const _w2Hurt = hurtEnemy;
hurtEnemy = function (e, dmg, kx, ky, raw, proc) { if (P && P.high && !raw) dmg *= 1.15; return _w2Hurt(e, dmg, kx, ky, raw, proc); };
// explosions can collapse buildings
const _w2Explode = explode;
explode = function (x, y, r, dmg, fromPlayer = true) {
  _w2Explode(x, y, r, dmg, fromPlayer);
  if (World.kind !== 'over' || !fromPlayer) return;
  const PC = WORLD / PCELL, st = ++World.stamp;
  for (let gy = Math.max(0, Math.floor((y - r - 400) / PCELL)); gy <= Math.min(PC - 1, Math.floor((y + r + 200) / PCELL)); gy++)
    for (let gx = Math.max(0, Math.floor((x - r - 400) / PCELL)); gx <= Math.min(PC - 1, Math.floor((x + r + 200) / PCELL)); gx++)
      for (const b of World.propGrid[gy * PC + gx].slice()) {
        if (b._s2 === st || b.kind !== 'building' || !b.chp) continue; b._s2 = st;
        const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
        if (dist2(x, y, nx, ny) > (r + 30) ** 2) continue;
        b.chp -= dmg;
        if (b.chp > 0) { burst(nx, ny, 6, '150,140,120', 120); continue; }
        b.chp = 0;
        if (b.ob) { b.ob.prop = b; World.destroy(b.ob); } else { World.propCells(b, (c) => { const k = c.indexOf(b); if (k >= 0) c.splice(k, 1); }); }
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        for (let i = 0; i < 3; i++) { const hx = cx + (Math.random() - 0.5) * b.w * 0.6, hy = cy + (Math.random() - 0.5) * b.h * 0.5; World.heap(hx, hy, 30 + Math.random() * 30, Math.random); }
        for (let i = 0; i < 24; i++) part(cx + rand(-b.w / 2, b.w / 2), cy + rand(-b.h / 2, b.h / 2), { z: rand(0, 60), vz: rand(40, 160), g: -10, c: '130,120,105', s: rand(10, 22), life: rand(1, 2) });
        EG.query(cx, cy, Math.max(b.w, b.h), TMP3); for (const e of TMP3) if (!e.boss && e.x > b.x - 20 && e.x < b.x + b.w + 20 && e.y > b.y - 20 && e.y < b.y + b.h + 20) hurtEnemy(e, 250, 0, 0, true);
        text(cx, cy - 60, 'COLLAPSE!', '#e8d8b0', true, true); shake(14); Sfx.play('boom');
        if (Math.random() < 0.4) G.pickups.push({ type: Math.random() < 0.3 ? 'art' : 'med', x: cx, y: b.y + b.h + 30, t: 0 });
      }
};
// fast travel (radio towers are free, hub guides cost rubles)
function w2Travel(x, y, cost, name) {
  if (G.bosses.length) { banner('NOT NOW', 'You can\'t travel during a boss fight.', 1.6, 'bad'); return; }
  if (G.em && G.em.phase !== 'after') { banner('NOT NOW', 'Wait for the emission to pass.', 1.6, 'bad'); return; }
  if (G.rubles < cost) { banner('NOT ENOUGH RUBLES', cost + ' ₽ needed.', 1.6, 'bad'); return; }
  G.rubles -= cost;
  if (P.veh) { P.veh.x = P.x; P.veh.y = P.y; P.veh = null; }
  P.x = x; P.y = y + 90;
  for (let i = 0; i < 40 && !World.free(P.x, P.y, 16); i++) { P.x += rand(-60, 60); P.y += rand(-40, 60); }
  CAM.x = P.x; CAM.y = P.y; G.fade = 1; P.inv = 2;
  for (const e of G.enemies) if (!e.boss && dist2(e.x, e.y, P.x, P.y) < 400 * 400) { e.x += (e.x - P.x) * 1.5; e.y += (e.y - P.y) * 1.5; }
  toggleMap(); banner('🧭 ' + name.toUpperCase(), cost ? 'The guide leads you through safe paths. -' + cost + ' ₽' : 'Radio beacon fast travel.', 2, 'good');
}
function mapInfoUI() {
  const el = $('mapInfo'); if (!el) return;
  if (World.kind !== 'over') { el.innerHTML = ''; return; }
  const rt = World.rtowers.filter((t) => t.on), gd = G.nearGuide;
  let h = `<div>🧭 Explored <b>${W2.expPct()}%</b> · 🗼 ${World.wtowers.filter((t) => t.used).length}/${World.wtowers.length} towers climbed · 📡 ${rt.length}/${World.rtowers.length} radio towers · ✖ ${World.chalks.filter((c) => c.found).length}/${World.chalks.length} chalk stashes</div>`;
  const btn = (i, label) => `<button class="ghost" data-tr="${i}">${label}</button>`;
  const opts = [];
  for (const t of rt) opts.push({ x: t.x, y: t.y, cost: 0, name: t.name + ' tower', label: '📡 ' + t.name });
  if (gd) for (const g of World.guides) if (g !== gd) opts.push({ x: g.x, y: g.y, cost: 60, name: g.name, label: '🧭 ' + g.name + ' · 60 ₽' });
  if (opts.length) h += '<div class="travel">' + opts.map((o, i) => btn(i, o.label)).join('') + '</div>';
  else h += '<div class="dim">Activate 📡 radio towers or talk to a 🧭 guide at a start point to fast-travel.</div>';
  el.innerHTML = h;
  for (const b of el.querySelectorAll('[data-tr]')) b.onclick = (e) => { e.stopPropagation(); const o = opts[+b.dataset.tr]; w2Travel(o.x, o.y, o.cost, o.name); };
}
// ui.js loads after this file, so its map functions are wrapped once every script has run
addEventListener('DOMContentLoaded', () => {
const _w2BigMap = drawBigMap;
drawBigMap = function () {
  _w2BigMap();
  mapInfoUI();
  if (World.kind !== 'over') return;
  const c = $('bigmap'), g = c.getContext('2d'), S = c.width / DPR, f = S / WORLD, cs = (WORLD / 64) * f;
  g.imageSmoothingEnabled = true; g.drawImage(W2.fogMask(), 0, 0, S, S);
  g.textAlign = 'center'; g.font = '16px sans-serif';
  for (const t of World.rtowers) { g.globalAlpha = t.on ? 1 : 0.45; g.fillText('📡', t.x * f, t.y * f + 5); }
  g.globalAlpha = 1;
  for (const t of World.wtowers) if (W2.explored[Math.floor(t.y / (WORLD / 64)) * 64 + Math.floor(t.x / (WORLD / 64))]) g.fillText(t.used ? '✅' : '🗼', t.x * f, t.y * f + 5);
  for (const gd of World.guides) g.fillText('🧭', gd.x * f + 12, gd.y * f);
  if (G.artMarkT > 0) for (const fl of G.artMarks || []) if (fl.art) g.fillText('💎', fl.art.x * f, fl.art.y * f + 5);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(P.x * f, P.y * f, 6, 0, TAU); g.fill(); g.strokeStyle = '#e33'; g.lineWidth = 3; g.stroke();
};
const _w2Mini = drawMinimap;
drawMinimap = function () {
  _w2Mini();
  if (World.kind !== 'over') return;
  const S = mm.width, span = 2000, f = S / span, cs = WORLD / 64;
  const x0 = Math.max(0, Math.floor((P.x - span / 2) / cs)), x1 = Math.min(63, Math.floor((P.x + span / 2) / cs)), y0 = Math.max(0, Math.floor((P.y - span / 2) / cs)), y1 = Math.min(63, Math.floor((P.y + span / 2) / cs));
  mmx.imageSmoothingEnabled = true; mmx.drawImage(W2.fogMask(), 0, 0, 64, 64, (-P.x + span / 2) * f, (-P.y + span / 2) * f, WORLD * f, WORLD * f);
  mmx.font = '13px sans-serif'; mmx.textAlign = 'center';
  const tx = (x) => (x - P.x + span / 2) * f, ty = (y) => (y - P.y + span / 2) * f;
  for (const t of World.rtowers) mmx.fillText('📡', tx(t.x), ty(t.y) + 4);
  for (const t of World.wtowers) if (!t.used) mmx.fillText('🗼', tx(t.x), ty(t.y) + 4);
  if (G.artMarkT > 0) for (const fl of G.artMarks || []) if (fl.art) mmx.fillText('💎', tx(fl.art.x), ty(fl.art.y) + 4);
  if (W2.train && W2.train.warn <= 0) { const [x, y] = W2.railPos(W2.train.r, W2.train.s); mmx.fillText('🚂', tx(x), ty(y) + 4); }
};
});

// ----- satellite crash event -----
EVENTS.satellite = { name: 'Satellite Crash', icon: '🛰️', minT: 200, w: 1.3, dur: 80, goal: 3, desc: 'Something fell from orbit. Reach the crash site and salvage the core (stand on it for 3s).',
  can() { return World.kind === 'over'; },
  start(ev) {
    let x = P.x, y = P.y;
    for (let i = 0; i < 40; i++) { const a = rand(TAU); x = clamp(P.x + Math.cos(a) * 900, 300, WORLD - 300); y = clamp(P.y + Math.sin(a) * 650, 300, WORLD - 300); if (World.free(x, y, 70)) break; }
    ev.loc = { x, y }; ev.p = 0;
    G.fx.push({ k: 'sky', x, y, life: 0.6, max: 0.6 });
    G.timers.push({ t: 1.4, fn: () => { ev.landed = true; explode(x, y, 170, 60, true); shake(16); flash(0.4, '200,230,255'); decal(x, y, 130, '30,26,24'); for (let i = 0; i < 3; i++) spawnEnemy(i ? 'exo' : 'holoclone', x + rand(-160, 160), y + rand(-120, 120), { noElite: true }); } });
  },
  update(ev, dt) { if (ev.landed && dist2(P.x, P.y, ev.loc.x, ev.loc.y) < 90 * 90) ev.p += dt; if (ev.p >= ev.goal) return 'win'; },
  win(ev) { G.rubles += 150; for (let i = 0; i < 2; i++) G.pickups.push({ type: 'art', x: ev.loc.x + rand(-40, 40), y: ev.loc.y + 40, t: 0 }); } };

// ----- boss intro cards -----
const BOSS_LORE = { pseudogiant: 'Tons of mutated flesh. The ground shakes when it walks.', chimera: 'Two heads, one hunger. Leaps from the shadows.', matriarch: 'Mother of the pack. Her young are never far.', ratqueen: 'The swarm obeys her. Kill her and they scatter.', burer: 'Telekinetic dwarf. Hurls anything that isn\'t nailed down.', polterking: 'A storm of invisible hands.', packalpha: 'The biggest dog of them all.', prime: 'The first controller. Your mind is not your own.', izlomlord: 'Twisted limbs, unnatural reach.', behemoth: 'Armored hide. Aim for the weak spots.', serpent: 'Rises from the water without warning.', heli: 'Military gunship. Take cover and shoot back.', hologram: 'Is it even real? Only one of them is.', monolith: 'The heart of the Zone. It calls to you.' };
function bossCard(e, o) {
  const title = o.final ? 'FINAL BOSS' : o.labBoss ? 'LAB GUARDIAN' : e.eventBoss ? 'ANCIENT ONE' : 'BOSS';
  let el = $('bossCard');
  if (!el) { el = document.createElement('div'); el.id = 'bossCard'; document.body.appendChild(el); }
  if (G.t - (W2.cardT || -99) < 4 && el.classList.contains('show')) { banner('⚠ ' + e.name + ' ⚠', 'Another boss joins the fight!', 2.5, 'bad', 2); return; }
  W2.cardT = G.t;
  el.innerHTML = `<small>${title}</small><b>${e.name}</b><span>${BOSS_LORE[e.id] || 'A massive mutant is hunting you.'}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ----- drawing -----
function hexRgb(h) { if (!h || h[0] !== '#') return '255,255,255'; const n = parseInt(h.length === 4 ? h.slice(1).split('').map((c) => c + c).join('') : h.slice(1, 7), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }
function drawW2Base(x0, y0, x1, y1, title) {
  const W = World;
  if (W.kind !== 'over') return;
  // hills: raised plateaus with a lit rim and a cliff face on the south side
  for (const h of W.hills) {
    if (h.x + h.r < x0 || h.x - h.r > x1 || h.y + h.r < y0 - 40 || h.y - h.r > y1) continue;
    ctx.fillStyle = 'rgba(30,24,16,0.35)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 18, h.r, h.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(80,66,48,0.55)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 10, h.r, h.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,210,0.08)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    if (P && P.high === h) { ctx.strokeStyle = 'rgba(255,220,120,0.35)'; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r - 8, h.r * 0.8 - 8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  // puddles after rain
  if (W2.wet > 0.05) {
    const cs = 260;
    for (let gy = Math.floor(y0 / cs); gy <= Math.floor(y1 / cs); gy++) for (let gx = Math.floor(x0 / cs); gx <= Math.floor(x1 / cs); gx++) {
      if (hash2(gx, gy, 41) > 0.3) continue;
      const x = (gx + hash2(gx, gy, 42)) * cs, y = (gy + hash2(gx, gy, 43)) * cs, r = 20 + hash2(gx, gy, 44) * 40;
      if (W.riverAt(x, y) || W.region(x, y).sand) continue;
      ctx.fillStyle = `rgba(60,80,95,${0.45 * W2.wet})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(200,220,235,${0.25 * W2.wet})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.1, r * 0.5, r * 0.14, 0, Math.PI, TAU); ctx.stroke();
    }
    for (const s of W2.splash) { const k = s.t / 0.35; ctx.strokeStyle = `rgba(210,225,240,${0.5 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(s.x, s.y, 3 + k * 9, (3 + k * 9) * 0.4, 0, 0, TAU); ctx.stroke(); }
  }
  // rails
  for (const r of W.rails) for (let i = 0; i < r.pts.length - 1; i++) {
    const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1];
    if (Math.max(ax, bx) < x0 - 50 || Math.min(ax, bx) > x1 + 50 || Math.max(ay, by) < y0 - 50 || Math.min(ay, by) > y1 + 50) continue;
    const L = r.lens[i], ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
    let t0 = 0, t1 = L;
    // clip the segment to the view
    for (const [p, d, lo, hi] of [[ax, ux, x0 - 60, x1 + 60], [ay, uy, y0 - 60, y1 + 60]]) {
      if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) { t0 = 1; t1 = 0; } continue; }
      let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 >= t1) continue;
    ctx.fillStyle = 'rgba(70,58,44,0.95)';
    for (let t = Math.ceil(t0 / 34) * 34; t < t1; t += 34) { const x = ax + ux * t, y = ay + uy * t; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux)); ctx.fillRect(-5, -26, 10, 52); ctx.restore(); }
    ctx.strokeStyle = 'rgba(150,146,140,0.95)'; ctx.lineWidth = 3.5; ctx.beginPath();
    for (const o of [-16, 16]) { ctx.moveTo(ax + ux * t0 + nx * o, ay + uy * t0 + ny * o); ctx.lineTo(ax + ux * t1 + nx * o, ay + uy * t1 + ny * o); }
    ctx.stroke();
  }
  // bridge posts
  ctx.fillStyle = '#4a3a2a';
  for (const b of W.bridgePosts) if (b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1 + 40) { ctx.fillRect(b.x - 3, b.y - 16, 6, 18); ctx.fillStyle = '#6a5438'; ctx.fillRect(b.x - 16, b.y - 16, 32, 3); ctx.fillStyle = '#4a3a2a'; }
  // chalk marks and stash crosses
  ctx.lineCap = 'round';
  for (const c of W.chalks) {
    if (c.mx < x0 - 200 || c.mx > x1 + 200 || c.my < y0 - 200 || c.my > y1 + 200) continue;
    ctx.strokeStyle = 'rgba(235,235,225,0.75)'; ctx.lineWidth = 3;
    ctx.save(); ctx.translate(c.mx, c.my); ctx.rotate(c.a); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(6, -7); ctx.lineTo(14, 0); ctx.lineTo(6, 7); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(c.mx, c.my - 18, 6, 0, TAU); ctx.stroke();
    if (!c.found) { ctx.strokeStyle = `rgba(235,235,225,${0.35 + Math.sin(NOW * 3) * 0.1})`; ctx.beginPath(); ctx.moveTo(c.x - 10, c.y - 6); ctx.lineTo(c.x + 10, c.y + 6); ctx.moveTo(c.x + 10, c.y - 6); ctx.lineTo(c.x - 10, c.y + 6); ctx.stroke(); if (c.hold > 0) { ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y - 40, 12, -Math.PI / 2, -Math.PI / 2 + TAU * c.hold); ctx.stroke(); } }
    else { ctx.fillStyle = 'rgba(60,44,30,0.6)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 16, 8, 0, 0, TAU); ctx.fill(); }
  }
  // interior floor of the house you are standing in
  if (P && !title) for (const b of W.openB) if (P.x > b.x && P.x < b.x + b.w && P.y > b.y && P.y < b.y + b.h) drawInterior(b);
  // crows on the ground
  for (const c of W.crows) if (c.st === 0 && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1) for (let i = 0; i < c.n; i++) {
    const x = c.x + Math.sin(c.seed + i * 2.1) * 30, y = c.y + Math.cos(c.seed + i * 1.7) * 16, peck = Math.sin(NOW * 5 + i * 1.3 + c.seed) > 0.7 ? 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 6, 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#15151a'; ctx.beginPath(); ctx.ellipse(x, y - 5, 6, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x + 5, y - 8 + peck, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a4030'; ctx.fillRect(x + 7, y - 8 + peck, 3, 1.5);
  }
}
function drawInterior(b) {
  ctx.fillStyle = '#5a4430'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(30,20,12,0.5)'; ctx.lineWidth = 1;
  for (let y = b.y + 12; y < b.y + b.h; y += 12) { ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(90,70,60,0.8)'; ctx.fillRect(b.x + 16, b.y + 16, 34, 20); ctx.fillStyle = 'rgba(120,40,30,0.5)'; ctx.fillRect(b.x + b.w - 60, b.y + 20, 40, 26);
  const wc = rgb(BSTYLE[b.style].wall.map((v) => v * 0.7));
  ctx.fillStyle = wc;
  for (const w of b.walls) ctx.fillRect(w.x, w.y - (w.y === b.y ? 26 : 8), w.w, w.h + (w.y === b.y ? 26 : 8));
}
function drawW2Top(x0, y0, x1, y1) {
  const W = World;
  if (W.kind !== 'over') return;
  // flying crows
  for (const c of W.crows) if (c.st === 1 && c.x > x0 - 400 && c.x < x1 + 400 && c.y > y0 - 400 && c.y < y1 + 400) for (let i = 0; i < c.n; i++) {
    const a = c.a + (i - c.n / 2) * 0.25, d = c.t * (180 + i * 20), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.6 - c.t * 90 - i * 6, f = Math.sin(NOW * 18 + i) * 6;
    ctx.strokeStyle = `rgba(20,20,24,${clamp(2 - c.t / 3, 0, 1)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 9, y - f); ctx.lineTo(x, y); ctx.lineTo(x + 9, y - f); ctx.stroke();
  }
  // the train
  const T = W2.train;
  if (T) {
    if (T.warn > 0) { const [x, y] = W2.railPos(T.r, nearestRailS(T.r)); if (Math.sin(NOW * 14) > 0) { ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(x - 30, y - 60, 7, 0, TAU); ctx.arc(x + 30, y - 60, 7, 0, TAU); ctx.fill(); } ctx.fillStyle = '#333'; ctx.fillRect(x - 3, y - 60, 6, 60); }
    else for (let i = T.cars - 1; i >= 0; i--) {
      const [x, y, a] = W2.railPos(T.r, T.s - T.dir * i * 130); if (x < x0 - 200 || x > x1 + 200 || y < y0 - 200 || y > y1 + 200) continue;
      const ang = a + (T.dir < 0 ? Math.PI : 0);
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = T.ghost ? 0.7 : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 10, 70, 30, ang, 0, TAU); ctx.fill();
      ctx.rotate(ang);
      ctx.fillStyle = T.ghost ? (i === 0 ? '#3a6a52' : '#2e5444') : i === 0 ? '#3a3a3e' : '#5a4a3a'; ctx.fillRect(-60, -28, 120, 56);
      ctx.fillStyle = T.ghost ? '#8affc0' : i === 0 ? '#555' : '#6e5c48'; ctx.fillRect(-56, -22, 112, 44);
      if (i === 0) { ctx.fillStyle = T.ghost ? '#c0ffe0' : '#ffe8a0'; ctx.beginPath(); ctx.arc(58, 0, 8, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = -40; k <= 40; k += 26) ctx.fillRect(k - 8, -22, 16, 44); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // avalanche wall
  const A = W2.av;
  if (A) {
    if (A.t < 1.5) { ctx.fillStyle = `rgba(255,255,255,${0.12 + Math.sin(NOW * 10) * 0.06})`; ctx.fillRect(A.x - A.w / 2, A.y, A.w, 1200); }
    else { const g = ctx.createLinearGradient(0, A.y - 160, 0, A.y + 40); g.addColorStop(0, 'rgba(240,244,250,0)'); g.addColorStop(1, 'rgba(240,244,250,0.95)'); ctx.fillStyle = g; ctx.fillRect(A.x - A.w / 2, A.y - 160, A.w, 200); }
  }
  // satellite wreck
  const ev = Events.cur;
  if (ev && ev.id === 'satellite' && ev.landed) {
    const { x, y } = ev.loc;
    ctx.fillStyle = '#6a6e74'; ctx.fillRect(x - 24, y - 40, 48, 36);
    ctx.fillStyle = '#2a4a8a'; ctx.fillRect(x - 90, y - 34, 60, 22); ctx.fillRect(x + 30, y - 30, 60, 22);
    ctx.strokeStyle = '#9ab'; ctx.lineWidth = 1; for (let k = 0; k < 4; k++) { ctx.strokeRect(x - 90 + k * 15, y - 34, 15, 22); ctx.strokeRect(x + 30 + k * 15, y - 30, 15, 22); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(120,220,255,${0.6 + Math.sin(NOW * 6) * 0.3})`; ctx.beginPath(); ctx.arc(x, y - 22, 9, 0, TAU); ctx.fill(); ctx.restore();
    if (ev.p > 0) { ctx.strokeStyle = '#6cf'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y - 80, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (ev.p / 3)); ctx.stroke(); }
  }
  // smoke columns (visible from far away): wildfires, camps, crash sites, trains
  const src = [];
  for (let i = 0; i < Hz.fires.length; i += 3) src.push([Hz.fires[i].x, Hz.fires[i].y, 1]);
  for (const p of W.pois) if (p.state < 2 && p.type === 'camp') src.push([p.x, p.y, 0.5]);
  if (ev && ev.loc && (ev.id === 'satellite' || ev.id === 'airdrop')) src.push([ev.loc.x, ev.loc.y, 1.3]);
  for (const [sx, sy, k] of src) {
    if (sx < x0 - 400 || sx > x1 + 400 || sy < y0 - 100 || sy - 1200 > y1) continue;
    for (let i = 0; i < 12; i++) {
      const h = ((NOW * 45 + i * 80 + sx) % 960), r = (14 + h * 0.09) * k, a = (1 - h / 960) * 0.28 * k;
      ctx.fillStyle = `rgba(70,66,62,${a})`; ctx.beginPath(); ctx.arc(sx + Math.sin(h / 120 + i) * 20 + h * 0.18, sy - 30 - h, r, 0, TAU); ctx.fill();
    }
  }
  // falling leaves / dust
  for (const l of W2.leaves) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1 + 40) continue;
    ctx.fillStyle = l.c; ctx.globalAlpha = Math.min(1, l.life);
    ctx.save(); ctx.translate(l.x, l.y - l.z); ctx.rotate(l.a); ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.45 * Math.abs(Math.cos(l.a * 2)) + 0.6, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // interaction rings for towers
  for (const t of [...W.wtowers, ...W.rtowers]) if (t.hold > 0) { ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(t.x, t.y - 110, 16, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(t.hold / (t.on === undefined ? 1.2 : 1.5), 0, 1)); ctx.stroke(); }
  if (G.nearGuide && !(typeof nearVehicle === 'function' && (P.veh || nearVehicle()))) { ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf6a'; ctx.fillText('GUIDE · open the map (M) to travel', G.nearGuide.x, G.nearGuide.y - 80); }
}
function nearestRailS(r) {
  let best = 1e12, bs = 0, acc = 0;
  for (let i = 0; i < r.lens.length; i++) {
    const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = clamp(((P.x - ax) * dx + (P.y - ay) * dy) / l, 0, 1);
    const d = dist2(P.x, P.y, ax + dx * t, ay + dy * t); if (d < best) { best = d; bs = acc + t * r.lens[i]; }
    acc += r.lens[i];
  }
  return bs;
}
// screen-space: god rays, colored anomaly light, fog layers, fireflies
function drawW2Screen(cx, cy, title) {
  if (Save.set.quality === 'low') return;
  const W = World, dark = Env.darkness(), sx = (x) => (x - cx) * ZOOM + VW / 2, sy = (y) => (y - cy) * ZOOM + VH / 2;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (W.kind === 'over' && (Env.weather === 'clear' || Env.weather === 'heat') && dark < 0.45) {
    const k = (0.05 + Env.sunset() * 0.35) * (1 - dark * 2);
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.23 + NOW * 0.008) % 1.2 - 0.1) * VW - cx * 0.05 % 200, w = 60 + (i % 3) * 50;
      const g = ctx.createLinearGradient(x, 0, x + VH * 0.5, VH); g.addColorStop(0, `rgba(255,230,170,${k})`); g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w + VH * 0.5, VH); ctx.lineTo(x + VH * 0.5, VH); ctx.fill();
    }
  }
  const a0 = 0.05 + dark * 0.22;
  let n = 0;
  for (const a of W.anomalies) {
    if (a.hidden || Math.abs(a.x - cx) > VW / ZOOM / 2 + 100 || Math.abs(a.y - cy) > VH / ZOOM / 2 + 100 || n++ > 60) continue;
    const X = sx(a.x), Y = sy(a.y), R = a.r * 1.8 * ZOOM, g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
    const c = hexRgb((ANOMALIES[a.type] || {}).color);
    g.addColorStop(0, `rgba(${c},${a0})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(X - R, Y - R, R * 2, R * 2);
  }
  for (const f of Hz.fires) { const X = sx(f.x), Y = sy(f.y), R = 120 * ZOOM; if (X < -R || X > VW + R || Y < -R || Y > VH + R) continue; const g = ctx.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(255,140,40,${0.1 + dark * 0.3})`); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.fillRect(X - R, Y - R, R * 2, R * 2); }
  // fireflies in the dark
  if (W.kind === 'over' && dark > 0.4 && !W2.stage().metro) for (let i = 0; i < 26; i++) {
    const x = ((hash2(i, 1, 7) * 1600 + NOW * 12 * Math.sin(i)) % 1600) - 800 + cx, y = ((hash2(i, 2, 7) * 1100 + Math.cos(NOW + i) * 20) % 1100) - 550 + cy;
    const on = Math.sin(NOW * 2 + i * 1.7) > 0.3; if (!on) continue;
    ctx.fillStyle = `rgba(190,255,120,${0.5 * dark})`; ctx.beginPath(); ctx.arc(sx(x), sy(y), 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // drifting fog layers (heavier in fog, at dawn and over swamps)
  if (W.kind === 'over') {
    const reg = W.region(cx, cy), p = Env.phase(), dawn = Math.exp(-((p - 0.3) ** 2) / 0.004) * 0.5;
    const k = Math.min(0.8, Env.fogA * 0.6 + (reg.water ? 0.25 : 0) + dawn * 0.4 + (W2.stage().night ? 0.15 : 0));
    if (k > 0.03) for (const [par, spd, al] of [[0.3, 14, 1], [0.6, 26, 0.7]]) for (let i = 0; i < 6; i++) {
      const X = ((i * 431 + NOW * spd - cx * par * ZOOM) % (VW + 800) + VW + 800) % (VW + 800) - 400, Y = ((i * 263 - cy * par * ZOOM) % (VH + 400) + VH + 400) % (VH + 400) - 200, R = 260 + (i % 3) * 80;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(190,196,190,${0.2 * k * al})`); g.addColorStop(1, 'rgba(190,196,190,0)');
      ctx.fillStyle = g; ctx.fillRect(X - R, Y - R, R * 2, R * 2);
    }
  }
}
// subtle squash & stretch animation for every mutant
function animSquash(o) {
  if (Save.set.quality === 'low') return 0;
  return (o.flash > 0 ? 0.08 : 0) + Math.sin(NOW * (o.boss ? 4 : 9) + o.seed) * (o.boss ? 0.018 : 0.035);
}

// ----- props -----
PROP_DRAW.wtower = function (p) {
  const h = 150, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 20, p.y + 6, 40, 12, 0.3);
  ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 5;
  for (const lx of [-22, 22]) { ctx.beginPath(); ctx.moveTo(p.x + lx, p.y); ctx.lineTo(tx + lx * 0.7, ty); ctx.stroke(); }
  ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { const k = i / 6; ctx.beginPath(); ctx.moveTo(lerp(p.x - 22, tx - 15, k), lerp(p.y, ty, k)); ctx.lineTo(lerp(p.x + 22, tx + 15, k), lerp(p.y, ty, k)); ctx.stroke(); }
  ctx.fillStyle = '#6a5436'; ctx.fillRect(tx - 32, ty - 10, 64, 14);
  ctx.fillStyle = '#4a3a26'; ctx.fillRect(tx - 32, ty - 40, 5, 30); ctx.fillRect(tx + 27, ty - 40, 5, 30);
  ctx.fillStyle = '#5a4a36'; ctx.beginPath(); ctx.moveTo(tx - 40, ty - 40); ctx.lineTo(tx, ty - 62); ctx.lineTo(tx + 40, ty - 40); ctx.fill();
  if (!p.t.used) { ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,220,120,${0.6 + Math.sin(NOW * 3) * 0.3})`; ctx.fillText('▲ CLIMB', p.x, p.y + 24); }
};
PROP_DRAW.rtower = function (p) {
  const h = 260, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 20, p.y + 6, 30, 10, 0.3);
  ctx.strokeStyle = '#6a6e70'; ctx.lineWidth = 3;
  for (const lx of [-16, 16]) { ctx.beginPath(); ctx.moveTo(p.x + lx, p.y); ctx.lineTo(tx, ty); ctx.stroke(); }
  ctx.lineWidth = 1.2; for (let i = 1; i < 10; i++) { const k = i / 10; ctx.beginPath(); ctx.moveTo(lerp(p.x - 16, tx, k), lerp(p.y, ty, k)); ctx.lineTo(lerp(p.x + 16, tx, k + 0.1), lerp(p.y, ty, k + 0.1)); ctx.stroke(); }
  const on = p.t.on && Math.sin(NOW * 4) > 0;
  ctx.fillStyle = on ? '#ff3a2a' : '#5a2020'; ctx.beginPath(); ctx.arc(tx, ty - 4, 5, 0, TAU); ctx.fill();
  if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,40,0.4)'; ctx.beginPath(); ctx.arc(tx, ty - 4, 16, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = '#50565a'; ctx.fillRect(p.x - 14, p.y - 20, 28, 20);
  if (!p.t.on) { ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(120,200,255,${0.6 + Math.sin(NOW * 3) * 0.3})`; ctx.fillText('📡 ACTIVATE', p.x, p.y + 24); }
};
const GUIDE_PAL = { ...PAL_PLAYER, jacket: '#6a5a3e', jacket2: '#4a3e2a', hood: '#5a4a32', mask: false };
PROP_DRAW.guide = function (p) {
  shadow(p.x, p.y, 14, 5, 0.35);
  drawStalker({ x: p.x, y: p.y, z: 0, anim: NOW * 0.5, face: -1, aim: Math.PI, moving: false }, GUIDE_PAL, false);
  ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧭', p.x, p.y - 62);
};
PROP_DRAW.pillar = function (p) {
  const h = 200, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 16, p.y + 6, 30, 10, 0.35);
  ctx.fillStyle = '#6a6660'; ctx.beginPath(); ctx.moveTo(p.x - 22, p.y); ctx.lineTo(tx - 22, ty); ctx.lineTo(tx + 22, ty); ctx.lineTo(p.x + 22, p.y); ctx.fill();
  ctx.fillStyle = '#8a857c'; ctx.fillRect(tx - 28, ty - 8, 56, 12);
  ctx.fillStyle = `rgba(255,220,150,${Math.sin(NOW * 9 + p.x) > -0.9 ? 0.9 : 0.2})`; ctx.fillRect(lerp(p.x, tx, 0.6) - 6, lerp(p.y, ty, 0.6), 12, 6);
};
const _w2DrawB = PROP_DRAW.building;
PROP_DRAW.building = function (b) {
  if (b.open && P && !G.title && P.x > b.x && P.x < b.x + b.w && P.y > b.y && P.y < b.y + b.h) return;
  _w2DrawB(b);
  if (b.chp > 0 && b.chp < b.cmax) { ctx.strokeStyle = 'rgba(20,18,14,0.7)'; ctx.lineWidth = 2; const R = mulberry32(b.seed + 7); ctx.beginPath(); for (let i = 0; i < 3 + (1 - b.chp / b.cmax) * 6; i++) { let x = b.x + R() * b.w, y = b.y + b.h - R() * 20; ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 20; y -= R() * 14; ctx.lineTo(x, y); } } ctx.stroke(); }
};
