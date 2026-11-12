// Entry point: wires the pure game state to rendering, input, UI, audio and saving.
import { CFG, roomSide, doorWidth } from './config.js';
import * as Game from './game.js';
import * as Save from './save.js';
import { t, fmt, setLang } from './strings.js';
import { World } from './render/scene.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { collide, roomOf } from './movement.js';
import * as UI from './ui.js';
import { el } from './ui.js';

const canvas = document.getElementById('c');
const input = new Input(canvas);
if (input.touch) document.body.classList.add('touch');
const audio = new Audio();
const panel = new UI.Panel();
const SAVE_KEY = 'main';

let game, world;
let gameTime = 0, frames = 0;
let running = false, lastFrame = performance.now(), saveTimer = 0, dirtySave = false;
const vel = { x: 0, z: 0 };
let toolMode = null;

const settings = () => game.settings;
const defaults = { fov: 75, sens: 1, volume: 0.7, warmMode: false, authorNotes: false, lang: null };

async function load() {
  let data = null;
  try { data = await Save.get(SAVE_KEY); } catch (e) { console.warn('save unavailable', e); }
  if (data) { try { game = Game.deserialize(data); } catch (e) { console.warn('bad save', e); } }
  if (!game) { game = Game.newGame((Math.random() * 2 ** 32) >>> 0); game.pos = { floor: 0, x: 0, y: 0, z: 0.8, yaw: 0, pitch: 0 }; }
  game.settings = { ...defaults, ...game.settings };
  setLang(game.settings.lang || (navigator.language || 'en').slice(0, 2));
}

async function save() {
  try { game.lastTs = Date.now(); await Save.put(SAVE_KEY, Game.serialize(game)); dirtySave = false; } catch (e) { console.warn('save failed', e); }
}
function markSave() { dirtySave = true; }

// ---------- doors / props for collision ----------
function blocked(rx, rz, side) { return false; }
function propsAt(rx, rz) { return Game.info(game, game.pos.floor, rx, rz).props; }

// ---------- interaction ----------
function nearSwitch() {
  const f = game.pos.floor, S = roomSide(f);
  const [rx, rz] = roomOf(game.pos.x, game.pos.z, S);
  if (rx === 0 && rz === 0) return null;
  const v = world.viewFor(f, rx, rz); if (!v || !v.switchPos) return null;
  const sx = rx * S + v.switchPos.x, sz = rz * S + v.switchPos.z;
  return Math.hypot(game.pos.x - sx, game.pos.z - sz) < 2.2 ? { rx, rz } : null;
}
function nearConsole() {
  const f = game.pos.floor, S = roomSide(f);
  const [rx, rz] = roomOf(game.pos.x, game.pos.z, S);
  return rx === 0 && rz === 0;
}
function interact() {
  const sw = nearSwitch();
  if (sw) {
    const res = Game.buyLamp(game, game.pos.floor, sw.rx, sw.rz);
    if (res.ok) { audio.lamp(); UI.toast(t('roomLit')); markSave(); save(); } else audio.deny();
    return;
  }
  if (nearConsole()) openPanel();
}
function openPanel(tab) { input.exitLock(); panel.show(tab); }
function goHome() {
  game.pos.x = 0; game.pos.z = 0.8; game.pos.yaw = 0; vel.x = vel.z = 0;
  audio.whoosh();
}

function setupPanel() {
  panel.setTabs([
    { id: 'settings', label: () => t('tabSettings'), render: renderSettings },
  ], (top) => top.append(el('span', {}, el('b', {}, fmt(game.player.glow) + ' ✦'), ' ', t('glow'))));
  panel.onClose = () => { if (!input.touch && running) input.requestLock(); };
}

