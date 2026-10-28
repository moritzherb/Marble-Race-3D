// The game: home screen, level flow, timer, win/lose, menus and the playtest log.

import { LEVELS } from './levels.js';
import { PHYSICS, CONTROLS, SIM_DT, TESTING } from './config.js';
import { buildTrack } from './track.js';
import { createSim, stepSim, isWon, isLost } from './sim.js';
import { createTilt, updateTilt, gravityInMachine, directionVector } from './tilt.js';
import { replay, levelTimes } from './replay.js';
import { createView, MARBLE_COLORS } from './render.js';
import { attachInput } from './input.js';
import * as audio from './audio.js';
import { loadSettings, saveSettings, loadProgress, recordResult, resetProgress, loadLog, appendLog, clearLog, adStore } from './store.js';
import { createAds, loadAdConfig, DEFAULT_AD_CONFIG } from './ads.js';
import { admobProvider, nativePlatform } from './ads-admob.js';
import { simulatedProvider } from './ads-sim.js';
import { createPlayer, clockText } from './player.js';
import { ECONOMY, powerUp } from './economy.js';
import { createPowerUps, snapshotOf, restoreInto } from './powerups.js';
import { createPowerBar } from './powerbar.js';
import { decodeTable, findHint } from './hints.js';
import { macro } from './moves.js';
import { routeFor } from './route.js';
import { ICONS, COIN_PILE, installIconDefs } from './icons.js';
import { pop, heartBreak, flyCoins, countUp } from './fx.js';
import { pickMultiplier, segmentFor } from './bonus.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_PHYSICS = { ...PHYSICS };
const DEFAULT_CONTROLS = { ...CONTROLS };

// Icons: the shared gradients, then every placeholder in the page.
installIconDefs();
for (const el of document.querySelectorAll('[data-icon]')) {
  const art = ICONS[el.dataset.icon] || '';
  if (el.tagName === 'SPAN') el.outerHTML = art;
  else el.insertAdjacentHTML('afterbegin', art);
}

const settings = loadSettings();
CONTROLS.directionAssist = settings.directionAssist;
audio.setSoundEnabled(settings.sound);

const view = createView($('stage'));
const game = {
  screen: 'home', // home | game
  index: 0,
  level: null,
  track: null,
  sim: null,
  times: null,
  solutionOk: true,
  tilt: createTilt(),
  phase: 'playing', // playing | won | failed
  paused: false,
  timerRunning: false,
  timeLeft: 0,
  elapsed: 0,
  tilts: 0,
  acc: 0,
  autoplay: null,
  attempt: { extraTimeUsed: 0 }, // one try at a level, for the rewarded extra time
  adShowing: false,
  card: null,
  cardData: null,
  levelsFrom: 'home', // where the level list's close button returns to
  nextUp: null, // the level the home screen offers after a win
};

// Ads exist only in the Android and iOS app builds (see ads.js). In a browser there is no ad
// SDK; while TESTING.simulateAds is on, labelled stand-in ads let the flows be tried there.
const ads = createAds({ store: adStore });
async function startAds() {
  if (!nativePlatform()) {
    if (TESTING.simulateAds) await ads.attach(simulatedProvider(), DEFAULT_AD_CONFIG);
    return;
  }
  const fetchJson = (url) => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const config = await loadAdConfig({ fetchJson, store: adStore });
  await ads.attach(admobProvider(config), config);
}

// Lives and gold coins: see player.js and docs/economy.md. Levels finished before coins
// existed count as already paid.
const player = createPlayer({ legacyPaid: () => Object.fromEntries(Object.entries(loadProgress()).map(([id, p]) => [id, Math.min(3, Math.max(1, p.stars || 1))])) });
// Power-ups (from level 11): rules in powerups.js, the row of tiles in powerbar.js.
const powerups = createPowerUps({ player });
const puContext = () => ({
  sim: game.sim,
  playing: game.screen === 'game' && game.phase === 'playing' && !game.autoplay,
  levelIndex: game.index,
  addTime,
  snapshot: () => snapshotOf(game.sim, { tilt: game.tilt.current, timeLeft: game.timeLeft, elapsed: game.elapsed, timerRunning: game.timerRunning }),
});
const powerBar = createPowerBar({ bar: $('powerbar'), tag: $('ptag'), powerups, player, context: puContext, use: usePowerUp });
setInterval(() => powerBar.update(), 120);

const livesLine = ({ lives, max, nextIn }) => (nextIn === null ? `${lives}/${max} · Full` : `${lives}/${max} · Next life in ${clockText(nextIn)}`);
const colorCss = (c) => `#${(MARBLE_COLORS[c] ?? 0xffffff).toString(16).padStart(6, '0')}`;
const levelTitle = (i) => `Level ${i + 1}`;
const starsRow = (n) => [1, 2, 3].map((i) => (i <= n ? ICONS.star : ICONS.starEmpty)).join('');
const lifeTag = () => `<span class="tag">−1${ICONS.heart}</span>`;

// ---------- Progress: a level opens once the one before it is complete ----------
// (While TESTING.unlockAllLevels is on, every level is open. Turn it off before release.)

const isComplete = (progress, i) => Boolean(progress[LEVELS[i].id]);
const isUnlocked = (progress, i) => TESTING.unlockAllLevels || i === 0 || isComplete(progress, i - 1);
function nextLevelIndex() {
  const progress = loadProgress();
  const i = LEVELS.findIndex((_, k) => !isComplete(progress, k));
  return i === -1 ? 0 : i;
}

// ---------- Level flow ----------

function computeTimes() {
  const ref = replay(game.level);
  game.solutionOk = ref.won;
  game.solutionTime = ref.time;
  game.times = levelTimes(game.level, ref.won ? ref.time : 12);
}

function prepareLevel(index) {
  game.index = (index + LEVELS.length) % LEVELS.length;
  game.level = LEVELS[game.index];
  game.track = buildTrack(game.level);
  if (game.track.errors.length) console.warn(game.level.id, game.track.errors);
  computeTimes();
  view.build(game.track);
  $('levelLabel').innerHTML = `${levelTitle(game.index)}${game.level.hard ? ICONS.flame : ''}`;
  restart(false);
}

function leaveAttempt() {
  if (game.screen === 'game' && game.phase === 'playing' && !game.autoplay && (game.elapsed > 0.3 || game.tilts > 0)) logAttempt('left');
}

// `advanced`: coming back after a win, so the level number rolls on to the next one.
function showHome({ advanced = false } = {}) {
  leaveAttempt();
  closeCard();
  const before = game.index;
  game.screen = 'home';
  prepareLevel(game.nextUp ?? nextLevelIndex());
  renderHomeLevel(advanced && game.index !== before ? before : null);
  document.body.classList.add('at-home');
  $('home').hidden = false;
  view.setSpin(true);
  if (advanced) view.popIn();
  updateLives();
}

const hardTag = (level) => (level.hard ? `<span class="hard-tag">${ICONS.flame}Hard</span>` : '');
function renderHomeLevel(from = null) {
  const el = $('homeLevel');
  const show = (i) => {
    el.innerHTML = `${levelTitle(i)}${hardTag(LEVELS[i])}`;
  };
  $('playBtn').setAttribute('aria-label', `Play level ${game.index + 1}`);
  el.classList.remove('bump');
  if (from === null) return show(game.index);
  show(from);
  setTimeout(() => {
    show(game.index);
    void el.offsetWidth;
    el.classList.add('bump');
  }, 500);
}

