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
    class="flex flex-col items-center justify-center h-full p-4 text-center bg-card text-card-foreground rounded-xl border border-border-subtle">
    <p class="text-sm font-medium text-foreground">
      Widget type "{safeWidget.type}" not found
    </p>
    <p class="mt-1 text-xs text-muted-foreground">
      This widget may not be available yet
    </p>
  </div>
{/if}
