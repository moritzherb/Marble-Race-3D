// Level generator: given a machine drawn with candidate spots, it searches for the hardest
// fair puzzle that machine can hold. A person still draws the machine and picks the result;
// this only places goals, plates, gates, shutters, colour filters, portals and marbles.
//
//   node tools/generate.mjs skeletons.mjs ring-yard [seed]
//
// A skeleton is a level map where `*` marks dead ends that may become goals or plates, and
// any straight groove may become a gate or shutter. Its fields:
//   marbles  how many marbles (colours are taken in order: blue, orange, green, purple, red)
//   locks    one entry per link, e.g. { gates: 1, shutters: 0, opener: 'plate' | 'band' | 'any', plates: 1 }
//   filters  how many colour filters to put on straight grooves (default 0)
//   portals  how many portal pairs to make out of dead ends (default 0)
//   starts   optional list of [x, y, z] cells marbles may start on (default: any straight,
//            curve or spare dead end)
//
// Each candidate is scored by the fewest moves it needs (more is better) and the number of
// shortest solutions (fewer is better), and rejected unless jamming each lock open would
// make the level shorter or break every shortcut (see lockEffect in solve.mjs). The best
// few are printed as JSON lines.

import { compileMap } from '../prototype/src/grid.js';
import { buildTrack } from '../prototype/src/track.js';
import { createSim } from '../prototype/src/sim.js';
import { solve, lockEffect, isRobust } from './solve.mjs';

const COLORS = ['blue', 'orange', 'green', 'purple', 'red'];
const GOAL_CH = { blue: 'b', orange: 'o', green: 'g', purple: 'p', red: 'r' };
const LINKS = ['A', 'B', 'C'];
const GATE_CH = { A: '1', B: '2', C: '3' };
const SHUTTER_CH = { A: 'x', B: 'y', C: 'z' };
const FILTER_CH = { blue: 'ⓑ', orange: 'ⓞ', green: 'ⓖ', purple: 'ⓟ', red: 'ⓡ' };
const PORTAL_CH = ['%', '&'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The cells of a skeleton that the generator may use.
export function cellsOf(skel) {
  const ends = [];
  const straights = [];
  const curves = [];
  skel.map.forEach((rows, y) =>
    rows.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        const above = skel.map[y + 1]?.[z]?.[x];
        const covered = above && above !== '.' && above !== ' ';
        if (ch === '*') ends.push([x, y, z]);
        else if ((ch === '─' || ch === '│') && !covered) straights.push([x, y, z]);
        else if ('┌┐└┘'.includes(ch)) curves.push([x, y, z]);
        else if (ch === '─' || ch === '│') curves.push([x, y, z]); // a tunnel straight: fine to start in, not for a gate
      }),
    ),
  );
  return { ends, straights, curves };
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// A random arrangement: goals and plates on dead ends, gates on straights, marbles anywhere free.
export function randomArrangementForTest(skel, cells, rand) {
  return randomArrangement(skel, cells, rand);
}

function randomArrangement(skel, cells, rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const shuffled = (list) => [...list].sort(() => rand() - 0.5);
  const ends = shuffled(cells.ends);
  const colors = COLORS.slice(0, skel.marbles);
  const goals = {};
  for (const c of colors) goals[c] = ends.pop();
  const plates = {};
  const bands = {};
  const gates = [];
  const straights = shuffled(cells.straights);
  (skel.locks || []).forEach((lock, i) => {
    const link = LINKS[i];
    const opener = lock.opener === 'any' ? (rand() < 0.5 ? 'plate' : 'band') : lock.opener || 'plate';
    if (opener === 'band' && Object.keys(bands).length < colors.length) {
      bands[link] = pick(colors.filter((c) => !Object.values(bands).includes(c)));
    } else {
      plates[link] = [];
      for (let k = 0; k < (lock.plates || 1); k++) if (ends.length) plates[link].push(ends.pop());
    }
    for (let k = 0; k < (lock.gates ?? 1); k++) if (straights.length) gates.push({ at: straights.pop(), link, inverse: false });
    for (let k = 0; k < (lock.shutters || 0); k++) if (straights.length) gates.push({ at: straights.pop(), link, inverse: true });
  });
  const filters = [];
  for (let k = 0; k < (skel.filters || 0); k++) if (straights.length) filters.push({ at: straights.pop(), color: pick(colors) });
  const portals = [];
  for (let k = 0; k < (skel.portals || 0); k++) if (ends.length >= 2) portals.push([ends.pop(), ends.pop()]);
  const arrangement = { goals, plates, bands, gates, filters, portals, marbles: {} };
  for (const c of colors) arrangement.marbles[c] = pick(freeStarts(skel, cells, arrangement, c));
  return arrangement;
}

function freeStarts(skel, cells, a, color) {
  const taken = [...Object.values(a.goals), ...a.gates.map((g) => g.at), ...(a.filters || []).map((f) => f.at), ...(a.portals || []).flat(), ...Object.entries(a.marbles).filter(([c]) => c !== color).map(([, at]) => at)];
  const free = (pool) => pool.filter((cell) => !taken.some((t) => t && same(t, cell)));
  const preferred = skel.starts ? free(skel.starts) : [];
  return preferred.length ? preferred : free([...cells.straights, ...cells.curves, ...cells.ends]);
}

