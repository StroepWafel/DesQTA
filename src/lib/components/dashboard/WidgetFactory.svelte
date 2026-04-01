<script lang="ts">
  import { widgetRegistry } from '../../services/widgetRegistry';
  import type { WidgetConfig } from '../../types/widgets';

  interface Props {
    widget: WidgetConfig;
  }

  const FALLBACK_WIDGET: WidgetConfig = {
    id: 'missing-widget',
    type: 'quick_notes',
    enabled: false,
    position: { x: 0, y: 0, w: 1, h: 1 },
    settings: {},
    title: 'Missing widget',
  };

  let { widget = FALLBACK_WIDGET }: Props = $props();

  const safeWidget = $derived(widget ?? FALLBACK_WIDGET);
  const definition = $derived(widgetRegistry.get(safeWidget.type));
  const Component = $derived(definition?.component);

  const settings = $derived.by(() => {
    const defaultSettings = definition?.defaultSettings;
    const widgetSettings = safeWidget.settings || {};

    return defaultSettings ? { ...defaultSettings, ...widgetSettings } : widgetSettings;
  });
</script>

{#if Component}
  <!-- Pass widget and settings to component, maintaining backward compatibility -->
  {@const WidgetComponent = Component}
  <WidgetComponent widget={safeWidget} {settings} />
{:else}
  <div
    class="flex flex-col items-center justify-center h-full p-4 text-center bg-white/80 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
    <p class="text-sm font-medium text-zinc-600 dark:text-zinc-400">
      Widget type "{safeWidget.type}" not found
    </p>
    <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
      This widget may not be available yet
    </p>
  </div>
{/if}
