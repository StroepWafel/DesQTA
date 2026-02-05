<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import TimetableLessonBlock from './TimetableLessonBlock.svelte';
  import { Button } from '../../ui';
  import { Icon, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import type { TimetableLesson, TimetableWidgetSettings } from '$lib/types/timetable';
  import {
    calculateLessonPosition,
    getCurrentTimeIndicator,
    formatTime12Hour,
    calculateTimeBounds,
    timeToMinutes,
    getDayIndex,
    formatDate,
    parseDate,
  } from '$lib/utils/timetableUtils';
  import { _ } from '$lib/i18n';

  interface Props {
    lessons: TimetableLesson[];
    selectedDate: Date;
    selectedLesson: TimetableLesson | null;
    onLessonClick: (lesson: TimetableLesson, element: HTMLElement) => void;
    onDateChange: (date: Date) => void;
    settings: TimetableWidgetSettings;
  }

  let {
    lessons,
    selectedDate,
    selectedLesson,
    onLessonClick,
    onDateChange,
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
  const isToday = $derived(
    selectedDate.toDateString() === today.toDateString(),
  );
  const dayName = $derived(dayLabels[getDayIndex(selectedDate)] || '');

  const dayLessons = $derived(
    lessons
      .filter((lesson) => lesson.date === formatDate(selectedDate))
      .sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from)),
  );

  function updateGridHeight() {
    if (gridContainer) {
      gridHeight = gridContainer.clientHeight;
    }
  }

  function updateCurrentTime() {
    const position = getCurrentTimeIndicator(timeRange, gridHeight);
    currentTimePosition = position;
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

  function prevDay() {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    onDateChange(newDate);
  }

  function nextDay() {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 1);
    onDateChange(newDate);
  }

  function goToToday() {
    onDateChange(new Date());
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
  <!-- Day Header -->
  <div
    class="flex justify-between items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
    <div class="flex gap-2 items-center">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        onclick={prevDay}
        ariaLabel={$_('timetable.previous_day') || 'Previous day'}
        class="w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95" />
      
      <div class="text-center min-w-[200px]">
        <h2
          class="text-xl font-bold text-zinc-900 dark:text-white {isToday 
            ? 'text-blue-600 dark:text-blue-400' 
            : ''}">
          {dayName}
        </h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          {selectedDate.toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronRight}
        onclick={nextDay}
        ariaLabel={$_('timetable.next_day') || 'Next day'}
        class="w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95" />
      
      {#if !isToday}
        <Button
          variant="ghost"
          size="sm"
          onclick={goToToday}
          class="px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95">
          {$_('timetable.today') || 'Today'}
        </Button>
      {/if}
    </div>
  </div>

  <!-- Grid Container -->
  <div class="flex-1 overflow-y-auto relative" bind:this={gridContainer}>
    {#if gridContainer}
      <div class="relative w-full h-full" style="height: {gridHeight}px;">
        <!-- Time Labels -->
        <div class="absolute top-0 left-0 z-10 w-[80px] h-full pointer-events-none">
          {#each generateTimeSlots() as timeSlot}
            {@const yPos = timeToY(timeSlot)}
            <div
              class="absolute left-0 w-full border-t border-zinc-200 dark:border-zinc-700"
              style="top: {yPos}px;">
              <div class="flex items-center justify-center h-5 -mt-2.5">
                <span
                  class="text-sm font-mono font-semibold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2 rounded-sm">
                  {formatTime12Hour(timeSlot)}
                </span>
              </div>
            </div>
          {/each}
        </div>

        <!-- Current Time Indicator -->
        {#if currentTimePosition !== null && isToday}
          <div
            class="absolute left-[80px] right-0 z-20 pointer-events-none"
            style="top: {currentTimePosition}px;">
            <div class="flex items-center h-0.5">
              <div class="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
              <div class="flex-1 h-0.5 bg-red-500"></div>
            </div>
          </div>
        {/if}

        <!-- Lessons Column -->
        <div class="absolute top-0 right-0 left-[80px] h-full px-4">
          {#if dayLessons.length === 0}
            <div
              class="flex flex-col justify-center items-center h-full py-16"
              transition:fade={{ duration: 200 }}>
              <div
                class="w-24 h-24 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-4xl shadow-lg mb-6">
                📚
              </div>
              <h3 class="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                {$_('timetable.no_lessons_today') || 'No Lessons Today'}
              </h3>
              <p class="text-zinc-600 dark:text-zinc-400 text-center max-w-md">
                {$_('timetable.no_lessons_message') || 'Enjoy your free time!'}
              </p>
            </div>
          {:else}
            {#each dayLessons as lesson, index}
              {@const position = calculateLessonPosition(lesson, timeRange, gridHeight)}
              <div
                class="absolute right-0 left-0"
                style="top: {position.top}px; height: {position.height}px;"
                transition:fade={{ duration: 200, delay: index * 50 }}>
                <TimetableLessonBlock
                  lesson={lesson}
                  onClick={onLessonClick}
                  showTeacher={settings.showTeacher ?? true}
                  showRoom={settings.showRoom ?? true}
                  showAttendance={settings.showAttendance ?? true}
                  density={settings.density === 'comfortable' ? 'comfortable' : 'normal'} />
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
