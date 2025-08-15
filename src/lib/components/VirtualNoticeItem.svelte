<script lang="ts">
  interface Props {
    item: any;
    index: number;
    homepageLabels: any[];
  }

  let { item: notice, index, homepageLabels }: Props = $props();

  function getHomepageLabelColor(labelId: number): string {
    return homepageLabels.find((l) => l.id === labelId)?.colour || '#910048';
  }

  function getHomepageLabelTitle(labelId: number): string {
    return homepageLabels.find((l) => l.id === labelId)?.title || '';
  }
</script>

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