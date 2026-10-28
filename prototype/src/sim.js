// Rail physics: each marble is a bead on the track network.
//
// A marble only stores which edge it is on, how far along it is (s) and its signed
// speed along that edge (v). Each step, gravity is projected onto the groove's
// direction, drag is applied, and the marble slides along the line, crossing nodes
// into the next edge. Plates, gates, filters and goals are just checks on those numbers.
// A stairway sets the speed instead of gravity; a marble that stops on a sky rail falls,
// onto a groove below or out of the game (lost).

import { PHYSICS, MARBLE_RADIUS } from './config.js';
import { sampleEdge, tangentAwayFrom, dot, sub, len, scale } from './track.js';

const R = MARBLE_RADIUS;

export function createSim(track) {
  const marbles = track.starts.map((st, id) => ({
    id,
    color: st.color,
    edge: st.edge,
    s: st.s,
    v: 0,
    delivered: false,
    lost: false, // fell off a sky rail with nothing below: the level can't be won any more
    stall: 0, // seconds spent (nearly) stopped on a sky rail
    pull: null, // extra gravity for this marble only (Magnetic Pull), machine coordinates
    pos: sampleEdge(track.edges[st.edge], st.s).pos,
    tangent: [1, 0, 0],
    distance: 0, // total rolled distance, for spinning the marble mesh
  }));
  const sim = {
    track,
    marbles,
    goals: track.goals.map((g) => ({ ...g, filled: false })),
    plates: track.plates.map((p) => ({ ...p, pressed: false })),
    gates: track.gates.map((g) => ({ ...g, open: false, powered: false, forced: false })),
    filters: track.filters || [],
    speedScale: 1, // Speed Boost: multiplies how hard gravity pushes along grooves, and the speed cap
    time: 0,
  };
  updateMechanisms(sim, []);
  return sim;
}

export function isWon(sim) {
  return sim.marbles.length > 0 && sim.marbles.every((m) => m.delivered);
}

export function isLost(sim) {
  return sim.marbles.some((m) => m.lost);
}

// Advance the simulation by dt seconds with gravity g (machine coordinates).
// Returns a list of events for sounds and effects.
export function stepSim(sim, dt, g) {
  const events = [];
  const P = PHYSICS;
  const roll = P.rollFactor;
  const aRef = roll * P.gravity * Math.sin((P.maxTiltDeg * Math.PI) / 180);
  const boost = sim.speedScale || 1;

  for (const m of sim.marbles) {
    if (m.delivered || m.lost) continue;
    const edge = sim.track.edges[m.edge];
    if (edge.lift) {
      // A stairway: the marble climbs at a steady pace whatever the tilt. One that rolls in
      // from the top is turned straight back out (the game shows it bouncing off).
      const top = edge.lift > 0 ? edge.L : 0;
      if (m.v * edge.lift < -0.05 && Math.abs(m.s - top) < 0.3) events.push({ type: 'liftBack', marble: m.id });
      m.v = PHYSICS.liftSpeed * edge.lift;
      const before = { edge: m.edge, s: m.s };
      moveAlong(sim, m, m.v * dt, g, events);
      blockAtGates(sim, m, before, events);
      continue;
    }
    const { tangent } = sampleEdge(edge, m.s);
    const gm = m.pull ? [g[0] + m.pull[0], g[1] + m.pull[1], g[2] + m.pull[2]] : g;
    const a = (roll * dot(gm, tangent) + junctionPull(sim, m, edge, gm)) * boost;

    // Drag is low while gravity pushes along the groove and high when it doesn't,
    // so marbles stop quickly when you let go or tilt across their groove.
    const push = Math.min(1, Math.abs(a) / aRef);
    const drag = P.dragMoving + (P.dragBraking - P.dragMoving) * (1 - push) ** 2;

    let v = m.v + a * dt;
    v *= Math.exp(-drag * dt);
    const rr = P.rollingResistance * dt;
    v = Math.abs(v) <= rr ? 0 : v - Math.sign(v) * rr;
    v = Math.max(-P.maxSpeed * boost, Math.min(P.maxSpeed * boost, v));
    m.v = v;

    const before = { edge: m.edge, s: m.s };
    moveAlong(sim, m, v * dt, gm, events);
    blockAtGates(sim, m, before, events);
  }

  for (let pass = 0; pass < 2; pass++) collideMarbles(sim, events);
  for (const m of sim.marbles) if (!m.delivered && !m.lost) watchSky(sim, m, dt, events);

  for (const m of sim.marbles) {
    if (m.lost) continue;
    const { pos, tangent } = sampleEdge(sim.track.edges[m.edge], m.s);
    m.distance += len(sub(pos, m.pos));
    m.pos = pos;
    m.tangent = tangent;
  }

  checkGoals(sim, events);
  updateMechanisms(sim, events);
  sim.time += dt;
  return events;
}

