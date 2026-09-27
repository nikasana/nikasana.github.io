'use strict';
// ---------- performance on the lowest graphics setting ----------
// Every prop and creature is drawn from dozens of vector paths each frame, which is what limits phones under a big
// horde. On Lowest, static props and ordinary enemies are drawn once into a cached image at the current screen scale
// (same resolution) and stamped with a single drawImage afterwards. Enemies keep four walk frames plus a hit flash,
// cached facing right and mirrored for left (their draw functions mirror the same way); things that fade, depend on
// the player or are one of a kind (bosses) still draw live.
const SPRITES = {
  map: new Map(), px: 0, max: 16e6, scale: 0, tick: 0,
  // (ox, oy, w, h): the world-space box draw() may paint into. Returns { c, x, y, w, h } trimmed to what was painted.
  get(key, ox, oy, w, h, draw) {
    const s = ZOOM * DPR;
    if (s !== this.scale) { this.clear(); this.scale = s; }
    let sp = this.map.get(key);
    // keep the map in least-recently-used order (cheaply: refresh an entry on every 8th hit) so eviction drops what is far away
    if (sp) { if (++this.tick % 8 === 0) { this.map.delete(key); this.map.set(key, sp); } return sp; }
    const W = Math.max(1, Math.ceil(w * s)), H = Math.max(1, Math.ceil(h * s));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    const main = ctx; ctx = g;
    try { draw(); } catch (e) { /* needs live state: cache as empty rather than break the frame */ } finally { ctx = main; }
    // trim the transparent margin so the cache holds only painted pixels
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    try {
      const d = g.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y++) for (let x = 0, i = y * W * 4 + 3; x < W; x++, i += 4) if (d[i] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    } catch (e) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
    if (x1 < 0) sp = { c: null, px: 0 };
    else {
      const tw = x1 - x0 + 1, th = y1 - y0 + 1, t = document.createElement('canvas'); t.width = tw; t.height = th;
      t.getContext('2d').drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
      sp = { c: t, x: ox + x0 / s, y: oy + y0 / s, w: tw / s, h: th / s, px: tw * th };
    }
    this.map.set(key, sp); this.px += sp.px;
    while (this.px > this.max && this.map.size > 1) { const k = this.map.keys().next().value; this.drop(k); }
    return sp;
  },
  drop(key) { const v = this.map.get(key); if (v) { this.map.delete(key); this.px -= v.px; } },
  clear() { this.map.clear(); this.px = 0; },
};

// props that never change once placed (time-based sway or flicker simply freezes on Lowest)
const PROP_STATIC = new Set(['tree', 'deadtree', 'rock', 'bush', 'grass', 'reeds', 'building', 'bunker', 'tower', 'tank', 'wreck', 'heap', 'barrel', 'pylon', 'fence', 'sandbag', 'heli', 'tent', 'bones', 'wheel', 'chimney', 'pillar']);
function drawPropFast(p) {
  const fn = PROP_DRAW[p.kind];
  if (!minGfx() || !PROP_STATIC.has(p.kind) || !(p.bx1 > p.bx0 && p.by1 > p.by0)) return fn(p);
  // an open building you're standing in is hidden so you can see inside
  if (p.kind === 'building' && p.open && P && !G.title && P.x > p.x && P.x < p.x + p.w && P.y > p.y && P.y < p.y + p.h) return;
  if (p.kind === 'building' && p._sprChp !== p.chp) { SPRITES.drop(p); p._sprChp = p.chp; } // cracks show damage
  const pad = 30, x = p.bx0 - pad, y = p.by0 - pad, w = p.bx1 - p.bx0 + pad * 2, h = p.by1 - p.by0 + pad * 2;
  if (w * h > 1.5e6) return fn(p);
  const sp = SPRITES.get(p, x, y, w, h, () => fn(p));
  if (sp.c) blit(sp.c, sp.x, sp.y);
}

