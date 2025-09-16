<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Plus, Inbox, PaperAirplane, Trash, Star, Rss, ChatBubbleLeftRight } from 'svelte-hero-icons';
  import { getRSS } from '../../../utils/netUtil';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
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
      { name: 'Inbox', icon: Inbox, id: 'inbox' },
      { name: 'Sent', icon: PaperAirplane, id: 'sent' },
      { name: 'Starred', icon: Star, id: 'starred' },
      { name: 'Trash', icon: Trash, id: 'trash' },
    ];
    const subset = await invoke<any>('get_settings_subset', { keys: ['feeds'] });
    for (let item of (subset?.feeds || [])) {
      let title = await getRSS(item.url);
      folders.push({
        name: `RSS: ${title.channel.title}`,
        icon: Rss,
        id: `rss-${item.url}`,
      });
    }
    return folders;
  }
  const rssFeeds = a();
</script>

<aside
  class="flex flex-col m-2 bg-white rounded-xl border-r shadow-md backdrop-blur-xs overflow-y-scroll h-full xl:w-64 border-zinc-300/50 dark:border-zinc-800/50 dark:bg-zinc-900">
  <div class="p-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
    <button
      class="flex gap-2 items-center px-4 py-3 w-full text-sm font-semibold text-white rounded-2xl shadow-md transition-all duration-200 accent-bg accent-shadow sm:text-base hover:opacity-95 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring"
      onclick={openCompose}>
      <Icon src={Plus} class="w-5 h-5" />
      <span>New message</span>
    </button>
  </div>
  {#await rssFeeds}
    <p>Loading Data...</p>
  {:then folders}
    <nav class="flex flex-col flex-1 gap-1 px-2 py-4">
      {#each folders as folder}
        <button
          class="w-full flex items-center gap-3 px-4 sm:px-6 py-2.5 text-left text-sm sm:text-base font-medium rounded-lg transition-all duration-200 relative group
            {selectedFolder === folder.name
              ? 'accent-bg text-white accent-bg pl-5 shadow-md'
              : 'border-transparent text-zinc-700 dark:text-white hover:bg-accent-100 dark:hover:bg-accent-700 hover:scale-[1.02]'}
            focus:outline-hidden focus:ring-2 accent-ring"
          onclick={() => openFolder(folder)}>
          <Icon src={folder.icon} class="w-5 h-5" />
          <span>{folder.name}</span>
        </button>
      {/each}
    </nav>
  {:catch error}
    <p>Error! {error}</p>
  {/await}
</aside>
