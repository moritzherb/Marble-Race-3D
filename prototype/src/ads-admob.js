// Google AdMob for the Android and iOS app builds, through the Capacitor plugin
// @capacitor-community/admob (it bundles the Google Mobile Ads SDK and Google's User
// Messaging Platform for consent). The app build loads Capacitor's runtime (capacitor.js)
// before the game, which provides the native bridge used here. In a browser there is no
// bridge, so admobProvider() returns null and the game has no ads.

import { unitsFor } from './ads.js';

// Event names from the plugin (RewardAdPluginEvents and InterstitialAdPluginEvents).
const REWARDED = {
  showed: 'onRewardedVideoAdShowed',
  failedToShow: 'onRewardedVideoAdFailedToShow',
  dismissed: 'onRewardedVideoAdDismissed',
  rewarded: 'onRewardedVideoAdReward',
};
const INTERSTITIAL = {
  failedToShow: 'interstitialAdFailedToShow',
  dismissed: 'interstitialAdDismissed',
};

// AdmobConsentDebugGeography in the plugin.
const DEBUG_GEOGRAPHY = { EEA: 1, NOT_EEA: 2, US: 3, OTHER: 4 };

// 'android' or 'ios' inside the native app, otherwise null.
export function nativePlatform() {
  const cap = globalThis.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const platform = cap.getPlatform?.();
  return platform === 'android' || platform === 'ios' ? platform : null;
}

export function admobProvider(config) {
  const platform = nativePlatform();
  const cap = globalThis.Capacitor;
  if (!platform || !cap.isPluginAvailable?.('AdMob')) return null;
  const units = unitsFor(config, platform);
  if (!units) return null;
  const AdMob = cap.registerPlugin('AdMob');
  const listen = (pairs) => Promise.all(pairs.map(([name, fn]) => AdMob.addListener(name, fn)));

  return {
    name: `admob-${platform}${config.testMode ? '-test' : ''}`,

    // Consent first (Google's User Messaging Platform shows the form where the law needs it,
    // such as the EEA and UK), then start the SDK only if ads may be requested.
    async init() {
      const testing = config.testMode;
      let info = await AdMob.requestConsentInfo({
        tagForUnderAgeOfConsent: config.childDirected,
        ...(testing && config.consentDebugGeography ? { debugGeography: DEBUG_GEOGRAPHY[config.consentDebugGeography] } : {}),
        ...(testing && config.testDeviceIds.length ? { testDeviceIdentifiers: config.testDeviceIds } : {}),
      });
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
      if (info.canRequestAds) {
        await AdMob.initialize({ initializeForTesting: testing, testingDevices: testing ? config.testDeviceIds : [], tagForChildDirectedTreatment: config.childDirected });
      }
      return { canRequestAds: info.canRequestAds, privacyOptionsRequired: info.privacyOptionsRequirementStatus === 'REQUIRED' };
    },

    async loadRewarded() {
      await AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting: config.testMode });
    },

    // The plugin's show call only settles when a reward is earned, so the outcome comes from
    // events: the reward counts only if Google reports it (onUserEarnedReward) for this ad.
    async showRewarded() {
      let rewarded = false;
      let markShown;
      let markClosed;
      const shown = new Promise((r) => (markShown = r));
      const closed = new Promise((r) => (markClosed = r));
      const notShown = () => {
        markShown(false);
        markClosed();
      };
      const handles = await listen([
        [REWARDED.rewarded, () => (rewarded = true)],
        [REWARDED.showed, () => markShown(true)],
        [REWARDED.failedToShow, notShown],
        [REWARDED.dismissed, () => {
          markShown(true);
          markClosed();
        }],
      ]);
      try {
        AdMob.showRewardVideoAd().then(() => (rewarded = true), notShown);
        if (!(await shown)) return { shown: false, rewarded: false };
        await closed;
        // Google reports the reward before the dismissal; allow a moment for a late one.
        if (!rewarded) await new Promise((r) => setTimeout(r, 300));
        return { shown: true, rewarded };
      } finally {
        for (const h of handles) h.remove();
      }
    },

    async loadInterstitial() {
      await AdMob.prepareInterstitial({ adId: units.interstitial, isTesting: config.testMode });
    },

    async showInterstitial() {
      let markClosed;
      const closed = new Promise((r) => (markClosed = r));
      const handles = await listen([
        [INTERSTITIAL.dismissed, () => markClosed(true)],
        [INTERSTITIAL.failedToShow, () => markClosed(false)],
      ]);
      try {
        await AdMob.showInterstitial().catch(() => markClosed(false));
        if (!(await closed)) throw new Error('interstitial failed to show');
      } finally {
        for (const h of handles) h.remove();
      }
    },

    async showPrivacyOptions() {
      await AdMob.showPrivacyOptionsForm();
    },
  };
}
