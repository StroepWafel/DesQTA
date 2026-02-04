<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { getUrlParam } from '$lib/utils/urlParams';

  let reports = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');

  function formatDate(dateStr: string) {
    let isoDate = dateStr.replace(' ', 'T');

    if (!(isoDate.charAt(isoDate.length - 3) == ':')) {
      isoDate = ''.concat(dateStr.replace(' ', 'T'), ':00');
    }
    const date = new Date(isoDate);

    return date
      .toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      .toUpperCase();
  }

  async function loadReports() {
    loading = true;
    error = '';

    // Check cache first
    const cachedReports = cache.get<any[]>('reports');
    if (cachedReports) {
      reports = cachedReports;
      loading = false;
      return;
    }

    try {
      const response = await seqtaFetch('/seqta/student/load/reports?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (data.status === '200' && Array.isArray(data.payload)) {
        reports = data.payload;
        // Cache reports for 5 minutes
        cache.set('reports', reports);
      } else {
        error = $_('reports.failed_to_load') || 'Failed to load reports.';
      }
    } catch (e) {
      error = $_('reports.error_loading') || 'Error loading reports.';
    } finally {
      loading = false;
    }
  }

  async function openReportInBrowser(report: any) {
    try {
      const url = await invoke('get_seqta_file', {
        fileType: 'report',
        uuid: report.uuid,
      });
      if (typeof url === 'string') {
        await openUrl(url);
      }
    } catch (e) {
      // Optionally handle error (e.g., show a toast)
    }
  }

  onMount(async () => {
    await loadReports();

    // Check for report parameter to highlight/open specific report
    const reportParam = getUrlParam('report');
    if (reportParam && reports.length > 0) {
      const report = reports.find(
        (r) => r.uuid === reportParam || r.id?.toString() === reportParam,
      );
      if (report) {
        // Scroll to report and optionally open it
        setTimeout(() => {
          const element = document.querySelector(`[data-report-id="${report.uuid || report.id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optionally auto-open the report
            // openReportInBrowser(report);
          }
        }, 300);
      }
    }
  });
</script>

<div class="p-8 min-h-screen">
  <h1 class="mb-8 text-3xl font-bold text-zinc-900 dark:text-white">
    <T key="navigation.reports" fallback="Reports" />
  </h1>
  {#if loading}
    <div class="flex flex-col justify-center items-center py-24">
      <div
        class="w-16 h-16 rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500">
      </div>
      <p class="mt-4 text-zinc-600 dark:text-zinc-400">
        <T key="reports.loading" fallback="Loading reports..." />
      </p>
    </div>
  {:else if error}
    <div class="flex flex-col justify-center items-center py-24">
      <div
        class="flex justify-center items-center w-20 h-20 text-3xl bg-linear-to-br from-red-500 to-red-600 rounded-full shadow-xs animate-gradient">
        ⚠️
      </div>
      <p class="mt-4 text-xl text-zinc-700 dark:text-zinc-300">{error}</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {#key reports.length + reports.map((r) => r.uuid || r.id).join(',')}
        {#each reports as report, i}
          <div
            data-report-id={report.uuid || report.id}
            class="group dark:bg-zinc-800 dark:border-[#333] border border-zinc-200 bg-zinc-100 rounded-2xl p-0 overflow-hidden shadow-md transition-all duration-200 hover:scale-[1.03] hover:shadow-lg focus:outline-hidden report-card-animate"
            style="animation-delay: {i * 50}ms;">
            <div class="flex justify-between items-center px-6 pt-6">
              <div
                class="px-6 py-2 text-lg font-bold tracking-widest text-white rounded-full transition-colors duration-300 accent-bg group-hover:opacity-90 animate-gradient">
                {report.year}
              </div>
              <div
                class="px-6 py-2 text-sm font-bold tracking-widest text-white rounded-full transition-colors duration-300 accent-bg group-hover:opacity-90 animate-gradient">
                {report.terms}
              </div>
            </div>
            <div class="flex flex-col flex-1 justify-center items-center py-12">
              <div
                class="mb-2 text-2xl font-extrabold text-center text-zinc-900 dark:text-white animate-fade-in">
                {report.types}
              </div>
            </div>
            <div class="px-6 pb-6">
              <div
                class="text-xs font-semibold text-center opacity-80 text-zinc-900 dark:text-white animate-fade-in">
                {formatDate(report.created_date)}
              </div>
              <button
                class="mt-4 inline-block w-full text-center px-4 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 accent-bg accent-ring text-white"
                onclick={() => openReportInBrowser(report)}>
                <T key="reports.download" fallback="Download" />
              </button>
            </div>
          </div>
        {/each}
      {/key}
    </div>
  {/if}
</div>

<style>
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient-shift 8s ease infinite;
  }
  @keyframes gradient-shift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .animate-fade-in {
    animation: fade-in 0.7s cubic-bezier(0.4, 2.3, 0.3, 1);
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .report-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
