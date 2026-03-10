import type { MockHelpers } from '../helpers';

/** Portal list matching the Portal interface expected by the Portals page */
export const PORTALS_LIST = [
  {
    id: 1,
    uuid: 'p1',
    label: 'Library',
    url: 'https://example.com/library',
    priority: 1,
    icon: 'colour-blue',
    is_power_portal: false,
    inherit_styles: false,
    updated: '2025-12-20T12:00:00Z',
  },
  {
    id: 2,
    uuid: 'p2',
    label: 'Careers',
    url: 'https://example.com/careers',
    priority: 2,
    icon: 'colour-green',
    is_power_portal: false,
    inherit_styles: false,
    updated: '2025-11-05T09:00:00Z',
  },
  {
    id: 3,
    uuid: 'p3',
    label: 'Wellbeing',
    url: 'https://example.com/wellbeing',
    priority: 3,
    icon: 'colour-purple',
    is_power_portal: false,
    inherit_styles: false,
    updated: '2025-10-01T15:30:00Z',
  },
];

export function createPortalDetail(h: MockHelpers, id: string) {
  const title = id === 'p2' ? 'Careers' : id === 'p3' ? 'Wellbeing' : 'Library';
  return {
    id,
    title,
    links: [
      { label: 'External Link 1', url: 'https://example.com/1' },
      { label: 'External Link 2', url: 'https://example.com/2' },
    ],
    updated: h.now.toISOString(),
  };
}
