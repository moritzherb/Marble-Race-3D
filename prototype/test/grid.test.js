import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileMap } from '../src/grid.js';
import { LEVELS } from '../src/levels.js';

const sorted = (pieces) => pieces.map((p) => JSON.stringify([p[0], p[1], p[2], p[3], p[4] ?? 0, p[5] ?? {}])).sort();
const piecesOf = (id) => LEVELS.find((l) => l.id === id).pieces;

test('a drawn map gives the same pieces as the hand-written list (one tier)', () => {
  const { pieces, errors } = compileMap({ map: [['.....', '....b', '....│', '╶───┘']] });
  assert.deepEqual(errors, []);
  assert.deepEqual(sorted(pieces), sorted(piecesOf('first-tilt')));
});

test('a drawn map gives the same pieces as the hand-written list (ramps, plate, gate, crossing)', () => {
  const { pieces, errors } = compileMap({
    map: [
      ['..╷..', '..│..', '..│..', 'v.1..', 'vg┼─╴', 'b.o..'],
      ['.....', '.....', '┌───A', '~....', '~....'],
    ],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(sorted(pieces), sorted(piecesOf('underpass')));
});

test('ramps drawn pointing west and north anchor at their high end', () => {
  const { pieces, errors } = compileMap({
    map: [
      ['b<<.', 'o...', '^...', '^...'],
      ['.~~╴', '....', '~...', '~...', '╵...'],
    ],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    sorted(pieces.filter((p) => p[0] === 'ramp' || p[0] === 'goal')),
    sorted([
      ['goal', 0, 0, 0, 2, { color: 'blue' }],
      ['ramp', 2, 0, 0, 2],
      ['goal', 0, 0, 1, 3, { color: 'orange' }],
      ['ramp', 0, 0, 3, 3],
    ]),
  );
});

test('a goal with no groove leading in is reported', () => {
  const { errors } = compileMap({ map: [['b..', '.╶╴']] });
  assert.equal(errors.length, 1);
});

test('banded goals get their link', () => {
  const { pieces } = compileMap({ map: [['╶─b']], bands: { blue: 'A' } });
  assert.deepEqual(pieces[2], ['goal', 2, 0, 0, 0, { color: 'blue', link: 'A' }]);
});
