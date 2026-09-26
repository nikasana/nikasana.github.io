'use strict';
// ---------- Zone radio: endless procedurally composed stations ----------
// Every song is built from a seed (key, scale, tempo, progression, structure, motif, title),
// and each station walks through its own seed sequence, so a station never runs out of music.
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], pentaMin: [0, 3, 5, 7, 10], mixo: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
};
const STATIONS = [
  { id: 'score', name: 'Dynamic Score', icon: '🎼', desc: 'Adaptive soundtrack that follows the stage, danger and bosses' },
  { id: 'zonefm', name: 'Zone FM', icon: '🔥', desc: 'Campfire guitar', bpm: [68, 90], scales: ['minor', 'harmonic', 'dorian'], lead: 'guitar', chords: 'strum', bass: 'soft', drums: null, dens: 0.55 },
  { id: 'waves', name: 'Anomaly Waves', icon: '🌌', desc: 'Dark ambient drones', bpm: [48, 62], scales: ['phrygian', 'minor', 'lydian'], lead: 'bell', chords: 'pad', bass: 'drone', drums: null, dens: 0.22 },
  { id: 'rostok', name: 'Rostok Industrial', icon: '⚙️', desc: 'Industrial techno', bpm: [118, 132], scales: ['phrygian', 'minor'], lead: 'saw', chords: 'stab', bass: 'acid', drums: 'techno', dens: 0.45 },
  { id: 'pripyat', name: 'Pripyat Nights', icon: '🌆', desc: 'Synthwave', bpm: [94, 112], scales: ['minor', 'dorian'], lead: 'square', chords: 'pad', bass: 'octave', drums: 'synth', dens: 0.6 },
  { id: 'piano', name: 'Chernobyl Piano', icon: '🎹', desc: 'Melancholic piano', bpm: [58, 80], scales: ['minor', 'major', 'harmonic'], lead: 'piano', chords: 'piano', bass: 'piano', drums: null, dens: 0.5 },
  { id: 'chip', name: '8-Bit Bandit', icon: '🕹️', desc: 'Chiptune', bpm: [126, 150], scales: ['major', 'minor', 'mixo'], lead: 'chip', chords: 'arp', bass: 'chip', drums: 'chip', dens: 0.75 },
  { id: 'folk', name: 'Cordon Folk', icon: '🪕', desc: 'Accordion & balalaika', bpm: [100, 128], scales: ['harmonic', 'minor', 'major'], lead: 'accordion', chords: 'oompah', bass: 'oompah', drums: 'folk', dens: 0.7 },
  { id: 'jazz', name: 'Bar 100 Rads', icon: '🎷', desc: 'Smoky bar jazz', bpm: [78, 100], scales: ['dorian', 'mixo'], lead: 'sax', chords: 'jazz', bass: 'walking', drums: 'brush', dens: 0.55, swing: 0.33, sev: true },
  { id: 'choir', name: 'Monolith Choir', icon: '💠', desc: 'Ritual choir', bpm: [54, 70], scales: ['phrygian', 'harmonic'], lead: 'choir', chords: 'choir', bass: 'drone', drums: 'ritual', dens: 0.35 },
  { id: 'rock', name: 'Freedom Rock', icon: '🎸', desc: 'Garage rock', bpm: [120, 146], scales: ['pentaMin', 'minor', 'mixo'], lead: 'dist', chords: 'power', bass: 'rock', drums: 'rock', dens: 0.65 },
  { id: 'lofi', name: 'Loner Lo-Fi', icon: '📼', desc: 'Lo-fi beats', bpm: [70, 86], scales: ['dorian', 'major'], lead: 'epiano', chords: 'epiano', bass: 'soft', drums: 'lofi', dens: 0.45, swing: 0.2, sev: true },
  { id: 'off', name: 'Radio Off', icon: '🔇', desc: 'Silence. Just the Zone.' },
];
const TITLE_A = ['Rusty', 'Silent', 'Burning', 'Distant', 'Cold', 'Last', 'Hidden', 'Green', 'Red', 'Hollow', 'Broken', 'Quiet', 'Golden', 'Lonely', 'Frozen', 'Electric', 'Forgotten', 'Wild'];
const TITLE_N = ['Cordon', 'Emission', 'Campfire', 'Artifact', 'Bolt', 'Vodka', 'Anomaly', 'Stalker', 'Pripyat', 'Monolith', 'Swamp', 'Dawn', 'Night', 'Radar', 'Bunker', 'Detector', 'Road', 'Rain', 'Heart', 'Zone'];

