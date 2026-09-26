'use strict';
// ---------- persistent save: rubles, meta upgrades, characters, stages, settings ----------
const Save = {
  data: null,
  def() {
    return { rubles: 0, meta: {}, chars: ['rookie'], char: 'rookie', stages: ['zone'], stage: 'zone', best: {}, hints: [], runs: 0, wins: 0,
      settings: { master: 0.8, music: 0.5, sfx: 0.8, amb: 0.7, voice: 0.8, shake: true, numbers: true, quality: 'high', hints: true, fps: false } };
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
    const lairs = World.kind === 'over' ? World.lairs.filter((l) => !l.dead) : [];
    if (lairs.length && !this.list.some((q) => q.type === 'lair')) opts.push(['lair', 2]);
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
    } else if (type === 'lair') {
      let l = lairs[0]; for (const x of lairs) if (dist2(x.x, x.y, P.x, P.y) < dist2(l.x, l.y, P.x, P.y)) l = x;
      q = { type, n: 1, p: 0, text: `Destroy the ${ENEMIES[l.family].name} lair`, icon: '☣️', loc: l, reward: reward + 40 };
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
  if (Object.keys(P.arts).length && !P.hadArt) { P.hadArt = true; Hints.show('ability'); }
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

// ---------- save & continue a run (localStorage) ----------
const RunSave = {
  KEY: 'zonebonk_run', t: 0,
  PKEYS: ['hp', 'maxhp', 'dmgMul', 'rateMul', 'areaMul', 'spdMul', 'pickup', 'xpMul', 'dr', 'regen', 'pierce', 'crit', 'thorns', 'dashMul', 'shards', 'lightning', 'aura', 'soul',
    'luck', 'rerolls', 'revives', 'anomRes', 'psiImmune', 'detect', 'dodge', 'lvlHeal', 'execute', 'bossDmg', 'critMul', 'dropMul', 'rubMul', 'dashDmg', 'medMul', 'adren', 'berserk',
    'standFirm', 'zapChance', 'lifesteal', 'exChance', 'frostChance', 'hunter', 'actCdMul', 'actPow', 'burnMul', 'lowRegen', 'momentum', 'sprint', 'bioHp', 'actSel', 'face'],
  GKEYS: ['t', 'stage', 'char', 'endless', 'kills', 'level', 'xp', 'xpNeed', 'pendingLv', 'rubles', 'questsDone', 'elites', 'bossIdx', 'emIdx', 'rushT', 'tier', 'tierT', 'wave', 'waveT',
    'waveMut', 'nextBossT', 'bossN', 'arts', 'dmg', 'labsVisited', 'paidR', 'paidMin', 'streak', 'bossKills', 'seed', 'spawnIdx', 'won'],
  has() { try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; } },
  peek() { try { return JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* storage unavailable */ } },
  save() {
    if (!G || G.title || G.ended || G.state === 'over') return;
    const over = World.levels.over || World.snapshot();
    const crates = World.cur === 'over' ? G.crates : G.levelCrates.over || [];
    const pos = World.kind === 'lab' ? G.returnPos || World.start : { x: P.x, y: P.y };
    const d = { v: 1, g: {}, p: {}, pos, weapons: P.weapons, perks: P.perks, arts: P.arts, actCd: P.actCd, pal: P.pal,
      fields: over.fields.map((f) => (f.art ? f.art.type : null)), crates: crates.map((c) => (c.open ? 1 : 0)),
      pois: over.pois.map((p) => (p.state === 2 ? 2 : 0)), lairs: (over.lairs || []).map((l) => (l.dead ? 1 : 0)),
      labs: Object.keys(World.levels).filter((k) => k.startsWith('lab') && World.levels[k].lab && World.levels[k].lab.cleared) };
    for (const k of this.GKEYS) d.g[k] = G[k];
    for (const k of this.PKEYS) d.p[k] = P[k];
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { /* storage full or blocked */ }
  },
  tick(dt) { this.t -= dt; if (this.t <= 0) { this.t = 15; this.save(); } },
  restore() {
    const d = this.peek(); if (!d) return false;
    newGame(d.g.stage, d.g.char, d.g.endless ? 'endless' : 'standard', d.g.spawnIdx || 0, d.g.seed);
    for (const k of this.GKEYS) if (d.g[k] !== undefined) G[k] = d.g[k];
    for (const k of this.PKEYS) if (d.p[k] !== undefined) P[k] = d.p[k];
    P.weapons = d.weapons; P.perks = d.perks; P.arts = d.arts; P.actCd = d.actCd || {}; if (d.pal) P.pal = d.pal;
    P.x = d.pos.x; P.y = d.pos.y; World.collide(P); CAM.x = P.x; CAM.y = P.y;
    World.fields.forEach((f, i) => { const t = d.fields[i]; f.art = t && ARTIFACTS[t] ? { ...f.art, type: t } : null; if (t && !f.art) spawnArtifact(f); });
    G.crates.forEach((c, i) => { if (d.crates[i]) c.open = 2; });
    World.pois.forEach((p, i) => { if (d.pois[i] === 2) p.state = 2; });
    World.lairs.forEach((l, i) => { if (d.lairs[i]) { l.dead = true; World.destroy(l.ob); } });
    G.clearedLabs = d.labs || [];
    recomputeTags(); hudBuild();
    banner('RUN RESTORED', `${fmtTime(G.t)} · level ${G.level}`, 3, 'good', 2);
    return true;
  },
};
