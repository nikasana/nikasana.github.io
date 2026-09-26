'use strict';
// ---------- co-op crews: saved co-op campaigns shared by every member, separate from solo saves ----------
// A crew keeps its own stage unlocks, level and records. Every member's device stores a copy, so anyone can host it later.
const Crews = {
  KEY: 'zonebonk_crews',
  all() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; } },
  put(list) { try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, 20))); } catch (e) { /* storage full or blocked */ } },
  get(id) { return this.all().find((c) => c.id === id) || null; },
  create(name) {
    const c = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: (name || 'Crew of ' + coNick()).slice(0, 24), rev: 1, level: 1, xp: 0, stages: ['zone'], runs: 0, wins: 0, kills: 0, best: {}, members: [], created: Date.now(), last: Date.now(), log: [] };
    this.save(c); return c;
  },
  // keep the newest revision, but never lose unlocks, members or records
  save(c) {
    if (!c || !c.id) return;
    const list = this.all(), i = list.findIndex((x) => x.id === c.id), old = list[i];
    let m = c;
    if (old) {
      m = (old.rev || 0) > (c.rev || 0) ? { ...old } : { ...c };
      m.stages = [...new Set([...(old.stages || []), ...(c.stages || [])])];
      const names = new Map(); for (const x of [...(old.members || []), ...(c.members || [])]) names.set(x.name, x); m.members = [...names.values()].slice(0, 12);
      m.best = { ...(old.best || {}) }; for (const k in c.best || {}) m.best[k] = Math.max(m.best[k] || 0, c.best[k]);
      list.splice(i, 1);
    }
    m.last = Date.now(); list.unshift(m); this.put(list);
  },
  remove(id) { this.put(this.all().filter((c) => c.id !== id)); },
  xpNeed(l) { return 800 + (l - 1) * 450; },
  // after a co-op run the host levels up the crew and shares the result with everyone
  afterRun(c, kind) {
    if (!c) return null;
    c = { ...c, stages: [...c.stages], best: { ...c.best }, log: [...(c.log || [])] };
    const mins = Math.floor(G.t / 60), gain = G.kills + mins * 40 + (kind === 'win' ? 600 : 0) + (G.bossKills || 0) * 80;
    c.xp += gain; c.runs++; c.kills += G.kills; c.rev = (c.rev || 0) + 1;
    let ups = 0; while (c.xp >= this.xpNeed(c.level)) { c.xp -= this.xpNeed(c.level); c.level++; ups++; }
    c.best[G.stage] = Math.max(c.best[G.stage] || 0, Math.floor(G.t));
    const unlocked = [];
    if (kind === 'win') { c.wins++; for (const s of STAGES) if (s.needs === G.stage && !c.stages.includes(s.id)) { c.stages.push(s.id); unlocked.push(s); } }
    c.members = [...CO.players.values()].map((p) => ({ name: p.name, char: p.char }));
    c.log.unshift({ t: Date.now(), stage: G.stage, time: Math.floor(G.t), kills: G.kills, kind }); c.log = c.log.slice(0, 10);
    c.lastGain = { xp: gain, ups, unlocked: unlocked.map((s) => s.icon + ' ' + s.name) };
    return c;
  },
};
function crewCard(c, btns) {
  const st = (c.stages || []).map((id) => (STAGES.find((s) => s.id === id) || {}).icon || '').join(' ');
  const need = Crews.xpNeed(c.level), when = new Date(c.last || c.created).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `<div class="runRow crew"><div class="pi">🛡️</div><div class="runInfo"><b>${c.name} · LV ${c.level}</b><small>${st} · ${c.runs} runs · ${c.wins} wins · ${(c.members || []).map((m) => m.name).join(', ') || 'no runs yet'} · ${when}</small><i class="bar"><i style="width:${Math.min(100, (c.xp / need) * 100)}%"></i></i></div>${btns}</div>`;
}

