// The puzzle screen: 3D board, piece tray, dragging, and the walk when you press Go.
import * as THREE from 'three';
import { PIECES, PIECE_TYPES, DEEP, ROCK, START, GOAL, FLOWER, ICE, THIN, LILY, FRAGILE, CURRENTS, isWet, settle, pieceIndexAt, pieceCells, piecesLeft, turnPiece, starsFor } from '../logic/grid.js';
import { planWalk } from '../logic/path.js';
import { buildGround, addFlowers, seeded, WATER_Y } from '../three/ground.js';
import { instance } from '../three/models.js';
import { Hero } from '../three/hero.js';
import { thumbnails } from '../three/thumbs.js';
import { ease, toon, noOutline } from '../three/stage.js';
import { splash, puff, sparkles } from '../three/effects.js';
import { recordStars, starsFor as savedStars } from '../save.js';
import { LEVELS } from '../levels.js';
import { starRow, popup } from './ui.js';
import { sfx } from '../audio.js';
import { RULE_MODELS, rulesIn, newRulesIn, ruleCards } from './rules.js';
import { themeOf, pickTree } from '../three/themes.js';

const MARGIN = 12; // scenery cells around the board
const PIECE_BASE = WATER_Y - 0.07; // pieces sit slightly sunk in the water
const TOUCH_LIFT = 60; // on touch screens the dragged piece sits this many pixels above the finger

