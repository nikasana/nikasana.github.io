// Full-screen menus: pause, upgrades (node graph), notebook/collections, crew, music, settings,
// the start screen (pole choice), offline summary and confirmations.
import { h, clear } from './dom.js';
import { format, formatTime, numberFormat } from '../core/big.js';
import { TREES, NODES, NODE_BY_ID } from '../econ/data/nodes.js';
import { FREEZE_TREE, skinNode, REVERSE } from '../econ/data/freeze.js';
import { SYNERGIES } from '../econ/data/synergies.js';
import { MILESTONES, CREW_MILESTONES, CAPSULES, ROLES, ROLE_BY_ID } from '../econ/data/milestones.js';
import { THEMES, VARIATIONS } from '../audio/themes.js';
import { PRESETS } from '../render/graphics.js';
import { ACTION_LABELS, keyLabel } from '../player/input.js';
import * as M from '../econ/model.js';
import { PLANETS } from '../econ/data/planets.js';
import { COINS } from '../econ/data/coins.js';
import { FINDS } from '../econ/data/finds.js';
import { MUTANTS, MUTANT_BY_ID } from '../econ/data/mutants.js';

const TREE = Object.fromEntries(TREES.map((t) => [t.id, t]));

export class Menus {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.cur = null;
    this.el = null;
  }

  get open() { return !!this.cur; }

  close() {
    if (!this.el) return;
    const el = this.el;
    el.classList.add('closing');
    // stop catching input at once; the fade-out is purely visual
    el.classList.remove('interactive');
    el.style.pointerEvents = 'none';
    for (const n of el.querySelectorAll('*')) n.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), 170);
    if (this.cur === 'upgrades' && this.tree) { this.tree.destroy(); this.tree = null; }
    this.el = null;
    this.cur = null;
    this.game.onMenuChange(null);
  }

  show(name, ...args) {
    if (this.el) { this.el.remove(); if (this.tree) { this.tree.destroy(); this.tree = null; } }
    for (const stale of this.root.querySelectorAll('.menu.closing')) stale.remove();
    this.cur = name;
    this.el = this[`build_${name}`](...args);
    this.el.classList.add('interactive');
    this.root.appendChild(this.el);
    this.game.onMenuChange(name);
    this.game.sfx.play('open');
  }

  toggle(name) { if (this.cur === name) this.close(); else this.show(name); }

  frame(title, body, tabs) {
    const head = h('div.menu-head', {}, h('h1', {}, title), tabs || h('div', { style: { marginLeft: 'auto' } }),
      h('button.close-x', { onclick: () => this.close() }, 'ESC  CLOSE'));
    return h('div.menu', {}, head, body);
  }

  refresh() {
    if (!this.cur) return;
    if (this.cur === 'upgrades' && this.tree) { this.tree.refresh(); return; }
    if (this.cur === 'pause' && this.pauseStats) this.fillPauseStats();
    if (this.cur === 'crew' && this.crewRefresh) this.crewRefresh();
  }

  // ---------- pause ----------

  build_pause() {
    const g = this.game;
    const k = (a) => keyLabel(g.input.code(a));
    const nav = [
      ['Resume', 'Esc', () => { this.close(); g.input.lock(); }],
      ['Saves & new game', '', () => this.show('start')],
      ...(g.state.complete && M.nextPlanet(g.econ) ? [[`Travel to ${M.nextPlanet(g.econ).name}`, '', () => this.show('travel')]] : []),
      ['Upgrades', k('upgrades'), () => { if (g.canUpgrade()) this.show('upgrades'); else { this.close(); g.input.lock(); g.upgradeAway(); } }],
      ['Planet view', k('planet'), () => { this.close(); g.togglePlanet(true); }],
      ['Notebook', k('collections'), () => this.show('collections')],
      ['Crew', k('coop'), () => this.show('crew')],
      ['Music', k('music'), () => this.show('music')],
      ['Settings', '', () => this.show('settings')],
    ];
    this.pauseStats = h('div.pause-stats');
    this.fillPauseStats();
    const p = g.planet;
    return h('div.menu', {}, h('div.pause', {},
      h('div.pause-left', {},
        h('div.eyebrow', {}, `${p.name} · ${g.econ.pole === 'N' ? 'North' : 'South'} pole`),
        h('div.title', {}, 'Melt the', h('span', {}, 'Planet')),
        h('div.sub', {}, 'Dig straight down through the ice. Every coin goes up the lift.'),
        h('div.pause-nav', {}, nav.map(([l, key, fn]) => h('button', { onclick: fn, onmouseenter: () => g.sfx.play('hover') }, l, key ? h('kbd', {}, key) : null))),
      ),
      h('div.pause-right', {},
        h('div.eyebrow', {}, 'Survey log'),
        this.pauseStats,
        h('div.eyebrow', { id: 'saveinfo' }, g.saveInfo()),
      ),
    ));
  }

  fillPauseStats() {
    const g = this.game, e = g.econ;
    const cells = [
      ['Vault', format(e.coins)], ['Crater', `${g.craterDepth().toFixed(1)} m`], ['Upgrades bought', e.purchases], ['Resonances', `${Object.keys(e.found).length} / ${SYNERGIES.length}`],
      ['Time on planet', formatTime(e.time)], ['Sea level', `+${M.seaLevelCm(e).toFixed(2)} cm`], ['Lifetime earned', format(e.total)], ['Milestones', `${Object.keys(e.milestones).length} / ${MILESTONES.filter((m) => m.planet === '*' || m.planet === e.planet).length}`],
    ];
    clear(this.pauseStats).append(...cells.map(([a, b]) => h('div', {}, h('span.eyebrow', {}, a), h('b', {}, String(b)))));
  }

  // ---------- upgrades ----------

  build_upgrades() {
    const wrap = h('div.tree-wrap');
    const body = h('div', { style: { position: 'relative', minHeight: 0 } }, wrap);
    const el = this.frame('Upgrades', body);
    this.tree = new TreeView(wrap, this.game, this);
    return el;
  }

  // ---------- notebook ----------

  build_collections(tab = 'resonance') {
    const g = this.game, e = g.econ;
    const body = h('div.menu-body');
    const tabs = h('div.tabs');
    const setTab = (t) => {
      for (const b of tabs.children) b.classList.toggle('on', b.dataset.t === t);
      clear(body);
      if (t === 'resonance') {
        body.append(h('p', { style: { color: 'var(--haze)', maxWidth: '64ch', marginTop: 0 } },
          'Some upgrades and habits work better together. When you find one, it is written here. The blanks are still out there; the riddle under each is all the notebook knows.'));
        body.append(h('div.coll', {}, SYNERGIES.map((s) => {
          const found = e.found[s.id] !== undefined;
          return h(`div.card${found ? '' : '.blank'}`, {},
            h('h4', {}, found ? s.name : '— — — — —'),
            h('p', {}, found ? s.desc : `“${s.hint}”`),
            found ? h('span.when', {}, `Found at ${formatTime(e.found[s.id])}`) : null);
        })));
      } else if (t === 'finds') {
        const seen = g.profile.findTypes || {};
        body.append(h('p', { style: { color: 'var(--haze)', maxWidth: '64ch', marginTop: 0 } }, 'Things frozen in the ice. Shallow ice keeps lost gear; deeper down are supplies, relics and stranger things.'));
        body.append(h('div.coll', {}, FINDS.map((f) => h(`div.card${seen[f.id] ? '' : '.blank'}`, {},
          h('h4', {}, seen[f.id] ? `${f.icon} ${f.name}` : '? ? ? ? ?'),
          h('p', {}, seen[f.id] ? f.desc : `Somewhere between ${f.min} and ${f.max === 400 ? 'the deepest ice' : `${f.max} m`}.`)))));
      } else if (t === 'capsules') {
        const done = { ...(g.profile.capsules || {}), ...(g.state.capsules || {}) };
        body.append(h('div.coll', {}, CAPSULES.map((c) => h(`div.card${done[c.id] ? '' : '.blank'}`, {},
          h('h4', {}, done[c.id] ? c.name : 'Unopened capsule'),
          h('p', {}, done[c.id] ? c.contents.lore : `${c.planet[0].toUpperCase() + c.planet.slice(1)}, frozen around ${c.depth} m down.${c.puzzle ? ({ heat: ' Frost-sealed.', light: ' Light-sealed.', tide: ' Tide-sealed.' }[c.puzzle.kind]) : ''}`))),
          h(`div.card${g.state.needle ? '' : '.blank'}`, {}, h('h4', {}, g.state.needle ? 'The Golden Needle' : 'Golden Needle'),
            h('p', {}, g.state.needle ? 'Found. One per planet, and this one is yours.' : 'One is hidden on every planet. Needle Sense helps you feel for it.'))));
      } else if (t === 'mutations') {
        body.append(h('p', { style: { color: 'var(--haze)', maxWidth: '64ch', marginTop: 0 } },
          'Rare pockets of strange ice hide in the crater walls. Every kind you dig into is written here, with the DNA it unlocks.'));
        const found = g.profile.mutations || {};
        body.append(h('div.coll', {}, MUTANTS.map((m) => {
          const ok = found[m.id] !== undefined;
          return h(`div.card${ok ? '' : '.blank'}`, { style: ok ? { borderColor: `rgb(${m.color.map((c) => Math.round(c * 200)).join(',')})` } : {} },
            h('h4', {}, ok ? m.name : '? ? ? ? ?'),
            h('p', {}, ok ? m.desc : `A silhouette in the ice. Found on ${m.planet[0].toUpperCase() + m.planet.slice(1)}.`),
            ok ? h('p', { style: { color: 'var(--moss)' } }, m.perk) : '');
        })));
      } else if (t === 'postcards') {
        const cards = g.profile.postcards || {};
        body.append(h('p', { style: { color: 'var(--haze)', maxWidth: '64ch', marginTop: 0 } }, 'A postcard is kept for every planet you melt through.'));
        body.append(h('div.coll', {}, PLANETS.filter((p) => p.available).map((p) => {
          const pc = cards[p.id];
          return h(`div.card${pc ? '' : '.blank'}`, {},
            pc ? h('img', { src: pc.img, alt: `${p.name} postcard`, style: { width: '100%', display: 'block', marginBottom: '8px' } }) : '',
            h('h4', {}, `${p.icon} ${p.name}`),
            h('p', {}, pc ? `Melted through at the ${pc.pole === 'S' ? 'South' : 'North'} pole, ${Math.round(pc.depth)} m.` : 'Not yet. Reach the goal depth to send a postcard.'));
        })));
      } else if (t === 'coins') {
        const seen = g.profile.coinTypes || {};
        const kinds = COINS.filter((c) => !c.special);
        body.append(h('p', { style: { color: 'var(--haze)', margin: '0 0 10px' } }, `${kinds.filter((c) => seen[c.id]).length} of ${kinds.length} kinds found. Deeper layers hold new kinds; each world has one of its own. Bigger coins of a kind are worth more. Chests: ${seen.chest ? 'found' : 'not yet'}.`),
          h('div.coll', {}, kinds.map((c) => {
            const pl = c.planet ? PLANETS.find((p) => p.id === c.planet) : null;
            return h(`div.card${seen[c.id] ? '' : '.blank'}`, {},
              h('h4', {}, seen[c.id] ? `${c.icon} ${c.name}` : '? ? ? ? ?'),
              h('p', {}, `From about ${c.minDepth} m${pl ? ` · only on ${pl.icon} ${pl.name}` : ''}${seen[c.id] ? ` · worth ${c.value.toLocaleString('en-US')}× a copper` : ''}`));
          })));
      } else if (t === 'milestones') {
        body.append(h('div.coll', {}, MILESTONES.filter((m) => m.planet === '*' || m.planet === e.planet).map((m) => h(`div.card${e.milestones[m.id] !== undefined ? '' : '.blank'}`, {},
          h('h4', {}, `${m.icon} ${m.name}`), h('p', {}, e.milestones[m.id] !== undefined ? `Reached at ${formatTime(e.milestones[m.id])}. Paid ${m.bonusSec} s of income.` : `Pays ${m.bonusSec} s of income.`)))));
      }
    };
    for (const [id, l] of [['resonance', 'Resonance notebook'], ['mutations', 'Mutation log'], ['finds', 'Finds'], ['coins', 'Coins'], ['capsules', 'Capsules & needle'], ['milestones', 'Milestones'], ['postcards', 'Postcards']]) {
      const b = h('button.tab', { onclick: () => setTab(id) }, l);
      b.dataset.t = id;
      tabs.append(b);
    }
    const el = this.frame('Notebook', body, tabs);
    setTab(tab);
    return el;
  }

  // ---------- crew ----------

  build_crew() {
    const g = this.game, c = g.crew;
    const body = h('div.menu-body');
    const status = h('div.status');
    const left = h('div.panel');
    const right = h('div.panel');
    body.append(h('div.coop', {}, left, right));
    const nameIn = h('input', { type: 'text', id: 'crew-name', value: c.name, maxlength: 18, style: { textTransform: 'none', letterSpacing: '0.02em' } });
    nameIn.addEventListener('change', () => { c.name = nameIn.value.trim() || 'Surveyor'; g.saveSettings(); });
    const codeIn = h('input', { type: 'text', id: 'crew-code', placeholder: 'CODE', maxlength: 6 });
    const render = () => {
      clear(left); clear(right);
      status.textContent = c.status;
      status.className = `status ${c.statusKind}`;
      if (!c.active) {
        left.append(h('h3', {}, 'Start a crew'),
          h('p', { style: { color: 'var(--haze)', margin: 0 } }, 'A crew is a saved campaign you share: one vault, one crater, one planet. Up to four players, each with their own tools.'),
          h('label.eyebrow', { for: 'crew-name' }, 'Your name'), nameIn,
          h('div', { style: { display: 'flex', gap: '8px' } }, h('button.btn.primary', { onclick: async () => { c.name = nameIn.value.trim() || 'Surveyor'; await g.crewCreate(); render(); } }, 'Create crew')),
          status);
        right.append(h('h3', {}, 'Join a crew'),
          h('p', { style: { color: 'var(--haze)', margin: 0 } }, 'Enter the six-letter code from your crew, or open their link.'),
          codeIn,
          h('button.btn', { onclick: async () => { c.name = nameIn.value.trim() || 'Surveyor'; if (codeIn.value.trim()) await g.crewJoin(codeIn.value); render(); } }, 'Join'),
          g.crewSlots().length ? h('div', {}, h('div.eyebrow', { style: { margin: '12px 0 6px' } }, 'Your crews'),
            h('div.members', {}, g.crewSlots().map((code) => h('div', {}, h('span', {}, code), h('span', {},
              h('button.btn', { style: { padding: '4px 8px' }, onclick: async () => { await g.crewJoin(code); render(); } }, 'Rejoin'), ' ',
              h('button.btn', { style: { padding: '4px 8px' }, onclick: async () => { await g.crewResume(code); render(); } }, 'Host'))))))
            : '');
      } else {
        const link = c.link();
        left.append(h('div.eyebrow', {}, c.isHost ? 'You host this crew' : 'Crew'), h('div.code', {}, c.code),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button.btn.primary', { onclick: (ev) => { navigator.clipboard?.writeText(link).then(() => { ev.target.textContent = 'Link copied'; }, () => { linkBox.select(); }); } }, 'Copy invite link'),
            c.lostHost ? h('button.btn', { onclick: async () => { await c.resumeAsHost(); render(); } }, 'Resume as host') : null,
            h('button.btn.danger', { onclick: () => { g.crewLeave(); render(); } }, 'Leave crew')),
          h('div.eyebrow', {}, 'Members'), h('div.members', {}, c.memberList().map((m) => h('div', {}, h('span', {}, `${m.role ? ROLE_BY_ID[m.role].icon + ' ' : ''}${m.name}`), h('span', {}, [m.role ? ROLE_BY_ID[m.role].name : '', m.host ? 'host' : ''].filter(Boolean).join(' · '))))),
          h('div.eyebrow', {}, 'Your role (optional)'),
          h('div.roles', {}, [null, ...ROLES].map((r) => h(`button.btn${(g.settings.crewRole || null) === (r ? r.id : null) ? '.primary' : ''}`, {
            title: r ? r.desc : 'No specialty.',
            onclick: () => { g.settings.crewRole = r ? r.id : null; g.saveSettings(); g.statsDirty = true; render(); },
          }, r ? `${r.icon} ${r.name}` : 'None'))),
          h('p.small', { style: { color: 'var(--haze)', margin: 0 } }, `${(g.settings.crewRole && ROLE_BY_ID[g.settings.crewRole].desc) || 'Pick a tool tree to specialise in.'} A crew with different roles shares a bonus: now ×${c.mix.toFixed(2)} income (+4% for each extra role).`),
          status);
        const linkBox = h('input', { type: 'text', value: link, readonly: true, style: { textTransform: 'none', fontSize: '12px', letterSpacing: 0 } });
        left.append(linkBox);
        right.append(h('h3', {}, 'Crew milestones'),
          h('p', { style: { color: 'var(--haze)', margin: 0 } }, 'Shared goals. Each one gives every member a permanent bonus, solo play included.'),
          h('div.ms', {}, CREW_MILESTONES.map((m) => {
            const v = c.progress[m.kind] || 0;
            const done = !!c.done[m.id];
            return h('div', {}, h('span', {}, `${m.icon} ${m.name}`), h('span', { style: { color: done ? 'var(--moss)' : 'var(--haze)' } }, done ? 'Done' : `${Math.floor(Math.min(v, m.value)).toLocaleString('en-US')} / ${m.value.toLocaleString('en-US')}`),
              h('div.bar', {}, h('i', { style: { width: `${Math.min(100, (v / m.value) * 100)}%` } })));
          })));
      }
    };
    this.crewRefresh = () => { if (this.cur === 'crew') { status.textContent = c.status; status.className = `status ${c.statusKind}`; } };
    render();
    c.on('status', () => this.cur === 'crew' && render());
    c.on('members', () => this.cur === 'crew' && render());
    return this.frame('Crew', body);
  }

  // ---------- music ----------

  build_music() {
    const g = this.game;
    const body = h('div.menu-body');
    const list = h('div.music-list');
    const render = () => {
      clear(list);
      THEMES.forEach((t, i) => {
        const locked = t.locked || !g.unlockedThemes().includes(t.id);
        list.append(h(`button${g.music.theme.id === t.id ? '.on' : ''}${locked ? '.locked' : ''}`, {
          onclick: () => { if (locked) return; g.music.setTheme(t.id); g.settings.theme = t.id; g.saveSettings(); render(); },
        }, h('span.ix', {}, String(i + 1).padStart(2, '0')), h('span.nm', {}, t.name, h('small', {}, locked ? `Unlocks with ${t.planet[0].toUpperCase() + t.planet.slice(1)}.` : t.desc)),
          h('span.eyebrow', {}, g.music.theme.id === t.id ? 'Playing' : locked ? 'Locked' : '')));
      });
    };
    render();
    // variations unlocked in the Audio tree
    const vars = h('div.music-list', { style: { marginTop: '18px' } });
    const renderVars = () => {
      clear(vars);
      for (const v of VARIATIONS) {
        const owned = !v.node || M.level(g.econ, v.node) >= 1;
        const on = (g.settings.variation || 'base') === v.id;
        vars.append(h(`button${on ? '.on' : ''}${owned ? '' : '.locked'}`, { onclick: () => { if (!owned) return; g.settings.variation = v.id; g.saveSettings(); g.music.setVariation(v.id); renderVars(); } },
          h('span.ix', {}, '~'), h('span.nm', {}, v.name, h('small', {}, owned ? v.desc : 'Unlock it in the Audio tree.')), h('span.eyebrow', {}, on ? 'On' : owned ? '' : 'Locked')));
      }
    };
    renderVars();
    const tog = h(`button.toggle${g.settings.musicOn ? '.on' : ''}`, { 'aria-label': 'Music on', onclick: () => { g.settings.musicOn = !g.settings.musicOn; tog.classList.toggle('on', g.settings.musicOn); g.music.setEnabled(g.settings.musicOn); g.saveSettings(); } });
    body.append(h('p', { style: { color: 'var(--haze)', maxWidth: '64ch', marginTop: 0 } },
      'The score is played live and never repeats exactly. New layers enter as the crater deepens: sparse at the surface, a pulse in the middle depths, weight and brass deep down, and everything near the core.'),
      h('div.set-row', { style: { maxWidth: '760px', marginBottom: '16px' } }, h('div.lbl', {}, 'Music'), h('div.ctl', {}, tog)),
      list, h('div.eyebrow', { style: { marginTop: '22px' } }, 'Variations'), vars);
    return this.frame('Music', body);
  }

  // ---------- settings ----------

  build_settings(section = 'graphics') {
    const g = this.game, s = g.settings;
    const body = h('div.menu-body');
    const nav = h('nav');
    const pane = h('div');
    body.append(h('div.settings', {}, nav, pane));
    const apply = () => { g.applySettings(); };
    const row = (label, ctl, sub) => h('div.set-row', {}, h('div.lbl', {}, label, sub ? h('small', {}, sub) : null), h('div.ctl', {}, ctl));
    const seg = (key, opts, cb) => {
      const el = h('div.seg');
      for (const [v, l] of opts) {
        el.append(h(`button${s[key] === v ? '.on' : ''}`, { onclick: () => { s[key] = v; if (cb) cb(v); apply(); show(cur); } }, l));
      }
      return el;
    };
    const toggle = (key, cb) => h(`button.toggle${s[key] ? '.on' : ''}`, { 'aria-label': key, onclick: (ev) => { s[key] = !s[key]; ev.currentTarget.classList.toggle('on', s[key]); if (cb) cb(); s.preset = 'custom'; apply(); } });
    const slider = (key, min, max, step, fmt, cb) => {
      const val = h('span.val', {}, fmt(s[key]));
      const inp = h('input', { type: 'range', min, max, step, value: s[key], id: `set-${key}` });
      inp.addEventListener('input', () => { s[key] = +inp.value; val.textContent = fmt(s[key]); if (cb) cb(); apply(); });
      return h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, inp, val);
    };
    const vslider = (key) => {
      const val = h('span.val', {}, `${Math.round(s.volume[key] * 100)}%`);
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: s.volume[key], id: `vol-${key}` });
      inp.addEventListener('input', () => { s.volume[key] = +inp.value; val.textContent = `${Math.round(s.volume[key] * 100)}%`; apply(); });
      return h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, inp, val);
    };
    let cur = section;
    const show = (sec) => {
      cur = sec;
      for (const b of nav.children) b.classList.toggle('on', b.dataset.s === sec);
      clear(pane);
      if (sec === 'graphics') {
        pane.append(
          h('div.set-group', {}, h('h3', {}, 'Quality'),
            row('Preset', seg('preset', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], (v) => Object.assign(s, PRESETS[v], { preset: v })), 'Sets everything below; change any item to customise.'),
            row('Render scale', slider('renderScale', 0.5, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`, () => { s.preset = 'custom'; })),
            row('Shadows', seg('shadowQ', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], (v) => { s.shadows = PRESETS[v].shadows; s.preset = 'custom'; })),
            row('Ice detail', seg('iceQuality', [[0, 'Simple'], [1, 'Bubbles'], [2, 'Full']], () => { s.preset = 'custom'; }), 'Bubbles and fracture planes inside the ice.'),
            row('Particles', seg('particles', [[0.5, 'Few'], [0.75, 'Some'], [1, 'Many'], [1.4, 'Max']], () => { s.preset = 'custom'; })),
          ),
          h('div.set-group', {}, h('h3', {}, 'Display'),
            row('V-Sync', toggle('vsync'), 'Off renders as fast as the frame cap allows.'),
            row('Frame cap', seg('fpsCap', [[30, '30'], [60, '60'], [120, '120'], [144, '144'], [0, 'Unlimited']])),
            row('Field of view', slider('fov', 60, 110, 1, (v) => `${v}°`)),
            row('Performance overlay', toggle('perfOverlay'), 'Frame rate, frame time, draw calls.'),
          ),
          h('div.set-group', {}, h('h3', {}, 'Effects'),
            row('Ambient occlusion', toggle('ao')), row('Bloom', toggle('bloom')), row('Anti-aliasing (SMAA)', toggle('smaa')),
            row('Colour grading', toggle('grade')), row('Film grain', toggle('grain')), row('Vignette', toggle('vignette')),
            row('Height & depth fog', toggle('fog')),
            row('Tone mapping', seg('toneMapping', [['aces', 'ACES'], ['agx', 'AgX']])),
          ),
        );
      } else if (sec === 'audio') {
        pane.append(h('div.set-group', {}, h('h3', {}, 'Volume'),
          row('Master', vslider('master')), row('Music', vslider('music')), row('Effects', vslider('sfx')), row('Ambience', vslider('amb'))));
      } else if (sec === 'controls') {
        const binds = h('div.set-group', {}, h('h3', {}, 'Keys'));
        binds.append(h('p.small', { style: { color: 'var(--haze)', margin: '0 0 6px' } }, 'Click a key, then press the new one (or a mouse button). A key that is already in use swaps with it. Esc cancels.'));
        for (const [a, label0] of Object.entries(ACTION_LABELS)) {
          const label = a === 'tool2' && g.econ?.reverse ? 'Freeze tools' : label0;
          const cap = h('button.keycap', {}, keyLabel(g.input.bindings[a]));
          cap.addEventListener('click', () => {
            cap.classList.add('listening'); cap.textContent = 'Press a key';
            g.input.rebind(a, (b) => { s.bindings = { ...b }; g.saveSettings(); g.hud.invalidateKeys(); show('controls'); });
          });
          binds.append(row(label, cap));
        }
        binds.append(row('Pause', h('span.val', {}, 'Esc (fixed)'), 'Always Esc, so you can never lock yourself out of the menus.'));
        binds.append(row('Restore defaults', h('button.btn', { onclick: () => { s.bindings = {}; g.input.bindings = { ...g.defaultBindings }; g.saveSettings(); g.hud.invalidateKeys(); show('controls'); } }, 'Reset keys')));
        pane.append(h('div.set-group', {}, h('h3', {}, 'Mouse'),
          row('Sensitivity', slider('sensitivity', 0.3, 3, 0.05, (v) => v.toFixed(2))),
          row('Invert vertical look', toggle('invertY'))), binds);
      } else if (sec === 'access') {
        const flag = (key) => h(`button.toggle${s[key] ? '.on' : ''}`, { 'aria-label': key, onclick: (ev) => { s[key] = !s[key]; ev.currentTarget.classList.toggle('on', s[key]); g.saveSettings(); } });
        pane.append(
          h('div.set-group', {}, h('h3', {}, 'Seeing'),
            row('Colour-safe markers', flag('colorSafe'), 'Compass and map markers use a palette that stays distinct with colour blindness. Every marker also has its own shape.'),
            row('Reduce flashing', flag('reduceFlash'), 'No bright flash when you find the Golden Needle.')),
          h('div.set-group', {}, h('h3', {}, 'Hearing'),
            row('Captions for musical cues', flag('captions'), 'A short caption when the music marks an event: resonances, milestones, big finds, capsules, auroras.')),
          h('div.set-group', {}, h('h3', {}, 'Comfort'),
            row('Camera shake', h('span.val', {}, 'Never'), 'The camera never shakes, at any setting.'),
            row('Mouse sensitivity, field of view, keys', h('button.btn', { onclick: () => show('controls') }, 'Controls'))),
        );
      } else if (sec === 'game') {
        const box = h('textarea.code', { id: 'save-code', placeholder: 'Your save code appears here. Paste one to import.' });
        const msg = h('div.status');
        pane.append(
          h('div.set-group', {}, h('h3', {}, 'Numbers'), row('Scientific notation', toggle('scientific', () => { numberFormat.scientific = s.scientific; }))),
          h('div.set-group', {}, h('h3', {}, 'Style'), ...[['styleGold', 'Gilded Pick'], ['styleObsid', 'Obsidian Tools'], ['styleWarm', 'Warm Crater Light'], ['styleWide', 'Wide Lens']].map(([k, label]) => {
            const owned = g.stats[k] >= 1;
            if (!owned) return row(label, h('span.val', {}, 'Style tree'));
            const t = h(`button.toggle${!(s.styleOff || {})[k] ? '.on' : ''}`, { onclick: () => { s.styleOff = { ...(s.styleOff || {}), [k]: !(s.styleOff || {})[k] }; t.classList.toggle('on', !s.styleOff[k]); g.styleKey = null; g.saveSettings(); } });
            return row(label, t);
          })),
          h('div.set-group', {}, h('h3', {}, 'Save'),
            row('Auto-save', h('span.val', {}, 'Every 10 s and on exit')),
            row('Export', h('button.btn', { onclick: async () => { box.value = await g.exportSave(); box.select(); msg.textContent = 'Copy this code somewhere safe.'; } }, 'Make save code')),
            row('Import', h('button.btn', { onclick: async () => { try { await g.importSave(box.value); msg.textContent = 'Imported.'; } catch (e) { msg.textContent = e.message; msg.className = 'status bad'; } } }, 'Load from code')),
            h('div', { style: { background: 'rgba(8,20,28,0.92)', padding: '10px 14px', display: 'grid', gap: '8px' } }, box, msg),
            row('Hard reset', h('button.btn.danger', { onclick: () => this.confirm('Erase this save?', 'Your vault, crater and upgrades on this slot are deleted. Settings stay.', 'Erase save', () => g.hardReset()) }, 'Erase save…'), 'Deletes the current slot.'),
          ));
      }
    };
    for (const [id, l] of [['graphics', 'Graphics'], ['audio', 'Audio'], ['controls', 'Controls'], ['access', 'Accessibility'], ['game', 'Game']]) {
      const b = h('button', { onclick: () => show(id) }, l);
      b.dataset.s = id;
      nav.append(b);
    }
    show(section);
    return this.frame('Settings', body);
  }

  // ---------- start / offline / confirm ----------

  build_start(onBegin) {
    const g = this.game, p = g.planet;
    let pole = 'N';
    const cards = h('div.poles');
    const render = () => {
      clear(cards);
      for (const k of ['N', 'S']) {
        const P = p.poles[k];
        cards.append(h(`button.pole${pole === k ? '.on' : ''}`, { onclick: () => { pole = k; render(); g.sfx.play('click'); } },
          h('span.nm', {}, k === 'N' ? 'North pole' : 'South pole'), h('h3', {}, P.name), h('p', {}, P.desc),
          h('div.strata', {}, P.strata.slice(0, 5).map((s) => h('i', { style: { background: `rgb(${s.color.map((c) => Math.round(c * 255)).join(',')})` } })))));
      }
    };
    render();
    return h('div.start', {},
      h('div.start-left', {},
        h('div.eyebrow', {}, `Planet 1 of 7 · ${p.name}`),
        h('div.title', {}, 'Melt the', h('span', {}, 'Planet')),
        h('p.lede', {}, `${p.name} is frozen to the core. Pick a pole and dig. Coins lie in seams through the ice and stranger things are frozen deeper down; the lift beacon follows you, and the Outfitter's hut on the surface sells upgrades.`),
        h('div.eyebrow', {}, 'Choose your pole. You stay there for the whole planet.'),
        cards,
        h('div.start-actions', {}, h('button.btn.primary', { onclick: () => { this.close(); if (onBegin) onBegin(pole); else g.newSave(pole); } }, 'Begin a new survey'),
          g.reverseUnlocked() ? h('button.btn', { title: 'Reverse Mode: freeze the worlds back. Same tools and trees, shorter goals.', onclick: () => { this.close(); g.newReverse(pole); } }, '❄️ Make It Snow') : '',
          g.started ? h('button.btn', { onclick: () => { this.close(); g.input.lock(); } }, 'Back to the ice') : ''),
        h('div.start-foot', {}, g.touch ? 'Touch: your left thumb moves (push to the edge to sprint), drag anywhere else to look, hold USE to dig, JUMP rides the lift. Upgrades are at the terminal in the Outfitter\u2019s hut. ☰ pauses.' : 'Mouse and keyboard. WASD to move, left mouse to use your tool, the terminal in the Outfitter\u2019s hut for upgrades, Esc to pause.'),
      ),
      this.savesList(),
    );
  }

  // Saved playthroughs: continue, resume or rejoin a crew, or delete.
  savesList() {
    const g = this.game;
    const wrap = h('div.saves');
    const render = () => {
      clear(wrap);
      const list = g.listSaves();
      wrap.append(h('div.eyebrow', {}, list.length ? 'Your surveys' : 'No saved surveys yet'));
      for (const s of list) {
        const when = s.savedAt ? `${formatTime((Date.now() - s.savedAt) / 1000)} ago` : '';
        const pl = PLANETS.find((x) => x.id === s.planet);
        const title = `${s.crew ? `Crew ${s.crew}` : s.reverse ? '❄️ Make It Snow' : 'Solo'} · ${pl ? `${pl.icon} ${pl.name}, ` : ''}${s.pole === 'S' ? 'South' : 'North'} pole`;
        const current = g.started && g.slot === s.slot;
        const actions = s.crew
          ? [h('button.btn.primary', { onclick: () => g.continueSave(s.slot) }, 'Resume as host'), h('button.btn', { onclick: () => { this.close(); g.crewJoin(s.crew); } }, 'Rejoin')]
          : [h('button.btn.primary', { onclick: () => (current ? (this.close(), g.input.lock()) : g.continueSave(s.slot)) }, current ? 'Playing' : 'Continue')];
        actions.push(h('button.btn.danger', { onclick: () => this.confirm('Delete this survey?', `${title} will be gone for good.`, 'Delete', () => { g.deleteSave(s.slot); render(); }) }, 'Delete'));
        wrap.append(h('div.save-row', {},
          h('div.save-t', {}, h('b', {}, title), h('span', {}, `${s.depth.toFixed(1)} m ${s.reverse ? 'rebuilt' : 'deep'} · ${s.coins} in the vault · ${s.purchases} upgrades${when ? ` · ${when}` : ''}`)),
          h('div.save-a', {}, actions)));
      }
    };
    render();
    return wrap;
  }

  // Travel to the next planet: pick a pole there; the legacy carries over.
  build_travel() {
    const g = this.game, e = g.econ;
    const next = M.nextPlanet(e);
    if (!next && e.planet === 'omega' && !e.reverse) {
      let pole = 'N';
      return h('div.start', {},
        h('div.start-left', {},
          h('div.eyebrow', {}, '🔮 Omega complete · every world melted through'),
          h('div.title', {}, 'Make It', h('span', {}, 'Snow')),
          h('p.lede', {}, 'Reverse Mode is open: go back to Frostara and freeze the worlds again. The same tools and trees, read backwards: your torch becomes a Frost Wand that grows new ice, the Melt tree becomes the Freeze tree, and the goals are shorter and kinder.'),
          h('div.start-actions', {},
            h('button.btn.primary', { onclick: () => { this.close(); g.newReverse(pole); } }, '❄️ Make It Snow'),
            h('button.btn', { onclick: () => { this.close(); g.input.lock(); } }, 'Stay on Omega for now')),
          h('div.start-foot', {}, 'Your melted campaign stays saved. Reverse Mode is a separate survey on the start screen too.')),
        h('div'));
    }
    if (!next) return this.frame('Travel', h('p', {}, e.reverse ? 'Every world is frozen again. The snow is falling everywhere.' : 'No further planet is ready yet.'));
    const opts = M.travelOpts(e, next.id);
    let pole = 'N';
    const cards = h('div.poles');
    const render = () => {
      clear(cards);
      for (const k of ['N', 'S']) {
        const P = next.poles[k];
        cards.append(h(`button.pole${pole === k ? '.on' : ''}`, { onclick: () => { pole = k; render(); g.sfx.play('click'); } },
          h('span.nm', {}, k === 'N' ? 'North pole' : 'South pole'), h('h3', {}, P.name), h('p', {}, P.desc),
          h('div.strata', {}, P.strata.slice(0, 5).map((s) => h('i', { style: { background: `rgb(${s.color.map((c) => Math.round(c * 255)).join(',')})` } })))));
      }
    };
    render();
    return h('div.start', {},
      h('div.start-left', {},
        h('div.eyebrow', {}, `${g.planet.icon} ${g.planet.name} complete · next world`),
        h('div.title', {}, 'Next:', h('span', {}, next.name)),
        h('p.lede', {}, `${next.rule}. Your ${g.planet.name} legacy goes with you: ×${opts.legacy.toFixed(2)} income on ${next.name}. Upgrades start over, priced for your legacy, so the first one comes as quickly as it did here.`),
        h('div.eyebrow', {}, 'Choose your pole on the new world.'),
        cards,
        h('div.start-actions', {},
          h('button.btn.primary', { onclick: () => { this.close(); g.travelTo(next.id, pole); } }, `Travel to ${next.name}`),
          h('button.btn', { onclick: () => { this.close(); g.input.lock(); } }, `Stay on ${g.planet.name} for now`)),
        h('div.start-foot', {}, 'You can travel later from the pause menu.'),
      ),
      h('div'),
    );
  }

  build_offline(r) {
    return h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' } }, h('div.offline-card', {},
      h('div.eyebrow', {}, `While you were away · ${formatTime(r.seconds)}`),
      h('h3', {}, 'The stakes kept working'),
      h('div.big', {}, `+${format(r.coins)}`),
      h('p', { style: { color: 'var(--haze)', margin: 0 } }, r.coins > 0 ? `Automation removed ${r.volume.toFixed(1)} m³ of ice and banked it. Away time counts up to 8 hours.` : 'Nothing was automated yet. Seismic Stakes and Heat Seeps keep working while you are away.'),
      h('button.btn.primary', { onclick: () => { this.close(); } }, 'Back to the ice')));
  }

  confirm(title, text, action, fn) {
    const el = h('div.confirm.interactive', {}, h('div', {}, h('h3', {}, title), h('p', { style: { color: 'var(--haze)', margin: 0 } }, text),
      h('div.actions', {}, h('button.btn', { onclick: () => el.remove() }, 'Cancel'), h('button.btn.danger', { onclick: () => { el.remove(); fn(); } }, action))));
    this.root.appendChild(el);
  }
}

