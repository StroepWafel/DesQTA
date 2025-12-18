<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import { Icon, Flag, ExclamationTriangle } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';

  let years: string[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let goalsEnabled = $state<boolean | null>(null);

  async function checkGoalsEnabled() {
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      goalsEnabled = data?.payload?.['coneqt-s.page.goals']?.value === 'enabled';
    } catch (e) {
      logger.error('goals', 'checkGoalsEnabled', `Failed to check if goals are enabled: ${e}`, {
        error: e,
      });
      goalsEnabled = false; // Default to disabled on error
    }
  }

  async function loadYears() {
    loading = true;
    error = null;

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
      } else {
        error = 'Invalid response format';
        logger.error('goals', 'loadYears', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('goals', 'loadYears', `Failed to load years: ${e}`, { error: e });
    } finally {
      loading = false;
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
      {#each years as year}
        <button
          onclick={() => goto(`/goals/${year}`)}
          class="px-6 py-4 text-left bg-white rounded-lg border transition-all duration-200 transform dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
          <div class="flex items-center gap-3">
            <Icon src={Flag} class="w-6 h-6 text-accent" />
            <span class="text-lg font-semibold text-zinc-900 dark:text-white">{year}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
