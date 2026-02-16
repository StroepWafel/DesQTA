export interface TimetableLesson {
  id: string;
  code: string;
  description: string;
  date: string; // YYYY-MM-DD
  from: string; // HH:mm
  until: string; // HH:mm
  staff: string;
  room: string;
  colour: string; // hex color
  attendanceTitle?: string;
  programmeID?: number;
  dayIdx: number; // 0-4 for Mon-Fri
  uid?: string;
}

export interface TimetableWidgetSettings {
  viewMode?: 'week' | 'day' | 'month' | 'list';
  timeRange?: { start: string; end: string }; // HH:mm
  showTeacher?: boolean;
  showRoom?: boolean;
  showAttendance?: boolean;
  showEmptyPeriods?: boolean;
  density?: 'compact' | 'normal' | 'comfortable';
  defaultView?: 'today' | 'week';
}

export type { LessonColour } from '../types';
