'use strict';
// ---------- variety pack: living danger areas, moving anomalies, rescues, crows, snipers, packs, stagger, shatter,
// perfect dodges, targeting modes, card control, boss bargains, the saw launcher and full save backups ----------
// Phone budget: every addition is capped, reuses cached mutant sprites and draws a few simple shapes at most.
const ftTr = (s) => (typeof I18n !== 'undefined' && I18n.cur !== 'en' ? I18n.tc(s) : s);
const ftActive = () => G && !G.title && !G.tutorial && !G.coGuest && World.kind === 'over';

// ===== 1. danger areas shift every run, and a roaming HOT ZONE pays double =====
function ftShuffleDanger() {
  for (const r of World.regions || []) { if (r.d0 === undefined) r.d0 = r.danger || 3; r.danger = clamp(r.d0 + randi(-1, 1), 1, 5); r.hot = false; }
}
function ftHotTick(dt) {
  const H = G.ft; H.hotT -= dt;
  if (H.hotT > 0) return;
  for (const r of World.regions) r.hot = false;
  if (H.hotOn) { H.hotOn = null; H.hotT = rand(60, 100); return; } // a quiet spell between hot zones
  const here = World.region(P.x, P.y), opts = World.regions.filter((r) => r !== here && r.name !== here.name);
  if (!opts.length) { H.hotT = 60; return; }
  const r = pick(opts); r.hot = true; H.hotOn = r; H.hotT = 90;
  banner('🔥 ' + ftTr('HOT ZONE') + ': ' + r.name.toUpperCase(), ftTr('Mutants there are tougher, but everything they drop is worth double. 90 seconds.'), 4, 'art');
  Sfx.play('quest'); G.zone = null; // refresh the area label
}

// ===== 2. emissions move some anomaly fields =====
function ftMoveFields() {
  const fs = World.fields.filter((f) => dist(f.x, f.y, P.x, P.y) > 600), n = Math.max(1, Math.round(fs.length * 0.3));
  let moved = 0;
  for (const f of fs.sort(() => Math.random() - 0.5).slice(0, n)) {
    for (let k = 0; k < 20; k++) {
      const r = pick(World.regions), x = clamp(r.x + rand(-700, 700), 300, WORLD - 300), y = clamp(r.y + rand(-700, 700), 300, WORLD - 300);
      if (dist(x, y, P.x, P.y) < 700 || !f.anoms.every((a) => World.free(x + (a.x - f.x), y + (a.y - f.y), 10))) continue;
      const dx = x - f.x, dy = y - f.y;
      f.x += dx; f.y += dy;
      for (const a of f.anoms) { a.x += dx; a.y += dy; if (a.cx !== undefined) a.cx += dx; if (a.cy !== undefined) a.cy += dy; }
      if (f.art) { f.art.x += dx; f.art.y += dy; }
      moved++; break;
    }
  }
  if (moved) G.timers.push({ t: 5.5, fn: () => banner('🌀 ' + ftTr('THE ZONE SHIFTED'), ftTr('The emission moved some anomaly fields. Your detector knows where.'), 3.5, 'art') });
}