// The level an arrangement describes.
export function levelOf(skel, a) {
  const map = skel.map.map((rows) => rows.map((row) => [...row]));
  const put = ([x, y, z], ch) => (map[y][z][x] = ch);
  for (const [color, at] of Object.entries(a.goals)) put(at, GOAL_CH[color]);
  for (const [link, list] of Object.entries(a.plates)) for (const at of list) put(at, link);
  for (const g of a.gates) put(g.at, g.inverse ? SHUTTER_CH[g.link] : GATE_CH[g.link]);
  for (const f of a.filters || []) put(f.at, FILTER_CH[f.color]);
  (a.portals || []).forEach((pair, i) => pair.forEach((at) => put(at, PORTAL_CH[i])));
  const level = {
    id: skel.id,
    name: skel.name || skel.id,
    map: map.map((rows) => rows.map((row) => row.join(''))),
    marbles: Object.entries(a.marbles).map(([color, at]) => ({ color, at })),
  };
  const bands = Object.fromEntries(Object.entries(a.bands).map(([link, color]) => [color, link]));
  if (Object.keys(bands).length) level.bands = bands;
  const c = compileMap(level);
  return { ...level, pieces: c.pieces, blocks: c.blocks, mapErrors: c.errors };
}

// Small random change to an arrangement.
function mutate(skel, cells, a, rand) {
  const b = structuredClone(a);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  b.filters ||= [];
  b.portals ||= [];
  const usedEnds = () => [...Object.values(b.goals), ...Object.values(b.plates).flat(), ...b.portals.flat()];
  const freeEnds = () => cells.ends.filter((e) => !usedEnds().some((u) => same(u, e)) && !Object.values(b.marbles).some((m) => same(m, e)));
  const freeStraights = () => cells.straights.filter((s) => !b.gates.some((g) => same(g.at, s)) && !b.filters.some((f) => same(f.at, s)) && !Object.values(b.marbles).some((m) => same(m, s)));
  const kinds = ['marble', 'marble', 'marble', 'goal', 'swapGoals', 'gate', 'plate', 'flip'];
  if (b.filters.length) kinds.push('filter', 'filter', 'recolor');
  if (b.portals.length) kinds.push('portal', 'portal');
  const kind = pick(kinds);
  if (kind === 'marble') {
    const c = pick(Object.keys(b.marbles));
    const options = freeStarts(skel, cells, b, c);
    if (options.length) b.marbles[c] = pick(options);
  } else if (kind === 'goal') {
    const c = pick(Object.keys(b.goals));
    const options = freeEnds();
    if (options.length) b.goals[c] = pick(options);
  } else if (kind === 'swapGoals') {
    const cs = Object.keys(b.goals);
    if (cs.length > 1) {
      const [p, q] = [pick(cs), pick(cs)];
      [b.goals[p], b.goals[q]] = [b.goals[q], b.goals[p]];
    }
  } else if (kind === 'gate' && b.gates.length) {
    const g = pick(b.gates);
    const options = freeStraights();
    if (options.length) g.at = pick(options);
  } else if (kind === 'plate' && Object.keys(b.plates).length) {
    const link = pick(Object.keys(b.plates));
    const options = freeEnds();
    if (options.length && b.plates[link].length) b.plates[link][Math.floor(rand() * b.plates[link].length)] = pick(options);
  } else if (kind === 'flip' && skel.flipShutters && b.gates.length) {
    const g = pick(b.gates);
    g.inverse = !g.inverse;
  } else if (kind === 'filter') {
    const f = pick(b.filters);
    const options = freeStraights();
    if (options.length) f.at = pick(options);
  } else if (kind === 'recolor') {
    pick(b.filters).color = pick(Object.keys(b.marbles));
  } else if (kind === 'portal') {
    const pair = pick(b.portals);
    const options = freeEnds();
    if (options.length) pair[Math.floor(rand() * 2)] = pick(options);
  }
  // Marbles must not sit on goals or gates after a move.
  for (const c of Object.keys(b.marbles)) {
    const at = b.marbles[c];
    if (Object.values(b.goals).some((g) => same(g, at)) || b.gates.some((g) => same(g.at, at)) || b.filters.some((f) => same(f.at, at)) || b.portals.flat().some((p) => same(p, at))) {
      const options = freeStarts(skel, cells, b, c);
      if (options.length) b.marbles[c] = pick(options);
    }
  }
  return b;
}

