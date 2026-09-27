'use strict';
// ---------- CYBERWARE: a big cyberpunk perk tree (5 attributes, 90 perks), a black market and a trophy hall ----------
// Perks and attribute levels are bought with rubles. Every attribute has its own branching shape.
const CW_STATS = {
  dmg: ['🎯', 'Smart Link', '+{v}% damage', 3, (P, v) => { P.dmgMul += v / 100; }],
  hp: ['🛡️', 'Subdermal Armor', '+{v}% max HP', 4, (P, v) => { const m = 1 + v / 100; P.maxhp = Math.round(P.maxhp * m); P.hp = Math.round(P.hp * m); }],
  spd: ['🦿', 'Reinforced Tendons', '+{v}% speed', 2, (P, v) => { P.spdMul += v / 100; }],
  rate: ['⚡', 'Synaptic Accelerator', '+{v}% fire rate', 2, (P, v) => { P.rateMul += v / 100; }],
  area: ['💥', 'Blast Coprocessor', '+{v}% area', 3, (P, v) => { P.areaMul += v / 100; }],
  xp: ['🧠', 'Neural Processor', '+{v}% experience', 4, (P, v) => { P.xpMul += v / 100; }],
  crit: ['👁️', 'Kiroshi Optics', '+{v}% crit chance', 1, (P, v) => { P.crit += v / 100; }],
  regen: ['💉', 'Biomonitor', '+{v} HP/s regen', 0.1, (P, v) => { P.regen += v; }],
  armor: ['🦴', 'Titanium Bones', '+{v}% damage resist', 1, (P, v) => { P.dr = Math.min(0.6, (P.dr || 0) + v / 100); }],
  pick: ['🧲', 'Mag Implant', '+{v} pickup range', 6, (P, v) => { P.pickup += v; }],
  luck: ['🍀', 'Fortune Chip', '+{v} luck', 1, (P, v) => { P.luck += v; }],
  rub: ['💰', 'Fixer Link', '+{v}% rubles', 3, (P, v) => { G.rubBonus = (G.rubBonus || 1) + v / 100; }],
  dash: ['💨', 'Kerenzikov', '+{v}% dash', 4, (P, v) => { P.dashMul += v / 100; }],
  steal: ['🩸', 'Blood Pump', '+{v}% lifesteal', 0.5, (P, v) => { P.lifesteal += v / 100; }],
  thorn: ['🌵', 'Pain Editor', '+{v} thorns', 3, (P, v) => { P.thorns += v; }],
  crd: ['☠️', 'Sandevistan', '+{v}% crit damage', 5, (P, v) => { P.critMul += v / 100; }],
  life: ['♻️', 'Second Heart', '+1 revive', 1, (P) => { P.revives += 1; }],
};
const CW_ATTRS = [
  ['body', '💪', 'BODY', '#ff4d6d', ['hp', 'armor', 'regen', 'thorn', 'steal', 'dmg', 'hp', 'armor', 'regen', 'thorn', 'steal', 'hp', 'armor', 'regen', 'dmg', 'steal', 'hp', 'life']],
  ['refl', '🏃', 'REFLEXES', '#ffcf3a', ['spd', 'dash', 'rate', 'crit', 'spd', 'dash', 'rate', 'crd', 'spd', 'crit', 'rate', 'dash', 'crd', 'spd', 'rate', 'crit', 'crd', 'life']],
  ['tech', '🔧', 'TECH', '#3ad6ff', ['area', 'dmg', 'pick', 'rate', 'area', 'dmg', 'pick', 'area', 'rate', 'dmg', 'area', 'pick', 'dmg', 'rate', 'area', 'dmg', 'area', 'life']],
  ['int', '💾', 'INTELLIGENCE', '#b56cff', ['xp', 'crit', 'xp', 'area', 'crd', 'xp', 'crit', 'luck', 'xp', 'crd', 'crit', 'xp', 'luck', 'crd', 'xp', 'crit', 'xp', 'life']],
  ['cool', '😎', 'COOL', '#4dff9a', ['rub', 'luck', 'crit', 'rub', 'pick', 'luck', 'rub', 'crd', 'luck', 'rub', 'crit', 'luck', 'rub', 'pick', 'crd', 'luck', 'rub', 'life']],
];
const CW_ROWS = [1, 3, 4, 4, 3, 2, 1]; // 18 perks per attribute, 90 in all
const CW_MAXLV = 20;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
// seeded layout: columns jitter per attribute, parents are the nearest nodes above, some nodes get a second (cross) link
const CW = (() => {
  const out = {};
  CW_ATTRS.forEach(([aid, , , , stats], ai) => {
    let s = 1013 + ai * 7919; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const nodes = []; let k = 0, prev = [];
    const used = {};
    CW_ROWS.forEach((n, row) => {
      const cols = [];
      for (let i = 0; i < n; i++) cols.push(n === 1 ? 2 + (row && row < 6 ? (rnd() - 0.5) * 1.6 : 0) : (i + 0.5) * (5 / n) - 0.5 + (rnd() - 0.5) * 0.7);
      const cur = [];
      cols.forEach((c) => {
        const st = stats[k], occ = used[st] = (used[st] || 0) + 1, cap = row === 6;
        const nd = { id: aid + k, i: k, row, col: Math.max(0, Math.min(4, c)), stat: st, name: CW_STATS[st][1] + ' ' + ROMAN[Math.min(7, occ - 1)], max: cap ? 1 : row >= 4 ? 2 : 3, par: [] };
        if (prev.length) {
          const by = prev.slice().sort((a, b) => Math.abs(a.col - nd.col) - Math.abs(b.col - nd.col));
          nd.par.push(by[0].id);
          if (by[1] && rnd() < 0.35 && Math.abs(by[1].col - nd.col) < 1.8) nd.par.push(by[1].id);
        }
        nodes.push(nd); cur.push(nd); k++;
      });
      // every node above must feed at least one node below (no dead ends except leaves by design)
      for (const p of prev) if (!cur.some((c) => c.par.includes(p.id)) && rnd() < 0.8) { const c = cur.slice().sort((a, b) => Math.abs(a.col - p.col) - Math.abs(b.col - p.col))[0]; c.par.push(p.id); }
      prev = cur;
    });
    out[aid] = nodes;
  });
  return out;
})();
const Cyberware = {
  d() { const S = Save.data; S.cw = S.cw || { lv: {}, r: {} }; return S.cw; },
  node(id) { for (const a in CW) { const n = CW[a].find((x) => x.id === id); if (n) return n; } return null; },
  val(n, r) { const b = CW_STATS[n.stat][3]; return Math.round(b * r * (1 + n.row * 0.35) * 10) / 10; },
  desc(n, r) { return n.stat === 'life' ? CW_STATS.life[2] : CW_STATS[n.stat][2].replace('{v}', this.val(n, r || 1)); },
  lvCost(l) { return Math.round(250 * Math.pow(1.32, l)); },
  cost(n, r) { return Math.round(180 * Math.pow(1.55, n.row) * (1 + r * 0.8) * (n.row === 6 ? 3 : 1)); },
  need(n) { return n.row * 3; },
  open(n) { const d = this.d(), a = n.id.replace(/\d+$/, ''); return (d.lv[a] || 0) >= this.need(n) && (!n.par.length || n.par.some((p) => (d.r[p] || 0) > 0)); },
  spent() { const d = this.d(); let t = 0; for (const a in d.lv) for (let l = 0; l < d.lv[a]; l++) t += this.lvCost(l); for (const id in d.r) { const n = this.node(id); if (n) for (let r = 0; r < d.r[id]; r++) t += this.cost(n, r); } return t; },
  count() { const d = this.d(); return Object.keys(d.r).filter((k) => d.r[k] > 0).length; },
  apply() { const d = this.d(); for (const id in d.r) { const n = this.node(id), r = d.r[id]; if (n && r) CW_STATS[n.stat][4](P, this.val(n, r)); } },
  ui(el) {
    const S = Save.data, d = this.d(); this.cur = this.cur || 'body';
    const A = CW_ATTRS.find((a) => a[0] === this.cur), nodes = CW[this.cur], lv = d.lv[this.cur] || 0, col = A[3];
    const tot = CW_ATTRS.reduce((t, a) => t + CW[a[0]].length, 0);
    const H = 7 * 130 + 40;
    let h = `<div class="sect">CYBERWARE · ${this.count()}/${tot} perks installed · ${this.spent()} ₽ invested</div><div class="cwAttrs">${CW_ATTRS.map(([id, ic, nm, c]) => `<button class="cwAt ${id === this.cur ? 'sel' : ''}" data-cwa="${id}" style="--c:${c}"><span>${ic}</span><b>${nm}</b><small>LV ${d.lv[id] || 0}</small></button>`).join('')}</div>`;
    const nxRow = Math.min(6, Math.floor(lv / 3) + 1), canLv = lv < CW_MAXLV, lvC = this.lvCost(lv);
    // pick the best next step for the player: the first perk they can install now
    const avail = nodes.filter((n) => this.open(n) && (d.r[n.id] || 0) < n.max);
    if (!this.sel || !nodes.some((x) => x.id === this.sel)) this.sel = (avail[0] || nodes[0]).id;
    const step = avail.length ? (avail.some((n) => S.rubles >= this.cost(n, d.r[n.id] || 0)) ? 2 : 0) : 1;
    h += `<div class="cwSteps" style="--c:${col}"><span class="${step === 1 ? 'on' : ''}">① ⬆ Level up ${A[2]}</span><span class="${step === 2 ? 'on' : ''}">② Tap a glowing perk</span><span class="${step === 2 ? 'on' : ''}">③ Tap INSTALL (or tap the perk again)</span></div>`;
    h += `<div class="cwHead" style="--c:${col}"><b>${A[1]} ${A[2]} · LV ${lv}/${CW_MAXLV}</b><i class="bar"><i style="width:${(lv / CW_MAXLV) * 100}%;background:${col}"></i></i>${canLv ? `<button class="big small cwBtn ${S.rubles >= lvC ? '' : 'cant'}" id="cwLv">⬆ LEVEL UP · ${lvC} ₽</button>${S.rubles >= lvC ? '' : `<em class="cwNeed">need ${lvC - S.rubles} ₽ more</em>`}` : '<em>MAX</em>'}<small>${canLv && lv < 18 ? `Next row of perks opens at LV ${nxRow * 3}.` : 'All rows are open.'}</small></div>`;
    const sn = nodes.find((x) => x.id === this.sel);
    {
      const r = d.r[sn.id] || 0, c = this.cost(sn, r), ok = this.open(sn);
      h += `<div class="cwInfo" style="--c:${col}"><span class="cwBig">${CW_STATS[sn.stat][0]}</span><div><b>${sn.name}</b><small>${this.desc(sn, Math.max(1, r))}${sn.max > 1 ? ' · rank ' + r + '/' + sn.max : ''}${r && r < sn.max ? ' · next: ' + this.desc(sn, r + 1) : ''}</small>${r >= sn.max ? '<em>✅ INSTALLED</em>' : ok ? `<button class="big small cwBtn ${S.rubles >= c ? '' : 'cant'}" id="cwBuy">INSTALL · ${c} ₽</button>${S.rubles >= c ? '' : `<em class="cwNeed">need ${c - S.rubles} ₽ more</em>`}` : `<em>🔒 needs ${A[2]} LV ${this.need(sn)} and a linked perk above</em>`}</div></div>`;
    }
    h += `<div class="cwTree" style="--c:${col};height:${H}px"><svg viewBox="0 0 500 ${H}" preserveAspectRatio="none">`;
    const X = (n) => (n.col + 0.5) * 100, Y = (n) => n.row * 130 + 50;
    for (let r = 1; r < 7; r++) h += `<text x="4" y="${r * 130 + 14}" class="cwReq ${lv >= r * 3 ? 'ok' : ''}">${lv >= r * 3 ? '' : '🔒 '}LV ${r * 3}</text><line x1="0" x2="500" y1="${r * 130 - 2}" y2="${r * 130 - 2}" class="cwRow"/>`;
    for (const n of nodes) for (const pid of n.par) {
      const p = nodes.find((x) => x.id === pid), on = (d.r[pid] || 0) > 0, mid = (Y(p) + Y(n)) / 2;
      h += `<polyline points="${X(p)},${Y(p) + 26} ${X(p)},${mid} ${X(n)},${mid} ${X(n)},${Y(n) - 26}" class="cwLink ${on ? 'on' : ''} ${on && (d.r[n.id] || 0) > 0 ? 'full' : ''}"/>`;
    }
    h += '</svg>';
    for (const n of nodes) {
      const r = d.r[n.id] || 0, ok = this.open(n), c = this.cost(n, r);
      h += `<button class="cwN ${r ? 'own' : ''} ${r >= n.max ? 'max' : ''} ${ok ? 'open' : 'lock'} ${n.row === 6 ? 'cap' : ''} ${this.sel === n.id ? 'sel' : ''}" data-cwn="${n.id}" style="left:${(n.col + 0.5) * 20}%;top:${Y(n)}px"><span>${CW_STATS[n.stat][0]}</span><i>${'◆'.repeat(r)}${'◇'.repeat(n.max - r)}</i></button>`;
      h += `<div class="cwLbl ${ok && r < n.max ? (S.rubles >= c ? 'buy' : 'poor') : ''} ${r ? 'got' : ''}" style="left:${(n.col + 0.5) * 20}%;top:${Y(n) + 30}px"><b>${this.desc(n, Math.min(n.max, r + 1))}</b><span>${r >= n.max ? '✅ MAX' : ok ? c + ' ₽' : '🔒 LV ' + this.need(n)}</span></div>`;
    }
    h += '</div>';
    el.innerHTML = h;
    const re = () => { this.ui(el); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(el); } catch (e) { /* keep english */ } };
    for (const b of el.querySelectorAll('[data-cwa]')) b.onclick = () => { this.cur = b.dataset.cwa; this.sel = null; Sfx.init(); Sfx.play('beep'); re(); };
    // first tap selects a perk, a second tap on the same perk installs it
    for (const b of el.querySelectorAll('[data-cwn]')) b.onclick = () => { if (this.sel === b.dataset.cwn && $('cwBuy')) { $('cwBuy').click(); return; } this.sel = b.dataset.cwn; Sfx.init(); Sfx.play('hint'); re(); };
    const lb = $('cwLv'); if (lb) lb.onclick = () => { const c = this.lvCost(lv); if (S.rubles < c) { lb.classList.add('shake'); setTimeout(() => lb.classList.remove('shake'), 400); return; } S.rubles -= c; d.lv[this.cur] = lv + 1; this.sel = null; Save.save(); menuRubles(); Sfx.init(); Sfx.play('level'); re(); };
    const bb = $('cwBuy'); if (bb) bb.onclick = () => { const r = d.r[sn.id] || 0, c = this.cost(sn, r); if (S.rubles < c || !this.open(sn)) { bb.classList.add('shake'); setTimeout(() => bb.classList.remove('shake'), 400); return; } S.rubles -= c; d.r[sn.id] = r + 1; if (r + 1 >= sn.max) this.sel = null; Save.save(); menuRubles(); Sfx.init(); Sfx.play(sn.row === 6 ? 'legend' : 'quest'); re(); };
  },
};

