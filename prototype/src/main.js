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
import { loadSettings, saveSettings, loadProgress, recordResult, resetProgress, loadLog, appendLog, clearLog } from './store.js';

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
  card: null,
};

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
}

function restart(logIt = true) {
  if (logIt && game.screen === 'game' && game.phase === 'playing' && !game.autoplay && (game.elapsed > 0.3 || game.tilts > 0)) logAttempt('restarted');
  game.sim = createSim(game.track);
  game.tilt = createTilt();
  game.phase = 'playing';
  game.timeLeft = game.times.limit;
  game.elapsed = 0;
  game.tilts = 0;
  game.acc = 0;
  game.timerRunning = settings.timerStart === 'appear';
  game.autoplay = null;
  $('banner').hidden = true;
  renderChips();
  updateClock();
  view.sync(game.sim, game.tilt.current, 0);
}

function win() {
  game.phase = 'won';
  releaseTilt();
  const t = game.elapsed;
  const stars = t <= game.times.gold ? 3 : t <= game.times.par ? 2 : 1;
  const demo = Boolean(game.autoplay);
  if (!demo) {
    recordResult(game.level.id, stars, t);
    logAttempt('won', stars);
  }
  audio.playEvent({ type: 'win' });
  const attempt = game.sim;
  setTimeout(() => {
    if (game.phase === 'won' && game.sim === attempt) openCard('win', { stars, t, demo });
  }, 450);
}

function fail() {
  game.phase = 'failed';
  game.timeLeft = 0;
  releaseTilt();
  if (!game.autoplay) logAttempt('time-up');
  audio.playEvent({ type: 'fail' });
  openCard('fail');
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
$('homeLevels').addEventListener('click', () => openCard('levels'));
$('homeSettings').addEventListener('click', () => openCard('settings'));
$('homeBtn').addEventListener('click', () => showHome());
$('settingsBtn').addEventListener('click', () => openCard('settings'));
$('restartBtn').addEventListener('click', () => {
  audio.unlock();
  closeCard();
  restart();
});
$('orbitLeft').addEventListener('click', () => view.orbit(-1));
$('orbitRight').addEventListener('click', () => view.orbit(1));
window.addEventListener('resize', () => view.resize());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && (game.card === 'levels' || game.card === 'settings')) closeCard();
  else if (game.screen === 'home' && !game.card && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    play();
  } else if (game.screen === 'game' && e.code === 'KeyR' && !e.repeat) {
    closeCard();
    restart();
  } else if ((e.code === 'KeyN' || e.code === 'Enter') && game.card === 'win') {
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
      navigator.vibrate?.(18);
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
  $('timeBar').style.transform = `scaleX(${game.times ? t / game.times.limit : 1})`;
  $('clock').classList.toggle('low', game.phase === 'playing' && game.timerRunning && t <= 5);
  $('timerNote').hidden = game.timerRunning || game.phase !== 'playing';
}

function renderChips() {
  $('chips').innerHTML = game.sim.marbles
    .map((m) => `<span class="chip-marble${m.delivered ? ' home' : ''}" style="--c:${colorCss(m.color)}" title="${m.color}${m.delivered ? ' (home)' : ''}"></span>`)
    .join('');
}

let hintTimer = null;
function showHint(text) {
  const el = $('hint');
  el.textContent = text;
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

function openCard(kind, data = {}) {
  game.card = kind;
  if (kind === 'levels' || kind === 'settings') game.paused = true;
  const card = $('card');
  card.innerHTML = CARDS[kind](data);
  $('scrim').hidden = false;
  card.setAttribute('aria-label', card.querySelector('h2')?.textContent || kind);
  for (const el of card.querySelectorAll('[data-act]')) el.addEventListener('click', () => ACTIONS[el.dataset.act](el));
  if (kind === 'settings') wireSettings(card);
  (card.querySelector('.primary') || card.querySelector('[data-act]'))?.focus({ preventScroll: true });
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
    closeCard();
    restart(false);
  },
  next: () => (isLast() ? showHome() : play(game.index + 1)),
  home: () => showHome(),
  pick: (el) => play(Number(el.dataset.i)),
  solution: () => watchSolution(),
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
    openCard('settings');
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
    openCard('settings');
  },
};

