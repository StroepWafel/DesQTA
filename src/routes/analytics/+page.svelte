<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { AnalyticsData, Assessment } from '$lib/types';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { platformStore } from '$lib/stores/platform';

  let isMobile = $derived($platformStore.isMobile);
  import { Button, Badge, SearchInput, EmptyState } from '$lib/components/ui';
  import { ExclamationTriangle, ChartBar } from 'svelte-hero-icons';
  import RawDataTable from '$lib/components/RawDataTable.svelte';
  import AnalyticsAreaChart from '$lib/components/analytics/AnalyticsAreaChart.svelte';
  import AnalyticsBarChart from '$lib/components/analytics/AnalyticsBarChart.svelte';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Label from '$lib/components/ui/label/index.js';
  import { clickOutside } from '$lib/actions/clickOutside.js';
  import { ChevronDown } from 'svelte-hero-icons';
  import { Slider } from '$lib/components/ui/slider/index.js';
  import { Icon } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { get } from 'svelte/store';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';
  import { analyticsCrunching } from '../../lib/stores/analyticsOnboarding';
  import {
    resolveNumericGradeFromAssessmentPayload,
    extractLetterGradeStringFromPayload,
  } from '$lib/utils/letterGradeScale';

  let analyticsData: AnalyticsData | null = $state(null);
  let loading = $state(true);
  let syncing = $state(false);
  let lastUpdated: Date | null = $state(null);
  let timestampRefresh = $state(0); // Used to trigger reactive updates
  let error: string | null = $state(null);

  // Update timestamp display every minute
  let timestampInterval: ReturnType<typeof setInterval> | null = null;

  // Reactive formatted timestamp that updates every minute
  const formattedTimestamp = $derived(() => {
    if (!lastUpdated) return '';
    timestampRefresh; // Reference to trigger reactivity
    return formatLastUpdated(lastUpdated);
  });

  // Filter state
  let filterSubjects: string[] = $state([]);
  let filterMinGrade: number | null = $state(null);
  let filterMaxGrade: number | null = $state(null);
  let filterSearch = $state('');
  let gradeRange = $state([0, 100]);
  let showSubjectsDropdown = $state(false);

  function isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }

  function parseAssessment(data: any): Assessment | null {
    try {
      if (!data || typeof data !== 'object') return null;

      const letterGrade = extractLetterGradeStringFromPayload(data);
      // Percentage first, then letter → approximate % (letter-only schools)
      let finalGrade = resolveNumericGradeFromAssessmentPayload(data);
      if (finalGrade !== undefined && (typeof finalGrade !== 'number' || isNaN(finalGrade))) {
        finalGrade = undefined;
      }

      const assessment: Assessment = {
        id: Number(data.id),
        title: String(data.title || ''),
        subject: String(data.subject || ''),
        status: String(data.status || 'PENDING') as 'OVERDUE' | 'MARKS_RELEASED' | 'PENDING',
        due: String(data.due || ''),
        code: String(data.code || ''),
        metaclassID: Number(data.metaclassID),
        programmeID: Number(data.programmeID),
        graded: Boolean(data.graded),
        overdue: Boolean(data.overdue),
        hasFeedback: Boolean(data.hasFeedback),
        expectationsEnabled: Boolean(data.expectationsEnabled),
        expectationsCompleted: Boolean(data.expectationsCompleted),
        reflectionsEnabled: Boolean(data.reflectionsEnabled),
        reflectionsCompleted: Boolean(data.reflectionsCompleted),
        availability: String(data.availability || ''),
        finalGrade,
        letterGrade,
      };

      if (
        !assessment.id ||
        !assessment.title ||
        !assessment.subject ||
        !isValidDate(assessment.due)
      ) {
        return null;
      }

      return assessment;
    } catch (e) {
      logger.error('analytics', 'loadAnalyticsData', 'Error parsing assessment', { error: e });
      return null;
    }
  }

  async function loadAnalyticsData() {
    try {
      console.log('Loading analytics data...');
      const response = await invoke<string>('load_analytics');
      console.log('Received raw data:', response);
      const parsedData = JSON.parse(response);
      const rawAssessments = Array.isArray(parsedData) ? parsedData : Object.values(parsedData);
      const validAssessments = rawAssessments
        .map(parseAssessment)
        .filter((assessment): assessment is Assessment => assessment !== null);
      console.log('Valid assessments:', validAssessments);
      analyticsData = validAssessments;
      lastUpdated = new Date();
      error = null;
    } catch (e) {
      logger.warn(
        'analytics',
        'loadAnalyticsData',
        'no local analytics file found or failed to parse',
        { error: e },
      );
      analyticsData = [];
      error = null; // Don't show error, just show empty state
    }
  }

  function formatLastUpdated(date: Date | null): string {
    if (!date) return '';
    const t = get(_);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('analytics.time_just_now');
    if (diffMins < 60) return t('analytics.time_minutes_ago', { values: { count: diffMins } });
    if (diffHours < 24) return t('analytics.time_hours_ago', { values: { count: diffHours } });
    if (diffDays < 7) return t('analytics.time_days_ago', { values: { count: diffDays } });

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  onMount(async () => {
    // Set up interval to refresh timestamp display every minute
    timestampInterval = setInterval(() => {
      timestampRefresh = Date.now();
    }, 60000); // Update every minute

    // Load existing data immediately (if available)
    try {
      await loadAnalyticsData();
    } catch (e) {
      logger.warn('analytics', 'loadAnalyticsData', 'Failed to load existing analytics data', {
        error: e,
      });
    } finally {
      loading = false;
    }

    // Then sync in the background and refresh data when complete
    syncing = true;
    try {
      logger.debug('analytics', 'onMount', 'Syncing analytics data in background');
      await invoke<string>('sync_analytics_data');
      logger.debug('analytics', 'onMount', 'Analytics data synced successfully');

      // Reload data after sync completes
      await loadAnalyticsData();
      error = null;

      // Show success toast notification
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.success(get(_)('analytics.sync_success'));
    } catch (e) {
      logger.error('analytics', 'onMount', `Failed to sync analytics data: ${e}`, { error: e });
      error = $_('analytics.sync_failed') || 'Failed to sync analytics data, showing cached data.';

      // Show error toast notification
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.error(get(_)('analytics.sync_error'));
    } finally {
      syncing = false;
    }
  });

  $effect(() => {
    analyticsCrunching.set(loading || syncing);
  });

  onDestroy(() => {
    if (timestampInterval) {
      clearInterval(timestampInterval);
    }
    analyticsCrunching.set(false);
  });

  // Derived unique values for filter options
  const uniqueSubjects = $derived(() => {
    if (!analyticsData) return [];
    return [...new Set(analyticsData.map((a) => a.subject))].sort();
  });

  function clearFilters() {
    filterSubjects = [];
    filterMinGrade = null;
    filterMaxGrade = null;
    filterSearch = '';
    gradeRange = [0, 100];
  }

  // Sync slider with individual grade filters
  $effect(() => {
    filterMinGrade = gradeRange[0] === 0 ? null : gradeRange[0];
    filterMaxGrade = gradeRange[1] === 100 ? null : gradeRange[1];
  });

  // Derived filtered data
  const filteredData = $derived(() => {
    if (!analyticsData) return [];
    return analyticsData.filter((a) => {
      if (filterSubjects.length && !filterSubjects.includes(a.subject)) return false;
      if (filterMinGrade !== null && (a.finalGrade ?? -1) < filterMinGrade) return false;
      if (filterMaxGrade !== null && (a.finalGrade ?? 101) > filterMaxGrade) return false;
      if (
        filterSearch &&
        !(
          a.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
          a.subject.toLowerCase().includes(filterSearch.toLowerCase())
        )
      )
        return false;
      return true;
    });
  });

  function hasActiveFilters() {
    return !!(
      filterSubjects.length ||
      filterMinGrade !== null ||
      filterMaxGrade !== null ||
      filterSearch
    );
  }

  function calculateMonthlyAverages(data: any[]): Record<string, number> {
    const monthlyGrades: Record<string, { sum: number; count: number }> = {};
    data.forEach((assessment: any) => {
      const date = new Date(assessment.due);
      const monthKey = date.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });
      if (!monthlyGrades[monthKey]) {
        monthlyGrades[monthKey] = { sum: 0, count: 0 };
      }
      monthlyGrades[monthKey].sum += assessment.finalGrade;
      monthlyGrades[monthKey].count += 1;
    });
    const averages: Record<string, number> = {};
    Object.entries(monthlyGrades).forEach(([month, { sum, count }]) => {
      averages[month] = count > 0 ? sum / count : 0;
    });
    // Fill in missing months with the previous month's average
    const monthMap: Record<string, number> = {
      January: 0,
      February: 1,
      March: 2,
      April: 3,
      May: 4,
      June: 5,
      July: 6,
      August: 7,
      September: 8,
      October: 9,
      November: 10,
      December: 11,
    };
    const months = Object.keys(averages).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(Number(yearA), monthMap[monthA], 1);
      const dateB = new Date(Number(yearB), monthMap[monthB], 1);
      return dateA.getTime() - dateB.getTime();
    });
    let lastAvg = 0;
    for (let i = 0; i < months.length; i++) {
      if (averages[months[i]] === undefined || isNaN(averages[months[i]])) {
        averages[months[i]] = lastAvg;
      } else {
        lastAvg = averages[months[i]];
      }
    }
    return averages;
  }
