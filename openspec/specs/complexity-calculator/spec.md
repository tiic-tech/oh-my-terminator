## ADDED Requirements

### Requirement: calculateComplexity function
The system SHALL provide a `calculateComplexity(ast: ts.Node): ComplexityResult` function that calculates Cyclomatic Complexity from TypeScript AST.

#### Scenario: Simple function
- **WHEN** function has no branching statements
- **THEN** system returns `{ level: "low", value: 1 }`

#### Scenario: Function with if-else
- **WHEN** function has one if-else statement
- **THEN** system returns `{ level: "low", value: 2 }`

#### Scenario: Function with switch
- **WHEN** function has switch statement with 3 cases
- **THEN** system returns `{ level: "low", value: 4 }`

#### Scenario: High complexity function
- **WHEN** function has multiple nested conditionals totaling CC > 15
- **THEN** system returns `{ level: "high", value: <calculated> }`

#### Scenario: Critical complexity function
- **WHEN** function has CC >= 26
- **THEN** system returns `{ level: "critical", value: <calculated> }`

### Requirement: Complexity level classification
The system SHALL classify complexity values into meaningful levels using defined thresholds.

#### Scenario: Low complexity classification
- **WHEN** calculated CC value is 1-5
- **THEN** system returns level "low"

#### Scenario: Medium complexity classification
- **WHEN** calculated CC value is 6-15
- **THEN** system returns level "medium"

#### Scenario: High complexity classification
- **WHEN** calculated CC value is 16-25
- **THEN** system returns level "high"

#### Scenario: Critical complexity classification
- **WHEN** calculated CC value is >= 26
- **THEN** system returns level "critical"

### Requirement: Decision point detection
The system SHALL detect all decision points that increase Cyclomatic Complexity.

#### Scenario: If statement detection
- **WHEN** AST contains `if` statement
- **THEN** system counts +1 to complexity

#### Scenario: Else branch detection
- **WHEN** AST contains `else` or `else if` branch
- **THEN** system counts +1 for each branch

#### Scenario: Switch case detection
- **WHEN** AST contains `switch` with N cases
- **THEN** system counts +N to complexity (each case is a decision)

#### Scenario: Loop detection
- **WHEN** AST contains for, while, do-while, for-of, or for-in loop
- **THEN** system counts +1 for each loop

#### Scenario: Ternary expression detection
- **WHEN** AST contains conditional expression `a ? b : c`
- **THEN** system counts +1 to complexity

#### Scenario: Catch block detection
- **WHEN** AST contains try-catch with catch block
- **THEN** system counts +1 for each catch block

#### Scenario: Logical operator detection
- **WHEN** AST contains `&&` or `||` operator
- **THEN** system counts +1 for each operator (implicit branching)

#### Scenario: Multiple logical operators in chain
- **WHEN** AST contains `a && b && c`
- **THEN** system counts +2 for two logical operators (not +1 for whole chain)

#### Scenario: Nullish coalescing operator detection
- **WHEN** AST contains `??` operator
- **THEN** system counts +1 (same as logical operators)

### Requirement: File-level complexity aggregation
The system SHALL aggregate function-level complexity into file-level totals.

#### Scenario: Multiple functions aggregation
- **WHEN** file has functions with CC values [3, 5, 7]
- **THEN** system returns file-level `{ level: "medium", value: 15 }`

#### Scenario: Empty file aggregation
- **WHEN** file has no functions
- **THEN** system returns `{ level: "unknown", value: 0 }`

#### Scenario: High complexity file
- **WHEN** file has multiple high-complexity functions totaling CC > 25
- **THEN** system returns file-level `{ level: "critical", value: <total> }`

### Requirement: ComplexityResult interface
The system SHALL define a standard `ComplexityResult` interface for complexity values.

#### Scenario: Result structure
- **WHEN** complexity is calculated
- **THEN** result includes `{ level: ComplexityLevel, value: number }`

#### Scenario: ComplexityLevel type
- **WHEN** level is returned
- **THEN** level is one of: "low" | "medium" | "high" | "critical" | "unknown"

