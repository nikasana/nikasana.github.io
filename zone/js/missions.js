'use strict';
// ---------- MISSIONS HUB (Tanki-style): daily and weekly missions, daily login bonus, Zone Pass, containers, happy hours by timezone ----------
const MS_POOL = [
  ['kills', 'Kill {n} mutants', 300], ['arts', 'Collect {n} artifacts', 4], ['bosses', 'Kill {n} bosses', 1], ['contracts', 'Complete {n} contracts', 3],
  ['mins', 'Survive {n} minutes in total', 15], ['wins', 'Win {n} stage', 1], ['runs', 'Play {n} runs', 3], ['casino', 'Play {n} casino games', 10],
];
const MS_BONUS = [300, 500, 800, 'c:common', 1500, 2500, 'c:epic'];
const MS_BOX = {
  common: ['📦', 'Common Container', '#9ab0c0', 1000], rare: ['🎁', 'Rare Container', '#4d9aff', 5000],
  epic: ['💼', 'Epic Container', '#b56cff', 20000], legend: ['👑', 'Legendary Container', '#ffcf3a', 100000],
};
const MS_TIERS = 60;
// happy hours in YOUR local time; bonuses apply to runs started during them
const MS_HOURS = [
  ['🌅', 'Morning Shift', 7, 10, '+25% experience', (P) => { P.xpMul += 0.25; }],
  ['🍲', 'Lunch Break', 12, 14, '+50% rubles', () => { G.rubBonus = (G.rubBonus || 1) + 0.5; }],
  ['🔥', 'Prime Time', 19, 23, '+25% rubles and +15% damage', (P) => { G.rubBonus = (G.rubBonus || 1) + 0.25; P.dmgMul += 0.15; }],
  ['🦉', 'Night Owl', 0, 4, '+2 luck and +20% experience', (P) => { P.luck += 2; P.xpMul += 0.2; }],
];
const MS_CITIES = [['Tbilisi', 'Asia/Tbilisi'], ['Kyiv', 'Europe/Kyiv'], ['Moscow', 'Europe/Moscow'], ['London', 'Europe/London'], ['New York', 'America/New_York'], ['Tokyo', 'Asia/Tokyo']];

