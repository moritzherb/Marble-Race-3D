// The wooden block library.
//
// Each piece is described in its own local space, unrotated:
//   x = east, z = south, y = up; origin at the centre of the anchor cell's floor.
// A rail is the line the marble's centre follows. Grooves sit 0.05 below the block
// top, so on a flat block the rail runs at y = 0.95.
// Rails that end on a cell face are "ports": the track builder joins ports that meet.
//
// rotation r (0-3) turns a piece in 90° steps: east -> south -> west -> north.

export const RAIL_Y = 0.95;
export const GROOVE_DEPTH_OFFSET = 0.05; // block top = rail + this
export const DEAD_END = 0.15; // where a marble's centre stops at the closed end of a groove
const H = 0.5;

function line(a, b) {
  return [a, b];
}

function arc(cx, cz, radius, fromDeg, toDeg, y, steps = 10) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + (toDeg - fromDeg) * (i / steps)) * Math.PI) / 180;
    pts.push([cx + radius * Math.cos(a), y, cz + radius * Math.sin(a)]);
  }
  return pts;
}

const Y = RAIL_Y;
const deadEndRail = line([-H, Y, 0], [DEAD_END, Y, 0]);

// shape: how the renderer draws the wood.
//   'cube'  one full block in the anchor cell
//   'wedge' the ramp: a sloped block over two cells
// cells: cells the piece fills, as [dx, dy, dz] from the anchor.
// supportCells: which of those need a support column underneath.
export const PIECES = {
  block: {
    label: 'Solid block',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [],
  },
  straight: {
    label: 'Straight groove',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([-H, Y, 0], [H, Y, 0])],
  },
  curve: {
    // west to north, a quarter circle around the north-west corner
    label: 'Curve',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [arc(-H, -H, H, 90, 0, Y)],
  },
  tee: {
    // ports west, east and north, meeting in the middle
    label: 'T-junction',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([0, Y, 0], [-H, Y, 0]), line([0, Y, 0], [H, Y, 0]), line([0, Y, 0], [0, Y, -H])],
  },
  cross: {
    // two grooves crossing in an open square: a four-way junction, so a marble can turn
    // here (it goes straight on unless the tilt says otherwise)
    label: 'Crossing',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([0, Y, 0], [-H, Y, 0]), line([0, Y, 0], [H, Y, 0]), line([0, Y, 0], [0, Y, -H]), line([0, Y, 0], [0, Y, H])],
  },
  end: {
    // open to the west, closed towards the east
    label: 'Dead end',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [deadEndRail],
  },
  goal: {
    label: 'Goal cup',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [deadEndRail],
    feature: { type: 'goal' },
  },
  plate: {
    label: 'Weight plate',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [deadEndRail],
    feature: { type: 'plate' },
  },
  gate: {
    label: 'Gate',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([-H, Y, 0], [H, Y, 0])],
    feature: { type: 'gate' },
  },
  filter: {
    // a coloured arch over a straight groove: only the marble of that colour (opts.color)
    // gets through; the others bounce off it as if it were a gate
    label: 'Colour filter',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([-H, Y, 0], [H, Y, 0])],
    feature: { type: 'filter' },
  },
  portal: {
    // a groove from the west face into a ring at the centre. A marble that rolls into it
    // comes out of the other portal of the same pair (opts.pair), moving away from it.
    label: 'Portal',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([-H, Y, 0], [0, Y, 0])],
    feature: { type: 'portal' },
  },
  sky: {
    // a magnetic rail with nothing underneath: the marble hangs from a beam. It falls if it
    // stops over the gap: onto a groove below if there is one, otherwise out of the game.
    label: 'Sky rail',
    shape: 'sky',
    cells: [[0, 0, 0]],
    supportCells: [],
    rails: [line([-H, Y, 0], [H, Y, 0])],
    feature: { type: 'sky' },
  },
  skyEnd: {
    // the end of a sky rail, open to the west: a marble that rolls to the end stops over the
    // middle of the cell and drops
    label: 'Sky rail end',
    shape: 'sky',
    cells: [[0, 0, 0]],
    supportCells: [],
    rails: [line([-H, Y, 0], [0, Y, 0])],
    feature: { type: 'sky' },
  },
  ramp: {
    // high end on the west face one tier up, low end two cells east on the anchor's tier.
    // Slope 1:2 (26.6°) is steeper than the max tilt, so a ramp only works downhill.
    label: 'Ramp',
    shape: 'wedge',
    cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
    supportCells: [[0, 0, 0], [1, 0, 0]],
    rails: [line([-H, Y + 1, 0], [1.5, Y, 0])],
  },
  stairs: {
    // a stairway that carries marbles up: low end on the west face of the anchor's tier,
    // high end on the east face of the second cell one tier up. Whatever the tilt, a marble
    // on it climbs at a steady pace; one arriving from the top is pushed back out.
    label: 'Stairway',
    shape: 'stairs',
    cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
    supportCells: [[0, 0, 0], [1, 0, 0]],
    rails: [line([-H, Y, 0], [1.5, Y + 1, 0])],
    feature: { type: 'lift' },
  },
  whirl: {
    // a funnel: grooves come in at the rim from the sides in opts.entries, spiral down into
    // a hole in the middle, and the marble drops into the block below (the anchor's tier
    // minus one), leaving through the sides in opts.exits. Sides are machine directions.
    label: 'Whirl',
    shape: 'whirl',
    cells: [[0, 0, 0], [0, -1, 0]],
    supportCells: [[0, -1, 0]],
    rails: (opts) => whirlRails(opts),
    feature: { type: 'whirl' },
  },
};

