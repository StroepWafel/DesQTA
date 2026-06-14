<script lang="ts">
  import Modal from '../Modal.svelte';
  import { Button, SearchInput } from '../ui';
  import { Icon } from 'svelte-hero-icons';
  import {
    widgetRegistry,
    getAllWidgetTypes,
    WIDGET_CATEGORY_LABELS,
  } from '../../services/widgetRegistry';
  import type { WidgetType, WidgetConfig, WidgetCategory } from '../../types/widgets';
  import { widgetService } from '../../services/widgetService';
  import { logger } from '../../../utils/logger';
  import { calculateNextAvailablePosition } from '../../utils/widgetPosition';
  import { toast } from 'svelte-sonner';

  interface Props {
    open: boolean;
    onClose: () => void;
    onAdd?: (widget: WidgetConfig) => void;
  }

  let { open = $bindable(false), onClose, onAdd }: Props = $props();

  let searchQuery = $state('');
  let addingWidget = $state<string | null>(null);

  type Item = { type: WidgetType; definition: any; category: WidgetCategory };

  const availableWidgets = $derived.by<Item[]>(() => {
    const types = getAllWidgetTypes();
    const items: Item[] = [];
    for (const type of types) {
      const definition = widgetRegistry.get(type);
      if (!definition) continue;
      items.push({
        type,
        definition,
        category: (definition.category as WidgetCategory) ?? 'tools',
      });
    }
    return items;
  });

  const filteredWidgets = $derived.by<Item[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableWidgets;
    return availableWidgets.filter(
      (item) =>
        item.definition.name.toLowerCase().includes(q) ||
        item.definition.description.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q),
    );
  });

  const groupedWidgets = $derived.by(() => {
    const groups: { id: WidgetCategory; label: string; items: Item[] }[] = [];
    for (const meta of WIDGET_CATEGORY_LABELS) {
      const items = filteredWidgets.filter((i) => i.category === meta.id);
      if (items.length > 0) groups.push({ id: meta.id, label: meta.label, items });
    }
    return groups;
  });

  async function handleAddWidget(type: WidgetType) {
    addingWidget = type;
    try {
      const definition = widgetRegistry.get(type);
      if (!definition) throw new Error(`Widget definition not found for type: ${type}`);

      const layout = await widgetService.loadLayout();
      const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
      const position = calculateNextAvailablePosition(
        widgets,
        definition.minSize.w,
        definition.minSize.h,
        definition.defaultSize.w,
        definition.defaultSize.h,
      );

      const newWidget: WidgetConfig = {
        id: `${type}_${Date.now()}`,
        type,
        enabled: true,
        position: {
          ...position,
          minW: definition.minSize.w,
          minH: definition.minSize.h,
          maxW: definition.maxSize.w,
          maxH: definition.maxSize.h,
        },
        settings: { ...definition.defaultSettings },
      };

      await widgetService.addWidget(newWidget);
      onAdd?.(newWidget);
      onClose();
      searchQuery = '';
      toast.success(`Added ${definition.name}`);
    } catch (e) {
      logger.error('AddWidgetDialog', 'handleAddWidget', `Failed to add widget: ${e}`, { error: e });
      toast.error('Failed to add widget');
    } finally {
      addingWidget = null;
    }
  }

  function handleClose() {
    searchQuery = '';
    onClose();
  }
</script>

<Modal
  bind:open
  onclose={handleClose}
  maxWidth="max-w-3xl"
  ariaLabel="Add Widget"
  title="Add a widget">
  <div class="px-6 sm:px-8 pb-6 sm:pb-7 flex flex-col gap-6">
    <SearchInput placeholder="Search widgets…" bind:value={searchQuery} class="w-full" />

    <div class="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-6">
      {#if filteredWidgets.length === 0}
        <div class="py-12 text-center text-muted-foreground">
          <p class="text-sm">No widgets found matching "{searchQuery}"</p>
        </div>
      {:else}
        {#each groupedWidgets as group}
          <section>
            <p class="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground mb-3">
              {group.label}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {#each group.items as { type, definition }}
                <button
                  onclick={() => handleAddWidget(type)}
                  disabled={addingWidget === type}
                  class="flex items-start gap-3 p-3.5 text-left rounded-lg border border-border bg-card hover:bg-surface-muted hover:border-border-strong transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-wait"
                  aria-label={`Add ${definition.name} widget`}>
                  <div class="shrink-0 flex items-center justify-center w-9 h-9 rounded-md bg-surface-muted text-foreground">
                    <Icon src={definition.icon} class="w-4.5 h-4.5" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h3 class="text-sm font-semibold text-foreground truncate">{definition.name}</h3>
                      {#if addingWidget === type}
                        <span class="text-[10px] uppercase tracking-[0.06em] font-semibold text-accent-600">
                          Adding…
                        </span>
                      {/if}
                    </div>
                    <p class="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {definition.description}
                    </p>
                    <p class="text-[10px] text-muted-foreground/80 nums-tabular mt-1.5">
                      {definition.defaultSize.w}×{definition.defaultSize.h} grid units
                    </p>
                  </div>
                </button>
              {/each}
            </div>
          </section>
        {/each}
      {/if}
    </div>

    <div class="flex justify-end gap-2 pt-2 border-t border-border-subtle">
      <Button variant="ghost" size="sm" onclick={handleClose}>Close</Button>
    </div>
  </div>
</Modal>
