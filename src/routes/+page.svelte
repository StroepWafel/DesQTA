<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import WidgetGrid from '$lib/components/dashboard/WidgetGrid.svelte';
  import EditModeToggle from '$lib/components/dashboard/EditModeToggle.svelte';
  import WidgetSettings from '$lib/components/dashboard/WidgetSettings.svelte';
  import {
    seedDefaultLayoutIfEmpty,
    validateAndFixLayout,
  } from '$lib/services/widgetMigration';
  import { logger } from '../utils/logger';
  import type { WidgetConfig, WidgetLayout } from '$lib/types/widgets';
  import { platformStore } from '$lib/stores/platform';
  import { authService } from '$lib/services/authService';

  let isMobile = $derived($platformStore.isMobile);
  let isEditing = $state(false);
  let selectedWidget = $state<WidgetConfig | null>(null);
  let showSettings = $state(false);
  let widgetGridRef: { reloadLayout: (widgetIdToScroll?: string) => Promise<void> } | null = null;
  let widgetLayoutPrepared = $state(false);

  let firstName = $state<string>('');

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
    await seedDefaultLayoutIfEmpty();
    await validateAndFixLayout();
    widgetLayoutPrepared = true;
  }

  function greeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Good evening';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  async function loadUserName() {
    try {
      const info = await authService.loadUserInfo();
      const raw = info?.userDesc || info?.userName || '';
      if (raw) firstName = String(raw).split(' ')[0] ?? '';
    } catch {
      firstName = '';
    }
  }

  onMount(async () => {
    void loadUserName();
    await ensureWidgetLayoutPrepared();
  });
</script>

<div
  class="container max-w-none w-full p-5 sm:p-8 mx-auto flex flex-col gap-6 min-h-full"
  in:fade={{ duration: 250 }}>
  <!-- Editorial header + edit-mode actions -->
  <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between shrink-0">
    <div class="flex flex-col gap-1.5">
      <p class="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
        Dashboard
      </p>
      <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
        {greeting()}{firstName ? `, ${firstName}` : ''}
      </h1>
      <p class="text-sm text-muted-foreground max-w-2xl">
        {#if isEditing}
          Drag widgets to rearrange, click to configure.
        {:else}
          Your day at a glance.
        {/if}
      </p>
    </div>
    <EditModeToggle
      bind:isEditing
      onToggle={handleEditToggle}
      onLayoutChange={handleLayoutChange} />
  </header>

  <!-- Widget Grid -->
  <div in:fade={{ duration: 250, delay: 80 }}>
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
