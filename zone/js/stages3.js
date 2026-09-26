'use strict';
// ---------- more stages: Volcanic Zone, Flooded Pripyat, Duga Radar (multi-floor dungeon), Noosphere,
// ---------- plus metro stairs on every surface map (a tunnel shortcut) and seasons on the classic maps ----------

const W3_STAGES = {
  volcanic: {
    theme: 'npp', wbias: { heat: 5, rain: 0.2, snow: 0, fog: 0.6, storm: 0.8, radstorm: 1.3 }, hills: 8, lava: 1, ridges: 6,
    river: [[0, 2600], [900, 2900], [1700, 2500], [2500, 3100], [3300, 2800], [4100, 3300], [4900, 2900], [5700, 3200], [6400, 3000]],
    regions: [
      { id: 'ashfield', name: 'Ash Fields', x: 3200, y: 5600, g: [92, 86, 82], a: [78, 72, 70], danger: 1, trees: 0.03, dead: 0.6, cracks: 1, kind: 'ruins', anoms: ['burner', 'spring', 'fuzz', 'geyser'] },
      { id: 'basalt', name: 'Basalt Steps', x: 1200, y: 4300, g: [70, 66, 66], a: [58, 54, 56], danger: 3, trees: 0, dead: 0.3, cracks: 1, anoms: ['burner', 'comet', 'vortex', 'magnet'] },
      { id: 'smelter', name: 'Old Smelter', x: 5100, y: 4300, g: [104, 88, 76], a: [88, 72, 62], danger: 3, trees: 0.02, dead: 0.3, cracks: 1, kind: 'factory', anoms: ['burner', 'electro', 'gas', 'tesla'] },
      { id: 'caldera', name: 'The Caldera', x: 3200, y: 1300, g: [120, 60, 40], a: [96, 44, 30], danger: 5, trees: 0, dead: 0.2, red: 1, cracks: 1, anoms: ['burner', 'comet', 'mincer', 'timeloop'] },
      { id: 'obsidian', name: 'Obsidian Ridge', x: 1300, y: 1500, g: [56, 50, 58], a: [46, 40, 48], danger: 4, trees: 0, dead: 0.1, cracks: 1, anoms: ['electro', 'vortex', 'mirror', 'burner'] },
      { id: 'sulfur', name: 'Sulfur Springs', x: 5100, y: 1600, g: [150, 140, 70], a: [130, 120, 60], danger: 4, trees: 0.02, dead: 0.3, water: 1, anoms: ['acid', 'gas', 'geyser', 'burner'] },
    ],
    spawns: [
      { name: 'Ash Camp', x: 3200, y: 5900, icon: '🌋', desc: 'Grey ash plains far from the lava. Easiest start.' },
      { name: 'Smelter Gate', x: 5100, y: 4800, icon: '🏭', desc: 'Rusty furnaces. Burners everywhere.' },
      { name: 'Basalt Hut', x: 1200, y: 4700, icon: '🪨', desc: 'Black rock steps west of the lava river.' },
    ],
    roads: [[[3200, 6400], [3200, 4300], [3000, 2900], [3200, 1300]], [[1200, 4300], [3200, 4300], [5100, 4300]], [[1300, 1500], [3000, 2900], [5100, 1600]]],
  },
  flooded: {
    theme: 'pripyat', wbias: { rain: 4, fog: 2.5, storm: 1.4, heat: 0, snow: 0.2 }, hills: 1, flood: 1, boats: 8,
    river: [[0, 3300], [800, 3500], [1600, 3200], [2400, 3500], [3200, 3300], [4000, 3600], [4800, 3300], [5600, 3500], [6400, 3200]],
    regions: [
      { id: 'embank', name: 'Embankment', x: 3200, y: 5600, g: [86, 92, 80], a: [74, 80, 70], danger: 1, trees: 0.2, dead: 0.3, kind: 'village', anoms: ['spring', 'electro', 'fuzz', 'acid'] },
      { id: 'drowned', name: 'Drowned Blocks', x: 1400, y: 4400, g: [76, 86, 84], a: [62, 72, 72], danger: 3, trees: 0.05, dead: 0.4, water: 1, cracks: 1, kind: 'town', anoms: ['electro', 'acid', 'geyser', 'mirror'] },
      { id: 'port', name: 'River Port', x: 5000, y: 4400, g: [82, 90, 80], a: [70, 76, 70], danger: 3, trees: 0.05, dead: 0.4, water: 1, kind: 'port', anoms: ['electro', 'spring', 'acid', 'tesla'] },
      { id: 'square', name: 'Sunken Square', x: 3100, y: 2300, g: [88, 90, 86], a: [72, 76, 72], danger: 4, trees: 0.05, dead: 0.3, water: 1, kind: 'town', anoms: ['psifield', 'mirror', 'electro', 'teleport'] },
      { id: 'lagoon', name: 'Glowing Lagoon', x: 1300, y: 1400, g: [60, 90, 86], a: [48, 76, 72], danger: 5, trees: 0.02, dead: 0.3, water: 1, reeds: 1, anoms: ['acid', 'psifield', 'timeloop', 'geyser'] },
      { id: 'pumps', name: 'Pumping Station', x: 5100, y: 1500, g: [96, 96, 92], a: [80, 82, 76], danger: 4, trees: 0.03, dead: 0.3, cracks: 1, kind: 'factory', anoms: ['electro', 'tesla', 'magnet', 'burner'] },
    ],
    spawns: [
      { name: 'Embankment Camp', x: 3200, y: 5900, icon: '🌊', desc: 'Dry ground by the flood wall. Boats nearby.' },
      { name: 'Port Pier', x: 5000, y: 4900, icon: '🚤', desc: 'A pier with a working boat. Water all around.' },
      { name: 'Rooftop', x: 1400, y: 4900, icon: '🏢', desc: 'Above the drowned blocks. Mutants swim here.' },
    ],
    roads: [[[3200, 6400], [3200, 4400], [3100, 2300], [5100, 1500]], [[1400, 4400], [3200, 4400], [5000, 4400]], [[1300, 1400], [3100, 2300]]],
  },
  duga: {
    theme: 'pripyat', wbias: { psi: 3, fog: 1.6, rain: 1, heat: 0.4 }, hills: 3, duga: 1,
    rail: [[0, 4700], [3000, 4600], [6400, 4800]],
    regions: [
      { id: 'forest', name: 'Red Pine Forest', x: 3200, y: 5700, g: [70, 78, 52], a: [84, 70, 50], danger: 1, trees: 0.45, dead: 0.3, pine: 0.8, kind: 'village', anoms: ['spring', 'fuzz', 'electro', 'sound'] },
      { id: 'array', name: 'Antenna Array', x: 3200, y: 2600, g: [92, 94, 88], a: [80, 84, 76], danger: 4, trees: 0.05, dead: 0.3, cracks: 1, kind: 'factory', anoms: ['tesla', 'electro', 'psifield', 'magnet'] },
      { id: 'barracks', name: 'Circle Barracks', x: 1300, y: 4200, g: [84, 88, 76], a: [72, 78, 66], danger: 3, trees: 0.2, dead: 0.3, kind: 'town', anoms: ['electro', 'gas', 'mirror', 'fuzz'] },
      { id: 'kindergarten', name: 'Pioneer Camp', x: 5100, y: 4300, g: [88, 94, 70], a: [76, 82, 62], danger: 3, trees: 0.3, dead: 0.3, kind: 'village', anoms: ['psifield', 'sound', 'fuzz', 'teleport'] },
      { id: 'command', name: 'Command Post', x: 5100, y: 1300, g: [96, 96, 92], a: [82, 82, 78], danger: 5, trees: 0.05, dead: 0.3, cracks: 1, kind: 'ruins', anoms: ['psifield', 'tesla', 'timeloop', 'mincer'] },
      { id: 'bog', name: 'Radar Bog', x: 1300, y: 1500, g: [60, 70, 54], a: [52, 60, 48], danger: 4, trees: 0.15, dead: 0.6, reeds: 1, water: 1, anoms: ['acid', 'psifield', 'gas', 'electro'] },
    ],
    spawns: [
      { name: 'Forest Road', x: 3200, y: 5900, icon: '🌲', desc: 'Quiet pines. The giant radar looms to the north.' },
      { name: 'Pioneer Camp', x: 5100, y: 4700, icon: '🏕️', desc: 'Abandoned summer camp. Psi fields nearby.' },
      { name: 'Barracks', x: 1300, y: 4600, icon: '🪖', desc: 'Military barracks west of the array.' },
    ],
    roads: [[[3200, 6400], [3200, 4400], [3200, 2600], [5100, 1300]], [[1300, 4200], [3200, 4400], [5100, 4300]], [[1300, 1500], [3200, 2600]]],
  },
  noosphere: {
    theme: 'lab', wbias: { psi: 4, rain: 0, snow: 0, heat: 0, storm: 0.3, fog: 0.8, radstorm: 0.4 }, night: 0.55, hills: 6, space: 1,
    regions: [
      { id: 'shore', name: 'Shore of Dreams', x: 3200, y: 5600, g: [46, 40, 76], a: [36, 32, 62], danger: 2, trees: 0, dead: 0.1, anoms: ['spring', 'teleport', 'mirror', 'fuzz'] },
      { id: 'garden', name: 'Crystal Garden', x: 1300, y: 4300, g: [40, 66, 90], a: [30, 54, 78], danger: 3, trees: 0, dead: 0, anoms: ['cryo', 'mirror', 'tesla', 'teleport'] },
      { id: 'drift', name: 'Starfall Drift', x: 5100, y: 4300, g: [60, 38, 84], a: [48, 30, 70], danger: 3, trees: 0, dead: 0, anoms: ['comet', 'vortex', 'teleport', 'electro'] },
      { id: 'echo', name: 'Echo City', x: 3200, y: 2600, g: [70, 64, 96], a: [58, 52, 84], danger: 4, trees: 0, dead: 0.1, cracks: 1, kind: 'ruins', anoms: ['timeloop', 'mirror', 'psifield', 'flip'] },
      { id: 'void', name: 'The Void', x: 1300, y: 1300, g: [24, 20, 40], a: [16, 14, 30], danger: 5, trees: 0, dead: 0, anoms: ['vortex', 'psifield', 'mincer', 'timeloop'] },
      { id: 'heart', name: 'Heart of the Zone', x: 5100, y: 1300, g: [90, 40, 90], a: [74, 30, 76], danger: 5, trees: 0, dead: 0, red: 1, anoms: ['psifield', 'teleport', 'comet', 'flip'] },
    ],
    spawns: [
      { name: 'Dream Shore', x: 3200, y: 5900, icon: '🌌', desc: 'Where the dream begins. Everything floats a little.' },
      { name: 'Crystal Grove', x: 1300, y: 4700, icon: '💎', desc: 'Glowing crystals and slippery cold.' },
      { name: 'Starfall', x: 5100, y: 4700, icon: '☄️', desc: 'Falling stars light the way.' },
    ],
    roads: [],
  },
};
for (const k in W3_STAGES) {
  const S = W3_STAGES[k];
  for (const r of S.regions) { r.x *= MS; r.y *= MS; }
  for (const s of S.spawns) { s.x *= MS; s.y *= MS; }
  S.roads = S.roads.map(W2_SC);
  for (const key of ['river', 'rail', 'rail2', 'rail3']) S[key] = W2_SC(S[key]);
  STAGE_WORLD[k] = S;
}
STAGES.push(
  { id: 'flooded', name: 'Flooded Pripyat', icon: '🌊', desc: 'The city is under water. Take a boat — mutants swim here.', hpMul: 1.8, final: { id: 'serpent', name: 'THE DROWNED SERPENT', hp: 2.6 }, needs: 'pripyat' },
  { id: 'volcanic', name: 'Volcanic Zone', icon: '🌋', desc: 'Lava rivers, erupting pools and falling volcanic bombs.', hpMul: 2.0, final: { id: 'behemoth', name: 'THE MAGMA BEHEMOTH', hp: 2.8 }, needs: 'wasteland' },
  { id: 'duga', name: 'Duga Radar', icon: '📡', desc: 'The giant radar. Descend its 3-floor bunker and silence it.', hpMul: 2.2, final: { id: 'prime', name: 'THE DUGA BRAIN', hp: 2.8 }, needs: 'blackout' },
  { id: 'noosphere', name: 'Noosphere', icon: '🌌', desc: 'A dream beyond the Zone. Low gravity, stars and psi storms.', hpMul: 2.8, final: { id: 'monolith', name: 'THE NOOSPHERE', hp: 3 }, needs: 'mountain' },
);
VEH.boat = { name: 'Boat', spd: 2.3, ram: 22, icon: '🚤', boat: true };

