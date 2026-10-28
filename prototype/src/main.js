// The game: home screen, level flow, timer, win/lose, menus and the playtest log.

import { LEVELS } from './levels.js';
import { PHYSICS, CONTROLS, SIM_DT } from './config.js';
import { buildTrack } from './track.js';
import { createSim, stepSim, isWon } from './sim.js';
import { createTilt, updateTilt, gravityInMachine, directionVector } from './tilt.js';
import { replay, levelTimes } from './replay.js';
import { createView, MARBLE_COLORS } from './render.js';
import { attachInput } from './input.js';
import * as audio from './audio.js';
import { loadSettings, saveSettings, loadProgress, recordResult, resetProgress, loadLog, appendLog, clearLog, adStore } from './store.js';
import { createAds, loadAdConfig } from './ads.js';
import { admobProvider, nativePlatform } from './ads-admob.js';
import { createPlayer, clockText } from './player.js';
import { ECONOMY, powerUp } from './economy.js';
import { createPowerUps } from './powerups.js';
import { createPowerBar, POWER_ICONS } from './powerbar.js';
import { decodeTable, findHint } from './hints.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_PHYSICS = { ...PHYSICS };
const DEFAULT_CONTROLS = { ...CONTROLS };

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
  levelsFrom: 'home', // where the level list's Back button returns to
};

// Ads exist only in the Android and iOS app builds (see ads.js). In a browser there is no
// ad SDK, so `ads.available()` stays false and no ad buttons appear.
const ads = createAds({ store: adStore });
async function startAds() {
  if (!nativePlatform()) return;
  const fetchJson = (url) => fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const config = await loadAdConfig({ fetchJson, store: adStore });
  await ads.attach(admobProvider(config), config);
}

// Lives and gold coins: see player.js and docs/economy.md. Levels finished before coins
// existed count as already paid.
const player = createPlayer({ legacyPaid: () => Object.fromEntries(Object.entries(loadProgress()).map(([id, p]) => [id, Math.min(3, Math.max(1, p.stars || 1))])) });
const HEART = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21.2s-7.6-4.7-9.7-9.4C.8 8.3 2.9 4.4 6.7 4.4c2.1 0 3.6 1.2 5.3 3.3 1.7-2.1 3.2-3.3 5.3-3.3 3.8 0 5.9 3.9 4.4 7.4-2.1 4.7-9.7 9.4-9.7 9.4z"/></svg>';
const COIN = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e8b23a"/><circle cx="12" cy="12" r="9" fill="none" stroke="#a8730f" stroke-width="2"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff1c2" stroke-width="1.6" opacity=".85"/></svg>';
// Power-ups (from level 11): rules in powerups.js, the row of tokens in powerbar.js.
const powerups = createPowerUps({ player });
const puContext = () => ({ sim: game.sim, playing: game.screen === 'game' && game.phase === 'playing' && !game.autoplay, levelIndex: game.index, addTime });
const powerBar = createPowerBar({ bar: $('powerbar'), tag: $('ptag'), powerups, player, context: puContext, use: usePowerUp, coinIcon: COIN });
setInterval(() => powerBar.update(), 120);

const livesLine = ({ lives, max, nextIn }) => (nextIn === null ? `${lives}/${max} · Full` : `${lives}/${max} · Next life in ${clockText(nextIn)}`);

const colorCss = (c) => `#${(MARBLE_COLORS[c] ?? 0xffffff).toString(16).padStart(6, '0')}`;

// ---------- Progress: a level opens once the one before it is complete ----------

const isComplete = (progress, i) => Boolean(progress[LEVELS[i].id]);
const isUnlocked = (progress, i) => i === 0 || isComplete(progress, i - 1);
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
  $('levelNum').textContent = game.index + 1;
  $('levelName').textContent = game.level.name;
  restart(false);
}

function leaveAttempt() {
  if (game.screen === 'game' && game.phase === 'playing' && !game.autoplay && (game.elapsed > 0.3 || game.tilts > 0)) logAttempt('left');
}

