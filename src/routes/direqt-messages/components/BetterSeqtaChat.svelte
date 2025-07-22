<script lang="ts">
import { onMount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from 'svelte-hero-icons';
import { Plus, Inbox, PaperAirplane, Trash, Star, Rss, ChatBubbleLeftRight, UserCircle } from 'svelte-hero-icons';

interface Friend {
  id: number;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  read: boolean;
  createdAt: string;
  sender?: Friend;
  receiver?: Friend;
}

let token: string | null = null;
let cloudUser: any = null;
let friends: Friend[] = [];
let friendsLoading = true;
let friendsError: string | null = null;
let selectedFriend: Friend | null = null;
let messages: Message[] = [];
let messagesLoading = false;
let messagesError: string | null = null;
let newMessage = '';
let sending = false;

async function fetchToken() {
  try {
    const res = await invoke<{ user: any, token: string }>('get_cloud_user');
    cloudUser = res.user;
    token = res?.token || null;
  } catch (e) {
    token = null;
    cloudUser = null;
  }
}

async function fetchFriends() {
  friendsLoading = true;
  friendsError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    friends = await invoke<Friend[]>('get_friends', { token });
  } catch (e) {
    friendsError = e instanceof Error ? e.message : String(e) || 'Failed to load friends.';
    friends = [];
  } finally {
    friendsLoading = false;
  }
}

async function fetchMessages(friend: Friend) {
  messagesLoading = true;
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    messages = await invoke<Message[]>('get_messages', { token, userId: friend.id });
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    messages = [];
  } finally {
    messagesLoading = false;
  }
}

async function sendMessage() {
  if (!newMessage.trim() || !selectedFriend || !token) return;
  sending = true;
  try {
    const msg = await invoke<Message>('send_message', {
      token,
      receiverId: selectedFriend.id,
      content: newMessage.trim(),
    });
    messages = [...messages, msg];
    newMessage = '';
  } catch (e) {
    // Optionally show error
  } finally {
    sending = false;
  }
}

function selectFriend(friend: Friend) {
  selectedFriend = friend;
  fetchMessages(friend);
}

onMount(() => {
  fetchToken().then(fetchFriends);
});
</script>

<div class="flex h-full w-full">
  <!-- Friends sidebar -->
  <aside class="w-64 min-w-[200px] max-w-xs bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-4">
    <div class="flex items-center gap-2 mb-2">
      <Icon src={ChatBubbleLeftRight} class="w-5 h-5 text-accent-500" />
      <span class="font-semibold text-lg text-gray-900 dark:text-white">Friends</span>
    </div>
    {#if friendsLoading}
      <div class="text-gray-500 dark:text-gray-300">Loading friends...</div>
    {:else if friendsError}
      <div class="text-red-500 dark:text-red-400">{friendsError}</div>
    {:else if friends.length === 0}
      <div class="text-gray-500 dark:text-gray-300">No friends found.</div>
    {:else}
      <ul class="flex-1 overflow-y-auto space-y-2">
        {#each friends as friend}
          <li>
            <button class="flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent-100 dark:hover:bg-accent-700 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedFriend?.id === friend.id ? 'bg-accent-500 text-white' : 'text-gray-900 dark:text-white'}" on:click={() => selectFriend(friend)}>
              {#if friend.pfpUrl}
                <img src={friend.pfpUrl} alt={friend.displayName} class="w-8 h-8 rounded-full object-cover" />
              {:else}
                <Icon src={UserCircle} class="w-8 h-8 text-accent-500" />
              {/if}
              <span class="font-medium">{friend.displayName || friend.username}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </aside>

  <!-- Chat area -->
  <section class="flex-1 flex flex-col h-full bg-white dark:bg-gray-800 p-4">
    {#if selectedFriend}
      <div class="flex items-center gap-3 mb-4">
        {#if selectedFriend.pfpUrl}
          <img src={selectedFriend.pfpUrl} alt={selectedFriend.displayName} class="w-10 h-10 rounded-full object-cover" />
        {:else}
          <Icon src={UserCircle} class="w-10 h-10 text-accent-500" />
        {/if}
        <span class="font-semibold text-lg text-gray-900 dark:text-white">{selectedFriend.displayName || selectedFriend.username}</span>
      </div>
      <div class="flex-1 overflow-y-auto flex flex-col gap-2 pb-4">
        {#if messagesLoading}
          <div class="text-gray-500 dark:text-gray-300">Loading messages...</div>
        {:else if messagesError}
          <div class="text-red-500 dark:text-red-400">{messagesError}</div>
        {:else if messages.length === 0}
          <div class="text-gray-500 dark:text-gray-300">No messages yet. Say hi!</div>
        {:else}
          {#each messages as msg}
            <div class="flex {msg.senderId === selectedFriend.id ? 'justify-start' : 'justify-end'}">
              <div class="max-w-[70%] px-4 py-2 rounded-2xl shadow-md {msg.senderId === selectedFriend.id ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'bg-accent-500 text-white'}">
                <div class="text-sm">{msg.content}</div>
                <div class="text-xs mt-1 text-gray-500 dark:text-gray-300">{new Date(msg.createdAt).toLocaleString()}</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      <form class="flex gap-2 mt-auto" on:submit|preventDefault={sendMessage}>
        <input type="text" class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ring-accent-500 transition-colors duration-200" placeholder="Type a message..." bind:value={newMessage} disabled={sending} />
        <button type="submit" class="px-4 py-2 rounded-lg bg-accent-500 text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" disabled={!newMessage.trim() || sending}>
          <Icon src={PaperAirplane} class="w-5 h-5" />
          <span>Send</span>
        </button>
      </form>
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-300">
        <Icon src={ChatBubbleLeftRight} class="w-12 h-12 mb-2 text-accent-500" />
        <div class="text-lg font-semibold">Select a friend to start chatting</div>
      </div>
    {/if}
  </section>
</div>

<!-- No <style> block needed, all styles are now Tailwind classes in markup --> 