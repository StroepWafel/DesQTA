<script lang="ts">
import { createEventDispatcher, onMount } from 'svelte';
import { goto } from '$app/navigation';
import { writable, derived } from 'svelte/store';
import { Icon, Squares2x2 } from 'svelte-hero-icons';
import { scale } from 'svelte/transition';
import { _ } from '$lib/i18n';

const dispatch = createEventDispatcher();

const pages = [
  { labelKey: 'navigation.dashboard', path: '/' },
  { labelKey: 'navigation.analytics', path: '/analytics' },
  { labelKey: 'navigation.assessments', path: '/assessments' },
  { labelKey: 'navigation.courses', path: '/courses' },
  { labelKey: 'navigation.directory', path: '/directory' },
  { labelKey: 'navigation.messages', path: '/direqt-messages' },
  { labelKey: 'navigation.news', path: '/news' },
  { labelKey: 'navigation.notices', path: '/notices' },
  { labelKey: 'navigation.qr_signin', path: '/qrsignin' },
  { labelKey: 'navigation.reports', path: '/reports' },
  { labelKey: 'navigation.settings', path: '/settings' },
  { labelKey: 'navigation.timetable', path: '/timetable' },
  { labelKey: 'navigation.welcome', path: '/welcome' },
];

const searchStore = writable('');
const showDropdownStore = writable(true);
const filteredPages = derived([searchStore, _], ([$search, $format]) => {
  if (!$search) return pages;
  const query = $search.toLowerCase();
  return pages.filter((p) => $format(p.labelKey).toLowerCase().includes(query));
});
let selectedIndex = $state(0);
let searchInput: HTMLInputElement | null = null;

$effect(() => {
  if ($filteredPages.length > 0 && selectedIndex >= $filteredPages.length) {
    selectedIndex = 0;
  }
});

function handleSelect(page: { labelKey: string; path: string }) {
  searchStore.set('');
  showDropdownStore.set(false);
  dispatch('close');
  goto(page.path);
}

function handleKeydown(e: KeyboardEvent) {
  if (!$showDropdownStore || $filteredPages.length === 0) return;
  if (e.key === 'ArrowDown') {
    selectedIndex = (selectedIndex + 1) % $filteredPages.length;
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    selectedIndex = (selectedIndex - 1 + $filteredPages.length) % $filteredPages.length;
    e.preventDefault();
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    handleSelect($filteredPages[selectedIndex]);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    dispatch('close');
  }
}

onMount(() => {
  if (searchInput) searchInput.focus();
  const handleClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.pages-modal')) {
      dispatch('close');
    }
  };
  window.addEventListener('mousedown', handleClick);
  return () => window.removeEventListener('mousedown', handleClick);
});
</script>

<div class="fixed inset-0 z-9999999 flex items-center justify-center bg-foreground/40 mobile-modal-inset">
  <div class="pages-modal relative w-full max-w-xl mx-auto rounded-2xl bg-card text-card-foreground shadow-[0_24px_56px_-16px_rgba(0,0,0,0.22),0_4px_12px_-4px_rgba(0,0,0,0.08)] border border-border p-0 flex flex-col"
    in:scale={{ duration: 180, start: 0.98, opacity: 0 }}
    out:scale={{ duration: 120, start: 1, opacity: 0 }}
    tabindex="-1"
  >
    <div class="flex items-center gap-3 px-5 pt-5 pb-3">
      <span class="text-muted-foreground"><Icon src={Squares2x2} class="w-5 h-5" /></span>
      <input
        id="pages-search-input"
        bind:this={searchInput}
        type="text"
        class="flex-1 h-11 px-3 rounded-lg bg-surface-2 text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 transition-colors duration-150 placeholder:text-muted-foreground/70 text-base"
        placeholder={$_( 'pages_menu.search_placeholder' )}
        bind:value={$searchStore}
        onkeydown={handleKeydown}
        autocomplete="off"
      />
    </div>
    {#if $showDropdownStore && $filteredPages.length > 0}
      <ul
        class="w-full mb-2 px-2 space-y-0.5 max-h-96 overflow-y-auto"
        role="listbox"
      >
        {#each $filteredPages as page, i (page.path)}
          <button
            type="button"
            role="option"
            aria-selected={selectedIndex === i}
            class={`flex items-center gap-3 w-full text-left px-3 py-2.5 cursor-pointer transition-colors duration-150 rounded-md text-sm font-medium ${selectedIndex === i ? 'bg-surface-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted/60'}`}
            onmousedown={() => handleSelect(page)}
            tabindex="-1"
          >
            {#if selectedIndex === i}
              <span class="w-[2px] h-4 rounded bg-accent-500" aria-hidden="true"></span>
            {:else}
              <span class="w-[2px] h-4" aria-hidden="true"></span>
            {/if}
            {$_( page.labelKey )}
          </button>
        {/each}
      </ul>
    {/if}
    <div class="flex items-center gap-4 px-5 pb-4 pt-2 text-[11px] text-muted-foreground border-t border-border-subtle">
      <span class="flex items-center gap-1 pt-3"><kbd class="px-1.5 py-0.5 rounded bg-surface-muted border border-border-subtle nums-tabular">↑</kbd><kbd class="px-1.5 py-0.5 rounded bg-surface-muted border border-border-subtle nums-tabular">↓</kbd> {$_( 'pages_menu.navigate' )}</span>
      <span class="flex items-center gap-1 pt-3"><kbd class="px-1.5 py-0.5 rounded bg-surface-muted border border-border-subtle">⏎</kbd> {$_( 'pages_menu.select' )}</span>
      <span class="flex items-center gap-1 pt-3"><kbd class="px-1.5 py-0.5 rounded bg-surface-muted border border-border-subtle">Esc</kbd> {$_( 'common.close' )}</span>
    </div>
  </div>
</div>