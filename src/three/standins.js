// Stand-in models built from simple shapes, used until the Tripo .glb files arrive.
// Each one is centred on x/z with its base at y = 0. Sizes are in tiles (1 = one grid square).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './stage.js';

const C = {
  skin: 0xffd7b0,
  shirt: 0xe2574c,
  shorts: 0x3f6fd1,
  boot: 0x7a4a26,
  hat: 0xf2cf6b,
  hatBand: 0xb6452c,
  pack: 0x9a6233,
  eye: 0x1d1d1d,
  stone: 0xb9b8ae,
  stoneTop: 0xd9d8cf,
  rock: 0x9c9c95,
  moss: 0x6cbf3c,
  wood: 0xc98a4b,
  woodDark: 0x8f5a2c,
  bark: 0x8b5a2b,
  logEnd: 0xe8c08a,
  leaf: 0x48b83a,
  leafLight: 0x8fdc4a,
  trunk: 0x7d4f2a,
  wall: 0xf3dfb4,
  roof: 0xb6452c,
  door: 0x7a3f1e,
  base: 0x8d8a86,
  pedestal: 0x5d5f63,
  pedestalTop: 0xa9abae,
  lock: 0x8e9196,
};

function mesh(geometry, color, parent, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, toon(color));
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const sphere = (r, d = 20) => new THREE.SphereGeometry(r, d, Math.round(d * 0.75));
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12);
const rbox = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);

