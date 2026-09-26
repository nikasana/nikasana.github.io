'use strict';
// ---------- Crew HQ: maps, crew upgrades and stats for a co-op crew ----------
// Crew points come from crew levels and wins, so every teammate's copy agrees on how many there are.
// Upgrades merge by their highest level, so buying on any device reaches everyone the next time you meet.
const CREW_UPS = [
  { id: 'hp', icon: '❤️', name: 'Tough Crew', desc: '+10 max HP for everyone per level.', max: 5, apply(P, l) { P.maxhp += 10 * l; P.hp += 10 * l; } },
  { id: 'dmg', icon: '🎯', name: 'Drilled', desc: '+5% damage for everyone per level.', max: 5, apply(P, l) { P.dmgMul += 0.05 * l; } },
  { id: 'xp', icon: '📚', name: 'Study Group', desc: '+8% experience per level.', max: 5, apply(P, l) { P.xpMul += 0.08 * l; } },
  { id: 'rub', icon: '💰', name: 'Shared Stash', desc: '+10% rubles from crew runs per level.', max: 5, apply(P, l) { G.rubBonus = (G.rubBonus || 1) + 0.1 * l; } },
  { id: 'regen', icon: '🩹', name: 'Field Kit', desc: '+0.3 HP regeneration per second per level.', max: 3, apply(P, l) { P.regen += 0.3 * l; } },
  { id: 'revive', icon: '🤝', name: 'Brothers in Arms', desc: 'Teammates revive you 30% faster per level.', max: 3, apply() { /* read in Coop.update */ } },
  { id: 'start', icon: '🎁', name: 'Head Start', desc: 'Everyone begins crew runs with one extra upgrade per level.', max: 2, apply(P, l) { G.pendingLv += l; } },
];
const CrewHQ = {
  points(c) { return 1 + (c.level - 1) + (c.wins || 0) * 2; },
  cost(lv) { return lv + 1; }, // next level costs 1, 2, 3…
  spent(c) { let s = 0; for (const u of CREW_UPS) for (let l = 0; l < ((c.ups || {})[u.id] || 0); l++) s += this.cost(l); return s; },
  free(c) { return Math.max(0, this.points(c) - this.spent(c)); },
  buy(c, id) {
    const u = CREW_UPS.find((x) => x.id === id), lv = (c.ups || {})[id] || 0;
    if (!u || lv >= u.max || this.free(c) < this.cost(lv)) return false;
    c = { ...c, ups: { ...(c.ups || {}), [id]: lv + 1 }, rev: (c.rev || 0) + 1 };
    Crews.save(c);
    if (CO.role === 'host' && CO.crewId === c.id) { CO.crew = Crews.get(c.id); Net.bcast(coLobbyMsg()); coLobbyUI(); }
    else if (CO.role === 'guest' && CO.crew && CO.crew.id === c.id) { CO.crew = Crews.get(c.id); Net.send({ t: 'crewSync', crew: CO.crew }); }
    return true;
  },
  cur: null, tab: 'maps',
  open(id) { this.cur = id; show('crewHQ'); this.build(); },
  build() {
    const c = Crews.get(this.cur); if (!c) { hide('crewHQ'); return; }
    const t = this.tab;
    $('hqTitle').textContent = '🛡️ ' + c.name;
    for (const b of document.querySelectorAll('[data-hqt]')) b.classList.toggle('sel', b.dataset.hqt === t);
    const need = Crews.xpNeed(c.level);
    let h = `<div class="hqTop"><b>LV ${c.level}</b><i class="bar"><i style="width:${Math.min(100, (c.xp / need) * 100)}%"></i></i><span>${c.xp}/${need} XP</span><span>⭐ ${this.free(c)} crew points</span></div>`;
    if (t === 'maps') {
      h += '<p class="dim">Win a map together (or survive 15:00 on it) to open the next ones for the whole crew.</p><div class="runList">';
      for (const s of STAGES) {
        const open = (c.stages || []).includes(s.id), best = (c.best || {})[s.id], nd = STAGES.find((x) => x.id === s.needs);
        h += `<div class="runRow ${open ? '' : 'lockd'}"><div class="pi">${open ? s.icon : '🔒'}</div><div class="runInfo"><b>${s.name}</b><small>${open ? s.desc + (best ? ' · best ' + fmtTime(best) : '') : 'Beat ' + (nd ? nd.name : '?') + ' together, or survive 15:00 there.'}</small></div></div>`;
      }
      h += '</div>';
    } else if (t === 'ups') {
      h += `<p class="dim">Crew points: 1 to start, +1 per crew level, +2 per win. Upgrades help everyone in this crew's runs.</p><div class="tree">`;
      for (const u of CREW_UPS) {
        const lv = (c.ups || {})[u.id] || 0, maxed = lv >= u.max, cost = this.cost(lv), can = !maxed && this.free(c) >= cost;
        h += `<button class="tnode ${maxed ? 'done' : can ? 'open' : ''}" data-hqbuy="${u.id}"><span class="tic">${u.icon}</span><span><b>${u.name} ${lv}/${u.max}</b><small>${u.desc}</small><em>${maxed ? 'MAXED' : `<span class="${can ? 'afford' : 'poor'}">⭐ ${cost}</span>`}</em></span></button>`;
      }
      h += '</div>';
    } else {
      const log = (c.log || []).map((r) => { const st = STAGES.find((s) => s.id === r.stage) || STAGES[0]; return `<div class="runRow"><div class="pi">${r.kind === 'win' ? '🏆' : '💀'}</div><div class="runInfo"><b>${st.icon} ${st.name} · ${fmtTime(r.time)}</b><small>${r.kills} kills · ${new Date(r.t).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></div></div>`; }).join('');
      h += `<div class="hqStats"><div><b>${c.runs || 0}</b>runs</div><div><b>${c.wins || 0}</b>wins</div><div><b>${c.kills || 0}</b>kills</div><div><b>${(c.stages || []).length}/${STAGES.length}</b>maps</div></div>
        <div class="sect">MEMBERS</div><p>${(c.members || []).map((m) => { const ch = CHARACTERS.find((x) => x.id === m.char); return (ch ? ch.icon + ' ' : '') + m.name; }).join(' · ') || '—'}</p>
        <div class="sect">RECENT RUNS</div><div class="runList">${log || '<p class="dim">No crew runs yet.</p>'}</div>`;
    }
    $('hqBody').innerHTML = h;
    for (const b of document.querySelectorAll('[data-hqbuy]')) b.onclick = () => { if (this.buy(Crews.get(this.cur), b.dataset.hqbuy)) { Sfx.init(); Sfx.play('quest'); } else { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); } this.build(); };
    if (typeof I18n !== 'undefined' && I18n.cur !== 'en') try { I18n.dom($('crewHQ')); } catch (e) { /* keep english */ }
  },
};

