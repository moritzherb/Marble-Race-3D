// Pretend ads for playtesting in a browser, where there is no ad SDK. Used only while
// TESTING.simulateAds is on (config.js), never in the Android or iOS app. Each "ad" is a
// plain dark screen that says it is a test, with a short countdown. Closing a rewarded one
// early earns nothing, as with a real ad.

export function simulatedProvider({ seconds = 3, doc = document } = {}) {
  function show(kind) {
    return new Promise((resolve) => {
      const el = doc.createElement('div');
      el.className = 'test-ad';
      el.setAttribute('role', 'dialog');
      let left = seconds;
      el.innerHTML = `<b>Test ad · ${kind}</b><div class="ring">${left}</div>
        <small>Simulated for playtesting in the browser. The app shows a real ad here.</small>
        <button class="skip" type="button">Close</button>`;
      const ring = el.querySelector('.ring');
      const timer = setInterval(() => {
        left--;
        ring.textContent = Math.max(0, left);
        if (left <= 0) finish(true);
      }, 1000);
      function finish(rewarded) {
        clearInterval(timer);
        el.remove();
        resolve({ shown: true, rewarded });
      }
      el.querySelector('.skip').addEventListener('click', () => finish(false));
      doc.body.append(el);
    });
  }
  return {
    name: 'simulated',
    init: async () => ({ canRequestAds: true, privacyOptionsRequired: false }),
    loadRewarded: async () => {},
    showRewarded: () => show('rewarded'),
    loadInterstitial: async () => {},
    showInterstitial: () => show('interstitial').then(() => undefined),
    showPrivacyOptions: async () => {},
  };
}
