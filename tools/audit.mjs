// Level audit: checks that every level is fair, purposeful and harder than the last.
//
//   node tools/audit.mjs            every level
//   node tools/audit.mjs 12 13      just these
//
// For each level it explores every position the machine can reach (a move = tilt one of
// the 8 directions until everything stops, then let go) and reports:
//   moves    fewest moves to win
//   ways     how many different shortest solutions there are
//   lose     opening moves after which the level can never be won
//   dead     share of reachable positions from which the level can never be won
//   random   chance that someone tilting at random wins within 3x the fewest moves
//   locks    for each link's gates (A, B, C) and shutters (a, b, c), what jamming them open
//            does: 'costs' (the level gets shorter), 'reroutes' (every shortcut it allows
//            fails with the lock working), 'blocks' (some do) or 'useless' (none do).
//   unused   grooves no marble touches in the reference solution or the traps

import { LEVELS } from '../prototype/src/levels.js';
import { buildTrack } from '../prototype/src/track.js';
import { createSim } from '../prototype/src/sim.js';
import { replay } from '../prototype/src/replay.js';
import { macro, stateKey, lockEffect } from './solve.mjs';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WIN = -1;

// Every reachable position and the move graph between them.
export function explore(level, maxStates = 20000) {
  const track = buildTrack(level);
  if (track.errors.length) return { errors: track.errors };
  const start = createSim(track);
  const ids = new Map([[stateKey(start), 0]]);
  const sims = [start];
  const next = []; // next[id][dir] = state id or WIN
  const holds = [];
  for (let i = 0; i < sims.length; i++) {
    next[i] = [];
    holds[i] = [];
    for (const dir of DIRS) {
      const r = macro(sims[i], dir);
      holds[i].push({ dir, hold: r.hold, release: r.time - r.hold });
      if (r.won) {
        next[i].push(WIN);
        continue;
      }
      const k = stateKey(r.sim);
      if (!ids.has(k)) {
        if (sims.length >= maxStates) {
          next[i].push(i); // treat as no progress; the result is marked incomplete
          continue;
        }
        ids.set(k, sims.length);
        sims.push(r.sim);
      }
      next[i].push(ids.get(k));
    }
    sims[i] = i === 0 ? sims[i] : null; // free memory once expanded
  }
  const n = next.length;
  const complete = n < maxStates;

  // Fewest moves from each position to a win (backwards from the winning moves).
  const back = Array.from({ length: n }, () => []);
  next.forEach((js, i) => js.forEach((j) => j !== WIN && back[j].push(i)));
  const toWin = new Array(n).fill(Infinity);
  let frontier = [];
  for (let i = 0; i < n; i++) {
    if (next[i].includes(WIN)) {
      toWin[i] = 1;
      frontier.push(i);
    }
  }
  for (let d = 2; frontier.length; d++) {
    const nf = [];
    for (const j of frontier) {
      for (const i of back[j]) {
        if (toWin[i] === Infinity) {
          toWin[i] = d;
          nf.push(i);
        }
      }
    }
    frontier = nf;
  }
  const good = toWin.map((d) => d < Infinity);
  const minMoves = toWin[0];

  // How many different shortest solutions there are.
  const ways = new Array(n).fill(0);
  const byDistance = [...Array(n).keys()].filter((i) => good[i]).sort((a, b) => toWin[a] - toWin[b]);
  for (const i of byDistance) {
    ways[i] = next[i].reduce((sum, j) => sum + (j === WIN ? (toWin[i] === 1 ? 1 : 0) : toWin[j] === toWin[i] - 1 ? ways[j] : 0), 0);
  }

  // One shortest solution, with the hold times the search used.
  let path = null;
  if (minMoves < Infinity) {
    path = [];
    for (let i = 0, d = minMoves; d > 0; d--) {
      const x = next[i].findIndex((j) => (d === 1 ? j === WIN : j !== WIN && toWin[j] === d - 1));
      path.push(holds[i][x]);
      i = next[i][x];
    }
  }

  // Chance a random tilter wins within k moves.
  const k = minMoves < Infinity ? 3 * minMoves : 0;
  let p = new Array(n).fill(0);
  for (let step = 0; step < k; step++) {
    const q = new Array(n).fill(0);
    for (let i = 0; i < n; i++) q[i] = next[i].reduce((sum, j) => sum + (j === WIN ? 1 : p[j]), 0) / DIRS.length;
    p = q;
  }

  const losing = DIRS.filter((_, x) => next[0][x] !== WIN && !good[next[0][x]]);
  return {
    positions: n,
    complete,
    minMoves,
    ways: ways[0],
    losing,
    dead: 1 - good.filter(Boolean).length / n,
    random: p[0] || 0,
    path,
  };
}

// The level with one group of locks jammed open: the gates of a link ('A'), or its
// shutters ('a').
export function withLinkOpen(level, group) {
  const link = group.toUpperCase();
  const inverse = group !== link;
  const jammed = (p) => p[0] === 'gate' && p[5]?.link === link && Boolean(p[5]?.inverse) === inverse;
  return { ...level, pieces: level.pieces.map((p) => (jammed(p) ? ['straight', p[1], p[2], p[3], p[4]] : p)) };
}

// Grooves that no marble touches in the reference solution or any trap.
export function unusedPieces(level) {
  const track = buildTrack(level);
  const used = new Set();
  const runs = [level.solution, ...(level.traps || [])];
  for (const run of runs) {
    replay(level, run, {
      maxTime: 40,
      onStep: (sim) => {
        for (const m of sim.marbles) used.add(m.edge);
      },
    });
  }
  for (const st of track.starts) used.add(st?.edge);
  return track.pieces.filter((p) => p.edges.length && p.edges.every((e) => !used.has(e))).map((p) => p.label);
}

export function auditLevel(level) {
  const result = explore(level);
  if (result.errors) return result;
  const links = [...new Set(level.pieces.filter((p) => p[0] === 'gate').map((p) => (p[5]?.inverse ? p[5].link.toLowerCase() : p[5]?.link)))];
  const real = createSim(buildTrack(level));
  result.locks = Object.fromEntries(links.map((link) => [link, lockEffect(real, createSim(buildTrack(withLinkOpen(level, link))), result.minMoves)]));
  result.useless = links.filter((link) => result.locks[link] === 'useless');
  result.unused = unusedPieces(level);
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.length ? args.map((a) => (/^\d+$/.test(a) ? LEVELS[Number(a) - 1] : LEVELS.find((l) => l.id === a))) : LEVELS;
  for (const level of targets) {
    const n = LEVELS.indexOf(level) + 1;
    const r = auditLevel(level);
    if (r.errors) {
      console.log(`${n}. ${level.name}: ${r.errors.join('; ')}`);
      continue;
    }
    const locks = Object.entries(r.locks).map(([k, v]) => `${k}:${v}`).join(' ');
    const flags = [
      r.complete ? '' : 'INCOMPLETE',
      r.useless.length ? `USELESS LOCK ${r.useless.join(',')}` : '',
      r.unused.length ? `UNUSED ${r.unused.join(' ')}` : '',
    ].filter(Boolean).join('  ');
    console.log(
      `${String(n).padStart(3)}. ${level.name.padEnd(22)} moves ${r.minMoves} ways ${String(r.ways).padEnd(3)} lose ${r.losing.length} dead ${(r.dead * 100).toFixed(0).padStart(3)}% random ${(r.random * 100).toFixed(1).padStart(5)}% pos ${String(r.positions).padEnd(5)} locks ${locks || '-'}  ${flags}`,
    );
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
