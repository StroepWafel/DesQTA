<script lang="ts">
  import type { Message } from '../types';
  import MessageItem from '$lib/components/MessageItem.svelte';

  let { selectedFolder, messages, loading, error, selectedMessage, openMessage } = $props<{
    selectedFolder: string;
    messages: Message[];
    loading: boolean;
    error: string | null;
    selectedMessage: Message | null;
    openMessage: (msg: Message) => void;
  }>();

  // Filter messages for the selected folder
  const filteredMessages = $derived(messages.filter((m: Message) => m.folder === selectedFolder));
</script>

<section
  class="w-full xl:w-md border-r border-zinc-300/50 dark:border-zinc-800/50 flex flex-col bg-white dark:bg-zinc-900 backdrop-blur-xs shadow-md rounded-xl m-2">
  <div
    class="flex items-center p-4 text-base font-semibold border-b text-zinc-900 sm:text-lg border-zinc-300/50 dark:border-zinc-800/50 dark:text-white">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mr-2 w-5 h-5"
      viewBox="0 0 20 20"
      fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
    {selectedFolder}
  </div>

  <div class="overflow-y-scroll flex-1 p-1">
    {#if loading}
      <div class="p-2 space-y-2">
        {#each Array(6) as _, i}
          <div class="flex gap-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 animate-pulse">
            <div class="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex-shrink-0"></div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="h-5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800"></div>
              <div class="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800"></div>
              <div class="h-3.5 w-3/5 rounded bg-zinc-200 dark:bg-zinc-800"></div>
            </div>
            <div class="w-12 h-4 self-start rounded bg-zinc-200 dark:bg-zinc-800"></div>
          </div>
        {/each}
      </div>
    {:else if error}
      <div class="flex justify-center items-center p-8 h-32 text-center text-red-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-2 w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm sm:text-base">{error}</span>
      </div>
    {:else if filteredMessages.length === 0}
      <div
        class="flex flex-col justify-center items-center p-8 h-32 text-center text-zinc-600 dark:text-zinc-300">
        <div
          class="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-blue-500 text-2xl sm:text-3xl shadow-[0_0_20px_rgba(99,102,241,0.3)] animate-gradient">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-8 h-8 sm:w-10 sm:h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p class="mt-4 text-sm sm:text-base">No messages in this folder.</p>
      </div>
    {:else}
      <div class="overflow-y-scroll p-2 scrollbar-thin scrollbar-thumb-accent-500/30 scrollbar-track-zinc-800/10">
        {#each filteredMessages as message (message.id)}
          <MessageItem 
            {message}
            {selectedMessage}
            {openMessage}
          />
        {/each}
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
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
  }

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
</style>