// ----- seasons: the classic maps change with the seed -----
const SEASONS = {
  summer: { name: 'Summer', icon: '☀️', w: {} },
  autumn: { name: 'Autumn', icon: '🍂', tint: [150, 104, 44], k: 0.32, w: { rain: 2, fog: 1.6 }, sub: 'Golden leaves, rain and fog.' },
  winter: { name: 'Winter', icon: '❄️', tint: [226, 230, 238], k: 0.55, w: { snow: 5, heat: 0, rain: 0.3 }, sub: 'Snow covers the Zone. Stay warm.' },
  spring: { name: 'Spring', icon: '🌸', tint: [86, 150, 70], k: 0.22, w: { rain: 1.8, heat: 0.5 }, sub: 'Everything blooms. Even the anomalies.' },
};
const SEASON_STAGES = ['zone', 'pripyat', 'npp', 'zaton', 'blackout', 'flooded', 'duga'];
const W3 = { stage: () => STAGE_WORLD[World.stage] || {} };

LEVEL_KEYS.push('lavaPools');
const _w3NewLevel = World.newLevel;
World.newLevel = function (kind) { _w3NewLevel.call(this, kind); this.lavaPools = []; this.metroPts = null; };

const _w3GenStage = World.genStage;
World.genStage = function (stage, seed, spawnIdx) {
  const R = mulberry32((seed | 0) * 7 + 3), keys = Object.keys(SEASONS);
  this.season = SEASON_STAGES.includes(stage) ? keys[Math.floor(R() * keys.length)] : 'summer';
  this.seasonW = SEASONS[this.season].w;
  this.swimAll = !!(STAGE_WORLD[stage] || {}).flood;
  return _w3GenStage.call(this, stage, seed, spawnIdx);
};

