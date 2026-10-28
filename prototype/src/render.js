// Draws the machine with three.js. Everything is built from the same track data the
// physics uses, so what you see is exactly what the marbles ride on.

import * as THREE from './three.js';
import { RAIL_Y, pieceCells, WHIRL_HOLE_Y } from './pieces.js';
import { sampleEdge, tangentAwayFrom } from './track.js';
import { machineRotation, directionVector } from './tilt.js';

export const MARBLE_COLORS = {
  blue: 0x2f6fe4,
  orange: 0xf28a1d,
  green: 0x1fa463,
  purple: 0x8b55d9,
  red: 0xe0453a,
};
const LINK_COLORS = { A: 0xc9a23a, B: 0x5d6470, C: 0xb0b8c4 };
const PORTAL_COLORS = { 1: [0xb44cff, '#f3c6ff', '#7a1fd1'], 2: [0x1fc8e0, '#c8fbff', '#0a8ea8'] };
const STEPS = 4; // treads on a stairway
// Plate faces per link: light centre, rim, and the dark bullseye lines.
const PLATE_FACES = { A: ['#f6d977', '#c9962b', '#6b4a10'], B: ['#b3bcc8', '#6b7380', '#262b33'], C: ['#f1f4f8', '#b8c0cb', '#59626e'] };

const BLOCK_INSET = 0.0125; // half the gap between neighbouring blocks
const TOP = 1 - 2 * BLOCK_INSET * 0.6; // block top, a hair under the cell top
const RAIL_TO_TOP = TOP - RAIL_Y; // block top surface, measured from the rail line
const CHANNEL_DEPTH = 0.11; // how deep grooves are carved into the wood
const CHANNEL_HALF = 0.19; // half a groove's width
const CUP_FLAT = 0.18; // goals and plates sit in a round cup: radius of its flat floor...
const CUP_RADIUS = 0.27; // ...and of its rim at the block top
const FLOOR = RAIL_TO_TOP - CHANNEL_DEPTH; // groove floor, measured from the rail line
const CARVE_STEPS = 24; // surface grid points per block on carved tops
const MARBLE_VIEW_R = 0.18; // drawn a little larger than the physics radius
const MARBLE_LIFT = FLOOR + MARBLE_VIEW_R; // so it rests on the groove floor
const RIM_RADIUS = 0.255; // coloured ring around a goal or plate cup
const DEFAULT_YAW = (-24 * Math.PI) / 180;
const POST_OFFSET = 0.38; // how far beside the groove a cable post stands
const TUNNEL_RADIUS = 0.23; // arch cut through a block that sits on top of a groove
const TUNNEL_UNDER = new Set(['straight', 'gate', 'end', 'goal', 'plate']); // grooves an arch can follow
const POST_HEIGHT = 0.32;


// Textures are drawn at 2-4x their layout size (g.scale) so close-ups on high-density
// phone screens stay sharp.
function woodTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.scale(2, 2);
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = '#e2c49a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y0 = rand() * 256;
    const amp = 2 + rand() * 6;
    const freq = 0.01 + rand() * 0.03;
    const phase = rand() * 6.28;
    g.strokeStyle = `rgba(${120 + rand() * 30},${78 + rand() * 20},${40},${0.05 + rand() * 0.12})`;
    g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(90,55,25,${rand() * 0.08})`;
    g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16; // three.js clamps this to what the device supports
  return tex;
}

function marbleTexture(hex) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.scale(4, 4);
  g.fillStyle = `#${new THREE.Color(hex).getHexString()}`;
  g.fillRect(0, 0, 128, 64);
  // A pale band around the equator so you can see the marble roll.
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, 28, 128, 8);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++) g.fillRect(i * 22 + 4, 10, 6, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// A bullseye on the plate's face, so it reads as "roll a marble here".
function plateTexture(link) {
  const [light, rim, dark] = PLATE_FACES[link] || PLATE_FACES.A;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.scale(4, 4);
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, light);
  grad.addColorStop(1, rim);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = dark;
  g.globalAlpha = 0.75;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 38, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.85;
  g.fillStyle = dark;
  g.beginPath();
  g.arc(64, 64, 13, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Red and white warning stripes for shutters, the gates that shut when their link is powered.
function shutterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.scale(4, 4);
  g.fillStyle = '#fbf6ee';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e0311f';
  for (let k = -64; k < 128; k += 32) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k + 16, 0);
    g.lineTo(k + 16 - 64, 64);
    g.lineTo(k - 64, 64);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// The swirl inside a portal ring: spiral arms on a glowing disc.
function swirlTexture(light, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, light);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineCap = 'round';
  for (let arm = 0; arm < 3; arm++) {
    g.lineWidth = 10;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const k = i / 40;
      const a = (arm * 2 * Math.PI) / 3 + k * 3.4;
      const r = 12 + k * 108;
      const x = 128 + r * Math.cos(a);
      const y = 128 + r * Math.sin(a);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A whirl's funnel as drawn: shallower than the spiral the marble really follows (that one
// is steep so the funnel stays one-way), so the steep camera can see into it. Height of the
// funnel's floor at radius r from the middle of a whirl whose top tier is y.
const FUNNEL_RIM = 0.44;
const FUNNEL_HOLE = 0.5; // the hole's height above the tier's floor, as drawn
function funnelFloor(r, y) {
  const rim = y + RAIL_Y + FLOOR;
  const k = Math.min(1, Math.max(0, (r - 0.15) / (FUNNEL_RIM - 0.15)));
  return rim - (rim - (y + FUNNEL_HOLE)) * (1 - k) ** 1.4;
}

// How high a marble is on a stairway, as a fraction of the climb, `frac` of the way along:
// it rides each tread, then hops up to the next.
function stairRise(frac) {
  const k = Math.min(STEPS - 1e-6, Math.max(0, frac * STEPS));
  const tread = Math.floor(k);
  const f = k - tread;
  if (tread >= STEPS - 1 || f < 0.62) return Math.min(tread, STEPS - 1) / (STEPS - 1);
  const h = (f - 0.62) / 0.38;
  return (tread + h) / (STEPS - 1) + 0.1 * Math.sin(Math.PI * h);
}

// A soft studio environment for reflections on the glass marbles.
function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'varying vec3 p; void main(){ float h = normalize(p).y * 0.5 + 0.5; gl_FragColor = vec4(mix(vec3(0.16,0.55,0.56), vec3(1.0,0.98,0.94), h), 1.0); }',
      }),
    ),
  );
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  panel.position.set(-3, 6, 3);
  panel.lookAt(0, 0, 0);
  scene.add(panel);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return env;
}

// A block with an arched tunnel through its base, running along z. Used where a block
// sits on top of a groove, so the marble visibly rolls into a tunnel. `height` is lower
// than a full block when a carved top goes on it.
function archGeometry(height) {
  const w = 0.5 - BLOCK_INSET;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(-TUNNEL_RADIUS, 0);
  shape.absarc(0, 0, TUNNEL_RADIUS, Math.PI, 0, true);
  shape.lineTo(w, 0);
  shape.lineTo(w, height);
  shape.lineTo(-w, height);
  shape.lineTo(-w, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2 * w, bevelEnabled: false, curveSegments: 20 });
  geo.translate(0, 0, -w);
  return geo;
}

// The dark inside of that tunnel.
function tunnelLiningGeometry() {
  const w = 0.5 - BLOCK_INSET;
  const r = TUNNEL_RADIUS - 0.004;
  const pos = [];
  const index = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * i) / steps;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, -w, Math.cos(a) * r, Math.sin(a) * r, w);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// The darkness of a tunnel: a shade over the groove inside, plus a dim veil just inside
