// In-play HUD: wallet, next goal (with the hidden wait meter), tools, depth gauge, readouts, notices.
import { h, clear } from './dom.js';
import { format } from '../core/big.js';
import { FAMILIES, familyView } from '../player/tools.js';
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
    this.carry = h('div.carry', { title: 'Coins you have freed but not delivered yet. Deliver them at the depot by the Outfitter\u2019s hut on the surface.' }, h('span', {}, 'PACK'), h('div.bar', {}, this.carryBar), this.carryTxt);
    this.carryHint = h('div.carry-hint');
    this.el.appendChild(h('div.hud-wallet', {}, h('div.coins', {}, h('span.unit'), this.coins), this.rate, this.carry, this.carryHint));

    this.goalName = h('div.name');
    this.goalCost = h('div.cost');
    this.goalGlow = h('div.glow');
    this.goal = h('div.hud-goal', {}, this.goalGlow, h('div.label', {}, 'Next goal'), this.goalName, this.goalCost);
    this.el.appendChild(this.goal);

    this.tools = h('div.hud-tool');
    this.el.appendChild(this.tools);

    // depth gauge: surface at the top, this planet's goal depth at the bottom, labelled marks in between;
    // the dot is you (it follows you up and down), the notch is the deepest point dug, gold is the needle
    this.depthYou = h('b.you', {}, h('em'));
    this.depthMax = h('s.max', { title: 'Deepest point dug' });
    this.depthNeedle = h('div.needle', { hidden: true }, h('span', {}, '✦ needle'));
    this.depthNeedleAt = h('q.needle-at', { hidden: true, title: 'The Golden Needle (Needle Sense)' });
    this.depthScale = h('div.scale', {}, this.depthNeedle, this.depthMax, this.depthNeedleAt, this.depthYou);
    this.el.appendChild(h('div.hud-depth', {}, h('div.title', {}, 'DEPTH'), this.depthScale));

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
    // captions for musical cues (Settings > Accessibility)
    this.captions = h('div.captions', { 'aria-live': 'polite' });
    root.appendChild(this.captions);
    // lift beacon chevron and needle compass
    this.lift = h('div', { style: { position: 'absolute', font: '600 12px/1 var(--mono)', color: 'var(--glacier)', letterSpacing: '0.1em', whiteSpace: 'nowrap', transform: 'translate(-50%,-50%)', textShadow: '0 1px 4px #000', padding: '5px 8px', background: 'rgba(6,18,26,0.55)', border: '1px solid rgba(143,214,236,0.45)', pointerEvents: 'none' }, hidden: true });
    root.appendChild(this.lift);
    this.needle = h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', borderRadius: '50%', pointerEvents: 'none' }, hidden: true });
    root.appendChild(this.needle);
    this.needleText = h('div.needle-text', { hidden: true });
    root.appendChild(this.needleText);
    this.nav = new Navigation(this.el, game);
    this.navT = performance.now();
    this.lastTools = '';
    this.depthTicks = false;
  }

  set visible(v) {
    this.el.hidden = !v;
    this.notices.hidden = false;
    if (!v) { this.lift.hidden = true; this.needle.hidden = true; this.needleText.hidden = true; }
  }

  // a caption for a sound-only cue (music), so it can be read as well as heard
  caption(text, ms = 3200) {
    const c = h('div.caption', {}, text);
    this.captions.append(c);
    while (this.captions.children.length > 3) this.captions.firstChild.remove();
    setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 450); }, ms);
  }

  // key labels are cached in the HUD: rebuild them after a rebind
  invalidateKeys() { this.keysDone = false; this.lastTools = ''; }

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
    this.carryHint.textContent = s.carried > 0.5 && !s.atDepot ? 'Deliver it at the depot ⛟' : '';
    this.carry.classList.toggle('full', fill >= 1);

    // next goal + hidden wait meter: the glow grows as you get close to affording it
    if (s.goal) {
      const n = NODE_BY_ID[s.goal.id];
      if (this.goalId !== s.goal.id) {
        this.goalId = s.goal.id;
        clear(this.goalName).append(h('span', {}, n.icon), h('span', { style: { color: TREE_COLOR[n.tree] } }, n.name));
      }
      this.goalCost.textContent = s.goalReady ? (g.atOutfitter() ? `Ready · ${g.clickWord()} at the terminal` : 'Ready · go to the Outfitter ▣') : `${format(s.goal.cost)} coins`;
      this.goal.classList.toggle('ready', s.goalReady);
      const p = Math.min(1, s.goalProgress);
      this.goalGlow.style.opacity = String(Math.pow(p, 3) * 0.95);
    }

    // tools
    const key = `${g.tools.family}|${s.tiers.join(',')}|${g.econ?.reverse ? 'r' : ''}`;
    if (key !== this.lastTools) {
      this.lastTools = key;
      clear(this.tools);
      FAMILIES.forEach((F0, i) => {
        const F = familyView(F0, g.econ?.reverse);
        const tier = s.tiers[i];
        const ok = F.id === 'dig' || tier >= 1;
        const name = ok ? F.tiers[Math.max(0, tier - 1)] : F.id === 'planet' ? 'Planet tree' : 'Locked';
        this.tools.append(h(`div.slot${i === g.tools.family ? '.on' : ''}${ok ? '' : '.locked'}`, { onpointerdown: (ev) => { if (g.touch) { ev.preventDefault(); g.input.tapKey(g.input.code(F.key)); } }, title: F.id === 'planet' ? 'Planet tools arrive on Cinderice, the next planet' : '' },
          h('span.key', {}, keyLabel(g.input.code(F.key))), h('span.nm', {}, F.name), h('span.tier', {}, name)));
      });
    }

    // depth gauge (square-root scale so the first metres get room)
    const goal = s.goalDepth || s.radius;
    const at = (d) => `${Math.sqrt(Math.min(1, Math.max(0, d) / goal)) * 100}%`;
    if (this.depthTicks !== goal) {
      this.depthTicks = goal;
      this.depthScale.querySelectorAll('.tk').forEach((x) => x.remove());
      const mark = (d, text, cls = '') => this.depthScale.prepend(h(`div.tk${cls}`, { style: { top: at(d) } }, h('span', {}, text)));
      mark(0, 'SURFACE', '.end');
      for (const d of [10, 50, 100, 250, 500]) if (d < goal * 0.8) mark(d, `${d} m`);
      mark(goal, `GOAL ${goal.toLocaleString('en-US')} m`, '.end.goal');
    }
    const you = Math.max(0, s.depth);
    this.depthYou.style.top = at(you);
    this.depthYou.firstChild.textContent = `${you.toFixed(you < 10 ? 1 : 0)} m`;
    this.depthMax.style.top = at(s.crater);
    this.depthMax.hidden = s.crater < 0.5 || Math.abs(s.crater - you) < 1;
    const nd = s.needle;
    this.depthNeedle.hidden = !nd;
    this.depthNeedleAt.hidden = !nd || !nd.sense;
    if (nd) {
      const t0 = Math.sqrt(nd.band[0] / goal), t1 = Math.sqrt(nd.band[1] / goal);
      this.depthNeedle.style.top = `${t0 * 100}%`;
      this.depthNeedle.style.height = `${(t1 - t0) * 100}%`;
      this.depthNeedleAt.style.top = at(nd.depth);
      const inBand = you >= nd.band[0] - 2 && you <= nd.band[1] + 2;
      this.depthNeedle.classList.toggle('here', inBand);
      this.depthNeedle.title = nd.sense ? `The Golden Needle is at about ${Math.round(nd.depth)} m` : `The Golden Needle is somewhere ${nd.band[0]}-${nd.band[1]} m down (Needle Sense shows where)`;
    }

    this.stratum.textContent = s.stratum;
    this.rows.innerHTML = [
      ['Depth', `${s.depth.toFixed(1)} m`],
      ['Ice hardness', `×${s.hard.toFixed(2)}`],
      s.reading !== null ? ['Richness', '▮'.repeat(Math.round(s.reading * 5)) + '▯'.repeat(5 - Math.round(s.reading * 5))] : null,
      ['Sea level', `${s.sea >= 0 ? '+' : '−'}${Math.abs(s.sea).toFixed(2)} cm`],
      s.rebuilt !== undefined ? ['Ice rebuilt', `${s.rebuilt.toFixed(1)} / ${s.rebuiltGoal.toFixed(0)} m`] : null,
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
        if (edge === 'left') y = Math.min(y, -0.15);   // stay below the notices on the left
      }
      this.lift.hidden = false;
      this.lift.style.left = `${(x * 0.5 + 0.5) * innerWidth}px`;
      this.lift.style.top = `${(-y * 0.5 + 0.5) * innerHeight}px`;
      const what = s.atBeacon ? 'LIFT · here' : `LIFT ${d.toFixed(0)} m`;
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
      // and a readout under the crosshair, to the centimetre: how far, which way across, how far up or down
      this.needleText.hidden = false;
      this.needleText.textContent = needleReadout(hint.dir.x * hint.dist, hint.dir.z * hint.dist, hint.dy, g.ctl.yaw);
    } else if (s.needleGuide && !this.el.hidden) {
      // at the needle's depth but not yet close: which way to go across, and how far
      const gd = s.needleGuide;
      this.needle.hidden = true;
      this.needleText.hidden = false;
      this.needleText.textContent = needleReadout(gd.dx, gd.dz, gd.dy, g.ctl.yaw);
    } else { this.needle.hidden = true; this.needleText.hidden = true; }
  }
}

