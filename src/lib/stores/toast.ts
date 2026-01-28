import { toast as sonnerToast } from 'svelte-sonner';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // Duration in ms, default 3000
}

/**
 * Toast store wrapper around svelte-sonner
 * Maintains backward compatibility with existing toast API
 */
export const toastStore = {
  add: (toast: Omit<Toast, 'id'>) => {
    const duration = toast.duration ?? 3000;
    const durationSeconds = duration > 0 ? duration / 1000 : undefined;

    const options = {
      duration: durationSeconds,
    };

    switch (toast.type) {
      case 'success':
        return sonnerToast.success(toast.message, options);
      case 'error':
        return sonnerToast.error(toast.message, options);
      case 'info':
        return sonnerToast.info(toast.message, options);
      case 'warning':
        return sonnerToast.warning(toast.message, options);
      default:
        return sonnerToast(toast.message, options);
    }
  },
  remove: (id: string | number) => {
    sonnerToast.dismiss(id);
  },
  clear: () => {
    sonnerToast.dismiss();
  },
  success: (message: string, duration?: number) => {
    const durationSeconds = duration ? duration / 1000 : undefined;
    return sonnerToast.success(message, { duration: durationSeconds });
  },
  error: (message: string, duration?: number) => {
    const durationSeconds = duration ? duration / 1000 : undefined;
    return sonnerToast.error(message, { duration: durationSeconds });
  },
  info: (message: string, duration?: number) => {
    const durationSeconds = duration ? duration / 1000 : undefined;
    return sonnerToast.info(message, { duration: durationSeconds });
  },
  warning: (message: string, duration?: number) => {
    const durationSeconds = duration ? duration / 1000 : undefined;
    return sonnerToast.warning(message, { duration: durationSeconds });
  },
};

