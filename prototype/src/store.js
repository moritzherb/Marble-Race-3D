// Saved settings, best results and the playtest log. Browser storage can be missing
// (private windows, blocked storage), so every access is guarded and has a default.

const KEYS = { settings: 'mmr-settings', progress: 'mmr-progress', log: 'mmr-log', ads: 'mmr-ads' };

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: keep going without saving.
  }
}

export const DEFAULT_SETTINGS = { timerStart: 'appear', directionAssist: true, sound: true, vibration: true, hints: true };

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}
export function saveSettings(s) {
  write(KEYS.settings, s);
}

// progress: { [levelId]: { stars, bestTime } }
export function loadProgress() {
  return read(KEYS.progress, {});
}
export function recordResult(levelId, stars, time) {
  const progress = loadProgress();
  const prev = progress[levelId] || { stars: 0, bestTime: null };
  progress[levelId] = {
    stars: Math.max(prev.stars, stars),
    bestTime: prev.bestTime === null ? time : Math.min(prev.bestTime, time),
  };
  write(KEYS.progress, progress);
  return progress;
}

export function resetProgress() {
  write(KEYS.progress, {});
}

// One entry per attempt: how it ended, how long it took, how many times the player tilted.
export function loadLog() {
  return read(KEYS.log, []);
}
export function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  write(KEYS.log, log.slice(-2000));
}
export function clearLog() {
  write(KEYS.log, []);
}

// Ad counters and the cached remote ad config (see ads.js), as a small key-value store.
export const adStore = {
  get: (k) => read(KEYS.ads, {})[k],
  set: (k, v) => write(KEYS.ads, { ...read(KEYS.ads, {}), [k]: v }),
};
