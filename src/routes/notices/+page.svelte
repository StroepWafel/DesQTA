<script lang="ts">
  // Svelte imports
  import { onMount } from 'svelte';

  // $lib/ imports
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import { EmptyState, LoadingSpinner } from '$lib/components/ui';
  import { ExclamationTriangle, DocumentText } from 'svelte-hero-icons';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Label from '$lib/components/ui/label/index.js';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';

  // Relative imports
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
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
  let selectedLabelString = $state<string | undefined>(undefined);
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
    const data = await useDataLoader<Label[]>({
      cacheKey: 'notices_labels',
      ttlMinutes: 60,
      context: 'notices',
      functionName: 'fetchLabels',
      fetcher: async () => {
        const response = await seqtaFetch('/seqta/student/load/notices?', {
          method: 'POST',
          body: { mode: 'labels' },
        });
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        if (Array.isArray(data?.payload)) {
          return data.payload.map((l: any) => ({
            id: l.id,
            title: l.title,
            color: l.colour,
          }));
        }
        return [];
      },
      onDataLoaded: (data) => {
        labels = data;
      },
    });

    if (!data) {
      labels = [];
    }
  }

  async function fetchNotices() {
    loading = true;
    error = null;

    const key = `notices_${formatDate(selectedDate)}`;
    const { isOfflineMode } = await import('../../lib/utils/offlineMode');
    const offline = await isOfflineMode();

    // If offline, manually check cache only
    if (offline) {
      const memCached = cache.get<Notice[]>(key);
      if (memCached) {
        notices = memCached;
        loading = false;
        return;
      }

      const idbCached = await getWithIdbFallback<Notice[]>(key, key, () => null);
      if (idbCached) {
        notices = idbCached;
        cache.set(key, idbCached, 30);
        loading = false;
        return;
      }

      error =
        $_('notices.offline_no_cache') ||
        'No cached notices available. Please go online to fetch notices.';
      notices = [];
      loading = false;
      return;
    }

    // Online: Use useDataLoader but always fetch fresh (skip cache for fresh data)
    try {
      // First check cache for instant display
      const cached =
        cache.get<Notice[]>(key) || (await getWithIdbFallback<Notice[]>(key, key, () => null));
      if (cached) {
        notices = cached;
        loading = false;
        // Fetch fresh in background
      }

      // Always fetch fresh when online
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
        cache.set(key, notices, 30);
        await setIdb(key, notices);
      } else {
        notices = [];
      }
      loading = false;
    } catch (e) {
      logger.error('notices', 'fetchNotices', 'notices fetch failed', { key, error: e });
      error = $_('notices.failed_to_load') || 'Failed to load notices.';
      notices = [];
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
  const filteredNotices = $derived(
    notices.filter((n) => !selectedLabel || n.labelId === selectedLabel),
  );
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
        class="px-4 py-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-colors duration-200" />
    </div>
  </div>

  <!-- Label filter dropdown -->
  {#if labels.length > 0}
    <div class="flex gap-2 items-center mb-6">
      <Label.Root class="font-semibold text-sm">
        <T key="notices.label" fallback="Label:" />
      </Label.Root>
      <Select.Root
        type="single"
        bind:value={selectedLabelString}
        onValueChange={(value) => {
          selectedLabelString = value;
          selectedLabel = value === undefined || value === 'all' ? null : +value;
        }}>
        <Select.Trigger class="w-44">
          <span class="truncate">
            {#if selectedLabelString === undefined}
              <T key="notices.all" fallback="All" />
            {:else}
              {labels.find((l) => l.id.toString() === selectedLabelString)?.title || ''}
            {/if}
          </span>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all" label={$_('notices.all') || 'All'}>
            <T key="notices.all" fallback="All" />
          </Select.Item>
          {#each labels as label}
            <Select.Item value={label.id.toString()} label={label.title}>
              {label.title}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <LoadingSpinner size="md" message={$_('notices.loading') || 'Loading notices...'} />
    </div>
  {:else if error}
    <EmptyState
      title={$_('notices.error_title') || 'Error loading notices'}
      message={error}
      icon={ExclamationTriangle}
      size="md" />
  {:else if filteredNotices.length === 0}
    <EmptyState
      title={$_('notices.no_notices_found') || 'No notices found'}
      message={$_('notices.no_notices_message') || 'No notices found for the selected criteria.'}
      icon={DocumentText}
      size="md" />
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
