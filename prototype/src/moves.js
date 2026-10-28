// Whole moves for the solver and the in-game hint: tilt one of 8 directions and hold until
// every marble has stopped, then let go. The hint tables in prototype/hints/ were built with
// exactly this function, so the game and the tools must share it.

import { stepSim, isWon, isLost } from './sim.js';
import { createTilt, updateTilt, gravityInMachine, directionVector } from './tilt.js';
import { SIM_DT } from './config.js';

export const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function cloneSim(sim) {
  return {
    ...sim,
    marbles: sim.marbles.map((m) => ({ ...m, pos: [...m.pos], tangent: [...m.tangent] })),
    goals: sim.goals.map((g) => ({ ...g })),
    plates: sim.plates.map((p) => ({ ...p })),
    gates: sim.gates.map((g) => ({ ...g })),
  };
}

// A position: where each marble is, to a tenth of a block (D home, L lost).
export const stateKey = (sim) => sim.marbles.map((m) => (m.delivered ? 'D' : m.lost ? 'L' : `${m.edge}:${Math.round(m.s * 10)}`)).join('|');
// Everything has stopped: no marble moved more than a hair in the last tenth of a second.
// (Positions, not speeds: two marbles pressed together in a curve jiggle forever.)
function settleWatch(sim) {
  let mark = sim.marbles.map((m) => [...m.pos]);
  let since = 0;
  return (dt) => {
    since += dt;
    if (since < 0.1) return false;
    const moved = sim.marbles.some((m, i) => !m.delivered && !m.lost && Math.hypot(m.pos[0] - mark[i][0], m.pos[1] - mark[i][1], m.pos[2] - mark[i][2]) > 0.02);
    mark = sim.marbles.map((m) => [...m.pos]);
    since = 0;
    return !moved;
  };
}

// Tilt `dir` until everything stops, then let go until everything stops again.
// (When everything has already stopped under the tilt, letting go changes nothing, so
// that part is skipped.)
export function macro(sim, dir) {
  const s = cloneSim(sim);
  const tilt = createTilt();
  tilt.target = directionVector(dir);
  tilt.holding = true;
  let t = 0;
  let won = false;
  let calm = false;
  let settled = settleWatch(s);
  while (t < 4.5) {
    updateTilt(tilt, SIM_DT);
    stepSim(s, SIM_DT, gravityInMachine(tilt.current));
    t += SIM_DT;
    if (isWon(s)) {
      won = true;
      break;
    }
    if (isLost(s)) return { sim: s, won: false, lost: true, hold: t, time: t };
    if (settled(SIM_DT) && t > 0.3) {
      calm = true;
      break;
    }
  }
  const hold = t;
  if (!won && calm) {
    for (const m of s.marbles) m.v = 0;
    return { sim: s, won, hold, time: t };
  }
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
      if (isLost(s)) return { sim: s, won: false, lost: true, hold, time: t };
      if (settled(SIM_DT) && Math.hypot(...tilt.current) < 0.005) break;
    }
  }
  return { sim: s, won, hold, time: t };
}