// The whirl's grooves: a spiral from each entry down to the hole, a short drop, and a groove
// from the bottom of the drop out of each exit. One-way: the spirals are steeper than any tilt.
const SIDE_ANGLE = { E: 0, S: 90, W: 180, N: 270 }; // around the cell centre, x east and z south
const SIDE_POINT = { E: [H, 0], S: [0, H], W: [-H, 0], N: [0, -H] };
export const WHIRL_HOLE_Y = 0.22;
function whirlRails({ entries = 'W', exits = 'E' } = {}) {
  const rails = [];
  const hole = [0, WHIRL_HOLE_Y, 0];
  for (const side of entries) {
    const a0 = (SIDE_ANGLE[side] * Math.PI) / 180;
    // Three quarters of a turn, closing in from the rim to near the middle, dropping at an
    // even slope (about 25 degrees, steeper than the steepest tilt).
    const flat = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const a = a0 + 1.5 * Math.PI * k;
      const r = 0.1 + 0.4 * (1 - k) ** 2; // in from the rim quickly, then circling the hole
      flat.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    flat.push([0, 0]);
    const along = [0];
    for (let i = 1; i < flat.length; i++) along.push(along[i - 1] + Math.hypot(flat[i][0] - flat[i - 1][0], flat[i][1] - flat[i - 1][1]));
    const total = along.at(-1);
    const pts = flat.map(([x, z], i) => [x, Y - (Y - WHIRL_HOLE_Y) * (along[i] / total), z]);
    pts[pts.length - 1] = hole;
    rails.push(pts);
  }
  const bottom = [0, Y - 1, 0];
  rails.push([hole, bottom]);
  for (const side of exits) {
    const [x, z] = SIDE_POINT[side];
    rails.push([bottom, [x, Y - 1, z]]);
  }
  return rails;
}

export const railsOf = (type, opts = {}) => {
  const rails = PIECES[type].rails;
  return typeof rails === 'function' ? rails(opts) : rails;
};

// Rotate a local (x, z) offset by r quarter turns (east -> south -> west -> north).
export function rotateXZ(x, z, r) {
  let a = x;
  let b = z;
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) {
    const t = a;
    a = -b;
    b = t;
  }
  return [a, b];
}

// Turn a local point into machine coordinates for a piece anchored at cell (cx, cy, cz).
export function toMachine(p, anchor, r) {
  const [x, z] = rotateXZ(p[0], p[2], r);
  return [anchor[0] + 0.5 + x, anchor[1] + p[1], anchor[2] + 0.5 + z];
}

export function pieceCells(type, anchor, r) {
  const def = PIECES[type];
  return def.cells.map(([dx, dy, dz]) => {
    const [x, z] = rotateXZ(dx, dz, r);
    return [anchor[0] + Math.round(x), anchor[1] + dy, anchor[2] + Math.round(z)];
  });
}

export function supportCells(type, anchor, r) {
  const def = PIECES[type];
  const cells = def.supportCells || def.cells.filter(([, dy]) => dy === 0);
  return cells.map(([dx, dy, dz]) => {
    const [x, z] = rotateXZ(dx, dz, r);
    return [anchor[0] + Math.round(x), anchor[1] + dy, anchor[2] + Math.round(z)];
  });
}
