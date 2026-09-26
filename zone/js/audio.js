'use strict';
// ---------- synthesized sound effects + procedural music ----------
const Sfx = {
  ctx: null, master: null, sfx: null, mus: null, amb: null, voice: null, muted: false, last: {},
  vol: { master: 0.8, music: 0.5, sfx: 0.8, amb: 0.7, voice: 0.8 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      this.mus = this.ctx.createGain(); this.mus.connect(this.master);
      this.amb = this.ctx.createGain(); this.amb.connect(this.master);
      this.voice = this.ctx.createGain(); this.voice.connect(this.master);
      this.applyVol();
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ambient();
      FM.start(); radioUI();
    } catch (e) { this.ctx = null; }
  },
  applyVol() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.vol.master * 0.4;
    this.sfx.gain.value = this.vol.sfx;
    this.mus.gain.value = this.vol.music * 0.55;
    this.amb.gain.value = this.vol.amb;
    this.voice.gain.value = this.vol.voice;
  },
  toggle() { this.muted = !this.muted; this.applyVol(); return this.muted; },
  can(name, gap) { const t = performance.now(); if (this.last[name] && t - this.last[name] < gap) return false; this.last[name] = t; return true; },
  tone(f, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0, out) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out || this.sfx); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq = 2000, type = 'lowpass', delay = 0, out) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  ambient() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    s.connect(f); f.connect(g); g.connect(this.amb); s.start();
    this.rain = c.createGain(); this.rain.gain.value = 0;
    const rs = c.createBufferSource(); rs.buffer = this.noiseBuf; rs.loop = true;
    const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1200;
    rs.connect(rf); rf.connect(this.rain); this.rain.connect(this.amb); rs.start();
  },
  setRain(v) { if (this.rain) this.rain.gain.setTargetAtTime(v * 0.12, this.ctx.currentTime, 0.8); },
  play(n) {
    if (!this.ctx || this.muted) return;
    switch (n) {
      case 'pistol': if (!this.can(n, 60)) return; this.noise(0.09, 0.22, 2600); this.tone(180, 0.07, 'square', 0.05, -90); break;
      case 'ak': if (!this.can(n, 55)) return; this.noise(0.07, 0.18, 3200); this.tone(120, 0.05, 'square', 0.05, -50); break;
      case 'shotgun': if (!this.can(n, 90)) return; this.noise(0.25, 0.4, 1200); this.tone(80, 0.15, 'square', 0.1, -40); break;
      case 'gauss': if (!this.can(n, 90)) return; this.tone(1400, 0.35, 'sawtooth', 0.12, -1200); this.noise(0.3, 0.15, 5000, 'highpass'); break;
      case 'throw': if (!this.can(n, 80)) return; this.noise(0.12, 0.08, 900, 'bandpass'); break;
      case 'knife': if (!this.can(n, 80)) return; this.noise(0.1, 0.12, 4000, 'highpass'); break;
      case 'boom': // layered: sub thump, crack, debris tail
        if (!this.can(n, 70)) return;
        this.tone(58, 0.55, 'sine', 0.38, -32); this.noise(0.12, 0.45, 3500, 'bandpass');
        this.noise(0.7, 0.4, 480); this.noise(0.9, 0.09, 5000, 'highpass', 0.12); this.tone(140, 0.25, 'triangle', 0.08, -90, 0.03);
        break;
      case 'hit': if (!this.can(n, 35)) return; this.tone(220 + Math.random() * 60, 0.05, 'triangle', 0.06, -100); break;
      case 'crit': if (!this.can(n, 60)) return; this.tone(900, 0.08, 'square', 0.05, 400); break;
      case 'kill': if (!this.can(n, 50)) return; this.noise(0.12, 0.1, 700); break;
      case 'hurt': if (!this.can(n, 150)) return; this.tone(160, 0.2, 'sawtooth', 0.16, -80); this.noise(0.15, 0.15, 900); break;
      case 'gem': if (!this.can(n, 40)) return; this.tone(900 + Math.random() * 300, 0.07, 'sine', 0.05, 300); break;
      case 'coin': if (!this.can(n, 60)) return; this.tone(1300, 0.06, 'square', 0.04); this.tone(1700, 0.08, 'square', 0.04, 0, 0.05); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, 0, i * 0.08)); break;
      case 'legend': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, 0, i * 0.07)); this.noise(1, 0.1, 6000, 'highpass'); break;
      case 'artifact': [392, 587, 784, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, 0, i * 0.07)); break;
      case 'zap': if (!this.can(n, 120)) return; this.noise(0.25, 0.25, 6000, 'highpass'); this.tone(90, 0.2, 'sawtooth', 0.1, 400); break;
      case 'fire': if (!this.can(n, 300)) return; this.noise(0.8, 0.2, 700, 'bandpass'); break;
      case 'vortex': if (!this.can(n, 200)) return; this.tone(70, 0.6, 'sine', 0.3, -40); this.noise(0.5, 0.3, 300); break;
      case 'spring': if (!this.can(n, 120)) return; this.tone(300, 0.2, 'sine', 0.2, -250); break;
      case 'beep': this.tone(1850, 0.06, 'square', 0.035, 0, 0, this.voice); break;
      case 'geiger': if (!this.can(n, 25)) return; this.noise(0.012, 0.25, 6000, 'highpass'); break;
      case 'dash': if (!this.can(n, 100)) return; this.noise(0.18, 0.12, 1500, 'bandpass'); break;
      case 'boss': this.tone(55, 2.2, 'sawtooth', 0.2, 20); this.tone(82, 2.2, 'sawtooth', 0.12, -20); this.noise(1.5, 0.2, 200); break;
      case 'enrage': this.tone(70, 1.2, 'sawtooth', 0.25, 60); this.noise(1, 0.3, 400, 'bandpass'); break;
      case 'siren': { // each stage has its own alarm
        const st = typeof World !== 'undefined' ? (World.kind === 'lab' ? 'lab' : World.stage) : 'zone';
        if (st === 'lab') for (let i = 0; i < 6; i++) this.tone(i % 2 ? 660 : 880, 0.22, 'square', 0.05, 0, i * 0.3);
        else if (st === 'pripyat') { this.tone(300, 3, 'sawtooth', 0.08, 500); this.tone(302, 3, 'sawtooth', 0.05, 490); }
        else if (st === 'npp') for (let i = 0; i < 6; i++) this.tone(i % 2 ? 440 : 554, 0.45, 'square', 0.06, 0, i * 0.5);
        else [0, 1.2, 2.4].forEach((d) => { this.tone(420, 1.1, 'sawtooth', 0.09, 380, d); });
        break;
      }
      case 'emission': this.noise(3, 0.6, 180); this.tone(40, 3, 'sine', 0.4, 30); break;
      case 'thunder': if (!this.can(n, 250)) return; this.noise(1.2, 0.45, 400); break;
      case 'stash': this.tone(300, 0.1, 'square', 0.06); this.tone(450, 0.15, 'square', 0.06, 0, 0.08); break;
      case 'heal': this.tone(600, 0.3, 'sine', 0.1, 400); break;
      case 'psi': if (!this.can(n, 400)) return; this.tone(200, 0.6, 'sine', 0.1, 600); this.tone(203, 0.6, 'sine', 0.1, 590); break;
      case 'stomp': if (!this.can(n, 200)) return; this.tone(45, 0.5, 'sine', 0.5, -20); this.noise(0.4, 0.4, 250); break;
      case 'roar': if (!this.can(n, 800)) return; this.noise(0.9, 0.3, 350, 'bandpass'); this.tone(110, 0.8, 'sawtooth', 0.1, -50); break;
      case 'radio': this.noise(0.25, 0.08, 2500, 'bandpass', 0, this.voice); this.tone(1200, 0.05, 'square', 0.02, 0, 0.2, this.voice); break;
      case 'hint': this.tone(880, 0.12, 'sine', 0.06, 0, 0, this.voice); this.tone(1320, 0.18, 'sine', 0.06, 0, 0.1, this.voice); break;
      case 'ability': this.tone(200, 0.6, 'sawtooth', 0.12, 800); this.noise(0.6, 0.2, 3000, 'bandpass'); break;
      case 'break': if (!this.can(n, 80)) return; this.noise(0.2, 0.2, 1800, 'bandpass'); this.tone(140, 0.1, 'square', 0.05, -60); break;
      case 'hatch': this.tone(90, 0.5, 'square', 0.08, -30); this.noise(0.6, 0.2, 600); break;
      case 'quest': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.2, 'square', 0.05, 0, i * 0.09)); break;
    }
  },
};

