<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { LoadingSpinner, EmptyState, Button } from '$lib/components/ui';
  import { Icon, Flag, ExclamationTriangle, ChevronLeft, Plus } from 'svelte-hero-icons';
  import Editor from '../../../components/Editor/Editor.svelte';
  import GoalsToolbar from '../components/GoalsToolbar.svelte';
  import { Editor as TipTapEditor } from '@tiptap/core';
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
    student_notes?: string;
  }

  let goalsData: GoalsData | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let myNotes = $state('');
  let saving = $state(false);
  let editorInstance: TipTapEditor | null = $state(null);
  let goalsEnabled = $state<boolean | null>(null);

  const year = $derived($page.params.year);

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
        // Load existing student notes if available
        if (goalsData?.student_notes) {
          myNotes = goalsData.student_notes;
        } else {
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
    if (!goalsData || !editorInstance) return;

    saving = true;
    try {
      // Extract HTML content from editor (without wrapper div and styles)
      const studentNotes = editorInstance.getHTML();

      const response = await seqtaFetch('/seqta/student/load/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'save',
          goal: goalsData.goal,
          student_notes: studentNotes,
          items: goalsData.items || [],
        },
      });

      // Parse response - could be string or already parsed
      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200') {
        logger.info('goals', 'saveNotes', 'Notes saved successfully', {
          year,
          goal: goalsData.goal,
        });
        // Show success toast if available
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.success($_('goals.notes_saved') || 'Notes saved successfully');
        } catch {
          // Toast store not available, skip
        }
      } else {
        throw new Error('Failed to save notes');
      }
    } catch (e) {
      logger.error('goals', 'saveNotes', `Failed to save notes: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../lib/stores/toast');
        toastStore.error($_('goals.save_error') || 'Failed to save notes');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      saving = false;
    }
  }

  // Set editor content when both editor and goals data are ready
  let contentInitialized = $state(false);

  $effect(() => {
    if (editorInstance && goalsData?.student_notes && !contentInitialized) {
      const currentContent = editorInstance.getHTML();
      // Only set if editor is empty or just has empty paragraph
      if (!currentContent || currentContent === '<p></p>' || currentContent.trim() === '') {
        editorInstance.commands.setContent(goalsData.student_notes, false);
        contentInitialized = true;
      }
    }
  });

  onMount(async () => {
    await checkGoalsEnabled();
    if (goalsEnabled) {
      loadGoals();
    } else {
      loading = false;
    }
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
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-y-auto">
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
          <!-- Toolbar -->
          {#if editorInstance}
            <div class="border-b border-zinc-200 dark:border-zinc-700">
              <GoalsToolbar editor={editorInstance} readonly={false} {saving} onSave={saveNotes} />
            </div>
          {/if}
          <!-- Editor -->
          <div class="flex-1 overflow-y-auto min-h-[400px]">
            <Editor bind:content={myNotes} bind:editorInstance />
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
