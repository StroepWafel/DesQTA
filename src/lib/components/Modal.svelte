<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { Icon, XMark } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { _ } from '../i18n';
  import { tooltip } from '$lib/actions/tooltip';
  import { portal } from '$lib/actions/portal';

  interface Props {
    open: boolean;
    title?: string;
    maxWidth?: string;
    maxHeight?: string;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    ariaLabel?: string;
    className?: string;
    onclose?: () => void;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    title,
    maxWidth = 'max-w-4xl',
    maxHeight = '',
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    ariaLabel = 'Modal',
    className = '',
    onclose = $bindable(() => {}),
    children,
  }: Props = $props();

  function closeModal() {
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEscape && e.key === 'Escape') closeModal();
  }

  function handleBackdropClick() {
    if (closeOnBackdrop) closeModal();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    use:portal
    class="flex fixed inset-x-0 top-16 bottom-0 z-[300] justify-center items-center p-6 mobile-modal-inset"
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    transition:fade={{ duration: 180, easing: (t) => t * (2 - t) }}>
    <div
      class="fixed inset-x-0 top-16 bottom-0 bg-foreground/40 mobile-modal-inset"
      onclick={handleBackdropClick}
      onkeydown={handleKeydown}
      role="button"
      tabindex="0">
    </div>
    <div
      class="overflow-hidden relative w-full {maxWidth} {maxHeight} {className} rounded-2xl border border-border shadow-[0_24px_56px_-16px_rgba(0,0,0,0.22),0_4px_12px_-4px_rgba(0,0,0,0.08)] bg-card text-card-foreground"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="button"
      tabindex="0"
      aria-label={ariaLabel}
      transition:fly={{ y: 8, duration: 200, opacity: 0, easing: (t) => t * (2 - t) }}>
      {#if showCloseButton}
        <div class="absolute top-4 right-4 z-10">
          <button
            onclick={closeModal}
            aria-label={$_('modal.close_modal') || 'Close modal'}
            use:tooltip={$_('modal.close_modal') || 'Close'}
            class="inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1">
            <Icon src={XMark} size="18" />
          </button>
        </div>
      {/if}

      {#if title}
        <div class="px-6 sm:px-8 pt-6 sm:pt-7 pb-4">
          <h2 class="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
      {/if}

      {@render children()}
    </div>
  </div>
{/if}
