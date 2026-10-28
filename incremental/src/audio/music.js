// Generative score: "glacial orchestral electronics", synthesised and seeded so it never repeats.
// Layers enter with crater depth: surface (pads, glass harmonica, ice grains), mid (mallet pulse,
// drone), deep (bowed metal, soft brass, low pulse), core approach (full, faster, urgent).
import { rng } from '../core/rng.js';
import { THEME_BY_ID, VARIATION_BY_ID } from './themes.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const LAYERS = ['pad', 'glass', 'grain', 'mallet', 'drone', 'bowed', 'brass', 'perc'];

export class Music {
  constructor(engine) {
    this.e = engine;
    this.theme = THEME_BY_ID.frostara;
    this.r = rng((Date.now() / 1000) | 0);
    this.depthF = 0;          // 0..1 of the planet's goal depth
    this.activity = 0;        // recent tool use, nudges intensity
    this.enabled = true;
    this.step = 0;
    this.nextTime = 0;
    this.chordIdx = 0;
    this.melody = 0;
    this.timer = null;
    this.layerGain = {};
  }

  start() {
    if (!this.e.ready || this.timer) return;
    const ctx = this.e.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(this.e.bus.music);
    this.out.gain.setTargetAtTime(this.enabled ? 1 : 0, ctx.currentTime, 2);
    for (const l of LAYERS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.out); this.layerGain[l] = g; }
    // a shared slow chorus/delay for shimmer
    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.42;
    this.fb = ctx.createGain(); this.fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    this.delay.connect(lp).connect(this.fb).connect(this.delay);
    this.delayIn = ctx.createGain(); this.delayIn.gain.value = 0.3;
    this.delayIn.connect(this.delay);
    lp.connect(this.out);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
    this.updateMix(true);
  }

  setTheme(id) { if (THEME_BY_ID[id] && !THEME_BY_ID[id].locked) { this.baseTheme = THEME_BY_ID[id]; this.applyVariation(); } }

  // A variation (Audio tree) reshapes the current theme: tempo, brightness and layer weights.
  setVariation(id) { this.variation = VARIATION_BY_ID[id] ? id : 'base'; this.applyVariation(); }
  applyVariation() {
    const b = this.baseTheme || this.theme, m = (VARIATION_BY_ID[this.variation || 'base'] || {}).mod || {};
    this.theme = { ...b, bpm: b.bpm.map((x) => x * (m.bpm || 1)), bright: b.bright * (m.bright || 1), glass: b.glass * (m.glass || 1), bowed: b.bowed * (m.bowed || 1), choir: (b.choir || 0) * (m.choir || 1) };
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.out) this.out.gain.setTargetAtTime(on ? 1 : 0, this.e.ctx.currentTime, on ? 1.5 : 0.4);
  }

  setDepth(f, activity) {
    this.depthF = Math.max(0, Math.min(1, f));
    this.activity = activity;
  }

  // target layer gains from depth
  mix() {
    const f = this.depthF;
    const s = (a, b) => Math.max(0, Math.min(1, (f - a) / (b - a)));
    return {
      pad: 0.55, glass: 0.5 * (1 - 0.4 * s(0.4, 1)), grain: 0.25 + 0.2 * s(0, 0.3),
      mallet: 0.45 * s(0.006, 0.04), drone: 0.6 * s(0.02, 0.12),
      bowed: 0.5 * s(0.15, 0.35), brass: 0.42 * s(0.25, 0.5), perc: 0.5 * s(0.3, 0.55) + 0.3 * s(0.8, 0.95),
    };
  }

  updateMix(now = false) {
    if (!this.out) return;
    const m = this.mix();
    const t = this.e.ctx.currentTime;
    for (const l of LAYERS) this.layerGain[l].gain.setTargetAtTime(m[l], t, now ? 0.1 : 4);
  }

  bpm() { const [a, b] = this.theme.bpm; return a + (b - a) * Math.pow(this.depthF, 0.8); }

  scaleNote(deg, oct = 0) {
    const m = this.theme.mode;
    const o = Math.floor(deg / m.length);
    const d = ((deg % m.length) + m.length) % m.length;
    return this.theme.root + m[d] + 12 * (o + oct);
  }

  chord(deg) { return [0, 2, 4, 6].map((k) => this.scaleNote(deg + k)); }

  schedule() {
    if (!this.e.ready || !this.enabled) return;
    const ctx = this.e.ctx;
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    const s16 = 60 / this.bpm() / 4;
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.tick(this.step, this.nextTime, s16);
      this.step++;
      this.nextTime += s16;
    }
    if (this.step % 32 === 0) this.updateMix();
  }

  tick(step, t, s16) {
    const r = this.r;
    const bar = Math.floor(step / 16), s = step % 16;
    const m = this.mix();
    // chords change every two bars
    if (s === 0 && bar % 2 === 0) {
      this.chordIdx = (this.chordIdx + 1) % this.theme.prog.length;
      if (r() < 0.15) this.chordIdx = Math.floor(r() * this.theme.prog.length);
      const deg = this.theme.prog[this.chordIdx];
      this.cur = deg;
      const dur = s16 * 32;
      this.pad(this.chord(deg).map((n) => n - 12), t, dur);
      if (m.drone > 0.01) this.drone(this.scaleNote(0, -2), t, dur);
      if (m.brass > 0.01 && r() < 0.7) this.brass(this.chord(deg).slice(0, 3).map((n) => n - 12), t + s16 * 4, s16 * 20);
      if (this.theme.choir > 0.01) this.choir(this.chord(deg).map((n) => n - (r() < 0.5 ? 0 : 12)), t + s16 * 2, s16 * 30);
      if (m.bowed > 0.01 && r() < 0.6) this.bowed(this.scaleNote(deg + (r() < 0.5 ? 4 : 6), 0), t + s16 * 8, s16 * 22);
    }
    const deg = this.cur ?? 0;
    // glass harmonica melody: sparse, stepwise, resting often
    if ((s === 0 || s === 6 || s === 10) && r() < 0.55) {
      this.melody += r() < 0.5 ? (r() < 0.5 ? 1 : -1) : (r() < 0.5 ? 2 : -2);
      if (Math.abs(this.melody) > 6) this.melody = Math.sign(this.melody) * 3;
      const note = this.scaleNote(deg + 7 + this.melody);
      this.glass(note, t, s16 * (4 + Math.floor(r() * 6)));
    }
    // mallet pulse: arpeggiated chord tones
    if (m.mallet > 0.01 && s % 2 === 0) {
      const pat = [0, 2, 4, 6, 4, 2, 7, 4];
      if (r() < 0.82) this.mallet(this.scaleNote(deg + pat[(s / 2) % 8] + 7), t, 0.5 + 0.5 * (s === 0 ? 1 : r()));
    }
    // ice grains: scattered high texture
    if (r() < 0.35) this.grain(t + r() * s16);
    // low pulse
    if (m.perc > 0.01) {
      const fast = this.depthF > 0.8;
      if (s === 0 || s === 8 || (fast && (s === 4 || s === 12))) this.thump(t, s === 0 ? 1 : 0.6);
      if ((s % 4 === 2) && r() < 0.6) this.tick16(t);
    }
  }

  // ---- voices ----

  voiceOut(layer, send = 0) {
    const g = this.e.ctx.createGain();
    g.connect(this.layerGain[layer]);
    if (send) { const s = this.e.ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.delayIn); }
    return g;
  }

  pad(notes, t, dur) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('pad', 0.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(900 + 900 * this.theme.bright, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(600, t + dur);
    lp.Q.value = 0.4;
    lp.connect(out);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.11, t + 2.5);
    out.gain.setValueAtTime(0.11, t + dur - 0.5);
    out.gain.linearRampToValueAtTime(0.0001, t + dur + 3.5);
    for (const n of notes) for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = mtof(n); o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.18;
      o.connect(g).connect(lp);
      o.start(t); o.stop(t + dur + 4);
    }
  }

  glass(note, t, dur) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('glass', 0.5);
    const f = mtof(note);
    const vib = ctx.createOscillator(); vib.frequency.value = 4.6; const vg = ctx.createGain(); vg.gain.value = f * 0.004;
    vib.connect(vg);
    for (const [ratio, amp] of [[1, 1], [2, 0.18], [3, 0.07]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * ratio;
      vg.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09 * amp * this.theme.glass, t + 0.3);
      g.gain.setTargetAtTime(0.0001, t + Math.max(0.4, dur), 0.9);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + dur + 4);
    }
    vib.start(t); vib.stop(t + dur + 4);
  }

  mallet(note, t, vel = 1) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('mallet', 0.45);
    const f = mtof(note);
    const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = f;
    const mo = ctx.createOscillator(); mo.type = 'sine'; mo.frequency.value = f * 3.5;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.25);
    mo.connect(mg).connect(c.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * vel * this.theme.mallet, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    c.connect(g).connect(out);
    c.start(t); mo.start(t); c.stop(t + 1.4); mo.stop(t + 1.4);
  }

  drone(note, t, dur) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('drone');
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.16, t + 3); out.gain.setValueAtTime(0.16, t + dur - 1); out.gain.linearRampToValueAtTime(0.0001, t + dur + 2);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(note);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mtof(note + 12); o2.detune.value = 4;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(out); o2.connect(g2).connect(out);
    o.start(t); o2.start(t); o.stop(t + dur + 2.5); o2.stop(t + dur + 2.5);
  }

  bowed(note, t, dur) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('bowed', 0.35);
    const f = mtof(note);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = f * 0.006;
    vib.connect(vg).connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 9;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = f * 5.1; bp2.Q.value = 14;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * this.theme.bowed, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(g); o.connect(bp2).connect(g); g.connect(out);
    o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
  }

  // a wordless choir: detuned voices through vowel formants, slowly opening from "oo" to "ah"
  choir(notes, t, dur) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('pad', 0.45);
    const amp = 0.09 * this.theme.choir;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(amp, t + dur * 0.35);
    out.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    const forms = [[400, 800, 6], [1150, 1150, 8], [2800, 2900, 12]];
    const bus = ctx.createGain(); bus.gain.value = 1;
    for (const [f0, f1, q] of forms) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + dur * 0.6);
      bus.connect(bp).connect(out);
    }
    for (const n of notes) for (const det of [-9, 0, 8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = mtof(n); o.detune.value = det;
      const vib = ctx.createOscillator(); vib.frequency.value = 4.6 + Math.random(); const vg = ctx.createGain(); vg.gain.value = 7;
      vib.connect(vg).connect(o.detune);
      const g = ctx.createGain(); g.gain.value = 0.22;
      o.connect(g).connect(bus);
      o.start(t); vib.start(t); o.stop(t + dur + 2); vib.stop(t + dur + 2);
    }
  }

  brass(notes, t, dur) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('brass', 0.15);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.45); lp.frequency.linearRampToValueAtTime(420, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * this.theme.brass, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    lp.connect(g).connect(out);
    for (const n of notes) for (const det of [-5, 5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.8);
    }
  }

  grain(t) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('grain', 0.6);
    const n = ctx.createBufferSource(); n.buffer = this.e.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000 + this.r() * 6000; bp.Q.value = 18;
    const g = ctx.createGain();
    const d = 0.03 + this.r() * 0.12;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(bp).connect(g).connect(out);
    n.start(t, this.r() * 1.5, d + 0.02);
  }

  thump(t, v) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('perc');
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * v * this.theme.perc, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.7);
  }

  tick16(t) {
    const ctx = this.e.ctx;
    const out = this.voiceOut('perc', 0.3);
    const n = ctx.createBufferSource(); n.buffer = this.e.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(hp).connect(g).connect(out); n.start(t, this.r(), 0.07);
  }

  // ---- event cues ----

  cue(kind, arg = 0) {
    if (!this.e.ready || !this.out) return;
    const t = this.e.ctx.currentTime + 0.05;
    const deg = this.cur ?? 0;
    if (kind === 'resonance') {
      // a lush add9 bloom with a rising glass arpeggio
      const notes = [0, 2, 4, 6, 8].map((k) => this.scaleNote(deg + k + 7));
      notes.forEach((n, i) => this.glass(n, t + i * 0.09, 2.5));
      this.pad(this.chord(deg).map((n) => n - 12), t, 4);
    } else if (kind === 'motif') {
      const shapes = [[0, 2, 4, 7], [7, 4, 6, 9], [0, 4, 7, 11]];
      shapes[arg % shapes.length].forEach((k, i) => this.mallet(this.scaleNote(k + 7), t + i * 0.16, 1));
      this.glass(this.scaleNote(14), t + 0.64, 2.2);
    } else if (kind === 'stinger') {
      [14, 11, 9, 7, 4, 2].forEach((k, i) => this.mallet(this.scaleNote(k + 7), t + i * 0.07, 1));
      this.thump(t, 1.2);
      this.brass(this.chord(0).map((n) => n - 12), t + 0.1, 2.5);
    } else if (kind === 'swell') {
      this.pad(this.chord(deg), t, 6);
      this.bowed(this.scaleNote(deg + 4), t, 6);
    } else if (kind === 'capsule') {
      [0, 4, 7, 11, 14].forEach((k, i) => this.mallet(this.scaleNote(k), t + i * 0.11, 0.8));
    }
  }
}
