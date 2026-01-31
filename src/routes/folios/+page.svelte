<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, FolderOpen, PencilSquare, ExclamationTriangle } from 'svelte-hero-icons';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback } from '../../lib/services/idbCache';

  let foliosEnabled = $state<boolean | null>(null);
  let loading = $state(true);

  async function checkFoliosEnabled() {
    loading = true;
    const cacheKey = 'folios_settings_enabled';
    const isOnline = navigator.onLine;

    // Load from cache first for instant UI
    const cached =
      cache.get<boolean>(cacheKey) ||
      (await getWithIdbFallback<boolean>(cacheKey, cacheKey, () => cache.get<boolean>(cacheKey)));

    if (cached !== null && cached !== undefined) {
      foliosEnabled = cached;
      loading = false;
    }

    // Always fetch fresh data when online (even if we have cache)
    if (isOnline) {
      try {
        await fetchFoliosSettings();
      } catch (e) {
        logger.error('folios', 'checkFoliosEnabled', `Failed to fetch fresh settings: ${e}`, {
          error: e,
        });
        // Don't update foliosEnabled if fetch fails and we have cached data
        if (cached === null || cached === undefined) {
          foliosEnabled = false;
        }
      }
    } else if (cached === null || cached === undefined) {
      // Offline and no cache - default to disabled
      foliosEnabled = false;
      loading = false;
    }
  }

  async function fetchFoliosSettings() {
    const cacheKey = 'folios_settings_enabled';
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const enabled = data?.payload?.['coneqt-s.page.folios']?.value === 'enabled';

      foliosEnabled = enabled;
      cache.set(cacheKey, enabled, 60);
      const { setIdb } = await import('../../lib/services/idbCache');
      await setIdb(cacheKey, enabled);
      loading = false;
    } catch (e) {
      loading = false;
      throw e;
    }
  }

  onMount(() => {
    checkFoliosEnabled();
  });
</script>

<div class="container px-6 py-7 mx-auto">
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <LoadingSpinner size="md" message={$_('folios.loading') || 'Loading...'} />
    </div>
  {:else if foliosEnabled === false}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('folios.not_enabled') || 'Folios Not Enabled'}
        message={$_('folios.not_enabled_message') || 'Folios are not enabled for your account.'}
        icon={ExclamationTriangle}
        size="md" />
    </div>
  {:else}
    <h1 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
      <T key="navigation.folios" fallback="Folios" />
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
      <!-- Edit My Folios -->
      <div class="folio-action-card-animate" style="animation-delay: 0ms;">
        <button
          onclick={() => goto('/folios/edit')}
          class="group p-8 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
          <div class="flex flex-col items-center text-center space-y-4">
            <div
              class="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
              <Icon src={PencilSquare} class="w-8 h-8 text-accent" />
            </div>
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">
              <T key="folios.edit_my_folios" fallback="Edit My Folios" />
            </h2>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              <T
                key="folios.edit_my_folios_description"
                fallback="Create and manage your personal folios" />
            </p>
          </div>
        </button>
      </div>

      <!-- Browse Folios -->
      <div class="folio-action-card-animate" style="animation-delay: 100ms;">
        <button
          onclick={() => goto('/folios/browse')}
          class="group p-8 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
          <div class="flex flex-col items-center text-center space-y-4">
            <div
              class="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
              <Icon src={FolderOpen} class="w-8 h-8 text-accent" />
            </div>
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">
              <T key="folios.browse_folios" fallback="Browse Folios" />
            </h2>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              <T
                key="folios.browse_folios_description"
                fallback="Explore and view available folios" />
            </p>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .folio-action-card-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
