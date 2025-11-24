<script lang="ts">
  import { onMount } from 'svelte';
  import { ScheduleXCalendar } from '@schedule-x/svelte';
  import {
    createCalendar,
    createViewDay,
    createViewWeek,
    createViewMonthGrid,
    createViewMonthAgenda,
  } from '@schedule-x/calendar';
  import '@schedule-x/theme-default/dist/index.css';
  import 'temporal-polyfill/global';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import TimeGridEvent from '$lib/components/timetable/TimeGridEvent.svelte';
  import { _ } from '../../lib/i18n';
  import { theme } from '$lib/stores/theme';

  const studentId = 69;

  let calendarApp = $state<any>(null);
  let lessons = $state<any[]>([]);
  let lessonColours = $state<any[]>([]);
  let loadingLessons = $state(true);

  // Helper to format date for Schedule-X (YYYY-MM-DD HH:mm)
  // function formatEventDate(dateStr: string, timeStr: string): string { ... } - Unused now

  async function loadLessonColours() {
    const cachedColours = cache.get<any[]>('lesson_colours');
    if (cachedColours) {
      lessonColours = cachedColours;
      return lessonColours;
    }

    try {
      const res = await seqtaFetch('/seqta/student/load/prefs?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { request: 'userPrefs', asArray: true, user: studentId },
      });
      lessonColours = JSON.parse(res).payload;
      cache.set('lesson_colours', lessonColours, 30);
      return lessonColours;
    } catch (e) {
      console.error('Failed to load lesson colours', e);
      return [];
    }
  }

  async function fetchLessons(from: string, until: string) {
    const res = await seqtaFetch('/seqta/student/load/timetable?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { from, until, student: studentId },
    });
    return JSON.parse(res).payload.items;
  }

  function transformLessonsToEvents(items: any[], colours: any[]) {
    // @ts-ignore - Temporal is globally available via polyfill
    const timeZone = Temporal.Now.timeZoneId();

    return items.map((lesson: any) => {
      const colourPrefName = `timetable.subject.colour.${lesson.code}`;
      const subjectColour = colours.find((c: any) => c.name === colourPrefName);
      const color = subjectColour ? `${subjectColour.value}` : '#3b82f6';

      // Construct ZonedDateTime objects
      // lesson.from/until are HH:mm, lesson.date is YYYY-MM-DD
      // We need to add seconds for strict ISO parsing usually, or let Temporal parse it
      // Temporal.PlainDateTime.from('2023-01-01T10:00') works

      // @ts-ignore
      const start = Temporal.PlainDateTime.from(`${lesson.date}T${lesson.from}`)
        .toZonedDateTime(timeZone)
        .toString(); // Schedule-X might want the object or string?
      // Docs example: start: Temporal.ZonedDateTime.from(...)
      // The error said "needs to be a Temporal.ZonedDateTime" object.

      // @ts-ignore
      const startObj = Temporal.PlainDateTime.from(`${lesson.date}T${lesson.from}`).toZonedDateTime(
        timeZone,
      );
      // @ts-ignore
      const endObj = Temporal.PlainDateTime.from(`${lesson.date}T${lesson.until}`).toZonedDateTime(
        timeZone,
      );

      // Sanitize ID for DOM selector compatibility
      const rawId = lesson.uid || `${lesson.date}-${lesson.from}-${lesson.code}`;
      // Replace invalid chars with underscore or just use a hash/clean string
      // Schedule-X needs simple chars: a-z, A-Z, 0-9, -, _
      // Colons and dots are problematic in querySelector without escaping
      const id = rawId.replace(/[^a-zA-Z0-9-_]/g, '_');

      return {
        id: id,
        title: lesson.description || lesson.code || 'Lesson',
        start: startObj,
        end: endObj,
        location: lesson.room,
        staff: lesson.staff,
        color: color,
        description: `Room: ${lesson.room || 'N/A'}\nTeacher: ${lesson.staff || 'N/A'}`,
      };
    });
  }

  async function loadLessons() {
    loadingLessons = true;

    // Load a wide range (e.g., +/- 2 months from now) to populate the calendar
    // or rely on month change events if Schedule-X supports them (it might fetch on demand? No, usually client side)
    // For now, let's load current month + prev/next
    const now = new Date();
    // Start of last month
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // End of next month
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const fromStr = start.toISOString().split('T')[0];
    const untilStr = end.toISOString().split('T')[0];
    const cacheKey = `timetable_${fromStr}_${untilStr}`;

    try {
      let items =
        cache.get<any[]>(cacheKey) ||
        (await getWithIdbFallback<any[]>(cacheKey, cacheKey, () => cache.get<any[]>(cacheKey)));

      if (!items) {
        items = await fetchLessons(fromStr, untilStr);
        // Cache
        cache.set(cacheKey, items, 30);
        await setIdb(cacheKey, items);
      }

      const colours = await loadLessonColours();
      const events = transformLessonsToEvents(items || [], colours || []);

      initCalendar(events);
    } catch (e) {
      console.error('Error loading timetable:', e);
    } finally {
      loadingLessons = false;
    }
  }

  function initCalendar(events: any[]) {
    // Determine initial date (today)
    const today = new Date().toISOString().split('T')[0];

    calendarApp = createCalendar({
      // @ts-ignore
      selectedDate: Temporal.PlainDate.from(today),
      views: [createViewDay(), createViewWeek(), createViewMonthGrid(), createViewMonthAgenda()],
      events: events,
      isDark: $theme === 'dark',
      callbacks: {
        // We could hook into view changes here to fetch more data if needed
      },
    });
  }

  // Handle theme changes
  $effect(() => {
    if (calendarApp) {
      calendarApp.setTheme($theme === 'dark' ? 'dark' : 'light');
    }
  });

  onMount(() => {
    loadLessons();
  });
