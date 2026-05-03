// Simple exports file 13 - imports from file12
import { process12 } from './file12.js';
export const VALUE_13 = 'file13';
export function chain13(n: number): number { return process12(n) + 13; }
