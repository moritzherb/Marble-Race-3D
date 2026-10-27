// Drag (touch or mouse) and keyboard input, turned into a tilt target.

import { CONTROLS } from './config.js';
import { assistDirection } from './tilt.js';

const KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

// onTilt(target, holding) is called whenever the wanted tilt changes.
// screenToGround(dx, dy) converts a screen drag into a ground direction.
export function attachInput(surface, { screenToGround, onTilt, onFirstTouch }) {
  let drag = null;
  const held = new Set();

  const minSide = () => Math.min(window.innerWidth, window.innerHeight);

  let lastTarget = null;

  // The drag works like a floating joystick: once your finger passes the full-tilt
  // distance, the anchor follows it, so reversing direction responds straight away.
  function fromDrag(x, y) {
    const full = CONTROLS.dragForFullTilt * minSide();
    let dx = x - drag.x;
    let dy = y - drag.y;
    const dist = Math.hypot(dx, dy);
    if (dist > full) {
      drag.x += dx * (1 - full / dist);
      drag.y += dy * (1 - full / dist);
      dx = x - drag.x;
      dy = y - drag.y;
    }
    const amount = Math.min(1, Math.hypot(dx, dy) / full);
    if (amount < 0.04) return [0, 0];
    const [gx, gz] = screenToGround(dx, dy);
    const l = Math.hypot(gx, gz) || 1;
    let t = [(gx / l) * amount, (gz / l) * amount];
    if (CONTROLS.directionAssist) t = assistDirection(t, lastTarget);
    lastTarget = t;
    return t;
  }

  // On iPhone a long press starts text selection (the magnifier bubble) or a callout
  // menu unless the touch itself is cancelled. Pointer events still arrive.
  for (const type of ['touchstart', 'touchmove', 'touchend']) {
    surface.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  surface.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    lastTarget = null;
    surface.setPointerCapture?.(e.pointerId);
    onFirstTouch?.();
    onTilt([0, 0], true);
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    onTilt(fromDrag(e.clientX, e.clientY), true);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    onTilt([0, 0], false);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);

  // Keyboard: arrows or WASD. Each key tilts along the groove direction closest to its
  // screen direction, so two keys always make an exact diagonal, whatever the camera angle.
  function fromKeys() {
    let x = 0;
    let z = 0;
    for (const k of held) {
      const [gx, gz] = screenToGround(KEYS[k][0], KEYS[k][1]);
      if (Math.abs(gx) >= Math.abs(gz)) x += Math.sign(gx);
      else z += Math.sign(gz);
    }
    if (!x && !z) return null;
    const l = Math.hypot(x, z);
    return [x / l, z / l];
  }
  window.addEventListener('keydown', (e) => {
    if (!KEYS[e.code] || e.repeat) return;
    held.add(e.code);
    onFirstTouch?.();
    onTilt(fromKeys(), true);
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (!KEYS[e.code]) return;
    held.delete(e.code);
    const t = fromKeys();
    onTilt(t || [0, 0], Boolean(t));
  });
  window.addEventListener('blur', () => {
    held.clear();
    drag = null;
    onTilt([0, 0], false);
  });
}
