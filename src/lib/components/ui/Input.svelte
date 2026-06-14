<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    error?: string;
    label?: string;
    hint?: string;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    leftIcon?: any;
    rightIcon?: any;
    class?: string;
    inputClass?: string;
    id?: string;
    name?: string;
    autocomplete?: string;
    min?: number;
    max?: number;
    step?: number;
    maxlength?: number;
    pattern?: string;
    onchange?: (e: Event) => void;
    oninput?: (e: Event) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    onfocus?: (e: FocusEvent) => void;
    onblur?: (e: FocusEvent) => void;
    rightAction?: Snippet;
  }

  let {
    type = 'text',
    value = $bindable(''),
    placeholder,
    disabled = false,
    readonly = false,
    required = false,
    error,
    label,
    hint,
    size = 'md',
    fullWidth = false,
    leftIcon,
    rightIcon,
    class: className = '',
    inputClass = '',
    id,
    name,
    autocomplete,
    min,
    max,
    step,
    maxlength,
    pattern,
    onchange,
    oninput,
    onkeydown,
    onfocus,
    onblur,
    rightAction,
  }: Props = $props();

  // Lo-fi input: 1px border, generous height, calm focus ring
  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-3.5 text-sm',
    lg: 'h-12 px-4 text-base',
  };

  const iconSizes = {
    sm: '16',
    md: '18',
    lg: '20',
  };

  let hasError = $derived(!!error);
  let hasLeftIcon = $derived(!!leftIcon);
  let hasRightIcon = $derived(!!rightIcon || !!rightAction);

  let containerClasses = $derived([fullWidth ? 'w-full' : '', className].filter(Boolean).join(' '));

  let inputClasses = $derived(
    [
      'w-full border rounded-lg transition-colors duration-150 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-offset-0',
      hasError
        ? 'border-destructive/60 focus:border-destructive focus:ring-destructive/30'
        : 'border-border focus:border-accent-500 focus:ring-accent-500/40 hover:border-border-strong',
      'bg-surface-2 text-foreground',
      'placeholder:text-muted-foreground/70',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      readonly ? 'bg-surface-muted' : '',
      hasLeftIcon ? 'pl-10' : '',
      hasRightIcon ? 'pr-10' : '',
      sizes[size],
      inputClass,
    ]
      .filter(Boolean)
      .join(' '),
  );

  let labelClasses = $derived(
    [
      'block text-xs font-medium mb-1.5 uppercase tracking-[0.06em]',
      hasError ? 'text-destructive' : 'text-muted-foreground',
      required ? "after:content-['*'] after:ml-0.5 after:text-destructive after:normal-case" : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
</script>

<div class={containerClasses}>
  {#if label}
    <label for={id} class={labelClasses}>
      {label}
    </label>
  {/if}

  <div class="relative">
    {#if hasLeftIcon}
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon src={leftIcon} size={iconSizes[size]} class="text-muted-foreground" />
      </div>
    {/if}

    <input
      {type}
      {id}
      {name}
      {placeholder}
      {disabled}
      {readonly}
      {required}
      autocomplete={autocomplete as any}
      {min}
      {max}
      {step}
      {maxlength}
      {pattern}
      bind:value
      class={inputClasses}
      {onchange}
      {oninput}
      {onkeydown}
      {onfocus}
      {onblur} />

    {#if hasRightIcon || rightAction}
      <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
        {#if rightAction}
          {@render rightAction()}
        {:else if rightIcon}
          <Icon src={rightIcon} size={iconSizes[size]} class="text-muted-foreground" />
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
    <p class="mt-1.5 text-xs text-destructive">
      {error}
    </p>
  {:else if hint}
    <p class="mt-1.5 text-xs text-muted-foreground">
      {hint}
    </p>
  {/if}
</div>
