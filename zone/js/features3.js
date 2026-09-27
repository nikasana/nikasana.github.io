'use strict';
// ---------- variety pack 3: sleeping mutants, wounded dogs bringing help, front-armored brutes, emission stampedes,
// shriekers, wardens, surrendering bandits, bounty hunters, a recurring rival, treasure notes, courier contracts,
// the contract board, evac windows, a companion dog, new mutators, buff timers, "what is hurting you", perf panel ----------
const tr3 = (s) => (typeof I18n !== 'undefined' && I18n.cur !== 'en' ? I18n.tc(s) : s);
const f3On = () => G && !G.title && !G.tutorial && !G.coGuest && World.kind === 'over';
const F3_ANCHOR = (x, y) => ({ x, y, hp: 1 });
function f3FreeSpot(cx, cy, dmin, dmax) {
  for (let k = 0; k < 30; k++) { const a = rand(TAU), d = rand(dmin, dmax), x = clamp(cx + Math.cos(a) * d, 250, WORLD - 250), y = clamp(cy + Math.sin(a) * d, 250, WORLD - 250); if (World.free(x, y, 30)) return [x, y]; }
  return null;
}

// ===== new mutants =====
Object.assign(ENEMIES, { shrieker: { name: 'Shrieker', hp: 70, spd: 80, dmg: 6, r: 13, xp: 10, mass: 1 } });
ENEMY_DRAW.shrieker = function (e) { (ENEMY_DRAW.snork || ENEMY_DRAW.zombie)(e); ctx.strokeStyle = col('rgba(200,120,255,0.9)'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y - (e.z || 0) - 30, 10, 0, TAU); ctx.stroke(); };
{
  const _ai = aiExtra;
  aiExtra = function (e, dt, d, ux, uy, sp, dx, dy) {
    if (e.id === 'shrieker') {
      e.scT = (e.scT ?? 3) - dt;
      if (e.scT <= 0 && d < 520) { e.scT = rand(6, 8); G.jamT = 6; G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 260, life: 0.6, max: 0.6, c: '200,120,255' }); Sfx.play('psi'); text(e.x, e.y - 60, tr3('SHRIEK!'), '#d8a0ff', true, true); }
      if (d < 280) return [-ux * sp, -uy * sp];
      return null;
    }
    return _ai(e, dt, d, ux, uy, sp, dx, dy);
  };
}
{
  const _dd = drawDetector;
  drawDetector = function () {
    if (G && G.jamT > 0) { const c = $('detector'), g = c.getContext('2d'); g.fillStyle = '#0a0f0a'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(160,255,160,0.5)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); $('detDist').textContent = '???'; return; }
    return _dd.apply(this, arguments);
  };
}

// ===== spawn-time traits: sleepers, front armor, wardens, surrender candidates =====
{
  const _sp = spawnEnemy;
  spawnEnemy = function (id, x, y, o) {
    const e = _sp(id, x, y, o);
    if (!e || !G || G.title || G.coGuest || e.boss) return e;
    if (World.kind === 'over' && G.t > 25 && !e.mini && !(o && o.noSleep) && ['dog', 'flesh', 'boar', 'snork', 'zombie', 'pseudodog', 'rat'].includes(id) && Math.random() < 0.12) e.sleep = 1;
    if ((id === 'boar' || id === 'pseudogiant' || id === 'chimera' || id === 'behemoth') || (!e.mini && e.r >= 18 && Math.random() < 0.25)) e.armor = 1;
    if (id === 'soldier' && Math.random() < 0.25) e.warden = 1;
    return e;
  };
  const _he = hurtEnemy;
  hurtEnemy = function (e, dmg, kx, ky, raw, proc) {
    if (!e || e.dead) return _he.apply(this, arguments);
    let m = 1;
    if (e.sleep) { e.sleep = 0; m *= 1.5; text(e.x, e.y - e.z - 40, tr3('SNEAK ATTACK!'), '#c8ff5a', false, true); }
    if (e.armor && (kx || ky)) { // hits from the front mostly glance off; flank them
      const fx = P.x - e.x, fy = P.y - e.y, fl = Math.hypot(fx, fy) || 1, kl = Math.hypot(kx, ky) || 1;
      if ((kx / kl) * (fx / fl) + (ky / kl) * (fy / fl) < -0.5) { m *= 0.4; if (Math.random() < 0.08) text(e.x, e.y - e.z - 40, tr3('ARMOR'), '#b8b8b8', false, true); }
    }
    if (e.wardT > 0) m *= 0.5;
    if (e.id === 'bandit' && !e.loot && !e.surr && !e.surrTried && e.hp - dmg * m < e.maxhp * 0.25 && e.hp - dmg * m > 0) { e.surrTried = 1; if (Math.random() < 0.5) { e.surr = 3; e.dmg0 = e.dmg; e.dmg = 0; text(e.x, e.y - e.z - 60, '🏳️ ' + tr3("DON'T SHOOT!"), '#ffffff', true, true); } }
    else if (e.surr) { e.surr = 0; e.dmg = e.dmg0 || e.dmg; }
    return _he.call(this, e, dmg * m, kx, ky, raw, proc);
  };
}

