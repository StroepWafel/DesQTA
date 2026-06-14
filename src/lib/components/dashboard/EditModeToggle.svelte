<script lang="ts">
  import { Button } from '../ui';
  import { Icon, PencilSquare, Check, Plus, Squares2x2, ArrowPath, ArrowDownTray, ArrowUpTray } from 'svelte-hero-icons';
  import AddWidgetDialog from './AddWidgetDialog.svelte';
  import WidgetTemplates from './WidgetTemplates.svelte';
  import Modal from '../Modal.svelte';
  import { Input } from '../ui';
  import { logger } from '../../../utils/logger';
  import { widgetService } from '../../services/widgetService';
  import { dashboardExportService } from '../../services/dashboardExportService';
  import { toast } from 'svelte-sonner';
  import { _ } from '../../i18n';

  interface Props {
    isEditing: boolean;
    onToggle: (editing: boolean) => void;
    onLayoutChange?: (widgetId?: string) => void;
  }

  let { isEditing = $bindable(false), onToggle, onLayoutChange }: Props = $props();

  let showAddWidgetDialog = $state(false);
  let showTemplatesDialog = $state(false);
  let isResetting = $state(false);
  let showResetConfirm = $state(false);
  let showExportDialog = $state(false);
  let exportName = $state('My dashboard');
  let exportDescription = $state('');
  let isExporting = $state(false);
  let isImporting = $state(false);

  function handleToggle() {
    isEditing = !isEditing;
    onToggle(isEditing);
  }

  function handleDone() {
    isEditing = false;
    onToggle(false);
  }

  async function performReset() {
    showResetConfirm = false;
    if (isResetting) return;
    isResetting = true;
    try {
      logger.debug('EditModeToggle', 'handleReset', 'Layout reset requested');
      await widgetService.resetLayout();
      await onLayoutChange?.();
      toast.success('Dashboard reset to default layout');
    } catch (e) {
      logger.error('EditModeToggle', 'handleReset', `Failed to reset layout: ${e}`, { error: e });
      toast.error('Failed to reset layout. Please try again.');
    } finally {
      isResetting = false;
    }
  }

  async function performExport() {
    if (!exportName.trim()) {
      toast.error('Enter a name for this layout');
      return;
    }
    isExporting = true;
    try {
      const ok = await dashboardExportService.exportCurrentLayout(
        exportName.trim(),
        exportDescription.trim() || undefined,
      );
      if (ok) {
        showExportDialog = false;
        toast.success('Dashboard exported');
      }
    } catch {
      toast.error('Failed to export dashboard');
    } finally {
      isExporting = false;
    }
  }

  async function performImport() {
    isImporting = true;
    try {
      const layout = await dashboardExportService.importLayoutFile();
      if (!layout) return;
      await dashboardExportService.applyImportedLayout(layout);
      await onLayoutChange?.();
      toast.success('Dashboard imported');
    } catch {
      toast.error('Failed to import dashboard file');
    } finally {
      isImporting = false;
    }
  }
</script>

<div class="flex items-center gap-2" data-onboarding="dashboard-edit">
  {#if isEditing}
    <Button onclick={handleDone} variant="primary" size="sm" tooltip={$_('dashboard.done_editing') || 'Save layout and exit edit mode'}>
      <Icon src={Check} class="w-4 h-4" />
      Done editing
    </Button>
    <Button onclick={() => (showAddWidgetDialog = true)} variant="secondary" size="sm" tooltip={$_('dashboard.add_widget') || 'Add a widget to the dashboard'}>
      <Icon src={Plus} class="w-4 h-4" />
      Add widget
    </Button>
    <Button onclick={() => (showTemplatesDialog = true)} variant="ghost" size="sm" tooltip={$_('dashboard.templates') || 'Apply or save layout templates'}>
      <Icon src={Squares2x2} class="w-4 h-4" />
      Templates
    </Button>
    <Button onclick={() => (showExportDialog = true)} variant="ghost" size="sm" tooltip={$_('dashboard.export_layout') || 'Export layout as a .DQDash file'}>
      <Icon src={ArrowDownTray} class="w-4 h-4" />
      Export
    </Button>
    <Button onclick={performImport} variant="ghost" size="sm" disabled={isImporting} tooltip={$_('dashboard.import_layout') || 'Import a .DQDash layout file'}>
      <Icon src={ArrowUpTray} class="w-4 h-4 {isImporting ? 'animate-pulse' : ''}" />
      {isImporting ? 'Importing…' : 'Import'}
    </Button>
    <Button
      onclick={() => (showResetConfirm = true)}
      variant="ghost"
      size="sm"
      disabled={isResetting}
      tooltip={$_('dashboard.reset_layout') || 'Reset dashboard to the default layout'}
      class="text-muted-foreground hover:text-destructive">
      <Icon src={ArrowPath} class="w-4 h-4 {isResetting ? 'animate-spin' : ''}" />
      {isResetting ? 'Resetting…' : 'Reset'}
    </Button>
  {:else}
    <Button onclick={handleToggle} variant="secondary" size="sm" tooltip={$_('dashboard.edit_dashboard') || 'Customize widget layout'}>
      <Icon src={PencilSquare} class="w-4 h-4" />
      Edit dashboard
    </Button>
  {/if}
</div>

<AddWidgetDialog
  bind:open={showAddWidgetDialog}
  onClose={() => (showAddWidgetDialog = false)}
  onAdd={(widget) => {
    if (onLayoutChange) {
      onLayoutChange(widget.id);
    }
  }} />

<WidgetTemplates
  bind:open={showTemplatesDialog}
  onClose={() => (showTemplatesDialog = false)}
  onApply={onLayoutChange} />

<Modal
  bind:open={showResetConfirm}
  onclose={() => (showResetConfirm = false)}
  maxWidth="max-w-md"
  title="Reset dashboard?">
  <div class="px-6 sm:px-8 pb-6 sm:pb-7 space-y-4">
    <p class="text-sm text-muted-foreground">
      This will replace your current widgets and layout with the default. You can always rebuild it
      after.
    </p>
    <div class="flex items-center justify-end gap-2">
      <Button variant="ghost" size="sm" onclick={() => (showResetConfirm = false)}>Cancel</Button>
      <Button variant="danger" size="sm" onclick={performReset} disabled={isResetting}>
        {isResetting ? 'Resetting…' : 'Reset dashboard'}
      </Button>
    </div>
  </div>
</Modal>

<Modal
  bind:open={showExportDialog}
  onclose={() => (showExportDialog = false)}
  maxWidth="max-w-md"
  title="Export dashboard">
  <div class="px-6 sm:px-8 pb-6 sm:pb-7 space-y-4">
    <p class="text-sm text-muted-foreground">
      Save your layout as a <span class="font-mono text-xs">.DQDash</span> file to share or back up.
    </p>
    <Input id="export-name" label="Layout name" bind:value={exportName} class="w-full" />
    <Input
      id="export-desc"
      label="Description"
      bind:value={exportDescription}
      placeholder="Optional"
      class="w-full" />
    <div class="flex items-center justify-end gap-2">
      <Button variant="ghost" size="sm" onclick={() => (showExportDialog = false)}>Cancel</Button>
      <Button size="sm" onclick={performExport} disabled={isExporting || !exportName.trim()}>
        {isExporting ? 'Exporting…' : 'Export .DQDash'}
      </Button>
    </div>
  </div>
</Modal>
