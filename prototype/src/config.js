// Tuning values for the rail physics and controls.
// Units: 1 = one wooden block. Times are in seconds.
// The tuning panel in the game edits this object live, so read it every frame.

export const PHYSICS = {
  gravity: 30,          // blocks/s². Real 5 cm blocks would be ~196; lower = slower, more readable marbles.
  rollFactor: 5 / 7,    // a rolling solid ball accelerates at 5/7 of a sliding one.
  maxTiltDeg: 20,       // how far the machine can tilt. Below the ramp angle (26.6°) so ramps stay one-way.
  dragMoving: 1.4,      // air/wood drag while gravity pushes the marble along its groove.
  dragBraking: 6.0,     // drag when nothing pushes it along its groove: this is the "let go to stop" brake.
  rollingResistance: 0.4, // constant slowdown; also stops marbles creeping on a nearly level machine.
  maxSpeed: 6,          // blocks/s safety cap.
  wallBounce: 0.25,     // fraction of speed kept when bouncing off a dead end or closed gate.
  marbleBounce: 0.5,    // fraction of speed kept in marble-to-marble hits.
  rejectSpeed: 1.6,     // speed a marble is pushed back with when it enters the wrong colour's goal.
  turnBias: 0.05,       // at a T-junction, how much a turn is preferred over going straight (in sin of tilt).
};

export const CONTROLS = {
  tiltResponse: 26,     // how briskly the machine follows your finger (spring stiffness, 1/s).
  releaseResponse: 22,  // how briskly it settles back to level when you let go.
  dragForFullTilt: 0.18, // fraction of the screen's short side you drag for full tilt.
  directionAssist: true, // snap tilt to the 4 groove directions and 4 diagonals.
};

export const MARBLE_RADIUS = 0.15;
export const SIM_DT = 1 / 120;
