<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { themeService, type ThemeManifest } from '$lib/services/themeService';
  import {
    themeStoreService,
    type CloudTheme,
    type Collection,
  } from '$lib/services/themeStoreService';
  import {
    loadAndApplyTheme,
    currentTheme,
    startThemePreview,
    cancelThemePreview,
    applyPreviewTheme,
    previewingTheme,
  } from '$lib/stores/theme';
  import { get } from 'svelte/store';
  import { themeBuilderSidebarOpen } from '$lib/stores/themeBuilderSidebar';
  import {
    Icon,
    Swatch,
    ShoppingCart,
    Sparkles,
    ExclamationTriangle,
    CheckCircle,
    MagnifyingGlass,
    ChevronRight,
  } from 'svelte-hero-icons';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import ThemeCard from '$lib/components/theme-store/ThemeCard.svelte';
  import ThemePreview from '$lib/components/theme-store/ThemePreview.svelte';
  import ThemeFilters from '$lib/components/theme-store/ThemeFilters.svelte';
  import SpotlightCarousel from '$lib/components/theme-store/SpotlightCarousel.svelte';
  import CollectionsView from '$lib/components/theme-store/CollectionsView.svelte';
  import { logger } from '../../../utils/logger';
  import { resolveImageUrl } from '$lib/services/themeStoreService';

  // Cloud themes
  let cloudThemes: CloudTheme[] = $state([]);
  let cloudManifests: Map<string, ThemeManifest> = $state(new Map());
  let spotlightThemes: CloudTheme[] = $state([]);
  let collections: Collection[] = $state([]);

  // Built-in themes (fallback)
  let builtInThemes: ThemeManifest[] = $state([]);

  // Combined display
  let displayThemes: Array<CloudTheme | ThemeManifest> = $state([]);
  let allManifests: Map<string, ThemeManifest> = $state(new Map());

  // State
  let loading = $state(true);
  let error: string | null = $state(null);
  let storeAvailable = $state(true);
  let currentThemeName = $state('default');
  // Removed selectedView - everything shows on one page now
  let sortBy: 'popular' | 'newest' | 'rating' | 'downloads' | 'name' = $state('popular');
  let searchQuery = $state('');
  let selectedCategory = $state('all');
  let themeCategories: { id: string; name: string }[] = $state([]);

  // User status per theme (favorited, rated)
  let themeUserStatus = $state(
    new Map<
      string,
      {
        is_favorited: boolean;
        has_rated: boolean;
        rating: { rating: number; comment?: string } | null;
      }
    >(),
  );
  // Downloads and installed themes
  let downloadedThemeIds = $state(new Set<string>());
  let installedThemeSlugs = $state(new Set<string>());
  // Update detection: map theme ID to update info
  let themeUpdates = $state(
    new Map<string, { hasUpdate: boolean; currentVersion?: string; latestVersion?: string }>(),
  );

  // Preview modal
  let previewTheme: CloudTheme | null = $state(null);
  let previewManifest: ThemeManifest | null = $state(null);
  let previewOpen = $state(false);

  // Pagination
  let currentPage = $state(1);
  let totalPages = $state(1);
  const themesPerPage = 20;

  onDestroy(() => {
    cancelThemePreview();
  });

  async function loadBuiltInThemes() {
    try {
      const themeNames = await themeService.getAvailableThemes();
      const themePromises = themeNames.map(async (name) => {
        try {
          return await themeService.getThemeManifest(name);
        } catch (err) {
          logger.warn('theme-store', 'loadBuiltInThemes', `Failed to load ${name}`, { error: err });
          return null;
        }
      });

      const themes = await Promise.all(themePromises);
      builtInThemes = themes.filter((t): t is ThemeManifest => t !== null);

      // Add to manifests map
      builtInThemes.forEach((theme) => {
        allManifests.set(theme.name.toLowerCase().replace(/\s+/g, '-'), theme);
      });

      logger.debug('theme-store', 'loadBuiltInThemes', 'Loaded built-in themes', {
        count: builtInThemes.length,
      });
    } catch (e) {
      logger.error('theme-store', 'loadBuiltInThemes', 'Failed to load built-in themes', {
        error: e,
      });
    }
  }

  function extractUserStatusFromTheme(theme: CloudTheme) {
    // Extract user status from theme object (included in API response)
    themeUserStatus.set(theme.id, {
      is_favorited: theme.is_favorited || false,
      has_rated: !!theme.user_rating,
      rating: theme.user_rating || null,
    });
  }

  async function loadCloudThemes() {
    try {
      storeAvailable = themeStoreService.isStoreAvailable();

      if (!storeAvailable) {
        logger.warn('theme-store', 'loadCloudThemes', 'Store unavailable, using built-in themes');
        displayThemes = builtInThemes;
        return;
      }

      // Load spotlight themes
      const spotlightResponse = await themeStoreService.getSpotlight();
      if (spotlightResponse) {
        spotlightThemes = spotlightResponse.themes;
        // Extract user status from theme objects (included in API response)
        spotlightThemes.forEach((theme) => extractUserStatusFromTheme(theme));
      }

      // Load all themes
      const response = await themeStoreService.listThemes({
        page: currentPage,
        limit: themesPerPage,
        sort: sortBy,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery || undefined,
      });

      if (response) {
        cloudThemes = response.themes;
        totalPages = response.pagination.total_pages;

        // Load manifests for cloud themes
        const manifestPromises = cloudThemes.map(async (theme) => {
          try {
            const detail = await themeStoreService.getTheme(theme.id);
            if (detail?.theme?.manifest) {
              return { id: theme.id, manifest: detail.theme.manifest };
            }
          } catch (err) {
            logger.warn(
              'theme-store',
              'loadCloudThemes',
              `Failed to load manifest for ${theme.id}`,
              {
                error: err,
              },
            );
          }
          return null;
        });

        const manifests = await Promise.all(manifestPromises);
        manifests.forEach((item) => {
          if (item) {
            cloudManifests.set(item.id, item.manifest);
            allManifests.set(item.id, item.manifest);
          }
        });

        // Extract user status from theme objects (included in API response)
        cloudThemes.forEach((theme) => extractUserStatusFromTheme(theme));

        displayThemes = cloudThemes;
        storeAvailable = true;
      } else {
        // Store unavailable, fall back to built-in
        storeAvailable = false;
        displayThemes = builtInThemes;
      }
    } catch (e) {
      logger.error('theme-store', 'loadCloudThemes', 'Failed to load cloud themes', { error: e });
      storeAvailable = false;
      displayThemes = builtInThemes;
    }
  }

  async function loadCollections() {
    try {
      const response = await themeStoreService.getCollections();
      if (response) {
        collections = response.collections;
        // Extract user status from theme objects in collections (included in API response)
        collections.forEach((collection) => {
          collection.themes.forEach((theme) => extractUserStatusFromTheme(theme));
        });
      }
    } catch (e) {
      logger.error('theme-store', 'loadCollections', 'Failed to load collections', { error: e });
    }
  }

  async function loadDownloadedThemeIds() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['downloaded_theme_ids'] });
      const ids: string[] = subset?.downloaded_theme_ids || [];
      downloadedThemeIds = new Set(ids);
    } catch (e) {
      logger.error('theme-store', 'loadDownloadedThemeIds', 'Failed to load downloaded IDs', {
        error: e,
      });
    }
  }

  async function loadInstalledThemeSlugs() {
    try {
      const availableThemes = await themeService.getAvailableThemes();
      installedThemeSlugs = new Set(availableThemes);
    } catch (e) {
      logger.error('theme-store', 'loadInstalledThemeSlugs', 'Failed to load installed themes', {
        error: e,
      });
    }
  }

  async function checkThemeUpdates() {
    if (!storeAvailable) return;

    try {
      // Check updates for all installed cloud themes
      const updates = new Map<
        string,
        { hasUpdate: boolean; currentVersion?: string; latestVersion?: string }
      >();

      for (const themeId of downloadedThemeIds) {
        try {
          const updateInfo = await themeService.checkThemeUpdate(themeId);
          if (updateInfo.hasUpdate) {
            updates.set(themeId, {
              hasUpdate: true,
              currentVersion: updateInfo.currentVersion,
              latestVersion: updateInfo.latestVersion,
            });
          }
        } catch (e) {
          logger.warn('theme-store', 'checkThemeUpdates', `Failed to check update for ${themeId}`, {
            error: e,
          });
        }
      }

      themeUpdates = updates;
      logger.debug('theme-store', 'checkThemeUpdates', 'Checked theme updates', {
        updatesFound: updates.size,
      });
    } catch (e) {
      logger.error('theme-store', 'checkThemeUpdates', 'Failed to check theme updates', {
        error: e,
      });
    }
  }

  async function loadThemes() {
    loading = true;
    error = null;

    try {
      // Always load built-in themes first (for fallback)
      await loadBuiltInThemes();

      // Try to load cloud themes
      await loadCloudThemes();

      // Load collections
      await loadCollections();

      // Load downloaded theme IDs
      await loadDownloadedThemeIds();

      // Load installed theme slugs (check what's actually installed locally)
      await loadInstalledThemeSlugs();

      // Check for theme updates
      await checkThemeUpdates();

      // Generate categories
      const categorySet = new Set<string>();
      displayThemes.forEach((theme) => {
        if ('category' in theme && theme.category) {
          categorySet.add(theme.category);
        }
      });
      themeCategories = [
        { id: 'all', name: 'All' },
        ...Array.from(categorySet)
          .sort()
          .map((c) => ({ id: c, name: capitalizeName(c) })),
        { id: 'builtin', name: 'Built-in' },
      ];
    } catch (e) {
      logger.error('theme-store', 'loadThemes', 'Failed to load themes', { error: e });
      error = 'Failed to load themes. Please try again.';
      displayThemes = builtInThemes;
    } finally {
      loading = false;
    }
  }

  async function loadCurrentTheme() {
    try {
      currentThemeName = get(currentTheme);
    } catch {
      currentThemeName = 'default';
    }
  }

  onMount(async () => {
    await loadThemes();
    await loadCurrentTheme();
    currentTheme.subscribe((val) => {
      currentThemeName = val;
    });

    // Initialize theme sync in background
    themeService.initializeThemeSync().catch((e) => {
      logger.error('theme-store', 'onMount', 'Failed to initialize theme sync', { error: e });
    });
  });

  async function handleDownloadTheme(themeId: string) {
    try {
      // Check if theme is already installed locally
      const theme = cloudThemes.find((t) => t.id === themeId);
      if (theme && installedThemeSlugs.has(theme.slug)) {
        // Theme is already installed, just apply it
        await handleApplyTheme(theme.slug);
        return;
      }

      // Download and install the theme
      await themeService.loadCloudTheme(themeId);
      await loadDownloadedThemeIds();
      await loadInstalledThemeSlugs(); // Refresh installed themes list
      await checkThemeUpdates(); // Check for updates after download
      await loadThemes(); // Reload to update UI
    } catch (e) {
      logger.error('theme-store', 'handleDownloadTheme', 'Failed to download theme', {
        error: e,
        themeId,
      });
      throw e;
    }
  }

  async function handleUpdateTheme(themeId: string) {
    // Update is same as download - re-downloads the latest version
    await handleDownloadTheme(themeId);
  }

  async function handleFavoriteTheme(themeId: string, favorited: boolean) {
    try {
      if (favorited) {
        const success = await themeStoreService.favoriteTheme(themeId);
        if (success) {
          // Update user status
          const currentStatus = themeUserStatus.get(themeId) || {
            is_favorited: false,
            has_rated: false,
            rating: null,
          };
          themeUserStatus.set(themeId, {
            ...currentStatus,
            is_favorited: true,
          });
          // Update favorite count and is_favorited in theme object
          const theme = cloudThemes.find((t) => t.id === themeId);
          if (theme) {
            theme.favorite_count = (theme.favorite_count || 0) + 1;
            theme.is_favorited = true;
          }
          // Also update in spotlight themes
          const spotlightTheme = spotlightThemes.find((t) => t.id === themeId);
          if (spotlightTheme) {
            spotlightTheme.favorite_count = (spotlightTheme.favorite_count || 0) + 1;
            spotlightTheme.is_favorited = true;
          }
        }
      } else {
        const success = await themeStoreService.unfavoriteTheme(themeId);
        if (success) {
          // Update user status
          const currentStatus = themeUserStatus.get(themeId) || {
            is_favorited: false,
            has_rated: false,
            rating: null,
          };
          themeUserStatus.set(themeId, {
            ...currentStatus,
            is_favorited: false,
          });
          // Update favorite count and is_favorited in theme object
          const theme = cloudThemes.find((t) => t.id === themeId);
          if (theme && theme.favorite_count > 0) {
            theme.favorite_count = theme.favorite_count - 1;
            theme.is_favorited = false;
          }
          // Also update in spotlight themes
          const spotlightTheme = spotlightThemes.find((t) => t.id === themeId);
          if (spotlightTheme && spotlightTheme.favorite_count > 0) {
            spotlightTheme.favorite_count = spotlightTheme.favorite_count - 1;
            spotlightTheme.is_favorited = false;
          }
        }
      }
    } catch (e) {
      logger.error('theme-store', 'handleFavoriteTheme', 'Failed to favorite theme', {
        error: e,
        themeId,
      });
    }
  }

  async function handlePreviewTheme(themeId: string) {
    const theme = cloudThemes.find((t) => t.id === themeId);
    if (theme) {
      previewTheme = theme;
      previewManifest = cloudManifests.get(themeId) || null;
      previewOpen = true;
    }
  }

  async function handleApplyFromPreview() {
    if (previewTheme) {
      const themeSlug = previewTheme.slug;
      if (installedThemeSlugs.has(themeSlug)) {
        // Theme is already installed, just apply it
        await loadAndApplyTheme(themeSlug);
      } else {
        // Download and install, then apply
        await handleDownloadTheme(previewTheme.id);
      }
      previewOpen = false;
    }
  }

  async function handleApplyTheme(themeSlug: string) {
    await loadAndApplyTheme(themeSlug);
    await loadCurrentTheme(); // Refresh current theme name
  }

  function getFilteredThemes() {
    let filtered = [...displayThemes]; // Create a copy to avoid mutating state

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter((theme) => {
        const name = isCloudTheme(theme) ? theme.name : theme.name;
        const description = isCloudTheme(theme) ? theme.description : theme.description;
        const author = isCloudTheme(theme) ? theme.author : theme.author;
        const query = searchQuery.toLowerCase();
        return (
          name.toLowerCase().includes(query) ||
          description.toLowerCase().includes(query) ||
          author.toLowerCase().includes(query)
        );
      });
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((theme) => {
        const category = isCloudTheme(theme) ? theme.category : theme.category;
        if (selectedCategory === 'builtin') {
          const themeName = isCloudTheme(theme) ? theme.name : theme.name;
          return builtInThemes.some((t) => t.name === themeName);
        }
        return (category || '').toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    // Sort (create new sorted array instead of mutating)
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = isCloudTheme(a) ? a.name : a.name;
        const nameB = isCloudTheme(b) ? b.name : b.name;
        return nameA.localeCompare(nameB);
      } else if (sortBy === 'popular' && isCloudTheme(a) && isCloudTheme(b)) {
        return b.download_count - a.download_count;
      } else if (sortBy === 'newest' && isCloudTheme(a) && isCloudTheme(b)) {
        return b.created_at - a.created_at;
      } else if (sortBy === 'rating' && isCloudTheme(a) && isCloudTheme(b)) {
        return b.rating_average - a.rating_average;
      } else if (sortBy === 'downloads' && isCloudTheme(a) && isCloudTheme(b)) {
        return b.download_count - a.download_count;
      }
      return 0;
    });

    return sorted;
  }

  function capitalizeName(name: string) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function isCloudTheme(theme: CloudTheme | ThemeManifest): theme is CloudTheme {
    return 'id' in theme && typeof theme.id === 'string';
  }

  function getThemeSlug(theme: CloudTheme | ThemeManifest): string {
    if (isCloudTheme(theme)) {
      return theme.slug;
    }
    return theme.name.toLowerCase().replace(/\s+/g, '-');
  }

  function getBuiltInPreviewImage(theme: ThemeManifest): string | null {
    if (theme.preview?.thumbnail) {
      return resolveImageUrl(theme.preview.thumbnail);
    }
    return null;
  }

  function getBuiltInPreviewStyle(theme: ThemeManifest): string {
    if (theme.features?.glassmorphism) {
      return `backdrop-filter: blur(8px); background: ${theme.customProperties?.backgroundColor || '#1a0f0f'}`;
    }
    if (
      theme.features?.gradients &&
      theme.customProperties?.primaryColor &&
      theme.customProperties?.secondaryColor
    ) {
      return `background: linear-gradient(135deg, ${theme.customProperties.primaryColor} 0%, ${theme.customProperties.secondaryColor} 100%)`;
    }
    return `background: ${theme.customProperties?.backgroundColor || '#1a0f0f'}`;
  }