// ground: lava river, flood water, season tint, noosphere glow
const _w3Ground = World.groundColor;
World.groundColor = function (x, y) {
  let c = _w3Ground.call(this, x, y);
  if (this.kind !== 'over') return c;
  const S = W3.stage(), v = this.riverAt(x, y);
  if (S.lava) {
    if (v === 2) { const n = vnoise(x / 50, y / 50, 7); c = mixc([255, 110, 20], [170, 30, 10], clamp(n * 1.4 - 0.2, 0, 1)); if (n > 0.72) c = [255, 210, 90]; }
    else if (v === 1) c = mixc(c, [40, 30, 28], 0.7);
    return c;
  }
  if (S.flood) { const reg = this.region(x, y); if (reg.water && !v && fbm(x / 260, y / 260, 5) > 0.47) { const n = vnoise(x / 40, y / 40, 3); c = mixc(c, [38, 62, 70], clamp((fbm(x / 260, y / 260, 5) - 0.47) * 14, 0.5, 0.9) + n * 0.05); } }
  if (S.space) { const n = vnoise(x / 9, y / 9, 13); if (n > 0.93) c = mixc(c, [230, 230, 255], 0.8); return c; }
  const se = SEASONS[this.season];
  if (se && se.tint && !v) { const reg = this.region(x, y); if (!reg.snow && !reg.sand) c = mixc(c, se.tint, se.k * (0.7 + fbm(x / 400, y / 400, 17) * 0.6)); }
  return c;
};
const _w3Water = World.isWater;
World.isWater = function (x, y) {
  if (this.kind !== 'over') return false;
  const S = W3.stage();
  if (S.lava && this.riverAt(x, y) === 2) return false; // lava burns, it does not slow
  if (S.flood) { const reg = this.region(x, y); if (reg.water && this.riverAt(x, y) !== 3 && fbm(x / 260, y / 260, 5) > 0.47) return true; }
  return _w3Water.call(this, x, y);
};
World.lavaAt = function (x, y) { return this.kind === 'over' && !!W3.stage().lava && this.riverAt(x, y) === 2; };

