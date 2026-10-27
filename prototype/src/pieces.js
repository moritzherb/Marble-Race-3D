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
    // two grooves crossing; marbles go straight through
    label: 'Crossing',
    shape: 'cube',
    cells: [[0, 0, 0]],
    rails: [line([-H, Y, 0], [H, Y, 0]), line([0, Y, -H], [0, Y, H])],
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
  ramp: {
    // high end on the west face one tier up, low end two cells east on the anchor's tier.
    // Slope 1:2 (26.6°) is steeper than the max tilt, so a ramp only works downhill.
    label: 'Ramp',
    shape: 'wedge',
    cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
    supportCells: [[0, 0, 0], [1, 0, 0]],
    rails: [line([-H, Y + 1, 0], [1.5, Y, 0])],
  },
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
