'use strict';
// ---------- content: legendary stalkers, horde defense, co-op roles, mutation looks, Zone radio news ----------

// ----- legendary stalkers: earned by deeds, not bought -----
CHARACTERS.push(
  { id: 'doctor', name: 'The Doctor', icon: '⚕️', cost: 0, weapon: 'pistol', legend: { req: 'Complete 30 contracts (total)', test: (S) => (S.totals.contracts || 0) >= 30 },
    desc: 'Field surgeon: every 20 kills heals 12% HP, and one free revive per run.', mod: { maxhp: 10 }, pal: { jacket: '#d8d8d0', hood: '#b8b8b0' } },
  { id: 'ghost', name: 'The Ghost', icon: '👻', cost: 0, weapon: 'dual', legend: { req: 'Kill 10 bosses (total)', test: (S) => (S.totals.bosses || 0) >= 10 },
    desc: 'Every dash leaves you untouchable for 1 second. Dash recharges 30% faster.', mod: { spdMul: 0.06 }, pal: { jacket: '#3a3e48', hood: '#2a2e38' } },
  { id: 'hunter', name: 'Chimera Hunter', icon: '🐾', cost: 0, weapon: 'shotgun', legend: { req: 'Kill 3,000 mutants (total)', test: (S) => (S.totals.kills || 0) >= 3000 },
    desc: 'Every 12th kill releases a shockwave around you. +15 HP.', mod: { maxhp: 15 }, pal: { jacket: '#6a4a2a', hood: '#4a3420' } },
  { id: 'prophet', name: 'Monolith Prophet', icon: '💠', cost: 0, weapon: 'gauss', legend: { req: 'Unlock 10 stages', test: (S) => S.stages.length >= 10 },
    desc: 'Immune to psi. Starts every run with two random artifacts.', mod: { dmgMul: 0.05 }, pal: { jacket: '#7a7a6a', hood: '#5a5a4a' } },
);
function legendCheck() {
  const S = Save.data; if (!S || !S.chars) return [];
  const got = [];
  for (const c of CHARACTERS) if (c.legend && !S.chars.includes(c.id) && c.legend.test(S)) { S.chars.push(c.id); got.push(c); }
  if (got.length) Save.save();
  return got;
}

