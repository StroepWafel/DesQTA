import { seqtaFetch } from '../../utils/netUtil';
import { calculateWeightedGradePredictions } from './gradeCalculationService';
import {
  saveWeightedPrediction,
  hasReleasedCountChanged,
  loadReleasedCount,
  getNewAssessmentIds,
  loadProcessedIds,
} from './weightedGradeCacheService';
import { extractWeightingsForAssessments } from './weightingService';
import type { Assessment } from '../types';

const STUDENT_ID = 69;

/**
 * Check for new marked assessments and auto-calculate grades in background
 * Only processes subjects where the count of released assessments has changed
 */
export async function checkAndCalculateNewGrades(
  assessments: Assessment[],
): Promise<void> {
  try {
    // Group assessments by subject code
    const assessmentsBySubject = new Map<string, Assessment[]>();
    for (const assessment of assessments) {
      const code = assessment.code;
      if (!assessmentsBySubject.has(code)) {
        assessmentsBySubject.set(code, []);
      }
      assessmentsBySubject.get(code)!.push(assessment);
    }

    // Process each subject
    for (const [subjectCode, subjectAssessments] of assessmentsBySubject.entries()) {
      try {
        // First, count released assessments (without fetching details)
        const releasedAssessments = subjectAssessments.filter(
          (a) => a.status === 'MARKS_RELEASED',
        );
        const currentCount = releasedAssessments.length;

        // Check if count has changed - if not, skip this subject entirely
        const countChanged = await hasReleasedCountChanged(subjectCode, currentCount);

        if (!countChanged) {
          continue;
        }

        // Count changed - now get released assessments with grades
        // Only fetch details for new assessments that haven't been processed
        const releasedWithGrades = await getReleasedAssessmentsWithGrades(
          subjectAssessments,
          subjectCode,
        );
        const actualCount = releasedWithGrades.length;

        // Get only new assessment IDs that haven't been processed
        const assessmentIds = releasedWithGrades.map((a) => a.id);
        const newIds = await getNewAssessmentIds(subjectCode, assessmentIds);

        // Only process new assessments
        const newAssessments = releasedWithGrades.filter((a) => newIds.includes(a.id));

        if (newAssessments.length > 0) {
          // Extract weightings for new assessments in background
          extractWeightingsForAssessments(newAssessments);
        }

        // Calculate weighted grade prediction using all released assessments
        // (we need all of them for accurate calculation, not just new ones)
        const predictions = await calculateWeightedGradePredictions(releasedWithGrades);
        const prediction = predictions.get(subjectCode);

        if (prediction) {
          // Save prediction to cache
          await saveWeightedPrediction(subjectCode, prediction);
        }
      } catch (e) {
        // Silently fail for individual subjects
      }
    }
  } catch (e) {
    // Silently fail
  }
}

/**
 * Get released assessments with grades for a subject
 * Only fetches details for assessments that haven't been processed yet
 */
async function getReleasedAssessmentsWithGrades(
  assessments: Assessment[],
  subjectCode: string,
): Promise<Assessment[]> {
  const assessmentsWithGrades: Assessment[] = [];
  
  // Load already processed IDs for this subject
  const processedIds = await loadProcessedIds(subjectCode);

  for (const assessment of assessments) {
    // Skip if not released
    if (assessment.status !== 'MARKS_RELEASED') {
      continue;
    }

    // If already has grade, use it directly
    if (assessment.finalGrade !== undefined && assessment.finalGrade !== null) {
      assessmentsWithGrades.push(assessment);
      continue;
    }

    // If already processed, skip fetching (we don't have the grade cached, but we've already tried)
    if (processedIds.has(assessment.id)) {
      continue;
    }

    // New assessment - fetch details
    try {
      // Fetch full assessment details
      const res = await seqtaFetch('/seqta/student/assessment/get?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          assessment: assessment.id,
          student: STUDENT_ID,
          metaclass: assessment.metaclassID || 0,
        },
      });

      const assessmentData = JSON.parse(res).payload;

      // Check if marked (same logic as AssessmentDetails component)
      const isMarked = assessmentData.marked === true;
      const hasCriteria = assessmentData.criteria && assessmentData.criteria.length > 0;
      const firstCriterion = hasCriteria ? assessmentData.criteria[0] : null;
      const hasResults = firstCriterion?.results;

      if (isMarked && hasResults) {
        // Extract grade from criteria[0].results.percentage
        let finalGrade: number | undefined = undefined;

        if (firstCriterion.results.percentage !== undefined) {
          finalGrade = Number(firstCriterion.results.percentage);
        } else if (assessmentData.results?.percentage !== undefined) {
          finalGrade = Number(assessmentData.results.percentage);
        }

        if (finalGrade !== undefined && !isNaN(finalGrade)) {
          assessmentsWithGrades.push({
            ...assessment,
            status: 'MARKS_RELEASED' as const,
            finalGrade,
            metaclassID: assessment.metaclassID || 0,
          });
        }
      }
    } catch (e) {
      // Silently fail for individual assessments
    }
  }

  return assessmentsWithGrades;
}
