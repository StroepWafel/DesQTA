<script lang="ts">
  // Svelte imports
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  // Tauri imports
  import { invoke } from '@tauri-apps/api/core';

  // $lib/ imports
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import Modal from '$lib/components/Modal.svelte';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';
  import { Icon } from 'svelte-hero-icons';
  import { Rss } from 'svelte-hero-icons';

  // Relative imports
  import { logger } from '../../utils/logger';
  import MessageList from '../direqt-messages/components/MessageList.svelte';
  import MessageDetail from '../direqt-messages/components/Message.svelte';
  import { getRSS } from '../../utils/netUtil';

  // Types
  import { type Message } from '../direqt-messages/types';

  let messages = $state<Message[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selectedFeed = $state<string | null>(null);
  let selectedMessage = $state<Message | null>(null);
  let feeds = $state<Array<{ url: string; name: string }>>([]);

  // Derived state for mobile modal
  let showMobileModal = $derived(!!selectedMessage);

  async function loadFeeds() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['feeds'] });
      const feedList = subset?.feeds || [];
      const feedData = [];
      
      for (const item of feedList) {
        try {
          const rssData = await getRSS(item.url);
          feedData.push({
            url: item.url,
            name: rssData.channel?.title || new URL(item.url).hostname,
          });
        } catch (e) {
          logger.error('rss-feeds', 'loadFeeds', `Failed to load feed ${item.url}`, { error: e });
          feedData.push({
            url: item.url,
            name: new URL(item.url).hostname,
          });
        }
      }
      
      feeds = feedData;
      if (feedData.length > 0 && !selectedFeed) {
        selectedFeed = feedData[0].name;
        fetchMessages(feedData[0].url, feedData[0].name);
      }
    } catch (e) {
      logger.error('rss-feeds', 'loadFeeds', 'Failed to load feeds', { error: e });
      error = 'Failed to load RSS feeds';
    }
  }

  async function fetchMessages(feedUrl: string, feedName: string) {
    loading = true;
    error = null;
    logger.debug('rss-feeds', 'fetchMessages', `Fetching RSS feed: ${feedName}`);

    const folderLabel = `rss-${feedUrl}`;
    const cacheKey = `messages_${folderLabel}`;

    const data = await useDataLoader<Message[]>({
      cacheKey,
      ttlMinutes: 10,
      context: 'rss-feeds',
      functionName: 'fetchMessages',
      skipCache: true, // Skip caching for RSS feeds to always get fresh content
      fetcher: async () => {
        const msgs = await invoke<Message[]>('fetch_messages', {
          folder: folderLabel,
          rssUrl: feedName,
        });
        messages = msgs;
        return messages;
      },
      onDataLoaded: (data) => {
        messages = data;
        loading = false;
      },
      shouldSyncInBackground: (data) => data.length > 0,
    });

    loading = false;
  }

  function openFeed(feed: { url: string; name: string }) {
    selectedFeed = feed.name;
    selectedMessage = null;
    logger.debug('rss-feeds', 'openFeed', `Opening feed: ${feed.name}`);
    fetchMessages(feed.url, feed.name);
  }

  async function openMessage(msg: Message) {
    selectedMessage = msg;
    msg.unread = false;

    const cacheKey = `rss_${msg.id}`;

    const content = await useDataLoader<string>({
      cacheKey,
      ttlMinutes: 1440, // 24 hours
      context: 'rss-feeds',
      functionName: 'openMessage',
      skipCache: true, // Skip caching for RSS feeds to always get fresh content
      fetcher: async () => {
        return msg.body; // RSS body is already loaded
      },
      onDataLoaded: (content) => {
        msg.body = content;
      },
    });

    if (!content && !msg.body) {
      msg.body = `<em>${$_('messages.no_content') || 'No content.'}</em>`;
    }
  }

  onMount(() => {
    loadFeeds();
  });
</script>

