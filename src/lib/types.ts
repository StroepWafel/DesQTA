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
}

export type AnalyticsData = Assessment[];
