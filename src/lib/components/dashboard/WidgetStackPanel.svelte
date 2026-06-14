<script lang="ts">
  import { Icon, Plus, XMark } from 'svelte-hero-icons';
  import type { WidgetConfig } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import { getDashboardEditContext } from '../../context/dashboardEditContext';
  import { ariaTooltip } from '$lib/actions/tooltip';

  interface Props {
    host: WidgetConfig;
    members: WidgetConfig[];
    onClose: () => void;
  }

  let { host, members, onClose }: Props = $props();

  const ctx = getDashboardEditContext();
  const isDropTarget = $derived(ctx?.stackDropTargetId() === host.id);
  const slides = $derived([host, ...members]);
  const maxMembers = 7;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    ctx?.setStackDropTargetId(host.id);
  }

  function handleDragLeave() {
    if (ctx?.stackDropTargetId() === host.id) {
      ctx.setStackDropTargetId(null);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute inset-0 z-[25] flex flex-col rounded-xl border border-accent-500/50 bg-card p-3 gap-3 pointer-events-auto"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
  role="dialog"
  aria-label="Widget stack editor">
  <div class="flex items-center justify-between gap-2 shrink-0">
    <p class="text-xs font-semibold text-foreground">Widget stack</p>
    <button
      type="button"
      onclick={onClose}
      class="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted"
      aria-label="Close stack editor"
      use:ariaTooltip>
      <Icon src={XMark} class="w-3.5 h-3.5" />
    </button>
  </div>

  <p class="text-[11px] text-muted-foreground shrink-0">
    Drag widgets here while editing, or drop onto the dashed slot below.
  </p>

  <div class="flex-1 min-h-0 flex items-stretch gap-2 overflow-x-auto pb-1">
    {#each slides as slide (slide.id)}
      {@const def = widgetRegistry.get(slide.type)}
      <div
        class="shrink-0 w-28 flex flex-col rounded-lg border border-border bg-surface-muted p-2 gap-1">
        <div class="flex items-center gap-1.5 min-w-0">
          {#if def?.icon}
            <Icon src={def.icon} class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {/if}
          <span class="text-[11px] font-medium text-foreground truncate">{def?.name ?? slide.type}</span>
        </div>
        {#if slide.id !== host.id && ctx}
          <button
            type="button"
            onclick={() => ctx.removeFromStack(slide.id)}
            class="mt-auto text-[10px] text-muted-foreground hover:text-destructive text-left">
            Remove
          </button>
        {:else}
          <span class="mt-auto text-[10px] text-muted-foreground">Host</span>
        {/if}
      </div>
    {/each}

    {#if members.length < maxMembers}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="shrink-0 w-28 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-2 transition-colors duration-150 {isDropTarget
          ? 'border-accent-500 bg-accent-500/10'
          : 'border-border-strong bg-surface-muted/40'}"
        data-stack-drop={host.id}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        role="region"
        aria-label="Drop widget to add to stack">
        <Icon src={Plus} class="w-5 h-5 text-muted-foreground mb-1" />
        <span class="text-[10px] text-muted-foreground text-center leading-tight">Add widget</span>
      </div>
    {/if}
  </div>
</div>
