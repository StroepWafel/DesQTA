<script lang="ts">
  type ViewType = 'list' | 'board' | 'calendar';

  interface Props {
    selectedTab: ViewType;
    onTabChange: (tab: ViewType) => void;
  }

  let { selectedTab, onTabChange }: Props = $props();
</script>

<div class="flex gap-2">
  <button
    class="px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base {selectedTab === 'list'
      ? 'accent-bg text-white shadow-lg accent-shadow'
      : 'bg-slate-200/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-700/50'}"
    onclick={() => onTabChange('list')}>
    List View
  </button>
  <button
    class="px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base {selectedTab === 'board'
      ? 'accent-bg text-white shadow-lg accent-shadow'
      : 'bg-slate-200/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-700/50'}"
    onclick={() => onTabChange('board')}>
    Board View
  </button>
  <button
    class="px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base {selectedTab === 'calendar'
      ? 'accent-bg text-white shadow-lg accent-shadow'
      : 'bg-slate-200/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-700/50'}"
    onclick={() => onTabChange('calendar')}>
    Calendar View
  </button>
</div> 