// ===== 3. rescue requests: several stalkers call at once, each with their own clock =====
const FT_NAMES = ['Kostya', 'Lyokha', 'Vasya', 'Tolik', 'Grisha', 'Semyon', 'Zhenya', 'Bori', 'Fanat', 'Tolstyak', 'Shustry', 'Kruglov'];
function ftRescueStart() {
  const L = [], n = randi(2, 3), a0 = rand(TAU);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 20; k++) {
      const a = a0 + (i / n) * TAU + rand(-0.4, 0.4), d = rand(650, 1150), x = clamp(P.x + Math.cos(a) * d, 200, WORLD - 200), y = clamp(P.y + Math.sin(a) * d, 200, WORLD - 200);
      if (!World.free(x, y, 30)) continue;
      const t = rand(55, 110);
      L.push({ x, y, name: pick(FT_NAMES), t, max: t, prog: 0, state: 0 });
      for (let j = 0; j < 3; j++) spawnEnemy(pick(['dog', 'snork', 'flesh', 'boar'].filter((id) => ENEMIES[id])) || 'dog', x + rand(-120, 120), y + rand(-90, 90), { noElite: true });
      break;
    }
  }
  if (!L.length) return;
  G.ft.res = L;
  banner('🆘 ' + ftTr('RESCUE REQUESTS'), ftTr('Stalkers are calling for help. Reach them before their clocks run out: you cannot save everyone.'), 4.5, 'bad');
  Sfx.play('quest');
}
function ftRescueTick(dt) {
  const L = G.ft.res; if (!L) return;
  for (const s of L) {
    if (s.state) continue;
    s.t -= dt;
    if (dist(P.x, P.y, s.x, s.y) < 90) { s.prog += dt; if (s.prog >= 2.5) ftRescued(s); }
    else s.prog = Math.max(0, s.prog - dt);
    if (!s.state && s.t <= 0) { s.state = 2; banner('✖ ' + s.name.toUpperCase(), ftTr('did not make it.'), 2.5, 'bad'); }
  }
  if (L.every((s) => s.state)) G.ft.res = null;
}
function ftRescued(s) {
  s.state = 1; const r = Math.random();
  G.rubles += 70 + Math.round(s.t);
  if (r < 0.35) G.pickups.push({ type: 'art', x: s.x, y: s.y + 20, t: 0 });
  else if (r < 0.7) G.pickups.push({ type: 'med', x: s.x, y: s.y + 20, t: 0 });
  else for (let i = 0; i < 6; i++) dropGem(s.x + rand(-40, 40), s.y + rand(-30, 30), 6 + G.level);
  banner('✚ ' + s.name.toUpperCase() + ' ' + ftTr('RESCUED'), '+' + (70 + Math.round(s.t)) + ' ₽', 2.5, 'good'); Sfx.play('stash');
  if (typeof Quests !== 'undefined' && Quests.prog) try { Quests.prog('rescue'); } catch (e) { /* no such quest */ }
}

// ===== 4. crows steal dropped artifacts and fly off; shoot them down to get the loot back =====
Object.assign(ENEMIES, {
  crow: { name: 'Zone Crow', hp: 22, spd: 175, dmg: 0, r: 9, xp: 3, mass: 0.2, fly: true },
  sniper: { name: 'Sniper', hp: 50, spd: 115, dmg: 22, r: 13, xp: 12, mass: 1 },
});
if (typeof HUMANS !== 'undefined') HUMANS.add('sniper');
ENEMY_DRAW.crow = function (e) {
  const x = e.x, y = e.y - (e.z || 28), f = e.face || 1, w = Math.sin((e.anim || 0) * 3) * 7;
  ctx.fillStyle = col('#15151a');
  ctx.beginPath(); ctx.ellipse(x, y, 9, 5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 14, y - 6 - w); ctx.lineTo(x + 2, y - 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 14, y - 6 + w); ctx.lineTo(x - 2, y - 2); ctx.fill();
  ctx.fillStyle = col('#d8a030'); ctx.beginPath(); ctx.moveTo(x + 9 * f, y - 1); ctx.lineTo(x + 14 * f, y); ctx.lineTo(x + 9 * f, y + 2); ctx.fill();
  if (e.carry) { ctx.fillStyle = '#bfe9ff'; ctx.fillRect(x - 3, y + 5, 6, 6); }
};
ENEMY_DRAW.sniper = function (e) { drawBandit(e); ctx.fillStyle = col('#ff3a2a'); ctx.fillRect(e.x - 2, e.y - (e.z || 0) - 58, 4, 4); };
function ftCrowTick() {
  if (G.enemies.some((e) => e.id === 'crow' && !e.dead)) return;
  for (const p of G.pickups) {
    if (p._ft) continue; p._ft = 1;
    if (p.type !== 'art' || Math.random() > 0.3 || G.t < 60) continue;
    const a = rand(TAU);
    for (let i = 0; i < 2; i++) { const c = spawnEnemy('crow', p.x + Math.cos(a) * 520 + i * 30, p.y + Math.sin(a) * 420, { noElite: true, noTheme: true }); c.want = p; }
    Sfx.play('hint');
    break;
  }
}
{
  const _ai = aiExtra;
  aiExtra = function (e, dt, d, ux, uy, sp, dx, dy) {
    if (e.id === 'crow') {
      e.z = 30 + Math.sin(e.t * 8 + e.seed) * 8;
      if (e.carry) { e.tgt = null; if (d > 950) { e.dead = true; banner('🐦 ' + ftTr('THE CROW GOT AWAY'), ftTr('It took the artifact with it.'), 2.5, 'bad'); } return [-ux * sp, -uy * sp]; }
      const p = e.want;
      if (!p || !G.pickups.includes(p)) { e.tgt = null; return [-ux * sp * 0.8, -uy * sp * 0.8]; } // loot gone: leave
      e.tgt = e.tgt || { x: p.x, y: p.y, hp: 1 };
      if (dist(e.x, e.y, p.x, p.y) < 26) {
        G.pickups.splice(G.pickups.indexOf(p), 1); e.carry = p; e.tgt = null; e.spd *= 1.1;
        for (const o of G.enemies) if (o !== e && o.id === 'crow') o.want = null;
        banner('🐦 ' + ftTr('A CROW STOLE AN ARTIFACT'), ftTr('Shoot it down before it escapes!'), 3, 'bad'); Sfx.play('hint');
      }
      return null;
    }
    if (e.id === 'sniper') return ftSniperAI(e, dt, d, ux, uy, sp);
    return _ai(e, dt, d, ux, uy, sp, dx, dy);
  };
}

