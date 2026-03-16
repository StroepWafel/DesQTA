import { writable, derived } from 'svelte/store';

export interface UploadProgressState {
  active: boolean;
  current: number;
  total: number;
  currentFileName?: string;
  label?: string;
}

function createUploadProgressStore() {
  const { subscribe, set, update } = writable<UploadProgressState>({
    active: false,
    current: 0,
    total: 0,
  });

  return {
    subscribe,
    /** Start an upload batch with total file count */
    start: (total: number, label = 'Uploading files') => {
      set({
        active: true,
        current: 0,
        total,
        label,
      });
    },
    /** Update progress (e.g. after each file completes) */
    setProgress: (current: number, currentFileName?: string) => {
      update((s) => ({
        ...s,
        current,
        currentFileName,
      }));
    },
    /** Mark upload complete and hide the bar */
    complete: () => {
      set({
        active: false,
        current: 0,
        total: 0,
      });
    },
    /** Mark upload failed */
    fail: () => {
      set({
        active: false,
        current: 0,
        total: 0,
      });
    },
  };
}

export const uploadProgressStore = createUploadProgressStore();

export const uploadProgressPercent = derived(uploadProgressStore, ($s) =>
  $s.total > 0 ? Math.round((($s.current / $s.total) * 100)) : 0,
);
