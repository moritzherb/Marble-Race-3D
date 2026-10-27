import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import { buildTrack } from '../src/track.js';
import { replay, levelTimes } from '../src/replay.js';

test('level ids are unique', () => {
  const ids = LEVELS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
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
    assert.ok(times.limit >= 20 && times.limit <= 45, `time limit ${times.limit}s is outside 20-45s`);
  });

  for (const [t, trap] of (level.traps || []).entries()) {
    test(`${i + 1}. ${level.name}: trap ${t + 1} does not win`, () => {
      assert.equal(replay(level, trap, { maxTime: 40 }).won, false);
    });
  }
}
