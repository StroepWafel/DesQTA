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
  class="flex flex-col m-2 bg-white rounded-xl border-r shadow-md backdrop-blur-xs overflow-y-scroll xl:w-64 border-zinc-300/50 dark:border-zinc-800/50 dark:bg-zinc-900">
  <div class="p-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
    <button
      class="flex gap-2 items-center px-4 py-3 w-full text-sm font-semibold text-white rounded-2xl shadow-md transition-all duration-200 bg-accent/80 border-accent sm:text-base hover:opacity-95 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring"
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
          class="w-full flex items-center border gap-3 px-4 sm:px-6 py-2.5 text-left text-sm sm:text-base font-medium rounded-lg transition-all duration-200 relative group transform
            {selectedFolder === folder.name
            ? 'bg-accent/10 border-accent dark:text-white pl-5 shadow-md'
            : 'border-transparent text-zinc-700 dark:text-white hover:bg-accent-100/10 dark:hover:bg-accent/10 hover:scale-[1.02]'}
            focus:outline-hidden focus:ring-2 accent-ring"
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
