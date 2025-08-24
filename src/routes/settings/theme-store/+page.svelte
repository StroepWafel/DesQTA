<script lang="ts">
  import { onMount } from 'svelte';
  import { themeService, type ThemeManifest } from '$lib/services/themeService';
  import { loadAndApplyTheme, currentTheme } from '$lib/stores/theme';
  import { get } from 'svelte/store';
  import ThemeBuilder from '$lib/components/ThemeBuilder.svelte';
  import { themeBuilderSidebarOpen } from '$lib/stores/themeBuilderSidebar';
  import { Icon, Swatch, Star, Heart, ArrowDownTray, ShoppingCart, Sparkles, Fire, ArrowTrendingUp, Newspaper, PaintBrush, Eye, CheckCircle } from 'svelte-hero-icons';

  let availableThemes: ThemeManifest[] = [];
  let selectedTheme: ThemeManifest | null = null;
  let loading = true;
  let error: string | null = null;
  let currentThemeName = 'default';
  let imgErrors: boolean[] = [];
  let themeOptions: any = {};
  let showAdvanced = false;
  let showFeatures = false;
  let showFonts = false;
  let showAnimations = false;
  let showCustom = false;
  
  // Store-like features
  let searchQuery = '';
  let selectedCategory = 'all';
  let sortBy = 'popular';
  let viewMode = 'grid'; // grid or list
  let favoriteThemes: string[] = [];
  let installedThemes: string[] = [];
  
  // Mock data for store features
  const themeCategories = [
    { id: 'all', name: 'All Themes', icon: PaintBrush },
    { id: 'popular', name: 'Popular', icon: Fire },
    { id: 'new', name: 'New & Trending', icon: ArrowTrendingUp },
    { id: 'girly', name: 'Pink Dream', icon: Heart },
    { id: 'neo', name: 'Neo/Cyber', icon: Sparkles },
    { id: 'anime', name: 'Anime', icon: Star },
    { id: 'minimal', name: 'Minimal', icon: Newspaper },
    { id: 'custom', name: 'Custom', icon: Swatch }
  ];
  
  const mockRatings: {[key: string]: number} = {
    'glass': 4.9,
    'pink-dream': 4.9,
    'aero': 4.8,
    'neon-cyber': 4.8,
    'midnight': 4.7,
    'bubblegum': 4.6,
    'light': 4.5,
    'grape': 4.4,
    'mint': 4.3,
    'solarized': 4.2,
    'sunset': 4.1,
    'default': 4.0
  };

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
      
      console.log(`Loaded ${availableThemes.length} themes:`, availableThemes.map(t => t.name));
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
  });

  async function handleApplyTheme(themeName: string) {
    await loadAndApplyTheme(themeName);
    selectedTheme = null;
  }

  function openThemeModal(theme: ThemeManifest) {
    selectedTheme = theme;
    // Deep copy to avoid mutating the manifest directly
    themeOptions = JSON.parse(JSON.stringify(theme));
  }

  function closeThemeModal() {
    selectedTheme = null;
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

  function handleOptionChange(section: string, key: string, value: any) {
    if (section === 'settings') themeOptions.settings[key] = value;
    if (section === 'customProperties') themeOptions.customProperties[key] = value;
    if (section === 'features') themeOptions.features[key] = value;
    if (section === 'fonts') themeOptions.fonts[key] = value;
    if (section === 'animations') themeOptions.animations[key] = value;
    // Live apply custom properties
    themeService.setCustomProperties(themeOptions.customProperties);
    themeService.setThemeFonts(themeOptions.fonts);
  }

  async function handleApplyThemeWithOptions() {
    if (!selectedTheme) return;
    themeService.setCustomProperties(themeOptions.customProperties);
    themeService.setThemeFonts(themeOptions.fonts);
    await handleApplyTheme(selectedTheme.name.toLowerCase());
    selectedTheme = null;
  }

  function capitalizeName(name: string) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  async function handleThemeDeleted(themeName: string) {
    try {
      await themeService.deleteCustomTheme(themeName);
      // Reload themes to reflect the deletion
      await loadThemes();
      
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
  
  // Store-like functions
  function toggleFavorite(themeName: string) {
    if (favoriteThemes.includes(themeName)) {
      favoriteThemes = favoriteThemes.filter(t => t !== themeName);
    } else {
      favoriteThemes = [...favoriteThemes, themeName];
    }
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
        if (selectedCategory === 'popular') return mockRatings[getThemeId(theme)] >= 4.5;
                                if (selectedCategory === 'new') return ['glass', 'bubblegum', 'grape', 'pink-dream', 'neon-cyber'].includes(getThemeId(theme));
        if (selectedCategory === 'girly') return getThemeId(theme) === 'pink-dream';
        if (selectedCategory === 'neo') return getThemeId(theme) === 'neon-cyber';
        return true;
      });
    }
    
    // Sort themes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (mockRatings[getThemeId(b)] || 0) - (mockRatings[getThemeId(a)] || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
          return b.version.localeCompare(a.version);
        default:
          return 0;
      }
    });
    
    return filtered;
  }
  
  function getRating(theme: ThemeManifest) {
    return mockRatings[getThemeId(theme)] || 4.0;
  }
  
  function getDownloadCount(theme: ThemeManifest) {
    const counts: {[key: string]: string} = {
      'default': '25.0K',
      'glass': '15.2K',
      'aero': '12.8K',
      'pink-dream': '11.3K',
      'neon-cyber': '10.7K',
      'midnight': '9.1K',
      'bubblegum': '7.3K',
      'grape': '5.8K',
      'mint': '4.2K',
      'sunset': '3.1K',
      'light': '2.9K',
      'solarized': '2.4K'
    };
    return counts[getThemeId(theme)] || '1.2K';
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
<div class="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
  <div class="absolute inset-0 bg-[url('/api/placeholder/1920/400')] opacity-5"></div>
  <div class="relative px-6 py-12 max-w-7xl mx-auto">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <a 
            href="/settings" 
            class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back
          </a>
          <div class="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
          <Icon src={ShoppingCart} class="w-8 h-8 text-slate-700 dark:text-slate-300" />
          <h1 class="text-4xl font-bold text-slate-900 dark:text-white">Theme Store</h1>
        </div>
        <p class="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
          Discover and customize beautiful themes for your DesQTA experience. From minimalist designs to vibrant anime aesthetics.
        </p>
        <div class="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <span class="flex items-center gap-2">
            <Icon src={ArrowDownTray} class="w-4 h-4" />
            50K+ Downloads
          </span>
          <span class="flex items-center gap-2">
            <Icon src={Star} class="w-4 h-4 text-yellow-500" />
            4.8 Average Rating
          </span>
          <span class="flex items-center gap-2">
            <Icon src={PaintBrush} class="w-4 h-4" />
            {availableThemes.length} Themes Available
          </span>
        </div>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-1">Currently Active</div>
          <div class="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <Icon src={CheckCircle} class="w-5 h-5 text-green-500" />
            {capitalizeName(currentThemeName)}
          </div>
        </div>
        <button
          class="flex items-center gap-2 px-6 py-3 rounded-xl accent-bg hover:accent-bg-hover text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring focus:ring-offset-2"
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
<div class="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700">
  <div class="px-6 py-4 max-w-7xl mx-auto">
    <div class="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
      <!-- Search Bar -->
      <div class="relative flex-1 max-w-md">
        <input 
          type="text" 
          placeholder="Search themes..."
          bind:value={searchQuery}
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring focus:border-transparent transition-all duration-200"
        />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center">
          <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>
      
      <!-- Category Filters -->
      <div class="flex items-center gap-2 overflow-x-auto">
        {#each themeCategories as category}
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 {selectedCategory === category.id ? 'accent-bg text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            onclick={() => selectedCategory = category.id}
          >
            <Icon src={category.icon} class="w-4 h-4" />
            {category.name}
          </button>
        {/each}
      </div>
      
      <!-- Sort & View Options -->
      <div class="flex items-center gap-3">
        <select 
          bind:value={sortBy}
          class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 accent-ring"
        >
          <option value="popular">Most Popular</option>
          <option value="name">Name A-Z</option>
          <option value="newest">Newest First</option>
        </select>
        
        <div class="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
          <button
            class="px-3 py-2 text-sm {viewMode === 'grid' ? 'accent-bg text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'} transition-colors"
            onclick={() => viewMode = 'grid'}
          >
            Grid
          </button>
          <button
            class="px-3 py-2 text-sm {viewMode === 'list' ? 'accent-bg text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'} transition-colors"
            onclick={() => viewMode = 'list'}
          >
            List
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Main Content -->
<div class="px-6 py-8 max-w-7xl mx-auto">

  {#if loading}
    <div class="flex justify-center items-center py-16">
      <div class="flex flex-col gap-4 items-center">
        <div class="w-12 h-12 rounded-full border-4 animate-spin border-slate-200 dark:border-slate-700 border-t-accent"></div>
        <p class="text-lg text-slate-600 dark:text-slate-400">Loading amazing themes...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
      <div class="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">Oops! Something went wrong</div>
      <p class="text-red-500 dark:text-red-300">{error}</p>
    </div>
  {:else}
    <!-- Theme Grid/List -->
    <div class="{viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}">
      {#each getFilteredThemes() as theme, i (theme.name)}
        <div class="relative group">
          {#if viewMode === 'grid'}
            <!-- Grid Card -->
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
              <!-- Theme Preview -->
              <div class="relative h-48 overflow-hidden" style="{getThemePreviewStyle(theme)}">
                <div class="absolute inset-0 bg-gradient-to-br from-black/10 to-black/30"></div>
                <div class="absolute top-3 left-3 flex gap-2">
                  {#if currentThemeName === getThemeId(theme)}
                    <span class="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full flex items-center gap-1">
                      <Icon src={CheckCircle} class="w-3 h-3" />
                      Active
                    </span>
                  {/if}
                  {#if getRating(theme) >= 4.5}
                    <span class="px-2 py-1 text-xs font-medium bg-yellow-500 text-white rounded-full flex items-center gap-1">
                      <Icon src={Fire} class="w-3 h-3" />
                      Popular
                    </span>
                  {/if}
                </div>
                <button
                  class="absolute top-3 right-3 p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                  onclick={(e) => { e.stopPropagation(); toggleFavorite(getThemeId(theme)); }}
                >
                  <Icon src={Heart} class="w-4 h-4 {favoriteThemes.includes(getThemeId(theme)) ? 'text-red-500 fill-current' : 'text-white'}" />
                </button>
                
                <!-- Preview Mockup -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="w-32 h-24 bg-white/90 dark:bg-slate-900/90 rounded-lg shadow-xl border border-white/20 overflow-hidden">
                    <div class="h-6 flex items-center px-2 text-xs font-medium" style="background: {theme.customProperties.primaryColor}; color: white;">
                      DesQTA
                    </div>
                    <div class="p-2 space-y-1">
                      <div class="h-2 bg-slate-300 dark:bg-slate-600 rounded w-3/4"></div>
                      <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      <div class="h-8 rounded" style="background: {theme.customProperties.primaryColor}20;"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Theme Info -->
              <div class="p-6">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">{theme.name}</h3>
                    <p class="text-sm text-slate-600 dark:text-slate-400">by {theme.author}</p>
                  </div>
                  <div class="flex items-center gap-1 text-sm">
                    <Icon src={Star} class="w-4 h-4 text-yellow-500 fill-current" />
                    <span class="font-medium text-slate-700 dark:text-slate-300">{getRating(theme)}</span>
                  </div>
                </div>
                
                <p class="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{theme.description}</p>
                
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span class="flex items-center gap-1">
                      <Icon src={ArrowDownTray} class="w-3 h-3" />
                      {getDownloadCount(theme)}
                    </span>
                    <span>v{theme.version}</span>
                  </div>
                  <div class="flex gap-1">
                    {#if theme.features.glassmorphism}
                      <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">Glass</span>
                    {/if}
                    {#if theme.features.gradients}
                      <span class="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">Gradient</span>
                    {/if}
                  </div>
                </div>
                
                <div class="flex gap-2">
                  <button
                    class="flex-1 px-4 py-2 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-colors"
                    onclick={() => openThemeModal(theme)}
                  >
                    <Icon src={Eye} class="w-4 h-4 inline mr-2" />
                    Preview
                  </button>
                  {#if currentThemeName !== getThemeId(theme)}
                    <button
                      class="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium rounded-xl transition-colors"
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
                  onclick={() => { if (confirm(`Are you sure you want to delete the theme "${theme.name}"?`)) { handleThemeDeleted(theme.name); } }}
                  class="absolute top-3 right-12 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors bg-white/20 backdrop-blur-sm rounded-full"
                  aria-label="Delete custom theme"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              {/if}
            </div>
          {:else}
            <!-- List View -->
            <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 p-6">
              <div class="flex items-center gap-6">
                <!-- Theme Preview -->
                <div class="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0" style="{getThemePreviewStyle(theme)}">
                  <div class="w-full h-full flex items-center justify-center">
                    <div class="w-12 h-10 bg-white/90 dark:bg-slate-900/90 rounded shadow-sm border overflow-hidden">
                      <div class="h-3 text-xs px-1 flex items-center text-white" style="background: {theme.customProperties.primaryColor};">DesQTA</div>
                      <div class="p-1 space-y-0.5">
                        <div class="h-1 bg-slate-300 dark:bg-slate-600 rounded w-3/4"></div>
                        <div class="h-1 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        <div class="h-2 rounded" style="background: {theme.customProperties.primaryColor}40;"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Theme Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between mb-2">
                    <div>
                      <h3 class="text-lg font-bold text-slate-900 dark:text-white">{theme.name}</h3>
                      <p class="text-sm text-slate-600 dark:text-slate-400">by {theme.author} • v{theme.version}</p>
                    </div>
                    <div class="flex items-center gap-4 text-sm">
                      <div class="flex items-center gap-1">
                        <Icon src={Star} class="w-4 h-4 text-yellow-500 fill-current" />
                        <span class="font-medium">{getRating(theme)}</span>
                      </div>
                      <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Icon src={ArrowDownTray} class="w-4 h-4" />
                        <span>{getDownloadCount(theme)}</span>
                      </div>
                    </div>
                  </div>
                  <p class="text-sm text-slate-600 dark:text-slate-400 mb-3">{theme.description}</p>
                  <div class="flex items-center justify-between">
                    <div class="flex gap-2">
                      {#if currentThemeName === getThemeId(theme)}
                        <span class="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">Active</span>
                      {/if}
                      {#if theme.features.glassmorphism}
                        <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">Glassmorphism</span>
                      {/if}
                    </div>
                    <div class="flex gap-3">
                      <button
                        class="accent-text hover:accent-text-hover font-medium text-sm"
                        onclick={() => openThemeModal(theme)}
                      >
                        Preview
                      </button>
                      {#if currentThemeName !== getThemeId(theme)}
                        <button
                          class="px-4 py-2 accent-bg hover:accent-bg-hover text-white font-medium rounded-lg transition-colors text-sm"
                          onclick={() => handleApplyTheme(getThemeId(theme))}
                        >
                          Apply
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    
    {#if getFilteredThemes().length === 0}
      <div class="text-center py-16">
        <div class="w-24 h-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <Icon src={PaintBrush} class="w-12 h-12 text-slate-400" />
        </div>
        <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">No themes found</h3>
        <p class="text-slate-600 dark:text-slate-400 mb-6">Try adjusting your search or filter criteria.</p>
        <button
          class="px-6 py-3 accent-bg hover:accent-bg-hover text-white font-medium rounded-xl transition-colors"
          onclick={() => { searchQuery = ''; selectedCategory = 'all'; }}
        >
          Clear Filters
        </button>
      </div>
    {/if}

    {#if selectedTheme}
      <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden animate-fade-in-up relative flex flex-col"
          style="{getThemePreviewStyle(selectedTheme)}"
        >
          <button
            class="absolute top-4 right-4 text-xl text-white bg-black/30 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/60 transition"
            onclick={closeThemeModal}
          >
            ×
          </button>
          <div class="flex flex-col h-full">
            <div class="flex h-64">
              <div
                class="w-20 flex flex-col items-center py-4"
                style="background: {selectedTheme.customProperties.primaryColor}"
              >
                <div class="w-8 h-8 rounded-lg bg-white/80 mb-4"></div>
                <div class="w-8 h-8 rounded-lg bg-white/60 mb-4"></div>
                <div class="w-8 h-8 rounded-lg bg-white/40 mb-4"></div>
                <div class="w-8 h-8 rounded-lg bg-white/20"></div>
              </div>
              <div class="flex-1 flex flex-col">
                <div
                  class="h-12 flex items-center px-6 text-white"
                  style="background: {selectedTheme.customProperties.primaryColor}"
                >
                  <span class="font-bold text-lg">DesQTA</span>
                  <span class="ml-auto text-sm opacity-80">User</span>
                </div>
                <div class="flex-1 bg-white/80 dark:bg-slate-900/80 p-6 flex flex-col gap-4">
                  <div class="h-6 w-1/3 rounded bg-slate-300 dark:bg-slate-700 mb-2"></div>
                  <div class="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800 mb-2"></div>
                  <div class="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800 mb-2"></div>
                  <div class="h-32 rounded-lg bg-slate-100 dark:bg-slate-800"></div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-6 pt-6 pb-2">
              <div class="font-semibold text-lg mb-2 text-slate-800 dark:text-white">{selectedTheme.name} Theme</div>
              <div class="text-sm text-slate-700 dark:text-slate-200 mb-4 text-center">{selectedTheme.description}</div>
              <!-- Theme Options Section -->
              <div class="w-full max-w-3xl mx-auto mb-4 p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md">
                <div class="accent-bg accent-text px-4 py-2 rounded-lg shadow font-medium text-base mb-4 transition-colors duration-200">
                  Theme Options
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <!-- Accent Color -->
                  <div class="flex items-center gap-2">
                    <label class="block text-base font-medium flex-1 text-slate-800 dark:text-white" for="accentColor">Accent Color</label>
                    <div class="flex items-center gap-2">
                      <input id="accentColor" aria-label="Accent Color" type="color" class="w-10 h-10 border border-gray-300 rounded-lg shadow focus:ring-2 focus:ring-accent transition-all" bind:value={themeOptions.settings.defaultAccentColor} oninput={e => handleOptionChange('settings', 'defaultAccentColor', (e.target && (e.target as HTMLInputElement).value) || themeOptions.settings.defaultAccentColor)} />
                      <span class="w-8 h-8 rounded-lg border border-gray-300" style="background: {themeOptions.settings.defaultAccentColor}"></span>
                    </div>
                  </div>
                  <!-- Default Theme -->
                  <div>
                    <label class="block text-base font-medium mb-1 text-slate-800 dark:text-white" for="defaultTheme">Default Theme</label>
                    <select id="defaultTheme" aria-label="Default Theme" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow px-3 py-2 focus:ring-2 focus:ring-accent transition-all bg-white dark:bg-gray-900 text-base text-slate-800 dark:text-white" bind:value={themeOptions.settings.defaultTheme} onchange={e => handleOptionChange('settings', 'defaultTheme', (e.target && (e.target as HTMLSelectElement).value) || themeOptions.settings.defaultTheme)}>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </div>
                <!-- Advanced Options Accordion -->
                <div class="mb-2">
                  <button class="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showAdvanced = !showAdvanced} aria-expanded={showAdvanced} aria-controls="advanced-options">
                    Advanced Options
                    <svg class="w-5 h-5 ml-2 transition-transform duration-200" style="transform: rotate({showAdvanced ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {#if showAdvanced}
                    <div id="advanced-options" class="mt-4 space-y-4">
                      <!-- Features Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showFeatures = !showFeatures} aria-expanded={showFeatures} aria-controls="features-options">
                          Features
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showFeatures ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showFeatures}
                          <div id="features-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.features) as feat}
                              <div class="flex items-center gap-2">
                                <input type="checkbox" class="w-4 h-4 text-accent bg-gray-100 border-gray-300 rounded focus:ring-accent dark:focus:ring-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" checked={themeOptions.features[feat]} onchange={e => handleOptionChange('features', feat, (e.target && (e.target as HTMLInputElement).checked) || false)} />
                                <label class="text-base font-medium text-slate-800 dark:text-white" for={feat}>{feat}</label>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <!-- Fonts Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showFonts = !showFonts} aria-expanded={showFonts} aria-controls="fonts-options">
                          Fonts
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showFonts ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showFonts}
                          <div id="fonts-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.fonts) as fontKey}
                              <div>
                                <label class="block text-base font-medium mb-1 text-slate-800 dark:text-white" for={fontKey + '-font'}>{fontKey} font</label>
                                <input type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900 text-slate-800 dark:text-white" bind:value={themeOptions.fonts[fontKey]} oninput={e => handleOptionChange('fonts', fontKey, (e.target && (e.target as HTMLInputElement).value) || themeOptions.fonts[fontKey])} />
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <!-- Animations Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showAnimations = !showAnimations} aria-expanded={showAnimations} aria-controls="animations-options">
                          Animations
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showAnimations ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showAnimations}
                          <div id="animations-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.animations) as animKey}
                              <div>
                                <label class="block text-base font-medium mb-1 text-slate-800 dark:text-white" for={animKey + '-anim'}>{animKey}</label>
                                <input type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900 text-slate-800 dark:text-white" bind:value={themeOptions.animations[animKey]} oninput={e => handleOptionChange('animations', animKey, (e.target && (e.target as HTMLInputElement).value) || themeOptions.animations[animKey])} />
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <!-- Custom Properties Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showCustom = !showCustom} aria-expanded={showCustom} aria-controls="custom-options">
                          Custom Properties
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showCustom ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showCustom}
                          <div id="custom-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.customProperties) as prop}
                              <div class="flex items-center gap-2">
                                <label class="block text-base font-medium flex-1 text-slate-800 dark:text-white" for={prop}>{prop}</label>
                                {#if themeOptions.customProperties[prop]?.startsWith('#') || themeOptions.customProperties[prop]?.startsWith('rgb')}
                                  <input type="color" class="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900" bind:value={themeOptions.customProperties[prop]} oninput={e => handleOptionChange('customProperties', prop, (e.target && (e.target as HTMLInputElement).value) || themeOptions.customProperties[prop])} />
                                  <span class="w-8 h-8 rounded-lg border border-gray-300" style="background: {themeOptions.customProperties[prop]}"></span>
                                {:else}
                                  <input type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900 text-slate-800 dark:text-white" bind:value={themeOptions.customProperties[prop]} oninput={e => handleOptionChange('customProperties', prop, (e.target && (e.target as HTMLInputElement).value) || themeOptions.customProperties[prop])} />
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            <!-- Sticky action buttons -->
            <div class="flex gap-4 justify-center items-center p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-10">
              <button
                class="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent accent-bg hover:accent-bg-hover active:scale-95"
                onclick={handleApplyThemeWithOptions}
              >
                Apply Theme
              </button>
              {#if currentThemeName !== 'default'}
                <button
                  class="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95"
                  onclick={() => handleApplyTheme('default')}
                >
                  Reset to Default
                </button>
              {/if}
            </div>
          </div>
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
  .animate-fade-in-up {
    animation: fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
</style> 