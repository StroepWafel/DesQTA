<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Icon, Eye, Heart, Star, ArrowDownTray, CheckCircle } from 'svelte-hero-icons';
  import type { CloudTheme } from '$lib/services/themeStoreService';
  import { resolveImageUrl } from '$lib/services/themeStoreService';
  import type { ThemeManifest } from '$lib/services/themeService';

  interface Props {
    theme: CloudTheme;
    manifest?: ThemeManifest;
    isActive?: boolean;
    isDownloaded?: boolean;
    isFavorited?: boolean;
    hasUpdate?: boolean;
    updateInfo?: { hasUpdate: boolean; currentVersion?: string; latestVersion?: string };
    animationDelay?: number;
    onQuickPreview?: (themeId: string) => Promise<void>;
    onDownload?: (themeId: string) => Promise<void>;
    onUpdate?: (themeId: string) => Promise<void>;
    onFavorite?: (themeId: string, favorited: boolean) => Promise<void>;
    onApply?: (themeSlug: string) => Promise<void>;
  }

  let {
    theme,
    manifest,
    isActive = false,
    isDownloaded = false,
    isFavorited = false,
    hasUpdate = false,
    updateInfo,
    animationDelay = 0,
    onQuickPreview,
    onDownload,
    onUpdate,
    onFavorite,
    onApply,
  }: Props = $props();

  let downloading = $state(false);
  let updating = $state(false);
  let favoriting = $state(false);
  let hovered = $state(false);

  async function handleDownload() {
    if (!onDownload || downloading) return;
    downloading = true;
    try {
      await onDownload(theme.id);
    } finally {
      downloading = false;
    }
  }

  async function handleUpdate() {
    if (!onUpdate || updating) return;
    updating = true;
    try {
      await onUpdate(theme.id);
    } finally {
      updating = false;
    }
  }

  async function handleFavorite() {
    if (!onFavorite || favoriting) return;
    favoriting = true;
    try {
      await onFavorite(theme.id, !isFavorited);
    } finally {
      favoriting = false;
    }
  }


  let previewImageUrl = $state<string | null>(null);

  // Load preview image with caching
  $effect(() => {
    (async () => {
      if (theme.preview?.thumbnail) {
        previewImageUrl = await resolveImageUrl(
          theme.preview.thumbnail,
          theme.id,
          'thumbnail',
          undefined,
          theme.updated_at,
        );
      } else if (manifest?.preview?.thumbnail) {
        previewImageUrl = await resolveImageUrl(
          manifest.preview.thumbnail,
          theme.id,
          'thumbnail',
          undefined,
          theme.updated_at,
        );
      } else {
        previewImageUrl = null;
      }
    })();
  });

  function getPreviewStyle(): string {
    if (manifest?.features?.glassmorphism) {
      return `backdrop-filter: blur(8px); background: ${manifest.customProperties.backgroundColor || '#1a0f0f'}`;
    }
    if (
      manifest?.features?.gradients &&
      manifest.customProperties.primaryColor &&
      manifest.customProperties.secondaryColor
    ) {
      return `background: linear-gradient(135deg, ${manifest.customProperties.primaryColor} 0%, ${manifest.customProperties.secondaryColor} 100%)`;
    }
    return `background: ${manifest?.customProperties?.backgroundColor || '#1a0f0f'}`;
  }
</script>

