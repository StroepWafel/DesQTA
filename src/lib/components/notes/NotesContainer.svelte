<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import NotesList from './NotesList.svelte';
  import NotesEditor from './NotesEditor.svelte';
  import { NotesService } from '../../services/notesService';
  import type { Note, EditorDocument } from './types/editor';

  // State
  let selectedNote: Note | null = null;
  let notesList: NotesList;
  let loading = false;
  let error: string | null = null;
  let isSaving = false;

  // Handle note selection from sidebar
  async function handleNoteSelect(event: CustomEvent<{ note: Note }>) {
    const note = event.detail.note;
    
    try {
      // Update last accessed time
      const now = new Date().toISOString();
      const updatedNote = { ...note, last_accessed: now };
      await NotesService.saveNote(updatedNote);
      
      selectedNote = updatedNote;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load note';
      console.error('Failed to load note:', e);
    }
  }

  // Handle creating new note
  async function handleCreateNote() {
    try {
      loading = true;
      error = null;
      
      const newNote = await NotesService.createNote();
      selectedNote = newNote;
      
      // Refresh the notes list to show the new note
      if (notesList) {
        await notesList.refreshNotes();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create note';
      console.error('Failed to create note:', e);
    } finally {
      loading = false;
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
  function handleContentChange(event: CustomEvent<{ content: EditorDocument }>) {
    if (!selectedNote) return;

    const content = event.detail.content;
    
    // Update local note data immediately for UI responsiveness
    selectedNote = {
      ...selectedNote,
      content,
      updated_at: new Date().toISOString(),
      metadata: {
        ...selectedNote.metadata,
        word_count: content.metadata.word_count,
        character_count: content.metadata.character_count,
        reading_time: Math.ceil(content.metadata.word_count / 200),
        version: selectedNote.metadata.version + 1
      }
    };

    // Schedule auto-save
    NotesService.scheduleAutoSave(selectedNote.id, content);
  }

  // Handle manual save
  async function handleSave(event: CustomEvent<{ content: EditorDocument }>) {
    if (!selectedNote) return;

    try {
      isSaving = true;
      error = null;
      
      await NotesService.updateNoteContent(selectedNote.id, event.detail.content);
      
      // Refresh the notes list to show updated metadata
      if (notesList) {
        await notesList.refreshNotes();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save note';
      console.error('Failed to save note:', e);
    } finally {
      isSaving = false;
    }
  }

  // Handle title changes (when user edits the first heading or paragraph)
  async function updateNoteTitle(newTitle: string) {
    if (!selectedNote || selectedNote.title === newTitle) return;

    try {
      const updatedNote = { ...selectedNote, title: newTitle, updated_at: new Date().toISOString() };
      await NotesService.saveNote(updatedNote);
      selectedNote = updatedNote;
      
      // Refresh notes list to show new title
      if (notesList) {
        await notesList.refreshNotes();
      }
    } catch (e) {
      console.error('Failed to update note title:', e);
    }
  }

  // Auto-extract title from content
  function extractTitleFromContent(content: EditorDocument): string {
    // Find the first non-empty text node
    for (const node of content.nodes) {
      if (node.text && node.text.trim()) {
        // Take first line or first 50 characters
        const firstLine = node.text.split('\n')[0].trim();
        return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
      }
    }
    return 'Untitled Note';
  }

  // Watch for content changes to auto-update title
  $: if (selectedNote && selectedNote.content) {
    const extractedTitle = extractTitleFromContent(selectedNote.content);
    if (extractedTitle !== 'Untitled Note' && extractedTitle !== selectedNote.title) {
      updateNoteTitle(extractedTitle);
    }
  }
</script>

<div class="notes-container h-full flex bg-white dark:bg-slate-800 min-h-0">
  <!-- Left Sidebar: Notes List -->
  <div class="w-80 flex-shrink-0">
    <NotesList
      bind:this={notesList}
      selectedNoteId={selectedNote?.id}
      on:selectNote={handleNoteSelect}
      on:createNote={handleCreateNote}
      on:deleteNote={handleNoteDelete}
    />
  </div>

  <!-- Right Side: Editor or Empty State -->
  <div class="flex-1 flex flex-col min-h-0">
    {#if loading}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="w-8 h-8 rounded-full border-4 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin mx-auto mb-4"></div>
          <p class="text-slate-600 dark:text-slate-300">Loading note...</p>
        </div>
      </div>
    {:else if selectedNote}
      <div class="flex-1 flex flex-col" in:fly={{ x: 50, duration: 400, easing: quintOut }}>
        <!-- Note Header -->
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-semibold text-slate-900 dark:text-white truncate">
                {selectedNote.title || 'Untitled Note'}
              </h1>
              <div class="mt-1 flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                <span>{selectedNote.metadata.word_count} words</span>
                <span>•</span>
                <span>{selectedNote.metadata.character_count} characters</span>
                <span>•</span>
                <span>{selectedNote.metadata.reading_time} min read</span>
                <span>•</span>
                <span>Last updated {new Date(selectedNote.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div class="flex items-center space-x-2">
              {#if error}
                <span class="text-sm text-red-500 dark:text-red-400">{error}</span>
              {/if}
              
              {#if isSaving}
                <span class="text-sm text-slate-500 dark:text-slate-400">Saving...</span>
              {/if}
            </div>
          </div>
        </div>

        <!-- Editor -->
        <div class="flex-1 min-h-0">
          <NotesEditor
            content={selectedNote.content}
            noteId={selectedNote.id}
            placeholder="Start writing your note..."
            autofocus={true}
            on:change={handleContentChange}
            on:save={handleSave}
          />
        </div>
      </div>
    {:else}
      <!-- Empty State -->
      <div class="flex-1 flex items-center justify-center" in:fly={{ y: 30, duration: 400, easing: quintOut }}>
        <div class="text-center max-w-md mx-auto px-6">
          <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No Note Selected</h3>
          <p class="text-slate-600 dark:text-slate-400 mb-6">
            Select a note from the sidebar to start editing, or create a new note to get started.
          </p>
          <button
            class="px-6 py-3 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
            on:click={handleCreateNote}
          >
            Create New Note
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .notes-container {
    height: 100%;
  }
</style> 