// ----- horde defense: hold the generator for 10 waves -----
MODES2.push(['horde', '🏰', 'Horde Defense', 'Defend a generator through 10 waves. Stay close to it! ×1.4 rubles.', 0.4]);
const HORDE_WAVES = 10, HORDE_GAP = 50;
const HORDE_POOL = [['dog', 'zombie'], ['dog', 'zombie', 'flesh'], ['snork', 'dog', 'flesh'], ['snork', 'boar', 'zombie'], ['bloodsucker', 'dog', 'snork'], ['boar', 'snork', 'flesh'], ['bloodsucker', 'controller', 'dog'], ['boar', 'bloodsucker', 'snork'], ['izlom', 'bloodsucker', 'boar'], ['izlom', 'bloodsucker', 'controller']];
const Horde = {
  init() {
    const x = World.start.x, y = World.start.y - 170;
    G.horde = { x, y, hp: 600, max: 600, wave: 0, t: 25, r: 700, warn: 0 };
    World.addOb({ x, y, r: 34 });
    banner('🏰 HORDE DEFENSE', 'Protect the generator for ' + HORDE_WAVES + ' waves. The first wave comes in 25 seconds.', 4, '', 2);
  },
  update(dt) {
    const H = G.horde; if (!H || G.ended || World.kind !== 'over') return;
    H.t -= dt;
    if (H.wave < HORDE_WAVES && H.t <= 4 && !H.warn) { H.warn = 1; banner('⚠ WAVE ' + (H.wave + 1) + ' INCOMING', 'Get back to the generator!', 2.5, 'bad'); Sfx.play('siren'); }
    if (H.wave < HORDE_WAVES && H.t <= 0) this.wave();
    // mutants chew on the generator; it also suffers when nobody guards it
    const away = dist(P.x, P.y, H.x, H.y) > H.r && !(G.coop && coOthers().some((q) => !q.gone && dist(q.x, q.y, H.x, H.y) < H.r));
    let dmg = away && H.wave > 0 ? 4 * dt : 0;
    EG.query(H.x, H.y, 80, TMP3); for (const e of TMP3) if (!e.dead && dist2(e.x, e.y, H.x, H.y) < (e.r + 40) ** 2) dmg += (e.boss ? 12 : 3) * dt;
    if (dmg) { H.hp -= dmg; H.hitT = 0.2; }
    H.hitT = Math.max(0, (H.hitT || 0) - dt);
    if (away && H.wave > 0 && NOW - (H.awayMsg || 0) > 6) { H.awayMsg = NOW; text(P.x, P.y - 70, 'Return to the generator!', '#ffcf6a', false, true); }
    if (H.hp <= 0) { H.hp = 0; endRun('dead', 'the horde (generator destroyed)'); return; }
    if (H.wave >= HORDE_WAVES && !G.enemies.some((e) => !e.dead && e.horde)) { G.won = true; endRun('win'); }
  },
  wave() {
    const H = G.horde; H.wave++; H.warn = 0; H.t = HORDE_GAP;
    const pool = HORDE_POOL[Math.min(H.wave - 1, HORDE_POOL.length - 1)], n = Math.round((10 + H.wave * 5) * (G.coopMul || 1) * diffDef().spawn);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2), d = 950 + rand(0, 200);
      let x = H.x + Math.cos(a) * d, y = H.y + Math.sin(a) * d * 0.8;
      if (!World.free(x, y, 16)) { x = H.x + Math.cos(a) * (d - 250); y = H.y + Math.sin(a) * (d - 250) * 0.8; }
      if (!World.free(x, y, 16)) continue;
      const id = pick(pool); if (!ENEMIES[id]) continue;
      const e = spawnEnemy(id, x, y, { noElite: H.wave < 4 }); if (e) e.horde = true;
    }
    if (H.wave % 5 === 0) { const e = spawnBoss(pick(BOSS_POOL), { name: 'HORDE CHAMPION', hpMul: 0.5 + H.wave * 0.08 }); if (e) e.horde = true; }
    banner('🏰 WAVE ' + H.wave + ' / ' + HORDE_WAVES, H.wave === HORDE_WAVES ? 'The last wave! Hold on!' : 'Hold the line!', 2.5, 'bad', 2);
    if (H.wave > 1) { H.hp = Math.min(H.max, H.hp + 60); G.pickups.push({ type: 'med', x: H.x + 90, y: H.y + 60, t: 0 }); }
  },
  draw() {
    const H = G.horde; if (!H || World.kind !== 'over') return;
    ctx.strokeStyle = `rgba(255,207,106,${0.25 + Math.sin(NOW * 2) * 0.08})`; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.ellipse(H.x, H.y, H.r, H.r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    shadow(H.x, H.y + 4, 40, 12, 0.35);
    ctx.fillStyle = H.hitT > 0 ? '#c86a4a' : '#5a6a4a'; ctx.fillRect(H.x - 30, H.y - 46, 60, 46);
    ctx.fillStyle = '#3a4430'; ctx.fillRect(H.x - 30, H.y - 52, 60, 8);
    ctx.fillStyle = `rgba(255,220,90,${0.6 + Math.sin(NOW * 6) * 0.3})`; ctx.beginPath(); ctx.arc(H.x, H.y - 26, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(H.x - 40, H.y - 68, 80, 8);
    ctx.fillStyle = H.hp / H.max > 0.35 ? '#8fdc6a' : '#ff6a4a'; ctx.fillRect(H.x - 39, H.y - 67, 78 * H.hp / H.max, 6);
    ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf6a'; ctx.fillText('GENERATOR', H.x, H.y - 74);
  },
};
if (typeof RunSave !== 'undefined' && RunSave.GKEYS) RunSave.GKEYS.push('horde');

// ----- co-op roles: each teammate picks one; abilities fire on their own -----
const CO_ROLES = {
  none: { name: 'No role', icon: '➖', desc: '' },
  medic: { name: 'Medic', icon: '💉', desc: 'Every 20s heals you and nearby teammates. Revives twice as fast.', cd: 20 },
  engineer: { name: 'Engineer', icon: '🔧', desc: 'Every 30s drops a sentry gun for 12s.', cd: 30 },
  scout: { name: 'Scout', icon: '🔭', desc: '+15% speed, detector ×2. Every 25s marks artifacts on the map.', cd: 25 },
  tank: { name: 'Tank', icon: '🛡️', desc: '+60 HP, -15% damage taken. Every 25s a shield and a shockwave.', cd: 25 },
};
const Roles = {
  sentries: [],
  mine() { return G && G.coop && CO.active ? Save.data.coRole || 'none' : 'none'; },
  apply() {
    this.sentries = []; G.roleT = 8;
    const r = this.mine();
    if (r === 'scout') { P.spdMul += 0.15; P.detect = (P.detect || 1) * 2; }
    if (r === 'tank') { P.maxhp += 60; P.hp += 60; P.dr += 0.15; }
    if (r !== 'none') banner(CO_ROLES[r].icon + ' ' + CO_ROLES[r].name.toUpperCase(), CO_ROLES[r].desc, 3.5, 'good');
  },
  update(dt) {
    const r = this.mine(); if (r === 'none' || G.state !== 'play') return;
    G.roleT -= dt;
    if (G.roleT <= 0 && !(P.ghost > 0)) {
      G.roleT = CO_ROLES[r].cd;
      if (r === 'medic') {
        P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.25); Sfx.play('heal'); text(P.x, P.y - 60, '💉 HEAL', '#8fdc6a', false, true);
        G.fx.push({ k: 'boom', x: P.x, y: P.y, r: 260, life: 0.5, max: 0.5 });
        Net.bcast ? (CO.role === 'host' ? Net.bcast({ t: 'rheal', x: P.x | 0, y: P.y | 0 }) : Net.send({ t: 'rheal', x: P.x | 0, y: P.y | 0 })) : 0;
      } else if (r === 'engineer') {
        this.sentries.push({ x: P.x + P.face * 40, y: P.y + 10, life: 12, cd: 0, a: 0 }); Sfx.play('ability'); text(P.x, P.y - 60, '🔧 SENTRY', '#ffcf6a', false, true);
      } else if (r === 'scout') {
        G.artMarkT = 10; Sfx.play('radio'); text(P.x, P.y - 60, '🔭 ARTIFACTS MARKED', '#9fe8ff', false, true);
      } else if (r === 'tank') {
        P.shieldT = Math.max(P.shieldT, 2.5); explode(P.x, P.y, 150, 30, true); text(P.x, P.y - 60, '🛡️ SHIELD', '#9fe8ff', false, true);
      }
    }
    for (const s of this.sentries) {
      s.life -= dt; s.cd -= dt;
      if (s.cd <= 0) {
        EG.query(s.x, s.y, 420, TMP3); let best = null, bd = 420 * 420;
        for (const e of TMP3) { if (e.dead) continue; const d = dist2(e.x, e.y, s.x, s.y); if (d < bd) { bd = d; best = e; } }
        if (best) { s.cd = 0.35; s.a = Math.atan2(best.y - s.y, best.x - s.x); hurtEnemy(best, 14 * (1 + G.t / 500), Math.cos(s.a) * 60, Math.sin(s.a) * 60); s.flash = 0.06; Sfx.play('pistol'); }
      }
      s.flash = Math.max(0, (s.flash || 0) - dt);
    }
    this.sentries = this.sentries.filter((s) => s.life > 0);
  },
  draw() {
    for (const s of this.sentries) {
      shadow(s.x, s.y + 2, 18, 6, 0.3);
      ctx.strokeStyle = '#444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - 12, s.y); ctx.lineTo(s.x, s.y - 16); ctx.lineTo(s.x + 12, s.y); ctx.stroke();
      ctx.fillStyle = '#6a7a5a'; ctx.fillRect(s.x - 9, s.y - 26, 18, 12);
      ctx.save(); ctx.translate(s.x, s.y - 20); ctx.rotate(s.a); ctx.fillStyle = '#333'; ctx.fillRect(0, -2.5, 22, 5); if (s.flash > 0) { ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.beginPath(); ctx.arc(24, 0, 6, 0, TAU); ctx.fill(); } ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(s.x - 14, s.y + 6, 28, 3); ctx.fillStyle = '#ffcf6a'; ctx.fillRect(s.x - 14, s.y + 6, 28 * s.life / 12, 3);
    }
  },
};

