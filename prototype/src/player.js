// The player's resources: lives (and their regeneration), and the attempt that may cost one.
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
function sanitize(raw, config) {
  const fresh = { v: 1, lives: config.lives.start, regenFrom: null, attempt: null, seen: {}, log: [] };
  if (!raw || typeof raw !== 'object') return fresh;
  const s = { ...fresh };
  if (isCount(raw.lives, config.lives.max)) s.lives = raw.lives;
  if (typeof raw.regenFrom === 'number' && Number.isFinite(raw.regenFrom)) s.regenFrom = raw.regenFrom;
  if (raw.attempt && typeof raw.attempt.level === 'string') {
    s.attempt = { level: raw.attempt.level, free: Boolean(raw.attempt.free), staked: Boolean(raw.attempt.staked), lost: Boolean(raw.attempt.lost) };
  }
  if (raw.seen && typeof raw.seen === 'object') s.seen = { ...raw.seen };
  if (Array.isArray(raw.log)) s.log = raw.log.slice(-50);
  if (s.lives >= config.lives.max) s.regenFrom = null;
  return s;
}

export function createPlayer({ storage = browserStorage(), now = () => Date.now(), config = ECONOMY } = {}) {
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
  function update(change) {
    const t = now();
    const s = sanitize(storage.load(), config);
    regenerate(s, t);
    const result = change(s, t);
    storage.save(s);
    return result;
  }
  const read = (pick) => update((s, t) => pick(s, t));

  function loseLife(s, t, why) {
    if (s.lives <= 0) return false;
    if (s.lives >= L.max) s.regenFrom = t; // the countdown starts with the first life lost
    s.lives--;
    note(s, t, 'life', -1, why);
    return true;
  }

  const isFree = (levelIndex) => levelIndex < L.freeLevels;
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
    // Pretend `minutes` passed: moves the countdown back instead of touching the clock.
    skipTime: (minutes) =>
      update((s, t) => {
        if (s.regenFrom !== null) s.regenFrom -= minutes * MINUTE;
        regenerate(s, t);
      }),
    reset: () => storage.save(sanitize(null, config)),
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
