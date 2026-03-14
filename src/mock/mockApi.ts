import {
  now,
  getRandomItem,
  toISODate,
  genDates2025,
  sortByDateDesc,
  parseQsParams,
  type MockHelpers,
} from './helpers';
import { createLoginPayload, PROFILE_PAYLOAD } from './data/login';
import { createSettingsPayload } from './data/settings';
import { SUBJECTS_PAYLOAD, createCoursesPayload, PREFS_PAYLOAD } from './data/subjects';
import { createTimetableLessons } from './data/timetable';
import { createCourseContent } from './data/courseContent';
import {
  createUpcomingAssessments,
  createPastTasks,
  ASSESSMENT_DETAIL,
  createSubmissionsPayload,
} from './data/assessments';
import { createMessages, DIRECTORY_PEOPLE } from './data/messages';
import { NOTICE_LABELS, createNotices } from './data/notices';
import { PORTALS_LIST, createPortalDetail } from './data/portals';
import { REPORTS_PAYLOAD } from './data/reports';
import { DOCUMENTS_PAYLOAD } from './data/documents';
import { createHomeworkSummary } from './data/homework';
import { FOLIO_LIST, FOLIO_ADMIN_LIST, createFolioDetail } from './data/folio';
import { FORUMS_LIST, FORUM_DETAIL_MESSAGES } from './data/forums';
import { GOALS_YEARS, createGoalsPayload } from './data/goals';

const h: MockHelpers = {
  now,
  getRandomItem,
  toISODate,
  genDates2025,
  sortByDateDesc,
  parseQsParams,
};

