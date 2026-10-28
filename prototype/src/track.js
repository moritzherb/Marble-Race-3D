// Turns a level description into a track network the marbles can ride on.
//
// Every rail of every piece becomes an "edge" (a polyline). Rail ends that touch
// become shared "nodes". A node with one edge is a dead end, two edges is a plain
// connection, three or more is a junction.

import { PIECES, toMachine, pieceCells, supportCells, railsOf } from './pieces.js';

const key3 = (p) => p.map((v) => Math.round(v * 1000)).join(',');
const cellKey = (c) => c.join(',');

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function len(a) {
  return Math.sqrt(dot(a, a));
}
export function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
export function norm(a) {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}

function makeEdge(id, pts, pieceIndex) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  return { id, pts, cum, L: cum[cum.length - 1], piece: pieceIndex, n0: -1, n1: -1 };
}

// Position and unit tangent (pointing from pts[0] towards the last point) at distance s.
export function sampleEdge(edge, s) {
  const { pts, cum, L } = edge;
  const t = Math.min(Math.max(s, 0), L);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < t) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const segLen = cum[i] - cum[i - 1] || 1;
  const f = (t - cum[i - 1]) / segLen;
  const pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  return { pos, tangent: norm(sub(b, a)) };
}

// Unit tangent of an edge at one of its ends, pointing away from that end's node.
export function tangentAwayFrom(edge, end) {
  if (end === 0) return sampleEdge(edge, 0).tangent;
  return scale(sampleEdge(edge, edge.L).tangent, -1);
}

