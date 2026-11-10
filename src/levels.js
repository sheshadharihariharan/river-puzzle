// Loads every levels/*.json file, in file-name order.
import { parseLevel } from './logic/grid.js';

const files = import.meta.glob('../levels/*.json', { eager: true, import: 'default' });

export const LEVELS = Object.keys(files)
  .sort()
  .map((path) => parseLevel(files[path]));