// ----- generation -----
const _w3Gen2 = World.genStage2;
World.genStage2 = function (stage, R) {
  _w3Gen2.call(this, stage, R);
  const S = W3.stage(), far = (x, y, d) => dist(x, y, this.start.x, this.start.y) > d;
  if (S.duga) { // the radar itself: a long wall of antennas
    const reg = this.regions.find((r) => r.id === 'array');
    for (let i = 0; i < 13; i++) { const x = reg.x - 1500 + i * 250, y = reg.y - 500 + Math.sin(i * 0.6) * 40; if (this.free(x, y, 40)) this.tower(x, y, 420 + (i % 3) * 60); }
    this.labels.push({ x: reg.x, y: reg.y - 700, name: '📡 DUGA' });
  }
  if (S.space) for (let i = 0; i < 40; i++) { const x = 600 + R() * (WORLD - 1200), y = 600 + R() * (WORLD - 1200), r = 26 + R() * 40; if (far(x, y, 600) && this.free(x, y, r + 10)) this.addRock(x, y, r, R); }
  if (S.lava) for (let i = 0, t = 0; i < 16 && t < 400; t++) {
    const x = 600 + R() * (WORLD - 1200), y = 600 + R() * (WORLD - 1200), r = 60 + R() * 50;
    if (!far(x, y, 1100) || !this.free(x, y, r + 20) || this.lavaPools.some((p) => dist(p.x, p.y, x, y) < 900)) continue;
    this.lavaPools.push({ x, y, r, t: 3 + R() * 6, seed: R() * 100 }); i++;
  }
};
// boats on the water; metro stairs on every surface map
const _w3Hatches = World.genHatches;
World.genHatches = function (R) {
  _w3Hatches.call(this, R);
  const S = W3.stage();
  if (S.duga && this.hatches.length) { // the nearest hatch to the array is the radar bunker (floor 1)
    const reg = this.regions.find((r) => r.id === 'array'), h = this.hatches.reduce((a, b) => (dist(b.x, b.y, reg.x, reg.y) < dist(a.x, a.y, reg.x, reg.y) ? b : a));
    h.idx = 100; h.name = 'Duga Bunker'; h.duga = true;
    const l = this.labels.find((l) => l.x === h.x && l.y === h.y + 40); if (l) l.name = '📡 Duga Bunker';
  }
  if (S.metro || S.space) return;
  const pts = [];
  for (let t = 0; t < 600 && pts.length < 2; t++) {
    const x = (700 + R() * 5000) * MS, y = (700 + R() * 5000) * MS;
    if (dist(x, y, this.start.x, this.start.y) < 1400 || !this.free(x, y, 80) || this.hatches.some((h) => dist(h.x, h.y, x, y) < 900)) continue;
    if (pts.length && dist(x, y, pts[0].x, pts[0].y) < 4200) continue;
    pts.push({ x, y });
  }
  if (pts.length < 2) return;
  pts.forEach((p, i) => {
    const h = { x: p.x, y: p.y, idx: 200, st: i, metro: true, name: 'Metro ' + (i ? 'B' : 'A') };
    this.hatches.push(h);
    this.addProp({ kind: 'metroStairs', x: p.x, y: p.y, sy: p.y - 30, h, bx0: p.x - 90, bx1: p.x + 90, by0: p.y - 130, by1: p.y + 50 });
    this.labels.push({ x: p.x, y: p.y + 44, name: '🚇 Metro ' + (i ? 'B' : 'A') });
  });
  this.metroPts = pts;
};
LEVEL_KEYS.push('metroPts');
const _w3W2 = World.genWorld2;
World.genWorld2 = function (R) {
  _w3W2.call(this, R);
  const S = W3.stage();
  // no green bushes on lava fields or in the dream; nothing growing out of flood water
  const bare = (p) => (p.kind === 'grass' || p.kind === 'bush' || p.kind === 'reeds') && (S.lava || S.space || (S.flood && this.isWater(p.x, p.y)));
  const gone = this.props.filter(bare);
  for (const p of gone) this.propCells(p, (c) => { const k = c.indexOf(p); if (k >= 0) c.splice(k, 1); });
  if (gone.length) { const g = new Set(gone); this.props = this.props.filter((p) => !g.has(p)); }
  const n = S.boats || (S.river && !S.lava ? 2 : 0), spots = [];
  for (let t = 0; t < 4000 && spots.length < n * 3; t++) { const x = 300 + R() * (WORLD - 600), y = 300 + R() * (WORLD - 600); if (this.isWater(x, y) && this.isWater(x + 40, y) && this.isWater(x - 40, y)) spots.push([x, y]); }
  if (S.flood) spots.sort((a, b) => dist(a[0], a[1], this.start.x, this.start.y) - dist(b[0], b[1], this.start.x, this.start.y)); // one boat close to the spawn
  const used = [];
  for (const [x, y] of spots) {
    if (used.length >= n) break;
    if (dist(x, y, this.start.x, this.start.y) < 250 || used.some((u) => dist(u[0], u[1], x, y) < 1500)) continue;
    this.vehicles.push({ kind: 'boat', x, y, a: R() * TAU, fuel: 100, hp: 1 }); used.push([x, y]);
  }
};

