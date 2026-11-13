// Entry point: wires the pure game state to rendering, input, UI, audio and saving.
import { CFG, roomSide, doorWidth } from './config.js';
import * as Game from './game.js';
import * as Econ from './economy.js';
import * as Tide from './tide.js';
import { TideFX } from './render/tidefx.js';
import * as So from './sorties.js';
import * as Signs from './signs.js';
import * as Gad from './gadgets.js';
import { SignFX } from './render/signfx.js';
import * as Act from './action.js';
import * as Long from './longgame.js';
import { Net, parseHash, applyRoom, sharedSave, houseOf } from './net.js';
import * as R from './roomstate.js';
import { OthersFX } from './render/others.js';
import * as Save from './save.js';
import { t, fmt, setLang, getLang, detectLang, LANGS } from './strings.js';
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
// ?profile=name keeps a separate save slot (several players on one machine, and tests).
const SAVE_KEY = 'main' + (new URLSearchParams(location.search).get('profile') ? ':' + new URLSearchParams(location.search).get('profile') : '');

let game, world, tidefx, signfx;
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
  setLang(game.settings.lang || detectLang());
  applyLangToPage();
}

// Saves run one after another, so the newest state always lands last.
let saveChain = Promise.resolve();
function save() { saveChain = saveChain.then(saveNow, saveNow); return saveChain; }
async function saveNow() {
  if (window.__liftNoSave) return; // test hook
  try {
    game.lastTs = Date.now();
    const mine = ownHouse ? { ...game, house: ownHouse.house, rooms: ownHouse.rooms, pos: ownHouse.pos, tide: null } : game;
    await Save.put(SAVE_KEY, Game.serialize(mine));
    if (net && net.alive) await Save.put('shared:' + net.code, { ...sharedSave(game), code: net.code, at: Date.now() });
    dirtySave = false;
  } catch (e) { console.warn('save failed', e); }
}
function markSave() { dirtySave = true; }
function applyLangToPage() { document.documentElement.lang = getLang(); document.title = t('title'); UI.localizeButtons(); }

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
function nearDoor() {
  if (!game.tide || game.tide.result) return null;
  const f = game.pos.floor, S = roomSide(f);
  const [rx, rz] = roomOf(game.pos.x, game.pos.z, S);
  for (let side = 0; side < 4; side++) {
    const [dx, dz] = Game.SIDE_DIR[side];
    const cx = rx * S + dx * S / 2, cz = rz * S + dz * S / 2;
    if (Math.hypot(game.pos.x - cx, game.pos.z - cz) < 1.8 && !Game.edgeBlocked(game, f, rx, rz, side)) return { rx, rz, side };
  }
  return null;
}
function interact() {
  const an = nearAnchor();
  if (an) { const a = Signs.takeAnchor(game, game.pos.floor, an.rx, an.rz); if (a) { if (net) net.anchor(game.pos.floor, a.x, a.z, a.kind); UI.toast(t('anchorFound', { name: t('an_' + a.kind), habit: t('hb_' + a.kind) })); audio.rare(); refreshSigns(); markSave(); save(); } return; }
  const door = nearDoor();
  if (door) { Game.shutDoor(game, game.pos.floor, door.rx, door.rz, door.side, CFG.tide.doorHold); if (net) net.door(game.pos.floor, door.rx, door.rz, door.side, CFG.tide.doorHold); audio.tone(196, 0.3, 'square', 0.06); audio.burst(0.15, 300, 0.12, 1); return; }
  const sealed = nearSealed();
  if (sealed) {
    const res = Game.openSealed(game, game.pos.floor, sealed.x, sealed.z);
    if (res.ok) { audio.lamp(); UI.toast(t('sealedOpened')); markSave(); save(); } else audio.deny();
    return;
  }
  const sw = nearSwitch();
  if (sw) {
    if (Game.room(game, game.pos.floor, sw.rx, sw.rz).lit) {
      const b = Act.boostLamp(game, game.pos.floor, sw.rx, sw.rz);
      if (b.ok) { if (net && !net.isHost()) net.boost(sw.rx, sw.rz, 0.3); audio.lamp(); UI.toast(t('lampBoosted')); const v = world.viewFor(game.pos.floor, sw.rx, sw.rz); if (v) v.lampBoost = 1.8; } else audio.deny();
      return;
    }
    const res = Game.buyLamp(game, game.pos.floor, sw.rx, sw.rz);
    if (res.ok) Act.flowStep(game, 0, 'light');
    if (res.ok) {
      audio.lamp(); UI.toast(t('roomLit')); markSave(); save(); if (net) net.lamp(`${game.pos.floor}:${sw.rx}:${sw.rz}`);
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
  if (game.sortie && game.sortie.state === 'extract') sortiePaid(So.finish(game, false));
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
    { id: 'sorties', label: () => t('tabSorties'), render: renderSorties },
    { id: 'gadgets', label: () => t('tabGadgets'), render: renderGadgets },
    { id: 'floors', label: () => t('tabFloors'), render: renderFloors },
    { id: 'anchors', label: () => t('tabAnchors'), render: renderAnchors },
    { id: 'diary', label: () => t('tabDiary'), render: renderDiary },
    { id: 'catalog', label: () => t('tabCatalog'), render: renderCatalog },
    { id: 'together', label: () => t('tabTogether'), render: renderTogether },
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
function renderTide(body) {
  const f = game.pos.floor, fl = Game.floorState(game, f), n = Tide.wavesOnFloor(f), m = Tide.meters(game, f);
  body.append(el('h3', {}, t('tideTitle') + ' · ' + t('floorName', { n: f })),
    el('div', { class: 'sub' }, t('noise', { n: Tide.noiseFor(game, f) }) + ' · ' + t('wavesHeld', { a: fl.waves, b: n })),
    el('div', { class: 'bar' }, el('i', { style: `width:${100 - Tide.noiseFor(game, f)}%` })),
    el('p', { class: 'note' }, t('rankLine', { r: fl.rank, c: m.clear, p: m.polish, l: m.light, n: Tide.ROOMS_PER_RANK })));
  if (fl.quiet) { body.append(el('p', { class: 'note' }, t('floorQuiet'))); return; }
  const fc = Tide.forecast(game, f, net ? net.players() : 1);
  const P = Math.round(fc.pressure * 100), Sg = Math.round(fc.held * 100);
  body.append(el('div', { class: 'row' }, el('div', { class: 'grow' },
    el('div', { class: 'name' }, fc.great ? t('greatTide') : t('waveName', { k: fc.k, n })),
    el('div', { class: 'sub ' + fc.mood }, t('forecast', { p: P, s: Sg, mood: t('mood_' + fc.mood) })),
    el('div', { class: 'sub' }, t('frontsLine', { list: frontSides(fc).map((i) => t('side_' + i)).join(', ') })),
    fc.open.length ? el('div', { class: 'sub hard' }, t('openSides', { list: fc.open.map((i) => t('side_' + i)).join(', ') })) : null,
    !fc.unlocked ? el('div', { class: 'sub' }, t('waveLocked', { k: fc.k })) : null),
    el('button', { class: 'buy', disabled: !fc.unlocked || !!(game.tide && !game.tide.result) || (net && !net.isHost()), onclick: () => callWave() }, t('callWave'))));
  body.append(el('p', { class: 'note' }, t('randomTideLine')));
}
function frontSides(fc) {
  if (fc.fronts === 4) return [0, 1, 2, 3];
  const terr = []; for (const [k, r] of game.rooms) { const [rf, x, z] = k.split(':').map(Number); if (rf === game.pos.floor && r.lit && (x || z)) terr.push([x, z]); }
  return Tide.sideOrder(terr).slice(0, fc.fronts);
}
function callWave(opts = {}) {
  const w = Tide.startWave(game, game.pos.floor, { players: net ? net.players() : 1, ...opts });
  panel.hide();
  if (w.result === 'bounced') { tideEnded(w); return; }
  UI.toast(t('tideComing', { dir: w.fronts.map((fr) => t('side_' + fr.side)).join(', ') }));
  audio.bell();
}
const tideHooks = {
  onContact: (l, x, z) => tidefx && tidefx.onContact(l, x, z, Game.room(game, game.pos.floor, x, z).lit),
  onFlood: (x, z) => { if (net) net.send({ t: 'room', key: `${game.pos.floor}:${x}:${z}`, mode: 'set', r: packRoom(Game.room(game, game.pos.floor, x, z)) }); const v = world.viewFor(game.pos.floor, x, z); if (v) v.syncClutter(); if (v) v.refreshFloor(); UI.toast(t('tideFlood')); audio.tone(130, 0.8, 'sine', 0.1); },
  onEnd: (w) => tideEnded(w),
};
function packRoom(r) { return { c: Array.from(r.c, (v) => Math.min(255, Math.round(v * 40))), g: Array.from(r.g, (v) => Math.round(v * 255)), l: r.lit ? 1 : 0, f: r.flags, cd: r.clearedDone ? 1 : 0, pd: r.polishedDone ? 1 : 0, t: r.total, v: r.visited ? 1 : 0 }; }
function tideEnded(w) {
  if (net && net.isHost()) for (const [x, z] of w.flooded) net.send({ t: 'room', key: `${w.f}:${x}:${z}`, mode: 'set', r: packRoom(Game.room(game, w.f, x, z)) });
  if (tidefx) tidefx.onEnd(w);
  for (const v of world.views.values()) { v.syncClutter(); v.refreshFloor(); }
  if (w.kind === 'wave') {
    if (w.result === 'held') UI.toast(t(w.rested ? 'tideHeldRested' : 'tideHeld', { glow: fmt(w.reward) }));
    else if (w.result === 'bounced') UI.toast(t('tideBounced', { glow: fmt(w.reward) }));
    else UI.toast(t('tideLost'));
    if (w.quiet) { UI.toast(t('floorQuietNow')); UI.toast(t('floorOpen', { n: game.house.maxFloor })); audio.done(); }
  }
  if (w.result !== 'lost') audio.done();
  tideClearT = 5; markSave(); save();
}
function sortieName(o) { return t('so_' + o.type); }
function sortieDesc(o) {
  if (o.type === 'haul') return t('sod_haul', { n: o.goal, mat: t('mat_' + o.mat) });
  if (o.type === 'deep') return t('sod_deep', { a: o.floors[0], b: o.floors[1], c: o.floors[2] });
  return t('sod_' + o.type, { n: o.goal });
}
const riskSel = {};
function renderSorties(body, rerender) {
  const f = game.pos.floor, so = game.sortie;
  if (so) {
    body.append(el('div', { class: 'row' }, el('div', { class: 'grow' },
      el('div', { class: 'name' }, t('sortieActive', { name: sortieName(so), p: so.progress, g: so.goal })), el('div', { class: 'sub' }, sortieDesc(so)), el('div', { class: 'sub' }, t('mut_' + so.mutator))),
      el('button', { class: 'plain', onclick: () => { So.abandon(game); rerender(); } }, t('abandon'))));
    return;
  }
  for (const o of So.board(game, f)) {
    const r = riskSel[o.id] || 1;
    const pay = Math.round(o.reward * So.riskMult(r) * (So.MUT[o.mutator].reward || 1));
    const risk = el('select', { onchange: (e) => { riskSel[o.id] = +e.target.value; rerender(); } }, [1, 2, 3, 4, 5].map((n) => el('option', { value: n, selected: n === r }, t('risk', { n }))));
    const quietF = Game.floorState(game, f).quiet, loud = quietF && riskSel['loud' + o.id];
    body.append(el('div', { class: 'row' }, el('div', { class: 'grow' },
      el('div', { class: 'name' }, `${sortieName(o)} · ${t('act_' + o.action)}`), el('div', { class: 'sub' }, sortieDesc(o)), el('div', { class: 'sub' }, t('mut_' + o.mutator)),
      el('div', { class: 'sub' }, t('reward', { glow: fmt(pay * (loud ? 2 : 1)) }) + ' · ', risk),
      quietF ? el('label', { class: 'sub' }, el('input', { type: 'checkbox', checked: !!loud, onchange: (e) => { riskSel['loud' + o.id] = e.target.checked; rerender(); } }), ' ' + t('loud')) : null),
      el('button', { class: 'buy', onclick: () => { So.start(game, o, r, loud); UI.toast(t('sortieStarted', { name: sortieName(o) })); audio.bell(); markSave(); save(); panel.hide(); } }, t('startSortie'))));
  }
  body.append(el('p', { class: 'note' }, t('riskNote', { m: So.riskMult(5).toFixed(1) })));
}
function renderGadgets(body, rerender) {
  const p = game.player;
  body.append(el('h3', {}, t('materials')), el('p', { class: 'note' }, Object.entries(p.materials).map(([m, n]) => `${t('mat_' + m)} ${fmt(n)}`).join(' · ')));
  for (const [mat, g] of Object.entries(So.GADGETS)) {
    const sel = settings().gadget === g;
    body.append(el('div', { class: 'row' }, el('div', { class: 'grow' },
      el('div', { class: 'name' }, `${t('g_' + g)} ${t('owned', { n: p.gadgets[g] || 0 })}` + (sel ? ' · ' + t('selected') : '')), el('div', { class: 'sub' }, t('gd_' + g))),
      el('button', { class: 'plain', onclick: () => { settings().gadget = g; rerender(); } }, t('select')),
      el('button', { class: 'buy', disabled: (p.materials[mat] || 0) < So.gadgetCost(), onclick: () => { if (So.buyGadget(game, mat)) { audio.buy(); markSave(); rerender(); } } }, t('gadgetBuy', { n: So.gadgetCost(), mat: t('mat_' + mat) }))));
  }
}
function useAbility(id) {
  if (!Act.unlocked(game, id)) return;
  if (!Act.ready(game, id)) { audio.deny(); return; }
  const f = game.pos.floor, S = roomSide(f);
  if (id === 'dash') {
    const d = Act.dash(game);
    // move with collision in small steps
    const steps = 12; const sx = game.pos.x, sz = game.pos.z;
    for (let i = 1; i <= steps; i++) { tmpP.x = game.pos.x + (d.tx - sx) / steps; tmpP.z = game.pos.z + (d.tz - sz) / steps; collide(tmpP, S, blocked, propsAt); game.pos.x = tmpP.x; game.pos.z = tmpP.z; }
    for (const k of d.rooms) { const [x, z] = k.split(':').map(Number); const v = world.viewFor(f, x, z); if (v) { v.syncClutter(); v.refreshFloor(); } }
    world.fovKick = 18; hitStop = 0.07; audio.whoosh(); audio.clear(d.units, 2, Game.info(game, f, ...roomOf(game.pos.x, game.pos.z, S)).biome.item);
  } else if (id === 'gloss') {
    Act.gloss(game); audio.burst(0.6, 5000, 0.08, 2); world.fovKick = 6;
  } else if (id === 'flash') {
    const r = Act.flash(game);
    for (const [x, z] of r.pulsed) { const v = world.viewFor(f, x, z); if (v) v.lampBoost = 2.2; }
    hitStop = 0.06; audio.lamp(); audio.sparks(5);
  }
  Act.flowStep(game, 0, id === 'dash' ? 'clear' : id === 'gloss' ? 'polish' : 'light');
}
function useGadget() {
  const g = settings().gadget || 'glowstick';
  const res = Gad.use(game, g);
  if (res.ok) { audio.whoosh(); UI.toast(res.returned ? t('bookmarkBack') : t('gadgetUsed', { name: t('g_' + g) })); if (g === 'plane' || g === 'glowstick') map.draw(game); markSave(); }
  else { audio.deny(); UI.toast(res.why === 'unlit' ? t('sproutNeedsLight') : t('gadgetNone', { name: t('g_' + g) })); }
}
function cycleGadget(d) { const o = Gad.GADGET_ORDER, i = o.indexOf(settings().gadget || 'glowstick'); settings().gadget = o[(i + d + o.length) % o.length]; UI.toast(t('g_' + settings().gadget)); }
function nearAnchor() {
  const f = game.pos.floor, S = roomSide(f); const [rx, rz] = roomOf(game.pos.x, game.pos.z, S);
  const v = world.viewFor(f, rx, rz); if (!v || !v.anchorMesh) return null;
  const ax = rx * S + v.anchorMesh.position.x, az = rz * S + v.anchorMesh.position.z;
  return Math.hypot(game.pos.x - ax, game.pos.z - az) < 2 ? { rx, rz, kind: v.anchor.kind } : null;
}
let sharedList = null;
function renderTogether(body, rerender) {
  body.append(el('p', { class: 'note' }, t('coopNote')));
  if (net && net.alive) {
    body.append(el('p', {}, t('coopPlayers', { n: net.players() })));
    if (net.isHost()) {
      const link = net.link();
      body.append(el('p', { class: 'sub' }, t('coopLink')), el('textarea', { readonly: true }, link),
        el('button', { class: 'plain', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(link); UI.toast(t('coopCopied')); } }, t('coopCopy')));
    } else body.append(el('p', { class: 'note' }, t('coopGuestWave')));
    body.append(el('p', {}), el('button', { class: 'plain', onclick: () => { leaveCoop(); rerender(); } }, t('coopLeave')));
    return;
  }
  body.append(el('button', { class: 'buy', onclick: async () => { await startHost(); rerender(); } }, t('coopHost')));
  body.append(el('h3', {}, t('coopShared')));
  if (!sharedList) { Save.keys().then((ks) => { sharedList = ks.filter((k) => String(k).startsWith('shared:')).map((k) => k.slice(7)); rerender(); }); return; }
  if (!sharedList.length) body.append(el('p', { class: 'note' }, t('coopNone')));
  for (const code of sharedList) body.append(el('div', { class: 'row' }, el('div', { class: 'grow' }, code), el('button', { class: 'plain', onclick: async () => { await hostShared(code); rerender(); } }, t('coopHostShared'))));
}
const netHooks = {
  getGame: () => game,
  setHouse: (house, rooms) => enterHouse(house, rooms),
  onRoom: (key) => { const [f, x, z] = key.split(':').map(Number); const v = world.viewFor(f, x, z); if (v) { v.syncClutter(); v.refreshFloor(); } },
  onPing: (x, z, c) => { signfx.ping(x, z, THREE_Color(c)); audio.chime(4); },
  onAnchor: (kind) => { UI.toast(t('anchorFound', { name: t('an_' + kind), habit: t('hb_' + kind) })); audio.rare(); },
  onPeers: () => { panel.refresh(); },
  onFail: (e) => { UI.toast(String(e && e.message) === 'full' ? t('coopFull') : t('coopFail')); restoreOwnHouse(); net = null; },
};
function THREE_Color(c) { const h = Math.floor(c * 360); return `hsl(${h},70%,75%)`; }
// Swap in a shared house, keeping your own player; your own house waits in your save.
function enterHouse(house, rooms) {
  if (!ownHouse) ownHouse = { house: game.house, rooms: game.rooms, pos: { ...game.pos } };
  game.house = { ...house, floors: { ...house.floors } };
  for (const f of Object.keys(game.house.floors)) game.house.floors[f] = { ...Game.newFloor(), ...game.house.floors[f] };
  game.rooms = new Map(); game.infos = new Map(); game.tide = null; game.sortie = null; game.mods = {};
  for (const [k, p] of Object.entries(rooms || {})) applyRoom(game, k, p, 'set');
  Game.recomputeAll(game);
  game.pos = { floor: 0, x: 0, y: 0, z: 0.8, yaw: 0, pitch: 0 };
  world.setGame(game); tidefx && tidefx.clear();
  UI.toast(t('coopJoined'));
}
function restoreOwnHouse() {
  if (!ownHouse) return;
  game.house = ownHouse.house; game.rooms = ownHouse.rooms; game.infos = new Map(); game.pos = ownHouse.pos; game.tide = null;
  ownHouse = null; Game.recomputeAll(game); world.setGame(game); tidefx && tidefx.clear();
}
async function startHost(code) {
  net = new Net(netHooks);
  try { const local = !!(parseHash() || {}).local || !!window.__liftLocalNet; await net.hostRoom(code, local); history.replaceState(null, '', '#room=' + net.code + (local ? '&local=1' : '')); save(); }
  catch (e) { netHooks.onFail(e); }
}
async function hostShared(code) {
  const blob = await Save.get('shared:' + code);
  if (!blob) return;
  const rooms = {}; for (const [k, ro] of Object.entries(blob.rooms)) { const r = R.deserializeRoom(ro); rooms[k] = { c: Array.from(r.c, (v) => Math.round(v * 40)), g: Array.from(r.g, (v) => Math.round(v * 255)), l: r.lit ? 1 : 0, f: r.flags, cd: r.clearedDone ? 1 : 0, pd: r.polishedDone ? 1 : 0, t: r.total, v: r.visited ? 1 : 0 }; }
  enterHouse(blob.house, rooms);
  await startHost(code);
}
async function joinFromLink() {
  const h = parseHash(); if (!h) return;
  UI.toast(t('coopJoining'));
  net = new Net(netHooks);
  try { await net.join(h.code, h.local); } catch (e) { netHooks.onFail(e); }
}
function leaveCoop() { if (net) net.close(); net = null; history.replaceState(null, '', location.pathname); restoreOwnHouse(); save(); }
function renderAnchors(body) {
  const p = game.player;
  body.append(el('p', { class: 'note' }, t('anchorsNote')));
  for (const k of Signs.ANCHORS) {
    const n = p.anchors[k] || 0;
    body.append(el('div', { class: 'row' }, el('div', { class: 'grow' },
      el('div', { class: 'name' }, `${t('an_' + k)} — “${t('hb_' + k)}”`), el('div', { class: 'sub' }, n ? `${t('and_' + k)} · ${t('anchorRank', { n })}` : t('anchorNone')))));
  }
}
function renderDiary(body, rerender) {
  const p = game.player;
  body.append(el('div', { class: 'top' }, t('clarityNow', { n: p.clarity, pct: Math.round(p.clarity * CFG.clarityBonus * 100) })));
  body.append(el('h3', {}, t('dawnTitle')));
  if (!Long.dawnAvailable(game)) body.append(el('p', { class: 'note' }, t('dawnLocked')));
  else {
    const line = el('textarea', { placeholder: t('dawnLine'), maxlength: 200 });
    body.append(el('p', { class: 'note' }, t('dawnInfo', { n: Long.clarityGain(game) })), line,
      el('button', { class: 'buy', onclick: () => { if (confirm(t('dawnConfirm'))) doDawn(line.value); } }, t('dawnGo')));
  }
  body.append(el('h3', {}, t('diaryTitle')));
  if (!p.diary.length) body.append(el('p', { class: 'note' }, t('diaryNone')));
  for (const d of p.diary) body.append(el('p', { class: 'flav' }, `${d.night}. ${d.line}`));
  body.append(el('h3', {}, t('achTitle')));
  for (const a of Long.ACHIEVEMENTS) { const got = p.achievements.includes(a); body.append(el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'name', style: got ? '' : 'opacity:.45' }, (got ? '✦ ' : '· ') + t('ach_' + a)), el('div', { class: 'sub' }, t('achd_' + a))))); }
  body.append(el('h3', {}, t('notesTitle')));
  if (!p.notes.length) body.append(el('p', { class: 'note' }, t('notesNone')));
  for (const i of [...p.notes].sort((a, b) => a - b)) body.append(el('p', { class: 'flav' }, '“' + t('note_' + i) + '”'));
}
function doDawn(line) {
  const r = Long.dawn(game, line);
  if (!r) return;
  Tide.clearTide(game);
  game = r.game; game.settings = { ...defaults, ...game.settings };
  world.setGame(game); tidefx && tidefx.clear();
  panel.hide(); save();
  UI.toast(t('dawnDone', { n: game.player.clarity })); audio.done();
  checkAch();
}
function checkAch(ctx) { for (const a of Long.checkAchievements(game, ctx)) { UI.toast(t('achGot', { name: t('ach_' + a) })); audio.rare(); } }
function renderFloors(body) {
  renderTide(body);
  body.append(el('h3', {}, t('tabFloors')));
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
  const lsel = el('select', { onchange: (e) => { s.lang = e.target.value || null; setLang(s.lang || detectLang()); applyLangToPage(); markSave(); rerender(); } },
    el('option', { value: '', selected: !s.lang }, t('lang_auto')), LANGS.map((l) => el('option', { value: l, selected: s.lang === l }, t('lang_' + l))));
  body.append(el('label', { class: 'set' }, t('language'), lsel));
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
    check('authorNotes', t('authorNotes')),
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
  if (hitStop > 0) { hitStop -= dt; dt *= 0.06; }
  const { ev, look, wheel } = input.poll();
  if (wheel && !panel.open) cycleGadget(wheel);
  const s = settings();
  for (const e of ev) {
    if (e.type !== 'key') continue;
    if (panel.open) { if (e.code === 'Escape' || e.code === 'KeyE' && nearConsole()) panel.hide(); continue; }
    if (map.open && (e.code === 'Escape' || e.code === 'KeyM')) { map.toggle(false); continue; }
    switch (e.code) {
      case 'KeyE': interact(); break;
      case 'KeyH': goHome(); break;
      case 'KeyM': map.toggle(); break;
      case 'KeyG': useGadget(); break;
      case 'Digit1': useAbility('dash'); break;
      case 'Digit2': useAbility('gloss'); break;
      case 'Digit3': useAbility('flash'); break;
      case 'KeyQ': { const fx = -Math.sin(game.pos.yaw), fz = -Math.cos(game.pos.yaw); signfx.ping(game.pos.x + fx * 3, game.pos.z + fz * 3); audio.chime(4); if (net) net.ping(game.pos.x + fx * 3, game.pos.z + fz * 3); break; }
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
  const a = Math.min(1, (game.mods.slick ? 2.4 : sliding ? 2.2 : onGloss && wl < 0.1 ? CFG.player.slideFriction : CFG.player.accel) * dt);
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
    const sv = world.viewFor(f, trx, trz);
    if (sv && sv.sign && !sv.sign.state && sv.signMesh && Math.hypot(sv.signMesh.position.x - lx, sv.signMesh.position.z - lz) < R) {
      const res = Signs.testStep(game, sv.sign, dt);
      toolMode = 'test';
      if (res.done) { UI.toast(res.true ? t('signTrue') : t('signLetGo')); res.true ? audio.rare() : audio.chime(0); refreshSigns(); markSave(); }
    }
    const evt = Game.toolStep(game, f, trx, trz, lx, lz, dt, Act.glossing(game) ? { polishMult: 20 } : undefined);
    if (evt) {
      if (toolMode !== 'test') toolMode = evt.mode;
      const v = world.viewFor(f, trx, trz);
      if (evt.mode === 'clear') {
        active = true;
        if (v) { v.syncClutter(evt.cells); v.refreshFloor(); world.spawnFlyers(v, evt.cells, null); }
        audio.clear(evt.units, game.combo, Game.info(game, f, trx, trz).biome.item);
      }
      if ((evt.mode === 'clear' || evt.mode === 'polish') && game.tide) { if (Tide.sweepBoost(game, f, trx, trz, dt) && net && !net.isHost()) net.boost(trx, trz, CFG.tide.sweepBoost * dt); }
      if (evt.mode === 'polish') {
        active = true; if (v) v.refreshFloor(); audio.polish(evt.polished);
      }
      if (evt.rare) { const id = 'find:' + evt.rare; if (Game.addCatalog(game, id)) { UI.toast(t('catalogNew', { name: t('cat_find_' + evt.rare) })); audio.rare(); } }
      if (evt.finishedClear) { const ni = Long.findNote(game, f, trx, trz); if (ni !== null) { UI.toast(t('noteFound', { text: t('note_' + ni) })); audio.chime(2); } if (v) { v.syncClutter(); v.refreshFloor(); } UI.toast(t('roomCleared')); audio.done(); markSave(); }
      if (evt.finishedPolish) { if (v) v.refreshFloor(); refreshSigns(); UI.toast(t('roomPolished')); audio.done(); markSave(); }
      if (evt.mode && evt.mode !== 'idle') { dirtySave = true; if (net) net.markRoom(`${f}:${trx}:${trz}`); }
    }
  }
  Game.tickCombo(game, dt, active);
  Act.tick(game, dt);
  Act.flowStep(game, dt, active ? toolMode : null);
  if (game.flowFull && !wasFull) { UI.toast(t('flowFull')); audio.chime(6); }
  wasFull = !!game.flowFull;
  const fb = document.getElementById('flowbar'); fb.style.display = game.flow > 0.02 ? 'block' : 'none'; fb.firstChild.style.width = (game.flow * 100).toFixed(0) + '%';
  for (const [id, a] of Object.entries(Act.ABILITIES)) {
    const un = Act.unlocked(game, id), btn = document.getElementById('bA' + a.key);
    if (un && !abilitySeen[id]) { abilitySeen[id] = true; if (game.player.lifetimeGlow > 0 && running) { UI.toast(t('abilityUnlocked', { name: t('ab_' + id), k: a.key })); audio.rare(); } }
    btn.classList.toggle('locked', !un); btn.style.opacity = Act.ready(game, id) ? 1 : 0.4;
  }
  world.fovKick = Math.max(sliding ? 8 : 0, world.fovKick - dt * 30);
  for (const v of world.views.values()) if (v.lampBoost > 1) v.lampBoost = Math.max(1, v.lampBoost - dt * 1.2);
  world.placeRing(toolX, toolZ, R, toolMode);
  world.ring.visible = !(trx === 0 && trz === 0);
  world.ringFill.visible = world.ring.visible;

  Game.tickIncome(game, Date.now());
  Game.tickRooms(game, dt);
  Game.tickDoors(game, dt);
  // the Tide
  const simDt = tidefx && tidefx.slowmo > 0 ? dt * 0.35 : dt;
  if (game.tide && !game.tide.result && game.tide.f === f && (!net || net.isHost())) Tide.tick(game, simDt, tideHooks);
  if (game.tide && game.tide.result) { tideClearT -= dt; if (tideClearT <= 0) Tide.clearTide(game); }
  if (!game.tide && (!net || net.isHost())) { const rw = Tide.maybeRandom(game, f, dt); if (rw) { audio.bell(); UI.toast(t('tideStirs', { dir: t('side_' + rw.fronts[0].side) })); } }
  if (tidefx) tidefx.update(simDt, game, [rx, rz]);
  rankT += dt; if (rankT > 1) { rankT = 0; if (Tide.updateRank(game, f)) { UI.toast(t('rankUp', { n: Game.floorState(game, f).rank })); audio.chime(Game.floorState(game, f).rank); } }
  // sorties, gadgets, signs
  Gad.tick(game, dt);
  const sev = So.update(game, dt);
  if (sev && sev.event === 'extract') {
    audio.bell(); UI.toast(t('extractNow', { t: CFG.sortie.extractTime }));
    if (!game.mods.noTides && !game.tide && Game.floorState(game, f).litCount > 0) Tide.startWave(game, f, { kind: 'final', share: 0.45 + 0.1 * game.sortie.risk });
  } else if (sev && sev.event === 'done') sortiePaid(sev);
  if (game.sortie && game.sortie.state === 'extract' && rx === 0 && rz === 0) sortiePaid(So.finish(game, true));
  const rt = So.riskTide(game, dt); if (rt) { audio.bell(); UI.toast(t('tideStirs', { dir: t('side_' + rt.fronts[0].side) })); }
  signT += dt; if (signT > 0.5) { signT = 0; refreshSigns(); }
  longT += dt;
  if (longT > 2) {
    longT = 0; checkAch();
    const cab = world.viewFor(f, 0, 0); if (cab && cab.cosmetics) { const it = Long.cabinItems(game); for (const k of Object.keys(cab.cosmetics)) cab.cosmetics[k].visible = !!it[k]; }
    map.radius = (game.player.anchors.window || 0) > 0 ? 11 : 7;
  }
  if ((game.player.anchors.phone || 0) > 0 && !inCabinNow) { game.phoneT = (game.phoneT || 0) + dt; if (game.phoneT > 120) { game.phoneT = 0; if (Signs.phoneRay(game, f, rx, rz)) { UI.toast(t('phoneRay')); audio.chime(5); } } }
  if (signfx) signfx.update(dt, game);
  if (net) net.tick(dt);
  if (others) others.update(dt, net, f);
  const hw = Econ.tickHelpers(game, dt, f, rx, rz, auraRadius());
  if (hw.cells) for (const k of hw.touched) { const v = world.views.get(k); if (v) { v.syncClutter(); v.refreshFloor(); } if (net) net.markRoom(k); }
  panelT += dt; if (panel.open && panelT > 0.5 && panel.cur !== 'settings') { panelT = 0; panel.refresh(); }
  for (const v of world.views.values()) {
    const { x, z } = v.info;
    v.setDoors([0, 1, 2, 3].map((sd) => Game.edgeBlocked(game, f, x, z, sd)));
  }
  pruneT += dt; if (pruneT > 5) { pruneT = 0; Game.pruneRooms(game, f, rx, rz); }
  world.updateFlyers(dt, p.x, CFG.player.eye, p.z);

  // HUD
  const inCabin = rx === 0 && rz === 0; inCabinNow = inCabin;
  if (inCabin) UI.hud(t('hudCabin', { glow: fmt(game.player.glow), rate: fmt(Game.incomeRate(game)) }) + tideHud());
  else {
    const r = Game.room(game, f, rx, rz);
    const c = Math.floor(Game.info(game, f, rx, rz) && (r.clearedDone ? 100 : 100 * (1 - sumC(r) / Math.max(1e-6, r.total))));
    const pol = Math.floor(100 * polishPct(r));
    UI.hud(t('hudRoom', { glow: fmt(game.player.glow), c, p: pol, lit: r.lit ? t('hudLit') : '' }) + tideHud() + (s.authorNotes ? '  ·  ' + ((Long.AUTHOR_NOTES[getLang()] || Long.AUTHOR_NOTES.en)[Game.info(game, f, rx, rz).biome.id] || '') : ''));
  }
  // first minute: one line of control hints until the first room is cleared
  if (game.player.stats.cleared < 40 && !panel.open && game.player.lifetimeGlow < 400) UI.hud((input.touch ? t('hintTouch') : t('hintDesktop')));
  // prompt
  let pr = '';
  const sw = nearSwitch(), sealed = nearSealed();
  const door = nearDoor(), an = nearAnchor();
  if (an) pr = t(input.touch ? 'anchorTakeTouch' : 'anchorTake', { name: t('an_' + an.kind) });
  else if (door) pr = t(input.touch ? 'doorShutTouch' : 'doorShut', { n: CFG.tide.doorHold });
  else if (sealed) pr = t(input.touch ? 'sealedOpenTouch' : 'sealedOpen', { cost: fmt(Game.sealCost(f)) });
  else if (sw) {
    const r = Game.room(game, f, sw.rx, sw.rz);
    if (r.lit) pr = game.tide && !game.tide.result ? t(input.touch ? 'boostLampTouch' : 'boostLamp', { cost: fmt(Act.boostCost(game, f)) }) : t('switchLit');
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
    audio.music.setBiome(Game.info(game, f, rx, rz).biome.id); audio.setBiome(Game.info(game, f, rx, rz).biome.id);
    audio.music.setState({ activity: musicAct, quiet: Game.floorState(game, f).quiet ? 1 : 0, warmth: Game.room(game, f, rx, rz).lit ? 1 : 0 });
  }
  autoQuality(dt);
  const quiet = Game.floorState(game, f).quiet ? 1 : 0, warmth = Long.floorWarmth(game, f);
  const fogM = game.mods.fog || 1; world.scene.fog.near = S * 0.7 * fogM; world.scene.fog.far = S * 2.4 * fogM;
  if (audio.ctx) audio.setQuiet(quiet);
  if (!skipRender) world.frame(dt, { x: p.x, y: CFG.player.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: s.fov }, s.warmMode, warmth);
}
function drawTideOnMap(x, o) {
  const w = game.tide; if (!w || w.result || w.f !== o.f) return;
  for (const fr of w.fronts) {
    const [sx, sz] = o.roomPx(...fr.source);
    x.strokeStyle = fr.sourceLit ? 'rgba(255,220,160,0.4)' : 'rgba(160,180,255,0.9)'; x.lineWidth = 2 * o.dpr;
    x.beginPath(); x.arc(sx, sz, o.cell * 0.3, 0, Math.PI * 2); x.stroke();
    for (const l of fr.lanes) {
      if (l.state === 'held' || l.state === 'arrived') continue;
      const cur = l.path[l.i], prev = l.path[Math.max(0, l.i - 1)];
      const px = prev[0] + (cur[0] - prev[0]) * (0.5 + (l.state === 'contact' ? 0 : l.p)), pz = prev[1] + (cur[1] - prev[1]) * (0.5 + (l.state === 'contact' ? 0 : l.p));
      const [hx, hz] = o.roomPx(px - 0.5 * (cur[0] - prev[0]) + 0.5 * (cur[0] - prev[0]), pz);
      x.fillStyle = l.state === 'contact' ? 'rgba(255,230,170,0.95)' : 'rgba(170,190,255,0.9)';
      x.beginPath(); x.arc(o.roomPx(px, pz)[0], o.roomPx(px, pz)[1], o.cell * 0.14, 0, Math.PI * 2); x.fill();
    }
  }
}
let signT = 0, longT = 0, inCabinNow = true;
function refreshSigns() { if (!signfx) return; for (const v of world.views.values()) signfx.refresh(v, game, signOpts()); }
const signOpts = () => ({ echo: !!game.mods.echo, salt: net ? net.salt() : 0 });
function sortiePaid(r) { if (!r) return; if (net && !net.isHost() && r.so) net.sortiePts(r.so.floor, r.so.action); UI.toast(t(r.clean ? 'sortiePaidClean' : 'sortiePaid', { glow: fmt(r.pay) })); audio.done(); markSave(); save(); }
function drawSortieOnMap(x, o) {
  const p = game.player;
  x.lineWidth = 1.5 * o.dpr;
  for (const r of p.rays || []) {
    if (r.f !== o.f) continue;
    const [sx, sz] = o.roomPx(r.x, r.z);
    x.strokeStyle = r.phone ? 'rgba(200,180,255,0.7)' : 'rgba(255,215,140,0.85)';
    if (r.phone) x.setLineDash([4 * o.dpr, 4 * o.dpr]);
    x.beginPath(); x.moveTo(sx, sz); x.lineTo(sx + Math.cos(r.angle) * o.cell * 40, sz + Math.sin(r.angle) * o.cell * 40); x.stroke(); x.setLineDash([]);
  }
  const so = game.sortie; if (!so || so.floor !== o.f) return;
  const mark = (rx, rz, col) => { const [cx, cz] = o.roomPx(rx, rz); x.strokeStyle = col; x.lineWidth = 3 * o.dpr; x.strokeRect(cx - o.cell * 0.42, cz - o.cell * 0.42, o.cell * 0.84, o.cell * 0.84); };
  if (so.type === 'line' || so.type === 'hall') mark(...so.target, 'rgba(255,240,200,0.95)');
}
let pruneT = 0, musicAct = 0, panelT = 0, rankT = 0, tideClearT = 0, hitStop = 0, wasFull = false;
const abilitySeen = {};
let net = null, ownHouse = null, others = null;
function auraRadius() { return Act.auraRadius(game); }
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
function sortieHud() {
  const so = game.sortie; if (!so) return '';
  if (so.state === 'extract') return t('extractHud', { t: Math.ceil(so.extractT) });
  return t('sortieDoneHud', { name: t('so_' + so.type), p: so.progress, g: so.goal });
}
function tideHud() {
  const w = game.tide; if (!w || w.result) return sortieHud();
  const left = Math.max(0, Math.ceil(w.duration - w.t));
  return t('hudTide', { t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` }) + sortieHud();
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
  tidefx = new TideFX(world, audio);
  others = new OthersFX(world);
  signfx = new SignFX(world);
  world.onViewCreated = (v) => signfx.refresh(v, game, signOpts());
  map.layers.push(drawTideOnMap, drawSortieOnMap);
  for (const id of ['bGadget', 'bPing']) document.getElementById(id).classList.remove('locked');
  setupPanel();
  const S = roomSide(game.pos.floor);
  world.updateLoaded(game.pos.floor, ...roomOf(game.pos.x, game.pos.z, S));
  const away = Econ.applyOffline(game, Date.now());
  if (away.secs > 3600) Long.checkAchievements(game, { restedAway: true });
  startScreen(away);
  joinFromLink();
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('pagehide', () => save());
  requestAnimationFrame(loop);
  // Test hook: run the real update loop for N seconds of game time without drawing, calling bot() each step.
  const simulate = (secs, bot, dt = 1 / 30) => { skipRender = true; let t = 0; try { while (t < secs) { if (bot && bot()) break; update(dt); gameTime += dt; t += dt; } } finally { skipRender = false; } return t; };
  const renderBench = (n) => { const p = game.pos; const t0 = performance.now(); for (let i = 0; i < n; i++) world.frame(1 / 60, { x: p.x, y: CFG.player.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fov: settings().fov }, false); world.renderer.getContext().finish(); return (performance.now() - t0) / n; };
  window.__lift = { Econ, get net() { return net; }, startHost, hostShared, leaveCoop, Long, doDawn, Act, useAbility, So, Signs, Gad, get signfx() { return signfx; }, refreshSigns, Tide, get tidefx() { return tidefx; }, callWave, simulate, renderBench, get game() { return game; }, get time() { return gameTime; }, get frames() { return frames; }, world, input, save, Game, panel, map };
}
main();
