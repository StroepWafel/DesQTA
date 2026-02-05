<script lang="ts">
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Button } from '../../ui';
  import { Icon, BookOpen, DocumentText, CalendarDays, AcademicCap, BuildingOffice, Clock } from 'svelte-hero-icons';
  import type { TimetableLesson } from '$lib/types/timetable';
  import { formatDate, parseDate } from '$lib/utils/timetableUtils';
  import { tick } from 'svelte';

  interface Props {
    lesson: TimetableLesson | null;
    open: boolean;
    anchorElement: HTMLElement | null;
    onClose: () => void;
  }

  let { lesson, open = $bindable(false), anchorElement, onClose }: Props = $props();

  let popoutElement: HTMLDivElement | null = $state(null);
  let position = $state({ top: 0, left: 0 });
  let transitionDirection = $state<'up' | 'down'>('down');

  function formatLessonDate(date: string | Date): string {
    if (typeof date === 'string') {
      const d = parseDate(date);
      return d.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function updatePosition() {
    if (!anchorElement || !popoutElement) return;

    const anchorRect = anchorElement.getBoundingClientRect();
    const popoutRect = popoutElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 8;
    const margin = 16;

    // Try positioning below first
    let top = anchorRect.bottom + spacing;
    let left = anchorRect.left;

    // Check if it fits below
    const fitsBelow = top + popoutRect.height <= viewportHeight - margin;
    let direction: 'up' | 'down' = 'down';
    
    // If it doesn't fit below, try above
    if (!fitsBelow) {
      top = anchorRect.top - popoutRect.height - spacing;
      direction = 'up';
      // If it doesn't fit above either, center it vertically in viewport
      if (top < margin) {
        top = Math.max(margin, Math.min(viewportHeight - popoutRect.height - margin, (viewportHeight - popoutRect.height) / 2));
        direction = 'down'; // Default direction when centered
      }
    }

    // Align horizontally - align with left edge of anchor
    // If it doesn't fit to the right, align with right edge of anchor
    if (left + popoutRect.width > viewportWidth - margin) {
      left = anchorRect.right - popoutRect.width;
      // If still doesn't fit, center horizontally
      if (left < margin) {
        left = Math.max(margin, Math.min(viewportWidth - popoutRect.width - margin, (viewportWidth - popoutRect.width) / 2));
      }
    }

    // Ensure it doesn't go off-screen on the left
    if (left < margin) {
      left = margin;
    }

    // Ensure it doesn't go off-screen on the right
    if (left + popoutRect.width > viewportWidth - margin) {
      left = viewportWidth - popoutRect.width - margin;
    }

    position = { top, left };
    transitionDirection = direction;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      popoutElement &&
      anchorElement &&
      !popoutElement.contains(event.target as Node) &&
      !anchorElement.contains(event.target as Node)
    ) {
      onClose();
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  $effect(() => {
    if (open && anchorElement) {
      // Wait for element to be rendered before calculating position
      tick().then(() => {
        if (popoutElement) {
          updatePosition();
        }
      });
    }
  });

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  });

  async function handleViewCourse() {
    if (!lesson) return;
    const formattedDate = formatDate(parseDate(lesson.date));
    await goto(`/courses?code=${lesson.code}&date=${formattedDate}`);
    onClose();
  }

  async function handleViewAssessments() {
    if (!lesson) return;
    const formattedDate = formatDate(parseDate(lesson.date));
    const lessonYear = parseDate(lesson.date).getFullYear();
    await goto(`/assessments?code=${lesson.code}&date=${formattedDate}&year=${lessonYear}`);
    onClose();
  }

  async function handleViewTimetable() {
    if (!lesson) return;
    const formattedDate = formatDate(parseDate(lesson.date));
    await goto(`/timetable?date=${formattedDate}`);
    onClose();
  }
</script>

{#if open && lesson && anchorElement}
  {#key lesson.id}
    <div
      bind:this={popoutElement}
      class="fixed z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-zinc-200 dark:border-zinc-700 max-h-[calc(100vh-2rem)] overflow-y-auto"
      style="top: {position.top}px; left: {position.left}px; border-left-color: {lesson.colour}; border-left-width: 4px;"
      transition:fly={{ y: transitionDirection === 'down' ? -10 : 10, duration: 200, easing: cubicInOut }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-popout-title">
    <!-- Header -->
    <div class="flex items-start justify-between p-4 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
      <div class="flex-1 min-w-0 pr-2">
        <h2
          id="lesson-popout-title"
          class="text-lg font-bold text-zinc-900 dark:text-white mb-0.5 truncate">
          {lesson.description}
        </h2>
        <p class="text-xs text-zinc-600 dark:text-zinc-400 truncate">{lesson.code}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-3">
      <!-- Date and Time -->
      <div class="flex items-start gap-2">
        <div
          class="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
          <Icon src={Clock} class="w-4 h-4" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Date & Time</p>
          <p class="text-sm text-zinc-900 dark:text-white">{formatLessonDate(lesson.date)}</p>
          <p class="text-xs text-zinc-600 dark:text-zinc-400">
            {lesson.from} - {lesson.until}
          </p>
        </div>
      </div>

      <!-- Teacher -->
      {#if lesson.staff}
        <div class="flex items-start gap-2">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0">
            <Icon src={AcademicCap} class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Teacher</p>
            <p class="text-sm text-zinc-900 dark:text-white truncate">{lesson.staff}</p>
          </div>
        </div>
      {/if}

      <!-- Room -->
      {#if lesson.room}
        <div class="flex items-start gap-2">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0">
            <Icon src={BuildingOffice} class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Room</p>
            <p class="text-sm text-zinc-900 dark:text-white">Room {lesson.room}</p>
          </div>
        </div>
      {/if}

      <!-- Attendance -->
      {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
        <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p class="text-xs font-medium text-amber-800 dark:text-amber-200 mb-0.5">
            Attendance Status
          </p>
          <p class="text-xs text-amber-700 dark:text-amber-300">{lesson.attendanceTitle}</p>
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md space-y-2">
      {#if lesson.programmeID !== 0}
        <Button
          variant="primary"
          class="w-full justify-center gap-2 text-sm py-2"
          icon={BookOpen}
          onclick={handleViewCourse}>
          View Course
        </Button>
        <Button
          variant="secondary"
          class="w-full justify-center gap-2 text-sm py-2"
          icon={DocumentText}
          onclick={handleViewAssessments}>
          View Assessments
        </Button>
      {/if}
      <Button
        variant="ghost"
        class="w-full justify-center gap-2 text-sm py-2"
        icon={CalendarDays}
        onclick={handleViewTimetable}>
        View Full Timetable
      </Button>
    </div>
    </div>
  {/key}
{/if}
