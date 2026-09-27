'use strict';
// ---------- polish: objective arrow, see-through fades, night brightness, warning sounds, doors,
// ---------- research tree, longer tutorial with skip, bug report, radiation bar ----------

// ----- see-through: trees and roofs fade more, over a wider area around you -----
occludes = function (x0, y0, x1, y1) { return P && P.x > x0 - 55 && P.x < x1 + 55 && P.y > y0 - 60 && P.y < y1; };
// ----- night brightness (lighter by default) -----
const _poDark = Env.darkness.bind(Env);
Env.darkness = function () { const k = Save.set.nightDark === undefined ? 0.7 : +Save.set.nightDark; return _poDark() * k; };

// ----- radiation dose: builds up in hot spots and radiation storms, antirad clears it -----
const PO = { beatT: 0, emBeep: -1, doorT: 0 };
function poUpdate(dt) {
  if (!G || G.title || G.state !== 'play') return;
  const storm = Env.weather === 'radstorm' && World.kind === 'over' && !inShelter(P.x, P.y);
  const inRad = (G.rad || 0) + (storm ? 0.35 : 0);
  if (P.antiradT > 0) P.dose = Math.max(0, (P.dose || 0) - 40 * dt);
  else if (inRad > 0) P.dose = Math.min(100, (P.dose || 0) + inRad * 14 * dt);
  else P.dose = Math.max(0, (P.dose || 0) - 2.5 * dt);
  if (P.dose >= 100 && Math.random() < dt * 0.8) hurtPlayer(4, 'radiation sickness', true, 'rad');
  P.doseSlow = P.dose > 60;
  const fill = $('radFill'); if (fill) { fill.style.width = P.dose + '%'; fill.style.background = P.dose > 75 ? '#ff4a3a' : P.dose > 45 ? '#ffa030' : '#d8e040'; $('radBar').classList.toggle('on', P.dose > 1); }
  // warning sounds: heartbeat at low HP, countdown beeps before an emission
  if (P.hp > 0 && P.hp < P.maxhp * 0.25 && !(P.ghost > 0)) { PO.beatT -= dt; if (PO.beatT <= 0) { PO.beatT = 0.85; if (Sfx.ctx) { Sfx.tone(62, 0.12, 'sine', 0.35, -10, 0, Sfx.sfx); Sfx.tone(58, 0.12, 'sine', 0.25, -10, 0.18, Sfx.sfx); } } }
  if (G.em && G.em.phase === 'warn') { const s = Math.ceil(G.em.t); if ([10, 5, 3, 2, 1].includes(s) && s !== PO.emBeep) { PO.emBeep = s; if (Sfx.ctx) Sfx.tone(s <= 3 ? 1320 : 880, 0.14, 'square', 0.06, 0, 0, Sfx.voice); } }
}
// radiation slows healing
const _poRegenUpd = updatePlayer;
updatePlayer = function (dt) { const r = P.regen; if (P.doseSlow) P.regen = r * 0.5; try { _poRegenUpd(dt); } finally { P.regen = r; } poUpdate(dt); };

