<script lang="ts">
  import { Icon, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import type { WidgetConfig } from '../../types/widgets';
  import { widgetRegistry } from '../../services/widgetRegistry';
  import WidgetFactory from './WidgetFactory.svelte';
  import { getDashboardEditContext } from '../../context/dashboardEditContext';
  import { ariaTooltip } from '$lib/actions/tooltip';

  interface Props {
    host: WidgetConfig;
    members: WidgetConfig[];
  }

  let { host, members }: Props = $props();

  const ctx = getDashboardEditContext();
  const activeIndex = $derived(host.stack?.activeIndex ?? 0);
  const slides = $derived([host, ...members]);
  const activeWidget = $derived(slides[activeIndex] ?? host);
  const hasMultiple = $derived(slides.length > 1);
  const hostDef = $derived(widgetRegistry.get(host.type));

  function prev() {
    if (!ctx || !hasMultiple) return;
    const next = (activeIndex - 1 + slides.length) % slides.length;
    void ctx.setStackActiveIndex(host.id, next);
  }

  function next() {
    if (!ctx || !hasMultiple) return;
    const nextIdx = (activeIndex + 1) % slides.length;
    void ctx.setStackActiveIndex(host.id, nextIdx);
  }
</script>

<div class="relative flex flex-col h-full min-h-0">
  {#if hasMultiple}
    <div
      class="shrink-0 flex items-center justify-between gap-2 px-1 pb-1.5 border-b border-border-subtle mb-1">
      <button
        type="button"
        onclick={prev}
        class="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
        aria-label="Previous widget in stack"
        use:ariaTooltip>
        <Icon src={ChevronLeft} class="w-3.5 h-3.5" />
      </button>
      <div class="flex items-center gap-1.5 min-w-0 flex-1 justify-center">
        {#each slides as slide, i (slide.id)}
          <button
            type="button"
            onclick={() => ctx?.setStackActiveIndex(host.id, i)}
            class="w-1.5 h-1.5 rounded-full transition-colors duration-150 {i === activeIndex
              ? 'bg-accent-500'
              : 'bg-border-strong hover:bg-muted-foreground'}"
            aria-label="Show {widgetRegistry.get(slide.type)?.name ?? slide.type}"
            use:ariaTooltip></button>
        {/each}
      </div>
      <button
        type="button"
        onclick={next}
        class="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
        aria-label="Next widget in stack"
        use:ariaTooltip>
        <Icon src={ChevronRight} class="w-3.5 h-3.5" />
      </button>
    </div>
  {/if}

  <div class="flex-1 min-h-0 overflow-hidden">
    {#key activeWidget.id}
      <WidgetFactory widget={activeWidget} />
    {/key}
  </div>

  {#if hasMultiple && hostDef}
    <p class="shrink-0 pt-1 text-[10px] text-center text-muted-foreground truncate">
      {widgetRegistry.get(activeWidget.type)?.name ?? activeWidget.type}
      <span class="text-muted-foreground/70"> · {activeIndex + 1}/{slides.length}</span>
    </p>
  {/if}
</div>
