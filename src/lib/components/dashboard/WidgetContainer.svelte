<script lang="ts">
  import { Icon, Cog6Tooth, XMark, Bars3 } from 'svelte-hero-icons';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import type { WidgetConfig } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import WidgetFactory from './WidgetFactory.svelte';
  import { tick } from 'svelte';

  interface Props {
    widget: WidgetConfig;
    isEditing: boolean;
    onUpdate?: (updates: Partial<WidgetConfig>) => void;
    onRemove?: () => void;
    onSettings?: (widget: WidgetConfig) => void;
  }

  let { widget, isEditing = false, onUpdate, onRemove, onSettings }: Props = $props();

  let containerElement: HTMLDivElement | null = $state(null);

  // Set GridStack attributes after mount
  $effect(() => {
    if (containerElement && widget) {
      tick().then(() => {
        containerElement?.setAttribute('data-gs-x', widget.position.x.toString());
        containerElement?.setAttribute('data-gs-y', widget.position.y.toString());
        containerElement?.setAttribute('data-gs-w', widget.position.w.toString());
        containerElement?.setAttribute('data-gs-h', widget.position.h.toString());

        const definition = widgetRegistry.get(widget.type);
        containerElement?.setAttribute(
          'data-gs-min-w',
          (widget.position.minW || definition?.minSize.w || 1).toString(),
        );
        containerElement?.setAttribute(
          'data-gs-min-h',
          (widget.position.minH || definition?.minSize.h || 1).toString(),
        );
        containerElement?.setAttribute(
          'data-gs-max-w',
          (widget.position.maxW || definition?.maxSize.w || 12).toString(),
        );
        containerElement?.setAttribute(
          'data-gs-max-h',
          (widget.position.maxH || definition?.maxSize.h || 12).toString(),
        );
      });
    }
  });

  function handleSettingsClick(e: MouseEvent) {
    e.stopPropagation();
    if (onSettings) {
      onSettings(widget);
    }
  }

  function handleRemoveClick(e: MouseEvent) {
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isEditing) return;

    // Arrow keys for moving widgets in edit mode
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault();
      // GridStack will handle the movement
    }

    // Delete key to remove widget
    if (e.key === 'Delete' && onRemove) {
      e.preventDefault();
      onRemove();
    }

    // Enter key to open settings
    if (e.key === 'Enter' && onSettings) {
      e.preventDefault();
      onSettings(widget);
    }
  }

  // Handle keyboard events on the drag handle when focused
  function handleDragHandleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Allow GridStack to handle drag via keyboard
    }
  }
</script>

<div
  bind:this={containerElement}
  class="grid-stack-item widget-container"
  data-gs-id={widget.id}
  role="article"
  aria-label={widget.title || `Widget: ${widget.type}`}>
  <!-- Inner wrapper for smooth hover scale -->
  <div
    class="group relative bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md overflow-hidden h-full w-full widget-inner"
    style="transform-origin: center center;">
    <!-- Drag Handle -->
    {#if isEditing}
      <div
        class="gs-resize-handle gs-resize-handle-top absolute top-0 left-0 right-0 h-8 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between px-2 cursor-move z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] transform translate-y-[-4px] group-hover:translate-y-0"
        data-gs-handle=".gs-resize-handle-top"
        role="button"
        aria-label="Drag handle for {widget.title || widget.type} widget"
        tabindex="0"
        onkeydown={handleDragHandleKeydown}>
        <div class="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Icon src={Bars3} class="w-4 h-4" />
          <span class="text-xs font-medium">{widget.title || widget.type}</span>
        </div>
        <div class="flex items-center gap-1">
          {#if onSettings}
            <button
              onclick={handleSettingsClick}
              class="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              aria-label="Open settings for {widget.title || widget.type} widget"
              title="Settings">
              <Icon src={Cog6Tooth} class="w-4 h-4" />
            </button>
          {/if}
          {#if onRemove}
            <button
              onclick={handleRemoveClick}
              class="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Remove {widget.title || widget.type} widget"
              title="Remove widget">
              <Icon src={XMark} class="w-4 h-4" />
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Widget Content -->
    <div
      class="h-full w-full p-3 sm:p-4 md:p-6 flex flex-col {isEditing
        ? 'pt-10'
        : ''} transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
      <WidgetFactory {widget} />
    </div>
  </div>
  <!-- Resize Handles (GridStack will add these automatically when isEditing) -->
</div>

<style>
  :global(.gs-item.ui-draggable-dragging) {
    opacity: 0.85;
    z-index: 1000;
    transform: scale(1.02);
    transition:
      opacity 200ms cubic-bezier(0.4, 0, 0.2, 1),
      transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(.gs-item.ui-resizable-resizing) {
    opacity: 0.9;
    transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(.gs-resize-handle) {
    background: transparent;
  }

  :global(.gs-resize-handle.gs-resize-handle-right),
  :global(.gs-resize-handle.gs-resize-handle-left) {
    width: 8px;
    cursor: ew-resize;
  }

  :global(.gs-resize-handle.gs-resize-handle-top),
  :global(.gs-resize-handle.gs-resize-handle-bottom) {
    height: 8px;
    cursor: ns-resize;
  }

  :global(.gs-resize-handle.gs-resize-handle-top-right),
  :global(.gs-resize-handle.gs-resize-handle-top-left),
  :global(.gs-resize-handle.gs-resize-handle-bottom-right),
  :global(.gs-resize-handle.gs-resize-handle-bottom-left) {
    width: 16px;
    height: 16px;
  }

  :global(.gs-resize-handle.gs-resize-handle-top-right) {
    cursor: nesw-resize;
  }

  :global(.gs-resize-handle.gs-resize-handle-top-left) {
    cursor: nwse-resize;
  }

  :global(.gs-resize-handle.gs-resize-handle-bottom-right) {
    cursor: nwse-resize;
  }

  :global(.gs-resize-handle.gs-resize-handle-bottom-left) {
    cursor: nesw-resize;
  }

  /* Smooth widget inner hover animation - wrapper approach to avoid GridStack conflicts */
  :global(.widget-inner) {
    transform-origin: center center;
    transition:
      transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }

  /* Apply scale on hover to inner wrapper */
  :global(
    .widget-container:hover:not(.ui-draggable-dragging):not(.ui-resizable-resizing) .widget-inner
  ) {
    transform: scale(1.01);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  /* Ensure GridStack's position changes transition smoothly */
  :global(.grid-stack-item.widget-container) {
    transition:
      left 300ms cubic-bezier(0.4, 0, 0.2, 1),
      top 300ms cubic-bezier(0.4, 0, 0.2, 1),
      width 300ms cubic-bezier(0.4, 0, 0.2, 1),
      height 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
