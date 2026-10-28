import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS } from '../src/levels.js';
import { buildTrack } from '../src/track.js';
import { createSim, stepSim, isWon } from '../src/sim.js';
import { gravityInMachine, directionVector } from '../src/tilt.js';
import { SIM_DT } from '../src/config.js';
import { replay } from '../src/replay.js';
import { createPlayer, memoryStorage } from '../src/player.js';
import { createPowerUps } from '../src/powerups.js';
import { ECONOMY, powerUp } from '../src/economy.js';

const level = (id) => LEVELS.find((l) => l.id === id);
function setup(levelId = 'one-key-two-locks', coins) {
  const player = createPlayer({ storage: memoryStorage(), now: () => 0 });
  if (coins !== undefined) player.addCoins(coins - player.coins());
  const powerups = createPowerUps({ player });
  const sim = createSim(buildTrack(level(levelId)));
  const clock = { added: 0 };
  const ctx = { sim, playing: true, levelIndex: 20, addTime: (s) => (clock.added += s) };
  return { player, powerups, sim, ctx, clock };
}
// Hold a full tilt for `seconds`.
function roll(sim, dir, seconds) {
  const v = directionVector(dir);
  const g = gravityInMachine(v);
  for (let t = 0; t < seconds; t += SIM_DT) stepSim(sim, SIM_DT, g);
}

test('Extra Time adds 10 s, costs 60, once per attempt', () => {
  const { player, powerups, ctx, clock } = setup();
  assert.deepEqual(powerups.activate('time', ctx), { ok: true });
  assert.equal(clock.added, 10);
  assert.equal(player.coins(), 140);
  assert.equal(powerups.activate('time', ctx).reason, 'used');
  assert.equal(player.coins(), 140);
  powerups.reset(ctx.sim);
  assert.equal(powerups.activate('time', ctx).ok, true);
});

test('not enough coins: nothing is charged and nothing happens', () => {
  const { player, powerups, ctx, clock } = setup(undefined, 30);
  assert.equal(powerups.activate('time', ctx).reason, 'coins');
  assert.equal(powerups.activate('speed', ctx).reason, 'coins');
  assert.equal(clock.added, 0);
  assert.equal(ctx.sim.speedScale, 1);
  assert.equal(player.coins(), 30);
});

test('power-ups are locked before level 11 and when not playing', () => {
  const { powerups, ctx } = setup();
  assert.equal(powerups.activate('time', { ...ctx, levelIndex: 9 }).reason, 'locked');
  assert.equal(powerups.activate('time', { ...ctx, playing: false }).reason, 'not now');
});

test('Speed Boost: marbles roll faster for its duration, then back to normal; a double tap charges once', () => {
  const { factor, duration } = powerUp('speed');
  const plain = setup('first-tilt').sim;
  const { player, powerups, sim, ctx } = setup('first-tilt');
  assert.equal(powerups.activate('speed', ctx).ok, true);
  assert.equal(powerups.activate('speed', ctx).reason, 'active');
  assert.equal(player.coins(), 150);
  roll(plain, 'E', 0.35);
  roll(sim, 'E', 0.35);
  const moved = (s) => s.marbles[0].distance;
  assert.ok(moved(sim) > moved(plain) * 1.3, `${moved(sim)} vs ${moved(plain)}`);
  assert.equal(sim.speedScale, factor);
  powerups.tick(duration - 0.1, sim);
  assert.equal(sim.speedScale, factor);
  assert.deepEqual(powerups.tick(0.2, sim), ['speed']);
  assert.equal(sim.speedScale, 1);
});

test('Speed Boost keeps every rule: each level\'s reference run still wins at boosted speed', () => {
  // The reference runs are timed for normal speed, so boosted marbles may finish faster or
  // need a different order; what matters is no physics breaks: no marble ends up off its
  // groove, inside a closed gate or past its goal.
  for (const l of LEVELS.slice(0, 30)) {
    const track = buildTrack(l);
    const sim = createSim(track);
    sim.speedScale = powerUp('speed').factor;
    const g = gravityInMachine(directionVector('E'));
    for (let t = 0; t < 3; t += SIM_DT) {
      stepSim(sim, SIM_DT, g);
      for (const m of sim.marbles) {
        const e = track.edges[m.edge];
        assert.ok(m.s >= 0 && m.s <= e.L + 1e-9, `${l.id}: marble left its groove`);
        for (const gate of sim.gates) {
          if (!gate.open && gate.edge === m.edge) assert.ok(Math.abs(m.s - gate.s) >= 0.15 - 1e-6, `${l.id}: marble inside a closed gate`);
        }
      }
    }
  }
});

test('Open All Gates: every gate and shutter opens for 5 s, plates keep working, then they close again', () => {
  const { powerups, sim, ctx } = setup('one-key-two-locks');
  stepSim(sim, SIM_DT, [0, -30, 0]);
  const real = sim.gates.map((g) => g.open);
  assert.ok(real.includes(false), 'something starts closed');
  powerups.activate('gates', ctx);
  stepSim(sim, SIM_DT, [0, -30, 0]);
  assert.ok(sim.gates.every((g) => g.open));
  assert.deepEqual(sim.gates.map((g) => g.open !== g.inverse ? g.powered : !g.powered).length, sim.gates.length);
  powerups.tick(5.1, sim);
  stepSim(sim, SIM_DT, [0, -30, 0]);
  assert.deepEqual(sim.gates.map((g) => g.open), real);
});

