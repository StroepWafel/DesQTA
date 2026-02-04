<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  import Typography from '@tiptap/extension-typography';
  import TaskList from '@tiptap/extension-task-list';
  import TaskItem from '@tiptap/extension-task-item';
  import Link from '@tiptap/extension-link';
  import BubbleMenu from '@tiptap/extension-bubble-menu';
  import Underline from '@tiptap/extension-underline';
  import Table from '@tiptap/extension-table';
  import TableRow from '@tiptap/extension-table-row';
  import TableHeader from '@tiptap/extension-table-header';
  import TableCell from '@tiptap/extension-table-cell';
  import { logger } from '../../../utils/logger';

  // Custom extensions
  import { SeqtaMentions, seqtaMentionSuggestion } from './plugins/SeqtaMentions';
  import { ImageExtension } from './plugins/ImageExtension';
  import { SeqtaContentBlock } from './plugins/SeqtaContentBlock';

  // Components
  import TipTapToolbar from './TipTapToolbar.svelte';
  import TipTapStatusBar from './TipTapStatusBar.svelte';
  import ImageControlModal from './ImageControlModal.svelte';
  import TipTapBubbleMenu from './TipTapBubbleMenu.svelte';
  import TipTapContextMenu from './TipTapContextMenu.svelte';
  import SeqtaMentionDetailModal from './plugins/SeqtaMentionDetailModal.svelte';

  // Portal action to move modal to body (bypasses overflow clipping)
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
      },
    };
  }

  // Props
  export let content: string = '<p></p>';
  export let placeholder: string = 'Start writing your note...';
  export let readonly: boolean = false;
  export let autofocus: boolean = false;
  export let noteId: string | undefined = undefined;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    change: { content: string };
    save: { content: string };
    focus: void;
    blur: void;
  }>();

  // Editor state
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  let isFocused = false;
  let lastNoteId: string | undefined = undefined;

  // Image modal state
  let showImageModal = false;
  let currentImageData: { element: HTMLElement; img: HTMLImageElement } | null = null;

  // Context menu state
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let isInTable = false;

  // SEQTA Mention modal state
  let showMentionModal = false;
  let mentionModalData: {
    mentionId: string;
    mentionType: string;
    title: string;
    subtitle: string;
    data?: any;
  } | null = null;

  // Word and character count (calculated manually)
  $: wordCount = calculateWordCount(content);
  $: characterCount = calculateCharacterCount(content);

  function calculateWordCount(html: string): number {
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    return textContent.split(/\s+/).filter((word) => word.length > 0).length;
  }

  function calculateCharacterCount(html: string): number {
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    return textContent.length;
  }

  onMount(() => {
    // Prevent default context menu on the editor container
    const preventContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // Listen for SEQTA mention clicks
    const handleMentionClick = (event: CustomEvent) => {
      logger.debug('TipTapNotesEditor', 'handleMentionClick', 'Received mention click event', {
        mentionId: event.detail.mentionId,
        mentionType: event.detail.mentionType,
      });
      const { mentionId, mentionType, title, subtitle, data } = event.detail;
      mentionModalData = { mentionId, mentionType, title, subtitle, data };
      showMentionModal = true;
    };

    window.addEventListener('seqta-mention-click', handleMentionClick as EventListener);

    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'heading') {
              return 'Heading';
            }
            return placeholder;
          },
        }),
        Typography,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class:
              'text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300',
          },
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        BubbleMenu.configure({
          element: document.querySelector('.bubble-menu') as HTMLElement,
        }),
        SeqtaMentions.configure({
          suggestion: {
            ...seqtaMentionSuggestion,
            items: async ({ query, editor: suggestionEditor }: { query: string; editor?: any }) => {
              // Use editor from suggestion props (provided by TipTap)
              return seqtaMentionSuggestion.items({ query, editor: suggestionEditor });
            },
          },
        }),
        SeqtaContentBlock.configure({}),
        ImageExtension.configure({
          allowBase64: true,
          onImageClick: handleImageClick,
        }),
      ],
      content,
      editable: !readonly,
      autofocus,
      editorProps: {
        attributes: {
          class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none p-4',
        },
        handleDOMEvents: {
          focus: () => {
            isFocused = true;
            dispatch('focus');
            return false;
          },
          blur: () => {
            isFocused = false;
            dispatch('blur');
            return false;
          },
          mousedown: (view, event) => {
            // Check if mousedown is on a SEQTA mention
            const target = event.target as HTMLElement;
            const mentionElement = target.closest('.seqta-mention');
            if (mentionElement) {
              const mentionId = mentionElement.getAttribute('data-id');
              // Try data-mention-type first (from renderHTML), then data-type (from nodeView)
              const mentionType =
                mentionElement.getAttribute('data-mention-type') ||
                mentionElement.getAttribute('data-type') ||
                '';
              const title = mentionElement.getAttribute('data-title') || '';
              const subtitle = mentionElement.getAttribute('data-subtitle') || '';

              if (mentionId && mentionType && mentionType !== 'seqtaMention') {
                logger.debug(
                  'TipTapNotesEditor',
                  'mousedown',
                  'TipTap intercepted mention mousedown',
                  {
                    mentionId,
                    mentionType,
                    title,
                    subtitle,
                  },
                );
                mentionModalData = { mentionId, mentionType, title, subtitle };
                showMentionModal = true;
                event.preventDefault();
                event.stopPropagation();
                return true; // Prevent TipTap's default handling
              }
            }
            return false; // Let TipTap handle other mousedowns
          },
          contextmenu: (view, event) => {
            handleContextMenu(event);
            return true; // Prevent TipTap's default handling
          },
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        content = html;
        dispatch('change', { content: html });
      },
      onCreate: ({ editor }) => {
        lastNoteId = noteId;
      },
    });

    return () => {
      editor?.destroy();
      window.removeEventListener('seqta-mention-click', handleMentionClick as EventListener);
    };
  });

  onDestroy(() => {
    editor?.destroy();
  });

  // React to content changes from parent (when switching notes)
  $: if (editor && content && noteId !== lastNoteId) {
    editor.commands.setContent(content, false);
    lastNoteId = noteId;
  }

  // React to readonly changes
  $: if (editor) {
    editor.setEditable(!readonly);
  }

  // Image handling
  function handleImageClick(element: HTMLElement, img: HTMLImageElement) {
    currentImageData = { element, img };
    showImageModal = true;
  }

  function handleCopyAlt() {
    if (currentImageData?.img) {
      navigator.clipboard.writeText(currentImageData.img.alt || 'Image');
    }
  }

  function handleRemoveImage() {
    if (currentImageData?.element && editor) {
      // Find the position of the image node and delete it
      const pos = editor.view.posAtDOM(currentImageData.element, 0);
      if (pos >= 0) {
        const node = editor.view.state.doc.nodeAt(pos);
        if (node) {
          editor
            .chain()
            .focus()
            .deleteRange({ from: pos, to: pos + node.nodeSize })
            .run();
        }
      }
    }
    closeImageModal();
  }

  function handleReplaceImage() {
    if (currentImageData?.element && editor) {
      // Trigger image insertion
      editor.chain().focus().insertImageFromFile().run();
      // The old image will be replaced manually after selection
      setTimeout(() => {
        handleRemoveImage();
      }, 100);
    }
    closeImageModal();
  }

  function closeImageModal() {
    showImageModal = false;
    currentImageData = null;
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Capture coordinates immediately before any async operations
    const x = event.clientX;
    const y = event.clientY;

    // Close any existing context menu first
    showContextMenu = false;

    // Use a small delay to ensure the previous menu is closed
    setTimeout(() => {
      contextMenuX = x;
      contextMenuY = y;

      // Check if we're in a table
      if (editor) {
        isInTable = editor.isActive('table');
      }

      showContextMenu = true;
    }, 10);
  }

  function closeContextMenu() {
    showContextMenu = false;
  }

  function handleSave() {
    if (editor) {
      dispatch('save', { content: editor.getHTML() });
    }
  }

  // Expose methods for parent components
  export function focus() {
    editor?.commands.focus();
  }

  export function blur() {
    editor?.commands.blur();
  }

  export function getContent(): string {
    return editor?.getHTML() || content;
  }

  export function setContent(newContent: string) {
    editor?.commands.setContent(newContent, false);
  }

  export function insertText(text: string) {
    editor?.commands.insertContent(text);
  }

  export function executeCommand(command: string, value?: any) {
    if (!editor) return false;

    switch (command) {
      case 'bold':
        return editor.chain().focus().toggleBold().run();
      case 'italic':
        return editor.chain().focus().toggleItalic().run();
      case 'underline':
        return editor.chain().focus().toggleUnderline().run();
      case 'strikethrough':
        return editor.chain().focus().toggleStrike().run();
      case 'code':
        return editor.chain().focus().toggleCode().run();
      case 'heading-1':
        return editor.chain().focus().toggleHeading({ level: 1 }).run();
      case 'heading-2':
        return editor.chain().focus().toggleHeading({ level: 2 }).run();
      case 'heading-3':
        return editor.chain().focus().toggleHeading({ level: 3 }).run();
      case 'paragraph':
        return editor.chain().focus().setParagraph().run();
      case 'blockquote':
        return editor.chain().focus().toggleBlockquote().run();
      case 'code-block':
        return editor.chain().focus().toggleCodeBlock().run();
      case 'bullet-list':
        return editor.chain().focus().toggleBulletList().run();
      case 'numbered-list':
        return editor.chain().focus().toggleOrderedList().run();
      case 'task-list':
        return editor.chain().focus().toggleTaskList().run();
      case 'insert-table':
        return editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      case 'insert-image':
        return editor.chain().focus().insertImageFromFile().run();
      case 'insert-link':
        const url = prompt('Enter URL:');
        if (url) {
          return editor.chain().focus().setLink({ href: url }).run();
        }
        return false;
      default:
        return false;
    }
  }