// Number of separate wooden structures: blocks touching face to face count as one.
function countParts(occupied) {
  const seen = new Set();
  let parts = 0;
  for (const start of occupied.keys()) {
    if (seen.has(start)) continue;
    parts++;
    seen.add(start);
    const queue = [start];
    while (queue.length) {
      const [x, y, z] = queue.pop().split(',').map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const k = cellKey([x + dx, y + dy, z + dz]);
        if (occupied.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
  }
  return parts;
}

export function buildTrack(level) {
  const errors = [...(level.mapErrors || [])];
  const occupied = new Map();
  const placed = [];

  const claim = (cell, owner) => {
    const k = cellKey(cell);
    if (occupied.has(k)) errors.push(`Cell ${k} is used twice (${occupied.get(k).label} and ${owner.label})`);
    else occupied.set(k, owner);
  };

  for (const [type, x, y, z, r = 0, opts = {}] of level.pieces) {
    const def = PIECES[type];
    if (!def) {
      errors.push(`Unknown piece type "${type}"`);
      continue;
    }
    const piece = { index: placed.length, type, anchor: [x, y, z], r, opts, label: `${type}@${x},${y},${z}` };
    placed.push(piece);
    for (const c of pieceCells(type, piece.anchor, r)) claim(c, piece);
  }

  // Plain blocks: listed ones plus rectangles filled on the ground tier.
  const addBlock = (cell) => {
    if (occupied.has(cellKey(cell))) return;
    const piece = { index: placed.length, type: 'block', anchor: cell, r: 0, opts: {}, label: `block@${cell}` };
    placed.push(piece);
    claim(cell, piece);
  };
  for (const cell of level.blocks || []) addBlock(cell);
  for (const [x0, z0, x1, z1, y = 0] of level.fill || []) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) addBlock([x, y, z]);
  }

  // Every raised piece rests on a column of support blocks down to the ground or the next block.
  for (const piece of [...placed]) {
    for (const [x, y, z] of supportCells(piece.type, piece.anchor, piece.r)) {
      for (let below = y - 1; below >= 0; below--) {
        if (occupied.has(cellKey([x, below, z]))) break;
        addBlock([x, below, z]);
      }
    }
  }

  // Wood on top of a groove hides the marble, so it must be a tunnel the player can see.
  // The renderer can only cut an arch through a block over a straight groove, so that is
  // the only groove anything may sit on (and a ramp, stairway or whirl can't be the thing
  // on top). A sky rail is a beam in the air: it covers nothing, and nothing rests on it.
  const SLOPED = new Set(['ramp', 'stairs']);
  for (const piece of placed) {
    if (!railsOf(piece.type, piece.opts).length) continue;
    const cells = pieceCells(piece.type, piece.anchor, piece.r);
    const surface = SLOPED.has(piece.type) ? cells.filter(([, y]) => y > piece.anchor[1]) : [piece.anchor];
    for (const [x, y, z] of surface) {
      const above = occupied.get(cellKey([x, y + 1, z]));
      if (!above || above === piece || above.type === 'sky' || above.type === 'skyEnd') continue;
      if (piece.type === 'sky' || piece.type === 'skyEnd') {
        errors.push(`${above.label} rests on the sky rail at ${x},${y},${z}`);
        continue;
      }
      if (piece.type === 'straight' && !SLOPED.has(above.type) && above.type !== 'whirl') continue;
      errors.push(`${above.label} covers the ${piece.type} at ${x},${y},${z}; only a straight groove can run under wood (as a tunnel)`);
    }
    if (piece.type === 'whirl') {
      const [x, y, z] = piece.anchor;
      const under = occupied.get(cellKey([x, y - 2, z]));
      if (under && railsOf(under.type, under.opts).length) errors.push(`${piece.label} sits on the ${under.type} at ${x},${y - 2},${z}; a whirl needs a plain block or the ground under it`);
    }
  }

  // The machine tilts as one object, so every block must touch the rest.
  const parts = countParts(occupied);
  if (parts > 1) errors.push(`The machine is in ${parts} separate parts; add blocks to join them`);

  // Rails -> edges and nodes.
  const edges = [];
  const nodes = [];
  const nodeByKey = new Map();
  const nodeAt = (p) => {
    const k = key3(p);
    if (!nodeByKey.has(k)) {
      const node = { id: nodes.length, pos: p, links: [] };
      nodes.push(node);
      nodeByKey.set(k, node);
    }
    return nodeByKey.get(k);
  };

  for (const piece of placed) {
    piece.edges = [];
    for (const rail of railsOf(piece.type, piece.opts)) {
      const pts = rail.map((p) => toMachine(p, piece.anchor, piece.r));
      const edge = makeEdge(edges.length, pts, piece.index);
      const a = nodeAt(pts[0]);
      const b = nodeAt(pts[pts.length - 1]);
      edge.n0 = a.id;
      edge.n1 = b.id;
      a.links.push({ edge: edge.id, end: 0 });
      b.links.push({ edge: edge.id, end: 1 });
      edges.push(edge);
      piece.edges.push(edge.id);
    }
  }

  // Portals: the two of a pair share the node at their centres, so a marble that rolls into
  // one carries on out of the other.
  const portals = new Map();
  for (const piece of placed) {
    if (piece.type !== 'portal') continue;
    const pair = piece.opts.pair || '1';
    if (!portals.has(pair)) portals.set(pair, []);
    portals.get(pair).push(piece);
  }
  for (const [pair, list] of portals) {
    if (list.length !== 2) {
      errors.push(`Portal pair ${pair} has ${list.length} portal${list.length === 1 ? '' : 's'}; it needs exactly 2`);
      continue;
    }
    const [a, b] = list.map((p) => edges[p.edges[0]]);
    const keep = nodes[a.n1];
    const gone = nodes[b.n1];
    for (const link of gone.links) keep.links.push(link);
    gone.links = [];
    b.n1 = keep.id;
    keep.portal = pair;
  }
  for (const piece of placed) {
    for (const id of piece.edges) {
      if (piece.type === 'stairs') edges[id].lift = 1; // carries marbles towards its n1 end, the top
      if (piece.type === 'sky' || piece.type === 'skyEnd') edges[id].sky = true;
      if (piece.type === 'portal') edges[id].portal = piece.opts.pair || '1';
    }
    if (piece.type === 'whirl') {
      // Its spirals, for the renderer: the marble is drawn on the funnel's surface.
      const [x, y, z] = piece.anchor;
      for (const id of piece.edges.slice(0, piece.opts.entries.length)) edges[id].whirl = { x: x + 0.5, y, z: z + 0.5 };
    }
  }

  // A rail end lying on a cell face with nothing attached is an open groove: a level bug.
  const onFace = (v) => Math.abs(v - Math.round(v)) < 1e-6;
  for (const node of nodes) {
    if (node.links.length === 1 && (onFace(node.pos[0]) || onFace(node.pos[2]))) {
      errors.push(`Open groove end at ${node.pos.map((v) => v.toFixed(2)).join(', ')}`);
    }
  }

  // Mechanisms.
  const goals = [];
  const plates = [];
  const gates = [];
  const filters = [];
  for (const piece of placed) {
    const feature = PIECES[piece.type].feature;
    if (!feature) continue;
    const edge = edges[piece.edges[0]];
    const link = piece.opts.link || null;
    if (feature.type === 'goal') {
      if (!piece.opts.color) errors.push(`Goal ${piece.label} has no colour`);
      goals.push({ edge: edge.id, color: piece.opts.color, link, filled: false, piece: piece.index });
    } else if (feature.type === 'plate') {
      plates.push({ edge: edge.id, from: edge.L - 0.3, link, pressed: false, piece: piece.index });
    } else if (feature.type === 'filter') {
      if (!piece.opts.color) errors.push(`Filter ${piece.label} has no colour`);
      filters.push({ edge: edge.id, s: edge.L / 2, color: piece.opts.color, piece: piece.index });
    } else if (feature.type === 'gate') {
      // A shutter (inverse gate) is the other way round: open until its link is powered.
      gates.push({ edge: edge.id, s: edge.L / 2, link, inverse: Boolean(piece.opts.inverse), open: false, piece: piece.index });
    }
  }
  for (const gate of gates) {
    const opener = plates.some((p) => p.link === gate.link) || goals.some((g) => g.link === gate.link);
    if (!gate.link || !opener) errors.push(`Gate ${placed[gate.piece].label} has no plate or goal linked to it`);
  }

  // Marble start positions.
  const starts = (level.marbles || []).map((m) => {
    const owner = occupied.get(cellKey(m.at));
    if (!owner || !owner.edges || owner.edges.length === 0) {
      errors.push(`Marble ${m.color} starts at ${m.at} where there is no groove`);
      return null;
    }
    const edge = edges[owner.edges[0]];
    if (owner.type === 'sky' || owner.type === 'skyEnd') errors.push(`Marble ${m.color} starts on a sky rail, where it would fall`);
    const deadEnd = ['end', 'goal', 'plate'].includes(owner.type);
    const s = typeof m.s === 'number' ? m.s * edge.L : deadEnd ? edge.L : edge.L / 2;
    return { color: m.color, edge: edge.id, s };
  });

  const colours = new Set((level.marbles || []).map((m) => m.color));
  for (const c of colours) {
    if (!goals.some((g) => g.color === c)) errors.push(`No goal for the ${c} marble`);
  }

  // Bounds of all wood, for the camera.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const k of occupied.keys()) {
    const c = k.split(',').map(Number);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], c[i]);
      max[i] = Math.max(max[i], c[i] + 1);
    }
  }

  // Which piece fills each cell (for marbles dropping off a sky rail, and the renderer).
  const cellOwner = new Map([...occupied].map(([k, piece]) => [k, piece.index]));

  return { pieces: placed, edges, nodes, goals, plates, gates, filters, starts, cellOwner, bounds: { min, max }, errors };
}
