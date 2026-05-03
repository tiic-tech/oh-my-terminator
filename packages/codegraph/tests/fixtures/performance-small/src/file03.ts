// Simple exports file 03 - imports from file02
import { func02, Class02 } from './file02.js';
export const VALUE_03 = 'file03';
export function func03(): string { return func02() + VALUE_03; }
export class Class03 extends Class02 { extra = VALUE_03; }
