'use strict';
// ---------- UX: undo purchases, vibration, compact phone HUD, key remapping, fullscreen, tooltips ----------

// ----- remappable keys: a custom key is translated into the game's default key -----
const KEY_ACTIONS = [
  ['up', 'Move up', 'KeyW'], ['down', 'Move down', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ['dash', 'Dash', 'Space'], ['ability', 'Artifact power', 'KeyQ'], ['next', 'Next artifact', 'KeyE'], ['prev', 'Previous artifact', 'Minus'],
  ['ride', 'Ride / get off', 'KeyF'], ['bolt', 'Throw bolt', 'KeyT'], ['map', 'Map', 'KeyM'], ['pause', 'Pause', 'Escape'], ['radioN', 'Next radio station', 'KeyN'], ['radioP', 'Previous radio station', 'KeyB'],
];
function keyBinds() { return (Save.data && Save.data.keys) || {}; }
function keyName(code) { return String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '→').replace('Space', 'Space').replace('Escape', 'Esc'); }
let KEY_CAPTURE = null;
function keyRemap(e) {
  if (e.isTrusted === false) return;
  if (KEY_CAPTURE) { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown') KEY_CAPTURE(e.code); return; }
  const B = keyBinds();
  const act = KEY_ACTIONS.find(([id, , def]) => B[id] && B[id] === e.code && B[id] !== def);
  if (!act) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const def = act[2];
  if (['up', 'down', 'left', 'right'].includes(act[0])) { keys[def] = e.type === 'keydown'; return; }
  if (e.type === 'keydown' && !e.repeat) dispatchEvent(new KeyboardEvent('keydown', { code: def, key: def }));
  if (e.type === 'keyup') dispatchEvent(new KeyboardEvent('keyup', { code: def, key: def }));
}
addEventListener('keydown', keyRemap, true);
addEventListener('keyup', keyRemap, true);

// ----- vibration (phones) -----
function buzz(ms) { if (Save.set.vibrate === false || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch (e) { /* not supported */ } }
const _uxHurt = hurtPlayer;
hurtPlayer = function (d, src, ig, kind) { const h = P.hp; _uxHurt(d, src, ig, kind); if (P.hp < h) buzz(h - P.hp > 20 ? 60 : 25); };
const _uxBoss = bossCard;
bossCard = function (e, o) { _uxBoss(e, o); buzz([80, 60, 160]); };
const _uxXp = addXp;
addXp = function (v) { const l = G.level; _uxXp(v); if (G.level > l) buzz(40); };

// ----- tooltips: hover (PC) or long-press (phone) any HUD icon for its description -----
function tipShow(el, x, y) {
  const t = el.dataset.tip || el.getAttribute('title'); if (!t) return;
  if (el.getAttribute('title')) { el.dataset.tip = t; el.removeAttribute('title'); }
  let tip = $('tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); }
  tip.textContent = t; tip.classList.add('show');
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = clamp(x + 14, 6, innerWidth - w - 6) + 'px'; tip.style.top = clamp(y + 16, 6, innerHeight - h - 6) + 'px';
}
function tipHide() { const t = $('tip'); if (t) t.classList.remove('show'); }
addEventListener('mouseover', (e) => { const el = e.target.closest && e.target.closest('#hud [title], #hud [data-tip], #bunker [title], #setup [title]'); if (el) tipShow(el, e.clientX, e.clientY); else tipHide(); });
addEventListener('mousemove', (e) => { const t = $('tip'); if (t && t.classList.contains('show')) { t.style.left = clamp(e.clientX + 14, 6, innerWidth - t.offsetWidth - 6) + 'px'; t.style.top = clamp(e.clientY + 16, 6, innerHeight - t.offsetHeight - 6) + 'px'; } });
let tipTimer = null;
addEventListener('touchstart', (e) => { const el = e.target.closest && e.target.closest('#hud [title], #hud [data-tip]'); if (!el) return; const t = e.touches[0]; clearTimeout(tipTimer); tipTimer = setTimeout(() => { tipShow(el, t.clientX, t.clientY - 60); setTimeout(tipHide, 2500); }, 450); }, { passive: true });
addEventListener('touchend', () => clearTimeout(tipTimer), { passive: true });

// ----- fullscreen -----
function toggleFullscreen() {
  const d = document;
  try { if (!d.fullscreenElement && !d.webkitFullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement); else (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
  catch (e) { /* not allowed here */ }
}

// ----- compact phone HUD -----
function applyCompact() {
  const s = Save.set.compactHud, on = s === true || (s !== false && matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 600);
  document.body.classList.toggle('compact', on);
}
addEventListener('resize', applyCompact);

addEventListener('DOMContentLoaded', () => {
  // ----- undo for every purchase (bunker, suits, research, skills, stalkers...) -----
  let undoSnap = null;
  const snap = () => JSON.stringify(Save.data);
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('#bunker, #setup') || e.target.closest('[data-bet], #undoBar')) return;
    const before = snap(), r0 = Save.data.rubles, sp0 = Save.data.sp || 0;
    setTimeout(() => {
      if (Save.data.rubles < r0 || (Save.data.sp || 0) < sp0) { undoSnap = before; showUndo(r0 - Save.data.rubles, sp0 - (Save.data.sp || 0)); }
    }, 0);
  }, true);
  const bar = document.createElement('div'); bar.id = 'undoBar'; document.body.appendChild(bar);
  function showUndo(rub, sp) {
    bar.innerHTML = `<span>Spent ${rub > 0 ? rub + ' ₽' : ''}${rub > 0 && sp > 0 ? ' + ' : ''}${sp > 0 ? sp + ' skill point' + (sp > 1 ? 's' : '') : ''}</span><button class="big">↩ UNDO</button>`;
    bar.classList.add('show'); clearTimeout(bar._t); bar._t = setTimeout(() => bar.classList.remove('show'), 8000);
    bar.querySelector('button').onclick = () => {
      if (!undoSnap) return;
      Save.data = JSON.parse(undoSnap); Save.save(); undoSnap = null; bar.classList.remove('show');
      if ($('bunker').classList.contains('show')) buildBunker(); if ($('setup').classList.contains('show')) buildSetup(); menuRubles();
    };
  }
  // ----- fullscreen button in the HUD and on the title -----
  const fb = document.createElement('button'); fb.id = 'fsBtn'; fb.title = 'Fullscreen'; fb.textContent = '⛶'; fb.onclick = (e) => { e.stopPropagation(); toggleFullscreen(); };
  $('btns').appendChild(fb);
  const tf = document.createElement('button'); tf.className = 'ghost profBtn'; tf.id = 'fsTitle'; tf.textContent = '⛶ Fullscreen'; tf.style.left = 'auto'; tf.style.right = '12px'; tf.onclick = toggleFullscreen;
  $('title').appendChild(tf);
  // ----- settings: vibration, compact HUD, fullscreen, controls -----
  const _bs = buildSettings;
  buildSettings = function () {
    _bs();
    const s = Save.set, body = $('settingsBody');
    const sel = (k, label, opts) => `<label class="set"><span>${label}</span><select data-ux="${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(s[k] === undefined ? 'auto' : s[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    body.insertAdjacentHTML('beforeend',
      sel('vibrate', 'Vibration (phones)', [['true', 'On'], ['false', 'Off']]) +
      sel('compactHud', 'Compact phone HUD', [['auto', 'Auto'], ['true', 'On'], ['false', 'Off']]) +
      '<button class="big ghost small" id="fsSet">⛶ Toggle fullscreen</button>' +
      '<div class="sect">CONTROLS · click a key to change it</div><div id="keyList"></div><button class="big ghost small" id="keyReset">Reset keys</button>');
    for (const el of body.querySelectorAll('[data-ux]')) el.onchange = () => { const v = el.value; s[el.dataset.ux] = v === 'auto' ? undefined : v === 'true'; Save.save(); applyCompact(); };
    $('fsSet').onclick = toggleFullscreen;
    const drawKeys = () => {
      const B = keyBinds();
      $('keyList').innerHTML = KEY_ACTIONS.map(([id, n, def]) => `<label class="set"><span>${n}</span><button class="keyBtn" data-key="${id}">${keyName(B[id] || def)}</button></label>`).join('');
      for (const b of document.querySelectorAll('[data-key]')) b.onclick = () => {
        b.textContent = 'press a key…'; b.classList.add('wait');
        KEY_CAPTURE = (code) => { KEY_CAPTURE = null; if (code !== 'Escape' || b.dataset.key === 'pause') { Save.data.keys = { ...keyBinds(), [b.dataset.key]: code }; Save.save(); } drawKeys(); };
      };
    };
    drawKeys();
    $('keyReset').onclick = () => { Save.data.keys = {}; Save.save(); drawKeys(); };
    applyLang && applyLang();
  };
  applyCompact();
  // key hint bar shows remapped keys
  const _tc = titleContinue;
  titleContinue = function () { _tc(); applyCompact(); };
});