// ----- metro tunnel level (one per run, two stations) and the Duga floors -----
World.genMetroTunnel = function () {
  this.newLevel('lab');
  const R = mulberry32(this.seed * 17 + 4242); this.R = R;
  const N = LAB_N, T = LAB_T, grid = new Uint8Array(N * N);
  this.regions = [{ id: 'lab', name: 'Metro Tunnels', x: 1280, y: 1280, g: [58, 56, 54], a: [48, 46, 44], danger: 3, trees: 0, anoms: ['electro', 'gas', 'acid'] }];
  this.regionGrid = new Int8Array((WORLD / 64) ** 2);
  const room = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y * N + x] = 1; const r = { x0, y0, w, h, mx: Math.floor(x0 + w / 2), my: Math.floor(y0 + h / 2) }; return r; };
  const A = room(1, 12, 7, 7), B = room(24, 12, 7, 7);
  room(8, 14, 16, 3); // main tunnel
  const s1 = room(11, 3, 6, 6), s2 = room(17, 23, 6, 6), s3 = room(3, 24, 5, 5);
  room(13, 9, 2, 5); room(19, 17, 2, 6); room(5, 19, 2, 5);
  const rooms = [A, s1, s2, s3, B];
  this.lab = { idx: 200, metro: true, grid, rooms, name: 'METRO', start: { x: (A.mx + 0.5) * T, y: (A.my + 0.5) * T }, stB: { x: (B.mx + 0.5) * T, y: (B.my + 0.5) * T },
    bossRoom: s2, bossSpawned: false, cleared: false, flow: new Int16Array(N * N), floor: [] };
  for (let i = 0; i < N * N; i++) if (grid[i]) this.lab.floor.push(i);
  this.labWalls(grid);
  const up = this.levels.over && this.levels.over.metroPts || this.metroPts || [];
  [A, B].forEach((r, i) => {
    const x = (r.mx + 0.5) * T, y = (r.my + 0.5) * T - 20, p = up[i] || { x: this.start.x, y: this.start.y };
    const h = { x, y, idx: -201 - i, name: 'Stairs up · ' + (i ? 'B' : 'A'), up: { x: p.x, y: p.y + 90 } };
    this.hatches.push(h);
    this.addProp({ kind: 'metroStairs', x, y, sy: y - 30, h, bx0: x - 90, bx1: x + 90, by0: y - 130, by1: y + 50 });
  });
  for (const r of [s1, s3]) this.makeField((r.mx + 0.5) * T, (r.my + 0.5) * T, pick(['electro', 'gas', 'acid', 'burner']), 2, Math.min(r.w, r.h) * T * 0.35, R);
  for (let k = 0; k < 5; k++) this.crateSpots.push({ x: (12 + k * 2.5) * T, y: 15.5 * T + (k % 2 ? -T : T) * 0.6 });
  this.crateSpots.push({ x: (s1.mx + 0.5) * T, y: (s1.y0 + 0.8) * T }, { x: (s3.mx + 0.5) * T, y: (s3.y0 + 0.8) * T });
  this.labels.push({ x: (s2.mx + 0.5) * T, y: (s2.my + 0.5) * T, name: '☠ Tunnel Lurker' });
  this.dark = 0.85;
  this.buildMap();
  return this.snapshot();
};
World.labWalls = function (grid) {
  const N = LAB_N, T = LAB_T, active = new Map();
  const flush = (key) => { const r = active.get(key); active.delete(key); this.labWall(r.x0 * T, r.y0 * T, (r.x1 - r.x0) * T, (r.y1 - r.y0) * T); };
  for (let y = 0; y <= N; y++) {
    const runs = new Set();
    if (y < N) { let x = 0; while (x < N) { if (!grid[y * N + x]) { const s = x; while (x < N && !grid[y * N + x]) x++; const key = s + ',' + x; runs.add(key); if (active.has(key)) active.get(key).y1 = y + 1; else active.set(key, { x0: s, x1: x, y0: y, y1: y + 1 }); } else x++; } }
    for (const key of [...active.keys()]) if (!runs.has(key)) flush(key);
  }
  this.addOb({ t: 1, x: N * T, y: 0, w: WORLD - N * T, h: WORLD }); this.addOb({ t: 1, x: 0, y: N * T, w: N * T, h: WORLD - N * T });
};
const _w3GenLab = World.genLab;
World.genLab = function (idx) {
  if (idx === 200) return this.genMetroTunnel();
  if (idx >= 100 && idx < 110) {
    const lvl = _w3GenLab.call(this, idx), f = idx - 99;
    this.lab.name = 'DUGA FLOOR ' + f; this.lab.duga = f; this.regions[0].name = 'Duga Bunker · Floor ' + f;
    const lb = this.labels.find((l) => l.name === '☠ Guardian'); if (lb) lb.name = f === 3 ? '☠ Duga Brain Core' : '☠ Floor Guardian';
    this.dark = 0.9 + f * 0.02;
    return lvl;
  }
  return _w3GenLab.call(this, idx);
};

