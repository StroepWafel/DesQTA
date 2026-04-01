import type { MockHelpers } from '../helpers';

export const GOALS_YEARS = ['2024', '2025', '2026'];

export const GOAL_ITEMS = [
  {
    id: 1,
    uid: 'uid-1',
    goals: 'Improve mathematical reasoning',
    support: 'Extra practice worksheets',
    action: 'Complete weekly exercises',
    notes: '',
    editable: true,
  },
  {
    id: 2,
    uid: 'uid-2',
    goals: 'Develop essay writing skills',
    support: 'Writing workshops',
    action: 'Submit draft for feedback',
    notes: '',
    editable: true,
  },
];

export function createGoalsPayload(h: MockHelpers, year: number) {
  return {
    goal: `Year ${year} Learning Goals`,
    student_notes: '<p>Mock student notes for the year.</p>',
    items: GOAL_ITEMS,
  };
}
