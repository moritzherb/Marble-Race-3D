// Draws the machine with three.js. Everything is built from the same track data the
// physics uses, so what you see is exactly what the marbles ride on.

import * as THREE from './three.js';
import { GROOVE_DEPTH_OFFSET } from './pieces.js';
import { sampleEdge, tangentAwayFrom } from './track.js';
import { machineRotation } from './tilt.js';

export const MARBLE_COLORS = {
  blue: 0x2f6fe4,
  orange: 0xf28a1d,
  green: 0x1fa463,
  purple: 0x8b55d9,
  red: 0xe0453a,
};
const LINK_COLORS = { A: 0xc9a23a, B: 0x5d6470, C: 0xb0b8c4 };

const BLOCK_INSET = 0.0125; // half the gap between neighbouring blocks
const TOP = 1 - 2 * BLOCK_INSET * 0.6; // block top, a hair under the cell top
const GROOVE_LIFT = TOP - (1 - GROOVE_DEPTH_OFFSET) + 0.004; // rail -> visible groove surface
const GROOVE_HALF_WIDTH = 0.17;
const MARBLE_VIEW_R = 0.17; // drawn a little larger than the physics radius
const MARBLE_LIFT = 0.06; // and sitting higher in the groove, so more of it shows
const DEFAULT_YAW = (-24 * Math.PI) / 180;
const POST_OFFSET = 0.31; // how far beside the groove a cable post stands
const POST_HEIGHT = 0.32;

// Groove shading: dark where the channel meets the block top, light along the middle.
const SHADE_EDGE = [0.42, 0.3, 0.19];
const SHADE_MID = [0.74, 0.57, 0.4];

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

