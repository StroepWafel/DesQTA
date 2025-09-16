<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { themeService, type ThemeManifest } from '$lib/services/themeService';
  import { loadAndApplyTheme, currentTheme, startThemePreview, cancelThemePreview, applyPreviewTheme, previewingTheme } from '$lib/stores/theme';
  import { get } from 'svelte/store';
  import { themeBuilderSidebarOpen } from '$lib/stores/themeBuilderSidebar';
  import { Icon, Swatch, ShoppingCart, PaintBrush, Eye, CheckCircle } from 'svelte-hero-icons';

  let availableThemes: ThemeManifest[] = [];
  let loading = true;
  let error: string | null = null;
  let currentThemeName = 'default';
  let themeCategories: { id: string; name: string }[] = [];
  
  // Store-like features
  let searchQuery = '';
  let selectedCategory = 'all';
  let rotateInterval: any = null;
  let currentSlide = 0;
  
  const slides = [
    {
      title: 'Discover your look',
      description: 'Browse themes crafted for DesQTA — clean, vibrant, and fast.',
    },
    {
      title: 'Make it yours',
      description: 'Pick a theme that matches your vibe. Switch instantly.',
    },
    {
      title: 'Create and share',
      description: 'Use Theme Builder to design your own theme in minutes.',
    }
  ];

  onDestroy(() => {
    cancelThemePreview();
  });

  // Load all themes dynamically from both static and custom directories
  async function loadThemes() {
    loading = true;
    error = null;
    try {
      // Get available theme names from backend
      const themeNames = await themeService.getAvailableThemes();
      
      // Load manifests for all available themes
      const themePromises = themeNames.map(async (name) => {
        try {
          return await themeService.getThemeManifest(name);
        } catch (err) {
          console.warn(`Failed to load theme manifest for ${name}:`, err);
          return null;
        }
      });
      
      const themes = await Promise.all(themePromises);
      availableThemes = themes.filter((t): t is ThemeManifest => t !== null);
      themeCategories = generateCategories(availableThemes);
      
      // Loaded themes ready
    } catch (e) {
      console.error('Failed to load themes:', e);
      error = 'Failed to load themes. Please try again.';
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

    rotateInterval = setInterval(() => {
      currentSlide = (currentSlide + 1) % slides.length;
    }, 5000);
  });

  // Cleanup rotation timer
  if (typeof window !== 'undefined') {
    addEventListener('beforeunload', () => clearInterval(rotateInterval));
  }

  async function handleApplyTheme(themeName: string) {
    await loadAndApplyTheme(themeName);
  }

  function getThemePreviewStyle(theme: ThemeManifest) {
    if (theme.features.glassmorphism) {
      return `backdrop-filter: blur(8px); background: ${theme.customProperties.backgroundColor}`;
    }
    if (theme.features.gradients && theme.customProperties.primaryColor && theme.customProperties.secondaryColor) {
      return `background: linear-gradient(135deg, ${theme.customProperties.primaryColor} 0%, ${theme.customProperties.secondaryColor} 100%)`;
    }
    return `background: ${theme.customProperties.backgroundColor}`;
  }

  function getThemePreviewImage(theme: ThemeManifest): string | null {
    const thumb = (theme as any)?.preview?.thumbnail as string | undefined;
    if (!thumb) return null;
    if (thumb.startsWith('http') || thumb.startsWith('tauri://') || thumb.startsWith('/themes/')) {
      return thumb;
    }
    if (thumb.startsWith('/')) {
      return thumb;
    }
    // Assume relative to the theme directory
    return `/themes/${getThemeId(theme)}/${thumb}`;
  }

  function generateCategories(themes: ThemeManifest[]) {
    const set = new Set<string>();
    themes.forEach(t => {
      if (t.category) set.add(t.category);
    });
    const cats = Array.from(set).sort().map((c) => ({ id: c, name: capitalizeName(c) }));
    return [{ id: 'all', name: 'All' }, ...cats, { id: 'custom', name: 'Custom' }];
  }

  function capitalizeName(name: string) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  async function handleThemeDeleted(themeName: string) {
    try {
      await themeService.deleteCustomTheme(themeName);
      // Reload themes to reflect the deletion
      await loadThemes();
      // No full-page reload; simply update the list
      
      // If the deleted theme was the current theme, switch to default
      if (currentThemeName === themeName) {
        await handleApplyTheme('default');
      }
    } catch (error) {
      console.error('Failed to delete theme:', error);
    }
  }

  async function handleThemeCreated() {
    // Reload themes to show the new custom theme
    await loadThemes();
  }
  
  function getFilteredThemes() {
    let filtered = availableThemes;
    
    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(theme => 
        theme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        theme.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        theme.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(theme => {
        if (selectedCategory === 'custom') return theme.category === 'custom';
        return (theme.category || '').toLowerCase() === selectedCategory.toLowerCase();
      });
    }
    
    // Simple sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    return filtered;
  }
  
  // Get theme ID (directory name) from theme object
  function getThemeId(theme: ThemeManifest): string {
    // Map display names to directory names
    const nameMapping: {[key: string]: string} = {
      'Pink Dream': 'pink-dream',
      'Neon Cyber': 'neon-cyber'
    };
    
    return nameMapping[theme.name] || theme.name.toLowerCase().replace(/\s+/g, '-');
  }
  
