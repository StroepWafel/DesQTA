<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Icon, Photo, Trash, ArrowPath } from 'svelte-hero-icons';
  import T from '../T.svelte';
  import { toastStore } from '$lib/stores/toast';
  import { saveSettingsWithQueue } from '$lib/services/settingsSync';
  import {
    saveBackgroundImage,
    deleteBackgroundImage,
    hasCustomBackgroundImage,
    type BackgroundFit,
    clampBackgroundOpacity,
    clampBackgroundDim,
  } from '$lib/services/backgroundImageService';
  import { loadCustomBackground } from '$lib/stores/customBackground';
  import { logger } from '../../../utils/logger';

  let enabled = $state(false);
  let fit = $state<BackgroundFit>('cover');
  let opacity = $state(1);
  let dim = $state(0);
  let hasImage = $state(false);
  let previewUrl = $state<string | null>(null);
  let uploading = $state(false);
  let saving = $state(false);

  async function loadState() {
    try {
      const settings = await invoke<Record<string, unknown>>('get_settings_subset', {
        keys: [
          'custom_background_enabled',
          'custom_background_fit',
          'custom_background_opacity',
          'custom_background_dim',
        ],
      });
      enabled = settings.custom_background_enabled === true;
      fit =
        settings.custom_background_fit === 'contain' || settings.custom_background_fit === 'fill'
          ? (settings.custom_background_fit as BackgroundFit)
          : 'cover';
      opacity = clampBackgroundOpacity(
        typeof settings.custom_background_opacity === 'number'
          ? settings.custom_background_opacity
          : 1,
      );
      dim = clampBackgroundDim(
        typeof settings.custom_background_dim === 'number' ? settings.custom_background_dim : 0,
      );
      hasImage = await hasCustomBackgroundImage();
      if (hasImage) {
        const dataUrl = await invoke<string | null>('get_background_image_data_url');
        previewUrl = dataUrl;
      } else {
        previewUrl = null;
        enabled = false;
      }
    } catch (e) {
      logger.error('CustomBackgroundSettings', 'loadState', `Failed: ${e}`, { error: e });
    }
  }

  async function persistSettings() {
    saving = true;
    try {
      await saveSettingsWithQueue({
        custom_background_enabled: enabled && hasImage,
        custom_background_fit: fit,
        custom_background_opacity: opacity,
        custom_background_dim: dim,
      });
      await loadCustomBackground();
    } catch (e) {
      logger.error('CustomBackgroundSettings', 'persistSettings', `Failed: ${e}`, { error: e });
      toastStore.error('Failed to save background settings');
    } finally {
      saving = false;
    }
  }

  async function handleToggleEnabled() {
    if (!hasImage && enabled) {
      enabled = false;
      return;
    }
    await persistSettings();
  }

  function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toastStore.error('Please select an image smaller than 15MB.');
      return;
    }

    uploading = true;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await saveBackgroundImage(base64);
        hasImage = true;
        enabled = true;
        previewUrl = base64;
        await persistSettings();
        toastStore.success('Background image saved');
      } catch (e) {
        logger.error('CustomBackgroundSettings', 'handleImageUpload', `Failed: ${e}`, { error: e });
        toastStore.error('Failed to save background image');
      } finally {
        uploading = false;
      }
    };
    reader.onerror = () => {
      uploading = false;
      toastStore.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
    if (target) target.value = '';
  }

  async function removeBackground() {
    try {
      await deleteBackgroundImage();
      hasImage = false;
      previewUrl = null;
      enabled = false;
      await persistSettings();
      toastStore.success('Background image removed');
    } catch (e) {
      logger.error('CustomBackgroundSettings', 'removeBackground', `Failed: ${e}`, { error: e });
      toastStore.error('Failed to remove background image');
    }
  }

  onMount(() => {
    void loadState();
  });
</script>

