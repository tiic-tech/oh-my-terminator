/**
 * @oh-my-terminator/codegraph
 *
 * Core graph data structure for repository relationship modeling
 */

export {
  NodeType,
  EdgeType,
  type GraphNode,
  type GraphEdge,
  type ModuleMetadata,
  type EdgeMetadata,
  type SerializedCodeGraph,
  // C5: Analyzer Types
  type FullAnalysisResult,
  type AnalysisStats,
  type AnalysisOptions,
  type ProgressEvent,
  type ProgressCallback,
  // C5: Parser Registry Types
  type ParserResult,
  type Parser,
  type ParserRegistry,
} from './types.js';

export { CodeGraph } from './graph.js';

export {
  DEFAULT_IGNORE_RULES,
  shouldIgnore,
} from './ignore-rules.js';

export {
  scanDirectory,
  isParseableFile,
  createDirectoryNode,
  createFileNode,
  createContainsEdge,
  type ScanResult,
  type ScanOptions,
} from './scanner.js';

export {
  TypeScriptParser,
  parseImports,
  createParserProgram,
  resolveModulePath,
  createExternalNode,
  generateImportEdge,
  generateReExportEdge,
  generateDynamicImportEdge,
  extractPackageName,
  isBuiltinModule,
  type ParsedImportInfo,
  type ParserOptions,
  type ParserProgramResult,
  // C5: TypeScript Parser Adapter
  TypeScriptParserAdapter,
} from './parser/index.js';

// C5: Parser Registry
export {
  DefaultParserRegistry,
  type ParserRegistryOptions,
  type RegistryLogger,
} from './parser-registry.js';

// C5: Core Analyzer
export { analyzeFull } from './analyzer.js';

// C6: Persistence Module
export {
  // Types
  type SchemaVersion,
  type SkillDemand,
  type MigrationRecord,
  type Baseline,
  type CompatibilityReason,
  type CompatibilityAction,
  type CompatibilityResult,
  type ActionConfig,
  type ActionResult,
  type LoadFailureReason,
  type FailureInfo,
  type LoadBaselineOptions,
  type LoadBaselineResult,
  type SaveBaselineOptions,
  type ValidationResult,
  type IntegrityResult,
  type MigrationScript,
  // Error classes
  BaselineErrorCode,
  IncompatibleBaselineError,
  BaselineError,
  // Version
  CURRENT_SCHEMA_VERSION,
  GENERATOR_VERSION,
  LEGACY_VERSION,
  SchemaVersionImpl,
  // Paths
  CODEGRAPH_DIR,
  BASELINE_FILE,
  LAST_COMMIT_FILE,
  VERSION_FILE,
  MIGRATION_LOG_FILE,
  getBaselinePath,
  getLastCommitPath,
  getVersionPath,
  getMigrationLogPath,
  getCodegraphDirPath,
  ensureCodegraphDir,
  getBackupPath,
  getTempPath,
  // Compatibility
  checkSchemaCompatibility,
  determineAction,
  executeAction,
  // Baseline operations
  validateBaselineStructure,
  verifyDataIntegrity,
  handleFailure,
  loadBaseline,
  saveBaseline,
  // Migration
  registerMigration,
  versionMatchesPattern,
  findMigrationPath,
  migrateBaseline,
  safeMigrateBaseline,
  clearMigrationRegistry,
} from './persistence/index.js';

// C7/C8: API Module (Scope Query, QuickBrief, Impact Analysis, Architecture Layers)
export {
  // C7 Types
  type ComplexityLevel,
  type ComplexityInfo,
  type ModifiedInfo,
  type ExportInfo,
  type ImportInfo,
  type ImportKind,
  type ImportedByInfo,
  type ScopeResult,
  type ScopeError,
  type QuickBriefResult,
  type QuickBriefError,
  type TargetType,
  type NormalizedTarget,
  // C8 Types
  type AffectedFile,
  type ImpactResult,
  type ImpactError,
  type ImpactOptions,
  type LayerRole,
  type GroupStats,
  type LayerAssignment,
  type ViolationSeverity,
  type ViolationFilePair,
  type LayerViolation,
  type GroupSummary,
  type LayersResult,
  type LayersError,
  type LayersOptions,
  // C8 Inference Types (E2E testing)
  type SourceRootResult,
  type SourceRootCandidate,
  type CycleInfo,
  type ConfidenceInputs,
  type Suggestion,
  type SuggestionType,
  type SuggestionContext,
  ErrorCode,
  // C7 Functions
  getScope,
  getQuickBrief,
  // C7 Internal helpers (testing)
  normalizeTarget,
  extractExports,
  extractImports,
  extractImportedBy,
  extractImportsWithKind,
  findTestFile,
  aggregateComplexity,
  checkDeprecated,
  countImports,
  countImportedBy,
  formatScopeOutput,
  formatQuickBriefOutput,
  // C8 Functions
  getImpact,
  getArchitectureLayers,
  // C8 Internal helpers (testing)
  normalizeTargetsToFile,
  bfsDependents,
  mergeBFSResults,
  isTestFile,
  formatImpactOutput,
  calculateBlastRadius,
  generateNextSuggested,
  generateWarnings,
  groupFilesByFirstLevelDirectory,
  computeImportDirectionStats,
  getGroupNameFromFile,
  inferArchitectureLayers,
  detectLayerViolations,
  calculateLayerHealthScore,
  calculateSeverity,
  generateViolationSuggestion,
  buildGroupSummaries,
  buildGroupToLayerMap,
  formatLayersOutput,
  generateLayersWarnings,
  generateLayersNextSuggested,
  // C8 Inference helpers (E2E testing)
  detectSourceRoot,
  detectCycles,
  calculateCyclePenalty,
  calculateConfidence,
  generateSuggestions,
  getProjectThreshold,
  detectProjectScale,
  SIGNAL_WEIGHTS,
  EXCLUDED_DIRECTORIES,
  CONFIDENCE_CONSTANTS,
  SUGGESTION_CONSTANTS,
} from './api/index.js';

// Core module: Source Root Auto-Detection
export {
  // Constants
  PROJECT_MARKERS,
  MARKER_PRIORITY,
  GENERIC_MARKER,
  MAX_SEARCH_DEPTH,
  // Types
  type DetectionResult,
  type DetectorOptions,
  // Default options
  DEFAULT_DETECTOR_OPTIONS,
} from './core/index.js';