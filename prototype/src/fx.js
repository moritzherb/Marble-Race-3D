// Short visual feedback in place of text: an icon that pops up, a heart that breaks when a
// life is lost, coins that fly to the wallet, and numbers that count up.

import { ICONS } from './icons.js';

const layer = () => document.getElementById('fx');

// A big icon (and a short label like "+10s") that pops up and floats away.
export function pop(iconName, label = '', ms = 1300) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.innerHTML = `${ICONS[iconName] || ''}${label ? `<b class="ol">${label}</b>` : ''}`;
  layer().append(el);
  setTimeout(() => el.remove(), ms);
}

// A heart cracks in two and falls, with "−1": a life is gone. Resolves when it's done.
export function heartBreak() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'broken go';
    el.innerHTML = `<div class="half l">${ICONS.heart}</div><div class="half r">${ICONS.heart}</div><b class="minus ol">−1</b>`;
    layer().append(el);
    setTimeout(() => {
      el.remove();
      resolve();
    }, 1250);
  });
}

// `n` coins fly from one element to another.
export function flyCoins(from, to, n = 8) {
  if (!from || !to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = ICONS.coin;
    const x = a.left + a.width / 2 - 17 + (Math.random() - 0.5) * a.width * 0.6;
    const y = a.top + a.height / 2 - 17 + (Math.random() - 0.5) * a.height * 0.5;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transitionDelay = `${i * 55}ms`;
    layer().append(el);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transform = `translate(${b.left + b.width / 2 - 17 - x}px, ${b.top + b.height / 2 - 17 - y}px) scale(0.6)`;
        el.style.opacity = '0.2';
      }),
    );
    setTimeout(() => el.remove(), 800 + i * 55);
  }
}

// Count a number up (or down) in an element's text, e.g. "+30" to "+90".
export function countUp(el, from, to, ms = 700, format = (v) => String(v)) {
  if (!el) return;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    el.textContent = format(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
