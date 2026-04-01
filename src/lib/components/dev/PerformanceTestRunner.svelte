<!--
  Performance Test Runner Component

  A development tool for running and viewing performance benchmarks.
  Provides UI for executing individual or complete benchmark suites.

  Usage:
    <PerformanceTestRunner />
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import {
    Icon,
    Play,
    ArrowPath,
    Bolt,
    CircleStack,
    Cog6Tooth,
    CpuChip,
    GlobeAlt,
    Swatch,
    ServerStack,
    Squares2x2,
    CheckCircle,
    XCircle,
    ExclamationTriangle,
  } from 'svelte-hero-icons';
  import {
    runCompleteBenchmarkSuite,
    runQuickBenchmarkSuite,
    runStartupBenchmarkSuite,
    runWidgetBenchmarkSuite,
    runServiceBenchmarkSuite,
    runMemoryBenchmarkSuite,
    runRouteBenchmarkSuite,
    runNetworkBenchmarkSuite,
    benchmarkWidgetDragPerformance,
    runDataBenchmarkSuite,
    runBackendBenchmarkSuite,
    exportMetrics,
    downloadMetrics,
    sessionMetrics,
    benchmarkHistory,
    initMetricsTracker,
    type BenchmarkResult,
  } from '$lib/performance';
  import { logger } from '../../../utils/logger';

  // ============================================================================
  // State
  // ============================================================================

  let isRunning = $state(false);
  let currentSuite = $state<string | null>(null);
  let progress = $state(0);
  let results = $state<BenchmarkResult[]>([]);
  let selectedCategories = $state<Set<string>>(new Set([
    'startup',
    'ui',
    'data',
    'backend',
    'widgets',
    'services',
    'memory',
    'routes',
    'network',
  ]));
  let showLeakDetails = $state(false);
  let memoryLeaksDetected = $state(false);
  let activeTab = $state<'tests' | 'results' | 'history'>('tests');

  // ============================================================================
  // Benchmark Categories
  // ============================================================================

  const categories = [
    {
      id: 'startup',
      name: 'Startup',
      description: 'Cold start, warm start, cache loading',
      icon: Bolt,
      color: 'amber',
      run: runStartupBenchmarkSuite,
    },
    {
      id: 'ui',
      name: 'UI Interactions',
      description: 'Interaction latency, drag, render pressure',
      icon: Swatch,
      color: 'rose',
      run: benchmarkWidgetDragPerformance,
    },
    {
      id: 'data',
      name: 'Data & Cache',
      description: 'Memory cache, bridge cache, batching',
      icon: CircleStack,
      color: 'indigo',
      run: runDataBenchmarkSuite,
    },
    {
      id: 'backend',
      name: 'Backend Offload',
      description: 'Rust commands, cache batching, bridge cost',
      icon: ServerStack,
      color: 'emerald',
      run: runBackendBenchmarkSuite,
    },
    {
      id: 'widgets',
      name: 'Widgets',
      description: 'Widget rendering, layout, interactions',
      icon: Squares2x2,
      color: 'blue',
      run: () => runWidgetBenchmarkSuite(3),
    },
    {
      id: 'services',
      name: 'Services',
      description: 'Auth, cache, sync, settings services',
      icon: Cog6Tooth,
      color: 'green',
      run: runServiceBenchmarkSuite,
    },
    {
      id: 'memory',
      name: 'Memory & Leaks',
      description: 'Memory usage, GC impact, leak detection',
      icon: CpuChip,
      color: 'purple',
      run: runMemoryBenchmarkSuite,
    },
    {
      id: 'routes',
      name: 'Routes & Pages',
      description: 'Route transitions, page rendering',
      icon: GlobeAlt,
      color: 'pink',
      run: () => runRouteBenchmarkSuite(3),
    },
    {
      id: 'network',
      name: 'Network',
      description: 'Request latency, caching, conditions',
      icon: GlobeAlt,
      color: 'cyan',
      run: runNetworkBenchmarkSuite,
    },
  ];

  // ============================================================================
  // Methods
  // ============================================================================

  function toggleCategory(id: string) {
    if (selectedCategories.has(id)) {
      selectedCategories.delete(id);
    } else {
      selectedCategories.add(id);
    }
    selectedCategories = selectedCategories; // Trigger reactivity
  }

  function selectAll() {
    selectedCategories = new Set(categories.map((c) => c.id));
  }

  function selectNone() {
    selectedCategories.clear();
    selectedCategories = selectedCategories;
  }

  async function runSelectedTests() {
    if (isRunning) return;
    if (selectedCategories.size === 0) {
      alert('Please select at least one test category');
      return;
    }

    isRunning = true;
    currentSuite = 'Initializing...';
    progress = 0;
    results = [];
    memoryLeaksDetected = false;

    try {
      initMetricsTracker();

      const options = {
        startup: selectedCategories.has('startup'),
        ui: selectedCategories.has('ui'),
        data: selectedCategories.has('data'),
        backend: selectedCategories.has('backend'),
        widgets: selectedCategories.has('widgets'),
        services: selectedCategories.has('services'),
        memory: selectedCategories.has('memory'),
        routes: selectedCategories.has('routes'),
        network: selectedCategories.has('network'),
        iterations: 3,
      };

      const totalCategories = selectedCategories.size;
      let completedCategories = 0;

      // Run individual suites to track progress
      if (options.startup) {
        currentSuite = 'Startup Performance';
        await runStartupBenchmarkSuite(3);
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.ui) {
        currentSuite = 'UI Interaction Performance';
        await benchmarkWidgetDragPerformance();
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.data) {
        currentSuite = 'Data & Cache Performance';
        await runDataBenchmarkSuite();
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.backend) {
        currentSuite = 'Backend Offload Performance';
        await runBackendBenchmarkSuite();
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.widgets) {
        currentSuite = 'Widget Performance';
        await runWidgetBenchmarkSuite(3);
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.services) {
        currentSuite = 'Service Performance';
        await runServiceBenchmarkSuite();
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.memory) {
        currentSuite = 'Memory & Leak Detection';
        const memoryResult = await runMemoryBenchmarkSuite();
        memoryLeaksDetected = memoryResult.leaksDetected;
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.routes) {
        currentSuite = 'Route & Page Performance';
        await runRouteBenchmarkSuite(3);
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      if (options.network) {
        currentSuite = 'Network Performance';
        await runNetworkBenchmarkSuite();
        completedCategories++;
        progress = (completedCategories / totalCategories) * 100;
      }

      // Get final results
      results = $benchmarkHistory;
      activeTab = 'results';

      logger.info('PerformanceTestRunner', 'runSelectedTests', 'All tests completed', {
        categories: Array.from(selectedCategories),
        results: results.length,
      });
    } catch (error) {
      logger.error('PerformanceTestRunner', 'runSelectedTests', 'Test execution failed', { error });
      alert(`Tests failed: ${error}`);
    } finally {
      isRunning = false;
      currentSuite = null;
      progress = 100;
    }
  }

  async function runQuickTests() {
    if (isRunning) return;

    isRunning = true;
    currentSuite = 'Quick Benchmark Suite';
    progress = 0;

    try {
      const quickResult = await runQuickBenchmarkSuite();
      results = $benchmarkHistory;
      activeTab = 'results';

      if (!quickResult.success) {
        logger.warn('PerformanceTestRunner', 'runQuickTests', 'Some quick tests failed', {
          summary: quickResult.summary,
        });
      }
    } catch (error) {
      logger.error('PerformanceTestRunner', 'runQuickTests', 'Quick tests failed', { error });
    } finally {
      isRunning = false;
      currentSuite = null;
      progress = 100;
    }
  }

  function exportResults() {
    try {
      downloadMetrics(`performance-results-${Date.now()}.json`);
      logger.info('PerformanceTestRunner', 'exportResults', 'Results exported');
    } catch (error) {
      logger.error('PerformanceTestRunner', 'exportResults', 'Export failed', { error });
    }
  }

  function clearResults() {
    results = [];
    benchmarkHistory.set([]);
    sessionMetrics.set([]);
    memoryLeaksDetected = false;
  }

  function getColorClasses(color: string): string {
    const colors: Record<string, string> = {
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    };
    return colors[color] || colors.blue;
  }

  onMount(() => {
    initMetricsTracker();
  });
</script>

<div class="w-full max-w-6xl mx-auto p-6">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
      Performance Test Runner
    </h1>
    <p class="text-zinc-600 dark:text-zinc-400">
      Run comprehensive performance benchmarks to identify bottlenecks and detect memory leaks.
    </p>
  </div>

  <!-- Tabs -->
  <div class="flex space-x-1 mb-6 border-b border-zinc-200 dark:border-zinc-700">
    {#each [{ id: 'tests', label: 'Tests' }, { id: 'results', label: 'Results' }, { id: 'history', label: 'History' }] as tab}
      <button
        class="px-4 py-2 text-sm font-medium transition-colors"
        class:text-zinc-900={activeTab === tab.id}
        class:dark:text-white={activeTab === tab.id}
        class:text-zinc-500={activeTab !== tab.id}
        class:dark:text-zinc-400={activeTab !== tab.id}
        class:border-b-2={activeTab === tab.id}
        class:border-amber-500={activeTab === tab.id}
        onclick={() => activeTab = tab.id as 'tests' | 'results' | 'history'}
      >
        {tab.label}
        {#if tab.id === 'history' && $benchmarkHistory.length > 0}
          <span class="ml-2 text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
            {$benchmarkHistory.length}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Tests Tab -->
  {#if activeTab === 'tests'}
    <div transition:fade>
      <!-- Quick Actions -->
      <div class="mb-6 flex flex-wrap gap-3">
        <button
          class="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={runQuickTests}
          disabled={isRunning}
        >
          {#if isRunning && currentSuite === 'Quick Benchmark Suite'}
            <Icon src={ArrowPath} class="w-4 h-4 mr-2 animate-spin" />
          {:else}
            <Icon src={Bolt} class="w-4 h-4 mr-2" />
          {/if}
          Quick Test
        </button>

        <button
          class="inline-flex items-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={runSelectedTests}
          disabled={isRunning || selectedCategories.size === 0}
        >
          {#if isRunning}
            <Icon src={ArrowPath} class="w-4 h-4 mr-2 animate-spin" />
          {:else}
            <Icon src={Play} class="w-4 h-4 mr-2" />
          {/if}
          Run Selected ({selectedCategories.size})
        </button>

        <div class="flex-1"></div>

        <button
          class="inline-flex items-center px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          onclick={selectAll}
          disabled={isRunning}
        >
          Select All
        </button>
        <button
          class="inline-flex items-center px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          onclick={selectNone}
          disabled={isRunning}
        >
          Select None
        </button>
      </div>

      <!-- Progress Bar -->
      {#if isRunning}
        <div class="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg" transition:slide>
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {currentSuite}
            </span>
            <span class="text-sm text-zinc-500">{Math.round(progress)}%</span>
          </div>
          <div class="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-amber-500 transition-all duration-300"
              style="width: {progress}%"
            ></div>
          </div>
        </div>
      {/if}

      <!-- Memory Leak Warning -->
      {#if memoryLeaksDetected}
        <div
          class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          transition:slide
        >
          <div class="flex items-start">
            <Icon src={ExclamationTriangle} class="w-5 h-5 text-red-500 mt-0.5 mr-3" />
            <div class="flex-1">
              <h3 class="font-medium text-red-900 dark:text-red-400">Memory Leaks Detected</h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                The memory benchmark detected potential memory leaks. Review the results tab for details.
              </p>
              <button
                class="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                onclick={() => { showLeakDetails = !showLeakDetails; activeTab = 'results'; }}
              >
                {showLeakDetails ? 'Hide' : 'View'} Details
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Category Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each categories as category}
          <label
            class={[
              'relative p-4 border-2 rounded-xl cursor-pointer transition-all',
              selectedCategories.has(category.id)
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                : 'border-zinc-200 dark:border-zinc-700',
              isRunning ? 'opacity-50' : '',
            ]}
          >
            <input
              type="checkbox"
              class="sr-only"
              checked={selectedCategories.has(category.id)}
              onchange={() => toggleCategory(category.id)}
              disabled={isRunning}
            />
            <div class="flex items-start">
              <div class="p-2 rounded-lg {getColorClasses(category.color)}">
                <Icon src={category.icon} class="w-5 h-5" />
              </div>
              <div class="ml-3 flex-1">
                <h3 class="font-medium text-zinc-900 dark:text-white">
                  {category.name}
                </h3>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {category.description}
                </p>
              </div>
              {#if selectedCategories.has(category.id)}
                <Icon src={CheckCircle} class="w-5 h-5 text-amber-500" />
              {/if}
            </div>
          </label>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Results Tab -->
  {#if activeTab === 'results'}
    <div transition:fade>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
          Test Results
        </h2>
        <div class="flex gap-2">
          <button
            class="inline-flex items-center px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            onclick={exportResults}
            disabled={results.length === 0}
          >
            <Icon src={CircleStack} class="w-4 h-4 mr-1.5" />
            Export
          </button>
          <button
            class="inline-flex items-center px-3 py-1.5 text-sm text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
            onclick={clearResults}
            disabled={results.length === 0}
          >
            <Icon src={ArrowPath} class="w-4 h-4 mr-1.5" />
            Clear
          </button>
        </div>
      </div>

      {#if results.length === 0}
        <div class="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <Icon src={CpuChip} class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No results yet. Run some tests to see performance metrics.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each results as result, i}
            <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                  {#if result.passed}
                    <Icon src={CheckCircle} class="w-5 h-5 text-green-500 mr-2" />
                  {:else}
                    <Icon src={XCircle} class="w-5 h-5 text-red-500 mr-2" />
                  {/if}
                  <span class="font-medium text-zinc-900 dark:text-white">
                    {result.benchmarkId}
                  </span>
                </div>
                <span class="text-sm text-zinc-500">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-zinc-500">Status</span>
                  <p class="font-medium {result.passed ? 'text-green-600' : 'text-red-600'}">
                    {result.passed ? 'Passed' : 'Failed'}
                  </p>
                </div>
                <div>
                  <span class="text-zinc-500">Score</span>
                  <p class="font-medium text-zinc-900 dark:text-white">
                    {result.overallScore}/100
                  </p>
                </div>
                <div>
                  <span class="text-zinc-500">Device</span>
                  <p class="font-medium text-zinc-900 dark:text-white">
                    {result.deviceClass}
                  </p>
                </div>
                <div>
                  <span class="text-zinc-500">Metrics</span>
                  <p class="font-medium text-zinc-900 dark:text-white">
                    {result.metrics.length}
                  </p>
                </div>
              </div>

              {#if result.metrics.length > 0}
                <details class="mt-3">
                  <summary class="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-zinc-900 dark:hover:text-white">
                    View {result.metrics.length} Metrics
                  </summary>
                  <div class="mt-2 space-y-1 max-h-48 overflow-y-auto text-xs">
                    {#each result.metrics.slice(0, 20) as metric}
                      <div class="flex justify-between py-1 px-2 bg-zinc-50 dark:bg-zinc-900 rounded">
                        <span class="text-zinc-600 dark:text-zinc-400">{metric.name}</span>
                        <span class="font-mono text-zinc-900 dark:text-white">
                          {metric.value.toFixed(2)}{metric.unit}
                        </span>
                      </div>
                    {/each}
                    {#if result.metrics.length > 20}
                      <p class="text-center text-zinc-500 py-1">
                        ...and {result.metrics.length - 20} more
                      </p>
                    {/if}
                  </div>
                </details>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- History Tab -->
  {#if activeTab === 'history'}
    <div transition:fade>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
          Benchmark History
        </h2>
        <button
          class="text-sm text-zinc-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
          onclick={() => benchmarkHistory.set([])}
        >
          Clear History
        </button>
      </div>

      {#if $benchmarkHistory.length === 0}
        <div class="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <Icon src={CircleStack} class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No benchmark history available.</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each $benchmarkHistory as run, i}
            <div class="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div class="flex items-center">
                {#if run.passed}
                  <div class="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                {:else}
                  <div class="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                {/if}
                <div>
                  <p class="font-medium text-zinc-900 dark:text-white text-sm">
                    {run.benchmarkId}
                  </p>
                  <p class="text-xs text-zinc-500">
                    {new Date(run.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <p class="text-sm font-medium text-zinc-900 dark:text-white">
                    {run.overallScore}/100
                  </p>
                  <p class="text-xs text-zinc-500">
                    {run.metrics.length} metrics
                  </p>
                </div>
                <div class="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">
                  {run.deviceClass}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
