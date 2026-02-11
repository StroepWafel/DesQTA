<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { getFileIcon, formatFileSize } from '../courses/utils';
  import { fade, fly } from 'svelte/transition';
  import { DocumentDuplicate } from 'svelte-hero-icons';
  import { Icon } from 'svelte-hero-icons';

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

  async function loadDocuments() {
    loading = true;
    error = null;
    try {
      const response = await seqtaFetch('/seqta/student/load/documents?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const data: DocumentsResponse =
        typeof response === 'string' ? JSON.parse(response) : response;
      if (data.status === '200' && Array.isArray(data.payload)) {
        categories = data.payload;
      } else {
        error = $_('documents.failed_to_load') || 'Failed to load documents';
      }
    } catch (e) {
      error =
        e instanceof Error ? e.message : $_('documents.error_loading') || 'Error loading documents';
      console.error('Error loading documents:', e);
    } finally {
      loading = false;
    }
  }

  async function openDocument(doc: DocItem) {
    try {
      const url = await invoke<string>('get_seqta_file', {
        fileType: 'resource',
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

  onMount(loadDocuments);
</script>

<div class="p-6 sm:p-8 min-h-screen">
  <div class="flex items-center gap-2 mb-6 sm:mb-8" in:fade={{ duration: 200 }}>
    <Icon
      src={DocumentDuplicate}
      class="w-8 h-8 sm:w-10 sm:h-10 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    <h1 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
      <T key="navigation.documents" fallback="Documents" />
    </h1>
  </div>

  {#if loading}
    <div
      class="flex flex-col justify-center items-center py-24"
      in:fade={{ duration: 300 }}>
      <div
        class="w-10 h-10 sm:w-16 sm:h-16 rounded-full border-4 animate-spin border-accent-500/30 border-t-accent-500"
            ></div>
      <p class="mt-4 text-zinc-600 dark:text-zinc-400">
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
      <p class="mt-4 text-xl text-zinc-700 dark:text-zinc-300">{error}</p>
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
      <p class="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
        <T key="documents.no_documents" fallback="No documents available" />
      </p>
    </div>
  {:else}
    <div class="space-y-8">
      {#each categories as category, i (category.id)}
        <div
          class="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 overflow-hidden theme-bg"
          in:fly={{ y: 20, duration: 300, delay: i * 50 }}
          out:fly={{ y: -20, duration: 200 }}>
          <div
            class="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-2"
            style="background: {category.colour}20; border-left: 4px solid {category.colour};">
            <span
              class="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
              {category.category}
            </span>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6">
            {#each category.docs as doc (doc.uuid)}
              <button
                type="button"
                class="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-left transition-all duration-200 hover:border-accent-500/40 hover:shadow-md hover:scale-[1.02] focus:outline-hidden focus:ring-2 accent-ring focus:ring-offset-2 theme-bg"
                onclick={() => openDocument(doc)}>
                <span class="text-2xl shrink-0">{getFileIcon(doc.mimetype)}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold truncate text-zinc-900 dark:text-white">
                    {doc.title || doc.filename}
                  </div>
                  <div class="flex flex-wrap gap-2 mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>•</span>
                    <span>{formatDate(doc.created_date)}</span>
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
