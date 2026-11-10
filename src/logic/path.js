// Where the character can walk, and what happens when you press Go.
//
// Planks and logs are walked along their length: you can only step on or off
// them at the ends. Stones can be stepped on from any side.
// If the level has a flower, the hero picks it first, then goes home.

import { PIECES, tileAt, pieceCells, pieceIndexAt, isWet, isLand } from './grid.js';

const STEPS = [
  { dc: 1, dr: 0, axis: 'h' },
  { dc: -1, dr: 0, axis: 'h' },
  { dc: 0, dr: 1, axis: 'v' },
  { dc: 0, dr: -1, axis: 'v' },
];

// For each cell: null (can't stand), 'any' (land or stone), or 'h'/'v' (plank or log axis).
function footing(level, placed) {
  const map = level.tiles.map((line) => line.map((t) => (isLand(t) ? 'any' : null)));
  for (const p of placed) {
    const axis = PIECES[p.type].length === 1 ? 'any' : p.dir;
    for (const { col, row } of pieceCells(p)) map[row][col] = axis;
  }
  return map;
}

const fits = (f, axis) => f === 'any' || f === axis;
const distance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

// Breadth-first search from `from`. Gives every reachable cell and the shortest path to each.
function explore(level, foot, from) {
  const key = (c, r) => r * level.cols + c;
  const parent = new Map([[key(from.col, from.row), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const s of STEPS) {
      const col = cur.col + s.dc;
      const row = cur.row + s.dr;
      if (tileAt(level, col, row) === null || parent.has(key(col, row))) continue;
      if (!fits(foot[cur.row][cur.col], s.axis) || !fits(foot[row][col], s.axis)) continue;
      parent.set(key(col, row), cur);
      queue.push({ col, row });
    }
  }
  const pathTo = (cell) => {
    const path = [];
    for (let c = cell; c; c = parent.get(key(c.col, c.row))) path.unshift(c);
    return path;
  };
  return {
    reached: (c) => parent.has(key(c.col, c.row)),
    pathTo,
    cells: [...parent.keys()].map((k) => ({ col: k % level.cols, row: Math.floor(k / level.cols) })),
  };
}

// One leg of the walk: reach `target`, or get as close as possible and fall in.
// A splash also says why:
//   why 'side-off'  tried to step off the side of a plank or log (piece = its type)
//   why 'side-on'   tried to step onto the side of a plank or log
//   why 'gap'       open water in the way
function leg(level, placed, foot, from, target) {
  const { reached, pathTo, cells } = explore(level, foot, from);
  if (reached(target)) return { result: 'win', path: pathTo(target) };
  const pieceAt = (c) => placed[pieceIndexAt(placed, c.col, c.row)]?.type;
  let best = null;
  for (const c of cells) {
    for (const s of STEPS) {
      const to = { col: c.col + s.dc, row: c.row + s.dr };
      if (!isWet(tileAt(level, to.col, to.row)) || reached(to)) continue;
      // A step blocked only by the plank rule is almost always the path the player meant, so explain that first.
      const offSide = foot[c.row][c.col] !== 'any' && foot[c.row][c.col] !== s.axis;
      const onSide = !offSide && foot[to.row][to.col] !== null && foot[to.row][to.col] !== 'any' && foot[to.row][to.col] !== s.axis;
      const why = offSide ? 'side-off' : onSide ? 'side-on' : 'gap';
      const score = (why === 'gap' ? 1e6 : 0) + distance(to, target) * 1000 + pathTo(c).length;
      if (!best || score < best.score) best = { score, from: c, to, why, piece: offSide ? pieceAt(c) : onSide ? pieceAt(to) : null };
    }
  }
  if (!best) return { result: 'stuck', path: [from] };
  return { result: 'splash', path: pathTo(best.from), splashAt: best.to, why: best.why, piece: best.piece };
}

// What happens on Go:
//   { result: 'win', path, flowerAt }
//   { result: 'splash', path, splashAt, why, piece, flowerAt }  walks as close as it can, then falls in
//   { result: 'stuck', path, flowerAt }                        nowhere wet to fall into (walled off by rocks)
// flowerAt is the index in path where the flower is picked (or -1).
export function planWalk(level, placed) {
  const foot = footing(level, placed);
  if (!level.flower) return { ...leg(level, placed, foot, level.start, level.goal), flowerAt: -1 };
  const first = leg(level, placed, foot, level.start, level.flower);
  if (first.result !== 'win') return { ...first, flowerAt: -1 };
  const second = leg(level, placed, foot, level.flower, level.goal);
  return { ...second, path: [...first.path, ...second.path.slice(1)], flowerAt: first.path.length - 1 };
}

export function solves(level, placed) {
  return planWalk(level, placed).result === 'win';
}