// these copy the player's current look: always drawn live. Fading mutants are cached opaque and faded when stamped.
const ENEMY_LIVE = new Set(['mirror', 'holoclone']);
function drawEnemyFast(e) {
  const fn = ENEMY_DRAW[e.id];
  if (!minGfx() || e.boss || e.mini || ENEMY_LIVE.has(e.id) || (e.alpha !== undefined && e.alpha < 0.99)) return fn(e);
  const fr = FL ? 'F' : Math.floor(((((e.anim || 0) % TAU) + TAU) % TAU) / TAU * 4) % 4;
  const R = Math.max(10, e.r || 12), w = R * 7 + 60, h = R * 7 + 60;
  const sp = SPRITES.get(e.id + '|' + fr, -w / 2, -h * 0.8, w, h, () => fn({ ...e, x: 0, y: 0, z: 0, anim: fr === 'F' ? 0 : ((fr + 0.5) / 4) * TAU, face: 1 }));
  if (!sp.c) return;
  const ey = e.y - (e.z || 0);
  if (e.face < 0) { ctx.scale(-1, 1); ctx.drawImage(sp.c, sp.x - e.x, ey + sp.y, sp.w, sp.h); ctx.scale(-1, 1); }
  else ctx.drawImage(sp.c, e.x + sp.x, ey + sp.y, sp.w, sp.h);
}

// XP gems: three looks, one cached image each
const GEM_LOOK = [[4, '#7dff8a'], [5.5, '#6ad0ff'], [7, '#ff6ad5']];
function drawGemFast(g, y) {
  const i = g.v >= 20 ? 2 : g.v >= 5 ? 1 : 0, [s, c] = GEM_LOOK[i];
  const sp = SPRITES.get('gem' + i, -8, -9, 16, 18, () => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-1, -s * 0.6, 2, s * 0.5);
  });
  if (sp.c) ctx.drawImage(sp.c, g.x + sp.x, y + sp.y, sp.w, sp.h);
}

// soft radial glows (explosions, clouds, holes, pickup and mutation auras) on the main game canvas become one flat
// translucent fill of their center color on Lowest: building and rasterizing ~100 gradients a frame is heavy on phones.
// The night lighting pass, sprite caches and casino canvases have their own contexts and are untouched.
{
  const MAIN = cv.getContext('2d'), P2 = CanvasRenderingContext2D.prototype, mk = P2.createRadialGradient;
  const memo = new Map();
  const soft = (c) => { let r = memo.get(c); if (r) return r; const m = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(c); r = m ? `rgba(${m[1]},${m[2]},${m[3]},${(+m[4] * 0.45).toFixed(2)})` : c; if (memo.size > 2000) memo.clear(); memo.set(c, r); return r; };
  // fillStyle turns any object that isn't a real gradient into a string, so the stand-in only needs toString()
  P2.createRadialGradient = function (...a) {
    if (this !== MAIN || !minGfx()) return mk.apply(this, a);
    return { c: '', addColorStop(o, c) { if (!this.c) this.c = soft(String(c)); }, toString() { return this.c || 'rgba(0,0,0,0)'; } };
  };
}

// sound on Lowest: a heavy fight starts dozens of gunfire/hit voices a second, each a few audio nodes. Cap those at
// 24 a second; anything that tells you something (level-up, quests, damage taken, bosses, pickups…) always plays.
const SFX_ALWAYS = new Set(['legend', 'quest', 'levelup', 'hurt', 'boss', 'hint', 'emission', 'psi', 'beep', 'coin', 'stash', 'heal', 'pickup', 'art', 'death', 'win', 'lose']);
{
  const play = Sfx.play; let win = 0, n = 0;
  Sfx.play = function (name) {
    if (minGfx() && !SFX_ALWAYS.has(name)) { const t = performance.now(); if (t - win > 250) { win = t; n = 0; } if (++n > (potatoGfx() ? 3 : 6)) return; }
    return play.call(this, name);
  };
}

// the weapon/item bar is rebuilt from DOM on every pickup, which in a horde means nearly every frame: on Lowest
// rebuild it at most five times a second
addEventListener('DOMContentLoaded', () => {
  const build = hudBuild; let t = 0;
  hudBuild = function () { if (!minGfx() || !G || G.title) return build(); if (!t) t = setTimeout(() => { t = 0; if (G && !G.title) build(); }, 200); };
});

