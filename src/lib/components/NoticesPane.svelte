<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '../services/idbCache';
  import { Icon, ArrowTopRightOnSquare, Bell } from 'svelte-hero-icons';
  import { _ } from '$lib/i18n';
  import WidgetCard from './dashboard/WidgetCard.svelte';

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

      const idbCached = await getWithIdbFallback<Label[]>(
        'notices_labels',
        'notices_labels',
        () => null,
      );
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

<WidgetCard
  icon={Bell}
  title={$_('navigation.notices')}
  {loading}
  empty={!loading && notices.length === 0}
  emptyTitle={$_('notices.no_notices_today')}
  emptyIcon={Bell}>
  {#snippet headerAction()}
    <a
      href="/notices"
      class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em] font-semibold">
      {$_('notices.view_all')}
      <Icon src={ArrowTopRightOnSquare} class="w-3.5 h-3.5" />
    </a>
  {/snippet}

  <div class="h-full overflow-y-auto -mx-1 px-1 space-y-2">
    {#each notices as notice}
      {@const noticeDate = new Date().toISOString().split('T')[0]}
      <a
        href="/notices?item={notice.id}&category={notice.labelId}&date={noticeDate}"
        class="block rounded-lg border border-border-subtle border-l-[3px] p-3 transition-colors duration-150 hover:bg-surface-muted text-foreground"
        style="border-left-color: {getLabelColor(notice.labelId)};">
        <div class="flex items-center gap-2 mb-1.5">
          <span
            class="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] rounded text-white shrink-0"
            style="background-color: {getLabelColor(notice.labelId)};"
            class:text-black={!isColorDark(getLabelColor(notice.labelId))}>
            {getLabelTitle(notice.labelId)}
          </span>
          <span class="text-[10px] text-muted-foreground uppercase tracking-[0.06em] truncate">
            {notice.author}
          </span>
        </div>
        <h4 class="font-semibold text-sm mb-1 line-clamp-1 text-foreground">{notice.title}</h4>
        <div class="text-xs text-muted-foreground line-clamp-2">
          {@html notice.content}
        </div>
      </a>
    {/each}
  </div>
</WidgetCard>

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
