import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../src/replay.js';
import { buildTrack } from '../src/track.js';

// A small test machine: an east-west groove crossed by nothing, with a goal at each end.
const corridor = (extra = {}) => ({
  marbles: [{ color: 'blue', at: [2, 0, 0] }],
  pieces: [
    ['goal', 0, 0, 0, 2, { color: 'blue' }],
    ['straight', 1, 0, 0],
    ['straight', 2, 0, 0],
    ['straight', 3, 0, 0],
    ['goal', 4, 0, 0, 0, { color: 'red' }],
  ],
  ...extra,
});

const blue = (run) => run.sim.marbles.find((m) => m.color === 'blue');

test('a marble rolls the way the machine is tilted', () => {
  const run = replay(corridor(), [['W', 3]], { maxTime: 3 });
  assert.equal(run.won, true);
});

test('tilting across a groove does not move its marble', () => {
  const run = replay(corridor(), [['N', 2], ['S', 2]], { maxTime: 4 });
  assert.ok(Math.abs(blue(run).pos[0] - 2.5) < 1e-6, `moved to x=${blue(run).pos[0]}`);
});

test('letting go stops a rolling marble within about a block', () => {
  let releasedAt = null;
  const run = replay(corridor(), [['E', 0.5], ['-', 2]], {
    maxTime: 2.5,
    onStep: (sim, t) => {
      if (releasedAt === null && t >= 0.5) releasedAt = sim.marbles[0].pos[0];
    },
  });
  const travelled = blue(run).pos[0] - releasedAt;
  assert.ok(travelled > 0 && travelled < 1.2, `coasted ${travelled.toFixed(2)} blocks`);
  assert.equal(blue(run).v, 0);
});

test('the wrong colour bounces out of a goal', () => {
  const run = replay(corridor(), [['E', 3]], { maxTime: 3 });
  assert.equal(run.won, false);
  assert.ok(run.events.some((e) => e.type === 'reject'));
  assert.equal(blue(run).delivered, false);
});

