// The level map: a winding path of stone pedestals through the Meadow, over a bridge, into the Forest.
// Padlocks on locked levels, stars on won ones. Scroll with the mouse wheel or drag to see more.
import * as THREE from 'three';
import { buildGround, addFlowers, seeded } from '../three/ground.js';
import { instance } from '../three/models.js';
import { Hero } from '../three/hero.js';
import { noOutline, toon, ease } from '../three/stage.js';
import { sparkles } from '../three/effects.js';
import { starsFor, isUnlocked } from '../save.js';
import { LEVELS } from '../levels.js';
import { starRow } from './ui.js';
import { sfx } from '../audio.js';

const PER_ROW = 4;
const GAP_X = 2.6;
const GAP_Z = 3;
const AREA_GAP = 3; // extra room between areas for the stream
// How much of the map shows at once, front to back. Upright screens show less, so it stays big enough to tap.
const viewDepth = () => (window.innerHeight > window.innerWidth ? 6 : 10);

const areaOf = (i) => LEVELS[i].id.split('-')[0]; // 'meadow' or 'forest'
const AREA_NAMES = { meadow: 'Meadow', forest: 'Forest' };

// Snake layout: left to right, then right to left on the next row, with a gap between areas.
function spotFor(i) {
  const row = Math.floor(i / PER_ROW);
  const k = i % PER_ROW;
  const col = row % 2 ? PER_ROW - 1 - k : k;
  const areaIndex = [...new Set(LEVELS.slice(0, i + 1).map((_, j) => areaOf(j)))].length - 1;
  return new THREE.Vector3(col * GAP_X + 1, 0, row * GAP_Z + areaIndex * AREA_GAP + 1 + Math.sin(i * 1.3) * 0.3);
}