// Score: fewest moves first, then fewer shortest solutions. -1 if unsolvable, broken or
// if a lock has no purpose.
export function evaluate(skel, a, { depth = 12, maxStates = 3000 } = {}) {
  const level = levelOf(skel, a);
  const track = buildTrack(level);
  if (track.errors.length) return { score: -1, why: track.errors[0] };
  const sim = createSim(track);
  if (sim.marbles.some((m) => m.delivered)) return { score: -1, why: 'starts in goal' };
  const { wins } = solve(sim, depth, 30, maxStates);
  if (!wins.length) return { score: -1, why: 'no solution found' };
  const moves = wins[0].length;
  // Reference runs are kept under 14 s of the 30-second clock: the search's own run (tilts
  // held until everything stops) is about a fifth longer than an expert's, so anything much
  // over 16.5 s won't fit in 13.5.
  const runTime = (w) => w.reduce((t, st, i) => t + st.hold + (i < w.length - 1 ? st.release : 0), 0);
  const fastest = Math.min(...wins.map(runTime));
  if (fastest > (skel.maxRun || 16.5)) return { score: -1, why: `too slow (${fastest.toFixed(1)} s)`, moves };
  // At least one shortest solution must survive the sloppier timing of a real player.
  if (!wins.some((w) => isRobust(level, w))) return { score: -1, why: 'only timing-sensitive solutions', moves };
  const groups = [...new Set(level.pieces.filter((p) => p[0] === 'gate').map((p) => (p[5].inverse ? p[5].link.toLowerCase() : p[5].link)))];
  let rerouted = 0;
  for (const g of groups) {
    const link = g.toUpperCase();
    const inverse = g !== link;
    const open = { ...level, pieces: level.pieces.map((p) => (p[0] === 'gate' && p[5].link === link && Boolean(p[5].inverse) === inverse ? ['straight', p[1], p[2], p[3], p[4]] : p)) };
    const effect = lockEffect(sim, createSim(buildTrack(open)), moves, maxStates);
    if (effect === 'reroutes') rerouted++;
    else if (effect !== 'costs') return { score: -1, why: `lock ${g}: ${effect}`, moves };
  }
  // Every filter and portal pair must matter too: without it the level gets shorter, or
  // its shortcuts fail with it in place.
  const without = [
    ...(a.filters || []).map((f, i) => ['filter', { ...a, filters: a.filters.filter((_, k) => k !== i) }]),
    ...(a.portals || []).map((p, i) => ['portal', { ...a, portals: a.portals.filter((_, k) => k !== i) }]),
  ];
  for (const [what, b] of without) {
    const plain = levelOf(skel, b);
    const t = buildTrack(plain);
    if (t.errors.length) continue; // a portal pair the machine can't do without
    const effect = lockEffect(sim, createSim(t), moves, maxStates);
    if (effect === 'reroutes') rerouted++;
    else if (effect !== 'costs') return { score: -1, why: `${what}: ${effect}`, moves };
  }
  // A lock that only reroutes is a little weaker than one that costs moves.
  return { score: moves * 100 - Math.min(wins.length, 30) * 2 - rerouted * 5 - Math.max(0, fastest - 15) * 8, moves, ways: wins.length, run: fastest, level };
}

export function search(skel, { seed = 1, restarts = 4, steps = 80, log = () => {} } = {}) {
  const rand = rng(seed);
  const cells = cellsOf(skel);
  const archive = new Map();
  const cache = new Map();
  const score = (a) => {
    const key = JSON.stringify(a);
    if (!cache.has(key)) {
      const r = evaluate(skel, a, skel.search || {});
      cache.set(key, r);
      if (r.score > 0) archive.set(key, { a, ...r });
    }
    return cache.get(key);
  };
  for (let restart = 0; restart < restarts; restart++) {
    let a = randomArrangement(skel, cells, rand);
    let s = score(a);
    for (let tries = 0; s.score < 0 && tries < 40; tries++) {
      a = randomArrangement(skel, cells, rand);
      s = score(a);
    }
    for (let step = 0; step < steps; step++) {
      const b = mutate(skel, cells, a, rand);
      const sb = score(b);
      if (sb.score >= s.score) {
        a = b;
        s = sb;
      }
    }
    log(`restart ${restart}: best ${s.moves ?? '-'} moves, ${s.ways ?? '-'} ways`);
  }
  return [...archive.values()].sort((x, y) => y.score - x.score);
}

async function main() {
  const [file, id, seedArg] = process.argv.slice(2);
  const { SKELETONS } = await import(new URL(file, `file://${process.cwd()}/`).href);
  const skel = SKELETONS.find((s) => s.id === id);
  if (!skel) throw new Error(`no skeleton ${id}`);
  const found = search(skel, { seed: Number(seedArg || 1), ...(skel.budget || {}), log: (m) => console.error(`${id}: ${m}`) });
  // The best few at every difficulty, so one machine can serve several points on the curve.
  const seen = new Set();
  const perMoves = new Map();
  for (const r of found) {
    const key = `${r.moves}|${JSON.stringify(r.level.map)}|${JSON.stringify(r.level.marbles)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const n = perMoves.get(r.moves) || 0;
    if (n >= 8) continue;
    perMoves.set(r.moves, n + 1);
    console.log(JSON.stringify({ skeleton: id, moves: r.moves, ways: r.ways, run: Number(r.run.toFixed(1)), map: r.level.map, bands: r.level.bands, marbles: r.level.marbles }));
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