// Seeded random so stand-ins look the same every time.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// A lumpy smooth boulder.
function boulderGeometry(seed, radius) {
  let g = new THREE.IcosahedronGeometry(radius, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const r = rng(seed);
  const pos = g.attributes.position;
  const bumps = Array.from({ length: 5 }, () => new THREE.Vector3(r() - 0.5, r() - 0.3, r() - 0.5).normalize());
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    let k = 1;
    for (const b of bumps) k += Math.max(0, dir.dot(b) - 0.6) * 0.35;
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y * 0.78, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function leafCluster(parent, center, radius, seed, count = 7) {
  const r = rng(seed);
  mesh(sphere(radius), C.leaf, parent, center);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r();
    const rr = radius * (0.55 + r() * 0.25);
    mesh(sphere(radius * (0.45 + r() * 0.2)), C.leaf, parent, [center[0] + Math.cos(a) * rr, center[1] - radius * 0.15 + r() * radius * 0.4, center[2] + Math.sin(a) * rr]);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    mesh(sphere(radius * 0.35), C.leafLight, parent, [center[0] + Math.cos(a) * radius * 0.3, center[1] + radius * 0.6, center[2] + Math.sin(a) * radius * 0.3]);
  }
}

const builders = {
  hero() {
    const g = new THREE.Group();
    const part = (name, x, y, z) => {
      const p = new THREE.Group();
      p.name = name;
      p.position.set(x, y, z);
      g.add(p);
      return p;
    };
    const legL = part('legL', -0.07, 0.2, 0);
    const legR = part('legR', 0.07, 0.2, 0);
    for (const leg of [legL, legR]) {
      mesh(capsule(0.045, 0.1), C.skin, leg, [0, -0.08, 0]);
      mesh(sphere(0.06), C.boot, leg, [0, -0.16, 0.015], [1, 0.75, 1.3]);
    }
    const body = part('body', 0, 0.2, 0);
    mesh(capsule(0.11, 0.06), C.shirt, body, [0, 0.1, 0]);
    mesh(cyl(0.115, 0.12, 0.08), C.shorts, body, [0, 0.0, 0]);
    mesh(rbox(0.16, 0.18, 0.08, 0.03), C.pack, body, [0, 0.12, -0.12]);
    const armL = part('armL', -0.14, 0.36, 0);
    const armR = part('armR', 0.14, 0.36, 0);
    for (const arm of [armL, armR]) {
      mesh(capsule(0.035, 0.1), C.shirt, arm, [0, -0.04, 0]);
      mesh(sphere(0.04), C.skin, arm, [0, -0.12, 0]);
    }
    const head = part('head', 0, 0.5, 0);
    mesh(sphere(0.17), C.skin, head, [0, 0.03, 0]);
    mesh(sphere(0.025, 10), C.eye, head, [-0.06, 0.05, 0.155], [1, 1.4, 1]);
    mesh(sphere(0.025, 10), C.eye, head, [0.06, 0.05, 0.155], [1, 1.4, 1]);
    mesh(sphere(0.03, 10), 0xff9a8a, head, [-0.1, 0.0, 0.13], [1, 0.6, 0.5]);
    mesh(sphere(0.03, 10), 0xff9a8a, head, [0.1, 0.0, 0.13], [1, 0.6, 0.5]);
    mesh(cyl(0.27, 0.27, 0.025, 28), C.hat, head, [0, 0.12, 0]);
    mesh(sphere(0.15), C.hat, head, [0, 0.13, 0], [1, 0.75, 1]);
    mesh(cyl(0.152, 0.152, 0.04, 24), C.hatBand, head, [0, 0.15, 0]);
    return g;
  },

  cottage() {
    const g = new THREE.Group();
    mesh(rbox(0.86, 0.12, 0.86, 0.04), C.base, g, [0, 0.06, 0]);
    mesh(rbox(0.66, 0.42, 0.62, 0.04), C.wall, g, [0, 0.33, 0]);
    const roof = mesh(new THREE.ConeGeometry(0.62, 0.5, 4, 1), C.roof, g, [0, 0.78, 0], [1, 1, 1], [0, Math.PI / 4, 0]);
    roof.geometry = mergeVertices(roof.geometry.deleteAttribute('normal').deleteAttribute('uv'));
    roof.geometry.computeVertexNormals();
    mesh(rbox(0.18, 0.26, 0.04, 0.03), C.door, g, [0.08, 0.25, 0.32]);
    mesh(new THREE.CircleGeometry(0.06, 16), 0x6fc3f0, g, [0.33 + 0.001, 0.38, -0.05], [1, 1, 1], [0, Math.PI / 2, 0]);
    mesh(rbox(0.1, 0.22, 0.1, 0.02), 0x9b6a4a, g, [-0.2, 0.9, -0.15]);
    return g;
  },

  'rock-a'() {
    const g = new THREE.Group();
    mesh(boulderGeometry(7, 0.4), C.rock, g, [0, 0.26, 0]);
    mesh(sphere(0.12), C.moss, g, [-0.05, 0.53, 0.02], [1.3, 0.35, 1]);
    return g;
  },

  'rock-b'() {
    const g = new THREE.Group();
    mesh(boulderGeometry(3, 0.33), C.rock, g, [-0.1, 0.22, -0.06]);
    mesh(boulderGeometry(11, 0.2), C.rock, g, [0.24, 0.13, 0.1]);
    mesh(boulderGeometry(17, 0.16), C.rock, g, [-0.05, 0.1, 0.28]);
    mesh(sphere(0.09), C.moss, g, [-0.12, 0.44, -0.05], [1.3, 0.35, 1]);
    return g;
  },

  stone() {
    const g = new THREE.Group();
    mesh(sphere(0.4, 28), C.stone, g, [0, 0.11, 0], [1, 0.32, 0.92]);
    mesh(sphere(0.26, 20), C.stoneTop, g, [-0.06, 0.2, -0.05], [1, 0.1, 0.8]);
    return g;
  },

  // Runs along x. Boards go across, two beams underneath.
  plank() {
    const g = new THREE.Group();
    const len = 1.9;
    for (const z of [-0.18, 0.18]) mesh(rbox(len, 0.06, 0.08, 0.02), C.woodDark, g, [0, 0.04, z]);
    const boards = 9;
    for (let i = 0; i < boards; i++) {
      const x = -len / 2 + (len / boards) * (i + 0.5);
      mesh(rbox(len / boards - 0.025, 0.06, 0.6 + (i % 2) * 0.04, 0.02), C.wood, g, [x, 0.1, 0]);
    }
    return g;
  },

  log() {
    const g = new THREE.Group();
    const len = 2.85;
    mesh(cyl(0.22, 0.22, len, 18), C.bark, g, [0, 0.22, 0], [1, 1, 0.95], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) mesh(cyl(0.18, 0.18, 0.02, 18), C.logEnd, g, [s * (len / 2 + 0.005), 0.22, 0], [1, 1, 0.95], [0, 0, Math.PI / 2]);
    mesh(sphere(0.12), C.moss, g, [0.6, 0.42, 0.04], [1.6, 0.3, 1]);
    return g;
  },

  'tree-a'() {
    const g = new THREE.Group();
    mesh(cyl(0.07, 0.11, 0.5), C.trunk, g, [0, 0.25, 0]);
    for (let i = 0; i < 3; i++) mesh(capsule(0.035, 0.12), C.trunk, g, [Math.cos(i * 2.1) * 0.1, 0.03, Math.sin(i * 2.1) * 0.1], [1, 1, 1], [Math.sin(i * 2.1) * 1.2, 0, -Math.cos(i * 2.1) * 1.2]);
    leafCluster(g, [0, 0.82, 0], 0.36, 5);
    return g;
  },

  'tree-b'() {
    const g = new THREE.Group();
    mesh(cyl(0.05, 0.08, 0.7), C.trunk, g, [0, 0.35, 0]);
    leafCluster(g, [0, 0.8, 0], 0.32, 9, 6);
    leafCluster(g, [0, 1.22, 0], 0.22, 13, 5);
    return g;
  },

  bush() {
    const g = new THREE.Group();
    leafCluster(g, [0, 0.22, 0], 0.26, 21, 6);
    return g;
  },

  hill() {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = t * 2.4;
      const r = 1.2 * Math.cos(t * Math.PI * 0.5) ** 0.7 + (t > 0.97 ? -0.2 : 0);
      pts.push(new THREE.Vector2(Math.max(0.01, r), y));
    }
    const geo = new THREE.LatheGeometry(pts, 28);
    const colors = [];
    const low = new THREE.Color(0x1f6f5c);
    const high = new THREE.Color(0x9aa74a);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const c = low.clone().lerp(high, geo.attributes.position.getY(i) / 2.4);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const g = new THREE.Group();
    const m = mesh(geo, 0xffffff, g);
    m.material.vertexColors = true;
    mesh(sphere(0.06, 10), 0xffffff, g, [0.1, 2.33, 0.25], [1, 0.5, 1]);
    return g;
  },

  pedestal() {
    const g = new THREE.Group();
    mesh(cyl(0.44, 0.46, 0.2, 32), C.pedestal, g, [0, 0.1, 0]);
    mesh(cyl(0.36, 0.38, 0.12, 32), C.pedestalTop, g, [0, 0.26, 0]);
    mesh(cyl(0.26, 0.26, 0.02, 32), 0x7e8084, g, [0, 0.325, 0]);
    return g;
  },

  // A big pink flower on a stem with two leaves.
  flower() {
    const g = new THREE.Group();
    mesh(cyl(0.025, 0.03, 0.4, 8), 0x3f9a2f, g, [0, 0.2, 0]);
    for (const s of [-1, 1]) mesh(sphere(0.08, 12), 0x5cc23c, g, [s * 0.08, 0.14, 0], [1.6, 0.3, 0.8], [0, 0, s * 0.5]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(sphere(0.085, 14), 0xff7eb3, g, [Math.cos(a) * 0.1, 0.44, Math.sin(a) * 0.1], [1, 0.45, 1]);
    }
    mesh(sphere(0.07, 14), 0xffd23f, g, [0, 0.47, 0], [1, 0.7, 1]);
    return g;
  },

  padlock() {
    const g = new THREE.Group();
    mesh(new THREE.TorusGeometry(0.11, 0.035, 12, 24, Math.PI), C.lock, g, [0, 0.27, 0]);
    for (const s of [-1, 1]) mesh(cyl(0.035, 0.035, 0.06), C.lock, g, [s * 0.11, 0.25, 0]);
    mesh(rbox(0.32, 0.26, 0.14, 0.06), C.lock, g, [0, 0.13, 0]);
    mesh(sphere(0.035, 10), C.eye, g, [0, 0.16, 0.07], [1, 1, 0.4]);
    mesh(rbox(0.03, 0.07, 0.02, 0.01), C.eye, g, [0, 0.1, 0.07]);
    return g;
  },
};

export function buildStandIn(name) {
  const build = builders[name];
  if (!build) throw new Error(`No stand-in for model "${name}"`);
  return build();
}