// ----- mutation path: the more mutations you own, the more mutant you look (and hit) -----
function mutLevel() { const S = Save.data; return S && S.mutations ? Math.min(5, S.mutations.length) : 0; }
function drawMutations() {
  if (!G || G.title || World.kind === undefined) return;
  const S = Save.data, lv = mutLevel(), eq = (S.mutEq || []); if (!lv) return;
  const x = P.x, y = P.y - (P.z || 0), f = P.face || 1, bob = Math.abs(Math.sin(P.anim || 0)) * 1.5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 30 + lv * 6); g.addColorStop(0, `rgba(120,255,90,${0.05 + lv * 0.03})`); g.addColorStop(1, 'rgba(120,255,90,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 20, 30 + lv * 6, 0, TAU); ctx.fill();
  if (eq.includes('controller')) { for (const dx of [-2.5, 3.5]) { ctx.fillStyle = `rgba(200,120,255,${0.7 + Math.sin(NOW * 5) * 0.3})`; ctx.beginPath(); ctx.arc(x + f * dx, y - 38 - bob, 2.2, 0, TAU); ctx.fill(); } }
  if (eq.includes('chimera')) { const k = 0.5 + Math.max(0, Math.sin(NOW * 7)) * 0.5; ctx.fillStyle = `rgba(255,60,60,${0.35 * k})`; ctx.beginPath(); ctx.arc(x, y - 24 - bob, 7 * k, 0, TAU); ctx.fill(); }
  if (eq.includes('burer')) { ctx.fillStyle = `rgba(255,190,90,${0.25 + Math.sin(NOW * 4) * 0.1})`; ctx.beginPath(); ctx.arc(x + f * 14, y - 20 - bob, 8, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (eq.includes('sucker')) { ctx.strokeStyle = 'rgba(150,20,30,0.85)'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + f * 4 + i * 2, y - 32 - bob); ctx.quadraticCurveTo(x + f * 6 + i * 3, y - 27, x + f * 4 + i * 4 + Math.sin(NOW * 6 + i) * 1.5, y - 24 - bob); ctx.stroke(); } }
  if (eq.includes('snork') && P.moving && Math.random() < 0.3) part(x + rand(-6, 6), y - 2, { z: 2, vz: 20, g: -10, c: '140,200,90', s: 3, life: 0.5 });
  if (lv >= 3) { ctx.strokeStyle = `rgba(110,200,80,${0.3 + (lv - 3) * 0.15})`; ctx.lineWidth = 2; for (let i = 0; i < lv - 2; i++) { const a = NOW * 1.5 + i * 2.1; ctx.beginPath(); ctx.moveTo(x - f * 6, y - 26 - bob); ctx.quadraticCurveTo(x - f * (16 + i * 4), y - 30 + Math.sin(a) * 8, x - f * (20 + i * 5), y - 18 + Math.cos(a) * 6); ctx.stroke(); } }
}

