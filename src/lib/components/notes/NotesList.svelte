<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Icon, MagnifyingGlass, Plus, FolderOpen, Calendar, Clock, Tag } from 'svelte-hero-icons';
  import { fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { NotesService } from '../../services/notesService';
  import type { Note, NoteFolder } from './types/editor';

  // Events
  const dispatch = createEventDispatcher<{
    selectNote: { note: Note };
    createNote: void;
    deleteNote: { noteId: string };
  }>();

  // Props
  export let selectedNoteId: string | null = null;

  // State
  let notes: Note[] = [];
  let folders: NoteFolder[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = '';
  let selectedFolder = 'all';

  // Reactive filtered notes
  $: filteredNotes = notes
    .filter(note => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(query);
        const matchesTags = note.tags.some(tag => tag.toLowerCase().includes(query));
        const matchesContent = note.content.nodes.some(node => 
          node.text?.toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesTags && !matchesContent) return false;
      }

      // Folder filter
      if (selectedFolder !== 'all') {
        if (!note.folder_path.includes(selectedFolder)) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Load data
  async function loadNotes() {
    try {
      loading = true;
      error = null;
      
      const [notesData, foldersData] = await Promise.all([
        NotesService.loadNotes(),
        NotesService.loadFolders()
      ]);
      
      notes = notesData;
      folders = foldersData;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load notes';
      console.error('Failed to load notes:', e);
    } finally {
      loading = false;
    }
  }

  // Refresh notes list
  export async function refreshNotes() {
    await loadNotes();
  }

  // Handle note selection
  function selectNote(note: Note) {
    dispatch('selectNote', { note });
  }

  // Handle note creation
  function createNewNote() {
    dispatch('createNote');
  }

  // Handle note deletion
  async function deleteNote(noteId: string, event: Event) {
    event.stopPropagation();
    
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await NotesService.deleteNote(noteId);
        await loadNotes(); // Refresh the list
        dispatch('deleteNote', { noteId });
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to delete note';
      }
    }
  }

  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  // Get preview text from note content
  function getPreviewText(note: Note): string {
    const textNodes = note.content.nodes
      .filter(node => node.text && node.text.trim())
      .map(node => node.text)
      .join(' ');
    
    return textNodes.length > 100 ? textNodes.substring(0, 100) + '...' : textNodes;
  }

  // Get folder name by ID
  function getFolderName(folderId: string): string {
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : 'Unknown Folder';
  }

  onMount(() => {
    loadNotes();
  });
</script>

<div class="notes-list h-full flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-h-0">
  <!-- Header -->
  <div class="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Notes</h2>
      <button
        class="p-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
        on:click={createNewNote}
        title="Create new note"
        aria-label="Create new note"
      >
        <Icon src={Plus} class="w-4 h-4" />
      </button>
    </div>

    <!-- Search -->
    <div class="relative">
      <input
        type="text"
        placeholder="Search notes..."
        class="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring"
        bind:value={searchQuery}
      />
      <Icon src={MagnifyingGlass} class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    </div>

    <!-- Folder Filter -->
    <div class="mt-3">
      <select
        class="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring"
        bind:value={selectedFolder}
      >
        <option value="all">All Notes</option>
        {#each folders as folder}
          <option value={folder.id}>{folder.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Notes List -->
  <div class="flex-1 min-h-0 overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center p-8">
        <div class="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin"></div>
        <span class="ml-2 text-sm text-slate-500 dark:text-slate-400">Loading...</span>
      </div>
    {:else if error}
      <div class="p-4 text-center">
        <p class="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          class="mt-2 px-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring"
          on:click={loadNotes}
        >
          Retry
        </button>
      </div>
    {:else if filteredNotes.length === 0}
      <div class="p-4 text-center">
        {#if searchQuery || selectedFolder !== 'all'}
          <p class="text-sm text-slate-500 dark:text-slate-400">No notes match your filters.</p>
          <button
            class="mt-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            on:click={() => { searchQuery = ''; selectedFolder = 'all'; }}
          >
            Clear filters
          </button>
        {:else}
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">No notes yet.</p>
          <button
            class="px-4 py-2 text-sm rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
            on:click={createNewNote}
          >
            Create your first note
          </button>
        {/if}
      </div>
    {:else}
      <div class="space-y-1 p-2">
        {#each filteredNotes as note (note.id)}
          <div
            class="note-item p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700 {selectedNoteId === note.id ? 'accent-bg text-white' : 'text-slate-900 dark:text-white'}"
            on:click={() => selectNote(note)}
            on:keydown={(e) => e.key === 'Enter' && selectNote(note)}
            role="button"
            tabindex="0"
            in:fly={{ y: 20, duration: 300, easing: quintOut }}
          >
            <!-- Note Header -->
            <div class="flex items-start justify-between mb-2">
              <h3 class="font-medium text-sm line-clamp-1 flex-1 pr-2">
                {note.title || 'Untitled Note'}
              </h3>
              <button
                class="opacity-0 group-hover:opacity-100 p-1 rounded text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all duration-200"
                on:click={(e) => deleteNote(note.id, e)}
                title="Delete note"
                aria-label="Delete note"
              >
                ×
              </button>
            </div>

            <!-- Note Preview -->
            <p class="text-xs {selectedNoteId === note.id ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'} line-clamp-2 mb-2">
              {getPreviewText(note)}
            </p>

            <!-- Note Meta -->
            <div class="flex items-center justify-between text-xs {selectedNoteId === note.id ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}">
              <div class="flex items-center space-x-2">
                {#if note.folder_path.length > 0 && note.folder_path[0] !== 'default'}
                  <span class="inline-flex items-center">
                    <Icon src={FolderOpen} class="w-3 h-3 mr-1" />
                    {getFolderName(note.folder_path[0])}
                  </span>
                {/if}
                
                {#if note.tags.length > 0}
                  <span class="inline-flex items-center">
                    <Icon src={Tag} class="w-3 h-3 mr-1" />
                    {note.tags.length}
                  </span>
                {/if}
              </div>
              
              <div class="flex items-center space-x-2">
                <span>{note.metadata.word_count} words</span>
                <span>•</span>
                <span>{formatDate(note.updated_at)}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Footer Stats -->
  <div class="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
    <div class="text-xs text-slate-500 dark:text-slate-400 text-center">
      {filteredNotes.length} of {notes.length} notes
      {#if notes.length > 0}
        • {notes.reduce((sum, note) => sum + note.metadata.word_count, 0)} total words
      {/if}
    </div>
  </div>
</div>

<style>
  .note-item:hover .opacity-0 {
    opacity: 1;
  }

  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style> 