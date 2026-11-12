// Desktop (keyboard + pointer lock) and touch (joystick + drag look + buttons) input.
export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.tool = false;
    this.slide = false;
    this.events = [];
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.locked = false;
    this.enabled = true;
    this.wheel = 0;

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!e.repeat) this.events.push({ type: 'key', code: e.code });
      this.keys.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.tool = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.tool = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.tool = false; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.look.x += e.movementX; this.look.y += e.movementY; } });
    addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.tool = false;
      this.events.push({ type: 'lock', locked: this.locked });
    });
    if (this.touch) this.setupTouch();
  }
  requestLock() { if (!this.touch && this.canvas.requestPointerLock) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  setupTouch() {
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
    const R = 55;
    const onStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('.tbtn, .panel, .overlay, button, input, select, textarea')) continue;
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = sx - 60 + 'px'; stick.style.top = sy - 60 + 'px'; stick.classList.add('on');
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.move.x = dx / R; this.move.y = -dy / R;
          e.preventDefault();
        } else if (t.identifier === lookId) {
          this.look.x += (t.clientX - lx) * 2.2; this.look.y += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY;
          e.preventDefault();
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; this.move.x = 0; this.move.y = 0; knob.style.transform = ''; stick.classList.remove('on'); }
        if (t.identifier === lookId) lookId = null;
      }
    };
    const surface = document.getElementById('touchsurface');
    surface.addEventListener('touchstart', onStart, { passive: false });
    surface.addEventListener('touchmove', onMove, { passive: false });
    surface.addEventListener('touchend', onEnd); surface.addEventListener('touchcancel', onEnd);
    const hold = (id, on, off) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); on(); el.classList.add('down'); }, { passive: false });
      const up = (e) => { e.preventDefault(); off && off(); el.classList.remove('down'); };
      el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
    };
    hold('bTool', () => { this.tool = true; }, () => { this.tool = false; });
    hold('bSlide', () => { this.slide = true; }, () => { this.slide = false; });
    for (const [id, code] of [['bUse', 'KeyE'], ['bMap', 'KeyM'], ['bHome', 'KeyH'], ['bGadget', 'KeyG'], ['bA1', 'Digit1'], ['bA2', 'Digit2'], ['bA3', 'Digit3'], ['bPing', 'KeyQ'], ['bMenu', 'Escape']]) {
      hold(id, () => this.events.push({ type: 'key', code }));
    }
  }

  // Desktop move vector from keys.
  poll() {
    if (!this.touch) {
      const k = this.keys;
      this.move.x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      this.move.y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      this.slide = k.has('ShiftLeft') || k.has('ShiftRight');
    }
    const ev = this.events; this.events = [];
    const look = { x: this.look.x, y: this.look.y }; this.look.x = 0; this.look.y = 0;
    const wheel = this.wheel; this.wheel = 0;
    if (!this.enabled) return { ev, look: { x: 0, y: 0 }, wheel: 0 };
    return { ev, look, wheel };
  }
}