export function mockApiResponse(url: string, body?: Record<string, unknown>): string {
  const qsParams = parseQsParams(url);

  // LOGIN
  if (url.includes('/seqta/student/login')) {
    return JSON.stringify({ payload: createLoginPayload(h) });
  }

  // HEARTBEAT - include mock notifications for the notification bell
  if (url.includes('/seqta/student/heartbeat')) {
    const mockNotifications = [
      {
        notificationID: 1,
        type: 'message',
        timestamp: now.toISOString(),
        message: { messageID: 1, title: 'Welcome to mock mode', subtitle: 'All data is simulated for demo purposes.' },
      },
      {
        notificationID: 2,
        type: 'coneqtassessments',
        timestamp: new Date(now.getTime() - 3600000).toISOString(),
        coneqtAssessments: {
          assessmentID: 201,
          metaclassID: 1,
          programmeID: 1,
          subjectCode: 'MATH',
          subtitle: 'Assessment 1',
          term: '2026',
          title: 'Assessment reminder',
        },
      },
      {
        notificationID: 3,
        type: 'report',
        timestamp: new Date(now.getTime() - 7200000).toISOString(),
        report: { title: 'New notice' },
      },
    ];
    return JSON.stringify({
      ok: true,
      timestamp: now.toISOString(),
      payload: { notifications: mockNotifications },
    });
  }

  // LOAD SETTINGS
  if (url.includes('/seqta/student/load/settings')) {
    return JSON.stringify({ payload: createSettingsPayload(h) });
  }

  // PROFILE
  if (url.includes('/seqta/student/load/profile')) {
    return JSON.stringify({ payload: PROFILE_PAYLOAD });
  }

  // PHOTO GET
  if (url.includes('/seqta/student/photo/get')) {
    return JSON.stringify('https://picsum.photos/seed/seqta-2025/128');
  }

  // SUBJECTS
  if (url.includes('/seqta/student/load/subjects')) {
    return JSON.stringify({ payload: SUBJECTS_PAYLOAD });
  }

  // COURSES
  if (url.includes('/seqta/student/load/courses')) {
    return JSON.stringify({ payload: createCoursesPayload(h) });
  }

  // PREFS
  if (url.includes('/seqta/student/load/prefs')) {
    return JSON.stringify({ payload: PREFS_PAYLOAD });
  }

  // TIMETABLE - read from/until from body (POST) or URL query params
  if (url.includes('/seqta/student/load/timetable')) {
    const b = body as Record<string, unknown>;
    const qFrom = (qsParams['from'] ?? b?.from) as string | undefined;
    const qUntil = (qsParams['until'] ?? b?.until) as string | undefined;
    const lessons = createTimetableLessons(h, qFrom, qUntil);
    let items = lessons;
    if (qFrom || qUntil) {
      items = lessons.filter((l) => (!qFrom || l.date >= qFrom) && (!qUntil || l.date <= qUntil));
    }
    if (!qFrom && !qUntil && items.length > 0) {
      const latestDate = items[items.length - 1].date;
      const startLatest = new Date(latestDate);
      startLatest.setUTCDate(startLatest.getUTCDate() - 7);
      const startStr = toISODate(startLatest);
      items = items.filter((l) => l.date >= startStr);
    }
    return JSON.stringify({ payload: { items } });
  }

  // COURSE CONTENT
  if (url.includes('/seqta/student/load/course/content')) {
    const classunit = qsParams['classunit'] || '101';
    const date = qsParams['date'] || toISODate(now);
    const content = createCourseContent(h, classunit, date);
    return JSON.stringify({ payload: { classunit: Number(classunit), date, content } });
  }

  // ASSESSMENTS - UPCOMING
  if (url.includes('/seqta/student/assessment/list/upcoming')) {
    return JSON.stringify({ payload: createUpcomingAssessments(h) });
  }

  // ASSESSMENTS - PAST
  if (url.includes('/seqta/student/assessment/list/past')) {
    return JSON.stringify({ payload: { tasks: createPastTasks(h) } });
  }

  // ASSESSMENT DETAIL
  if (url.includes('/seqta/student/assessment/get')) {
    const b = body as Record<string, unknown>;
    const id = b?.assessment ?? qsParams['id'] ?? qsParams['assessment'] ?? 9999;
    const assessmentId = Number(id);
    return JSON.stringify({
      payload: {
        id: assessmentId,
        ...ASSESSMENT_DETAIL,
        resources: [
          {
            name: 'Rubric.pdf',
            userfile: {
              mimetype: 'application/pdf',
              size: '102400',
              uuid: 'file-uuid-' + id,
            },
          },
        ],
      },
    });
  }

  // ASSESSMENT SUBMISSIONS GET
  if (url.includes('/seqta/student/assessment/submissions/get')) {
    const id = qsParams['id'] || '9999';
    return JSON.stringify({ payload: createSubmissionsPayload(Number(id)) });
  }

  // ASSESSMENT SUBMISSIONS SAVE
  if (url.includes('/seqta/student/assessment/submissions/save')) {
    return JSON.stringify({
      status: 'ok',
      payload: { linkId: 'link-2025-' + Math.random().toString(36).slice(2, 6) },
    });
  }

  // MESSAGING - LIST/THREAD
  if (url.includes('/seqta/student/load/message')) {
    if (url.includes('/people')) {
      return JSON.stringify({ payload: DIRECTORY_PEOPLE });
    }
    const messages = createMessages(h, 1000);
    return JSON.stringify({ payload: { messages } });
  }

  // MESSAGING - SAVE/SEND
  if (url.includes('/seqta/student/save/message')) {
    return JSON.stringify({
      status: 'ok',
      payload: { messageId: 'msg-2025-' + Math.random().toString(36).slice(2, 6), savedAt: now.toISOString() },
    });
  }

  // PORTALS - list or detail (body.id differentiates)
  if (url.includes('/seqta/student/load/portals')) {
    const b = body as Record<string, unknown>;
    const portalId = b?.id as string | undefined;
    if (portalId) {
      // Portal detail request
      const detail = createPortalDetail(h, portalId);
      return JSON.stringify({
        status: '200',
        payload: {
          ...detail,
          contents: `<p>Mock portal content for ${detail.title}.</p><p><a href="${detail.links[0].url}">${detail.links[0].label}</a></p><p><a href="${detail.links[1].url}">${detail.links[1].label}</a></p>`,
          is_power_portal: false,
          inherit_styles: false,
        },
      });
    }
    // Portals list - strip 'updated' for Portal interface, add status
    const list = sortByDateDesc(PORTALS_LIST, (x) => x.updated).map(({ updated, ...p }) => p);
    return JSON.stringify({ status: '200', payload: list });
  }

  // NOTICES
  if (url.includes('/seqta/student/load/notices')) {
    if ((body as Record<string, unknown>)?.mode === 'labels') {
      return JSON.stringify({ payload: NOTICE_LABELS });
    }
    const notices = createNotices(h, 500);
    return JSON.stringify({ payload: notices });
  }

  // REPORTS
  if (url.includes('/seqta/student/load/reports')) {
    return JSON.stringify({ status: '200', payload: REPORTS_PAYLOAD });
  }

  // DOCUMENTS
  if (url.includes('/seqta/student/load/documents')) {
    return JSON.stringify({ status: '200', payload: DOCUMENTS_PAYLOAD });
  }

  // HOMEWORK SUMMARY
  if (url.includes('/seqta/student/dashlet/summary/homework')) {
    return JSON.stringify({ payload: createHomeworkSummary(h) });
  }

  // DIRECTORY PEOPLE (standalone endpoint)
  if (url.includes('/seqta/student/load/message/people')) {
    return JSON.stringify({ payload: DIRECTORY_PEOPLE });
  }

  // FOLIO
  if (url.includes('/seqta/student/folio')) {
    const b = body as Record<string, unknown>;
    const mode = b?.mode;
    const folioId = (b?.id ?? 1) as number;
    if (mode === 'list') {
      return JSON.stringify({ status: '200', payload: { list: FOLIO_LIST, me: 'mock-user' } });
    }
    if (mode === 'adminList') {
      return JSON.stringify({ status: '200', payload: FOLIO_ADMIN_LIST });
    }
    if (mode === 'load' || mode === 'adminLoad' || mode === 'get' || mode === 'browse') {
      return JSON.stringify({ status: '200', payload: createFolioDetail(h, folioId) });
    }
    if (mode === 'adminSave') {
      return JSON.stringify({ status: '200', payload: { id: folioId } });
    }
    return JSON.stringify({ status: '200', payload: { list: [], me: 'mock-user' } });
  }

  // LOAD FORUMS
  if (url.includes('/seqta/student/load/forums')) {
    const b = body as Record<string, unknown>;
    const mode = b?.mode;
    if (mode === 'normal' || mode === 'list') {
      if (mode === 'normal') {
        return JSON.stringify({ status: '200', payload: { messages: FORUM_DETAIL_MESSAGES } });
      }
      return JSON.stringify({ status: '200', payload: { forums: FORUMS_LIST, me: 'mock-user' } });
    }
    return JSON.stringify({ status: '200', payload: { forums: [], me: 'mock-user' } });
  }

  // SAVE FORUMS
  if (url.includes('/seqta/student/save/forums')) {
    return JSON.stringify({ status: '200' });
  }

  // LOAD GOALS
  if (url.includes('/seqta/student/load/goals')) {
    const mode = (body as Record<string, unknown>)?.mode;
    if (mode === 'years') {
      return JSON.stringify({ status: '200', payload: GOALS_YEARS });
    }
    if (mode === 'goals') {
      const year = ((body as Record<string, unknown>)?.year as number) || 2025;
      return JSON.stringify({
        status: '200',
        payload: createGoalsPayload(h, year),
      });
    }
    if (mode === 'save') {
      return JSON.stringify({ status: '200' });
    }
    return JSON.stringify({ status: '200', payload: GOALS_YEARS });
  }

  // NOTIFICATION DISMISS
  if (url.includes('/seqta/student/notification/dismiss')) {
    return JSON.stringify({ status: 'ok' });
  }

  // ASSESSMENT ENGAGEMENT SAVE
  if (url.includes('/seqta/student/assessment/engagement/save')) {
    return JSON.stringify({ status: '200', payload: { id: 1 } });
  }

  // Default
  return JSON.stringify({
    message: 'Mocked by Sensitive Info Hider',
    random: Math.random(),
    now: now.toISOString(),
  });
}
