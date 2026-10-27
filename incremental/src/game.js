// Game orchestration: world, economy, tools, banking, events, audio, UI, saves, co-op, planet view.
import * as THREE from 'three';
import { Graphics, PRESETS } from './render/graphics.js';
import { Atmosphere } from './render/sky.js';
import { installFog, FOG } from './render/fog.js';
import { Particles } from './render/particles.js';
import { PlanetView } from './render/planet.js';
import { Avatars } from './render/avatars.js';
import { IceVolume } from './world/volume.js';
import { createIceMaterial } from './world/iceMaterial.js';
import { buildTerrain, buildStakes } from './world/terrain.js';
import { CoinSystem } from './world/coins.js';
import { Works } from './world/structures.js';
import { Water } from './world/water.js';
import { FrozenThings } from './world/events.js';
import { surfaceY, richness } from './world/field.js';
import { Controller } from './player/controller.js';
import { Input, DEFAULT_BINDINGS } from './player/input.js';
import { Tools, FAMILIES } from './player/tools.js';
import { AudioEngine } from './audio/engine.js';
import { Sfx } from './audio/sfx.js';
import { Music } from './audio/music.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { DevMenu, PerfOverlay } from './ui/devmenu.js';
import { h } from './ui/dom.js';
import { Crew } from './net/crew.js';
import * as M from './econ/model.js';
import { PLANET_BY_ID, strataProps } from './econ/data/planets.js';
import { COINS, tierWeights } from './econ/data/coins.js';
import { MILESTONES, CREW_MILESTONES } from './econ/data/milestones.js';
import { SYNERGY_BY_ID } from './econ/data/synergies.js';
import { Big, format, formatTime, numberFormat } from './core/big.js';
import * as Save from './save/save.js';

const SIM_STEP = 1 / 30;
const PHYS_STEP = 1 / 60;
const COINS_PER_M3 = 0.58;    // expected embedded coins per m³ (see coins.js spawn: 2.0 tries x 1.6 x mean seam acceptance 0.18)
const COIN_RGB = [[1, 0.62, 0.45], [0.9, 0.95, 1], [1, 0.82, 0.35]];

const DEFAULT_SETTINGS = {
  preset: 'high', ...PRESETS.high, shadowQ: 'high', fov: 78, vsync: true, fpsCap: 0, grade: true, grain: true, vignette: true,
  toneMapping: 'aces', fog: true, perfOverlay: false, sensitivity: 1, invertY: false, bindings: {},
  volume: { master: 0.8, music: 0.55, sfx: 0.8, amb: 0.6 }, musicOn: true, theme: 'frostara', scientific: false, crewName: 'Surveyor',
};

class Game {
  constructor() {
    this.qs = new URLSearchParams(location.search);
    this.dev = this.qs.has('dev');
    this.coopDebug = this.qs.has('coopdebug');
    const saved = Save.readSettings() || {};
    this.settings = { ...DEFAULT_SETTINGS, ...saved, volume: { ...DEFAULT_SETTINGS.volume, ...(saved.volume || {}) } };
    if (this.qs.get('preset')) Object.assign(this.settings, PRESETS[this.qs.get('preset')], { preset: this.qs.get('preset'), shadowQ: this.qs.get('preset') });
    numberFormat.scientific = this.settings.scientific;
    this.defaultBindings = { ...DEFAULT_BINDINGS };
    this.timeScale = 1;
    this.statsDirty = true;
    this.view = 'fp';
    this.viewT = 0;
    this.rateWindow = [];
    this.slot = 'solo';
    this.state = {};
    this.started = false;
    this.profile = this.readProfile();
    this.slotOverride = this.qs.get('slot');
  }

  // ---------- setup ----------

  init() {
    installFog();
    const canvas = document.getElementById('view');
    this.ui = document.getElementById('ui');
    this.loading = h('div.loading', {}, h('div.l', {}, h('div.eyebrow', {}, 'Melt the Planet'), h('div.bar', {}, h('i', { id: 'load-bar' })), h('div.eyebrow', { id: 'load-txt' }, 'Cutting the first chunks of ice')));
    this.ui.appendChild(this.loading);

    this.gfx = new Graphics(canvas, this.settings);
    this.atmo = new Atmosphere(this.gfx.renderer, this.gfx.scene, this.gfx.camera);
    this.particles = new Particles(this.gfx);
    this.planetView = new PlanetView(this.gfx);
    this.iceMat = createIceMaterial();
    this.atmo.register(this.iceMat, 'ice', this.iceMat.userData.hook);
    this.gfx.linkRefractive(this.iceMat);
    this.terrain = buildTerrain(this.atmo);
    this.gfx.scene.add(this.terrain);
    this.stakes = buildStakes(this.atmo);
    this.gfx.scene.add(this.stakes);
    this.volume = new IceVolume(this.gfx.scene, this.iceMat, 1701);
    this.coins = new CoinSystem(this.gfx.scene, this.volume, this.atmo, ['copper', 'silver', 'gold']);
    this.coins.useIcePass(this.gfx);
    this.works = new Works(this.gfx.scene, this.atmo, this.coins.lowGeos, this.coins.mats);
    this.water = new Water(this.gfx, this.volume);
    this.frozen = new FrozenThings(this.gfx.scene, this.atmo, this.volume);
    this.avatars = new Avatars(this.gfx.scene, this.atmo);

    this.input = new Input(canvas, this.settings.bindings);
    this.ctl = new Controller(this.volume);
    this.ctl.colliders = this.works.colliders;
    this.tools = new Tools(this);

    this.audio = new AudioEngine();
    this.sfx = new Sfx(this.audio);
    this.music = new Music(this.audio);
    this.music.setTheme(this.settings.theme);

    this.hud = new Hud(this.ui, this);
    this.menus = new Menus(this.ui, this);
    this.perf = new PerfOverlay(this.ui);
    if (this.dev) this.devMenu = new DevMenu(this.ui, this);
    this.planetUi = h('div.planet-ui', { hidden: true });
    this.ui.appendChild(this.planetUi);
    this.clickPlay = h('div.click-to-play', { hidden: true }, 'Click to continue');
    this.ui.appendChild(this.clickPlay);

    this.crew = new Crew(this, this.coopDebug);
    this.crew.name = this.settings.crewName;
    this.wireEvents();
    this.applySettings(true);
  }

