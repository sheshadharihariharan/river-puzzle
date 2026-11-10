// Best stars per level, kept in this browser (or the .exe's own storage).
const KEY = 'river-puzzle-save';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { stars: {} };
  } catch {
    return { stars: {} };
  }
}

export function starsFor(id) {
  return read().stars[id] ?? 0;
}

export function recordStars(id, stars) {
  const save = read();
  const before = save.stars[id] ?? 0;
  save.stars[id] = Math.max(before, stars);
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage blocked: progress just isn't kept this session.
  }
  return before;
}

// A level is open when it is the first one, the one before it has been won, or it was won itself.
export function isUnlocked(levels, index) {
  return index === 0 || starsFor(levels[index - 1].id) > 0 || starsFor(levels[index].id) > 0;
}
