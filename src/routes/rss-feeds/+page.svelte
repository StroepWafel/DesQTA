<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import { invoke } from '@tauri-apps/api/core';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import Modal from '$lib/components/Modal.svelte';
  import { EmptyState, Button } from '$lib/components/ui';
  import { get } from 'svelte/store';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';
  import { Icon } from 'svelte-hero-icons';
  import { Rss, Bars3, XMark, ExclamationTriangle } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { platformStore } from '$lib/stores/platform';

  import { logger } from '../../utils/logger';
  import MessageList from '../direqt-messages/components/MessageList.svelte';
  import MessageDetail from '../direqt-messages/components/Message.svelte';
  import { getRSS } from '../../utils/netUtil';

  import type { Message } from '../direqt-messages/types';

  let messages = $state<Message[]>([]);
  let loading = $state(true);
  let loadingFeeds = $state(true);
  let error = $state<string | null>(null);

  let selectedFeed = $state<string | null>(null);
  let selectedMessage = $state<Message | null>(null);
  let feeds = $state<Array<{ url: string; name: string }>>([]);
  let sidebarOpen = $state(false);
  let isMobile = $derived($platformStore.isMobile);

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
      error = get(_)('rss_feeds.error_loading');
    } finally {
      loadingFeeds = false;
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
      skipCache: true,
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

    if (isMobile) {
      sidebarOpen = false;
    }
  }

  async function openMessage(msg: Message) {
    selectedMessage = msg;
    msg.unread = false;

    const cacheKey = `rss_${msg.id}`;

    const content = await useDataLoader<string>({
      cacheKey,
      ttlMinutes: 1440,
      context: 'rss-feeds',
      functionName: 'openMessage',
      skipCache: true,
      fetcher: async () => msg.body,
      onDataLoaded: (content) => {
        msg.body = content;
      },
    });

    if (!content && !msg.body) {
      msg.body = `<em>${$_('messages.no_content') || 'No content.'}</em>`;
    }
  }

  $effect(() => {
    sidebarOpen = !isMobile;
  });

  onMount(() => {
    loadFeeds();
  });
</script>

