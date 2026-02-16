import type { TimetableLesson } from '../types/timetable';

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface LessonPosition {
  top: number;
  height: number;
  left?: number;
  width?: number;
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculate lesson position in grid based on time range
 */
export function calculateLessonPosition(
  lesson: TimetableLesson,
  timeRange: TimeRange,
  gridHeight: number,
): LessonPosition {
  const startMinutes = timeToMinutes(timeRange.start);
  const endMinutes = timeToMinutes(timeRange.end);
  const rangeMinutes = endMinutes - startMinutes;

  const lessonStart = timeToMinutes(lesson.from);
  const lessonEnd = timeToMinutes(lesson.until);

  const top = ((lessonStart - startMinutes) / rangeMinutes) * gridHeight;
  const height = ((lessonEnd - lessonStart) / rangeMinutes) * gridHeight;

  return {
    top: Math.max(0, top),
    height: Math.max(20, height), // Minimum height of 20px
  };
}

/**
 * Get current time indicator position
 */
export function getCurrentTimeIndicator(
  timeRange: TimeRange,
  gridHeight: number,
): number | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(timeRange.start);
  const endMinutes = timeToMinutes(timeRange.end);

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return null;
  }

  const rangeMinutes = endMinutes - startMinutes;
  return ((currentMinutes - startMinutes) / rangeMinutes) * gridHeight;
}

/**
 * Format time for display (HH:mm)
 */
export function formatTime(time: string): string {
  return time.substring(0, 5); // Ensure HH:mm format
}

/**
 * Format time for display with AM/PM
 */
export function formatTime12Hour(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const hour12 = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

/**
 * Get day index from date (0 = Monday, 4 = Friday)
 */
export function getDayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
}

/**
 * Get Monday of the week containing the given date
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date from YYYY-MM-DD string
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Check if lesson is currently active
 */
export function isLessonActive(lesson: TimetableLesson): boolean {
  const now = new Date();
  const lessonDate = parseDate(lesson.date);
  
  // Check if same day
  if (
    now.getFullYear() !== lessonDate.getFullYear() ||
    now.getMonth() !== lessonDate.getMonth() ||
    now.getDate() !== lessonDate.getDate()
  ) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const lessonStart = timeToMinutes(lesson.from);
  const lessonEnd = timeToMinutes(lesson.until);

  return currentMinutes >= lessonStart && currentMinutes <= lessonEnd;
}

/**
 * Group lessons by time slot for overlapping display
 */
export function groupLessonsByTime(lessons: TimetableLesson[]): Map<string, TimetableLesson[]> {
  const groups = new Map<string, TimetableLesson[]>();

  for (const lesson of lessons) {
    const key = `${lesson.from}-${lesson.until}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(lesson);
  }

  return groups;
}

/**
 * Sort lessons by time
 */
export function sortLessonsByTime(lessons: TimetableLesson[]): TimetableLesson[] {
  return [...lessons].sort((a, b) => {
    const timeA = timeToMinutes(a.from);
    const timeB = timeToMinutes(b.from);
    return timeA - timeB;
  });
}

/**
 * Get unique time slots from lessons
 */
export function getUniqueTimeSlots(lessons: TimetableLesson[]): string[] {
  const slots = new Set<string>();
  for (const lesson of lessons) {
    slots.add(lesson.from);
    slots.add(lesson.until);
  }
  return Array.from(slots).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/**
 * Calculate time bounds from lessons
 */
export function calculateTimeBounds(lessons: TimetableLesson[]): TimeRange {
  if (lessons.length === 0) {
    return { start: '08:00', end: '16:00' };
  }

  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const lesson of lessons) {
    const start = timeToMinutes(lesson.from);
    const end = timeToMinutes(lesson.until);
    minTime = Math.min(minTime, start);
    maxTime = Math.max(maxTime, end);
  }

  // Round to nearest hour for cleaner display
  const startHour = Math.floor(minTime / 60);
  const endHour = Math.ceil(maxTime / 60);

  return {
    start: `${String(startHour).padStart(2, '0')}:00`,
    end: `${String(endHour).padStart(2, '0')}:00`,
  };
}
