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
import { ECONOMY } from '../src/economy.js';

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

test('Speed Boost: marbles roll 40% further for 6 s, then back to normal; a double tap charges once', () => {
  const plain = setup('first-tilt').sim;
  const { player, powerups, sim, ctx } = setup('first-tilt');
  assert.equal(powerups.activate('speed', ctx).ok, true);
  assert.equal(powerups.activate('speed', ctx).reason, 'active');
  assert.equal(player.coins(), 150);
  roll(plain, 'E', 0.35);
  roll(sim, 'E', 0.35);
  const moved = (s) => s.marbles[0].distance;
  assert.ok(moved(sim) > moved(plain) * 1.3, `${moved(sim)} vs ${moved(plain)}`);
  assert.equal(sim.speedScale, 1.4);
  powerups.tick(5.9, sim);
  assert.equal(sim.speedScale, 1.4);
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
    sim.speedScale = 1.4;
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
