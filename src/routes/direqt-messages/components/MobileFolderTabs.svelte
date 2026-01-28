<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Plus, Inbox, PaperAirplane, Trash, Star, Rss } from 'svelte-hero-icons';
  import { getRSS } from '../../../utils/netUtil';
  import { invoke } from '@tauri-apps/api/core';

  let { selectedFolder, openFolder, openCompose } = $props<{
    selectedFolder: string;
    openFolder: (folder: { name: string; icon: any; id: string }) => void;
    openCompose: () => void;
  }>();

  type Folder = { name: string; icon: any; id: string };

  let folders = $state<Folder[]>([]);
  let loading = $state(true);

  async function loadFolders() {
    loading = true;
    try {
      const base: Folder[] = [
        { name: 'Inbox', icon: Inbox, id: 'inbox' },
        { name: 'Sent', icon: PaperAirplane, id: 'sent' },
        { name: 'Starred', icon: Star, id: 'starred' },
        { name: 'Trash', icon: Trash, id: 'trash' },
      ];

      const subset = await invoke<any>('get_settings_subset', { keys: ['feeds', 'separate_rss_feed'] });
      const separateRssFeed = subset?.separate_rss_feed ?? false;
      
      // Only add RSS feeds to messages tabs if the setting is disabled
      if (!separateRssFeed) {
        const feeds = (subset?.feeds || []) as Array<{ url: string }>;
        for (const item of feeds) {
          try {
            const rss = await getRSS(item.url);
            base.push({ name: `RSS: ${rss.channel.title}`, icon: Rss, id: `rss-${item.url}` });
          } catch (_) {
            // Ignore failed RSS entries on mobile tabs
          }
        }
      }
      folders = base;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Load once when component mounts
    loadFolders();
  });
</script>

<!-- Mobile-only sticky tabs + compose -->
<div class="xl:hidden p-2 flex sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/60 border-b border-zinc-200/60 dark:border-zinc-800/60">
  <div class="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-thin">
    {#if loading}
      <div class="px-3 py-1.5 text-xs rounded-full bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300">Loading…</div>
    {:else}
      {#each folders as folder}
        <button
          class="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-all duration-150 whitespace-nowrap
            {selectedFolder === folder.name
              ? 'bg-accent-500 text-white border-transparent shadow-sm'
              : 'bg-white/70 dark:bg-zinc-800/70 border-zinc-300/60 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-white/90 dark:hover:bg-zinc-700/80'}"
          onclick={() => openFolder(folder)}
          aria-pressed={selectedFolder === folder.name}>
          <Icon src={folder.icon} class="w-4 h-4" />
          <span>{folder.name}</span>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Mobile FAB compose button -->
  <button
    class="inline-flex items-center justify-center w-12 h-12 rounded-full shadow-lg accent-bg hover:opacity-90 active:scale-95 transition-all duration-200 focus:outline-hidden focus:ring-2 accent-ring text-white"
    onclick={openCompose}
    aria-label="Compose">
    <Icon src={Plus} class="w-6 h-6" />
  </button>
</div>

<style>
  .scrollbar-thin::-webkit-scrollbar { height: 6px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }
</style>

