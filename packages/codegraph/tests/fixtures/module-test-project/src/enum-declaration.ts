// A10 Test: Enum Classification
// Expected: kind = "type" for all enums
// Expected metadata: enumMembers array

// Simple enum
export enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Pending = 'PENDING',
}
// Expected: kind = "type", enumMembers = ['Active', 'Inactive', 'Pending']

// Numeric enum
export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
}
// Expected: kind = "type", enumMembers = ['Low', 'Medium', 'High']

// Const enum (TypeScript specific)
export const enum Color {
  Red = 'RED',
  Green = 'GREEN',
  Blue = 'BLUE',
}
// Expected: kind = "type", enumMembers = ['Red', 'Green', 'Blue']

// Mixed enum (string + numeric)
export enum Mixed {
  A = 1,
  B = 'B_VALUE',
  C = 3,
}
// Expected: kind = "type", enumMembers = ['A', 'B', 'C']

// Computed enum values (not all computed, some literal)
export enum Computed {
  First = 1,
  Second = First + 1,
  Third = Second + 1,
}
// Expected: kind = "type", enumMembers = ['First', 'Second', 'Third']