<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: any;
    title?: string;
    /** Small uppercase label shown above the title (e.g. "Today") */
    eyebrow?: string;
    loading?: boolean;
    /** When true, renders the empty state */
    empty?: boolean;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: any;
    /** When true, removes the body padding so the widget can render edge-to-edge */
    flush?: boolean;
    /** When true, hides the default header (widget owns its own header) */
    hideHeader?: boolean;
    class?: string;
    headerAction?: Snippet;
    header?: Snippet;
    footer?: Snippet;
    children?: Snippet;
  }

  let {
    icon,
    title,
    eyebrow,
    loading = false,
    empty = false,
    emptyTitle = 'Nothing here yet',
    emptyMessage = '',
    emptyIcon,
    flush = false,
    hideHeader = false,
    class: className = '',
    headerAction,
    header,
    footer,
    children,
  }: Props = $props();
</script>

<div class="flex flex-col h-full w-full overflow-hidden {className}">
  {#if !hideHeader && (header || icon || title || eyebrow || headerAction)}
    <div class="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5">
      {#if header}
        {@render header()}
      {:else}
        <div class="flex items-center gap-2.5 min-w-0">
          {#if icon}
            <Icon src={icon} class="w-4 h-4 text-muted-foreground shrink-0" />
          {/if}
          <div class="min-w-0">
            {#if eyebrow}
              <p class="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground leading-none mb-1">
                {eyebrow}
              </p>
            {/if}
            {#if title}
              <h2 class="text-sm font-semibold tracking-tight text-foreground truncate leading-tight">
                {title}
              </h2>
            {/if}
          </div>
        </div>
      {/if}
      {#if headerAction}
        <div class="shrink-0">
          {@render headerAction()}
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex-1 min-h-0 overflow-hidden {flush ? '' : 'px-4 pb-2.5 pt-0'}">
    {#if loading}
      <div class="flex flex-col gap-2 h-full pt-1">
        <div class="h-3 w-2/3 rounded bg-surface-muted animate-pulse"></div>
        <div class="h-3 w-1/2 rounded bg-surface-muted animate-pulse"></div>
        <div class="h-3 w-3/4 rounded bg-surface-muted animate-pulse"></div>
        <div class="h-3 w-2/5 rounded bg-surface-muted animate-pulse"></div>
      </div>
    {:else if empty}
      <div class="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground py-6">
        {#if emptyIcon}
          <Icon src={emptyIcon} class="w-7 h-7 opacity-60" />
        {/if}
        <p class="text-sm font-medium text-foreground">{emptyTitle}</p>
        {#if emptyMessage}
          <p class="text-xs max-w-xs">{emptyMessage}</p>
        {/if}
      </div>
    {:else if children}
      {@render children()}
    {/if}
  </div>

  {#if footer}
    <div class="shrink-0 px-4 py-2 border-t border-border-subtle">
      {@render footer()}
    </div>
  {/if}
</div>
