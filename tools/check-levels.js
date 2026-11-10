// Checks every level in levels/: can it be solved, and what is the fewest pieces (par)?
// Usage: node tools/check-levels.js
import { readFileSync, readdirSync } from 'node:fs';
import { parseLevel, PIECES, PIECE_TYPES, CURRENTS, canPlace, settle, pieceCells } from '../src/logic/grid.js';
import { solves, reachable } from '../src/logic/path.js';

const dir = new URL('../levels/', import.meta.url);

// Every spot each piece type could be dropped on an empty board.
function candidates(level) {
  const list = [];
  for (const type of PIECE_TYPES) {
    if (!level.pieces[type]) continue;
    for (const d of PIECES[type].length === 1 ? ['h'] : ['h', 'v'])
      for (let row = 0; row < level.rows; row++)
        for (let col = 0; col < level.cols; col++) {
          const piece = { type, col, row, dir: d };
          if (canPlace(level, [], piece)) list.push(piece);
        }
  }
  return list;
}

// Calm water: every piece on the hero's route touches the part of the route before it, so only try
// pieces next to somewhere the hero can already reach. Arrangements already tried are skipped.
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function solveCalm(level, list, n) {
  const left = { ...level.pieces };
  const placed = [];
  const seen = new Set();
  const key = () => placed.map((p) => `${p.type}${p.col},${p.row}${p.dir}`).sort().join('|');
  const search = () => {
    if (placed.length === n) return solves(level, placed) ? [...placed] : null;
    const R = reachable(level, placed);
    const near = (p) => pieceCells(p).some((c) => SIDES.some(([dc, dr]) => R.has(`${c.col + dc},${c.row + dr}`)));
    for (const p of list) {
      if (!left[p.type] || !canPlace(level, placed, p) || !near(p)) continue;
      left[p.type]--;
      placed.push(p);
      const k = key();
      const found = seen.has(k) ? null : (seen.add(k), search());
      placed.pop();
      left[p.type]++;
      if (found) return found;
    }
    return null;
  };
  return search();
}

// Currents and rafts: where a piece ends up depends on what is already there, so drops are tried in
// every order. A piece must touch somewhere the hero can reach, or another piece it might be stopped by.
function solveDrifting(level, list, n) {
  const left = { ...level.pieces };
  const placed = [];
  const seen = new Set();
  const key = () => placed.map((p) => `${p.type}${p.col},${p.row}${p.dir}`).sort().join('|');
  const search = () => {
    if (placed.length === n) return solves(level, placed) ? [...placed] : null;
    const R = reachable(level, placed);
    for (const p of placed) for (const c of pieceCells(p)) R.add(`${c.col},${c.row}`);
    const near = (p) => pieceCells(p).some((c) => SIDES.some(([dc, dr]) => R.has(`${c.col + dc},${c.row + dr}`)));
    for (const drop of list) {
      if (!left[drop.type]) continue;
      const p = settle(level, placed, drop);
      if (!p || !(near(drop) || near(p))) continue; // dropped near the hero, or drifted up against something
      left[p.type]--;
      placed.push(p);
      const k = key();
      const found = seen.has(k) ? null : (seen.add(k), search());
      placed.pop();
      left[p.type]++;
      if (found) return found;
    }
    return null;
  };
  return search();
}

let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const level = parseLevel(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
  const list = candidates(level);
  // Currents and rafts: pieces can matter as blockers away from the route, so try everything.
  const drifting = level.tiles.some((line) => line.some((t) => t in CURRENTS)) || level.pieces.raft > 0;
  const total = Object.values(level.pieces).reduce((a, b) => a + b, 0);
  const t0 = Date.now();
  let best = null;
  for (let n = 0; n <= total && !best; n++) best = (drifting ? solveDrifting : solveCalm)(level, list, n);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!best) {
    console.log(`FAIL  ${file}: cannot be solved with the pieces given`);
    failed++;
  } else if (best.length !== level.par) {
    console.log(`FAIL  ${file}: par is ${level.par} but it can be solved with ${best.length}  (${describe(best)})`);
    failed++;
  } else {
    console.log(`ok    ${file}: par ${level.par}  (${describe(best)})  ${secs}s`);
  }
}
process.exit(failed ? 1 : 0);

function describe(pieces) {
  return pieces.map((p) => `${p.type}@${p.col},${p.row}${PIECES[p.type].length > 1 ? p.dir : ''}`).join(' ');
}