// ---------- upgrade node graph ----------

class TreeView {
  constructor(wrap, game, menus) {
    this.wrap = wrap;
    this.game = game;
    this.menus = menus;
    this.canvas = h('div.tree-canvas');
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.canvas.appendChild(this.svg);
    wrap.appendChild(this.canvas);
    this.tip = h('div.tree-tip', { hidden: true });
    this.wallet = h('div.wallet');
    this.walletSub = h('div', { style: { font: '500 12px/1 var(--mono)', color: 'var(--haze)' } });
    wrap.parentElement.appendChild(h('div.tree-hud', {}, h('div.eyebrow', {}, 'Vault'), this.wallet, this.walletSub));
    wrap.parentElement.appendChild(this.tip);
    wrap.parentElement.appendChild(h('div.tree-zoom', {},
      h('button.btn', { onclick: () => this.zoomBy(1.2) }, '+'), h('button.btn', { onclick: () => this.zoomBy(1 / 1.2) }, '−'), h('button.btn', { onclick: () => this.fit() }, 'Fit'),
      ...[['autoBuy', 'Quartermaster'], ['autoTool', 'Auto Swing']].filter(([k]) => game.stats[k] >= 1).map(([k, label]) => {
        const b = h(`button.btn${game.settings[k] !== false ? '.primary' : ''}`, { onclick: () => { game.settings[k] = game.settings[k] === false; b.classList.toggle('primary', game.settings[k] !== false); b.textContent = `${label}: ${game.settings[k] !== false ? 'on' : 'off'}`; game.saveSettings(); } }, `${label}: ${game.settings[k] !== false ? 'on' : 'off'}`);
        return b;
      })));
    this.nodes = {};
    this.pos = {};
    this.layout();
    this.scale = 0.85;
    this.ox = 0; this.oy = 0;
    this.bind();
    this.refresh();
    // fit once the menu has been laid out
    requestAnimationFrame(() => requestAnimationFrame(() => this.fit()));
  }

