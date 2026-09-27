'use strict';
// ---------- variety pack 2: dash styles, focus fire, mouse aim, interrupts, executions, hold fire, auto-medkit,
// game speed, flash intensity, boss-bargain default, four new weapons and four playstyle perks ----------
const tr2 = (s) => (typeof I18n !== 'undefined' && I18n.cur !== 'en' ? I18n.tc(s) : s);

// ===== dash styles =====
const DASH_STYLES = [['dash', '💨 Standard dash'], ['roll', '🤸 Evasive roll'], ['long', '🏹 Long dash'], ['double', '⚡ Two charges'], ['charge', '🛡️ Armored charge']];
{
  const _td = tryDash;
  tryDash = function () {
    if (!G || G.state !== 'play') return;
    const st = Save.set.dashStyle || 'dash';
    if (st === 'double') { // two charges; one recharges at a time, a little slower than a normal dash
      if (P.dch === undefined) P.dch = 2;
      if (P.dch <= 0 || P.dashT > 0) return;
      const cd = P.dashCd; P.dashCd = 0; _td(); P.dch--;
      P.dashCd = cd > 0 ? cd : 1.4 * P.dashMul * 1.35; return;
    }
    if (P.dashCd > 0) return;
    _td();
    if (st === 'roll') { P.dashVx *= 0.7; P.dashVy *= 0.7; P.dashT = 0.16; P.inv = Math.max(P.inv, 0.5); P.dashCd *= 0.85; }
    else if (st === 'long') { P.dashT = 0.3; P.dashCd *= 1.6; }
    else if (st === 'charge') { P.dashVx *= 0.85; P.dashVy *= 0.85; P.dashT = 0.26; P.dashCd *= 1.5; P.charging = 1; }
  };
}

// ===== focus fire (click a mutant on desktop) and mouse aiming =====
const MOUSE = { x: 0, y: 0, on: false };
addEventListener('mousemove', (e) => { MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.on = true; });
const toWorld = (sx, sy) => [(sx - VW / 2) / ZOOM + CAM.x, (sy - VH / 2) / ZOOM + CAM.y];
cv.addEventListener('mousedown', (e) => {
  if (!G || G.title || G.state !== 'play' || e.button !== 0) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY); let best = null, bd = 70 * 70;
  for (const o of G.enemies) { if (o.dead) continue; const d = dist2(wx, wy, o.x, o.y - (o.z || 0) - o.r); if (d < bd) { bd = d; best = o; } }
  if (best) { G.focus = best; G.focusT = 12; Sfx.play('beep'); text(best.x, best.y - best.z - 50, tr2('FOCUS'), '#ff6a4a', false, true); }
});
if (typeof AIM_MODES !== 'undefined' && !IS_PHONE) AIM_MODES.push(['mouse', '🖱️ Mouse direction']);
{
  const _n = nearest;
  nearest = function (x, y, range, skip) {
    if (G && x === P.x && y === P.y) {
      const f = G.focus; // a focused mutant wins whenever it is in range
      if (f && !f.dead && G.focusT > 0 && !(skip && skip.includes(f)) && dist2(x, y, f.x, f.y) < range * range) return f;
      if (Save.set.aim === 'mouse' && MOUSE.on) {
        const [wx, wy] = toWorld(MOUSE.x, MOUSE.y), am = Math.atan2(wy - y, wx - x); let best = null, bs = 1e9;
        for (const e of G.enemies) {
          if (e.dead || e.hidden || (skip && skip.includes(e))) continue;
          const d2 = dist2(x, y, e.x, e.y); if (d2 > range * range) continue;
          let da = Math.abs(Math.atan2(e.y - y, e.x - x) - am); if (da > Math.PI) da = TAU - da;
          const sc = da * 400 + Math.sqrt(d2) * 0.2; if (sc < bs) { bs = sc; best = e; }
        }
        if (best) return best;
      }
    }
    return _n(x, y, range, skip);
  };
}

