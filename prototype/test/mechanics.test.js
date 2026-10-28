// The newer pieces: crossings as junctions, colour filters, portals, stairways, whirls and
// sky rails. Each test builds a small machine from a text map (see grid.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileMap } from '../src/grid.js';
import { buildTrack } from '../src/track.js';
import { replay } from '../src/replay.js';

const level = (map, marbles, extra = {}) => {
  const def = { map, marbles, ...extra };
  const c = compileMap(def);
  return { ...def, pieces: c.pieces, blocks: c.blocks, mapErrors: c.errors };
};
const errorsOf = (l) => buildTrack(l).errors;
const marble = (run, color) => run.sim.marbles.find((m) => m.color === color);

// ---------- Crossings ----------

const crossroads = (s = 0) =>
  level(
    [['..b..', '..│..', '*─┼─o', '..│..', '..*..']],
    [{ color: 'orange', at: [2, 0, 2], s }],
  );

test('a marble stopped in a crossing rolls the way you tilt, even across its groove', () => {
  assert.deepEqual(errorsOf(crossroads()), []);
  // It starts in the middle of the crossing (on its west arm): tilting east sends it home.
  assert.equal(replay(crossroads(0), [['E', 2]], { maxTime: 2 }).won, true);
});

test('a marble near the middle of a crossing turns into the arm you tilt towards', () => {
  // On the west arm, 0.15 from the middle: a north tilt takes it up the north arm.
  const l = level([['..b..', '..│..', '*─┼─o', '..│..', '..*..']], [{ color: 'blue', at: [2, 0, 2], s: 0.3 }]);
  assert.equal(replay(l, [['N', 2]], { maxTime: 2 }).won, true);
});

test('a marble rolling through a crossing goes straight on when the tilt is along its groove', () => {
  const l = level([['..b..', '..│..', '*─┼─o', '..│..', '..*..']], [{ color: 'blue', at: [2, 0, 4] }]);
  assert.equal(replay(l, [['N', 3]], { maxTime: 3 }).won, true);
});

// ---------- Colour filters ----------

test('a colour filter lets its own colour through', () => {
  const l = level([['*─ⓑ─b']], [{ color: 'blue', at: [1, 0, 0] }]);
  assert.deepEqual(errorsOf(l), []);
  assert.equal(replay(l, [['E', 3]], { maxTime: 3 }).won, true);
});

test('a colour filter stops every other colour, like a closed gate', () => {
  const l = level([['*─ⓑ─o']], [{ color: 'orange', at: [1, 0, 0] }]);
  const run = replay(l, [['E', 3]], { maxTime: 3 });
  assert.equal(run.won, false);
  assert.ok(marble(run, 'orange').pos[0] < 2.5, 'orange got past the blue filter');
});

// ---------- Portals ----------

test('a marble that rolls into a portal comes out of its twin, moving away from it', () => {
  const l = level([['*─%#%─b']], [{ color: 'blue', at: [1, 0, 0] }]);
  assert.deepEqual(errorsOf(l), []);
  const xs = [];
  const run = replay(l, [['E', 3]], { maxTime: 3, onStep: (sim) => xs.push(sim.marbles[0].pos[0]) });
  assert.equal(run.won, true);
  assert.ok(!xs.some((x) => x > 2.6 && x < 4.4), 'the marble should never be between the portals');
});

test('a portal without a twin is a level error', () => {
  assert.match(errorsOf(level([['*─%#&─b']], [{ color: 'blue', at: [1, 0, 0] }])).join(' '), /Portal pair/);
});

// ---------- Stairways ----------

const stairway = (at) => level([['*─⇒⇒..'], ['..~~─b']], [{ color: 'blue', at }]);

