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
  import { createCalendarControlsPlugin } from '@schedule-x/calendar-controls';
  import { createCurrentTimePlugin } from '@schedule-x/current-time';
  import { createEventModalPlugin } from '@schedule-x/event-modal';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import TimeGridEvent from '$lib/components/timetable/TimeGridEvent.svelte';
  import { _ } from '../../lib/i18n';
  import 'temporal-polyfill/global';

  const studentId = 69;

  let calendarApp = $state<any>(null);
  let lessons = $state<any[]>([]);
  let lessonColours = $state<any[]>([]);
  let loadingLessons = $state(true);

  import { theme } from '$lib/stores/theme';

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
        description: lesson.staff ? `Teacher: ${lesson.staff}` : undefined,
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

    const plugins = [
      createCalendarControlsPlugin(),
      createCurrentTimePlugin(),
      createEventModalPlugin(),
    ];

    calendarApp = createCalendar({
      // @ts-ignore
      selectedDate: Temporal.PlainDate.from(today),
      // Set the calendar timezone to match the user's local time so events appear at the correct wall-clock time
      // @ts-ignore
      timezone: Temporal.Now.timeZoneId(),
      // Configure the week view to show only 5 days (Mon-Fri) which is standard for schools
      firstDayOfWeek: 1,
      // Skip heavy validation for performance since data is programmatically generated
      skipValidation: true,

      weekOptions: {
        nDays: 5,
        gridHeight: 1350, // Further reduced height for compact view
        eventOverlap: false,
        eventWidth: 98, // Slight gap between events for cleaner look
        // Clean 24h format for the axis (09:00, 10:00) matches school schedules well
        timeAxisFormatOptions: { hour: '2-digit', minute: '2-digit' },
      },

      monthGridOptions: {
        // Show more events in month view before collapsing to "+X more"
        // A typical school day has ~6 periods, so 7 ensures we see the full day usually
        nEventsPerDay: 7,
      },
      // Tighten visible hours to standard school day (8am - 4pm)
      dayBoundaries: {
        start: '08:00',
        end: '16:00',
      },
      views: [createViewWeek(), createViewDay(), createViewMonthGrid(), createViewMonthAgenda()],
      events: events,
      isDark: $theme === 'dark',
      plugins: plugins,
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
  /* Target the wrapper, internal calendar, and the modal (which attaches to body) */
  :global(.sx-svelte-calendar-wrapper),
  :global(.sx-svelte-calendar-wrapper .sx__calendar),
  :global(.sx-svelte-calendar-wrapper .is-dark),
  :global(.sx__event-modal) {
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

  /* Modal specific overrides for background */
  :global(.sx__event-modal),
  :global(.sx__event-modal__content) {
    background-color: var(--color-card) !important;
    border: 1px solid var(--color-border);
    box-shadow:
      0 20px 25px -5px rgb(0 0 0 / 0.1),
      0 8px 10px -6px rgb(0 0 0 / 0.1);
  }

  :global(.sx__event-modal__content) {
    color: var(--color-foreground) !important;
  }

  /* Fix date picker popup background and text visibility */
  :global(.sx__date-picker__popup),
  :global(.sx__date-picker-popup),
  :global(.sx__date-picker__wrapper) {
    background-color: var(--color-card) !important;
    border: 1px solid var(--color-border);
    box-shadow:
      0 10px 15px -3px rgb(0 0 0 / 0.1),
      0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  :global(.sx__date-picker__years-view),
  :global(.sx__date-picker__months-view),
  :global(.sx__date-picker__month-view) {
    background-color: var(--color-card);
  }

  :global(.sx__date-picker__day.is-selected) {
    background-color: var(--color-accent) !important;
    color: var(--color-accent-foreground) !important;
  }
</style>
