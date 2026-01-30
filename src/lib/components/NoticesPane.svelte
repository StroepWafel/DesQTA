<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '../services/idbCache';
  import { Icon, ArrowTopRightOnSquare } from 'svelte-hero-icons';

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
  let loading = $state(true);

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
        labels = memCached;
        return;
      }
      
      const idbCached = await getWithIdbFallback<Label[]>('notices_labels', 'notices_labels', () => null);
      if (idbCached) {
        labels = idbCached;
        cache.set('notices_labels', idbCached, 60);
        return;
      }
      
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
        cache.set('notices_labels', labels, 60);
        await setIdb('notices_labels', labels);
      }
    } catch (e) {
      labels = [];
    }
  }

  async function fetchNotices() {
    try {
      const today = new Date();
      const key = `notices_${formatDate(today)}`;
      const { isOfflineMode } = await import('../../lib/utils/offlineMode');
      const offline = await isOfflineMode();
      
      // If offline, use database only
      if (offline) {
        const memCached = cache.get<Notice[]>(key);
        if (memCached) {
          notices = memCached.slice(0, 10); // Show only first 10 notices in widget
          return;
        }
        
        const idbCached = await getWithIdbFallback<Notice[]>(key, key, () => null);
        if (idbCached) {
          notices = idbCached.slice(0, 10);
          cache.set(key, idbCached, 30);
          return;
        }
        
        // No cached data when offline
        notices = [];
        return;
      }
      
      // Online: Always fetch from API and save to DB
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { date: formatDate(today) },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (Array.isArray(data?.payload)) {
        const fetchedNotices = data.payload.map((n: any, i: number) => ({
          id: i + 1,
          title: n.title,
          subtitle: n.label_title,
          author: n.staff,
          color: n.colour,
          labelId: n.label,
          content: n.contents,
        }));
        notices = fetchedNotices.slice(0, 10);
        // Always cache the data (for offline use), even when online
        cache.set(key, fetchedNotices, 30);
        await setIdb(key, fetchedNotices);
      }
    } catch (e) {
      notices = [];
    }
  }

  function getLabelColor(labelId: number): string {
    return labels.find((l) => l.id === labelId)?.color || '#910048';
  }

  function getLabelTitle(labelId: number): string {
    return labels.find((l) => l.id === labelId)?.title || '';
  }

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

  onMount(async () => {
    loading = true;
    await Promise.all([fetchLabels(), fetchNotices()]);
    loading = false;
  });
</script>

<div class="overflow-hidden relative rounded-2xl border shadow-xl backdrop-blur-xs bg-white/80 dark:bg-zinc-800/30 border-zinc-300/50 dark:border-zinc-700/50">
  <div class="flex justify-between items-center px-4 py-3 bg-linear-to-br border-b from-zinc-100/70 dark:from-zinc-800/70 to-zinc-100/30 dark:to-zinc-800/30 border-zinc-300/50 dark:border-zinc-700/50">
    <h3 class="text-xl font-semibold text-zinc-900 dark:text-white">Notices</h3>
    <a
      href="/notices"
      class="px-3 py-1.5 text-sm rounded-lg transition-all duration-300 text-nowrap accent-text hover:accent-bg-hover hover:text-white">
      View all
      <Icon src={ArrowTopRightOnSquare} class="inline ml-1 w-4 h-4" />
    </a>
  </div>
  
  <div class="overflow-y-auto px-4 py-4 max-h-80 scrollbar-thin scrollbar-thumb-accent-500/30 scrollbar-track-zinc-800/10">
    {#if loading}
      <div class="p-8 text-center text-(--text-muted)">
        <div class="w-8 h-8 rounded-full border-4 animate-spin border-accent-500/30 border-t-accent-500 mx-auto"></div>
        <p class="mt-4 text-sm">Loading notices...</p>
      </div>
    {:else if notices.length === 0}
      <div class="p-8 text-center text-(--text-muted)">
        <p class="text-sm">No notices available today.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each notices as notice}
          {@const noticeDate = new Date().toISOString().split('T')[0]}
          <a
            href="/notices?item={notice.id}&category={notice.labelId}&date={noticeDate}"
            class="block rounded-lg shadow-xs bg-white/10 text-(--text) border-l-4 p-3 transition-all duration-200 hover:shadow-md hover:bg-white/20"
            style="border-left-color: {getLabelColor(notice.labelId)};">
            <div class="flex items-start gap-2 mb-2">
              <span
                class="px-2 py-1 text-xs font-medium rounded-full text-white shrink-0"
                style="background-color: {getLabelColor(notice.labelId)};"
                class:text-black={!isColorDark(getLabelColor(notice.labelId))}>
                {getLabelTitle(notice.labelId)}
              </span>
              <span class="text-xs text-(--text-muted) uppercase tracking-wide shrink-0">
                {notice.author}
              </span>
            </div>
            <h4 class="font-semibold text-sm mb-1 line-clamp-1">{notice.title}</h4>
            <div class="text-xs text-(--text-muted) line-clamp-2">
              {@html notice.content}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style> 