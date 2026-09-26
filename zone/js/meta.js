'use strict';
// ---------- meta progression: suits, research, mutations, skills, achievements, codex, challenges, stash, roulette,
// ---------- extra modes & mutators, endings, tutorial and translations ----------

// ----- save defaults -----
const _m6Load = Save.load.bind(Save);
Save.load = function () {
  _m6Load();
  const d = this.data, def = { rep: { loner: 0, duty: 0, freedom: 0, bandit: 0 }, suits: ['leather'], suit: 'leather', research: [], mutations: [], mutEq: [], ach: [], cosmetic: 'none', cosmetics: ['none'],
    seen: { m: {}, a: {} }, stars: {}, sp: 0, skills: {}, stash: {}, chal: null, endings: [], lang: 'en', endless15: [], totals: {}, mutators: [], ngplus: false, tutDone: false, trophies: 0 };
  for (const k in def) if (d[k] === undefined) d[k] = def[k];
  Meta.rollChallenges();
};

// ----- more stalkers (186) -----
CHARACTERS.push(
  { id: 'skif', name: 'Scar (Clear Sky)', icon: '🩹', cost: 2200, weapon: 'dual', desc: 'Mercenary: +15% speed, -30% anomaly damage.', mod: { spdMul: 0.15, anomRes: 0.3 }, pal: { jacket: '#3a5a7a', hood: '#2a4a6a' } },
  { id: 'degtyarev', name: 'Degtyarev', icon: '🎖️', cost: 3200, weapon: 'ak', desc: 'SBU major: +40 HP, -10% damage taken, +1 luck.', mod: { maxhp: 40, dr: 0.1, luck: 1 }, pal: { jacket: '#4a5a3a', hood: '#3a4a2a' } },
  { id: 'skifp', name: 'Skif', icon: '🧭', cost: 2600, weapon: 'tesla', desc: 'Pathfinder: detector sees 2.5× further, +2 luck.', mod: { detect: 2.5, luck: 2 }, pal: { jacket: '#7a6a4a', hood: '#6a5a3a' } },
  { id: 'strelok', name: 'Strelok', icon: '🎯', cost: 5000, weapon: 'sniper', desc: 'The legend: +15% damage, +20 HP, +1 luck.', mod: { dmgMul: 0.15, maxhp: 20, luck: 1 }, pal: { jacket: '#2e3a2e', hood: '#243024' } },
);

