<script lang="ts">
  import { fly } from 'svelte/transition';
  import { Icon, XMark, CheckCircle, ExclamationCircle, InformationCircle, ExclamationTriangle } from 'svelte-hero-icons';
  import type { Toast } from '../stores/toast';
  import { _ } from '../i18n';

  let { toast, onClose }: { toast: Toast; onClose: () => void } = $props();

  const icons = {
    success: CheckCircle,
    error: ExclamationCircle,
    info: InformationCircle,
    warning: ExclamationTriangle,
  };

  const IconComponent = icons[toast.type];
</script>

<div
  class="toast-item flex items-center gap-3 px-4 py-3 rounded-lg shadow-md border min-w-[300px] max-w-[500px] transition-all duration-200 {toast.type === 'success'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
    : toast.type === 'error'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800'
      : toast.type === 'warning'
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'}"
  role="alert"
  transition:fly={{ y: -20, duration: 200 }}
>
  <Icon
    src={IconComponent}
    class="w-5 h-5 flex-shrink-0 {toast.type === 'success'
      ? 'text-green-600 dark:text-green-400'
      : toast.type === 'error'
        ? 'text-red-600 dark:text-red-400'
        : toast.type === 'warning'
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-blue-600 dark:text-blue-400'}"
  />
  <p class="flex-1 text-sm font-medium">{toast.message}</p>
  <button
    type="button"
    class="flex-shrink-0 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
    onclick={onClose}
    aria-label={$_('toast.close_notification') || 'Close notification'}
  >
    <Icon src={XMark} class="w-4 h-4 opacity-70 hover:opacity-100" />
  </button>
</div>

