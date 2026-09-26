'use strict';
// ---------- persistent save: rubles, meta upgrades, characters, stages, settings ----------
const Save = {
  data: null,
  def() {
    return { rubles: 0, meta: {}, chars: ['rookie'], char: 'rookie', stages: ['zone'], stage: 'zone', best: {}, hints: [], runs: 0, wins: 0,
      settings: { master: 0.8, music: 0.5, sfx: 0.8, shake: true, numbers: true, quality: 'high', hints: true, fps: false } };
  },
  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('zonebonk_save') || 'null'); } catch (e) { s = null; }
    const d = this.def();
    this.data = Object.assign(d, s || {});
    this.data.settings = Object.assign(this.def().settings, (s && s.settings) || {});
  },
  save() { try { localStorage.setItem('zonebonk_save', JSON.stringify(this.data)); } catch (e) { /* storage unavailable: progress lasts this session */ } },
  meta(id) { return this.data.meta[id] || 0; },
  get set() { return this.data.settings; },
};

// ---------- radio chatter ----------
const Radio = {
  q: [], cur: null, t: 0, cool: {},
  reset() { this.q = []; this.cur = null; this.cool = {}; $('radio').classList.remove('show'); },
  say(ev, force) {
    const lines = RADIO[ev]; if (!lines) return;
    const now = G ? G.t : 0;
    if (!force && this.cool[ev] !== undefined && now - this.cool[ev] < 45) return;
    this.cool[ev] = now;
    const [who, txt] = pick(lines);
    if (this.q.length > 2) this.q.shift();
    this.q.push({ who, txt });
  },
  update(dt) {
    if (this.cur) { this.t -= dt; if (this.t <= 0) { this.cur = null; $('radio').classList.remove('show'); } }
    if (!this.cur && this.q.length) {
      this.cur = this.q.shift(); this.t = 5.5;
      $('radioWho').textContent = this.cur.who; $('radioTxt').textContent = this.cur.txt;
      $('radio').className = 'show ' + this.cur.who.toLowerCase();
      Sfx.play('radio');
    }
  },
};

// ---------- first-run hints ----------
const Hints = {
  q: [], cur: null, t: 0, checkT: 0,
  reset() { this.q = []; this.cur = null; $('hint').classList.remove('show'); },
  show(id) {
    const S = Save.data;
    if (!S.settings.hints || S.hints.includes(id)) return;
    S.hints.push(id); Save.save();
    this.q.push(HINTS[id]);
  },
  update(dt) {
    if (this.cur) { this.t -= dt; if (this.t <= 0) { this.cur = null; $('hint').classList.remove('show'); } }
    if (!this.cur && this.q.length) { this.cur = this.q.shift(); this.t = 7; $('hintTxt').textContent = this.cur; $('hint').classList.add('show'); Sfx.play('hint'); }
    this.checkT -= dt; if (this.checkT > 0) return; this.checkT = 0.5;
    if (G.t > 1.5) this.show('move');
    for (const a of World.anomalies) if (dist2(a.x, a.y, P.x, P.y) < 260 * 260) { this.show('anomaly'); break; }
    const art = nearestArtifact(); if (art && art.d < 420) this.show('detector');
    for (const c of G.crates) if (!c.open && dist2(c.x, c.y, P.x, P.y) < 220 * 220) { this.show('crate'); break; }
    for (const h of World.hatches) if (dist2(h.x, h.y, P.x, P.y) < 300 * 300) { this.show('lab'); break; }
    for (const p of World.props) if (p.kind === 'barrel' && p.ex && dist2(p.x, p.y, P.x, P.y) < 200 * 200) { this.show('barrel'); break; }
    if (Env.isNight()) this.show('night');
    if (Quests.list.length) this.show('quest');
  },
};

