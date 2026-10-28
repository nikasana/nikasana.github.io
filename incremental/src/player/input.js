// Mouse and keyboard input with rebindable actions and pointer lock. On touch screens there is no
// pointer lock: 'locked' just means "playing", and the touch controls press the same bound codes.

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft',
  use: 'Mouse0', alt: 'Mouse2',
  tool1: 'Digit1', tool2: 'Digit2', tool3: 'Digit3', tool4: 'Digit4',
  planet: 'Tab', upgrades: 'KeyU', coop: 'KeyC', music: 'KeyM',
  collections: 'KeyJ', lamp: 'KeyF', lift: 'KeyR',
};

export const ACTION_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right',
  jump: 'Jump', sprint: 'Sprint', use: 'Use tool', alt: 'Tool secondary',
  tool1: 'Dig tools', tool2: 'Melt tools', tool3: 'Planet tools', tool4: 'Vision tools',
  planet: 'Planet view', upgrades: 'Upgrades', coop: 'Co-op crews', music: 'Music',
  collections: 'Notebook', lamp: 'Toggle lamp', lift: 'Ride the lift up (hold, in a crater)',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'Mouse 4', 'Mouse 5'][+code.slice(5)] || code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', Backquote: '`', Escape: 'Esc' }[code] || code;
}

export class Input {
  constructor(canvas, bindings) {
    this.canvas = canvas;
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings };
    this.down = new Set();
    this.pressed = new Set();   // edge-triggered this frame
    this.mouse = { dx: 0, dy: 0, wheel: 0 };
    this.locked = false;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.listeners = {};
    this.capture = null;        // rebinding callback
    this.blockGame = false;     // menus open

    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    canvas.addEventListener('mousedown', (e) => this.onMouse(e, true));
    addEventListener('mouseup', (e) => this.onMouse(e, false));
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.down.clear();
      if (was !== this.locked) this.emit('lock', this.locked);
    });
    addEventListener('blur', () => this.down.clear());
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  lock() {
    if (this.locked) return;
    if (this.touch) { this.locked = true; this.emit('lock', true); return; }
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch { /* not available */ } });
    } catch { /* not available */ }
  }
  unlock() {
    if (this.touch) { if (this.locked) { this.locked = false; this.down.clear(); this.emit('lock', false); } return; }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // touch controls: hold an action, or tap a key as if it had been pressed
  hold(action, on) {
    const code = this.bindings[action];
    if (on) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); } else this.down.delete(code);
  }
  tapKey(code) { this.pressed.add(code); this.emit('key', code, { preventDefault() {} }); }

  onKey(e, isDown) {
    if (this.capture && isDown) {
      e.preventDefault();
      const cb = this.capture; this.capture = null;
      cb(e.code === 'Escape' ? null : e.code);
      return;
    }
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Tab' || (this.locked && (e.code === 'Space' || e.code.startsWith('Arrow')))) e.preventDefault();
    if (isDown) {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      this.emit('key', e.code, e);
    } else this.down.delete(e.code);
  }

  onMouse(e, isDown) {
    const code = `Mouse${e.button}`;
    if (this.capture && isDown && e.target.closest && !e.target.closest('.keycap')) {
      const cb = this.capture; this.capture = null; cb(code); return;
    }
    if (isDown) {
      if (e.target !== this.canvas) return;
      if (!this.locked) { this.emit('click'); return; }
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    } else this.down.delete(code);
  }

  is(action) { return !this.blockGame && this.down.has(this.bindings[action]); }
  was(action) { return this.pressed.has(this.bindings[action]); }
  code(action) { return this.bindings[action]; }

  consumeMouse() {
    const m = { ...this.mouse };
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
    return m;
  }

  endFrame() { this.pressed.clear(); }

  rebind(action, cb) {
    this.capture = (code) => {
      if (code) {
        for (const [a, c] of Object.entries(this.bindings)) if (c === code && a !== action) this.bindings[a] = this.bindings[action];
        this.bindings[action] = code;
      }
      cb(this.bindings);
    };
  }
}
