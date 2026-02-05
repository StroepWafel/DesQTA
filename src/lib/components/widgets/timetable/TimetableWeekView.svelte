<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy, tick } from 'svelte';
  import TimetableLessonBlock from './TimetableLessonBlock.svelte';
  import type { TimetableLesson, TimetableWidgetSettings } from '$lib/types/timetable';
  import {
    calculateLessonPosition,
    getCurrentTimeIndicator,
    groupLessonsByTime,
    formatTime12Hour,
    calculateTimeBounds,
    timeToMinutes,
    getDayIndex,
    getMonday,
    formatDate,
    parseDate,
  } from '$lib/utils/timetableUtils';
  import { _ } from '$lib/i18n';

  interface Props {
    lessons: TimetableLesson[];
    weekStart: Date;
    selectedLesson: TimetableLesson | null;
    onLessonClick: (lesson: TimetableLesson, element: HTMLElement) => void;
    settings: TimetableWidgetSettings;
  }

  let {
    lessons,
    weekStart,
    selectedLesson,
    onLessonClick,
    settings,
  }: Props = $props();

  let gridContainer: HTMLDivElement | null = $state(null);
  let gridHeight = $state(800);
  let currentTimePosition = $state<number | null>(null);
  let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  const timeRange = $derived(
    settings.timeRange || calculateTimeBounds(lessons),
  );

  const dayLabels = $derived([
    $_('timetable.monday') || 'Monday',
    $_('timetable.tuesday') || 'Tuesday',
    $_('timetable.wednesday') || 'Wednesday',
    $_('timetable.thursday') || 'Thursday',
    $_('timetable.friday') || 'Friday',
  ]);

  const today = $derived(new Date());
  const todayDayIndex = $derived(getDayIndex(today));

  function updateGridHeight() {
    if (gridContainer) {
      gridHeight = gridContainer.clientHeight;
    }
  }

  function updateCurrentTime() {
    const position = getCurrentTimeIndicator(timeRange, gridHeight);
    currentTimePosition = position;
  }

  function getLessonsForDay(dayIdx: number): TimetableLesson[] {
    const monday = getMonday(weekStart);
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIdx);
    const dateStr = formatDate(targetDate);

    return lessons
      .filter((lesson) => lesson.date === dateStr)
      .sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
  }

  function getLessonsGroupedByTimeForDay(dayIdx: number): Array<{
    timeKey: string;
    lessons: TimetableLesson[];
    from: string;
    until: string;
  }> {
    const dayLessons = getLessonsForDay(dayIdx);
    const grouped = groupLessonsByTime(dayLessons);
    
    return Array.from(grouped.entries()).map(([timeKey, lessons]: [string, TimetableLesson[]]) => ({
      timeKey,
      lessons,
      from: lessons[0].from,
      until: lessons[0].until,
    }));
  }

  function timeToY(time: string): number {
    const startMinutes = timeToMinutes(timeRange.start);
    const endMinutes = timeToMinutes(timeRange.end);
    const rangeMinutes = endMinutes - startMinutes;
    const timeMinutes = timeToMinutes(time);
    
    return ((timeMinutes - startMinutes) / rangeMinutes) * gridHeight;
  }

  function generateTimeSlots(): string[] {
    const slots: string[] = [];
    const start = timeToMinutes(timeRange.start);
    const end = timeToMinutes(timeRange.end);
    
    for (let minutes = start; minutes <= end; minutes += 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
    
    return slots;
  }

  onMount(() => {
    updateGridHeight();
    updateCurrentTime();
    
    const resizeObserver = new ResizeObserver(() => {
      updateGridHeight();
      updateCurrentTime();
    });
    
    if (gridContainer) {
      resizeObserver.observe(gridContainer);
    }

    // Update current time every minute
    timeUpdateInterval = setInterval(() => {
      updateCurrentTime();
    }, 60000);

    return () => {
      resizeObserver.disconnect();
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
    };
  });

  $effect(() => {
    updateGridHeight();
    updateCurrentTime();
  });
</script>

<div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
  <!-- Day Headers -->
  <div
    class="grid grid-cols-[60px_repeat(5,1fr)] gap-2 px-2 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
    <div class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase"></div>
    {#each dayLabels as dayLabel, dayIdx}
      <div
        class="text-center transition-all duration-200 {todayDayIndex === dayIdx 
          ? 'accent-bg text-white rounded-lg px-2 py-1 shadow-md' 
          : 'text-zinc-700 dark:text-zinc-300'}">
        <div class="font-semibold">{dayLabel}</div>
      </div>
    {/each}
  </div>

  <!-- Grid Container -->
  <div class="flex-1 overflow-y-auto relative" bind:this={gridContainer}>
    {#if gridContainer}
      <div class="relative w-full h-full" style="height: {gridHeight}px;">
        <!-- Time Labels -->
        <div class="absolute top-0 left-0 z-10 w-[60px] h-full pointer-events-none">
          {#each generateTimeSlots() as timeSlot}
            {@const yPos = timeToY(timeSlot)}
            <div
              class="absolute left-0 w-full border-t border-zinc-200 dark:border-zinc-700"
              style="top: {yPos}px;">
              <div class="flex items-center justify-center h-5 -mt-2.5">
                <span
                  class="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-1 rounded-sm">
                  {formatTime12Hour(timeSlot)}
                </span>
              </div>
            </div>
          {/each}
        </div>

        <!-- Current Time Indicator -->
        {#if currentTimePosition !== null}
          <div
            class="absolute left-[60px] right-0 z-20 pointer-events-none"
            style="top: {currentTimePosition}px;">
            <div class="flex items-center h-0.5">
              <div class="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
              <div class="flex-1 h-0.5 bg-red-500"></div>
            </div>
          </div>
        {/if}

        <!-- Day Columns -->
        <div
          class="grid absolute top-0 right-0 left-[60px] grid-cols-5 gap-2 h-full px-2">
          {#each Array(5) as _, dayIdx}
            <div
              class="relative h-full border-l border-zinc-200 dark:border-zinc-700 {todayDayIndex === dayIdx 
                ? 'bg-[var(--accent)]/10 dark:bg-[var(--accent)]/10' 
                : ''}"
              transition:fade={{ duration: 200, delay: dayIdx * 100 }}>
              {#each getLessonsGroupedByTimeForDay(dayIdx) as lessonGroup}
                {@const position = calculateLessonPosition(
                  lessonGroup.lessons[0],
                  timeRange,
                  gridHeight,
                )}
                <div
                  class="absolute right-0 left-0"
                  style="top: {position.top}px; height: {position.height}px;"
                  transition:fade={{ duration: 200 }}>
                  {#if lessonGroup.lessons.length === 1}
                    <TimetableLessonBlock
                      lesson={lessonGroup.lessons[0]}
                      onClick={onLessonClick}
                      showTeacher={settings.showTeacher ?? true}
                      showRoom={settings.showRoom ?? true}
                      showAttendance={settings.showAttendance ?? true}
                      density={settings.density || 'normal'} />
                  {:else}
                    <div class="flex gap-1 h-full p-1">
                      {#each lessonGroup.lessons as lesson}
                        <div class="flex-1 min-w-0">
                          <TimetableLessonBlock
                            lesson={lesson}
                            onClick={onLessonClick}
                            overlap={true}
                            showTeacher={settings.showTeacher ?? true}
                            showRoom={settings.showRoom ?? true}
                            showAttendance={settings.showAttendance ?? true}
                            density={settings.density || 'normal'} />
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
