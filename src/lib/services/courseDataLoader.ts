import type { Subject } from '../../routes/courses/types';
import { useDataLoader } from '$lib/utils/useDataLoader';
import { courseService } from '$lib/services/courseService';
import { logger } from '../../utils/logger';
import type { CoursePayload, ParsedDocument } from '../../routes/courses/types';

export interface ParsedCoursePayload {
  payload: CoursePayload;
  parsedDocument: ParsedDocument | null;
  documentParseError: boolean;
}

const inFlightCourseLoads = new Map<string, Promise<ParsedCoursePayload | null>>();
const lastCompletedAt = new Map<string, number>();

function getCourseCacheKey(subject: Subject): string {
  return `course_${subject.programme}_${subject.metaclass}`;
}

export function shouldRefreshCourseContent(
  subject: Subject,
  ttlMs: number = 20 * 60 * 1000,
): boolean {
  const key = getCourseCacheKey(subject);
  if (inFlightCourseLoads.has(key)) return false;
  const last = lastCompletedAt.get(key);
  if (!last) return true;
  return Date.now() - last > ttlMs;
}

export async function loadParsedCourseContent(
  subject: Subject,
  options: {
    skipCache?: boolean;
    shouldSyncInBackground?: (data: ParsedCoursePayload) => boolean;
    updateOnBackgroundSync?: boolean;
    onDataLoaded?: (data: ParsedCoursePayload) => void | Promise<void>;
  } = {},
): Promise<ParsedCoursePayload | null> {
  const cacheKey = getCourseCacheKey(subject);

  if (!options.skipCache) {
    const existing = inFlightCourseLoads.get(cacheKey);
    if (existing) {
      return existing;
    }
  }

  const request = useDataLoader<ParsedCoursePayload>({
    cacheKey,
    ttlMinutes: 60,
    context: 'courses',
    functionName: options.skipCache ? 'refreshParsedCourseContent' : 'loadParsedCourseContent',
    skipCache: options.skipCache,
    fetcher: async () => {
      const payload = await courseService.loadCourseContent(subject);
      const { parsed, error } = courseService.parseDocument(payload);
      return {
        payload,
        parsedDocument: parsed,
        documentParseError: error,
      };
    },
    onDataLoaded: options.onDataLoaded,
    shouldSyncInBackground: options.shouldSyncInBackground,
    updateOnBackgroundSync: options.updateOnBackgroundSync,
  })
    .then((result) => {
      if (result) {
        lastCompletedAt.set(cacheKey, Date.now());
      }
      return result;
    })
    .catch((error) => {
      logger.error('courseDataLoader', 'loadParsedCourseContent', 'Failed to load parsed course content', {
        error,
        subject: subject.code,
      });
      throw error;
    })
    .finally(() => {
      inFlightCourseLoads.delete(cacheKey);
    });

  if (!options.skipCache) {
    inFlightCourseLoads.set(cacheKey, request);
  }

  return request;
}
