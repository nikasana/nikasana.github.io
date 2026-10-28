// Orientation: a compass strip across the top of the view and a north-up minimap of the claim.
// Both are small 2D canvases redrawn from game state; the crater image refreshes twice a second.
import { HM_RES, HALF, VOXEL, surfaceY } from '../world/field.js';
import { h } from './dom.js';

const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";
const FONT_DISPLAY = "'Big Shoulders Display', 'Arial Narrow', sans-serif";
const COL = { frost: '#e6f1f4', haze: '#9fb8c2', glacier: '#8fd6ec', brass: '#e2b25e', ember: '#ff8b52', violet: '#b9a4ff' };
// Colour-safe markers (Settings > Accessibility): the Okabe-Ito palette, which stays distinct with every
// common colour-vision deficiency. Every marker also has its own shape, so colour is never the only cue.
const SAFE = { lift: '#56b4e9', outfitter: '#0072b2', vault: '#e69f00', depot: '#d55e00', find: '#f0e442', crew: '#cc79a7' };
const CARDINAL = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

// North is -z. Bearing in degrees, clockwise from north, of a world direction (dx, dz).
export const bearingOf = (dx, dz) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;

function canvas(cls, w, hgt) {
  const c = h(`canvas.${cls}`);
  const pr = Math.min(2, devicePixelRatio || 1);
  c.width = Math.round(w * pr); c.height = Math.round(hgt * pr);
  c.style.width = `${w}px`; c.style.height = `${hgt}px`;
  const x = c.getContext('2d');
  x.scale(pr, pr);
  return { c, x, w, h: hgt };
}

export class Navigation {
  constructor(root, game) {
    this.game = game;
    this.compass = canvas('hud-compass', 460, 34);
    this.map = canvas('hud-map', 176, 176);
    this.mapWrap = h('div.hud-mapwrap', {}, this.map.c, h('div.hud-map-n', {}, 'N'));
    root.append(this.compass.c, this.mapWrap);
    // crater image: one pixel per heightmap cell
    this.img = document.createElement('canvas');
    this.img.width = this.img.height = HM_RES;
    this.imgCtx = this.img.getContext('2d');
    this.imgData = this.imgCtx.createImageData(HM_RES, HM_RES);
    this.imgTimer = 0;
    this.span = 84;       // metres shown across the minimap
  }

  markers() {
    const g = this.game, out = [];
    const safe = !!g.settings.colorSafe;
    const b = g.works.beaconPos();
    if (g.ride) out.push({ x: b.x, z: b.z, col: safe ? SAFE.lift : COL.glacier, shape: 'diamond', label: 'LIFT' });
    if (g.works.outfitterPos) { const o = g.works.outfitterPos; out.push({ x: o.x, z: o.z, col: safe ? SAFE.outfitter : '#7fd4ff', shape: 'triangle', label: 'OUTFITTER' }); }
    if ((g.stats.visionTier || 0) >= 3 || (g.revealUntil || 0) > g.time) {
      for (const it of g.frozen.items) {
        if (it.kind !== 'find' || it.done) continue;
        const p = it.mesh.position;
        if (Math.hypot(p.x - g.ctl.pos.x, p.z - g.ctl.pos.z) < 60) out.push({ x: p.x, z: p.z, col: safe ? SAFE.find : '#' + it.find.glow.toString(16).padStart(6, '0'), shape: 'star', label: '', mapOnly: true });
      }
    }
    // the Golden Needle, once you are down at its depth (see Game.updateHud)
    if (g.needleGuide) out.push({ x: g.needleGuide.x, z: g.needleGuide.z, col: '#ffd27a', shape: 'star', label: 'NEEDLE' });
    if (g.works.depotPos) { const d = g.works.depotPos; out.push({ x: d.x, z: d.z, col: safe ? SAFE.depot : COL.brass, shape: 'hexagon', label: 'DEPOT' }); }
    const v = g.works.vaultCenter();
    out.push({ x: v.x, z: v.z, col: safe ? SAFE.vault : COL.brass, shape: 'square', label: 'VAULT' });
    if (g.crew && g.crew.active && g.avatars) for (const a of g.avatars.map.values()) out.push({ x: a.root.position.x, z: a.root.position.z, col: safe ? SAFE.crew : COL.violet, shape: 'dot', label: '' });
    return out;
  }

