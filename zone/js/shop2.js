'use strict';
// ---------- money sinks and extras: endless upgrade tiers, Mastery exchange, casino games, infographics ----------
const TIER_ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const tierName = (n) => TIER_ROMAN[n] || String(n + 1);

// ----- endless tiers for maxed upgrades and skills -----
function metaTierCost(m, lv) { return Math.round(metaCost(m, m.max - 1) * Math.pow(1.6, lv - m.max + 1)); }
function skillTierCost(l) { return Math.round(400 * Math.pow(1.7, l - 5)); }

// ----- infographics helpers -----
function ringSVG(pct, label, color) {
  const r = 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
  return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="rbg"/><circle cx="32" cy="32" r="${r}" stroke="${color}" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)" class="rfg"/><text x="32" y="36" text-anchor="middle">${Math.round(v * 100)}%</text></svg><small>${label}</small></div>`;
}
function progressRings() {
  const S = Save.data, ens = Object.keys(ENEMIES), arts = typeof ALL_ARTS !== 'undefined' ? ALL_ARTS : Object.keys(ARTIFACTS);
  const codex = ((ens.filter((id) => S.seen && S.seen.m[id]).length + arts.filter((id) => S.seen && S.seen.a[id]).length) / (ens.length + arts.length)) || 0;
  return ringSVG(codex, '📖 Codex', '#7fc8ff') + ringSVG((S.ach || []).length / ACHIEVEMENTS.length, '🏆 Achievements', '#ffcf6a') + ringSVG((S.stages || []).length / STAGES.length, '🗺️ Maps', '#c8e060') + ringSVG(Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss && ((S.seen && S.seen.m[id]) || 0) >= 150).length / Object.keys(ENEMIES).filter((id) => !ENEMIES[id].boss).length, '👑 Apex', '#ff5ce6');
}
function wealthSpark() { const w = (Save.data.wealth || []).slice(-30); return w.length > 1 && typeof chartSVG === 'function' ? chartSVG(w.map((v, i) => [i + 1, v]), { title: '💰 Rubles after each run', min: 0, color: '#ffcf6a', h: 60 }) : ''; }

addEventListener('DOMContentLoaded', () => {
  // endless tiers on the Upgrades screen
  const _bb = buildBunker;
  buildBunker = function (...a) {
    const r = _bb(...a), S = Save.data;
    for (const card of document.querySelectorAll('#metaList .meta')) {
      const b = card.querySelector('[data-meta]'); if (!b) continue;
      const m = META.find((x) => x.id === b.dataset.meta), lv = Save.meta(m.id); if (lv < m.max) continue;
      const cost = metaTierCost(m, lv), t = document.createElement('button'); t.className = 'buy tierBtn'; t.dataset.tier = m.id;
      t.innerHTML = `⬆ TIER ${tierName(lv - m.max + 1)}<br>${cost} ₽`; t.classList.toggle('poor', S.rubles < cost);
      b.replaceWith(t);
      t.onclick = () => { if (S.rubles < cost) { t.classList.add('shake'); setTimeout(() => t.classList.remove('shake'), 400); return; } S.rubles -= cost; S.meta[m.id] = lv + 1; Save.save(); Sfx.init(); Sfx.play('quest'); buildBunker(); menuRubles(); };
    }
    return r;
  };
  // endless tiers on the Skills screen (after 5 points, rubles buy more levels)
  const _sk = BunkerUI.sk;
  BunkerUI.sk = function (el) {
    _sk.call(this, el); const S = Save.data;
    for (const b of el.querySelectorAll('[data-sk]')) {
      const id = b.dataset.sk, l = S.skills[id] || 0; if (l < 5) continue;
      const cost = skillTierCost(l), em = b.querySelector('em'); if (em) em.innerHTML = `LV ${l} · <span class="${S.rubles >= cost ? 'afford' : 'poor'}">⬆ TIER ${tierName(l - 4)} · ${cost} ₽</span>`;
      b.onclick = () => { if (S.rubles < cost) return; S.rubles -= cost; S.skills[id] = l + 1; Save.save(); Sfx.init(); Sfx.play('quest'); menuRubles(); BunkerUI.sk(el); };
    }
  };
  // main menu: a profile card with progress rings and a wealth sparkline
  const title = $('title');
  if (title) {
    const card = document.createElement('div'); card.id = 'profileCard'; title.appendChild(card);
    const fill = () => { card.innerHTML = `<div class="rings">${progressRings()}</div>${wealthSpark()}`; };
    fill(); const _tm = toMenu; toMenu = function (...a) { const r = _tm(...a); fill(); return r; };
  }
  // stats tab gets the same rings and the wealth chart
  const statsBtn = document.querySelector('[data-bt2="stats"]');
  if (statsBtn) { const o = statsBtn.onclick; statsBtn.onclick = () => { o(); const body = $('bunker2'); if (body) body.insertAdjacentHTML('afterbegin', `<div class="sect">COMPLETION</div><div class="rings">${progressRings()}</div>${wealthSpark() ? '<div class="charts">' + wealthSpark() + '</div>' : ''}`); }; }
  // remember your rubles after every run for the wealth charts
  const _er = endRun;
  endRun = function (kind, src) { const was = G && G.ended, r = _er(kind, src); if (!was && G && !G.title && !G.tutorial) { const S = Save.data; S.wealth = (S.wealth || []).concat([S.rubles]).slice(-60); Save.save(); } return r; };
});
