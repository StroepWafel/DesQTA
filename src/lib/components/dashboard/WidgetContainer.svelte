<script lang="ts">
  import { Icon, Cog6Tooth, XMark, RectangleStack } from 'svelte-hero-icons';
  import type { WidgetConfig } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import WidgetFactory from './WidgetFactory.svelte';
  import WidgetStackView from './WidgetStackView.svelte';
  import WidgetStackPanel from './WidgetStackPanel.svelte';
  import { tooltip } from '$lib/actions/tooltip';
  import { getDashboardEditContext } from '../../context/dashboardEditContext';
  import { getStackMembers } from '../../utils/widgetLayoutOps';

  interface Props {
    widget: WidgetConfig;
    isEditing: boolean;
    isMobile?: boolean;
    onUpdate?: (updates: Partial<WidgetConfig>) => void;
    onRemove?: () => void;
    onSettings?: (widget: WidgetConfig) => void;
  }

  let {
    widget,
    isEditing = false,
    isMobile = false,
    onUpdate,
    onRemove,
    onSettings,
  }: Props = $props();

  const definition = $derived(widgetRegistry.get(widget.type));
  const minW = $derived(widget.position.minW ?? definition?.minSize.w ?? 1);
  const minH = $derived(widget.position.minH ?? definition?.minSize.h ?? 1);
  const maxW = $derived(widget.position.maxW ?? definition?.maxSize.w ?? 12);
  const maxH = $derived(widget.position.maxH ?? definition?.maxSize.h ?? 12);
  const resizable = $derived(definition?.resizable !== false);
  const hasSettings = $derived(
    !!definition?.settingsSchema && Object.keys(definition.settingsSchema).length > 0,
  );

  const editCtx = getDashboardEditContext();
  const stackMembers = $derived(
    editCtx ? getStackMembers(editCtx.layout().widgets, widget) : [],
  );
  const hasStack = $derived(!!widget.stack || stackMembers.length > 0);
  const showStackPanel = $derived(
    isEditing && editCtx?.openStackPanelId() === widget.id && !!widget.stack,
  );
  const showStackCarousel = $derived(hasStack && stackMembers.length > 0 && !showStackPanel);

  // Two-click arm-then-confirm pattern for remove (replaces native confirm()).
  let removeArmed = $state(false);
  let removeArmTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleSettingsClick(e: MouseEvent) {
    e.stopPropagation();
    if (onSettings) onSettings(widget);
  }

  function handleStackClick(e: MouseEvent) {
    e.stopPropagation();
    if (!editCtx) return;
    if (widget.stack) {
      editCtx.setOpenStackPanelId(widget.id);
    } else {
      void editCtx.createStack(widget.id);
    }
  }

  function closeStackPanel() {
    editCtx?.setOpenStackPanelId(null);
  }

  function handleRemoveClick(e: MouseEvent) {
    e.stopPropagation();
    if (!removeArmed) {
      removeArmed = true;
      removeArmTimeout = setTimeout(() => (removeArmed = false), 2500);
      return;
    }
    if (removeArmTimeout) clearTimeout(removeArmTimeout);
    removeArmed = false;
    onRemove?.();
  }

  // Double-click on widget body opens settings (single-click conflicted with drag-init).
  function handleBodyDblClick(e: MouseEvent) {
    if (!isEditing) return;
    if (hasSettings && onSettings) {
      e.preventDefault();
      onSettings(widget);
    }
  }

  /**
   * Keyboard a11y: arrow keys move by 1 grid unit, Shift+arrow resizes (if resizable).
   * Operates against `onUpdate` so it goes through the same persistence path as drag/resize.
   */
  function handleDragHandleKeydown(e: KeyboardEvent) {
    if (!isEditing || !onUpdate) return;
    const step = 1;
    let nextX = widget.position.x;
    let nextY = widget.position.y;
    let nextW = widget.position.w;
    let nextH = widget.position.h;
    let handled = false;

    if (e.shiftKey && resizable) {
      switch (e.key) {
        case 'ArrowLeft':
          if (nextX > 0 && nextW < maxW) {
            nextX = Math.max(0, nextX - step);
            nextW = Math.min(maxW, nextW + step);
          } else {
            nextW = Math.max(minW, nextW - step);
          }
          handled = true;
          break;
        case 'ArrowRight':
          nextW = Math.min(maxW, nextW + step);
          handled = true;
          break;
        case 'ArrowUp':
          if (nextY > 0 && nextH < maxH) {
            nextY = Math.max(0, nextY - step);
            nextH = Math.min(maxH, nextH + step);
          } else {
            nextH = Math.max(minH, nextH - step);
          }
          handled = true;
          break;
        case 'ArrowDown':
          nextH = Math.min(maxH, nextH + step);
          handled = true;
          break;
      }
    } else {
      switch (e.key) {
        case 'ArrowLeft':
          nextX = Math.max(0, nextX - step);
          handled = true;
          break;
        case 'ArrowRight':
          nextX = Math.min(12 - nextW, nextX + step);
          handled = true;
          break;
        case 'ArrowUp':
          nextY = Math.max(0, nextY - step);
          handled = true;
          break;
        case 'ArrowDown':
          nextY = nextY + step;
          handled = true;
          break;
      }
    }

    if (handled) {
      e.preventDefault();
      onUpdate({
        position: { ...widget.position, x: nextX, y: nextY, w: nextW, h: nextH },
      });
    }
  }
</script>

