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

<div class="fixed inset-0 z-9999999 flex items-center justify-center bg-black/40 backdrop-blur-xs">
  <div class="pages-modal relative w-full max-w-xl mx-auto rounded-2xl bg-white/70 dark:bg-zinc-900/80 shadow-2xl border border-white/20 dark:border-zinc-700/40 backdrop-blur-xl p-0 flex flex-col animate-in"
    style="backdrop-filter: blur(24px);"
    in:scale={{ duration: 180, start: 0.98, opacity: 0 }}
    out:scale={{ duration: 120, start: 1, opacity: 0 }}
    tabindex="-1"
  >
    <div class="flex items-center gap-3 px-6 pt-6 pb-2">
      <span class="text-accent-500"><Icon src={Squares2x2} class="w-6 h-6" /></span>
      <input
        id="pages-search-input"
        bind:this={searchInput}
        type="text"
        class="flex-1 px-4 py-3 rounded-xl bg-white/40 dark:bg-zinc-800/60 text-zinc-900 dark:text-white border border-accent-500/40 focus:outline-hidden focus:ring-2 accent-ring transition-all duration-200 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 text-lg shadow-md"
        placeholder={$_( 'pages_menu.search_placeholder' )}
        bind:value={$searchStore}
        onkeydown={handleKeydown}
        autocomplete="off"
        style="backdrop-filter: blur(8px);"
      />
    </div>
    {#if $showDropdownStore && $filteredPages.length > 0}
      <ul
        class="w-full mt-2 mb-4 px-2 space-y-1 max-h-96 overflow-y-auto"
        role="listbox"
      >
        {#each $filteredPages as page, i (page.path)}
          <button
            type="button"
            role="option"
            aria-selected={selectedIndex === i}
            class={`flex items-center gap-3 w-full text-left px-5 py-3 cursor-pointer transition-all duration-200 rounded-xl hover:scale-[1.02] hover:bg-accent-100 dark:hover:bg-accent-700 text-base font-medium ${selectedIndex === i ? 'bg-accent-500 text-white' : 'text-zinc-900 dark:text-white'}`}
            onmousedown={() => handleSelect(page)}
            tabindex="-1"
          >
            <span class="w-5 h-5 shrink-0 rounded-lg bg-accent-500/20 flex items-center justify-center">
              <!-- Optionally add an icon here in the future -->
            </span>
            {$_( page.labelKey )}
          </button>
        {/each}
      </ul>
    {/if}
    <div class="flex items-center gap-4 px-6 pb-4 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-700">↑</kbd><kbd class="px-1 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-700">↓</kbd> {$_( 'pages_menu.navigate' )}</span>
      <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-700">⏎</kbd> {$_( 'pages_menu.select' )}</span>
      <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-700">Esc</kbd> {$_( 'common.close' )}</span>
    </div>
  </div>
</div> 