<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Icon } from 'svelte-hero-icons';
  import { Beaker, ArrowDownTray, ChevronDown } from 'svelte-hero-icons';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui';
  import PerformanceLineChart from '$lib/components/performance/PerformanceLineChart.svelte';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';
  import type { MegaPerfReport } from '$lib/services/megaPerfTypes';

  let { mega }: { mega: MegaPerfReport } = $props();

  let showAllCrawl = $state(false);
  const CRAWL_PREVIEW = 120;

  let categoryChartData = $derived(
    Object.entries(mega.categoryCounts).map(([name, value], index) => ({
      name,
      value,
      time: index,
    })),
  );

  let crawlVisible = $derived(
    showAllCrawl ? mega.crawlMetrics : mega.crawlMetrics.slice(0, CRAWL_PREVIEW),
  );

  function statusClass(status: string): string {
    if (status === 'critical') return 'text-red-500';
    if (status === 'warning') return 'text-amber-500';
    return 'text-emerald-500';
  }

  function downloadMegaJson(): void {
    const blob = new Blob([JSON.stringify(mega, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `desqta-mega-perf-${mega.capturedAt}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="flex flex-col gap-6" in:fade={{ duration: 400, delay: 50 }}>
  <Card.Root
    class="justify-between overflow-hidden rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-900/60 shadow-lg">
    <Card.Header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-start gap-3">
        <div
          class="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200">
          <Icon src={Beaker} class="w-6 h-6" />
        </div>
        <div>
          <Card.Title class="text-zinc-900 dark:text-white">
            <T
              key="performance.mega_title"
              fallback="Dev instrumentation and synthetic benchmarks" />
          </Card.Title>
          <Card.Description class="text-zinc-600 dark:text-zinc-400">
            <T
              key="performance.mega_description"
              fallback="Session metrics captured during the navigation crawl (plus benchmark suite when run in Tauri dev)." />
            {#if mega.crawlMetricsTrimmed}
              <span class="block mt-1 text-amber-600 dark:text-amber-400 text-sm">
                <T
                  key="performance.mega_trimmed"
                  fallback="Crawl metrics list was trimmed for export size; full detail is in the downloaded JSON." />
              </span>
            {/if}
          </Card.Description>
        </div>
      </div>
      <Button
        variant="secondary"
        onclick={downloadMegaJson}
        class="flex items-center gap-2 transition-all duration-200 shrink-0">
        <Icon src={ArrowDownTray} class="w-5 h-5" />
        <T key="performance.mega_download" fallback="Download mega JSON" />
      </Button>
    </Card.Header>
    <Card.Content class="flex flex-col gap-6 p-6 pt-0">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          class="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50/80 dark:bg-zinc-800/50">
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <T key="performance.mega_crawl_metrics" fallback="Crawl metrics (rows)" />
          </p>
          <p class="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">
            {mega.crawlSessionMetricCount}
          </p>
        </div>
        <div
          class="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50/80 dark:bg-zinc-800/50">
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <T key="performance.mega_benchmark_runs" fallback="Benchmark runs" />
          </p>
          <p class="text-xl font-semibold text-zinc-900 dark:text-white tabular-nums">
            {mega.benchmarkRuns.length}
          </p>
        </div>
        <div
          class="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50/80 dark:bg-zinc-800/50">
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <T key="performance.mega_synthetic" fallback="Synthetic suite" />
          </p>
          <p
            class="text-xl font-semibold {mega.syntheticError
              ? 'text-red-500'
              : mega.syntheticSuite?.success
                ? 'text-emerald-500'
                : 'text-zinc-500'}">
            {#if mega.syntheticError}
              <T key="performance.mega_error" fallback="Error" />
            {:else if mega.syntheticSuite}
              {mega.syntheticSuite.success
                ? $_('performance.mega_ok', { default: 'OK' })
                : $_('performance.mega_partial', { default: 'Partial' })}
            {:else}
              —
            {/if}
          </p>
        </div>
        <div
          class="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50/80 dark:bg-zinc-800/50">
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <T key="performance.mega_captured" fallback="Captured" />
          </p>
          <p class="text-sm font-medium text-zinc-900 dark:text-white">
            {new Date(mega.capturedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {#if categoryChartData.length > 0}
        <div class="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white/50 dark:bg-zinc-900/40">
          <PerformanceLineChart
            data={categoryChartData}
            title={$_('performance.mega_by_category', { default: 'Crawl metrics by category' })}
            valueLabel={$_('performance.mega_count', { default: 'Count' })}
            color="rgb(139 92 246)" />
        </div>
      {/if}

      {#if mega.syntheticError}
        <div
          class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-200">
          {mega.syntheticError}
        </div>
      {:else if mega.syntheticSuite?.report}
        <div>
          <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
            <T key="performance.mega_suite_report" fallback="Suite report" />
          </h3>
          <pre
            class="text-xs leading-relaxed p-4 rounded-lg bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 overflow-x-auto max-h-64 overflow-y-auto font-mono border border-zinc-200 dark:border-zinc-700">{mega.syntheticSuite.report}</pre>
        </div>
      {/if}

      {#if mega.benchmarkRuns.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
            <T key="performance.mega_bench_table" fallback="Benchmark runs" />
          </h3>
          <div class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table class="w-full text-sm text-left">
              <thead class="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                <tr>
                  <th class="px-3 py-2 font-medium">
                    <T key="performance.mega_col_id" fallback="ID" />
                  </th>
                  <th class="px-3 py-2 font-medium">Score</th>
                  <th class="px-3 py-2 font-medium">
                    <T key="performance.mega_col_metrics" fallback="Metrics" />
                  </th>
                  <th class="px-3 py-2 font-medium">
                    <T key="performance.mega_col_warn_crit" fallback="Warn / Crit" />
                  </th>
                  <th class="px-3 py-2 font-medium">
                    <T key="performance.mega_col_pass" fallback="Pass" />
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                {#each mega.benchmarkRuns as run}
                  <tr class="bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200">
                    <td class="px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200 max-w-[12rem] truncate"
                      >{run.benchmarkId}</td>
                    <td class="px-3 py-2 tabular-nums text-zinc-900 dark:text-white"
                      >{run.overallScore}</td>
                    <td class="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300"
                      >{run.metricCount}</td>
                    <td class="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {run.warningCount} / {run.criticalCount}
                    </td>
                    <td class="px-3 py-2">
                      <span class={run.passed ? 'text-emerald-500' : 'text-red-500'}>
                        {run.passed ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      {#if mega.benchmarkDetail.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
            <T key="performance.mega_detail_samples" fallback="Sample metrics per benchmark" />
          </h3>
          <div class="space-y-2">
            {#each mega.benchmarkDetail as block}
              <details
                class="group rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/50">
                <summary
                  class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <span class="font-mono text-xs truncate">{block.benchmarkId}</span>
                  <Icon
                    src={ChevronDown}
                    class="w-5 h-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div class="px-4 pb-4 overflow-x-auto max-h-64 overflow-y-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="text-left text-zinc-500 dark:text-zinc-400">
                        <th class="py-1 pr-2">Name</th>
                        <th class="py-1 pr-2">Value</th>
                        <th class="py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each block.metrics as m}
                        <tr class="border-t border-zinc-100 dark:border-zinc-800">
                          <td class="py-1 pr-2 font-mono text-zinc-800 dark:text-zinc-200">{m.name}</td>
                          <td class="py-1 pr-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                            {m.value}{m.unit === 'ms' ? ' ms' : m.unit === 'percent' ? '%' : ''}
                          </td>
                          <td class="py-1 {statusClass(m.status)}">{m.status}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </details>
            {/each}
          </div>
        </div>
      {/if}

      {#if mega.crawlMetrics.length > 0}
        <div>
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <T key="performance.mega_crawl_table" fallback="Crawl session metrics" />
              <span class="text-zinc-500 dark:text-zinc-400 font-normal">
                ({mega.crawlMetrics.length})</span>
            </h3>
            {#if mega.crawlMetrics.length > CRAWL_PREVIEW}
              <Button
                variant="ghost"
                size="sm"
                onclick={() => (showAllCrawl = !showAllCrawl)}
                class="text-sm transition-all duration-200">
                {showAllCrawl
                  ? $_('performance.mega_show_less', { default: 'Show less' })
                  : $_('performance.mega_show_all', { default: 'Show all in page' })}
              </Button>
            {/if}
          </div>
          <div
            class="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700 max-h-80 overflow-y-auto">
            <table class="w-full text-xs text-left">
              <thead class="sticky top-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 z-10">
                <tr>
                  <th class="px-3 py-2 font-medium">Name</th>
                  <th class="px-3 py-2 font-medium">Category</th>
                  <th class="px-3 py-2 font-medium">Value</th>
                  <th class="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                {#each crawlVisible as row}
                  <tr class="bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td class="px-3 py-1.5 font-mono text-zinc-800 dark:text-zinc-200 max-w-[14rem] truncate"
                      >{row.name}</td>
                    <td class="px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{row.category}</td>
                    <td class="px-3 py-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.value}{row.unit === 'ms' ? ' ms' : row.unit === 'percent' ? '%' : ''}
                    </td>
                    <td class="px-3 py-1.5 {statusClass(row.status)}">{row.status}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>

<style>
  details summary::-webkit-details-marker {
    display: none;
  }
</style>