function showHome() {
  leaveAttempt();
  closeCard();
  game.screen = 'home';
  const progress = loadProgress();
  const done = LEVELS.filter((_, i) => isComplete(progress, i)).length;
  prepareLevel(nextLevelIndex());
  $('homeProgress').textContent = `${done} of ${LEVELS.length} levels complete`;
  $('homeNext').textContent = done === LEVELS.length ? 'All levels complete · play again' : done === 0 ? 'First level' : 'Next level';
  $('homeNum').textContent = game.index + 1;
  $('homeName').textContent = game.level.name;
  $('playBtn').setAttribute('aria-label', `Play level ${game.index + 1}, ${game.level.name}`);
  document.body.classList.add('at-home');
  $('home').hidden = false;
  view.setSpin(true);
}

function play(index = game.index) {
  if (!isUnlocked(loadProgress(), index)) return;
  if (!player.canPlay(index)) {
    openCard('noLives');
    return;
  }
  audio.unlock();
  leaveAttempt();
  closeCard();
  if (index !== game.index || !game.level) prepareLevel(index);
  game.screen = 'game';
  document.body.classList.remove('at-home');
  $('home').hidden = true;
  view.setSpin(false);
  showHint(game.level.learn);
  restart(false);
  if (!game.autoplay && game.index + 1 >= ECONOMY.powerUps.unlockLevel && !player.seen('powerups')) {
    player.markSeen('powerups');
    openCard('powerIntro');
  }
}

function restart(logIt = true) {
  if (logIt && game.screen === 'game' && game.phase === 'playing' && !game.autoplay && (game.elapsed > 0.3 || game.tilts > 0)) logAttempt('restarted');
  // Whatever path got here, an attempt that was under way (or lost) is charged once. The
  // buttons that lead here ask first (see requestGiveUp).
  if (player.attemptAtRisk()) player.chargeAttempt();
  if (game.screen === 'game') player.startAttempt(game.level.id, game.index);
  else player.clearAttempt();
  game.staked = false;
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
  $('banner').hidden = true;
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
    reward = player.grantLevel(game.level.id, game.index, stars);
    updateLives();
  }
  audio.playEvent({ type: 'win' });
  const attempt = game.sim;
  setTimeout(() => {
    if (game.phase === 'won' && game.sim === attempt) openCard('win', { stars, t, demo, reward });
  }, 450);
}

function fail() {
  game.phase = 'failed';
  game.timeLeft = 0;
  endPowerUps();
  releaseTilt();
  if (!game.autoplay) player.loseAttempt();
  if (!game.autoplay) logAttempt('time-up');
  audio.playEvent({ type: 'fail' });
  openCard('fail');
}

// The rewarded ad paid out: pick the level up where the clock stopped.
function continueWithExtraTime(seconds) {
  player.resumeAttempt();
  closeCard();
  game.phase = 'playing';
  game.timeLeft = seconds;
  game.timerRunning = true;
  logAttempt('extra-time');
  $('banner').textContent = `+${seconds} s`;
  $('banner').hidden = false;
  setTimeout(() => {
    if ($('banner').textContent === `+${seconds} s`) $('banner').hidden = true;
  }, 1500);
  updateClock();
}

const AD_MESSAGES = {
  unavailable: 'No ad is available right now, so no extra time this round. You can try the level again.',
  'closed-early': 'The ad closed before the end, so there\'s no extra time this round. You can try the level again.',
};

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

// Try the current level again: the old attempt is charged if it has to be, and with no
// lives left the out-of-lives card shows instead.
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

const canContinue = () => !game.autoplay && game.attempt.secondChance < ECONOMY.secondChance.perAttempt && player.coins() >= ECONOMY.secondChance.cost;

