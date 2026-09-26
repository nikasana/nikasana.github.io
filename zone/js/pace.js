'use strict';
// ---------- pace: how fast the Zone gets harder over time, plus a survival forecast ----------
// k = extra enemy strength per minute on top of the normal ramp (f = 1 + k·minutes, never below 0.7)
const PACES = [
  { id: 'relaxed', icon: '🐢', name: 'Classic', k: 0, desc: 'The old gentle ramp. Strong builds become almost unkillable after ~10 min.' },
  { id: 'normal', icon: '🚶', name: 'Normal', k: 0.04, desc: '+40% mutant HP and damage every 10 minutes. The recommended pace.' },
  { id: 'steady', icon: '🏃', name: 'Steady climb', k: 0.07, desc: '+70% every 10 minutes. You need a real build to see 20:00.' },
  { id: 'fast', icon: '🔥', name: 'Fast', k: 0.12, desc: '+120% every 10 minutes. Late game gets rough.' },
  { id: 'brutal', icon: '☠️', name: 'Brutal', k: 0.2, desc: '+200% every 10 minutes. Few survive 15:00.' },
];
// median minutes a typical player would survive on each difficulty with the old (Classic) ramp (our best estimate before you have history)
const PACE_BASE = { tourist: 60, rookie: 42, stalker: 30, veteran: 22, legend: 15 };
function paceDef(id) { return PACES.find((p) => p.id === id) || PACES[1]; }
function paceF(k, min) { return Math.max(0.7, 1 + k * min); }
const Forecast = {
  sigma: 0.5,
  // median death time: solve ∫ f(s)² ds = base (HP × damage both grow with f, so pressure grows like f²)
  median(diff, pace) {
    const base = PACE_BASE[diff] || 11, k = paceDef(pace).k; let acc = 0, t = 0;
    while (acc < base && t < 90) { acc += Math.pow(paceF(k, t), 2) * 0.05; t += 0.05; }
    return t;
  },
  personal(diff, pace) {
    const L = (Save.data.runLog || []).filter((r) => r.d === diff && r.p === pace).map((r) => r.t / 60).sort((a, b) => a - b);
    return L.length >= 5 ? { med: L[Math.floor(L.length / 2)], n: L.length } : null;
  },
  cdf(t, med) { const z = (Math.log(t) - Math.log(med)) / this.sigma; return 0.5 * (1 + erf(z / Math.SQRT2)); },
  html(diff, pace) {
    const me = this.personal(diff, pace), med = me ? me.med : this.median(diff, pace);
    const pct = (m) => Math.round(Math.min(99, Math.max(1, this.cdf(m, med) * 100))) + '%';
    return `<div class="forecast"><b>📈 Survival forecast</b> · typical run ends around <b>${fmtTime(Math.round(med * 60))}</b> ${me ? `(from your last ${me.n} runs)` : '(estimate)'}<br>Chance to fall before <b>5:00</b> ${pct(5)} · <b>10:00</b> ${pct(10)} · <b>15:00</b> ${pct(15)} · <b>20:00</b> ${pct(20)}</div>`;
  },
};
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }

// ----- in the run -----
const _paNew = newGame;
newGame = function (...a) { _paNew(...a); if (G) G.pace = G.pace || Save.data.pace || 'normal'; };
if (typeof RunSave !== 'undefined' && RunSave.GKEYS) RunSave.GKEYS.push('pace');
function paceNow() { return G && !G.title && !G.tutorial ? paceF(paceDef(G.pace).k, G.t / 60) : 1; }
const _paSpawn = spawnEnemy;
spawnEnemy = function (id, x, y, o) {
  const e = _paSpawn(id, x, y, o);
  if (e && G && !G.coGuest) { const f = paceNow(); if (f !== 1) { e.hp *= f; e.maxhp *= f; e.dmg *= f; } }
  return e;
};
const _paMods = Events.mods.bind(Events);
Events.mods = function () { const m = _paMods(); const f = paceNow(); if (f !== 1) m.spawn *= Math.min(2.2, Math.sqrt(f)); return m; };

// ----- setup screen: the pace picker next to the difficulty, with the forecast -----
addEventListener('DOMContentLoaded', () => {
  const _bs = buildSetup;
  buildSetup = function (...a) {
    const r = _bs(...a);
    const dl = $('diffList'); if (!dl) return r;
    const S = Save.data, cur = S.pace || 'normal';
    let box = $('paceBox'); if (!box) { box = document.createElement('div'); box.id = 'paceBox'; dl.after(box); }
    box.innerHTML = `<div class="sect">PACE · how fast the Zone gets harder</div><div class="paceRow">${PACES.map((p) => `<button class="chip ${p.id === cur ? 'sel' : ''}" data-pace="${p.id}" title="${p.desc}">${p.icon} ${p.name}</button>`).join('')}</div><p class="dim paceDesc">${paceDef(cur).desc}</p>${Forecast.html(S.diff || 'rookie', cur)}`;
    for (const b of box.querySelectorAll('[data-pace]')) b.onclick = () => { S.pace = b.dataset.pace; Save.save(); buildSetup(); };
    if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(box); } catch (e) { /* keep english */ }
    return r;
  };
  // remember how long runs last on each difficulty + pace, so the forecast learns from you
  const _er = endRun;
  endRun = function (kind, src) {
    const was = G && G.ended, r = _er(kind, src);
    if (!was && G && !G.tutorial && !G.coGuest && (kind === 'dead' || kind === 'win') && G.t > 20) {
      const S = Save.data; S.runLog = (S.runLog || []).concat([{ d: G.diff, p: G.pace || 'normal', t: Math.floor(G.t), dead: kind === 'dead' }]).slice(-80); Save.save();
    }
    return r;
  };
});
