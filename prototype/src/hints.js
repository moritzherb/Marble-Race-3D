// The Hint power-up: the next useful tilt, looked up rather than guessed.
//
// tools/hints.mjs explores every position a level can reach by whole moves (tilt one way until
// everything stops, then let go; see moves.js) and records, for each one, the best direction
// and how many moves are left, or that it can no longer be won. The table ships as
// prototype/hints/<level id>.json. In the game, the current position is looked up directly; if
// the marbles are somewhere a whole move would never leave them (the player let go mid-roll),
// the hint tries each direction from here with the same physics and looks those results up.
//
// Table format: positions are hashed (FNV-1a of moves.js's stateKey) and sorted. For each, one
// byte: the best direction (0-7, as DIRS) plus moves left (1-31) times 8, or 255 for a position
// that can no longer be won.

import { DIRS, stateKey, macro, cloneSim } from './moves.js';

export const DEAD = 255;

export function hashKey(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// entries: [[hash, byte]] -> base64 of the hashes (little-endian uint32) then the bytes.
export function encodeTable(entries) {
  entries.sort((a, b) => a[0] - b[0]);
  const bytes = new Uint8Array(entries.length * 5);
  const view = new DataView(bytes.buffer);
  entries.forEach(([h, v], i) => {
    view.setUint32(i * 4, h, true);
    bytes[entries.length * 4 + i] = v;
  });
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}

export function decodeTable(file) {
  const bin = typeof atob === 'function' ? atob(file.data) : Buffer.from(file.data, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const n = bytes.length / 5;
  const view = new DataView(bytes.buffer);
  const hashes = new Uint32Array(n);
  for (let i = 0; i < n; i++) hashes[i] = view.getUint32(i * 4, true);
  return { complete: file.complete, minMoves: file.minMoves, hashes, values: bytes.subarray(n * 4) };
}

// The table's entry for a position: { dir, left } or { dead: true }, or null if not listed.
export function lookup(table, sim) {
  const h = hashKey(stateKey(sim));
  let lo = 0;
  let hi = table.hashes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = table.hashes[mid];
    if (v === h) {
      const b = table.values[mid];
      return b === DEAD ? { dead: true } : { dir: DIRS[b & 7], left: b >> 3 };
    }
    if (v < h) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

// The position with no power-up effects, which is what the tables describe.
function plain(sim) {
  const s = cloneSim(sim);
  s.speedScale = 1;
  s.gates = s.gates.map((g) => ({ ...g, forced: false }));
  s.marbles = s.marbles.map((m) => ({ ...m, pull: null }));
  return s;
}

// The best next tilt from where the marbles are now:
//   { dir, left }        tilt `dir`; `left` whole moves (this one included) finish the level
//   { dead: true }       no sequence of moves can win from here any more
//   { unknown: true }    the position is off the table and one or two moves don't reach it
// `budget` limits the simulated moves when the position has to be searched.
export function findHint(table, sim, { budget = 72 } = {}) {
  const start = plain(sim);
  const here = lookup(table, start);
  if (here) return here;
  let tries = 0;
  let best = null;
  let allDead = true;
  const second = [];
  for (const dir of DIRS) {
    tries++;
    const r = macro(start, dir);
    if (r.won) return { dir, left: 1 };
    const e = lookup(table, r.sim);
    if (!e) {
      allDead = false;
      second.push({ dir, sim: r.sim });
    } else if (!e.dead) {
      allDead = false;
      if (!best || e.left + 1 < best.left) best = { dir, left: e.left + 1 };
    }
  }
  if (best) return best;
  if (allDead && table.complete) return { dead: true };
  for (const { dir, sim: s } of second) {
    for (const d2 of DIRS) {
      if (++tries > budget) return best || { unknown: true };
      const r = macro(s, d2);
      const e = r.won ? { left: 0 } : lookup(table, r.sim);
      if (e && !e.dead && (!best || e.left + 2 < best.left)) best = { dir, left: e.left + 2 };
    }
  }
  return best || { unknown: true };
}
