// Levels drawn as text. Each tier of the machine is a list of rows (north at the top,
// one character per block), and this turns the drawing into the piece list that
// buildTrack() reads, so a level file shows the machine's shape at a glance.
//
//   ─ │                 straight groove
//   ┌ ┐ └ ┘             curve, joining the two sides its lines reach
//   ┬ ┴ ├ ┤             T-junction
//   ┼                   crossing (an open square: marbles go straight on or turn with the tilt)
//   ╴ ╵ ╶ ╷             dead end, open on the side its stub points to
//   *                   dead end, open towards whichever groove leads into it
//   b o g p r           goal for the blue, orange, green, purple or red marble
//   A B C               weight plate for link A, B or C
//   1 2 3               gate opened by link A, B or C
//   x y z               shutter for link A, B or C: open until that link is powered, then shut
//   > < v ^             ramp, drawn on both of its cells on the lower tier, pointing downhill
//   ⇒ ⇐ ⇓ ⇑             stairway, drawn on both of its cells on the lower tier, pointing up the
//                       stairs (the way it carries marbles)
//   ~                   a cell taken by a ramp or stairway from the tier below, or the block
//                       under a whirl
//   ⓑ ⓞ ⓖ ⓟ ⓡ           colour filter: only the blue (orange, green, purple, red) marble gets through
//   % &                 portal: the two cells with the same sign are a pair
//   ━ ┃                 sky rail: a marble hangs from a magnetic beam over a gap
//   ╸ ╹ ╺ ╻             end of a sky rail, open on the side its stub points to
//   @                   whirl: a funnel fed from the grooves that lead into it on this tier;
//                       the marble drops into the block below (drawn ~) and leaves it through
//                       the grooves that lead out of that block
//   #                   plain block
//   .                   empty
//
// Goals, plates and gates open towards whichever neighbours connect to them.
// level.bands gives goals that also act as plates, e.g. { blue: 'A' }.

const SIDES = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };

const GROOVES = {
  '─': ['straight', 0, 'WE'],
  '│': ['straight', 1, 'NS'],
  '┘': ['curve', 0, 'WN'],
  '└': ['curve', 1, 'NE'],
  '┌': ['curve', 2, 'ES'],
  '┐': ['curve', 3, 'SW'],
  '┴': ['tee', 0, 'WEN'],
  '├': ['tee', 1, 'NSE'],
  '┬': ['tee', 2, 'EWS'],
  '┤': ['tee', 3, 'SNW'],
  '┼': ['cross', 0, 'NESW'],
  '╴': ['end', 0, 'W'],
  '╵': ['end', 1, 'N'],
  '╶': ['end', 2, 'E'],
  '╷': ['end', 3, 'S'],
  '━': ['sky', 0, 'WE'],
  '┃': ['sky', 1, 'NS'],
  '╸': ['skyEnd', 0, 'W'],
  '╹': ['skyEnd', 1, 'N'],
  '╺': ['skyEnd', 2, 'E'],
  '╻': ['skyEnd', 3, 'S'],
};
const GOALS = { b: 'blue', o: 'orange', g: 'green', p: 'purple', r: 'red' };
const PLATES = { A: 'A', B: 'B', C: 'C' };
const GATES = { 1: 'A', 2: 'B', 3: 'C', x: 'A', y: 'B', z: 'C' };
const SHUTTERS = new Set(['x', 'y', 'z']);
const RAMPS = { '>': ['E', 0], 'v': ['S', 1], '<': ['W', 2], '^': ['N', 3] };
const STAIRS = { '⇒': ['E', 0], '⇓': ['S', 1], '⇐': ['W', 2], '⇑': ['N', 3] };
const FILTERS = { 'ⓑ': 'blue', 'ⓞ': 'orange', 'ⓖ': 'green', 'ⓟ': 'purple', 'ⓡ': 'red' };
const PORTALS = { '%': '1', '&': '2' };
const DEAD_END_ROTATION = { W: 0, N: 1, E: 2, S: 3 };