function renderSettings(body, rerender) {
  const s = settings();
  const range = (key, label, min, max, step, apply) => el('label', { class: 'set' }, label,
    el('input', { type: 'range', min, max, step, value: s[key], oninput: (e) => { s[key] = +e.target.value; apply && apply(); markSave(); } }));
  const check = (key, label, apply) => el('label', { class: 'set' }, label,
    el('input', { type: 'checkbox', checked: s[key] ? true : false, onchange: (e) => { s[key] = e.target.checked; apply && apply(); markSave(); } }));
  const ta = el('textarea', { placeholder: t('importPrompt') });
  body.append(
    range('fov', t('fov'), 55, 100, 1, () => { world.camera.fov = s.fov; world.camera.updateProjectionMatrix(); }),
    range('sens', t('sensitivity'), 0.3, 2.5, 0.05),
    range('volume', t('volume'), 0, 1, 0.05, () => audio.setVolume(s.volume)),
    check('warmMode', t('warmMode')),
    el('h3', {}, t('exportSave')),
    el('div', {}, el('button', { class: 'plain', onclick: async () => { await save(); ta.value = Save.exportText(Game.serialize(game)); ta.select(); } }, t('exportSave')), ' ',
      el('button', { class: 'plain', onclick: () => { try { const o = Save.importText(ta.value); game = Game.deserialize(o); game.settings = { ...defaults, ...game.settings }; world.setGame(game); save(); UI.toast(t('importDone')); } catch (e) { UI.toast(t('importBad')); } } }, t('importSave'))),
    ta,
    el('h3', {}, ''),
    el('button', { class: 'plain', onclick: async () => { if (confirm(t('resetConfirm'))) { await Save.del(SAVE_KEY); location.reload(); } } }, t('resetGame')),
  );
}

// ---------- frame ----------
const tmpP = { x: 0, z: 0 };
let skipRender = false;
function update(dt) {
  const { ev, look, wheel } = input.poll();
  const s = settings();
  for (const e of ev) {
    if (e.type !== 'key') continue;
    if (panel.open) { if (e.code === 'Escape' || e.code === 'KeyE' && nearConsole()) panel.hide(); continue; }
    switch (e.code) {
      case 'KeyE': interact(); break;
      case 'KeyH': goHome(); break;
      case 'Escape': openPanel('settings'); break;
    }
  }
  const p = game.pos, f = p.floor, S = roomSide(f);
  if (!panel.open) {
    const sens = 0.0022 * s.sens;
    p.yaw -= look.x * sens; p.pitch -= look.y * sens;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch));
  }
  // movement
  const mx = panel.open ? 0 : input.move.x, my = panel.open ? 0 : input.move.y;
  const fwdX = -Math.sin(p.yaw), fwdZ = -Math.cos(p.yaw), rtX = Math.cos(p.yaw), rtZ = -Math.sin(p.yaw);
  let wx = fwdX * my + rtX * mx, wz = fwdZ * my + rtZ * mx;
  const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const speed = Game.walkSpeed(f);
  const tx = wx * speed, tz = wz * speed;
  const a = Math.min(1, CFG.player.accel * dt);
  vel.x += (tx - vel.x) * a; vel.z += (tz - vel.z) * a;
  tmpP.x = p.x + vel.x * dt; tmpP.z = p.z + vel.z * dt;
  collide(tmpP, S, blocked, propsAt);
  p.x = tmpP.x; p.z = tmpP.z;
  if (wl > 0.1) audio.step();
  const [rx, rz] = roomOf(p.x, p.z, S);
  if (Game.visit(game, f, rx, rz)) markSave();
  world.updateLoaded(f, rx, rz);

  // tool
  const R = Game.toolRadius(game.player);
  const ahead = CFG.tool.ahead + R;
  const toolX = p.x + fwdX * ahead, toolZ = p.z + fwdZ * ahead;
  const [trx, trz] = roomOf(toolX, toolZ, S);
  toolMode = null;
  let active = false;
  if (input.tool && !panel.open) {
    const lx = toolX - trx * S, lz = toolZ - trz * S;
    const evt = Game.toolStep(game, f, trx, trz, lx, lz, dt);
    if (evt) {
      toolMode = evt.mode;
      const v = world.viewFor(f, trx, trz);
      if (evt.mode === 'clear') {
        active = true;
        if (v) { v.syncClutter(evt.cells); v.refreshFloor(); world.spawnFlyers(v, evt.cells, null); }
        audio.clear(evt.units, game.combo, Game.info(game, f, trx, trz).biome.item);
      } else if (evt.mode === 'polish') {
        active = true; if (v) v.refreshFloor(); audio.polish(evt.polished);
      }
      if (evt.finishedClear) { if (v) { v.syncClutter(); v.refreshFloor(); } UI.toast(t('roomCleared')); audio.done(); markSave(); }
      if (evt.finishedPolish) { if (v) v.refreshFloor(); UI.toast(t('roomPolished')); audio.done(); markSave(); }
      if (evt.mode && evt.mode !== 'idle') dirtySave = true;
    }
  }
  Game.tickCombo(game, dt, active);
  world.placeRing(toolX, toolZ, R, toolMode);
  world.ring.visible = !(trx === 0 && trz === 0);
  world.ringFill.visible = world.ring.visible;

  Game.tickIncome(game, Date.now());
  Game.tickRooms(game, dt);
  world.updateFlyers(dt, p.x, CFG.player.eye, p.z);

  // HUD
  const inCabin = rx === 0 && rz === 0;
  if (inCabin) UI.hud(t('hudCabin', { glow: fmt(game.player.glow), rate: fmt(Game.incomeRate(game)) }));
  else {
    const r = Game.room(game, f, rx, rz);
    const c = Math.floor(Game.info(game, f, rx, rz) && (r.clearedDone ? 100 : 100 * (1 - sumC(r) / Math.max(1e-6, r.total))));
    const pol = Math.floor(100 * polishPct(r));
    UI.hud(t('hudRoom', { glow: fmt(game.player.glow), c, p: pol, lit: r.lit ? t('hudLit') : '' }));
  }
  // prompt
  let pr = '';
  const sw = nearSwitch();
  if (sw) {
    const r = Game.room(game, f, sw.rx, sw.rz);
    if (r.lit) pr = t('switchLit');
    else if (!Game.canWire(game, f, sw.rx, sw.rz)) pr = t('switchFar');
    else { const cost = fmt(Game.lampCost(game, f)); pr = t(input.touch ? 'switchBuyTouch' : 'switchBuy', { cost }); }
  } else if (inCabin && !panel.open) pr = t(input.touch ? 'panelOpenTouch' : 'panelOpen');
  UI.prompt(panel.open ? '' : pr);

  // autosave
  saveTimer += dt;
  if (saveTimer >= CFG.autosaveSec) { saveTimer = 0; save(); }

  if (!skipRender) world.frame(dt, { x: p.x, y: CFG.player.eye, z: p.z, yaw: p.yaw, pitch: p.pitch }, s.warmMode);
}
function sumC(r) { let s = 0; for (let k = 0; k < r.c.length; k++) s += r.c[k]; return s; }
function polishPct(r) { if (r.polishedDone) return 1; let s = 0; for (let k = 0; k < r.g.length; k++) s += r.c[k] > 0 ? 0 : 1 - r.g[k]; return s / r.g.length; }

