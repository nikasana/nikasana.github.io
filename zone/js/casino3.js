'use strict';
// ---------- casino, part 3: loyalty points + points shop, VIP perks per rank, the vault, extra countdowns, break reminder ----------
const CZ_VIP_PERKS = [
  { loy: 1, cb: 0.1, jp: 0 },
  { loy: 1.1, cb: 0.12, jp: 0.005 },
  { loy: 1.25, cb: 0.15, jp: 0.01 },
  { loy: 1.5, cb: 0.18, jp: 0.015 },
  { loy: 2, cb: 0.22, jp: 0.02 },
  { loy: 3, cb: 0.3, jp: 0.03 },
];
const CZ_SHOP = [
  { ic: '💰', nm: '5,000 ₽', cost: 500, fn: (c) => { Save.data.rubles += 5000; } },
  { ic: '💰', nm: '30,000 ₽', cost: 2500, fn: (c) => { Save.data.rubles += 30000; } },
  { ic: '🎰', nm: 'Free Play Token', cost: 800, fn: (c) => { c.tokens = (c.tokens || 0) + 1; } },
  { ic: '🔐', nm: '+25% Vault Fill', cost: 1200, fn: (c) => { const v = CZ.vault(); v.fill = Math.min(100, v.fill + 25); if (v.fill >= 100) v.ready = true; } },
  { ic: '☢️', nm: '+2,000 Jackpot', cost: 1500, fn: (c) => { c.jp += 2000; } },
  { ic: '🍀', nm: 'Lucky Charm · 10 min', cost: 3000, fn: (c) => { CZ.charmUntil = Date.now() + 600000; } },
];
const CZ_VAULT_TIERS = [[0.5, 5], [0.3, 15], [0.15, 40], [0.05, 150]];
Object.assign(CZ, {
  vipPerk() { return CZ_VIP_PERKS[this.vip()]; },
  vault() { const c = this.st(); c.vault = c.vault || { fill: 0, ready: false }; return c.vault; },
  // ----- free rolls: an AUTO button at the top (below the game tabs, like the old free button) that
  // arms and fires in one click, and an ARM button next to each game's own action button — arm it,
  // place your own bet/pick like the old flow, then press the game's own (green) button yourself -----
  freeUses(g) { const c = this.st(), dailyLeft = c.free2 && c.free2[g || this.game] === Meta.dayKey() ? 0 : 1; return dailyLeft + (c.tokens || 0); },
  freeGameOk() { return this.game !== 'xch' && this.game !== 'vault' && this.game !== 'shop'; },
  autoFreeHtml() {
    if (!this.freeGameOk()) return ''; const n = this.freeUses(); if (n <= 0) return '';
    return `<button class="big quickFree pulse czAutoFree" data-qf="${this.game}">⚡ AUTO FREE ROLL (${n})</button>`;
  },
  armFreeHtml() {
    if (!this.freeGameOk()) return ''; const n = this.freeUses(); if (n <= 0) return '';
    const armed = !!this.freeArm;
    return `<button class="big ghost czArmFree ${armed ? 'armed' : ''}" data-af="${this.game}">${armed ? `🎁 ARMED — press play (${n})` : `🎁 SELECT FREE ROLL (${n})`}</button>`;
  },
  quickFree(g) {
    if (this.busy || this.freeUses(g) <= 0) return;
    this.bet = this.freeAmt(); this.freeArm = true;
    const click = (id) => { const el = $(id); if (el && !el.disabled) el.click(); else this.freeArm = false; };
    switch (g) {
      case 'rou': { const spot = document.querySelector('[data-rs="red"]'); if (spot) spot.click(); else this.freeArm = false; click('rSpin'); break; }
      case 'monty': { const d0 = document.querySelector('[data-d="0"]'); if (d0 && !d0.disabled) d0.click(); else this.freeArm = false; break; }
      case 'slots': click('slSpin'); break;
      case 'bj': click('bjDeal'); break;
      case 'plinko': click('pkDrop'); break;
      case 'crash': click('crGo'); break;
      case 'dice': click('dGo'); break;
      case 'coin': click('kGo'); break;
      case 'wheel': click('whGo'); break;
      case 'scratch': click('scBuy'); break;
      case 'race': click('raceGo'); break;
      case 'box': click('boxGo'); break;
      default: this.freeArm = false;
    }
  },
});
addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const qf = e.target.closest('.czAutoFree');
    if (qf) { if (qf.dataset.qf === CZ.game) CZ.quickFree(qf.dataset.qf); return; }
    const af = e.target.closest('.czArmFree');
    if (af && af.dataset.af === CZ.game && !CZ.busy) {
      if (!CZ.freeArm && CZ.freeUses() <= 0) return;
      CZ.freeArm = !CZ.freeArm; if (CZ.freeArm) CZ.bet = CZ.freeAmt();
      CZ.beep(1500, 0.08); CZ.top();
    }
  });
});
Object.assign(CZG, {
  vault(st) {
    const v = CZ.vault();
    st.insertAdjacentHTML('beforeend', `<div class="czVaultWrap"><div class="czVaultBar"><div class="czVaultFill" style="width:${v.fill}%"></div><b>${Math.floor(v.fill)}%</b></div><p class="dim">Every bet you place cracks the vault's lock a little more. Fill it to 100% to crack it open for a big reward.</p><div class="czAct"><button class="big" id="vCrack" ${v.ready ? '' : 'disabled'}>🔐 CRACK THE VAULT</button></div></div>`);
    $('vCrack').onclick = () => {
      if (!v.ready) return;
      let r = Math.random(), mult = CZ_VAULT_TIERS[0][1], acc = 0;
      for (const [p, m] of CZ_VAULT_TIERS) { acc += p; if (r <= acc) { mult = m; break; } }
      const stake = CZ.freeAmt(), win = Math.round(stake * mult);
      v.fill = 0; v.ready = false; Save.save();
      CZ.give(win, stake); CZ.fireworks(3); Sfx.play('legend');
      st.innerHTML = ''; CZG.vault(st); CZ.i18n(); CZ.res(st, `🔐 CRACKED! +${win} ₽ (×${mult})`, true);
    };
  },
  shop(st) {
    const c = CZ.st();
    st.insertAdjacentHTML('beforeend', `<p class="dim">Spend loyalty points — 1 point per 100 ₽ wagered.</p><div class="czShop">${CZ_SHOP.map((it, i) => `<button class="czShopIt ${c.loy >= it.cost ? '' : 'cant'}" data-si="${i}"><span>${it.ic}</span><b>${it.nm}</b><em>${it.cost} pts</em></button>`).join('')}</div>`);
    for (const b of st.querySelectorAll('[data-si]')) b.onclick = () => {
      const it = CZ_SHOP[+b.dataset.si]; if ((c.loy || 0) < it.cost) { CZ.shake(); return; }
      c.loy -= it.cost; it.fn(c); Save.save(); CZ.top(); Sfx.play('quest'); CZ.coins(20);
      st.innerHTML = ''; CZG.shop(st); CZ.i18n();
    };
  },
});
// pity luck factor gets a temporary bump from a Lucky Charm bought in the points shop
const _luckF3 = CZ.luckF;
CZ.luckF = function () { let f = _luckF3.call(this); if (this.charmUntil && Date.now() < this.charmUntil) f += 0.15; return Math.max(-0.35, Math.min(0.65, f)); };
// every real wager earns loyalty points (1 per 100 ₽, scaled by VIP rank) and cracks the vault a little
const _take3 = CZ.take;
CZ.take = function (v) {
  const c = this.st(), wagBefore = c.wag, ok = _take3.call(this, v);
  if (ok) {
    const staked = c.wag - wagBefore;
    if (staked > 0) {
      c.loyAcc = (c.loyAcc || 0) + staked * this.vipPerk().loy;
      const gained = Math.floor(c.loyAcc / 100);
      if (gained > 0) { c.loyAcc -= gained * 100; c.loy = (c.loy || 0) + gained; }
      const vlt = this.vault();
      if (!vlt.ready) { vlt.fill = Math.min(100, vlt.fill + 2); if (vlt.fill >= 100) { vlt.ready = true; if (typeof Missions !== 'undefined') Missions.toast('🔐 The vault is ready to crack!'); } }
      Save.save();
    }
  }
  return ok;
};
// keep the two free-roll buttons' counts live — top() runs after every take()/give(), so this is
// what actually refreshes the "(N)" without needing a full game re-render (fixes it freezing on a
// stale count, worst on mobile where players tend to keep tapping the same game).
CZ.refreshFreeBtns = function () {
  const n = this.freeGameOk() ? this.freeUses() : 0;
  const af = document.querySelector('.czArmFree');
  if (af) { if (n <= 0 && !this.freeArm) af.remove(); else { af.textContent = this.freeArm ? `🎁 ARMED — press play (${n})` : `🎁 SELECT FREE ROLL (${n})`; af.classList.toggle('armed', !!this.freeArm); } }
  const qf = document.querySelector('.czAutoFree');
  if (qf) { if (n <= 0) qf.remove(); else qf.textContent = `⚡ AUTO FREE ROLL (${n})`; }
};
// loyalty points on the top panel, a daily-reset countdown and the vault on the perk strip
const _top3 = CZ.top;
CZ.top = function () { _top3.call(this); const el = $('czTop'); if (el) el.insertAdjacentHTML('beforeend', `<div><b>${this.st().loy || 0}</b>loyalty pts</div>`); this.refreshFreeBtns(); };
const _perks3 = CZ.perks;
CZ.perks = function () {
  _perks3.call(this); const el = $('czPerks'); if (!el) return;
  const now = new Date(), midnight = new Date(now); midnight.setHours(24, 0, 0, 0); const secs = Math.floor((midnight - now) / 1000);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), v = CZ.vault();
  el.insertAdjacentHTML('beforeend', `<span>🔄 Free plays reset in ${h}h ${m}m</span>` + (v.ready ? '<button id="czVaultReady">🔐 VAULT READY!</button>' : `<span>🔐 Vault ${Math.floor(v.fill)}%</span>`));
  const vb = $('czVaultReady'); if (vb) vb.onclick = () => { CZ.game = 'vault'; CZ.ui(CZ.el); };
};
// a short break reminder after every 30 minutes spent in the casino
addEventListener('DOMContentLoaded', () => {
  setInterval(() => {
    const on = $('czTop') && document.visibilityState === 'visible'; if (!on) return;
    const s = CZ.session(), mins = Math.floor((Date.now() - s.t0) / 60000), nextAt = (s.breakAt || 0) + 30;
    if (mins >= nextAt) { s.breakAt = nextAt; if (typeof Missions !== 'undefined') Missions.toast('🌤️ You\'ve been in the casino a while — maybe take a short break?'); CZ.beep(500, 0.3, 'sine'); }
  }, 1000);
});
