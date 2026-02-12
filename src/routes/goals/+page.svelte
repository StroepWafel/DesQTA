<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import { Icon, Flag, ExclamationTriangle } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback } from '../../lib/services/idbCache';

  let years: string[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let goalsEnabled = $state<boolean | null>(null);

  async function checkGoalsEnabled() {
    const cacheKey = 'goals_settings_enabled';
    const { isOfflineMode } = await import('../../lib/utils/offlineMode');
    const offline = await isOfflineMode();

    // Load from cache first for instant UI
    const cached =
      cache.get<boolean>(cacheKey) ||
      (await getWithIdbFallback<boolean>(cacheKey, cacheKey, () => cache.get<boolean>(cacheKey)));

    if (cached !== null && cached !== undefined) {
      goalsEnabled = cached;
    }

    // Always fetch fresh data when online (even if we have cache)
    if (!offline) {
      try {
        await fetchGoalsSettings();
      } catch (e) {
        logger.error('goals', 'checkGoalsEnabled', `Failed to fetch fresh settings: ${e}`, {
          error: e,
        });
        // Don't update goalsEnabled if fetch fails and we have cached data
        if (cached === null || cached === undefined) {
          goalsEnabled = false;
        }
      }
    } else if (cached === null || cached === undefined) {
      // Offline and no cache - default to disabled
      goalsEnabled = false;
    }
  }

  async function fetchGoalsSettings() {
    const cacheKey = 'goals_settings_enabled';
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const enabled = data?.payload?.['coneqt-s.page.goals']?.value === 'enabled';

      goalsEnabled = enabled;
      cache.set(cacheKey, enabled, 60);
      const { setIdb } = await import('../../lib/services/idbCache');
      await setIdb(cacheKey, enabled);
    } catch (e) {
      throw e;
    }
  }

  async function loadYears() {
    loading = true;
    error = null;
    const cacheKey = 'goals_years';
    const { isOfflineMode } = await import('../../lib/utils/offlineMode');
    const offline = await isOfflineMode();

    // Load from cache first for instant UI
    const cached =
      cache.get<string[]>(cacheKey) ||
      (await getWithIdbFallback<string[]>(cacheKey, cacheKey, () => cache.get<string[]>(cacheKey)));

    if (cached && Array.isArray(cached) && cached.length > 0) {
      years = cached;
      loading = false;
    }

    // Always fetch fresh data when online (even if we have cache)
    if (!offline) {
      try {
        await fetchYears();
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        logger.error('goals', 'loadYears', `Failed to fetch fresh years: ${e}`, { error: e });
        // Don't update years if fetch fails and we have cached data
        if (!cached || cached.length === 0) {
          loading = false;
        }
      }
    } else if (!cached || cached.length === 0) {
      // Offline and no cache
      error = 'No cached data available';
      loading = false;
    }
  }

  async function fetchYears() {
    const cacheKey = 'goals_years';
    try {
      const response = await seqtaFetch('/seqta/student/load/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'years' },
      });

      // Parse response - could be string or already parsed
      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && Array.isArray(data.payload)) {
        years = data.payload;
        cache.set(cacheKey, data.payload, 30);
        const { setIdb } = await import('../../lib/services/idbCache');
        await setIdb(cacheKey, data.payload);
        loading = false;
      } else {
        error = 'Invalid response format';
        logger.error('goals', 'fetchYears', 'Invalid response format', { data });
        loading = false;
      }
    } catch (e) {
      loading = false;
      throw e;
    }
  }

  onMount(async () => {
    await checkGoalsEnabled();
    if (goalsEnabled) {
      loadYears();
    } else {
      loading = false;
    }
  });
</script>

<div class="container px-6 py-7 mx-auto">
  <h1 class="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
    <T key="navigation.goals" fallback="Goals" />
  </h1>

  {#if goalsEnabled === false}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('goals.not_enabled') || 'Goals not available'}
        message={$_('goals.not_enabled_message') ||
          'Goals are not enabled for your school. Please contact your administrator if you believe this is an error.'}
        icon={Flag}
        size="md" />
    </div>
  {:else if loading}
    <div class="flex justify-center items-center h-64">
      <LoadingSpinner size="md" message={$_('goals.loading_years') || 'Loading years...'} />
    </div>
  {:else if error}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('goals.error_loading_years') || 'Error loading years'}
        message={error}
        icon={ExclamationTriangle}
        size="md" />
    </div>
  {:else if years.length === 0}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('goals.no_years_available') || 'No years available'}
        message={$_('goals.no_years_message') || 'There are no years to display.'}
        icon={Flag}
        size="md" />
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {#key years.join(',')}
        {#each years as year, i}
          <div class="goal-year-card-animate" style="animation-delay: {i * 50}ms;">
            <button
              onclick={() => goto(`/goals/${year}`)}
              class="px-6 py-4 text-left bg-white rounded-lg border transition-all duration-200 transform dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
              <div class="flex items-center gap-3">
                <Icon src={Flag} class="w-6 h-6 text-accent" />
                <span class="text-lg font-semibold text-zinc-900 dark:text-white">{year}</span>
              </div>
            </button>
          </div>
        {/each}
      {/key}
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

  .goal-year-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