// ===== per-frame logic =====
const RIVAL_NAMES = ['Kostyl', 'Shram', 'Voron', 'Bes', 'Zhelezny', 'Slepoy', 'Klyk'];
function f3Tick(dt) {
  const F = G.f3;
  // sleepers stay put until you come close; surrendering bandits stand still
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.sleep) { const dd = dist2(e.x, e.y, P.x, P.y); if (dd < 230 * 230 || dd > 1300 * 1300 || e.hp < e.maxhp) { e.sleep = 0; e.tgt = null; text(e.x, e.y - e.z - 40, '!', '#ffcf6a', true, true); } else e.tgt = e._sl || (e._sl = F3_ANCHOR(e.x, e.y)); }
    else if (e._sl && e.tgt === e._sl) e.tgt = null;
    if (e.surr > 0) { e.tgt = e._sl || (e._sl = F3_ANCHOR(e.x, e.y)); e._sl.x = e.x; e._sl.y = e.y; e.surr -= dt; if (e.surr <= 0) { e.dead = true; G.rubles += 30; banner('🏳️ ' + tr3('BANDIT SURRENDERED'), '+30 ₽ ' + tr3('ransom'), 2.5, 'good'); } }
    if (e.warden) { e.wT = (e.wT || 0) - dt; if (e.wT <= 0) { e.wT = 1; EG.query(e.x, e.y, 150, TMP2); for (const o of TMP2) if (o !== e && !o.dead) o.wardT = 1.3; } }
    if (e.wardT > 0) e.wardT -= dt;
    // wounded dogs that fled come back with a friend
    if (e.retreated && !e.help && !(e.retT > 0) && (e.id === 'dog' || e.id === 'pseudodog')) { e.help = 1; const f = spawnEnemy(e.id, e.x + rand(-30, 30), e.y + rand(-30, 30), { noElite: true, noSleep: true, noTheme: true }); f.help = 1; }
  }
  if (G.jamT > 0) G.jamT -= dt;
  // stampede fleeing the emission
  if (G.em && G.em.phase === 'warn' && !G.em._st && G.em.t < 22) {
    G.em._st = 1; const side = Math.random() < 0.5 ? -1 : 1, id = ENEMIES.boar ? 'boar' : 'dog';
    for (let i = 0; i < (potatoGfx() ? 5 : 8); i++) { const e = spawnEnemy(id, P.x + side * 700 + rand(-60, 60), P.y + rand(-260, 260), { noElite: true, noSleep: true, noTheme: true }); e.stampede = -side; e.tgt = e._sw = F3_ANCHOR(e.x, e.y); e.spd *= 1.6; }
    banner('🐗 ' + tr3('STAMPEDE!'), tr3('Mutants are fleeing the coming emission. Get out of their way.'), 3, 'bad');
  }
  // stampeders chase a point that stays just ahead of them, and leave once they are well past you
  for (const e of G.enemies) if (e.stampede && !e.dead) { e._sw.x = e.x + e.stampede * 300; e._sw.y = e.y; e.tgt = e._sw; if (e.stampede * (e.x - P.x) > 900) e.dead = true; }
  if (!f3On()) return;
  // shriekers
  F.shT -= dt;
  if (F.shT <= 0 && G.t > 240) { F.shT = rand(90, 140); if (!G.enemies.some((e) => e.id === 'shrieker' && !e.dead)) { const p = f3FreeSpot(P.x, P.y, 480, 600); if (p) { spawnEnemy('shrieker', p[0], p[1], { noElite: true, noSleep: true, noTheme: true }); if (!F.shTold) { F.shTold = 1; banner('📵 ' + tr3('SHRIEKER'), tr3('Its scream jams your detector. Kill it to get the signal back.'), 3, 'bad'); } } } }
  // bounty hunters after every 4 elites
  if (G.elites >= F.bounty + 4) {
    F.bounty = G.elites; const p = f3FreeSpot(P.x, P.y, 520, 650);
    if (p) { const id = 'bandit'; for (let i = 0; i < 3; i++) { const e = spawnEnemy(id, p[0] + rand(-40, 40), p[1] + rand(-40, 40), { noElite: true, noSleep: true, noTheme: true }); e.hp *= 1.5; e.maxhp *= 1.5; e.worth = (e.worth || 1) * 2.5; e.name = tr3('Bounty Hunter'); }
      banner('💀 ' + tr3('BOUNTY ON YOUR HEAD'), tr3('Hunters were sent after the elite killer. They pay well if you beat them.'), 3.5, 'bad'); }
  }
  // the recurring rival
  if (!F.rival && G.t > 360 && !G.bosses.length) {
    F.rival = 1; const S = Save.data, R = S.rival || (S.rival = { name: pick(RIVAL_NAMES), n: 0, won: 0 }), p = f3FreeSpot(P.x, P.y, 450, 600);
    if (p) {
      const e = spawnEnemy('bandit', p[0], p[1], { mini: true, noSleep: true, noTheme: true, name: tr3('Rival') + ' ' + R.name });
      e.hp *= 1 + 0.3 * R.n; e.maxhp = e.hp; e.dmg *= 1 + 0.12 * R.n; e.rival = 1; e.name = tr3('Rival') + ' ' + R.name;
      const lines = R.n ? ['You again? I still have the scar.', 'Back for more, stalker?', 'I have been waiting for you.'] : ['Nice loot. It is mine now.', 'The Zone is not big enough for both of us.'];
      banner('😈 ' + e.name.toUpperCase() + (R.n ? ' · ×' + (R.n + 1) : ''), '"' + tr3(pick(lines)) + '"', 3.5, 'bad');
    }
  }
  // treasure notes
  const T = F.notes;
  if (T && !T.done) {
    const n = T.list[T.i];
    if (n && dist2(P.x, P.y, n.x, n.y) < 55 * 55) {
      T.i++; Sfx.play('quest');
      if (T.i < T.list.length) banner('📜 ' + tr3('NOTE') + ' ' + T.i + '/3', tr3('It points to the next hiding place.'), 2.5, 'art');
      else { T.done = true; G.rubles += 200; G.pickups.push({ type: 'art', x: n.x, y: n.y + 20, t: 0 }); G.pickups.push({ type: 'med', x: n.x + 30, y: n.y + 20, t: 0 }); banner('💰 ' + tr3('HIDDEN STASH FOUND'), '+200 ₽ · ' + tr3('artifact'), 3, 'good'); }
    }
  } else if (!T && G.t > 70) {
    const L = []; let c = [P.x, P.y];
    for (let i = 0; i < 3; i++) { const p = f3FreeSpot(c[0], c[1], 700, 1100); if (!p) break; L.push({ x: p[0], y: p[1] }); c = p; }
    F.notes = L.length === 3 ? { list: L, i: 0 } : { done: true };
    if (L.length === 3) banner('📜 ' + tr3('A STALKER\'S NOTE'), tr3('Three notes lead to a hidden stash. Follow the scroll marker.'), 3.5, 'art');
  }
  // courier contracts
  const C = F.courier;
  if (!C) { F.cT -= dt; if (F.cT <= 0 && G.t > 150) { F.cT = rand(200, 280); const a = f3FreeSpot(P.x, P.y, 300, 480), b = a && f3FreeSpot(a[0], a[1], 1100, 1500); if (a && b) { F.courier = { ax: a[0], ay: a[1], bx: b[0], by: b[1], got: 0, t: 130 }; banner('📦 ' + tr3('COURIER CONTRACT'), tr3('Pick up the package and deliver it before the time runs out.'), 3.5, 'art'); } } }
  else {
    C.t -= dt;
    if (!C.got && dist2(P.x, P.y, C.ax, C.ay) < 55 * 55) { C.got = 1; P.spdMul *= 0.9; Sfx.play('stash'); text(P.x, P.y - 70, '📦', '#ffcf6a', true, true); }
    if (C.got && dist2(P.x, P.y, C.bx, C.by) < 60 * 60) { P.spdMul /= 0.9; G.rubles += 150 + Math.round(C.t); for (let i = 0; i < 5; i++) dropGem(C.bx + rand(-30, 30), C.by + rand(-30, 30), 8 + G.level); banner('📦 ' + tr3('DELIVERED'), '+' + (150 + Math.round(C.t)) + ' ₽', 2.5, 'good'); Sfx.play('quest'); F.courier = null; }
    else if (C.t <= 0) { if (C.got) P.spdMul /= 0.9; banner('📦 ' + tr3('CONTRACT FAILED'), tr3('The package was not delivered in time.'), 2.5, 'bad'); F.courier = null; }
  }
  // contract board: two optional goals every few minutes, pick one (or ignore it)
  f3ContractTick(dt);
  // evac windows at 8:00 and 12:00
  if (!G.endless && !F.evac && (Math.abs(G.t - 480) < 0.5 || Math.abs(G.t - 720) < 0.5) && !G.bosses.length) {
    const p = f3FreeSpot(P.x, P.y, 450, 750);
    if (p) { F.evac = { x: p[0], y: p[1], t: 60, h: 0 }; banner('🚁 ' + tr3('EVAC WINDOW'), tr3('A helicopter can pull you out now with everything you found (+25% rubles). Stand in the zone for 5 seconds.'), 4, 'good'); Sfx.play('quest'); }
  }
  const E = F.evac;
  if (E) {
    E.t -= dt;
    if (dist2(P.x, P.y, E.x, E.y) < 80 * 80) { E.h += dt; if (E.h >= 5) { G.rubles = Math.round(G.rubles * 1.25); F.evac = null; endRun('escape'); try { $('overTitle').textContent = '🚁 ' + tr3('EVACUATED'); } catch (e) { /* screen not ready */ } return; } }
    else E.h = Math.max(0, E.h - dt * 2);
    if (E.t <= 0) { F.evac = null; banner('🚁 ' + tr3('THE HELICOPTER LEFT'), '', 2, ''); }
  }
  // nomad mutator: standing still hurts
  if (G.nomad) { if (P.moving) F.still = 0; else { F.still += dt; if (F.still > 2.5 && Math.random() < dt * 4) hurtPlayer(3, 'the Zone (nomad)', true, 'rad'); } }
}