// ----- Zone radio news: bulletins built from what is actually happening -----
const News = {
  t: 95,
  lines() {
    const out = [], reg = World.kind === 'over' ? World.region(P.x, P.y) : null, em = G.emIdx < EMISSIONS.length ? EMISSIONS[G.emIdx] - G.t : null;
    if (em !== null && em > 30 && em < 200) out.push(['Scientist', `Scientists expect an emission in about ${Math.ceil(em / 60)} minutes. Know where your shelter is.`, `Учёные ожидают выброс примерно через ${Math.ceil(em / 60)} мин. Знай, где твоё укрытие.`]);
    if (G.kills > 50) out.push(['Stalker', `Word at the bar: someone has put down ${G.kills} mutants already. That's you, isn't it?`, `В баре говорят: кто-то уже положил ${G.kills} мутантов. Это ведь ты?`]);
    if (reg) out.push(['Stalker', `Mutant packs spotted moving through ${reg.name}. Watch your back.`, `Стаи мутантов замечены в районе «${reg.name}». Береги спину.`]);
    if (G.arts === 0 && G.t > 150) out.push(['Sidorovich', 'Still no artifacts? Throw a bolt, listen to the detector. They are out there.', 'До сих пор ни одного артефакта? Кинь болт, слушай детектор. Они там есть.']);
    if (G.arts > 2) out.push(['Sidorovich', `${G.arts} artifacts already? Keep this up and I will retire rich.`, `Уже ${G.arts} артефакта? Так держать — я уйду на пенсию богатым.`]);
    if (Env.weather !== 'clear') out.push(['Scientist', `Weather report: ${(WEATHER[Env.weather] || {}).name || Env.weather} over the area. Adjust your route.`, `Сводка погоды: над районом ${(WEATHER[Env.weather] || {}).name || Env.weather}. Меняй маршрут.`]);
    if (G.tier >= 2) out.push(['Stalker', 'The Zone is getting angrier. Veterans say they have never seen it like this.', 'Зона всё злее. Ветераны говорят, такого ещё не было.']);
    out.push(['Stalker', 'Duty and Freedom traded fire near the old factory again. Nobody won, as usual.', 'Долг и Свобода опять постреляли у старого завода. Как всегда, никто не победил.']);
    out.push(['Sidorovich', 'Trader news: I pay good money for contracts done right. Check the board.', 'Новости торговца: хорошо плачу за чисто сделанные контракты. Загляни на доску.']);
    out.push(['Barkeep', 'Bar tonight: warm vodka, cold stew, and stories you will not believe.', 'Сегодня в баре: тёплая водка, холодная похлёбка и истории, в которые не поверишь.']);
    return out;
  },
  update(dt) {
    if (G.tutorial || G.state !== 'play') return;
    this.t -= dt; if (this.t > 0) return;
    this.t = rand(110, 160);
    const [who, en, ru] = pick(this.lines()), L = typeof I18n !== 'undefined' ? I18n.cur : 'en', vl = Voice.lang();
    const useRu = vl === 'ru' || (vl === 'off' && (L === 'ru' || L === 'uk')), txt = '📻 ' + (useRu ? ru : en);
    const uiRu = L === 'ru', show = '📻 ' + (uiRu ? ru : en), name = uiRu ? (SPEAKERS[who] || {}).ru || who : who; // shown in the interface language
    if (vl !== 'off') Voice.say('news', { line: { who, name, txt, show }, force: true, prio: 1 });
    else { if (Radio.q.length > 2) Radio.q.shift(); Radio.q.push({ who: name, txt: show }); }
  },
};