// ----- main objective: one gold arrow for the next main-quest step -----
function poObjective() { if (minGfx()) { const c = poObjective.c; if (c && NOW - c.t < 0.25) return c.v; const v = poObjective0(); poObjective.c = { t: NOW, v }; return v; } return poObjective0(); }
function poObjective0() {
  if (!G || G.title || G.tutorial || !Story.main) return null;
  const i = Story.main.i, W = World, over = W.kind === 'over';
  const near = (list) => { let b = null, bd = 1e18; for (const o of list) { const d = dist2(o.x, o.y, P.x, P.y); if (d < bd) { bd = d; b = o; } } return b; };
  if (G.bosses.length) return { o: near(G.bosses), ic: '💀' };
  if (!over) return null;
  if (i === 0) { const a = nearestArtifact(); return a ? { o: a.a, ic: '💎' } : null; }
  if (i === 1) return { o: near([...W.wtowers.filter((t) => !t.used), ...W.rtowers.filter((t) => !t.on)]), ic: '🗼' };
  if (i === 2) return { o: near(W.pois.filter((p) => p.state < 2)), ic: '⚑' };
  if (i === 3) return { o: near(W.hatches.filter((h) => !h.exit)), ic: '🕳️' };
  return null;
}
function drawObjective(cx, cy) {
  if (Save.set.objArrow === false) return;
  const ob = poObjective(); if (!ob || !ob.o) return;
  const sx = (ob.o.x - cx) * ZOOM + VW / 2, sy = (ob.o.y - cy) * ZOOM + VH / 2, m = 46, d = Math.round(dist(ob.o.x, ob.o.y, P.x, P.y) / 10);
  const pulse = 1 + Math.sin(NOW * 5) * 0.12, label = ob.ic + ' ' + d + 'm';
  const pill = (x, y) => { ctx.font = 'bold 14px Oswald, sans-serif'; const w = ctx.measureText(label).width + 16; ctx.fillStyle = 'rgba(20,16,4,0.8)'; ctx.fillRect(x - w / 2, y - 13, w, 20); ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - 13, w, 20); ctx.fillStyle = '#ffe8a0'; ctx.fillText(label, x, y + 2); };
  ctx.save(); ctx.textAlign = 'center';
  if (sx > m && sx < VW - m && sy > m + 60 && sy < VH - m) {
    const bob = Math.sin(NOW * 4) * 6, y = sy - 48 + bob;
    ctx.shadowColor = 'rgba(255,207,58,0.8)'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx, y + 18 * pulse); ctx.lineTo(sx - 16 * pulse, y - 8); ctx.lineTo(sx + 16 * pulse, y - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; pill(sx, y - 22);
  } else {
    // ride an ellipse inside the screen so the arrow never hides behind the HUD corners
    const a = Math.atan2(sy - VH / 2, sx - VW / 2), rx = Math.max(90, VW / 2 - 190), ry = Math.max(80, VH / 2 - 140), ex = VW / 2 + Math.cos(a) * rx, ey = VH / 2 + Math.sin(a) * ry;
    ctx.translate(ex, ey); ctx.rotate(a); ctx.scale(1.5 * pulse, 1.5 * pulse);
    ctx.shadowColor = 'rgba(255,207,58,0.9)'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-10, -15); ctx.lineTo(-3, 0); ctx.lineTo(-10, 15); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.shadowBlur = 0; pill(ex - Math.cos(a) * 58, ey - Math.sin(a) * 50);
  }
  ctx.restore();
}
const _poScreen = drawW2Screen;
drawW2Screen = function (cx, cy, title) { _poScreen(cx, cy, title); if (!title) drawObjective(cx, cy); };

// ----- enterable houses: a doorway glow and 🚪 marker when you are nearby -----
const _poTop = drawW2Top;
drawW2Top = function (x0, y0, x1, y1) {
  _poTop(x0, y0, x1, y1);
  if (World.kind !== 'over') return;
  ctx.textAlign = 'center';
  for (const b of World.openB || []) {
    const dx = b.x + b.w / 2, dy = b.y + b.h + 6;
    if (dx < x0 || dx > x1 || dy < y0 || dy > y1 + 40 || dist2(dx, dy, P.x, P.y) > 650 * 650) continue;
    if (P.x > b.x && P.x < b.x + b.w && P.y > b.y && P.y < b.y + b.h) continue;
    ctx.fillStyle = `rgba(255,210,120,${0.25 + Math.sin(NOW * 3 + b.x) * 0.1})`; ctx.beginPath(); ctx.ellipse(dx, dy + 6, 30, 10, 0, 0, TAU); ctx.fill();
    ctx.font = '16px sans-serif'; ctx.fillText('🚪', dx, dy + 30 + Math.sin(NOW * 3) * 2);
  }
};

// ----- longer tutorial: vehicles and the map, plus a skip button -----
TUT_STEPS.splice(TUT_STEPS.length - 1, 0,
  ['Stand still next to the bike: the circle fills and you hop on. Dash (SPACE) to jump off.', () => !!P.veh || Tutorial.rode, () => { World.vehicles.push({ kind: 'bike', x: P.x + 120, y: P.y + 30, a: 0, fuel: 100 }); P.vehSkip = null; }],
  ['Open the map with M (or the 🗺 button), then close it.', () => Tutorial.mapped],
);
const _poTutNext = Tutorial.next.bind(Tutorial);
Tutorial.next = function () {
  _poTutNext();
  const el = $('tutBox');
  if (el && !el.querySelector('.tutSkip') && this.i < TUT_STEPS.length) { const b = document.createElement('button'); b.className = 'tutSkip'; b.textContent = 'Skip tutorial ⏭'; b.onclick = () => { Save.data.tutDone = true; Save.save(); endRun('quit'); }; el.appendChild(b); }
};

