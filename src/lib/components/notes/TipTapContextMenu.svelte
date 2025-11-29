<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { 
    Icon,
    Bold, 
    Italic, 
    Underline, 
    Strikethrough,
    CodeBracket,
    Link,
    ChatBubbleLeftRight,
    ListBullet,
    NumberedList,
    TableCells,
    Plus,
    Minus,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Trash
  } from 'svelte-hero-icons';

  export let editor: any = null;
  export let x = 0;
  export let y = 0;
  export let visible = false;
  export let isInTable = false;

  const dispatch = createEventDispatcher();

  let menuElement: HTMLElement;
  let adjustedX = x;
  let adjustedY = y;
  let lastVisible = false;

  // Portal action to move element to body (bypasses transform contexts)
  function portalAction(node: HTMLElement) {
    // Only append if not already in body
    if (node.parentNode !== document.body) {
      document.body.appendChild(node);
    }
    
    return {
      destroy() {
        // Clean up when destroyed
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  // Update position when coordinates change
  $: adjustedX = x;
  $: adjustedY = y;

  // Adjust position when menu becomes visible
  $: if (visible && !lastVisible && menuElement) {
    lastVisible = true;
    // Use tick to ensure DOM is ready, then adjust position
    tick().then(() => {
      if (menuElement && menuElement.parentNode && visible) {
        const rect = menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (x + rect.width > viewportWidth) {
          adjustedX = viewportWidth - rect.width - 10;
        }
        if (y + rect.height > viewportHeight) {
          adjustedY = viewportHeight - rect.height - 10;
        }
        if (adjustedX < 10) adjustedX = 10;
        if (adjustedY < 10) adjustedY = 10;
      }
    });
  } else if (!visible) {
    lastVisible = false;
  }

  function executeCommand(command: string, value?: any) {
    if (!editor) return;
    
    switch (command) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strikethrough':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'code':
        editor.chain().focus().toggleCode().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      case 'insertTable':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'addColumnBefore':
        editor.chain().focus().addColumnBefore().run();
        break;
      case 'addColumnAfter':
        editor.chain().focus().addColumnAfter().run();
        break;
      case 'deleteColumn':
        editor.chain().focus().deleteColumn().run();
        break;
      case 'addRowBefore':
        editor.chain().focus().addRowBefore().run();
        break;
      case 'addRowAfter':
        editor.chain().focus().addRowAfter().run();
        break;
      case 'deleteRow':
        editor.chain().focus().deleteRow().run();
        break;
      case 'deleteTable':
        editor.chain().focus().deleteTable().run();
        break;
      case 'mergeCells':
        editor.chain().focus().mergeCells().run();
        break;
      case 'splitCell':
        editor.chain().focus().splitCell().run();
        break;
      case 'toggleHeaderColumn':
        editor.chain().focus().toggleHeaderColumn().run();
        break;
      case 'toggleHeaderRow':
        editor.chain().focus().toggleHeaderRow().run();
        break;
    }
    
    closeMenu();
  }

  function closeMenu() {
    dispatch('close');
  }

  function handleClickOutside(event: MouseEvent) {
    if (visible && menuElement && !menuElement.contains(event.target as Node)) {
      closeMenu();
    }
  }

  function handleContextMenuOutside(event: MouseEvent) {
    if (visible && menuElement && !menuElement.contains(event.target as Node)) {
      event.preventDefault();
      closeMenu();
    }
  }

  $: if (visible) {
    // Use a slight delay to ensure the menu is rendered before adding listeners
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleContextMenuOutside);
    }, 10);
  } else {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('contextmenu', handleContextMenuOutside);
  }

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('contextmenu', handleContextMenuOutside);
  });
</script>

