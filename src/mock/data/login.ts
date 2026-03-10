import type { MockHelpers } from '../helpers';

export const LOGIN_EMAILS = ['student2025@example.com', 'user2025@school.edu'];

export function createLoginPayload(h: MockHelpers) {
  return {
    clientIP: '127.0.0.1',
    email: h.getRandomItem(LOGIN_EMAILS),
    id: 999,
    lastAccessedTime: h.now.getTime(),
    meta: { code: 'STU', governmentID: 'GOV2025' },
    personUUID: 'uuid-2025-' + Math.random().toString(36).substring(2, 10),
    saml: [
      { autologin: false, label: 'SEQTA', method: 'POST', request: '', sigalg: '', signature: '', slo: false, url: '' },
    ],
    status: 'active',
    type: 'student',
    userCode: 'U2025',
    userDesc: 'Student',
    userName: 'student2025',
    displayName: 'Student Two Zero Two Five',
  };
}

export const PROFILE_PAYLOAD = {
  firstname: 'Alex',
  surname: 'Taylor',
  displayName: 'Alex Taylor',
  year: '12',
  house: 'Gryphon',
  email: 'alex.taylor@school.edu',
  lastUpdated: '2025-12-31T12:00:00.000Z',
};
