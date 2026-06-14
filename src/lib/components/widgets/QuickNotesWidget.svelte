<script lang="ts">
  import { onMount } from 'svelte';
  import { PencilSquare } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../../utils/logger';
  import WidgetCard from '../dashboard/WidgetCard.svelte';

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

<WidgetCard icon={PencilSquare} title="Quick Notes" {loading}>
  {#snippet headerAction()}
    {#if saving}
      <span class="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">
        Saving…
      </span>
    {/if}
  {/snippet}

  <textarea
    bind:value={noteContent}
    oninput={handleInput}
    placeholder="Write your quick notes here..."
    class="w-full h-full p-3 rounded-lg border border-border bg-surface-2 text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 transition-colors duration-150 placeholder:text-muted-foreground/70"
    style="font-size: {fontSize}px;"
    aria-label="Quick notes text area"></textarea>
</WidgetCard>
