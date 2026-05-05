# Type Detection Architecture Design

> Language-agnostic architecture for distinguishing compile-time vs runtime dependencies

---

## Executive Summary

**Problem**: Layer assignment incorrectly places type definition files (like `types.ts`) in foundation layers, causing circular dependency violations.

**Root Cause**: Current parser does not distinguish `import type` from runtime imports, and lacks concept of "pure type definition file".

**Solution**: Language-agnostic plugin architecture with:
1. Extended parser metadata for type-only imports
2. Abstract `TypeDefinitionDetector` interface
3. Language-specific adapters (TypeScript, Python, Go, Rust, Java, C++)
4. Plugin registry for extensibility

---

## 1. TypeScript Parser Capability Analysis

### 1.1 Current State

**File**: `/Users/archy/Projects/StartUp/oh-my-terminator/packages/codegraph/src/parser/ts-parser/import-extractor.ts`

**Current `ParsedImportInfo` structure**:
```typescript
interface ParsedImportInfo {
  sourceFile: string;
  specifier: string;
  resolvedPath: string | null;
  line: number;
  importType: 'import' | 're-export' | 'dynamic';  // <-- No type-only flag!
  importSpecifier: string;  // 'default', 'named:x', 'namespace', 'empty'
}
```

**Gap Analysis**:
| Feature | Current State | Required |
|---------|---------------|----------|
| `import type` detection | Not tracked | Required |
| `import { type X }` detection | Not tracked | Required |
| Mixed imports detection | Not tracked | Required |
| Type-only module detection | `ModuleKind` has 'interface', 'type' | Partial |
| Pure type file detection | Not available | Required |

### 1.2 TypeScript Compiler API Capability

**TypeScript can detect `import type`**:
```typescript
// TypeScript AST provides isTypeOnly flag
interface ImportClause {
  isTypeOnly: boolean;  // <-- Available but not used!
}

interface ImportSpecifier {
  isTypeOnly: boolean;  // For inline type imports: import { type X }
}
```

**Implementation point**: `src/parser/ts-parser/import-extractor.ts` - `extractImports()` function

### 1.3 Proposed Metadata Extension

```typescript
// Extend ParsedImportInfo
interface ParsedImportInfo {
  sourceFile: string;
  specifier: string;
  resolvedPath: string | null;
  line: number;
  importType: 'import' | 're-export' | 'dynamic';
  importSpecifier: string;
  
  // NEW: Type-only import tracking
  /** Whether this entire import statement is type-only (import type) */
  isTypeOnlyImport?: boolean;
  
  /** Which specific named imports are type-only (import { type X, Y }) */
  typeOnlyNames?: string[];
}

// Extend EdgeMetadata
interface EdgeMetadata {
  line?: number;
  isDynamic?: boolean;
  importSpecifier?: string;
  coChangeCount?: number;
  
  // NEW: Type-only dependency flag
  /** Whether this edge represents a type-only dependency */
  isTypeOnly?: boolean;
  
  /** For mixed imports, which names are type-only */
  typeOnlyNames?: string[];
}

// Extend ModuleMetadata
interface ModuleMetadata {
  kind?: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component' | 'unknown';
  isExported?: boolean;
  
  // NEW: Pure type definition flag
  /** Whether this module is a compile-time only type definition */
  isTypeDefinition?: boolean;
  
  /** Whether all exports from this file are type-only */
  hasRuntimeExports?: boolean;
}
```

---

## 2. Language-Agnostic Abstract Layer

### 2.1 Core Abstraction

**Universal Definition**:
> A **Type Definition** is a code entity that:
> - Exists only at compile-time (erased before runtime)
> - Has no runtime behavior (no function implementations, no class instances)
> - Cannot be imported as a runtime value (only `import type` allowed)

**Language Variations**:
| Language | Type Definition Form | Runtime Check |
|----------|---------------------|---------------|
| TypeScript | `.d.ts`, `interface`, `type alias`, `import type` | TS Compiler erases types |
| Python | `.pyi` stub files, type hints | Runtime ignores stubs |
| Go | `interface` with no methods implemented | Can be runtime type |
| Rust | `trait` with no impl blocks | Traits have runtime presence |
| Java | `interface` with no default methods | Interfaces are runtime |
| C++ | `.h` header with declarations only | Headers can have inline impl |

**Insight**: "Pure compile-time" concept varies by language. We need **gradual type purity levels**.

