<script lang="ts">
  import { page } from '$app/stores';
  import { Icon } from 'svelte-hero-icons';
  import { XMark } from 'svelte-hero-icons';
  import { _ } from '../i18n';
  import T from './T.svelte';

  interface MenuItem {
    labelKey: string;
    icon: any;
    path: string;
  }

  interface Props {
    sidebarOpen: boolean;
    menu: MenuItem[];
    onMenuItemClick?: () => void;
  }

  let { sidebarOpen, menu, onMenuItemClick }: Props = $props();

  function handleMenuItemClick() {
    if (onMenuItemClick) {
      onMenuItemClick();
    }
  }

  function handleCloseSidebar() {
    if (onMenuItemClick) {
      onMenuItemClick();
    }
  }
</script>

<!-- Parent container that controls width animation -->
<aside
  class="transition-all duration-300 ease-in-out overflow-hidden sm:relative"
  class:fixed={sidebarOpen}
  class:top-0={sidebarOpen}
  class:left-0={sidebarOpen}
  class:h-full={sidebarOpen}
  class:z-30={sidebarOpen}
  class:w-full={sidebarOpen}
  class:w-0={!sidebarOpen}
  class:opacity-0={!sidebarOpen}
  class:pointer-events-none={!sidebarOpen}
  class:opacity-100={sidebarOpen}
  class:pointer-events-auto={sidebarOpen}
  class:sm:opacity-100={sidebarOpen}
  class:sm:pointer-events-auto={sidebarOpen}
  class:sm:w-64={sidebarOpen}
  class:sm:w-0={!sidebarOpen}
  class:sm:z-auto={sidebarOpen}
>
  <!-- Nav with fixed width and absolute positioning -->
  <nav class="absolute top-0 right-0 w-full sm:w-64 h-full overflow-y-auto p-3 py-px space-y-2 transition-transform duration-300 ease-in-out bg-transparent">
    <!-- Mobile Close Button -->
    <div class="flex justify-end sm:hidden mb-4">
      <button
        onclick={handleCloseSidebar}
        class="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        aria-label={$_('navigation.close_sidebar', { default: 'Close sidebar' })}
      >
        <Icon src={XMark} class="w-5 h-5" />
      </button>
    </div>

    <!-- Mobile Header -->
    <div class="sm:hidden mb-6">
      <h2 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">
        <T key="navigation.menu" fallback="Menu" />
      </h2>
      <div class="w-12 h-1 bg-accent-500 rounded-full"></div>
    </div>

    {#each menu as item}
      <a
        href={item.path}
        onclick={handleMenuItemClick}
        class="flex gap-4 items-center text-md px-3 py-3 font-medium rounded-xl transition-all duration-150 ease-out focus:outline-hidden {(
          item.path === '/'
            ? $page.url.pathname === '/'
            : $page.url.pathname.startsWith(item.path)
        )
          ? 'bg-accent text-white'
          : 'text-zinc-900 dark:text-zinc-300 hover:bg-accent-200 hover:text-zinc-900 dark:hover:bg-accent-600 dark:hover:text-white'} playful">
        <Icon
          src={item.icon}
          class="w-6 h-6 {(
            item.path === '/'
              ? $page.url.pathname === '/'
              : $page.url.pathname.startsWith(item.path)
          )
            ? 'text-white'
            : 'text-zinc-600 dark:text-zinc-400'}" />
        <span><T key={item.labelKey} fallback={item.labelKey} /></span>
      </a>
    {/each}
  </nav>
</aside>