// "Continue +15 s · 90" on the Time's up card, once per attempt.
function secondChanceButton() {
  const sc = ECONOMY.secondChance;
  if (game.autoplay || game.attempt.secondChance >= sc.perAttempt) return '';
  const coins = player.coins();
  const short = coins < sc.cost;
  return `<button class="btn wide${short ? '' : ' primary'}" data-act="secondChance" data-spend type="button"${short ? ' disabled' : ''}>Continue +${sc.seconds} s <span class="cost">· ${sc.cost} ${COIN}</span></button>
    ${short ? `<p class="fine">You have ${coins} ${COIN}.</p>` : ''}`;
}

// On the Time's up card: what accepting the loss costs.
function lossNote() {
  if (player.isFreeLevel(game.index)) return '';
  const { lives } = player.lives();
  const first = !player.seen('lives');
  if (first) player.markSeen('lives');
  return `<p class="note">Trying again or going home costs 1 life: you'll have ${lives - 1} of ${ECONOMY.lives.max}.${first ? ` Lives come back one every ${ECONOMY.lives.regenMinutes} minutes, even with the game closed.` : ''}</p>`;
}

// ---------- Power-ups ----------

function flash(text, ms = 1600) {
  const b = $('banner');
  b.textContent = text;
  b.hidden = false;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => {
    if (b.textContent === text) b.hidden = true;
  }, ms);
}

function addTime(seconds) {
  game.timeLeft += seconds;
  flash(`+${seconds} s`);
  updateClock();
}

function endPowerUps() {
  powerups.endAll(game.sim);
  view.clearHint();
  powerBar.disarm();
  powerBar.update();
}

const FEEDBACK = {
  speed: (p) => `Speed Boost · ${p.duration} s`,
  gates: (p) => `Every gate open · ${p.duration} s`,
};

function usePowerUp(id) {
  if (id === 'hint') return useHint();
  const r = powerups.activate(id, puContext());
  if (!r.ok) return powerBar.message(id, powerBar.reasonText(id, r.reason));
  audio.playEvent({ type: 'platePress' });
  if (FEEDBACK[id]) flash(FEEDBACK[id](powerUp(id)));
  updateLives();
  powerBar.update();
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
  if (!defaultFeel()) return powerBar.message('hint', 'Hints need the default feel settings (Playtest tools → Reset tuning).');
  const level = game.level;
  powerBar.custom(`<h3>${POWER_ICONS.hint}Hint</h3><p>Thinking…</p>`, 4000);
  const table = await loadHints(level.id);
  await new Promise((r) => setTimeout(r, 20)); // let "Thinking…" show before the search
  if (game.level !== level || game.phase !== 'playing') return powerBar.disarm();
  if (!table) return powerBar.message('hint', "Hints couldn't be loaded. Check the connection and try again.");
  const h = findHint(table, game.sim);
  if (!h.dir) {
    return powerBar.message('hint', h.dead ? "From here this level can't be won any more. Restart to try again." : 'No hint from this position. Let the marbles settle, then try again.');
  }
  const r = powerups.activate('hint', puContext(), { hint: h });
  if (!r.ok) return powerBar.message('hint', powerBar.reasonText('hint', r.reason));
  powerBar.disarm();
  view.showHintArrow(h.dir, powerUp('hint').duration);
  flash(h.left === 1 ? 'Tilt the way the arrow points to finish.' : 'Tilt the way the arrow points, and hold until everything stops.', 3800);
  updateLives();
  powerBar.update();
}

// "Buy a life · 150" on the lives cards, or why it can't be bought.
function buyLifeButton(info) {
  if (info.lives >= info.max) return '';
  const price = ECONOMY.prices.life;
  const coins = player.coins();
  const short = coins < price;
  return `<button class="btn wide${short ? '' : ' primary'}" data-act="buyLife" data-spend type="button"${short ? ' disabled' : ''}>Buy a life <span class="cost">· ${price} ${COIN}</span></button>
    ${short ? `<p class="fine">You have ${coins} ${COIN}. Finish levels to earn more.</p>` : ''}`;
}

