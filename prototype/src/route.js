// Magnetic Pull's route: the shortest way along the grooves from a marble to its own goal
// that a marble can actually roll. Closed gates and other colours' filters block it, ramps
// only go down and stairways only up; other marbles don't (they move, and the physics
// handles bumping into them).

import { sampleEdge, tangentAwayFrom } from './track.js';

const UPHILL = 0.05; // blocks of rise allowed along a route (none, apart from rounding)

const heightAt = (edge, s) => sampleEdge(edge, s).pos[1];

// Can a marble of `color` roll along `edge` from s=a to s=b right now?
function passable(sim, edge, a, b, color) {
  if (edge.lift) {
    if (Math.sign(b - a) !== edge.lift) return false;
  } else if (heightAt(edge, b) > heightAt(edge, a) + UPHILL) return false;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if ((sim.filters || []).some((f) => f.color !== color && f.edge === edge.id && f.s > lo && f.s < hi)) return false;
  return !sim.gates.some((g) => !g.open && g.edge === edge.id && g.s > lo && g.s < hi);
}

// Distance to the goal from every node, searching backwards from the goal.
function distancesTo(track, sim, goalEdge, color) {
  const dist = new Map();
  const start = goalEdge.n0; // the goal sits at the n1 end of its edge
  if (!passable(sim, goalEdge, 0, goalEdge.L, color)) return dist;
  dist.set(start, goalEdge.L);
  const queue = [[goalEdge.L, start]];
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, nodeId] = queue.shift();
    if (d > dist.get(nodeId)) continue;
    for (const link of track.nodes[nodeId].links) {
      const edge = track.edges[link.edge];
      if (edge.id === goalEdge.id) continue;
      // Rolling from the edge's other end to this node.
      const otherEnd = link.end === 0 ? 1 : 0;
      const from = otherEnd === 0 ? 0 : edge.L;
      const to = link.end === 0 ? 0 : edge.L;
      if (!passable(sim, edge, from, to, color)) continue;
      const other = otherEnd === 0 ? edge.n0 : edge.n1;
      const nd = d + edge.L;
      if (nd < (dist.get(other) ?? Infinity)) {
        dist.set(other, nd);
        queue.push([nd, other]);
      }
    }
  }
  return dist;
}

// The route for marble `m` (index into sim.marbles) to its goal, or null if none is open.
// { length, sign: +1 towards the edge's n1 end / -1 towards n0, next: { edge, end } | null }
export function routeFor(sim, m) {
  const track = sim.track;
  const goal = sim.goals.find((g) => g.color === m.color && !g.filled);
  if (!goal || m.delivered || m.lost) return null;
  const goalEdge = track.edges[goal.edge];
  const edge = track.edges[m.edge];
  if (edge.id === goalEdge.id) {
    return passable(sim, edge, m.s, edge.L, m.color) ? { length: edge.L - m.s, sign: 1, next: null } : null;
  }
  const dist = distancesTo(track, sim, goalEdge, m.color);
  // Leave this groove by either end, then take the best groove onwards from that node
  // (never straight back along this one).
  let best = null;
  for (const [end, nodeId, from, to] of [
    [1, edge.n1, m.s, edge.L],
    [0, edge.n0, m.s, 0],
  ]) {
    if (!passable(sim, edge, from, to, m.color)) continue;
    for (const link of track.nodes[nodeId].links) {
      if (link.edge === edge.id) continue;
      const e = track.edges[link.edge];
      let rest;
      if (e.id === goalEdge.id) rest = link.end === 0 && passable(sim, e, 0, e.L, m.color) ? e.L : Infinity;
      else {
        const otherNode = link.end === 0 ? e.n1 : e.n0;
        const away = link.end === 0 ? [0, e.L] : [e.L, 0];
        rest = dist.has(otherNode) && passable(sim, e, ...away, m.color) ? e.L + dist.get(otherNode) : Infinity;
      }
      const length = Math.abs(to - from) + rest;
      if (length < (best?.length ?? Infinity)) best = { length, sign: end === 1 ? 1 : -1, next: link };
    }
  }
  return best;
}

// The pull for marble `m`: a level push (machine coordinates) of `strength` along its route,
// turned towards the route's next groove as the marble nears a junction. Null if no route.
export function pullFor(sim, m, strength) {
  const route = routeFor(sim, m);
  if (!route) return null;
  const edge = sim.track.edges[m.edge];
  let dir = sampleEdge(edge, m.s).tangent.map((v) => v * route.sign);
  const toNode = route.sign > 0 ? edge.L - m.s : m.s;
  if (route.next && toNode < 0.35) dir = tangentAwayFrom(sim.track.edges[route.next.edge], route.next.end);
  const flat = [dir[0], 0, dir[2]];
  const l = Math.hypot(flat[0], flat[2]);
  if (l < 1e-6) return null;
  return [(flat[0] / l) * strength, 0, (flat[2] / l) * strength];
}