</script>

<div class="sx-svelte-calendar-wrapper h-full w-full min-h-[calc(100vh-4rem)] p-4">
  {#if calendarApp}
    <ScheduleXCalendar {calendarApp} timeGridEvent={TimeGridEvent} />
  {:else}
    <div class="flex items-center justify-center h-full">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  {/if}
</div>

<style>
  /* Target the wrapper AND the internal calendar root to ensure overrides win against library defaults */
  :global(.sx-svelte-calendar-wrapper),
  :global(.sx-svelte-calendar-wrapper .sx__calendar),
  :global(.sx-svelte-calendar-wrapper .is-dark) {
    /* Customization for Schedule-X to match app theme */
    --sx-color-primary: var(--color-accent);
    --sx-color-on-primary: var(--color-accent-foreground);
    --sx-color-primary-container: color-mix(in srgb, var(--color-accent) 20%, transparent);
    --sx-color-on-primary-container: var(--color-accent);

    --sx-color-secondary: var(--color-secondary);
    --sx-color-on-secondary: var(--color-secondary-foreground);
    --sx-color-secondary-container: var(--color-muted);
    --sx-color-on-secondary-container: var(--color-foreground);

    --sx-color-tertiary: var(--color-chart-1);
    --sx-color-on-tertiary: var(--color-foreground);
    --sx-color-tertiary-container: var(--color-chart-1);
    --sx-color-on-tertiary-container: var(--color-foreground);

    --sx-color-surface: var(--color-card);
    --sx-color-surface-dim: var(--color-muted);
    --sx-color-surface-bright: var(--color-card);
    --sx-color-on-surface: var(--color-card-foreground);

    --sx-color-surface-container: var(--color-card);
    --sx-color-surface-container-low: var(--color-card);
    --sx-color-surface-container-high: var(--color-muted);

    --sx-color-background: transparent;
    --sx-color-on-background: var(--color-foreground);

    --sx-color-outline: var(--color-border);
    --sx-color-outline-variant: var(--color-border);

    --sx-color-shadow: transparent;
    --sx-color-surface-tint: var(--color-accent);

    --sx-color-neutral: var(--color-muted);
    --sx-color-neutral-variant: var(--color-border);
    --sx-color-on-neutral: var(--color-muted-foreground);

    /* Internal overrides for cleaner look */
    --sx-internal-color-light-gray: var(--color-muted);
    --sx-internal-color-text: var(--color-foreground);
    --sx-internal-color-gray-ripple-background: var(--color-muted);

    font-family: inherit;
  }
</style>