addEventListener('DOMContentLoaded', () => {
  // ----- entry view: your crews -----
  const entry = $('coEntry');
  entry.insertAdjacentHTML('afterbegin', '<div class="sect">YOUR CREWS · co-op progress you share with your teammates</div><div id="crewList" class="runList"></div><div class="coLinkRow"><input id="crewNew" maxlength="24" placeholder="New crew name"><button class="big ghost" id="crewNewBtn">➕ NEW CREW</button></div>');
  const buildCrews = () => {
    const list = Crews.all();
    $('crewList').innerHTML = list.length ? list.map((c) => crewCard(c, `<button class="big" data-crewhost="${c.id}">🏠 HOST</button><button class="big ghost" data-crewdel="${c.id}">🗑</button>`)).join('') : '<p class="dim">No crews yet. Create one, or join a friend\'s crew: it is saved here automatically.</p>';
    for (const b of document.querySelectorAll('[data-crewhost]')) b.onclick = () => { CO.crewId = b.dataset.crewhost; $('coHost').onclick(); };
    for (const b of document.querySelectorAll('[data-crewdel]')) b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'DELETE?'; return; } Crews.remove(b.dataset.crewdel); buildCrews(); };
  };
  $('crewNewBtn').onclick = () => { const c = Crews.create($('crewNew').value.trim()); $('crewNew').value = ''; CO.crewId = c.id; buildCrews(); $('coHost').onclick(); };
  const _coUI = coUI;
  coUI = function () { _coUI(); buildCrews(); };
  // ----- lobby: crew picker for the host, crew banner for everyone -----
  $('coSlots').insertAdjacentHTML('beforebegin', '<div id="crewBar" class="coSet"></div>');
  $('coSetEdit').insertAdjacentHTML('afterbegin', '<label class="set"><span>Crew</span><select id="crewSel"></select></label>');
  $('crewSel').onchange = () => { CO.crewId = $('crewSel').value || null; CO.crew = CO.crewId ? Crews.get(CO.crewId) : null; if (CO.crew && !CO.crew.stages.includes(CO.settings.stage)) CO.settings.stage = CO.crew.stages[0]; Net.bcast(coLobbyMsg()); coLobbyUI(); };
  const _msg = coLobbyMsg;
  coLobbyMsg = function () {
    if (CO.role === 'host') { CO.crew = CO.crewId ? Crews.get(CO.crewId) : null; if (CO.crew && CO.settings && !CO.crew.stages.includes(CO.settings.stage)) { CO.settings.stage = CO.crew.stages[0]; CO.settings.spawn = 0; } }
    const m = _msg(); if (CO.role === 'host') m.crew = CO.crew; return m;
  };
  const _lui = coLobbyUI;
  coLobbyUI = function () {
    _lui();
    if (!$('coLobby') || CO.active) return;
    const host = CO.role === 'host', c = CO.crew;
    $('crewBar').innerHTML = c ? `🛡️ Crew <b>${c.name}</b> · level ${c.level} · +${Math.min(25, c.level - 1)}% damage & XP bonus · ${c.stages.length} stages unlocked` : '⚡ Quick match: no crew progress is saved';
    if (host) {
      $('crewSel').innerHTML = '<option value="">⚡ Quick match (no crew)</option>' + Crews.all().map((x) => `<option value="${x.id}" ${x.id === CO.crewId ? 'selected' : ''}>🛡️ ${x.name} · LV ${x.level}</option>`).join('');
      // a crew plays the stages the crew has unlocked
      if (c) { $('coStage').innerHTML = STAGES.filter((s) => c.stages.includes(s.id)).map((s) => `<option value="${s.id}" ${s.id === CO.settings.stage ? 'selected' : ''}>${s.icon} ${s.name}</option>`).join(''); }
    }
  };
  // ----- messages: guests keep a copy of the crew -----
  const _on = Coop.onMsg.bind(Coop);
  Coop.onMsg = function (m, from) {
    if (m && CO.role === 'guest' && (m.t === 'lobby' || m.t === 'crew') && m.crew) { CO.crew = m.crew; Crews.save(m.crew); }
    if (m && m.t === 'crew' && CO.role === 'guest') { CO.crewRes = m.crew; return; }
    _on(m, from);
    if (m && m.t === 'end' && CO.crewRes) { crewResult(CO.crewRes); CO.crewRes = null; }
  };
  // crew bonus in the run
  const _ng = Coop.onNewGame.bind(Coop);
  Coop.onNewGame = function () { _ng(); if (CO.crew) { const b = Math.min(25, CO.crew.level - 1) / 100; P.dmgMul += b; P.xpMul += b; G.crewId = CO.crew.id; } };
  // end of a crew run: level up, unlock, share with everyone
  const _er = endRun;
  endRun = function (kind, src) {
    const crewRun = G && G.coop && CO.active && CO.role === 'host' && CO.crew && !G.ended;
    const downOnly = kind === 'dead' && G && G.coop && CO.active && coOthers().some((q) => !q.gone && !q.ghost);
    if (crewRun && !downOnly) { const c = Crews.afterRun(CO.crew, kind); if (c) { CO.crew = c; Crews.save(c); Net.bcast({ t: 'crew', crew: c }); setTimeout(() => crewResult(c), 50); } }
    _er(kind, src);
  };
});
function crewResult(c) {
  if (!c || !c.lastGain) return;
  Crews.save(c);
  const g = c.lastGain, el = $('earned');
  const h = `<div class="coRes crewRes"><b>🛡️ CREW ${c.name.toUpperCase()}</b><span>+${g.xp} crew XP · level ${c.level}${g.ups ? ' (+' + g.ups + ' LEVEL UP!)' : ''}</span>${g.unlocked.length ? '<span>🔓 Crew unlocked: ' + g.unlocked.join(', ') + '</span>' : ''}<small>Saved on every teammate's device. Anyone in the crew can host it from CO-OP → YOUR CREWS.</small></div>`;
  if (el && !el.querySelector('.crewRes')) el.insertAdjacentHTML('beforeend', h);
}
