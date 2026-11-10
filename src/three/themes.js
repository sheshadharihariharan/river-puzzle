// How each area looks: ground and water colours, trees and extras. Levels pick theirs by id ('snow-25' -> snow).

const WATER = { deep: 0x1b93dd, shallow: 0x4ccbe8, line: 0xc9f1ff, deepWater: 0x0d4c9c };

export const THEMES = {
  meadow: {
    grass: 0x6cc04a, grassAlt: 0x65ba42, around: 0x59ab39, earth: 0x8a5a32, sky: 0x4f9e45,
    water: WATER,
    trees: [['tree-a', 0.6], ['tree-b', 0.4]], treeDensity: 0.14, bushDensity: 0.08, hills: true,
  },
  forest: {
    grass: 0x6cc04a, grassAlt: 0x65ba42, around: 0x4c9930, earth: 0x7a4f2c, sky: 0x3f8a3a,
    water: WATER,
    trees: [['tree-b', 0.7], ['tree-a', 0.3]], treeDensity: 0.26, bushDensity: 0.08, hills: true,
  },
  snow: {
    grass: 0xf1f6fa, grassAlt: 0xe4edf4, around: 0xdbe6ef, earth: 0x8b8f9c, sky: 0xcfdde8,
    water: { deep: 0x3b8fd1, shallow: 0x8fd8f2, line: 0xffffff, deepWater: 0x1d4f8a },
    trees: [['pine', 1]], treeDensity: 0.2, bushDensity: 0.05, bush: 'rock-b', hills: false, flowers: false, extra: 'snowfall',
  },
  swamp: {
    grass: 0x7c9a4a, grassAlt: 0x74924a, around: 0x66803f, earth: 0x5a4630, sky: 0x55703a,
    water: { deep: 0x3f6b4f, shallow: 0x6f9a62, line: 0xb8d8a0, deepWater: 0x24402f },
    trees: [['swamp-tree', 0.7], ['tree-b', 0.3]], treeDensity: 0.2, bushDensity: 0.1, bush: 'reeds', hills: false, extra: 'fireflies',
  },
};

export const themeOf = (id) => THEMES[id.split('-')[0]] ?? THEMES.meadow;

// Pick a tree name from a theme's weighted list.
export function pickTree(theme, rand) {
  let r = rand();
  for (const [name, w] of theme.trees) if ((r -= w) <= 0) return name;
  return theme.trees[0][0];
}
