<script lang="ts">
  import { onMount } from 'svelte';
  import { platformStore } from '$lib/stores/platform';
  import { seqtaFetch } from '../../utils/netUtil';

  let isMobile = $derived($platformStore.isMobile);
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { getFileIcon, formatFileSize } from '../courses/utils';
  import { fade, fly } from 'svelte/transition';
  import { Icon, ChevronDown } from 'svelte-hero-icons';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import { SearchInput } from '$lib/components/ui';

  interface DocItem {
    file: number;
    filename: string;
    size: string;
    context_uuid: string;
    mimetype: string;
    created_date: string;
    title: string;
    uuid: string;
    created_by: string;
  }

  interface DocCategory {
    colour: string;
    docs: DocItem[];
    id: number;
    category: string;
  }

  interface DocumentsResponse {
    payload: DocCategory[];
    status: string;
  }

  let loading = $state(true);
  let error = $state<string | null>(null);
  let categories = $state<DocCategory[]>([]);

  // Search / filter / sort state. Sort + active filter chips are persisted to
  // settings on every change.
  let searchQuery = $state('');
  let sortBy = $state<
    | 'date_desc'
    | 'date_asc'
    | 'name_asc'
    | 'name_desc'
    | 'size_desc'
    | 'size_asc'
    | 'type_asc'
  >('date_desc');
  let activeTypes = $state<string[]>([]);

  async function loadDocuments() {
    loading = true;
    error = null;

    const data = await useDataLoader<DocCategory[]>({
      cacheKey: 'documents',
      ttlMinutes: 10,
      context: 'documents',
      functionName: 'loadDocuments',
      fetcher: async () => {
        const response = await seqtaFetch('/seqta/student/load/documents?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {},
        });
        const data: DocumentsResponse =
          typeof response === 'string' ? JSON.parse(response) : response;
        if (data.status === '200' && Array.isArray(data.payload)) {
          return data.payload;
        }
        throw new Error($_('documents.failed_to_load') || 'Failed to load documents');
      },
      onDataLoaded: (data) => {
        categories = data;
        loading = false;
      },
      updateOnBackgroundSync: true,
    });

    if (!data) {
      error = $_('documents.error_loading') || 'Error loading documents';
      loading = false;
    }
  }

  async function openDocument(doc: DocItem) {
    try {
      // SEQTA's documents endpoint expects fileType: 'document', NOT 'resource'.
      // Using 'resource' returned a permission error even though the document
      // exists; the SEQTA web app uses ?type=document for the same UUIDs.
      const url = await invoke<string>('get_seqta_file', {
        fileType: 'document',
        uuid: doc.uuid,
      });
      if (typeof url === 'string') {
        await openUrl(url);
      }
    } catch (e) {
      console.error('Failed to open document:', e);
    }
  }

  function formatDate(dateStr: string) {
    let isoDate = dateStr.replace(' ', 'T');
    if (!(isoDate.charAt(isoDate.length - 3) === ':')) {
      isoDate = ''.concat(dateStr.replace(' ', 'T'), ':00');
    }
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  /** Bucket a SEQTA mimetype into a short, user-friendly type label. */
  function fileTypeBucket(mimetype: string, filename?: string): string {
    const mt = (mimetype || '').toLowerCase();
    const ext = (filename?.split('.').pop() || '').toLowerCase();
    if (mt.includes('pdf') || ext === 'pdf') return 'PDF';
    if (mt.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'Image';
    if (mt.includes('word') || mt.includes('msword') || ['doc', 'docx'].includes(ext)) return 'Doc';
    if (mt.includes('spreadsheet') || mt.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'Sheet';
    if (mt.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'Slides';
    if (mt.includes('zip') || ['zip', '7z', 'rar', 'tar', 'gz'].includes(ext)) return 'Archive';
    if (mt.includes('video') || ['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'Video';
    if (mt.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'Audio';
    return 'Other';
  }

  /** Number of bytes for sort. SEQTA returns strings — strip non-digits. */
  function bytes(size: string): number {
    const n = parseInt(String(size).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }
  function ms(dateStr: string): number {
    const t = new Date(dateStr.replace(' ', 'T')).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // Apply search + type filters + sort to the categorised data while keeping
  // the category grouping intact.
  const filteredCategories = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeSet = new Set(activeTypes);
    const out: DocCategory[] = [];
    for (const cat of categories) {
      const docs = cat.docs
        .filter((d) => {
          if (q) {
            const hay = `${d.title || ''} ${d.filename || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          if (activeSet.size > 0 && !activeSet.has(fileTypeBucket(d.mimetype, d.filename))) return false;
          return true;
        })
        .sort((a, b) => {
          switch (sortBy) {
            case 'date_asc':
              return ms(a.created_date) - ms(b.created_date);
            case 'name_asc':
              return (a.title || a.filename).localeCompare(b.title || b.filename);
            case 'name_desc':
              return (b.title || b.filename).localeCompare(a.title || a.filename);
            case 'size_desc':
              return bytes(b.size) - bytes(a.size);
            case 'size_asc':
              return bytes(a.size) - bytes(b.size);
            case 'type_asc':
              return fileTypeBucket(a.mimetype, a.filename).localeCompare(
                fileTypeBucket(b.mimetype, b.filename),
              );
            case 'date_desc':
            default:
              return ms(b.created_date) - ms(a.created_date);
          }
        });
      if (docs.length > 0) out.push({ ...cat, docs });
    }
    return out;
  });

  // All available file-type buckets derived from current docs (so we only show
  // chips for types that actually exist in the user's documents).
  const availableTypes = $derived.by(() => {
    const set = new Set<string>();
    for (const cat of categories) {
      for (const d of cat.docs) set.add(fileTypeBucket(d.mimetype, d.filename));
    }
    return Array.from(set).sort();
  });

  async function persistDocsState() {
    try {
      const { saveSettingsWithQueue } = await import('$lib/services/settingsSync');
      await saveSettingsWithQueue({
        documents_sort: sortBy,
        documents_filter_types: activeTypes,
      });
    } catch {
      // best-effort
    }
  }

  function toggleType(t: string) {
    if (activeTypes.includes(t)) {
      activeTypes = activeTypes.filter((x) => x !== t);
    } else {
      activeTypes = [...activeTypes, t];
    }
    persistDocsState();
  }

  function setSort(next: typeof sortBy) {
    sortBy = next;
    persistDocsState();
  }

  onMount(async () => {
    // Restore persisted sort + filter state before docs load so the first render
    // matches the user's expectations.
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['documents_sort', 'documents_filter_types'],
      });
      const rawSort = subset?.documents_sort as string | undefined;
      if (rawSort && (
        rawSort === 'date_desc' || rawSort === 'date_asc' ||
        rawSort === 'name_asc' || rawSort === 'name_desc' ||
        rawSort === 'size_desc' || rawSort === 'size_asc' ||
        rawSort === 'type_asc'
      )) sortBy = rawSort;
      if (Array.isArray(subset?.documents_filter_types)) {
        activeTypes = subset.documents_filter_types.filter((t: unknown) => typeof t === 'string');
      }
    } catch {
      // best-effort
    }
    await loadDocuments();
  });
</script>

<div class="container mx-auto w-full max-w-none p-5 sm:p-8 min-h-screen flex flex-col gap-6">
  <header class="flex flex-col gap-1.5" in:fade={{ duration: 200 }}>
    <p class="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
      Files
    </p>
    <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
      <T key="navigation.documents" fallback="Documents" />
    </h1>
    <p class="text-sm text-muted-foreground max-w-2xl">
      <T key="documents.description" fallback="Access and download your school documents" />
    </p>
  </header>

  {#if !loading && !error && categories.length > 0}
    <!-- Search + filter chips + sort -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" in:fade={{ duration: 200 }}>
      <div class="w-full sm:max-w-sm">
        <SearchInput
          bind:value={searchQuery}
          placeholder={$_('documents.search_placeholder') || 'Search documents…'} />
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        {#each availableTypes as t (t)}
          <button
            type="button"
            onclick={() => toggleType(t)}
            class="h-8 px-2.5 text-xs font-semibold uppercase tracking-[0.06em] rounded-full border transition-colors duration-150 {activeTypes.includes(t)
              ? 'bg-accent-500/12 border-accent-500/40 text-accent-600'
              : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong'}">
            {t}
          </button>
        {/each}
        <div class="relative">
          <label class="sr-only" for="docs-sort">
            <T key="documents.sort_label" fallback="Sort" />
          </label>
          <select
            id="docs-sort"
            value={sortBy}
            onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as any)}
            class="h-10 pl-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 appearance-none">
            <option value="date_desc">{$_('documents.sort_date_desc') || 'Newest first'}</option>
            <option value="date_asc">{$_('documents.sort_date_asc') || 'Oldest first'}</option>
            <option value="name_asc">{$_('documents.sort_name_asc') || 'Name A → Z'}</option>
            <option value="name_desc">{$_('documents.sort_name_desc') || 'Name Z → A'}</option>
            <option value="size_desc">{$_('documents.sort_size_desc') || 'Largest first'}</option>
            <option value="size_asc">{$_('documents.sort_size_asc') || 'Smallest first'}</option>
            <option value="type_asc">{$_('documents.sort_type_asc') || 'By type'}</option>
          </select>
          <Icon src={ChevronDown} class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div
      class="flex flex-col justify-center items-center py-24"
      in:fade={{ duration: 300 }}>
      <div
        class="w-10 h-10 sm:w-16 sm:h-16 rounded-full border-4 animate-spin border-accent-500/30 border-t-accent-500"
            ></div>
      <p class="mt-4 text-muted-foreground">
        <T key="documents.loading" fallback="Loading documents..." />
      </p>
    </div>
  {:else if error}
    <div
      class="flex flex-col justify-center items-center py-24"
      in:fade={{ duration: 300 }}>
      <div
        class="flex justify-center items-center w-20 h-20 text-3xl bg-linear-to-br from-red-500 to-red-600 rounded-full shadow-xs animate-gradient">
        ⚠️
      </div>
      <p class="mt-4 text-xl text-foreground">{error}</p>
      <button
        class="mt-4 px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring"
        onclick={loadDocuments}>
        <T key="common.retry" fallback="Retry" />
      </button>
    </div>
  {:else if categories.length === 0}
    <div
      class="flex flex-col justify-center items-center py-24"
      in:fade={{ duration: 300 }}>
      <div
        class="flex justify-center items-center w-20 h-20 text-3xl rounded-full bg-zinc-100 dark:bg-zinc-800">
        📄
      </div>
      <p class="mt-4 text-xl text-muted-foreground">
        <T key="documents.no_documents" fallback="No documents available" />
      </p>
    </div>
  {:else if filteredCategories.length === 0}
    <div class="flex flex-col justify-center items-center py-16" in:fade={{ duration: 200 }}>
      <p class="text-base text-muted-foreground">
        <T key="documents.no_matching" fallback="No documents match your search or filters." />
      </p>
    </div>
  {:else}
    <div class="space-y-8">
      {#each filteredCategories as category, i (category.id)}
        <div
          class="rounded-2xl border border-border-subtle overflow-hidden bg-card"
          in:fly={{ y: 20, duration: 300, delay: i * 50 }}
          out:fly={{ y: -20, duration: 200 }}>
          <div
            class="px-4 py-3 sm:px-6 sm:py-4 border-b border-border-subtle flex items-center gap-2"
            style="background: {category.colour}20; border-left: 4px solid {category.colour};">
            <span
              class="text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
              {category.category}
            </span>
            <span class="text-[11px] text-muted-foreground nums-tabular">
              {category.docs.length}
            </span>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6">
            {#each category.docs as doc (doc.uuid)}
              <button
                type="button"
                class="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 rounded-xl border border-border-subtle bg-card text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
                onclick={() => openDocument(doc)}>
                <span class="text-2xl shrink-0">{getFileIcon(doc.mimetype)}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold truncate text-foreground">
                    {doc.title || doc.filename}
                  </div>
                  <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span class="inline-flex items-center h-5 px-1.5 rounded border border-border-subtle text-[10px] uppercase tracking-[0.06em] font-semibold">
                      {fileTypeBucket(doc.mimetype, doc.filename)}
                    </span>
                    <span class="nums-tabular">{formatFileSize(doc.size)}</span>
                    <span aria-hidden="true">•</span>
                    <span class="nums-tabular">{formatDate(doc.created_date)}</span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