// ===== interrupts, executions and charge hits =====
{
  const _he = hurtEnemy;
  hurtEnemy = function (e, dmg, kx, ky, raw, proc) {
    if (e && !e.dead && !e.boss && e.state === 1 && e.st > 0 && e.st <= 1 && dmg >= e.maxhp * 0.08) {
      e.state = 0; e.st = 0; e.cd = Math.max(e.cd || 0, 1.5); e.stun = Math.max(e.stun || 0, 0.6);
      text(e.x, e.y - e.z - 46, tr2('INTERRUPTED!'), '#9fe8ff', false, true);
    }
    return _he.apply(this, arguments);
  };
}
function f2DashTick() {
  if (!(P.dashT > 0)) { P.charging = 0; return; }
  EG.query(P.x, P.y, 60, TMP3);
  for (const e of TMP3) {
    if (e.dead || (P.dashHit || []).includes(e) || dist2(e.x, e.y, P.x, P.y) > (e.r + 26) ** 2) continue;
    if (e.stgT > 0 && !e.boss) { (P.dashHit = P.dashHit || []).push(e); hurtEnemy(e, e.maxhp * 0.25, P.dashVx * 0.3, P.dashVy * 0.3, true); text(e.x, e.y - e.z - 60, tr2('EXECUTE!'), '#ff4a3a', true, true); Sfx.play('break'); continue; }
    if (P.charging || P.slam) { (P.dashHit = P.dashHit || []).push(e); hurtEnemy(e, 20 + G.level * 2 + (P.slam || 0), P.dashVx * 0.6, P.dashVy * 0.6); }
  }
}

// ===== hold fire, auto-medkit, game speed, flash intensity =====
{
  const _uw = updateWeapons;
  updateWeapons = function (dt) { if (G && G.holdFire) { for (const w of P.weapons) w.cd = Math.max(w.cd || 0, 0.05); return; } return _uw.apply(this, arguments); };
  const _fl = flash;
  flash = function (v, c) { const k = Save.set.flashK === undefined ? 1 : +Save.set.flashK; return _fl(v * k, c); };
}
function toggleHoldFire() {
  if (!G || G.title) return; G.holdFire = !G.holdFire;
  const b = $('holdBtn'); if (b) b.classList.toggle('on', G.holdFire);
  text(P.x, P.y - 70, G.holdFire ? tr2('HOLD FIRE') : tr2('WEAPONS FREE'), G.holdFire ? '#9fe8ff' : '#ffcf6a', true, true);
}
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && G && !G.title && G.state === 'play') toggleHoldFire(); });

// ===== boss bargains: a default choice (ask, fight, challenge or bribe) =====
{
  const _snb = spawnNextBoss;
  spawnNextBoss = function () {
    const mode = Save.set.bargain || 'none';
    if (mode === 'ask' || !G || G.coop || G.coGuest) return _snb.apply(this, arguments);
    // pick the default without showing the question
    const st = G.state; const r = _snb.apply(this, arguments);
    const m = $('bargain');
    if (G.state === 'bargain' && m) {
      let k = mode === 'bribe' ? 'bribe' : mode === 'chal' ? 'chal' : 'none';
      const btn = m.querySelector(`[data-bg="${k}"]`);
      if (k === 'bribe' && btn && btn.classList.contains('cant')) k = 'none';
      m.querySelector(`[data-bg="${k}"]`).click();
    }
    return r;
  };
}

