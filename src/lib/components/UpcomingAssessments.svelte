<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getSubjectsForCurrentAcademicYear } from '$lib/utils/subjectFolders';
  import { Icon, DocumentText, ChevronDown } from 'svelte-hero-icons';
  import { Badge } from '$lib/components/ui';
  import { clickOutside } from '$lib/actions/clickOutside.js';
  import T from '$lib/components/T.svelte';

  const studentId = 69; //! literally changes nothing but was used in the original seqta code.

  let upcomingAssessments = $state<any[]>([]);
  let activeSubjects = $state<any[]>([]);
  /** Empty = show all subjects (same semantics as analytics subject filter). */
  let selectedSubjectCodes = $state<string[]>([]);
  let loadingAssessments = $state<boolean>(true);
  let showSubjectDropdown = $state(false);

  function subjectFiltersToSelectedCodes(
    filters: Record<string, boolean>,
    codes: string[],
  ): string[] {
    if (codes.length === 0) return [];
    const selected = codes.filter((c) => filters[c]);
    if (selected.length === codes.length) return [];
    return selected;
  }

  function selectedCodesToFilters(selectedCodes: string[], codes: string[]): Record<string, boolean> {
    if (selectedCodes.length === 0) {
      return Object.fromEntries(codes.map((c) => [c, true]));
    }
    return Object.fromEntries(codes.map((c) => [c, selectedCodes.includes(c)]));
  }

  function toggleSubjectCode(code: string) {
    const allCodes = activeSubjects.map((s: any) => s.code);
    if (selectedSubjectCodes.length === 0) {
      selectedSubjectCodes = [code];
      return;
    }
    if (selectedSubjectCodes.includes(code)) {
      const next = selectedSubjectCodes.filter((c) => c !== code);
      selectedSubjectCodes = next.length === 0 ? [] : next;
    } else {
      const next = [...selectedSubjectCodes, code];
      selectedSubjectCodes = next.length === allCodes.length ? [] : next;
    }
  }

  const filteredAssessments = $derived(
    upcomingAssessments.filter((a: any) => {
      if (selectedSubjectCodes.length === 0) return true;
      return selectedSubjectCodes.includes(a.code);
    }),
  );

  /** Literal for i18n default; avoid `{` in markup (Svelte parses it as an expression). */
  const subjectsSelectedFallback = '{count} selected';

  async function loadLessonColours() {
    const res = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { request: 'userPrefs', asArray: true, user: studentId },
    });
    return JSON.parse(res).payload;
  }

  async function loadAssessments() {
    loadingAssessments = true;

    try {
      // Check cache first
      const cachedData = cache.get<{
        assessments: any[];
        subjects: any[];
        filters: Record<string, boolean>;
      }>('upcoming_assessments_data');

      if (cachedData) {
        upcomingAssessments = cachedData.assessments;
        activeSubjects = cachedData.subjects;
        selectedSubjectCodes = subjectFiltersToSelectedCodes(
          cachedData.filters,
          cachedData.subjects.map((s: any) => s.code),
        );
        loadingAssessments = false;
        return;
      }

      const [assessmentsRes, classesRes] = await Promise.all([
        seqtaFetch('/seqta/student/assessment/list/upcoming?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: { student: studentId },
        }),
        seqtaFetch('/seqta/student/load/subjects?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {},
        }),
      ]);

      const colours = await loadLessonColours();

      const classesResJson = JSON.parse(classesRes);
      activeSubjects = getSubjectsForCurrentAcademicYear(classesResJson.payload);
      selectedSubjectCodes = [];

      const activeCodes = activeSubjects.map((s: any) => s.code);

      upcomingAssessments = JSON.parse(assessmentsRes)
        .payload.filter((a: any) => activeCodes.includes(a.code))
        .filter((a: any) => new Date(a.due) >= new Date())
        .map((a: any) => {
          const prefName = `timetable.subject.colour.${a.code}`;
          const c = colours.find((p: any) => p.name === prefName);
          a.colour = c ? c.value : '#8e8e8e';
          return a;
        })
        .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));

      // Cache all the data for 1 hour
      cache.set(
        'upcoming_assessments_data',
        {
          assessments: upcomingAssessments,
          subjects: activeSubjects,
          filters: selectedCodesToFilters(selectedSubjectCodes, activeCodes),
        },
        60,
      );
    } catch (e) {
      console.error('Error loading assessments:', e);
    } finally {
      loadingAssessments = false;
    }
  }

  function getStatusBadge(status: string, due: string) {
    const dueDate = new Date(due);
    const now = new Date();

    if (status === 'MARKS_RELEASED') {
      return { text: 'Marked', variant: 'success' as const };
    } else if (dueDate < now) {
      return { text: 'Overdue', variant: 'danger' as const };
    } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return { text: 'Due Soon', variant: 'warning' as const };
    } else {
      return { text: 'Upcoming', variant: 'info' as const };
    }
  }

  onMount(async () => {
    await loadAssessments();
  });
</script>

