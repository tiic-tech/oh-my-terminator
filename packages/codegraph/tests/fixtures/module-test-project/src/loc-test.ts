// A5 Test: LOC (Lines of Code) Counting
// This file tests LOC calculation rules
// Expected: LOC counts non-empty, non-comment lines

// Import statement - should be counted (A5 resolution)
import { something } from './other';

// Type import - should be counted
import type { Config } from './types';

/**
 * Multi-line JSDoc comment
 * Should NOT be counted (comment)
 * @param x - input value
 * @returns processed result
 */
export function processValue(x: number): number {
  // Single-line comment - NOT counted
  const result = x * 2;  // This line IS counted

  /* Inline multi-line comment
     spanning multiple lines
     All these comment lines NOT counted */

  const finalResult = result + 1;

  return finalResult;
}

// Type definition - should be counted (A5 resolution)
export interface Result {
  value: number;
  processed: boolean;
}

// Another export - counted
export const DEFAULT_VALUE = 0;

// Empty lines below should NOT be counted


// This line IS counted (code with comment at end)
export function validate(x: number): boolean {
  return x >= DEFAULT_VALUE;
}

/*
 * Block comment at end
 * Not counted
 */

// Expected LOC for this file:
// Imports (2 lines): 2
// JSDoc: 0 (comment)
// processValue body: ~4 lines (excluding comments)
// interface Result: 4 lines
// DEFAULT_VALUE: 1 line
// validate function: 2 lines
// Total ~13-14 LOC (exact depends on counting method)