// Synthesized WebAudio: no audio files.
import { Music } from './music.js';
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.7; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    // soft room tone
    this.amb = this.ctx.createGain(); this.amb.gain.value = 0.05; this.amb.connect(this.master);
    this.drones = [];
    for (const f of [55, 82.5, 110]) {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = f === 55 ? 0.6 : 0.25; o.connect(g); g.connect(this.amb); o.start(); this.drones.push({ o, g });
    }
    // quiet-floor layer, silent until a floor is Quiet
    this.quietGain = this.ctx.createGain(); this.quietGain.gain.value = 0; this.quietGain.connect(this.master);
    for (const f of [220, 277.2, 329.6]) { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = this.ctx.createGain(); g.gain.value = 0.012; o.connect(g); g.connect(this.quietGain); o.start(); }
    this.noise = this.makeNoise();
    // tide surf bed
    this.surf = this.ctx.createGain(); this.surf.gain.value = 0;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    this.surfFilter = this.ctx.createBiquadFilter(); this.surfFilter.type = 'lowpass'; this.surfFilter.frequency.value = 500;
    src.connect(this.surfFilter); this.surfFilter.connect(this.surf); this.surf.connect(this.master); src.start();
  }
  // Each biome tunes the room tone a little differently.
  setBiome(id) {
    if (!this.ctx || this.biome === id) return; this.biome = id;
    const base = { playroom: 55, pools: 49, office: 58.3, greenhouse: 61.7, library: 46.2, cinema: 51.9 }[id] || 55;
    this.drones.forEach((d, i) => d.o.frequency.setTargetAtTime(base * [1, 1.5, 2][i], this.ctx.currentTime, 3));
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  setQuiet(on) { if (this.quietGain) this.quietGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 2); }
  setSurf(level) { if (this.surf) { this.surf.gain.setTargetAtTime(Math.min(0.4, level * 0.4), this.ctx.currentTime, 0.4); this.surfFilter.frequency.setTargetAtTime(300 + level * 900, this.ctx.currentTime, 0.4); } }
  makeNoise() {
    const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b;
  }
  throttle(key, ms) { const now = performance.now(); if (this.last[key] && now - this.last[key] < ms) return false; this.last[key] = now; return true; }
  tone(freq, dur = 0.12, type = 'sine', gain = 0.12, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  burst(dur = 0.2, freq = 1200, gain = 0.15, q = 1, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // quantity scales the sound: more items, fuller sound
  clear(qty, combo, kind) {
    if (!this.throttle('clear', 55)) return;
    const n = Math.min(4, 1 + Math.floor(Math.log2(1 + qty * 4)));
    const base = { ball: 520, foam: 300, paper: 900, leaf: 700, book: 220, popcorn: 1100 }[kind] || 500;
    for (let i = 0; i < n; i++) this.tone(base * (1 + 0.25 * (combo - 1)) * (1 + Math.random() * 0.3), 0.08, kind === 'book' ? 'square' : 'triangle', 0.035 + 0.01 * n, i * 0.018);
  }
  polish(amt) { if (!this.throttle('polish', 80)) return; this.burst(0.12, 3500 + Math.random() * 1500, 0.03 + Math.min(0.05, amt * 0.05), 3); }
  lamp() { this.tone(660, 0.25, 'sine', 0.15); this.tone(990, 0.4, 'sine', 0.1, 0.08); this.burst(0.06, 2000, 0.1, 2); }
  done() { [523.3, 659.3, 784].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.08, i * 0.09)); }
  buy() { this.tone(784, 0.15, 'triangle', 0.1); this.tone(1175, 0.25, 'triangle', 0.08, 0.06); }
  deny() { this.tone(220, 0.15, 'sine', 0.08); }
  bell() { for (const [f, g] of [[880, 0.15], [1320, 0.06], [2210, 0.03]]) this.tone(f, 2.2, 'sine', g); }
  step() { if (this.throttle('step', 330)) this.burst(0.05, 300, 0.02, 1); }
  slide() { if (this.throttle('slide', 200)) this.burst(0.25, 1800, 0.03, 0.8); }
  rare() { [784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.07, i * 0.07)); }
  whoosh() { this.burst(0.4, 600, 0.12, 0.6); }
  sparks(n = 1) { for (let i = 0; i < Math.min(6, n); i++) this.tone(2000 + Math.random() * 2000, 0.06, 'sine', 0.04, i * 0.03); }
  swell() { if (!this.ctx) return; this.burst(1.2, 400, 0.25, 0.4); this.tone(110, 1.2, 'sine', 0.12, 0, 1.5); }
  chime(i = 0) { this.tone(660 * Math.pow(1.122, i), 0.6, 'sine', 0.06); }
}