// From level 11, starting a level from the home screen first shows its start card (with
// power-ups to pick) over the home screen; its Play button then opens the level.
const hasStartCard = (index) => !game.autoplay && index + 1 >= ECONOMY.powerUps.unlockLevel;

function play(index = game.index, { skipStart = false } = {}) {
  if (!isUnlocked(loadProgress(), index)) return;
  if (!player.canPlay(index)) {
    openCard('noLives');
    return;
  }
  audio.unlock();
  if (!skipStart && game.screen === 'home' && hasStartCard(index)) {
    if (index !== game.index) {
      prepareLevel(index); // the chosen level turns behind the card
      renderHomeLevel();
    }
    openCard('start');
    return;
  }
  leaveAttempt();
  closeCard();
  if (index !== game.index || !game.level) prepareLevel(index);
  game.screen = 'game';
  document.body.classList.remove('at-home');
  $('home').hidden = true;
  view.setSpin(false);
  restart(false);
  showHint(game.level.tip);
}

function restart(logIt = true) {
  if (logIt && game.screen === 'game' && game.phase === 'playing' && !game.autoplay && (game.elapsed > 0.3 || game.tilts > 0)) logAttempt('restarted');
  // Whatever path got here, an attempt that was under way (or lost) is charged once. The
  // buttons that lead here ask first (see requestGiveUp).
  if (player.attemptAtRisk()) player.chargeAttempt();
  if (game.screen === 'game') player.startAttempt(game.level.id, game.index);
  else player.clearAttempt();
  game.staked = false;
  game.failReason = null;
  game.sim = createSim(game.track);
  game.tilt = createTilt();
  game.phase = 'playing';
  game.timeLeft = game.times.limit;
  game.elapsed = 0;
  game.tilts = 0;
  game.acc = 0;
  game.attempt = { extraTimeUsed: 0, secondChance: 0 }; // per-try counters for ads and coins
  powerups.reset(game.sim);
  view.clearHint();
  powerBar.render(game.index);
  game.timerRunning = settings.timerStart === 'appear';
  game.autoplay = null;
  renderChips();
  updateClock();
  updateLives();
  view.sync(game.sim, game.tilt.current, 0);
}

function win() {
  game.phase = 'won';
  player.clearAttempt();
  endPowerUps();
  releaseTilt();
  const t = game.elapsed;
  const stars = t <= game.times.gold ? 3 : t <= game.times.par ? 2 : 1;
  const demo = Boolean(game.autoplay);
  let reward = null;
  if (!demo) {
    recordResult(game.level.id, stars, t);
    logAttempt('won', stars);
    ads.levelCompleted(game.index + 1);
    reward = player.grantLevel(game.level.id, game.index, stars, { hard: Boolean(game.level.hard) });
    updateLives();
    // Home then offers the level after this one, or the first unfinished one if that is further on.
    game.nextUp = Math.max(game.index + 1 < LEVELS.length ? game.index + 1 : 0, nextLevelIndex());
  }
  audio.playEvent({ type: 'win' });
  const attempt = game.sim;
  setTimeout(() => {
    if (game.phase === 'won' && game.sim === attempt) openCard('win', { stars, t, demo, reward, bonus: { coinsAdUsed: 0 } });
  }, 220);
}

// The clock ran out, or (reason 'fell') a marble fell off a sky rail into nothing.
function fail(reason = 'time') {
  game.phase = 'failed';
  game.failReason = reason;
  if (reason === 'time') game.timeLeft = 0;
  endPowerUps();
  releaseTilt();
  if (!game.autoplay) player.loseAttempt();
  if (!game.autoplay) logAttempt(reason === 'fell' ? 'fell' : 'time-up');
  audio.playEvent({ type: 'fail' });
  // Let the marble be seen falling first.
  if (reason === 'fell') setTimeout(() => game.phase === 'failed' && game.failReason === 'fell' && openCard('fail'), 900);
  else openCard('fail');
}

// Extra time after the clock ran out (coins or a rewarded ad): pick the level up where it stopped.
function continueWithExtraTime(seconds) {
  player.resumeAttempt();
  closeCard();
  game.phase = 'playing';
  game.timeLeft = seconds;
  game.timerRunning = true;
  logAttempt('extra-time');
  pop('time', `+${seconds}s`);
  updateClock();
}

// Restarting or leaving an attempt that is under way costs a life, so ask first.
let pendingGiveUp = null;
function requestGiveUp(kind, action) {
  if (game.screen === 'game' && game.phase === 'playing' && !game.autoplay && player.attemptAtRisk()) {
    pendingGiveUp = action;
    openCard('giveUp', { kind });
  } else {
    closeCard();
    action();
  }
}

// When accepting a loss costs a life, the heart breaks first.
async function withLifeLoss(action) {
  if (player.attemptAtRisk()) {
    closeCard();
    await heartBreak();
  }
  action();
}

// Try the current level again after a loss: the old attempt is charged if it has to be,
// and with no lives left the out-of-lives card shows instead.
function retryLevel() {
  closeCard();
  if (player.attemptAtRisk()) player.chargeAttempt();
  if (!player.canPlay(game.index)) {
    showHome();
    openCard('noLives');
    return;
  }
  restart(false);
}

// The Restart button: every marble goes back to where it started. The clock keeps running
// and it is the same attempt, so it never costs a life (and power-ups used stay used).
function resetMarbles() {
  if (game.screen !== 'game' || game.phase !== 'playing' || game.autoplay) return;
  powerups.endAll(game.sim);
  view.clearHint();
  powerBar.disarm();
  game.sim = createSim(game.track);
  game.tilt = createTilt();
  game.acc = 0;
  logAttempt('reset');
  renderChips();
  powerBar.update();
  pop('restart');
}

// ---------- Power-ups ----------

function addTime(seconds) {
  game.timeLeft += seconds;
  pop('time', `+${seconds}s`);
  updateClock();
}

function endPowerUps() {
  powerups.endAll(game.sim);
  view.clearHint();
  powerBar.disarm();
  powerBar.update();
}

function usePowerUp(id) {
  if (id === 'hint') return useHint();
  if (id === 'magnet') return pickMagnetMarble();
  const r = powerups.activate(id, puContext());
  if (!r.ok) return powerBar.message(id, powerBar.reasonText(id, r.reason));
  audio.playEvent({ type: 'platePress' });
  if (id !== 'time') pop(id);
  updateLives();
  powerBar.update();
}

const clockLabel = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const colorName = (c) => c.charAt(0).toUpperCase() + c.slice(1);

