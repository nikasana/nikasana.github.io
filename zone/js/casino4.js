'use strict';
// ---------- casino, part 4: mutant racing, pick-a-box and Monty Hall doors, each with its own free daily play ----------
const RACE_MUTANTS = [
  ['🐺', 'Snorks', 22, 2.6], ['🐗', 'Boar', 18, 3.2], ['🦂', 'Bloodsucker', 14, 4.2],
  ['🐦', 'Controller', 10, 6], ['🦴', 'Chimera', 6, 10], ['👻', 'Poltergeist', 3, 20],
];
const BOX_MULT = [0, 0, 0.5, 1, 1, 2, 3, 5, 10];
Object.assign(CZG, {
  // ----- mutant racing: pick a mutant before the race, faster ones pay less -----
  race(st) {
    const R = CZG.raceS = CZG.raceS || { pick: 0, run: null };
    const cv = CZ.canvas(st, 520, 260);
    st.insertAdjacentHTML('beforeend', `<div class="czGames">${RACE_MUTANTS.map(([ic, nm, , mult], i) => `<button class="czG ${i === R.pick ? 'sel' : ''}" data-rp="${i}"><span>${ic}</span>${nm} ×${mult}</button>`).join('')}</div><div class="czAct"><button class="big" id="raceGo">🐎 RACE</button>${CZ.armFreeHtml()}</div>`);
    for (const b of st.querySelectorAll('[data-rp]')) b.onclick = () => { if (R.run) return; R.pick = +b.dataset.rp; st.innerHTML = ''; CZG.race(st); CZ.i18n(); };
    $('raceGo').onclick = () => {
      if (R.run || !CZ.take(CZ.bet)) return;
      const total = RACE_MUTANTS.reduce((a, [, , w]) => a + w, 0);
      const gen = () => { let r = Math.random() * total; for (let i = 0; i < RACE_MUTANTS.length; i++) { r -= RACE_MUTANTS[i][2]; if (r <= 0) return i; } return 0; };
      const winner = CZ.rig(gen, (w) => w === R.pick);
      R.run = { t: 0, T: 3, winner, pos: RACE_MUTANTS.map(() => 0), bet: CZ.bet, done: false };
      CZ.busy = true; CZ.res(st, "They're off!");
    };
    CZ.loop(cv, (g, dt, T) => {
      const W = 520, H = 260, lanes = RACE_MUTANTS.length, lh = H / lanes;
      if (R.run && !R.run.done) {
        const r = R.run; r.t += dt;
        for (let i = 0; i < lanes; i++) { const speed = i === r.winner ? 1 : 0.7 + Math.sin(T * 7 + i) * 0.15; r.pos[i] = Math.min(i === r.winner ? 1 : 0.92, r.pos[i] + (dt / r.T) * speed); }
        if (r.t >= r.T) {
          r.done = true; r.pos[r.winner] = 1;
          const win = r.winner === R.pick ? Math.floor(r.bet * RACE_MUTANTS[R.pick][3]) : 0;
          CZ.give(win, r.bet); CZ.busy = false;
          CZ.res(st, win ? `${RACE_MUTANTS[r.winner][1]} wins! +${win} ₽` : `${RACE_MUTANTS[r.winner][1]} wins · you lose ${r.bet} ₽`, win > 0);
          Sfx.play(win ? 'quest' : 'hurt'); setTimeout(() => { if (R.run === r) R.run = null; }, 1400);
        }
      }
      g.clearRect(0, 0, W, H); g.fillStyle = '#0c1408'; g.fillRect(0, 0, W, H);
      RACE_MUTANTS.forEach(([ic, nm], i) => {
        const y = i * lh; g.strokeStyle = '#2a3a1a'; g.beginPath(); g.moveTo(0, y + lh); g.lineTo(W, y + lh); g.stroke();
        const pos = R.run ? R.run.pos[i] : 0;
        g.fillStyle = i === R.pick ? '#ffe070' : '#889'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(nm, 8, y + 14);
        g.font = '26px serif'; g.fillText(ic, 30 + pos * (W - 90), y + lh * 0.85);
      });
      g.strokeStyle = '#d4a640'; g.lineWidth = 3; g.beginPath(); g.moveTo(W - 40, 0); g.lineTo(W - 40, H); g.stroke();
    });
  },

  // ----- pick-a-box: buy a round, then open one box — the value is decided the moment you open it -----
  box(st) {
    const B = CZG.boxS = CZG.boxS || { active: false, opened: -1 };
    st.insertAdjacentHTML('beforeend', `<p class="dim">Pick a box — one holds a ×10 jackpot, most hold small prizes, one is empty.</p><div class="czBoxes">${[0, 1, 2, 3, 4].map((i) => `<button class="czBox" data-bx="${i}">🗝️</button>`).join('')}</div><div class="czAct"><button class="big" id="boxGo">🗝️ NEW ROUND</button>${CZ.armFreeHtml()}</div>`);
    const paint = () => { for (const b of st.querySelectorAll('[data-bx]')) b.disabled = !B.active || B.opened !== -1; $('boxGo').disabled = B.active; };
    $('boxGo').onclick = () => { if (B.active || !CZ.take(CZ.bet)) return; B.active = true; B.opened = -1; B.bet = CZ.bet; CZ.res(st, 'Pick a box!'); paint(); };
    for (const b of st.querySelectorAll('[data-bx]')) b.onclick = () => {
      if (!B.active || B.opened !== -1) return;
      const mult = CZ.rig(() => pick(BOX_MULT), (m) => m > 1);
      B.opened = +b.dataset.bx; b.textContent = mult === 0 ? '💀' : '×' + mult; b.classList.add(mult > 1 ? 'hit' : 'miss');
      const win = Math.floor(B.bet * mult); CZ.give(win, B.bet); B.active = false;
      CZ.res(st, win ? `×${mult} · +${win} ₽` : '💀 empty box · lost ' + B.bet + ' ₽', win > B.bet ? true : win ? null : false); Sfx.play(win ? 'quest' : 'hurt'); paint();
    };
    paint();
  },

  // ----- Monty Hall: pick a door, the host opens a goat, then stay or switch -----
  monty(st) {
    const M = CZG.montyS = CZG.montyS || { stage: 0, pick: -1, prize: -1, reveal: -1, final: null };
    st.insertAdjacentHTML('beforeend', '<p class="dim">One door hides ×3 your bet. Pick a door — the host will open a losing one, then you can switch.</p><div class="czDoors">' + [0, 1, 2].map((i) => `<button class="czDoor" data-d="${i}">🚪</button>`).join('') + '</div><div class="czAct" id="montyAct"></div>');
    const paint = () => {
      for (const b of st.querySelectorAll('[data-d]')) {
        const i = +b.dataset.d;
        b.classList.toggle('pick', M.pick === i); b.classList.toggle('goat', M.stage >= 1 && M.reveal === i);
        b.disabled = M.stage === 0 ? false : (M.stage === 1 ? i === M.reveal : true);
        b.textContent = M.stage >= 2 ? (i === M.prize ? '🏆' : '🐐') : (M.stage >= 1 && M.reveal === i ? '🐐' : '🚪');
      }
      const act = $('montyAct');
      if (M.stage === 0) act.innerHTML = CZ.armFreeHtml();
      else if (M.stage === 1) act.innerHTML = '<button class="big" id="mStay">STAY</button><button class="big ghost" id="mSwitch">SWITCH</button>';
      else act.innerHTML = '<button class="big" id="mNew">🚪 NEW ROUND</button>';
      const sB = $('mStay'), swB = $('mSwitch'), nB = $('mNew');
      if (sB) sB.onclick = () => finish(M.pick);
      if (swB) swB.onclick = () => finish([0, 1, 2].find((i) => i !== M.pick && i !== M.reveal));
      if (nB) nB.onclick = () => { M.stage = 0; M.pick = -1; M.reveal = -1; M.final = null; CZ.res(st, ''); paint(); };
    };
    const finish = (chosen) => {
      M.stage = 2; M.final = chosen; const win = chosen === M.prize ? Math.floor(M.bet * 3) : 0;
      CZ.give(win, M.bet); CZ.busy = false;
      CZ.res(st, win ? `🏆 The prize was behind door ${M.prize + 1}! +${win} ₽` : `🐐 The prize was behind door ${M.prize + 1} · lost ${M.bet} ₽`, win > 0);
      Sfx.play(win ? 'quest' : 'hurt'); paint();
    };
    for (const b of st.querySelectorAll('[data-d]')) b.onclick = () => {
      if (M.stage !== 0 || !CZ.take(CZ.bet)) return;
      M.bet = CZ.bet; M.pick = +b.dataset.d;
      M.prize = CZ.rig(() => Math.floor(Math.random() * 3), (p) => p === M.pick);
      const goats = [0, 1, 2].filter((i) => i !== M.pick && i !== M.prize);
      M.reveal = goats[Math.floor(Math.random() * goats.length)];
      M.stage = 1; CZ.busy = true; CZ.res(st, `Door ${M.reveal + 1} had a 🐐 — stay or switch?`); paint();
    };
    paint();
  },
});