const FM = {
  st: 0, song: null, step: 0, nextT: 0, timer: null, on: false, idx: {}, changeT: 0,
  cur() { return STATIONS[this.st]; },
  init() {
    const s = Save.data.radio || {};
    this.idx = s.idx || {};
    const i = STATIONS.findIndex((x) => x.id === s.station);
    this.st = i >= 0 ? i : 0;
  },
  persist() { Save.data.radio = { station: this.cur().id, idx: this.idx }; Save.save(); },
  start() {
    if (this.on || !Sfx.ctx) return;
    this.on = true; this.nextT = Sfx.ctx.currentTime + 0.3; Music.nextT = this.nextT;
    this.timer = setInterval(() => this.tick(), 60);
    this.newSong(false);
  },
  tune(d) {
    this.st = (this.st + d + STATIONS.length) % STATIONS.length;
    this.persist();
    if (Sfx.ctx) { Sfx.noise(0.35, 0.12, 2500, 'bandpass', 0, Sfx.voice); this.nextT = Sfx.ctx.currentTime + 0.35; Music.nextT = Sfx.ctx.currentTime + 0.35; }
    this.newSong(false);
    radioUI();
  },
  set(id) { const i = STATIONS.findIndex((x) => x.id === id); if (i >= 0) { this.st = i; this.tune(0); } },
  skip() { if (this.cur().gen === false) return; this.newSong(true); radioUI(); },
  newSong(adv) {
    const S = this.cur();
    this.step = 0;
    if (!S.bpm) { this.song = null; return; }
    const n = (this.idx[S.id] || 0) + (adv ? 1 : 0);
    this.idx[S.id] = n;
    if (adv) this.persist();
    const R = mulberry32(hashStr(S.id) * 7919 + n * 104729 + 17);
    const scale = SCALES[S.scales[Math.floor(R() * S.scales.length)]];
    const degs = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 5, 2, 4], [0, 6, 5, 4], [0, 2, 5, 4], [0, 3, 6, 4], [5, 3, 0, 4], [0, 4, 5, 3]][Math.floor(R() * 8)];
    const prog = R() < 0.5 ? degs : [...degs, ...[[0, 5, 3, 4], [3, 4, 0, 0], [5, 6, 4, 4], [2, 5, 1, 4]][Math.floor(R() * 4)]];
    const forms = [['i', 'A', 'A', 'B', 'A', 'B', 'C', 'A', 'o'], ['i', 'A', 'B', 'A', 'B', 'C', 'B', 'o'], ['i', 'A', 'A', 'B', 'B', 'A', 'C', 'C', 'A', 'o'], ['A', 'B', 'A', 'C', 'A', 'B', 'o']];
    const form = forms[Math.floor(R() * forms.length)];
    const motif = [];
    for (let i = 0; i < 16; i++) motif.push(R() < S.dens ? Math.floor(R() * 7) - 1 + (i % 4 === 0 ? 2 : 0) : null);
    const motifB = motif.map((m) => (m === null ? (R() < 0.3 ? Math.floor(R() * 5) : null) : m + (R() < 0.5 ? 2 : -1)));
    const title = R() < 0.5 ? `${TITLE_A[Math.floor(R() * TITLE_A.length)]} ${TITLE_N[Math.floor(R() * TITLE_N.length)]}` :
      R() < 0.5 ? `${TITLE_N[Math.floor(R() * TITLE_N.length)]} Blues` : `Song of the ${TITLE_N[Math.floor(R() * TITLE_N.length)]}`;
    this.song = { R, n, bpm: Math.round(lerp(S.bpm[0], S.bpm[1], R())), root: 40 + Math.floor(R() * 10), scale, prog, form, motif, motifB, title,
      bassPat: Math.floor(R() * 4), drumVar: Math.floor(R() * 3), barsPer: 8 };
    this.changeT = 3;
  },
  hz: (m) => 440 * Math.pow(2, (m - 69) / 12),
  note(song, deg, oct = 0) {
    const sc = song.scale, l = sc.length, o = Math.floor(deg / l), d = ((deg % l) + l) % l;
    return song.root + 12 + sc[d] + (o + oct) * 12;
  },
  tick() {
    const c = Sfx.ctx; if (!c || c.state !== 'running') return;
    const S = this.cur();
    if (S.id === 'score') { Music.tick(); return; }
    if (!this.song) { this.nextT = c.currentTime + 0.2; return; }
    const sp = 60 / this.song.bpm / 4;
    while (this.nextT < c.currentTime + 0.25) {
      const sw = S.swing && this.step % 2 === 1 ? sp * S.swing : 0;
      this.play(S, this.song, this.step, this.nextT - c.currentTime + sw, sp);
      this.nextT += sp; this.step++;
      const total = this.song.form.length * this.song.barsPer * 16;
      if (this.step >= total) { this.newSong(true); radioUI(); if (!this.song) break; }
    }
  },
  play(S, song, s, d, sp) {
    const out = Sfx.mus, bar = Math.floor(s / 16), pos = s % 16, sec = song.form[Math.floor(bar / song.barsPer)] || 'o';
    const chordDeg = song.prog[Math.floor(bar / 2) % song.prog.length] + (sec === 'C' ? 3 : 0);
    const full = sec === 'B' || sec === 'C', intro = sec === 'i' || sec === 'o';
    const tri = [0, 2, 4].concat(S.sev ? [6] : []).map((k) => this.note(song, chordDeg + k));
    const I = Inst;
    // chords
    const ch = S.chords;
    if (ch === 'strum' && (pos === 0 || (pos === 8 && !intro) || (full && pos === 12))) tri.forEach((m, i) => I.guitar(this.hz(m), d + i * 0.03, sp * 10, 0.05, out));
    if (ch === 'pad' && pos === 0 && bar % 2 === 0) tri.forEach((m) => I.pad(this.hz(m - 12), d, sp * 32, 0.03, out));
    if (ch === 'stab' && !intro && (pos === 6 || pos === 14) && song.R() < 0.7) tri.forEach((m) => I.saw(this.hz(m), d, sp * 1.5, 0.03, out, 2000));
    if (ch === 'piano' && (pos === 0 || pos === 8)) tri.forEach((m, i) => I.piano(this.hz(m - 12), d + i * 0.01, sp * 7, 0.05, out));
    if (ch === 'arp' && !intro && pos % 2 === 0) I.chip(this.hz(tri[(pos / 2) % tri.length] + 12), d, sp * 1.6, 0.025, out, 'square');
    if (ch === 'oompah' && (pos === 4 || pos === 12)) tri.forEach((m) => I.accordion(this.hz(m), d, sp * 2.5, 0.025, out));
    if (ch === 'jazz' && (pos === 0 || pos === 6 || (pos === 10 && song.R() < 0.5))) tri.forEach((m) => I.epiano(this.hz(m), d, sp * 4, 0.035, out));
    if (ch === 'choir' && pos === 0 && bar % 2 === 0) tri.forEach((m) => I.choir(this.hz(m), d, sp * 32, 0.03, out));
    if (ch === 'power' && !intro && pos % 4 === 0) [tri[0], tri[0] + 7].forEach((m) => I.dist(this.hz(m - 12), d, sp * 3.5, 0.035, out));
    if (ch === 'epiano' && (pos === 0 || pos === 10)) tri.forEach((m) => I.epiano(this.hz(m), d, sp * 8, 0.035, out));
    // bass
    const root = this.note(song, chordDeg) - 24, B = S.bass;
    if (B === 'drone' && pos === 0 && bar % 4 === 0) I.drone(this.hz(root), d, sp * 64, 0.08, out);
    if (B === 'soft' && (pos === 0 || (pos === 8 && song.bassPat > 1))) I.bass(this.hz(root), d, sp * 7, 0.14, out);
    if (B === 'acid' && !intro && pos % 2 === 0 && (song.bassPat + pos) % 3 !== 0) I.acid(this.hz(root + (pos % 8 === 6 ? 12 : 0)), d, sp * 1.8, 0.07, out);
    if (B === 'octave' && !intro && pos % 2 === 0) I.bass(this.hz(root + (pos % 4 === 2 ? 12 : 0)), d, sp * 1.8, 0.1, out, 'sawtooth');
    if (B === 'piano' && pos === 0) I.piano(this.hz(root + 12), d, sp * 14, 0.06, out);
    if (B === 'chip' && pos % 4 === 0) I.chip(this.hz(root + 12), d, sp * 3, 0.04, out, 'triangle');
    if (B === 'oompah' && (pos === 0 || pos === 8)) I.bass(this.hz(root + (pos === 8 ? 7 : 0)), d, sp * 3, 0.12, out);
    if (B === 'walking' && pos % 4 === 0) I.bass(this.hz(this.note(song, chordDeg + [0, 2, 4, 5][pos / 4]) - 24), d, sp * 3.5, 0.13, out);
    if (B === 'rock' && !intro && pos % 2 === 0) I.bass(this.hz(root), d, sp * 1.8, 0.12, out, 'sawtooth');
    // lead melody from the section motif
    if (!intro || sec === 'o') {
      const m = (sec === 'B' ? song.motifB : song.motif)[pos];
      const play = m !== null && (sec !== 'A' || bar % 2 === 0 || song.R() < 0.6);
      if (play) {
        const deg = chordDeg + m + (sec === 'C' ? 2 : 0), f = this.hz(this.note(song, deg, S.lead === 'bell' || S.lead === 'chip' ? 1 : 0));
        const L = S.lead, dur = sp * (S.dens < 0.4 ? 6 : 2.5);
        if (L === 'guitar') I.guitar(f, d, dur * 1.5, 0.05, out);
        else if (L === 'bell') I.bell(f, d, sp * 10, 0.035, out);
        else if (L === 'saw') I.saw(f, d, dur, 0.03, out, 1600);
        else if (L === 'square') I.chip(f, d, dur, 0.022, out, 'square', true);
        else if (L === 'piano') I.piano(f * 2, d, dur * 2, 0.05, out);
        else if (L === 'chip') I.chip(f, d, sp * 1.8, 0.025, out, 'square');
        else if (L === 'accordion') I.accordion(f * 2, d, dur, 0.03, out);
        else if (L === 'sax') I.sax(f, d, dur * 1.3, 0.04, out);
        else if (L === 'choir') I.choir(f * 2, d, sp * 8, 0.022, out);
        else if (L === 'dist') I.dist(f, d, dur, 0.03, out);
        else if (L === 'epiano') I.epiano(f * 2, d, dur * 1.5, 0.03, out);
      }
    }
    // drums
    const K = S.drums;
    if (!K || (intro && sec === 'i' && bar % song.barsPer < 4)) return;
    const hard = full;
    if (K === 'techno') { if (pos % 4 === 0) I.kick(d, out, 0.5); if (pos % 4 === 2) I.hat(d, out, 0.05); if (pos === 4 || pos === 12) I.clap(d, out, 0.12); if (hard && pos % 2 === 1) I.hat(d, out, 0.02); }
    if (K === 'synth') { if (pos === 0 || pos === 8) I.kick(d, out, 0.45); if (pos === 4 || pos === 12) I.snare(d, out, 0.14, 0.25); if (pos % 2 === 0) I.hat(d, out, 0.03); }
    if (K === 'chip') { if (pos === 0 || pos === 8 || (hard && pos === 10)) I.kick(d, out, 0.3, 150); if (pos === 4 || pos === 12) I.snare(d, out, 0.08, 0.06); if (pos % 2 === 0) I.hat(d, out, 0.015); }
    if (K === 'folk') { if (pos === 0 || pos === 8) I.kick(d, out, 0.35); if (pos === 4 || pos === 12) I.snare(d, out, 0.08, 0.08); }
    if (K === 'brush') { if (pos === 0 || pos === 10) I.kick(d, out, 0.2); if (pos % 4 === 2) I.brush(d, out, 0.04); if (pos === 4 || pos === 12) I.snare(d, out, 0.05, 0.15); }
    if (K === 'ritual') { if (pos === 0 || (pos === 6 && hard) || pos === 10) I.tom(d, out, 0.3, 70); if (pos === 12 && song.R() < 0.4) I.tom(d, out, 0.2, 110); }
    if (K === 'rock') { if (pos === 0 || pos === 8 || (hard && pos === 10)) I.kick(d, out, 0.45); if (pos === 4 || pos === 12) I.snare(d, out, 0.18, 0.2); if (pos % 2 === 0) I.hat(d, out, 0.04); if (pos === 0 && bar % song.barsPer === 0) I.crash(d, out); }
    if (K === 'lofi') { if (pos === 0 || pos === 7 || pos === 10) I.kick(d, out, 0.3, 90); if (pos === 4 || pos === 12) I.snare(d, out, 0.07, 0.2); if (pos % 2 === 0) I.hat(d, out, 0.018); if (pos === 0) I.crackle(d, out); }
  },
};
function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

