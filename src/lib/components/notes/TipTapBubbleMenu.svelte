<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Bold, Italic, Strikethrough, CodeBracket, Link } from 'svelte-hero-icons';
  import type { Editor } from '@tiptap/core';

  export let editor: Editor | null = null;

  function toggleBold() {
    if (!editor) return;
    editor.chain().focus().toggleBold().run();
  }

  function toggleItalic() {
    if (!editor) return;
    editor.chain().focus().toggleItalic().run();
  }

  function toggleStrikethrough() {
    if (!editor) return;
    editor.chain().focus().toggleStrike().run();
  }

  function toggleCode() {
    if (!editor) return;
    editor.chain().focus().toggleCode().run();
  }

  function toggleLink() {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = prompt('Enter URL:');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    }
  }

  function isActive(format: string): boolean {
    if (!editor) return false;

    switch (format) {
      case 'bold':
        return editor.isActive('bold');
      case 'italic':
        return editor.isActive('italic');
      case 'strike':
        return editor.isActive('strike');
      case 'code':
        return editor.isActive('code');
      case 'link':
        return editor.isActive('link');
      default:
        return false;
    }
  }
</script>

{#if editor}
  <div
    class="bubble-menu-content flex items-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-1">
    <button
      class="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {isActive(
        'bold',
      )
        ? 'bg-zinc-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : ''}"
      on:click={toggleBold}
      title="Bold">
      <Icon src={Bold} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {isActive(
        'italic',
      )
        ? 'bg-zinc-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : ''}"
      on:click={toggleItalic}
      title="Italic">
      <Icon src={Italic} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {isActive(
        'strike',
      )
        ? 'bg-zinc-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : ''}"
      on:click={toggleStrikethrough}
      title="Strikethrough">
      <Icon src={Strikethrough} class="w-4 h-4" />
    </button>

    <button
      class="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {isActive(
        'code',
      )
        ? 'bg-zinc-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : ''}"
      on:click={toggleCode}
      title="Code">
      <Icon src={CodeBracket} class="w-4 h-4" />
    </button>

    <div class="w-px h-6 bg-zinc-300 dark:bg-zinc-600 mx-1"></div>

    <button
      class="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 {isActive(
        'link',
      )
        ? 'bg-zinc-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400'
        : ''}"
      on:click={toggleLink}
      title={isActive('link') ? 'Remove link' : 'Add link'}>
      <Icon src={Link} class="w-4 h-4" />
    </button>
  </div>
{/if}

<style>
  .bubble-menu-content {
    pointer-events: auto;
  }
</style>