// ----- bug report: copies everything useful to the clipboard -----
const ERRLOG = [];
addEventListener('error', (e) => { ERRLOG.push((e.message || 'error') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno); if (ERRLOG.length > 10) ERRLOG.shift(); });
function bugReport() {
  const v = (document.querySelector('script[src*="game.js"]') || {}).src || '';
  const lines = [
    'ZONEBONK bug report', 'version: ' + (v.split('v=')[1] || '?') + ' · ' + new Date().toISOString(),
    'device: ' + navigator.userAgent, 'screen: ' + innerWidth + '×' + innerHeight + ' @' + (window.devicePixelRatio || 1) + ' · touch: ' + matchMedia('(pointer: coarse)').matches,
    'fps: ' + (typeof fpsShow !== 'undefined' ? fpsShow : '?') + ' · quality: ' + Save.set.quality,
    G && !G.title ? 'run: ' + G.stage + ' · ' + fmtTime(G.t) + ' · lv ' + G.level + ' · ' + (G.mode2 || 'standard') + (G.coop ? ' · co-op ' + CO.role : '') + ' · level ' + World.cur : 'run: none (menu)',
    'caught errors: ' + ((typeof GUARD !== 'undefined' && GUARD.stacks) ? GUARD.stacks.join(' || ') : 'none'),
    'page errors: ' + (ERRLOG.join(' || ') || 'none'),
    'what happened: (describe here)',
  ].join('\n');
  let el = $('bugBox'); if (!el) { el = document.createElement('div'); el.id = 'bugBox'; el.className = 'screen show'; document.body.appendChild(el); }
  el.innerHTML = '<div class="endBox"><h2>🐞 REPORT A BUG</h2><p>This report was copied to your clipboard. Paste it to the developer (or to Claude) and add what happened.</p><textarea id="bugTxt" readonly></textarea><div class="endBtns"><button class="big" id="bugCopy">📋 COPY AGAIN</button><button class="big ghost" id="bugClose">CLOSE</button></div></div>';
  el.classList.add('show'); $('bugTxt').value = lines;
  const copy = () => (navigator.clipboard ? navigator.clipboard.writeText(lines) : Promise.reject()).catch(() => { $('bugTxt').select(); document.execCommand('copy'); });
  copy(); $('bugCopy').onclick = copy; $('bugClose').onclick = () => el.classList.remove('show');
}