// each mouth. From the steep camera you only see a sliver of the inside, so the veil is
// what makes the opening read as a hole; a marble rolling in disappears behind it.
function tunnelShadeGeometry() {
  const w = 0.5 - BLOCK_INSET;
  const r = TUNNEL_RADIUS - 0.006;
  const mouth = w - 0.03;
  const y = RAIL_Y + FLOOR - 1 + 0.005; // the groove floor below, from this block's base
  const pos = [-r, y, -w, r, y, -w, -r, y, w, r, y, w];
  const index = [0, 2, 1, 1, 2, 3];
  for (const z of [-mouth, mouth]) {
    const centre = pos.length / 3;
    pos.push(0, y, z);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const a = (Math.PI * i) / steps;
      pos.push(Math.cos(a) * r, Math.max(y, Math.sin(a) * r), z);
      if (i > 0) index.push(centre, centre + i, centre + i + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

// A grooved block with its channels really carved in: the top is a fine grid lowered in
// a smooth U-profile around the piece's rail lines (and in round cups for goals and
// plates), shaded darker where it is deeper. The sides follow the top's edge, so they dip
// where a channel leaves the block and neighbouring blocks line up. `base` is where the
// sides start (the block's floor, or the top of a tunnel arch underneath).
function carvePiece(track, piece, base) {
  const segs = [];
  // A whirl is a smooth funnel the marble circles down; only where a groove comes in over the
  // rim is a channel cut (the drop and the exits are inside the block below).
  let bowl = null;
  if (piece.type === 'whirl') {
    const [ax, ay, az] = piece.anchor;
    // Every spiral, for the darker track painted along the funnel.
    const track2d = piece.edges.slice(0, piece.opts.entries.length).flatMap((id) => {
      const pts = track.edges[id].pts;
      return pts.slice(1).map((p, i) => [pts[i][0], pts[i][2], p[0], p[2]]);
    });
    bowl = { x: ax + 0.5, y: ay, z: az + 0.5, top: ay + TOP, hole: ay + FUNNEL_HOLE, track2d };
  }
  const edgeIds = bowl ? piece.edges.slice(0, piece.opts.entries.length) : piece.edges;
  for (const id of edgeIds) {
    const pts = track.edges[id].pts;
    for (let i = 0; i < pts.length - 1; i++) {
      if (bowl && Math.hypot(pts[i + 1][0] - bowl.x, pts[i + 1][2] - bowl.z) < FUNNEL_RIM) continue;
      segs.push([pts[i][0], pts[i][2], pts[i][1], pts[i + 1][0], pts[i + 1][2], pts[i + 1][1]]);
    }
  }
  const stairs = piece.type === 'stairs';
  const cups = ['goal', 'plate', 'portal'].includes(piece.type) ? piece.edges.map((id) => track.edges[id].pts.at(-1)) : [];
  const cells = pieceCells(piece.type, piece.anchor, piece.r).filter((c) => c[1] === piece.anchor[1]);
  const x0 = Math.min(...cells.map((c) => c[0])) + BLOCK_INSET;
  const x1 = Math.max(...cells.map((c) => c[0])) + 1 - BLOCK_INSET;
  const z0 = Math.min(...cells.map((c) => c[2])) + BLOCK_INSET;
  const z1 = Math.max(...cells.map((c) => c[2])) + 1 - BLOCK_INSET;

  // Surface height and how far it is cut down (0 = block top, 1 = groove floor).
  function surface(x, z) {
    let dist = Infinity;
    let railY = 0;
    for (const [ax, az, ay, bx, bz, by] of segs) {
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < dist) {
        dist = d;
        // A stairway's treads: flat steps instead of a slope.
        railY = stairs ? ay + Math.min(STEPS - 1, Math.floor(t * STEPS)) / (STEPS - 1) : ay + (by - ay) * t;
      }
    }
    let cut = dist < CHANNEL_HALF ? Math.sqrt(1 - (dist / CHANNEL_HALF) ** 2) : 0;
    if (bowl) {
      // The funnel's floor at radius r is the groove floor of the spiral at that radius, so
      // the marble rolls on it; it rises to the block top at the rim.
      const r = Math.hypot(x - bowl.x, z - bowl.z);
      const floor = funnelFloor(r, bowl.y);
      const rim = Math.min(1, Math.max(0, (r - FUNNEL_RIM + 0.02) / 0.06));
      const funnel = floor + (bowl.top - floor) * rim * rim * (3 - 2 * rim);
      const groove = cut > 0 ? railY + RAIL_TO_TOP - CHANNEL_DEPTH * cut : Infinity;
      const h = Math.min(funnel, groove);
      let onTrack = Infinity;
      for (const [ax, az, bx, bz] of bowl.track2d) {
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        onTrack = Math.min(onTrack, Math.hypot(x - ax - dx * t, z - az - dz * t));
      }
      const depth = ((bowl.top - h) / (bowl.top - bowl.hole)) * 0.6;
      const stripe = rim < 1 && onTrack < 0.075 ? 0.95 : 0;
      return [h, Math.min(1, Math.max(cut, depth, stripe))];
    }
    for (const c of cups) {
      const dc = Math.hypot(x - c[0], z - c[2]);
      const cup = dc <= CUP_FLAT ? 1 : dc < CUP_RADIUS ? Math.sqrt(1 - ((dc - CUP_FLAT) / (CUP_RADIUS - CUP_FLAT)) ** 2) : 0;
      cut = Math.max(cut, cup);
    }
    return [railY + RAIL_TO_TOP - CHANNEL_DEPTH * cut, cut];
  }

  const pos = [];
  const nrm = [];
  const col = [];
  const uv = [];
  const index = [];
  const steps = bowl ? 48 : stairs ? 40 : CARVE_STEPS;
  const nx = Math.max(2, Math.round((x1 - x0) * steps));
  const nz = Math.max(2, Math.round((z1 - z0) * steps));
  const e = 0.004;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const z = z0 + ((z1 - z0) * j) / nz;
      const [h, cut] = surface(x, z);
      const hx = (surface(x + e, z)[0] - surface(x - e, z)[0]) / (2 * e);
      const hz = (surface(x, z + e)[0] - surface(x, z - e)[0]) / (2 * e);
      const l = Math.hypot(hx, 1, hz);
      pos.push(x, h, z);
      nrm.push(-hx / l, 1 / l, -hz / l);
      col.push(1 - 0.3 * cut, 1 - 0.34 * cut, 1 - 0.4 * cut);
      uv.push(x * 0.9, z * 0.9);
    }
  }
  const row = nx + 1;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * row + i;
      index.push(a, a + row, a + row + 1, a, a + row + 1, a + 1);
    }
  }

  // Sides: a strip from `base` up to the top's edge, with a flat outward normal.
  function side(points, normal, uvOf) {
    const first = pos.length / 3;
    for (const [x, z] of points) {
      const h = surface(x, z)[0];
      pos.push(x, h, z, x, base, z);
      nrm.push(...normal, ...normal);
      col.push(1, 1, 1, 1, 1, 1);
      uv.push(uvOf(x, z), h, uvOf(x, z), base);
    }
    for (let k = 0; k < points.length - 1; k++) {
      const top0 = first + k * 2;
      const tri = [top0, top0 + 1, top0 + 2, top0 + 2, top0 + 1, top0 + 3];
      // Flip the winding if it doesn't face outward.
      const p = (i) => pos.slice(i * 3, i * 3 + 3);
      const [A, B, C] = [p(tri[0]), p(tri[1]), p(tri[2])];
      const n = [
        (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]),
        (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]),
        (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]),
      ];
      if (n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2] < 0) [tri[1], tri[2], tri[4], tri[5]] = [tri[2], tri[1], tri[5], tri[4]];
      index.push(...tri);
    }
  }
  const along = (a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => a0 + ((a1 - a0) * k) / n);
  side(along(x0, x1, nx).map((x) => [x, z0]), [0, 0, -1], (x) => x);
  side(along(x0, x1, nx).map((x) => [x, z1]), [0, 0, 1], (x) => x);
  side(along(z0, z1, nz).map((z) => [x0, z]), [-1, 0, 0], (x, z) => z);
  side(along(z0, z1, nz).map((z) => [x1, z]), [1, 0, 0], (x, z) => z);

  // Bottom, so the block is closed: shadows are drawn from the faces pointing away from
  // the light, and without it the top would cast no shadow.
  const b = pos.length / 3;
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
    pos.push(x, base, z);
    nrm.push(0, -1, 0);
    col.push(1, 1, 1);
    uv.push(x, z);
  }
  index.push(b, b + 1, b + 2, b, b + 2, b + 3);

  return { pos, nrm, col, uv, index };
}

