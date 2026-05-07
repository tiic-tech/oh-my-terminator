/**
 * Output handlers for CLI commands
 *
 * WHY: Separates output routing logic from CLI setup.
 * Each handler processes a specific result type and routes to appropriate streams.
 *
 * Handlers:
 * - output: Analyze/Update results
 * - outputMigrate: Migrate results
 * - outputImpact: Impact analysis results
 * - outputScope: Scope query results
 * - outputLayers: Layers analysis results
 * - outputError: Generic error handling
 */

import { routeOutput, detectMode, createOutput } from '../src/cli/output/router.js';
import { formatAnalyzeJson, formatUpdateJson, formatErrorJson } from '../src/cli/output/json-formatter.js';
import { formatMigrateJson } from '../src/cli/output/json-formatter.js';
import { formatAnalyzeText } from '../src/cli/output/analyze-text.js';
import { formatUpdateText } from '../src/cli/output/update-text.js';
import { formatErrorText } from '../src/cli/output/error-text.js';
import { formatMigrateText } from '../src/cli/output/migrate-text.js';
import { formatImpactJson, formatImpactText, formatImpactErrorJson, formatImpactErrorText } from '../src/cli/output/impact-formatter.js';
import { formatScopeJson, formatScopeText, formatScopeErrorJson, formatScopeErrorText } from '../src/cli/output/scope-formatter.js';
import { formatLayersJson, formatLayersText, formatLayersErrorJson, formatLayersErrorText } from '../src/cli/output/layers-formatter.js';
import type { AnalyzeResult, UpdateResult, CliError, EdgeCaseResult } from '../src/types.js';
import type { ImpactResult, ImpactError, ScopeResult, ScopeError, LayersResult, LayersError } from '../src/api/types/index.js';
import { CliErrorCode } from '../src/types.js';

/**
 * Output AnalyzeResult or UpdateResult
 *
 * Routes to appropriate formatter based on result type and json flag.
 * Handles EdgeCaseResult separately (has 'kind' property).
 */
export function output(result: AnalyzeResult | UpdateResult | EdgeCaseResult | CliError, json?: boolean): void {
  const mode = detectMode({ json });

  if (!result.success) {
    // CliError
    if (json) {
      routeOutput(formatErrorJson(result as CliError), mode);
    } else {
      routeOutput(formatErrorText(result as CliError), mode);
    }
    return;
  }

  // Check for EdgeCaseResult (has 'kind' property)
  if ('kind' in result) {
    // EdgeCaseResult - format as analyze-like output
    const edgeCase = result as EdgeCaseResult;
    if (json) {
      routeOutput(createOutput(JSON.stringify(edgeCase)), mode);
    } else {
      routeOutput(createOutput(`${edgeCase.kind}: ${edgeCase.message}${edgeCase.suggestions ? '\nSuggestions:\n' + edgeCase.suggestions.map((s: string) => `  - ${s}`).join('\n') : ''}`), mode);
    }
    return;
  }

  // AnalyzeResult or UpdateResult
  if (json) {
    if ('baseline' in result) {
      // AnalyzeResult
      routeOutput(formatAnalyzeJson(result as AnalyzeResult), mode);
    } else {
      // UpdateResult
      routeOutput(formatUpdateJson(result as UpdateResult), mode);
    }
  } else {
    if ('baseline' in result) {
      // AnalyzeResult
      routeOutput(formatAnalyzeText(result as AnalyzeResult), mode);
    } else {
      // UpdateResult
      routeOutput(formatUpdateText(result as UpdateResult), mode);
    }
  }
}

/**
 * Output MigrateResult
 *
 * Routes to appropriate formatter based on json flag.
 */
export function outputMigrate(result: MigrateResult | CliError, json?: boolean): void {
  const mode = detectMode({ json });

  if (!result.success) {
    // CliError
    if (json) {
      routeOutput(formatErrorJson(result as CliError), mode);
    } else {
      routeOutput(formatErrorText(result as CliError), mode);
    }
    return;
  }

  // MigrateResult
  if (json) {
    routeOutput(formatMigrateJson(result), mode);
  } else {
    routeOutput(formatMigrateText(result), mode);
  }
}

