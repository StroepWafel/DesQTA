import { seqtaFetch } from '../../utils/netUtil';

export interface SeqtaMentionItem {
  id: string;
  type:
    | 'assignment'
    | 'class'
    | 'subject'
    | 'assessment'
    | 'timetable'
    | 'timetable_slot'
    | 'notice'
    | 'file'
    | 'homework'
    | 'teacher'
    | 'lesson_content';
  title: string;
  subtitle: string;
  data: any;
  lastUpdated?: string;
}

export interface SeqtaAssignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'overdue';
  description?: string;
}

export interface SeqtaClass {
  id: string;
  name: string;
  subject: string;
  year: number;
  teacher: string;
  nextClass?: string;
  room?: string;
}

export interface SeqtaSubject {
  id: string;
  name: string;
  code: string;
  teacher: string;
  assignmentCount: number;
  nextClass?: string;
}

export interface SeqtaAssessment {
  id: string;
  title: string;
  subject: string;
  date: string;
  type: 'test' | 'exam' | 'quiz' | 'presentation';
  weight?: number;
}

export interface SeqtaTimetable {
  id: string;
  date: string;
  classes: Array<{
    subject: string;
    time: string;
    room: string;
    teacher: string;
  }>;
}

export class SeqtaMentionsService {
  private static cache = new Map<string, { data: SeqtaMentionItem[]; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static teacherCache = new Map<string, string>(); // key: programme-metaclass or code

  private static async getTeacherFromTimetable(
    programme: number | string | undefined,
    metaclass: number | string | undefined,
    code: string | undefined,
  ): Promise<string | null> {
    try {
      const key = `${programme ?? ''}-${metaclass ?? ''}-${code ?? ''}`;
      const cached = this.teacherCache.get(key);
      if (cached) return cached;

      const studentId = 69; // TODO: dynamic in production
      const steps = 6; // go back in ~2-month intervals up to ~1 year
      for (let i = 0; i < steps; i++) {
        const dt = new Date();
        dt.setMonth(dt.getMonth() - i * 2);
        const dayStr = dt.toISOString().split('T')[0];
        const res = await seqtaFetch('/seqta/student/load/timetable?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { from: dayStr, until: dayStr, student: studentId },
        });
        const payload = typeof res === 'string' ? JSON.parse(res).payload : (res as any).payload;
        const items: any[] = payload?.items || [];
        const match = items.find((l: any) => {
          const metaOk = metaclass != null && Number(l.metaID) === Number(metaclass);
          const progOk = programme != null && Number(l.programmeID) === Number(programme);
          const codeOk =
            code && (l.code || '').toString().toLowerCase() === code.toString().toLowerCase();
          return (metaOk && progOk) || codeOk;
        });
        if (match) {
          const teacher = match.staff || match.teacher || null;
          if (teacher) {
            this.teacherCache.set(key, teacher);
            return teacher;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Compute a weekly (Mon–Fri) schedule for a class by scanning historical timetables
   * in 2-month intervals and deduping time slots by day. Returns an array of lesson
   * entries with date/from/until/room similar to fetchClassById output, suitable for
   * grouping by weekday in the UI.
   */
  static async getWeeklyScheduleForClass(
    programme: number | string | undefined,
    metaclass: number | string | undefined,
    code: string | undefined,
  ): Promise<Array<{ date: string; from: string; until: string; room?: string }>> {
    try {
      const studentId = 69; // TODO: dynamic in production
      const steps = 6; // go back by ~2 months up to ~1 year
      const collected: Array<{ date: string; from: string; until: string; room?: string }> = [];

      for (let i = 0; i < steps; i++) {
        const anchor = new Date();
        anchor.setMonth(anchor.getMonth() - i * 2);

        // Find Monday of the anchor week
        const day = anchor.getDay(); // 0=Sun..6=Sat
        const monday = new Date(anchor);
        const deltaToMonday = day === 0 ? -6 : 1 - day; // shift to Monday
        monday.setDate(anchor.getDate() + deltaToMonday);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const from = monday.toISOString().split('T')[0];
        const until = friday.toISOString().split('T')[0];

        const res = await seqtaFetch('/seqta/student/load/timetable?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { from, until, student: studentId },
        });
        const payload = typeof res === 'string' ? JSON.parse(res).payload : (res as any).payload;
        const items: any[] = payload?.items || [];
        const matches = items.filter((l: any) => {
          const metaOk = metaclass != null && Number(l.metaID) === Number(metaclass);
          const progOk = programme != null && Number(l.programmeID) === Number(programme);
          const codeOk =
            code &&
            (l.code || l.subject || '').toString().toLowerCase() === code.toString().toLowerCase();
          return (metaOk && progOk) || codeOk;
        });

        for (const m of matches) {
          const date = (m.date || (m.from || '').split('T')[0]) as string;
          const fromT = (m.from || '').substring(0, 5) || (m.from || '').substring(11, 16);
          const untilT = (m.until || '').substring(0, 5) || (m.until || '').substring(11, 16);
          collected.push({
            date,
            from: fromT,
            until: untilT,
            room: m.room || m.location || undefined,
          });
        }
      }

      // Deduplicate by weekday and time range
      const seen = new Set<string>();
      const deduped: Array<{ date: string; from: string; until: string; room?: string }> = [];
      for (const entry of collected) {
        const d = new Date(entry.date);
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        if (weekday === 'Sat' || weekday === 'Sun') continue; // ignore weekends
        const sig = `${weekday}-${entry.from}-${entry.until}-${entry.room || ''}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        deduped.push(entry);
      }

      return deduped;
    } catch (e) {
      console.warn('getWeeklyScheduleForClass failed:', e);
      return [];
    }
  }

  /**
   * Search for SEQTA elements that can be mentioned
   */
  static async searchMentions(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    const cacheKey = `search_${query}_${categoryFilter || 'all'}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Fetch data from multiple SEQTA endpoints in parallel
      const [assignments, classes, subjects, timetables, timetableSlots, notices, homework, staff] =
        await Promise.all([
          this.fetchAssignments(query, categoryFilter),
          this.fetchClasses(query, categoryFilter),
          this.fetchSubjects(query, categoryFilter),
          this.fetchTimetables(query, categoryFilter),
          this.fetchTimetableSlots(query, categoryFilter),
          this.fetchNotices(query, categoryFilter),
          this.fetchHomework(query, categoryFilter),
          this.fetchStaff(query, categoryFilter),
        ]);

      const allItems = [
        ...assignments,
        ...classes,
        ...subjects,
        ...timetables,
        ...timetableSlots,
        ...notices,
        ...homework,
        ...staff,
      ];

      // Filter by query if provided
      const filteredItems = query.trim()
        ? allItems.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
              item.type.toLowerCase().includes(query.toLowerCase()),
          )
        : allItems;

      // Sort by relevance and limit results
      const sortedItems = filteredItems
        .sort((a, b) => {
          if (query.trim()) {
            const queryLower = query.toLowerCase();

            // Prioritize exact matches
            const aExact = a.title.toLowerCase() === queryLower;
            const bExact = b.title.toLowerCase() === queryLower;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            // Then prioritize matches at the beginning of title
            const aStartsWithTitle = a.title.toLowerCase().startsWith(queryLower);
            const bStartsWithTitle = b.title.toLowerCase().startsWith(queryLower);
            if (aStartsWithTitle && !bStartsWithTitle) return -1;
            if (!aStartsWithTitle && bStartsWithTitle) return 1;

            // Then prioritize matches at the beginning of words in title
            const aWordStart = new RegExp(`\\b${queryLower}`, 'i').test(a.title);
            const bWordStart = new RegExp(`\\b${queryLower}`, 'i').test(b.title);
            if (aWordStart && !bWordStart) return -1;
            if (!aWordStart && bWordStart) return 1;
          }

          // Finally by type priority
          const typePriority = {
            assignment: 1,
            assessment: 1, // Same as assignment
            homework: 2.5,
            class: 3,
            subject: 4,
            timetable: 5,
            timetable_slot: 6,
            notice: 7,
            teacher: 8,
            file: 9,
          };
          return (
            (typePriority[a.type as keyof typeof typePriority] || 99) -
            (typePriority[b.type as keyof typeof typePriority] || 99)
          );
        })
        .slice(0, categoryFilter ? 100 : 50); // More results when filtered by category

      // Cache the results
      this.cache.set(cacheKey, { data: sortedItems, timestamp: Date.now() });

      return sortedItems;
    } catch (error) {
      console.error('Error fetching SEQTA mentions:', error);
      return [];
    }
  }

  /**
   * Get updated data for a specific mention
   */
  static async updateMentionData(
    mentionId: string,
    mentionType: string,
    meta?: any,
  ): Promise<SeqtaMentionItem | null> {
    // Normalize id for classes (program and metaclass) if save/load removed prefix
    if (mentionType === 'class') {
      mentionId = mentionId.replace(/^class:/, '');
    }
    try {
      switch (mentionType) {
        case 'assignment':
        case 'assessment':
          return await this.fetchAssignmentById(
            (meta?.lookup?.id || mentionId)
              .toString()
              .replace('assessment-', '')
              .replace('assignment-', ''),
            meta,
          );
        case 'class':
          // Prefer precise programme-metaclass from meta.lookup
          const classId =
            meta?.lookup?.programme && meta?.lookup?.metaclass
              ? `${meta.lookup.programme}-${meta.lookup.metaclass}`
              : mentionId;
          return await this.fetchClassById(classId);
        case 'subject':
          return await this.fetchSubjectById(meta?.lookup?.code || mentionId);
        case 'timetable_slot':
          return await this.fetchTimetableSlotById(mentionId, meta);
        case 'timetable':
          return await this.fetchTimetableById(mentionId, meta);
        case 'notice':
          return await this.fetchNoticeById(mentionId, meta);
        case 'homework':
          return await this.fetchHomeworkById(mentionId, meta);
        case 'teacher':
          return await this.fetchTeacherById(mentionId, meta);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error updating ${mentionType} data:`, error);
      return null;
    }
  }

  private static async fetchAssignments(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch upcoming assessments (assignments) from SEQTA
      const studentId = 69; // This should be dynamic in production
      const res = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId },
      });

      const assignments = JSON.parse(res).payload as any[];

      const limit = categoryFilter === 'assignment' || categoryFilter === 'assessment' ? 100 : 10;

      return assignments
        .filter(
          (a) =>
            !query ||
            a.title?.toLowerCase().includes(query.toLowerCase()) ||
            a.subject?.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, limit)
        .map((assignment) => ({
          id: `assignment-${assignment.id}`,
          type: 'assignment' as const,
          title: assignment.title || 'Assignment',
          subtitle: `${assignment.subject || assignment.code} • Due: ${this.formatDate(assignment.due)}`,
          data: {
            id: assignment.id,
            title: assignment.title,
            subject: assignment.subject || assignment.code,
            dueDate: assignment.due,
            status: new Date(assignment.due) > new Date() ? 'pending' : 'overdue',
            description: assignment.description,
          },
          lastUpdated: new Date().toISOString(),
        }));
    } catch (error) {
      console.warn('Failed to fetch assignments:', error);
      return [];
    }
  }

  private static async fetchClasses(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch subjects (classes) from SEQTA
      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });

      const classesData = JSON.parse(res).payload;
      const allSubjects = classesData.flatMap((folder: any) => folder.subjects);

      const limit = categoryFilter === 'class' ? 100 : 10;

      const filtered = allSubjects
        .filter(
          (subject: any) =>
            !query ||
            subject.title?.toLowerCase().includes(query.toLowerCase()) ||
            subject.code?.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, limit);

      const enriched = await Promise.all(
        filtered.map(async (cls: any) => {
          const fallbackTeacher = cls.teacher || 'Teacher TBA';
          const teacher =
            (await this.getTeacherFromTimetable(cls.programme, cls.metaclass, cls.code)) ||
            fallbackTeacher;
          return {
            id: `${cls.programme}-${cls.metaclass}`,
            type: 'class' as const,
            title: cls.title || cls.code,
            subtitle: `${cls.code} • ${teacher}`,
            data: {
              id: `${cls.programme}-${cls.metaclass}`,
              name: cls.title,
              subject: cls.code,
              code: cls.code,
              year: cls.year || 10,
              teacher,
              programme: cls.programme,
              metaclass: cls.metaclass,
            },
            lastUpdated: new Date().toISOString(),
          } as SeqtaMentionItem;
        }),
      );

      return enriched;
    } catch (error) {
      console.warn('Failed to fetch classes:', error);
      return [];
    }
  }

  private static async fetchSubjects(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch subjects from SEQTA - same as classes but with different presentation
      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });

      const classesData = JSON.parse(res).payload;
      const allSubjects = classesData.flatMap((folder: any) => folder.subjects);

      const limit = categoryFilter === 'subject' ? 100 : 10;

      return allSubjects
        .filter(
          (subject: any) =>
            !query ||
            subject.title?.toLowerCase().includes(query.toLowerCase()) ||
            subject.code?.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, limit)
        .map((subject: any) => ({
          id: `subject-${subject.programme}-${subject.metaclass}`,
          type: 'subject' as const,
          title: subject.title || subject.code,
          subtitle: `${subject.code} • ${subject.teacher || 'Teacher TBA'} • Active`,
          data: {
            id: `subject-${subject.programme}-${subject.metaclass}`,
            name: subject.title,
            code: subject.code,
            teacher: subject.teacher || 'Teacher TBA',
            assignmentCount: 0, // Would need additional API call
            programme: subject.programme,
            metaclass: subject.metaclass,
          },
          lastUpdated: new Date().toISOString(),
        }));
    } catch (error) {
      console.warn('Failed to fetch subjects:', error);
      return [];
    }
  }

  private static async fetchTimetableSlots(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch upcoming timetable slots (next 14 days)
      const studentId = 69;
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 14);
      const from = start.toISOString().split('T')[0];
      const until = end.toISOString().split('T')[0];

      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from, until, student: studentId },
      });

      const timetableData = JSON.parse(res).payload;
      const lessons = timetableData.items || [];

      const limit = categoryFilter === 'timetable_slot' ? 100 : 20;

      // Convert lessons to individual slot mentions
      return lessons
        .filter((lesson: any) => {
          if (query.trim()) {
            const queryLower = query.toLowerCase();
            return (
              (lesson.code || '').toLowerCase().includes(queryLower) ||
              (lesson.title || '').toLowerCase().includes(queryLower) ||
              (lesson.description || '').toLowerCase().includes(queryLower)
            );
          }
          return true;
        })
        .slice(0, limit)
        .map((lesson: any) => {
          const date = lesson.date || (lesson.from || '').split('T')[0];
          const fromTime =
            (lesson.from || '').substring(0, 5) || (lesson.from || '').substring(11, 16);
          const untilTime =
            (lesson.until || '').substring(0, 5) || (lesson.until || '').substring(11, 16);
          const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

          return {
            id: `timetable-slot-${lesson.id || `${date}-${fromTime}`}`,
            type: 'timetable_slot' as const,
            title: `${lesson.code || lesson.title || 'Lesson'} ${fromTime}-${untilTime}`,
            subtitle: `${dayName} ${date} • Room ${lesson.room || 'TBA'}`,
            data: {
              id: lesson.id,
              date,
              from: fromTime,
              until: untilTime,
              code: lesson.code,
              title: lesson.title || lesson.description,
              room: lesson.room,
              teacher: lesson.staff || lesson.teacher,
              programme: lesson.programmeID,
              metaclass: lesson.metaID,
            },
            lastUpdated: new Date().toISOString(),
          };
        });
    } catch (error) {
      console.warn('Failed to fetch timetable slots:', error);
      return [];
    }
  }

  private static async fetchNotices(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const res = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { date: dateStr },
      });

      const notices = JSON.parse(res).payload || [];

      const limit = categoryFilter === 'notice' ? 100 : 20;

      return notices
        .filter((notice: any) => {
          if (query.trim()) {
            const queryLower = query.toLowerCase();
            return (
              (notice.title || '').toLowerCase().includes(queryLower) ||
              (notice.label_title || '').toLowerCase().includes(queryLower) ||
              (notice.staff || '').toLowerCase().includes(queryLower)
            );
          }
          return true;
        })
        .slice(0, limit)
        .map((notice: any, index: number) => ({
          id: `notice-${notice.id || index}`,
          type: 'notice' as const,
          title: notice.title || 'Notice',
          subtitle: `${notice.label_title || 'Notice'} • ${notice.staff || 'Staff'}`,
          data: {
            id: notice.id || index,
            title: notice.title,
            subtitle: notice.label_title,
            author: notice.staff,
            color: notice.colour,
            labelId: notice.label,
            content: notice.contents,
            date: dateStr,
          },
          lastUpdated: new Date().toISOString(),
        }));
    } catch (error) {
      console.warn('Failed to fetch notices:', error);
      return [];
    }
  }

  private static async fetchHomework(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      const res = await seqtaFetch('/seqta/student/dashlet/summary/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
        params: { majhvjju: '' },
      });

      const homeworkData = JSON.parse(res);
      const homeworkItems = homeworkData.payload || [];

      const limit = categoryFilter === 'homework' ? 100 : 20;

      return homeworkItems
        .filter((homework: any) => {
          if (query.trim()) {
            const queryLower = query.toLowerCase();
            return (
              (homework.title || '').toLowerCase().includes(queryLower) ||
              (homework.items || []).some((item: string) => item.toLowerCase().includes(queryLower))
            );
          }
          return true;
        })
        .slice(0, limit)
        .map((homework: any) => ({
          id: `homework-${homework.id || homework.meta}`,
          type: 'homework' as const,
          title: homework.title || 'Homework',
          subtitle: `${homework.items?.length || 0} ${homework.items?.length === 1 ? 'item' : 'items'}`,
          data: {
            id: homework.id,
            meta: homework.meta,
            title: homework.title,
            items: homework.items || [],
          },
          lastUpdated: new Date().toISOString(),
        }));
    } catch (error) {
      console.warn('Failed to fetch homework:', error);
      return [];
    }
  }

  private static async fetchStaff(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      const res = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'staff' },
      });

      const staffData = typeof res === 'string' ? JSON.parse(res) : res;
      const staff = staffData.payload || [];

      const limit = categoryFilter === 'teacher' ? 100 : 20;

      return staff
        .filter((teacher: any) => {
          if (query.trim()) {
            const queryLower = query.toLowerCase();
            return (
              (teacher.xx_display || '').toLowerCase().includes(queryLower) ||
              (teacher.firstname || '').toLowerCase().includes(queryLower) ||
              (teacher.surname || '').toLowerCase().includes(queryLower)
            );
          }
          return true;
        })
        .slice(0, limit)
        .map((teacher: any) => ({
          id: `teacher-${teacher.id}`,
          type: 'teacher' as const,
          title: teacher.xx_display || `${teacher.firstname} ${teacher.surname}`,
          subtitle: 'Staff',
          data: {
            id: teacher.id,
            firstname: teacher.firstname,
            surname: teacher.surname,
            displayName: teacher.xx_display,
          },
          lastUpdated: new Date().toISOString(),
        }));
    } catch (error) {
      console.warn('Failed to fetch staff:', error);
      return [];
    }
  }

  /**
   * Fetch lesson content for a specific class/subject
   */
  static async fetchLessonContent(
    programme: number | string,
    metaclass: number | string,
    lessonIndex?: number,
    termIndex?: number,
  ): Promise<any> {
    try {
      const res = await seqtaFetch('/seqta/student/load/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          programme: programme.toString(),
          metaclass: metaclass.toString(),
        },
      });

      const data = JSON.parse(res);
      const coursePayload = data.payload;

      if (!coursePayload?.w) return null;

      // If lessonIndex and termIndex provided, return specific lesson
      if (lessonIndex !== undefined && termIndex !== undefined) {
        return coursePayload.w[termIndex]?.[lessonIndex] || null;
      }

      // Otherwise return all lessons
      return coursePayload.w;
    } catch (error) {
      console.warn('Failed to fetch lesson content:', error);
      return null;
    }
  }

  /**
   * Smart suggestions based on note content context
   */
  static async searchMentionsWithContext(
    query: string = '',
    noteContent: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    const results = await this.searchMentions(query, categoryFilter);

    if (!noteContent.trim()) {
      return results;
    }

    // Analyze note content for context clues
    const contentLower = noteContent.toLowerCase();
    const contextKeywords: Record<string, string[]> = {
      homework: ['homework', 'hw', 'assignment', 'task'],
      assessment: ['assessment', 'test', 'exam', 'quiz', 'due'],
      class: ['class', 'lesson', 'period', 'subject'],
      teacher: ['teacher', 'mr', 'mrs', 'ms', 'dr', 'professor'],
      notice: ['notice', 'announcement', 'news', 'update'],
      timetable: ['timetable', 'schedule', 'time', 'period'],
    };

    // Boost scores based on context
    const scoredResults = results.map((item) => {
      let score = 0;

      // Check if query matches context keywords
      for (const [type, keywords] of Object.entries(contextKeywords)) {
        if (item.type === type) {
          const hasKeyword = keywords.some((kw) => contentLower.includes(kw));
          if (hasKeyword) score += 10;
        }
      }

      // Boost if mention type appears in content
      if (contentLower.includes(item.type)) score += 5;

      // Boost if title/subtitle appears in content
      if (contentLower.includes(item.title.toLowerCase())) score += 15;
      if (contentLower.includes(item.subtitle.toLowerCase())) score += 10;

      return { item, score };
    });

    // Sort by score and return
    return scoredResults.sort((a, b) => b.score - a.score).map(({ item }) => item);
  }

  private static async fetchTimetables(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch today's timetable from SEQTA
      const studentId = 69; // This should be dynamic in production
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from: dateStr, until: dateStr, student: studentId },
      });

      const timetableData = JSON.parse(res).payload;
      const lessons = timetableData.items || [];

      // Only return if there are lessons and query matches
      if (
        lessons.length > 0 &&
        (!query ||
          'today'.includes(query.toLowerCase()) ||
          'schedule'.includes(query.toLowerCase()) ||
          'timetable'.includes(query.toLowerCase()))
      ) {
        return [
          {
            id: `timetable-${dateStr}`,
            type: 'timetable' as const,
            title: `Today's Schedule`,
            subtitle: `${lessons.length} classes scheduled`,
            data: {
              id: `timetable-${dateStr}`,
              date: dateStr,
              classes: lessons.map((lesson: any) => ({
                subject: lesson.title || lesson.code,
                time: `${lesson.from.substring(0, 5)} - ${lesson.until.substring(0, 5)}`,
                room: lesson.room || 'TBA',
                teacher: lesson.teacher || 'TBA',
              })),
            },
            lastUpdated: new Date().toISOString(),
          },
        ];
      }

      return [];
    } catch (error) {
      console.warn('Failed to fetch timetables, using mock data');
      return [];
    }
  }

  // Individual fetch methods for updates - simplified for now
  private static async fetchAssignmentById(
    id: string,
    meta?: any,
  ): Promise<SeqtaMentionItem | null> {
    try {
      const studentId = 69;

      // Clean the ID - remove 'assessment-' prefix if present
      const cleanId = id.toString().replace('assessment-', '').replace('assignment-', '');

      // Check upcoming first
      const upcomingRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId },
      });
      const upcoming = JSON.parse(upcomingRes).payload as any[];
      let found = upcoming.find(
        (a: any) => a.id?.toString() === cleanId || `assessment-${a.id}` === id,
      );

      // If not found in upcoming, try past assessments
      if (!found) {
        // Try to get programme and metaclass from meta or stored data
        const programme = meta?.data?.programme || meta?.lookup?.programme;
        const metaclass = meta?.data?.metaclass || meta?.lookup?.metaclass;

        if (programme && metaclass) {
          // Check past assessments for this specific subject
          try {
            const pastRes = await seqtaFetch('/seqta/student/assessment/list/past?', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: {
                programme: programme,
                metaclass: metaclass,
                student: studentId,
              },
            });
            const pastData = JSON.parse(pastRes).payload;
            const pastTasks = pastData.tasks || [];
            found = pastTasks.find(
              (a: any) => a.id?.toString() === cleanId || `assessment-${a.id}` === id,
            );
          } catch (e) {
            console.warn('Failed to fetch past assessments:', e);
          }
        }

        // If still not found and we have metaclass, try the detail endpoint
        if (!found && metaclass) {
          try {
            const detailRes = await seqtaFetch('/seqta/student/assessment/get?', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: {
                assessment: parseInt(cleanId),
                student: studentId,
                metaclass: metaclass,
              },
            });
            const detailData = JSON.parse(detailRes).payload;
            if (detailData && detailData.id) {
              found = detailData;
            }
          } catch (e) {
            console.warn('Failed to fetch assessment detail:', e);
          }
        }
      }

      if (found) {
        return {
          id: `assessment-${found.id}`,
          type: 'assessment',
          title: found.title || 'Assessment',
          subtitle: `${found.subject || found.code || ''} • ${this.formatDate(found.due || found.dueDate)}`,
          data: {
            id: found.id,
            title: found.title,
            subject: found.subject || found.code,
            code: found.code,
            due: found.due || found.dueDate,
            dueDate: found.due || found.dueDate,
            status:
              found.due || found.dueDate
                ? new Date(found.due || found.dueDate) > new Date()
                  ? 'pending'
                  : 'overdue'
                : found.status || 'unknown',
            programme: found.programme || found.programmeID,
            metaclass: found.metaclass || found.metaID,
          },
          lastUpdated: new Date().toISOString(),
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching assignment by ID:', error);
      return null;
    }
  }

  private static async fetchClassById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // id format: programme-metaclass
      const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const folders = JSON.parse(classesRes).payload as any[];
      const all = folders.flatMap((f: any) => f.subjects);
      const match = all.find((s: any) => `${s.programme}-${s.metaclass}` === id);
      if (!match) return null;
      const code = match.code;
      const teacherResolved = await this.getTeacherFromTimetable(
        match.programme,
        match.metaclass,
        code,
      );
      const teacher = teacherResolved || match.teacher || 'Teacher TBA';

      // Pull next 14 days of timetable entries for this code
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 14);
      const from = start.toISOString().split('T')[0];
      const until = end.toISOString().split('T')[0];
      const ttRes = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from, until, student: 69 },
      });
      const timetable = JSON.parse(ttRes).payload;
      const items = (timetable.items || []).filter((l: any) => {
        const metaOk = Number(l.metaID) === Number(match.metaclass);
        const progOk = Number(l.programmeID) === Number(match.programme);
        const codeOk = (l.code || l.subject || '').toLowerCase() === code.toLowerCase();
        return (metaOk && progOk) || codeOk;
      });
      const lessons = items.map((l: any) => ({
        date: l.date || (l.from || '').split('T')[0],
        from: (l.from || '').substring(0, 5) || (l.from || '').substring(11, 16),
        until: (l.until || '').substring(0, 5) || (l.until || '').substring(11, 16),
        room: l.room || 'TBA',
        teacher: l.staff || l.teacher || teacher,
      }));

      return {
        id,
        type: 'class',
        title: match.title || code,
        subtitle: `${code} • ${teacher}`,
        data: {
          id,
          name: match.title,
          code,
          teacher,
          programme: match.programme,
          metaclass: match.metaclass,
          lessons,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private static async fetchSubjectById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // id pattern may be subject-<programme>-<metaclass> or plain code; try both
      const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const folders = JSON.parse(classesRes).payload as any[];
      const all = folders.flatMap((f: any) => f.subjects);
      const match = all.find(
        (s: any) => `subject-${s.programme}-${s.metaclass}` === id || s.code === id,
      );
      if (!match) return null;
      const teacherResolved = await this.getTeacherFromTimetable(
        match.programme,
        match.metaclass,
        match.code,
      );
      const teacher = teacherResolved || match.teacher || 'Teacher TBA';
      return {
        id: `subject-${match.programme}-${match.metaclass}`,
        type: 'subject',
        title: match.title || match.code,
        subtitle: `${match.code} • ${teacher}`,
        data: {
          code: match.code,
          teacher,
          programme: match.programme,
          metaclass: match.metaclass,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private static async fetchAssessmentById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // For now, return updated mock data - in production this would fetch specific assignment
      const mockData = this.getMockData('').find(
        (item) => item.id === id || item.type === 'assessment',
      );
      if (mockData) {
        return {
          ...mockData,
          lastUpdated: new Date().toISOString(),
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private static async fetchTimetableSlotById(
    id: string,
    meta?: any,
  ): Promise<SeqtaMentionItem | null> {
    try {
      // Extract date and time from ID or meta
      // ID format: timetable-slot-{lessonId} or timetable-slot-{date}-{time}
      let date = meta?.data?.date;
      let from = meta?.data?.from;
      let lessonId = meta?.data?.id;

      // Parse ID if meta doesn't have data
      if (!date || !from) {
        const idParts = id.replace('timetable-slot-', '').split('-');
        if (idParts.length >= 2) {
          // Format: timetable-slot-YYYY-MM-DD-HH-MM
          date = `${idParts[0]}-${idParts[1]}-${idParts[2]}`;
          from = `${idParts[3]}:${idParts[4]}`;
        } else {
          // Try to extract lesson ID
          lessonId = idParts[0];
        }
      }

      if (!date && !lessonId) return null;

      const studentId = 69;

      // If we have a lesson ID, try to find it in a wider date range
      const startDate = date ? date : new Date().toISOString().split('T')[0];
      const endDate = date
        ? date
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from: startDate, until: endDate, student: studentId },
      });

      const timetableData = JSON.parse(res).payload;
      const lessons = timetableData.items || [];

      // Find the specific lesson
      const lesson = lessons.find((l: any) => {
        if (lessonId && l.id?.toString() === lessonId.toString()) {
          return true;
        }
        const lessonDate = l.date || (l.from || '').split('T')[0];
        const lessonFrom = (l.from || '').substring(0, 5) || (l.from || '').substring(11, 16);
        return lessonDate === date && (!from || lessonFrom === from);
      });

      if (!lesson) return null;

      const lessonDate = lesson.date || (lesson.from || '').split('T')[0];
      const fromTime = (lesson.from || '').substring(0, 5) || (lesson.from || '').substring(11, 16);
      const untilTime =
        (lesson.until || '').substring(0, 5) || (lesson.until || '').substring(11, 16);
      const dayName = new Date(lessonDate).toLocaleDateString('en-US', { weekday: 'long' });

      // Fetch subjects to match code to subject name
      let subjectName = lesson.code || lesson.title || 'Lesson';
      try {
        const subjectsRes = await seqtaFetch('/seqta/student/load/subjects?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {},
        });
        const classesData = JSON.parse(subjectsRes).payload;
        const allSubjects = classesData.flatMap((folder: any) => folder.subjects);
        const matchingSubject = allSubjects.find(
          (s: any) =>
            s.code === lesson.code &&
            s.programme === lesson.programmeID &&
            s.metaclass === lesson.metaID,
        );
        if (matchingSubject) {
          subjectName = matchingSubject.title || matchingSubject.code || subjectName;
        }
      } catch (e) {
        // Fallback to code if subject fetch fails
        console.warn('Failed to fetch subject name:', e);
      }

      // Convert to 12-hour format
      const format12Hour = (time24: string): string => {
        if (!time24 || !time24.includes(':')) return time24;
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
      };

      const fromTime12 = format12Hour(fromTime);
      const untilTime12 = format12Hour(untilTime);

      return {
        id: `timetable-slot-${lesson.id || `${lessonDate}-${fromTime.replace(':', '-')}`}`,
        type: 'timetable_slot',
        title: `${subjectName} ${fromTime12}-${untilTime12}`,
        subtitle: `${dayName} ${lessonDate} • Room ${lesson.room || 'TBA'}`,
        data: {
          id: lesson.id,
          date: lessonDate,
          from: fromTime,
          until: untilTime,
          from12: fromTime12,
          until12: untilTime12,
          code: lesson.code,
          subjectName,
          title: lesson.title || lesson.description,
          room: lesson.room,
          teacher: lesson.staff || lesson.teacher,
          programme: lesson.programmeID,
          metaclass: lesson.metaID,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Failed to fetch timetable slot:', error);
      return null;
    }
  }

  private static async fetchNoticeById(id: string, meta?: any): Promise<SeqtaMentionItem | null> {
    try {
      const noticeId = id.replace('notice-', '');
      const date = meta?.data?.date || new Date().toISOString().split('T')[0];

      const res = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { date },
      });

      const notices = JSON.parse(res).payload || [];
      const notice = notices.find(
        (n: any, i: number) => (n.id || i + 1).toString() === noticeId || i.toString() === noticeId,
      );

      if (!notice) return null;

      return {
        id: `notice-${notice.id || noticeId}`,
        type: 'notice',
        title: notice.title || 'Notice',
        subtitle: `${notice.label_title || 'Notice'} • ${notice.staff || 'Staff'}`,
        data: {
          id: notice.id,
          title: notice.title,
          subtitle: notice.label_title,
          author: notice.staff,
          color: notice.colour,
          labelId: notice.label,
          content: notice.contents,
          date,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private static async fetchHomeworkById(id: string, meta?: any): Promise<SeqtaMentionItem | null> {
    try {
      const homeworkId = id.replace('homework-', '');

      const res = await seqtaFetch('/seqta/student/dashlet/summary/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
        params: { majhvjju: '' },
      });

      const homeworkData = JSON.parse(res);
      const homeworkItems = homeworkData.payload || [];
      const homework = homeworkItems.find(
        (h: any) => h.id?.toString() === homeworkId || h.meta?.toString() === homeworkId,
      );

      if (!homework) return null;

      return {
        id: `homework-${homework.id || homework.meta}`,
        type: 'homework',
        title: homework.title || 'Homework',
        subtitle: `${homework.items?.length || 0} ${homework.items?.length === 1 ? 'item' : 'items'}`,
        data: {
          id: homework.id,
          meta: homework.meta,
          title: homework.title,
          items: homework.items || [],
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private static async fetchTeacherById(id: string, meta?: any): Promise<SeqtaMentionItem | null> {
    try {
      const teacherId = id.replace('teacher-', '');

      const res = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'staff' },
      });

      const staffData = typeof res === 'string' ? JSON.parse(res) : res;
      const staff = staffData.payload || [];
      const teacher = staff.find((t: any) => t.id?.toString() === teacherId);

      if (!teacher) return null;

      return {
        id: `teacher-${teacher.id}`,
        type: 'teacher',
        title: teacher.xx_display || `${teacher.firstname} ${teacher.surname}`,
        subtitle: 'Staff',
        data: {
          id: teacher.id,
          firstname: teacher.firstname,
          surname: teacher.surname,
          displayName: teacher.xx_display,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private static async fetchTimetableById(
    id: string,
    meta?: any,
  ): Promise<SeqtaMentionItem | null> {
    try {
      // Extract date from ID (format: timetable-YYYY-MM-DD)
      const dateStr =
        id.replace('timetable-', '') || meta?.data?.date || new Date().toISOString().split('T')[0];

      const studentId = 69;
      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from: dateStr, until: dateStr, student: studentId },
      });

      const timetableData = JSON.parse(res).payload;
      const lessons = timetableData.items || [];

      // Fetch subjects to match codes to subject names
      let subjectMap: Record<string, string> = {};
      try {
        const subjectsRes = await seqtaFetch('/seqta/student/load/subjects?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {},
        });
        const classesData = JSON.parse(subjectsRes).payload;
        const allSubjects = classesData.flatMap((folder: any) => folder.subjects);
        allSubjects.forEach((subject: any) => {
          const key = `${subject.code}-${subject.programme}-${subject.metaclass}`;
          subjectMap[key] = subject.title || subject.code;
        });
      } catch (e) {
        console.warn('Failed to fetch subject names for timetable:', e);
      }

      // Convert to 12-hour format helper
      const format12Hour = (time24: string): string => {
        if (!time24 || !time24.includes(':')) return time24;
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
      };

      return {
        id: `timetable-${dateStr}`,
        type: 'timetable',
        title: `Today's Schedule`,
        subtitle: `${lessons.length} classes scheduled`,
        data: {
          id: `timetable-${dateStr}`,
          date: dateStr,
          lessons: lessons.map((lesson: any) => {
            const fromTime =
              (lesson.from || '').substring(0, 5) || (lesson.from || '').substring(11, 16);
            const untilTime =
              (lesson.until || '').substring(0, 5) || (lesson.until || '').substring(11, 16);

            // Get subject name
            const subjectKey = `${lesson.code}-${lesson.programmeID}-${lesson.metaID}`;
            const subjectName = subjectMap[subjectKey] || lesson.code || lesson.title || 'Lesson';

            return {
              id: lesson.id,
              date: lesson.date || dateStr,
              from: fromTime,
              until: untilTime,
              from12: format12Hour(fromTime),
              until12: format12Hour(untilTime),
              code: lesson.code,
              subjectName,
              title: lesson.title || lesson.description,
              room: lesson.room,
              teacher: lesson.staff || lesson.teacher,
              programme: lesson.programmeID,
              metaclass: lesson.metaID,
            };
          }),
          classCount: lessons.length,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Failed to fetch timetable:', error);
      return null;
    }
  }

  /**
   * Mock data for development/fallback
   */
  private static getMockData(query: string = ''): SeqtaMentionItem[] {
    const mockData: SeqtaMentionItem[] = [
      {
        id: 'assignment-1',
        type: 'assignment',
        title: 'Mathematics Assignment 3',
        subtitle: 'Mathematics • Due: Tomorrow, 11:59 PM',
        data: { subject: 'Mathematics', dueDate: '2024-01-15T23:59:00Z', status: 'pending' },
      },
      {
        id: 'class-1',
        type: 'class',
        title: 'Year 10 Mathematics',
        subtitle: 'Mr. Smith • Room 204',
        data: { year: 10, subject: 'Mathematics', teacher: 'Mr. Smith', room: '204' },
      },
      {
        id: 'subject-1',
        type: 'subject',
        title: 'English Literature',
        subtitle: 'ENG10 • Ms. Johnson • 4 assignments',
        data: { code: 'ENG10', teacher: 'Ms. Johnson', assignmentCount: 4 },
      },
      {
        id: 'assessment-1',
        type: 'assessment',
        title: 'Chemistry Test',
        subtitle: 'Chemistry • Next Friday • Test',
        data: { subject: 'Chemistry', date: '2024-01-19T09:00:00Z', type: 'test' },
      },
      {
        id: 'timetable-1',
        type: 'timetable',
        title: 'Schedule for Today',
        subtitle: '6 classes scheduled',
        data: { date: '2024-01-14', classCount: 6 },
      },
    ];

    if (!query) return mockData;

    return mockData.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase()),
    );
  }

  private static formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString();
  }

  /**
   * Clear cache (useful for development or when data is stale)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
