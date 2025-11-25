<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { sanitizeHtml } from '../../utils/sanitization';
  import { logger } from '../../utils/logger';

  interface Notice {
    id: number;
    title: string;
    subtitle: string;
    author: string;
    color: string;
    labelId: number;
    content: string;
  }
  interface Label {
    id: number;
    title: string;
    color: string;
  }

  let notices: Notice[] = $state([]);
  let labels: Label[] = $state([]);
  let selectedLabel: number | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedDate = $state(new Date());
  
  // Notice row height for virtual scrolling (estimated)
  const NOTICE_ROW_HEIGHT = 420; // h-96 + gap-6

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function fetchLabels() {
    try {
      const memCached = cache.get<Label[]>('notices_labels');
      if (memCached) {
        logger.debug('notices', 'fetchLabels', 'notices_labels hit (memory)', { count: memCached.length });
        labels = memCached;
        return;
      }
      
      const idbCached = await getWithIdbFallback<Label[]>('notices_labels', 'notices_labels', () => null);
      if (idbCached) {
        logger.debug('notices', 'fetchLabels', 'notices_labels hit (IndexedDB fallback)', { count: idbCached.length });
        labels = idbCached;
        // Restore to memory cache with remaining TTL estimation
        cache.set('notices_labels', idbCached, 60);
        return;
      }
      
      logger.debug('notices', 'fetchLabels', 'notices_labels miss - fetching from API');
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { mode: 'labels' },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (Array.isArray(data?.payload)) {
        labels = data.payload.map((l: any) => ({
          id: l.id,
          title: l.title,
          color: l.colour,
        }));
        cache.set('notices_labels', labels, 60); // 60 min TTL
        await setIdb('notices_labels', labels);
        logger.debug('notices', 'fetchLabels', 'notices_labels stored (mem+idb)', { count: labels.length });
      } else {
        labels = [];
      }
    } catch (e) {
      logger.error('notices', 'fetchLabels', 'notices_labels fetch failed', { error: e });
      labels = [];
    }
  }

  async function fetchNotices() {
    loading = true;
    error = null;
    try {
      const key = `notices_${formatDate(selectedDate)}`;
      const { isOfflineMode } = await import('../../lib/utils/offlineMode');
      const offline = await isOfflineMode();
      
      // If offline, use database only
      if (offline) {
        const memCached = cache.get<Notice[]>(key);
        if (memCached) {
          logger.debug('notices', 'fetchNotices', 'notices hit (memory, offline)', { key, count: memCached.length });
          notices = memCached;
          loading = false;
          return;
        }
        
        const idbCached = await getWithIdbFallback<Notice[]>(key, key, () => null);
        if (idbCached) {
          logger.debug('notices', 'fetchNotices', 'notices hit (IndexedDB, offline)', { key, count: idbCached.length });
          notices = idbCached;
          cache.set(key, idbCached, 30);
          loading = false;
          return;
        }
        
        // No cached data when offline
        error = $_('notices.offline_no_cache') || 'No cached notices available. Please go online to fetch notices.';
        notices = [];
        loading = false;
        return;
      }
      
      // Online: Always fetch from API and save to DB
      logger.debug('notices', 'fetchNotices', 'fetching notices from API', { key, date: formatDate(selectedDate) });
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { date: formatDate(selectedDate) },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (Array.isArray(data?.payload)) {
        notices = data.payload.map((n: any, i: number) => ({
          id: i + 1,
          title: n.title,
          subtitle: n.label_title,
          author: n.staff,
          color: n.colour,
          labelId: n.label,
          content: n.contents,
        }));
        // Always cache the data (for offline use), even when online
        cache.set(key, notices, 30);
        await setIdb(key, notices);
        logger.debug('notices', 'fetchNotices', 'notices stored (mem+idb)', { key, count: notices.length });
      } else {
        notices = [];
      }
    } catch (e) {
      logger.error('notices', 'fetchNotices', 'notices fetch failed', { key: `notices_${formatDate(selectedDate)}`, error: e });
      error = $_('notices.failed_to_load') || 'Failed to load notices.';
      notices = [];
    } finally {
      loading = false;
    }
  }

  function updateDate(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedDate = new Date(input.value);
    fetchNotices();
  }

  onMount(async () => {
    await Promise.all([fetchLabels(), fetchNotices()]);
  });

  // Get color for a notice from the label
  function getLabelColor(labelId: number): string {
    return labels.find((l) => l.id === labelId)?.color || '#910048';
  }
  function getLabelTitle(labelId: number): string {
    return labels.find((l) => l.id === labelId)?.title || '';
  }

  // Luminance check for text color
  function isColorDark(hex: string): boolean {
    hex = hex.replace('#', '');
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((x) => x + x)
        .join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Filter notices based on selected label
  const filteredNotices = $derived(notices.filter((n) => !selectedLabel || n.labelId === selectedLabel));
</script>

<div class="p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">
      <T key="navigation.notices" fallback="Notices" />
    </h1>
    <div class="flex gap-4 items-center">
      <input
        type="date"
        value={formatDate(selectedDate)}
        onchange={updateDate}
        class="px-4 py-2 bg-white rounded-lg border text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500" />
    </div>
  </div>

  <!-- Label filter dropdown -->
  {#if labels.length > 0}
    <div class="flex gap-2 items-center mb-6">
      <label for="label-select" class="font-semibold text-sm mr-2">
        <T key="notices.label" fallback="Label:" />
      </label>
      <select
        id="label-select"
        class="px-4 py-2 rounded-lg border text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        bind:value={selectedLabel}
        onchange={(e) => {
          const target = e.target as HTMLSelectElement;
          selectedLabel = target.value === '' ? null : +target.value;
        }}>
        <option value="">
          <T key="notices.all" fallback="All" />
        </option>
        {#each labels as label}
          <option value={label.id}>{label.title}</option>
        {/each}
      </select>
    </div>
  {/if}

  {#if loading}
    <div class="p-8 text-center text-(--text-muted)">
      <T key="notices.loading" fallback="Loading notices..." />
    </div>
  {:else if error}
    <div class="p-8 text-center text-red-500">{error}</div>
  {:else if filteredNotices.length === 0}
    <div class="p-8 text-center text-(--text-muted)">
      <T key="notices.no_notices_found" fallback="No notices found for the selected criteria." />
    </div>
  {:else}
    <!-- Use regular grid -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredNotices as notice}
        <div
          class="rounded-xl shadow-lg bg-white/10 text-(--text) border-t-8 flex flex-col h-96"
          style={`border-top-color: ${getLabelColor(notice.labelId)}; border-top-width: 8px;`}>
          <div class="flex overflow-y-auto flex-col flex-1 p-5">
            <h2 class="mb-1 text-2xl font-bold">{notice.title}</h2>
            <div
              class="mb-1 text-sm font-semibold"
              style={`color: ${getLabelColor(notice.labelId)}`}
              class:text-white={isColorDark(getLabelColor(notice.labelId))}>
              {getLabelTitle(notice.labelId)}
            </div>
            <div class="text-xs text-(--text-muted) mb-2 uppercase tracking-wide">
              {notice.author}
            </div>
            <div class="flex-1 text-base">{@html sanitizeHtml(notice.content)}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
