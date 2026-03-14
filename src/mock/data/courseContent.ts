import type { MockHelpers } from '../helpers';

export const TOPICS_BY_CLASS: Record<string, string[]> = {
  '101': ['Quadratic Equations', 'Trigonometric Identities', 'Sequences and Series', 'Probability'],
  '102': ['Atomic Structure', 'Chemical Reactions', 'Acids and Bases', 'Stoichiometry'],
  '201': ['Poetry Analysis', 'Persuasive Writing', 'Novel Study', 'Comparative Essays'],
};

export const RESOURCES_BY_CLASS: Record<string, { label: string; url: string }[]> = {
  '101': [
    { label: 'Worksheet: Quadratics', url: 'https://example.com/math/quadratics.pdf' },
    { label: 'Desmos Activity', url: 'https://www.desmos.com/' },
  ],
  '102': [
    { label: 'Lab Sheet: Reactions', url: 'https://example.com/sci/reactions.pdf' },
    { label: 'PhET Simulations', url: 'https://phet.colorado.edu/' },
  ],
  '201': [
    { label: 'Poetry Anthology', url: 'https://example.com/eng/poetry.pdf' },
    { label: 'Essay Planner', url: 'https://example.com/eng/planner.docx' },
  ],
};

export function createCourseContent(h: MockHelpers, classunit: string, date: string) {
  const classKey = ['101', '102', '201'].includes(classunit) ? classunit : '101';
  const topics = TOPICS_BY_CLASS[classKey];
  const resources = RESOURCES_BY_CLASS[classKey];
  const seed = (classunit + '-' + date).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const topic = topics[seed % topics.length];
  const homework = {
    description: `Complete exercises related to: ${topic}`,
    due: h.toISODate(
      new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 2))
    ),
  };
  return {
    overview: `Lesson focus: ${topic}`,
    objectives: [
      `Understand key concepts of ${topic}`,
      `Apply ${topic} to problem-solving`,
      `Review prior knowledge relevant to ${topic}`,
    ],
    activities: [
      `Warm-up: Quick recap on last lesson (5 min)`,
      `Main activity: Guided practice on ${topic} (30 min)`,
      `Independent work: Exercises on ${topic} (15 min)`,
    ],
    resources,
    homework,
    lastUpdated: new Date(date + 'T15:00:00Z').toISOString(),
  };
}
