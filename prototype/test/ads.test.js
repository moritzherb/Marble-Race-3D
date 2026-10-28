import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAds, mergeAdConfig, unitsFor, loadAdConfig, memoryStore, DEFAULT_AD_CONFIG, TEST_UNITS } from '../src/ads.js';
import { admobProvider } from '../src/ads-admob.js';

const noTimers = { setTimeout: () => 0, clearTimeout: () => {} };
const config = (over = {}) => ({ ...DEFAULT_AD_CONFIG, ...over });

function fakeProvider({ consent = true, load = 'ok', reward = true, shown = true, interstitial = 'ok' } = {}) {
  const calls = { loadRewarded: 0, showRewarded: 0, loadInterstitial: 0, showInterstitial: 0 };
  const loader = (kind) => () => {
    calls[kind]++;
    if (load === 'hang') return new Promise(() => {});
    return load === 'ok' ? Promise.resolve() : Promise.reject(new Error('no fill'));
  };
  return {
    name: 'fake',
    calls,
    init: async () => ({ canRequestAds: consent, privacyOptionsRequired: false }),
    loadRewarded: loader('loadRewarded'),
    loadInterstitial: loader('loadInterstitial'),
    showRewarded: async () => {
      calls.showRewarded++;
      return { shown, rewarded: shown && reward };
    },
    showInterstitial: async () => {
      calls.showInterstitial++;
      if (interstitial !== 'ok') throw new Error('failed to show');
    },
  };
}

async function ready(provider, opts = {}) {
  const ads = createAds({ timers: noTimers, ...opts });
  await ads.attach(provider, opts.config || config());
  await new Promise((r) => setTimeout(r, 0));
  return ads;
}

test('without an ad SDK (the web build) nothing is offered', async () => {
  const ads = createAds({ timers: noTimers });
  assert.equal(ads.available(), false);
  assert.equal(ads.canOfferExtraTime({ extraTimeUsed: 0 }), false);
  assert.deepEqual(await ads.watchForExtraTime({ extraTimeUsed: 0 }), { granted: false, reason: 'not-offered' });
  assert.equal(ads.interstitialBlocker(20), 'off');
});

test('no consent means no ads', async () => {
  const ads = await ready(fakeProvider({ consent: false }));
  assert.equal(ads.available(), false);
  assert.equal(ads.canOfferExtraTime({ extraTimeUsed: 0 }), false);
});

test('extra time is granted exactly once, even if the button is pressed twice', async () => {
  const provider = fakeProvider();
  const ads = await ready(provider);
  const attempt = { extraTimeUsed: 0 };
  const [a, b] = await Promise.all([ads.watchForExtraTime(attempt), ads.watchForExtraTime(attempt)]);
  assert.deepEqual(a, { granted: true, seconds: 20, reason: 'rewarded' });
  assert.deepEqual(b, { granted: false, reason: 'busy' });
  assert.equal(attempt.extraTimeUsed, 1);
  assert.equal(provider.calls.showRewarded, 1);
  assert.equal(ads.canOfferExtraTime(attempt), false);
  assert.deepEqual(await ads.watchForExtraTime(attempt), { granted: false, reason: 'not-offered' });
  // A new attempt (the player tried again) can earn it again.
  assert.equal(ads.canOfferExtraTime({ extraTimeUsed: 0 }), true);
});

test('the coin multiplier ad pays once per win, and only when the ad was watched', async () => {
  const ads = await ready(fakeProvider());
  const win = { coinsAdUsed: 0 };
  assert.ok(ads.canOfferCoins(win));
  const [a, b] = await Promise.all([ads.watchForCoins(win), ads.watchForCoins(win)]);
  assert.equal([a, b].filter((r) => r.granted).length, 1);
  assert.equal(win.coinsAdUsed, 1);
  assert.equal(ads.canOfferCoins(win), false);
  const early = await ready(fakeProvider({ reward: false }));
  const win2 = { coinsAdUsed: 0 };
  assert.deepEqual(await early.watchForCoins(win2), { granted: false, reason: 'closed-early' });
  assert.equal(win2.coinsAdUsed, 0);
  const none = createAds({ timers: noTimers });
  assert.equal(none.canOfferCoins({ coinsAdUsed: 0 }), false);
});

test('closing the ad before the reward grants nothing', async () => {
  const ads = await ready(fakeProvider({ reward: false }));
  const attempt = { extraTimeUsed: 0 };
  assert.deepEqual(await ads.watchForExtraTime(attempt), { granted: false, reason: 'closed-early' });
  assert.equal(attempt.extraTimeUsed, 0);
});

test('an ad that fails to load or show grants nothing', async () => {
  for (const provider of [fakeProvider({ load: 'fail' }), fakeProvider({ shown: false })]) {
    const ads = await ready(provider);
    const attempt = { extraTimeUsed: 0 };
    assert.deepEqual(await ads.watchForExtraTime(attempt), { granted: false, reason: 'unavailable' });
    assert.equal(attempt.extraTimeUsed, 0);
  }
});

