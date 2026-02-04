<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Icon, XMark, ChevronDown, ChevronRight, Star, Folder } from 'svelte-hero-icons';
  import { _ } from '../i18n';
  import T from './T.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import type { SidebarFolder } from '../types/sidebar';
  import { invoke } from '@tauri-apps/api/core';
  import { saveSettingsWithQueue } from '../services/settingsSync';

  interface MenuItem {
    labelKey: string;
    icon: any;
    path: string;
    folderId?: string;
    isFavorite?: boolean;
    isRecent?: boolean;
  }

  interface Props {
    sidebarOpen: boolean;
    menu: MenuItem[];
    onMenuItemClick?: () => void;
  }

  let { sidebarOpen, menu, onMenuItemClick }: Props = $props();

  let folders = $state<SidebarFolder[]>([]);
  let favorites = $state<string[]>([]);
  let collapsedFolders = $state<Set<string>>(new Set());
  let loading = $state(true);
  let combinedOrder = $state<(string | { type: 'folder'; id: string })[]>([]);

  let asideElement: HTMLElement | null = $state(null);

  // Combined list item type
  type ListItem = { type: 'menu'; item: MenuItem } | { type: 'folder'; folder: SidebarFolder };

  // Get combined ordered list (menu items and folders) based on combinedOrder
  function computeOrderedList(): ListItem[] {
    const list: ListItem[] = [];
    const folderPaths = new Set(folders.flatMap((f) => f.items));
    const menuMap = new Map(menu.map((item) => [item.path, item]));
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));

    // If we have a saved combined order, use it
    if (combinedOrder.length > 0) {
      for (const orderItem of combinedOrder) {
        if (typeof orderItem === 'string') {
          // It's a menu item path
          const item = menuMap.get(orderItem);
          if (item && !folderPaths.has(item.path)) {
            list.push({ type: 'menu', item });
          }
        } else if (orderItem.type === 'folder') {
          // It's a folder
          const folder = folderMap.get(orderItem.id);
          if (folder) {
            list.push({ type: 'folder', folder });
          }
        }
      }
    } else {
      // Default: menu items first, then folders
      menu.forEach((item) => {
        if (!folderPaths.has(item.path)) {
          list.push({ type: 'menu', item });
        }
      });
      folders.forEach((folder) => {
        list.push({ type: 'folder', folder });
      });
    }

    // Add any new items/folders not in the order
    menu.forEach((item) => {
      if (
        !folderPaths.has(item.path) &&
        !list.some((li) => li.type === 'menu' && li.item.path === item.path)
      ) {
        list.push({ type: 'menu', item });
      }
    });
    folders.forEach((folder) => {
      if (!list.some((li) => li.type === 'folder' && li.folder.id === folder.id)) {
        list.push({ type: 'folder', folder });
      }
    });

    return list;
  }

  let orderedList = $state<ListItem[]>([]);

  function handleMenuItemClick() {
    if (onMenuItemClick) {
      onMenuItemClick();
    }
  }

  function handleCloseSidebar() {
    if (onMenuItemClick) {
      onMenuItemClick();
    }
  }

  function getCurrentPageIndex(): number {
    const currentPath = $page.url.pathname;
    return menu.findIndex((item) => {
      if (item.path === '/') {
        return currentPath === '/';
      }
      return currentPath.startsWith(item.path);
    });
  }

  function navigateToPage(index: number) {
    if (index >= 0 && index < menu.length) {
      goto(menu[index].path);
      if (onMenuItemClick) {
        onMenuItemClick();
      }
    }
  }

  function handleWheel(event: WheelEvent) {
    // Check if Control key is held (works for both Ctrl and Cmd on Mac)
    const isControlHeld = event.ctrlKey || event.metaKey;

    if (!isControlHeld || !sidebarOpen) {
      return;
    }

    // Prevent default scrolling behavior
    event.preventDefault();
    event.stopPropagation();

    const currentIndex = getCurrentPageIndex();
    if (currentIndex === -1) {
      return;
    }

    // Determine scroll direction
    const scrollDelta = event.deltaY;
    let nextIndex: number;

    if (scrollDelta > 0) {
      // Scrolling down - go to next page
      nextIndex = (currentIndex + 1) % menu.length;
    } else {
      // Scrolling up - go to previous page
      nextIndex = (currentIndex - 1 + menu.length) % menu.length;
    }

    navigateToPage(nextIndex);
  }

  // Load sidebar configuration
  const loadSidebarConfig = async () => {
    try {
      const settings = await invoke<any>('get_settings_subset', {
        keys: ['sidebar_folders', 'sidebar_favorites', 'menu_order'],
      });
      folders = (settings.sidebar_folders || []).sort(
        (a: SidebarFolder, b: SidebarFolder) => a.order - b.order,
      );
      favorites = settings.sidebar_favorites || [];

      // Parse combined order from menu_order (supports "folder:ID" format)
      const menuOrder = settings.menu_order as string[] | undefined;
      if (menuOrder && Array.isArray(menuOrder) && menuOrder.length > 0) {
        combinedOrder = menuOrder.map((item) => {
          if (item.startsWith('folder:')) {
            return { type: 'folder' as const, id: item.substring(7) };
          }
          return item;
        });
      } else {
        // Initialize combined order with current state
        const folderPaths = new Set(folders.flatMap((f) => f.items));
        combinedOrder = [
          ...menu.filter((item) => !folderPaths.has(item.path)).map((item) => item.path),
          ...folders.map((folder) => ({ type: 'folder' as const, id: folder.id })),
        ];
      }

      // Initialize collapsed state from folder settings
      folders.forEach((folder) => {
        if (folder.collapsed) {
          collapsedFolders.add(folder.id);
        }
      });

      // Update ordered list
      orderedList = computeOrderedList();
    } catch (e) {
      console.error('Failed to load sidebar config:', e);
    } finally {
      loading = false;
    }
  };

  // Get menu items by path
  const getMenuItemByPath = (path: string): MenuItem | undefined => {
    return menu.find((item) => item.path === path);
  };

  // Get favorites menu items
  const favoriteItems = $derived(() => {
    return favorites
      .map((path) => getMenuItemByPath(path))
      .filter((item): item is MenuItem => item !== undefined);
  });

  // Get items in folders
  const getFolderItems = (folder: SidebarFolder): MenuItem[] => {
    return folder.items
      .map((path) => getMenuItemByPath(path))
      .filter((item): item is MenuItem => item !== undefined);
  };

  // Get items not in any folder and not favorites (keep recent items in main nav)
  const getUnorganizedItems = (): MenuItem[] => {
    const folderPaths = new Set(folders.flatMap((f) => f.items));
    const favoritePaths = new Set(favorites);

    return menu.filter((item) => !folderPaths.has(item.path) && !favoritePaths.has(item.path));
  };

  const toggleFolder = (folderId: string) => {
    if (collapsedFolders.has(folderId)) {
      collapsedFolders.delete(folderId);
    } else {
      collapsedFolders.add(folderId);
    }
    collapsedFolders = new Set(collapsedFolders); // Trigger reactivity

    // Update folder collapsed state in settings
    folders = folders.map((f) => (f.id === folderId ? { ...f, collapsed: !f.collapsed } : f));
    // Save folder collapsed state (debounced via queue)
    saveSettingsWithQueue({ sidebar_folders: folders }).catch((e) =>
      console.error('Failed to save folder state:', e),
    );
  };

  const isFolderCollapsed = (folderId: string): boolean => {
    return collapsedFolders.has(folderId);
  };

  // Update ordered list when folders, menu, or combinedOrder changes
  $effect(() => {
    if (!loading && folders.length >= 0 && menu.length >= 0) {
      // Access folders and menu to track them
      folders;
      menu;
      combinedOrder;
      orderedList = computeOrderedList();
    }
  });

  onMount(() => {
    if (asideElement) {
      asideElement.addEventListener('wheel', handleWheel, { passive: false });
    }
    loadSidebarConfig();
  });

  onDestroy(() => {
    if (asideElement) {
      asideElement.removeEventListener('wheel', handleWheel);
    }
  });