  update(dt) {
    const g = this.game;
    const p = g.ctl.pos, yaw = g.ctl.yaw;
    const heading = ((-yaw * 180) / Math.PI % 360 + 360) % 360;
    const marks = this.markers();
    this.drawCompass(heading, p, marks);
    this.imgTimer -= dt;
    if (this.imgTimer <= 0) { this.imgTimer = 0.5; this.paintCrater(); }
    this.drawMap(heading, p, marks);
  }

  drawCompass(heading, p, marks) {
    const { x, w, h: H } = this.compass;
    x.clearRect(0, 0, w, H);
    const fov = 150, px = w / fov, mid = w / 2;
    // soft backing that fades at the ends
    const bg = x.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, 'rgba(6,18,26,0)'); bg.addColorStop(0.18, 'rgba(6,18,26,0.5)'); bg.addColorStop(0.82, 'rgba(6,18,26,0.5)'); bg.addColorStop(1, 'rgba(6,18,26,0)');
    x.fillStyle = bg; x.fillRect(0, 6, w, H - 8);
    const rel = (deg) => ((deg - heading + 540) % 360) - 180;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 5) {
      const r = rel(d);
      if (Math.abs(r) > fov / 2) continue;
      const sx = mid + r * px;
      const fade = 1 - Math.pow(Math.abs(r) / (fov / 2), 3);
      x.globalAlpha = fade;
      if (CARDINAL[d] !== undefined) {
        const main = d % 90 === 0;
        x.fillStyle = d === 0 ? COL.ember : main ? COL.frost : COL.haze;
        x.font = `${main ? 700 : 600} ${main ? 15 : 11}px ${FONT_DISPLAY}`;
        x.fillText(CARDINAL[d], sx, 19);
      } else {
        x.fillStyle = COL.haze;
        const tall = d % 15 === 0;
        x.fillRect(sx - 0.5, tall ? 14 : 16, 1, tall ? 10 : 6);
      }
    }
    // markers along the strip
    for (const m of marks) {
      if (m.mapOnly) continue;
      const dx = m.x - p.x, dz = m.z - p.z;
      if (Math.hypot(dx, dz) < 1.2) continue;
      const r = rel(bearingOf(dx, dz));
      const clamped = Math.max(-fov / 2 + 4, Math.min(fov / 2 - 4, r));
      const sx = mid + clamped * px;
      x.globalAlpha = Math.abs(r) > fov / 2 ? 0.55 : 1;
      x.fillStyle = m.col;
      this.shape(x, m.shape, sx, 5, 4);
    }
    x.globalAlpha = 1;
    // heading readout under the centre line
    x.fillStyle = COL.frost;
    x.fillRect(mid - 0.75, 8, 1.5, 4);
    x.font = `500 9px ${FONT_MONO}`;
    x.fillStyle = COL.haze;
    x.fillText(String(Math.round(heading) % 360).padStart(3, '0'), mid, 31);
  }

  shape(x, kind, sx, sy, s) {
    x.beginPath();
    if (kind === 'diamond') { x.moveTo(sx, sy - s); x.lineTo(sx + s, sy); x.lineTo(sx, sy + s); x.lineTo(sx - s, sy); x.closePath(); }
    else if (kind === 'square') x.rect(sx - s * 0.8, sy - s * 0.8, s * 1.6, s * 1.6);
    else if (kind === 'hexagon') { for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x.lineTo(sx + Math.cos(a) * s, sy + Math.sin(a) * s); } x.closePath(); }
    else if (kind === 'triangle') { x.moveTo(sx, sy - s); x.lineTo(sx + s * 0.95, sy + s * 0.75); x.lineTo(sx - s * 0.95, sy + s * 0.75); x.closePath(); }
    else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; x.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } x.closePath(); }
    else x.arc(sx, sy, s * 0.8, 0, Math.PI * 2);
    x.fill();
  }

  // Crater depth as an ice ramp with 2 m contour lines.
  paintCrater() {
    const hm = this.game.volume.hm, d = this.imgData.data;
    if (!this.snow) {
      this.snow = new Float32Array(HM_RES * HM_RES);
      for (let k = 0; k < HM_RES; k++) for (let i = 0; i < HM_RES; i++) this.snow[k * HM_RES + i] = surfaceY(-HALF + (i + 0.5) * VOXEL, -HALF + (k + 0.5) * VOXEL);
    }
    for (let k = 0; k < HM_RES; k++) for (let i = 0; i < HM_RES; i++) {
      const v = hm[k * HM_RES + i];
      const o = (k * HM_RES + i) * 4;
      if (v < 0.05) {
        // untouched snow, faintly shaded by the surface relief
        const s = 150 + Math.max(-30, Math.min(30, this.snow[k * HM_RES + i] * 6));
        d[o] = s * 0.86; d[o + 1] = s * 0.95; d[o + 2] = s; d[o + 3] = 150;
        continue;
      }
      const t = Math.min(1, Math.sqrt(v / 40));
      let r = 140 - 125 * t, gg = 214 - 170 * t, b = 236 - 150 * t;
      const right = i + 1 < HM_RES ? hm[k * HM_RES + i + 1] : v, down = k + 1 < HM_RES ? hm[(k + 1) * HM_RES + i] : v;
      if (Math.floor(v / 2) !== Math.floor(right / 2) || Math.floor(v / 2) !== Math.floor(down / 2)) { r += 50; gg += 40; b += 30; }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 235;
    }
    this.imgCtx.putImageData(this.imgData, 0, 0);
  }

  drawMap(heading, p, marks) {
    const { x, w } = this.map;
    const k = w / this.span;                // px per metre
    const cx = w / 2, cy = w / 2;
    const toS = (wx, wz) => [cx + (wx - p.x) * k, cy + (wz - p.z) * k];
    x.clearRect(0, 0, w, w);
    x.save();
    x.beginPath(); x.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2); x.clip();
    x.fillStyle = 'rgba(200,220,232,0.35)';
    x.fillRect(0, 0, w, w);
    const [ox, oz] = toS(-HALF, -HALF);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.img, ox, oz, HALF * 2 * k, HALF * 2 * k);
    // claim border
    x.strokeStyle = 'rgba(6,18,26,0.55)'; x.lineWidth = 1;
    x.strokeRect(ox, oz, HALF * 2 * k, HALF * 2 * k);
    // range rings every 10 m
    x.strokeStyle = 'rgba(6,18,26,0.18)';
    for (let r = 10; r < this.span / 2; r += 10) { x.beginPath(); x.arc(cx, cy, r * k, 0, Math.PI * 2); x.stroke(); }
    for (const m of marks) {
      let [sx, sy] = toS(m.x, m.z);
      const dd = Math.hypot(sx - cx, sy - cy), lim = w / 2 - 8;
      if (dd > lim) { sx = cx + (sx - cx) / dd * lim; sy = cy + (sy - cy) / dd * lim; }
      x.fillStyle = 'rgba(6,18,26,0.8)'; this.shape(x, m.shape, sx, sy, 6);
      x.fillStyle = m.col; this.shape(x, m.shape, sx, sy, 4.5);
    }
    // player: a view cone and an arrow
    const a = (heading * Math.PI) / 180;
    x.translate(cx, cy); x.rotate(a);
    const cone = x.createRadialGradient(0, 0, 0, 0, 0, 34);
    cone.addColorStop(0, 'rgba(230,241,244,0.45)'); cone.addColorStop(1, 'rgba(230,241,244,0)');
    x.fillStyle = cone;
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 34, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill();
    x.fillStyle = 'rgba(6,18,26,0.9)';
    x.beginPath(); x.moveTo(0, -9); x.lineTo(7, 7); x.lineTo(0, 3.5); x.lineTo(-7, 7); x.closePath(); x.fill();
    x.fillStyle = COL.frost;
    x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(0, 2.5); x.lineTo(-5, 5); x.closePath(); x.fill();
    x.restore();
    x.strokeStyle = 'rgba(196,232,244,0.4)'; x.lineWidth = 1.5;
    x.beginPath(); x.arc(cx, cy, w / 2 - 1, 0, Math.PI * 2); x.stroke();
  }

  set visible(v) { this.compass.c.hidden = !v; this.mapWrap.hidden = !v; }
}
