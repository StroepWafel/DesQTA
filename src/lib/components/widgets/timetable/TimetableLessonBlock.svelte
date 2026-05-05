<script lang="ts">
  import type { TimetableLesson } from '$lib/types/timetable';
  import { isLessonActive } from '$lib/utils/timetableUtils';

  interface Props {
    lesson: TimetableLesson;
    onClick?: (
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
    showTeacher?: boolean;
    showRoom?: boolean;
    showAttendance?: boolean;
    density?: 'compact' | 'normal' | 'comfortable';
    /** Narrow multi-column strips: tighter type scale only — times remain visible */
    overlap?: boolean;
    /** panel = list/month cards; grid = week/day timed slots — strict clipping */
    variant?: 'panel' | 'grid';
    /** From parent timed slot height (px): hide room/time progressively */
    slotHeightPx?: number;
  }

  let {
    lesson,
    onClick,
    showTeacher = true,
    showRoom = true,
    showAttendance = true,
    density = 'normal',
    overlap = false,
    variant = 'panel',
    slotHeightPx,
  }: Props = $props();

  let blockElement: HTMLButtonElement | null = $state(null);

  const active = $derived(isLessonActive(lesson));
  const isGrid = $derived(variant === 'grid');

  const densityClasses = $derived(
    {
      compact: 'p-1.5 text-xs gap-0.5',
      normal: 'p-2 text-sm gap-1',
      comfortable: 'p-3 text-base gap-1',
    }[density],
  );

  const titleClampPanel = $derived('line-clamp-3');
  const titleClampGrid = $derived(
    density === 'compact' ? 'line-clamp-2' : overlap ? 'line-clamp-3' : 'line-clamp-4',
  );
  const metaClamp = $derived(isGrid ? 'line-clamp-1' : 'line-clamp-2');
  const gridTextScale = $derived.by(() => {
    if (!isGrid) return 1;
    const h = slotHeightPx ?? 64;
    if (h >= 84) return 1;
    if (h >= 68) return 0.94;
    if (h >= 52) return 0.88;
    if (h >= 40) return 0.8;
    if (h >= 30) return 0.74;
    return 0.68;
  });

  /** Priority when vertical space is tight: keep title and time longest; shed room then staff */
  const showGridRoom = $derived(
    !!(showRoom && lesson.room) &&
      (slotHeightPx === undefined || slotHeightPx >= 44),
  );
  const showGridTeacher = $derived(
    !!(showTeacher && lesson.staff) &&
      (slotHeightPx === undefined || slotHeightPx >= 36),
  );
  const showGridTime = $derived(slotHeightPx === undefined || slotHeightPx >= 30);

  function formatRoomLabel(room: string): string {
    const trimmed = room.trim();
    if (/^room\s/i.test(trimmed)) return trimmed;
    return `Room ${trimmed}`;
  }

  function handleClick() {
    if (onClick && blockElement) {
      const rect = blockElement.getBoundingClientRect();
      onClick(lesson, blockElement, {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    }
  }

  function formatSlotKind(kind: string): string {
    return kind.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const slotKindLabel = $derived(
    lesson.slotType && lesson.slotType !== 'class' ? formatSlotKind(lesson.slotType) : null,
  );
</script>

<button
  bind:this={blockElement}
  type="button"
  class="lesson-block flex flex-col justify-start rounded-xl border-l-4 shadow-lg bg-white dark:bg-zinc-800 group cursor-pointer select-none w-full text-left min-w-0 transition-[box-shadow] duration-200 {densityClasses} {isGrid
    ? 'lesson-grid relative min-h-0 max-h-full h-full overflow-hidden hover:shadow-lg'
    : 'lesson-panel hover-scale-panel min-h-[54px] h-full hover:shadow-xl active:scale-[0.98]'}"
  style="border-color: {lesson.colour}; --border-color: {lesson.colour}; --text-scale: {gridTextScale};"
  class:active
  class:overlap
  onclick={handleClick}
  aria-label="{slotKindLabel ? `${slotKindLabel}. ` : ''}Lesson: {lesson.description} from {lesson.from} to {lesson.until}"
  title="{slotKindLabel ? `${slotKindLabel} — ${lesson.description}` : lesson.description}">
  {#if isGrid}
    {#if slotKindLabel}
      <p
        class="grid-kind text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 truncate shrink-0 leading-tight mb-0.5">
        {slotKindLabel}
      </p>
    {/if}
    <h3
      class="grid-title font-bold text-zinc-900 dark:text-white min-w-0 overflow-hidden shrink-0 leading-tight mb-0.5 {titleClampGrid}">
      {lesson.description}
    </h3>
    {#if showGridTime}
      <p
        class="grid-time font-mono font-semibold text-zinc-700 dark:text-zinc-300 text-[10px] sm:text-[11px] shrink-0 leading-tight whitespace-nowrap mb-0.5">
        {lesson.from} – {lesson.until}
      </p>
    {/if}
    {#if showGridTeacher && lesson.staff}
      <span
        class="grid-meta text-zinc-600 dark:text-zinc-400 text-[10px] sm:text-xs min-w-0 shrink-0 leading-tight mb-0.5 {metaClamp}">
        {lesson.staff}
      </span>
    {/if}
    {#if showGridRoom && lesson.room}
      <span class="grid-meta text-zinc-600 dark:text-zinc-400 text-[10px] sm:text-xs min-w-0 shrink leading-tight {metaClamp}">
        {formatRoomLabel(lesson.room)}
      </span>
    {/if}
  {:else}
    {#if slotKindLabel}
      <p
        class="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 truncate shrink-0 leading-tight mb-0.5">
        {slotKindLabel}
      </p>
    {/if}
    <div class="flex justify-between gap-2 items-start min-h-0 shrink-0 mb-0.5 overflow-hidden">
      <h3
        class="font-bold text-zinc-900 dark:text-white flex-1 min-w-0 overflow-hidden leading-tight {titleClampPanel}">
        {lesson.description}
      </h3>
      {#if !overlap}
        <span
          class="font-mono font-semibold text-zinc-700 dark:text-zinc-300 text-[10px] sm:text-xs shrink-0 leading-tight whitespace-nowrap">
          {lesson.from} – {lesson.until}
        </span>
      {/if}
    </div>

    {#if showTeacher || showRoom}
      <div class="flex flex-col gap-0.5 mb-0.5 min-h-0 shrink overflow-hidden">
        {#if showTeacher && lesson.staff}
          <span
            class="text-zinc-600 dark:text-zinc-400 text-[11px] sm:text-xs min-w-0 leading-tight {metaClamp}">
            {lesson.staff}
          </span>
        {/if}
        {#if showRoom && lesson.room}
          <span
            class="text-zinc-600 dark:text-zinc-400 text-[11px] sm:text-xs min-w-0 leading-tight {metaClamp}">
            {formatRoomLabel(lesson.room)}
          </span>
        {/if}
      </div>
    {/if}
  {/if}

  {#if showAttendance && lesson.attendanceTitle && lesson.attendanceTitle.trim() && !isGrid}
    <div
      class="lesson-attendance mt-1 border-t border-zinc-200 dark:border-zinc-700 pt-1 shrink-0 min-h-0 overflow-hidden">
      <span class="text-xs italic text-amber-600 dark:text-amber-400 line-clamp-2">
        {lesson.attendanceTitle}
      </span>
    </div>
  {/if}

  {#if active}
    <div
      class="pointer-events-none absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse z-10">
    </div>
  {/if}
</button>

<style>
  .lesson-panel {
    transform-origin: center center;
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .lesson-panel.hover-scale-panel:hover {
    transform: scale(1.02);
    z-index: 10;
  }

  .lesson-panel.active {
    animation: pulse-border 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .lesson-grid.active {
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--border-color) 40%, transparent),
      0 1px 2px rgb(0 0 0 / 0.08);
  }

  .lesson-block.overlap {
    min-width: 0;
  }

  .lesson-attendance {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    padding-top: 0;
    margin-top: 0;
    border-top-width: 0;
    transition:
      max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.2s ease,
      padding-top 0.2s ease,
      margin-top 0.2s ease,
      border-top-width 0.2s ease;
  }

  .lesson-panel:hover .lesson-attendance,
  .lesson-panel:focus-within .lesson-attendance {
    max-height: 100px;
    opacity: 1;
    padding-top: 0.25rem;
    margin-top: 0.25rem;
    border-top-width: 1px;
  }

  .lesson-grid .grid-kind {
    font-size: calc(9px * var(--text-scale));
  }
  .lesson-grid .grid-title {
    font-size: calc(14px * var(--text-scale));
    line-height: 1.12;
  }
  .lesson-grid .grid-time {
    font-size: calc(11px * var(--text-scale));
  }
  .lesson-grid .grid-meta {
    font-size: calc(11px * var(--text-scale));
  }

  @keyframes pulse-border {
    0%,
    100% {
      box-shadow:
        0 4px 6px -1px rgb(0 0 0 / 0.1),
        0 2px 4px -2px rgb(0 0 0 / 0.1),
        0 0 0 0 transparent;
    }
    50% {
      box-shadow:
        0 4px 6px -1px rgb(0 0 0 / 0.1),
        0 2px 4px -2px rgb(0 0 0 / 0.1),
        0 0 0 3px color-mix(in srgb, var(--border-color) 30%, transparent);
    }
  }
</style>
