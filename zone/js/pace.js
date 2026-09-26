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
Events.mods = function () { const m = _paMods(); const f = paceNow(); if (f !== 1) m.spawn *= Math.min(3.5, Math.sqrt(f)); return m; };

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
    if (!was && G && !G.title && !G.tutorial && G.t > 10) { // every run end counts: death, win, quit, co-op
      const S = Save.data; S.runLog = (S.runLog || []).concat([{ d: G.diff, p: G.pace || 'normal', t: Math.floor(G.t), dead: kind !== 'win', q: kind === 'quit' }]).slice(-80); Save.save();
    }
    return r;
  };
});

// ----- the top of the scale: 5 harder difficulties and 5 faster paces -----
DIFFICULTIES.push(
  { id: 'nightmare', icon: '👹', name: 'Nightmare', desc: 'Mutants hit like trucks. Your damage reduction is capped at 60%. ×2.5 rubles.', hp: 2.4, dmg: 2.4, spawn: 1.5, boss: 2.2, regen: 0, rev: 0, xp: 1, rub: 2.5, hpBonus: 0, drCap: 0.6, healMul: 0.8 },
  { id: 'hell', icon: '🔥', name: 'Hell', desc: 'Endless hordes. Damage reduction capped at 50%, healing −30%. ×3 rubles.', hp: 3.3, dmg: 3.2, spawn: 1.75, boss: 3, regen: 0, rev: 0, xp: 1, rub: 3, hpBonus: 0, drCap: 0.5, healMul: 0.7 },
  { id: 'apocalypse', icon: '☄️', name: 'Apocalypse', desc: 'The Zone ends here. Reduction capped at 40%, healing −45%. ×3.6 rubles.', hp: 4.5, dmg: 4.2, spawn: 2, boss: 4, regen: 0, rev: 0, xp: 1, rub: 3.6, hpBonus: 0, drCap: 0.4, healMul: 0.55 },
  { id: 'oblivion', icon: '🕳️', name: 'Oblivion', desc: 'Almost nothing survives. Reduction capped at 30%, healing halved. ×4.3 rubles.', hp: 6, dmg: 5.5, spawn: 2.3, boss: 5.5, regen: 0, rev: 0, xp: 1, rub: 4.3, hpBonus: 0, drCap: 0.3, healMul: 0.5 },
  { id: 'impossible', icon: '💀💀', name: 'Impossible', desc: 'The absolute maximum. Reduction capped at 20%, healing −60%, no mercy. ×5 rubles.', hp: 8, dmg: 7.5, spawn: 2.6, boss: 7.5, regen: 0, rev: 0, xp: 1, rub: 5, hpBonus: 0, drCap: 0.2, healMul: 0.4 },
);
PACES.push(
  { id: 'savage', icon: '🐺', name: 'Savage', k: 0.3, desc: '+300% every 10 minutes.' },
  { id: 'merciless', icon: '⚔️', name: 'Merciless', k: 0.45, desc: '+450% every 10 minutes.' },
  { id: 'hellish', icon: '😈', name: 'Hellish', k: 0.65, desc: '+650% every 10 minutes.' },
  { id: 'cataclysm', icon: '🌋', name: 'Cataclysm', k: 0.9, desc: '+900% every 10 minutes.' },
  { id: 'absolute', icon: '♾️', name: 'Absolute', k: 1.3, desc: '+1300% every 10 minutes. The absolute maximum.' },
);
Object.assign(PACE_BASE, { nightmare: 10, hell: 7, apocalypse: 5, oblivion: 3.5, impossible: 2.5 });
// upgrades can no longer make you nearly immune on the top difficulties: damage reduction is capped and healing is weaker
const _paHurt = hurtPlayer;
hurtPlayer = function (d, ...a) {
  const df = G && diffDef(); if (!df || df.drCap === undefined) return _paHurt(d, ...a);
  const sv = P.dr, sf = P.standFirm; P.dr = Math.min(P.dr, df.drCap); P.standFirm = Math.min(sf || 0, Math.max(0, df.drCap - P.dr));
  try { return _paHurt(d, ...a); } finally { P.dr = sv; P.standFirm = sf; }
};
let _paHpLast = 0;
const _paW2 = W2.update.bind(W2);
W2.update = function (dt) { // trims every kind of healing since the last frame on the top difficulties
  const df = G && !G.title ? diffDef() : null;
  if (df && df.healMul !== undefined && _paHpLast > 0 && P.hp > _paHpLast && !(P.ghost > 0)) P.hp = _paHpLast + (P.hp - _paHpLast) * df.healMul;
  _paW2(dt);
  _paHpLast = P.hp;
};
const _paNew2 = newGame;
newGame = function (...a) { _paHpLast = 0; return _paNew2(...a); };

