<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { platformStore } from '$lib/stores/platform';

  let isMobile = $derived($platformStore.isMobile);
  import { seqtaFetch } from '../../../utils/netUtil';
  import { LoadingSpinner, EmptyState, Button } from '$lib/components/ui';
  import {
    Icon,
    ChatBubbleBottomCenterText,
    ExclamationTriangle,
    ChevronLeft,
    PaperAirplane,
    Users,
    MagnifyingGlass,
    ChevronDown,
    ChevronUp,
  } from 'svelte-hero-icons';
  import Editor from '../../../components/Editor/Editor.svelte';
  import GoalsToolbar from '../../goals/components/GoalsToolbar.svelte';
  import { Editor as TipTapEditor } from '@tiptap/core';
  import { get } from 'svelte/store';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { logger } from '../../../utils/logger';

  interface ForumComment {
    id: number;
    uuid: string;
    studentID: number;
    participantID: number;
    firstname: string;
    surname: string;
    name: string;
    prefname: string;
    sent: string;
    contents: string;
    read?: number;
    photo?: string;
  }

  interface ForumMessage {
    firstname: string;
    inCampus: boolean;
    part: number;
    photo: string;
    staff: number;
    uuid: string;
    sent: string;
    contents: string;
    surname: string;
    name: string;
    prefname: string;
    id: number;
    staffID: number;
    // Nested replies — SEQTA's response includes `comments[]` under each parent.
    comments?: ForumComment[];
    // Also the per-message student id we'll use to fetch comment avatars.
    student?: number;
  }

  // Cache for loaded photos - using reactive state
  let photoUrls = $state<Map<string, string>>(new Map());

  interface ForumDetail {
    owner: string;
    assessment: number;
    owner_id: number;
    greeting: string;
    students: number[];
    messages: ForumMessage[];
    staff: number[];
    id: number;
    title: string;
    contacts: number[];
    ts: string;
  }

  let forumData: ForumDetail | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let replyContent = $state('');
  let editorInstance: TipTapEditor | null = $state(null);
  let sending = $state(false);
  let scrollContainer: HTMLElement | null = $state(null);
  let replySection: HTMLElement | null = $state(null);
  let sortBy = $state<'recent' | 'oldest' | 'author'>('recent');
  let searchQuery = $state('');
  let forumsEnabled = $state<boolean | null>(null);

  const forumId = $derived($page.params.id);

  async function checkForumsEnabled() {
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const forumsPageEnabled = data?.payload?.['coneqt-s.page.forums']?.value === 'enabled';
      const forumsGreetingExists = data?.payload?.['coneqt-s.forum.greeting'] !== undefined;
      forumsEnabled = forumsPageEnabled || forumsGreetingExists;
    } catch (e) {
      logger.error('forums', 'checkForumsEnabled', `Failed to check if forums are enabled: ${e}`, {
        error: e,
      });
      forumsEnabled = false; // Default to disabled on error
    }
  }

  // Filtered and sorted messages
  const filteredMessages = $derived.by(() => {
    const messages = (forumData?.messages ?? []) as ForumMessage[];
    return messages
      .filter((msg: ForumMessage) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const matchesName = msg.name.toLowerCase().includes(query);
        const matchesContent = msg.contents.toLowerCase().includes(query);
        return matchesName || matchesContent;
      })
      .sort((a: ForumMessage, b: ForumMessage) => {
        switch (sortBy) {
          case 'recent':
            return new Date(b.sent).getTime() - new Date(a.sent).getTime();
          case 'oldest':
            return new Date(a.sent).getTime() - new Date(b.sent).getTime();
          case 'author':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
  });

  function initial(name: string): string {
    return (name?.trim()?.charAt(0) || '?').toUpperCase();
  }

  async function loadPhoto(uuid: string): Promise<string | null> {
    if (!uuid) return null;

    // Check cache first
    if (photoUrls.has(uuid)) {
      return photoUrls.get(uuid) || null;
    }

    try {
      const profileImage = await seqtaFetch(`/seqta/student/photo/get`, {
        params: { uuid: uuid.trim(), format: 'low' },
        is_image: true,
      });

      if (profileImage) {
        const dataUrl = `data:image/png;base64,${profileImage}`;
        // Update reactive state
        photoUrls = new Map(photoUrls);
        photoUrls.set(uuid, dataUrl);
        return dataUrl;
      }
    } catch (e) {
      logger.debug('forums', 'loadPhoto', `Failed to load photo for UUID ${uuid}: ${e}`, {
        error: e,
      });
    }

    return null;
  }

  // Load photos for all messages and their nested comments. Each comment has
  // its own `uuid` (which matches the parent message's uuid in SEQTA's payload,
  // since comments reuse the parent participant). We still issue a photo fetch
  // for every distinct uuid we see so future enhancements that introduce new
  // commenter UUIDs Just Work.
  async function loadMessagePhotos() {
    if (!forumData?.messages) return;

    const uuids = new Set<string>();
    for (const message of forumData.messages) {
      if (message.uuid) uuids.add(message.uuid);
      for (const c of message.comments ?? []) {
        if (c.uuid) uuids.add(c.uuid);
      }
    }
    await Promise.all(Array.from(uuids).map((u) => loadPhoto(u)));
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  async function loadForum() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/load/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'normal', id: forumId },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        forumData = data.payload;
        // Load photos for all messages
        await loadMessagePhotos();
      } else {
        error = get(_)('forums.invalid_response');
        logger.error('forums', 'loadForum', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('forums', 'loadForum', `Failed to load forum: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  // Track which message has its inline reply editor open.
  let activeReplyParent = $state<string | null>(null);
  let inlineReplyContent = $state('');
  let inlineSending = $state(false);

  /** Per-message comment reply. Posts via the same endpoint as a top-level reply
   * but includes the parent message uuid so SEQTA threads it as a comment. */
  async function sendInlineReply(parentUuid: string) {
    if (!forumData || inlineSending) return;
    const content = inlineReplyContent.trim();
    if (!content || content === '<p></p>') return;

    inlineSending = true;
    try {
      const response = await seqtaFetch('/seqta/student/save/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'message',
          forum: forumId,
          contents: content,
          resources: [],
          parent: parentUuid,
        },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (data.status === '200') {
        inlineReplyContent = '';
        activeReplyParent = null;
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.success($_('forums.reply_sent') || 'Reply sent');
        } catch {
          // toast optional
        }
        await loadForum();
      } else {
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.error($_('forums.reply_error') || 'Failed to send reply');
        } catch {
          // toast optional
        }
      }
    } catch (e) {
      logger.error('forums', 'sendInlineReply', `Failed to send inline reply: ${e}`, { error: e });
    } finally {
      inlineSending = false;
    }
  }

  async function sendReply() {
    if (!forumData || !editorInstance || sending) return;

    const content = editorInstance.getHTML();

    // Don't send if content is empty or just contains empty paragraph
    if (!content || content.trim() === '' || content.trim() === '<p></p>') {
      return;
    }

    sending = true;
    try {
      const response = await seqtaFetch('/seqta/student/save/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'message',
          forum: forumId,
          contents: content,
          resources: [],
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200') {
        // Clear editor after sending
        editorInstance.commands.clearContent();
        replyContent = '';

        // Show success toast if available
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.success($_('forums.reply_sent') || 'Reply sent successfully');
        } catch {
          // Toast store not available, skip
        }

        // Reload forum to get updated messages
        await loadForum();

        // Scroll to bottom after reload to show new message
        setTimeout(() => {
          replySection?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 200);
      } else {
        error = get(_)('forums.reply_error');
        logger.error('forums', 'sendReply', 'Failed to send reply', { data });
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.error($_('forums.reply_error') || 'Failed to send reply');
        } catch {
          // Toast store not available, skip
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('forums', 'sendReply', `Failed to send reply: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../lib/stores/toast');
        toastStore.error($_('forums.reply_error') || 'Failed to send reply');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      sending = false;
    }
  }

  // (Removed) Auto-scroll-to-reply effect: hid messages behind the reply box on
  // load. Reply input now lives at the top of the message list so users can see
  // both the reply field and the recent messages immediately.

  onMount(async () => {
    await checkForumsEnabled();
    if (forumsEnabled) {
      loadForum();
    } else {
      loading = false;
    }
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-border bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
    <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
      <button
        onclick={() => goto('/forums')}
        class="flex-shrink-0 p-2 rounded-lg transition-all duration-200 text-muted-foreground hover:text-zinc-900 dark:hover:text-white hover:surface-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={ChevronLeft} class="w-5 h-5" />
      </button>
      <h1 class="text-xl sm:text-2xl lg:text-2xl font-medium text-foreground sm:text-3xl truncate">
        {forumData?.title || $_('forums.loading') || 'Loading...'}
      </h1>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-y-auto" bind:this={scrollContainer}>
    {#if forumsEnabled === false}
      <div class="flex justify-center items-center h-64">
        <EmptyState
          title={$_('forums.not_enabled') || 'Forums not available'}
          message={$_('forums.not_enabled_message') ||
            'Forums are not enabled for your school. Please contact your administrator if you believe this is an error.'}
          icon={ChatBubbleBottomCenterText}
          size="md" />
      </div>
    {:else if loading}
      <div class="flex justify-center items-center h-64">
        <LoadingSpinner size="md" message={$_('forums.loading') || 'Loading forum...'} />
      </div>
    {:else if error}
      <div class="flex justify-center items-center h-64">
        <EmptyState
          title={$_('forums.error_loading') || 'Error loading forum'}
          message={error}
          icon={ExclamationTriangle}
          size="md" />
      </div>
    {:else if forumData}
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <!-- Forum Info -->
        {#if forumData.greeting}
          <div
            class="p-6 bg-card rounded-lg border border-border">
            <div
              class="prose prose-zinc dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-white prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-a:text-accent-600 dark:prose-a:text-accent-400 prose-a:break-words prose-p:break-words">
              {@html forumData.greeting}
            </div>
          </div>
        {/if}

        <!-- Filters and Sort -->
        <div
          class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-5 sm:p-6 bg-card rounded-lg border border-border shadow-sm">
          <div class="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            <!-- Search -->
            <div class="relative flex-1 sm:flex-none sm:w-72">
              <input
                class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-border text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder={$_('forums.search_messages_placeholder') || 'Search messages...'}
                bind:value={searchQuery} />
              <Icon
                src={MagnifyingGlass}
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            </div>
          </div>

          <div class="flex gap-3 items-center w-full sm:w-auto">
            <!-- Sort By -->
            <select
              bind:value={sortBy}
              class="px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent text-sm cursor-pointer">
              <option value="recent"
                >{$_('forums.sort_recent_first') || 'Most recent first'}</option>
              <option value="oldest">{$_('forums.sort_oldest_first') || 'Oldest first'}</option>
              <option value="author">{$_('forums.sort_by_author') || 'By author'}</option>
            </select>
          </div>
        </div>

        <!-- Reply Section sits ABOVE the messages so users can post a new reply
             at any time without scrolling past the entire thread. Matches the
             SEQTA web layout users are used to. -->
        <div
          class="p-5 sm:p-6 bg-card rounded-lg border border-border shadow-sm"
          bind:this={replySection}>
          <h3 class="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-5">
            <T key="forums.add_reply" fallback="Add Reply" />
          </h3>

          <div class="space-y-4">
            <div
              class="min-h-[160px] sm:min-h-[200px] border border-border rounded-lg overflow-hidden">
              {#if editorInstance}
                <GoalsToolbar bind:editor={editorInstance} onSave={sendReply} saving={sending} />
              {/if}
              <Editor bind:content={replyContent} bind:editorInstance />
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div class="space-y-4">
          {#if filteredMessages.length === 0}
            <div class="text-center py-8 text-muted-foreground">
              <T key="forums.no_messages_match" fallback="No messages match your search." />
            </div>
          {:else}
            {#each filteredMessages as message}
              <div
                class="p-5 sm:p-6 bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <div class="flex gap-4 sm:gap-5">
                  <!-- Avatar -->
                  <div class="flex-shrink-0">
                    {#if message.uuid && photoUrls.has(message.uuid)}
                      {@const photoUrl = photoUrls.get(message.uuid)}
                      {#if photoUrl}
                        <img
                          src={photoUrl}
                          alt={message.name}
                          class="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-border"
                          onerror={(e) => {
                            const img = e.currentTarget;
                            const fallback = document.createElement('div');
                            fallback.className =
                              'w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300 border-2 border-border';
                            fallback.innerHTML = `<span class="text-sm sm:text-base font-semibold">${initial(message.name)}</span>`;
                            img.parentNode?.replaceChild(fallback, img);
                          }} />
                      {:else}
                        <div
                          class="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300 border-2 border-border">
                          <span class="text-sm sm:text-base font-semibold"
                            >{initial(message.name)}</span>
                        </div>
                      {/if}
                    {:else}
                      <div
                        class="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300 border-2 border-border">
                        <span class="text-sm sm:text-base font-semibold"
                          >{initial(message.name)}</span>
                      </div>
                    {/if}
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0 overflow-hidden">
                    <div
                      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <span
                        class="font-semibold text-base sm:text-lg text-foreground truncate">
                        {message.name}
                      </span>
                      <span
                        class="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(message.sent)}
                      </span>
                    </div>
                    <div
                      class="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-white prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-a:text-accent-600 dark:prose-a:text-accent-400 prose-a:break-all prose-p:break-words prose-li:break-words prose-strong:text-zinc-900 dark:prose-strong:text-white prose-code:text-zinc-900 dark:prose-code:text-white prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-900">
                      {@html message.contents}
                    </div>

                    <!-- Per-message Reply toggle -->
                    <div class="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        class="text-xs uppercase tracking-[0.06em] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        onclick={() => {
                          if (activeReplyParent === message.uuid) {
                            activeReplyParent = null;
                            inlineReplyContent = '';
                          } else {
                            activeReplyParent = message.uuid;
                            inlineReplyContent = '';
                          }
                        }}>
                        {activeReplyParent === message.uuid
                          ? $_('common.cancel') || 'Cancel'
                          : $_('forums.reply') || 'Reply'}
                      </button>
                    </div>

                    <!-- Inline mini-editor for a per-message comment -->
                    {#if activeReplyParent === message.uuid}
                      <div class="mt-2 p-3 rounded-lg border border-border-subtle bg-surface-muted/60">
                        <textarea
                          bind:value={inlineReplyContent}
                          rows="3"
                          placeholder={$_('forums.write_a_reply') || 'Write a reply...'}
                          class="w-full p-2 rounded-md border border-border bg-card text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500"
                        ></textarea>
                        <div class="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            class="h-8 px-3 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground transition-colors"
                            onclick={() => {
                              activeReplyParent = null;
                              inlineReplyContent = '';
                            }}>
                            {$_('common.cancel') || 'Cancel'}
                          </button>
                          <button
                            type="button"
                            class="h-8 px-3 text-xs font-medium rounded-md bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
                            onclick={() => sendInlineReply(message.uuid)}
                            disabled={inlineSending || !inlineReplyContent.trim()}>
                            {inlineSending
                              ? $_('forums.sending') || 'Sending…'
                              : $_('forums.send_reply') || 'Send reply'}
                          </button>
                        </div>
                      </div>
                    {/if}

                    <!-- Nested comments — SEQTA threads replies under each parent. -->
                    {#if message.comments?.length}
                      <div class="mt-4 ml-4 sm:ml-8 pl-4 border-l-2 border-border-subtle space-y-3">
                        {#each message.comments as c (c.id)}
                          <div class="flex gap-3">
                            <div class="flex-shrink-0">
                              {#if c.uuid && photoUrls.has(c.uuid) && photoUrls.get(c.uuid)}
                                <img
                                  src={photoUrls.get(c.uuid)}
                                  alt={c.name}
                                  class="w-8 h-8 rounded-full object-cover border border-border" />
                              {:else}
                                <div
                                  class="w-8 h-8 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300 border border-border">
                                  <span class="text-xs font-semibold">{initial(c.name)}</span>
                                </div>
                              {/if}
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center justify-between gap-2 mb-1">
                                <span class="text-sm font-semibold text-foreground truncate">
                                  {c.name}
                                </span>
                                <span class="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {formatDate(c.sent)}
                                </span>
                              </div>
                              <div
                                class="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:text-foreground prose-a:text-accent-600 dark:prose-a:text-accent-400 prose-a:break-all prose-p:break-words">
                                {@html c.contents}
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