// ===== contract board =====
const CONTRACTS = [
  { id: 'kills', icon: '☠', name: 'Kill 60 mutants in 90 s', t: 90, start: () => G.kills, done: (c) => G.kills - c.s >= 60, rw: 120 },
  { id: 'clean', icon: '🛡️', name: 'Take no damage for 45 s', t: 45, start: () => P.hp, done: (c) => c.t <= 0.05 && !c.hurt, fail: (c) => c.hurt, rw: 140 },
  { id: 'elite', icon: '👹', name: 'Kill an elite in 120 s', t: 120, start: () => G.elites, done: (c) => G.elites > c.s, rw: 110 },
  { id: 'danger', icon: '☢', name: 'Spend 30 s in a Deadly or Lethal area', t: 120, start: () => 0, done: (c) => c.acc >= 30, tick: (c, dt) => { if ((World.region(P.x, P.y).danger || 3) >= 4) c.acc = (c.acc || 0) + dt; }, rw: 160 },
  { id: 'gems', icon: '💎', name: 'Reach the next level in 60 s', t: 60, start: () => G.level, done: (c) => G.level > c.s, rw: 90 },
];
function f3ContractTick(dt) {
  const F = G.f3;
  if (F.contract) {
    const c = F.contract, D = CONTRACTS.find((x) => x.id === c.id);
    c.t -= dt; if (D.tick) D.tick(c, dt);
    if (D.done(c)) { G.rubles += D.rw; if (Math.random() < 0.3) G.pickups.push({ type: 'art', x: P.x + 40, y: P.y, t: 0 }); banner('✅ ' + tr3('CONTRACT DONE'), '+' + D.rw + ' ₽', 2.5, 'good'); Sfx.play('quest'); F.contract = null; }
    else if (c.t <= 0 || (D.fail && D.fail(c))) { banner('✖ ' + tr3('CONTRACT FAILED'), tr3(D.name), 2, 'bad'); F.contract = null; }
    f3ContractUI(); return;
  }
  F.boardT -= dt;
  if (F.boardT <= 0 && !F.offer && G.t > 150) { F.boardT = rand(210, 280); const o = CONTRACTS.slice().sort(() => Math.random() - 0.5).slice(0, 2); F.offer = { list: o, t: 14 }; }
  if (F.offer) { F.offer.t -= dt; if (F.offer.t <= 0) F.offer = null; }
  f3ContractUI();
}
function f3ContractUI() {
  const F = G.f3; let el = $('contractBox');
  if (!el) { el = document.createElement('div'); el.id = 'contractBox'; $('hud').appendChild(el); }
  const key = F.contract ? 'c' + F.contract.id + Math.ceil(F.contract.t) + (F.contract.acc | 0) : F.offer ? 'o' + Math.ceil(F.offer.t) : '';
  if (el._k === key) return; el._k = key;
  if (!F.contract && !F.offer) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (F.contract) { const D = CONTRACTS.find((x) => x.id === F.contract.id); el.innerHTML = `<b>${D.icon} ${tr3(D.name)}</b><small>${Math.ceil(F.contract.t)}s · +${D.rw} ₽</small>`; return; }
  el.innerHTML = `<small>📋 ${tr3('Contract board')} · ${Math.ceil(F.offer.t)}s</small>` + F.offer.list.map((D, i) => `<button data-ct="${i}">${D.icon} ${tr3(D.name)} · +${D.rw} ₽</button>`).join('');
  for (const b of el.querySelectorAll('[data-ct]')) b.onpointerdown = (ev) => { ev.stopPropagation(); const D = F.offer.list[+b.dataset.ct]; F.contract = { id: D.id, t: D.t, s: D.start(), acc: 0 }; F.offer = null; Sfx.play('stash'); f3ContractUI(); };
}
{
  const _hp = hurtPlayer;
  hurtPlayer = function (d, src, ignoreInv, kind) { const h0 = P.hp, r = _hp.apply(this, arguments); if (G && G.f3 && G.f3.contract && P.hp < h0) G.f3.contract.hurt = 1; return r; };
}

