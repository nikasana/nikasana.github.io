'use strict';
// ---------- save slots: 3 profiles, several saved runs per profile, save & quit ----------
const Runs = {
  key() { return slotKey('zonebonk_runs'); },
  list() { try { return JSON.parse(localStorage.getItem(this.key()) || '[]'); } catch (e) { return []; } },
  put(list) { try { localStorage.setItem(this.key(), JSON.stringify(list)); return true; } catch (e) { return false; } },
  // store the running game as a named save (replacing the save it was loaded from)
  saveCurrent() {
    const d = RunSave.build(); if (!d) return false;
    const list = this.list().filter((r) => r.id !== G.saveId);
    const id = G.saveId || 'r' + Date.now().toString(36);
    list.unshift({ id, d }); while (list.length > 6) list.pop();
    if (!this.put(list)) return false;
    RunSave.clear(); G.saveId = id; return true;
  },
  remove(id) { this.put(this.list().filter((r) => r.id !== id)); },
};
function runLabel(d) {
  const st = STAGES.find((s) => s.id === d.g.stage) || STAGES[0], ch = CHARACTERS.find((c) => c.id === d.g.char) || CHARACTERS[0];
  const mode = d.g.mode2 && d.g.mode2 !== 'standard' ? d.g.mode2 : d.g.endless ? 'endless' : 'standard';
  return { st, ch, mode, when: d.when ? new Date(d.when).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '' };
}
function loadRun(d, id) {
  Sfx.init(); applySettings();
  for (const s of ['title', 'setup', 'bunker', 'settings', 'runs', 'profiles']) hide(s);
  $('loading').classList.add('show');
  setTimeout(() => {
    NEXT_RUN = { mode: d.g.mode2 || 'standard', mutators: [], ngplus: false };
    if (!RunSave.restore(d)) { $('loading').classList.remove('show'); openScreen('title'); return; }
    G.saveId = id || null;
    $('loading').classList.remove('show'); $('hud').classList.add('show');
    if (matchMedia('(pointer: coarse)').matches) $('touchUi').classList.add('show');
  }, 30);
}
function profileInfo(n) {
  try {
    const d = JSON.parse(localStorage.getItem(n === 1 ? 'zonebonk_save' : 'zonebonk_save_s' + n) || 'null');
    if (!d) return null;
    return { rubles: d.rubles || 0, stages: (d.stages || []).length, wins: d.wins || 0, runs: d.runs || 0, name: d.profileName || '' };
  } catch (e) { return null; }
}