// ----- suits sold at faction bases (153, 184) -----
const SUITS = [
  { id: 'leather', name: 'Leather Jacket', icon: '🧥', fac: null, tier: 0, cost: 0, desc: 'No bonus.', apply() {} },
  { id: 'sunrise', name: 'Sunrise Suit', icon: '🦺', fac: 'loner', tier: 1, cost: 600, desc: '+15 max HP, -5% damage taken.', apply(P) { P.maxhp += 15; P.dr += 0.05; } },
  { id: 'seva', name: 'SEVA Suit', icon: '🥼', fac: 'loner', tier: 2, cost: 1500, desc: '-40% anomaly & radiation damage.', apply(P) { P.anomRes = Math.min(0.85, P.anomRes + 0.4); } },
  { id: 'wind', name: 'Wind of Freedom', icon: '🍃', fac: 'freedom', tier: 1, cost: 900, desc: '+10% speed, +1 luck.', apply(P) { P.spdMul += 0.1; P.luck += 1; } },
  { id: 'psz', name: 'PSZ-9d Armor', icon: '🛡️', fac: 'duty', tier: 1, cost: 1100, desc: '+30 max HP, -8% damage taken.', apply(P) { P.maxhp += 30; P.dr += 0.08; } },
  { id: 'exo', name: 'Exoskeleton', icon: '🤖', fac: 'duty', tier: 2, cost: 2600, desc: '+60 max HP, -18% damage taken, -10% speed.', apply(P) { P.maxhp += 60; P.dr += 0.18; P.spdMul -= 0.1; } },
  { id: 'banditj', name: 'Bandit Jacket', icon: '🧤', fac: 'bandit', tier: 1, cost: 700, desc: '+25% rubles found, -10 max HP.', apply(P) { P.rubMul += 0.25; P.maxhp -= 10; } },
];
// ----- research tree: new artifacts & mutations (182, 195) -----
const ALL_ARTS = Object.keys(ARTIFACTS);
const LOCKED_ARTS = ALL_ARTS.slice(-12);
const RESEARCH = [];
for (let i = 0; i < LOCKED_ARTS.length; i += 2) RESEARCH.push({ id: 'art' + i, kind: 'art', arts: LOCKED_ARTS.slice(i, i + 2), cost: 300 + i * 70, needs: i ? 'art' + (i - 2) : null });
const MUTATIONS2 = [
  { id: 'snork', name: 'Snork Legs', icon: '🦵', cost: 700, desc: 'Dash 25% further and recharge faster.', apply(P) { P.dashMul *= 0.8; } },
  { id: 'sucker', name: 'Bloodsucker Skin', icon: '🩸', cost: 900, desc: 'Heal 1 HP every 4th kill (lifesteal).', apply(P) { P.lifesteal = (P.lifesteal || 0) + 0.25; } },
  { id: 'controller', name: 'Controller Mind', icon: '🧠', cost: 1200, desc: 'Immune to psi effects.', apply(P) { P.psiImmune = P.basePsi = true; } },
  { id: 'chimera', name: 'Chimera Heart', icon: '❤️‍🔥', cost: 1400, desc: '+1.2 HP regeneration per second.', apply(P) { P.regen += 1.2; } },
  { id: 'burer', name: 'Burer Hands', icon: '✋', cost: 1000, desc: '+12% area of effect.', apply(P) { P.areaMul += 0.12; } },
];
// ----- skill points (200) -----
const SKILLS = [
  { id: 'tough', name: 'Toughness', icon: '💪', desc: '+8 max HP', apply(P, l) { P.maxhp += 8 * l; } },
  { id: 'prec', name: 'Precision', icon: '🎯', desc: '+2% crit chance', apply(P, l) { P.crit += 0.02 * l; } },
  { id: 'fleet', name: 'Fleet Foot', icon: '👟', desc: '+2% speed', apply(P, l) { P.spdMul += 0.02 * l; } },
  { id: 'scav', name: 'Scavenger', icon: '🧲', desc: '+6% pickup range', apply(P, l) { P.pickup *= 1 + 0.06 * l; } },
  { id: 'learn', name: 'Fast Learner', icon: '📚', desc: '+3% XP', apply(P, l) { P.xpMul += 0.03 * l; } },
  { id: 'medic', name: 'Field Medic', icon: '💉', desc: '+0.2 HP/s regen', apply(P, l) { P.regen += 0.2 * l; } },
  { id: 'deadly', name: 'Deadly', icon: '☠️', desc: '+2% damage', apply(P, l) { P.dmgMul += 0.02 * l; } },
  { id: 'fire', name: 'Rate of Fire', icon: '⚡', desc: '+2% fire rate', apply(P, l) { P.rateMul += 0.02 * l; } },
];
// ----- achievements & cosmetics (183) -----
const COSMETICS = { none: { name: 'Default', c: null }, duty: { name: 'Duty Red', c: ['#7a2a24', '#4a1a16'] }, freedom: { name: 'Freedom Green', c: ['#3e7a3a', '#2e5a2a'] }, mono: { name: 'Monolith Grey', c: ['#9a9ea0', '#6a7074'] }, sky: { name: 'Clear Sky Blue', c: ['#3a6a9a', '#2a4a7a'] }, gold: { name: 'Legend Gold', c: ['#c8a040', '#8a6a20'] }, ghost: { name: 'Ghost White', c: ['#d8dcd8', '#a8aca8'] }, night: { name: 'Night Ops', c: ['#26282c', '#16181a'] }, merc: { name: 'Mercenary', c: ['#4a6a8a', '#2a3a4a'] } };
const ACHIEVEMENTS = [
  { id: 'kills100', name: 'First Blood', icon: '🩸', desc: 'Kill 100 mutants (total)', test: (S) => (S.totals.kills || 0) >= 100, cos: 'duty' },
  { id: 'kills5k', name: 'Exterminator', icon: '💀', desc: 'Kill 5,000 mutants (total)', test: (S) => (S.totals.kills || 0) >= 5000, cos: 'night' },
  { id: 'boss10', name: 'Boss Hunter', icon: '👑', desc: 'Kill 10 bosses (total)', test: (S) => (S.totals.bosses || 0) >= 10, cos: 'merc' },
  { id: 'arts25', name: 'Collector', icon: '💎', desc: 'Collect 25 artifacts (total)', test: (S) => (S.totals.arts || 0) >= 25, cos: 'sky' },
  { id: 'surv10', name: 'Survivor', icon: '⏱️', desc: 'Survive 10 minutes in one run', test: (S, R) => R && R.t >= 600, cos: 'freedom' },
  { id: 'win', name: 'Victor', icon: '🏆', desc: 'Win any stage', test: (S) => S.wins >= 1, cos: 'gold' },
  { id: 'explore', name: 'Cartographer', icon: '🧭', desc: 'Explore 30% of a map in one run', test: (S, R) => R && R.exp >= 30, cos: 'ghost' },
  { id: 'contracts', name: 'Contractor', icon: '📋', desc: 'Complete 50 contracts (total)', test: (S) => (S.totals.contracts || 0) >= 50, cos: 'mono' },
  { id: 'rich', name: 'Rich Stalker', icon: '💰', desc: 'Hold 5,000 ₽', test: (S) => S.rubles >= 5000 },
  { id: 'wish', name: 'Wish Granted', icon: '🌟', desc: 'Reach the Wish Granter', test: (S) => S.endings.length > 0 },
  { id: 'stages', name: 'Zone Walker', icon: '🗺️', desc: 'Unlock every stage', test: (S) => STAGES.every((s) => S.stages.includes(s.id)) },
  { id: 'hardcore', name: 'Iron Stalker', icon: '⛓️', desc: 'Survive 10 minutes in Hardcore', test: (S, R) => R && R.mode === 'hardcore' && R.t >= 600 },
];
// ----- mutators that multiply rubles (198) and NG+ (199) -----
const MUTATORS = [
  { id: 'glass', name: 'Glass Cannon', icon: '🔪', desc: '+40% damage, half max HP', rub: 0.3, apply(P) { P.dmgMul += 0.4; P.maxhp = Math.round(P.maxhp * 0.5); } },
  { id: 'nomed', name: 'Iron Will', icon: '🩹', desc: 'No regeneration, medkits heal half', rub: 0.2, apply(P) { P.regen = 0; P.medMul *= 0.5; P.noRegen = true; } },
  { id: 'elite', name: 'Elite Swarm', icon: '👹', desc: 'Three times more elite mutants', rub: 0.35, apply() { G.eliteMul = 3; } },
  { id: 'fast', name: 'Hungry Zone', icon: '💨', desc: 'Mutants move 20% faster', rub: 0.25, apply() { G.fastMut = 1.2; } },
];
// ----- modes (206, 207, 209, 210, 296) -----
const MODES2 = [
  ['hardcore', '⛓️', 'Hardcore', 'No revives. ×2 rubles, but dying loses half of your saved rubles.', 1],
  ['random', '🎲', 'Randomizer', 'Random weapon, two random artifacts, random look. ×1.3 rubles.', 0.3],
  ['oneweapon', '🗡️', 'One Weapon', 'You can never pick up a second weapon. ×1.5 rubles.', 0.5],
  ['night', '🌙', 'Night Only', 'The sun never rises. ×1.3 rubles.', 0.3],
];
// ----- daily / weekly challenges (178) -----
const CHAL_POOL = [
  ['kills', 'Kill {n} mutants', 400, 60], ['arts', 'Collect {n} artifacts', 5, 80], ['bosses', 'Kill {n} bosses', 2, 90], ['contracts', 'Complete {n} contracts', 5, 80], ['mins', 'Survive {n} minutes (total)', 20, 70], ['wins', 'Win {n} stage', 1, 150],
];