// The coins a win paid, on the Level complete card.
function rewardBlock(reward) {
  if (!reward) return '';
  if (!reward.total) {
    const left = player.remaining(game.level.id, game.index);
    return `<p class="fine">${left ? `Replays pay only for new stars: +${left} ${COIN} still to earn here.` : 'You have earned everything this level pays.'}</p>`;
  }
  const first = !player.seen('coins');
  if (first) player.markSeen('coins');
  return `<div class="reward"><span class="sum">+${reward.total} ${COIN}</span>
    <small>${reward.parts.map((p) => `${p.why} +${p.amount}`).join(' · ')}</small>
    ${first ? '<small>Gold coins buy lives, second chances and power-ups. Each level pays once, plus a bonus for 2 and 3 stars.</small>' : ''}</div>`;
}

function updateLives() {
  const info = player.lives();
  const coins = player.coins();
  $('coinsCount').textContent = coins;
  $('homeCoinsText').textContent = coins;
  $('homeCoins').setAttribute('aria-label', `${coins} gold coins`);
  $('livesCount').textContent = info.lives;
  $('homeLivesText').textContent = livesLine(info);
  $('homeLives').setAttribute('aria-label', `Lives: ${livesLine(info)}`);
  const timer = document.getElementById('livesTimer');
  if (timer) timer.textContent = info.nextIn === null ? 'Full' : `Next life in ${clockText(info.nextIn)}`;
  const atRisk = game.staked && game.phase === 'playing';
  $('restartBtn').innerHTML = atRisk ? `Restart <span class="cost">· −1 ${HEART}</span>` : 'Restart';
}
setInterval(updateLives, 500);

// While an ad runs, every button on the card is disabled so nothing can be pressed twice.
function lockCard(locked) {
  for (const b of $('card').querySelectorAll('button')) b.disabled = locked;
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
$('homeBtn').addEventListener('click', () => !game.adShowing && requestGiveUp('leave', showHome));
$('homeLives').addEventListener('click', () => openCard('lives'));
$('homeCoins').addEventListener('click', () => openCard('coins'));
$('settingsBtn').addEventListener('click', () => openCard('pause'));
$('restartBtn').addEventListener('click', () => {
  if (game.adShowing) return;
  audio.unlock();
  requestGiveUp('restart', retryLevel);
});
$('orbitLeft').addEventListener('click', () => view.orbit(-1));
$('orbitRight').addEventListener('click', () => view.orbit(1));
window.addEventListener('resize', () => view.resize());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && MENU_CARDS.has(game.card)) closeCard();
  else if (game.screen === 'home' && !game.card && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    play();
  } else if (game.screen === 'game' && e.code === 'KeyR' && !e.repeat && !game.adShowing && !MENU_CARDS.has(game.card)) {
    requestGiveUp('restart', retryLevel);
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
  play(game.index);
  game.timerRunning = true;
  game.autoplay = { steps: game.level.solution, i: 0, t: 0 };
  $('banner').textContent = 'Showing the reference solution';
  $('banner').hidden = false;
}

// ---------- HUD ----------

function updateClock() {
  const t = Math.max(0, game.timeLeft);
  $('time').textContent = t >= 10 ? Math.ceil(t) : t.toFixed(1);
  $('timeBar').style.transform = `scaleX(${game.times ? Math.min(1, t / game.times.limit) : 1})`;
  $('clock').classList.toggle('low', game.phase === 'playing' && game.timerRunning && t <= 5);
  $('timerNote').hidden = game.timerRunning || game.phase !== 'playing';
}

function renderChips() {
  $('chips').innerHTML = game.sim.marbles
    .map((m) => `<span class="chip-marble${m.delivered ? ' delivered' : ''}" style="--c:${colorCss(m.color)}" title="${m.color}${m.delivered ? ' (home)' : ''}"></span>`)
    .join('');
}

let hintTimer = null;
function showHint(text) {
  const el = $('hint');
  el.textContent = text;
  if (!settings.hints) {
    el.classList.add('gone');
    return;
  }
  el.classList.remove('gone');
  delete el.dataset.dismissing;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.add('gone'), 9000);
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

