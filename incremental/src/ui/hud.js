// In-play HUD: wallet, next goal (with the hidden wait meter), tools, depth gauge, readouts, notices.
import { h, clear } from './dom.js';
import { format } from '../core/big.js';
import { FAMILIES } from '../player/tools.js';
import { keyLabel } from '../player/input.js';
import { NODE_BY_ID, TREES } from '../econ/data/nodes.js';
import * as THREE from 'three';

const TREE_COLOR = Object.fromEntries(TREES.map((t) => [t.id, t.color]));

export class Hud {
  constructor(root, game) {
    this.game = game;
    this.el = h('div.hud');
    root.appendChild(this.el);
    this.coins = h('span.v', {}, '0');
    this.rate = h('div.rate', {}, '');
    this.carryBar = h('i');
    this.carryTxt = h('span', {}, '');
    this.carry = h('div.carry', {}, h('span', {}, 'PACK'), h('div.bar', {}, this.carryBar), this.carryTxt);
    this.el.appendChild(h('div.hud-wallet', {}, h('div.coins', {}, h('span.unit'), this.coins), this.rate, this.carry));

    this.goalName = h('div.name');
    this.goalCost = h('div.cost');
    this.goalGlow = h('div.glow');
    this.goal = h('div.hud-goal', {}, this.goalGlow, h('div.label', {}, 'Next goal'), this.goalName, this.goalCost);
    this.el.appendChild(this.goal);

    this.tools = h('div.hud-tool');
    this.el.appendChild(this.tools);

    this.depthMark = h('i');
    this.depthNow = h('span.now');
    this.depthCore = h('span.core');
    this.depthScale = h('div.scale', {}, this.depthMark);
    this.el.appendChild(h('div.hud-depth', {}, h('div.labels', {}, h('span', {}, 'SURFACE'), this.depthNow, this.depthCore), this.depthScale));

    this.stratum = h('div.stratum');
    this.rows = h('div');
    this.el.appendChild(h('div.hud-stats', {}, this.stratum, this.rows));

    this.keys = h('div.hud-keys');
    this.el.appendChild(this.keys);
    this.cross = h('div.crosshair');
    this.el.appendChild(this.cross);
    this.prompt = h('div.hint-prompt', { hidden: true });
    this.el.appendChild(this.prompt);
    this.notices = h('div.notices');
    root.appendChild(this.notices);
    this.floaters = h('div.floaters');
    root.appendChild(this.floaters);
    // lift beacon chevron and needle compass
    this.lift = h('div', { style: { position: 'absolute', font: '600 11px/1 var(--mono)', color: 'var(--glacier)', letterSpacing: '0.1em', whiteSpace: 'nowrap', transform: 'translate(-50%,-50%)', textShadow: '0 1px 4px #000' }, hidden: true });
    root.appendChild(this.lift);
    this.needle = h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', borderRadius: '50%', pointerEvents: 'none' }, hidden: true });
    root.appendChild(this.needle);
    this.lastTools = '';
    this.depthTicks = false;
  }

  set visible(v) {
    this.el.hidden = !v;
    this.notices.hidden = false;
    if (!v) { this.lift.hidden = true; this.needle.hidden = true; }
  }

