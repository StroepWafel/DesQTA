<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Icon } from 'svelte-hero-icons';
  import { 
    Bold, 
    Italic, 
    Underline, 
    Strikethrough,
    CodeBracket,
    H1,
    H2,
    H3,
    ListBullet,
    NumberedList,
    ChatBubbleLeftRight,
    Link,
    Photo,
    ArrowDownTray
  } from 'svelte-hero-icons';
  import type { EditorCore } from './utils/editorCore';

  // Props
  export let editor: EditorCore | undefined = undefined;
  export let readonly: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    save: void;
  }>();

  // Toolbar state
  let activeFormats = new Set<string>();
  let currentBlockType = 'paragraph';

  // Update active states when selection changes
  function updateToolbarState() {
    if (!editor) return;

    // Update active formats using editor's method
    activeFormats = editor.getActiveFormats();
    
    // Update current block type
    currentBlockType = editor.getCurrentBlockType();
  }

  // Format commands
  function toggleBold() {
    if (!editor || readonly) return;
    editor.executeCommand('bold');
    updateToolbarState();
  }

  function toggleItalic() {
    if (!editor || readonly) return;
    editor.executeCommand('italic');
    updateToolbarState();
  }

  function toggleUnderline() {
    if (!editor || readonly) return;
    editor.executeCommand('underline');
    updateToolbarState();
  }

  function toggleStrikethrough() {
    if (!editor || readonly) return;
    editor.executeCommand('strikethrough');
    updateToolbarState();
  }

  function toggleCode() {
    if (!editor || readonly) return;
    editor.executeCommand('code');
    updateToolbarState();
  }

  // Block type commands
  function setHeading(level: number) {
    if (!editor || readonly) return;
    editor.executeCommand(`heading-${level}`);
    currentBlockType = `heading-${level}`;
  }

  function setParagraph() {
    if (!editor || readonly) return;
    editor.executeCommand('paragraph');
    currentBlockType = 'paragraph';
  }

  function setBlockquote() {
    if (!editor || readonly) return;
    editor.executeCommand('blockquote');
    currentBlockType = 'blockquote';
  }

  // List commands
  function toggleBulletList() {
    if (!editor || readonly) return;
    editor.executeCommand('bullet-list');
    updateToolbarState();
  }

  function toggleNumberList() {
    if (!editor || readonly) return;
    editor.executeCommand('numbered-list');
    updateToolbarState();
  }

  // Media commands (placeholder for now)
  function insertLink() {
    if (!editor || readonly) return;
    // TODO: Implement link insertion
  }

  function insertImage() {
    if (!editor || readonly) return;
    // TODO: Implement image insertion
  }

  function handleSave() {
    dispatch('save');
  }

  // Listen for selection changes to update toolbar state
  $: if (editor) {
    // This will be called when the editor instance changes
    updateToolbarState();
    
    // Listen for selection changes
    const handleSelectionChange = () => {
      // Small delay to ensure DOM is updated
      setTimeout(updateToolbarState, 10);
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Cleanup function would go here in a real implementation
    // For now, we'll rely on component lifecycle
  }
</script>

<div class="editor-toolbar flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50">
  <!-- Left side: Formatting controls -->
  <div class="flex items-center space-x-1">
    <!-- Text formatting group -->
    <div class="flex items-center space-x-1 border-r border-slate-200 dark:border-slate-700 pr-2 mr-2">
      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {activeFormats.has('bold') ? 'accent-bg text-white' : ''}"
        on:click={toggleBold}
        disabled={readonly}
        title="Bold (Ctrl+B)"
        aria-label="Toggle bold formatting"
      >
        <Icon src={Bold} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {activeFormats.has('italic') ? 'accent-bg text-white' : ''}"
        on:click={toggleItalic}
        disabled={readonly}
        title="Italic (Ctrl+I)"
        aria-label="Toggle italic formatting"
      >
        <Icon src={Italic} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {activeFormats.has('underline') ? 'accent-bg text-white' : ''}"
        on:click={toggleUnderline}
        disabled={readonly}
        title="Underline (Ctrl+U)"
        aria-label="Toggle underline formatting"
      >
        <Icon src={Underline} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {activeFormats.has('strikethrough') ? 'accent-bg text-white' : ''}"
        on:click={toggleStrikethrough}
        disabled={readonly}
        title="Strikethrough"
        aria-label="Toggle strikethrough formatting"
      >
        <Icon src={Strikethrough} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {activeFormats.has('code') ? 'accent-bg text-white' : ''}"
        on:click={toggleCode}
        disabled={readonly}
        title="Inline code"
        aria-label="Toggle inline code formatting"
      >
        <Icon src={CodeBracket} class="w-4 h-4" />
      </button>
    </div>

    <!-- Block formatting group -->
    <div class="flex items-center space-x-1 border-r border-slate-200 dark:border-slate-700 pr-2 mr-2">
      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {currentBlockType === 'heading-1' ? 'accent-bg text-white' : ''}"
        on:click={() => setHeading(1)}
        disabled={readonly}
        title="Heading 1"
        aria-label="Convert to heading 1"
      >
        <Icon src={H1} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {currentBlockType === 'heading-2' ? 'accent-bg text-white' : ''}"
        on:click={() => setHeading(2)}
        disabled={readonly}
        title="Heading 2"
        aria-label="Convert to heading 2"
      >
        <Icon src={H2} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {currentBlockType === 'heading-3' ? 'accent-bg text-white' : ''}"
        on:click={() => setHeading(3)}
        disabled={readonly}
        title="Heading 3"
        aria-label="Convert to heading 3"
      >
        <Icon src={H3} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {currentBlockType === 'blockquote' ? 'accent-bg text-white' : ''}"
        on:click={setBlockquote}
        disabled={readonly}
        title="Blockquote"
        aria-label="Convert to blockquote"
      >
        <Icon src={ChatBubbleLeftRight} class="w-4 h-4" />
      </button>
    </div>

    <!-- List formatting group -->
    <div class="flex items-center space-x-1 border-r border-slate-200 dark:border-slate-700 pr-2 mr-2">
      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {currentBlockType === 'bullet-list' ? 'accent-bg text-white' : ''}"
        on:click={toggleBulletList}
        disabled={readonly}
        title="Bullet list"
        aria-label="Toggle bullet list"
      >
        <Icon src={ListBullet} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed {currentBlockType === 'numbered-list' ? 'accent-bg text-white' : ''}"
        on:click={toggleNumberList}
        disabled={readonly}
        title="Numbered list"
        aria-label="Toggle numbered list"
      >
        <Icon src={NumberedList} class="w-4 h-4" />
      </button>
    </div>

    <!-- Media group -->
    <div class="flex items-center space-x-1">
      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={insertLink}
        disabled={readonly}
        title="Insert link"
        aria-label="Insert link"
      >
        <Icon src={Link} class="w-4 h-4" />
      </button>

      <button
        type="button"
        class="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={insertImage}
        disabled={readonly}
        title="Insert image"
        aria-label="Insert image"
      >
        <Icon src={Photo} class="w-4 h-4" />
      </button>
    </div>
  </div>

  <!-- Right side: Actions -->
  <div class="flex items-center space-x-2">
    <button
      type="button"
      class="px-3 py-1.5 text-sm rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={handleSave}
      disabled={readonly}
      title="Save note (Ctrl+S)"
      aria-label="Save note"
    >
      <div class="flex items-center space-x-1">
        <Icon src={ArrowDownTray} class="w-4 h-4" />
        <span>Save</span>
      </div>
    </button>
  </div>
</div>

<style>
  .editor-toolbar {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style> 