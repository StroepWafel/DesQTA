<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Icon } from 'svelte-hero-icons';
  import type { WidgetLayout } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';

  interface Props {
    layout: WidgetLayout;
    size?: 'small' | 'medium' | 'large';
    showLabels?: boolean;
  }

  let { layout, size = 'medium', showLabels = false }: Props = $props();

  // Calculate grid dimensions
  const GRID_COLUMNS = 12;
  const cellSize = $derived(size === 'small' ? 8 : size === 'medium' ? 12 : 16);
  const containerHeight = $derived(size === 'small' ? 120 : size === 'medium' ? 180 : 240);

  // Find max Y position to calculate grid height
  const maxY = $derived(
    layout.widgets.reduce((max, widget) => Math.max(max, widget.position.y + widget.position.h), 0),
  );
  const gridHeight = $derived(Math.max(maxY, 10) * cellSize);

  // Calculate widget positions and sizes
  const widgetItems = $derived(
    layout.widgets
      .filter((w) => w.enabled)
      .map((widget) => {
        const definition = widgetRegistry.get(widget.type);
        return {
          widget,
          definition,
          left: (widget.position.x / GRID_COLUMNS) * 100,
          top: (widget.position.y / maxY) * 100,
          width: (widget.position.w / GRID_COLUMNS) * 100,
          height: (widget.position.h / maxY) * 100,
        };
      }),
  );

  // Color palette for different widget types
  const widgetColors = [
    'bg-blue-500/20 border-blue-500/40',
    'bg-purple-500/20 border-purple-500/40',
    'bg-green-500/20 border-green-500/40',
    'bg-orange-500/20 border-orange-500/40',
    'bg-pink-500/20 border-pink-500/40',
    'bg-cyan-500/20 border-cyan-500/40',
    'bg-yellow-500/20 border-yellow-500/40',
    'bg-indigo-500/20 border-indigo-500/40',
  ];

  function getWidgetColor(index: number): string {
    return widgetColors[index % widgetColors.length];
  }
</script>

<div
  class="relative w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden"
  style="height: {containerHeight}px; min-height: {containerHeight}px;">
  <!-- Grid background -->
  <div
    class="absolute inset-0 opacity-20"
    style="background-image: repeating-linear-gradient(0deg, transparent, transparent {cellSize -
      1}px, rgb(161 161 170 / 0.1) {cellSize -
      1}px, rgb(161 161 170 / 0.1) {cellSize}px), repeating-linear-gradient(90deg, transparent, transparent {cellSize -
      1}px, rgb(161 161 170 / 0.1) {cellSize - 1}px, rgb(161 161 170 / 0.1) {cellSize}px);">
  </div>

  <!-- Widget placeholders -->
  {#each widgetItems as item, index (item.widget.id)}
    <div
      class="absolute rounded-md border-2 {getWidgetColor(
        index,
      )} transition-all duration-200 hover:scale-105 hover:shadow-md backdrop-blur-sm"
      style="left: {item.left}%; top: {item.top}%; width: {item.width}%; height: {item.height}%; animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) {index *
        50}ms both;">
      {#if showLabels && item.definition}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center p-1 text-[8px] font-medium text-zinc-700 dark:text-zinc-300 opacity-0 hover:opacity-100 transition-opacity duration-200">
          <Icon src={item.definition.icon} class="w-3 h-3 mb-0.5" />
          <span class="text-center leading-tight line-clamp-2">{item.definition.name}</span>
        </div>
      {:else if item.definition}
        <div
          class="absolute inset-0 flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity duration-200">
          <Icon src={item.definition.icon} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </div>
      {/if}
    </div>
  {/each}

  <!-- Widget count badge -->
  <div
    class="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 shadow-sm"
    style="animation: fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) {widgetItems.length * 50}ms both;">
    {layout.widgets.filter((w) => w.enabled).length} widgets
  </div>
</div>

<style>
  /* Smooth transitions for widget placeholders */
  :global(.template-preview-widget) {
    transform-origin: center center;
    will-change: transform, opacity;
  }
</style>
