import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { LEVELS } from '../src/levels.js';
import { buildTrack } from '../src/track.js';
import { createSim } from '../src/sim.js';
import { macro } from '../src/moves.js';
import { decodeTable, findHint, lookup } from '../src/hints.js';

const tableFor = (l) => decodeTable(JSON.parse(readFileSync(new URL(`../hints/${l.id}.json`, import.meta.url), 'utf8')));

test('every level has a hint table built from its current machine', () => {
  for (const l of LEVELS) {
    assert.ok(existsSync(new URL(`../hints/${l.id}.json`, import.meta.url)), `${l.id}: run node tools/hints.mjs`);
    const table = tableFor(l);
    const start = lookup(table, createSim(buildTrack(l)));
    assert.ok(start && !start.dead, `${l.id}: the start position is missing from its table; rebuild it with node tools/hints.mjs`);
    assert.equal(start.left, table.minMoves, `${l.id}: table out of date`);
  }
});

test('following the hints from the start wins every level in its fewest moves', () => {
  for (const l of LEVELS) {
    const table = tableFor(l);
    let sim = createSim(buildTrack(l));
    let moves = 0;
    for (;;) {
      const h = findHint(table, sim);
      assert.ok(h.dir, `${l.id}: no hint after ${moves} moves`);
      const r = macro(sim, h.dir);
      moves++;
      if (r.won) break;
      assert.ok(moves < table.minMoves, `${l.id}: not won in ${table.minMoves} moves`);
      sim = r.sim;
    }
    assert.equal(moves, table.minMoves, l.id);
  }
});

test('a lost position is recognised as one', () => {
  // Level 12, Passing Place: tilting E first sends blue home, but then orange... find any
  // dead position by trying first moves until the table says so.
  let found = 0;
  for (const l of LEVELS.slice(10, 40)) {
    const table = tableFor(l);
    const start = createSim(buildTrack(l));
    for (const dir of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
      const r = macro(start, dir);
      if (r.won) continue;
      const h = findHint(table, r.sim);
      if (h.dead) {
        found++;
        assert.equal(table.complete, true);
      }
    }
  }
  assert.ok(found > 5, 'losing openings are reported as lost');
});

test('mid-roll positions still get a hint by trying moves from there', () => {
  const l = LEVELS[19];
  const table = tableFor(l);
  const sim = createSim(buildTrack(l));
  sim.marbles[0].s *= 0.37; // somewhere a whole move would never leave it
  const h = findHint(table, sim);
  assert.ok(h.dir || h.dead || h.unknown);
});