// ----- hooks -----
const _ctNew = newGame;
newGame = function (...a) {
  _ctNew(...a);
  News.t = rand(80, 110); G.legendK = 0; G.docRev = 0;
  const c = G.char;
  if (c === 'prophet') { P.psiImmune = P.basePsi = true; const ids = Object.keys(ARTIFACTS).filter((k) => !ARTIFACTS[k].legend); for (let i = 0; i < 2; i++) { const id = pick(ids); if (takeArtifact) takeArtifact(id); } }
  if (c === 'ghost') P.dashMul = (P.dashMul || 1) * 0.7;
  if (c === 'doctor') P.revives = (P.revives || 0) + 1;
  if (G.mode2 === 'horde') Horde.init();
  Roles.apply();
  const lv = mutLevel(); if (lv) { P.dmgMul += lv * 0.03; P.spdMul += lv * 0.01; }
};
const _ctKill = killEnemy;
killEnemy = function (e, ...a) {
  const was = e && e.dead; const r = _ctKill(e, ...a);
  if (e && !was && e.dead && G && !G.coGuest) {
    G.legendK = (G.legendK || 0) + 1;
    if (G.char === 'doctor' && G.legendK % 20 === 0) { P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.12); text(P.x, P.y - 60, '⚕️ +12%', '#8fdc6a', false, true); }
    if (G.char === 'hunter' && G.legendK % 12 === 0) G.timers.push({ t: 0.05, fn: () => explode(P.x, P.y, 170 * P.areaMul, 45 * (1 + G.t / 500), true) });
  }
  return r;
};
const _ctDash = tryDash;
tryDash = function () { if (!P || !G || G.title) return _ctDash(); const was = P.dashT > 0; _ctDash(); if (!was && P.dashT > 0 && G && G.char === 'ghost') { P.inv = Math.max(P.inv, P.dashT + 1); P.ghostFx = 1.2; } };
const _ctW2Up = W2.update.bind(W2);
W2.update = function (dt) {
  _ctW2Up(dt);
  Horde.update(dt); Roles.update(dt); News.update(dt);
  if (P.ghostFx > 0) P.ghostFx -= dt;
};
const _ctTop = drawW2Top;
drawW2Top = function (x0, y0, x1, y1) {
  _ctTop(x0, y0, x1, y1);
  Horde.draw(); Roles.draw(); drawMutations();
  if (P.ghostFx > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.6, P.ghostFx); ctx.fillStyle = 'rgba(160,190,255,0.5)'; ctx.beginPath(); ctx.ellipse(P.x, P.y - 22, 20, 34, 0, 0, TAU); ctx.fill(); ctx.restore(); }
};

