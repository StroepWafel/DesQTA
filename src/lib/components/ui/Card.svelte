<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
    padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    interactive?: boolean;
    class?: string;
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
    onclick,
    children,
    header,
    footer,
  }: Props = $props();

  const variants = {
    default: 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
    elevated: 'bg-white dark:bg-zinc-800 shadow-md border border-zinc-200 dark:border-zinc-700',
    outlined: 'bg-transparent border-2 border-zinc-200 dark:border-zinc-700',
    ghost: 'bg-zinc-50/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50',
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
      'rounded-lg transition-all duration-200 ease-in-out',
      variants[variant],
      interactive
        ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transform active:scale-[0.98]'
        : '',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );

  let contentClasses = $derived([paddings[padding]].join(' '));
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
    <div class="border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
      {@render header()}
    </div>
  {/if}

  {#if children}
    <div class={contentClasses}>
      {@render children()}
    </div>
  {/if}

  {#if footer}
    <div class="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3">
      {@render footer()}
    </div>
  {/if}
</div>
