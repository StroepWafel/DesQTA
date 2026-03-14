import type { MockHelpers } from '../helpers';

export const NOTICE_LABELS = [
  { id: 1, title: 'General', colour: '#910048' },
  { id: 2, title: 'Urgent', colour: '#ff0000' },
  { id: 3, title: 'Academic', colour: '#2563eb' },
  { id: 4, title: 'Events', colour: '#059669' },
  { id: 5, title: 'Sports', colour: '#dc2626' },
  { id: 6, title: 'Administrative', colour: '#7c3aed' },
];

export const NOTICE_TITLES = [
  'Welcome Back to School',
  'Parent-Teacher Conference Schedule',
  'School Sports Day Event',
  'Library Hours Extended',
  'New Course Registration Open',
  'Exam Schedule Released',
  'Student Council Elections',
  'Science Fair Announcement',
  'Art Exhibition Opening',
  'Drama Club Auditions',
  'Field Trip Permission Required',
  'Uniform Policy Update',
  'Cafeteria Menu Changes',
  'Technology Lab Maintenance',
  'Music Concert Tickets Available',
  'Career Fair Next Week',
  'Scholarship Opportunities',
  'Health & Safety Guidelines',
  'Lost & Found Items',
  'Transportation Schedule Change',
  'Academic Excellence Awards',
  'Club Meeting Schedule',
  'PTA Meeting Announcement',
  'School Closure Notice',
  'Emergency Contact Update',
  'Fundraising Event Details',
  'Workshop Registration',
  'Guest Speaker Visit',
  'Academic Support Available',
  'Student Survey Request',
];

export const STAFF_MEMBERS = [
  'Principal Johnson',
  'Vice Principal Smith',
  'Academic Director Brown',
  'Student Services Wilson',
  'Ms. Anderson',
  'Mr. Thompson',
  'Dr. Martinez',
  'Mrs. Davis',
  'Coach Roberts',
  'Librarian Lee',
  'IT Administrator',
  'School Secretary',
  'Counselor Taylor',
  'Nurse Williams',
  'Facilities Manager',
];

export const NOTICE_CONTENTS = [
  'Please read this important information carefully and take appropriate action.',
  'We are pleased to announce this exciting opportunity for all students.',
  'Your participation is highly encouraged. Please see details below.',
  'This notice contains important updates to school policies and procedures.',
  'Registration is now open. Limited spaces available - first come, first served.',
  'All students and parents are invited to attend this important event.',
  'Please ensure you have all required documentation before the deadline.',
  'Contact the main office if you have any questions or concerns.',
  'This is a mandatory requirement for all students in affected programs.',
  'We appreciate your cooperation and understanding in this matter.',
];

export function createNotices(h: MockHelpers, count: number) {
  const notices = Array.from({ length: count }, (_, i) => {
    const baseDate = new Date('2025-12-31T12:00:00Z');
    const randomDaysBack = Math.floor(Math.random() * 180);
    const randomHoursOffset = Math.floor(Math.random() * 24);
    const randomMinutesOffset = Math.floor(Math.random() * 60);
    const noticeDate = new Date(baseDate);
    noticeDate.setDate(noticeDate.getDate() - randomDaysBack);
    noticeDate.setHours(randomHoursOffset, randomMinutesOffset);
    const label = NOTICE_LABELS[i % NOTICE_LABELS.length];
    const title =
      NOTICE_TITLES[i % NOTICE_TITLES.length] +
      (i >= NOTICE_TITLES.length ? ` ${Math.floor(i / NOTICE_TITLES.length) + 1}` : '');
    const staff = STAFF_MEMBERS[i % STAFF_MEMBERS.length];
    const content = NOTICE_CONTENTS[i % NOTICE_CONTENTS.length];
    return {
      id: i + 1,
      title,
      label_title: label.title,
      staff,
      colour: label.colour,
      label: label.id,
      contents: `<p>${content}</p><p>Notice ID: ${i + 1} | Date: ${noticeDate.toLocaleDateString()}</p>`,
      date: h.toISODate(noticeDate),
    };
  });
  return h.sortByDateDesc(notices, (n) => n.date);
}
