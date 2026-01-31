<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { writable, derived } from 'svelte/store';
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui';
  import { Icon, MagnifyingGlass, CommandLine, Sparkles } from 'svelte-hero-icons';
  import SearchModal from './SearchModal.svelte';
  import { searchItems, categories, type SearchItem, type SearchCategory } from './SearchData';
  import { _ } from '../../i18n';
  import {
    Home,
    BookOpen,
    ClipboardDocumentList,
    CalendarDays,
    PencilSquare,
    Flag,
    ChatBubbleBottomCenterText,
    FolderOpen,
    ChatBubbleLeftRight,
    Rss,
    GlobeAlt,
    DocumentText,
    Newspaper,
    User,
    ChartBar,
    AcademicCap,
    Cog6Tooth,
    Squares2x2,
  } from 'svelte-hero-icons';
  import { handleAction, fuzzyScore } from './SearchActions';
  import { sanitizeSearchQuery } from '../../../utils/sanitization';
  import { getUrlParam, updateUrlParam, updateUrlParams } from '../../utils/urlParams';
  import { invoke } from '@tauri-apps/api/core';
  import type { Assessment, Subject } from '$lib/types';
  import type { Folder } from '../../../routes/courses/types';
  import { Clock } from 'svelte-hero-icons';
  import { idbCacheGet } from '../../services/idb';

  const dispatch = createEventDispatcher();

  // Core stores
  const searchStore = writable('');
  const showModal = writable(false);
  const selectedIndex = writable(0);
  const searchHistory = writable<string[]>([]);
  const favoriteItems = writable<string[]>([]);
  const recentItems = writable<SearchItem[]>([]);
  const searchMode = writable<'normal' | 'command' | 'fuzzy'>('normal');

  // State
  const currentCategory = writable<string | null>(null);
  let isAdvancedMode = $state(false);
  let modalInput = $state<HTMLInputElement | null>(null);
  let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let isUpdatingFromUrl = $state(false);
  let dynamicAssessments = $state<SearchItem[]>([]);
  let dynamicCourses = $state<SearchItem[]>([]);
  let loadingDynamic = $state(false);
  let dynamicPages = $state<SearchItem[]>([]);
  // Convert to stores so filteredItems can reactively track them
  const homepageAssessments = writable<SearchItem[]>([]);
  const homepageCourses = writable<SearchItem[]>([]);
  const dynamicCategories = writable<SearchCategory[]>([]);

  // Sanitize search input reactively (but preserve spaces for normal typing)
  $effect(() => {
    const currentSearch = $searchStore;
    if (currentSearch) {
      // Only sanitize dangerous characters, don't trim while typing
      // This allows spaces to work normally
      const sanitized = currentSearch
        .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
        .replace(/\\/g, '') // Remove backslashes
        .replace(/javascript:/gi, '') // Remove javascript protocol
        .substring(0, 500); // Limit length

      if (sanitized !== currentSearch) {
        searchStore.set(sanitized);
      }
    }
  });

  // Sync URL params with search state (read from URL)
  $effect(() => {
    if (isUpdatingFromUrl) return; // Prevent loops

    const urlSearch = getUrlParam('search');
    const urlGo = getUrlParam('go');

    // Handle search query from URL
    if (urlSearch && urlSearch !== $searchStore) {
      isUpdatingFromUrl = true;
      searchStore.set(urlSearch);
      if (!$showModal) {
        openModal();
      }
      setTimeout(() => {
        isUpdatingFromUrl = false;
      }, 100);
    }

    // Handle deep linking to specific item (only if we have results)
    if (urlGo && $filteredItems.length > 0 && !isUpdatingFromUrl) {
      const item = $filteredItems.find((i) => i.id === urlGo);
      if (item) {
        isUpdatingFromUrl = true;
        handleSelect(item);
        // Clear URL params after navigation
        setTimeout(() => {
          updateUrlParams({ search: null, go: null });
          isUpdatingFromUrl = false;
        }, 100);
      }
    }
  });

  // Update URL when search changes (debounced)
  $effect(() => {
    if (isUpdatingFromUrl) return; // Prevent loops

    if (urlUpdateTimeout) {
      clearTimeout(urlUpdateTimeout);
    }

    urlUpdateTimeout = setTimeout(() => {
      if (isUpdatingFromUrl) return;

      if ($searchStore && $showModal) {
        updateUrlParam('search', $searchStore, { keepFocus: true });
      } else if (!$showModal && !getUrlParam('go')) {
        // Only clear if not navigating to a specific item
        updateUrlParam('search', null, { keepFocus: true });
      }
    }, 150); // Debounce URL updates
  });

  // Create a reactive store for dynamic items
  const dynamicItemsStore = writable<SearchItem[]>([]);

  $effect(() => {
    // Only include search results, not homepage items
    const items = [...dynamicAssessments, ...dynamicCourses];
    dynamicItemsStore.set(items);
  });

  // Load dynamic pages from menu
  const loadDynamicPages = async () => {
    try {
      // Try to get menu from settings or use default
      const DEFAULT_MENU_ITEMS = [
        { labelKey: 'navigation.dashboard', icon: Home, path: '/' },
        { labelKey: 'navigation.courses', icon: BookOpen, path: '/courses' },
        { labelKey: 'navigation.assessments', icon: ClipboardDocumentList, path: '/assessments' },
        { labelKey: 'navigation.timetable', icon: CalendarDays, path: '/timetable' },
        { labelKey: 'navigation.study', icon: PencilSquare, path: '/study' },
        { labelKey: 'navigation.goals', icon: Flag, path: '/goals' },
        { labelKey: 'navigation.forums', icon: ChatBubbleBottomCenterText, path: '/forums' },
        { labelKey: 'navigation.folios', icon: FolderOpen, path: '/folios' },
        { labelKey: 'navigation.messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
        { labelKey: 'navigation.rss_feeds', icon: Rss, path: '/rss-feeds' },
        { labelKey: 'navigation.portals', icon: GlobeAlt, path: '/portals' },
        { labelKey: 'navigation.notices', icon: DocumentText, path: '/notices' },
        { labelKey: 'navigation.news', icon: Newspaper, path: '/news' },
        { labelKey: 'navigation.directory', icon: User, path: '/directory' },
        { labelKey: 'navigation.reports', icon: ChartBar, path: '/reports' },
        { labelKey: 'navigation.analytics', icon: AcademicCap, path: '/analytics' },
        { labelKey: 'navigation.settings', icon: Cog6Tooth, path: '/settings' },
      ];

      // Try to load SEQTA config to filter menu
      let menuItems = [...DEFAULT_MENU_ITEMS];
      try {
        const config = await invoke<any>('load_seqta_config').catch(() => null);
        if (config?.payload) {
          const goalsEnabled = config.payload['coneqt-s.page.goals']?.value === 'enabled';
          if (!goalsEnabled) {
            menuItems = menuItems.filter((item) => item.path !== '/goals');
          }
          const forumsPageEnabled = config.payload['coneqt-s.page.forums']?.value === 'enabled';
          const forumsGreetingExists = config.payload['coneqt-s.forum.greeting'] !== undefined;
          const forumsEnabled = forumsPageEnabled || forumsGreetingExists;
          if (!forumsEnabled) {
            menuItems = menuItems.filter((item) => item.path !== '/forums');
          }
          const foliosEnabled = config.payload['coneqt-s.page.folios']?.value === 'enabled';
          if (!foliosEnabled) {
            menuItems = menuItems.filter((item) => item.path !== '/folios');
          }
        }

        // Check RSS feed setting
        const settings = await invoke<any>('get_settings_subset', {
          keys: ['separate_rss_feed'],
        }).catch(() => null);
        const separateRssFeed = settings?.separate_rss_feed ?? false;
        if (!separateRssFeed) {
          menuItems = menuItems.filter((item) => item.path !== '/rss-feeds');
        }
      } catch (e) {
        console.warn('Failed to load menu config, using default:', e);
      }

      // Convert menu items to SearchItems - icons are already components
      dynamicPages = menuItems.map((item) => {
        // Get translated name - we'll use a simple fallback for now
        const nameKey = item.labelKey.replace('navigation.', '');
        const name = nameKey.charAt(0).toUpperCase() + nameKey.slice(1).replace(/_/g, ' ');
        return {
          id: `page-${item.path}`,
          name,
          path: item.path,
          category: 'page' as const,
          icon: item.icon || Home, // Use the icon component directly
          description: `Navigate to ${name}`,
          keywords: [name.toLowerCase(), item.path],
          priority: 9,
        } as SearchItem;
      });

      // Update categories with dynamic pages
      dynamicCategories.set([
        {
          id: 'pages',
          name: 'Pages',
          icon: Squares2x2,
          color: 'blue',
          items: dynamicPages,
        },
        ...categories.filter((c) => c.id !== 'pages'),
      ]);
    } catch (e) {
      console.warn('Failed to load dynamic pages:', e);
      dynamicPages = [];
      dynamicCategories.set(categories);
    }
  };

  // Enhanced filtering - handles both global search and category-specific search
  const filteredItems = derived(
    [
      searchStore,
      searchMode,
      favoriteItems,
      recentItems,
      dynamicItemsStore,
      currentCategory,
      dynamicCategories,
      homepageAssessments,
      homepageCourses,
    ],
    ([
      $search,
      $mode,
      $favorites,
      $recents,
      $dynamicItems,
      $currentCategory,
      $dynamicCategories,
      $homepageAssessments,
      $homepageCourses,
    ]) => {
      // Determine source items based on current context
      const sourceItems = $currentCategory
        ? $dynamicCategories.length > 0
          ? $dynamicCategories.find((c) => c.id === $currentCategory)?.items || []
          : categories.find((c) => c.id === $currentCategory)?.items || []
        : [
            ...searchItems.filter((item) => item.category !== 'page'),
            ...dynamicPages,
            ...$dynamicItems,
          ];

      if (!$search.trim()) {
        if ($currentCategory) {
          // When in a category, show all category items if no search
          return sourceItems;
        }

        // Global search with no query - show favorites, recents, and homepage items
        const recentWithBadge = $recents.map((item) => ({ ...item, badge: 'Recent' }));
        const allSearchItems = [
          ...searchItems.filter((item) => item.category !== 'page'),
          ...dynamicPages,
        ];
        const favoriteWithBadge = allSearchItems
          .filter((item) => $favorites.includes(item.id))
          .map((item) => ({ ...item, badge: 'Favorite' }));

        // Combine: favorites, recents, homepage assessments, homepage courses
        const homepageItems = [
          ...favoriteWithBadge,
          ...recentWithBadge,
          ...$homepageAssessments.map((item) => ({ ...item, badge: item.badge || 'Assessment' })),
          ...$homepageCourses.map((item) => ({ ...item, badge: 'Course' })),
        ];

        return homepageItems.slice(0, 12);
      }

      // Include dynamic items (assessments and courses) in search results
      // Note: sourceItems already includes $dynamicItems, but we ensure they're included
      // and properly deduplicated
      const itemsMap = new Map<string, SearchItem>();

      // Add source items first (this already includes $dynamicItems from line 270)
      sourceItems.forEach((item) => {
        itemsMap.set(item.id, item);
      });

      // Explicitly add dynamic items to ensure they're included (will deduplicate by id)
      $dynamicItems.forEach((item) => {
        itemsMap.set(item.id, item);
      });

      const allSearchableItems = Array.from(itemsMap.values());

      let results = allSearchableItems;

      if ($mode === 'fuzzy') {
        results = allSearchableItems
          .map((item) => ({
            ...item,
            score: Math.max(
              fuzzyScore(item.name, $search),
              fuzzyScore(item.description || '', $search),
              ...(item.keywords || []).map((k) => fuzzyScore(k, $search)),
            ),
          }))
          .filter((item) => item.score > 0.3)
          .sort((a, b) => (b.score || 0) - (a.score || 0));
      } else {
        const query = $search.toLowerCase();
        results = allSearchableItems.filter((item) => {
          return (
            item.name.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.keywords?.some((k) => k.toLowerCase().includes(query)) ||
            item.path.toLowerCase().includes(query)
          );
        });
      }

      return results
        .sort((a, b) => {
          const aPriority = (a.priority || 0) + (a.useCount || 0) * 0.1;
          const bPriority = (b.priority || 0) + (b.useCount || 0) * 0.1;
          return bPriority - aPriority;
        })
        .slice(0, 12);
    },
  );

  const visibleCategories = derived(
    [searchStore, searchMode, dynamicCategories],
    ([$search, $mode, $dynamicCategories]) => {
      if ($search.trim() || $mode === 'command') return [];
      return $dynamicCategories.length > 0 ? $dynamicCategories : categories;
    },
  );

  // Modal functions
  const openModal = () => {
    showModal.set(true);
    searchMode.set('normal');
    currentCategory.set(null);
    selectedIndex.set(0);
    // Load homepage data when opening modal
    if (!$searchStore.trim()) {
      loadHomepageData();
    }
  };

  const openCommandMode = () => {
    showModal.set(true);
    searchMode.set('command');
    searchStore.set('>');
    selectedIndex.set(0);
  };

  const toggleFuzzyMode = () => {
    searchMode.update((mode) => (mode === 'fuzzy' ? 'normal' : 'fuzzy'));
  };

  const closeModal = () => {
    showModal.set(false);
    searchStore.set('');
    searchMode.set('normal');
    currentCategory.set(null);
    selectedIndex.set(0);
    // Clear URL params when closing
    const urlGo = getUrlParam('go');
    if (!urlGo) {
      updateUrlParam('search', null);
    }
  };

  const openCategory = (categoryId: string) => {
    currentCategory.set(categoryId);
    searchStore.set(''); // Clear search when entering category
    selectedIndex.set(0);
  };

  const goBack = () => {
    if ($currentCategory) {
      currentCategory.set(null);
      searchStore.set(''); // Clear search when going back
      selectedIndex.set(0); // Reset to first category/item
    } else if ($searchMode === 'command') {
      searchMode.set('normal');
      searchStore.set('');
      selectedIndex.set(0);
    }
    // Always reset selected index when going back
    selectedIndex.set(0);
  };

  // Selection handling
  const handleSelect = async (item: SearchItem) => {
    // Track usage (save to SQLite)
    try {
      await invoke('db_search_usage_track', { itemId: item.id, category: item.category });
    } catch (e) {
      console.warn('Failed to track usage:', e);
    }

    // Update local data
    item.useCount = (item.useCount || 0) + 1;
    item.lastUsed = new Date();

    // Add to recent items
    recentItems.update((items) => {
      const filtered = items.filter((i) => i.id !== item.id);
      return [item, ...filtered].slice(0, 5);
    });

    // Add to search history (save to SQLite)
    const query = $searchStore.trim();
    if (query) {
      searchHistory.update((history) => {
        const filtered = history.filter((h) => h !== query);
        return [query, ...filtered].slice(0, 10);
      });
      // Save to SQLite
      invoke('db_search_history_add', { query }).catch(() => {});
    }

    // Clear URL params before navigation
    const urlGo = getUrlParam('go');
    if (!urlGo) {
      updateUrlParams({ search: null, go: null });
    }

    closeModal();

    if (item.category === 'action') {
      if (item.id === 'action-sidebar-toggle') {
        dispatch('toggle-sidebar');
      } else {
        await handleAction(item);
      }
    } else {
      goto(item.path);
    }
  };

  const toggleFavorite = async (itemId: string) => {
    const isFavorite = $favoriteItems.includes(itemId);

    favoriteItems.update((favorites) => {
      if (isFavorite) {
        return favorites.filter((id) => id !== itemId);
      } else {
        return [...favorites, itemId];
      }
    });

    // Save to SQLite
    try {
      if (isFavorite) {
        await invoke('db_search_favorites_remove', { itemId });
      } else {
        await invoke('db_search_favorites_add', { itemId });
      }
    } catch (e) {
      console.warn('Failed to toggle favorite:', e);
    }
  };

  // Data persistence using SQLite
  const saveSearchData = async () => {
    try {
      // Save favorites individually
      for (const itemId of $favoriteItems) {
        await invoke('db_search_favorites_add', { itemId }).catch(() => {});
      }

      // Note: Search history and recent items are saved individually when added
    } catch (e) {
      console.warn('Failed to save search data:', e);
    }
  };

  const loadSearchData = async () => {
    try {
      // Load search history from SQLite
      const history = await invoke<string[]>('db_search_history_get', { limit: 10 });
      if (history) {
        searchHistory.set(history);
      }

      // Load favorites from SQLite
      const favorites = await invoke<string[]>('db_search_favorites_get');
      if (favorites) {
        favoriteItems.set(favorites);
      }

      // Load recent items from SQLite
      const recent = await invoke<any[]>('db_search_recent_get', { limit: 5 });
      if (recent && Array.isArray(recent)) {
        const mappedRecent = recent
          .map((item: any) => ({
            id: item.id || '',
            name: item.name || '',
            path: item.path || '',
            category: item.category || 'page',
            icon: null, // Will be resolved from SearchData
            description: item.description,
            keywords: item.keywords,
            priority: item.priority,
            lastUsed: item.lastUsed ? new Date(item.lastUsed) : undefined,
            useCount: item.useCount,
          }))
          .filter((item: any) => item.id);
        recentItems.set(mappedRecent);
      }
    } catch (e) {
      console.warn('Failed to load search data:', e);
    }
  };

  // Scroll selected item into view
  const scrollToSelected = () => {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      const selectedElement = document.querySelector(
        `.search-result-selected, [data-search-index="${$selectedIndex}"]`,
      );
      if (selectedElement) {
        const container =
          document.getElementById('search-results-container') ||
          document.querySelector('.max-h-96.overflow-y-auto') ||
          document.querySelector('.p-4.max-h-96.overflow-y-auto');
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = selectedElement.getBoundingClientRect();
          const isAbove = elementRect.top < containerRect.top;
          const isBelow = elementRect.bottom > containerRect.bottom;

          if (isAbove || isBelow) {
            selectedElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }
        } else {
          // Fallback: scroll into view without container check
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    });
  };

  // Auto-scroll when selected index changes (for mouse hover)
  $effect(() => {
    if ($showModal && $selectedIndex >= 0) {
      scrollToSelected();
    }
  });

  // Reset selected index when items change to prevent out-of-bounds
  $effect(() => {
    if ($showModal) {
      let items: any[] = [];
      if ($currentCategory) {
        items = $filteredItems;
      } else if ($visibleCategories.length > 0) {
        items = $visibleCategories;
      } else {
        items = $filteredItems;
      }

      const maxIndex = Math.max(0, items.length - 1);
      if ($selectedIndex > maxIndex) {
        selectedIndex.set(maxIndex);
      }
    }
  });

  // Keyboard handling with improved navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (!$showModal) return;

    // Don't intercept keys when user is typing in the input (allow normal text input)
    const target = e.target;
    const isInput =
      target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search');

    // If typing in input, only handle specific navigation keys - let everything else pass through
    if (isInput) {
      // Only handle navigation keys when in input, ignore all other keys (including Space, letters, numbers, etc.)
      const navigationKeys = [
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End',
        'PageDown',
        'PageUp',
        'Enter',
        'Escape',
      ];
      // If it's not a navigation key, don't handle it at all - let the browser handle it
      // This ensures Space and all other text input keys work normally
      if (!navigationKeys.includes(e.key)) {
        return; // Let the input handle normal typing (including Space, letters, etc.)
      }
      // For navigation keys in input, continue to handle them below
    }

    // Determine what items are currently being displayed
    let items: any[] = [];
    if ($currentCategory) {
      // In a category - show filtered category items
      items = $filteredItems;
    } else if ($visibleCategories.length > 0) {
      // Showing categories
      items = $visibleCategories;
    } else {
      // Showing search results
      items = $filteredItems;
    }

    const maxIndex = Math.max(0, items.length - 1);
    const wrapAround = true; // Enable wrapping for better UX

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (items.length === 0) break;
        selectedIndex.update((i) => {
          const newIndex = i + 1;
          if (wrapAround && newIndex > maxIndex) {
            return 0; // Wrap to top
          }
          return Math.min(newIndex, maxIndex);
        });
        scrollToSelected();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (items.length === 0) break;
        selectedIndex.update((i) => {
          const newIndex = i - 1;
          if (wrapAround && newIndex < 0) {
            return maxIndex; // Wrap to bottom
          }
          return Math.max(newIndex, 0);
        });
        scrollToSelected();
        break;
      case 'Home':
        e.preventDefault();
        if (items.length > 0) {
          selectedIndex.set(0);
          scrollToSelected();
        }
        break;
      case 'End':
        e.preventDefault();
        if (items.length > 0) {
          selectedIndex.set(maxIndex);
          scrollToSelected();
        }
        break;
      case 'PageDown':
        e.preventDefault();
        if (items.length > 0) {
          const jumpSize = 5;
          selectedIndex.update((i) => {
            const newIndex = Math.min(i + jumpSize, maxIndex);
            return newIndex;
          });
          scrollToSelected();
        }
        break;
      case 'PageUp':
        e.preventDefault();
        if (items.length > 0) {
          const jumpSize = 5;
          selectedIndex.update((i) => {
            const newIndex = Math.max(i - jumpSize, 0);
            return newIndex;
          });
          scrollToSelected();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (items.length === 0) break;
        if ($currentCategory && $filteredItems[$selectedIndex]) {
          // In a category - select the filtered item
          handleSelect($filteredItems[$selectedIndex]);
        } else if ($visibleCategories.length > 0 && $selectedIndex < $visibleCategories.length) {
          // Showing categories - open selected category
          openCategory($visibleCategories[$selectedIndex].id);
        } else if ($filteredItems[$selectedIndex]) {
          // Showing search results - select item
          handleSelect($filteredItems[$selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if ($currentCategory || $searchMode === 'command') {
          goBack();
        } else {
          closeModal();
        }
        break;
    }
  };

  // Load recent/popular courses and assessments for homepage
  // Note: Only uses cache/API, not database search (database search is only for actual search queries)
  async function loadHomepageData() {
    try {
      // Load from cache first, then fall back to API
      const [cachedAssessments, cachedCourses] = await Promise.all([
        idbCacheGet<{
          assessments: Assessment[];
          subjects: Subject[];
          all_subjects: Subject[];
        }>('assessments_overview_data'),
        idbCacheGet<Folder[]>('courses_subjects_folders'),
      ]);

      // Process assessments - show upcoming/overdue first
      if (cachedAssessments?.assessments) {
        const sortedAssessments = [...cachedAssessments.assessments]
          .sort((a: Assessment, b: Assessment) => {
            // Prioritize overdue
            if (a.overdue && !b.overdue) return -1;
            if (!a.overdue && b.overdue) return 1;
            // Then by due date
            const aDue = new Date(a.due).getTime();
            const bDue = new Date(b.due).getTime();
            return aDue - bDue;
          })
          .slice(0, 5)
          .map((a: Assessment) => {
            const dueDate = new Date(a.due);
            const isOverdue = a.overdue;
            const statusBadge = isOverdue ? 'Overdue' : dueDate.toLocaleDateString();

            return {
              id: `assessment-${a.id}-${a.metaclassID}`,
              name: a.title,
              path: `/assessments/${a.id}/${a.metaclassID}`,
              category: 'page' as const,
              icon: ClipboardDocumentList,
              description: `${a.code} • ${a.subject || 'Unknown'}`,
              keywords: [a.title, a.code, a.subject || ''],
              badge: statusBadge,
              priority: isOverdue ? 15 : 8,
              metadata: { assessmentId: a.id, metaclassId: a.metaclassID },
            } as SearchItem;
          });

        homepageAssessments.set(sortedAssessments);
      } else {
        // Try to fetch fresh data from API
        try {
          const assessmentsData = await invoke<{
            assessments: Assessment[];
            subjects: Subject[];
            all_subjects: Subject[];
          }>('get_processed_assessments').catch(() => null);

          if (assessmentsData?.assessments) {
            const sortedAssessments = [...assessmentsData.assessments]
              .sort((a: Assessment, b: Assessment) => {
                if (a.overdue && !b.overdue) return -1;
                if (!a.overdue && b.overdue) return 1;
                const aDue = new Date(a.due).getTime();
                const bDue = new Date(b.due).getTime();
                return aDue - bDue;
              })
              .slice(0, 5)
              .map((a: Assessment) => {
                const dueDate = new Date(a.due);
                const isOverdue = a.overdue;
                const statusBadge = isOverdue ? 'Overdue' : dueDate.toLocaleDateString();

                return {
                  id: `assessment-${a.id}-${a.metaclassID}`,
                  name: a.title,
                  path: `/assessments/${a.id}/${a.metaclassID}`,
                  category: 'page' as const,
                  icon: ClipboardDocumentList,
                  description: `${a.code} • ${a.subject || 'Unknown'}`,
                  keywords: [a.title, a.code, a.subject || ''],
                  badge: statusBadge,
                  priority: isOverdue ? 15 : 8,
                  metadata: { assessmentId: a.id, metaclassId: a.metaclassID },
                } as SearchItem;
              });

            homepageAssessments.set(sortedAssessments);
          } else {
            homepageAssessments.set([]);
          }
        } catch (e) {
          console.warn('Failed to load homepage assessments:', e);
          homepageAssessments.set([]);
        }
      }

      // Process courses - show recent/active courses
      if (cachedCourses && cachedCourses.length > 0) {
        // Get unique courses from folders
        const courseMap = new Map<string, any>();
        cachedCourses.forEach((folder: Folder) => {
          folder.subjects?.forEach((subject: any) => {
            const key = `${subject.programme}-${subject.metaclass}`;
            if (!courseMap.has(key)) {
              courseMap.set(key, {
                programme: subject.programme,
                metaclass: subject.metaclass,
                code: subject.code,
                title: subject.title,
                description: subject.description,
              });
            }
          });
        });

        const courses = Array.from(courseMap.values())
          .slice(0, 5)
          .map((course: any) => {
            return {
              id: `course-${course.programme}-${course.metaclass}`,
              name: course.title || course.code,
              path: `/courses?code=${course.code}&programme=${course.programme}&metaclass=${course.metaclass}`,
              category: 'page' as const,
              icon: BookOpen,
              description: course.description || `${course.code} course`,
              keywords: [course.title, course.code, course.description || ''],
              priority: 9,
              metadata: {
                programme: course.programme,
                metaclass: course.metaclass,
                code: course.code,
              },
            } as SearchItem;
          });

        homepageCourses.set(courses);
      } else {
        // Try to fetch fresh data
        try {
          const coursesData = await invoke<Folder[]>('get_courses_subjects').catch(() => null);
          if (coursesData) {
            const courseMap = new Map<string, any>();
            coursesData.forEach((folder: Folder) => {
              folder.subjects?.forEach((subject: any) => {
                const key = `${subject.programme}-${subject.metaclass}`;
                if (!courseMap.has(key)) {
                  courseMap.set(key, {
                    programme: subject.programme,
                    metaclass: subject.metaclass,
                    code: subject.code,
                    title: subject.title,
                    description: subject.description,
                  });
                }
              });
            });

            const courses = Array.from(courseMap.values())
              .slice(0, 5)
              .map((course: any) => {
                return {
                  id: `course-${course.programme}-${course.metaclass}`,
                  name: course.title || course.code,
                  path: `/courses?code=${course.code}&programme=${course.programme}&metaclass=${course.metaclass}`,
                  category: 'page' as const,
                  icon: BookOpen,
                  description: course.description || `${course.code} course`,
                  keywords: [course.title, course.code, course.description || ''],
                  priority: 9,
                  metadata: {
                    programme: course.programme,
                    metaclass: course.metaclass,
                    code: course.code,
                  },
                } as SearchItem;
              });

            homepageCourses.set(courses);
          } else {
            homepageCourses.set([]);
          }
        } catch (e) {
          console.warn('Failed to load homepage courses:', e);
          homepageCourses.set([]);
        }
      }
    } catch (error) {
      console.warn('Failed to load homepage data:', error);
      homepageAssessments.set([]);
      homepageCourses.set([]);
    }
  }

  // Load dynamic data (assessments and courses) when searching
  async function loadDynamicSearchData(query: string) {
    if (!query.trim() || query.length < 2) {
      dynamicAssessments = [];
      dynamicCourses = [];
      return;
    }

    loadingDynamic = true;
    const searchLower = query.toLowerCase();

    try {
      // First try to search directly in database for faster results
      const [dbAssessments, dbCourses, cachedAssessments, cachedCourses] = await Promise.all([
        invoke<Assessment[]>('db_search_assessments', { query: searchLower, limit: 5 }).catch(
          () => null,
        ),
        invoke<any[]>('db_search_courses', { query: searchLower, limit: 5 }).catch(() => null),
        idbCacheGet<{
          assessments: Assessment[];
          subjects: Subject[];
          all_subjects: Subject[];
        }>('assessments_overview_data'),
        idbCacheGet<Folder[]>('courses_subjects_folders'),
      ]);

      // If database search returned results, use them
      if (dbAssessments && dbAssessments.length > 0) {
        const matchedAssessments = dbAssessments
          .slice(0, 5)
          .map((a: any) => {
            // Database returns parsed JSON Value objects - they should already be objects
            // The data column contains the full assessment JSON, which is parsed by Rust
            const assessment = typeof a === 'string' ? JSON.parse(a) : a;

            if (!assessment || typeof assessment !== 'object') {
              console.warn('Invalid assessment data:', assessment);
              return null;
            }

            const dueDate = new Date(assessment.due || Date.now());
            const isOverdue =
              assessment.overdue || (assessment.due && new Date(assessment.due) < new Date());
            const statusBadge = isOverdue ? 'Overdue' : dueDate.toLocaleDateString();

            return {
              id: `assessment-${assessment.id}-${assessment.metaclassID || assessment.metaclass}`,
              name: assessment.title,
              path: `/assessments/${assessment.id}/${assessment.metaclassID || assessment.metaclass}`,
              category: 'page' as const,
              icon: ClipboardDocumentList,
              description: `${assessment.code} • ${assessment.subject || 'Unknown'}`,
              keywords: [assessment.title, assessment.code, assessment.subject || ''],
              badge: statusBadge,
              priority: isOverdue ? 15 : 8,
              metadata: {
                assessmentId: assessment.id,
                metaclassId: assessment.metaclassID || assessment.metaclass,
              },
            } as SearchItem;
          })
          .filter((item): item is SearchItem => item !== null);

        dynamicAssessments = matchedAssessments;
      } else {
        // Fallback to full data fetch if database search didn't return results
        const assessmentsData = cachedAssessments
          ? cachedAssessments
          : await invoke<{
              assessments: Assessment[];
              subjects: Subject[];
              all_subjects: Subject[];
            }>('get_processed_assessments').catch(() => null);

        // Process assessments from full data
        if (assessmentsData?.assessments) {
          const matchedAssessments = assessmentsData.assessments
            .filter((a: Assessment) => {
              const titleMatch = a.title.toLowerCase().includes(searchLower);
              const codeMatch = a.code.toLowerCase().includes(searchLower);
              const subjectMatch = a.subject?.toLowerCase().includes(searchLower);
              return titleMatch || codeMatch || subjectMatch;
            })
            .slice(0, 5) // Limit to 5 results
            .map((a: Assessment) => {
              const dueDate = new Date(a.due);
              const isOverdue = a.overdue;
              const statusBadge = isOverdue ? 'Overdue' : dueDate.toLocaleDateString();

              return {
                id: `assessment-${a.id}-${a.metaclassID}`,
                name: a.title,
                path: `/assessments/${a.id}/${a.metaclassID}`,
                category: 'page' as const,
                icon: ClipboardDocumentList,
                description: `${a.code} • ${a.subject || 'Unknown'}`,
                keywords: [a.title, a.code, a.subject || ''],
                badge: statusBadge,
                priority: isOverdue ? 15 : 8,
                metadata: { assessmentId: a.id, metaclassId: a.metaclassID },
              } as SearchItem;
            });

          dynamicAssessments = matchedAssessments;
        } else {
          dynamicAssessments = [];
        }
      }

      // Process courses - try database first, then fallback
      if (dbCourses && dbCourses.length > 0) {
        const matchedCourses = dbCourses
          .slice(0, 5)
          .map((c: any) => {
            // Database returns parsed JSON Value objects - they should already be objects
            // The data column contains the full course JSON, which is parsed by Rust
            const courseData = typeof c === 'string' ? JSON.parse(c) : c;

            if (!courseData || typeof courseData !== 'object') {
              console.warn('Invalid course data:', courseData);
              return null;
            }

            // The data field contains the full course object
            const course = courseData.data ? courseData.data : courseData;

            if (!course || !course.programme || !course.metaclass) {
              console.warn('Invalid course structure:', course);
              return null;
            }

            return {
              id: `course-${course.programme}-${course.metaclass}`,
              name: course.title || course.course_code,
              path: `/courses?code=${course.course_code}&programme=${course.programme}&metaclass=${course.metaclass}`,
              category: 'page' as const,
              icon: BookOpen,
              description: course.description || `${course.course_code} course`,
              keywords: [course.title, course.course_code, course.description || ''],
              priority: 9,
              metadata: {
                programme: course.programme,
                metaclass: course.metaclass,
                code: course.course_code,
              },
            } as SearchItem;
          })
          .filter((item): item is SearchItem => item !== null);

        dynamicCourses = matchedCourses;
      } else {
        // Fallback to full data fetch
        const coursesData = cachedCourses
          ? cachedCourses
          : await invoke<Folder[]>('get_courses_subjects').catch(() => null);

        if (coursesData) {
          const allSubjects = coursesData.flatMap((f: Folder) => f.subjects || []);
          const matchedSubjects = allSubjects
            .filter((s: any) => {
              const titleMatch = s.title?.toLowerCase().includes(searchLower);
              const codeMatch = s.code?.toLowerCase().includes(searchLower);
              const descMatch = s.description?.toLowerCase().includes(searchLower);
              return titleMatch || codeMatch || descMatch;
            })
            .slice(0, 5) // Limit to 5 results
            .map((s: any) => {
              return {
                id: `course-${s.programme}-${s.metaclass}`,
                name: s.title || s.code,
                path: `/courses?code=${s.code}&programme=${s.programme}&metaclass=${s.metaclass}`,
                category: 'page' as const,
                icon: BookOpen,
                description: s.description || `${s.code} course`,
                keywords: [s.title, s.code, s.description || ''],
                priority: 9,
                metadata: { programme: s.programme, metaclass: s.metaclass, code: s.code },
              } as SearchItem;
            });

          dynamicCourses = matchedSubjects;
        } else {
          dynamicCourses = [];
        }
      }
    } catch (error) {
      console.warn('Failed to load dynamic search data:', error);
      dynamicAssessments = [];
      dynamicCourses = [];
    } finally {
      loadingDynamic = false;
    }
  }

  // Watch search query and load dynamic data
  let lastSearchQuery = $state('');
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const query = $searchStore.trim();

    // Don't clear timeout here - let cleanup functions handle it
    // This prevents clearing a timeout that's about to fire
    // The cleanup from previous effect run will clear it if needed

    // Only trigger if query meaningfully changed (not just whitespace changes)
    // This prevents triggering when adding trailing/leading spaces
    if (query === lastSearchQuery) {
      return; // Query hasn't meaningfully changed (e.g., "test" -> "test " still trims to "test")
    }

    if (query && query.length >= 2 && $showModal) {
      // Debounce dynamic loading
      // Capture timeout ID in closure to prevent cleanup from clearing wrong timeout
      const timeoutId = setTimeout(() => {
        // Double-check query hasn't changed during debounce and modal is still open
        const currentQuery = $searchStore.trim();
        if (currentQuery === query && $showModal) {
          loadDynamicSearchData(query);
        }
        // Update lastSearchQuery after successful search
        lastSearchQuery = query;
        // Only clear if this is still the active timeout
        if (searchTimeout === timeoutId) {
          searchTimeout = null;
        }
      }, 300);
      searchTimeout = timeoutId;
      return () => {
        // Only clear this specific timeout, not any new one that might have been set
        // Use a closure variable to ensure we only clear the timeout we created
        const timeoutToClear = timeoutId;
        if (searchTimeout === timeoutToClear) {
          clearTimeout(timeoutToClear);
          // Only nullify if we're clearing the current active timeout
          if (searchTimeout === timeoutToClear) {
            searchTimeout = null;
          }
        }
      };
    } else {
      // Update lastSearchQuery when clearing
      lastSearchQuery = query;
      dynamicAssessments = [];
      dynamicCourses = [];
    }
  });

  // Global shortcuts
  onMount(() => {
    loadSearchData();
    loadDynamicPages();
    loadHomepageData();

    // Check for URL params on mount
    const urlSearch = getUrlParam('search');
    const urlGo = getUrlParam('go');

    if (urlSearch) {
      searchStore.set(urlSearch);
      openModal();
    }

    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault();
            if (e.shiftKey) {
              openCommandMode();
            } else {
              openModal();
            }
            break;
          case '/':
            e.preventDefault();
            toggleFuzzyMode();
            break;
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.global-search-modal')) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      document.removeEventListener('mousedown', handleClick);
      if (urlUpdateTimeout) {
        clearTimeout(urlUpdateTimeout);
      }
    };
  });
