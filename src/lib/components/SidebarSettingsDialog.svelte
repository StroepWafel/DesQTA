<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import {
    ChevronUp,
    ChevronDown,
    ChevronRight,
    XMark,
    Plus,
    Trash,
    Star,
    Folder,
    PencilSquare,
  } from 'svelte-hero-icons';
  import { Button, Input, Dropdown } from '$lib/components/ui';
  import T from './T.svelte';
  import { _ } from '../i18n';
  import { fly, fade, slide } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import type { SidebarFolder, MenuItem } from '../types/sidebar';
  import { invoke } from '@tauri-apps/api/core';
  import { saveSettingsWithQueue, flushSettingsQueue } from '../services/settingsSync';
  import { logger } from '../../utils/logger';

  interface Props {
    open: boolean;
    menu: MenuItem[];
    onClose: () => void;
    onSave?: () => void;
  }

  let { open, menu, onClose, onSave }: Props = $props();

  let folders = $state<SidebarFolder[]>([]);
  let favorites = $state<string[]>([]);
  let editingFolder: SidebarFolder | null = $state(null);
  let newFolderName = $state('');
  let newFolderIcon = $state('');
  let loading = $state(false);
  let orderedMenu = $state([...menu]);
  let isUpdatingOrder = $state(false);
  let isUpdatingList = $state(false);

  // Combined list item type
  type ListItem = { type: 'menu'; item: MenuItem } | { type: 'folder'; folder: SidebarFolder };

  // Combined order state (stores paths and "folder:ID" strings)
  let combinedOrder = $state<(string | { type: 'folder'; id: string })[]>([]);

  // Get combined ordered list (menu items and folders) based on combinedOrder
  function computeOrderedList(): ListItem[] {
    const list: ListItem[] = [];
    const folderPaths = new Set(folders.flatMap((f) => f.items));
    const menuMap = new Map(orderedMenu.map((item) => [item.path, item]));
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
      orderedMenu.forEach((item) => {
        if (!folderPaths.has(item.path)) {
          list.push({ type: 'menu', item });
        }
      });
      folders.forEach((folder) => {
        list.push({ type: 'folder', folder });
      });
    }

    // Add any new items/folders not in the order
    orderedMenu.forEach((item) => {
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

  // Load sidebar configuration
  const loadConfig = async () => {
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

        // Apply menu order for menu items
        const ordered: MenuItem[] = [];
        const addedPaths = new Set<string>();

        for (const orderItem of menuOrder) {
          if (!orderItem.startsWith('folder:')) {
            const item = menu.find((m) => m.path === orderItem);
            if (item) {
              ordered.push(item);
              addedPaths.add(orderItem);
            }
          }
        }

        // Add any items not in saved order
        for (const item of menu) {
          if (!addedPaths.has(item.path)) {
            ordered.push(item);
          }
        }

        orderedMenu = ordered;
      } else {
        // Initialize combined order with current state
        const folderPaths = new Set(folders.flatMap((f) => f.items));
        combinedOrder = [
          ...orderedMenu.filter((item) => !folderPaths.has(item.path)).map((item) => item.path),
          ...folders.map((folder) => ({ type: 'folder' as const, id: folder.id })),
        ];
      }
    } catch (e) {
      logger.error('SidebarSettingsDialog', 'loadConfig', `Failed to load config: ${e}`, {
        error: e,
      });
    }
  };

  // Reset when dialog opens
  $effect(() => {
    if (open) {
      editingFolder = null;
      newFolderName = '';
      newFolderIcon = '';
      orderedMenu = [...menu];
      // Load config and update ordered list asynchronously
      (async () => {
        await loadConfig();
        // Initialize combined order if empty
        if (combinedOrder.length === 0) {
          const folderPaths = new Set(folders.flatMap((f) => f.items));
          combinedOrder = [
            ...orderedMenu.filter((item) => !folderPaths.has(item.path)).map((item) => item.path),
            ...folders.map((folder) => ({ type: 'folder' as const, id: folder.id })),
          ];
        }
        // Update ordered list after loading config
        updateOrderedList();
      })();
    }
  });

  // Update ordered list when folders or menu changes (but not when combinedOrder changes from manual reordering)
  // Note: We update orderedList manually when needed, not reactively to avoid infinite loops

  // Get menu items not in any folder or favorites
  const getAvailableItems = (): MenuItem[] => {
    const folderPaths = new Set(folders.flatMap((f) => f.items));
    const favoritePaths = new Set(favorites);
    return menu.filter((item) => !folderPaths.has(item.path) && !favoritePaths.has(item.path));
  };

  // Get items in a folder
  const getFolderItems = (folder: SidebarFolder): MenuItem[] => {
    return folder.items
      .map((path) => menu.find((item) => item.path === path))
      .filter((item): item is MenuItem => item !== undefined);
  };

  // Create new folder
  const createFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: SidebarFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      icon: newFolderIcon.trim() || undefined,
      items: [],
      collapsed: false,
      order: folders.length,
    };

    folders = [...folders, newFolder];
    // Add to combined order
    combinedOrder = [...combinedOrder, { type: 'folder' as const, id: newFolder.id }];
    // Update ordered list
    updateOrderedList();
    newFolderName = '';
    newFolderIcon = '';
  };

  // Delete folder
  const deleteFolder = (folderId: string) => {
    folders = folders.filter((f) => f.id !== folderId);
    // Remove from combined order
    combinedOrder = combinedOrder.filter(
      (item) => typeof item === 'string' || item.id !== folderId,
    );
    // Update ordered list
    updateOrderedList();
  };

  // Edit folder
  const startEditFolder = (folder: SidebarFolder) => {
    editingFolder = { ...folder };
  };

  // Save edited folder
  const saveEditedFolder = () => {
    if (!editingFolder || !editingFolder.name.trim()) return;

    folders = folders.map((f) => (f.id === editingFolder!.id ? editingFolder! : f));
    editingFolder = null;
  };

  // Cancel editing
  const cancelEdit = () => {
    editingFolder = null;
  };

  // Toggle favorite
  const toggleFavorite = (path: string) => {
    if (favorites.includes(path)) {
      favorites = favorites.filter((p) => p !== path);
    } else {
      favorites = [...favorites, path];
    }
  };

  // Add item to folder
  const addItemToFolder = (folderId: string, path: string) => {
    folders = folders.map((f) => {
      if (f.id === folderId && !f.items.includes(path)) {
        return { ...f, items: [...f.items, path] };
      }
      return f;
    });
  };

  // Remove item from folder
  const removeItemFromFolder = (folderId: string, path: string) => {
    folders = folders.map((f) => {
      if (f.id === folderId) {
        return { ...f, items: f.items.filter((p) => p !== path) };
      }
      return f;
    });
  };

  // Toggle folder collapse
  const toggleFolder = (folderId: string) => {
    folders = folders.map((f) => (f.id === folderId ? { ...f, collapsed: !f.collapsed } : f));
  };

  // Update ordered list from combined order
  function updateOrderedList() {
    if (isUpdatingList) return; // Prevent recursive calls
    isUpdatingList = true;
    orderedList = computeOrderedList();
    isUpdatingList = false;
  }

  // Update combined order when items are moved
  function updateCombinedOrder() {
    isUpdatingOrder = true;
    combinedOrder = orderedList.map((item) => {
      if (item.type === 'menu') {
        return item.item.path;
      } else {
        return { type: 'folder' as const, id: item.folder.id };
      }
    });
    isUpdatingOrder = false;
  }

  // Menu reordering functions (in combined list)
  function moveUpInList(listIndex: number) {
    if (listIndex > 0) {
      const newList = [...orderedList];
      [newList[listIndex - 1], newList[listIndex]] = [newList[listIndex], newList[listIndex - 1]];

      // Update ordered list
      orderedList = newList;

      // Update combined order
      updateCombinedOrder();

      // Update orderedMenu if menu items were swapped
      const swappedItem = newList[listIndex];
      const prevItem = newList[listIndex - 1];
      if (swappedItem.type === 'menu' && prevItem.type === 'menu') {
        const menuIndex = orderedMenu.indexOf(swappedItem.item);
        const prevMenuIndex = orderedMenu.indexOf(prevItem.item);
        const newMenu = [...orderedMenu];
        [newMenu[prevMenuIndex], newMenu[menuIndex]] = [newMenu[menuIndex], newMenu[prevMenuIndex]];
        orderedMenu = newMenu;
      }
    }
  }

  function moveDownInList(listIndex: number) {
    if (listIndex < orderedList.length - 1) {
      moveUpInList(listIndex + 1);
    }
  }

  // Move item to folder
  function moveItemToFolder(path: string, folderId: string) {
    // Remove from other folders first
    folders = folders.map((f) => ({
      ...f,
      items: f.items.filter((p) => p !== path),
    }));

    // Add to target folder
    addItemToFolder(folderId, path);
  }

  // Get folder dropdown items for a menu item
  function getFolderDropdownItems(itemPath: string) {
    const currentFolder = folders.find((f) => f.items.includes(itemPath));
    return folders.map((folder) => ({
      id: folder.id,
      label: folder.name,
      icon: Folder,
      onClick: () => moveItemToFolder(itemPath, folder.id),
      disabled: folder.id === currentFolder?.id,
    }));
  }

  // Save settings
  const handleSave = async () => {
    loading = true;
    try {
      // Convert combined order to string array for storage
      const menuOrder = combinedOrder.map((item) => {
        if (typeof item === 'string') {
          return item;
        } else {
          return `folder:${item.id}`;
        }
      });

      await saveSettingsWithQueue({
        menu_order: menuOrder,
        sidebar_folders: folders,
        sidebar_favorites: favorites,
      });
      await flushSettingsQueue();

      if (onSave) {
        onSave();
      }
      onClose();
    } catch (e) {
      logger.error('SidebarSettingsDialog', 'handleSave', `Failed to save: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  };

  // Reset to default sidebar configuration
  const resetToDefault = async () => {
    try {
      // Reset to default: empty folders, empty favorites, original menu order
      folders = [];
      favorites = [];
      orderedMenu = [...menu];
      combinedOrder = menu.map((item) => item.path);
      updateOrderedList();

      // Save the reset state
      await saveSettingsWithQueue({
        sidebar_folders: [],
        sidebar_favorites: [],
        menu_order: menu.map((item) => item.path),
        sidebar_recent_activity: [],
      });
      await flushSettingsQueue();
    } catch (e) {
      logger.error('SidebarSettingsDialog', 'resetToDefault', `Failed to reset: ${e}`, {
        error: e,
      });
    }
  };
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 transition-opacity"
    transition:fade={{ duration: 300, easing: cubicInOut }}
    onclick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') onClose();
    }}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="sidebar-settings-dialog-title">
    <!-- Dialog -->
    <div
      class="relative bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
      transition:fly={{ duration: 300, y: 20, easing: cubicInOut }}>
      <!-- Header -->
      <div
        class="flex justify-between items-center p-6 border-b border-zinc-200 dark:border-zinc-700">
        <h2
          id="sidebar-settings-dialog-title"
          class="text-xl font-semibold text-zinc-900 dark:text-white">
          <T key="settings.sidebar_settings" fallback="Sidebar Settings" />
        </h2>
        <button
          onclick={onClose}
          class="p-2 text-zinc-600 rounded-lg transition-all duration-200 transform dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          aria-label={$_('common.close') || 'Close'}>
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto flex-1 p-6 space-y-6">
        <!-- Menu Order Section -->
        <div>
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
              <T key="settings.menu_order" fallback="Menu Order" />
            </h3>
            <div class="flex gap-2">
              <Input
                bind:value={newFolderName}
                placeholder={$_('settings.folder_name') || 'Folder name'}
                class="w-40"
                onkeydown={(e) => {
                  if (e.key === 'Enter') createFolder();
                }} />
              <Input
                bind:value={newFolderIcon}
                placeholder={$_('settings.folder_icon') || 'Icon (optional)'}
                class="w-32" />
              <Button onclick={createFolder} variant="secondary" size="sm">
                <Icon src={Plus} class="w-4 h-4 mr-1" />
                <T key="common.add_folder" fallback="Add Folder" />
              </Button>
            </div>
          </div>
          <p class="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            <T
              key="settings.reorder_pages_description"
              fallback="Use the arrow buttons to reorder items. Click the star to favorite items. Use the folder button to organize items into folders." />
          </p>

          <div class="space-y-2">
            {#each orderedList as listItem, listIndex}
              {#if listItem.type === 'menu'}
                {@const item = listItem.item}
                {@const isFavorite = favorites.includes(item.path)}
                {@const currentFolder = folders.find((f) => f.items.includes(item.path))}
                <div
                  data-id={item.path}
                  class="flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 hover:shadow-md"
                  style="animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                  style:animation-delay="{listIndex * 20}ms">
                  <!-- Icon -->
                  <div class="shrink-0">
                    <Icon src={item.icon} class="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                  </div>

                  <!-- Label -->
                  <div class="flex-1 min-w-0">
                    <T key={item.labelKey} fallback={item.labelKey} />
                  </div>

                  <!-- Action Buttons Group -->
                  <div class="flex shrink-0 items-center gap-2">
                    <!-- Favorite Button -->
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.path);
                      }}
                      class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 {isFavorite
                        ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'text-zinc-400 hover:text-yellow-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}"
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                      <Icon src={Star} class="w-5 h-5" />
                    </button>

                    <!-- Move to Folder Button -->
                    {#if folders.length > 0}
                      <Dropdown
                        items={getFolderDropdownItems(item.path)}
                        buttonIcon={Folder}
                        buttonText={currentFolder ? currentFolder.name : 'Move to Folder'}
                        placement="bottom-end"
                        class="!p-2.5 !rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        menuClass="backdrop-blur-md shadow-2xl bg-white/95 dark:bg-zinc-900/90" />
                    {/if}

                    <!-- Move Up Button -->
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        moveUpInList(listIndex);
                      }}
                      disabled={listIndex === 0}
                      class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      aria-label={$_('common.move_up') || 'Move up'}
                      title={$_('common.move_up') || 'Move up'}>
                      <Icon src={ChevronUp} class="w-5 h-5" />
                    </button>

                    <!-- Move Down Button -->
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        moveDownInList(listIndex);
                      }}
                      disabled={listIndex === orderedList.length - 1}
                      class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      aria-label={$_('common.move_down') || 'Move down'}
                      title={$_('common.move_down') || 'Move down'}>
                      <Icon src={ChevronDown} class="w-5 h-5" />
                    </button>
                  </div>
                </div>
              {:else if listItem.type === 'folder'}
                {@const folder = listItem.folder}
                {@const folderItems = getFolderItems(folder)}
                <div
                  class="rounded-lg border transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 hover:shadow-md overflow-hidden"
                  style="animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                  style:animation-delay="{listIndex * 20}ms">
                  {#if editingFolder?.id === folder.id}
                    <!-- Edit Mode -->
                    <div class="p-4 space-y-2">
                      <Input
                        bind:value={editingFolder!.name}
                        placeholder={$_('settings.folder_name') || 'Folder name'} />
                      <div class="flex gap-2">
                        <Button onclick={saveEditedFolder} size="sm">
                          <T key="common.save" fallback="Save" />
                        </Button>
                        <Button onclick={cancelEdit} variant="secondary" size="sm">
                          <T key="common.cancel" fallback="Cancel" />
                        </Button>
                      </div>
                    </div>
                  {:else}
                    <!-- Folder Header (styled like nav item) -->
                    <div class="w-full flex items-center gap-3 p-4">
                      <button
                        onclick={() => toggleFolder(folder.id)}
                        class="flex-1 flex items-center gap-3 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-zinc-50 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-lg p-2 -m-2">
                        <!-- Chevron Icon -->
                        <div
                          class="shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] {folder.collapsed
                            ? 'rotate-0'
                            : 'rotate-90'}">
                          <Icon
                            src={ChevronRight}
                            class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </div>

                        <!-- Folder Icon -->
                        <div class="shrink-0">
                          <Icon src={Folder} class="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                        </div>

                        <!-- Folder Name -->
                        <div class="flex-1 min-w-0 text-left">
                          <span class="font-medium text-zinc-900 dark:text-white"
                            >{folder.name}</span>
                          {#if folderItems.length > 0}
                            <span class="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                              ({folderItems.length})
                            </span>
                          {/if}
                        </div>
                      </button>

                      <!-- Action Buttons -->
                      <div class="flex shrink-0 items-center gap-2">
                        <button
                          onclick={() => moveUpInList(listIndex)}
                          disabled={listIndex === 0}
                          class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          aria-label="Move folder up"
                          title="Move folder up">
                          <Icon src={ChevronUp} class="w-5 h-5" />
                        </button>
                        <button
                          onclick={() => moveDownInList(listIndex)}
                          disabled={listIndex === orderedList.length - 1}
                          class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          aria-label="Move folder down"
                          title="Move folder down">
                          <Icon src={ChevronDown} class="w-5 h-5" />
                        </button>
                        <button
                          onclick={() => startEditFolder(folder)}
                          class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          aria-label="Edit folder"
                          title="Edit folder">
                          <Icon src={PencilSquare} class="w-5 h-5" />
                        </button>
                        <button
                          onclick={() => deleteFolder(folder.id)}
                          class="p-2.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          aria-label="Delete folder"
                          title="Delete folder">
                          <Icon src={Trash} class="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <!-- Folder Items (with smooth expand/collapse) -->
                    {#if !folder.collapsed}
                      <div
                        transition:slide={{ duration: 300, easing: cubicInOut }}
                        class="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30">
                        {#if folderItems.length === 0}
                          <p class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4 px-4">
                            <T key="settings.drag_items_here" fallback="No items in this folder" />
                          </p>
                        {:else}
                          <div class="p-3 space-y-2">
                            {#each folderItems as item, itemIndex}
                              <div
                                class="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:shadow-sm"
                                in:fade={{ duration: 200, delay: itemIndex * 30 }}
                                style="animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                                style:animation-delay="{itemIndex * 30}ms">
                                <Icon
                                  src={item.icon}
                                  class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                                <span
                                  class="flex-1 text-sm font-medium text-zinc-900 dark:text-white">
                                  <T key={item.labelKey} fallback={item.labelKey} />
                                </span>
                                <button
                                  onclick={() => removeItemFromFolder(folder.id, item.path)}
                                  class="p-1.5 rounded-lg transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  aria-label="Remove from folder"
                                  title="Remove from folder">
                                  <Icon src={XMark} class="w-4 h-4" />
                                </button>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex justify-between items-center p-6 border-t border-zinc-200 dark:border-zinc-700 gap-3">
        <Button
          onclick={resetToDefault}
          variant="secondary"
          class="transition-all duration-200 transform hover:scale-105 active:scale-95">
          <T key="settings.reset_to_default" fallback="Reset to Default" />
        </Button>
        <div class="flex gap-3">
          <Button
            onclick={onClose}
            variant="secondary"
            class="transition-all duration-200 transform hover:scale-105 active:scale-95">
            <T key="common.cancel" fallback="Cancel" />
          </Button>
          <Button
            onclick={handleSave}
            disabled={loading}
            class="transition-all duration-200 transform hover:scale-105 active:scale-95">
            {#if loading}
              <div
                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2">
              </div>
            {/if}
            <T key="common.save" fallback="Save" />
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if}
