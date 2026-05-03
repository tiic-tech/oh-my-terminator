/**
 * Setup file for testing side-effect imports.
 * This file is imported without any bindings to test empty import specifier.
 */

// Side-effect only - no exports needed
console.log('Setup complete');

// This file demonstrates import './setup' pattern
// which should generate importSpecifier: "empty"