// ---------- side quests (contracts) ----------
const Quests = {
  list: [], nextT: 4, hash: '',
  reset() { this.list = []; this.nextT = 5; this.hash = ''; },
  make() {
    const m = G.t / 60, opts = [];
    const tab = spawnTable(m + 1, false);
    const kills = QUEST_KILL.filter(([id]) => tab[id] && !this.list.some((q) => q.type === 'kill' && q.id === id));
    if (kills.length) opts.push(['kill', 4]);
    opts.push(['artifact', 2], ['elite', m > 1.5 ? 1.5 : 0], ['survive', 2]);
    const pois = World.kind === 'over' ? World.pois.filter((p) => p.state < 2 && !this.list.some((q) => q.poi === p)) : [];
    if (pois.length) opts.push(['poi', 2.5]);
    const labsLeft = World.kind === 'over' && World.hatches.length && !this.list.some((q) => q.type === 'lab') && !G.labsVisited;
    if (labsLeft) opts.push(['lab', 1.5]);
    let tot = 0; for (const o of opts) tot += o[1];
    let r = rand(tot), type = 'kill'; for (const o of opts) { r -= o[1]; if (r <= 0) { type = o[0]; break; } }
    const reward = Math.round(40 + m * 12);
    let q;
    if (type === 'kill') {
      const [id, n0] = pick(kills.length ? kills : QUEST_KILL.slice(0, 1)), n = Math.round(n0 * (1 + m * 0.08));
      q = { type, id, n, p: 0, text: `Hunt ${n} ${ENEMIES[id].name}${ENEMIES[id].name.endsWith('s') ? '' : ENEMIES[id].name.endsWith('sh') ? 'es' : 's'}`, icon: '🎯', reward };
    } else if (type === 'artifact') q = { type, n: 1, p: 0, text: 'Retrieve an artifact', icon: '💎', reward: reward + 20 };
    else if (type === 'elite') q = { type, n: 2, p: 0, text: 'Kill 2 elite mutants', icon: '👑', reward: reward + 30 };
    else if (type === 'poi') { const poi = pick(pois); q = { type, poi, n: 1, p: 0, text: `Clear the ${poi.name}`, icon: poi.icon, loc: poi, reward: reward + 50 }; }
    else if (type === 'lab') {
      let h = World.hatches[0]; for (const x of World.hatches) if (dist2(x.x, x.y, P.x, P.y) < dist2(h.x, h.y, P.x, P.y)) h = x;
      q = { type, n: 1, p: 0, text: `Descend into ${h.name}`, icon: '🕳️', loc: h, reward: reward + 60 };
    } else {
      const regs = World.regions.filter((rg) => rg.name !== World.region(P.x, P.y).name && dist(rg.x, rg.y, P.x, P.y) < 2600);
      const rg = regs.length ? pick(regs) : World.regions[0];
      q = { type: 'survive', region: rg.name, n: 40, p: 0, text: `Hold out in ${rg.name} for 40s`, icon: '⏱️', loc: rg, reward };
    }
    this.list.push(q);
    Radio.say('quest');
  },
  prog(type, test, amt = 1) {
    for (const q of this.list) if (q.type === type && (!test || test(q))) { q.p = Math.min(q.n, q.p + amt); if (q.p >= q.n) this.complete(q); }
  },
  complete(q) {
    if (q.done) return; q.done = true;
    this.list = this.list.filter((x) => x !== q);
    G.rubles += q.reward; G.questsDone++;
    for (let i = 0; i < 6; i++) dropGem(P.x + rand(-40, 40), P.y + rand(-40, 40), 3 + Math.floor(G.t / 60));
    if (Math.random() < 0.5) G.pendingLv++;
    banner('CONTRACT COMPLETE', `${q.text}  •  +${q.reward} ₽`, 3, 'good');
    Radio.say('questDone', true); Sfx.play('quest');
    this.nextT = 8;
  },
  update(dt) {
    if (this.list.length < 3) { this.nextT -= dt; if (this.nextT <= 0) { this.make(); this.nextT = this.list.length < 2 ? 12 : 30; } }
    const reg = World.region(P.x, P.y).name;
    for (const q of this.list) if (q.type === 'survive' && reg === q.region && World.kind === 'over') { q.p += dt; if (q.p >= q.n) this.complete(q); }
    const h = this.list.map((q) => q.text + Math.floor(q.p)).join('|');
    if (h !== this.hash) {
      this.hash = h;
      $('quests').innerHTML = this.list.map((q) => `<div class="q"><span>${q.icon}</span><div><b>${q.text}</b><i style="width:${(q.p / q.n) * 100}%"></i><small>${q.type === 'survive' ? Math.floor(q.p) + '/' + q.n + 's' : q.p + '/' + q.n} · ${q.reward} ₽</small></div></div>`).join('');
    }
  },
};

