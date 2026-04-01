<script lang="ts">
  import { uploadProgressStore } from '$lib/stores/uploadProgress';
  import { platformStore } from '$lib/stores/platform';
  import { Progress } from '$lib/components/ui';
  import { slide } from 'svelte/transition';
  import { _ } from '$lib/i18n';

  const progress = $derived($uploadProgressStore);
  const percent = $derived(progress.total > 0 ? (progress.current / progress.total) * 100 : 0);
  const isMobile = $derived($platformStore.isMobile);
</script>

{#if progress.active}
  <div
    class="fixed right-6 z-[100] w-80 max-w-[calc(100vw-3rem)] rounded-xl border shadow-2xl backdrop-blur-md bg-white/95 dark:bg-zinc-800/95 border-zinc-200/60 dark:border-zinc-700/40 p-4 transition-all duration-300 {isMobile
      ? 'bottom-24'
      : 'bottom-6'}"
    transition:slide={{ axis: 'y', duration: 200 }}
    role="status"
    aria-live="polite"
    aria-label={$_('assessments.upload_progress', { default: 'Upload progress' })}>
    <div class="flex items-center gap-3 mb-2">
      <div
        class="w-5 h-5 shrink-0 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"
        aria-hidden="true">
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-zinc-900 dark:text-white truncate">
          {progress.label || $_('assessments.uploading_files', { default: 'Uploading files' })}
        </p>
        {#if progress.currentFileName}
          <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {progress.currentFileName}
          </p>
        {/if}
      </div>
      <span class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
        {progress.current}/{progress.total}
      </span>
    </div>
    <Progress
      value={percent}
      max={100}
      size="sm"
      variant="default"
      animated={true}
      class="mt-1" />
  </div>
{/if}
