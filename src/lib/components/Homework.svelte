<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, BookOpen } from 'svelte-hero-icons';
  import { AsyncWrapper } from '$lib/components/ui';

  interface HomeworkItem {
    meta: number;
    id: number;
    title: string;
    items: string[];
  }

  interface HomeworkResponse {
    payload: HomeworkItem[];
    status: string;
  }

  let homeworkData = $state<HomeworkResponse | null>(null);
  let homeworkError = $state<string | null>(null);
  let loadingHomework = $state(true);

  async function fetchHomeworkData() {
    try {
      loadingHomework = true;
      homeworkError = null;
      const response = await seqtaFetch('/seqta/student/dashlet/summary/homework', {
        method: 'POST',
        body: {},
        params: { majhvjju: '' },
      });
      homeworkData = JSON.parse(response);
    } catch (e: any) {
      console.error('Error details:', e);
      homeworkError = e.toString();
    } finally {
      loadingHomework = false;
    }
  }

  onMount(async () => {
    await fetchHomeworkData();
  });
</script>

<div class="flex flex-col h-full min-h-0 w-full">
  <div
    class="flex items-center gap-2 mb-2 sm:mb-3 shrink-0 transition-all duration-300"
    in:fade={{ duration: 200 }}>
    <Icon
      src={BookOpen}
      class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    <h3 class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300">
      Homework
    </h3>
  </div>

  <div class="flex-1 min-h-0 overflow-y-auto">
    <AsyncWrapper
      loading={loadingHomework}
      error={homeworkError}
      data={homeworkData?.payload}
      empty={!homeworkData?.payload || homeworkData.payload.length === 0}
      emptyTitle="No homework found"
      emptyMessage="You're all caught up!"
      emptyIcon="📚"
      componentName="Homework">
      {#snippet children(homeworkItems)}
        <div class="flex flex-col gap-3">
          {#each homeworkItems as homework (homework.id)}
            <div
              class="p-3 sm:p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm transition-all duration-200 hover:border-accent-500/40 dark:hover:border-accent-500/40"
              in:fade={{ duration: 200 }}>
              <h4 class="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
                {homework.title}
              </h4>
              <div class="flex flex-col gap-2">
                {#each homework.items as item, i (i)}
                  <div class="flex gap-2 items-start px-3 py-2 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 transition-colors duration-200 hover:border-accent-500/40">
                    <span class="mt-0.5 text-accent-600 dark:text-accent-400 shrink-0">•</span>
                    <span class="text-sm text-zinc-800 dark:text-zinc-200">{item}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/snippet}
    </AsyncWrapper>
  </div>
</div> 