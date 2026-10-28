// Level design helper: finds the fewest moves that solve a level, which opening moves
// make it unwinnable, and a tight reference solution for levels.js.
//
//   node tools/solve.mjs 12            level 12
//   node tools/solve.mjs fork --depth 7
//
// A "move" here is: tilt one of the 8 directions and hold until every marble has
// stopped, then let go. Players can do more than that (half tilts, switching
// mid-roll), so the counts are an upper bound on how many moves a level needs.
// The search looks 8 moves deep by default and gives up after 20 000 positions.

import { LEVELS } from '../prototype/src/levels.js';
import { buildTrack } from '../prototype/src/track.js';
import { createSim, stepSim, isWon } from '../prototype/src/sim.js';
import { createTilt, updateTilt, gravityInMachine, directionVector } from '../prototype/src/tilt.js';
import { replay, levelTimes } from '../prototype/src/replay.js';
import { SIM_DT } from '../prototype/src/config.js';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function cloneSim(sim) {
  return {
    ...sim,
    marbles: sim.marbles.map((m) => ({ ...m, pos: [...m.pos], tangent: [...m.tangent] })),
    goals: sim.goals.map((g) => ({ ...g })),
    plates: sim.plates.map((p) => ({ ...p })),
    gates: sim.gates.map((g) => ({ ...g })),
  };
}

const stateKey = (sim) => sim.marbles.map((m) => (m.delivered ? 'D' : `${m.edge}:${Math.round(m.s * 10)}`)).join('|');
// Everything has stopped: no marble moved more than a hair in the last tenth of a second.
// (Positions, not speeds: two marbles pressed together in a curve jiggle forever.)
function settleWatch(sim) {
  let mark = sim.marbles.map((m) => [...m.pos]);
  let since = 0;
  return (dt) => {
    since += dt;
    if (since < 0.1) return false;
    const moved = sim.marbles.some((m, i) => !m.delivered && Math.hypot(m.pos[0] - mark[i][0], m.pos[1] - mark[i][1], m.pos[2] - mark[i][2]) > 0.02);
    mark = sim.marbles.map((m) => [...m.pos]);
    since = 0;
    return !moved;
  };
}

// Tilt `dir` until everything stops, then let go until everything stops again.
export function macro(sim, dir) {
  const s = cloneSim(sim);
  const tilt = createTilt();
  tilt.target = directionVector(dir);
  tilt.holding = true;
  let t = 0;
  let won = false;
  let settled = settleWatch(s);
  while (t < 4.5) {
    updateTilt(tilt, SIM_DT);
    stepSim(s, SIM_DT, gravityInMachine(tilt.current));
    t += SIM_DT;
    if (isWon(s)) {
      won = true;
      break;
    }
    if (settled(SIM_DT) && t > 0.3) break;
  }
  const hold = t;
  if (!won) {
    tilt.target = [0, 0];
    tilt.holding = false;
    settled = settleWatch(s);
    while (t - hold < 3) {
      updateTilt(tilt, SIM_DT);
      stepSim(s, SIM_DT, gravityInMachine(tilt.current));
      t += SIM_DT;
      if (isWon(s)) {
        won = true;
        break;
      }
      if (settled(SIM_DT) && Math.hypot(...tilt.current) < 0.005) break;
    }
  }
  return { sim: s, won, hold, time: t };
}

// Breadth-first search over moves. Returns every shortest winning path (up to a cap)
// and how many positions were explored.
export function solve(sim, depth = 8, cap = 12, maxStates = Infinity) {
  const seen = new Set([stateKey(sim)]);
  let frontier = [{ sim, path: [] }];
  const wins = [];
  for (let d = 1; d <= depth && !wins.length; d++) {
    const next = [];
    for (const node of frontier) {
      for (const dir of DIRS) {
        const r = macro(node.sim, dir);
        const path = [...node.path, { dir, hold: r.hold, release: r.time - r.hold }];
        if (r.won) {
          if (wins.length < cap) wins.push(path);
          continue;
        }
        const k = stateKey(r.sim);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ sim: r.sim, path });
      }
    }
    frontier = next;
    if (!frontier.length || seen.size > maxStates) break;
  }
  return { wins, explored: seen.size };
}