// Magnetic Pull: pick a marble first. Cancelling, or a marble with no open route, costs nothing.
function pickMagnetMarble() {
  const reason = powerups.blocker('magnet', puContext());
  if (reason) return powerBar.message('magnet', powerBar.reasonText('magnet', reason));
  const marbles = game.sim.marbles.map((m, i) => ({ m, i })).filter(({ m }) => !m.delivered);
  powerBar.custom(
    `<h3>${ICONS.magnet}Which marble?</h3>
    <div class="picker">${marbles.map(({ m, i }) => `<button type="button" data-pick="${i}" style="--c:${colorCss(m.color)}" aria-label="${colorName(m.color)}"></button>`).join('')}</div>
    <button class="gbtn cream wide" type="button" data-cancel>Cancel</button>`,
    10000,
    (e) => {
      if (e.target.closest('[data-cancel]')) return powerBar.disarm();
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      const i = Number(pick.dataset.pick);
      const r = powerups.activate('magnet', puContext(), { marble: i });
      if (!r.ok) {
        const why = { 'no route': 'No way home from here', far: 'Too far from home', home: 'Already home' }[r.reason];
        return powerBar.message('magnet', why || powerBar.reasonText('magnet', r.reason));
      }
      powerBar.disarm();
      audio.playEvent({ type: 'platePress' });
      pop('magnet');
      updateLives();
      powerBar.update();
    },
  );
}

// Checkpoint: after a loss, carry on from the saved moment. The loss costs its life as usual;
// carrying on needs a life left after that (levels 1-10 never cost one).
function checkpointButton() {
  const snap = powerups.checkpoint();
  if (!snap || game.autoplay) return '';
  const free = player.isFreeLevel(game.index) || !player.attemptAtRisk();
  const enough = free || player.lives().lives >= 2;
  return `<button class="gbtn orange" data-act="restoreCheckpoint" type="button" aria-label="Back to the checkpoint"${enough ? '' : ' disabled'}>${ICONS.checkpoint}${clockLabel(snap.timeLeft)}${free ? '' : lifeTag()}</button>`;
}

function restoreCheckpoint() {
  const snap = powerups.checkpoint();
  if (!snap) return;
  if (!player.isFreeLevel(game.index) && player.attemptAtRisk() && player.lives().lives < 2) return;
  powerups.takeCheckpoint();
  pendingGiveUp = null;
  closeCard();
  if (player.attemptAtRisk()) player.chargeAttempt();
  player.startAttempt(game.level.id, game.index);
  restoreInto(game.sim, snap);
  game.tilt = createTilt();
  game.tilt.current = [...snap.tilt];
  game.phase = 'playing';
  game.timeLeft = snap.timeLeft;
  game.elapsed = snap.elapsed;
  game.timerRunning = snap.timerRunning;
  game.staked = false;
  game.attempt = { extraTimeUsed: 0, secondChance: 0 };
  powerups.resetForRestore(game.sim);
  view.clearHint();
  powerBar.render(game.index);
  logAttempt('restored');
  renderChips();
  updateClock();
  updateLives();
  pop('checkpoint');
}