// ===== 5. snipers: keep their distance, show a laser before firing, then move =====
function ftSniperAI(e, dt, d, ux, uy, sp) {
  e.ss = e.ss || 0; e.sT = (e.sT ?? rand(2, 4)) - dt;
  if (e.ss === 0) { // position: stay 380-560 away, strafing
    if (e.sT <= 0 && d < 750) { e.ss = 1; e.sT = 1.3; e.sa = Math.atan2(P.y - 20 - (e.y - 22), P.x - e.x); tele(e.x, e.y - 22, e.x + Math.cos(e.sa) * 950, e.y - 22 + Math.sin(e.sa) * 950, 4, 1.3); Sfx.play('beep'); }
    const k = d < 380 ? -1 : d > 560 ? 1 : 0, s = Math.sin(e.t * 0.8 + e.seed) > 0 ? 1 : -1;
    return [ux * sp * k - uy * sp * 0.5 * s, uy * sp * k + ux * sp * 0.5 * s];
  }
  if (e.ss === 1) { // aiming: frozen, then one fast shot along the warned line
    if (e.sT <= 0) { enemyShoot(e, e.sa, 980, e.dmg, 'fire', 5, true); Sfx.play('pistol'); e.ss = 2; e.sT = rand(1.4, 2.2); e.ra = rand(TAU); }
    return [0, 0];
  }
  if (e.sT <= 0) { e.ss = 0; e.sT = rand(3, 5); } // relocate
  return [Math.cos(e.ra) * sp * 1.4, Math.sin(e.ra) * sp * 1.4];
}
function ftSniperTick(dt) {
  G.ft.snT -= dt;
  if (G.ft.snT > 0 || G.t < 150) return;
  G.ft.snT = rand(45, 75);
  const n = G.enemies.filter((e) => e.id === 'sniper' && !e.dead).length, cap = potatoGfx() ? 1 : ultraGfx() ? 2 : 3;
  if (n >= cap) return;
  let x = 0, y = 0, ok = false;
  for (let k = 0; k < 10 && !ok; k++) { const a = rand(TAU); x = P.x + Math.cos(a) * 560; y = P.y + Math.sin(a) * 460; ok = World.free(x, y, 16); }
  if (ok) { spawnEnemy('sniper', x, y, { noElite: true, noTheme: true }); if (!G.ft.snTold) { G.ft.snTold = 1; banner('🎯 ' + ftTr('SNIPER'), ftTr('Watch for the red laser, then step off the line.'), 3, 'bad'); } }
}

// ===== 6. packs: dogs split into chasers and flankers and back off when badly hurt =====
function ftPackTick(dt) {
  for (const e of G.enemies) {
    if (e.dead || (e.id !== 'dog' && e.id !== 'pseudodog')) continue;
    if (e.tgt && e.tgt !== e._ft) continue; // something else (charm, a crow's loot…) is steering it
    const d = dist(e.x, e.y, P.x, P.y);
    if (!e.retreated && e.hp < e.maxhp * 0.3) { e.retreated = true; e.retT = 2.5; }
    const T = e._ft || (e._ft = { x: 0, y: 0, hp: 1 });
    if (e.retT > 0) { e.retT -= dt; const k = 480 / (d || 1); T.x = P.x + (e.x - P.x) * k; T.y = P.y + (e.y - P.y) * k; e.tgt = T; continue; }
    if ((e.seed * 10 | 0) % 3 === 0 && d > 170 && d < 800) { // flanker: come in from the side
      const a = Math.atan2(e.y - P.y, e.x - P.x) + (e.seed % 2 < 1 ? 1.2 : -1.2);
      T.x = P.x + Math.cos(a) * 150; T.y = P.y + Math.sin(a) * 150; e.tgt = T; continue;
    }
    e.tgt = null;
  }
}

