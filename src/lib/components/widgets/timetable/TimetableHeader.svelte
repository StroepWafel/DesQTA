<script lang="ts">
  import { Button } from '../../ui';
  import { Icon, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, ViewColumns, Calendar, ListBullet } from 'svelte-hero-icons';
  import TimetableExport from './TimetableExport.svelte';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { _ } from '$lib/i18n';
  import { getMonday, formatDate } from '$lib/utils/timetableUtils';
  import { platformStore } from '$lib/stores/platform';

  let isMobile = $derived($platformStore.isMobile);

  interface Props {
    weekStart: Date;
    loadingLessons: boolean;
    viewMode: 'week' | 'day' | 'month' | 'list';
    /** When true, no border/background (for page-level inline use) */
    inline?: boolean;
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onToday: () => void;
    onViewModeChange: (mode: 'week' | 'day' | 'month' | 'list') => void;
    onExportCsv: () => void;
    onExportPdf: () => void;
    onExportIcal: () => void;
  }

  let {
    weekStart,
    loadingLessons,
    viewMode,
    inline = false,
    onPrevWeek,
    onNextWeek,
    onToday,
    onViewModeChange,
    onExportCsv,
    onExportPdf,
    onExportIcal,
  }: Props = $props();

  let showExportMenu = $state(false);
  let showViewDropdown = $state(false);

  const viewModeOptions = [
    { value: 'week' as const, label: $_('timetable.week') || 'Week', icon: ViewColumns },
    { value: 'day' as const, label: $_('timetable.day') || 'Day', icon: CalendarDays },
    { value: 'month' as const, label: $_('timetable.month') || 'Month', icon: Calendar },
    { value: 'list' as const, label: $_('timetable.list') || 'List', icon: ListBullet },
  ];

  const currentViewOption = $derived(viewModeOptions.find((o) => o.value === viewMode) ?? viewModeOptions[0]);

  function weekRangeLabel(): string {
    const end = new Date(weekStart.valueOf() + 4 * 86400000);
    const startMonth = weekStart.toLocaleString('default', { month: 'short' });
    const endMonth = end.toLocaleString('default', { month: 'short' });
    const year = weekStart.getFullYear();
    
    if (startMonth === endMonth) {
      return `${weekStart.getDate()} - ${end.getDate()} ${startMonth} ${year}`;
    } else {
      return `${weekStart.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${year}`;
    }
  }

  function handleHeaderClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.export-dropdown-container')) showExportMenu = false;
    if (!target.closest('.view-dropdown-container')) showViewDropdown = false;
  }

  onMount(() => {
    document.addEventListener('click', handleHeaderClickOutside);
    return () => {
      document.removeEventListener('click', handleHeaderClickOutside);
    };
  });
</script>

<div class="relative z-[100] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between {inline ? 'px-0 py-0' : 'px-4 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30'}">
  <!-- Left: Week Navigation (hidden on mobile when in day view) -->
  {#if !(isMobile && viewMode === 'day')}
    <div class="flex gap-2 items-center">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        onclick={onPrevWeek}
        disabled={loadingLessons}
        ariaLabel={$_('timetable.previous_week') || 'Previous week'}
        class="min-h-[44px] min-w-[44px] w-10 h-10 rounded-lg bg-white/80 hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-700 border border-zinc-200/50 dark:border-zinc-700/50 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring" />
      <div class="text-center min-w-[180px]">
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">{weekRangeLabel()}</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
          {$_('timetable.weekly_schedule') || 'Weekly Schedule'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronRight}
        onclick={onNextWeek}
        disabled={loadingLessons}
        ariaLabel={$_('timetable.next_week') || 'Next week'}
        class="min-h-[44px] min-w-[44px] w-10 h-10 rounded-lg bg-white/80 hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-700 border border-zinc-200/50 dark:border-zinc-700/50 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring" />
      <Button
        variant="ghost"
        size="sm"
        onclick={onToday}
        disabled={loadingLessons}
        class="min-h-[44px] px-4 py-2 rounded-lg bg-white/80 hover:bg-white dark:bg-zinc-800/80 dark:hover:bg-zinc-700 border border-zinc-200/50 dark:border-zinc-700/50 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring">
        {$_('timetable.today') || 'Today'}
      </Button>
    </div>
  {:else}
    <div class="flex-1"></div>
  {/if}

  <!-- Right: View dropdown + Export -->
  <div class="flex flex-wrap items-center gap-2" data-onboarding="timetable-views">
    <div class="relative inline-block view-dropdown-container">
      <button
        type="button"
        data-onboarding-view={viewMode}
        class="group flex gap-2 items-center min-h-[44px] px-4 py-2 rounded-lg border transition-all duration-200 bg-white/80 dark:bg-zinc-800/80 border-zinc-200/50 dark:border-zinc-700/50 text-zinc-900 dark:text-white hover:bg-white/90 dark:hover:bg-zinc-800/90 focus:outline-hidden focus:ring-2 accent-ring"
        onclick={() => (showViewDropdown = !showViewDropdown)}
        aria-label={$_('timetable.view') || 'View'}
        aria-expanded={showViewDropdown}
        aria-haspopup="listbox">
        <Icon src={currentViewOption.icon} class="w-4 h-4 shrink-0 text-zinc-600 dark:text-zinc-400" />
        <span class="font-medium text-sm">{currentViewOption.label}</span>
        <Icon src={ChevronDown} class="w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 {showViewDropdown ? 'rotate-180' : ''}" />
      </button>
      {#if showViewDropdown}
        <div
          class="absolute right-0 z-50 mt-2 w-40 rounded-lg border shadow-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 py-1"
          transition:fly={{ y: -6, duration: 150, easing: cubicInOut }}
          role="listbox">
          {#each viewModeOptions as option}
            <button
              type="button"
              role="option"
              data-onboarding-view={option.value}
              aria-selected={viewMode === option.value}
              class="flex gap-2 items-center w-full px-3 py-2.5 text-left text-sm transition-colors {viewMode === option.value
                ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
              onclick={() => {
                onViewModeChange(option.value);
                showViewDropdown = false;
              }}>
              <Icon src={option.icon} class="w-4 h-4 shrink-0" />
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <TimetableExport
      bind:showExportMenu={showExportMenu}
      onExportCsv={onExportCsv}
      onExportPdf={onExportPdf}
      onExportIcal={onExportIcal} />
  </div>
</div>
