import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, memoryStorage, clockText } from '../src/player.js';

const MIN = 60 * 1000;
function setup(initial) {
  const clock = { t: Date.UTC(2026, 0, 1, 12) };
  const storage = memoryStorage(initial);
  const player = createPlayer({ storage, now: () => clock.t });
  return { clock, storage, player };
}
// Play an attempt at level 11 (index 10) past the free window, then accept the loss.
function loseOne(player) {
  player.startAttempt('lvl', 10);
  player.stakeAttempt();
  return player.chargeAttempt();
}

// ---------- Lives and regeneration ----------

test('a new player has 5 of 5 lives and no countdown', () => {
  const { player } = setup();
  assert.deepEqual(player.lives(), { lives: 5, max: 5, nextIn: null });
});

test('losing a life at 5 starts a 15-minute countdown; one comes back after it', () => {
  const { clock, player } = setup();
  loseOne(player);
  assert.deepEqual(player.lives(), { lives: 4, max: 5, nextIn: 15 * MIN });
  clock.t += 14 * MIN;
  assert.equal(player.lives().lives, 4);
  assert.equal(player.lives().nextIn, 1 * MIN);
  clock.t += 1 * MIN;
  assert.deepEqual(player.lives(), { lives: 5, max: 5, nextIn: null });
});

test('losing more lives does not restart the running countdown', () => {
  const { clock, player } = setup();
  loseOne(player);
  clock.t += 10 * MIN;
  loseOne(player);
  assert.deepEqual(player.lives(), { lives: 3, max: 5, nextIn: 5 * MIN });
});

test('closed for 30 minutes at 2 lives: back at 4, with the countdown continuing', () => {
  const { clock, player } = setup();
  for (let i = 0; i < 3; i++) loseOne(player);
  assert.equal(player.lives().lives, 2);
  clock.t += 30 * MIN;
  // The game was closed: a fresh manager reads the same save.
  const { player: reopened } = { player: player };
  assert.deepEqual(reopened.lives(), { lives: 4, max: 5, nextIn: 15 * MIN });
});

test('regeneration stops at 5 and does not bank time for later losses', () => {
  const { clock, player } = setup();
  loseOne(player);
  clock.t += 3 * 60 * MIN; // three hours: only one life was missing
  assert.deepEqual(player.lives(), { lives: 5, max: 5, nextIn: null });
  loseOne(player);
  assert.deepEqual(player.lives(), { lives: 4, max: 5, nextIn: 15 * MIN }); // a fresh full period
});

test('reaching 5 while a countdown runs drops the leftover time', () => {
  const { clock, player } = setup();
  loseOne(player);
  loseOne(player);
  clock.t += 40 * MIN; // two periods (30 min) refill to 5; the extra 10 min is dropped
  assert.deepEqual(player.lives(), { lives: 5, max: 5, nextIn: null });
  loseOne(player);
  assert.equal(player.lives().nextIn, 15 * MIN);
});

test('moving the device clock back grants nothing and restarts the period', () => {
  const { clock, player } = setup();
  loseOne(player);
  clock.t -= 60 * MIN;
  assert.deepEqual(player.lives(), { lives: 4, max: 5, nextIn: 15 * MIN });
  clock.t += 15 * MIN;
  assert.equal(player.lives().lives, 5);
});

test('regeneration survives a reload of the save', () => {
  const { clock, storage, player } = setup();
  loseOne(player);
  loseOne(player);
  clock.t += 20 * MIN;
  const reopened = createPlayer({ storage, now: () => clock.t });
  assert.deepEqual(reopened.lives(), { lives: 4, max: 5, nextIn: 10 * MIN });
});

// ---------- What costs a life ----------

test('levels 1-10 never cost a life and can be played with none', () => {
  const { player } = setup();
  player.setLives(0);
  assert.equal(player.canPlay(0), true);
  assert.equal(player.canPlay(9), true);
  assert.equal(player.canPlay(10), false);
  player.startAttempt('first-tilt', 0);
  player.stakeAttempt();
  player.loseAttempt();
  assert.deepEqual(player.chargeAttempt(), { charged: false, lives: 0 });
});

test('giving up inside the free window costs nothing; after it, one life', () => {
  const { player } = setup();
  player.startAttempt('lvl', 10);
  assert.equal(player.attemptAtRisk(), false);
  assert.deepEqual(player.chargeAttempt(), { charged: false, lives: 5 });
  player.startAttempt('lvl', 10);
  player.stakeAttempt();
  assert.equal(player.attemptAtRisk(), true);
  assert.equal(player.chargeAttempt().charged, true);
  assert.equal(player.lives().lives, 4);
});

test('a win never costs a life', () => {
  const { player } = setup();
  player.startAttempt('lvl', 10);
  player.stakeAttempt();
  player.clearAttempt();
  assert.equal(player.chargeAttempt().charged, false);
  assert.equal(player.lives().lives, 5);
});

test('one failure costs one life, even if it is charged twice', () => {
  const { player } = setup();
  player.startAttempt('lvl', 10);
  player.loseAttempt();
  assert.equal(player.chargeAttempt().charged, true);
  assert.equal(player.chargeAttempt().charged, false);
  assert.equal(player.lives().lives, 4);
});

test('carrying on after the clock ran out costs no life; failing again costs one', () => {
  const { player } = setup();
  player.startAttempt('lvl', 10);
  player.loseAttempt();
  player.resumeAttempt(); // second chance
  assert.equal(player.attemptLost(), false);
  assert.equal(player.lives().lives, 5);
  player.loseAttempt(); // ran out again
  player.chargeAttempt();
  assert.equal(player.lives().lives, 4);
});

test('at 0 lives levels from 11 on cannot start', () => {
  const { player } = setup();
  for (let i = 0; i < 5; i++) loseOne(player);
  assert.equal(player.lives().lives, 0);
  assert.equal(player.canPlay(10), false);
});

test('closing the game mid-attempt or on the Time\'s up card is charged once at the next launch', () => {
  for (const how of ['staked', 'lost']) {
    const { clock, storage, player } = setup();
    player.startAttempt('lvl', 10);
    if (how === 'staked') player.stakeAttempt();
    else player.loseAttempt();
    const relaunched = createPlayer({ storage, now: () => clock.t });
    assert.deepEqual(relaunched.recover(), { charged: true, lives: 4, level: 'lvl' });
    assert.deepEqual(relaunched.recover(), { charged: false, lives: 4 });
  }
  const { player } = setup();
  player.startAttempt('lvl', 10); // still in the free window
  assert.equal(player.recover().charged, false);
});

// ---------- Saving ----------

test('a damaged save falls back to safe defaults', () => {
  const { player } = setup({ v: 1, lives: 'lots', regenFrom: 'soon', attempt: { level: 3 }, seen: null });
  assert.deepEqual(player.lives(), { lives: 5, max: 5, nextIn: null });
  assert.equal(player.attemptAtRisk(), false);
});

test('first-time notes are remembered', () => {
  const { storage, clock, player } = setup();
  assert.equal(player.seen('lives'), false);
  player.markSeen('lives');
  assert.equal(createPlayer({ storage, now: () => clock.t }).seen('lives'), true);
});

test('clock text', () => {
  assert.equal(clockText(8 * MIN + 42000), '08:42');
  assert.equal(clockText(500), '00:01');
  assert.equal(clockText(-5), '00:00');
});
