// Map editing for the level tools: remove dead-end grooves nobody uses, and redraw the
// junction they hung off (a T-junction becomes a straight or a curve, and so on).

import { compileMap } from '../prototype/src/grid.js';

const SIDES = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };
const GLYPH_SIDES = {
  '─': 'EW', '│': 'NS', '┘': 'NW', '└': 'EN', '┌': 'ES', '┐': 'SW',
  '┴': 'ENW', '├': 'ENS', '┬': 'ESW', '┤': 'NSW', '┼': 'ENSW',
  '╴': 'W', '╵': 'N', '╶': 'E', '╷': 'S',
};
const sortSides = (s) => [...s].sort().join('');
const GLYPH_OF = Object.fromEntries(Object.entries(GLYPH_SIDES).map(([g, s]) => [sortSides(s), g]));

// Remove the groove at a cell and redraw whatever it was joined to.
export function removeCell(map, [x, y, z]) {
  const rows = map.map((tier) => tier.map((row) => [...row]));
  rows[y][z][x] = '.';
  for (const [side, [dx, dz]] of Object.entries(SIDES)) {
    const nx = x + dx;
    const nz = z + dz;
    const ch = rows[y]?.[nz]?.[nx];
    const sides = GLYPH_SIDES[ch];
    if (!sides || !sides.includes(OPPOSITE[side])) continue;
    const left = sides.replace(OPPOSITE[side], '');
    // A groove left with one way in becomes a dead end.
    rows[y][nz][nx] = left.length === 1 ? '*' : GLYPH_OF[sortSides(left)];
  }
  return rows.map((tier) => tier.map((row) => row.join('')));
}

// Cells of a map holding a plain dead end (drawn `*` or as a stub).
export function deadEndCells(map) {
  const cells = [];
  map.forEach((tier, y) =>
    tier.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        if (ch === '*' || '╴╵╶╷'.includes(ch)) cells.push([x, y, z]);
      }),
    ),
  );
  return cells;
}

export function trimMap(map) {
  // Drop empty rows at the bottom of each tier and empty tiers at the top.
  const tiers = map.map((tier) => {
    const rows = [...tier];
    while (rows.length && /^[.\s]*$/.test(rows[rows.length - 1])) rows.pop();
    return rows;
  });
  while (tiers.length > 1 && !tiers[tiers.length - 1].length) tiers.pop();
  return tiers;
}

export { compileMap };