// co-op: roles travel with the lobby; a medic's heal reaches teammates nearby
const _ctLobbyMsg = coLobbyMsg;
coLobbyMsg = function () { const m = _ctLobbyMsg(); m.players = m.players.map((q) => ({ ...q, role: (CO.players.get(q.pid) || {}).role || 'none' })); return m; };
const _ctOnMsg = Coop.onMsg.bind(Coop);
Coop.onMsg = function (m, from) {
  if (m && m.t === 'rheal') { if (CO.role === 'host') Net.bcast(m); if (G && !G.title && dist(P.x, P.y, m.x, m.y) < 450 && !(P.ghost > 0)) { P.hp = Math.min(P.maxhp, P.hp + P.maxhp * 0.2); text(P.x, P.y - 60, '💉 +20%', '#8fdc6a', false, true); } return; }
  if (m && m.t === 'lobbyMe' && CO.role === 'host') { const p = CO.players.get(from); if (p && CO_ROLES[m.role]) p.role = m.role; }
  const r = _ctOnMsg(m, from);
  if (m && m.t === 'lobby') for (const q of m.players) { const p = CO.players.get(q.pid); if (p && q.role) p.role = q.role; }
  return r;
};
const _ctSend = Net.send.bind(Net);
Net.send = function (m, ...a) { if (m && m.t === 'lobbyMe') m.role = Save.data.coRole || 'none'; return _ctSend(m, ...a); };
const _ctLobbyUI = coLobbyUI;
coLobbyUI = function () {
  _ctLobbyUI();
  if (!$('coRole') || CO.active) return;
  const me = CO.players.get(CO.me); if (me) me.role = Save.data.coRole || 'none';
  $('coRole').innerHTML = Object.entries(CO_ROLES).map(([id, r]) => `<option value="${id}" ${id === (Save.data.coRole || 'none') ? 'selected' : ''}>${r.icon} ${r.name}</option>`).join('');
  $('coRoleDesc').textContent = (CO_ROLES[Save.data.coRole || 'none'] || {}).desc || 'Pick a role to get a special ability.';
  const slots = document.querySelectorAll('#coSlots .coSlot:not(.empty) small'), ps = [...CO.players.values()];
  slots.forEach((el, i) => { const p = ps[i]; if (p && p.role && p.role !== 'none' && CO_ROLES[p.role] && !el.dataset.role) { el.dataset.role = 1; el.textContent = CO_ROLES[p.role].icon + ' ' + CO_ROLES[p.role].name + ' · ' + el.textContent; } });
};
// revives: a medic brings teammates back twice as fast
const _ctCoUp = Coop.update.bind(Coop);
Coop.update = function (dt) {
  _ctCoUp(dt);
  if (G && P.ghost > 0 && CO.reviveT > 0 && coOthers().some((q) => q.role === 'medic' && !q.gone && !q.ghost && q.x !== undefined && dist2(q.x, q.y, P.x, P.y) < 80 * 80)) CO.reviveT += dt;
};

addEventListener('DOMContentLoaded', () => {
  // role picker in the co-op lobby
  const cs = $('coChar'); if (cs && !$('coRole')) {
    const l = document.createElement('label'); l.className = 'set'; l.innerHTML = '<span>Your role</span><select id="coRole"></select>';
    cs.closest('label').after(l);
    const d = document.createElement('div'); d.id = 'coRoleDesc'; d.className = 'coRoleDesc'; l.after(d);
    $('coRole').onchange = () => { Save.data.coRole = $('coRole').value; Save.save(); const me = CO.players.get(CO.me); if (me) me.role = Save.data.coRole; if (CO.role === 'host') Net.bcast(coLobbyMsg()); else Net.send({ t: 'lobbyMe', name: coNick(), char: Save.data.char, ready: CO.ready }); coLobbyUI(); };
  }
  // legendary stalkers: unlocked by deeds, shown with their requirement
  const _bs = buildSetup;
  buildSetup = function (...a) {
    const got = legendCheck();
    const r = _bs(...a);
    const S = Save.data;
    for (const c of CHARACTERS) {
      if (!c.legend) continue;
      const b = document.querySelector(`[data-char="${c.id}"]`); if (!b) continue;
      b.classList.add('lgd');
      const em = b.querySelector('em'); if (em && !S.chars.includes(c.id)) em.innerHTML = `${WEAPONS[c.weapon].icon} ${WEAPONS[c.weapon].name} · <span class="poor">🏆 ${c.legend.req}</span>`;
      if (!S.chars.includes(c.id)) b.onclick = () => { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); };
    }
    for (const c of got) setTimeout(() => banner('🏆 LEGENDARY STALKER', c.icon + ' ' + c.name + ' joins you!', 3.5, 'good', 2), 300);
    return r;
  };
  // horde: a proper ending line
  const _er = endRun;
  endRun = function (kind, src) {
    const r = _er(kind, src);
    for (const id of ['bossCard', 'unlockCard']) { const el = $(id); if (el) el.classList.remove('show'); }
    if (G && G.horde && kind === 'win' && $('overSub')) $('overSub').textContent = 'The generator held. All ' + HORDE_WAVES + ' waves repelled!';
    return r;
  };
});
