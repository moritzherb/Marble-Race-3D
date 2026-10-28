// The power-up row at the bottom of a level, and the tag that names a power-up before it is
// bought. Tap a tile: the tag opens with its name, what it does and the price. Tap the same
// tile again, or Use, to buy it. A stray tap never spends coins, and the tiles sit outside
// the 3D canvas, so tilting the machine can't press them.

import { ECONOMY } from './economy.js';
import { ICONS } from './icons.js';

const REASONS = {
  coins: (p) => `Needs ${p.cost} ${ICONS.coin}`,
  used: () => 'Used up for this try',
  active: () => 'Already on',
  'not now': () => 'Only while playing',
  locked: () => `From level ${ECONOMY.powerUps.unlockLevel}`,
  saved: () => 'Saved',
};

export function createPowerBar({ bar, tag, powerups, player, context, use }) {
  let armed = null;
  let timer = null;
  let onCustomClick = null;
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
        (p) => `<button class="pu" data-pu="${p.id}" type="button" aria-label="${p.name}, ${p.cost} coins">
        ${ICONS[p.id] || ''}<span class="price">${ICONS.coin}${p.cost}</span><i class="meter"></i></button>`,
      )
      .join('');
    update();
  }

  function showTag(id, message) {
    const p = find(id);
    const reason = powerups.blocker(id, context());
    const blocked = reason && !message;
    tag.innerHTML = `
      <h3>${ICONS[id] || ''}${p.name}</h3>
      <p>${p.about}</p>
      ${message ? `<p class="why">${message}</p>` : reason ? `<p class="why">${reasonText(p, reason)}</p>` : ''}
      ${message ? '' : `<button class="gbtn wide" data-use="${id}" type="button"${blocked ? ' disabled' : ''}>Use <span class="cost">${ICONS.coin}${p.cost}</span></button>`}`;
    tag.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(disarm, message ? 2600 : 4500);
  }

  function arm(id) {
    armed = id;
    for (const b of bar.querySelectorAll('.pu')) b.classList.toggle('armed', b.dataset.pu === id);
    showTag(id);
  }

  function disarm() {
    armed = null;
    onCustomClick = null;
    clearTimeout(timer);
    tag.hidden = true;
    for (const b of bar.querySelectorAll('.pu')) b.classList.remove('armed');
  }

  // A short message about `id` in the tag (why it couldn't be used).
  function message(id, text) {
    armed = null;
    for (const b of bar.querySelectorAll('.pu')) b.classList.remove('armed');
    showTag(id, text);
  }

  // Custom tag content (the marble picker for Magnetic Pull).
  function custom(html, ms = 8000, onClick = null) {
    onCustomClick = onClick;
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
    if (onCustomClick) return onCustomClick(e);
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
