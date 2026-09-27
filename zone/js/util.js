'use strict';
const ZB_BUILD = 94; // keep in sync with version.txt and the ?v= in index.html
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

// ---------- graphics quality: 'high', 'low', 'min' (lowest, smoothest) or 'auto' (starts high and steps down to low,
// then to min, for the session whenever FPS stays under 45 for 3s) ----------
const GFX = {
  auto: 0, acc: 0, n: 0, bad: 0,
  reset() { this.auto = 0; this.bad = 0; this.acc = 0; this.n = 0; },
  sample(ms) {
    if (ms > 250) return; // tab switch or a stall, not a real frame time
    this.acc += ms; this.n++;
    if (this.acc < 1000) return;
    const fps = (this.n * 1000) / this.acc; this.acc = 0; this.n = 0;
    this.bad = fps < 45 ? this.bad + 1 : 0;
    if (this.bad >= 3 && this.auto < 2 && Save.data && Save.set.quality === 'auto') {
      this.auto++; this.bad = 0; applyGfx();
      if (typeof Missions !== 'undefined') Missions.toast('⚙ Graphics lowered for smoother FPS');
    }
  },
};
function gfxLevel() { const q = typeof Save !== 'undefined' && Save.data ? Save.set.quality : 'high'; return q === 'min' ? 2 : q === 'low' ? 1 : q === 'auto' ? GFX.auto : 0; }
function lowGfx() { return gfxLevel() >= 1; }
function minGfx() { return gfxLevel() >= 2; }
// every quality level renders at full sharpness: they only cut effects, never resolution
function gfxDpr() { return Math.min(2, window.devicePixelRatio || 1); }
// low applies everywhere: no decorative CSS loops or backdrop blur, throttled menu backgrounds and casino canvases;
// min also drops glows, shadows and CSS animations entirely
function applyGfx() {
  if (document.body) { document.body.classList.toggle('lowfx', lowGfx()); document.body.classList.toggle('minfx', minGfx()); }
  if (typeof resize === 'function' && typeof DPR !== 'undefined' && DPR !== gfxDpr()) resize();
}
// canvas glow (shadowBlur) is the single most expensive 2D effect on phones: on min every canvas draws it as 0
{
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
  if (d && d.set) Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v && minGfx() ? 0 : v); } });
}

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


// dates follow the game language, not the browser
function zbLocale() { const L = typeof I18n !== 'undefined' ? I18n.cur : 'en'; return { ka: 'ka-GE', ru: 'ru-RU', uk: 'uk-UA' }[L] || 'en-GB'; }
const ZB_MONTHS = { ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'], ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], uk: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
function zbDate(ts) { const d = new Date(ts), L = typeof I18n !== 'undefined' ? I18n.cur : 'en'; const m = (ZB_MONTHS[L] || ZB_MONTHS.en)[d.getMonth()]; return L === 'en' ? m + ' ' + d.getDate() : d.getDate() + ' ' + m; }