function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (running) { gameTime += dt; frames++; update(dt); }
  requestAnimationFrame(loop);
}

function startScreen() {
  const card = el('div', { class: 'card' },
    el('h1', {}, t('title')),
    el('p', {}, t('tagline')),
    el('p', { class: 'note' }, input.touch ? t('hintTouch') : t('hintDesktop')),
    el('button', { id: 'begin', onclick: begin }, game.player.lifetimeGlow > 0 ? t('continue') : t('start')));
  UI.overlay(card);
}
function begin() {
  UI.overlay(null);
  audio.init(); audio.setVolume(settings().volume);
  running = true; lastFrame = performance.now();
  input.requestLock();
  Game.tickIncome(game, Date.now());
}

async function main() {
  await load();
  UI.localizeButtons();
  world = new World(canvas, game, { mobile: input.touch, fov: settings().fov });
  setupPanel();
  const S = roomSide(game.pos.floor);
  world.updateLoaded(game.pos.floor, ...roomOf(game.pos.x, game.pos.z, S));
  game.lastTs = Date.now();
  startScreen();
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('pagehide', () => save());
  requestAnimationFrame(loop);
  // Test hook: run the real update loop for N seconds of game time without drawing, calling bot() each step.
  const simulate = (secs, bot, dt = 1 / 30) => { skipRender = true; let t = 0; try { while (t < secs) { if (bot && bot()) break; update(dt); gameTime += dt; t += dt; } } finally { skipRender = false; } return t; };
  window.__lift = { simulate, get game() { return game; }, get time() { return gameTime; }, get frames() { return frames; }, world, input, save, Game, panel };
}
main();
