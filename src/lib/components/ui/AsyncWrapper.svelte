<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ArrowPath, ExclamationTriangle, Inbox } from 'svelte-hero-icons';
  import { fly, scale } from 'svelte/transition';
  import LoadingSpinner from '../LoadingSpinner.svelte';
  import EmptyState from '../EmptyState.svelte';
  import ErrorBoundary from '../ErrorBoundary.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    loading?: boolean;
    error?: string | Error | null;
    data?: any;
    empty?: boolean;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: any;
    loadingMessage?: string;
    retryable?: boolean;
    componentName?: string;
    onretry?: () => void;
    children?: Snippet<[any]>;
    loadingSlot?: Snippet;
    errorSlot?: Snippet<[string | Error, () => void]>;
    emptySlot?: Snippet;
  }

  let {
    loading = false,
    error = null,
    data = null,
    empty = false,
    emptyTitle = 'No data found',
    emptyMessage = 'There is no data to display at the moment.',
    emptyIcon = Inbox,
    loadingMessage = 'Loading...',
    retryable = true,
    componentName = 'AsyncWrapper',
    onretry = () => {},
    children,
    loadingSlot,
    errorSlot,
    emptySlot,
  }: Props = $props();

  function handleRetry() {
    if (onretry) {
      onretry();
    }
  }

  let errorMessage = $derived(
    error instanceof Error ? error.message : error || 'An error occurred',
  );
  let showEmpty = $derived(
    !loading &&
      !error &&
      (empty || (Array.isArray(data) && data.length === 0) || (!data && data !== 0)),
  );
  let showContent = $derived(!loading && !error && !showEmpty);
</script>

<ErrorBoundary {componentName}>
  {#if loading}
    {#if loadingSlot}
      {@render loadingSlot()}
    {:else}
      <LoadingSpinner message={loadingMessage} />
    {/if}
  {:else if error}
    {#if errorSlot}
      {@render errorSlot(error, handleRetry)}
    {:else}
      <div
        class="flex flex-col items-center justify-center py-12 space-y-4"
        transition:fly={{ y: 20, duration: 300, easing: (t) => t * (2 - t) }}>
        <div
          class="text-red-500 bg-red-100 dark:bg-red-900/30 rounded-full p-3 transition-all duration-300 ease-in-out transform hover:scale-110"
          transition:scale={{ duration: 300, easing: (t) => t * (2 - t) }}>
          <Icon src={ExclamationTriangle} size="24" />
        </div>
        <div
          class="text-center"
          transition:fly={{ y: 10, duration: 300, delay: 100, easing: (t) => t * (2 - t) }}>
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            Something went wrong
          </h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">
            {errorMessage}
          </p>
        </div>
        {#if retryable}
          <button
            onclick={handleRetry}
            class="inline-flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
            transition:fly={{ y: 10, duration: 300, delay: 200, easing: (t) => t * (2 - t) }}>
            <Icon
              src={ArrowPath}
              size="16"
              class="transition-transform duration-200 group-hover:rotate-180" />
            Try Again
          </button>
        {/if}
      </div>
    {/if}
  {:else if showEmpty}
    {#if emptySlot}
      {@render emptySlot()}
    {:else}
      <EmptyState title={emptyTitle} message={emptyMessage} icon={emptyIcon} />
    {/if}
  {:else if showContent && children}
    {@render children(data)}
  {/if}
</ErrorBoundary>
