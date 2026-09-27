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
// (recalibrated: the first guesses were far too optimistic, so a new player's heatmap looked much easier than the game)
const PACE_BASE = { tourist: 33, rookie: 23, stalker: 16, veteran: 12, legend: 8 };
// every difficulty's budget comes from its real numbers: mutant HP × damage × spawn rate (pressure), weaker healing,
// and extra revives, calibrated so an average new stalker on Stalker/Classic lasts ~20 min
function diffBase(id) {
  const d = DIFFICULTIES.find((x) => x.id === id); if (!d) return PACE_BASE[id] || 11;
  const P = (d.hp || 1) * (d.dmg || 1) * (d.spawn || 1);
  return 20 * Math.pow(P, -0.45) * Math.pow(d.healMul || 1, 0.3) * (1 + 0.08 * (d.rev || 0));
}
function paceDef(id) { return PACES.find((p) => p.id === id) || PACES[1]; }
function paceF(k, min) { return Math.max(0.7, 1 + k * min); }
const Forecast = {
  sigma: 0.6,
  // median death time: solve ∫ f(s)² ds = base (HP × damage both grow with f, so pressure grows like f²);
  // each Ascension level adds +20% mutant HP and +15% damage, which shrinks the budget the same way
  median(diff, pace, asc = 0) {
    const key = diff + '|' + pace + '|' + asc; this.memo = this.memo || {}; if (this.memo[key] !== undefined) return this.memo[key];
    const base = diffBase(diff) / ((1 + 0.2 * asc) * (1 + 0.15 * asc)), k = paceDef(pace).k; let acc = 0, t = 0;
    while (acc < base && t < 90) { acc += Math.pow(paceF(k, t), 2) * 0.05; t += 0.05; }
    return (this.memo[key] = t);
  },
  personal(diff, pace) {
    const L = (Save.data.runLog || []).filter((r) => r.d === diff && r.p === pace).map((r) => r.t / 60).sort((a, b) => a - b);
    return L.length >= 5 ? { med: L[Math.floor(L.length / 2)], n: L.length } : null;
  },
  cdf(t, med) { const z = (Math.log(t) - Math.log(med)) / this.sigma; return 0.5 * (1 + erf(z / Math.SQRT2)); },
  html(diff, pace) {
    const sk = typeof heatSkill === 'function' ? heatSkill() : null, me = sk ? { n: sk.n } : null;
    const med = this.median(diff, pace, typeof curAsc === 'function' ? curAsc() : 0) * (sk ? sk.f : 1);
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
Events.mods = function () { const m = _paMods(); const f = paceNow(); if (f !== 1) m.spawn *= Math.min(4.5, Math.sqrt(f)); return m; };

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
      const S = Save.data; S.runLog = (S.runLog || []).concat([{ d: G.diff, p: G.pace || 'normal', a: G.asc || 0, t: Math.floor(G.t), dead: kind !== 'win', q: kind === 'quit', ...(G.stat && G.stat.n > 5 ? { hp: +(G.stat.hp / G.stat.n).toFixed(3), min: +G.stat.min.toFixed(3), dz: +(G.stat.danger / G.stat.n).toFixed(3), dpm: +(G.stat.dmg / Math.max(1, G.t / 60)).toFixed(3) } : {}) }]).slice(-80); Save.save();
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
DIFFICULTIES.push(
  { id: 'doom', icon: '☠️', name: 'Doom', desc: 'Reduction capped at 15%, healing −65%. ×6 rubles.', hp: 11, dmg: 10, spawn: 2.9, boss: 10, regen: 0, rev: 0, xp: 1, rub: 6, hpBonus: 0, drCap: 0.15, healMul: 0.35 },
  { id: 'annihilation', icon: '💥', name: 'Annihilation', desc: 'Reduction capped at 10%, healing −70%. ×7 rubles.', hp: 15, dmg: 13, spawn: 3.2, boss: 13, regen: 0, rev: 0, xp: 1, rub: 7, hpBonus: 0, drCap: 0.1, healMul: 0.3 },
  { id: 'eternal', icon: '🌑', name: 'Eternal Night', desc: 'Reduction capped at 8%, healing −75%. ×8.5 rubles.', hp: 20, dmg: 17, spawn: 3.5, boss: 17, regen: 0, rev: 0, xp: 1, rub: 8.5, hpBonus: 0, drCap: 0.08, healMul: 0.25 },
  { id: 'zonegod', icon: '👁️', name: 'Zone God', desc: 'Reduction capped at 5%, healing −80%. ×10 rubles.', hp: 28, dmg: 23, spawn: 3.8, boss: 23, regen: 0, rev: 0, xp: 1, rub: 10, hpBonus: 0, drCap: 0.05, healMul: 0.2 },
  { id: 'singularity', icon: '⚫', name: 'Singularity', desc: 'No damage reduction, healing −85%. The true end. ×12 rubles.', hp: 40, dmg: 32, spawn: 4.2, boss: 32, regen: 0, rev: 0, xp: 1, rub: 12, hpBonus: 0, drCap: 0, healMul: 0.15 },
);
PACES.push(
  { id: 'relentless', icon: '⚡', name: 'Relentless', k: 1.8, desc: '+1800% every 10 minutes.' },
  { id: 'doomsday', icon: '🌪️', name: 'Doomsday', k: 2.5, desc: '+2500% every 10 minutes.' },
  { id: 'extinction', icon: '🦴', name: 'Extinction', k: 3.5, desc: '+3500% every 10 minutes.' },
  { id: 'event', icon: '🌀', name: 'Event Horizon', k: 5, desc: '+5000% every 10 minutes.' },
  { id: 'beyond', icon: '♾️', name: 'Beyond', k: 7, desc: '+7000% every 10 minutes. Nothing is faster.' },
);
Object.assign(PACE_BASE, { doom: 1.8, annihilation: 1.3, eternal: 1, zonegod: 0.75, singularity: 0.55 });
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
  RunStat.tick(dt);
  _paHpLast = P.hp;
};
const _paNew2 = newGame;
newGame = function (...a) { _paHpLast = 0; const r = _paNew2(...a); if (G) G.stat = { n: 0, hp: 0, min: 1, danger: 0, dmg: 0, acc: 0 }; return r; };
// health over time: sampled once a second while playing
const RunStat = {
  tick(dt) {
    const st = G && G.stat; if (!st || G.title || G.state !== 'play' || !(P.maxhp > 0)) return;
    st.acc += dt; if (st.acc < 1) return; st.acc = 0;
    const f = Math.max(0, Math.min(1, P.hp / P.maxhp)); st.n++; st.hp += f; st.min = Math.min(st.min, f); if (f < 0.3) st.danger++;
  },
};
const _paHurt2 = hurtPlayer;
hurtPlayer = function (d, ...a) { const b = P ? P.hp : 0; const r = _paHurt2(d, ...a); if (G && G.stat && P && P.maxhp > 0 && P.hp < b) G.stat.dmg += (b - P.hp) / P.maxhp; return r; };

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
  TARGET: 0.55, // tense but survivable
  // how hard a run felt, 0 (trivial) … 1 (crushed)
  stress(r) {
    const byTime = r.t < 360 ? 0.9 : r.t < 600 ? 0.72 : r.t < 900 ? 0.6 : 0.4;
    if (r.hp === undefined) return !r.dead ? 0.3 : r.q ? Math.min(byTime, 0.55) : byTime; // older runs: only time is known
    let s = 0.4 * (1 - r.hp) + 0.3 * Math.min(1, r.dz * 2.5) + 0.2 * Math.min(1, r.dpm / 0.6) + 0.1 * (1 - r.min);
    if (r.dead && !r.q) s = Math.max(s, byTime); // a death is a strong signal
    if (!r.dead) s = Math.min(s, 0.5); // a win is never 'too hard'
    return Math.max(0, Math.min(1, s));
  },
  // anchored on your own runs: each run says 'at this setting I got this far'
  lvlOf(d, p) { return Math.max(0, DIFFICULTIES.findIndex((x) => x.id === d)) + Math.max(0, PACES.findIndex((x) => x.id === p)); },
  // how far off a run was: 0 = right fit (reached 15:00), negative = too hard, positive = too easy
  delta(r) {
    let q = r.t / 900;
    if (!r.dead || (r.q && r.t >= 600) || r.t >= 900) q = Math.max(1, q) * (r.hp !== undefined ? 1 + Math.max(0, r.hp - 0.5) : 1.15);
    return Math.max(-4, Math.min(4, 3 * Math.log2(Math.max(0.01, q))));
  },
  get() {
    const S = Save.data, idx = (arr, id, def) => Math.max(0, arr.findIndex((x) => x.id === (id || def)));
    const dc = idx(DIFFICULTIES, S.diff, 'rookie'), pc = idx(PACES, S.pace, 'normal');
    let log = (S.runLog || []).filter((r) => !(r.q && r.t < 120) && !(r.dead && !r.q && r.t < 45)).slice(-5);
    if (!log.length) { const b = Math.max(0, ...Object.values(S.best || {}).map(Number).filter((x) => x > 0)); if (!b) return null; log = [{ d: S.diff || 'rookie', p: S.pace || 'normal', t: b, dead: true }]; }
    // early deaths are about difficulty (pace barely matters in the first minutes); late deaths are about pace
    const dE = [], pE = [];
    for (const r of log) {
      const d0 = idx(DIFFICULTIES, r.d, 'rookie'), p0 = idx(PACES, r.p, 'normal'), x = this.delta(r);
      if (x < 0 && r.t < 480) { dE.push(d0 + x); pE.push(p0); }
      else if (x < 0) { dE.push(d0); pE.push(p0 + x); }
      else { dE.push(d0 + Math.round(x * 0.6)); pE.push(p0 + Math.round(x * 0.4)); }
    }
    const med = (a) => { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }; // one freak run can't swing it
    // one stable best answer: it depends only on your runs, never on what is selected right now
    const last = log[log.length - 1], ld = idx(DIFFICULTIES, last.d, 'rookie'), lp = idx(PACES, last.p, 'normal');
    const clampI = (v, c, n) => Math.max(0, Math.min(n - 1, Math.max(c - 3, Math.min(c + 3, Math.round(v))))); // within 3 steps of your last run
    const di = clampI(med(dE), ld, DIFFICULTIES.length), pi = clampI(med(pE), lp, PACES.length);
    const dir = di + pi > dc + pc ? 'harder' : di + pi < dc + pc ? 'easier' : 'keep';
    const why = `Based on your last ${log.length} runs (typical: ${fmtTime(Math.round(log.map((r) => r.t).sort((a, b) => a - b)[log.length >> 1]))}) → ${dir}`;
    return { d: DIFFICULTIES[di], p: PACES[pi], a: 0, n: log.length, why };
  },
  label() { const s = this.get(); return s ? `✨ Suggested: ${s.d.icon} ${s.d.name} – ${s.p.icon} ${s.p.name}${s.a ? ' – Ascension ' + s.a : ''}` : '✨ Suggested: play a run first'; },
  apply() {
    const s = this.get(); if (!s) return;
    Save.data.diff = s.d.id; Save.data.pace = s.p.id; Save.data.asc = 0; Save.save(); Sfx.init(); Sfx.play('quest');
    if (typeof diffTitle === 'function') diffTitle();
    if ($('setup') && $('setup').classList.contains('show')) buildSetup();
    this.refresh();
  },
  // three options side by side, from the same model as the survival heatmap (it learns from your runs)
  OPTS: [['comfy', '🟢', 'Comfortable', 0.75], ['bal', '🟡', 'Balanced', 0.5], ['chal', '🔴', 'Challenge', 0.25]],
  options() {
    if (typeof survivalPct !== 'function') return null;
    const S = Save.data, idx = (arr, id, def) => Math.max(0, arr.findIndex((x) => x.id === (id || def)));
    const log = (S.runLog || []).filter((r) => !(r.q && r.t < 120)), last = log[log.length - 1];
    const ad = idx(DIFFICULTIES, last ? last.d : S.diff, 'rookie'), ap = idx(PACES, last ? last.p : S.pace, 'normal'); // anchor: your last run, so the picks stay stable
    const cells = []; DIFFICULTIES.forEach((d, i) => PACES.forEach((p, j) => cells.push({ d, p, i, j, v: survivalPct(d.id, p.id) })));
    // closest chance to the target, staying near what you played last (pace changes count a bit more than difficulty
    // changes), and three different picks even when nothing reaches the target
    const used = new Set();
    return this.OPTS.map(([id, ic, nm, tg]) => {
      let best = null, bs = 1e9;
      for (const c of cells) { if (used.has(c)) continue; const sc = Math.abs(c.v - tg) + 0.025 * Math.abs(c.i - ad) + 0.06 * Math.abs(c.j - ap); if (sc < bs) { bs = sc; best = c; } }
      used.add(best);
      return { id, ic, nm, tg, d: best.d, p: best.p, v: best.v };
    });
  },
  pick(o) {
    Save.data.diff = o.d.id; Save.data.pace = o.p.id; Save.data.asc = 0; Save.save(); Sfx.init(); Sfx.play('quest');
    if ($('dtDiff')) $('dtDiff').value = o.d.id; if ($('dtPace')) $('dtPace').value = o.p.id;
    if (typeof diffTitle === 'function') diffTitle();
    if ($('setup') && $('setup').classList.contains('show')) buildSetup();
    this.refresh();
  },
  refresh() {
    const os = this.options(), S = Save.data, sk = typeof heatSkill === 'function' ? heatSkill() : null;
    for (const box of document.querySelectorAll('.suggestBtn')) {
      box.innerHTML = '';
      if (!os) continue;
      const row = document.createElement('div'); row.className = 'sug3';
      for (const o of os) {
        const b = document.createElement('button'); b.className = 'sugOpt ' + o.id + (S.diff === o.d.id && (S.pace || 'normal') === o.p.id ? ' on' : '');
        b.innerHTML = `<b>${o.ic} ${o.nm}</b><span>${o.d.icon} ${o.d.name}</span><span>${o.p.icon} ${o.p.name}</span><em>${Math.round(o.v * 100)}% to reach 15:00</em>`;
        b.onclick = (e) => { e.stopPropagation(); this.pick(o); };
        row.appendChild(b);
      }
      const sm = document.createElement('small'); sm.textContent = sk ? `✨ Suggested from your last ${sk.n} runs` : '✨ Suggested for a new stalker · play runs to personalize';
      box.append(sm, row);
    }
  },
  button() { const b = document.createElement('div'); b.className = 'suggestBtn'; return b; },
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

// ----- the same Difficulty – Pace picker in every menu (Settings, pause menu, co-op lobby) -----
function diffPacePicker(id) {
  const w = document.createElement('div'); w.className = 'dpPick'; w.id = id;
  w.innerHTML = `<label>Difficulty <select class="dpD"></select></label><span class="dash">–</span><label>Pace <select class="dpP"></select></label>`;
  const fill = () => {
    const S = Save.data; if (!S) return;
    w.querySelector('.dpD').innerHTML = DIFFICULTIES.map((d) => `<option value="${d.id}" ${d.id === (S.diff || 'rookie') ? 'selected' : ''}>${d.icon} ${d.name}</option>`).join('');
    w.querySelector('.dpP').innerHTML = PACES.map((p) => `<option value="${p.id}" ${p.id === (S.pace || 'normal') ? 'selected' : ''}>${p.icon} ${p.name}</option>`).join('');
  };
  const sync = () => { fill(); if (typeof diffTitle === 'function') diffTitle(); if ($('setup') && $('setup').classList.contains('show')) buildSetup(); Suggest.refresh(); for (const o of document.querySelectorAll('.dpPick')) if (o !== w && o._fill) o._fill(); };
  w.querySelector('.dpD').onchange = (e) => { Save.data.diff = e.target.value; Save.save(); if (CO && CO.role === 'host' && CO.settings && $('coDiff')) { CO.settings.diff = e.target.value; $('coDiff').value = e.target.value; $('coDiff').onchange && $('coDiff').onchange(); } sync(); };
  w.querySelector('.dpP').onchange = (e) => { Save.data.pace = e.target.value; Save.save(); sync(); };
  w._fill = fill; fill(); return w;
}
addEventListener('DOMContentLoaded', () => {
  const _bs3 = buildSettings; buildSettings = function (...a) { const r = _bs3(...a); const body = $('settingsBody'); if (body && !$('dpSettings')) body.prepend(diffPacePicker('dpSettings')); else if ($('dpSettings')) $('dpSettings')._fill(); return r; };
  const pz = $('pause'); if (pz) { const act = pz.querySelector('.actions'); const pk = diffPacePicker('dpPause'); const note = document.createElement('small'); note.className = 'dim dpNote'; note.textContent = 'Applies from your next run.'; if (act) { act.before(pk); pk.after(note); } }
  const _tp = togglePause; togglePause = function (...a) { const r = _tp(...a); if ($('dpPause')) $('dpPause')._fill(); return r; };
  const _cl = coLobbyUI; coLobbyUI = function (...a) { const r = _cl(...a); const box = $('coSetEdit') || $('coLobby'); if (box && !$('dpCoop')) box.appendChild(diffPacePicker('dpCoop')); else if ($('dpCoop')) $('dpCoop')._fill(); return r; };
});
