/**
 * Shared utility functions - alternative path for @utils/* alias.
 * This demonstrates A2: Multiple alias paths scenario.
 */

export function sharedHelper(): string {
  return 'shared helper function';
}

export function sharedFormat(input: string): string {
  return input.toUpperCase();
}

// This file exists to test the multiple paths resolution:
// @utils/* matches both utils/* and shared/utils/*
// When importing '@utils/shared-helper', TypeScript should resolve
// to this file if utils/shared-helper.ts doesn't exist