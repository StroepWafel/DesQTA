<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import {
    Icon,
    ChatBubbleBottomCenterText,
    ExclamationTriangle,
    Users,
    Clock,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Folder,
    MagnifyingGlass,
    Funnel,
  } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback } from '../../lib/services/idbCache';

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
  let forumsEnabled = $state<boolean | null>(null);

  async function checkForumsEnabled() {
    const cacheKey = 'forums_settings_enabled';
    const isOnline = navigator.onLine;

    // Load from cache first for instant UI
    const cached =
      cache.get<boolean>(cacheKey) ||
      (await getWithIdbFallback<boolean>(cacheKey, cacheKey, () => cache.get<boolean>(cacheKey)));

    if (cached !== null && cached !== undefined) {
      forumsEnabled = cached;
    }

    // Always fetch fresh data when online (even if we have cache)
    if (isOnline) {
      try {
        await fetchForumsSettings();
      } catch (e) {
        logger.error('forums', 'checkForumsEnabled', `Failed to fetch fresh settings: ${e}`, {
          error: e,
        });
        // Don't update forumsEnabled if fetch fails and we have cached data
        if (cached === null || cached === undefined) {
          forumsEnabled = false;
        }
      }
    } else if (cached === null || cached === undefined) {
      // Offline and no cache - default to disabled
      forumsEnabled = false;
    }
  }

  async function fetchForumsSettings() {
    const cacheKey = 'forums_settings_enabled';
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const forumsPageEnabled = data?.payload?.['coneqt-s.page.forums']?.value === 'enabled';
      const forumsGreetingExists = data?.payload?.['coneqt-s.forum.greeting'] !== undefined;
      const enabled = forumsPageEnabled || forumsGreetingExists;

      forumsEnabled = enabled;
      cache.set(cacheKey, enabled, 60);
      const { setIdb } = await import('../../lib/services/idbCache');
      await setIdb(cacheKey, enabled);
    } catch (e) {
      throw e;
    }
  }
  let sortBy = $state<'title' | 'owner' | 'opened' | 'participants' | 'unread'>('opened');
  let sortOrder = $state<'asc' | 'desc'>('desc');
  let filterUnread = $state(false);
  let searchQuery = $state('');

  // Separate forums into open and closed
  let openForums = $derived(
    forums
      .filter((f) => !f.closed)
      .filter((f) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesTitle = f.title.toLowerCase().includes(query);
          const matchesOwner = f.owner.toLowerCase().includes(query);
          if (!matchesTitle && !matchesOwner) return false;
        }
        // Unread filter
        if (filterUnread && f.unread === 0 && f.unread_comments === 0) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'owner':
            comparison = a.owner.localeCompare(b.owner);
            break;
          case 'opened':
            comparison = new Date(a.opened).getTime() - new Date(b.opened).getTime();
            break;
          case 'participants':
            comparison = a.participants - b.participants;
            break;
          case 'unread':
            comparison = a.unread + a.unread_comments - (b.unread + b.unread_comments);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      }),
  );

  let closedForums = $derived(
    forums
      .filter((f) => f.closed)
      .filter((f) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesTitle = f.title.toLowerCase().includes(query);
          const matchesOwner = f.owner.toLowerCase().includes(query);
          if (!matchesTitle && !matchesOwner) return false;
        }
        // Unread filter
        if (filterUnread && f.unread === 0 && f.unread_comments === 0) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'owner':
            comparison = a.owner.localeCompare(b.owner);
            break;
          case 'opened':
            comparison = new Date(a.opened).getTime() - new Date(b.opened).getTime();
            break;
          case 'participants':
            comparison = a.participants - b.participants;
            break;
          case 'unread':
            comparison = a.unread + a.unread_comments - (b.unread + b.unread_comments);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      }),
  );

  // Create unique key for forums to force re-render with animations
  const forumsKey = $derived.by(() => {
    const openIds = openForums.map((f) => f.id).join(',');
    const closedIds = closedForums.map((f) => f.id).join(',');
    return `${searchQuery}-${filterUnread}-${sortBy}-${sortOrder}-${openForums.length}-${closedForums.length}-${openIds}-${closedIds}`;
  });

  function formatDate(dateString: string | null): string {
    if (!dateString) return '';
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

  async function loadForums() {
    loading = true;
    error = null;
    const cacheKey = 'forums_list';
    const isOnline = navigator.onLine;

    // Load from cache first for instant UI
    const cached =
      cache.get<ForumsResponse['payload']>(cacheKey) ||
      (await getWithIdbFallback<ForumsResponse['payload']>(cacheKey, cacheKey, () =>
        cache.get<ForumsResponse['payload']>(cacheKey),
      ));

    if (cached && cached.forums) {
      forums = cached.forums || [];
      me = cached.me || '';
      loading = false;
    }

    // Always fetch fresh data when online (even if we have cache)
    if (isOnline) {
      try {
        await fetchForums();
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        logger.error('forums', 'loadForums', `Failed to fetch fresh forums: ${e}`, { error: e });
        // Don't update forums if fetch fails and we have cached data
        if (!cached || !cached.forums) {
          loading = false;
        }
      }
    } else if (!cached || !cached.forums) {
      // Offline and no cache
      error = 'No cached data available';
      loading = false;
    }
  }

  async function fetchForums() {
    const cacheKey = 'forums_list';
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
        cache.set(cacheKey, data.payload, 15);
        const { setIdb } = await import('../../lib/services/idbCache');
        await setIdb(cacheKey, data.payload);
        loading = false;
      } else {
        error = 'Invalid response format';
        logger.error('forums', 'fetchForums', 'Invalid response format', { data });
        loading = false;
      }
    } catch (e) {
      loading = false;
      throw e;
    }
  }

  onMount(async () => {
    await checkForumsEnabled();
    if (forumsEnabled) {
      loadForums();
    } else {
      loading = false;
    }
  });