// ----- runtime -----
let NEXT_RUN = null;
const Meta = {
  dayKey() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); },
  weekKey() { const d = new Date(); return d.getFullYear() * 100 + Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 6048e5); },
  rollChallenges() {
    const S = Save.data, day = this.dayKey(), wk = this.weekKey();
    if (!S.chal || S.chal.day !== day) {
      const R = mulberry32(day), pool = CHAL_POOL.slice(), list = [];
      for (let i = 0; i < 3; i++) { const c = pool.splice(Math.floor(R() * pool.length), 1)[0]; list.push({ k: c[0], text: c[1].replace('{n}', c[2]), n: c[2], rw: c[3], done: false }); }
      S.chal = { day, list, p: {}, week: (S.chal && S.chal.week) || 0, wlist: (S.chal && S.chal.wlist) || [], wp: (S.chal && S.chal.wp) || {} };
    }
    if (S.chal.week !== wk) { const c = CHAL_POOL[wk % CHAL_POOL.length]; S.chal.week = wk; S.chal.wp = {}; S.chal.wlist = [{ k: c[0], text: c[1].replace('{n}', c[2] * 6), n: c[2] * 6, rw: c[3] * 6, done: false }]; }
  },
  checkChallenges(inRun) {
    const C = Save.data.chal; if (!C) return;
    for (const [list, p] of [[C.list, C.p], [C.wlist, C.wp]]) for (const c of list) if (!c.done && (p[c.k] || 0) >= c.n) {
      c.done = true; Save.data.rubles += c.rw;
      if (inRun && G && !G.title) banner('🏅 CHALLENGE COMPLETE', c.text + ' · +' + c.rw + ' ₽ (saved)', 3, 'good');
      Save.save();
    }
  },
  checkAch(R) {
    const S = Save.data, got = [];
    for (const a of ACHIEVEMENTS) if (!S.ach.includes(a.id) && a.test(S, R)) { S.ach.push(a.id); got.push(a); if (a.cos && !S.cosmetics.includes(a.cos)) S.cosmetics.push(a.cos); }
    return got;
  },
  stars(R) { return (R.t >= 300 ? 1 : 0) + (R.kills >= 300 && R.arts >= 3 ? 1 : 0) + (R.kind === 'win' ? 1 : 0); },
  preRun(stage, seed) {
    const S = Save.data;
    // research gates the rarest artifacts
    if (!Meta.baseArts) Meta.baseArts = JSON.parse(JSON.stringify(ANOM_ARTS));
    const locked = new Set(LOCKED_ARTS.filter((id) => !RESEARCH.some((r) => S.research.includes(r.id) && r.arts.includes(id))));
    for (const k in Meta.baseArts) { const f = Meta.baseArts[k].filter((id) => !locked.has(id)); ANOM_ARTS[k] = f.length ? f : Meta.baseArts[k]; }
    // NG+ remixes each region's anomalies
    const SW = STAGE_WORLD[stage];
    for (const r of SW.regions) { if (r._anoms) r.anoms = r._anoms; }
    if (NEXT_RUN && NEXT_RUN.ngplus) { const R = mulberry32((seed || 1) + 99), all = Object.keys(ANOMALIES).filter((k) => !ANOMALIES[k].moving); for (const r of SW.regions) { r._anoms = r.anoms; r.anoms = [0, 1, 2, 3].map(() => all[Math.floor(R() * all.length)]); } }
  },
  applyRun(run) {
    const S = Save.data;
    G.mode2 = run.mode; G.rubBonus = 1; G.ngplus = !!run.ngplus; G.mutators = run.mutators.slice();
    const suit = SUITS.find((s) => s.id === S.suit) || SUITS[0]; suit.apply(P);
    for (const id of S.mutEq) { const m = MUTATIONS2.find((x) => x.id === id); if (m && S.mutations.includes(id)) m.apply(P); }
    for (const sk of SKILLS) if (S.skills[sk.id]) sk.apply(P, S.skills[sk.id]);
    const cos = COSMETICS[S.cosmetic]; if (cos && cos.c) { P.pal.jacket = cos.c[0]; P.pal.hood = cos.c[1]; P.pal.jacket2 = cos.c[1]; }
    for (const id of run.mutators) { const m = MUTATORS.find((x) => x.id === id); if (m) { m.apply(P); G.rubBonus += m.rub; } }
    if (run.ngplus) G.rubBonus += 0.6;
    const md = MODES2.find((m) => m[0] === run.mode); if (md) G.rubBonus += md[4];
    if (run.mode === 'hardcore') P.revives = 0;
    if (run.mode === 'oneweapon') P.maxWeapons = 1;
    if (run.mode === 'random') {
      const ws = Object.keys(WEAPONS); P.weapons = [{ id: pick(ws), lv: 1, cd: 0.5 }];
      for (let i = 0; i < 2; i++) { const a = pick(ALL_ARTS); P.arts[a] = (P.arts[a] || 0) + 1; ARTIFACTS[a].apply(P); }
      const c = COSMETICS[pick(Object.keys(COSMETICS).slice(1))].c; P.pal.jacket = c[0]; P.pal.hood = c[1];
      recomputeTags();
    }
    // bring consumables from the stash (238)
    for (const id in S.stash) { const n = Math.min(2, S.stash[id]); if (n > 0 && ITEMS[id]) { P.items[id] = Math.min(9, (P.items[id] || 0) + n); S.stash[id] -= n; } }
    P.hp = P.maxhp;
    if (run.mode === 'tutorial') Tutorial.start();
    Story.reset();
    itemsUI(); hudBuild();
  },
  onEnd(kind) {
    const S = Save.data;
    const R = { t: G.t, kills: G.kills, arts: G.arts, kind, mode: G.mode2, exp: W2.expPct ? W2.expPct() : 0 };
    if (G.tutorial) return { R, lines: [] };
    const lines = [];
    Story.stat('mins', Math.floor(G.t / 60)); if (kind === 'win') Story.stat('wins', 1);
    // stars (193)
    const st = this.stars(R), key = G.stage; if (st > (S.stars[key] || 0)) S.stars[key] = st;
    lines.push('⭐'.repeat(st) + '☆'.repeat(3 - st) + ' stage rating');
    // skill points (200)
    let sp = (G.t >= 300 ? 1 : 0) + (G.t >= 600 ? 1 : 0) + (kind === 'win' ? 1 : 0) + Math.floor((G.bossKills || 0) / 3); sp = Math.min(4, sp);
    if (sp) { S.sp += sp; lines.push('+' + sp + ' skill point' + (sp > 1 ? 's' : '')); }
    // stash leftovers (238)
    let stored = 0; for (const id in P.items) if (P.items[id] > 0) { const n = Math.min(P.items[id], 9 - (S.stash[id] || 0)); if (n > 0) { S.stash[id] = (S.stash[id] || 0) + n; stored += n; } }
    if (stored) lines.push('📦 ' + stored + ' item' + (stored > 1 ? 's' : '') + ' moved to your stash');
    if (kind === 'win') addRep('loner', 15);
    if (G.endless && G.t >= 900 && !S.endless15.includes(G.stage)) S.endless15.push(G.stage);
    this.checkChallenges(false);
    for (const a of this.checkAch(R)) lines.push('🏆 ' + a.name + (a.cos ? ' · unlocked look: ' + COSMETICS[a.cos].name : ''));
    if (G.mode2 === 'hardcore' && kind === 'dead') { const lost = Math.floor(S.rubles / 2); S.rubles -= lost; lines.push('⛓️ Hardcore: lost ' + lost + ' saved ₽'); }
    return { R, lines };
  },
};

// newGame: apply everything chosen before the run
const _m6New = newGame;
newGame = function (stageId, charId, mode, spawnIdx, seed, diff) {
  const run = NEXT_RUN || { mode: mode === 'endless' || mode === 'bossrush' ? mode : 'standard', mutators: [], ngplus: false };
  NEXT_RUN = run;
  Meta.preRun(stageId, seed);
  _m6New(stageId, charId, mode, spawnIdx, seed, diff);
  NEXT_RUN = null;
  Meta.applyRun(run);
};
// elite and speed mutators
const _m6Spawn = spawnEnemy;
spawnEnemy = function (id, x, y, o = {}) {
  if (G && G.eliteMul && !o.noElite && !o.affix && !ENEMIES[id].boss && Math.random() < 0.02 * (G.eliteMul - 1)) o.affix = pick(Object.keys(ELITE_AFFIX));
  const e = _m6Spawn(id, x, y, o);
  if (G && G.fastMut && e && !e.boss) e.spd *= G.fastMut;
  return e;
};

