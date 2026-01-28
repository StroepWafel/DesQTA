import { cache } from '../../utils/cache';
import { setIdb, getWithIdbFallback } from './idbCache';
import { logger } from '../../utils/logger';
import { invoke } from '@tauri-apps/api/core';

const WEIGHTING_CACHE_TTL_DAYS = 30; // Long-lived cache since weightings don't change
const WEIGHTING_CACHE_TTL_MINUTES = WEIGHTING_CACHE_TTL_DAYS * 24 * 60;

/**
 * Get assessment weighting from cache or extract from PDF
 * @param assessmentId - Assessment ID
 * @param metaclassId - Metaclass ID
 * @returns Weighting percentage (0-100) or null if extraction fails
 */
export async function getAssessmentWeighting(
  assessmentId: number,
  metaclassId: number,
): Promise<number | null> {
  const cacheKey = `assessment_weighting_${assessmentId}`;

  // Check memory cache first
  const memCached = cache.get<number>(cacheKey);
  if (memCached !== null && memCached !== undefined) {
    logger.debug('weightingService', 'getAssessmentWeighting', 'Cache hit (memory)', {
      assessmentId,
      weighting: memCached,
    });
    return memCached;
  }

  // Check IndexedDB/SQLite cache
  const idbCached = await getWithIdbFallback<number>(
    cacheKey,
    cacheKey,
    () => cache.get<number>(cacheKey),
  );
  if (idbCached !== null && idbCached !== undefined) {
    logger.debug('weightingService', 'getAssessmentWeighting', 'Cache hit (IndexedDB)', {
      assessmentId,
      weighting: idbCached,
    });
    // Restore to memory cache
    cache.set(cacheKey, idbCached, WEIGHTING_CACHE_TTL_MINUTES);
    return idbCached;
  }

  // Cache miss - extract from PDF using Rust backend
  logger.debug('weightingService', 'getAssessmentWeighting', 'Cache miss - extracting from PDF via Rust backend', {
    assessmentId,
  });

  try {
    // Call Rust backend to extract weighting from PDF
    const weight = await invoke<number | null>('get_assessment_weighting', {
      assessmentId,
      metaclassId,
    });

    if (weight !== null && weight !== undefined) {
      // Cache the weighting
      cache.set(cacheKey, weight, WEIGHTING_CACHE_TTL_MINUTES);
      await setIdb(cacheKey, weight, WEIGHTING_CACHE_TTL_MINUTES);
      logger.info('weightingService', 'getAssessmentWeighting', 'Weighting extracted and cached', {
        assessmentId,
        weighting: weight,
      });
      return weight;
    } else {
      logger.warn('weightingService', 'getAssessmentWeighting', 'Weight not found in PDF', {
        assessmentId,
      });
      return null;
    }
  } catch (e) {
    logger.error('weightingService', 'getAssessmentWeighting', `Failed to extract weighting: ${e}`, {
      assessmentId,
      error: e,
    });
    return null;
  }
}

/**
 * Extract weightings for multiple assessments in background (non-blocking)
 * @param assessments - Array of assessments with id, metaclassID, and status
 */
export async function extractWeightingsForAssessments(
  assessments: Array<{ id: number; metaclassID: number; status: string }>,
): Promise<void> {
  // Filter to only released assessments
  const releasedAssessments = assessments.filter(
    (a) => a.status === 'MARKS_RELEASED' && a.id && a.metaclassID,
  );

  if (releasedAssessments.length === 0) {
    logger.debug(
      'weightingService',
      'extractWeightingsForAssessments',
      'No released assessments to process',
    );
    return;
  }

  logger.debug('weightingService', 'extractWeightingsForAssessments', 'Processing assessments', {
    count: releasedAssessments.length,
  });

  // Process in background (don't await - let it run async)
  Promise.all(
    releasedAssessments.map(async (assessment) => {
      try {
        await getAssessmentWeighting(assessment.id, assessment.metaclassID);
      } catch (e) {
        // Silently fail for individual assessments - don't block others
        logger.debug('weightingService', 'extractWeightingsForAssessments', 'Failed for assessment', {
          assessmentId: assessment.id,
          error: e,
        });
      }
    }),
  ).catch((e) => {
    logger.error('weightingService', 'extractWeightingsForAssessments', 'Background extraction failed', {
      error: e,
    });
  });
}