<div class="flex h-full">
  <div class="flex w-full h-full max-xl:flex-col">
    {#if error && feeds.length === 0}
      <div class="flex flex-col justify-center items-center p-8 w-full h-full text-center">
        <div class="mb-4 text-lg font-semibold text-red-500 dark:text-red-400">
          <T key="rss_feeds.error_loading" fallback="Failed to load RSS feeds." />
        </div>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          <T key="rss_feeds.add_feeds_in_settings" fallback="Add RSS feeds in Settings to get started." />
        </p>
      </div>
    {:else if feeds.length === 0}
      <div class="flex flex-col justify-center items-center p-8 w-full h-full text-center">
        <Icon src={Rss} class="mb-4 w-16 h-16 text-zinc-400 dark:text-zinc-600" />
        <div class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
          <T key="rss_feeds.no_feeds" fallback="No RSS Feeds" />
        </div>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          <T key="rss_feeds.add_feeds_in_settings" fallback="Add RSS feeds in Settings to get started." />
        </p>
      </div>
    {:else}
      <!-- Sidebar -->
      <aside
        class="flex flex-col m-2 bg-white rounded-xl border-r shadow-md backdrop-blur-xs overflow-y-scroll xl:w-64 border-zinc-300/50 dark:border-zinc-800/50 dark:bg-zinc-900">
        <div class="p-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
            <T key="rss_feeds.title" fallback="RSS Feeds" />
          </h2>
        </div>
        <nav class="flex flex-col flex-1 gap-1 px-2 py-4">
          {#each feeds as feed}
            <button
              class="w-full flex items-center border gap-3 px-4 sm:px-6 py-2.5 text-left text-sm sm:text-base font-medium rounded-lg transition-all duration-200 relative group
                {selectedFeed === feed.name
                  ? 'bg-accent/10 border-accent dark:text-white pl-5 shadow-md'
                  : 'border-transparent text-zinc-700 dark:text-white hover:bg-accent-100/10 dark:hover:bg-accent/10 hover:scale-[1.02]'}
                focus:outline-hidden focus:ring-2 accent-ring"
              onclick={() => openFeed(feed)}>
              <Icon src={Rss} class="w-5 h-5" />
              <span>{feed.name}</span>
            </button>
          {/each}
        </nav>
      </aside>

      <!-- Message List -->
      <MessageList
        selectedFolder={selectedFeed || ''}
        {messages}
        {loading}
        {error}
        {selectedMessage}
        {openMessage} />

      <!-- Message detail view - full screen on desktop -->
      <div class="hidden flex-1 xl:block">
        <MessageDetail
          {selectedMessage}
          selectedFolder={selectedFeed || ''}
          detailLoading={false}
          detailError={null}
          openCompose={() => {}}
          starMessage={() => {}}
          deleteMessage={() => {}}
          restoreMessage={() => {}}
          starring={false}
          deleting={false}
          restoring={false} />
      </div>
    {/if}
  </div>

  <!-- Mobile message detail modal -->
  <div class="xl:hidden">
    <Modal
      open={showMobileModal}
      onclose={() => (selectedMessage = null)}
      maxWidth="w-full"
      maxHeight="h-full"
      className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs rounded-none"
      showCloseButton={false}
      closeOnBackdrop={false}
      ariaLabel="RSS Feed Item Detail">
      <div class="flex flex-col h-full">
        <div
          class="flex justify-between items-center p-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
          <button
            class="flex gap-2 items-center transition-colors text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            onclick={() => (selectedMessage = null)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              viewBox="0 0 20 20"
              fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium">
              <T key="common.back" fallback="Back" />
            </span>
          </button>
          <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <T key="rss_feeds.feed_item" fallback="Feed Item" />
          </span>
          <div class="w-8"></div>
        </div>

        <div class="overflow-y-auto flex-1">
          <MessageDetail
            {selectedMessage}
            selectedFolder={selectedFeed || ''}
            detailLoading={false}
            detailError={null}
            openCompose={() => {}}
            starMessage={() => {}}
            deleteMessage={() => {}}
            restoreMessage={() => {}}
            starring={false}
            deleting={false}
            restoring={false} />
        </div>
      </div>
    </Modal>
  </div>
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-in {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
