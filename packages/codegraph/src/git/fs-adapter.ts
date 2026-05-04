import {
  promises as fsPromises,
  readFileSync as realReadFileSync,
  writeFileSync as realWriteFileSync,
  statSync as realStatSync,
  existsSync as realExistsSync,
  mkdirSync as realMkdirSync,
  readdirSync as realReaddirSync,
  unlinkSync as realUnlinkSync,
} from 'fs';

/**
 * fs adapter for isomorphic-git
 *
 * isomorphic-git requires an fs object with both:
 * - promises interface (for async operations)
 * - sync methods as async wrappers (isomorphic-git expects these to be async)
 *
 * This adapter wraps Node.js fs module to provide the required interface.
 */

export const fs = {
  /** Promises interface for async operations */
  promises: fsPromises,

  /** Async wrapper for readFileSync */
  readFileSync: async (path: string, options?: BufferEncoding | { encoding?: BufferEncoding }): Promise<Buffer | string> => {
    return realReadFileSync(path, options);
  },

  /** Async wrapper for writeFileSync */
  writeFileSync: async (path: string, content: string | Buffer, options?: BufferEncoding | { encoding?: BufferEncoding }): Promise<void> => {
    realWriteFileSync(path, content, options);
  },

  /** Async wrapper for statSync */
  statSync: async (path: string): Promise<{ isFile: () => boolean; isDirectory: () => boolean; size: number }> => {
    const stats = realStatSync(path);
    return {
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
      size: stats.size,
    };
  },

  /** Async wrapper for existsSync */
  existsSync: async (path: string): Promise<boolean> => {
    return realExistsSync(path);
  },

  /** Async wrapper for mkdirSync */
  mkdirSync: async (path: string, options?: { recursive?: boolean }): Promise<void> => {
    realMkdirSync(path, options);
  },

  /** Async wrapper for readdirSync */
  readdirSync: async (path: string, options?: { encoding?: BufferEncoding; withFileTypes?: boolean }): Promise<string[]> => {
    return realReaddirSync(path, options as BufferEncoding) as string[];
  },

  /** Async wrapper for unlinkSync */
  unlinkSync: async (path: string): Promise<void> => {
    realUnlinkSync(path);
  },
};