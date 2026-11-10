// Small pictures of 3D models for the piece tray, so the tray always matches the models in use.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { OUTLINE } from './stage.js';

export function thumbnails(objects, width = 180, height = 90) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(2);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.008, defaultColor: OUTLINE });
  outline.autoClear = true; // OutlineEffect leaves this unset, so each picture would keep the last one
  const urls = objects.map((object) => {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5c7a4a, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-3, 6, 4);
    scene.add(sun, object);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x / (width / height), size.y + size.z * 0.5) * 0.62;
    const camera = new THREE.OrthographicCamera(-span * (width / height), span * (width / height), span, -span, 0.1, 50);
    camera.position.copy(center).add(new THREE.Vector3(0, 4, 5));
    camera.lookAt(center);
    outline.render(scene, camera);
    return renderer.domElement.toDataURL();
  });
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
