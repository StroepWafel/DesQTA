<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, tick } from 'svelte';
  import TimetableLessonBlock from './TimetableLessonBlock.svelte';
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
    getMonday,
    formatDate,
    layoutDayLessonColumns,
    timetableLessonLayoutKey,
    timetableLessonColumnStyles,
  } from '$lib/utils/timetableUtils';
  import { _ } from '$lib/i18n';

  /** Left time axis — keep narrow so day columns widen */
  const TIME_GUTTER_PX = 52;

  interface Props {
    lessons: TimetableLesson[];
    weekStart: Date;
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
    settings: TimetableWidgetSettings;
  }

  let { lessons, weekStart, selectedLesson, onLessonClick, settings }: Props = $props();

  let gridContainer: HTMLDivElement | null = $state(null);
  let gridHeight = $state(800);
  let currentTimePosition = $state<number | null>(null);
  let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

  const timeRange = $derived(
    lessons.length > 0
      ? getPaddedLessonTimeRange(lessons, 0.05, settings.timeRange ?? TIMETABLE_DEFAULT_TIME_RANGE)
      : (settings.timeRange ?? TIMETABLE_DEFAULT_TIME_RANGE),
  );

  /** Lessons need at least this many pixels (iterative stretch / bottom padding). */
  const gridBodyHeight = $derived.by(() => {
    const viewportOrMeasure = Math.max(gridHeight, 1);
    if (lessons.length === 0) return viewportOrMeasure;
    let H = viewportOrMeasure;
    for (let i = 0; i < 5; i++) {
      let maxBottom = 0;
      for (const l of lessons) {
        const { top, height } = calculateLessonPosition(l, timeRange, H);
        maxBottom = Math.max(maxBottom, top + height);
      }
      const next = Math.max(viewportOrMeasure, Math.ceil(maxBottom) + 24);
      if (Math.abs(next - H) <= 1) return next;
      H = next;
    }
    return H;
  });

  /**
   * Never shorter than scrollport height — avoids a transparent gap (main layout shows through)
   * when measurement lags or the fixed-point height is lesson-only.
   */
  const paintHeight = $derived(Math.max(gridBodyHeight, gridHeight));

  /** SEQTA-style: one label each whole hour across the scaled week range */
  const timeAxisMarkers = $derived(getClockHourMarkersInRange(timeRange));

  const dayLabels = $derived([
    $_('timetable.monday') || 'Monday',
    $_('timetable.tuesday') || 'Tuesday',
    $_('timetable.wednesday') || 'Wednesday',
    $_('timetable.thursday') || 'Thursday',
    $_('timetable.friday') || 'Friday',
  ]);

  const today = $derived(new Date());
  const todayDayIndex = $derived(getDayIndex(today));

  const timeGutterStyle = `${TIME_GUTTER_PX}px`;
  const dayGridInset = `${TIME_GUTTER_PX}px`;

  function updateCurrentTime() {
    const position = getCurrentTimeIndicator(timeRange, paintHeight);
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

  function timeToY(time: string): number {
    const startMinutes = timeToMinutes(normalizeTimeToHm(timeRange.start));
    const endMinutes = timeToMinutes(normalizeTimeToHm(timeRange.end));
    const rangeMinutes = Math.max(1, endMinutes - startMinutes);
    const timeMinutes = timeToMinutes(normalizeTimeToHm(time));

    return ((timeMinutes - startMinutes) / rangeMinutes) * paintHeight;
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

  /** Re-observe when bind:this attaches (onMount ran too early previously). */
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
    weekStart;
    void tick().then(() =>
      requestAnimationFrame(() => {
        if (gridContainer) {
          gridHeight = gridContainer.clientHeight;
        }
        updateCurrentTime();
      }),
    );
  });
</script>

<div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
  <!-- Day Headers -->
  <div
    class="grid gap-1.5 px-1.5 py-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50"
    style="grid-template-columns: {timeGutterStyle} repeat(5, minmax(0, 1fr));">
    <div class="text-xs font-semibold text-muted-foreground uppercase"></div>
    {#each dayLabels as dayLabel, dayIdx}
      <div
        class="text-center transition-all duration-200 {todayDayIndex === dayIdx
          ? 'accent-bg text-white rounded-lg px-2 py-1 shadow-md'
          : 'text-foreground'}">
        <div class="font-semibold">{dayLabel}</div>
      </div>
    {/each}
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
              class="absolute left-0 w-full border-t border-border"
              style="top: {yPos}px;">
              <div class="flex items-center justify-center h-5 -mt-2.5">
                <span
                  class="text-[11px] font-mono font-semibold text-muted-foreground bg-white dark:bg-zinc-900 px-0.5 rounded-sm">
                  {formatTime12Hour(timeSlot)}
                </span>
              </div>
            </div>
          {/each}
        </div>

        <!-- Current Time Indicator -->
        {#if currentTimePosition !== null}
          <div
            class="absolute z-20 pointer-events-none"
            style="top: {currentTimePosition}px; left: {dayGridInset}; right: 0;">
            <div class="flex items-center h-0.5">
              <div class="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
              <div class="flex-1 h-0.5 bg-red-500"></div>
            </div>
          </div>
        {/if}

        <!-- Day Columns -->
        <div
          class="grid absolute top-0 right-0 h-full px-1.5 gap-1.5"
          style="left: {dayGridInset}; grid-template-columns: repeat(5, minmax(0, 1fr));">
          {#each Array(5) as _, dayIdx}
            {@const dayList = getLessonsForDay(dayIdx)}
            {@const overlapLayout = layoutDayLessonColumns(dayList)}
            <div
              class="relative h-full border-l border-border min-w-0 {todayDayIndex ===
              dayIdx
                ? 'bg-[var(--accent)]/10 dark:bg-[var(--accent)]/10'
                : ''}"
              transition:fade={{ duration: 200, delay: dayIdx * 100 }}>
              {#each dayList as lesson}
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
                  transition:fade={{ duration: 200 }}>
                  <TimetableLessonBlock
                    {lesson}
                    onClick={onLessonClick}
                    overlap={colHasOverlap}
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
            </div>
          {/each}
        </div>
      </div>
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