test('a ramp only works downhill, even against full tilt', () => {
  const level = {
    marbles: [{ color: 'blue', at: [2, 0, 0] }],
    pieces: [
      ['end', 1, 1, 0, 2],
      ['ramp', 2, 0, 0, 0],
      ['goal', 4, 0, 0, 0, { color: 'blue' }],
    ],
  };
  // The marble starts halfway down the ramp; tilting hard back uphill cannot stop it
  // reaching the bottom (x = 4, ground tier).
  assert.deepEqual(buildTrack(level).errors, []);
  const run = replay(level, [['W', 4]], { maxTime: 4 });
  const [x, y] = blue(run).pos;
  assert.ok(x > 3.85 && y < 1.0, `stuck at x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
});

const tee = {
  marbles: [{ color: 'blue', at: [1, 0, 2] }],
  pieces: [
    ['end', 1, 0, 2, 1],
    ['tee', 1, 0, 1, 2], // stem south, arms east and west
    ['goal', 0, 0, 1, 2, { color: 'blue' }],
    ['goal', 2, 0, 1, 0, { color: 'red' }],
  ],
};

test('at a T-junction a marble turns towards the downhill arm', () => {
  assert.deepEqual(buildTrack(tee).errors, []);
  assert.equal(replay(tee, [['NW', 3]], { maxTime: 3 }).won, true);
  const wrongWay = replay(tee, [['NE', 3]], { maxTime: 3 });
  assert.equal(wrongWay.won, false);
  assert.ok(wrongWay.events.some((e) => e.type === 'reject'));
});

test('at a T-junction with no downhill arm the marble stops at the wall', () => {
  const run = replay(tee, [['N', 3]], { maxTime: 3 });
  assert.equal(run.won, false);
  assert.ok(Math.abs(blue(run).pos[2] - 1.5) < 0.2, `stopped at z=${blue(run).pos[2]}`);
});

test('a diagonal tilt takes the turn instead of going straight', () => {
  const level = {
    marbles: [{ color: 'blue', at: [0, 0, 1] }],
    pieces: [
      ['end', 0, 0, 1, 2],
      ['tee', 1, 0, 1, 0], // arms west and east, stem north
      ['goal', 2, 0, 1, 0, { color: 'red' }],
      ['goal', 1, 0, 0, 3, { color: 'blue' }],
    ],
  };
  assert.equal(replay(level, [['NE', 3]], { maxTime: 3 }).won, true);
});

// Blue runs south through a gate. Red's east-west groove ends on the gate's plate,
// so red can hold the gate open while blue moves south.
const gated = {
  marbles: [
    { color: 'blue', at: [0, 0, 0] },
    { color: 'red', at: [1, 0, 0] },
  ],
  pieces: [
    ['end', 0, 0, 0, 3],
    ['gate', 0, 0, 1, 1, { link: 'A' }],
    ['goal', 0, 0, 2, 1, { color: 'blue' }],
    ['end', 1, 0, 0, 2],
    ['plate', 2, 0, 0, 0, { link: 'A' }],
    ['end', 2, 0, 2, 2],
    ['goal', 3, 0, 2, 0, { color: 'red' }],
  ],
  blocks: [[1, 0, 2]],
};

test('a closed gate blocks the groove', () => {
  assert.deepEqual(buildTrack(gated).errors, []);
  const run = replay(gated, [['S', 3]], { maxTime: 3 });
  assert.equal(run.sim.marbles[0].delivered, false);
  assert.ok(run.sim.marbles[0].pos[2] < 1.5, 'blue should wait north of the gate');
});

test('a marble resting on the plate holds the gate open', () => {
  const run = replay(gated, [['E', 1], ['S', 2]], { maxTime: 3 });
  assert.equal(run.sim.marbles[0].delivered, true);
  assert.ok(run.events.some((e) => e.type === 'gateOpen'));
});

test('marbles in one groove cannot pass through each other', () => {
  const level = {
    marbles: [
      { color: 'blue', at: [1, 0, 0] },
      { color: 'red', at: [2, 0, 0] },
    ],
    pieces: [
      ['goal', 0, 0, 0, 2, { color: 'red' }],
      ['straight', 1, 0, 0],
      ['straight', 2, 0, 0],
      ['goal', 3, 0, 0, 0, { color: 'blue' }],
    ],
  };
  const run = replay(level, [['E', 2], ['W', 2]], { maxTime: 4 });
  const [b, r] = run.sim.marbles;
  assert.equal(run.won, false);
  assert.ok(b.pos[0] < r.pos[0], 'blue should still be west of red');
});

test('an open groove end is reported as a level error', () => {
  const track = buildTrack({ marbles: [], pieces: [['straight', 0, 0, 0]] });
  assert.ok(track.errors.some((e) => e.startsWith('Open groove end')));
});

test('raised pieces get support blocks underneath', () => {
  const track = buildTrack({
    marbles: [],
    pieces: [['end', 0, 2, 0, 0], ['end', 1, 2, 0, 2]],
  });
  const supports = track.pieces.filter((p) => p.type === 'block');
  assert.equal(supports.length, 4);
});

test('a machine in separate parts is reported as a level error', () => {
  const track = buildTrack({
    marbles: [],
    pieces: [['end', 0, 0, 0, 2], ['end', 1, 0, 0, 0], ['end', 4, 0, 0, 2], ['end', 5, 0, 0, 0]],
  });
  assert.ok(track.errors.some((e) => e.includes('2 separate parts')));
});

test('a marble resting at a T-junction rolls into the branch you tilt towards', () => {
  // Blue sits just west of the junction centre, on the east-west groove. Tilting north,
  // straight across its own groove, must still send it up the north branch.
  const level = {
    marbles: [{ color: 'blue', at: [1, 0, 1], s: 0.3 }],
    pieces: [
      ['end', 0, 0, 1, 2],
      ['tee', 1, 0, 1, 0], // arms west and east, stem north
      ['end', 2, 0, 1, 0],
      ['goal', 1, 0, 0, 3, { color: 'blue' }],
    ],
  };
  assert.deepEqual(buildTrack(level).errors, []);
  assert.equal(replay(level, [['N', 3]], { maxTime: 3 }).won, true);
});

test('a marble away from the junction still ignores tilt across its groove', () => {
  const level = {
    marbles: [{ color: 'blue', at: [0, 0, 1] }],
    pieces: [
      ['end', 0, 0, 1, 2],
      ['tee', 1, 0, 1, 0],
      ['end', 2, 0, 1, 0],
      ['goal', 1, 0, 0, 3, { color: 'blue' }],
    ],
  };
  const run = replay(level, [['N', 3]], { maxTime: 3 });
  assert.equal(run.won, false);
  assert.ok(Math.abs(run.sim.marbles[0].pos[0] - 0.35) < 1e-6);
});