const CARDS = {
  win: ({ stars, t, demo }) => `
    <h2>${demo ? 'Reference solution' : 'Level complete'}</h2>
    <div class="stars" aria-label="${stars} of 3 stars">${[1, 2, 3].map((i) => STAR(i <= stars)).join('')}</div>
    <div class="result-time">${t.toFixed(1)} s</div>
    <div class="targets">3 stars under ${game.times.gold} s · 2 stars under ${game.times.par} s</div>
    <div class="row">
      <button class="btn" data-act="retry" type="button">Play again</button>
      <button class="btn primary" data-act="next" type="button">${isLast() ? 'Home' : 'Next level'}</button>
    </div>`,
  fail: () => {
    const home = game.sim.marbles.filter((m) => m.delivered).length;
    return `
    <h2>Time's up</h2>
    <p>${home} of ${game.sim.marbles.length} marbles made it home.</p>
    <p class="note">${game.level.learn}</p>
    <div class="row">
      <button class="btn" data-act="home" type="button">Home</button>
      <button class="btn primary" data-act="retry" type="button">Try again</button>
    </div>`;
  },
  levels: () => {
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
        return `<button type="button" data-act="pick" data-i="${i}" class="${current ? 'current' : ''}">
          <span class="n">${i + 1}</span><span class="name">${l.name}</span>
          <span class="got">${p ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '☆☆☆'}</span></button>`;
      }).join('')}
    </div>
    <div class="row"><button class="btn" data-act="close" type="button">Back</button></div>`;
  },
  settings: () => {
    const rows = summariseLog();
    return `
    <h2>Settings</h2>
    <h3>How to play</h3>
    <ul class="howto">
      <li>Drag anywhere to tilt the machine. Marbles roll the way you drag.</li>
      <li>Let go and the machine levels out; marbles slow to a stop.</li>
      <li>A marble only rolls along its own groove.</li>
      <li>Get every marble into the ring of its colour before time runs out.</li>
      <li>A marble resting on a metal plate holds the gate at the other end of its cable open. A goal with a metal band opens its gate once filled.</li>
    </ul>
    <h3>Playtest options</h3>
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
    <div class="setting"><label>Sound</label>
      <span class="seg" role="group" aria-label="Sound">
        <button type="button" data-set="sound" data-v="true" aria-pressed="${settings.sound}">On</button>
        <button type="button" data-set="sound" data-v="false" aria-pressed="${!settings.sound}">Off</button>
      </span></div>
    <div class="setting"><label>Progress<small>Locks every level but the first again, for the next tester</small></label>
      <button class="btn small" data-act="resetProgress" type="button">Reset progress</button></div>
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
    <div class="row"><button class="btn primary" data-act="close" type="button">Back</button></div>`;
  },
};

function slider(key, label, value, min, max, step, target) {
  const owner = target === PHYSICS ? 'physics' : 'controls';
  return `<div class="slider"><div class="lab"><span>${label}</span><span id="val-${key}">${value}</span></div>
    <input type="range" id="tune-${key}" data-owner="${owner}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function solutionNote() {
  return game.solutionOk
    ? `Reference solution works with these settings (${game.solutionTime.toFixed(1)} s). Timer: ${game.times.limit} s.`
    : 'With these settings the reference solution no longer solves this level. Timers fall back to defaults.';
}

function wireSettings(card) {
  for (const b of card.querySelectorAll('[data-set]')) {
    b.addEventListener('click', () => {
      const key = b.dataset.set;
      settings[key] = key === 'timerStart' ? b.dataset.v : b.dataset.v === 'true';
      saveSettings(settings);
      CONTROLS.directionAssist = settings.directionAssist;
      audio.setSoundEnabled(settings.sound);
      for (const sib of card.querySelectorAll(`[data-set="${key}"]`)) sib.setAttribute('aria-pressed', String(sib === b));
      if (key === 'timerStart') restart(false);
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
  if (data.screen === 'game' && typeof data.index === 'number' && isUnlocked(loadProgress(), data.index)) {
    play(data.index);
  } else {
    showHome();
  }
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });
}

const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ index: game.index, screen: game.screen }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

// For automated checks and debugging in the browser console.
window.__mmr = { game, play, showHome, restart, LEVELS };
