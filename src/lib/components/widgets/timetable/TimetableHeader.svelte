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

  const viewModeOptions = [
    { value: 'week' as const, label: $_('timetable.week') || 'Week', icon: ViewColumns },
    { value: 'day' as const, label: $_('timetable.day') || 'Day', icon: CalendarDays },
    { value: 'month' as const, label: $_('timetable.month') || 'Month', icon: Calendar },
    { value: 'list' as const, label: $_('timetable.list') || 'List', icon: ListBullet },
  ];

  const currentViewOption = $derived(viewModeOptions.find((o) => o.value === viewMode) ?? viewModeOptions[0]);
</script>

<div class="relative z-[100] flex justify-between items-center gap-4 px-4 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
  <!-- Week Navigation (hidden on mobile when in day view) -->
  {#if !(isMobile && viewMode === 'day')}
    <div class="flex gap-2 items-center">
      <Button
        variant="ghost"
        size="sm"
        icon={ChevronLeft}
        onclick={onPrevWeek}
        disabled={loadingLessons}
        ariaLabel={$_('timetable.previous_week') || 'Previous week'}
        class="min-h-[44px] min-w-[44px] w-10 h-10 rounded-xl bg-white/80 hover:bg-white dark:bg-zinc-700/80 dark:hover:bg-zinc-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" />
      <div class="text-center min-w-[200px]">
        <h1 class="text-xl font-bold text-zinc-900 dark:text-white">{weekRangeLabel()}</h1>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
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
        class="min-h-[44px] min-w-[44px] w-10 h-10 rounded-xl bg-white/80 hover:bg-white dark:bg-zinc-700/80 dark:hover:bg-zinc-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" />
      <Button
        variant="ghost"
        size="sm"
        onclick={onToday}
        disabled={loadingLessons}
        class="min-h-[44px] px-4 py-2 rounded-xl bg-white/80 hover:bg-white dark:bg-zinc-700/80 dark:hover:bg-zinc-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95">
        {$_('timetable.today') || 'Today'}
      </Button>
    </div>
  {:else}
    <div class="flex-1"></div>
  {/if}

  <!-- Right: View dropdown + Export -->
  <div class="flex gap-2 items-center ml-auto" data-onboarding="timetable-views">
    <div class="relative inline-block view-dropdown-container">
      <button
        type="button"
        data-onboarding-view={viewMode}
        class="group flex gap-2 items-center min-h-[44px] px-4 py-2 rounded-xl border transition-all duration-200 bg-white hover:accent-bg dark:bg-zinc-700 dark:hover:accent-bg border-zinc-200 dark:border-zinc-600 hover:border-transparent hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring shadow-sm"
        onclick={() => (showViewDropdown = !showViewDropdown)}
        aria-label={$_('timetable.view') || 'View'}
        aria-expanded={showViewDropdown}
        aria-haspopup="menu">
        <Icon src={currentViewOption.icon} class="w-4 h-4 text-zinc-700 dark:text-zinc-300 group-hover:text-white" />
        <span class="font-medium text-sm text-zinc-900 dark:text-white group-hover:text-white">
          {currentViewOption.label}
        </span>
        <Icon src={ChevronDown} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white transition-transform duration-200 {showViewDropdown ? 'rotate-180' : ''}" />
      </button>
      {#if showViewDropdown}
        <div
          class="absolute right-0 z-50 mt-2 w-40 rounded-xl border shadow-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 py-1"
          transition:fly={{ y: -6, duration: 150, easing: cubicInOut }}
          role="group">
          {#each viewModeOptions as option}
            <button
              type="button"
              role="button"
              data-onboarding-view={option.value}
              aria-pressed={viewMode === option.value}
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
