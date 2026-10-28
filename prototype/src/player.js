// The player's resources: lives (and their regeneration), the attempt that may cost one, and
// gold coins (level rewards and spending).
// Rules and numbers come from economy.js; docs/economy.md explains them.
//
// Everything is one saved object. Each change reads it, changes it and writes it back in a
// single synchronous step, so a change is saved completely or not at all, and two changes
// can't interleave. Time is passed in (`now`), so tests can move the clock.

import { ECONOMY } from './economy.js';

const KEY = 'mmr-player';
const MINUTE = 60 * 1000;

// Browser storage. It can be missing (private windows, blocked storage); then nothing is
// saved and the game still works for this session.
export function browserStorage(key = KEY) {
  let memory = null;
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw ? JSON.parse(raw) : memory;
      } catch {
        return memory;
      }
    },
    save(state) {
      memory = state;
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(state));
      } catch {
        // Storage unavailable: keep the in-memory copy.
      }
    },
  };
}

export function memoryStorage(initial = null) {
  let state = initial ? JSON.parse(JSON.stringify(initial)) : null;
  return {
    load: () => (state ? JSON.parse(JSON.stringify(state)) : null),
    save: (s) => {
      state = JSON.parse(JSON.stringify(s));
    },
    peek: () => state,
  };
}

const isCount = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

// A fresh save, or a loaded one with anything damaged replaced by its default.
function sanitize(raw, config, legacyPaid) {
  const fresh = { v: 1, lives: config.lives.start, regenFrom: null, coins: config.coins.start, paid: {}, attempt: null, seen: {}, log: [] };
  if (!raw || typeof raw !== 'object') {
    // Levels finished before coins existed count as paid, so they don't pay out again.
    fresh.paid = legacyPaid ? { ...legacyPaid() } : {};
    return fresh;
  }
  const s = { ...fresh };
  if (isCount(raw.lives, config.lives.max)) s.lives = raw.lives;
  if (Number.isInteger(raw.coins) && raw.coins >= 0) s.coins = raw.coins;
  if (raw.paid && typeof raw.paid === 'object') {
    for (const [id, tier] of Object.entries(raw.paid)) if (isCount(tier, 3)) s.paid[id] = tier;
  }
  if (typeof raw.regenFrom === 'number' && Number.isFinite(raw.regenFrom)) s.regenFrom = raw.regenFrom;
  if (raw.attempt && typeof raw.attempt.level === 'string') {
    s.attempt = { level: raw.attempt.level, free: Boolean(raw.attempt.free), staked: Boolean(raw.attempt.staked), lost: Boolean(raw.attempt.lost) };
  }
  if (raw.seen && typeof raw.seen === 'object') s.seen = { ...raw.seen };
  if (Array.isArray(raw.log)) s.log = raw.log.slice(-50);
  if (s.lives >= config.lives.max) s.regenFrom = null;
  return s;
}

