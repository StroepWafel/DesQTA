<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ChevronDown } from 'svelte-hero-icons';
  import { clickOutside } from '$lib/actions/clickOutside.js';
  import { fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';

  interface DropdownItem {
    id: string;
    label: string;
    icon?: any;
    disabled?: boolean;
    separator?: boolean;
    danger?: boolean;
    onClick?: () => void;
  }

  interface Props {
    items: DropdownItem[];
    trigger?: Snippet;
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
    disabled?: boolean;
    class?: string;
    menuClass?: string;
    buttonText?: string;
    buttonIcon?: any;
    showChevron?: boolean;
    closeOnClick?: boolean;
  }

  let {
    items,
    trigger,
    placement = 'bottom-start',
    disabled = false,
    class: className = '',
    menuClass = '',
    buttonText = 'Menu',
    buttonIcon,
    showChevron = true,
    closeOnClick = true,
  }: Props = $props();

  let open = $state(false);
  let dropdownElement: HTMLElement;

  function toggleDropdown() {
    if (disabled) return;
    open = !open;
  }

  function closeDropdown() {
    open = false;
  }

  function handleItemClick(item: DropdownItem) {
    if (item.disabled) return;
    if (item.onClick) item.onClick();
    if (closeOnClick) closeDropdown();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeDropdown();
  }

  const placementClasses = {
    'bottom-start': 'top-full left-0 mt-2',
    'bottom-end': 'top-full right-0 mt-2',
    'top-start': 'bottom-full left-0 mb-2',
    'top-end': 'bottom-full right-0 mb-2',
  };

  // Lo-fi trigger: analytics-pattern - quiet 1px border, no shadow, accent on focus
  let buttonClasses = $derived(
    [
      'inline-flex items-center gap-2 h-10 px-3.5 text-sm font-medium text-foreground',
      'bg-card border border-border rounded-lg',
      'hover:border-border-strong hover:bg-surface-muted',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1',
      'transition-colors duration-150',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );

  // Lo-fi panel: opaque popover surface, 1px border, single soft shadow
  let menuClasses = $derived(
    [
      'absolute z-50 min-w-48 py-1 bg-popover text-popover-foreground border border-border',
      'rounded-xl shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12),0_2px_6px_-2px_rgba(0,0,0,0.06)]',
      placementClasses[placement],
      menuClass,
    ]
      .filter(Boolean)
      .join(' '),
  );
</script>

<div class="relative inline-block text-left" bind:this={dropdownElement}>
  <button
    class={buttonClasses}
    onclick={toggleDropdown}
    onkeydown={handleKeydown}
    {disabled}
    aria-expanded={open}
    aria-haspopup="true">
    {#if trigger}
      {@render trigger()}
    {:else}
      {#if buttonIcon}
        <Icon src={buttonIcon} size="16" />
      {/if}

      <span>{buttonText}</span>

      {#if showChevron}
        <Icon
          src={ChevronDown}
          size="16"
          class="transition-transform duration-150 {open ? 'rotate-180' : ''} text-muted-foreground" />
      {/if}
    {/if}
  </button>

  {#if open}
    <div
      class={menuClasses}
      use:clickOutside={() => closeDropdown()}
      role="menu"
      aria-orientation="vertical"
      transition:fly={{ y: -4, duration: 150, opacity: 0, easing: (t) => t * (2 - t) }}>
      {#each items as item}
        {#if item.separator}
          <div class="border-t border-border-subtle my-1"></div>
        {:else}
          <button
            class="group flex items-center w-full px-3.5 py-2 text-sm transition-colors duration-100 {item.disabled
              ? 'opacity-50 cursor-not-allowed text-muted-foreground'
              : item.danger
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground hover:bg-surface-muted'}"
            onclick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem">
            {#if item.icon}
              <Icon
                src={item.icon}
                size="16"
                class="mr-3 text-muted-foreground group-hover:text-foreground" />
            {/if}

            <span class="flex-1 text-left">{item.label}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>
