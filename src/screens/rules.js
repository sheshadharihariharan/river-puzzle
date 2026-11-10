// Rule cards: one for each piece and each special tile. A card is shown the first time a level
// uses that thing, and the ? button shows the cards for everything in the current level.
import { PIECE_TYPES, ROCK, DEEP, FLOWER, CURRENTS, ICE, THIN, LILY } from '../logic/grid.js';

// Plank and log diagram: green arrows at the ends (allowed), red cross at the side (not allowed).
const ENDS_ONLY = `
<svg class="diagram" viewBox="0 0 240 120" aria-label="Step on and off at the ends only">
  <rect x="4" y="18" width="232" height="84" rx="12" fill="#3fa9ea"/>
  <rect x="64" y="44" width="112" height="32" rx="6" fill="#c98a4b" stroke="#1d3a2a" stroke-width="4"/>
  <path d="M86 46v28M108 46v28M130 46v28M152 46v28" stroke="#8f5a2c" stroke-width="3"/>
  <g stroke="#3ddc63" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M14 60h36M38 48l13 12-13 12"/><path d="M190 60h36M214 48l13 12-13 12"/>
  </g>
  <g stroke="#ff4a3d" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M120 4v28M108 22l12 12 12-12"/><path d="M102 86l36 28M138 86l-36 28" stroke-width="6"/>
  </g>
</svg>`;

const SWATCH = {
  ice: `<svg class="pic" viewBox="0 0 120 60"><rect width="120" height="60" rx="10" fill="#dff3fb" stroke="#a9d8ee" stroke-width="4"/><path d="M18 44l26-26M44 46l20-20" stroke="#fff" stroke-width="5" stroke-linecap="round"/><g stroke="#3fa9ea" stroke-width="5" stroke-linecap="round" fill="none"><path d="M70 30h34M94 20l11 10-11 10"/></g></svg>`,
  thin: `<svg class="pic" viewBox="0 0 120 60"><rect width="120" height="60" rx="10" fill="#3fa9ea"/><rect x="22" y="8" width="76" height="44" rx="6" fill="#bfe6f7"/><path d="M60 30l-26-14M60 30l30-10M60 30l-8 20M60 30l24 16" stroke="#fff" stroke-width="3"/></svg>`,
  lily: `<svg class="pic" viewBox="0 0 120 60"><rect width="120" height="60" rx="10" fill="#6f9a62"/><path d="M60 30L82 14A26 26 0 1 0 86 34Z" fill="#5fae3a" stroke="#3f7f25" stroke-width="3"/><circle cx="48" cy="24" r="6" fill="#ff9ec7"/></svg>`,
  deep: `<svg class="pic" viewBox="0 0 120 60"><rect width="120" height="60" rx="10" fill="#0d4c9c"/><path d="M15 30q10-8 20 0t20 0M65 22q10-8 20 0t20 0" stroke="#5ea0e0" stroke-width="4" fill="none"/></svg>`,
  current: `<svg class="pic" viewBox="0 0 120 60"><rect width="120" height="60" rx="10" fill="#3fa9ea"/><g fill="#fff"><path d="M22 14l22 16-22 16-7-5 15-11-15-11z"/><path d="M56 14l22 16-22 16-7-5 15-11-15-11z"/><path d="M90 14l22 16-22 16-7-5 15-11-15-11z"/></g></svg>`,
};

export const RULES = {
  stone: {
    title: 'Stone',
    pic: 'stone',
    lines: ['Covers 1 water tile.', 'The hero can step on and off it from any side, so stones are your corners.'],
  },
  plank: {
    title: 'Plank',
    pic: 'plank',
    lines: [
      'Covers 2 water tiles in a straight line.',
      'The hero walks along it, end to end. Step on and off only at its two ends, never off the side.',
      'Click a plank on the river to turn it.',
    ],
    diagram: ENDS_ONLY,
  },
  log: {
    title: 'Log',
    pic: 'log',
    lines: [
      'Covers 3 water tiles in a straight line.',
      'Just like a plank: step on and off only at its two ends, never off the side.',
      'Click a log on the river to turn it.',
    ],
    diagram: ENDS_ONLY,
  },
  raft: {
    title: 'Raft',
    pic: 'raft',
    lines: [
      'Covers 1 water tile. The hero can step on and off it from any side.',
      'On fast water it floats downstream with the hero on board, until it bumps into something.',
      'On calm water it stays put, like a stone.',
    ],
  },
  rock: {
    title: 'Rock',
    pic: 'rock-a',
    lines: ['Rocks block the way. The hero can’t walk through them, and pieces can’t go on them.'],
  },
  deep: {
    title: 'Deep water',
    lines: ['Dark blue water is deep. Stones sink here!', 'Planks and logs float on it.'],
  },
  current: {
    title: 'Fast current',
    lines: [
      'Water with moving arrows flows fast.',
      'A piece dropped on it drifts downstream until it hits a rock, the bank or another piece.',
      'The white outline shows where it will stop.',
    ],
  },
  ice: {
    title: 'Ice',
    lines: [
      'Slippery! Once the hero steps on, they slide straight on until something stops them.',
      'A rock or the edge of the board stops them on the ice. Sliding into water means a splash, so put a piece where the slide ends.',
    ],
  },
  thin: {
    title: 'Thin ice',
    lines: ['Holds the hero once, then cracks behind them.', 'If the path has to come back this way, you need another route.'],
  },
  lily: {
    title: 'Lily pad',
    lines: ['The hero can hop on from any side, but it sinks after one step.', 'If the path has to come back this way, you need another route.'],
  },
  flower: {
    title: 'Flower',
    pic: 'flower',
    lines: ['The hero must pick the flower before going home.', 'Your path has to reach the flower and the cottage.'],
  },
};

// Models to draw as card pictures.
export const RULE_MODELS = [...new Set(Object.values(RULES).map((r) => r.pic).filter(Boolean))];

// Which rules a level uses, in teaching order.
export function rulesIn(level) {
  const tiles = level.tiles.flat();
  const keys = PIECE_TYPES.filter((t) => level.pieces[t]);
  if (tiles.includes(ROCK)) keys.push('rock');
  if (tiles.includes(DEEP)) keys.push('deep');
  if (tiles.some((t) => t in CURRENTS)) keys.push('current');
  if (tiles.includes(ICE)) keys.push('ice');
  if (tiles.includes(THIN)) keys.push('thin');
  if (tiles.includes(LILY)) keys.push('lily');
  if (tiles.includes(FLOWER)) keys.push('flower');
  return keys;
}

// Rules this level uses that no earlier level did.
export function newRulesIn(levels, index) {
  const seen = new Set(levels.slice(0, index).flatMap(rulesIn));
  return rulesIn(levels[index]).filter((k) => !seen.has(k));
}

// HTML for a set of cards. pics: { modelName: imageUrl }.
export function ruleCards(keys, pics) {
  return keys
    .map((k) => {
      const r = RULES[k];
      const pic = r.pic ? `<img class="pic" src="${pics[r.pic]}" alt="">` : SWATCH[k];
      return `<div class="rule-card">${pic}<div><h3>${r.title}</h3>${r.lines.map((l) => `<p>${l}</p>`).join('')}${r.diagram ?? ''}</div></div>`;
    })
    .join('');
}
