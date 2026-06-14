<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { GridStack } from 'gridstack';
  import 'gridstack/dist/gridstack.min.css';
  import type { WidgetConfig, WidgetLayout, WidgetPosition } from '../../types/widgets';
  import {
    cloneWidgetConfig,
    cloneWidgetLayout,
    widgetService,
  } from '../../services/widgetService';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import WidgetContainer from './WidgetContainer.svelte';
  import { logger } from '../../../utils/logger';
  import { setDashboardEditContext } from '../../context/dashboardEditContext';
  import {
    addWidgetToStackInLayout,
    canSwapWidgets,
    isGridWidget,
    removeWidgetFromStackInLayout,
    swapWidgetPositions,
    isCenterOverWidget,
  } from '../../utils/widgetLayoutOps';

  interface Props {
    isEditing?: boolean;
    isMobile?: boolean;
    onLayoutChange?: (layout: WidgetLayout) => void;
    onWidgetSettings?: (widget: WidgetConfig) => void;
  }

  let { isEditing = false, isMobile = false, onLayoutChange, onWidgetSettings }: Props = $props();

  let gridElement: HTMLDivElement | null = $state(null);
  let grid: GridStack | null = $state(null);
  let layout = $state.raw<WidgetLayout>({
    widgets: [],
    version: 1,
    lastModified: new Date(),
  });
  let renderedWidgets = $state<WidgetConfig[]>([]);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let elementRegistry = new Map<string, HTMLElement>();
  let draggingWidgetId = $state<string | null>(null);
  let stackDropTargetId = $state<string | null>(null);
  let openStackPanelId = $state<string | null>(null);
  const dragOrigins = new Map<string, WidgetPosition>();

  function updateRenderedWidgets() {
    const enabled = layout.widgets
      .filter((widget) => widget.enabled && isGridWidget(widget))
      .map(cloneWidgetConfig);

    if (isMobile) {
      // Mobile: order by registry `mobileOrder` (falls back to insertion order)
      enabled.sort((a, b) => {
        const defA = widgetRegistry.get(a.type);
        const defB = widgetRegistry.get(b.type);
        const orderA = defA?.mobileOrder ?? 100;
        const orderB = defB?.mobileOrder ?? 100;
        return orderA - orderB;
      });
    }

    renderedWidgets = enabled;
  }

  function commitLayout(nextLayout: WidgetLayout, options?: { refreshGrid?: boolean }) {
    layout = cloneWidgetLayout(nextLayout);
    if (options?.refreshGrid !== false) {
      updateRenderedWidgets();
    }
  }

  function patchLayout(
    mutator: (draft: WidgetLayout) => void,
    options?: { refreshGrid?: boolean },
  ) {
    const draft = cloneWidgetLayout(layout);
    mutator(draft);
    draft.lastModified = new Date();
    commitLayout(draft, options);
  }

  function getWidgetIndex(widgetId: string, source: WidgetConfig[] = layout.widgets): number {
    return source.findIndex((widget) => widget.id === widgetId);
  }

  /**
   * Resolve the desktop grid placement bounds for a widget from the registry
   * (single source of truth, replacing the old hardcoded snap presets).
   */
  function getGridItem(widget: WidgetConfig) {
    const definition = widgetRegistry.get(widget.type);
    const minW = widget.position.minW ?? definition?.minSize.w ?? 1;
    const minH = widget.position.minH ?? definition?.minSize.h ?? 1;
    const maxW = widget.position.maxW ?? definition?.maxSize.w ?? 12;
    const maxH = widget.position.maxH ?? definition?.maxSize.h ?? 12;
    const resizable = definition?.resizable !== false;

    return {
      x: widget.position.x,
      y: widget.position.y,
      w: Math.max(minW, Math.min(maxW, widget.position.w)),
      h: Math.max(minH, Math.min(maxH, widget.position.h)),
      minW,
      minH,
      maxW: resizable ? maxW : widget.position.w,
      maxH: resizable ? maxH : widget.position.h,
      noResize: !resizable,
    };
  }

  function collectRenderedElements() {
    elementRegistry.clear();
    if (!gridElement) return;
    const elements = Array.from(gridElement.querySelectorAll('.grid-stack-item')) as HTMLElement[];
    for (const element of elements) {
      const widgetId = element.getAttribute('data-gs-id');
      if (widgetId) {
        elementRegistry.set(widgetId, element);
      }
    }
  }

  async function waitForRenderedElements(widgetIds: string[]) {
    for (let attempt = 0; attempt < 4; attempt++) {
      collectRenderedElements();
      const missing = widgetIds.filter((id) => !elementRegistry.has(id));
      if (missing.length === 0) return;
      await tick();
    }
    collectRenderedElements();
  }

  function findSwapTarget(
    dragged: WidgetConfig,
    draggedPos: WidgetPosition,
  ): WidgetConfig | null {
    for (const candidate of layout.widgets) {
      if (!isGridWidget(candidate)) continue;
      if (candidate.id === dragged.id) continue;
      if (isCenterOverWidget(dragged, candidate, draggedPos)) {
        return candidate;
      }
    }
    return null;
  }

  function detectStackDropTarget(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    const drop = el?.closest('[data-stack-drop]') as HTMLElement | null;
    return drop?.getAttribute('data-stack-drop') ?? null;
  }

  async function applyLayoutDraft(draft: WidgetLayout) {
    commitLayout(draft);
    await tick();
    if (!isMobile) await reconcileGrid();
    schedulePersist();
  }

  async function handleAddToStack(hostId: string, memberId: string) {
    const draft = cloneWidgetLayout(layout);
    const placed = draft.widgets.filter(isGridWidget);
    if (!addWidgetToStackInLayout(draft.widgets, hostId, memberId)) return;
    draft.lastModified = new Date();
    stackDropTargetId = null;
    draggingWidgetId = null;
    await applyLayoutDraft(draft);
  }

  async function handleRemoveFromStack(memberId: string) {
    const draft = cloneWidgetLayout(layout);
    const placed = draft.widgets.filter(isGridWidget);
    if (!removeWidgetFromStackInLayout(draft.widgets, memberId, placed)) return;
    draft.lastModified = new Date();
    await applyLayoutDraft(draft);
  }

  async function handleSetStackActiveIndex(hostId: string, index: number) {
    const draft = cloneWidgetLayout(layout);
    const host = draft.widgets.find((w) => w.id === hostId);
    if (!host?.stack) return;
    host.stack.activeIndex = Math.max(0, Math.min(index, host.stack.memberIds.length));
    draft.lastModified = new Date();
    commitLayout(draft, { refreshGrid: false });
    schedulePersist();
  }

  async function handleCreateStack(hostId: string) {
    const draft = cloneWidgetLayout(layout);
    const host = draft.widgets.find((w) => w.id === hostId);
    if (!host || host.stackedIn) return;
    if (!host.stack) {
      host.stack = { memberIds: [], activeIndex: 0 };
    }
    draft.lastModified = new Date();
    openStackPanelId = hostId;
    commitLayout(draft, { refreshGrid: false });
    schedulePersist();
  }

  setDashboardEditContext({
    isEditing: () => isEditing,
    layout: () => layout,
    getWidgetById: (id) => layout.widgets.find((w) => w.id === id),
    draggingWidgetId: () => draggingWidgetId,
    stackDropTargetId: () => stackDropTargetId,
    openStackPanelId: () => openStackPanelId,
    setOpenStackPanelId: (id) => {
      openStackPanelId = id;
    },
    setStackDropTargetId: (id) => {
      stackDropTargetId = id;
    },
    addToStack: handleAddToStack,
    removeFromStack: handleRemoveFromStack,
    setStackActiveIndex: handleSetStackActiveIndex,
    createStack: handleCreateStack,
  });

  function trySwapOrRevertOnDrop(el: HTMLElement) {
    const widgetId = el.getAttribute('data-gs-id');
    if (!widgetId) return false;

    const origin = dragOrigins.get(widgetId);
    dragOrigins.delete(widgetId);
    if (!origin) return false;

    const node = (el as HTMLElement & { gridstackNode?: WidgetPosition }).gridstackNode;
    const newPos: WidgetPosition = {
      x: node?.x ?? origin.x,
      y: node?.y ?? origin.y,
      w: node?.w ?? origin.w,
      h: node?.h ?? origin.h,
    };

    const draft = cloneWidgetLayout(layout);
    const dragged = draft.widgets.find((w) => w.id === widgetId);
    if (!dragged) return false;

    const target = findSwapTarget(dragged, newPos);
    if (!target) {
      // Revert to origin if no valid placement change
      if (
        newPos.x === origin.x &&
        newPos.y === origin.y &&
        newPos.w === origin.w &&
        newPos.h === origin.h
      ) {
        return false;
      }
      return false;
    }

    const targetInDraft = draft.widgets.find((w) => w.id === target.id);
    if (!targetInDraft || !canSwapWidgets(dragged, targetInDraft, origin)) {
      // Invalid swap — snap back to origin silently
      dragged.position = { ...dragged.position, ...origin };
      if (grid) {
        grid.update(el, getGridItem(dragged));
      }
      patchLayout(
        (d) => {
          const w = d.widgets.find((entry) => entry.id === widgetId);
          if (w) w.position = { ...w.position, ...origin };
        },
        { refreshGrid: false },
      );
      return true;
    }

    swapWidgetPositions(dragged, targetInDraft, origin);
    draft.lastModified = new Date();
    void applyLayoutDraft(draft);
    return true;
  }

  function schedulePersist() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      saveTimeout = null;
      try {
        await widgetService.saveLayout(layout);
        onLayoutChange?.(layout);
      } catch (error) {
        logger.error('WidgetGrid', 'schedulePersist', `Failed to save layout: ${error}`, { error });
      }
    }, 350);
  }

  async function flushPendingSave() {
    if (!saveTimeout) return;
    clearTimeout(saveTimeout);
    saveTimeout = null;
    try {
      await widgetService.saveLayout(layout);
      onLayoutChange?.(layout);
    } catch (error) {
      logger.error('WidgetGrid', 'flushPendingSave', `Failed to save layout: ${error}`, { error });
    }
  }

  type GridSyncItem = {
    el?: HTMLElement;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };

  function normalizeGridSyncItems(itemsOrEl: unknown): GridSyncItem[] {
    if (!itemsOrEl) return [];
    if (Array.isArray(itemsOrEl)) return itemsOrEl as GridSyncItem[];
    if (itemsOrEl instanceof HTMLElement) {
      const node = (itemsOrEl as HTMLElement & { gridstackNode?: GridSyncItem }).gridstackNode;
      if (node) return [{ el: itemsOrEl, x: node.x, y: node.y, w: node.w, h: node.h }];
      return [
        {
          el: itemsOrEl,
          x: Number(itemsOrEl.getAttribute('data-gs-x')) || undefined,
          y: Number(itemsOrEl.getAttribute('data-gs-y')) || undefined,
          w: Number(itemsOrEl.getAttribute('data-gs-w')) || undefined,
          h: Number(itemsOrEl.getAttribute('data-gs-h')) || undefined,
        },
      ];
    }
    return [];
  }

  function syncPositionsFromGrid(itemsOrEl: unknown) {
    const items = normalizeGridSyncItems(itemsOrEl);
    if (!items.length) return;

    patchLayout(
      (draft) => {
        for (const item of items) {
          const widgetId = item.el?.getAttribute?.('data-gs-id');
          if (!widgetId) continue;
          const index = getWidgetIndex(widgetId, draft.widgets);
          if (index === -1) continue;
          const widget = draft.widgets[index];
          widget.position = {
            ...widget.position,
            x: item.x ?? widget.position.x,
            y: item.y ?? widget.position.y,
            w: item.w ?? widget.position.w,
            h: item.h ?? widget.position.h,
          };
        }
      },
      { refreshGrid: false },
    );

    schedulePersist();
  }

  const GRID_MARGIN = 6;
  const RESIZE_HANDLES = 'nw, n, ne, e, se, s, sw, w';

  function initializeGrid() {
    if (!gridElement || isMobile) return;

    if (grid) {
      grid.destroy(false);
      grid = null;
    }

    const canEdit = isEditing;

    grid = GridStack.init(
      {
        column: 12,
        cellHeight: 80,
        // Uniform gutter — same gap horizontally and vertically.
        margin: GRID_MARGIN,
        resizable: {
          handles: RESIZE_HANDLES,
        },
        draggable: {
          // Grab anywhere on the widget body in edit mode.
          handle: canEdit ? '.widget-drag-handle' : '.none',
        },
        disableResize: !canEdit,
        disableDrag: !canEdit,
        float: false,
        // Let GridStack own its animation; no CSS transition fight.
        animate: true,
        minRow: 1,
      },
      gridElement,
    );

    // Add/remove `is-dragging` / `is-resizing` classes on the moving element so
    // WidgetContainer overlay blocks inner UI in edit mode; drag uses .widget-drag-handle overlay.
    grid.on('dragstart', (_event, el: HTMLElement) => {
      el.classList.add('is-dragging');
      gridElement?.classList.add('grid-dragging');
      const widgetId = el.getAttribute('data-gs-id');
      if (widgetId) {
        draggingWidgetId = widgetId;
        const w = layout.widgets.find((entry) => entry.id === widgetId);
        if (w) {
          dragOrigins.set(widgetId, { ...w.position });
        }
      }
    });
    grid.on('drag', (event: Event) => {
      const e = event as MouseEvent & { clientX?: number; clientY?: number };
      const cx = e.clientX ?? 0;
      const cy = e.clientY ?? 0;
      if (cx && cy) {
        stackDropTargetId = detectStackDropTarget(cx, cy);
      }
    });
    grid.on('dragstop', (_event, el: HTMLElement) => {
      el.classList.remove('is-dragging');
      gridElement?.classList.remove('grid-dragging');
      const widgetId = el.getAttribute('data-gs-id');
      const dropHostId = stackDropTargetId;

      draggingWidgetId = null;
      stackDropTargetId = null;

      if (dropHostId && widgetId && dropHostId !== widgetId) {
        dragOrigins.delete(widgetId);
        const origin = layout.widgets.find((w) => w.id === widgetId)?.position;
        if (origin && grid) {
          grid.update(el, getGridItem({ ...layout.widgets.find((w) => w.id === widgetId)!, position: origin }));
        }
        void handleAddToStack(dropHostId, widgetId);
        return;
      }

      requestAnimationFrame(() => {
        if (trySwapOrRevertOnDrop(el)) return;
        syncPositionsFromGrid(el);
      });
    });
    grid.on('resizestart', (_event, el: HTMLElement) => {
      el.classList.add('is-resizing');
    });
    grid.on('resizestop', (_event, el: HTMLElement) => {
      el.classList.remove('is-resizing');
      requestAnimationFrame(() => syncPositionsFromGrid(el));
    });
  }

  async function reconcileGrid() {
    if (!grid || !gridElement || isMobile) return;

    const widgetIds = renderedWidgets.map((widget) => widget.id);
    await waitForRenderedElements(widgetIds);

    const currentIds = new Set(widgetIds);
    const registeredIds = new Set(elementRegistry.keys());

    const removedIds = Array.from(registeredIds).filter((id) => !currentIds.has(id));
    if (removedIds.length > 0) {
      grid.batchUpdate(true);
      for (const widgetId of removedIds) {
        const element = elementRegistry.get(widgetId);
        if (element) {
          grid.removeWidget(element, false);
          elementRegistry.delete(widgetId);
        }
      }
      grid.batchUpdate(false);
    }

    grid.batchUpdate(true);
    for (const widget of renderedWidgets) {
      const element = elementRegistry.get(widget.id);
      if (!element) {
        logger.warn('WidgetGrid', 'reconcileGrid', `Widget ${widget.id} element not found`);
        continue;
      }
      const gridItem = getGridItem(widget);
      const isRegistered = (element as any).gridstackNode !== undefined;
      if (!isRegistered) {
        grid.makeWidget(element);
      }
      grid.update(element, gridItem);
    }
    grid.batchUpdate(false);
  }

  async function loadPersistedLayout() {
    try {
      const loadedLayout = await widgetService.loadLayout();
      commitLayout(loadedLayout);
    } catch (error) {
      logger.error('WidgetGrid', 'loadPersistedLayout', `Failed to load layout: ${error}`, {
        error,
      });
      commitLayout(widgetService.getDefaultLayout());
    }
  }

  async function applyPatchedLayout(
    nextLayout: WidgetLayout,
    options: { persist?: boolean; scrollToWidgetId?: string | null; scrollToTop?: boolean } = {},
  ) {
    commitLayout(nextLayout);
    await tick();
    if (!isMobile) await reconcileGrid();

    if (options.persist !== false) {
      schedulePersist();
    }

    if (options.scrollToWidgetId) {
      await scrollToWidget(options.scrollToWidgetId);
    } else if (options.scrollToTop) {
      await scrollToTop();
    }
  }

  async function handleWidgetUpdate(widgetId: string, updates: Partial<WidgetConfig>) {
    const nextLayout = widgetService.updateWidgetInLayout(layout, widgetId, updates);
    await applyPatchedLayout(nextLayout);
  }

  async function handleWidgetRemove(widgetId: string) {
    const nextLayout = widgetService.removeWidgetFromLayout(layout, widgetId);
    await applyPatchedLayout(nextLayout);
  }

  let wasGridEditing = false;

  $effect(() => {
    if (!grid || isMobile) return;
    const canEdit = isEditing;
    grid.enableMove(canEdit);
    grid.enableResize(canEdit);
    grid.opts.disableDrag = !canEdit;
    grid.opts.disableResize = !canEdit;
    grid.opts.draggable = { handle: canEdit ? '.widget-drag-handle' : '.none' };
    grid.opts.resizable = { handles: RESIZE_HANDLES };

    if (wasGridEditing && !canEdit) {
      void flushPendingSave();
    }
    wasGridEditing = canEdit;
  });

  async function scrollToWidget(widgetId: string) {
    if (!gridElement) return;
    await tick();
    const widgetElement = gridElement.querySelector(
      `[data-gs-id="${widgetId}"]`,
    ) as HTMLElement | null;
    widgetElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  async function scrollToTop() {
    if (!gridElement) return;
    await tick();
    const main = gridElement.closest('main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      gridElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }
  }

  async function reloadLayout(widgetIdToScroll?: string) {
    const latestLayout = await widgetService.loadLayout();
    await applyPatchedLayout(latestLayout, {
      persist: false,
      scrollToWidgetId: widgetIdToScroll ?? null,
      scrollToTop: !widgetIdToScroll,
    });
  }

  export { reloadLayout };

  onMount(async () => {
    await loadPersistedLayout();
    if (!isMobile) {
      initializeGrid();
      await tick();
      await reconcileGrid();
    }
  });

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (grid) {
      grid.destroy(false);
      grid = null;
    }
  });

  // Mobile height per widget, derived from registry mobileSize.h (in grid units).
  // We treat the unit as ~80px for visual consistency.
  function mobileHeightFor(widget: WidgetConfig): number {
    const def = widgetRegistry.get(widget.type);
    const h = def?.mobileSize?.h ?? def?.defaultSize.h ?? widget.position.h ?? 4;
    return h * 80;
  }
