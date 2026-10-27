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

  function fromDrag(dx, dy) {
    const amount = Math.min(1, Math.hypot(dx, dy) / (CONTROLS.dragForFullTilt * minSide()));
    if (amount < 0.04) return [0, 0];
    const [gx, gz] = screenToGround(dx, dy);
    const l = Math.hypot(gx, gz) || 1;
    let t = [(gx / l) * amount, (gz / l) * amount];
    if (CONTROLS.directionAssist) t = assistDirection(t);
    return t;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    surface.setPointerCapture?.(e.pointerId);
    onFirstTouch?.();
    onTilt([0, 0], true);
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    onTilt(fromDrag(e.clientX - drag.x, e.clientY - drag.y), true);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    onTilt([0, 0], false);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);

  // Keyboard: arrows or WASD, screen-relative like the drag. Two keys make a diagonal.
  function fromKeys() {
    let x = 0;
    let y = 0;
    for (const k of held) {
      x += KEYS[k][0];
      y += KEYS[k][1];
    }
    if (!x && !y) return null;
    const [gx, gz] = screenToGround(x, y);
    const l = Math.hypot(gx, gz) || 1;
    return assistDirection([gx / l, gz / l]);
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
