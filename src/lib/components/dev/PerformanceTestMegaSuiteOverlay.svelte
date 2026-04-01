<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { performanceTestMegaSuiteRunning } from '$lib/services/performanceTesting';
  import T from '$lib/components/T.svelte';
</script>

{#if $performanceTestMegaSuiteRunning}
  <div
    class="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-auto bg-black/50 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
    role="alertdialog"
    aria-live="polite"
    aria-busy="true"
    aria-labelledby="perf-mega-suite-title"
    aria-describedby="perf-mega-suite-desc">
    <div
      class="w-full max-w-md rounded-2xl border border-zinc-200/80 dark:border-zinc-600/80 bg-white/95 dark:bg-zinc-900/95 shadow-2xl p-6 flex flex-col items-center gap-4 text-center transition-all duration-200"
      transition:scale={{ duration: 220, start: 0.96 }}>
      <div
        class="h-12 w-12 rounded-full border-2 border-zinc-200 dark:border-zinc-600 border-t-accent-500 animate-spin shrink-0 transition-colors duration-200"
        aria-hidden="true"></div>
      <div class="space-y-2">
        <h2
          id="perf-mega-suite-title"
          class="text-lg font-semibold text-zinc-900 dark:text-white">
          <T
            key="performance.mega_suite_overlay_title"
            fallback="Running benchmark suite" />
        </h2>
        <p id="perf-mega-suite-desc" class="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          <T
            key="performance.mega_suite_overlay_body"
            fallback="The page crawl is done. Synthetic startup, UI, data, and backend checks are running—this often takes 30–90 seconds. Please wait; the results will open when everything finishes." />
        </p>
      </div>
    </div>
  </div>
{/if}