### 2.2 Abstract Interface Design

```typescript
/**
 * Abstract interface for detecting type definitions
 * 
 * Language-specific parsers implement this to enable
 * cross-language type detection for layer assignment.
 */
interface TypeDefinitionDetector {
  /** Detector name for logging/debugging */
  name: string;
  
  /** Supported file extensions */
  extensions: string[];
  
  /**
   * Check if a node represents a pure type definition
   * 
   * @param node - GraphNode to check
   * @param context - Detection context with graph info
   * @returns Type purity classification
   */
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult;
  
  /**
   * Check if an edge represents a type-only dependency
   * 
   * @param edge - GraphEdge to check
   * @param context - Detection context
   * @returns Whether edge is type-only
   */
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean;
  
  /**
   * Suggest layer for type definition files
   * 
   * Language-specific layer suggestions (some languages have runtime interfaces)
   * 
   * @returns Layer number (0 = pure compile-time, 1 = foundation, etc.)
   */
  suggestedLayerForTypeFile(): number;
}

/**
 * Detection context provides graph-wide information
 */
interface DetectionContext {
  /** All incoming edges to the node */
  incomingEdges: GraphEdge[];
  
  /** All outgoing edges from the node */
  outgoingEdges: GraphEdge[];
  
  /** All nodes in the graph (for dependency analysis) */
  allNodes: Map<string, GraphNode>;
  
  /** File path pattern matches */
  filePatterns: TypeFilePattern[];
}

/**
 * Type purity classification (gradual levels)
 */
interface TypePurityResult {
  /** Purity level: 0 = pure compile-time, 1 = has runtime aspects, 2 = fully runtime */
  purityLevel: number;
  
  /** Confidence score (0-100) */
  confidence: number;
  
  /** Reason for classification */
  reason: string;
  
  /** Supporting evidence */
  evidence: string[];
}

/**
 * File pattern for type definition detection
 */
interface TypeFilePattern {
  /** Glob pattern for matching files */
  pattern: string;
  
  /** Purity level for matched files */
  purityLevel: number;
  
  /** Confidence boost when pattern matches */
  confidenceBoost: number;
}
```

### 2.3 Layer Assignment Strategy

**Universal Layer Model**:
```
Layer 0: Pure Compile-Time Dependencies
  - TypeScript: .d.ts, types.ts, import type
  - Python: .pyi stub files
  - C++: .h headers (declarations only)
  
Layer 1: Foundation Runtime (Language-specific)
  - TypeScript: utility functions (lodash-style)
  - Go: interfaces (Go interfaces ARE runtime)
  - Rust: trait definitions (traits ARE runtime)
  - Java: interfaces (Java interfaces ARE runtime)
  
Layer 2+: Business Logic
  - Domain-specific modules
  - Application code
```

**Key Insight**: Go/Rust/Java interfaces have runtime presence → Layer 1, not Layer 0.

---

## 3. Language-Specific Adapter Implementations

### 3.1 TypeScript Adapter

**Implementation location**: `src/parser/typescript-adapter.ts`