// ---------- synergy + artifact ability ----------
function recomputeTags() {
  const c = {}, ac = {};
  for (const k in TAGS) { c[k] = 0; ac[k] = 0; }
  for (const id in P.arts) { const t = ARTIFACTS[id].tag; c[t] += P.arts[id]; ac[t] += P.arts[id]; }
  for (const w of P.weapons) { const t = WEAPONS[w.id].tag; if (t) c[t]++; }
  const old = P.syn || {};
  P.tags = c; P.syn = {};
  for (const k in TAGS) {
    P.syn[k] = c[k] >= 6 ? 2 : c[k] >= 3 ? 1 : 0;
    if (P.syn[k] > (old[k] || 0) && G.t > 0.5) {
      banner(`${TAGS[k].icon} ${TAGS[k].name.toUpperCase()} SYNERGY ${P.syn[k] === 2 ? 'II' : 'I'}`, P.syn[k] === 2 ? TAGS[k].b6 : TAGS[k].b3, 3.5, 'art');
      Hints.show('synergy');
    }
  }
  let best = null, bv = 0;
  for (const k in ac) if (ac[k] > bv) { bv = ac[k]; best = k; }
  if (best && !P.ability) Hints.show('ability');
  P.ability = best; P.abilityPow = bv;
}
function useAbility() {
  if (!G || G.state !== 'play' || !P.ability || P.abCd > 0) return;
  const k = P.ability, pow = 1 + (P.abilityPow - 1) * 0.25;
  P.abCd = 22;
  Sfx.play('ability'); shake(8);
  banner(TAGS[k].icon + ' ' + TAGS[k].ability.toUpperCase(), '', 1.4, 'art');
  if (k === 'electric') {
    const n = Math.round(10 + 3 * pow);
    for (let i = 0; i < n; i++) G.timers.push({ t: i * 0.09, fn: () => { const t = randomEnemyNear(P.x, P.y, 650); const x = t ? t.x : P.x + rand(-300, 300), y = t ? t.y : P.y + rand(-250, 250); strike(x, y, 70 * pow, 60, false); } });
  } else if (k === 'fire') {
    G.fx.push({ k: 'nova', x: P.x, y: P.y, r: 10, max: 340 * P.areaMul, spd: 900, dmg: 110 * pow, hit: new Set(), life: 1, maxl: 1 });
    Sfx.play('fire');
  } else if (k === 'psi') {
    for (const e of G.enemies) if (dist2(e.x, e.y, P.x, P.y) < 750 * 750) { e.stun = 2.6; hurtEnemy(e, 45 * pow, 0, 0, true); }
    G.ebullets.length = 0; G.psiFlash = 1; flash(0.5, '190,120,255');
  } else if (k === 'gravity') {
    let tx = P.x + P.lastMx * 200, ty = P.y + P.lastMy * 200;
    const t = randomEnemyNear(P.x, P.y, 450); if (t) { tx = t.x; ty = t.y; }
    G.fx.push({ k: 'hole', x: tx, y: ty, r: 280 * P.areaMul, life: 3, max: 3, dps: 30 * pow, pull: 520, end: 170 * pow, tick: 0 });
    Sfx.play('vortex');
  } else if (k === 'bio') {
    G.healT = 3; G.healRate = (P.maxhp * 0.35) / 3;
    G.fx.push({ k: 'cloud', follow: true, x: P.x, y: P.y, r: 160 * P.areaMul, life: 5, max: 5, dps: 45 * pow, tick: 0 });
    Sfx.play('heal');
  }
}
function randomEnemyNear(x, y, r) {
  EG.query(x, y, r, TMP2);
  const c = TMP2.filter((e) => !e.dead && dist2(x, y, e.x, e.y) < r * r);
  return c.length ? pick(c) : null;
}
function strike(x, y, dmg, r, hurtsPlayer) {
  G.fx.push({ k: 'sky', x, y, life: 0.3, max: 0.3 });
  G.fx.push({ k: 'ring', x, y, r, life: 0.3, max: 0.3, c: '200,230,255' });
  EG.query(x, y, r + 30, TMP);
  for (const e of TMP) if (dist2(x, y, e.x, e.y) < (r + e.r) ** 2) hurtEnemy(e, dmg, 0, 0, true);
  if (hurtsPlayer && dist2(x, y, P.x, P.y) < (r + P.r) ** 2) hurtPlayer(25, 'lightning', false, 'anomaly');
  for (const ob of World.destructiblesNear(x, y, r)) damageOb(ob, dmg);
  burst(x, y, 14, '200,230,255', 200, { add: true });
  Sfx.play('thunder');
}