test('a load that never answers times out as unavailable', async () => {
  const ads = await ready(fakeProvider({ load: 'hang' }), { config: config({ loadTimeoutSeconds: 0.05 }) });
  const t0 = Date.now();
  assert.deepEqual(await ads.watchForExtraTime({ extraTimeUsed: 0 }), { granted: false, reason: 'unavailable' });
  assert.ok(Date.now() - t0 < 1000);
});

test('interstitials: none during the first ten levels, then one every three completed levels', async () => {
  const provider = fakeProvider();
  const ads = await ready(provider);
  for (let n = 1; n <= 10; n++) ads.levelCompleted(n);
  assert.equal(ads.interstitialBlocker(10), 'tutorial');
  const shownAfter = [];
  for (let n = 11; n <= 19; n++) {
    ads.levelCompleted(n);
    if ((await ads.showInterstitialIfDue(n)).shown) shownAfter.push(n);
    await new Promise((r) => setTimeout(r, 0)); // let the next one load
  }
  assert.deepEqual(shownAfter, [13, 16, 19]);
  assert.equal(provider.calls.showInterstitial, 3);
});

test('no interstitial right after a rewarded ad', async () => {
  let clock = 1_000_000;
  const ads = await ready(fakeProvider(), { now: () => clock });
  await ads.watchForExtraTime({ extraTimeUsed: 0 });
  for (let n = 11; n <= 13; n++) ads.levelCompleted(n);
  assert.equal(ads.interstitialBlocker(13), 'after-rewarded');
  clock += 121_000;
  assert.equal(ads.interstitialBlocker(13, { afterRewarded: true }), 'after-rewarded');
  assert.equal(ads.interstitialBlocker(13), null);
});

test('an interstitial that is not loaded or fails to show lets the player carry on', async () => {
  const notLoaded = await ready(fakeProvider({ load: 'fail' }));
  for (let n = 11; n <= 13; n++) notLoaded.levelCompleted(n);
  assert.deepEqual(await notLoaded.showInterstitialIfDue(13), { shown: false, reason: 'not-loaded' });
  const failing = await ready(fakeProvider({ interstitial: 'fail' }));
  for (let n = 11; n <= 13; n++) failing.levelCompleted(n);
  assert.deepEqual(await failing.showInterstitialIfDue(13), { shown: false, reason: 'failed' });
  assert.equal(failing.status().completedSinceInterstitial, 3); // still due at the next break
});

test('the level counter survives a restart of the app', async () => {
  const store = memoryStore();
  const first = await ready(fakeProvider(), { store });
  first.levelCompleted(11);
  first.levelCompleted(12);
  const second = await ready(fakeProvider(), { store });
  second.levelCompleted(13);
  assert.equal((await second.showInterstitialIfDue(13)).shown, true);
});

test('config: bad values are ignored and remote config cannot switch on live ads', () => {
  const local = mergeAdConfig(DEFAULT_AD_CONFIG, { interstitial: { everyCompletedLevels: 0 }, rewardedExtraTime: { seconds: '30' } });
  assert.equal(local.interstitial.everyCompletedLevels, 3);
  assert.equal(local.rewardedExtraTime.seconds, 20);
  const remote = mergeAdConfig(DEFAULT_AD_CONFIG, { testMode: false, units: { android: { rewarded: 'ca-app-pub-1/2' } }, interstitial: { everyCompletedLevels: 5 } }, { remote: true });
  assert.equal(remote.testMode, true);
  assert.equal(remote.units.android.rewarded, '');
  assert.equal(remote.interstitial.everyCompletedLevels, 5);
  const sneaky = mergeAdConfig(DEFAULT_AD_CONFIG, { childDirected: true, consentDebugGeography: 'EEA' }, { remote: true });
  assert.equal(sneaky.childDirected, false);
  assert.equal(sneaky.consentDebugGeography, '');
  assert.equal(mergeAdConfig(DEFAULT_AD_CONFIG, { consentDebugGeography: 'MARS' }).consentDebugGeography, '');
});