const Missions = {
  page: 'daily',
  d() {
    const S = Save.data; S.ms = S.ms || { day: 0, week: 0, daily: [], weekly: [], swap: 0, stars: 0, season: '', claimed: {}, elite: false, boxes: {}, bonus: { last: 0, streak: 0, month: '', days: [] } };
    const M = S.ms, day = Meta.dayKey(), wk = Meta.weekKey(), now = new Date(), season = now.getFullYear() + '-' + (now.getMonth() + 1);
    if (M.day !== day) { M.day = day; M.swap = 0; M.daily = this.roll(3, 1, mulberry32(day * 7 + 1)); }
    if (M.week !== wk) { M.week = wk; M.weekly = this.roll(3, 6, mulberry32(wk * 13 + 5)); }
    if (M.season !== season) { M.season = season; M.stars = 0; M.claimed = {}; M.elite = false; }
    return M;
  },
  roll(n, mul, R) { const pool = MS_POOL.slice(), out = []; for (let i = 0; i < n; i++) { const c = pool.splice(Math.floor(R() * pool.length), 1)[0]; out.push(this.mk(c, mul)); } return out; },
  mk(c, mul) { const n = c[2] * mul; return { k: c[0], text: c[1].replace('{n}', n), n, p: 0, rw: Math.round(250 * mul * (c[0] === 'wins' || c[0] === 'bosses' ? 1.6 : 1)), st: mul > 1 ? 30 : 5, done: false, got: false }; },
  bump(k, v) {
    const M = this.d(); let hit = null;
    for (const m of M.daily.concat(M.weekly)) if (m.k === k && !m.done) { m.p = Math.min(m.n, m.p + v); if (m.p >= m.n) { m.done = true; hit = m; } }
    Save.save(); if (hit && G && !G.title) banner('📋 MISSION COMPLETE', hit.text + ' · claim it in Missions', 3, 'good');
    this.badge();
  },
  ready() { const M = this.d(); return M.daily.concat(M.weekly).filter((m) => m.done && !m.got).length + (this.bonusReady() ? 1 : 0) + this.passReady(); },
  badge() { const n = this.ready(); for (const b of document.querySelectorAll('.msBadge')) { b.textContent = n || ''; b.style.display = n ? '' : 'none'; } },
  tier() { return Math.min(MS_TIERS, Math.floor(this.d().stars / 10)); },
  passReady() { const M = this.d(), t = this.tier(); let n = 0; for (let i = 1; i <= t; i++) { if (!M.claimed['f' + i]) n++; if (M.elite && !M.claimed['e' + i]) n++; } return n; },
  bonusReady() { return this.d().bonus.last !== Meta.dayKey(); },
  hourNow() { const h = new Date().getHours(); return MS_HOURS.filter((x) => h >= x[2] && h < x[3]).concat(new Date().getDay() % 6 === 0 ? [['🎉', 'Weekend Bonus', 0, 24, '+25% rubles', () => { G.rubBonus = (G.rubBonus || 1) + 0.25; }]] : []); },
  give(r, why) {
    const S = Save.data;
    if (typeof r === 'number') { S.rubles += r; return r + ' ₽'; }
    if (r.startsWith('c:')) { const t = r.slice(2), M = this.d(); M.boxes[t] = (M.boxes[t] || 0) + 1; return MS_BOX[t][0] + ' ' + MS_BOX[t][1]; }
    if (r.startsWith('x:')) { Mastery.gain(+r.slice(2)); return '🌟 ' + r.slice(2) + ' Mastery XP'; }
    if (r.startsWith('s:')) { S.supplies = S.supplies || {}; const s = SUPPLIES.find((x) => x[0] === r.slice(2)); S.supplies[s[0]] = Math.min(5, (S.supplies[s[0]] || 0) + 1); return s[1] + ' ' + s[2]; }
    if (r === 'sp') { S.sp = (S.sp || 0) + 1; return '🎓 1 skill point'; }
    return '';
  },
  passReward(i, elite) {
    if (elite) return i % 10 === 0 ? 'c:legend' : i % 5 === 0 ? 'c:epic' : i % 3 === 0 ? 's:' + SUPPLIES[i % SUPPLIES.length][0] : i % 2 ? 'x:' + (200 + i * 20) : 600 + i * 120;
    return i % 10 === 0 ? 'c:epic' : i % 5 === 0 ? 'c:rare' : i % 4 === 0 ? 'sp' : i % 3 === 0 ? 'c:common' : 250 + i * 60;
  },
  rwLabel(r) { if (typeof r === 'number') return r + ' ₽'; if (r.startsWith('c:')) return MS_BOX[r.slice(2)][0]; if (r.startsWith('x:')) return '🌟' + r.slice(2); if (r.startsWith('s:')) return SUPPLIES.find((x) => x[0] === r.slice(2))[1]; if (r === 'sp') return '🎓'; return ''; },
  toast(txt) { let t = $('msToast'); if (!t) { t = document.createElement('div'); t.id = 'msToast'; document.body.appendChild(t); } t.textContent = txt; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); },

  ui(el) {
    const M = this.d(), pages = [['daily', '📋', 'Daily Missions'], ['weekly', '📅', 'Weekly Missions'], ['bonus', '🎁', 'Daily Bonus'], ['pass', '⭐', 'Zone Pass'], ['boxes', '📦', 'Containers'], ['hours', '⏰', 'Happy Hours']];
    const dot = (id) => ({ daily: M.daily.some((m) => m.done && !m.got), weekly: M.weekly.some((m) => m.done && !m.got), bonus: this.bonusReady(), pass: this.passReady() > 0, boxes: Object.values(M.boxes).some((n) => n > 0) })[id];
    el.innerHTML = `<div class="msTabs">${pages.map(([id, ic, nm]) => `<button class="msTab ${id === this.page ? 'sel' : ''}" data-msp="${id}"><span>${ic}</span>${nm}${dot(id) ? '<i class="msDot"></i>' : ''}</button>`).join('')}</div><div class="msBody" id="msBody"></div>`;
    for (const b of el.querySelectorAll('[data-msp]')) b.onclick = () => { this.page = b.dataset.msp; Sfx.init(); Sfx.play('beep'); this.ui(el); this.tr(el); };
    this.el = el; this['p_' + this.page]($('msBody')); this.badge();
  },
  tr(el) { if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(el || this.el); } catch (e) { /* keep english */ } },
  re() { if (this.el && this.el.isConnected) { this.ui(this.el); this.tr(); } menuRubles(); },
  reset() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); const s = Math.floor((m - n) / 1000); return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; },
  mcard(m, i, kind) {
    const pct = Math.round((m.p / m.n) * 100);
    return `<div class="msCard ${m.got ? 'got' : m.done ? 'done' : ''}"><div class="msIc">${({ kills: '🔫', arts: '💎', bosses: '💀', contracts: '📜', mins: '⏱️', wins: '🏁', runs: '🏃', casino: '🎰' })[m.k]}</div><div class="msMid"><b>${m.text}</b><i class="bar"><i style="width:${pct}%"></i></i><small>${m.p}/${m.n}</small></div><div class="msRw"><span>${m.rw} ₽</span><span>⭐ ${m.st}</span>${m.got ? '<em>✅ CLAIMED</em>' : m.done ? `<button class="big small" data-msc="${kind}:${i}">CLAIM</button>` : kind === 'd' ? `<button class="big ghost small" data-msw="${i}">${this.d().swap ? '🔄 500 ₽' : '🔄 FREE'}</button>` : ''}</div></div>`;
  },
  bindCards(st) {
    const M = this.d();
    for (const b of st.querySelectorAll('[data-msc]')) b.onclick = () => { const [k, i] = b.dataset.msc.split(':'), m = (k === 'd' ? M.daily : M.weekly)[+i]; if (!m.done || m.got) return; m.got = true; Save.data.rubles += m.rw; M.stars += m.st; let extra = ''; if (Math.random() < (k === 'w' ? 1 : 0.25)) extra = ' + ' + this.give(k === 'w' ? 'c:rare' : 'c:common'); Save.save(); Sfx.init(); Sfx.play('quest'); this.toast('+' + m.rw + ' ₽ · ⭐ ' + m.st + extra); this.re(); };
    for (const b of st.querySelectorAll('[data-msw]')) b.onclick = () => { const i = +b.dataset.msw, m = M.daily[i]; if (m.done) return; if (M.swap && Save.data.rubles < 500) return; if (M.swap) Save.data.rubles -= 500; M.swap++; const used = M.daily.map((x) => x.k), pool = MS_POOL.filter((c) => !used.includes(c[0])); M.daily[i] = this.mk(pick(pool), 1); Save.save(); Sfx.init(); Sfx.play('beep'); this.re(); };
  },
  p_daily(st) { const M = this.d(); st.innerHTML = `<div class="sect">DAILY MISSIONS · new ones in ${this.reset()} · one free change a day</div>` + M.daily.map((m, i) => this.mcard(m, i, 'd')).join(''); this.bindCards(st); },
  p_weekly(st) { const M = this.d(); st.innerHTML = '<div class="sect">WEEKLY MISSIONS · bigger goals, every one gives a Rare Container</div>' + M.weekly.map((m, i) => this.mcard(m, i, 'w')).join(''); this.bindCards(st); },
  p_bonus(st) {
    const M = this.d(), B = M.bonus, today = Meta.dayKey(), ready = B.last !== today;
    const now = new Date(), ym = now.getFullYear() + '-' + (now.getMonth() + 1); if (B.month !== ym) { B.month = ym; B.days = []; }
    const next = ready ? (this.wasYesterday(B.last) ? B.streak % 7 : 0) : (B.streak - 1) % 7;
    let h = `<div class="sect">DAILY BONUS · log in every day, the 7th day gives an Epic Container · streak ${B.streak}</div><div class="msWeek">`;
    MS_BONUS.forEach((r, i) => { const got = ready ? i < next : i <= next; h += `<div class="msDay ${got ? 'got' : ''} ${ready && i === next ? 'today' : ''}"><small>DAY ${i + 1}</small><b>${this.rwLabel(r)}</b>${got ? '<em>✅</em>' : ''}</div>`; });
    h += `</div><div class="czAct">${ready ? '<button class="big pulse" id="msClaimDay">🎁 CLAIM TODAY\'S BONUS</button>' : `<em>Come back in ${this.reset()}</em>`}</div>`;
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    h += `<div class="sect">THIS MONTH · ${B.days.length}/${dim} days · every 7 days in a month gives a Legendary chance</div><div class="msCal">`;
    for (let d = 1; d <= dim; d++) h += `<span class="${B.days.includes(d) ? 'on' : ''} ${d === now.getDate() ? 'td' : ''}">${d}</span>`;
    st.innerHTML = h + '</div>';
    const c = $('msClaimDay'); if (c) c.onclick = () => {
      const cont = this.wasYesterday(B.last), i = cont ? B.streak % 7 : 0; B.streak = cont ? B.streak + 1 : 1; B.last = today; B.days.push(now.getDate());
      let got = this.give(MS_BONUS[i]); if (B.days.length % 7 === 0 && Math.random() < 0.5) got += ' + ' + this.give('c:legend');
      Save.save(); Sfx.init(); Sfx.play('legend'); this.toast('🎁 ' + got); if (typeof CZ !== 'undefined') CZ.coins(24); this.re();
    };
  },
  wasYesterday(k) { const d = new Date(); d.setDate(d.getDate() - 1); return k === d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); },
  p_pass(st) {
    const M = this.d(), t = this.tier(), end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), days = Math.ceil((end - new Date()) / 864e5);
    let h = `<div class="sect">ZONE PASS · season ends in ${days} days · earn ⭐ from missions (10 ⭐ per tier)</div><div class="msPassTop"><b>TIER ${t}/${MS_TIERS}</b><i class="bar"><i style="width:${(M.stars % 10) * 10}%"></i></i><span>⭐ ${M.stars}</span>${M.elite ? '<em class="elite">👑 ELITE PASS</em>' : `<button class="big small" id="msElite"><span class="${Save.data.rubles >= 25000 ? 'afford' : 'poor'}">👑 ELITE PASS · 25000 ₽</span></button>`}${t < MS_TIERS ? `<button class="big ghost small" id="msStar"><span class="${Save.data.rubles >= 1500 ? 'afford' : 'poor'}">+1 TIER · 1500 ₽</span></button>` : ''}</div><div class="msPass">`;
    for (let i = 1; i <= MS_TIERS; i++) {
      const f = this.passReward(i, false), e = this.passReward(i, true), open = i <= t;
      const cell = (k, r, lock) => { const got = M.claimed[k + i]; return `<button class="msPc ${got ? 'got' : open && !lock ? 'open' : ''} ${k === 'e' ? 'el' : ''}" data-mpc="${k}${i}" ${got || !open || lock ? 'disabled' : ''}>${this.rwLabel(r)}${got ? '<i>✅</i>' : lock ? '<i>🔒</i>' : ''}</button>`; };
      h += `<div class="msPcol ${i === t ? 'cur' : ''}"><small>${i}</small>${cell('f', f, false)}${cell('e', e, !M.elite)}</div>`;
    }
    st.innerHTML = h + '</div><div class="czAct"><button class="big" id="msAll">CLAIM ALL</button></div>';
    const cur = st.querySelector('.msPcol.cur'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    const claim = (k) => { const e = k[0] === 'e', i = +k.slice(1); if (M.claimed[k] || i > t || (e && !M.elite)) return ''; M.claimed[k] = 1; return this.give(this.passReward(i, e)); };
    for (const b of st.querySelectorAll('[data-mpc]')) b.onclick = () => { const g = claim(b.dataset.mpc); if (!g) return; Save.save(); Sfx.init(); Sfx.play('quest'); this.toast('⭐ ' + g); this.re(); };
    $('msAll').onclick = () => { let n = 0; for (let i = 1; i <= t; i++) for (const k of ['f', 'e']) if (claim(k + i)) n++; if (!n) return; Save.save(); Sfx.init(); Sfx.play('legend'); this.toast('⭐ ' + n + ' rewards claimed'); this.re(); };
    const el = $('msElite'); if (el) el.onclick = () => { if (Save.data.rubles < 25000) return; Save.data.rubles -= 25000; M.elite = true; Save.save(); Sfx.init(); Sfx.play('legend'); this.re(); };
    const sb = $('msStar'); if (sb) sb.onclick = () => { if (Save.data.rubles < 1500) return; Save.data.rubles -= 1500; M.stars = (Math.floor(M.stars / 10) + 1) * 10; Save.save(); Sfx.init(); Sfx.play('quest'); this.re(); };
  },
  // containers: a roll strip spins and stops on the prize
  loot(t) {
    const S = Save.data, R = Math.random(), base = { common: 1, rare: 4, epic: 15, legend: 70 }[t];
    if (R < 0.5) return Math.round(base * rand(300, 1400));
    if (R < 0.7) return 's:' + pick(SUPPLIES)[0];
    if (R < 0.85) return 'x:' + Math.round(base * rand(150, 500));
    if (R < 0.93) return 'sp';
    if (R < 0.985) return Math.round(base * rand(2500, 6000));
    const own = S.trophies || [], left = TROPHIES.filter((x) => !own.includes(x[1])); if (left.length) return 't:' + left[Math.min(left.length - 1, Math.floor(Math.random() * (t === 'legend' ? left.length : 5)))][1];
    return Math.round(base * 8000);
  },
  p_boxes(st) {
    const M = this.d();
    let h = '<div class="sect">CONTAINERS · open them for rubles, supplies, Mastery XP, skill points and rare trophies</div><div class="msBoxes">';
    for (const [t, [ic, nm, col, cost]] of Object.entries(MS_BOX)) { const n = M.boxes[t] || 0; h += `<div class="msBox" style="--c:${col}"><span>${ic}</span><b>${nm}</b><small>× ${n}</small><button class="big small" data-mbo="${t}" ${n ? '' : 'disabled'}>OPEN</button><button class="big ghost small" data-mbb="${t}"><span class="${Save.data.rubles >= cost ? 'afford' : 'poor'}">BUY ${cost} ₽</span></button></div>`; }
    st.innerHTML = h + '</div><div class="msRoll" id="msRoll"><div class="msStrip" id="msStrip"></div><i class="msPin"></i></div><div class="czRes" id="msRes"></div>';
    for (const b of st.querySelectorAll('[data-mbb]')) b.onclick = () => { const t = b.dataset.mbb, c = MS_BOX[t][3]; if (Save.data.rubles < c) return; Save.data.rubles -= c; M.boxes[t] = (M.boxes[t] || 0) + 1; Save.save(); Sfx.init(); Sfx.play('stash'); this.re(); };
    for (const b of st.querySelectorAll('[data-mbo]')) b.onclick = () => {
      const t = b.dataset.mbo; if (!(M.boxes[t] > 0) || this.rolling) return; M.boxes[t]--; this.rolling = true;
      const prize = this.loot(t), items = Array.from({ length: 40 }, (_, i) => (i === 34 ? prize : this.loot(t)));
      const lab = (r) => (typeof r === 'string' && r.startsWith('t:') ? TROPHIES.find((x) => x[1] === r.slice(2))[0] : this.rwLabel(r));
      const strip = $('msStrip'); strip.innerHTML = items.map((r, i) => `<div class="msIt ${i === 34 ? 'win' : ''}">${lab(r)}</div>`).join('');
      strip.style.transition = 'none'; strip.style.transform = 'translateX(0)'; void strip.offsetWidth;
      const w = strip.children[0].getBoundingClientRect().width + 6, box = $('msRoll').getBoundingClientRect().width, x = 34 * w + w / 2 - box / 2 + rand(-w * 0.3, w * 0.3);
      strip.style.transition = 'transform 4.2s cubic-bezier(.1,.7,.15,1)'; strip.style.transform = `translateX(${-x}px)`;
      for (let i = 0; i < 26; i++) setTimeout(() => { try { Sfx.init(); Sfx.tone(1500, 0.02, 'square', 0.03); } catch (e) { /* audio off */ } }, 4200 * (1 - Math.pow(1 - i / 26, 0.4)));
      setTimeout(() => {
        this.rolling = false; let got;
        if (typeof prize === 'string' && prize.startsWith('t:')) { const S = Save.data; S.trophies = S.trophies || []; S.trophies.push(prize.slice(2)); got = '🏆 ' + prize.slice(2); }
        else got = this.give(prize);
        Save.save(); Sfx.play('legend'); if (typeof CZ !== 'undefined') CZ.coins(30); const r = $('msRes'); if (r) { r.textContent = '🎉 ' + got; r.className = 'czRes win'; this.tr(r.parentNode); }
        menuRubles(); setTimeout(() => { if (!this.rolling) this.re(); }, 1800);
      }, 4300);
      Save.save();
    };
  },
  p_hours(st) {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'), now = new Date(), h = now.getHours(), act = this.hourNow();
    const off = -now.getTimezoneOffset() / 60;
    let x = `<div class="sect">HAPPY HOURS · your timezone: ${tz} (UTC${off >= 0 ? '+' : ''}${off}) · runs started during a happy hour get its bonus</div><div class="msClock"><b id="msClk">${now.toTimeString().slice(0, 8)}</b><small>${act.length ? '✅ ACTIVE NOW: ' + act.map((a) => a[0] + ' ' + a[1]).join(', ') : 'No happy hour right now'}</small></div><div class="msDayBar">`;
    for (let i = 0; i < 24; i++) { const hh = MS_HOURS.find((a) => i >= a[2] && i < a[3]); x += `<span class="${hh ? 'hh' : ''} ${i === h ? 'now' : ''}" title="${i}:00">${hh ? hh[0] : ''}<small>${i}</small></span>`; }
    x += '</div><div class="grid noCyber">' + MS_HOURS.map(([ic, nm, a, b, ds]) => `<div class="pick ${h >= a && h < b ? 'sel' : ''}"><div class="pi">${ic}</div><div><b>${nm}</b><small>${String(a).padStart(2, '0')}:00 – ${String(b).padStart(2, '0')}:00 · ${ds}</small></div></div>`).join('') + `<div class="pick ${now.getDay() % 6 === 0 ? 'sel' : ''}"><div class="pi">🎉</div><div><b>Weekend Bonus</b><small>Saturday and Sunday · +25% rubles</small></div></div></div>`;
    x += '<div class="sect">WORLD CLOCK · the Zone never sleeps</div><div class="msWorld">' + MS_CITIES.map(([n, z]) => { let t = '--:--', hr = 0; try { t = now.toLocaleTimeString('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit' }); hr = +t.slice(0, 2); } catch (e) { /* unknown zone */ } const hh = MS_HOURS.find((a) => hr >= a[2] && hr < a[3]); return `<div><b>${t}</b><small>${n}</small><em>${hh ? hh[0] + ' ' + hh[1] : '·'}</em></div>`; }).join('') + '</div>';
    st.innerHTML = x;
    clearInterval(this.clk); this.clk = setInterval(() => { const c = $('msClk'); if (!c) { clearInterval(this.clk); return; } c.textContent = new Date().toTimeString().slice(0, 8); }, 1000);
  },
};