// A T-junction is an open square in the wood, so a marble sitting in it rolls into a
// branch that is downhill even if its own groove runs across the tilt. Without this the
// marble would wait at the corner until the player wiggled it over the exact centre.
// Returns extra acceleration along the marble's edge, towards the junction.
function junctionPull(sim, m, edge, g) {
  const reach = PHYSICS.junctionReach;
  let end;
  if (m.s < reach) end = 0;
  else if (edge.L - m.s < reach) end = 1;
  else return 0;
  const node = sim.track.nodes[end === 0 ? edge.n0 : edge.n1];
  if (node.links.length < 3) return 0;
  const roll = PHYSICS.rollFactor;
  const away = roll * dot(g, tangentAwayFrom(edge, end));
  let best = 0;
  for (const link of node.links) {
    if (link.edge === edge.id) continue;
    best = Math.max(best, roll * dot(g, tangentAwayFrom(sim.track.edges[link.edge], link.end)));
  }
  const unit = roll * PHYSICS.gravity;
  // Only when a branch is clearly more downhill than carrying on along this groove;
  // ties are decided at the centre itself, where a turn wins.
  if (best < 0.02 * unit || best <= away + 0.02 * unit) return 0;
  return end === 0 ? -best : best;
}

// Slide a marble ds along the network, deciding which way to go at each node.
function moveAlong(sim, m, ds, g, events) {
  const { edges, nodes } = sim.track;
  let s = m.s + ds;
  for (let guard = 0; guard < 8; guard++) {
    const edge = edges[m.edge];
    let end;
    let overflow;
    if (s > edge.L) {
      end = 1;
      overflow = s - edge.L;
    } else if (s < 0) {
      end = 0;
      overflow = -s;
    } else break;

    const node = nodes[end === 1 ? edge.n1 : edge.n0];
    const arriving = scale(tangentAwayFrom(edge, end), -1); // direction of travel into the node
    const next = chooseExit(sim, node, m.edge, arriving, Math.abs(m.v), g);
    if (!next) {
      // Dead end or nowhere downhill to turn: bounce back off the wall.
      s = end === 1 ? edge.L : 0;
      if (Math.abs(m.v) > 0.3) events.push({ type: 'bump', marble: m.id, strength: Math.abs(m.v) });
      m.v = -m.v * PHYSICS.wallBounce;
      break;
    }
    const nextEdge = edges[next.edge];
    const speed = Math.abs(m.v);
    m.edge = next.edge;
    if (next.end === 0) {
      s = overflow;
      m.v = speed;
    } else {
      s = nextEdge.L - overflow;
      m.v = -speed;
    }
  }
  m.s = s;
}

