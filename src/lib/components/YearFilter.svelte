<script lang="ts">
  interface Props {
    availableYears: number[];
    selectedYear: number;
    onYearChange: (year: number) => void;
  }

  let { availableYears, selectedYear, onYearChange }: Props = $props();
</script>

{#if availableYears && availableYears.length > 0}
  <div class="flex flex-col gap-4 p-4 rounded-xl border backdrop-blur-xs bg-zinc-100/80 dark:bg-zinc-800/50 border-zinc-300/50 dark:border-zinc-700/50">
    <h3 class="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Filter by Year</h3>
    <div class="flex flex-wrap gap-2">
      {#each availableYears as year}
        <button
          class="px-3 py-2 rounded-lg transition-all duration-200 text-sm {selectedYear === year
            ? 'accent-bg text-white shadow-lg accent-shadow'
            : 'bg-zinc-200/80 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300/80 dark:hover:bg-zinc-700/50 hover:scale-105'}"
          onclick={() => onYearChange(year)}>
          {year}
        </button>
      {/each}
    </div>
  </div>
{/if} 