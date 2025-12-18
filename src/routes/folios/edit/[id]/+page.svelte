<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import { Icon, ChevronLeft, ExclamationTriangle, XMark, PencilSquare, Check, GlobeAlt, EyeSlash } from 'svelte-hero-icons';
  import Editor from '../../../../components/Editor/Editor.svelte';
  import GoalsToolbar from '../../../goals/components/GoalsToolbar.svelte';
  import { Editor as TipTapEditor } from '@tiptap/core';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../../lib/i18n';
  import { logger } from '../../../../utils/logger';

  interface FolioDetail {
    forum?: {
      assessment: number;
      owner_id: number;
      folio: number;
      folio_owner: number;
      students: number[];
      id: number;
      title: string;
      closed?: boolean;
    };
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
    title: string;
    updated: string;
    tags?: string[];
    published?: string | null;
  }

  let folioData: FolioDetail | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let content = $state('');
  let title = $state('');
  let tags: string[] = $state([]);
  let newTag = $state('');
  let allowComments = $state(true);
  let published: string | null = $state(null);
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

  let editorInstance: TipTapEditor | null = $state(null);
  let saving = $state(false);
  let publishing = $state(false);
  let forumData: ForumDetail | null = $state(null);
  let loadingComments = $state(false);
  let commentContent = $state('');
  let commentEditorInstance: TipTapEditor | null = $state(null);
  let sendingComment = $state(false);
  let commentReplySection: HTMLElement | null = $state(null);

  const folioId = $derived($page.params.id);

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      tags = [...tags, newTag.trim()];
      newTag = '';
    }
  }

  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }

  async function loadFolio() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'adminLoad', id: parseInt(folioId || '0') },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        folioData = data.payload;
        content = folioData.contents || '';
        title = folioData.title || '';
        tags = folioData.tags || [];
        allowComments = folioData.allow_comments ?? true;
        published = folioData.published || null;
        
        // Load forum comments if folio has a forum ID and allows comments
        if (folioData.forum?.id && folioData.allow_comments) {
          await loadForumComments(folioData.forum.id);
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

  // Set editor content when both editor and folio data are ready
  let contentInitialized = $state(false);
  
  $effect(() => {
    if (editorInstance && folioData?.contents && !contentInitialized) {
      const currentContent = editorInstance.getHTML();
      // Only set if editor is empty or just has empty paragraph
      if (!currentContent || currentContent === '<p></p>' || currentContent.trim() === '') {
        editorInstance.commands.setContent(folioData.contents, false);
        contentInitialized = true;
      }
    }
  });

  function prepareSaveData() {
    if (!folioData || !editorInstance) return null;

    const folioContent = editorInstance.getHTML();

    return {
      forum: folioData.forum ? {
        assessment: folioData.forum.assessment || 0,
        owner_id: folioData.forum.owner_id || 0,
        folio: folioData.id,
        folio_owner: folioData.forum.folio_owner || 1,
        students: folioData.forum.students || [],
        id: folioData.forum.id || 0,
        title: title,
        closed: folioData.forum.closed ?? false,
      } : {
        assessment: 0,
        owner_id: 0,
        folio: folioData.id,
        folio_owner: 1,
        students: [],
        id: 0,
        title: title,
        closed: false,
      },
      contents: folioContent,
      created: folioData.created,
      allow_comments: allowComments,
      author: folioData.author,
      files: folioData.files || [],
      id: folioData.id,
      title: title,
      updated: folioData.updated,
      tags: tags,
      published: published,
    };
  }

  async function saveFolio() {
    if (!folioData || !editorInstance || saving) return;

    saving = true;
    try {
      const saveData = prepareSaveData();
      if (!saveData) return;

      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'adminSave',
          data: saveData,
        },
      });

      const responseData = typeof response === 'string' ? JSON.parse(response) : response;

      if (responseData.status === '200') {
        // Update local data
        if (folioData) {
          folioData.title = title;
          folioData.tags = tags;
          folioData.contents = editorInstance.getHTML();
          folioData.allow_comments = allowComments;
          folioData.published = published;
        }

        // Show success toast if available
        try {
          const { toastStore } = await import('../../../../lib/stores/toast');
          toastStore.success($_('folios.saved') || 'Folio saved successfully');
        } catch {
          // Toast store not available, skip
        }
      } else {
        throw new Error('Failed to save folio');
      }
    } catch (e) {
      logger.error('folios', 'saveFolio', `Failed to save folio: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../../lib/stores/toast');
        toastStore.error($_('folios.save_error') || 'Failed to save folio');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      saving = false;
    }
  }

  async function togglePublish() {
    if (!folioData || !editorInstance || publishing) return;

    publishing = true;
    const previousPublished = published;
    try {
      // Toggle published state - if published, set to null, otherwise set to current timestamp
      published = published ? null : new Date().toISOString().replace('T', ' ').substring(0, 19) + '.0';

      // Save immediately when publishing/unpublishing
      await saveFolio();
    } catch (e) {
      logger.error('folios', 'togglePublish', `Failed to toggle publish: ${e}`, { error: e });
      // Revert published state on error
      published = previousPublished;
      try {
        const { toastStore } = await import('../../../../lib/stores/toast');
        toastStore.error($_('folios.publish_error') || 'Failed to publish/unpublish folio');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      publishing = false;
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

  async function sendComment() {
    if (!folioData?.forum?.id || !commentEditorInstance || sendingComment) return;

    const content = commentEditorInstance.getHTML();
    
    if (!content || content.trim() === '' || content.trim() === '<p></p>') {
      return;
    }

    sendingComment = true;
    try {
      const response = await seqtaFetch('/seqta/student/save/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'message',
          forum: folioData.forum.id.toString(),
          contents: content,
          resources: [],
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200') {
        commentEditorInstance.commands.clearContent();
        commentContent = '';
        
        // Reload comments
        await loadForumComments(folioData.forum.id);
        
        // Scroll to bottom after reload
        setTimeout(() => {
          commentReplySection?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 200);
        
        try {
          const { toastStore } = await import('../../../../lib/stores/toast');
          toastStore.success($_('forums.reply_sent') || 'Comment sent successfully');
        } catch {
          // Toast store not available, skip
        }
      }
    } catch (e) {
      logger.error('folios', 'sendComment', `Failed to send comment: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../../lib/stores/toast');
        toastStore.error($_('forums.reply_error') || 'Failed to send comment');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      sendingComment = false;
    }
  }

  onMount(() => {
    loadFolio();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
    <div class="flex items-center gap-4 flex-1">
      <button
        onclick={() => goto('/folios/edit')}
        class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={ChevronLeft} class="w-5 h-5" />
      </button>
      <div class="flex items-center gap-2 flex-1">
        <Icon src={PencilSquare} class="w-5 h-5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
        <input
          type="text"
          bind:value={title}
          placeholder={$_('folios.title_placeholder') || 'Untitled folio'}
          class="flex-1 text-2xl font-bold bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
        />
      </div>
    </div>
    
    <div class="flex items-center gap-4">
      <!-- Allow Comments Checkbox -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allowComments}
          onchange={(e) => (allowComments = e.currentTarget.checked)}
          class="w-4 h-4 text-accent bg-white border-zinc-300 rounded focus:ring-accent dark:bg-zinc-700 dark:border-zinc-600" />
        <span class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
          <T key="folios.allow_comments" fallback="Allow Comments" />
        </span>
      </label>

      <!-- Publish/Unpublish Button -->
      <button
        onclick={togglePublish}
        disabled={publishing || saving || !folioData}
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 {published ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600' : 'bg-green-600 text-white hover:bg-green-700'}">
        <Icon src={published ? EyeSlash : GlobeAlt} class="w-4 h-4" />
        {publishing ? ($_('folios.publishing') || 'Publishing...') : (published ? ($_('folios.unpublish') || 'Unpublish') : ($_('folios.publish') || 'Publish'))}
      </button>

      <!-- Save Button -->
      <button
        onclick={saveFolio}
        disabled={saving || publishing || !folioData}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white transition-all duration-200 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={Check} class="w-4 h-4" />
        {saving ? $_('common.saving') || 'Saving...' : $_('common.save') || 'Save'}
      </button>
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
      <div class="max-w-6xl mx-auto p-6 space-y-6">
        <!-- Tags Section -->
        <div class="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            <T key="folios.tags" fallback="TAGS" />
          </label>
          
          <div class="flex flex-wrap gap-2 mb-3">
            {#each tags as tag}
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded-lg text-sm">
                {tag}
                <button
                  type="button"
                  onclick={() => removeTag(tag)}
                  class="hover:text-accent-900 dark:hover:text-accent-100 transition-colors">
                  <Icon src={XMark} class="w-3 h-3" />
                </button>
              </span>
            {/each}
          </div>
          
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={newTag}
              placeholder={$_('folios.add_tag_placeholder') || 'Add a tag...'}
              class="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              onkeydown={handleTagKeydown}
            />
            <button
              type="button"
              onclick={addTag}
              class="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
              <T key="common.add" fallback="Add" />
            </button>
          </div>
        </div>

        <!-- Editor Section -->
        <div class="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <!-- Toolbar -->
          {#if editorInstance}
            <div class="border-b border-zinc-200 dark:border-zinc-700">
              <GoalsToolbar editor={editorInstance} readonly={false} saving={false} />
            </div>
          {/if}
          <!-- Editor -->
          <div class="min-h-[600px] p-6">
            <Editor bind:content={content} bind:editorInstance={editorInstance} />
          </div>
        </div>

        <!-- Comments Section -->
        {#if allowComments && folioData.forum?.id}
          <div class="space-y-4 mt-6">
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
            {#if allowComments}
              <div class="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700" bind:this={commentReplySection}>
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  <T key="folios.add_comment" fallback="Add Comment" />
                </h3>
                
                <div class="space-y-4">
                  {#if commentEditorInstance}
                    <GoalsToolbar editor={commentEditorInstance} readonly={false} saving={sendingComment} onSave={sendComment} />
                  {/if}
                  
                  <div class="min-h-[200px] border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <Editor bind:content={commentContent} bind:editorInstance={commentEditorInstance} />
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