// ----- Black market: one-run supplies, bought now and used up on the next run -----
const SUPPLIES = [
  ['stim', '💊', 'Combat Stims', '+25% damage for the next run', 600, (P) => { P.dmgMul += 0.25; }],
  ['plate', '🛡️', 'Ceramic Plates', '+40% max HP for the next run', 600, (P) => { P.maxhp = Math.round(P.maxhp * 1.4); P.hp = P.maxhp; }],
  ['chip', '🧠', 'Learning Chip', '+40% experience for the next run', 700, (P) => { P.xpMul += 0.4; }],
  ['boots', '👟', 'Sprint Boots', '+15% speed for the next run', 500, (P) => { P.spdMul += 0.15; }],
  ['clover', '🍀', 'Lucky Charm', '+3 luck for the next run', 800, (P) => { P.luck += 3; }],
  ['ankh', '♻️', 'Spare Life', '+1 revive for the next run', 1500, (P) => { P.revives += 1; }],
  ['greed', '💰', 'Fixer Contract', '+50% rubles for the next run', 1200, () => { G.rubBonus = (G.rubBonus || 1) + 0.5; }],
  ['med', '🩹', 'Medkit Crate', '+3 medkits for the next run', 450, (P) => { P.items.medkit = (P.items.medkit || 0) + 3; }],
];
// ----- Trophy hall: pure bragging rights, prices climb to millions -----
const TROPHIES = [
  ['🥫', 'Tushonka Can', 1000], ['🔦', 'Old Flashlight', 2500], ['📻', 'Army Radio', 5000], ['🎸', 'Campfire Guitar', 8000], ['🧸', 'Pripyat Teddy', 12000],
  ['🪆', 'Matryoshka', 18000], ['🕰️', 'Cuckoo Clock', 25000], ['🗿', 'Monolith Shard', 40000], ['🎖️', 'Hero Medal', 60000], ['🏍️', 'Ural Motorcycle', 90000],
  ['🛰️', 'Fallen Satellite', 130000], ['🚁', 'Mi-24 Wreck', 200000], ['🏺', 'Golden Samovar', 300000], ['💎', 'Heart of the Zone', 500000], ['👑', 'Crown of the Wish Granter', 1000000],
];
const Market = {
  ui(el) {
    const S = Save.data; S.supplies = S.supplies || {}; S.trophies = S.trophies || [];
    let h = '<div class="sect">BLACK MARKET · supplies are used up on your next run (stack up to 5)</div><div class="grid noCyber">';
    for (const [id, ic, nm, ds, c] of SUPPLIES) { const n = S.supplies[id] || 0; h += `<button class="pick ${n ? 'sel' : ''}" data-sup="${id}"><div class="pi">${ic}</div><div><b>${nm}${n ? ' × ' + n : ''}</b><small>${ds}</small><em>${n >= 5 ? 'FULL' : `<span class="${S.rubles >= c ? 'afford' : 'poor'}">BUY ${c} ₽</span>`}</em></div></button>`; }
    h += `</div><div class="sect">TROPHY HALL · ${S.trophies.length}/${TROPHIES.length} · worth ${TROPHIES.filter((t) => S.trophies.includes(t[1])).reduce((a, t) => a + t[2], 0)} ₽</div><div class="trophies">`;
    h += TROPHIES.map(([ic, nm, c]) => { const own = S.trophies.includes(nm); return `<button class="trophy ${own ? 'own' : ''}" data-tro="${nm}"><span>${own ? ic : '❔'}</span><b>${nm}</b><small>${own ? 'OWNED' : `<span class="${S.rubles >= c ? 'afford' : 'poor'}">${c} ₽</span>`}</small></button>`; }).join('');
    el.innerHTML = h + '</div>';
    const re = () => { this.ui(el); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(el); } catch (e) { /* keep english */ } };
    for (const b of el.querySelectorAll('[data-sup]')) b.onclick = () => { const s = SUPPLIES.find((x) => x[0] === b.dataset.sup), n = S.supplies[s[0]] || 0; if (n >= 5 || S.rubles < s[4]) return; S.rubles -= s[4]; S.supplies[s[0]] = n + 1; Save.save(); menuRubles(); Sfx.init(); Sfx.play('stash'); re(); };
    for (const b of el.querySelectorAll('[data-tro]')) b.onclick = () => { const t = TROPHIES.find((x) => x[1] === b.dataset.tro); if (S.trophies.includes(t[1]) || S.rubles < t[2]) return; S.rubles -= t[2]; S.trophies.push(t[1]); Save.save(); menuRubles(); Sfx.init(); Sfx.play('legend'); if (G) flash(0.2, '255,220,120'); re(); };
  },
};