</script>

<!-- Parent container that controls width animation -->
<aside
  bind:this={asideElement}
  class="transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden sm:relative rounded-bl-2xl theme-bg"
  class:fixed={sidebarOpen}
  class:top-0={sidebarOpen}
  class:left-0={sidebarOpen}
  class:h-full={sidebarOpen}
  class:z-30={sidebarOpen}
  class:w-full={sidebarOpen}
  class:w-0={!sidebarOpen}
  class:opacity-0={!sidebarOpen}
  class:pointer-events-none={!sidebarOpen}
  class:opacity-100={sidebarOpen}
  class:pointer-events-auto={sidebarOpen}
  class:sm:opacity-100={sidebarOpen}
  class:sm:pointer-events-auto={sidebarOpen}
  class:sm:w-64={sidebarOpen}
  class:sm:w-0={!sidebarOpen}
  class:sm:z-auto={sidebarOpen}>
  <!-- Nav with fixed width and absolute positioning -->
  <nav
    class="absolute top-0 right-0 w-full sm:w-64 h-full flex flex-col overflow-y-auto p-3 py-px space-y-2 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-transparent">
    <!-- Mobile Close Button -->
    <div class="flex justify-end sm:hidden mb-4">
      <button
        onclick={handleCloseSidebar}
        class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        aria-label={$_('navigation.close_sidebar', { default: 'Close sidebar' })}>
        <Icon src={XMark} class="w-5 h-5" />
      </button>
    </div>

    <!-- Mobile Header -->
    <div class="sm:hidden mb-6">
      <h2 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">
        <T key="navigation.menu" fallback="Menu" />
      </h2>
      <div class="w-12 h-1 bg-accent-500 rounded-full"></div>
    </div>

    {#if loading}
      <!-- Loading state -->
      <div class="flex items-center justify-center py-4">
        <div
          class="w-5 h-5 border-2 border-accent-600 border-t-transparent rounded-full animate-spin">
        </div>
      </div>
    {:else}
      <div class="flex-1 min-h-0 flex flex-col">
        <!-- Favorites Section -->
        {#if favoriteItems().length > 0}
          <div class="mb-2">
            <div
              class="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              <Icon src={Star} class="w-4 h-4" />
              <T key="navigation.favorites" fallback="Favorites" />
            </div>
            {#each favoriteItems() as item}
              {@const isActive =
                item.path === '/'
                  ? $page.url.pathname === '/'
                  : $page.url.pathname.startsWith(item.path)}
              <a
                href={item.path}
                onclick={handleMenuItemClick}
                class="flex gap-4 items-center text-md px-3 py-3 ml-4 font-medium rounded-xl transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] focus:outline-hidden {isActive
                  ? 'bg-accent text-white !text-white'
                  : 'text-zinc-900 dark:text-zinc-300 hover:bg-accent-200 hover:text-zinc-900 dark:hover:bg-accent-600 dark:hover:text-white !text-zinc-900 dark:!text-zinc-300'}">
                <Icon
                  src={item.icon}
                  class="w-6 h-6 {isActive ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}" />
                <span
                  class={isActive
                    ? 'text-white !text-white'
                    : 'text-zinc-900 dark:text-zinc-300 !text-zinc-900 dark:!text-zinc-300'}>
                  <T key={item.labelKey} fallback={item.labelKey} />
                </span>
              </a>
            {/each}
          </div>
        {/if}

        <!-- Combined Menu Items and Folders (in order) -->
        {#each orderedList as listItem}
          {#if listItem.type === 'menu'}
            {@const item = listItem.item}
            {@const isActive =
              item.path === '/'
                ? $page.url.pathname === '/'
                : $page.url.pathname.startsWith(item.path)}
            <a
              href={item.path}
              onclick={handleMenuItemClick}
              class="flex gap-4 items-center text-md px-3 py-3 font-medium rounded-xl transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] focus:outline-hidden {isActive
                ? 'bg-accent text-white !text-white'
                : 'text-zinc-900 dark:text-zinc-300 hover:bg-accent-200 hover:text-zinc-900 dark:hover:bg-accent-600 dark:hover:text-white !text-zinc-900 dark:!text-zinc-300'}">
              <Icon
                src={item.icon}
                class="w-6 h-6 {isActive ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'}" />
              <span
                class={isActive
                  ? 'text-white !text-white'
                  : 'text-zinc-900 dark:text-zinc-300 !text-zinc-900 dark:!text-zinc-300'}>
                <T key={item.labelKey} fallback={item.labelKey} />
              </span>
            </a>
          {:else if listItem.type === 'folder'}
            {@const folder = listItem.folder}
            {@const folderItems = getFolderItems(folder)}
            {#if folderItems.length > 0}
              <div class="space-y-0 w-full">
                <!-- Folder Header (styled exactly like nav item) -->
                <button
                  onclick={() => toggleFolder(folder.id)}
                  class="w-full flex gap-4 items-center text-md px-3 py-3 font-medium rounded-xl transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] focus:outline-hidden text-zinc-900 dark:text-zinc-300 hover:bg-accent-200 hover:text-zinc-900 dark:hover:bg-accent-600 dark:hover:text-white !text-zinc-900 dark:!text-zinc-300">
                  <!-- Folder Icon (always Heroicon Folder) -->
                  <Icon src={Folder} class="w-6 h-6 shrink-0 text-zinc-600 dark:text-zinc-400" />

                  <!-- Folder Name -->
                  <span
                    class="flex-1 min-w-0 text-left text-zinc-900 dark:text-zinc-300 !text-zinc-900 dark:!text-zinc-300">
                    {folder.name}
                    {#if folderItems.length > 0}
                      <span class="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                        ({folderItems.length})
                      </span>
                    {/if}
                  </span>

                  <!-- Chevron Icon (to the right) -->
                  <div
                    class="shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] {isFolderCollapsed(
                      folder.id,
                    )
                      ? 'rotate-0'
                      : 'rotate-90'}">
                    <Icon src={ChevronRight} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                </button>

                <!-- Folder Items (with smooth expand/collapse) -->
                {#if !isFolderCollapsed(folder.id)}
                  <div
                    transition:slide={{ duration: 300, easing: cubicInOut }}
                    class="ml-4 space-y-0">
                    {#each folderItems as item, itemIndex}
                      {@const isActive =
                        item.path === '/'
                          ? $page.url.pathname === '/'
                          : $page.url.pathname.startsWith(item.path)}
                      <a
                        href={item.path}
                        onclick={handleMenuItemClick}
                        class="flex gap-4 items-center text-md px-3 py-3 font-medium rounded-xl transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] focus:outline-hidden {isActive
                          ? 'bg-accent text-white !text-white'
                          : 'text-zinc-900 dark:text-zinc-300 hover:bg-accent-200 hover:text-zinc-900 dark:hover:bg-accent-600 dark:hover:text-white !text-zinc-900 dark:!text-zinc-300'}"
                        in:fade={{ duration: 200, delay: itemIndex * 30 }}>
                        <Icon
                          src={item.icon}
                          class="w-6 h-6 {isActive
                            ? 'text-white'
                            : 'text-zinc-600 dark:text-zinc-400'}" />
                        <span
                          class={isActive
                            ? 'text-white !text-white'
                            : 'text-zinc-900 dark:text-zinc-300 !text-zinc-900 dark:!text-zinc-300'}>
                          <T key={item.labelKey} fallback={item.labelKey} />
                        </span>
                      </a>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/if}
        {/each}
      </div>
    {/if}
  </nav>
</aside>
