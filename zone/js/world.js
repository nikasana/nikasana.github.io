'use strict';
// ---------- the Zone: map generation, ground, obstacles, props ----------
const WORLD = 6400, CHUNK = 512, OBCELL = 128, PCELL = 256;
const START = { x: 3200, y: 5650 };

const REGIONS = [
  { id: 'cordon', name: 'Cordon', x: 3200, y: 5500, g: [112, 118, 66], a: [132, 112, 74], danger: 1 },
  { id: 'swamp', name: 'Great Swamps', x: 900, y: 4300, g: [70, 84, 58], a: [58, 72, 50], danger: 2 },
  { id: 'swamp', name: 'Great Swamps', x: 1000, y: 5900, g: [70, 84, 58], a: [58, 72, 50], danger: 2 },
  { id: 'valley', name: 'Dark Valley', x: 2900, y: 3600, g: [60, 78, 50], a: [78, 74, 54], danger: 2 },
  { id: 'factory', name: 'Rostok Factory', x: 5400, y: 4100, g: [104, 102, 96], a: [90, 94, 74], danger: 3 },
  { id: 'factory', name: 'Rostok Factory', x: 5500, y: 5800, g: [104, 102, 96], a: [90, 94, 74], danger: 3 },
  { id: 'garbage', name: 'The Garbage', x: 4300, y: 2600, g: [102, 90, 66], a: [84, 80, 60], danger: 3 },
  { id: 'red', name: 'Red Forest', x: 1400, y: 1500, g: [120, 72, 46], a: [98, 58, 40], danger: 4 },
  { id: 'wild', name: 'Wild Territory', x: 2700, y: 2000, g: [88, 94, 62], a: [104, 96, 70], danger: 3 },
  { id: 'radar', name: 'The Radar', x: 4800, y: 900, g: [84, 88, 78], a: [68, 72, 64], danger: 5 },
];

const ROADS = [
  [[3200, 6500], [3220, 5900], [3150, 5400], [3050, 4700], [2950, 4000], [2980, 3400], [3400, 3000], [4200, 2650], [4500, 2000], [4700, 1400], [4800, 900]],
  [[3100, 4700], [2400, 4650], [1700, 4500], [1000, 4400], [400, 4500]],
  [[2980, 3400], [2500, 2800], [2000, 2300], [1500, 1700], [1100, 1100]],
  [[4200, 2650], [4800, 3200], [5300, 3900], [5500, 4700], [5500, 5800], [5200, 6500]],
  [[3150, 5400], [4000, 5550], [4800, 5700], [5500, 5800]],
  [[1000, 4400], [1100, 5200], [1000, 5900]],
];

