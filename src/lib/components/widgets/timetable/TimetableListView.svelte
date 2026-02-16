<script lang="ts">
  import { fade } from 'svelte/transition';
  import TimetableLessonBlock from './TimetableLessonBlock.svelte';
  import { Button, Input } from '../../ui';
  import { Icon, MagnifyingGlass, Funnel } from 'svelte-hero-icons';
  import type { TimetableLesson, TimetableWidgetSettings } from '$lib/types/timetable';
  import { formatDate, parseDate, sortLessonsByTime } from '$lib/utils/timetableUtils';
  import { _ } from '$lib/i18n';

  interface Props {
    lessons: TimetableLesson[];
    selectedLesson: TimetableLesson | null;
    onLessonClick: (lesson: TimetableLesson, element: HTMLElement) => void;
    settings: TimetableWidgetSettings;
  }

  let {
    lessons,
    selectedLesson,
    onLessonClick,
    settings,
  }: Props = $props();

  let searchQuery = $state('');
  let filterSubject = $state<string | null>(null);
  let filterDay = $state<number | null>(null);
  let showFilters = $state(false);

  const dayLabels = $derived([
    $_('timetable.monday') || 'Monday',
    $_('timetable.tuesday') || 'Tuesday',
    $_('timetable.wednesday') || 'Wednesday',
    $_('timetable.thursday') || 'Thursday',
    $_('timetable.friday') || 'Friday',
  ]);

  const sortedLessons = $derived(sortLessonsByTime(lessons));

  const filteredLessons = $derived(
    sortedLessons.filter((lesson: TimetableLesson) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          lesson.description.toLowerCase().includes(query) ||
          lesson.code.toLowerCase().includes(query) ||
          lesson.staff.toLowerCase().includes(query) ||
          lesson.room.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Subject filter
      if (filterSubject && lesson.code !== filterSubject) {
        return false;
      }

      // Day filter
      if (filterDay !== null && lesson.dayIdx !== filterDay) {
        return false;
      }

      return true;
    }),
  );

  const groupedLessons = $derived<Array<[string, TimetableLesson[]]>>(() => {
    const groups = new Map<string, TimetableLesson[]>();
    for (const lesson of filteredLessons) {
      if (!groups.has(lesson.date)) {
        groups.set(lesson.date, []);
      }
      groups.get(lesson.date)!.push(lesson);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  const uniqueSubjects = $derived(
    Array.from(new Set(lessons.map((l) => l.code))).sort(),
  );

  function clearFilters() {
    searchQuery = '';
    filterSubject = null;
    filterDay = null;
  }

  function formatLessonDate(dateStr: string): string {
    const date = parseDate(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
</script>

<div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
  <!-- Search and Filters -->
  <div class="flex flex-col gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
    <div class="flex gap-2 items-center">
      <div class="relative flex-1">
        <Icon
          src={MagnifyingGlass}
          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <Input
          type="text"
          placeholder={$_('timetable.search') || 'Search lessons...'}
          bind:value={searchQuery}
          class="pl-10 w-full" />
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={Funnel}
        onclick={() => (showFilters = !showFilters)}
        class="px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
        ariaLabel="Toggle filters" />
    </div>

    {#if showFilters}
      <div
        class="flex flex-wrap gap-2 p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
        transition:fade={{ duration: 200 }}>
        <!-- Subject Filter -->
        <select
          bind:value={filterSubject}
          class="px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-accent-500">
          <option value="">All Subjects</option>
          {#each uniqueSubjects as subject}
            <option value={subject}>{subject}</option>
          {/each}
        </select>

        <!-- Day Filter -->
        <select
          bind:value={filterDay}
          class="px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-accent-500">
          <option value="">All Days</option>
          {#each dayLabels as dayLabel, dayIdx}
            <option value={dayIdx}>{dayLabel}</option>
          {/each}
        </select>

        <Button
          variant="ghost"
          size="sm"
          onclick={clearFilters}
          class="px-4 py-1.5 text-sm rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
          Clear Filters
        </Button>
      </div>
    {/if}
  </div>

  <!-- Lessons List -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if filteredLessons.length === 0}
      <div
        class="flex flex-col justify-center items-center h-full py-16"
        transition:fade={{ duration: 200 }}>
        <div
          class="w-24 h-24 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-4xl shadow-lg mb-6">
          📚
        </div>
        <h3 class="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">
          {searchQuery || filterSubject || filterDay !== null
            ? $_('timetable.no_results') || 'No Results'
            : $_('timetable.no_lessons') || 'No Lessons'}
        </h3>
        <p class="text-zinc-600 dark:text-zinc-400 text-center max-w-md">
          {searchQuery || filterSubject || filterDay !== null
            ? $_('timetable.try_different_filters') || 'Try adjusting your search or filters.'
            : $_('timetable.no_lessons_message') || 'No lessons found for this period.'}
        </p>
      </div>
    {:else}
      <div class="space-y-6">
        {#each groupedLessons as [dateStr, dayLessons], groupIndex}
          <div transition:fade={{ duration: 200, delay: groupIndex * 50 }}>
            <h3
              class="text-lg font-bold text-zinc-900 dark:text-white mb-3 sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm py-2 z-10">
              {formatLessonDate(dateStr)}
            </h3>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {#each dayLessons as lesson, index}
                <div
                  transition:fade={{ duration: 200, delay: index * 30 }}
                  class="min-h-[120px]">
                  <TimetableLessonBlock
                    lesson={lesson}
                    onClick={onLessonClick}
                    showTeacher={settings.showTeacher ?? true}
                    showRoom={settings.showRoom ?? true}
                    showAttendance={settings.showAttendance ?? true}
                    density={settings.density || 'normal'} />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
