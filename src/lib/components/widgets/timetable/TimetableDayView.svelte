<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, tick } from 'svelte';
  import TimetableLessonBlock from './TimetableLessonBlock.svelte';
  import { Button } from '../../ui';
  import EmptyState from '../../EmptyState.svelte';
  import { ChevronLeft, ChevronRight, CalendarDays } from 'svelte-hero-icons';
  import type { TimetableLesson, TimetableWidgetSettings } from '$lib/types/timetable';
  import {
    calculateLessonPosition,
    getCurrentTimeIndicator,
    formatTime12Hour,
    getPaddedLessonTimeRange,
    getClockHourMarkersInRange,
    TIMETABLE_DEFAULT_TIME_RANGE,
    normalizeTimeToHm,
    timeToMinutes,
    getDayIndex,
    formatDate,
    layoutDayLessonColumns,
    timetableLessonLayoutKey,
    timetableLessonColumnStyles,
  } from '$lib/utils/timetableUtils';
  import { _ } from '$lib/i18n';

  const TIME_GUTTER_PX = 56;

  interface Props {
    lessons: TimetableLesson[];
    selectedDate: Date;
    selectedLesson: TimetableLesson | null;
    onLessonClick: (
      lesson: TimetableLesson,
      element: HTMLElement,
      anchorRect?: {
        top: number;
        left: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
      },
    ) => void;
    onDateChange: (date: Date) => void;
    settings: TimetableWidgetSettings;
  }

  let { lessons, selectedDate, selectedLesson, onLessonClick, onDateChange, settings }: Props =
    $props();

  let gridContainer: HTMLDivElement | null = $state(null);
  let gridHeight = $state(800);
  let currentTimePosition = $state<number | null>(null);
  let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  const dayLabels = $derived([
    $_('timetable.monday') || 'Monday',
    $_('timetable.tuesday') || 'Tuesday',
    $_('timetable.wednesday') || 'Wednesday',
    $_('timetable.thursday') || 'Thursday',
    $_('timetable.friday') || 'Friday',
  ]);

  const today = $derived(new Date());
  const isToday = $derived(selectedDate.toDateString() === today.toDateString());
  const dayName = $derived(dayLabels[getDayIndex(selectedDate)] || '');

  const dayLessons = $derived(
    lessons
      .filter((lesson) => lesson.date === formatDate(selectedDate))
      .sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from)),
  );

  /** Match week view: scale from earliest start to latest end across the whole loaded week */
  const timeRange = $derived(
    lessons.length > 0
      ? getPaddedLessonTimeRange(lessons, 0.05, settings.timeRange ?? TIMETABLE_DEFAULT_TIME_RANGE)
      : (settings.timeRange ?? TIMETABLE_DEFAULT_TIME_RANGE),
  );

  const gridBodyHeight = $derived.by(() => {
    const viewportOrMeasure = Math.max(gridHeight, 1);
    if (dayLessons.length === 0) return viewportOrMeasure;
    let H = viewportOrMeasure;
    for (let i = 0; i < 5; i++) {
      let maxBottom = 0;
      for (const l of dayLessons) {
        const { top, height } = calculateLessonPosition(l, timeRange, H);
        maxBottom = Math.max(maxBottom, top + height);
      }
      const next = Math.max(viewportOrMeasure, Math.ceil(maxBottom) + 24);
      if (Math.abs(next - H) <= 1) return next;
      H = next;
    }
    return H;
  });

  const paintHeight = $derived(Math.max(gridBodyHeight, gridHeight));

  const timeAxisMarkers = $derived(getClockHourMarkersInRange(timeRange));

  function updateCurrentTime() {
    const position = getCurrentTimeIndicator(timeRange, paintHeight);
    currentTimePosition = position;
  }

  function timeToY(time: string): number {
    const startMinutes = timeToMinutes(normalizeTimeToHm(timeRange.start));
    const endMinutes = timeToMinutes(normalizeTimeToHm(timeRange.end));
    const rangeMinutes = Math.max(1, endMinutes - startMinutes);
    const timeMinutes = timeToMinutes(normalizeTimeToHm(time));

    return ((timeMinutes - startMinutes) / rangeMinutes) * paintHeight;
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
    timeUpdateInterval = setInterval(() => {
      updateCurrentTime();
    }, 60000);

    return () => {
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
    };
  });

  $effect(() => {
    const el = gridContainer;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      gridHeight = el.clientHeight;
    });
    ro.observe(el);
    gridHeight = el.clientHeight;

    return () => {
      ro.disconnect();
    };
  });

  $effect(() => {
    lessons;
    selectedDate;
    void tick().then(() =>
      requestAnimationFrame(() => {
        if (gridContainer) {
          gridHeight = gridContainer.clientHeight;
        }
        updateCurrentTime();
      }),
    );
  });

  const timeGutterStyle = `${TIME_GUTTER_PX}px`;
  const lessonsInset = `${TIME_GUTTER_PX}px`;
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
        class="min-h-[44px] min-w-[44px] w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95" />

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
        class="min-h-[44px] min-w-[44px] w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95" />

      {#if !isToday}
        <Button
          variant="ghost"
          size="sm"
          onclick={goToToday}
          class="min-h-[44px] px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95">
          {$_('timetable.today') || 'Today'}
        </Button>
      {/if}
    </div>
  </div>

  <!-- Grid Container -->
  <div
    class="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden relative isolate"
    bind:this={gridContainer}>
    <div
      class="relative w-full min-h-full"
      style="height: {paintHeight}px; min-height: 100%;">
        <!-- Time Labels -->
        <div
          class="absolute top-0 left-0 z-10 h-full pointer-events-none"
          style="width: {timeGutterStyle};">
          {#each timeAxisMarkers as timeSlot}
            {@const yPos = timeToY(timeSlot)}
            <div
              class="absolute left-0 w-full border-t border-zinc-200 dark:border-zinc-700"
              style="top: {yPos}px;">
              <div class="flex items-center justify-center h-5 -mt-2.5">
                <span
                  class="text-[11px] font-mono font-semibold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-0.5 rounded-sm">
                  {formatTime12Hour(timeSlot)}
                </span>
              </div>
            </div>
          {/each}
        </div>

        <!-- Current Time Indicator -->
        {#if currentTimePosition !== null && isToday}
          <div
            class="absolute right-0 z-20 pointer-events-none"
            style="top: {currentTimePosition}px; left: {lessonsInset};">
            <div class="flex items-center h-0.5">
              <div class="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
              <div class="flex-1 h-0.5 bg-red-500"></div>
            </div>
          </div>
        {/if}

        <!-- Lessons Column -->
        <div
          class="absolute top-0 right-0 h-full min-w-0 px-1.5 sm:px-2"
          style="left: {lessonsInset};">
          {#if dayLessons.length === 0}
            <div
              class="flex flex-col justify-center items-center h-full py-16"
              transition:fade={{ duration: 200 }}>
              <EmptyState
                title={$_('timetable.no_lessons_today') || 'No Lessons Today'}
                message={$_('timetable.no_lessons_message') || 'Enjoy your free time!'}
                icon={CalendarDays}
                size="lg" />
            </div>
          {:else}
            {@const overlapLayout = layoutDayLessonColumns(dayLessons)}
            {#each dayLessons as lesson, index}
              {@const position = calculateLessonPosition(lesson, timeRange, paintHeight)}
              {@const ly = overlapLayout.get(timetableLessonLayoutKey(lesson)) ?? {
                columnIndex: 0,
                columnCount: 1,
              }}
              {@const hz = timetableLessonColumnStyles(ly)}
              {@const colHasOverlap = ly.columnCount > 1}
              {@const zIndex = (lesson.slotType && lesson.slotType !== 'class' ? 50 : 30) + (colHasOverlap ? 5 : 0)}
              <div
                class="absolute min-h-0 overflow-hidden rounded-lg"
                style="top: {position.top}px; height: {position.height}px; left: {hz.left}; width: {hz.width}; z-index: {zIndex};"
                transition:fade={{ duration: 200, delay: index * 50 }}>
                <TimetableLessonBlock
                  {lesson}
                  overlap={colHasOverlap}
                  onClick={onLessonClick}
                  showTeacher={settings.showTeacher ?? true}
                  showRoom={settings.showRoom ?? true}
                  showAttendance={settings.showAttendance ?? true}
                  density={settings.density === 'comfortable'
                    ? colHasOverlap
                      ? 'normal'
                      : 'comfortable'
                    : colHasOverlap
                      ? 'compact'
                      : settings.density || 'normal'}
                  variant="grid"
                  slotHeightPx={position.height}
                />
              </div>
            {/each}
          {/if}
        </div>
      </div>
  </div>
</div>
