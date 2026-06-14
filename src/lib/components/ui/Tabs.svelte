<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Tab {
    id: string;
    label: string;
    icon?: any;
    disabled?: boolean;
    badge?: string | number;
  }

  interface Props {
    tabs: Tab[];
    activeTab?: string;
    variant?: 'default' | 'pills' | 'underline';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    class?: string;
    onTabChange?: (tabId: string) => void;
    children?: Snippet<[string]>;
  }

  let {
    tabs,
    activeTab = $bindable(tabs[0]?.id || ''),
    variant = 'default',
    size = 'md',
    fullWidth = false,
    class: className = '',
    onTabChange,
    children
  }: Props = $props();

  function handleTabClick(tab: Tab) {
    if (tab.disabled) return;
    activeTab = tab.id;
    if (onTabChange) onTabChange(tab.id);
  }

  // Lo-fi tabs: editorial underline style is the default look.
  const variants = {
    default: {
      container: 'border-b border-border',
      tab: 'border-b-2 border-transparent hover:text-foreground',
      active: 'border-accent-500 text-accent-600',
      inactive: 'text-muted-foreground'
    },
    pills: {
      container: 'bg-surface-muted rounded-lg p-1 gap-1',
      tab: 'rounded-md transition-colors duration-150',
      active: 'bg-card text-foreground border border-border',
      inactive: 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
    },
    underline: {
      container: '',
      tab: 'border-b-2 border-transparent transition-colors duration-150',
      active: 'border-accent-500 text-accent-600',
      inactive: 'text-muted-foreground hover:text-foreground hover:border-border'
    }
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base'
  };

  let containerClasses = $derived([
    'flex',
    fullWidth ? 'w-full' : '',
    variants[variant].container,
    className
  ].filter(Boolean).join(' '));

  let tabClasses = $derived((tab: Tab) => [
    'inline-flex items-center gap-2 font-medium cursor-pointer transition-colors duration-150',
    fullWidth ? 'flex-1 justify-center' : '',
    sizes[size],
    variants[variant].tab,
    tab.id === activeTab ? variants[variant].active : variants[variant].inactive,
    tab.disabled ? 'opacity-50 cursor-not-allowed' : ''
  ].filter(Boolean).join(' '));
</script>

<div>
  <div class={containerClasses} role="tablist">
    {#each tabs as tab}
      <button
        class={tabClasses(tab)}
        onclick={() => handleTabClick(tab)}
        disabled={tab.disabled}
        aria-selected={tab.id === activeTab}
        role="tab"
      >
        {#if tab.icon}
          <Icon src={tab.icon} size="16" />
        {/if}

        <span>{tab.label}</span>

        {#if tab.badge}
          <span class="ml-1.5 bg-surface-3 text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold border border-border-subtle">
            {tab.badge}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  {#if children}
    <div class="mt-6">
      {@render children(activeTab)}
    </div>
  {/if}
</div>
