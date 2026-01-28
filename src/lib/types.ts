export interface Assessment {
  id: number;
  title: string;
  subject: string;
  status: 'OVERDUE' | 'MARKS_RELEASED' | 'PENDING';
  due: string;
  code: string;
  metaclassID: number;
  programmeID: number;
  graded: boolean;
  overdue: boolean;
  hasFeedback: boolean;
  expectationsEnabled: boolean;
  expectationsCompleted: boolean;
  reflectionsEnabled: boolean;
  reflectionsCompleted: boolean;
  availability: string;
  finalGrade?: number; // Optional final grade percentage
  letterGrade?: string; // Optional letter grade from assessment (e.g., "A+", "B", "D")
  weighting?: number; // Optional assessment weighting percentage
}

export type AnalyticsData = Assessment[];

export interface LessonColour {
  name: string;
  value: string;
}

export interface Subject {
  code: string;
  title: string;
  colour?: string;
  [key: string]: unknown;
}

export interface AssessmentsOverviewData {
  assessments: Assessment[];
  subjects: Subject[];
  allSubjects: Subject[];
  filters: Record<string, boolean>;
  years: number[];
}

export interface WeightedGradePrediction {
  subjectCode: string;
  predictedGrade: number;
  assessmentsCount: number;
  totalWeight: number;
  assessments: Array<{ id: number; title: string; grade: number; weighting: number }>;
}