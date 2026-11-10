// The 3D stage: renderer, isometric camera, lights, cartoon outlines and the frame loop.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

export const OUTLINE = [0.1, 0.2, 0.14]; // dark green-black, like the reference art

// Phones and tablets: draw at a lower resolution with smaller shadows so they stay smooth.
const TOUCH = window.matchMedia('(pointer: coarse)').matches;

// Toon shading: three flat light bands instead of smooth shading.
const bands = new Uint8Array([90, 170, 255]);
export const toonRamp = new THREE.DataTexture(bands, bands.length, 1, THREE.RedFormat);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
toonRamp.needsUpdate = true;

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...extra });
}

// Hide the outline for things that tile or sit flat (grass, water, decals).
export function noOutline(material) {
  material.userData.outlineParameters = { visible: false };
  return material;
}

export class Stage {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.006, defaultColor: OUTLINE });
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200); // isometric view
    this.chase = new THREE.PerspectiveCamera(40, 1, 0.1, 200); // follows the hero after Go
    this.chaseLook = new THREE.Vector3();
    this.view = this.camera; // the camera being drawn
    this.stopFollow = null;
    this.clock = new THREE.Clock();
    this.tickers = new Set();
    this.scene = null;
    this.fit = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // New empty scene with sky colour and lights. Shadows cover `size` units around `center`.
  newScene(center, size) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4f9e45);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5c7a4a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
    sun.position.set(center.x - 8, 14, center.z + 4);
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(TOUCH ? 1024 : 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 50 });
    scene.add(sun, sun.target);
    this.scene = scene;
    this.view = this.camera;
    this.stopFollow = null;
    this.tickers.clear();
    return scene;
  }

  // Isometric view of a box of the world. gaps() -> { top, right, bottom } in px: screen room kept
  // free for the top bar and panel. It is asked again on every resize, so layouts can change.
  frame3D(min, max, gaps = () => ({})) {
    this.fit = { min: min.clone(), max: max.clone(), gaps };
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.chase.aspect = w / h;
    this.chase.updateProjectionMatrix();
    if (!this.fit) return;
    const { min, max } = this.fit;
    const { top = 0, right = 0, bottom = 0 } = this.fit.gaps();
    const center = min.clone().add(max).multiplyScalar(0.5);
    const cam = this.camera;
    cam.position.copy(center).add(new THREE.Vector3(30, 30, 30)); // looking along (1,1,1) = true isometric
    cam.lookAt(center);
    cam.updateMatrixWorld();

    // Measure the box corners in camera space, then size the view to fit them.
    const inv = cam.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const usableW = Math.max(120, w - right);
    const usableH = Math.max(120, h - top - bottom);
    const unitsPerPx = Math.max((x1 - x0) / usableW, (y1 - y0) / usableH) * 1.08;
    const cx = (x0 + x1) / 2 + (right / 2) * unitsPerPx;
    const cy = (y0 + y1) / 2 + ((top - bottom) / 2) * unitsPerPx;
    cam.left = cx - (w / 2) * unitsPerPx;
    cam.right = cx + (w / 2) * unitsPerPx;
    cam.top = cy + (h / 2) * unitsPerPx;
    cam.bottom = cy - (h / 2) * unitsPerPx;
    cam.updateProjectionMatrix();
  }

  // Run fn(dt, time) every frame until the scene changes.
  onTick(fn) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  // Animate over `seconds`, calling fn(t) with t from 0 to 1. Resolves when done.
  tween(seconds, fn, ease = (t) => t) {
    return new Promise((resolve) => {
      let elapsed = 0;
      const stop = this.onTick((dt) => {
        elapsed += dt;
        const t = Math.min(1, elapsed / seconds);
        fn(ease(t));
        if (t === 1) {
          stop();
          resolve();
        }
      });
    });
  }

  wait(seconds) {
    return this.tween(seconds, () => {});
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    // One broken animation must not freeze the others.
    for (const fn of [...this.tickers]) {
      try {
        fn(dt, time);
      } catch (err) {
        this.tickers.delete(fn);
        console.error('Animation stopped:', err);
      }
    }
    if (this.scene) this.outline.render(this.scene, this.view);
  }

  // Where the isometric view is looking, and a perspective eye position that frames the same area.
  isoPose() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const look = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), look);
    const half = (this.camera.top - this.camera.bottom) / 2;
    const dist = half / Math.tan(THREE.MathUtils.degToRad(this.chase.fov / 2));
    return { eye: look.clone().add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(dist)), look };
  }

  // Switch to the chase camera and keep it on pose() = { eye, look }, blending in from the isometric view.
  follow(pose, seconds = 1) {
    if (this.stopFollow) this.stopFollow();
    const from = this.view === this.chase ? { eye: this.chase.position.clone(), look: this.chaseLook.clone() } : this.isoPose();
    this.chase.position.copy(from.eye);
    this.chaseLook.copy(from.look);
    this.view = this.chase;
    let blend = 0;
    this.stopFollow = this.onTick((dt) => {
      const { eye, look } = pose();
      blend = Math.min(1, blend + dt / seconds);
      if (blend < 1) {
        const k = ease.inOut(blend);
        this.chase.position.lerpVectors(from.eye, eye, k);
        this.chaseLook.lerpVectors(from.look, look, k);
      } else {
        const k = 1 - Math.exp(-dt * 5); // smooth trailing
        this.chase.position.lerp(eye, k);
        this.chaseLook.lerp(look, k);
      }
      this.chase.lookAt(this.chaseLook);
    });
  }

  // Glide back to the isometric view.
  async unfollow(seconds = 0.8) {
    if (this.view !== this.chase) return;
    if (this.stopFollow) this.stopFollow();
    this.stopFollow = null;
    const e0 = this.chase.position.clone();
    const l0 = this.chaseLook.clone();
    const { eye, look } = this.isoPose();
    await this.tween(seconds, (t) => {
      this.chase.position.lerpVectors(e0, eye, t);
      this.chaseLook.lerpVectors(l0, look, t);
      this.chase.lookAt(this.chaseLook);
    }, ease.inOut);
    this.view = this.camera;
  }

  // Mouse position to a point on the flat plane y = height.
  pointOnPlane(clientX, clientY, height = 0) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), hit) ? hit : null;
  }

  // World point to screen pixels (for HTML labels over 3D things).
  toScreen(point) {
    const p = point.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }
}

export const ease = {
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  in: (t) => t * t,
  back: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