// ===== rival memory =====
{
  const _ke = killEnemy;
  killEnemy = function (e) {
    const r = _ke.apply(this, arguments);
    if (e && e.rival) { const R = Save.data.rival; R.n++; Save.save(); G.rubles += 100 * R.n; G.pickups.push({ type: 'art', x: e.x, y: e.y + 20, t: 0 }); banner('😈 ' + e.name.toUpperCase() + ' ' + tr3('DEFEATED'), '+' + 100 * R.n + ' ₽ · ' + tr3('they will remember this'), 3, 'good'); }
    return r;
  };
  const _er = endRun;
  endRun = function (kind, src) { if (kind === 'dead' && G && G.enemies && G.enemies.some((e) => e.rival && !e.dead) && Save.data.rival && String(src || '').includes(tr3('Rival'))) Save.data.rival.won = (Save.data.rival.won || 0) + 1; return _er.apply(this, arguments); };
}

// ===== companion dog =====
function f3PetTick(dt) {
  if (!Save.set.pet || G.coGuest) { G.pet = null; return; }
  const D = G.pet || (G.pet = { x: P.x - 40, y: P.y + 10, z: 0, anim: 0, face: 1, cd: 0, bark: 0, id: 'dog', d: ENEMIES.dog, r: 12, sc: 1, seed: 1 });
  D.cd -= dt; D.bark -= dt;
  let tx = P.x - 45 * (P.face || 1), ty = P.y + 12, tgt = null;
  EG.query(P.x, P.y, 240, TMP2); let bd = 1e9; for (const e of TMP2) { if (e.dead || e.boss) continue; const q = dist2(D.x, D.y, e.x, e.y); if (q < bd) { bd = q; tgt = e; } }
  if (tgt) { tx = tgt.x; ty = tgt.y; if (bd < 32 * 32 && D.cd <= 0) { D.cd = 0.7; hurtEnemy(tgt, 8 + G.level * 1.5, (tgt.x - D.x) * 2, (tgt.y - D.y) * 2); } }
  const dx = tx - D.x, dy = ty - D.y, l = Math.hypot(dx, dy);
  if (l > 20) { const sp = Math.min(l * 4, tgt ? 320 : 260) * dt; D.x += (dx / l) * sp; D.y += (dy / l) * sp; D.anim += dt * 12; D.face = dx > 0 ? 1 : -1; }
  if (l > 900) { D.x = P.x - 40; D.y = P.y; }
  if (D.bark <= 0) { const el = G.enemies.find((e) => !e.dead && (e.affix || e.mini) && dist2(e.x, e.y, P.x, P.y) < 520 * 520); if (el) { D.bark = 8; text(D.x, D.y - 40, tr3('WOOF!'), '#ffcf6a', false, true); Sfx.play('beep'); } }
}
function f3Draw() {
  const F = G.f3; if (!F) return;
  if (G.pet) { if (typeof drawEnemyScaled === 'function') drawEnemyScaled(G.pet, 1, 1); else ENEMY_DRAW.dog(G.pet); ctx.fillStyle = '#4af'; ctx.fillRect(G.pet.x - 5, G.pet.y - 24, 10, 3); }
  ctx.textAlign = 'center';
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.sleep && Math.abs(e.x - P.x) < 700 && Math.abs(e.y - P.y) < 900) { ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#cfe8ff'; ctx.fillText('z z', e.x + 10, e.y - e.z - 34 - Math.sin(NOW * 2) * 3); }
    if (e.warden && Math.abs(e.x - P.x) < 700) { ctx.strokeStyle = 'rgba(120,200,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y, 150, 90, 0, 0, TAU); ctx.stroke(); }
    if (e.surr > 0) { ctx.font = '18px sans-serif'; ctx.fillText('🏳️', e.x, e.y - e.z - 46); }
  }
  const mk = (x, y, icon, c) => { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 55, 34, 0, 0, TAU); ctx.stroke(); ctx.font = '20px sans-serif'; ctx.fillText(icon, x, y - 30); };
  const T = F.notes; if (T && !T.done && T.list[T.i]) mk(T.list[T.i].x, T.list[T.i].y, '📜', 'rgba(255,220,140,0.8)');
  const C = F.courier; if (C) { if (!C.got) mk(C.ax, C.ay, '📦', 'rgba(255,200,90,0.8)'); else { mk(C.bx, C.by, '🏁', 'rgba(160,255,160,0.8)'); ctx.font = '16px sans-serif'; ctx.fillText('📦', P.x, P.y - 64); } }
  const E = F.evac; if (E) { mk(E.x, E.y, '🚁', `rgba(160,255,160,${0.6 + Math.sin(NOW * 6) * 0.3})`); if (E.h > 0) { ctx.strokeStyle = '#9fe8a0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(E.x, E.y - 70, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (E.h / 5)); ctx.stroke(); } }
}
function f3Arrows(cx, cy) {
  const F = G.f3; if (!F) return;
  const arrow = (wx, wy, c, label) => {
    const sx = (wx - cx) * ZOOM + VW / 2, sy = (wy - cy) * ZOOM + VH / 2; if (sx > 20 && sx < VW - 20 && sy > 20 && sy < VH - 20) return;
    const a = Math.atan2(sy - VH / 2, sx - VW / 2), ex = clamp(sx, 36, VW - 36), ey = clamp(sy, 130, VH - 150);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.fill(); ctx.restore();
    ctx.font = 'bold 12px Oswald, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = c; ctx.fillText(label, ex - Math.cos(a) * 26, ey - Math.sin(a) * 22 + 4);
  };
  const T = F.notes; if (T && !T.done && T.list[T.i]) arrow(T.list[T.i].x, T.list[T.i].y, '#ffdc8c', '📜');
  const C = F.courier; if (C) { const [x, y] = C.got ? [C.bx, C.by] : [C.ax, C.ay]; arrow(x, y, '#ffc85a', '📦 ' + Math.ceil(C.t) + 's'); }
  const E = F.evac; if (E) arrow(E.x, E.y, '#9fe8a0', '🚁 ' + Math.ceil(E.t) + 's');
}

// ===== buff timers under the health bar =====
function f3Buffs() {
  let el = $('buffRow'); if (!el) { el = document.createElement('div'); el.id = 'buffRow'; const hr = $('hpRow'); if (hr) hr.after(el); else return; }
  const L = [];
  const add = (v, icon) => { if (v > 0) L.push(icon + Math.ceil(v)); };
  add(P.vodkaT, '🍾'); add(P.buffT, '🥤'); add(P.antiradT, '💊'); add(P.shieldT, '🛡'); add(P.pdT, '✨'); add(P.adrenT, '💉');
  if (G.holdFire) L.push('🤫'); if (G.jamT > 0) L.push('📵' + Math.ceil(G.jamT));
  const s = L.join(' '); if (el._s !== s) { el._s = s; el.textContent = s; }
}

// ===== pause menu: what is weakening you right now =====
function f3Weak() {
  const W = [], reg = World.kind === 'over' ? World.region(P.x, P.y) : null;
  if (P.dose > 60) W.push('☢ ' + tr3('Radiation above 60%: healing is halved'));
  if (P.hp < P.maxhp * 0.3) W.push('❤ ' + tr3('Low health'));
  if (P.psiSlowT > 0) W.push('🌀 ' + tr3('Psi: you are slowed'));
  if (reg && (reg.danger || 3) >= 4) W.push('☢ ' + tr3('Deadly area: mutants are stronger here'));
  if (reg && reg.hot) W.push('🔥 ' + tr3('Hot zone: tougher mutants'));
  if (Env.isNight && Env.isNight()) W.push('🌙 ' + tr3('Night: more mutants roam'));
  if (G.jamT > 0) W.push('📵 ' + tr3('Detector jammed by a shrieker'));
  if (G.holdFire) W.push('🤫 ' + tr3('Hold fire is on (H)'));
  if (typeof paceNow === 'function' && paceNow() > 1.3) W.push('📈 ' + tr3('The Zone has grown stronger') + ' (×' + paceNow().toFixed(1) + ')');
  return W;
}
{
  const _tp = togglePause;
  togglePause = function () {
    const r = _tp.apply(this, arguments);
    if (G && G.state === 'pause') { let el = $('weakBox'); if (!el) { el = document.createElement('div'); el.id = 'weakBox'; const b = $('build'); if (b) b.after(el); } if (el) { const W = f3Weak(); el.innerHTML = W.length ? `<b>${tr3('What is weakening you')}</b>` + W.map((w) => `<div>${w}</div>`).join('') : ''; } }
    return r;
  };
}

// ===== new mutators =====
MUTATORS.push(
  { id: 'onehp', name: 'One Heartbeat', icon: '💔', desc: 'One hit kills you, but rubles ×2', rub: 1, apply(P) { P.maxhp = 1; P.hp = 1; P.regen = 0; } },
  { id: 'nomad', name: 'Nomad', icon: '🏃', desc: 'Standing still for long hurts', rub: 0.3, apply() { G.nomad = true; } },
);

// ===== performance panel (Show FPS): game logic, drawing and HUD separately =====
const PERF3 = { u: 0, r: 0, h: 0 };
{
  const time = (name, key) => { const f = window[name]; window[name] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { PERF3[key] = PERF3[key] * 0.9 + (performance.now() - t) * 0.1; } }; };
  time('update', 'u'); time('render', 'r'); time('hud', 'h');
  const _h = hud;
  hud = function (dt) { const r = _h.apply(this, arguments); if (Save.set.fps && G && !G.title) { const el = $('fps'); if (el && (el._n = (el._n || 0) + 1) % 10 === 0) el.textContent = el.textContent.split(' ·')[0] + ' · ' + tr3('logic') + ' ' + PERF3.u.toFixed(1) + ' · ' + tr3('draw') + ' ' + PERF3.r.toFixed(1) + ' · HUD ' + PERF3.h.toFixed(1) + 'ms'; } return r; };
}

