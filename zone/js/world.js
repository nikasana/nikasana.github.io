'use strict';
// ---------- the Zone: stage generation, labs, ground, obstacles, props ----------
// maps are authored in a 6400-unit design space and scaled up by MS (4x the original area)
const MS = 2, WORLD = 6400 * MS, CHUNK = 512, OBCELL = 128, PCELL = 256, LAB_T = 80, LAB_N = 32;
const START = { x: 3200 * MS, y: 5650 * MS };

// region attributes: trees (density), dead (fraction dead trees), pine, red, reeds, water, cracks, anoms
const STAGE_WORLD = {
  zone: {
    regions: [
      { id: 'cordon', name: 'Cordon', x: 3200, y: 5500, g: [112, 118, 66], a: [132, 112, 74], danger: 1, trees: 0.16, dead: 0.12, anoms: ['spring', 'electro', 'acid', 'fuzz'] },
      { id: 'swamp', name: 'Great Swamps', x: 900, y: 4300, g: [70, 84, 58], a: [58, 72, 50], danger: 2, trees: 0.18, dead: 0.7, reeds: 1, water: 1, anoms: ['acid', 'electro', 'gas', 'fuzz'] },
      { id: 'swamp', name: 'Great Swamps', x: 1000, y: 5900, g: [70, 84, 58], a: [58, 72, 50], danger: 2, trees: 0.18, dead: 0.7, reeds: 1, water: 1, anoms: ['acid', 'electro', 'spring'] },
      { id: 'valley', name: 'Dark Valley', x: 2900, y: 3600, g: [60, 78, 50], a: [78, 74, 54], danger: 2, trees: 0.45, dead: 0.12, pine: 0.6, anoms: ['spring', 'vortex', 'acid', 'teleport', 'cryo'] },
      { id: 'factory', name: 'Rostok Factory', x: 5400, y: 4100, g: [104, 102, 96], a: [90, 94, 74], danger: 3, trees: 0.06, dead: 0.3, cracks: 1, anoms: ['electro', 'burner', 'tesla', 'gas'] },
      { id: 'factory', name: 'Agroprom', x: 5500, y: 5800, g: [104, 102, 96], a: [90, 94, 74], danger: 3, trees: 0.06, dead: 0.3, cracks: 1, anoms: ['electro', 'burner', 'acid'] },
      { id: 'garbage', name: 'The Garbage', x: 4300, y: 2600, g: [102, 90, 66], a: [84, 80, 60], danger: 3, trees: 0.05, dead: 0.7, anoms: ['vortex', 'spring', 'burner', 'mincer', 'comet'] },
      { id: 'red', name: 'Red Forest', x: 1400, y: 1500, g: [120, 72, 46], a: [98, 58, 40], danger: 4, trees: 0.55, dead: 0.12, red: 1, anoms: ['burner', 'electro', 'vortex', 'comet', 'mincer'] },
      { id: 'wild', name: 'Wild Territory', x: 2700, y: 2000, g: [88, 94, 62], a: [104, 96, 70], danger: 3, trees: 0.3, dead: 0.12, pine: 0.6, anoms: ['vortex', 'electro', 'spring', 'cryo', 'psifield'] },
      { id: 'radar', name: 'The Radar', x: 4800, y: 900, g: [84, 88, 78], a: [68, 72, 64], danger: 5, trees: 0.1, dead: 0.7, cracks: 1, anoms: ['electro', 'burner', 'vortex', 'acid', 'psifield', 'tesla'] },
      { id: 'warehouse', name: 'Army Warehouses', x: 600, y: 2800, g: [70, 88, 58], a: [84, 90, 64], danger: 3, trees: 0.4, dead: 0.15, pine: 0.8, anoms: ['cryo', 'spring', 'teleport', 'electro'] },
      { id: 'yantar', name: 'Yantar', x: 6000, y: 2900, g: [96, 96, 70], a: [80, 86, 76], danger: 4, trees: 0.12, dead: 0.6, water: 1, reeds: 1, anoms: ['psifield', 'gas', 'acid', 'mincer'] },
      { id: 'deadcity', name: 'Dead City', x: 1900, y: 5000, g: [100, 96, 88], a: [86, 84, 74], danger: 3, trees: 0.08, dead: 0.5, cracks: 1, anoms: ['fuzz', 'gas', 'burner', 'teleport'] },
      { id: 'limansk', name: 'Limansk', x: 2600, y: 800, g: [92, 94, 90], a: [76, 80, 70], danger: 5, trees: 0.12, dead: 0.3, cracks: 1, anoms: ['teleport', 'comet', 'mincer', 'tesla'] },
      { id: 'jupiter', name: 'Jupiter', x: 6000, y: 1400, g: [104, 100, 90], a: [88, 90, 74], danger: 4, trees: 0.08, dead: 0.4, cracks: 1, anoms: ['tesla', 'comet', 'cryo', 'burner'] },
    ],
    spawns: [
      { name: 'Rookie Village', x: 3200, y: 5650, icon: '🏘️', desc: 'Quiet Cordon start. Weakest mutants nearby.' },
      { name: 'Clear Sky Camp', x: 1100, y: 5300, icon: '🌿', desc: 'Deep in the Great Swamps, among acid fields.' },
      { name: 'Rostok Bar', x: 5300, y: 4700, icon: '🍺', desc: 'Duty stronghold by the factory. More electro anomalies.' },
      { name: 'Freedom Base', x: 900, y: 3000, icon: '🍀', desc: 'Army Warehouses, next to the Red Forest.' },
      { name: 'Yantar Bunker', x: 5800, y: 3300, icon: '🔬', desc: 'Scientists at the lake. Dangerous psi zone.' },
    ],
    roads: [
      [[3200, 6500], [3220, 5900], [3150, 5400], [3050, 4700], [2950, 4000], [2980, 3400], [3400, 3000], [4200, 2650], [4500, 2000], [4700, 1400], [4800, 900]],
      [[3100, 4700], [2400, 4650], [1700, 4500], [1000, 4400], [400, 4500]],
      [[2980, 3400], [2500, 2800], [2000, 2300], [1500, 1700], [1100, 1100]],
      [[4200, 2650], [4800, 3200], [5300, 3900], [5500, 4700], [5500, 5800], [5200, 6500]],
      [[3150, 5400], [4000, 5550], [4800, 5700], [5500, 5800]],
      [[1000, 4400], [1100, 5200], [1000, 5900]],
      [[1700, 4500], [1000, 3600], [600, 2800], [900, 2000], [1500, 1700]],
      [[4800, 3200], [5600, 3000], [6000, 2900], [6100, 2200], [6000, 1400], [5400, 1300], [4700, 1400]],
      [[2400, 4650], [1900, 5000], [1300, 5600]],
      [[2000, 2300], [2400, 1400], [2600, 800], [3800, 700], [4800, 900]],
    ],
  },
  pripyat: {
    regions: [
      { id: 'outskirts', name: 'Overgrown Outskirts', x: 3200, y: 5700, g: [84, 100, 60], a: [100, 104, 66], danger: 2, trees: 0.35, dead: 0.2, anoms: ['spring', 'acid', 'electro'] },
      { id: 'city', name: 'Pripyat Center', x: 3200, y: 3300, g: [96, 96, 92], a: [84, 90, 72], danger: 4, trees: 0.08, dead: 0.3, cracks: 1, anoms: ['electro', 'burner', 'vortex', 'teleport', 'psifield'] },
      { id: 'city', name: 'Residential Blocks', x: 1600, y: 2400, g: [94, 94, 88], a: [80, 88, 66], danger: 3, trees: 0.1, dead: 0.3, cracks: 1, anoms: ['electro', 'spring', 'acid', 'fuzz', 'gas'] },
      { id: 'city', name: 'Residential Blocks', x: 4800, y: 2400, g: [94, 94, 88], a: [80, 88, 66], danger: 3, trees: 0.1, dead: 0.3, cracks: 1, anoms: ['vortex', 'spring', 'burner', 'cryo'] },
      { id: 'park', name: 'Amusement Park', x: 3200, y: 1300, g: [74, 90, 56], a: [92, 98, 62], danger: 4, trees: 0.3, dead: 0.3, anoms: ['vortex', 'electro', 'burner', 'comet', 'teleport'] },
      { id: 'port', name: 'River Port', x: 900, y: 4400, g: [70, 84, 78], a: [60, 74, 70], danger: 3, trees: 0.12, dead: 0.6, reeds: 1, water: 1, anoms: ['acid', 'electro'] },
      { id: 'jupiter', name: 'Jupiter Plant', x: 5400, y: 4500, g: [104, 102, 96], a: [90, 94, 74], danger: 4, trees: 0.05, dead: 0.5, cracks: 1, anoms: ['burner', 'electro', 'vortex', 'tesla', 'comet'] },
      { id: 'hospital', name: 'Hospital District', x: 5600, y: 1300, g: [98, 96, 92], a: [86, 86, 78], danger: 5, trees: 0.06, dead: 0.4, cracks: 1, anoms: ['psifield', 'gas', 'fuzz', 'mincer'] },
      { id: 'forest', name: 'Red Woods', x: 700, y: 1400, g: [120, 72, 46], a: [98, 58, 40], danger: 4, trees: 0.5, dead: 0.15, red: 1, anoms: ['comet', 'burner', 'cryo', 'teleport'] },
    ],
    spawns: [
      { name: 'Overgrown Outskirts', x: 3200, y: 5800, icon: '🌳', desc: 'South edge of the city.' },
      { name: 'River Port', x: 900, y: 4800, icon: '⚓', desc: 'Docks and reeds in the west.' },
      { name: 'Jupiter Gate', x: 5500, y: 5300, icon: '🏭', desc: 'Industrial east, heavy anomalies.' },
      { name: 'Stadium', x: 4700, y: 3000, icon: '🏟️', desc: 'Right in the city. Very dangerous.' },
    ],
    roads: (() => {
      const r = [[[3200, 6500], [3200, 700]]];
      for (const x of [1200, 2200, 4200, 5200]) r.push([[x, 900], [x, 4800]]);
      for (const y of [1000, 1900, 2800, 3700, 4700]) r.push([[500, y], [5900, y]]);
      return r;
    })(),
  },
  npp: {
    regions: [
      { id: 'approach', name: 'Southern Approach', x: 3200, y: 5700, g: [96, 92, 70], a: [110, 96, 70], danger: 3, trees: 0.2, dead: 0.5, anoms: ['spring', 'electro', 'burner', 'fuzz'] },
      { id: 'plant', name: 'Reactor Complex', x: 3200, y: 1700, g: [100, 100, 96], a: [86, 88, 84], danger: 5, trees: 0.02, dead: 1, cracks: 1, anoms: ['electro', 'burner', 'vortex', 'acid', 'mincer', 'tesla'] },
      { id: 'yard', name: 'Contaminated Yard', x: 1500, y: 3200, g: [110, 86, 60], a: [96, 70, 50], danger: 4, trees: 0.2, dead: 0.4, red: 1, anoms: ['burner', 'vortex', 'acid', 'gas', 'comet'] },
      { id: 'cooling', name: 'Cooling Pond', x: 5000, y: 3400, g: [68, 80, 78], a: [58, 70, 70], danger: 4, trees: 0.12, dead: 0.6, water: 1, reeds: 1, anoms: ['acid', 'electro', 'spring', 'cryo', 'teleport'] },
      { id: 'yard', name: 'Burial Grounds', x: 4800, y: 5400, g: [104, 94, 66], a: [92, 80, 58], danger: 4, trees: 0.1, dead: 0.8, anoms: ['vortex', 'burner', 'spring', 'fuzz', 'mincer'] },
      { id: 'forest', name: 'Dead Forest', x: 1200, y: 5400, g: [118, 74, 48], a: [98, 60, 42], danger: 3, trees: 0.5, dead: 0.3, red: 1, anoms: ['burner', 'electro', 'vortex', 'comet', 'fuzz'] },
      { id: 'duga', name: 'Duga Array', x: 700, y: 1200, g: [86, 90, 80], a: [70, 74, 66], danger: 5, trees: 0.15, dead: 0.6, cracks: 1, anoms: ['psifield', 'tesla', 'electro', 'teleport'] },
      { id: 'pripyatedge', name: 'Pripyat Edge', x: 5800, y: 1100, g: [96, 96, 92], a: [84, 88, 72], danger: 5, trees: 0.1, dead: 0.4, cracks: 1, anoms: ['mincer', 'gas', 'cryo', 'psifield'] },
    ],
    spawns: [
      { name: 'Southern Approach', x: 3200, y: 5800, icon: '🛣️', desc: 'The long road to the reactor.' },
      { name: 'Dead Forest Camp', x: 1200, y: 5700, icon: '🌲', desc: 'Burnt forest, comets and fire.' },
      { name: 'Cooling Pond', x: 5400, y: 3900, icon: '💧', desc: 'Close to the reactor. Radiation everywhere.' },
    ],
    roads: [
      [[3200, 6500], [3200, 4400], [3100, 3000], [3200, 2100]],
      [[600, 3000], [2000, 3100], [3100, 3000], [4400, 3100], [5800, 3000]],
      [[3200, 4400], [4300, 4800], [5200, 5300]],
      [[3200, 4400], [2100, 4900], [1200, 5400]],
    ],
  },
};
for (const k in STAGE_WORLD) {
  const S = STAGE_WORLD[k];
  for (const r of S.regions) { r.x *= MS; r.y *= MS; }
  S.roads = S.roads.map((road) => road.map(([x, y]) => [x * MS, y * MS]));
  for (const s of S.spawns) { s.x *= MS; s.y *= MS; }
}
const LAB_NAMES = ['X-18', 'X-16', 'X-10', 'X-8', 'X-2', 'X-19', 'X-7'];
const POI_TYPES = [
  { type: 'checkpoint', name: 'Military Checkpoint', guard: 'zombie', icon: '🪖' },
  { type: 'heli', name: 'Crashed Helicopter', guard: 'bloodsucker', icon: '🚁' },
  { type: 'camp', name: 'Bandit Camp', guard: 'snork', icon: '⛺' },
  { type: 'nest', name: 'Mutant Nest', guard: 'flesh', icon: '🦴' },
  { type: 'sci', name: 'Abandoned Science Camp', guard: 'controller', icon: '🔬' },
  { type: 'heli', name: 'Downed Mi-24', guard: 'izlom', icon: '🚁' },
  { type: 'camp', name: 'Loner Hideout', guard: 'cat', icon: '⛺' },
];
const LEVEL_KEYS = ['kind', 'regions', 'roads', 'regionGrid', 'obstacles', 'obGrid', 'props', 'propGrid', 'anomalies', 'fields', 'shelters', 'rads',
  'crateSpots', 'chunks', 'chunkOrder', 'labels', 'mapImg', 'hatches', 'pois', 'lairs', 'lab', 'dark', 'spores', 'crystals', 'attics', 'vehicles', 'tornados'];

