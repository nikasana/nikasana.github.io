'use strict';
// ---------- casino, part 2: a luck director tuned for LONG sessions, free daily plays, stay bonus, cashback, lucky hour, win ticker ----------
// The director keeps your chips alive as long as possible: kinder when you're losing or new to the session, cooler after big wins.
Object.assign(CZ, {
  sess: null,
  session() { if (!this.sess) this.sess = { start: Math.max(100, Save.data.rubles), t0: Date.now(), stay: 0, stayN: 0 }; return this.sess; },
  luckyHour() { const d = new Date(), k = Meta.dayKey() * 24 + d.getHours(); return (k * 2654435761 >>> 0) % 4 === 0 && d.getMinutes() < 20 ? 20 - d.getMinutes() : 0; },
  // positive: losing results get a second roll; negative: winning results get a second roll
  luckF() {
    const s = this.session(), ratio = Save.data.rubles / s.start, age = (Date.now() - s.t0) / 1000;
    let f = ratio < 0.35 ? 0.35 : ratio < 0.6 ? 0.22 : ratio < 0.85 ? 0.1 : ratio > 2 ? -0.25 : ratio > 1.4 ? -0.12 : 0.03;
    if (age < 180) f += 0.2; // a warm welcome
    if ((this.streak || 0) >= 4) f += Math.min(0.3, (this.streak - 3) * 0.08); // pity after a cold run
    if (this.luckyHour()) f += 0.2;
    return Math.max(-0.35, Math.min(0.65, f));
  },
  rig(gen, isWin) {
    const f = this.luckF(); let o = gen();
    if (f > 0 && !isWin(o) && Math.random() < f) o = gen();
    else if (f < 0 && isWin(o) && Math.random() < -f) o = gen();
    return o;
  },
  // ----- cashback: 10% of today's net loss, claim any time -----
  cb() { const c = this.st(), d = Meta.dayKey(); if (!c.cb || c.cb.day !== d) c.cb = { day: d, net: 0 }; return c.cb; },
  // ----- free daily play on every game -----
  freeAmt() { return 100 * (this.vip() + 1); },
  freeReady(g) { const c = this.st(); return !(c.free2 && c.free2[g] === Meta.dayKey()) || (c.tokens || 0) > 0; },
  // the jackpot grows faster the longer this session lasts (2% → up to 6% of each bet)
  jpRate() { const m = (Date.now() - this.session().t0) / 60000; return Math.min(0.1, 0.02 + Math.floor(m / 5) * 0.005 + (this.vipPerk ? this.vipPerk().jp : 0)); },
  // after every result: loss streaks earn a free play, a loss opens a short 'one more try' discount
  afterGive(v, stake) {
    const c = this.st();
    if (v <= stake && stake > 0) { this.omt = Date.now() + 10000; if ((this.streak || 0) > 0 && this.streak % 5 === 0) { c.tokens = (c.tokens || 0) + 1; if (typeof Missions !== 'undefined') Missions.toast('🎰 ' + this.streak + ' losses in a row · FREE PLAY token!'); this.beep(900, 0.2, 'sine'); } }
    if (v >= stake * 20 && v > 0) this.siren();
    if (v >= stake * 5 && v > 0) this.fireworks(Math.min(8, 2 + Math.floor(v / stake / 10)));
  },
  fireworks(n) {
    for (let k = 0; k < n; k++) setTimeout(() => { const x = rand(innerWidth * 0.15, innerWidth * 0.85), y = rand(innerHeight * 0.1, innerHeight * 0.5), c = pick(['#ffe070', '#ff5ce6', '#7fe3ff', '#7aff9a', '#ff6a5a']); this.fx = (this.fx || []).concat(Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2, sp = rand(120, 260); return { fw: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2, c }; })); this.beep(200 + Math.random() * 200, 0.25, 'sawtooth', 0.05); this.coins(1); }, k * 350);
  },
  siren() { try { Sfx.init(); for (let i = 0; i < 6; i++) setTimeout(() => { Sfx.tone(600, 0.35, 'square', 0.06, 500); setTimeout(() => Sfx.tone(1100, 0.35, 'square', 0.06, -500), 350); }, i * 700); } catch (e) { /* audio off */ } let s = $('czSiren'); if (!s) { s = document.createElement('div'); s.id = 'czSiren'; document.body.appendChild(s); } s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); },
  // hourly chest
  chestLeft() { const c = this.st(); return Math.max(0, 3600 - Math.floor((Date.now() - (c.chest || 0)) / 1000)); },
  freeCount() { return ['rou', 'slots', 'bj', 'plinko', 'crash', 'dice', 'coin', 'wheel', 'scratch', 'race', 'box', 'monty'].filter((g) => this.freeReady(g)).length; },
});
const CZ_NAMES = ['Strelok', 'Degtyarev', 'Sidorovich', 'Beard', 'Nimble', 'Wolf', 'Fanatic', 'Ghost', 'Lucky', 'Tolik', 'Petrenko', 'Owl', 'Garik', 'Mitay', 'Kruglov', 'Hog'];
const CZ_GAMES_T = ['🎡 Roulette', '🎰 Slots', '🃏 Blackjack', '🔴 Plinko', '🚀 Crash', '🎲 Dice', '🎫 Scratch'];

