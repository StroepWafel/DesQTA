<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Button } from '../../ui';
  import { Icon, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import TimetableLessonBlock from './TimetableLessonBlock.svelte';
  import type { TimetableLesson, TimetableWidgetSettings } from '$lib/types/timetable';
  import { formatDate, parseDate, getDayIndex, getMonday } from '$lib/utils/timetableUtils';
  import { _ } from '$lib/i18n';

  interface Props {
    lessons: TimetableLesson[];
    selectedDate: Date;
    selectedLesson: TimetableLesson | null;
    onLessonClick: (lesson: TimetableLesson, element: HTMLElement) => void;
    onDateSelect: (date: Date) => void;
    settings: TimetableWidgetSettings;
  }

  let {
    lessons,
    selectedDate,
    selectedLesson,
    onLessonClick,
    onDateSelect,
    settings,
  }: Props = $props();

  const currentMonth = $derived(selectedDate.getMonth());
  const currentYear = $derived(selectedDate.getFullYear());
  const today = $derived(new Date());

  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number): number {
    return getDayIndex(new Date(year, month, 1));
  }

  function getCalendarDays(): Array<{ date: Date; isCurrentMonth: boolean; lessons: TimetableLesson[] }> {
    const days: Array<{ date: Date; isCurrentMonth: boolean; lessons: TimetableLesson[] }> = [];
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    
    // Previous month days
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(prevYear, prevMonth, daysInPrevMonth - i);
      days.push({
        date,
        isCurrentMonth: false,
        lessons: getLessonsForDate(date),
      });
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      days.push({
        date,
        isCurrentMonth: true,
        lessons: getLessonsForDate(date),
      });
    }
    
    // Next month days to fill the grid
    const totalCells = days.length;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const date = new Date(nextYear, nextMonth, day);
      days.push({
        date,
        isCurrentMonth: false,
        lessons: getLessonsForDate(date),
      });
    }
    
    return days;
  }

  function getLessonsForDate(date: Date): TimetableLesson[] {
    const dateStr = formatDate(date);
    return lessons
      .filter((lesson) => lesson.date === dateStr)
      .sort((a, b) => {
        const timeA = parseInt(a.from.replace(':', ''));
        const timeB = parseInt(b.from.replace(':', ''));
        return timeA - timeB;
      })
      .slice(0, 3); // Show max 3 lessons per day
  }

  function prevMonth() {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    onDateSelect(newDate);
  }

  function nextMonth() {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    onDateSelect(newDate);
  }

  function goToToday() {
    onDateSelect(new Date());
  }

  const calendarDays = $derived(getCalendarDays());
  const monthName = $derived(
    selectedDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
  );
  const weekDays = $derived([
    $_('timetable.monday') || 'Mon',
    $_('timetable.tuesday') || 'Tue',
    $_('timetable.wednesday') || 'Wed',
    $_('timetable.thursday') || 'Thu',
    $_('timetable.friday') || 'Fri',
    $_('timetable.saturday') || 'Sat',
    $_('timetable.sunday') || 'Sun',
  ]);
</script>

<div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
  <!-- Month Header -->
  <div
    class="flex justify-between items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
    <div class="flex gap-2 items-center">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        onclick={prevMonth}
        ariaLabel="Previous month"
        class="w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95" />
      
      <h2 class="text-xl font-bold text-zinc-900 dark:text-white min-w-[200px] text-center">
        {monthName}
      </h2>
      
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronRight}
        onclick={nextMonth}
        ariaLabel="Next month"
        class="w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95" />
      
      <Button
        variant="ghost"
        size="sm"
        onclick={goToToday}
        class="px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ml-2">
        {$_('timetable.today') || 'Today'}
      </Button>
    </div>
  </div>

  <!-- Calendar Grid -->
  <div class="flex-1 overflow-y-auto p-4">
    <div class="grid grid-cols-7 gap-2">
      <!-- Week Day Headers -->
      {#each weekDays as dayName}
        <div
          class="text-center text-sm font-semibold text-zinc-600 dark:text-zinc-400 py-2">
          {dayName}
        </div>
      {/each}

      <!-- Calendar Days -->
      {#each calendarDays as { date, isCurrentMonth, lessons: dayLessons }, index}
        {@const isToday = date.toDateString() === today.toDateString()}
        {@const isSelected = date.toDateString() === selectedDate.toDateString()}
        <button
          type="button"
          class="min-h-[100px] p-2 rounded-xl border transition-all duration-200 text-left {isCurrentMonth 
            ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600' 
            : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'} {isToday 
            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : ''} {isSelected 
            ? 'ring-2 ring-accent-500' 
            : ''} hover:scale-[1.02] active:scale-[0.98]"
          onclick={() => onDateSelect(date)}
          transition:fade={{ duration: 200, delay: index * 10 }}
          aria-label={date.toLocaleDateString()}>
          <div
            class="text-sm font-semibold mb-1 {isToday 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-zinc-900 dark:text-white'}">
            {date.getDate()}
          </div>
          <div class="space-y-1">
            {#each dayLessons.slice(0, 3) as lesson}
              <div
                class="text-xs p-1 rounded truncate"
                style="background-color: {lesson.colour}33; border-left: 2px solid {lesson.colour};">
                <div class="font-medium text-zinc-900 dark:text-white truncate">
                  {lesson.description}
                </div>
                <div class="text-zinc-600 dark:text-zinc-400 text-[10px]">
                  {lesson.from}
                </div>
              </div>
            {/each}
            {#if dayLessons.length > 3}
              <div class="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                +{dayLessons.length - 3} more
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>
