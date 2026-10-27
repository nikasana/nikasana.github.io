// Web Audio engine: buses (master, music, effects, ambience), depth-dependent reverb, positional sound.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.8, music: 0.55, sfx: 0.8, amb: 0.6 };
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.depth = 0;
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = {};
    for (const k of ['music', 'sfx', 'amb']) { this.bus[k] = ctx.createGain(); this.bus[k].connect(this.master); }
    // reverb: two convolvers crossfaded by crater depth (open air vs. deep shaft)
    this.revOpen = ctx.createConvolver(); this.revOpen.buffer = this.impulse(1.4, 3.2, 0.25);
    this.revDeep = ctx.createConvolver(); this.revDeep.buffer = this.impulse(4.5, 2.2, 0.5);
    this.revOpenG = ctx.createGain(); this.revDeepG = ctx.createGain();
    this.revSend = ctx.createGain();
    this.revSend.connect(this.revOpen).connect(this.revOpenG).connect(this.master);
    this.revSend.connect(this.revDeep).connect(this.revDeepG).connect(this.master);
    this.musicRev = ctx.createGain(); this.musicRev.gain.value = 0.35;
    this.musicRev.connect(this.revDeep);
    this.bus.music.connect(this.musicRev);
    this.noise = this.makeNoise(2);
    this.ready = true;
    this.applyVolumes();
    this.setDepth(this.depth);
  }

  impulse(seconds, decay, early) {
    const ctx = this.ctx, rate = ctx.sampleRate, n = Math.floor(seconds * rate);
    const b = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // early reflections then a smooth tail, slightly darker over time
        const er = i < rate * 0.08 && Math.random() < 0.004 ? early : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + er) * (1 - t * 0.3);
      }
    }
    return b;
  }

  makeNoise(seconds) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  applyVolumes() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.bus.music.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.bus.amb.gain.setTargetAtTime(this.vol.amb, t, 0.05);
  }

  setDepth(depth) {
    this.depth = depth;
    if (!this.ready) return;
    const k = Math.min(1, Math.max(0, depth / 60));
    const t = this.ctx.currentTime;
    this.revOpenG.gain.setTargetAtTime(0.18 * (1 - k), t, 0.5);
    this.revDeepG.gain.setTargetAtTime(0.42 * k, t, 0.5);
  }

  setListener(pos, fwd) {
    this.listenerPos = pos;
    if (!this.ready) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  // An output chain for one sound: optional panner, into a bus, with a reverb send.
  out(bus = 'sfx', pos = null, send = 0.25) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let head = g;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 1.5; p.rolloffFactor = 1.1; p.maxDistance = 80;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p);
      head = p;
    }
    head.connect(this.bus[bus]);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      head.connect(s).connect(this.revSend);
    }
    return g;
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }
}
