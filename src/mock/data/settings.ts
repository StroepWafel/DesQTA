import type { MockHelpers } from '../helpers';

export function createSettingsPayload(h: MockHelpers) {
  return {
    theme: 'default',
    messaging: { signaturesEnabled: true },
    timetable: { weekStartsOn: 'Monday' },
    updatedAt: h.now.toISOString(),
    'coneqt-s.page.goals': { value: 'enabled' },
    'coneqt-s.page.forums': { value: 'enabled' },
    'coneqt-s.forum.greeting': { title: 'Welcome', body: 'Welcome to the mock forums.' },
    'coneqt-s.page.folios': { value: 'enabled' },
    'coneqt-s.messages.students.enabled': { value: 'enabled' },
  };
}
