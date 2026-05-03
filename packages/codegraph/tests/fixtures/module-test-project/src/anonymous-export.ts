// A8 Test: Anonymous Export Handling
// Scenario 1: Single anonymous default export
// Expected: name="default", id="MODULE:anonymous-export.ts#default"

export default function () {
  return 'anonymous function';
}

// Scenario 2: Multiple anonymous default exports (edge case)
// Note: TypeScript allows only one default export per file.
// This file demonstrates the single case; see anonymous-multi.ts for the theoretical multi-case