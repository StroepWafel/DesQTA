<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { XMark } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';
  import { ariaTooltip } from '$lib/actions/tooltip';

  interface Props {
    variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: any;
    dot?: boolean;
    removable?: boolean;
    uppercase?: boolean;
    class?: string;
    onremove?: () => void;
    children?: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    icon,
    dot = false,
    removable = false,
    uppercase = false,
    class: className = '',
    onremove,
    children
  }: Props = $props();

  // Lo-fi badge: flat neutral pills, optional accent variant. Less saturation than before.
  const variants = {
    default: 'bg-surface-muted text-foreground border-border-subtle',
    primary: 'bg-accent-500/12 text-accent-600 border-accent-500/20',
    secondary: 'bg-surface-3 text-foreground border-border',
    success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/20',
    danger: 'bg-destructive/12 text-destructive border-destructive/20',
    info: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/20',
    outline: 'bg-transparent text-foreground border-border',
  };

  const sizes = {
    xs: 'h-5 px-1.5 text-[10px] gap-1',
    sm: 'h-6 px-2 text-xs gap-1',
    md: 'h-6 px-2.5 text-xs gap-1.5',
    lg: 'h-7 px-3 text-sm gap-1.5'
  };

  const iconSizes = {
    xs: '10',
    sm: '12',
    md: '14',
    lg: '16'
  };

  const dotColors = {
    default: 'bg-muted-foreground',
    primary: 'bg-accent-500',
    secondary: 'bg-foreground/60',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-destructive',
    info: 'bg-sky-500',
    outline: 'bg-foreground/60',
  };

  let baseClasses = $derived([
    'inline-flex items-center font-medium rounded-full border transition-colors duration-150 whitespace-nowrap',
    uppercase ? 'uppercase tracking-[0.06em] font-semibold' : '',
    variants[variant],
    sizes[size],
    className
  ].filter(Boolean).join(' '));
</script>

<span class={baseClasses}>
  {#if dot}
    <span class="w-1.5 h-1.5 rounded-full {dotColors[variant]}"></span>
  {:else if icon}
    <Icon src={icon} size={iconSizes[size]} />
  {/if}

  {#if children}
    {@render children()}
  {/if}

  {#if removable}
    <button
      onclick={onremove}
      class="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
      aria-label="Remove badge"
      use:ariaTooltip
    >
      <Icon src={XMark} size="12" />
    </button>
  {/if}
</span>