// ----- travelling: metro stairs, Duga stairs down, metro exits -----
const _w3Hatch = useHatch;
useHatch = function (h) {
  if (h.metro || h.up || h.stairs) {
    if (P.veh) { const v = P.veh; P.veh = null; v.x = h.x + 70; v.y = h.y + 30; P.vehSkip = v; }
    Sfx.play('hatch');
    if (h.up) { goLevel('over', h.up); banner('🚇 BACK ON THE SURFACE', 'Metro ' + (h.idx === -201 ? 'A' : 'B'), 2); return; }
    if (h.metro) {
      G.returnPos = { x: h.x, y: h.y + 90 };
      goLevel('lab200');
      if (h.st && World.lab && World.lab.stB) { P.x = World.lab.stB.x; P.y = World.lab.stB.y + 70; World.collide(P); CAM.x = P.x; CAM.y = P.y; }
      banner('🚇 METRO TUNNELS', 'Cross the tunnel to come out at the other station — a shortcut across the map.', 3.5, '', 2);
      return;
    }
    const rp = G.returnPos; goLevel('lab' + h.idx); G.returnPos = rp; // stairs deeper into Duga
    banner('📡 DUGA · FLOOR ' + (h.idx - 99), h.idx === 102 ? 'The brain core is somewhere down here. Silence it!' : 'Deeper. Find the guardian to open the next stairs.', 3.5, 'bad', 2);
    return;
  }
  _w3Hatch(h);
  if (h.duga && World.lab && World.lab.duga) banner('📡 DUGA · FLOOR 1', 'Three floors down lies the brain core. Each guardian opens the next stairs.', 4, 'bad', 2);
};
PROP_DRAW.metroStairs = function (p) {
  const x = p.x, y = p.y, up = !!p.h.up;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 46, y - 18, 96, 44);
  ctx.fillStyle = '#6a6660'; ctx.fillRect(x - 44, y - 22, 88, 40);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#3a3834' : '#4a4640'; ctx.fillRect(x - 36, y - 18 + i * 7, 72, 7); }
  ctx.fillStyle = '#0c0c0c'; ctx.fillRect(x - 36, y + 12, 72, 5);
  ctx.fillStyle = '#b8342a'; ctx.beginPath(); ctx.arc(x, y - 62, 15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('M', x, y - 55);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 47); ctx.lineTo(x, y - 22); ctx.stroke();
  ctx.font = 'bold 12px Oswald, sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(p.h.name.toUpperCase(), x + 1, y + 37);
  ctx.fillStyle = up ? '#9fe8a0' : '#ffcf6a'; ctx.fillText(p.h.name.toUpperCase(), x, y + 36);
};
const _w3DrawVeh = drawVehicle;
drawVehicle = function (v, x, y) {
  if (v.kind !== 'boat') return _w3DrawVeh(v, x, y);
  const fx = Math.cos(v.a) >= 0 ? 1 : -1;
  ctx.fillStyle = 'rgba(200,230,240,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 48, 13, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.scale(fx, 1);
  ctx.fillStyle = '#6a4a2e'; ctx.beginPath(); ctx.moveTo(-40, -14); ctx.lineTo(34, -14); ctx.lineTo(46, -22); ctx.lineTo(38, -2); ctx.lineTo(-36, -2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e2d0'; ctx.fillRect(-36, -13, 70, 3);
  ctx.fillStyle = '#333'; ctx.fillRect(-46, -20, 8, 12);
  ctx.restore();
};

// ----- runtime -----
const W3R = { bombs: [], bombT: 45, pulseT: 70, pulseWarn: 0, lavaAcc: 0, lavaMsgT: 0, dugaDone: false, seasonShown: false };
const _w3Reset = W2.reset.bind(W2);
W2.reset = function () { _w3Reset(); Object.assign(W3R, { bombs: [], bombT: 45, pulseT: 70, pulseWarn: 0, lavaAcc: 0, lavaMsgT: 0, dugaDone: false, seasonShown: false }); };
const _w3Update = W2.update.bind(W2);
W2.update = function (dt) {
  _w3Update(dt);
  const W = World, S = W3.stage();
  if (!W3R.seasonShown && G.t > 6) { W3R.seasonShown = true; const se = SEASONS[W.season]; if (se && se.sub) banner(se.icon + ' ' + se.name.toUpperCase(), se.sub, 3); }
  // Duga: each cleared floor opens stairs down; the third floor silences the radar
  if (W.kind === 'lab' && W.lab && W.lab.duga && W.lab.cleared && !W.lab.stairsDone) {
    W.lab.stairsDone = true;
    const r = W.lab.bossRoom, x = (r.mx + 0.5) * LAB_T, y = (r.my + 0.5) * LAB_T + 60;
    if (W.lab.duga < 3) {
      const h = { x, y, idx: 100 + W.lab.duga, stairs: true, name: 'Stairs down · Floor ' + (W.lab.duga + 1) };
      W.hatches.push(h); W.addProp({ kind: 'hatch', x, y, sy: y - 30, h, bx0: x - 80, bx1: x + 80, by0: y - 120, by1: y + 50 });
      banner('⬇ STAIRS DOWN OPEN', 'Floor ' + (W.lab.duga + 1) + ' awaits below.', 3, 'good', 2);
    } else if (!W3R.dugaDone) { W3R.dugaDone = true; G.rubles += 600; banner('📡 DUGA SILENCED', 'The radar falls quiet. +600 rubles and the brain core\'s loot.', 5, 'good', 2); for (let i = 0; i < 3; i++) G.pickups.push({ type: 'labstash', x: x + (i - 1) * 60, y: y + 40, t: 0 }); }
  }
  if (W.kind !== 'over') return;
  if (S.duga && !W3R.dugaDone) { // the radar hums: a mild psi pulse with a warning first
    W3R.pulseT -= dt;
    if (W3R.pulseT < 4 && !W3R.pulseWarn) { W3R.pulseWarn = 1; banner('📡 DUGA PULSE IN 4s', 'A psi wave will slow you briefly.', 2.5, 'bad'); }
    if (W3R.pulseT <= 0) { W3R.pulseT = rand(75, 100); W3R.pulseWarn = 0; if (!P.psiImmune) P.psiSlowT = Math.max(P.psiSlowT || 0, 2); G.fx.push({ k: 'boom', x: P.x, y: P.y, r: 500, life: 0.6, max: 0.6 }); Sfx.play('psi'); }
  }
  if (S.lava) {
    // standing in lava burns; mutants burn too
    if (W.lavaAt(P.x, P.y) && !P.veh && !(P.z > 0)) {
      W3R.lavaAcc += 22 * dt;
      if (W3R.lavaAcc > 4) { hurtPlayer(W3R.lavaAcc, 'lava', true, 'anomaly'); W3R.lavaAcc = 0; }
      if (NOW - W3R.lavaMsgT > 2) { W3R.lavaMsgT = NOW; text(P.x, P.y - 60, 'LAVA! GET OUT!', '#ff8a3a', false, true); }
    } else W3R.lavaAcc = Math.max(0, W3R.lavaAcc - dt * 4);
    for (const e of G.enemies) if (!e.dead && !e.boss && !e.d.fly && Math.abs(e.x - P.x) < 1200 && Math.abs(e.y - P.y) < 900 && W.lavaAt(e.x, e.y)) { e.burnT = Math.max(e.burnT, 1); e.burnDps = Math.max(e.burnDps || 0, 14); }
    // erupting lava pools (they bubble first)
    for (const p of W.lavaPools) {
      if (Math.abs(p.x - P.x) > 1600 || Math.abs(p.y - P.y) > 1200) continue;
      p.t -= dt;
      if (p.t <= 0) {
        p.t = rand(6, 11);
        if (dist(p.x, p.y, P.x, P.y) < p.r * 1.35 + P.r && !(P.z > 0)) hurtPlayer(14, 'a lava eruption', false, 'anomaly');
        EG.query(p.x, p.y, p.r * 1.4, TMP3); for (const e of TMP3) if (!e.dead && dist(e.x, e.y, p.x, p.y) < p.r * 1.35 + e.r) hurtEnemy(e, 45, 0, 0, true, false);
        burst(p.x, p.y, 30, '255,140,40', p.r * 3, { add: true, s: 5, life: 0.8 }); if (dist(p.x, p.y, P.x, P.y) < 900) shake(3);
      }
    }
    // volcanic bombs: three clearly marked circles
    W3R.bombT -= dt;
    if (W3R.bombT <= 0 && G.t > 60 && !G.tutorial) {
      W3R.bombT = rand(38, 55);
      if (!W3R.bombTold) { W3R.bombTold = 1; banner('🌋 VOLCANIC BOMBS', 'Step out of the red circles!', 2.5, 'bad'); }
      for (let i = 0; i < 3; i++) { const a = rand(TAU), d = i === 0 ? rand(0, 60) : rand(160, 340); W3R.bombs.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * 0.7, t: 1.9 + i * 0.35, T: 1.9 + i * 0.35 }); }
    }
    for (const b of W3R.bombs) { b.t -= dt; if (b.t <= 0) { b.done = 1; explode(b.x, b.y, 90, 26, false); } }
    W3R.bombs = W3R.bombs.filter((b) => !b.done);
  }
};
// floating in the noosphere: movement drifts a little, like low gravity
World.glide = function () { return this.kind === 'over' && W3.stage().space ? 4.5 : 0; };

