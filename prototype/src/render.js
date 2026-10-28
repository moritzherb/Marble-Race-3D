// Draws the machine with three.js. Everything is built from the same track data the
// physics uses, so what you see is exactly what the marbles ride on.

import * as THREE from './three.js';
import { RAIL_Y, pieceCells } from './pieces.js';
import { sampleEdge } from './track.js';
import { machineRotation } from './tilt.js';

export const MARBLE_COLORS = {
  blue: 0x2f6fe4,
  orange: 0xf28a1d,
  green: 0x1fa463,
  purple: 0x8b55d9,
  red: 0xe0453a,
};
const LINK_COLORS = { A: 0xc9a23a, B: 0x5d6470, C: 0xb0b8c4 };
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
const MARBLE_VIEW_R = 0.17; // drawn a little larger than the physics radius
const MARBLE_LIFT = FLOOR + MARBLE_VIEW_R; // so it rests on the groove floor
const RIM_RADIUS = 0.255; // coloured ring around a goal or plate cup
const DEFAULT_YAW = (-24 * Math.PI) / 180;
const POST_OFFSET = 0.38; // how far beside the groove a cable post stands
const TUNNEL_RADIUS = 0.23; // arch cut through a block that sits on top of a groove
const TUNNEL_UNDER = new Set(['straight', 'gate', 'end', 'goal', 'plate']); // grooves an arch can follow
const POST_HEIGHT = 0.32;


function woodTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
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
  tex.anisotropy = 4;
  return tex;
}

