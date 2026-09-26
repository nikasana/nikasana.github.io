'use strict';
// ---------- location ambience: swamp life, factory clanks, night howls, campfire guitar, lab hum ----------
const Amb = {
  t: { frog: 2, insect: 1, clank: 4, howl: 20, guitar: 0, drip: 3, crow: 12 }, gStep: 0,
  update(dt) {
    if (!Sfx.ctx || Sfx.muted || !G || G.title) return;
    const T = this.t, out = Sfx.amb, lab = World.kind === 'lab';
    for (const k in T) T[k] -= dt;
    const reg = World.region(P.x, P.y), night = Env.isNight();
    if (!lab && (reg.water || reg.reeds)) {
      if (T.frog <= 0) { T.frog = rand(0.6, 2.2); const f = rand(140, 230); for (let i = 0; i < randi(2, 4); i++) Sfx.tone(f, 0.07, 'sine', 0.05, -60, i * 0.11, out); }
      if (T.insect <= 0) { T.insect = rand(0.3, 1.2); Sfx.noise(rand(0.1, 0.3), 0.012, rand(5000, 7500), 'bandpass', 0, out); }
    }
    if (!lab && reg.cracks && T.clank <= 0) { T.clank = rand(3, 7); Inst.bell(rand(90, 180), 0, 1.4, 0.03, out); Sfx.noise(0.15, 0.03, 900, 'bandpass', 0, out); }
    if (!lab && night && T.howl <= 0) {
      T.howl = rand(16, 34);
      const c = Sfx.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900; o.type = 'triangle';
      o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(640, t + 0.6); o.frequency.linearRampToValueAtTime(520, t + 2.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 2.4);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 2.5);
    }
    if (!lab && !night && T.crow <= 0) { T.crow = rand(10, 25); for (let i = 0; i < 2; i++) Sfx.noise(0.14, 0.03, 1600, 'bandpass', i * 0.22, out); }
    if (lab) {
      if (T.drip <= 0) { T.drip = rand(1, 3); Sfx.tone(rand(900, 1400), 0.06, 'sine', 0.03, -500, 0, out); }
      if (T.clank <= 0) { T.clank = 6; Sfx.tone(60, 5.8, 'sawtooth', 0.006, 0, 0, out); }
    }
    // campfire guitar: near a campfire or inside a quiet shelter
    let calm = false;
    if (!lab && G.enemies.length < 40) {
      for (const s of World.shelters) if (dist2(s.x, s.y, P.x, P.y) < 130 * 130) { calm = true; break; }
      if (!calm) for (const p of World.pois) if (p.type === 'camp' && dist2(p.x, p.y, P.x, P.y) < 260 * 260) { calm = true; break; }
      if (calm) { EG.query(P.x, P.y, 420, TMP3); if (TMP3.some((e) => !e.dead)) calm = false; }
    }
    this.calm = calm;
    if (calm && T.guitar <= 0) {
      T.guitar = 0.42;
      const prog = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], ch = prog[Math.floor(this.gStep / 8) % 4];
      const m = ch[[0, 1, 2, 1, 0, 2, 1, 2][this.gStep % 8]] - 12;
      Inst.guitar(FM.hz(m), 0, 1.6, 0.035, out);
      if (this.gStep % 8 === 0) Sfx.noise(0.4, 0.015, 1200, 'bandpass', 0, out);
      this.gStep++;
    }
  },
};
