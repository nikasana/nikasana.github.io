'use strict';
// ---------- drawing: props, creatures, anomalies (world space, fake-3D) ----------
let FL = false; // hit-flash: draw everything white
const col = (c) => (FL ? '#ffffff' : c);

function shadow(x, y, rx, ry, a = 0.3) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}
function poly(pts, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// parallax offset for something `h` tall at (x,y): its top leans away from the camera centre
const parX = (x, h) => clamp((x - CAM.x) * h * 0.0009, -h * 0.9, h * 0.9);
const parY = (y, h) => -h + clamp((y - CAM.y) * h * 0.00035, -h * 0.3, h * 0.3);
function occludes(x0, y0, x1, y1) {
  return P && P.x > x0 && P.x < x1 && P.y > y0 && P.y < y1;
}

// ---------- props ----------
const TREE_COLS = {
  n: [[40, 66, 34], [58, 88, 42], [84, 118, 56]],
  pine: [[28, 52, 36], [40, 70, 46], [60, 96, 60]],
  red: [[110, 40, 26], [156, 64, 34], [206, 110, 52]],
};
function drawTree(p) {
  const s = p.s, h = (p.pine ? 120 : 92) * s, sway = Math.sin(NOW * 1.2 + p.seed) * 2.5 * s;
  const tx = p.x + parX(p.x, h) + sway, ty = p.y + parY(p.y, h);
  shadow(p.x + 22 * s, p.y + 5, 38 * s, 13 * s, 0.26);
  const hide = occludes(p.x - 60 * s, ty - 40 * s, p.x + 60 * s, p.y - 4);
  if (hide) ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#3e3024'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, tx, 0.75), lerp(p.y, ty, 0.75)); ctx.stroke();
  const C = p.red ? TREE_COLS.red : p.pine ? TREE_COLS.pine : TREE_COLS.n;
  if (p.pine && !p.red) {
    for (let i = 0; i < 4; i++) {
      const t = 0.3 + i * 0.22, cx = lerp(p.x, tx, t), cy = lerp(p.y, ty, t), w = (34 - i * 7) * s;
      poly([cx - w, cy + 10 * s, cx + w, cy + 10 * s, lerp(p.x, tx, t + 0.28), lerp(p.y, ty, t + 0.28) - 6 * s], rgb(C[0]));
      poly([cx - w * 0.2, cy + 10 * s, cx + w, cy + 10 * s, lerp(p.x, tx, t + 0.28), lerp(p.y, ty, t + 0.28) - 6 * s], rgb(C[1], 0.8));
    }
  } else {
    const R = [[0, 8, 30], [-16, 2, 22], [15, 0, 22], [-4, -12, 22], [8, -8, 16]];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rgb(C[k]);
      for (let i = 0; i < R.length; i++) {
        const [ox, oy, r] = R[i];
        ctx.beginPath(); ctx.arc(tx + ox * s - k * 3 * s, ty + oy * s - k * 5 * s, (r - k * 5) * s, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawDeadTree(p) {
  const s = p.s, h = 88 * s, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 12 * s, p.y + 3, 16 * s, 6 * s, 0.25);
  ctx.strokeStyle = p.red ? '#5a2e1e' : '#4d463c'; ctx.lineCap = 'round';
  ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.lineWidth = 2.5 * s;
  for (let i = 0; i < 5; i++) {
    const t = 0.35 + i * 0.13, bx = lerp(p.x, tx, t), by = lerp(p.y, ty, t), d = (i % 2 ? 1 : -1) * (14 + ((p.seed * (i + 3)) % 14)) * s;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + d, by - 14 * s); ctx.lineTo(bx + d * 1.3, by - 22 * s); ctx.stroke();
  }
}
function drawRock(p) {
  const r = p.r, h = r * 0.7, dx = parX(p.x, h) * 0.5, dy = -h;
  shadow(p.x + 8, p.y + 4, r * 1.1, r * 0.45, 0.3);
  const base = [], top = [];
  for (let i = 0; i < p.pts.length; i++) {
    const a = (i / p.pts.length) * TAU, rr = r * p.pts[i];
    base.push(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.55);
    top.push(p.x + dx + Math.cos(a) * rr * 0.8, p.y + dy + Math.sin(a) * rr * 0.45);
  }
  poly(base, col('#55524c'));
  // body = hull of base + top
  ctx.beginPath(); ctx.moveTo(base[0], base[1]);
  for (let i = 2; i < base.length; i += 2) ctx.lineTo(base[i], base[i + 1]);
  ctx.closePath(); ctx.fillStyle = col('#67635b'); ctx.fill();
  ctx.beginPath(); ctx.moveTo(p.x - r * 0.95, p.y); ctx.lineTo(p.x - r * 0.75 + dx, p.y + dy); ctx.lineTo(p.x + r * 0.75 + dx, p.y + dy); ctx.lineTo(p.x + r * 0.95, p.y);
  ctx.closePath(); ctx.fillStyle = col('#5f5b54'); ctx.fill();
  poly(top, col('#8d887d'), 'rgba(0,0,0,0.15)');
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(p.x + dx - r * 0.2, p.y + dy - r * 0.1, r * 0.35, r * 0.15, 0, 0, TAU); ctx.fill();
}
function drawBush(p) {
  const s = p.s;
  shadow(p.x + 4, p.y + 2, 16 * s, 5 * s, 0.2);
  const c = p.red ? ['#6a2e1c', '#8e4428'] : ['#3a5a2c', '#527a3a'];
  ctx.fillStyle = c[0];
  ctx.beginPath(); ctx.arc(p.x - 8 * s, p.y - 6 * s, 9 * s, 0, TAU); ctx.arc(p.x + 7 * s, p.y - 7 * s, 10 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(p.x, p.y - 12 * s, 9 * s, 0, TAU); ctx.fill();
}
function drawGrass(p) {
  const s = p.s, sw = Math.sin(NOW * 2 + p.seed) * 2;
  ctx.strokeStyle = p.red ? '#8a4a2a' : '#7c8a42'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) { ctx.moveTo(p.x + i * 3 * s, p.y); ctx.lineTo(p.x + i * 4 * s + sw, p.y - (9 + (i & 1) * 4) * s); }
  ctx.stroke();
}
function drawReeds(p) {
  const s = p.s, sw = Math.sin(NOW * 1.6 + p.seed) * 3;
  ctx.strokeStyle = '#6f7a48'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) { ctx.moveTo(p.x + i * 3 * s, p.y); ctx.lineTo(p.x + i * 3.5 * s + sw, p.y - (22 + ((i * 7) & 7)) * s); }
  ctx.stroke();
  ctx.fillStyle = '#5a3e26';
  for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.ellipse(p.x + i * 3.5 * s + sw, p.y - (22 + ((i * 7) & 7)) * s, 1.8, 4, 0, 0, TAU); ctx.fill(); }
}
const BSTYLE = {
  house: { wall: [158, 148, 128], wall2: [128, 80, 62], roof: [112, 62, 48], roof2: [92, 92, 88] },
  factory: { wall: [122, 120, 112], wall2: [104, 108, 104], roof: [78, 80, 78], roof2: [88, 84, 76] },
  hut: { wall: [104, 84, 58], wall2: [92, 74, 52], roof: [74, 64, 48], roof2: [80, 72, 50] },
  ruin: { wall: [118, 112, 102], wall2: [104, 96, 88], roof: [86, 82, 76], roof2: [96, 90, 80] },
  apartment: { wall: [150, 150, 144], wall2: [132, 128, 118], roof: [70, 72, 72], roof2: [80, 78, 74] },
  reactor: { wall: [118, 110, 96], wall2: [118, 110, 96], roof: [96, 72, 56], roof2: [96, 72, 56] },
  lab: { wall: [62, 66, 70], wall2: [58, 62, 66], roof: [26, 28, 30], roof2: [30, 31, 33] },
};
function drawBuilding(b) {
  const S = BSTYLE[b.style], alt = b.seed % 2 === 0, wall = alt ? S.wall : S.wall2, roof = alt ? S.roof : S.roof2;
  const k = b.hgt, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = parX(cx, k), dy = parY(cy, k);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  poly([b.x + b.w, b.y + 6, b.x + b.w + k * 0.45, b.y + 20, b.x + b.w + k * 0.45, b.y + b.h + 16, b.x + 6, b.y + b.h + 16, b.x, b.y + b.h], 'rgba(0,0,0,0.26)');
  const hide = occludes(b.x + Math.min(0, dx) - 20, b.y + dy - 30, b.x + b.w + Math.max(0, dx) + 20, b.y + b.h - 4);
  if (hide) ctx.globalAlpha = 0.2;
  // side wall
  if (dx > 1) poly([b.x, b.y, b.x, b.y + b.h, b.x + dx, b.y + b.h + dy, b.x + dx, b.y + dy], rgb(wall.map((v) => v * 0.62)));
  else if (dx < -1) poly([b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x + b.w + dx, b.y + b.h + dy, b.x + b.w + dx, b.y + dy], rgb(wall.map((v) => v * 0.62)));
  // front wall
  poly([b.x, b.y + b.h, b.x + b.w, b.y + b.h, b.x + b.w + dx, b.y + b.h + dy, b.x + dx, b.y + b.h + dy], rgb(wall.map((v) => v * 0.85)));
  ctx.save();
  ctx.transform(1, 0, dx, dy, b.x, b.y + b.h); // u along wall, v up (0..1)
  const R = mulberry32(b.seed);
  // stains
  ctx.fillStyle = 'rgba(40,36,30,0.18)';
  for (let i = 0; i < 4; i++) ctx.fillRect(R() * b.w, 0, 8 + R() * 30, 0.2 + R() * 0.6);
  // base strip
  ctx.fillStyle = 'rgba(30,28,24,0.35)'; ctx.fillRect(0, 0, b.w, 0.1);
  const floors = b.style === 'lab' ? 0 : b.style === 'apartment' ? Math.max(3, Math.floor(b.hgt / 34)) : b.style === 'factory' || b.style === 'reactor' ? 2 : 1;
  const nwin = Math.max(1, Math.floor(b.w / (b.style === 'factory' ? 46 : 42))), vh = floors === 1 ? 0.25 : Math.min(0.25, 0.5 / floors);
  if (b.style === 'lab') {
    ctx.fillStyle = 'rgba(20,22,24,0.8)'; ctx.fillRect(0, 0.62, b.w, 0.07);
    ctx.fillStyle = 'rgba(160,150,60,0.25)'; ctx.fillRect(0, 0.02, b.w, 0.08);
    for (let u = 40; u < b.w - 20; u += 160) { const on = Math.sin(NOW * 3 + u + b.seed) > -0.6; ctx.fillStyle = on ? 'rgba(120,255,160,0.9)' : '#233'; ctx.fillRect(u, 0.8, 10, 0.08); }
  }
  for (let f = 0; f < floors; f++) for (let i = 0; i < nwin; i++) {
    const u = (b.w / nwin) * (i + 0.5) - 9, v0 = floors === 1 ? 0.35 : 0.12 + f * (0.84 / floors);
    if (b.style !== 'factory' && i === Math.floor(nwin / 2) && f === 0) { // door
      ctx.fillStyle = '#2a241e'; ctx.fillRect(u - 2, 0.02, 20, 0.55); continue;
    }
    const broken = R() < 0.4;
    ctx.fillStyle = broken ? '#15171a' : 'rgba(40,58,64,0.95)';
    ctx.fillRect(u, v0, 18, vh);
    if (!broken) { ctx.fillStyle = 'rgba(160,190,200,0.25)'; ctx.fillRect(u + 2, v0 + vh * 0.5, 6, vh * 0.4); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(u - 2, v0 - 0.03, 22, 0.03);
  }
  ctx.restore();
  // roof
  const rx = b.x + dx, ry = b.y + dy;
  poly([rx, ry, rx + b.w, ry, rx + b.w, ry + b.h, rx, ry + b.h], rgb(roof));
  if (b.style === 'house' || b.style === 'hut') {
    ctx.fillStyle = rgb(roof.map((v) => v * 1.18));
    ctx.fillRect(rx, ry, b.w, b.h / 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    for (let u = 10; u < b.w; u += 12) { ctx.beginPath(); ctx.moveTo(rx + u, ry); ctx.lineTo(rx + u, ry + b.h); ctx.stroke(); }
    ctx.strokeStyle = rgb(roof.map((v) => v * 1.45)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(rx, ry + b.h / 2); ctx.lineTo(rx + b.w, ry + b.h / 2); ctx.stroke();
    if (b.style === 'house') { ctx.fillStyle = '#5a4a40'; ctx.fillRect(rx + b.w * 0.7, ry + b.h * 0.15, 14, 18); }
  } else {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(rx + 6, ry + 6, b.w - 12, b.h - 12);
    if (b.style === 'factory') {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(40,40,40,0.8)'; ctx.fillRect(rx + 30 + i * (b.w - 80) / 2, ry + 20, 22, 16); ctx.fillStyle = 'rgba(120,150,160,0.35)'; ctx.fillRect(rx + b.w * 0.2, ry + b.h * 0.55 + i * 0, b.w * 0.6, 10); }
    }
  }
  if (b.style === 'lab') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    ctx.strokeRect(rx + 4, ry + 4, b.w - 8, b.h - 8);
  } else if (b.style === 'reactor') {
    ctx.fillStyle = 'rgba(60,40,30,0.6)'; for (let i = 0; i < 5; i++) ctx.fillRect(rx + 40 + i * (b.w - 120) / 4, ry + 30, 40, b.h - 60);
    ctx.fillStyle = 'rgba(160,120,60,0.25)'; ctx.fillRect(rx, ry + b.h * 0.45, b.w, 12);
  }
  if (b.holes && b.style !== 'lab') {
    ctx.fillStyle = 'rgba(18,16,14,0.85)';
    ctx.beginPath(); ctx.ellipse(rx + b.w * 0.3, ry + b.h * 0.6, b.w * 0.09, b.h * 0.12, 0.3, 0, TAU); ctx.fill();
    if (b.style === 'ruin') { ctx.beginPath(); ctx.ellipse(rx + b.w * 0.7, ry + b.h * 0.35, b.w * 0.14, b.h * 0.18, -0.2, 0, TAU); ctx.fill(); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rx, ry + b.h); ctx.lineTo(rx, ry); ctx.lineTo(rx + b.w, ry); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawBunker(p) {
  const x = p.x - 40, y = p.y - 78, w = 80, h = 30, k = 30, dx = parX(p.x, k), dy = parY(y, k);
  poly([x + w, y + 6, x + w + 18, y + 14, x + w + 18, y + h + 10, x, y + h + 6], 'rgba(0,0,0,0.25)');
  if (dx > 1) poly([x, y, x, y + h, x + dx, y + h + dy, x + dx, y + dy], '#5c5f5a');
  else if (dx < -1) poly([x + w, y, x + w, y + h, x + w + dx, y + h + dy, x + w + dx, y + dy], '#5c5f5a');
  poly([x, y + h, x + w, y + h, x + w + dx, y + h + dy, x + dx, y + h + dy], '#7a7d76');
  ctx.save(); ctx.transform(1, 0, dx, dy, x, y + h);
  ctx.fillStyle = '#2b2d2a'; ctx.fillRect(24, 0, 32, 0.8);
  ctx.fillStyle = '#4a5a3a'; ctx.fillRect(26, 0.05, 28, 0.7);
  ctx.restore();
  poly([x + dx, y + dy, x + w + dx, y + dy, x + w + dx, y + h + dy, x + dx, y + h + dy], '#8e918a', 'rgba(0,0,0,0.3)');
  const blink = G && G.em ? (Math.sin(NOW * 10) > 0 ? 1 : 0.3) : 0.6 + Math.sin(NOW * 2) * 0.3;
  ctx.fillStyle = `rgba(90,255,120,${blink})`;
  ctx.beginPath(); ctx.arc(x + w / 2 + dx, y + h + dy - 8, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(90,255,120,${blink * 0.25})`;
  ctx.beginPath(); ctx.arc(x + w / 2 + dx, y + h + dy - 8, 14, 0, TAU); ctx.fill();
}
function drawTower(p) {
  const h = p.h, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 30, p.y + 8, 60, 14, 0.25);
  ctx.strokeStyle = '#3c3f40'; ctx.lineWidth = 3;
  const legs = [[-34, -8], [34, -8], [-26, 10], [26, 10]];
  for (const [lx, ly] of legs) { ctx.beginPath(); ctx.moveTo(p.x + lx, p.y + ly); ctx.lineTo(tx + lx * 0.15, ty + ly * 0.15); ctx.stroke(); }
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#4c5052';
  for (let i = 0; i < 14; i++) {
    const t0 = i / 14, t1 = (i + 1) / 14;
    const ax = lerp(p.x - 34, tx - 5, t0), ay = lerp(p.y + 8, ty, t0), bx = lerp(p.x + 34, tx + 5, t1), by = lerp(p.y + 8, ty, t1);
    const cx2 = lerp(p.x + 34, tx + 5, t0), cy2 = lerp(p.y + 8, ty, t0), dx2 = lerp(p.x - 34, tx - 5, t1), dy2 = lerp(p.y + 8, ty, t1);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(cx2, cy2); ctx.lineTo(dx2, dy2); ctx.moveTo(ax, ay); ctx.lineTo(cx2, cy2); ctx.stroke();
  }
  // dish
  ctx.fillStyle = '#6a6e70'; ctx.beginPath(); ctx.ellipse(tx, ty + 10, 34, 14, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a8e90'; ctx.beginPath(); ctx.ellipse(tx - 3, ty + 7, 26, 9, -0.4, 0, TAU); ctx.fill();
  const on = Math.sin(NOW * 3 + p.x) > 0;
  ctx.fillStyle = on ? '#ff3030' : '#601010'; ctx.beginPath(); ctx.arc(tx, ty - 6, 4, 0, TAU); ctx.fill();
  if (on) { ctx.fillStyle = 'rgba(255,40,40,0.25)'; ctx.beginPath(); ctx.arc(tx, ty - 6, 16, 0, TAU); ctx.fill(); }
}
function drawTank(p) {
  const h = p.h, dx = parX(p.x, h), dy = parY(p.y, h), r = p.r;
  shadow(p.x + 14, p.y + 6, r * 1.2, r * 0.45, 0.28);
  ctx.fillStyle = '#6e726c';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.45, 0, 0, Math.PI); ctx.lineTo(p.x - r + dx, p.y + dy); ctx.lineTo(p.x + r + dx, p.y + dy); ctx.closePath(); ctx.fill();
  poly([p.x - r, p.y, p.x - r + dx, p.y + dy, p.x + r + dx, p.y + dy, p.x + r, p.y], '#6e726c');
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; poly([p.x + r * 0.3, p.y, p.x + r * 0.3 + dx, p.y + dy, p.x + r + dx, p.y + dy, p.x + r, p.y], 'rgba(0,0,0,0.15)');
  ctx.fillStyle = '#8a8f88'; ctx.beginPath(); ctx.ellipse(p.x + dx, p.y + dy, r, r * 0.45, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,20,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(p.x - r * 0.5, p.y + 4); ctx.lineTo(p.x - r * 0.5 + dx * 0.6, p.y + dy * 0.6); ctx.stroke();
}
function drawWreck(p) {
  const x = p.x - p.w / 2, y = p.y - p.h / 2, w = p.w, h = p.h, k = p.bus ? 40 : 22, dx = parX(p.x, k), dy = parY(p.y, k);
  const c = p.col;
  poly([x + 4, y + h + 4, x + w + 14, y + h + 6, x + w + 14, y + 8, x + w, y], 'rgba(0,0,0,0.28)');
  ctx.fillStyle = '#1a1a1a';
  for (const wx of [x + 14, x + w - 22]) { ctx.beginPath(); ctx.ellipse(wx, y + h, 9, 5, 0, 0, TAU); ctx.fill(); }
  if (dx > 1) poly([x, y, x, y + h, x + dx, y + h + dy, x + dx, y + dy], rgb(c.map((v) => v * 0.55)));
  else if (dx < -1) poly([x + w, y, x + w, y + h, x + w + dx, y + h + dy, x + w + dx, y + dy], rgb(c.map((v) => v * 0.55)));
  poly([x, y + h, x + w, y + h, x + w + dx, y + h + dy, x + dx, y + h + dy], rgb(c.map((v) => v * 0.8)));
  ctx.save(); ctx.transform(1, 0, dx, dy, x, y + h);
  ctx.fillStyle = 'rgba(90,50,30,0.5)'; ctx.fillRect(w * 0.2, 0.1, w * 0.3, 0.4);
  ctx.fillStyle = '#20262a';
  if (p.bus) for (let u = 10; u < w - 16; u += 22) ctx.fillRect(u, 0.5, 16, 0.35);
  else ctx.fillRect(w * 0.3, 0.55, w * 0.4, 0.4);
  ctx.restore();
  const rx = x + dx, ry = y + dy;
  poly([rx, ry, rx + w, ry, rx + w, ry + h, rx, ry + h], rgb(c), 'rgba(0,0,0,0.3)');
  ctx.fillStyle = 'rgba(100,50,25,0.45)'; ctx.beginPath(); ctx.ellipse(rx + w * 0.6, ry + h * 0.4, w * 0.18, h * 0.25, 0, 0, TAU); ctx.fill();
  if (!p.bus) { ctx.fillStyle = '#25303a'; ctx.fillRect(rx + w * 0.3, ry + 6, w * 0.35, h - 12); }
}
function drawHeap(p) {
  const r = p.r, R = mulberry32(p.seed | 0);
  shadow(p.x + 10, p.y + 4, r * 1.1, r * 0.4, 0.3);
  ctx.fillStyle = '#5a4c3a'; ctx.beginPath(); ctx.ellipse(p.x, p.y - r * 0.2, r, r * 0.6, 0, Math.PI, TAU); ctx.lineTo(p.x + r, p.y); ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#6e5e46'; ctx.beginPath(); ctx.ellipse(p.x - r * 0.1, p.y - r * 0.45, r * 0.7, r * 0.35, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = R() * TAU, d = R() * r * 0.7;
    ctx.fillStyle = pick(['#3c3a36', '#7a6e5a', '#6d3a2a', '#44525a', '#8a8470']);
    ctx.save(); ctx.translate(p.x + Math.cos(a) * d, p.y - r * 0.35 + Math.sin(a) * d * 0.4); ctx.rotate(R() * 3);
    ctx.fillRect(-6, -3, 8 + R() * 10, 4 + R() * 4); ctx.restore();
  }
}
function drawBarrel(p) {
  shadow(p.x + 5, p.y + 2, 12, 5, 0.3);
  const c = p.ex ? '#b8342a' : p.rad ? '#b89a2a' : '#5a6a4a';
  ctx.fillStyle = col(c); ctx.fillRect(p.x - 10, p.y - 26, 20, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x + 3, p.y - 26, 7, 26);
  ctx.fillStyle = col(p.ex ? '#d8483a' : p.rad ? '#d8b83a' : '#6e7e5a'); ctx.beginPath(); ctx.ellipse(p.x, p.y - 26, 10, 4, 0, 0, TAU); ctx.fill();
  if (p.ex) { ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.moveTo(p.x - 1, p.y - 20); ctx.lineTo(p.x + 4, p.y - 13); ctx.lineTo(p.x - 4, p.y - 13); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(p.x - 10, p.y - 18, 20, 2); ctx.fillRect(p.x - 10, p.y - 8, 20, 2);
  if (p.rad) { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 13, 4, 0, TAU); ctx.fill(); }
}
function drawPylon(p) {
  const h = 240, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 20, p.y + 4, 14, 5, 0.25);
  ctx.strokeStyle = '#4a4034'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx - 40, ty + 16); ctx.lineTo(tx + 40, ty + 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tx - 38, ty + 16); ctx.quadraticCurveTo(tx + 200, ty + 90, tx + 400, ty + 16); ctx.moveTo(tx + 38, ty + 16); ctx.quadraticCurveTo(tx + 220, ty + 100, tx + 440, ty + 16); ctx.stroke();
}
const PROP_DRAW = { tree: drawTree, deadtree: drawDeadTree, rock: drawRock, bush: drawBush, grass: drawGrass, reeds: drawReeds, building: drawBuilding, bunker: drawBunker, tower: drawTower, tank: drawTank, wreck: drawWreck, heap: drawHeap, barrel: drawBarrel, pylon: drawPylon };

// ---------- creatures ----------
function drawStalker(e, pal, player) {
  const bob = Math.abs(Math.sin(e.anim)) * (e.moving === false ? 0 : 2), sw = e.moving === false ? 0 : Math.sin(e.anim) * 5;
  ctx.save(); ctx.translate(e.x, e.y - e.z);
  const f = e.face;
  // legs
  ctx.fillStyle = col(pal.pants);
  ctx.fillRect(-6 + sw * 0.6, -12, 5, 12); ctx.fillRect(1 - sw * 0.6, -12, 5, 12);
  ctx.fillStyle = col('#1d1a16'); ctx.fillRect(-7 + sw * 0.6, -3, 7, 3); ctx.fillRect(0 - sw * 0.6, -3, 7, 3);
  // backpack
  ctx.fillStyle = col(pal.pack); ctx.fillRect(-f * 12 - 5, -30 - bob, 10, 16);
  // body
  ctx.fillStyle = col(pal.jacket);
  ctx.beginPath(); ctx.roundRect(-9, -31 - bob, 18, 21, 5); ctx.fill();
  ctx.fillStyle = col(pal.jacket2); ctx.fillRect(-9, -22 - bob, 18, 4);
  // head
  ctx.fillStyle = col(pal.hood); ctx.beginPath(); ctx.arc(0, -37 - bob, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = col(pal.face); ctx.beginPath(); ctx.ellipse(f * 3, -36 - bob, 4.5, 5, 0, 0, TAU); ctx.fill();
  if (pal.mask) { ctx.fillStyle = col('#222'); ctx.beginPath(); ctx.arc(f * 5, -33 - bob, 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = col('#9fe8ff'); ctx.fillRect(f * 2 - 2, -39 - bob, 5, 2.5); }
  if (pal.eyes) { ctx.fillStyle = pal.eyes; ctx.fillRect(f * 3 - 2, -38 - bob, 2, 2); ctx.fillRect(f * 3 + 2, -38 - bob, 2, 2); }
  // arms + gun
  ctx.save(); ctx.translate(0, -22 - bob);
  const a = pal.arms !== undefined ? pal.arms : e.aim;
  ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1);
  ctx.fillStyle = col(pal.jacket); ctx.fillRect(0, -3, 12, 6);
  if (pal.gun) { ctx.fillStyle = col('#22221f'); ctx.fillRect(6, -3, 22, 4); ctx.fillRect(10, 0, 4, 6); ctx.fillStyle = col('#5a3a22'); ctx.fillRect(2, -2, 7, 5); }
  else { ctx.fillStyle = col(pal.face); ctx.fillRect(12, -3, 5, 5); }
  ctx.restore();
  if (player && e.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.arc(Math.cos(e.aim) * 32, -22 - bob + Math.sin(e.aim) * 32, 6 * e.muzzle / 0.05, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
const PAL_PLAYER = { pants: '#3a3e2e', pack: '#4e4632', jacket: '#56603f', jacket2: '#3e462e', hood: '#4a5438', face: '#2c2e28', mask: true, gun: true };
const PAL_ZOMBIE = { pants: '#3a3a36', pack: '#3e3a30', jacket: '#5c5a52', jacket2: '#4a4238', hood: '#6a645a', face: '#a09a86', gun: true, eyes: '#ff4a2a' };

function drawDog(e) {
  const f = e.face, a = e.anim, leap = e.z > 2;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.strokeStyle = col('#4a3a2c'); ctx.lineWidth = 3; ctx.lineCap = 'round';
  const l = leap ? 0 : Math.sin(a) * 6;
  ctx.beginPath();
  ctx.moveTo(-8, -10); ctx.lineTo(-8 + l, 0); ctx.moveTo(-4, -10); ctx.lineTo(-4 - l, 0);
  ctx.moveTo(7, -10); ctx.lineTo(7 - l, 0); ctx.moveTo(10, -10); ctx.lineTo(10 + l, 0); ctx.stroke();
  ctx.fillStyle = col('#7a6048'); ctx.beginPath(); ctx.ellipse(0, -14, 15, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#a0504a'); ctx.beginPath(); ctx.ellipse(-3, -13, 5, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#6c523c'); ctx.beginPath(); ctx.ellipse(15, -18, 7, 5.5, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#8c7058'); ctx.beginPath(); ctx.ellipse(21, -15, 5, 3, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#e8e0d0'); ctx.fillRect(20, -13, 5, 1.5);
  ctx.strokeStyle = col('#6c523c'); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-14, -16); ctx.quadraticCurveTo(-22, -20 + Math.sin(a * 2) * 4, -24, -14); ctx.stroke();
  ctx.restore();
}
function drawFlesh(e) {
  const f = e.face, a = e.anim, wob = Math.sin(a) * 1.5;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.strokeStyle = col('#7a4a3e'); ctx.lineWidth = 4; ctx.lineCap = 'round';
  const l = Math.sin(a) * 5;
  ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-10 + l, 0); ctx.moveTo(10, -8); ctx.lineTo(10 - l, 0); ctx.moveTo(0, -8); ctx.lineTo(-l, 0); ctx.stroke();
  ctx.fillStyle = col('#c88a78'); ctx.beginPath(); ctx.ellipse(0, -19 + wob, 21, 15, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#e2a896'); ctx.beginPath(); ctx.ellipse(-4, -24 + wob, 12, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#8e4a40'); ctx.beginPath(); ctx.ellipse(-8, -12 + wob, 6, 3, 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#fff8e0'); ctx.beginPath(); ctx.arc(14, -22 + wob, 3.5, 0, TAU); ctx.arc(19, -17 + wob, 2.5, 0, TAU); ctx.arc(9, -28 + wob, 2.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#200'; ctx.beginPath(); ctx.arc(15, -22 + wob, 1.6, 0, TAU); ctx.arc(19.5, -17 + wob, 1.2, 0, TAU); ctx.arc(9.5, -28 + wob, 1.2, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#8e5a4c'); ctx.beginPath(); ctx.ellipse(21, -11 + wob, 4, 3, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawSnork(e) {
  const f = e.face, a = e.anim, leap = e.z > 2, crouch = e.state === 1;
  ctx.save(); ctx.translate(e.x, e.y - e.z + (crouch ? 4 : 0)); ctx.scale(f, 1);
  ctx.strokeStyle = col('#3a3c34'); ctx.lineWidth = 4; ctx.lineCap = 'round';
  const l = leap ? 8 : Math.sin(a) * 6;
  ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(-8 - l, 0); ctx.moveTo(4, -12); ctx.lineTo(6 + l, 0); ctx.stroke();
  ctx.fillStyle = col('#4e5244'); ctx.beginPath(); ctx.ellipse(0, -18, 11, 9, -0.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(6, -20); ctx.lineTo(leap ? 22 : 14, leap ? -24 : -8); ctx.stroke();
  ctx.fillStyle = col('#6a6a5c'); ctx.beginPath(); ctx.arc(10, -26, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#20201c'); ctx.beginPath(); ctx.arc(13, -28, 2.6, 0, TAU); ctx.arc(8, -29, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff5030'; ctx.fillRect(12, -29, 2, 2); ctx.fillRect(7, -30, 2, 2);
  ctx.strokeStyle = col('#2a2a24'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(13, -22); ctx.quadraticCurveTo(20, -16, 14, -10); ctx.stroke();
  ctx.restore();
}
function drawBloodsucker(e) {
  const f = e.face, a = e.anim, bob = Math.abs(Math.sin(a)) * 2;
  ctx.save(); ctx.globalAlpha = e.alpha; ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  if (e.alpha < 0.5) { ctx.translate(Math.sin(NOW * 30) * 1.5, 0); }
  ctx.fillStyle = col('#4a2c32');
  const l = Math.sin(a) * 6;
  ctx.fillRect(-6 + l, -14, 5, 14); ctx.fillRect(1 - l, -14, 5, 14);
  ctx.fillStyle = col('#6a3e44'); ctx.beginPath(); ctx.roundRect(-10, -38 - bob, 20, 26, 6); ctx.fill();
  ctx.fillStyle = col('#7c4c52'); ctx.beginPath(); ctx.arc(2, -44 - bob, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = col('#9a5a60'); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(7, -41 - bob + i * 2); ctx.quadraticCurveTo(13, -38 + i * 3 + Math.sin(NOW * 8 + i) * 3, 10 + i, -31 + i * 2); ctx.stroke(); }
  ctx.fillStyle = '#ffd040'; ctx.fillRect(4, -48 - bob, 3, 3);
  ctx.strokeStyle = col('#6a3e44'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(4, -30 - bob); ctx.lineTo(16, -26 - bob + l * 0.5); ctx.stroke();
  ctx.restore();
}
function drawPoltergeist(e) {
  const x = e.x, y = e.y - e.z, t = NOW * 6 + e.seed;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 2, x, y, 30);
  g.addColorStop(0, FL ? '#fff' : 'rgba(255,240,200,0.95)'); g.addColorStop(0.35, 'rgba(255,150,60,0.6)'); g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,120,0.7)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = t * 0.7 + i * 2.1; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 12 + rand(-3, 3), y + Math.sin(a) * 12 + rand(-3, 3)); ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); ctx.stroke();
  }
  ctx.restore();
}
function drawController(e) {
  const f = e.face, a = e.anim, bob = Math.abs(Math.sin(a)) * 1.5;
  const x = e.x, y = e.y - e.z;
  ctx.save();
  ctx.strokeStyle = `rgba(190,90,255,${0.25 + Math.sin(NOW * 4) * 0.15})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, e.y, 40 + Math.sin(NOW * 3) * 6, 14, 0, 0, TAU); ctx.stroke();
  ctx.translate(x, y); ctx.scale(f, 1);
  ctx.fillStyle = col('#4c4238'); const l = Math.sin(a) * 4;
  ctx.fillRect(-7 + l, -14, 6, 14); ctx.fillRect(1 - l, -14, 6, 14);
  ctx.fillStyle = col('#6a5a48'); ctx.beginPath(); ctx.roundRect(-11, -36 - bob, 22, 24, 6); ctx.fill();
  ctx.fillStyle = col('#b89a86'); ctx.beginPath(); ctx.ellipse(0, -46 - bob, 13, 12, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col('#8a5a5a'); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-8, -52 - bob); ctx.quadraticCurveTo(-2, -46, -6, -40 - bob); ctx.moveTo(4, -55 - bob); ctx.quadraticCurveTo(10, -50, 6, -44 - bob); ctx.stroke();
  ctx.fillStyle = '#d070ff'; ctx.fillRect(4, -47 - bob, 4, 3); ctx.fillRect(-2, -47 - bob, 4, 3);
  ctx.strokeStyle = col('#6a5a48'); ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(6, -30 - bob); ctx.lineTo(18, e.cast > 0 ? -44 : -22); ctx.stroke();
  ctx.restore();
}
function drawPseudogiant(e) {
  const f = e.face, a = e.anim, wind = e.state === 1;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f * 1.1, 1.1);
  const l = Math.sin(a) * 8;
  ctx.fillStyle = col('#8a5e4a');
  ctx.beginPath(); ctx.ellipse(-16 + l, -8, 9, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14 - l, -8, 9, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#b07a64'); ctx.beginPath(); ctx.ellipse(0, -44, 42, 34, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#c89480'); ctx.beginPath(); ctx.ellipse(-8, -56, 26, 16, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#7a4a3c'); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-20 + i * 12, -34 + (i % 2) * 6, 5, 3, 0.4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = col('#a06a56'); ctx.beginPath(); ctx.ellipse(34, -60, 12, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffeb60'; ctx.beginPath(); ctx.arc(39, -63, 2.5, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#9a6450'); ctx.save(); ctx.translate(30, -40); ctx.rotate(wind ? -1.2 : 0.4 + Math.sin(a) * 0.2);
  ctx.beginPath(); ctx.ellipse(12, 0, 22, 10, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(32, 0, 11, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
}
function drawChimera(e) {
  const f = e.face, a = e.anim, leap = e.z > 4;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f * 1.2, 1.2);
  ctx.strokeStyle = col('#3a3530'); ctx.lineWidth = 6; ctx.lineCap = 'round';
  const l = leap ? 12 : Math.sin(a) * 9;
  ctx.beginPath(); ctx.moveTo(-18, -16); ctx.lineTo(-22 - l, 0); ctx.moveTo(-10, -16); ctx.lineTo(-8 + l, 0); ctx.moveTo(14, -16); ctx.lineTo(18 + l, 0); ctx.moveTo(20, -16); ctx.lineTo(20 - l, 0); ctx.stroke();
  ctx.fillStyle = col('#4a4238'); ctx.beginPath(); ctx.ellipse(0, -24, 30, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#5e554a'); ctx.beginPath(); ctx.ellipse(4, -30, 20, 6, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = col('#4a4238'); ctx.beginPath(); ctx.moveTo(-28, -26); ctx.quadraticCurveTo(-46, -46 + Math.sin(NOW * 5) * 6, -40, -54); ctx.stroke();
  for (const [hx, hy] of [[32, -34], [28, -24]]) {
    ctx.fillStyle = col('#554c42'); ctx.beginPath(); ctx.ellipse(hx, hy, 10, 8, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3a2a'; ctx.fillRect(hx + 4, hy - 3, 3, 2);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(hx + 4, hy + 3, 6, 1.5);
  }
  ctx.restore();
}
function drawBurer(e) {
  const f = e.face, a = e.anim, cast = e.cast > 0;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f * 1.4, 1.4);
  ctx.fillStyle = col('#4a3a28'); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(9, -26); ctx.lineTo(-9, -26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col('#5e4a32'); ctx.beginPath(); ctx.arc(0, -30, 10, Math.PI, TAU); ctx.lineTo(10, -22); ctx.lineTo(-10, -22); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(2, -27, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffcc30'; ctx.fillRect(1, -29, 2, 2); ctx.fillRect(5, -29, 2, 2);
  ctx.strokeStyle = col('#8a7a60'); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(cast ? -16 : -12, cast ? -36 : -8 + Math.sin(a) * 2); ctx.moveTo(6, -18); ctx.lineTo(cast ? 16 : 12, cast ? -36 : -8 - Math.sin(a) * 2); ctx.stroke();
  ctx.restore();
  if (e.shield > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150,200,255,${0.5 + Math.sin(NOW * 20) * 0.2})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y - 24, 46, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(120,170,255,0.12)'; ctx.fill(); ctx.restore();
  }
}
function drawMonolith(e) {
  const x = e.x, y = e.y - e.z, t = NOW;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 40, 5, x, y - 40, 140);
  g.addColorStop(0, 'rgba(180,230,255,0.55)'); g.addColorStop(1, 'rgba(60,120,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 40, 140, 0, TAU); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(160,220,255,${0.5 - i * 0.12})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 30, 60 + i * 16, 16 + i * 5, Math.sin(t + i) * 0.3, t * (1 + i * 0.3), t * (1 + i * 0.3) + 4.5); ctx.stroke();
  }
  poly([x, y - 120, x + 30, y - 40, x, y + 10, x - 30, y - 40], col('#1c2a3a'));
  poly([x, y - 120, x + 30, y - 40, x, y - 40], col('#3a5a7a'));
  poly([x, y - 120, x - 12, y - 40, x, y + 10, x - 30, y - 40], col('#101a26'));
  ctx.strokeStyle = `rgba(200,240,255,${0.6 + Math.sin(t * 5) * 0.3})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - 110); ctx.lineTo(x + 6, y - 70); ctx.lineTo(x - 4, y - 50); ctx.lineTo(x + 3, y - 10); ctx.stroke();
}
const ENEMY_DRAW = {
  dog: drawDog, flesh: drawFlesh, snork: drawSnork, bloodsucker: drawBloodsucker, poltergeist: drawPoltergeist, controller: drawController,
  pseudogiant: drawPseudogiant, chimera: drawChimera, burer: drawBurer, monolith: drawMonolith,
  zombie: (e) => drawStalker(e, { ...PAL_ZOMBIE, arms: e.face > 0 ? 0.3 : Math.PI - 0.3 }, false),
};

// ---------- anomalies ----------
function jag(x1, y1, x2, y2, n, amp) {
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(lerp(x1, x2, t) + rand(-amp, amp), lerp(y1, y2, t) + rand(-amp, amp)); }
  ctx.lineTo(x2, y2); ctx.stroke();
}
function drawAnomalyGround(a) {
  const t = NOW + a.seed, r = a.r;
  if (a.hidden) { if (Math.random() < 0.02) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(a.x, a.y, r * 0.5, r * 0.3, 0, 0, TAU); ctx.stroke(); } return; }
  if (ANOMALIES[a.type] && !['electro', 'burner', 'vortex', 'acid', 'spring'].includes(a.type)) { drawAnomalyGround2(a); return; }
  switch (a.type) {
    case 'electro': {
      ctx.fillStyle = 'rgba(20,30,50,0.25)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r * 0.9, r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(120,200,255,${0.18 + Math.sin(t * 3) * 0.08})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.stroke();
      break;
    }
    case 'burner': {
      const g = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, r);
      g.addColorStop(0, `rgba(255,120,40,${0.35 + Math.sin(t * 4) * 0.1})`); g.addColorStop(0.5, 'rgba(60,20,10,0.4)'); g.addColorStop(1, 'rgba(20,10,5,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'vortex': {
      ctx.fillStyle = 'rgba(40,30,60,0.18)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190,170,255,0.2)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const rr = ((t * 30 + i * r / 3) % r); ctx.beginPath(); ctx.ellipse(a.x, a.y, r - rr, (r - rr) * 0.6, 0, 0, TAU); ctx.stroke(); }
      break;
    }
    case 'acid': {
      const g = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, r);
      g.addColorStop(0, 'rgba(170,255,90,0.7)'); g.addColorStop(0.7, 'rgba(90,200,50,0.45)'); g.addColorStop(1, 'rgba(60,140,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(220,255,160,0.6)';
      for (let i = 0; i < 4; i++) {
        const bt = (t * 0.8 + i * 0.25) % 1, bx = a.x + Math.cos(i * 2.3 + a.seed) * r * 0.5, by = a.y + Math.sin(i * 1.7 + a.seed) * r * 0.3;
        ctx.beginPath(); ctx.arc(bx, by, bt * 5, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'spring': {
      ctx.strokeStyle = `rgba(220,230,255,${0.14 + Math.sin(t * 2) * 0.06})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, r * (0.8 + Math.sin(t * 2) * 0.1), r * 0.5, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(200,210,230,0.08)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r * 0.6, r * 0.36, 0, 0, TAU); ctx.fill();
      break;
    }
  }
}
function drawAnomalyTop(a) {
  const t = NOW + a.seed, r = a.r;
  if (a.hidden) return;
  if (!['electro', 'burner', 'vortex', 'acid', 'spring'].includes(a.type)) { drawAnomalyTop2(a); return; }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  switch (a.type) {
    case 'electro': {
      if (Math.random() < 0.25) { ctx.strokeStyle = 'rgba(150,210,255,0.6)'; ctx.lineWidth = 1; const an = rand(TAU); jag(a.x, a.y - 14, a.x + Math.cos(an) * r * 0.5, a.y + Math.sin(an) * r * 0.3, 4, 5); }
      const g = ctx.createRadialGradient(a.x, a.y - 14, 1, a.x, a.y - 14, 16);
      g.addColorStop(0, 'rgba(200,240,255,0.8)'); g.addColorStop(1, 'rgba(80,160,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y - 14, 16, 0, TAU); ctx.fill();
      if (a.act > 0) {
        ctx.strokeStyle = 'rgba(170,220,255,0.95)'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 7; i++) { const an = rand(TAU), d = rand(r * 0.3, r); jag(a.x, a.y - 30, a.x + Math.cos(an) * d, a.y + Math.sin(an) * d * 0.6, 6, 9); }
        ctx.fillStyle = `rgba(120,190,255,${a.act * 1.2})`; ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'burner': {
      // heat shimmer
      ctx.strokeStyle = 'rgba(255,160,80,0.12)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const yy = a.y - k * 10, xx = a.x - 12 + i * 12 + Math.sin(t * 6 + k + i) * 3; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      if (a.act > 0) {
        const h = 130;
        const g = ctx.createLinearGradient(a.x, a.y, a.x, a.y - h);
        g.addColorStop(0, 'rgba(255,240,160,0.95)'); g.addColorStop(0.3, 'rgba(255,140,40,0.8)'); g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(a.x - r * 0.6, a.y);
        for (let k = 0; k <= 8; k++) { const yy = a.y - (k / 8) * h, w = r * 0.6 * (1 - k / 9) + Math.sin(t * 20 + k) * 5; ctx.lineTo(a.x + w, yy); }
        for (let k = 8; k >= 0; k--) { const yy = a.y - (k / 8) * h, w = r * 0.6 * (1 - k / 9) + Math.cos(t * 17 + k) * 5; ctx.lineTo(a.x - w, yy); }
        ctx.fill();
      }
      break;
    }
    case 'vortex': {
      ctx.fillStyle = 'rgba(200,180,255,0.35)';
      for (let i = 0; i < 10; i++) {
        const an = t * (2 + i * 0.1) + i * 0.63, d = r * (0.2 + ((i * 37) % 10) / 12);
        const px = a.x + Math.cos(an) * d, py = a.y + Math.sin(an) * d * 0.6 - 10 - Math.sin(an * 2) * 6;
        ctx.fillRect(px, py, 3, 3);
      }
      if (a.act > 0) {
        ctx.fillStyle = `rgba(210,190,255,${a.act})`; ctx.beginPath(); ctx.arc(a.x, a.y - 10, 30 + (1 - a.act) * 80, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'spring': {
      if (a.act > 0) {
        ctx.strokeStyle = `rgba(230,240,255,${a.act * 1.5})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(a.x, a.y, r * (1.6 - a.act * 1.5), r * (1.6 - a.act * 1.5) * 0.6, 0, 0, TAU); ctx.stroke();
      }
      break;
    }
    case 'acid': {
      ctx.fillStyle = 'rgba(150,255,90,0.05)'; ctx.beginPath(); ctx.ellipse(a.x, a.y - 10, r * 0.8, r * 0.5, 0, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
function drawArtifact(art, alpha) {
  const A = ARTIFACTS[art.type], t = NOW * 2 + art.t, y = art.y - 18 - Math.sin(t) * 5;
  ctx.save(); ctx.globalAlpha = alpha;
  shadow(art.x, art.y, 9, 3, 0.35);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(art.x, y, 1, art.x, y, 36);
  g.addColorStop(0, A.color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.globalAlpha = alpha * (0.55 + Math.sin(t * 2) * 0.2); ctx.beginPath(); ctx.arc(art.x, y, 36, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = A.c2; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { const an = t * 0.5 + i * (TAU / 4); ctx.beginPath(); ctx.moveTo(art.x + Math.cos(an) * 14, y + Math.sin(an) * 14); ctx.lineTo(art.x + Math.cos(an) * 28, y + Math.sin(an) * 28); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
  drawArtShape(ctx, A, art.x, y, 1.15, t);
  ctx.restore();
}
