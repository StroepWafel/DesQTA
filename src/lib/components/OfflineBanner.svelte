<script lang="ts">
  import { connectivity } from '$lib/stores/connectivity';
  import { flushQueue } from '$lib/services/queueService';
  import { Icon } from 'svelte-hero-icons';
  import {
    SignalSlash,
    ExclamationTriangle,
    ArrowPath,
    CloudArrowUp,
  } from 'svelte-hero-icons';
  import { _ } from '$lib/i18n';

  let retrying = $state(false);

  const showBanner = $derived(
    $connectivity.status === 'offline' ||
      $connectivity.status === 'degraded' ||
      $connectivity.status === 'queued' ||
      $connectivity.status === 'syncing',
  );

  async function handleRetry() {
    if (retrying || $connectivity.queuedCount === 0) return;
    retrying = true;
    try {
      await flushQueue();
    } finally {
      retrying = false;
    }
  }
</script>

{#if showBanner}
  <div
    class="sticky top-0 z-30 w-full px-4 py-2.5 border-b transition-colors duration-200
      {$connectivity.status === 'offline' || $connectivity.status === 'degraded' || $connectivity.status === 'queued'
        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-800/50'
        : $connectivity.status === 'syncing'
          ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-800/50'
          : ''}"
    aria-live="polite"
    aria-atomic="true"
    role="status">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        {#if $connectivity.status === 'offline'}
          <Icon
            src={SignalSlash}
            class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div class="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span class="text-sm font-medium text-amber-800 dark:text-amber-200">
              {$_('connectivity.offline', { default: "You're offline" })}
            </span>
            <span class="text-xs text-amber-700/90 dark:text-amber-300/90">
              {$_('connectivity.offline_desc', {
                default: 'Some features may be limited. Data is from cache.',
              })}
            </span>
          </div>
        {:else if $connectivity.status === 'degraded'}
          <Icon
            src={ExclamationTriangle}
            class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div class="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span class="text-sm font-medium text-amber-800 dark:text-amber-200">
              {$_('connectivity.degraded', { default: "Can't reach SEQTA" })}
            </span>
            <span class="text-xs text-amber-700/90 dark:text-amber-300/90">
              {$_('connectivity.degraded_desc', {
                default: 'Showing cached data. Retry when connection improves.',
              })}
            </span>
          </div>
        {:else if $connectivity.status === 'queued'}
          <Icon
            src={CloudArrowUp}
            class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span class="text-sm font-medium text-amber-800 dark:text-amber-200 truncate">
            {$_('connectivity.queued', {
              default: '{{count}} item(s) queued for sync',
              values: { count: $connectivity.queuedCount },
            })}
          </span>
        {:else if $connectivity.status === 'syncing'}
          <Icon
            src={ArrowPath}
            class="w-5 h-5 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
          <span class="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {$_('connectivity.syncing', { default: 'Syncing...' })}
          </span>
        {/if}
      </div>
      {#if $connectivity.status === 'queued' && $connectivity.queuedCount > 0}
        <button
          type="button"
          class="flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 bg-amber-200/60 dark:bg-amber-800/50 hover:bg-amber-300/60 dark:hover:bg-amber-700/50 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
          onclick={handleRetry}
          disabled={retrying}>
          <Icon
            src={ArrowPath}
            class="w-4 h-4 {retrying ? 'animate-spin' : ''}"
            aria-hidden="true" />
          <span>
            {retrying
              ? $_('common.retrying', { default: 'Retrying...' })
              : $_('connectivity.retry', { default: 'Retry' })}
          </span>
        </button>
      {/if}
    </div>
  </div>
{/if}