```typescript
import ts from 'typescript';
import { TypeDefinitionDetector, TypePurityResult, DetectionContext } from './types.js';

/**
 * TypeScript type definition detector
 * 
 * Detects:
 * 1. .d.ts files
 * 2. Files with only interface/type exports
 * 3. import type usage patterns
 */
class TypeScriptTypeDetector implements TypeDefinitionDetector {
  name = 'typescript';
  extensions = ['.ts', '.tsx', '.d.ts', '.mts', '.cts'];
  
  // Type file patterns with purity levels
  private typeFilePatterns: TypeFilePattern[] = [
    { pattern: '**/*.d.ts', purityLevel: 0, confidenceBoost: 100 },
    { pattern: '**/types.ts', purityLevel: 0, confidenceBoost: 80 },
    { pattern: '**/*.types.ts', purityLevel: 0, confidenceBoost: 80 },
    { pattern: '**/interfaces.ts', purityLevel: 0, confidenceBoost: 70 },
    { pattern: '**/@types/**/*.ts', purityLevel: 0, confidenceBoost: 90 },
  ];
  
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult {
    // Strategy 1: File pattern match
    const patternMatch = this.matchTypeFilePattern(node.path);
    if (patternMatch && patternMatch.confidenceBoost >= 80) {
      return {
        purityLevel: patternMatch.purityLevel,
        confidence: patternMatch.confidenceBoost,
        reason: 'File pattern indicates type definition',
        evidence: [`Pattern: ${patternMatch.pattern}`],
      };
    }
    
    // Strategy 2: All imports are type-only
    const incomingEdges = context.incomingEdges.filter(e => e.type === EdgeType.IMPORTS);
    if (incomingEdges.length > 0) {
      const allTypeOnly = incomingEdges.every(e => 
        e.metadata?.isTypeOnly === true
      );
      if (allTypeOnly) {
        return {
          purityLevel: 0,
          confidence: 95,
          reason: 'All imports use import type',
          evidence: incomingEdges.map(e => `Line ${e.metadata?.line}: import type`),
        };
      }
    }
    
    // Strategy 3: Module metadata check (for MODULE nodes)
    if (node.type === NodeType.MODULE && node.metadata) {
      const kind = node.metadata.kind;
      if (kind === 'interface' || kind === 'type') {
        // Check if this module is from a type-only file
        const filePath = node.path; // MODULE path is file path
        const fileNode = context.allNodes.get(`FILE:${filePath}`);
        if (fileNode) {
          const fileResult = this.isTypeDefinition(fileNode, context);
          if (fileResult.purityLevel === 0) {
            return {
              purityLevel: 0,
              confidence: fileResult.confidence,
              reason: 'Module is in type definition file',
              evidence: [`Module kind: ${kind}`, ...fileResult.evidence],
            };
          }
        }
        
        // Interface/type might still be runtime if file has runtime exports
        return {
          purityLevel: 1, // Not pure - could have runtime exports in file
          confidence: 50,
          reason: 'Interface/type but file may have runtime exports',
          evidence: [`Module kind: ${kind}`],
        };
      }
    }
    
    // Default: runtime
    return {
      purityLevel: 2,
      confidence: 0,
      reason: 'No type definition indicators found',
      evidence: [],
    };
  }
  
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean {
    return edge.metadata?.isTypeOnly === true;
  }
  
  suggestedLayerForTypeFile(): number {
    return 0; // TypeScript type files are pure compile-time
  }
  
  private matchTypeFilePattern(filePath: string): TypeFilePattern | null {
    for (const pattern of this.typeFilePatterns) {
      // Use minimatch or similar for glob matching
      if (this.matchesGlob(filePath, pattern.pattern)) {
        return pattern;
      }
    }
    return null;
  }
  
  private matchesGlob(filePath: string, pattern: string): boolean {
    // Simple implementation - use minimatch in production
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern.replace('**/', '').replace('/', ''));
  }
}
```

**Parser Extension** (add to `import-extractor.ts`):
```typescript
// Extend extractImports to capture isTypeOnly
function extractImports(
  sourceFile: ts.SourceFile,
  relativePath: string,
  program: ts.Program,
  projectRoot: string
): ParsedImportInfo[] {
  const imports: ParsedImportInfo[] = [];
  
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = getModuleSpecifier(node);
      if (specifier) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const resolvedPath = resolveSpecifier(specifier, sourceFile.fileName, program, projectRoot);
        
        // NEW: Detect import type
        const importClause = node.importClause;
        const isTypeOnlyImport = importClause?.isTypeOnly ?? false;
        
        // NEW: Detect inline type imports { type X }
        const typeOnlyNames: string[] = [];
        if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
          for (const element of importClause.namedBindings.elements) {
            if (element.isTypeOnly) {
              typeOnlyNames.push(element.name.getText(sourceFile));
            }
          }
        }
        
        imports.push({
          sourceFile: relativePath,
          specifier,
          resolvedPath,
          line,
          importType: 'import',
          importSpecifier: getImportSpecifierType(node, sourceFile),
          isTypeOnlyImport,  // NEW
          typeOnlyNames,     // NEW
        });
      }
      return;
    }
    
    // ... rest of visitor
    ts.forEachChild(node, visit);
  };
  
  ts.forEachChild(sourceFile, visit);
  return imports;
}
```

### 3.2 Python Adapter

