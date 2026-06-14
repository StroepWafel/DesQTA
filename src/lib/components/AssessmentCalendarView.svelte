<script lang="ts">
  import { goto } from '$app/navigation';
  import { ariaTooltip } from '$lib/actions/tooltip';

  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    colour: string;
    metaclass: number;
  }

  interface Props {
    assessments: Assessment[];
    selectedYear: number;
  }

  let { assessments, selectedYear }: Props = $props();

  let currentDate = $state(new Date());
  let currentMonth = $derived(currentDate.getMonth());

  const canGoPrev = $derived(currentMonth > 0);
  const canGoNext = $derived(currentMonth < 11);

  $effect(() => {
    if (currentDate.getFullYear() !== selectedYear) {
      const month = Math.min(currentDate.getMonth(), 11);
      currentDate = new Date(selectedYear, month, 1);
    }
  });

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function getLocalDateKey(date: Date): string {
    // Use local date parts (matches how existing code compares getDate/getMonth/getFullYear)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Avoid re-filtering `assessments` for every day cell (calendar can render ~42 cells).
  const assessmentsByDateKey = $derived.by(() => {
    const grouped = new Map<string, Assessment[]>();
    for (const assessment of assessments) {
      const assessmentDate = new Date(assessment.due);
      const key = getLocalDateKey(assessmentDate);
      const list = grouped.get(key) ?? [];
      list.push(assessment);
      grouped.set(key, list);
    }
    return grouped;
  });

  function prevMonth() {
    if (!canGoPrev) return;
    currentDate = new Date(selectedYear, currentMonth - 1, 1);
  }

  function nextMonth() {
    if (!canGoNext) return;
    currentDate = new Date(selectedYear, currentMonth + 1, 1);
  }

  // Utility: Convert hex color to RGB
  function hexToRgb(hex: string) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((x) => x + x)
        .join('');
    }
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  // Utility: Check if color is light
  function isColorLight(hex: string) {
    const [r, g, b] = hexToRgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  function handleDateClick(date: Date) {
    const year = date.getFullYear();
    const dateStr = date.toISOString().split('T')[0];
    goto(`/assessments?year=${year}&date=${dateStr}`);
  }
</script>

<div
  class="p-4 rounded-xl border bg-zinc-100/80 dark:bg-zinc-800/50 sm:p-6 border-zinc-300/50 dark:border-zinc-700/50">
  <div class="flex justify-between items-center mb-6">
    <button
      type="button"
      class="p-2 rounded-lg transition-all duration-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/50 text-foreground hover:text-zinc-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
      onclick={prevMonth}
      disabled={!canGoPrev}
      aria-label="Previous month"
      use:ariaTooltip>
      ←
    </button>
    <h2 class="text-lg font-bold sm:text-xl text-foreground">
      {getMonthName(currentDate)}
    </h2>
    <button
      type="button"
      class="p-2 rounded-lg transition-all duration-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/50 text-foreground hover:text-zinc-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
      onclick={nextMonth}
      disabled={!canGoNext}
      aria-label="Next month"
      use:ariaTooltip>
      →
    </button>
  </div>

  <div class="grid grid-cols-7 gap-2">
    {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
      <div
        class="py-2 text-xs font-semibold text-center sm:text-sm text-muted-foreground">
        {day}
      </div>
    {/each}

    {#each Array(getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth())) as _, i}
      <div class="aspect-square"></div>
    {/each}

    {#each Array(getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())) as _, i}
      {@const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)}
      {@const assessments = assessmentsByDateKey.get(getLocalDateKey(date)) || []}
      {@const isToday = date.toDateString() === new Date().toDateString()}
      <div class="p-1 aspect-square">
        <div
          role="button"
          tabindex="0"
          onclick={() => handleDateClick(date)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDateClick(date);
            }
          }}
          class="h-full rounded-lg border p-2 transition-all duration-300 hover:scale-105 cursor-pointer {assessments.length >
          0
            ? ''
            : 'bg-zinc-200/60 dark:bg-zinc-800/30'} {isToday
            ? 'border-indigo-500 ring-4 ring-indigo-500/30 animate-pulse-today'
            : 'border-zinc-300/50 dark:border-zinc-700/50'}"
          style={assessments.length > 0 && assessments[0].colour
            ? `background: ${assessments[0].colour}20;`
            : ''}>
          <div
            class="text-sm sm:text-base mb-1 {isToday
              ? 'font-bold text-indigo-400 scale-110'
              : 'text-foreground'}">
            {i + 1}
          </div>
          {#if assessments.length > 0}
            <div class="space-y-1">
              {#each assessments.slice(0, 2) as assessment}
                {@const textColor = isColorLight(assessment.colour || '#8e8e8e')
                  ? '#232428'
                  : '#fff'}
                <div class="flex gap-1 items-center">
                  <div
                    class="flex-1 p-1 text-xs truncate rounded-sm"
                    style={`background: rgba(0,0,0,0.2); color: ${textColor};`}>
                    {assessment.title}
                  </div>
                </div>
              {/each}
              {#if assessments.length > 2}
                <div class="text-xs text-center text-muted-foreground">
                  +{assessments.length - 2} more
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  @keyframes pulse-today {
    0% {
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(99, 102, 241, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
  }

  .animate-pulse-today {
    animation: pulse-today 2s infinite;
  }
</style> 