</script>

<div class="container px-6 py-7 mx-auto">
  <h1 class="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
    <T key="navigation.forums" fallback="Forums" />
  </h1>

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
      <!-- Filters and Sort -->
      <div
        class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
        <div class="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <!-- Search -->
          <div class="relative flex-1 sm:flex-none sm:w-64">
            <input
              class="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
              placeholder={$_('forums.search_placeholder') || 'Search forums...'}
              bind:value={searchQuery} />
            <Icon
              src={MagnifyingGlass}
              class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          </div>

          <!-- Unread Filter -->
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={filterUnread}
              class="w-4 h-4 text-accent bg-white border-zinc-300 rounded focus:ring-accent dark:bg-zinc-700 dark:border-zinc-600" />
            <span class="text-sm text-zinc-700 dark:text-zinc-300">
              <T key="forums.show_unread_only" fallback="Unread only" />
            </span>
          </label>
        </div>

        <div class="flex gap-3 items-center w-full sm:w-auto">
          <!-- Sort By -->
          <select
            bind:value={sortBy}
            class="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent text-sm">
            <option value="opened">{$_('forums.sort_opened') || 'Date Opened'}</option>
            <option value="title">{$_('forums.sort_title') || 'Title'}</option>
            <option value="owner">{$_('forums.sort_owner') || 'Owner'}</option>
            <option value="participants">{$_('forums.sort_participants') || 'Participants'}</option>
            <option value="unread">{$_('forums.sort_unread') || 'Unread Count'}</option>
          </select>

          <!-- Sort Order -->
          <button
            onclick={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}
            class="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            title={sortOrder === 'asc'
              ? $_('forums.sort_desc') || 'Sort descending'
              : $_('forums.sort_asc') || 'Sort ascending'}>
            <Icon src={sortOrder === 'asc' ? ChevronUp : ChevronDown} class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Open Forums -->
      {#if openForums.length > 0}
        <div>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            <T key="forums.open_forums" fallback="Open Forums" />
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#key forumsKey}
              {#each openForums as forum, i}
                <div class="forum-card-animate" style="animation-delay: {i * 50}ms;">
                  {@render forumCard(forum)}
                </div>
              {/each}
            {/key}
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
              {#key forumsKey + '-closed'}
                {#each closedForums as forum, i}
                  <div class="forum-card-animate" style="animation-delay: {i * 50}ms;">
                    {@render forumCard(forum)}
                  </div>
                {/each}
              {/key}
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
          {forum.participants}
          {$_('forums.participants') || 'participants'}
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
            {forum.read_comments}
            {$_('forums.read_comments') || 'read'}
          </span>
          {#if forum.unread_comments > 0}
            <span class="font-semibold text-accent">
              {forum.unread_comments}
              {$_('forums.unread_comments') || 'unread'}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </button>
{/snippet}

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
  }  .forum-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>