/**
 * Output ImpactResult
 *
 * Routes to appropriate formatter based on result type and json flag.
 */
export function outputImpact(result: ImpactResult | ImpactError, json?: boolean): void {
  const mode = detectMode({ json });

  if (result.success) {
    if (json) {
      routeOutput(formatImpactJson(result), mode);
    } else {
      routeOutput(formatImpactText(result), mode);
    }
  } else {
    // TypeScript doesn't narrow correctly in else block, need explicit cast
    const errorResult = result as ImpactError;
    if (json) {
      routeOutput(formatImpactErrorJson(errorResult), mode);
    } else {
      routeOutput(formatImpactErrorText(errorResult), mode);
    }
  }
}

/**
 * Output ScopeResult
 *
 * Routes to appropriate formatter based on result type and json flag.
 * Handles both ScopeError and CliError.
 */
export function outputScope(result: ScopeResult | ScopeError | CliError, json?: boolean): void {
  const mode = detectMode({ json });

  if (!result.success) {
    // ScopeError or CliError
    if (json) {
      // Check if it's a ScopeError (has 'error' with 'suggestion') or CliError (has 'error' with 'code' enum)
      if ('error' in result && 'suggestion' in result.error) {
        // ScopeError
        routeOutput(formatScopeErrorJson(result as ScopeError), mode);
      } else {
        // CliError - use generic error formatter
        routeOutput(formatErrorJson(result as CliError), mode);
      }
    } else {
      if ('error' in result && 'suggestion' in result.error) {
        // ScopeError
        routeOutput(formatScopeErrorText(result as ScopeError), mode);
      } else {
        // CliError - use generic error formatter
        routeOutput(formatErrorText(result as CliError), mode);
      }
    }
    return;
  }

  // ScopeResult
  if (json) {
    routeOutput(formatScopeJson(result as ScopeResult), mode);
  } else {
    routeOutput(formatScopeText(result as ScopeResult), mode);
  }
}

/**
 * Output LayersResult
 *
 * Routes to appropriate formatter based on result type and json flag.
 * Handles both LayersError and CliError.
 *
 * @param verbose - Show matched patterns for inferred layer names
 */
export function outputLayers(result: LayersResult | LayersError | CliError, json?: boolean, verbose?: boolean): void {
  const mode = detectMode({ json });

  if (!result.success) {
    // LayersError or CliError
    if (json) {
      // Check if it's a LayersError (has 'error' with 'suggestion') or CliError (has 'error' with 'code' enum)
      if ('error' in result && 'suggestion' in result.error) {
        // LayersError
        routeOutput(formatLayersErrorJson(result as LayersError), mode);
      } else {
        // CliError - use generic error formatter
        routeOutput(formatErrorJson(result as CliError), mode);
      }
    } else {
      if ('error' in result && 'suggestion' in result.error) {
        // LayersError
        routeOutput(formatLayersErrorText(result as LayersError), mode);
      } else {
        // CliError - use generic error formatter
        routeOutput(formatErrorText(result as CliError), mode);
      }
    }
    return;
  }

  // LayersResult
  if (json) {
    routeOutput(formatLayersJson(result as LayersResult), mode);
  } else {
    routeOutput(formatLayersText(result as LayersResult, verbose), mode);
  }
}

/**
 * Output generic error
 *
 * Creates CliError from unknown error and routes appropriately.
 */
export function outputError(error: unknown, json?: boolean): void {
  const mode = detectMode({ json });

  const cliError: CliError = {
    success: false,
    error: { code: CliErrorCode.E_PARSE_FAILED, message: String(error) },
    durationMs: 0
  };

  if (json) {
    routeOutput(formatErrorJson(cliError), mode);
  } else {
    routeOutput(formatErrorText(cliError), mode);
  }
}