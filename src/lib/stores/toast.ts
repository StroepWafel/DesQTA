import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // Duration in ms, default 3000
}

const toasts = writable<Toast[]>([]);

export const toastStore = {
  subscribe: toasts.subscribe,
  add: (toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const newToast: Toast = {
      id,
      duration: 3000,
      ...toast,
    };
    toasts.update((current) => [...current, newToast]);

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        toastStore.remove(id);
      }, newToast.duration);
    }

    return id;
  },
  remove: (id: string) => {
    toasts.update((current) => current.filter((t) => t.id !== id));
  },
  clear: () => {
    toasts.set([]);
  },
  success: (message: string, duration?: number) => {
    return toastStore.add({ message, type: 'success', duration });
  },
  error: (message: string, duration?: number) => {
    return toastStore.add({ message, type: 'error', duration });
  },
  info: (message: string, duration?: number) => {
    return toastStore.add({ message, type: 'info', duration });
  },
  warning: (message: string, duration?: number) => {
    return toastStore.add({ message, type: 'warning', duration });
  },
};

