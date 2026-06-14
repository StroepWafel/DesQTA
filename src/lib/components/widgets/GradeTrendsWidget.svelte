<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { Assessment } from '../../types';
  import AnalyticsAreaChart from '../analytics/AnalyticsAreaChart.svelte';
  import { ChartBar } from 'svelte-hero-icons';
  import { logger } from '../../../utils/logger';
  import WidgetCard from '../dashboard/WidgetCard.svelte';

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

<WidgetCard
  icon={ChartBar}
  title="Grade Trends"
  {loading}
  empty={!loading && !error && analyticsData.length === 0}
  emptyTitle="No grade data available"
  emptyIcon={ChartBar}>
  {#if error}
    <div class="h-full flex items-center justify-center text-sm text-destructive">{error}</div>
  {:else}
    <div class="h-full w-full overflow-hidden">
      <AnalyticsAreaChart data={analyticsData} />
    </div>
  {/if}
</WidgetCard>