</script>

<!-- Header search trigger -->
<div class="flex-1 flex justify-center" data-tauri-drag-region>
  <Button
    variant="ghost"
    onclick={openModal}
    ariaLabel="Open global search (Ctrl+K)"
    class="group relative max-w-72 w-full px-5 py-2 rounded-xl bg-white/20 dark:bg-zinc-800/40 border border-accent text-accent font-semibold shadow-md backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-accent focus:ring-offset-2 flex items-center justify-between
    sm:max-w-72 sm:px-5 sm:w-full md:max-w-60 md:px-4 lg:max-w-72 lg:px-5
    max-[640px]:max-w-48 max-[640px]:px-3 max-[500px]:max-w-36 max-[500px]:px-2 max-[400px]:max-w-12 max-[400px]:px-0 max-[400px]:justify-center">
    <div class="flex items-center gap-3 min-w-0 max-[400px]:gap-0">
      <Icon src={MagnifyingGlass} class="w-4 h-4 opacity-70 shrink-0" />
      <span class="opacity-70 truncate max-[500px]:text-sm max-[400px]:hidden">
        Quick search...
      </span>
    </div>
    <div class="flex items-center gap-1 opacity-50 text-xs shrink-0 max-[500px]:hidden">
      <kbd class="px-1.5 py-0.5 rounded-sm bg-white/20 dark:bg-zinc-700/50">⌘</kbd>
      <kbd class="px-1.5 py-0.5 rounded-sm bg-white/20 dark:bg-zinc-700/50">K</kbd>
    </div>
  </Button>
</div>

<SearchModal
  showModal={$showModal}
  bind:searchQuery={$searchStore}
  searchMode={$searchMode}
  currentCategory={$currentCategory}
  selectedIndex={$selectedIndex}
  filteredItems={$filteredItems}
  visibleCategories={$visibleCategories}
  favoriteItems={$favoriteItems}
  {isAdvancedMode}
  onClose={closeModal}
  onGoBack={goBack}
  onSelect={handleSelect}
  onSelectCategory={openCategory}
  onToggleFavorite={toggleFavorite}
  onKeydown={handleKeydown}
  onMouseEnter={(index) => selectedIndex.set(index)}
  {loadingDynamic} />
