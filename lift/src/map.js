// The floor map (M): rooms you know, their state, the lift, and overlays (rays, pings, goals).
import { roomSide } from './config.js';
import * as Game from './game.js';
import { roomKey } from './world.js';
import { roomOf } from './movement.js';

export class MapView {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.open = false; this.layers = []; this.radius = 7; }
  toggle(on = !this.open) { this.open = on; this.c.classList.toggle('hidden', !on); }
  draw(s) {
    if (!this.open) return;
    const c = this.c, dpr = Math.min(2, devicePixelRatio);
    const W = c.clientWidth * dpr, H = c.clientHeight * dpr;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = this.ctx, f = s.pos.floor, S = roomSide(f);
    const [px, pz] = roomOf(s.pos.x, s.pos.z, S);
    const R = this.radius, cell = Math.min(W, H) / (2 * R + 1);
    const ox = W / 2 - (s.pos.x / S) * cell, oz = H / 2 - (s.pos.z / S) * cell;
    const toPx = (wx, wz) => [ox + (wx / S) * cell, oz + (wz / S) * cell];   // world metres -> pixels
    const roomPx = (rx, rz) => [ox + rx * cell, oz + rz * cell];
    x.clearRect(0, 0, W, H);
    x.lineWidth = Math.max(1, dpr);
    for (let rz = pz - R - 1; rz <= pz + R + 1; rz++) for (let rx = px - R - 1; rx <= px + R + 1; rx++) {
      const k = roomKey(f, rx, rz), r = s.rooms.get(k);
      const known = r && (r.visited || r.lit || r.flags.mapped);
      const [cx, cz] = roomPx(rx, rz);
      const pad = cell * 0.06, sz = cell - pad * 2;
      if (!known) { x.strokeStyle = 'rgba(255,255,255,0.05)'; x.strokeRect(cx - cell / 2 + pad, cz - cell / 2 + pad, sz, sz); continue; }
      const inf = Game.info(s, f, rx, rz);
      let col = 'rgba(120,140,190,0.45)';
      if (r.clearedDone) col = 'rgba(150,170,210,0.6)';
      if (r.clearedDone && r.polishedDone) col = 'rgba(190,205,235,0.7)';
      if (r.lit) col = r.polishedDone ? 'rgba(255,205,130,0.92)' : 'rgba(240,180,110,0.65)';
      if (inf.cabin) col = 'rgba(214,170,90,1)';
      x.fillStyle = col; x.fillRect(cx - cell / 2 + pad, cz - cell / 2 + pad, sz, sz);
      if (Game.isSealed(s, f, rx, rz)) { x.strokeStyle = 'rgba(255,230,180,0.9)'; x.lineWidth = 2 * dpr; x.strokeRect(cx - sz / 2 + 2, cz - sz / 2 + 2, sz - 4, sz - 4); x.lineWidth = dpr; }
      if (inf.setPiece) { x.fillStyle = 'rgba(255,255,255,0.9)'; star(x, cx, cz, cell * 0.16); }
      if (inf.modifier === 'deep' && !r.clearedDone) { x.fillStyle = 'rgba(40,50,80,0.5)'; x.fillRect(cx - sz / 2, cz + sz / 4, sz, sz / 4); }
    }
    for (const layer of this.layers) layer(x, { toPx, roomPx, cell, dpr, f, S, W, H });
    // the player
    const [ppx, ppz] = toPx(s.pos.x, s.pos.z);
    x.save(); x.translate(ppx, ppz); x.rotate(-s.pos.yaw);
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -cell * 0.22); x.lineTo(cell * 0.13, cell * 0.14); x.lineTo(-cell * 0.13, cell * 0.14); x.closePath(); x.fill();
    x.restore();
  }
}
function star(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fill();
}