addEventListener('DOMContentLoaded', () => {
  // ----- saved runs screen -----
  const rs = document.createElement('div'); rs.id = 'runs'; rs.className = 'screen scroll';
  rs.innerHTML = '<div class="hdr"><button class="back" id="runsBack">← BACK</button><h2>SAVED RUNS</h2><span></span></div><div id="runsList" class="runList"></div>';
  document.body.appendChild(rs);
  const buildRuns = () => {
    const auto = RunSave.peek(), list = Runs.list(), el = $('runsList');
    const row = (d, id, tag) => { const L = runLabel(d); return `<div class="runRow"><div class="pi">${L.st.icon}</div><div class="runInfo"><b>${L.st.name} · ${fmtTime(d.g.t)} · LV ${d.g.level}</b><small>${tag} · ${L.ch.icon} ${L.ch.name} · ${L.mode}${d.g.diff ? ' · ' + diffDef(d.g.diff).icon + ' ' + diffDef(d.g.diff).name : ''} · ${d.g.kills || 0} kills · ${L.when}</small></div><button class="big" data-load="${id}">▶ PLAY</button><button class="big ghost" data-del="${id}">🗑</button></div>`; };
    let h = '';
    if (auto && auto.g) h += row(auto, '__auto', '⏱ autosave (last run)');
    for (const r of list) h += row(r.d, r.id, '💾 saved');
    el.innerHTML = h || '<p class="dim" style="text-align:center">No saved runs yet. Use 💾 SAVE & QUIT in the pause menu to keep a run for later.</p>';
    for (const b of el.querySelectorAll('[data-load]')) b.onclick = () => { const id = b.dataset.load; if (id === '__auto') loadRun(RunSave.peek(), null); else { const r = Runs.list().find((x) => x.id === id); if (r) loadRun(r.d, r.id); } };
    for (const b of el.querySelectorAll('[data-del]')) b.onclick = () => { if (b.dataset.sure) { const id = b.dataset.del; if (id === '__auto') RunSave.clear(); else Runs.remove(id); buildRuns(); titleContinue(); } else { b.dataset.sure = 1; b.textContent = 'DELETE?'; } };
  };
  $('runsBack').onclick = () => { hide('runs'); openScreen('title'); };
  // ----- profiles screen -----
  const ps = document.createElement('div'); ps.id = 'profiles'; ps.className = 'screen scroll';
  ps.innerHTML = '<div class="hdr"><button class="back" id="profBack">← BACK</button><h2>PROFILES</h2><span></span></div><p class="dim" style="text-align:center">Each profile has its own rubles, upgrades, unlocks and saved runs.</p><div id="profList" class="runList"></div>';
  document.body.appendChild(ps);
  const buildProfiles = () => {
    const cur = slotNo(); let h = '';
    for (let n = 1; n <= 3; n++) {
      const i = profileInfo(n);
      h += `<div class="runRow ${n === cur ? 'cur' : ''}"><div class="pi">👤</div><div class="runInfo"><b>Profile ${n}${n === cur ? ' · ACTIVE' : ''}</b><small>${i ? `${i.rubles} ₽ · ${i.stages} stages · ${i.wins} wins · ${i.runs} runs` : 'empty · start fresh'}</small></div>${n === cur ? '' : `<button class="big" data-prof="${n}">SWITCH</button>`}${i && n !== cur ? `<button class="big ghost" data-wipe="${n}">🗑</button>` : ''}</div>`;
    }
    $('profList').innerHTML = h;
    for (const b of document.querySelectorAll('[data-prof]')) b.onclick = () => { try { localStorage.setItem('zonebonk_slot', b.dataset.prof); } catch (e) { /* storage blocked */ } location.href = location.pathname; };
    for (const b of document.querySelectorAll('[data-wipe]')) b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'ERASE?'; return; } const n = +b.dataset.wipe, sfx = n === 1 ? '' : '_s' + n; for (const k of ['zonebonk_save', 'zonebonk_run', 'zonebonk_runs']) try { localStorage.removeItem(k + sfx); } catch (e) { /* storage blocked */ } buildProfiles(); };
  };
  $('profBack').onclick = () => { hide('profiles'); openScreen('title'); };
  // ----- title buttons -----
  const cont = $('continueRunBtn');
  const rb = document.createElement('button'); rb.className = 'big ghost'; rb.id = 'runsBtn'; rb.textContent = '📂 SAVED RUNS';
  cont.parentNode.insertBefore(rb, cont.nextSibling);
  rb.onclick = () => { Sfx.init(); openScreen('runs'); buildRuns(); };
  const pb = document.createElement('button'); pb.className = 'ghost profBtn'; pb.id = 'profBtn';
  $('title').appendChild(pb);
  pb.onclick = () => { Sfx.init(); openScreen('profiles'); buildProfiles(); };
  const _os = openScreen;
  openScreen = function (id) { hide('runs'); hide('profiles'); for (const c of ['bossCard', 'unlockCard', 'glitch']) { const el = $(c); if (el) el.classList.remove('show'); } _os(id); };
  const _tc = titleContinue;
  titleContinue = function () {
    _tc();
    const n = Runs.list().length + (RunSave.peek() ? 1 : 0);
    rb.style.display = n ? '' : 'none'; rb.textContent = '📂 SAVED RUNS (' + n + ')';
    pb.textContent = '👤 Profile ' + slotNo() + ' ▸';
  };
  titleContinue();
  // ----- pause: save & quit -----
  const ab = $('abandonBtn'), sq = document.createElement('button');
  sq.className = 'big'; sq.id = 'saveQuitBtn'; sq.textContent = '💾 SAVE & QUIT';
  ab.parentNode.insertBefore(sq, ab);
  sq.onclick = () => {
    if (G.coop) { banner('NOT IN CO-OP', 'Co-op runs cannot be saved.', 1.5, 'bad'); return; }
    if (!Runs.saveCurrent()) { sq.textContent = '⚠️ SAVE FAILED'; return; }
    G.ended = true; hide('pause'); toMenu();
  };
  const _bp = buildPause;
  buildPause = function () { _bp(); sq.style.display = G && G.coop ? 'none' : ''; sq.textContent = '💾 SAVE & QUIT'; };
  // a finished run removes its manual save
  const _er = endRun;
  endRun = function (kind, src) { const id = G && G.saveId; _er(kind, src); if (id && G.ended) Runs.remove(id); };
});