  wireEvents() {
    const inp = this.input;
    inp.on('click', () => {
      this.startAudio();
      if (!this.menus.open && this.view === 'fp' && this.started) inp.lock();
    });
    inp.on('lock', (locked) => {
      if (locked) this.clickPlay.hidden = true;
      if (!locked && this.started && this.view === 'fp' && !this.menus.open && !this.suppressPause) this.menus.show('pause');
      this.suppressPause = false;
    });
    inp.on('key', (code) => this.onKey(code));
    addEventListener('mousedown', () => { this.startAudio(); if (this.wantsLock()) inp.lock(); });
    // if the browser refused the lock (it can right after a menu or alt-tab), any game key takes it back
    addEventListener('keydown', (e) => { this.startAudio(); if (e.code !== 'Escape' && this.wantsLock()) inp.lock(); });

    this.tools.on('strike', (s) => this.onStrike(s));
    this.tools.on('melt', (m) => this.onMelt(m));
    this.tools.on('whiff', () => this.sfx.play('whiff'));
    this.tools.on('select', (f, ok) => {
      this.sfx.play('click');
      if (!ok) this.hud.notice(`${FAMILIES[f].name} tools`, FAMILIES[f].id === 'planet' ? 'Satellite mirrors and the heat pipe arrive with later planets.' : 'Buy the first upgrade in this tree to unlock the tool.');
    });
    this.ctl.on('step', () => this.sfx.play('step', { ice: this.feetOnIce() }));
    this.ctl.on('land', () => this.sfx.play('land'));
    this.coins.onFreed = (list, op) => {
      if (op.auto) {
        // the stakes send their coins straight up the cable
        const ids = new Set(list.map((c) => c.id));
        this.coins.loose = this.coins.loose.filter((l) => !ids.has(l.id));
        for (const c of list) this.particles.streak(new THREE.Vector3(c.x, c.y, c.z), this.works.beaconPos(), COIN_RGB[c.tier]);
        return;
      }
      const t = Math.max(...list.map((c) => c.tier));
      this.sfx.play('clink', { tier: t, pos: new THREE.Vector3(op.x, op.y, op.z) });
      for (const c of list) if (c.tier >= 1) this.particles.glint(new THREE.Vector3(c.x, c.y, c.z), COIN_RGB[c.tier], 0.3);
    };
    this.water.onRefreeze = (p) => {
      this.sfx.play('creak', { pos: new THREE.Vector3(p.x, p.level, p.z) });
      this.hud.notice('Meltwater refroze', 'A pool you left behind froze into clear ice. Anti-Refreeze buys you more time.', '', 3800);
    };
    this.frozen.on('capsule', (it) => this.openCapsule(it));
    this.frozen.on('needle', (it) => this.foundNeedle(it));
    this.frozen.on('chest', (it) => this.openChest(it));
    this.crew.on('notice', (t) => this.hud.notice('Crew', t));
    this.crew.on('crewMilestones', (done, fresh) => this.onCrewMilestones(done, fresh));
    this.crew.on('hostLost', () => this.hud.notice('Host left', 'You keep playing from your copy of the crew. Rejoining automatically, or resume as host from the crew screen.', 'heat', 7000));
    addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  startAudio() {
    if (this.audioStarted) return;
    this.audio.start();
    if (!this.audio.ready) return;
    this.audioStarted = true;
    this.music.start();
    this.music.setEnabled(this.settings.musicOn);
    this.sfx.loop('wind', true);
  }

  onKey(code) {
    const inp = this.input, b = inp.bindings;
    if (code === 'Backquote' && this.devMenu) { this.devMenu.toggle(); return; }
    if (inp.capture) return;
    if (code === 'Escape') {
      if (this.view === 'planet') { this.togglePlanet(false); return; }
      if (this.menus.open) {
        const was = this.menus.cur;
        if (was === 'start') return;
        this.menus.close();
        if (this.started) this.clickPlay.hidden = false;
      }
      return;
    }
    if (!this.started || this.menus.cur === 'start') return;
    const menuKey = { [b.upgrades]: 'upgrades', [b.coop]: 'crew', [b.music]: 'music', [b.collections]: 'collections' }[code];
    if (menuKey) {
      if (this.view !== 'fp') return;
      if (this.menus.cur === menuKey) { this.menus.close(); inp.lock(); return; }
      if (menuKey === 'upgrades' && !this.canUpgrade()) { this.upgradeAway(); return; }
      this.suppressPause = true;
      inp.unlock();
      this.menus.show(menuKey);
      return;
    }
    if (code === b.planet) {
      if (this.menus.open && this.menus.cur !== 'pause') return;
      if (this.menus.open) this.menus.close();
      if (this.view === 'fp') this.togglePlanet(true);
      else if (this.view === 'planet') this.togglePlanet(false);
      return;
    }
    if (this.menus.open || this.view !== 'fp') return;
    for (let i = 0; i < 4; i++) if (code === b[`tool${i + 1}`]) this.tools.select(i, this.stats);
  }

  onMenuChange(name) {
    this.input.blockGame = !!name;
    this.hud.visible = !name && (this.view === 'fp' || this.view === 'fpIn');
    this.clickPlay.hidden = true;
    if (!name && this.started && this.view === 'fp' && !this.input.locked) {
      // back to play: take the mouse again straight away (menus close from a key or click, which allows it)
      this.input.lock();
      this.clickPlay.hidden = false;
    }
  }

  wantsLock() { return this.started && this.view === 'fp' && !this.menus.open && !this.input.locked && !this.input.capture; }

  // ---------- planets ----------

  get planet() { return PLANET_BY_ID[this.econ.planet]; }

  setupPlanet(planetId, pole) {
    const p = PLANET_BY_ID[planetId];
    this.atmo.setPlanet(p);
    FOG.uFogParams.value.x = this.settings.fog ? p.fogDensity : 0;
    this.gfx.setGrade(p.grade, p.exposure);
    this.volume.setSeed(p.seed);
    const u = this.iceMat.userData.uniforms;
    const strata = p.poles[pole].strata;
    for (let i = 0; i < 8; i++) {
      const s = strata[Math.min(i, strata.length - 1)];
      u.uStrataY.value[i] = i < strata.length ? s.d : 1e5;
      u.uStrataCol.value[i].setRGB(...s.color);
      u.uStrataHard.value[i] = s.hard;
    }
    this.coins.setContext({ seed: p.seed, coinValue: (tier, depth) => this.coinValue(tier, depth) });
    this.planetView.setPlanet(p, pole);
    this.music.setTheme(this.settings.theme || p.theme);
  }

  freshState() { return { capsules: {}, needle: false, carried: { count: 0, value: 0, ids: [] }, played: 0, created: Date.now() }; }

  newCampaign(pole, slot = 'solo') {
    this.slot = slot;
    this.econ = M.createEcon('frostara', pole);
    M.applyCrewBonuses(this.econ, this.profile.crewMilestones || {});
    this.state = this.freshState();
    this.resetWorld();
    this.placeStart();
    this.statsDirty = true;
    this.rateWindow = [];
    this.started = true;
    this.save();
  }

  // Upgrades are bought at the Outfitter's hut on the surface.
  atOutfitter() { return this.works.outfitterPos && this.ctl.pos.distanceTo(this.works.outfitterPos) < 4.2; }
  canUpgrade() { return this.atOutfitter() || this.dev; }
  upgradeAway() {
    this.sfx.play('deny');
    this.hud.notice("Upgrades are at the Outfitter's hut", `Ride the lift up and walk to the blue hut ▣ on the surface near where you started, then press ${this.keyName('upgrades')}.`, '', 7000);
  }

  placeStart() {
    this.ctl.teleport(2.4, surfaceY(2.4, 5.6) + 0.2, 5.6);
    this.ctl.yaw = 0.25; this.ctl.pitch = -0.42;
    this.works.beacon.position.set(4.4, surfaceY(4.4, 3.6) + 1.6, 3.6);
  }

  resetWorld() {
    this.coins.clear();
    this.water.clear();
    this.particles.clear();
    this.volume.reset();
    this.works.resetPile();
    this.setupPlanet(this.econ.planet, this.econ.pole);
    this.frozen.setup(this.planet, this.econ.pole, this.planet.seed, this.state);
  }

  loadState(data) {
    this.econ = Save.econFromJSON(data.econ);
    const fresh = M.createEcon(this.econ.planet, this.econ.pole);
    for (const k of Object.keys(fresh)) if (this.econ[k] === undefined) this.econ[k] = fresh[k];
    M.applyCrewBonuses(this.econ, this.profile.crewMilestones || {});
    this.state = { ...this.freshState(), ...data.state };
    if (!this.state.carried) this.state.carried = { count: 0, value: 0, ids: [] };
    this.coins.clear();
    this.water.clear();
    this.particles.clear();
    this.volume.load(data.world?.hm);
    this.volume.loadEdits(data.world?.ed);
    this.works.resetPile();
    this.setupPlanet(this.econ.planet, this.econ.pole);
    this.frozen.setup(this.planet, this.econ.pole, this.planet.seed, this.state);
    const pl = data.player;
    if (pl) {
      this.ctl.teleport(pl.pos[0], pl.pos[1] + 0.3, pl.pos[2]);
      this.ctl.yaw = pl.yaw; this.ctl.pitch = pl.pitch;
    } else this.placeStart();
    if (data.beacon) this.works.beacon.position.set(...data.beacon);
    this.works.syncPile(this.econ.total.toNumber(), this.tierMix(this.econ.depth), false);
    this.statsDirty = true;
    this.rateWindow = [];
  }

  // ---------- economy glue ----------

  get stats() {
    if (this.statsDirty || !this._stats) { this._stats = M.computeStats(this.econ); this.statsDirty = false; }
    return this._stats;
  }

  coinValue(tier, depth) {
    const w = tierWeights(depth, this.planet.coinTiers);
    let e = 0;
    for (let i = 0; i < w.length; i++) e += w[i] * COINS[i].value;
    return (M.baseValuePerM3(this.econ, depth) * 0.5 / COINS_PER_M3) * COINS[tier].value / Math.max(1e-9, e);
  }

  // multiplier applied when coins reach the vault
  bankMult() {
    const st = this.stats;
    return M.valueMult(this.econ, st) * Math.max(1, M.collectEff(st)) * Math.max(1, M.bankEff(st));
  }

  tierMix(depth) { const w = tierWeights(depth, this.planet.coinTiers); return [w[0], w[1], w[2]]; }

  depthAt(x, y, z) { return surfaceY(x, z) - y; }

  craterDepth() { return this.volume.maxDepthDug; }

  measuredRate() {
    const w = this.rateWindow;
    const model = M.rates(this.econ, this.stats).income;
    if (!w.length) return Math.max(0.5, model * 0.6);
    const span = Math.max(10, this.econ.time - w[0].t);
    const sum = w.reduce((a, b) => a + b.v, 0);
    return Math.max(sum / span, model * 0.2, 0.2);
  }

  earn(v) {
    if (!(v > 0)) return;
    this.rateWindow.push({ t: this.econ.time, v });
    while (this.rateWindow.length && this.econ.time - this.rateWindow[0].t > 45) this.rateWindow.shift();
    if (this.crew.active && !this.crew.isHost) return; // members: the host credits the shared vault
    M.earn(this.econ, Big.fromNumber(v));
  }

  // fine coin dust from removed ice goes straight into the pack
  addDust(removed, depth, mult) {
    if (removed <= 0) return;
    const value = removed * M.baseValuePerM3(this.econ, Math.max(0, depth)) * 0.5 * mult;
    const slots = removed * COINS_PER_M3;
    const c = this.state.carried;
    const room = Math.max(0, this.stats.carry - c.count);
    const k = slots > 0 ? Math.min(1, room / slots) : 1;
    c.count += slots * k;
    c.value += value * k;
  }

  buy(id) {
    if (this.crew.active && !this.crew.isHost) {
      if (!M.isUnlocked(this.econ, id) || M.isMaxed(this.econ, id) || this.econ.coins.lt(M.costOf(this.econ, id))) return false;
      this.crew.buy(id);
      return true;
    }
    const res = M.buy(this.econ, id);
    if (!res) return false;
    this.afterBuy(id, res);
    return true;
  }

  afterBuy(id, res) {
    this.statsDirty = true;
    this.sfx.play('buy', { step: this.econ.purchases });
    const n = M.NODE_BY_ID[id];
    if (n.gate) this.hud.notice(`New tool: ${n.name}`, n.desc, 'money');
    if (n.root && n.tree === 'melt') this.hud.notice('Torch unlocked', `Press ${this.keyName('tool2')} to switch to it. Warming ice before you dig it frees more.`, 'money');
    if (n.root && n.tree === 'vision') this.hud.notice('Lamp unlocked', `Press ${this.keyName('tool4')} and hold left mouse to focus it; ${this.keyName('lamp')} switches it on or off.`, 'money');
    for (const s of res.fresh) this.onResonance(s);
    if (this.crew.isHost) { this.crew.econT = 0; this.crew.event({ k: 'buy', id }); }
    this.menus.refresh();
  }

  onResonance(s) {
    this.hud.notice('Resonance', `${s.name}. Written in your notebook.`, 'resonance', 6500);
    this.music.cue('resonance');
    this.statsDirty = true;
    if (this.crew.isHost) this.crew.event({ k: 'res', id: s.id });
  }

  keyName(a) { const c = this.input.code(a) || ''; return c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c; }

  // ---------- world actions ----------

  applyOp(op, src) {
    const res = this.volume.applyOp(op);
    const depth = this.depthAt(op.x, op.y, op.z);
    if (op.kind !== 'fill' && !(this.crew.active && !this.crew.isHost)) {
      this.econ.volume += res.removed;
      if (op.kind === 'melt') this.econ.melted += res.removed;
    }
    if (src === 'local' && this.crew.active) this.crew.sendOp(op, res.removed);
    return { ...res, depth };
  }

  applyRemoteOp(op) {
    const res = this.applyOp(op, 'remote');
    const p = new THREE.Vector3(op.x, op.y, op.z);
    if (op.kind === 'dig') { this.particles.chips(p, new THREE.Vector3(0, 1, 0), 0.6); this.sfx.play('chip', { pos: p, gain: 0.6 }); }
    if (op.kind === 'melt' && Math.random() < 0.3) this.particles.steam(p, new THREE.Vector3(0, 1, 0), 0.6);
    return res;
  }

  onStrike(s) {
    const st = this.stats;
    this.sfx.play(s.heavy ? 'crack' : 'chip', { pos: s.point, pitch: s.drill ? 1.2 : 1, gain: s.drill ? 0.5 : 1 });
    if (s.crit) this.sfx.play('shatter', { pos: s.point, gain: 0.6 });
    this.addDust(s.removed, s.depth, st.digYield);
    if (s.pre) this.countAction('meltThenDig');
    if (s.rich > 0.62) this.countAction('richDig');
  }

  onMelt(m) {
    this.addDust(m.removed, m.depth, 1);
    if (m.removed > 0) this.water.add(m.point, m.removed);
  }

  countAction(a) {
    if (this.crew.active && !this.crew.isHost) { this.crew.action(a); return; }
    this.econ.actions[a] = (this.econ.actions[a] || 0) + 1;
    for (const s of M.discover(this.econ)) this.onResonance(s);
  }

  feetOnIce() { const p = this.ctl.pos; return this.depthAt(p.x, p.y, p.z) > 0.8; }

  // ---------- banking ----------

  updateBanking(dt, eye) {
    const c = this.state.carried;
    const bp = this.works.beaconPos();
    const chest = eye.clone().add(new THREE.Vector3(0, -0.5, 0));
    const range = 3.2 + this.stats.bank * 25;
    this.atBeacon = chest.distanceTo(bp) < range;
    if (this.atBeacon && c.value > 0) {
      this.bankT = (this.bankT || 0) - dt;
      if (this.bankT <= 0) {
        this.bankT = 0.35;
        const v = c.value * this.bankMult();
        const n = Math.round(c.count);
        this.earn(v);
        if (this.crew.active) this.crew.bank(v, c.ids);
        this.works.pulse = 1;
        this.sfx.play('bank', { pos: bp, count: Math.min(10, n), tier: this.tierMix(this.econ.depth)[2] > 0.2 ? 2 : 0 });
        for (let i = 0; i < Math.min(14, n + 2); i++) this.particles.streak(chest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6)), bp, [1, 0.8, 0.45]);
        const sp = bp.clone().project(this.gfx.camera);
        if (sp.z < 1) this.hud.floater(`+${format(v)}`, (sp.x * 0.5 + 0.5) * innerWidth, (-sp.y * 0.5 + 0.5) * innerHeight - 30);
        c.count = 0; c.value = 0; c.ids = [];
        const before = this.works.pileCount;
        this.works.syncPile(this.econ.total.toNumber(), this.tierMix(this.econ.depth), true);
        if (this.works.pileCount > before) this.sfx.play('pile', { pos: this.works.vaultCenter() });
      }
    }
    this.sfx.loop('hum', this.audio.ready, { level: Math.max(0, 1 - chest.distanceTo(bp) / 10) });
  }

  // ---------- riding the lift ----------

  // Hold jump at the beacon to ride the lift to the surface; you step off on the nearest solid rim.
  updateRide(dt, holdJump) {
    const b = this.works.beaconPos();
    const deep = this.depthAt(this.ctl.pos.x, this.ctl.pos.y, this.ctl.pos.z) > 1.4;
    if (!this.ride) {
      this.liftReady = this.atBeacon && deep;
      if (holdJump && this.liftReady) {
        this.rideHold = (this.rideHold || 0) + dt;
        if (this.rideHold > 0.5) { this.ride = { t: 0 }; this.rideHold = 0; this.sfx.play('bank', { pos: b, count: 0 }); }
      } else this.rideHold = 0;
      return;
    }
    // haul up with the beacon
    const top = surfaceY(b.x, b.z) + 3;
    const speed = Math.max(4, this.stats.liftSpeed * 4);
    b.y = Math.min(top, b.y + speed * dt);
    this.ctl.teleport(b.x, b.y - 1.35, b.z + 0.01);
    this.works.pulse = 0.4;
    if (b.y >= top - 0.01) {
      // step off on the nearest column that is not dug out
      const spot = this.nearestRim(b.x, b.z);
      this.ctl.teleport(spot.x, surfaceY(spot.x, spot.z) + 0.25, spot.z);
      this.ride = null;
    }
  }

  nearestRim(x, z) {
    for (let r = 1.5; r < 40; r += 1) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const top = surfaceY(px, pz);
        if (this.volume.sdf(px, top - 0.6, pz) > 0.05) return { x: px, z: pz };
      }
    }
    return { x: 0, z: 36 };
  }

  // ---------- events ----------

  // Supply chest: a burst of coins scaled to your income and its depth; relic chests also add +3% income for good.
  openChest(it) {
    (this.state.chests ||= {})[it.id] = Date.now();
    const sec = 45 + it.depth * 1.6;
    const bonus = Math.max(30, this.measuredRate() * sec);
    this.earn(bonus);
    if (it.relic) { this.econ.legacy *= 1.03; this.statsDirty = true; }
    this.music.cue('capsule');
    this.sfx.play('bank', { pos: it.mesh.position, count: 10, tier: 2 });
    this.hud.notice(it.relic ? 'Relic chest' : 'Supply chest', `+${format(bonus)} coins${it.relic ? ' and a relic: +3% income for good' : ''}.`, 'money', 7000);
    if (this.crew.active) this.crew.event({ k: 'chest', id: it.id, bonus });
    this.save();
  }

  openCapsule(it) {
    const c = it.data;
    const bonus = Math.max(50, this.measuredRate() * c.contents.coinsSec);
    this.earn(bonus);
    this.state.capsules[c.id] = Date.now();
    this.sfx.play('capsule', { pos: it.mesh.position });
    this.music.cue('capsule');
    this.hud.notice(`Time capsule: ${c.name}`, `${c.contents.lore} It held ${format(bonus)} coins.`, 'money', 9000);
    if (this.crew.isHost) this.crew.event({ k: 'capsule', id: c.id, bonus });
    this.save();
  }

  foundNeedle(it) {
    const bonus = Math.max(500, this.measuredRate() * it.data.rewardSec);
    this.earn(bonus);
    this.state.needle = true;
    this.music.cue('stinger');
    this.gfx.flash = 0.35;
    this.flashT = 0.6;
    this.hud.notice('The Golden Needle', `Found. One is hidden on every planet. Worth ${format(bonus)} coins.`, 'money', 9000);
    if (this.crew.isHost) this.crew.event({ k: 'needle', bonus });
    this.save();
  }

  checkMilestones() {
    if (this.crew.active && !this.crew.isHost) return;
    const hit = M.checkMilestones(this.econ, this.measuredRate());
    hit.forEach(({ m, bonus }, i) => {
      this.hud.notice(`${m.icon} Milestone: ${m.name}`, `+${format(bonus)} coins.`, 'money', 7000);
      this.music.cue('motif', m.motif ?? i);
      if (this.crew.isHost) this.crew.event({ k: 'ms', id: m.id, bonus: bonus.toJSON() });
    });
  }

  onCrewMilestones(done, fresh) {
    this.profile.crewMilestones = { ...(this.profile.crewMilestones || {}), ...done };
    this.writeProfile();
    if (this.econ) M.applyCrewBonuses(this.econ, this.profile.crewMilestones);
    this.statsDirty = true;
    for (const id of fresh || []) {
      const m = CREW_MILESTONES.find((x) => x.id === id);
      if (m) { this.hud.notice(`Crew milestone: ${m.name}`, 'A permanent bonus for every member, solo play included.', 'money', 7000); this.music.cue('motif', 2); }
    }
  }

  // ---------- the next goal is always visible: a glint deeper in the ice ----------

  updateTreasure(dt, eye) {
    this.treasureT = (this.treasureT || 0) - dt;
    if (this.treasureT > 0) return;
    this.treasureT = 0.7;
    const stale = !this.treasure || this.coins.collectedIds.has(this.treasure.id);
    if (stale || Math.random() < 0.06) {
      let best = null, score = -1e9;
      for (const list of this.coins.embedded.values()) for (const k of list) {
        if (k.y > eye.y - 1.2) continue;
        const d = Math.hypot(k.x - eye.x, k.y - eye.y, k.z - eye.z);
        if (d > 15) continue;
        const sc = k.tier * 6 - d;
        if (sc > score) { score = sc; best = k; }
      }
      this.treasure = best;
    }
    if (this.treasure) {
      const k = this.treasure;
      // sprite 6 = star glint drawn through the ice (x-ray flag)
      this.particles.add.spawn(6, 6, k.x, k.y, k.z, 0, 0, 0, 0.65, 0.34, 0.05, ...COIN_RGB[k.tier], 0.5, 0, 0, 2);
    }
    // every coin frozen in the ice within a few metres of you sparkles through it
    let n = 0;
    for (const list of this.coins.embedded.values()) {
      if (list.cx !== undefined && (list.cx - eye.x) ** 2 + (list.cy - eye.y) ** 2 + (list.cz - eye.z) ** 2 > 14 * 14) continue;
      for (const k of list) {
        const d2 = (k.x - eye.x) ** 2 + (k.y - eye.y) ** 2 + (k.z - eye.z) ** 2;
        if (d2 > 5 * 5) continue;
        const life = 0.6 + Math.random() * 0.3;
        this.particles.add.spawn(6, 6, k.x, k.y, k.z, 0, 0, 0, life, 0.5, 0.12, ...COIN_RGB[k.tier], 1, 0, 0, 3);
        // a solid coloured core so the sparkle also reads against bright ice
        this.particles.alpha.spawn(6, 4, k.x, k.y, k.z, 0, 0, 0, life, 0.14, 0.1, ...COIN_RGB[k.tier].map((c) => c * 0.8), 0.95, 0, 0, 0);
        if (++n >= 60) return;
      }
    }
  }

  // ---------- automation ----------

  updateAutomation(dt) {
    const st = this.stats;
    if (st.autoDig + st.autoMelt <= 0) return;
    if (this.crew.active && !this.crew.isHost) return;
    const e = this.econ;
    const hard = M.hardnessAt(e);
    const vol = ((st.autoDig + st.autoMelt) / hard) * dt;
    const v = vol * M.baseValuePerM3(e, Math.max(0, e.depth * 0.8)) * this.bankMult();
    this.autoAcc = (this.autoAcc || 0) + v;
    this.autoVol = (this.autoVol || 0) + vol;
    if (this.autoVol > 0.35) {
      // the stakes around the beacon really fracture the floor
      const b = this.works.beaconPos();
      const a = Math.random() * Math.PI * 2;
      const x = b.x + Math.cos(a) * 2.2, z = b.z + Math.sin(a) * 2.2;
      const fy = this.volume.floorBelow(x, b.y, z, 20);
      const r = Math.cbrt(this.autoVol / ((4 / 3) * Math.PI * 0.5));
      this.applyOp({ kind: 'dig', x, y: fy, z, r: Math.min(1.6, r), seed: (Math.random() * 999) | 0, auto: true }, 'local');
      this.particles.chips(new THREE.Vector3(x, fy + 0.1, z), new THREE.Vector3(0, 1, 0), 0.4);
      this.autoVol = 0;
      this.earn(this.autoAcc);
      this.autoAcc = 0;
    }
  }

  // ---------- planet view ----------

  togglePlanet(on) {
    if (on && this.view === 'fp') {
      this.view = 'toPlanet'; this.viewT = 0;
      this.suppressPause = true;
      this.input.unlock();
      this.hud.visible = false;
      this.clickPlay.hidden = true;
    } else if (!on && this.view === 'planet') {
      this.view = 'toFp'; this.viewT = 0;
      this.planetView.leave();
      this.planetUi.hidden = true;
    }
  }

  updateView(dt) {
    this.viewT += dt;
    if (this.view === 'toPlanet') {
      this.gfx.flash = Math.min(1, this.viewT / 0.7);
      if (this.viewT >= 0.7) {
        this.view = 'planet'; this.viewT = 0;
        this.gfx.override = (r, t) => this.planetView.render(r, t);
        this.updatePlanetState();
        this.planetView.enter();
        this.buildPlanetUi();
      }
    } else if (this.view === 'planet') {
      this.gfx.flash = Math.max(0, 1 - this.viewT / 0.6);
      this.planetView.update(dt);
    } else if (this.view === 'toFp') {
      this.planetView.update(dt);
      this.gfx.flash = Math.min(1, this.viewT / 0.6);
      if (this.viewT >= 0.6) { this.view = 'fpIn'; this.viewT = 0; this.gfx.override = null; }
    } else if (this.view === 'fpIn') {
      this.gfx.flash = Math.max(0, 1 - this.viewT / 0.6);
      if (this.viewT >= 0.6) { this.view = 'fp'; this.hud.visible = true; this.clickPlay.hidden = false; this.gfx.flash = 0; }
    } else if (this.flashT > 0) {
      this.flashT -= dt;
      this.gfx.flash = Math.max(0, this.flashT) * 0.5;
    } else this.gfx.flash = 0;
  }

  // the camera lifts out of the crater during the transition
  viewLift() {
    if (this.view === 'toPlanet') return Math.pow(this.viewT / 0.7, 2.2) * 140;
    if (this.view === 'fpIn') return Math.pow(1 - this.viewT / 0.6, 2.2) * 140;
    return 0;
  }

  updatePlanetState() {
    const e = this.econ;
    this.planetView.setState({ depthF: Math.min(1, this.craterDepth() / this.planet.goalDepth), heat: M.heatSpread(e), seaCm: M.seaLevelCm(e), craterDepth: this.craterDepth() });
  }

  buildPlanetUi() {
    const e = this.econ, p = this.planet;
    const el = this.planetUi;
    el.innerHTML = '';
    el.hidden = false;
    el.append(
      h('div.ptitle', {}, h('div.eyebrow', {}, `Planet 1 of 7 · ${p.rule}`), h('h2', {}, p.name), h('div.eyebrow', {}, `Your crater: ${e.pole === 'N' ? 'North' : 'South'} pole · ${p.poles[e.pole].name}`)),
      h('div.readouts', {},
        h('div', {}, h('span.eyebrow', {}, 'Crater depth'), h('b', {}, `${this.craterDepth().toFixed(1)} m`)),
        h('div', {}, h('span.eyebrow', {}, 'Sea level'), h('b', {}, `+${M.seaLevelCm(e).toFixed(2)} cm`)),
        h('div', {}, h('span.eyebrow', {}, 'Heat spread'), h('b', {}, `${(M.heatSpread(e) * 100).toFixed(1)}%`)),
        h('div', {}, h('span.eyebrow', {}, 'Core'), h('b', {}, `${p.radiusM.toLocaleString('en-US')} m`))),
      h('div.legend', {},
        h('span', {}, h('i', { style: { background: '#ff8b52' } }), 'Heat rings spread from your pole'),
        h('span', {}, h('i', { style: { background: '#8fd6ec' } }), 'The crater glows brighter as it deepens'),
        h('span', {}, h('i', { style: { background: '#e6f1f4' } }), 'Ice cap edge retreats as heat spreads'),
        h('span', {}, 'Drag to turn · wheel to zoom · Tab to return')),
    );
    if (!this.planetDragBound) {
      this.planetDragBound = true;
      const cv = this.gfx.canvas;
      let d = null;
      cv.addEventListener('mousedown', (ev) => { if (this.view === 'planet') { d = { x: ev.clientX, y: ev.clientY }; this.planetView.dragging = true; } });
      addEventListener('mousemove', (ev) => { if (d && this.view === 'planet') { this.planetView.drag(ev.clientX - d.x, ev.clientY - d.y); d = { x: ev.clientX, y: ev.clientY }; } });
      addEventListener('mouseup', () => { d = null; this.planetView.dragging = false; });
      cv.addEventListener('wheel', (ev) => { if (this.view === 'planet') this.planetView.zoom(Math.sign(ev.deltaY)); }, { passive: true });
    }
  }

  // ---------- co-op glue ----------

  playerState() {
    const p = this.ctl.pos;
    const ts = this.tools.state(this.stats);
    return { p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], y: +this.ctl.yaw.toFixed(3), pi: +this.ctl.pitch.toFixed(3), f: ts.family, u: ts.using };
  }

  crewSnapshot() {
    return { econ: Save.econToJSON(this.econ), hm: this.volume.serialize(), ed: this.volume.serializeEdits(), state: { capsules: this.state.capsules, needle: this.state.needle }, beacon: this.works.beaconPos().toArray() };
  }

  crewLoad(snap) {
    this.save();
    this.slot = `crew.${this.crew.code}`;
    this.loadState({ econ: snap.econ, world: { hm: snap.hm, ed: snap.ed }, state: { ...snap.state }, beacon: snap.beacon });
    const b = this.works.beaconPos();
    const x = b.x + 1.5;
    this.ctl.teleport(x, this.volume.floorBelow(x, b.y + 2, b.z, 80) + 0.3, b.z);
    this.started = true;
    this.menus.close();
    this.hideLoading();
    this.clickPlay.hidden = false;
    this.hud.notice(`Crew ${this.crew.code}`, 'Shared vault, shared crater. Your own tools.', 'money');
    this.save();
  }

  crewEconPacket() {
    const e = this.econ;
    return { coins: e.coins.toJSON(), total: e.total.toJSON(), levels: e.levels, order: e.order, purchases: e.purchases, inflation: e.inflation, found: e.found, milestones: e.milestones, depth: e.depth, volume: e.volume, melted: e.melted, time: e.time, actions: e.actions, burstUntil: e.burstUntil };
  }

  crewEcon(p) {
    const e = this.econ;
    if (!e) return;
    const prevLevels = JSON.stringify(e.levels);
    const prevFound = Object.keys(e.found).length;
    Object.assign(e, { ...p, coins: Big.parse(p.coins), total: Big.parse(p.total) });
    if (JSON.stringify(e.levels) !== prevLevels || Object.keys(e.found).length !== prevFound) { this.statsDirty = true; this.menus.refresh(); }
  }

  crewAction(a, n) { this.econ.actions[a] = (this.econ.actions[a] || 0) + n; for (const s of M.discover(this.econ)) this.onResonance(s); }

  crewBuy(id) { const res = M.buy(this.econ, id); if (res) this.afterBuy(id, res); }

  crewCredit(v) { M.earn(this.econ, Big.fromNumber(v)); }

  crewEvent(ev) {
    if (ev.k === 'res') { const s = SYNERGY_BY_ID[ev.id]; if (s) { this.hud.notice('Resonance', `${s.name}. The crew found it.`, 'resonance'); this.music.cue('resonance'); } }
    else if (ev.k === 'ms') { const m = MILESTONES.find((x) => x.id === ev.id); if (m) { this.hud.notice(`${m.icon} Milestone: ${m.name}`, `+${format(Big.parse(ev.bonus))} coins for the crew.`, 'money'); this.music.cue('motif', m.motif); } }
    else if (ev.k === 'capsule') { this.state.capsules[ev.id] = Date.now(); this.hud.notice('Time capsule opened', `+${format(ev.bonus)} coins for the crew.`, 'money'); }
    else if (ev.k === 'needle') { this.state.needle = true; this.music.cue('stinger'); this.hud.notice('The Golden Needle', 'A crewmate found it.', 'money'); }
    else if (ev.k === 'chest') { (this.state.chests ||= {})[ev.id] = Date.now(); this.hud.notice('Supply chest', `A crewmate opened one: +${format(ev.bonus)} coins for the crew.`, 'money'); }
    else if (ev.k === 'buy') { this.sfx.play('buy', { step: this.econ.purchases }); }
  }

  async crewCreate() {
    this.save();
    const pole = this.econ ? this.econ.pole : 'N';
    const code = await this.crew.create(this.settings.crewName);
    if (!code || !this.crew.isHost) return;
    this.newCampaign(pole, `crew.${code}`);
    this.hud.notice(`Crew ${code} is open`, 'A fresh crater for the crew. Your solo game is saved separately.', 'money', 7000);
  }

  async crewJoin(code) { this.save(); await this.crew.join(code, this.settings.crewName); }

  async crewResume(code) {
    this.save();
    const data = Save.readSlot(`crew.${code}`);
    this.crew.code = code;
    const ok = await this.crew.startHost(code, false);
    if (ok && data) { this.slot = `crew.${code}`; this.loadState(data); }
  }

  crewLeave() {
    this.save();
    this.crew.leave();
    this.avatars.clear();
    const data = Save.readSlot('solo');
    this.slot = 'solo';
    if (data) this.loadState(data); else this.newCampaign(this.econ.pole, 'solo');
  }

  crewSlots() { return Save.listSlots().filter((s) => s.startsWith('crew.')).map((s) => s.slice(5)); }

  // ---------- save ----------

  snapshot() {
    const p = this.ctl.pos;
    return {
      econ: Save.econToJSON(this.econ),
      world: { hm: this.volume.serialize(), ed: this.volume.serializeEdits() },
      state: this.state,
      player: { pos: [p.x, p.y, p.z], yaw: this.ctl.yaw, pitch: this.ctl.pitch },
      beacon: this.works.beaconPos().toArray(),
    };
  }

  save() {
    if (!this.econ || !this.started) return;
    Save.writeSlot(this.slot, this.snapshot());
    this.lastSave = Date.now();
  }

  saveInfo() { return this.lastSave ? `Saved ${formatTime((Date.now() - this.lastSave) / 1000)} ago · slot ${this.slot}` : 'Not saved yet'; }

  async exportSave() { this.save(); return Save.exportCode(this.snapshot()); }

  async importSave(code) {
    const data = await Save.importCode(code);
    this.loadState(data);
    this.started = true;
    this.save();
    this.menus.close();
    this.clickPlay.hidden = false;
    this.hud.notice('Save imported', 'Welcome back to the ice.', 'money');
  }

  hardReset() {
    Save.deleteSlot(this.slot);
    this.menus.close();
    this.started = false;
    this.menus.show('start', (pole) => { this.newCampaign(pole, this.slot); this.clickPlay.hidden = false; });
  }

  readProfile() { try { return JSON.parse(localStorage.getItem('mtp.profile') || '{}'); } catch { return {}; } }
  writeProfile() { try { localStorage.setItem('mtp.profile', JSON.stringify(this.profile)); } catch { /* storage blocked */ } }

  saveSettings() {
    this.settings.bindings = { ...this.input.bindings };
    this.settings.crewName = this.crew.name;
    Save.writeSettings(this.settings);
  }

  applySettings(first) {
    const s = this.settings;
    const shadowKey = JSON.stringify(s.shadows);
    if (first || shadowKey !== this.lastShadowKey) { this.atmo.setupShadows(s.shadows); this.lastShadowKey = shadowKey; }
    this.gfx.apply(s);
    this.particles.density = s.particles;
    this.input.sensitivity = 0.0022 * s.sensitivity;
    this.input.invertY = s.invertY;
    Object.assign(this.audio.vol, s.volume);
    this.audio.applyVolumes();
    if (this.econ) FOG.uFogParams.value.x = s.fog ? this.planet.fogDensity : 0;
    FOG.uFogParams.value.w = s.fog ? 0.012 : 0;
    this.perf.visible = s.perfOverlay;
    numberFormat.scientific = s.scientific;
    if (!first) this.saveSettings();
  }

  unlockedThemes() { return ['frostara']; }

  // ---------- dev hooks ----------

  devJump(planetId, pole, depth) {
    if (!PLANET_BY_ID[planetId]?.available) return;
    if (pole !== this.econ.pole) { this.econ.pole = pole; this.resetWorld(); this.placeStart(); }
    if (depth > 0) this.devShaft(depth);
  }

  devShaft(depth) {
    const x = this.ctl.pos.x, z = this.ctl.pos.z;
    const top = surfaceY(x, z);
    for (let y = top; y > top - depth; y -= 1.4) this.volume.applyOp({ kind: 'dig', x, y, z, r: 2.4, seed: 1 });
    this.econ.depth = Math.max(this.econ.depth, depth);
    this.econ.volume += depth * 18;
    this.ctl.teleport(x, top - depth + 0.6, z);
  }

  devCoins(b) { M.earn(this.econ, b); }
  devFillPack() { const c = this.state.carried; c.count = this.stats.carry; c.value += this.coinValue(0, Math.max(1, this.econ.depth)) * 20; }
  devLevel(id, d) {
    const n = M.NODE_BY_ID[id];
    this.econ.levels[id] = Math.max(0, Math.min(n.max, (this.econ.levels[id] || 0) + d));
    if (this.econ.levels[id] && this.econ.order[id] === undefined) this.econ.order[id] = this.econ.purchases++;
    if (!this.econ.levels[id]) delete this.econ.levels[id];
    this.statsDirty = true;
    this.menus.refresh();
  }
  devBring(kind) { const e = this.ctl.eye(1), f = this.ctl.forward(); f.y = 0; f.normalize(); const p = e.clone().addScaledVector(f, 1.2); p.y -= 0.7; if (!this.frozen.devBring(kind, p)) this.hud.notice('Dev', `No ${kind} left on this planet.`); }
  devRevealNeedle() { const it = this.frozen.items.find((i) => i.kind === 'needle' && !i.done); if (it) { this.ctl.noclip = true; this.ctl.teleport(it.mesh.position.x + 1.2, it.mesh.position.y - 1, it.mesh.position.z); } }
  devMilestone(id) {
    const m = MILESTONES.find((x) => x.id === id);
    if (!m || this.econ.milestones[id] !== undefined) return;
    if (m.kind === 'depth') this.econ.depth = Math.max(this.econ.depth, m.value);
    else this.econ.melted = Math.max(this.econ.melted, 6000 * Math.pow(m.value / 5, 1 / 0.6) + 1);
    this.checkMilestones();
  }
  devCrewMilestone(id) { this.profile.crewMilestones = { ...(this.profile.crewMilestones || {}), [id]: Date.now() }; this.onCrewMilestones(this.profile.crewMilestones, [id]); }
  devResonance(id) { if (this.econ.found[id] !== undefined) return; this.econ.found[id] = this.econ.time; this.onResonance(SYNERGY_BY_ID[id]); }
  devOffline(sec) { this.showOffline(sec); }

  showOffline(sec) {
    const r = M.offlineGain(this.econ, sec);
    if (!(this.crew.active && !this.crew.isHost)) M.earn(this.econ, Big.fromNumber(r.coins));
    this.econ.volume += r.volume;
    this.suppressPause = true;
    this.input.unlock();
    this.menus.show('offline', r);
  }

  // ---------- loop ----------

  start() {
    const join = this.qs.get('join');
    if (this.slotOverride) this.slot = this.slotOverride;
    const data = Save.readSlot(this.slot);
    const begin = () => {
      this.started = true;
      this.hideLoading();
      this.clickPlay.hidden = false;
    };
    if (data) {
      this.loadState(data);
      begin();
      const away = (Date.now() - (data.savedAt || Date.now())) / 1000;
      if (away > 90) this.showOffline(away);
    } else {
      this.econ = M.createEcon('frostara', 'N');
      this.state = this.freshState();
      this.setupPlanet('frostara', 'N');
      this.frozen.setup(this.planet, 'N', this.planet.seed, this.state);
      this.placeStart();
      this.ctl.pitch = -0.08;
      this.hideLoading();
      if (!join) this.menus.show('start', (pole) => {
        this.newCampaign(pole, this.slot);
        begin();
        this.hud.notice('Welcome to Frostara', `Hold left mouse on the ice to dig. Coins go in your pack; stay near the glowing lift beacon to bank them. Buy upgrades at the blue Outfitter's hut ▣ nearby (press ${this.keyName('upgrades')} there).`, '', 14000);
      });
    }
    if (join) setTimeout(() => this.crewJoin(join), 300);
    this.last = performance.now();
    this.simAcc = 0; this.physAcc = 0; this.saveT = 10; this.hudT = 0; this.time = 0;
    this.scheduleFrame();
  }

  hideLoading() {
    if (this.loadingHidden) return;
    this.loadingHidden = true;
    const done = () => { this.loading.classList.add('done'); setTimeout(() => this.loading.remove(), 700); };
    const t0 = performance.now();
    const check = () => {
      const p = this.volume.pending();
      const bar = document.getElementById('load-bar');
      if (bar) bar.style.transform = `scaleX(${Math.min(1, (performance.now() - t0) / 4000 + 0.2)})`;
      if ((p < 6 && performance.now() - t0 > 600) || performance.now() - t0 > 9000) done(); else setTimeout(check, 120);
    };
    check();
  }

  scheduleFrame() {
    if (this.settings.vsync) requestAnimationFrame((t) => this.frame(t));
    else {
      if (!this.mc) { this.mc = new MessageChannel(); this.mc.port1.onmessage = () => this.frame(performance.now()); }
      this.mc.port2.postMessage(0);
    }
  }

  frame(now) {
    const s = this.settings;
    const minDt = s.fpsCap ? 1000 / s.fpsCap - 0.3 : 0;
    if (now - this.last < minDt) { this.scheduleFrame(); return; }
    const t0 = performance.now();
    const rdt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    try { this.tick(rdt); } catch (err) { console.error(err); }
    this.frameMs = performance.now() - t0;
    this.perf.frame(Math.max(this.frameMs, rdt * 1000), this.gfx.info());
    this.scheduleFrame();
  }

  tick(dt) {
    if (!this.econ) return;
    this.time += dt;
    const inp = this.input;
    const playing = this.started && this.view === 'fp' && !this.menus.open;
    const m = inp.consumeMouse();
    if (playing && inp.locked) {
      this.ctl.look(m.dx, m.dy, inp.sensitivity, inp.invertY);
      if (m.wheel) this.tools.cycle(m.wheel > 0 ? 1 : -1, this.stats);
    }
    // physics at 60 Hz
    this.physAcc += dt;
    const move = playing && inp.locked && !this.ride;
    this.updateRide(dt, playing && inp.locked && inp.is('jump'));
    while (this.physAcc >= PHYS_STEP && !this.ride) {
      this.ctl.step(PHYS_STEP, {
        forward: move ? (inp.is('forward') ? 1 : 0) - (inp.is('back') ? 1 : 0) : 0,
        strafe: move ? (inp.is('right') ? 1 : 0) - (inp.is('left') ? 1 : 0) : 0,
        sprint: move && inp.is('sprint'), jump: move && inp.is('jump') && !this.liftReady,
      });
      this.physAcc -= PHYS_STEP;
    }
    if (this.ride) this.physAcc = 0;
    // simulation at 30 Hz (scaled by dev fast-time)
    this.simAcc += dt * this.timeScale;
    let steps = 0;
    while (this.simAcc >= SIM_STEP && steps < 400) { this.simTick(SIM_STEP); this.simAcc -= SIM_STEP; steps++; }
    if (steps >= 400) this.simAcc = 0;

    const eye = this.ctl.eye(this.physAcc / PHYS_STEP);
    const cam = this.gfx.camera;
    cam.position.copy(eye);
    cam.position.y += this.viewLift();
    let pitch = this.ctl.pitch;
    if (this.view === 'toPlanet') pitch = THREE.MathUtils.lerp(this.ctl.pitch, -1.45, Math.min(1, this.viewT / 0.5));
    if (this.view === 'fpIn') pitch = THREE.MathUtils.lerp(-1.45, this.ctl.pitch, Math.min(1, this.viewT / 0.6));
    cam.quaternion.setFromEuler(new THREE.Euler(pitch, this.ctl.yaw, 0, 'YXZ'));
    cam.updateMatrixWorld();
    const dir = this.ctl.forward();
    const st = this.stats;
    const depthHere = this.depthAt(eye.x, eye.y, eye.z);

    const toolInput = playing && inp.locked ? inp : { is: () => false, was: () => false };
    this.tools.update(dt, toolInput, {
      eye, dir, st, move: this.ctl.vel.lengthSq() > 0.5,
      hardness: (d) => M.hardnessAt(this.econ, Math.max(0, d)), depthAt: (y) => surfaceY(eye.x, eye.z) - y,
    });
    this.sfx.loop('drill', !!(this.tools.drillOn && playing), { load: true });
    this.sfx.loop('torch', !!(this.tools.melting && playing), { lance: st.meltTier >= 2, load: !!this.tools.hit });

    this.volume.update(eye, 3);
    const chest = eye.clone().add(new THREE.Vector3(0, -0.45, 0));
    const carried = this.state.carried;
    this.coins.update(dt, eye, [{
      pos: chest, range: st.collectRange,
      canTake: () => carried.count + 1 <= st.carry,
      take: (c) => {
        carried.count += 1; carried.value += c.value; carried.ids.push(c.id);
        if (carried.ids.length > 400) carried.ids.splice(0, carried.ids.length - 400);
        this.sfx.play('clink', { tier: c.tier, gain: 0.7 });
        this.particles.glint(chest.clone().addScaledVector(dir, 0.6), COIN_RGB[c.tier], 0.12);
      },
    }], st.autoCollect);
    this.water.carry(this.coins, dt);
    this.water.antiRefreeze = st.meltEff;
    this.water.update(dt, this.time, this.atmo.sunDir, this.atmo.sunColor, this.atmo.depthDim);
    // the beacon hovers ahead and to your right, at the edge of your view
    // it stays parked until you move away from it, then re-parks
    const yw = this.ctl.yaw;
    const bt = this.beaconTarget;
    if (!bt || Math.hypot(bt.x - this.ctl.pos.x, bt.z - this.ctl.pos.z) > 3.5 || Math.abs(bt.y - this.ctl.pos.y) > 2) {
      // park ahead and to the right if there is room; in a narrow shaft fall back to other sides,
      // and finally to the open shaft right above your head
      const p = this.ctl.pos, fx = -Math.sin(yw), fz = -Math.cos(yw), rx = Math.cos(yw), rz = -Math.sin(yw);
      const spots = [[1.5, 1.6], [0, 1.8], [1.8, 0], [-1.8, 0], [-1.5, 1.6], [0, -1.8], [1, 1], [-1, 1]];
      let pick = null;
      for (const [r, f] of spots) {
        const x = p.x + rx * r + fx * f, z = p.z + rz * r + fz * f;
        if (this.volume.sdf(x, p.y + 1.2, z) < -0.75 && this.volume.sdf(x, p.y + 0.6, z) < -0.3) { pick = new THREE.Vector3(x, p.y, z); break; }
      }
      this.beaconTarget = pick || new THREE.Vector3(p.x, p.y + 1.3, p.z);
      this.beaconTarget.overhead = !pick;
    }
    const target = this.beaconTarget;
    // a lift that has fallen far behind (or got lost) is called straight to you
    if (!this.ride && this.works.beaconPos().distanceTo(this.ctl.pos) > 20) {
      this.works.beaconPos().set(target.x, target.overhead ? target.y + 1.3 : target.y + 1.2, target.z);
    }
    if (!this.ride) this.works.update(dt, this.time, target, st.liftSpeed, this.volume);
    else this.works.update(dt, this.time, this.works.beaconPos().clone(), 0, this.volume);
    this.updateBanking(dt, eye);
    this.needleHint = this.frozen.update(dt, this.time, this.ctl.pos, st.hint);
    this.updateTreasure(dt, eye);
    this.particles.update(dt, this.volume);
    this.coins.setLight(0.35 + 0.65 * this.atmo.depthDim, this.time);
    if (this.crew.active) { this.avatars.sync(this.crew.members); this.avatars.update(dt); }
    this.updateView(dt);

    this.atmo.update(dt, eye, depthHere);
    const u = this.iceMat.userData.uniforms;
    u.uSunDirW.value.copy(this.atmo.sunDir);
    u.uSunCol.value.copy(this.atmo.sunColor);
    u.uGradient.value = 0.3 + st.vision * 0.12;
    FOG.uFogSurfaceY.value = 0;
    this.tools.viewSun.color.copy(this.atmo.sunColor);
    this.gfx.viewScene.environment = this.gfx.scene.environment;
    this.gfx.grade.uniforms.uFlash.value.set(0.86, 0.94, 1.0, this.gfx.flash);

    this.audio.setListener(eye, dir);
    this.audio.setDepth(Math.max(0, depthHere));
    this.music.setDepth(this.craterDepth() / this.planet.goalDepth, this.tools.using ? 1 : 0);
    if (this.audio.ready) this.sfx.loop('wind', true, { level: 1 / (1 + Math.max(0, depthHere) / 12) });

    this.hudT -= dt;
    if (this.hudT <= 0 && (this.view === 'fp' || this.view === 'fpIn')) { this.hudT = 0.1; this.updateHud(depthHere); }

    this.gfx.render(dt, this.time);
    inp.endFrame();
  }

  simTick(dt) {
    const e = this.econ;
    e.time += dt;
    this.state.played = (this.state.played || 0) + dt;
    this.updateAutomation(dt);
    this.crew.tick(dt);
    e.depth = Math.max(e.depth, this.craterDepth());
    this.slowT = (this.slowT || 0) - dt;
    if (this.slowT <= 0) {
      this.slowT = 1;
      this.checkMilestones();
      if (!(this.crew.active && !this.crew.isHost)) for (const s of M.discover(e)) this.onResonance(s);
      this.statsDirty = true; // timing and pairing resonances can lapse
      if (this.menus.cur === 'pause') this.menus.refresh();
    }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 10; this.save(); const si = document.getElementById('saveinfo'); if (si) si.textContent = this.saveInfo(); }
  }

  updateHud(depthHere) {
    const e = this.econ, st = this.stats;
    const goal = M.nextGoal(e);
    const c = this.state.carried;
    const sp = strataProps(this.planet, e.pole, Math.max(0, depthHere));
    const visionUse = FAMILIES[this.tools.family].id === 'vision' && this.tools.using && this.tools.hit;
    let prompt = null;
    const deep = this.depthAt(this.ctl.pos.x, this.ctl.pos.y, this.ctl.pos.z) > 1.4;
    const full = c.count >= st.carry - 0.01;
    const jump = this.keyName('jump');
    if (this.ride) prompt = 'Riding the lift up';
    else if (this.atBeacon && deep) prompt = c.value > 0 ? `Banking your pack · hold ${jump} to ride the lift up` : `Hold ${jump} to ride the lift up and out of the crater`;
    else if (full) prompt = 'Pack full · walk to the glowing lift beacon ◆ to bank it';
    else if (deep && this.time - (this.liftHintAt || -99) < 6) prompt = `Stand by the glowing lift beacon ◆ and hold ${jump} to ride up`;
    // first-time explanations
    const tips = this.state.tips || (this.state.tips = {});
    if (full && !tips.full) { tips.full = 1; this.hud.notice('Your pack is full', 'Coins you free go into your pack first. They only count once banked: stand next to the glowing lift beacon ◆ (it follows you around) and the pack empties into the vault.', '', 12000); }
    if (deep && !tips.deep && this.craterDepth() > 2.5) { tips.deep = 1; this.liftHintAt = this.time; this.hud.notice('Getting out of the crater', `The lift beacon ◆ follows you down. Stand next to it and hold ${jump} to ride it up to the rim.`, '', 12000); }
    else if (!this.tools.available(st, this.tools.family)) prompt = FAMILIES[this.tools.family].id === 'planet' ? 'Planet tools arrive with later planets' : 'Locked · buy this tree\'s first upgrade';
    this.hud.update({
      coins: e.coins, rate: this.measuredRate(), carried: c.count, carryCap: st.carry, carriedValue: c.value * this.bankMult(),
      goal, goalReady: goal ? e.coins.gte(goal.cost) : false, goalProgress: goal ? e.coins.ratio(goal.cost) : 0,
      tiers: [st.digTier, st.meltTier, 0, st.visionTier].map((x) => Math.round(x)),
      crater: this.craterDepth(), radius: this.planet.radiusM, depth: Math.max(0, depthHere), stratum: sp.name,
      hard: M.hardnessAt(e, Math.max(0, depthHere)), reading: visionUse ? richness(this.tools.hit.point.x, this.tools.hit.point.y, this.tools.hit.point.z) : null,
      sea: M.seaLevelCm(e), resonances: Object.keys(e.found).length, hit: !!this.tools.hit, prompt, atBeacon: this.atBeacon, needleHint: this.needleHint,
    });
  }
}

export async function boot() {
  const g = new Game();
  g.init();
  window.__game = g;
  window.__THREE = THREE;
  g.start();
}
