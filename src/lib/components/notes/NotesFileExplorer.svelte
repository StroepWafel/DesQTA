<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Icon, FolderOpen, Document, FolderPlus, Plus, EllipsisVertical, Trash, PencilSquare, ArrowRightOnRectangle, ChevronLeft } from 'svelte-hero-icons';
  import { fly, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { invoke } from '@tauri-apps/api/core';
  import type { Note } from './types/editor';

  // Events
  const dispatch = createEventDispatcher<{
    selectNote: { note: Note };
    createNote: { folderPath: string[] };
    deleteNote: { noteId: string };
    createFolder: { name: string; parentPath?: string };
    deleteFolder: { path: string };
    renameFolder: { oldPath: string; newName: string };
    moveNote: { noteId: string; newFolderPath: string[] };
  }>();

  // Props
  export let selectedNoteId: string | null = null;

  // File tree item type
  interface FileTreeItem {
    id: string;
    name: string;
    path: string;
    item_type: 'file' | 'folder';
    size?: number;
    modified: string;
    children?: FileTreeItem[];
  }

  // State
  let fileTree: FileTreeItem[] = [];
  let loading = true;
  let error: string | null = null;
  let contextMenu: { x: number; y: number; item: FileTreeItem } | null = null;
  let showCreateFolderModal = false;
  let showRenameModal = false;
  let newFolderName = '';
  let renamingItem: FileTreeItem | null = null;
  let newItemName = '';
  
  // Drag and drop state
  let draggedItem: FileTreeItem | null = null;
  let dragOverFolder: string | null = null;
  
  // Folder navigation state
  let currentFolderPath: string[] = []; // Path to current folder
  let currentFolderItems: FileTreeItem[] = []; // Items in current folder
  let folderHistory: string[][] = []; // History for back navigation

  // Load file tree
  async function loadFileTreeInternal() {
    try {
      loading = true;
      error = null;
      fileTree = await invoke<FileTreeItem[]>('get_file_tree');
      updateCurrentFolderItems(); // Initialize current folder items
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load file tree';
      console.error('Failed to load file tree:', e);
    } finally {
      loading = false;
    }
  }

  // Export loadFileTree for external calls
  export async function loadFileTree() {
    await loadFileTreeInternal();
  }



  // Handle item selection
  async function handleItemSelect(item: FileTreeItem) {
    if (item.item_type === 'file') {
      try {
        // Load the note from filesystem and dispatch selection
        const notes = await invoke<Note[]>('load_notes_filesystem');
        const note = notes.find(n => n.title === item.name);
        if (note) {
          dispatch('selectNote', { note });
        }
      } catch (e) {
        console.error('Failed to load note:', e);
      }
    } else {
      // Navigate into the folder
      navigateIntoFolder(item);
    }
  }

  // Navigate into a folder
  function navigateIntoFolder(folderItem: FileTreeItem) {
    // Save current state to history
    folderHistory.push([...currentFolderPath]);
    
    // Update current folder path
    currentFolderPath = folderItem.path.split('/').filter(p => p.length > 0);
    
    // Update current folder items
    updateCurrentFolderItems();
  }

  // Navigate back to parent folder
  function navigateBack() {
    if (folderHistory.length > 0) {
      currentFolderPath = folderHistory.pop() || [];
      updateCurrentFolderItems();
    }
  }

  // Update current folder items based on current path
  function updateCurrentFolderItems() {
    if (currentFolderPath.length === 0) {
      // At root level
      currentFolderItems = fileTree;
    } else {
      // Find the folder in the tree
      let items = fileTree;
      for (const pathPart of currentFolderPath) {
        const folder = items.find(item => item.item_type === 'folder' && item.name === pathPart);
        if (folder && folder.children) {
          items = folder.children;
        } else {
          items = [];
          break;
        }
      }
      currentFolderItems = items;
    }
  }

  // Handle context menu
  function handleContextMenu(event: MouseEvent, item: FileTreeItem) {
    event.preventDefault();
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      item
    };
  }

  // Close context menu
  function closeContextMenu() {
    contextMenu = null;
  }

  // Create new note in folder
  function createNoteInFolder(folderPath: string) {
    const pathParts = folderPath ? folderPath.split('/').filter(p => p) : [];
    dispatch('createNote', { folderPath: pathParts });
    closeContextMenu();
  }

  // Create new folder
  export function openCreateFolderModal(parentPath?: string) {
    showCreateFolderModal = true;
    newFolderName = '';
    closeContextMenu();
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    
    try {
      await invoke('create_folder_filesystem', {
        name: newFolderName.trim(),
        parentPath: contextMenu?.item.path || undefined
      });
      
      await loadFileTreeInternal();
      showCreateFolderModal = false;
      newFolderName = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create folder';
    }
  }

  // Rename item
  function openRenameModal(item: FileTreeItem) {
    renamingItem = item;
    newItemName = item.name;
    showRenameModal = true;
    closeContextMenu();
  }

  async function renameItem() {
    if (!renamingItem || !newItemName.trim()) return;

    try {
      if (renamingItem.item_type === 'folder') {
        await invoke('rename_folder_filesystem', {
          oldPath: renamingItem.path,
          newName: newItemName.trim()
        });
      }
      // Note renaming would be handled differently - through the note editing interface
      
      await loadFileTreeInternal();
      showRenameModal = false;
      renamingItem = null;
      newItemName = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to rename item';
    }
  }

  // Delete item
  async function deleteItem(item: FileTreeItem) {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      if (item.item_type === 'folder') {
        await invoke('delete_folder_filesystem', { folderPath: item.path });
      } else {
        // Find the note ID and delete
        const notes = await invoke<Note[]>('load_notes_filesystem');
        const note = notes.find(n => n.title === item.name);
        if (note) {
          await invoke('delete_note_filesystem', { noteId: note.id });
          dispatch('deleteNote', { noteId: note.id });
        }
      }
      
      await loadFileTreeInternal();
      closeContextMenu();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete item';
    }
  }


  // Drag and drop handlers
  function handleDragStart(event: DragEvent, item: FileTreeItem) {
    if (item.item_type !== 'file') return;
    
    draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.name);
    }
  }

  function handleDragOver(event: DragEvent, item: FileTreeItem) {
    if (item.item_type !== 'folder' || !draggedItem || draggedItem.path === item.path) return;
    
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverFolder = item.path;
  }

  function handleDragLeave(event: DragEvent, item: FileTreeItem) {
    if (item.item_type !== 'folder') return;
    
    // Only clear if we're actually leaving this element (not entering a child)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dragOverFolder = null;
    }
  }

  async function handleDrop(event: DragEvent, targetItem?: FileTreeItem) {
    event.preventDefault();
    
    if (!draggedItem) return;
    
    try {
      // Find the note by name and move it
      const notes = await invoke<Note[]>('load_notes_filesystem');
      const note = notes.find(n => n.title === draggedItem?.name);
      
      if (note) {
        let targetPath: string[] = [];
        
        if (targetItem && targetItem.item_type === 'folder') {
          targetPath = targetItem.path.split('/').filter(p => p.length > 0);
        }
        // If no targetItem or targetItem is not a folder, move to root (empty path)
        
        await invoke('move_note_to_folder_filesystem', {
          noteId: note.id,
          newFolderPath: targetPath
        });
        
        dispatch('moveNote', { noteId: note.id, newFolderPath: targetPath });
        await loadFileTreeInternal();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to move note';
    } finally {
      draggedItem = null;
      dragOverFolder = null;
    }
  }

  function handleDragEnd() {
    draggedItem = null;
    dragOverFolder = null;
  }

  // Click outside handler
  function handleClickOutside(event: MouseEvent) {
    if (contextMenu && !(event.target as Element).closest('.context-menu')) {
      closeContextMenu();
    }
  }

  onMount(() => {
    loadFileTreeInternal();
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="h-full flex flex-col backdrop-blur-xs bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden">
  <!-- Header -->
  <div class="shrink-0 px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        {#if currentFolderPath.length > 0}
          <!-- Back button -->
          <button
            class="p-1.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 hover:scale-105"
            on:click={navigateBack}
            title="Back"
          >
            <Icon src={ChevronLeft} class="w-4 h-4" />
          </button>
        {/if}
        
        <div class="flex flex-col">
          <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">Notes Explorer</h3>
          {#if currentFolderPath.length > 0}
            <!-- Breadcrumb navigation -->
            <div class="flex items-center text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <button class="hover:text-zinc-700 dark:hover:text-zinc-300" on:click={() => { currentFolderPath = []; updateCurrentFolderItems(); }}>
                Root
              </button>
              {#each currentFolderPath as folder, index}
                <span class="mx-1">/</span>
                <button 
                  class="hover:text-zinc-700 dark:hover:text-zinc-300"
                  on:click={() => {
                    currentFolderPath = currentFolderPath.slice(0, index + 1);
                    updateCurrentFolderItems();
                  }}
                >
                  {folder}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          class="p-1.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 hover:scale-105"
          on:click={() => createNoteInFolder('')}
          title="New Note"
        >
          <Icon src={Plus} class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 hover:scale-105"
          on:click={() => openCreateFolderModal()}
          title="New Folder"
        >
          <Icon src={FolderPlus} class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  <!-- File Tree Content -->
  <div 
    class="flex-1 min-h-0 overflow-y-auto {draggedItem && dragOverFolder === null ? 'bg-blue-50 dark:bg-blue-900/10' : ''}"
    role="region"
    aria-label="File tree"
    on:dragover={(e) => {
      if (draggedItem) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        dragOverFolder = null; // Indicates root drop zone
      }
    }}
    on:drop={(e) => handleDrop(e)}
  >
    {#if loading}
      <div class="flex items-center justify-center py-8">
        <div class="w-8 h-8 rounded-full border-4 border-zinc-300 dark:border-zinc-700 border-t-transparent animate-spin"></div>
      </div>
    {:else if error}
      <div class="p-4 text-center text-red-600 dark:text-red-400">
        <p>{error}</p>
        <button 
          class="mt-2 px-3 py-1.5 text-sm rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          on:click={loadFileTreeInternal}
        >
          Retry
        </button>
      </div>
    {:else if fileTree.length === 0}
      <div class="p-4 text-center text-zinc-500 dark:text-zinc-400">
        <Icon src={FolderOpen} class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-sm">No notes found</p>
        <button 
          class="mt-2 px-3 py-1.5 text-sm rounded-lg accent-bg text-white hover:scale-105 transition-all duration-200"
          on:click={() => createNoteInFolder('')}
        >
          Create your first note
        </button>
      </div>
    {:else}
      <!-- Grid View -->
      <div class="p-6">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {#each currentFolderItems as item (item.id)}
            <div 
              class="flex flex-col items-center p-4 rounded-lg hover:bg-white/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-all duration-200 group {selectedNoteId === item.name && item.item_type === 'file' ? 'bg-white/80 dark:bg-zinc-800/60 border border-zinc-200/50 dark:border-zinc-700/50' : ''} {dragOverFolder === item.path ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600' : ''} {draggedItem?.path === item.path ? 'opacity-50' : ''}"
              role="button"
              tabindex="0"
              draggable={item.item_type === 'file'}
              on:click={() => handleItemSelect(item)}
              on:contextmenu={(e) => handleContextMenu(e, item)}
              on:keydown={(e) => e.key === 'Enter' && handleItemSelect(item)}
              on:dragstart={(e) => handleDragStart(e, item)}
              on:dragover={(e) => handleDragOver(e, item)}
              on:dragleave={(e) => handleDragLeave(e, item)}
              on:drop={(e) => handleDrop(e, item)}
              on:dragend={handleDragEnd}
              in:fly={{ y: 20, duration: 300, delay: Math.min(currentFolderItems.indexOf(item) * 30, 200), easing: quintOut }}
            >
              <!-- Large Icon -->
              <div class="relative mb-2">
                <Icon 
                  src={item.item_type === 'folder' ? FolderOpen : Document} 
                  class="w-12 h-12 {item.item_type === 'folder' ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}" 
                />
              </div>

              <!-- Item name -->
              <span class="text-xs text-zinc-900 dark:text-white text-center truncate w-full">
                {item.name}
              </span>

              <!-- Context menu button -->
              <div
                class="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-zinc-800/90 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all duration-200 cursor-pointer"
                role="button"
                tabindex="0"
                on:click|stopPropagation={(e) => handleContextMenu(e, item)}
                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    const mouseEvent = new MouseEvent('contextmenu', {
                      clientX: e.currentTarget.getBoundingClientRect().left,
                      clientY: e.currentTarget.getBoundingClientRect().top
                    });
                    handleContextMenu(mouseEvent, item);
                  }
                }}
              >
                <Icon src={EllipsisVertical} class="w-3 h-3" />
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Context Menu -->
{#if contextMenu}
  <div 
    class="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-40 context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    in:fly={{ y: -10, duration: 200, easing: quintOut }}
  >
    {#if contextMenu?.item.item_type === 'folder'}
      <button
        class="w-full px-3 py-2 text-left text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
        on:click={() => contextMenu && createNoteInFolder(contextMenu.item.path)}
      >
        <Icon src={Plus} class="w-4 h-4" />
        New Note Here
      </button>
      <button
        class="w-full px-3 py-2 text-left text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
        on:click={() => contextMenu && openCreateFolderModal(contextMenu.item.path)}
      >
        <Icon src={FolderPlus} class="w-4 h-4" />
        New Subfolder
      </button>
      <div class="border-t border-zinc-200 dark:border-zinc-700 my-1"></div>
      <button
        class="w-full px-3 py-2 text-left text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
        on:click={() => contextMenu && openRenameModal(contextMenu.item)}
      >
        <Icon src={PencilSquare} class="w-4 h-4" />
        Rename
      </button>
      <button
        class="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
        on:click={() => contextMenu && deleteItem(contextMenu.item)}
      >
        <Icon src={Trash} class="w-4 h-4" />
        Delete
      </button>
    {:else}
      <button
        class="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
        on:click={() => contextMenu && deleteItem(contextMenu.item)}
      >
        <Icon src={Trash} class="w-4 h-4" />
        Delete Note
      </button>
    {/if}
  </div>
{/if}

<!-- Create Folder Modal -->
{#if showCreateFolderModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" in:fly={{ y: 20, duration: 300, easing: quintOut }}>
    <div class="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Create New Folder</h3>
      <input
        type="text"
        bind:value={newFolderName}
        placeholder="Folder name"
        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 accent-ring"
        on:keydown={(e) => e.key === 'Enter' && createFolder()}
      />
      <div class="flex items-center justify-end gap-3 mt-6">
        <button
          class="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          on:click={() => { showCreateFolderModal = false; newFolderName = ''; }}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg accent-bg text-white hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!newFolderName.trim()}
          on:click={createFolder}
        >
          Create
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Rename Modal -->
{#if showRenameModal && renamingItem}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" in:fly={{ y: 20, duration: 300, easing: quintOut }}>
    <div class="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Rename {renamingItem.item_type === 'folder' ? 'Folder' : 'Note'}</h3>
      <input
        type="text"
        bind:value={newItemName}
        placeholder={renamingItem.item_type === 'folder' ? 'Folder name' : 'Note name'}
        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 accent-ring"
        on:keydown={(e) => e.key === 'Enter' && renameItem()}
      />
      <div class="flex items-center justify-end gap-3 mt-6">
        <button
          class="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          on:click={() => { showRenameModal = false; renamingItem = null; newItemName = ''; }}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 text-sm rounded-lg accent-bg text-white hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!newItemName.trim()}
          on:click={renameItem}
        >
          Rename
        </button>
      </div>
    </div>
  </div>
{/if}
