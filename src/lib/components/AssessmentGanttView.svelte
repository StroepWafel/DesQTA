<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Icon, ChevronDown, ChevronRight } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { saveSettingsWithQueue } from '$lib/services/settingsSync';
  import T from '$lib/components/T.svelte';
  import type { Assessment } from '$lib/types';
  import { tooltip } from '$lib/actions/tooltip';

  interface Props {
    assessments: (Assessment & { colour?: string })[];
    subjects?: { code: string; title: string; colour?: string }[];
    activeSubjects?: { code: string; title: string; colour?: string }[];
  }

  let { assessments }: Props = $props();

  type ViewMode = 'Day' | 'Week' | 'Month';

  type GanttRow =
    | { type: 'subject'; key: string; subject: string; color: string; count: number }
    | {
        type: 'assessment';
        assessment: Assessment & { colour?: string };
        subject: string;
        start: Date;
        end: Date;
        leadDays: number;
        progress: number;
        color: string;
      };

  let viewMode = $state<ViewMode>('Week');
  let collapsedSubjects = $state<Set<string>>(new Set());
  let scrollEl = $state<HTMLDivElement | null>(null);
  let hasInitialScroll = $state(false);
  let showCompleted = $state(false);
  let leadDaysOverrides = $state<Record<string, number>>({});
  let settingsLoaded = $state(false);

  const LIST_WIDTH = 420;
  const ROW_HEIGHT = 36;
  const DEFAULT_LEAD_DAYS = 14;
  const MIN_LEAD_DAYS = 1;
  const MAX_LEAD_DAYS = 365;

  function assessmentKey(a: Assessment): string {
    const mc = (a as Assessment & { metaclass?: number }).metaclass ?? a.metaclassID ?? 0;
    return `${a.id}-${mc}`;
  }

  function isAssessmentComplete(a: Assessment): boolean {
    if (a.status === 'MARKS_RELEASED') return true;
    if (a.graded) return true;
    const submitted = (a as Assessment & { submitted?: boolean | number }).submitted;
    if (submitted === true || submitted === 1) return true;
    return false;
  }

  function getLeadDays(a: Assessment): number {
    const key = assessmentKey(a);
    const custom = leadDaysOverrides[key];
    if (typeof custom === 'number' && custom >= MIN_LEAD_DAYS) return custom;
    return DEFAULT_LEAD_DAYS;
  }

  function parseLeadDaysMap(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n) && n >= MIN_LEAD_DAYS && n <= MAX_LEAD_DAYS) {
        out[key] = Math.round(n);
      }
    }
    return out;
  }

  async function loadGanttSettings() {
    try {
      const settings = await invoke<{
        gantt_show_completed?: boolean;
        gantt_lead_days?: Record<string, number>;
      }>('get_settings_subset', {
        keys: ['gantt_show_completed', 'gantt_lead_days'],
      });
      showCompleted = settings.gantt_show_completed ?? false;
      leadDaysOverrides = parseLeadDaysMap(settings.gantt_lead_days);
    } catch {
      showCompleted = false;
      leadDaysOverrides = {};
    } finally {
      settingsLoaded = true;
    }
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function persistGanttSettings() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      saveSettingsWithQueue({
        gantt_show_completed: showCompleted,
        gantt_lead_days: leadDaysOverrides,
      }).catch(() => {});
    }, 400);
  }

  function setShowCompleted(value: boolean) {
    showCompleted = value;
    persistGanttSettings();
  }

  function setLeadDays(a: Assessment, days: number) {
    const clamped = Math.max(MIN_LEAD_DAYS, Math.min(MAX_LEAD_DAYS, Math.round(days)));
    const key = assessmentKey(a);
    if (clamped === DEFAULT_LEAD_DAYS) {
      const { [key]: _, ...rest } = leadDaysOverrides;
      leadDaysOverrides = rest;
    } else {
      leadDaysOverrides = { ...leadDaysOverrides, [key]: clamped };
    }
    persistGanttSettings();
  }

  const visibleAssessments = $derived.by(() => {
    if (!settingsLoaded) return assessments ?? [];
    if (showCompleted) return assessments ?? [];
    return (assessments ?? []).filter((a) => !isAssessmentComplete(a));
  });

  function toStartOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function toStartOfWeek(d: Date): Date {
    const x = new Date(d);
    x.setDate(x.getDate() - x.getDay());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function toStartOfMonth(d: Date): Date {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function addWeeks(d: Date, n: number): Date {
    return addDays(d, n * 7);
  }

  function addMonths(d: Date, n: number): Date {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  }

  function diffDays(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
  }

  function formatShort(d: Date): string {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function assessmentProgress(a: Assessment, due: Date): number {
    if (a.status === 'MARKS_RELEASED') return 100;
    const now = new Date();
    const start = addDays(due, -DEFAULT_LEAD_DAYS);
    if (due < now) return 75;
    const total = due.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.max(0, Math.min(50, (elapsed / total) * 100));
  }

  function subjectKey(a: Assessment): string {
    return a.subject || a.code || 'Other';
  }

  function buildRows(): GanttRow[] {
    if (!visibleAssessments.length) return [];

    const groups = new Map<string, (Assessment & { colour?: string })[]>();
    for (const a of visibleAssessments) {
      const key = subjectKey(a);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }

    const rows: GanttRow[] = [];
    const sortedSubjects = [...groups.keys()].sort((a, b) => a.localeCompare(b));

    for (const subject of sortedSubjects) {
      const items = groups.get(subject)!;
      const color = items[0]?.colour || '#64748b';
      rows.push({ type: 'subject', key: subject, subject, color, count: items.length });

      if (collapsedSubjects.has(subject)) continue;

      const sorted = [...items].sort(
        (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime(),
      );

      for (const a of sorted) {
        const end = toStartOfDay(new Date(a.due));
        const leadDays = getLeadDays(a);
        const start = addDays(end, -leadDays);
        rows.push({
          type: 'assessment',
          assessment: a,
          subject,
          start,
          end,
          leadDays,
          progress: assessmentProgress(a, end),
          color: a.colour || color,
        });
      }
    }

    return rows;
  }

  let rows = $derived(buildRows());

  let timeline = $derived.by(() => {
    const taskRows = rows.filter((r) => r.type === 'assessment') as Extract<
      GanttRow,
      { type: 'assessment' }
    >[];
    if (taskRows.length === 0) {
      const start = addDays(toStartOfDay(new Date()), -7);
      const colWidth = viewMode === 'Month' ? 80 : viewMode === 'Week' ? 56 : 48;
      return {
        rangeStart: start,
        rangeEnd: addDays(start, 60),
        columnWidth: colWidth,
        totalColumns: 60,
        totalWidth: 60 * colWidth,
      };
    }

    const starts = taskRows.map((r) => r.start.getTime());
    const ends = taskRows.map((r) => r.end.getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...ends));
    const furthest = addDays(maxDate, 7);
    const minBound = addDays(toStartOfDay(new Date()), 4);
    const maxBound = furthest.getTime() > minBound.getTime() ? furthest : minBound;

    let rangeStart: Date;
    let colCount: number;
    const colWidth = viewMode === 'Month' ? 80 : viewMode === 'Week' ? 56 : 48;

    if (viewMode === 'Day') {
      rangeStart = toStartOfDay(addDays(minDate, -4));
      const end = toStartOfDay(maxBound);
      colCount = Math.max(30, diffDays(end, rangeStart) + 1);
    } else if (viewMode === 'Week') {
      rangeStart = toStartOfWeek(addDays(minDate, -4));
      const end = toStartOfWeek(maxBound);
      colCount = Math.max(12, Math.ceil(diffDays(end, rangeStart) / 7) + 1);
    } else {
      rangeStart = toStartOfMonth(addDays(minDate, -4));
      const end = toStartOfMonth(maxBound);
      colCount =
        Math.max(6, (end.getFullYear() - rangeStart.getFullYear()) * 12 + (end.getMonth() - rangeStart.getMonth()) + 1);
    }

    const rangeEnd =
      viewMode === 'Month'
        ? addMonths(rangeStart, colCount)
        : viewMode === 'Week'
          ? addWeeks(rangeStart, colCount)
          : addDays(rangeStart, colCount);

    return {
      rangeStart,
      rangeEnd,
      columnWidth: colWidth,
      totalColumns: colCount,
      totalWidth: colCount * colWidth,
    };
  });

  function columnLabel(i: number): { label: string; sub: string } {
    const { rangeStart } = timeline;
    if (viewMode === 'Day') {
      const d = addDays(rangeStart, i);
      return {
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        sub: String(d.getDate()),
      };
    }
    if (viewMode === 'Week') {
      const d = addWeeks(rangeStart, i);
      return {
        label: `W${Math.ceil(d.getDate() / 7)}`,
        sub: d.toLocaleDateString(undefined, { month: 'short' }),
      };
    }
    const d = addMonths(rangeStart, i);
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      sub: String(d.getFullYear()),
    };
  }

  function dateToX(date: Date): number {
    const { rangeStart, rangeEnd, totalWidth } = timeline;
    const ms = date.getTime() - rangeStart.getTime();
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    if (rangeMs <= 0) return 0;
    return Math.max(0, (ms / rangeMs) * totalWidth);
  }

  function barLayout(start: Date, end: Date) {
    const x = dateToX(start);
    const w = Math.max(20, dateToX(end) - x);
    return { x, w };
  }

  function startBarResize(e: PointerEvent, row: Extract<GanttRow, { type: 'assessment' }>) {
    e.preventDefault();
    e.stopPropagation();

    const state = {
      key: assessmentKey(row.assessment),
      startX: e.clientX,
      initialDays: row.leadDays,
    };

    const onMove = (ev: PointerEvent) => {
      const deltaPx = state.startX - ev.clientX;
      const { rangeStart, rangeEnd, totalWidth } = timeline;
      const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
      if (rangeMs <= 0 || totalWidth <= 0) return;
      const msPerPx = rangeMs / totalWidth;
      const deltaDays = Math.round((deltaPx * msPerPx) / (24 * 60 * 60 * 1000));
      const nextDays = Math.max(
        MIN_LEAD_DAYS,
        Math.min(MAX_LEAD_DAYS, state.initialDays + deltaDays),
      );
      if (nextDays === DEFAULT_LEAD_DAYS) {
        const { [state.key]: _, ...rest } = leadDaysOverrides;
        leadDaysOverrides = rest;
      } else {
        leadDaysOverrides = { ...leadDaysOverrides, [state.key]: nextDays };
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      persistGanttSettings();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function handleDaysInput(a: Assessment, raw: string) {
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    setLeadDays(a, parsed);
  }

  function toggleSubject(subject: string) {
    const next = new Set(collapsedSubjects);
    if (next.has(subject)) next.delete(subject);
    else next.add(subject);
    collapsedSubjects = next;
  }

  function openAssessment(a: Assessment) {
    const year = new Date(a.due).getFullYear();
    const metaclass = (a as Assessment & { metaclass?: number }).metaclass ?? a.metaclassID ?? 0;
    goto(`/assessments/${a.id}/${metaclass}?tab=overview&year=${year}#top`);
  }

  $effect(() => {
    if (!scrollEl || hasInitialScroll || timeline.totalWidth <= 0) return;
    const target = addDays(toStartOfDay(new Date()), -6);
    scrollEl.scrollLeft = dateToX(target);
    hasInitialScroll = true;
  });

  $effect(() => {
    viewMode;
    hasInitialScroll = false;
  });

  onMount(() => {
    loadGanttSettings();
  });

  const todayX = $derived(dateToX(new Date()));
  const todayVisible = $derived(todayX >= 0 && todayX <= timeline.totalWidth);
  const taskCount = $derived(rows.filter((r) => r.type === 'assessment').length);
</script>

<div class="assessment-gantt">
  <div class="gantt-toolbar">
    {#each ['Day', 'Week', 'Month'] as mode}
      <button
        type="button"
        class={viewMode === mode ? 'active' : ''}
        onclick={() => (viewMode = mode as ViewMode)}>
        {mode}
      </button>
    {/each}
    <label class="gantt-show-completed">
      <input
        type="checkbox"
        checked={showCompleted}
        onchange={(e) => setShowCompleted((e.currentTarget as HTMLInputElement).checked)} />
      <T key="assessments.gantt_show_completed" fallback="Show completed" />
    </label>
    <span class="gantt-toolbar-meta nums-tabular">
      {taskCount} assessment{taskCount === 1 ? '' : 's'}
    </span>
  </div>

  {#if !settingsLoaded}
    <div class="gantt-empty">
      <div
        class="w-5 h-5 border-2 border-accent-600 border-t-transparent rounded-full animate-spin">
      </div>
    </div>
  {:else if taskCount === 0}
    <div class="gantt-empty">
      <p class="text-4xl mb-3 opacity-60">📊</p>
      <p class="font-medium text-foreground">No assessments to display</p>
      <p class="text-sm text-muted-foreground mt-1">
        {#if !showCompleted}
          Active assessments for this year will appear here. Tick “Show completed” to include marked
          tasks.
        {:else}
          Assessments for this year will appear on the timeline.
        {/if}
      </p>
    </div>
  {:else}
    <div class="gantt-main" bind:this={scrollEl}>
      <div class="gantt-inner" style="min-width: {LIST_WIDTH + timeline.totalWidth}px">
        <div class="gantt-list" style="width: {LIST_WIDTH}px">
          <div class="gantt-list-header">
            <span></span>
            <span class="gantt-hdr-task">Assessment</span>
            <span class="gantt-hdr-days">Days</span>
            <span class="gantt-hdr-from">From</span>
            <span class="gantt-hdr-to">Due</span>
          </div>

          {#each rows as row, i (row.type === 'subject' ? `s-${row.subject}` : `a-${row.assessment.id}`)}
            {#if row.type === 'subject'}
              {@const collapsed = collapsedSubjects.has(row.subject)}
              <div class="gantt-list-row gantt-row-subject">
                <button
                  type="button"
                  class="gantt-expand-btn"
                  onclick={() => toggleSubject(row.subject)}
                  aria-label={collapsed ? 'Expand subject' : 'Collapse subject'}
                  use:tooltip={collapsed ? 'Expand subject' : 'Collapse subject'}>
                  <Icon src={collapsed ? ChevronRight : ChevronDown} class="w-3.5 h-3.5" />
                </button>
                <span class="gantt-list-name">{row.subject}</span>
                <span class="gantt-list-date">—</span>
                <span class="gantt-list-date">—</span>
                <span class="gantt-list-date nums-tabular">{row.count}</span>
              </div>
            {:else}
              <div class="gantt-list-row gantt-row-assessment">
                <button
                  type="button"
                  class="gantt-list-open"
                  onclick={() => openAssessment(row.assessment)}>
                  <span class="gantt-expand-spacer"></span>
                  <span class="gantt-list-name" style="padding-left: 12px">{row.assessment.title}</span>
                </button>
                <label class="gantt-days-input-wrap" title="Days to work on task (sets start date)">
                  <input
                    type="number"
                    class="gantt-days-input nums-tabular"
                    min={MIN_LEAD_DAYS}
                    max={MAX_LEAD_DAYS}
                    value={row.leadDays}
                    onchange={(e) =>
                      handleDaysInput(row.assessment, (e.currentTarget as HTMLInputElement).value)}
                    onclick={(e) => e.stopPropagation()} />
                  <span class="gantt-days-suffix">d</span>
                </label>
                <span class="gantt-list-date nums-tabular">{formatShort(row.start)}</span>
                <span class="gantt-list-date nums-tabular">{formatShort(row.end)}</span>
              </div>
            {/if}
          {/each}
        </div>

        <div class="gantt-timeline-wrap" style="min-width: {timeline.totalWidth}px">
          <div class="gantt-timeline" style="width: {timeline.totalWidth}px">
            <div class="gantt-header" style="width: {timeline.totalWidth}px">
              {#each { length: timeline.totalColumns } as _, i}
                {@const col = columnLabel(i)}
                <div class="gantt-header-cell" style="width: {timeline.columnWidth}px">
                  <span class="gantt-header-label">{col.label}</span>
                  <span class="gantt-header-sublabel nums-tabular">{col.sub}</span>
                </div>
              {/each}
            </div>

            <div class="gantt-rows">
              {#if todayVisible}
                <div
                  class="gantt-today"
                  style="left: {todayX}px; height: {rows.length * ROW_HEIGHT}px">
                </div>
              {/if}

              {#each rows as row (row.type === 'subject' ? `ts-${row.subject}` : `ta-${row.assessment.id}`)}
                <div class="gantt-row" style="height: {ROW_HEIGHT}px">
                  {#if row.type === 'subject'}
                    {@const items = rows.filter(
                      (r): r is Extract<GanttRow, { type: 'assessment' }> =>
                        r.type === 'assessment' && r.subject === row.subject,
                    )}
                    {#if items.length > 0}
                      {@const start = items.reduce(
                        (min, r) => (r.start < min ? r.start : min),
                        items[0].start,
                      )}
                      {@const end = items.reduce(
                        (max, r) => (r.end > max ? r.end : max),
                        items[0].end,
                      )}
                      {@const bar = barLayout(start, end)}
                      <div
                        class="gantt-bar gantt-bar-summary"
                        style="left: {bar.x}px; width: {bar.w}px; background-color: {row.color}">
                      </div>
                    {/if}
                  {:else}
                    {@const bar = barLayout(row.start, row.end)}
                    <div
                      class="gantt-bar-wrap"
                      style="left: {bar.x}px; width: {bar.w}px">
                      <button
                        type="button"
                        class="gantt-bar"
                        style="background-color: {row.color}"
                        title="{row.assessment.title} · {row.leadDays} days · Due {formatShort(row.end)}"
                        onclick={() => openAssessment(row.assessment)}>
                        <div
                          class="gantt-bar-progress"
                          style="width: {(row.progress / 100) * bar.w}px">
                        </div>
                        <span class="gantt-bar-label">{row.assessment.title}</span>
                      </button>
                      <div
                        class="gantt-bar-resize"
                        role="separator"
                        aria-label="Adjust task duration"
                        onpointerdown={(e) => startBarResize(e, row)}>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .assessment-gantt {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 420px;
  }

  .gantt-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .gantt-toolbar button {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    transition: background-color 150ms, border-color 150ms, color 150ms;
  }

  .gantt-toolbar button:hover {
    background: var(--surface-muted);
    border-color: var(--border-strong);
  }

  .gantt-toolbar button.active {
    background: var(--accent-color, var(--accent-color-value, #3b82f6));
    border-color: var(--accent-color, var(--accent-color-value, #3b82f6));
    color: #fff;
  }

  .gantt-toolbar-meta {
    margin-left: auto;
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  .gantt-show-completed {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--foreground);
    cursor: pointer;
    user-select: none;
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    background: var(--card);
  }

  .gantt-show-completed:hover {
    background: var(--surface-muted);
    border-color: var(--border-strong);
  }

  .gantt-show-completed input {
    width: 0.875rem;
    height: 0.875rem;
    accent-color: var(--accent-color, var(--accent-color-value, #3b82f6));
  }

  .gantt-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--card);
    text-align: center;
  }

  .gantt-main {
    flex: 1;
    min-height: 360px;
    max-height: min(70vh, 720px);
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--card);
  }

  .gantt-inner {
    display: flex;
    flex-shrink: 0;
  }

  .gantt-list {
    flex-shrink: 0;
    position: sticky;
    left: 0;
    z-index: 10;
    background: var(--surface-muted);
    border-right: 1px solid var(--border);
    box-shadow: 4px 0 8px rgba(0, 0, 0, 0.06);
  }

  :global(.dark) .gantt-list {
    box-shadow: 4px 0 8px rgba(0, 0, 0, 0.25);
  }

  .gantt-list-header,
  .gantt-list-row {
    display: grid;
    grid-template-columns: 36px minmax(120px, 1fr) 52px 68px 68px;
    gap: 0.375rem;
    align-items: center;
    padding: 0 0.5rem 0 0.75rem;
    height: 36px;
    min-height: 36px;
    box-sizing: border-box;
  }

  .gantt-list-header {
    position: sticky;
    top: 0;
    z-index: 5;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted-foreground);
    background: var(--card);
    border-bottom: 1px solid var(--border);
  }

  .gantt-list-row {
    width: 100%;
    text-align: left;
    font-size: 0.8125rem;
    color: var(--foreground);
    background: var(--surface-muted);
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    transition: background-color 150ms;
  }

  .gantt-list-open {
    display: contents;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .gantt-row-assessment:hover {
    background: var(--surface-3);
  }

  .gantt-days-input-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    position: relative;
  }

  .gantt-days-input {
    width: 2.25rem;
    padding: 0.125rem 0.25rem;
    font-size: 0.6875rem;
    text-align: center;
    border-radius: 0.375rem;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
  }

  .gantt-days-input:focus {
    outline: none;
    border-color: var(--accent-color, var(--accent-color-value, #3b82f6));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #3b82f6) 25%, transparent);
  }

  .gantt-days-suffix {
    font-size: 0.625rem;
    color: var(--muted-foreground);
  }

  .gantt-row-subject {
    background: var(--card);
    font-weight: 600;
    cursor: default;
  }

  .gantt-row-subject:hover {
    background: var(--card);
  }

  .gantt-list-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .gantt-list-date {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gantt-expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--card);
    color: var(--muted-foreground);
    cursor: pointer;
  }

  .gantt-expand-btn:hover {
    color: var(--foreground);
    background: var(--surface-muted);
  }

  .gantt-expand-spacer {
    display: block;
    width: 1.25rem;
    height: 1.25rem;
  }

  .gantt-timeline-wrap {
    flex-shrink: 0;
    background: var(--card);
  }

  .gantt-timeline {
    position: relative;
    min-height: 100%;
  }

  .gantt-header {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    background: var(--surface-muted);
    border-bottom: 1px solid var(--border);
    height: 40px;
    min-height: 40px;
  }

  .gantt-header-cell {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    border-right: 1px solid var(--border-subtle);
    padding: 0.25rem;
  }

  .gantt-header-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--muted-foreground);
  }

  .gantt-header-sublabel {
    font-size: 0.625rem;
    color: var(--muted-foreground);
    opacity: 0.85;
  }

  .gantt-rows {
    position: relative;
  }

  .gantt-row {
    position: relative;
    border-bottom: 1px solid var(--border-subtle);
  }

  .gantt-today {
    position: absolute;
    top: 0;
    width: 2px;
    background: var(--accent-color, var(--accent-color-value, #3b82f6));
    opacity: 0.55;
    pointer-events: none;
    z-index: 1;
  }

  .gantt-bar-wrap {
    position: absolute;
    top: 6px;
    height: 24px;
    z-index: 2;
  }

  .gantt-bar {
    position: absolute;
    inset: 0;
    border: none;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .gantt-bar-resize {
    position: absolute;
    left: -3px;
    top: 0;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    border-radius: 4px 0 0 4px;
    background: transparent;
    z-index: 3;
  }

  .gantt-bar-resize:hover,
  .gantt-bar-wrap:has(.gantt-bar-resize:active) .gantt-bar-resize {
    background: rgba(255, 255, 255, 0.35);
  }

  .gantt-bar-summary {
    top: 10px;
    height: 14px;
    opacity: 0.55;
    cursor: default;
  }

  .gantt-bar-progress {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: rgba(0, 0, 0, 0.22);
    border-radius: 6px 0 0 6px;
    pointer-events: none;
  }

  .gantt-bar-label {
    position: relative;
    z-index: 1;
    display: block;
    padding: 0 0.625rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: #fff;
    line-height: 24px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }
</style>
