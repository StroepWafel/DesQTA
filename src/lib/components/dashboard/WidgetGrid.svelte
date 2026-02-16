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
    onLayoutChange?: (layout: WidgetLayout) => void;
    onWidgetSettings?: (widget: WidgetConfig) => void;
  }

  let { isEditing = false, onLayoutChange, onWidgetSettings }: Props = $props();

  let gridElement: HTMLDivElement | null = $state(null);
  let grid: GridStack | null = $state(null);
  let layout: WidgetLayout = $state({ widgets: [], version: 1, lastModified: new Date() });
  let saveTimeout: ReturnType<typeof setTimeout> | null = $state(null);
  let isAddingWidgets = $state(false); // Flag to prevent change events during initial load
  let previousWidgetIds = $state<Set<string>>(new Set()); // Track widgets from previous layout load

  // Debounced save function
  async function debouncedSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      try {
        await widgetService.saveLayout(layout);
        if (onLayoutChange) {
          onLayoutChange(layout);
        }
      } catch (e) {
        logger.error('WidgetGrid', 'debouncedSave', `Failed to save layout: ${e}`, { error: e });
      }
    }, 500);
  }

  // Preset sizes for clean grid alignment
  const PRESET_WIDTHS = [3, 4, 6, 8, 12];
  const PRESET_HEIGHTS = [4, 5, 6, 8, 10];

  // Snap to nearest preset size
  function snapToPreset(value: number, presets: number[]): number {
    return presets.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
    );
  }

  // Update widget position from GridStack event
  function updateWidgetPosition(node: HTMLElement) {
    const widgetId = node.getAttribute('data-gs-id');
    if (!widgetId) return;

    const x = parseInt(node.getAttribute('data-gs-x') || '0');
    const y = parseInt(node.getAttribute('data-gs-y') || '0');
    let w = parseInt(node.getAttribute('data-gs-w') || '1');
    let h = parseInt(node.getAttribute('data-gs-h') || '1');

    // Snap to preset sizes
    w = snapToPreset(w, PRESET_WIDTHS);
    h = snapToPreset(h, PRESET_HEIGHTS);

    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) {
      // Only update if position actually changed to avoid unnecessary saves
      const hasChanged =
        widget.position.x !== x ||
        widget.position.y !== y ||
        widget.position.w !== w ||
        widget.position.h !== h;

      if (hasChanged) {
        widget.position = { ...widget.position, x, y, w, h };
        // Update the element's attributes to reflect snapped size
        node.setAttribute('data-gs-w', w.toString());
        node.setAttribute('data-gs-h', h.toString());
        // Update lastModified timestamp
        layout.lastModified = new Date();
        debouncedSave();
        logger.debug('WidgetGrid', 'updateWidgetPosition', `Updated widget ${widgetId}`, {
          position: { x, y, w, h },
        });
      }
    }
  }

  async function loadLayout() {
    try {
      const loadedLayout = await widgetService.loadLayout();

      // Ensure widgets is always an array (defensive check)
      const currentWidgets = Array.isArray(layout.widgets) ? layout.widgets : [];
      const loadedWidgets = Array.isArray(loadedLayout.widgets) ? loadedLayout.widgets : [];

      // Always update if widgets array is different (handles initial empty state)
      const widgetsChanged =
        currentWidgets.length !== loadedWidgets.length ||
        currentWidgets.some((w, i) => {
          const loaded = loadedWidgets[i];
          return (
            !loaded ||
            w.id !== loaded.id ||
            w.position.x !== loaded.position.x ||
            w.position.y !== loaded.position.y ||
            w.position.w !== loaded.position.w ||
            w.position.h !== loaded.position.h ||
            w.enabled !== loaded.enabled
          );
        });

      if (widgetsChanged || currentWidgets.length === 0) {
        // Capture previousWidgetIds BEFORE updating layout (so we can detect truly new widgets)
        previousWidgetIds = new Set(currentWidgets.filter((w) => w.enabled).map((w) => w.id));
        layout = { ...loadedLayout, widgets: loadedWidgets };
        logger.debug('WidgetGrid', 'loadLayout', 'Layout loaded successfully', {
          widgetCount: loadedWidgets.length,
          version: loadedLayout.version,
          widgetIds: loadedWidgets.map((w) => w.id),
          previousWidgetIds: Array.from(previousWidgetIds),
        });
      } else {
        logger.debug('WidgetGrid', 'loadLayout', 'Layout unchanged, skipping update');
      }
    } catch (e) {
      logger.error('WidgetGrid', 'loadLayout', `Failed to load layout: ${e}`, { error: e });
      // Fallback to default layout on error
      layout = widgetService.getDefaultLayout();
    }
  }

  function initializeGrid() {
    if (!gridElement) return;

    // Destroy existing grid if any
    if (grid) {
      grid.destroy(false);
      grid = null;
    }

    // Initialize GridStack
    grid = GridStack.init(
      {
        column: 12,
        cellHeight: 80, // Taller cells for better widget visibility
        margin: 16,
        resizable: {
          handles: 'e, se, s, sw, w',
        },
        draggable: {
          handle: isEditing ? '.gs-resize-handle-top' : '.none',
        },
        disableResize: !isEditing,
        disableDrag: !isEditing,
        float: false,
        animate: true,
        // Snap to grid for clean alignment
        minRow: 1,
      },
      gridElement,
    );

    // Event handlers
    grid.on('change', (event, items: any) => {
      // Ignore change events during initial widget loading to prevent saving incorrect positions
      if (isAddingWidgets) {
        return;
      }
      if (items && Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.el) {
            // Use item data directly if available, otherwise read from DOM
            if (
              item.x !== undefined &&
              item.y !== undefined &&
              item.w !== undefined &&
              item.h !== undefined
            ) {
              const widgetId = item.el.getAttribute('data-gs-id');
              if (widgetId) {
                const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
                const widget = widgets.find((w) => w.id === widgetId);
                if (widget) {
                  let w = snapToPreset(item.w, PRESET_WIDTHS);
                  let h = snapToPreset(item.h, PRESET_HEIGHTS);

                  const hasChanged =
                    widget.position.x !== item.x ||
                    widget.position.y !== item.y ||
                    widget.position.w !== w ||
                    widget.position.h !== h;

                  if (hasChanged) {
                    widget.position = { ...widget.position, x: item.x, y: item.y, w, h };
                    layout.lastModified = new Date();
                    debouncedSave();
                  }
                }
              }
            } else {
              // Fallback to reading from DOM
              updateWidgetPosition(item.el);
            }
          }
        });
      }
    });

    grid.on('resize', (event, items: any) => {
      // Snap to preset sizes during resize for smooth visual feedback
      if (items && Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.el && item.w && item.h) {
            const snappedW = snapToPreset(item.w, PRESET_WIDTHS);
            const snappedH = snapToPreset(item.h, PRESET_HEIGHTS);

            // Only update if significantly different to avoid jitter
            if (Math.abs(snappedW - item.w) > 0.5 || Math.abs(snappedH - item.h) > 0.5) {
              // Use requestAnimationFrame to avoid conflicts with GridStack's internal updates
              requestAnimationFrame(() => {
                grid?.update(item.el, { w: snappedW, h: snappedH });
              });
            }
          }
        });
      }
    });

    grid.on('resizestop', (event, items: any) => {
      if (items && Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.el) {
            // Use item data directly if available
            if (
              item.x !== undefined &&
              item.y !== undefined &&
              item.w !== undefined &&
              item.h !== undefined
            ) {
              const widgetId = item.el.getAttribute('data-gs-id');
              if (widgetId) {
                const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
                const widget = widgets.find((w) => w.id === widgetId);
                if (widget) {
                  let w = snapToPreset(item.w, PRESET_WIDTHS);
                  let h = snapToPreset(item.h, PRESET_HEIGHTS);

                  widget.position = { ...widget.position, x: item.x, y: item.y, w, h };
                  layout.lastModified = new Date();
                  debouncedSave();
                }
              }
            } else {
              updateWidgetPosition(item.el);
            }
          }
        });
      }
    });

    grid.on('dragstop', (event, items: any) => {
      if (items && Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.el) {
            // Use item data directly if available
            if (
              item.x !== undefined &&
              item.y !== undefined &&
              item.w !== undefined &&
              item.h !== undefined
            ) {
              const widgetId = item.el.getAttribute('data-gs-id');
              if (widgetId) {
                const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
                const widget = widgets.find((w) => w.id === widgetId);
                if (widget) {
                  let w = snapToPreset(item.w, PRESET_WIDTHS);
                  let h = snapToPreset(item.h, PRESET_HEIGHTS);

                  widget.position = { ...widget.position, x: item.x, y: item.y, w, h };
                  layout.lastModified = new Date();
                  debouncedSave();
                }
              }
            } else {
              updateWidgetPosition(item.el);
            }
          }
        });
      }
    });
  }

  async function addWidgetsToGrid() {
    if (!grid || !gridElement) {
      logger.warn('WidgetGrid', 'addWidgetsToGrid', 'Grid or gridElement not available');
      return;
    }

    // Set flag to prevent change events from saving during initial positioning
    isAddingWidgets = true;

    // Ensure widgets is an array before filtering
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    logger.debug('WidgetGrid', 'addWidgetsToGrid', 'Starting to add widgets', {
      widgetCount: widgets.filter((w) => w.enabled).length,
    });

    await tick();
    // Wait a bit more for Svelte to fully render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find all widget containers that Svelte has rendered
    const existingElements = Array.from(
      gridElement.querySelectorAll('.grid-stack-item'),
    ) as HTMLElement[];
    const existingIds = new Set(
      existingElements.map((el) => el.getAttribute('data-gs-id')).filter(Boolean),
    );
    
    // Determine which widgets are truly new (not in previous layout)
    const currentWidgetIds = new Set(widgets.filter((w) => w.enabled).map((w) => w.id));
    const trulyNewWidgetIds = new Set(
      Array.from(currentWidgetIds).filter((id) => !previousWidgetIds.has(id))
    );

    logger.debug('WidgetGrid', 'addWidgetsToGrid', 'Found existing elements', {
      existingCount: existingElements.length,
      existingIds: Array.from(existingIds),
      previousWidgetIds: Array.from(previousWidgetIds),
      trulyNewWidgetIds: Array.from(trulyNewWidgetIds),
    });

    // Remove widgets that are no longer in layout
    existingElements.forEach((el) => {
      const widgetId = el.getAttribute('data-gs-id');
      if (widgetId && !widgets.find((w) => w.id === widgetId && w.enabled)) {
        logger.debug('WidgetGrid', 'addWidgetsToGrid', `Removing widget ${widgetId}`);
        grid?.removeWidget(el, false);
      }
    });

    // Add or update widgets
    for (const widget of widgets.filter((w) => w.enabled)) {
      let element = gridElement?.querySelector(`[data-gs-id="${widget.id}"]`) as HTMLElement;

      if (!element) {
        // Wait for Svelte to render - try multiple times
        logger.debug('WidgetGrid', 'addWidgetsToGrid', `Waiting for widget ${widget.id} to render`);
        for (let i = 0; i < 5 && !element; i++) {
          await tick();
          await new Promise((resolve) => setTimeout(resolve, 50));
          element = gridElement?.querySelector(`[data-gs-id="${widget.id}"]`) as HTMLElement;
        }
      }

      if (element) {
        const definition = widgetRegistry.get(widget.type);

        // CRITICAL FIX: Always call grid.update() or makeWidget() to ensure GridStack applies positions
        // GridStack may have initialized before attributes were set, so we need to force it to read current attributes
        const gridItem = {
          x: widget.position.x,
          y: widget.position.y,
          w: widget.position.w,
          h: widget.position.h,
          minW: widget.position.minW || definition?.minSize.w || 1,
          minH: widget.position.minH || definition?.minSize.h || 1,
          maxW: widget.position.maxW || definition?.maxSize.w || 12,
          maxH: widget.position.maxH || definition?.maxSize.h || 12,
        };

        // CRITICAL FIX: Set DOM attributes BEFORE calling grid.update() to ensure GridStack reads correct values
        // WidgetContainer sets these asynchronously, but GridStack may read from DOM during update()
        element.setAttribute('data-gs-x', gridItem.x.toString());
        element.setAttribute('data-gs-y', gridItem.y.toString());
        element.setAttribute('data-gs-w', gridItem.w.toString());
        element.setAttribute('data-gs-h', gridItem.h.toString());
        element.setAttribute('data-gs-min-w', gridItem.minW.toString());
        element.setAttribute('data-gs-min-h', gridItem.minH.toString());
        element.setAttribute('data-gs-max-w', gridItem.maxW.toString());
        element.setAttribute('data-gs-max-h', gridItem.maxH.toString());

        // Check if element is already a GridStack widget (GridStack might auto-initialize)
        // GridStack stores widget data in element.gridstackNode
        const isAlreadyWidget = (element as any).gridstackNode !== undefined;
        const isTrulyNewWidget = trulyNewWidgetIds.has(widget.id);
        
        if (isTrulyNewWidget) {
          // Widget is new to the layout - always force re-initialization if GridStack already knows about it
          // This handles the case where GridStack auto-initialized before we could set attributes
          if (isAlreadyWidget) {
            // GridStack auto-initialized this widget - remove and re-add to force correct position
            grid?.removeWidget(element, false);
            await tick();
          }
          // Add widget with correct attributes (already set in template)
          grid?.makeWidget(element);
          grid?.update(element, gridItem);
        } else {
          // Existing widget - just update position
          grid?.update(element, gridItem);
        }
      } else {
        logger.warn(
          'WidgetGrid',
          'addWidgetsToGrid',
          `Widget ${widget.id} element not found after waiting`,
        );
      }
    }

    // Wait a bit for GridStack to finish positioning before re-enabling change events
    await new Promise((resolve) => setTimeout(resolve, 200));
    isAddingWidgets = false;
    
    // Update previousWidgetIds for next call
    previousWidgetIds = new Set(widgets.filter((w) => w.enabled).map((w) => w.id));

    logger.debug('WidgetGrid', 'addWidgetsToGrid', 'Finished adding widgets');
  }

  async function handleWidgetUpdate(widgetId: string, updates: Partial<WidgetConfig>) {
    await widgetService.updateWidgetConfig(widgetId, updates);
    await loadLayout();
    await addWidgetsToGrid();
  }

  async function handleWidgetRemove(widgetId: string) {
    await widgetService.removeWidget(widgetId);
    await loadLayout();
    await addWidgetsToGrid();
  }

  // Watch for editing mode changes
  $effect(() => {
    if (grid) {
      grid.enableMove(isEditing);
      grid.enableResize(isEditing);
      grid.opts.disableDrag = !isEditing;
      grid.opts.disableResize = !isEditing;
      grid.opts.draggable = {
        handle: isEditing ? '.gs-resize-handle-top' : '.none',
      };
    }
  });

  // Watch for layout.widgets changes and reload grid (but not on initial mount)
  let isInitialMount = $state(true);
  $effect(() => {
    // Watch for layout changes - ensure widgets is an array before checking length
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    if (grid && widgets.length > 0) {
      // On initial mount, we handle this in onMount
      if (isInitialMount) {
        return;
      }

      // Small delay to ensure Svelte has rendered
      tick().then(() => {
        setTimeout(() => {
          addWidgetsToGrid();
        }, 100);
      });
    }
  });

  // Scroll to a specific widget by ID
  async function scrollToWidget(widgetId: string) {
    if (!gridElement) return;

    // Wait for DOM to be ready
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for GridStack positioning

    const widgetElement = gridElement.querySelector(
      `[data-gs-id="${widgetId}"]`,
    ) as HTMLElement;

    if (widgetElement) {
      // Scroll the widget into view with smooth behavior and some offset from top
      widgetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      logger.debug('WidgetGrid', 'scrollToWidget', `Scrolled to widget ${widgetId}`);
    } else {
      logger.warn('WidgetGrid', 'scrollToWidget', `Widget ${widgetId} element not found`);
    }
  }

  // Scroll to the top of the grid (useful when applying templates)
  async function scrollToTop() {
    if (!gridElement) return;

    // Wait for DOM to be ready
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for GridStack positioning

    // Scroll the grid element into view at the top
    gridElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
    logger.debug('WidgetGrid', 'scrollToTop', 'Scrolled to top of grid');
  }

  // Expose loadLayout for parent component
  async function reloadLayout(widgetIdToScroll?: string) {
    await loadLayout();
    await addWidgetsToGrid();
    
    // Scroll to the newly added widget if specified, otherwise scroll to top (for templates)
    if (widgetIdToScroll) {
      await scrollToWidget(widgetIdToScroll);
    } else {
      // When no specific widget ID is provided (e.g., template applied), scroll to top
      await scrollToTop();
    }
  }

  // Expose reloadLayout method for parent component
  export { reloadLayout };

  onMount(async () => {
    logger.debug('WidgetGrid', 'onMount', 'Starting mount sequence');
    await loadLayout();
    // Ensure widgets is an array before accessing properties
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    logger.debug('WidgetGrid', 'onMount', 'Layout loaded', {
      widgetCount: widgets.length,
      widgetIds: widgets.map((w) => w.id),
    });
    initializeGrid();
    logger.debug('WidgetGrid', 'onMount', 'Grid initialized');
    await addWidgetsToGrid();
    logger.debug('WidgetGrid', 'onMount', 'Widgets added to grid');
    // Mark initial mount as complete after widgets are added
    setTimeout(() => {
      isInitialMount = false;
      logger.debug('WidgetGrid', 'onMount', 'Initial mount complete');
    }, 500);
  });

  onDestroy(() => {
    // Save any pending changes before destroying
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    // Force a final save of current layout state
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    if (widgets.length > 0) {
      // Read current positions from GridStack before destroying
      if (grid && gridElement) {
        const allWidgets = Array.from(
          gridElement.querySelectorAll('.grid-stack-item'),
        ) as HTMLElement[];

        allWidgets.forEach((el) => {
          const widgetId = el.getAttribute('data-gs-id');
          if (widgetId) {
            const x = parseInt(el.getAttribute('data-gs-x') || '0');
            const y = parseInt(el.getAttribute('data-gs-y') || '0');
            const w = parseInt(el.getAttribute('data-gs-w') || '1');
            const h = parseInt(el.getAttribute('data-gs-h') || '1');

            const widget = widgets.find((w) => w.id === widgetId);
            if (widget) {
              widget.position = { ...widget.position, x, y, w, h };
            }
          }
        });
      }

      // Save synchronously before destroy
      widgetService.saveLayout({ ...layout, widgets }).catch((e) => {
        logger.error('WidgetGrid', 'onDestroy', `Failed to save layout on destroy: ${e}`, {
          error: e,
        });
      });
    }

    if (grid) {
      grid.destroy(false);
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
  <!-- Widgets are rendered by Svelte, GridStack manages their positioning -->
  {#each Array.isArray(layout.widgets) ? layout.widgets : [] as widget (widget.id)}
    {#if widget.enabled}
      <WidgetContainer
        {widget}
        {isEditing}
        onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
        onRemove={() => handleWidgetRemove(widget.id)}
        onSettings={onWidgetSettings} />
    {/if}
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
