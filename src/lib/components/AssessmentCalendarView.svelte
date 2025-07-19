<script lang="ts">
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
  }

  let { assessments }: Props = $props();

  let currentDate = $state(new Date());
  let currentMonth = $derived(currentDate.getMonth());
  let currentYear = $derived(currentDate.getFullYear());

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function getAssessmentsForDate(date: Date) {
    return assessments.filter((a) => {
      const assessmentDate = new Date(a.due);
      return (
        assessmentDate.getDate() === date.getDate() &&
        assessmentDate.getMonth() === date.getMonth() &&
        assessmentDate.getFullYear() === date.getFullYear()
      );
    });
  }

  function prevMonth() {
    currentDate = new Date(currentYear, currentMonth - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentYear, currentMonth + 1, 1);
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
</script>

<div
  class="p-4 rounded-xl border backdrop-blur-sm bg-slate-100/80 dark:bg-slate-800/50 sm:p-6 border-slate-300/50 dark:border-slate-700/50">
  <div class="flex justify-between items-center mb-6">
    <button
      class="p-2 rounded-lg transition-all duration-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      onclick={prevMonth}>
      ←
    </button>
    <h2 class="text-lg font-bold sm:text-xl text-slate-900 dark:text-white">
      {getMonthName(currentDate)}
    </h2>
    <button
      class="p-2 rounded-lg transition-all duration-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      onclick={nextMonth}>
      →
    </button>
  </div>

  <div class="grid grid-cols-7 gap-2">
    {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
      <div
        class="py-2 text-xs font-semibold text-center sm:text-sm text-slate-600 dark:text-slate-400">
        {day}
      </div>
    {/each}

    {#each Array(getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth())) as _, i}
      <div class="aspect-square"></div>
    {/each}

    {#each Array(getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())) as _, i}
      {@const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)}
      {@const assessments = getAssessmentsForDate(date)}
      {@const isToday = date.toDateString() === new Date().toDateString()}
      <div class="p-1 aspect-square">
        <div
          class="h-full rounded-lg border p-2 transition-all duration-300 hover:scale-105 {assessments.length >
          0
            ? ''
            : 'bg-slate-200/60 dark:bg-slate-800/30'} {isToday
            ? 'border-indigo-500 ring-4 ring-indigo-500/30 animate-pulse-today'
            : 'border-slate-300/50 dark:border-slate-700/50'}"
          style={assessments.length > 0 && assessments[0].colour
            ? `background: ${assessments[0].colour}20;`
            : ''}>
          <div
            class="text-sm sm:text-base mb-1 {isToday
              ? 'font-bold text-indigo-400 scale-110'
              : 'text-slate-700 dark:text-slate-300'}">
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
                    class="flex-1 p-1 text-xs truncate rounded"
                    style={`background: rgba(0,0,0,0.2); color: ${textColor};`}>
                    {assessment.title}
                  </div>
                </div>
              {/each}
              {#if assessments.length > 2}
                <div class="text-xs text-center text-slate-600 dark:text-slate-400">
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