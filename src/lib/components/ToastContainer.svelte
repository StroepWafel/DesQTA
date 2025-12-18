<script lang="ts">
  import { toastStore } from '../stores/toast';
  import Toast from './Toast.svelte';
  import { _ } from '../i18n';

  let toasts = $state<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; duration?: number }>>([]);

  $effect(() => {
    const unsubscribe = toastStore.subscribe((value) => {
      toasts = value;
    });
    return unsubscribe;
  });

  function handleClose(id: string) {
    toastStore.remove(id);
  }
</script>

{#if toasts.length > 0}
  <div
    class="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    role="region"
    aria-label={$_('toast.notifications') || 'Notifications'}
  >
    {#each toasts as toast (toast.id)}
      <div class="pointer-events-auto">
        <Toast {toast} onClose={() => handleClose(toast.id)} />
      </div>
    {/each}
  </div>
{/if}

