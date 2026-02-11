<script lang="ts">
  import { onMount } from 'svelte';
  import { queueCountByType } from '$lib/services/idb';
  import { flushMessageDrafts } from '$lib/services/syncService';
  import { Icon } from 'svelte-hero-icons';
  import { PaperAirplane, ArrowPath } from 'svelte-hero-icons';
  import { _ } from '$lib/i18n';

  let queuedCount = $state(0);
  let retrying = $state(false);

  async function refreshCount() {
    queuedCount = await queueCountByType('message_draft');
  }

  async function handleRetry() {
    if (retrying || queuedCount === 0) return;
    retrying = true;
    try {
      await flushMessageDrafts();
      await refreshCount();
    } finally {
      retrying = false;
    }
  }

  onMount(() => {
    refreshCount();
    const handleQueued = () => refreshCount();
    window.addEventListener('message-queued', handleQueued);
    const interval = setInterval(refreshCount, 5000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('message-queued', handleQueued);
    };
  });
</script>

{#if queuedCount > 0}
  <div
    class="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-800 dark:text-amber-200">
    <div class="flex items-center gap-2 min-w-0">
      <Icon src={PaperAirplane} class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span class="text-sm font-medium truncate">
        {queuedCount} message{queuedCount === 1 ? '' : 's'} queued for sending
      </span>
    </div>
    <button
      type="button"
      class="flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 bg-amber-200/60 dark:bg-amber-800/50 hover:bg-amber-300/60 dark:hover:bg-amber-700/50 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
      onclick={handleRetry}
      disabled={retrying}>
      <Icon
        src={ArrowPath}
        class="w-4 h-4 {retrying ? 'animate-spin' : ''}"
        aria-hidden="true" />
      <span>{retrying ? $_('common.retrying', { default: 'Retrying...' }) : $_('common.retry', { default: 'Retry' })}</span>
    </button>
  </div>
{/if}
