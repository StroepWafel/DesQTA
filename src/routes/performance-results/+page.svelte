<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from 'svelte-hero-icons';
  import { 
    ChartBar, 
    Clock, 
    ExclamationTriangle, 
    CheckCircle,
    ArrowLeft,
    ComputerDesktop
  } from 'svelte-hero-icons';
  import { fade } from 'svelte/transition';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui';
  import PerformanceLineChart from '../../lib/components/performance/PerformanceLineChart.svelte';
  import type { TestResults, PerformanceMetrics } from '../../lib/services/performanceTesting';

  let results: TestResults | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(() => {
    // Get results from URL params or session storage
    const resultsParam = $page.url.searchParams.get('results');
    
    if (resultsParam) {
      try {
        results = JSON.parse(decodeURIComponent(resultsParam));
        loading = false;
      } catch (e) {
        error = 'Failed to parse performance test results';
        loading = false;
      }
    } else {
      // Try to get from session storage as fallback
      const storedResults = sessionStorage.getItem('performance-test-results');
      if (storedResults) {
        try {
          results = JSON.parse(storedResults);
          loading = false;
        } catch (e) {
          error = 'Failed to parse stored performance test results';
          loading = false;
        }
      } else {
        error = 'No performance test results found';
        loading = false;
      }
    }
  });

  function goBack() {
    goto('/settings');
  }

  function formatTime(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${ms.toFixed(0)}ms`;
  }

  function formatMemory(bytes: number | undefined): string {
    if (!bytes) return 'N/A';
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  function getPerformanceColor(loadTime: number): string {
    if (loadTime < 1000) return 'text-green-500';
    if (loadTime < 3000) return 'text-yellow-500';
    return 'text-red-500';
  }

  function getPerformanceBgColor(loadTime: number): string {
    if (loadTime < 1000) return 'bg-green-100 dark:bg-green-900/30';
    if (loadTime < 3000) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  }

  $: sortedPages = results ? [...results.pages].sort((a, b) => b.loadTime - a.loadTime) : [];

  // Chart data processing
  $: loadTimeChartData = results ? results.pages.map((page, index) => ({
    name: page.pageName,
    value: page.loadTime,
    time: index
  })) : [];

  $: memoryChartData = results ? results.pages
    .filter(page => page.memoryUsage)
    .map((page, index) => ({
      name: page.pageName,
      value: (page.memoryUsage || 0) / 1024 / 1024, // Convert to MB
      time: index
    })) : [];

  $: networkRequestsChartData = results ? results.pages.map((page, index) => ({
    name: page.pageName,
    value: page.networkRequests,
    time: index
  })) : [];

  $: domContentLoadedChartData = results ? results.pages.map((page, index) => ({
    name: page.pageName,
    value: page.domContentLoaded,
    time: index
  })) : [];
</script>

<svelte:head>
  <title>Performance Test Results - DesQTA</title>
</svelte:head>

<div class="container px-6 py-7 mx-auto flex flex-col h-full gap-8">
  <!-- Header -->
  <div class="flex justify-between items-start">
    <div>
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
        Performance Test Results
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        {#if results}
          Test completed on {new Date(results.startTime).toLocaleString()} • {results.pages.length} pages analyzed
        {:else}
          Detailed performance analysis and metrics
        {/if}
      </p>
    </div>

    <div class="flex items-center gap-3">
      <Button variant="ghost" onclick={goBack} class="flex items-center gap-2">
        <Icon src={ArrowLeft} class="w-4 h-4" />
        Back to Settings
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="w-12 h-12 rounded-full border-b-2 border-accent-600 animate-spin"></div>
    </div>
  {:else if error}
    <div class="flex flex-col gap-6 justify-center items-center flex-1">
      <div class="flex flex-col items-center p-8 w-full max-w-lg rounded-2xl border shadow-xl border-zinc-200 bg-white/90 dark:bg-zinc-900/90 dark:border-zinc-700 animate-fade-in-up">
        <Icon src={ExclamationTriangle} class="mb-4 w-12 h-12 text-red-500" />
        <h2 class="mb-2 text-2xl font-bold text-zinc-900 dark:text-white">Error Loading Results</h2>
        <p class="mb-4 text-center text-zinc-600 dark:text-zinc-300">{error}</p>
        <Button onclick={goBack} class="mt-2">
          Go Back to Settings
        </Button>
      </div>
    </div>
  {:else if results}
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-4" in:fade={{ duration: 400 }}>
      <Card.Root class="justify-between">
        <Card.Content class="flex items-center gap-3 p-6">
          <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Icon src={Clock} class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">Total Duration</p>
            <p class="text-2xl font-bold text-zinc-900 dark:text-white">
              {formatTime(results.totalDuration)}
            </p>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root class="justify-between">
        <Card.Content class="flex items-center gap-3 p-6">
          <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Icon src={ChartBar} class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">Pages Tested</p>
            <p class="text-2xl font-bold text-zinc-900 dark:text-white">
              {results.pages.length}
            </p>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root class="justify-between">
        <Card.Content class="flex items-center gap-3 p-6">
          <div class="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
            <Icon src={Clock} class="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">Avg Load Time</p>
            <p class="text-2xl font-bold text-zinc-900 dark:text-white">
              {formatTime(results.summary.averageLoadTime)}
            </p>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root class="justify-between">
        <Card.Content class="flex items-center gap-3 p-6">
          <div class="p-2 {results.summary.totalErrors > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'} rounded-lg">
            <Icon src={results.summary.totalErrors > 0 ? ExclamationTriangle : CheckCircle} 
                  class="w-6 h-6 {results.summary.totalErrors > 0 ? 'text-red-600' : 'text-green-600'}" />
          </div>
          <div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">Total Errors</p>
            <p class="text-2xl font-bold {results.summary.totalErrors > 0 ? 'text-red-500' : 'text-green-500'}">
              {results.summary.totalErrors}
            </p>
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Performance Charts -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2" in:fade={{ duration: 400, delay: 100 }}>
      <Card.Root class="justify-between">
        <Card.Content class="p-6">
          <PerformanceLineChart 
            data={loadTimeChartData} 
            title="Load Time Analysis" 
            valueLabel="Load Time (ms)"
            color="rgb(59 130 246)"
          />
        </Card.Content>
      </Card.Root>

      <Card.Root class="justify-between">
        <Card.Content class="p-6">
          <PerformanceLineChart 
            data={domContentLoadedChartData} 
            title="DOM Content Loaded" 
            valueLabel="Time (ms)"
            color="rgb(34 197 94)"
          />
        </Card.Content>
      </Card.Root>

      {#if memoryChartData.length > 0}
        <Card.Root class="justify-between">
          <Card.Content class="p-6">
            <PerformanceLineChart 
              data={memoryChartData} 
              title="Memory Usage" 
              valueLabel="Memory (MB)"
              color="rgb(168 85 247)"
            />
          </Card.Content>
        </Card.Root>
      {/if}

      <Card.Root class="justify-between">
        <Card.Content class="p-6">
          <PerformanceLineChart 
            data={networkRequestsChartData} 
            title="Network Requests" 
            valueLabel="Request Count"
            color="rgb(249 115 22)"
          />
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Performance Overview -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2" in:fade={{ duration: 400, delay: 200 }}>
      <Card.Root class="justify-between">
        <Card.Header>
          <Card.Title>Performance Range</Card.Title>
          <Card.Description>Fastest and slowest page load times</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div>
                <p class="font-medium text-green-800 dark:text-green-200">Fastest Page</p>
                <p class="text-sm text-green-600 dark:text-green-400">{results.summary.fastestPage.name}</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-green-600">{formatTime(results.summary.fastestPage.time)}</p>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div>
                <p class="font-medium text-red-800 dark:text-red-200">Slowest Page</p>
                <p class="text-sm text-red-600 dark:text-red-400">{results.summary.slowestPage.name}</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-red-600">{formatTime(results.summary.slowestPage.time)}</p>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root class="justify-between">
        <Card.Header>
          <Card.Title>Error Summary</Card.Title>
          <Card.Description>JavaScript errors and warnings detected</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-zinc-600 dark:text-zinc-400">JavaScript Errors</span>
              <span class="font-semibold {results.summary.totalErrors > 0 ? 'text-red-500' : 'text-green-500'}">
                {results.summary.totalErrors}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-600 dark:text-zinc-400">Warnings</span>
              <span class="font-semibold {results.summary.totalWarnings > 0 ? 'text-yellow-500' : 'text-green-500'}">
                {results.summary.totalWarnings}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-600 dark:text-zinc-400">Overall Errors</span>
              <span class="font-semibold {results.overallErrors.length > 0 ? 'text-red-500' : 'text-green-500'}">
                {results.overallErrors.length}
              </span>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Detailed Results -->
    <div in:fade={{ duration: 400, delay: 300 }}>
      <Card.Root class="justify-between">
        <Card.Header>
          <Card.Title>Page Performance Details</Card.Title>
          <Card.Description>Pages sorted by load time (slowest first)</Card.Description>
        </Card.Header>
      <Card.Content>
          <div class="space-y-4">
            {#each sortedPages as page, index}
              <div class="p-4 {getPerformanceBgColor(page.loadTime)} rounded-lg border border-zinc-200 dark:border-zinc-600">
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                      <span class="text-sm font-medium text-zinc-500 dark:text-zinc-400">#{index + 1}</span>
                      <h4 class="font-semibold text-zinc-900 dark:text-white">{page.pageName}</h4>
                      <span class="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-400">
                        {page.path}
                      </span>
                    </div>
                    
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">Load Time</span>
                        <p class="font-semibold {getPerformanceColor(page.loadTime)}">{formatTime(page.loadTime)}</p>
                      </div>
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">DOM Ready</span>
                        <p class="font-semibold text-zinc-700 dark:text-zinc-300">{formatTime(page.domContentLoaded)}</p>
                      </div>
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">Memory</span>
                        <p class="font-semibold text-zinc-700 dark:text-zinc-300">{formatMemory(page.memoryUsage)}</p>
                      </div>
                      <div>
                        <span class="text-zinc-500 dark:text-zinc-400">Requests</span>
                        <p class="font-semibold text-zinc-700 dark:text-zinc-300">{page.networkRequests}</p>
                      </div>
                    </div>

                    {#if page.firstPaint || page.firstContentfulPaint}
                      <div class="mt-3 grid grid-cols-2 gap-4 text-sm">
                        {#if page.firstPaint}
                          <div>
                            <span class="text-zinc-500 dark:text-zinc-400">First Paint</span>
                            <p class="font-semibold text-zinc-700 dark:text-zinc-300">{formatTime(page.firstPaint)}</p>
                          </div>
                        {/if}
                        {#if page.firstContentfulPaint}
                          <div>
                            <span class="text-zinc-500 dark:text-zinc-400">First Contentful Paint</span>
                            <p class="font-semibold text-zinc-700 dark:text-zinc-300">{formatTime(page.firstContentfulPaint)}</p>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <div class="flex items-center gap-4">
                    {#if page.errors.length > 0}
                      <div class="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <Icon src={ExclamationTriangle} class="w-4 h-4 text-red-500" />
                        <span class="text-sm font-medium text-red-700 dark:text-red-300">{page.errors.length} errors</span>
                      </div>
                    {/if}
                    {#if page.warnings.length > 0}
                      <div class="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <Icon src={ExclamationTriangle} class="w-4 h-4 text-yellow-500" />
                        <span class="text-sm font-medium text-yellow-700 dark:text-yellow-300">{page.warnings.length} warnings</span>
                      </div>
                    {/if}
                    {#if page.errors.length === 0 && page.warnings.length === 0}
                      <div class="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Icon src={CheckCircle} class="w-4 h-4 text-green-500" />
                        <span class="text-sm font-medium text-green-700 dark:text-green-300">No issues</span>
                      </div>
                    {/if}
                  </div>
                </div>

                {#if page.errors.length > 0 || page.warnings.length > 0}
                  <div class="mt-4 pt-4 border-t border-zinc-300 dark:border-zinc-600">
                    {#if page.errors.length > 0}
                      <div class="mb-3">
                        <h5 class="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Errors:</h5>
                        <ul class="space-y-1">
                          {#each page.errors as error}
                            <li class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                              {error}
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                    {#if page.warnings.length > 0}
                      <div>
                        <h5 class="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">Warnings:</h5>
                        <ul class="space-y-1">
                          {#each page.warnings as warning}
                            <li class="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                              {warning}
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
      </Card.Content>
      </Card.Root>
    </div>

    {#if results.overallErrors.length > 0}
      <!-- Overall Errors Section -->
      <div in:fade={{ duration: 400, delay: 400 }}>
        <Card.Root class="justify-between">
          <Card.Header>
            <Card.Title class="flex items-center gap-2">
              <Icon src={ExclamationTriangle} class="w-5 h-5 text-red-500" />
              Overall Test Errors
            </Card.Title>
            <Card.Description>Errors that occurred during the performance test</Card.Description>
          </Card.Header>
          <Card.Content>
            <ul class="space-y-2">
              {#each results.overallErrors as error}
                <li class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
                </li>
              {/each}
            </ul>
          </Card.Content>
        </Card.Root>
      </div>
    {/if}
  {/if}
</div>
