import { readFile } from 'node:fs/promises';

// WHY: Centralize compression stats calculation - duplicated in analyze.ts and update.ts
// WHY: Single source of truth prevents drift and simplifies maintenance

export interface CompressionStats {
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savingsPercent: number;
}

// WHY: Returns undefined when baseline file missing - graceful degradation, not error
export async function calculateCompressionStats(
  projectRoot: string,
  originalSizeBytes: number,
): Promise<CompressionStats | undefined> {
  const baselinePath = `.codegraph/baseline.json`;
  const fullPath = `${projectRoot}/${baselinePath}`;

  try {
    const savedContent = await readFile(fullPath, 'utf-8');
    const compressedSizeBytes = Buffer.byteLength(savedContent, 'utf-8');
    // WHY: Guard against division by zero - defensive programming
    const savingsPercent =
      originalSizeBytes > 0
        ? Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100)
        : 0;

    return {
      originalSizeBytes,
      compressedSizeBytes,
      savingsPercent,
    };
  } catch {
    // WHY: Silently return undefined when file missing - compression stats are optional info
    return undefined;
  }
}