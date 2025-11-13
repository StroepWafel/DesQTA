import { invoke } from '@tauri-apps/api/core';

/**
 * TypeScript bridge for Rust-backed SeqtaMentionsService
 * This provides the same interface as the original service but calls Rust via Tauri
 */

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

/**
 * Search for SEQTA elements that can be mentioned
 * Calls Rust backend via Tauri
 */
export async function searchMentions(
  query: string = '',
  categoryFilter?: string,
): Promise<SeqtaMentionItem[]> {
  try {
    const results = await invoke<SeqtaMentionItem[]>('search_seqta_mentions', {
      query,
      categoryFilter: categoryFilter || null,
    });
    return results;
  } catch (error) {
    console.error('Error searching SEQTA mentions:', error);
    return [];
  }
}

/**
 * Search mentions with context (note content for better suggestions)
 * Calls Rust backend via Tauri
 */
export async function searchMentionsWithContext(
  query: string = '',
  noteContent: string = '',
  categoryFilter?: string,
): Promise<SeqtaMentionItem[]> {
  try {
    const results = await invoke<SeqtaMentionItem[]>('search_seqta_mentions_with_context', {
      query,
      noteContent,
      categoryFilter: categoryFilter || null,
    });
    return results;
  } catch (error) {
    console.error('Error searching SEQTA mentions with context:', error);
    return [];
  }
}

/**
 * Get updated data for a specific mention
 * Calls Rust backend via Tauri
 */
export async function updateMentionData(
  mentionId: string,
  mentionType: string,
  meta?: any,
): Promise<SeqtaMentionItem | null> {
  try {
    const result = await invoke<SeqtaMentionItem | null>('update_seqta_mention_data', {
      mentionId,
      mentionType,
      meta: meta || null,
    });
    return result;
  } catch (error) {
    console.error('Error updating mention data:', error);
    return null;
  }
}

/**
 * Get weekly schedule for a class
 * Calls Rust backend via Tauri
 */
export async function getWeeklyScheduleForClass(
  programme: number | string | undefined,
  metaclass: number | string | undefined,
  code: string | undefined,
): Promise<Array<{ date: string; from: string; until: string; room?: string }>> {
  try {
    const results = await invoke<
      Array<{ date: string; from: string; until: string; room?: string }>
    >('get_weekly_schedule_for_class_cmd', {
      programme: programme ? Number(programme) : null,
      metaclass: metaclass ? Number(metaclass) : null,
      code: code || null,
    });
    return results;
  } catch (error) {
    console.error('Error fetching weekly schedule:', error);
    return [];
  }
}

/**
 * Fetch lesson content for a class
 * Calls Rust backend via Tauri
 */
export async function fetchLessonContent(
  programme: number | string,
  metaclass: number | string,
  lessonIndex?: number,
  termIndex?: number,
): Promise<any> {
  try {
    const result = await invoke<any>('fetch_lesson_content_cmd', {
      programme: Number(programme),
      metaclass: Number(metaclass),
      lessonIndex: lessonIndex ?? null,
      termIndex: termIndex ?? null,
    });
    return result;
  } catch (error) {
    console.error('Error fetching lesson content:', error);
    return null;
  }
}

/**
 * Rust-backed SeqtaMentionsService
 * Drop-in replacement for the original service
 */
export class SeqtaMentionsServiceRust {
  /**
   * Search for SEQTA elements that can be mentioned
   */
  static async searchMentions(
    query: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    return searchMentions(query, categoryFilter);
  }

  /**
   * Search mentions with context
   */
  static async searchMentionsWithContext(
    query: string = '',
    noteContent: string = '',
    categoryFilter?: string,
  ): Promise<SeqtaMentionItem[]> {
    return searchMentionsWithContext(query, noteContent, categoryFilter);
  }

  /**
   * Get updated data for a specific mention
   */
  static async updateMentionData(
    mentionId: string,
    mentionType: string,
    meta?: any,
  ): Promise<SeqtaMentionItem | null> {
    return updateMentionData(mentionId, mentionType, meta);
  }

  /**
   * Get weekly schedule for a class
   */
  static async getWeeklyScheduleForClass(
    programme: number | string | undefined,
    metaclass: number | string | undefined,
    code: string | undefined,
  ): Promise<Array<{ date: string; from: string; until: string; room?: string }>> {
    return getWeeklyScheduleForClass(programme, metaclass, code);
  }

  /**
   * Fetch lesson content for a class
   */
  static async fetchLessonContent(
    programme: number | string,
    metaclass: number | string,
    lessonIndex?: number,
    termIndex?: number,
  ): Promise<any> {
    return fetchLessonContent(programme, metaclass, lessonIndex, termIndex);
  }
}
