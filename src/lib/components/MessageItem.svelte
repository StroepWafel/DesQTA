<script lang="ts">
  import type { Message } from '../../routes/direqt-messages/types';

  interface Props {
    message: Message;
    selectedMessage: Message | null;
    openMessage: (msg: Message) => void;
  }

  import { seqtaFetch } from '../../utils/netUtil';

  let { message: msg, selectedMessage, openMessage }: Props = $props();

  let avatarUrl: string | null = $state(null);
  let avatarFailed: boolean = $state(false);

  function initial(name: string): string {
    return (name?.trim()?.charAt(0) || '?').toUpperCase();
  }

  async function loadAvatar() {
    avatarUrl = null;
    avatarFailed = false;
    const uuid = msg?.senderPhoto?.trim();
    if (!uuid) return;
    try {
      const imgBase64 = await seqtaFetch(`/seqta/student/photo/get`, {
        params: { uuid, format: 'low' },
        is_image: true,
      });
      if (imgBase64) {
        avatarUrl = `data:image/png;base64,${imgBase64}`;
      } else {
        avatarFailed = true;
      }
    } catch (e) {
      avatarFailed = true;
    }
  }

  $effect(() => {
    // reload when message or senderPhoto changes
    void loadAvatar();
  });

  // Format date to readable format
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if date is today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Check if date is yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Check if date is within this year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Otherwise return full date
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Check if message has attachments
  function hasAttachment(): boolean {
    return (
      (msg.files && msg.files.length > 0) ||
      msg.attachments === true ||
      msg.preview.includes('(Attachment)')
    );
  }
</script>

<button
  class="group w-full text-left p-3 sm:p-3.5 mb-2 transition-all duration-200 flex gap-3 rounded-xl relative border transform hover:scale-[1.01]
    {selectedMessage?.id === msg.id
    ? 'border-accent-500/70 bg-accent-500/5 shadow-sm focus:ring-2 accent-ring'
    : 'border-zinc-300/40 dark:border-zinc-800/40 hover:border-accent-500/40 dark:hover:border-accent-700/40 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40'}
    focus:outline-hidden"
  onclick={() => openMessage(msg)}>
  <!-- Avatar -->
  <div class="flex-shrink-0">
    {#if avatarUrl && !avatarFailed}
      <img
        src={avatarUrl}
        alt={`Avatar of ${msg.sender}`}
        class="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800"
        onerror={() => (avatarFailed = true)} />
    {:else}
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center bg-accent-500/15 text-accent-700 dark:text-accent-300">
        <span class="text-sm font-semibold">{initial(msg.sender)}</span>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="flex-1 min-w-0 flex flex-col gap-1.5">
    <!-- Row 1: sender + unread + date -->
    <div class="flex justify-between items-center w-full">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="font-semibold text-[13px] sm:text-sm truncate {msg.unread
            ? 'text-accent-600'
            : 'text-zinc-900 dark:text-zinc-100'}">{msg.sender}</span>
        {#if msg.unread}
          <span class="w-1.5 h-1.5 rounded-full bg-accent-500"></span>
        {/if}
      </div>
      <span
        class="ml-2 shrink-0 text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-zinc-200/50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
        >{formatDate(msg.date)}</span>
    </div>

    <!-- Row 2: subject (+ attachment icon) -->
    <div class="flex items-center gap-2 min-w-0">
      <span
        class="font-medium text-sm sm:text-[15px] leading-tight line-clamp-1 {msg.unread
          ? 'text-accent-600'
          : 'text-zinc-800 dark:text-zinc-200'}">{msg.subject}</span>
      {#if hasAttachment()}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      {/if}
    </div>

    <!-- Row 3: to (sm+) + preview -->
    <div
      class="flex items-center gap-1.5 text-[12px] sm:text-xs text-zinc-600 dark:text-zinc-400 min-w-0">
      <span class="hidden sm:inline whitespace-nowrap opacity-70"
        >To: <span class="font-medium text-zinc-700 dark:text-zinc-300">{msg.to}</span></span>
      <span class="hidden sm:inline mx-1">•</span>
      <span class="opacity-80 line-clamp-1">
        {hasAttachment() ? msg.preview.replace(/\(Attachment\)/, '') : msg.preview}
      </span>
    </div>
  </div>
</button>