  fit() {
    const r = this.wrap.getBoundingClientRect();
    if (!r.width) return;
    const b = this.bounds;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    this.scale = Math.max(0.35, Math.min(1, Math.min(r.width / bw, (r.height - 40) / bh) * 0.98));
    this.ox = r.width / 2 - ((b.minX + b.maxX) / 2) * this.scale;
    this.oy = r.height / 2 - ((b.minY + b.maxY) / 2) * this.scale;
    this.apply();
  }

  layout() {
    const SX = 210, SY = 124;
    for (const n of NODES) {
      const t = TREE[n.tree];
      const [ox, oy] = t.origin;
      const x = ox * (230 + n.gx * SX);
      const y = oy * (110 + n.gy * SY);
      this.pos[n.id] = n.at ? [...n.at] : [x, y];
    }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of Object.values(this.pos)) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    this.bounds = { minX: minX - 140, minY: minY - 120, maxX: maxX + 140, maxY: maxY + 120 };
    const W = this.bounds.maxX - this.bounds.minX, H = this.bounds.maxY - this.bounds.minY;
    this.svg.setAttribute('width', W); this.svg.setAttribute('height', H);
    this.svg.style.left = `${this.bounds.minX}px`; this.svg.style.top = `${this.bounds.minY}px`;
    this.svg.setAttribute('viewBox', `${this.bounds.minX} ${this.bounds.minY} ${W} ${H}`);
    // tree labels
    for (const t of TREES) {
      const [ox, oy] = t.origin;
      const [lx, ly] = t.label || [ox * 520, oy > 0 ? oy * 70 + 690 : -790];
      const lab = h('div.tree-label', { style: { left: `${lx}px`, top: `${ly}px`, '--tc': t.color } }, `${t.name}`);
      if (t.id === 'melt') this.meltLabel = lab;
      this.canvas.appendChild(lab);
    }
    // the planet at the centre
    const core = h('div', { style: { position: 'absolute', left: '-70px', top: '-70px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #e6f1f4, #8fd6ec 35%, #1d4a63 70%, #06121a)', boxShadow: '0 0 60px rgba(143,214,236,0.35)' } });
    this.canvas.appendChild(core);
    this.edges = [];
    for (const n of NODES) for (const p of n.parents) {
      const [x1, y1] = this.pos[p], [x2, y2] = this.pos[n.id];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const mx = (x1 + x2) / 2;
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-width', '2');
      this.svg.appendChild(path);
      this.edges.push({ path, from: p, to: n.id });
    }
    // roots connect to the core
    for (const n of NODES.filter((x) => x.root)) {
      const [x2, y2] = this.pos[n.id];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M0,0 L${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(143,214,236,0.25)');
      path.setAttribute('stroke-dasharray', '4 6');
      this.svg.appendChild(path);
    }
    for (const n of NODES) {
      const t = TREE[n.tree];
      const tc2 = n.join ? TREE[n.join[1]].color : t.color;
      const el = h(`div.tnode${n.gate ? '.gate' : ''}.k-${n.kind || 'stat'}`, { style: { left: `${this.pos[n.id][0]}px`, top: `${this.pos[n.id][1]}px`, '--tc': n.join ? TREE[n.join[0]].color : t.color, '--tc2': tc2 } });
      el.addEventListener('mouseenter', () => { this.hover = n.id; this.showTip(n.id); this.game.sfx.play('hover'); });
      el.addEventListener('mouseleave', () => { if (this.hover === n.id) { this.hover = null; this.tip.hidden = true; } });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (this.dragged) return;
        // touch has no hover: the first tap shows what a node does, a second tap buys it
        if (this.game.touch && this.hover !== n.id) { this.hover = n.id; this.showTip(n.id); return; }
        this.buy(n.id, el);
      });
      this.canvas.appendChild(el);
      this.nodes[n.id] = el;
    }
  }

  buy(id, el) {
    const ok = this.game.buy(id);
    if (ok) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    else this.game.sfx.play('deny');
    this.refresh();
    if (this.hover) this.showTip(this.hover);
  }

  showTip(id) {
    const g = this.game, e = g.econ;
    const n = skinNode(NODE_BY_ID[id], this.game.econ?.reverse);
    const lvl = M.level(e, id);
    const table = M.costTable(e);
    const cost = table[id].cost;
    const per = n.max > 1 ? ' per level' : '';
    const W = M.milestoneWeight(lvl, n.max);
    const star = n.max >= M.MILESTONE && lvl < n.max && M.isMilestone(lvl + 1);
    const fx = n.effects.map(([stat, op, v]) => {
      if (op === 'set') return stat.endsWith('Tier') ? `${statName(stat)} → tier ${v}` : `${statName(stat)}: unlocked`;
      if (op === 'add') return `${statName(stat)} ${v < 0 ? '−' : '+'}${fmtV(Math.abs(v), stat)}${per}${n.max > 1 ? ` (now ${v < 0 ? '−' : '+'}${fmtV(Math.abs(v * W), stat)})` : ''}`;
      return `${statName(stat)} ×${(1 + v).toFixed(2)}${per}${n.max > 1 && lvl ? ` (now ×${Math.pow(1 + v, W).toFixed(2)})` : ''}`;
    });
    if (n.max >= M.MILESTONE) fx.push(star ? '<b style="color:var(--brass)">★ Next level is a milestone: it counts three times (and costs more)</b>'
      : `<span style="opacity:.7">★ Every ${M.MILESTONE}th level counts three times</span>`);
    const lock = M.lockedBy(e, id);
    const rival = n.excl ? NODES.filter((o) => o.excl === n.excl && o.id !== id).map((o) => skinNode(o, e.reverse).name).join(' / ') : '';
    const eyebrow = n.join ? `${TREE[n.join[0]].icon} ${TREE[n.join[0]].name} × ${TREE[n.join[1]].icon} ${TREE[n.join[1]].name} · cross-tree`
      : `${n.tree === 'melt' && e.reverse ? `${FREEZE_TREE.icon} ${FREEZE_TREE.name}` : `${TREE[n.tree].icon} ${TREE[n.tree].name}`}${n.gate ? ' · tool tier' : n.kind && KIND_LABEL[n.kind] ? ` · ${KIND_LABEL[n.kind].toLowerCase()}` : ''}`;
    const inc = g.measuredRate();
    const wait = Math.max(0, cost.sub(e.coins).toNumber()) / Math.max(1e-9, inc);
    clear(this.tip).append(
      h('div.eyebrow', {}, eyebrow),
      h('h4', {}, `${n.icon} ${n.name}`),
      h('p', {}, n.desc),
      h('div.eff', { html: fx.map((x) => `<div>${x}</div>`).join('') }),
      h('div.eff', { html: `<div>Level <b>${lvl}</b> / ${n.max}</div>` }),
      M.isMaxed(e, id) ? h('div.eff', { html: '<b>Maxed</b>' }) :
        h('div.eff', { html: `<div>Cost <span style="color:var(--brass)">${format(cost)}</span>${!M.isUnlocked(e, id) ? ' · locked' : e.coins.gte(cost) ? ' · <b>affordable</b>' : ` · about ${formatTime(wait)}`}</div>` }),
      lock ? h('p', { style: { color: 'var(--ember)' } }, `Closed: you chose ${skinNode(lock, e.reverse).name}.`)
        : n.mutation && !(e.mutations || {})[n.mutation] ? h('p', { style: { color: 'var(--moss)' } }, `Needs ${MUTANT_BY_ID[n.mutation].name}: find this mutant ice to unlock it.`)
        : !M.isUnlocked(e, id) ? h('p', {}, `Needs ${n.parents.map((p) => skinNode(NODE_BY_ID[p], e.reverse).name).join(' and ')}.`) : '',
      rival && !lock && lvl < 1 ? h('p', { style: { color: 'var(--brass)' } }, `Choose one: buying this closes ${rival} for this planet.`) : '',
    );
    this.tip.hidden = false;
  }

  refresh() {
    const g = this.game, e = g.econ;
    const table = M.costTable(e);
    const inc = g.measuredRate();
    // Reverse Mode: the Melt tree reads as the Freeze tree
    if (this.meltLabel) this.meltLabel.textContent = e.reverse ? FREEZE_TREE.name : TREE.melt.name;
    for (const n0 of NODES) {
      const n = skinNode(n0, e.reverse);
      const el = this.nodes[n.id];
      const lvl = M.level(e, n.id);
      const unlocked = M.isUnlocked(e, n.id);
      const maxed = lvl >= n.max;
      const cost = table[n.id].cost;
      const can = unlocked && !maxed && e.coins.gte(cost);
      const barred = !!M.lockedBy(e, n.id);
      el.classList.toggle('locked', !unlocked);
      el.classList.toggle('barred', barred);
      el.classList.toggle('maxed', maxed);
      el.classList.toggle('can', can);
      const pips = Math.min(n.max, 12);
      const filled = Math.round((lvl / n.max) * pips);
      const wait = Math.max(0, cost.sub(e.coins).toNumber()) / Math.max(1e-9, inc);
      el.innerHTML = '';
      el.append(
        KIND_LABEL[n.kind] ? h('div.kind', {}, barred ? 'CLOSED' : KIND_LABEL[n.kind]) : '',
        h('div.top', {}, h('span.ic', {}, n.icon), h('span.nm', {}, n.name), h('span.lv', {}, `${lvl}/${n.max}`)),
        h('div.pips', {}, Array.from({ length: pips }, (_, i) => h(`i${i < filled ? '.f' : ''}`))),
        n.max >= M.MILESTONE && !maxed && M.isMilestone(lvl + 1) ? h('div.star', { title: 'Next level is a milestone' }, '★') : '',
        h('div.cost', {}, h('span', {}, maxed ? 'MAX' : format(cost)), h('span.eta', {}, maxed || !unlocked ? '' : can ? 'buy' : formatTime(wait))),
      );
    }
    for (const ed of this.edges) {
      const on = M.level(e, ed.from) >= 1;
      const tc = TREE[NODE_BY_ID[ed.from].tree].color;
      ed.path.setAttribute('stroke', on ? tc : 'rgba(196,232,244,0.14)');
      ed.path.setAttribute('stroke-opacity', on ? (M.level(e, ed.to) >= 1 ? '0.85' : '0.45') : '1');
    }
    this.wallet.textContent = format(e.coins);
    this.walletSub.textContent = `+${format(inc)}/s`;
  }

  apply() { this.canvas.style.transform = `translate(${this.ox}px, ${this.oy}px) scale(${this.scale})`; }
  center() { const r = this.wrap.getBoundingClientRect(); this.ox = r.width / 2; this.oy = r.height / 2; this.apply(); }
  zoomBy(k, cx, cy) {
    const r = this.wrap.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    const ns = Math.max(0.35, Math.min(1.8, this.scale * k));
    this.ox = cx - (cx - this.ox) * (ns / this.scale);
    this.oy = cy - (cy - this.oy) * (ns / this.scale);
    this.scale = ns;
    this.apply();
  }

  bind() {
    // drag to pan with a mouse or a finger; wheel or pinch to zoom
    let down = null;
    const pts = new Map();
    let pinch = null;
    this.onDown = (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale };
        down = null;
        return;
      }
      down = { x: ev.clientX, y: ev.clientY, ox: this.ox, oy: this.oy }; this.dragged = false; this.wrap.classList.add('drag');
    };
    this.onMove = (ev) => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const r = this.wrap.getBoundingClientRect();
        const want = pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d);
        this.zoomBy(want / this.scale, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        this.dragged = true;
        return;
      }
      if (!down) return;
      const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.dragged = true;
      this.ox = down.ox + dx; this.oy = down.oy + dy; this.apply();
    };
    this.onUp = (ev) => {
      pts.delete(ev.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size) return;
      down = null; this.wrap.classList.remove('drag'); setTimeout(() => { this.dragged = false; }, 0);
    };
    this.onWheel = (ev) => { ev.preventDefault(); const r = this.wrap.getBoundingClientRect(); this.zoomBy(ev.deltaY < 0 ? 1.1 : 1 / 1.1, ev.clientX - r.left, ev.clientY - r.top); };
    this.wrap.style.touchAction = 'none';
    this.wrap.addEventListener('pointerdown', this.onDown);
    addEventListener('pointermove', this.onMove);
    addEventListener('pointerup', this.onUp);
    addEventListener('pointercancel', this.onUp);
    this.wrap.addEventListener('wheel', this.onWheel, { passive: false });
    this.timer = setInterval(() => this.refresh(), 400);
  }

  destroy() {
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerup', this.onUp);
    removeEventListener('pointercancel', this.onUp);
    clearInterval(this.timer);
  }
}

