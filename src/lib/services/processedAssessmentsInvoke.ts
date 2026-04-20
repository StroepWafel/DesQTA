import { invoke } from '@tauri-apps/api/core';
import type { Assessment, Subject } from '$lib/types';

export type ProcessedAssessmentsInvokeResult = {
  assessments: Assessment[];
  subjects: Subject[];
  all_subjects: Subject[];
  filters: Record<string, boolean>;
  years: number[];
};

let inFlight: Promise<ProcessedAssessmentsInvokeResult> | null = null;
let lastCompletedAt: number | null = null;

/**
 * Deduplicates concurrent `get_processed_assessments` calls (warmup, assessments page,
 * global search, notifications) so only one heavy SEQTA batch runs at a time.
 */
export function invokeGetProcessedAssessments(): Promise<ProcessedAssessmentsInvokeResult> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = invoke<ProcessedAssessmentsInvokeResult>('get_processed_assessments').finally(() => {
    inFlight = null;
    lastCompletedAt = Date.now();
  });
  return inFlight;
}

/**
 * Used to avoid repeatedly rebuilding `assessments_overview_data` while the cache is still fresh.
 * This targets the "bg" DataLoader metric cost (~2s) without affecting correctness (warmup/page/search
 * still update the shared in-flight promise).
 */
export function shouldRefreshProcessedAssessments(ttlMs: number = 10 * 60 * 1000): boolean {
  // If the heavy processed-assessments call is already running (warmup/page/search overlap),
  // don't start another background rebuild.
  if (inFlight) return false;
  if (!lastCompletedAt) return true;
  return Date.now() - lastCompletedAt > ttlMs;
}