// The moves of a search result as a replayable solution: each tilt, then the pause
// the search let things settle for (tighten() removes the pauses that aren't needed).
export function draftSolution(path) {
  const up = (t) => Math.ceil(t * 10) / 10;
  return path.flatMap((s, i) => (i < path.length - 1 && s.release > 0.05 ? [[s.dir, up(s.hold)], ['-', up(s.release)]] : [[s.dir, up(s.hold)]]));
}

// Shorten each step of a solution as far as it still wins, to get an expert's time.
// (Tilts stay at least half a second long; see below.)
// If the moves don't chain without letting go in between, short pauses are added
// first and then shortened (or dropped) like every other step.
export function tighten(level, solution) {
  let best = solution.map((s) => [...s]);
  let run = replay(level, best, { maxTime: 60 });
  if (!run.won) {
    best = solution.flatMap((s) => [[...s], ['-', 0.8]]);
    run = replay(level, best, { maxTime: 60 });
    if (!run.won) return null;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < best.length; i++) {
      for (;;) {
        const trial = best.map((s) => [...s]);
        trial[i][1] = Math.round((trial[i][1] - 0.1) * 10) / 10;
        // Keep it playable: a tilt shorter than half a second is a twitch no player would
        // make on purpose, and a pause is either a real one or none at all.
        if (trial[i][0] !== '-' && trial[i][1] < 0.5) break;
        const dropped = trial[i][0] === '-' && trial[i][1] < 0.2;
        if (dropped) trial.splice(i, 1);
        const r = replay(level, trial, { maxTime: 60 });
        if (!r.won || r.time > run.time + 1e-9) break;
        best = trial;
        run = r;
        if (dropped) break;
      }
    }
  }
  return { solution: best, time: run.time };
}

function main() {
  const args = process.argv.slice(2);
  const depthAt = args.indexOf('--depth');
  const depth = depthAt >= 0 ? Number(args[depthAt + 1]) : 8;
  const which = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--depth');
  const targets = which ? [/^\d+$/.test(which) ? LEVELS[Number(which) - 1] : LEVELS.find((l) => l.id === which)] : LEVELS;
  for (const level of targets) {
    if (!level) throw new Error(`No level "${which}"`);
    const n = LEVELS.indexOf(level) + 1;
    const track = buildTrack(level);
    if (track.errors.length) {
      console.log(`${n}. ${level.name}: ${track.errors.join('; ')}`);
      continue;
    }
    const start = createSim(track);
    const { wins, explored } = solve(start, depth, 12, 20000);
    console.log(`\n${n}. ${level.name}`);
    if (!wins.length) {
      console.log(`  no solution within ${depth} moves (${explored} positions)`);
      continue;
    }
    console.log(`  fewest moves: ${wins[0].length} (${wins.length}${wins.length >= 12 ? '+' : ''} ways, ${explored} positions)`);
    for (const w of wins.slice(0, 4)) console.log(`    ${w.map((s) => s.dir).join(' ')}`);
    // Opening moves after which the level can't be won within the remaining moves.
    const traps = [];
    for (const dir of DIRS) {
      const r = macro(start, dir);
      if (r.won) continue;
      if (!solve(r.sim, depth - 1, 1, 10000).wins.length) traps.push(dir);
    }
    console.log(`  losing first moves: ${traps.length ? traps.join(' ') : 'none'}`);
    const draft = draftSolution(wins[0]);
    const tight = tighten(level, draft);
    if (tight) {
      const t = levelTimes(level, tight.time);
      console.log(`  reference: ${JSON.stringify(tight.solution).replaceAll('"', "'")}  ${tight.time.toFixed(2)} s`);
      console.log(`  timers (factor ${level.timeFactor ?? 2.5}): limit ${t.limit} s, par ${t.par} s, gold ${t.gold} s`);
    } else {
      console.log('  draft solution did not replay; write one by hand');
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