// Pick the edge to continue on. At a plain connection there is only one choice.
// At a junction the tilt decides, so players can predict it:
//   1. take the most downhill branch (a turn wins ties, so a diagonal tilt means "turn here");
//   2. if no branch is downhill, keep going straight on momentum;
//   3. otherwise bounce back off the junction wall.
function chooseExit(sim, node, fromEdge, arriving, speed, g) {
  const options = node.links.filter((l) => l.edge !== fromEdge);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];
  let best = null;
  let bestScore = -Infinity;
  let straightOn = null;
  for (const opt of options) {
    const out = tangentAwayFrom(sim.track.edges[opt.edge], opt.end);
    const downhill = dot(g, out) / PHYSICS.gravity;
    const straight = dot(out, arriving) > 0.9;
    if (straight) straightOn = opt;
    if (downhill < 0.02) continue;
    const score = downhill + (straight ? 0 : PHYSICS.turnBias);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }
  return best || (speed > 0 ? straightOn : null);
}

// A marble that stops on a sky rail falls: onto the groove under it if there is one, and
// otherwise out of the game.
function watchSky(sim, m, dt, events) {
  if (!sim.track.edges[m.edge].sky || Math.abs(m.v) >= PHYSICS.skyStallSpeed) {
    m.stall = 0;
    return;
  }
  m.stall += dt;
  if (m.stall < PHYSICS.skyStallTime) return;
  m.stall = 0;
  const landing = landingBelow(sim.track, sampleEdge(sim.track.edges[m.edge], m.s).pos);
  if (!landing) {
    m.lost = true;
    m.v = 0;
    events.push({ type: 'fall', marble: m.id, color: m.color });
    return;
  }
  m.edge = landing.edge;
  m.s = landing.s;
  m.v = 0;
  events.push({ type: 'drop', marble: m.id, strength: 2 });
}

// The groove a marble at `pos` lands in if it drops straight down: the first piece under
// it, if that piece has grooves (the nearest point of them). A plain block or the ground
// means the marble is lost.
export function landingBelow(track, pos) {
  const x = Math.floor(pos[0]);
  const z = Math.floor(pos[2]);
  for (let y = Math.floor(pos[1]) - 1; y >= 0; y--) {
    const owner = track.cellOwner?.get(`${x},${y},${z}`);
    if (owner === undefined) continue;
    const piece = track.pieces[owner];
    let best = null;
    for (const id of piece.edges) {
      const edge = track.edges[id];
      if (edge.sky) continue;
      for (let i = 1; i < edge.pts.length; i++) {
        const a = edge.pts[i - 1];
        const b = edge.pts[i];
        const d = [b[0] - a[0], b[2] - a[2]];
        const l2 = d[0] * d[0] + d[1] * d[1];
        const t = l2 ? Math.max(0, Math.min(1, ((pos[0] - a[0]) * d[0] + (pos[2] - a[2]) * d[1]) / l2)) : 0;
        const q = [a[0] + d[0] * t, a[1] + (b[1] - a[1]) * t, a[2] + d[1] * t];
        // Only grooves at the height of this cell's top count (not a whirl's inner drop).
        if (q[1] < y + 0.5) continue;
        const dist = Math.hypot(pos[0] - q[0], pos[2] - q[2]);
        if (!best || dist < best.dist) best = { edge: id, s: edge.cum[i - 1] + t * (edge.cum[i] - edge.cum[i - 1]), dist };
      }
    }
    return best && best.dist < 0.45 ? best : null;
  }
  return null;
}

// A closed gate is a wall across its groove, and so is a filter for marbles of other colours.
function blockAtGates(sim, m, before, events) {
  if (m.edge !== before.edge) return;
  for (const f of sim.filters) {
    if (f.edge !== m.edge || f.color === m.color) continue;
    wall(m, before, f.s, events);
  }
  for (const gate of sim.gates) {
    if (gate.open || gate.edge !== m.edge) continue;
    wall(m, before, gate.s, events);
  }
}

function wall(m, before, at, events) {
  const side = Math.sign(before.s - at) || -Math.sign(m.v) || 1;
  const crossed = Math.sign(m.s - at) !== side;
  if (!crossed && Math.abs(m.s - at) >= R) return;
  m.s = at + side * R;
  if (Math.sign(m.v) === -side) {
    if (Math.abs(m.v) > 0.3) events.push({ type: 'bump', marble: m.id, strength: Math.abs(m.v) });
    m.v = -m.v * PHYSICS.wallBounce;
  }
}

