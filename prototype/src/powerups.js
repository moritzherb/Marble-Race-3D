// Power-ups: when each may be used, paying for it, and its effect on the simulation.
// Prices, durations and limits come from economy.js (docs/economy.md has the reasoning).
//
// A power-up is bought and switched on in one step (player.pay): if it can't be switched on,
// nothing is charged. Timed effects count down in play time, so they pause with the game,
// and they all end when the level is won or lost.

import { ECONOMY, powerUp } from './economy.js';
import { PHYSICS } from './config.js';
import { routeFor, pullFor } from './route.js';

// Everything that describes a moment of play, so a checkpoint can bring it back exactly. The
// rail physics is fully described by these numbers: there are no physics bodies to re-sync.
export function snapshotOf(sim, play) {
  return {
    marbles: sim.marbles.map((m) => ({ edge: m.edge, s: m.s, v: m.v, delivered: m.delivered, lost: m.lost, stall: m.stall, pos: [...m.pos], tangent: [...m.tangent], distance: m.distance })),
    goals: sim.goals.map((g) => g.filled),
    plates: sim.plates.map((p) => p.pressed),
    gates: sim.gates.map((g) => ({ open: g.open, powered: g.powered })),
    time: sim.time,
    tilt: [...play.tilt],
    timeLeft: play.timeLeft,
    elapsed: play.elapsed,
    timerRunning: play.timerRunning,
  };
}

// Put a snapshot back into `sim` (same level). Power-up effects are not part of it.
export function restoreInto(sim, snap) {
  sim.marbles.forEach((m, i) => {
    Object.assign(m, snap.marbles[i], { pos: [...snap.marbles[i].pos], tangent: [...snap.marbles[i].tangent], pull: null, magnet: false });
  });
  sim.goals.forEach((g, i) => (g.filled = snap.goals[i]));
  sim.plates.forEach((p, i) => (p.pressed = snap.plates[i]));
  sim.gates.forEach((g, i) => Object.assign(g, snap.gates[i], { forced: false }));
  sim.time = snap.time;
  sim.speedScale = 1;
}

export function createPowerUps({ player, config = ECONOMY }) {
  let uses = {}; // uses in the current attempt, by power-up id
  const effects = {}; // running timed effects, by id: { left, total, ... }
  let checkpoint = null; // a saved moment of this level, until restored once or the level is left
  const def = (id) => {
    const d = powerUp(id, config);
    if (!d) throw new Error(`Unknown power-up "${id}"`);
    return d;
  };

  // Why `id` can't be used now, or null. ctx: { playing, levelIndex }.
  function blocker(id, ctx) {
    const d = def(id);
    if (ctx.levelIndex + 1 < config.powerUps.unlockLevel) return 'locked';
    if (!ctx.playing) return 'not now';
    if (effects[id]) return 'active';
    if (id === 'checkpoint' && checkpoint) return 'saved';
    if ((uses[id] || 0) >= d.perAttempt) return 'used';
    if (player.coins() < d.cost) return 'coins';
    return null;
  }

  // What each power-up does when bought. Returning false cancels the purchase.
  const START = {
    time: (d, ctx) => {
      ctx.addTime(d.seconds);
      return true;
    },
    speed: (d) => {
      effects.speed = { left: d.duration, total: d.duration };
      return true;
    },
    gates: (d) => {
      effects.gates = { left: d.duration, total: d.duration };
      return true;
    },
    // extra.marble: index of the chosen marble. Refused (and not charged) without a route.
    magnet: (d, ctx, extra) => {
      const m = ctx.sim.marbles[extra?.marble];
      if (!m) return { ok: false, reason: 'no marble' };
      if (m.delivered) return { ok: false, reason: 'home' };
      const route = routeFor(ctx.sim, m);
      if (!route) return { ok: false, reason: 'no route' };
      if (route.length > d.maxRoute) return { ok: false, reason: 'far' };
      effects.magnet = { left: d.duration, total: d.duration, marble: extra.marble };
      return true;
    },
    // ctx.snapshot(): the moment to keep (see snapshotOf).
    checkpoint: (d, ctx) => {
      const snap = ctx.snapshot?.();
      if (!snap) return false;
      checkpoint = snap;
      return true;
    },
    // extra.hint: a direction already found by hints.js (finding none is never charged).
    hint: (d, ctx, extra) => {
      if (!extra?.hint?.dir) return false;
      effects.hint = { left: d.duration, total: d.duration, dir: extra.hint.dir };
      return true;
    },
  };

  const api = {
    // The power-ups that have an effect written for them (an entry in economy.js alone shows nothing).
    list: () => config.powerUps.list.filter((p) => START[p.id]),
    blocker,
    uses: (id) => uses[id] || 0,
    effect: (id) => effects[id] || null,

    // Buy and start `id`. Resolves { ok, reason }; reason 'coins', 'used', 'active', ...
    activate(id, ctx, extra) {
      const d = def(id);
      const before = blocker(id, ctx);
      if (before && before !== 'coins') return { ok: false, reason: before };
      const start = START[id];
      if (!start) return { ok: false, reason: 'unknown' };
      const paid = player.pay(d.cost, d.name, () => {
        if ((uses[id] || 0) >= d.perAttempt || effects[id]) return false;
        const started = start(d, ctx, extra);
        if (started === false || started?.ok === false) return started;
        uses[id] = (uses[id] || 0) + 1;
        return true;
      });
      if (paid.ok) api.apply(ctx.sim);
      return paid.ok ? { ok: true } : { ok: false, reason: paid.reason === 'not applied' ? 'not available' : paid.reason, need: paid.need };
    },

    // Count timed effects down by `dt` seconds of play; returns the ids that just ended.
    tick(dt, sim) {
      const ended = [];
      for (const [id, e] of Object.entries(effects)) {
        e.left -= dt;
        // Magnetic Pull also ends the moment its marble is home.
        if (id === 'magnet' && sim.marbles[e.marble]?.delivered) e.left = 0;
        if (e.left <= 0) {
          delete effects[id];
          ended.push(id);
        }
      }
      api.apply(sim);
      return ended;
    },

    // Put the running effects onto the simulation.
    apply(sim) {
      if (!sim) return;
      sim.speedScale = effects.speed ? def('speed').factor : 1;
      for (const g of sim.gates) g.forced = Boolean(effects.gates);
      // Magnetic Pull: a push along the route for one marble, as strong as `strength` of a
      // full tilt. Recomputed every step, so it follows gates opening and closing.
      const mag = effects.magnet;
      const full = PHYSICS.gravity * Math.sin((PHYSICS.maxTiltDeg * Math.PI) / 180);
      sim.marbles.forEach((m, i) => {
        const on = Boolean(mag && mag.marble === i && !m.delivered);
        m.magnet = on;
        m.pull = on ? pullFor(sim, m, def('magnet').strength * full) : null;
      });
    },

    // Checkpoint: whether one is saved, and taking it (once) to restore.
    checkpoint: () => checkpoint,
    takeCheckpoint() {
      const snap = checkpoint;
      checkpoint = null;
      return snap;
    },

    // The level ended (won or lost): every effect stops.
    endAll(sim) {
      for (const id of Object.keys(effects)) delete effects[id];
      api.apply(sim);
    },

    // A new attempt: uses start again, nothing is running, and any checkpoint is dropped.
    reset(sim) {
      uses = {};
      checkpoint = null;
      api.endAll(sim);
    },
    // Carrying on from a restored checkpoint: limits start again, the checkpoint is used up.
    resetForRestore(sim) {
      uses = {};
      api.endAll(sim);
    },
  };
  return api;
}