{#if visible}
  <div
    bind:this={menuElement}
    use:portalAction
    class="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-2 min-w-48"
    style="left: {adjustedX}px; top: {adjustedY}px; pointer-events: auto;"
  >
    {#if !isInTable}
      <!-- Text Formatting Options -->
      <div class="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-100 dark:border-zinc-700 mb-1">
        Format Text
      </div>
      
      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('bold')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('bold')}
        on:click={() => executeCommand('bold')}
      >
        <Icon src={Bold} class="w-4 h-4 mr-3" />
        Bold
        <span class="ml-auto text-xs text-zinc-400">Ctrl+B</span>
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('italic')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('italic')}
        on:click={() => executeCommand('italic')}
      >
        <Icon src={Italic} class="w-4 h-4 mr-3" />
        Italic
        <span class="ml-auto text-xs text-zinc-400">Ctrl+I</span>
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('underline')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('underline')}
        on:click={() => executeCommand('underline')}
      >
        <Icon src={Underline} class="w-4 h-4 mr-3" />
        Underline
        <span class="ml-auto text-xs text-zinc-400">Ctrl+U</span>
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('strike')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('strike')}
        on:click={() => executeCommand('strikethrough')}
      >
        <Icon src={Strikethrough} class="w-4 h-4 mr-3" />
        Strikethrough
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('code')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('code')}
        on:click={() => executeCommand('code')}
      >
        <Icon src={CodeBracket} class="w-4 h-4 mr-3" />
        Inline Code
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>

      <!-- Block Formatting -->
      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('blockquote')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('blockquote')}
        on:click={() => executeCommand('blockquote')}
      >
        <Icon src={ChatBubbleLeftRight} class="w-4 h-4 mr-3" />
        Quote
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('bulletList')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('bulletList')}
        on:click={() => executeCommand('bulletList')}
      >
        <Icon src={ListBullet} class="w-4 h-4 mr-3" />
        Bullet List
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('orderedList')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('orderedList')}
        on:click={() => executeCommand('orderedList')}
      >
        <Icon src={NumberedList} class="w-4 h-4 mr-3" />
        Numbered List
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('link')}
      >
        <Icon src={Link} class="w-4 h-4 mr-3" />
        Add Link
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>

      <!-- Insert Options -->
      <div class="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        Insert
      </div>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('insertTable')}
      >
        <Icon src={TableCells} class="w-4 h-4 mr-3" />
        Insert Table
      </button>
    {:else}
      <!-- Table-specific options -->
      <div class="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide border-b border-zinc-100 dark:border-zinc-700 mb-1">
        Table Options
      </div>

      <!-- Column Operations -->
      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('addColumnBefore')}
      >
        <Icon src={ArrowLeft} class="w-4 h-4 mr-3" />
        Add Column Before
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('addColumnAfter')}
      >
        <Icon src={ArrowRight} class="w-4 h-4 mr-3" />
        Add Column After
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left text-red-600 dark:text-red-400"
        on:click={() => executeCommand('deleteColumn')}
      >
        <Icon src={Minus} class="w-4 h-4 mr-3" />
        Delete Column
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>

      <!-- Row Operations -->
      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('addRowBefore')}
      >
        <Icon src={ArrowUp} class="w-4 h-4 mr-3" />
        Add Row Above
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('addRowAfter')}
      >
        <Icon src={ArrowDown} class="w-4 h-4 mr-3" />
        Add Row Below
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left text-red-600 dark:text-red-400"
        on:click={() => executeCommand('deleteRow')}
      >
        <Icon src={Minus} class="w-4 h-4 mr-3" />
        Delete Row
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>

      <!-- Table Structure -->
      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('toggleHeaderRow')}
      >
        <Icon src={TableCells} class="w-4 h-4 mr-3" />
        Toggle Header Row
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('toggleHeaderColumn')}
      >
        <Icon src={TableCells} class="w-4 h-4 mr-3" />
        Toggle Header Column
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('mergeCells')}
      >
        <Icon src={Plus} class="w-4 h-4 mr-3" />
        Merge Cells
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        on:click={() => executeCommand('splitCell')}
      >
        <Icon src={Minus} class="w-4 h-4 mr-3" />
        Split Cell
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left text-red-600 dark:text-red-400"
        on:click={() => executeCommand('deleteTable')}
      >
        <Icon src={Trash} class="w-4 h-4 mr-3" />
        Delete Table
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>

      <!-- Text Formatting (available in table too) -->
      <div class="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        Format Text
      </div>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('bold')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('bold')}
        on:click={() => executeCommand('bold')}
      >
        <Icon src={Bold} class="w-4 h-4 mr-3" />
        Bold
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('italic')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('italic')}
        on:click={() => executeCommand('italic')}
      >
        <Icon src={Italic} class="w-4 h-4 mr-3" />
        Italic
      </button>

      <button
        class="w-full flex items-center px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-left"
        class:bg-blue-50={editor && editor.isActive && editor.isActive('underline')}
        class:dark:bg-blue-900={editor && editor.isActive && editor.isActive('underline')}
        on:click={() => executeCommand('underline')}
      >
        <Icon src={Underline} class="w-4 h-4 mr-3" />
        Underline
      </button>
    {/if}
  </div>
{/if}

<style>
  /* Prevent text selection on menu items */
  button {
    user-select: none;
  }
</style>
