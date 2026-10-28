// Developer menu: only with ?dev=1, opened with the backquote key. Every action flags the save.
import { h, clear } from './dom.js';
import { Big, format, formatTime } from '../core/big.js';
import { COINS } from '../econ/data/coins.js';
import { PLANETS } from '../econ/data/planets.js';
import { NODES, TREES } from '../econ/data/nodes.js';
import { SYNERGIES } from '../econ/data/synergies.js';
import { MILESTONES, CREW_MILESTONES } from '../econ/data/milestones.js';
import * as M from '../econ/model.js';

export class DevMenu {
  constructor(root, game) {
    this.game = game;
    this.el = h('div.dev.interactive', { hidden: true });
    root.appendChild(this.el);
    this.info = h('pre');
    this.build();
    setInterval(() => { if (!this.el.hidden) this.updateInfo(); }, 400);
  }

  toggle() {
    this.el.hidden = !this.el.hidden;
    if (!this.el.hidden) { this.game.input.unlock(); this.updateInfo(); }
  }

  flag(what) { this.game.econ.devFlag = true; this.game.state.devActions = (this.game.state.devActions || 0) + 1; this.game.hud.notice('Dev', what, 'heat', 2000); }

  build() {
    const g = this.game;
    const B = (label, fn, on) => h(`button${on ? '.on' : ''}`, { onclick: () => fn() }, label);
    const sec = (title, ...kids) => h('section', {}, h('b', {}, title), ...kids);
    const num = (id, v) => h('input', { id, type: 'number', value: v });
    const planetSel = h('select', { id: 'dev-planet' }, PLANETS.map((p) => h('option', { value: p.id, disabled: !p.available }, `${p.icon} ${p.name}${p.available ? '' : ' (later batch)'}`)));
    const poleSel = h('select', { id: 'dev-pole' }, h('option', { value: 'N' }, 'North'), h('option', { value: 'S' }, 'South'));
    const depthIn = num('dev-depth', 30);
    const coinAmt = num('dev-coins', 1000);
    const legacyIn = num('dev-legacy', 1);
    const nodeSel = h('select', { id: 'dev-node' }, TREES.map((t) => h('optgroup', { label: t.name }, NODES.filter((n) => n.tree === t.id).map((n) => h('option', { value: n.id }, n.name)))));
    const msSel = h('select', { id: 'dev-ms' }, MILESTONES.map((m) => h('option', { value: m.id }, `${m.planet === '*' ? '' : m.planet + ': '}${m.name}`)));
    const crewSel = h('select', { id: 'dev-crewms' }, CREW_MILESTONES.map((m) => h('option', { value: m.id }, m.name)));
    const synSel = h('select', { id: 'dev-syn' }, SYNERGIES.map((s) => h('option', { value: s.id }, s.name)));
    clear(this.el).append(
      h('h2', {}, 'Dev menu', h('small', {}, '` to close · flags the save')),
      sec('World',
        h('div.row', {}, planetSel, poleSel, B('Go', () => { this.flag('Planet / pole'); g.devJump(planetSel.value, poleSel.value, +depthIn.value); })),
        h('div.row', {}, 'Depth', depthIn, 'm', B('Dig shaft to depth', () => { this.flag(`Shaft to ${depthIn.value} m`); g.devShaft(+depthIn.value); })),
        h('div.row', {}, B('Noclip', () => { g.ctl.noclip = !g.ctl.noclip; this.build(); }, g.ctl.noclip), B('Teleport to beacon', () => { const b = g.works.beaconPos(); g.ctl.teleport(b.x + 1.5, b.y - 1, b.z); }), B('Surface', () => g.ctl.teleport(0, 2, 6)))),
      sec('Coins',
        h('div.row', {}, coinAmt, ...COINS.slice(0, 5).map((c, i) => B(`+${c.name}`, () => { this.flag(`+${coinAmt.value} ${c.name}`); g.devCoins(Big.fromNumber(+coinAmt.value * c.value)); }))),
        h('div.row', {}, B('+1 min income', () => { this.flag('+1 min'); g.devCoins(Big.fromNumber(g.measuredRate() * 60 + 10)); }), B('+1 h income', () => { this.flag('+1 h'); g.devCoins(Big.fromNumber(g.measuredRate() * 3600 + 100)); }), B('Fill pack', () => { this.flag('Fill pack'); g.devFillPack(); }))),
      sec('Legacy',
        h('div.row', {}, 'Multiplier', legacyIn, B('Set', () => { this.flag(`Legacy ×${legacyIn.value}`); g.econ.legacy = Math.max(0.01, +legacyIn.value); g.statsDirty = true; }))),
      sec('Upgrades',
        h('div.row', {}, nodeSel, B('+1', () => { this.flag('Node +1'); g.devLevel(nodeSel.value, 1); }), B('Max', () => { this.flag('Node max'); g.devLevel(nodeSel.value, 99); }), B('Reset', () => { this.flag('Node reset'); g.devLevel(nodeSel.value, -99); })),
        h('div.row', {}, ...TREES.map((t) => B(`Max ${t.name}`, () => { this.flag(`Max ${t.name}`); for (const n of NODES.filter((x) => x.tree === t.id)) g.devLevel(n.id, 99); })), B('Reset all', () => { this.flag('Reset all nodes'); for (const n of NODES) g.devLevel(n.id, -99); }))),
      sec('Events',
        h('div.row', {}, B('Complete this planet', () => { this.flag('Planet complete'); g.econ.depth = Math.max(g.econ.depth, g.planet.goalDepth); g.completePlanet(); }), B('Find here', () => { this.flag('Find'); g.devBring('find'); }), B('Mutant ice ahead', () => { this.flag('Mutant'); g.devMutant(); }), B('Lava ahead', () => { this.flag('Lava'); g.devLava(); }), B('Next weather phase', () => { this.flag('Weather'); if (g.weather) g.weather.left = 0; })),
        h('div.row', {}, B('Time capsule here', () => { this.flag('Capsule'); g.devBring('capsule'); }), B('Golden Needle here', () => { this.flag('Needle'); g.devBring('needle'); }), B('Reveal needle', () => { this.flag('Needle reveal'); g.devRevealNeedle(); })),
        h('div.row', {}, msSel, B('Reach milestone', () => { this.flag('Milestone'); g.devMilestone(msSel.value); }), crewSel, B('Crew milestone', () => { this.flag('Crew milestone'); g.devCrewMilestone(crewSel.value); })),
        h('div.row', {}, synSel, B('Trigger resonance', () => { this.flag('Resonance'); g.devResonance(synSel.value); })),
        h('div.row', {}, B('Refreeze pools now', () => { for (const p of g.water.pools) p.idle = 1e3, p.frozen = 0.99; }), B('Aurora now', () => { this.flag('Aurora'); g.startAurora(); }), B('Sky coin now', () => { this.flag('Sky coin'); g.dropSkyCoin(true); }), B('Chain +5', () => { this.flag('Chain'); g.chain.n += 5; }))),
      sec('Time',
        h('div.row', {}, B('×1', () => { g.timeScale = 1; this.build(); }, g.timeScale === 1), B('×10', () => { this.flag('×10 time'); g.timeScale = 10; this.build(); }, g.timeScale === 10), B('×100', () => { this.flag('×100 time'); g.timeScale = 100; this.build(); }, g.timeScale === 100)),
        h('div.row', {}, B('Simulate 1 h away', () => { this.flag('Offline 1 h'); g.devOffline(3600); }), B('Simulate 8 h away', () => { this.flag('Offline 8 h'); g.devOffline(8 * 3600); }))),
      sec('Debug', this.info),
    );
  }

