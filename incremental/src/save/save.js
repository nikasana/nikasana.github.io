// Saves: versioned JSON in localStorage with migrations, separate slots for solo and each crew,
// export/import as a compressed code, hard reset.
import { Big } from '../core/big.js';

export const SAVE_VERSION = 1;
const PREFIX = 'mtp.';
const SETTINGS_KEY = 'mtp.settings';

// Each migration upgrades a save from version i to i+1. Keep them forever.
const MIGRATIONS = [
  // v0 -> v1: (pre-release saves) nothing stored yet
  (s) => s,
];

export function slotKey(slot) { return `${PREFIX}save.${slot}`; }

export function migrate(raw) {
  let s = raw;
  let v = s.v ?? 0;
  while (v < SAVE_VERSION) { s = MIGRATIONS[v](s) || s; v++; s.v = v; }
  return s;
}

// econ <-> plain JSON (Big values as strings)
export function econToJSON(e) {
  return { ...e, coins: e.coins.toJSON(), total: e.total.toJSON(), buyLog: e.buyLog.slice(-12) };
}

export function econFromJSON(o) {
  return { ...o, coins: Big.parse(o.coins), total: Big.parse(o.total) };
}

export function readSlot(slot) {
  try {
    const s = localStorage.getItem(slotKey(slot));
    if (!s) return null;
    return migrate(JSON.parse(s));
  } catch (err) {
    console.warn('save read failed', err);
    return null;
  }
}

export function writeSlot(slot, data) {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify({ ...data, v: SAVE_VERSION, savedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn('save write failed', err);
    return false;
  }
}

export function deleteSlot(slot) { try { localStorage.removeItem(slotKey(slot)); } catch { /* storage blocked */ } }

export function listSlots() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${PREFIX}save.`)) out.push(k.slice(`${PREFIX}save.`.length));
    }
  } catch { /* storage blocked */ }
  return out;
}

export function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch { return null; }
}

export function writeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

// ---------- export / import ----------

async function deflate(str) {
  if (typeof CompressionStream === 'undefined') return new TextEncoder().encode(str);
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') return new TextDecoder().decode(bytes);
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(ds).text();
}

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

export async function exportCode(data) {
  const json = JSON.stringify({ ...data, v: SAVE_VERSION });
  const z = typeof CompressionStream !== 'undefined';
  return `MTP${SAVE_VERSION}${z ? 'z' : 'r'}:${b64(await deflate(json))}`;
}

export async function importCode(code) {
  const m = /^MTP(\d+)([zr]):(.+)$/s.exec(code.trim());
  if (!m) throw new Error('That is not a Melt the Planet save code.');
  const bytes = unb64(m[3].replace(/\s+/g, ''));
  const json = m[2] === 'z' ? await inflate(bytes) : new TextDecoder().decode(bytes);
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object' || !data.econ) throw new Error('The save code is damaged.');
  return migrate(data);
}