```typescript
/**
 * Python type definition detector
 * 
 * Python type hints are NOT pure compile-time - they're available at runtime!
 * Only .pyi stub files are truly compile-time.
 */
class PythonTypeDetector implements TypeDefinitionDetector {
  name = 'python';
  extensions = ['.py', '.pyi', '.pyx'];
  
  private typeFilePatterns: TypeFilePattern[] = [
    { pattern: '**/*.pyi', purityLevel: 0, confidenceBoost: 100 },  // Stubs
    { pattern: '**/__init__.pyi', purityLevel: 0, confidenceBoost: 100 },
    { pattern: '**/typing.py', purityLevel: 1, confidenceBoost: 60 }, // typing module has runtime
    { pattern: '**/types.py', purityLevel: 1, confidenceBoost: 50 },  // Common naming but runtime
  ];
  
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult {
    // Strategy 1: .pyi stub file
    if (node.path.endsWith('.pyi')) {
      return {
        purityLevel: 0,
        confidence: 100,
        reason: '.pyi stub file (pure type annotations)',
        evidence: ['Extension: .pyi'],
      };
    }
    
    // Strategy 2: Check if file only has type annotations (no implementations)
    // This requires AST analysis - check for:
    // - No function bodies (pass/... only)
    // - Only type alias definitions
    // - No class instantiation
    
    // Python type hints ARE runtime - can't assume type-only from imports
    return {
      purityLevel: 2, // Python types are runtime by default
      confidence: 30,
      reason: 'Python type hints have runtime presence',
      evidence: ['Python runtime type system'],
    };
  }
  
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean {
    // Python doesn't have import type - all imports are runtime
    // Only typing.TYPE_CHECKING blocks allow type-only imports
    if (edge.metadata?.importSpecifier?.includes('TYPE_CHECKING')) {
      return true;
    }
    return false;
  }
  
  suggestedLayerForTypeFile(): number {
    // .pyi stubs -> Layer 0
    // typing.py -> Layer 1 (runtime typing utilities)
    return 1; // Python types generally Layer 1
  }
}
```

**Python Edge Case**: `typing.TYPE_CHECKING` pattern:
```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from my_types import MyType  # This is import type equivalent
```

### 3.3 Go Adapter

```typescript
/**
 * Go type definition detector
 * 
 * CRITICAL: Go interfaces ARE runtime! They're used for:
 * - Type assertions
 * - Interface satisfaction checks
 * - Runtime polymorphism
 * 
 * Only pure interface files (no implementations in same package) 
 * can be considered "type-like", but still Layer 1.
 */
class GoTypeDetector implements TypeDefinitionDetector {
  name = 'go';
  extensions = ['.go'];
  
  private typeFilePatterns: TypeFilePattern[] = [
    { pattern: '**/interfaces/*.go', purityLevel: 1, confidenceBoost: 70 }, // Layer 1!
    { pattern: '**/types/*.go', purityLevel: 1, confidenceBoost: 60 },
    { pattern: '**/*_types.go', purityLevel: 1, confidenceBoost: 60 },
  ];
  
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult {
    // Go interfaces are runtime - always Layer 1 minimum
    // Need AST analysis to check if interface has implementations
    
    // Strategy: Check if all exports from file are interfaces
    // and no implementations exist in the package
    
    return {
      purityLevel: 1, // Go interfaces are Layer 1 (runtime)
      confidence: 40,
      reason: 'Go interfaces have runtime presence',
      evidence: ['Go runtime interface system'],
    };
  }
  
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean {
    // Go doesn't have import type - all imports are runtime
    // Interface imports ARE runtime dependencies
    return false;
  }
  
  suggestedLayerForTypeFile(): number {
    return 1; // Go interfaces -> Layer 1 (NOT Layer 0!)
  }
}
```

**Go Edge Cases**:
1. `interface{}` (empty interface) - matches everything
2. Structural typing - implicit interface satisfaction
3. Interface with method implementations in same file

### 3.4 Rust Adapter

```typescript
/**
 * Rust type definition detector
 * 
 * Rust traits ARE runtime - used for:
 * - Dynamic dispatch (dyn Trait)
 * - Trait bounds
 * - Trait objects
 * 
 * Only trait definitions with NO impl blocks could be "type-like",
 * but impl blocks can exist anywhere in the crate.
 */
class RustTypeDetector implements TypeDefinitionDetector {
  name = 'rust';
  extensions = ['.rs'];
  
  private typeFilePatterns: TypeFilePattern[] = [
    { pattern: '**/traits/*.rs', purityLevel: 1, confidenceBoost: 60 },
    { pattern: '**/types/*.rs', purityLevel: 1, confidenceBoost: 50 },
  ];
  
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult {
    // Rust traits are runtime - dyn Trait exists at runtime
    // Need crate-wide analysis to find impl blocks
    
    return {
      purityLevel: 1, // Rust traits -> Layer 1
      confidence: 30,
      reason: 'Rust traits have runtime presence (dyn Trait)',
      evidence: ['Rust trait objects are runtime'],
    };
  }
  
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean {
    // Rust doesn't have import type - all imports are runtime
    return false;
  }
  
  suggestedLayerForTypeFile(): number {
    return 1; // Rust traits -> Layer 1
  }
}
```