// ----- UI hooks -----
addEventListener('DOMContentLoaded', () => {
  const _poMap = toggleMap;
  toggleMap = function () { _poMap(); if (G && G.tutorial && G.state === 'map') Tutorial.mapped = true; };
  // radiation bar under the health bar
  ($('hpRow') || $('hpBar')).insertAdjacentHTML('afterend', '<div id="radBar" title="Radiation dose: builds up in hot spots and radiation storms. Above 60% healing is halved, at 100% you get sick. Anti-rad clears it."><div id="radFill"></div><span>☢</span></div>');
  // pause + settings: bug report; settings: brightness and objective arrow
  $('abandonBtn').insertAdjacentHTML('afterend', '<button class="big ghost" id="bugBtn">🐞 REPORT BUG</button>');
  $('bugBtn').onclick = bugReport;
  const _bs = buildSettings;
  buildSettings = function () {
    _bs();
    const s = Save.set, body = $('settingsBody');
    body.insertAdjacentHTML('beforeend', `<label class="set"><span>Night darkness</span><input type="range" min="0.2" max="1" step="0.05" value="${s.nightDark === undefined ? 0.7 : s.nightDark}" data-po="nightDark"></label>` +
      `<label class="set"><span>Main objective arrow</span><input type="checkbox" ${s.objArrow === false ? '' : 'checked'} data-po-t="objArrow"></label>` +
      '<button class="big ghost small" id="bugSet">🐞 Report a bug</button>');
    body.querySelector('[data-po]').oninput = (e) => { s.nightDark = +e.target.value; Save.save(); };
    body.querySelector('[data-po-t]').onchange = (e) => { s.objArrow = e.target.checked; Save.save(); };
    $('bugSet').onclick = bugReport;
    applyLang && applyLang();
  };
  // research as a real tree
  BunkerUI.res = function (el) {
    const S = Save.data;
    let h = '<div class="sect">RESEARCH TREE · each node unlocks rarer artifacts in anomaly fields</div><div class="tree">';
    RESEARCH.forEach((r, i) => {
      const done = S.research.includes(r.id), ok = !r.needs || S.research.includes(r.needs);
      h += `${i ? `<div class="tlink ${done ? 'on' : ''}"></div>` : ''}<button class="tnode ${done ? 'done' : ok ? 'open' : 'locked'}" data-res="${r.id}"><span class="tic">${r.arts.map((a) => artImg(a, 'ico')).join('')}</span><span><b>${r.arts.map((a) => ARTIFACTS[a].name).join(' + ')}</b><small>${r.arts.map((a) => ARTIFACTS[a].desc).join(' · ')}</small><em>${done ? '✅ RESEARCHED' : ok ? `<span class="${S.rubles >= r.cost ? 'afford' : 'poor'}">${r.cost} ₽</span>` : '🔒 research the node above'}</em></span></button>`;
    });
    h += '</div><div class="sect">MUTATION BRANCH · become part mutant (equip up to 2)</div><div class="tree branch">';
    h += MUTATIONS2.map((m) => { const own = S.mutations.includes(m.id), eq = S.mutEq.includes(m.id); return `<button class="tnode ${eq ? 'done' : own ? 'open' : ''}" data-mut2="${m.id}"><span class="tic">${m.icon}</span><span><b>${m.name}</b><small>${m.desc}</small><em>${eq ? 'EQUIPPED · tap to remove' : own ? 'Tap to equip' : `<span class="${S.rubles >= m.cost ? 'afford' : 'poor'}">${m.cost} ₽</span>`}</em></span></button>`; }).join('');
    el.innerHTML = h + '</div>';
    for (const b of el.querySelectorAll('[data-res]')) b.onclick = () => { const r = RESEARCH.find((x) => x.id === b.dataset.res); if (S.research.includes(r.id) || (r.needs && !S.research.includes(r.needs)) || S.rubles < r.cost) return; S.rubles -= r.cost; S.research.push(r.id); Save.save(); Sfx.init(); Sfx.play('artifact'); buildBunker(); };
    for (const b of el.querySelectorAll('[data-mut2]')) b.onclick = () => { const m = MUTATIONS2.find((x) => x.id === b.dataset.mut2); if (!S.mutations.includes(m.id)) { if (S.rubles < m.cost) return; S.rubles -= m.cost; S.mutations.push(m.id); } if (S.mutEq.includes(m.id)) S.mutEq = S.mutEq.filter((x) => x !== m.id); else { S.mutEq.push(m.id); if (S.mutEq.length > 2) S.mutEq.shift(); } Save.save(); buildBunker(); };
  };
});

// ---------- bunker: the tab bar stays pinned while you scroll, with ← back and your money once the header is gone ----------
addEventListener('DOMContentLoaded', () => {
  const bk = $('bunker'), bar = $('bTabs'); if (!bk || !bar) return;
  const back = document.createElement('button'); back.id = 'bBack'; back.textContent = '←'; back.title = 'Back';
  back.onclick = () => { const b = bk.querySelector('.hdr .back'); if (b) b.click(); };
  const money = document.createElement('span'); money.id = 'bMoney'; money.className = 'rubles';
  const place = () => {
    if (bar.firstElementChild !== back) bar.prepend(back);
    if (bar.lastElementChild !== money) bar.appendChild(money);
    if (Save.data) money.textContent = Save.data.rubles + ' ₽';
    const sel = bar.querySelector('.tab.sel');
    if (sel && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = sel.offsetLeft - (bar.clientWidth - sel.offsetWidth) / 2;
  };
  const _bb = buildBunker; buildBunker = function (...a) { const r = _bb.apply(this, a); place(); return r; };
  bar.addEventListener('click', () => setTimeout(place, 0)); // some tabs select themselves after their own render
  const hdr = bk.querySelector('.hdr');
  bk.addEventListener('scroll', () => bk.classList.toggle('scrolled', bk.scrollTop > (hdr ? hdr.offsetTop + hdr.offsetHeight : 60)), { passive: true });
  place();
});
