// Where the character can walk, and what happens when you press Go.
//
// - Planks and logs are walked along their length: step on and off only at the ends.
//   Stones and rafts can be stepped on from any side.
// - Ice (I): once on it, the hero slides straight on until something stops them.
//   A rock or the board edge stops them on the ice; sliding into water means falling in.
// - Thin ice (T) and lily pads (L) hold the hero once, then break as they step off.
// - A raft on a current carries the hero downstream until it bumps into something.
// - If the level has a flower, the hero picks it first, then goes home.
//
// The search follows the whole state: hero cell, flower picked, broken tiles, raft positions.

import { PIECES, ROCK, ICE, FRAGILE, CURRENTS, tileAt, pieceCells, pieceIndexAt, isWet, isFooting } from './grid.js';

const STEPS = [
  { dc: 1, dr: 0, axis: 'h' },
  { dc: -1, dr: 0, axis: 'h' },
  { dc: 0, dr: 1, axis: 'v' },
  { dc: 0, dr: -1, axis: 'v' },
];

const fits = (f, axis) => f === 'any' || f === axis;
const distance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
const same = (a, b) => a && b && a.col === b.col && a.row === b.row;

function rules(level, placed) {
  // Footing that never changes: land, ice, fragile tiles, and pieces other than rafts.
  const foot = level.tiles.map((line) => line.map((t) => (isFooting(t) ? 'any' : null)));
  for (const p of placed) {
    if (p.type === 'raft') continue;
    const axis = PIECES[p.type].length === 1 ? 'any' : p.dir;
    for (const { col, row } of pieceCells(p)) foot[row][col] = axis;
  }
  const fragile = [];
  level.tiles.forEach((line, row) => line.forEach((t, col) => FRAGILE.includes(t) && fragile.push({ col, row })));
  const fragileBit = (c) => {
    const i = fragile.findIndex((f) => same(f, c));
    return i < 0 ? 0 : 1 << i;
  };
  const rafts = placed.flatMap((p, i) => (p.type === 'raft' ? [i] : []));
  const staticPieces = placed.filter((p) => p.type !== 'raft');
  return { foot, fragileBit, rafts, staticPieces };
}

// Try one move from a standing state. Returns { state, cells } where cells are the tiles passed through,
// { fall: { cells, at, why, piece } } if the hero would end up in the water, or null if simply blocked.
function move(level, placed, R, st, s) {
  const raftAt = (rafts, c) => rafts.findIndex((r) => same(r, c));
  const footAt = (c, mask, rafts) => {
    if (raftAt(rafts, c) >= 0) return 'any';
    if (R.fragileBit(c) & mask) return null; // already broken
    return R.foot[c.row][c.col];
  };
  let mask = st.mask;
  let rafts = st.rafts;
  let cur = { col: st.col, row: st.row };
  const cells = [];
  const step = (to, how) => {
    mask |= R.fragileBit(cur); // thin ice and lily pads break as the hero steps off
    cur = to;
    cells.push({ ...to, how });
  };

  const to = { col: cur.col + s.dc, row: cur.row + s.dr };
  const t = tileAt(level, to.col, to.row);
  if (t === null) return null;
  const fromFoot = footAt(cur, mask, rafts);
  const toFoot = footAt(to, mask, rafts);
  if (!toFoot || !fits(fromFoot, s.axis) || !fits(toFoot, s.axis)) {
    const broken = !!(R.fragileBit(to) & mask);
    if (!isWet(t) && !broken) return null; // rock or the like: just can't go there
    const offSide = fromFoot !== 'any' && fromFoot !== s.axis;
    const onSide = !offSide && toFoot && toFoot !== 'any' && toFoot !== s.axis;
    const pieceAt = (c) => placed[pieceIndexAt(placed, c.col, c.row)]?.type;
    const why = offSide ? 'side-off' : onSide ? 'side-on' : broken ? 'cracked' : 'gap';
    return { fall: { cells, at: to, why, piece: offSide ? pieceAt(cur) : onSide ? pieceAt(to) : broken ? t : null } };
  }
  step(to, 'walk');

  // Slide across ice until something stops the hero.
  while (tileAt(level, cur.col, cur.row) === ICE) {
    const n = { col: cur.col + s.dc, row: cur.row + s.dr };
    const nt = tileAt(level, n.col, n.row);
    if (nt === null || nt === ROCK) break; // bumped into the edge or a rock: stop on the ice
    const nf = footAt(n, mask, rafts);
    if (nf && fits(nf, s.axis)) {
      step(n, 'slide');
      continue;
    }
    return { fall: { cells, at: n, why: 'slid', piece: null } };
  }

  // A raft on a current floats downstream with the hero on board.
  const ri = raftAt(rafts, cur);
  if (ri >= 0) {
    rafts = rafts.map((r) => ({ ...r }));
    for (let guard = 0; guard < 60; guard++) {
      const dir = CURRENTS[tileAt(level, cur.col, cur.row)];
      if (!dir) break;
      const n = { col: cur.col + dir[0], row: cur.row + dir[1] };
      const free = isWet(tileAt(level, n.col, n.row)) && pieceIndexAt(R.staticPieces, n.col, n.row) < 0 && raftAt(rafts, n) < 0;
      if (!free) break;
      rafts[ri] = n;
      cells.push({ ...n, how: 'ride', raft: R.rafts[ri] });
      cur = n;
    }
  }

  const picked = st.picked || (level.flower && cells.some((c) => same(c, level.flower)));
  return { state: { col: cur.col, row: cur.row, picked, mask, rafts }, cells };
}

