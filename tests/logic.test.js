import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, canPlace, turnPiece, piecesLeft, starsFor, settle } from '../src/logic/grid.js';
import { planWalk, solves } from '../src/logic/path.js';

// River two tiles deep across the middle, a rock at column 3.
const level = parseLevel({
  id: 'test',
  name: 'Test',
  map: ['.S....', '......', '~~~#~~', '~~~~~~', '....H.'],
  pieces: { stone: 2, plank: 1 },
  par: 1,
});

test('no pieces: no path, character splashes into the river', () => {
  assert.equal(solves(level, []), false);
  const walk = planWalk(level, []);
  assert.equal(walk.result, 'splash');
  assert.equal(walk.splashAt.row, 2);
});

test('upright plank makes a path', () => {
  const placed = [{ type: 'plank', col: 1, row: 2, dir: 'v' }];
  const walk = planWalk(level, placed);
  assert.equal(walk.result, 'win');
  assert.deepEqual({ col: walk.path.at(-1).col, row: walk.path.at(-1).row }, level.goal);
});

test('a plank lying across the river cannot be walked onto from the side', () => {
  const placed = [{ type: 'plank', col: 0, row: 2, dir: 'h' }, { type: 'stone', col: 0, row: 3, dir: 'h' }];
  assert.equal(solves(level, placed), false);
});

test('two stones make a path', () => {
  const placed = [
    { type: 'stone', col: 4, row: 2, dir: 'h' },
    { type: 'stone', col: 4, row: 3, dir: 'h' },
  ];
  assert.ok(solves(level, placed));
});

test('pieces cannot go on rock, grass or another piece', () => {
  assert.equal(canPlace(level, [], { type: 'plank', col: 3, row: 2, dir: 'v' }), false); // rock
  assert.equal(canPlace(level, [], { type: 'plank', col: 1, row: 1, dir: 'v' }), false); // half on grass
  const placed = [{ type: 'stone', col: 1, row: 2, dir: 'h' }];
  assert.equal(canPlace(level, placed, { type: 'plank', col: 1, row: 2, dir: 'v' }), false);
  assert.equal(canPlace(level, placed, { type: 'plank', col: 1, row: 2, dir: 'v' }, 0), true); // moving that stone's own spot
});

test('turning a plank finds a spot that fits', () => {
  const placed = [{ type: 'plank', col: 0, row: 2, dir: 'h' }];
  const turned = turnPiece(level, placed, 0);
  assert.equal(turned.dir, 'v');
  assert.ok(canPlace(level, placed, turned, 0));
});

test('turning fails when there is no room', () => {
  const tight = parseLevel({ id: 't', name: 't', map: ['S..', '~~.', '..H'], pieces: { plank: 1 }, par: 1 });
  assert.equal(turnPiece(tight, [{ type: 'plank', col: 0, row: 1, dir: 'h' }], 0), null);
});

test('pieces left and stars', () => {
  assert.deepEqual(piecesLeft(level, [{ type: 'stone', col: 0, row: 2, dir: 'h' }]), { stone: 1, plank: 1, log: 0, raft: 0 });
  assert.equal(starsFor(level, 1), 3);
  assert.equal(starsFor(level, 2), 2);
  assert.equal(starsFor(level, 3), 1);
});

test('walled in by rocks: stuck, not splash', () => {
  const walled = parseLevel({ id: 'w', name: 'w', map: ['S#~', '##.', '~.H'], pieces: {}, par: 0 });
  assert.equal(planWalk(walled, []).result, 'stuck');
});

test('stones sink in deep water, planks float', () => {
  const deep = parseLevel({ id: 'd', name: 'd', map: ['S..', '===', '..H'], pieces: { stone: 1, plank: 1 }, par: 1 });
  assert.equal(canPlace(deep, [], { type: 'stone', col: 0, row: 1, dir: 'h' }), false);
  assert.equal(canPlace(deep, [], { type: 'plank', col: 0, row: 1, dir: 'h' }), true);
});

test('a piece on a current drifts until something stops it', () => {
  const river = parseLevel({ id: 'c', name: 'c', map: ['S....', '>>>>#', '....H'], pieces: { stone: 2 }, par: 1 });
  assert.deepEqual(settle(river, [], { type: 'stone', col: 0, row: 1, dir: 'h' }), { type: 'stone', col: 3, row: 1, dir: 'h' });
  // A second stone stops against the first.
  const first = [{ type: 'stone', col: 3, row: 1, dir: 'h' }];
  assert.deepEqual(settle(river, first, { type: 'stone', col: 0, row: 1, dir: 'h' }), { type: 'stone', col: 2, row: 1, dir: 'h' });
});

