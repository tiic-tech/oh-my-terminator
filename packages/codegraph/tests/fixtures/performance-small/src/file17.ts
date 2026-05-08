// Simple exports file 17 - imports from file14, file16
import { merge14 } from './file14.js';
import { use16 } from './file16.js';
export const VALUE_17 = 'file17';
export function aggregate17(): string { return merge14() + String(use16()); }
