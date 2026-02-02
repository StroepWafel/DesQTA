<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Icon, AcademicCap, Clock, Play, Stop } from 'svelte-hero-icons';
  import { Button } from '../ui';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../../utils/logger';

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

  let sessions = $state<StudySession[]>([]);
  let loading = $state(true);
  let currentSession = $state<StudySession | null>(null);
  let timePeriod = $derived(settings.timePeriod || 'week');
  let goalHours = $derived(settings.goalHours || 20);

  async function loadSessions() {
    loading = true;
    try {
      // Load from IndexedDB via Tauri command
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
      logger.error('StudyTimeTrackerWidget', 'loadSessions', `Failed to load sessions: ${e}`, {
        error: e,
      });
      sessions = [];
    } finally {
      loading = false;
    }
  }

  async function saveSessions() {
    try {
      await invoke('db_cache_set', { key: 'study_sessions', value: sessions, ttlMinutes: null });
    } catch (e) {
      logger.error('StudyTimeTrackerWidget', 'saveSessions', `Failed to save sessions: ${e}`, {
        error: e,
      });
    }
  }

  function startSession(subject: string) {
    if (currentSession) {
      stopSession();
    }

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

  function getTotalTime(): number {
    const now = new Date();
    const cutoffDate = new Date();

    switch (timePeriod) {
      case 'day':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      default:
        cutoffDate.setDate(now.getDate() - 7);
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
      case 'day':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      default:
        cutoffDate.setDate(now.getDate() - 7);
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

  // Calculate elapsed time for current session
  const currentSessionElapsed = $derived(
    currentSession
      ? Math.floor((new Date().getTime() - currentSession.startTime.getTime()) / (1000 * 60))
      : 0,
  );

  onMount(() => {
    loadSessions();
  });
</script>

<div class="flex flex-col h-full min-h-0">
  <div
    class="flex items-center gap-2 mb-3 sm:mb-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: left center;">
    <div
      class="transition-all duration-300"
      in:scale={{ duration: 300, delay: 100, easing: cubicInOut, start: 0.8 }}>
      <Icon
        src={AcademicCap}
        class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    </div>
    <h3
      class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300"
      in:fade={{ duration: 300, delay: 150 }}>
      Study Time Tracker
    </h3>
  </div>

  {#if loading}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading...
      </p>
    </div>
  {:else}
    <!-- Current Session -->
    {#if currentSession}
      <div
        class="mb-3 sm:mb-4 p-3 sm:p-4 rounded-xl bg-accent-100/90 dark:bg-accent-900/30 backdrop-blur-sm border border-accent-200 dark:border-accent-800 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-md transform hover:scale-[1.01]"
        in:fade={{ duration: 300, delay: 100 }}
        style="transform-origin: center center;">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-zinc-900 dark:text-white">
            Currently studying: {currentSession.subject}
          </span>
          <Button onclick={stopSession} size="sm" variant="ghost" class="gap-2">
            <Icon src={Stop} class="w-4 h-4" />
            Stop
          </Button>
        </div>
        <div class="text-2xl font-bold text-accent-600 dark:text-accent-400">
          {Math.floor(currentSessionElapsed / 60)}h {currentSessionElapsed % 60}m
        </div>
      </div>
    {/if}

    <!-- Progress -->
    <div
      class="mb-3 sm:mb-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 300, delay: 150 }}
      style="transform-origin: center center;">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
          {totalHours}h {totalMinutesRemainder}m / {goalHours}h goal
        </span>
        <span class="text-xs text-zinc-600 dark:text-zinc-400">{progress.toFixed(0)}%</span>
      </div>
      <div
        class="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
        <div
          class="h-full bg-accent-600 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-sm"
          style="width: {progress}%">
        </div>
      </div>
    </div>

    <!-- Time by Subject -->
    {#if Object.keys(timeBySubject).length > 0}
      <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
        {#each Object.entries(timeBySubject) as [subject, minutes], i}
          {@const hours = Math.floor(minutes / 60)}
          {@const mins = minutes % 60}
          {@const subjectProgress = (minutes / (goalHours * 60)) * 100}
          <div
            class="p-2 sm:p-3 rounded-lg bg-zinc-100/90 dark:bg-zinc-800/50 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-md hover:scale-[1.01] transform"
            in:fade={{ duration: 300, delay: 200 + i * 50 }}
            style="transform-origin: center center;">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-zinc-900 dark:text-white">{subject}</span>
              <span class="text-xs text-zinc-600 dark:text-zinc-400">{hours}h {mins}m</span>
            </div>
            <div
              class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner">
              <div
                class="h-full bg-accent-500 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-sm"
                style="width: {Math.min(subjectProgress, 100)}%">
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center flex-1 py-8">
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">No study sessions yet</p>
        <Button onclick={() => startSession('General')} class="gap-2">
          <Icon src={Play} class="w-4 h-4" />
          Start Session
        </Button>
      </div>
    {/if}
  {/if}
</div>
