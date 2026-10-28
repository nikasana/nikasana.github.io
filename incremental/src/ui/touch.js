// Touch controls for phones and tablets: a move stick that appears under your left thumb (push it all the
// way to sprint), drag anywhere else to look, hold buttons for the tool (USE), its second action (ALT) and
// jump, a LIFT button by the lift beacon, and a row of buttons for the menus. They press the same bound actions as the keyboard and
// mouse, so the game itself does not know the difference.
import { h } from './dom.js';

const STICK_R = 56;          // px: the stick's travel
const LOOK_GAIN = 2.4;       // a finger drags further than a mouse moves for the same turn

export class TouchControls {
  constructor(root, game) {
    this.g = game;
    const inp = game.input;
    this.el = h('div.touch', { hidden: true });
    this.zone = h('div.touch-zone');
    this.stick = h('div.touch-stick', { hidden: true }, h('i'));
    this.el.append(this.zone, this.stick);
    // hold buttons: the tool, its second action, jump / ride the lift, and the lamp
    const hold = (cls, label, action, extra) => {
      const b = h(`button.tbtn.${cls}`, { 'aria-label': label }, label);
      const on = (v) => (ev) => { ev.preventDefault(); ev.stopPropagation(); b.classList.toggle('on', v); inp.hold(action, v); if (extra) extra(v); };
      b.addEventListener('pointerdown', on(true));
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, on(false));
      return b;
    };
    this.useBtn = hold('use', 'USE', 'use');
    // LIFT is its own button, shown only beside the lift beacon in the crater, so JUMP always just jumps
    this.liftBtn = h('button.tbtn.lift', { 'aria-label': 'Ride the lift up', hidden: true }, h('i', {}, '▲'), 'LIFT');
    const lift = (v) => (ev) => { ev.preventDefault(); ev.stopPropagation(); this.liftBtn.classList.toggle('on', v); game.touchLift = v; };
    this.liftBtn.addEventListener('pointerdown', lift(true));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) this.liftBtn.addEventListener(t, lift(false));
    this.el.append(this.useBtn, hold('alt', 'ALT', 'alt'), hold('jump', '⤒ JUMP', 'jump'), hold('lamp', 'LAMP', 'lamp'), this.liftBtn);
    // menu buttons: the same keys the keyboard would press
    const tap = (label, title, code) => {
      const b = h('button.tbtn.menu', { 'aria-label': title, title }, label);
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); game.startAudio(); inp.tapKey(code()); });
      return b;
    };
    this.el.append(h('div.touch-menus', {},
      tap('☰', 'Pause', () => 'Escape'),
      tap('⬆', 'Upgrades (inside the Outfitter’s hut)', () => inp.code('upgrades')),
      tap('🌐', 'Planet view', () => inp.code('planet')),
      tap('📓', 'Notebook', () => inp.code('collections')),
      tap('👥', 'Crew', () => inp.code('coop')),
      tap('🎵', 'Music', () => inp.code('music'))));
    root.appendChild(this.el);

    // the zone: left part moves, the rest looks
    this.touches = new Map();
    this.zone.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      game.startAudio();
      if (!inp.locked) { if (game.wantsLock()) inp.lock(); }
      try { this.zone.setPointerCapture(ev.pointerId); } catch { /* a pointer that is already gone */ }
      const left = this.g.view !== 'planet' && ev.clientX < innerWidth * 0.42 && ![...this.touches.values()].some((t) => t.kind === 'move');
      this.touches.set(ev.pointerId, { kind: left ? 'move' : 'look', x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY });
      if (left) { this.stick.hidden = false; this.stick.style.left = `${ev.clientX}px`; this.stick.style.top = `${ev.clientY}px`; this.setKnob(0, 0); }
    });
    this.zone.addEventListener('pointermove', (ev) => {
      const t = this.touches.get(ev.pointerId);
      if (!t) return;
      ev.preventDefault();
      if (t.kind === 'look' || this.g.view === 'planet') {
        if (this.g.view === 'planet') this.g.planetView.drag(ev.clientX - t.x, ev.clientY - t.y);   // turn the globe
        else if (inp.locked) { inp.mouse.dx += (ev.clientX - t.x) * LOOK_GAIN; inp.mouse.dy += (ev.clientY - t.y) * LOOK_GAIN; }
        t.x = ev.clientX; t.y = ev.clientY;
      } else {
        let dx = ev.clientX - t.x0, dy = ev.clientY - t.y0;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        this.setKnob(dx, dy);
        this.setMove(dx / STICK_R, dy / STICK_R, d > STICK_R * 1.15);
      }
    });
    const end = (ev) => {
      const t = this.touches.get(ev.pointerId);
      if (!t) return;
      this.touches.delete(ev.pointerId);
      if (t.kind === 'move') { this.stick.hidden = true; this.setMove(0, 0, false); }
    };
    for (const t of ['pointerup', 'pointercancel']) this.zone.addEventListener(t, end);
  }

  setKnob(dx, dy) { this.stick.firstChild.style.transform = `translate(${dx}px, ${dy}px)`; }

  // the stick drives the four move actions (with a dead zone), and sprint when pushed past its edge
  setMove(x, y, sprint) {
    const inp = this.g.input, dz = 0.3;
    inp.hold('forward', y < -dz); inp.hold('back', y > dz);
    inp.hold('left', x < -dz); inp.hold('right', x > dz);
    inp.hold('sprint', sprint);
  }

  // shown while playing; in the planet view only the menu buttons (and dragging the globe); hidden in menus
  update() {
    const g = this.g;
    const show = g.started && !g.menus.open && ['fp', 'fpIn', 'planet'].includes(g.view);
    if (this.el.hidden === show) this.el.hidden = !show;
    this.el.classList.toggle('planet', g.view === 'planet');
    if (!show && this.touches.size) { this.touches.clear(); this.stick.hidden = true; this.setMove(0, 0, false); }
    const lift = show && g.view !== 'planet' && !!(g.liftReady || g.ride);
    if (this.liftBtn.hidden === lift) this.liftBtn.hidden = !lift;
    if (!lift && g.touchLift && !g.ride) { g.touchLift = false; this.liftBtn.classList.remove('on'); }
  }
}

// a phone or tablet: touch is the main pointer (or ?touch in the address to try it on a desktop)
export function isTouchDevice(qs) {
  if (qs.has('touch')) return true;
  if (qs.has('desktop')) return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
}