function mergeCarved(parts) {
  const pos = [];
  const nrm = [];
  const col = [];
  const uv = [];
  const index = [];
  for (const part of parts) {
    const offset = pos.length / 3;
    pos.push(...part.pos);
    nrm.push(...part.nrm);
    col.push(...part.col);
    uv.push(...part.uv);
    for (const i of part.index) index.push(i + offset);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

export function createView(canvas) {
  // Draw at the screen's own pixel density (up to 3x on high-end phones). If frames get slow
  // the resolution steps down, but never below 2x (or the screen's density, if lower):
  // under that the machine looks soft and pixelated on a phone.
  const deviceRatio = window.devicePixelRatio || 1;
  const maxRatio = Math.min(deviceRatio, 3);
  const minRatio = Math.min(deviceRatio, 2);
  let pixelRatio = maxRatio;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x2b8f92, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const woodMats = [1, 0.95, 1.04, 0.91, 1.07].map((k, i) => {
    const map = woodTexture(i + 1);
    map.rotation = i % 2 ? Math.PI / 2 : 0;
    return new THREE.MeshStandardMaterial({ map, color: new THREE.Color(k, k * 0.99, k * 0.97), roughness: 0.78 });
  });
  const carvedMats = woodMats.map((m) => {
    const c = m.clone();
    c.vertexColors = true;
    return c;
  });
  const cubeGeo = new THREE.BoxGeometry(1 - 2 * BLOCK_INSET, TOP, 1 - 2 * BLOCK_INSET);
  cubeGeo.translate(0, TOP / 2, 0);
  const archUnder = TOP - CHANNEL_DEPTH - 0.012; // arch body height under a carved top
  const archGeo = archGeometry(TOP);
  const archUnderCarvedGeo = archGeometry(archUnder);
  const liningGeo = tunnelLiningGeometry();
  const liningMat = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.95, side: THREE.DoubleSide });
  const shadeGeo = tunnelShadeGeometry();
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0x4a3220, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const marbleGeo = new THREE.SphereGeometry(MARBLE_VIEW_R, 32, 18);
  const postGeo = new THREE.CylinderGeometry(0.026, 0.036, POST_HEIGHT, 10);
  postGeo.translate(0, POST_HEIGHT / 2, 0);
  const knobGeo = new THREE.SphereGeometry(0.05, 14, 10);
  const beadGeo = new THREE.SphereGeometry(0.03, 10, 8);
  // A flat lightning bolt, lying on the groove floor, pointing along +x.
  const boltShape = new THREE.Shape();
  [[0.36, 0], [-0.03, 0.12], [0.04, 0.03], [-0.36, 0.04], [0.03, -0.12], [-0.04, -0.03]].forEach(([x, z], i) => (i ? boltShape.lineTo(x, z) : boltShape.moveTo(x, z)));
  boltShape.closePath();
  const boltGeo = new THREE.ShapeGeometry(boltShape);
  boltGeo.rotateX(-Math.PI / 2);
  const shutterTex = shutterTexture();
  const shutterRed = new THREE.MeshStandardMaterial({ color: 0xd8352a, roughness: 0.5 });
  // A flat chevron for the stairways, pointing along +x (up the stairs once turned).
  const chevronShape = new THREE.Shape();
  [[0.09, 0], [-0.04, 0.13], [-0.11, 0.13], [0.02, 0], [-0.11, -0.13], [-0.04, -0.13]].forEach(([x, z], i) => (i ? chevronShape.lineTo(x, z) : chevronShape.moveTo(x, z)));
  chevronShape.closePath();
  const chevronGeo = new THREE.ShapeGeometry(chevronShape);
  chevronGeo.rotateX(-Math.PI / 2);
  // A thin ring lying flat, for a marble turned back at the top of a stairway.
  const nopeGeo = new THREE.RingGeometry(0.2, 0.26, 40);
  nopeGeo.rotateX(-Math.PI / 2);

  const shared = new Set([cubeGeo, archGeo, archUnderCarvedGeo, liningGeo, shadeGeo, marbleGeo, postGeo, knobGeo, beadGeo, boltGeo, chevronGeo, nopeGeo]);

  let pivot = null; // tilts around the machine's centre
  let content = null; // machine coordinates live here
  let current = null; // per-level objects
  let clock = 0;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const view = { yaw: DEFAULT_YAW, targetYaw: DEFAULT_YAW, pitch: (50 * Math.PI) / 180, distance: 12, targetDistance: 12, shift: 0, targetShift: 0, center: new THREE.Vector3(), spin: false };

  function clearLevel() {
    if (!pivot) return;
    scene.remove(pivot);
    pivot.traverse((o) => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    pivot = null;
  }

  // Which way a groove under this block runs, if the block should have a tunnel through it.
  function tunnelAxis(track, owner, piece) {
    if (piece.type === 'ramp' || piece.type === 'stairs' || piece.type === 'whirl') return null;
    const [x, y, z] = piece.anchor;
    const below = track.pieces[owner.get(`${x},${y - 1},${z}`)];
    if (!below || below === piece || !TUNNEL_UNDER.has(below.type)) return null;
    const { tangent } = sampleEdge(track.edges[below.edges[0]], 0.25);
    return Math.abs(tangent[2]) > Math.abs(tangent[0]) ? 'ns' : 'ew';
  }

  // Wood blocks. Plain blocks share one instanced mesh per wood tint; grooved blocks get
  // carved tops, merged into one mesh per tint. Blocks over a groove get an arched tunnel.
  function addBlocks(track, owner) {
    const groups = new Map();
    const carved = woodMats.map(() => []);
    let n = 0;
    const plainBlock = (cell, mat, r = 0) => {
      const key = `c${mat}`;
      if (!groups.has(key)) groups.set(key, { geo: cubeGeo, mat: woodMats[mat], list: [] });
      const m = new THREE.Matrix4().makeRotationY((-r * Math.PI) / 2);
      m.setPosition(cell[0] + 0.5, cell[1], cell[2] + 0.5);
      groups.get(key).list.push(m);
    };
    for (const piece of track.pieces) {
      if (piece.type === 'sky' || piece.type === 'skyEnd') continue; // a beam, drawn by addSky
      const mat = (piece.anchor[0] * 7 + piece.anchor[1] * 3 + piece.anchor[2] * 5 + n++) % woodMats.length;
      const grooved = piece.edges.length > 0;
      if (piece.type === 'whirl') {
        // The funnel on top, and a plain block underneath that the marble drops into.
        carved[mat].push(carvePiece(track, piece, piece.anchor[1]));
        plainBlock([piece.anchor[0], piece.anchor[1] - 1, piece.anchor[2]], (mat + 1) % woodMats.length);
        continue;
      }
      const axis = tunnelAxis(track, owner, piece);
      if (axis) {
        const body = grooved ? archUnderCarvedGeo : archGeo;
        for (const [geo, material] of [[body, woodMats[mat]], [liningGeo, liningMat], [shadeGeo, shadeMat]]) {
          const mesh = new THREE.Mesh(geo, material);
          mesh.position.set(piece.anchor[0] + 0.5, piece.anchor[1], piece.anchor[2] + 0.5);
          mesh.rotation.y = axis === 'ns' ? 0 : Math.PI / 2;
          mesh.castShadow = geo !== shadeGeo;
          mesh.receiveShadow = geo !== shadeGeo;
          content.add(mesh);
        }
        if (grooved) carved[mat].push(carvePiece(track, piece, piece.anchor[1] + archUnder));
        continue;
      }
      if (grooved) {
        carved[mat].push(carvePiece(track, piece, piece.anchor[1]));
        continue;
      }
      plainBlock(piece.anchor, mat, piece.r);
    }
    for (const { geo, mat, list } of groups.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      content.add(mesh);
    }
    carved.forEach((parts, k) => {
      if (!parts.length) return;
      const mesh = new THREE.Mesh(mergeCarved(parts), carvedMats[k]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      content.add(mesh);
    });
  }

  // A brass post standing on the block top beside a groove, on the side facing `towards`.
  function addPost(surface, tangent, towards, color, knobColor = color) {
    const side = new THREE.Vector3(-tangent[2], 0, tangent[0]).normalize();
    const a = surface.clone().addScaledVector(side, POST_OFFSET);
    const b = surface.clone().addScaledVector(side, -POST_OFFSET);
    const base = a.distanceToSquared(towards) <= b.distanceToSquared(towards) ? a : b;
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.3, emissive: color, emissiveIntensity: 0 });
    const post = new THREE.Mesh(postGeo, mat);
    post.position.copy(base);
    post.castShadow = true;
    const knob = new THREE.Mesh(knobGeo, knobColor === color ? mat : new THREE.MeshStandardMaterial({ color: knobColor, roughness: 0.4 }));
    knob.position.copy(base).setY(base.y + POST_HEIGHT);
    knob.castShadow = true;
    content.add(post, knob);
    return { top: knob.position.clone(), mat };
  }

  // Colour filters: an arch of the marble's colour over the groove, and a stripe on its floor.
  function addFilters(track) {
    for (const f of track.filters || []) {
      const { pos, tangent } = sampleEdge(track.edges[f.edge], f.s);
      const color = MARBLE_COLORS[f.color] ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15, emissive: color, emissiveIntensity: 0.35 });
      const group = new THREE.Group();
      group.position.set(pos[0], pos[1] + RAIL_TO_TOP, pos[2]);
      group.lookAt(pos[0] + tangent[0], pos[1] + RAIL_TO_TOP, pos[2] + tangent[2]);
      // A short arched hood of that colour over the groove: it reads from any side.
      const shape = new THREE.Shape();
      shape.moveTo(0.31, 0);
      shape.absarc(0, 0, 0.31, 0, Math.PI, false);
      shape.lineTo(-0.235, 0);
      shape.absarc(0, 0, 0.235, Math.PI, 0, true);
      shape.closePath();
      const hoodGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 });
      hoodGeo.translate(0, 0, -0.12);
      const hood = new THREE.Mesh(hoodGeo, mat);
      hood.castShadow = true;
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.018, 8, 28, Math.PI), white);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), mat);
      ball.position.y = 0.36;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2 * CHANNEL_HALF, 0.012, 0.1), mat);
      stripe.position.y = -CHANNEL_DEPTH + 0.008;
      group.add(hood, band, ball, stripe);
      content.add(group);
    }
  }

  // Portals: a glowing ring standing across the groove at the cell's centre, with a turning
  // swirl inside. The two of a pair share a colour.
  function addPortals(track) {
    const list = [];
    for (const piece of track.pieces) {
      if (piece.type !== 'portal') continue;
      const edge = track.edges[piece.edges[0]];
      const { pos, tangent } = sampleEdge(edge, edge.L);
      const [hex, light, dark] = PORTAL_COLORS[piece.opts.pair] || PORTAL_COLORS[1];
      // A swirling vortex in a round cup, a glowing rim, and sparks circling above it.
      const group = new THREE.Group();
      group.position.set(pos[0], pos[1] + FLOOR, pos[2]);
      const ringMat = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.3, roughness: 0.3, emissive: hex, emissiveIntensity: 0.7 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS + 0.01, 0.042, 12, 44), ringMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = RAIL_TO_TOP - FLOOR + 0.008;
      rim.castShadow = true;
      const swirlMat = new THREE.MeshBasicMaterial({ map: swirlTexture(light, dark), transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const pad = new THREE.Mesh(new THREE.CircleGeometry(CUP_FLAT + 0.04, 40), swirlMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.004;
      const sparks = new THREE.Group();
      sparks.position.y = rim.position.y + 0.07;
      for (let k = 0; k < 3; k++) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const a = (k * 2 * Math.PI) / 3;
        spark.position.set(Math.cos(a) * (RIM_RADIUS + 0.01), 0, Math.sin(a) * (RIM_RADIUS + 0.01));
        sparks.add(spark);
      }
      group.add(rim, pad, sparks);
      content.add(group);
      list.push({ swirl: sparks, pad, ringMat });
    }
    return list;
  }

  // Sky rails: a steel beam with a glowing magnet strip that the marbles hang from, held up
  // by brackets on the blocks at its ends.
  const BEAM_Y = MARBLE_LIFT + MARBLE_VIEW_R + 0.065; // above the rail line
  function addSky(track) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x4d6496, metalness: 0.65, roughness: 0.35 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x9ff4ff, emissive: 0x39d4ff, emissiveIntensity: 1 });
    const beam = (a, b, y, extra = 0) => {
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const l = Math.hypot(dx, dz);
      const len = l + extra;
      const mx = a[0] + (dx / l) * (len / 2);
      const mz = a[2] + (dz / l) * (len / 2);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.13), steel);
      bar.position.set(mx, y, mz);
      bar.rotation.y = Math.atan2(-dz, dx);
      bar.castShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.07), glow);
      strip.position.set(mx, y - 0.05, mz);
      strip.rotation.y = bar.rotation.y;
      content.add(bar, strip);
    };
    for (const piece of track.pieces) {
      if (piece.type !== 'sky' && piece.type !== 'skyEnd') continue;
      const pts = track.edges[piece.edges[0]].pts;
      beam(pts[0], pts.at(-1), pts[0][1] + BEAM_Y, piece.type === 'skyEnd' ? 0.12 : 0);
      if (piece.type === 'skyEnd') {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 16), steel);
        const e = pts.at(-1);
        const t = sampleEdge(track.edges[piece.edges[0]], 1e9).tangent;
        cap.position.set(e[0] + t[0] * 0.12, e[1] + BEAM_Y, e[2] + t[2] * 0.12);
        content.add(cap);
      }
    }
    // Where a sky rail meets a block: the beam reaches into the block, onto a bracket beside the groove.
    for (const node of track.nodes) {
      const skyLink = node.links.find((l) => track.edges[l.edge].sky);
      const ground = node.links.find((l) => !track.edges[l.edge].sky);
      if (!skyLink || !ground) continue;
      const into = tangentAwayFrom(track.edges[ground.edge], ground.end);
      const p = node.pos;
      const y = p[1] + BEAM_Y;
      beam(p, [p[0] + into[0], p[1], p[2] + into[2]], y, -0.62);
      const side = [-into[2], 0, into[0]];
      const at = [p[0] + into[0] * 0.3 + side[0] * 0.3, p[2] + into[2] * 0.3 + side[2] * 0.3];
      const top = p[1] + RAIL_TO_TOP;
      const h = y + 0.06 - top;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.07), steel);
      post.position.set(at[0], top + h / 2, at[1]);
      post.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.34), steel);
      arm.position.set(at[0] - side[0] * 0.15, y + 0.06, at[1] - side[2] * 0.15);
      arm.rotation.y = Math.atan2(-into[2], into[0]);
      content.add(post, arm);
    }
  }

  // Whirls: the dark hole at the bottom of the funnel, and a dark mouth on each side of the
  // block underneath where a groove leads out.
  function addWhirls(track) {
    const dark = new THREE.MeshBasicMaterial({ color: 0x1c120a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const OUT = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
    for (const piece of track.pieces) {
      if (piece.type !== 'whirl') continue;
      const [x, y, z] = piece.anchor;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.135, 28), dark);
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(x + 0.5, y + FUNNEL_HOLE + 0.004, z + 0.5);
      content.add(hole);
      for (const side of piece.opts.exits) {
        const [dx, dz] = OUT[side];
        const mouth = new THREE.Mesh(new THREE.CircleGeometry(TUNNEL_RADIUS - 0.02, 24, 0, Math.PI), dark);
        mouth.position.set(x + 0.5 + dx * (0.5 - BLOCK_INSET + 0.003), y - 1 + RAIL_Y + FLOOR, z + 0.5 + dz * (0.5 - BLOCK_INSET + 0.003));
        mouth.rotation.y = Math.atan2(dx, dz);
        content.add(mouth);
      }
    }
  }

  // Stairways: a green chevron on every tread, pointing up. In play a light runs up them, like
  // an escalator, so it's clear the stairs only go one way.
  function addStairs(track) {
    const chevrons = [];
    for (const piece of track.pieces) {
      if (piece.type !== 'stairs') continue;
      for (const id of piece.edges) {
        const edge = track.edges[id];
        if (!edge.lift) continue;
        const [lo, hi] = edge.pts[0][1] <= edge.pts.at(-1)[1] ? [edge.pts[0], edge.pts.at(-1)] : [edge.pts.at(-1), edge.pts[0]];
        const angle = Math.atan2(-(hi[2] - lo[2]), hi[0] - lo[0]);
        for (let k = 0; k < STEPS; k++) {
          const f = (k + 0.31) / STEPS;
          const y = lo[1] + ((hi[1] - lo[1]) * k) / (STEPS - 1) + FLOOR + 0.006;
          const flat = (color, order, scale) => {
            const mesh = new THREE.Mesh(chevronGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
            mesh.renderOrder = order;
            mesh.scale.setScalar(scale);
            return mesh;
          };
          const group = new THREE.Group();
          group.add(flat(0x16620f, 4, 1.25), flat(0xa6ff7a, 5, 1));
          group.children[1].position.y = 0.002;
          group.position.set(lo[0] + (hi[0] - lo[0]) * f, y, lo[2] + (hi[2] - lo[2]) * f);
          group.rotation.y = angle;
          content.add(group);
          chevrons.push({ group, k });
        }
      }
    }
    return chevrons;
  }

  function build(track) {
    clearLevel();
    perf.ignore = 120;
    perf.slow = 0;
    const { min, max } = track.bounds;
    const center = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    view.center.copy(center);
    pivot = new THREE.Group();
    pivot.position.copy(center);
    content = new THREE.Group();
    content.position.copy(center).multiplyScalar(-1);
    pivot.add(content);
    scene.add(pivot);
    floor.position.y = min[1] - 2.2;

    const owner = new Map();
    for (const piece of track.pieces) for (const c of pieceCells(piece.type, piece.anchor, piece.r)) owner.set(c.join(','), piece.index);
    addBlocks(track, owner);

    // Goals: a coloured ring around the rim of a carved cup, with a coloured floor.
    const goals = track.goals.map((goal) => {
      const edge = track.edges[goal.edge];
      const p = edge.pts[edge.pts.length - 1];
      const color = MARBLE_COLORS[goal.color] ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, emissive: color, emissiveIntensity: 0.05 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS, 0.028, 10, 36), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p[0], p[1] + RAIL_TO_TOP + 0.006, p[2]);
      ring.castShadow = true;
      const inlay = new THREE.Mesh(
        new THREE.CircleGeometry(CUP_FLAT - 0.01, 28),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      );
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(p[0], p[1] + FLOOR + 0.003, p[2]);
      content.add(ring, inlay);
      if (goal.link) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.016, 8, 36), new THREE.MeshStandardMaterial({ color: LINK_COLORS[goal.link], metalness: 0.8, roughness: 0.3 }));
        band.rotation.x = -Math.PI / 2;
        band.position.copy(ring.position);
        content.add(band);
      }
      return { mat, surface: new THREE.Vector3(p[0], p[1] + RAIL_TO_TOP, p[2]), tangent: sampleEdge(edge, edge.L).tangent };
    });

    // Plates: a bright metal bullseye exactly where the marble comes to rest, inside a
    // raised ring that pulses gently until a marble presses it.
    const plates = track.plates.map((plate) => {
      const edge = track.edges[plate.edge];
      const { pos, tangent } = sampleEdge(edge, edge.L);
      const color = LINK_COLORS[plate.link];
      const faceMap = plateTexture(plate.link);
      const topMat = new THREE.MeshStandardMaterial({ map: faceMap, emissiveMap: faceMap, emissive: 0xffffff, emissiveIntensity: 0.05, metalness: 0.35, roughness: 0.4 });
      const sideMat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.026, 32), [sideMat, topMat, sideMat]);
      disc.position.set(pos[0], pos[1] + FLOOR + 0.015, pos[2]);
      disc.receiveShadow = true;
      const ringMat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35, emissive: color, emissiveIntensity: 0.2 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS, 0.03, 10, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos[0], pos[1] + RAIL_TO_TOP + 0.006, pos[2]);
      ring.castShadow = true;
      content.add(disc, ring);
      return { topMat, ringMat, disc, baseY: disc.position.y, surface: new THREE.Vector3(pos[0], pos[1] + RAIL_TO_TOP, pos[2]), tangent };
    });

    // Gates: a metal slab across the groove that sinks into the wood when open.
    // Shutters are striped red and white; open, they sink only to the groove floor, so the
    // stripe across the groove still shows where one will rise.
    const gates = track.gates.map((gate) => {
      const edge = track.edges[gate.edge];
      const { pos, tangent } = sampleEdge(edge, gate.s);
      const frameMat = gate.inverse ? new THREE.MeshStandardMaterial({ map: shutterTex, roughness: 0.45 }) : null;
      const mat = gate.inverse
        ? frameMat
        : new THREE.MeshStandardMaterial({ color: LINK_COLORS[gate.link], metalness: 0.8, roughness: 0.32 });
      // Closed, the slab fills the groove from its floor to well above the block top.
      const top = pos[1] + RAIL_TO_TOP;
      const bottom = pos[1] + FLOOR - 0.01;
      const height = top + 0.28 - bottom;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(gate.inverse ? 0.09 : 0.06, height, 2 * CHANNEL_HALF + 0.03), mat);
      slab.rotation.y = Math.atan2(-tangent[2], tangent[0]);
      const closedY = bottom + height / 2;
      const openY = gate.inverse ? pos[1] + FLOOR + 0.02 - height / 2 : closedY - height - 0.02;
      const startY = gate.inverse ? openY : closedY;
      slab.position.set(pos[0], startY, pos[2]);
      slab.castShadow = true;
      content.add(slab);
      if (gate.inverse) {
        // A striped frame over the groove, like a level crossing, so a shutter is easy to
        // spot while it is open.
        const side = new THREE.Vector3(-tangent[2], 0, tangent[0]).normalize();
        const frameH = 0.42;
        for (const k of [1, -1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, frameH, 0.08), shutterRed);
          post.position.set(pos[0], top + frameH / 2, pos[2]).addScaledVector(side, k * (CHANNEL_HALF + 0.07));
          post.rotation.y = slab.rotation.y;
          post.castShadow = true;
          content.add(post);
        }
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 2 * CHANNEL_HALF + 0.22), frameMat);
        bar.position.set(pos[0], top + frameH, pos[2]);
        bar.rotation.y = slab.rotation.y;
        bar.castShadow = true;
        content.add(bar);
      }
      return { slab, closedY, openY, y: startY, surface: new THREE.Vector3(pos[0], top, pos[2]), tangent };
    });

    // Cables: each plate (or banded goal) and its gate get a brass post beside the groove,
    // with a cable strung between the post tops. Nothing hangs when the gate sinks.
    const cables = [];
    track.gates.forEach((gate, gi) => {
      const sources = [
        ...plates.filter((_, i) => track.plates[i].link === gate.link),
        ...goals.filter((_, i) => track.goals[i].link === gate.link),
      ];
      if (!sources.length) return;
      const color = LINK_COLORS[gate.link];
      const towards = sources.reduce((acc, s) => acc.add(s.surface), new THREE.Vector3()).multiplyScalar(1 / sources.length);
      const gatePost = addPost(gates[gi].surface, gates[gi].tangent, towards, color, gate.inverse ? 0xd23b2a : color);
      for (const src of sources) {
        const srcPost = addPost(src.surface, src.tangent, gatePost.top, color);
        const a = srcPost.top;
        const b = gatePost.top;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y = Math.max(a.y, b.y) + 0.22 + a.distanceTo(b) * 0.1;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.45, emissive: color, emissiveIntensity: 0 });
        const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.016, 6), mat);
        cable.castShadow = false; // a thin cable's shadow on the ground just looks like a stray line
        content.add(cable);
        const beads = [0, 1, 2].map(() => {
          const bead = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: 0xfff3cf }));
          bead.visible = false;
          content.add(bead);
          return bead;
        });
        cables.push({ gate: gi, inverse: gate.inverse, curve, mat, beads, posts: [srcPost.mat, gatePost.mat] });
      }
    });

    addFilters(track);
    const portals = addPortals(track);
    addSky(track);
    addWhirls(track);
    const stairs = addStairs(track);

    // Cells with a different block directly on top are tunnels: only there is a marble
    // hidden from every angle, so only there does its outline show through the wood. A sky
    // rail overhead hides nothing; inside a whirl's drop and the block under it hides it too.
    const isSky = (i) => i !== undefined && (track.pieces[i].type === 'sky' || track.pieces[i].type === 'skyEnd');
    const inTunnel = (pos) => {
      const x = Math.floor(pos[0]);
      const y = Math.floor(pos[1]);
      const z = Math.floor(pos[2]);
      const here = owner.get(`${x},${y},${z}`);
      if (here !== undefined && track.pieces[here].type === 'whirl') {
        const top = track.pieces[here].anchor[1];
        return y < top || pos[1] - top < WHIRL_HOLE_Y + 0.02;
      }
      const above = owner.get(`${x},${y + 1},${z}`);
      return here !== undefined && above !== undefined && above !== here && !isSky(above);
    };

    // Marbles, each with an outline twin that only draws when the marble is in a tunnel.
    const marbles = track.starts.map((st) => {
      const hex = MARBLE_COLORS[st.color] ?? 0xffffff;
      const mesh = new THREE.Mesh(
        marbleGeo,
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: marbleTexture(hex), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06 }),
      );
      mesh.castShadow = true;
      const ghost = new THREE.Mesh(
        marbleGeo,
        new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.5, depthFunc: THREE.GreaterDepth, depthWrite: false }),
      );
      ghost.renderOrder = 10;
      ghost.scale.setScalar(1.08);
      content.add(mesh, ghost);
      return { mesh, ghost, prev: new THREE.Vector3(), placed: false, simPos: null, lag: 0, lagV: 0, fallV: 0, pop: 0 };
    });

    // Light and shadow sized to the machine.
    const size = Math.max(max[0] - min[0], max[2] - min[2], max[1] - min[1]) + 2;
    sun.position.set(center.x - size * 0.6, center.y + size * 1.4, center.z - size * 0.35);
    sun.target.position.copy(center);
    // The shadow camera looks along the light, so the machine's bounding sphere is all it
    // needs to cover; a tighter frame means finer shadow edges.
    const radius = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) + 0.8;
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -radius;
    cam.right = cam.top = radius;
    cam.near = 0.5;
    cam.far = size * 4;
    cam.updateProjectionMatrix();

    current = { track, goals, plates, gates, cables, marbles, portals, stairs, nopes: [], inTunnel, hint: null, fitPts: fitPoints(track) };
    fitCamera();
    view.distance = view.targetDistance;
    view.shift = view.targetShift;
  }

  function cameraBasis(yaw) {
    const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(view.pitch), -Math.sin(view.pitch), -Math.cos(yaw) * Math.cos(view.pitch));
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { fwd, right, up };
  }

  // Pick a camera distance so the whole machine fits, with room for the HUD. While the
  // camera circles (home screen) it uses the distance that fits from every side, so the
  // zoom stays still instead of pumping in and out.
  // The camera also slides sideways so the machine's outline, not its bounding box, is
  // centred (not while circling, where every side has to fit).
  function fitCamera() {
    if (!current) return;
    let { d, off } = distanceFor(view.targetYaw, !view.spin);
    if (view.spin) for (let k = 0; k < 24; k++) d = Math.max(d, distanceFor(view.yaw + (k * Math.PI) / 12, false).d);
    view.targetDistance = d;
    view.targetShift = view.spin ? 0 : off;
  }

  // The corners of every block, with a little headroom for gates and cables: the camera fits
  // the machine itself, not its bounding box, so L- and T-shaped machines fill the screen.
  function fitPoints(track) {
    const pts = new Map();
    for (const key of track.cellOwner.keys()) {
      const [x, y, z] = key.split(',').map(Number);
      for (const dx of [-0.05, 1.05]) for (const dz of [-0.05, 1.05]) for (const dy of [0, 1.3]) pts.set(`${x + dx},${y + dy},${z + dz}`, [x + dx, y + dy, z + dz]);
    }
    return [...pts.values()];
  }

  function distanceFor(yaw, centred) {
    const { fwd, right, up } = cameraBasis(yaw);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2) * 0.8);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.97;
    const p = new THREE.Vector3();
    // How far to slide sideways: halfway between the outline's left and right edges, as seen
    // along the line of sight.
    let off = 0;
    if (centred) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const q of current.fitPts) {
        p.set(q[0], q[1], q[2]).sub(view.center);
        lo = Math.min(lo, p.dot(right));
        hi = Math.max(hi, p.dot(right));
      }
      off = (lo + hi) / 2;
    }
    let d = 4;
    for (const q of current.fitPts) {
      p.set(q[0], q[1], q[2]).sub(view.center);
      const depth = p.dot(fwd);
      d = Math.max(d, Math.abs(p.dot(right) - off) / tanH - depth, Math.abs(p.dot(up)) / tanV - depth);
    }
    return { d, off };
  }

  const lookAt = new THREE.Vector3();
  function placeCamera() {
    const { fwd, right } = cameraBasis(view.yaw);
    lookAt.copy(view.center).addScaledVector(right, view.shift);
    camera.position.copy(lookAt).addScaledVector(fwd, -view.distance);
    camera.lookAt(lookAt.x, lookAt.y - 0.15, lookAt.z);
  }

  const tmpQ = new THREE.Quaternion();
  const tmpAxis = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  // Hint power-up: a big arrow lying over the machine, pointing the way to tilt. It lives in
  // machine coordinates, so it stays right when the view is turned.
  function showHintArrow(dir, seconds) {
    if (!current) return;
    clearHint();
    const { min, max } = current.track.bounds;
    const length = Math.min(2.2, Math.max(1.3, Math.min(max[0] - min[0], max[2] - min[2]) * 0.45));
    const w = 0.15;
    const head = 0.48;
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, -w);
    shape.lineTo(length / 2 - head, -w);
    shape.lineTo(length / 2 - head, -w * 2.6);
    shape.lineTo(length / 2, 0);
    shape.lineTo(length / 2 - head, w * 2.6);
    shape.lineTo(length / 2 - head, w);
    shape.lineTo(-length / 2, w);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const group = new THREE.Group();
    const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }));
    back.scale.setScalar(1.16);
    const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1f7c80, transparent: true, opacity: 0.95, depthTest: false }));
    front.position.y = 0.01;
    back.renderOrder = 20;
    front.renderOrder = 21;
    group.add(back, front);
    const [dx, dz] = directionVector(dir);
    group.rotation.y = Math.atan2(-dz, dx);
    group.position.set((min[0] + max[0]) / 2, max[1] + 0.5, (min[2] + max[2]) / 2);
    content.add(group);
    current.hint = { group, mats: [back.material, front.material], geo, left: seconds, total: seconds };
  }

  // The Hint's marble: a ring around the marble to move, a trail of dots along the way this
  // move rolls it, and a faint copy of it where it stops.
  function showMarbleHint(index, path, seconds) {
    if (!current || path.length < 2) return;
    clearTrail();
    const group = new THREE.Group();
    const mats = [];
    const geos = [];
    const mat = (m) => (mats.push(m), m);
    const geo = (g) => (geos.push(g), g);
    const lift = (p) => new THREE.Vector3(p[0], p[1] + MARBLE_LIFT, p[2]);
    const ringGeo = geo(new THREE.TorusGeometry(MARBLE_VIEW_R + 0.11, 0.032, 8, 40));
    const ring = new THREE.Mesh(ringGeo, mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false })));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(lift(path[0]));
    ring.renderOrder = 23;
    group.add(ring);
    // Dots every 0.2 blocks along the way (none across a jump through a portal).
    const dotGeo = geo(new THREE.SphereGeometry(0.05, 10, 8));
    const dotMat = mat(new THREE.MeshBasicMaterial({ color: 0x22c3b8, transparent: true, depthTest: false }));
    const dots = [];
    let carry = 0.2;
    for (let i = 1; i < path.length; i++) {
      const a = lift(path[i - 1]);
      const b = lift(path[i]);
      const d = a.distanceTo(b);
      if (d > 0.6) continue;
      for (; carry <= d; carry += 0.2) {
        const dot = new THREE.Mesh(dotGeo, dotMat.clone());
        mats.push(dot.material);
        dot.position.lerpVectors(a, b, carry / d);
        dot.renderOrder = 22;
        group.add(dot);
        dots.push(dot);
      }
      carry -= d;
    }
    const color = MARBLE_COLORS[current.track.starts[index]?.color] ?? 0xffffff;
    const ghost = new THREE.Mesh(marbleGeo, mat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthTest: false })));
    ghost.position.copy(lift(path.at(-1)));
    ghost.renderOrder = 22;
    const endRing = new THREE.Mesh(ringGeo, mat(new THREE.MeshBasicMaterial({ color: 0x22c3b8, transparent: true, depthTest: false })));
    endRing.rotation.x = Math.PI / 2;
    endRing.position.copy(ghost.position);
    endRing.renderOrder = 23;
    group.add(ghost, endRing);
    content.add(group);
    current.trail = { group, ring, endRing, ghost, dots, mats, geos, left: seconds, total: seconds };
  }

  function clearTrail() {
    const t = current?.trail;
    if (!t) return;
    content.remove(t.group);
    t.geos.forEach((g) => g.dispose());
    t.mats.forEach((m) => m.dispose());
    current.trail = null;
  }

  function clearHint() {
    clearTrail();
    const h = current?.hint;
    if (!h) return;
    content.remove(h.group);
    h.geo.dispose();
    h.mats.forEach((m) => m.dispose());
    current.hint = null;
  }

  // A marble that tried to roll down a stairway: a red ring pulses out from it.
  function nope(index) {
    const vis = current?.marbles[index];
    if (!vis || current.nopes.some((n) => n.index === index && n.age < 0.4)) return;
    const ring = new THREE.Mesh(nopeGeo, new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, depthTest: false }));
    ring.renderOrder = 16;
    ring.position.copy(vis.mesh.position);
    content.add(ring);
    current.nopes.push({ index, ring, age: 0 });
  }

  function updateEffects(sim, dt) {
    // Stairways: a light runs up the chevrons, tread by tread.
    for (const { group, k } of current.stairs) {
      const phase = reducedMotion ? 0.5 : (((clock * 1.3 - k / STEPS) % 1) + 1) % 1;
      const glow = reducedMotion ? 0.9 : 0.4 + 0.6 * (1 - phase) ** 2;
      group.children.forEach((c) => (c.material.opacity = glow));
      group.scale.setScalar(reducedMotion ? 1.15 : 1.05 + 0.15 * (1 - phase) ** 2);
    }
    current.nopes = current.nopes.filter((n) => {
      n.age += dt;
      const p = n.age / 0.55;
      if (p >= 1) {
        content.remove(n.ring);
        n.ring.material.dispose();
        return false;
      }
      n.ring.position.copy(current.marbles[n.index].mesh.position);
      n.ring.position.y -= MARBLE_VIEW_R - 0.02;
      n.ring.scale.setScalar(0.8 + 1.4 * p);
      n.ring.material.opacity = 0.95 * (1 - p);
      return true;
    });
    const t = current.trail;
    if (t) {
      t.left -= dt;
      if (t.left <= 0) clearTrail();
      else {
        const fade = Math.min(1, t.left / 0.4, (t.total - t.left) / 0.2);
        const beat = reducedMotion ? 1 : 1 + 0.12 * Math.sin(clock * 7);
        t.ring.scale.setScalar(beat);
        t.endRing.scale.setScalar(2 - beat);
        t.ring.material.opacity = fade;
        t.endRing.material.opacity = 0.9 * fade;
        t.ghost.material.opacity = 0.5 * fade;
        // A wave runs along the dots from the marble to where it stops.
        const n = t.dots.length;
        t.dots.forEach((d, i) => {
          const wave = reducedMotion ? 0.8 : 0.45 + 0.55 * Math.max(0, Math.sin(clock * 6 - (i / Math.max(1, n)) * 6));
          d.material.opacity = fade * wave;
        });
      }
    }
    const h = current.hint;
    if (h) {
      h.left -= dt;
      if (h.left <= 0) clearHint();
      else {
        const fade = Math.min(1, h.left / 0.4, (h.total - h.left) / 0.2);
        const beat = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(clock * 7);
        h.mats[1].opacity = 0.75 * fade * beat;
        h.mats[0].opacity = 0.7 * fade;
        h.group.position.y = current.track.bounds.max[1] + 0.5 + (reducedMotion ? 0 : 0.06 * Math.sin(clock * 4));
      }
    }
    // Magnetic Pull: a soft gold ring around the chosen marble, with a slow ripple.
    sim.marbles.forEach((m, i) => {
      const vis = current.marbles[i];
      if (m.magnet && !vis.halo) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(MARBLE_VIEW_R + 0.13, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.95, depthTest: false }));
        const ripple = new THREE.Mesh(ring.geometry, new THREE.MeshBasicMaterial({ color: 0xfff1c2, transparent: true, opacity: 0.6, depthTest: false }));
        ring.rotation.x = ripple.rotation.x = Math.PI / 2;
        ring.renderOrder = ripple.renderOrder = 15;
        vis.halo = { ring, ripple };
        content.add(ring, ripple);
      }
      if (!vis.halo) return;
      vis.halo.ring.visible = vis.halo.ripple.visible = Boolean(m.magnet);
      if (!m.magnet) return;
      const p = vis.mesh.position;
      vis.halo.ring.position.set(p.x, p.y, p.z);
      vis.halo.ripple.position.copy(vis.halo.ring.position);
      const phase = reducedMotion ? 0.3 : (clock * 0.9) % 1;
      vis.halo.ripple.scale.setScalar(1 + phase * 1.3);
      vis.halo.ripple.material.opacity = 0.65 * (1 - phase);
    });

    // Speed Boost: a warm glow on every marble, and a flickering lightning bolt under it,
    // pointing the way it rolls.
    const boosted = (sim.speedScale || 1) > 1;
    sim.marbles.forEach((m, i) => {
      const vis = current.marbles[i];
      const mat = vis.mesh.material;
      const on = boosted && !m.delivered && !m.lost;
      const target = on ? 0.25 + (reducedMotion ? 0 : 0.1 * Math.sin(clock * 9 + i)) : 0;
      mat.emissive.setHex(0xff7a2e);
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 10);
      if (on && !vis.bolt) {
        // A bright yellow bolt with an orange rim, so it reads on pale wood too.
        const flat = (color, order) => {
          const mesh = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
          mesh.renderOrder = order;
          return mesh;
        };
        const rim = flat(0xff5a00, 5);
        rim.scale.setScalar(1.28);
        const fill = flat(0xffe600, 6);
        fill.position.y = 0.002;
        vis.bolt = new THREE.Group();
        vis.bolt.add(rim, fill);
        content.add(vis.bolt);
      }
      if (!vis.bolt) return;
      vis.bolt.visible = on;
      if (!on) return;
      const p = vis.mesh.position;
      vis.bolt.position.set(p.x, p.y - MARBLE_VIEW_R + 0.012, p.z);
      const dir = m.v >= 0 ? m.tangent : m.tangent.map((v) => -v);
      vis.bolt.rotation.set(0, Math.atan2(-dir[2], dir[0]), 0);
      const flick = reducedMotion ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(clock * 17 + i * 1.7));
      vis.bolt.scale.setScalar(flick * (0.8 + Math.min(0.5, Math.abs(m.v) * 0.12)));
      vis.bolt.children.forEach((c) => (c.material.opacity = 0.65 + 0.35 * flick));
    });
  }

  // Bring the scene up to date with the simulation.
  function sync(sim, tiltVec, dt) {
    if (!current) return;
    clock += dt;
    updateEffects(sim, dt);
    const { axis, angle } = machineRotation(tiltVec);
    pivot.quaternion.setFromAxisAngle(tmpAxis.set(axis[0], axis[1], axis[2]).normalize(), angle);

    if (current.sim !== sim) {
      // A new attempt: forget the last one's falls and jumps.
      current.sim = sim;
      for (const vis of current.marbles) Object.assign(vis, { simPos: null, lag: 0, lagV: 0, fallV: 0, pop: 0 });
    }
    sim.marbles.forEach((m, i) => {
      const vis = current.marbles[i];
      if (m.lost) {
        // Fell off a sky rail with nothing below: it drops out of sight.
        vis.fallV += 9 * dt;
        vis.mesh.position.y -= vis.fallV * dt;
        vis.mesh.visible = vis.mesh.position.y > current.track.bounds.min[1] - 4;
        vis.ghost.visible = false;
        return;
      }
      vis.mesh.visible = true;
      const edge = current.track.edges[m.edge];
      let y = m.pos[1] + MARBLE_LIFT;
      if (edge.lift) y += stairRise(m.s / edge.L) - m.s / edge.L; // up the treads, not the slope
      if (edge.whirl) {
        // On the funnel's drawn surface, sinking into the hole at the end.
        const w = edge.whirl;
        const r = Math.hypot(m.pos[0] - w.x, m.pos[2] - w.z);
        y = Math.max(m.pos[1] + MARBLE_LIFT, funnelFloor(r, w.y) + MARBLE_VIEW_R - (r < 0.15 ? (0.15 - r) * 3 : 0));
      }
      // The simulation jumps when a marble drops off a sky rail or goes through a portal;
      // the picture follows: a quick fall, or a pop out of the far portal.
      if (vis.simPos) {
        const horiz = Math.hypot(m.pos[0] - vis.simPos[0], m.pos[2] - vis.simPos[2]);
        if (vis.simPos[1] - m.pos[1] > 0.45 && horiz < 0.3) {
          vis.lag += vis.simPos[1] - m.pos[1];
          vis.lagV = 0;
        }
        if (horiz > 0.6) vis.pop = 1;
      }
      vis.simPos = [...m.pos];
      if (vis.lag > 0) {
        vis.lagV += 14 * dt;
        vis.lag = Math.max(0, vis.lag - vis.lagV * dt);
      }
      vis.pop = Math.max(0, vis.pop - dt * 3);
      vis.mesh.scale.setScalar(1 + 0.45 * vis.pop);
      vis.prev.copy(vis.mesh.position);
      vis.mesh.position.set(m.pos[0], y + vis.lag, m.pos[2]);
      const moved = vis.placed ? vis.mesh.position.distanceTo(vis.prev) : 0;
      vis.placed = true;
      if (moved > 1e-5 && moved < 1) {
        tmpDir.copy(vis.mesh.position).sub(vis.prev).normalize();
        tmpAxis.set(tmpDir.z, 0, -tmpDir.x);
        if (tmpAxis.lengthSq() > 0.25) {
          tmpQ.setFromAxisAngle(tmpAxis.normalize(), moved / MARBLE_VIEW_R);
          vis.mesh.quaternion.premultiply(tmpQ);
        }
      }
      vis.ghost.position.copy(vis.mesh.position);
      vis.ghost.visible = !m.delivered && current.inTunnel(m.pos);
    });

    for (const p of current.portals) {
      p.swirl.rotation.y -= dt * (reducedMotion ? 0.4 : 2.2);
      p.pad.rotation.z += dt * (reducedMotion ? 0.4 : 2.4);
    }
    const ease = (rate) => Math.min(1, dt * rate);
    sim.goals.forEach((g, i) => {
      const mat = current.goals[i].mat;
      mat.emissiveIntensity += ((g.filled ? 1.2 : 0.05) - mat.emissiveIntensity) * ease(6);
    });
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 3.2);
    sim.plates.forEach((p, i) => {
      const vis = current.plates[i];
      vis.disc.position.y += ((p.pressed ? vis.baseY - 0.018 : vis.baseY) - vis.disc.position.y) * ease(14);
      vis.ringMat.emissiveIntensity = p.pressed ? 0.9 : 0.15 + 0.4 * pulse;
      vis.topMat.emissiveIntensity = p.pressed ? 0.45 : 0.04 + 0.12 * pulse;
    });
    sim.gates.forEach((g, i) => {
      const vis = current.gates[i];
      vis.y += ((g.open ? vis.openY : vis.closedY) - vis.y) * ease(12);
      vis.slab.position.y = vis.y;
    });
    for (const c of current.cables) {
      // The cable lights up while its plate or goal is powering it: that opens a gate
      // and shuts a shutter.
      const gate = sim.gates[c.gate];
      const powered = gate.powered ?? gate.open !== c.inverse;
      const glow = powered ? 0.55 : 0;
      c.mat.emissiveIntensity += (glow - c.mat.emissiveIntensity) * ease(8);
      for (const m of c.posts) m.emissiveIntensity = c.mat.emissiveIntensity * 0.6;
      c.beads.forEach((bead, k) => {
        bead.visible = powered;
        if (powered) bead.position.copy(c.curve.getPointAt((clock * 0.45 + k / 3) % 1));
      });
    }
  }

  // Lower the render resolution (down to minRatio) if the device can't keep up, so the tilt
  // stays smooth. The first frames after a level is built compile shaders and upload
  // textures, so they are always slow and don't count; it takes two slow stretches in a row
  // to step down.
  const perf = { time: 0, frames: 0, ignore: 120, slow: 0 };
  function adaptResolution(dt) {
    if (perf.ignore > 0) {
      perf.ignore--;
      return;
    }
    perf.time += dt;
    perf.frames++;
    if (perf.frames < 90) return;
    const avg = perf.time / perf.frames;
    perf.time = 0;
    perf.frames = 0;
    perf.slow = avg > 1 / 40 ? perf.slow + 1 : 0;
    if (perf.slow >= 2 && pixelRatio > minRatio) {
      pixelRatio = Math.max(minRatio, pixelRatio - 0.5);
      perf.slow = 0;
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
  }

  // The machine springs into place (on the home screen, after a win).
  let popT = 1;
  function popIn() {
    popT = 0;
  }
  function animatePop(dt) {
    if (!pivot || popT >= 1) return;
    popT = Math.min(1, popT + dt / 0.75);
    const k = popT - 1; // ease out with a little overshoot
    pivot.scale.setScalar(Math.max(0.01, 1 + 2.70158 * k ** 3 + 1.70158 * k ** 2));
  }

  function frame(dt) {
    // Any resolution change happens before drawing: resizing clears the canvas, and doing
    // it after a render would show one empty frame.
    adaptResolution(dt);
    animatePop(dt);
    if (view.spin) {
      view.targetYaw += dt * 0.22;
      view.yaw = view.targetYaw;
    } else {
      view.yaw += (view.targetYaw - view.yaw) * Math.min(1, dt * 9);
    }
    view.distance += (view.targetDistance - view.distance) * Math.min(1, dt * 5);
    view.shift += (view.targetShift - view.shift) * Math.min(1, dt * 5);
    placeCamera();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }

  function orbit(steps) {
    view.targetYaw += (steps * Math.PI) / 2;
    fitCamera();
  }

  // Slowly circle the machine (home screen); when stopped, glide back to the default view.
  function setSpin(on) {
    if (on === view.spin) return;
    view.spin = on;
    if (!on) {
      const turns = Math.round((view.yaw - DEFAULT_YAW) / (2 * Math.PI));
      view.targetYaw = DEFAULT_YAW + turns * 2 * Math.PI;
    }
    fitCamera();
  }

  // Turn a screen drag (pixels, y down) into a direction on the machine's ground plane.
  function screenToGround(dx, dy) {
    const { fwd, right } = cameraBasis(view.yaw);
    const f = new THREE.Vector2(fwd.x, fwd.z).normalize();
    const r = new THREE.Vector2(right.x, right.z).normalize();
    return [dx * r.x - dy * f.x, dx * r.y - dy * f.y];
  }

  // Camera state and which marble outlines are showing, for automated checks.
  const debug = () => ({
    yaw: view.yaw,
    distance: view.distance,
    outlines: current ? current.marbles.map((m) => m.ghost.visible) : [],
  });

  return { build, sync, frame, resize, orbit, setSpin, popIn, screenToGround, showHintArrow, showMarbleHint, clearHint, nope, renderer, debug };
}
