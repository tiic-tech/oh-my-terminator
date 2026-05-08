/**
 * Generate 1000 TypeScript files for scale testing
 *
 * Each file has:
 * - 2-3 imports from other files in the project
 * - 1-2 exported functions/classes
 * - Some local utility functions
 */

import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('tests/fixtures/performance-large/src');

// Generate 1000 files
for (let i = 1; i <= 1000; i++) {
  const fileName = `file${i.toString().padStart(4, '0')}.ts`;
  const filePath = path.join(outputDir, fileName);

  // Create varied content
  const imports = generateImports(i);
  const exports = generateExports(i);
  const content = `${imports}\n\n${exports}\n`;

  fs.writeFileSync(filePath, content);
}

console.log('Generated 1000 TypeScript files in', outputDir);

function generateImports(fileIndex: number): string {
  // Import from 2-3 other files (circular pattern to create dependency graph)
  const imports: string[] = [];

  // Import from previous files (modular pattern)
  if (fileIndex > 1) {
    const prev1 = `file${(fileIndex - 1).toString().padStart(4, '0')}`;
    imports.push(`import { func${fileIndex - 1} } from './${prev1}';`);
  }

  if (fileIndex > 10) {
    const prev10 = `file${(fileIndex - 10).toString().padStart(4, '0')}`;
    imports.push(`import { Class${fileIndex - 10} } from './${prev10}';`);
  }

  // Add some external imports
  if (fileIndex % 50 === 0) {
    imports.push(`import path from 'path';`);
  }
  if (fileIndex % 100 === 0) {
    imports.push(`import fs from 'fs';`);
  }

  return imports.length > 0 ? imports.join('\n') : '// No imports';
}

function generateExports(fileIndex: number): string {
  const exports: string[] = [];

  // Every file exports a function
  exports.push(`
export function func${fileIndex}(input: string): string {
  return \`processed: \${input}\`;
}
`);

  // Every 10th file exports a class
  if (fileIndex % 10 === 0) {
    exports.push(`
export class Class${fileIndex} {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }

  setValue(value: number): void {
    this.value = value;
  }
}
`);
  }

  // Every 5th file exports a constant
  if (fileIndex % 5 === 0) {
    exports.push(`export const CONST_${fileIndex} = ${fileIndex * 10};`);
  }

  return exports.join('\n');
}