<div
  class="overflow-hidden relative h-full flex flex-col min-h-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
  <div
    class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-3 shrink-0 transition-all duration-300"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: left center;">
    <div class="flex items-center gap-2 min-w-0">
      <Icon
        src={DocumentText}
        class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300 shrink-0" />
      <h3
        class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300 truncate"
        in:fade={{ duration: 300, delay: 150 }}>
        Upcoming Assessments
      </h3>
    </div>
    {#if !loadingAssessments && activeSubjects.length > 0}
      <div
        class="relative shrink-0 self-end sm:self-auto"
        id="upcoming-filters"
        use:clickOutside={() => (showSubjectDropdown = false)}
        in:fade={{ duration: 300, delay: 200 }}>
        <button
          type="button"
          class="flex gap-2 items-center min-h-[44px] w-full max-w-44 sm:w-44 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 accent-ring transition-all duration-200 hover:scale-[1.02] active:scale-95"
          onclick={() => (showSubjectDropdown = !showSubjectDropdown)}
          aria-expanded={showSubjectDropdown}
          aria-haspopup="listbox"
          aria-label="Filter by subject">
          <span class="truncate flex-1 text-left text-sm">
            {#if selectedSubjectCodes.length === 0}
              <T key="analytics.all_subjects" fallback="All Subjects" />
            {:else if selectedSubjectCodes.length === 1}
              {selectedSubjectCodes[0]}
            {:else}
              <T
                key="analytics.subjects_selected"
                fallback={subjectsSelectedFallback}
                values={{ count: selectedSubjectCodes.length }} />
            {/if}
          </span>
          <Icon
            src={ChevronDown}
            class="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200 {showSubjectDropdown
              ? 'rotate-180'
              : ''}" />
        </button>
        {#if showSubjectDropdown}
          <div
            class="absolute right-0 z-50 mt-2 w-56 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            role="listbox"
            transition:fly={{ y: -6, duration: 150, easing: cubicOut }}>
            <button
              type="button"
              role="option"
              aria-selected={selectedSubjectCodes.length === 0}
              class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors duration-200 {selectedSubjectCodes.length === 0
                ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
              onclick={() => {
                selectedSubjectCodes = [];
                showSubjectDropdown = false;
              }}>
              <span class="w-4 shrink-0 flex justify-center"
                >{selectedSubjectCodes.length === 0 ? '✓' : ''}</span>
              <T key="analytics.all_subjects" fallback="All Subjects" />
            </button>
            {#each activeSubjects as subj}
              {@const isRowSelected =
                selectedSubjectCodes.length > 0 && selectedSubjectCodes.includes(subj.code)}
              <button
                type="button"
                role="option"
                aria-selected={isRowSelected}
                class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors duration-200 {isRowSelected
                  ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
                onclick={() => toggleSubjectCode(subj.code)}>
                <span class="w-4 shrink-0 flex justify-center">{isRowSelected ? '✓' : ''}</span>
                <span class="truncate" style={subj.colour ? `color: ${subj.colour}` : undefined}
                  >{subj.code}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if loadingAssessments}
    <div
      class="flex flex-col justify-center items-center py-8 sm:py-12 flex-1 min-h-0 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 animate-spin sm:w-16 sm:h-16 border-accent/30 border-t-accent transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="mt-3 sm:mt-4 text-xs sm:text-sm text-zinc-600 sm:text-base dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading assessments...
      </p>
    </div>
  {:else if filteredAssessments.length === 0}
    <div
      class="flex flex-col justify-center items-center py-8 sm:py-12 flex-1 min-h-0 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-600 text-2xl sm:text-3xl shadow-[0_0_20px_rgba(var(--accent-color-value),0.3)] animate-gradient transition-all duration-500"
        in:scale={{ duration: 500, delay: 100, easing: cubicInOut, start: 0.5 }}>
        🎉
      </div>
      <p
        class="mt-3 sm:mt-4 text-base sm:text-lg text-zinc-700 sm:text-xl dark:text-zinc-300 transition-all duration-300"
        in:fade={{ duration: 300, delay: 200 }}>
        Nothing coming up!
      </p>
    </div>
  {:else}
    <div
      class="flex-1 overflow-y-auto min-h-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 400, delay: 100 }}>
      <div class="grid grid-cols-1 gap-2 sm:gap-3 md:gap-4">
        {#each filteredAssessments as a, i}
          {@const assessmentYear = new Date(a.due).getFullYear()}
          {@const dateStr = new Date(a.due).toISOString().split('T')[0]}
          <a
            href="/assessments?code={a.code}&date={dateStr}&year={assessmentYear}"
            class="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(var(--accent-color-value),0.2)] relative group backdrop-blur-sm bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/50 dark:border-zinc-800/50"
            in:fade={{ duration: 300, delay: 200 + i * 50 }}
            style="transform-origin: center center;">
            <div
              class="absolute inset-0 bg-linear-to-br rounded-xl opacity-30 animate-gradient"
              style="background: linear-gradient(135deg, {a.colour}20, {a.colour}05);">
            </div>
            <div class="absolute inset-0 rounded-xl border" style="border: 1px solid {a.colour}30;">
            </div>

            <div class="flex relative z-10 gap-4 items-center">
              <div
                class="flex justify-center items-center w-12 h-12 bg-linear-to-br rounded-xl shadow-lg sm:h-14 sm:w-14 animate-gradient transition-all duration-200 hover:scale-105"
                style="background: linear-gradient(135deg, {a.colour}, {a.colour}dd);">
                <Icon src={DocumentText} class="w-6 h-6 text-white" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap gap-2 items-center">
                  <div class="text-sm font-bold dark:text-white sm:text-base">
                    {new Date(a.due).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <Badge variant={getStatusBadge(a.status, a.due).variant} size="xs">
                    {getStatusBadge(a.status, a.due).text}
                  </Badge>
                </div>
                <div class="mt-1">
                  <span
                    class="block text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400"
                    >{a.subject}</span>
                  <span
                    class="block text-sm font-semibold truncate text-zinc-900 dark:text-white sm:text-base"
                    >{a.title}</span>
                </div>
              </div>
            </div>

            {#if a.description}
              <div class="relative z-10 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                {a.description}
              </div>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  {/if}
</div>