// ----- endings (155, 156, 157) -----
const WISHES = [
  ['wealth', '💰', 'Wealth', 'Gold pours from the sky... it turns to stone. Still, you keep +3000 ₽.', (S) => { S.rubles += 3000; }],
  ['power', '⚡', 'Power', 'The Zone bends to you. Permanent +10% damage in every run.', (S) => { S.wishPower = true; }],
  ['life', '♾️', 'Immortality', 'You will not die... not today. Permanent +1 revive in every run.', (S) => { S.wishLife = true; }],
  ['destroy', '💥', 'Destroy it', 'You shatter the Wish Granter. The Zone grows quiet. Every faction respects you (+100 rep).', (S) => { for (const f in S.rep) if (f !== 'bandit') S.rep[f] += 100; }],
];
function showEnding(title, body, buttons) {
  let el = $('ending'); if (!el) { el = document.createElement('div'); el.id = 'ending'; el.className = 'screen show'; document.body.appendChild(el); }
  el.innerHTML = `<div class="endBox"><h2>${title}</h2><p>${body}</p><div class="endBtns"></div></div>`;
  el.classList.add('show');
  const bw = el.querySelector('.endBtns');
  for (const b of buttons) { const x = document.createElement('button'); x.className = 'big ' + (b.ghost ? 'ghost' : ''); x.innerHTML = b.label; x.onclick = () => { el.classList.remove('show'); b.fn && b.fn(); }; bw.appendChild(x); }
}
function wishGranter() {
  showEnding('🌟 THE WISH GRANTER', 'The Monolith hums in your skull. <i>"Your wish... speak it."</i><br>Choose wisely: this decides your ending.',
    WISHES.map(([id, ic, n, txt, fn]) => ({ label: ic + ' ' + n, fn: () => { const S = Save.data; fn(S); if (!S.endings.includes(id)) S.endings.push(id); Meta.checkAch(null); Save.save(); showEnding(ic + ' ENDING: ' + n.toUpperCase(), txt + '<br><br><small>Endings seen: ' + S.endings.length + '/' + WISHES.length + '</small>', [{ label: 'Continue' }]); } })));
}
function trueEnding() {
  const S = Save.data; S.trueEnd = true; if (!S.chars.includes('strelok')) S.chars.push('strelok'); Save.save();
  showEnding('☀️ THE TRUE ENDING', 'You walked every corner of the Zone and outlasted it all. The anomalies fade, the mutants go still, and for the first time in years the sun shines on Pripyat.<br><br><b>Strelok joins your roster. Thank you for playing ZONEBONK.</b>', [{ label: 'Continue' }]);
}

// ----- tutorial stage (296) -----
const TUT_STEPS = [
  ['Move with WASD (or drag anywhere on touch).', () => dist(P.x, P.y, Tutorial.sx, Tutorial.sy) > 260],
  ['Dash with SPACE (or the dash button). You are invulnerable while dashing.', () => P.dashT > 0],
  ['Your weapons fire on their own. Kill the 5 zombies!', () => Tutorial.kills() >= 5, () => { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; spawnEnemy('zombie', P.x + Math.cos(a) * 380, P.y + Math.sin(a) * 280, { noElite: true, hpMul: 0.4 }); } }],
  ['Walk over the green crystals to level up, then pick a card.', () => G.level >= 2, () => { for (let i = 0; i < 16; i++) dropGem(P.x + rand(-160, 160), P.y + rand(-120, 120), 3); }],
  ['An artifact lies nearby. The detector (bottom left) points to it. Grab it!', () => G.arts >= 1, () => G.pickups.push({ type: 'art', x: P.x + 220, y: P.y - 60, t: 0 })],
  ['Press Q (or tap the artifact button) to use its power.', () => Object.values(P.actCd).some((v) => v > 0)],
  ['Press E, - or + (or the mouse wheel) to switch between artifacts. Throw a bolt with T (or 🔩) to reveal hidden anomalies.', () => Tutorial.bolted],
  ['Emissions kill anyone outside. Walk into the green SHELTER ring.', () => inShelter(P.x, P.y)],
];
const Tutorial = {
  start() { G.tutorial = true; G.nextBossT = 1e9; G.emIdx = 99; G.waveT = 1e9; this.i = -1; this.sx = P.x; this.sy = P.y; this.k0 = 0; this.bolted = false; this.doneT = 0; this.next(); },
  kills() { return G.kills - this.k0; },
  next() {
    this.i++;
    const el = $('tutBox');
    if (this.i >= TUT_STEPS.length) { el.innerHTML = '<b>🎓 Training complete!</b> +100 ₽. You are ready for the Zone.'; this.doneT = 3.5; Save.data.tutDone = true; G.rubles += 100; Sfx.play('quest'); return; }
    const s = TUT_STEPS[this.i]; if (s[2]) s[2](); this.k0 = this.i === 2 ? G.kills : this.k0;
    el.innerHTML = `<small>TRAINING ${this.i + 1}/${TUT_STEPS.length}</small><b>${s[0]}</b>`; el.classList.add('show');
    if (this.i) Sfx.play('hint');
  },
  update(dt) {
    if (this.doneT > 0) { this.doneT -= dt; if (this.doneT <= 0) endRun('quit'); return; }
    const s = TUT_STEPS[this.i]; if (s && s[1]()) this.next();
  },
};
const _m6Bolt = throwBolt;
throwBolt = function () { _m6Bolt(); if (G && G.tutorial) Tutorial.bolted = true; };
const _m6EvUp = Events.update.bind(Events);
Events.update = function (dt) { if (G.tutorial) return; _m6EvUp(dt); };

