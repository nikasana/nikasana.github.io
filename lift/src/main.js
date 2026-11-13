// Entry point: wires the pure game state to rendering, input, UI, audio and saving.
import { CFG, roomSide, doorWidth } from './config.js';
import * as Game from './game.js';
import * as Econ from './economy.js';
import * as Save from './save.js';
import { t, fmt, setLang } from './strings.js';
import { World } from './render/scene.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { collide, roomOf } from './movement.js';
import * as UI from './ui.js';
import { el } from './ui.js';
import { MapView } from './map.js';

const canvas = document.getElementById('c');
const input = new Input(canvas);
if (input.touch) document.body.classList.add('touch');
const audio = new Audio();
const panel = new UI.Panel();
const map = new MapView(document.getElementById('map'));
const SAVE_KEY = 'main';

let game, world;
let gameTime = 0, frames = 0;
let running = false, lastFrame = performance.now(), saveTimer = 0, dirtySave = false;
const vel = { x: 0, z: 0 };
let toolMode = null;

const settings = () => game.settings;
const defaults = { fov: 75, sens: 1, volume: 0.7, music: 0.6, warmMode: false, authorNotes: false, lang: null, quality: 'auto' };
let autoLevel = 0, fpsAcc = 0, fpsN = 0, fpsT = 0, autoCooldown = 6;

async function load() {
  let data = null;
  try { data = await Save.get(SAVE_KEY); } catch (e) { console.warn('save unavailable', e); }
  if (data) { try { game = Game.deserialize(data); } catch (e) { console.warn('bad save', e); } }
  if (!game) { game = Game.newGame((Math.random() * 2 ** 32) >>> 0); game.pos = { floor: 0, x: 0, y: 0, z: 0.8, yaw: 0, pitch: 0 }; }
  game.settings = { ...defaults, ...game.settings };
  setLang(game.settings.lang || (navigator.language || 'en').slice(0, 2));
}

async function save() {
  if (window.__liftNoSave) return; // test hook
  try { game.lastTs = Date.now(); await Save.put(SAVE_KEY, Game.serialize(game)); dirtySave = false; } catch (e) { console.warn('save failed', e); }
}
function markSave() { dirtySave = true; }

// ---------- doors / props for collision ----------
function blocked(rx, rz, side) { return Game.edgeBlocked(game, game.pos.floor, rx, rz, side); }
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
function nearSealed() {
  const f = game.pos.floor, S = roomSide(f);
  const [rx, rz] = roomOf(game.pos.x, game.pos.z, S);
  for (let side = 0; side < 4; side++) {
    const [dx, dz] = Game.SIDE_DIR[side];
    const nx = rx + dx, nz = rz + dz;
    if (!Game.isSealed(game, f, nx, nz)) continue;
    const cx = rx * S + dx * S / 2, cz = rz * S + dz * S / 2;
    if (Math.hypot(game.pos.x - cx, game.pos.z - cz) < 2.0) return { x: nx, z: nz };
  }
  return null;
}
function interact() {
  const sealed = nearSealed();
  if (sealed) {
    const res = Game.openSealed(game, game.pos.floor, sealed.x, sealed.z);
    if (res.ok) { audio.lamp(); UI.toast(t('sealedOpened')); markSave(); save(); } else audio.deny();
    return;
  }
  const sw = nearSwitch();
  if (sw) {
    const res = Game.buyLamp(game, game.pos.floor, sw.rx, sw.rz);
    if (res.ok) {
      audio.lamp(); UI.toast(t('roomLit')); markSave(); save();
      if (Game.checkFloorUnlock(game, game.pos.floor)) { UI.toast(t('floorOpen', { n: game.house.maxFloor })); audio.bell(); }
    } else audio.deny();
    return;
  }
  if (nearConsole()) openPanel();
}
function openPanel(tab) { input.exitLock(); panel.show(tab); }
function goHome() {
  game.pos.x = 0; game.pos.z = 0.8; game.pos.yaw = 0; vel.x = vel.z = 0;
  audio.whoosh();
}
function rideTo(f) {
  if (f === game.pos.floor || !Game.travel(game, f)) return;
  vel.x = vel.z = 0; audio.bell(); panel.hide();
  UI.toast(t('floorArrive', { n: f }));
  Game.pruneRooms(game, f, 0, 0, 0);
  markSave(); save();
}

