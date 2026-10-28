// Ads for the native app build: optional rewarded ads (extra time after the clock runs out,
// or more coins after a win) and an interstitial between levels, at most once every few
// completed levels.
//
// This file holds the rules only. The ad SDK sits behind a provider: ads-admob.js wraps
// Google AdMob through Capacitor. A browser has no provider, so in the web build nothing here
// does anything and the game shows no ad buttons.
//
// A provider has:
//   init()               -> { canRequestAds, privacyOptionsRequired }  (asks for consent first)
//   loadRewarded()       resolves when an ad is ready, rejects if none could be loaded
//   showRewarded()       -> { shown, rewarded }  once the ad has closed; rewarded is true only
//                        if the SDK reported that the player earned the reward
//   loadInterstitial()   like loadRewarded
//   showInterstitial()   resolves once the ad has closed, rejects if it could not be shown
//   showPrivacyOptions() opens the consent form again

// Google's sample ad units. They always serve test ads and are safe to tap.
export const TEST_UNITS = {
  android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
  ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' },
};

export const DEFAULT_AD_CONFIG = {
  enabled: true,
  // While true, only Google's test ad units are requested, whatever `units` says.
  testMode: true,
  rewardedExtraTime: { enabled: true, seconds: 20, maxPerAttempt: 1 },
  // After a win that paid coins: an ad multiplies them (the multiplier is in economy.js).
  rewardedCoins: { enabled: true, maxPerWin: 1 },
  interstitial: { enabled: true, everyCompletedLevels: 3, notBeforeLevel: 11, quietAfterRewardedSeconds: 120 },
  loadTimeoutSeconds: 10,
  retryAfterSeconds: 30,
  // A JSON file with the same tunable fields, fetched at start-up, so frequency and rewards
  // can change without a new app build. It cannot switch off test mode or change ad units.
  remoteConfigUrl: '',
  // Production ad units, used only once testMode is false.
  units: { android: { rewarded: '', interstitial: '' }, ios: { rewarded: '', interstitial: '' } },
  // Treat every player as a child (COPPA and Google Play Families): no personalised ads.
  childDirected: false,
  // Testing only, ignored once testMode is false: pretend the device is in a region
  // ('EEA', 'NOT_EEA', 'US' or 'OTHER') to try the consent form, and the hashed IDs of test
  // devices (the SDK prints a device's ID in the log the first time it runs).
  consentDebugGeography: '',
  testDeviceIds: [],
};

const GEOGRAPHIES = ['', 'EEA', 'NOT_EEA', 'US', 'OTHER'];

const SHOW_LIMIT_MS = 5 * 60 * 1000;

const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
const bool = (v) => (typeof v === 'boolean' ? v : undefined);
const str = (v) => (typeof v === 'string' ? v.trim() : undefined);
const pick = (...values) => values.find((v) => v !== undefined);

// Merge settings over a base config, keeping only values of the right type and range.
// `remote` settings may tune frequency and rewards but never test mode, ad units or the
// audience and consent settings.
export function mergeAdConfig(base, over, { remote = false } = {}) {
  const o = over && typeof over === 'object' ? over : {};
  const r = o.rewardedExtraTime || {};
  const c = o.rewardedCoins || {};
  const i = o.interstitial || {};
  const units = (platform) => ({
    rewarded: pick(remote ? undefined : str(o.units?.[platform]?.rewarded), base.units[platform].rewarded),
    interstitial: pick(remote ? undefined : str(o.units?.[platform]?.interstitial), base.units[platform].interstitial),
  });
  return {
    enabled: pick(bool(o.enabled), base.enabled),
    testMode: remote ? base.testMode : pick(bool(o.testMode), base.testMode),
    rewardedExtraTime: {
      enabled: pick(bool(r.enabled), base.rewardedExtraTime.enabled),
      seconds: pick(int(r.seconds, 5, 120), base.rewardedExtraTime.seconds),
      maxPerAttempt: pick(int(r.maxPerAttempt, 0, 3), base.rewardedExtraTime.maxPerAttempt),
    },
    rewardedCoins: {
      enabled: pick(bool(c.enabled), base.rewardedCoins.enabled),
      maxPerWin: pick(int(c.maxPerWin, 0, 3), base.rewardedCoins.maxPerWin),
    },
    interstitial: {
      enabled: pick(bool(i.enabled), base.interstitial.enabled),
      everyCompletedLevels: pick(int(i.everyCompletedLevels, 1, 50), base.interstitial.everyCompletedLevels),
      notBeforeLevel: pick(int(i.notBeforeLevel, 1, 1000), base.interstitial.notBeforeLevel),
      quietAfterRewardedSeconds: pick(num(i.quietAfterRewardedSeconds, 0, 3600), base.interstitial.quietAfterRewardedSeconds),
    },
    loadTimeoutSeconds: pick(num(o.loadTimeoutSeconds, 2, 60), base.loadTimeoutSeconds),
    retryAfterSeconds: pick(num(o.retryAfterSeconds, 5, 3600), base.retryAfterSeconds),
    remoteConfigUrl: remote ? base.remoteConfigUrl : pick(str(o.remoteConfigUrl), base.remoteConfigUrl),
    units: { android: units('android'), ios: units('ios') },
    childDirected: remote ? base.childDirected : pick(bool(o.childDirected), base.childDirected),
    consentDebugGeography: remote ? base.consentDebugGeography : pick(GEOGRAPHIES.includes(o.consentDebugGeography) ? o.consentDebugGeography : undefined, base.consentDebugGeography),
    testDeviceIds: remote ? base.testDeviceIds : Array.isArray(o.testDeviceIds) ? o.testDeviceIds.filter((id) => typeof id === 'string') : base.testDeviceIds,
  };
}