// enemies on Lowest: the render loop's size/squash transform is folded into one drawImage (no save/restore per enemy)
function drawEnemyScaled(e, sx, sy) {
  const fn = ENEMY_DRAW[e.id];
  if (!minGfx() || e.boss || e.mini || ENEMY_LIVE.has(e.id)) {
    if (sx === 1 && sy === 1) return fn(e);
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(sx, sy); ctx.translate(-e.x, -e.y); fn(e); ctx.restore(); return;
  }
  const fr = FL ? 'F' : Math.floor(((((e.anim || 0) % TAU) + TAU) % TAU) / TAU * 4) % 4;
  const R = Math.max(10, e.r || 12), w = R * 7 + 60, h = R * 7 + 60;
  const a = e.alpha === undefined ? 1 : e.alpha;
  if (a < 0.02) return;
  const sp = SPRITES.get(e.id + '|' + fr, -w / 2, -h * 0.8, w, h, () => fn({ ...e, x: 0, y: 0, z: 0, alpha: 1, anim: fr === 'F' ? 0 : ((fr + 0.5) / 4) * TAU, face: 1 }));
  if (!sp.c) return;
  if (a < 0.99) { ctx.globalAlpha = a; try { stampEnemy(e, sp, sx, sy); } finally { ctx.globalAlpha = 1; } return; }
  stampEnemy(e, sp, sx, sy);
}
function stampEnemy(e, sp, sx, sy) {
  // unscaled (the usual case on Lowest): a straight pixel copy, mirrored copy for mutants facing left
  if (sx === 1 && sy === 1) {
    if (e.face < 0) { if (!sp.m) sp.m = mirror(sp.c); blit(sp.m, e.x - sp.x - sp.w, e.y - (e.z || 0) + sp.y); }
    else blit(sp.c, e.x + sp.x, e.y - (e.z || 0) + sp.y);
    return;
  }
  // the sprite hangs from (x, y - z); the scale is applied around the feet (x, y) like the live path
  const top = e.y + (-(e.z || 0) + sp.y) * sy, hgt = sp.h * sy, wid = sp.w * sx;
  if (e.face < 0) { ctx.scale(-1, 1); ctx.drawImage(sp.c, -e.x + sp.x * sx, top, wid, hgt); ctx.scale(-1, 1); }
  else ctx.drawImage(sp.c, e.x + sp.x * sx, top, wid, hgt);
}

// additive blending on the main canvas becomes normal blending on Lowest: switching blend modes between draws breaks
// the GPU's batching, and hundreds of bullets, sparks and glows switch it constantly
{
  const MAIN = cv.getContext('2d'), d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalCompositeOperation');
  if (d && d.set) Object.defineProperty(MAIN, 'globalCompositeOperation', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v === 'lighter' && minGfx() ? 'source-over' : v); } });
}

