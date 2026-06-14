<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import {
    Plus,
    Inbox,
    PaperAirplane,
    Trash,
    Star,
    Rss,
    ChatBubbleLeftRight,
  } from 'svelte-hero-icons';
  import { getRSS } from '../../../utils/netUtil';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  let { selectedFolder, openFolder, openCompose } = $props<{
    selectedFolder: any;
    openFolder: (folder: any) => void;
    openCompose: () => void;
  }>();

  interface Feed {
    url: string;
  }
  async function a() {
    // Folder definitions
    let folders = [
      { name: $_('messages.inbox') || 'Inbox', icon: Inbox, id: 'inbox' },
      { name: $_('messages.sent') || 'Sent', icon: PaperAirplane, id: 'sent' },
      { name: $_('messages.starred') || 'Starred', icon: Star, id: 'starred' },
      { name: $_('messages.trash') || 'Trash', icon: Trash, id: 'trash' },
    ];
    // Check if RSS feeds should be separated
    const settingsSubset = await invoke<any>('get_settings_subset', {
      keys: ['feeds', 'separate_rss_feed'],
    });
    const separateRssFeed = settingsSubset?.separate_rss_feed ?? false;

    // Only add RSS feeds to messages sidebar if the setting is disabled
    if (!separateRssFeed) {
      const feeds = settingsSubset?.feeds || [];
      for (let item of feeds) {
        try {
          let title = await getRSS(item.url);
          folders.push({
            name: `RSS: ${title.channel.title}`,
            icon: Rss,
            id: `rss-${item.url}`,
          });
        } catch (e) {
          // Skip failed RSS feeds
        }
      }
    }
    return folders;
  }
  const rssFeeds = a();
</script>

<aside
  class="flex flex-col h-full surface overflow-hidden overflow-y-auto xl:w-64 scrollbar-thin scrollbar-thumb-zinc-400/30 scrollbar-track-transparent">
  <div class="p-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
    <button
      class="flex gap-2 items-center min-h-[44px] px-4 py-3 w-full text-sm font-semibold text-white rounded-xl transition-colors duration-150 bg-accent-500 hover:bg-accent-600 sm:text-base focus:outline-hidden focus:ring-2 focus-visible:ring-accent-500/40"
      onclick={openCompose}>
      <Icon src={Plus} class="w-5 h-5" />
      <span><T key="messages.new_message" fallback="New message" /></span>
    </button>
  </div>
  {#await rssFeeds}
    <p><T key="messages.loading_data" fallback="Loading Data..." /></p>
  {:then folders}
    <nav class="flex flex-col flex-1 gap-1 px-2 py-4">
      {#each folders as folder}
        <button
          class="w-full flex items-center min-h-[44px] border gap-3 px-4 sm:px-6 py-2.5 text-left text-sm sm:text-base font-medium rounded-lg transition-colors duration-150 relative
            {selectedFolder === folder.name
            ? 'bg-sidebar-accent border-border text-sidebar-accent-foreground pl-5'
            : 'border-transparent text-muted-foreground hover:text-sidebar-accent-foreground'}
            focus:outline-hidden focus:ring-2 focus-visible:ring-sidebar-ring"
          onclick={() => openFolder(folder)}>
          <Icon src={folder.icon} class="w-5 h-5" />
          <span>{folder.name}</span>
        </button>
      {/each}
    </nav>
  {:catch error}
    <p><T key="messages.error" fallback="Error! {error}" values={{ error }} /></p>
  {/await}
</aside>

<style>
  /* Hide native scrollbar buttons (up/down arrows) */
  aside::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  /* Firefox - hide scrollbar buttons and use accent color */
  aside {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--accent-color-value, #3b82f6) 30%, transparent)
      transparent;
  }

  /* Webkit scrollbar thumb with accent color */
  aside::-webkit-scrollbar {
    width: 6px;
  }

  aside::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
  }

  aside::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--accent-color-value, #3b82f6) 30%, transparent);
    border-radius: 3px;
  }

  aside::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--accent-color-value, #3b82f6) 50%, transparent);
  }
</style>
