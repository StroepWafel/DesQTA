<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { invoke } from '@tauri-apps/api/core';
  import type { Assessment } from '../../types';
  import AnalyticsAreaChart from '../analytics/AnalyticsAreaChart.svelte';
  import { Icon, ChartBar } from 'svelte-hero-icons';
  import { logger } from '../../../utils/logger';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  let analyticsData = $state<Assessment[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  function parseAssessment(data: any): Assessment | null {
    try {
      if (!data || typeof data !== 'object') return null;

      const assessment: Assessment = {
        id: data.id || data.assessmentID || 0,
        title: data.title || data.name || 'Untitled',
        subject: data.subject || data.code || '',
        finalGrade: data.finalGrade ?? data.grade ?? null,
        due: data.due || data.dueDate || '',
        code: data.code || '',
        metaclassID: data.metaclassID || 0,
        programmeID: data.programmeID || 0,
        graded: data.graded || false,
        overdue: data.overdue || false,
        hasFeedback: data.hasFeedback || false,
        expectationsEnabled: data.expectationsEnabled || false,
        expectationsCompleted: data.expectationsCompleted || false,
        reflectionsEnabled: data.reflectionsEnabled || false,
        reflectionsCompleted: data.reflectionsCompleted || false,
        availability: data.availability || '',
        status: data.status || 'PENDING',
      };

      return assessment;
    } catch (e) {
      return null;
    }
  }

  async function loadAnalyticsData() {
    loading = true;
    error = null;
    try {
      const response = await invoke<string>('load_analytics');
      const parsedData = JSON.parse(response);
      const rawAssessments = Array.isArray(parsedData) ? parsedData : Object.values(parsedData);
      const validAssessments = rawAssessments
        .map(parseAssessment)
        .filter((assessment): assessment is Assessment => assessment !== null);

      // Sort by date - AnalyticsAreaChart handles all filtering
      analyticsData = validAssessments.sort((a, b) => {
        const dateA = a.due ? new Date(a.due).getTime() : 0;
        const dateB = b.due ? new Date(b.due).getTime() : 0;
        return dateA - dateB;
      });
    } catch (e) {
      logger.error('GradeTrendsWidget', 'loadAnalyticsData', `Failed to load analytics: ${e}`, {
        error: e,
      });
      error = 'Failed to load grade data';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadAnalyticsData();
  });
</script>

<div class="flex flex-col h-full min-h-0">
  <div
    class="flex items-center gap-2 mb-3 sm:mb-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: left center;">
    <div
      class="transition-all duration-300"
      in:scale={{ duration: 300, delay: 100, easing: cubicInOut, start: 0.8 }}>
      <Icon
        src={ChartBar}
        class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    </div>
    <h3
      class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300"
      in:fade={{ duration: 300, delay: 150 }}>
      Grade Trends
    </h3>
  </div>

  {#if loading}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading grade data...
      </p>
    </div>
  {:else if error}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <p class="text-xs sm:text-sm text-red-600 dark:text-red-400">{error}</p>
    </div>
  {:else if analyticsData.length === 0}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">No grade data available</p>
    </div>
  {:else}
    <div
      class="flex-1 min-h-0 w-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 400, delay: 100 }}
      style="transform-origin: center center;">
      <AnalyticsAreaChart data={analyticsData} />
    </div>
  {/if}
</div>
