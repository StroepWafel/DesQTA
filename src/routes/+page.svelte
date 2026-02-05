<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';
  import EditModeToggle from '$lib/components/dashboard/EditModeToggle.svelte';
  import WidgetSettings from '$lib/components/dashboard/WidgetSettings.svelte';
  import { migrateToWidgetSystem, validateAndFixLayout } from '$lib/services/widgetMigration';
  import { logger } from '../utils/logger';
  import type { WidgetConfig, WidgetLayout } from '$lib/types/widgets';

  let isEditing = $state(false);
  let selectedWidget = $state<WidgetConfig | null>(null);
  let showSettings = $state(false);
  let widgetGridRef: any = null;

  function handleEditToggle(editing: boolean) {
    isEditing = editing;
  }

  function handleLayoutChange(widgetId?: string) {
    // Layout changed, reload grid (called from EditModeToggle)
    logger.debug('dashboard', 'handleLayoutChange', 'Layout changed', { widgetId });
    if (widgetGridRef && typeof widgetGridRef.reloadLayout === 'function') {
      widgetGridRef.reloadLayout(widgetId);
    }
  }

  function handleGridLayoutChange(layout: WidgetLayout) {
    // Called from WidgetGrid when layout changes (e.g., drag/resize)
    // We don't need to do anything here since WidgetGrid handles its own state
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

  function handleSettingsSave(widget: WidgetConfig) {
    selectedWidget = widget;
    handleLayoutChange();
  }

  onMount(async () => {
    // Run migration on mount
    await migrateToWidgetSystem();
    await validateAndFixLayout();
  });
</script>

<div class="p-4 sm:p-6 min-h-screen">
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
