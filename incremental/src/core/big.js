// Big: mantissa/exponent number (value = m * 10^e, 1 <= |m| < 10) so values never overflow.
// Immutable. Pure module (used by the game and by tools/sim.mjs).

const LOG10 = Math.log10;

export class Big {
  constructor(m = 0, e = 0) {
    this.m = m;
    this.e = e;
  }

  static from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'string') return Big.parse(x);
    return Big.fromNumber(x);
  }

  static fromNumber(n) {
    if (!Number.isFinite(n) || n === 0) return new Big(0, 0);
    const e = Math.floor(LOG10(Math.abs(n)));
    let m = n / Math.pow(10, e);
    return Big.norm(m, e);
  }

  static norm(m, e) {
    if (m === 0 || !Number.isFinite(m)) return new Big(0, 0);
    const a = Math.abs(m);
    if (a >= 10 || a < 1) {
      const d = Math.floor(LOG10(a));
      m /= Math.pow(10, d);
      e += d;
    }
    // guard rounding drift (9.9999999 -> 10)
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    return new Big(m, e);
  }

  static parse(s) {
    if (s && typeof s === 'object' && 'm' in s) return Big.norm(s.m, s.e);
    const str = String(s);
    const i = str.indexOf('e');
    if (i >= 0) return Big.norm(parseFloat(str.slice(0, i)), parseInt(str.slice(i + 1), 10));
    return Big.fromNumber(parseFloat(str));
  }

  static pow10(e) { return new Big(1, Math.floor(e)).mul(Math.pow(10, e - Math.floor(e))); }

  isZero() { return this.m === 0; }

  toNumber() {
    if (this.e > 308) return Infinity;
    if (this.e < -324) return 0;
    return this.m * Math.pow(10, this.e);
  }

  log10() { return this.m <= 0 ? -Infinity : LOG10(this.m) + this.e; }

  add(o) {
    o = Big.from(o);
    if (this.m === 0) return o;
    if (o.m === 0) return this;
    const d = this.e - o.e;
    if (d > 16) return this;
    if (d < -16) return o;
    if (d >= 0) return Big.norm(this.m + o.m / Math.pow(10, d), this.e);
    return Big.norm(this.m / Math.pow(10, -d) + o.m, o.e);
  }

  sub(o) { o = Big.from(o); return this.add(new Big(-o.m, o.e)); }

  mul(o) {
    if (typeof o === 'number') return Big.norm(this.m * o, this.e);
    return Big.norm(this.m * o.m, this.e + o.e);
  }

  div(o) {
    if (typeof o === 'number') return Big.norm(this.m / o, this.e);
    if (o.m === 0) return new Big(0, 0);
    return Big.norm(this.m / o.m, this.e - o.e);
  }

  // ratio this/o as a plain number (safe for comparisons of similar magnitude)
  ratio(o) {
    o = Big.from(o);
    if (o.m === 0) return Infinity;
    const de = this.e - o.e;
    if (de > 300) return Infinity;
    if (de < -300) return 0;
    return (this.m / o.m) * Math.pow(10, de);
  }

  pow(p) {
    if (this.m <= 0) return new Big(0, 0);
    const l = this.log10() * p;
    return Big.pow10(l);
  }

  cmp(o) {
    o = Big.from(o);
    if (this.m === 0 && o.m === 0) return 0;
    if (this.m >= 0 && o.m < 0) return 1;
    if (this.m < 0 && o.m >= 0) return -1;
    if (this.m === 0) return o.m > 0 ? -1 : 1;
    if (o.m === 0) return this.m > 0 ? 1 : -1;
    const sign = this.m > 0 ? 1 : -1;
    if (this.e !== o.e) return this.e > o.e ? sign : -sign;
    return this.m === o.m ? 0 : (this.m > o.m ? 1 : -1);
  }

  gte(o) { return this.cmp(o) >= 0; }
  gt(o) { return this.cmp(o) > 0; }
  lt(o) { return this.cmp(o) < 0; }
  max(o) { return this.cmp(o) >= 0 ? this : Big.from(o); }
  min(o) { return this.cmp(o) <= 0 ? this : Big.from(o); }

  toJSON() { return `${+this.m.toPrecision(15)}e${this.e}`; }
  toString() { return format(this); }
}

Big.ZERO = new Big(0, 0);
Big.ONE = new Big(1, 0);

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

export const numberFormat = { scientific: false };

// Short suffixes; scientific notation past the suffix table or when enabled.
export function format(x, digits = 3) {
  const b = Big.from(x);
  if (b.m === 0) return '0';
  const neg = b.m < 0;
  const a = neg ? new Big(-b.m, b.e) : b;
  let out;
  if (a.e < 3) {
    const n = a.toNumber();
    out = n < 10 && n % 1 ? n.toFixed(n < 1 ? 2 : 1) : Math.floor(n).toLocaleString('en-US');
  } else if (numberFormat.scientific || a.e >= SUFFIX.length * 3) {
    out = `${a.m.toFixed(2)}e${a.e}`;
  } else {
    const k = Math.floor(a.e / 3);
    const v = a.m * Math.pow(10, a.e - k * 3);
    const dec = Math.max(0, digits - String(Math.floor(v)).length);
    out = `${trimZeros(v.toFixed(dec))}${SUFFIX[k]}`;
  }
  return neg ? `-${out}` : out;
}

function trimZeros(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function formatTime(sec) {
  sec = Math.max(0, sec);
  if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
}
