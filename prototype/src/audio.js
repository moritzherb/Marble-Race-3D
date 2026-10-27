// Small synthesised sounds: wood, glass and a rolling rumble. No audio files needed.
// Browsers only allow sound after a tap, so call unlock() from an input handler.

let ctx = null;
let master = null;
let noise = null;
let rollers = [];
let enabled = true;
const lastPlayed = {};

export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.8 : 0;
}

export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.8 : 0;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function throttle(key, seconds) {
  const now = ctx.currentTime;
  if (lastPlayed[key] && now - lastPlayed[key] < seconds) return true;
  lastPlayed[key] = now;
  return false;
}

function tone(freq, start, length, volume, type = 'sine') {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(volume, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + length + 0.02);
}

function thud(freq, length, volume) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, length + 0.05);
}

export function playEvent(e) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime;
  switch (e.type) {
    case 'deliver':
      thud(900, 0.08, 0.5);
      tone(784, t + 0.02, 0.35, 0.18);
      tone(1175, t + 0.1, 0.45, 0.14);
      break;
    case 'reject':
      if (throttle('reject', 0.35)) return;
      tone(150, t, 0.18, 0.22, 'triangle');
      break;
    case 'click':
      if (throttle('click', 0.05)) return;
      tone(2600, t, 0.05, Math.min(0.2, 0.05 * e.strength));
      tone(3700, t, 0.04, Math.min(0.12, 0.03 * e.strength));
      break;
    case 'bump':
      if (throttle('bump' + e.marble, 0.08)) return;
      thud(500, 0.07, Math.min(0.5, 0.12 * e.strength));
      break;
    case 'gateOpen':
    case 'gateClose':
      thud(e.type === 'gateOpen' ? 700 : 380, 0.14, 0.4);
      tone(e.type === 'gateOpen' ? 330 : 220, t, 0.12, 0.1, 'triangle');
      break;
    case 'platePress':
      thud(1200, 0.05, 0.3);
      break;
    case 'tick':
      thud(1600, 0.03, 0.35);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.4, 0.13));
      break;
    case 'fail':
      tone(220, t, 0.3, 0.15, 'triangle');
      tone(165, t + 0.18, 0.45, 0.15, 'triangle');
      break;
    default:
  }
}

// A rumble per marble, louder and brighter the faster it rolls.
export function updateRolling(speeds) {
  if (!ctx) return;
  while (rollers.length < speeds.length) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    rollers.push({ f, g });
  }
  rollers.forEach((r, i) => {
    const v = speeds[i] ?? 0;
    r.g.gain.setTargetAtTime(enabled ? Math.min(0.12, v * 0.035) : 0, ctx.currentTime, 0.05);
    r.f.frequency.setTargetAtTime(180 + v * 110, ctx.currentTime, 0.05);
  });
}