  updateInfo() {
    const g = this.game, e = g.econ;
    const act = M.activeSynergies(e).map((s) => s.name);
    const goal = M.nextGoal(e);
    const inc = g.measuredRate();
    const est = M.rates(e, g.stats).income;
    this.info.textContent = [
      `planet ${e.planet} ${e.pole}  t=${formatTime(e.time)}  purchases=${e.purchases}  dev=${e.devFlag}`,
      `coins ${format(e.coins)}  measured +${format(inc)}/s  model +${format(est)}/s`,
      `crater ${g.craterDepth().toFixed(1)} m  volume ${e.volume.toFixed(1)} m³  melted ${e.melted.toFixed(1)} m³`,
      `next goal ${goal ? goal.id : '-'}  cost ${goal ? format(goal.cost) : '-'}  live wait ${goal ? formatTime(Math.max(0, goal.cost.sub(e.coins).toNumber()) / Math.max(1e-9, inc)) : '-'}`,
      `inflation ×${Math.pow(10, e.inflation).toFixed(2)}  next step ${(Math.pow(10, M.inflationStep(act.length)) - 1).toFixed(4)}`,
      `active resonances (${act.length}): ${act.join(', ') || 'none'}`,
      `actions ${JSON.stringify(e.actions)}`,
      `chunks ${g.volume.chunks.size}  pending mesh ${g.volume.pending()}  loose coins ${g.coins.loose.length}  particles ${g.particles.count()}`,
      `gfx ${JSON.stringify(g.gfx.info())}`,
    ].join('\n');
  }
}

export class PerfOverlay {
  constructor(root) {
    this.el = h('div.perf', { hidden: true });
    this.txt = h('div');
    this.cv = h('canvas', { width: 160, height: 40 });
    this.el.append(this.txt, this.cv);
    root.appendChild(this.el);
    this.samples = [];
    this.acc = 0;
  }

  set visible(v) { this.el.hidden = !v; }

  frame(ms, info) {
    this.samples.push(ms);
    if (this.samples.length > 160) this.samples.shift();
    this.acc += ms;
    if (this.acc < 250 || this.el.hidden) return;
    this.acc = 0;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const worst = Math.max(...this.samples);
    this.txt.textContent = `${(1000 / avg).toFixed(0)} FPS · ${avg.toFixed(1)} ms (worst ${worst.toFixed(1)}) · ${info.calls} calls · ${(info.tris / 1000).toFixed(0)}k tris`;
    const x = this.cv.getContext('2d');
    x.clearRect(0, 0, 160, 40);
    x.strokeStyle = 'rgba(255,255,255,0.25)';
    x.beginPath(); x.moveTo(0, 40 - 16.7 * 1.2); x.lineTo(160, 40 - 16.7 * 1.2); x.stroke();
    x.fillStyle = '#8fd6ec';
    this.samples.forEach((s, i) => { const hh = Math.min(40, s * 1.2); x.fillStyle = s > 20 ? '#ff8b52' : '#8fd6ec'; x.fillRect(i, 40 - hh, 1, hh); });
  }
}