test('the hero picks the flower before going home', () => {
  const garden = parseLevel({ id: 'f', name: 'f', map: ['S.~F', '..~.', 'H.~.'], pieces: { stone: 1 }, par: 1 });
  assert.equal(solves(garden, []), false);
  const walk = planWalk(garden, [{ type: 'stone', col: 2, row: 0, dir: 'h' }]);
  assert.equal(walk.result, 'win');
  const at = (c) => ({ col: c.col, row: c.row });
  assert.deepEqual(at(walk.path[walk.flowerAt]), garden.flower);
  assert.deepEqual(at(walk.path.at(-1)), garden.goal);
});

test('a fall says why: stepping off the side of a log', () => {
  // Level 12 as a player tried it: down a log, then sideways onto a stone.
  const twelve = parseLevel({
    id: 't12', name: 't12', par: 4, pieces: { stone: 3, plank: 2, log: 1 },
    map: ['S........', '###.#####', '~~~~~~~~~', '===~~~===', '~~~~~~~~~', '#####.###', '........H'],
  });
  const walk = planWalk(twelve, [
    { type: 'log', col: 3, row: 2, dir: 'v' },
    { type: 'stone', col: 4, row: 4, dir: 'h' },
    { type: 'stone', col: 5, row: 4, dir: 'h' },
  ]);
  assert.equal(walk.result, 'splash');
  assert.equal(walk.why, 'side-off');
  assert.equal(walk.piece, 'log');
});

test('a fall says why: stepping onto the side of a plank, or open water', () => {
  const sideOn = planWalk(level, [{ type: 'plank', col: 0, row: 2, dir: 'h' }, { type: 'stone', col: 0, row: 3, dir: 'h' }]);
  assert.equal(sideOn.why, 'side-on');
  assert.equal(sideOn.piece, 'plank');
  assert.equal(planWalk(level, []).why, 'gap');
});

test('every piece and item is introduced with a rule card on its first level', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { newRulesIn } = await import('../src/screens/rules.js');
  const dir = new URL('../levels/', import.meta.url);
  const levels = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => parseLevel(JSON.parse(readFileSync(new URL(f, dir), 'utf8'))));
  const intro = {};
  levels.forEach((_, i) => newRulesIn(levels, i).forEach((k) => (intro[k] = i + 1)));
  assert.deepEqual(intro, { stone: 1, plank: 3, rock: 5, log: 6, deep: 10, current: 15, flower: 20, ice: 25, thin: 31, lily: 37, raft: 41 });
});

test('ice: the hero slides until something stops them', () => {
  // Slide right along the ice; the rock stops them on the last ice tile, then they walk down and home.
  const rink = parseLevel({ id: 'i', name: 'i', par: 0, pieces: {}, map: ['SIII#', '###..', '###.H'] });
  const walk = planWalk(rink, []);
  assert.equal(walk.result, 'win');
  assert.deepEqual(walk.path.slice(1, 4).map((c) => c.how), ['walk', 'slide', 'slide']);
  // With water instead of the rock they slide straight in...
  const open = parseLevel({ id: 'o', name: 'o', par: 1, pieces: { stone: 1 }, map: ['SIII~', '####.', '####H'] });
  const fall = planWalk(open, []);
  assert.equal(fall.result, 'splash');
  assert.equal(fall.why, 'slid');
  // ...unless a stone at the end of the ice catches them.
  assert.ok(solves(open, [{ type: 'stone', col: 4, row: 0, dir: 'h' }]));
});

test('thin ice holds once: there and back needs another way', () => {
  // The flower is across thin ice; coming back the same way is impossible.
  const pond = parseLevel({ id: 't', name: 't', par: 1, pieces: { stone: 1 }, map: ['S~F', 'T~~', 'H~~'] });
  const out = parseLevel({ id: 't2', name: 't2', par: 1, pieces: { stone: 1 }, map: ['STF', '.~~', 'H~~'] });
  assert.equal(solves(out, []), false);
  const walk = planWalk(out, []);
  assert.equal(walk.why, 'cracked');
  assert.ok(solves(out, [{ type: 'stone', col: 1, row: 1, dir: 'h' }]) === false); // stone is not next to the flower
  assert.ok(pond);
});

test('a raft carries the hero along the current until it bumps into something', () => {
  const ferry = parseLevel({ id: 'r', name: 'r', par: 1, pieces: { raft: 1 }, map: ['S~~~~', '#vvv#', '#vvv#', '..H..'] });
  // Raft dropped right below the start? The start row is water, so drop it at (1,0)? Use the current column instead.
  const river = parseLevel({ id: 'r2', name: 'r2', par: 1, pieces: { raft: 1 }, map: ['S>>>#', '###~.', '...~H'] });
  const walk = planWalk(river, [{ type: 'raft', col: 1, row: 0, dir: 'h' }]);
  assert.ok(ferry);
  assert.equal(walk.result, 'splash'); // rides to (3,0), then (3,1) is water below: needs more
  const rides = walk.path.filter((c) => c.how === 'ride').map((c) => c.col);
  assert.deepEqual(rides, [2, 3]);
});
