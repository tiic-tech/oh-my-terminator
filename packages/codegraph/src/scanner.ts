import fs from 'fs';
import path from 'path';
import { GraphNode, GraphEdge, NodeType, EdgeType } from './types.js';
import { DEFAULT_IGNORE_RULES, shouldIgnore } from './ignore-rules.js';

/**
 * Result of scanning a directory
 */
export interface ScanResult {
  /** All DIRECTORY and FILE nodes created */
  nodes: GraphNode[];

  /** All CONTAINS edges generated */
  edges: GraphEdge[];

  /** Relative paths of files matching extensions */
  filesToParse: string[];

  /** Statistics about the scan */
  stats: {
    directories: number;
    files: number;
    skipped: number;
  };

  /** Non-fatal error messages */
  warnings: string[];
}

/**
 * Options for directory scanning
 */
export interface ScanOptions {
  /** File extensions to collect (default: ['.ts', '.tsx', '.js', '.jsx', '.mjs']) */
  extensions?: string[];

  /** Custom ignore rules (overrides default) */
  ignoreRules?: string[];

  /** Include hidden files/dirs (default: false) */
  includeHidden?: boolean;

  /** Maximum recursion depth (default: 20) */
  maxDepth?: number;
}

/**
 * Default scan options
 */
const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  ignoreRules: DEFAULT_IGNORE_RULES,
  includeHidden: false,
  maxDepth: 20,
};

/**
 * Scan a directory recursively and generate graph nodes/edges
 *
 * Creates DIRECTORY and FILE nodes with CONTAINS edges representing
 * the file system structure. Also collects parseable files for later
 * module extraction.
 *
 * @param root - Absolute path to the project root directory
 * @param options - Optional scan configuration
 * @returns Scan result with nodes, edges, files to parse, stats, and warnings
 *
 * @example
 * ```typescript
 * const result = await scanDirectory('/path/to/project');
 * console.log(`Found ${result.stats.files} files`);
 * result.nodes.forEach(n => graph.addNode(n));
 * result.edges.forEach(e => graph.addEdge(e));
 * ```
 */
export async function scanDirectory(
  root: string,
  options?: ScanOptions
): Promise<ScanResult> {
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const result: ScanResult = {
    nodes: [],
    edges: [],
    filesToParse: [],
    stats: { directories: 0, files: 0, skipped: 0 },
    warnings: [],
  };

  // Check if root exists
  if (!fs.existsSync(root)) {
    result.warnings.push(`Root path does not exist: ${root}`);
    return result;
  }

  // Check if root is a directory
  const rootStat = fs.statSync(root);
  if (!rootStat.isDirectory()) {
    result.warnings.push(`Root path is not a directory: ${root}`);
    return result;
  }

  // Start recursive scan
  await scanRecursive(root, root, opts, 0, result, '');

  return result;
}

/**
 * Internal recursive scanning function
 *
 * Orchestration function that coordinates directory traversal.
 * Delegates file processing to processFileEntry helper.
 */
async function scanRecursive(
  currentDir: string,
  rootDir: string,
  opts: Required<ScanOptions>,
  depth: number,
  result: ScanResult,
  parentNodeId: string
): Promise<void> {
  // Depth check
  if (depth > opts.maxDepth) {
    const relativePath = path.relative(rootDir, currentDir);
    result.warnings.push(`Max depth ${opts.maxDepth} reached at ${relativePath}`);
    result.stats.skipped++;
    return;
  }

  // Get relative path
  const relativePath = path.relative(rootDir, currentDir);

  // Check ignore rules
  if (relativePath && shouldIgnore(relativePath, opts.ignoreRules)) {
    result.stats.skipped++;
    return;
  }

  // Check hidden
  if (!opts.includeHidden) {
    const name = path.basename(currentDir);
    if (name.startsWith('.')) {
      result.stats.skipped++;
      return;
    }
  }

  // Read directory entries
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.warnings.push(`Permission denied: ${relativePath || '.'} - ${msg}`);
    result.stats.skipped++;
    return;
  }

  // Empty directory - skip
  if (entries.length === 0) {
    result.stats.skipped++;
    return;
  }

  // Create directory node
  // Use currentDir basename for root to get actual directory name (not '.')
  const currentNodeId = depth === 0 ? 'DIRECTORY:.' : `DIRECTORY:${relativePath}`;
  const dirName = depth === 0 ? path.basename(currentDir) : path.basename(relativePath);
  result.nodes.push({
    id: currentNodeId,
    type: NodeType.DIRECTORY,
    path: relativePath || '.',
    name: dirName || '.',
  });
  result.stats.directories++;

  // Create CONTAINS edge from parent
  if (parentNodeId) {
    result.edges.push(createContainsEdge(parentNodeId, currentNodeId));
  }

  // Process each entry
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

    // Skip symbolic links, hidden, or ignored entries
    if (shouldSkipEntry(entry, entryRelativePath, opts, result)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively scan subdirectory
      await scanRecursive(entryPath, rootDir, opts, depth + 1, result, currentNodeId);
    } else if (entry.isFile()) {
      // Process file entry
      processFileEntry(entryRelativePath, entry.name, currentNodeId, opts, result);
    }
  }
}