// ===== four new weapons =====
Object.assign(WEAPONS, {
  fence: { name: 'Electrode Fence', icon: '⚡', max: 6, tag: 'electric', desc: 'Plants two posts with a lightning fence between them that shocks every mutant crossing it.',
    ups: ['', '+Damage', 'Longer fence', 'Two fences', '+Duration', 'Chain shock'], stats: (l) => ({ dmg: 9 + l * 4, cd: 4.2 - l * 0.25, len: 170 + (l >= 3 ? 50 : 0), life: 5 + (l >= 5 ? 2 : 0), count: l >= 4 ? 2 : 1 }) },
  stasis: { name: 'Stasis Mine', icon: '🧊', max: 6, tag: null, desc: 'Drops a mine that freezes every mutant around it. Heavy hits shatter frozen mutants.',
    ups: ['', '+Radius', '+Freeze time', 'Drop 2', '+Radius', 'Drop 3'], stats: (l) => ({ dmg: 10 + l * 4, cd: 5 - l * 0.3, radius: 90 + l * 12, freeze: 1.6 + l * 0.2, count: l >= 6 ? 3 : l >= 4 ? 2 : 1 }) },
  rivet: { name: 'Rivet Gun', icon: '🔩', max: 6, tag: null, desc: 'Fast rivets stick in mutants. Every sixth shot detonates every rivet at once.',
    ups: ['', '+Fire rate', '+Blast per rivet', 'Detonate every 5th', '+Damage', 'Bigger blasts'], stats: (l) => ({ dmg: 6 + l * 2, cd: 0.32 - l * 0.02, det: 7 + l * 3, every: l >= 4 ? 5 : 6, r: l >= 6 ? 70 : 45 }) },
  welder: { name: 'Welding Cutter', icon: '🔥', max: 6, tag: 'fire', desc: 'A short cutting beam that grows hotter the longer it stays on one mutant.',
    ups: ['', '+Damage', '+Range', 'Hotter faster', '+Damage', 'Melts armor'], stats: (l) => ({ dmg: 14 + l * 5, cd: 0.1, range: 180 + (l >= 3 ? 50 : 0), ramp: l >= 4 ? 1.1 : 0.7 }) },
});
{
  const _fw2 = fireWeapon2;
  fireWeapon2 = function (w, s, bm) {
    const F = G.f2 || (G.f2 = { fences: [], mines: [], riv: new Set() });
    switch (w.id) {
      case 'fence': {
        const t = nearest(P.x, P.y, 420); const a0 = t ? Math.atan2(t.y - P.y, t.x - P.x) : rand(TAU);
        for (let i = 0; i < s.count; i++) {
          const a = a0 + (i ? Math.PI / 2 : 0), mx = t && !i ? (P.x + t.x) / 2 : P.x + Math.cos(a) * 90, my = t && !i ? (P.y + t.y) / 2 : P.y + Math.sin(a) * 90, p = a + Math.PI / 2, L = s.len * P.areaMul / 2;
          F.fences.push({ x1: mx + Math.cos(p) * L, y1: my + Math.sin(p) * L, x2: mx - Math.cos(p) * L, y2: my - Math.sin(p) * L, t: s.life, tick: 0, dmg: s.dmg * bm, chain: w.lv >= 6 });
        }
        Sfx.play('zap'); return true;
      }
      case 'stasis': {
        for (let i = 0; i < s.count; i++) { const a = rand(TAU), d = i ? rand(60, 140) : 0; F.mines.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, arm: 0.6, r: s.radius * P.areaMul, fr: s.freeze, dmg: s.dmg * bm, t: 25 }); }
        Sfx.play('throw'); return true;
      }
      case 'rivet': {
        const t = nearest(P.x, P.y, 520); if (!t) return false;
        const gx = P.x, gy = P.y - 22, a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx);
        shoot(gx, gy, a + rand(-0.05, 0.05), 900, s.dmg * bm, { r: 3, k: 'rivet' });
        G.bullets[G.bullets.length - 1].hitFn = (e, b) => { e.rivets = (e.rivets || 0) + 1; F.riv.add(e); b.dead = true; };
        w.shots = (w.shots || 0) + 1;
        if (w.shots % s.every === 0) {
          let n = 0;
          for (const e of F.riv) { if (e.dead || !e.rivets) continue; n++; const k = e.rivets; e.rivets = 0; hurtEnemy(e, s.det * k * bm, 0, 0); if (!ultraGfx()) burst(e.x, e.y - 20, 6, '255,190,90', 140); if (k >= 3) explode(e.x, e.y, s.r, s.det * bm * 0.5, true); }
          F.riv.clear(); if (n) Sfx.play('boom');
        }
        Sfx.play('pistol'); return true;
      }
      case 'welder': {
        let t = w.tgt; if (!t || t.dead || dist(P.x, P.y, t.x, t.y) > s.range) { t = nearest(P.x, P.y, s.range); w.heat = 0; w.tgt = t; }
        if (!t) { w.beam = null; return false; }
        w.heat = Math.min(3, (w.heat || 0) + s.ramp * 0.1);
        hurtEnemy(t, s.dmg * bm * 0.1 * (1 + w.heat), 0, 0);
        if (w.lv >= 6 && t.shield > 0) t.shield = 0;
        w.beam = { x: t.x, y: t.y - t.z - 16, heat: w.heat, T: NOW }; return true;
      }
    }
    return _fw2.apply(this, arguments);
  };
}
function f2WeaponTick(dt) {
  const F = G.f2; if (!F) return;
  for (const f of F.fences) {
    f.t -= dt; f.tick -= dt; if (f.tick > 0) continue; f.tick = 0.25;
    const dx = f.x2 - f.x1, dy = f.y2 - f.y1, L2 = dx * dx + dy * dy || 1;
    EG.query((f.x1 + f.x2) / 2, (f.y1 + f.y2) / 2, Math.sqrt(L2) / 2 + 30, TMP2);
    for (const e of TMP2) {
      if (e.dead) continue;
      const k = clamp(((e.x - f.x1) * dx + (e.y - f.y1) * dy) / L2, 0, 1), px = f.x1 + dx * k, py = f.y1 + dy * k;
      if (dist2(e.x, e.y, px, py) < (e.r + 12) ** 2) { hurtEnemy(e, f.dmg, 0, 0); if (f.chain) e.stun = Math.max(e.stun || 0, 0.25); }
    }
  }
  F.fences = F.fences.filter((f) => f.t > 0);
  for (const m of F.mines) {
    m.t -= dt; m.arm -= dt; if (m.arm > 0 || m.done) continue;
    EG.query(m.x, m.y, 60, TMP2);
    if (TMP2.some((e) => !e.dead && dist2(e.x, e.y, m.x, m.y) < 55 * 55)) {
      m.done = true; EG.query(m.x, m.y, m.r, TMP2);
      for (const e of TMP2) if (!e.dead && dist2(e.x, e.y, m.x, m.y) < m.r * m.r) { e.frozen = 1; e.stun = Math.max(e.stun || 0, e.boss ? 0.6 : m.fr); hurtEnemy(e, m.dmg, 0, 0); }
      G.fx.push({ k: 'ring', x: m.x, y: m.y, r: m.r, life: 0.5, max: 0.5, c: '160,230,255' }); Sfx.play('freeze');
    }
  }
  F.mines = F.mines.filter((m) => !m.done && m.t > 0);
}
function f2Draw() {
  const F = G.f2;
  if (F) {
    for (const f of F.fences) {
      ctx.fillStyle = '#6a7a8a'; ctx.fillRect(f.x1 - 3, f.y1 - 26, 6, 26); ctx.fillRect(f.x2 - 3, f.y2 - 26, 6, 26);
      ctx.strokeStyle = `rgba(150,220,255,${0.55 + Math.sin(NOW * 30) * 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x1, f.y1 - 18);
      const n = 6; for (let i = 1; i < n; i++) ctx.lineTo(lerp(f.x1, f.x2, i / n) + rand(-5, 5), lerp(f.y1, f.y2, i / n) - 18 + rand(-6, 6));
      ctx.lineTo(f.x2, f.y2 - 18); ctx.stroke();
    }
    for (const m of F.mines) { ctx.fillStyle = m.arm > 0 ? '#8aa0b0' : `rgba(150,230,255,${0.7 + Math.sin(NOW * 8) * 0.3})`; ctx.beginPath(); ctx.moveTo(m.x, m.y - 8); ctx.lineTo(m.x + 7, m.y); ctx.lineTo(m.x, m.y + 8); ctx.lineTo(m.x - 7, m.y); ctx.fill(); }
  }
  for (const w of P.weapons) if (w.id === 'welder' && w.beam && NOW - w.beam.T < 0.15) {
    const b = w.beam, h = b.heat / 3;
    ctx.strokeStyle = `rgb(255,${Math.round(220 - h * 140)},${Math.round(120 - h * 100)})`; ctx.lineWidth = 3 + h * 4; ctx.beginPath(); ctx.moveTo(P.x, P.y - 24); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  if (G.focus && !G.focus.dead && G.focusT > 0) { const e = G.focus; ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.8, e.r * 0.8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
}

// ===== four playstyle perks =====
Object.assign(PERKS, {
  evasion: { name: 'Evasion Training', icon: '🤸', max: 3, desc: (m) => `Perfect dodges heal ${Math.round(4 * m)} HP and last longer`, apply: (P, m) => { P.pdHeal = (P.pdHeal || 0) + 4 * m; P.pdLong = (P.pdLong || 0) + 0.5; } },
  slam: { name: 'Charge Plating', icon: '🦬', max: 3, desc: (m) => `Your dash rams mutants for ${Math.round(18 * m)} damage`, apply: (P, m) => { P.slam = (P.slam || 0) + 18 * m; } },
  cryo: { name: 'Cryo Expert', icon: '❄️', max: 3, desc: (m) => `Shattering frozen mutants deals +${Math.round(40 * m)}% more`, apply: (P, m) => { P.shatterMul = (P.shatterMul || 0) + 0.4 * m; } },
  heavy: { name: 'Heavy Hitter', icon: '🔨', max: 3, desc: (m) => `Stagger meters fill ${Math.round(30 * m)}% faster`, apply: (P, m) => { P.stgMul = (P.stgMul || 0) + 0.3 * m; } },
});
{
  const _he = hurtEnemy;
  hurtEnemy = function (e, dmg, kx, ky, raw, proc) {
    if (!e || e.dead) return _he.apply(this, arguments);
    let m = 1;
    if (P.shatterMul && e.frozen && e.stun > 0) m += P.shatterMul;
    if (P.stgMul && (e.boss || e.mini || e.affix)) e.stg = (e.stg || 0) + (dmg / (e.maxhp * (e.boss ? 0.12 : 0.22))) * P.stgMul;
    return _he.call(this, e, dmg * m, kx, ky, raw, proc);
  };
  const _hp = hurtPlayer;
  hurtPlayer = function (d, src, ignoreInv, kind) {
    const pd0 = P.pdT || 0, r = _hp.apply(this, arguments);
    if ((P.pdT || 0) > pd0 && P.pdHeal) { P.hp = Math.min(P.maxhp, P.hp + P.pdHeal); P.pdT += P.pdLong || 0; }
    return r;
  };
}

// ===== per-frame tick and world drawing =====
{
  const _up = update;
  update = function (dt) {
    const sp = G && !G.title && !G.coop && !G.coGuest ? clamp(+(Save.set.gameSpeed || 1), 0.5, 1) : 1;
    _up(dt * sp);
    if (!G || G.title || G.state !== 'play') return;
    f2DashTick(); f2WeaponTick(dt * sp);
    if (G.focusT > 0) G.focusT -= dt;
    if ((Save.set.dashStyle || 'dash') === 'double') { if (P.dch === undefined) P.dch = 2; if (P.dashCd <= 0 && P.dch < 2) { P.dch++; if (P.dch < 2) P.dashCd = 1.4 * P.dashMul * 1.35; } }
    if (Save.set.autoMed && P.hp > 0 && P.hp < P.maxhp * 0.25 && P.items && P.items.medkit > 0 && !(G.amT > 0)) { useItem('medkit'); G.amT = 1.5; }
    if (G.amT > 0) G.amT -= dt;
  };
  const _top = drawW2Top;
  drawW2Top = function (x0, y0, x1, y1) { _top(x0, y0, x1, y1); if (G && !G.title) f2Draw(); };
}

// ===== settings: dash style, bargain default, auto-medkit, game speed, flash intensity; hold-fire button =====
addEventListener('DOMContentLoaded', () => {
  const _bs = buildSettings;
  buildSettings = function () {
    _bs();
    const s = Save.set, body = $('settingsBody');
    const sel = (key, label, opts, def) => { const el = document.createElement('label'); el.className = 'set'; el.innerHTML = `<span>${tr2(label)}</span><select>${opts.map(([k, n]) => `<option value="${k}" ${(s[key] || def) === k ? 'selected' : ''}>${tr2(n)}</option>`).join('')}</select>`; el.querySelector('select').onchange = (e) => { s[key] = e.target.value; Save.save(); }; return el; };
    const rng = (key, label, min, max, def) => { const el = document.createElement('label'); el.className = 'set'; el.innerHTML = `<span>${tr2(label)}</span><input type="range" min="${min}" max="${max}" step="0.05" value="${s[key] === undefined ? def : s[key]}">`; el.querySelector('input').oninput = (e) => { s[key] = +e.target.value; Save.save(); }; return el; };
    const tog = (key, label) => { const el = document.createElement('label'); el.className = 'set'; el.innerHTML = `<span>${tr2(label)}</span><input type="checkbox" ${s[key] ? 'checked' : ''}>`; el.querySelector('input').onchange = (e) => { s[key] = e.target.checked; Save.save(); }; return el; };
    const anchor = body.children[2] || null;
    for (const el of [sel('dashStyle', 'Dash style', DASH_STYLES, 'dash'),
      sel('bargain', 'Boss bargains', [['none', '⚔ Always fight as is'], ['chal', '🔥 Always take the challenge'], ['bribe', '💰 Always bribe (if affordable)'], ['ask', '❓ Ask every time']], 'none'),
      tog('autoMed', 'Auto-use medkit below 25% HP'), rng('gameSpeed', 'Game speed (single player)', 0.5, 1, 1), rng('flashK', 'Flash intensity', 0, 1, 1)]) body.insertBefore(el, anchor);
  };
  const tu = $('touchUi');
  if (tu) { const b = document.createElement('button'); b.id = 'holdBtn'; b.className = 'tbtn'; b.textContent = '🤫'; b.title = 'Hold fire (H)'; b.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleHoldFire(); }); tu.appendChild(b); }
});