export function createPlayer({ storage = browserStorage(), now = () => Date.now(), config = ECONOMY, legacyPaid = null } = {}) {
  const L = config.lives;
  const period = L.regenMinutes * MINUTE;

  // Apply the lives that came back since the countdown started (also while the game was closed).
  function regenerate(s, t) {
    if (s.lives >= L.max) {
      s.regenFrom = null;
      return;
    }
    if (s.regenFrom === null || s.regenFrom > t) s.regenFrom = t; // clock moved back: grant nothing
    const gained = Math.floor((t - s.regenFrom) / period);
    if (gained <= 0) return;
    s.lives = Math.min(L.max, s.lives + gained);
    s.regenFrom = s.lives >= L.max ? null : s.regenFrom + gained * period;
    note(s, t, 'life', gained, 'came back');
  }

  function note(s, t, kind, amount, why) {
    s.log.push({ t, kind, amount, why });
    if (s.log.length > 50) s.log.splice(0, s.log.length - 50);
  }

  // Read, change and write the save in one step. `change` returns the result.
  // A read (write = false) only writes back if a life came back meanwhile: the HUD reads the
  // save many times a second, and writing storage each time makes the game stutter on phones.
  function update(change, write = true) {
    const t = now();
    const s = sanitize(storage.load(), config, legacyPaid);
    const before = `${s.lives}|${s.regenFrom}`;
    regenerate(s, t);
    const result = change(s, t);
    if (write || `${s.lives}|${s.regenFrom}` !== before) storage.save(s);
    return result;
  }
  const read = (pick) => update((s, t) => pick(s, t), false);

  function loseLife(s, t, why) {
    if (s.lives <= 0) return false;
    if (s.lives >= L.max) s.regenFrom = t; // the countdown starts with the first life lost
    s.lives--;
    note(s, t, 'life', -1, why);
    return true;
  }

  const isFree = (levelIndex) => levelIndex < L.freeLevels;

  // A level's coins: the base for the first completion, and a bonus the first time it reaches
  // 2 stars and 3 stars. Hard levels pay more.
  function rewardFor(levelIndex, { hard = false } = {}) {
    const R = config.rewards;
    const chapter = Math.min(R.baseByChapter.length - 1, Math.floor(levelIndex / R.levelsPerChapter));
    const base = hard ? Math.round((R.baseByChapter[chapter] * (R.hardFactor || 1)) / 5) * 5 : R.baseByChapter[chapter];
    const bonus = Math.round((base * R.starBonus) / 5) * 5;
    return { base, two: bonus, three: bonus, total: base + 2 * bonus };
  }
  const tiers = (r) => [
    { tier: 1, amount: r.base, why: 'Completed' },
    { tier: 2, amount: r.two, why: '2 stars' },
    { tier: 3, amount: r.three, why: '3 stars' },
  ];

  // Take `cost` coins and run `apply` in one step. Nothing is charged unless `apply` succeeds
  // (returns something other than false), and `apply` doesn't run without the coins.
  function pay(s, t, cost, why, apply) {
    if (!Number.isFinite(cost) || cost < 0) return { ok: false, reason: 'bad price', coins: s.coins };
    if (s.coins < cost) return { ok: false, reason: 'coins', coins: s.coins, need: cost - s.coins };
    const result = apply ? apply(s, t) : true;
    if (result === false || result?.ok === false) return { ok: false, reason: result?.reason || 'not applied', coins: s.coins };
    s.coins -= cost;
    note(s, t, 'spend', -cost, why);
    return { ok: true, coins: s.coins, result };
  }
  const atRisk = (a) => Boolean(a && !a.free && (a.staked || a.lost));

  // Charge the current attempt's loss, once.
  function charge(s, t, why) {
    const a = s.attempt;
    s.attempt = null;
    if (!atRisk(a)) return { charged: false, lives: s.lives };
    loseLife(s, t, why);
    return { charged: true, lives: s.lives, level: a.level };
  }

  return {
    config,

    // { lives, max, nextIn }: nextIn is ms until the next life, or null when full.
    lives: () => read((s, t) => ({ lives: s.lives, max: L.max, nextIn: s.regenFrom === null ? null : s.regenFrom + period - t })),
    isFreeLevel: isFree,
    canPlay: (levelIndex) => isFree(levelIndex) || read((s) => s.lives > 0),

    // ---------- Attempts: one try at a level, and whether giving it up costs a life ----------
    startAttempt: (levelId, levelIndex) =>
      update((s) => {
        s.attempt = { level: levelId, free: isFree(levelIndex), staked: false, lost: false };
      }),
    // Past the free-restart window: from now on giving up costs a life.
    stakeAttempt: () =>
      update((s) => {
        if (s.attempt) s.attempt.staked = true;
      }),
    // The clock ran out. The loss stays pending until the player accepts it or carries on.
    loseAttempt: () =>
      update((s) => {
        if (s.attempt) s.attempt.lost = true;
      }),
    // Carried on after running out of time (second chance or rewarded ad): no life yet.
    resumeAttempt: () =>
      update((s) => {
        if (s.attempt) {
          s.attempt.lost = false;
          s.attempt.staked = true;
        }
      }),
    attemptAtRisk: () => read((s) => atRisk(s.attempt)),
    attemptLost: () => read((s) => Boolean(s.attempt?.lost)),
    // Accept the loss (or give up after the free window): −1 life, once.
    chargeAttempt: (why = 'lost a level') => update((s, t) => charge(s, t, why)),
    // A win, or giving up for free: the attempt ends without a charge.
    clearAttempt: () =>
      update((s) => {
        s.attempt = null;
      }),
    // At launch: an attempt left running or lost when the game closed is charged now.
    recover: () => update((s, t) => charge(s, t, 'left a level unfinished')),

    // ---------- Gold coins ----------
    coins: () => read((s) => s.coins),
    rewardFor,
    // Coins still to earn on a level: what a first completion with 3 stars would pay now.
    remaining: (levelId, levelIndex, opts) =>
      read((s) => tiers(rewardFor(levelIndex, opts)).filter((x) => x.tier > (s.paid[levelId] || 0)).reduce((sum, x) => sum + x.amount, 0)),
    // A completed level pays the tiers it hasn't paid yet, so repeating it (or a repeated
    // completion event) pays nothing more.
    grantLevel: (levelId, levelIndex, stars, opts) =>
      update((s, t) => {
        const already = s.paid[levelId] || 0;
        const parts = tiers(rewardFor(levelIndex, opts)).filter((x) => x.tier > already && x.tier <= stars);
        const total = parts.reduce((sum, x) => sum + x.amount, 0);
        if (parts.length) s.paid[levelId] = Math.max(already, ...parts.map((x) => x.tier));
        if (total) {
          s.coins += total;
          note(s, t, 'earn', total, `level ${levelIndex + 1}`);
        }
        return { total, parts: parts.map(({ amount, why }) => ({ amount, why })), coins: s.coins };
      }),
    // Extra coins on top of a level's reward (the ad multiplier after a win).
    grantBonus: (amount, why) =>
      update((s, t) => {
        if (!Number.isInteger(amount) || amount <= 0) return { ok: false, coins: s.coins };
        s.coins += amount;
        note(s, t, 'earn', amount, why);
        return { ok: true, coins: s.coins };
      }),
    // Spend coins on something; `apply(state)` returns false to cancel without a charge.
    pay: (cost, why, apply) => update((s, t) => pay(s, t, cost, why, apply)),
    buyLife: () =>
      update((s, t) =>
        pay(s, t, config.prices.life, 'a life', (st) => {
          if (st.lives >= L.max) return { ok: false, reason: 'full' };
          st.lives++;
          if (st.lives >= L.max) st.regenFrom = null;
          note(st, t, 'life', 1, 'bought');
          return true;
        }),
      ),

    // ---------- First-time notes ----------
    seen: (flag) => read((s) => Boolean(s.seen[flag])),
    markSeen: (flag) =>
      update((s) => {
        s.seen[flag] = true;
      }),

    // ---------- For Playtest tools and tests ----------
    setLives: (n) =>
      update((s, t) => {
        s.lives = Math.max(0, Math.min(L.max, n));
        s.regenFrom = s.lives >= L.max ? null : t;
      }),
    addCoins: (n) =>
      update((s, t) => {
        s.coins = Math.max(0, s.coins + n);
        note(s, t, 'earn', n, 'playtest tools');
      }),
    // Pretend `minutes` passed: moves the countdown back instead of touching the clock.
    skipTime: (minutes) =>
      update((s, t) => {
        if (s.regenFrom !== null) s.regenFrom -= minutes * MINUTE;
        regenerate(s, t);
      }),
    reset: () => storage.save(sanitize(null, config, legacyPaid)),
    snapshot: () => read((s) => JSON.parse(JSON.stringify(s))),
  };
}

// "08:42" for a duration in ms.
export function clockText(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
