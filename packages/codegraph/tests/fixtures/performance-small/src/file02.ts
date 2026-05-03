// Simple exports file 02 - imports from file01
import { func01, Class01 } from './file01.js';
export const VALUE_02 = 'file02';
export function func02(): string { return func01() + VALUE_02; }
export class Class02 extends Class01 { extra = VALUE_02; }
