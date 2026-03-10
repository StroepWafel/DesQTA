<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { PencilSquare, Trash, Star, ArrowUturnLeft, PaperClip } from 'svelte-hero-icons';
  import type { Message, MessageFile } from '../types';
  import { sanitizeHtmlAsync } from '../../../utils/sanitization';
  import { onMount, tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { buildIframeHtml } from '../utils/iframeHtml';
  import { theme } from '../../../lib/stores/theme';

  let {
    selectedMessage,
    selectedFolder,
    detailLoading,
    detailError,
    openCompose,
    starMessage,
    deleteMessage,
    restoreMessage,
    starring,
    deleting,
    restoring,
    embedded = false,
  } = $props<{
    selectedMessage: Message | null;
    selectedFolder: string;
    detailLoading: boolean;
    detailError: string | null;
    openCompose: () => void;
    starMessage: (msg: Message) => Promise<void>;
    deleteMessage: (msg: Message) => Promise<void>;
    restoreMessage: (msg: Message) => Promise<void>;
    starring: boolean;
    deleting: boolean;
    restoring: boolean;
    embedded?: boolean;
  }>();

  let iframe: HTMLIFrameElement | null = $state(null);
  let detailAvatarUrl: string | null = $state(null);
  let detailAvatarFailed: boolean = $state(false);
  let messageListenerCleanup: (() => void) | null = null; // Not reactive to avoid infinite loops
  let seqtaBaseUrl: string | null = $state(null);

  function initial(name: string): string {
    return (name?.trim()?.charAt(0) || '?').toUpperCase();
  }

  async function loadSeqtaBaseUrl() {
    try {
      seqtaBaseUrl = await invoke<string>('get_seqta_base_url');
    } catch (e) {
      console.error('Failed to get SEQTA base URL:', e);
    }
  }

  function formatArticleDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatFileSize(size: string): string {
    const bytes = parseInt(size, 10);
    if (isNaN(bytes)) return size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function openAttachment(file: MessageFile) {
    if (!seqtaBaseUrl) {
      await loadSeqtaBaseUrl();
    }
    if (seqtaBaseUrl) {
      const url = `${seqtaBaseUrl}/seqta/student/load/file?type=message&file=${file.uuid}`;
      await openUrl(url);
    }
  }

  async function loadDetailAvatar() {
    detailAvatarUrl = null;
    detailAvatarFailed = false;
    const uuid = selectedMessage?.senderPhoto?.trim();
    if (!uuid) return;
    try {
      const imgBase64 = await invoke<string>('get_seqta_file', {
        fileType: 'photo',
        uuid: uuid,
      });
      if (imgBase64) {
        detailAvatarUrl = `data:image/png;base64,${imgBase64}`;
      } else {
        detailAvatarFailed = true;
      }
    } catch (e) {
      detailAvatarFailed = true;
    }
  }

  async function updateIframeContent() {
    if (!selectedMessage || !iframe || !iframe.contentWindow) return;

    // Use async Rust-side sanitization for better performance
    const sanitizedContent = await sanitizeHtmlAsync(selectedMessage.body);
    const html = buildIframeHtml(sanitizedContent);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(adjustIframeHeight, 100);
  }

  // Set up message listener for link clicks from iframe
  // Only set up once to avoid infinite loops
  let listenerSetup = false;
  function setupMessageListener() {
    // Only set up once
    if (listenerSetup) return;

    // Clean up previous listener if it exists
    if (messageListenerCleanup) {
      messageListenerCleanup();
      messageListenerCleanup = null;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'openUrl' && event.data?.url) {
        try {
          await openUrl(event.data.url);
        } catch (error) {
          console.error('Failed to open URL:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    messageListenerCleanup = () => {
      window.removeEventListener('message', handleMessage);
      listenerSetup = false;
    };
    listenerSetup = true;
  }

  function adjustIframeHeight() {
    if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;

    const height = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = `${height + 32}px`;
  }

  $effect(() => {
    if (selectedMessage && iframe) {
      void updateIframeContent();
    }
    // Load avatar whenever selectedMessage changes
    void loadDetailAvatar();
  });

  // Update iframe content when theme changes
  $effect(() => {
    // Access theme store to track changes
    theme;
    if (selectedMessage && iframe) {
      void updateIframeContent();
    }
  });

  onMount(() => {
    // Set up message listener once on mount
    setupMessageListener();
    // Load SEQTA base URL
    loadSeqtaBaseUrl();

    let resizeObserver: ResizeObserver | null = null;
    let observedEl: HTMLIFrameElement | null = null;

    // Defer observer setup so iframe bind:this is populated (rAF avoids ResizeObserver loop errors)
    const setupObserver = async () => {
      await tick();
      if (window.ResizeObserver && iframe) {
        observedEl = iframe;
        let rafId: number | null = null;
        resizeObserver = new ResizeObserver(() => {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            if (observedEl) adjustIframeHeight();
            rafId = null;
          });
        });
        resizeObserver.observe(iframe);
      }
    };
    void setupObserver();

    return () => {
      if (resizeObserver && observedEl) {
        resizeObserver.unobserve(observedEl);
      }
      if (messageListenerCleanup) {
        messageListenerCleanup();
      }
    };
  });
</script>

<main class="flex flex-col flex-1 py-2 overflow-y-auto h-full [scrollbar-gutter:stable]">
  {#if selectedMessage}
    <div class="w-full min-w-0 animate-fadeIn">
      <div
        class={embedded
          ? ''
          : 'overflow-hidden rounded-xl border shadow-lg backdrop-blur-xs border-zinc-300/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/40'}>
        <div
          class={embedded
            ? 'px-6 sm:px-8 pt-6 pb-6 sm:pt-8 sm:pb-8'
            : 'p-4 pb-3 border-b sm:p-6 border-zinc-300/50 dark:border-zinc-800/50'}>
          {#if embedded}
            <!-- Article-style header for RSS -->
            <header class="space-y-5">
              <h1
                class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white leading-tight tracking-tight">
                {selectedMessage.subject}
              </h1>
              <div
                class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                <span class="font-medium text-zinc-600 dark:text-zinc-300"
                  >{selectedMessage.sender}</span>
                <span class="text-zinc-400 dark:text-zinc-500" aria-hidden="true">·</span>
                <time datetime={selectedMessage.date} class="tabular-nums">
                  {formatArticleDate(selectedMessage.date)}
                </time>
              </div>
              <div class="h-px bg-zinc-200/60 dark:bg-zinc-700/50" role="presentation"></div>
            </header>
          {:else}
            <div
              class="mb-3 text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl leading-tight">
              {selectedMessage.subject}
            </div>

            <div class="flex flex-col gap-4 justify-between items-start sm:flex-row sm:items-end">
              <div class="flex items-start gap-3">
                <div class="shrink-0">
                  {#if detailAvatarUrl && !detailAvatarFailed}
                    <img
                      src={detailAvatarUrl}
                      alt={`Avatar of ${selectedMessage.sender}`}
                      class="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800"
                      onerror={() => (detailAvatarFailed = true)} />
                  {:else}
                    <div
                      class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300">
                      <span class="text-lg font-bold sm:text-lg"
                        >{initial(selectedMessage.sender)}</span>
                    </div>
                  {/if}
                </div>
                <div class="space-y-1">
                  <div class="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                    <span class="font-medium text-zinc-700 dark:text-zinc-200"
                      >{selectedMessage.sender}</span>
                  </div>
                  <div class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    To: <span class="font-medium text-zinc-700 dark:text-zinc-300"
                      >{selectedMessage.to}</span>
                  </div>
                </div>
              </div>

              <div class="flex gap-2 items-center sm:gap-3">
                {#if selectedFolder === 'Trash'}
                  <button
                    class="flex flex-col justify-center items-center p-1.5 rounded-lg transition-all duration-200 hover:bg-green-400/20 focus:bg-green-400/30 focus:ring-2 focus:ring-green-400/30 focus:outline-hidden"
                    title="Restore"
                    onclick={() => selectedMessage && restoreMessage(selectedMessage)}
                    disabled={restoring}>
                    {#if restoring}
                      <div
                        class="w-4 h-4 rounded-full border-2 animate-spin border-green-400/30 border-t-green-400">
                      </div>
                    {:else}
                      <Icon src={ArrowUturnLeft} class="mb-0.5 w-4 h-4 text-green-400" />
                    {/if}
                    <span class="text-xs font-medium text-green-400 sm:text-sm">Restore</span>
                  </button>
                {:else if selectedFolder === 'Starred'}
                  <button
                    class="flex justify-center items-center w-8 h-8 rounded-full transition-all duration-200 sm:w-9 sm:h-9 hover:bg-yellow-400/20 focus:bg-yellow-400/30 focus:ring-2 focus:ring-yellow-400/30 focus:outline-hidden"
                    title="Unstar"
                    onclick={() => selectedMessage && starMessage(selectedMessage)}
                    disabled={starring || !selectedMessage.starred}>
                    {#if starring}
                      <div
                        class="w-5 h-5 rounded-full border-2 animate-spin border-yellow-400/30 border-t-yellow-400">
                      </div>
                    {:else}
                      <Icon src={Star} class="w-5 h-5 text-yellow-400" solid={true} />
                    {/if}
                  </button>
                {:else}
                  <button
                    class="flex justify-center items-center w-8 h-8 rounded-full transition-all duration-200 sm:w-9 sm:h-9 hover:bg-yellow-400/20 focus:bg-yellow-400/30 focus:ring-2 focus:ring-yellow-400/30 focus:outline-hidden"
                    title="Star"
                    onclick={() => selectedMessage && starMessage(selectedMessage)}
                    disabled={starring || selectedMessage.starred}>
                    {#if starring}
                      <div
                        class="w-5 h-5 rounded-full border-2 animate-spin border-yellow-400/30 border-t-yellow-400">
                      </div>
                    {:else}
                      <Icon src={Star} class="w-5 h-5 text-yellow-400" />
                    {/if}
                  </button>
                {/if}

                <button
                  class="flex justify-center items-center w-8 h-8 rounded-full transition-all duration-200 sm:w-9 sm:h-9 hover:bg-red-400/20 focus:bg-red-400/30 focus:ring-2 focus:ring-red-400/30 focus:outline-hidden"
                  title="Delete"
                  onclick={() => selectedMessage && deleteMessage(selectedMessage)}
                  disabled={deleting}>
                  {#if deleting}
                    <div
                      class="w-5 h-5 rounded-full border-2 animate-spin border-red-400/30 border-t-red-400">
                    </div>
                  {:else}
                    <Icon src={Trash} class="w-5 h-5 text-red-400" />
                  {/if}
                </button>

                <button
                  class="flex justify-center items-center w-8 h-8 rounded-full transition-all duration-200 sm:w-9 sm:h-9 hover:bg-accent-400/20 focus:bg-accent-400/30 focus:ring-2 focus:ring-accent-400/30 focus:outline-hidden"
                  title="Reply"
                  onclick={openCompose}>
                  <Icon src={PencilSquare} class="w-5 h-5 text-accent-400" />
                </button>
              </div>
            </div>
          {/if}
        </div>

        <div
          class={embedded
            ? 'px-6 sm:px-8 pt-2 pb-8 sm:pb-12 flex-1 min-h-0 overflow-y-auto'
            : 'p-4 sm:p-6'}>
          {#if detailLoading}
            <div class="flex justify-center items-center py-12">
              <div
                class="w-8 h-8 rounded-full border-4 animate-spin sm:w-10 sm:h-10 border-accent-500/30 border-t-accent-500">
              </div>
            </div>
          {:else if detailError}
            <div class="flex justify-center items-center py-12 text-red-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="mr-2 w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm sm:text-base">{detailError}</span>
            </div>
          {:else}
            {#if selectedMessage.files && selectedMessage.files.length > 0}
              <div class="mb-4 pb-4 border-b border-zinc-300/50 dark:border-zinc-800/50">
                <div class="flex items-center gap-2 mb-3">
                  <Icon src={PaperClip} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Attachments ({selectedMessage.files.length})
                  </span>
                </div>
                <div class="space-y-2">
                  {#each selectedMessage.files as file}
                    <button
                      class="flex items-center gap-3 w-full p-3 rounded-lg border border-zinc-300/50 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-all duration-200 hover:shadow-md text-left"
                      onclick={() => openAttachment(file)}
                      title="Click to open attachment">
                      <div
                        class="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                        <Icon src={PaperClip} class="w-5 h-5 text-accent-500" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {file.filename}
                        </div>
                        <div class="text-xs text-zinc-600 dark:text-zinc-400">
                          {formatFileSize(file.size)} • {file.mimetype}
                        </div>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
            <iframe
              bind:this={iframe}
              class="w-full border-0"
              sandbox="allow-same-origin allow-scripts"
              title="Message content"></iframe>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div
      class="flex flex-col justify-center items-center h-full text-center text-zinc-600 dark:text-zinc-400">
      <div
        class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full bg-accent/10 text-accent-600 dark:text-accent-400 text-2xl sm:text-3xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-8 h-8 sm:w-10 sm:h-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p class="mt-4 text-sm sm:text-base">Select a message to view its contents.</p>
    </div>
  {/if}
</main>
