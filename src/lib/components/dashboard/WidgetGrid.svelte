<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { GridStack } from 'gridstack';
  import 'gridstack/dist/gridstack.min.css';
  import type { WidgetConfig, WidgetLayout } from '../../types/widgets';
  import { widgetService } from '../../services/widgetService';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import WidgetContainer from './WidgetContainer.svelte';
  import { logger } from '../../../utils/logger';

  interface Props {
    isEditing?: boolean;
    isMobile?: boolean;
    onLayoutChange?: (layout: WidgetLayout) => void;
    onWidgetSettings?: (widget: WidgetConfig) => void;
  }

  let { isEditing = false, isMobile = false, onLayoutChange, onWidgetSettings }: Props = $props();

  let gridElement: HTMLDivElement | null = $state(null);
  let grid: GridStack | null = $state(null);
  let layout = $state.raw<WidgetLayout>({ widgets: [], version: 1, lastModified: new Date() });
  let renderedWidgets = $state<WidgetConfig[]>([]);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let elementRegistry = new Map<string, HTMLElement>();

  const PRESET_WIDTHS = [3, 4, 6, 8, 12];
  const PRESET_HEIGHTS = [4, 5, 6, 8, 10];

  function snapToPreset(value: number, presets: number[]): number {
    return presets.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
    );
  }

  function cloneWidget(widget: WidgetConfig): WidgetConfig {
    return {
      ...widget,
      position: { ...widget.position },
      settings: widget.settings ? { ...widget.settings } : undefined,
    };
  }

  function cloneLayout(nextLayout: WidgetLayout): WidgetLayout {
    return {
      ...nextLayout,
      widgets: Array.isArray(nextLayout.widgets) ? nextLayout.widgets.map(cloneWidget) : [],
      lastModified:
        typeof nextLayout.lastModified === 'string'
          ? new Date(nextLayout.lastModified)
          : new Date(nextLayout.lastModified),
    };
  }

  function updateRenderedWidgets() {
    renderedWidgets = layout.widgets.filter((widget) => widget.enabled).map(cloneWidget);
  }

  function commitLayout(nextLayout: WidgetLayout) {
    layout = cloneLayout(nextLayout);
    updateRenderedWidgets();
  }

  function patchLayout(mutator: (draft: WidgetLayout) => void) {
    const draft = cloneLayout(layout);
    mutator(draft);
    draft.lastModified = new Date();
    commitLayout(draft);
  }

  function getWidgetIndex(widgetId: string, source: WidgetConfig[] = layout.widgets): number {
    return source.findIndex((widget) => widget.id === widgetId);
  }

  function getGridItem(widget: WidgetConfig) {
    const definition = widgetRegistry.get(widget.type);

    return {
      x: isMobile ? 0 : widget.position.x,
      y: widget.position.y,
      w: isMobile ? 1 : widget.position.w,
      h: isMobile ? Math.max(widget.position.h, 2) : widget.position.h,
      minW: isMobile ? 1 : (widget.position.minW ?? definition?.minSize.w ?? 1),
      minH: widget.position.minH ?? definition?.minSize.h ?? 1,
      maxW: isMobile ? 1 : (widget.position.maxW ?? definition?.maxSize.w ?? 12),
      maxH: widget.position.maxH ?? definition?.maxSize.h ?? 12,
    };
  }

  function applyGridItemAttributes(element: HTMLElement, widget: WidgetConfig) {
    const gridItem = getGridItem(widget);
    element.setAttribute('data-gs-id', widget.id);
    element.setAttribute('data-gs-x', gridItem.x.toString());
    element.setAttribute('data-gs-y', gridItem.y.toString());
    element.setAttribute('data-gs-w', gridItem.w.toString());
    element.setAttribute('data-gs-h', gridItem.h.toString());
    element.setAttribute('data-gs-min-w', gridItem.minW.toString());
    element.setAttribute('data-gs-min-h', gridItem.minH.toString());
    element.setAttribute('data-gs-max-w', gridItem.maxW.toString());
    element.setAttribute('data-gs-max-h', gridItem.maxH.toString());
  }

  function collectRenderedElements() {
    elementRegistry.clear();

    if (!gridElement) {
      return;
    }

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
      const missingIds = widgetIds.filter((widgetId) => !elementRegistry.has(widgetId));
      if (missingIds.length === 0) {
        return;
      }

      await tick();
    }

    collectRenderedElements();
  }

  function schedulePersist() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        await widgetService.saveLayout(layout);
        onLayoutChange?.(layout);
      } catch (error) {
        logger.error('WidgetGrid', 'schedulePersist', `Failed to save layout: ${error}`, {
          error,
        });
      }
    }, 350);
  }

  function syncPositionsFromGrid(items: any[], source: 'dragstop' | 'resizestop' | 'destroy') {
    if (!items.length) return;

    patchLayout((draft) => {
      for (const item of items) {
        const widgetId = item.el?.getAttribute?.('data-gs-id');
        if (!widgetId) continue;

        const index = getWidgetIndex(widgetId, draft.widgets);
        if (index === -1) continue;

        const widget = draft.widgets[index];
        const nextW = snapToPreset(item.w ?? widget.position.w, PRESET_WIDTHS);
        const nextH = snapToPreset(item.h ?? widget.position.h, PRESET_HEIGHTS);

        widget.position = {
          ...widget.position,
          x: item.x ?? widget.position.x,
          y: item.y ?? widget.position.y,
          w: nextW,
          h: nextH,
        };
      }
    });

    if (source !== 'destroy') {
      schedulePersist();
    }
  }

  function initializeGrid() {
    if (!gridElement) return;

    if (grid) {
      grid.destroy(false);
      grid = null;
    }

    const column = isMobile ? 1 : 12;
    const cellHeight = isMobile ? 60 : 80;
    const canEdit = isEditing && !isMobile;

    grid = GridStack.init(
      {
        column,
        cellHeight,
        margin: isMobile ? 12 : 16,
        resizable: {
          handles: canEdit ? 'e, se, s, sw, w' : '',
        },
        draggable: {
          handle: canEdit ? '.gs-resize-handle-top' : '.none',
        },
        disableResize: !canEdit,
        disableDrag: !canEdit,
        float: false,
        animate: !canEdit,
        minRow: 1,
      },
      gridElement,
    );

    grid.on('resize', (_event, items: any[] = []) => {
      for (const item of items) {
        if (!item.el || item.w == null || item.h == null) continue;

        const snappedW = snapToPreset(item.w, PRESET_WIDTHS);
        const snappedH = snapToPreset(item.h, PRESET_HEIGHTS);
        if (snappedW === item.w && snappedH === item.h) continue;

        requestAnimationFrame(() => {
          grid?.update(item.el, { w: snappedW, h: snappedH });
        });
      }
    });

    grid.on('dragstop', (_event, items: any[] = []) => {
      syncPositionsFromGrid(items, 'dragstop');
    });

    grid.on('resizestop', (_event, items: any[] = []) => {
      syncPositionsFromGrid(items, 'resizestop');
    });

  }

  async function reconcileGrid() {
    if (!grid || !gridElement) return;

    const widgetIds = renderedWidgets.map((widget) => widget.id);
    await waitForRenderedElements(widgetIds);

    const currentIds = new Set(widgetIds);
    const registeredIds = new Set(elementRegistry.keys());

    const removedIds = Array.from(registeredIds).filter((widgetId) => !currentIds.has(widgetId));
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

      applyGridItemAttributes(element, widget);
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
      logger.debug('WidgetGrid', 'loadPersistedLayout', 'Layout loaded successfully', {
        widgetCount: loadedLayout.widgets.length,
      });
    } catch (error) {
      logger.error('WidgetGrid', 'loadPersistedLayout', `Failed to load layout: ${error}`, { error });
      commitLayout(widgetService.getDefaultLayout());
    }
  }

  async function applyPatchedLayout(
    nextLayout: WidgetLayout,
    options: { persist?: boolean; scrollToWidgetId?: string | null; scrollToTop?: boolean } = {},
  ) {
    commitLayout(nextLayout);
    await tick();
    await reconcileGrid();

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
    await widgetService.saveLayout(nextLayout);
    await applyPatchedLayout(nextLayout, { persist: false });
  }

  async function handleWidgetRemove(widgetId: string) {
    const nextLayout = widgetService.removeWidgetFromLayout(layout, widgetId);
    await widgetService.saveLayout(nextLayout);
    await applyPatchedLayout(nextLayout, { persist: false });
  }

  $effect(() => {
    if (!grid) return;

    const canEdit = isEditing && !isMobile;
    grid.enableMove(canEdit);
    grid.enableResize(canEdit);
    grid.opts.disableDrag = !canEdit;
    grid.opts.disableResize = !canEdit;
    grid.opts.draggable = {
      handle: canEdit ? '.gs-resize-handle-top' : '.none',
    };
    grid.opts.animate = !canEdit;
  });

  async function scrollToWidget(widgetId: string) {
    if (!gridElement) return;

    await tick();
    const widgetElement = gridElement.querySelector(`[data-gs-id="${widgetId}"]`) as HTMLElement | null;
    widgetElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
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
    initializeGrid();
    await tick();
    await reconcileGrid();
  });

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    if (grid && gridElement) {
      const gridItems = grid.save(false) as Array<{ id?: string; x?: number; y?: number; w?: number; h?: number }>;
      syncPositionsFromGrid(
        gridItems
          .map((item) => {
            const widgetId = item.id;
            if (!widgetId) return null;
            const el = gridElement?.querySelector(`[data-gs-id="${widgetId}"]`) as HTMLElement | null;
            if (!el) return null;

            return {
              el,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            };
          })
          .filter(Boolean) as any[],
        'destroy',
      );

      widgetService.saveLayout(layout).catch((error) => {
        logger.error('WidgetGrid', 'onDestroy', `Failed to save layout on destroy: ${error}`, {
          error,
        });
      });

      grid.destroy(false);
      grid = null;
    }

  });
</script>

<div
  bind:this={gridElement}
  class="grid-stack"
  role="main"
  aria-label="Dashboard widgets"
  aria-live="polite"
  aria-atomic="false">
  {#each renderedWidgets as widget (widget.id)}
    <WidgetContainer
      {widget}
      {isEditing}
      onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
      onRemove={() => handleWidgetRemove(widget.id)}
      onSettings={onWidgetSettings} />
  {/each}
</div>

<style>
  :global(.grid-stack) {
    width: 100%;
  }

  :global(.grid-stack > .grid-stack-item) {
    position: absolute;
  }

  :global(.grid-stack > .grid-stack-item > .ui-resizable-handle) {
    position: absolute;
  }
</style>
