import type { MockHelpers } from '../helpers';

export const TIMETABLE_SLOTS = [
  { from: '08:30', until: '09:20' },
  { from: '09:30', until: '10:20' },
  { from: '10:30', until: '11:20' },
  { from: '11:30', until: '12:20' },
  { from: '13:10', until: '14:00' },
  { from: '14:10', until: '15:00' },
];

export const TIMETABLE_SUBJECTS = [
  { code: 'MATH', description: 'Mathematics', staff: 'Ms. Smith', room: 'A1', classunit: 101 },
  { code: 'SCI', description: 'Science', staff: 'Mr. Jones', room: 'B2', classunit: 102 },
  { code: 'ENG', description: 'English', staff: 'Mrs. Brown', room: 'C3', classunit: 201 },
];

export function createTimetableLessons(
  h: MockHelpers,
  fromStr?: string,
  untilStr?: string
): Array<{
  date: string;
  from: string;
  until: string;
  description: string;
  staff: string;
  room: string;
  code: string;
  classunit: number;
}> {
  const lessons: Array<{
    date: string;
    from: string;
    until: string;
    description: string;
    staff: string;
    room: string;
    code: string;
    classunit: number;
  }> = [];
  const start = fromStr
    ? new Date(fromStr + 'T00:00:00Z')
    : new Date('2025-01-01T00:00:00Z');
  const end = untilStr
    ? new Date(untilStr + 'T23:59:59Z')
    : new Date('2026-12-31T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    TIMETABLE_SLOTS.forEach((slot, idx) => {
      const subj = TIMETABLE_SUBJECTS[(d.getUTCDate() + idx) % TIMETABLE_SUBJECTS.length];
      lessons.push({
        date: h.toISODate(d),
        from: slot.from,
        until: slot.until,
        description: subj.description,
        staff: subj.staff,
        room: subj.room,
        code: subj.code,
        classunit: subj.classunit,
      });
    });
  }
  return lessons;
}
