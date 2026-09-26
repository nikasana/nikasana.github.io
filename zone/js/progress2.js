'use strict';
// ---------- long-term progression: endless Mastery tree, Ascension levels, Apex bosses, and charts ----------

// ----- Mastery: every run earns XP; every level gives a point; ranks never end (costs grow slowly) -----
const MASTERY = [
  ['dmg', '🎯', 'Firepower', '+1% damage per rank', (P, r) => { P.dmgMul += 0.01 * r; }],
  ['hp', '❤️', 'Vitality', '+1% max HP per rank', (P, r) => { const m = 1 + 0.01 * r; P.maxhp *= m; P.hp *= m; }],
  ['spd', '👟', 'Stride', '+0.5% speed per rank', (P, r) => { P.spdMul += 0.005 * r; }],
  ['xp', '📚', 'Insight', '+1% experience per rank', (P, r) => { P.xpMul += 0.01 * r; }],
  ['rub', '💰', 'Greed', '+1% rubles per rank', (P, r) => { G.rubBonus = (G.rubBonus || 1) + 0.01 * r; }],
  ['area', '💥', 'Reach', '+0.5% area of effect per rank', (P, r) => { P.areaMul += 0.005 * r; }],
  ['luck', '🍀', 'Fortune', '+1 luck every 10 ranks', (P, r) => { P.luck += Math.floor(r / 10); }],
];
const Mastery = {
  d() { const S = Save.data; S.mastery = S.mastery || { xp: 0, lvl: 0, pts: 0, ranks: {} }; return S.mastery; },
  need(l) { return 600 + l * 180; },
  cost(r) { return 1 + Math.floor(r / 10); },
  gain(xp) { const m = this.d(); m.xp += Math.round(xp); let ups = 0; while (m.xp >= this.need(m.lvl)) { m.xp -= this.need(m.lvl); m.lvl++; m.pts++; ups++; } Save.save(); return ups; },
  buy(id) { const m = this.d(), r = m.ranks[id] || 0, c = this.cost(r); if (m.pts < c) return false; m.pts -= c; m.ranks[id] = r + 1; Save.save(); return true; },
  apply() { const m = this.d(); for (const [id, , , , f] of MASTERY) { const r = m.ranks[id] || 0; if (r) f(P, r); } },
};

// ----- Ascension: an endless dial on top of difficulty and pace -----
function ascLevel() { return Math.max(0, Save.data.asc | 0); }

// ----- Apex bosses: kill enough of a mutant and its Apex version starts hunting you -----
const APEX_KILLS = 150;
function apexUnlocked() { const S = Save.data; return Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss && (S.seen && S.seen.m && S.seen.m[id] || 0) >= APEX_KILLS); }

// ----- run hooks -----
const _p2New = newGame;
newGame = function (...a) {
  _p2New(...a);
  if (!G || G.title) return;
  G.series = []; G.serT = 0; G.apexT = 200; G.asc = G.tutorial ? 0 : ascLevel();
  if (!G.tutorial) Mastery.apply();
  if (G.asc) { G.rubBonus = (G.rubBonus || 1) + 0.1 * G.asc; }
};
if (typeof RunSave !== 'undefined' && RunSave.GKEYS) RunSave.GKEYS.push('asc');
const _p2Spawn = spawnEnemy;
spawnEnemy = function (id, x, y, o) {
  const e = _p2Spawn(id, x, y, o);
  if (e && G && G.asc && !G.coGuest) { e.hp *= 1 + 0.2 * G.asc; e.maxhp *= 1 + 0.2 * G.asc; e.dmg *= 1 + 0.15 * G.asc; }
  return e;
};
const _p2Kill = killEnemy;
killEnemy = function (e, ...a) {
  const was = e && e.dead, r = _p2Kill(e, ...a);
  if (e && !was && e.dead && e.apex && G && !G.coGuest) { G.rubles += 300; G.pickups.push({ type: 'art', x: e.x, y: e.y, t: 0 }); banner('👑 APEX SLAIN', '+300 ₽ and an artifact.', 3, 'good'); const S = Save.data; S.apexKills = S.apexKills || {}; S.apexKills[e.id] = (S.apexKills[e.id] || 0) + 1; }
  return r;
};
const _p2Up = W2.update.bind(W2);
W2.update = function (dt) {
  _p2Up(dt);
  if (!G || G.title || G.state !== 'play' || !G.series) return;
  G.serT -= dt;
  if (G.serT <= 0) { G.serT = 5; G.series.push([Math.round(G.t), Math.round(100 * Math.max(0, P.hp) / (P.maxhp || 1)), G.kills, G.level]); if (G.series.length > 400) G.series.splice(0, 2); }
  // an unlocked Apex boss shows up every few minutes
  if (!G.coGuest && !G.tutorial && World.kind === 'over') {
    G.apexT -= dt;
    const list = G.apexT <= 0 ? apexUnlocked() : [];
    if (G.apexT <= 0) {
      G.apexT = rand(210, 300);
      if (list.length) { const id = pick(list), p = ringPos(); if (p) { const e = _p2Spawn(id, p[0], p[1], { noElite: true }); if (e) { e.apex = true; e.hp *= 25; e.maxhp *= 25; e.dmg *= 2; e.sc = (e.sc || 1) * 1.9; e.r *= 1.9; e.name = 'APEX ' + ENEMIES[id].name.toUpperCase(); banner('👑 ' + e.name, 'An Apex mutant hunts you. Big reward if you bring it down.', 3.5, 'bad', 2); } } }
    }
  }
};