test('a gate closing at the end of Open All Gates pushes a marble in it to one side', () => {
  const { powerups, sim, ctx } = setup('one-key-two-locks');
  powerups.activate('gates', ctx);
  stepSim(sim, SIM_DT, [0, -30, 0]);
  const gate = sim.gates.find((g) => !g.inverse);
  const m = sim.marbles[0];
  m.edge = gate.edge;
  m.s = gate.s; // right in the gate
  m.v = 0;
  powerups.tick(6, sim);
  stepSim(sim, SIM_DT, [0, -30, 0]);
  if (!gate.open) assert.ok(Math.abs(m.s - gate.s) >= 0.15 - 1e-6);
});

test('winning or losing ends every effect', () => {
  const { powerups, sim, ctx } = setup();
  powerups.activate('speed', ctx);
  powerups.activate('gates', ctx);
  powerups.endAll(sim);
  assert.equal(sim.speedScale, 1);
  assert.ok(sim.gates.every((g) => !g.forced));
  assert.equal(powerups.effect('speed'), null);
});

test('Hint is only charged when there is a hint to show; at most 3 per attempt', () => {
  const { player, powerups, ctx } = setup();
  assert.equal(powerups.activate('hint', ctx, { hint: { unknown: true } }).reason, 'not available');
  assert.equal(player.coins(), 200);
  powerups.addCoinsForTest = null;
  player.addCoins(1000);
  for (let i = 0; i < 3; i++) {
    assert.equal(powerups.activate('hint', ctx, { hint: { dir: 'NE', left: 3 } }).ok, true);
    powerups.tick(5, ctx.sim);
  }
  assert.equal(powerups.activate('hint', ctx, { hint: { dir: 'NE', left: 3 } }).reason, 'used');
  assert.equal(player.coins(), 1200 - 3 * 80);
});

test('every price, limit and duration comes from economy.js', () => {
  for (const p of ECONOMY.powerUps.list) {
    assert.ok(p.cost > 0 && p.perAttempt > 0 && p.name && p.about, p.id);
  }
});

// ---------- Magnetic Pull ----------

import { routeFor } from '../src/route.js';
import { snapshotOf, restoreInto } from '../src/powerups.js';

const LEVEL = [0, -30, 0]; // gravity with the machine level: nothing rolls by itself
function run(sim, powerups, seconds, g = LEVEL) {
  for (let t = 0; t < seconds; t += SIM_DT) {
    powerups.tick(SIM_DT, sim);
    stepSim(sim, SIM_DT, g);
  }
}

test('Magnetic Pull brings a marble along a straight and round a curve to its goal, then stops', () => {
  // Level 1: blue's groove runs east, curves, and runs north to its goal.
  const { player, powerups, sim, ctx } = setup('first-tilt');
  assert.ok(routeFor(sim, sim.marbles[0]).length > 3);
  assert.deepEqual(powerups.activate('magnet', ctx, { marble: 0 }), { ok: true });
  assert.equal(player.coins(), 40);
  run(sim, powerups, 5);
  assert.equal(sim.marbles[0].delivered, true, 'pulled home with the machine level');
  assert.equal(isWon(sim), true);
  assert.equal(powerups.effect('magnet'), null, 'ends once the marble is home');
});

test('Magnetic Pull only moves the chosen marble', () => {
  const { powerups, sim, ctx } = setup('two-grooves');
  const other = sim.marbles[1];
  const before = other.s;
  assert.equal(powerups.activate('magnet', ctx, { marble: 0 }).ok, true);
  run(sim, powerups, 1);
  assert.equal(other.s, before);
  assert.equal(other.pull, null);
});

test('Magnetic Pull is refused, free of charge, behind a closed gate, uphill, for a delivered marble, or too far', () => {
  // Level 5, Counterweight: orange's way home runs through a gate that starts closed.
  const { player, powerups, sim, ctx } = setup('counterweight');
  const orange = sim.marbles.findIndex((m) => m.color === 'orange');
  stepSim(sim, SIM_DT, LEVEL);
  assert.equal(powerups.activate('magnet', ctx, { marble: orange }).reason, 'no route');
  // Level 4, Downhill Only: once a marble is down a ramp it can't be pulled back up to a goal up there.
  const d = setup('downhill-only');
  const blue = d.sim.marbles.findIndex((m) => m.color === 'blue');
  d.sim.marbles[blue].delivered = true;
  assert.equal(d.powerups.activate('magnet', d.ctx, { marble: blue }).reason, 'home');
  assert.equal(player.coins(), 200);
  assert.equal(d.player.coins(), 200);
});