### 3.5 Java Adapter

```typescript
/**
 * Java type definition detector
 * 
 * Java interfaces ARE runtime - used for:
 * - Dynamic proxies
 * - Interface injection
 * - Reflection
 * 
 * Even interfaces with default methods are runtime.
 */
class JavaTypeDetector implements TypeDefinitionDetector {
  name = 'java';
  extensions = ['.java'];
  
  private typeFilePatterns: TypeFilePattern[] = [
    { pattern: '**/interfaces/**/*.java', purityLevel: 1, confidenceBoost: 60 },
    { pattern: '**/types/**/*.java', purityLevel: 1, confidenceBoost: 50 },
  ];
  
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult {
    // Java interfaces are fully runtime
    return {
      purityLevel: 1,
      confidence: 40,
      reason: 'Java interfaces are runtime types',
      evidence: ['Java reflection on interfaces'],
    };
  }
  
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean {
    return false; // Java has no import type
  }
  
  suggestedLayerForTypeFile(): number {
    return 1; // Java interfaces -> Layer 1
  }
}
```

### 3.6 C++ Adapter

```typescript
/**
 * C++ type definition detector
 * 
 * C++ headers (.h) can be:
 * - Pure declarations (forward declarations, interface definitions) -> Layer 0
 * - Headers with inline implementations -> Layer 1
 * - Headers with templates (compile-time but complex) -> Layer 0 or 1
 */
class CppTypeDetector implements TypeDefinitionDetector {
  name = 'cpp';
  extensions = ['.h', '.hpp', '.hxx', '.cpp', '.cxx', '.cc'];
  
  private typeFilePatterns: TypeFilePattern[] = [
    { pattern: '**/*.h', purityLevel: 0, confidenceBoost: 30 }, // Headers need analysis
    { pattern: '**/include/**/*.h', purityLevel: 0, confidenceBoost: 50 },
    { pattern: '**/interfaces/**/*.h', purityLevel: 0, confidenceBoost: 60 },
  ];
  
  isTypeDefinition(node: GraphNode, context: DetectionContext): TypePurityResult {
    // Strategy: Check header content for:
    // - Inline function implementations
    // - Template definitions with bodies
    // - constexpr variables
    
    if (node.path.endsWith('.h') || node.path.endsWith('.hpp')) {
      // Need AST analysis to determine purity
      // For now, assume Layer 0 for headers
      return {
        purityLevel: 0,
        confidence: 30, // Low confidence - needs verification
        reason: 'C++ header file (needs inline analysis)',
        evidence: ['Extension: .h/.hpp'],
      };
    }
    
    return {
      purityLevel: 2, // .cpp files are runtime
      confidence: 80,
      reason: 'C++ source file',
      evidence: ['Extension: .cpp/.cxx'],
    };
  }
  
  isTypeOnlyDependency(edge: GraphEdge, context: DetectionContext): boolean {
    // C++ header include could be type-only if header is declarations only
    // This requires analyzing what's used from the header
    return false; // Conservative: all includes are runtime
  }
  
  suggestedLayerForTypeFile(): number {
    return 0; // Pure declaration headers -> Layer 0
  }
}
```

---

## 4. Plugin Architecture Design

### 4.1 Plugin Registry