</script>

<div
  class="tiptap-notes-editor h-full flex flex-col bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-md transition-all duration-200 {isFocused
    ? 'ring-2 ring-blue-500 dark:ring-blue-400'
    : ''}">
  <!-- Toolbar -->
  <div class="shrink-0 border-b border-zinc-200 dark:border-zinc-700">
    <TipTapToolbar bind:editor {readonly} on:save={handleSave} />
  </div>

  <!-- Editor Content -->
  <div class="flex-1 relative min-h-0">
    <div bind:this={editorElement} class="h-full overflow-y-auto" role="textbox" tabindex="0"></div>

    <!-- Bubble Menu -->
    <div class="bubble-menu">
      <TipTapBubbleMenu bind:editor />
    </div>
  </div>

  <!-- Status Bar -->
  <div class="shrink-0 border-t border-zinc-200 dark:border-zinc-700">
    <TipTapStatusBar {wordCount} {characterCount} {isFocused} />
  </div>
</div>

<!-- Context Menu -->
<TipTapContextMenu
  bind:editor
  bind:visible={showContextMenu}
  x={contextMenuX}
  y={contextMenuY}
  {isInTable}
  on:close={closeContextMenu} />

<!-- Image Control Modal -->
<ImageControlModal
  bind:isOpen={showImageModal}
  imageAlt={currentImageData?.img?.alt || ''}
  imageSrc={currentImageData?.img?.src || ''}
  on:copyAlt={handleCopyAlt}
  on:removeImage={handleRemoveImage}
  on:replaceImage={handleReplaceImage}
  on:close={closeImageModal} />

