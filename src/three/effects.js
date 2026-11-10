// Short visual effects: splash, dust puff, win sparkles.
import * as THREE from 'three';
import { noOutline, ease } from './stage.js';
import { WATER_Y } from './ground.js';

const ballGeo = new THREE.SphereGeometry(1, 10, 8);
const ringGeo = new THREE.TorusGeometry(1, 0.08, 6, 32).rotateX(Math.PI / 2);

function burst(stage, scene, origin, { count, color, size, speed, up, life, gravity = 6 }) {
  const balls = [];
  for (let i = 0; i < count; i++) {
    const mat = noOutline(new THREE.MeshBasicMaterial({ color: Array.isArray(color) ? color[i % color.length] : color, transparent: true }));
    const b = new THREE.Mesh(ballGeo, mat);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const s = speed * (0.6 + Math.random() * 0.6);
    b.userData.v = new THREE.Vector3(Math.cos(a) * s, up * (0.7 + Math.random() * 0.6), Math.sin(a) * s);
    b.scale.setScalar(size * (0.6 + Math.random() * 0.6));
    b.position.copy(origin);
    scene.add(b);
    balls.push(b);
  }
  let elapsed = 0;
  const stop = stage.onTick((dt) => {
    elapsed += dt;
    for (const b of balls) {
      b.userData.v.y -= gravity * dt;
      b.position.addScaledVector(b.userData.v, dt);
      b.material.opacity = 1 - elapsed / life;
    }
    if (elapsed >= life) {
      stop();
      balls.forEach((b) => scene.remove(b));
    }
  });
}

function ring(stage, scene, origin, color, to = 0.7, life = 0.6) {
  const r = new THREE.Mesh(ringGeo, noOutline(new THREE.MeshBasicMaterial({ color, transparent: true })));
  r.position.copy(origin);
  scene.add(r);
  stage.tween(life, (t) => {
    r.scale.setScalar(0.1 + t * to);
    r.material.opacity = 1 - t;
    if (t === 1) scene.remove(r);
  }, ease.out);
}

export function splash(stage, scene, at) {
  const p = new THREE.Vector3(at.x, WATER_Y + 0.02, at.z);
  ring(stage, scene, p, 0xffffff, 0.8);
  setTimeout(() => ring(stage, scene, p, 0xbfe9ff, 1.1, 0.8), 150);
  burst(stage, scene, p, { count: 14, color: [0xffffff, 0xbfe9ff, 0x7fd3ff], size: 0.05, speed: 1.2, up: 2.6, life: 0.8 });
}

export function puff(stage, scene, at) {
  ring(stage, scene, new THREE.Vector3(at.x, at.y + 0.02, at.z), 0xffffff, 0.6, 0.4);
  burst(stage, scene, at, { count: 8, color: 0xffffff, size: 0.035, speed: 0.9, up: 0.8, life: 0.4, gravity: 2 });
}

export function sparkles(stage, scene, at) {
  burst(stage, scene, at, { count: 24, color: [0xffd23f, 0xff7a59, 0x7fd3ff, 0xffffff, 0x8fdc4a], size: 0.045, speed: 1.4, up: 3.2, life: 1.3, gravity: 4 });
}