```typescript
/**
 * Language plugin for type detection
 */
interface LanguagePlugin {
  /** Plugin name */
  name: string;
  
  /** Supported file extensions */
  extensions: string[];
  
  /** Type definition detector implementation */
  detector: TypeDefinitionDetector;
  
  /** Parser adapter (optional, for full parsing) */
  parser?: Parser;
  
  /** Plugin version */
  version?: string;
  
  /** Plugin priority (higher = preferred for overlapping extensions) */
  priority?: number;
}

/**
 * Plugin registry for managing language-specific detectors
 */
class LanguagePluginRegistry {
  private plugins: Map<string, LanguagePlugin> = new Map();
  private extensionMap: Map<string, LanguagePlugin[]> = new Map();
  private defaultPriority = 0;
  
  /**
   * Register a language plugin
   */
  register(plugin: LanguagePlugin): void {
    // Validate plugin
    if (!plugin.name || !plugin.extensions.length || !plugin.detector) {
      throw new Error('[LanguagePluginRegistry] Invalid plugin structure');
    }
    
    // Store by name
    this.plugins.set(plugin.name, plugin);
    
    // Map extensions (allow multiple plugins per extension for fallback)
    for (const ext of plugin.extensions) {
      const existing = this.extensionMap.get(ext) || [];
      existing.push(plugin);
      // Sort by priority (higher first)
      existing.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.extensionMap.set(ext, existing);
    }
  }
  
  /**
   * Get detector for file extension
   */
  getDetector(extension: string): TypeDefinitionDetector | undefined {
    const plugins = this.extensionMap.get(extension);
    return plugins?.[0]?.detector;
  }
  
  /**
   * Get all detectors for extension (including fallbacks)
   */
  getAllDetectors(extension: string): TypeDefinitionDetector[] {
    const plugins = this.extensionMap.get(extension) || [];
    return plugins.map(p => p.detector);
  }
  
  /**
   * Detect language from file path
   */
  detectLanguage(filePath: string): LanguagePlugin | undefined {
    const ext = this.extractExtension(filePath);
    const plugins = this.extensionMap.get(ext);
    return plugins?.[0];
  }
  
  /**
   * Check if extension has registered detector
   */
  hasDetector(extension: string): boolean {
    return this.extensionMap.has(extension);
  }
  
  /**
   * Get all registered plugin names
   */
  getRegisteredLanguages(): string[] {
    return Array.from(this.plugins.keys());
  }
  
  private extractExtension(filePath: string): string {
    const match = filePath.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }
}
```

### 4.2 Built-in Plugin Registration

```typescript
// src/parser/plugin-registry.ts

import { TypeScriptTypeDetector } from './typescript-adapter.js';
import { PythonTypeDetector } from './python-adapter.js';
import { GoTypeDetector } from './go-adapter.js';
import { RustTypeDetector } from './rust-adapter.js';
import { JavaTypeDetector } from './java-adapter.js';
import { CppTypeDetector } from './cpp-adapter.js';

/**
 * Create registry with built-in plugins
 */
function createDefaultPluginRegistry(): LanguagePluginRegistry {
  const registry = new LanguagePluginRegistry();
  
  // TypeScript (highest priority for overlapping extensions)
  registry.register({
    name: 'typescript',
    extensions: ['.ts', '.tsx', '.d.ts', '.mts', '.cts'],
    detector: new TypeScriptTypeDetector(),
    priority: 10,
  });
  
  // Python
  registry.register({
    name: 'python',
    extensions: ['.py', '.pyi'],
    detector: new PythonTypeDetector(),
    priority: 5,
  });
  
  // Go
  registry.register({
    name: 'go',
    extensions: ['.go'],
    detector: new GoTypeDetector(),
    priority: 5,
  });
  
  // Rust
  registry.register({
    name: 'rust',
    extensions: ['.rs'],
    detector: new RustTypeDetector(),
    priority: 5,
  });
  
  // Java
  registry.register({
    name: 'java',
    extensions: ['.java'],
    detector: new JavaTypeDetector(),
    priority: 5,
  });
  
  // C++
  registry.register({
    name: 'cpp',
    extensions: ['.h', '.hpp', '.hxx', '.cpp', '.cxx', '.cc'],
    detector: new CppTypeDetector(),
    priority: 5,
  });
  
  return registry;
}
```

### 4.3 Configuration Extension

```typescript
// .codegraph/config.json

interface CodeGraphConfig {
  // Existing config...
  
  /** Language-specific type detection configuration */
  languages?: LanguageConfigMap;
  
  /** Custom plugins (file paths to load) */
  customPlugins?: string[];
}

interface LanguageConfigMap {
  typescript?: TypeScriptConfig;
  python?: PythonConfig;
  go?: GoConfig;
  rust?: RustConfig;
  java?: JavaConfig;
  cpp?: CppConfig;
}

interface TypeScriptConfig {
  /** Custom type file patterns */
  typeFilePatterns?: string[];
  
  /** Layer override for type files */
  typeDefinitionLayer?: number;
  
  /** Whether to use parser's isTypeOnly metadata */
  useParserTypeDetection?: boolean;
}

interface PythonConfig {
  stubFilePatterns?: string[];
  typeDefinitionLayer?: number;
}

interface GoConfig {
  /** Go interfaces are runtime - override layer */
  interfaceLayer?: number; // Default: 1
}

interface CppConfig {
  /** Header analysis mode: 'declaration-only' | 'with-inline' */
  headerAnalysisMode?: string;
}
```

