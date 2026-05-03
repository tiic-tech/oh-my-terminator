// Simple exports file 04 - imports from file01, file03
import { func01 } from './file01.js';
import { Class03 } from './file03.js';
export const VALUE_04 = 'file04';
export function func04(): string { return func01() + VALUE_04; }
export class Class04 { ref = new Class03(); }
