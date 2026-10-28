// Turns a drawn level into a finished levels.js entry:
//   1. removes dead-end grooves no marble uses (and re-checks the puzzle didn't change),
//   2. finds a tight reference solution and a trap for each losing opening (at most two),
//   3. picks a time factor that keeps the limit between 20 and 60 seconds,
//   4. runs the full audit.
//
//   import { finalize, entrySource } from './finalize.mjs'

import { compileMap } from '../prototype/src/grid.js';
import { buildTrack } from '../prototype/src/track.js';
import { createSim } from '../prototype/src/sim.js';
import { replay, levelTimes } from '../prototype/src/replay.js';
import { solve, macro, tighten, draftSolution, lockEffect, isRobust } from './solve.mjs';
import { auditLevel, unusedPieces, withLinkOpen } from './audit.mjs';
import { removeCell, trimMap } from './prune.mjs';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compiled(def) {
  const c = compileMap(def);
  return { ...def, pieces: c.pieces, blocks: c.blocks, mapErrors: c.errors };
}

function lockGroups(level) {
  return [...new Set(level.pieces.filter((p) => p[0] === 'gate').map((p) => (p[5].inverse ? p[5].link.toLowerCase() : p[5].link)))];
}

function profile(level, depth, maxStates) {
  const track = buildTrack(level);
  if (track.errors.length) return null;
  const sim = createSim(track);
  const { wins } = solve(sim, depth, 1, maxStates);
  if (!wins.length) return null;
  const moves = wins[0].length;
  const locks = Object.fromEntries(lockGroups(level).map((g) => [g, lockEffect(sim, createSim(buildTrack(withLinkOpen(level, g))), moves, maxStates)]));
  return { moves, path: wins[0], locks };
}

// A replayable reference run from a robust shortest solution, tightened to an expert's time.
function referenceRun(level, path, maxStates) {
  const start = createSim(buildTrack(level));
  const paths = [path, ...solve(start, path.length, 30, maxStates).wins];
  for (const p of paths) {
    if (!isRobust(level, p)) continue;
    const tight = tighten(level, draftSolution(p)) || tighten(level, p.flatMap((s) => [[s.dir, Math.ceil((s.hold + 0.3) * 10) / 10], ['-', 1]]));
    if (tight) return tight;
  }
  return null;
}

function withSolution(level, path, depth, maxStates) {
  const tight = referenceRun(level, path, maxStates);
  if (!tight) throw new Error(`${level.id}: no shortest solution that a person could repeat reliably`);
  const start = createSim(buildTrack(level));
  const traps = [];
  for (const dir of DIRS) {
    if (traps.length >= 2) break;
    const r = macro(start, dir);
    if (r.won || solve(r.sim, depth - 1, 1, maxStates).wins.length) continue;
    const trap = [[dir, Math.max(2, Math.ceil(r.hold * 10) / 10)], ...tight.solution];
    if (!replay(level, trap, { maxTime: 60 }).won) traps.push(trap);
  }
  let factor = level.timeFactor || 2.5;
  while (Math.ceil(tight.time * factor + 10) > 60 && factor > 1.2) factor = Math.round((factor - 0.1) * 10) / 10;
  return { ...level, timeFactor: factor, solution: tight.solution, traps: traps.length ? traps : undefined, refTime: tight.time };
}

export function finalize(def, { depth = 16, maxStates = 20000, log = () => {} } = {}) {
  let level = compiled(def);
  let base = profile(level, depth, maxStates);
  if (!base) throw new Error(`${def.id}: unsolvable or broken: ${buildTrack(level).errors.join('; ')}`);
  level = withSolution(level, base.path, depth, maxStates);

  // Prune unused dead ends, one at a time, keeping only removals that leave the puzzle as it was.
  for (let pass = 0; pass < 6; pass++) {
    const unused = unusedPieces(level).filter((label) => label.startsWith('end@'));
    let removed = false;
    for (const label of unused) {
      const cell = label.slice(4).split(',').map(Number);
      const map = trimMap(removeCell(level.map, cell));
      const trial = compiled({ ...def, map, marbles: level.marbles, bands: level.bands });
      const p = profile(trial, depth, maxStates);
      if (!p || p.moves !== base.moves || JSON.stringify(p.locks) !== JSON.stringify(base.locks)) continue;
      log(`${def.id}: removed unused dead end at ${cell}`);
      level = withSolution({ ...trial, timeFactor: def.timeFactor }, p.path, depth, maxStates);
      base = p;
      removed = true;
      break;
    }
    if (!removed) break;
  }
  const audit = auditLevel(level);
  return { level, audit, moves: base.moves, locks: base.locks };
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const steps = (list) => `[${list.map(([dir, sec]) => `[${q(dir)}, ${sec}]`).join(', ')}]`;

// The levels.js source for a finished level.
export function entrySource(level) {
  const tiers = level.map.map((rows) => `      [\n${rows.map((r) => `        ${q(r)},`).join('\n')}\n      ],`).join('\n');
  const lines = [
    `  {`,
    `    id: ${q(level.id)},`,
    `    name: ${q(level.name)},`,
    `    learn: ${q(level.learn)},`,
    `    map: [\n${tiers}\n    ],`,
  ];
  if (level.bands && Object.keys(level.bands).length) lines.push(`    bands: { ${Object.entries(level.bands).map(([k, v]) => `${k}: ${q(v)}`).join(', ')} },`);
  lines.push(`    marbles: [${level.marbles.map((m) => `{ color: ${q(m.color)}, at: [${m.at.join(', ')}] }`).join(', ')}],`);
  lines.push(`    timeFactor: ${level.timeFactor},`);
  lines.push(`    solution: ${steps(level.solution)},`);
  if (level.traps?.length) lines.push(`    traps: [${level.traps.map(steps).join(', ')}],`);
  lines.push(`  },`);
  return lines.join('\n');
}

export function timesOf(level) {
  return levelTimes(level, level.refTime);
}
