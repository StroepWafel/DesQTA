<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { LoadingSpinner, EmptyState, Button } from '$lib/components/ui';
  import { Icon, Flag, ExclamationTriangle, ChevronLeft, Plus } from 'svelte-hero-icons';
  import Editor from '../../../components/Editor/Editor.svelte';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { logger } from '../../../utils/logger';

  interface GoalsData {
    overview: string;
    goal: number;
    student: number;
    name: string;
    id: number;
    items: any[];
  }

  let goalsData: GoalsData | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let myNotes = $state('');
  let saving = $state(false);

  const year = $derived($page.params.year);

  async function loadGoals() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/load/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'goals', year: parseInt(year || '0') },
      });

      // Parse response - could be string or already parsed
      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        goalsData = data.payload;
        // Initialize notes if empty
        if (!myNotes && goalsData?.overview) {
          myNotes = '';
        }
      } else {
        error = 'Invalid response format';
        logger.error('goals', 'loadGoals', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('goals', 'loadGoals', `Failed to load goals: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function saveNotes() {
    saving = true;
    try {
      // TODO: Implement save API call when available
      logger.info('goals', 'saveNotes', 'Saving notes', { year, notes: myNotes });
      // For now, just log - API endpoint may be different
    } catch (e) {
      logger.error('goals', 'saveNotes', `Failed to save notes: ${e}`, { error: e });
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    loadGoals();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
    <div class="flex items-center gap-4">
      <button
        onclick={() => goto('/goals')}
        class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={ChevronLeft} class="w-5 h-5" />
      </button>
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
        {year}
        <T key="navigation.goals" fallback="Goals" />
      </h1>
    </div>
    <Button
      onclick={saveNotes}
      disabled={saving}
      class="transition-all duration-200 transform hover:scale-105 active:scale-95">
      {saving ? 'Saving...' : $_('common.save') || 'Save'}
    </Button>
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex justify-center items-center h-64">
        <LoadingSpinner size="md" message={$_('goals.loading_goals') || 'Loading goals...'} />
      </div>
    {:else if error}
      <div class="flex justify-center items-center h-64">
        <EmptyState
          title={$_('goals.error_loading_goals') || 'Error loading goals'}
          message={error}
          icon={ExclamationTriangle}
          size="md" />
      </div>
    {:else if goalsData}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        <!-- Left Column: My Notes -->
        <div
          class="flex flex-col bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div class="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="goals.my_notes" fallback="My notes" />
            </h2>
          </div>
          <div class="flex-1 overflow-y-auto min-h-[400px]">
            <Editor bind:content={myNotes} />
          </div>
        </div>

        <!-- Right Column: Overview -->
        <div
          class="flex flex-col bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div class="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="goals.overview" fallback="Overview" />
            </h2>
          </div>
          <div class="flex-1 overflow-y-auto p-4 prose prose-zinc dark:prose-invert max-w-none">
            {@html goalsData.overview}
          </div>
        </div>
      </div>

      <!-- Goals Table -->
      <div class="px-6 pb-6">
        <div
          class="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div
            class="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="goals.goals" fallback="Goals" />
            </h2>
            <button
              class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
              <Icon src={Plus} class="w-5 h-5" />
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-zinc-200 dark:border-zinc-700">
                  <th
                    class="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                    <T key="goals.goal" fallback="Goal" />
                  </th>
                  <th
                    class="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                    <T key="goals.support" fallback="Support" />
                  </th>
                  <th
                    class="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                    <T key="goals.action" fallback="Action" />
                  </th>
                  <th
                    class="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-white">
                    <T key="goals.my_notes" fallback="My notes" />
                  </th>
                  <th
                    class="px-4 py-3 text-center text-sm font-semibold text-zinc-900 dark:text-white">
                    <T key="goals.done" fallback="Done" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {#if goalsData.items && goalsData.items.length > 0}
                  {#each goalsData.items as item}
                    <tr class="border-b border-zinc-200 dark:border-zinc-700">
                      <td class="px-4 py-3 text-zinc-900 dark:text-white">{item.goal || '-'}</td>
                      <td class="px-4 py-3 text-zinc-900 dark:text-white">{item.support || '-'}</td>
                      <td class="px-4 py-3 text-zinc-900 dark:text-white">{item.action || '-'}</td>
                      <td class="px-4 py-3 text-zinc-900 dark:text-white">{item.notes || '-'}</td>
                      <td class="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.done || false}
                          class="w-4 h-4 text-accent bg-white border-zinc-300 rounded focus:ring-accent dark:bg-zinc-700 dark:border-zinc-600" />
                      </td>
                    </tr>
                  {/each}
                {:else}
                  <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                      <T
                        key="goals.no_goals"
                        fallback="No goals yet. Click the + button to add one." />
                    </td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
