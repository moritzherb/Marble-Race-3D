# Ads

This page covers what the project can do with mobile ads, what was built, the privacy work a release needs, and how to test it all.

## What the project is

| Question | Answer |
|---|---|
| Engine and language | No game engine. Plain JavaScript (ES modules); three.js r170 draws the 3D scene. The rules and physics are engine-free JavaScript that also runs in Node for the tests. |
| Native export | The game itself is a web page. It's now wrapped with **Capacitor 8**, which puts the page inside a real native app: `android/` is an Android Studio (Gradle) project and `ios/` is an Xcode project. Both were generated and configured, but **not built or run here**. This environment can't download the Android SDK, and iOS builds need a Mac with Xcode. |
| Mobile ad SDK | Google AdMob through [`@capacitor-community/admob`](https://github.com/capacitor-community/admob) 8.2, a maintained Capacitor plugin. It bundles the official Google Mobile Ads SDK (25.4 on Android, 13.11 on iOS) and Google's User Messaging Platform (UMP) for consent, for both platforms. No custom native code is needed. |
| The browser build | Real ads can't work there: AdMob only serves native apps. Web ads would need Google AdSense's H5 Games Ads on a domain you own, with AdSense approval. That isn't possible on the claude.ai preview page, which only allows scripts from a few CDNs. **For playtesting**, while `TESTING.simulateAds` is on (`prototype/src/config.js`), the browser build uses stand-in ads (`ads-sim.js`): a dark screen labelled "Test ad · Simulated for playtesting", with a 3-second countdown and a Close button. They go through the same rules as real ads, so the ad buttons, the coin multiplier and the interstitial breaks can all be tried. The app never uses them, and the switch goes off before release. |

### Gaps to know about

- **Lives and coins came later** (see [economy.md](economy.md)). The rewarded ad is still offered when the clock runs out, for +20 s, next to the coin second chance. Taking it doesn't cost a life, like the coin version.
- **An ad for a life is not built yet.** The natural place is the out-of-lives card, next to Buy a life: the ad manager would get a `watchForLife` like `watchForExtraTime`, calling `player` to add the life only after the reward event.
- **The app ID is a placeholder:** `com.marblemachinerush.app` (in `capacitor.config.json`, `android/app/build.gradle` and the Xcode project). Pick the final one before you create the AdMob apps and store listings. It can't change after release.
- The Fredoka font still loads from Google Fonts. Offline, the app falls back to the system's rounded font; everything else, three.js included, is bundled in the app.

## What was built

| | Behaviour |
|---|---|
| **Rewarded: extra time** | When the clock runs out, the Time's up card offers **Watch an ad for +20 s**. The level carries on exactly where it stopped, with 20 seconds on the clock. It's offered once per attempt; "Try again" starts a new attempt. |
| **Rewarded: more coins** | After a win that paid coins, the Bravo screen offers a blue button with the range the ad can pay (say "60–150"). After the ad, a pointer lands on x2, x3 or x5, drawn by chance with the low ones more likely (`winMultiplier` in `economy.js`), and the extra coins are paid. Once per win (`rewardedCoins.maxPerWin`). |
| Reward only when earned | Time or coins are added only when the SDK reports that the reward was earned (Google's `onUserEarnedReward`, the plugin's `onRewardedVideoAdReward`). Closing the ad, a failure to load or show, or a timeout grants nothing: a small "No reward" or "No ad" pops up, and the buttons stay. |
| No double rewards | Pressing the button disables every button on the card until the ad is over. Only one ad request can be in flight, and the attempt's counter is checked again before the time is added. |
| **Interstitial** | Only on **Next** from the Bravo screen, the break between levels. Never during a level, a marble run, the first ten (teaching) levels, or a menu. |
| Frequency | One per 3 completed levels (counting from level 11). The count survives restarting the app. |
| After a rewarded ad | No interstitial within 120 s of a rewarded ad, or after a level where extra time or the coin multiplier was used. |
| Unavailable | If no interstitial is loaded, the player goes straight on and the next break tries again. Nothing waits for an ad to load. |
| Preloading | Both ads load in the background at start-up and again after each one is shown. Failed loads retry after 30 s, then 60, 120, up to 4 minutes. |
| Timeouts | A rewarded ad that hasn't loaded within 10 s counts as unavailable. If the SDK never reports an ad closing (say the app is killed), the game gives up after 5 minutes. |
| Consent | At every start, UMP checks whether consent is needed (EEA, UK, Switzerland and wherever else you configure a message). It shows Google's form when required. Ads are requested only if UMP says they may be. Settings shows **Privacy choices for ads** whenever UMP says the player must be able to change their choice. |
| Playtest tools | Show the ad state: test or live, whether each ad is loaded, and the count since the last interstitial. |

### Where it lives

| File | What it does |
|---|---|
| `prototype/src/ads.js` | The rules: frequency cap, reward-once, timeouts, retries, config merging. No SDK code, so it's tested in Node. |
| `prototype/src/ads-admob.js` | The AdMob provider: consent, loading and showing through the Capacitor plugin, and turning its events into "shown / rewarded". |
| `prototype/src/ads-sim.js` | Stand-in test ads for the browser build, used only while `TESTING.simulateAds` is on. |
| `prototype/src/main.js` | The three hooks: the Time's up screen, the Bravo screen's multiplier, and Next. |
| `prototype/ads-config.json` | Settings, bundled with the app (below). |
| `android/app/src/main/res/values/strings.xml` | Android AdMob **app** ID (`admob_app_id`). |
| `ios/App/App/Info.plist` | iOS AdMob app ID (`GADApplicationIdentifier`), SKAdNetwork IDs, tracking prompt text. |
| `tools/build-www.mjs` | Builds `www/` for the apps: the game plus local three.js and Capacitor's runtime. |
| `prototype/test/ads.test.js` | Tests for all of the above, including the plugin's real event sequence. |

## Settings (`prototype/ads-config.json`)

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch |
| `testMode` | `true` | Only Google's test ad units are requested, whatever `units` says. **Leave on until release.** |
| `rewardedExtraTime.enabled / seconds / maxPerAttempt` | `true / 20 / 1` | The extra-time offer |
| `rewardedCoins.enabled / maxPerWin` | `true / 1` | The coin multiplier offer after a win |
| `interstitial.enabled / everyCompletedLevels / notBeforeLevel / quietAfterRewardedSeconds` | `true / 3 / 11 / 120` | Interstitial frequency |
| `loadTimeoutSeconds`, `retryAfterSeconds` | `10`, `30` | Loading |
| `remoteConfigUrl` | `""` | A JSON file with any of the keys above, fetched at start-up (see below) |
| `units.android / units.ios` | empty | Your production ad unit IDs, used only when `testMode` is `false` |
| `childDirected` | `false` | Treat every player as a child (COPPA, Google Play Families): no personalised ads |
| `consentDebugGeography`, `testDeviceIds` | `""`, `[]` | Testing only: pretend to be in `EEA` (or `NOT_EEA`, `US`, `OTHER`) to see the consent form, and register test devices. Ignored when `testMode` is `false`. |

**Changing settings without a new build:** put a JSON file somewhere you control (GitHub Pages, a bucket, Firebase Hosting) and set its address as `remoteConfigUrl`. Then set that once in a build. From then on, the app fetches the file at every start (4 s timeout) and remembers the last good copy for offline starts. Bad values are ignored. For safety, the remote file can change frequency, rewards and on/off switches, but it can **never** turn off test mode, change ad units or change the consent settings. Those need a reviewed build.

Android and iOS settings are kept apart where they differ:

- App IDs live in each native project.
- Ad units are per platform under `units`.
- Test units are picked by platform automatically.

## Privacy and consent

### European Economic Area, UK and Switzerland

- **What the law requires:** under the GDPR and the ePrivacy rules, ads that use device identifiers or personal data need the player's consent first. Google's EU User Consent Policy makes this a condition of using AdMob. Since January 2024, apps serving AdMob ads to these users must collect that consent with a **Google-certified consent management platform (CMP)** that uses the IAB TCF v2.2 framework.
- **What the app does:** it uses Google's own UMP, which is a certified CMP. The flow is in place: the consent check at every start, the form when required, no ad requests without consent, and a way to change the choice later from Settings.
- **What you still have to do in the AdMob console:**
  - Under **Privacy & messaging → European regulations**, create and publish the GDPR message. Without a published message there is no form, and players in the EEA get no ads, which is the safe failure.
  - List the ad partners you use.
  - Link your privacy policy.
- **Other regions:** add a **US state regulations** message too if you will have US players. UMP handles both kinds of message.
- **Children:** if your Play Console target audience includes children under 13, follow Google Play's Families policy and set `childDirected: true`. A marble puzzle may well attract children, so decide this deliberately.

### Apple: App Tracking Transparency (ATT)

- **The prompt:** iOS needs the ATT prompt before an app may use the advertising identifier (IDFA). The prompt text is in `Info.plist` (`NSUserTrackingUsageDescription`).
- **When it appears:** the simplest route is an **IDFA explainer** message in AdMob's Privacy & messaging. UMP then shows it, followed by Apple's prompt.
- **If the player says no:** ads still show, just without the IDFA.

### Store disclosures

**Google Play Console**

- **App content → Ads:** declare "Yes, my app contains ads".
- **App content → Advertising ID:** declare that the app uses it for advertising. The Mobile Ads SDK adds the `AD_ID` permission automatically.
- **App content → Data safety:** declare what the Mobile Ads SDK collects and shares, using Google's guide "Prepare for Google Play's Data safety section" for the Mobile Ads SDK. Typically:
  - **Data types:** approximate location (from the IP address), device or other IDs, app interactions, diagnostics.
  - **Purposes:** advertising, analytics, and fraud prevention and security.
  - **Sharing and security:** shared with Google, and encrypted in transit.
  - **The game's own data:** progress and settings stay on the device and aren't collected.
- **Privacy policy:** a URL is required.
- **Target audience and content:** see Children above.
- **`app-ads.txt`:** publish it on the developer website listed in Play, with the line AdMob gives you.

**Apple App Store Connect**

- **App Privacy:** declare the data the Google Mobile Ads SDK collects, using Google's "Data disclosure for Apple's App Store" page. If players can allow ATT, declare **Device ID used for tracking**. Typically also: advertising data, product interaction, coarse location and diagnostics, used for third-party advertising and analytics.
- **Privacy manifest:** the Mobile Ads SDK ships its own (`PrivacyInfo.xcprivacy`). Check the combined report with **Product → Archive → Generate Privacy Report** in Xcode before submitting.
- **SKAdNetwork IDs:** add the full `SKAdNetworkItems` list from Google's iOS quick-start guide. Only Google's own ID is in `Info.plist` now.
- **Privacy policy:** a URL is required.

## Testing

You need:

- Node 20 or newer, then `npm install` in the repo.
- **Android:** Android Studio with SDK 36 and JDK 21.
- **iOS:** a Mac with a current Xcode (see Capacitor's iOS requirements).

Keep `testMode: true` for all of it. Google's test units always serve labelled test ads ("Test Ad") that are safe to tap. Never test by tapping your own live ads; that can get the AdMob account suspended.

To get through steps faster, you can temporarily set, in `prototype/ads-config.json`:

- `"rewardedExtraTime": { "seconds": 5 }` for short extra time;
- `"interstitial": { "notBeforeLevel": 1, "everyCompletedLevels": 1 }` for an interstitial after every level.

Run `npm run cap:sync` after each change to that file.

### 1. A test rewarded ad on Android

1. Build and open the project:
   ```sh
   npm run cap:sync        # builds www/ and copies it into android/ and ios/
   npx cap open android    # opens Android Studio
   ```
2. Run the app on a device or an emulator with Google Play services (Run ▶).
3. Open **Settings → Playtest tools**. The **Ads** line should read "AdMob test ads · rewarded ready".
4. Start any level and don't tilt. When the clock reaches 0, tap **Watch an ad for +20 s**.
5. A Google test ad labelled "Test Ad" plays. Watch it to the end and close it.

### 2. The extra time is given exactly once

1. After the ad closes, the level carries on where it stopped. A "+20 s" banner shows, and the clock reads 20.
2. Let the clock run out again. The card no longer offers an ad, because it's once per attempt.
3. Try a fast double tap on the button in a new attempt. Only one ad opens, because the button and the card lock at the first tap.
4. **Playtest tools → Copy log** shows exactly one `extra-time` entry per ad watched.
5. In the repo, `npm test` runs these cases automatically (`prototype/test/ads.test.js`):
   - two presses at once;
   - a reward reported once;
   - a second request in the same attempt;
   - the plugin's exact event sequences.

### 3. A failed or unavailable ad

- **Closed early:** open the rewarded test ad and close it with its ✕ before the reward is granted; the ✕ appears after a few seconds. "No reward" pops up, and no time is added.
- **No ad available:**
  1. Turn on flight mode.
  2. Force-quit and restart the app, so nothing is preloaded.
  3. Let a level time out and tap the button.
  4. After up to 10 s "No ad" pops up and the ad button goes away. Home and Try again work.
- **Ads switched off:** set `"rewardedExtraTime": { "enabled": false }`. The button disappears.

### 4. Interstitial frequency

1. With the default settings, complete levels 11, 12 and 13.
2. A test interstitial appears after you tap **Next** on 13, and not after 11 or 12. The next one comes after 16.
3. The **Ads** line in Playtest tools counts "n of 3 levels since the last one".
4. Use extra time on a level, then complete it. No interstitial follows it, even if one is due.
5. With flight mode on, Next goes straight home.
6. Interstitials never appear during levels 1–10, during a level, or from Play again.

### 5. The iOS build

1. On a Mac, run `npm install`, then `npm run cap:sync`, then `npx cap open ios`.
2. Xcode resolves the Swift packages, including the Google Mobile Ads SDK, on first open.
3. Pick a simulator or a device and press Run.
4. Repeat steps 1–4 above. The test units for iOS are picked automatically.
5. **To see the EU consent form outside the EU:**
   1. Set `"consentDebugGeography": "EEA"`.
   2. Run the app once.
   3. Copy the device ID that UMP prints in the Xcode console into `testDeviceIds`.
   4. Run it again.
   5. The form shows at start-up, and Settings shows **Privacy choices for ads**.

   This works the same on Android, where the ID appears in Logcat. It needs the GDPR message from the AdMob console to be published.

### 6. Switching to production IDs before release

1. In AdMob, add the Android app and the iOS app, then create a **Rewarded** and an **Interstitial** ad unit for each.
2. **Android:** put your Android **app** ID (`ca-app-pub-…~…`) in `android/app/src/main/res/values/strings.xml` (`admob_app_id`).
3. **iOS:** put your iOS app ID in `ios/App/App/Info.plist` (`GADApplicationIdentifier`), and add Google's full SKAdNetwork list.
4. Put your four **ad unit** IDs (`ca-app-pub-…/…`) in `prototype/ads-config.json` under `units.android` and `units.ios`.
5. Add your phones as test devices in the AdMob console (Settings → Test devices). Then test once more with `testMode: true` on a build carrying the production app IDs.
6. Set up Privacy & messaging (the GDPR message, the IDFA explainer, and US states if needed) and `app-ads.txt`. Fill in the store disclosures above.
7. Only for the release build, set `"testMode": false`. Run `npm run cap:sync` and build the release. Playtest tools then show **LIVE ads**: check that before uploading.
8. Turn off every switch in `TESTING` in `prototype/src/config.js` (for now: `unlockAllLevels`, which opens all 100 levels for playtesting).

The game refuses to request live ads if `testMode` is `false` but `units` is empty for the platform. A remote config file can never switch test mode off.
