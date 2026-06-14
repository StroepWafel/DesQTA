<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'elevated' | 'outlined' | 'ghost' | 'muted';
    padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    interactive?: boolean;
    class?: string;
    contentClass?: string;
    onclick?: () => void;
    children?: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    variant = 'default',
    padding = 'md',
    interactive = false,
    class: className = '',
    contentClass = '',
    onclick,
    children,
    header,
    footer,
  }: Props = $props();

  // Lo-fi card: opaque card surface, single 1px border, optional subtle shadow on elevated.
  // No backdrop-blur, no translucency, no hover scale.
  const variants = {
    default: 'bg-card text-card-foreground border border-border',
    elevated: 'bg-card text-card-foreground border border-border shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_2px_8px_-4px_rgba(0,0,0,0.06)]',
    outlined: 'bg-transparent text-foreground border border-border',
    ghost: 'bg-transparent text-foreground border border-transparent',
    muted: 'bg-surface-muted text-foreground border border-border-subtle',
  };

  const paddings = {
    none: '',
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  let baseClasses = $derived(
    [
      'rounded-xl transition-colors duration-200 ease-out',
      variants[variant],
      interactive
        ? 'cursor-pointer hover:border-border-strong hover:bg-surface-2/70'
        : '',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );

  let contentClasses = $derived([paddings[padding], contentClass].filter(Boolean).join(' '));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class={baseClasses}
  {onclick}
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}>
  {#if header}
    <div class="border-b border-border-subtle px-4 py-3">
      {@render header()}
    </div>
  {/if}

  {#if children}
    <div class={contentClasses}>
      {@render children()}
    </div>
  {/if}

  {#if footer}
    <div class="border-t border-border-subtle px-4 py-3">
      {@render footer()}
    </div>
  {/if}
</div>
