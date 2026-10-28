// The game's icons: glossy, colourful SVGs drawn to match each other (coins, hearts, stars,
// the power-ups and the buttons). Colours come from gradients defined once per page by
// installIconDefs(), so every copy of an icon shares them.

const star = (cx, cy, R, r) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + k * Math.cos(a)).toFixed(2)} ${(cy + k * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
};

const grad = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;

const DEFS = [
  grad('mm-gold', [[0, '#fff08a'], [0.45, '#ffc93a'], [1, '#f39a0c']]),
  grad('mm-gold-in', [[0, '#f6a91a'], [1, '#ffd650']]),
  grad('mm-red', [[0, '#ff8a76'], [0.5, '#f0392b'], [1, '#c01b12']]),
  grad('mm-blue', [[0, '#7fd8ff'], [0.5, '#2f93f2'], [1, '#1a5ccc']]),
  grad('mm-purple', [[0, '#c59cff'], [0.5, '#8650f0'], [1, '#5a2bc0']]),
  grad('mm-green', [[0, '#a8f56a'], [0.5, '#4fc922'], [1, '#2b9512']]),
  grad('mm-orange', [[0, '#ffc66e'], [0.5, '#ff8d22'], [1, '#e15c00']]),
  grad('mm-silver', [[0, '#ffffff'], [0.5, '#d5dde8'], [1, '#93a2b8']]),
  grad('mm-glass', [[0, '#f2fdff'], [1, '#9fe3ff']]),
  grad('mm-sand', [[0, '#ffe680'], [1, '#f3a91f']]),
  grad('mm-bulb', [[0, '#fffbd1'], [0.55, '#ffe45c'], [1, '#ffb81c']]),
  grad('mm-bolt', [[0, '#fff58a'], [0.5, '#ffd21f'], [1, '#ff9a0a']]),
  grad('mm-teal', [[0, '#7ff0e6'], [0.5, '#22bdb3'], [1, '#128a86']]),
  grad('mm-flame', [[0, '#ffe066'], [0.45, '#ff9a1f'], [1, '#e8341c']]),
  grad('mm-pink', [[0, '#ff9ccf'], [1, '#e8338f']]),
];

// Add the shared gradients to the page (once).
export function installIconDefs(doc = document) {
  if (doc.getElementById('mm-icon-defs')) return;
  const holder = doc.createElement('div');
  holder.innerHTML = `<svg id="mm-icon-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${DEFS.join('')}</defs></svg>`;
  doc.body.prepend(holder.firstChild);
}

const svg = (body, cls = '', box = '0 0 48 48') => `<svg class="gi ${cls}" viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;
const gloss = (cx, cy, rx, ry, rot = -30, o = 0.75) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${o}"/>`;

const COIN_BODY = `
  <circle cx="24" cy="26.5" r="19.5" fill="#c47a08" stroke="#6e3f04" stroke-width="2.6"/>
  <circle cx="24" cy="23" r="19.5" fill="url(#mm-gold)" stroke="#6e3f04" stroke-width="2.6"/>
  <circle cx="24" cy="23" r="14" fill="url(#mm-gold-in)" stroke="#e29a12" stroke-width="1.6"/>
  <path d="${star(24, 23.6, 9.6, 4.3)}" fill="url(#mm-gold)" stroke="#c9810b" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M10.5 17.5a15 15 0 0 1 11-9.6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;

const HEART_PATH = 'M24 42C19.5 38.3 4.5 29 4.5 16.8 4.5 10.3 9.4 5.6 15.3 5.6c4 0 7 2.2 8.7 5.5 1.7-3.3 4.7-5.5 8.7-5.5 5.9 0 10.8 4.7 10.8 11.2C43.5 29 28.5 38.3 24 42Z';

export const ICONS = {
  coin: svg(COIN_BODY, 'coin'),
  heart: svg(`<path d="${HEART_PATH}" fill="url(#mm-red)" stroke="#7a0e08" stroke-width="2.6" stroke-linejoin="round"/>${gloss(14.5, 14, 5.2, 3.3, -40)}`, 'heart'),
  heartEmpty: svg(`<path d="${HEART_PATH}" fill="#2a5d60" fill-opacity=".55" stroke="#174648" stroke-width="2.6" stroke-linejoin="round"/>`, 'heart'),
  star: svg(`<path d="${star(24, 25.5, 21, 10)}" fill="url(#mm-gold)" stroke="#9a5300" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="${star(24, 25.5, 13, 6.2)}" fill="#ffe46a" opacity=".55"/>${gloss(17, 17, 4, 2.2, -35, 0.85)}`, 'star'),
  starEmpty: svg(`<path d="${star(24, 25.5, 21, 10)}" fill="#174b4e" fill-opacity=".5" stroke="#123c3e" stroke-opacity=".7" stroke-width="2.8" stroke-linejoin="round"/>`, 'star empty'),

  // ---------- Power-ups ----------
  time: svg(`
    <rect x="8.5" y="9" width="4" height="30" rx="2" fill="url(#mm-purple)" stroke="#341478" stroke-width="2.2"/>
    <rect x="35.5" y="9" width="4" height="30" rx="2" fill="url(#mm-purple)" stroke="#341478" stroke-width="2.2"/>
    <path d="M14 10.5h20c0 8.5-7.5 10-7.5 13.5S34 29 34 37.5H14c0-8.5 7.5-10 7.5-13.5S14 19 14 10.5Z" fill="url(#mm-glass)" stroke="#341478" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M17.2 13.5h13.6c-1 4.5-5 6.4-6.8 8.6-1.8-2.2-5.8-4.1-6.8-8.6Z" fill="url(#mm-sand)"/>
    <path d="M24 22v8" stroke="#f3a91f" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M15.8 35.5c1.2-3.6 4.6-5.8 8.2-6.2 3.6.4 7 2.6 8.2 6.2Z" fill="url(#mm-sand)"/>
    <path d="M17 12.8c.5 3 2.2 4.6 3.6 5.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>
    <rect x="7" y="4" width="34" height="7.5" rx="3.75" fill="url(#mm-purple)" stroke="#341478" stroke-width="2.4"/>
    <rect x="7" y="36.5" width="34" height="7.5" rx="3.75" fill="url(#mm-purple)" stroke="#341478" stroke-width="2.4"/>
    <path d="M11 6.6h13" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>`),
  speed: svg(`
    <path d="M5 17h9M3 24h8M6 31h7" stroke="#2f93f2" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 3 13.5 26.5H24L20 45 40 19.5H29.2L34.5 3Z" fill="url(#mm-bolt)" stroke="#8a4300" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M29.5 6.5 19 22" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`),
  hint: svg(`
    <path d="M24 1.5v3M9 7.5l2.2 2.2M39 7.5l-2.2 2.2M3.5 21h3M41.5 21h3" stroke="#ffb81c" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M24 7C15.7 7 10 13 10 20.3c0 5.2 2.6 8.2 5.3 10.8 1.8 1.7 2.7 3.6 2.7 5.4h12c0-1.8.9-3.7 2.7-5.4 2.7-2.6 5.3-5.6 5.3-10.8C38 13 32.3 7 24 7Z" fill="url(#mm-bulb)" stroke="#8a5600" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M19.5 27l2.2-5 2.3 4 2.3-4 2.2 5" fill="none" stroke="#e57a00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="17" y="36" width="14" height="4.4" rx="2" fill="url(#mm-silver)" stroke="#45526a" stroke-width="2"/>
    <rect x="18" y="40" width="12" height="4.2" rx="2" fill="url(#mm-silver)" stroke="#45526a" stroke-width="2"/>
    ${gloss(17.5, 15, 3.4, 5.2, 30, 0.9)}`),
  gates: svg(`
    <g transform="rotate(-40 24 24)">
      <g fill="#6e3f04" stroke="#6e3f04" stroke-width="5" stroke-linejoin="round">
        <circle cx="12" cy="24" r="8.5"/><rect x="18" y="21" width="27" height="6" rx="2"/><rect x="33" y="25" width="4.5" height="7.5" rx="1"/><rect x="39.5" y="25" width="4.5" height="9.5" rx="1"/>
      </g>
      <g fill="url(#mm-gold)">
        <circle cx="12" cy="24" r="8.5"/><rect x="18" y="21" width="27" height="6" rx="2"/><rect x="33" y="25" width="4.5" height="7.5" rx="1"/><rect x="39.5" y="25" width="4.5" height="9.5" rx="1"/>
      </g>
      <circle cx="12" cy="24" r="3.6" fill="#fff6e6" stroke="#6e3f04" stroke-width="2"/>
      <path d="M21 23h20" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>
      <path d="M6.5 20a7 7 0 0 1 6-4.3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>
    </g>
    <path d="${star(40, 9, 5, 2.2)}" fill="#fff" stroke="#ffcf3a" stroke-width="1.2" stroke-linejoin="round"/>`),
  magnet: svg(`
    <path d="M9 4.5Q13 1 17 4.5M31 4.5Q35 1 39 4.5" fill="none" stroke="#2f93f2" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M7 9h12v16a5 5 0 0 0 10 0V9h12v16.5a17 17 0 0 1-34 0Z" fill="url(#mm-red)" stroke="#7a0e08" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M7 9h12v8H7ZM29 9h12v8H29Z" fill="url(#mm-silver)" stroke="#7a0e08" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M10.5 21v4.5a13.5 13.5 0 0 0 6 11.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
    <path d="M9.5 11.5h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
  checkpoint: svg(`
    <ellipse cx="13" cy="43.5" rx="8" ry="2.6" fill="#000" opacity=".18"/>
    <rect x="10.5" y="6" width="5" height="38" rx="2.5" fill="url(#mm-silver)" stroke="#3a3f55" stroke-width="2.2"/>
    <path d="M15.5 8.5C23 4 29 12.5 41.5 8v18.5C29 31 23 22.5 15.5 27Z" fill="url(#mm-green)" stroke="#1d5e0a" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="${star(28, 17.5, 5.6, 2.5)}" fill="#fff" stroke="#1d5e0a" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="13" cy="5.5" r="4" fill="url(#mm-gold)" stroke="#6e3f04" stroke-width="2"/>`),

  // ---------- Buttons ----------
  gear: svg(`
    <path d="M20.6 3.5h6.8l1 5.1a15.6 15.6 0 0 1 3.9 2.3l5-1.7 3.4 5.9-3.9 3.4a15.8 15.8 0 0 1 0 4.5l3.9 3.4-3.4 5.9-5-1.7a15.6 15.6 0 0 1-3.9 2.3l-1 5.1h-6.8l-1-5.1a15.6 15.6 0 0 1-3.9-2.3l-5 1.7-3.4-5.9 3.9-3.4a15.8 15.8 0 0 1 0-4.5L6.3 15.1l3.4-5.9 5 1.7a15.6 15.6 0 0 1 3.9-2.3Z" transform="translate(0 2.5)" fill="url(#mm-silver)" stroke="#23305a" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="24" cy="25" r="6.5" fill="#3550c8" stroke="#23305a" stroke-width="2.6"/>
    <path d="M12.5 16.5a14 14 0 0 1 6-5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`),
  profile: svg(`
    <circle cx="24" cy="25" r="18" fill="url(#mm-blue)" stroke="#0e3a85" stroke-width="2.6"/>
    <ellipse cx="18" cy="22" rx="3.6" ry="4.6" fill="#fff"/><ellipse cx="30" cy="22" rx="3.6" ry="4.6" fill="#fff"/>
    <circle cx="18.8" cy="23" r="2.1" fill="#16213d"/><circle cx="30.8" cy="23" r="2.1" fill="#16213d"/>
    <path d="M18 31q6 5.5 12 0" fill="none" stroke="#16213d" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="13.5" cy="29.5" r="2.6" fill="#ff7aa8" opacity=".6"/><circle cx="34.5" cy="29.5" r="2.6" fill="#ff7aa8" opacity=".6"/>
    ${gloss(15, 13.5, 5.5, 3, -35, 0.85)}`),
  levels: svg(`
    <rect x="4" y="4" width="18.5" height="18.5" rx="5" fill="url(#mm-green)" stroke="#1d5e0a" stroke-width="2.4"/>
    <rect x="25.5" y="4" width="18.5" height="18.5" rx="5" fill="url(#mm-orange)" stroke="#8a3600" stroke-width="2.4"/>
    <rect x="4" y="25.5" width="18.5" height="18.5" rx="5" fill="url(#mm-blue)" stroke="#0e3a85" stroke-width="2.4"/>
    <rect x="25.5" y="25.5" width="18.5" height="18.5" rx="5" fill="url(#mm-purple)" stroke="#341478" stroke-width="2.4"/>
    <path d="${star(13.25, 13.8, 6, 2.7)}" fill="#fff" stroke="#1d5e0a" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="${star(34.75, 13.8, 6, 2.7)}" fill="#fff" stroke="#8a3600" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="${star(13.25, 35.3, 6, 2.7)}" fill="#fff" stroke="#0e3a85" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="31.5" y="33" width="6.5" height="6" rx="1.2" fill="#fff"/><path d="M32.8 33v-1.8a1.95 1.95 0 0 1 3.9 0V33" fill="none" stroke="#fff" stroke-width="1.8"/>`),
  play: svg('<path d="M15 9.5v29a2.5 2.5 0 0 0 3.8 2.1l23-14.5a2.5 2.5 0 0 0 0-4.2l-23-14.5A2.5 2.5 0 0 0 15 9.5Z" fill="#fff" stroke="#1c6a06" stroke-width="3" stroke-linejoin="round"/>'),
  pause: svg('<rect x="12" y="9" width="9" height="30" rx="3.5" fill="#fff" stroke="#23305a" stroke-width="2.6"/><rect x="27" y="9" width="9" height="30" rx="3.5" fill="#fff" stroke="#23305a" stroke-width="2.6"/>'),
  home: svg(`
    <path d="M10 22v19a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V22" fill="#fff6e6" stroke="#5a3410" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="19.5" y="29" width="9" height="14" rx="2" fill="url(#mm-blue)" stroke="#5a3410" stroke-width="2.4"/>
    <path d="M4.5 23.5 24 6l19.5 17.5" fill="none" stroke="#5a3410" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4.5 23.5 24 6l19.5 17.5" fill="none" stroke="url(#mm-red)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  restart: svg(`
    <path d="M39 26a15 15 0 1 1-4.4-10.6" fill="none" stroke="#5a2a00" stroke-width="9" stroke-linecap="round"/>
    <path d="M39 26a15 15 0 1 1-4.4-10.6" fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M38.5 5.5v13h-13Z" fill="#fff" stroke="#5a2a00" stroke-width="2.6" stroke-linejoin="round"/>`),
  close: svg('<path d="M14 14l20 20M34 14 14 34" stroke="#7a0e08" stroke-width="10" stroke-linecap="round"/><path d="M14 14l20 20M34 14 14 34" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>'),
  check: svg('<circle cx="24" cy="24" r="20" fill="url(#mm-green)" stroke="#1d5e0a" stroke-width="3"/><path d="M14 24.5l7 7 13-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'),
  video: svg(`
    <rect x="5" y="16" width="38" height="27" rx="5" fill="url(#mm-purple)" stroke="#341478" stroke-width="2.6"/>
    <path d="M5.5 9.5 40 4l1.4 8.2L7 17.8Z" fill="url(#mm-orange)" stroke="#341478" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M14 7.8l4.6 8.4M24 6.2l4.6 8.4M34 4.6l4.4 8.2" stroke="#341478" stroke-width="2.4"/>
    <path d="M20 23v14l12-7Z" fill="url(#mm-bolt)" stroke="#6e3f04" stroke-width="2" stroke-linejoin="round"/>`),
  clock: svg(`
    <rect x="20" y="2.5" width="8" height="6" rx="2" fill="url(#mm-red)" stroke="#5a1408" stroke-width="2.2"/>
    <circle cx="24" cy="27" r="17.5" fill="url(#mm-red)" stroke="#5a1408" stroke-width="2.6"/>
    <circle cx="24" cy="27" r="12.5" fill="#fff" stroke="#5a1408" stroke-width="2"/>
    <path d="M24 19v8.5l5.5 3.5" fill="none" stroke="#16213d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${gloss(15, 17, 4, 2.4, -40, 0.8)}`),
  lock: svg(`
    <path d="M15 22v-6.5a9 9 0 0 1 18 0V22" fill="none" stroke="#3a3f55" stroke-width="7"/>
    <path d="M15 22v-6.5a9 9 0 0 1 18 0V22" fill="none" stroke="url(#mm-silver)" stroke-width="3.5"/>
    <rect x="9" y="21" width="30" height="23" rx="6" fill="url(#mm-gold)" stroke="#6e3f04" stroke-width="2.6"/>
    <path d="M24 29.5v6" stroke="#6e3f04" stroke-width="4" stroke-linecap="round"/>`),
  flame: svg(`
    <path d="M24 3c3 8 13 12.5 13 25a13 13 0 0 1-26 0c0-6.5 3.5-10 6.5-13 .4 3.5 1.8 5.8 4.2 7.2C21 15 21.5 9 24 3Z" fill="url(#mm-flame)" stroke="#7a1606" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M24 26c2 3.6 6 5.4 6 10a6 6 0 0 1-12 0c0-2.8 1.6-4.6 3.4-5.6.3 1.6 1 2.6 2.2 3.3-.2-3 0-5 .4-7.7Z" fill="#fff3a0"/>`),
  goal: svg(`<circle cx="30" cy="31" r="13" fill="#fff" fill-opacity=".35" stroke="#2f6fe0" stroke-width="5"/>
    <path d="M17 18l6 6" stroke="#0e3a85" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 5"/>
    <circle cx="13" cy="14" r="9" fill="url(#mm-blue)" stroke="#0e3a85" stroke-width="2.4"/>${gloss(10, 10.5, 3, 1.8, -35, 0.9)}`),
  sound: svg(`<path d="M7 18h7.5L25 9v30l-10.5-9H7Z" fill="#fff" stroke="#0f4b9e" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M31 17.5a8.5 8.5 0 0 1 0 13M36 12.5a15.5 15.5 0 0 1 0 23" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`),
  vibration: svg(`<rect x="15" y="6" width="18" height="36" rx="4.5" fill="#fff" stroke="#0f4b9e" stroke-width="2.6"/><rect x="19" y="11" width="10" height="21" rx="1.5" fill="#7fd8ff"/>
    <path d="M8 17v14M40 17v14M3.5 20.5v7M44.5 20.5v7" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`),
  bulb: svg(`<path d="M24 5C16 5 10.5 10.8 10.5 18c0 5 2.5 8 5.1 10.5 1.7 1.6 2.6 3.5 2.6 5.2h11.6c0-1.7.9-3.6 2.6-5.2 2.6-2.5 5.1-5.5 5.1-10.5C37.5 10.8 32 5 24 5Z" fill="#fff" stroke="#0f4b9e" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="18" y="35" width="12" height="4" rx="2" fill="#fff" stroke="#0f4b9e" stroke-width="2.2"/><rect x="19.5" y="39.5" width="9" height="4" rx="2" fill="#fff" stroke="#0f4b9e" stroke-width="2.2"/>`),
  orbitLeft: svg(`<path d="M10 27a14 14 0 1 0 4.1-10" fill="none" stroke="#5a3410" stroke-width="8.5" stroke-linecap="round"/><path d="M10 27a14 14 0 1 0 4.1-10" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M8 8.5v12h12Z" fill="#fff" stroke="#5a3410" stroke-width="2.4" stroke-linejoin="round"/><path d="M19 22l5-3 5 3v6l-5 3-5-3Z" fill="url(#mm-gold)" stroke="#5a3410" stroke-width="1.8" stroke-linejoin="round"/>`),
  orbitRight: svg(`<g transform="matrix(-1 0 0 1 48 0)"><path d="M10 27a14 14 0 1 0 4.1-10" fill="none" stroke="#5a3410" stroke-width="8.5" stroke-linecap="round"/><path d="M10 27a14 14 0 1 0 4.1-10" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M8 8.5v12h12Z" fill="#fff" stroke="#5a3410" stroke-width="2.4" stroke-linejoin="round"/><path d="M19 22l5-3 5 3v6l-5 3-5-3Z" fill="url(#mm-gold)" stroke="#5a3410" stroke-width="1.8" stroke-linejoin="round"/></g>`),
};

// A heap of gold coins with sparkles, for the Bravo screen.
export const COIN_PILE = svg(
  `${[
    [52, 92], [92, 92], [132, 92], [70, 80], [114, 80], [92, 68],
  ]
    .map(([x, y]) => `<g transform="translate(${x - 24} ${y - 24}) scale(1 .55) translate(0 18)">${COIN_BODY}</g>`)
    .join('')}
  <g transform="translate(58 26) scale(1.4)">${COIN_BODY}</g>
  <path d="${star(30, 34, 7, 1.8)}" fill="#fff"/><path d="${star(152, 46, 8, 2)}" fill="#fff"/><path d="${star(140, 14, 5, 1.4)}" fill="#fff"/>`,
  'pile',
  '0 0 184 120',
);

// One icon by name (the power-ups use their ids).
export const icon = (name) => ICONS[name] || '';