  notice(title, desc = '', kind = '', ms = 5200) {
    const n = h(`div.notice${kind ? '.' + kind : ''}`, {}, h('div.t', {}, title), desc ? h('div.d', {}, desc) : null);
    this.notices.prepend(n);
    while (this.notices.children.length > 5) this.notices.lastChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 450); }, ms);
  }

  floater(text, x, y, color) {
    const f = h('div.floater', { style: { left: `${x}px`, top: `${y}px`, color: color || '' } }, text);
    this.floaters.appendChild(f);
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1100;
      f.style.transform = `translate(-50%, ${-50 - t * 60}%)`;
      f.style.top = `${y - t * 48}px`;
      f.style.opacity = String(1 - t * t);
      if (t < 1) requestAnimationFrame(step); else f.remove();
    };
    requestAnimationFrame(step);
  }

  update(s) {
    const g = this.game;
    this.coins.textContent = format(s.coins);
    this.rate.innerHTML = `<b>+${format(s.rate)}</b>/s &nbsp;·&nbsp; ${format(s.carriedValue)} carried`;
    const fill = Math.min(1, s.carried / s.carryCap);
    this.carryBar.style.width = `${fill * 100}%`;
    this.carryTxt.textContent = `${Math.floor(s.carried)} / ${Math.floor(s.carryCap)}`;
    this.carry.classList.toggle('full', fill >= 1);

    // next goal + hidden wait meter: the glow grows as you get close to affording it
    if (s.goal) {
      const n = NODE_BY_ID[s.goal.id];
      if (this.goalId !== s.goal.id) {
        this.goalId = s.goal.id;
        clear(this.goalName).append(h('span', {}, n.icon), h('span', { style: { color: TREE_COLOR[n.tree] } }, n.name));
      }
      this.goalCost.textContent = s.goalReady ? `Ready · press ${keyLabel(g.input.code('upgrades'))}` : `${format(s.goal.cost)} coins`;
      this.goal.classList.toggle('ready', s.goalReady);
      const p = Math.min(1, s.goalProgress);
      this.goalGlow.style.opacity = String(Math.pow(p, 3) * 0.95);
    }

    // tools
    const key = `${g.tools.family}|${s.tiers.join(',')}`;
    if (key !== this.lastTools) {
      this.lastTools = key;
      clear(this.tools);
      FAMILIES.forEach((F, i) => {
        const tier = s.tiers[i];
        const ok = F.id === 'dig' || tier >= 1;
        const name = F.id === 'planet' ? 'Arrives on Cinderice' : ok ? F.tiers[Math.max(0, tier - 1)] : 'Locked';
        this.tools.append(h(`div.slot${i === g.tools.family ? '.on' : ''}${ok ? '' : '.locked'}`, {},
          h('span.key', {}, keyLabel(g.input.code(F.key))), h('span.nm', {}, F.name), h('span.tier', {}, name)));
      });
    }

    // depth gauge against the planet's radius (square-root scale so early metres show)
    if (!this.depthTicks) {
      this.depthTicks = true;
      for (const d of [10, 100, 500, 1000]) {
        if (d >= s.radius) continue;
        this.depthScale.append(h('u', { style: { top: `${Math.sqrt(d / s.radius) * 100}%` } }));
      }
    }
    this.depthMark.style.top = `${Math.sqrt(Math.min(1, s.crater / s.radius)) * 100}%`;
    this.depthNow.textContent = `${s.crater.toFixed(s.crater < 10 ? 1 : 0)} m`;
    this.depthCore.textContent = `CORE ${s.radius.toLocaleString('en-US')} m`;

    this.stratum.textContent = s.stratum;
    this.rows.innerHTML = [
      ['Depth', `${s.depth.toFixed(1)} m`],
      ['Ice hardness', `×${s.hard.toFixed(2)}`],
      s.reading !== null ? ['Richness', '▮'.repeat(Math.round(s.reading * 5)) + '▯'.repeat(5 - Math.round(s.reading * 5))] : null,
      ['Sea level', `+${s.sea.toFixed(2)} cm`],
      ['Resonances', `${s.resonances}`],
    ].filter(Boolean).map(([a, b]) => `<div class="row"><b>${b}</b><span>${a}</span></div>`).join('');

    const k = (a) => keyLabel(g.input.code(a));
    if (!this.keysDone) {
      this.keysDone = true;
      this.keys.innerHTML = [['upgrades', 'Upgrades'], ['planet', 'Planet'], ['collections', 'Notebook'], ['coop', 'Crew'], ['music', 'Music']]
        .map(([a, l]) => `<span><kbd>${k(a)}</kbd>${l}</span>`).join('') + '<span><kbd>Esc</kbd>Pause</span>';
    }

    this.cross.classList.toggle('hit', !!s.hit);
    this.cross.classList.toggle('far', !s.hit);
    if (s.prompt) { this.prompt.hidden = false; this.prompt.textContent = s.prompt; } else this.prompt.hidden = true;

    // lift beacon chevron when you are carrying coins and it is off to the side
    const cam = g.gfx.camera;
    if (s.carried > 0 && !s.atBeacon && !this.el.hidden) {
      const bp = g.works.beaconPos().clone();
      const v = bp.clone().project(cam);
      const behind = bp.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) < 0;
      let x = v.x, y = v.y;
      if (behind) { x = -x; y = -y; }
      const m = Math.max(Math.abs(x), Math.abs(y));
      if (m > 0.9 || behind) { x = (x / m) * 0.9; y = (y / m) * 0.9; }
      this.lift.hidden = false;
      this.lift.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`;
      this.lift.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
      this.lift.textContent = `◆ LIFT ${bp.distanceTo(cam.position).toFixed(0)} m`;
    } else this.lift.hidden = true;

    // needle sense: a faint arc pointing toward the hidden needle
    if (s.needleHint && !this.el.hidden) {
      const hint = s.needleHint;
      const local = hint.dir.clone().applyQuaternion(cam.quaternion.clone().invert());
      const ang = Math.atan2(local.x, local.y) * 180 / Math.PI;
      this.needle.hidden = false;
      this.needle.style.background = `conic-gradient(from ${ang - 14}deg, rgba(255,210,122,${0.12 + hint.strength * 0.5}) 0deg 28deg, transparent 28deg)`;
      this.needle.style.maskImage = this.needle.style.webkitMaskImage = 'radial-gradient(circle, transparent 54%, #000 56%, #000 60%, transparent 62%)';
    } else this.needle.hidden = true;
  }
}
