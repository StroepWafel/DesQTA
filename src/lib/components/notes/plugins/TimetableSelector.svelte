<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import { seqtaFetch } from '../../../../utils/netUtil';
  import {
    Icon,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Clock,
    MapPin,
    User,
  } from 'svelte-hero-icons';
  import type { SeqtaMentionItem } from '$lib/services/seqtaMentionsService';

  interface Props {
    open: boolean;
    onSelect: (item: SeqtaMentionItem) => void;
    onclose?: () => void;
  }

  let { open = $bindable(false), onSelect, onclose }: Props = $props();

  const studentId = 69;
  let weekStart = $state(getMonday(new Date()));
  let lessons = $state<any[]>([]);
  let loading = $state(false);
  let subjectMap = $state<Record<string, string>>({});

  function getMonday(d: Date) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function loadSubjectMap() {
    try {
      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const classesData = JSON.parse(res).payload;
      const allSubjects = classesData.flatMap((folder: any) => folder.subjects);
      const map: Record<string, string> = {};
      allSubjects.forEach((subject: any) => {
        const key = `${subject.code}-${subject.programme}-${subject.metaclass}`;
        map[key] = subject.title || subject.code;
      });
      subjectMap = map;
    } catch (error) {
      console.warn('Failed to load subject map:', error);
    }
  }

  function getSubjectName(lesson: any): string {
    const key = `${lesson.code}-${lesson.programmeID}-${lesson.metaID}`;
    return subjectMap[key] || lesson.code || lesson.title || 'Lesson';
  }

  async function loadLessons() {
    loading = true;
    try {
      const from = formatDate(weekStart);
      const until = formatDate(new Date(weekStart.getTime() + 4 * 86400000));

      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from, until, student: studentId },
      });

      const timetableData = JSON.parse(res).payload;
      lessons = (timetableData.items || []).map((lesson: any) => {
        const date = lesson.date || (lesson.from || '').split('T')[0];
        const fromTime =
          (lesson.from || '').substring(0, 5) || (lesson.from || '').substring(11, 16);
        const untilTime =
          (lesson.until || '').substring(0, 5) || (lesson.until || '').substring(11, 16);
        const dayIdx = (new Date(date).getDay() + 6) % 7; // Monday = 0, Friday = 4

        // Convert to 12-hour format for display
        const format12Hour = (time24: string): string => {
          if (!time24 || !time24.includes(':')) return time24;
          const [hours, minutes] = time24.split(':').map(Number);
          const period = hours >= 12 ? 'PM' : 'AM';
          const hours12 = hours % 12 || 12;
          return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        return {
          ...lesson,
          date,
          from: fromTime,
          until: untilTime,
          from12: format12Hour(fromTime),
          until12: format12Hour(untilTime),
          dayIdx,
        };
      });
    } catch (error) {
      console.error('Failed to load timetable:', error);
    } finally {
      loading = false;
    }
  }

  function prevWeek() {
    weekStart = new Date(weekStart.valueOf() - 7 * 86400000);
    loadLessons();
  }

  function nextWeek() {
    weekStart = new Date(weekStart.valueOf() + 7 * 86400000);
    loadLessons();
  }

  function getLessonsForDay(dayIdx: number) {
    return lessons.filter((l) => l.dayIdx === dayIdx).sort((a, b) => a.from.localeCompare(b.from));
  }

  function selectSlot(lesson: any) {
    const date = lesson.date || (lesson.from || '').split('T')[0];
    const fromTime =
      lesson.from || (lesson.from || '').substring(0, 5) || (lesson.from || '').substring(11, 16);
    const untilTime =
      lesson.until ||
      (lesson.until || '').substring(0, 5) ||
      (lesson.until || '').substring(11, 16);
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

    // Convert to 12-hour format
    const format12Hour = (time24: string): string => {
      if (!time24 || !time24.includes(':')) return time24;
      const [hours, minutes] = time24.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const fromTime12 = format12Hour(fromTime);
    const untilTime12 = format12Hour(untilTime);

    // Get subject name from map
    const subjectName = getSubjectName(lesson);

    const mentionItem: SeqtaMentionItem = {
      id: `timetable-slot-${lesson.id || `${date}-${fromTime.replace(':', '-')}`}`,
      type: 'timetable_slot',
      title: `${subjectName} ${fromTime12}-${untilTime12}`,
      subtitle: `${dayName} ${date} • Room ${lesson.room || 'TBA'}`,
      data: {
        id: lesson.id,
        date,
        from: fromTime,
        until: untilTime,
        from12: fromTime12,
        until12: untilTime12,
        code: lesson.code,
        subjectName,
        title: lesson.title || lesson.description,
        room: lesson.room,
        teacher: lesson.staff || lesson.teacher,
        programme: lesson.programmeID,
        metaclass: lesson.metaID,
      },
      lastUpdated: new Date().toISOString(),
    };

    onSelect(mentionItem);
    open = false;
  }

  function weekRangeLabel() {
    const end = new Date(weekStart.valueOf() + 4 * 86400000);
    return `${weekStart.getDate()} ${weekStart.toLocaleString('default', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('default', { month: 'short' })} ${weekStart.getFullYear()}`;
  }

  $effect(() => {
    if (open) {
      loadSubjectMap();
      loadLessons();
    }
  });

  function closeModal() {
    open = false;
    onclose?.();
  }
</script>

<Modal bind:open onclose={closeModal} maxWidth="max-w-4xl" ariaLabel="Select Timetable Slot">
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">Select Timetable Slot</h2>
      <div class="flex items-center gap-2">
        <button
          class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          onclick={prevWeek}
          disabled={loading}>
          <Icon src={ChevronLeft} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <span
          class="text-sm font-medium text-zinc-700 dark:text-zinc-300 min-w-[200px] text-center">
          {weekRangeLabel()}
        </span>
        <button
          class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          onclick={nextWeek}
          disabled={loading}>
          <Icon src={ChevronRight} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-blue-600 animate-spin">
        </div>
      </div>
    {:else}
      <!-- Timetable Grid -->
      <div class="grid grid-cols-5 gap-2">
        {#each ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as dayName, dayIdx}
          <div class="flex flex-col">
            <div
              class="text-center font-semibold text-sm text-zinc-700 dark:text-zinc-300 mb-2 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              {dayName}
            </div>
            <div class="space-y-2 min-h-[400px]">
              {#each getLessonsForDay(dayIdx) as lesson}
                <button
                  class="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all duration-200 transform hover:scale-[1.02] text-left"
                  onclick={() => selectSlot(lesson)}>
                  <div class="flex items-start justify-between mb-1">
                    <div class="flex-1">
                      <div class="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                        {getSubjectName(lesson)}
                      </div>
                      <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <div class="flex items-center gap-1">
                          <Icon src={Clock} class="w-3 h-3" />
                          <span
                            >{lesson.from12 || lesson.from} - {lesson.until12 ||
                              lesson.until}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {#if lesson.room || lesson.staff}
                    <div
                      class="flex items-center gap-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {#if lesson.room}
                        <div class="flex items-center gap-1">
                          <Icon src={MapPin} class="w-3 h-3" />
                          <span>{lesson.room}</span>
                        </div>
                      {/if}
                      {#if lesson.staff}
                        <div class="flex items-center gap-1">
                          <Icon src={User} class="w-3 h-3" />
                          <span class="truncate">{lesson.staff}</span>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </button>
              {/each}
              {#if getLessonsForDay(dayIdx).length === 0}
                <div class="text-center text-xs text-zinc-400 dark:text-zinc-500 py-8">
                  No lessons
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</Modal>