// Hint: look the position up in the level's table (see hints.js). Finding no hint is free.
const hintTables = new Map();
function loadHints(id) {
  if (!hintTables.has(id)) {
    const table = fetch(`./hints/${id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(decodeTable)
      .catch(() => {
        hintTables.delete(id);
        return null;
      });
    hintTables.set(id, table);
  }
  return hintTables.get(id);
}
const defaultFeel = () => Object.keys(DEFAULT_PHYSICS).every((k) => PHYSICS[k] === DEFAULT_PHYSICS[k]);

async function useHint() {
  const reason = powerups.blocker('hint', puContext());
  if (reason) return powerBar.message('hint', powerBar.reasonText('hint', reason));
  if (!defaultFeel()) return powerBar.message('hint', 'Needs the default feel (Playtest tools)');
  const level = game.level;
  powerBar.custom(`<h3>${ICONS.hint}…</h3>`, 4000);
  const table = await loadHints(level.id);
  await new Promise((r) => setTimeout(r, 20)); // let the tag show before the search
  if (game.level !== level || game.phase !== 'playing') return powerBar.disarm();
  if (!table) return powerBar.message('hint', "Couldn't load hints");
  const h = findHint(table, game.sim);
  if (!h.dir) return powerBar.message('hint', h.dead ? "Can't be won from here: restart" : 'Let the marbles stop first');
  const r = powerups.activate('hint', puContext(), { hint: h });
  if (!r.ok) return powerBar.message('hint', powerBar.reasonText('hint', r.reason));
  powerBar.disarm();
  const seconds = powerUp('hint').duration;
  view.showHintArrow(h.dir, seconds);
  const path = hintPath(game.sim, h.dir);
  if (path) view.showMarbleHint(path.index, path.points, seconds);
  updateLives();
  powerBar.update();
}

// The marble the hinted move is about, and the way it rolls: play the move out of sight
// and follow every marble. The one that gets home wins; otherwise the one that moves furthest.
function hintPath(sim, dir) {
  const paths = sim.marbles.map((m) => [[...m.pos]]);
  let n = 0;
  const r = macro(sim, dir, (s) => {
    if (n++ % 3) return;
    s.marbles.forEach((m, i) => !m.lost && paths[i].push([...m.pos]));
  });
  const length = (p) => p.reduce((sum, q, k) => (k ? sum + Math.min(0.6, Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1], q[2] - p[k - 1][2])) : 0), 0);
  let best = -1;
  let score = 0.3;
  sim.marbles.forEach((m, i) => {
    if (m.delivered) return;
    const s = length(paths[i]) + (r.sim.marbles[i].delivered ? 100 : 0);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return best < 0 ? null : { index: best, points: paths[best] };
}

// "+1 heart · 150 coins" on the lives cards.
function buyLifeButton(info) {
  if (info.lives >= info.max) return '';
  const price = ECONOMY.prices.life;
  const short = player.coins() < price;
  return `<button class="gbtn wide" data-act="buyLife" data-spend type="button"${short ? ' disabled' : ''} aria-label="Buy a life for ${price} coins">${ICONS.heart}+1 <span class="cost">${ICONS.coin}${price}</span></button>`;
}

function updateLives() {
  const info = player.lives();
  const coins = player.coins();
  const timer = info.nextIn === null ? 'Full' : clockText(info.nextIn);
  $('coinsCount').textContent = coins;
  $('homeCoinsText').textContent = coins;
  $('homeCoins').setAttribute('aria-label', `${coins} gold coins`);
  $('livesCount').textContent = info.lives;
  $('homeLivesCount').textContent = info.lives;
  $('homeLivesText').textContent = timer;
  $('homeLives').setAttribute('aria-label', `Lives: ${livesLine(info)}`);
  const card = document.getElementById('livesTimer');
  if (card) card.textContent = timer;
}
setInterval(updateLives, 500);

// While an ad runs, every button on the card is disabled so nothing can be pressed twice.
function lockCard(locked) {
  for (const b of document.querySelectorAll('#card button, #result button')) b.disabled = locked;
}

function releaseTilt() {
  game.tilt.target = [0, 0];
  game.tilt.holding = false;
}

function logAttempt(result, stars = 0) {
  appendLog({
    level: game.level.id,
    result,
    seconds: Number(game.elapsed.toFixed(2)),
    tilts: game.tilts,
    stars,
    delivered: game.sim ? game.sim.marbles.filter((m) => m.delivered).length : 0,
    marbles: game.sim ? game.sim.marbles.length : 0,
    timerStart: settings.timerStart,
    assist: settings.directionAssist,
    at: new Date().toISOString(),
  });
}

// ---------- Input ----------

attachInput($('stage'), {
  screenToGround: view.screenToGround,
  onFirstTouch: () => audio.unlock(),
  onTilt: (target, holding) => {
    if (game.screen !== 'game' || game.autoplay || game.paused || game.phase !== 'playing') return;
    if (holding && !game.tilt.holding) game.tilts++;
    game.tilt.target = target;
    game.tilt.holding = holding;
    if (holding && !game.timerRunning && Math.hypot(target[0], target[1]) > 0.05) game.timerRunning = true;
    if (holding) dismissHint(2500);
  },
});

$('playBtn').addEventListener('click', () => play());
$('homeLevels').addEventListener('click', () => openCard('levels', { from: 'home' }));
$('homeSettings').addEventListener('click', () => openCard('settings'));
$('profileBtn').addEventListener('click', () => pop('profile', 'Soon'));
$('homeLives').addEventListener('click', () => openCard('lives'));
$('homeCoins').addEventListener('click', () => openCard('coins'));
$('pauseBtn').addEventListener('click', () => !game.adShowing && openCard('pause'));
$('restartBtn').addEventListener('click', () => {
  if (game.adShowing) return;
  audio.unlock();
  resetMarbles();
});
$('orbitLeft').addEventListener('click', () => view.orbit(-1));
$('orbitRight').addEventListener('click', () => view.orbit(1));
window.addEventListener('resize', () => view.resize());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && MENU_CARDS.has(game.card) && game.card !== 'start') closeCard();
  else if (game.screen === 'home' && !game.card && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    play();
  } else if (game.screen === 'game' && e.code === 'KeyR' && !e.repeat && !game.adShowing && !game.card) {
    resetMarbles();
  } else if ((e.code === 'KeyN' || e.code === 'Enter') && game.card === 'win' && !game.adShowing) {
    ACTIONS.next();
  }
});

// ---------- Main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game.paused) tick(dt);
  view.sync(game.sim, game.tilt.current, dt);
  view.frame(dt);
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (game.autoplay) driveAutoplay(dt);
  if (game.screen === 'game' && game.phase === 'playing' && powerups.tick(dt, game.sim).length) powerBar.update();
  game.acc += dt;
  while (game.acc >= SIM_DT) {
    updateTilt(game.tilt, SIM_DT);
    if (game.phase !== 'failed') {
      const events = stepSim(game.sim, SIM_DT, gravityInMachine(game.tilt.current));
      for (const e of events) onSimEvent(e);
    }
    game.acc -= SIM_DT;
  }
  if (game.screen === 'game' && game.phase === 'playing') {
    if (!game.staked && !game.autoplay && game.elapsed >= ECONOMY.lives.freeRestartSeconds && !player.isFreeLevel(game.index)) {
      game.staked = true;
      player.stakeAttempt();
      updateLives();
    }
    if (game.timerRunning) {
      const before = game.timeLeft;
      game.timeLeft -= dt;
      game.elapsed += dt;
      if (game.timeLeft <= 5 && Math.ceil(game.timeLeft) < Math.ceil(before) && game.timeLeft > 0) audio.playEvent({ type: 'tick' });
    }
    if (isWon(game.sim)) win();
    else if (isLost(game.sim)) fail('fell');
    else if (game.timeLeft <= 0) fail();
    updateClock();
  }
  const rolling = game.screen === 'game' && game.phase !== 'failed';
  audio.updateRolling(game.sim.marbles.map((m) => (rolling && !m.delivered ? Math.abs(m.v) : 0)));
}

function onSimEvent(e) {
  audio.playEvent(e);
  if (e.type === 'deliver') {
    renderChips();
    try {
      if (settings.vibration) navigator.vibrate?.(18);
    } catch {
      // Vibration is optional.
    }
  }
}

function driveAutoplay(dt) {
  const ap = game.autoplay;
  const step = ap.steps[ap.i];
  if (!step) {
    releaseTilt();
    return;
  }
  const [dir, seconds, amount = 1] = step;
  game.tilt.target = directionVector(dir, amount);
  game.tilt.holding = dir !== '-';
  ap.t += dt;
  if (ap.t >= seconds) {
    ap.t -= seconds;
    ap.i++;
  }
}

function watchSolution() {
  play(game.index, { skipStart: true });
  game.timerRunning = true;
  game.autoplay = { steps: game.level.solution, i: 0, t: 0 };
  pop('play', 'Solution');
}

// ---------- HUD ----------

function updateClock() {
  const t = Math.max(0, game.timeLeft);
  $('time').textContent = t >= 10 ? Math.ceil(t) : t.toFixed(1);
  $('timeBar').style.transform = `scaleX(${game.times ? Math.min(1, t / game.times.limit) : 1})`;
  $('clock').classList.toggle('low', game.phase === 'playing' && game.timerRunning && t <= 5);
  $('timerNote').hidden = game.timerRunning || game.phase !== 'playing';
}

const chipsHtml = () =>
  game.sim.marbles.map((m) => `<span class="chip-marble${m.delivered ? ' delivered' : ''}" style="--c:${colorCss(m.color)}" title="${m.color}${m.delivered ? ' (home)' : ''}"></span>`).join('');
function renderChips() {
  $('chips').innerHTML = chipsHtml();
}

let hintTimer = null;
function showHint(text) {
  const el = $('hint');
  el.textContent = text || '';
  if (!text || !settings.hints) {
    el.classList.add('gone');
    return;
  }
  el.classList.remove('gone');
  delete el.dataset.dismissing;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.add('gone'), 6000);
}
function dismissHint(ms) {
  const el = $('hint');
  if (el.classList.contains('gone') || el.dataset.dismissing) return;
  el.dataset.dismissing = '1';
  setTimeout(() => {
    el.classList.add('gone');
    delete el.dataset.dismissing;
  }, ms);
}

// ---------- Cards and result screens ----------

// Cards opened from a menu pause the game; the win and time-up screens don't need to.
const MENU_CARDS = new Set(['start', 'levels', 'settings', 'howto', 'tools', 'giveUp', 'lives', 'noLives', 'coins', 'pause']);
const RESULTS = new Set(['win', 'fail']);
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

function openCard(kind, data = {}) {
  game.card = kind;
  game.cardData = data;
  if (MENU_CARDS.has(kind)) game.paused = true;
  const result = RESULTS.has(kind);
  const host = result ? $('result') : $('card');
  host.innerHTML = (result ? SCREENS : CARDS)[kind](data);
  $('scrim').hidden = result;
  $('result').hidden = !result;
  if (!result) host.setAttribute('aria-label', host.querySelector('h2')?.textContent || kind);
  for (const el of host.querySelectorAll('[data-act]')) el.addEventListener('click', () => ACTIONS[el.dataset.act](el));
  if (kind === 'settings' || kind === 'tools') wireSettings(host);
  if (kind === 'start') wireStart(host);
  if (kind === 'win') wireWin(host, data);
  if (kind === 'levels') host.querySelector('.lvl.current')?.scrollIntoView({ block: 'center' });
  // Never put the focus on something that spends coins, so Enter can't buy by accident.
  (host.querySelector('[data-focus]') || host.querySelector('[data-act]:not([data-spend])'))?.focus({ preventScroll: true });
}

function closeCard() {
  game.card = null;
  game.cardData = null;
  game.paused = false;
  $('scrim').hidden = true;
  $('result').hidden = true;
  $('result').innerHTML = '';
}

// A big title in white letters with a coloured outline.
const TITLE_COLORS = { gold: ['url(#mm-gold)', '#6b4a12'], red: ['url(#mm-red)', '#5a140c'] };
function titleSvg(text, color = 'gold') {
  const [fill, edge] = TITLE_COLORS[color];
  const size = text.length > 8 ? 54 : 70;
  return `<svg class="title" viewBox="0 0 330 104" role="img" aria-label="${text}"><text x="165" y="78" text-anchor="middle" font-size="${size}" letter-spacing="2" fill="${fill}" stroke="${edge}" stroke-width="3" stroke-linejoin="round" paint-order="stroke" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,.4))">${text}</text></svg>`;
}

