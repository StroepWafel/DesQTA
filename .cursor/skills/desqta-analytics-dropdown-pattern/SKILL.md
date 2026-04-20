---
name: desqta-analytics-dropdown-pattern
description: Use the analytics-style custom dropdown instead of Select components for consistency. Use when adding dropdowns, label selectors, or filter pickers that should match the analytics page styling.
---

# DesQTA Analytics Dropdown Pattern

When adding a dropdown (e.g. label selector, filter picker), use the same custom dropdown pattern as analytics—not the Select component.

## Pattern

### 1. State and Imports

```svelte
import { fly } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import { clickOutside } from '$lib/actions/clickOutside.js';
import { Icon } from 'svelte-hero-icons';
import { ChevronDown } from 'svelte-hero-icons';

let showDropdown = $state(false);
```

### 2. Trigger Button

```svelte
<div class="relative" use:clickOutside={() => (showDropdown = false)}>
  <button
    type="button"
    class="flex gap-2 items-center min-h-[44px] w-44 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 accent-ring transition-all duration-200"
    onclick={() => (showDropdown = !showDropdown)}
    aria-expanded={showDropdown}
    aria-haspopup="listbox">
    <span class="truncate flex-1 text-left text-sm">
      {#if selectedValue === null}
        <T key="..." fallback="All" />
      {:else}
        {displayLabel}
      {/if}
    </span>
    <Icon src={ChevronDown} class="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200 {showDropdown ? 'rotate-180' : ''}" />
  </button>
```

### 3. Dropdown Panel

```svelte
{#if showDropdown}
  <div
    class="absolute left-0 z-50 mt-2 w-56 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
    role="listbox"
    transition:fly={{ y: -6, duration: 150, easing: cubicOut }}>
    <!-- Options with checkmark for selected -->
    <button
      type="button"
      role="option"
      class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors {isSelected
        ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
      onclick={() => { ...; showDropdown = false; }}>
      <span class="w-4 shrink-0 flex justify-center">{isSelected ? '✓' : ''}</span>
      <span class="truncate">{label}</span>
    </button>
  </div>
{/if}
```

## Reference

- `src/routes/analytics/+page.svelte` – Subjects dropdown
- `src/routes/notices/+page.svelte` – Label selector (replaced Select with this pattern)
