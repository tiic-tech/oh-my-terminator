// Comprehensive Test: All MODULE Kind Types
// This file tests all possible kind classifications

// kind: "function" - FunctionDeclaration
export function namedFunction(a: number, b: number): number {
  return a + b;
}

// kind: "function" - Arrow function in variable
export const arrowFunction = (x: number) => x * 2;

// kind: "function" - Regular function expression
export const regularFunction = function(x: number) {
  return x - 1;
};

// kind: "class" - ClassDeclaration
export class MyClass {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }
}

// kind: "interface" - InterfaceDeclaration
export interface MyInterface {
  id: string;
  name: string;
  data?: unknown;
}

// kind: "type" - TypeAliasDeclaration
export type MyType = {
  x: number;
  y: number;
};

// kind: "type" - TypeAlias with union
export type StatusType = 'active' | 'inactive' | 'pending';

// kind: "type" - TypeAlias with generics
export type GenericType<T> = {
  value: T;
  timestamp: number;
};

// kind: "variable" - Simple variable
export const SIMPLE_CONSTANT = 'constant-value';

// kind: "variable" - Object literal
export const CONFIG_OBJECT = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};

// kind: "variable" - Array
export const NUMBER_ARRAY = [1, 2, 3, 4, 5];

// kind: "type" - Enum (per A10 resolution)
export enum MyEnum {
  First,
  Second,
  Third,
}

// Not exported - should NOT create MODULE node
function privateFunction() {
  return 'private';
}

// Not exported - should NOT create MODULE node
class PrivateClass {
  method() {}
}

// Exported later via export statement
function delayedExport() {
  return 'delayed';
}

export { delayedExport };
// Expected: MODULE node with name="delayedExport"

// Export with rename (A9)
function internalName() {
  return 'internal';
}

export { internalName as publicName };
// Expected: MODULE node with name="publicName", originalName="internalName"