<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { AnalyticsData, Assessment } from '$lib/types';
  import { fade } from 'svelte/transition';
  import { Button, Badge, SearchInput, EmptyState } from '$lib/components/ui';
  import { ExclamationTriangle, ChartBar } from 'svelte-hero-icons';
  import RawDataTable from '$lib/components/RawDataTable.svelte';
  import AnalyticsAreaChart from '$lib/components/analytics/AnalyticsAreaChart.svelte';
  import AnalyticsBarChart from '$lib/components/analytics/AnalyticsBarChart.svelte';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Label from '$lib/components/ui/label/index.js';
  import { Slider } from '$lib/components/ui/slider/index.js';
  import { Icon } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';

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

  function isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }

  function parseAssessment(data: any): Assessment | null {
    try {
      if (!data || typeof data !== 'object') return null;

      // Extract finalGrade: check finalGrade field first, then results.percentage (matching Rust sync logic)
      let finalGrade = undefined;
      if (data.finalGrade !== undefined && data.finalGrade !== null) {
        finalGrade = Number(data.finalGrade);
      } else if (data.status === 'MARKS_RELEASED') {
        // Fallback to results.percentage if finalGrade is not set but marks are released
        if (data.criteria && data.criteria[0]?.results?.percentage !== undefined) {
          finalGrade = Number(data.criteria[0].results.percentage);
        } else if (data.results && data.results.percentage !== undefined) {
          finalGrade = Number(data.results.percentage);
        }
      }

      // Extract letterGrade from assessment data (if available)
      let letterGrade = undefined;
      if (data.letterGrade !== undefined && data.letterGrade !== null) {
        letterGrade = String(data.letterGrade);
      } else if (data.criteria && data.criteria[0]?.results?.grade) {
        // Extract from criteria[0].results.grade (matching assessment detail page)
        letterGrade = String(data.criteria[0].results.grade);
      } else if (data.results && data.results.grade) {
        // Fallback to results.grade
        letterGrade = String(data.results.grade);
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

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
      toastStore.success('Analytics data synced successfully');
    } catch (e) {
      logger.error('analytics', 'onMount', `Failed to sync analytics data: ${e}`, { error: e });
      error = $_('analytics.sync_failed') || 'Failed to sync analytics data, showing cached data.';

      // Show error toast notification
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.error('Failed to sync analytics data');
    } finally {
      syncing = false;
    }
  });

  onDestroy(() => {
    if (timestampInterval) {
      clearInterval(timestampInterval);
    }
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

<div class="container px-6 py-7 mx-auto flex flex-col h-full gap-8">
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
      <Select.Root type="multiple" bind:value={filterSubjects}>
        <Select.Trigger class="w-44">
          <span class="truncate">
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
        </Select.Trigger>
        <Select.Content>
          {#each uniqueSubjects() as subject}
            <Select.Item value={subject} label={subject}>{subject}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>

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
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
