<script lang="ts">
  import { fly } from 'svelte/transition';
  import { Icon, ChevronDown, Check } from 'svelte-hero-icons';
  import { clickOutside } from '$lib/actions/clickOutside.js';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    id?: string;
    value: string;
    options: Option[];
    onchange: (value: string) => void;
    placeholder?: string;
  }

  let { id, value, options, onchange, placeholder = 'Select…' }: Props = $props();

  let open = $state(false);

  const selectedLabel = $derived(
    options.find((opt) => String(opt.value) === String(value))?.label ?? placeholder,
  );

  function pick(next: string) {
    onchange(next);
    open = false;
  }
</script>

<div class="relative w-full" use:clickOutside={() => (open = false)}>
  <button
    {id}
    type="button"
    class="flex w-full min-h-9 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-surface-muted hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 transition-colors duration-150"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-haspopup="listbox">
    <span class="truncate text-left">{selectedLabel}</span>
    <Icon
      src={ChevronDown}
      class="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-150 {open
        ? 'rotate-180'
        : ''}" />
  </button>

  {#if open}
    <div
      class="absolute left-0 right-0 z-[60] mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground py-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12),0_2px_6px_-2px_rgba(0,0,0,0.06)]"
      role="listbox"
      transition:fly={{ y: -4, duration: 150, opacity: 0, easing: (t) => t * (2 - t) }}>
      {#each options as option (option.value)}
        {@const isSelected = String(option.value) === String(value)}
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-100 {isSelected
            ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
            : 'text-foreground hover:bg-surface-muted'}"
          onclick={() => pick(String(option.value))}>
          <span class="flex w-4 shrink-0 justify-center">
            {#if isSelected}
              <Icon src={Check} class="w-3.5 h-3.5" />
            {/if}
          </span>
          <span class="truncate">{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