// Marbles push each other along their own grooves. Each marble can only move along
// its tangent, so the push is projected onto both tangents.
function collideMarbles(sim, events) {
  const ms = sim.marbles;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const A = ms[i];
      const B = ms[j];
      if (A.lost || B.lost) continue;
      const pa = sampleEdge(sim.track.edges[A.edge], A.s);
      const pb = sampleEdge(sim.track.edges[B.edge], B.s);
      const d = sub(pb.pos, pa.pos);
      const dist = len(d);
      if (dist >= 2 * R || dist < 1e-9) continue;
      const n = scale(d, 1 / dist);
      const aA = A.delivered ? 0 : dot(n, pa.tangent);
      const aB = B.delivered ? 0 : dot(n, pb.tangent);
      const w = aA * aA + aB * aB;
      if (w < 1e-4) continue;

      const relative = B.v * aB - A.v * aA; // closing speed along n (negative = approaching)
      if (relative < 0) {
        const j = (-(1 + PHYSICS.marbleBounce) * relative) / w;
        A.v -= j * aA;
        B.v += j * aB;
        if (-relative > 0.4) events.push({ type: 'click', strength: -relative });
      }
      const overlap = 2 * R - dist;
      A.s -= (overlap * aA) / w;
      B.s += (overlap * aB) / w;
      clampToEdge(sim, A);
      clampToEdge(sim, B);
    }
  }
}

function clampToEdge(sim, m) {
  const L = sim.track.edges[m.edge].L;
  if (m.s < 0 || m.s > L) moveAlong(sim, m, 0, [0, -1, 0], []);
  m.s = Math.min(Math.max(m.s, 0), L);
}

function checkGoals(sim, events) {
  for (const goal of sim.goals) {
    if (goal.filled) continue;
    const edge = sim.track.edges[goal.edge];
    for (const m of sim.marbles) {
      // Its own colour is home as soon as it is inside the cup; another colour bounces off
      // the end of it.
      if (m.delivered || m.lost || m.edge !== goal.edge) continue;
      if (m.s < edge.L - (m.color === goal.color ? 0.1 : 0.02)) continue;
      if (m.color === goal.color) {
        m.delivered = true;
        m.v = 0;
        m.s = edge.L;
        goal.filled = true;
        events.push({ type: 'deliver', marble: m.id, color: m.color });
      } else {
        m.v = -Math.max(Math.abs(m.v) * 0.7, PHYSICS.rejectSpeed);
        m.s = edge.L - 0.03;
        events.push({ type: 'reject', marble: m.id, color: m.color, goal: goal.color });
      }
      break;
    }
  }
}

function updateMechanisms(sim, events) {
  for (const plate of sim.plates) {
    const was = plate.pressed;
    plate.pressed = sim.marbles.some((m) => !m.lost && m.edge === plate.edge && m.s >= plate.from);
    if (plate.pressed !== was) events.push({ type: plate.pressed ? 'platePress' : 'plateRelease', link: plate.link });
  }
  for (const gate of sim.gates) {
    const was = gate.open;
    const powered =
      sim.plates.some((p) => p.link === gate.link && p.pressed) ||
      sim.goals.some((g) => g.link === gate.link && g.filled);
    gate.powered = powered;
    // Open All Gates forces every gate and shutter open; the plates keep working underneath.
    gate.open = gate.forced || (gate.inverse ? !powered : powered);
    if (gate.open !== was) events.push({ type: gate.open ? 'gateOpen' : 'gateClose', link: gate.link });
    if (!gate.open) {
      // A gate closing on a marble pushes it out to whichever side it is on.
      for (const m of sim.marbles) {
        if (m.edge === gate.edge && Math.abs(m.s - gate.s) < R) m.s = gate.s + (Math.sign(m.s - gate.s) || 1) * R;
      }
    }
  }
}
