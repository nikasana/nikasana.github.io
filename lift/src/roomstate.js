// Pure per-room state: a 16x16 grid of clutter units and grime.
import { CFG } from './config.js';
import { initialClutter, propCells } from './world.js';

const G = CFG.grid, N = G * G;

export function createRoom(info) {
  const c = initialClutter(info);
  let total = 0; for (let i = 0; i < N; i++) total += c[i];
  const warm = info.modifier === 'warm' || info.cabin;
  const g = new Float32Array(N).fill(warm ? 0 : 1);
  for (const k of propCells(info)) g[k] = 0;
  return { c, g, total, lit: warm, lampFade: 0, visited: false, touched: false, flags: info.modifier === 'warm' ? { free: 1 } : {},
    clearedDone: warm, polishedDone: warm, strength: 0 };
}

export function clearedShare(room) {
  if (room.clearedDone || room.total <= 0) return 1;
  let s = 0; for (let i = 0; i < N; i++) s += room.c[i];
  return Math.max(0, 1 - s / room.total);
}
export function polishShare(room) {
  if (room.polishedDone) return 1;
  let s = 0; for (let i = 0; i < N; i++) s += room.c[i] > 0 ? 0 : 1 - room.g[i];
  return s / N;
}

// Cells whose centre lies within radius (in cells) of (cx, cz) given in cell units.
export function cellsInCircle(cx, cz, rc, out = []) {
  out.length = 0;
  const i0 = Math.max(0, Math.floor(cx - rc)), i1 = Math.min(G - 1, Math.floor(cx + rc));
  const j0 = Math.max(0, Math.floor(cz - rc)), j1 = Math.min(G - 1, Math.floor(cz + rc));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = i + 0.5 - cx, dz = j + 0.5 - cz;
    if (dx * dx + dz * dz <= rc * rc) out.push(j * G + i);
  }
  return out;
}

// Remove clutter under the tool. Returns {units, cells:[idx...]} removed this step.
export function clearAt(room, cells, rate, dt) {
  let units = 0; const touchedCells = [];
  for (const k of cells) {
    const v = room.c[k]; if (v <= 0) continue;
    const take = Math.min(v, rate * dt);
    room.c[k] = v - take < 1e-4 ? 0 : v - take;
    units += take; touchedCells.push(k);
  }
  if (units > 0) { room.touched = true; finishClear(room); }
  return { units, cells: touchedCells };
}
export function finishClear(room) {
  if (room.clearedDone) return false;
  if (clearedShare(room) >= 1 - CFG.clear.autoFinish) { room.c.fill(0); room.clearedDone = true; return true; }
  return false;
}

// Polish bare cells under the tool. Returns amount polished.
export function polishAt(room, cells, rate, dt) {
  let amt = 0;
  for (const k of cells) {
    if (room.c[k] > 0) continue;
    const v = room.g[k]; if (v <= 0) continue;
    const take = Math.min(v, rate * dt);
    room.g[k] = v - take < 1e-4 ? 0 : v - take; amt += take;
  }
  if (amt > 0) { room.touched = true; finishPolish(room); }
  return amt;
}
export function finishPolish(room) {
  if (room.polishedDone || !room.clearedDone) return false;
  if (polishShare(room) >= 1 - CFG.clear.autoFinish) { room.g.fill(0); room.polishedDone = true; return true; }
  return false;
}

// Dust settles in unlit rooms.
export function settleDust(room, dt) {
  if (room.lit) return;
  const amt = CFG.polish.dustRate * dt;
  for (let k = 0; k < N; k++) if (room.g[k] < 1 && room.c[k] <= 0) room.g[k] = Math.min(1, room.g[k] + amt);
  if (room.polishedDone) {
    let s = 0; for (let k = 0; k < N; k++) s += room.c[k] > 0 ? 0 : 1 - room.g[k];
    if (s / N < 1 - CFG.clear.autoFinish) room.polishedDone = false;
  }
}

export function roomStrength(room, lampLevel, shine) {
  if (!room.lit) return 0;
  return lampLevel * clearedShare(room) * Math.min(1, polishShare(room)) * shine;
}

// Tide flooding: clutter returns, lamp is lost.
export function flood(room, info, share = CFG.tide.floodClutter) {
  const base = initialClutter(info);
  for (let k = 0; k < N; k++) room.c[k] = Math.max(room.c[k], base[k] * share);
  let s = 0; for (let k = 0; k < N; k++) s += room.c[k];
  if (s > 0) { room.clearedDone = false; room.polishedDone = false; room.g.fill(1); for (const k of propCells(info)) room.g[k] = 0; }
  room.touched = true;
}

// Compact serialisation.
const toB64 = (u8) => (typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(String.fromCharCode(...u8)));
const fromB64 = (s) => (typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)));
export function serializeRoom(room) {
  const c = new Uint8Array(N), g = new Uint8Array(N);
  for (let k = 0; k < N; k++) { c[k] = Math.min(255, Math.round(room.c[k] * 40)); g[k] = Math.round(room.g[k] * 255); }
  return { c: toB64(c), g: toB64(g), t: +room.total.toFixed(3), l: room.lit ? 1 : 0, v: room.visited ? 1 : 0,
    cd: room.clearedDone ? 1 : 0, pd: room.polishedDone ? 1 : 0, f: room.flags };
}
export function deserializeRoom(o) {
  const c8 = fromB64(o.c), g8 = fromB64(o.g);
  const c = new Float32Array(N), g = new Float32Array(N);
  for (let k = 0; k < N; k++) { c[k] = c8[k] / 40; g[k] = g8[k] / 255; }
  return { c, g, total: o.t, lit: !!o.l, lampFade: 0, visited: !!o.v, touched: true, flags: o.f || {},
    clearedDone: !!o.cd, polishedDone: !!o.pd, strength: 0 };
}
