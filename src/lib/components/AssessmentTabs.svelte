<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { IconSource } from 'svelte-hero-icons';

  export interface Tab {
    id: string;
    label: string;
    icon: IconSource;
  }

  interface Props {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
  }

  let { tabs, activeTab, onTabChange }: Props = $props();
</script>

<div class="container px-6 pt-6 mx-auto">
  <div class="flex gap-2 border-b dark:border-zinc-800 border-zinc-200">
    {#each tabs as tabItem, index}
      <button
        class="flex gap-2 items-center px-4 py-2 text-xs font-semibold tracking-wide uppercase border-b-2 transition-all duration-200 ease-in-out focus:outline-none transform origin-center"
        style="animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {index * 50}ms both;"
        onclick={() => onTabChange(tabItem.id)}
        class:border-accent-ring={activeTab === tabItem.id}
        class:text-accent-bg={activeTab === tabItem.id}
        class:text-zinc-400={activeTab !== tabItem.id}
        class:border-transparent={activeTab !== tabItem.id}
        class:opacity-100={activeTab === tabItem.id}
        class:opacity-70={activeTab !== tabItem.id}
        class:hover:scale-105={activeTab !== tabItem.id}
        class:hover:opacity-100={activeTab !== tabItem.id}>
        <Icon src={tabItem.icon} class="w-4 h-4 transition-transform duration-200" />
        <span class="transition-all duration-200">{tabItem.label}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style> 