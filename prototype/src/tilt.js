// The machine's tilt, shared by the game and the tests so both behave identically.
//
// A tilt is a 2D vector on the ground plane (x = east, z = south). Its direction is
// the way marbles roll ("downhill") and its length (0..1) is the fraction of max tilt.

import { PHYSICS, CONTROLS } from './config.js';

const DIRS = {
  E: [1, 0],
  W: [-1, 0],
  S: [0, 1],
  N: [0, -1],
  NE: [Math.SQRT1_2, -Math.SQRT1_2],
  NW: [-Math.SQRT1_2, -Math.SQRT1_2],
  SE: [Math.SQRT1_2, Math.SQRT1_2],
  SW: [-Math.SQRT1_2, Math.SQRT1_2],
};

export function directionVector(name, amount = 1) {
  if (!name || name === '-') return [0, 0];
  const d = DIRS[name];
  if (!d) throw new Error(`Unknown tilt direction "${name}"`);
  return [d[0] * amount, d[1] * amount];
}

// Snap a tilt to the nearest groove direction or diagonal. Groove directions get wider
// catch zones (62°) than diagonals (28°) so a slightly-off drag still moves one axis only.
export function assistDirection([x, z]) {
  const m = Math.hypot(x, z);
  if (m < 1e-6) return [0, 0];
  const angle = Math.atan2(z, x); // 0 = east, +90° = south
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  const axisHalfWidth = 31;
  for (const axis of [0, 90, 180, 270, 360]) {
    if (Math.abs(deg - axis) <= axisHalfWidth) {
      const a = (axis * Math.PI) / 180;
      return [Math.cos(a) * m, Math.sin(a) * m];
    }
  }
  const diag = Math.round((deg - 45) / 90) * 90 + 45;
  const a = (diag * Math.PI) / 180;
  return [Math.cos(a) * m, Math.sin(a) * m];
}

export function createTilt() {
  return { current: [0, 0], target: [0, 0], holding: false };
}

export function updateTilt(tilt, dt) {
  const tau = tilt.holding ? CONTROLS.tiltEase : CONTROLS.releaseEase;
  const k = 1 - Math.exp(-dt / tau);
  tilt.current[0] += (tilt.target[0] - tilt.current[0]) * k;
  tilt.current[1] += (tilt.target[1] - tilt.current[1]) * k;
}

// Gravity in the machine's own coordinates. Tilting the machine by angle θ towards d
// is the same, for the marbles, as gravity leaning by θ towards d.
export function gravityInMachine(tiltVec) {
  const m = Math.min(1, Math.hypot(tiltVec[0], tiltVec[1]));
  const g = PHYSICS.gravity;
  if (m < 1e-6) return [0, -g, 0];
  const theta = (m * PHYSICS.maxTiltDeg * Math.PI) / 180;
  const dx = tiltVec[0] / Math.hypot(tiltVec[0], tiltVec[1]);
  const dz = tiltVec[1] / Math.hypot(tiltVec[0], tiltVec[1]);
  return [g * dx * Math.sin(theta), -g * Math.cos(theta), g * dz * Math.sin(theta)];
}

// Axis and angle that rotate the machine so its downhill side is d.
export function machineRotation(tiltVec) {
  const m = Math.min(1, Math.hypot(tiltVec[0], tiltVec[1]));
  if (m < 1e-6) return { axis: [1, 0, 0], angle: 0 };
  const dx = tiltVec[0] / Math.hypot(tiltVec[0], tiltVec[1]);
  const dz = tiltVec[1] / Math.hypot(tiltVec[0], tiltVec[1]);
  // up × d = (dz, 0, -dx): rotating about it lowers the side facing d.
  return { axis: [dz, 0, -dx], angle: (m * PHYSICS.maxTiltDeg * Math.PI) / 180 };
}
