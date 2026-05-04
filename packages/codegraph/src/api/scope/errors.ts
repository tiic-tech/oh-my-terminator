/**
 * C7: Error Result Creators
 *
 * Creates structured error results for Scope and QuickBrief APIs.
 */

import { type ScopeError, type QuickBriefError, ErrorCode } from '../types/index.js';

/**
 * Create Scope error result
 */
export function createScopeError(
  code: string,
  message: string,
  suggestion?: string,
  startTime: number
): ScopeError {
  return {
    success: false,
    error: { code, message, suggestion },
    durationMs: Date.now() - startTime,
  };
}

/**
 * Create QuickBrief error result
 */
export function createBriefError(
  code: string,
  message: string,
  suggestion?: string,
  startTime: number
): QuickBriefError {
  return {
    success: false,
    error: { code, message, suggestion },
    durationMs: Date.now() - startTime,
  };
}