// ---------- Cards ----------

const STAR = (on) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z" fill="${on ? 'var(--gold)' : 'none'}" stroke="${on ? '#b8841c' : 'var(--maple-edge)'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const LOCK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';

// Cards opened from a menu pause the game; win and time-up cards don't need to.
const MENU_CARDS = new Set(['levels', 'settings', 'howto', 'tools', 'giveUp', 'lives', 'noLives', 'notice', 'coins', 'pause', 'powerIntro']);
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

function openCard(kind, data = {}) {
  game.card = kind;
  if (MENU_CARDS.has(kind)) game.paused = true;
  const card = $('card');
  card.innerHTML = CARDS[kind](data);
  $('scrim').hidden = false;
  card.setAttribute('aria-label', card.querySelector('h2')?.textContent || kind);
  for (const el of card.querySelectorAll('[data-act]')) el.addEventListener('click', () => ACTIONS[el.dataset.act](el));
  if (kind === 'settings' || kind === 'tools') wireSettings(card);
  // Never put the focus on something that spends coins, so Enter can't buy by accident.
  (card.querySelector('[data-focus]') || card.querySelector('.primary:not([data-spend])') || card.querySelector('[data-act]:not([data-spend])'))?.focus({ preventScroll: true });
}

function closeCard() {
  game.card = null;
  game.paused = false;
  $('scrim').hidden = true;
}

const isLast = () => game.index === LEVELS.length - 1;

const ACTIONS = {
  close: () => closeCard(),
  retry: () => {
    if (game.adShowing) return;
    retryLevel();
  },
  giveUp: () => {
    const go = pendingGiveUp;
    pendingGiveUp = null;
    closeCard();
    go?.();
  },
  // A break between levels: the only place an interstitial may show.
  next: async () => {
    if (game.adShowing) return;
    if (isLast()) return showHome();
    const level = game.index + 1;
    const opts = { afterRewarded: game.attempt.extraTimeUsed > 0 };
    if (ads.interstitialBlocker(level, opts) === null) {
      game.adShowing = true;
      lockCard(true);
      await ads.showInterstitialIfDue(level, opts);
      game.adShowing = false;
    } else {
      ads.showInterstitialIfDue(level, opts); // only starts loading one for a later break
    }
    play(game.index + 1);
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
    else openCard('fail', { adMessage: paid.reason === 'coins' ? `That needs ${sc.cost} coins and you have ${paid.coins}.` : null });
  },
  watchAd: async (el) => {
    if (game.adShowing || game.card !== 'fail') return;
    const attempt = game.attempt;
    game.adShowing = true;
    lockCard(true);
    el.textContent = 'Loading ad…';
    const result = await ads.watchForExtraTime(attempt);
    game.adShowing = false;
    if (game.card !== 'fail' || game.attempt !== attempt) return;
    if (result.granted) continueWithExtraTime(result.seconds);
    else openCard('fail', { adMessage: AD_MESSAGES[result.reason] || AD_MESSAGES.unavailable });
  },
  privacy: () => ads.showPrivacyOptions().catch(() => {}),
  home: () => {
    if (!game.adShowing) showHome();
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
  buyLife: (el) => {
    if (el.disabled) return;
    el.disabled = true;
    const r = player.buyLife();
    updateLives();
    if (r.ok) audio.playEvent({ type: 'deliver' });
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

const CARDS = {
  win: ({ stars, t, demo, reward }) => `
    <h2>${demo ? 'Reference solution' : 'Level complete'}</h2>
    <div class="stars" aria-label="${stars} of 3 stars">${[1, 2, 3].map((i) => STAR(i <= stars)).join('')}</div>
    <div class="result-time">${t.toFixed(1)} s</div>
    <div class="targets">3 stars under ${game.times.gold} s · 2 stars under ${game.times.par} s</div>
    ${rewardBlock(reward)}
    <div class="row">
      <button class="btn" data-act="retry" type="button">Play again</button>
      <button class="btn primary" data-act="next" type="button">${isLast() ? 'Home' : 'Next level'}</button>
    </div>`,
  fail: ({ adMessage } = {}) => {
    const home = game.sim.marbles.filter((m) => m.delivered).length;
    const offer = !adMessage && ads.canOfferExtraTime(game.attempt);
    return `
    <h2>Time's up</h2>
    <p>${home} of ${game.sim.marbles.length} marbles made it home.</p>
    ${secondChanceButton()}
    ${offer ? `<button class="btn wide" data-act="watchAd" type="button">Watch an ad for +${ads.config.rewardedExtraTime.seconds} s</button>` : ''}
    <p class="note" role="status">${adMessage || game.level.learn}</p>
    ${lossNote()}
    <div class="row">
      <button class="btn" data-act="home" type="button">Home</button>
      <button class="btn${canContinue() ? '' : ' primary'}" data-act="retry" type="button" data-focus>Try again</button>
    </div>`;
  },
  // Asked before restarting or leaving an attempt that would cost a life.
  giveUp: ({ kind }) => {
    const { lives } = player.lives();
    return `
    <h2>${kind === 'restart' ? 'Restart this level?' : 'Leave this level?'}</h2>
    <p>You've been playing for more than ${ECONOMY.lives.freeRestartSeconds} seconds, so giving up this attempt costs 1 life. You have ${lives}.</p>
    <div class="row">
      <button class="btn" data-act="close" type="button">Keep playing</button>
      <button class="btn primary" data-act="giveUp" type="button">${kind === 'restart' ? 'Restart' : 'Leave'} <span class="cost">· −1 ${HEART}</span></button>
    </div>`;
  },
  lives: () => {
    const info = player.lives();
    return `
    <div class="card-head"><h2>Lives</h2>
      <button class="close-btn" data-act="livesBack" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button></div>
    <div class="big-stat">${HEART}<span>${info.lives}/${info.max}</span></div>
    <p class="countdown" id="livesTimer">${info.nextIn === null ? 'Full' : `Next life in ${clockText(info.nextIn)}`}</p>
    <ul class="howto">
      <li>Losing a level costs 1 life. Completing one never does.</li>
      <li>Restarting within the first ${ECONOMY.lives.freeRestartSeconds} seconds is free.</li>
      <li>A life comes back every ${ECONOMY.lives.regenMinutes} minutes, up to ${info.max}, even with the game closed.</li>
      <li>Levels 1–${ECONOMY.lives.freeLevels} never cost a life.</li>
    </ul>
    ${buyLifeButton(info)}
    <button class="btn primary wide" data-act="livesBack" type="button">OK</button>`;
  },
  noLives: () => {
    const info = player.lives();
    return `
    <h2>Out of lives</h2>
    <div class="big-stat">${HEART}<span>${info.lives}/${info.max}</span></div>
    <p class="countdown" id="livesTimer">${info.nextIn === null ? 'Full' : `Next life in ${clockText(info.nextIn)}`}</p>
    <p>A life comes back every ${ECONOMY.lives.regenMinutes} minutes, even with the game closed. Levels 1–${ECONOMY.lives.freeLevels} are free to replay meanwhile.</p>
    ${buyLifeButton(info)}
    <div class="row"><button class="btn" data-act="livesBack" type="button">Wait</button></div>`;
  },
  coins: () => `
    <div class="card-head"><h2>Gold coins</h2>
      <button class="close-btn" data-act="close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button></div>
    <div class="big-stat">${COIN}<span>${player.coins()}</span></div>
    <ul class="howto">
      <li>Finishing a level for the first time pays coins: more for later levels.</li>
      <li>Reaching 2 stars and 3 stars on a level pays a bonus, once each.</li>
      <li>Spend them on lives (${ECONOMY.prices.life}), on a second chance when time runs out (${ECONOMY.secondChance.cost}), and on power-ups from level ${ECONOMY.powerUps.unlockLevel}.</li>
      <li>Gold coins are earned by playing. They can't be bought.</li>
    </ul>
    <button class="btn primary wide" data-act="close" type="button">OK</button>`,
  pause: () => `
    <h2>Paused</h2>
    <button class="btn primary wide" data-act="close" type="button">Resume</button>
    <div class="row">
      <button class="btn" data-act="settings" type="button">Settings</button>
      <button class="btn" data-act="pauseHome" type="button">Home</button>
    </div>`,
  powerIntro: () => `
    <h2>Power-ups</h2>
    <p>From here on, a row of power-ups sits under the machine. Each costs gold coins and can be used a limited number of times per attempt.</p>
    <ul class="pu-list">${powerups
      .list()
      .map((p) => `<li>${POWER_ICONS[p.id]}<span><b>${p.name}.</b> ${p.about}</span><span class="price">${p.cost}${COIN}</span></li>`)
      .join('')}</ul>
    <p class="fine">Tap a power-up to see what it does; tap it again to use it. Coins are only taken when it works.</p>
    <button class="btn primary wide" data-act="close" type="button">Got it</button>`,
  notice: ({ title, text }) => `
    <h2>${title}</h2>
    <p>${text}</p>
    <div class="row"><button class="btn primary" data-act="close" type="button">OK</button></div>`,
  levels: ({ from }) => {
    game.levelsFrom = from;
    const progress = loadProgress();
    return `
    <h2>Levels</h2>
    <p class="note">Finish a level to open the next one.</p>
    <div class="grid-levels">
      ${LEVELS.map((l, i) => {
        const p = progress[l.id];
        if (!isUnlocked(progress, i)) {
          return `<button type="button" disabled aria-label="Level ${i + 1}, locked">
            <span class="n">${i + 1}</span><span class="name">${l.name}</span><span class="lock">${LOCK} Locked</span></button>`;
        }
        const current = game.screen === 'game' && i === game.index;
        const left = player.remaining(l.id, i);
        return `<button type="button" data-act="pick" data-i="${i}" class="${current ? 'current' : ''}">
          <span class="n">${i + 1}</span><span class="name">${l.name}</span>
          <span class="got">${p ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '☆☆☆'}</span>
          ${left ? `<span class="earn" aria-label="${left} coins to earn">+${left} ${COIN}</span>` : ''}</button>`;
      }).join('')}
    </div>
    <div class="row"><button class="btn" data-act="levelsBack" type="button">Back</button></div>`;
  },
  // What players see: three big toggles and how to play. Playtest tools sit behind a
  // small link at the bottom.
  settings: () => `
    <div class="card-head"><h2>Settings</h2>
      <button class="close-btn" data-act="close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button></div>
    <div class="toggles">
      ${toggle('sound', 'Sound', ICONS.sound)}
      ${canVibrate ? toggle('vibration', 'Vibration', ICONS.vibration) : ''}
      ${toggle('hints', 'Hints', ICONS.hints)}
    </div>
    <button class="btn primary wide" data-act="howto" type="button">How to play</button>
    ${ads.privacyOptionsRequired ? '<p class="fine"><button class="linkish" data-act="privacy" type="button">Privacy choices for ads</button></p>' : ''}
    <p class="fine"><button class="linkish" data-act="tools" type="button">Playtest tools</button></p>`,
  howto: () => `
    <div class="card-head"><h2>How to play</h2>
      <button class="close-btn" data-act="settings" type="button" aria-label="Back to settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button></div>
    <ul class="howto">
      <li>Drag anywhere to tilt the machine. Marbles roll the way you drag.</li>
      <li>Let go and the machine levels out; marbles slow to a stop.</li>
      <li>A marble only rolls along its own groove.</li>
      <li>Get every marble into the ring of its colour before time runs out.</li>
      <li>A marble resting on a gold target holds the gate at the other end of its cable open. A goal with a metal band opens its gate once filled.</li>
    </ul>
    <button class="btn primary wide" data-act="close" type="button">Got it</button>`,
  // For the designer and playtest sessions, not for players.
  tools: () => {
    const rows = summariseLog();
    return `
    <div class="card-head"><h2>Playtest tools</h2>
      <button class="close-btn" data-act="settings" type="button" aria-label="Back to settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg></button></div>
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
      <span class="row"><button class="btn small" data-act="lifeMinus" type="button">−1</button>
      <button class="btn small" data-act="lifeSkip" type="button">Skip ${ECONOMY.lives.regenMinutes} min</button>
      <button class="btn small" data-act="lifeFill" type="button">Fill</button>
      <button class="btn small" data-act="resetEconomy" type="button">Reset</button></span></div>
    <div class="setting"><label>Gold coins<small>${player.coins()}</small></label>
      <span class="row"><button class="btn small" data-act="coinsPlus" type="button">+500</button></span></div>
    <div class="setting"><label>Ads<small>${adStatus()}</small></label></div>
    <div class="setting"><label>Progress<small>Locks every level but the first again, for the next tester</small></label>
      <span class="row"><button class="btn small" data-act="levels" type="button">Levels</button>
      <button class="btn small" data-act="resetProgress" type="button">Reset progress</button></span></div>
    <h3>Feel tuning</h3>
    ${slider('gravity', 'Marble speed (gravity)', PHYSICS.gravity, 12, 60, 1, PHYSICS)}
    ${slider('maxTiltDeg', 'Max tilt (degrees)', PHYSICS.maxTiltDeg, 10, 25, 1, PHYSICS)}
    ${slider('dragBraking', 'Brake when you let go', PHYSICS.dragBraking, 2, 12, 0.5, PHYSICS)}
    ${slider('tiltResponse', 'Tilt responsiveness', CONTROLS.tiltResponse, 10, 45, 1, CONTROLS)}
    ${slider('dragForFullTilt', 'Drag distance for full tilt', CONTROLS.dragForFullTilt, 0.08, 0.3, 0.01, CONTROLS)}
    <p class="note ${game.solutionOk ? 'ok' : 'bad'}" id="solutionNote">${solutionNote()}</p>
    <div class="row">
      <button class="btn small" data-act="solution" type="button">Watch the solution</button>
      <button class="btn small" data-act="resetTuning" type="button">Reset tuning</button>
    </div>
    <h3>Playtest log</h3>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Level</th><th>Tries</th><th>Won</th><th>Time up</th><th>Restarts</th><th>Best</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${r.n}. ${r.name}</td><td>${r.tries}</td><td>${r.won}</td><td>${r.timeUp}</td><td>${r.restarts}</td><td>${r.best ?? '–'}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="note">No attempts logged on this device yet.</p>'}
    <textarea id="logText" hidden rows="5" style="width:100%;font:12px monospace" aria-label="Playtest log as JSON"></textarea>
    <div class="row">
      <button class="btn small" data-act="copyLog" type="button">Copy log</button>
      <button class="btn small" data-act="clearLog" type="button">Clear log</button>
    </div>
    <div class="row"><button class="btn primary" data-act="close" type="button">Back to the game</button></div>`;
  },
};

const ICONS = {
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  vibration: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  hints: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8a6.7 6.7 0 0 0-3.9 12.2c.6.4.9 1 .9 1.7V17h6v-.3c0-.7.3-1.3.9-1.7A6.7 6.7 0 0 0 12 2.8z"/><path d="M9.5 19.5h5M10.5 21.7h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
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
    if (e.result === 'extra-time') continue;
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
  if (left.charged) {
    const level = LEVELS.find((l) => l.id === left.level);
    openCard('notice', { title: 'A life was used', text: `The game closed during ${level ? `level ${LEVELS.indexOf(level) + 1}, ${level.name}` : 'a level'}, so that attempt cost a life.` });
  }
}

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ index: game.index, screen: game.screen }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

// For automated checks and debugging in the browser console.
window.__mmr = { game, play, showHome, restart, LEVELS, view, ads, player, powerups, usePowerUp };
