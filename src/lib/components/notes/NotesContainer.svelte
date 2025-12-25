<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { quintOut, cubicInOut } from 'svelte/easing';
  import { Icon, ChevronLeft, ChevronRight, MagnifyingGlass, Plus, FolderOpen } from 'svelte-hero-icons';
  import NotesFileExplorer from './NotesFileExplorer.svelte';
  import TipTapNotesEditor from './TipTapNotesEditor.svelte';
  import { NotesService } from '../../services/notesService';
  import { invoke } from '@tauri-apps/api/core';
  import type { Note } from './types/editor';

  // State
  let selectedNote: Note | null = null;
  let notesFileExplorer: NotesFileExplorer;
  let loading = false;
  let error: string | null = null;
  let isSaving = false;
  let titleUpdateTimeout: number | null = null;
  let searchQuery = '';
  let currentView: 'browser' | 'editor' = 'browser'; // New state for main view

  // Handle note selection from sidebar
  async function handleNoteSelect(event: CustomEvent<{ note: Note }>) {
    const note = event.detail.note;
    
    try {
      // Update last accessed time
      const now = new Date().toISOString();
      const updatedNote = { ...note, last_accessed: now };
      await NotesService.saveNote(updatedNote);
      
      selectedNote = updatedNote;
      currentView = 'editor'; // Switch to editor view
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load note';
      console.error('Failed to load note:', e);
    }
  }

  // Handle creating new note
  async function handleCreateNote(folderPath: string[] = []) {
    try {
      loading = true;
      error = null;
      
      const newNote = await NotesService.createNote(folderPath);
      selectedNote = newNote;
      currentView = 'editor'; // Switch to editor view
      
      // Refresh the file explorer
      if (notesFileExplorer) {
        await notesFileExplorer.loadFileTree();
      }
      
      const { toastStore } = await import('../../stores/toast');
      toastStore.success('Note created successfully');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create note';
      console.error('Failed to create note:', e);
      const { toastStore } = await import('../../stores/toast');
      toastStore.error('Failed to create note');
    } finally {
      loading = false;
    }
  }

  // Handle file explorer events
  async function handleFileExplorerCreateNote(event: CustomEvent<{ folderPath: string[] }>) {
    await handleCreateNote(event.detail.folderPath);
  }

  async function handleFileExplorerDeleteNote(event: CustomEvent<{ noteId: string }>) {
    const deletedNoteId = event.detail.noteId;
    
    // If the deleted note was selected, clear selection
    if (selectedNote && selectedNote.id === deletedNoteId) {
      selectedNote = null;
    }

    // Refresh both views
    // Note: No longer using notes list
    if (notesFileExplorer) {
      await notesFileExplorer.loadFileTree();
    }
  }

  // Handle folder operations
  async function handleFolderOperations() {
    // Refresh file explorer after folder operations
    if (notesFileExplorer) {
      await notesFileExplorer.loadFileTree();
    }
  }

  // Handle note deletion
  function handleNoteDelete(event: CustomEvent<{ noteId: string }>) {
    const deletedNoteId = event.detail.noteId;
    
    // If the deleted note was selected, clear selection
    if (selectedNote && selectedNote.id === deletedNoteId) {
      selectedNote = null;
    }
  }

  // Handle content changes with auto-save
  function handleContentChange(event: CustomEvent<{ content: string }>) {
    if (!selectedNote) return;

    const content = event.detail.content;
    
    // Calculate word count from HTML content
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    
    // Update local note data immediately for UI responsiveness
    selectedNote = {
      ...selectedNote,
      content,
      updated_at: new Date().toISOString(),
      metadata: {
        ...selectedNote.metadata,
        word_count: wordCount,
        character_count: textContent.length,
        reading_time: Math.ceil(wordCount / 200),
        version: selectedNote.metadata.version + 1
      }
    };

    // Schedule auto-save, but avoid list refresh on every keystroke
    NotesService.scheduleAutoSave(selectedNote.id, content);
  }

  // Handle manual save
  async function handleSave(event: CustomEvent<{ content: string }>) {
    if (!selectedNote) return;

    try {
      isSaving = true;
      error = null;
      
      await NotesService.updateNoteContent(selectedNote.id, event.detail.content);
      
      // Refresh the file explorer to show updated metadata
      if (notesFileExplorer) {
        await notesFileExplorer.loadFileTree();
      }
      
      const { toastStore } = await import('../../stores/toast');
      toastStore.success('Note saved successfully');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save note';
      console.error('Failed to save note:', e);
      const { toastStore } = await import('../../stores/toast');
      toastStore.error('Failed to save note');
    } finally {
      isSaving = false;
    }
  }

  // Handle title changes (when user edits the first heading or paragraph)
  async function updateNoteTitle(newTitle: string) {
    if (!selectedNote || selectedNote.title === newTitle) return;

    try {
      // Update the local note object immediately
      selectedNote = { ...selectedNote, title: newTitle, updated_at: new Date().toISOString() };
      
      // Save the updated note (the backend will handle cleaning up the old file)
      await NotesService.saveNote(selectedNote);
      
      // Refresh file explorer to show new title
      if (notesFileExplorer) {
        await notesFileExplorer.loadFileTree();
      }
    } catch (e) {
      console.error('Failed to update note title:', e);
    }
  }

  // Auto-extract title from content
  function extractTitleFromContent(content: string): string {
    // Extract text from HTML content
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    if (!textContent) {
      return 'Untitled Note';
    }
    
    // Take first line or first 50 characters
    const firstLine = textContent.split('\n')[0].trim();
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  }

  // Watch for content changes to auto-update title
  $: if (selectedNote && selectedNote.content) {
    const extractedTitle = extractTitleFromContent(selectedNote.content);
    if (extractedTitle !== 'Untitled Note' && extractedTitle !== selectedNote.title) {
      // Debounce title updates to avoid frequent saves while typing
      if (titleUpdateTimeout) clearTimeout(titleUpdateTimeout);
      titleUpdateTimeout = setTimeout(() => {
        updateNoteTitle(extractedTitle);
      }, 600);
    }
  }

  // Go back to browser view
  function goBackToBrowser() {
    currentView = 'browser';
    selectedNote = null;
  }

  // Handle create folder from top bar
  function handleCreateFolderFromTopBar() {
    if (notesFileExplorer) {
      // Trigger the file explorer's create folder functionality
      notesFileExplorer.openCreateFolderModal();
    }
  }

  onMount(async () => {
    // Component initialization
  });