</script>

<!-- Theme Store Header -->
<div class="relative overflow-hidden bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
  <div class="absolute inset-0 bg-[url('/api/placeholder/1920/400')] opacity-5"></div>
  <div class="relative px-6 py-12 max-w-7xl mx-auto">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <a 
            href="/settings" 
            class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xs text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-all duration-200 shadow-xs hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back
          </a>
          <div class="h-8 w-px bg-zinc-300 dark:bg-zinc-600"></div>
          <Icon src={ShoppingCart} class="w-8 h-8 text-zinc-700 dark:text-zinc-300" />
          <h1 class="text-4xl font-bold text-zinc-900 dark:text-white">Theme Store</h1>
        </div>
        <div class="relative w-full max-w-3xl">
          <div class="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-md">
            <div class="p-6 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xs min-h-[120px] transition-all duration-200">
              <div class="text-2xl font-bold text-zinc-900 dark:text-white">{slides[currentSlide].title}</div>
              <div class="text-zinc-600 dark:text-zinc-300 mt-2">{slides[currentSlide].description}</div>
            </div>
            <div class="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50">
              <div class="flex gap-1">
                {#each slides as _, idx}
                  <span class="h-1.5 w-8 rounded-full {currentSlide === idx ? 'accent-bg' : 'bg-zinc-300 dark:bg-zinc-700'} transition-all"></span>
                {/each}
              </div>
              <div class="flex gap-2">
                <button class="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors" onclick={() => currentSlide = (currentSlide - 1 + slides.length) % slides.length}>‹</button>
                <button class="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors" onclick={() => currentSlide = (currentSlide + 1) % slides.length}>›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xs rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 shadow-xs">
          <div class="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Currently Active</div>
          <div class="font-semibold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
            <Icon src={CheckCircle} class="w-5 h-5 text-green-500" />
            {capitalizeName(currentThemeName)}
          </div>
        </div>
        {#if currentThemeName !== 'default'}
          <button
            class="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
            onclick={() => handleApplyTheme('default')}
            aria-label="Disable current theme"
            title="Disable current theme"
          >
            Disable Current Theme
          </button>
        {/if}
        <button
          class="flex items-center gap-2 px-6 py-3 rounded-xl accent-bg hover:accent-bg-hover text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring focus:ring-offset-2"
          onclick={() => themeBuilderSidebarOpen.set(true)}
        >
          <Icon src={Swatch} class="w-5 h-5" />
          Theme Builder
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Store Navigation & Filters -->
<div class="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-700">
  <div class="px-6 py-4 max-w-7xl mx-auto">
    <div class="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
      <!-- Search Bar -->
      <div class="relative flex-1 max-w-md">
        <input 
          type="text" 
          placeholder="Search themes..."
          bind:value={searchQuery}
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 accent-ring focus:border-transparent transition-all duration-200"
        />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center">
          <svg class="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>
      
      <!-- Category Filters -->
      <div class="flex items-center gap-2 overflow-x-auto">
        {#each themeCategories as category}
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 {selectedCategory === category.id ? 'accent-bg text-white' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
            onclick={() => selectedCategory = category.id}
          >
            <Icon src={PaintBrush} class="w-4 h-4" />
            {category.name}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<!-- Main Content -->
<div class="px-6 py-8 max-w-7xl mx-auto">

  {#if loading}
    <div class="flex justify-center items-center py-16">
      <div class="flex flex-col gap-4 items-center">
        <div class="w-12 h-12 rounded-full border-4 animate-spin border-zinc-200 dark:border-zinc-700 border-t-accent"></div>
        <p class="text-lg text-zinc-600 dark:text-zinc-400">Loading amazing themes...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
      <div class="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">Oops! Something went wrong</div>
      <p class="text-red-500 dark:text-red-300">{error}</p>
    </div>
  {:else}
    <!-- Theme Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each getFilteredThemes() as theme, i (theme.name)}
        <div class="relative group">
            <!-- Grid Card -->
            <div class="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
              <!-- Theme Preview -->
              <div class="relative h-48 overflow-hidden" style="{getThemePreviewStyle(theme)}">
                {#if getThemePreviewImage(theme)}
                  <img src={getThemePreviewImage(theme)} alt={`${theme.name} preview`} class="absolute inset-0 w-full h-full object-cover" />
                {/if}
                <div class="absolute inset-0 bg-linear-to-br from-black/10 to-black/30"></div>
                <div class="absolute top-3 left-3 flex gap-2">
                  {#if currentThemeName === getThemeId(theme)}
                    <span class="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full flex items-center gap-1">
                      <Icon src={CheckCircle} class="w-3 h-3" />
                      Active
                    </span>
                  {/if}
                </div>
              </div>
              
              <!-- Theme Info -->
              <div class="p-6">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h3 class="text-lg font-bold text-zinc-900 dark:text-white mb-1">{theme.name}</h3>
                    <p class="text-sm text-zinc-600 dark:text-zinc-400">by {theme.author}</p>
                  </div>
                </div>
                
                <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">{theme.description}</p>
                
                <div class="flex items-center justify-between mb-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>v{theme.version}</span>
                </div>
                
                <div class="flex gap-2">
                  <button
                    class="flex-1 px-4 py-2 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-colors"
                    onclick={() => startThemePreview(getThemeId(theme))}
                  >
                    <Icon src={Eye} class="w-4 h-4 inline mr-2" />
                    Preview
                  </button>
                  {#if currentThemeName !== getThemeId(theme)}
                    <button
                      class="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium rounded-xl transition-colors"
                      onclick={() => handleApplyTheme(getThemeId(theme))}
                    >
                      Apply
                    </button>
                  {/if}
                </div>
              </div>
              
              {#if theme.category === 'custom'}
                <button
                  type="button"
                  onclick={() => handleThemeDeleted(theme.name)}
                  class="absolute top-3 right-12 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors bg-white/20 backdrop-blur-xs rounded-full"
                  aria-label="Delete custom theme"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              {/if}
            </div>
        </div>
      {/each}
    </div>
    
    {#if getFilteredThemes().length === 0}
      <div class="text-center py-16">
        <div class="w-24 h-24 mx-auto mb-6 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
          <Icon src={PaintBrush} class="w-12 h-12 text-zinc-400" />
        </div>
        <h3 class="text-xl font-semibold text-zinc-900 dark:text-white mb-2">No themes found</h3>
        <p class="text-zinc-600 dark:text-zinc-400 mb-6">Try adjusting your search or filter criteria.</p>
        <button
          class="px-6 py-3 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-colors"
          onclick={() => { searchQuery = ''; selectedCategory = 'all'; }}
        >
          Clear Filters
        </button>
      </div>
    {/if}

    <!-- Live preview action bar -->
    {#if $previewingTheme}
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
          <span class="text-sm text-zinc-700 dark:text-zinc-300">Previewing <span class="font-semibold">{$previewingTheme}</span></span>
          <div class="h-5 w-px bg-zinc-300 dark:bg-zinc-700"></div>
          <button class="px-3 py-1.5 rounded-lg accent-bg hover:accent-bg-hover text-white text-sm font-medium" onclick={applyPreviewTheme}>Apply</button>
          <button class="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-medium" onclick={cancelThemePreview}>Cancel</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  @keyframes fade-in-up {
    0% { opacity: 0; transform: translateY(32px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in-up { animation: fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
</style>
