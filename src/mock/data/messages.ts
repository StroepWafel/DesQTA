import type { MockHelpers } from '../helpers';

export const MESSAGE_SUBJECTS = [
  'Welcome to DesQTA',
  'Assignment Reminder',
  'Important Notice',
  'Class Schedule Update',
  'Exam Information',
  'Project Guidelines',
  'Parent Meeting',
  'Field Trip Permission',
  'Library Resources',
  'Course Materials',
  'Homework Help',
  'Study Group',
  'Academic Progress',
  'Event Invitation',
  'System Maintenance',
  'New Resources Available',
  'Grade Update',
  'Attendance Notice',
  'Calendar Change',
  'Support Request',
];

export const MESSAGE_SENDERS = [
  'Mr. Johnson',
  'Ms. Smith',
  'Dr. Williams',
  'Mrs. Brown',
  'Prof. Davis',
  'Mr. Wilson',
  'Ms. Taylor',
  'Dr. Anderson',
  'Mrs. Martin',
  'Mr. Thompson',
  'Ms. Garcia',
  'Dr. Rodriguez',
  'Mrs. Lewis',
  'Mr. Walker',
  'Ms. Hall',
  'School Admin',
  'IT Support',
  'Library Staff',
  'Counselor',
  'Principal',
];

export const PARTICIPANTS = [
  'Student Portal',
  'Class Group',
  'Study Team',
  'Project Team',
  'All Students',
  'Year 10 Students',
  'Year 11 Students',
  'Year 12 Students',
];

export const DIRECTORY_PEOPLE = [
  {
    id: 1,
    firstname: 'Alice',
    surname: 'Smith',
    xx_display: 'Alice Smith',
    year: '10',
    sub_school: 'Middle',
    house: 'Red',
    house_colour: '#ff0000',
    campus: 'Main',
    rollgroup: '10A',
  },
  {
    id: 2,
    firstname: 'Bob',
    surname: 'Jones',
    xx_display: 'Bob Jones',
    year: '11',
    sub_school: 'Senior',
    house: 'Blue',
    house_colour: '#0000ff',
    campus: 'North',
    rollgroup: '11B',
  },
  {
    id: 3,
    firstname: 'Charlie',
    surname: 'Brown',
    xx_display: 'Charlie Brown',
    year: '12',
    sub_school: 'Senior',
    house: 'Green',
    campus: 'Main',
    rollgroup: '12C',
    house_colour: '#00ff00',
  },
];

export function createMessages(h: MockHelpers, count: number) {
  const baseDate = new Date('2025-12-31T12:00:00Z');
  const messages = Array.from({ length: count }, (_, i) => {
    const randomDaysBack = Math.floor(Math.random() * 365);
    const randomHoursOffset = Math.floor(Math.random() * 24);
    const randomMinutesOffset = Math.floor(Math.random() * 60);
    const messageDate = new Date(baseDate);
    messageDate.setDate(messageDate.getDate() - randomDaysBack);
    messageDate.setHours(randomHoursOffset, randomMinutesOffset);
    const subject =
      MESSAGE_SUBJECTS[i % MESSAGE_SUBJECTS.length] +
      (i > MESSAGE_SUBJECTS.length ? ` ${Math.floor(i / MESSAGE_SUBJECTS.length) + 1}` : '');
    const sender = MESSAGE_SENDERS[i % MESSAGE_SENDERS.length];
    const participant = PARTICIPANTS[i % PARTICIPANTS.length];
    return {
      id: 1000 + i,
      subject,
      sender,
      date: messageDate.toISOString(),
      participants: [{ name: participant }],
      attachments: Math.random() > 0.8,
      read: Math.random() > 0.3,
      starred: Math.random() > 0.9,
      lastMessageAt: messageDate.toISOString(),
    };
  });
  return h.sortByDateDesc(messages, (m) => m.date);
}
