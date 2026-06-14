<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Icon, AcademicCap, Play, Stop, ArrowPath } from 'svelte-hero-icons';
  import { Button } from '../ui';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../../utils/logger';
  import WidgetCard from '../dashboard/WidgetCard.svelte';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  interface StudySession {
    id: string;
    subject: string;
    startTime: Date;
    endTime: Date | null;
    duration: number; // minutes
  }

  let mode = $state<'focus' | 'sessions'>('focus');
  let sessions = $state<StudySession[]>([]);
  let loading = $state(true);
  let currentSession = $state<StudySession | null>(null);

  // Focus timer (pomodoro)
  const DEFAULT_FOCUS_MINUTES = 25;
  let focusMinutes = $state(DEFAULT_FOCUS_MINUTES);
  let focusSecondsRemaining = $state(DEFAULT_FOCUS_MINUTES * 60);
  let focusRunning = $state(false);
  let focusInterval: ReturnType<typeof setInterval> | null = null;

  let timePeriod = $derived(settings.timePeriod || 'week');
  let goalHours = $derived(settings.goalHours || 20);

  async function loadSessions() {
    loading = true;
    try {
      const stored = await invoke<any>('db_cache_get', { key: 'study_sessions' });
      if (stored && Array.isArray(stored)) {
        sessions = stored.map((s: any) => ({
          ...s,
          startTime: new Date(s.startTime),
          endTime: s.endTime ? new Date(s.endTime) : null,
        }));
      } else {
        sessions = [];
      }
    } catch (e) {
      logger.error('StudyTimer', 'loadSessions', `Failed to load sessions: ${e}`, { error: e });
      sessions = [];
    } finally {
      loading = false;
    }
  }

  async function saveSessions() {
    try {
      await invoke('db_cache_set', { key: 'study_sessions', value: sessions, ttlMinutes: null });
    } catch (e) {
      logger.error('StudyTimer', 'saveSessions', `Failed to save sessions: ${e}`, { error: e });
    }
  }

  function startSession(subject: string) {
    if (currentSession) stopSession();
    const session: StudySession = {
      id: `session_${Date.now()}`,
      subject,
      startTime: new Date(),
      endTime: null,
      duration: 0,
    };
    currentSession = session;
    sessions = [...sessions, session];
    saveSessions();
  }

  function stopSession() {
    if (!currentSession) return;
    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - currentSession.startTime.getTime()) / (1000 * 60),
    );
    currentSession.endTime = endTime;
    currentSession.duration = duration;
    sessions = sessions.map((s) => (s.id === currentSession!.id ? { ...currentSession! } : s));
    saveSessions();
    currentSession = null;
  }

  // Focus timer logic
  function startFocus() {
    if (focusRunning) return;
    focusRunning = true;
    focusInterval = setInterval(() => {
      if (focusSecondsRemaining > 0) {
        focusSecondsRemaining -= 1;
      } else {
        stopFocus();
      }
    }, 1000);
  }

  function stopFocus() {
    if (focusInterval) {
      clearInterval(focusInterval);
      focusInterval = null;
    }
    focusRunning = false;
  }

  function resetFocus() {
    stopFocus();
    focusSecondsRemaining = focusMinutes * 60;
  }

  function setFocusMinutes(m: number) {
    if (focusRunning) return;
    focusMinutes = Math.max(1, Math.min(120, m));
    focusSecondsRemaining = focusMinutes * 60;
  }

  function fmtTime(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function getTotalTime(): number {
    const now = new Date();
    const cutoffDate = new Date();
    switch (timePeriod) {
      case 'day': cutoffDate.setDate(now.getDate() - 1); break;
      case 'month': cutoffDate.setMonth(now.getMonth() - 1); break;
      case 'week':
      default: cutoffDate.setDate(now.getDate() - 7); break;
    }
    return sessions
      .filter((s) => s.startTime >= cutoffDate)
      .reduce((total, s) => {
        const duration = s.endTime
          ? s.duration
          : Math.floor((now.getTime() - s.startTime.getTime()) / (1000 * 60));
        return total + duration;
      }, 0);
  }

  function getTimeBySubject(): Record<string, number> {
    const now = new Date();
    const cutoffDate = new Date();
    switch (timePeriod) {
      case 'day': cutoffDate.setDate(now.getDate() - 1); break;
      case 'month': cutoffDate.setMonth(now.getMonth() - 1); break;
      case 'week':
      default: cutoffDate.setDate(now.getDate() - 7); break;
    }
    const bySubject: Record<string, number> = {};
    sessions
      .filter((s) => s.startTime >= cutoffDate)
      .forEach((s) => {
        const duration = s.endTime
          ? s.duration
          : Math.floor((now.getTime() - s.startTime.getTime()) / (1000 * 60));
        bySubject[s.subject] = (bySubject[s.subject] || 0) + duration;
      });
    return bySubject;
  }

  const totalMinutes = $derived(getTotalTime());
  const totalHours = $derived(Math.floor(totalMinutes / 60));
  const totalMinutesRemainder = $derived(totalMinutes % 60);
  const progress = $derived(Math.min((totalHours / goalHours) * 100, 100));
  const timeBySubject = $derived(getTimeBySubject());

  onMount(() => {
    loadSessions();
  });

  onDestroy(() => {
    if (focusInterval) clearInterval(focusInterval);
  });
</script>

<WidgetCard icon={AcademicCap} title="Study Timer" {loading}>
  {#snippet headerAction()}
    <div class="flex items-center gap-1 text-[11px] uppercase tracking-[0.06em] font-semibold">
      <button
        type="button"
        onclick={() => (mode = 'focus')}
        class="px-2 h-7 rounded-md transition-colors duration-150 {mode === 'focus' ? 'bg-surface-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'}">
        Focus
      </button>
      <button
        type="button"
        onclick={() => (mode = 'sessions')}
        class="px-2 h-7 rounded-md transition-colors duration-150 {mode === 'sessions' ? 'bg-surface-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'}">
        Log
      </button>
    </div>
  {/snippet}

  {#if mode === 'focus'}
    <div class="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div class="text-5xl font-semibold tracking-tight tabular-nums text-foreground nums-tabular">
        {fmtTime(focusSecondsRemaining)}
      </div>
      <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
        {#each [15, 25, 45, 60] as preset}
          <button
            type="button"
            onclick={() => setFocusMinutes(preset)}
            disabled={focusRunning}
            class="h-7 px-2.5 rounded-md transition-colors duration-150 {focusMinutes === preset ? 'bg-accent-500/12 text-accent-600' : 'hover:bg-surface-muted text-muted-foreground hover:text-foreground'} disabled:opacity-50">
            {preset}m
          </button>
        {/each}
      </div>
      <div class="flex items-center gap-2">
        {#if focusRunning}
          <button
            onclick={stopFocus}
            class="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-surface-muted text-foreground hover:bg-surface-3 transition-colors duration-150 font-medium">
            <Icon src={Stop} class="w-4 h-4" /> Pause
          </button>
        {:else}
          <button
            onclick={startFocus}
            class="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-white hover:bg-accent-600 transition-colors duration-150 font-medium">
            <Icon src={Play} class="w-4 h-4" /> Start
          </button>
        {/if}
        <button
          onclick={resetFocus}
          class="inline-flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
          aria-label="Reset timer">
          <Icon src={ArrowPath} class="w-4 h-4" />
        </button>
      </div>
    </div>
  {:else}
    <div class="flex flex-col h-full">
      {#if currentSession}
        <div class="mb-3 p-3 rounded-lg border border-border-subtle bg-accent-500/8">
          <div class="flex items-center justify-between mb-1.5 gap-2">
            <span class="text-xs uppercase tracking-[0.06em] font-semibold text-muted-foreground truncate">
              Currently studying: {currentSession.subject}
            </span>
            <Button onclick={stopSession} size="sm" variant="secondary">
              <Icon src={Stop} class="w-3.5 h-3.5 mr-1.5" /> Stop
            </Button>
          </div>
          <div class="text-2xl font-semibold tabular-nums text-foreground nums-tabular">
            {(() => {
              const elapsed = Math.floor((new Date().getTime() - currentSession.startTime.getTime()) / (1000 * 60));
              return `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
            })()}
          </div>
        </div>
      {/if}

      <div class="mb-3 shrink-0">
        <div class="flex items-center justify-between mb-1.5 text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
          <span class="nums-tabular">{totalHours}h {totalMinutesRemainder}m / {goalHours}h goal</span>
          <span class="nums-tabular">{progress.toFixed(0)}%</span>
        </div>
        <div class="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden border border-border-subtle">
          <div class="h-full bg-accent-500 rounded-full" style="width: {progress}%"></div>
        </div>
      </div>

      {#if Object.keys(timeBySubject).length > 0}
        <div class="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {#each Object.entries(timeBySubject) as [subject, minutes]}
            {@const hours = Math.floor(minutes / 60)}
            {@const mins = minutes % 60}
            {@const subjectProgress = (minutes / (goalHours * 60)) * 100}
            <div class="p-2.5 rounded-lg border border-border-subtle bg-card">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm font-medium text-foreground truncate">{subject}</span>
                <span class="text-[11px] text-muted-foreground nums-tabular shrink-0">{hours}h {mins}m</span>
              </div>
              <div class="w-full h-1 bg-surface-muted rounded-full overflow-hidden">
                <div class="h-full bg-accent-500 rounded-full" style="width: {Math.min(subjectProgress, 100)}%"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <p class="text-sm text-muted-foreground">No study sessions yet</p>
          <Button onclick={() => startSession('General')} size="sm">
            <Icon src={Play} class="w-3.5 h-3.5 mr-1.5" /> Start a session
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</WidgetCard>
