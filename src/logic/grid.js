// Game rules for the grid and the pieces. No drawing here.
//
// Level map characters:
//   .  grass      ~  water      #  rock
//   S  start      H  goal (the cottage)
//   =  deep water (stones sink, planks and logs float)
//   > < v ^  fast current: pieces dropped here drift that way until something stops them
//   F  flower the hero must pick before going home

export const GRASS = '.';
export const WATER = '~';
export const DEEP = '=';
export const ROCK = '#';
export const START = 'S';
export const GOAL = 'H';
export const FLOWER = 'F';
// Current tiles and the way they flow, as [columns, rows].
export const CURRENTS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] };
const TILES = [GRASS, WATER, DEEP, ROCK, START, GOAL, FLOWER, ...Object.keys(CURRENTS)];

export const isWet = (t) => t === WATER || t === DEEP || t in CURRENTS;
export const isLand = (t) => t === GRASS || t === START || t === GOAL || t === FLOWER;

// length = how many water tiles the piece covers in a straight line.
export const PIECES = {
  stone: { length: 1, label: 'Stone' },
  plank: { length: 2, label: 'Plank' },
  log: { length: 3, label: 'Log' },
};
export const PIECE_TYPES = Object.keys(PIECES);

export function parseLevel(data) {
  const rows = data.map.length;
  const cols = data.map[0].length;
  let start = null;
  let goal = null;
  let flower = null;
  const tiles = data.map.map((line, row) => {
    if (line.length !== cols) throw new Error(`${data.id}: row ${row} has ${line.length} tiles, expected ${cols}`);
    return [...line].map((ch, col) => {
      if (!TILES.includes(ch)) throw new Error(`${data.id}: unknown tile "${ch}" at ${col},${row}`);
      if (ch === START) start = { col, row };
      if (ch === GOAL) goal = { col, row };
      if (ch === FLOWER) flower = { col, row };
      return ch;
    });
  });
  if (!start || !goal) throw new Error(`${data.id}: map needs one S and one H`);
  const pieces = {};
  for (const type of PIECE_TYPES) pieces[type] = data.pieces?.[type] ?? 0;
  return { id: data.id, name: data.name, tip: data.tip, cols, rows, tiles, start, goal, flower, pieces, par: data.par };
}

export function tileAt(level, col, row) {
  if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) return null;
  return level.tiles[row][col];
}

// A piece is { type, col, row, dir } where (col,row) is its first cell and
// dir 'h' runs right, 'v' runs down.
export function pieceCells(piece) {
  const len = PIECES[piece.type].length;
  return Array.from({ length: len }, (_, i) =>
    piece.dir === 'h' ? { col: piece.col + i, row: piece.row } : { col: piece.col, row: piece.row + i },
  );
}

// Index of the placed piece covering a cell, or -1.
export function pieceIndexAt(placed, col, row) {
  return placed.findIndex((p) => pieceCells(p).some((c) => c.col === col && c.row === row));
}

// Every cell must be water not covered by another piece, and stones can't go in deep water.
// ignoreIndex lets a placed piece be moved or turned without blocking itself.
export function canPlace(level, placed, piece, ignoreIndex = -1) {
  return pieceCells(piece).every(({ col, row }) => {
    const t = tileAt(level, col, row);
    if (!isWet(t) || (t === DEEP && piece.type === 'stone')) return false;
    const other = pieceIndexAt(placed, col, row);
    return other === -1 || other === ignoreIndex;
  });
}

export function piecesLeft(level, placed) {
  const left = { ...level.pieces };
  for (const p of placed) left[p.type] -= 1;
  return left;
}

// Turn a piece a quarter turn. Tries to keep the middle cell where it is,
// then the other cells, and returns the first spot that fits (or null).
export function turnPiece(level, placed, index) {
  const piece = placed[index];
  const len = PIECES[piece.type].length;
  const cells = pieceCells(piece);
  const dir = piece.dir === 'h' ? 'v' : 'h';
  const middle = Math.floor((len - 1) / 2);
  const order = [middle, ...cells.keys()].filter((v, i, a) => a.indexOf(v) === i);
  for (const keep of order) {
    for (const k of order) {
      const pivot = cells[keep];
      const candidate =
        dir === 'h'
          ? { ...piece, dir, col: pivot.col - k, row: pivot.row }
          : { ...piece, dir, col: pivot.col, row: pivot.row - k };
      if (canPlace(level, placed, candidate, index)) return candidate;
    }
  }
  return null;
}

// Where a piece ends up after being dropped: on a current it drifts one tile at a time
// until the next spot is blocked or it reaches calm water. Returns null if it can't go there at all.
export function settle(level, placed, piece, ignoreIndex = -1) {
  if (!canPlace(level, placed, piece, ignoreIndex)) return null;
  for (let guard = 0; guard < 50; guard++) {
    const cell = pieceCells(piece).find((c) => tileAt(level, c.col, c.row) in CURRENTS);
    if (!cell) break;
    const [dc, dr] = CURRENTS[tileAt(level, cell.col, cell.row)];
    const next = { ...piece, col: piece.col + dc, row: piece.row + dr };
    if (!canPlace(level, placed, next, ignoreIndex)) break;
    piece = next;
  }
  return piece;
}

export function starsFor(level, piecesUsed) {
  if (piecesUsed <= level.par) return 3;
  if (piecesUsed === level.par + 1) return 2;
  return 1;
}
