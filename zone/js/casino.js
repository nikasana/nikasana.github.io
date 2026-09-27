'use strict';
// ---------- ZONE CASINO: a full neon casino in the Bunker (roulette, slots, blackjack, plinko, crash, dice, coin ladder, wheel) ----------
const CZ_VIP = [[0, 'Rookie', '#9a9a8a'], [10000, 'Bronze', '#cd7f32'], [50000, 'Silver', '#c8d0d8'], [200000, 'Gold', '#ffcf3a'], [1000000, 'Platinum', '#7fe3ff'], [5000000, 'Diamond', '#ff5ce6']];
const CZ = {
  bet: 100, game: 'rou',
  st() { const S = Save.data; S.casino = S.casino || { wag: 0, won: 0, big: 0, jp: 5000, free: '', games: 0 }; return S.casino; },
  vip() { const w = this.st().wag; let i = 0; while (i + 1 < CZ_VIP.length && w >= CZ_VIP[i + 1][0]) i++; return i; },
  // take a stake; every stake grows the progressive jackpot a little
  take(v) { v = Math.floor(v); const S = Save.data, c = this.st();
    if (this.freeArm) { this.freeArm = false; c.free2 = c.free2 || {}; if (this.freeReady && !this.freeReady(this.game) && c.tokens > 0) c.tokens--; else c.free2[this.game] = Meta.dayKey(); c.games++; this.freeStake = v; Save.save(); this.top(); this.freeBtn(); return true; } // today's free play on this game
    if (v <= 0 || S.rubles < v) { this.shake(); return false; } const disc = this.omt && Date.now() < this.omt ? Math.floor(v * 0.2) : 0; this.omt = 0; S.rubles -= v - disc; c.wag += v; c.games++; if (c.firstDay !== Meta.dayKey()) { c.firstDay = Meta.dayKey(); this.firstX2 = true; } c.jp += Math.max(1, Math.round(v * (this.jpRate ? this.jpRate() : 0.02))); Save.save(); this.top(); return true; },
  give(v, stake) { v = Math.floor(v); const S = Save.data, c = this.st(); if (this.firstX2) { this.firstX2 = false; if (v > 0) { v *= 2; if (typeof Missions !== 'undefined') Missions.toast('🎊 First bet of the day · WIN ×2!'); } } this.streak = v > stake ? 0 : (this.streak || 0) + 1; const cb = this.cb(); cb.net += (this.freeStake ? 0 : stake) - v; this.freeStake = 0; if (v > 0) { S.rubles += v; c.won += v; if (v - stake > c.big) c.big = v - stake; } Save.save(); this.top(); if (this.afterGive) this.afterGive(v, stake); if (v >= stake * 5 && v > 0) this.bigWin(v, v / stake); else if (v > stake) this.coins(Math.min(40, 8 + v / stake * 4)); return v; },
  shake() { const b = $('czBet'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } Sfx.init(); Sfx.play('hurt'); },
  beep(f, d, t, v) { try { Sfx.init(); Sfx.tone(f, d || 0.06, t || 'square', v || 0.04); } catch (e) { /* audio off */ } },
  top() {
    const el = $('czTop'); if (!el) return; menuRubles(); const c = this.st(), v = this.vip(), nx = CZ_VIP[v + 1];
    el.innerHTML = `<div><b>${Save.data.rubles}</b>₽ chips</div><div><b style="color:${CZ_VIP[v][2]}">${CZ_VIP[v][1]}</b>VIP${nx ? ` · ${Math.round((c.wag / nx[0]) * 100)}%` : ''}</div><div><b class="czJp">${c.jp}</b>☢️ jackpot</div><div><b>${c.big}</b>biggest win</div><div><b>${c.wag}</b>wagered</div>`;
    const bv = $('czBetV'); if (bv) bv.textContent = this.bet + ' ₽';
  },
  // ----- effects: coin shower and the BIG WIN banner -----
  coins(n) {
    let cv = $('czFx'); if (!cv) { cv = document.createElement('canvas'); cv.id = 'czFx'; document.body.appendChild(cv); }
    cv.width = innerWidth; cv.height = innerHeight; const g = cv.getContext('2d'); this.fx = (this.fx || []).concat(Array.from({ length: Math.round(n) }, () => ({ x: rand(innerWidth), y: -20 - rand(200), vx: rand(-60, 60), vy: rand(80, 260), r: rand(6, 12), a: rand(6), s: pick(['🪙', '💰', '💎', '✨']) })));
    if (this.fxOn) return; this.fxOn = true; let last = performance.now();
    const step = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t; g.clearRect(0, 0, cv.width, cv.height);
      for (const p of this.fx) { if (p.fw) { p.vx *= 0.97; p.vy = p.vy * 0.97 + 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; if (p.life <= 0) p.y = 1e9; continue; } p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt * 6; g.save(); g.translate(p.x, p.y); g.scale(Math.cos(p.a), 1); g.font = p.r * 2 + 'px serif'; g.textAlign = 'center'; g.fillText(p.s, 0, 0); g.restore(); }
      this.fx = this.fx.filter((p) => p.y < cv.height + 40);
      if (this.fx.length) requestAnimationFrame(step); else { this.fxOn = false; g.clearRect(0, 0, cv.width, cv.height); }
    };
    requestAnimationFrame(step); this.beep(1300, 0.08); setTimeout(() => this.beep(1700, 0.1), 90);
  },
  bigWin(v, m) {
    let b = $('czBig'); if (!b) { b = document.createElement('div'); b.id = 'czBig'; document.body.appendChild(b); }
    b.innerHTML = `<small>${m >= 50 ? 'MEGA WIN' : m >= 15 ? 'HUGE WIN' : 'BIG WIN'}</small><b>+${v} ₽</b><em>×${(Math.round(m * 10) / 10)}</em>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 2600);
    this.coins(Math.min(160, 40 + m * 3)); Sfx.play('legend'); if (G) flash(0.25, '255,220,120');
  },
  ui(el) {
    this.el = el;
    const games = [['rou', '🎡', 'Roulette'], ['slots', '🎰', 'Slots'], ['bj', '🃏', 'Blackjack'], ['plinko', '🔴', 'Plinko'], ['crash', '🚀', 'Crash'], ['dice', '🎲', 'Dice'], ['coin', '🪙', 'Coin Ladder'], ['wheel', '🎡', 'Zone Wheel'], ['scratch', '🎫', 'Scratch Cards'], ['xch', '🌟', 'Exchange']];
    el.innerHTML = `<div class="czSign"><span>★ ZONE CASINO ★</span></div><div id="czTop" class="czTop"></div>
      <div class="czGames">${games.map(([id, ic, nm]) => `<button class="czG ${id === this.game ? 'sel' : ''}" data-czg="${id}"><span>${ic}</span>${nm}</button>`).join('')}</div>
      <div class="czBetRow" id="czBet"><span>BET</span><b id="czBetV"></b>${[10, 50, 100, 500, 1000, 5000, 25000, 100000, 1000000].map((v) => `<button class="czChip c${v}" data-czb="${v}">${v >= 1e6 ? v / 1e6 + 'M' : v >= 1000 ? v / 1000 + 'k' : v}</button>`).join('')}<button class="czChip" data-czp="0.5">½</button><button class="czChip" data-czp="2">×2</button><button class="czChip" data-czp="10">×10</button></div>
      <div class="czBetRow">${[['0.1', '10%'], ['0.25', '25%'], ['0.3333', '33%'], ['0.5', '50%'], ['1', 'ALL IN']].map(([f, n]) => `<button class="czChip pct ${f === '1' ? 'allin' : ''}" data-czf="${f}">${n}</button>`).join('')}</div>
      <div id="czStage" class="czStage"></div>`;
    for (const b of el.querySelectorAll('[data-czg]')) b.onclick = () => { if (this.busy) return; this.game = b.dataset.czg; this.beep(900); this.ui(el); this.i18n(); };
    for (const b of el.querySelectorAll('[data-czb]')) b.onclick = () => { this.bet = +b.dataset.czb; this.beep(1200, 0.04); this.top(); };
    for (const b of el.querySelectorAll('[data-czp]')) b.onclick = () => { this.bet = Math.max(1, Math.floor(this.bet * +b.dataset.czp)); this.beep(1200, 0.04); this.top(); };
    // share of your rubles: 10% / 25% / 33% / 50% / ALL IN
    for (const b of el.querySelectorAll('[data-czf]')) b.onclick = () => { this.bet = Math.max(1, Math.floor(Save.data.rubles * +b.dataset.czf)); this.beep(1400, 0.05); this.top(); };
    this.top(); CZG[this.game]($('czStage'));
  },
  i18n() { if (typeof I18n !== 'undefined' && I18n.cur !== 'en' && this.el) try { I18n.dom(this.el); } catch (e) { /* keep english */ } },
  canvas(st, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'czCv'; st.appendChild(c); return c; },
  loop(cv, fn) { let last = performance.now(); const f = (t) => { if (!cv.isConnected) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(cv.getContext('2d'), dt, t / 1000); requestAnimationFrame(f); }; requestAnimationFrame(f); },
  res(st, txt, good) { let r = st.querySelector('.czRes'); if (!r) { r = document.createElement('div'); r.className = 'czRes'; st.appendChild(r); } r.textContent = txt; r.className = 'czRes ' + (good ? 'win' : good === false ? 'lose' : ''); },
};
const ease = (t) => 1 - Math.pow(1 - Math.min(1, t), 3);

// ======================= the games =======================
const RW = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const rouCol = (n) => (n === 0 ? '#1f9a4a' : REDS.includes(n) ? '#c8202a' : '#16161a');
const rouWins = (spot, n) => {
  if (spot[0] === 'n') return +spot.slice(1) === n ? 36 : 0;
  if (n === 0) return 0;
  return ({ red: REDS.includes(n), black: !REDS.includes(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 18, high: n >= 19 })[spot] ? 2
    : spot[0] === 'd' ? (Math.ceil(n / 12) === +spot[1] ? 3 : 0) : spot[0] === 'c' ? (((n - 1) % 3) + 1 === +spot[1] ? 3 : 0) : 0;
};
// themed slot machines: same odds and pays, their own symbols, colors and sounds
const SLOT_THEMES = [
  { id: 'zone', icon: '☢️', name: 'Zone Classic', sym: ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣', '☢️'], bg: ['#2a0a3a', '#0a0418'], lamp: ['#ffe070', '#5a3a6a'], reel: '#f4ecd8', tone: 300 },
  { id: 'mono', icon: '🗿', name: 'Monolith', sym: ['💠', '🔮', '🌀', '⚡', '👁️', '🗿', '☢️'], bg: ['#0a1440', '#02040e'], lamp: ['#7fe3ff', '#1a2a5a'], reel: '#dfe8ff', tone: 180 },
  { id: 'free', icon: '🍃', name: 'Freedom', sym: ['🍃', '🌻', '🍺', '🎸', '🌈', '🕊️', '☢️'], bg: ['#0a3a14', '#021006'], lamp: ['#7aff9a', '#1a4a22'], reel: '#eaffea', tone: 420 },
  { id: 'duty', icon: '🎖️', name: 'Duty', sym: ['🪖', '🔫', '🛡️', '⭐', '🎖️', '🚩', '☢️'], bg: ['#3a0a0a', '#100202'], lamp: ['#ff6a5a', '#5a1a1a'], reel: '#fff0ea', tone: 240 },
  { id: 'band', icon: '🃏', name: 'Bandit Den', sym: ['🥃', '🔪', '🃏', '💰', '💍', '👑', '☢️'], bg: ['#2a2008', '#0c0802'], lamp: ['#ffcf3a', '#4a3a10'], reel: '#fff6d8', tone: 360 },
];
const CZG = {
  // ----- European roulette: place chips on the table, then spin -----
  rou(st) {
    const R = CZG.rouS = CZG.rouS || { bets: {}, hist: [], wa: 0, ba: 0, br: 1, spin: null, last: null };
    const cv = CZ.canvas(st, 520, 300);
    const num = (n) => `<button class="rn" data-rs="n${n}" style="background:${rouCol(n)}">${n}</button>`;
    let t = '<div class="rTable"><div class="rZero">' + num(0) + '</div><div class="rNums">';
    for (let row = 3; row >= 1; row--) { for (let c = 0; c < 12; c++) t += num(c * 3 + row); t += `<button class="rn out" data-rs="c${row}">2:1</button>`; }
    t += '</div></div><div class="rOut">' + [['d1', '1st 12'], ['d2', '2nd 12'], ['d3', '3rd 12'], ['low', '1-18'], ['even', 'EVEN'], ['red', '🔴 RED'], ['black', '⚫ BLACK'], ['odd', 'ODD'], ['high', '19-36']].map(([k, n]) => `<button class="rn out" data-rs="${k}">${n}</button>`).join('') + '</div>';
    st.insertAdjacentHTML('beforeend', t + '<div class="czAct"><button class="big" id="rSpin">🎡 SPIN</button><button class="big ghost small" id="rClear">CLEAR BETS</button><button class="big ghost small" id="rRe">↺ REBET</button></div><div class="rHist" id="rHist"></div>');
    const paint = () => {
      for (const b of st.querySelectorAll('[data-rs]')) { const v = R.bets[b.dataset.rs]; let c = b.querySelector('i'); if (v) { if (!c) { c = document.createElement('i'); b.appendChild(c); } c.textContent = v >= 1000 ? Math.round(v / 100) / 10 + 'k' : v; } else if (c) c.remove(); }
      $('rHist').innerHTML = R.hist.map((n) => `<span style="background:${rouCol(n)}">${n}</span>`).join('');
      const tot = Object.values(R.bets).reduce((a, b) => a + b, 0); CZ.res(st, tot ? `On the table: ${tot} ₽` : 'Tap the table to place chips.');
    };
    for (const b of st.querySelectorAll('[data-rs]')) b.onclick = () => { if (R.spin) return; if (!CZ.take(CZ.bet)) return; R.bets[b.dataset.rs] = (R.bets[b.dataset.rs] || 0) + CZ.bet; CZ.beep(1500, 0.03, 'triangle'); paint(); };
    $('rClear').onclick = () => { if (R.spin) return; const tot = Object.values(R.bets).reduce((a, b) => a + b, 0); Save.data.rubles += tot; CZ.st().wag -= tot; R.bets = {}; Save.save(); CZ.top(); paint(); };
    $('rRe').onclick = () => { if (R.spin || !R.prev) return; const tot = Object.values(R.prev).reduce((a, b) => a + b, 0); if (!CZ.take(tot)) return; for (const k in R.prev) R.bets[k] = (R.bets[k] || 0) + R.prev[k]; paint(); };
    $('rSpin').onclick = () => {
      if (R.spin || !Object.keys(R.bets).length) { CZ.shake(); return; }
      const stakeR = Object.values(R.bets).reduce((a, b) => a + b, 0), n = CZ.rig(() => RW[Math.floor(Math.random() * 37)], (x) => Object.keys(R.bets).reduce((a, k) => a + R.bets[k] * rouWins(k, x), 0) > stakeR), idx = RW.indexOf(n), seg = (Math.PI * 2) / 37;
      const wEnd = R.wa + Math.PI * 2 * 3 + rand(Math.PI * 2);
      const TA = wEnd + idx * seg + seg / 2, TW = Math.PI * 2, gap = (((R.ba - TA) % TW) + TW) % TW; // ball runs the other way and stops on the pocket
      R.spin = { t: 0, T: 5.2, w0: R.wa, w1: wEnd, b0: R.ba, b1: R.ba - TW * 6 - gap, n, tick: 0 };
      CZ.busy = true; R.last = null; CZ.res(st, 'No more bets…');
    };
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 300, cx = 150, cy = 150, r = 130, seg = (Math.PI * 2) / 37;
      if (R.spin) {
        const s = R.spin; s.t += dt; const k = ease(s.t / s.T);
        R.wa = s.w0 + (s.w1 - s.w0) * k; R.ba = s.b0 + (s.b1 - s.b0) * k; R.br = s.t / s.T < 0.55 ? 1 : Math.max(0.74, 1 - (s.t / s.T - 0.55) * 0.9) + Math.abs(Math.sin(s.t * 14)) * 0.04 * (1 - k);
        if ((s.tick -= dt) <= 0) { s.tick = 0.03 + k * 0.25; CZ.beep(2200 - k * 900, 0.02, 'triangle', 0.025); }
        if (s.t >= s.T) {
          R.spin = null; R.br = 0.74; CZ.busy = false; R.hist.unshift(s.n); R.hist = R.hist.slice(0, 14); R.last = { n: s.n, t: T };
          let win = 0, stake = 0; for (const k2 in R.bets) { stake += R.bets[k2]; win += R.bets[k2] * rouWins(k2, s.n); }
          R.prev = R.bets; R.bets = {}; CZ.give(win, stake); paint();
          CZ.res(st, `${s.n} ${s.n === 0 ? 'GREEN' : REDS.includes(s.n) ? 'RED' : 'BLACK'} · ${win ? 'you win ' + win + ' ₽' : 'the house takes ' + stake + ' ₽'}`, win > stake ? true : win ? null : false);
          Sfx.play(win > stake ? 'quest' : win ? 'coin' : 'hurt');
        }
      }
      g.clearRect(0, 0, W, H);
      const bg = g.createRadialGradient(cx, cy, 20, cx, cy, 160); bg.addColorStop(0, '#3a2412'); bg.addColorStop(1, '#120a04'); g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, r + 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d4a640'; g.lineWidth = 5; g.stroke();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + T * 0.6, on = (i + Math.floor(T * 4)) % 3 === 0; g.fillStyle = on ? '#fff6a0' : '#6a5020'; g.beginPath(); g.arc(cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10), 3, 0, Math.PI * 2); g.fill(); }
      for (let i = 0; i < 37; i++) {
        const a0 = R.wa + i * seg - Math.PI / 2, a1 = a0 + seg, n = RW[i];
        g.fillStyle = R.last && R.last.n === n && Math.sin(T * 10) > 0 ? '#ffe070' : rouCol(n); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill();
        g.strokeStyle = '#d4a64088'; g.lineWidth = 1; g.stroke();
        g.save(); g.translate(cx + Math.cos(a0 + seg / 2) * (r - 14), cy + Math.sin(a0 + seg / 2) * (r - 14)); g.rotate(a0 + seg / 2 + Math.PI / 2); g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(n, 0, 4); g.restore();
      }
      g.fillStyle = '#2a1a0a'; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d4a640'; g.lineWidth = 3; g.stroke();
      g.save(); g.translate(cx, cy); g.rotate(R.wa); g.fillStyle = '#d4a640'; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillRect(-3, 0, 6, r * 0.5); } g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill(); g.restore();
      const ba = R.ba - Math.PI / 2, br = r * (R.br || 1) * (R.spin ? 1 : 1) - 8, bx = cx + Math.cos(ba) * (R.spin || R.last ? br : r - 8), by = cy + Math.sin(ba) * (R.spin || R.last ? br : r - 8);
      g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      // result panel
      g.textAlign = 'center';
      if (R.last) { const n = R.last.n; g.fillStyle = rouCol(n); g.shadowColor = rouCol(n); g.shadowBlur = 30; g.beginPath(); g.arc(400, 130, 60, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; g.strokeStyle = '#ffe070'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.fillText(n, 400, 150); }
      else { g.fillStyle = '#ffe070'; g.font = 'bold 22px sans-serif'; g.fillText(R.spin ? 'SPINNING…' : 'PLACE BETS', 400, 130); g.fillStyle = '#b89a60'; g.font = '13px sans-serif'; g.fillText('number pays ×36 · color ×2 · dozen ×3', 400, 160); }
    });
    paint();
  },

  // ----- 5-reel slots with 5 paylines and the progressive jackpot on ☢️☢️☢️☢️☢️ -----
  slots(st) {
    const WT = [30, 26, 20, 12, 7, 4, 2], PAY = [[1.4, 5, 14], [1.6, 7, 16], [2, 8, 22], [4, 14, 40], [8, 27, 100], [14, 70, 270], [27, 135, 0]];
    const LINES = [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2]], LC = ['#ffe070', '#ff5ce6', '#7fe3ff', '#7aff9a', '#ff9a4a'];
    const rs = () => { let r = Math.random() * 101; for (let i = 0; i < 7; i++) { r -= WT[i]; if (r <= 0) return i; } return 0; };
    const S = CZG.slS = CZG.slS || { grid: [0, 1, 2, 3, 4].map(() => [rs(), rs(), rs()]), off: [0, 0, 0, 0, 0], spin: false, stop: [], win: [], auto: 0, theme: 0 };
    const TH = SLOT_THEMES[S.theme || 0], SYM = TH.sym;
    st.insertAdjacentHTML('beforeend', `<div class="slThemes">${SLOT_THEMES.map((t, i) => `<button class="czG ${i === (S.theme || 0) ? 'sel' : ''}" data-slt="${i}" style="--c:${t.lamp[0]}"><span>${t.icon}</span>${t.name}</button>`).join('')}</div>`);
    for (const b of st.querySelectorAll('[data-slt]')) b.onclick = () => { if (S.spin) return; S.theme = +b.dataset.slt; S.win = []; CZ.beep(TH.tone * 2, 0.05); st.innerHTML = ''; CZG.slots(st); CZ.i18n(); };
    const cv = CZ.canvas(st, 520, 300);
    st.insertAdjacentHTML('beforeend', `<div class="czAct"><button class="big" id="slSpin">🎰 SPIN</button><button class="big ghost small" id="slAuto">AUTO ×10</button></div><div class="czPay">${SYM.map((s, i) => `<span>${s.repeat(3)} ×${PAY[i][0]} · ×4 ${PAY[i][1]} · ×5 ${PAY[i][2] || 'JACKPOT'}</span>`).join('')}</div>`);
    const go = () => {
      if (S.spin) return; const bet = CZ.bet; if (!CZ.take(bet)) { S.auto = 0; return; }
      S.spin = true; CZ.busy = true; S.win = []; S.bet = bet; const gen = () => [0, 1, 2, 3, 4].map(() => [rs(), rs(), rs()]), pays = (G5) => LINES.some((L) => { let n = 1; while (n < 5 && G5[n][L[n]] === G5[0][L[0]]) n++; return n >= 3; });
      S.final = CZ.rig(gen, pays);
      if (!pays(S.final) && Math.random() < 0.35) { const f = S.final.map((r) => r.slice()), hi = Math.random() < 0.5 ? 6 : 5; f[0][1] = f[1][1] = hi; f[2][1] = (hi + 1 + Math.floor(Math.random() * 4)) % 7; if (!pays(f)) { S.final = f; S.near = true; } } // so close… S.stop = [0, 1, 2, 3, 4].map((i) => 0.8 + i * 0.35); S.t = 0; CZ.res(st, 'Spinning…');
    };
    const settle = () => {
      let win = 0, jp = false; S.win = [];
      LINES.forEach((L, li) => {
        const s0 = S.grid[0][L[0]]; let n = 1; while (n < 5 && S.grid[n][L[n]] === s0) n++;
        if (n >= 3) { const m = PAY[s0][n - 3]; if (s0 === 6 && n === 5) jp = true; else win += S.bet * m; S.win.push([li, n]); }
      });
      win = Math.floor(win);
      if (jp) { const c = CZ.st(); win += c.jp; c.jp = 5000; }
      S.spin = false; CZ.busy = false; CZ.give(win, S.bet); const wasNear = S.near; S.near = false; if (wasNear && !win) S.near = true;
      CZ.res(st, jp ? '☢️☢️☢️☢️☢️ JACKPOT! +' + win + ' ₽' : !win && S.near ? '😱 SO CLOSE! One more symbol…' : win ? `WIN ${win} ₽ on ${S.win.length} line${S.win.length > 1 ? 's' : ''}` : 'No luck this time.', win > S.bet ? true : win ? null : false);
      if (!win) Sfx.play('hit');
      if (S.auto > 0) { S.auto--; setTimeout(() => { if (cv.isConnected) go(); }, win ? 900 : 350); }
    };
    $('slSpin').onclick = go; $('slAuto').onclick = () => { S.auto = 9; go(); };
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 300, rw = 92, rh = 78, x0 = 30, y0 = 34;
      if (S.spin) {
        S.t += dt; let all = true;
        for (let i = 0; i < 5; i++) {
          if (S.t < S.stop[i]) { all = false; S.off[i] = (S.off[i] + dt * 14) % 1; if (Math.random() < dt * 14) S.grid[i] = [rs(), S.grid[i][0], S.grid[i][1]]; }
          else if (S.grid[i] !== S.final[i]) { S.grid[i] = S.final[i]; S.off[i] = 0; CZ.beep(TH.tone + i * 90, 0.07, 'square', 0.05); }
        }
        if (all) settle();
      }
      g.clearRect(0, 0, W, H);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, TH.bg[0]); bg.addColorStop(1, TH.bg[1]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) { const on = (i + Math.floor(T * 6)) % 4 === 0; g.fillStyle = on ? TH.lamp[0] : TH.lamp[1]; g.beginPath(); g.arc(14 + i * 19.5, 12, 4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(14 + i * 19.5, H - 12, 4, 0, Math.PI * 2); g.fill(); }
      for (let i = 0; i < 5; i++) {
        const x = x0 + i * rw; g.fillStyle = TH.reel; g.fillRect(x + 3, y0, rw - 6, rh * 3);
        g.save(); g.beginPath(); g.rect(x + 3, y0, rw - 6, rh * 3); g.clip();
        for (let j = -1; j < 3; j++) { const s = j < 0 ? S.grid[i][0] : S.grid[i][j], y = y0 + (j + S.off[i]) * rh; if (j < 0 && !S.off[i]) continue; g.font = (S.spin && S.t < S.stop[i] ? '40px' : '46px') + ' serif'; g.textAlign = 'center'; g.globalAlpha = S.spin && S.t < S.stop[i] ? 0.7 : 1; g.fillText(SYM[s], x + rw / 2, y + rh / 2 + 16); }
        g.globalAlpha = 1; const sh = g.createLinearGradient(0, y0, 0, y0 + rh * 3); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = sh; g.fillRect(x, y0, rw, rh * 3); g.restore();
      }
      if (!S.spin) for (const [li, n] of S.win) {
        const L = LINES[li]; g.strokeStyle = LC[li]; g.lineWidth = 5 + Math.sin(T * 8) * 2; g.shadowColor = LC[li]; g.shadowBlur = 16; g.beginPath();
        for (let i = 0; i < n; i++) { const x = x0 + i * rw + rw / 2, y = y0 + L[i] * rh + rh / 2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.shadowBlur = 0;
        for (let i = 0; i < n; i++) { g.strokeStyle = LC[li]; g.lineWidth = 3; g.strokeRect(x0 + i * rw + 6, y0 + L[i] * rh + 3, rw - 12, rh - 6); }
      }
      g.fillStyle = '#ffe070'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('☢️ JACKPOT ' + CZ.st().jp + ' ₽ · BET ' + CZ.bet + ' ₽', W / 2, H - 22);
    });
  },

  // ----- blackjack: dealer stands on 17, blackjack pays 3:2 -----
  bj(st) {
    const B = CZG.bjS = CZG.bjS || { deck: [], p: [], d: [], on: false, bet: 0, hide: true };
    const suits = ['♠', '♥', '♦', '♣'], ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const draw = () => { if (B.deck.length < 15) { B.deck = []; for (let k = 0; k < 6; k++) for (const s of suits) for (const r of ranks) B.deck.push([r, s]); for (let i = B.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [B.deck[i], B.deck[j]] = [B.deck[j], B.deck[i]]; } } CZ.beep(700, 0.03, 'triangle'); return B.deck.pop(); };
    const val = (h) => { let v = 0, a = 0; for (const [r] of h) { v += r === 'A' ? 11 : 'JQK'.includes(r) ? 10 : +r; if (r === 'A') a++; } while (v > 21 && a) { v -= 10; a--; } return v; };
    const card = (c, i, hid) => `<div class="pcard ${hid ? 'back' : c[1] === '♥' || c[1] === '♦' ? 'red' : ''}" style="animation-delay:${i * 0.08}s">${hid ? '' : `<b>${c[0]}</b><span>${c[1]}</span>`}</div>`;
    st.insertAdjacentHTML('beforeend', '<div class="bjTable"><div class="bjRow"><small id="bjDv">DEALER</small><div class="bjHand" id="bjD"></div></div><div class="bjRow"><small id="bjPv">YOU</small><div class="bjHand" id="bjP"></div></div></div><div class="czAct" id="bjAct"></div>');
    const show = () => {
      $('bjD').innerHTML = B.d.map((c, i) => card(c, i, i === 1 && B.hide)).join(''); $('bjP').innerHTML = B.p.map((c, i) => card(c, i)).join('');
      $('bjDv').textContent = 'DEALER' + (B.d.length ? ' · ' + (B.hide ? val([B.d[0]]) + ' + ?' : val(B.d)) : ''); $('bjPv').textContent = 'YOU' + (B.p.length ? ' · ' + val(B.p) : '');
      $('bjAct').innerHTML = B.on ? '<button class="big" id="bjHit">HIT</button><button class="big" id="bjStand">STAND</button>' + (B.p.length === 2 && Save.data.rubles >= B.bet ? '<button class="big ghost" id="bjDbl">DOUBLE</button>' : '') : '<button class="big" id="bjDeal">🃏 DEAL</button>';
      const h = $('bjHit'), s = $('bjStand'), d = $('bjDbl'), dl = $('bjDeal');
      if (dl) dl.onclick = () => { if (!CZ.take(CZ.bet)) return; B.bet = CZ.bet; B.p = [draw(), draw()]; B.d = [draw(), draw()]; B.hide = true; B.on = true; CZ.busy = true; CZ.res(st, ''); if (val(B.p) === 21) end(); else show(); CZ.i18n(); };
      if (h) h.onclick = () => { B.p.push(draw()); if (val(B.p) >= 21) end(); else show(); CZ.i18n(); };
      if (s) s.onclick = () => { end(); CZ.i18n(); };
      if (d) d.onclick = () => { if (!CZ.take(B.bet)) return; B.bet *= 2; B.p.push(draw()); end(); CZ.i18n(); };
    };
    const end = () => {
      B.hide = false; B.on = false; CZ.busy = false; const pv = val(B.p), bj = pv === 21 && B.p.length === 2;
      if (pv <= 21 && !bj) while (val(B.d) < 17) B.d.push(draw());
      const dv = val(B.d); let win = 0, msg;
      if (pv > 21) msg = 'BUST · you lose ' + B.bet + ' ₽';
      else if (bj && !(dv === 21 && B.d.length === 2)) { win = Math.floor(B.bet * 2.5); msg = 'BLACKJACK! +' + win + ' ₽'; }
      else if (dv > 21 || pv > dv) { win = B.bet * 2; msg = (dv > 21 ? 'Dealer busts! ' : 'You win! ') + '+' + win + ' ₽'; }
      else if (pv === dv) { win = B.bet; msg = 'Push · bet returned'; }
      else msg = 'Dealer wins · you lose ' + B.bet + ' ₽';
      CZ.give(win, B.bet); show(); CZ.res(st, msg, win > B.bet ? true : win ? null : false); Sfx.play(win > B.bet ? 'quest' : win ? 'coin' : 'hurt');
    };
    show();
  },

  // ----- plinko: drop as many balls as you like -----
  plinko(st) {
    const M = [18, 7, 3, 1.6, 1.1, 0.8, 0.4, 0.8, 1.1, 1.6, 3, 7, 18], ROWS = 12;
    const Pk = CZG.pkS = CZG.pkS || { balls: [], hits: [] };
    const cv = CZ.canvas(st, 520, 360);
    st.insertAdjacentHTML('beforeend', '<div class="czAct"><button class="big" id="pkDrop">🔴 DROP</button><button class="big ghost small" id="pkTen">DROP ×10</button></div>');
    const drop = () => { if (!CZ.take(CZ.bet)) return false; const gp = () => { const path = []; let k = 0; for (let i = 0; i < ROWS; i++) { const r = Math.random() < 0.5 ? 1 : 0; path.push(r); k += r; } return { path, k }; }, pk = CZ.rig(gp, (o) => M[o.k] > 1), path = pk.path, k = pk.k; Pk.balls.push({ path, k, t: 0, bet: CZ.bet, hue: rand(360) }); return true; };
    $('pkDrop').onclick = drop; $('pkTen').onclick = () => { let i = 0; const iv = setInterval(() => { if (++i > 10 || !cv.isConnected || !drop()) clearInterval(iv); }, 160); };
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 360, gap = 34, top = 30;
      const px = (row, col) => W / 2 + (col - row / 2) * gap, py = (row) => top + row * 24;
      g.clearRect(0, 0, W, H); const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1830'); bg.addColorStop(1, '#040810'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c <= r + 2; c++) { const x = W / 2 + (c - (r + 2) / 2) * gap, y = py(r) + 12; const hot = Pk.hits.some((h) => Math.abs(h.x - x) < 4 && Math.abs(h.y - y) < 4 && T - h.t < 0.25); g.fillStyle = hot ? '#fff' : '#6aa8ff'; g.shadowColor = '#6aa8ff'; g.shadowBlur = hot ? 16 : 4; g.beginPath(); g.arc(x, y, hot ? 5 : 3.5, 0, Math.PI * 2); g.fill(); }
      g.shadowBlur = 0;
      const bw = gap, by = py(ROWS) + 16;
      M.forEach((m, i) => { const x = W / 2 + (i - 6) * bw, lit = Pk.flash && Pk.flash.i === i && T - Pk.flash.t < 0.5; const c = m >= 7 ? '#ff3a5a' : m >= 1.6 ? '#ff9a3a' : m >= 1 ? '#ffe070' : '#5a8aff'; g.fillStyle = lit ? '#fff' : c; g.fillRect(x - bw / 2 + 2, by + (lit ? 4 : 0), bw - 4, 26); g.fillStyle = '#000'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('×' + m, x, by + 17 + (lit ? 4 : 0)); });
      for (const b of Pk.balls) {
        b.t += dt * 7; const row = Math.floor(b.t), f = b.t - row;
        let col = 0; for (let i = 0; i < Math.min(row, ROWS); i++) col += b.path[i];
        if (row >= ROWS) { b.done = true; const win = Math.floor(b.bet * M[b.k]); Pk.flash = { i: b.k, t: T }; CZ.give(win, b.bet); CZ.beep(400 + b.k * 60, 0.1, 'sine', 0.06); CZ.res(st, `×${M[b.k]} · ${win} ₽`, win > b.bet ? true : win === b.bet ? null : false); continue; }
        const nc = col + b.path[row], x0 = px(row, col), x1 = px(row + 1, nc), x = x0 + (x1 - x0) * f, y = py(row) + (py(row + 1) - py(row)) * f - Math.sin(f * Math.PI) * 10;
        if (f < dt * 7 + 0.01) { Pk.hits.push({ x: x0 + 0, y: py(row) + 12, t: T }); CZ.beep(1400 + Math.random() * 400, 0.015, 'triangle', 0.02); }
        g.fillStyle = `hsl(${b.hue},90%,60%)`; g.shadowColor = g.fillStyle; g.shadowBlur = 12; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      }
      Pk.balls = Pk.balls.filter((b) => !b.done); Pk.hits = Pk.hits.filter((h) => T - h.t < 0.3);
    });
  },

  // ----- crash: the rocket climbs, cash out before it explodes -----
  crash(st) {
    const C = CZG.crS = CZG.crS || { run: null, hist: [], auto: 0 };
    const cv = CZ.canvas(st, 520, 300);
    st.insertAdjacentHTML('beforeend', `<div class="czAct"><button class="big" id="crGo">🚀 LAUNCH</button><button class="big" id="crCash" disabled>💰 CASH OUT</button><label class="czAuto">auto cash-out ×<input id="crAuto" type="number" min="0" step="0.1" value="${C.auto || ''}" placeholder="off"></label></div><div class="rHist" id="crHist"></div>`);
    const hist = () => { $('crHist').innerHTML = C.hist.map((m) => `<span style="background:${m >= 2 ? '#1f9a4a' : '#8a2a2a'}">×${m.toFixed(2)}</span>`).join(''); };
    const cash = () => { const r = C.run; if (!r || r.out || r.boom) return; r.out = r.m; CZ.busy = false; const win = Math.floor(r.bet * r.m); CZ.give(win, r.bet); $('crCash').disabled = true; CZ.res(st, `Cashed out at ×${r.m.toFixed(2)} · +${win} ₽`, true); Sfx.play('stash'); };
    $('crAuto').onchange = (e) => { C.auto = +e.target.value || 0; };
    $('crGo').onclick = () => { if (C.run && !C.run.done) return; if (!CZ.take(CZ.bet)) return; C.run = { t: 0, m: 1, at: CZ.rig(() => Math.max(1, 0.97 / (1 - Math.random())), (a) => a >= (C.auto > 1 ? C.auto : 2)), bet: CZ.bet, pts: [] }; CZ.busy = true; $('crCash').disabled = false; $('crGo').disabled = true; CZ.res(st, 'Climbing…'); };
    $('crCash').onclick = cash;
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 300, r = C.run;
      if (r && !r.done) {
        if (!r.boom) { r.t += dt; r.m = Math.pow(Math.E, 0.11 * r.t * (1 + r.t * 0.02)); r.pts.push([r.t, r.m]); if (C.auto > 1 && !r.out && r.m >= C.auto) cash(); if (Math.floor(r.m * 10) !== r.lb) { r.lb = Math.floor(r.m * 10); CZ.beep(300 + r.m * 80, 0.02, 'sine', 0.02); } }
        if (r.m >= r.at && !r.boom) { r.boom = T; r.m = r.at; Sfx.play('boom'); if (!r.out) CZ.res(st, `💥 CRASHED at ×${r.at.toFixed(2)} · lost ${r.bet} ₽`, false); C.hist.unshift(r.at); C.hist = C.hist.slice(0, 12); hist(); $('crCash').disabled = true; }
        if (r.boom && T - r.boom > 1.2) { r.done = true; CZ.busy = false; $('crGo').disabled = false; }
      }
      g.clearRect(0, 0, W, H); g.fillStyle = '#060a14'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 10) / 20})`; g.fillRect(((i * 97 + T * 20 * (1 + (i % 3))) % W), (i * 53) % H, 2, 2); }
      const tMax = Math.max(8, r ? r.t * 1.15 : 8), mMax = Math.max(2, r ? r.m * 1.2 : 2), X = (t) => 40 + (t / tMax) * (W - 60), Y = (m) => H - 30 - ((m - 1) / (mMax - 1)) * (H - 60);
      g.strokeStyle = '#223'; g.lineWidth = 1; g.fillStyle = '#667'; g.font = '11px sans-serif'; g.textAlign = 'right';
      for (let k = 0; k <= 4; k++) { const m = 1 + ((mMax - 1) * k) / 4; g.beginPath(); g.moveTo(40, Y(m)); g.lineTo(W - 10, Y(m)); g.stroke(); g.fillText('×' + m.toFixed(1), 36, Y(m) + 4); }
      if (r && r.pts.length > 1) {
        const col = r.boom ? '#ff3a3a' : r.out ? '#7aff9a' : '#ffcf3a';
        g.beginPath(); g.moveTo(X(0), Y(1)); for (const [t, m] of r.pts) g.lineTo(X(t), Y(m)); g.lineTo(X(r.t), Y(1)); g.closePath(); g.fillStyle = col + '22'; g.fill();
        g.beginPath(); for (const [t, m] of r.pts) g.lineTo(X(t), Y(m)); g.strokeStyle = col; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0;
        const [lt, lm] = r.pts[r.pts.length - 1]; g.font = '30px serif'; g.textAlign = 'center';
        if (r.boom) { const k = (T - r.boom) * 60; for (let i = 0; i < 14; i++) { const a = i * 0.45; g.fillStyle = i % 2 ? '#ffcf3a' : '#ff3a3a'; g.beginPath(); g.arc(X(lt) + Math.cos(a) * k, Y(lm) + Math.sin(a) * k, Math.max(0, 8 - k / 10), 0, Math.PI * 2); g.fill(); } g.fillText('💥', X(lt), Y(lm) + 10); }
        else g.fillText('🚀', X(lt), Y(lm) + 10);
      }
      g.textAlign = 'center'; g.font = 'bold 54px sans-serif'; g.fillStyle = r ? (r.boom ? '#ff3a3a' : r.out ? '#7aff9a' : '#fff') : '#fff'; g.fillText('×' + (r ? r.m : 1).toFixed(2), W / 2, 80);
      if (r && r.out) { g.font = 'bold 16px sans-serif'; g.fillStyle = '#7aff9a'; g.fillText('cashed at ×' + r.out.toFixed(2), W / 2, 104); }
    });
    hist();
  },

  // ----- dice: pick a target, roll under it; the lower the target, the bigger the payout -----
  dice(st) {
    const D = CZG.dS = CZG.dS || { tgt: 50, roll: null, anim: 0, hist: [] };
    const cv = CZ.canvas(st, 520, 180);
    st.insertAdjacentHTML('beforeend', '<div class="czAct dice"><label>Roll under <b id="dT"></b><input type="range" id="dR" min="2" max="95" value="' + D.tgt + '"></label><span id="dP"></span><button class="big" id="dGo">🎲 ROLL</button></div><div class="rHist" id="dHist"></div>');
    const mult = () => Math.floor((97 / D.tgt) * 100) / 100;
    const upd = () => { $('dT').textContent = D.tgt; $('dP').textContent = `win chance ${D.tgt}% · pays ×${mult()}`; $('dHist').innerHTML = D.hist.map(([n, w]) => `<span style="background:${w ? '#1f9a4a' : '#8a2a2a'}">${n}</span>`).join(''); };
    $('dR').oninput = (e) => { D.tgt = +e.target.value; upd(); };
    $('dGo').onclick = () => { if (D.anim > 0) return; if (!CZ.take(CZ.bet)) return; D.bet = CZ.bet; D.final = CZ.rig(() => Math.floor(Math.random() * 100) + 1, (f) => f < D.tgt); D.anim = 1; };
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 180;
      if (D.anim > 0) { D.anim -= dt * 1.1; D.roll = D.anim > 0 ? Math.floor(Math.random() * 100) + 1 : D.final; if (Math.random() < 0.5) CZ.beep(900 + Math.random() * 600, 0.015, 'square', 0.02);
        if (D.anim <= 0) { const w = D.final < D.tgt, win = w ? Math.floor(D.bet * mult()) : 0; D.hist.unshift([D.final, w]); D.hist = D.hist.slice(0, 14); CZ.give(win, D.bet); CZ.res(st, w ? `${D.final} < ${D.tgt} · +${win} ₽` : `${D.final} ≥ ${D.tgt} · lost ${D.bet} ₽`, w); Sfx.play(w ? 'quest' : 'hurt'); upd(); } }
      g.clearRect(0, 0, W, H); g.fillStyle = '#0c0c14'; g.fillRect(0, 0, W, H);
      const bx = 30, bw = W - 60, by = 120, x = (v) => bx + (v / 100) * bw;
      g.fillStyle = '#1f9a4a'; g.fillRect(bx, by, x(D.tgt) - bx, 16); g.fillStyle = '#8a2a2a'; g.fillRect(x(D.tgt), by, bx + bw - x(D.tgt), 16);
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.textAlign = 'center'; for (const v of [0, 25, 50, 75, 100]) g.fillText(v, x(v), by + 32);
      if (D.roll != null) { const px = x(D.roll); g.fillStyle = '#ffe070'; g.beginPath(); g.moveTo(px, by - 2); g.lineTo(px - 8, by - 16); g.lineTo(px + 8, by - 16); g.fill(); }
      const s = 1 + (D.anim > 0 ? Math.sin(T * 40) * 0.05 : 0); g.save(); g.translate(W / 2, 60); g.rotate(D.anim > 0 ? Math.sin(T * 30) * 0.2 : 0); g.scale(s, s);
      g.fillStyle = '#f4ecd8'; g.shadowColor = '#ffe070'; g.shadowBlur = 20; g.beginPath(); g.roundRect ? g.roundRect(-44, -40, 88, 80, 14) : g.rect(-44, -40, 88, 80); g.fill(); g.shadowBlur = 0;
      g.fillStyle = D.roll != null && D.anim <= 0 ? (D.roll < D.tgt ? '#1f9a4a' : '#c8202a') : '#222'; g.font = 'bold 40px sans-serif'; g.fillText(D.roll == null ? '?' : D.roll, 0, 14); g.restore();
    });
    upd();
  },

  // ----- coin ladder: double or nothing, cash out whenever -----
  coin(st) {
    const K = CZG.kS = CZG.kS || { pot: 0, step: 0 };
    st.insertAdjacentHTML('beforeend', '<div class="coinStage"><div class="coin3d" id="kCoin"><div class="cf h">☢️</div><div class="cf t">💀</div></div><div class="ladder" id="kLad"></div></div><div class="czAct"><button class="big" id="kGo"></button><button class="big ghost" id="kCash">💰 CASH OUT</button></div>');
    const show = () => { $('kLad').innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="${i < K.step ? 'on' : ''}">×${Math.pow(2, 10 - i >= 0 ? i + 1 : 0)}</span>`).reverse().join(''); $('kGo').textContent = K.pot ? `🪙 FLIP · ${K.pot * 2} ₽` : `🪙 START · ${CZ.bet} ₽`; $('kCash').disabled = !K.pot; CZ.res(st, K.pot ? `On the table: ${K.pot} ₽` : 'Heads ☢️ doubles it, tails 💀 loses it all.'); };
    $('kGo').onclick = () => {
      if (CZ.busy) return;
      if (!K.pot) { if (!CZ.take(CZ.bet)) return; K.pot = CZ.bet; K.stake = CZ.bet; K.step = 0; }
      const heads = CZ.rig(() => Math.random() < 0.5, (h) => h), c = $('kCoin'); CZ.busy = true;
      c.style.transition = 'none'; c.style.transform = 'rotateY(0deg)'; void c.offsetWidth; c.style.transition = 'transform 1.2s cubic-bezier(.2,.7,.3,1)'; c.style.transform = `rotateY(${1800 + (heads ? 0 : 180)}deg)`;
      for (let i = 0; i < 8; i++) setTimeout(() => CZ.beep(1600 - i * 100, 0.02, 'triangle', 0.03), i * 120);
      setTimeout(() => { CZ.busy = false; if (!$('kGo')) return; if (heads) { K.pot *= 2; K.step++; Sfx.play('coin'); show(); } else { CZ.res(st, `💀 Tails · lost ${K.pot} ₽`, false); Sfx.play('hurt'); K.pot = 0; K.step = 0; setTimeout(() => $('kGo') && show(), 1200); } }, 1250);
    };
    $('kCash').onclick = () => { if (!K.pot || CZ.busy) return; CZ.give(K.pot, K.stake); const p = K.pot; K.pot = 0; K.step = 0; show(); CZ.res(st, `Cashed out ${p} ₽`, true); Sfx.play('stash'); };
    show();
  },

  // ----- zone wheel: a big wheel of fortune, plus one free spin every day -----
  wheel(st) {
    const SEG = [[0, '#3a2a28'], [1.5, '#2a4a5a'], [0.5, '#4a3a2a'], [2, '#5a4a2a'], [0, '#3a2a28'], [1.2, '#2a5a3a'], [0.5, '#4a3a2a'], [3, '#6a3a6a'], [0, '#3a2a28'], [1.5, '#2a4a5a'], [0.5, '#4a3a2a'], [5, '#8a6a1a'], [0, '#3a2a28'], [1.2, '#2a5a3a'], [2, '#5a4a2a'], [10, '#aa2a4a'], [0.5, '#4a3a2a'], [1.5, '#2a4a5a'], [0, '#3a2a28'], [2, '#5a4a2a']];
    const Wh = CZG.whS = CZG.whS || { a: 0, spin: null, last: -1 };
    const c = CZ.st(), today = new Date().toDateString(), free = c.free !== today;
    const cv = CZ.canvas(st, 520, 320);
    st.insertAdjacentHTML('beforeend', `<div class="czAct"><button class="big" id="whGo">🎡 SPIN · bet</button>${free ? `<button class="big pulse" id="whFree">🎁 FREE DAILY SPIN · ${100 * (CZ.vip() + 1)} ₽</button>` : ''}</div>`);
    const spin = (bet, isFree) => {
      if (Wh.spin) return; if (!isFree && !CZ.take(bet)) return;
      const i = CZ.rig(() => Math.floor(Math.random() * SEG.length), (x) => SEG[x][0] > 1), seg = (Math.PI * 2) / SEG.length;
      const target = -(i * seg + seg / 2), end = Wh.a - ((Wh.a - target) % (Math.PI * 2)) - Math.PI * 2 * 6 + (Math.random() - 0.5) * seg * 0.6;
      Wh.spin = { t: 0, T: 4.5, a0: Wh.a, a1: end, i, bet, free: isFree, lastSeg: -1 }; CZ.busy = true;
    };
    $('whGo').onclick = () => spin(CZ.bet, false);
    const fb = $('whFree'); if (fb) fb.onclick = () => { c.free = today; Save.save(); fb.remove(); spin(100 * (CZ.vip() + 1), true); };
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 320, cx = W / 2, cy = 165, r = 140, seg = (Math.PI * 2) / SEG.length;
      if (Wh.spin) {
        const s = Wh.spin; s.t += dt; Wh.a = s.a0 + (s.a1 - s.a0) * ease(s.t / s.T);
        const cur = Math.floor(((-Wh.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg); if (cur !== s.lastSeg) { s.lastSeg = cur; CZ.beep(1800, 0.015, 'square', 0.03); }
        if (s.t >= s.T) { Wh.spin = null; CZ.busy = false; Wh.last = s.i; const m = SEG[s.i][0], win = Math.floor(s.bet * m); CZ.give(win, s.free ? 0.0001 : s.bet); CZ.res(st, m ? `×${m} · ${win} ₽` : '💀 ×0 · the Zone takes it', m > 1 ? true : m ? null : false); Sfx.play(m > 1 ? 'quest' : m ? 'coin' : 'hurt'); }
      }
      g.clearRect(0, 0, W, H);
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, on = (i + Math.floor(T * (Wh.spin ? 14 : 4))) % 2 === 0; g.fillStyle = on ? '#ffe070' : '#5a4020'; g.shadowColor = '#ffe070'; g.shadowBlur = on ? 10 : 0; g.beginPath(); g.arc(cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14), 4, 0, Math.PI * 2); g.fill(); }
      g.shadowBlur = 0;
      SEG.forEach(([m, col], i) => {
        const a0 = Wh.a + i * seg - Math.PI / 2; g.fillStyle = Wh.last === i && !Wh.spin && Math.sin(T * 10) > 0 ? '#ffe070' : col; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a0 + seg); g.closePath(); g.fill(); g.strokeStyle = '#d4a640'; g.lineWidth = 2; g.stroke();
        g.save(); g.translate(cx, cy); g.rotate(a0 + seg / 2); g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'right'; g.fillText(m ? '×' + m : '💀', r - 10, 5); g.restore();
      });
      g.fillStyle = '#d4a640'; g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2a1a0a'; g.font = '20px serif'; g.textAlign = 'center'; g.fillText('☢️', cx, cy + 7);
      g.fillStyle = '#ff3a3a'; g.beginPath(); g.moveTo(cx, cy - r + 12); g.lineTo(cx - 12, cy - r - 16); g.lineTo(cx + 12, cy - r - 16); g.fill();
    });
  },

  // ----- Mastery exchange -----
  xch(st) {
    st.insertAdjacentHTML('beforeend', `<div class="casino"><p class="dim">Turn rubles into Mastery XP: 2 ₽ = 1 XP. Mastery levels give points for endless upgrades.</p><div class="czAct"><button class="big" id="xGo">🌟 EXCHANGE THE BET</button></div></div>`);
    $('xGo').onclick = () => { const v = CZ.bet; if (Save.data.rubles < v) { CZ.shake(); return; } Save.data.rubles -= v; const ups = Mastery.gain(v / 2); CZ.top(); CZ.res(st, `+${Math.floor(v / 2)} Mastery XP` + (ups ? ` · +${ups} Mastery level${ups > 1 ? 's' : ''}!` : ''), true); Sfx.play('quest'); if (ups) CZ.coins(20); };
  },
};

addEventListener('DOMContentLoaded', () => {
  BunkerUI.rou = function (el) { CZ.busy = false; CZ.ui(el); };
  const t = document.querySelector('[data-bt="rou"]'); if (t) t.textContent = '🎰 Casino';
});