const keyOf = (st) => `${st.col},${st.row},${st.picked ? 1 : 0},${st.mask},${st.rafts.map((r) => `${r.col}.${r.row}`).join(';')}`;

// What happens on Go:
//   { result: 'win', path, flowerAt }
//   { result: 'splash', path, splashAt, why, piece, flowerAt }  goes as far as it can, then falls in
//   { result: 'stuck', path, flowerAt }                        nowhere wet to fall into (walled off by rocks)
// path: cells in order; each after the first says how the hero got there ('walk', 'slide' or 'ride' with raft index).
// flowerAt is the index in path where the flower is picked (or -1).
// why: 'side-off' / 'side-on' (plank or log side, piece = its type), 'cracked' (piece = tile), 'slid', 'gap'.
export function planWalk(level, placed) {
  const R = rules(level, placed);
  const start = { col: level.start.col, row: level.start.row, picked: !level.flower, mask: 0, rafts: R.rafts.map((i) => ({ col: placed[i].col, row: placed[i].row })) };
  const parent = new Map([[keyOf(start), null]]);
  const states = [start];
  let goal = null;
  for (let i = 0; i < states.length && !goal; i++) {
    const st = states[i];
    for (const s of STEPS) {
      const res = move(level, placed, R, st, s);
      if (!res?.state) continue;
      const k = keyOf(res.state);
      if (parent.has(k)) continue;
      parent.set(k, { from: st, cells: res.cells });
      states.push(res.state);
      if (res.state.picked && same(res.state, level.goal)) {
        goal = res.state;
        break;
      }
    }
  }

  const pathTo = (st) => {
    const parts = [];
    for (let k = keyOf(st); parent.get(k); ) {
      const p = parent.get(k);
      parts.unshift(p.cells);
      k = keyOf(p.from);
    }
    return [{ col: level.start.col, row: level.start.row }, ...parts.flat()];
  };
  const flowerIndex = (path) => (level.flower ? path.findIndex((c) => same(c, level.flower)) : -1);

  if (goal) {
    const path = pathTo(goal);
    return { result: 'win', path, flowerAt: flowerIndex(path) };
  }

  // No way home: find the most telling way to fall in. Mistakes with plank sides and cracked tiles come first,
  // then slides, then plain open water; later in the walk (flower picked) and closer to the target is better.
  const rank = { 'side-off': 0, 'side-on': 0, cracked: 0, slid: 5e5, gap: 1e6 };
  let best = null;
  for (const st of states) {
    const target = st.picked ? level.goal : level.flower;
    for (const s of STEPS) {
      const res = move(level, placed, R, st, s);
      if (!res?.fall) continue;
      const before = pathTo(st);
      const score = rank[res.fall.why] - (st.picked && level.flower ? 1e7 : 0) + distance(res.fall.at, target) * 1000 + before.length;
      if (!best || score < best.score) best = { score, path: [...before, ...res.fall.cells], ...res.fall };
    }
  }
  if (!best) return { result: 'stuck', path: [{ ...level.start }], flowerAt: -1 };
  return { result: 'splash', path: best.path, splashAt: best.at, why: best.why, piece: best.piece, flowerAt: flowerIndex(best.path) };
}

export function solves(level, placed) {
  return planWalk(level, placed).result === 'win';
}

// Every cell the hero could get to with these pieces (ignoring tiles breaking). The level checker
// uses it to only try pieces next to somewhere the hero can already reach.
export function reachable(level, placed) {
  const R = rules(level, placed);
  const start = { col: level.start.col, row: level.start.row, picked: true, mask: 0, rafts: R.rafts.map((i) => ({ col: placed[i].col, row: placed[i].row })) };
  const seen = new Set([keyOf(start)]);
  const cells = new Set([`${start.col},${start.row}`]);
  const queue = [start];
  while (queue.length) {
    const st = queue.shift();
    for (const s of STEPS) {
      const res = move(level, placed, R, st, s);
      // Tiles passed on a slide that ends in the water count too: a piece there could catch the hero.
      res?.fall?.cells.forEach((c) => cells.add(`${c.col},${c.row}`));
      if (!res?.state) continue;
      res.cells.forEach((c) => cells.add(`${c.col},${c.row}`));
      const free = { ...res.state, mask: 0 };
      const k = keyOf(free);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(free);
      }
    }
  }
  return cells;
}