function setupPanel() {
  panel.setTabs([
    { id: 'upgrades', label: () => t('tabUpgrades'), render: renderUpgrades },
    { id: 'helpers', label: () => t('tabHelpers'), render: renderHelpers },
    { id: 'floors', label: () => t('tabFloors'), render: renderFloors },
    { id: 'catalog', label: () => t('tabCatalog'), render: renderCatalog },
    { id: 'settings', label: () => t('tabSettings'), render: renderSettings },
  ], renderTop);
  panel.onClose = () => { if (!input.touch && running) input.requestLock(); };
}

function renderTop(top) {
  const f = game.pos.floor, fl = Game.floorState(game, f);
  top.append(el('span', {}, el('b', {}, t('topGlow', { glow: fmt(game.player.glow) }))), el('span', {}, t('topRate', { rate: fmt(Game.incomeRate(game)) })),
    el('span', {}, t('topFloor', { n: f }) + ' · ' + t('topRank', { n: fl.rank })));
  if (game.player.rested) top.append(el('span', {}, t('topRested', { n: game.player.rested })));
}
const fmtEff = (id, v) => (id === 'power' || id === 'speed' ? fmt(v) : id === 'reach' || id === 'shine' ? v.toFixed(2) : String(v));
function renderUpgrades(body, rerender) {
  const p = game.player, f = game.pos.floor;
  for (const [track, ids] of Object.entries(Econ.TRACKS)) {
    const tl = Game.trackLevel(p, track);
    body.append(el('h3', {}, `${t('track_' + track)} · ${t('trackLevel', { n: tl })} · ${tl >= CFG.ability.unlockLevel ? t('abilityReady') : t('abilityAt', { n: CFG.ability.unlockLevel })}`));
    for (const id of ids) {
      const lvl = p.upgrades[id], cost = Econ.upgradeCost(id, lvl);
      const a = fmtEff(id, Econ.upgradeEffect(id, lvl, f)), b = fmtEff(id, Econ.upgradeEffect(id, lvl + 1, f));
      body.append(el('div', { class: 'row' },
        el('div', { class: 'grow' }, el('div', { class: 'name' }, `${t('up_' + id)} · ${t('lvl', { n: lvl })}`), el('div', { class: 'flav' }, t('fl_' + id)), el('div', { class: 'sub' }, t('ef_' + id, { a, b }))),
        el('button', { class: 'buy', disabled: p.glow < cost, onclick: () => { if (Econ.buyUpgrade(game, id).ok) { audio.buy(); markSave(); save(); rerender(); } } }, t('buyFor', { cost: fmt(cost) }))));
    }
  }
  body.append(el('p', { class: 'note' }, t('balanceNote', { pct: Math.round(CFG.balanceBonus * 100 * Game.lowestTrack(p)) })));
}
function renderHelpers(body, rerender) {
  const p = game.player, pipe = Econ.pipeline(game);
  body.append(el('p', { class: 'note' }, pipe.bottleneck ? t('pipeInfo', { rate: pipe.cellsPerSec.toFixed(1) }) + ' ' + t('pipeNeck', { name: t('h_' + pipe.bottleneck) }) : t('pipeIdle')));
  for (const k of Econ.HELPERS) {
    const n = p.helpers[k], cost = Econ.helperCost(k, n);
    body.append(el('div', { class: 'row' },
      el('div', { class: 'grow' }, el('div', { class: 'name' }, `${t('h_' + k)} ×${n}` + (pipe.bottleneck === k ? '  ◂' : '')), el('div', { class: 'sub' }, t('hd_' + k))),
      el('button', { class: 'buy', disabled: p.glow < cost, onclick: () => { if (Econ.buyHelper(game, k).ok) { audio.buy(); markSave(); save(); rerender(); } } }, t('buyFor', { cost: fmt(cost) }))));
  }
  body.append(el('p', { class: 'note' }, t('auraNote')));
}
function renderFloors(body) {
  for (let f = 0; f <= game.house.maxFloor + 1; f++) {
    const open = Game.floorUnlocked(game, f), fl = Game.floorState(game, f);
    const here = f === game.pos.floor;
    body.append(el('div', { class: 'row' },
      el('div', { class: 'grow' }, el('div', { class: 'name' }, t('floorName', { n: f }) + (here ? ' · ' + t('floorHere') : '')),
        el('div', { class: 'sub' }, open ? t('floorInfo', { lit: fl.litCount, size: roomSide(f) }) : t('floorLocked'))),
      el('button', { class: 'buy', disabled: !open || here, onclick: () => rideTo(f) }, t('floorGo'))));
  }
  const fl = Game.floorState(game, game.house.maxFloor);
  if (!Game.floorUnlocked(game, game.house.maxFloor + 1)) body.append(el('p', { class: 'note' }, t('floorNext', { lit: fl.litCount })));
}
function renderCatalog(body) {
  const cat = game.player.catalog;
  body.append(el('p', { class: 'note' }, t('catalogInfo', { n: cat.length, pct: cat.length })));
  if (!cat.length) body.append(el('p', { class: 'note' }, t('catalogEmpty')));
  for (const id of cat) body.append(el('span', { class: 'chip' }, t('cat_' + id.replace(':', '_'))));
}

