<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { LoadingSpinner, EmptyState } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';
  import { Icon, ChevronLeft, FolderOpen, ExclamationTriangle, CheckCircle, XCircle, Plus, Trash } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { logger } from '../../../utils/logger';

  interface MyFolioItem {
    created: string;
    id: number;
    title: string;
    updated: string;
    published?: string;
  }

  interface EditFoliosResponse {
    payload: MyFolioItem[];
    status: string;
  }

  let folios: MyFolioItem[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let creating = $state(false);
  let deleting = $state(false);
  let deleteModalOpen = $state(false);
  let folioToDelete: MyFolioItem | null = $state(null);
  let foliosEnabled = $state<boolean | null>(null);

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

  async function loadMyFolios() {
    loading = true;
    error = null;

    try {
      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'adminList' },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && Array.isArray(data.payload)) {
        folios = data.payload;
      } else {
        error = 'Invalid response format';
        logger.error('folios', 'loadMyFolios', 'Invalid response format', { data });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('folios', 'loadMyFolios', `Failed to load folios: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  // Separate published and unpublished folios
  const publishedFolios = $derived(folios.filter(f => f.published));
  const unpublishedFolios = $derived(folios.filter(f => !f.published));

  async function createNewFolio() {
    creating = true;
    try {
      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'adminSave',
          data: {
            title: 'Untitled folio',
            contents: '',
          },
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200' && data.payload?.id) {
        // Show success toast
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.success($_('folios.created') || 'Folio created successfully');
        } catch {
          // Toast store not available, skip
        }
        // Navigate to the new folio edit page
        goto(`/folios/edit/${data.payload.id}`);
      } else {
        error = 'Failed to create folio';
        logger.error('folios', 'createNewFolio', 'Failed to create folio', { data });
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.error($_('folios.create_error') || 'Failed to create folio');
        } catch {
          // Toast store not available, skip
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      logger.error('folios', 'createNewFolio', `Failed to create folio: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../lib/stores/toast');
        toastStore.error($_('folios.create_error') || 'Failed to create folio');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      creating = false;
    }
  }

  function openDeleteModal(folio: MyFolioItem, event: Event) {
    event.stopPropagation();
    folioToDelete = folio;
    deleteModalOpen = true;
  }

  function closeDeleteModal() {
    deleteModalOpen = false;
    folioToDelete = null;
  }

  async function confirmDelete() {
    if (!folioToDelete) return;

    deleting = true;
    try {
      const response = await seqtaFetch('/seqta/student/folio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          mode: 'adminDelete',
          id: folioToDelete.id,
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;

      if (data.status === '200') {
        // Remove the folio from the list
        folios = folios.filter(f => f.id !== folioToDelete.id);
        closeDeleteModal();
        try {
          const { toastStore } = await import('../../../lib/stores/toast');
          toastStore.success($_('folios.deleted') || 'Folio deleted successfully');
        } catch {
          // Toast store not available, skip
        }
      } else {
        throw new Error('Failed to delete folio');
      }
    } catch (e) {
      logger.error('folios', 'confirmDelete', `Failed to delete folio: ${e}`, { error: e });
      try {
        const { toastStore } = await import('../../../lib/stores/toast');
        toastStore.error($_('folios.delete_error') || 'Failed to delete folio');
      } catch {
        // Toast store not available, skip
      }
    } finally {
      deleting = false;
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
    loadMyFolios();
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
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <button
          onclick={() => goto('/folios')}
          class="p-2 rounded-lg transition-all duration-200 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
          <Icon src={ChevronLeft} class="w-5 h-5" />
        </button>
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
          <T key="folios.edit_my_folios" fallback="Edit My Folios" />
        </h1>
      </div>
      <button
        onclick={createNewFolio}
        disabled={creating}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white transition-all duration-200 hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
        <Icon src={Plus} class="w-5 h-5" />
        {creating ? ($_('folios.creating') || 'Creating...') : ($_('folios.new_folio') || 'New Folio')}
      </button>
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
        message={$_('folios.no_folios_message') || 'You have not created any folios yet.'}
        icon={FolderOpen}
        size="md" />
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Published Folios -->
      {#if publishedFolios.length > 0}
        <div>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Icon src={CheckCircle} class="w-5 h-5 text-green-600 dark:text-green-400" />
            <T key="folios.published_folios" fallback="Published Folios" /> ({publishedFolios.length})
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each publishedFolios as folio}
              <div class="relative group">
                <button
                  onclick={() => goto(`/folios/edit/${folio.id}`)}
                  class="w-full text-left p-6 bg-white rounded-lg border border-green-200 dark:border-green-800 transition-all duration-200 transform dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-green-300 dark:hover:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                  <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2 pr-8">
                    {folio.title}
                  </h3>
                  <div class="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    <div>
                      <T key="folios.created" fallback="Created" />: {formatDate(folio.created)}
                    </div>
                    <div>
                      <T key="folios.published" fallback="Published" />: {formatDate(folio.published || '')}
                    </div>
                    <div>
                      <T key="folios.updated" fallback="Updated" />: {formatDate(folio.updated)}
                    </div>
                  </div>
                </button>
                <button
                  onclick={(e) => openDeleteModal(folio, e)}
                  class="absolute top-4 right-4 p-2 rounded-lg text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label={$_('folios.delete') || 'Delete folio'}>
                  <Icon src={Trash} class="w-5 h-5" />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Unpublished Folios -->
      {#if unpublishedFolios.length > 0}
        <div>
          <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Icon src={XCircle} class="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <T key="folios.unpublished_folios" fallback="Unpublished Folios" /> ({unpublishedFolios.length})
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each unpublishedFolios as folio}
              <div class="relative group">
                <button
                  onclick={() => goto(`/folios/edit/${folio.id}`)}
                  class="w-full text-left p-6 bg-white rounded-lg border border-zinc-200 dark:border-zinc-700 transition-all duration-200 transform dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-[1.02] hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
                  <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2 pr-8">
                    {folio.title}
                  </h3>
                  <div class="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    <div>
                      <T key="folios.created" fallback="Created" />: {formatDate(folio.created)}
                    </div>
                    <div>
                      <T key="folios.updated" fallback="Updated" />: {formatDate(folio.updated)}
                    </div>
                    <div class="pt-2">
                      <span class="px-2 py-1 text-xs font-semibold rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        <T key="folios.unpublished" fallback="Unpublished" />
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  onclick={(e) => openDeleteModal(folio, e)}
                  class="absolute top-4 right-4 p-2 rounded-lg text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label={$_('folios.delete') || 'Delete folio'}>
                  <Icon src={Trash} class="w-5 h-5" />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<Modal
  open={deleteModalOpen}
  title={$_('folios.delete_folio') || 'Delete Folio'}
  maxWidth="max-w-md"
  onclose={closeDeleteModal}
  closeOnBackdrop={true}
  closeOnEscape={true}>
  <div class="px-8 pb-8">
    <p class="text-zinc-700 dark:text-zinc-300 mb-6">
      {$_('folios.delete_confirmation') || 'Are you sure you want to delete'} "{folioToDelete?.title}"? {$_('folios.delete_warning') || 'This action cannot be undone.'}
    </p>
    <div class="flex gap-4 justify-end">
      <button
        onclick={closeDeleteModal}
        disabled={deleting}
        class="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all duration-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2">
        <T key="common.cancel" fallback="Cancel" />
      </button>
      <button
        onclick={confirmDelete}
        disabled={deleting}
        class="px-4 py-2 rounded-lg bg-red-600 text-white transition-all duration-200 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
        {deleting ? ($_('folios.deleting') || 'Deleting...') : ($_('folios.delete') || 'Delete')}
      </button>
    </div>
  </div>
</Modal>