/**
 * Check if an entry should be skipped during scanning
 *
 * Handles symbolic links, hidden files, and ignore rule checks.
 * Updates skip statistics when entry is filtered out.
 */
function shouldSkipEntry(
  entry: fs.Dirent,
  entryRelativePath: string,
  opts: Required<ScanOptions>,
  result: ScanResult
): boolean {
  // Skip symbolic links
  if (entry.isSymbolicLink()) {
    result.stats.skipped++;
    return true;
  }

  // Skip hidden files/dirs
  if (!opts.includeHidden && entry.name.startsWith('.')) {
    result.stats.skipped++;
    return true;
  }

  // Check ignore rules
  if (shouldIgnore(entryRelativePath, opts.ignoreRules)) {
    result.stats.skipped++;
    return true;
  }

  return false;
}

/**
 * Process a file entry and add to scan results
 *
 * Creates file node, CONTAINS edge, and adds to parseable files list
 * if extension matches configured extensions.
 */
function processFileEntry(
  entryRelativePath: string,
  entryName: string,
  parentNodeId: string,
  opts: Required<ScanOptions>,
  result: ScanResult
): void {
  // Create file node using helper
  const fileNode = createFileNode(entryRelativePath);
  result.nodes.push(fileNode);
  result.stats.files++;

  // Create CONTAINS edge
  const fileId = `FILE:${entryRelativePath}`;
  result.edges.push(createContainsEdge(parentNodeId, fileId));

  // Check if file should be parsed
  if (isParseableFile(entryName, opts.extensions)) {
    result.filesToParse.push(entryRelativePath);
  }
}

/**
 * Check if a file should be parsed based on extension
 *
 * @param filename - Name of the file to check
 * @param extensions - Array of allowed extensions (e.g., ['.ts', '.tsx'])
 * @returns true if the file extension matches one of the allowed extensions
 *
 * @example
 * ```typescript
 * isParseableFile('main.ts', ['.ts', '.tsx']) // true
 * isParseableFile('config.json', ['.ts', '.tsx']) // false
 * ```
 */
export function isParseableFile(filename: string, extensions: string[]): boolean {
  const ext = path.extname(filename);
  return extensions.includes(ext);
}

/**
 * Create a directory node
 *
 * @param relativePath - Relative path from project root (e.g., "src/components")
 * @returns A GraphNode with type DIRECTORY
 *
 * @example
 * ```typescript
 * const node = createDirectoryNode('src/utils');
 * // node.id = "DIRECTORY:src/utils"
 * ```
 */
export function createDirectoryNode(relativePath: string): GraphNode {
  const id = relativePath === '.' || relativePath === '' ? 'DIRECTORY:.' : `DIRECTORY:${relativePath}`;
  return {
    id,
    type: NodeType.DIRECTORY,
    path: relativePath || '.',
    name: path.basename(relativePath) || '.',
  };
}

/**
 * Create a file node
 *
 * @param relativePath - Relative path from project root (e.g., "src/main.ts")
 * @returns A GraphNode with type FILE
 *
 * @example
 * ```typescript
 * const node = createFileNode('src/utils/helper.ts');
 * // node.id = "FILE:src/utils/helper.ts"
 * ```
 */
export function createFileNode(relativePath: string): GraphNode {
  return {
    id: `FILE:${relativePath}`,
    type: NodeType.FILE,
    path: relativePath,
    name: path.basename(relativePath),
  };
}

/**
 * Create a CONTAINS edge
 *
 * @param parentId - ID of the parent node (typically DIRECTORY)
 * @param childId - ID of the child node (FILE or DIRECTORY)
 * @returns A GraphEdge with type CONTAINS
 *
 * @example
 * ```typescript
 * const edge = createContainsEdge('DIRECTORY:src', 'FILE:src/main.ts');
 * // edge.from = "DIRECTORY:src", edge.to = "FILE:src/main.ts", edge.type = CONTAINS
 * ```
 */
export function createContainsEdge(parentId: string, childId: string): GraphEdge {
  return {
    from: parentId,
    to: childId,
    type: EdgeType.CONTAINS,
  };
}