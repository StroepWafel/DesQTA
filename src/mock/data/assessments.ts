import type { MockHelpers } from '../helpers';

export const ASSESSMENT_SUBJECT_CODES = ['MATH', 'SCI', 'ENG'];

export const SUBJECT_MAP = [
  { code: 'MATH', subject: 'Math' },
  { code: 'SCI', subject: 'Science' },
  { code: 'ENG', subject: 'English' },
];

export function createUpcomingAssessments(h: MockHelpers) {
  const dates = h.genDates2025(14);
  let payload = dates.map((d, i) => {
    const m = SUBJECT_MAP[i % SUBJECT_MAP.length];
    return { id: 200 + i, code: m.code, subject: m.subject, due: d, title: 'Assessment ' + (i + 1), status: 'UPCOMING' };
  });
  payload = h.sortByDateDesc(payload, (x) => x.due);
  const today = new Date();
  const future = payload.filter((a) => new Date(a.due) >= today);
  if (future.length < 3) return payload.slice(0, 5);
  return future.slice(0, 5);
}

export function createPastTasks(h: MockHelpers) {
  const dates = h.genDates2025(14);
  return h.sortByDateDesc(
    dates.map((d, i) => ({
      id: 300 + i,
      code: h.getRandomItem(ASSESSMENT_SUBJECT_CODES),
      due: d,
      title: 'Past Task ' + (i + 1),
      status: 'MARKS_RELEASED',
    })),
    (x) => x.due
  );
}

export const ASSESSMENT_DETAIL = {
  title: 'Quadratic Equations and Applications',
  description:
    'This assessment covers solving quadratic equations by factoring, completing the square, and using the quadratic formula. You will also apply these skills to real-world problems.',
  due: '2025-11-15',
  subject: 'Math',
  code: 'MATH',
  marked: true,
  submissionSettings: { fileSubmissionEnabled: false },
  expectations: [
    { name: 'Algebraic Manipulation', description: 'Solve quadratic equations using multiple methods' },
    { name: 'Problem Solving', description: 'Apply quadratic models to real-world scenarios' },
  ],
  criteria: [
    { name: 'Correctness', description: 'Accurate solutions with clear working', results: { grade: 'A', percentage: 85 } },
    { name: 'Method Selection', description: 'Appropriate method chosen for each problem', results: { grade: 'A', percentage: 85 } },
  ],
};

export const SUBMISSIONS_PAYLOAD = [
  { id: 1, assessmentId: 9999, submitted: true, submittedAt: '2025-11-10T10:00:00Z', grade: 'A' },
  { id: 2, assessmentId: 9999, submitted: false, submittedAt: null, grade: null },
];

export function createSubmissionsPayload(assessmentId: number) {
  return [
    { id: 1, assessmentId, submitted: true, submittedAt: '2025-11-10T10:00:00Z', grade: 'A' },
    { id: 2, assessmentId, submitted: false, submittedAt: null, grade: null },
  ];
}