---

## 5. Multi-Language Project Handling

### 5.1 Monorepo Structure

```
packages/
├── frontend/     (TypeScript)
│   └── types.ts          -> Layer 0 (pure compile-time)
│   └── utils.ts          -> Layer 1 (runtime foundation)
│   └── components/       -> Layer 2+ (business logic)
│
├── backend/      (Python)
│   └── stubs.pyi         -> Layer 0 (pure stubs)
│   └── typing.py         -> Layer 1 (runtime typing utilities)
│   └── api/              -> Layer 2+ (business logic)
│
├── core/         (Rust)
│   └── traits.rs         -> Layer 1 (Rust traits are runtime!)
│   └── lib.rs            -> Layer 2+ (business logic)
│
└── api/          (Go)
│   └── interfaces.go     -> Layer 1 (Go interfaces are runtime!)
│   └── handlers.go       -> Layer 2+ (business logic)
```

### 5.2 Cross-Language Dependency Handling

**Scenario**: TypeScript frontend imports types from Python backend via generated code.

```
backend/models.py (Python)
  ↓ [Protobuf/GraphQL IDL]
frontend/types.generated.ts (TypeScript)
```

**Strategy**:
1. **IDL-generated code**: Treat as Layer 0 in consumer language
2. **FFI boundaries**: Separate layers for each language
3. **IPC contracts**: Interface definitions are Layer 1 in both languages

```typescript
interface CrossLanguageConfig {
  /** IDL generation mappings */
  idlMappings: {
    /** Source language */
    source: string;
    /** Target language */
    target: string;
    /** Generated file patterns */
    generatedPatterns: string[];
    /** Layer override for generated files */
    generatedLayerOverride: number;
  }[];
  
  /** FFI boundary handling */
  ffiHandling: {
    /** Strategy: 'separate-layers' | 'shared-layer' */
    strategy: string;
    /** Layer for FFI bindings */
    ffiLayer: number;
  };
}
```

### 5.3 Package-Independent Layer Assignment

```typescript
/**
 * Multi-language layer assignment strategy
 */
class MultiLanguageLayerAssigner {
  private registry: LanguagePluginRegistry;
  
  assignLayer(node: GraphNode, context: DetectionContext): number {
    // 1. Get detector for node's language
    const detector = this.registry.getDetector(this.getExtension(node.path));
    
    if (!detector) {
      // Unknown language -> conservative Layer 2
      return 2;
    }
    
    // 2. Check type purity
    const purityResult = detector.isTypeDefinition(node, context);
    
    // 3. Map purity to layer
    if (purityResult.purityLevel === 0 && purityResult.confidence >= 80) {
      return detector.suggestedLayerForTypeFile(); // Usually 0
    }
    
    if (purityResult.purityLevel === 1) {
      return 1; // Foundation (interface-heavy files)
    }
    
    // 4. Normal layer assignment (dependency depth)
    return this.calculateDependencyLayer(node, context);
  }
  
  private getExtension(path: string): string {
    const match = path.match(/\.[^.]+$/);
    return match ? match[0] : '.ts'; // Default to TypeScript
  }
}
```

---

## 6. Implementation Path

### Phase 1: TypeScript Parser Enhancement (Week 1)

**Files to modify**:
1. `src/parser/ts-parser/import-extractor.ts` - Add `isTypeOnlyImport` detection
2. `src/parser/ts-parser/types.ts` - Extend `ParsedImportInfo`
3. `src/parser/ts-parser/edge-generator.ts` - Add `isTypeOnly` to edge metadata
4. `src/types.ts` - Extend `EdgeMetadata` and `ModuleMetadata`

**Tests**:
1. `tests/unit/ts-parser-import-type.test.ts` - New test file
2. Fixture: `tests/fixtures/import-type-project/`

**Deliverables**:
- Parser correctly detects `import type` and `import { type X }`
- Edge metadata includes `isTypeOnly: boolean`
- 100% test coverage for type-only import detection

