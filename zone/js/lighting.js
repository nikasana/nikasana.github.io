'use strict';
// ---------- environment: day/night cycle, weather, dynamic lighting ----------
const WEATHER = {
  clear: { name: 'Clear', icon: '☀️' },
  rain: { name: 'Rain', icon: '🌧️', desc: 'Electro anomalies grow stronger.' },
  fog: { name: 'Fog', icon: '🌫️', desc: 'Visibility drops.' },
  storm: { name: 'Thunderstorm', icon: '⛈️', desc: 'Lightning strikes the ground. Watch for red circles!' },
  psi: { name: 'Psi-Storm', icon: '🌀', desc: 'Psi pulses slow you down.' },
};
const Env = {
  weather: 'clear', wT: 70, strikeT: 4, psiT: 8, night: false, drops: [], lm: null, lctx: null, fogA: 0, rainA: 0,
  reset() {
    this.weather = 'clear'; this.wT = rand(55, 80); this.night = false; this.fogA = 0; this.rainA = 0; this.strikes = [];
    Sfx.setRain && Sfx.ctx && Sfx.setRain(0);
  },
  phase() { return (((G ? G.t : 0) + 60) / 300) % 1; },
  darkness() {
    if (World.kind === 'lab') return World.dark;
    const p = this.phase();
    let d = clamp(Math.cos((p - 0.75) * TAU) * 1.4 - 0.4, 0, 1) * 0.8;
    if (this.weather === 'storm') d = Math.max(d, 0.35);
    else if (this.weather === 'rain') d = Math.max(d, 0.18);
    else if (this.weather === 'psi') d = Math.max(d, 0.22);
    return d;
  },
  isNight() { return World.kind !== 'lab' && clamp(Math.cos((this.phase() - 0.75) * TAU) * 1.4 - 0.4, 0, 1) > 0.5; },
  sunset() { const p = this.phase(); return Math.exp(-((p - 0.56) ** 2) / 0.0018) * 0.2 + Math.exp(-((p - 0.95) ** 2) / 0.0018) * 0.12; },
  setWeather(w) {
    this.weather = w; this.wT = w === 'clear' ? rand(60, 100) : rand(45, 75);
    if (w !== 'clear') { banner(WEATHER[w].icon + ' ' + WEATHER[w].name.toUpperCase(), WEATHER[w].desc, 3); Radio.say(w); }
  },
  update(dt) {
    const n = this.isNight();
    if (n !== this.night) { this.night = n; if (G.t > 5) { Radio.say(n ? 'night' : 'day'); if (n) banner('🌙 NIGHT FALLS', 'More mutants roam in the dark.', 3); } }
    this.wT -= dt;
    if (this.wT <= 0) {
      if (this.weather !== 'clear') this.setWeather('clear');
      else {
        const opts = [['rain', 3], ['fog', 2], ['storm', G.t > 90 ? 2 : 0], ['psi', G.t > 240 ? 1.5 : 0]];
        let tot = 0; for (const o of opts) tot += o[1];
        let r = rand(tot); for (const o of opts) { r -= o[1]; if (r <= 0) { this.setWeather(o[0]); break; } }
      }
    }
    const indoor = World.kind === 'lab', w = indoor ? 'clear' : this.weather;
    this.rainA = lerp(this.rainA, w === 'rain' || w === 'storm' ? 1 : 0, dt * 0.8);
    this.fogA = lerp(this.fogA, w === 'fog' ? 1 : 0, dt * 0.6);
    if (Sfx.ctx) Sfx.setRain(this.rainA);
    if (w === 'storm') {
      this.strikeT -= dt;
      if (this.strikeT <= 0) {
        this.strikeT = rand(1.6, 3.2);
        const a = rand(TAU), d = rand(60, 420), x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * 0.8;
        G.fx.push({ k: 'target', x, y, r: 80, life: 1.1, max: 1.1, blue: true });
        G.timers.push({ t: 1.1, fn: () => { strike(x, y, 90, 80, true); flash(0.25, '220,230,255'); shake(6); } });
      }
    }
    if (w === 'psi') {
      this.psiT -= dt;
      if (this.psiT <= 0) {
        this.psiT = rand(7, 10);
        G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 500, life: 0.8, max: 0.8, c: '200,120,255' });
        Sfx.play('psi');
        if (!P.psiImmune) { G.psi = 1; P.psiSlowT = 1.6; }
      }
    }
  },
  // lights: world-space soft holes punched into a darkness mask
  render(cx, cy) {
    const dark = this.darkness(), q = Save.set.quality === 'low' ? 0.33 : 0.5;
    const tint = this.sunset();
    if (tint > 0.01 && World.kind !== 'lab') { ctx.fillStyle = `rgba(255,120,40,${tint})`; ctx.fillRect(0, 0, VW, VH); }
    if (dark > 0.02) {
      const w = Math.ceil(VW * q), h = Math.ceil(VH * q);
      if (!this.lm) { this.lm = document.createElement('canvas'); this.lctx = this.lm.getContext('2d'); }
      if (this.lm.width !== w || this.lm.height !== h) { this.lm.width = w; this.lm.height = h; }
      const l = this.lctx, zs = ZOOM * q;
      l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, w, h);
      l.fillStyle = World.kind === 'lab' ? `rgba(4,6,8,${dark})` : `rgba(6,8,22,${dark})`; l.fillRect(0, 0, w, h);
      l.globalCompositeOperation = 'destination-out';
      const sx = (x) => ((x - cx) * ZOOM + VW / 2) * q, sy = (y) => ((y - cy) * ZOOM + VH / 2) * q;
      const light = (x, y, r, s) => {
        const X = sx(x), Y = sy(y), R = r * zs;
        if (X + R < 0 || X - R > w || Y + R < 0 || Y - R > h) return;
        const g = l.createRadialGradient(X, Y, 0, X, Y, R);
        g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = g; l.beginPath(); l.arc(X, Y, R, 0, TAU); l.fill();
      };
      // player: ambient + flashlight cone
      light(P.x, P.y - 20, 120, 0.8);
      const a = P.lookA ?? 0, X = sx(P.x), Y = sy(P.y - 20), R = 460 * zs;
      const g = l.createRadialGradient(X, Y, 10 * zs, X, Y, R);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.6, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.moveTo(X, Y); l.arc(X, Y, R, a - 0.5, a + 0.5); l.closePath(); l.fill();
      if (P.muzzle > 0) light(P.x, P.y - 20, 200, 0.6);
      if (P.aura) light(P.x, P.y, (70 + P.aura * 16) * P.areaMul * 1.3, 0.5);
      for (const an of World.anomalies) {
        if (Math.abs(an.x - cx) > VW / ZOOM || Math.abs(an.y - cy) > VH / ZOOM) continue;
        const s = an.type === 'electro' ? 0.55 : an.type === 'burner' ? (an.act > 0 ? 0.95 : 0.35) : an.type === 'acid' ? 0.45 : 0.2;
        light(an.x, an.y - 10, an.r * (an.type === 'burner' && an.act > 0 ? 3 : 1.6), s);
      }
      for (const f of World.fields) if (f.art && dist2(f.art.x, f.art.y, P.x, P.y) < 400 * 400) light(f.art.x, f.art.y - 16, 70, 0.7);
      for (const s of World.shelters) light(s.x, s.y - 60, 90, 0.6);
      for (const h of World.hatches) light(h.x, h.y - 40, 110, 0.6);
      if (World.kind === 'lab') for (const r of World.lab.rooms) { const fl = Math.sin(NOW * 7 + r.mx * 3) > -0.85 ? 1 : 0.3; light((r.mx + 0.5) * LAB_T, (r.my + 0.5) * LAB_T, Math.min(r.w, r.h) * LAB_T * 0.6, 0.55 * fl); }
      for (const p of World.pois) light(p.x, p.y, 140, 0.35);
      for (const e of G.enemies) if (e.id === 'poltergeist' || e.id === 'monolith') light(e.x, e.y - e.z, e.id === 'monolith' ? 260 : 100, 0.8);
      let nb = 0;
      for (const b of G.ebullets) { if (nb++ > 60) break; light(b.x, b.y, 40, 0.6); }
      for (const f of G.fx) {
        if (f.k === 'boom') light(f.x, f.y, f.r * 2, (f.life / f.max) * 0.95);
        else if (f.k === 'sky') light(f.x, f.y, 420, (f.life / f.max) * 0.9);
        else if (f.k === 'beam' || f.k === 'lightning') light(P.x, P.y, 260, (f.life / f.max) * 0.7);
        else if (f.k === 'nova') light(f.x, f.y, f.r * 1.2, 0.8);
      }
      ctx.drawImage(this.lm, 0, 0, VW, VH);
    }
    // weather overlays
    if (this.fogA > 0.02) {
      const X = (P.x - cx) * ZOOM + VW / 2, Y = (P.y - cy) * ZOOM + VH / 2;
      const g = ctx.createRadialGradient(X, Y, 140 * ZOOM, X, Y, 560 * ZOOM);
      g.addColorStop(0, 'rgba(170,176,170,0)'); g.addColorStop(1, `rgba(150,156,150,${0.85 * this.fogA})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    }
    if (this.rainA > 0.02) {
      if (this.drops.length < 170) for (let i = 0; i < 170; i++) this.drops.push({ x: rand(VW), y: rand(VH), s: rand(0.6, 1) });
      ctx.strokeStyle = `rgba(190,205,225,${0.35 * this.rainA})`; ctx.lineWidth = 1.2; ctx.beginPath();
      const n = Math.floor(this.drops.length * this.rainA);
      for (let i = 0; i < n; i++) {
        const d = this.drops[i]; d.y += 22 * d.s; d.x -= 5 * d.s;
        if (d.y > VH) { d.y = -20; d.x = rand(VW + 100); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4 * d.s, d.y + 16 * d.s);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(20,30,50,${0.12 * this.rainA})`; ctx.fillRect(0, 0, VW, VH);
    }
    if (World.kind !== 'lab' && this.weather === 'psi') { ctx.fillStyle = `rgba(120,40,180,${0.1 + Math.sin(NOW * 2) * 0.04})`; ctx.fillRect(0, 0, VW, VH); }
  },
};