const X = (act = 'close', label = 'Close') => `<button class="xbtn" data-act="${act}" type="button" aria-label="${label}"><svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>`;
const walletHtml = (coins = player.coins(), lives = true) =>
  `<div class="wallet"><span class="pill" id="resWallet">${ICONS.coin}<b id="resCoins">${coins}</b></span>${lives ? `<span class="pill lives">${ICONS.heart}<span class="heart-n ol">${player.lives().lives}</span></span>` : ''}</div>`;

const SCREENS = {
  // Success: stars, then a panel with the time and the coins won (and an optional ad that
  // multiplies them: its button shows what the pointer is on). Next goes home.
  win: ({ stars, t, demo, reward, bonus }) => {
    const paid = reward?.total || 0;
    const adOk = paid > 0 && ads.canOfferCoins(bonus);
    const segs = ECONOMY.winMultiplier.segments;
    return `
    ${walletHtml(player.coins() - paid, false)}
    ${titleSvg(demo ? 'Solution' : 'Success')}
    <div class="stars" aria-label="${stars} of 3 stars">${starsRow(stars)}</div>
    <div class="panel">
      <div class="summary">
        <span class="time">${ICONS.clock}${t.toFixed(1)} s</span>
        ${paid ? `<span class="loot" id="loot">${ICONS.coin}<b id="lootAmount">+${paid}</b></span>` : ''}
      </div>
      ${adOk ? `<div class="mult idle" id="mult">${segs.map((m, i) => `<span data-m="${m}" data-i="${i}">x${m}</span>`).join('')}<i class="pointer"></i></div>
      <button class="gbtn blue wide" data-act="adCoins" type="button" aria-label="Watch an ad to multiply the coins">${ICONS.video}<span class="cost">${ICONS.coin}<b id="adValue">${paid * segs[0]}</b></span></button>` : ''}
    </div>
    <div class="stack">
      <button class="gbtn big wide" data-act="next" type="button" data-focus>Next</button>
      <button class="linkish" data-act="retry" type="button">Play again</button>
    </div>`;
  },
  // Time's up, or a marble fell (then more time wouldn't help: only a checkpoint or a retry).
  fail: ({ noAd = false } = {}) => {
    const fell = game.failReason === 'fell';
    const sc = ECONOMY.secondChance;
    const scOk = !fell && !game.autoplay && game.attempt.secondChance < sc.perAttempt;
    const short = player.coins() < sc.cost;
    const adOk = !fell && !noAd && !game.autoplay && ads.canOfferExtraTime(game.attempt);
    const risk = player.attemptAtRisk() ? lifeTag() : '';
    return `
    ${walletHtml()}
    ${titleSvg(fell ? 'Oops!' : "Time's up!", 'red')}
    <div class="shake">${fell ? ICONS.fall : ICONS.clock}</div>
    <div class="chips" aria-label="Marbles home">${chipsHtml()}</div>
    <div class="stack">
      ${scOk ? `<button class="gbtn" data-act="secondChance" data-spend type="button"${short ? ' disabled' : ''} aria-label="${sc.seconds} more seconds for ${sc.cost} coins">${ICONS.time}+${sc.seconds}s <span class="cost">${ICONS.coin}${sc.cost}</span></button>` : ''}
      ${adOk ? `<button class="gbtn blue" data-act="watchAd" type="button" aria-label="Watch an ad for ${ads.config.rewardedExtraTime.seconds} more seconds">${ICONS.video}+${ads.config.rewardedExtraTime.seconds}s</button>` : ''}
      ${checkpointButton()}
    </div>
    <div class="minor">
      <button class="gbtn cream round" data-act="home" type="button" aria-label="Home">${ICONS.home}${risk}</button>
      <button class="gbtn orange round" data-act="retry" type="button" aria-label="Try again" data-focus>${ICONS.restart}${risk}</button>
    </div>`;
  },
};