// ---------- pixel-exact drawing on Lowest ----------
// Cached images are made at exactly the screen scale, so they can be copied 1:1 at whole-pixel positions. A copy like
// that skips the per-pixel filtering a scaled or sub-pixel draw needs, which is most of a frame on phones whose browser
// paints the canvas in software. Same resolution, same picture.
const RT = { sc: 1, tx: 0, ty: 0 }; // the world→screen transform of the current frame (set by render)
function blit(c, wx, wy) {
  if (GLR.active && ctx === GLR.main) { GLR.quad(c, Math.round(wx * RT.sc + RT.tx), Math.round(wy * RT.sc + RT.ty), ctx.globalAlpha); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c, Math.round(wx * RT.sc + RT.tx), Math.round(wy * RT.sc + RT.ty));
  ctx.setTransform(RT.sc, 0, 0, RT.sc, RT.tx, RT.ty);
}
function mirror(c) {
  const m = document.createElement('canvas'); m.width = c.width; m.height = c.height;
  const g = m.getContext('2d'); g.scale(-1, 1); g.drawImage(c, -c.width, 0); return m;
}
// the ground: each 512-unit tile is pre-scaled once to screen size and then copied 1:1 every frame
const GROUND = { map: new Map(), sc: 0, max: 20 };
function drawGroundFast(gx0, gx1, gy0, gy1) {
  const sc = RT.sc;
  // a removed prop (a destroyed fence, a new stage) redraws the tiles
  if (GROUND.np !== World.props.length || GROUND.ps !== World.props) {
    GROUND.np = World.props.length;
    let nb = 0; for (const p of World.props) if (PROP_BAKE.has(p.kind)) nb++;
    if (GROUND.ps !== World.props || nb !== GROUND.nb) GROUND.map.clear(); // only when baked scenery itself changed
    GROUND.ps = World.props; GROUND.nb = nb;
  }
  if (sc !== GROUND.sc) { GROUND.map.clear(); GROUND.sc = sc; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const src = World.chunk(gx, gy), k = gy * 1000 + gx;
    let t = GROUND.map.get(k);
    if (t && t.src === src) { GROUND.map.delete(k); GROUND.map.set(k, t); } // most recently used last
    else {
      if (t) GROUND.map.delete(k);
      while (GROUND.map.size >= GROUND.max) GROUND.map.delete(GROUND.map.keys().next().value);
      // painted on a CPU-side work canvas, then copied into the tile as finished pixels: a canvas holding hundreds of
      // vector commands can get replayed every time it is drawn
      const n = Math.ceil((CHUNK + 1) * sc), w = GROUND.work && GROUND.work.canvas.width === n ? GROUND.work : (GROUND.work = mkWork(n));
      w.setTransform(1, 0, 0, 1, 0, 0); w.drawImage(src, 0, 0, (CHUNK + 1) * sc, (CHUNK + 1) * sc);
      bakeProps(w, gx, gy, sc);
      const c = document.createElement('canvas'); c.width = c.height = n;
      c.getContext('2d').putImageData(w.getImageData(0, 0, n, n), 0, 0);
      GROUND.map.set(k, t = { src, c });
    }
    const X = Math.round(gx * CHUNK * sc + RT.tx), Y = Math.round(gy * CHUNK * sc + RT.ty);
    if (GLR.active) GLR.tile(t.c, X, Y); else ctx.drawImage(t.c, X, Y);
  }
  ctx.setTransform(sc, 0, 0, sc, RT.tx, RT.ty);
}
function mkWork(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c.getContext('2d', { willReadFrequently: true }); }
// scenery that never changes (trees, bushes, rocks…) is painted into the ground tiles themselves, so on Lowest it costs
// nothing per frame. Mutants and the player then always draw on top of it, which also keeps them visible in woods.
const PROP_BAKE = new Set(['tree', 'deadtree', 'bush', 'rock', 'grass', 'reeds', 'bones', 'wheel']);
function bakeProps(g, gx, gy, sc) {
  const X0 = gx * CHUNK, Y0 = gy * CHUNK, X1 = X0 + CHUNK + 1, Y1 = Y0 + CHUNK + 1, PC = WORLD / PCELL, list = new Set();
  for (let cy = Math.max(0, Math.floor(Y0 / PCELL)); cy <= Math.min(PC - 1, Math.floor(Y1 / PCELL)); cy++)
    for (let cx = Math.max(0, Math.floor(X0 / PCELL)); cx <= Math.min(PC - 1, Math.floor(X1 / PCELL)); cx++)
      for (const p of World.propGrid[cy * PC + cx]) if (PROP_BAKE.has(p.kind) && PROP_DRAW[p.kind] && p.bx1 > X0 && p.bx0 < X1 && p.by1 > Y0 && p.by0 < Y1) list.add(p);
  if (!list.size) return;
  const arr = [...list].sort((a, b) => a.sy - b.sy), main = ctx, cam = { x: CAM.x, y: CAM.y };
  g.setTransform(sc, 0, 0, sc, -X0 * sc, -Y0 * sc); ctx = g;
  try {
    // each prop drawn as if the camera were right above it: no lean, so a tree split across two tiles lines up
    for (const p of arr) { CAM.x = p.x; CAM.y = p.y; try { PROP_DRAW[p.kind](p); } catch (e) { /* skip this one */ } }
  } finally { ctx = main; CAM.x = cam.x; CAM.y = cam.y; }
}
// floating damage numbers on Lowest: each distinct (text, colour, size) is rendered once and then copied 1:1;
// drawing glyphs is one of the slowest things a software-painted canvas does, and fights repeat the same numbers
const TXT = new Map();
function textStamp(str, col, font, size, x, y) {
  const k = font + '|' + col + '|' + str;
  let t = TXT.get(k);
  if (!t || t.sc !== RT.sc) {
    if (TXT.size > 400) TXT.clear();
    const sc = RT.sc, c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = font; const w = g.measureText(String(str)).width;
    c.width = Math.max(1, Math.ceil((w + 4) * sc)); c.height = Math.max(1, Math.ceil(size * 1.45 * sc));
    g.setTransform(sc, 0, 0, sc, 0, 0); g.font = font; g.textAlign = 'center'; g.fillStyle = col; g.fillText(str, w / 2 + 2, size * 1.1);
    TXT.set(k, t = { c, sc, hw: w / 2 + 2, top: size * 1.1 });
  }
  blit(t.c, x - t.hw, y - t.top);
}

// Ultra-low: no synthesized background music (radio stations and the dynamic score); sound effects still play
addEventListener('DOMContentLoaded', () => {
  for (const o of [Radio, Music]) { const t = o.tick; o.tick = function () { if (ultraGfx()) return; return t.apply(this, arguments); }; }
});