<div class="p-4 space-y-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
  <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h4 class="text-sm font-semibold text-zinc-900 dark:text-white">
        <T key="settings.custom_background" fallback="Custom Background Image" />
      </h4>
      <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
        <T
          key="settings.custom_background_description"
          fallback="Use your own image behind the app, similar to the BetterSEQTA extension." />
      </p>
    </div>
    <label class="flex items-center gap-2 cursor-pointer shrink-0">
      <input
        type="checkbox"
        bind:checked={enabled}
        disabled={!hasImage || uploading || saving}
        onchange={handleToggleEnabled}
        class="w-4 h-4 rounded accent-bg" />
      <span class="text-sm text-zinc-800 dark:text-zinc-200">
        <T key="settings.custom_background_enabled" fallback="Enabled" />
      </span>
    </label>
  </div>

  {#if previewUrl}
    <div
      class="relative overflow-hidden rounded-xl border border-zinc-300/50 dark:border-zinc-700/50 h-36 sm:h-44">
      <div
        class="absolute inset-0 bg-center bg-no-repeat"
        style="background-image: url('{previewUrl}'); background-size: {fit === 'fill'
          ? '100% 100%'
          : fit}; opacity: {opacity};">
      </div>
      {#if dim > 0}
        <div class="absolute inset-0 bg-black" style="opacity: {dim};"></div>
      {/if}
    </div>
  {/if}

  <div class="flex flex-wrap gap-2">
    <label
      class="inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 accent-bg text-white hover:accent-bg-hover hover:scale-[1.02] active:scale-95 {uploading
        ? 'opacity-60 pointer-events-none'
        : ''}">
      <Icon src={Photo} class="w-4 h-4" />
      {#if uploading}
        Uploading...
      {:else}
        <T key="settings.custom_background_upload" fallback="Upload image" />
      {/if}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden"
        disabled={uploading}
        onchange={handleImageUpload} />
    </label>
    {#if hasImage}
      <button
        type="button"
        onclick={removeBackground}
        disabled={uploading || saving}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300/60 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50">
        <Icon src={Trash} class="w-4 h-4" />
        <T key="settings.custom_background_remove" fallback="Remove" />
      </button>
    {/if}
    {#if saving}
      <span class="inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
        <Icon src={ArrowPath} class="w-4 h-4 animate-spin" />
        Saving...
      </span>
    {/if}
  </div>

  <div class="grid gap-4 sm:grid-cols-2">
    <div class="flex flex-col gap-2">
      <label for="bg-fit" class="text-sm text-zinc-800 dark:text-zinc-200">
        <T key="settings.custom_background_fit" fallback="Image fit" />
      </label>
      <select
        id="bg-fit"
        bind:value={fit}
        disabled={!hasImage || uploading}
        onchange={persistSettings}
        class="px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white border-zinc-300/50 dark:border-zinc-700/50 focus:outline-none focus:ring-2 accent-ring">
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
        <option value="fill">Fill</option>
      </select>
    </div>

    <div class="flex flex-col gap-2">
      <label for="bg-opacity" class="text-sm text-zinc-800 dark:text-zinc-200">
        <T key="settings.custom_background_opacity" fallback="Image opacity" />
        ({Math.round(opacity * 100)}%)
      </label>
      <input
        id="bg-opacity"
        type="range"
        min="0.2"
        max="1"
        step="0.05"
        bind:value={opacity}
        disabled={!hasImage || uploading}
        onchange={persistSettings}
        class="w-full accent-bg" />
    </div>

    <div class="flex flex-col gap-2 sm:col-span-2">
      <label for="bg-dim" class="text-sm text-zinc-800 dark:text-zinc-200">
        <T key="settings.custom_background_dim" fallback="Dark overlay (readability)" />
        ({Math.round(dim * 100)}%)
      </label>
      <input
        id="bg-dim"
        type="range"
        min="0"
        max="0.8"
        step="0.05"
        bind:value={dim}
        disabled={!hasImage || uploading}
        onchange={persistSettings}
        class="w-full accent-bg" />
    </div>
  </div>
</div>
