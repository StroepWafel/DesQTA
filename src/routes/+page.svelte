<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';
  import EditModeToggle from '$lib/components/dashboard/EditModeToggle.svelte';
  import WidgetSettings from '$lib/components/dashboard/WidgetSettings.svelte';
  import { migrateToWidgetSystem, validateAndFixLayout } from '$lib/services/widgetMigration';
  import { logger } from '../utils/logger';
  import type { WidgetConfig, WidgetLayout } from '$lib/types/widgets';
  import { platformStore } from '$lib/stores/platform';

  let isMobile = $derived($platformStore.isMobile);
  let isEditing = $state(false);
  let selectedWidget = $state<WidgetConfig | null>(null);
  let showSettings = $state(false);
  let widgetGridRef: { reloadLayout: (widgetIdToScroll?: string) => Promise<void> } | null = null;
  let widgetLayoutPrepared = $state(false);

  function handleEditToggle(editing: boolean) {
    isEditing = editing;
  }

  async function handleLayoutChange(widgetId?: string) {
    logger.debug('dashboard', 'handleLayoutChange', 'Layout change requested', { widgetId });
    if (widgetGridRef) {
      await widgetGridRef.reloadLayout(widgetId);
    }
  }

  function handleGridLayoutChange(_layout: WidgetLayout) {
    logger.debug('dashboard', 'handleGridLayoutChange', 'Grid layout changed');
  }

  function handleWidgetSettings(widget: WidgetConfig | null) {
    if (widget) {
      selectedWidget = widget;
      showSettings = true;
    }
  }

  function handleSettingsClose() {
    showSettings = false;
    selectedWidget = null;
  }

  async function handleSettingsSave(widget: WidgetConfig) {
    selectedWidget = widget;
    await handleLayoutChange();
  }

  async function ensureWidgetLayoutPrepared() {
    if (widgetLayoutPrepared) return;

    await migrateToWidgetSystem();
    await validateAndFixLayout();
    widgetLayoutPrepared = true;
  }

  onMount(async () => {
    await ensureWidgetLayoutPrepared();
  });
</script>

<div class="container max-w-none w-full p-5 mx-auto min-h-screen space-y-6">
  <!-- Edit Mode Toggle -->
  <div in:fade={{ duration: 400 }}>
    <EditModeToggle
      bind:isEditing
      onToggle={handleEditToggle}
      onLayoutChange={handleLayoutChange} />
  </div>

  <!-- Widget Grid -->
  <div in:fade={{ duration: 400, delay: 100 }}>
    <WidgetGrid
      bind:this={widgetGridRef}
      {isEditing}
      {isMobile}
      onLayoutChange={handleGridLayoutChange}
      onWidgetSettings={handleWidgetSettings} />
  </div>
</div>

<!-- Widget Settings Modal -->
<WidgetSettings
  widget={selectedWidget}
  bind:open={showSettings}
  onClose={handleSettingsClose}
  onSave={handleSettingsSave} />
