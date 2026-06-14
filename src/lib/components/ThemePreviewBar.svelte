<script lang="ts">
  /**
   * Floating Theme Preview bar mounted globally from +layout.svelte.
   *
   * Shows whenever a theme preview is active (driven by the previewingTheme
   * store), regardless of which route the user is on. Lets them cancel /
   * apply / go back without having to navigate back to the theme-store page.
   */
  import {
    previewingTheme,
    previewingThemeDisplayName,
    cancelThemePreview,
    applyPreviewTheme,
  } from '$lib/stores/theme';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';

  async function handleCancel() {
    try {
      await cancelThemePreview();
    } catch (e) {
      console.error('cancelThemePreview failed', e);
    }
  }
  async function handleApply() {
    try {
      await applyPreviewTheme();
    } catch (e) {
      console.error('applyPreviewTheme failed', e);
    }
  }
  function handleBack() {
    try {
      goto('/settings/theme-store');
    } catch {
      window.location.href = '/settings/theme-store';
    }
  }
</script>

{#if $previewingTheme}
  <div
    class="fixed left-1/2 bottom-4 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)]"
    role="status"
    aria-live="polite"
    transition:fly={{ y: 32, duration: 200, opacity: 0 }}>
    <span class="text-sm text-foreground">
      Previewing
      <span class="font-semibold">
        {$previewingThemeDisplayName || ($previewingTheme?.replace(/^\.temp\//, '') ?? '')}
      </span>
    </span>
    <div class="flex items-center gap-2 ml-2">
      <button
        type="button"
        onclick={handleBack}
        class="h-8 px-3 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150">
        Back
      </button>
      <button
        type="button"
        onclick={handleCancel}
        class="h-8 px-3 text-xs font-semibold rounded-md text-foreground bg-surface-muted hover:bg-surface-3 transition-colors duration-150">
        Cancel
      </button>
      <button
        type="button"
        onclick={handleApply}
        class="h-8 px-3 text-xs font-semibold rounded-md text-white bg-accent-500 hover:bg-accent-600 transition-colors duration-150">
        Apply
      </button>
    </div>
  </div>
{/if}