// ----- charts (small SVG line charts) -----
function chartSVG(pts, o = {}) {
  const W = o.w || 300, H = o.h || 90, pad = 22, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (pts.length < 2) return `<div class="chart"><b>${o.title}</b><small class="dim">not enough data yet</small></div>`;
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || 1, y0 = o.min ?? Math.min(...ys), y1 = Math.max(o.max ?? Math.max(...ys), y0 + 1);
  const X = (x) => pad + ((x - x0) / Math.max(1, x1 - x0)) * (W - pad - 6), Y = (y) => H - 14 - ((y - y0) / (y1 - y0)) * (H - 24);
  const line = pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
  const area = `${X(x0)},${Y(y0)} ${line} ${X(x1)},${Y(y0)}`;
  const c = o.color || '#c8e060';
  return `<div class="chart"><b>${o.title}</b><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon points="${area}" fill="${c}" opacity="0.12"/><polyline points="${line}" fill="none" stroke="${c}" stroke-width="2"/>
    <text x="2" y="${Y(y1) + 4}" class="ax">${o.fmtY ? o.fmtY(y1) : Math.round(y1)}</text><text x="2" y="${Y(y0)}" class="ax">${o.fmtY ? o.fmtY(y0) : Math.round(y0)}</text>
    <text x="${pad}" y="${H - 2}" class="ax">${o.fmtX ? o.fmtX(x0) : x0}</text><text x="${W - 4}" y="${H - 2}" class="ax" text-anchor="end">${o.fmtX ? o.fmtX(x1) : x1}</text></svg></div>`;
}
const fmtMin = (s) => fmtTime(s);
function runCharts(ser) {
  if (!ser || ser.length < 2) return '';
  return `<div class="charts">${chartSVG(ser.map((r) => [r[0], r[1]]), { title: '❤️ Health over time', min: 0, max: 100, color: '#ff6a5a', fmtX: fmtMin, fmtY: (v) => v + '%' })}${chartSVG(ser.map((r) => [r[0], r[2]]), { title: '💀 Kills over time', min: 0, color: '#c8e060', fmtX: fmtMin })}${chartSVG(ser.map((r) => [r[0], r[3]]), { title: '⭐ Level over time', min: 1, color: '#7fc8ff', fmtX: fmtMin })}</div>`;
}

