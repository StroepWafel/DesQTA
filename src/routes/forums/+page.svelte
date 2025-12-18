<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import { Icon, ChatBubbleBottomCenterText, ExclamationTriangle, Users, Clock, CheckCircle, ChevronDown, ChevronUp, Folder } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';

  interface Forum {
    owner: string;
    read: number;
    unread: number;
    owner_id: number;
    closed: string | null;
    read_comments: number;
    opened: string;
    id: number;
    title: string;
    unread_comments: number;
    participants: number;
    assessment?: number;
  }

  interface ForumsResponse {
    payload: {
      forums: Forum[];
      me: string;
    };
    status: string;
  }

  let forums: Forum[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let me: string = $state('');
  let closedForumsExpanded = $state(false);

  // Separate forums into open and closed
  const openForums = $derived(forums.filter(f => !f.closed));
  const closedForums = $derived(forums.filter(f => f.closed));

  function formatDate(dateString: string | null): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  async function loadForums() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/load/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'list' },
      });

      // Parse response - could be string or already parsed
      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        forums = data.payload.forums || [];
        me = data.payload.me || '';
      } else {
        error = 'Invalid response format';
        logger.error('forums', 'loadForums', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('forums', 'loadForums', `Failed to load forums: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadForums();
  });
</script>

<div class="container px-6 py-7 mx-auto">
  <h1 class="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
    <T key="navigation.forums" fallback="Forums" />
  </h1>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <LoadingSpinner size="md" message={$_('forums.loading') || 'Loading forums...'} />
    </div>
  {:else if error}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('forums.error_loading') || 'Error loading forums'}
        message={error}
        icon={ExclamationTriangle}
        size="md" />
    </div>
  {:else if forums.length === 0}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('forums.no_forums') || 'No forums available'}
        message={$_('forums.no_forums_message') || 'There are no forums to display.'}
        icon={ChatBubbleBottomCenterText}
        size="md" />
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Open Forums -->
      {#if openForums.length > 0}
        <div>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            <T key="forums.open_forums" fallback="Open Forums" />
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each openForums as forum}
              {@render forumCard(forum)}
            {/each}
          </div>
        </div>
      {/if}

      <!-- Closed Forums -->
      {#if closedForums.length > 0}
        <div>
          <button
            onclick={() => (closedForumsExpanded = !closedForumsExpanded)}
            class="flex items-center gap-2 mb-4 text-xl font-semibold text-zinc-900 dark:text-white hover:text-accent transition-colors">
            <Icon src={closedForumsExpanded ? ChevronUp : ChevronDown} class="w-5 h-5" />
            <Icon src={Folder} class="w-5 h-5" />
            <span>
              <T key="forums.closed_forums" fallback="Closed Forums" /> ({closedForums.length})
            </span>
          </button>
          {#if closedForumsExpanded}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each closedForums as forum}
                {@render forumCard(forum)}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#snippet forumCard(forum)}
  <button
    onclick={() => goto(`/forums/${forum.id}`)}
    class="w-full text-left p-6 bg-white rounded-lg border transition-all duration-200 transform dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
    <div class="flex items-start justify-between mb-3">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white flex-1 pr-2">
        {forum.title}
      </h3>
      {#if forum.unread > 0 || forum.unread_comments > 0}
        <span
          class="flex-shrink-0 px-2 py-1 text-xs font-semibold text-white rounded-full bg-accent">
          {forum.unread + forum.unread_comments}
        </span>
      {/if}
    </div>

    <div class="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
      <div class="flex items-center gap-2">
        <Icon src={Users} class="w-4 h-4" />
        <span>{forum.owner}</span>
      </div>

      <div class="flex items-center gap-2">
        <Icon src={Users} class="w-4 h-4" />
        <span>
          {forum.participants} {$_('forums.participants') || 'participants'}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Icon src={Clock} class="w-4 h-4" />
        <span>
          {$_('forums.opened') || 'Opened'}: {formatDate(forum.opened)}
        </span>
      </div>

      {#if forum.closed}
        <div class="flex items-center gap-2">
          <Icon src={CheckCircle} class="w-4 h-4" />
          <span>
            {$_('forums.closed') || 'Closed'}: {formatDate(forum.closed)}
          </span>
        </div>
      {/if}

      <div class="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-700">
        <div class="flex items-center justify-between">
          <span>
            {forum.read_comments} {$_('forums.read_comments') || 'read'}
          </span>
          {#if forum.unread_comments > 0}
            <span class="font-semibold text-accent">
              {forum.unread_comments} {$_('forums.unread_comments') || 'unread'}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </button>
{/snippet}

