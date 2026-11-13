// Generative score, synthesized live: soft pads, a sparse plucked melody, a bass pulse,
// a warm string layer on Quiet floors and a swelling Tide layer. All through a generated reverb.
const BIOME_KEYS = {
  playroom:   { root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17]] },
  pools:      { root: 62, scale: [0, 2, 4, 6, 7, 9, 11], prog: [[0, 4, 7, 11], [2, 6, 9, 14], [7, 11, 14, 18], [4, 7, 11, 14]] },
  office:     { root: 57, scale: [0, 2, 3, 7, 10], prog: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [10, 14, 17, 21]] },
  greenhouse: { root: 55, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 14], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 18]] },
  library:    { root: 52, scale: [0, 2, 3, 5, 7, 10], prog: [[0, 3, 7, 10], [8, 12, 15, 19], [5, 8, 12, 15], [10, 14, 17, 21]] },
  cinema:     { root: 53, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]] },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx; this.vol = 0.6;
    this.bus = ctx.createGain(); this.bus.gain.value = this.vol;
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(4.5, 2.6);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.55;
    this.dry = ctx.createGain(); this.dry.gain.value = 0.6;
    this.dry.connect(this.bus); this.verb.connect(this.wet); this.wet.connect(this.bus); this.bus.connect(out);
    this.send = ctx.createGain(); this.send.connect(this.dry); this.send.connect(this.verb);
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 2400; this.lp.connect(this.send);
    this.key = BIOME_KEYS.playroom; this.nextKey = null;
    this.step = 0; this.bar = 0; this.chord = 0;
    this.bpm = 64; this.next = ctx.currentTime + 0.2;
    this.activity = 0; this.quiet = 0; this.tide = 0; this.warmth = 0;
    this.timer = setInterval(() => this.schedule(), 90);
  }
  impulse(secs, decay) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * secs), b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  setVolume(v) { this.vol = v; this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); }
  setBiome(id) { const k = BIOME_KEYS[id]; if (k && k !== this.key) this.nextKey = k; }
  setState({ activity, quiet, tide, warmth }) {
    if (activity !== undefined) this.activity = activity;
    if (quiet !== undefined) this.quiet = quiet;
    if (tide !== undefined) this.tide = tide;
    if (warmth !== undefined) { this.warmth = warmth; this.lp.frequency.setTargetAtTime(1600 + warmth * 2600, this.ctx.currentTime, 2); }
  }
  schedule() {
    if (this.ctx.state !== 'running') return;
    const spb = 60 / this.bpm / 2; // eighth notes
    while (this.next < this.ctx.currentTime + 0.35) { this.play(this.step, this.next); this.next += spb; this.step++; }
  }
  play(step, t) {
    const inBar = step % 16;
    if (inBar === 0) {
      this.bar++;
      if (this.bar % 2 === 1) { this.chord = (this.chord + 1) % 4; if (this.nextKey && this.chord === 0) { this.key = this.nextKey; this.nextKey = null; } }
      if (this.bar % 2 === 1) this.pad(t, 60 / this.bpm * 8.2);
      this.bass(t);
      if (this.quiet > 0.05) this.strings(t, 60 / this.bpm * 8.2);
    }
    if (inBar === 8) this.bass(t, 0.6);
    // sparse melody: more notes while the player is busy, never busy enough to crowd the room
    const density = 0.12 + 0.35 * this.activity;
    if (step % 2 === 0 && this.rand(step) < density) this.pluck(t);
    if (this.tide > 0.05 && inBar % 4 === 0) this.swell(t);
  }
  rand(n) { const x = Math.sin(n * 12.9898 + this.bar * 78.233) * 43758.5453; return x - Math.floor(x); }
  chordNotes() { return this.key.prog[this.chord].map((i) => this.key.root + i); }
  voice(freq, t, dur, type, gain, attack, detune = 0, dest = this.lp) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setTargetAtTime(0, t + dur - Math.min(dur * 0.5, 2), Math.min(dur * 0.25, 1));
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 4);
  }
  pad(t, dur) {
    for (const m of this.chordNotes()) for (const det of [-7, 7]) this.voice(mtof(m - 12), t, dur, 'sawtooth', 0.010, 2.2, det);
  }
  strings(t, dur) {
    for (const m of this.chordNotes().slice(1)) this.voice(mtof(m), t, dur, 'triangle', 0.016 * this.quiet, 3, 3);
  }
  bass(t, g = 1) { this.voice(mtof(this.chordNotes()[0] - 24), t, 2.2, 'sine', 0.05 * g, 0.04); }
  pluck(t) {
    const sc = this.key.scale, oct = this.rand(t * 3) < 0.3 ? 24 : 12;
    const m = this.key.root + oct + sc[Math.floor(this.rand(t * 7) * sc.length)];
    const f = mtof(m), dur = 1.8;
    // a soft bell-piano: fundamental + two decaying partials
    for (const [mul, g] of [[1, 0.045], [2, 0.012], [3.01, 0.006]]) {
      const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur / mul);
      o.connect(gn); gn.connect(this.send); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  swell(t) {
    const n = this.ctx.createBufferSource(), sr = this.ctx.sampleRate, b = this.ctx.createBuffer(1, sr, sr), d = b.getChannelData(0);
    for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + 400 * this.tide; f.Q.value = 0.7;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * this.tide, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 1.9);
    n.connect(f); f.connect(g); g.connect(this.send); n.start(t); n.stop(t + 2);
    this.voice(mtof(this.chordNotes()[0] - 12), t, 2.2, 'triangle', 0.02 * this.tide, 0.9);
  }
}