// ===== lifecycle and hooks =====
{
  const _ng = newGame;
  newGame = function () { const r = _ng.apply(this, arguments); if (G) { G.f3 = { shT: rand(60, 100), bounty: 0, rival: 0, notes: null, courier: null, cT: rand(150, 220), boardT: rand(120, 170), offer: null, contract: null, evac: null, still: 0 }; G.pet = null; } return r; };
  const _up = update;
  update = function (dt) { _up(dt); if (G && G.f3 && !G.title && G.state === 'play') { f3Tick(dt); f3PetTick(dt); if ((G.f3.bT = (G.f3.bT || 0) + 1) % 10 === 0) f3Buffs(); } };
  const _top = drawW2Top;
  drawW2Top = function (x0, y0, x1, y1) { _top(x0, y0, x1, y1); if (G && G.f3 && !G.title) f3Draw(); };
  const _scr = drawW2Screen;
  drawW2Screen = function (cx, cy, title) { _scr(cx, cy, title); if (!title && G && G.f3) f3Arrows(cx, cy); };
}
addEventListener('DOMContentLoaded', () => {
  const _bs = buildSettings;
  buildSettings = function () {
    _bs();
    const s = Save.set, el = document.createElement('label'); el.className = 'set';
    el.innerHTML = `<span>${tr3('🐕 Companion dog')}</span><input type="checkbox" ${s.pet ? 'checked' : ''}>`;
    el.querySelector('input').onchange = (e) => { s.pet = e.target.checked; Save.save(); };
    $('settingsBody').insertBefore(el, $('settingsBody').children[3] || null);
  };
});