export async function showBoard(stage, ui, index, nav) {
  const level = LEVELS[index];
  const { cols, rows } = level;
  const rand = seeded(level.id);

  // ---------- models ----------
  const theme = themeOf(level.id);
  const wanted = [...new Set(['hero', 'cottage', 'rock-a', 'rock-b', 'bush', 'hill', 'flower', ...theme.trees.map(([n]) => n), theme.bush ?? 'bush', ...PIECE_TYPES, ...RULE_MODELS])];
  const models = Object.fromEntries(await Promise.all(wanted.map(async (n) => [n, await instance(n)])));
  const copy = (name) => models[name].object.clone(true);

  // ---------- scene ----------
  const scene = stage.newScene(new THREE.Vector3(cols / 2, 0, rows / 2), Math.max(cols, rows) + 3, theme.sky);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const tileOf = (c, r) => level.tiles[clamp(r, 0, rows - 1)][clamp(c, 0, cols - 1)];
  const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const area = { x0: -MARGIN, z0: -MARGIN, x1: cols + MARGIN, z1: rows + MARGIN };
// Rivers run on past the board edges.
  const waterAt = (c, r) => {
    const t = tileOf(c, r);
    return t === DEEP ? 'deep' : (isWet(t) || t === ICE || FRAGILE.includes(t)) && 'shallow'; // ice and pads float on water
  };
  const isWater = (c, r) => !!waterAt(c, r);
  // Ripples follow the current if there is one, otherwise the way the river leaves the board.
  let along = 0;
  let across = 0;
  for (let r = 0; r < rows; r++) along += isWater(0, r) + isWater(cols - 1, r);
  for (let c = 0; c < cols; c++) across += isWater(c, 0) + isWater(c, rows - 1);
  const currentTile = level.tiles.flat().find((t) => t in CURRENTS);
  const flow = currentTile ? CURRENTS[currentTile] : along >= across ? [1, 0] : [0, 1];
  const landAt = (c, r) => ({ grass: inside(c, r) ? ((c + r) % 2 ? theme.grass : theme.grassAlt) : theme.around, earth: theme.earth });
  buildGround(stage, scene, area, waterAt, landAt, flow, theme.water);

  // Faint tile lines on the board's water, so you can count where pieces will fit.
  const lines = [];
  const y = WATER_Y + 0.012;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!isWet(level.tiles[r][c])) continue;
      lines.push(c, y, r, c + 1, y, r, c + 1, y, r, c + 1, y, r + 1, c + 1, y, r + 1, c, y, r + 1, c, y, r + 1, c, y, r);
    }
  const grid = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)),
    noOutline(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })),
  );
  scene.add(grid);

  // Current: white arrows sliding along each fast-water tile.
  const currents = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (level.tiles[r][c] in CURRENTS) currents.push({ c, r, dir: CURRENTS[level.tiles[r][c]] });
  if (currents.length) {
    const chevron = new THREE.Shape([[-0.1, 0.15], [0.06, 0], [-0.1, -0.15], [-0.16, -0.1], [-0.04, 0], [-0.16, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)));
    const arrows = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(chevron).rotateX(-Math.PI / 2),
      noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })),
      currents.length * 2,
    );
    scene.add(arrows);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    stage.onTick((dt, time) => {
      currents.forEach(({ c, r, dir }, i) => {
        q.setFromAxisAngle(up, Math.atan2(-dir[1], dir[0]));
        for (let k = 0; k < 2; k++) {
          const t = (time * 0.6 + k * 0.5 + (c + r) * 0.13) % 1; // 0..1 across the tile
          const size = Math.sin(t * Math.PI); // grow in, shrink out
          const pos = new THREE.Vector3(c + 0.5 + dir[0] * (t - 0.5) * 0.8, WATER_Y + 0.015, r + 0.5 + dir[1] * (t - 0.5) * 0.8);
          arrows.setMatrixAt(i * 2 + k, m.compose(pos, q, new THREE.Vector3(size, 1, size)));
        }
      });
      arrows.instanceMatrix.needsUpdate = true;
    });
  }

  // Ice sheets, thin ice and lily pads. Thin ice and pads are kept so they can break during the walk.
  const fragileObjs = new Map();
  const iceTop = noOutline(toon(0xbde6f7)); // bluer than snow, so ice reads as ice
  const iceSide = noOutline(toon(0x86c3e2));
  const thinMat = noOutline(toon(0x9fd6ef, { transparent: true, opacity: 0.75 }));
  const crackMat = noOutline(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  const padMat = noOutline(toon(0x5fae3a));
  const veinMat = noOutline(new THREE.LineBasicMaterial({ color: 0x3f7f25 }));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const t = level.tiles[r][c];
      if (t === ICE) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.24, 1), [iceSide, iceSide, iceTop, iceSide, iceSide, iceSide]);
        slab.position.set(c + 0.5, -0.16, r + 0.5);
        slab.receiveShadow = true;
        scene.add(slab);
        const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })));
        shine.position.set(c + 0.35 + rand() * 0.3, -0.035, r + 0.35 + rand() * 0.3);
        scene.add(shine);
      } else if (t === THIN) {
        const g = new THREE.Group();
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.94), thinMat);
        sheet.receiveShadow = true;
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const a = rand() * Math.PI * 2;
          pts.push(0, 0.045, 0, Math.cos(a) * 0.42, 0.045, Math.sin(a) * 0.42);
        }
        g.add(sheet, new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), crackMat));
        g.position.set(c + 0.5, -0.12, r + 0.5);
        scene.add(g);
        fragileObjs.set(`${c},${r}`, g);
      } else if (t === LILY) {
        const g = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28, 1, false, 0.3, Math.PI * 2 - 0.6), padMat);
        pad.receiveShadow = true;
        const veins = [];
        for (let k = 1; k < 6; k++) {
          const a = 0.3 + k * ((Math.PI * 2 - 0.6) / 6);
          veins.push(0, 0.025, 0, Math.sin(a) * 0.36, 0.025, Math.cos(a) * 0.36);
        }
        g.add(pad, new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(veins, 3)), veinMat));
        if (rand() < 0.4) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(0xff9ec7));
          bloom.position.set(0.18, 0.05, 0.12);
          g.add(bloom);
        }
        g.rotation.y = rand() * Math.PI * 2;
        g.position.set(c + 0.5, WATER_Y + 0.02, r + 0.5);
        scene.add(g);
        fragileObjs.set(`${c},${r}`, g);
      }
    }

  // Things standing on the board.
  const flowerSpots = [];
  let flowerObj = null;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const t = level.tiles[r][c];
      if (t === ROCK) {
        const rock = copy(rand() < 0.6 ? 'rock-a' : 'rock-b');
        rock.position.set(c + 0.5, 0, r + 0.5);
        rock.rotation.y = rand() * Math.PI * 2;
        scene.add(rock);
      } else if (t === GOAL) {
        const home = copy('cottage');
        home.position.set(c + 0.5, 0, r + 0.5);
        home.rotation.y = Math.PI / 4; // door towards the camera
        scene.add(home);
      } else if (t === START) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.06, 24), toon(0xd9cfae));
        pad.position.set(c + 0.5, 0.03, r + 0.5);
        pad.receiveShadow = true;
        scene.add(pad);
      } else if (t === FLOWER) {
        flowerObj = copy('flower');
        flowerObj.position.set(c + 0.5, 0, r + 0.5);
        scene.add(flowerObj);
      } else if (theme.flowers !== false && t !== ICE && !FRAGILE.includes(t) && !isWet(t) && rand() < 0.35) {
        flowerSpots.push({ x: c + 0.15 + rand() * 0.7, z: r + 0.15 + rand() * 0.7 });
      }
    }

  // Scenery round the board. Trees in front of the board stay further away so they never hide it.
  for (let r = area.z0; r < area.z1; r++)
    for (let c = area.x0; c < area.x1; c++) {
      if (inside(c, r) || isWater(c, r)) continue;
      const front = c >= cols || r >= rows;
      const d = Math.max(c < 0 ? -c : c >= cols ? c - cols + 1 : 0, r < 0 ? -r : r >= rows ? r - rows + 1 : 0);
      const roll = rand();
      const place = (name, scale) => {
        const o = copy(name);
        o.position.set(c + 0.5 + (rand() - 0.5) * 0.3, 0, r + 0.5 + (rand() - 0.5) * 0.3);
        o.rotation.y = rand() * Math.PI * 2;
        o.scale.setScalar(scale);
        scene.add(o);
      };
      if (theme.hills && !front && d >= 5 && roll < 0.06) place('hill', 0.8 + rand() * 0.5);
      else if (d >= (front ? 4 : 2) && roll < theme.treeDensity) place(pickTree(theme, rand), 0.85 + rand() * 0.3);
      else if (d >= (front ? 3 : 1) && roll < theme.treeDensity + theme.bushDensity) place(theme.bush ?? 'bush', 0.7 + rand() * 0.4);
      else if (roll < 0.6 && theme.flowers !== false) flowerSpots.push({ x: c + rand(), z: r + rand() });
    }
  addFlowers(scene, flowerSpots, rand);
  if (theme.extra) weather(theme.extra);

  // Snow drifting down, or fireflies blinking over the swamp.
  function weather(kind) {
    const n = kind === 'snowfall' ? 260 : 60;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([-4 + rand() * (cols + 8), rand() * 5, -4 + rand() * (rows + 8)], i * 3);
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = noOutline(new THREE.PointsMaterial(kind === 'snowfall'
      ? { color: 0xffffff, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false }
      : { color: 0xfff27a, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
    scene.add(new THREE.Points(geo, mat));
    stage.onTick((dt, time) => {
      for (let i = 0; i < n; i++) {
        if (kind === 'snowfall') {
          pos[i * 3 + 1] -= dt * (0.35 + (i % 5) * 0.06);
          pos[i * 3] += Math.sin(time + i) * dt * 0.1;
          if (pos[i * 3 + 1] < -0.2) pos[i * 3 + 1] = 5;
        } else {
          pos[i * 3 + 1] = 0.4 + ((i * 0.37) % 1.2) + Math.sin(time * 1.3 + i) * 0.15;
          pos[i * 3] += Math.sin(time * 0.7 + i * 2) * dt * 0.15;
        }
      }
      if (kind !== 'snowfall') mat.opacity = 0.55 + Math.sin(time * 3) * 0.35;
      geo.attributes.position.needsUpdate = true;
    });
  }


  // ---------- hero ----------
  const hero = new Hero(models.hero);
  scene.add(hero.root);
  const startPos = () => cellPos(level.start);
  const facingCamera = Math.PI / 4;
  stage.onTick((dt) => hero.update(dt));

  // ---------- state ----------
  let placed = [];
  let history = [];
  let drag = null;
  let busy = false;
  const pieceObjs = [];
  const pieceGroup = new THREE.Group();
  scene.add(pieceGroup);

  function pieceTop(type) {
    return PIECE_BASE + models[type].top;
  }

  // Where the hero stands on a cell. pieces: where the pieces are right now (rafts move during the walk).
  function cellPos(cell, pieces = placed) {
    const i = pieceIndexAt(pieces, cell.col, cell.row);
    const t = level.tiles[cell.row]?.[cell.col];
    const y = i >= 0 ? pieceTop(pieces[i].type) : t === ICE ? -0.04 : t === THIN ? -0.08 : t === LILY ? WATER_Y + 0.04 : isWet(t) ? WATER_Y : 0;
    return new THREE.Vector3(cell.col + 0.5, y, cell.row + 0.5);
  }

  function setPieceTransform(obj, piece, lift = 0) {
    const len = PIECES[piece.type].length;
    const h = piece.dir === 'h';
    obj.position.set(piece.col + (h ? len / 2 : 0.5), PIECE_BASE + lift, piece.row + (h ? 0.5 : len / 2));
    obj.rotation.y = h ? 0 : Math.PI / 2;
  }

  function drawPieces() {
    pieceGroup.clear();
    pieceObjs.length = 0;
    placed.forEach((p, i) => {
      const o = copy(p.type);
      setPieceTransform(o, p);
      o.visible = !(drag && drag.from === i && drag.moved);
      pieceGroup.add(o);
      pieceObjs.push(o);
    });
  }

  stage.onTick((dt, time) => {
    if (flowerObj?.visible) flowerObj.rotation.y = Math.sin(time * 1.5) * 0.3;
    pieceObjs.forEach((o, i) => {
      if (o.visible) o.position.y = PIECE_BASE + Math.sin(time * 2 + i * 1.7) * 0.012;
    });
  });

  // ---------- HUD ----------
  ui.innerHTML = `
    <div class="topbar">
      <button class="btn small" data-act="map">&#8592; Map</button>
      <h1>${index + 1}. ${level.name}</h1>
    </div>
    <p class="rotate-hint">Turn your phone sideways for a bigger board</p>
    <aside class="panel">
      <div class="panel-head"><h2>Pieces</h2><button class="btn small round" data-act="rules" title="Rules for this level">?</button></div>
      <div class="tray"></div>
      <div class="row">
        <button class="btn" data-act="undo">Undo</button>
        <button class="btn" data-act="restart">Restart</button>
      </div>
      <button class="btn go" data-act="go">Go!</button>
      ${level.flower ? '<p class="goal">Pick the flower, then go home.</p>' : ''}
      <p class="hint">Drag pieces onto the water. Click a piece to turn it. Drag it off the board to take it back.</p>
    </aside>`;
  const tray = ui.querySelector('.tray');
  const types = PIECE_TYPES.filter((t) => level.pieces[t]);
  // Pictures of the models, for the tray and the rule cards.
  const picUrls = thumbnails(RULE_MODELS.map((n) => copy(n)));
  const pics = Object.fromEntries(RULE_MODELS.map((n, i) => [n, picUrls[i]]));
  tray.innerHTML = types
    .map((t) => `<div class="slot" data-type="${t}"><img src="${pics[t]}" alt="" draggable="false"><span>${PIECES[t].label}</span><b></b></div>`)
    .join('');

  // Frame the board in the space the top bar and panel leave free. The panel sits on the right,
  // or along the bottom on a portrait screen, depending on the page layout.
  stage.frame3D(new THREE.Vector3(-0.6, -0.3, -0.6), new THREE.Vector3(cols + 0.6, 0.7, rows + 0.6), () => {
    const panel = ui.querySelector('.panel');
    const top = (ui.querySelector('.topbar')?.offsetHeight ?? 58) + 6;
    if (!panel) return { top };
    return panel.offsetTop > window.innerHeight / 2
      ? { top, bottom: window.innerHeight - panel.offsetTop + 8 }
      : { top, right: window.innerWidth - panel.offsetLeft + 8 };
  });

  function showRules(keys, title, lead = '') {
    popup(ui, {
      title,
      body: `${lead ? `<p class="lead">${lead}</p>` : ''}<div class="cards">${ruleCards(keys, pics)}</div>`,
      buttons: [{ label: 'Got it', main: true, act: (close) => close() }],
    });
  }

  function drawTray() {
    const left = piecesLeft(level, placed);
    for (const slot of tray.children) {
      const t = slot.dataset.type;
      const n = left[t] - (drag && drag.from === -1 && drag.type === t ? 1 : 0);
      slot.querySelector('b').textContent = `x${n}`;
      slot.classList.toggle('empty', n <= 0);
    }
    ui.querySelector('[data-act=undo]').disabled = busy || !history.length;
    ui.querySelector('[data-act=restart]').disabled = busy || !placed.length;
    ui.querySelector('[data-act=go]').disabled = busy;
  }

  function refresh() {
    drawPieces();
    drawTray();
    drawDrag();
  }

  // ---------- dragging ----------
  const ghostMat = noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  const ghosts = Array.from({ length: 3 }, () => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), ghostMat);
    scene.add(g);
    return g;
  });
  let dragObj = null;
  let overPanel = false; // pointer is over the panel while dragging

  function isOverPanel(x, y) {
    const r = ui.querySelector('.panel').getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  // lift: while dragging on a touch screen, aim a little above the finger so the piece stays visible.
  function pointerCell(e, lift = false) {
    const x = e.clientX;
    const y = e.clientY - (lift && e.pointerType === 'touch' ? TOUCH_LIFT : 0);
    const hit = stage.pointOnPlane(x, y, -0.1);
    if (!hit || isOverPanel(e.clientX, e.clientY)) return { hit, cell: null };
    const col = Math.floor(hit.x);
    const row = Math.floor(hit.z);
    return { hit, cell: inside(col, row) ? { col, row } : null };
  }

  function dropSpot(d) {
    if (!d.cell) return null;
    const { col, row } = d.cell;
    return d.dir === 'h' ? { type: d.type, dir: d.dir, col: col - d.grab, row } : { type: d.type, dir: d.dir, col, row: row - d.grab };
  }

  function drawDrag() {
    ghosts.forEach((g) => (g.visible = false));
    if (dragObj && (!drag || !drag.moved)) {
      scene.remove(dragObj);
      dragObj = null;
    }
    if (!drag || !drag.moved) return;
    if (!dragObj || dragObj.name !== drag.type) {
      if (dragObj) scene.remove(dragObj);
      dragObj = copy(drag.type);
      dragObj.name = drag.type;
      scene.add(dragObj);
    }
    const spot = dropSpot(drag);
    if (spot) {
      // On a current, show where the piece will end up after drifting.
      const end = settle(level, placed, spot, drag.from);
      ghostMat.color.setHex(end ? 0xffffff : 0xff4a3d);
      pieceCells(end ?? spot).forEach((c, i) => {
        if (!inside(c.col, c.row)) return;
        ghosts[i].visible = true;
        ghosts[i].position.set(c.col + 0.5, WATER_Y + 0.03, c.row + 0.5);
      });
      setPieceTransform(dragObj, spot, 0.45);
      dragObj.visible = true;
    } else if (drag.hit) {
      const len = PIECES[drag.type].length;
      const shift = (len / 2 - 0.5 - drag.grab);
      dragObj.position.set(drag.hit.x + (drag.dir === 'h' ? shift : 0), 0.45, drag.hit.z + (drag.dir === 'v' ? shift : 0));
      dragObj.rotation.y = drag.dir === 'h' ? 0 : Math.PI / 2;
      dragObj.visible = !overPanel;
    }
  }

  function remember() {
    history.push(placed.map((p) => ({ ...p })));
  }

  function turnPlaced(i) {
    if (PIECES[placed[i].type].length === 1) return;
    const turned = turnPiece(level, placed, i);
    if (!turned) {
      sfx.nope();
      return wiggle(pieceObjs[i]);
    }
    remember();
    placed[i] = settle(level, placed, turned, i);
    refresh();
    sfx.turn();
    landed(turned);
    drift(i, turned);
  }

  // Slide piece i from where it was dropped to where the current carried it.
  function drift(i, from) {
    const obj = pieceObjs[i];
    const to = obj.position.clone();
    setPieceTransform(obj, from);
    const start = obj.position.clone();
    const far = start.distanceTo(to);
    if (far < 0.01) return;
    sfx.drift();
    stage.tween(0.25 + far * 0.18, (t) => {
      obj.position.x = start.x + (to.x - start.x) * t;
      obj.position.z = start.z + (to.z - start.z) * t;
    }, ease.out);
  }

  function wiggle(obj) {
    if (!obj) return;
    const y = obj.rotation.y;
    stage.tween(0.3, (t) => (obj.rotation.y = y + Math.sin(t * Math.PI * 4) * 0.12 * (1 - t)));
  }

  function landed(piece) {
    sfx.place();
    const cells = pieceCells(piece);
    const mid = cells[Math.floor((cells.length - 1) / 2)];
    puff(stage, scene, new THREE.Vector3(mid.col + 0.5 + (piece.dir === 'h' && cells.length === 2 ? 0.5 : 0), WATER_Y + 0.05, mid.row + 0.5 + (piece.dir === 'v' && cells.length === 2 ? 0.5 : 0)));
  }

  const listeners = [];
  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener(type, fn));
  };
  const canvas = stage.renderer.domElement;

  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(canvas, 'pointerdown', (e) => {
    if (busy) return;
    const { hit, cell } = pointerCell(e);
    if (e.button === 2) {
      if (drag) return turnDragged();
      const i = cell ? pieceIndexAt(placed, cell.col, cell.row) : -1;
      if (i >= 0) turnPlaced(i);
      return;
    }
    const i = cell ? pieceIndexAt(placed, cell.col, cell.row) : -1;
    if (i < 0) return;
    const p = placed[i];
    const grab = pieceCells(p).findIndex((c) => c.col === cell.col && c.row === cell.row);
    drag = { type: p.type, dir: p.dir, grab, from: i, hit, cell, sx: e.clientX, sy: e.clientY, moved: false };
  });
  on(tray, 'pointerdown', (e) => {
    const slot = e.target.closest('.slot');
    if (busy || !slot || e.button !== 0) return;
    const type = slot.dataset.type;
    if (piecesLeft(level, placed)[type] <= 0) return;
    e.preventDefault();
    const len = PIECES[type].length;
    drag = { type, dir: 'h', grab: Math.floor((len - 1) / 2), from: -1, hit: null, cell: null, sx: e.clientX, sy: e.clientY, moved: true };
    sfx.pickup();
    refresh();
  });
  on(window, 'pointermove', (e) => {
    if (!drag) return;
    const { hit, cell } = pointerCell(e, true);
    drag.hit = hit;
    drag.cell = cell;
    overPanel = isOverPanel(e.clientX, e.clientY);
    // Fingers wobble more than a mouse, so a tap needs a bigger allowance before it counts as a drag.
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (e.pointerType === 'touch' ? 14 : 6)) {
      drag.moved = true;
      sfx.pickup();
      drawPieces();
    }
    drawDrag();
  });
  on(window, 'pointerup', (e) => {
    if (!drag || e.button === 2) return;
    const d = drag;
    drag = null;
    if (d.from >= 0 && !d.moved) return turnPlaced(d.from);
    const spot = dropSpot(d);
    const end = spot && settle(level, placed, spot, d.from);
    if (end) {
      remember();
      const i = d.from >= 0 ? d.from : placed.length;
      placed[i] = end;
      refresh();
      landed(spot);
      drift(i, spot);
      return;
    }
    if (d.from >= 0 && !d.cell) {
      remember();
      placed.splice(d.from, 1);
      sfx.remove();
    } else if (d.cell) {
      sfx.nope();
    } else {
      sfx.remove();
    }
    refresh();
  });
  on(window, 'keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') turnDragged();
    if (e.key === 'z' || e.key === 'Z') undo();
    if (e.key === ' ') go();
  });

  function turnDragged() {
    if (!drag) return;
    drag.dir = drag.dir === 'h' ? 'v' : 'h';
    drag.moved = true;
    sfx.turn();
    refresh();
  }

  function undo() {
    if (busy || drag || !history.length) return;
    placed = history.pop();
    refresh();
  }

  function restart() {
    if (busy || drag || !placed.length) return;
    remember();
    placed = [];
    refresh();
  }

  // ---------- walking ----------
  function face(from, to) {
    hero.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  }

  // live: piece positions during the walk (rafts move as they carry the hero).
  let live = placed;
  async function step(a, b, portion = 1) {
    // A raft carrying the hero: raft and hero float on together.
    if (b.how === 'ride') {
      const from = cellPos(a, live);
      live = live.map((p, i) => (i === b.raft ? { ...p, col: b.col, row: b.row } : p));
      const to = cellPos(b, live);
      const raft = pieceObjs[b.raft];
      const r0 = raft.position.clone();
      const r1 = new THREE.Vector3(b.col + 0.5, r0.y, b.row + 0.5);
      hero.play('idle');
      sfx.drift();
      await stage.tween(0.45, (t) => {
        hero.root.position.lerpVectors(from, to, t);
        raft.position.x = r0.x + (r1.x - r0.x) * t;
        raft.position.z = r0.z + (r1.z - r0.z) * t;
      });
      return;
    }
    const from = cellPos(a, live);
    const to = cellPos(b, live);
    face(from, to);
    breakBehind(a);
    // Sliding on ice: no steps, just glide.
    if (b.how === 'slide') {
      hero.play('idle');
      sfx.slide();
      await stage.tween(0.16, (t) => hero.root.position.lerpVectors(from, to, t));
      return;
    }
    const onSolid = (c) => ['stone', 'raft'].includes(live[pieceIndexAt(live, c.col, c.row)]?.type) || level.tiles[c.row]?.[c.col] === LILY;
    const hop = Math.abs(to.y - from.y) > 0.04 || onSolid(a) || onSolid(b);
    hero.play(hop ? 'hop' : 'walk', hop);
    (hop ? sfx.hop : sfx.step)();
    await stage.tween(hop ? 0.4 : 0.3, (t) => {
      hero.root.position.lerpVectors(from, to, t * portion);
      hero.root.position.y = from.y + (to.y - from.y) * t + (hop ? Math.sin(Math.PI * t) * 0.25 : 0);
    });
  }

  // Thin ice cracks and lily pads sink as the hero steps off them.
  function breakBehind(cell) {
    const obj = fragileObjs.get(`${cell.col},${cell.row}`);
    if (!obj || !obj.visible) return;
    sfx.crack();
    const y0 = obj.position.y;
    stage.tween(0.6, (t) => {
      obj.position.y = y0 - t * 0.35;
      obj.scale.setScalar(1 - t * 0.4);
      obj.rotation.z = t * 0.3;
      if (t === 1) obj.visible = false;
    }, ease.in);
    puff(stage, scene, new THREE.Vector3(cell.col + 0.5, WATER_Y + 0.05, cell.row + 0.5));
  }

  function mendTiles() {
    for (const [k, obj] of fragileObjs) {
      const [c, r] = k.split(',').map(Number);
      obj.visible = true;
      obj.scale.setScalar(1);
      obj.rotation.z = 0;
      obj.position.y = level.tiles[r][c] === LILY ? WATER_Y + 0.02 : -0.12;
    }
  }

  // Camera behind the hero while walking; in front of them for the cheer.
  let camFront = false;
  function heroPose() {
    const p = hero.root.position;
    const a = hero.root.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    if (camFront) return { eye: p.clone().addScaledVector(fwd, 2.2).add(new THREE.Vector3(0, 1.2, 0)), look: p.clone().add(new THREE.Vector3(0, 0.35, 0)) };
    return { eye: p.clone().addScaledVector(fwd, -2.4).add(new THREE.Vector3(0, 1.9, 0)), look: p.clone().addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, 0.2, 0)) };
  }

  async function go() {
    if (busy || drag) return;
    busy = true;
    drawTray();
    ui.classList.add('walking');
    camFront = false;
    stage.follow(heroPose);
    await stage.wait(0.5);
    live = placed;
    const plan = planWalk(level, placed);
    const path = plan.path;
    for (let i = 1; i < path.length; i++) {
      const last = plan.result === 'win' && i === path.length - 1;
      await step(path[i - 1], path[i], last ? 0.45 : 1);
      if (i === plan.flowerAt) await pickFlower();
    }
    if (plan.result === 'win') return win();
    if (plan.result === 'splash') return fall(path.at(-1), plan.splashAt, plan);
    hero.play('idle');
    sfx.fail();
    await stage.tween(0.6, (t) => (hero.root.rotation.y = facingCamera + Math.sin(t * Math.PI * 4) * 0.5));
    showFail('Stuck!', 'Rocks block every way.');
  }

  async function pickFlower() {
    hero.play('cheer');
    sfx.collect();
    sparkles(stage, scene, flowerObj.position.clone().setY(0.5));
    await stage.tween(0.4, (t) => {
      flowerObj.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.5 - t);
      flowerObj.position.y = t * 0.6;
    });
    flowerObj.visible = false;
  }

  async function fall(from, into, plan) {
    breakBehind(from);
    const a = cellPos(from, live);
    const b = new THREE.Vector3(into.col + 0.5, WATER_Y, into.row + 0.5);
    face(a, b);
    hero.play('fall');
    await stage.tween(0.45, (t) => {
      hero.root.position.lerpVectors(a, b, t * 0.8);
      hero.root.position.y = a.y + Math.sin(Math.PI * t * 0.8) * 0.3 - t * 0.2;
      if (!hero.hasClip('fall')) hero.body.rotation.x = t * 0.6;
    });
    splash(stage, scene, hero.root.position);
    sfx.splash();
    await stage.tween(0.35, (t) => {
      hero.root.position.y = WATER_Y - 0.1 - t * 0.6;
      hero.root.scale.setScalar(1 - t * 0.5);
    }, ease.in);
    hero.root.visible = false;
    await stage.wait(0.5);
    sfx.fail();
    const card = { gap: null, slid: 'ice', cracked: plan.piece === LILY ? 'lily' : 'thin' }[plan.why] ?? plan.piece;
    showFail('Splash!', fallReason(plan), card ? [card] : []);
  }

  async function win() {
    hero.root.rotation.y = facingCamera;
    camFront = true;
    stage.follow(heroPose, 0.9);
    hero.play('cheer');
    sfx.win();
    sparkles(stage, scene, cellPos(level.goal).add(new THREE.Vector3(0, 0.9, 0)));
    await stage.wait(1.4);
    const used = placed.length;
    const stars = starsFor(level, used);
    const before = recordStars(level.id, stars);
    const unlocked = before === 0 && index + 1 < LEVELS.length ? index + 1 : null;
    const last = index === LEVELS.length - 1;
    popup(ui, {
      title: 'Made it!',
      body: `${starRow(stars, true)}<p>${stars === 3 ? `Used ${used} piece${used === 1 ? '' : 's'}. Perfect!` : `Used ${used}. Can you do it with ${level.par}?`}</p>`,
      buttons: [
        { label: 'Map', act: () => nav.toMap(unlocked) },
        { label: 'Replay', act: () => nav.toLevel(index) },
        last ? null : { label: 'Next', main: true, act: () => nav.toLevel(index + 1) },
      ],
    });
  }

  // Why the hero fell, in plain words.
  function fallReason(plan) {
    const name = PIECES[plan.piece]?.label.toLowerCase();
    if (plan.why === 'side-off') return `The hero can’t step off the side of a ${name}, only off its ends. Put a stone where the path turns.`;
    if (plan.why === 'side-on') return `The hero can’t step onto the side of a ${name}, only onto its ends.`;
    if (plan.why === 'cracked') return plan.piece === LILY ? 'Lily pads sink after one step, so the hero can’t use one twice.' : 'Thin ice cracks after one step, so the hero can’t cross it twice.';
    if (plan.why === 'slid') return 'The hero slid across the ice into the water. Something has to stop them at the end of the ice.';
    return `No dry path to the ${level.flower && plan.flowerAt < 0 ? 'flower' : 'cottage'}.`;
  }

  // cards: rule cards to show under the message (the rule that was broken).
  function showFail(title, why, cards = []) {
    popup(ui, {
      title,
      body: `<p>${why}</p>${cards.length ? `<div class="cards">${ruleCards(cards, pics)}</div>` : ''}`,
      buttons: [
        {
          label: 'Try again',
          main: true,
          act: async (close) => {
            close();
            await stage.unfollow();
            ui.classList.remove('walking');
            hero.reset(startPos(), facingCamera);
            mendTiles();
            live = placed;
            drawPieces(); // rafts back where they were placed
            if (flowerObj) {
              flowerObj.visible = true;
              flowerObj.scale.setScalar(1);
              flowerObj.position.y = 0;
            }
            busy = false;
            drawTray();
          },
        },
      ],
    });
  }

  ui.querySelector('[data-act=map]').onclick = () => !busy && nav.toMap(null);
  ui.querySelector('[data-act=undo]').onclick = undo;
  ui.querySelector('[data-act=restart]').onclick = restart;
  ui.querySelector('[data-act=go]').onclick = go;
  ui.querySelector('[data-act=rules]').onclick = () => showRules(rulesIn(level), 'Rules');

  hero.reset(startPos(), facingCamera);
  refresh();
  // Anything new in this level is taught before you start (until the level has been won).
  const fresh = newRulesIn(LEVELS, index);
  if (!savedStars(level.id) && (fresh.length || level.tip)) showRules(fresh, fresh.length ? 'New!' : 'Tip', level.tip);

  return () => {
    listeners.forEach((off) => off());
    ui.classList.remove('walking');
  };
}