// ----- run hooks: cyberware always applies; one supply of each kind is used per run -----
const _cw2New = newGame;
newGame = function (...a) {
  _cw2New(...a);
  if (!G || G.title || G.tutorial) return;
  Cyberware.apply();
  const S = Save.data; S.supplies = S.supplies || {}; const used = [];
  for (const s of SUPPLIES) if ((S.supplies[s[0]] || 0) > 0) { s[5](P); S.supplies[s[0]]--; used.push(s[1]); }
  if (used.length) { Save.save(); setTimeout(() => { if (G && !G.title) banner('🛒 SUPPLIES USED', used.join(' · '), 3, 'art'); }, 1500); }
};

addEventListener('DOMContentLoaded', () => {
  // buying something rebuilds the page: keep the scroll position so it never jumps to the top
  const _bbS = buildBunker;
  buildBunker = function (...a) { const bk = $('bunker'), y = bk ? bk.scrollTop : 0; const r = _bbS(...a); if (bk && y) bk.scrollTop = y; return r; };
  const bar = $('bTabs'), body = $('bunker2'); if (!bar || !body) return;
  const tab = (id, name, fn) => {
    const b = document.createElement('button'); b.className = 'tab'; b.dataset.bt2 = id; b.textContent = name;
    b.onclick = () => { const cx = document.querySelector('[data-bt="codex"]'); if (cx) cx.click(); for (const x of bar.children) x.classList.remove('sel'); b.classList.add('sel'); body.classList.remove('cyberMap'); fn(body); if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(body); } catch (e) { /* keep english */ } };
    bar.insertBefore(b, bar.children[1]);
  };
  tab('mkt', '🛒 Market', (el) => Market.ui(el));
  tab('cw', '🧬 Cyberware', (el) => Cyberware.ui(el));
});
