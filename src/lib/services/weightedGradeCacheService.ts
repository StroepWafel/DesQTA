import { setIdb, getWithIdbFallback } from './idbCache';
import { cache } from '../../utils/cache';
import type { WeightedGradePrediction } from './gradeCalculationService';

const PREDICTION_CACHE_TTL_DAYS = 30;
const PREDICTION_CACHE_TTL_MINUTES = PREDICTION_CACHE_TTL_DAYS * 24 * 60;
const RELEASED_COUNT_CACHE_TTL_MINUTES = 60; // 1 hour

/**
 * Cache key for weighted grade predictions per subject
 */
function getPredictionCacheKey(subjectCode: string): string {
  return `weighted_grade_prediction_${subjectCode}`;
}

/**
 * Cache key for released assessment count per subject
 */
function getReleasedCountCacheKey(subjectCode: string): string {
  return `released_assessments_count_${subjectCode}`;
}

/**
 * Save weighted grade prediction for a subject
 */
export async function saveWeightedPrediction(
  subjectCode: string,
  prediction: WeightedGradePrediction,
): Promise<void> {
  const cacheKey = getPredictionCacheKey(subjectCode);
  
  // Store in memory cache
  cache.set(cacheKey, prediction, PREDICTION_CACHE_TTL_MINUTES);
  
  // Store in IndexedDB/SQLite
  await setIdb(cacheKey, prediction, PREDICTION_CACHE_TTL_MINUTES);
}

/**
 * Load weighted grade prediction for a subject
 */
export async function loadWeightedPrediction(
  subjectCode: string,
): Promise<WeightedGradePrediction | null> {
  const cacheKey = getPredictionCacheKey(subjectCode);
  
  // Check memory cache first
  const memCached = cache.get<WeightedGradePrediction>(cacheKey);
  if (memCached !== null && memCached !== undefined) {
    return memCached;
  }
  
  // Check IndexedDB/SQLite cache
  const idbCached = await getWithIdbFallback<WeightedGradePrediction>(
    cacheKey,
    cacheKey,
    () => cache.get<WeightedGradePrediction>(cacheKey),
  );
  
  if (idbCached !== null && idbCached !== undefined) {
    // Restore to memory cache
    cache.set(cacheKey, idbCached, PREDICTION_CACHE_TTL_MINUTES);
    return idbCached;
  }
  
  return null;
}

/**
 * Load all cached weighted predictions
 */
export async function loadAllWeightedPredictions(): Promise<Record<string, WeightedGradePrediction>> {
  const predictions: Record<string, WeightedGradePrediction> = {};
  
  // We can't easily enumerate all keys in IndexedDB, so we'll load them on-demand
  // when subjects are loaded. For now, return empty object.
  // The component will call loadWeightedPrediction for each subject.
  
  return predictions;
}

/**
 * Save released assessment count for a subject
 */
export async function saveReleasedCount(subjectCode: string, count: number): Promise<void> {
  const cacheKey = getReleasedCountCacheKey(subjectCode);
  
  // Store in memory cache
  cache.set(cacheKey, count, RELEASED_COUNT_CACHE_TTL_MINUTES);
  
  // Store in IndexedDB/SQLite
  await setIdb(cacheKey, count, RELEASED_COUNT_CACHE_TTL_MINUTES);
}

/**
 * Load released assessment count for a subject
 */
export async function loadReleasedCount(subjectCode: string): Promise<number | null> {
  const cacheKey = getReleasedCountCacheKey(subjectCode);
  
  // Check memory cache first
  const memCached = cache.get<number>(cacheKey);
  if (memCached !== null && memCached !== undefined) {
    return memCached;
  }
  
  // Check IndexedDB/SQLite cache
  const idbCached = await getWithIdbFallback<number>(
    cacheKey,
    cacheKey,
    () => cache.get<number>(cacheKey),
  );
  
  if (idbCached !== null && idbCached !== undefined) {
    // Restore to memory cache
    cache.set(cacheKey, idbCached, RELEASED_COUNT_CACHE_TTL_MINUTES);
    return idbCached;
  }
  
  return null;
}

/**
 * Check if released count has changed for a subject
 */
export async function hasReleasedCountChanged(
  subjectCode: string,
  currentCount: number,
): Promise<boolean> {
  const cachedCount = await loadReleasedCount(subjectCode);
  
  if (cachedCount === null) {
    // First time, save and return true to trigger calculation
    await saveReleasedCount(subjectCode, currentCount);
    return true;
  }
  
  if (cachedCount !== currentCount) {
    // Count changed, update cache and return true
    await saveReleasedCount(subjectCode, currentCount);
    return true;
  }
  
  // Count unchanged
  return false;
}

/**
 * Cache key for processed assessment IDs per subject
 */
function getProcessedIdsCacheKey(subjectCode: string): string {
  return `processed_assessment_ids_${subjectCode}`;
}

/**
 * Save processed assessment IDs for a subject
 */
export async function saveProcessedIds(subjectCode: string, ids: number[]): Promise<void> {
  const cacheKey = getProcessedIdsCacheKey(subjectCode);
  const ttlMinutes = 30 * 24 * 60; // 30 days
  
  cache.set(cacheKey, ids, ttlMinutes);
  await setIdb(cacheKey, ids, ttlMinutes);
}

/**
 * Load processed assessment IDs for a subject
 */
export async function loadProcessedIds(subjectCode: string): Promise<Set<number>> {
  const cacheKey = getProcessedIdsCacheKey(subjectCode);
  
  const memCached = cache.get<number[]>(cacheKey);
  if (memCached) {
    return new Set(memCached);
  }
  
  const idbCached = await getWithIdbFallback<number[]>(
    cacheKey,
    cacheKey,
    () => cache.get<number[]>(cacheKey),
  );
  
  if (idbCached) {
    cache.set(cacheKey, idbCached, 30 * 24 * 60);
    return new Set(idbCached);
  }
  
  return new Set();
}

/**
 * Get new assessment IDs that haven't been processed yet
 */
export async function getNewAssessmentIds(
  subjectCode: string,
  assessmentIds: number[],
): Promise<number[]> {
  const processedIds = await loadProcessedIds(subjectCode);
  const newIds = assessmentIds.filter((id) => !processedIds.has(id));
  
  if (newIds.length > 0) {
    // Update processed IDs
    const updatedIds = [...Array.from(processedIds), ...newIds];
    await saveProcessedIds(subjectCode, updatedIds);
  }
  
  return newIds;
}