// ----- end of run: mastery XP, apex unlocks, charts -----
addEventListener('DOMContentLoaded', () => {
  const _er = endRun;
  endRun = function (kind, src) {
    const was = G && G.ended, r = _er(kind, src);
    if (was || !G || G.title || G.tutorial) return r;
    const S = Save.data, before = apexUnlocked().length;
    const xp = G.kills * (1 + 0.1 * (G.asc || 0)) + G.t / 3 + (kind === 'win' ? 600 : 0) + (G.asc || 0) * 50;
    const ups = Mastery.gain(xp);
    S.lastSeries = G.series || []; Save.save();
    const nowApex = apexUnlocked();
    const st = $('stats');
    if (st) {
      document.querySelectorAll('.p2End').forEach((e) => e.remove());
      const d = document.createElement('div'); d.className = 'p2End';
      d.innerHTML = `<div class="records">📈 +${Math.round(xp)} Mastery XP${ups ? ' · MASTERY LEVEL UP! (' + Mastery.d().lvl + ')' : ''}</div>` + (nowApex.length > before ? `<div class="records">👑 New Apex boss unlocked: ${ENEMIES[nowApex[nowApex.length - 1]].name}</div>` : '') + runCharts(G.series);
      st.after(d);
    }
    return r;
  };

  // ----- Bunker: Mastery and Stats tabs -----
  const bar = $('bTabs'), body = $('bunker2');
  if (bar && body) {
    const tab = (id, name, fn) => {
      const b = document.createElement('button'); b.className = 'tab'; b.dataset.bt2 = id; b.textContent = name;
      b.onclick = () => { const cx = document.querySelector('[data-bt="codex"]'); if (cx) cx.click(); for (const x of bar.children) x.classList.remove('sel'); b.classList.add('sel'); fn(body); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(body); } catch (e) { /* keep english */ } };
      bar.appendChild(b);
    };
    tab('mast', '🌟 Mastery', function build(el) {
      const m = Mastery.d(), need = Mastery.need(m.lvl);
      el.innerHTML = `<div class="sect">MASTERY · endless upgrades from every run</div><div class="hqTop"><b>LV ${m.lvl}</b><i class="bar"><i style="width:${Math.min(100, (m.xp / need) * 100)}%"></i></i><span>${m.xp}/${need} XP</span><span>🌟 ${m.pts} points</span></div>
        <div class="tree">${MASTERY.map(([id, ic, nm, ds]) => { const r = m.ranks[id] || 0, c = Mastery.cost(r); return `<button class="tnode ${m.pts >= c ? 'open' : ''}" data-mbuy="${id}"><span class="tic">${ic}</span><span><b>${nm} · ${r}</b><small>${ds}</small><em><span class="${m.pts >= c ? 'afford' : 'poor'}">🌟 ${c}</span></em></span></button>`; }).join('')}</div>
        <div class="sect">APEX BOSSES · kill ${APEX_KILLS} of a mutant to unlock its Apex</div><div class="codex">${Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss).map((id) => { const k = (Save.data.seen && Save.data.seen.m && Save.data.seen.m[id]) || 0, on = k >= APEX_KILLS; return `<div class="cx ${on ? '' : 'un'}"><b>${on ? '👑 ' : ''}${ENEMIES[id].name}</b><small>${on ? 'unlocked · slain ' + ((Save.data.apexKills || {})[id] || 0) : Math.min(k, APEX_KILLS) + '/' + APEX_KILLS}</small></div>`; }).join('')}</div>`;
      for (const b of el.querySelectorAll('[data-mbuy]')) b.onclick = () => { if (Mastery.buy(b.dataset.mbuy)) { Sfx.init(); Sfx.play('quest'); } build(el); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(el); } catch (e) { /* keep english */ } };
    });
    tab('stats', '📈 Stats', (el) => {
      const S = Save.data, log = (S.runLog || []).slice(-30), T = S.totals || {};
      const idx = log.map((r, i) => i + 1);
      el.innerHTML = `<div class="sect">LIFETIME</div><div class="hqStats"><div><b>${(S.runLog || []).length}</b>runs</div><div><b>${S.wins || 0}</b>wins</div><div><b>${T.kills || 0}</b>kills</div><div><b>${Mastery.d().lvl}</b>mastery</div></div>
        <div class="sect">YOUR LAST RUN</div>${runCharts(S.lastSeries) || '<p class="dim">Play a run to see its charts.</p>'}
        <div class="sect">TRENDS · last ${log.length} runs</div><div class="charts">
        ${chartSVG(log.map((r, i) => [idx[i], r.t]), { title: '⏱️ Time survived', min: 0, color: '#c8e060', fmtY: fmtMin })}
        ${chartSVG(log.filter((r) => r.hp !== undefined).map((r, i) => [i + 1, Math.round(r.hp * 100)]), { title: '❤️ Average health', min: 0, max: 100, color: '#ff6a5a', fmtY: (v) => v + '%' })}
        ${chartSVG(log.map((r, i) => [idx[i], Math.round(Suggest.stress(r) * 100)]), { title: '🔥 Challenge (aim 55%)', min: 0, max: 100, color: '#ffb04a', fmtY: (v) => v + '%' })}</div>`;
    });
  }

  // ----- main menu: Ascension next to difficulty and pace -----
  const row = $('diffPaceRow');
  if (row) {
    const a = document.createElement('label'); a.id = 'ascRow'; a.innerHTML = 'Ascension <button id="ascM">−</button><b id="ascV"></b><button id="ascP">+</button>';
    row.appendChild(a);
    const upd = () => { const v = ascLevel(); $('ascV').textContent = v; a.title = v ? `+${v * 20}% mutant HP, +${v * 15}% damage, +${v * 10}% rubles` : 'Endless extra difficulty on top of everything'; };
    $('ascM').onclick = () => { Save.data.asc = Math.max(0, ascLevel() - 1); Save.save(); upd(); };
    $('ascP').onclick = () => { Save.data.asc = ascLevel() + 1; Save.save(); upd(); };
    upd();
  }
});
