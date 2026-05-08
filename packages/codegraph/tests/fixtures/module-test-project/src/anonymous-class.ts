// A8 Test: Theoretical Multiple Anonymous Exports
// TypeScript only allows ONE default export per file.
// This file tests how parser handles anonymous class default export

export default class {
  constructor() {
    this.value = 'anonymous class';
  }

  getValue() {
    return this.value;
  }
}

// Note: For testing multiple anonymous exports, we would need separate files
// or a theoretical edge case that TypeScript rejects but parser might encounter