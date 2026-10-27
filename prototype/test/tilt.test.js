import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistDirection, createTilt, updateTilt } from '../src/tilt.js';
import { SIM_DT } from '../src/config.js';

const angleOf = ([x, z]) => Math.round(((Math.atan2(z, x) * 180) / Math.PI + 360) % 360);
const at = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

test('direction assist snaps to groove directions and diagonals', () => {
  assert.equal(angleOf(assistDirection(at(20))), 0);
  assert.equal(angleOf(assistDirection(at(40))), 45);
  assert.equal(angleOf(assistDirection(at(100))), 90);
  assert.equal(angleOf(assistDirection(at(-50))), 315);
});

test('direction assist sticks near a zone boundary instead of flicking', () => {
  // 33° is just inside the diagonal zone, but coming from east it stays east...
  assert.equal(angleOf(assistDirection(at(33), at(0))), 0);
  // ...until the finger is clearly past the boundary.
  assert.equal(angleOf(assistDirection(at(40), at(0))), 45);
});

test('the tilt spring reaches its target quickly without overshooting', () => {
  const tilt = createTilt();
  tilt.target = [1, 0];
  tilt.holding = true;
  let peak = 0;
  for (let t = 0; t < 0.3; t += SIM_DT) {
    updateTilt(tilt, SIM_DT);
    peak = Math.max(peak, tilt.current[0]);
  }
  assert.ok(tilt.current[0] > 0.95, `only reached ${tilt.current[0].toFixed(2)} after 0.3 s`);
  assert.ok(peak <= 1.0001, `overshot to ${peak}`);
});
