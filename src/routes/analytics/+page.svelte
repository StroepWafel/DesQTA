<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { AnalyticsData, Assessment } from '$lib/types';
  import { fade } from 'svelte/transition';
  import { Button } from '$lib/components/ui';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import RawDataTable from '$lib/components/RawDataTable.svelte';
  import AnalyticsAreaChart from '$lib/components/analytics/AnalyticsAreaChart.svelte';
  import AnalyticsBarChart from '$lib/components/analytics/AnalyticsBarChart.svelte';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Slider } from '$lib/components/ui/slider/index.js';
  import { Icon, MagnifyingGlass, Trash } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';

  let analyticsData: AnalyticsData | null = $state(null);
  let loading = $state(true);
  let syncing = $state(false);
  let lastUpdated: Date | null = $state(null);
  let timestampRefresh = $state(0); // Used to trigger reactive updates
  let error: string | null = $state(null);
  let showDeleteModal = $state(false);
  let deleteLoading = $state(false);
  let deleteError: string | null = $state(null);

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
      logger.warn('analytics', 'loadAnalyticsData', 'no local analytics file found or failed to parse', { error: e });
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
      logger.warn('analytics', 'loadAnalyticsData', 'Failed to load existing analytics data', { error: e });
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
    } catch (e) {
      logger.error('analytics', 'onMount', `Failed to sync analytics data: ${e}`, { error: e });
      error = $_('analytics.sync_failed') || 'Failed to sync analytics data, showing cached data.';
    } finally {
      syncing = false;
    }
  });

  onDestroy(() => {
    if (timestampInterval) {
      clearInterval(timestampInterval);
    }
  });

  function openDeleteModal() {
    showDeleteModal = true;
    deleteError = null;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteError = null;
  }

  async function confirmDeleteAnalytics() {
    deleteLoading = true;
    deleteError = null;
    try {
      await invoke('delete_analytics');
      analyticsData = [];
      showDeleteModal = false;
      // Sync and reload data after deletion
      loading = true;
      await invoke<string>('sync_analytics_data');
      await loadAnalyticsData();
    } catch (e) {
      deleteError = $_('analytics.failed_to_delete_data') || 'Failed to delete analytics data';
    } finally {
      deleteLoading = false;
      loading = false;
    }
  }

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
          <div
            class="flex items-center gap-2 px-3 py-1 text-sm text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/30 rounded-lg">
            <div
              class="w-4 h-4 rounded-full border-2 border-accent-600 dark:border-accent-400 border-t-transparent animate-spin">
            </div>
            <span><T key="analytics.syncing" fallback="Syncing..." /></span>
          </div>
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

    {#if analyticsData}
      <div class="flex items-center gap-3">
        <Button class="flex items-center gap-2" variant="ghost" onclick={openDeleteModal}>
          <Icon size="20" src={Trash} />
          <T key="analytics.delete_data" fallback="Delete Data" />
        </Button>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="w-12 h-12 rounded-full border-b-2 border-accent-600 animate-spin"></div>
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

      <div class="flex items-center gap-2 pl-2">
        <span class="text-xs text-zinc-500 dark:text-zinc-400">
          <T key="analytics.grade_range" fallback="Grade Range" />
        </span>
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

      <div class="relative ml-auto">
        <Icon
          src={MagnifyingGlass}
          class="absolute left-2 top-1/2 size-4 transform -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        <input
          type="text"
          placeholder={$_('analytics.search_placeholder') || 'Search assessments...'}
          bind:value={filterSearch}
          class="flex pl-7 h-9 w-56 rounded-md border border-zinc-200 bg-white dark:bg-zinc-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-700 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300" />
      </div>
    </div>

    <!-- Main Analytics Charts -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2" in:fade={{ duration: 400, delay: 100 }}>
      <AnalyticsAreaChart data={filteredData()} />
      <AnalyticsBarChart data={filteredData()} />
    </div>

    <!-- Assessment Data Table -->
    <div in:fade={{ duration: 400, delay: 200 }}>
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
  {:else}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div class="mb-4 text-zinc-500 dark:text-zinc-400">
        <T key="analytics.no_data_available" fallback="No analytics data available" />
      </div>
      {#if error}
        <div
          class="px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          {error}
        </div>
      {:else}
        <p class="text-sm text-zinc-400 dark:text-zinc-500">
          <T
            key="analytics.syncing_automatically"
            fallback="Data syncs automatically when you visit this page. If you have assessments with released marks, they will appear here." />
        </p>
      {/if}
    </div>
  {/if}

  <AlertDialog.Root bind:open={showDeleteModal}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>
          <T key="analytics.delete_confirmation_title" fallback="Delete Analytics Data?" />
        </AlertDialog.Title>
        <AlertDialog.Description>
          <T
            key="analytics.delete_confirmation_description"
            fallback="Are you sure you want to delete all analytics data? This action cannot be undone." />
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if deleteError}
        <div class="mb-4 text-red-600 dark:text-red-400">{deleteError}</div>
      {/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={closeDeleteModal} disabled={deleteLoading}>
          <T key="common.cancel" fallback="Cancel" />
        </AlertDialog.Cancel>
        <AlertDialog.Action onclick={confirmDeleteAnalytics} disabled={deleteLoading}>
          {#if deleteLoading}
            <span
              class="inline-block w-5 h-5 mr-2 align-middle rounded-full border-2 border-white animate-spin border-t-transparent"
            ></span>
          {/if}
          <T key="common.delete" fallback="Delete" />
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</div>