</script>

<!-- Minimal Store Header -->
<div
  class="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-700 shadow-sm"
  transition:fade={{ duration: 200 }}>
  <div class="max-w-7xl mx-auto px-6 py-4">
    <div class="flex items-center justify-between gap-4">
      <!-- Left: Back + Title -->
      <div class="flex items-center gap-4 min-w-0 flex-1">
        <a
          href="/settings"
          class="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all duration-200 transform hover:scale-110 active:scale-95 flex-shrink-0"
          title="Back to Settings">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"></path>
          </svg>
        </a>
        <div class="h-6 w-px bg-zinc-200 dark:bg-zinc-700 flex-shrink-0"></div>
        <h1
          class="text-xl font-semibold text-zinc-900 dark:text-white truncate"
          transition:fade={{ duration: 200 }}>
          <T key="settings.theme_store" fallback="Theme Store" />
        </h1>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          class="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-200"
          title={capitalizeName(currentThemeName)}>
          <Icon src={Sparkles} class="w-4 h-4" />
          <span class="truncate max-w-[100px]">{capitalizeName(currentThemeName)}</span>
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-lg accent-bg hover:accent-bg-hover text-white font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
          onclick={() => themeBuilderSidebarOpen.set(true)}>
          <Icon src={Swatch} class="w-5 h-5" />
          <span class="hidden sm:inline">Theme Builder</span>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Store Unavailable Banner -->
{#if !storeAvailable}
  <div
    class="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-6 py-3"
    transition:fade={{ duration: 200 }}>
    <div class="max-w-7xl mx-auto flex items-center gap-3">
      <Icon
        src={ExclamationTriangle}
        class="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
      <p class="text-sm text-yellow-800 dark:text-yellow-300">
        Theme store is currently unavailable. Showing built-in themes only.
      </p>
    </div>
  </div>
{/if}

<!-- Integrated Search & Filters -->
<div
  class="sticky top-[73px] z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-700"
  transition:fade={{ duration: 200 }}>
  <div class="max-w-7xl mx-auto px-6 py-4">
    <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
      <!-- Search Bar -->
      <div class="relative flex-1 w-full lg:max-w-md">
        <input
          type="text"
          placeholder="Search themes..."
          bind:value={searchQuery}
          oninput={(e) => {
            searchQuery = e.currentTarget.value;
            loadCloudThemes();
          }}
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 accent-ring focus:border-transparent transition-all duration-200" />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon src={MagnifyingGlass} class="w-5 h-5 text-zinc-400" />
        </div>
      </div>

      <!-- Category Filters -->
      <div class="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 flex-1 lg:justify-end">
        {#each themeCategories as category, i}
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 transform hover:scale-105 active:scale-95 {selectedCategory ===
            category.id
              ? 'accent-bg text-white shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}"
            onclick={() => {
              selectedCategory = category.id;
              loadCloudThemes();
            }}
            transition:fade={{ duration: 200, delay: i * 30 }}>
            {category.name}
          </button>
        {/each}
      </div>

      <!-- Sort Dropdown -->
      <div class="relative flex-shrink-0">
        <select
          bind:value={sortBy}
          onchange={(e) => {
            sortBy = e.currentTarget.value as
              | 'popular'
              | 'newest'
              | 'rating'
              | 'downloads'
              | 'name';
            loadCloudThemes();
          }}
          class="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 accent-ring transition-all duration-200 appearance-none cursor-pointer pr-10">
          <option value="popular">Most Popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Highest Rated</option>
          <option value="downloads">Most Downloaded</option>
          <option value="name">Name (A-Z)</option>
        </select>
        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Main Content -->
<div class="px-6 py-6 max-w-7xl mx-auto">
  {#if loading}
    <div class="flex justify-center items-center py-16">
      <div class="flex flex-col gap-4 items-center">
        <div
          class="w-12 h-12 rounded-full border-4 animate-spin border-zinc-200 dark:border-zinc-700 border-t-accent">
        </div>
        <p class="text-lg text-zinc-600 dark:text-zinc-400">
          <T key="settings.loading_amazing_themes" fallback="Loading amazing themes..." />
        </p>
      </div>
    </div>
  {:else if error}
    <div
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
      <div class="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
        <T key="settings.something_went_wrong" fallback="Oops! Something went wrong" />
      </div>
      <p class="text-red-500 dark:text-red-300">{error}</p>
      <button
        class="mt-4 px-6 py-3 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
        onclick={loadThemes}>
        Retry
      </button>
    </div>
  {:else}
    <!-- Featured Carousel -->
    {#if spotlightThemes && spotlightThemes.length > 0}
      <div class="mb-16">
        <SpotlightCarousel
          themes={spotlightThemes}
          manifests={cloudManifests}
          currentThemeSlug={currentThemeName}
          {installedThemeSlugs}
          {themeUserStatus}
          {themeUpdates}
          onPreview={handlePreviewTheme}
          onDownload={handleDownloadTheme}
          onUpdate={handleUpdateTheme}
          onFavorite={handleFavoriteTheme}
          onApply={handleApplyTheme} />
      </div>
    {/if}

    <!-- Collections Section -->
    {#if collections && collections.length > 0 && !searchQuery && selectedCategory === 'all'}
      <div class="mb-16">
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Collections</h2>
        <div class="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
          <div class="flex gap-6 min-w-max">
            {#each collections as collection, i}
              <div
                class="flex-shrink-0 w-[400px]"
                transition:fly={{ x: 20, duration: 300, delay: i * 50, easing: cubicOut }}>
                <!-- Collection Header with Cover Image -->
                <div class="relative h-48 rounded-2xl overflow-hidden mb-6 group cursor-pointer">
                  {#if collection.cover_image_url}
                    <img
                      src={resolveImageUrl(collection.cover_image_url)}
                      alt={collection.name}
                      class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {:else}
                    <div
                      class="absolute inset-0 bg-gradient-to-br from-zinc-400 to-zinc-600 dark:from-zinc-700 dark:to-zinc-900">
                    </div>
                  {/if}
                  <!-- Black gradient overlay -->
                  <div
                    class="absolute inset-0 bg-linear-to-b from-black/70 via-black/50 to-black/30">
                  </div>
                  <!-- Collection Title -->
                  <div class="absolute inset-0 flex items-end p-6">
                    <div>
                      <h3 class="text-2xl font-bold text-white mb-1">{collection.name}</h3>
                      {#if collection.description}
                        <p class="text-white/90 text-sm line-clamp-2">{collection.description}</p>
                      {/if}
                      <p class="text-white/70 text-xs mt-2">
                        {collection.theme_count}
                        {collection.theme_count === 1 ? 'theme' : 'themes'}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Collection Themes Grid -->
                {#if collection.themes.length > 0}
                  <div class="grid grid-cols-2 gap-4">
                    {#each collection.themes.slice(0, 4) as theme, j}
                      <ThemeCard
                        {theme}
                        manifest={cloudManifests.get(theme.id)}
                        isActive={theme.slug === currentThemeName}
                        isDownloaded={installedThemeSlugs.has(theme.slug)}
                        isFavorited={themeUserStatus.get(theme.id)?.is_favorited || false}
                        hasUpdate={themeUpdates.get(theme.id)?.hasUpdate || false}
                        updateInfo={themeUpdates.get(theme.id)}
                        animationDelay={j * 30}
                        onPreview={handlePreviewTheme}
                        onDownload={handleDownloadTheme}
                        onUpdate={handleUpdateTheme}
                        onFavorite={handleFavoriteTheme}
                        onApply={handleApplyTheme} />
                    {/each}
                  </div>
                  {#if collection.themes.length > 4}
                    <button
                      class="mt-4 w-full px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                      onclick={() => {
                        // TODO: Expand collection view
                      }}>
                      View All {collection.themes.length} Themes
                      <Icon src={ChevronRight} class="w-4 h-4" />
                    </button>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- All Themes Grid -->
    {#if getFilteredThemes().length > 0}
      <div>
        <h2 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
          {searchQuery || selectedCategory !== 'all' ? 'Search Results' : 'All Themes'}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {#each getFilteredThemes() as theme, i (isCloudTheme(theme) ? theme.id : theme.name)}
            {#if isCloudTheme(theme)}
              <ThemeCard
                {theme}
                manifest={cloudManifests.get(theme.id)}
                isActive={theme.slug === currentThemeName}
                isDownloaded={installedThemeSlugs.has(theme.slug)}
                isFavorited={themeUserStatus.get(theme.id)?.is_favorited || false}
                hasUpdate={themeUpdates.get(theme.id)?.hasUpdate || false}
                updateInfo={themeUpdates.get(theme.id)}
                animationDelay={i * 30}
                onPreview={handlePreviewTheme}
                onDownload={handleDownloadTheme}
                onUpdate={handleUpdateTheme}
                onFavorite={handleFavoriteTheme}
                onApply={handleApplyTheme} />
            {:else}
              <!-- Built-in theme card with preview image -->
              <div transition:fly={{ y: 20, duration: 300, delay: i * 30, easing: cubicOut }}>
                <div
                  class="relative group bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden h-full flex flex-col">
                  <!-- Theme Preview -->
                  <div class="relative h-48 overflow-hidden" style={getBuiltInPreviewStyle(theme)}>
                    {#if getBuiltInPreviewImage(theme)}
                      <img
                        src={getBuiltInPreviewImage(theme)}
                        alt={`${theme.name} preview`}
                        class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy" />
                    {/if}
                    <!-- Black gradient overlay from top to bottom (black to transparent) -->
                    <div
                      class="absolute inset-0 bg-linear-to-b from-black/60 via-black/30 to-transparent">
                    </div>

                    <!-- Active Badge -->
                    {#if getThemeSlug(theme) === currentThemeName}
                      <div class="absolute top-3 left-3">
                        <span
                          class="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full flex items-center gap-1 backdrop-blur-sm">
                          <Icon src={CheckCircle} class="w-3 h-3" />
                          Active
                        </span>
                      </div>
                    {/if}
                  </div>

                  <!-- Theme Info -->
                  <div class="p-6 flex-1 flex flex-col">
                    <h3 class="text-lg font-bold text-zinc-900 dark:text-white mb-1 line-clamp-1">
                      {theme.name}
                    </h3>
                    <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2 flex-1">
                      {theme.description}
                    </p>
                    <button
                      class="w-full px-4 py-2 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                      onclick={() => handleApplyTheme(getThemeSlug(theme))}>
                      {currentThemeName === getThemeSlug(theme) ? 'Applied' : 'Apply'}
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="flex items-center justify-center gap-2 mt-8">
            <button
              class="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === 1}
              onclick={() => {
                currentPage--;
                loadCloudThemes();
              }}>
              Previous
            </button>
            <span class="text-zinc-600 dark:text-zinc-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              class="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === totalPages}
              onclick={() => {
                currentPage++;
                loadCloudThemes();
              }}>
              Next
            </button>
          </div>
        {/if}
      </div>
    {:else if !loading}
      <div class="text-center py-16">
        <div
          class="w-24 h-24 mx-auto mb-6 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
          <Icon src={ShoppingCart} class="w-12 h-12 text-zinc-400" />
        </div>
        <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
          <T key="settings.no_themes_found" fallback="No themes found" />
        </h3>
        <p class="text-zinc-600 dark:text-zinc-400 mb-6">
          <T
            key="settings.try_adjusting_filters"
            fallback="Try adjusting your search or filter criteria." />
        </p>
        <button
          class="px-6 py-3 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          onclick={() => {
            searchQuery = '';
            selectedCategory = 'all';
            loadCloudThemes();
          }}>
          <T key="settings.clear_filters" fallback="Clear Filters" />
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Preview Modal -->
{#if previewTheme}
  <ThemePreview
    theme={previewTheme}
    manifest={previewManifest || undefined}
    open={previewOpen}
    onClose={() => (previewOpen = false)}
    onApply={handleApplyFromPreview}
    onThemeUpdate={(updatedTheme) => {
      // Update theme in cloudThemes array
      const index = cloudThemes.findIndex((t) => t.id === updatedTheme.id);
      if (index !== -1) {
        cloudThemes[index] = updatedTheme;
      }
      // Update in spotlight themes
      const spotlightIndex = spotlightThemes.findIndex((t) => t.id === updatedTheme.id);
      if (spotlightIndex !== -1) {
        spotlightThemes[spotlightIndex] = updatedTheme;
      }
      // Update preview theme if it's the same
      if (previewTheme?.id === updatedTheme.id) {
        previewTheme = updatedTheme;
      }
      // Update user status from updated theme
      extractUserStatusFromTheme(updatedTheme);
    }} />
{/if}

<!-- Live preview action bar -->
{#if $previewingTheme}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
    <div
      class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md transition-all duration-300">
      <span class="text-sm text-zinc-700 dark:text-zinc-300"
        >Previewing <span class="font-semibold">{$previewingTheme}</span></span>
      <div class="h-5 w-px bg-zinc-300 dark:bg-zinc-700"></div>
      <button
        class="px-3 py-1.5 rounded-lg accent-bg hover:accent-bg-hover text-white text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
        onclick={applyPreviewTheme}>
        <T key="settings.apply" fallback="Apply" />
      </button>
      <button
        class="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
        onclick={cancelThemePreview}>
        <T key="common.cancel" fallback="Cancel" />
      </button>
    </div>
  </div>
{/if}

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