<!-- SEQTA Mention Detail Modal - Portaled to body to avoid overflow clipping -->
{#if mentionModalData}
  <div use:portalAction>
    <SeqtaMentionDetailModal
      bind:open={showMentionModal}
      mentionId={mentionModalData.mentionId}
      mentionType={mentionModalData.mentionType}
      title={mentionModalData.title}
      subtitle={mentionModalData.subtitle}
      data={mentionModalData.data}
      onclose={() => {
        showMentionModal = false;
        mentionModalData = null;
      }} />
  </div>
{/if}

<style>
  .tiptap-notes-editor {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Custom styles for TipTap editor */
  :global(.ProseMirror) {
    outline: none !important;
  }

  :global(.ProseMirror .seqta-mention) {
    pointer-events: none;
    user-select: all;
  }

  :global(.ProseMirror .seqta-mention:hover) {
    background-color: rgba(59, 130, 246, 0.1);
  }

  :global(.ProseMirror .ProseMirror-selectednode) {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  :global(.ProseMirror .has-focus) {
    border-radius: 3px;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Task list styling */
  :global(.ProseMirror ul[data-type='taskList']) {
    list-style: none;
    padding: 0;
  }

  :global(.ProseMirror ul[data-type='taskList'] li) {
    display: flex;
    align-items: flex-start;
  }

  :global(.ProseMirror ul[data-type='taskList'] li > label) {
    flex: 0 0 auto;
    margin-right: 0.5rem;
    user-select: none;
  }

  :global(.ProseMirror ul[data-type='taskList'] li > div) {
    flex: 1 1 auto;
  }

  /* Table styling */
  :global(.ProseMirror table) {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    overflow: hidden;
  }

  :global(.ProseMirror table td, .ProseMirror table th) {
    min-width: 1em;
    border: 1px solid #e5e7eb;
    padding: 3px 5px;
    vertical-align: top;
    box-sizing: border-box;
    position: relative;
  }

  :global(.dark .ProseMirror table td, .dark .ProseMirror table th) {
    border-color: #374151;
  }

  :global(.ProseMirror table th) {
    font-weight: bold;
    text-align: left;
    background-color: #f9fafb;
  }

  :global(.dark .ProseMirror table th) {
    background-color: #1f2937;
  }

  /* Image styling */
  :global(.ProseMirror .image-node-view) {
    text-align: center;
    margin: 1rem 0;
  }

  :global(.ProseMirror .image-node-view img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  :global(.ProseMirror .image-node-view.loading img) {
    opacity: 0.5;
  }

  :global(.ProseMirror .image-node-view.error img) {
    display: none;
  }

  /* SEQTA Content Block styling */
  :global(.seqta-content-block-card) {
    position: relative;
    min-width: 200px;
    min-height: 120px;
  }

  :global(.seqta-content-block-card:hover) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  :global(.seqta-content-block-card.ProseMirror-selectednode) {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    border-color: rgb(59, 130, 246);
  }

  :global(.dark .seqta-content-block-card.ProseMirror-selectednode) {
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
    border-color: rgb(96, 165, 250);
  }

  /* Drag handle styling */
  :global([data-drag-handle]) {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
  }

  :global([data-drag-handle]:active) {
    cursor: grabbing !important;
  }

  /* Resize handle styling */
  :global([data-resize-handle]) {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
  }

  :global([data-resize-handle]:hover) {
    background-color: rgb(59, 130, 246);
    border-color: rgb(37, 99, 235);
  }

  :global(.dark [data-resize-handle]:hover) {
    background-color: rgb(96, 165, 250);
    border-color: rgb(59, 130, 246);
  }
</style>
