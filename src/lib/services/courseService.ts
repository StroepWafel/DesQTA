import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import type { Subject, Folder, CoursePayload, ParsedDocument } from '../../routes/courses/types';

export const courseService = {
  async loadSubjects(): Promise<Folder[]> {
    try {
      const folders = await invoke<Folder[]>('get_courses_subjects');
      return folders;
    } catch (e) {
      logger.error('courseService', 'loadSubjects', 'Failed to load subjects', { error: e });
      throw e;
    }
  },

  async loadCourseContent(subject: Subject): Promise<CoursePayload> {
    try {
      const payload = await invoke<CoursePayload>('get_course_content', {
        programme: subject.programme,
        metaclass: subject.metaclass,
      });
      return payload;
    } catch (e) {
      logger.error('courseService', 'loadCourseContent', 'Failed to load course content', {
        error: e,
        subject: subject.code,
      });
      throw e;
    }
  },

  parseDocument(payload: CoursePayload): { parsed: ParsedDocument | null; error: boolean } {
    if (!payload?.document) {
      return { parsed: null, error: false };
    }
    try {
      const parsed = JSON.parse(payload.document) as ParsedDocument;
      return { parsed, error: false };
    } catch (e) {
      logger.error('courseService', 'parseDocument', 'Failed to parse document JSON', {
        error: e,
      });
      return { parsed: null, error: true };
    }
  },
};
