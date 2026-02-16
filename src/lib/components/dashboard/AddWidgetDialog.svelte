<script lang="ts">
  import Modal from '../Modal.svelte';
  import { Button, SearchInput } from '../ui';
  import { Icon } from 'svelte-hero-icons';
  import { widgetRegistry, getAllWidgetTypes } from '../../services/widgetRegistry';
  import type { WidgetType, WidgetConfig } from '../../types/widgets';
  import { widgetService } from '../../services/widgetService';
  import { logger } from '../../../utils/logger';
  import { calculateNextAvailablePosition } from '../../utils/widgetPosition';

  interface Props {
    open: boolean;
    onClose: () => void;
    onAdd?: (widget: WidgetConfig) => void;
  }

  let { open = $bindable(false), onClose, onAdd }: Props = $props();

  let searchQuery = $state('');
  let addingWidget = $state<string | null>(null);

  const availableWidgets = $derived(() => {
    const types = getAllWidgetTypes();
    return types
      .map((type) => {
        const definition = widgetRegistry.get(type);
        return definition ? { type, definition } : null;
      })
      .filter((item): item is { type: WidgetType; definition: any } => item !== null);
  });

  const filteredWidgets = $derived(
    !searchQuery.trim()
      ? availableWidgets()
      : (() => {
          const query = searchQuery.toLowerCase();
          return availableWidgets().filter(
            (item) =>
              item.definition.name.toLowerCase().includes(query) ||
              item.definition.description.toLowerCase().includes(query) ||
              item.type.toLowerCase().includes(query),
          );
        })(),
  );

  async function handleAddWidget(type: WidgetType) {
    addingWidget = type;
    try {
      const definition = widgetRegistry.get(type);
      if (!definition) {
        throw new Error(`Widget definition not found for type: ${type}`);
      }

      // Calculate the next available position using collision detection
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

      if (onAdd) {
        onAdd(newWidget);
      }

      onClose();
      searchQuery = '';
    } catch (e) {
      logger.error('AddWidgetDialog', 'handleAddWidget', `Failed to add widget: ${e}`, {
        error: e,
      });
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
  maxWidth="max-w-4xl"
  ariaLabel="Add Widget"
  className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl">
  <div class="p-6">
    <h2 class="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Add Widget</h2>

    <!-- Search -->
    <div class="mb-6">
      <SearchInput placeholder="Search widgets..." bind:value={searchQuery} class="w-full" />
    </div>

    <!-- Widget Grid -->
    {#if filteredWidgets.length > 0}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
        {#each filteredWidgets as { type, definition }}
          <button
            onclick={() => handleAddWidget(type)}
            disabled={addingWidget === type}
            class="flex flex-col gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-wait"
            aria-label={`Add ${definition.name} widget`}>
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
                <Icon src={definition.icon} class="w-6 h-6" />
              </div>
              <div class="flex-1 text-left">
                <h3 class="font-semibold text-zinc-900 dark:text-white">{definition.name}</h3>
              </div>
            </div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 text-left line-clamp-2">
              {definition.description}
            </p>
            <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
              <span>Size: {definition.defaultSize.w}×{definition.defaultSize.h}</span>
            </div>
            {#if addingWidget === type}
              <div
                class="flex items-center justify-center gap-2 text-sm text-accent-600 dark:text-accent-400">
                <div
                  class="w-4 h-4 border-2 border-accent-600 border-t-transparent rounded-full animate-spin">
                </div>
                <span>Adding...</span>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="py-12 text-center text-zinc-600 dark:text-zinc-400">
        <p>No widgets found matching "{searchQuery}"</p>
      </div>
    {/if}

    <div class="flex justify-end mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
      <Button variant="ghost" onclick={handleClose}>Close</Button>
    </div>
  </div>
</Modal>