</script>

<div class="container max-w-none w-full p-5 mx-auto flex flex-col h-full gap-8">
  <div class="flex justify-between items-start">
    <div class="flex-1">
      <div class="flex items-center gap-3 mb-2">
        <h1 class="text-3xl font-bold text-zinc-900 dark:text-white">
          <T key="navigation.analytics" fallback="Analytics" />
        </h1>
        {#if syncing}
          <Badge variant="primary" size="sm" class="animate-pulse">
            <div
              class="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin mr-1">
            </div>
            <T key="analytics.syncing" fallback="Syncing..." />
          </Badge>
        {/if}
      </div>
      <p class="text-zinc-600 dark:text-zinc-400">
        <T
          key="analytics.description"
          fallback="Track your academic performance and progress over time" />
      </p>
      {#if lastUpdated && analyticsData && analyticsData.length > 0}
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          <T key="analytics.last_updated" fallback="Last updated" />: {formattedTimestamp()}
        </p>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div
        class="w-12 h-12 rounded-full border-4 border-accent-600/30 border-t-accent-600 animate-spin">
      </div>
    </div>
  {:else if analyticsData && analyticsData.length > 0}
    <!-- Compact filters near heading -->
    <div class="flex flex-wrap items-center gap-4 -mb-4" in:fade={{ duration: 400 }}>
      <div class="relative" use:clickOutside={() => (showSubjectsDropdown = false)}>
        <button
          type="button"
          class="flex gap-2 items-center min-h-[44px] w-44 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 accent-ring transition-all duration-200"
          onclick={() => (showSubjectsDropdown = !showSubjectsDropdown)}
          aria-expanded={showSubjectsDropdown}
          aria-haspopup="listbox">
          <span class="truncate flex-1 text-left text-sm">
            {#if filterSubjects.length === 0}
              <T key="analytics.all_subjects" fallback="All Subjects" />
            {:else if filterSubjects.length === 1}
              {filterSubjects[0]}
            {:else}
              <T
                key="analytics.subjects_selected"
                fallback="subjects selected"
                values={{ count: filterSubjects.length }} />
            {/if}
          </span>
          <Icon src={ChevronDown} class="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200 {showSubjectsDropdown ? 'rotate-180' : ''}" />
        </button>
        {#if showSubjectsDropdown}
          <div
            class="absolute left-0 z-50 mt-2 w-56 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            role="listbox"
            transition:fly={{ y: -6, duration: 150, easing: cubicOut }}>
            <button
              type="button"
              role="option"
              aria-selected={filterSubjects.length === 0}
              class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors {filterSubjects.length === 0
                ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
              onclick={() => {
                filterSubjects = [];
                showSubjectsDropdown = false;
              }}>
              <span class="w-4 shrink-0 flex justify-center">{filterSubjects.length === 0 ? '✓' : ''}</span>
              <T key="analytics.all_subjects" fallback="All Subjects" />
            </button>
            {#each uniqueSubjects() as subject}
              {@const isSelected = filterSubjects.includes(subject)}
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors {isSelected
                  ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
                onclick={() => {
                  filterSubjects = isSelected
                    ? filterSubjects.filter((s) => s !== subject)
                    : [...filterSubjects, subject];
                }}>
                <span class="w-4 shrink-0 flex justify-center">{isSelected ? '✓' : ''}</span>
                <span class="truncate">{subject}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <Label.Root class="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
          <T key="analytics.grade_range" fallback="Grade Range" />
        </Label.Root>
        <div class="flex items-center gap-2 w-48">
          <Slider
            type="multiple"
            bind:value={gradeRange}
            min={0}
            max={100}
            step={1}
            class="flex-1" />
        </div>
        <div class="text-xs text-zinc-500 dark:text-zinc-400 min-w-fit">
          {gradeRange[0]}%-{gradeRange[1]}%
        </div>
      </div>

      <div class="ml-auto">
        <SearchInput
          bind:value={filterSearch}
          placeholder={$_('analytics.search_placeholder') || 'Search assessments...'}
          size="sm"
          class="w-56" />
      </div>
    </div>

    <!-- Main Analytics Charts -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2" data-onboarding="analytics-chart">
      {#key filteredData().length + filteredData()
          .map((d) => d.id)
          .join(',')}
        <div class="analytics-chart-animate" style="animation-delay: 0ms;">
          <AnalyticsAreaChart data={filteredData()} />
        </div>
        <div class="analytics-chart-animate" style="animation-delay: 100ms;">
          <AnalyticsBarChart data={filteredData()} />
        </div>
      {/key}
    </div>

    <!-- Assessment Data Table -->
    <div class="analytics-table-animate" style="animation-delay: 200ms;">
      <RawDataTable data={filteredData()} />
    </div>

    <div class="flex items-center gap-3 ml-auto pb-4">
      <div class="text-sm text-zinc-600 dark:text-zinc-400">
        <T
          key="analytics.assessments_count"
          fallback="assessments shown"
          values={{ filtered: filteredData().length, total: analyticsData.length }} />
      </div>
      {#if hasActiveFilters()}
        <Button variant="ghost" size="sm" onclick={clearFilters}>
          <T key="analytics.clear_filters" fallback="Clear Filters" />
        </Button>
      {/if}
    </div>
  {:else if error}
    <EmptyState
      title={$_('analytics.no_data_available') || 'No analytics data available'}
      message={error}
      icon={ExclamationTriangle}
      size="md" />
  {:else}
    <EmptyState
      title={$_('analytics.no_data_available') || 'No analytics data available'}
      message={$_('analytics.syncing_automatically') ||
        'Data syncs automatically when you visit this page. If you have assessments with released marks, they will appear here.'}
      icon={ChartBar}
      size="md" />
  {/if}
</div>

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .analytics-chart-animate,
  .analytics-table-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
