<script lang="ts">
  import { fly } from 'svelte/transition';
  import { Icon, XMark, CheckCircle, ExclamationCircle, InformationCircle, ExclamationTriangle } from 'svelte-hero-icons';
  import type { Toast } from '../stores/toast';

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
  class="toast-item flex items-center gap-3 px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-w-[300px] max-w-[500px] transition-all duration-200"
  role="alert"
  transition:fly={{ y: -20, duration: 200 }}
>
  <Icon
    src={IconComponent}
    class="w-5 h-5 flex-shrink-0 {toast.type === 'success'
      ? 'text-green-500'
      : toast.type === 'error'
        ? 'text-red-500'
        : toast.type === 'warning'
          ? 'text-yellow-500'
          : 'text-blue-500'}"
  />
  <p class="flex-1 text-sm text-zinc-900 dark:text-white">{toast.message}</p>
  <button
    type="button"
    class="flex-shrink-0 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
    onclick={onClose}
    aria-label="Close notification"
  >
    <Icon src={XMark} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
  </button>
</div>