// ----- main menu: "Difficulty – Pace", both selectable right there -----
addEventListener('DOMContentLoaded', () => {
  const old = $('diffTitleBtn'); if (!old) return;
  const row = document.createElement('div'); row.id = 'diffPaceRow';
  row.innerHTML = '<label>Difficulty <select id="dtDiff"></select></label><span class="dash">–</span><label>Pace <select id="dtPace"></select></label>';
  old.before(row); old.style.display = 'none';
  const fill = () => {
    const S = Save.data; if (!S) return;
    $('dtDiff').innerHTML = DIFFICULTIES.map((d) => `<option value="${d.id}" ${d.id === (S.diff || 'rookie') ? 'selected' : ''}>${d.icon} ${d.name}</option>`).join('');
    $('dtPace').innerHTML = PACES.map((p) => `<option value="${p.id}" ${p.id === (S.pace || 'normal') ? 'selected' : ''}>${p.icon} ${p.name}</option>`).join('');
    if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(row); } catch (e) { /* keep english */ }
  };
  $('dtDiff').onchange = (e) => { Save.data.diff = e.target.value; Save.save(); Sfx.init(); if (typeof buildSetup === 'function' && $('setup') && $('setup').classList.contains('show')) buildSetup(); };
  $('dtPace').onchange = (e) => { Save.data.pace = e.target.value; Save.save(); Sfx.init(); };
  const _dt = diffTitle; diffTitle = function (...a) { try { _dt(...a); } catch (e) { /* old button hidden */ } fill(); };
  fill();
  const _bs = buildSetup; buildSetup = function (...a) { const r = _bs(...a); fill(); return r; };
});

// ----- one-tap suggestion from your last 3 runs: difficulty + pace together -----
const Suggest = {
  level(d, p) { return Math.max(0, DIFFICULTIES.findIndex((x) => x.id === d)) + Math.max(0, PACES.findIndex((x) => x.id === p)); },
  get() {
    let log = (Save.data.runLog || []).slice(-3);
    if (!log.length) { // no runs logged yet: fall back to your best time on record
      const b = Math.max(0, ...Object.values(Save.data.best || {}).map(Number).filter((x) => x > 0));
      if (!b) return null;
      log = [{ d: Save.data.diff || 'rookie', p: Save.data.pace || 'normal', t: b, dead: true }];
    }
    // won / 15:00+ → much harder, 10–15 min → harder, 6–10 min → keep, under 6 min → easier
    const step = (r) => (!r.dead || r.t >= 900 ? 2 : r.t >= 600 ? 1 : r.t >= 360 || r.q ? 0 : -1); // quitting early is not a sign it was too hard
    const last = log[log.length - 1], avg = log.reduce((a, r) => a + step(r), 0) / log.length;
    const L = Math.max(0, Math.min(DIFFICULTIES.length + PACES.length - 2, this.level(last.d, last.p) + Math.round(avg)));
    const di = Math.min(DIFFICULTIES.length - 1, Math.ceil(L / 2)), pi = Math.max(0, Math.min(PACES.length - 1, L - di));
    return { d: DIFFICULTIES[di], p: PACES[pi], n: log.length };
  },
  label() { const s = this.get(); return s ? `✨ Suggested: ${s.d.icon} ${s.d.name} – ${s.p.icon} ${s.p.name}` : '✨ Suggested: play a run first'; },
  apply() {
    const s = this.get(); if (!s) return;
    Save.data.diff = s.d.id; Save.data.pace = s.p.id; Save.save(); Sfx.init(); Sfx.play('quest');
    if (typeof diffTitle === 'function') diffTitle();
    if ($('setup') && $('setup').classList.contains('show')) buildSetup();
    this.refresh();
  },
  refresh() { for (const b of document.querySelectorAll('.suggestBtn')) { b.textContent = this.label(); b.disabled = !this.get(); b.title = 'Based on your last 3 runs'; } },
  button() { const b = document.createElement('button'); b.className = 'big ghost small suggestBtn'; b.onclick = () => this.apply(); b.textContent = this.label(); return b; },
};
addEventListener('DOMContentLoaded', () => {
  const add = (where, how) => { const el = typeof where === 'string' ? $(where) : where; if (el) { const b = Suggest.button(); how(el, b); } };
  add('diffPaceRow', (el, b) => el.after(b)); // main menu
  add('pause', (el, b) => { const x = $('autoPauseBtn'); if (x) x.after(b); else el.appendChild(b); }); // pause menu (applies next run)
  const _bs = buildSetup; buildSetup = function (...a) { const r = _bs(...a); const box = $('paceBox'); if (box && !box.querySelector('.suggestBtn')) box.prepend(Suggest.button()); Suggest.refresh(); return r; };
  const _bst = buildSettings; buildSettings = function (...a) { const r = _bst(...a); const body = $('settingsBody'); if (body && !body.querySelector('.suggestBtn')) { const row = document.createElement('div'); row.className = 'set'; row.innerHTML = '<span>Difficulty & pace</span>'; row.appendChild(Suggest.button()); body.prepend(row); } Suggest.refresh(); return r; };
  const _er = endRun; endRun = function (...a) { const r = _er(...a); Suggest.refresh(); return r; };
  Suggest.refresh();
});