// ----- hooks: mission progress from run stats, runs played, casino games; happy hour bonuses on run start -----
const _msStat = Story.stat.bind(Story);
Story.stat = function (k, v) { _msStat(k, v); if (!G || !G.tutorial) Missions.bump(k, v); };
const _msNew = newGame;
newGame = function (...a) {
  _msNew(...a);
  if (!G || G.title || G.tutorial) return;
  const act = Missions.hourNow(); for (const x of act) x[5](P);
  if (act.length) setTimeout(() => { if (G && !G.title) banner('⏰ ' + act.map((x) => x[1]).join(' + '), act.map((x) => x[4]).join(' · '), 3.5, 'good'); }, 3200);
};
if (typeof CZ !== 'undefined') { const _t = CZ.take.bind(CZ); CZ.take = function (v) { const ok = _t(v); if (ok) Missions.bump('casino', 1); return ok; }; }

addEventListener('DOMContentLoaded', () => {
  const _msEnd = endRun;
  endRun = function (kind, src) { const was = G && G.ended, r = _msEnd(kind, src); if (!was && G && !G.title && !G.tutorial) Missions.bump('runs', 1); return r; };
  const bar = $('bTabs'), body = $('bunker2'); if (!bar || !body) return;
  const b = document.createElement('button'); b.className = 'tab'; b.dataset.bt2 = 'ms'; b.innerHTML = '📋 Missions <i class="msBadge"></i>';
  b.onclick = () => { const cx = document.querySelector('[data-bt="codex"]'); if (cx) cx.click(); for (const x of bar.children) x.classList.remove('sel'); b.classList.add('sel'); body.classList.remove('cyberMap'); Missions.ui(body); Missions.tr(body); };
  bar.insertBefore(b, bar.children[0]);
  // title: a big missions button with a counter of rewards waiting
  const t = $('title');
  const bb = $('bunkerBtn');
  if (t && bb) { const mb = document.createElement('button'); mb.id = 'msTitleBtn'; mb.className = 'big ghost'; mb.innerHTML = '📋 MISSIONS & BONUSES <i class="msBadge"></i>'; mb.onclick = () => { openScreen('bunker'); buildBunker(); b.click(); }; bb.after(mb); }
  Missions.badge(); setInterval(() => Missions.badge(), 30000);
});