// ===== 7. stagger, frozen-shatter and perfect dodges =====
{
  const _he = hurtEnemy;
  hurtEnemy = function (e, dmg, kx, ky, raw, proc) {
    if (!e || e.dead) return _he.apply(this, arguments);
    let m = 1;
    if (!raw && P.pdT > 0) m *= 1.5;                           // perfect dodge: empowered shots
    if (e.stgT > 0) m *= 1.25;                                  // staggered targets take more
    if (e.frozen && e.stun > 0 && dmg * m >= e.maxhp * 0.05) {  // a heavy hit on a frozen target shatters it
      m *= 1.6; e.frozen = 0; e.stun = 0;
      text(e.x, e.y - e.z - 40, ftTr('SHATTER!'), '#bfe9ff', true, true);
      if (!ultraGfx()) burst(e.x, e.y - 20, 12, '190,235,255', 200, { s: 3 });
      Sfx.play('break');
    }
    const hp0 = e.hp, r = _he.call(this, e, dmg * m, kx, ky, raw, proc);
    if ((e.boss || e.mini || e.affix) && !e.dead && !(e.stgT > 0)) {
      e.stg = (e.stg || 0) + Math.max(0, hp0 - e.hp) / (e.maxhp * (e.boss ? 0.12 : 0.22));
      if (e.stg >= 1) { e.stg = 0; e.stgT = 3; e.stun = Math.max(e.stun || 0, e.boss ? 0.9 : 1.6); text(e.x, e.y - e.z - 60, ftTr('STAGGERED!'), '#ffe070', true, true); Sfx.play('break'); }
    }
    return r;
  };
  const _hp = hurtPlayer;
  hurtPlayer = function (d, src, ignoreInv, kind) {
    if (!ignoreInv && G && G.state === 'play' && P.dashT > 0 && !(P.pdCd > 0) && kind !== 'anomaly' && kind !== 'rad') {
      P.pdT = 2; P.pdCd = 1.2; text(P.x, P.y - 70, ftTr('PERFECT DODGE!'), '#c8ff5a', true, true); Sfx.play('quest');
    }
    return _hp.apply(this, arguments);
  };
}

// ===== 8. targeting: nearest, toughest or the biggest crowd =====
{
  const _near = nearest;
  nearest = function (x, y, range, skip) {
    const mode = Save.set.aim || 'near';
    if (mode === 'near' || !G || x !== P.x || y !== P.y) return _near(x, y, range, skip);
    let best = null, bs = -1, n = 0; const R2 = range * range;
    for (const e of G.enemies) {
      if (e.dead || e.hidden || (skip && skip.includes(e)) || e.dmg === 0 && e.id === 'crow' && !e.carry) continue;
      if ((e.id === 'bloodsucker' || e.id === 'cat' || e.id === 'snake' || e.id === 'wraith') && e.alpha < 0.3) continue;
      const d2 = dist2(x, y, e.x, e.y); if (d2 > R2) continue;
      let sc;
      if (mode === 'strong') sc = e.hp * (e.boss ? 4 : e.mini || e.affix ? 2 : 1) - d2 * 1e-4;
      else { if (++n > 40) break; EG.query(e.x, e.y, 90, TMP2); sc = TMP2.length - d2 * 1e-6; }
      if (sc > bs) { bs = sc; best = e; }
    }
    return best || _near(x, y, range, skip);
  };
}
const AIM_MODES = [['near', '🎯 Nearest'], ['strong', '💪 Toughest'], ['crowd', '👥 Biggest crowd']];
function aimLabel() { const m = AIM_MODES.find((x) => x[0] === (Save.set.aim || 'near')); return ftTr('Target') + ': ' + ftTr(m[1]); }

