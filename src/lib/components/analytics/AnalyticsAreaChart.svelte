<script lang="ts">
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import { Card } from "$lib/components/ui";
  import { Dropdown } from "$lib/components/ui";
  import { scaleUtc } from "d3-scale";
  import { Area, AreaChart, ChartClipPath } from "layerchart";
  import { curveNatural } from "d3-shape";
  import { cubicInOut } from "svelte/easing";
  import type { Assessment } from "$lib/types";

  interface Props {
    data: Assessment[];
  }

  let { data }: Props = $props();

  let timeRange = $state("90d");

  const selectedLabel = $derived.by(() => {
    switch (timeRange) {
      case "90d":
        return "Last 3 months";
      case "30d":
        return "Last 30 days";
      case "7d":
        return "Last 7 days";
      default:
        return "Last 3 months";
    }
  });

  // Process data into chart format
  const chartData = $derived(() => {
    if (!data?.length) return [];
    
    const monthlyData: Record<string, number[]> = {};
    
    data.forEach((assessment) => {
      if (assessment.finalGrade !== undefined && assessment.finalGrade !== null) {
        const date = new Date(assessment.due);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
        
        if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
        monthlyData[monthKey].push(assessment.finalGrade);
      }
    });

    const result = Object.entries(monthlyData)
      .map(([month, grades]) => ({
        date: new Date(month + '-01'),
        average: grades.reduce((sum, grade) => sum + grade, 0) / grades.length,
        count: grades.length
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
      
    return result;
  });

  const filteredData = $derived(() => {
    const referenceDate = new Date();
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }

    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - daysToSubtract);
    
    return chartData().filter((item) => item.date >= cutoffDate);
  });

  const chartConfig = {
    average: { 
      label: "Average Grade", 
      color: "hsl(var(--chart-1))" 
    },
  } satisfies Chart.ChartConfig;

  const timeRangeOptions = [
    { id: "7d", label: "Last 7 days", onClick: () => timeRange = "7d" },
    { id: "30d", label: "Last 30 days", onClick: () => timeRange = "30d" },
    { id: "90d", label: "Last 3 months", onClick: () => timeRange = "90d" }
  ];

  // Calculate trend
  const trend = $derived(() => {
    const data = filteredData();
    if (data.length < 2) return { percentage: 0, direction: "neutral" };
    
    const recent = data.slice(-2);
    const change = recent[1].average - recent[0].average;
    const percentage = Math.abs(change);
    
    return {
      percentage: percentage.toFixed(1),
      direction: change > 0 ? "up" : change < 0 ? "down" : "neutral"
    };
  });
</script>

<Card variant="elevated" padding="none" class="w-full">
  <div class="flex gap-2 items-center px-6 py-5 space-y-0 border-b sm:flex-row">
    <div class="grid flex-1 gap-1 text-center sm:text-left">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">Grade Trends</h3>
      <p class="text-sm text-zinc-600 dark:text-zinc-400">Showing average grades over time</p>
    </div>
    <Dropdown
      items={timeRangeOptions}
      buttonText={selectedLabel}
      class="w-[160px] rounded-lg sm:ml-auto"
      showChevron={true}
    />
  </div>
  
  <div class="px-6 pb-0">
    {#if filteredData().length > 0}
      <Chart.Container config={chartConfig} class="aspect-auto h-[250px] w-full">
        <AreaChart
          legend
          data={filteredData()}
          x="date"
          xScale={scaleUtc()}
          series={[
            {
              key: "average",
              label: "Average Grade",
              color: chartConfig.average.color,
            },
          ]}
          props={{
            area: {
              curve: curveNatural,
              "fill-opacity": 0.4,
              line: { class: "stroke-2" },
              motion: "tween",
            },
            xAxis: {
              ticks: timeRange === "7d" ? 7 : undefined,
              format: (v) => {
                return v.toLocaleDateString("en-US", {
                  month: "short",
                  day: timeRange === "7d" ? "numeric" : undefined,
                });
              },
            },
            yAxis: { 
              format: (v) => `${v.toFixed(0)}%`
            },
          }}
        >
          {#snippet marks({ series, getAreaProps })}
            <defs>
              <linearGradient id="fillAverage" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stop-color="hsl(var(--chart-1))"
                  stop-opacity={0.8}
                />
                <stop
                  offset="95%"
                  stop-color="hsl(var(--chart-1))"
                  stop-opacity={0.1}
                />
              </linearGradient>
            </defs>
            <ChartClipPath
              initialWidth={0}
              motion={{
                width: { type: "tween", duration: 1000, easing: cubicInOut },
              }}
            >
              {#each series as s, i (s.key)}
                <Area
                  {...getAreaProps(s, i)}
                  fill="url(#fillAverage)"
                />
              {/each}
            </ChartClipPath>
          {/snippet}
          {#snippet tooltip()}
            <Chart.Tooltip
              labelFormatter={(v) => {
                return v.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                });
              }}
              indicator="line"
            />
          {/snippet}
        </AreaChart>
      </Chart.Container>
    {:else}
      <div class="flex flex-col items-center justify-center h-[250px] text-zinc-500 dark:text-zinc-400">
        <p class="text-lg font-medium">No grade data available</p>
        <p class="text-sm">Complete some assessments to see your trends!</p>
      </div>
    {/if}
  </div>
  
  <div class="px-6 py-4 border-t">
    <div class="flex gap-2 items-start w-full text-sm">
      <div class="grid gap-2">
        {#if trend().direction !== "neutral"}
          <div class="flex gap-2 items-center font-medium leading-none">
            {#if trend().direction === "up"}
              Trending up by {trend().percentage}% recently 
              <TrendingUpIcon class="text-green-600 size-4" />
            {:else}
              Trending down by {trend().percentage}% recently
              <TrendingUpIcon class="text-red-600 rotate-180 size-4" />
            {/if}
          </div>
        {:else}
          <div class="flex gap-2 items-center font-medium leading-none text-zinc-500">
            Grades remain stable
          </div>
        {/if}
        <div class="flex gap-2 items-center leading-none text-zinc-600 dark:text-zinc-400">
          {selectedLabel.toLowerCase()} • {filteredData().length} data points
        </div>
      </div>
    </div>
  </div>
</Card>
