<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import TimetableWidget from '$lib/components/widgets/TimetableWidget.svelte';
  import TimetableHeader from '$lib/components/widgets/timetable/TimetableHeader.svelte';
  import { getUrlParam, updateUrlParam } from '$lib/utils/urlParams';
  import { getMonday, formatDate, parseDate, getTimeRangeFromSeqtaConfig } from '$lib/utils/timetableUtils';
  import type { WidgetConfig } from '$lib/types/widgets';
  import { platformStore } from '$lib/stores/platform';
  import T from '$lib/components/T.svelte';

  let isMobile = $derived($platformStore.isMobile);
  let initialViewMode = $derived<'week' | 'day' | 'month' | 'list'>(isMobile ? 'day' : 'week');

  let seqtaConfig = $state<{ payload?: Record<string, { value?: string }> } | null>(null);
  let widgetConfig: WidgetConfig | null = $state(null);
  let weekStart = $state(getMonday(new Date()));
  let viewMode = $state<'week' | 'day' | 'month' | 'list'>('week');
  let selectedDate = $state(new Date());
  let reloadKey = $state(0);
  let forceReload = $state(false);
  let previousDateParam = $state<string | null>(null);
  let headerState = $state<{
    loadingLessons: boolean;
    onExportCsv: () => void;
    onExportPdf: () => void;
    onExportIcal: () => void;
  } | null>(null);

  async function handlePrevWeek() {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() - 7);
    const newWeekStart = getMonday(newDate);
    weekStart = newWeekStart;
    selectedDate = newWeekStart;
    await updateUrlParam('date', formatDate(newWeekStart));
  }

  async function handleNextWeek() {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + 7);
    const newWeekStart = getMonday(newDate);
    weekStart = newWeekStart;
    selectedDate = newWeekStart;
    await updateUrlParam('date', formatDate(newWeekStart));
  }

  async function handleToday() {
    const today = new Date();
    const todayWeekStart = getMonday(today);
    weekStart = todayWeekStart;
    selectedDate = today;
    await updateUrlParam('date', formatDate(today));
  }

  function handleViewModeChange(mode: 'week' | 'day' | 'month' | 'list') {
    viewMode = mode;
  }

  // Parse date from URL
  function parseDateFromUrl(): Date {
    const dateParam = getUrlParam('date');
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(dateParam)) {
        return parseDate(dateParam);
      }
    }
    return new Date();
  }

  // Update URL when date changes
  async function updateUrl(date: Date) {
    const dateStr = formatDate(date);
    await updateUrlParam('date', dateStr);
  }

  // Watch for URL changes (back/forward navigation)
  $effect(() => {
    const dateParam = $page.url.searchParams.get('date');
    
    // Determine if this is back navigation (going to earlier date) or forward (going to later date)
    let isBackNavigation = false;
    if (dateParam && previousDateParam) {
      const currentDate = parseDate(dateParam);
      const previousDate = parseDate(previousDateParam);
      isBackNavigation = currentDate < previousDate;
    }
    
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(dateParam)) {
        const urlDate = parseDate(dateParam);
        const urlWeekStart = getMonday(urlDate);
        // Only update if the week actually changed
        if (urlWeekStart.getTime() !== weekStart.getTime()) {
          weekStart = urlWeekStart;
          forceReload = isBackNavigation; // Only force reload on back navigation
          reloadKey++;
        }
        previousDateParam = dateParam;
      }
    } else {
      // No date param, use current date
      const today = new Date();
      const todayWeekStart = getMonday(today);
      if (todayWeekStart.getTime() !== weekStart.getTime()) {
        weekStart = todayWeekStart;
        forceReload = false; // Default to cached data
        reloadKey++;
      }
      previousDateParam = null;
    }
  });

  let configLoadAttempted = $state(false);

  onMount(async () => {
    try {
      const config = await invoke<{ payload?: Record<string, { value?: string }> }>('load_seqta_config');
      seqtaConfig = config;
    } catch {
      seqtaConfig = null;
    } finally {
      configLoadAttempted = true;
    }
  });

  // Create a temporary widget config for the route (waits for config load attempt)
  $effect(() => {
    if (!configLoadAttempted || widgetConfig) return;

    const initialDate = parseDateFromUrl();
    weekStart = getMonday(initialDate);
    selectedDate = initialDate;
    viewMode = initialViewMode;
    // Initialize previousDateParam with current URL param
    const currentDateParam = $page.url.searchParams.get('date');
    previousDateParam = currentDateParam;

    // Time range from seqtaConfig (attendance.defaults.time_from/to) with 30 min padding
    const timeRange = getTimeRangeFromSeqtaConfig(seqtaConfig, 30);

    // Create a widget config for the timetable page
    widgetConfig = {
      id: 'timetable-page-widget',
      type: 'timetable',
      enabled: true,
      position: {
        x: 0,
        y: 0,
        w: 12,
        h: 12,
      },
      settings: {
        viewMode: initialViewMode,
        timeRange,
        showTeacher: true,
        showRoom: true,
        showAttendance: true,
        showEmptyPeriods: false,
        density: 'normal',
        defaultView: initialViewMode,
      },
    };
  });
</script>

<div class="container max-w-none w-full p-5 mx-auto flex flex-col h-full gap-6" data-onboarding="timetable-color">
  <!-- Header row: page title + timetable controls at same level -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
    <div>
      <h1 class="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
        <T key="navigation.timetable" fallback="Timetable" />
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        <T key="timetable.description" fallback="View your weekly schedule and lessons" />
      </p>
    </div>

    <!-- Timetable controls: week nav, view switcher, export (same level as header) -->
    {#if widgetConfig && headerState}
      <TimetableHeader
        weekStart={weekStart}
        loadingLessons={headerState.loadingLessons}
        {viewMode}
        inline={true}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onViewModeChange={handleViewModeChange}
        onExportCsv={headerState.onExportCsv}
        onExportPdf={headerState.onExportPdf}
        onExportIcal={headerState.onExportIcal} />
    {/if}
  </div>

  <!-- Timetable widget (content only, no header) -->
  <div class="flex-1 min-h-0 flex flex-col">
    {#if widgetConfig}
      <div class="flex-1 min-h-0 flex flex-col" transition:fade={{ duration: 400 }}>
        <TimetableWidget
          widget={widgetConfig}
          isTemporary={true}
          initialWeekStart={weekStart}
          initialViewMode={initialViewMode}
          {reloadKey}
          {forceReload}
          hideHeader={true}
          weekStart={weekStart}
          viewMode={viewMode}
          selectedDate={selectedDate}
          onWeekStartChange={(d) => {
            weekStart = getMonday(d);
            selectedDate = d;
          }}
          onViewModeChange={(m) => (viewMode = m)}
          onSelectedDateChange={(d) => (selectedDate = d)}
          onPageHeaderStateReady={(s) => (headerState = s)}
        />
      </div>
    {:else}
      <div class="flex items-center justify-center flex-1">
        <div
          class="w-16 h-16 rounded-full border-4 animate-spin border-blue-500/30 border-t-blue-500">
        </div>
      </div>
    {/if}
  </div>
</div>
