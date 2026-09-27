'use strict';
// ---------- extras: survival heatmap for every difficulty × pace, and scratch cards in the casino ----------

// ----- 🔥 heatmap: chance to survive 15:00 for each difficulty (rows) and pace (columns); tap a cell to pick it -----
function survivalPct(d, p) {
  const own = Forecast.personal(d, p), med = own ? own.med : Forecast.median(d, p);
  return Math.max(0, Math.min(1, 1 - Forecast.cdf(15, med)));
}
function heatColor(v) { const h = Math.round(v * 120); return `hsl(${h},75%,${28 + v * 14}%)`; }
function heatmapHTML() {
  const S = Save.data, cd = S.diff || 'rookie', cp = S.pace || 'normal';
  let h = `<div class="hmWrap"><table class="hm"><tr><th class="hmCorner">⬇ Difficulty · Pace ➡</th>${PACES.map((p) => `<th title="${p.name}"><span>${p.icon}</span><small>${p.name}</small></th>`).join('')}</tr>`;
  for (const d of DIFFICULTIES) {
    h += `<tr><th class="hmRow">${d.icon} <small>${d.name}</small></th>`;
    for (const p of PACES) { const v = survivalPct(d.id, p.id), me = d.id === cd && p.id === cp; h += `<td class="${me ? 'me' : ''}" data-hm="${d.id}|${p.id}" style="background:${heatColor(v)}" title="${d.name} – ${p.name}: ${Math.round(v * 100)}%">${Math.round(v * 100)}</td>`; }
    h += '</tr>';
  }
  return h + '</table></div><div class="hmLegend"><span style="background:' + heatColor(0) + '">0%</span><span style="background:' + heatColor(0.5) + '">50%</span><span style="background:' + heatColor(1) + '">100%</span><small>Chance to survive 15:00 · uses your own runs when you have 5+ on a combo · tap a cell to pick it</small></div>';
}
function bindHeatmap(el, after) {
  for (const c of el.querySelectorAll('[data-hm]')) c.onclick = () => {
    const [d, p] = c.dataset.hm.split('|'); Save.data.diff = d; Save.data.pace = p; Save.save();
    if ($('dtDiff')) $('dtDiff').value = d; if ($('dtPace')) $('dtPace').value = p;
    Sfx.init(); Sfx.play('quest'); if (after) after();
  };
}
function openHeatmap() {
  let m = $('hmModal'); if (!m) { m = document.createElement('div'); m.id = 'hmModal'; document.body.appendChild(m); }
  const fill = () => { m.innerHTML = `<div class="hmBox"><div class="hdr"><button class="back" id="hmClose">← BACK</button><h2>🔥 SURVIVAL HEATMAP</h2><span></span></div>${heatmapHTML()}</div>`; $('hmClose').onclick = () => m.classList.remove('show'); bindHeatmap(m, () => { fill(); if (typeof titleContinue === 'function') titleContinue(); }); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(m); } catch (e) { /* keep english */ } };
  fill(); m.classList.add('show');
}