<div
  class="relative group theme-card"
  role="article"
  transition:fly={{ y: 20, duration: 300, delay: animationDelay, easing: cubicOut }}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}>
  <div
    class="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden h-full flex flex-col">
    <!-- Theme Preview -->
    <div class="relative h-48 overflow-hidden" style={getPreviewStyle()}>
      {#if previewImageUrl}
        <img
          src={previewImageUrl}
          alt={`${theme.name} preview`}
          class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 {hovered
            ? 'scale-105'
            : 'scale-100'}"
          loading="lazy" />
      {/if}
      <div class="absolute inset-0 bg-linear-to-br from-black/10 to-black/30"></div>

      <!-- Badges -->
      <div class="absolute top-3 left-3 flex gap-2 flex-wrap">
        {#if isActive}
          <span
            class="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full flex items-center gap-1 backdrop-blur-sm">
            <Icon src={CheckCircle} class="w-3 h-3" />
            Active
          </span>
        {/if}
        {#if hasUpdate}
          <span
            class="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded-full flex items-center gap-1 backdrop-blur-sm animate-pulse">
            Update Available
          </span>
        {/if}
        {#if theme.featured}
          <span
            class="px-2 py-1 text-xs font-medium bg-yellow-500 text-white rounded-full backdrop-blur-sm">
            Featured
          </span>
        {/if}
      </div>

      <!-- Favorite Button - Higher z-index to stay above overlay -->
      <button
        type="button"
        class="absolute top-3 right-3 z-20 p-2 rounded-full backdrop-blur-sm bg-white/20 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/30 transition-all duration-200 transform hover:scale-110 active:scale-95 {isFavorited
          ? 'text-red-500'
          : 'text-white'}"
        onclick={handleFavorite}
        disabled={favoriting}
        aria-label={isFavorited ? 'Unfavorite theme' : 'Favorite theme'}>
        <Icon
          src={Heart}
          class="w-5 h-5 transition-all duration-200 {isFavorited ? 'fill-current' : ''}" />
      </button>

      <!-- Overlay on hover -->
      {#if hovered && onQuickPreview}
        <div
          class="absolute inset-0 z-10 bg-black/40 backdrop-blur-xs flex items-center justify-center transition-all duration-200"
          transition:fade={{ duration: 200 }}>
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
            onclick={async () => {
              if (onQuickPreview) {
                await onQuickPreview(theme.id);
              }
            }}>
            <Icon src={Eye} class="w-5 h-5 inline mr-2" />
            Preview
          </button>
        </div>
      {/if}
    </div>

    <!-- Theme Info -->
    <div class="p-6 flex-1 flex flex-col">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <h3 class="text-lg font-bold text-zinc-900 dark:text-white mb-1 line-clamp-1">
            {theme.name}
          </h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">by {theme.author}</p>
        </div>
      </div>

      <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2 flex-1">
        {theme.description}
      </p>

      <!-- Stats -->
      <div class="flex items-center gap-4 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        {#if theme.rating_count > 0}
          <div class="flex items-center gap-1">
            <Icon src={Star} class="w-3 h-3 text-yellow-500 fill-current" />
            <span>{theme.rating_average.toFixed(1)}</span>
            <span class="text-zinc-400">({theme.rating_count})</span>
          </div>
        {/if}
        <div class="flex items-center gap-1">
          <Icon src={ArrowDownTray} class="w-3 h-3" />
          <span>{theme.download_count.toLocaleString()}</span>
        </div>
        <span>
          v{theme.version}
          {#if hasUpdate && updateInfo?.currentVersion}
            <span class="text-zinc-400"> → v{updateInfo.latestVersion}</span>
          {/if}
        </span>
      </div>

      <!-- Tags -->
      {#if theme.tags && theme.tags.length > 0}
        <div class="flex flex-wrap gap-1 mb-4">
          {#each theme.tags.slice(0, 3) as tag}
            <span
              class="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              {tag}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex gap-2 mt-auto">
        {#if hasUpdate && onUpdate}
          <!-- Update available, show Update button -->
          <button
            type="button"
            class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={handleUpdate}
            disabled={updating}>
            {#if updating}
              <span
                class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
              ></span>
              Updating...
            {:else}
              <Icon src={ArrowDownTray} class="w-4 h-4 inline mr-2" />
              Update
            {/if}
          </button>
        {:else if isDownloaded && onApply}
          <!-- Theme is installed, show Apply button -->
          <button
            type="button"
            class="flex-1 px-4 py-2 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
            onclick={() => onApply(theme.slug)}>
            {isActive ? 'Applied' : 'Apply'}
          </button>
        {:else if onDownload}
          <!-- Theme not installed, show Download button -->
          <button
            type="button"
            class="flex-1 px-4 py-2 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={handleDownload}
            disabled={downloading}>
            {#if downloading}
              <span
                class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
              ></span>
              Downloading...
            {:else}
              <Icon src={ArrowDownTray} class="w-4 h-4 inline mr-2" />
              Download
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .theme-card {
    transform-origin: center center;
  }
</style>