### Requirement: MODULE scope for complexity calculation
The system SHALL calculate complexity ONLY for MODULE nodes with kind='function' or kind='component'.

#### Scenario: Function MODULE receives complexity
- **WHEN** MODULE node has `kind: "function"`
- **THEN** system calculates and stores complexity value

#### Scenario: Component MODULE receives complexity
- **WHEN** MODULE node has `kind: "component"`
- **THEN** system calculates and stores complexity value

#### Scenario: Class MODULE does NOT receive complexity
- **WHEN** MODULE node has `kind: "class"`
- **THEN** system does NOT calculate complexity (value remains undefined)

#### Scenario: Interface MODULE does NOT receive complexity
- **WHEN** MODULE node has `kind: "interface"`
- **THEN** system does NOT calculate complexity

#### Scenario: Type MODULE does NOT receive complexity
- **WHEN** MODULE node has `kind: "type"` (type alias or enum)
- **THEN** system does NOT calculate complexity

#### Scenario: Variable MODULE does NOT receive complexity
- **WHEN** MODULE node has `kind: "variable"` (non-function variable)
- **THEN** system does NOT calculate complexity

### Requirement: Nested function handling
The system SHALL NOT create separate MODULE nodes for nested functions.

#### Scenario: Nested function complexity aggregation
- **WHEN** exported function contains nested function definitions
- **THEN** nested functions do NOT create separate MODULE nodes
- **AND** nested function complexity is included in parent function's complexity

#### Scenario: Nested arrow function handling
- **WHEN** exported function contains nested arrow functions
- **THEN** nested arrows do NOT create separate MODULE nodes
- **AND** nested arrow complexity is included in parent function's complexity

### Requirement: Class method handling
The system SHALL NOT create separate MODULE nodes for class methods.

#### Scenario: Class method complexity aggregation
- **WHEN** class is exported with multiple methods
- **THEN** methods do NOT create separate MODULE nodes
- **AND** class MODULE node receives `kind: "class"` WITHOUT complexity value

### Requirement: Arrow function MODULE creation
The system SHALL create MODULE nodes for exported arrow functions at top level.

#### Scenario: Exported arrow function MODULE creation
- **WHEN** file contains `export const handler = () => { if (x) return 1; }`
- **THEN** system creates MODULE node with `kind: "function"`
- **AND** system calculates complexity = 2 (base + if)

#### Scenario: Hook classification as function
- **WHEN** file contains `export const useModal = () => { ... }`
- **THEN** system creates MODULE node with `kind: "function"` (NOT "component")
- **AND** system calculates complexity

### Requirement: Async function handling
The system SHALL handle async functions correctly for complexity calculation.

#### Scenario: Async function complexity
- **WHEN** function is declared with `async` keyword
- **THEN** `async` itself does NOT add complexity
- **AND** `await` does NOT add complexity (suspension point, not branch)
- **AND** try/catch around await adds +1 for catch block

#### Scenario: Async function with branching
- **WHEN** async function has `if (x) { await fetch(); } else { await save(); }`
- **THEN** complexity = 3 (base + if + else)

### Requirement: Generator function handling
The system SHALL handle generator functions correctly for complexity calculation.

#### Scenario: Generator function complexity
- **WHEN** function is declared with `*` generator syntax
- **THEN** generator syntax does NOT add complexity
- **AND** branching inside generator is counted normally

### Requirement: Error handling edge cases
The system SHALL handle edge cases gracefully.

#### Scenario: Empty function body
- **WHEN** function has empty body `{ }`
- **THEN** system returns `{ level: "low", value: 1 }` (base complexity)

#### Scenario: Missing function body
- **WHEN** function declaration has no body (interface method signature)
- **THEN** system returns `{ level: "unknown", value: 0 }`

#### Scenario: Malformed AST node
- **WHEN** AST traversal encounters unexpected node structure
- **THEN** system returns `{ level: "unknown", value: 0 }`
- **AND** system logs warning (does not throw error)