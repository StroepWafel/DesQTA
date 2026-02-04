<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Icon, Sparkles, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import ThemeCard from './ThemeCard.svelte';
  import type { CloudTheme } from '$lib/services/themeStoreService';
  import type { ThemeManifest } from '$lib/services/themeService';

  interface Props {
    themes: CloudTheme[];
    manifests?: Map<string, ThemeManifest>;
    currentThemeSlug?: string;
    installedThemeSlugs?: Set<string>;
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
    themes,
    manifests = new Map(),
    currentThemeSlug,
    installedThemeSlugs = new Set(),
    themeUserStatus = new Map(),
    themeUpdates = new Map(),
    onPreview,
    onDownload,
    onUpdate,
    onFavorite,
    onApply,
  }: Props = $props();

  let currentIndex = $state(0);
  let autoRotateInterval: ReturnType<typeof setInterval> | null = null;
  const ROTATE_INTERVAL = 5000; // 5 seconds

  function nextSlide() {
    if (themes.length > 0) {
      currentIndex = (currentIndex + 1) % themes.length;
    }
  }

  function prevSlide() {
    if (themes.length > 0) {
      currentIndex = (currentIndex - 1 + themes.length) % themes.length;
    }
  }

  function goToSlide(index: number) {
    currentIndex = index;
  }

  function startAutoRotate() {
    if (themes.length <= 1) return;
    autoRotateInterval = setInterval(() => {
      nextSlide();
    }, ROTATE_INTERVAL);
  }

  function stopAutoRotate() {
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
      autoRotateInterval = null;
    }
  }

  onMount(() => {
    startAutoRotate();
  });

  onDestroy(() => {
    stopAutoRotate();
  });
</script>

{#if themes.length > 0}
  <div
    class="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 shadow-xl"
    onmouseenter={stopAutoRotate}
    onmouseleave={startAutoRotate}>
    <!-- Header -->
    <div
      class="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
      <div class="flex items-center gap-3">
        <Icon src={Sparkles} class="w-6 h-6 accent-text" />
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">Featured Themes</h2>
      </div>
      {#if themes.length > 1}
        <div class="flex gap-2">
          <button
            type="button"
            class="p-2 rounded-lg bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all duration-200 transform hover:scale-110 active:scale-95"
            onclick={prevSlide}
            aria-label="Previous theme">
            <Icon src={ChevronLeft} class="w-5 h-5" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all duration-200 transform hover:scale-110 active:scale-95"
            onclick={nextSlide}
            aria-label="Next theme">
            <Icon src={ChevronRight} class="w-5 h-5" />
          </button>
        </div>
      {/if}
    </div>

    <!-- Carousel Content -->
    <div class="relative">
      {#each themes as theme, i}
        {#if i === currentIndex}
          <div
            class="p-6"
            transition:fly={{ x: i > currentIndex ? 100 : -100, duration: 400, easing: cubicOut }}>
            <ThemeCard
              {theme}
              manifest={manifests.get(theme.id)}
              isActive={theme.slug === currentThemeSlug}
              isDownloaded={installedThemeSlugs.has(theme.slug)}
              isFavorited={themeUserStatus.get(theme.id)?.is_favorited || false}
              hasUpdate={themeUpdates.get(theme.id)?.hasUpdate || false}
              updateInfo={themeUpdates.get(theme.id)}
              animationDelay={0}
              {onPreview}
              {onDownload}
              {onUpdate}
              {onFavorite}
              {onApply} />
          </div>
        {/if}
      {/each}
    </div>

    <!-- Navigation Dots -->
    {#if themes.length > 1}
      <div
        class="flex items-center justify-center gap-2 p-4 border-t border-zinc-200 dark:border-zinc-700">
        {#each themes as _, i}
          <button
            type="button"
            class="h-2 rounded-full transition-all duration-300 {i === currentIndex
              ? 'w-8 accent-bg'
              : 'w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600'}"
            onclick={() => goToSlide(i)}
            aria-label={`Go to theme ${i + 1}`}></button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