function marbleTexture(hex) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = `#${new THREE.Color(hex).getHexString()}`;
  g.fillRect(0, 0, 128, 64);
  // A pale band around the equator so you can see the marble roll.
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, 28, 128, 8);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++) g.fillRect(i * 22 + 4, 10, 6, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A bullseye on the plate's face, so it reads as "roll a marble here".
function plateTexture(link) {
  const [light, rim, dark] = PLATE_FACES[link] || PLATE_FACES.A;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
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
  return tex;
}

// Red and white warning stripes for shutters, the gates that shut when their link is powered.
function shutterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
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
  return tex;
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
  for (const id of piece.edges) {
    const pts = track.edges[id].pts;
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i][0], pts[i][2], pts[i][1], pts[i + 1][0], pts[i + 1][2], pts[i + 1][1]]);
  }
  const cups = piece.type === 'goal' || piece.type === 'plate' ? piece.edges.map((id) => track.edges[id].pts.at(-1)) : [];
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
        railY = ay + (by - ay) * t;
      }
    }
    let cut = dist < CHANNEL_HALF ? Math.sqrt(1 - (dist / CHANNEL_HALF) ** 2) : 0;
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
  const nx = Math.max(2, Math.round((x1 - x0) * CARVE_STEPS));
  const nz = Math.max(2, Math.round((z1 - z0) * CARVE_STEPS));
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
  const maxRatio = Math.min(window.devicePixelRatio || 1, 2);
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
  const smallScreen = Math.min(window.screen?.width || 1000, window.screen?.height || 1000) < 900;
  sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
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
  const shutterTex = shutterTexture();
  const shutterRed = new THREE.MeshStandardMaterial({ color: 0xd8352a, roughness: 0.5 });
  const shared = new Set([cubeGeo, archGeo, archUnderCarvedGeo, liningGeo, shadeGeo, marbleGeo, postGeo, knobGeo, beadGeo]);

  let pivot = null; // tilts around the machine's centre
  let content = null; // machine coordinates live here
  let current = null; // per-level objects
  let clock = 0;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const view = { yaw: DEFAULT_YAW, targetYaw: DEFAULT_YAW, pitch: (50 * Math.PI) / 180, distance: 12, targetDistance: 12, center: new THREE.Vector3(), spin: false };

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
    if (piece.type === 'ramp') return null;
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
    for (const piece of track.pieces) {
      const mat = (piece.anchor[0] * 7 + piece.anchor[1] * 3 + piece.anchor[2] * 5 + n++) % woodMats.length;
      const grooved = piece.edges.length > 0;
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
      const key = `c${mat}`;
      if (!groups.has(key)) groups.set(key, { geo: cubeGeo, mat: woodMats[mat], list: [] });
      const m = new THREE.Matrix4().makeRotationY((-piece.r * Math.PI) / 2);
      m.setPosition(piece.anchor[0] + 0.5, piece.anchor[1], piece.anchor[2] + 0.5);
      groups.get(key).list.push(m);
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

  function build(track) {
    clearLevel();
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

    // Cells with a different block directly on top are tunnels: only there is a marble
    // hidden from every angle, so only there does its outline show through the wood.
    const inTunnel = (pos) => {
      const x = Math.floor(pos[0]);
      const y = Math.floor(pos[1]);
      const z = Math.floor(pos[2]);
      const here = owner.get(`${x},${y},${z}`);
      const above = owner.get(`${x},${y + 1},${z}`);
      return here !== undefined && above !== undefined && above !== here;
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
      return { mesh, ghost, prev: new THREE.Vector3(), placed: false };
    });

    // Light and shadow sized to the machine.
    const size = Math.max(max[0] - min[0], max[2] - min[2], max[1] - min[1]) + 2;
    sun.position.set(center.x - size * 0.6, center.y + size * 1.4, center.z - size * 0.35);
    sun.target.position.copy(center);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -size;
    cam.right = cam.top = size;
    cam.near = 0.5;
    cam.far = size * 4;
    cam.updateProjectionMatrix();

    current = { track, goals, plates, gates, cables, marbles, inTunnel };
    fitCamera();
    view.distance = view.targetDistance;
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
  function fitCamera() {
    if (!current) return;
    let d = distanceFor(view.targetYaw);
    if (view.spin) for (let k = 0; k < 24; k++) d = Math.max(d, distanceFor(view.yaw + (k * Math.PI) / 12));
    view.targetDistance = d;
  }

  function distanceFor(yaw) {
    const { min, max } = current.track.bounds;
    const { fwd, right, up } = cameraBasis(yaw);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2) * 0.8);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.96;
    let d = 4;
    const pad = 0.25;
    const p = new THREE.Vector3();
    for (const x of [min[0] - pad, max[0] + pad]) {
      for (const y of [min[1], max[1] + 0.4]) {
        for (const z of [min[2] - pad, max[2] + pad]) {
          p.set(x, y, z).sub(view.center);
          const depth = p.dot(fwd);
          d = Math.max(d, Math.abs(p.dot(right)) / tanH - depth, Math.abs(p.dot(up)) / tanV - depth);
        }
      }
    }
    return d;
  }

  function placeCamera() {
    const { fwd } = cameraBasis(view.yaw);
    camera.position.copy(view.center).addScaledVector(fwd, -view.distance);
    camera.lookAt(view.center.x, view.center.y - 0.15, view.center.z);
  }

  const tmpQ = new THREE.Quaternion();
  const tmpAxis = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  // Bring the scene up to date with the simulation.
  function sync(sim, tiltVec, dt) {
    if (!current) return;
    clock += dt;
    const { axis, angle } = machineRotation(tiltVec);
    pivot.quaternion.setFromAxisAngle(tmpAxis.set(axis[0], axis[1], axis[2]).normalize(), angle);

    sim.marbles.forEach((m, i) => {
      const vis = current.marbles[i];
      vis.prev.copy(vis.mesh.position);
      vis.mesh.position.set(m.pos[0], m.pos[1] + MARBLE_LIFT, m.pos[2]);
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
      const powered = sim.gates[c.gate].open !== c.inverse;
      const glow = powered ? 0.55 : 0;
      c.mat.emissiveIntensity += (glow - c.mat.emissiveIntensity) * ease(8);
      for (const m of c.posts) m.emissiveIntensity = c.mat.emissiveIntensity * 0.6;
      c.beads.forEach((bead, k) => {
        bead.visible = powered;
        if (powered) bead.position.copy(c.curve.getPointAt((clock * 0.45 + k / 3) % 1));
      });
    }
  }

  // Lower the render resolution if the device can't keep up, so the tilt stays smooth.
  const perf = { time: 0, frames: 0 };
  function adaptResolution(dt) {
    perf.time += dt;
    perf.frames++;
    if (perf.frames < 90) return;
    const avg = perf.time / perf.frames;
    perf.time = 0;
    perf.frames = 0;
    if (avg > 1 / 42 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
  }

  function frame(dt) {
    // Any resolution change happens before drawing: resizing clears the canvas, and doing
    // it after a render would show one empty frame.
    adaptResolution(dt);
    if (view.spin) {
      view.targetYaw += dt * 0.22;
      view.yaw = view.targetYaw;
    } else {
      view.yaw += (view.targetYaw - view.yaw) * Math.min(1, dt * 9);
    }
    view.distance += (view.targetDistance - view.distance) * Math.min(1, dt * 5);
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

  return { build, sync, frame, resize, orbit, setSpin, screenToGround, renderer, debug };
}