test('consent testing settings reach the SDK only in test mode', async () => {
  const seen = [];
  const cap = fakeCapacitor('android', 'watched');
  cap.plugin.requestConsentInfo = async (o) => (seen.push(o), { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
  cap.plugin.showConsentForm = async () => ({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
  cap.plugin.initialize = async (o) => seen.push(o);
  globalThis.Capacitor = cap;
  const testing = mergeAdConfig(DEFAULT_AD_CONFIG, { consentDebugGeography: 'EEA', testDeviceIds: ['ABC'] });
  assert.deepEqual(await admobProvider(testing).init(), { canRequestAds: true, privacyOptionsRequired: true });
  assert.deepEqual(seen[0], { tagForUnderAgeOfConsent: false, debugGeography: 1, testDeviceIdentifiers: ['ABC'] });
  assert.deepEqual(seen[1], { initializeForTesting: true, testingDevices: ['ABC'], tagForChildDirectedTreatment: false });
  seen.length = 0;
  const live = mergeAdConfig(testing, { testMode: false, units: { android: { rewarded: 'ca-app-pub-1/1', interstitial: 'ca-app-pub-1/2' } } });
  await admobProvider(live).init();
  assert.deepEqual(seen[0], { tagForUnderAgeOfConsent: false });
  delete globalThis.Capacitor;
});

test('test mode always uses Google test units; production needs real units', () => {
  assert.deepEqual(unitsFor(DEFAULT_AD_CONFIG, 'android'), TEST_UNITS.android);
  assert.deepEqual(unitsFor(DEFAULT_AD_CONFIG, 'ios'), TEST_UNITS.ios);
  const live = mergeAdConfig(DEFAULT_AD_CONFIG, { testMode: false });
  assert.equal(unitsFor(live, 'android'), null);
});

test('remote config: used when reachable, cached copy when offline', async () => {
  const store = memoryStore();
  const files = { './ads-config.json': { remoteConfigUrl: 'https://example.com/ads.json' }, 'https://example.com/ads.json': { interstitial: { everyCompletedLevels: 4 } } };
  const fetchJson = async (url) => {
    if (!(url in files)) throw new Error('offline');
    return files[url];
  };
  assert.equal((await loadAdConfig({ fetchJson, store })).interstitial.everyCompletedLevels, 4);
  delete files['https://example.com/ads.json'];
  assert.equal((await loadAdConfig({ fetchJson, store })).interstitial.everyCompletedLevels, 4);
});

// ---------- The AdMob provider, against a stand-in for the Capacitor plugin ----------

// Plays back what the real plugin does: showRewardVideoAd() only settles when a reward is
// earned, and the outcome otherwise arrives as events.
function fakeCapacitor(platform, script) {
  const listeners = new Map();
  const emit = (name, data) => (listeners.get(name) || []).slice().forEach((fn) => fn(data));
  const plugin = {
    addListener: async (name, fn) => {
      listeners.set(name, [...(listeners.get(name) || []), fn]);
      return { remove: () => listeners.set(name, listeners.get(name).filter((f) => f !== fn)) };
    },
    requestConsentInfo: async () => ({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' }),
    initialize: async () => {},
    prepareRewardVideoAd: async (opts) => {
      plugin.lastAdId = opts.adId;
    },
    showRewardVideoAd: () =>
      new Promise((resolve, reject) => {
        if (script === 'not-prepared') return reject(new Error('No ad prepared'));
        setTimeout(() => {
          if (script === 'fail-to-show') return emit('onRewardedVideoAdFailedToShow', { code: 1 });
          emit('onRewardedVideoAdShowed');
          if (script === 'watched') {
            emit('onRewardedVideoAdReward', { type: 'coins', amount: 1 });
            resolve({ type: 'coins', amount: 1 });
          }
          emit('onRewardedVideoAdDismissed');
        }, 5);
      }),
  };
  return { isNativePlatform: () => true, getPlatform: () => platform, isPluginAvailable: (n) => n === 'AdMob', registerPlugin: () => plugin, plugin, listeners };
}

test('AdMob provider: the reward counts only when Google reports it', async () => {
  const outcomes = {};
  for (const script of ['watched', 'closed', 'fail-to-show', 'not-prepared']) {
    globalThis.Capacitor = fakeCapacitor('android', script);
    const provider = admobProvider(DEFAULT_AD_CONFIG);
    await provider.loadRewarded();
    assert.equal(globalThis.Capacitor.plugin.lastAdId, TEST_UNITS.android.rewarded);
    outcomes[script] = await provider.showRewarded();
    const left = [...globalThis.Capacitor.listeners.values()].reduce((n, l) => n + l.length, 0);
    assert.equal(left, 0, 'listeners removed');
  }
  delete globalThis.Capacitor;
  assert.deepEqual(outcomes, {
    watched: { shown: true, rewarded: true },
    closed: { shown: true, rewarded: false },
    'fail-to-show': { shown: false, rewarded: false },
    'not-prepared': { shown: false, rewarded: false },
  });
});

test('AdMob provider: iOS gets the iOS test units, and there is no provider in a browser', async () => {
  globalThis.Capacitor = fakeCapacitor('ios', 'watched');
  const provider = admobProvider(DEFAULT_AD_CONFIG);
  assert.deepEqual(await provider.init(), { canRequestAds: true, privacyOptionsRequired: true });
  await provider.loadRewarded();
  assert.equal(globalThis.Capacitor.plugin.lastAdId, TEST_UNITS.ios.rewarded);
  delete globalThis.Capacitor;
  assert.equal(admobProvider(DEFAULT_AD_CONFIG), null);
});
