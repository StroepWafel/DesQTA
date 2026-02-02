<script lang="ts">
  import { toastStore } from '../stores/toast';
  import Toast from './Toast.svelte';
  import { _ } from '../i18n';

  // ToastContainer is deprecated - svelte-sonner handles toasts directly
  // This component is kept for backward compatibility but doesn't need to track toasts
  let toasts = $state<
    Array<{
      id: string;
      message: string;
      type: 'success' | 'error' | 'info' | 'warning';
      duration?: number;
    }>
  >([]);

  function handleClose(id: string) {
    toastStore.remove(id);
  }
</script>

{#if toasts.length > 0}
  <div
    class="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    role="region"
    aria-label={$_('toast.notifications') || 'Notifications'}>
    {#each toasts as toast (toast.id)}
      <div class="pointer-events-auto">
        <Toast {toast} onClose={() => handleClose(toast.id)} />
      </div>
    {/each}
  </div>
{/if}
