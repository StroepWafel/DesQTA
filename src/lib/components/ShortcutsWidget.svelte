<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../utils/logger';

  interface Shortcut {
    name: string;
    icon: string;
    url: string;
  }

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  let shortcuts = $state<Shortcut[]>([]);
  let loading = $state(true);

  import { openUrl } from '@tauri-apps/plugin-opener';

  async function loadShortcuts() {
    loading = true;
    try {
      const settingsData = await invoke<any>('get_settings_subset', {
        keys: ['shortcuts'],
      });
      shortcuts = settingsData?.shortcuts || [];
    } catch (e) {
      logger.error('ShortcutsWidget', 'loadShortcuts', `Failed to load shortcuts: ${e}`, {
        error: e,
      });
      shortcuts = [];
    } finally {
      loading = false;
    }
  }

  function handleShortcutClick(e: MouseEvent, url: string) {
    e.preventDefault();
    openUrl(url);
  }

  onMount(() => {
    loadShortcuts();
  });
</script>

<div class="flex flex-col h-full min-h-0">
  {#if loading}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="w-6 h-6 sm:w-8 sm:h-8 border-4 border-accent-600 border-t-transparent rounded-full animate-spin mb-2 transition-all duration-300"
        in:scale={{ duration: 400, easing: cubicInOut, start: 0.5 }}>
      </div>
      <p
        class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-all duration-300"
        in:fade={{ duration: 300, delay: 100 }}>
        Loading shortcuts...
      </p>
    </div>
  {:else if shortcuts.length === 0}
    <div
      class="flex flex-col items-center justify-center flex-1 py-6 sm:py-8 min-h-0 transition-all duration-300"
      in:fade={{ duration: 300, easing: cubicInOut }}>
      <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
        No shortcuts configured. Add them in Settings.
      </p>
    </div>
  {:else}
    <div
      class="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 h-full min-h-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      in:fade={{ duration: 400, delay: 100 }}>
      {#each shortcuts as shortcut, i}
        <a
          href={shortcut.url}
          target="_blank"
          rel="noopener noreferrer"
          class="flex relative flex-col justify-center items-center p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer border-zinc-200/80 dark:border-zinc-800/80 group bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm hover:accent-bg hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring transform"
          tabindex="0"
          aria-label={shortcut.name}
          onclick={(e) => handleShortcutClick(e, shortcut.url)}
          in:fade={{ duration: 300, delay: 100 + i * 50 }}
          style="transform-origin: center center;">
          <div
            class="flex relative justify-center items-center mb-3 sm:mb-4 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-2xl sm:text-3xl text-white rounded-xl sm:rounded-2xl shadow-lg transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] accent-bg group-hover:scale-110 group-active:scale-95">
            {shortcut.icon}
          </div>
          <span
            class="relative mt-1 text-sm sm:text-base font-semibold text-center transition-colors duration-300 text-zinc-900 dark:text-white"
            >{shortcut.name}</span>
        </a>
      {/each}
    </div>
  {/if}
</div>
