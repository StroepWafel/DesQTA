<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
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
    CheckCircle,
    ChatBubbleLeftRight,
    Link,
    Photo,
    TableCells,
    ArrowDownTray,
    ChevronDown,
    AtSymbol,
    Calendar,
    AcademicCap,
    User,
    Clock,
    DocumentText,
    ChartBar,
    Clipboard,
    BookOpen,
    Megaphone,
  } from 'svelte-hero-icons';
  import TimetableSelector from './plugins/TimetableSelector.svelte';
  import type { SeqtaMentionItem } from '$lib/services/seqtaMentionsServiceRust';

  // Props
  export let editor: Editor | null = null;
  export let readonly: boolean = false;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    save: void;
  }>();

  // Toolbar state
  let showBlockTypeDropdown = false;
  let showMoreDropdown = false;
  let showMentionsDropdown = false;
  let showTimetableSelector = false;

  // Force reactivity trigger
  let editorUpdateTrigger = 0;

  // Reactive active states
  $: isBoldActive = (editorUpdateTrigger >= 0 && editor?.isActive('bold')) || false;
  $: isItalicActive = (editorUpdateTrigger >= 0 && editor?.isActive('italic')) || false;
  $: isUnderlineActive = (editorUpdateTrigger >= 0 && editor?.isActive('underline')) || false;
  $: isStrikeActive = (editorUpdateTrigger >= 0 && editor?.isActive('strike')) || false;
  $: isCodeActive = (editorUpdateTrigger >= 0 && editor?.isActive('code')) || false;

  // Set up editor event listeners
  let currentEditor: any = null;
  let updateActiveStates: (() => void) | null = null;

  $: if (editor !== currentEditor) {
    // Clean up previous editor listeners
    if (currentEditor && updateActiveStates) {
      currentEditor.off('selectionUpdate', updateActiveStates);
      currentEditor.off('transaction', updateActiveStates);
    }

    // Set up new editor listeners
    if (editor) {
      updateActiveStates = () => {
        editorUpdateTrigger++;
      };

      editor.on('selectionUpdate', updateActiveStates);
      editor.on('transaction', updateActiveStates);
    }

    currentEditor = editor;
  }

  onDestroy(() => {
    if (currentEditor && updateActiveStates) {
      currentEditor.off('selectionUpdate', updateActiveStates);
      currentEditor.off('transaction', updateActiveStates);
    }
  });

  // Block type options
  const blockTypes = [
    { id: 'paragraph', label: 'Paragraph', icon: 'P', shortcut: 'Ctrl+Alt+0' },
    { id: 'heading1', label: 'Heading 1', icon: 'H1', shortcut: 'Ctrl+Alt+1' },
    { id: 'heading2', label: 'Heading 2', icon: 'H2', shortcut: 'Ctrl+Alt+2' },
    { id: 'heading3', label: 'Heading 3', icon: 'H3', shortcut: 'Ctrl+Alt+3' },
    { id: 'separator' },
    { id: 'bulletList', label: 'Bullet List', icon: ListBullet },
    { id: 'orderedList', label: 'Numbered List', icon: NumberedList },
    { id: 'taskList', label: 'Task List', icon: CheckCircle },
    { id: 'separator' },
    { id: 'blockquote', label: 'Quote', icon: '"', shortcut: 'Ctrl+Shift+B' },
    { id: 'codeBlock', label: 'Code Block', icon: CodeBracket, shortcut: 'Ctrl+Alt+C' },
  ];

  // Format commands
  function toggleBold() {
    if (!editor || readonly) return;
    editor.chain().focus().toggleBold().run();
  }

  function toggleItalic() {
    if (!editor || readonly) return;
    editor.chain().focus().toggleItalic().run();
  }

  function toggleUnderline() {
    if (!editor || readonly) return;
    editor.chain().focus().toggleUnderline().run();
  }

  function toggleStrikethrough() {
    if (!editor || readonly) return;
    editor.chain().focus().toggleStrike().run();
  }

  function toggleCode() {
    if (!editor || readonly) return;
    editor.chain().focus().toggleCode().run();
  }

  // Block type commands
  function setBlockType(type: string) {
    if (!editor || readonly) return;

    switch (type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'taskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
    }
    showBlockTypeDropdown = false;
  }

  // Utility commands
  function insertLink() {
    if (!editor || readonly) return;

    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertImage() {
    if (!editor || readonly) return;
    editor.chain().focus().insertImageFromFile().run();
  }

  function insertTable() {
    if (!editor || readonly) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  // Mention types
  const mentionTypes = [
    { id: 'assessment', label: 'Assessment', icon: ChartBar },
    { id: 'assignment', label: 'Assignment', icon: DocumentText },
    { id: 'homework', label: 'Homework', icon: Clipboard },
    { id: 'class', label: 'Class', icon: AcademicCap },
    { id: 'subject', label: 'Subject', icon: BookOpen },
    { id: 'teacher', label: 'Teacher', icon: User },
    { id: 'timetable_slot', label: 'Timetable Slot', icon: Clock },
    { id: 'notice', label: 'Notice', icon: Megaphone },
  ];

  // Insert mention
  function insertMention(type?: string) {
    if (!editor || readonly) return;

    // Special handling for timetable slots - show selector popup
    if (type === 'timetable_slot') {
      showTimetableSelector = true;
      showMentionsDropdown = false;
      return;
    }

    // Insert @ followed by type name to trigger filtered search (no space)
    if (type) {
      editor.chain().focus().insertContent(`@${type}`).run();
    } else {
      editor.chain().focus().insertContent('@').run();
    }

    showMentionsDropdown = false;
  }

  function handleTimetableSelect(item: SeqtaMentionItem) {
    if (!editor || readonly) return;

    // Insert the mention
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'seqtaMention',
        attrs: {
          id: item.id,
          type: item.type,
          title: item.title,
          subtitle: item.subtitle,
          label: item.title,
          data: item.data,
        },
      })
      .insertContent({ type: 'text', text: ' ' })
      .run();
  }

  function handleSave() {
    dispatch('save');
  }

  // Get current block type for display (reactive)
  $: currentBlockType = (() => {
    if (!editor) return 'Paragraph';

    // Force reactivity by referencing the trigger
    editorUpdateTrigger;

    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('bulletList')) return 'Bullet List';
    if (editor.isActive('orderedList')) return 'Numbered List';
    if (editor.isActive('taskList')) return 'Task List';
    if (editor.isActive('blockquote')) return 'Quote';
    if (editor.isActive('codeBlock')) return 'Code Block';

    return 'Paragraph';
  })();

  // Check if format is active
  function isActive(format: string): boolean {
    if (!editor) return false;

    switch (format) {
      case 'bold':
        return editor.isActive('bold');
      case 'italic':
        return editor.isActive('italic');
      case 'underline':
        return editor.isActive('underline');
      case 'strike':
        return editor.isActive('strike');
      case 'code':
        return editor.isActive('code');
      default:
        return false;
    }
  }

  // Close dropdowns when clicking outside
  function handleClick(event: MouseEvent) {
    if (!(event.target as Element).closest('.dropdown-container')) {
      showBlockTypeDropdown = false;
      showMoreDropdown = false;
      showMentionsDropdown = false;
    }
  }

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      showBlockTypeDropdown = false;
      showMoreDropdown = false;
      showMentionsDropdown = false;
    }
  }
