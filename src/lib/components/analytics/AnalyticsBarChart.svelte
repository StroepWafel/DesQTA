<script lang="ts">
  import { scaleBand, scaleLinear } from 'd3-scale';
  import { BarChart, type ChartContextValue } from 'layerchart';
  import * as Chart from '$lib/components/ui/chart/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { cubicInOut } from 'svelte/easing';
  import type { Assessment } from '$lib/types';
  import T from '../T.svelte';
  import { _ } from '../../i18n';

  interface Props {
    data: Assessment[];
  }

  let { data }: Props = $props();

  let timeframe = $state('all');

  const chartConfig = {
    count: {
      label: $_('analytics.assessments') || 'Assessments',
      color: 'var(--accent-color-value)',
    },
  } satisfies Chart.ChartConfig;

  let context = $state<ChartContextValue>();

  // Get available years from data
  let availableYears = $derived.by(() => {
    if (!data?.length) return [];

    const years = new Set<number>();
    data.forEach((assessment) => {
      if (assessment.finalGrade !== undefined) {
        const year = new Date(assessment.due).getFullYear();
        years.add(year);
      }
    });

    return Array.from(years).sort((a, b) => b - a); // Most recent first
  });

  // Filter data by timeframe
  let filteredData = $derived.by(() => {
    if (!data?.length) return [];

    return data.filter((assessment) => {
      if (assessment.finalGrade === undefined) return false;

      if (timeframe === 'all') return true;

      const assessmentDate = new Date(assessment.due);
      const selectedYear = parseInt(timeframe);

      return assessmentDate.getFullYear() === selectedYear;
    });
  });

  // Create grade distribution data
  let chartData = $derived.by(() => {
    const gradeRanges = [
      { range: '90-100', min: 90, max: 100, count: 0 },
      { range: '80-89', min: 80, max: 89, count: 0 },
      { range: '70-79', min: 70, max: 79, count: 0 },
      { range: '60-69', min: 60, max: 69, count: 0 },
      { range: '50-59', min: 50, max: 59, count: 0 },
      { range: '0-49', min: 0, max: 49, count: 0 },
    ];

    filteredData.forEach((assessment) => {
      const grade = assessment.finalGrade!;
      const range = gradeRanges.find((r) => grade >= r.min && grade <= r.max);
      if (range) range.count++;
    });

    return gradeRanges.map((r) => ({
      grade: r.range,
      count: r.count,
    }));
  });

  let timeframeLabel = $derived.by(() => {
    if (timeframe === 'all') return $_('analytics.all_time') || 'All Time';
    return timeframe; // Will be the year as a string
  });

  let totalAssessments = $derived(filteredData.length);
  let averageGrade = $derived.by(() => {
    if (filteredData.length === 0) return 0;
    const sum = filteredData.reduce((acc, a) => acc + a.finalGrade!, 0);
    return Math.round((sum / filteredData.length) * 10) / 10;
  });
</script>

<Card.Root>
  <Card.Header>
    <div class="flex justify-between items-start">
      <div>
        <Card.Title>
          <T key="analytics.grade_distribution" fallback="Grade Distribution" />
        </Card.Title>
        <Card.Description>
          <T
            key="analytics.assessments_per_grade_range"
            fallback="Number of assessments per grade range"
            values={{ timeframe: timeframeLabel }} />
        </Card.Description>
      </div>
      <Select.Root type="single" bind:value={timeframe}>
        <Select.Trigger class="w-[140px]">
          {timeframeLabel}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all" label={$_('analytics.all_time') || 'All Time'} />
          {#each availableYears as year}
            <Select.Item value={year.toString()} label={year.toString()} />
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </Card.Header>
  <Card.Content>
    {#if totalAssessments > 0}
      <Chart.Container config={chartConfig} class="h-[400px]">
        <BarChart
          bind:context
          data={chartData}
          xScale={scaleBand().padding(0.25)}
          yScale={scaleLinear()}
          x="grade"
          y="count"
          axis="x"
          series={[{ key: 'count', label: 'Assessments', color: chartConfig.count.color }]}
          props={{
            bars: {
              stroke: 'none',
              rounded: 'all',
              radius: 8,
              initialY: context?.height,
              initialHeight: 0,
              motion: {
                x: { type: 'tween', duration: 500, easing: cubicInOut },
                width: { type: 'tween', duration: 500, easing: cubicInOut },
                height: { type: 'tween', duration: 500, easing: cubicInOut },
                y: { type: 'tween', duration: 500, easing: cubicInOut },
              },
            },
            highlight: { area: { fill: 'none' } },
            xAxis: { format: (d) => d },
            yAxis: { format: (d) => d.toString() },
          }}>
          {#snippet tooltip()}
            <Chart.Tooltip hideLabel />
          {/snippet}
        </BarChart>
      </Chart.Container>
    {:else}
      <div
        class="flex flex-col justify-center items-center h-[400px] text-zinc-500 dark:text-zinc-400">
        <p class="text-lg">
          <T key="analytics.no_graded_assessments" fallback="No graded assessments found" />
        </p>
        <p class="text-sm">
          <T
            key="analytics.for_timeframe"
            fallback="for timeframe"
            values={{ timeframe: timeframeLabel.toLowerCase() }} />
        </p>
      </div>
    {/if}
  </Card.Content>
  <Card.Footer>
    <div class="flex gap-2 items-start w-full text-sm">
      <div class="grid gap-2">
        <div class="flex gap-2 items-center leading-none text-muted-foreground">
          <T
            key="analytics.average_grade_summary"
            fallback="Average grade summary"
            values={{
              grade: averageGrade,
              count: totalAssessments,
              timeframe: timeframeLabel.toLowerCase(),
            }} />
        </div>
      </div>
    </div>
  </Card.Footer>
</Card.Root>