// ===== 9. level-up cards: lock one, banish up to 3 per run, or skip for a reroll =====
{
  const key = (c) => c.kind + ':' + (c.id || '');
  const _roll = rollChoices;
  rollChoices = function () {
    let out = _roll();
    if (G && G.ft && G.ft.ban.size) for (let i = 0; i < out.length; i++) for (let k = 0; k < 12 && G.ft.ban.has(key(out[i])); k++) { const alt = _roll().find((c) => !G.ft.ban.has(key(c)) && !out.some((o) => key(o) === key(c))); if (alt) out[i] = alt; }
    if (G && G.ft && G.ft.lock) { const L = G.ft.lock; out = out.filter((c) => key(c) !== key(L)); out.splice(Math.min(L._i || 0, out.length), 0, L); out = out.slice(0, 3); }
    return out;
  };
  const _rc = renderCards;
  renderCards = function () {
    _rc();
    if (choiceMode !== 'level' || !G || !G.ft) return;
    [...$('cards').children].forEach((el, i) => {
      const c = choices[i]; if (!c || !c.id) return;
      const bar = document.createElement('div'); bar.className = 'cardCtl';
      const lk = document.createElement('button'); lk.textContent = G.ft.lock === c ? '🔒' : '🔓'; lk.title = ftTr('Keep this card through a reroll');
      lk.onclick = (ev) => { ev.stopPropagation(); if (G.ft.lock === c) G.ft.lock = null; else { G.ft.lock = c; c._i = i; } renderCards(); };
      bar.appendChild(lk);
      if (G.ft.banLeft > 0) {
        const bn = document.createElement('button'); bn.textContent = '✖ ' + G.ft.banLeft; bn.title = ftTr('Banish: never offered again this run');
        bn.onclick = (ev) => {
          ev.stopPropagation(); G.ft.banLeft--; G.ft.ban.add(key(c)); if (G.ft.lock === c) G.ft.lock = null;
          const alt = rollChoices().find((x) => !G.ft.ban.has(key(x)) && !choices.some((o) => key(o) === key(x)));
          choices[i] = alt || { kind: FALLBACK[0].kind, rar: RARITY[0] }; renderCards(); Sfx.play('break');
        };
        bar.appendChild(bn);
      }
      el.appendChild(bar);
    });
    let sk = $('skipCardBtn');
    if (!sk) { sk = document.createElement('button'); sk.id = 'skipCardBtn'; sk.className = 'big ghost small'; $('rerollBtn').after(sk); sk.onclick = () => { if (G.state !== 'levelup' || choiceMode !== 'level') return; P.rerolls++; G.ft.lock = null; hide('levelup'); G.state = 'play'; hudBuild(); Sfx.play('stash'); }; }
    sk.textContent = '⏭ ' + ftTr('SKIP (+1 REROLL)'); sk.style.display = choiceMode === 'level' ? 'inline-block' : 'none';
  };
  const _ch = chooseCard;
  chooseCard = function (i) { const r = _ch(i); if (G && G.ft && G.state === 'play') G.ft.lock = null; return r; };
}

// ===== 10. boss bargains: accept a challenge for better loot, or pay to weaken the boss =====
{
  const _snb = spawnNextBoss;
  spawnNextBoss = function () {
    if (!G || G.coop || G.coGuest || G.tutorial || G.state !== 'play' || (!G.endless && (BOSS_SCHEDULE[G.bossIdx] || {}).id === 'final')) return _snb.apply(this, arguments);
    const bribe = Math.round(120 + 60 * Math.max(0, (G.bossIdx || 0) + Math.max(0, G.bossN || 0)));
    G.state = 'bargain';
    let m = $('bargain'); if (!m) { m = document.createElement('div'); m.id = 'bargain'; m.className = 'screen'; document.body.appendChild(m); }
    m.innerHTML = `<div class="panel"><h2>☠ ${ftTr('A BOSS IS COMING')}</h2><p class="dim">${ftTr('A stalker on the radio offers a deal before it arrives.')}</p>
      <div class="bgOpts"><button class="big" data-bg="none">⚔ ${ftTr('Fight it as it is')}</button>
      <button class="big" data-bg="chal">🔥 ${ftTr('Challenge: boss +50% HP & damage')}<small>${ftTr('Reward: +300 ₽ and 2 artifacts')}</small></button>
      <button class="big ${G.rubles >= bribe ? '' : 'cant'}" data-bg="bribe">💰 ${ftTr('Bribe')}: ${bribe} ₽<small>${ftTr('Boss starts with 30% less HP')}</small></button></div></div>`;
    if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(m); } catch (e) { /* keep english */ }
    m.classList.add('show');
    for (const b of m.querySelectorAll('[data-bg]')) b.onclick = () => {
      const k = b.dataset.bg; if (k === 'bribe' && G.rubles < bribe) return;
      m.classList.remove('show'); G.state = 'play';
      const before = new Set(G.bosses); _snb();
      const boss = G.bosses.find((x) => !before.has(x));
      if (boss && k === 'chal') { boss.hp *= 1.5; boss.maxhp *= 1.5; boss.dmg *= 1.3; boss.bargain = 'chal'; }
      if (boss && k === 'bribe') { G.rubles -= bribe; boss.hp *= 0.7; boss.bargain = 'bribe'; }
      Sfx.play(k === 'none' ? 'boss' : 'stash');
    };
  };
  const _ke = killEnemy;
  killEnemy = function (e) {
    const r = _ke.apply(this, arguments);
    if (e && e.bargain === 'chal') { G.rubles += 300; for (let i = 0; i < 2; i++) G.pickups.push({ type: 'art', x: e.x + rand(-40, 40), y: e.y + rand(-20, 30), t: 0 }); banner('🔥 ' + ftTr('CHALLENGE WON'), '+300 ₽ · 2 ' + ftTr('artifacts'), 3, 'good'); }
    if (e && e.carry) { G.pickups.push({ ...e.carry, x: e.x, y: e.y + 10, _ft: 1 }); e.carry = null; text(e.x, e.y - 40, ftTr('Loot recovered!'), '#9fe8a0', true, true); }
    return r;
  };
}

