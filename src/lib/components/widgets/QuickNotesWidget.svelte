<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Icon, PencilSquare } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../../utils/logger';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  let noteContent = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const fontSize = $derived(settings.fontSize || 14);
  const autoSave = $derived(settings.autoSave !== false);

  async function loadNote() {
    loading = true;
    try {
      const stored = await invoke<any>('db_cache_get', {
        key: `quick_note_${widget?.id || 'default'}`,
      });
      if (stored && typeof stored === 'string') {
        noteContent = stored;
      }
    } catch (e) {
      logger.error('QuickNotesWidget', 'loadNote', `Failed to load note: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  async function saveNote() {
    if (!autoSave) return;

    saving = true;
    try {
      await invoke('db_cache_set', {
        key: `quick_note_${widget?.id || 'default'}`,
        value: noteContent,
        ttlMinutes: null,
      });
    } catch (e) {
      logger.error('QuickNotesWidget', 'saveNote', `Failed to save note: ${e}`, { error: e });
    } finally {
      saving = false;
    }
  }

  function handleInput(e: Event) {
    noteContent = (e.target as HTMLTextAreaElement).value;

    if (autoSave) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveNote();
      }, 1000);
    }
  }

  onMount(() => {
    loadNote();
  });
</script>

<div class="flex flex-col h-full min-h-0">
  <div
    class="flex items-center gap-2 mb-2 sm:mb-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    in:fade={{ duration: 200, delay: 0 }}
    style="transform-origin: left center;">
    <div
      class="transition-all duration-300"
      in:scale={{ duration: 300, delay: 100, easing: cubicInOut, start: 0.8 }}>
      <Icon
        src={PencilSquare}
        class="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 dark:text-accent-400 transition-all duration-300" />
    </div>
    <h3
      class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white transition-all duration-300"
      in:fade={{ duration: 300, delay: 150 }}>
      Quick Notes
    </h3>
    {#if saving}
      <span
        class="ml-auto text-xs text-zinc-500 dark:text-zinc-500 transition-all duration-300"
        in:fade={{ duration: 200 }}>
        Saving...
      </span>
    {/if}
  </div>

  {#if loading}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading...
      </p>
    </div>
  {:else}
    <textarea
      bind:value={noteContent}
      oninput={handleInput}
      placeholder="Write your quick notes here..."
      class="flex-1 w-full p-2 sm:p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-sm focus:shadow-md"
      style="font-size: {fontSize}px;"
      aria-label="Quick notes text area"
      in:fade={{ duration: 400, delay: 100 }}></textarea>
  {/if}
</div>
