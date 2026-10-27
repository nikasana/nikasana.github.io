// In-play HUD: wallet, next goal (with the hidden wait meter), tools, depth gauge, readouts, notices.
import { h, clear } from './dom.js';
import { format } from '../core/big.js';
import { FAMILIES } from '../player/tools.js';
import { keyLabel } from '../player/input.js';
import { NODE_BY_ID, TREES } from '../econ/data/nodes.js';
import * as THREE from 'three';
import { Navigation } from './navigation.js';

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
    this.carry = h('div.carry', { title: 'Coins you have freed but not banked yet. Stand next to the lift beacon to bank them.' }, h('span', {}, 'PACK'), h('div.bar', {}, this.carryBar), this.carryTxt);
    this.carryHint = h('div.carry-hint');
    this.el.appendChild(h('div.hud-wallet', {}, h('div.coins', {}, h('span.unit'), this.coins), this.rate, this.carry, this.carryHint));

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
    this.lift = h('div', { style: { position: 'absolute', font: '600 12px/1 var(--mono)', color: 'var(--glacier)', letterSpacing: '0.1em', whiteSpace: 'nowrap', transform: 'translate(-50%,-50%)', textShadow: '0 1px 4px #000', padding: '5px 8px', background: 'rgba(6,18,26,0.55)', border: '1px solid rgba(143,214,236,0.45)', pointerEvents: 'none' }, hidden: true });
    root.appendChild(this.lift);
    this.needle = h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', borderRadius: '50%', pointerEvents: 'none' }, hidden: true });
    root.appendChild(this.needle);
    this.nav = new Navigation(this.el, game);
    this.navT = performance.now();
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
    const now = performance.now();
    if (!this.el.hidden) this.nav.update(Math.min(0.5, (now - this.navT) / 1000));
    this.navT = now;
    this.coins.textContent = format(s.coins);
    this.rate.innerHTML = `<b>+${format(s.rate)}</b>/s into the vault`;
    const fill = Math.min(1, s.carried / s.carryCap);
    this.carryBar.style.width = `${fill * 100}%`;
    this.carryTxt.textContent = `${Math.floor(s.carried)}/${Math.floor(s.carryCap)}${s.carriedValue > 0 ? ` · ${format(s.carriedValue)} to bank` : ''}`;
    this.carryHint.textContent = s.carried > 0.5 && !s.atBeacon ? 'Bank it at the lift beacon ◆' : '';
    this.carry.classList.toggle('full', fill >= 1);

    // next goal + hidden wait meter: the glow grows as you get close to affording it
    if (s.goal) {
      const n = NODE_BY_ID[s.goal.id];
      if (this.goalId !== s.goal.id) {
        this.goalId = s.goal.id;
        clear(this.goalName).append(h('span', {}, n.icon), h('span', { style: { color: TREE_COLOR[n.tree] } }, n.name));
      }
      this.goalCost.textContent = s.goalReady ? (g.atOutfitter() ? `Ready · press ${keyLabel(g.input.code('upgrades'))}` : 'Ready · go to the Outfitter ▣') : `${format(s.goal.cost)} coins`;
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
        const name = F.id === 'planet' ? 'Next planet' : ok ? F.tiers[Math.max(0, tier - 1)] : 'Locked';
        this.tools.append(h(`div.slot${i === g.tools.family ? '.on' : ''}${ok ? '' : '.locked'}`, { title: F.id === 'planet' ? 'Planet tools arrive on Cinderice, the next planet' : '' },
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
        .map(([a, l]) => `<span title="${l}"><kbd>${k(a)}</kbd><em>${l}</em></span>`).join('') + '<span title="Pause"><kbd>Esc</kbd><em>Pause</em></span>';
    }

    this.cross.classList.toggle('hit', !!s.hit);
    this.cross.classList.toggle('far', !s.hit);
    if (s.prompt) { this.prompt.hidden = false; this.prompt.textContent = s.prompt; } else this.prompt.hidden = true;

    // lift beacon marker: always shown, above the beacon when in view, at the screen edge when not
    const cam = g.gfx.camera;
    if (!this.el.hidden) {
      const bp = g.works.beaconPos().clone();
      const top = bp.clone().add(new THREE.Vector3(0, 0.9, 0));
      const v = top.clone().project(cam);
      const behind = top.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) < 0;
      const d = bp.distanceTo(cam.position);
      let x = v.x, y = v.y, edge = '';
      if (behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.8) {
        // off screen: pin to the left or right edge, at the height it would be
        if (behind) x = x > 0 ? -1 : 1;
        edge = x > 0 ? 'right' : 'left';
        x = x > 0 ? 0.8 : -0.9;
        y = behind ? 0 : Math.max(-0.6, Math.min(0.6, y));
      }
      this.lift.hidden = false;
      this.lift.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`;
      this.lift.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
      const what = s.atBeacon ? (s.carried > 0 ? 'BANKING' : 'LIFT · here') : `LIFT ${d.toFixed(0)} m${s.carried > 0.5 ? ' · bank here' : ''}`;
      this.lift.textContent = edge === 'left' ? `◀ ◆ ${what}` : edge === 'right' ? `◆ ${what} ▶` : `◆ ${what}`;
      this.lift.style.opacity = edge || d > 2.2 || s.carried > 0 ? '1' : '0.55';
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