// ===== what's new =====
const WHATS_NEW = [
  ['112–113', 'Hot zones, moving anomalies, rescues, crows, snipers, packs, stagger, shatter, perfect dodge, card lock/banish/skip, boss bargains, new weapons, full backups.'],
  ['113', 'Dash styles, focus fire, interrupts and executions, hold fire, auto-medkit, game speed, sleeping mutants, armored brutes, stampedes, shriekers, wardens, surrendering bandits, bounty hunters, a recurring rival, treasure notes, courier contracts, contract board, evac windows, a companion dog.'],
  ['110–111', 'Every map has areas from Calm to Lethal, shown next to your health bar.'],
  ['107–109', 'Potato graphics for the weakest phones; announcements no longer cover the fight.'],
  ['97–103', 'Much faster phone graphics; one Lowest setting chosen automatically on phones.'],
];
addEventListener('DOMContentLoaded', () => {
  const ex = $('exportBtn'); if (!ex) return;
  const b = document.createElement('button'); b.className = 'big ghost'; b.id = 'newsBtn'; b.style.cssText = 'font-size:14px;padding:8px 18px'; b.textContent = '🆕 ' + "WHAT'S NEW";
  ex.after(b);
  b.onclick = () => {
    let m = $('newsModal'); if (!m) { m = document.createElement('div'); m.id = 'newsModal'; m.className = 'modalX'; document.body.appendChild(m); }
    m.innerHTML = `<div class="hmBox"><div class="hdr"><button class="back" id="newsClose">← BACK</button><h2>🆕 ${tr3("WHAT'S NEW")}</h2><span></span></div>` + WHATS_NEW.map(([v, t]) => `<div class="newsRow"><b>${tr3('Build')} ${v}</b><p>${tr3(t)}</p></div>`).join('') + '</div>';
    $('newsClose').onclick = () => m.classList.remove('show'); m.classList.add('show');
    if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom(m); } catch (e) { /* keep english */ }
  };
});
