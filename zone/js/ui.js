'use strict';
// ---------- rendering ----------
const DRAW = [], DPOOL = []; let DN = 0;
const dq = (y, t, o, d) => { let it = DPOOL[DN]; if (!it) it = DPOOL[DN] = { y: 0, t: 0, o: null, d: 0 }; it.y = y; it.t = t; it.o = o; it.d = d; DRAW[DN++] = it; };
// Lowest: particle colours with alpha rounded to tenths come from a cache instead of a new string per particle per frame
const PCOL = new Map();
function pcol(c, a) { const k = c + (a * 10 | 0); let v = PCOL.get(k); if (!v) { if (PCOL.size > 4000) PCOL.clear(); PCOL.set(k, v = `rgba(${c},${(a * 10 | 0) / 10 + 0.05})`); } return v; }
function render(title = false) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const low = lowGfx(), minQ = minGfx();
  // on Lowest the ground tiles (and the dark fill past the world's edge) cover every pixel: no separate clear pass
  if (!minQ || !G) { ctx.fillStyle = '#0d0c09'; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (!G) return;
  const sc = ZOOM * DPR;
  const sx = G.shake * (Math.sin(NOW * 41) * 0.35 + Math.sin(NOW * 67) * 0.2), sy = G.shake * (Math.cos(NOW * 37) * 0.35 + Math.sin(NOW * 59) * 0.2);
  const cx = CAM.x + sx, cy = CAM.y + sy;
  ctx.setTransform(sc, 0, 0, sc, cv.width / 2 - cx * sc, cv.height / 2 - cy * sc);
  RT.sc = sc; RT.tx = cv.width / 2 - cx * sc; RT.ty = cv.height / 2 - cy * sc;
  const hw = VW / 2 / ZOOM, hh = VH / 2 / ZOOM;
  const x0 = cx - hw - 20, x1 = cx + hw + 20, y0 = cy - hh - 20, y1 = cy + hh + 20;
  const NC = Math.ceil(WORLD / CHUNK) - 1;
  if (minQ) drawGroundFast(Math.max(0, Math.floor(x0 / CHUNK)), Math.min(NC, Math.floor(x1 / CHUNK)), Math.max(0, Math.floor(y0 / CHUNK)), Math.min(NC, Math.floor(y1 / CHUNK)));
  else for (let gy = Math.max(0, Math.floor(y0 / CHUNK)); gy <= Math.min(NC, Math.floor(y1 / CHUNK)); gy++)
    for (let gx = Math.max(0, Math.floor(x0 / CHUNK)); gx <= Math.min(NC, Math.floor(x1 / CHUNK)); gx++)
      ctx.drawImage(World.chunk(gx, gy), gx * CHUNK, gy * CHUNK, CHUNK + 1, CHUNK + 1);
  ctx.fillStyle = '#0d0c09';
  if (x0 < 0) ctx.fillRect(x0 - 10, y0 - 10, -x0 + 10, y1 - y0 + 20);
  if (y0 < 0) ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, -y0 + 10);
  if (x1 > WORLD) ctx.fillRect(WORLD, y0 - 10, x1 - WORLD + 10, y1 - y0 + 20);
  if (y1 > WORLD) ctx.fillRect(x0 - 10, WORLD, x1 - x0 + 20, y1 - WORLD + 10);
  if (!minQ) for (const d of G.decals) {
    if (d.x < x0 - 60 || d.x > x1 + 60 || d.y < y0 - 60 || d.y > y1 + 60) continue;
    ctx.fillStyle = `rgba(${d.c},${Math.min(0.55, d.life / 10)})`;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, d.a, 0, TAU); ctx.fill();
  }
  drawW2Base(x0, y0, x1, y1, title);
  for (const r of World.rads) {
    if (r.x + r.r < x0 || r.x - r.r > x1 || r.y + r.r < y0 || r.y - r.r > y1) continue;
    const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.r);
    g.addColorStop(0, 'rgba(230,220,60,0.22)'); g.addColorStop(1, 'rgba(230,220,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,220,60,0.25)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  const em = G.em && G.em.phase !== 'after';
  for (const s of World.shelters) {
    if (s.x < x0 - 100 || s.x > x1 + 100 || s.y < y0 - 100 || s.y > y1 + 150) continue;
    ctx.fillStyle = 'rgba(90,95,88,0.7)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = em ? `rgba(90,255,120,${0.5 + Math.sin(NOW * 8) * 0.4})` : 'rgba(90,255,120,0.35)'; ctx.lineWidth = em ? 4 : 2;
    ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,255,120,0.5)'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText('SHELTER', s.x, s.y + 5);
  }
  for (const p of World.pois) {
    if (p.x < x0 - 300 || p.x > x1 + 300 || p.y < y0 - 300 || p.y > y1 + 300) continue;
    ctx.strokeStyle = p.state === 2 ? 'rgba(120,255,140,0.25)' : `rgba(255,190,60,${0.25 + Math.sin(NOW * 3) * 0.1})`; ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 230, 150, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const a of World.anomalies) if (a.x > x0 - a.r && a.x < x1 + a.r && a.y > y0 - a.r && a.y < y1 + a.r) drawAnomalyGround(a);
  if (!title && G.owned) { drawHazardsGround(x0, y0, x1, y1); drawOwned(); drawEventWorld(); }
  for (const g of G.gems) {
    if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
    const big = g.v >= 20, mid = g.v >= 5, s = big ? 7 : mid ? 5.5 : 4, c = big ? '#ff6ad5' : mid ? '#6ad0ff' : '#7dff8a';
    const y = g.y - g.z - 5 - Math.sin(NOW * 4 + g.x) * 2;
    if (minQ) { ctx.fillStyle = c; ctx.fillRect(g.x - s * 0.5, y - s * 0.8, s, s * 1.6); continue; }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(g.x - s * 0.6, g.y - 1, s * 1.2, 2);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(g.x, y - s); ctx.lineTo(g.x + s * 0.7, y); ctx.lineTo(g.x, y + s); ctx.lineTo(g.x - s * 0.7, y); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(g.x - 1, y - s * 0.6, 2, s * 0.5);
  }
  // sortable things
  DN = 0;
  const PC = WORLD / PCELL, st = ++World.stamp;
  for (let gy = Math.max(0, Math.floor((y0 - 60) / PCELL)); gy <= Math.min(PC - 1, Math.floor((y1 + 700) / PCELL)); gy++)
    for (let gx = Math.max(0, Math.floor((x0 - 400) / PCELL)); gx <= Math.min(PC - 1, Math.floor((x1 + 400) / PCELL)); gx++)
      for (const p of World.propGrid[gy * PC + gx]) {
        if (p._s === st) continue; p._s = st;
        if (p.bx1 < x0 || p.bx0 > x1 || p.by1 < y0 || p.by0 > y1) continue;
        if (low && p.kind === 'grass') continue;
        if (minQ && PROP_BAKE.has(p.kind)) continue; // already painted into the ground
        dq(p.sy, 0, p);
      }
  for (const e of G.enemies) if (e.x > x0 - 80 && e.x < x1 + 80 && e.y > y0 - 40 && e.y < y1 + 160) dq(e.y, 1, e);
  if (!title) dq(P.y, 2, P);
  for (const c of G.crates) if (c.open < 1.5 && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1 + 40) dq(c.y, 3, c);
  for (const p of G.pickups) if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 + 40) dq(p.y, 4, p);
  const detR = 330 * (P.detect || 1);
  for (const f of World.fields) if (f.art) { const a = f.art, d = dist(a.x, a.y, P.x, P.y); if (d < detR && a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) dq(a.y, 5, a, d); }
  for (const p of World.pois) if (p.state < 2 && p.x > x0 - 50 && p.x < x1 + 50 && p.y > y0 && p.y < y1 + 50) dq(p.y, 6, p);
  DRAW.length = DN; DRAW.sort((a, b) => a.y - b.y);
  for (const it of DRAW) if (it.t === 1) {
    const e = it.o, s = e.sc || 1;
    if (!minQ) shadow(e.x, e.y, e.r * 1.1 * (1 - Math.min(0.5, e.z / 200)), e.r * 0.4, e.id === 'poltergeist' ? 0.15 : 0.3 * (e.alpha ?? 1));
    if (e.mut) {
      const M = MUTATIONS[e.mut], R = e.r * (e.boss ? 2 : 1.6) * (e.d.vsc || 1);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
      g.addColorStop(0, `rgba(${M.rgb},0.4)`); g.addColorStop(1, `rgba(${M.rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * 0.55, 0, 0, TAU); ctx.fill();
      if (Math.random() < 0.08) part(e.x + rand(-e.r, e.r), e.y - e.z - rand(0, e.r * 2), { z: 0, vz: 40, g: -10, c: M.rgb, add: true, s: 2.5, life: 0.6 });
    }
    if (e.affix || e.mini) {
      const c = e.mini ? '#ffb830' : ELITE_AFFIX[e.affix].color;
      ctx.strokeStyle = c; ctx.globalAlpha = 0.5 + Math.sin(NOW * 6 + e.seed) * 0.3; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.4 * s / s, e.r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  if (!title) shadow(P.x, P.y, 14, 5, 0.35);
  for (const it of DRAW) {
    const o = it.o;
    if (it.t === 0) drawPropFast(o);
    else if (it.t === 1) {
      FL = o.flash > 0;
      const vs = (o.sc || 1) * (o.d.vsc || 1), an = animSquash(o);
      drawEnemyScaled(o, vs * (1 + an), vs * (1 - an));
      FL = false;
      if (o.frozen && o.stun > 0) { ctx.fillStyle = 'rgba(170,225,255,0.45)'; ctx.beginPath(); ctx.ellipse(o.x, o.y - o.r * 1.2, o.r * 1.3, o.r * 1.5, 0, 0, TAU); ctx.fill(); } else if (o.frozen) o.frozen = 0;
      if (o.burnT > 0 && Math.random() < 0.2) part(o.x + rand(-8, 8), o.y - o.z - 16, { z: 0, vz: 40, g: -20, c: '255,120,30', add: true, s: 3, life: 0.4 });
    }
    else if (it.t === 2) drawPlayer();
    else if (it.t === 3) drawCrate(o);
    else if (it.t === 4) drawPickup(o);
    else if (it.t === 5) drawArtifact(o, clamp((detR - it.d) / 120, 0, 1));
    else if (it.t === 6) drawPoiChest(o);
  }
  for (const a of World.anomalies) if (a.x > x0 - a.r && a.x < x1 + a.r && a.y > y0 - 150 && a.y < y1 + a.r) drawAnomalyTop(a);
  if (!title) { drawHazardsTop(x0, y0, x1, y1); drawW2Top(x0, y0, x1, y1); drawStory(x0, y0, x1, y1); drawPartner(); drawVehPrompt(); drawPlayerFx(); }
  // bullets
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = minQ ? 'butt' : 'round';
  const BB = minQ ? new Map() : null;
  for (const b of G.bullets) {
    if (b.k === 'bolt') continue;
    if (drawBullet2(b)) continue;
    if (b.rocket) { ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, TAU); ctx.fill(); continue; }
    const bc = b.ignite ? 'rgba(255,140,40,0.95)' : b.big ? 'rgba(255,240,180,1)' : 'rgba(255,220,140,0.9)';
    if (BB) { const k = bc + '|' + b.r; let a = BB.get(k); if (!a) BB.set(k, a = []); a.push(b.x, b.y, b.x - b.vx * 0.022, b.y - b.vy * 0.022); continue; }
    ctx.strokeStyle = bc; ctx.lineWidth = b.r * 0.9;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke();
  }
  // Lowest: tracers of the same look go out as one path each instead of one stroke per bullet
  if (BB) for (const [k, a] of BB) {
    const i = k.lastIndexOf('|'); ctx.strokeStyle = k.slice(0, i); ctx.lineWidth = +k.slice(i + 1) * 0.9; ctx.beginPath();
    for (let j = 0; j < a.length; j += 4) { ctx.moveTo(a[j], a[j + 1]); ctx.lineTo(a[j + 2], a[j + 3]); }
    ctx.stroke();
  }
  for (const b of G.ebullets) {
    if (b.k === 'fake') { ctx.fillStyle = `rgba(140,220,255,${0.3 + Math.sin(NOW * 30 + b.x) * 0.2})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.6, 0, TAU); ctx.fill(); continue; }
    const c = b.k === 'web' ? '240,240,240' : b.k === 'psi' ? '200,100,255' : b.k === 'fire' ? '255,140,40' : b.k === 'mono' ? '140,220,255' : b.k === 'debris' ? '200,170,120' : '255,90,60';
    if (low) { ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.2, 0, TAU); ctx.fill(); continue; }
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, `rgba(${c},0.9)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  for (const b of G.bullets) if (b.k === 'bolt') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(NOW * 20);
    ctx.fillStyle = b.vortex ? '#c8b0ff' : '#b8b8b0'; ctx.fillRect(-6, -2, 12, 4); ctx.fillStyle = '#888'; ctx.fillRect(-7, -4, 4, 8); ctx.restore();
  }
  for (const t of G.throws) {
    const k = t.t / t.T, x = lerp(t.x0, t.x1, k), y = lerp(t.y0, t.y1, k), z = Math.sin(k * Math.PI) * 120;
    shadow(x, y + 20 * (1 - k), 5, 2, 0.3);
    ctx.fillStyle = t.k === 'erock' ? '#6a5a4a' : t.k === 'acid' ? '#8cff5a' : t.k === 'flare' ? '#ff8a3a' : '#3a4a2a'; ctx.beginPath(); ctx.arc(x, y - z, t.k === 'erock' ? 9 : 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#aaa'; ctx.fillRect(x - 1, y - z - 8, 3, 4);
  }
  drawFx();
  for (const p of G.particles) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 + 50) continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.add && !minQ) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = minQ ? pcol(p.c, a) : `rgba(${p.c},${a})`;
    if (minQ) { const r = p.s * (p.add ? 1 : 0.6 + a * 0.4); ctx.fillRect(p.x - r, p.y - p.z - r, r * 2, r * 2); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.s * (p.add ? 1 : 0.6 + a * 0.4), 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // health bars for elites / alphas, stun stars
  for (const e of G.enemies) {
    if (e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1 + 100) continue;
    const top = e.y - e.z - e.r * 2.6 - 16;
    if ((e.affix || e.mini) && e.hp < e.maxhp) {
      const w = e.mini ? 60 : 36;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2 - 1, top - 1, w + 2, 6);
      ctx.fillStyle = e.mini ? '#ffb830' : ELITE_AFFIX[e.affix].color; ctx.fillRect(e.x - w / 2, top, w * (e.hp / e.maxhp), 4);
    }
    if (e.mini) { ctx.font = 'bold 11px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf6a'; ctx.fillText(e.name, e.x, top - 5); }
    if (e.stun > 0) { ctx.fillStyle = '#ffe070'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦ ✦', e.x + Math.sin(NOW * 8) * 6, top); }
  }
  for (const L of World.lairs) {
    if (L.dead || L.state === 0 || L.x < x0 || L.x > x1 || L.y < y0 || L.y > y1 + 100) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(L.x - 41, L.y - 96, 82, 7);
    ctx.fillStyle = '#b8e040'; ctx.fillRect(L.x - 40, L.y - 95, 80 * clamp(L.ob.hp / L.maxhp, 0, 1), 5);
  }
  ctx.textAlign = 'center';
  // floating numbers stay at least ~13px on screen however far the camera is zoomed out
  const tk = Math.max(1, 0.95 / ZOOM), fSm = `bold ${Math.round(14 * tk)}px Oswald, Impact, sans-serif`, fBig = `bold ${Math.round(20 * tk)}px Oswald, Impact, sans-serif`;
  for (const t of G.texts) {
    ctx.globalAlpha = clamp(t.life * 2, 0, 1);
    if (minQ) { textStamp(t.s, t.c, t.big ? fBig : fSm, t.big ? 20 * tk : 14 * tk, t.x, t.y); continue; }
    ctx.font = t.big ? fBig : fSm;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(t.s, t.x + 1.5, t.y + 1.5);
    ctx.fillStyle = t.c; ctx.fillText(t.s, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (!title) {
    if (em && !inShelter(P.x, P.y)) {
      const s = nearestShelter();
      if (s) {
        const a = Math.atan2(s.y - P.y, s.x - P.x), r = 60;
        ctx.save(); ctx.translate(P.x + Math.cos(a) * r, P.y - 16 + Math.sin(a) * r); ctx.rotate(a);
        ctx.fillStyle = `rgba(90,255,120,${0.6 + Math.sin(NOW * 10) * 0.3})`;
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-6, -11); ctx.lineTo(-1, 0); ctx.lineTo(-6, 11); ctx.fill(); ctx.restore();
      }
    }
    if (P.hatchT > 0 && G.onHatch) {
      ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(P.x, P.y - 60, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (P.hatchT / 0.9)); ctx.stroke();
      ctx.font = 'bold 12px Oswald, sans-serif'; ctx.fillStyle = '#ffcf6a'; ctx.fillText(G.onHatch.exit ? 'CLIMBING UP…' : 'DESCENDING…', P.x, P.y - 84);
    }
  }
  if (!low && World.kind === 'over') {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 5; i++) {
      const wx = ((i * 1733 + NOW * 22) % 2600) - 1300 + Math.floor(cx / 2600) * 2600, wy = ((i * 977 + NOW * 9) % 2000) - 1000 + Math.floor(cy / 2000) * 2000;
      for (const ox of [0, 2600]) for (const oy of [0, 2000]) {
        const X = wx + ox, Y = wy + oy; if (X < x0 - 600 || X > x1 + 600 || Y < y0 - 600 || Y > y1 + 600) continue;
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, 520);
        g.addColorStop(0, 'rgba(150,150,160,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(X - 520, Y - 520, 1040, 1040);
      }
    }
    ctx.restore();
  }
  // ---- screen space ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  Env.render(cx, cy);
  drawW2Screen(cx, cy, title);
  if (G.em) { const k = G.em.phase === 'warn' ? (1 - G.em.t / 30) * 0.3 : G.em.phase === 'blast' ? 0.42 + Math.sin(NOW * 12) * 0.1 : 0.3 * (G.em.t / 3); ctx.fillStyle = `rgba(160,30,20,${World.kind === 'lab' ? k * 0.3 : k})`; ctx.fillRect(0, 0, VW, VH); }
  else if (!minQ) { ctx.fillStyle = 'rgba(40,50,30,0.1)'; ctx.fillRect(0, 0, VW, VH); }
  if (G.rad > 0) { ctx.fillStyle = `rgba(200,200,40,${G.rad * 0.12})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.psi > 0) {
    ctx.fillStyle = `rgba(120,40,180,${G.psi * 0.18})`; ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = `rgba(200,120,255,${G.psi * 0.25})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const r = ((NOW * 300 + i * 200) % 600); ctx.beginPath(); ctx.arc(VW / 2, VH / 2, r, 0, TAU); ctx.stroke(); }
  }
  const lowhp = !title && P.hp / P.maxhp < 0.3;
  if (!minQ) { // full-screen vignette: skipped on the lowest setting
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${lowhp ? 0.75 : 0.55})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }
  if (lowhp) { ctx.fillStyle = `rgba(200,0,0,${(0.3 - P.hp / P.maxhp) * (0.5 + Math.sin(NOW * 6) * 0.3)})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashCol},${G.flash * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
  if (title) return;
  const edge = (wx, wy, color, label) => {
    const sxp = (wx - cx) * ZOOM + VW / 2, syp = (wy - cy) * ZOOM + VH / 2;
    if (sxp > 0 && sxp < VW && syp > 0 && syp < VH) return;
    const a = Math.atan2(syp - VH / 2, sxp - VW / 2), ex = clamp(sxp, 30, VW - 30), ey = clamp(syp, 100, VH - 40);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.fill(); ctx.restore();
    ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, ex - Math.cos(a) * 22, ey - Math.sin(a) * 22 + 6);
  };
  for (const b of G.bosses) edge(b.x, b.y, '#ff3a2a', '💀');
  for (const q of Quests.list) if (q.loc && World.kind === 'over') edge(q.loc.x, q.loc.y, '#ffcf3a', q.icon);
  if (Events.cur && Events.cur.loc) edge(Events.cur.loc.x, Events.cur.loc.y, '#ff8a3a', EVENTS[Events.cur.id].icon);
  if (G.markT > 0) { ctx.strokeStyle = 'rgba(255,50,50,0.7)'; ctx.lineWidth = 2; const X = (P.x - cx) * ZOOM + VW / 2, Y = (P.y - 20 - cy) * ZOOM + VH / 2; ctx.beginPath(); ctx.arc(X, Y, 30 * ZOOM, 0, TAU); ctx.moveTo(X - 40 * ZOOM, Y); ctx.lineTo(X + 40 * ZOOM, Y); ctx.moveTo(X, Y - 40 * ZOOM); ctx.lineTo(X, Y + 40 * ZOOM); ctx.stroke(); }
  const EM = Events.mods();
  if (EM.red) { ctx.fillStyle = `rgba(160,0,0,${0.16 + Math.sin(NOW * 2) * 0.04})`; ctx.fillRect(0, 0, VW, VH); }
  if (EM.flood) { ctx.fillStyle = 'rgba(30,70,110,0.18)'; ctx.fillRect(0, 0, VW, VH); }
}
function drawShield() {
  if (!(P.shieldT > 0)) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = P.shieldC || '#9fe8ff'; ctx.globalAlpha = 0.5 + Math.sin(NOW * 12) * 0.2; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(P.x, P.y - 22, 30, 36, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.12; ctx.fillStyle = P.shieldC || '#9fe8ff'; ctx.fill(); ctx.restore();
}
function drawPlayer() {
  const blink = P.inv > 0 && P.dashT <= 0 && Math.floor(NOW * 20) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.5;
  if (P.veh) { drawVehicle(P.veh, P.x, P.y); ctx.save(); ctx.translate(0, P.veh.kind === 'jeep' ? -26 : -12); drawStalker(P, P.pal, true); ctx.restore(); }
  else drawStalker(P, P.pal, true);
  ctx.globalAlpha = 1;
  if (P.inWater && P.z <= 0) { ctx.fillStyle = 'rgba(60,110,120,0.75)'; ctx.beginPath(); ctx.ellipse(P.x, P.y - 4, 17, 8, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,230,240,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(P.x, P.y - 4, 20 + Math.sin(NOW * 4) * 3, 9, 0, 0, TAU); ctx.stroke(); }
  drawShield();
}
function drawPlayerFx() {
  if (P.aura) {
    const R = (70 + P.aura * 16) * P.areaMul;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(P.x, P.y, R * 0.3, P.x, P.y, R);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(0.8, `rgba(255,110,30,${0.14 + Math.sin(NOW * 8) * 0.05})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(P.x, P.y, R, R * 0.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.5) { const a = rand(TAU); part(P.x + Math.cos(a) * R * 0.9, P.y + Math.sin(a) * R * 0.63, { vz: 80, g: -40, c: '255,140,40', add: true, s: 3, life: 0.5 }); }
  }
  if (P.shards) {
    const R = 78 * P.areaMul;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.shards; i++) {
      const a = NOW * 2.8 + (i / P.shards) * TAU, x = P.x + Math.cos(a) * R, y = P.y - 14 + Math.sin(a) * R * 0.7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 18); g.addColorStop(0, 'rgba(230,250,255,1)'); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(x, y); ctx.rotate(a * 2); ctx.fillRect(-3, -6, 6, 12); ctx.restore();
    }
    ctx.restore();
  }
}
function drawFx() {
  ctx.save(); ctx.lineCap = 'round';
  for (const f of G.fx) {
    if (f.delay > 0) continue;
    const k = clamp(f.life / f.max, 0, 1);
    switch (f.k) {
      case 'boom': {
        ctx.globalCompositeOperation = 'lighter';
        const r = f.r * (1.1 - k * 0.5);
        const g = ctx.createRadialGradient(f.x, f.y - 10, 0, f.x, f.y - 10, r);
        g.addColorStop(0, `rgba(255,250,200,${k})`); g.addColorStop(0.4, `rgba(255,150,40,${k * 0.8})`); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - 10, r, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'sound':
        ctx.strokeStyle = `rgba(255,190,90,${k * 0.8})`; ctx.lineWidth = 6;
        for (const m of [1, 0.75, 0.5]) { ctx.beginPath(); ctx.ellipse(f.x, f.y - 10, f.r * m, f.r * m * 0.62, 0, 0, TAU); ctx.stroke(); }
        break;
      case 'beam':
        ctx.globalCompositeOperation = 'lighter';
        if (f.ice) { ctx.strokeStyle = `rgba(160,230,255,${k * 0.7})`; ctx.lineWidth = f.w * 2 * k + 4; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
        ctx.strokeStyle = f.psi ? `rgba(200,110,255,${k * 0.7})` : `rgba(90,180,255,${k * 0.6})`; ctx.lineWidth = f.w * 2 * k + 4;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(240,250,255,${k})`; ctx.lineWidth = f.w * 0.6 * k + 1;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'tele':
        ctx.strokeStyle = `rgba(255,40,30,${0.25 + (1 - k) * 0.45})`; ctx.lineWidth = f.w;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,120,100,${0.6})`; ctx.lineWidth = 1.5; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.setLineDash([]);
        break;
      case 'slash': {
        ctx.globalCompositeOperation = f.red ? 'source-over' : 'lighter';
        const prog = 1 - k, arc = f.arc >= TAU ? TAU : f.arc, a0 = f.a - arc / 2, a1 = a0 + arc * Math.min(1, prog * 2.2);
        const c1 = f.red || f.blood ? '255,60,50' : '230,240,255', c2 = f.red || f.blood ? '200,20,20' : '150,200,255';
        ctx.strokeStyle = `rgba(${c1},${k})`; ctx.lineWidth = 10 * k + 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, a0, a1); ctx.stroke();
        ctx.strokeStyle = `rgba(${c2},${k * 0.5})`; ctx.lineWidth = 22 * k;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 0.56, 0, a0, a1); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'lightning':
        ctx.globalCompositeOperation = 'lighter';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? `rgba(240,250,255,${k})` : `rgba(90,160,255,${k * 0.7})`; ctx.lineWidth = pass ? 2 : 6;
          for (let i = 0; i < f.pts.length - 1; i++) jag(f.pts[i][0], f.pts[i][1], f.pts[i + 1][0], f.pts[i + 1][1], 6, 10);
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'patch': {
        if (f.type === 'web') {
          ctx.strokeStyle = `rgba(235,235,235,${Math.min(0.7, f.life / 0.8)})`; ctx.lineWidth = 1;
          for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + f.seed; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r * 0.6); ctx.stroke(); }
          for (const m of [0.35, 0.65, 0.95]) { ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * m, f.r * m * 0.6, 0, 0, TAU); ctx.stroke(); }
          break;
        }
        const fire = f.type === 'fire', a = Math.min(1, f.life / 0.6) * (fire ? 0.5 + Math.sin(NOW * 14 + f.seed) * 0.15 : 0.55);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, fire ? `rgba(255,190,80,${a})` : `rgba(170,255,90,${a})`); g.addColorStop(1, fire ? 'rgba(255,80,20,0)' : 'rgba(90,200,50,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, TAU); ctx.fill();
        if (Math.random() < 0.25) part(f.x + rand(-f.r, f.r) * 0.7, f.y + rand(-f.r, f.r) * 0.4, { z: 2, vz: fire ? 90 : 25, g: -20, c: fire ? '255,150,50' : '170,255,90', add: true, s: 3, life: 0.5 });
        break;
      }
      case 'ehole': {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, 'rgba(10,0,20,0.9)'); g.addColorStop(0.2, 'rgba(120,60,220,0.5)'); g.addColorStop(1, 'rgba(90,30,180,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,60,60,0.6)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const a = -NOW * 5 + i * 2.1; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.35 + i * 0.2), f.r * (0.35 + i * 0.2) * 0.62, 0, a, a + 2); ctx.stroke(); }
        break;
      }
      case 'shock':
        if (f.psi) {
          ctx.strokeStyle = `rgba(200,110,255,${1 - f.r / f.max})`; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.stroke(); break;
        }
        ctx.strokeStyle = `rgba(200,170,130,${1 - f.r / f.max})`; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(255,230,180,${(1 - f.r / f.max) * 0.8})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r - 4, (f.r - 4) * 0.62, 0, 0, TAU); ctx.stroke();
        break;
      case 'nova': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,140,40,${0.9 * (1 - f.r / f.max) + 0.1})`; ctx.lineWidth = 26;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,160,0.8)'; ctx.lineWidth = 6; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'hole': {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(f.x, f.y - 10, 0, f.x, f.y - 10, f.r);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.15, 'rgba(160,120,255,0.6)'); g.addColorStop(1, 'rgba(90,60,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y - 10, f.r, f.r * 0.62, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(f.x, f.y - 10, 14 + Math.sin(NOW * 20) * 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(210,190,255,0.6)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const a = NOW * 6 + i * 2.1; ctx.beginPath(); ctx.ellipse(f.x, f.y - 10, f.r * (0.3 + i * 0.2), f.r * (0.3 + i * 0.2) * 0.62, 0, a, a + 2); ctx.stroke(); }
        break;
      }
      case 'cloud': {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(140,255,90,${0.05 * k})`); g.addColorStop(0.7, `rgba(120,230,70,${0.28 * k})`); g.addColorStop(1, 'rgba(100,200,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
        if (Math.random() < 0.5) { const a = rand(TAU), d = rand(f.r); part(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7, { z: 5, vz: 30, g: -10, c: '150,255,90', add: true, s: 4, life: 0.8 }); }
        break;
      }
      case 'target':
        ctx.strokeStyle = f.blue ? `rgba(160,210,255,${0.5 + Math.sin(NOW * 25) * 0.3})` : `rgba(255,50,40,${0.4 + Math.sin(NOW * 25) * 0.3})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = f.blue ? 'rgba(160,210,255,0.12)' : 'rgba(255,40,30,0.12)'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1 - k), f.r * (1 - k) * 0.62, 0, 0, TAU); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(${f.c},${k})`; ctx.lineWidth = 6 * k;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (1.4 - k * 0.4), f.r * (1.4 - k * 0.4) * 0.62, 0, 0, TAU); ctx.stroke();
        break;
      case 'sky':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,220,200,${k})`; ctx.lineWidth = 3;
        jag(f.x + rand(-80, 80), f.y - 900, f.x, f.y, 12, 26);
        ctx.fillStyle = `rgba(255,160,120,${k * 0.4})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 60, 30, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
    }
  }
  ctx.restore();
}
function drawCrate(c) {
  if (minGfx() && !c.open && ctx === GLR.main) { // Lowest: a closed crate is one cached picture (bobbing kept)
    const sp = SPRITES.get('crate', -26, -44, 52, 56, () => drawCrate({ x: 0, y: 0, open: 0, _raw: 1 }));
    if (sp.c) blit(sp.c, c.x + sp.x, c.y + sp.y + Math.sin(NOW * 3 + c.x));
    return;
  }
  const a = c.open ? clamp(1 - c.open / 1.5, 0, 1) : 1;
  ctx.globalAlpha = a;
  shadow(c.x + 4, c.y + 2, 18, 6, 0.3);
  if (!c.open) {
    const bob = Math.sin(NOW * 3 + c.x) * 1;
    ctx.fillStyle = '#6a4e2e'; ctx.fillRect(c.x - 15, c.y - 20 + bob, 30, 20);
    ctx.fillStyle = '#86653c'; ctx.fillRect(c.x - 15, c.y - 26 + bob, 30, 7);
    ctx.strokeStyle = '#3e2c18'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 15, c.y - 20 + bob, 30, 20);
    ctx.beginPath(); ctx.moveTo(c.x - 15, c.y - 20 + bob); ctx.lineTo(c.x + 15, c.y + bob); ctx.stroke();
    ctx.fillStyle = `rgba(255,220,120,${0.5 + Math.sin(NOW * 4) * 0.3})`; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▼', c.x, c.y - 34 + bob);
  } else {
    ctx.fillStyle = '#5a4026'; ctx.fillRect(c.x - 18, c.y - 5, 14, 5); ctx.fillRect(c.x + 3, c.y - 7, 15, 5); ctx.fillRect(c.x - 6, c.y - 3, 12, 4);
  }
  ctx.globalAlpha = 1;
}
function drawChest(x, y, gold, locked) {
  shadow(x + 4, y + 2, 28, 8, 0.35);
  ctx.fillStyle = gold ? '#8a6a2a' : '#4a4a4a'; ctx.fillRect(x - 24, y - 26, 48, 26);
  ctx.fillStyle = gold ? '#c9a040' : '#6a6a6a'; ctx.fillRect(x - 24, y - 34, 48, 10);
  ctx.fillStyle = gold ? '#ffe070' : '#999'; ctx.fillRect(x - 24, y - 20, 48, 3); ctx.fillRect(x - 4, y - 24, 8, 10);
  if (locked) { ctx.fillStyle = '#ff5a4a'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', x, y - 44 + Math.sin(NOW * 3) * 2); }
}
function drawPoiChest(p) {
  drawChest(p.x, p.y, false, true);
  ctx.font = 'bold 13px Oswald, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(p.icon + ' ' + p.name.toUpperCase(), p.x + 1, p.y - 69);
  ctx.fillStyle = '#ffcf6a'; ctx.fillText(p.icon + ' ' + p.name.toUpperCase(), p.x, p.y - 70);
}
function drawPickup(p) {
  if (p.type === 'poistash' || p.type === 'labstash' || p.type === 'stash') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y - 20, 0, p.x, p.y - 20, 70); g.addColorStop(0, `rgba(255,210,80,${0.5 + Math.sin(NOW * 4) * 0.2})`); g.addColorStop(1, 'rgba(255,210,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 20, 70, 0, TAU); ctx.fill(); ctx.restore();
    drawChest(p.x, p.y, true, false);
    return;
  }
  const y = p.y - 14 - Math.sin(NOW * 4 + p.x) * 3;
  shadow(p.x, p.y, 10, 4, 0.3);
  if (p.type === 'item') { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ITEMS[p.id].icon, p.x, y + 8); return; }
  if (p.type === 'art') { drawArtifact({ x: p.x, y: p.y, type: 'moonlight', t: p.x }, 1); return; }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const c = p.type === 'med' ? '120,255,120' : '120,180,255';
  const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, 26); g.addColorStop(0, `rgba(${c},0.5)`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, y, 26, 0, TAU); ctx.fill(); ctx.restore();
  if (p.type === 'med') {
    ctx.fillStyle = '#eee'; ctx.fillRect(p.x - 9, y - 7, 18, 14); ctx.fillStyle = '#d22'; ctx.fillRect(p.x - 2, y - 5, 4, 10); ctx.fillRect(p.x - 5, y - 2, 10, 4);
  } else {
    ctx.strokeStyle = '#d33'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, y, 7, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.fillRect(p.x - 9.5, y, 5, 5); ctx.fillRect(p.x + 4.5, y, 5, 5);
  }
}

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function hudBuild() {
  const wb = $('weapons'); wb.innerHTML = '';
  for (const w of P.weapons) {
    const d = document.createElement('div'); d.className = 'slot' + (w.evo ? ' evo' : '');
    d.innerHTML = `<span>${w.evo ? EVOLUTIONS[w.id].icon : WEAPONS[w.id].icon}</span><b>${w.evo ? '★' : w.lv >= WEAPONS[w.id].max ? 'MAX' : w.lv}</b>`;
    d.title = w.evo ? EVOLUTIONS[w.id].name : WEAPONS[w.id].name;
    wb.appendChild(d);
  }
  for (const id in P.perks) {
    const d = document.createElement('div'); d.className = 'slot perk';
    d.innerHTML = `<span>${PERKS[id].icon}</span><b>${P.perks[id]}</b>`; d.title = PERKS[id].name;
    wb.appendChild(d);
  }
  const ab = $('artbelt'); ab.innerHTML = '';
  const sel = selectedArt();
  ownedArts().forEach((id, i) => {
    const A = ARTIFACTS[id], d = document.createElement('div'); d.className = 'art' + (id === sel ? ' sel' : '');
    d.style.setProperty('--c', A.color); d.title = `${A.name}: ${A.desc} · Q: ${ACTIVES[A.act].name}`;
    d.innerHTML = `${artImg(id)}${P.arts[id] > 1 ? '<b>' + P.arts[id] + '</b>' : ''}`;
    d.onclick = () => { P.actSel = i; hudBuild(); };
    ab.appendChild(d);
  });
  itemsUI();
  $('syn').innerHTML = Object.keys(TAGS).filter((k) => P.tags[k] > 0).map((k) => `<span class="chip ${P.syn[k] ? 'on' + P.syn[k] : ''}" style="--c:${TAGS[k].color}" title="${TAGS[k].name}: 3 → ${TAGS[k].b3} · 6 → ${TAGS[k].b6}">${TAGS[k].icon}${P.tags[k]}</span>`).join('');
  const A = sel ? ARTIFACTS[sel] : null;
  $('abIcon').innerHTML = A ? artImg(sel) : '🔒';
  $('abName').textContent = A ? ACTIVES[A.act].name : 'Find an artifact';
  $('abArt').textContent = A ? A.name : '';
  $('abilityIcon').innerHTML = A ? artImg(sel) : '🔒';
  const many = ownedArts().length > 1;
  for (const id of ['abPrev', 'abNext', 'tPrev', 'tNext']) $(id).style.visibility = many ? 'visible' : 'hidden';
}
// the counter uses real frame times (the simulation step is capped at 50ms, which used to make it read 20 at worst);
// ⚙ is how long the game's own code takes per frame: low ⚙ with low FPS means the phone's GPU/browser is the limit
let fpsAcc = 0, fpsN = 0, fpsShow = 0, FRAME_MS = 16, JS_MS = 0;
function hud(dt) {
  if (Save.set.fps) { if (FRAME_MS < 1000) { fpsAcc += FRAME_MS / 1000; fpsN++; } if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; } }
  bannerTick(dt);
  // Lowest: the HUD's text, bars, minimap and detector refresh every third frame (20 times a second at 60 FPS);
  // each change to the page makes the browser restyle and repaint it
  if (minGfx() && (hudFrame = (hudFrame + 1) % (potatoGfx() ? 12 : 3)) !== 0) return;
  $('hpFill').style.width = (P.hp / P.maxhp) * 100 + '%';
  setText('hpText', Math.ceil(P.hp) + ' / ' + Math.round(P.maxhp));
  $('xpFill').style.width = (G.xp / G.xpNeed) * 100 + '%';
  setText('lvl', 'LV ' + G.level);
  setText('timer', fmtTime(G.t));
  setText('kills', '☠ ' + G.kills);
  setText('rub', Math.floor(G.rubles) + ' ₽');
  setText('envIcon', (World.kind === 'lab' ? '🕳️' : Env.isNight() ? '🌙' : '☀️') + (World.kind === 'over' && Env.weather !== 'clear' ? ' ' + WEATHER[Env.weather].icon : ''));
  $('dashFill').style.transform = `scaleY(${clamp(1 - P.dashCd / (1.4 * P.dashMul), 0, 1)})`;
  $('dashBtn').classList.toggle('ready', P.dashCd <= 0);
  const vb = $('vehBtn'), nv = P.veh || nearVehicle();
  vb.style.display = nv ? 'flex' : 'none'; if (nv) { const h = (P.veh ? '⏏<small>GET OFF</small>' : VEH[nv.kind].icon + '<small>RIDE</small>'); if (vb._h !== h) { vb._h = h; vb.innerHTML = h; } }
  const sel = selectedArt(), cdLeft = sel ? Math.max(0, P.actCd[sel] || 0) : 0;
  const abr = sel ? clamp(1 - cdLeft / ARTIFACTS[sel].cd, 0, 1) : 0;
  $('abFill').style.transform = `scaleY(${abr})`; $('abilityFill').style.transform = `scaleY(${abr})`;
  const abReady = sel && cdLeft <= 0;
  $('ability').classList.toggle('ready', !!abReady); $('abilityBtn').classList.toggle('ready', !!abReady);
  setText('abilityCd', sel && !abReady ? Math.ceil(cdLeft) + 's' : '');
  // the moment an artifact power is usable again: a short flash and a ping
  if (abReady && hud.wasCd && sel === hud.wasCd) { const b = $('abilityBtn'); b.classList.add('readyNow'); setTimeout(() => b.classList.remove('readyNow'), 450); try { Sfx.play('beep'); } catch (e) { /* audio off */ } }
  hud.wasCd = sel && !abReady ? sel : null;
  setText('abCd', !sel ? '' : abReady ? 'READY' : Math.ceil(cdLeft) + 's');
  // every living boss counts: nearest one named first, the bar shows their combined health
  const bl = G.bosses.filter((x) => !x.dead && x.hp > 0 && G.enemies.includes(x)).sort((a, c) => dist2(a.x, a.y, P.x, P.y) - dist2(c.x, c.y, P.x, P.y)), b = bl[0];
  if (b) { let hp = 0, mx = 0; for (const x of bl) { hp += Math.min(x.hp, x.maxhp || x.hp); mx += x.maxhp || x.hp; } $('boss').style.display = 'block'; setText('bossName', b.name + (bl.length > 1 ? ' + ' + bl[1].name : '') + (bl.length > 2 ? ' +' + (bl.length - 2) : '')); $('bossFill').style.width = clamp(hp / mx, 0, 1) * 100 + '%'; }
  else $('boss').style.display = 'none';
  const em = G.em;
  if (em && em.phase !== 'after') {
    $('emission').style.display = 'block';
    const safe = inShelter(P.x, P.y);
    setText('emText', em.phase === 'warn' ? `EMISSION IN ${Math.ceil(em.t)}s — ${safe ? 'YOU ARE SAFE' : 'FIND SHELTER!'}` : safe ? 'EMISSION — STAY IN COVER' : 'EMISSION — YOU ARE DYING!');
    $('emission').classList.toggle('safe', !!safe);
  } else $('emission').style.display = 'none';
  const nbT = nextBossTime(), nb = G.endless ? null : BOSS_SCHEDULE[G.bossIdx];
  const wv = `Wave ${G.wave + 1}${G.waveMut ? ' ' + MUTATIONS[G.waveMut].name : ''}${G.endless ? ' · Tier ' + G.tier : ''}`;
  $('nextEvt').style.display = G.bosses.length || G.tutorial ? 'none' : '';
  setText('nextEvt', nbT === null || nbT - G.t > 3600 ? wv : `${wv} · ☠ ${nb ? (nb.id === 'final' ? stageDef().final.name : ENEMIES[nb.id].name) : 'Boss'} in ${fmtTime(Math.max(0, nbT - G.t))}`);
  setText('fps', Save.set.fps ? fpsShow + ' FPS · ⚙' + JS_MS.toFixed(1) + 'ms' : '');
  if (!potatoGfx() && (!ultraGfx() || (hudFrame2 = (hudFrame2 + 1) % 4) === 0)) { drawDetector(); drawMinimap(); }
}
let hudFrame2 = 0;
let hudFrame = 0;
const mm = $('minimap'), mmx = mm.getContext('2d');
function drawMinimap() {
  const S = mm.width, span = World.kind === 'lab' ? 1600 : 2000, k = WORLD / World.mapImg.width;
  mmx.fillStyle = '#111'; mmx.fillRect(0, 0, S, S);
  mmx.imageSmoothingEnabled = false;
  const sx = (P.x - span / 2) / k, sy = (P.y - span / 2) / k, sw = span / k;
  mmx.drawImage(World.mapImg, sx, sy, sw, sw, 0, 0, S, S);
  const f = S / span, tx = (x) => (x - P.x + span / 2) * f, ty = (y) => (y - P.y + span / 2) * f;
  const inb = (x, y) => x > -8 && x < S + 8 && y > -8 && y < S + 8;
  for (const fl of World.fields) { const x = tx(fl.x), y = ty(fl.y); if (!inb(x, y)) continue; mmx.fillStyle = ANOMALIES[fl.type].color; mmx.globalAlpha = 0.55; mmx.beginPath(); mmx.arc(x, y, 5, 0, TAU); mmx.fill(); mmx.globalAlpha = 1; }
  for (const s of World.shelters) { const x = tx(s.x), y = ty(s.y); mmx.fillStyle = '#5f5'; mmx.fillRect(x - 3, y - 3, 6, 6); }
  mmx.font = '15px sans-serif'; mmx.textAlign = 'center';
  for (const h of World.hatches) { const x = tx(h.x), y = ty(h.y); if (inb(x, y)) mmx.fillText('🕳️', x, y + 5); }
  for (const p of World.pois) { const x = tx(p.x), y = ty(p.y); if (inb(x, y) && p.state < 2) mmx.fillText(p.icon, x, y + 5); }
  for (const l of World.lairs) { const x = tx(l.x), y = ty(l.y); if (inb(x, y) && !l.dead) mmx.fillText('☣️', x, y + 5); }
  mmx.fillStyle = '#f44';
  for (const e of G.enemies) { const x = tx(e.x), y = ty(e.y); if (x < 0 || x > S || y < 0 || y > S) continue; if (e.boss) mmx.fillText('💀', x, y + 5); else if (e.mini || e.affix) { mmx.fillStyle = '#fb3'; mmx.fillRect(x - 2, y - 2, 4, 4); mmx.fillStyle = '#f44'; } else mmx.fillRect(x - 1, y - 1, 2, 2); }
  for (const q of Quests.list) if (q.loc && World.kind === 'over') { const x = clamp(tx(q.loc.x), 8, S - 8), y = clamp(ty(q.loc.y), 8, S - 8); mmx.fillStyle = '#ffcf3a'; mmx.font = 'bold 18px Oswald, sans-serif'; mmx.fillText('!', x, y + 6); }
  if (Events.cur && Events.cur.loc) { const x = clamp(tx(Events.cur.loc.x), 8, S - 8), y = clamp(ty(Events.cur.loc.y), 8, S - 8); mmx.font = '16px sans-serif'; mmx.fillText(EVENTS[Events.cur.id].icon, x, y + 5); }
  mmx.fillStyle = '#fff'; mmx.beginPath(); mmx.arc(S / 2, S / 2, 4, 0, TAU); mmx.fill();
  mmx.strokeStyle = '#000'; mmx.lineWidth = 1.5; mmx.stroke();
}
const det = $('detector'), dtx = det.getContext('2d');
function drawDetector() {
  const S = det.width; dtx.clearRect(0, 0, S, S);
  const art = nearestArtifact();
  dtx.strokeStyle = 'rgba(120,255,140,0.3)'; dtx.lineWidth = 1;
  for (const r of [18, 32]) { dtx.beginPath(); dtx.arc(S / 2, S / 2, r, 0, TAU); dtx.stroke(); }
  if (art && art.d < 1500 * P.detect) {
    const a = Math.atan2(art.a.y - P.y, art.a.x - P.x), c = ARTIFACTS[art.a.type].color;
    dtx.save(); dtx.translate(S / 2, S / 2); dtx.rotate(a);
    dtx.fillStyle = art.d < 300 * P.detect ? c : '#7dff8a';
    dtx.beginPath(); dtx.moveTo(34, 0); dtx.lineTo(12, -9); dtx.lineTo(16, 0); dtx.lineTo(12, 9); dtx.fill(); dtx.restore();
    setText('detDist', Math.round(art.d / 10) + 'm');
  } else setText('detDist', '---');
}

// ---------- screens ----------
function show(id) { $(id).classList.add('show'); }
function hide(id) { $(id).classList.remove('show'); }
function endRun(kind, src) {
  if (G.ended) return; G.ended = true; RunSave.clear();
  if (kind === 'dead' && World.kind === 'over') Save.data.ghost = { stage: G.stage, x: P.x, y: P.y, name: (CHARACTERS.find((c) => c.id === G.char) || CHARACTERS[0]).name };
  G.state = 'over';
  const S = Save.data, mins = Math.floor(G.t / 60);
  const loot = Math.floor((G.rubles - G.paidR) * P.rubMul);
  const earned = Math.floor((loot + (mins - G.paidMin) * 15 + (kind === 'win' ? 500 : 0)) * diffDef().rub);
  const tb = (mins - G.paidMin) * 15;
  G.paidR = G.rubles; G.paidMin = mins;
  S.rubles += earned;
  const bk = G.stage + (G.bossrush ? '_bossrush' : G.endless ? '_endless' : G.daily ? '_daily' : ''), best = S.best[bk] || 0; if (G.t > best) S.best[bk] = G.t;
  let unlock = '';
  if (kind === 'win') {
    S.wins++;
    unlockNextStage();
  }
  if (G.unlocked) unlock = `<div class="unlock">🔓 NEW STAGE UNLOCKED: ${G.unlocked.icon} ${G.unlocked.name}</div>`;
  Save.save();
  $('overTitle').textContent = kind === 'win' ? 'VICTORY' : kind === 'quit' ? 'RUN ABANDONED' : 'YOU DIED';
  $('overTitle').className = kind === 'win' ? 'win' : '';
  $('overSub').textContent = kind === 'win' ? `${stageDef().final.name} shatters. You reached the heart of ${stageDef().name}.` : kind === 'quit' ? 'You fled back to the bunker.' : `Killed by ${src || 'the Zone'}. The Zone claims another stalker.` + (kind !== 'win' && kind !== 'quit' && G.t < 360 && G.diff !== 'tourist' ? ' Tip: pick an easier difficulty in PLAY, or buy Bunker upgrades.' : '');
  $('stats').innerHTML = `<div><b>${fmtTime(G.t)}</b>survived</div><div><b>${G.level}</b>level</div><div><b>${G.kills}</b>kills</div><div><b>${G.arts}</b>artifacts</div><div><b>${G.questsDone}</b>contracts</div><div><b>${fmtTime(Math.max(best, G.t))}</b>best</div>`;
  $('earned').innerHTML = `<div class="earn">+${earned} ₽</div><small>run loot ${loot} · time bonus ${tb}${kind === 'win' ? ' · victory 500' : ''} · ${diffDef().icon} ${diffDef().name} ×${diffDef().rub}  •  total ${S.rubles} ₽</small>${unlock}`;
  $('continueBtn').style.display = kind === 'win' && !G.endless ? 'inline-block' : 'none';
  hide('pause'); hide('levelup'); show('over'); $('touchUi').classList.remove('show');
  Music.setIntensity(0);
}
function gameOver(src) { endRun('dead', src); }
function continueEndless() {
  hide('over'); G.ended = false; G.state = 'play'; G.endless = true; G.won = true;
  G.tier = 2; G.tierT = G.t + 900; G.nextBossT = G.t + 90; G.bossN = BOSS_POOL.length - 1;
  banner('☢ THE ZONE DEEPENS · TIER 2 ☢', 'Endless mode: bosses keep coming, stronger each tier.', 4, 'bad', 2);
  if (matchMedia('(pointer: coarse)').matches) $('touchUi').classList.add('show');
}
function winGame() { flash(1); endRun('win'); }
function togglePause() {
  if (!G || G.title) return;
  if (G.state === 'play') { G.state = 'pause'; buildPause(); show('pause'); RunSave.save(); }
  else if (G.state === 'pause') { G.state = 'play'; hide('pause'); }
}
function buildPause() {
  let h = '<h3>Weapons</h3>';
  for (const w of P.weapons) h += `<div class="row">${w.evo ? EVOLUTIONS[w.id].icon + ' ' + EVOLUTIONS[w.id].name + ' <b>★</b>' : WEAPONS[w.id].icon + ' ' + WEAPONS[w.id].name + ' <b>Lv ' + w.lv + '</b>'}</div>`;
  const evos = P.weapons.filter((w) => !w.evo && EVOLUTIONS[w.id]).map((w) => `${WEAPONS[w.id].icon} max + <span style="color:${ARTIFACTS[EVOLUTIONS[w.id].art].color}">${ARTIFACTS[EVOLUTIONS[w.id].art].name}</span> → ${EVOLUTIONS[w.id].name}`);
  if (evos.length) h += `<div class="row dim">Evolutions: ${evos.join(' · ')}</div>`;
  h += '<h3>Synergies</h3>';
  for (const k in TAGS) h += `<div class="row"><span style="color:${TAGS[k].color}">${TAGS[k].icon} ${TAGS[k].name}</span> <b>${P.tags[k] || 0}</b><div class="dim">3: ${TAGS[k].b3} · 6: ${TAGS[k].b6}</div></div>`;
  h += '<h3>Artifacts</h3>';
  const ak = Object.keys(P.arts);
  if (!ak.length) h += '<div class="row dim">None yet. Look inside anomaly fields (colored circles on the minimap).</div>';
  for (const id of ak) h += `<div class="row">${artImg(id, 'sm')} ${ARTIFACTS[id].name} ×${P.arts[id]} <span class="dim">${TAGS[ARTIFACTS[id].tag].icon} ${ARTIFACTS[id].desc} · Q: ${ACTIVES[ARTIFACTS[id].act].name}</span></div>`;
  $('build').innerHTML = h;
}
function toggleMap() {
  if (!G || G.title || (G.state !== 'play' && G.state !== 'map')) return;
  if (G.state === 'play') { G.state = 'map'; drawBigMap(); show('mapScreen'); }
  else { G.state = 'play'; hide('mapScreen'); }
}
function drawBigMap() {
  // landscape phones put the legend beside the map, so the map can use the full height
  const land = innerHeight <= 500 && innerWidth >= innerHeight * 4 / 3;
  const c = $('bigmap'), S = land ? Math.min(innerWidth - 300, innerHeight - 24) : Math.min(innerWidth, innerHeight - 90) * 0.9;
  c.width = S * DPR; c.height = S * DPR; c.style.width = S + 'px'; c.style.height = S + 'px';
  const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const span = World.kind === 'lab' ? LAB_N * LAB_T : WORLD, f = S / span, mk = World.mapImg.width / WORLD;
  g.imageSmoothingEnabled = World.kind !== 'lab';
  g.drawImage(World.mapImg, 0, 0, span * mk, span * mk, 0, 0, S, S);
  for (const fl of World.fields) { g.fillStyle = ANOMALIES[fl.type].color; g.globalAlpha = 0.6; g.beginPath(); g.arc(fl.x * f, fl.y * f, 5, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  for (const s of World.shelters) { g.fillStyle = '#5f5'; g.fillRect(s.x * f - 4, s.y * f - 4, 8, 8); g.strokeStyle = '#000'; g.strokeRect(s.x * f - 4, s.y * f - 4, 8, 8); }
  g.textAlign = 'center';
  if (World.kind === 'over') {
    g.font = 'bold 13px Oswald, sans-serif';
    const seen = new Set();
    for (const r of World.regions) { if (seen.has(r.name)) continue; seen.add(r.name); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(r.name.toUpperCase(), r.x * f + 1, r.y * f + 1); g.fillStyle = '#e8dcb0'; g.fillText(r.name.toUpperCase(), r.x * f, r.y * f); }
  }
  g.font = '11px Oswald, sans-serif';
  for (const l of World.labels) { g.fillStyle = '#c8c0a0'; g.fillText('• ' + l.name, l.x * f, l.y * f + 16); }
  g.font = '16px sans-serif';
  for (const h of World.hatches) g.fillText('🕳️', h.x * f, h.y * f + 5);
  for (const p of World.pois) g.fillText(p.state === 2 ? '✅' : p.icon, p.x * f, p.y * f + 5);
  g.font = '12px sans-serif';
  for (const l of World.lairs) if (!l.dead) g.fillText('☣️', l.x * f, l.y * f + 4);
  g.font = '16px sans-serif';
  for (const q of Quests.list) if (q.loc && World.kind === 'over') { g.fillStyle = '#ffcf3a'; g.font = 'bold 20px Oswald'; g.fillText('!', q.loc.x * f + 12, q.loc.y * f - 6); }
  g.font = '18px sans-serif';
  for (const b of G.bosses) g.fillText('💀', b.x * f, b.y * f + 6);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(P.x * f, P.y * f, 6, 0, TAU); g.fill(); g.strokeStyle = '#e33'; g.lineWidth = 3; g.stroke();
}

// ---------- menus ----------
let setupStage = null, setupChar = null, settingsBack = 'title';
function menuRubles() { for (const el of document.querySelectorAll('.rubles')) el.textContent = Save.data.rubles + ' ₽'; }
function openScreen(id) { for (const s of ['title', 'setup', 'bunker', 'settings']) hide(s); show(id); menuRubles(); if (id === 'title') titleContinue(); }
function buildSetup() {
  const S = Save.data;
  setupStage = setupStage || (S.stages.includes(S.stage) ? S.stage : 'zone');
  setupChar = setupChar || (S.chars.includes(S.char) ? S.char : 'rookie');
  const mode = S.mode || 'standard', dif = S.diff || 'rookie';
  $('diffList').innerHTML = DIFFICULTIES.map((d) => `<button class="pick ${dif === d.id ? 'sel' : ''}" data-diff="${d.id}"><div class="pi">${d.icon}</div><div><b>${d.name}</b><small>${d.desc}</small><em>enemy HP ×${d.hp} · damage taken ×${d.dmg}${d.rub !== 1 ? ' · rubles ×' + d.rub : ''}</em></div></button>`).join('');
  for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => { S.diff = b.dataset.diff; Save.save(); buildSetup(); };
  $('modeList').innerHTML = [['standard', '⏱️', 'Standard', '15 minutes, 6 bosses, then the final boss. Win to unlock the next stage.'], ['endless', '♾️', 'Endless', 'Bosses forever. Every 15 minutes the Zone grows a tier stronger. Play for hours.'], ['bossrush', '👑', 'Boss Rush', 'A new boss every minute. How many can you beat?'], ['daily', '📅', 'Daily Run', 'Today\'s seed: the same map and loot for everyone. Changes every day.']]
    .map(([id, ic, n, d]) => `<button class="pick ${mode === id ? 'sel' : ''}" data-mode="${id}"><div class="pi">${ic}</div><div><b>${n}</b><small>${d}</small>${S.best[(setupStage || 'zone') + (id === 'standard' ? '' : '_' + id)] ? `<em>best ${fmtTime(S.best[(setupStage || 'zone') + (id === 'standard' ? '' : '_' + id)])}</em>` : ''}</div></button>`).join('');
  for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { S.mode = b.dataset.mode; Save.save(); buildSetup(); };
  $('stageList').innerHTML = STAGES.map((st) => {
    const open = S.stages.includes(st.id), best = S.best[st.id];
    return `<button class="pick ${setupStage === st.id ? 'sel' : ''} ${open ? '' : 'locked'}" data-stage="${st.id}"><div class="pi">${open ? st.icon : '🔒'}</div><div><b>${st.name}</b><small>${open ? st.desc : 'Beat ' + STAGES.find((x) => x.id === st.needs).name + ' in Standard, or survive 15:00 there in Endless.'}</small>${open ? `<em>Enemy HP ×${st.hpMul}${best ? ' · best ' + fmtTime(best) : ''}</em>` : ''}</div></button>`;
  }).join('');
  S.spawn = S.spawn || {};
  const sps = STAGE_WORLD[setupStage].spawns, si = Math.min(S.spawn[setupStage] || 0, sps.length - 1);
  $('spawnList').innerHTML = sps.map((sp, i) => `<button class="pick ${si === i ? 'sel' : ''}" data-spawn="${i}"><div class="pi">${sp.icon}</div><div><b>${sp.name}</b><small>${sp.desc}</small></div></button>`).join('');
  for (const b of document.querySelectorAll('[data-spawn]')) b.onclick = () => { S.spawn[setupStage] = +b.dataset.spawn; Save.save(); buildSetup(); };
  $('charList').innerHTML = CHARACTERS.map((c) => {
    const own = S.chars.includes(c.id);
    return `<button class="pick ${setupChar === c.id ? 'sel' : ''} ${own ? '' : 'locked'}" data-char="${c.id}"><div class="pi">${c.icon}</div><div><b>${c.name}</b><small>${c.desc}</small><em>${WEAPONS[c.weapon].icon} ${WEAPONS[c.weapon].name}${own ? '' : ` · <span class="${S.rubles >= c.cost ? 'afford' : 'poor'}">BUY ${c.cost} ₽</span>`}</em></div></button>`;
  }).join('');
  for (const b of document.querySelectorAll('[data-stage]')) b.onclick = () => { if (S.stages.includes(b.dataset.stage)) { setupStage = b.dataset.stage; buildSetup(); } };
  for (const b of document.querySelectorAll('[data-char]')) b.onclick = () => {
    const c = CHARACTERS.find((x) => x.id === b.dataset.char);
    if (!S.chars.includes(c.id)) { if (S.rubles < c.cost) { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); return; } S.rubles -= c.cost; S.chars.push(c.id); Save.save(); Sfx.init(); Sfx.play('quest'); }
    setupChar = c.id; buildSetup(); menuRubles();
  };
}
function buildBunker() {
  const S = Save.data;
  $('metaList').innerHTML = META.map((m) => {
    const lv = Save.meta(m.id), max = lv >= m.max, cost = metaCost(m, lv);
    return `<div class="meta"><div class="pi">${m.icon}</div><div class="mi"><b>${m.name}</b><small>${m.desc}</small><div class="pips">${'<i class="on"></i>'.repeat(Math.min(lv, m.max))}${'<i></i>'.repeat(Math.max(0, m.max - lv))}</div></div><button data-meta="${m.id}" ${max || S.rubles < cost ? 'disabled' : ''}>${max ? 'MAX' : cost + ' ₽'}</button></div>`;
  }).join('');
  for (const b of document.querySelectorAll('[data-meta]')) b.onclick = () => {
    const m = META.find((x) => x.id === b.dataset.meta), lv = Save.meta(m.id), cost = metaCost(m, lv);
    if (lv >= m.max || S.rubles < cost) return;
    S.rubles -= cost; S.meta[m.id] = lv + 1; Save.save(); Sfx.init(); Sfx.play('quest'); buildBunker(); menuRubles();
  };
}
function buildSettings() {
  const s = Save.set;
  const slider = (k, label) => `<label class="set"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-set="${k}"></label>`;
  const tog = (k, label) => `<label class="set"><span>${label}</span><input type="checkbox" ${s[k] ? 'checked' : ''} data-tog="${k}"></label>`;
  $('settingsBody').innerHTML = slider('master', 'Master volume') + slider('music', 'Music / radio') + slider('sfx', 'Sound effects') + slider('amb', 'Ambience') + slider('voice', 'Radio chatter & UI') +
    `<label class="set"><span>Screen shake</span><input type="range" min="0" max="1" step="0.05" value="${shakeK()}" data-set="shake"></label>` + tog('mmArrows', 'Minimap arrows') + tog('omens', 'Zone omens (a random twist each run)') + tog('numbers', 'Damage numbers') + tog('hints', 'Tutorial hints') + tog('fps', 'Show FPS') +
    `<label class="set"><span>Game zoom</span><input type="range" min="0.7" max="2" step="0.05" value="${zoomK()}" data-set="zoom"></label>` +
    `<label class="set"><span>Graphics quality</span><select data-q><option value="auto" ${s.quality === 'auto' ? 'selected' : ''}>Auto (recommended)</option><option value="high" ${s.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Low (faster)</option><option value="min" ${s.quality === 'min' || s.quality === 'ultra' ? 'selected' : ''}>Lowest (phones, max FPS)</option><option value="potato" ${s.quality === 'potato' ? 'selected' : ''}>Potato (weakest phones)</option></select></label>` +
    `<button class="big ghost small" id="resetHints">Replay tutorial hints</button>`;
  for (const i of document.querySelectorAll('[data-set]')) i.oninput = () => { s[i.dataset.set] = +i.value; applySettings(); Save.save(); };
  for (const i of document.querySelectorAll('[data-tog]')) i.onchange = () => { s[i.dataset.tog] = i.checked; applySettings(); Save.save(); };
  document.querySelector('[data-q]').onchange = (e) => { s.quality = e.target.value; GFX.reset(); Save.save(); applyGfx(); };
  $('resetHints').onclick = () => { Save.data.hints = []; Save.save(); $('resetHints').textContent = 'Hints will show again ✓'; };
}
function applySettings() { const s = Save.set; Sfx.vol.master = s.master; Sfx.vol.music = s.music; Sfx.vol.sfx = s.sfx; Sfx.vol.amb = s.amb; Sfx.vol.voice = s.voice; Sfx.applyVol(); applyGfx(); if (typeof resize === 'function') resize(); }

// ---------- input ----------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { tryDash(); e.preventDefault(); }
  if (e.code === 'KeyQ') useAbility();
  if (G && !G.title && G.state === 'play') { const k = { Digit1: 'medkit', Digit2: 'energy', Digit3: 'vodka', Digit4: 'antirad', Digit5: 'scanner' }[e.code]; if (k) useItem(k); }
  if (e.code === 'KeyF') toggleVehicle();
  if (e.code === 'KeyT') throwBolt();
  if (e.code === 'KeyE' || e.code === 'Equal' || e.code === 'NumpadAdd') cycleActive(1);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') cycleActive(-1);
  if (e.code === 'KeyN') { Sfx.init(); FM.tune(1); }
  if (e.code === 'KeyB') { Sfx.init(); FM.tune(-1); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G && G.state === 'map') toggleMap(); else togglePause(); }
  if (e.code === 'KeyM' || e.code === 'Tab') { toggleMap(); e.preventDefault(); }
  if (G && G.state === 'levelup') { if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) chooseCard(+e.code.slice(5) - 1); if (e.code === 'KeyR') reroll(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G && G.state === 'play' && !G.title) togglePause(); });
const joy = { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 };
const knob = $('joyKnob'), jbase = $('joyBase');
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !G || G.title || G.state !== 'play') return;
  if (joy.active) { tryDash(); return; }
  joy.active = true; joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.dx = joy.dy = 0;
  jbase.style.display = 'block'; jbase.style.left = e.clientX + 'px'; jbase.style.top = e.clientY + 'px'; knob.style.transform = 'translate(-50%,-50%)';
});
addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.sx, dy = e.clientY - joy.sy; const l = Math.hypot(dx, dy), m = 50;
  if (l > m) { dx = (dx / l) * m; dy = (dy / l) * m; }
  joy.dx = dx / m; joy.dy = dy / m;
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
});
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; jbase.style.display = 'none'; } };
addEventListener('pointerup', endJoy); addEventListener('pointercancel', endJoy);
$('dashBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); tryDash(); });
$('vehBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleVehicle(); });
$('boltBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); throwBolt(); });
$('abilityBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); useAbility(); });
$('abUse').addEventListener('click', () => useAbility());
$('abPrev').addEventListener('click', () => cycleActive(-1));
$('abNext').addEventListener('click', () => cycleActive(1));
$('tPrev').addEventListener('pointerdown', (e) => { e.stopPropagation(); cycleActive(-1); });
$('tNext').addEventListener('pointerdown', (e) => { e.stopPropagation(); cycleActive(1); });
addEventListener('wheel', (e) => { if (G && !G.title && G.state === 'play') cycleActive(e.deltaY > 0 ? 1 : -1); }, { passive: true });
$('pauseBtn').addEventListener('click', () => togglePause());
$('mapBtn').addEventListener('click', () => toggleMap());
$('mapScreen').addEventListener('click', () => toggleMap());
$('muteBtn').addEventListener('click', () => { $('muteBtn').textContent = Sfx.toggle() ? '🔇' : '🔊'; });
let radioBack = null;
function openRadio() {
  Sfx.init(); radioBack = G && !G.title && G.state === 'play' ? 'game' : 'menu';
  if (radioBack === 'game') G.state = 'pause';
  buildStations(); radioUI(); show('radioPanel');
}
function closeRadio() { hide('radioPanel'); if (radioBack === 'game' && G && G.state === 'pause') G.state = 'play'; }
$('radioBtn').addEventListener('click', openRadio);
$('radioTitleBtn').addEventListener('click', openRadio);
$('radioClose').addEventListener('click', closeRadio);
$('radioPrev').addEventListener('click', () => FM.tune(-1));
$('radioNext').addEventListener('click', () => FM.tune(1));
$('radioSkip').addEventListener('click', () => FM.skip());
$('continueRunBtn').addEventListener('click', () => {
  Sfx.init(); applySettings();
  for (const s of ['title', 'setup', 'bunker', 'settings']) hide(s);
  $('loading').classList.add('show');
  setTimeout(() => {
    if (!RunSave.restore()) { $('loading').classList.remove('show'); openScreen('title'); return; }
    $('loading').classList.remove('show'); $('hud').classList.add('show');
    if (matchMedia('(pointer: coarse)').matches) $('touchUi').classList.add('show');
  }, 30);
});
function titleContinue() {
  diffTitle();
  const d = RunSave.peek(), b = $('continueRunBtn');
  if (d && d.g) { b.style.display = 'inline-block'; b.textContent = `▶ CONTINUE RUN · ${(STAGES.find((s) => s.id === d.g.stage) || STAGES[0]).name} ${fmtTime(d.g.t)} · LV ${d.g.level}`; }
  else b.style.display = 'none';
}
$('resumeBtn').addEventListener('click', () => togglePause());
$('pauseSettings').addEventListener('click', () => { settingsBack = 'pause'; hide('pause'); buildSettings(); show('settings'); });
$('abandonBtn').addEventListener('click', () => endRun('quit'));
$('againBtn').addEventListener('click', () => startGame());
$('continueBtn').addEventListener('click', () => continueEndless());
$('menuBtn').addEventListener('click', () => toMenu());
$('rerollBtn').addEventListener('click', () => reroll());
$('playBtn').addEventListener('click', () => { Sfx.init(); buildSetup(); openScreen('setup'); });
function diffTitle() { const d = diffDef(Save.data.diff || 'rookie'); $('diffTitleBtn').textContent = 'Difficulty: ' + d.icon + ' ' + d.name + '  ▸ change'; }
$('diffTitleBtn').addEventListener('click', () => { Sfx.init(); const i = DIFFICULTIES.findIndex((d) => d.id === (Save.data.diff || 'rookie')); Save.data.diff = DIFFICULTIES[(i + 1) % DIFFICULTIES.length].id; Save.save(); diffTitle(); });
$('bunkerBtn').addEventListener('click', () => { Sfx.init(); buildBunker(); openScreen('bunker'); });
$('settingsBtn').addEventListener('click', () => { Sfx.init(); settingsBack = 'title'; buildSettings(); openScreen('settings'); });
for (const b of document.querySelectorAll('.back')) b.addEventListener('click', () => {
  if (b.closest('#settings') && settingsBack === 'pause') { hide('settings'); buildPause(); show('pause'); return; }
  openScreen('title');
});
$('startBtn').addEventListener('click', () => startGame());
addEventListener('pagehide', () => { if (G && !G.title) RunSave.save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.state === 'play' && !G.title) togglePause(); });

function startGame() {
  Sfx.init(); applySettings();
  const S = Save.data;
  S.stage = setupStage || S.stage; S.char = setupChar || S.char; Save.save();
  for (const s of ['title', 'setup', 'bunker', 'settings', 'over', 'pause', 'levelup']) hide(s);
  $('loading').classList.add('show');
  setTimeout(() => {
    const daily = S.mode === 'daily', d = new Date(), ds = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    newGame(S.stage, S.char, daily ? 'standard' : S.mode || 'standard', (S.spawn || {})[S.stage] || 0, daily ? ds * 31 + hashStr(S.stage) % 1000 : undefined);
    if (daily) { G.daily = ds; banner('📅 DAILY RUN ' + ds, 'Same seed for everyone today.', 3, 'good'); }
    $('loading').classList.remove('show');
    $('hud').classList.add('show');
    if (matchMedia('(pointer: coarse)').matches) $('touchUi').classList.add('show');
  }, 30);
}
function toMenu() {
  hide('over'); hide('pause'); hide('mapScreen'); $('hud').classList.remove('show'); $('touchUi').classList.remove('show');
  G = null; P = null; World.genStage('zone', 20260926); titleCam.x = 3200; titleCam.y = 4200;
  openScreen('title');
}

// ---------- loop ----------
let last = performance.now(), titleAcc = 0;
// the world drawn behind menus: hidden completely by the opaque bunker (skip it), dimmed and blurred by the other menus (20 FPS is plenty)
const DIM_MENUS = ['setup', 'settings', 'runs', 'profiles', 'coop', 'crewHQ', 'radioPanel'];
function menuBg() {
  const bk = $('bunker');
  if (bk && bk.classList.contains('show') && bk.classList.contains('cyber')) return 2;
  for (const id of DIM_MENUS) { const el = $(id); if (el && el.classList.contains('show')) return 1; }
  return 0;
}
function frame(now) {
  const ms = now - last, dt = Math.min(0.05, ms / 1000); last = now;
  NOW += dt;
  requestAnimationFrame(frame);
  GFX.sample(ms);
  try {
    if (G && !G.title) { FRAME_MS = ms; const t0 = performance.now(); update(dt); render(); hud(dt); JS_MS = JS_MS * 0.9 + (performance.now() - t0) * 0.1; }
    else {
      const bg = menuBg();
      if (bg === 2 || (bg === 1 && minGfx())) titleAcc = 0;
      else if (bg === 1 || lowGfx()) { titleAcc += dt; if (titleAcc >= (bg === 1 ? 1 / 20 : minGfx() ? 1 / 15 : 1 / 30)) { renderTitle(Math.min(0.1, titleAcc)); titleAcc = 0; } }
      else renderTitle(dt);
    }
  }
  catch (e) { if (typeof guardReport === 'function') guardReport('frame', e); else console.error(e); }
}
const titleCam = { x: 3200, y: 4200 };
const TITLE_G = { title: true, t: 30, decals: [], particles: [], texts: [], fx: [], bullets: [], ebullets: [], throws: [], gems: [], enemies: [], crates: [], pickups: [], bosses: [], shake: 0, flash: 0, psi: 0, fade: 0, em: null, rad: 0 };
const TITLE_P = { x: -9999, y: -9999, hp: 1, maxhp: 1, aura: 0, shards: 0, r: 1, z: 0, detect: 1 };
function renderTitle(dt) {
  titleCam.x += dt * 30; titleCam.y -= dt * 12;
  if (titleCam.x > 5600) titleCam.x = 1000;
  if (titleCam.y < 800) titleCam.y = 5000;
  CAM.x = titleCam.x; CAM.y = titleCam.y;
  G = TITLE_G; P = TITLE_P;
  try { render(true); } finally { G = null; P = null; }
}

// ---------- boot ----------
Save.load(); applySettings(); buildArtIcons(); FM.init(); titleContinue(); radioUI();
resize();
EG.init();
World.genStage('zone', 20260926);
menuRubles();
if (Save.data.runs) $('titleStats').textContent = `${Save.data.runs} runs · ${Save.data.wins} victories · best ${fmtTime(Math.max(0, ...Object.values(Save.data.best)))}`;
requestAnimationFrame(frame);
