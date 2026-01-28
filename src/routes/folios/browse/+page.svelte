<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import { Icon, ChevronLeft, FolderOpen, ExclamationTriangle, User } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { logger } from '../../../utils/logger';

  interface FolioItem {
    student: string;
    photo: string;
    id: number;
    published: string;
    title: string;
  }

  interface BrowseFoliosResponse {
    payload: {
      me: string;
      list: FolioItem[];
    };
    status: string;
  }

  let folios: FolioItem[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let me: string = $state('');
  let foliosEnabled = $state<boolean | null>(null);

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

  async function loadFolios() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'list', page: 0, filters: {} },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload) {
        folios = data.payload.list || [];
        me = data.payload.me || '';
      } else {
        error = 'Invalid response format';
        logger.error('folios', 'loadFolios', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('folios', 'loadFolios', `Failed to load folios: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function checkFoliosEnabled() {
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      foliosEnabled = data?.payload?.['coneqt-s.page.folios']?.value === 'enabled';
    } catch (e) {
      logger.error('folios', 'checkFoliosEnabled', `Failed to check if folios are enabled: ${e}`, {
        error: e,
      });
      foliosEnabled = false; // Default to disabled on error
    }
  }

  onMount(() => {
    checkFoliosEnabled();
    loadFolios();
  });
</script>

<div class="container px-6 py-7 mx-auto">
  {#if foliosEnabled === false}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('folios.not_enabled') || 'Folios Not Enabled'}
        message={$_('folios.not_enabled_message') || 'Folios are not enabled for your account.'}
        icon={ExclamationTriangle}
        size="md" />
    </div>
  {:else}
    <div class="flex items-center gap-4 mb-6">
      <button
        onclick={() => goto('/folios')}
        class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={ChevronLeft} class="w-5 h-5" />
      </button>
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
        <T key="folios.browse_folios" fallback="Browse Folios" />
      </h1>
    </div>

    {#if loading}
    <div class="flex justify-center items-center h-64">
      <LoadingSpinner size="md" message={$_('folios.loading') || 'Loading folios...'} />
    </div>
  {:else if error}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('folios.error_loading') || 'Error loading folios'}
        message={error}
        icon={ExclamationTriangle}
        size="md" />
    </div>
  {:else if folios.length === 0}
    <div class="flex justify-center items-center h-64">
      <EmptyState
        title={$_('folios.no_folios') || 'No folios available'}
        message={$_('folios.no_folios_message') || 'There are no folios to display.'}
        icon={FolderOpen}
        size="md" />
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each folios as folio}
        <button
          onclick={() => goto(`/folios/browse/${folio.id}`)}
          class="w-full text-left p-6 bg-white rounded-lg border transition-all duration-200 transform dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
          <div class="flex items-start gap-4 mb-4">
            <div class="flex-shrink-0">
              <div class="w-12 h-12 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300">
                <span class="text-lg font-semibold">{initial(folio.student)}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-1 truncate">
                {folio.title}
              </h3>
              <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Icon src={User} class="w-4 h-4" />
                <span class="truncate">{folio.student}</span>
              </div>
            </div>
          </div>
          <div class="text-sm text-zinc-600 dark:text-zinc-400">
            <T key="folios.published" fallback="Published" />: {formatDate(folio.published)}
          </div>
        </button>
      {/each}
    </div>
  {/if}
  {/if}
</div>

