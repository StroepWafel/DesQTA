<script lang="ts">
  import { Button } from '../ui';
  import { Icon, PencilSquare, Check, Plus, Squares2x2, ArrowPath } from 'svelte-hero-icons';
  import AddWidgetDialog from './AddWidgetDialog.svelte';
  import WidgetTemplates from './WidgetTemplates.svelte';
  import { widgetService } from '../../services/widgetService';
  import { logger } from '../../../utils/logger';

  interface Props {
    isEditing: boolean;
    onToggle: (editing: boolean) => void;
    onLayoutChange?: (widgetId?: string) => void;
  }

  let { isEditing = $bindable(false), onToggle, onLayoutChange }: Props = $props();

  let showAddWidgetDialog = $state(false);
  let showTemplatesDialog = $state(false);
  let isResetting = $state(false);

  function handleToggle() {
    isEditing = !isEditing;
    onToggle(isEditing);
  }

  function handleDone() {
    isEditing = false;
    onToggle(false);
  }

  async function handleReset() {
    if (isResetting) return;

    // Confirm reset
    if (
      !confirm(
        'Are you sure you want to reset the layout to default? This will remove all your customizations.',
      )
    ) {
      return;
    }

    isResetting = true;
    try {
      await widgetService.resetLayout();
      logger.debug('EditModeToggle', 'handleReset', 'Layout reset successfully');
      // Trigger layout reload
      if (onLayoutChange) {
        onLayoutChange();
      }
    } catch (e) {
      logger.error('EditModeToggle', 'handleReset', `Failed to reset layout: ${e}`, { error: e });
      alert('Failed to reset layout. Please try again.');
    } finally {
      isResetting = false;
    }
  }
</script>

<div class="flex items-center gap-2 mb-4" data-onboarding="dashboard-edit">
  {#if isEditing}
    <Button onclick={handleDone} class="gap-2">
      <Icon src={Check} class="w-4 h-4" />
      Done Editing
    </Button>
    <Button onclick={() => (showAddWidgetDialog = true)} variant="ghost" class="gap-2">
      <Icon src={Plus} class="w-4 h-4" />
      Add Widget
    </Button>
    <Button onclick={() => (showTemplatesDialog = true)} variant="ghost" class="gap-2">
      <Icon src={Squares2x2} class="w-4 h-4" />
      Templates
    </Button>
    <Button
      onclick={handleReset}
      variant="ghost"
      class="gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
      disabled={isResetting}>
      <Icon src={ArrowPath} class="w-4 h-4 {isResetting ? 'animate-spin' : ''}" />
      {isResetting ? 'Resetting...' : 'Reset Layout'}
    </Button>
  {:else}
    <Button onclick={handleToggle} variant="ghost" class="gap-2">
      <Icon src={PencilSquare} class="w-4 h-4" />
      Edit Layout
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
