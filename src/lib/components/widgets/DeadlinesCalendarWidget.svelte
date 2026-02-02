<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { cache } from '../../../utils/cache';
  import { Icon, CalendarDays, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { logger } from '../../../utils/logger';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  interface Assessment {
    id: number;
    title: string;
    subject: string;
    code: string;
    due: string;
    colour: string;
  }

  const studentId = 69;
  let assessments = $state<Assessment[]>([]);
  let loading = $state(true);
  let currentDate = $state(new Date());
  let daysToShow = $derived(parseInt(settings.daysToShow || '14'));
  let showCompleted = $derived(settings.showCompleted || false);

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function getDaysArray(): Array<{ date: Date; assessments: Assessment[] }> {
    const days: Array<{ date: Date; assessments: Assessment[] }> = [];
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);

    // Add empty days for alignment
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), -i),
        assessments: [],
      });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayAssessments = assessments.filter((a) => {
        const dueDate = new Date(a.due);
        return (
          dueDate.getDate() === date.getDate() &&
          dueDate.getMonth() === date.getMonth() &&
          dueDate.getFullYear() === date.getFullYear()
        );
      });
      days.push({ date, assessments: dayAssessments });
    }

    return days;
  }

  async function loadAssessments() {
    loading = true;
    try {
      const cachedData = cache.get<{ assessments: any[] }>('upcoming_assessments_data');
      if (cachedData) {
        assessments = cachedData.assessments.filter((a) => {
          const dueDate = new Date(a.due);
          const now = new Date();
          const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= daysToShow;
        });
        loading = false;
        return;
      }

      const assessmentsRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId },
      });

      const allAssessments = JSON.parse(assessmentsRes).payload || [];
      const now = new Date();

      assessments = allAssessments
        .filter((a: any) => {
          const dueDate = new Date(a.due);
          const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= daysToShow;
        })
        .map((a: any) => ({
          id: a.id || a.assessmentID,
          title: a.title,
          subject: a.subject,
          code: a.code,
          due: a.due,
          colour: a.colour || '#8e8e8e',
        }));
    } catch (e) {
      logger.error(
        'DeadlinesCalendarWidget',
        'loadAssessments',
        `Failed to load assessments: ${e}`,
        { error: e },
      );
      assessments = [];
    } finally {
      loading = false;
    }
  }

  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  function goToToday() {
    currentDate = new Date();
  }

  function handleAssessmentClick(assessment: Assessment) {
    const dueDate = new Date(assessment.due);
    const year = dueDate.getFullYear();
    const dateStr = dueDate.toISOString().split('T')[0];
    goto(`/assessments?code=${assessment.code}&date=${dateStr}&year=${year}`);
  }

  const days = $derived(getDaysArray());
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  onMount(() => {
    loadAssessments();
  });
</script>

<div class="flex flex-col h-full min-h-0">
  <div
    class="flex items-center justify-between mb-3 sm:mb-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: center center;">
    <div class="flex items-center gap-2">
      <div
        class="transition-all duration-300"
        in:scale={{ duration: 300, delay: 100, easing: cubicInOut, start: 0.8 }}>
        <Icon
          src={CalendarDays}
          class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
      </div>
      <h3
        class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300"
        in:fade={{ duration: 300, delay: 150 }}>
        Deadlines Calendar
      </h3>
    </div>
    <div class="flex items-center gap-1 sm:gap-2">
      <button
        onclick={prevMonth}
        class="p-1 sm:p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95"
        aria-label="Previous month">
        <Icon src={ChevronLeft} class="w-3 h-3 sm:w-4 sm:h-4" />
      </button>
      <button
        onclick={goToToday}
        class="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-105 active:scale-95">
        Today
      </button>
      <button
        onclick={nextMonth}
        class="p-1 sm:p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95"
        aria-label="Next month">
        <Icon src={ChevronRight} class="w-3 h-3 sm:w-4 sm:h-4" />
      </button>
    </div>
  </div>

  {#if loading}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading...
      </p>
    </div>
  {:else}
    <div
      class="flex-1 overflow-y-auto min-h-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 400, delay: 100 }}>
      <!-- Month Header -->
      <div
        class="mb-2 text-center transition-all duration-300"
        in:fade={{ duration: 300, delay: 150 }}
        style="transform-origin: center center;">
        <h4 class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h4>
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 gap-1 text-xs sm:text-sm">
        <!-- Day headers -->
        {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day, i}
          <div
            class="p-1 sm:p-2 text-center font-semibold text-zinc-600 dark:text-zinc-400 transition-all duration-300"
            in:fade={{ duration: 200, delay: 200 + i * 30 }}>
            {day}
          </div>
        {/each}

        <!-- Calendar days -->
        {#each days as { date, assessments: dayAssessments }, i}
          <div
            class="min-h-[50px] sm:min-h-[60px] p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-md hover:scale-[1.02] transform {isToday(
              date,
            )
              ? 'bg-accent-100/90 dark:bg-accent-900/30 backdrop-blur-sm border-accent-500 shadow-sm'
              : 'bg-white/50 dark:bg-zinc-900/30'}"
            in:fade={{ duration: 200, delay: 250 + i * 10 }}
            style="transform-origin: center center;">
            <div
              class="text-xs font-medium mb-1 {isToday(date)
                ? 'text-accent-600 dark:text-accent-400'
                : 'text-zinc-600 dark:text-zinc-400'}">
              {date.getDate()}
            </div>
            <div class="space-y-1">
              {#each dayAssessments.slice(0, 2) as assessment, j}
                <button
                  onclick={() => handleAssessmentClick(assessment)}
                  class="w-full px-1 sm:px-1.5 py-0.5 text-xs rounded text-white truncate transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-105 active:scale-95 shadow-sm backdrop-blur-sm"
                  style="background-color: {assessment.colour}"
                  title={assessment.title}
                  in:fade={{ duration: 200, delay: 300 + j * 50 }}>
                  {assessment.title}
                </button>
              {/each}
              {#if dayAssessments.length > 2}
                <div class="text-xs text-zinc-500 dark:text-zinc-500">
                  +{dayAssessments.length - 2} more
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
