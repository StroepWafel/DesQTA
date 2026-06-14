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
  class="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around bg-card text-card-foreground"
  style="min-height: 56px;"
  aria-label={$_('navigation.menu', { default: 'Main navigation' })}>
  {#each NAV_ITEMS as item}
    {@const active = isActive(item)}
    <button
      type="button"
      class="relative flex flex-col items-center justify-center flex-1 min-w-0 py-2 px-1 gap-1 min-h-[48px] transition-colors duration-150 {active
        ? 'text-accent-500'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => handleClick(item)}
      aria-label={$_(item.labelKey, { default: item.labelKey })}
      aria-current={item.isMore ? undefined : active ? 'page' : undefined}>
      {#if active}
        <span class="absolute top-1.5 w-1 h-1 rounded-full bg-accent-500" aria-hidden="true"></span>
      {/if}
      <Icon src={item.icon} class="w-[22px] h-[22px] mt-1" />
      <span class="text-[10px] font-medium tracking-wide truncate max-w-full">
        <T key={item.labelKey} fallback={item.labelKey} />
      </span>
    </button>
  {/each}
</nav>