const KIND_LABEL = { mech: 'Mechanic', choice: 'Choose one', hybrid: 'Cross-tree', cap: 'Capstone' };

const STAT_NAMES = {
  nightVision: 'Night vision', walkSpeed: 'Walking speed', hands: 'More hands', heatSkin: 'Heat skin',
  shock: 'Thermal shock (warm ice digs wider)', seep: 'Crack seep (cracked ice melts faster)', heatLinger: 'Warm time', heavyMult: 'Heavy blow', richCrit: 'Clean breaks on rich seams',
  steamBurst: 'Steam burst', pipes: 'Heat pipes (auto-dig from auto-melt)',
  digRadius: 'Bite radius', digRate: 'Strikes per second', digYield: 'Extraction', crit: 'Clean-break chance', critMult: 'Clean-break size', reach: 'Reach',
  meltPower: 'Melt power', meltRadius: 'Melt radius', meltEff: 'Melt efficiency', meltTier: 'Melt tool', digTier: 'Dig tool', visionTier: 'Vision tool',
  vision: 'Seam reading', hint: 'Needle sense', collectRange: 'Collection range', collect: 'Meltwater collection', autoCollect: 'Auto-collect',
  carry: 'Pack size', liftSpeed: 'Lift speed', bank: 'Banking', autoDig: 'Auto-dig', autoMelt: 'Auto-melt', autoAll: 'All automation', offline: 'Offline efficiency',
  valueMult: 'Coin value',
};
function statName(s) { return STAT_NAMES[s] || s; }
function fmtV(v, stat) {
  if (['digYield', 'crit', 'vision', 'collect', 'autoCollect', 'bank', 'offline', 'valueMult', 'meltEff', 'critMult', 'shock', 'seep', 'heatLinger', 'richCrit', 'pipes', 'nightVision', 'walkSpeed', 'heatSkin'].includes(stat)) return `${(v * 100).toFixed(1)}%`;
  if (stat === 'heavyMult') return `×${v.toFixed(2)}`;
  if (['digRadius', 'meltRadius', 'reach', 'collectRange'].includes(stat)) return `${v.toFixed(3)} m`;
  if (['autoDig', 'autoMelt', 'meltPower'].includes(stat)) return `${v.toFixed(3)} m³/s`;
  if (stat === 'liftSpeed') return `${v.toFixed(2)} m/s`;
  return v.toFixed(2);
}
