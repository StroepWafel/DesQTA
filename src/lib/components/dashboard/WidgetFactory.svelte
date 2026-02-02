<script lang="ts">
  import { widgetRegistry } from '../../services/widgetRegistry';
  import type { WidgetConfig } from '../../types/widgets';

  interface Props {
    widget: WidgetConfig;
  }

  let { widget }: Props = $props();

  const definition = widgetRegistry.get(widget.type);
  const Component = definition?.component;

  // Merge default settings with widget settings
  const settings = $derived(
    definition?.defaultSettings
      ? { ...definition.defaultSettings, ...(widget.settings || {}) }
      : widget.settings || {},
  );
</script>

{#if Component}
  <!-- Pass widget and settings to component, maintaining backward compatibility -->
  <svelte:component this={Component} {widget} {settings} />
{:else}
  <div
    class="flex flex-col items-center justify-center h-full p-4 text-center bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
    <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
      Widget type "{widget.type}" not found
    </p>
    <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
      This widget may not be available yet
    </p>
  </div>
{/if}
