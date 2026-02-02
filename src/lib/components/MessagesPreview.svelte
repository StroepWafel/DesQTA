<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { goto } from '$app/navigation';
  import { Icon } from 'svelte-hero-icons';
  import { ArrowPath, PencilSquare, User } from 'svelte-hero-icons';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';
  import { invoke } from '@tauri-apps/api/core';
  import T from './T.svelte';
  import { _ } from '../../lib/i18n';

  interface MessagePreview {
    id: string;
    subject: string;
    from?: string;
    senderPhoto?: string;
    snippet?: string;
    timestamp?: string;
    unread?: boolean;
    attachments?: boolean;
  }

  interface MessageAvatar {
    [key: string]: string | null;
  }

  let loading = $state(true);
  let error = $state('');
  let items = $state<MessagePreview[]>([]);
  let avatars = $state<MessageAvatar>({});

  async function fetchMessages() {
    loading = true;
    error = '';
    try {
      const response = await seqtaFetch('/seqta/student/load/message?', {
        method: 'POST',
        body: {
          searchValue: '',
          sortBy: 'date',
          sortOrder: 'desc',
          action: 'list',
          label: 'inbox',
          offset: 0,
          limit: 20,
          datetimeUntil: null,
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const msgs = (data?.payload?.messages || []) as any[];
      items = msgs.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: m.sender,
        senderPhoto: m.senderPhoto,
        snippet: m.subject + (m.attachments ? ' (Attachment)' : ''),
        timestamp: m.date?.replace('T', ' ').slice(0, 16) || '',
        unread: !m.read,
        attachments: !!m.attachments,
      }));

      // Load avatars for messages with senderPhoto
      await loadAvatars();

      logger.info('MessagesPreview', 'fetchMessages', 'Loaded recent messages', {
        count: items.length,
      });
    } catch (e) {
      error = 'Failed to load messages.';
      items = [];
      logger.error('MessagesPreview', 'fetchMessages', 'Failed to load messages', { error: e });
    } finally {
      loading = false;
    }
  }

  function openMessage(id: string) {
    // Navigate to direqt-messages page with messageID parameter
    goto(`/direqt-messages?messageID=${id}`);
  }

  function composeMessage() {
    // Navigate to messages page
    goto('/direqt-messages');
  }

  function initial(name: string): string {
    return (name?.trim()?.charAt(0) || '?').toUpperCase();
  }

  async function loadAvatars() {
    const avatarPromises = items
      .filter((m) => m.senderPhoto && !avatars[m.id])
      .map(async (m) => {
        try {
          const imgBase64 = await invoke<string>('get_seqta_file', {
            fileType: 'photo',
            uuid: m.senderPhoto?.trim(),
          });
          if (imgBase64) {
            avatars[m.id] = `data:image/png;base64,${imgBase64}`;
          } else {
            avatars[m.id] = null;
          }
        } catch (e) {
          avatars[m.id] = null;
        }
      });
    await Promise.all(avatarPromises);
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if date is today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Check if date is yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Check if date is within this year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Otherwise return full date
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  onMount(fetchMessages);
</script>

<div
  class="flex flex-col gap-2 sm:gap-3 h-full min-h-0 text-zinc-900 dark:text-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
  <div
    class="flex items-center justify-between shrink-0 transition-all duration-300"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: left center;">
    <h3
      class="text-base sm:text-lg font-semibold transition-all duration-300"
      in:fade={{ duration: 300, delay: 150 }}>
      <T key="navigation.messages" fallback="Messages" />
    </h3>
    <div class="flex gap-2">
      <button
        class="px-3 py-1.5 rounded-lg bg-zinc-800/80 text-white hover:bg-zinc-700/80 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onclick={fetchMessages}
        aria-label={$_('dashboard.refresh_messages') || 'Refresh messages'}
        title={$_('common.refresh') || 'Refresh'}>
        <Icon src={ArrowPath} class="w-4 h-4" />
      </button>
      <button
        class="px-3 py-1.5 rounded-lg accent-bg text-white hover:opacity-90 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onclick={composeMessage}
        aria-label={$_('dashboard.compose_message') || 'Compose message'}
        title={$_('dashboard.compose') || 'Compose'}>
        <Icon src={PencilSquare} class="w-4 h-4" />
      </button>
    </div>
  </div>

  {#if loading}
    <div
      class="flex items-center justify-center flex-1 min-h-0 py-8 text-xs sm:text-sm opacity-80 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <T key="dashboard.loading_messages" fallback="Loading messages…" />
    </div>
  {:else if error}
    <div
      class="flex items-center justify-center flex-1 min-h-0 py-8 text-xs sm:text-sm text-red-500 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      {error}
    </div>
  {:else if items.length === 0}
    <div
      class="flex items-center justify-center flex-1 min-h-0 py-8 text-xs sm:text-sm opacity-80 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <T key="dashboard.no_messages" fallback="No recent messages." />
    </div>
  {:else}
    <div
      class="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-400/30 scrollbar-track-transparent transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 400, delay: 100 }}>
      {#each items as m, i}
        <button
          class="w-full text-left group p-2 sm:p-3 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 hover:shadow-md border border-transparent hover:border-zinc-200/60 dark:hover:border-zinc-700/60 focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 backdrop-blur-sm {m.unread
            ? 'bg-accent-500/10 border-accent-500/30 shadow-sm'
            : 'bg-white/50 dark:bg-zinc-900/30'} hover:scale-[1.01] transform"
          onclick={() => openMessage(m.id)}
          title={m.subject}
          in:fade={{ duration: 300, delay: 200 + i * 50 }}
          style="transform-origin: left center;">
          <div class="flex items-start gap-3">
            <!-- Avatar -->
            <div class="shrink-0 mt-0.5">
              {#if avatars[m.id] && avatars[m.id] !== null}
                <img
                  src={avatars[m.id]}
                  alt={`Avatar of ${m.from || 'Unknown'}`}
                  class="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-300/50 dark:border-zinc-700/50"
                  onerror={() => {
                    avatars[m.id] = null;
                  }} />
              {:else}
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300 border-2 border-zinc-300/50 dark:border-zinc-700/50">
                  <Icon src={User} class="w-5 h-5" />
                </div>
              {/if}
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2 mb-1">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="font-semibold text-sm text-zinc-900 dark:text-white truncate {m.unread
                      ? 'text-accent-600 dark:text-accent-400'
                      : ''}">
                    {m.from || 'Unknown Sender'}
                  </span>
                  {#if m.unread}
                    <span class="w-2 h-2 rounded-full bg-accent-500 shrink-0"></span>
                  {/if}
                </div>
                <span class="text-xs text-zinc-500 dark:text-zinc-400 shrink-0 whitespace-nowrap">
                  {formatDate(m.timestamp || '')}
                </span>
              </div>

              <div class="flex items-center gap-2 mb-1">
                <span
                  class="font-medium text-sm text-zinc-800 dark:text-zinc-200 truncate {m.unread
                    ? 'text-accent-600 dark:text-accent-400'
                    : ''}">
                  {m.subject}
                </span>
                {#if m.attachments}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                {/if}
              </div>

              {#if m.snippet && m.snippet !== m.subject}
                <p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
                  {m.snippet.replace(/\(Attachment\)/, '')}
                </p>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
