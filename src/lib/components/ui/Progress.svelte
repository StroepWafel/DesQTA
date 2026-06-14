<script lang="ts">
  interface Props {
    value: number;
    max?: number;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    showLabel?: boolean;
    label?: string;
    animated?: boolean;
    striped?: boolean;
    class?: string;
  }

  let {
    value,
    max = 100,
    size = 'md',
    variant = 'default',
    showLabel = false,
    label,
    animated = false,
    striped = false,
    class: className = ''
  }: Props = $props();

  let percentage = $derived(Math.max(0, Math.min(100, (value / max) * 100)));
  let displayLabel = $derived(label || `${Math.round(percentage)}%`);

  // Lo-fi progress: thin flat bar, accent fill, no shimmer by default.
  const sizes = {
    xs: 'h-0.5',
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2'
  };

  const variants = {
    default: 'bg-accent-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-destructive',
    info: 'bg-sky-500'
  };

  let containerClasses = $derived([
    'w-full bg-surface-muted rounded-full overflow-hidden border border-border-subtle',
    sizes[size],
    className
  ].filter(Boolean).join(' '));

  let barClasses = $derived([
    'h-full rounded-full',
    variants[variant],
    animated ? 'transition-[width] duration-300 ease-out' : '',
  ].filter(Boolean).join(' '));
</script>

<div class="space-y-1.5">
  {#if showLabel}
    <div class="flex justify-between items-center text-xs text-muted-foreground uppercase tracking-[0.06em] font-semibold">
      <span>{displayLabel}</span>
      <span class="nums-tabular">{value} / {max}</span>
    </div>
  {/if}

  <div class={containerClasses} role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax={max}>
    <div
      class={barClasses}
      style="width: {percentage}%"
    ></div>
  </div>
</div>