const World = {
  seed: 20260926,
  regionGrid: null, obstacles: [], obGrid: [], props: [], propGrid: [],
  anomalies: [], fields: [], shelters: [], rads: [], crateSpots: [], chunks: new Map(), chunkOrder: [],
  labels: [], mapImg: null, stamp: 1,

  gen() {
    const R = mulberry32(this.seed);
    this.R = R;
    // region lookup grid (64px)
    const G = WORLD / 64;
    this.regionGrid = new Int8Array(G * G);
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) this.regionGrid[gy * G + gx] = this.regionIdxRaw(gx * 64 + 32, gy * 64 + 32).i;
    const OC = WORLD / OBCELL; this.obGrid = []; for (let i = 0; i < OC * OC; i++) this.obGrid.push([]);
    const PC = WORLD / PCELL; this.propGrid = []; for (let i = 0; i < PC * PC; i++) this.propGrid.push([]);

    this.genStructures(R);
    this.genAnomalies(R);
    this.genNature(R);
    this.genMisc(R);
    this.buildMap();
  },

  regionIdxRaw(x, y) {
    const wx = x + (fbm(x / 900, y / 900, 3) - 0.5) * 900, wy = y + (fbm(x / 900, y / 900, 9) - 0.5) * 900;
    let b = 1e12, bi = 0, s = 1e12, si = 0;
    for (let i = 0; i < REGIONS.length; i++) {
      const d = dist2(wx, wy, REGIONS[i].x, REGIONS[i].y);
      if (d < b) { s = b; si = bi; b = d; bi = i; } else if (d < s) { s = d; si = i; }
    }
    return { i: bi, j: si, t: clamp((Math.sqrt(s) - Math.sqrt(b)) / 260, 0, 1) };
  },
  region(x, y) {
    const G = WORLD / 64, gx = clamp(Math.floor(x / 64), 0, G - 1), gy = clamp(Math.floor(y / 64), 0, G - 1);
    return REGIONS[this.regionGrid[gy * G + gx]];
  },
  roadDist(x, y) {
    let best = 1e9;
    for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = r[i], [bx, by] = r[i + 1];
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / l, 0, 1);
      const d = dist(x, y, ax + dx * t, ay + dy * t);
      if (d < best) best = d;
    }
    return best;
  },

  // ---------- obstacles ----------
  addOb(ob) {
    this.obstacles.push(ob);
    const OC = WORLD / OBCELL;
    const x0 = ob.t ? ob.x : ob.x - ob.r, y0 = ob.t ? ob.y : ob.y - ob.r;
    const x1 = ob.t ? ob.x + ob.w : ob.x + ob.r, y1 = ob.t ? ob.y + ob.h : ob.y + ob.r;
    for (let cy = Math.max(0, Math.floor(y0 / OBCELL)); cy <= Math.min(OC - 1, Math.floor(y1 / OBCELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / OBCELL)); cx <= Math.min(OC - 1, Math.floor(x1 / OBCELL)); cx++)
        this.obGrid[cy * OC + cx].push(ob);
  },
  addProp(p) {
    this.props.push(p);
    const PC = WORLD / PCELL;
    const x0 = p.bx0 ?? p.x - 60, x1 = p.bx1 ?? p.x + 60, y0 = p.by0 ?? p.y - 120, y1 = p.by1 ?? p.y + 30;
    for (let cy = Math.max(0, Math.floor(y0 / PCELL)); cy <= Math.min(PC - 1, Math.floor(y1 / PCELL)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / PCELL)); cx <= Math.min(PC - 1, Math.floor(x1 / PCELL)); cx++)
        this.propGrid[cy * PC + cx].push(p);
  },
  // is a circle free of obstacles (+margin)?
  free(x, y, r) {
    if (x < r || y < r || x > WORLD - r || y > WORLD - r) return false;
    const OC = WORLD / OBCELL;
    for (let cy = Math.max(0, Math.floor((y - r) / OBCELL)); cy <= Math.min(OC - 1, Math.floor((y + r) / OBCELL)); cy++)
      for (let cx = Math.max(0, Math.floor((x - r) / OBCELL)); cx <= Math.min(OC - 1, Math.floor((x + r) / OBCELL)); cx++)
        for (const ob of this.obGrid[cy * OC + cx]) {
          if (ob.t) { const nx = clamp(x, ob.x, ob.x + ob.w), ny = clamp(y, ob.y, ob.y + ob.h); if (dist2(x, y, nx, ny) < r * r) return false; }
          else if (dist2(x, y, ob.x, ob.y) < (r + ob.r) ** 2) return false;
        }
    return true;
  },
  // bullets: hard obstacles only
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

  // ---------- generation ----------
  building(x, y, w, h, hgt, style) {
    if (!this.free(x + w / 2, y + h / 2, Math.max(w, h) * 0.55)) return null;
    const b = { kind: 'building', x, y, w, h, hgt, style, sy: y + h, bx0: x - 80, bx1: x + w + 80, by0: y - hgt - 60, by1: y + h + 20,
      seed: Math.floor(this.R() * 1e6), holes: this.R() < 0.5 };
    this.addOb({ t: 1, x, y, w, h });
    this.addProp(b);
    return b;
  },
  genStructures(R) {
    // Rookie village (Cordon)
    const vil = [[2860, 5380], [3380, 5330], [2830, 5620], [3420, 5620], [2880, 5900], [3450, 5920], [3600, 5460], [2640, 5520]];
    for (const [x, y] of vil) this.building(x - 80, y - 60, 150 + R() * 40, 105 + R() * 25, 62 + R() * 18, 'house');
    this.labels.push({ x: 3200, y: 5620, name: 'Rookie Village' });
    // factory complexes
    const fac = (cx, cy) => {
      for (let i = 0; i < 7; i++) {
        const w = 260 + R() * 260, h = 160 + R() * 160;
        this.building(cx + (R() - 0.5) * 900 - w / 2, cy + (R() - 0.5) * 900 - h / 2, w, h, 110 + R() * 70, 'factory');
      }
      for (let i = 0; i < 6; i++) { const x = cx + (R() - 0.5) * 1000, y = cy + (R() - 0.5) * 1000; if (this.free(x, y, 30)) this.addTank(x, y, R); }
    };
    fac(5400, 4150); fac(5500, 5750);
    this.labels.push({ x: 5400, y: 4150, name: 'Rostok' }, { x: 5500, y: 5750, name: 'Agroprom' });
    // radar (final area)
    this.tower(4800, 820, 420); this.tower(4380, 1080, 300); this.tower(5230, 1120, 300);
    for (let i = 0; i < 5; i++) this.building(4400 + R() * 900, 1300 + R() * 500, 200 + R() * 140, 130 + R() * 80, 100 + R() * 40, 'factory');
    this.labels.push({ x: 4800, y: 1000, name: 'Brain Scorcher' });
    // swamp huts
    for (let i = 0; i < 9; i++) this.building(600 + R() * 900, 3800 + R() * 2300, 110 + R() * 30, 80 + R() * 20, 50 + R() * 12, 'hut');
    // ruins everywhere
    for (let i = 0; i < 42; i++) {
      const x = 300 + R() * 5800, y = 300 + R() * 5800;
      if (dist(x, y, START.x, START.y) < 500 || this.roadDist(x, y) < 140) continue;
      this.building(x, y, 110 + R() * 150, 90 + R() * 90, 40 + R() * 70, R() < 0.5 ? 'ruin' : 'house');
    }
    // garbage heaps
    for (let i = 0; i < 26; i++) {
      const x = 3700 + R() * 1300, y = 2100 + R() * 1100, r = 40 + R() * 60;
      if (this.roadDist(x, y) > 110 && this.free(x, y, r + 20)) { this.addOb({ x, y, r: r * 0.8 }); this.addProp({ kind: 'heap', x, y, r, sy: y, seed: R() * 1e6, by0: y - r - 60, by1: y + r, bx0: x - r - 20, bx1: x + r + 20 }); }
    }
    this.labels.push({ x: 4300, y: 2600, name: 'Garbage' });
    // wrecked vehicles along roads
    for (const road of ROADS) for (let i = 0; i < road.length - 1; i++) {
      if (R() < 0.55) {
        const [ax, ay] = road[i], [bx, by] = road[i + 1], t = R();
        const x = lerp(ax, bx, t) + (R() - 0.5) * 60, y = lerp(ay, by, t) + (R() - 0.5) * 60;
        if (dist(x, y, START.x, START.y) > 300 && this.free(x, y, 50)) this.addWreck(x, y, R);
      }
    }
    // shelters
    const sh = [[3200, 5480], [1200, 4700], [900, 5700], [2600, 3900], [3300, 3100], [5000, 4400], [5800, 5300], [4600, 2300], [3600, 2200],
      [1800, 2200], [1000, 1300], [4400, 1600], [5400, 1300], [2300, 5200], [4300, 5200], [5900, 3300], [2000, 3200], [600, 3300]];
    for (const [x, y] of sh) {
      let px = x, py = y, tries = 0;
      while (!this.free(px, py, 80) && tries++ < 40) { px = x + (R() - 0.5) * 400; py = y + (R() - 0.5) * 400; }
      const s = { x: px, y: py, r: 72 };
      this.shelters.push(s);
      this.addOb({ t: 1, x: px - 40, y: py - 78, w: 80, h: 30 });
      this.addProp({ kind: 'bunker', x: px, y: py, sy: py - 48, bx0: px - 90, bx1: px + 90, by0: py - 150, by1: py + 80 });
    }
  },
  tower(x, y, h) {
    this.addOb({ x, y, r: 26 });
    this.addProp({ kind: 'tower', x, y, h, sy: y, bx0: x - 200, bx1: x + 200, by0: y - h - 40, by1: y + 40 });
  },
  addTank(x, y, R) {
    const r = 34 + R() * 16;
    this.addOb({ x, y, r });
    this.addProp({ kind: 'tank', x, y, r, h: 60 + R() * 60, sy: y, bx0: x - r - 40, bx1: x + r + 40, by0: y - 180, by1: y + r });
  },
  addWreck(x, y, R) {
    const a = (R() - 0.5) * 0.8, bus = R() < 0.25, w = bus ? 150 : 90, h = 44;
    this.addOb({ t: 1, x: x - w / 2, y: y - h / 2, w, h });
    this.addProp({ kind: 'wreck', x, y, w, h, bus, a, col: pick([[90, 110, 80], [120, 60, 40], [70, 90, 110], [150, 140, 110]]), sy: y + h / 2, bx0: x - w, bx1: x + w, by0: y - 100, by1: y + 40 });
  },
  genAnomalies(R) {
    const byRegion = {
      cordon: ['spring', 'electro', 'acid'], swamp: ['acid', 'electro', 'acid', 'spring'], valley: ['spring', 'vortex', 'acid'],
      factory: ['electro', 'burner', 'electro'], garbage: ['vortex', 'spring', 'burner'], red: ['burner', 'electro', 'vortex', 'burner'],
      wild: ['vortex', 'electro', 'spring'], radar: ['electro', 'burner', 'vortex', 'acid'],
    };
    let made = 0, tries = 0;
    while (made < 52 && tries++ < 2000) {
      const x = 250 + R() * 5900, y = 250 + R() * 5900;
      if (dist(x, y, START.x, START.y) < 650) continue;
      if (this.fields.some((f) => dist(f.x, f.y, x, y) < 520)) continue;
      if (!this.free(x, y, 90)) continue;
      const reg = this.region(x, y), type = pick(byRegion[reg.id]);
      const f = { x, y, type, anoms: [], art: null };
      const n = 3 + Math.floor(R() * 4) + (reg.danger > 3 ? 2 : 0);
      for (let i = 0; i < n * 3 && f.anoms.length < n; i++) {
        const a = R() * TAU, d = 30 + R() * 230, ax = x + Math.cos(a) * d, ay = y + Math.sin(a) * d;
        const r = ANOMALIES[type].r * (0.8 + R() * 0.4);
        if (!this.free(ax, ay, 20) || f.anoms.some((o) => dist(o.x, o.y, ax, ay) < o.r + r + 20)) continue;
        const an = { type, x: ax, y: ay, r, cd: R() * 2, t: 0, act: 0, seed: R() * 100, field: f };
        f.anoms.push(an); this.anomalies.push(an);
      }
      if (f.anoms.length) { this.fields.push(f); made++; }
    }
    // radiation spots
    for (let i = 0; i < 30; i++) {
      const x = 300 + R() * 5800, y = 300 + R() * 5800;
      if (dist(x, y, START.x, START.y) < 700) continue;
      this.rads.push({ x, y, r: 90 + R() * 160 });
    }
  },
  genNature(R) {
    const dens = { cordon: 0.16, swamp: 0.18, valley: 0.45, factory: 0.06, garbage: 0.05, red: 0.55, wild: 0.3, radar: 0.1 };
    for (let i = 0; i < 16000; i++) {
      const x = 60 + R() * 6280, y = 60 + R() * 6280;
      const reg = this.region(x, y);
      const cluster = fbm(x / 500, y / 500, 21);
      if (R() > dens[reg.id] * (cluster * 1.9 - 0.25)) continue;
      if (this.roadDist(x, y) < 80 || dist(x, y, START.x, START.y) < 240) continue;
      if (this.shelters.some((s) => dist(s.x, s.y, x, y) < 110)) continue;
      if (this.anomalies.some((a) => dist(a.x, a.y, x, y) < a.r + 10)) continue;
      const dead = reg.id === 'swamp' || reg.id === 'radar' || (reg.id === 'garbage') ? R() < 0.7 : R() < 0.12;
      const red = reg.id === 'red';
      const s = 0.8 + R() * 0.6;
      if (!this.free(x, y, 16 * s)) continue;
      this.addOb({ x, y, r: 9 * s, soft: true });
      this.addProp({ kind: dead ? 'deadtree' : 'tree', x, y, s, red, sy: y, seed: R() * 100, pine: reg.id === 'valley' || reg.id === 'wild' ? R() < 0.6 : R() < 0.2,
        bx0: x - 70 * s, bx1: x + 70 * s, by0: y - 170 * s, by1: y + 40 });
    }
    // rocks
    for (let i = 0; i < 300; i++) {
      const x = 80 + R() * 6240, y = 80 + R() * 6240, r = 14 + R() * 26;
      if (this.roadDist(x, y) < 80 || dist(x, y, START.x, START.y) < 260 || !this.free(x, y, r + 10)) continue;
      if (this.anomalies.some((a) => dist(a.x, a.y, x, y) < a.r + r)) continue;
      this.addOb({ x, y, r: r * 0.9 });
      const pts = []; const n = 7; for (let k = 0; k < n; k++) pts.push(0.75 + R() * 0.35);
      this.addProp({ kind: 'rock', x, y, r, pts, sy: y, bx0: x - r - 10, bx1: x + r + 10, by0: y - r * 2, by1: y + r });
    }
    // bushes & grass (decor, no collision)
    for (let i = 0; i < 5000; i++) {
      const x = R() * WORLD, y = R() * WORLD, reg = this.region(x, y);
      if (this.roadDist(x, y) < 60) continue;
      const k = reg.id === 'swamp' ? 'reeds' : R() < 0.5 ? 'bush' : 'grass';
      this.addProp({ kind: k, x, y, s: 0.7 + R() * 0.6, red: reg.id === 'red', sy: y, seed: R() * 100, bx0: x - 30, bx1: x + 30, by0: y - 50, by1: y + 10 });
    }
    // fences / barrels / pylons
    for (let i = 0; i < 90; i++) {
      const x = 200 + R() * 6000, y = 200 + R() * 6000;
      if (dist(x, y, START.x, START.y) < 260 || !this.free(x, y, 16)) continue;
      this.addOb({ x, y, r: 11 });
      this.addProp({ kind: 'barrel', x, y, sy: y, rad: R() < 0.4, bx0: x - 20, bx1: x + 20, by0: y - 40, by1: y + 10 });
    }
    for (let i = 0; i < 14; i++) {
      const x = 600 + i * 400 + R() * 60, y = 3000 + Math.sin(i * 0.6) * 300;
      if (this.free(x, y, 20)) { this.addOb({ x, y, r: 10 }); this.addProp({ kind: 'pylon', x, y, sy: y, bx0: x - 100, bx1: x + 100, by0: y - 280, by1: y + 20 }); }
    }
  },
  genMisc(R) {
    for (let i = 0; i < 140; i++) {
      const x = 150 + R() * 6100, y = 150 + R() * 6100;
      if (this.free(x, y, 24) && dist(x, y, START.x, START.y) > 200) this.crateSpots.push({ x, y });
    }
  },

  // ---------- ground rendering ----------
  groundColor(x, y) {
    const rr = this.regionIdxRaw(x, y), A = REGIONS[rr.i], B = REGIONS[rr.j];
    const n = fbm(x / 340, y / 340, 1);
    let c = mixc(A.g, A.a, clamp(n * 1.6 - 0.3, 0, 1));
    if (rr.t < 1) { const cb = mixc(B.g, B.a, clamp(n * 1.6 - 0.3, 0, 1)); c = mixc(cb, c, 0.5 + rr.t * 0.5); }
    const d = (vnoise(x / 60, y / 60, 5) - 0.5) * 22;
    c = [c[0] + d, c[1] + d, c[2] + d * 0.8];
    if (A.id === 'swamp') { const w = fbm(x / 260, y / 260, 5); if (w > 0.58) c = mixc(c, [40, 60, 64], clamp((w - 0.58) * 9, 0, 0.9)); }
    if (A.id === 'red') { const w = fbm(x / 200, y / 200, 8); if (w > 0.62) c = mixc(c, [150, 60, 30], 0.35); }
    return c;
  },
  chunk(cx, cy) {
    const key = cy * 100 + cx;
    let c = this.chunks.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = CHUNK;
    const g = c.getContext('2d');
    const S = 66, sc = document.createElement('canvas'); sc.width = sc.height = S;
    const sg = sc.getContext('2d'), img = sg.createImageData(S, S), ox = cx * CHUNK - 8, oy = cy * CHUNK - 8;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const col = this.groundColor(ox + px * 8 + 4, oy + py * 8 + 4), k = (py * S + px) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(sc, 1, 1, 64, 64, 0, 0, CHUNK, CHUNK);
    const R = mulberry32(key * 7919 + 13);
    g.save(); g.translate(-cx * CHUNK, -cy * CHUNK);
    // details: dirt, stones, tufts
    for (let i = 0; i < 130; i++) {
      const x = cx * CHUNK + R() * CHUNK, y = cy * CHUNK + R() * CHUNK, reg = this.region(x, y);
      const t = R();
      if (t < 0.55) {
        g.strokeStyle = reg.id === 'red' ? 'rgba(170,80,40,0.55)' : reg.id === 'factory' ? 'rgba(90,110,60,0.5)' : 'rgba(150,160,80,0.45)';
        g.lineWidth = 1.4; g.beginPath();
        for (let k = 0; k < 4; k++) { g.moveTo(x + k * 2, y); g.lineTo(x + k * 2 + (R() - 0.5) * 5, y - 5 - R() * 6); }
        g.stroke();
      } else if (t < 0.8) {
        g.fillStyle = 'rgba(40,36,28,0.18)'; g.beginPath(); g.ellipse(x, y, 10 + R() * 30, 5 + R() * 14, R() * 3, 0, TAU); g.fill();
      } else if (t < 0.93) {
        g.fillStyle = 'rgba(160,155,140,0.55)'; g.beginPath(); g.ellipse(x, y, 2 + R() * 3, 1.5 + R() * 2, 0, 0, TAU); g.fill();
      } else if (reg.id === 'factory' || reg.id === 'radar') {
        g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
        let px = x, py = y; for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; g.lineTo(px, py); } g.stroke();
      }
    }
    // roads
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const road of ROADS) {
      g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = 'rgba(92,84,68,0.9)'; g.lineWidth = 118; g.stroke();
      g.strokeStyle = 'rgb(74,73,70)'; g.lineWidth = 92; g.stroke();
      g.setLineDash([36, 44]); g.strokeStyle = 'rgba(190,180,130,0.35)'; g.lineWidth = 4; g.stroke(); g.setLineDash([]);
    }
    // road cracks & potholes
    for (let i = 0; i < 40; i++) {
      const x = cx * CHUNK + R() * CHUNK, y = cy * CHUNK + R() * CHUNK;
      if (this.roadDist(x, y) > 44) continue;
      if (R() < 0.5) { g.fillStyle = 'rgba(35,34,32,0.6)'; g.beginPath(); g.ellipse(x, y, 6 + R() * 12, 4 + R() * 7, R() * 3, 0, TAU); g.fill(); }
      else { g.strokeStyle = 'rgba(30,30,28,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); let px = x, py = y; for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 26; py += (R() - 0.5) * 26; g.lineTo(px, py); } g.stroke(); }
      if (R() < 0.2) { g.fillStyle = 'rgba(110,130,60,0.5)'; g.fillRect(x, y, 3, 3); }
    }
    g.restore();
    this.chunks.set(key, c); this.chunkOrder.push(key);
    if (this.chunkOrder.length > 48) this.chunks.delete(this.chunkOrder.shift());
    return c;
  },

  buildMap() {
    const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), k = WORLD / S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const col = this.groundColor(x * k + k / 2, y * k + k / 2), i = (y * S + x) * 4;
      img.data[i] = col[0] * 0.8; img.data[i + 1] = col[1] * 0.8; img.data[i + 2] = col[2] * 0.8; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.scale(1 / k, 1 / k);
    g.lineJoin = 'round';
    for (const road of ROADS) { g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = 'rgba(60,58,54,0.95)'; g.lineWidth = 70; g.stroke(); }
    g.fillStyle = 'rgba(20,40,20,0.35)';
    for (const p of this.props) if (p.kind === 'tree') { g.beginPath(); g.arc(p.x, p.y, 26, 0, TAU); g.fill(); }
    for (const p of this.props) if (p.kind === 'building') { g.fillStyle = 'rgba(40,36,34,0.95)'; g.fillRect(p.x, p.y, p.w, p.h); }
    for (const r of this.rads) { g.fillStyle = 'rgba(220,210,40,0.18)'; g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.fill(); }
    this.mapImg = c;
  },
};