// ----- drawing -----
const _w3Top = drawW2Top;
drawW2Top = function (x0, y0, x1, y1) {
  _w3Top(x0, y0, x1, y1);
  const W = World;
  if (W.kind !== 'over') return;
  for (const p of W.lavaPools || []) {
    if (p.x < x0 - 200 || p.x > x1 + 200 || p.y < y0 - 200 || p.y > y1 + 200) continue;
    const warn = p.t < 1.3, pulse = 0.5 + Math.sin(NOW * (warn ? 18 : 3) + p.seed) * 0.5;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.3); g.addColorStop(0, `rgba(255,${warn ? 230 : 160},60,${0.75 + pulse * 0.2})`); g.addColorStop(0.7, 'rgba(200,50,10,0.6)'); g.addColorStop(1, 'rgba(60,10,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.3, p.r * 0.8, 0, 0, TAU); ctx.fill();
    if (warn) { ctx.strokeStyle = `rgba(255,80,40,${0.5 + pulse * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.35, p.r * 0.84, 0, 0, TAU); ctx.stroke(); }
    if (Math.random() < 0.15) part(p.x + rand(-p.r, p.r) * 0.6, p.y + rand(-p.r, p.r) * 0.35, { z: 2, vz: 60, g: 40, c: '255,170,60', add: true, s: 3, life: 0.6 });
  }
  for (const b of W3R.bombs) {
    const k = 1 - b.t / b.T;
    ctx.strokeStyle = `rgba(255,60,40,${0.5 + k * 0.5})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(b.x, b.y, 90, 56, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,60,40,${0.12 + k * 0.2})`; ctx.beginPath(); ctx.ellipse(b.x, b.y, 90 * k, 56 * k, 0, 0, TAU); ctx.fill();
    const z = b.t * 520; ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.arc(b.x, b.y - z, 12, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,140,40,0.8)'; ctx.beginPath(); ctx.arc(b.x, b.y - z, 6, 0, TAU); ctx.fill();
  }
  if (W.swimAll) for (const e of G.enemies) { // swimming mutants leave ripples
    if (e.dead || e.d.fly || e.x < x0 - 40 || e.x > x1 + 40 || e.y < y0 - 40 || e.y > y1 + 40 || !W.isWater(e.x, e.y)) continue;
    ctx.fillStyle = 'rgba(40,70,80,0.55)'; ctx.beginPath(); ctx.ellipse(e.x, e.y - 2, e.r * 1.2, e.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,240,0.5)'; ctx.lineWidth = 1.5; const s = 1 + ((NOW * 1.5 + e.seed) % 1) * 0.5; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.3 * s, e.r * 0.5 * s, 0, 0, TAU); ctx.stroke();
  }
};
const _w3Screen = drawW2Screen;
drawW2Screen = function (cx, cy, title) {
  _w3Screen(cx, cy, title);
  if (World.kind !== 'over') return;
  const S = W3.stage();
  if (S.lava) { // drifting ash
    ctx.fillStyle = 'rgba(190,180,170,0.5)';
    for (let i = 0; i < 46; i++) { const x = ((i * 137.5 + NOW * (14 + (i % 5) * 4) - cx * 0.2) % VW + VW) % VW, y = ((i * 91.3 + NOW * (24 + (i % 7) * 3) - cy * 0.2) % VH + VH) % VH; ctx.fillRect(x, y, 2, 2); }
    ctx.fillStyle = 'rgba(255,90,20,0.06)'; ctx.fillRect(0, 0, VW, VH);
  }
  if (S.space) { // stars and a slow aurora
    for (let i = 0; i < 70; i++) { const x = ((i * 211.7 - cx * 0.05) % VW + VW) % VW, y = ((i * 97.1 - cy * 0.05) % VH + VH) % VH, a = 0.3 + 0.5 * Math.abs(Math.sin(NOW * 1.3 + i)); ctx.fillStyle = `rgba(230,230,255,${a})`; ctx.fillRect(x, y, i % 9 ? 1.5 : 2.5, i % 9 ? 1.5 : 2.5); }
    const g = ctx.createLinearGradient(0, 0, VW, VH * 0.5); g.addColorStop(0, `rgba(120,60,220,${0.08 + Math.sin(NOW * 0.4) * 0.04})`); g.addColorStop(0.5, 'rgba(60,200,220,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  if (World.season === 'autumn' || World.season === 'spring') { // leaves / petals
    const c = World.season === 'autumn' ? ['#c8742a', '#a85a20', '#d8a040'] : ['#f0b0d0', '#ffffff', '#e890c0'];
    for (let i = 0; i < 18; i++) { const x = ((i * 173.3 + NOW * (30 + i % 4 * 8) - cx * 0.3) % VW + VW) % VW, y = ((i * 131.7 + NOW * (22 + i % 3 * 6) - cy * 0.3) % VH + VH) % VH; ctx.fillStyle = c[i % 3]; ctx.save(); ctx.translate(x, y); ctx.rotate(NOW * 2 + i); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
  }
};
