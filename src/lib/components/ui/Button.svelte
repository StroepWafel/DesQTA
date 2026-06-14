<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  import { tooltip, type TooltipParam } from '$lib/actions/tooltip';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'info';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    disabled?: boolean;
    loading?: boolean;
    icon?: any;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    class?: string;
    ariaLabel?: string;
    /** Hover/focus tooltip via the shared tooltip action */
    tooltip?: TooltipParam;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    type = 'button',
    onclick = () => {},
    class: className = '',
    ariaLabel,
    tooltip: tooltipText,
    children,
  }: Props = $props();

  // Lo-fi button:
  // - primary: solid accent fill, white text
  // - secondary: 1px border, transparent fill, accent-on-hover surface
  // - ghost: no border, hover surface only
  // - danger: solid destructive
  // - success/warning/info kept for callsite compatibility but in calmer tones
  // No scale on hover - just a small bg shift. Calm motion.
  const variants = {
    primary:
      'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 border-transparent shadow-[0_1px_2px_-1px_rgba(0,0,0,0.08)]',
    secondary:
      'bg-transparent text-foreground border-border hover:bg-surface-muted active:bg-surface-3 hover:border-border-strong',
    ghost:
      'bg-transparent text-foreground border-transparent hover:bg-surface-muted active:bg-surface-3',
    danger:
      'bg-destructive text-white hover:opacity-90 active:opacity-80 border-transparent',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 border-transparent',
    warning:
      'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 border-transparent',
    info:
      'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 border-transparent',
  };

  const sizes = {
    xs: 'h-7 px-2.5 text-xs',
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-base',
    xl: 'h-12 px-6 text-base',
  };

  const iconSizes = {
    xs: '12',
    sm: '14',
    md: '16',
    lg: '18',
    xl: '20',
  };

  /** Icon-only buttons with ariaLabel get a tooltip unless one is set explicitly. */
  let resolvedTooltip = $derived(
    tooltipText ?? (icon && !children && ariaLabel ? ariaLabel : undefined),
  );

  let baseClasses = $derived(
    [
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-colors duration-150 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      fullWidth ? 'w-full' : '',
      variants[variant],
      sizes[size],
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );
</script>

<button
  {type}
  class={baseClasses}
  {disabled}
  {onclick}
  aria-label={ariaLabel}
  aria-busy={loading}
  use:tooltip={resolvedTooltip}>
  {#if loading}
    <div class="animate-spin rounded-full border-2 border-transparent border-t-current w-4 h-4">
    </div>
  {:else if icon && iconPosition === 'left'}
    <Icon src={icon} size={iconSizes[size]} />
  {/if}

  {#if children}
    {@render children()}
  {/if}

  {#if !loading && icon && iconPosition === 'right'}
    <Icon src={icon} size={iconSizes[size]} />
  {/if}
</button>