// Procedural soundtrack: minor-key pads, plucked arpeggios, bass, and drums that kick in with intensity.
const Music = {
  on: false, step: 0, nextT: 0, intensity: 0, target: 0, timer: null, bpm: 84, theme: 'zone', shift: 0,
  THEMES: {
    zone: { bpm: 84, shift: 0 },
    pripyat: { bpm: 76, shift: -2, prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64], [50, 53, 57], [53, 57, 60], [52, 56, 59]] },
    npp: { bpm: 70, shift: -5, prog: [[57, 60, 64], [58, 62, 65], [57, 60, 64], [55, 58, 62], [53, 57, 60], [58, 62, 65], [57, 60, 64], [56, 60, 63]] },
    lab: { bpm: 92, shift: 1, prog: [[57, 60, 64], [57, 60, 63], [56, 59, 63], [57, 60, 64], [53, 56, 60], [52, 55, 59], [53, 56, 60], [52, 56, 59]] },
    boss: { bpm: 108, shift: 0, prog: [[57, 60, 64], [58, 62, 65], [57, 60, 64], [58, 61, 65], [55, 58, 62], [56, 60, 63], [57, 60, 64], [58, 62, 65]] },
  },
  setTheme(k, shift = 0) { if (this.THEMES[k]) { this.theme = k; this.shift = shift; } },
  prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [52, 55, 59], [53, 57, 60], [52, 56, 59]],
  start() {
    if (this.on || !Sfx.ctx) return;
    this.on = true; this.nextT = Sfx.ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.tick(), 60);
  },
  setIntensity(v) { this.target = v; },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  tick() {
    const c = Sfx.ctx; if (!c || c.state !== 'running') return;
    const th = this.THEMES[this.theme] || this.THEMES.zone;
    this.bpm = th.bpm + (this.target >= 2 && this.theme !== 'boss' ? 8 : 0);
    if (!this.nextT || this.nextT < c.currentTime - 1) this.nextT = c.currentTime + 0.1;
    const sp = 60 / this.bpm / 4; // 16th note
    while (this.nextT < c.currentTime + 0.25) { this.play16(this.step, this.nextT, sp); this.nextT += sp; this.step++; }
  },
  play16(s, t, sp) {
    const I = this.target, out = Sfx.mus, bar = Math.floor(s / 16), pos = s % 16;
    const th = this.THEMES[this.theme] || this.THEMES.zone, P0 = th.prog || this.prog, sh = (th.shift || 0) + this.shift;
    const chord = P0[Math.floor(bar / 2) % P0.length].map((n) => n + sh);
    if (this.theme === 'boss' && pos % 2 === 0) Sfx.tone(this.hz(chord[0] - 24 + (pos % 8 === 6 ? 1 : 0)), sp * 1.6, 'sawtooth', 0.05, 0, t - Sfx.ctx.currentTime, Sfx.mus);
    const d = t - Sfx.ctx.currentTime;
    // pad at bar start (every 2 bars)
    if (pos === 0 && bar % 2 === 0) for (const n of chord) this.pad(this.hz(n - 12), sp * 32, d, out, I);
    // bass
    if (pos === 0 || (I >= 1 && pos === 8) || (I >= 2 && (pos === 6 || pos === 14))) this.pluck(this.hz(chord[0] - 24), sp * (I >= 2 ? 3 : 6), d, out, 'triangle', 0.22);
    // arpeggio: sparse when calm, busier in combat
    const arpOn = I >= 1 ? pos % 2 === 0 : (pos % 4 === 0 && ((s * 7919) % 5) < 3);
    if (arpOn) { const n = chord[(pos / 2 + bar) % 3] + (pos >= 8 ? 12 : 0); this.pluck(this.hz(n), sp * 3, d, out, 'triangle', I >= 1 ? 0.07 : 0.05); }
    // drums
    if (I >= 1) {
      if (pos === 0 || pos === 8 || (I >= 2 && pos === 10)) { Sfx.tone(110, 0.18, 'sine', 0.5, -70, d, out); }
      if (pos === 4 || pos === 12) Sfx.noise(0.14, I >= 2 ? 0.22 : 0.14, 1800, 'bandpass', d, out);
      if (pos % 2 === 0 || I >= 2) Sfx.noise(0.03, 0.04, 8000, 'highpass', d, out);
    }
    if (I >= 2 && pos % 4 === 2) Sfx.tone(this.hz(chord[0] - 12), sp * 1.5, 'sawtooth', 0.04, 0, d, out);
  },
  pluck(f, dur, d, out, type, vol) {
    const c = Sfx.ctx, t = c.currentTime + d, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  },
  pad(f, dur, d, out, I) {
    const c = Sfx.ctx, t = c.currentTime + d;
    const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = I >= 2 ? 1400 : 700;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
    fl.connect(g); g.connect(out);
  },
};
