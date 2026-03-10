import type { MockHelpers } from '../helpers';

export function createHomeworkSummary(h: MockHelpers) {
  const dates = h.genDates2025(7);
  let payload = dates.map((d, i) => ({
    id: i + 1,
    subject: h.getRandomItem(['Math', 'Science', 'English']),
    due: d,
    title: 'Homework ' + (i + 1),
    completed: i % 4 === 0,
  }));
  payload = h.sortByDateDesc(payload, (x) => x.due).slice(0, 4);
  return payload;
}
