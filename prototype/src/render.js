// Draws the machine with three.js. Everything is built from the same track data the
// physics uses, so what you see is exactly what the marbles ride on.

import * as THREE from './three.js';
import { MARBLE_RADIUS } from './config.js';
import { GROOVE_DEPTH_OFFSET, DEAD_END } from './pieces.js';
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

const BLOCK_INSET = 0.0125; // half the gap between neighbouring blocks
const TOP = 1 - 2 * BLOCK_INSET * 0.6; // block top, a hair under the cell top
const GROOVE_LIFT = TOP - (1 - GROOVE_DEPTH_OFFSET) + 0.004; // rail -> visible groove surface
const GROOVE_HALF_WIDTH = 0.17;
const R = MARBLE_RADIUS;
const MARBLE_VIEW_R = 0.17; // drawn a little larger than the physics radius
const MARBLE_LIFT = 0.06; // and sitting higher in the groove, so more of it shows

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
  const col = new THREE.Color(hex);
  g.fillStyle = `#${col.getHexString()}`;
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
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 p; void main(){ float h = normalize(p).y * 0.5 + 0.5; gl_FragColor = vec4(mix(vec3(0.16,0.55,0.56), vec3(1.0,0.98,0.94), h), 1.0); }',
    }),
  );
  scene.add(sky);
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

