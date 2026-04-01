<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Icon, Home, CalendarDays, BookOpen, ChatBubbleLeftRight, Bars3 } from 'svelte-hero-icons';
  import { _ } from '$lib/i18n';
  import T from './T.svelte';

  interface NavItem {
    labelKey: string;
    path: string | null;
    icon: typeof Home;
    isMore?: boolean;
  }

  const NAV_ITEMS: NavItem[] = [
    { labelKey: 'navigation.dashboard', path: '/', icon: Home },
    { labelKey: 'navigation.timetable', path: '/timetable', icon: CalendarDays },
    { labelKey: 'navigation.courses', path: '/courses', icon: BookOpen },
    { labelKey: 'navigation.messages', path: '/direqt-messages', icon: ChatBubbleLeftRight },
    { labelKey: 'navigation.more', path: null, icon: Bars3, isMore: true },
  ];

  interface Props {
    onOpenSidebar: () => void;
    onCloseSidebar?: () => void;
  }

  let { onOpenSidebar, onCloseSidebar }: Props = $props();

  function isActive(item: NavItem): boolean {
    if (item.isMore) return false;
    if (item.path === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(item.path!);
  }

  function handleClick(item: NavItem) {
    if (item.isMore) {
      onOpenSidebar();
    } else if (item.path) {
      onCloseSidebar?.();
      goto(item.path);
    }
  }
</script>

<nav
  class="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-zinc-200/60 dark:border-zinc-700/40 theme-bg bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/80"
  style="min-height: 56px;"
  aria-label={$_('navigation.menu', { default: 'Main navigation' })}>
  {#each NAV_ITEMS as item}
    <button
      type="button"
      class="flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 gap-0.5 min-h-[44px] transition-all duration-200 ease-in-out rounded-2xl mx-1 {isActive(item)
        ? 'accent-bg text-white'
        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95'}"
      onclick={() => handleClick(item)}
      aria-label={$_(item.labelKey, { default: item.labelKey })}
      aria-current={item.isMore ? undefined : isActive(item) ? 'page' : undefined}>
      <Icon src={item.icon} class="w-6 h-6" />
      <span class="text-xs font-medium truncate max-w-full">
        <T key={item.labelKey} fallback={item.labelKey} />
      </span>
    </button>
  {/each}
</nav>