addEventListener('DOMContentLoaded', () => {
  const _ui = CZ.ui.bind(CZ);
  CZ.ui = function (el) {
    CZ.session(); CZ.freeArm = false; _ui(el);
    const sign = el.querySelector('.czSign');
    if (sign) sign.insertAdjacentHTML('afterend', '<div class="czTicker" id="czTicker"></div><div class="czPerks" id="czPerks"></div>');
    const row = $('czBet'); if (row && CZ.armFreeHtml) row.insertAdjacentHTML('beforebegin', CZ.armFreeHtml());
    CZ.perks(); CZ.i18n();
  };
  // the strip of perks under the sign: lucky hour, stay bonus countdown, cashback, free plays left
  CZ.perks = function () {
    const el = $('czPerks'); if (!el) return; const s = CZ.session(), lh = CZ.luckyHour(), cb = CZ.cb(), next = 180 - (s.stay % 180);
    const cl = CZ.chestLeft(), c2 = CZ.st(), om = CZ.omt && Date.now() < CZ.omt ? Math.ceil((CZ.omt - Date.now()) / 1000) : 0;
    const cbR = CZ.vipPerk ? CZ.vipPerk().cb : 0.1;
    el.innerHTML = (cl ? `<span>⏰ Free chest in ${Math.floor(cl / 60)}:${String(cl % 60).padStart(2, '0')}</span>` : '<button id="czChest">⏰ OPEN FREE CHEST</button>') + (c2.firstDay !== Meta.dayKey() ? '<span class="lh">🎊 First bet today pays ×2</span>' : '') + (om ? `<span class="lh">🎲 One more try −20% · ${om}s</span>` : '') + ((c2.tokens || 0) > 0 ? `<span class="lh">🎰 ${c2.tokens} free play tokens</span>` : '') + `<span>☢️ Jackpot grows ${(CZ.jpRate() * 100).toFixed(1)}% of each bet</span>` + (lh ? `<span class="lh">🍀 LUCKY HOUR · ${lh} min left</span>` : '') + `<span>🕐 Stay bonus in ${Math.floor(next / 60)}:${String(next % 60).padStart(2, '0')}</span>` + `<span>🎁 ${CZ.freeCount()} free plays today</span>` + (cb.net >= 20 ? `<button id="czCash">💸 CASHBACK ${Math.floor(cb.net * cbR)} ₽</button>` : `<span>💸 Cashback: ${Math.round(cbR * 100)}% of today's losses</span>`);
    const ch = $('czChest'); if (ch) ch.onclick = () => { const c = CZ.st(); if (CZ.chestLeft()) return; c.chest = Date.now(); const v = Math.round(CZ.freeAmt() * rand(0.8, 3.5)); Save.data.rubles += v; Save.save(); CZ.top(); CZ.coins(30); CZ.fireworks(2); Sfx.play('legend'); if (typeof Missions !== 'undefined') Missions.toast('⏰ Free chest +' + v + ' ₽'); CZ.perks(); };
    const c = $('czCash'); if (c) c.onclick = () => { const v = Math.floor(CZ.cb().net * cbR); if (v <= 0) return; Save.data.rubles += v; CZ.cb().net = 0; Save.save(); CZ.top(); CZ.coins(16); Sfx.play('stash'); CZ.perks(); CZ.i18n(); };
  };
  // one clock drives the ticker, the stay bonus and the perk strip while the casino is open
  let tick = 0;
  setInterval(() => {
    const on = $('czTop') && document.visibilityState === 'visible'; if (!on) return;
    const s = CZ.session(); s.stay++; tick++;
    if (s.stay % 180 === 0) { s.stayN++; const v = Math.round(CZ.freeAmt() * (1 + s.stayN * 0.25)); Save.data.rubles += v; Save.save(); CZ.top(); CZ.coins(20); Sfx.play('quest'); if (typeof Missions !== 'undefined') Missions.toast('🕐 Stay bonus +' + v + ' ₽'); }
    if (tick % 4 === 0) { const t = $('czTicker'); if (t) { const big = Math.random() < 0.15, m = big ? Math.round(rand(20, 150)) : Math.round(rand(2, 12) * 10) / 10; t.textContent = `📢 ${pick(CZ_NAMES)} won ${Math.round(m * pick([50, 100, 500, 1000]))} ₽ on ${pick(CZ_GAMES_T)} (×${m})`; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in'); CZ.i18n(); } }
    CZ.perks();
  }, 1000);
});
