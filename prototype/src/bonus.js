// The coin multiplier after a win: watch an ad, and the pointer lands on one of the
// segments (x2, x3, x5, x3, x2). Low multipliers are more likely: see ECONOMY.winMultiplier.

import { ECONOMY } from './economy.js';

// A multiplier, drawn with the configured chances.
export function pickMultiplier(rand = Math.random, config = ECONOMY.winMultiplier) {
  const entries = Object.entries(config.chances).map(([m, p]) => [Number(m), p]);
  const total = entries.reduce((sum, [, p]) => sum + p, 0);
  let r = rand() * total;
  for (const [m, p] of entries) {
    r -= p;
    if (r < 0) return m;
  }
  return entries[entries.length - 1][0];
}

// Which segment of the bar the pointer stops on for multiplier `m` (one of the matching
// segments, at random).
export function segmentFor(m, rand = Math.random, config = ECONOMY.winMultiplier) {
  const matches = config.segments.map((s, i) => (s === m ? i : -1)).filter((i) => i >= 0);
  return matches[Math.min(matches.length - 1, Math.floor(rand() * matches.length))];
}
