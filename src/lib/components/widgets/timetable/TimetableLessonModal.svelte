<script lang="ts">
  import { goto } from '$app/navigation';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Button } from '../../ui';
  import { Icon, XMark, BookOpen, DocumentText, CalendarDays, AcademicCap, BuildingOffice, Clock } from 'svelte-hero-icons';
  import type { TimetableLesson } from '$lib/types/timetable';
  import { formatDate, parseDate } from '$lib/utils/timetableUtils';

  interface Props {
    lesson: TimetableLesson | null;
    open: boolean;
    onClose: () => void;
  }

  let { lesson, open = $bindable(false), onClose }: Props = $props();

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

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

{#if open && lesson}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
    onclick={handleBackdropClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="lesson-modal-title"
    tabindex="-1">
    <!-- Modal -->
    <div
      class="relative w-full max-w-md rounded-2xl border shadow-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-zinc-200 dark:border-zinc-700 max-h-[90vh] overflow-y-auto"
      transition:scale={{ duration: 300, easing: cubicInOut }}
      style="border-left-color: {lesson.colour}; border-left-width: 4px;">
      <!-- Header -->
      <div class="sticky top-0 flex items-start justify-between p-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-10">
        <div class="flex-1 min-w-0">
          <h2
            id="lesson-modal-title"
            class="text-2xl font-bold text-zinc-900 dark:text-white mb-1 truncate">
            {lesson.description}
          </h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">{lesson.code}</p>
        </div>
        <button
          type="button"
          class="flex-shrink-0 p-2 rounded-lg transition-all duration-200 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95"
          onclick={onClose}
          aria-label="Close modal">
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-4">
        <!-- Date and Time -->
        <div class="flex items-start gap-3">
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
            <Icon src={Clock} class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Date & Time</p>
            <p class="text-base text-zinc-900 dark:text-white">{formatLessonDate(lesson.date)}</p>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              {lesson.from} - {lesson.until}
            </p>
          </div>
        </div>

        <!-- Teacher -->
        {#if lesson.staff}
          <div class="flex items-start gap-3">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0">
              <Icon src={AcademicCap} class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Teacher</p>
              <p class="text-base text-zinc-900 dark:text-white truncate">{lesson.staff}</p>
            </div>
          </div>
        {/if}

        <!-- Room -->
        {#if lesson.room}
          <div class="flex items-start gap-3">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0">
              <Icon src={BuildingOffice} class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Room</p>
              <p class="text-base text-zinc-900 dark:text-white">Room {lesson.room}</p>
            </div>
          </div>
        {/if}

        <!-- Attendance -->
        {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
          <div class="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              Attendance Status
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-300">{lesson.attendanceTitle}</p>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="sticky bottom-0 p-6 border-t border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md space-y-2">
        {#if lesson.programmeID !== 0}
          <Button
            variant="primary"
            class="w-full justify-center gap-2"
            icon={BookOpen}
            onclick={handleViewCourse}>
            View Course
          </Button>
          <Button
            variant="secondary"
            class="w-full justify-center gap-2"
            icon={DocumentText}
            onclick={handleViewAssessments}>
            View Assessments
          </Button>
        {/if}
        <Button
          variant="ghost"
          class="w-full justify-center gap-2"
          icon={CalendarDays}
          onclick={handleViewTimetable}>
          View Full Timetable
        </Button>
      </div>
    </div>
  </div>
{/if}
