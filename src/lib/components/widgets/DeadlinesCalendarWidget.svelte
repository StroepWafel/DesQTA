<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { cache } from '../../../utils/cache';
  import { Icon, Calendar, ChevronLeft, ChevronRight, ListBullet } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { logger } from '../../../utils/logger';
  import WidgetCard from '../dashboard/WidgetCard.svelte';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  interface Assessment {
    id: number;
    title: string;
    subject: string;
    code: string;
    due: string;
    colour: string;
    status?: string;
  }

  const studentId = 69;
  let assessments = $state<Assessment[]>([]);
  let loading = $state(true);
  let currentDate = $state(new Date());
  let view = $state<'list' | 'calendar'>('list');
  let daysToShow = $derived(parseInt(settings.daysToShow || '14'));
  let showCompleted = $derived(settings.showCompleted || false);

  // Sync initial view from settings (only once, then user can toggle)
  let viewSyncedFromSettings = $state(false);
  $effect(() => {
    if (!viewSyncedFromSettings && settings.view) {
      view = settings.view === 'calendar' ? 'calendar' : 'list';
      viewSyncedFromSettings = true;
    }
  });

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function getDaysArray(): Array<{ date: Date; assessments: Assessment[] }> {
    const days: Array<{ date: Date; assessments: Assessment[] }> = [];
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);

    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), -i),
        assessments: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayAssessments = assessments.filter((a) => {
        const dueDate = new Date(a.due);
        return (
          dueDate.getDate() === date.getDate() &&
          dueDate.getMonth() === date.getMonth() &&
          dueDate.getFullYear() === date.getFullYear()
        );
      });
      days.push({ date, assessments: dayAssessments });
    }

    return days;
  }

  async function loadAssessments() {
    loading = true;
    try {
      const cachedData = cache.get<{ assessments: any[] }>('upcoming_assessments_data');
      if (cachedData) {
        assessments = cachedData.assessments
          .filter((a: any) => {
            if (!showCompleted && a.status === 'MARKS_RELEASED') return false;
            return true;
          })
          .map((a: any) => ({
            id: a.id ?? a.assessmentID,
            title: a.title,
            subject: a.subject,
            code: a.code,
            due: a.due,
            colour: a.colour || '#8e8e8e',
            status: a.status,
          }))
          .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));
        loading = false;
        return;
      }

      const assessmentsRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId },
      });

      const allAssessments = JSON.parse(assessmentsRes).payload || [];

      assessments = allAssessments
        .filter((a: any) => {
          if (!showCompleted && a.status === 'MARKS_RELEASED') return false;
          return true;
        })
        .map((a: any) => ({
          id: a.id ?? a.assessmentID,
          title: a.title,
          subject: a.subject,
          code: a.code,
          due: a.due,
          colour: a.colour || '#8e8e8e',
          status: a.status,
        }))
        .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));
    } catch (e) {
      logger.error(
        'DeadlinesCalendarWidget',
        'loadAssessments',
        `Failed to load assessments: ${e}`,
        { error: e },
      );
      assessments = [];
    } finally {
      loading = false;
    }
  }

  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  function goToToday() {
    currentDate = new Date();
  }

  function handleAssessmentClick(assessment: Assessment) {
    const dueDate = new Date(assessment.due);
    const year = dueDate.getFullYear();
    const dateStr = dueDate.toISOString().split('T')[0];
    goto(`/assessments?code=${assessment.code}&date=${dateStr}&year=${year}`);
  }

  // List view: items in next `daysToShow` days
  const listItems = $derived.by(() => {
    const now = new Date();
    return assessments.filter((a) => {
      const dueDate = new Date(a.due);
      const diff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= -1 && diff <= daysToShow;
    });
  });

  function formatDue(due: string): string {
    const d = new Date(due);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function daysFromNow(due: string): string {
    const d = new Date(due);
    const now = new Date();
    const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `in ${diff} days`;
  }

  const days = $derived(getDaysArray());
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  onMount(() => {
    loadAssessments();
  });
</script>

<WidgetCard
  icon={Calendar}
  title="Deadlines"
  {loading}
  empty={!loading && view === 'list' && listItems.length === 0}
  emptyTitle="Nothing coming up"
  emptyMessage="Enjoy the calm."
  emptyIcon={Calendar}>
  {#snippet headerAction()}
    <div class="flex items-center gap-1">
      <button
        type="button"
        onclick={() => (view = 'list')}
        aria-pressed={view === 'list'}
        class="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 {view === 'list' ? 'text-foreground bg-surface-muted' : ''}"
        aria-label="List view"
        title="List view">
        <Icon src={ListBullet} class="w-4 h-4" />
      </button>
      <button
        type="button"
        onclick={() => (view = 'calendar')}
        aria-pressed={view === 'calendar'}
        class="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 {view === 'calendar' ? 'text-foreground bg-surface-muted' : ''}"
        aria-label="Calendar view"
        title="Calendar view">
        <Icon src={Calendar} class="w-4 h-4" />
      </button>
    </div>
  {/snippet}

  {#if view === 'list'}
    <div class="h-full overflow-y-auto -mx-1 px-1 space-y-1.5">
      {#each listItems as a}
        <button
          onclick={() => handleAssessmentClick(a)}
          class="w-full text-left p-3 rounded-lg border border-border-subtle hover:border-border-strong hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
          title={a.title}>
          <div class="flex items-start gap-3">
            <span
              class="w-1 self-stretch rounded-full shrink-0"
              style="background-color: {a.colour}"
              aria-hidden="true"></span>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-2 mb-0.5">
                <p class="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground truncate">
                  {a.subject}
                </p>
                <p class="text-[11px] text-muted-foreground shrink-0 nums-tabular">
                  {daysFromNow(a.due)}
                </p>
              </div>
              <p class="text-sm font-medium text-foreground line-clamp-2">{a.title}</p>
              <p class="text-[11px] text-muted-foreground mt-0.5 nums-tabular">
                {formatDue(a.due)}
              </p>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="h-full flex flex-col">
      <div class="flex items-center justify-between mb-2 shrink-0">
        <h4 class="text-sm font-semibold tracking-tight text-foreground">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h4>
        <div class="flex items-center gap-1">
          <button
            onclick={prevMonth}
            class="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
            aria-label="Previous month">
            <Icon src={ChevronLeft} class="w-3.5 h-3.5" />
          </button>
          <button
            onclick={goToToday}
            class="h-7 px-2 text-[11px] font-medium uppercase tracking-[0.06em] rounded-md text-foreground hover:bg-surface-muted transition-colors duration-150">
            Today
          </button>
          <button
            onclick={nextMonth}
            class="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
            aria-label="Next month">
            <Icon src={ChevronRight} class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="grid grid-cols-7 gap-1 text-xs">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="p-1 text-center font-semibold uppercase tracking-[0.06em] text-[10px] text-muted-foreground">
              {day}
            </div>
          {/each}

          {#each days as { date, assessments: dayAssessments }}
            <div
              class="min-h-[44px] p-1 rounded-md border border-border-subtle text-left {isToday(date)
                ? 'bg-accent-500/10 border-accent-500/40'
                : 'bg-card'}">
              <div class="text-[10px] font-semibold nums-tabular {isToday(date) ? 'text-accent-600' : 'text-muted-foreground'}">
                {date.getDate()}
              </div>
              <div class="space-y-0.5 mt-0.5">
                {#each dayAssessments.slice(0, 2) as assessment}
                  <button
                    onclick={() => handleAssessmentClick(assessment)}
                    class="w-full px-1 py-0.5 text-[10px] rounded text-white truncate text-left"
                    style="background-color: {assessment.colour}"
                    title={assessment.title}>
                    {assessment.title}
                  </button>
                {/each}
                {#if dayAssessments.length > 2}
                  <div class="text-[10px] text-muted-foreground">
                    +{dayAssessments.length - 2}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</WidgetCard>
