<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { LoadingSpinner, EmptyState, Button } from '$lib/components/ui';
  import { Icon, ChatBubbleBottomCenterText, ExclamationTriangle, ChevronLeft, PaperAirplane, Users, MagnifyingGlass, ChevronDown, ChevronUp } from 'svelte-hero-icons';
  import Editor from '../../../components/Editor/Editor.svelte';
  import GoalsToolbar from '../../goals/components/GoalsToolbar.svelte';
  import { Editor as TipTapEditor } from '@tiptap/core';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { logger } from '../../../utils/logger';

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
  }

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

  const forumId = $derived($page.params.id);

  // Filtered and sorted messages
  const filteredMessages = $derived(
    (forumData?.messages || [])
      .filter(msg => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const matchesName = msg.name.toLowerCase().includes(query);
        const matchesContent = msg.contents.toLowerCase().includes(query);
        return matchesName || matchesContent;
      })
      .sort((a, b) => {
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
      })
  );

  function initial(name: string): string {
    return (name?.trim()?.charAt(0) || '?').toUpperCase();
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
      } else {
        error = 'Invalid response format';
        logger.error('forums', 'loadForum', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('forums', 'loadForum', `Failed to load forum: ${e}`, { error: e });
    } finally {
      loading = false;
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
        error = 'Failed to send reply';
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

  // Auto-scroll to reply box when forum loads
  $effect(() => {
    if (forumData && scrollContainer && replySection) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        replySection?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  });

  onMount(() => {
    loadForum();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
    <div class="flex items-center gap-4">
      <button
        onclick={() => goto('/forums')}
        class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={ChevronLeft} class="w-5 h-5" />
      </button>
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
        {forumData?.title || $_('forums.loading') || 'Loading...'}
      </h1>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-y-auto" bind:this={scrollContainer}>
    {#if loading}
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
      <div class="max-w-4xl mx-auto p-6 space-y-6">
        <!-- Forum Info -->
        {#if forumData.greeting}
          <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div class="prose prose-zinc dark:prose-invert max-w-none">
              {@html forumData.greeting}
            </div>
          </div>
        {/if}

        <!-- Filters and Sort -->
        <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 mb-4">
          <div class="flex flex-wrap gap-3 items-center w-full sm:w-auto">
            <!-- Search -->
            <div class="relative flex-1 sm:flex-none sm:w-64">
              <input
                class="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder={$_('forums.search_messages_placeholder') || 'Search messages...'}
                bind:value={searchQuery} />
              <Icon src={MagnifyingGlass} class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>
          </div>

          <div class="flex gap-3 items-center w-full sm:w-auto">
            <!-- Sort By -->
            <select
              bind:value={sortBy}
              class="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent text-sm">
              <option value="recent">{$_('forums.sort_recent_first') || 'Most recent first'}</option>
              <option value="oldest">{$_('forums.sort_oldest_first') || 'Oldest first'}</option>
              <option value="author">{$_('forums.sort_by_author') || 'By author'}</option>
            </select>
          </div>
        </div>

        <!-- Messages -->
        <div class="space-y-4">
          {#if filteredMessages.length === 0}
            <div class="text-center py-8 text-zinc-500 dark:text-zinc-400">
              <T key="forums.no_messages_match" fallback="No messages match your search." />
            </div>
          {:else}
            {#each filteredMessages as message}
            <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div class="flex gap-4">
                <!-- Avatar -->
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300">
                    <span class="text-sm font-semibold">{initial(message.name)}</span>
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-zinc-900 dark:text-white">
                      {message.name}
                    </span>
                    <span class="text-sm text-zinc-600 dark:text-zinc-400">
                      {formatDate(message.sent)}
                    </span>
                  </div>
                  <div class="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
                    {@html message.contents}
                  </div>
                </div>
              </div>
            </div>
            {/each}
          {/if}
        </div>

        <!-- Reply Section -->
        <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700" bind:this={replySection}>
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            <T key="forums.add_reply" fallback="Add Reply" />
          </h3>
          
          <div class="space-y-4">
            <div class="min-h-[200px] border border-zinc-200 dark:border-zinc-700 rounded-lg">
              {#if editorInstance}
                <GoalsToolbar bind:editor={editorInstance} onSave={sendReply} saving={sending} />
              {/if}
              <Editor bind:content={replyContent} bind:editorInstance={editorInstance} />
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

