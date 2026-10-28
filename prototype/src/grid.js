// Levels drawn as text. Each tier of the machine is a list of rows (north at the top,
// one character per block), and this turns the drawing into the piece list that
// buildTrack() reads, so a level file shows the machine's shape at a glance.
//
//   ─ │                 straight groove
//   ┌ ┐ └ ┘             curve, joining the two sides its lines reach
//   ┬ ┴ ├ ┤             T-junction
//   ┼                   crossing
//   ╴ ╵ ╶ ╷             dead end, open on the side its stub points to
//   *                   dead end, open towards whichever groove leads into it
//   b o g p r           goal for the blue, orange, green, purple or red marble
//   A B C               weight plate for link A, B or C
//   1 2 3               gate opened by link A, B or C
//   x y z               shutter for link A, B or C: open until that link is powered, then shut
//   > < v ^             ramp, drawn on both of its cells on the lower tier, pointing downhill
//   ~                   a cell taken by a ramp coming up from the tier below
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
};
const GOALS = { b: 'blue', o: 'orange', g: 'green', p: 'purple', r: 'red' };
const PLATES = { A: 'A', B: 'B', C: 'C' };
const GATES = { 1: 'A', 2: 'B', 3: 'C', x: 'A', y: 'B', z: 'C' };
const SHUTTERS = new Set(['x', 'y', 'z']);
const RAMPS = { '>': ['E', 0], 'v': ['S', 1], '<': ['W', 2], '^': ['N', 3] };
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
        if (!RAMPS[ch] || rampCells.has(key(x, y, z))) return;
        const [dir, r] = RAMPS[ch];
        const [dx, dz] = SIDES[dir];
        const [px, pz] = [x + Math.abs(dx), z + Math.abs(dz)]; // its other cell, east or south of this one
        if (at(px, y, pz) !== ch) {
          errors.push(`Ramp "${ch}" at ${x},${y},${z} needs a second "${ch}" next to it`);
          return;
        }
        rampCells.add(key(x, y, z)).add(key(px, y, pz));
        // The anchor is the high end.
        const [ax, az] = dx + dz > 0 ? [x, z] : [px, pz];
        pieces.push(['ramp', ax, y, az, r]);
        addEnd(ax - dx, y + 1, az - dz, dir);
        addEnd(ax + 2 * dx, y, az + 2 * dz, OPPOSITE[dir]);
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
  const sidesOf = (x, y, z) => {
    if (GATES[at(x, y, z)]) return { ew: 'EW', ns: 'NS' }[gateAxis(x, y, z)] || '';
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
        if (GOALS[ch] || PLATES[ch] || ch === '*') {
          const sides = sidesInto(x, y, z);
          if (sides.length !== 1) errors.push(`${GOALS[ch] ? 'Goal' : PLATES[ch] ? 'Plate' : 'Dead end'} ${here} needs exactly one groove leading in, found ${sides.length}`);
          const r = DEAD_END_ROTATION[sides[0]] ?? 0;
          if (ch === '*') return pieces.push(['end', x, y, z, r]);
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