// merge: upgrades keep their highest level on every device
const _hqSave = Crews.save.bind(Crews);
Crews.save = function (c) {
  if (c && c.id) { const old = this.get(c.id); if (old && old.ups) { const u = { ...(c.ups || {}) }; for (const k in old.ups) u[k] = Math.max(u[k] || 0, old.ups[k]); c = { ...c, ups: u }; } }
  return _hqSave(c);
};
// crew upgrades apply in crew runs
const _hqNg = Coop.onNewGame.bind(Coop);
Coop.onNewGame = function () {
  _hqNg();
  const c = CO.crew; if (!c || !c.ups) return;
  for (const u of CREW_UPS) { const l = c.ups[u.id] || 0; if (l) u.apply(P, l); }
};
const _hqCoUp = Coop.update.bind(Coop);
Coop.update = function (dt) { _hqCoUp(dt); const l = CO.crew && CO.crew.ups ? CO.crew.ups.revive || 0 : 0; if (l && G && P.ghost > 0 && CO.reviveT > 0) CO.reviveT += dt * 0.3 * l; };
// sync: a guest brings unlocks and upgrades the host's copy is missing; guests can buy in the lobby
const _hqMsg = Coop.onMsg.bind(Coop);
Coop.onMsg = function (m, from) {
  if (m && m.t === 'crewSync' && CO.role === 'host' && CO.crew && m.crew && m.crew.id === CO.crew.id) {
    const mine = Crews.get(CO.crew.id);
    Crews.save({ ...m.crew, stages: [...new Set([...(mine.stages || []), ...(m.crew.stages || [])])], rev: Math.max(mine.rev || 0, m.crew.rev || 0) + 1 });
    CO.crew = Crews.get(CO.crew.id); Net.bcast(coLobbyMsg()); coLobbyUI(); return;
  }
  const r = _hqMsg(m, from);
  if (m && m.t === 'lobby' && CO.role === 'guest' && m.crew && !CO.synced) {
    CO.synced = true;
    const mine = Crews.get(m.crew.id);
    const more = mine && ((mine.stages || []).some((s) => !(m.crew.stages || []).includes(s)) || Object.keys(mine.ups || {}).some((k) => (mine.ups[k] || 0) > ((m.crew.ups || {})[k] || 0)));
    if (more) Net.send({ t: 'crewSync', crew: mine });
  }
  if (m && m.t === 'lobby' && $('crewHQ') && $('crewHQ').classList.contains('show')) CrewHQ.build();
  return r;
};
const _hqLeave = Net.leave.bind(Net);
Net.leave = function () { CO.synced = false; return _hqLeave(); };

addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('div'); s.id = 'crewHQ'; s.className = 'screen scroll';
  s.innerHTML = `<div class="hdr"><button class="back" id="hqBack">← BACK</button><h2 id="hqTitle">CREW</h2><span></span></div>
    <div id="hqTabs" class="hqTabs"><button class="tab" data-hqt="maps">🗺️ MAPS</button><button class="tab" data-hqt="ups">⭐ UPGRADES</button><button class="tab" data-hqt="stats">📊 STATS</button></div>
    <div id="hqBody"></div>`;
  document.body.appendChild(s);
  $('hqBack').onclick = () => { hide('crewHQ'); if (typeof coUI === 'function') coUI(); };
  for (const b of s.querySelectorAll('[data-hqt]')) b.onclick = () => { CrewHQ.tab = b.dataset.hqt; CrewHQ.build(); };
  // entry points: a button on every crew card and one in the lobby's crew line
  const _ui = coUI;
  coUI = function (...a) {
    const r = _ui(...a);
    for (const row of document.querySelectorAll('#crewList .runRow.crew')) {
      const hb = row.querySelector('[data-crewhost]'); if (!hb || row.querySelector('[data-crewhq]')) continue;
      const b = document.createElement('button'); b.className = 'big ghost'; b.dataset.crewhq = hb.dataset.crewhost; b.textContent = '⭐ HQ'; b.onclick = () => CrewHQ.open(b.dataset.crewhq);
      hb.before(b);
    }
    return r;
  };
  const _lui = coLobbyUI;
  coLobbyUI = function (...a) {
    const r = _lui(...a);
    const bar = $('crewBar');
    if (bar && CO.crew && !CO.active && !bar.querySelector('[data-hqlobby]')) { const b = document.createElement('button'); b.className = 'big ghost small'; b.dataset.hqlobby = 1; b.textContent = '⭐ CREW HQ · ' + CrewHQ.free(Crews.get(CO.crew.id) || CO.crew) + ' pts'; b.onclick = () => CrewHQ.open(CO.crew.id); bar.appendChild(b); }
    return r;
  };
});
