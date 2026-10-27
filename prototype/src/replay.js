// Plays a level's scripted solution without graphics, using the same tilt easing
// and physics as the game. Used by the tests and to derive each level's timers.

import { SIM_DT } from './config.js';
import { buildTrack } from './track.js';
import { createSim, stepSim, isWon } from './sim.js';
import { createTilt, updateTilt, gravityInMachine, directionVector } from './tilt.js';

// solution: list of [direction, seconds] or [direction, seconds, amount],
// e.g. [['E', 1.2], ['-', 0.3], ['SW', 0.8, 0.6]]. '-' means let go (level).
export function replay(level, solution = level.solution, { maxTime = 120, onStep } = {}) {
  const track = buildTrack(level);
  if (track.errors.length) return { won: false, time: 0, errors: track.errors, sim: null, events: [] };
  const sim = createSim(track);
  const tilt = createTilt();
  const events = [];
  let t = 0;
  const steps = [...solution, ['-', maxTime]];
  for (const [dir, seconds, amount = 1] of steps) {
    tilt.target = directionVector(dir, amount);
    tilt.holding = dir !== '-';
    const until = t + seconds;
    while (t < until - 1e-9) {
      updateTilt(tilt, SIM_DT);
      const evs = stepSim(sim, SIM_DT, gravityInMachine(tilt.current));
      for (const e of evs) events.push({ ...e, t });
      t += SIM_DT;
      if (onStep) onStep(sim, t, tilt);
      if (isWon(sim)) return { won: true, time: t, errors: [], sim, events };
      if (t >= maxTime) return { won: false, time: t, errors: [], sim, events };
    }
  }
  return { won: isWon(sim), time: t, errors: [], sim, events };
}

// Timers come from the reference solution, so they stay fair if the physics is retuned.
export function levelTimes(level, solutionTime) {
  const factor = level.timeFactor ?? 2.5;
  return {
    limit: Math.max(20, Math.ceil(solutionTime * factor + 10)),
    par: Math.ceil(solutionTime * 1.5 + 2),
    gold: Math.ceil(solutionTime + 1),
  };
}