// A strip along a rail, darker at the edges so it reads as a carved channel.
function grooveGeometry(points) {
  const pos = [];
  const col = [];
  const uv = [];
  const edge = [0.42, 0.3, 0.19];
  const mid = [0.74, 0.57, 0.4];
  let run = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[Math.min(i + 1, points.length - 1)];
    const o = points[Math.max(i - 1, 0)];
    const dir = new THREE.Vector3(q[0] - o[0], 0, q[2] - o[2]).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(GROOVE_HALF_WIDTH);
    const y = p[1] + GROOVE_LIFT;
    if (i > 0) run += Math.hypot(p[0] - o[0], p[2] - o[2]);
    pos.push(p[0] + side.x, y, p[2] + side.z, p[0], y, p[2], p[0] - side.x, y, p[2] - side.z);
    col.push(...edge, ...mid, ...edge);
    uv.push(run, 0, run, 0.5, run, 1);
  }
  const index = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 3;
    const b = (i + 1) * 3;
    index.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  sun.shadow.radius = 3;
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
  const capMat = new THREE.MeshStandardMaterial({
    map: grooveMat.map,
    color: new THREE.Color(0.6, 0.46, 0.32),
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const cubeGeo = new THREE.BoxGeometry(1 - 2 * BLOCK_INSET, TOP, 1 - 2 * BLOCK_INSET);
  cubeGeo.translate(0, TOP / 2, 0);
  const wedgeGeo = wedgeGeometry();
  const marbleGeo = new THREE.SphereGeometry(MARBLE_VIEW_R, 32, 18);

  let pivot = null; // tilts around the machine's centre
  let content = null; // machine coordinates live here
  let current = null; // per-level objects
  const view = { yaw: (-24 * Math.PI) / 180, targetYaw: (-24 * Math.PI) / 180, pitch: (50 * Math.PI) / 180, distance: 12, center: new THREE.Vector3() };

  function clearLevel() {
    if (!pivot) return;
    scene.remove(pivot);
    pivot.traverse((o) => {
      if (o.geometry && o.geometry !== cubeGeo && o.geometry !== wedgeGeo && o.geometry !== marbleGeo) o.geometry.dispose();
    });
    pivot = null;
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

    // Wood.
    let n = 0;
    for (const piece of track.pieces) {
      const isWedge = piece.type === 'ramp';
      const mesh = new THREE.Mesh(isWedge ? wedgeGeo : cubeGeo, woodMats[(piece.anchor[0] * 7 + piece.anchor[1] * 3 + piece.anchor[2] * 5 + n++) % woodMats.length]);
      mesh.position.set(piece.anchor[0] + 0.5, piece.anchor[1], piece.anchor[2] + 0.5);
      mesh.rotation.y = (-piece.r * Math.PI) / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      content.add(mesh);
    }

    // Grooves, with a round cap at every dead end.
    const capGeo = new THREE.CircleGeometry(GROOVE_HALF_WIDTH, 20);
    capGeo.rotateX(-Math.PI / 2);
    for (const edge of track.edges) {
      const groove = new THREE.Mesh(grooveGeometry(edge.pts), grooveMat);
      groove.receiveShadow = true;
      content.add(groove);
      for (const [end, nodeId] of [[0, edge.n0], [1, edge.n1]]) {
        if (track.nodes[nodeId].links.length !== 1) continue;
        const p = end === 0 ? edge.pts[0] : edge.pts[edge.pts.length - 1];
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(p[0], p[1] + GROOVE_LIFT, p[2]);
        cap.receiveShadow = true;
        content.add(cap);
      }
    }

    // Goals: a coloured ring around the cup.
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
      return { mat, ring, pos: new THREE.Vector3(p[0], p[1] + GROOVE_LIFT, p[2]) };
    });

    // Plates: a metal disc where the marble rests.
    const plates = track.plates.map((plate) => {
      const edge = track.edges[plate.edge];
      const { pos } = sampleEdge(edge, edge.L - 0.08);
      const mat = new THREE.MeshStandardMaterial({ color: LINK_COLORS[plate.link], metalness: 0.85, roughness: 0.3, emissive: LINK_COLORS[plate.link], emissiveIntensity: 0 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28), mat);
      disc.position.set(pos[0], pos[1] + GROOVE_LIFT + 0.006, pos[2]);
      disc.receiveShadow = true;
      content.add(disc);
      return { mat, disc, baseY: disc.position.y, pos: new THREE.Vector3(pos[0], pos[1] + GROOVE_LIFT, pos[2]) };
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
      return { slab, closedY: top + 0.12, openY: top - 0.2, y: top + 0.12, pos: new THREE.Vector3(pos[0], top, pos[2]) };
    });

    // A thin wire arching from each plate (or linked goal) to the gate it opens.
    const wires = [];
    track.gates.forEach((gate, gi) => {
      const sources = [
        ...plates.filter((_, i) => track.plates[i].link === gate.link).map((p) => p.pos),
        ...goals.filter((_, i) => track.goals[i].link === gate.link).map((g) => g.pos),
      ];
      for (const from of sources) {
        const to = gates[gi].pos;
        const mid = from.clone().add(to).multiplyScalar(0.5);
        mid.y = Math.max(from.y, to.y) + 0.7 + from.distanceTo(to) * 0.12;
        const curve = new THREE.QuadraticBezierCurve3(from.clone().setY(from.y + 0.05), mid, to.clone().setY(to.y + 0.3));
        const mat = new THREE.MeshBasicMaterial({ color: LINK_COLORS[gate.link], transparent: true, opacity: 0.6 });
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.028, 8), mat);
        content.add(tube);
        wires.push({ gate: gi, mat });
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
      return { mesh, ghost, settled: 0 };
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

    current = { track, goals, plates, gates, wires, marbles, size };
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
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2) * 0.8;
    const tanV = Math.tan(vHalf);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.96;
    let d = 4;
    const pad = 0.25;
    for (const x of [min[0] - pad, max[0] + pad]) {
      for (const y of [min[1], max[1] + 0.4]) {
        for (const z of [min[2] - pad, max[2] + pad]) {
          const p = new THREE.Vector3(x, y, z).sub(view.center);
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

  // Bring the scene up to date with the simulation.
  function sync(sim, tiltVec, dt) {
    if (!current) return;
    const { axis, angle } = machineRotation(tiltVec);
    pivot.quaternion.setFromAxisAngle(tmpAxis.set(axis[0], axis[1], axis[2]).normalize(), angle);

    sim.marbles.forEach((m, i) => {
      const view3 = current.marbles[i];
      const prev = view3.mesh.position.clone();
      view3.mesh.position.set(m.pos[0], m.pos[1] + MARBLE_LIFT, m.pos[2]);
      const moved = view3.mesh.position.distanceTo(prev);
      if (moved > 1e-5 && moved < 1) {
        const dir = view3.mesh.position.clone().sub(prev).normalize();
        tmpAxis.set(dir.z, 0, -dir.x).normalize();
        if (tmpAxis.lengthSq() > 0.5) {
          tmpQ.setFromAxisAngle(tmpAxis, moved / MARBLE_VIEW_R);
          view3.mesh.quaternion.premultiply(tmpQ);
        }
      }
      view3.ghost.position.copy(view3.mesh.position);
      view3.ghost.visible = !m.delivered;
    });

    sim.goals.forEach((g, i) => {
      const target = g.filled ? 1.2 : 0.05;
      const mat = current.goals[i].mat;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 6);
    });
    sim.plates.forEach((p, i) => {
      const vis = current.plates[i];
      vis.disc.position.y += ((p.pressed ? vis.baseY - 0.02 : vis.baseY) - vis.disc.position.y) * Math.min(1, dt * 14);
      vis.mat.emissiveIntensity = p.pressed ? 0.35 : 0;
    });
    sim.gates.forEach((g, i) => {
      const vis = current.gates[i];
      vis.y += ((g.open ? vis.openY : vis.closedY) - vis.y) * Math.min(1, dt * 12);
      vis.slab.position.y = vis.y;
    });
    for (const w of current.wires) w.mat.opacity = sim.gates[w.gate].open ? 0.95 : 0.55;
  }

  function frame(dt) {
    view.yaw += (view.targetYaw - view.yaw) * Math.min(1, dt * 9);
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

  // Turn a screen drag (pixels, y down) into a direction on the machine's ground plane.
  function screenToGround(dx, dy) {
    const { fwd, right } = cameraBasis(view.yaw);
    const f = new THREE.Vector2(fwd.x, fwd.z).normalize();
    const r = new THREE.Vector2(right.x, right.z).normalize();
    return [dx * r.x - dy * f.x, dx * r.y - dy * f.y];
  }

  return { build, sync, frame, resize, orbit, screenToGround, renderer };
}
