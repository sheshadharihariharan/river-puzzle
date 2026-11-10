// Loads each model from models/<name>.glb if that file exists, otherwise uses the stand-in.
// Every model is resized to fit its tile, stood on y = 0 and given cartoon shading.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { buildStandIn } from './standins.js';
import { toonRamp } from './stage.js';

// fit: which size to match. 'length' = longest side lies along x (for planks and logs).
const SPECS = {
  hero: { fit: 'height', size: 0.72 },
  cottage: { fit: 'footprint', size: 0.95 },
  'rock-a': { fit: 'footprint', size: 0.78 },
  'rock-b': { fit: 'footprint', size: 0.86 },
  stone: { fit: 'footprint', size: 0.8 },
  plank: { fit: 'length', size: 1.9 },
  log: { fit: 'length', size: 2.85 },
  'tree-a': { fit: 'footprint', size: 1.05 },
  'tree-b': { fit: 'footprint', size: 0.9 },
  bush: { fit: 'footprint', size: 0.75 },
  hill: { fit: 'footprint', size: 2.6 },
  pedestal: { fit: 'footprint', size: 0.92 },
  padlock: { fit: 'height', size: 0.5 },
  flower: { fit: 'height', size: 0.55 },
};

// Only files that really exist are listed, so missing models never cause errors.
const files = import.meta.glob('../../models/*.glb', { query: '?url', import: 'default', eager: true });
const urlFor = (name) => files[`../../models/${name}.glb`];
// Hero animations may also come as separate files: hero-walk.glb, hero-idle.glb ...
const heroAnimFiles = Object.entries(files)
  .map(([path, url]) => ({ name: path.match(/hero-([\w-]+)\.glb$/)?.[1], url }))
  .filter((f) => f.name);

const loader = new GLTFLoader();
const cache = new Map();

export function loadModel(name) {
  if (!cache.has(name)) cache.set(name, prepare(name));
  return cache.get(name);
}

export function loadAll(names) {
  return Promise.all(names.map(loadModel));
}

// A fresh copy to put in the scene: { object, animations, top, fromFile }.
export async function instance(name) {
  const t = await loadModel(name);
  return { object: t.skinned ? cloneSkinned(t.object) : t.object.clone(true), animations: t.animations, top: t.top, fromFile: t.fromFile };
}

async function prepare(name) {
  const spec = SPECS[name];
  const url = urlFor(name);
  let object;
  let animations = [];
  if (url) {
    const gltf = await loader.loadAsync(url);
    object = gltf.scene;
    animations = gltf.animations;
    if (name === 'hero') {
      for (const f of heroAnimFiles) {
        const extra = await loader.loadAsync(f.url);
        extra.animations.forEach((clip) => {
          clip.name = f.name;
          animations.push(clip);
        });
      }
    }
    toonify(object);
  } else {
    object = buildStandIn(name);
  }

  // Wrap so the fitting transform stays separate from animation.
  const wrapper = new THREE.Group();
  wrapper.name = name;
  wrapper.add(object);
  fit(object, spec);
  let skinned = false;
  wrapper.traverse((o) => {
    if (o.isSkinnedMesh) skinned = true;
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const box = new THREE.Box3().setFromObject(wrapper);
  return { object: wrapper, animations, top: box.max.y, skinned, fromFile: !!url };
}

function fit(object, spec) {
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  let size = box.getSize(new THREE.Vector3());
  if (spec.fit === 'length' && size.z > size.x) {
    object.rotation.y += Math.PI / 2;
    object.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(object);
    size = box.getSize(new THREE.Vector3());
  }
  const measure = { height: size.y, footprint: Math.max(size.x, size.z), length: size.x }[spec.fit];
  const k = spec.size / measure;
  object.scale.multiplyScalar(k);
  object.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
}

// Swap the model's realistic materials for flat cartoon ones, keeping colours and textures.
function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) =>
      new THREE.MeshToonMaterial({
        color: m.color ?? new THREE.Color(0xffffff),
        map: m.map ?? null,
        gradientMap: toonRamp,
        transparent: m.transparent,
        opacity: m.opacity,
        alphaTest: m.alphaTest,
        side: m.side,
      });
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}