</script>

<div class="h-full flex flex-col min-h-0">
  {#if currentView === 'browser'}
    <!-- Browser View Header -->
    <div class="shrink-0 backdrop-blur-xs bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden mb-6" 
         in:fly={{ y: -20, duration: 300, easing: quintOut }}>
      <div class="px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <!-- Left side: Title and Create Buttons -->
          <div class="flex items-center gap-4">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
              Notes
            </h2>
            <button class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring text-sm font-medium" on:click={() => handleCreateNote()}>
              <Icon src={Plus} class="w-4 h-4 inline mr-1" />
              New Note
            </button>
            <button class="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-400 text-sm font-medium" on:click={handleCreateFolderFromTopBar}>
              <Icon src={FolderOpen} class="w-4 h-4 inline mr-1" />
              New Folder
            </button>
          </div>
          
          <!-- Right side: Search and View Toggle -->
          <div class="flex items-center gap-3">
            <!-- Search -->
            <div class="relative">
              <input 
                class="w-64 pl-9 pr-3 py-2 rounded-lg bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:ring-2 accent-ring text-sm transition-all duration-200 hover:bg-white/90 dark:hover:bg-zinc-800/90" 
                placeholder="Search notes..." 
                bind:value={searchQuery} 
              />
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <Icon src={MagnifyingGlass} class="w-4 h-4" />
              </span>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Editor View Header -->
    <div class="shrink-0 backdrop-blur-xs bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden mb-6" 
         in:fly={{ y: -20, duration: 300, easing: quintOut }}>
      <div class="px-6 py-4 bg-white/50 dark:bg-zinc-900/30">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <!-- Left side: Back button and Note title -->
          <div class="flex items-center gap-4">
            <button 
              class="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-400"
              on:click={goBackToBrowser}
            >
              <Icon src={ChevronLeft} class="w-4 h-4" />
            </button>
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
              {selectedNote?.title || 'Untitled Note'}
            </h2>
          </div>
          
          <!-- Right side: Note metadata and status -->
          <div class="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            {#if selectedNote}
              <span>{selectedNote.metadata.word_count} words</span>
              <span>•</span>
              <span>{selectedNote.metadata.character_count} characters</span>
              <span>•</span>
              <span>{selectedNote.metadata.reading_time} min read</span>
              <span>•</span>
              <span>Last updated {new Date(selectedNote.updated_at).toLocaleDateString()}</span>
            {/if}
            
            {#if error}
              <span class="text-red-500 dark:text-red-400">{error}</span>
            {/if}
            
            {#if isSaving}
              <span class="text-zinc-500 dark:text-zinc-400">Saving...</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 min-h-0">
    {#if currentView === 'browser'}
      <!-- Browser View: Fullscreen File Explorer -->
      <div class="h-full backdrop-blur-xs bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden">
        <NotesFileExplorer
          bind:this={notesFileExplorer}
          selectedNoteId={selectedNote?.id}
          on:selectNote={handleNoteSelect}
          on:createNote={handleFileExplorerCreateNote}
          on:deleteNote={handleFileExplorerDeleteNote}
          on:createFolder={handleFolderOperations}
          on:deleteFolder={handleFolderOperations}
          on:renameFolder={handleFolderOperations}
          on:moveNote={handleFolderOperations}
        />
      </div>
    {:else}
      <!-- Editor View: Fullscreen Editor -->
      <div class="h-full backdrop-blur-xs bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl overflow-hidden flex flex-col"
           in:fly={{ x: 50, duration: 400, easing: quintOut }}>
        
        {#if loading}
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="w-8 h-8 rounded-full border-4 border-zinc-300 dark:border-zinc-700 border-t-transparent animate-spin mx-auto mb-4"></div>
              <p class="text-zinc-600 dark:text-zinc-300">Loading note...</p>
            </div>
          </div>
        {:else if selectedNote}
          <!-- Editor -->
          <div class="flex-1 min-h-0">
            <TipTapNotesEditor
              content={selectedNote.content}
              noteId={selectedNote.id}
              placeholder="Start writing your note..."
              autofocus={true}
              on:change={handleContentChange}
              on:save={handleSave}
            />
          </div>
        {:else}
          <!-- Empty State -->
          <div class="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <Icon src={FolderOpen} class="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
              <h3 class="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                No note selected
              </h3>
              <p class="text-zinc-500 dark:text-zinc-400 mb-4">
                Go back to the browser to select a note
              </p>
              <button 
                class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95"
                on:click={goBackToBrowser}
              >
                Back to Browser
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
