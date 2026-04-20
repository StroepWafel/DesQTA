<script lang="ts">
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Icon, BookOpen, DocumentText } from 'svelte-hero-icons';
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

  const HEADER_OFFSET = 72; // Min top to avoid app + timetable header

  function updatePosition() {
    if (!anchorElement || !popoutElement) return;

    const anchorRect = anchorElement.getBoundingClientRect();
    const popoutRect = popoutElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 8;
    const margin = 16;

    // Prefer below anchor; only go above if it fits and stays below header
    let top = anchorRect.bottom + spacing;
    let direction: 'up' | 'down' = 'down';
    const fitsBelow = top + popoutRect.height <= viewportHeight - margin;
    const aboveTop = anchorRect.top - popoutRect.height - spacing;
    const fitsAbove = aboveTop >= HEADER_OFFSET;

    if (!fitsBelow && fitsAbove) {
      top = aboveTop;
      direction = 'up';
    } else if (!fitsBelow && !fitsAbove) {
      // Neither fits well: keep below but clamp, or center in content area
      top = Math.max(HEADER_OFFSET, Math.min(viewportHeight - popoutRect.height - margin, anchorRect.bottom + spacing));
      direction = 'down';
    }

    // Never go under header
    if (top < HEADER_OFFSET) {
      top = HEADER_OFFSET;
    }

    // Horizontal: align with anchor, keep in viewport
    let left = anchorRect.left;
    if (left + popoutRect.width > viewportWidth - margin) {
      left = anchorRect.right - popoutRect.width;
    }
    if (left < margin) left = margin;
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

</script>

{#if open && lesson && anchorElement}
  {#key lesson.id}
    <div
      bind:this={popoutElement}
      class="fixed z-[200] w-64 max-w-[calc(100vw-2rem)] rounded-xl border shadow-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 max-h-[calc(100vh-6rem)] overflow-y-auto"
      style="top: {position.top}px; left: {position.left}px; border-left: 3px solid {lesson.colour};"
      transition:fly={{
        y: transitionDirection === 'down' ? -6 : 6,
        duration: 150,
        easing: cubicInOut,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-popout-title">
      <div class="p-3">
        <h2 id="lesson-popout-title" class="text-sm font-semibold text-zinc-900 dark:text-white truncate">
          {lesson.description}
        </h2>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {formatLessonDate(lesson.date)} · {lesson.from} – {lesson.until}
        </p>
        {#if lesson.staff || lesson.room}
          <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 truncate">
            {[lesson.staff, lesson.room].filter(Boolean).join(' · ')}
          </p>
        {/if}
        {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1 truncate">{lesson.attendanceTitle}</p>
        {/if}
        {#if lesson.programmeID !== 0}
          <div class="flex gap-2 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:accent-bg hover:text-white transition-colors"
              onclick={handleViewCourse}>
              <Icon src={BookOpen} class="w-3.5 h-3.5" />
              <span>Course</span>
            </button>
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:accent-bg hover:text-white transition-colors"
              onclick={handleViewAssessments}>
              <Icon src={DocumentText} class="w-3.5 h-3.5" />
              <span>Assessments</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/key}
{/if}
