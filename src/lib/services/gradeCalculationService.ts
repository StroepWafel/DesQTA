import type { Assessment } from '$lib/types';
import { getAssessmentWeighting } from './weightingService';
import { cache } from '../../utils/cache';
import { getWithIdbFallback } from './idbCache';
import { logger } from '../../utils/logger';

export interface WeightedGradePrediction {
  subjectCode: string;
  predictedGrade: number;
  assessmentsCount: number;
  totalWeight: number;
  assessments: Array<{ id: number; title: string; grade: number; weighting: number }>;
}

/**
 * Calculate weighted grade predictions per subject
 * @param assessments - Array of assessments with finalGrade and status
 * @returns Map of subject code to WeightedGradePrediction
 */
export async function calculateWeightedGradePredictions(
  assessments: Assessment[],
): Promise<Map<string, WeightedGradePrediction>> {
  // Filter to only released assessments with grades
  const gradedAssessments = assessments.filter(
    (a) => a.status === 'MARKS_RELEASED' && a.finalGrade !== undefined && a.finalGrade !== null,
  );

  if (gradedAssessments.length === 0) {
    return new Map();
  }

  // Group assessments by subject code
  const assessmentsBySubject = new Map<string, Assessment[]>();
  for (const assessment of gradedAssessments) {
    const code = assessment.code;
    if (!assessmentsBySubject.has(code)) {
      assessmentsBySubject.set(code, []);
    }
    assessmentsBySubject.get(code)!.push(assessment);
  }

  const predictions = new Map<string, WeightedGradePrediction>();

  // Calculate weighted average for each subject
  for (const [subjectCode, subjectAssessments] of assessmentsBySubject.entries()) {
    try {
      const weightedData = await calculateSubjectWeightedGrade(
        subjectCode,
        subjectAssessments,
      );

      if (weightedData) {
        predictions.set(subjectCode, weightedData);
      }
    } catch (e) {
      logger.error(
        'gradeCalculationService',
        'calculateWeightedGradePredictions',
        `Failed to calculate for subject ${subjectCode}: ${e}`,
        { subjectCode, error: e },
      );
    }
  }

  return predictions;
}

/**
 * Calculate weighted grade for a single subject
 */
async function calculateSubjectWeightedGrade(
  subjectCode: string,
  assessments: Assessment[],
): Promise<WeightedGradePrediction | null> {
  const assessmentData: Array<{ id: number; title: string; grade: number; weighting: number }> =
    [];
  let totalWeightedGrade = 0;
  let totalWeight = 0;

  for (const assessment of assessments) {
    const grade = assessment.finalGrade!;

    // Get weighting from cache or extract if needed
    let weighting: number | null = null;

    // Check cache first
    const cacheKey = `assessment_weighting_${assessment.id}`;
    const cachedWeighting = cache.get<number>(cacheKey);
    if (cachedWeighting !== null && cachedWeighting !== undefined) {
      weighting = cachedWeighting;
    } else {
      // Check IndexedDB
      const idbWeighting = await getWithIdbFallback<number>(
        cacheKey,
        cacheKey,
        () => cache.get<number>(cacheKey),
      );
      if (idbWeighting !== null && idbWeighting !== undefined) {
        weighting = idbWeighting;
      } else {
        // Try to extract if we have metaclassID
        if (assessment.metaclassID) {
          try {
            weighting = await getAssessmentWeighting(assessment.id, assessment.metaclassID);
          } catch (e) {
            // Use equal weight on failure
          }
        }
      }
    }

    // Fallback to equal weighting if extraction failed or not available
    if (weighting === null || weighting === undefined || isNaN(weighting)) {
      weighting = 1; // Equal weight
    }

    assessmentData.push({
      id: assessment.id,
      title: assessment.title,
      grade,
      weighting,
    });

    totalWeightedGrade += grade * weighting;
    totalWeight += weighting;
  }

  if (totalWeight === 0 || assessmentData.length === 0) {
    return null;
  }

  const predictedGrade = totalWeightedGrade / totalWeight;

  return {
    subjectCode,
    predictedGrade: Math.round(predictedGrade * 100) / 100, // Round to 2 decimal places
    assessmentsCount: assessmentData.length,
    totalWeight: Math.round(totalWeight * 100) / 100,
    assessments: assessmentData,
  };
}