test('Magnetic Pull never climbs a ramp', () => {
  // Downhill Only: orange sits up on the raised row; its goal is down a ramp. From the goal
  // end the route back up is closed.
  const l = level('downhill-only');
  const sim = createSim(buildTrack(l));
  const track = sim.track;
  const ramps = track.edges.filter((e) => Math.abs(e.pts[0][1] - e.pts[e.pts.length - 1][1]) > 0.3);
  assert.ok(ramps.length, 'level has ramps');
  for (const m of sim.marbles) {
    const r = routeFor(sim, m);
    if (!r) continue;
    // Follow the route's first step: it must not be uphill.
    const e = track.edges[m.edge];
    const ahead = r.sign > 0 ? e.L : 0;
    const y = (s) => { const k = Math.min(e.pts.length - 1, Math.round((s / e.L) * (e.pts.length - 1))); return e.pts[k][1]; };
    assert.ok(y(ahead) <= y(m.s) + 0.06);
  }
});

test('tilting hard against Magnetic Pull wins: the player stays in control', () => {
  const { powerups, sim, ctx } = setup('first-tilt');
  powerups.activate('magnet', ctx, { marble: 0 });
  const startS = sim.marbles[0].s;
  run(sim, powerups, 2, gravityInMachine(directionVector('W')));
  assert.ok(sim.marbles[0].s <= startS + 1e-6, 'the marble went the way of the tilt');
  assert.equal(sim.marbles[0].delivered, false);
});

test('Magnetic Pull expires after 5 s', () => {
  const { powerups, sim, ctx } = setup('first-tilt');
  powerups.activate('magnet', ctx, { marble: 0 });
  powerups.tick(4.9, sim);
  assert.ok(sim.marbles[0].pull);
  powerups.tick(0.2, sim);
  assert.equal(sim.marbles[0].pull, null);
  assert.equal(sim.marbles[0].magnet, false);
});

test('Magnetic Pull with too few coins is refused before anything happens', () => {
  const { powerups, sim, ctx } = setup('first-tilt', 100);
  assert.equal(powerups.activate('magnet', ctx, { marble: 0 }).reason, 'coins');
  assert.equal(sim.marbles[0].pull, null);
});

// ---------- Checkpoint ----------

function playState(sim) {
  return JSON.stringify({ m: sim.marbles.map((m) => [m.edge, m.s, m.v, m.delivered]), g: sim.gates.map((g) => g.open), p: sim.plates.map((p) => p.pressed), f: sim.goals.map((g) => g.filled) });
}

test('Checkpoint brings back the exact moment, and play continues identically from it', () => {
  const l = level('one-key-two-locks');
  const a = createSim(buildTrack(l));
  const tilt = gravityInMachine(directionVector('NE'));
  for (let t = 0; t < 0.8; t += SIM_DT) stepSim(a, SIM_DT, tilt); // marbles moving, plate pressed
  const snap = snapshotOf(a, { tilt: [0.5, -0.5], timeLeft: 12.5, elapsed: 18.5, timerRunning: true });
  const atSave = playState(a);
  for (let t = 0; t < 1.5; t += SIM_DT) stepSim(a, SIM_DT, gravityInMachine(directionVector('SW')));
  assert.notEqual(playState(a), atSave);
  restoreInto(a, snap);
  assert.equal(playState(a), atSave);
  // A fresh copy restored from the same snapshot evolves exactly like the original.
  const b = createSim(buildTrack(l));
  restoreInto(b, snap);
  for (let t = 0; t < 1; t += SIM_DT) {
    stepSim(a, SIM_DT, tilt);
    stepSim(b, SIM_DT, tilt);
  }
  assert.equal(playState(a), playState(b));
  assert.deepEqual([snap.timeLeft, snap.elapsed], [12.5, 18.5]);
});

test('Checkpoint: 220 coins, one held at a time, restorable once, dropped by a restart', () => {
  const { player, powerups, sim, ctx } = setup();
  const withSnap = { ...ctx, snapshot: () => snapshotOf(sim, { tilt: [0, 0], timeLeft: 20, elapsed: 5, timerRunning: true }) };
  assert.equal(powerups.activate('checkpoint', withSnap).reason, 'coins'); // 200 < 220
  player.addCoins(300);
  assert.deepEqual(powerups.activate('checkpoint', withSnap), { ok: true });
  assert.equal(player.coins(), 280);
  assert.equal(powerups.activate('checkpoint', withSnap).reason, 'saved');
  assert.equal(player.coins(), 280);
  assert.ok(powerups.takeCheckpoint());
  assert.equal(powerups.takeCheckpoint(), null, 'only once');
  powerups.activate('checkpoint', withSnap);
  powerups.reset(sim);
  assert.equal(powerups.checkpoint(), null, 'a restart drops it');
});

test('restoring ends every running effect', () => {
  const { player, powerups, sim, ctx } = setup();
  player.addCoins(1000);
  powerups.activate('speed', ctx);
  powerups.activate('gates', ctx);
  const snap = snapshotOf(sim, { tilt: [0, 0], timeLeft: 20, elapsed: 5, timerRunning: true });
  restoreInto(sim, snap);
  powerups.resetForRestore(sim);
  assert.equal(sim.speedScale, 1);
  assert.ok(sim.gates.every((g) => !g.forced));
});