function wedgeGeometry() {
  // Ramp block over two cells: x from -0.5 to 1.5, top sloping from 2 tiers down to 1.
  const x0 = -0.5 + BLOCK_INSET;
  const x1 = 1.5 - BLOCK_INSET;
  const z0 = -0.5 + BLOCK_INSET;
  const z1 = 0.5 - BLOCK_INSET;
  const yHi = 1 + TOP;
  const yLo = TOP;
  const v = {
    a: [x0, 0, z0], b: [x1, 0, z0], c: [x1, 0, z1], d: [x0, 0, z1],
    e: [x0, yHi, z0], f: [x1, yLo, z0], g: [x1, yLo, z1], h: [x0, yHi, z1],
  };
  const quads = [
    ['a', 'b', 'c', 'd', 'xz'], // bottom
    ['h', 'g', 'f', 'e', 'xz'], // sloped top
    ['a', 'd', 'h', 'e', 'zy'], // west
    ['b', 'f', 'g', 'c', 'zy'], // east
    ['a', 'e', 'f', 'b', 'xy'], // north
    ['d', 'c', 'g', 'h', 'xy'], // south
  ];
  const pos = [];
  const uv = [];
  const uvOf = (p, mode) => (mode === 'xz' ? [p[0], p[2]] : mode === 'zy' ? [p[2], p[1]] : [p[0], p[1]]);
  for (const [p, q, r, s, mode] of quads) {
    for (const k of [p, q, r, p, r, s]) {
      pos.push(...v[k]);
      uv.push(...uvOf(v[k], mode));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

// Part of a polyline, from distance `from` to distance `to` along it.
function slice(pts, from, to) {
  const out = [];
  let run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const lerp = (d) => {
      const f = Math.min(1, Math.max(0, (d - run) / (seg || 1)));
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
    if (run + seg > from + 1e-6 && run < to - 1e-6) {
      if (out.length === 0) out.push(lerp(Math.max(from, run)));
      out.push(lerp(Math.min(to, run + seg)));
    }
    run += seg;
  }
  return out;
}

function sideOf(t) {
  if (Math.abs(t[0]) > Math.abs(t[2])) return t[0] > 0 ? 'E' : 'W';
  return t[2] > 0 ? 'S' : 'N';
}

// All grooves of a machine as one carved surface. Where grooves meet (T-junctions and
// crossings) a shared floor patch is drawn instead of overlapping strips, so the
// channels merge like real carving; open sides of a junction keep their wall shading.
function grooveGeometry(track) {
  const pos = [];
  const col = [];
  const uv = [];
  const index = [];
  const h = GROOVE_HALF_WIDTH;
  const vert = (x, y, z, c) => {
    pos.push(x, y, z);
    col.push(...c);
    uv.push(x * 0.8, z * 0.8);
    return pos.length / 3 - 1;
  };

  function strip(points) {
    if (points.length < 2) return;
    let prev = null;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const q = points[Math.min(i + 1, points.length - 1)];
      const o = points[Math.max(i - 1, 0)];
      const dl = Math.hypot(q[0] - o[0], q[2] - o[2]) || 1;
      const sx = (-(q[2] - o[2]) / dl) * h;
      const sz = ((q[0] - o[0]) / dl) * h;
      const y = p[1] + GROOVE_LIFT;
      const row = [vert(p[0] + sx, y, p[2] + sz, SHADE_EDGE), vert(p[0], y, p[2], SHADE_MID), vert(p[0] - sx, y, p[2] - sz, SHADE_EDGE)];
      if (prev) {
        const [a, a1, a2] = prev;
        const [b, b1, b2] = row;
        index.push(a, b, a1, a1, b, b1, a1, b1, a2, a2, b1, b2);
      }
      prev = row;
    }
  }

  // A 3×3 grid of vertices over the junction square. Corners are always edge-dark;
  // a side's middle is light where a groove leaves through it and dark where it is wall.
  function patch(c, arms) {
    const y = c[1] + GROOVE_LIFT;
    const ids = {};
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        let shade = SHADE_MID;
        if (i !== 0 && j !== 0) shade = SHADE_EDGE;
        else if (i !== 0 || j !== 0) {
          const side = i === 1 ? 'E' : i === -1 ? 'W' : j === 1 ? 'S' : 'N';
          shade = arms.has(side) ? SHADE_MID : SHADE_EDGE;
        }
        ids[`${i},${j}`] = vert(c[0] + i * h, y, c[2] + j * h, shade);
      }
    }
    for (const [i0, j0] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      const a = ids[`${i0},${j0}`];
      const b = ids[`${i0},${j0 + 1}`];
      const c2 = ids[`${i0 + 1},${j0 + 1}`];
      const d = ids[`${i0 + 1},${j0}`];
      index.push(a, b, c2, a, c2, d);
    }
  }

  // A half-disc closing a dead end, shaded to continue the strip it ends.
  function cap(p, dirIn) {
    const y = p[1] + GROOVE_LIFT;
    const centre = vert(p[0], y, p[2], SHADE_MID);
    const side = [-dirIn[2], dirIn[0]];
    const rim = [];
    for (let k = 0; k <= 12; k++) {
      const a = -Math.PI / 2 + (Math.PI * k) / 12;
      const dx = dirIn[0] * Math.cos(a) + side[0] * Math.sin(a);
      const dz = dirIn[2] * Math.cos(a) + side[1] * Math.sin(a);
      rim.push(vert(p[0] + dx * h, y, p[2] + dz * h, SHADE_EDGE));
    }
    for (let k = 0; k < rim.length - 1; k++) index.push(centre, rim[k + 1], rim[k]);
  }

  const crossings = new Set(track.pieces.filter((p) => p.type === 'cross').map((p) => p.index));
  const crossCentres = new Map();
  for (const edge of track.edges) {
    const deg0 = track.nodes[edge.n0].links.length;
    const deg1 = track.nodes[edge.n1].links.length;
    if (crossings.has(edge.piece)) {
      strip(slice(edge.pts, 0, edge.L / 2 - h));
      strip(slice(edge.pts, edge.L / 2 + h, edge.L));
      crossCentres.set(edge.piece, sampleEdge(edge, edge.L / 2).pos);
    } else {
      strip(slice(edge.pts, deg0 >= 3 ? h : 0, edge.L - (deg1 >= 3 ? h : 0)));
    }
    for (const [end, deg] of [[0, deg0], [1, deg1]]) {
      if (deg !== 1) continue;
      const away = tangentAwayFrom(edge, end);
      cap(end === 0 ? edge.pts[0] : edge.pts[edge.pts.length - 1], [-away[0], 0, -away[2]]);
    }
  }
  for (const node of track.nodes) {
    if (node.links.length < 3) continue;
    patch(node.pos, new Set(node.links.map((l) => sideOf(tangentAwayFrom(track.edges[l.edge], l.end)))));
  }
  for (const c of crossCentres.values()) patch(c, new Set(['E', 'W', 'N', 'S']));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
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
  const grooveMat = new THREE.MeshStandardMaterial({
    map: woodTexture(9),
    vertexColors: true,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const cubeGeo = new THREE.BoxGeometry(1 - 2 * BLOCK_INSET, TOP, 1 - 2 * BLOCK_INSET);
  cubeGeo.translate(0, TOP / 2, 0);
  const wedgeGeo = wedgeGeometry();
  const marbleGeo = new THREE.SphereGeometry(MARBLE_VIEW_R, 32, 18);
  const postGeo = new THREE.CylinderGeometry(0.026, 0.036, POST_HEIGHT, 10);
  postGeo.translate(0, POST_HEIGHT / 2, 0);
  const knobGeo = new THREE.SphereGeometry(0.05, 14, 10);
  const beadGeo = new THREE.SphereGeometry(0.03, 10, 8);
  const shared = new Set([cubeGeo, wedgeGeo, marbleGeo, postGeo, knobGeo, beadGeo]);

  let pivot = null; // tilts around the machine's centre
  let content = null; // machine coordinates live here
  let current = null; // per-level objects
  let clock = 0;
  const view = { yaw: DEFAULT_YAW, targetYaw: DEFAULT_YAW, pitch: (50 * Math.PI) / 180, distance: 12, center: new THREE.Vector3(), spin: false };

  function clearLevel() {
    if (!pivot) return;
    scene.remove(pivot);
    pivot.traverse((o) => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    pivot = null;
  }

  // Wood blocks: one instanced mesh per shape and wood tint keeps draw calls low.
  function addBlocks(track) {
    const groups = new Map();
    let n = 0;
    for (const piece of track.pieces) {
      const wedge = piece.type === 'ramp';
      const mat = (piece.anchor[0] * 7 + piece.anchor[1] * 3 + piece.anchor[2] * 5 + n++) % woodMats.length;
      const key = `${wedge ? 'w' : 'c'}${mat}`;
      if (!groups.has(key)) groups.set(key, { geo: wedge ? wedgeGeo : cubeGeo, mat: woodMats[mat], list: [] });
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
  }

  // A brass post standing on the block top beside a groove, on the side facing `towards`.
  function addPost(surface, tangent, towards, color) {
    const side = new THREE.Vector3(-tangent[2], 0, tangent[0]).normalize();
    const a = surface.clone().addScaledVector(side, POST_OFFSET);
    const b = surface.clone().addScaledVector(side, -POST_OFFSET);
    const base = a.distanceToSquared(towards) <= b.distanceToSquared(towards) ? a : b;
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.3, emissive: color, emissiveIntensity: 0 });
    const post = new THREE.Mesh(postGeo, mat);
    post.position.copy(base);
    post.castShadow = true;
    const knob = new THREE.Mesh(knobGeo, mat);
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

    addBlocks(track);
    const grooves = new THREE.Mesh(grooveGeometry(track), grooveMat);
    grooves.receiveShadow = true;
    content.add(grooves);

    // Goals: a coloured ring and inlay at the end of the groove.
    const goals = track.goals.map((goal) => {
      const edge = track.edges[goal.edge];
      const p = edge.pts[edge.pts.length - 1];
      const color = MARBLE_COLORS[goal.color] ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, emissive: color, emissiveIntensity: 0.05 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 32), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p[0], p[1] + GROOVE_LIFT + 0.02, p[2]);
      ring.castShadow = true;
      const inlay = new THREE.Mesh(
        new THREE.CircleGeometry(0.17, 24),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      );
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(p[0], p[1] + GROOVE_LIFT + 0.002, p[2]);
      content.add(ring, inlay);
      if (goal.link) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 8, 32), new THREE.MeshStandardMaterial({ color: LINK_COLORS[goal.link], metalness: 0.8, roughness: 0.3 }));
        band.rotation.x = -Math.PI / 2;
        band.position.copy(ring.position);
        content.add(band);
      }
      return { mat, surface: new THREE.Vector3(p[0], p[1] + GROOVE_LIFT, p[2]), tangent: sampleEdge(edge, edge.L).tangent };
    });

    // Plates: a metal disc where the marble rests.
    const plates = track.plates.map((plate) => {
      const edge = track.edges[plate.edge];
      const { pos, tangent } = sampleEdge(edge, edge.L - 0.08);
      const mat = new THREE.MeshStandardMaterial({ color: LINK_COLORS[plate.link], metalness: 0.85, roughness: 0.3, emissive: LINK_COLORS[plate.link], emissiveIntensity: 0 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28), mat);
      disc.position.set(pos[0], pos[1] + GROOVE_LIFT + 0.006, pos[2]);
      disc.receiveShadow = true;
      content.add(disc);
      return { mat, disc, baseY: disc.position.y, surface: new THREE.Vector3(pos[0], pos[1] + GROOVE_LIFT, pos[2]), tangent };
    });

    // Gates: a metal slab across the groove that sinks into the wood when open.
    const gates = track.gates.map((gate) => {
      const edge = track.edges[gate.edge];
      const { pos, tangent } = sampleEdge(edge, gate.s);
      const mat = new THREE.MeshStandardMaterial({ color: LINK_COLORS[gate.link], metalness: 0.8, roughness: 0.32 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.4), mat);
      slab.rotation.y = Math.atan2(-tangent[2], tangent[0]);
      const top = pos[1] + GROOVE_LIFT;
      slab.position.set(pos[0], top + 0.12, pos[2]);
      slab.castShadow = true;
      content.add(slab);
      return { slab, closedY: top + 0.12, openY: top - 0.2, y: top + 0.12, surface: new THREE.Vector3(pos[0], top, pos[2]), tangent };
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
      const gatePost = addPost(gates[gi].surface, gates[gi].tangent, towards, color);
      for (const src of sources) {
        const srcPost = addPost(src.surface, src.tangent, gatePost.top, color);
        const a = srcPost.top;
        const b = gatePost.top;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y = Math.max(a.y, b.y) + 0.22 + a.distanceTo(b) * 0.1;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.45, emissive: color, emissiveIntensity: 0 });
        const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.016, 6), mat);
        cable.castShadow = true;
        content.add(cable);
        const beads = [0, 1, 2].map(() => {
          const bead = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: 0xfff3cf }));
          bead.visible = false;
          content.add(bead);
          return bead;
        });
        cables.push({ gate: gi, curve, mat, beads, posts: [srcPost.mat, gatePost.mat] });
      }
    });

    // Marbles, each with an outline twin that only draws when the marble is hidden.
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

    current = { track, goals, plates, gates, cables, marbles };
    fitCamera();
  }

  function cameraBasis(yaw) {
    const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(view.pitch), -Math.sin(view.pitch), -Math.cos(yaw) * Math.cos(view.pitch));
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    return { fwd, right, up };
  }

  // Pick a camera distance so the whole machine fits, with room for the HUD.
  function fitCamera() {
    if (!current) return;
    const { min, max } = current.track.bounds;
    const { fwd, right, up } = cameraBasis(view.targetYaw);
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
    view.distance = d;
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
      vis.ghost.visible = !m.delivered;
    });

    const ease = (rate) => Math.min(1, dt * rate);
    sim.goals.forEach((g, i) => {
      const mat = current.goals[i].mat;
      mat.emissiveIntensity += ((g.filled ? 1.2 : 0.05) - mat.emissiveIntensity) * ease(6);
    });
    sim.plates.forEach((p, i) => {
      const vis = current.plates[i];
      vis.disc.position.y += ((p.pressed ? vis.baseY - 0.02 : vis.baseY) - vis.disc.position.y) * ease(14);
      vis.mat.emissiveIntensity = p.pressed ? 0.35 : 0;
    });
    sim.gates.forEach((g, i) => {
      const vis = current.gates[i];
      vis.y += ((g.open ? vis.openY : vis.closedY) - vis.y) * ease(12);
      vis.slab.position.y = vis.y;
    });
    for (const c of current.cables) {
      const open = sim.gates[c.gate].open;
      const glow = open ? 0.55 : 0;
      c.mat.emissiveIntensity += (glow - c.mat.emissiveIntensity) * ease(8);
      for (const m of c.posts) m.emissiveIntensity = c.mat.emissiveIntensity * 0.6;
      c.beads.forEach((bead, k) => {
        bead.visible = open;
        if (open) bead.position.copy(c.curve.getPointAt((clock * 0.45 + k / 3) % 1));
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
    if (view.spin) {
      view.targetYaw += dt * 0.22;
      view.yaw = view.targetYaw;
      fitCamera();
    } else {
      view.yaw += (view.targetYaw - view.yaw) * Math.min(1, dt * 9);
    }
    placeCamera();
    renderer.render(scene, camera);
    adaptResolution(dt);
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

  return { build, sync, frame, resize, orbit, setSpin, screenToGround, renderer };
}
