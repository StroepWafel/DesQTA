<script lang="ts">
  // Svelte imports
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';

  // Tauri imports
  import { invoke } from '@tauri-apps/api/core';

  // $lib/ imports
  import { setIdb, getWithIdbFallback } from '$lib/services/idbCache';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import Modal from '$lib/components/Modal.svelte';
  import T from '$lib/components/T.svelte';
  import { get } from 'svelte/store';
  import { _ } from '$lib/i18n';

  // Relative imports
  import { cache } from '../../utils/cache';
  import { logger } from '../../utils/logger';
  import Sidebar from './components/Sidebar.svelte';
  import MessageList from './components/MessageList.svelte';
  import MessageDetail from './components/Message.svelte';
  import ComposeModal from './components/ComposeModal.svelte';
  import MobileFolderTabs from './components/MobileFolderTabs.svelte';

  // Types
  import { type Message, type MessageFile } from './types';

  let messages = $state<Message[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selectedFolder = $state('Inbox');
  let selectedRSS = $state();
  let selectedMessage = $state<Message | null>(null);
  let showComposeModal = $state(false);
  let composeSubject = $state('');
  let composeBody = $state('');

  let detailLoading = $state(false);
  let detailError = $state<string | null>(null);

  let starring = $state(false);
  let deleting = $state(false);
  let restoring = $state(false);

  // Deep-link target from notifications
  let pendingMessageId = $state<number | null>(null);

  // Derived state for mobile modal
  let showMobileModal = $derived(!!selectedMessage);
  let seqtaLoadFailed = $state(false);
  let seqtaMessagesEnabled = $state<boolean | null>(null);

  onMount(async () => {
    // Always enable both tabs regardless of SEQTA config
    seqtaMessagesEnabled = true;
    // Initial load: fetch inbox messages (skip cache to ensure fresh data)
    fetchMessages('inbox', '', true);
  });

  // Watch URL for messageID parameter and store it until messages load
  $effect(() => {
    const idParam = $page.url.searchParams.get('messageID');
    pendingMessageId = idParam ? Number(idParam) : null;
  });

  async function fetchMessages(folderLabel: string = 'inbox', rssname: string = '', forceSkipCache: boolean = false) {
    loading = true;
    error = null;
    seqtaLoadFailed = false;
    logger.debug('messages', 'fetchMessages', `Fetching messages for folder: ${folderLabel}`);

    const cacheKey = `messages_${folderLabel}`;
    const isRSSFeed = folderLabel.includes('rss-');
    const isOnline = navigator.onLine;

    // For inbox, try API first (when online), then fall back to cache if unavailable
    // For other folders, use normal caching behavior
    if (folderLabel === 'inbox' && isOnline && !isRSSFeed) {
      try {
        // Try to fetch fresh data first
        const msgs = await invoke<Message[]>('fetch_messages', {
          folder: folderLabel,
          rssUrl: null,
        });
        
        // Success - update cache and messages
        messages = msgs;
        cache.set(cacheKey, msgs, 10);
        await setIdb(cacheKey, msgs);
        loading = false;
        return;
      } catch (e) {
        // API failed - fall back to cache
        logger.debug('messages', 'fetchMessages', `API fetch failed, falling back to cache`, {
          error: e,
          folder: folderLabel,
        });
        
        const cached =
          cache.get<Message[]>(cacheKey) ||
          (await getWithIdbFallback<Message[]>(cacheKey, cacheKey, () =>
            cache.get<Message[]>(cacheKey),
          ));
        
        if (cached) {
          // Use cache even if empty (empty inbox is valid)
          messages = cached;
          loading = false;
          return;
        }
        
        // No cache available - show error
        error = get(_)('messages.failed_to_load_no_cache');
        loading = false;
        return;
      }
    }

    // Normal behavior for other folders or RSS feeds
    const data = await useDataLoader<Message[]>({
      cacheKey,
      ttlMinutes: 10,
      context: 'direqt-messages',
      functionName: 'fetchMessages',
      skipCache: isRSSFeed, // Skip caching for RSS feeds to always get fresh content
      fetcher: async () => {
        let rssUrl = null;
        if (isRSSFeed) {
          rssUrl = rssname;
        }
        const msgs = await invoke<Message[]>('fetch_messages', {
          folder: folderLabel,
          rssUrl: rssUrl,
        });
        // Update messages state directly
        messages = msgs;
        return messages;
      },
      onDataLoaded: (data) => {
        messages = data;
        loading = false;
      },
      shouldSyncInBackground: (data) => data.length > 0,
    });

    if (!data || data.length === 0) {
      // Only consider failure if we didn't get data and expected some (e.g. inbox usually has mail)
      // But empty folders are valid. The backend returns empty array on success.
      // Only show error if something actually threw.
      // Since invoke throws on Err, useDataLoader catches it.
      if (messages.length === 0 && folderLabel === 'inbox') {
        // maybe empty inbox
      }
    }
    loading = false;
  }

  // When messages are loaded and a target ID exists, open it
  $effect(() => {
    if (!loading && pendingMessageId) {
      const target = messages.find((m) => m.id === pendingMessageId!);
      if (target) {
        selectedFolder = target.folder;
        openMessage(target);
        pendingMessageId = null;
      }
    }
  });

  async function openMessage(msg: Message) {
    selectedMessage = msg;
    msg.unread = false;

    const isRSSMessage =
      msg.folder.includes('RSS') || selectedFolder.includes('RSS') || msg.folder.includes('rss-');
    const cacheKey = isRSSMessage ? `rss_${msg.id}` : `message_${msg.id}`;

    const messageData = await useDataLoader<{ content: string; files?: MessageFile[] }>({
      cacheKey,
      ttlMinutes: 1440, // 24 hours
      context: 'direqt-messages',
      functionName: 'openMessage',
      skipCache: isRSSMessage, // Skip caching for RSS feeds to always get fresh content
      fetcher: async () => {
        if (isRSSMessage) {
          return { content: msg.body, files: [] }; // RSS body is already loaded
        }
        const result = await invoke<{ content: string; files?: MessageFile[] }>(
          'fetch_message_content',
          { id: msg.id },
        );
        return result;
      },
      onDataLoaded: (data) => {
        msg.body = data.content;
        if (data.files) {
          msg.files = data.files;
        }
      },
    });

    if (!messageData?.content && !msg.body) {
      // Fetch failed or no content
      msg.body = `<em>${$_('messages.no_content') || 'No content.'}</em>`;
    } else if (messageData?.content) {
      msg.body = messageData.content;
      if (messageData.files) {
        msg.files = messageData.files;
      }
    }
  }

  function openFolder(folder: any) {
    // Always fetch, even if folder is already selected (to refresh the list)
    selectedFolder = folder.name;
    selectedMessage = null;
    logger.debug('messages', 'openFolder', `Opening folder: ${folder.name}`, {
      folderId: folder.id,
    });
    if (folder.id.includes('rss-')) {
      selectedRSS = folder.id;
      fetchMessages(folder.id, folder.name);
    } else {
      // For inbox, fetchMessages will try API first then fall back to cache
      // For other folders, use normal caching
      fetchMessages(folder.id);
    }
  }

  function openCompose() {
    showComposeModal = true;
    composeSubject = '';
    composeBody = '';
  }

  function closeModal() {
    showComposeModal = false;
  }

  async function starMessage(msg: Message) {
    if (starring) return;
    starring = true;
    try {
      let newStarred = true;
      if (selectedFolder === 'Starred' && msg.starred) {
        newStarred = false;
      }

      await invoke('star_messages', { items: [msg.id], star: newStarred });

      msg.starred = newStarred;
      if (!newStarred && selectedFolder === 'Starred') {
        messages = messages.filter((m) => m.id !== msg.id);
        if (selectedMessage && selectedMessage.id === msg.id) {
          selectedMessage = null;
        }
      }
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.success(newStarred ? get(_)('messages.message_starred') : get(_)('messages.message_unstarred'));
    } catch (e) {
      logger.error('messages', 'starMessage', 'Failed to star message', { error: e });
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.error(get(_)('messages.failed_to_update_star'));
    } finally {
      starring = false;
    }
  }

  async function deleteMessage(msg: Message) {
    if (deleting) return;
    deleting = true;
    try {
      await invoke('delete_messages', { items: [msg.id] });

      messages = messages.filter((m) => m.id !== msg.id);
      if (selectedMessage && selectedMessage.id === msg.id) {
        selectedMessage = null;
      }
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.success(get(_)('messages.deleted_success'));
    } catch (e) {
      logger.error('messages', 'deleteMessage', 'Failed to delete message', { error: e });
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.error(get(_)('messages.delete_failed'));
    } finally {
      deleting = false;
    }
  }

  async function restoreMessage(msg: Message) {
    if (restoring) return;
    restoring = true;
    try {
      await invoke('restore_messages', { items: [msg.id] });

      messages = messages.filter((m) => m.id !== msg.id);
      if (selectedMessage && selectedMessage.id === msg.id) {
        selectedMessage = null;
      }
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.success(get(_)('messages.restored_success'));
    } catch (e) {
      logger.error('messages', 'restoreMessage', 'Failed to restore message', { error: e });
      const { toastStore } = await import('../../lib/stores/toast');
      toastStore.error(get(_)('messages.restore_failed'));
    } finally {
      restoring = false;
    }
  }
</script>

<div class="flex h-full">
  <div class="flex w-full h-full max-xl:flex-col">
    {#if seqtaLoadFailed}
      <div class="flex flex-col justify-center items-center p-8 w-full h-full text-center">
        <div class="mb-4 text-lg font-semibold text-red-500 dark:text-red-400">
          <T key="messages.seqta_failed_to_load" fallback="SEQTA messaging failed to load." />
        </div>
      </div>
    {:else}
      <div class="hidden xl:block">
        <Sidebar {selectedFolder} {openFolder} {openCompose} />
      </div>
      <MobileFolderTabs {selectedFolder} {openFolder} {openCompose} />
      <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div class="flex-1 min-h-0 overflow-hidden">
          <MessageList {selectedFolder} {messages} {loading} {error} {selectedMessage} {openMessage} />
        </div>
      </div>
      <!-- Message detail view - full screen on mobile -->
      <div class="hidden flex-1 xl:block">
        <MessageDetail
          {selectedMessage}
          {selectedFolder}
          {detailLoading}
          {detailError}
          {openCompose}
          {starMessage}
          {deleteMessage}
          {restoreMessage}
          {starring}
          {deleting}
          {restoring} />
      </div>
    {/if}
  </div>

  <!-- Mobile message detail modal -->
  {#if !seqtaLoadFailed}
    <div class="xl:hidden">
      <Modal
        open={showMobileModal}
        onclose={() => (selectedMessage = null)}
        maxWidth="w-full"
        maxHeight="h-full"
        className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-none transition-all duration-300"
        showCloseButton={false}
        closeOnBackdrop={false}
        ariaLabel={$_( 'messages.message_detail' )}>
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
              <T key="messages.message" fallback="Message" />
            </span>
            <div class="w-8"></div>
            <!-- Spacer for alignment -->
          </div>

          <div class="overflow-y-auto flex-1" in:fade={{ duration: 300 }}>
            <MessageDetail
              {selectedMessage}
              {selectedFolder}
              {detailLoading}
              {detailError}
              {openCompose}
              {starMessage}
              {deleteMessage}
              {restoreMessage}
              {starring}
              {deleting}
              {restoring} />
          </div>
        </div>
      </Modal>
    </div>
  {/if}
</div>

<ComposeModal {showComposeModal} {composeSubject} {composeBody} {closeModal} />
