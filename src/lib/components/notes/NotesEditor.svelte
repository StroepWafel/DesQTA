<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { EditorCore } from './utils/editorCore';
  import EditorToolbar from './EditorToolbar.svelte';
  import EditorStatusBar from './EditorStatusBar.svelte';
  import type { EditorDocument, EditorNode } from './types/editor';

  // Props
  export let content: EditorDocument = { version: '1.0', nodes: [], metadata: { word_count: 0, character_count: 0, seqta_references: [] } };
  export let placeholder: string = 'Start writing your note...';
  export let readonly: boolean = false;
  export let autofocus: boolean = false;
  export let noteId: string | undefined = undefined; // Add noteId to track note changes

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    change: { content: EditorDocument };
    save: { content: EditorDocument };
    focus: void;
    blur: void;
  }>();

  // Editor elements
  let editorContainer: HTMLElement;
  let contentElement: HTMLElement;
  let editorCore: EditorCore;

  // Editor state
  let isFocused = false;
  let wordCount = 0;
  let characterCount = 0;
  let lastNoteId: string | undefined = undefined;

  onMount(() => {
    // Initialize the editor core
    editorCore = new EditorCore(contentElement, {
      placeholder,
      readonly,
      onChange: handleContentChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
    });

    // Load initial content
    if (content && content.nodes.length > 0) {
      editorCore.setContent(content);
      wordCount = content.metadata.word_count;
      characterCount = content.metadata.character_count;
      lastNoteId = noteId;
    }

    // Auto focus if requested
    if (autofocus && !readonly) {
      setTimeout(() => editorCore.focus(), 100);
    }

    return () => {
      editorCore?.destroy();
    };
  });

  // React to content changes from parent component (when switching notes)
  $: if (editorCore && content && noteId !== lastNoteId) {
    // Update editor content when switching to a different note
    editorCore.setContent(content);
    wordCount = content.metadata.word_count;
    characterCount = content.metadata.character_count;
    lastNoteId = noteId;
  }

  function handleContentChange(newContent: EditorDocument) {
    content = newContent;
    wordCount = newContent.metadata.word_count;
    characterCount = newContent.metadata.character_count;
    dispatch('change', { content: newContent });
  }

  function handleFocus() {
    isFocused = true;
    dispatch('focus');
  }

  function handleBlur() {
    isFocused = false;
    dispatch('blur');
  }

  function handleSave() {
    dispatch('save', { content });
  }

  // Expose methods for parent components
  export function focus() {
    editorCore?.focus();
  }

  export function blur() {
    editorCore?.blur();
  }

  export function getContent(): EditorDocument {
    return editorCore?.getContent() || content;
  }

  export function setContent(newContent: EditorDocument) {
    editorCore?.setContent(newContent);
  }

  export function insertText(text: string) {
    editorCore?.insertText(text);
  }

  export function executeCommand(command: string, value?: any) {
    editorCore?.executeCommand(command, value);
  }
</script>

<div 
  class="notes-editor h-full flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md transition-all duration-200 {isFocused ? 'accent-ring' : ''}"
  bind:this={editorContainer}
>
  <!-- Editor Toolbar -->
  <div class="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
    <EditorToolbar 
      bind:editor={editorCore}
      {readonly}
      on:save={handleSave}
    />
  </div>

  <!-- Main Editor Content -->
  <div class="flex-1 relative min-h-0">
    <div
      class="editor-content h-full p-4 prose prose-slate dark:prose-invert max-w-none focus:outline-none overflow-y-auto"
      contenteditable={!readonly}
      bind:this={contentElement}
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline="true"
      aria-label="Rich text editor"
      tabindex={readonly ? -1 : 0}
    ></div>
  </div>

  <!-- Editor Status Bar -->
  <div class="flex-shrink-0 border-t border-slate-200 dark:border-slate-700">
    <EditorStatusBar 
      {wordCount}
      {characterCount}
      {isFocused}
    />
  </div>
</div>

<style>
  .notes-editor {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .editor-content {
    line-height: 1.6;
    color: inherit;
  }

  .editor-content:empty::before {
    content: attr(data-placeholder);
    color: rgb(148 163 184); /* slate-400 */
    font-style: italic;
    pointer-events: none;
  }

  .editor-content:focus::before {
    display: none;
  }

  /* Custom prose styling for dark mode */
  .editor-content.prose-invert {
    color: rgb(241 245 249); /* slate-100 */
  }

  .editor-content.prose-invert strong {
    color: rgb(241 245 249);
  }

  .editor-content.prose-invert em {
    color: rgb(241 245 249);
  }

  .editor-content.prose-invert h1,
  .editor-content.prose-invert h2,
  .editor-content.prose-invert h3,
  .editor-content.prose-invert h4,
  .editor-content.prose-invert h5,
  .editor-content.prose-invert h6 {
    color: rgb(241 245 249);
  }

  /* Focus ring using accent color */
  .notes-editor.accent-ring {
    box-shadow: 0 0 0 2px var(--accent-color-value);
  }

  /* Ensure proper spacing and styling */
  .editor-content p {
    margin: 0.75rem 0;
  }

  .editor-content p:first-child {
    margin-top: 0;
  }

  .editor-content p:last-child {
    margin-bottom: 0;
  }

  .editor-content h1,
  .editor-content h2,
  .editor-content h3,
  .editor-content h4,
  .editor-content h5,
  .editor-content h6 {
    margin: 1.5rem 0 0.75rem 0;
    font-weight: 600;
  }

  .editor-content h1:first-child,
  .editor-content h2:first-child,
  .editor-content h3:first-child,
  .editor-content h4:first-child,
  .editor-content h5:first-child,
  .editor-content h6:first-child {
    margin-top: 0;
  }
</style> 