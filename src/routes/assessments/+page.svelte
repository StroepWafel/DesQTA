<script lang="ts">
  // Svelte imports
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  // Tauri imports
  import { invoke } from '@tauri-apps/api/core';

  // $lib/ imports
  import { setIdb } from '$lib/services/idbCache';
  import T from '$lib/components/T.svelte';
  import AssessmentBoardView from '$lib/components/AssessmentBoardView.svelte';
  import AssessmentCalendarView from '$lib/components/AssessmentCalendarView.svelte';
  import AssessmentListView from '$lib/components/AssessmentListView.svelte';
  import AssessmentGanttView from '$lib/components/AssessmentGanttView.svelte';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { ClipboardDocumentList } from 'svelte-hero-icons';
  import { _ } from '$lib/i18n';
  import { updateUrlParam, getUrlParam } from '$lib/utils/urlParams';

  // Relative imports
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { notify } from '../../utils/notify';
  import { logger } from '../../utils/logger';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import { checkAndCalculateNewGrades } from '$lib/services/backgroundGradeService';

  // Types
  import type { Assessment, Subject, LessonColour, AssessmentsOverviewData } from '$lib/types';

  const studentId = 69;

  let upcomingAssessments = $state<Assessment[]>([]);
  let allSubjects = $state<Subject[]>([]);
  let activeSubjects = $state<Subject[]>([]);
  let lessonColours = $state<LessonColour[]>([]);
  let loadingAssessments = $state<boolean>(true);
  let selectedTab = $state<'list' | 'board' | 'calendar' | 'gantt'>('list');
  let subjectFilters: Record<string, boolean> = {};
  let remindersEnabled = true;
  let groupBy = $state<'subject' | 'month' | 'status'>('subject');

  // Year filter state
  let selectedYear = $state<number>(new Date().getFullYear());
  let availableYears = $state<number[]>([]);

  let aiIntegrationsEnabled = $state(false);
  let gradeAnalyserEnabled = $state(true);

  const filteredAssessments = $derived(
    upcomingAssessments.filter((a) => {
      // Filter by year only
      const assessmentYear = new Date(a.due).getFullYear();
      if (assessmentYear !== selectedYear) return false;

      return true;
    }),
  );

  async function loadLessonColours() {
    const colours = await useDataLoader<LessonColour[]>({
      cacheKey: 'lesson_colours',
      ttlMinutes: 10,
      context: 'assessments',
      functionName: 'loadLessonColours',
      fetcher: async () => {
        const res = await seqtaFetch('/seqta/student/load/prefs?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: { request: 'userPrefs', asArray: true, user: studentId },
        });
        return JSON.parse(res).payload;
      },
      onDataLoaded: (colours) => {
        lessonColours = colours;
      },
    });

    return colours || [];
  }

  async function loadAssessments() {
    loadingAssessments = true;

    const data = await useDataLoader<AssessmentsOverviewData>({
      cacheKey: 'assessments_overview_data',
      ttlMinutes: 10,
      context: 'assessments',
      functionName: 'loadAssessments',
      fetcher: async () => {
        const result = await invoke<{
          assessments: Assessment[];
          subjects: Subject[];
          all_subjects: Subject[];
          filters: Record<string, boolean>;
          years: number[];
        }>('get_processed_assessments');

        return {
          assessments: result.assessments,
          subjects: result.subjects,
          allSubjects: result.all_subjects,
          filters: result.filters,
          years: result.years,
        };
      },
      onDataLoaded: async (data) => {
        upcomingAssessments = data.assessments;
        activeSubjects = data.subjects;
        allSubjects = data.allSubjects;
        subjectFilters = data.filters;
        availableYears = data.years;
        loadingAssessments = false;
        
        // Check for new marked assessments and auto-calculate in background
        checkAndCalculateNewGrades(data.assessments).catch((e) => {
          logger.error('assessments', '+page', 'Background grade check failed', { error: e });
        });
      },
    });

    if (!data) {
      loadingAssessments = false;
    }
  }

  function scheduleAssessmentReminders(assessments: Assessment[]) {
    if (!remindersEnabled) return;
    const now = Date.now();
    const scheduled = new Set(
      JSON.parse(localStorage.getItem('scheduledAssessmentReminders') || '[]'),
    );

    for (const a of assessments) {
      const due = new Date(a.due).getTime();
      const reminderTime = due - 24 * 60 * 60 * 1000; // 1 day before
      if (reminderTime > now && !scheduled.has(a.id)) {
        const timeout = reminderTime - now;
        setTimeout(() => {
          notify({
            title: 'Assessment Reminder',
            body: `${a.title} is due tomorrow!`,
          });
        }, timeout);
        scheduled.add(a.id);
      }
    }
    localStorage.setItem('scheduledAssessmentReminders', JSON.stringify(Array.from(scheduled)));
  }

  $effect(() => {
    if (upcomingAssessments.length) {
      scheduleAssessmentReminders(upcomingAssessments);
    }
  });

  function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get('code'),
      date: params.get('date'),
    };
  }

  function highlightAssessmentFromQuery() {
    const { code, date } = getQueryParams();
    if (!code || !date) return;
    // Find the assessment with the matching code and closest due date
    let closest = null;
    let minDiff = Infinity;
    const targetDate = new Date(date);
    for (const a of upcomingAssessments) {
      if (a.code !== code) continue;
      const dueDate = new Date(a.due);
      const diff = Math.abs(dueDate.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        closest = a;
        minDiff = diff;
      }
    }
    if (closest) {
      // Try to find the DOM element for this assessment and scroll/highlight
      setTimeout(() => {
        const selector = `[data-assessment-id="${closest.id}"]`;
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-subject');
          setTimeout(() => el.classList.remove('highlight-subject'), 1500);
        }
      }, 300);
    }
  }

  function handleTabChange(tab: 'list' | 'board' | 'calendar' | 'gantt') {
    selectedTab = tab;
  }

  async function handleYearChange(year: number) {
    selectedYear = year;
    await updateUrlParam('year', year.toString());
  }

  function handleGroupByChange(group: 'subject' | 'month' | 'status') {
    groupBy = group;
  }

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['ai_integrations_enabled', 'grade_analyser_enabled'],
      });
      aiIntegrationsEnabled = subset?.ai_integrations_enabled ?? false;
      gradeAnalyserEnabled = subset?.grade_analyser_enabled ?? true;
    } catch (e) {
      aiIntegrationsEnabled = false;
      gradeAnalyserEnabled = true;
    }
    await loadAssessments();
    
    // Read year from URL parameter
    const yearParam = getUrlParam('year');
    if (yearParam) {
      const year = parseInt(yearParam, 10);
      if (!isNaN(year) && availableYears.includes(year)) {
        selectedYear = year;
      }
    }
    
    highlightAssessmentFromQuery();
  });