// ===== 11. Saw Launcher: discs that ricochet off walls and hit harder after every bounce =====
WEAPONS.saw = { name: 'Saw Launcher', icon: '🪚', max: 6, tag: null, desc: 'Spinning discs that ricochet off walls and buildings, hitting harder after every bounce.',
  ups: ['', '+Damage', '+1 bounce', 'Fire 2 discs', '+1 bounce', 'Fire 3 discs'], stats: (l) => ({ dmg: 14 + l * 5, cd: 1.35 - l * 0.08, bounces: 3 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0), count: l >= 6 ? 3 : l >= 4 ? 2 : 1 }) };
{
  const _fw2 = fireWeapon2;
  fireWeapon2 = function (w, s, bm) {
    if (w.id !== 'saw') return _fw2.apply(this, arguments);
    const t = nearest(P.x, P.y, 560); if (!t) return false;
    const gx = P.x, gy = P.y - 22, a = Math.atan2(t.y - t.z - 12 - gy, t.x - gx);
    for (let i = 0; i < s.count; i++) {
      shoot(gx, gy, a + (i - (s.count - 1) / 2) * 0.3, 520, s.dmg * bm, { k: 'saw', r: 7, life: 2.4, pierce: 99, knock: 40 });
      const b = G.bullets[G.bullets.length - 1]; b.noWall = true; b.bnc = s.bounces; b.update = ftSawStep;
    }
    Sfx.play('knife'); return true;
  };
}
function ftSawStep(b, dt) {
  const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
  if (!World.solidAt(nx, ny + 22)) return;
  if (b.bnc-- <= 0) { b.dead = true; burst(b.x, b.y + 20, 5, '220,220,230', 120, { z: 20, life: 0.3 }); return; }
  if (World.solidAt(nx, b.y + 22)) b.vx *= -1; else if (World.solidAt(b.x, ny + 22)) b.vy *= -1; else { b.vx *= -1; b.vy *= -1; }
  b.dmg *= 1.25; b.hits.length = 0; b.life = Math.max(b.life, 1.2); Sfx.play('knife');
}
{
  const _db2 = drawBullet2;
  drawBullet2 = function (b) {
    if (b.k !== 'saw') return _db2(b);
    ctx.fillStyle = '#c8ccd4'; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a6e76'; ctx.lineWidth = 2; const a = NOW * 25; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * 8, b.y + Math.sin(a) * 8); ctx.lineTo(b.x - Math.cos(a) * 8, b.y - Math.sin(a) * 8); ctx.stroke();
    return true;
  };
}