<div class="flex flex-col h-full">
  <div class="container px-6 py-7 mx-auto flex flex-col flex-1 min-h-0 w-full gap-6">
    {#if loadingFeeds}
      <div class="flex justify-center items-center flex-1 min-h-[320px]" in:fade={{ duration: 400 }}>
        <div
          class="w-12 h-12 rounded-full border-4 border-accent-600/30 border-t-accent-600 animate-spin">
        </div>
      </div>
    {:else if error && feeds.length === 0}
      <div class="flex flex-col justify-center items-center flex-1 min-h-[320px]" in:fade={{ duration: 400 }}>
        <EmptyState
          title={$_('rss_feeds.error_loading') || 'Failed to load RSS feeds.'}
          message={$_('rss_feeds.add_feeds_in_settings') || 'Add RSS feeds in Settings to get started.'}
          icon={ExclamationTriangle}
          size="md" />
        <Button variant="primary" class="mt-4 accent-bg accent-ring" onclick={() => goto('/settings')}>
          <T key="rss_feeds.manage_feeds_in_settings" fallback="Manage Feeds in Settings" />
        </Button>
      </div>
    {:else if feeds.length === 0}
      <div class="flex flex-col justify-center items-center flex-1 min-h-[320px]" in:fade={{ duration: 400 }}>
        <EmptyState
          title={$_('rss_feeds.no_feeds') || 'No RSS Feeds'}
          message={$_('rss_feeds.add_feeds_in_settings_empty') || 'Add, edit, or remove RSS feeds in Settings.'}
          icon={Rss}
          size="md" />
        <Button variant="primary" class="mt-4 accent-bg accent-ring" onclick={() => goto('/settings')}>
          <T key="rss_feeds.manage_feeds_in_settings" fallback="Manage Feeds in Settings" />
        </Button>
      </div>
    {:else}
      <!-- Page header: full width above content -->
      <header class="shrink-0" in:fade={{ duration: 400 }}>
        <div class="flex items-center gap-3 mb-2">
          <h1 class="text-3xl font-bold text-zinc-900 dark:text-white">
            <T key="rss_feeds.title" fallback="RSS Feeds" />
          </h1>
        </div>
        <p class="text-zinc-600 dark:text-zinc-400">
          <T key="rss_feeds.description" fallback="Read and browse your subscribed RSS feeds in one place." />
        </p>
      </header>

      <!-- Main content: sidebar + list + detail -->
      <div
        class="rss-main flex flex-1 min-h-0 flex-col xl:flex-row overflow-hidden gap-4 rounded-xl bg-transparent"
        in:fade={{ duration: 400, delay: 100 }}>
        <!-- Mobile: feed selector bar -->
        {#if isMobile}
          <div class="shrink-0 flex justify-between items-center p-4 bg-transparent">
            <button
              class="flex gap-2 items-center px-4 py-2 rounded-lg transition-all duration-200 accent-bg hover:opacity-90 text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 accent-ring transform hover:scale-[1.02] active:scale-[0.98]"
              onclick={() => (sidebarOpen = !sidebarOpen)}
              aria-label={$_('navigation.toggle_sidebar') || 'Toggle sidebar'}>
              <Icon src={sidebarOpen ? XMark : Bars3} class="w-5 h-5" />
              <span>{selectedFeed || $_('rss_feeds.select_feed') || 'Select Feed'}</span>
            </button>
          </div>
        {/if}

        <!-- Mobile overlay -->
        {#if isMobile && sidebarOpen}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="fixed inset-0 z-20 backdrop-blur-sm bg-black/50 xl:hidden transition-opacity duration-300"
            onclick={() => (sidebarOpen = false)}
            role="button"
            tabindex="0"
            aria-label={$_('navigation.close_sidebar') || 'Close sidebar overlay'}></div>
        {/if}

        <!-- Sidebar: feed list -->
        <aside
            class="rss-sidebar-animate flex flex-col shrink-0 w-64 xl:w-72 overflow-hidden rounded-xl bg-white/20 dark:bg-zinc-900/20 backdrop-blur-md {isMobile
            ? `fixed top-0 left-0 z-30 w-80 h-full ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : ''} transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
          <div class="flex justify-between items-center gap-2 p-4 shrink-0 bg-transparent">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="rss_feeds.your_feeds" fallback="Your Feeds" />
            </h2>
            <div class="flex gap-1 items-center">
              {#if isMobile}
                <button
                  onclick={() => (sidebarOpen = false)}
                  class="p-2 text-zinc-600 dark:text-zinc-400 rounded-lg transition-all duration-200 hover:text-accent dark:hover:text-accent hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  title={$_('navigation.close_sidebar') || 'Close sidebar'}
                  aria-label={$_('navigation.close_sidebar') || 'Close sidebar'}>
                  <Icon src={XMark} class="w-5 h-5" />
                </button>
              {/if}
            </div>
          </div>
          <nav class="flex flex-col flex-1 gap-1 px-2 py-4 overflow-y-auto [scrollbar-gutter:stable]">
            {#key feeds.length + feeds.map((f) => f.url).join(',')}
              {#each feeds as feed, i}
                <div class="rss-feed-item-animate" style="animation-delay: {i * 50}ms;">
                  <button
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium rounded-lg transition-all duration-200 relative
                      {selectedFeed === feed.name
                      ? 'bg-accent/10 text-zinc-900 dark:text-white'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 hover:scale-[1.02]'}
                      focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                    onclick={() => openFeed(feed)}>
                    <Icon src={Rss} class="w-5 h-5 shrink-0" />
                    <span class="truncate">{feed.name}</span>
                  </button>
                </div>
              {/each}
            {/key}
          </nav>
        </aside>

        <!-- Message list -->
        <div class="flex flex-1 xl:flex-initial flex-col min-h-0 rss-list-animate min-w-0 xl:w-[28rem] xl:min-w-[28rem] shrink-0 rounded-xl bg-white/20 dark:bg-zinc-900/20 backdrop-blur-md overflow-y-auto [scrollbar-gutter:stable]" style="animation-delay: 100ms;">
          <MessageList
            selectedFolder={selectedFeed || ''}
            {messages}
            {loading}
            {error}
            {selectedMessage}
            {openMessage}
            embedded={true} />
        </div>

        <!-- Message detail: article content -->
        <div class="flex-1 min-w-0 min-h-0 hidden xl:flex flex-col rss-detail-animate overflow-hidden rounded-xl bg-white/20 dark:bg-zinc-900/20 backdrop-blur-md" style="animation-delay: 200ms;">
          {#key selectedMessage?.id ?? 'empty'}
            <div class="w-full h-full flex flex-col min-w-0 overflow-hidden" in:fade={{ duration: 200 }}>
              <MessageDetail
            {selectedMessage}
            selectedFolder={selectedFeed || ''}
            embedded={true}
            detailLoading={false}
            detailError={null}
            openCompose={async () => {}}
            starMessage={async () => {}}
            deleteMessage={async () => {}}
            restoreMessage={async () => {}}
            starring={false}
            deleting={false}
            restoring={false} />
            </div>
          {/key}
        </div>
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
      className="bg-transparent backdrop-blur-sm rounded-none"
      showCloseButton={false}
      closeOnBackdrop={false}
      ariaLabel={$_('rss_feeds.feed_item_detail')}>
      <div class="flex flex-col h-full">
        <div class="flex justify-between items-center p-4 shrink-0">
          <button
            class="flex gap-2 items-center transition-colors duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
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

        <div class="overflow-y-auto flex-1 bg-transparent">
          <MessageDetail
            {selectedMessage}
            selectedFolder={selectedFeed || ''}
            embedded={true}
            detailLoading={false}
            detailError={null}
            openCompose={async () => {}}
            starMessage={async () => {}}
            deleteMessage={async () => {}}
            restoreMessage={async () => {}}
            starring={false}
            deleting={false}
            restoring={false} />
        </div>
      </div>
    </Modal>
  </div>
</div>

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .rss-feed-item-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }

  .rss-sidebar-animate,
  .rss-list-animate,
  .rss-detail-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }

  /* Remove default grey borders from base layer */
  .rss-main * {
    border-width: 0;
  }
</style>
