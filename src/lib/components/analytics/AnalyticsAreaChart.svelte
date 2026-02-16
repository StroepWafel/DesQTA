<script lang="ts">
  import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
  import * as Chart from '$lib/components/ui/chart/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { scaleUtc } from 'd3-scale';
  import { Area, AreaChart, ChartClipPath } from 'layerchart';
  import { curveNatural } from 'd3-shape';
  import { cubicInOut } from 'svelte/easing';
  import type { Assessment } from '$lib/types';
  import T from '../T.svelte';
  import { _ } from '../../i18n';

  interface Props {
    data: Assessment[];
  }

  let { data }: Props = $props();

  let timeRange = $state('all');

  const selectedLabel = $derived.by(() => {
    switch (timeRange) {
      case '90d':
        return $_('analytics.last_3_months') || 'Last 3 months';
      case '30d':
        return $_('analytics.last_30_days') || 'Last 30 days';
      case '7d':
        return $_('analytics.last_7_days') || 'Last 7 days';
      case '365d':
        return $_('analytics.last_12_months') || 'Last 12 months';
      case 'all':
        return $_('analytics.all_time') || 'All Time';
      default:
        return $_('analytics.all_time') || 'All Time';
    }
  });

  // Process data into chart format with adaptive granularity
  const chartData = $derived(() => {
    if (!data?.length) return [];

    // Determine if we should use monthly or weekly grouping
    const useMonthlyGrouping = timeRange === '365d' || timeRange === 'all';

    if (useMonthlyGrouping) {
      // Group by month for longer time periods
      const monthlyData: Record<string, number[]> = {};

      data.forEach((assessment) => {
        if (assessment.finalGrade !== undefined && assessment.finalGrade !== null) {
          const date = new Date(assessment.due);
          const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format

          if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
          monthlyData[monthKey].push(assessment.finalGrade);
        }
      });

      return Object.entries(monthlyData)
        .map(([month, grades]) => ({
          date: new Date(month + '-01'),
          average: grades.reduce((sum, grade) => sum + grade, 0) / grades.length,
          count: grades.length,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      // Group by week for shorter time periods (≤3 months)
      const weeklyData: Record<string, number[]> = {};

      data.forEach((assessment) => {
        if (assessment.finalGrade !== undefined && assessment.finalGrade !== null) {
          const date = new Date(assessment.due);
          // Get the Monday of the week for this assessment
          const monday = new Date(date);
          const dayOfWeek = date.getDay();
          const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is Sunday
          monday.setDate(diff);

          const weekKey = monday.toISOString().slice(0, 10); // YYYY-MM-DD format

          if (!weeklyData[weekKey]) weeklyData[weekKey] = [];
          weeklyData[weekKey].push(assessment.finalGrade);
        }
      });

      return Object.entries(weeklyData)
        .map(([week, grades]) => ({
          date: new Date(week),
          average: grades.reduce((sum, grade) => sum + grade, 0) / grades.length,
          count: grades.length,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  });

  const filteredData = $derived(() => {
    if (timeRange === 'all') {
      return chartData();
    }

    const referenceDate = new Date();
    let daysToSubtract = 90;
    if (timeRange === '30d') {
      daysToSubtract = 30;
    } else if (timeRange === '7d') {
      daysToSubtract = 7;
    } else if (timeRange === '365d') {
      daysToSubtract = 365;
    }

    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - daysToSubtract);

    return chartData().filter((item) => item.date >= cutoffDate);
  });

  const chartConfig = {
    average: {
      label: $_('analytics.average_grade') || 'Average Grade',
      color: 'var(--accent-color-value)',
    },
  } satisfies Chart.ChartConfig;

  const timeRangeOptions = $derived([
    { id: 'all', label: $_('analytics.all_time') || 'All Time' },
    { id: '365d', label: $_('analytics.last_12_months') || 'Last 12 months' },
    { id: '90d', label: $_('analytics.last_3_months') || 'Last 3 months' },
    { id: '30d', label: $_('analytics.last_30_days') || 'Last 30 days' },
    { id: '7d', label: $_('analytics.last_7_days') || 'Last 7 days' },
  ]);

  // Calculate trend
  const trend = $derived(() => {
    const data = filteredData();
    if (data.length < 2) return { percentage: 0, direction: 'neutral' };

    const recent = data.slice(-2);
    const change = recent[1].average - recent[0].average;
    const percentage = Math.abs(change);

    return {
      percentage: percentage.toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    };
  });
</script>

<Card.Root class="justify-between">
  <Card.Header>
    <div class="flex justify-between items-start">
      <div>
        <Card.Title>
          <T key="analytics.grade_trends" fallback="Grade Trends" />
        </Card.Title>
        <Card.Description>
          <T key="analytics.showing_average_grades" fallback="Showing average grades over time" />
        </Card.Description>
      </div>
      <Select.Root type="single" bind:value={timeRange}>
        <Select.Trigger class="w-[160px]">
          {selectedLabel}
        </Select.Trigger>
        <Select.Content>
          {#each timeRangeOptions as option}
            <Select.Item value={option.id} label={option.label} />
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </Card.Header>
  <Card.Content>
    {#if filteredData().length > 0}
      <Chart.Container config={chartConfig} class="aspect-auto h-[250px] w-full">
        <AreaChart
          legend
          data={filteredData()}
          x="date"
          xScale={scaleUtc()}
          series={[
            {
              key: 'average',
              label: 'Average Grade',
              color: chartConfig.average.color,
            },
          ]}
          props={{
            area: {
              curve: curveNatural,
              'fill-opacity': 0.4,
              line: { class: 'stroke-2' },
              motion: 'tween',
            },
            xAxis: {
              ticks: timeRange === '7d' ? 7 : undefined,
              format: (v) => {
                return v.toLocaleDateString('en-US', {
                  month: 'short',
                  day: timeRange === '7d' ? 'numeric' : undefined,
                });
              },
            },
            yAxis: {
              format: (v) => `${v.toFixed(0)}%`,
            },
          }}>
          {#snippet marks({ series, getAreaProps })}
            <defs>
              <linearGradient id="fillAverage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stop-color="var(--color-average)" stop-opacity={0.8} />
                <stop offset="95%" stop-color="var(--color-average)" stop-opacity={0.1} />
              </linearGradient>
            </defs>
            <ChartClipPath
              initialWidth={0}
              motion={{
                width: { type: 'tween', duration: 1000, easing: cubicInOut },
              }}>
              {#each series as s, i (s.key)}
                <Area {...getAreaProps(s, i)} fill="url(#fillAverage)" />
              {/each}
            </ChartClipPath>
          {/snippet}
          {#snippet tooltip()}
            <Chart.Tooltip
              labelFormatter={(v) => {
                return v.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                });
              }}
              indicator="line" />
          {/snippet}
        </AreaChart>
      </Chart.Container>
    {:else}
      <div
        class="flex flex-col items-center justify-center h-[250px] text-zinc-500 dark:text-zinc-400">
        <p class="text-lg font-medium">
          <T key="analytics.no_grade_data" fallback="No grade data available" />
        </p>
        <p class="text-sm">
          <T
            key="analytics.complete_assessments_for_trends"
            fallback="Complete some assessments to see your trends!" />
        </p>
      </div>
    {/if}
  </Card.Content>
  <Card.Footer>
    <div class="flex gap-2 items-start w-full text-sm">
      <div class="grid gap-2">
        {#if trend().direction !== 'neutral'}
          <div class="flex gap-2 items-center font-medium leading-none">
            {#if trend().direction === 'up'}
              <T
                key="analytics.trending_up"
                fallback="Trending up recently"
                values={{ percentage: trend().percentage }} />
              <TrendingUpIcon class="text-green-600 size-4" />
            {:else}
              <T
                key="analytics.trending_down"
                fallback="Trending down recently"
                values={{ percentage: trend().percentage }} />
              <TrendingUpIcon class="text-red-600 rotate-180 size-4" />
            {/if}
          </div>
        {:else}
          <div class="flex gap-2 items-center font-medium leading-none text-zinc-500">
            <T key="analytics.grades_stable" fallback="Grades remain stable" />
          </div>
        {/if}
        <div class="flex gap-2 items-center leading-none text-muted-foreground">
          <T
            key="analytics.data_points"
            fallback="data points"
            values={{ timeframe: selectedLabel.toLowerCase(), count: filteredData().length }} />
        </div>
      </div>
    </div>
  </Card.Footer>
</Card.Root>
