<script lang="ts">
  interface Tab {
    id: string;
    label: string;
    icon: string;
  }

  interface Props {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
  }

  let { tabs, activeTab, onTabChange }: Props = $props();
</script>

<div class="container px-6 pt-6 mx-auto">
  <div class="flex gap-2 border-b dark:border-slate-800 border-slate-200">
    {#each tabs as tabItem}
      <button
        class="flex gap-2 items-center px-4 py-2 text-xs font-semibold tracking-wide uppercase border-b-2 transition-all duration-200 focus:outline-none hover:scale-105"
        onclick={() => onTabChange(tabItem.id)}
        class:border-accent-ring={activeTab === tabItem.id}
        class:text-accent-bg={activeTab === tabItem.id}
        class:text-slate-400={activeTab !== tabItem.id}
        class:border-transparent={activeTab !== tabItem.id}>
        <span class="text-sm">{tabItem.icon}</span>
        <span>{tabItem.label}</span>
      </button>
    {/each}
  </div>
</div> 