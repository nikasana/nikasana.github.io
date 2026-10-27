// Synthesised sound effects. Every play is varied in pitch and timing so nothing repeats exactly.

const R = Math.random;
const vary = (x, k = 0.08) => x * (1 + (R() * 2 - 1) * k);

export class Sfx {
  constructor(engine) {
    this.e = engine;
    this.loops = {};
    this.lastPlay = {};
  }

  get ok() { return this.e.ready; }

  noiseSrc(t, dur, rate = 1) {
    const s = this.e.ctx.createBufferSource();
    s.buffer = this.e.noise;
    s.playbackRate.value = rate;
    s.start(t, R() * 1.5, dur + 0.05);
    return s;
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  burst(out, t, f, q, peak, dur, type = 'bandpass') {
    const ctx = this.e.ctx;
    const n = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = type; bp.frequency.value = f; bp.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.002, peak, dur);
    n.connect(bp).connect(g).connect(out);
  }

  tone(out, t, f, type, peak, a, d, f2) {
    const ctx = this.e.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = ctx.createGain();
    this.env(g, t, a, peak, d);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  throttle(name, ms) {
    const now = performance.now();
    if (now - (this.lastPlay[name] || 0) < ms) return true;
    this.lastPlay[name] = now;
    return false;
  }

  play(name, opt = {}) {
    if (!this.ok) return;
    const fn = this[`s_${name}`];
    if (!fn) return;
    const t = this.e.now() + (opt.delay || 0) + R() * 0.008;
    fn.call(this, t, opt);
  }

  // --- one-shots ---

  // water: a wet slap with a short spray of droplets
  s_splash(t, o) {
    const out = this.e.out('sfx', o.pos, 0.25);
    out.gain.value = (o.gain ?? 1) * 0.8;
    this.burst(out, t, vary(700, 0.2), 0.8, 0.6, 0.12, 'lowpass');
    this.burst(out, t + 0.01, vary(2400, 0.3), 1.2, 0.3, 0.09);
    for (let i = 0; i < 5; i++) this.burst(out, t + 0.04 + i * vary(0.03, 0.5), vary(3600, 0.4), 4, 0.12, 0.025);
  }

  s_chip(t, o) {
    const out = this.e.out('sfx', o.pos, 0.3);
    out.gain.value = (o.gain ?? 1) * 0.9;
    const p = o.pitch ?? 1;
    this.burst(out, t, vary(2600 * p, 0.2), 1.6, 0.7, 0.07);
    this.tone(out, t, vary(1900 * p, 0.15), 'triangle', 0.25, 0.001, 0.05, 900 * p);
    for (let i = 0; i < 4; i++) this.burst(out, t + 0.012 + i * vary(0.018, 0.5), vary(4200 * p, 0.3), 3, 0.25, 0.03);
  }

  s_crack(t, o) {
    const out = this.e.out('sfx', o.pos, 0.45);
    out.gain.value = (o.gain ?? 1);
    this.burst(out, t, vary(900, 0.2), 0.9, 0.8, 0.16, 'highpass');
    this.tone(out, t, vary(320, 0.15), 'sine', 0.5, 0.002, 0.22, 110);
    for (let i = 0; i < 3; i++) this.burst(out, t + 0.03 + i * 0.025, vary(5200, 0.3), 4, 0.2, 0.05);
  }

  s_shatter(t, o) {
    const out = this.e.out('sfx', o.pos, 0.5);
    out.gain.value = (o.gain ?? 1);
    this.burst(out, t, 1400, 0.7, 0.9, 0.3, 'highpass');
    for (let i = 0; i < 9; i++) {
      const tt = t + R() * 0.25;
      this.tone(out, tt, vary(4200, 0.35), 'sine', 0.12, 0.001, vary(0.12, 0.5));
      this.burst(out, tt, vary(6000, 0.3), 5, 0.18, 0.04);
    }
  }

  s_whiff(t, o) {
    const out = this.e.out('sfx', null, 0.05);
    out.gain.value = 0.25;
    const ctx = this.e.ctx;
    const n = this.noiseSrc(t, 0.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 0.15);
    const g = ctx.createGain(); this.env(g, t, 0.04, 0.6, 0.15);
    n.connect(bp).connect(g).connect(out);
  }

  s_drip(t, o) {
    const out = this.e.out('sfx', o.pos, 0.6);
    out.gain.value = 0.35 * (o.gain ?? 1);
    const f = vary(1700, 0.35);
    this.tone(out, t, f, 'sine', 0.6, 0.001, 0.09, f * 0.55);
  }

  s_creak(t, o) {
    const out = this.e.out('sfx', o.pos, 0.6);
    out.gain.value = 0.5;
    const ctx = this.e.ctx;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(vary(70, 0.3), t);
    osc.frequency.linearRampToValueAtTime(vary(55, 0.3), t + 1.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = vary(900, 0.3); bp.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = 0;
    // granular amplitude: stick-slip pulses
    let tt = t;
    for (let i = 0; i < 26; i++) { g.gain.setValueAtTime(R() * 0.5, tt); tt += vary(0.045, 0.6); }
    g.gain.setValueAtTime(0, tt);
    osc.connect(bp).connect(g).connect(out);
    osc.start(t); osc.stop(tt + 0.05);
  }

  // coins: inharmonic FM with tier-specific brightness and ring
  s_clink(t, o) {
    if (this.throttle('clink', 28)) return;
    const out = this.e.out('sfx', o.pos, 0.25);
    const tier = o.tier || 0;
    out.gain.value = 0.32 * (o.gain ?? 1);
    const ctx = this.e.ctx;
    const base = [2350, 3300, 2750][tier] * vary(1, 0.06);
    const dur = [0.18, 0.4, 0.55][tier];
    for (const [ratio, amp] of [[1, 1], [2.76, 0.45], [5.4, 0.2]]) {
      const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = base * ratio;
      const m = ctx.createOscillator(); m.type = 'sine'; m.frequency.value = base * ratio * 1.41;
      const mg = ctx.createGain(); mg.gain.setValueAtTime(base * 0.8, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
      m.connect(mg).connect(c.frequency);
      const g = ctx.createGain(); this.env(g, t, 0.001, amp * 0.4, dur / ratio * 1.5);
      c.connect(g).connect(out);
      c.start(t); m.start(t); c.stop(t + dur + 0.1); m.stop(t + dur + 0.1);
    }
  }

  s_bank(t, o) {
    const out = this.e.out('sfx', o.pos, 0.35);
    out.gain.value = 0.5;
    const ctx = this.e.ctx;
    const n = this.noiseSrc(t, 0.6);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
    const g = ctx.createGain(); this.env(g, t, 0.08, 0.35, 0.5);
    n.connect(bp).connect(g).connect(out);
    const n2 = Math.min(10, 3 + (o.count || 3));
    for (let i = 0; i < n2; i++) this.s_clinkRaw(out, t + 0.05 + i * vary(0.045, 0.4), o.tier ?? 0);
  }

  s_clinkRaw(out, t, tier) {
    const base = [2350, 3300, 2750][tier] * vary(1, 0.1);
    this.tone(out, t, base, 'sine', 0.12, 0.001, 0.12);
    this.tone(out, t, base * 2.76, 'sine', 0.05, 0.001, 0.06);
  }

  s_pile(t, o) {
    const out = this.e.out('sfx', o.pos, 0.3);
    out.gain.value = 0.25;
    this.burst(out, t, 3000, 0.8, 0.25, 0.5);
    for (let i = 0; i < 8; i++) this.s_clinkRaw(out, t + R() * 0.5, (R() * 3) | 0);
  }

  s_step(t, o) {
    const out = this.e.out('sfx', null, 0.1);
    out.gain.value = 0.22;
    if (o.ice) {
      this.tone(out, t, vary(900, 0.1), 'triangle', 0.25, 0.001, 0.035);
      this.burst(out, t, vary(3500, 0.2), 2, 0.25, 0.04);
    } else {
      // snow crunch: a few grainy bursts
      for (let i = 0; i < 3; i++) this.burst(out, t + i * vary(0.022, 0.4), vary(1300, 0.3), 0.8, 0.35, 0.05, 'lowpass');
    }
  }

  s_land(t) {
    const out = this.e.out('sfx', null, 0.15);
    out.gain.value = 0.4;
    this.burst(out, t, 500, 0.7, 0.8, 0.18, 'lowpass');
  }

  s_click(t) {
    const out = this.e.out('sfx', null, 0);
    out.gain.value = 0.18;
    this.tone(out, t, 1500, 'sine', 0.5, 0.001, 0.02);
  }

  s_hover(t) {
    const out = this.e.out('sfx', null, 0);
    out.gain.value = 0.06;
    this.tone(out, t, 2400, 'sine', 0.4, 0.001, 0.015);
  }

  s_buy(t, o) {
    const out = this.e.out('sfx', null, 0.35);
    out.gain.value = 0.32;
    const base = 660 * Math.pow(2, ((o.step || 0) % 5) / 12);
    for (const [i, r] of [[0, 1], [1, 1.25], [2, 1.5], [3, 2]]) {
      this.tone(out, t + i * 0.055, base * r, 'sine', 0.45, 0.003, 0.5);
      this.tone(out, t + i * 0.055, base * r * 3.01, 'sine', 0.06, 0.002, 0.2);
    }
  }

  s_deny(t) {
    const out = this.e.out('sfx', null, 0);
    out.gain.value = 0.15;
    this.tone(out, t, 220, 'triangle', 0.4, 0.002, 0.09);
    this.tone(out, t + 0.07, 196, 'triangle', 0.4, 0.002, 0.12);
  }

  s_open(t) {
    const out = this.e.out('sfx', null, 0.2);
    out.gain.value = 0.18;
    const ctx = this.e.ctx;
    const n = this.noiseSrc(t, 0.3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    const g = ctx.createGain(); this.env(g, t, 0.05, 0.4, 0.25);
    n.connect(bp).connect(g).connect(out);
  }

  s_capsule(t, o) {
    const out = this.e.out('sfx', o.pos, 0.6);
    out.gain.value = 0.5;
    this.tone(out, t, 180, 'sawtooth', 0.15, 0.01, 0.4, 90);
    this.burst(out, t, 2000, 1, 0.4, 0.3);
    for (let i = 0; i < 5; i++) this.tone(out, t + 0.3 + i * 0.07, 880 * [1, 1.2, 1.5, 1.8, 2.4][i], 'sine', 0.2, 0.002, 0.6);
  }

  // --- loops (start/stop by key) ---

  loop(key, on, opt = {}) {
    if (!this.ok) return;
    const cur = this.loops[key];
    if (on && !cur) this.loops[key] = this[`l_${key}`](opt);
    else if (!on && cur) {
      const t = this.e.now();
      cur.out.gain.setTargetAtTime(0.0001, t, 0.08);
      for (const n of cur.nodes) try { n.stop(t + 0.5); } catch { /* already stopped */ }
      delete this.loops[key];
    }
    const l = this.loops[key];
    if (l && l.set) l.set(opt);
  }

  l_drill() {
    const ctx = this.e.ctx, t = this.e.now();
    const out = this.e.out('sfx', null, 0.15);
    out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(0.16, t, 0.05);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 190;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 382;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const lg = ctx.createGain(); lg.gain.value = 9;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.2;
    const n = ctx.createBufferSource(); n.buffer = this.e.noise; n.loop = true;
    const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 3000; nb.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    o1.connect(bp); o2.connect(bp); bp.connect(out); n.connect(nb).connect(ng).connect(out);
    for (const s of [o1, o2, lfo, n]) s.start(t);
    return { out, nodes: [o1, o2, lfo, n], set: (o) => { const k = o.load ? 0.82 : 1; o1.frequency.setTargetAtTime(190 * k, ctx.currentTime, 0.05); o2.frequency.setTargetAtTime(382 * k, ctx.currentTime, 0.05); ng.gain.setTargetAtTime(o.load ? 0.5 : 0.1, ctx.currentTime, 0.05); } };
  }

  l_torch(opt) {
    const ctx = this.e.ctx, t = this.e.now();
    const out = this.e.out('sfx', null, 0.15);
    out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(opt.lance ? 0.3 : 0.24, t, 0.06);
    const n = ctx.createBufferSource(); n.buffer = this.e.noise; n.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opt.lance ? 1400 : 850;
    const rum = ctx.createBiquadFilter(); rum.type = 'peaking'; rum.frequency.value = 120; rum.gain.value = 12;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7.5; const lg = ctx.createGain(); lg.gain.value = 0.25;
    const fl = ctx.createGain(); fl.gain.value = 0.8;
    lfo.connect(lg).connect(fl.gain);
    n.connect(lp).connect(rum).connect(fl).connect(out);
    // steam hiss rises when the flame hits ice
    const n2 = ctx.createBufferSource(); n2.buffer = this.e.noise; n2.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3800;
    const hg = ctx.createGain(); hg.gain.value = 0;
    n2.connect(hp).connect(hg).connect(out);
    n.start(t); n2.start(t, 0.7); lfo.start(t);
    return { out, nodes: [n, n2, lfo], set: (o) => hg.gain.setTargetAtTime(o.load ? 0.35 : 0, ctx.currentTime, 0.1) };
  }

  l_wind() {
    const ctx = this.e.ctx, t = this.e.now();
    const out = this.e.out('amb', null, 0.2);
    out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(0.5, t, 1.5);
    const n = ctx.createBufferSource(); n.buffer = this.e.noise; n.loop = true; n.playbackRate.value = 0.5;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.9;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 280;
    lfo.connect(lg).connect(bp.frequency);
    const g = ctx.createGain(); g.gain.value = 0.6;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = ctx.createGain(); lg2.gain.value = 0.35;
    lfo2.connect(lg2).connect(g.gain);
    n.connect(bp).connect(g).connect(out);
    n.start(t); lfo.start(t); lfo2.start(t);
    return { out, nodes: [n, lfo, lfo2], set: (o) => out.gain.setTargetAtTime(0.5 * (o.level ?? 1), ctx.currentTime, 0.8) };
  }

  l_hum() {
    // the beacon's low hum, near it only
    const ctx = this.e.ctx, t = this.e.now();
    const out = this.e.out('amb', null, 0.1);
    out.gain.value = 0;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 98;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 147.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o.connect(out); o2.connect(g2).connect(out);
    o.start(t); o2.start(t);
    return { out, nodes: [o, o2], set: (p) => out.gain.setTargetAtTime(0.07 * (p.level ?? 0), ctx.currentTime, 0.2) };
  }
}
