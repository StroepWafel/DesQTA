<script lang="ts">
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import TimetableWidget from '$lib/components/widgets/TimetableWidget.svelte';
  import { getUrlParam, updateUrlParam } from '$lib/utils/urlParams';
  import { getMonday, formatDate, parseDate } from '$lib/utils/timetableUtils';
  import type { WidgetConfig } from '$lib/types/widgets';

  // Check if mobile synchronously
  function checkMobile(): boolean {
    const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
    const isNativeMobile = tauriPlatform === 'ios' || tauriPlatform === 'android';
    const mql = window.matchMedia('(max-width: 640px)');
    const isSmallViewport = mql.matches;
    return isNativeMobile || isSmallViewport;
  }

  const isMobile = checkMobile();
  const initialViewMode: 'week' | 'day' | 'month' | 'list' = isMobile ? 'day' : 'week';

  let widgetConfig: WidgetConfig | null = $state(null);
  let weekStart = $state(getMonday(new Date()));
  let reloadKey = $state(0);
  let forceReload = $state(false);
  let previousDateParam = $state<string | null>(null);

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

  // Create a temporary widget config for the route
  $effect(() => {
    if (!widgetConfig) {
      const initialDate = parseDateFromUrl();
      weekStart = getMonday(initialDate);
      // Initialize previousDateParam with current URL param
      const currentDateParam = $page.url.searchParams.get('date');
      previousDateParam = currentDateParam;

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
          timeRange: { start: '08:00', end: '16:00' },
          showTeacher: true,
          showRoom: true,
          showAttendance: true,
          showEmptyPeriods: false,
          density: 'normal',
          defaultView: initialViewMode,
        },
      };
    }
  });
</script>

<div class="h-full w-full min-h-[calc(100vh-4rem)] p-4">
  {#if widgetConfig}
    <div class="h-full w-full" transition:fade={{ duration: 400 }}>
      <TimetableWidget widget={widgetConfig} isTemporary={true} initialWeekStart={weekStart} initialViewMode={initialViewMode} {reloadKey} {forceReload} />
    </div>
  {:else}
    <div class="flex items-center justify-center h-full">
      <div
        class="w-16 h-16 rounded-full border-4 animate-spin border-blue-500/30 border-t-blue-500">
      </div>
    </div>
  {/if}
</div>
