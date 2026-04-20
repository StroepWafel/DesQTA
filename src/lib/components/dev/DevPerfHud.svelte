<script lang="ts">
  import { onMount } from 'svelte';
  import { isDevTauriPerformance } from '$lib/performance/devTauriContext';
  import {
    sessionMetrics,
    downloadMetrics,
    benchmarkHistory,
  } from '$lib/performance/services/metricsTracker';
  let expanded = $state(false);
  let runningSuite = $state(false);
  let metricCount = $state(0);
  let benchCount = $state(0);

  onMount(() => {
    const unsub1 = sessionMetrics.subscribe((m) => {
      metricCount = m.length;
    });
    const unsub2 = benchmarkHistory.subscribe((h) => {
      benchCount = h.length;
    });
    return () => {
      unsub1();
      unsub2();
    };
  });

  async function runSuite() {
    if (runningSuite) return;
    runningSuite = true;
    try {
      const { runCompleteBenchmarkSuite } = await import('$lib/performance/benchmarks');
      await runCompleteBenchmarkSuite();
    } catch (e) {
      console.error('[DevPerf] benchmark suite failed', e);
    } finally {
      runningSuite = false;
    }
  }
</script>

{#if isDevTauriPerformance()}
  <div
    class="fixed bottom-3 right-3 z-[9999] flex flex-col items-end gap-2 font-sans text-xs pointer-events-none">
    <div
      class="pointer-events-auto rounded-xl border border-zinc-300/80 dark:border-zinc-600/80 bg-white/95 dark:bg-zinc-900/95 shadow-lg backdrop-blur-sm text-zinc-800 dark:text-white max-w-[min(100vw-1.5rem,18rem)]">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-xl transition-all duration-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-accent"
        onclick={() => (expanded = !expanded)}>
        <span class="font-semibold">Perf (dev)</span>
        <span class="tabular-nums opacity-80">{metricCount}m / {benchCount}b</span>
      </button>

      {#if expanded}
        <div class="px-3 pb-3 pt-0 flex flex-col gap-2 border-t border-zinc-200/80 dark:border-zinc-700/50">
          <p class="text-[11px] leading-snug text-zinc-600 dark:text-zinc-400 pt-2">
            Tauri dev only. <code class="text-[10px] bg-zinc-200/60 dark:bg-zinc-800 px-1 rounded"
              >__DESQTA_DEV_PERF__</code
            > in console.
          </p>
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm accent-bg text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            disabled={runningSuite}
            onclick={runSuite}>
            {runningSuite ? 'Running suite…' : 'Run full benchmark suite'}
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 transition-all duration-200"
            onclick={() => downloadMetrics()}>
            Download metrics JSON
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