test('a stairway carries a marble up a tier, whatever the tilt', () => {
  assert.deepEqual(errorsOf(stairway([1, 0, 0])), []);
  let highest = 0;
  const run = replay(stairway([1, 0, 0]), [['E', 0.5], ['N', 2.2], ['E', 2]], {
    maxTime: 5,
    onStep: (sim, t) => {
      if (t < 2.7) highest = Math.max(highest, sim.marbles[0].pos[1]);
    },
  });
  assert.ok(highest > 1.9, `only reached y=${highest.toFixed(2)} while tilted across`);
  assert.equal(run.won, true);
});

test('a stairway only goes up: a marble rolling in from the top is pushed back out', () => {
  let lowest = Infinity;
  const run = replay(stairway([4, 1, 0]), [['W', 4]], { maxTime: 4, onStep: (sim) => (lowest = Math.min(lowest, sim.marbles[0].pos[1])) });
  assert.ok(lowest > 1.5, `went down to y=${lowest.toFixed(2)}`);
  assert.ok(run.events.some((e) => e.type === 'liftBack'), 'the game is told so it can show it');
});

test('climbing a stairway the normal way is not reported as being turned back', () => {
  const run = replay(stairway([1, 0, 0]), [['E', 0.5], ['N', 2.2], ['E', 2]], { maxTime: 5 });
  assert.ok(!run.events.some((e) => e.type === 'liftBack'));
});

// ---------- Whirls ----------

const whirl = (marbles) => level([['..~─b'], ['*─@..']], marbles);

test('a whirl takes a marble down through its hole and out of the block below', () => {
  assert.deepEqual(errorsOf(whirl([{ color: 'blue', at: [1, 1, 0] }])), []);
  assert.equal(replay(whirl([{ color: 'blue', at: [1, 1, 0] }]), [['E', 4]], { maxTime: 4 }).won, true);
});

test('a whirl is one-way: tilting back cannot lift a marble out of the funnel', () => {
  const run = replay(whirl([{ color: 'blue', at: [2, 1, 0], s: 0.3 }]), [['W', 3]], { maxTime: 3 });
  assert.ok(marble(run, 'blue').pos[1] < 1, 'the marble should have dropped to the lower tier');
});

test('a whirl needs a way out of the block under it', () => {
  assert.match(errorsOf(level([['..~.b'], ['*─@..']], [{ color: 'blue', at: [1, 1, 0] }])).join(' '), /no groove leading out/);
});

// ---------- Sky rails ----------

const bridge = (marbles) => level([['##..##'], ['b─━━─*']], marbles);

test('a marble kept rolling crosses a sky rail', () => {
  assert.deepEqual(errorsOf(bridge([{ color: 'blue', at: [4, 1, 0] }])), []);
  assert.equal(replay(bridge([{ color: 'blue', at: [4, 1, 0] }]), [['W', 3]], { maxTime: 3 }).won, true);
});

test('a marble that stops over the gap falls and is lost', () => {
  const run = replay(bridge([{ color: 'blue', at: [4, 1, 0] }]), [['W', 0.32], ['-', 2]], { maxTime: 3 });
  assert.equal(run.won, false);
  assert.equal(run.lost, true);
  assert.ok(run.events.some((e) => e.type === 'fall'));
});

test('stopping over a groove drops the marble into it: the way down to a lower tier', () => {
  const l = level([['..╷', '..│', '..b'], ['*─╸']], [{ color: 'blue', at: [1, 1, 0] }]);
  assert.deepEqual(errorsOf(l), []);
  const run = replay(l, [['E', 1.5], ['S', 2]], { maxTime: 4 });
  assert.ok(run.events.some((e) => e.type === 'drop'), 'no drop');
  assert.equal(run.won, true);
});

test('a marble may not start on a sky rail, and nothing may rest on one', () => {
  assert.match(errorsOf(bridge([{ color: 'blue', at: [2, 1, 0] }])).join(' '), /starts on a sky rail/);
  assert.match(errorsOf(level([['##..##'], ['b─━━─*'], ['..#...']], [{ color: 'blue', at: [4, 1, 0] }])).join(' '), /rests on the sky rail/);
});