<div
  class="grid-stack-item widget-container"
  data-gs-id={widget.id}
  data-gs-x={widget.position.x}
  data-gs-y={widget.position.y}
  data-gs-w={widget.position.w}
  data-gs-h={widget.position.h}
  data-gs-min-w={minW}
  data-gs-min-h={minH}
  data-gs-max-w={resizable ? maxW : widget.position.w}
  data-gs-max-h={resizable ? maxH : widget.position.h}
  data-gs-no-resize={!resizable ? 'true' : null}
  role="article"
  aria-label={widget.title || `Widget: ${widget.type}`}>
  <!-- GridStack applies cell gutters via `.grid-stack-item-content` + --gs-item-margin-*.
       Without this wrapper, widgets fill the entire cell and borders touch. -->
  <div class="grid-stack-item-content">
    <div
      class="relative h-full w-full rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_2px_8px_-4px_rgba(0,0,0,0.06)] widget-inner {isEditing
        ? 'widget-editing'
        : ''}">
      <div class="widget-content relative z-0 h-full w-full overflow-hidden rounded-[inherit]">
        {#if showStackCarousel}
          <WidgetStackView host={widget} members={stackMembers} />
        {:else}
          <WidgetFactory {widget} />
        {/if}
      </div>

      {#if isEditing && !showStackPanel}
        <!-- Full-surface drag layer: blocks accidental clicks/typing and restores drag on all widgets
             (timetable headers, notes, timers, etc. no longer steal pointer events). -->
        <div
          class="widget-drag-overlay widget-drag-handle absolute inset-0 z-[150] cursor-grab active:cursor-grabbing rounded-[inherit]"
          tabindex={0}
          role="button"
          ondblclick={handleBodyDblClick}
          onkeydown={handleDragHandleKeydown}
          aria-label={`Drag to move, double-click to configure ${widget.title || widget.type}`}
          use:tooltip={`Drag to move, double-click to configure ${widget.title || widget.type}`}>
        </div>
      {/if}

      {#if isEditing && resizable && !isMobile}
        <div
          class="absolute top-1 left-1 z-[160] w-4 h-4 rounded-sm border-l-2 border-t-2 border-accent-500 pointer-events-none opacity-60"
          aria-hidden="true">
        </div>
        <div
          class="absolute bottom-1 right-1 z-[160] w-4 h-4 rounded-sm border-r-2 border-b-2 border-accent-500 pointer-events-none opacity-60"
          aria-hidden="true">
        </div>
      {/if}
    </div>

    {#if showStackPanel && widget.stack}
      <WidgetStackPanel host={widget} members={stackMembers} onClose={closeStackPanel} />
    {/if}

    {#if isEditing}
      <!-- Edit chrome sits above widget body (timetable export etc. uses z-[100] internally). -->
      <div
        class="absolute top-[5px] right-[5px] z-[20] flex items-center gap-0.5 rounded-md border border-border bg-card px-0.5 py-0.5 shadow-md pointer-events-auto widget-actions"
        onclick={(e) => e.stopPropagation()}
        ondblclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        onpointerdown={(e) => e.stopPropagation()}
        role="toolbar"
        aria-label="Widget actions"
        tabindex="-1">
        {#if hasSettings && onSettings}
          <button
            type="button"
            onclick={handleSettingsClick}
            class="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            aria-label="Settings"
            use:tooltip={'Widget settings'}>
            <Icon src={Cog6Tooth} class="w-3.5 h-3.5" />
          </button>
        {/if}
        {#if editCtx && !widget.stackedIn}
          <button
            type="button"
            onclick={handleStackClick}
            class="inline-flex items-center justify-center w-6 h-6 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 {showStackPanel || hasStack
              ? 'text-accent-500 bg-accent-500/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'}"
            aria-label="Widget stack"
            use:tooltip={'Create or edit widget stack'}>
            <Icon src={RectangleStack} class="w-3.5 h-3.5" />
          </button>
        {/if}
        {#if onRemove}
          <button
            type="button"
            onclick={handleRemoveClick}
            class="inline-flex items-center justify-center w-6 h-6 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive {removeArmed
              ? 'border border-destructive text-destructive bg-destructive/5'
              : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}"
            aria-label={removeArmed ? 'Click again to remove' : 'Remove widget'}
            use:tooltip={removeArmed ? 'Click again to confirm' : 'Remove widget'}>
            <Icon src={XMark} class="w-3.5 h-3.5" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.gs-item.ui-draggable-dragging) {
    opacity: 0.85;
    z-index: 1000;
  }
  :global(.gs-item.ui-resizable-resizing) {
    opacity: 0.9;
  }

  /* Show a quiet dashed accent outline + slow pulse while editing.
     Defined in app.css; activate via class. */
  /*
   * GridStack floats each widget inside its cell via absolute positioning + margin vars.
   * Never add h-full/relative here — height:100% ignores top/bottom inset and kills vertical gaps.
   */
  :global(.grid-stack > .grid-stack-item > .grid-stack-item-content) {
    position: absolute;
    top: var(--gs-item-margin-top);
    right: var(--gs-item-margin-right);
    bottom: var(--gs-item-margin-bottom);
    left: var(--gs-item-margin-left);
    width: auto;
    height: auto;
    padding: 0;
    box-sizing: border-box;
  }

  /* Edit mode: widget body is display-only; overlay handles drag + keyboard move/resize. */
  .widget-editing .widget-content {
    pointer-events: none;
    user-select: none;
  }

  :global(.widget-editing .widget-content *) {
    pointer-events: none !important;
  }

  .widget-drag-overlay {
    touch-action: none;
    background: transparent;
  }

  /* Dashed border follows rounded-xl; outline + overflow-hidden only showed corner arcs. */
  .widget-editing {
    border-style: dashed;
    border-color: var(--accent-color, var(--accent-color-value, #3b82f6));
    animation: lofiPulse 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Edit-mode action chip — above widget-internal layers (e.g. timetable header z-[100]). */
  :global(.widget-actions) {
    z-index: 20;
  }
</style>