// ===== run lifecycle, per-frame tick and drawing =====
{
  const _ng = newGame;
  newGame = function () {
    const r = _ng.apply(this, arguments);
    if (G) { G.ft = { hotT: rand(70, 110), hotOn: null, resT: rand(110, 170), res: null, snT: 30, ban: new Set(), banLeft: 3, lock: null }; ftShuffleDanger(); }
    return r;
  };
  const _up = update;
  update = function (dt) {
    _up(dt);
    if (!G || !G.ft || G.state !== 'play') return;
    if (P.pdT > 0) P.pdT -= dt; if (P.pdCd > 0) P.pdCd -= dt;
    for (const e of G.enemies) if (e.stgT > 0) e.stgT -= dt;
    if (!ftActive()) return;
    ftHotTick(dt); ftPackTick(dt); ftCrowTick(); ftSniperTick(dt);
    const F = G.ft;
    if (!F.res) { F.resT -= dt; if (F.resT <= 0 && G.t > 90 && !G.bosses.length && !(G.em && G.em.phase !== 'after')) { F.resT = rand(170, 240); ftRescueStart(); } }
    else ftRescueTick(dt);
    if (G.em && G.em.phase === 'after' && !G.em._ftMoved) { G.em._ftMoved = true; ftMoveFields(); }
  };
  // world space, after the sorted draw: rescue sites and stagger meters
  const _top = drawW2Top;
  drawW2Top = function (x0, y0, x1, y1) {
    _top(x0, y0, x1, y1);
    if (!G || !G.ft) return;
    ctx.textAlign = 'center';
    for (const s of G.ft.res || []) {
      if (s.state || s.x < x0 - 60 || s.x > x1 + 60 || s.y < y0 - 60 || s.y > y1 + 60) continue;
      ctx.strokeStyle = `rgba(255,90,70,${0.6 + Math.sin(NOW * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y, 90, 56, 0, 0, TAU); ctx.stroke();
      if (s.prog > 0) { ctx.strokeStyle = '#9fe8a0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(s.x, s.y - 70, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (s.prog / 2.5)); ctx.stroke(); }
      ctx.font = 'bold 14px Oswald, sans-serif'; ctx.fillStyle = '#ffcf6a'; ctx.fillText('🆘 ' + s.name + ' · ' + Math.ceil(s.t) + 's', s.x, s.y - 40);
    }
    for (const e of G.enemies) {
      if (e.dead || !(e.stg > 0.02 || e.stgT > 0) || e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1 + 100) continue;
      const w = e.boss ? 80 : e.mini ? 60 : 36, top = e.y - e.z - e.r * 2.6 - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2 - 1, top - 1, w + 2, 5);
      ctx.fillStyle = e.stgT > 0 ? '#fff' : '#ffe070'; ctx.fillRect(e.x - w / 2, top, w * (e.stgT > 0 ? e.stgT / 3 : Math.min(1, e.stg)), 3);
    }
  };
  // screen space: arrows at the screen edge toward rescue sites and the hot zone
  const _scr = drawW2Screen;
  drawW2Screen = function (cx, cy, title) {
    _scr(cx, cy, title);
    if (title || !G || !G.ft || !ftActive()) return;
    const arrow = (wx, wy, c, label) => {
      const sx = (wx - cx) * ZOOM + VW / 2, sy = (wy - cy) * ZOOM + VH / 2;
      if (sx > 20 && sx < VW - 20 && sy > 20 && sy < VH - 20) return;
      const a = Math.atan2(sy - VH / 2, sx - VW / 2), ex = clamp(sx, 36, VW - 36), ey = clamp(sy, 130, VH - 150);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.fill(); ctx.restore();
      ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = c; ctx.fillText(label, ex - Math.cos(a) * 26, ey - Math.sin(a) * 22 + 4);
    };
    for (const s of G.ft.res || []) if (!s.state) arrow(s.x, s.y, '#ff6a4a', '🆘 ' + Math.ceil(s.t) + 's');
    if (G.ft.hotOn) arrow(G.ft.hotOn.x, G.ft.hotOn.y, '#ffb040', '🔥');
  };
}
// hot zones: tougher mutants that are worth double (applied where they spawn)
{
  const _sp = spawnEnemy;
  spawnEnemy = function (id, x, y, o) {
    const e = _sp(id, x, y, o);
    if (e && G && G.ft && !e.boss && World.kind === 'over') { const r = World.region(e.x, e.y); if (r.hot) { e.hp *= 1.25; e.maxhp *= 1.25; e.worth = (e.worth || 1) * 2; } }
    return e;
  };
}
// the area label also says when you are standing in the hot zone
{
  const _za = zoneAnnounce;
  zoneAnnounce = function (reg) {
    _za(reg);
    if (reg && reg.hot) { const s = document.createElement('small'); s.className = 'zDanger'; s.style.color = '#ffb040'; s.textContent = '🔥 ' + ftTr('HOT ZONE') + ' — ' + ftTr('rewards') + ' ×2'; $('zoneName').appendChild(s); }
  };
}

// ===== 12. settings and pause menu: targeting mode =====
addEventListener('DOMContentLoaded', () => {
  const _bs = buildSettings;
  buildSettings = function () {
    _bs();
    const s = Save.set, el = document.createElement('label'); el.className = 'set';
    el.innerHTML = `<span>${ftTr('Auto-targeting')}</span><select data-aim>${AIM_MODES.map(([k, n]) => `<option value="${k}" ${(s.aim || 'near') === k ? 'selected' : ''}>${ftTr(n)}</option>`).join('')}</select>`;
    $('settingsBody').insertBefore(el, $('settingsBody').firstChild.nextSibling);
    el.querySelector('select').onchange = (ev) => { s.aim = ev.target.value; Save.save(); };
  };
  const act = document.querySelector('#pause .actions');
  if (act) {
    const b = document.createElement('button'); b.className = 'big ghost'; b.id = 'aimBtn';
    const lab = () => { b.textContent = aimLabel(); };
    b.onclick = () => { const i = AIM_MODES.findIndex((x) => x[0] === (Save.set.aim || 'near')); Save.set.aim = AIM_MODES[(i + 1) % AIM_MODES.length][0]; Save.save(); lab(); };
    act.insertBefore(b, act.children[1] || null); lab();
    const _tp = togglePause; togglePause = function () { const r = _tp.apply(this, arguments); lab(); return r; };
  }
});

// ===== 13. full backup and restore (every profile, settings, saved runs and crews) =====
function backupAll() {
  const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('zonebonk')) out[k] = localStorage.getItem(k); }
  return JSON.stringify({ game: 'ZONEBONK-BACKUP', build: ZB_BUILD, when: new Date().toISOString(), keys: out });
}
function restoreAll(txt) {
  let d; try { d = JSON.parse(txt); } catch (e) { return ftTr('That is not a ZONEBONK backup.'); }
  if (!d || d.game !== 'ZONEBONK-BACKUP' || !d.keys) return ftTr('That is not a ZONEBONK backup.');
  try { Save.flush && Save.flush(); } catch (e) { /* nothing pending */ }
  try { const old = backupAll(); localStorage.setItem('zonebonk_prev_backup', old.length < 2e6 ? old : ''); } catch (e) { /* no room for the undo copy */ }
  try { for (const [k, v] of Object.entries(d.keys)) if (k.startsWith('zonebonk') && k !== 'zonebonk_prev_backup') localStorage.setItem(k, v); } catch (e) { return ftTr('Could not write the backup (storage full or blocked).'); }
  setTimeout(() => location.reload(), 300); return '';
}
{
  const _oe = openExport;
  openExport = function () {
    _oe();
    const box = document.querySelector('#expModal .hmBox'); if (!box || $('bkRow')) return;
    const row = document.createElement('div'); row.id = 'bkRow'; row.className = 'hmExport';
    row.innerHTML = `<h3>💾 ${ftTr('FULL BACKUP')}</h3><p class="dim">${ftTr('Everything: all profiles, settings, rubles, upgrades, saved runs. Keep the file somewhere safe.')}</p>
      <button class="big small" id="bkSave">💾 ${ftTr('SAVE BACKUP FILE')}</button> <label class="big ghost small" style="display:inline-block;cursor:pointer">📂 ${ftTr('RESTORE FROM FILE')}<input type="file" id="bkFile" accept=".json,application/json" style="display:none"></label>
      <textarea id="bkTxt" placeholder="${ftTr('…or paste a backup here')}" style="width:100%;height:70px;margin-top:8px;font:11px monospace;background:#111;color:#cfc;border:1px solid #444"></textarea>
      <button class="big ghost small" id="bkPaste">♻️ ${ftTr('RESTORE PASTED BACKUP')}</button><div id="bkMsg" class="dim"></div>`;
    box.appendChild(row);
    const msg = (t) => { $('bkMsg').textContent = t; };
    $('bkSave').onclick = () => { const t = backupAll(); try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' })); a.download = 'zonebonk-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); } catch (e) { /* blocked */ } try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) { /* blocked */ } $('bkTxt').value = t; msg(ftTr('Saved and copied.')); };
    const go = (t) => { if (!confirm(ftTr('Replace ALL current progress with this backup?'))) return; const e = restoreAll(t); msg(e || ftTr('Restored — reloading…')); };
    $('bkFile').onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => go(String(rd.result)); rd.readAsText(f); };
    $('bkPaste').onclick = () => { const t = $('bkTxt').value.trim(); if (t) go(t); };
    if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(row); } catch (e) { /* keep english */ }
  };
}
