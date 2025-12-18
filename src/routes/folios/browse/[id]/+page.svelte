<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import { Icon, ChevronLeft, ExclamationTriangle, User, Clock, PaperAirplane } from 'svelte-hero-icons';
  import Editor from '../../../../components/Editor/Editor.svelte';
  import GoalsToolbar from '../../../goals/components/GoalsToolbar.svelte';
  import { Editor as TipTapEditor } from '@tiptap/core';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../../lib/i18n';
  import { logger } from '../../../../utils/logger';

  interface FolioDetail {
    forum?: number;
    contents: string;
    created: string;
    allow_comments: boolean;
    author: {
      name: string;
      photo: string;
      id: number;
    };
    files: any[];
    id: number;
    published?: string;
    title: string;
    updated: string;
  }

  interface ForumMessage {
    firstname: string;
    inCampus: boolean;
    part: number;
    photo: string;
    staff?: number;
    uuid: string;
    sent: string;
    contents: string;
    surname: string;
    name: string;
    prefname: string;
    id: number;
    staffID?: number;
    student?: number;
    comments?: ForumComment[];
    read?: number;
  }

  interface ForumComment {
    firstname: string;
    read: number;
    student?: number;
    photo: string;
    title: string;
    uuid: string;
    sent: string;
    studentID: number;
    participantID: number;
    contents: string;
    surname: string;
    name: string;
    prefname: string;
    id: number;
  }

  interface ForumDetail {
    assessment: number;
    owner_id: number;
    folio: number;
    folio_owner: number;
    students: number[];
    messages: ForumMessage[];
    staff: number[];
    id: number;
    title: string;
    contacts: number[];
    ts: string;
  }

  let folioData: FolioDetail | null = $state(null);
  let forumData: ForumDetail | null = $state(null);
  let loading = $state(true);
  let loadingComments = $state(false);
  let error: string | null = $state(null);
  let replyContent = $state('');
  let editorInstance: TipTapEditor | null = $state(null);
  let sending = $state(false);
  let replySection: HTMLElement | null = $state(null);

  const folioId = $derived($page.params.id);

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

  async function loadFolio() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'load', id: parseInt(folioId || '0') },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        folioData = data.payload;
        
        // Load forum comments if folio has a forum ID and allows comments
        if (folioData.forum && folioData.allow_comments) {
          await loadForumComments(folioData.forum);
        }
      } else {
        error = 'Invalid response format';
        logger.error('folios', 'loadFolio', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('folios', 'loadFolio', `Failed to load folio: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function loadForumComments(forumId: number) {
    loadingComments = true;
    try {
      const response = await seqtaFetch('/seqta/student/load/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'normal', id: forumId.toString() },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        forumData = data.payload;
      }
    } catch (e) {
      logger.error('folios', 'loadForumComments', `Failed to load forum comments: ${e}`, { error: e });
    } finally {
      loadingComments = false;
    }
  }

  // Flatten messages and comments into a single list for display
  const allComments = $derived(() => {
    if (!forumData?.messages) return [];
    const result: Array<(ForumMessage | ForumComment) & { isComment?: boolean; parentId?: number }> = [];
    
    for (const message of forumData.messages) {
      result.push(message);
      if (message.comments && message.comments.length > 0) {
        for (const comment of message.comments) {
          result.push({ ...comment, isComment: true, parentId: message.id });
        }
      }
    }
    
    return result.sort((a, b) => {
      const dateA = new Date(a.sent).getTime();
      const dateB = new Date(b.sent).getTime();
      return dateA - dateB;
    });
  });

  async function sendReply() {
    if (!folioData?.forum || !editorInstance || sending) return;

    const content = editorInstance.getHTML();
    
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
          forum: folioData.forum.toString(),
          contents: content,
          resources: [],
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200') {
        editorInstance.commands.clearContent();
        replyContent = '';
        
        // Reload comments
        await loadForumComments(folioData.forum!);
        
        // Scroll to bottom after reload
        setTimeout(() => {
          replySection?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 200);
        
        try {
          const { toastStore } = await import('../../../../lib/stores/toast');
          toastStore.success($_('forums.reply_sent') || 'Reply sent successfully');
        } catch {
          // Toast store not available, skip
        }
      }
    } catch (e) {
      logger.error('folios', 'sendReply', `Failed to send reply: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../../lib/stores/toast');
        toastStore.error($_('forums.reply_error') || 'Failed to send reply');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      sending = false;
    }
  }

  onMount(() => {
    loadFolio();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
    <div class="flex items-center gap-4">
      <button
        onclick={() => goto('/folios/browse')}
        class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={ChevronLeft} class="w-5 h-5" />
      </button>
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
        {folioData?.title || $_('folios.loading') || 'Loading...'}
      </h1>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex justify-center items-center h-64">
        <LoadingSpinner size="md" message={$_('folios.loading') || 'Loading folio...'} />
      </div>
    {:else if error}
      <div class="flex justify-center items-center h-64">
        <EmptyState
          title={$_('folios.error_loading') || 'Error loading folio'}
          message={error}
          icon={ExclamationTriangle}
          size="md" />
      </div>
    {:else if folioData}
      <div class="max-w-4xl mx-auto p-6 space-y-6">
        <!-- Folio Info -->
        <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div class="flex items-center gap-4 mb-4">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300">
                <span class="text-lg font-semibold">{initial(folioData.author.name)}</span>
              </div>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <Icon src={User} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                <span class="font-semibold text-zinc-900 dark:text-white">{folioData.author.name}</span>
              </div>
              <div class="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                <div class="flex items-center gap-2">
                  <Icon src={Clock} class="w-4 h-4" />
                  <span>
                    <T key="folios.created" fallback="Created" />: {formatDate(folioData.created)}
                  </span>
                </div>
                {#if folioData.published}
                  <div class="flex items-center gap-2">
                    <Icon src={Clock} class="w-4 h-4" />
                    <span>
                      <T key="folios.published" fallback="Published" />: {formatDate(folioData.published)}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Folio Content -->
        <div class="p-6 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div class="prose prose-zinc dark:prose-invert max-w-none">
            {@html folioData.contents}
          </div>
        </div>

        <!-- Comments Section -->
        {#if folioData.allow_comments && folioData.forum}
          <div class="space-y-4">
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-white">
              <T key="folios.comments" fallback="Comments" />
            </h2>

            {#if loadingComments}
              <div class="flex justify-center items-center py-8">
                <LoadingSpinner size="sm" message={$_('folios.loading_comments') || 'Loading comments...'} />
              </div>
            {:else if forumData && allComments().length > 0}
              <div class="space-y-4">
                {#each allComments() as comment}
                  <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 {comment.isComment ? 'ml-8 border-l-4 border-l-accent' : ''}">
                    <div class="flex gap-4">
                      <div class="flex-shrink-0">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300">
                          <span class="text-sm font-semibold">{initial(comment.name)}</span>
                        </div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-2">
                          <span class="font-semibold text-zinc-900 dark:text-white">
                            {comment.name}
                          </span>
                          <span class="text-sm text-zinc-600 dark:text-zinc-400">
                            {formatDate(comment.sent)}
                          </span>
                        </div>
                        <div class="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300">
                          {@html comment.contents}
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else if forumData && allComments().length === 0}
              <div class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                <T key="folios.no_comments" fallback="No comments yet. Be the first to comment!" />
              </div>
            {/if}

            <!-- Reply Section -->
            {#if folioData.allow_comments}
              <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700" bind:this={replySection}>
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  <T key="folios.add_comment" fallback="Add Comment" />
                </h3>
                
                <div class="space-y-4">
                  {#if editorInstance}
                    <GoalsToolbar editor={editorInstance} readonly={false} saving={sending} onSave={sendReply} />
                  {/if}
                  
                  <div class="min-h-[200px] border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <Editor bind:content={replyContent} bind:editorInstance={editorInstance} />
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

