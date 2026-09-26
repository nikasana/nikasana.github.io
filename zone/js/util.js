'use strict';
// ---------- math & random helpers ----------
const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

function mulberry32(s) {
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, s = 0) {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
}
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function fmtTime(t) { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }

// ---------- synthesized audio ----------
const Sfx = {
  ctx: null, master: null, muted: false, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ambient();
    } catch (e) { this.ctx = null; }
  },
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.32; return this.muted; },
  can(name, gap) { const t = performance.now(); if (this.last[name] && t - this.last[name] < gap) return false; this.last[name] = t; return true; },
  tone(f, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq = 2000, type = 'lowpass', delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  ambient() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = 55; og.gain.value = 0.025;
    o.connect(og); og.connect(this.master); o.start();
    this.siren = null;
  },
  play(n) {
    if (!this.ctx || this.muted) return;
    switch (n) {
      case 'pistol': if (!this.can(n, 60)) return; this.noise(0.09, 0.22, 2600); this.tone(180, 0.07, 'square', 0.05, -90); break;
      case 'ak': if (!this.can(n, 55)) return; this.noise(0.07, 0.18, 3200); this.tone(120, 0.05, 'square', 0.05, -50); break;
      case 'shotgun': if (!this.can(n, 90)) return; this.noise(0.25, 0.4, 1200); this.tone(80, 0.15, 'square', 0.1, -40); break;
      case 'gauss': if (!this.can(n, 90)) return; this.tone(1400, 0.35, 'sawtooth', 0.12, -1200); this.noise(0.3, 0.15, 5000, 'highpass'); break;
      case 'throw': if (!this.can(n, 80)) return; this.noise(0.12, 0.08, 900, 'bandpass'); break;
      case 'knife': if (!this.can(n, 80)) return; this.noise(0.1, 0.12, 4000, 'highpass'); break;
      case 'boom': if (!this.can(n, 70)) return; this.noise(0.6, 0.5, 500); this.tone(60, 0.5, 'sine', 0.3, -30); break;
      case 'hit': if (!this.can(n, 35)) return; this.tone(220 + Math.random() * 60, 0.05, 'triangle', 0.06, -100); break;
      case 'kill': if (!this.can(n, 50)) return; this.noise(0.12, 0.1, 700); break;
      case 'hurt': if (!this.can(n, 150)) return; this.tone(160, 0.2, 'sawtooth', 0.16, -80); this.noise(0.15, 0.15, 900); break;
      case 'gem': if (!this.can(n, 40)) return; this.tone(900 + Math.random() * 300, 0.07, 'sine', 0.05, 300); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, 0, i * 0.08)); break;
      case 'artifact': [392, 587, 784, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, 0, i * 0.07)); break;
      case 'zap': if (!this.can(n, 120)) return; this.noise(0.25, 0.25, 6000, 'highpass'); this.tone(90, 0.2, 'sawtooth', 0.1, 400); break;
      case 'fire': if (!this.can(n, 300)) return; this.noise(0.8, 0.2, 700, 'bandpass'); break;
      case 'vortex': if (!this.can(n, 200)) return; this.tone(70, 0.6, 'sine', 0.3, -40); this.noise(0.5, 0.3, 300); break;
      case 'spring': if (!this.can(n, 120)) return; this.tone(300, 0.2, 'sine', 0.2, -250); break;
      case 'beep': this.tone(1850, 0.06, 'square', 0.035); break;
      case 'geiger': if (!this.can(n, 25)) return; this.noise(0.012, 0.25, 6000, 'highpass'); break;
      case 'dash': if (!this.can(n, 100)) return; this.noise(0.18, 0.12, 1500, 'bandpass'); break;
      case 'boss': this.tone(55, 2.2, 'sawtooth', 0.2, 20); this.tone(82, 2.2, 'sawtooth', 0.12, -20); this.noise(1.5, 0.2, 200); break;
      case 'siren': [0, 1.2, 2.4].forEach((d) => { this.tone(420, 1.1, 'sawtooth', 0.09, 380, d); }); break;
      case 'emission': this.noise(3, 0.6, 180); this.tone(40, 3, 'sine', 0.4, 30); break;
      case 'thunder': if (!this.can(n, 250)) return; this.noise(1.2, 0.45, 400); break;
      case 'stash': this.tone(300, 0.1, 'square', 0.06); this.tone(450, 0.15, 'square', 0.06, 0, 0.08); break;
      case 'heal': this.tone(600, 0.3, 'sine', 0.1, 400); break;
      case 'psi': if (!this.can(n, 400)) return; this.tone(200, 0.6, 'sine', 0.1, 600); this.tone(203, 0.6, 'sine', 0.1, 590); break;
      case 'stomp': if (!this.can(n, 200)) return; this.tone(45, 0.5, 'sine', 0.5, -20); this.noise(0.4, 0.4, 250); break;
      case 'roar': if (!this.can(n, 800)) return; this.noise(0.9, 0.3, 350, 'bandpass'); this.tone(110, 0.8, 'sawtooth', 0.1, -50); break;
    }
  },
};
