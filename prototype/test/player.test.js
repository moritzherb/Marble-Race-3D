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

// ---------- Gold coins ----------

test('a new player starts with 200 coins', () => {
  assert.equal(setup().player.coins(), 200);
});

test('level rewards: base by chapter, half the base again for 2 and for 3 stars', () => {
  const { player } = setup();
  assert.deepEqual(player.rewardFor(0), { base: 20, two: 10, three: 10, total: 40 });
  assert.deepEqual(player.rewardFor(19), { base: 30, two: 15, three: 15, total: 60 });
  assert.deepEqual(player.rewardFor(99), { base: 70, two: 35, three: 35, total: 140 });
  let sum = 0;
  for (let i = 0; i < 100; i++) sum += player.rewardFor(i).total;
  assert.equal(sum, 9600);
});

test('a completion pays once; better stars later pay only the difference; replays pay nothing', () => {
  const { player } = setup();
  assert.deepEqual(player.grantLevel('lvl', 10, 1), { total: 30, parts: [{ amount: 30, why: 'Completed' }], coins: 230 });
  assert.equal(player.grantLevel('lvl', 10, 1).total, 0); // replay, or the same event twice
  assert.deepEqual(player.grantLevel('lvl', 10, 3).parts, [{ amount: 15, why: '2 stars' }, { amount: 15, why: '3 stars' }]);
  assert.equal(player.grantLevel('lvl', 10, 3).total, 0);
  assert.equal(player.coins(), 260);
  assert.equal(player.remaining('lvl', 10), 0);
  assert.equal(player.remaining('other', 10), 60);
});

test('levels finished before coins existed do not pay again', () => {
  const clock = { t: 0 };
  const player = createPlayer({ storage: memoryStorage(), now: () => clock.t, legacyPaid: () => ({ old: 2 }) });
  assert.equal(player.grantLevel('old', 10, 2).total, 0);
  assert.equal(player.grantLevel('old', 10, 3).total, 15);
});

test('buying a life: needs the coins and a free slot; coins and life change together', () => {
  const { player } = setup();
  assert.deepEqual(player.buyLife(), { ok: false, reason: 'full', coins: 200 }); // at 5 lives
  loseOne(player);
  loseOne(player);
  const r = player.buyLife();
  assert.equal(r.ok, true);
  assert.equal(player.coins(), 50);
  assert.equal(player.lives().lives, 4);
  assert.deepEqual(player.buyLife(), { ok: false, reason: 'coins', coins: 50, need: 100 });
  assert.equal(player.lives().lives, 4);
});

test('buying the life that fills up clears the countdown; one below max keeps it running', () => {
  const { clock, player } = setup();
  player.addCoins(1000);
  loseOne(player);
  clock.t += 5 * MIN;
  loseOne(player);
  player.buyLife();
  assert.deepEqual(player.lives(), { lives: 4, max: 5, nextIn: 10 * MIN });
  player.buyLife();
  assert.deepEqual(player.lives(), { lives: 5, max: 5, nextIn: null });
});

test('pay: nothing is taken if the purchase cannot be applied, or without enough coins', () => {
  const { player } = setup();
  let applied = 0;
  assert.deepEqual(player.pay(50, 'test', () => false), { ok: false, reason: 'not applied', coins: 200 });
  assert.deepEqual(player.pay(500, 'test', () => applied++), { ok: false, reason: 'coins', coins: 200, need: 300 });
  assert.equal(applied, 0);
  assert.equal(player.pay(50, 'test', () => applied++).ok, true);
  assert.equal(applied, 1);
  assert.equal(player.coins(), 150);
});

test('an interrupted purchase leaves the save as it was', () => {
  const { storage, clock, player } = setup();
  loseOne(player);
  const before = JSON.stringify(storage.peek());
  assert.throws(() =>
    player.pay(50, 'test', (s) => {
      s.lives = 5;
      throw new Error('app killed mid-purchase');
    }),
  );
  assert.equal(JSON.stringify(storage.peek()), before);
  assert.equal(createPlayer({ storage, now: () => clock.t }).coins(), 200);
});

test('coins and paid levels survive a reload; bad values are dropped', () => {
  const { storage, clock, player } = setup();
  player.grantLevel('lvl', 10, 2);
  const again = createPlayer({ storage, now: () => clock.t });
  assert.equal(again.coins(), 245);
  assert.equal(again.remaining('lvl', 10), 15);
  const damaged = setup({ v: 1, coins: -40, paid: { a: 9, b: 2 } }).player;
  assert.equal(damaged.coins(), 200);
  assert.equal(damaged.remaining('a', 10), 60);
  assert.equal(damaged.remaining('b', 10), 15);
});

test('the ad multiplier bonus adds whole coins once per call and refuses nonsense', () => {
  const { player } = setup();
  const before = player.coins();
  assert.deepEqual(player.grantBonus(60, 'ad x3'), { ok: true, coins: before + 60 });
  assert.equal(player.grantBonus(0, 'nothing').ok, false);
  assert.equal(player.grantBonus(-5, 'negative').ok, false);
  assert.equal(player.grantBonus(2.5, 'fraction').ok, false);
  assert.equal(player.coins(), before + 60);
});