</script>

<div class="p-4 sm:p-6">
  <!-- Consolidated Header -->
  <div
    class="flex flex-col gap-4 mb-6 p-4 rounded-xl border backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
    <div class="flex flex-col gap-4 justify-between items-start sm:flex-row sm:items-center">
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
        <T key="navigation.assessments" fallback="Assessments" />
      </h1>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <!-- Year Filter Dropdown -->
        {#if availableYears && availableYears.length > 0}
          <div class="flex items-center gap-2">
            <label for="year-select" class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <T key="assessments.year" fallback="Year:" />
            </label>
            <div class="relative">
              <select
                id="year-select"
                class="appearance-none px-3 py-2 pr-8 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent cursor-pointer"
                bind:value={selectedYear}
                onchange={(e) => {
                  const target = e.target as HTMLSelectElement;
                  handleYearChange(Number(target.value));
                }}
                onwheel={(e) => {
                  e.preventDefault();
                  const currentIndex = availableYears.indexOf(selectedYear);
                  if (e.deltaY > 0 && currentIndex < availableYears.length - 1) {
                    handleYearChange(availableYears[currentIndex + 1]);
                  } else if (e.deltaY < 0 && currentIndex > 0) {
                    handleYearChange(availableYears[currentIndex - 1]);
                  }
                }}>
                {#each availableYears as year}
                  <option value={year}>{year}</option>
                {/each}
              </select>
              <svg
                class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        {/if}

        <!-- View Selector Dropdown -->
        <div class="flex items-center gap-2">
          <label for="view-select" class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <T key="assessments.view" fallback="View:" />
          </label>
          <div class="relative">
            <select
              id="view-select"
              class="appearance-none px-3 py-2 pr-8 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent cursor-pointer"
              bind:value={selectedTab}
              onchange={(e) => {
                const target = e.target as HTMLSelectElement;
                handleTabChange(target.value as 'list' | 'board' | 'calendar' | 'gantt');
              }}
              onwheel={(e) => {
                e.preventDefault();
                const options = ['list', 'board', 'calendar', 'gantt'] as const;
                const currentIndex = options.indexOf(selectedTab);
                if (e.deltaY > 0 && currentIndex < options.length - 1) {
                  handleTabChange(options[currentIndex + 1]);
                } else if (e.deltaY < 0 && currentIndex > 0) {
                  handleTabChange(options[currentIndex - 1]);
                }
              }}>
              <option value="list">{$_('assessments.list_view') || 'List View'}</option>
              <option value="board">{$_('assessments.board_view') || 'Board View'}</option>
              <option value="calendar">{$_('assessments.calendar_view') || 'Calendar View'}</option>
              <option value="gantt">{$_('assessments.gantt_view') || 'Gantt View'}</option>
            </select>
            <svg
              class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Content Area -->
  <div class="space-y-6">
    <!-- Main Assessment Content -->
    {#if loadingAssessments}
      <div class="flex justify-center items-center py-12">
        <LoadingSpinner message={$_('assessments.loading') || 'Loading assessments...'} />
      </div>
    {:else if filteredAssessments.length === 0}
      <div class="py-12">
        <EmptyState
          title={$_('assessments.no_assessments_year')?.replace(
            '{year}',
            selectedYear.toString(),
          ) || `No assessments for ${selectedYear}!`}
          message={$_('assessments.try_different_year') || 'Try selecting a different year.'}
          icon={ClipboardDocumentList} />
      </div>
    {:else}
      <!-- Board View Options -->
      {#if selectedTab === 'board'}
        <div
          class="flex items-center gap-4 p-4 rounded-xl border backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
          <label for="group-by-select" class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <T key="assessments.group_by" fallback="Group by:" />
          </label>
          <div class="relative">
            <select
              id="group-by-select"
              class="appearance-none px-3 py-2 pr-8 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200 hover:border-accent cursor-pointer"
              bind:value={groupBy}
              onchange={(e) => {
                const target = e.target as HTMLSelectElement;
                handleGroupByChange(target.value as 'subject' | 'month' | 'status');
              }}
              onwheel={(e) => {
                e.preventDefault();
                const options = ['subject', 'month', 'status'] as const;
                const currentIndex = options.indexOf(groupBy);
                if (e.deltaY > 0 && currentIndex < options.length - 1) {
                  handleGroupByChange(options[currentIndex + 1]);
                } else if (e.deltaY < 0 && currentIndex > 0) {
                  handleGroupByChange(options[currentIndex - 1]);
                }
              }}>
              <option value="subject">{$_('assessments.subject') || 'Subject'}</option>
              <option value="month">{$_('assessments.month') || 'Month'}</option>
              <option value="status">{$_('assessments.status') || 'Status'}</option>
            </select>
            <svg
              class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <AssessmentBoardView
          assessments={filteredAssessments}
          subjects={allSubjects}
          {activeSubjects}
          {groupBy}
          onGroupByChange={handleGroupByChange} />
      {:else if selectedTab === 'calendar'}
        <AssessmentCalendarView assessments={filteredAssessments} />
      {:else if selectedTab === 'gantt'}
        <AssessmentGanttView
          assessments={filteredAssessments}
          subjects={allSubjects}
          {activeSubjects} />
      {:else}
        <AssessmentListView
          assessments={filteredAssessments}
          subjects={allSubjects}
          {activeSubjects}
          {availableYears}
          {selectedYear}
          onYearChange={handleYearChange} />
      {/if}
    {/if}
  </div>
</div>
