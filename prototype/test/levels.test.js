import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import { buildTrack } from '../src/track.js';
import { replay, levelTimes } from '../src/replay.js';

test('level ids are unique', () => {
  const ids = LEVELS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('an extra-hard level comes every 5 to 10 levels after the first ten', () => {
  const hard = LEVELS.map((l, i) => (l.hard ? i + 1 : null)).filter(Boolean);
  assert.ok(hard.length >= 9, `only ${hard.length} hard levels`);
  assert.ok(hard[0] > 10 && hard[0] <= 20, `the first hard level is ${hard[0]}`);
  hard.slice(1).forEach((n, k) => assert.ok(n - hard[k] >= 5 && n - hard[k] <= 10, `hard levels ${hard[k]} and ${n}`));
  assert.ok(100 - hard.at(-1) <= 10, `the last hard level is ${hard.at(-1)}`);
});

for (const [i, level] of LEVELS.entries()) {
  test(`${i + 1}. ${level.name}: builds without errors`, () => {
    assert.deepEqual(buildTrack(level).errors, []);
  });

  test(`${i + 1}. ${level.name}: the reference solution wins inside the gold time`, () => {
    const run = replay(level);
    assert.equal(run.won, true, 'reference solution did not deliver every marble');
    const times = levelTimes(level, run.time);
    assert.ok(run.time <= times.gold, `took ${run.time.toFixed(2)}s, gold is ${times.gold}s`);
    assert.equal(times.limit, 20);
    // Room for a person: the expert run leaves at least six seconds on the clock.
    assert.ok(run.time <= 14, `the reference run takes ${run.time.toFixed(1)}s of the 20`);
  });

  // A gate nobody ever reaches is decoration, not a lock (the audit checks it matters).
  test(`${i + 1}. ${level.name}: a marble reaches every gate`, () => {
    const track = buildTrack(level);
    const reached = new Set();
    for (const run of [level.solution, ...(level.traps || [])]) {
      replay(level, run, {
        maxTime: 60,
        onStep: (sim) => {
          for (const m of sim.marbles) reached.add(m.edge);
        },
      });
    }
    for (const gate of track.gates) assert.ok(reached.has(gate.edge), `gate ${track.pieces[gate.piece].label} is never reached`);
  });

  for (const [t, trap] of (level.traps || []).entries()) {
    test(`${i + 1}. ${level.name}: trap ${t + 1} does not win`, () => {
      assert.equal(replay(level, trap, { maxTime: 40 }).won, false);
    });
  }
}