### Phase 2: Abstract Interface & Plugin Registry (Week 2)

**New files**:
1. `src/types/detection-types.ts` - Core interface definitions
2. `src/parser/type-detector-registry.ts` - Plugin registry
3. `src/parser/typescript-type-detector.ts` - TypeScript implementation

**Tests**:
1. `tests/unit/type-detector-registry.test.ts`
2. `tests/unit/typescript-type-detector.test.ts`

**Deliverables**:
- Abstract `TypeDefinitionDetector` interface
- Plugin registry with registration/discovery
- TypeScript detector implementation

### Phase 3: Layer Assignment Integration (Week 3)

**Files to modify**:
1. `src/analyzer.ts` - Integrate type detection in layer assignment
2. `src/config/load-config.ts` - Add language config loading

**Tests**:
1. `tests/integration/type-layer-assignment.test.ts`

**Deliverables**:
- Type definition files assigned to Layer 0
- Mixed imports handled correctly
- Configuration system for overrides

### Phase 4: Multi-Language Support (Week 4)

**New files**:
1. `src/parser/python-adapter.ts` (stub - no implementation)
2. `src/parser/go-adapter.ts` (stub)
3. `src/parser/rust-adapter.ts` (stub)
4. Documentation for adding new language adapters

**Deliverables**:
- Architecture supports multiple languages
- Documentation for plugin development
- Integration tests for multi-language projects

---

## 7. Feasibility Assessment

### Technical Feasibility: 9/10

**Strengths**:
- TypeScript Compiler API fully supports `import type` detection
- Existing parser architecture is extensible
- Plugin registry pattern is well-established

**Weaknesses**:
- Multi-language AST parsing requires additional work
- Cross-language dependency analysis is complex

### Resource Requirements

| Component | Effort | Skills Required |
|-----------|--------|-----------------|
| TypeScript parser extension | 2-3 days | TypeScript Compiler API |
| Abstract interface design | 1 day | TypeScript interfaces |
| Plugin registry | 1 day | TypeScript generics |
| Layer assignment integration | 2 days | Graph algorithms |
| Test coverage | 2 days | Node.js test framework |
| Documentation | 1 day | Technical writing |

**Total**: ~10 days for Phase 1-3

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| TypeScript Compiler API complexity | Use existing patterns from `import-extractor.ts` |
| Multi-language parsing overhead | Stubs for Phase 4, actual parsing optional |
| Performance regression | Benchmark before/after with large projects |
| Breaking changes | Metadata fields are optional (backward compatible) |

---

## 8. Appendix: Test Fixtures

### TypeScript Import Type Fixture

```
tests/fixtures/import-type-project/
├── src/
│   ├── types.ts              # Pure type definitions
│   ├── utils.ts              # Runtime utilities
│   ├── consumer.ts           # Imports types with import type
│   ├── mixed-consumer.ts     # Mixed imports
│   └── runtime-types.ts      # Types with runtime exports
└── tsconfig.json
```

**types.ts**:
```typescript
// Pure type definition file - should be Layer 0
export interface User {
  id: string;
  name: string;
}

export type Status = 'active' | 'inactive';

export interface Config {
  apiUrl: string;
}
```

**consumer.ts**:
```typescript
// All type imports - should recognize type-only dependency
import type { User, Status } from './types';
import type { Config } from './types';

export function processUser(user: User): void {
  // No runtime dependency on types.ts
}
```

**mixed-consumer.ts**:
```typescript
// Mixed imports - should distinguish
import { validate } from './utils';         // Runtime import
import type { User } from './types';        // Type-only import
import { Config, type Status } from './runtime-types'; // Inline type import

// utils.ts is runtime dependency
// types.ts is type-only dependency
// runtime-types.ts has both (Config runtime, Status type)
```

---

## 9. Conclusion

This architecture provides:
1. **Language-agnostic abstraction** for type detection
2. **Extensible plugin system** for new languages
3. **Gradual purity levels** handling language differences
4. **Backward-compatible** metadata extensions
5. **Clear implementation path** with phased delivery

**Key Insight**: Different languages have different "compile-time" semantics. TypeScript's `import type` is pure compile-time, while Go/Rust/Java interfaces have runtime presence. The architecture handles this through configurable purity levels and layer overrides.

**Next Step**: Phase 1 implementation - TypeScript parser extension for `import type` detection.