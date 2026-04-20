import type { MockHelpers } from '../helpers';

export const FOLIO_LIST = [
  { id: 1, title: 'Mathematics Portfolio', updated: '2025-12-15T10:00:00Z', owner: 'mock-user' },
  { id: 2, title: 'Science Project', updated: '2025-12-10T14:30:00Z', owner: 'mock-user' },
  { id: 3, title: 'English Creative Writing', updated: '2025-12-05T09:00:00Z', owner: 'mock-user' },
];

/** For adminList mode - edit page expects array of { id, title, created, updated, published? } */
export const FOLIO_ADMIN_LIST = [
  { id: 1, title: 'Mathematics Portfolio', created: '2025-09-01T08:00:00Z', updated: '2025-12-15T10:00:00Z', published: null },
  { id: 2, title: 'Science Project', created: '2025-09-05T09:00:00Z', updated: '2025-12-10T14:30:00Z', published: '2025-12-10T14:30:00Z' },
  { id: 3, title: 'English Creative Writing', created: '2025-09-10T10:00:00Z', updated: '2025-12-05T09:00:00Z', published: null },
];

export function createFolioDetail(h: MockHelpers, id: number) {
  return {
    id,
    title: 'Mock Portfolio ' + id,
    contents: '<p>Mock portfolio content for demonstration.</p>',
    tags: ['math', '2025'],
    allow_comments: true,
    published: null,
    forum: null,
    created: '2025-09-01T08:00:00Z',
    updated: h.now.toISOString(),
    author: 'mock-user',
    files: [],
  };
}
