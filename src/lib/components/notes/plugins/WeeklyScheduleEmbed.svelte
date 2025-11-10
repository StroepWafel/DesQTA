<script lang="ts">
  import { onMount } from 'svelte';
  import { SeqtaMentionsService } from '../../../services/seqtaMentionsService';
  import { Icon, ChevronDown, ChevronUp } from 'svelte-hero-icons';

  interface Props {
    programme: number | string | undefined;
    metaclass: number | string | undefined;
    code: string | undefined;
    title: string;
  }

  let { programme, metaclass, code, title }: Props = $props();

  let schedule: Array<{ date: string; from: string; until: string; room?: string }> = $state([]);
  let loading = $state(true);
  let expanded = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const weeklySchedule = await SeqtaMentionsService.getWeeklyScheduleForClass(
        programme,
        metaclass,
        code,
      );
      schedule = weeklySchedule;
    } catch (e) {
      error = 'Failed to load schedule';
      console.error('Failed to load weekly schedule:', e);
    } finally {
      loading = false;
    }
  });

  function groupByDay() {
    const grouped: Record<string, Array<{ date: string; from: string; until: string; room?: string }>> = {};
    
    schedule.forEach((entry) => {
      const date = new Date(entry.date);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      
      if (dayName !== 'Sat' && dayName !== 'Sun') {
        if (!grouped[dayName]) {
          grouped[dayName] = [];
        }
        grouped[dayName].push(entry);
      }
    });

    // Sort lessons within each day by time
    Object.keys(grouped).forEach((day) => {
      grouped[day].sort((a, b) => a.from.localeCompare(b.from));
    });

    return grouped;
  }

  function formatTime(time: string): string {
    // Handle both "HH:MM" and full datetime formats
    if (time.includes('T')) {
      const date = new Date(time);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return time.substring(0, 5);
  }

  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const groupedSchedule = $derived(groupByDay());
</script>

{#if loading}
  <div class="flex items-center justify-center py-4">
    <div class="w-6 h-6 rounded-full border-2 border-zinc-300 border-t-blue-600 animate-spin"></div>
  </div>
{:else if error}
  <div class="text-sm text-zinc-500 dark:text-zinc-400">{error}</div>
{:else if schedule.length === 0}
  <div class="text-sm text-zinc-500 dark:text-zinc-400">No schedule available</div>
{:else}
  <div class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <button
      class="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      onclick={() => (expanded = !expanded)}
      type="button">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-zinc-900 dark:text-white">Weekly Schedule</span>
        <span class="text-xs text-zinc-500 dark:text-zinc-400">
          ({schedule.length} {schedule.length === 1 ? 'lesson' : 'lessons'})
        </span>
      </div>
      <Icon
        src={expanded ? ChevronUp : ChevronDown}
        class="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
    </button>

    <!-- Schedule Grid -->
    {#if expanded}
      <div class="p-4 bg-white dark:bg-zinc-900/50">
        <div class="grid grid-cols-5 gap-2">
          {#each dayOrder as day}
            <div class="min-w-0">
              <div class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 text-center">
                {day}
              </div>
              <div class="space-y-1">
                {#if groupedSchedule[day]}
                  {#each groupedSchedule[day] as lesson}
                    <div
                      class="p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <div class="text-xs font-medium text-blue-900 dark:text-blue-200">
                        {formatTime(lesson.from)} - {formatTime(lesson.until)}
                      </div>
                      {#if lesson.room}
                        <div class="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">
                          Room {lesson.room}
                        </div>
                      {/if}
                    </div>
                  {/each}
                {:else}
                  <div class="text-[10px] text-zinc-400 dark:text-zinc-600 text-center py-2">
                    No lessons
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

