// Simple exports file 05 - imports from file04
import { func04, Class04 } from './file04.js';
export const VALUE_05 = 'file05';
export function func05(): string { return func04() + VALUE_05; }
export class Class05 { parent = new Class04(); }