// distances to the centimetre: "43 cm" under a metre, "2.37 m" above
const cmOrM = (d) => (d < 1 ? `${Math.round(d * 100)} cm` : `${d.toFixed(2)} m`);
// The needle readout: straight-line distance, which way to turn, and how far up or down (from your feet).
export function needleReadout(dx, dz, dy, yaw) {
  const across = Math.hypot(dx, dz), dist = Math.hypot(across, dy);
  let rel = ((Math.atan2(-dx, -dz) - yaw) * 180 / Math.PI) % 360;   // the controller's yaw that faces it, relative to yours
  if (rel > 180) rel -= 360; if (rel < -180) rel += 360;
  const turn = across < 0.25 ? '' : Math.abs(rel) < 25 ? ` · ↑ ahead ${cmOrM(across)}` : Math.abs(rel) > 155 ? ` · ↓ behind you ${cmOrM(across)}` : rel > 0 ? ` · ← left ${cmOrM(across)}` : ` · → right ${cmOrM(across)}`;
  const up = dy < -0.15 ? ` · dig down ${cmOrM(-dy)}` : dy > 1.9 ? ` · up ${cmOrM(dy - 1.6)}` : ' · at your level';
  return `✦ Needle ${cmOrM(dist)}${turn}${up}`;
}
