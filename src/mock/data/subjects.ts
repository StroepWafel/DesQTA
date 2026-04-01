import type { MockHelpers } from '../helpers';

export const SUBJECTS_PAYLOAD = [
  {
    code: 'FOLDER1',
    description: 'Core Subjects',
    id: 1,
    active: 1,
    subjects: [
      { code: 'MATH', classunit: 101, description: 'Mathematics', metaclass: 1, title: 'Mathematics', programme: 1, marksbook_type: 'A' },
      { code: 'SCI', classunit: 102, description: 'Science', metaclass: 2, title: 'Science', programme: 1, marksbook_type: 'A' },
    ],
  },
  {
    code: 'FOLDER2',
    description: 'Languages',
    id: 2,
    active: 1,
    subjects: [
      { code: 'ENG', classunit: 201, description: 'English', metaclass: 3, title: 'English', programme: 2, marksbook_type: 'B' },
    ],
  },
];

export function createCoursesPayload(h: MockHelpers) {
  return [
    { id: 'C101', title: 'Algebra II', subject: 'MATH', teacher: 'Ms. Smith', updated: h.now.toISOString() },
    { id: 'C102', title: 'Chemistry', subject: 'SCI', teacher: 'Mr. Jones', updated: h.now.toISOString() },
    { id: 'C201', title: 'English Lit', subject: 'ENG', teacher: 'Mrs. Brown', updated: h.now.toISOString() },
  ];
}

export const PREFS_PAYLOAD = [
  { name: 'timetable.subject.colour.MATH', value: '#ff0000' },
  { name: 'timetable.subject.colour.SCI', value: '#00ff00' },
  { name: 'timetable.subject.colour.ENG', value: '#0000ff' },
];