export function compileMap(level) {
  const pieces = [];
  const blocks = [];
  const errors = [];
  const tiers = level.map;
  const at = (x, y, z) => tiers[y]?.[z]?.[x] ?? '.';
  const key = (x, y, z) => `${x},${y},${z}`;

  // Ramps first. Each ramp also opens a side on the cells at its two ends.
  const rampCells = new Set();
  const rampEnds = new Map();
  const addEnd = (x, y, z, side) => {
    const k = key(x, y, z);
    if (!rampEnds.has(k)) rampEnds.set(k, new Set());
    rampEnds.get(k).add(side);
  };
  tiers.forEach((rows, y) =>
    rows.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        if (!(RAMPS[ch] || STAIRS[ch]) || rampCells.has(key(x, y, z))) return;
        const stairs = Boolean(STAIRS[ch]);
        const [dir, r] = stairs ? STAIRS[ch] : RAMPS[ch];
        const [dx, dz] = SIDES[dir];
        const [px, pz] = [x + Math.abs(dx), z + Math.abs(dz)]; // its other cell, east or south of this one
        if (at(px, y, pz) !== ch) {
          errors.push(`${stairs ? 'Stairway' : 'Ramp'} "${ch}" at ${x},${y},${z} needs a second "${ch}" next to it`);
          return;
        }
        rampCells.add(key(x, y, z)).add(key(px, y, pz));
        // The anchor is the high end of a ramp, the low end of a stairway.
        const [ax, az] = dx + dz > 0 ? [x, z] : [px, pz];
        pieces.push([stairs ? 'stairs' : 'ramp', ax, y, az, r]);
        addEnd(ax - dx, y + (stairs ? 0 : 1), az - dz, dir);
        addEnd(ax + 2 * dx, y + (stairs ? 1 : 0), az + 2 * dz, OPPOSITE[dir]);
      }),
    ),
  );

  // A gate runs along whichever axis a fixed-shape groove meets it on.
  const fixedSides = (x, y, z) => GROOVES[at(x, y, z)]?.[2] || '';
  const gateAxis = (x, y, z) => {
    const meets = (side) => {
      const [dx, dz] = SIDES[side];
      return fixedSides(x + dx, y, z + dz).includes(OPPOSITE[side]) || rampEnds.get(key(x, y, z))?.has(side);
    };
    if (meets('E') || meets('W')) return 'ew';
    if (meets('N') || meets('S')) return 'ns';
    return null;
  };
  // A whirl's open sides: the bowl's are the grooves leading in on its tier, the block
  // under it has the grooves leading out (fixed-shape grooves, gates and filters).
  const whirlSides = (x, y, z) =>
    Object.entries(SIDES)
      .filter(([side, [dx, dz]]) => {
        const ch = at(x + dx, y, z + dz);
        const sides = GATES[ch] || FILTERS[ch] ? { ew: 'EW', ns: 'NS' }[gateAxis(x + dx, y, z + dz)] || '' : fixedSides(x + dx, y, z + dz);
        return sides.includes(OPPOSITE[side]) || rampEnds.get(key(x, y, z))?.has(side);
      })
      .map(([side]) => side)
      .join('');
  const sidesOf = (x, y, z) => {
    const ch = at(x, y, z);
    if (GATES[ch] || FILTERS[ch]) return { ew: 'EW', ns: 'NS' }[gateAxis(x, y, z)] || '';
    if (ch === '@' || (ch === '~' && at(x, y + 1, z) === '@')) return whirlSides(x, y, z);
    return fixedSides(x, y, z);
  };
  // Sides of a goal or plate that a neighbour (or a ramp end) connects to.
  const sidesInto = (x, y, z) =>
    Object.entries(SIDES)
      .filter(([side, [dx, dz]]) => sidesOf(x + dx, y, z + dz).includes(OPPOSITE[side]) || rampEnds.get(key(x, y, z))?.has(side))
      .map(([side]) => side);

  tiers.forEach((rows, y) =>
    rows.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        const here = `"${ch}" at ${x},${y},${z}`;
        if (ch === '.' || ch === ' ' || ch === '~' || rampCells.has(key(x, y, z))) return;
        if (ch === '#') return blocks.push([x, y, z]);
        if (GROOVES[ch]) {
          const [type, r] = GROOVES[ch];
          return pieces.push([type, x, y, z, r]);
        }
        if (GATES[ch]) {
          const axis = gateAxis(x, y, z);
          if (!axis) errors.push(`Gate ${here} has no groove leading into it`);
          const opts = SHUTTERS.has(ch) ? { link: GATES[ch], inverse: true } : { link: GATES[ch] };
          return pieces.push(['gate', x, y, z, axis === 'ns' ? 1 : 0, opts]);
        }
        if (FILTERS[ch]) {
          const axis = gateAxis(x, y, z);
          if (!axis) errors.push(`Filter ${here} has no groove leading into it`);
          return pieces.push(['filter', x, y, z, axis === 'ns' ? 1 : 0, { color: FILTERS[ch] }]);
        }
        if (ch === '@') {
          const entries = whirlSides(x, y, z);
          const exits = whirlSides(x, y - 1, z);
          if (!entries) errors.push(`Whirl ${here} has no groove leading into it`);
          if (!exits) errors.push(`Whirl ${here} has no groove leading out of the block under it`);
          if (y === 0 || at(x, y - 1, z) !== '~') errors.push(`Whirl ${here} needs its block underneath, drawn "~" on the tier below`);
          return pieces.push(['whirl', x, y, z, 0, { entries, exits }]);
        }
        if (GOALS[ch] || PLATES[ch] || PORTALS[ch] || ch === '*') {
          const sides = sidesInto(x, y, z);
          const what = GOALS[ch] ? 'Goal' : PLATES[ch] ? 'Plate' : PORTALS[ch] ? 'Portal' : 'Dead end';
          if (sides.length !== 1) errors.push(`${what} ${here} needs exactly one groove leading in, found ${sides.length}`);
          const r = DEAD_END_ROTATION[sides[0]] ?? 0;
          if (ch === '*') return pieces.push(['end', x, y, z, r]);
          if (PORTALS[ch]) return pieces.push(['portal', x, y, z, r, { pair: PORTALS[ch] }]);
          if (PLATES[ch]) return pieces.push(['plate', x, y, z, r, { link: PLATES[ch] }]);
          const color = GOALS[ch];
          const band = level.bands?.[color];
          return pieces.push(['goal', x, y, z, r, band ? { color, link: band } : { color }]);
        }
        errors.push(`Unknown map character ${here}`);
      }),
    ),
  );

  return { pieces, blocks, errors };
}
