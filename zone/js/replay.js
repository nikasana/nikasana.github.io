'use strict';
// ---------- replayability: a Zone omen twists every run, a free starting pick, and personal records ----------

// omens are mild on purpose: one small twist and one small reward, picked from the run's seed (so co-op agrees)
const OMENS = [
  { id: 'redsky', icon: '🌅', name: 'Red Sky', desc: 'More mutants roam. Rubles ×1.3.', spawn: 1.25, rub: 0.3 },
  { id: 'quiet', icon: '🍃', name: 'Quiet Day', desc: 'Fewer mutants early on. Take a breath.', spawn: 0.8 },
  { id: 'goldrush', icon: '💰', name: 'Gold Rush', desc: 'Rubles ×1.5, but mutants are a bit more numerous.', spawn: 1.1, rub: 0.5 },
  { id: 'artstorm', icon: '💎', name: 'Artifact Storm', desc: 'Detector reaches 50% further. +1 luck.', apply(P) { P.detect *= 1.5; P.luck += 1; } },
  { id: 'adrenaline', icon: '⚡', name: 'Adrenaline', desc: '+12% speed, but you take 8% more damage.', apply(P) { P.spdMul += 0.12; P.dr -= 0.08; } },
  { id: 'sharp', icon: '🗡️', name: 'Sharp Blades', desc: '+20% damage, -15 max HP.', apply(P) { P.dmgMul += 0.2; P.maxhp = Math.max(40, P.maxhp - 15); P.hp = Math.min(P.hp, P.maxhp); } },
  { id: 'cleanair', icon: '💚', name: 'Clean Air', desc: '+0.6 HP regeneration per second.', apply(P) { P.regen += 0.6; } },
  { id: 'fog', icon: '🌫️', name: 'Endless Fog', desc: 'Fog rolls in often. +1 luck for the trouble.', weather: { fog: 5 }, apply(P) { P.luck += 1; } },
  { id: 'fastlearn', icon: '📚', name: 'Fast Learner', desc: '+25% experience.', xp: 1.25 },
  { id: 'scavenger', icon: '📦', name: 'Scavenger', desc: 'Mutants drop medkits and items 60% more often.', apply(P) { P.dropMul *= 1.6; } },
  { id: 'veteran', icon: '🎖️', name: 'Veteran\'s Start', desc: 'Begin the run with one extra upgrade.', lv: 1 },
  { id: 'storm', icon: '⛈️', name: 'Storm Season', desc: 'Storms and psi weather are common. +15% experience.', weather: { storm: 3, psi: 2, rain: 2 }, xp: 1.15 },
];
const Omen = {
  cur: null,
  roll(seed) { const R = mulberry32(((seed | 0) ^ 0x5bd1e995) + 777); return OMENS[Math.floor(R() * OMENS.length)]; },
  start() {
    this.cur = null;
    if (!G || G.tutorial || G.mode2 === 'tutorial' || Save.set.omens === false) { this.tag(); return; }
    const o = this.roll(World.seed); this.cur = o; G.omen = o.id;
    if (o.apply) o.apply(P);
    if (o.rub) G.rubBonus = (G.rubBonus || 1) + o.rub;
    if (o.lv) G.pendingLv += o.lv;
    if (o.weather) World.seasonW = Object.assign({}, World.seasonW || {}, Object.fromEntries(Object.entries(o.weather).map(([k, v]) => [k, v * ((World.seasonW || {})[k] ?? 1)])));
    G.timers.push({ t: 3.2, fn: () => banner(o.icon + ' ' + o.name.toUpperCase(), 'Omen of this run: ' + o.desc, 3.5, '') });
    this.tag();
  },
  tag() {
    let el = $('omenTag'); if (!el) { el = document.createElement('div'); el.id = 'omenTag'; const tm = $('topMid'); if (tm) tm.after(el); else document.body.appendChild(el); }
    const o = this.cur; el.style.display = o && G && !G.title ? '' : 'none';
    if (o) { el.textContent = o.icon + ' ' + o.name; el.dataset.tip = o.desc; el.title = o.desc; }
  },
};
const _omMods = Events.mods.bind(Events);
Events.mods = function () {
  const m = _omMods(), o = Omen.cur; if (!o || !G) return m;
  if (o.spawn) m.spawn *= o.id === 'quiet' ? (G.t < 300 ? o.spawn : 1) : o.spawn;
  if (o.xp) m.xp *= o.xp;
  return m;
};

