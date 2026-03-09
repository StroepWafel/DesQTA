<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Message } from '../types';
  import MessageItem from '$lib/components/MessageItem.svelte';
  import { EmptyState } from '$lib/components/ui';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../../lib/i18n';
  import { Inbox, ExclamationTriangle } from 'svelte-hero-icons';

  let { selectedFolder, messages, loading, error, selectedMessage, openMessage, embedded } =
    $props<{
      selectedFolder: string;
      messages: Message[];
      loading: boolean;
      error: string | null;
      selectedMessage: Message | null;
      openMessage: (msg: Message) => void;
      embedded?: boolean;
    }>();

  // Filter messages for the selected folder
  const filteredMessages = $derived(messages.filter((m: Message) => m.folder === selectedFolder));

  // Create a unique key that changes when folder or messages change to force re-render
  const messagesKey = $derived.by(() => {
    const ids = filteredMessages.map((m: any) => m.id).join(',');
    return `${selectedFolder}-${filteredMessages.length}-${ids}`;
  });
</script>

<section
  class="w-full min-w-0 flex flex-col min-h-0 [scrollbar-gutter:stable]
    {embedded
    ? 'flex-none min-h-0 bg-transparent pt-4'
    : 'flex-1 overflow-hidden bg-white dark:bg-zinc-900 border-r border-zinc-300/50 dark:border-zinc-800/50 backdrop-blur-xs shadow-md rounded-xl m-2'}">
  <div
    class="flex items-center p-4 text-base font-semibold text-zinc-900 sm:text-lg dark:text-white {!embedded
      ? 'border-b border-zinc-300/50 dark:border-zinc-800/50'
      : ''}">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mr-2 w-5 h-5"
      viewBox="0 0 20 20"
      fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
    {selectedFolder}
  </div>

  <div
    class="overflow-y-auto flex-1 min-h-0 p-1 scrollbar-thin scrollbar-thumb-zinc-400/30 scrollbar-track-transparent [scrollbar-gutter:stable] {embedded ? 'pb-4' : ''}"
    style="-webkit-overflow-scrolling: touch;">
    {#if loading}
      <div
        class="flex justify-center items-center flex-1 min-h-[200px]"
        in:fade={{ duration: 400 }}>
        <div
          class="w-12 h-12 rounded-full border-4 border-accent-600/30 border-t-accent-600 animate-spin">
        </div>
      </div>
    {:else if error}
      <div
        class="flex flex-col justify-center items-center flex-1 min-h-[200px]"
        in:fade={{ duration: 400 }}>
        <EmptyState
          title={$_('messages.failed_to_load') || 'Failed to load messages.'}
          message={error}
          icon={ExclamationTriangle}
          size="sm" />
      </div>
    {:else if filteredMessages.length === 0}
      <div
        class="flex flex-col justify-center items-center flex-1 min-h-[200px]"
        in:fade={{ duration: 400 }}>
        <EmptyState
          title={$_('messages.no_messages_in_folder') || 'No messages in this folder.'}
          message={$_('messages.no_messages_in_folder_hint') ||
            'Select another feed or check back later.'}
          icon={Inbox}
          size="sm" />
      </div>
    {:else}
      <div class="p-2 min-w-0">
        {#key messagesKey}
          {#each filteredMessages as message, i (`${message.id}-${i}`)}
            <div class="message-item-animate min-w-0" style="animation-delay: {i * 50}ms;">
              <MessageItem {message} {selectedMessage} {openMessage} {embedded} />
            </div>
          {/each}
        {/key}
      </div>
    {/if}
  </div>
</section>

<style>
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--accent-color-value, #3b82f6) 30%, transparent);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--accent-color-value, #3b82f6) 50%, transparent);
  }

  /* Hide native scrollbar buttons (up/down arrows) */
  .scrollbar-thin::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  /* Firefox - hide scrollbar buttons */
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--accent-color-value, #3b82f6) 30%, transparent)
      transparent;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message-item-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
