// Power-ups: when each may be used, paying for it, and its effect on the simulation.
// Prices, durations and limits come from economy.js (docs/economy.md has the reasoning).
//
// A power-up is bought and switched on in one step (player.pay): if it can't be switched on,
// nothing is charged. Timed effects count down in play time, so they pause with the game,
// and they all end when the level is won or lost.

import { ECONOMY, powerUp } from './economy.js';

export function createPowerUps({ player, config = ECONOMY }) {
  let uses = {}; // uses in the current attempt, by power-up id
  const effects = {}; // running timed effects, by id: { left, total, ... }
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
        if (start(d, ctx, extra) === false) return false;
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
    },

    // The level ended (won or lost): every effect stops.
    endAll(sim) {
      for (const id of Object.keys(effects)) delete effects[id];
      api.apply(sim);
    },

    // A new attempt: uses start again and nothing is running.
    reset(sim) {
      uses = {};
      api.endAll(sim);
    },
  };
  return api;
}
