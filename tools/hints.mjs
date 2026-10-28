// Builds the Hint power-up's tables: every position each level can reach by whole moves,
// with the best next direction (see prototype/src/hints.js for the format).
//
//   node tools/hints.mjs            all levels
//   node tools/hints.mjs 12 13      just these (level numbers or ids)
//
// Re-run it after changing a level or the physics; `npm test` checks the tables still match.

import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS } from '../prototype/src/levels.js';
import { DIRS } from '../prototype/src/moves.js';
import { hashKey, encodeTable, DEAD } from '../prototype/src/hints.js';
import { explore } from './audit.mjs';

const MAX_STATES = 30000;
const out = new URL('../prototype/hints/', import.meta.url);
mkdirSync(out, { recursive: true });

export function buildTable(level) {
  const r = explore(level, MAX_STATES, { graph: true });
  if (r.errors) throw new Error(`${level.id}: ${r.errors.join('; ')}`);
  const { keys, next, toWin, win } = r.graph;
  const byHash = new Map();
  let clashes = 0;
  keys.forEach((key, i) => {
    let value;
    if (toWin[i] < Infinity) {
      let best = 0;
      let bestLeft = Infinity;
      next[i].forEach((j, x) => {
        const left = j === win ? 0 : toWin[j];
        if (left < bestLeft) {
          bestLeft = left;
          best = x;
        }
      });
      value = best | (Math.min(31, toWin[i]) << 3);
    } else if (r.complete) {
      value = DEAD;
    } else {
      return; // unexplored corners of a capped search: say nothing rather than "dead"
    }
    const h = hashKey(key);
    if (byHash.has(h) && byHash.get(h) !== value) {
      byHash.set(h, null); // two positions share a hash: drop it rather than risk a wrong hint
      clashes++;
    } else if (!byHash.has(h)) byHash.set(h, value);
  });
  const entries = [...byHash].filter(([, v]) => v !== null);
  return { v: 1, level: level.id, complete: r.complete, minMoves: r.minMoves, positions: r.positions, clashes, data: encodeTable(entries) };
}

if (process.argv[1]?.endsWith('hints.mjs')) {
  const args = process.argv.slice(2);
  const targets = args.length ? args.map((a) => (/^\d+$/.test(a) ? LEVELS[Number(a) - 1] : LEVELS.find((l) => l.id === a))) : LEVELS;
  for (const level of targets) {
    const t0 = Date.now();
    const table = buildTable(level);
    writeFileSync(new URL(`${level.id}.json`, out), JSON.stringify(table) + '\n');
    const n = LEVELS.indexOf(level) + 1;
    console.log(`${n}. ${level.name}: ${table.positions} positions, ${table.complete ? 'complete' : 'CAPPED'}, ${table.clashes} clashes, ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  if (DIRS.length !== 8) throw new Error('direction encoding assumes 8 directions');
}