// ---------- synth voices ----------
const Inst = {
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  osc(type, f, t, dur, out, peak, a = 0.005, filt) {
    const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    this.env(g, t, a, peak, dur);
    if (filt) { o.connect(filt); filt.connect(g); } else o.connect(g);
    g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  },
  T(d) { return Sfx.ctx.currentTime + Math.max(0, d); },
  guitar(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 8, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * 0.5);
    this.osc('sawtooth', f, t, dur, out, v, 0.003, fl); this.osc('triangle', f * 1.003, t, dur, out, v * 0.6);
  },
  pad(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const det of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
    fl.connect(g); g.connect(out);
  },
  saw(f, d, dur, v, out, cut) { const c = Sfx.ctx, fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; fl.Q.value = 4; this.osc('sawtooth', f, this.T(d), dur, out, v, 0.005, fl); },
  piano(f, d, dur, v, out) { const t = this.T(d); this.osc('triangle', f, t, dur, out, v, 0.002); this.osc('sine', f * 2, t, dur * 0.5, out, v * 0.4, 0.002); this.osc('sine', f * 3, t, dur * 0.2, out, v * 0.15, 0.002); },
  chip(f, d, dur, v, out, type, vib) { const o = this.osc(type, f, this.T(d), dur, out, v, 0.002); if (vib) { const c = Sfx.ctx, l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = f * 0.01; l.connect(lg); lg.connect(o.frequency); l.start(this.T(d)); l.stop(this.T(d) + dur); } },
  accordion(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 3; fl.Q.value = 1;
    const o = this.osc('sawtooth', f, t, dur, out, v, 0.03, fl); this.osc('square', f * 1.005, t, dur, out, v * 0.4, 0.03);
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
  },
  sax(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(f * 2, t); fl.frequency.linearRampToValueAtTime(f * 4, t + dur * 0.4);
    const o = this.osc('sawtooth', f, t, dur, out, v, 0.04, fl);
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = f * 0.008; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
  },
  choir(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d), g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(out);
    for (const fm of [700, 1150]) { const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = fm; fl.Q.value = 5; fl.connect(g);
      for (const det of [-9, 0, 9]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); } }
  },
  dist(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d);
    if (!this.curve) { const n = 256; this.curve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; this.curve[i] = Math.tanh(x * 6); } }
    const ws = c.createWaveShaper(); ws.curve = this.curve; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; this.env(g, t, 0.005, v, dur);
    o.connect(ws); ws.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  },
  epiano(f, d, dur, v, out) { const t = this.T(d); this.osc('sine', f, t, dur, out, v, 0.005); this.osc('sine', f * 2.01, t, dur * 0.4, out, v * 0.3, 0.003); },
  bell(f, d, dur, v, out) {
    const c = Sfx.ctx, t = this.T(d), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
    mod.connect(mg); mg.connect(car.frequency); this.env(g, t, 0.003, v, dur); car.connect(g); g.connect(out);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  },
  bass(f, d, dur, v, out, type = 'triangle') { const c = Sfx.ctx, fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; this.osc(type, f, this.T(d), dur, out, v, 0.005, fl); },
  drone(f, d, dur, v, out) { const t = this.T(d), c = Sfx.ctx, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(out); for (const m of [1, 1.5, 2.002]) { const o = c.createOscillator(); o.frequency.value = f * m; o.connect(g); o.start(t); o.stop(t + dur + 0.05); } },
  acid(f, d, dur, v, out) { const c = Sfx.ctx, t = this.T(d), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 12; fl.frequency.setValueAtTime(f * 12, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur); this.osc('sawtooth', f, t, dur, out, v, 0.003, fl); },
  noise(d, out, v, dur, freq, type) { Sfx.noise(dur, v, freq, type, Math.max(0, d), out); },
  kick(d, out, v, f0 = 120) { Sfx.tone(f0, 0.22, 'sine', v, -f0 + 40, Math.max(0, d), out); },
  snare(d, out, v, dur) { this.noise(d, out, v, dur, 1800, 'bandpass'); Sfx.tone(190, 0.08, 'triangle', v * 0.5, -60, Math.max(0, d), out); },
  clap(d, out, v) { for (let i = 0; i < 3; i++) this.noise(d + i * 0.012, out, v, 0.08, 1500, 'bandpass'); },
  hat(d, out, v) { this.noise(d, out, v, 0.04, 8000, 'highpass'); },
  brush(d, out, v) { this.noise(d, out, v, 0.18, 3000, 'bandpass'); },
  tom(d, out, v, f) { Sfx.tone(f, 0.5, 'sine', v, -f * 0.4, Math.max(0, d), out); this.noise(d, out, v * 0.3, 0.2, 400, 'lowpass'); },
  crash(d, out) { this.noise(d, out, 0.08, 1.4, 6000, 'highpass'); },
  crackle(d, out) { for (let i = 0; i < 6; i++) this.noise(d + Math.random() * 0.5, out, 0.03, 0.01, 5000, 'highpass'); },
};

// ---------- radio UI (HUD chip + station panel) ----------
function radioUI() {
  const S = FM.cur(), song = FM.song;
  const txt = S.id === 'score' ? `${S.icon} ${S.name}` : S.id === 'off' ? '🔇 Radio off' : `${S.icon} ${S.name} · “${song ? song.title : ''}”`;
  for (const el of document.querySelectorAll('.nowPlaying')) el.textContent = txt;
  const list = document.getElementById('stationList');
  if (list && list.offsetParent) buildStations();
}
function buildStations() {
  const list = document.getElementById('stationList'); if (!list) return;
  list.innerHTML = STATIONS.map((s, i) => `<button class="pick ${i === FM.st ? 'sel' : ''}" data-st="${i}"><div class="pi">${s.icon}</div><div><b>${s.name}</b><small>${s.desc}</small>${s.bpm ? `<em>song #${(FM.idx[s.id] || 0) + 1} · endless</em>` : ''}</div></button>`).join('');
  for (const b of list.querySelectorAll('[data-st]')) b.onclick = () => { Sfx.init(); FM.st = +b.dataset.st; FM.tune(0); buildStations(); };
}
