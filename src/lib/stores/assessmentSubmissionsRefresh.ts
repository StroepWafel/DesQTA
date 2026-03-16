import { writable } from 'svelte/store';

/**
 * When an assessment file upload completes, set this store so the assessment page
 * can reload submissions. Works even when the user navigated away during upload.
 */
export const assessmentSubmissionsRefreshStore = writable<{
  assessmentId: number;
  metaclassId: number;
} | null>(null);