// personal records per stage: beating one feels good and gives the next run a target
function recordsCheck() {
  const S = Save.data; S.records = S.records || {};
  const k = G.stage, r = S.records[k] = S.records[k] || {}, out = [];
  for (const [f, v, label] of [['kills', G.kills, 'kills'], ['level', G.level, 'level'], ['arts', G.arts, 'artifacts'], ['t', Math.floor(G.t), 'time']]) {
    if (v > (r[f] || 0)) { if (r[f]) out.push(label === 'time' ? '🏅 New best time here: ' + fmtTime(v) : '🏅 New record: ' + v + ' ' + label); r[f] = v; }
  }
  return out;
}

const _omNew = newGame;
newGame = function (...a) { _omNew(...a); Omen.start(); };
addEventListener('DOMContentLoaded', () => {
  if (Save.set && Save.set.omens === undefined) Save.set.omens = true;
  const _er = endRun;
  endRun = function (kind, src) {
    const was = G && G.ended, r = _er(kind, src);
    document.querySelectorAll('.records').forEach((e) => e.remove());
    if (!was && G && !G.tutorial && kind !== 'quit') {
      const lines = recordsCheck(); Save.save();
      const st = $('stats');
      if (lines.length && st) { const d = document.createElement('div'); d.className = 'records'; d.innerHTML = lines.map((l) => `<div>${l}</div>`).join(''); st.after(d); }
      if (Omen.cur && st) { const d = document.createElement('div'); d.className = 'records omen'; d.textContent = 'Omen: ' + Omen.cur.icon + ' ' + Omen.cur.name; st.after(d); }
    }
    const t = $('omenTag'); if (t) t.style.display = 'none';
    return r;
  };
  const _tm = toMenu;
  toMenu = function (...a) { const r = _tm(...a); const t = $('omenTag'); if (t) t.style.display = 'none'; return r; };
});

// ----- self-update: an old cached copy notices the newer version and reloads itself while you are on the menu -----
const Updater = {
  newer: 0,
  check() { fetch('version.txt?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).then((t) => { const v = parseInt(t, 10); if (v > ZB_BUILD) { this.newer = v; this.apply(); } }).catch(() => { /* offline */ }); },
  idle() { return (!G || G.title) && !CO.role; },
  apply() {
    if (!this.newer) return;
    let tried = null; try { tried = sessionStorage.getItem('zb_upd'); } catch (e) { /* storage blocked */ }
    if (this.idle() && tried !== String(this.newer)) {
      try { sessionStorage.setItem('zb_upd', String(this.newer)); } catch (e) { /* storage blocked */ }
      const q = new URLSearchParams(location.search); q.set('u', this.newer); location.replace(location.pathname + '?' + q.toString());
    } else if (!this.told) { this.told = 1; let el = $('glitch'); if (!el) { el = document.createElement('div'); el.id = 'glitch'; document.body.appendChild(el); } { el.textContent = '🔄 A new version of the game is out — it installs when you return to the menu.'; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 6000); } }
  },
};
addEventListener('load', () => { setTimeout(() => Updater.check(), 1500); setInterval(() => Updater.check(), 4 * 60 * 1000); });
addEventListener('DOMContentLoaded', () => { const _tm2 = toMenu; toMenu = function (...a) { const r = _tm2(...a); setTimeout(() => Updater.apply(), 500); return r; }; });