// ----- translations (282): menus, HUD labels and common UI -----
const LANGS = { en: 'English', ka: 'ქართული', ru: 'Русский', uk: 'Українська' };
const I18N = {
  ka: { PLAY: 'თამაში', "🏚 SIDOROVICH'S BUNKER": '🏚 სიდოროვიჩის ბუნკერი', '📻 RADIO': '📻 რადიო', '⚙ SETTINGS': '⚙ პარამეტრები', '▶ CONTINUE RUN': '▶ გაგრძელება', '🎓 TUTORIAL': '🎓 სწავლება', PREPARE: 'მომზადება', DIFFICULTY: 'სირთულე', MODE: 'რეჟიმი', STAGE: 'ეტაპი', 'START POINT': 'საწყისი წერტილი', STALKER: 'სტალკერი', 'ENTER THE ZONE': 'ზონაში შესვლა', '← BACK': '← უკან', 'THE BUNKER': 'ბუნკერი', SETTINGS: 'პარამეტრები', PAUSED: 'პაუზა', RESUME: 'გაგრძელება', 'QUIT RUN': 'გასვლა', 'YOU DIED': 'შენ მოკვდი', VICTORY: 'გამარჯვება', 'PLAY AGAIN': 'თავიდან', MENU: 'მენიუ', 'MUTATORS · MORE RUBLES': 'მუტატორები · მეტი რუბლი', Upgrades: 'გაუმჯობესებები', Factions: 'დაჯგუფებები', Research: 'კვლევა', Skills: 'უნარები', Stash: 'სამალავი', Roulette: 'რულეტკა', Codex: 'კოდექსი', Achievements: 'მიღწევები', Challenges: 'გამოწვევები', move: 'მოძრაობა', dash: 'ნახტომი', ability: 'უნარი', artifact: 'არტეფაქტი', ride: 'მგზავრობა', bolt: 'ჭანჭიკი', radio: 'რადიო', map: 'რუკა', pause: 'პაუზა', Language: 'ენა', 'Master volume': 'მთავარი ხმა', 'Music / radio': 'მუსიკა / რადიო', 'Sound effects': 'ხმოვანი ეფექტები', Ambience: 'გარემო', 'Radio chatter & UI': 'რადიო და UI', 'Screen shake': 'ეკრანის რხევა', 'Damage numbers': 'დაზიანების ციფრები', 'Tutorial hints': 'მინიშნებები', 'Show FPS': 'FPS ჩვენება', 'Graphics quality': 'გრაფიკის ხარისხი' },
  ru: { PLAY: 'ИГРАТЬ', "🏚 SIDOROVICH'S BUNKER": '🏚 БУНКЕР СИДОРОВИЧА', '📻 RADIO': '📻 РАДИО', '⚙ SETTINGS': '⚙ НАСТРОЙКИ', '▶ CONTINUE RUN': '▶ ПРОДОЛЖИТЬ', '🎓 TUTORIAL': '🎓 ОБУЧЕНИЕ', PREPARE: 'ПОДГОТОВКА', DIFFICULTY: 'СЛОЖНОСТЬ', MODE: 'РЕЖИМ', STAGE: 'ЛОКАЦИЯ', 'START POINT': 'ТОЧКА СТАРТА', STALKER: 'СТАЛКЕР', 'ENTER THE ZONE': 'ВОЙТИ В ЗОНУ', '← BACK': '← НАЗАД', 'THE BUNKER': 'БУНКЕР', SETTINGS: 'НАСТРОЙКИ', PAUSED: 'ПАУЗА', RESUME: 'ПРОДОЛЖИТЬ', 'QUIT RUN': 'ВЫЙТИ', 'YOU DIED': 'ВЫ ПОГИБЛИ', VICTORY: 'ПОБЕДА', 'PLAY AGAIN': 'ЕЩЁ РАЗ', MENU: 'МЕНЮ', 'MUTATORS · MORE RUBLES': 'МУТАТОРЫ · БОЛЬШЕ РУБЛЕЙ', Upgrades: 'Улучшения', Factions: 'Группировки', Research: 'Исследования', Skills: 'Навыки', Stash: 'Тайник', Roulette: 'Рулетка', Codex: 'Энциклопедия', Achievements: 'Достижения', Challenges: 'Испытания', move: 'движение', dash: 'рывок', ability: 'способность', artifact: 'артефакт', ride: 'транспорт', bolt: 'болт', radio: 'радио', map: 'карта', pause: 'пауза', Language: 'Язык', 'Master volume': 'Общая громкость', 'Music / radio': 'Музыка / радио', 'Sound effects': 'Звуковые эффекты', Ambience: 'Окружение', 'Radio chatter & UI': 'Рация и интерфейс', 'Screen shake': 'Тряска экрана', 'Damage numbers': 'Цифры урона', 'Tutorial hints': 'Подсказки', 'Show FPS': 'Показывать FPS', 'Graphics quality': 'Качество графики' },
  uk: { PLAY: 'ГРАТИ', "🏚 SIDOROVICH'S BUNKER": '🏚 БУНКЕР СИДОРОВИЧА', '📻 RADIO': '📻 РАДІО', '⚙ SETTINGS': '⚙ НАЛАШТУВАННЯ', '▶ CONTINUE RUN': '▶ ПРОДОВЖИТИ', '🎓 TUTORIAL': '🎓 НАВЧАННЯ', PREPARE: 'ПІДГОТОВКА', DIFFICULTY: 'СКЛАДНІСТЬ', MODE: 'РЕЖИМ', STAGE: 'ЛОКАЦІЯ', 'START POINT': 'ТОЧКА СТАРТУ', STALKER: 'СТАЛКЕР', 'ENTER THE ZONE': 'УВІЙТИ В ЗОНУ', '← BACK': '← НАЗАД', 'THE BUNKER': 'БУНКЕР', SETTINGS: 'НАЛАШТУВАННЯ', PAUSED: 'ПАУЗА', RESUME: 'ПРОДОВЖИТИ', 'QUIT RUN': 'ВИЙТИ', 'YOU DIED': 'ВИ ЗАГИНУЛИ', VICTORY: 'ПЕРЕМОГА', 'PLAY AGAIN': 'ЩЕ РАЗ', MENU: 'МЕНЮ', 'MUTATORS · MORE RUBLES': 'МУТАТОРИ · БІЛЬШЕ КАРБОВАНЦІВ', Upgrades: 'Покращення', Factions: 'Угруповання', Research: 'Дослідження', Skills: 'Навички', Stash: 'Схованка', Roulette: 'Рулетка', Codex: 'Енциклопедія', Achievements: 'Досягнення', Challenges: 'Випробування', move: 'рух', dash: 'ривок', ability: 'здібність', artifact: 'артефакт', ride: 'транспорт', bolt: 'болт', radio: 'радіо', map: 'мапа', pause: 'пауза', Language: 'Мова', 'Master volume': 'Загальна гучність', 'Music / radio': 'Музика / радіо', 'Sound effects': 'Звукові ефекти', Ambience: 'Оточення', 'Radio chatter & UI': 'Рація та інтерфейс', 'Screen shake': 'Тремтіння екрана', 'Damage numbers': 'Цифри шкоди', 'Tutorial hints': 'Підказки', 'Show FPS': 'Показувати FPS', 'Graphics quality': 'Якість графіки' },
};
function tr(s) { const L = I18N[(Save.data && Save.data.lang) || 'en']; return (L && L[s]) || s; }
function applyLang() {
  const sel = 'button, h2, .sect, .tab, #keysHint, label.set > span, #overTitle, #pause h2';
  for (const el of document.querySelectorAll(sel)) {
    if (el.children.length && !el.matches('#keysHint')) continue;
    if (el.matches('#keysHint')) { for (const n of el.childNodes) if (n.nodeType === 3) { if (n._en === undefined) n._en = n.textContent; n.textContent = n._en.replace(/[a-z]+/g, (w) => tr(w)); } continue; }
    const cur = el.textContent.trim();
    if (el._tr !== cur) el._en = cur; // the game changed this text itself: re-read it
    const t = tr(el._en); el._tr = t; if (t !== cur) el.textContent = t;
  }
}

