<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '../services/idbCache';
  import { Icon, ArrowTopRightOnSquare } from 'svelte-hero-icons';
  import VirtualList from './VirtualList.svelte';
  import VirtualNoticeItem from './VirtualNoticeItem.svelte';

  let homepageNotices = $state<any[]>([]);
  let homepageLabels = $state<any[]>([]);
  let loadingHomepageNotices = $state(true);
  
  // Notice item height for virtual scrolling
  const NOTICE_ITEM_HEIGHT = 120;

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function fetchHomepageLabels() {
    try {
      // Check memory cache first
      const memCached = cache.get<any[]>('notices_labels');
      if (memCached) {
        homepageLabels = memCached;
        return;
      }
      
      // Check IndexedDB fallback
      const idbCached = await getWithIdbFallback<any[]>('notices_labels', 'notices_labels', () => null);
      if (idbCached) {
        homepageLabels = idbCached;
        // Restore to memory cache with remaining TTL estimation
        cache.set('notices_labels', idbCached, 60);
        return;
      }
      
      // Fetch from API
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { mode: 'labels' },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (Array.isArray(data?.payload)) {
        const labels = data.payload.map((l: any) => ({
          id: l.id,
          title: l.title,
          colour: l.colour,
        }));
        homepageLabels = labels;
        cache.set('notices_labels', labels, 60); // 60 min TTL
        await setIdb('notices_labels', labels);
      } else {
        homepageLabels = [];
      }
    } catch (e) {
      homepageLabels = [];
    }
  }

  async function fetchHomepageNotices() {
    loadingHomepageNotices = true;
    try {
      const today = new Date();
      const dateStr = formatDate(today);
      const key = `notices_${dateStr}`;
      
      // Cache should now work properly with compatibility layer
      
      // Check memory cache first
      const memCached = cache.get<any[]>(key);
      if (memCached) {
        // Fix data structure for compatibility with VirtualNoticeItem (in case old cached data)
        const fixedNotices = memCached.map(notice => ({
          ...notice,
          contents: notice.contents || notice.content, // Ensure contents field exists
          staff: notice.staff || notice.author,         // Ensure staff field exists  
          label: notice.label || notice.labelId         // Ensure label field exists
        }));
        homepageNotices = fixedNotices.slice(0, 100); // Limit for homepage
        loadingHomepageNotices = false;
        return;
      }
      
      // Check IndexedDB fallback
      const idbCached = await getWithIdbFallback<any[]>(key, key, () => null);
      if (idbCached) {
        // Fix data structure for compatibility with VirtualNoticeItem
        const fixedNotices = idbCached.map(notice => ({
          ...notice,
          contents: notice.contents || notice.content, // Ensure contents field exists
          staff: notice.staff || notice.author,         // Ensure staff field exists  
          label: notice.label || notice.labelId         // Ensure label field exists
        }));
        homepageNotices = fixedNotices.slice(0, 100); // Limit for homepage
        // Restore to memory cache with remaining TTL estimation
        cache.set(key, fixedNotices, 30);
        loadingHomepageNotices = false;
        return;
      }
      
      // Fetch from API
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { date: dateStr },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      
      if (Array.isArray(data?.payload)) {
        const notices = data.payload.map((n: any, i: number) => ({
          id: n.id || (i + 1),
          title: n.title,
          subtitle: n.label_title,
          author: n.staff,
          color: n.colour,
          labelId: n.label,
          content: n.contents,
          label: n.label, // Keep original structure for homepage
          staff: n.staff,
          contents: n.contents // This is what VirtualNoticeItem expects
        }));
        homepageNotices = notices.slice(0, 100); // Limit for homepage
        cache.set(key, notices, 30); // 30 min TTL
        await setIdb(key, notices);
      } else {
        homepageNotices = [];
      }
    } catch (e) {
      homepageNotices = [];
    }
    loadingHomepageNotices = false;
  }

  function getHomepageLabelColor(labelId: number): string {
    return homepageLabels.find((l) => l.id === labelId)?.colour || '#910048';
  }

  function getHomepageLabelTitle(labelId: number): string {
    return homepageLabels.find((l) => l.id === labelId)?.title || '';
  }

  onMount(async () => {
    await Promise.all([fetchHomepageLabels(), fetchHomepageNotices()]);
  });
</script>

<div
  class="overflow-hidden relative rounded-2xl border shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
  <div
    class="flex justify-between items-center px-4 py-3 bg-gradient-to-br border-b from-slate-100/70 dark:from-slate-800/70 to-slate-100/30 dark:to-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
    <h3 class="text-xl font-semibold text-slate-900 dark:text-white">Notices</h3>
    <a
      href="/notices"
      class="px-3 py-1.5 text-sm rounded-lg transition-all duration-300 text-nowrap accent-text hover:accent-bg-hover hover:text-white">
      View all
      <Icon src={ArrowTopRightOnSquare} class="inline ml-1 w-4 h-4" />
    </a>
  </div>
  <div
    class="overflow-y-auto px-6 py-4 max-h-80 scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-slate-800/10">
    {#if loadingHomepageNotices}
      <div class="py-10 text-center">
        <div
          class="mx-auto w-12 h-12 rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500">
        </div>
        <p class="mt-4 text-slate-600 dark:text-slate-400">Loading notices...</p>
      </div>
    {:else if homepageNotices.length === 0}
      <div class="py-10 text-center text-slate-600 dark:text-slate-400">
        No notices available.
      </div>
    {:else if homepageNotices.length > 15}
      <!-- Use virtual scrolling for large lists -->
      <VirtualList
        items={homepageNotices}
        itemHeight={NOTICE_ITEM_HEIGHT}
        containerHeight={280}
        keyFunction={(item) => item.id}
        let:item>
        <VirtualNoticeItem {item} index={0} {homepageLabels} />
      </VirtualList>
    {:else}
      <!-- Use regular rendering for smaller lists -->
      {#each homepageNotices as notice}
        <div
          class="p-4 mb-4 rounded-xl border transition-all duration-300 last:mb-0 bg-slate-100/60 dark:bg-slate-800/60 hover:bg-slate-200/80 dark:hover:bg-slate-800/80 border-slate-300/50 dark:border-slate-700/50 hover:border-slate-400/50 dark:hover:border-slate-600/50">
          <div class="flex gap-2 items-center mb-2">
            <span
              class="px-2.5 py-1 text-xs font-medium rounded-full animate-gradient"
              style="background: linear-gradient(135deg, {getHomepageLabelColor(
                notice.label,
              )}, {getHomepageLabelColor(notice.label)}dd); color: white;">
              {getHomepageLabelTitle(notice.label)}
            </span>
            <span class="text-xs text-slate-600 dark:text-slate-400">{notice.staff}</span>
          </div>
          <div class="mb-2 text-base font-bold text-slate-900 dark:text-white">
            {notice.title}
          </div>
          <div class="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
            {@html notice.contents}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div> 