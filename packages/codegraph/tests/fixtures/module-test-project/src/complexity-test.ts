// A4 Test: Cyclomatic Complexity Calculation (McCabe Standard)
// Expected complexity values based on McCabe algorithm

// Complexity 1: Simple function (base = 1, no decisions)
export function simple(): number {
  return 42;
}  // Expected: complexity = 1

// Complexity 2: Single if
export function withIf(x: number): string {
  if (x > 0) {
    return 'positive';
  }
  return 'non-positive';
}  // Expected: complexity = 2 (base 1 + if 1)

// Complexity 3: if-else
export function withElse(x: number): string {
  if (x > 0) {
    return 'positive';
  } else {
    return 'negative or zero';
  }
}  // Expected: complexity = 2 (base 1 + if 1, else is same branch)

// Complexity 4: Multiple conditions
export function multipleConditions(x: number, y: number): string {
  if (x > 0) {               // +1
    if (y > 0) {             // +1
      return 'both positive';
    }
  }
  return 'other';
}  // Expected: complexity = 3 (base 1 + two ifs)

// Complexity 5: For loop
export function withLoop(items: number[]): number {
  let sum = 0;
  for (const item of items) {  // +1
    sum += item;
  }
  return sum;
}  // Expected: complexity = 2 (base 1 + for)

// Complexity 6: Switch with cases
export function withSwitch(type: string): number {
  switch (type) {            // +1 (base switch)
    case 'a':                // +1
      return 1;
    case 'b':                // +1
      return 2;
    case 'c':                // +1
      return 3;
    default:
      return 0;
  }
}  // Expected: complexity = 5 (base 1 + switch 1 + 3 cases)

// Complexity 7: Logical operators
export function withLogicalOps(a: boolean, b: boolean): boolean {
  return a && b;             // +1 for &&
}  // Expected: complexity = 2 (base 1 + &&)

// Complexity 8: Ternary operator
export function withTernary(x: number): string {
  return x > 0 ? 'positive' : 'non-positive';  // +1 for ?:
}  // Expected: complexity = 2 (base 1 + ternary)

// Complexity 9: Try-catch
export function withTryCatch(data: unknown): string {
  try {                      // +1 for try-catch block
    return JSON.stringify(data);
  } catch (e) {              // catch counted as part of try-catch
    return 'error';
  }
}  // Expected: complexity = 2 (base 1 + try-catch)

// Complexity 10: Combined complexity
export function complexFunction(data: { valid: boolean; items: string[] }): number {
  if (data.valid) {                              // +1
    for (const item of data.items) {             // +1
      if (item.length > 0) {                     // +1
        return item.length;
      }
    }
  }
  try {                                          // +1
    return data.items?.length ?? 0;              // +1 for ??
  } catch (e) {                                  // counted with try
    return -1;
  }
}
// Expected: complexity = 6 (base 1 + if + for + if + try + ??)