function applyQuality() {
  const q = settings().quality;
  const lvl = q === 'auto' ? (autoLevel || (input.touch ? CFG.autoQuality.mobile : CFG.autoQuality.desktop)) : +q;
  if (q === 'auto') autoLevel = lvl;
  if (world.level !== lvl) world.setQuality(lvl);
}
function renderSettings(body, rerender) {
  const s = settings();
  const qsel = el('select', { onchange: (e) => { s.quality = e.target.value; autoLevel = 0; applyQuality(); markSave(); } },
    el('option', { value: 'auto', selected: s.quality === 'auto' }, t('qAuto', { n: world.level })),
    [1, 2, 3, 4, 5].map((n) => el('option', { value: String(n), selected: String(s.quality) === String(n) }, t('q' + n))));
  body.append(el('label', { class: 'set' }, t('graphics'), qsel), el('p', { class: 'note' }, t('graphicsNote')));
  const range = (key, label, min, max, step, apply) => el('label', { class: 'set' }, label,
    el('input', { type: 'range', min, max, step, value: s[key], oninput: (e) => { s[key] = +e.target.value; apply && apply(); markSave(); } }));
  const check = (key, label, apply) => el('label', { class: 'set' }, label,
    el('input', { type: 'checkbox', checked: s[key] ? true : false, onchange: (e) => { s[key] = e.target.checked; apply && apply(); markSave(); } }));
  const ta = el('textarea', { placeholder: t('importPrompt') });
  body.append(
    range('fov', t('fov'), 55, 100, 1),
    range('sens', t('sensitivity'), 0.3, 2.5, 0.05),
    range('volume', t('volume'), 0, 1, 0.05, () => audio.setVolume(s.volume)),
    range('music', t('music'), 0, 1, 0.05, () => audio.setMusic(s.music)),
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
    if (map.open && (e.code === 'Escape' || e.code === 'KeyM')) { map.toggle(false); continue; }
    switch (e.code) {
      case 'KeyE': interact(); break;
      case 'KeyH': goHome(); break;
      case 'KeyM': map.toggle(); break;
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
  const sliding = !panel.open && input.slide && canSlide(p, f, S);
  const speed = Game.walkSpeed(f) * (sliding ? CFG.player.slideMult : 1);
  const tx = wx * speed, tz = wz * speed;
  const onGloss = canSlide(p, f, S);
  const a = Math.min(1, (sliding ? 2.2 : onGloss && wl < 0.1 ? CFG.player.slideFriction : CFG.player.accel) * dt);
  if (sliding && Math.hypot(vel.x, vel.z) > 1) audio.slide();
  vel.x += (tx - vel.x) * a; vel.z += (tz - vel.z) * a;
  tmpP.x = p.x + vel.x * dt; tmpP.z = p.z + vel.z * dt;
  collide(tmpP, S, blocked, propsAt);
  p.x = tmpP.x; p.z = tmpP.z;
  if (wl > 0.1) audio.step();
  const [rx, rz] = roomOf(p.x, p.z, S);
  const vis = Game.visit(game, f, rx, rz);
  if (vis) { markSave(); if (vis.catalog) { UI.toast(t('catalogNew', { name: t('cat_' + vis.catalog.replace(':', '_')) })); audio.rare(); } }
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
      if (evt.rare) { const id = 'find:' + evt.rare; if (Game.addCatalog(game, id)) { UI.toast(t('catalogNew', { name: t('cat_find_' + evt.rare) })); audio.rare(); } }
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
  Game.tickDoors(game, dt);
  const hw = Econ.tickHelpers(game, dt, f, rx, rz, auraRadius());
  if (hw.cells) for (const k of hw.touched) { const v = world.views.get(k); if (v) { v.syncClutter(); v.refreshFloor(); } }
  panelT += dt; if (panel.open && panelT > 0.5 && panel.cur !== 'settings') { panelT = 0; panel.refresh(); }
  for (const v of world.views.values()) {
    const { x, z } = v.info;
    v.setDoors([0, 1, 2, 3].map((sd) => Game.edgeBlocked(game, f, x, z, sd)));
  }
  pruneT += dt; if (pruneT > 5) { pruneT = 0; Game.pruneRooms(game, f, rx, rz); }
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
  const sw = nearSwitch(), sealed = nearSealed();
  if (sealed) pr = t(input.touch ? 'sealedOpenTouch' : 'sealedOpen', { cost: fmt(Game.sealCost(f)) });
  else if (sw) {
    const r = Game.room(game, f, sw.rx, sw.rz);
    if (r.lit) pr = t('switchLit');
    else if (!Game.canWire(game, f, sw.rx, sw.rz)) pr = t('switchFar');
    else { const cost = fmt(Game.lampCost(game, f)); pr = t(input.touch ? 'switchBuyTouch' : 'switchBuy', { cost }); }
  } else if (inCabin && !panel.open) pr = t(input.touch ? 'panelOpenTouch' : 'panelOpen');
  UI.prompt(panel.open ? '' : pr);

  // autosave
  saveTimer += dt;
  if (saveTimer >= CFG.autosaveSec) { saveTimer = 0; save(); }

  map.draw(game);
  if (audio.music) {
    musicAct += ((active ? 1 : 0) - musicAct) * Math.min(1, dt * 0.5);
    audio.music.setBiome(Game.info(game, f, rx, rz).biome.id);
    audio.music.setState({ activity: musicAct, quiet: Game.floorState(game, f).quiet ? 1 : 0, warmth: Game.room(game, f, rx, rz).lit ? 1 : 0 });
  }
  autoQuality(dt);
  if (!skipRender) world.frame(dt, { x: p.x, y: CFG.player.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: s.fov }, s.warmMode);
}
let pruneT = 0, musicAct = 0, panelT = 0;
function auraRadius() { return 0; }
function canSlide(p, f, S) {
  const [rx, rz] = roomOf(p.x, p.z, S);
  const r = Game.room(game, f, rx, rz);
  if (!r.lit) return false;
  const cell = S / CFG.grid;
  const i = Math.floor((p.x - rx * S + S / 2) / cell), j = Math.floor((p.z - rz * S + S / 2) / cell);
  if (i < 0 || j < 0 || i >= CFG.grid || j >= CFG.grid) return true;
  const k = j * CFG.grid + i;
  return r.c[k] <= 0 && r.g[k] < 0.25;
}
// Auto graphics: step down when the frame rate stays under target.
function autoQuality(dt) {
  if (skipRender || settings().quality !== 'auto') return;
  autoCooldown -= dt; fpsAcc += dt; fpsN++;
  if (fpsAcc < CFG.autoQuality.window) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  const low = input.touch ? CFG.autoQuality.lowFpsMobile : CFG.autoQuality.lowFps;
  if (autoCooldown <= 0 && fps < low && world.level > 1) { autoLevel = world.level - 1; world.setQuality(autoLevel); autoCooldown = 6; }
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

function awayCard(away) {
  if (!away || away.secs < 60) return null;
  const h = away.secs / 3600;
  const time = h >= 1 ? t('hours', { n: h.toFixed(1) }) : t('minutes', { n: Math.round(away.secs / 60) });
  return el('div', { class: 'note' }, el('h3', {}, t('welcomeBack')), el('div', {}, t('awayFor', { time })), el('div', {}, t('awayGlow', { glow: fmt(away.glow) })),
    away.rooms ? el('div', {}, t('awayRooms', { n: away.rooms })) : null, away.rested ? el('div', {}, t('awayRested', { n: game.player.rested })) : null,
    away.waveReady ? el('div', {}, t('awayWave')) : null);
}
function startScreen(away) {
  const card = el('div', { class: 'card' },
    el('h1', {}, t('title')),
    el('p', {}, t('tagline')),
    el('p', { class: 'note' }, input.touch ? t('hintTouch') : t('hintDesktop')),
    awayCard(away),
    el('button', { id: 'begin', onclick: begin }, game.player.lifetimeGlow > 0 ? t('continue') : t('start')));
  UI.overlay(card);
}
function begin() {
  UI.overlay(null);
  audio.musicVol = settings().music; audio.init(); audio.setVolume(settings().volume);
  running = true; lastFrame = performance.now();
  input.requestLock();
  Game.tickIncome(game, Date.now());
}

async function main() {
  await load();
  UI.localizeButtons();
  const q0 = settings().quality === 'auto' ? (input.touch ? CFG.autoQuality.mobile : CFG.autoQuality.desktop) : +settings().quality;
  autoLevel = q0;
  world = new World(canvas, game, { mobile: input.touch, fov: settings().fov, quality: q0 });
  for (const id of ['bMap', 'bSlide']) document.getElementById(id).classList.remove('locked');
  setupPanel();
  const S = roomSide(game.pos.floor);
  world.updateLoaded(game.pos.floor, ...roomOf(game.pos.x, game.pos.z, S));
  const away = Econ.applyOffline(game, Date.now());
  startScreen(away);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('pagehide', () => save());
  requestAnimationFrame(loop);
  // Test hook: run the real update loop for N seconds of game time without drawing, calling bot() each step.
  const simulate = (secs, bot, dt = 1 / 30) => { skipRender = true; let t = 0; try { while (t < secs) { if (bot && bot()) break; update(dt); gameTime += dt; t += dt; } } finally { skipRender = false; } return t; };
  const renderBench = (n) => { const p = game.pos; const t0 = performance.now(); for (let i = 0; i < n; i++) world.frame(1 / 60, { x: p.x, y: CFG.player.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: settings().fov }, false); world.renderer.getContext().finish(); return (performance.now() - t0) / n; };
  window.__lift = { simulate, renderBench, get game() { return game; }, get time() { return gameTime; }, get frames() { return frames; }, world, input, save, Game, panel, map };
}
main();
