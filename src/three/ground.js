// Ground shared by the puzzle board and the level map: grass blocks with earth sides,
// animated water between them, and small scattered flowers.
import * as THREE from 'three';
import { toon, noOutline } from './stage.js';

export const WATER_Y = -0.25;

const waterVertex = `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

// Cartoon water: soft wavy ripple lines drifting downstream, lighter patches, paler shallows
// and foam at the banks. `mask` holds one texel per cell (white = water); smoothed, it tells how close the shore is.
const waterFragment = `
  uniform float time;
  uniform vec2 flow;
  uniform vec3 deep;
  uniform vec3 shallow;
  uniform vec3 deepWater;
  uniform vec3 lineColor;
  uniform sampler2D mask;
  uniform vec4 bounds; // x0, z0, width, depth
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Smooth random hills and valleys.
  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    float wet = texture2D(mask, (p - bounds.xy) / bounds.zw).r; // 1 mid-river, falls towards 0 at the bank

    // River space (along, across), squashed so shapes stretch downstream.
    vec2 q = vec2(dot(p, flow), dot(p, vec2(-flow.y, flow.x)));
    vec2 s = vec2(q.x * 0.7, q.y * 1.6);
    float n = 0.7 * smoothNoise(s * 1.1 - vec2(time * 0.4, 0.0))
            + 0.3 * smoothNoise(s * 2.4 + vec2(-time * 0.25, time * 0.1));

    // A thin wavy line where the noise crosses one level, lighter patches on the peaks.
    float fw = fwidth(n);
    float line = 1.0 - smoothstep(fw * 0.6, fw * 1.8, abs(n - 0.6));
    float bright = smoothstep(0.66, 0.7, n);

    vec3 col = mix(shallow, deep, smoothstep(0.55, 0.95, wet));
    col = mix(col, deepWater, smoothstep(0.3, 0.8, texture2D(mask, (p - bounds.xy) / bounds.zw).g)); // deep water is darker
    col = mix(col, mix(col, lineColor, 0.35), bright);
    col = mix(col, lineColor, line * 0.85);

    // Foam band hugging the bank, wobbling a little.
    float wobble = sin(q.x * 5.0 - time * 2.0) * 0.03 + sin(q.y * 6.0 + time * 1.3) * 0.02;
    float foam = 1.0 - smoothstep(0.6, 0.65, wet + wobble);
    col = mix(col, vec3(1.0), foam * 0.9);

    // Small white glints that drift with the water and blink.
    vec2 cell = floor(s * 4.0 - vec2(time * 1.2, 0.0));
    float glint = step(0.97, hash(cell)) * step(0.5, sin(time * 3.0 + hash(cell + 7.0) * 20.0));
    col = mix(col, vec3(1.0), glint * bright);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// area: { x0, z0, x1, z1 } in cells. waterAt(col, row) -> false, 'shallow' or 'deep'.
// landAt(col, row) -> { grass, earth } colours for that block. flow: [x, z] direction the river runs.
// colors: { deep, shallow, line, deepWater } for the water.
export function buildGround(stage, scene, area, waterAt, landAt, flow, colors) {
  const land = [];
  for (let row = area.z0; row < area.z1; row++)
    for (let col = area.x0; col < area.x1; col++) if (!waterAt(col, row)) land.push({ col, row });

  // Ground blocks: grass (or snow) on top, earth sides that show above the water like a river bank.
  // One batch per colour pair, so each area can have its own look.
  const box = new THREE.BoxGeometry(1, 1.2, 1).translate(0, -0.6, 0);
  const m = new THREE.Matrix4();
  const groups = new Map();
  for (const cell of land) {
    const { grass, earth } = landAt(cell.col, cell.row);
    const k = `${grass},${earth}`;
    if (!groups.has(k)) groups.set(k, { grass, earth, cells: [] });
    groups.get(k).cells.push(cell);
  }
  for (const g of groups.values()) {
    const top = noOutline(toon(g.grass));
    const side = noOutline(toon(g.earth));
    const blocks = new THREE.InstancedMesh(box, [side, side, top, side, side, side], g.cells.length);
    g.cells.forEach(({ col, row }, i) => blocks.setMatrixAt(i, m.makeTranslation(col + 0.5, 0, row + 0.5)));
    blocks.receiveShadow = true;
    scene.add(blocks);
  }

  // One texel per cell: red = water, green = deep water. Linear filtering softens it into a shore gradient.
  const w = area.x1 - area.x0;
  const d = area.z1 - area.z0;
  const cells = new Uint8Array(w * d * 4);
  for (let row = 0; row < d; row++)
    for (let col = 0; col < w; col++) {
      const kind = waterAt(col + area.x0, row + area.z0);
      cells.set([kind ? 255 : 0, kind === 'deep' ? 255 : 0, 0, 255], (row * w + col) * 4);
    }
  const mask = new THREE.DataTexture(cells, w, d, THREE.RGBAFormat);
  mask.magFilter = mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;

  const waterUniforms = {
    time: { value: 0 },
    flow: { value: new THREE.Vector2(...flow).normalize() },
    deep: { value: new THREE.Color(colors.deep) },
    shallow: { value: new THREE.Color(colors.shallow) },
    deepWater: { value: new THREE.Color(colors.deepWater) },
    lineColor: { value: new THREE.Color(colors.line) },
    mask: { value: mask },
    bounds: { value: new THREE.Vector4(area.x0, area.z0, w, d) },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    noOutline(new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: waterVertex, fragmentShader: waterFragment })),
  );
  water.position.set((area.x0 + area.x1) / 2, WATER_Y, (area.z0 + area.z1) / 2);
  scene.add(water);

  stage.onTick((dt, time) => {
    waterUniforms.time.value = time;
  });
}

// Little white flowers and grass tufts. points: [{x, z}]
export function addFlowers(scene, points, rand) {
  const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), noOutline(toon(0xffffff)), points.length * 4);
  const hearts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), noOutline(toon(0xffd23f)), points.length);
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.14, 5), noOutline(toon(0x3f9a2f)), points.length * 3);
  const m = new THREE.Matrix4();
  const flat = new THREE.Vector3(1, 0.45, 1);
  const q = new THREE.Quaternion();
  points.forEach(({ x, z }, i) => {
    const flower = rand() < 0.5;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const s = flower ? 1 : 0.0001;
      petals.setMatrixAt(i * 4 + k, m.compose(new THREE.Vector3(x + Math.cos(a) * 0.04, 0.02, z + Math.sin(a) * 0.04), q, flat.clone().multiplyScalar(s)));
    }
    hearts.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.035, z), q, flat.clone().multiplyScalar(flower ? 1 : 0.0001)));
    for (let k = 0; k < 3; k++) {
      const s = flower ? 0.0001 : 1;
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((k - 1) * 0.35, 0, (k - 1) * 0.25));
      tufts.setMatrixAt(i * 3 + k, m.compose(new THREE.Vector3(x + (k - 1) * 0.03, 0.06, z), tilt, new THREE.Vector3(s, s, s)));
    }
  });
  scene.add(petals, hearts, tufts);
}

export function seeded(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  s = s || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
