'use strict';
// ---------- extra props: POIs, labs, destructibles, stage landmarks ----------
function drawFence(p) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(p.x + 4, p.y + p.h, p.w, 5);
  ctx.fillStyle = col('#6a5238');
  if (p.horiz) {
    for (let u = 0; u < p.w; u += 12) ctx.fillRect(p.x + u, p.y - 26, 8, 30);
    ctx.fillStyle = col('#7e6444'); ctx.fillRect(p.x, p.y - 20, p.w, 4); ctx.fillRect(p.x, p.y - 8, p.w, 4);
  } else {
    ctx.fillRect(p.x, p.y - 26, 8, p.h + 26);
    ctx.fillStyle = col('#7e6444'); ctx.fillRect(p.x - 1, p.y - 26, 10, 6);
  }
}
function drawHatch(p) {
  const h = p.h, open = h.exit, glow = 0.5 + Math.sin(NOW * 3) * 0.3;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 4, 46, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#56595a'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 44, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a3d3e'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, 34, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = open ? '#0b0c0c' : '#6a6e70'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 6, 26, 12, 0, 0, TAU); ctx.fill();
  if (!open) { ctx.strokeStyle = '#444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y - 6, 14, 6, 0, 0, TAU); ctx.stroke(); }
  // ladder rails
  ctx.strokeStyle = '#8a8e90'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(p.x - 18, p.y - 8); ctx.lineTo(p.x - 18, p.y - 44); ctx.moveTo(p.x + 18, p.y - 8); ctx.lineTo(p.x + 18, p.y - 44); ctx.moveTo(p.x - 18, p.y - 40); ctx.quadraticCurveTo(p.x, p.y - 56, p.x + 18, p.y - 40); ctx.stroke();
  ctx.fillStyle = `rgba(255,${open ? 220 : 90},60,${glow})`; ctx.beginPath(); ctx.arc(p.x, p.y - 52, 4, 0, TAU); ctx.fill();
  ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(h.name.toUpperCase(), p.x + 1, p.y + 37);
  ctx.fillStyle = open ? '#9fe8a0' : '#ffcf6a'; ctx.fillText(h.name.toUpperCase(), p.x, p.y + 36);
}
function drawSandbag(p) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x - 38, p.y + 4, 84, 8);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5 - (r ? 1 : 0); i++) {
    ctx.fillStyle = r % 2 ? '#8a7a52' : '#9a8a60';
    ctx.beginPath(); ctx.ellipse(p.x - 32 + i * 16 + r * 8, p.y - r * 9, 10, 6, 0, 0, TAU); ctx.fill();
  }
}
function drawHeli(p) {
  const x = p.x, y = p.y, dx = parX(x, 40), dy = parY(y, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 10, y + 26, 130, 26, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3e4a36'; ctx.beginPath(); ctx.ellipse(x + dx * 0.5, y + dy * 0.5, 90, 30, 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4c5a42'; ctx.beginPath(); ctx.ellipse(x + dx * 0.6, y + dy * 0.6 - 8, 70, 18, 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = '#20262a'; ctx.beginPath(); ctx.ellipse(x + 60 + dx * 0.5, y + dy * 0.5 - 4, 22, 14, 0.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3e4a36'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x - 80, y - 8); ctx.lineTo(x - 180, y + 6); ctx.stroke();
  ctx.strokeStyle = '#2a2e28'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x - 40 + dx, y - 30 + dy); ctx.lineTo(x + 120 + dx, y - 50 + dy); ctx.moveTo(x + 20 + dx, y - 34 + dy); ctx.lineTo(x - 60, y + 30); ctx.stroke();
  ctx.fillStyle = 'rgba(100,50,25,0.5)'; ctx.beginPath(); ctx.ellipse(x - 20, y - 4, 30, 12, 0, 0, TAU); ctx.fill();
  if (Math.random() < 0.3) part(x - 20 + rand(-10, 10), y - 10, { z: 10, vz: rand(30, 60), g: -20, c: '70,70,70', s: rand(6, 12), life: 2 });
}
function drawTent(p) {
  const c = ['#5a6a3a', '#6a5a3a', '#4a5a5a'][p.seed % 3];
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 8, p.y + 4, 56, 16, 0, 0, TAU); ctx.fill();
  poly([p.x - 50, p.y, p.x + 50, p.y, p.x, p.y - 58], c);
  poly([p.x, p.y - 58, p.x + 50, p.y, p.x + 12, p.y], 'rgba(0,0,0,0.2)');
  poly([p.x - 12, p.y, p.x + 12, p.y, p.x, p.y - 30], '#1e1c16');
}
function drawCampfire(p) {
  shadow(p.x, p.y, 20, 7, 0.3);
  ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x - 14, p.y); ctx.lineTo(p.x + 14, p.y - 4); ctx.moveTo(p.x - 12, p.y - 5); ctx.lineTo(p.x + 12, p.y + 2); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const h = 16 + Math.sin(NOW * 12 + i * 2) * 6; ctx.fillStyle = i ? 'rgba(255,120,30,0.7)' : 'rgba(255,230,120,0.9)'; ctx.beginPath(); ctx.ellipse(p.x + (i - 1) * 5, p.y - h / 2 - 2, 5 - i, h / 2, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (Math.random() < 0.4) part(p.x + rand(-5, 5), p.y - 10, { z: 10, vz: rand(40, 90), g: -30, c: '255,160,60', add: true, s: 2, life: 0.8 });
}
function drawBones(p) {
  ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const a = p.seed;
  ctx.beginPath(); ctx.moveTo(p.x - 10 * Math.cos(a), p.y - 5 * Math.sin(a)); ctx.lineTo(p.x + 10 * Math.cos(a), p.y + 5 * Math.sin(a)); ctx.stroke();
  ctx.fillStyle = '#e0d8c0'; ctx.beginPath(); ctx.arc(p.x + 12, p.y - 4, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(p.x + 10, p.y - 6, 2, 2); ctx.fillRect(p.x + 13, p.y - 6, 2, 2);
}
function drawWheel(p) {
  const h = 300, cx = p.x + parX(p.x, h), cy = p.y + parY(p.y, h) + 60, R = 170, rot = NOW * 0.05;
  shadow(p.x + 60, p.y + 10, 200, 30, 0.25);
  ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(p.x - 60, p.y); ctx.lineTo(cx, cy); ctx.lineTo(p.x + 60, p.y); ctx.stroke();
  ctx.strokeStyle = '#a89660'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
  for (let i = 0; i < 16; i++) {
    const a = rot + (i / 16) * TAU, gx = cx + Math.cos(a) * R, gy = cy + Math.sin(a) * R;
    ctx.fillStyle = i % 2 ? '#c8a830' : '#b86a30'; ctx.fillRect(gx - 9, gy + 2, 18, 14);
    ctx.strokeStyle = '#6a5a3a'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + 2); ctx.stroke();
  }
}
function drawChimney(p) {
  const h = 620, tx = p.x + parX(p.x, h), ty = p.y + parY(p.y, h);
  shadow(p.x + 80, p.y + 10, 120, 18, 0.25);
  for (let i = 0; i < 12; i++) {
    const t0 = i / 12, t1 = (i + 1) / 12, w0 = lerp(30, 22, t0), w1 = lerp(30, 22, t1);
    const x0 = lerp(p.x, tx, t0), y0 = lerp(p.y, ty, t0), x1 = lerp(p.x, tx, t1), y1 = lerp(p.y, ty, t1);
    poly([x0 - w0, y0, x0 + w0, y0, x1 + w1, y1, x1 - w1, y1], i % 2 ? '#c8c4b8' : '#b83a2a');
  }
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { const t = i / 6; ctx.beginPath(); ctx.moveTo(lerp(p.x, tx, t) - 50, lerp(p.y, ty, t)); ctx.lineTo(lerp(p.x, tx, t + 0.16) + 50, lerp(p.y, ty, t + 0.16)); ctx.stroke(); }
}
Object.assign(PROP_DRAW, { fence: drawFence, hatch: drawHatch, sandbag: drawSandbag, heli: drawHeli, tent: drawTent, campfire: drawCampfire, bones: drawBones, wheel: drawWheel, chimney: drawChimney });

// ---------- new mutants ----------
function drawRat(e) {
  const f = e.face, a = e.anim;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.fillStyle = col('#6a5a4c'); ctx.beginPath(); ctx.ellipse(0, -6, 9, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -8, 5, 4, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#b88a7a'); ctx.beginPath(); ctx.arc(5, -12, 2.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f33'; ctx.fillRect(10, -10, 2, 2);
  ctx.strokeStyle = col('#b88a7a'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.quadraticCurveTo(-16, -2 + Math.sin(a * 3) * 3, -18, -8); ctx.stroke();
  ctx.strokeStyle = col('#4a3a2c'); ctx.lineWidth = 2; const l = Math.sin(a) * 3;
  ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(-4 + l, 0); ctx.moveTo(4, -3); ctx.lineTo(4 - l, 0); ctx.stroke();
  ctx.restore();
}
function drawCat(e) {
  const f = e.face, a = e.anim;
  ctx.save(); ctx.globalAlpha = e.alpha ?? 1; ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.strokeStyle = col('#3a3634'); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; const l = Math.sin(a) * 5;
  ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(-7 + l, 0); ctx.moveTo(6, -8); ctx.lineTo(6 - l, 0); ctx.stroke();
  ctx.fillStyle = col('#4e4844'); ctx.beginPath(); ctx.ellipse(0, -11, 11, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -15, 5.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8, -19); ctx.lineTo(9, -25); ctx.lineTo(12, -20); ctx.moveTo(12, -20); ctx.lineTo(14, -25); ctx.lineTo(15, -18); ctx.fill();
  ctx.fillStyle = '#ffe040'; ctx.fillRect(12, -17, 2, 2); ctx.fillRect(15, -16, 2, 2);
  ctx.strokeStyle = col('#4e4844'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(-18, -24, -14, -28 + Math.sin(NOW * 4) * 3); ctx.stroke();
  ctx.restore();
}
function drawIzlom(e) {
  const f = e.face, a = e.anim, swing = e.state === 1 ? 1 - e.st / 0.45 : 0;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.fillStyle = col('#5a4e44'); const l = Math.sin(a) * 5;
  ctx.fillRect(-7 + l, -14, 5, 14); ctx.fillRect(2 - l, -14, 5, 14);
  ctx.fillStyle = col('#6e6052'); ctx.save(); ctx.translate(0, -26); ctx.rotate(0.35); ctx.beginPath(); ctx.roundRect(-9, -12, 18, 22, 5); ctx.fill(); ctx.restore();
  ctx.fillStyle = col('#9a8a7a'); ctx.beginPath(); ctx.arc(8, -40, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff6a2a'; ctx.fillRect(11, -42, 2, 2);
  ctx.save(); ctx.translate(4, -30); ctx.rotate(e.state === 1 ? -1.6 + swing * 3 : 0.6 + Math.sin(a) * 0.2);
  ctx.fillStyle = col('#7a6a5c'); ctx.fillRect(0, -4, 36, 8); ctx.fillStyle = col('#9a8a7a'); ctx.beginPath(); ctx.arc(38, 0, 7, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}
function drawPsydog(e) {
  ctx.save();
  if (e.id === 'phantom') { ctx.globalAlpha = 0.45 + Math.sin(NOW * 20 + e.seed) * 0.15; }
  drawDog(e);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = e.id === 'phantom' ? 'rgba(160,120,255,0.12)' : 'rgba(190,120,255,0.25)';
  ctx.beginPath(); ctx.arc(e.x, e.y - e.z - 16, 20, 0, TAU); ctx.fill(); ctx.restore();
}
Object.assign(ENEMY_DRAW, { rat: drawRat, cat: drawCat, izlom: drawIzlom, psydog: drawPsydog, phantom: drawPsydog });

// ---------- wave mutants & new bosses ----------
function drawBoar(e) {
  const f = e.face, a = e.anim, ch = e.state === 3;
  ctx.save(); ctx.translate(e.x, e.y - e.z); ctx.scale(f, 1);
  ctx.strokeStyle = col('#3a2c22'); ctx.lineWidth = 5; ctx.lineCap = 'round';
  const l = Math.sin(a * (ch ? 2 : 1)) * 6;
  ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-12 + l, 0); ctx.moveTo(-5, -10); ctx.lineTo(-5 - l, 0); ctx.moveTo(8, -10); ctx.lineTo(8 - l, 0); ctx.moveTo(14, -10); ctx.lineTo(14 + l, 0); ctx.stroke();
  ctx.fillStyle = col('#5a4232'); ctx.beginPath(); ctx.ellipse(0, -20, 22, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#4a3428'); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-16 + i * 6, -30); ctx.lineTo(-13 + i * 6, -38); ctx.lineTo(-10 + i * 6, -30); ctx.fill(); }
  if (e.id === 'behemoth') { ctx.fillStyle = col('#6a6e70'); ctx.fillRect(-18, -34, 30, 8); ctx.fillRect(-14, -26, 24, 5); }
  ctx.fillStyle = col('#6a4e3a'); ctx.beginPath(); ctx.ellipse(21, -18, 10, 9, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = col('#8a6a52'); ctx.beginPath(); ctx.ellipse(29, -15, 5, 4, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col('#f0e8d0'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(26, -12); ctx.quadraticCurveTo(32, -12, 32, -20); ctx.stroke();
  ctx.fillStyle = '#ff4020'; ctx.fillRect(22, -22, 3, 2);
  ctx.restore();
}
function drawSpark(e) {
  const x = e.x, y = e.y - e.z, charging = e.state === 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 2, x, y, charging ? 40 : 28);
  g.addColorStop(0, FL ? '#fff' : 'rgba(220,240,255,0.95)'); g.addColorStop(0.35, 'rgba(90,170,255,0.6)'); g.addColorStop(1, 'rgba(40,90,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, charging ? 40 : 28, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(180,220,255,0.8)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { const a = rand(TAU); jag(x, y, x + Math.cos(a) * 24, y + Math.sin(a) * 24, 3, 5); }
  ctx.restore();
}
const PAL_MSOLDIER = { pants: '#6a6e70', pack: '#4a4e50', jacket: '#9a9e98', jacket2: '#7a7e78', hood: '#b8bcb4', face: '#1e2226', gun: true, mask: true };
function crown(e, h, c) {
  ctx.fillStyle = c; const x = e.x, y = e.y - e.z - h;
  ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 14, y - 10); ctx.lineTo(x - 7, y - 4); ctx.lineTo(x, y - 14); ctx.lineTo(x + 7, y - 4); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x + 14, y); ctx.fill();
}
Object.assign(ENEMY_DRAW, {
  boar: drawBoar, behemoth: drawBoar, spark: drawSpark, pseudodog: drawDog, packalpha: drawDog, karlik: drawBurer,
  msoldier: (e) => drawStalker(e, { ...PAL_MSOLDIER, arms: e.state === 1 ? e.aimA : Math.atan2(P.y - e.y, P.x - e.x) }, false),
  matriarch: drawBloodsucker, prime: drawController, izlomlord: drawIzlom,
  polterking: (e) => { drawPoltergeist(e); crown(e, 18, '#ffcf3a'); },
  ratqueen: (e) => { drawRat(e); crown(e, 14, '#ffcf3a'); },
});