</script>

{#if isMobile}
  <!-- Mobile: vertical stack ordered by mobileOrder. No drag/resize. -->
  <div class="flex flex-col gap-3 px-1" aria-label="Dashboard widgets" role="main">
    {#each renderedWidgets as widget (widget.id)}
      <div style="height: {mobileHeightFor(widget)}px; min-height: 200px;" class="w-full">
        <WidgetContainer
          {widget}
          {isEditing}
          {isMobile}
          onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
          onRemove={() => handleWidgetRemove(widget.id)}
          onSettings={onWidgetSettings} />
      </div>
    {/each}
  </div>
{:else}
  <div
    bind:this={gridElement}
    class="grid-stack {isEditing ? 'grid-editing' : ''}"
    role="main"
    aria-label="Dashboard widgets"
    aria-live="polite"
    aria-atomic="false">
    {#each renderedWidgets as widget (widget.id)}
      <WidgetContainer
        {widget}
        {isEditing}
        {isMobile}
        onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
        onRemove={() => handleWidgetRemove(widget.id)}
        onSettings={onWidgetSettings} />
    {/each}
  </div>
{/if}

<style>
  :global(.grid-stack) {
    width: 100%;
    position: relative;
    --gs-item-margin-top: 6px;
    --gs-item-margin-right: 6px;
    --gs-item-margin-bottom: 6px;
    --gs-item-margin-left: 6px;
  }
  :global(.grid-stack > .grid-stack-item) {
    position: absolute;
  }
  :global(.grid-stack > .grid-stack-item > .ui-resizable-handle) {
    position: absolute;
  }

  /* Edit mode: show the 12×80px grid so users see snap targets and gutters. */
  :global(.grid-stack.grid-editing) {
    border-radius: 0.75rem;
    background-color: color-mix(in srgb, var(--surface-muted) 65%, transparent);
    background-image:
      repeating-linear-gradient(
        to right,
        color-mix(in srgb, var(--border-strong) 55%, transparent) 0,
        color-mix(in srgb, var(--border-strong) 55%, transparent) 1px,
        transparent 1px,
        transparent calc(100% / 12)
      ),
      repeating-linear-gradient(
        to bottom,
        color-mix(in srgb, var(--border-strong) 40%, transparent) 0,
        color-mix(in srgb, var(--border-strong) 40%, transparent) 1px,
        transparent 1px,
        transparent 80px
      );
  }

  /* While dragging, accent-tint the grid lines for extra feedback. */
  :global(.grid-stack.grid-editing.grid-dragging) {
    background-image:
      repeating-linear-gradient(
        to right,
        color-mix(in srgb, var(--accent-color-value, #3b82f6) 22%, transparent) 0,
        color-mix(in srgb, var(--accent-color-value, #3b82f6) 22%, transparent) 1px,
        transparent 1px,
        transparent calc(100% / 12)
      ),
      repeating-linear-gradient(
        to bottom,
        color-mix(in srgb, var(--accent-color-value, #3b82f6) 16%, transparent) 0,
        color-mix(in srgb, var(--accent-color-value, #3b82f6) 16%, transparent) 1px,
        transparent 1px,
        transparent 80px
      );
  }
</style>
