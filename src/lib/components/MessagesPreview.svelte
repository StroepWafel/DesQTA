<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Icon } from 'svelte-hero-icons';
  import { ArrowPath, PencilSquare, User, ChatBubbleLeftRight } from 'svelte-hero-icons';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';
  import { invoke } from '@tauri-apps/api/core';
  import T from './T.svelte';
  import { _ } from '../../lib/i18n';
  import WidgetCard from './dashboard/WidgetCard.svelte';

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

<WidgetCard
  icon={ChatBubbleLeftRight}
  title={$_('navigation.messages') || 'Messages'}
  {loading}
  empty={!loading && !error && items.length === 0}
  emptyTitle={$_('dashboard.no_messages') || 'No recent messages'}
  emptyIcon={ChatBubbleLeftRight}>
  {#snippet headerAction()}
    <div class="flex items-center gap-1">
      <button
        class="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
        onclick={fetchMessages}
        aria-label={$_('dashboard.refresh_messages') || 'Refresh messages'}
        title={$_('common.refresh') || 'Refresh'}>
        <Icon src={ArrowPath} class="w-4 h-4" />
      </button>
      <button
        class="inline-flex items-center justify-center w-8 h-8 rounded-md bg-accent-500 text-white hover:bg-accent-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
        onclick={composeMessage}
        aria-label={$_('dashboard.compose_message') || 'Compose message'}
        title={$_('dashboard.compose') || 'Compose'}>
        <Icon src={PencilSquare} class="w-4 h-4" />
      </button>
    </div>
  {/snippet}

  {#if error}
    <div class="flex items-center justify-center h-full text-sm text-destructive">
      {error}
    </div>
  {:else}
    <div class="h-full overflow-y-auto -mx-1 px-1 divide-y divide-border-subtle">
      {#each items as m}
        <button
          class="w-full text-left group py-1.5 px-2 rounded-none transition-colors duration-150 border-0 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 {m.unread ? 'bg-accent-500/8' : ''}"
          onclick={() => openMessage(m.id)}
          title={m.subject}>
          <div class="flex items-center gap-2.5">
            <div class="shrink-0">
              {#if avatars[m.id] && avatars[m.id] !== null}
                <img
                  src={avatars[m.id]}
                  alt={`Avatar of ${m.from || 'Unknown'}`}
                  class="w-8 h-8 rounded-full object-cover bg-surface-muted"
                  onerror={() => { avatars[m.id] = null; }} />
              {:else}
                <div class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-muted text-muted-foreground">
                  <Icon src={User} class="w-3.5 h-3.5" />
                </div>
              {/if}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-medium text-sm text-foreground truncate leading-tight">
                    {m.from || 'Unknown Sender'}
                  </span>
                  {#if m.unread}
                    <span class="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0"></span>
                  {/if}
                </div>
                <span class="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap nums-tabular leading-tight">
                  {formatDate(m.timestamp || '')}
                </span>
              </div>

              <div class="text-xs text-muted-foreground truncate leading-tight">
                {m.subject}
                {#if m.attachments}
                  <span class="ml-1 inline-block align-middle text-muted-foreground/80">@</span>
                {/if}
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</WidgetCard>