</script>

<svelte:window on:click={handleClick} on:keydown={handleKeydown} />

<div class="tiptap-toolbar flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-900/30">
  <!-- Left side: Formatting tools -->
  <div class="flex items-center space-x-1">
    <!-- Block Type Dropdown -->
    <div class="relative dropdown-container">
      <button
        class="flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors {showBlockTypeDropdown
          ? 'bg-zinc-100 dark:bg-zinc-700'
          : ''}"
        on:click={() => (showBlockTypeDropdown = !showBlockTypeDropdown)}
        disabled={readonly}
        title="Change block type">
        <span class="text-zinc-700 dark:text-zinc-300">{currentBlockType}</span>
        <Icon src={ChevronDown} class="w-4 h-4 text-zinc-500" />
      </button>

      {#if showBlockTypeDropdown}
        <div
          class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10">
          {#each blockTypes as blockType}
            {#if blockType.id === 'separator'}
              <div class="h-px bg-zinc-200 dark:bg-zinc-700 my-1"></div>
            {:else}
              <button
                class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                on:click={() => setBlockType(blockType.id)}>
                {#if typeof blockType.icon === 'string'}
                  <span
                    class="w-5 h-5 flex items-center justify-center text-xs font-mono bg-zinc-100 dark:bg-zinc-700 rounded">
                    {blockType.icon}
                  </span>
                {:else}
                  <Icon src={blockType.icon} class="w-5 h-5 text-zinc-500" />
                {/if}
                <span class="flex-1 text-zinc-700 dark:text-zinc-300">{blockType.label}</span>
                {#if blockType.shortcut}
                  <span class="text-xs text-zinc-500">{blockType.shortcut}</span>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Divider -->
    <div class="w-px h-6 bg-zinc-300 dark:bg-zinc-600"></div>

    <!-- Text Formatting -->
    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors {isBoldActive
        ? 'bg-zinc-200 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : 'text-zinc-600 dark:text-zinc-400'}"
      on:click={toggleBold}
      disabled={readonly}
      title="Bold (Ctrl+B)">
      <Icon src={Bold} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors {isItalicActive
        ? 'bg-zinc-200 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : 'text-zinc-600 dark:text-zinc-400'}"
      on:click={toggleItalic}
      disabled={readonly}
      title="Italic (Ctrl+I)">
      <Icon src={Italic} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors {isUnderlineActive
        ? 'bg-zinc-200 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : 'text-zinc-600 dark:text-zinc-400'}"
      on:click={toggleUnderline}
      disabled={readonly}
      title="Underline (Ctrl+U)">
      <Icon src={Underline} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors {isStrikeActive
        ? 'bg-zinc-200 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : 'text-zinc-600 dark:text-zinc-400'}"
      on:click={toggleStrikethrough}
      disabled={readonly}
      title="Strikethrough">
      <Icon src={Strikethrough} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors {isCodeActive
        ? 'bg-zinc-200 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : 'text-zinc-600 dark:text-zinc-400'}"
      on:click={toggleCode}
      disabled={readonly}
      title="Inline Code">
      <Icon src={CodeBracket} class="w-4 h-4" />
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-zinc-300 dark:bg-zinc-600"></div>

    <!-- SEQTA Mentions Dropdown -->
    <div class="relative dropdown-container">
      <button
        class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {showMentionsDropdown
          ? 'bg-zinc-200 dark:bg-zinc-700'
          : ''}"
        on:click={() => (showMentionsDropdown = !showMentionsDropdown)}
        disabled={readonly}
        title="Insert SEQTA Mention">
        <Icon src={AtSymbol} class="w-4 h-4" />
      </button>

      {#if showMentionsDropdown}
        <div
          class="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
          <button
            class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors border-b border-zinc-200 dark:border-zinc-700"
            on:click={() => insertMention()}>
            <Icon src={AtSymbol} class="w-5 h-5 text-zinc-500" />
            <span class="flex-1 text-zinc-700 dark:text-zinc-300">Search All...</span>
          </button>
          <div class="h-px bg-zinc-200 dark:bg-zinc-700 my-1"></div>
          {#each mentionTypes as mentionType}
            <button
              class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              on:click={() => insertMention(mentionType.id)}>
              <Icon src={mentionType.icon} class="w-5 h-5 text-zinc-500" />
              <span class="flex-1 text-zinc-700 dark:text-zinc-300">{mentionType.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Insert Tools -->
    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
      on:click={insertLink}
      disabled={readonly}
      title="Insert Link">
      <Icon src={Link} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
      on:click={insertImage}
      disabled={readonly}
      title="Insert Image">
      <Icon src={Photo} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
      on:click={insertTable}
      disabled={readonly}
      title="Insert Table">
      <Icon src={TableCells} class="w-4 h-4" />
    </button>

    <!-- More Tools Dropdown -->
    <div class="relative dropdown-container">
      <button
        class="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {showMoreDropdown
          ? 'bg-zinc-200 dark:bg-zinc-700'
          : ''}"
        on:click={() => (showMoreDropdown = !showMoreDropdown)}
        disabled={readonly}
        title="More tools">
        <Icon src={ChevronDown} class="w-4 h-4" />
      </button>

      {#if showMoreDropdown}
        <div
          class="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10">
          <button
            class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            on:click={() => {
              editor?.commands.undo();
              showMoreDropdown = false;
            }}>
            <span class="text-zinc-700 dark:text-zinc-300">Undo</span>
            <span class="ml-auto text-xs text-zinc-500">Ctrl+Z</span>
          </button>
          <button
            class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            on:click={() => {
              editor?.commands.redo();
              showMoreDropdown = false;
            }}>
            <span class="text-zinc-700 dark:text-zinc-300">Redo</span>
            <span class="ml-auto text-xs text-zinc-500">Ctrl+Y</span>
          </button>
          <div class="h-px bg-zinc-200 dark:bg-zinc-700 my-1"></div>
          <button
            class="w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            on:click={() => {
              editor?.commands.selectAll();
              showMoreDropdown = false;
            }}>
            <span class="text-zinc-700 dark:text-zinc-300">Select All</span>
            <span class="ml-auto text-xs text-zinc-500">Ctrl+A</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Right side: Save button -->
  <div class="flex items-center space-x-2">
    <span class="text-xs text-zinc-500 dark:text-zinc-400">
      Type <kbd class="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">@</kbd> for SEQTA mentions
    </span>

    <button
      class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center space-x-1"
      on:click={handleSave}
      title="Save note (Ctrl+S)">
      <Icon src={ArrowDownTray} class="w-4 h-4" />
      <span>Save</span>
    </button>
  </div>
</div>

<!-- Timetable Selector -->
<TimetableSelector bind:open={showTimetableSelector} onSelect={handleTimetableSelect} />

<style>
  kbd {
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.75rem;
  }
</style>