const World = {
  stage: 'zone', stamp: 1, levels: {}, cur: 'over',

  newLevel(kind) {
    this.kind = kind; this.regions = []; this.roads = [];
    this.obstacles = []; this.props = []; this.anomalies = []; this.fields = []; this.shelters = []; this.rads = [];
    this.crateSpots = []; this.chunks = new Map(); this.chunkOrder = []; this.labels = []; this.hatches = []; this.pois = []; this.lairs = []; this.lab = null; this.dark = 0;
    this.spores = []; this.crystals = []; this.attics = []; this.vehicles = []; this.tornados = [];
    const OC = WORLD / OBCELL; this.obGrid = []; for (let i = 0; i < OC * OC; i++) this.obGrid.push([]);
    const PC = WORLD / PCELL; this.propGrid = []; for (let i = 0; i < PC * PC; i++) this.propGrid.push([]);
  },
  snapshot() { const o = {}; for (const k of LEVEL_KEYS) o[k] = this[k]; return o; },
  restore(o) { for (const k of LEVEL_KEYS) this[k] = o[k]; },

  genStage(stage, seed, spawnIdx = 0) {
    this.stage = stage; this.seed = seed; this.levels = {}; this.cur = 'over';
    const sp = STAGE_WORLD[stage].spawns[spawnIdx] || STAGE_WORLD[stage].spawns[0];
    this.start = { x: sp.x, y: sp.y }; this.spawnName = sp.name;
    this.newLevel('over');
    const S = STAGE_WORLD[stage];
    this.regions = S.regions; this.roads = S.roads;
    const R = mulberry32(seed); this.R = R;
    const G = WORLD / 64;
    this.regionGrid = new Int8Array(G * G);
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) this.regionGrid[gy * G + gx] = this.regionIdxRaw(gx * 64 + 32, gy * 64 + 32).i;
    if (stage === 'zone') this.genZone(R); else if (stage === 'pripyat') this.genPripyat(R); else this.genNPP(R);
    this.genShelters(R);
    this.genHatches(R);
    this.genPOIs(R);
    this.genLairs(R);
    this.genAnomalies(R, 150);
    this.genNature(R);
    this.genMisc(R);
    genHazards(R);
    this.labels.push({ x: this.start.x, y: this.start.y + 60, name: '⚑ ' + sp.name });
    // make sure the chosen spawn point is standing room
    for (let i = 0; i < 200 && !this.free(this.start.x, this.start.y, 20); i++) { this.start.x += Math.cos(i) * 12 * i * 0.2; this.start.y += Math.sin(i) * 12 * i * 0.2; }
    this.buildMap();
    this.levels.over = this.snapshot();
  },

  regionIdxRaw(x, y) {
    const wx = x + (fbm(x / 900, y / 900, 3) - 0.5) * 900, wy = y + (fbm(x / 900, y / 900, 9) - 0.5) * 900;
    let b = 1e12, bi = 0, s = 1e12, si = 0;
    const RG = this.regions;
    for (let i = 0; i < RG.length; i++) {
      const d = dist2(wx, wy, RG[i].x, RG[i].y);
      if (d < b) { s = b; si = bi; b = d; bi = i; } else if (d < s) { s = d; si = i; }
    }
    return { i: bi, j: si, t: clamp((Math.sqrt(s) - Math.sqrt(b)) / 260, 0, 1) };
  },
  region(x, y) {
    const G = WORLD / 64, gx = clamp(Math.floor(x / 64), 0, G - 1), gy = clamp(Math.floor(y / 64), 0, G - 1);
    return this.regions[this.regionGrid[gy * G + gx]] || this.regions[0];
  },
  roadDist(x, y) {
    let best = 1e9;
    for (const r of this.roads) for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = r[i], [bx, by] = r[i + 1];
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / l, 0, 1);
      const d = dist(x, y, ax + dx * t, ay + dy * t);
      if (d < best) best = d;
    }
    return best;
  },

  // ---------- obstacles ----------
  obCells(ob, fn) {
    const OC = WORLD / OBCELL;
    const x0 = ob.t ? ob.x : ob.x - ob.r, y0 = ob.t ? ob.y : ob.y - ob.r;
    const x1 = ob.t ? ob.x + ob.w : ob.x + ob.r, y1 = ob.t ? ob.y + ob.h : ob.y + ob.r;
    for (let cy = Math.max(0, Math.floor(y0 / OBCELL)); cy <= Math.min(OC - 1, Math.floor(y1 / OBCELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / OBCELL)); cx <= Math.min(OC - 1, Math.floor(x1 / OBCELL)); cx++) fn(this.obGrid[cy * OC + cx]);
  },
  addOb(ob) { this.obstacles.push(ob); this.obCells(ob, (c) => c.push(ob)); return ob; },
  propCells(p, fn) {
    const PC = WORLD / PCELL;
    const x0 = p.bx0 ?? p.x - 60, x1 = p.bx1 ?? p.x + 60, y0 = p.by0 ?? p.y - 120, y1 = p.by1 ?? p.y + 30;
    for (let cy = Math.max(0, Math.floor(y0 / PCELL)); cy <= Math.min(PC - 1, Math.floor(y1 / PCELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / PCELL)); cx <= Math.min(PC - 1, Math.floor(x1 / PCELL)); cx++) fn(this.propGrid[cy * PC + cx]);
  },
  addProp(p) { this.props.push(p); this.propCells(p, (c) => c.push(p)); return p; },
  destroy(ob) {
    this.obCells(ob, (c) => { const i = c.indexOf(ob); if (i >= 0) c.splice(i, 1); });
    const i = this.obstacles.indexOf(ob); if (i >= 0) this.obstacles.splice(i, 1);
    if (ob.prop) { const p = ob.prop; this.propCells(p, (c) => { const k = c.indexOf(p); if (k >= 0) c.splice(k, 1); }); const j = this.props.indexOf(p); if (j >= 0) this.props.splice(j, 1); }
  },
  destructiblesNear(x, y, r) {
    const out = [], st = ++this.stamp, OC = WORLD / OBCELL;
    for (let cy = Math.max(0, Math.floor((y - r) / OBCELL)); cy <= Math.min(OC - 1, Math.floor((y + r) / OBCELL)); cy++)
      for (let cx = Math.max(0, Math.floor((x - r) / OBCELL)); cx <= Math.min(OC - 1, Math.floor((x + r) / OBCELL)); cx++)
        for (const ob of this.obGrid[cy * OC + cx]) {
          if (!ob.hp || ob._s === st) continue; ob._s = st;
          const cxo = ob.t ? ob.x + ob.w / 2 : ob.x, cyo = ob.t ? ob.y + ob.h / 2 : ob.y;
          if (dist2(x, y, cxo, cyo) < r * r) out.push(ob);
        }
    return out;
  },
  free(x, y, r) {
    if (x < r || y < r || x > WORLD - r || y > WORLD - r) return false;
    if (this.kind === 'lab' && !this.labFloor(x, y)) return false;
    const OC = WORLD / OBCELL;
    for (let cy = Math.max(0, Math.floor((y - r) / OBCELL)); cy <= Math.min(OC - 1, Math.floor((y + r) / OBCELL)); cy++)
      for (let cx = Math.max(0, Math.floor((x - r) / OBCELL)); cx <= Math.min(OC - 1, Math.floor((x + r) / OBCELL)); cx++)
        for (const ob of this.obGrid[cy * OC + cx]) {
          if (ob.t) { const nx = clamp(x, ob.x, ob.x + ob.w), ny = clamp(y, ob.y, ob.y + ob.h); if (dist2(x, y, nx, ny) < r * r) return false; }
          else if (dist2(x, y, ob.x, ob.y) < (r + ob.r) ** 2) return false;
        }
    return true;
  },
  solidAt(x, y) {
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return true;
    const OC = WORLD / OBCELL, c = this.obGrid[Math.floor(y / OBCELL) * OC + Math.floor(x / OBCELL)];
    if (!c) return true;
    for (const ob of c) {
      if (ob.soft) continue;
      if (ob.t) { if (x > ob.x && x < ob.x + ob.w && y > ob.y && y < ob.y + ob.h) return ob; }
      else if (dist2(x, y, ob.x, ob.y) < ob.r * ob.r) return ob;
    }
    return null;
  },
  collide(e) {
    const OC = WORLD / OBCELL, r = e.r, st = ++this.stamp;
    for (let cy = Math.max(0, Math.floor((e.y - r) / OBCELL)); cy <= Math.min(OC - 1, Math.floor((e.y + r) / OBCELL)); cy++)
      for (let cx = Math.max(0, Math.floor((e.x - r) / OBCELL)); cx <= Math.min(OC - 1, Math.floor((e.x + r) / OBCELL)); cx++)
        for (const ob of this.obGrid[cy * OC + cx]) {
          if (ob._s === st) continue; ob._s = st;
          if (ob.t) {
            const nx = clamp(e.x, ob.x, ob.x + ob.w), ny = clamp(e.y, ob.y, ob.y + ob.h);
            const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
            if (d2 < r * r) {
              if (d2 > 0.0001) { const d = Math.sqrt(d2); e.x = nx + (dx / d) * r; e.y = ny + (dy / d) * r; }
              else {
                const l = e.x - ob.x, rr = ob.x + ob.w - e.x, t = e.y - ob.y, b = ob.y + ob.h - e.y, m = Math.min(l, rr, t, b);
                if (m === l) e.x = ob.x - r; else if (m === rr) e.x = ob.x + ob.w + r; else if (m === t) e.y = ob.y - r; else e.y = ob.y + ob.h + r;
              }
            }
          } else {
            const dx = e.x - ob.x, dy = e.y - ob.y, d2 = dx * dx + dy * dy, m = r + ob.r;
            if (d2 < m * m) { const d = Math.sqrt(d2) || 1; e.x = ob.x + (dx / d) * m; e.y = ob.y + (dy / d) * m; }
          }
        }
    e.x = clamp(e.x, r, WORLD - r); e.y = clamp(e.y, r, WORLD - r);
  },

  // ---------- structure helpers ----------
  building(x, y, w, h, hgt, style) {
    if (!this.free(x + w / 2, y + h / 2, Math.max(w, h) * 0.55)) return null;
    const b = { kind: 'building', x, y, w, h, hgt, style, sy: y + h, bx0: x - 110, bx1: x + w + 110, by0: y - hgt - 80, by1: y + h + 20,
      seed: Math.floor(this.R() * 1e6), holes: this.R() < 0.5 };
    this.addOb({ t: 1, x, y, w, h });
    this.addProp(b);
    return b;
  },
  tower(x, y, h) {
    this.addOb({ x, y, r: 26 });
    this.addProp({ kind: 'tower', x, y, h, sy: y, bx0: x - 200, bx1: x + 200, by0: y - h - 40, by1: y + 40 });
  },
  addTank(x, y, R, r, h) {
    r = r || 34 + R() * 16;
    this.addOb({ x, y, r });
    this.addProp({ kind: 'tank', x, y, r, h: h || 60 + R() * 60, sy: y, bx0: x - r - 80, bx1: x + r + 80, by0: y - (h || 120) - 120, by1: y + r });
  },
  addWreck(x, y, R) {
    const bus = R() < 0.25, w = bus ? 150 : 90, h = 44;
    this.addOb({ t: 1, x: x - w / 2, y: y - h / 2, w, h });
    this.addProp({ kind: 'wreck', x, y, w, h, bus, col: pick([[90, 110, 80], [120, 60, 40], [70, 90, 110], [150, 140, 110]]), sy: y + h / 2, bx0: x - w, bx1: x + w, by0: y - 100, by1: y + 40 });
  },
  addBarrel(x, y, explosive) {
    const p = this.addProp({ kind: 'barrel', x, y, sy: y, rad: !explosive && this.R() < 0.4, ex: explosive, bx0: x - 20, bx1: x + 20, by0: y - 40, by1: y + 10 });
    const ob = this.addOb({ x, y, r: 11, prop: p });
    if (explosive) { ob.hp = 25; ob.kind = 'barrel'; }
  },
  addFence(x, y, w, horiz) {
    const rw = horiz ? w : 10, rh = horiz ? 10 : w;
    const p = this.addProp({ kind: 'fence', x, y, w: rw, h: rh, horiz, sy: y + rh, bx0: x - 20, bx1: x + rw + 20, by0: y - 40, by1: y + rh + 10 });
    const ob = this.addOb({ t: 1, x, y, w: rw, h: rh, prop: p, soft: true });
    ob.hp = 30; ob.kind = 'fence';
  },
  genZone(R) {
    const M = MS;
    // Rookie Village: tight cluster around the Cordon centre
    const vc = [3200 * M, 5500 * M];
    const vil = [[-340, -120], [180, -170], [-370, 120], [220, 120], [-320, 400], [250, 420], [400, -40], [-560, 20]];
    for (const [ox, oy] of vil) this.building(vc[0] + ox - 80, vc[1] + oy - 60, 150 + R() * 40, 105 + R() * 25, 62 + R() * 18, 'house');
    for (let i = 0; i < 10; i++) this.addFence(vc[0] - 500 + i * 70, vc[1] + 540, 64, true);
    this.labels.push({ x: vc[0], y: vc[1] + 120, name: 'Rookie Village' });
    const fac = (cx, cy, n = 7) => {
      for (let i = 0; i < n; i++) {
        const w = 260 + R() * 260, h = 160 + R() * 160;
        this.building(cx + (R() - 0.5) * 1100 - w / 2, cy + (R() - 0.5) * 1100 - h / 2, w, h, 110 + R() * 70, 'factory');
      }
      for (let i = 0; i < 6; i++) { const x = cx + (R() - 0.5) * 1200, y = cy + (R() - 0.5) * 1200; if (this.free(x, y, 30)) this.addTank(x, y, R); }
      for (let i = 0; i < 8; i++) { const x = cx + (R() - 0.5) * 1200, y = cy + (R() - 0.5) * 1200; if (this.free(x, y, 16)) this.addBarrel(x, y, true); }
    };
    fac(5400 * M, 4150 * M); fac(5500 * M, 5750 * M); fac(6000 * M, 1400 * M, 9); fac(600 * M, 2800 * M, 5);
    this.labels.push({ x: 5400 * M, y: 4150 * M, name: 'Rostok' }, { x: 5500 * M, y: 5750 * M, name: 'Agroprom' }, { x: 6000 * M, y: 1400 * M, name: 'Jupiter Plant' }, { x: 600 * M, y: 2800 * M, name: 'Army Warehouses' });
    // Brain Scorcher
    const rc = [4800 * M, 900 * M];
    this.tower(rc[0], rc[1] - 80, 420); this.tower(rc[0] - 420, rc[1] + 180, 300); this.tower(rc[0] + 430, rc[1] + 220, 300);
    for (let i = 0; i < 7; i++) this.building(rc[0] - 500 + R() * 1000, rc[1] + 400 + R() * 600, 200 + R() * 140, 130 + R() * 80, 100 + R() * 40, 'factory');
    this.labels.push({ x: rc[0], y: rc[1] + 100, name: 'Brain Scorcher' });
    // Yantar lab complex, Limansk & Dead City streets
    for (let i = 0; i < 6; i++) this.building(6000 * M - 600 + R() * 1200, 2900 * M - 500 + R() * 1000, 180 + R() * 160, 120 + R() * 80, 90 + R() * 50, 'factory');
    this.labels.push({ x: 6000 * M, y: 2900 * M, name: 'Yantar Lab' });
    for (const [cx, cy, name] of [[2600 * M, 800 * M, 'Limansk'], [1900 * M, 5000 * M, 'Dead City']]) {
      for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) if (R() < 0.75) this.building(cx + gx * 420 + R() * 60, cy + gy * 360 + R() * 60, 180 + R() * 120, 110 + R() * 70, 110 + R() * 90, R() < 0.7 ? 'apartment' : 'ruin');
      this.labels.push({ x: cx, y: cy, name });
    }
    for (let i = 0; i < 18; i++) this.building((600 + R() * 900) * M, (3800 + R() * 2300) * M, 110 + R() * 30, 80 + R() * 20, 50 + R() * 12, 'hut');
    this.ruins(R, 160);
    for (let i = 0; i < 60; i++) {
      const x = (3700 + R() * 1300) * M, y = (2100 + R() * 1100) * M, r = 40 + R() * 60;
      if (this.roadDist(x, y) > 110 && this.free(x, y, r + 20)) this.heap(x, y, r, R);
    }
    this.labels.push({ x: 4300 * M, y: 2600 * M, name: 'Garbage' });
    this.roadWrecks(R, 0.55);
  },
  genPripyat(R) {
    const M = MS;
    // apartment blocks in the city grid
    const xs = [500, 1200, 2200, 3200, 4200, 5200, 5900].map((v) => v * M), ys = [1000, 1900, 2800, 3700, 4700].map((v) => v * M);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + 90, x1 = xs[i + 1] - 90, y0 = ys[j] + 90, y1 = ys[j + 1] - 90;
      const reg = this.region((x0 + x1) / 2, (y0 + y1) / 2);
      if (reg.id === 'park' || reg.id === 'port') continue;
      const n = Math.round(((x1 - x0) * (y1 - y0)) / (reg.id === 'city' ? 160000 : 320000));
      for (let k = 0; k < n; k++) {
        const w = 240 + R() * 200, h = 110 + R() * 70;
        this.building(x0 + R() * Math.max(1, x1 - x0 - w), y0 + R() * Math.max(1, y1 - y0 - h), w, h, reg.id === 'jupiter' ? 130 + R() * 60 : 160 + R() * 90, reg.id === 'jupiter' ? 'factory' : 'apartment');
      }
    }
    this.labels.push({ x: 3200 * M, y: 3300 * M, name: 'Palace of Culture' });
    const wx = 3200 * M, wy = 1300 * M;
    this.addOb({ x: wx, y: wy, r: 46 });
    this.addProp({ kind: 'wheel', x: wx, y: wy, sy: wy, bx0: wx - 200, bx1: wx + 200, by0: wy - 400, by1: wy + 40 });
    this.labels.push({ x: wx, y: wy, name: 'Ferris Wheel' });
    for (let i = 0; i < 24; i++) this.building((400 + R() * 1200) * M, (3900 + R() * 1400) * M, 120 + R() * 60, 80 + R() * 30, 50 + R() * 20, 'hut');
    for (let i = 0; i < 10; i++) { const x = (5000 + R() * 900) * M, y = (4000 + R() * 1000) * M; if (this.free(x, y, 40)) this.addTank(x, y, R); }
    for (let i = 0; i < 100; i++) { const x = (600 + R() * 5200) * M, y = (900 + R() * 4000) * M; if (this.free(x, y, 16)) this.addBarrel(x, y, true); }
    this.ruins(R, 80);
    this.roadWrecks(R, 0.9);
  },
  genNPP(R) {
    const M = MS, cx = 3200 * M, cy = 1500 * M;
    // the sarcophagus + reactor blocks
    this.building(cx - 450, cy - 200, 900, 380, 270, 'reactor');
    this.building(cx - 1300, cy - 50, 520, 260, 180, 'factory');
    this.building(cx + 780, cy - 50, 520, 260, 180, 'factory');
    this.addProp({ kind: 'chimney', x: cx, y: cy - 240, sy: cy - 238, bx0: cx - 200, bx1: cx + 200, by0: cy - 1000, by1: cy - 200 });
    this.addOb({ x: cx, y: cy - 240, r: 30 });
    this.labels.push({ x: cx, y: cy, name: 'Sarcophagus' });
    this.addTank(4700 * M, 2600 * M, R, 150, 260); this.addTank(5300 * M, 2900 * M, R, 150, 260); this.addTank(4900 * M, 3300 * M, R, 150, 260);
    this.labels.push({ x: 5000 * M, y: 2750 * M, name: 'Cooling Towers' });
    for (let i = 0; i < 48; i++) { const w = 200 + R() * 260, h = 130 + R() * 120; this.building((800 + R() * 4800) * M, (2000 + R() * 3200) * M, w, h, 90 + R() * 80, R() < 0.5 ? 'factory' : 'ruin'); }
    for (let i = 0; i < 40; i++) { const x = (1200 + i * 120) * M, y = (2300 + Math.sin(i * 0.4) * 60) * M; if (this.free(x, y, 20)) { this.addOb({ x, y, r: 10 }); this.addProp({ kind: 'pylon', x, y, sy: y, bx0: x - 100, bx1: x + 500, by0: y - 280, by1: y + 20 }); } }
    for (let i = 0; i < 40; i++) { const x = (4400 + R() * 1200) * M, y = (4900 + R() * 1000) * M, r = 40 + R() * 50; if (this.free(x, y, r + 20)) this.heap(x, y, r, R); }
    for (let i = 0; i < 100; i++) { const x = (800 + R() * 4800) * M, y = (1100 + R() * 4400) * M; if (this.free(x, y, 16)) this.addBarrel(x, y, true); }
    this.roadWrecks(R, 0.8);
    for (let i = 0; i < 80; i++) { const x = (400 + R() * 5600) * M, y = (400 + R() * 5000) * M; if (dist(x, y, this.start.x, this.start.y) > 900) this.rads.push({ x, y, r: 100 + R() * 180 }); }
  },
  ruins(R, n) {
    for (let i = 0; i < n; i++) {
      const x = (300 + R() * 5800) * MS, y = (300 + R() * 5800) * MS;
      if (dist(x, y, this.start.x, this.start.y) < 500 || this.roadDist(x, y) < 140) continue;
      this.building(x, y, 110 + R() * 150, 90 + R() * 90, 40 + R() * 70, R() < 0.5 ? 'ruin' : 'house');
    }
  },
  heap(x, y, r, R) {
    this.addOb({ x, y, r: r * 0.8 });
    this.addProp({ kind: 'heap', x, y, r, sy: y, seed: R() * 1e6, by0: y - r - 60, by1: y + r, bx0: x - r - 20, bx1: x + r + 20 });
  },
  roadWrecks(R, p) {
    for (const road of this.roads) for (let i = 0; i < road.length - 1; i++) {
      const [ax, ay] = road[i], [bx, by] = road[i + 1], len = dist(ax, ay, bx, by);
      for (let k = 0; k < Math.max(1, len / 900); k++) {
        if (R() > p) continue;
        const t = R(), x = lerp(ax, bx, t) + (R() - 0.5) * 60, y = lerp(ay, by, t) + (R() - 0.5) * 60;
        if (dist(x, y, this.start.x, this.start.y) > 300 && this.free(x, y, 50)) this.addWreck(x, y, R);
      }
    }
  },
  genShelters(R) {
    const pts = [[this.start.x, this.start.y - 220]];
    for (let i = 0; i < 60; i++) pts.push([(500 + R() * 5400) * MS, (500 + R() * 5400) * MS]);
    for (const [x, y] of pts) {
      let px = x, py = y, tries = 0;
      while ((!this.free(px, py, 80) || this.shelters.some((s) => dist(s.x, s.y, px, py) < 1000)) && tries++ < 60) { px = x + (R() - 0.5) * 700; py = y + (R() - 0.5) * 700; }
      if (tries >= 60) continue;
      this.shelters.push({ x: px, y: py, r: 72 });
      this.addOb({ t: 1, x: px - 40, y: py - 78, w: 80, h: 30 });
      this.addProp({ kind: 'bunker', x: px, y: py, sy: py - 48, bx0: px - 90, bx1: px + 90, by0: py - 150, by1: py + 80 });
    }
  },
  genHatches(R) {
    let made = 0;
    for (let tries = 0; tries < 800 && made < LAB_NAMES.length; tries++) {
      const x = (500 + R() * 5400) * MS, y = (500 + R() * 4800) * MS;
      if (dist(x, y, this.start.x, this.start.y) < 1600 || !this.free(x, y, 70) || this.hatches.some((h) => dist(h.x, h.y, x, y) < 2600)) continue;
      const h = { x, y, idx: made, name: LAB_NAMES[made] + ' Laboratory' };
      this.hatches.push(h);
      this.addProp({ kind: 'hatch', x, y, sy: y - 30, h, bx0: x - 80, bx1: x + 80, by0: y - 120, by1: y + 50 });
      this.labels.push({ x, y: y + 40, name: LAB_NAMES[made] });
      made++;
    }
  },
  genPOIs(R) {
    const types = [...POI_TYPES].sort(() => R() - 0.5);
    let made = 0;
    for (let tries = 0; tries < 1500 && made < 18; tries++) {
      const x = (500 + R() * 5400) * MS, y = (500 + R() * 5000) * MS;
      if (dist(x, y, this.start.x, this.start.y) < 1100 || !this.free(x, y, 140) || this.pois.some((p) => dist(p.x, p.y, x, y) < 1500) || this.hatches.some((h) => dist(h.x, h.y, x, y) < 500)) continue;
      const T = types[made % types.length];
      const poi = { ...T, x, y, state: 0, boss: null };
      this.pois.push(poi);
      if (T.type === 'checkpoint') {
        for (let i = -2; i <= 2; i++) if (i) this.addFence(x + i * 60 - 30, y - 120, 56, true);
        this.addProp({ kind: 'sandbag', x: x - 110, y: y + 40, sy: y + 50, bx0: x - 160, bx1: x - 50, by0: y, by1: y + 70 }); this.addOb({ t: 1, x: x - 150, y: y + 30, w: 80, h: 22 });
        this.addProp({ kind: 'sandbag', x: x + 110, y: y + 40, sy: y + 50, bx0: x + 60, bx1: x + 170, by0: y, by1: y + 70 }); this.addOb({ t: 1, x: x + 70, y: y + 30, w: 80, h: 22 });
        this.tower(x + 150, y - 60, 150);
        this.addBarrel(x - 60, y + 90, true); this.addBarrel(x + 40, y - 70, true);
      } else if (T.type === 'heli') {
        this.addProp({ kind: 'heli', x: x - 80, y: y - 60, sy: y - 20, bx0: x - 260, bx1: x + 150, by0: y - 180, by1: y + 20 }); this.addOb({ t: 1, x: x - 190, y: y - 80, w: 200, h: 56 });
        this.addBarrel(x + 90, y - 40, true);
      } else if (T.type === 'camp') {
        for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5, tx = x + Math.cos(a) * 120, ty = y + Math.sin(a) * 80; this.addProp({ kind: 'tent', x: tx, y: ty, sy: ty, seed: i, bx0: tx - 60, bx1: tx + 60, by0: ty - 70, by1: ty + 20 }); this.addOb({ x: tx, y: ty - 10, r: 30 }); }
        this.addProp({ kind: 'campfire', x: x + 60, y: y + 20, sy: y + 20, bx0: x + 20, bx1: x + 100, by0: y - 40, by1: y + 40 });
      } else if (T.type === 'nest') {
        for (let i = 0; i < 8; i++) this.addProp({ kind: 'bones', x: x + (R() - 0.5) * 260, y: y + (R() - 0.5) * 180, sy: y - 200, seed: R() * 100, bx0: x - 200, bx1: x + 200, by0: y - 150, by1: y + 150 });
      } else if (T.type === 'sci') {
        this.building(x - 90, y - 170, 180, 90, 60, 'house');
        this.tower(x + 150, y - 90, 200);
        for (let i = 0; i < 4; i++) this.addFence(x - 150 + i * 75, y + 110, 68, true);
      }
      made++;
    }
  },
  // mutant lairs: key enemy spawn points that keep pumping out one mutant family until destroyed
  genLairs(R) {
    const fam = [['dog', 1], ['flesh', 1], ['rat', 2], ['snork', 2], ['pseudodog', 2], ['boar', 3], ['zombie', 2], ['bloodsucker', 4], ['izlom', 4], ['karlik', 4], ['psydog', 4], ['msoldier', 5]];
    let made = 0;
    for (let tries = 0; tries < 2000 && made < 22; tries++) {
      const x = (400 + R() * 5600) * MS, y = (400 + R() * 5600) * MS;
      if (dist(x, y, this.start.x, this.start.y) < 1500 || !this.free(x, y, 120) || this.lairs.some((l) => dist(l.x, l.y, x, y) < 1400)) continue;
      const reg = this.region(x, y), opts = fam.filter((f) => f[1] <= reg.danger + 1);
      const family = pick(opts)[0];
      const p = this.addProp({ kind: 'lair', x, y, sy: y, family, bx0: x - 120, bx1: x + 120, by0: y - 140, by1: y + 60 });
      const ob = this.addOb({ x, y, r: 46, prop: p });
      ob.hp = 1e9; ob.kind = 'lair';
      const lair = { x, y, family, ob, prop: p, state: 0, spawnT: 0, spawned: [] };
      p.lair = lair; ob.lair = lair;
      this.lairs.push(lair); made++;
    }
  },
  genAnomalies(R, count) {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 50) {
      const x = (250 + R() * 5900) * MS, y = (250 + R() * 5900) * MS;
      if (this.kind === 'over' && dist(x, y, this.start.x, this.start.y) < 650) continue;
      if (this.fields.some((f) => dist(f.x, f.y, x, y) < 520)) continue;
      if (this.pois.some((p) => dist(p.x, p.y, x, y) < 400) || this.hatches.some((h) => dist(h.x, h.y, x, y) < 300)) continue;
      if (!this.free(x, y, 90)) continue;
      const reg = this.region(x, y), type = R() < 0.18 ? pick(NEW_ANOMS) : pick(reg.anoms);
      this.hideNext = reg.danger >= 3 && R() < 0.3;
      this.makeField(x, y, type, 3 + Math.floor(R() * 4) + (reg.danger > 3 ? 2 : 0), 230, R);
      made++;
    }
    const nr = this.stage === 'npp' ? 60 : 110;
    for (let i = 0; i < nr; i++) {
      const x = (300 + R() * 5800) * MS, y = (300 + R() * 5800) * MS;
      if (dist(x, y, this.start.x, this.start.y) < 900) continue;
      this.rads.push({ x, y, r: 90 + R() * 160 });
    }
  },
  makeField(x, y, type, n, spread, R) {
    const f = { x, y, type, anoms: [], art: null };
    for (let i = 0; i < n * 3 && f.anoms.length < n; i++) {
      const a = R() * TAU, d = 30 + R() * spread, ax = x + Math.cos(a) * d, ay = y + Math.sin(a) * d;
      const r = ANOMALIES[type].r * (0.8 + R() * 0.4);
      if (!this.free(ax, ay, 20) || f.anoms.some((o) => dist(o.x, o.y, ax, ay) < o.r + r + 20)) continue;
      const an = { type, x: ax, y: ay, r, cd: R() * 2, t: 0, act: 0, seed: R() * 100, field: f, hidden: !!this.hideNext };
      f.anoms.push(an); this.anomalies.push(an);
    }
    if (ANOMALIES[type].moving) for (const [i, an] of f.anoms.entries()) {
      an.cx = x; an.cy = y; an.orb = 90 + i * 70 + R() * 30; an.ang = R() * TAU; an.spd = type === 'comet' ? 1.1 : 0.7; an.dir = R() < 0.5 ? 1 : -1; an.r = ANOMALIES[type].r;
    }
    // teleports link in pairs; an odd one out sends you back to the first portal
    if (type === 'teleport') for (let i = 0; i < f.anoms.length; i++) { const q = f.anoms[i ^ 1] || f.anoms[0]; f.anoms[i].pair = q !== f.anoms[i] ? q : null; }
    if (f.anoms.length) this.fields.push(f);
    this.hideNext = false;
  },
  genNature(R) {
    for (let i = 0; i < 16000 * MS * MS; i++) {
      const x = 60 + R() * (WORLD - 120), y = 60 + R() * (WORLD - 120);
      const reg = this.region(x, y);
      const cluster = fbm(x / 500, y / 500, 21);
      if (R() > reg.trees * (cluster * 1.9 - 0.25)) continue;
      if (this.roadDist(x, y) < 80 || dist(x, y, this.start.x, this.start.y) < 240) continue;
      if (this.shelters.some((s) => dist(s.x, s.y, x, y) < 110) || this.hatches.some((h) => dist(h.x, h.y, x, y) < 90) || this.pois.some((p) => dist(p.x, p.y, x, y) < 200)) continue;
      if (this.anomalies.some((a) => Math.abs(a.x - x) < 200 && dist(a.x, a.y, x, y) < a.r + 10)) continue;
      const dead = R() < reg.dead, s = 0.8 + R() * 0.6;
      if (!this.free(x, y, 16 * s)) continue;
      this.addOb({ x, y, r: 9 * s, soft: true });
      this.addProp({ kind: dead ? 'deadtree' : 'tree', x, y, s, red: !!reg.red, sy: y, seed: R() * 100, pine: R() < (reg.pine || 0.2),
        bx0: x - 70 * s, bx1: x + 70 * s, by0: y - 170 * s, by1: y + 40 });
    }
    for (let i = 0; i < 300 * MS * MS; i++) {
      const x = 80 + R() * (WORLD - 160), y = 80 + R() * (WORLD - 160), r = 14 + R() * 26;
      if (this.roadDist(x, y) < 80 || dist(x, y, this.start.x, this.start.y) < 260 || !this.free(x, y, r + 10)) continue;
      if (this.anomalies.some((a) => Math.abs(a.x - x) < 200 && dist(a.x, a.y, x, y) < a.r + r) || this.pois.some((p) => dist(p.x, p.y, x, y) < 180)) continue;
      this.addOb({ x, y, r: r * 0.9 });
      const pts = []; for (let k = 0; k < 7; k++) pts.push(0.75 + R() * 0.35);
      this.addProp({ kind: 'rock', x, y, r, pts, sy: y, bx0: x - r - 10, bx1: x + r + 10, by0: y - r * 2, by1: y + r });
    }
    for (let i = 0; i < 5000 * MS * MS; i++) {
      const x = R() * WORLD, y = R() * WORLD, reg = this.region(x, y);
      if (this.roadDist(x, y) < 60) continue;
      const k = reg.reeds ? 'reeds' : R() < 0.5 ? 'bush' : 'grass';
      this.addProp({ kind: k, x, y, s: 0.7 + R() * 0.6, red: !!reg.red, sy: y, seed: R() * 100, bx0: x - 30, bx1: x + 30, by0: y - 50, by1: y + 10 });
    }
    for (let i = 0; i < 100 * MS * MS; i++) {
      const x = 200 + R() * (WORLD - 400), y = 200 + R() * (WORLD - 400);
      if (dist(x, y, this.start.x, this.start.y) < 260 || !this.free(x, y, 16)) continue;
      this.addBarrel(x, y, R() < 0.35);
    }
    if (this.stage === 'zone') for (let i = 0; i < 14; i++) {
      const x = (600 + i * 400 + R() * 60) * MS, y = (3000 + Math.sin(i * 0.6) * 300) * MS;
      if (this.free(x, y, 20)) { this.addOb({ x, y, r: 10 }); this.addProp({ kind: 'pylon', x, y, sy: y, bx0: x - 100, bx1: x + 500, by0: y - 280, by1: y + 20 }); }
    }
  },
  genMisc(R) {
    for (let i = 0; i < 140 * MS * MS; i++) {
      const x = 150 + R() * (WORLD - 300), y = 150 + R() * (WORLD - 300);
      if (this.free(x, y, 24) && dist(x, y, this.start.x, this.start.y) > 200) this.crateSpots.push({ x, y });
    }
  },

  // ---------- underground labs ----------
  labFloor(x, y) {
    const tx = Math.floor(x / LAB_T), ty = Math.floor(y / LAB_T);
    if (tx < 0 || ty < 0 || tx >= LAB_N || ty >= LAB_N) return false;
    return this.lab.grid[ty * LAB_N + tx] === 1;
  },
  genLab(idx) {
    this.newLevel('lab');
    const R = mulberry32(this.seed * 31 + idx * 977 + 5); this.R = R;
    const N = LAB_N, T = LAB_T, grid = new Uint8Array(N * N), C = 4, CS = N / C;
    this.regions = [{ id: 'lab', name: LAB_NAMES[idx] + ' Laboratory', x: 1280, y: 1280, g: [52, 54, 56], a: [44, 46, 50], danger: 4, trees: 0, anoms: ['electro', 'burner', 'vortex'] }];
    this.regionGrid = new Int8Array((WORLD / 64) ** 2);
    const rooms = [];
    for (let cy = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++) {
      const w = 4 + Math.floor(R() * 3), h = 4 + Math.floor(R() * 3);
      const x0 = cx * CS + 1 + Math.floor(R() * (CS - w - 1)), y0 = cy * CS + 1 + Math.floor(R() * (CS - h - 1));
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y * N + x] = 1;
      rooms.push({ x0, y0, w, h, cx, cy, mx: Math.floor(x0 + w / 2), my: Math.floor(y0 + h / 2) });
    }
    const carve = (a, b) => {
      let x = a.mx, y = a.my;
      while (x !== b.mx) { grid[y * N + x] = 1; grid[(y + 1) * N + x] = 1; x += Math.sign(b.mx - x); }
      while (y !== b.my) { grid[y * N + x] = 1; grid[y * N + x + 1] = 1; y += Math.sign(b.my - y); }
      grid[y * N + x] = 1;
    };
    const seen = new Set([0]), stack = [0];
    while (stack.length) {
      const i = stack[stack.length - 1], r = rooms[i];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (r.cx + dx >= 0 && r.cx + dx < C && r.cy + dy >= 0 && r.cy + dy < C ? (r.cy + dy) * C + r.cx + dx : -1)).filter((j) => j >= 0 && !seen.has(j));
      if (!nb.length) { stack.pop(); continue; }
      const j = nb[Math.floor(R() * nb.length)]; seen.add(j); carve(r, rooms[j]); stack.push(j);
    }
    for (let k = 0; k < 3; k++) { const a = Math.floor(R() * rooms.length), b = a + (R() < 0.5 ? 1 : C); if (b < rooms.length && (b !== a + 1 || rooms[a].cx < C - 1)) carve(rooms[a], rooms[b]); }
    // tile BFS from start room to find the farthest room for the boss
    const start = rooms[0], distT = new Int16Array(N * N).fill(-1), q = [start.my * N + start.mx]; distT[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx; if (grid[j] && distT[j] < 0) { distT[j] = distT[i] + 1; q.push(j); } } }
    let boss = rooms[rooms.length - 1], bd = -1;
    for (const r of rooms) { const d = distT[r.my * N + r.mx]; if (d > bd) { bd = d; boss = r; } }
    this.lab = { idx, grid, rooms, name: LAB_NAMES[idx], start: { x: (start.mx + 0.5) * T, y: (start.my + 0.5) * T }, bossRoom: boss, bossSpawned: false, cleared: false,
      flow: new Int16Array(N * N), floor: [] };
    for (let i = 0; i < N * N; i++) if (grid[i]) this.lab.floor.push(i);
    // walls: merge solid tiles into rects
    const active = new Map();
    const flush = (key) => { const r = active.get(key); active.delete(key); this.labWall(r.x0 * T, r.y0 * T, (r.x1 - r.x0) * T, (r.y1 - r.y0) * T); };
    for (let y = 0; y <= N; y++) {
      const runs = new Set();
      if (y < N) { let x = 0; while (x < N) { if (!grid[y * N + x]) { const s = x; while (x < N && !grid[y * N + x]) x++; const key = s + ',' + x; runs.add(key); if (active.has(key)) active.get(key).y1 = y + 1; else active.set(key, { x0: s, x1: x, y0: y, y1: y + 1 }); } else x++; } }
      for (const key of [...active.keys()]) if (!runs.has(key)) flush(key);
    }
    // outer void
    this.addOb({ t: 1, x: N * T, y: 0, w: WORLD - N * T, h: WORLD }); this.addOb({ t: 1, x: 0, y: N * T, w: N * T, h: WORLD - N * T });
    // exit hatch, anomalies, crates
    const sx = this.lab.start.x, sy = this.lab.start.y;
    this.hatches.push({ x: sx, y: sy - 20, idx: -1, name: 'Exit to surface', exit: true });
    this.addProp({ kind: 'hatch', x: sx, y: sy - 20, sy: sy - 50, h: this.hatches[0], bx0: sx - 80, bx1: sx + 80, by0: sy - 140, by1: sy + 30 });
    const mid = rooms.filter((r) => r !== start && r !== boss).sort(() => R() - 0.5);
    for (let k = 0; k < 3 && k < mid.length; k++) { const r = mid[k]; this.makeField((r.mx + 0.5) * T, (r.my + 0.5) * T, pick(['electro', 'burner', 'vortex', 'tesla', 'gas', 'cryo', 'psifield']), 2 + Math.floor(R() * 2), Math.min(r.w, r.h) * T * 0.35, R); }
    for (let k = 3; k < 9 && k < mid.length; k++) { const r = mid[k]; this.crateSpots.push({ x: (r.x0 + 0.5 + R() * (r.w - 1)) * T, y: (r.y0 + 0.5 + R() * (r.h - 1)) * T }); }
    for (let k = 0; k < mid.length; k++) if (R() < 0.5) { const r = mid[k], x = (r.x0 + 0.6) * T, y = (r.y0 + r.h - 0.6) * T; if (this.free(x, y, 14)) this.addBarrel(x, y, true); }
    this.labels.push({ x: (boss.mx + 0.5) * T, y: (boss.my + 0.5) * T, name: '☠ Guardian' });
    this.dark = 0.9;
    this.buildMap();
    return this.snapshot();
  },
  labWall(x, y, w, h) {
    this.addOb({ t: 1, x, y, w, h });
    this.addProp({ kind: 'building', style: 'lab', x, y, w, h, hgt: 70, sy: y + h, seed: (x * 7 + y * 13) | 0, bx0: x - 90, bx1: x + w + 90, by0: y - 150, by1: y + h + 20 });
  },
  computeFlow(px, py) {
    const L = this.lab, N = LAB_N, f = L.flow; f.fill(-1);
    const sx = clamp(Math.floor(px / LAB_T), 0, N - 1), sy = clamp(Math.floor(py / LAB_T), 0, N - 1), s = sy * N + sx;
    if (!L.grid[s]) return;
    const q = [s]; f[s] = 0;
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx; if (L.grid[j] && f[j] < 0) { f[j] = f[i] + 1; q.push(j); } } }
  },
  flowDir(x, y) {
    const L = this.lab, N = LAB_N, tx = Math.floor(x / LAB_T), ty = Math.floor(y / LAB_T);
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return null;
    const here = L.flow[ty * N + tx]; if (here <= 1) return null;
    let best = here, bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const v = L.flow[ny * N + nx];
      if (v >= 0 && v < best && (dx === 0 || dy === 0 || (L.grid[ty * N + nx] && L.grid[ny * N + tx]))) { best = v; bx = dx; by = dy; }
    }
    if (!bx && !by) return null;
    const cx = (tx + bx + 0.5) * LAB_T - x, cy = (ty + by + 0.5) * LAB_T - y, l = Math.hypot(cx, cy) || 1;
    return [cx / l, cy / l];
  },
  enterLevel(key) {
    this.levels[this.cur] = this.snapshot();
    if (!this.levels[key]) this.levels[key] = this.genLab(+key.slice(3));
    this.restore(this.levels[key]); this.cur = key;
  },

  // ---------- ground rendering ----------
  groundColor(x, y) {
    if (this.kind === 'lab') return [10, 10, 11];
    const rr = this.regionIdxRaw(x, y), A = this.regions[rr.i], B = this.regions[rr.j];
    const n = fbm(x / 340, y / 340, 1);
    let c = mixc(A.g, A.a, clamp(n * 1.6 - 0.3, 0, 1));
    if (rr.t < 1) { const cb = mixc(B.g, B.a, clamp(n * 1.6 - 0.3, 0, 1)); c = mixc(cb, c, 0.5 + rr.t * 0.5); }
    const d = (vnoise(x / 60, y / 60, 5) - 0.5) * 22;
    c = [c[0] + d, c[1] + d, c[2] + d * 0.8];
    if (A.water) { const w = fbm(x / 260, y / 260, 5); if (w > 0.58) c = mixc(c, [40, 60, 64], clamp((w - 0.58) * 9, 0, 0.9)); }
    if (A.red) { const w = fbm(x / 200, y / 200, 8); if (w > 0.62) c = mixc(c, [150, 60, 30], 0.35); }
    return c;
  },
  chunk(cx, cy) {
    const key = cy * 100 + cx;
    let c = this.chunks.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = CHUNK;
    const g = c.getContext('2d');
    if (this.kind === 'lab') this.labChunk(g, cx, cy); else this.overChunk(g, cx, cy);
    this.chunks.set(key, c); this.chunkOrder.push(key);
    if (this.chunkOrder.length > 48) this.chunks.delete(this.chunkOrder.shift());
    return c;
  },
  labChunk(g, cx, cy) {
    g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, CHUNK, CHUNK);
    const R = mulberry32(cy * 131 + cx + 77);
    const gx0 = Math.floor((cx * CHUNK) / LAB_T), gx1 = Math.floor((cx * CHUNK + CHUNK - 1) / LAB_T);
    const gy0 = Math.floor((cy * CHUNK) / LAB_T), gy1 = Math.floor((cy * CHUNK + CHUNK - 1) / LAB_T);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      if (gx >= LAB_N || gy >= LAB_N || !this.lab.grid[gy * LAB_N + gx]) continue;
      const ox = gx * LAB_T - cx * CHUNK, oy = gy * LAB_T - cy * CHUNK, v = hash2(gx, gy, 3) * 14;
      g.fillStyle = `rgb(${58 + v},${60 + v},${62 + v})`; g.fillRect(ox, oy, LAB_T, LAB_T);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let k = 0; k <= LAB_T; k += 40) { g.beginPath(); g.moveTo(ox + k, oy); g.lineTo(ox + k, oy + LAB_T); g.moveTo(ox, oy + k); g.lineTo(ox + LAB_T, oy + k); g.stroke(); }
      if (hash2(gx, gy, 9) < 0.25) { g.fillStyle = 'rgba(30,24,18,0.35)'; g.beginPath(); g.ellipse(ox + R() * LAB_T, oy + R() * LAB_T, 10 + R() * 25, 6 + R() * 12, R() * 3, 0, TAU); g.fill(); }
      if (hash2(gx, gy, 11) < 0.08) { g.fillStyle = 'rgba(120,20,15,0.4)'; g.beginPath(); g.ellipse(ox + 40, oy + 40, 18, 9, R() * 3, 0, TAU); g.fill(); }
      if (hash2(gx, gy, 13) < 0.1) { g.strokeStyle = 'rgba(200,180,40,0.35)'; g.lineWidth = 6; g.setLineDash([10, 10]); g.beginPath(); g.moveTo(ox, oy + 6); g.lineTo(ox + LAB_T, oy + 6); g.stroke(); g.setLineDash([]); }
    }
  },
  overChunk(g, cx, cy) {
    const S = 66, sc = document.createElement('canvas'); sc.width = sc.height = S;
    const sg = sc.getContext('2d'), img = sg.createImageData(S, S), ox = cx * CHUNK - 8, oy = cy * CHUNK - 8;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const col = this.groundColor(ox + px * 8 + 4, oy + py * 8 + 4), k = (py * S + px) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(sc, 1, 1, 64, 64, 0, 0, CHUNK, CHUNK);
    const R = mulberry32((cy * 100 + cx) * 7919 + 13);
    g.save(); g.translate(-cx * CHUNK, -cy * CHUNK);
    for (let i = 0; i < 130; i++) {
      const x = cx * CHUNK + R() * CHUNK, y = cy * CHUNK + R() * CHUNK, reg = this.region(x, y);
      const t = R();
      if (t < 0.55) {
        g.strokeStyle = reg.red ? 'rgba(170,80,40,0.55)' : reg.cracks ? 'rgba(90,110,60,0.5)' : 'rgba(150,160,80,0.45)';
        g.lineWidth = 1.4; g.beginPath();
        for (let k = 0; k < 4; k++) { g.moveTo(x + k * 2, y); g.lineTo(x + k * 2 + (R() - 0.5) * 5, y - 5 - R() * 6); }
        g.stroke();
      } else if (t < 0.8) {
        g.fillStyle = 'rgba(40,36,28,0.18)'; g.beginPath(); g.ellipse(x, y, 10 + R() * 30, 5 + R() * 14, R() * 3, 0, TAU); g.fill();
      } else if (t < 0.93) {
        g.fillStyle = 'rgba(160,155,140,0.55)'; g.beginPath(); g.ellipse(x, y, 2 + R() * 3, 1.5 + R() * 2, 0, 0, TAU); g.fill();
      } else if (reg.cracks) {
        g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
        let px = x, py = y; for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; g.lineTo(px, py); } g.stroke();
      }
    }
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const road of this.roads) {
      g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = 'rgba(92,84,68,0.9)'; g.lineWidth = 118; g.stroke();
      g.strokeStyle = 'rgb(74,73,70)'; g.lineWidth = 92; g.stroke();
      g.setLineDash([36, 44]); g.strokeStyle = 'rgba(190,180,130,0.35)'; g.lineWidth = 4; g.stroke(); g.setLineDash([]);
    }
    for (let i = 0; i < 40; i++) {
      const x = cx * CHUNK + R() * CHUNK, y = cy * CHUNK + R() * CHUNK;
      if (this.roadDist(x, y) > 44) continue;
      if (R() < 0.5) { g.fillStyle = 'rgba(35,34,32,0.6)'; g.beginPath(); g.ellipse(x, y, 6 + R() * 12, 4 + R() * 7, R() * 3, 0, TAU); g.fill(); }
      else { g.strokeStyle = 'rgba(30,30,28,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); let px = x, py = y; for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 26; py += (R() - 0.5) * 26; g.lineTo(px, py); } g.stroke(); }
    }
    g.restore();
  },
  buildMap() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), k = WORLD / S;
    if (this.kind === 'lab') {
      g.fillStyle = '#050505'; g.fillRect(0, 0, S, S);
      const f = LAB_T / k;
      for (let i = 0; i < LAB_N * LAB_N; i++) if (this.lab.grid[i]) { g.fillStyle = '#5a5e62'; g.fillRect((i % LAB_N) * f, Math.floor(i / LAB_N) * f, f + 0.5, f + 0.5); }
      this.mapImg = c; return;
    }
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const col = this.groundColor(x * k + k / 2, y * k + k / 2), i = (y * S + x) * 4;
      img.data[i] = col[0] * 0.8; img.data[i + 1] = col[1] * 0.8; img.data[i + 2] = col[2] * 0.8; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.scale(1 / k, 1 / k);
    g.lineJoin = 'round';
    for (const road of this.roads) { g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = 'rgba(60,58,54,0.95)'; g.lineWidth = 70; g.stroke(); }
    g.fillStyle = 'rgba(20,40,20,0.35)';
    for (const p of this.props) if (p.kind === 'tree') { g.beginPath(); g.arc(p.x, p.y, 26, 0, TAU); g.fill(); }
    for (const p of this.props) if (p.kind === 'building') { g.fillStyle = 'rgba(40,36,34,0.95)'; g.fillRect(p.x, p.y, p.w, p.h); }
    for (const r of this.rads) { g.fillStyle = 'rgba(220,210,40,0.18)'; g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.fill(); }
    this.mapImg = c;
  },
};