// ----- 🎫 scratch cards: scratch the silver coat; three matching symbols win -----
const SC_PAY = [['☢️', 50, 0.005], ['💎', 10, 0.02], ['🔔', 5, 0.05], ['🍒', 2, 0.1]];
const SC_FILL = ['🍋', '🍇', '⭐', '🥫', '🔦', '🍀', '🪙'];
function scratchCard() {
  let r = Math.random(), win = null;
  for (const s of SC_PAY) { if (r < s[2]) { win = s; break; } r -= s[2]; }
  const pool = SC_PAY.map((s) => s[0]).concat(SC_FILL).filter((x) => !win || x !== win[0]), cells = [], cnt = {};
  if (win) for (let i = 0; i < 3; i++) cells.push(win[0]);
  while (cells.length < 9) { const x = pick(pool); if ((cnt[x] || 0) < 2) { cnt[x] = (cnt[x] || 0) + 1; cells.push(x); } }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return { cells, win };
}
CZG.scratch = function (st) {
  const K = CZG.scS = CZG.scS || { card: null };
  st.insertAdjacentHTML('beforeend', `<div class="scWrap"><div class="scCard" id="scCard"><div class="scGrid" id="scGrid"></div><canvas id="scCoat" width="360" height="360"></canvas></div><div class="scSide"><b>🎫 ZONE SCRATCH</b><small>Match 3 symbols to win</small>${SC_PAY.map((s) => `<span>${s[0].repeat(3)} ×${s[1]}</span>`).join('')}</div></div><div class="czAct"><button class="big" id="scBuy">🎫 BUY CARD</button><button class="big ghost small" id="scAll">✨ REVEAL ALL</button></div>`);
  const cv = $('scCoat'), g = cv.getContext('2d');
  const coat = () => {
    g.globalCompositeOperation = 'source-over'; const gr = g.createLinearGradient(0, 0, 360, 360); gr.addColorStop(0, '#9aa0a8'); gr.addColorStop(0.5, '#e8ecf0'); gr.addColorStop(1, '#8a9098'); g.fillStyle = gr; g.fillRect(0, 0, 360, 360);
    g.fillStyle = '#6a7078'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g.fillText('☢', 60 + x * 120, 70 + y * 120);
    g.fillStyle = '#3a4048'; g.font = 'bold 18px sans-serif'; g.fillText('SCRATCH HERE', 180, 186);
  };
  const show = () => { $('scGrid').innerHTML = K.card ? K.card.cells.map((c) => `<div class="${K.card.done && K.card.win && c === K.card.win[0] ? 'hit' : ''}">${c}</div>`).join('') : ''; cv.style.display = K.card && !K.card.done ? '' : 'none'; };
  const finish = () => {
    const c = K.card; if (!c || c.done) return; c.done = true; show();
    const win = c.win ? Math.floor(c.bet * c.win[1]) : 0; CZ.give(win, c.bet);
    CZ.res(st, win ? `${c.win[0].repeat(3)} · WIN ${win} ₽ (×${c.win[1]})` : 'No match this time.', win ? true : false); Sfx.play(win ? 'quest' : 'hurt');
  };
  const scratched = () => { const d = g.getImageData(0, 0, 360, 360).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] < 20) n++; return n / (d.length / 64); };
  let down = false, last = null;
  const at = (e) => { const r = cv.getBoundingClientRect(), t = e; return [(t.clientX - r.left) * (360 / r.width), (t.clientY - r.top) * (360 / r.height)]; };
  const draw = (e) => {
    if (!down || !K.card || K.card.done) return; e.preventDefault(); const [x, y] = at(e);
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 44; g.lineCap = 'round'; g.beginPath(); g.moveTo(...(last || [x, y])); g.lineTo(x, y); g.stroke(); last = [x, y];
    if (Math.random() < 0.3) CZ.beep(3000 + Math.random() * 2000, 0.01, 'sawtooth', 0.012);
  };
  const up = () => { if (!down) return; down = false; last = null; if (K.card && !K.card.done && scratched() > 0.6) finish(); };
  cv.addEventListener('pointerdown', (e) => { down = true; draw(e); }); cv.addEventListener('pointermove', draw); cv.addEventListener('pointerup', up); cv.addEventListener('pointerleave', up);
  $('scBuy').onclick = () => { if (K.card && !K.card.done) { CZ.shake(); return; } if (!CZ.take(CZ.bet)) return; K.card = Object.assign(scratchCard(), { bet: CZ.bet, done: false }); coat(); show(); CZ.res(st, 'Scratch the card! (or REVEAL ALL)'); Sfx.play('stash'); };
  $('scAll').onclick = () => { if (K.card && !K.card.done) finish(); };
  if (K.card && !K.card.done) coat(); show();
};

addEventListener('DOMContentLoaded', () => {
  // title: a 🔥 button beside the difficulty and pace pickers opens the heatmap
  const row = $('diffPaceRow');
  if (row) { const b = document.createElement('button'); b.className = 'ghost hmBtn'; b.id = 'hmBtn'; b.textContent = '🔥 Heatmap'; b.onclick = openHeatmap; row.appendChild(b); }
  // stats tab gets the heatmap too
  const sb = document.querySelector('[data-bt2="stats"]');
  if (sb) { const o = sb.onclick; sb.onclick = () => { o(); const body = $('bunker2'); if (!body) return; body.insertAdjacentHTML('beforeend', '<div class="sect">🔥 SURVIVAL HEATMAP · every difficulty × pace</div>' + heatmapHTML()); bindHeatmap(body, () => sb.onclick()); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(body); } catch (e) { /* keep english */ } }; }
});