function wireWin(host, { reward }) {
  const paid = reward?.total || 0;
  const mult = host.querySelector('#mult');
  if (mult) {
    requestAnimationFrame(() => mult.style.setProperty('--w', `${mult.clientWidth}px`));
    // While the pointer sweeps, the ad button shows the coins under it.
    const value = host.querySelector('#adValue');
    const pointer = mult.querySelector('.pointer');
    const segs = [...mult.querySelectorAll('span[data-m]')];
    const follow = () => {
      if (!host.contains(mult) || !mult.classList.contains('idle')) return;
      const x = new DOMMatrixReadOnly(getComputedStyle(pointer).transform).m41;
      const seg = segs.find((el) => x >= el.offsetLeft - 2 && x <= el.offsetLeft + el.offsetWidth + 2);
      if (seg && value) value.textContent = paid * Number(seg.dataset.m);
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }
  if (!paid) return;
  const coins = host.querySelector('#resCoins');
  setTimeout(() => {
    if (!host.contains(coins)) return;
    flyCoins(host.querySelector('#loot'), host.querySelector('#resWallet'), 8);
    setTimeout(() => countUp(coins, Number(coins.textContent), player.coins()), 650);
  }, 1100);
}

// After the ad: the pointer swings once more and lands on the multiplier drawn by chance.
function landPointer(index, done) {
  const mult = $('mult');
  if (!mult) return done();
  const pointer = mult.querySelector('.pointer');
  const seg = mult.querySelector(`[data-i="${index}"]`);
  const from = new DOMMatrixReadOnly(getComputedStyle(pointer).transform).m41;
  const w = mult.clientWidth;
  const target = seg.offsetLeft + seg.offsetWidth / 2;
  mult.classList.remove('idle');
  pointer.style.setProperty('--x', `${target}px`);
  const x = (v) => ({ transform: `translateX(${v}px)` });
  pointer.animate([x(from), x(w - 14), x(14), x(target)], { duration: 1800, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' }).finished.then(() => {
    seg.classList.add('hit');
    done();
  });
}

const CARDS = {
  // Before a level (from level 11): power-ups to start with, then Play.
  start: () => {
    const got = loadProgress()[game.level.id]?.stars || 0;
    const ids = ECONOMY.powerUps.atStart.filter((id) => powerups.list().some((p) => p.id === id));
    return `${X('startClose', 'Back')}
    <h2 class="ol">${levelTitle(game.index)}</h2>
    ${game.level.hard ? `<div class="row">${hardTag(game.level)}</div>` : ''}
    <div class="box">
      <div class="start-info"><div class="stars">${starsRow(got)}</div><div class="timer-line">${ICONS.clock}${game.times.limit}s</div></div>
      <div class="boosts">${ids
        .map((id) => {
          const p = powerUp(id);
          return `<button class="boost" type="button" data-boost="${id}" aria-pressed="false" aria-label="${p.name}, ${p.cost} coins">${ICONS[id]}<span class="price">${ICONS.coin}${p.cost}</span><span class="tick">${ICONS.check}</span></button>`;
        })
        .join('')}</div>
      <p class="fine" id="boostName">&nbsp;</p>
    </div>
    <button class="gbtn big wide" data-act="go" type="button" data-focus>Play</button>`;
  },
  // Asked before restarting or leaving an attempt that would cost a life.
  giveUp: ({ kind }) => `
    <h2 class="ol">${kind === 'restart' ? 'Restart?' : 'Leave?'}</h2>
    <div class="box"><div class="big-icon">${ICONS.heart}<b class="n ol">−1</b></div></div>
    ${checkpointButton()}
    <div class="row">
      <button class="gbtn" data-act="close" type="button" data-focus>Keep playing</button>
      <button class="gbtn orange square" data-act="giveUp" type="button" aria-label="${kind === 'restart' ? 'Restart' : 'Leave'} for one life">${kind === 'restart' ? ICONS.restart : ICONS.home}${lifeTag()}</button>
    </div>`,
  lives: () => {
    const info = player.lives();
    return `${X('livesBack')}
    <h2 class="ol">Lives</h2>
    <div class="box">
      <div class="big-icon">${ICONS.heart}<b class="n ol">${info.lives}</b></div>
      <div class="timer-line">${ICONS.clock}<span id="livesTimer">${info.nextIn === null ? 'Full' : clockText(info.nextIn)}</span></div>
    </div>
    ${buyLifeButton(info)}`;
  },
  noLives: () => {
    const info = player.lives();
    return `${X('livesBack')}
    <h2 class="ol">No lives</h2>
    <div class="box">
      <div class="big-icon">${ICONS.heartEmpty}<b class="n ol">0</b></div>
      <div class="timer-line">${ICONS.clock}<span id="livesTimer">${info.nextIn === null ? 'Full' : clockText(info.nextIn)}</span></div>
    </div>
    ${buyLifeButton(info)}`;
  },
  coins: () => `${X()}
    <h2 class="ol">Coins</h2>
    <div class="box"><div class="big-stat">${ICONS.coin}<span>${player.coins()}</span></div></div>`,
  pause: () => `
    <h2 class="ol">Paused</h2>
    <button class="gbtn big wide" data-act="close" type="button" aria-label="Resume" data-focus>${ICONS.play}</button>
    <div class="row">
      <button class="gbtn cream square" data-act="pauseHome" type="button" aria-label="Home">${ICONS.home}</button>
      <button class="gbtn blue square" data-act="settings" type="button" aria-label="Settings">${ICONS.gear}</button>
    </div>`,
  levels: ({ from }) => {
    game.levelsFrom = from;
    const progress = loadProgress();
    const current = game.screen === 'game' ? game.index : nextLevelIndex();
    return `${X('levelsBack')}
    <h2 class="ol">Levels</h2>
    <div class="box"><div class="grid-levels">
      ${LEVELS.map((l, i) => {
        const p = progress[l.id];
        if (!isUnlocked(progress, i)) return `<button class="lvl" type="button" disabled aria-label="Level ${i + 1}, locked"><span class="lockico">${ICONS.lock}</span></button>`;
        const cls = `lvl ol${l.hard ? ' hard' : ''}${p ? ' done' : ''}${i === current ? ' current' : ''}`;
        return `<button class="${cls}" type="button" data-act="pick" data-i="${i}" aria-label="Level ${i + 1}${l.hard ? ', hard' : ''}${p ? `, ${p.stars} stars` : ''}">${i + 1}<span class="mini">${p ? starsRow(p.stars) : ''}</span>${l.hard ? `<span class="flame">${ICONS.flame}</span>` : ''}</button>`;
      }).join('')}
    </div></div>`;
  },
  // Three big toggles and how to play. Playtest tools sit behind a small link at the bottom.
  settings: () => `${X()}
    <h2 class="ol">Settings</h2>
    <div class="toggles">
      ${toggle('sound', 'Sound', ICONS.sound)}
      ${canVibrate ? toggle('vibration', 'Vibration', ICONS.vibration) : ''}
      ${toggle('hints', 'Tips', ICONS.bulb)}
    </div>
    <button class="gbtn cream wide" data-act="howto" type="button">How to play</button>
    ${ads.privacyOptionsRequired ? '<p class="fine"><button class="linkish" data-act="privacy" type="button">Privacy choices for ads</button></p>' : ''}
    <p class="fine"><button class="linkish" data-act="tools" type="button">Playtest tools</button></p>`,
  howto: () => `${X('settings', 'Back to settings')}
    <h2 class="ol">How to play</h2>
    <div class="box"><ul class="howto">
      <li><span class="demo"><i></i></span>Drag to tilt</li>
      <li>${ICONS.goal}Each marble to its colour</li>
      <li>${ICONS.gates}Plates open gates</li>
      <li>${ICONS.clock}Beat the clock</li>
    </ul></div>
    <button class="gbtn wide" data-act="close" type="button">OK</button>`,
  // For the designer and playtest sessions, not for players.
  tools: () => {
    const rows = summariseLog();
    return `${X('settings', 'Back to settings')}
    <h2 class="ol">Playtest tools</h2>
    <div class="box tools">
    <div class="setting"><label>Clock starts<small>Compare both with testers</small></label>
      <span class="seg" role="group" aria-label="Clock starts">
        <button type="button" data-set="timerStart" data-v="appear" aria-pressed="${settings.timerStart === 'appear'}">When it appears</button>
        <button type="button" data-set="timerStart" data-v="firstTilt" aria-pressed="${settings.timerStart === 'firstTilt'}">On first tilt</button>
      </span></div>
    <div class="setting"><label>Direction assist<small>Snaps tilts to grooves and diagonals</small></label>
      <span class="seg" role="group" aria-label="Direction assist">
        <button type="button" data-set="directionAssist" data-v="true" aria-pressed="${settings.directionAssist}">On</button>
        <button type="button" data-set="directionAssist" data-v="false" aria-pressed="${!settings.directionAssist}">Off</button>
      </span></div>
    <div class="setting"><label>Lives<small>${livesLine(player.lives())}</small></label>
      <span class="row"><button class="btn" data-act="lifeMinus" type="button">−1</button>
      <button class="btn" data-act="lifeSkip" type="button">Skip ${ECONOMY.lives.regenMinutes} min</button>
      <button class="btn" data-act="lifeFill" type="button">Fill</button>
      <button class="btn" data-act="resetEconomy" type="button">Reset</button></span></div>
    <div class="setting"><label>Gold coins<small>${player.coins()}</small></label>
      <span class="row"><button class="btn" data-act="coinsPlus" type="button">+500</button></span></div>
    <div class="setting"><label>Ads<small>${adStatus()}</small></label></div>
    <div class="setting"><label>Progress<small>${TESTING.unlockAllLevels ? 'All levels open for testing (TESTING.unlockAllLevels)' : 'Locks every level but the first again, for the next tester'}</small></label>
      <span class="row"><button class="btn" data-act="levels" type="button">Levels</button>
      <button class="btn" data-act="resetProgress" type="button">Reset progress</button></span></div>
    <h3>Feel tuning</h3>
    ${slider('gravity', 'Marble speed (gravity)', PHYSICS.gravity, 12, 60, 1, PHYSICS)}
    ${slider('maxTiltDeg', 'Max tilt (degrees)', PHYSICS.maxTiltDeg, 10, 25, 1, PHYSICS)}
    ${slider('dragBraking', 'Brake when you let go', PHYSICS.dragBraking, 2, 12, 0.5, PHYSICS)}
    ${slider('tiltResponse', 'Tilt responsiveness', CONTROLS.tiltResponse, 10, 45, 1, CONTROLS)}
    ${slider('dragForFullTilt', 'Drag distance for full tilt', CONTROLS.dragForFullTilt, 0.08, 0.3, 0.01, CONTROLS)}
    <p class="note ${game.solutionOk ? 'ok' : 'bad'}" id="solutionNote">${solutionNote()}</p>
    <div class="row">
      <button class="btn" data-act="solution" type="button">Watch the solution</button>
      <button class="btn" data-act="resetTuning" type="button">Reset tuning</button>
    </div>
    <h3>Playtest log</h3>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Level</th><th>Tries</th><th>Won</th><th>Time up</th><th>Restarts</th><th>Best</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${r.n}. ${r.name}</td><td>${r.tries}</td><td>${r.won}</td><td>${r.timeUp}</td><td>${r.restarts}</td><td>${r.best ?? '–'}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="note">No attempts logged on this device yet.</p>'}
    <textarea id="logText" hidden rows="5" style="width:100%;font:12px monospace" aria-label="Playtest log as JSON"></textarea>
    <div class="row">
      <button class="btn" data-act="copyLog" type="button">Copy log</button>
      <button class="btn" data-act="clearLog" type="button">Clear log</button>
    </div>
    </div>`;
  },
};

// The level start card: tap power-ups to take them into the level.
function wireStart(host) {
  const name = host.querySelector('#boostName');
  const picked = () => [...host.querySelectorAll('.boost[aria-pressed="true"]')].map((b) => b.dataset.boost);
  const cost = (ids) => ids.reduce((sum, id) => sum + powerUp(id).cost, 0);
  for (const b of host.querySelectorAll('.boost')) {
    b.addEventListener('click', () => {
      const p = powerUp(b.dataset.boost);
      name.innerHTML = `<b>${p.name}</b> · ${p.about}`;
      if (b.getAttribute('aria-pressed') === 'true') return b.setAttribute('aria-pressed', 'false');
      if (cost(picked()) + p.cost > player.coins()) {
        b.classList.remove('nope');
        void b.offsetWidth;
        b.classList.add('nope');
        name.innerHTML = `Needs ${p.cost} ${ICONS.coin}`;
        return;
      }
      b.setAttribute('aria-pressed', 'true');
    });
  }
  game.startPicks = picked;
}

const ACTIONS = {
  close: () => closeCard(),
  retry: () => {
    if (game.adShowing) return;
    withLifeLoss(() => retryLevel());
  },
  giveUp: () => {
    const go = pendingGiveUp;
    pendingGiveUp = null;
    withLifeLoss(() => go?.());
  },
  // Open the level (the start card sits over the home screen) with the power-ups picked.
  go: () => {
    const picks = game.startPicks?.() || [];
    game.startPicks = null;
    play(game.index, { skipStart: true });
    if (game.screen !== 'game') return;
    picks.forEach((id, k) => setTimeout(() => game.phase === 'playing' && usePowerUp(id), 400 + k * 650));
  },
  startClose: () => closeCard(),
  // Next goes home, where the next level is waiting. This break is the only place an
  // interstitial may show.
  next: async () => {
    if (game.adShowing) return;
    const level = game.index + 1;
    const opts = { afterRewarded: game.attempt.extraTimeUsed > 0 || game.cardData?.bonus?.coinsAdUsed > 0 };
    if (ads.interstitialBlocker(level, opts) === null) {
      game.adShowing = true;
      lockCard(true);
      await ads.showInterstitialIfDue(level, opts);
      game.adShowing = false;
    } else {
      ads.showInterstitialIfDue(level, opts); // only starts loading one for a later break
    }
    showHome({ advanced: true });
  },
  // Watch an ad after a win: the coins it paid are multiplied.
  adCoins: async (el) => {
    if (game.adShowing || game.card !== 'win') return;
    const data = game.cardData;
    game.adShowing = true;
    el.disabled = true;
    const r = await ads.watchForCoins(data.bonus);
    game.adShowing = false;
    if (game.card !== 'win' || game.cardData !== data) return;
    if (!r.granted) {
      el.disabled = false;
      pop('video', r.reason === 'closed-early' ? 'No reward' : 'No ad');
      return;
    }
    el.hidden = true;
    const paid = data.reward.total;
    const m = pickMultiplier();
    player.grantBonus(paid * (m - 1), `ad x${m}`);
    updateLives();
    landPointer(segmentFor(m), () => {
      const amount = $('lootAmount');
      const coins = $('resCoins');
      amount.classList.add('bump');
      countUp(amount, paid, paid * m, 700, (v) => `+${v}`);
      flyCoins($('loot'), $('resWallet'), 10);
      setTimeout(() => countUp(coins, Number(coins.textContent), player.coins()), 600);
      audio.playEvent({ type: 'deliver' });
    });
  },
  // Pay coins to carry on the same attempt after the clock ran out. No life is charged now;
  // if this attempt runs out again, that loss costs the usual one life.
  secondChance: (el) => {
    if (game.adShowing || game.card !== 'fail' || el.disabled) return;
    lockCard(true);
    const sc = ECONOMY.secondChance;
    const paid = player.pay(sc.cost, 'second chance', () => {
      if (game.phase !== 'failed' || game.attempt.secondChance >= sc.perAttempt) return false;
      game.attempt.secondChance++;
      return true;
    });
    if (paid.ok) continueWithExtraTime(sc.seconds);
    else openCard('fail');
  },
  watchAd: async (el) => {
    if (game.adShowing || game.card !== 'fail') return;
    const attempt = game.attempt;
    game.adShowing = true;
    lockCard(true);
    el.classList.add('loading');
    const result = await ads.watchForExtraTime(attempt);
    game.adShowing = false;
    if (game.card !== 'fail' || game.attempt !== attempt) return;
    if (result.granted) continueWithExtraTime(result.seconds);
    else {
      openCard('fail', { noAd: true });
      pop('video', result.reason === 'closed-early' ? 'No reward' : 'No ad');
    }
  },
  privacy: () => ads.showPrivacyOptions().catch(() => {}),
  home: () => {
    if (!game.adShowing) withLifeLoss(() => showHome());
  },
  livesBack: () => (game.screen === 'game' && game.phase !== 'playing' ? showHome() : closeCard()),
  settings: () => openCard('settings'),
  howto: () => openCard('howto'),
  tools: () => openCard('tools'),
  levels: () => openCard('levels', { from: 'tools' }),
  levelsBack: () => (game.levelsFrom === 'tools' ? openCard('tools') : closeCard()),
  pick: (el) => requestGiveUp('leave', () => play(Number(el.dataset.i))),
  solution: () => requestGiveUp('leave', watchSolution),
  pauseHome: () => requestGiveUp('leave', showHome),
  restoreCheckpoint: (el) => !el.disabled && restoreCheckpoint(),
  buyLife: (el) => {
    if (el.disabled) return;
    el.disabled = true;
    const r = player.buyLife();
    updateLives();
    if (r.ok) {
      audio.playEvent({ type: 'deliver' });
      pop('heart', '+1');
    }
    // Back to wherever the card was opened from, now with the new life.
    openCard(game.card === 'noLives' && player.lives().lives > 0 ? 'lives' : game.card);
  },
  coinsPlus: () => {
    player.addCoins(500);
    updateLives();
    openCard('tools');
  },
  lifeMinus: () => {
    player.setLives(player.lives().lives - 1);
    openCard('tools');
  },
  lifeFill: () => {
    player.setLives(ECONOMY.lives.max);
    openCard('tools');
  },
  lifeSkip: () => {
    player.skipTime(ECONOMY.lives.regenMinutes);
    openCard('tools');
  },
  resetEconomy: () => {
    player.reset();
    openCard('tools');
  },
  copyLog: (el) => {
    const text = JSON.stringify(loadLog(), null, 1);
    const fallback = () => {
      const area = $('logText');
      area.hidden = false;
      area.value = text;
      area.select();
      el.textContent = 'Select all and copy';
    };
    try {
      navigator.clipboard.writeText(text).then(() => (el.textContent = 'Copied'), fallback);
    } catch {
      fallback();
    }
  },
  clearLog: () => {
    clearLog();
    openCard('tools');
  },
  resetProgress: (el) => {
    if (el.dataset.armed) {
      resetProgress();
      game.nextUp = null;
      showHome();
      return;
    }
    el.dataset.armed = '1';
    el.textContent = 'Tap again to reset';
    setTimeout(() => {
      delete el.dataset.armed;
      el.textContent = 'Reset progress';
    }, 3000);
  },
  resetTuning: () => {
    Object.assign(PHYSICS, DEFAULT_PHYSICS);
    Object.assign(CONTROLS, DEFAULT_CONTROLS, { directionAssist: settings.directionAssist });
    computeTimes();
    openCard('tools');
  },
};

function toggle(key, label, icon) {
  return `<button class="toggle" type="button" data-toggle="${key}" aria-pressed="${settings[key]}">
    <span class="disc">${icon}</span><span>${label}</span></button>`;
}

function slider(key, label, value, min, max, step, target) {
  const owner = target === PHYSICS ? 'physics' : 'controls';
  return `<div class="slider"><div class="lab"><span>${label}</span><span id="val-${key}">${value}</span></div>
    <input type="range" id="tune-${key}" data-owner="${owner}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function adStatus() {
  const s = ads.status();
  if (s.provider === 'simulated') return 'Simulated test ads (browser, TESTING.simulateAds)';
  if (!nativePlatform()) return 'Off: ads only run in the Android and iOS app builds';
  if (!ads.available()) return `Not active (${s.provider === 'none' ? 'no ad SDK' : 'no consent to request ads'})`;
  const c = ads.config.interstitial;
  return `AdMob ${s.testMode ? 'test ads' : 'LIVE ads'} · rewarded ${s.rewardedReady ? 'ready' : 'loading'} · interstitial ${s.interstitialReady ? 'ready' : 'loading'} · ${s.completedSinceInterstitial} of ${c.everyCompletedLevels} levels since the last one`;
}

function solutionNote() {
  return game.solutionOk
    ? `Reference solution works with these settings (${game.solutionTime.toFixed(1)} s). Timer: ${game.times.limit} s.`
    : 'With these settings the reference solution no longer solves this level. Timers fall back to defaults.';
}

function wireSettings(card) {
  for (const b of card.querySelectorAll('[data-toggle]')) {
    b.addEventListener('click', () => {
      const key = b.dataset.toggle;
      settings[key] = !settings[key];
      saveSettings(settings);
      b.setAttribute('aria-pressed', String(settings[key]));
      audio.setSoundEnabled(settings.sound);
      if (key === 'hints' && !settings.hints) $('hint').classList.add('gone');
      if (key === 'vibration' && settings.vibration) {
        try {
          navigator.vibrate?.(18);
        } catch {
          // Vibration is optional.
        }
      }
    });
  }
  for (const b of card.querySelectorAll('[data-set]')) {
    b.addEventListener('click', () => {
      const key = b.dataset.set;
      settings[key] = key === 'timerStart' ? b.dataset.v : b.dataset.v === 'true';
      saveSettings(settings);
      CONTROLS.directionAssist = settings.directionAssist;
      audio.setSoundEnabled(settings.sound);
      for (const sib of card.querySelectorAll(`[data-set="${key}"]`)) sib.setAttribute('aria-pressed', String(sib === b));
      if (key === 'timerStart' && !player.attemptAtRisk()) restart(false);
    });
  }
  for (const input of card.querySelectorAll('input[type=range]')) {
    input.addEventListener('input', () => {
      const target = input.dataset.owner === 'physics' ? PHYSICS : CONTROLS;
      target[input.dataset.key] = Number(input.value);
      card.querySelector(`#val-${input.dataset.key}`).textContent = input.value;
    });
    input.addEventListener('change', () => {
      computeTimes();
      const note = card.querySelector('#solutionNote');
      note.textContent = solutionNote();
      note.className = `note ${game.solutionOk ? 'ok' : 'bad'}`;
    });
  }
}

