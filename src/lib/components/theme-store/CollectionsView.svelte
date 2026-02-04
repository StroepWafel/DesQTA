<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Icon, RectangleStack } from 'svelte-hero-icons';
  import ThemeCard from './ThemeCard.svelte';
  import type { CloudTheme } from '$lib/services/themeStoreService';
  import type { ThemeManifest } from '$lib/services/themeService';

  interface CollectionData {
    id: string;
    name: string;
    description?: string;
    slug: string;
    cover_image_url?: string;
    featured: boolean;
    theme_count: number;
    themes: CloudTheme[];
    created_at: number;
  }

  interface Props {
    collections: CollectionData[];
    manifests?: Map<string, ThemeManifest>;
    currentThemeSlug?: string;
    downloadedThemeIds?: Set<string>;
    themeUserStatus?: Map<
      string,
      {
        is_favorited: boolean;
        has_rated: boolean;
        rating: { rating: number; comment?: string } | null;
      }
    >;
    themeUpdates?: Map<
      string,
      { hasUpdate: boolean; currentVersion?: string; latestVersion?: string }
    >;
    onPreview?: (themeId: string) => void;
    onDownload?: (themeId: string) => Promise<void>;
    onUpdate?: (themeId: string) => Promise<void>;
    onFavorite?: (themeId: string, favorited: boolean) => Promise<void>;
    onApply?: (themeSlug: string) => Promise<void>;
  }

  let {
    collections,
    manifests = new Map(),
    currentThemeSlug,
    downloadedThemeIds = new Set(),
    themeUserStatus = new Map(),
    themeUpdates = new Map(),
    onPreview,
    onDownload,
    onUpdate,
    onFavorite,
    onApply,
  }: Props = $props();
</script>

<div class="space-y-8">
  {#each collections as collection, i}
    <div
      transition:fly={{ y: 20, duration: 300, delay: i * 50, easing: cubicOut }}
      style="opacity: 0; transform: translateY(20px); animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1) {i *
        50}ms both;">
      <!-- Collection Header -->
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
          <Icon src={RectangleStack} class="w-6 h-6 accent-text" />
          <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">{collection.name}</h2>
          {#if collection.featured}
            <span class="px-2 py-1 text-xs font-medium bg-yellow-500 text-white rounded-full">
              Featured
            </span>
          {/if}
        </div>
        {#if collection.description}
          <p class="text-zinc-600 dark:text-zinc-400">{collection.description}</p>
        {/if}
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {collection.theme_count}
          {collection.theme_count === 1 ? 'theme' : 'themes'}
        </p>
      </div>

      <!-- Collection Themes Grid -->
      {#if collection.themes.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {#each collection.themes as theme, j}
            <ThemeCard
              {theme}
              manifest={manifests.get(theme.id)}
              isActive={theme.slug === currentThemeSlug}
              isDownloaded={installedThemeSlugs.has(theme.slug)}
              isFavorited={themeUserStatus.get(theme.id)?.is_favorited || false}
              hasUpdate={themeUpdates.get(theme.id)?.hasUpdate || false}
              updateInfo={themeUpdates.get(theme.id)}
              animationDelay={j * 50}
              {onPreview}
              {onDownload}
              {onUpdate}
              {onFavorite}
              {onApply} />
          {/each}
        </div>
      {:else}
        <div class="text-center py-12 text-zinc-500 dark:text-zinc-400">
          No themes in this collection yet.
        </div>
      {/if}
    </div>
  {/each}
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
</style>
