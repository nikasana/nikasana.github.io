'use strict';
// ---------- extras: survival heatmap for every difficulty × pace, and scratch cards in the casino ----------

// ----- 🔥 heatmap: chance to survive 15:00 for each difficulty (rows) and pace (columns); tap a cell to pick it -----
// your skill: how long you really last compared with the model, across all your runs (any difficulty and pace)
function heatSkill() {
  const log = (Save.data.runLog || []).filter((r) => !(r.q && r.t < 120) && !(r.dead && !r.q && r.t < 45) && DIFFICULTIES.some((x) => x.id === r.d)).slice(-30);
  if (heatSkill.n === log.length && heatSkill.last === (log[log.length - 1] || {}).t) return heatSkill.v;
  const ratios = log.map((r) => { const med = Forecast.median(r.d, r.p || 'normal'), got = r.t / 60 * (r.dead && !r.q ? 1 : 1.25); return Math.log(Math.max(0.2, got) / med); }).sort((a, b) => a - b);
  const v = ratios.length ? { f: Math.max(0.15, Math.min(6, Math.exp(ratios[Math.floor(ratios.length / 2)]))), n: ratios.length } : null;
  heatSkill.n = log.length; heatSkill.last = (log[log.length - 1] || {}).t; heatSkill.v = v; return v;
}
function survivalPct(d, p) {
  const sk = heatSkill(); let med = Forecast.median(d, p) * (sk ? sk.f : 1);
  const own = (Save.data.runLog || []).filter((r) => r.d === d && (r.p || 'normal') === p && !(r.q && r.t < 120)).map((r) => r.t / 60 * (r.dead && !r.q ? 1 : 1.25)).sort((a, b) => a - b);
  if (own.length) { const om = own[Math.floor(own.length / 2)], w = Math.min(own.length, 6); med = Math.exp((Math.log(om) * w + Math.log(med) * 2) / (w + 2)); }
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
  return h + '</table></div><div class="hmLegend"><span style="background:' + heatColor(0) + '">0%</span><span style="background:' + heatColor(0.5) + '">50%</span><span style="background:' + heatColor(1) + '">100%</span><small>' + (heatSkill() ? `Based on your last ${heatSkill().n} runs · you last ×${heatSkill().f.toFixed(2)} as long as an average stalker` : 'No runs yet · showing an average stalker') + '</small><small>Chance to survive 15:00 · tap a cell to pick it</small></div>';
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
  st.insertAdjacentHTML('beforeend', `<div class="scWrap"><div class="scCard" id="scCard"><div class="scGrid" id="scGrid"></div><canvas id="scCoat" width="360" height="360"></canvas></div><div class="scSide"><b>🎫 ZONE SCRATCH</b><small>Match 3 symbols to win</small>${SC_PAY.map((s) => `<span>${s[0].repeat(3)} ×${s[1]}</span>`).join('')}</div></div><div class="czAct"><button class="big" id="scBuy">🎫 BUY CARD</button>${CZ.autoFreeHtml()}<button class="big ghost small" id="scAll">✨ REVEAL ALL</button></div>`);
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
  $('scBuy').onclick = () => { if (K.card && !K.card.done) { CZ.shake(); return; } if (!CZ.take(CZ.bet)) return; K.card = Object.assign(CZ.rig(scratchCard, (c) => !!c.win), { bet: CZ.bet, done: false }); coat(); show(); CZ.res(st, 'Scratch the card! (or REVEAL ALL)'); Sfx.play('stash'); };
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

// ----- 🏁 personal records board: best-ever run stats, per-stage bests and a "NEW RECORD" callout after runs -----
const REC_DEFS = [
  ['time', '⏱️', 'Longest survival', (v) => fmtMin(v)], ['kills', '☠️', 'Most kills in a run', (v) => v], ['level', '⭐', 'Highest level', (v) => 'LV ' + v],
  ['rub', '💰', 'Most rubles in a run', (v) => v + ' ₽'], ['arts', '💎', 'Most artifacts in a run', (v) => v], ['diff', '🔥', 'Hardest difficulty beaten (15:00)', (v) => (DIFFICULTIES[v] ? DIFFICULTIES[v].icon + ' ' + DIFFICULTIES[v].name : '—')],
  ['pace', '⚡', 'Fastest pace beaten (15:00)', (v) => (PACES[v] ? PACES[v].icon + ' ' + PACES[v].name : '—')], ['kpm', '🎯', 'Kills per minute', (v) => v],
];
const Records = {
  d() { const S = Save.data; S.rec = S.rec || { best: {}, stage: {} }; return S.rec; },
  fmtMin(t) { return typeof fmtMin === 'function' ? fmtMin(t) : Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); },
  onEnd(kind) {
    if (!G || G.title || G.tutorial) return [];
    const R = this.d(), t = Math.floor(G.t), got = [], when = Date.now(), di = DIFFICULTIES.findIndex((x) => x.id === G.diff), pi = PACES.findIndex((x) => x.id === (G.pace || 'normal'));
    const vals = { time: t, kills: G.kills || 0, level: G.level || 1, rub: Math.floor(G.rubles || 0), arts: Object.keys(P.arts || {}).length, kpm: t >= 60 ? Math.round((G.kills || 0) / (t / 60)) : 0 };
    if (t >= 900 && kind !== 'quit') { vals.diff = di; vals.pace = pi; }
    for (const k in vals) { const old = R.best[k]; if (vals[k] > 0 && (!old || vals[k] > old.v)) { if (old) got.push([k, old.v, vals[k]]); R.best[k] = { v: vals[k], at: when, stage: G.stage, d: G.diff, p: G.pace || 'normal' }; } }
    const st = R.stage[G.stage] = R.stage[G.stage] || { t: 0, kills: 0, runs: 0 }; st.runs++; if (t > st.t) st.t = t; if ((G.kills || 0) > st.kills) st.kills = G.kills;
    Save.save(); return got;
  },
  ui(el) {
    const R = this.d(), S = Save.data;
    let h = '<div class="sect">🏁 PERSONAL RECORDS · beat them to see NEW RECORD after a run</div><div class="recGrid">';
    for (const [k, ic, nm, f] of REC_DEFS) { const b = R.best[k]; h += `<div class="recCard ${b ? '' : 'none'}"><span>${ic}</span><b>${b ? f(b.v) : '—'}</b><small>${nm}</small>${b ? `<em>${zbDate ? zbDate(b.at) : new Date(b.at).toLocaleDateString()} · ${(STAGES.find((x) => x.id === b.stage) || {}).name || ''}</em>` : ''}</div>`; }
    const extra = [['🏆', S.wins || 0, 'Wins'], ['🏃', (S.runLog || []).length, 'Runs played'], ['🎰', (S.casino && S.casino.big) || 0, 'Biggest casino win'], ['🧬', typeof Cyberware !== 'undefined' ? Cyberware.count() : 0, 'Cyberware perks'], ['🌟', Mastery.d().lvl, 'Mastery level'], ['🏅', (S.ach || []).length, 'Achievements']];
    h += extra.map(([ic, v, nm]) => `<div class="recCard"><span>${ic}</span><b>${v}</b><small>${nm}</small></div>`).join('') + '</div>';
    h += '<div class="sect">BEST PER STAGE</div><table class="recTab"><tr><th>Stage</th><th>⏱️ Best time</th><th>☠️ Best kills</th><th>🏃 Runs</th></tr>';
    for (const s of STAGES) { const r = R.stage[s.id]; h += `<tr class="${r ? '' : 'dim'}"><td>${s.icon} ${s.name}</td><td>${r ? this.fmtMin(r.t) : '—'}</td><td>${r ? r.kills : '—'}</td><td>${r ? r.runs : 0}</td></tr>`; }
    el.innerHTML = h + '</table>';
  },
};
addEventListener('DOMContentLoaded', () => {
  const _er = endRun;
  endRun = function (kind, src) {
    const was = G && G.ended, r = _er(kind, src);
    if (!was && G && !G.title && !G.tutorial) {
      const got = Records.onEnd(kind), e = $('earned');
      if (got.length && e) { const def = (k) => REC_DEFS.find((x) => x[0] === k); e.insertAdjacentHTML('beforeend', '<div class="recNew">' + got.map(([k, o, n]) => { const d = def(k); return `<div>🏁 NEW RECORD · ${d[1]} ${d[2]}: <b>${d[3](n)}</b> <small>(was ${d[3](o)})</small></div>`; }).join('') + '</div>'); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(e); } catch (x) { /* keep english */ } }
    }
    return r;
  };
  const bar = $('bTabs'), body = $('bunker2'); if (!bar || !body) return;
  const b = document.createElement('button'); b.className = 'tab'; b.dataset.bt2 = 'rec'; b.textContent = '🏁 Records';
  b.onclick = () => { const cx = document.querySelector('[data-bt="codex"]'); if (cx) cx.click(); for (const x of bar.children) x.classList.remove('sel'); b.classList.add('sel'); body.classList.remove('cyberMap'); Records.ui(body); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(body); } catch (x) { /* keep english */ } };
  const st = bar.querySelector('[data-bt2="stats"]'); bar.insertBefore(b, st || null);
});