// ----- UI (ui.js loads after this file, so these hooks attach once every script has run) -----
addEventListener('DOMContentLoaded', () => {
  // title buttons
  const pb = $('playBtn'), tb = document.createElement('button');
  tb.className = 'big ghost'; tb.id = 'tutBtn'; tb.textContent = '🎓 TUTORIAL';
  pb.parentNode.insertBefore(tb, $('bunkerBtn'));
  tb.onclick = () => { Sfx.init(); NEXT_RUN = { mode: 'tutorial', mutators: [], ngplus: false }; startGame(); };
  // main quest + tutorial boxes in the HUD
  const mq = document.createElement('div'); mq.id = 'mainQ'; mq.className = 'q main'; $('quests').prepend(mq); Story.mq = mq;
  const tbx = document.createElement('div'); tbx.id = 'tutBox'; $('hud').appendChild(tbx);
  // modes & mutators on the setup screen
  const _bs = buildSetup;
  buildSetup = function () {
    _bs();
    const S = Save.data, ml = $('modeList');
    ml.insertAdjacentHTML('beforeend', MODES2.map(([id, ic, n, d]) => `<button class="pick ${S.mode === id ? 'sel' : ''}" data-mode="${id}"><div class="pi">${ic}</div><div><b>${n}</b><small>${d}</small></div></button>`).join(''));
    for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => { S.mode = b.dataset.mode; Save.save(); buildSetup(); };
    let mu = $('mutList');
    if (!mu) { ml.insertAdjacentHTML('afterend', '<div class="sect">MUTATORS · MORE RUBLES</div><div class="grid chips" id="mutList"></div>'); mu = $('mutList'); }
    const on = (id) => S.mutators.includes(id);
    let h = MUTATORS.map((m) => `<button class="chip ${on(m.id) ? 'sel' : ''}" data-mut="${m.id}">${m.icon} ${m.name}<small>${m.desc} · +${Math.round(m.rub * 100)}% ₽</small></button>`).join('');
    if (S.wins > 0) h += `<button class="chip ${S.ngplus ? 'sel' : ''}" data-ng="1">🔁 New Game+<small>Remixed anomalies, tougher mutants · +60% ₽</small></button>`;
    mu.innerHTML = h;
    for (const b of mu.querySelectorAll('[data-mut]')) b.onclick = () => { const id = b.dataset.mut; S.mutators = on(id) ? S.mutators.filter((x) => x !== id) : [...S.mutators, id]; Save.save(); buildSetup(); };
    const ng = mu.querySelector('[data-ng]'); if (ng) ng.onclick = () => { S.ngplus = !S.ngplus; Save.save(); buildSetup(); };
    for (const b of document.querySelectorAll('[data-stage]')) { const st = S.stars[b.dataset.stage] || 0; if (st) b.querySelector('b').insertAdjacentHTML('beforeend', ' <span class="stars">' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</span>'); }
    applyLang();
  };
  const _sg = startGame;
  startGame = function () {
    const S = Save.data;
    if (!NEXT_RUN) NEXT_RUN = { mode: S.mode || 'standard', mutators: (S.mutators || []).slice(), ngplus: !!S.ngplus && S.wins > 0 };
    if (NEXT_RUN.mode === 'tutorial') setupStage = 'zone';
    _sg();
  };
  // end of run: ratings, skill points, stash, achievements, endings
  const _er = endRun;
  endRun = function (kind, src) {
    if (G.ended) return;
    if (G.rubBonus && G.rubBonus !== 1) { const extra = Math.floor((G.rubles - G.paidR) * (G.rubBonus - 1)); G.rubles += Math.max(0, extra); }
    if (Save.data.wishPower) {} // applied at run start
    const res = Meta.onEnd(kind);
    _er(kind === 'escape' ? 'quit' : kind, src);
    if (kind === 'escape') { $('overTitle').textContent = '🚙 ESCAPED THE ZONE'; $('overTitle').className = 'win'; $('overSub').textContent = 'You drove out with everything you found. +150 ₽ escape bonus.'; }
    if (G.tutorial) { $('overTitle').textContent = '🎓 TRAINING COMPLETE'; $('overTitle').className = 'win'; $('overSub').textContent = 'You know the basics. Pick a difficulty and enter the Zone!'; }
    if (res.lines.length) $('earned').insertAdjacentHTML('beforeend', '<div class="metaLines">' + res.lines.map((l) => '<div>' + l + '</div>').join('') + '</div>');
    Save.save();
    if (G.wish && kind === 'win') setTimeout(wishGranter, 900);
    else if (!Save.data.trueEnd && STAGES.every((s) => Save.data.endless15.includes(s.id))) setTimeout(trueEnding, 900);
    applyLang();
  };
  // bunker tabs
  const tabs = [['up', 'Upgrades'], ['fac', 'Factions'], ['res', 'Research'], ['sk', 'Skills'], ['stash', 'Stash'], ['rou', 'Roulette'], ['codex', 'Codex'], ['ach', 'Achievements'], ['chal', 'Challenges']];
  const bk = $('bunker'), bar = document.createElement('div'); bar.id = 'bTabs';
  bar.innerHTML = tabs.map(([id, n]) => `<button class="tab" data-bt="${id}">${n}</button>`).join('');
  bk.insertBefore(bar, bk.children[1]);
  const body = document.createElement('div'); body.id = 'bunker2'; bk.appendChild(body);
  let cur = 'up';
  const _bb = buildBunker;
  buildBunker = function () {
    for (const b of bar.children) b.classList.toggle('sel', b.dataset.bt === cur);
    const up = cur === 'up';
    for (const el of bk.children) if (el !== bar && el !== body && !el.classList.contains('hdr')) el.style.display = up ? '' : 'none';
    body.style.display = up ? 'none' : '';
    if (up) _bb(); else BunkerUI[cur](body);
    menuRubles(); applyLang();
  };
  for (const b of bar.children) b.onclick = () => { cur = b.dataset.bt; buildBunker(); };
  // settings: language
  const _bst = buildSettings;
  buildSettings = function () {
    _bst();
    $('settingsBody').insertAdjacentHTML('afterbegin', `<label class="set"><span>Language</span><select data-lang>${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${Save.data.lang === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`);
    document.querySelector('[data-lang]').onchange = (e) => { Save.data.lang = e.target.value; Save.save(); buildSettings(); };
    applyLang();
  };
  // title: challenge summary, language on first paint
  const _tc = titleContinue;
  titleContinue = function () {
    _tc();
    const C = Save.data.chal, el = $('titleStats');
    if (C && el) { const d = C.list.filter((c) => !c.done).length; el.dataset.ch = d; let x = $('titleChal'); if (!x) { el.insertAdjacentHTML('afterend', '<div id="titleChal"></div>'); x = $('titleChal'); } x.textContent = d ? '🏅 ' + d + ' daily challenge' + (d > 1 ? 's' : '') + ' open · Bunker → Challenges' : '🏅 All daily challenges done!'; }
    $('tutBtn').classList.toggle('pulse', !Save.data.tutDone && !Save.data.runs);
    applyLang();
  };
  titleContinue();
});
// wish rewards apply to every run
const _m6Apply = Meta.applyRun.bind(Meta);
Meta.applyRun = function (run) { _m6Apply(run); if (Save.data.wishPower) P.dmgMul += 0.1; if (Save.data.wishLife && run.mode !== 'hardcore') P.revives += 1; };

// ----- bunker tab pages -----
const BunkerUI = {
  fac(el) {
    const S = Save.data;
    let h = '<div class="sect">REPUTATION · complete contracts for a faction to earn it</div><div class="grid">';
    for (const f in FACTIONS) { const F = FACTIONS[f], r = S.rep[f] || 0, t = repTier(f), nx = REP_TIERS[t + 1]; h += `<div class="pick"><div class="pi">${F.icon}</div><div><b style="color:${F.color}">${F.name}</b><small>${REP_TIERS[t][1]} · ${r} rep${nx ? ' · next at ' + nx[0] : ''}</small><i class="bar"><i style="width:${nx ? clamp((r - REP_TIERS[t][0]) / (nx[0] - REP_TIERS[t][0]), 0, 1) * 100 : 100}%"></i></i></div></div>`; }
    h += '</div><div class="sect">SUITS · sold at faction bases</div><div class="grid">';
    for (const s of SUITS) {
      const own = S.suits.includes(s.id), eq = S.suit === s.id, ok = !s.fac || repTier(s.fac) >= s.tier;
      h += `<button class="pick ${eq ? 'sel' : ''} ${ok || own ? '' : 'locked'}" data-suit="${s.id}"><div class="pi">${s.icon}</div><div><b>${s.name}</b><small>${s.desc}</small><em>${eq ? 'EQUIPPED' : own ? 'Tap to wear' : ok ? `<span class="${S.rubles >= s.cost ? 'afford' : 'poor'}">BUY ${s.cost} ₽</span>` : '🔒 ' + FACTIONS[s.fac].name + ' ' + REP_TIERS[s.tier][1]}</em></div></button>`;
    }
    el.innerHTML = h + '</div>';
    for (const b of el.querySelectorAll('[data-suit]')) b.onclick = () => { const s = SUITS.find((x) => x.id === b.dataset.suit); if (S.suits.includes(s.id)) S.suit = s.id; else if ((!s.fac || repTier(s.fac) >= s.tier) && S.rubles >= s.cost) { S.rubles -= s.cost; S.suits.push(s.id); S.suit = s.id; Sfx.init(); Sfx.play('quest'); } else return; Save.save(); buildBunker(); };
  },
  res(el) {
    const S = Save.data;
    let h = '<div class="sect">ARTIFACT RESEARCH · unlock rarer artifacts in anomaly fields</div><div class="grid">';
    for (const r of RESEARCH) {
      const done = S.research.includes(r.id), ok = !r.needs || S.research.includes(r.needs);
      h += `<button class="pick ${done ? 'sel' : ''} ${ok || done ? '' : 'locked'}" data-res="${r.id}"><div class="pi">${r.arts.map((a) => artImg(a, 'ico')).join('')}</div><div><b>${r.arts.map((a) => ARTIFACTS[a].name).join(' + ')}</b><small>${r.arts.map((a) => ARTIFACTS[a].desc).join(' · ')}</small><em>${done ? 'RESEARCHED' : ok ? `<span class="${S.rubles >= r.cost ? 'afford' : 'poor'}">${r.cost} ₽</span>` : '🔒 research the previous one'}</em></div></button>`;
    }
    h += '</div><div class="sect">MUTATION RESEARCH · become part mutant (equip up to 2)</div><div class="grid">';
    for (const m of MUTATIONS2) {
      const own = S.mutations.includes(m.id), eq = S.mutEq.includes(m.id);
      h += `<button class="pick ${eq ? 'sel' : ''}" data-mut2="${m.id}"><div class="pi">${m.icon}</div><div><b>${m.name}</b><small>${m.desc}</small><em>${eq ? 'EQUIPPED · tap to remove' : own ? 'Tap to equip' : `<span class="${S.rubles >= m.cost ? 'afford' : 'poor'}">${m.cost} ₽</span>`}</em></div></button>`;
    }
    el.innerHTML = h + '</div>';
    for (const b of el.querySelectorAll('[data-res]')) b.onclick = () => { const r = RESEARCH.find((x) => x.id === b.dataset.res); if (S.research.includes(r.id) || (r.needs && !S.research.includes(r.needs)) || S.rubles < r.cost) return; S.rubles -= r.cost; S.research.push(r.id); Save.save(); Sfx.init(); Sfx.play('artifact'); buildBunker(); };
    for (const b of el.querySelectorAll('[data-mut2]')) b.onclick = () => { const m = MUTATIONS2.find((x) => x.id === b.dataset.mut2); if (!S.mutations.includes(m.id)) { if (S.rubles < m.cost) return; S.rubles -= m.cost; S.mutations.push(m.id); } if (S.mutEq.includes(m.id)) S.mutEq = S.mutEq.filter((x) => x !== m.id); else { S.mutEq.push(m.id); if (S.mutEq.length > 2) S.mutEq.shift(); } Save.save(); buildBunker(); };
  },
  sk(el) {
    const S = Save.data;
    let h = `<div class="sect">SKILL POINTS: ${S.sp} · earn them by surviving 5 and 10 minutes, winning and killing bosses</div><div class="grid">`;
    for (const s of SKILLS) { const l = S.skills[s.id] || 0; h += `<button class="pick ${l >= 5 ? 'sel' : ''}" data-sk="${s.id}"><div class="pi">${s.icon}</div><div><b>${s.name}</b><small>${s.desc} per level</small><em>${'●'.repeat(l)}${'○'.repeat(5 - l)} ${l < 5 ? '· 1 point' : 'MAX'}</em></div></button>`; }
    el.innerHTML = h + '</div>';
    for (const b of el.querySelectorAll('[data-sk]')) b.onclick = () => { const id = b.dataset.sk; if (S.sp < 1 || (S.skills[id] || 0) >= 5) return; S.sp--; S.skills[id] = (S.skills[id] || 0) + 1; Save.save(); buildBunker(); };
  },
  stash(el) {
    const S = Save.data, ids = Object.keys(ITEMS);
    let h = '<div class="sect">STASH BOX · unused consumables are stored after every run, and you take up to 2 of each into the next run</div><div class="grid">';
    h += ids.map((id) => `<div class="pick"><div class="pi">${ITEMS[id].icon}</div><div><b>${ITEMS[id].name} × ${S.stash[id] || 0}</b><small>${ITEMS[id].desc}</small></div></div>`).join('');
    el.innerHTML = h + '</div>';
  },
  rou(el) {
    const S = Save.data, SEG = [[0, 18, '#3a2a28'], [0.5, 22, '#4a3a2a'], [1, 18, '#3a4a3a'], [1.5, 20, '#2a4a5a'], [2, 12, '#5a4a2a'], [3, 7, '#6a3a6a'], [5, 3, '#8a6a1a']];
    el.innerHTML = `<div class="sect">ZONE ROULETTE · the Zone gives, the Zone takes</div><div id="wheelWrap"><div id="wheel" style="background:conic-gradient(${SEG.map((s, i) => `${s[2]} ${(i / SEG.length) * 100}% ${((i + 1) / SEG.length) * 100}%`).join(',')})">${SEG.map((s, i) => `<span style="transform:rotate(${(i + 0.5) * (360 / SEG.length)}deg) translateY(-92px)">×${s[0]}</span>`).join('')}</div><div id="wheelPin">▼</div></div><div class="actions">${[50, 100, 250, 500].map((b) => `<button class="big ghost" data-bet="${b}">BET ${b} ₽</button>`).join('')}</div><div id="rouRes" class="sect"></div>`;
    for (const b of el.querySelectorAll('[data-bet]')) b.onclick = () => {
      const bet = +b.dataset.bet; if (S.rubles < bet || BunkerUI.spinning) return;
      Sfx.init(); BunkerUI.spinning = true; S.rubles -= bet; menuRubles();
      let tot = 0; for (const s of SEG) tot += s[1]; let r = rand(tot), i = 0; for (; i < SEG.length - 1; i++) { r -= SEG[i][1]; if (r <= 0) break; }
      const w = $('wheel'), deg = 360 * 5 + (360 - (i + 0.5) * (360 / SEG.length));
      w.style.transition = 'none'; w.style.transform = 'rotate(0deg)'; void w.offsetWidth; w.style.transition = 'transform 2.6s cubic-bezier(.15,.8,.2,1)'; w.style.transform = `rotate(${deg}deg)`;
      for (let k = 0; k < 12; k++) setTimeout(() => Sfx.play('hint'), k * k * 18);
      setTimeout(() => { const win = Math.floor(bet * SEG[i][0]); S.rubles += win; Save.save(); menuRubles(); BunkerUI.spinning = false; if (!$('rouRes')) return; $('rouRes').textContent = win > bet ? `🎉 ×${SEG[i][0]}! You won ${win} ₽` : win ? `×${SEG[i][0]} · you get ${win} ₽ back` : '💀 ×0 · the Zone takes it all'; Sfx.play(win > bet ? 'quest' : 'hurt'); }, 2700);
    };
  },
  codex(el) {
    const S = Save.data, ens = Object.keys(ENEMIES), arts = ALL_ARTS;
    const nm = ens.filter((id) => S.seen.m[id]).length, na = arts.filter((id) => S.seen.a[id]).length;
    let h = `<div class="sect">MUTANTS ${nm}/${ens.length}</div><div class="codex">`;
    h += ens.map((id) => S.seen.m[id] ? `<div class="cx"><b>${ENEMIES[id].name}</b><small>${ENEMIES[id].boss ? '👑 boss · ' : ''}${S.seen.m[id]} killed</small></div>` : '<div class="cx un"><b>???</b><small>not met yet</small></div>').join('');
    h += `</div><div class="sect">ARTIFACTS ${na}/${arts.length}</div><div class="codex">`;
    h += arts.map((id) => S.seen.a[id] ? `<div class="cx">${artImg(id, 'ico')}<b>${ARTIFACTS[id].name}</b><small>${ARTIFACTS[id].desc}</small></div>` : `<div class="cx un"><b>???</b><small>${LOCKED_ARTS.includes(id) ? 'needs research' : 'not found yet'}</small></div>`).join('');
    el.innerHTML = h + '</div>';
  },
  ach(el) {
    const S = Save.data;
    let h = `<div class="sect">ACHIEVEMENTS ${S.ach.length}/${ACHIEVEMENTS.length}</div><div class="grid">`;
    h += ACHIEVEMENTS.map((a) => `<div class="pick ${S.ach.includes(a.id) ? 'sel' : 'locked'}"><div class="pi">${a.icon}</div><div><b>${a.name}</b><small>${a.desc}</small>${a.cos ? `<em>Unlocks look: ${COSMETICS[a.cos].name}</em>` : ''}</div></div>`).join('');
    h += '</div><div class="sect">LOOKS · tap to wear</div><div class="grid chips">';
    h += Object.entries(COSMETICS).map(([id, c]) => S.cosmetics.includes(id) ? `<button class="chip ${S.cosmetic === id ? 'sel' : ''}" data-cos="${id}"><i class="sw" style="background:${c.c ? c.c[0] : '#56603f'}"></i>${c.name}</button>` : `<button class="chip locked">🔒 ${c.name}</button>`).join('');
    h += '</div><div class="sect">ENDINGS ' + S.endings.length + '/' + WISHES.length + (S.trueEnd ? ' · ☀️ TRUE ENDING SEEN' : ' · reach 15:00 in Endless on every stage for the true ending') + '</div>';
    el.innerHTML = h;
    for (const b of el.querySelectorAll('[data-cos]')) b.onclick = () => { S.cosmetic = b.dataset.cos; Save.save(); buildBunker(); };
  },
  chal(el) {
    Meta.rollChallenges();
    const C = Save.data.chal, row = (c, p) => `<div class="pick ${c.done ? 'sel' : ''}"><div class="pi">${c.done ? '✅' : '🏅'}</div><div><b>${c.text}</b><small>${Math.min(c.n, p[c.k] || 0)}/${c.n} · reward ${c.rw} ₽</small><i class="bar"><i style="width:${Math.min(1, (p[c.k] || 0) / c.n) * 100}%"></i></i></div></div>`;
    el.innerHTML = '<div class="sect">DAILY CHALLENGES · new ones every day</div><div class="grid">' + C.list.map((c) => row(c, C.p)).join('') + '</div><div class="sect">WEEKLY CHALLENGE</div><div class="grid">' + C.wlist.map((c) => row(c, C.wp)).join('') + '</div>';
  },
};

// ----- big centered card when surviving unlocks a new stage -----
function unlockCard(nx) {
  let el = $('unlockCard'); if (!el) { el = document.createElement('div'); el.id = 'unlockCard'; document.body.appendChild(el); }
  el.innerHTML = `<small>15:00 SURVIVED</small><b>🔓 NEW STAGE UNLOCKED</b><span>${nx.icon} ${nx.name}</span><em>Pick it on the PLAY screen after this run.</em>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  Sfx.play('quest'); setTimeout(() => Sfx.play('artifact'), 250); flash(0.25, '255,220,120');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 6000);
}
