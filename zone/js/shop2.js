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

// ----- casino: slots, double-or-nothing, crash -----
const Casino = {
  bets() { const R = Save.data.rubles; return [['10%', Math.floor(R * 0.1)], ['50%', Math.floor(R * 0.5)], ['ALL IN', R]].filter((b) => b[1] > 0); },
  pay(d) { Save.data.rubles = Math.max(0, Save.data.rubles + d); Save.save(); menuRubles(); },
  html() {
    const bet = (g) => this.bets().map(([n, v]) => `<button class="big ghost small" data-cas="${g}" data-v="${v}">${n} · ${v} ₽</button>`).join('') || '<small class="dim">No rubles to bet.</small>';
    return `<div class="sect">🎰 SLOTS · three of a kind pays big</div><div class="casino"><div id="slotReels">🍒 🍋 ☢️</div><div class="casBets">${bet('slots')}</div><div id="slotRes" class="casRes"></div></div>
      <div class="sect">🪙 DOUBLE OR NOTHING · climb the ladder, cash out any time</div><div class="casino"><div id="coinState" class="casRes">Pick a bet to start.</div><div class="casBets" id="coinBets">${bet('coin')}</div><div class="casBets"><button class="big small" id="coinFlip" disabled>🪙 FLIP (×2)</button><button class="big ghost small" id="coinCash" disabled>💰 CASH OUT</button></div></div>
      <div class="sect">📈 CRASH · cash out before it crashes</div><div class="casino"><div id="crashM">×1.00</div><div class="casBets" id="crashBets">${bet('crash')}</div><div class="casBets"><button class="big small" id="crashCash" disabled>💰 CASH OUT</button></div><div id="crashRes" class="casRes"></div></div>
      <div class="sect">🌟 MASTERY EXCHANGE · turn rubles into Mastery XP (2 ₽ = 1 XP)</div><div class="casino"><div class="casBets">${bet('xp')}</div><div id="xpRes" class="casRes"></div></div>`;
  },
  bind(el) {
    const re = () => { const x = el.querySelector('.casWrap'); if (x) { x.innerHTML = this.html(); this.bind(el); } };
    for (const b of el.querySelectorAll('[data-cas]')) b.onclick = () => {
      const v = +b.dataset.v, g = b.dataset.cas; if (v <= 0 || Save.data.rubles < v || this.busy) return; Sfx.init();
      if (g === 'slots') {
        this.pay(-v); this.busy = true; const sym = ['🍒', '🍋', '☢️', '💎', '🔔', '7️⃣'], R = $('slotReels'); let n = 0;
        const iv = setInterval(() => { R.textContent = [0, 1, 2].map(() => pick(sym)).join(' '); Sfx.play('beep'); if (++n > 12) { clearInterval(iv); const r = [pick(sym), pick(sym), pick(sym)]; if (Math.random() < 0.08) r[1] = r[2] = r[0]; else if (Math.random() < 0.25) r[1] = r[0]; R.textContent = r.join(' ');
          const three = r[0] === r[1] && r[1] === r[2], two = r[0] === r[1] || r[1] === r[2] || r[0] === r[2];
          const mult = three ? (r[0] === '7️⃣' ? 20 : r[0] === '💎' ? 12 : 6) : two ? 1.5 : 0, win = Math.floor(v * mult);
          this.pay(win); $('slotRes').textContent = win ? `WIN ${win} ₽ (×${mult})` : 'No luck.'; Sfx.play(win ? 'stash' : 'hit'); this.busy = false; setTimeout(re, 1400); } }, 70);
      } else if (g === 'coin') {
        this.pay(-v); this.coin = v; $('coinState').textContent = `On the table: ${v} ₽`; $('coinFlip').disabled = false; $('coinCash').disabled = false; for (const x of el.querySelectorAll('#coinBets button')) x.disabled = true;
      } else if (g === 'crash') {
        this.pay(-v); this.busy = true; let m = 1; const crashAt = Math.max(1, 0.97 / (1 - Math.random())), cash = $('crashCash'); cash.disabled = false;
        const iv = setInterval(() => { m *= 1.025; $('crashM').textContent = '×' + m.toFixed(2); if (m >= crashAt) { clearInterval(iv); $('crashM').textContent = '💥 CRASHED at ×' + crashAt.toFixed(2); cash.disabled = true; Sfx.play('boom'); this.busy = false; setTimeout(re, 1500); } }, 90);
        cash.onclick = () => { clearInterval(iv); const win = Math.floor(v * m); this.pay(win); $('crashRes').textContent = `Cashed out ${win} ₽ at ×${m.toFixed(2)}`; cash.disabled = true; Sfx.play('stash'); this.busy = false; setTimeout(re, 1400); };
      } else if (g === 'xp') {
        this.pay(-v); const ups = Mastery.gain(v / 2); $('xpRes').textContent = `+${Math.floor(v / 2)} Mastery XP` + (ups ? ` · +${ups} Mastery level${ups > 1 ? 's' : ''}!` : ''); Sfx.play('quest'); setTimeout(re, 1200);
      }
    };
    const flip = $('coinFlip'), cashC = $('coinCash');
    if (flip) flip.onclick = () => { if (!this.coin) return; if (Math.random() < 0.5) { this.coin *= 2; $('coinState').textContent = `Heads! On the table: ${this.coin} ₽`; Sfx.play('coin'); } else { $('coinState').textContent = 'Tails. You lost it all.'; this.coin = 0; Sfx.play('hit'); setTimeout(re, 1400); } };
    if (cashC) cashC.onclick = () => { if (!this.coin) return; this.pay(this.coin); $('coinState').textContent = `Cashed out ${this.coin} ₽`; this.coin = 0; Sfx.play('stash'); setTimeout(re, 1200); };
  },
};

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
  // casino games and the Mastery exchange under the roulette wheel
  const _rou = BunkerUI.rou;
  BunkerUI.rou = function (el) { _rou.call(this, el); const w = document.createElement('div'); w.className = 'casWrap'; w.innerHTML = Casino.html(); el.appendChild(w); Casino.bind(el); };
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
