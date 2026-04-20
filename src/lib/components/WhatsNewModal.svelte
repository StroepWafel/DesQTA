<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import { Icon, Sparkles } from 'svelte-hero-icons';
  import { marked } from 'marked';
  import T from './T.svelte';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    open: boolean;
    currentVersion: string;
    previousVersion: string;
    changelogMarkdown: string;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    currentVersion,
    previousVersion,
    changelogMarkdown,
    onclose,
  }: Props = $props();

  const changelogHtml = $derived(
    changelogMarkdown ? marked.parse(changelogMarkdown, { async: false }) as string : ''
  );

  async function closeModal() {
    try {
      await invoke('clear_version_update_info');
    } catch {
      // Ignore if command fails
    }
    onclose?.();
  }

  const ariaLabel = "What's New";
</script>

<Modal bind:open onclose={closeModal} ariaLabel={ariaLabel} maxWidth="max-w-3xl" maxHeight="max-h-[85vh]">
  <div class="p-4 sm:p-6 md:p-8 max-h-[80vh] overflow-y-auto">
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
      <div class="flex items-center space-x-3 sm:space-x-4">
        <div
          class="flex justify-center items-center w-12 h-12 rounded-2xl accent-bg text-white dark:text-white">
          <Icon src={Sparkles} class="w-6 h-6" />
        </div>
        <div>
          <h2
            class="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-300">
            <T key="whats_new.title" fallback="What's New" />
          </h2>
          <p class="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
            <T key="whats_new.subtitle" fallback="DesQTA has been updated" />
            {#if previousVersion}
              <span class="font-medium">v{previousVersion}</span>
              <T key="whats_new.to" fallback=" → " />
            {/if}
            <span class="font-medium">v{currentVersion}</span>
          </p>
        </div>
      </div>
    </div>

    <div
      class="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-white prose-p:text-zinc-600 dark:prose-p:text-zinc-400 prose-li:text-zinc-600 dark:prose-li:text-zinc-400 prose-strong:text-zinc-900 dark:prose-strong:text-white">
      {#if changelogHtml}
        {@html changelogHtml}
      {:else if changelogMarkdown === ''}
        <p class="text-zinc-600 dark:text-zinc-400">
          <T key="whats_new.loading" fallback="Loading changelog..." />
        </p>
      {/if}
    </div>
  </div>
</Modal>
