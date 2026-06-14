<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Link } from 'svelte-hero-icons';
  import { logger } from '../../utils/logger';
  import WidgetCard from './dashboard/WidgetCard.svelte';

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

<WidgetCard
  icon={Link}
  title="Shortcuts"
  {loading}
  empty={!loading && shortcuts.length === 0}
  emptyTitle="No shortcuts configured"
  emptyMessage="Add them in Settings."
  emptyIcon={Link}>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 h-full content-start">
    {#each shortcuts as shortcut}
      <a
        href={shortcut.url}
        target="_blank"
        rel="noopener noreferrer"
        class="group flex flex-col justify-center items-center p-3 rounded-lg border border-border bg-card text-foreground transition-colors duration-150 cursor-pointer hover:bg-surface-muted hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
        tabindex="0"
        aria-label={shortcut.name}
        onclick={(e) => handleShortcutClick(e, shortcut.url)}>
        <div class="flex justify-center items-center mb-2 w-10 h-10 text-lg rounded-lg bg-surface-muted text-foreground group-hover:bg-accent-500/12 group-hover:text-accent-600 transition-colors duration-150">
          {shortcut.icon}
        </div>
        <span class="text-xs font-medium text-center text-foreground line-clamp-1">{shortcut.name}</span>
      </a>
    {/each}
  </div>
</WidgetCard>
