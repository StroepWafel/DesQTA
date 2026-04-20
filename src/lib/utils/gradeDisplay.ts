/** True when SEQTA sent a plain numeric mark (e.g. "85" / "85.5"), not a letter band. */
export function isNumericGradeString(s: string | undefined | null): boolean {
  if (s == null || String(s).trim() === '') return false;
  return /^\d+(\.\d+)?$/.test(String(s).trim());
}

/**
 * Single primary label: non-numeric `letterGrade` from SEQTA as-is; otherwise percentage.
 */
export function primaryGradeDisplay(assessment: {
  letterGrade?: string | null;
  finalGrade?: number | null;
}): string {
  const lg = assessment.letterGrade != null ? String(assessment.letterGrade).trim() : '';
  if (lg && !isNumericGradeString(lg)) {
    return lg;
  }
  if (assessment.finalGrade != null && !isNaN(Number(assessment.finalGrade))) {
    return `${assessment.finalGrade}%`;
  }
  if (lg && isNumericGradeString(lg)) {
    return `${parseFloat(lg)}%`;
  }
  return '—';
}

export function hasGradeToShow(assessment: {
  letterGrade?: string | null;
  finalGrade?: number | null;
}): boolean {
  const lg = assessment.letterGrade != null ? String(assessment.letterGrade).trim() : '';
  if (lg && !isNumericGradeString(lg)) return true;
  if (assessment.finalGrade != null && !isNaN(Number(assessment.finalGrade))) return true;
  if (lg && isNumericGradeString(lg)) return true;
  return false;
}

function normGradeKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Assessment **details** view only: label + bar are separate.
 * - Bar width comes from `percentage` (handled by the caller).
 * - If SEQTA sends a mark in `grade` that is purely numeric → show **percentage**, never a letter.
 * - If `availableGrades` is present and `grade` matches an entry (e.g. A, B, UG, N/A) → show that **letter/label** from SEQTA.
 * - If only `percentage` (no letter scale) → show formatted **percentage**.
 * Analytics and other pages use {@link primaryGradeDisplay} instead.
 */
export function formatAssessmentDetailGradeDisplay(
  grade: string | undefined,
  percentage: number | undefined,
  availableGrades?: string[] | null,
): string {
  const g = grade != null ? String(grade).trim() : '';

  if (g && isNumericGradeString(g)) {
    const n = parseFloat(g);
    if (!isNaN(n)) return `${n.toFixed(2)}%`;
  }

  if (!g) {
    if (percentage != null && !isNaN(Number(percentage))) {
      return `${Number(percentage).toFixed(2)}%`;
    }
    return 'No Grade';
  }

  const list = (availableGrades ?? []).filter(Boolean).map((x) => String(x).trim());

  if (list.length > 0) {
    const inList = list.some((ag) => normGradeKey(ag) === normGradeKey(g));
    if (inList) {
      return g;
    }
    if (percentage != null && !isNaN(Number(percentage))) {
      return `${Number(percentage).toFixed(2)}%`;
    }
    return g;
  }

  return g;
}

/** @deprecated Prefer {@link formatAssessmentDetailGradeDisplay} with criterion `availableGrades`. */
export function formatCriterionGradeDisplay(
  grade: string | undefined,
  percentage: number | undefined,
): string {
  return formatAssessmentDetailGradeDisplay(grade, percentage, undefined);
}
