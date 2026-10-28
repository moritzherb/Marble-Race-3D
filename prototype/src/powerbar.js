// The power-up row at the bottom of a level, and the tag that explains a power-up before it
// is bought. Tap a token: the tag opens with its name, effect and price. Tap the same token
// again, or Use, to buy it. A stray tap never spends coins, and the tokens sit outside the
// 3D canvas, so tilting the machine can't press them.

import { ECONOMY } from './economy.js';

const svg = (body, extra = '') => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

export const POWER_ICONS = {
  time: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4.2l2.8 1.7M9.5 2.8h5M12 2.8v3.2M18.6 6.4l1.4-1.4"/>'),
  speed: svg('<path d="M4.5 6l6 6-6 6M12.5 6l6 6-6 6"/>'),
  hint: svg('<path d="M12 2.8a6.7 6.7 0 0 0-3.9 12.2c.6.4.9 1 .9 1.7V17h6v-.3c0-.7.3-1.3.9-1.7A6.7 6.7 0 0 0 12 2.8z" fill="currentColor" stroke="none"/><path d="M9.5 19.5h5M10.5 21.7h3"/>'),
  gates: svg('<path d="M5 21V9M19 21V9"/><rect x="3.5" y="3.5" width="17" height="3.2" rx="1.2" fill="currentColor" stroke="none"/><path d="M12 19.5v-7.5M9 14.8l3-3 3 3"/>'),
  magnet: svg('<path d="M5.5 3.5h4v8.2a2.5 2.5 0 0 0 5 0V3.5h4v8.2a6.5 6.5 0 0 1-13 0z" fill="currentColor" stroke="none"/><path d="M5.5 3.5h4v3h-4zM14.5 3.5h4v3h-4z" fill="#e0533b" stroke="none"/>'),
  checkpoint: svg('<path d="M6 21.5V3.5"/><path d="M6 4h11.5l-2.6 4 2.6 4H6" fill="currentColor"/>'),
};

const REASONS = {
  coins: (p, coins) => `That needs ${p.cost} coins and you have ${coins}.`,
  used: (p) => (p.perAttempt > 1 ? `All ${p.perAttempt} used in this attempt.` : 'Already used in this attempt.'),
  active: () => 'Already running.',
  'not now': () => 'Only while a level is being played.',
  locked: () => `Unlocks at level ${ECONOMY.powerUps.unlockLevel}.`,
};

export function createPowerBar({ bar, tag, powerups, player, context, use, coinIcon }) {
  let armed = null;
  let timer = null;
  const list = () => powerups.list();
  const find = (id) => list().find((p) => p.id === id);

  function reasonText(p, reason) {
    const f = REASONS[reason];
    return f ? f(p, player.coins()) : reason;
  }

  function render(levelIndex) {
    disarm();
    const locked = levelIndex + 1 < ECONOMY.powerUps.unlockLevel;
    bar.hidden = locked;
    document.body.classList.toggle('with-powers', !locked);
    bar.innerHTML = list()
      .map(
        (p) => `<button class="token pu" data-pu="${p.id}" type="button" aria-label="${p.name}, ${p.cost} coins">
        ${POWER_ICONS[p.id] || ''}<span class="price">${p.cost}${coinIcon}</span><i class="meter"></i></button>`,
      )
      .join('');
    update();
  }

  function showTag(id, message) {
    const p = find(id);
    const reason = powerups.blocker(id, context());
    const blocked = reason && !message;
    tag.innerHTML = `
      <h3>${POWER_ICONS[id] || ''}${p.name}</h3>
      <p>${p.about}</p>
      ${message ? `<p class="why">${message}</p>` : reason ? `<p class="why">${reasonText(p, reason)}</p>` : ''}
      ${message ? '' : `<button class="btn${blocked ? '' : ' primary'}" data-use="${id}" type="button"${blocked ? ' disabled' : ''}>Use <span class="cost">· ${p.cost} ${coinIcon}</span></button>`}`;
    tag.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(disarm, message ? 3200 : 4500);
  }

  function arm(id) {
    armed = id;
    for (const b of bar.querySelectorAll('.pu')) b.classList.toggle('armed', b.dataset.pu === id);
    showTag(id);
  }

  function disarm() {
    armed = null;
    clearTimeout(timer);
    tag.hidden = true;
    for (const b of bar.querySelectorAll('.pu')) b.classList.remove('armed');
  }

  // A message about `id` in the tag (why it couldn't be used, or what happened).
  function message(id, text) {
    armed = null;
    for (const b of bar.querySelectorAll('.pu')) b.classList.remove('armed');
    showTag(id, text);
  }

  // Custom tag content (the marble picker for Magnetic Pull).
  function custom(html, ms = 8000) {
    tag.innerHTML = html;
    tag.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(disarm, ms);
  }

  function update() {
    if (bar.hidden) return;
    const ctx = context();
    for (const b of bar.querySelectorAll('.pu')) {
      const id = b.dataset.pu;
      const p = find(id);
      const reason = powerups.blocker(id, ctx);
      const effect = powerups.effect(id);
      b.classList.toggle('short', reason === 'coins');
      b.classList.toggle('used', reason === 'used');
      b.classList.toggle('active', Boolean(effect) || reason === 'saved');
      b.style.setProperty('--p', effect?.total ? Math.max(0, effect.left / effect.total).toFixed(3) : 0);
      const left = Number.isFinite(p.perAttempt) && p.perAttempt > 1 ? p.perAttempt - powerups.uses(id) : null;
      let badge = b.querySelector('.badge');
      if (left !== null && left > 0 && left < p.perAttempt) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'badge';
          b.append(badge);
        }
        badge.textContent = left;
      } else badge?.remove();
    }
  }

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.pu');
    if (!b) return;
    const id = b.dataset.pu;
    if (armed === id) {
      disarm();
      use(id);
    } else arm(id);
  });
  tag.addEventListener('click', (e) => {
    const b = e.target.closest('[data-use]');
    if (!b || b.disabled) return;
    const id = b.dataset.use;
    disarm();
    use(id);
  });
  // Any tap elsewhere closes the tag (and a drag on the machine starts as usual).
  document.addEventListener('pointerdown', (e) => {
    if (!tag.hidden && !tag.contains(e.target) && !bar.contains(e.target)) disarm();
  });

  return { render, update, disarm, message, custom, reasonText: (id, reason) => reasonText(find(id), reason) };
}