function summariseLog() {
  const byLevel = new Map();
  for (const e of loadLog()) {
    if (!byLevel.has(e.level)) byLevel.set(e.level, { tries: 0, won: 0, timeUp: 0, restarts: 0, best: null });
    const r = byLevel.get(e.level);
    if (e.result === 'extra-time' || e.result === 'restored') continue;
    if (e.result === 'reset') {
      r.restarts++;
      continue;
    }
    r.tries++;
    if (e.result === 'won') {
      r.won++;
      r.best = r.best === null ? e.seconds : Math.min(r.best, e.seconds);
    } else if (e.result === 'time-up') r.timeUp++;
    else if (e.result === 'restarted') r.restarts++;
  }
  return LEVELS.map((l, i) => ({ n: i + 1, name: l.name, ...byLevel.get(l.id) })).filter((r) => r.tries);
}

// ---------- Start ----------

function start(data = {}) {
  view.resize();
  const left = player.recover();
  if (data.screen === 'game' && typeof data.index === 'number' && isUnlocked(loadProgress(), data.index)) {
    play(data.index);
  } else {
    showHome();
  }
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });
  startAds().catch(() => {});
  // The game closed during an attempt that had cost a life: show the heart breaking.
  if (left.charged) setTimeout(() => heartBreak().then(updateLives), 700);
}

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ index: game.index, screen: game.screen }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

// For automated checks and debugging in the browser console.
window.__mmr = { game, play, showHome, restart, LEVELS, view, ads, player, powerups, usePowerUp, routeFor, openCard };