export async function showMap(stage, ui, nav, justUnlocked = null) {
  const names = ['pedestal', 'padlock', 'hero', 'cottage', 'tree-a', 'tree-b', 'bush', 'hill', 'plank'];
  const models = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await instance(n)])));
  const copy = (n) => models[n].object.clone(true);
  const rand = seeded('map');

  const spots = LEVELS.map((_, i) => spotFor(i));
  const min = spots.reduce((a, p) => a.min(p), spots[0].clone());
  const max = spots.reduce((a, p) => a.max(p), spots[0].clone());
  const center = min.clone().add(max).multiplyScalar(0.5);
  const scene = stage.newScene(center, Math.max(max.x - min.x, max.z - min.z) / 2 + 8);

  // Where one area ends and the next begins: the stream runs across there.
  const crossings = [];
  for (let i = 1; i < LEVELS.length; i++) if (areaOf(i) !== areaOf(i - 1)) crossings.push(i);
  const streamRows = crossings.map((i) => Math.floor((spots[i - 1].z + spots[i].z) / 2));
  const forestFromZ = crossings.length ? (spots[crossings[0] - 1].z + spots[crossings[0]].z) / 2 : Infinity;

  const area = { x0: Math.floor(min.x) - 14, z0: Math.floor(min.z) - 12, x1: Math.ceil(max.x) + 14, z1: Math.ceil(max.z) + 12 };
  const pond = new THREE.Vector2(max.x + 3, min.z - 2.5);
  const isWater = (c, r) =>
    c === Math.floor(min.x) - 3 || c === Math.floor(min.x) - 4 ||
    streamRows.some((z) => r === z || r === z - 1) ||
    Math.hypot(c + 0.5 - pond.x, (r + 0.5 - pond.y) * 1.3) < 2;
  buildGround(stage, scene, area, (c, r) => isWater(c, r) && 'shallow', (c, r) => (r + 0.5 > forestFromZ ? 0xb3cca6 : 0xffffff), [1, 0]);

  // Light green path joining the pedestals, with a plank bridge over each stream.
  const pathMat = noOutline(toon(0xc8f294));
  const nearPath = (x, z) => spots.some((p, i) => {
    const q = spots[i + 1];
    if (!q) return Math.hypot(x - p.x, z - p.z) < 1.3;
    const seg = q.clone().sub(p);
    const t = Math.max(0, Math.min(1, ((x - p.x) * seg.x + (z - p.z) * seg.z) / seg.lengthSq()));
    return Math.hypot(x - (p.x + seg.x * t), z - (p.z + seg.z * t)) < 1.3;
  });
  spots.forEach((p, i) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.02, 28), pathMat);
    disc.position.set(p.x, 0.01, p.z);
    disc.receiveShadow = true;
    scene.add(disc);
    const q = spots[i + 1];
    if (!q) return;
    const mid = p.clone().add(q).multiplyScalar(0.5);
    const angle = -Math.atan2(q.z - p.z, q.x - p.x);
    if (crossings.includes(i + 1)) {
      const bridge = copy('plank');
      bridge.position.copy(mid).setY(-0.12);
      bridge.rotation.y = angle;
      bridge.scale.set(1.5, 1, 1.2);
      scene.add(bridge);
      return;
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(p.distanceTo(q), 0.02, 0.7), pathMat);
    strip.position.copy(mid).setY(0.01);
    strip.rotation.y = angle;
    strip.receiveShadow = true;
    scene.add(strip);
  });

  // Pedestals, padlocks and the hero on the newest open level.
  const pedestals = spots.map((p) => {
    const o = copy('pedestal');
    o.position.copy(p);
    scene.add(o);
    return o;
  });
  const pedTop = models.pedestal.top;
  const locks = spots.map((p, i) => {
    if (isUnlocked(LEVELS, i) && i !== justUnlocked) return null;
    const lock = copy('padlock');
    lock.position.copy(p).setY(pedTop);
    lock.rotation.y = Math.PI / 4;
    scene.add(lock);
    return lock;
  });
  let current = 0;
  LEVELS.forEach((_, i) => {
    if (isUnlocked(LEVELS, i)) current = i;
  });
  const hero = new Hero(models.hero);
  scene.add(hero.root);
  const heroAt = justUnlocked != null ? justUnlocked - 1 : current;
  hero.reset(spots[heroAt].clone().setY(pedTop), Math.PI / 4);
  stage.onTick((dt) => hero.update(dt));

  // Village at the end of the path, trees and hills around. The forest is thicker and darker.
  const end = spots.at(-1);
  for (const [dx, dz] of [[1.6, -1.2], [2.5, 0.3], [1.4, 1.5]]) {
    const home = copy('cottage');
    home.position.set(end.x + dx, 0, end.z + dz);
    home.rotation.y = Math.PI / 4 + (rand() - 0.5) * 0.4;
    home.scale.setScalar(1.15);
    scene.add(home);
  }
  const flowers = [];
  for (let r = area.z0; r < area.z1; r++)
    for (let c = area.x0; c < area.x1; c++) {
      const x = c + 0.5 + (rand() - 0.5) * 0.4;
      const z = r + 0.5 + (rand() - 0.5) * 0.4;
      if (isWater(c, r) || nearPath(x, z) || Math.hypot(x - end.x - 2, z - end.z) < 2.6) continue;
      const inForest = z > forestFromZ;
      const roll = rand();
      const place = (n, s) => {
        const o = copy(n);
        o.position.set(x, 0, z);
        o.rotation.y = rand() * Math.PI * 2;
        o.scale.setScalar(s);
        scene.add(o);
      };
      if ((x < min.x - 4 || x > max.x + 5) && roll < 0.05) place('hill', 0.8 + rand() * 0.6);
      else if (roll < (inForest ? 0.2 : 0.08)) place(rand() < (inForest ? 0.25 : 0.6) ? 'tree-a' : 'tree-b', 0.9 + rand() * 0.3);
      else if (roll < (inForest ? 0.26 : 0.13)) place('bush', 0.8 + rand() * 0.4);
      else if (roll < (inForest ? 0.35 : 0.5)) flowers.push({ x, z });
    }
  addFlowers(scene, flowers, rand);

  // ---------- camera: a window of the map, scrolled with the wheel or by dragging ----------
  const zMin = () => min.z + viewDepth() / 2 - 1.4;
  const zMax = () => Math.max(zMin(), max.z - viewDepth() / 2 + 1.4);
  const clampZ = (z) => Math.max(zMin(), Math.min(zMax(), z));
  let focus = clampZ(spots[heroAt].z);
  let shown = focus;
  const frameAt = (z) => stage.frame3D(new THREE.Vector3(min.x - 1.4, 0, z - viewDepth() / 2), new THREE.Vector3(max.x + 1.4, 1.2, z + viewDepth() / 2), () => ({ top: 80, bottom: 30 }));
  frameAt(shown);
  stage.onTick((dt) => {
    if (Math.abs(focus - shown) < 0.001) return;
    shown += (focus - shown) * (1 - Math.exp(-dt * 8));
    frameAt(shown);
  });

  // ---------- HTML labels ----------
  ui.innerHTML = `
    <div class="topbar map"><h1>Level Select</h1><span class="title">River Puzzle</span></div>
    <div class="labels"></div>
    <p class="scroll-hint">Scroll or drag to see more levels</p>`;
  const labels = ui.querySelector('.labels');
  const tags = spots.map(() => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    labels.append(tag);
    return tag;
  });
  const signs = LEVELS.map((_, i) => i)
    .filter((i) => i === 0 || areaOf(i) !== areaOf(i - 1))
    .map((i) => {
      const sign = document.createElement('div');
      sign.className = 'area-sign';
      sign.textContent = AREA_NAMES[areaOf(i)] ?? areaOf(i);
      labels.append(sign);
      // First area: just behind its first pedestal. Later areas: on the bridge that leads into them.
      const at = i === 0 ? spots[0].clone().add(new THREE.Vector3(-1.9, 0.5, 0.2)) : spots[i - 1].clone().add(spots[i]).multiplyScalar(0.5).setY(0.6);
      return { sign, at };
    });
  const place = (el, point) => {
    const s = stage.toScreen(point);
    el.style.transform = `translate(${s.x}px, ${s.y}px)`;
  };
  function drawTags() {
    tags.forEach((tag, i) => {
      const open = isUnlocked(LEVELS, i) && !(i === justUnlocked && locks[i]);
      const html = open ? `<b>${i + 1}</b>${starRow(starsFor(LEVELS[i].id))}` : '';
      if (tag.innerHTML !== html) tag.innerHTML = html;
      place(tag, spots[i].clone().setY(pedTop + 1.05));
    });
    signs.forEach(({ sign, at }) => place(sign, at));
  }
  stage.onTick(drawTags);

  // ---------- input ----------
  const canvas = stage.renderer.domElement;
  const pick = (e) => {
    const hit = stage.pointOnPlane(e.clientX, e.clientY, pedTop);
    if (!hit) return -1;
    let best = -1;
    spots.forEach((p, i) => {
      if (Math.hypot(hit.x - p.x, hit.z - p.z) < 0.8) best = i;
    });
    return best;
  };
  let hover = -1;
  let pan = null; // { y, focus, moved } while dragging the map
  const onDown = (e) => {
    if (e.button === 0) pan = { y: e.clientY, x: e.clientX, focus, moved: false };
  };
  const onMove = (e) => {
    if (pan) {
      const dy = e.clientY - pan.y + (e.clientX - pan.x) * 0.5;
      if (Math.abs(dy) > 6) pan.moved = true;
      if (pan.moved) focus = clampZ(pan.focus - dy * 0.03);
    }
    const i = pan?.moved ? -1 : pick(e);
    if (i === hover) return;
    if (hover >= 0) pedestals[hover].scale.setScalar(1);
    hover = i;
    if (i >= 0) pedestals[i].scale.setScalar(1.08);
    canvas.style.cursor = pan?.moved ? 'grabbing' : i >= 0 ? 'pointer' : '';
  };
  const onUp = (e) => {
    const press = pan; // only presses that started on the map count
    pan = null;
    canvas.style.cursor = '';
    if (!press || press.moved || e.button !== 0) return;
    const i = pick(e);
    if (i < 0) return;
    if (locks[i]) {
      sfx.nope();
      const lock = locks[i];
      stage.tween(0.4, (t) => (lock.rotation.z = Math.sin(t * Math.PI * 5) * 0.25 * (1 - t)));
      return;
    }
    sfx.click();
    nav.toLevel(i);
  };
  const onWheel = (e) => {
    e.preventDefault();
    focus = clampZ(focus + e.deltaY * 0.01);
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ---------- a level just opened: pop its padlock, hop the hero over ----------
  if (justUnlocked != null && locks[justUnlocked]) {
    const lock = locks[justUnlocked];
    (async () => {
      await stage.wait(0.6);
      focus = clampZ(spots[justUnlocked].z);
      const y0 = lock.position.y;
      await stage.tween(0.6, (t) => {
        lock.position.y = y0 + Math.sin(t * Math.PI) * 0.8 + t * 0.2;
        lock.rotation.y = Math.PI / 4 + t * Math.PI * 3;
        lock.scale.setScalar(1 - ease.in(t));
      });
      scene.remove(lock);
      locks[justUnlocked] = null;
      sfx.unlock();
      sparkles(stage, scene, spots[justUnlocked].clone().setY(pedTop + 0.3));
      const from = hero.root.position.clone();
      const to = spots[justUnlocked].clone().setY(pedTop);
      hero.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      hero.play('hop', true);
      sfx.hop();
      await stage.tween(0.7, (t) => {
        hero.root.position.lerpVectors(from, to, t);
        hero.root.position.y = pedTop + Math.sin(Math.PI * t) * 0.8;
      }, ease.inOut);
      hero.root.rotation.y = Math.PI / 4;
      hero.play('cheer');
      sfx.win();
      await stage.wait(0.9);
      hero.play('idle');
    })();
  }

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.style.cursor = '';
  };
}
