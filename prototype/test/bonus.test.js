import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickMultiplier, segmentFor } from '../src/bonus.js';
import { ECONOMY } from '../src/economy.js';

const config = ECONOMY.winMultiplier;

test('the multiplier follows the configured chances: low ones are most likely', () => {
  const counts = { 2: 0, 3: 0, 5: 0 };
  const n = 10000;
  for (let i = 0; i < n; i++) counts[pickMultiplier(() => (i + 0.5) / n)]++;
  for (const [m, p] of Object.entries(config.chances)) assert.ok(Math.abs(counts[m] / n - p) < 0.002, `x${m}: ${counts[m]}`);
  assert.ok(counts[2] > counts[3] && counts[3] > counts[5]);
});

test('every multiplier that can be drawn has a segment on the bar, and the pointer lands on one', () => {
  for (const m of Object.keys(config.chances).map(Number)) {
    for (const r of [0, 0.49, 0.5, 0.999]) assert.equal(config.segments[segmentFor(m, () => r)], m);
  }
});

test('a random draw always gives one of the multipliers', () => {
  for (let i = 0; i < 200; i++) assert.ok([2, 3, 5].includes(pickMultiplier()));
});