// The ad unit IDs to request on a platform: Google's test units while in test mode.
export function unitsFor(config, platform) {
  if (config.testMode) return TEST_UNITS[platform] || null;
  const u = config.units[platform];
  return u?.rewarded || u?.interstitial ? u : null;
}

// Loads the bundled config and then, if it names one, the remote config. The last good remote
// config is cached so a later start without a connection still uses it.
export async function loadAdConfig({ fetchJson, store, bundled = './ads-config.json', timeoutMs = 4000 }) {
  let config = DEFAULT_AD_CONFIG;
  try {
    config = mergeAdConfig(config, await withTimeout(fetchJson(bundled), timeoutMs));
  } catch {
    // No bundled file: defaults.
  }
  if (!config.remoteConfigUrl) return config;
  try {
    const remote = await withTimeout(fetchJson(config.remoteConfigUrl), timeoutMs);
    store.set('remoteConfig', remote);
    return mergeAdConfig(config, remote, { remote: true });
  } catch {
    const cached = store.get('remoteConfig');
    return cached ? mergeAdConfig(config, cached, { remote: true }) : config;
  }
}

export function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function memoryStore() {
  const data = new Map();
  return { get: (k) => data.get(k), set: (k, v) => data.set(k, v) };
}

export function createAds({ provider = null, config = DEFAULT_AD_CONFIG, store = memoryStore(), now = () => Date.now(), timers = globalThis } = {}) {
  const saved = store.get('counters') || {};
  const state = {
    provider: null,
    config,
    canRequestAds: false,
    privacyOptionsRequired: false,
    busy: false,
    rewardedReady: false,
    interstitialReady: false,
    loading: { rewarded: null, interstitial: null },
    retry: { rewarded: null, interstitial: null },
    failures: { rewarded: 0, interstitial: 0 },
    completedSinceInterstitial: Number.isInteger(saved.completedSinceInterstitial) ? saved.completedSinceInterstitial : 0,
    lastRewardedShownAt: typeof saved.lastRewardedShownAt === 'number' ? saved.lastRewardedShownAt : -Infinity,
  };
  const save = () => store.set('counters', { completedSinceInterstitial: state.completedSinceInterstitial, lastRewardedShownAt: state.lastRewardedShownAt });
  const active = () => Boolean(state.provider && state.canRequestAds && state.config.enabled);

  // Load an ad of one kind in the background. On failure, try again later, waiting longer
  // after each failure (up to 8 times retryAfterSeconds).
  function preload(kind) {
    if (!active() || state[`${kind}Ready`] || state.loading[kind]) return state.loading[kind];
    timers.clearTimeout(state.retry[kind]);
    const load = kind === 'rewarded' ? state.provider.loadRewarded() : state.provider.loadInterstitial();
    state.loading[kind] = withTimeout(load, state.config.loadTimeoutSeconds * 1000)
      .then(() => {
        state[`${kind}Ready`] = true;
        state.failures[kind] = 0;
        return true;
      })
      .catch(() => {
        state.failures[kind]++;
        const wait = state.config.retryAfterSeconds * Math.min(8, 2 ** (state.failures[kind] - 1));
        state.retry[kind] = timers.setTimeout(() => preload(kind), wait * 1000);
        return false;
      })
      .finally(() => {
        state.loading[kind] = null;
      });
    return state.loading[kind];
  }

  // Shows a loaded rewarded ad (waiting for one if needed). Resolves { granted, reason }:
  // granted only when the SDK reports the reward was earned.
  async function showRewarded() {
    if (state.busy) return { granted: false, reason: 'busy' };
    state.busy = true;
    try {
      if (!state.rewardedReady && !(await (preload('rewarded') || Promise.resolve(false)))) return { granted: false, reason: 'unavailable' };
      state.rewardedReady = false;
      let result;
      try {
        // A safety net in case the SDK never reports the ad closing (say the app was killed).
        result = await withTimeout(state.provider.showRewarded(), SHOW_LIMIT_MS);
      } catch {
        return { granted: false, reason: 'unavailable' };
      }
      if (result?.shown) {
        state.lastRewardedShownAt = now();
        save();
      }
      if (!result?.rewarded) return { granted: false, reason: result?.shown ? 'closed-early' : 'unavailable' };
      return { granted: true, reason: 'rewarded' };
    } finally {
      state.busy = false;
      preload('rewarded');
    }
  }

  const ads = {
    get config() {
      return state.config;
    },
    get privacyOptionsRequired() {
      return state.privacyOptionsRequired;
    },
    // Ads can be requested: there is an SDK, consent allows it and ads are switched on.
    available: active,
    isBusy: () => state.busy,
    status() {
      return {
        provider: state.provider?.name || 'none',
        testMode: state.config.testMode,
        canRequestAds: state.canRequestAds,
        rewardedReady: state.rewardedReady,
        interstitialReady: state.interstitialReady,
        completedSinceInterstitial: state.completedSinceInterstitial,
      };
    },

    // Connect an SDK provider: consent, then start loading both ads.
    async attach(nextProvider, nextConfig = state.config) {
      state.config = nextConfig;
      state.provider = nextProvider;
      if (!nextProvider || !nextConfig.enabled) return ads.available();
      try {
        const info = await nextProvider.init();
        state.canRequestAds = Boolean(info?.canRequestAds);
        state.privacyOptionsRequired = Boolean(info?.privacyOptionsRequired);
      } catch {
        state.canRequestAds = false;
      }
      if (state.config.rewardedExtraTime.enabled || state.config.rewardedCoins.enabled) preload('rewarded');
      if (state.config.interstitial.enabled) preload('interstitial');
      return ads.available();
    },

    // attempt: { extraTimeUsed } for the current try of a level.
    canOfferExtraTime(attempt) {
      const r = state.config.rewardedExtraTime;
      return active() && r.enabled && attempt.extraTimeUsed < r.maxPerAttempt;
    },

    // Shows a rewarded ad. Resolves { granted, seconds, reason }. The reward is granted only
    // when the SDK reports it was earned, and at most maxPerAttempt times for one attempt.
    async watchForExtraTime(attempt) {
      if (!ads.canOfferExtraTime(attempt)) return { granted: false, reason: 'not-offered' };
      const r = await showRewarded();
      if (!r.granted) return r;
      if (attempt.extraTimeUsed >= state.config.rewardedExtraTime.maxPerAttempt) return { granted: false, reason: 'already-used' };
      attempt.extraTimeUsed++;
      return { granted: true, seconds: state.config.rewardedExtraTime.seconds, reason: 'rewarded' };
    },

    // win: { coinsAdUsed } for one level win that paid coins.
    canOfferCoins(win) {
      const c = state.config.rewardedCoins;
      return active() && c.enabled && win.coinsAdUsed < c.maxPerWin;
    },

    // Shows a rewarded ad for the coin multiplier. Resolves { granted, reason }.
    async watchForCoins(win) {
      if (!ads.canOfferCoins(win)) return { granted: false, reason: 'not-offered' };
      const r = await showRewarded();
      if (!r.granted) return r;
      if (win.coinsAdUsed >= state.config.rewardedCoins.maxPerWin) return { granted: false, reason: 'already-used' };
      win.coinsAdUsed++;
      return { granted: true, reason: 'rewarded' };
    },

    // Call once for every level the player completes.
    levelCompleted(levelNumber) {
      if (levelNumber < state.config.interstitial.notBeforeLevel) return;
      state.completedSinceInterstitial++;
      save();
    },

    // Why no interstitial would show now, or null if one is due.
    interstitialBlocker(levelNumber, { afterRewarded = false } = {}) {
      const c = state.config.interstitial;
      if (!active() || !c.enabled) return 'off';
      if (state.busy) return 'busy';
      if (levelNumber < c.notBeforeLevel) return 'tutorial';
      if (state.completedSinceInterstitial < c.everyCompletedLevels) return 'not-yet';
      if (afterRewarded || (now() - state.lastRewardedShownAt) / 1000 < c.quietAfterRewardedSeconds) return 'after-rewarded';
      if (!state.interstitialReady) return 'not-loaded';
      return null;
    },

    // At a break between levels: shows an interstitial if one is due and loaded. Never waits
    // for a load; if none is ready the player just carries on and the next break tries again.
    async showInterstitialIfDue(levelNumber, opts) {
      const blocker = ads.interstitialBlocker(levelNumber, opts);
      if (blocker) {
        if (blocker === 'not-loaded') preload('interstitial');
        return { shown: false, reason: blocker };
      }
      state.busy = true;
      state.interstitialReady = false;
      try {
        await withTimeout(state.provider.showInterstitial(), SHOW_LIMIT_MS);
        state.completedSinceInterstitial = 0;
        save();
        return { shown: true, reason: 'shown' };
      } catch {
        return { shown: false, reason: 'failed' };
      } finally {
        state.busy = false;
        preload('interstitial');
      }
    },

    async showPrivacyOptions() {
      if (state.provider?.showPrivacyOptions) await state.provider.showPrivacyOptions();
    },
  };
  if (provider) ads.attach(provider, config);
  return ads;
}
