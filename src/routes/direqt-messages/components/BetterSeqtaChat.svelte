<script lang="ts">
import { onMount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from 'svelte-hero-icons';
import { Plus, Inbox, PaperAirplane, Trash, Star, Rss, ChatBubbleLeftRight, UserCircle } from 'svelte-hero-icons';
import { afterUpdate } from 'svelte';

interface Friend {
  id: number;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

interface GroupMember {
  id: number;
  displayName?: string;
}

interface Group {
  id: number;
  name: string;
  iconUrl?: string | null;
  members: GroupMember[];
}

interface Attachment {
  id: number;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  url: string;
  isPublic: boolean;
  createdAt: string;
}

interface MessageReply {
  id: number;
  content: string;
}

interface Message {
  id: number;
  senderId: number;
  receiverId?: number;
  groupId?: number;
  content: string;
  read: boolean;
  createdAt: string;
  replyToId?: number;
  replyTo?: MessageReply;
  attachmentId?: number;
  attachment?: Attachment;
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
let chatEnd: HTMLDivElement | null = null;

let groups: Group[] = [];
let groupsLoading = true;
let groupsError: string | null = null;
let selectedGroup: Group | null = null;
let creatingGroup = false;
let newGroupName = '';
let newGroupMembers: number[] = [];

let replyTo: Message | null = null;
let attachmentFile: File | null = null;
let attachmentPreview: string | null = null;
let uploadingAttachment = false;
let uploadedAttachment: Attachment | null = null;

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

async function fetchGroups() {
  groupsLoading = true;
  groupsError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    groups = await invoke<Group[]>('list_groups', { token });
  } catch (e) {
    groupsError = e instanceof Error ? e.message : String(e) || 'Failed to load groups.';
    groups = [];
  } finally {
    groupsLoading = false;
  }
}

async function createGroup() {
  if (!newGroupName.trim() || newGroupMembers.length === 0 || !token) return;
  creatingGroup = true;
  try {
    const group = await invoke<Group>('create_group', {
      token,
      name: newGroupName.trim(),
      member_ids: newGroupMembers,
    });
    groups = [...groups, group];
    selectedGroup = group;
    newGroupName = '';
    newGroupMembers = [];
  } catch (e) {
    // Optionally show error
  } finally {
    creatingGroup = false;
  }
}

async function uploadAttachmentFile(file: File): Promise<Attachment | null> {
  if (!token) return null;
  uploadingAttachment = true;
  try {
    // TODO: Implement file upload logic (invoke 'upload_attachment')
    // For now, just return null
    return null;
  } finally {
    uploadingAttachment = false;
  }
}

async function sendMessage() {
  if (!newMessage.trim() || (!selectedFriend && !selectedGroup) || !token) return;
  // Extra guard: if both are null, do not proceed
  if (!selectedFriend && !selectedGroup) {
    return;
  }
  sending = true;
  try {
    let attachmentId: number | undefined = undefined;
    if (attachmentFile) {
      const uploaded = await uploadAttachmentFile(attachmentFile);
      if (uploaded) {
        uploadedAttachment = uploaded;
        attachmentId = uploaded.id;
      }
    }
    // Only include receiver_id or group_id as required
    const args: Record<string, any> = {
      token,
      content: newMessage.trim(),
      replyToId: replyTo ? replyTo.id : undefined,
      attachmentId: attachmentId,
    };
    if (selectedFriend) args.receiverId = selectedFriend.id;
    if (selectedGroup) args.groupId = selectedGroup.id;
    // Do not send if neither is set
    if (!args.receiverId && !args.groupId) throw new Error('No recipient selected');
    const msg = await invoke<Message>('send_message', args);
    messages = [...messages, msg];
    newMessage = '';
    replyTo = null;
    attachmentFile = null;
    attachmentPreview = null;
    uploadedAttachment = null;
  } catch (e) {
    // Optionally show error
  } finally {
    sending = false;
  }
}

function selectFriend(friend: Friend) {
  selectedFriend = friend;
  selectedGroup = null;
  fetchMessagesForFriend(friend);
}

async function fetchMessagesForFriend(friend: Friend) {
  messagesLoading = true;
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    messages = await invoke<Message[]>('get_messages', { token, id: friend.id });
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    messages = [];
  } finally {
    messagesLoading = false;
  }
}

function selectGroup(group: Group) {
  selectedGroup = group;
  selectedFriend = null;
  fetchMessagesForGroup(group);
}

async function fetchMessagesForGroup(group: Group) {
  messagesLoading = true;
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    messages = await invoke<Message[]>('get_messages', { token, id: group.id });
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    messages = [];
  } finally {
    messagesLoading = false;
  }
}

function handleReply(msg: Message) {
  replyTo = msg;
}

function cancelReply() {
  replyTo = null;
}

function handleAttachmentChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) {
    attachmentFile = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      attachmentPreview = ev.target?.result as string;
    };
    reader.readAsDataURL(files[0]);
  }
}

onMount(() => {
  fetchToken().then(() => {
    fetchFriends();
    fetchGroups();
  });
});

afterUpdate(() => {
  if (chatEnd) chatEnd.scrollIntoView({ behavior: 'smooth' });
});
</script>

<div class="flex h-full w-full">
  <!-- Friends sidebar -->
  <aside class="w-64 min-w-[200px] max-w-xs bg-white/10 dark:bg-slate-900/60 border-r border-slate-300/50 dark:border-slate-800/50 shadow-md rounded-xl m-2 p-4 flex flex-col gap-4 backdrop-blur-sm">
    <div class="flex items-center gap-2 mb-2">
      <Icon src={ChatBubbleLeftRight} class="w-5 h-5 text-accent-500" />
      <span class="font-semibold text-lg text-slate-900 dark:text-white">Friends</span>
    </div>
    {#if friendsLoading}
      <div class="text-slate-500 dark:text-slate-300">Loading friends...</div>
    {:else if friendsError}
      <div class="text-red-500 dark:text-red-400">{friendsError}</div>
    {:else if friends.length === 0}
      <div class="text-slate-500 dark:text-slate-300">No friends found.</div>
    {:else}
      <ul class="flex-1 overflow-y-auto space-y-2">
        {#each friends as friend}
          <li>
            <button class="flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedFriend?.id === friend.id ? 'bg-accent-500/20 text-accent-500' : 'text-slate-900 dark:text-white'}" on:click={() => selectFriend(friend)}>
              {#if friend.pfpUrl}
                <img src={friend.pfpUrl} alt={friend.displayName || friend.username} class="w-8 h-8 rounded-full object-cover" />
              {:else}
                <Icon src={UserCircle} class="w-8 h-8 text-accent-500" />
              {/if}
              <span class="font-medium">{friend.displayName || friend.username}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="mt-6">
      <div class="flex items-center gap-2 mb-2">
        <span class="font-semibold text-lg text-slate-900 dark:text-white">Groups</span>
        <button class="ml-auto px-2 py-1 rounded bg-accent-500 text-white text-xs hover:bg-accent-600 transition" on:click={() => (creatingGroup = true)}>+ New</button>
      </div>
      {#if groupsLoading}
        <div class="text-slate-500 dark:text-slate-300">Loading groups...</div>
      {:else if groupsError}
        <div class="text-red-500 dark:text-red-400">{groupsError}</div>
      {:else if groups.length === 0}
        <div class="text-slate-500 dark:text-slate-300">No groups found.</div>
      {:else}
        <ul class="flex-1 overflow-y-auto space-y-2">
          {#each groups as group}
            <li>
              <button class="flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedGroup?.id === group.id ? 'bg-accent-500/20 text-accent-500' : 'text-slate-900 dark:text-white'}" on:click={() => selectGroup(group)}>
                <span class="font-medium">{group.name}</span>
                <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">{group.members.length} members</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if creatingGroup}
        <div class="mt-2 p-2 bg-white dark:bg-slate-900 rounded-lg shadow">
          <input type="text" class="w-full mb-2 px-2 py-1 rounded border" placeholder="Group name" bind:value={newGroupName} />
          <div class="mb-2">
            <label class="block text-xs mb-1">Add members:</label>
            <select multiple class="w-full rounded border" bind:value={newGroupMembers}>
              {#each friends ?? [] as friend}
                <option value={friend.id}>{friend.displayName || friend.username}</option>
              {/each}
            </select>
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-1 rounded bg-accent-500 text-white text-xs hover:bg-accent-600 transition" on:click={createGroup}>Create</button>
            <button class="px-3 py-1 rounded bg-slate-200 text-slate-700 text-xs hover:bg-slate-300 transition" on:click={() => (creatingGroup = false)}>Cancel</button>
          </div>
        </div>
      {/if}
    </div>
  </aside>

  <!-- Chat area -->
  <section class="flex-1 flex flex-col h-full bg-white/10 dark:bg-slate-900/60 shadow-md rounded-xl m-2 p-4 backdrop-blur-sm border border-slate-300/50 dark:border-slate-800/50">
    {#if selectedFriend || selectedGroup}
      <div class="flex items-center gap-3 mb-4">
        {#if selectedFriend}
          {#if selectedFriend.pfpUrl}
            <img src={selectedFriend.pfpUrl} alt={selectedFriend.displayName || selectedFriend.username} class="w-10 h-10 rounded-full object-cover" />
          {:else}
            <Icon src={UserCircle} class="w-10 h-10 text-accent-500" />
          {/if}
          <span class="font-semibold text-lg text-slate-900 dark:text-white">{selectedFriend.displayName || selectedFriend.username}</span>
        {:else if selectedGroup}
          <span class="font-semibold text-lg text-slate-900 dark:text-white">{selectedGroup.name}</span>
          <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">{selectedGroup.members.length} members</span>
        {/if}
      </div>
      <div class="flex-1 overflow-y-auto flex flex-col gap-2 pb-4">
        {#if messagesLoading}
          <div class="text-slate-500 dark:text-slate-300">Loading messages...</div>
        {:else if messagesError}
          <div class="text-red-500 dark:text-red-400">{messagesError}</div>
        {:else if messages.length === 0}
          <div class="text-slate-500 dark:text-slate-300">No messages yet. Say hi!</div>
        {:else}
          {#each messages as msg}
            <div class="flex {msg.senderId === (cloudUser?.id ?? -1) ? 'justify-end' : 'justify-start'}">
              <div class="max-w-[70%] px-4 py-2 rounded-2xl shadow-md
                {msg.senderId === (cloudUser?.id ?? -1)
                  ? 'bg-accent-500 text-white border border-accent-600 dark:border-accent-400 drop-shadow-lg'
                  : 'bg-white/30 dark:bg-slate-800/60 text-slate-900 dark:text-white'}">
                {#if selectedGroup && msg.sender}
                  <div class="text-xs font-semibold mb-1 text-accent-500">{msg.sender.displayName || msg.sender.username}</div>
                {/if}
                {#if msg.replyTo}
                  <div class="mb-1 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
                    Replying to: {msg.replyTo.content}
                  </div>
                {/if}
                <div class="text-sm">{msg.content}</div>
                {#if msg.attachment}
                  <div class="mt-2">
                    <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" class="text-xs text-blue-500 underline">View Attachment</a>
                  </div>
                {/if}
                <div class="text-xs mt-1 text-slate-200/80 dark:text-slate-100/70">{new Date(msg.createdAt).toLocaleString()}</div>
                <button class="mt-1 text-xs text-accent-500 hover:underline" on:click={() => handleReply(msg)}>Reply</button>
              </div>
            </div>
          {/each}
          <div bind:this={chatEnd}></div>
        {/if}
      </div>
      {#if replyTo}
        <div class="mb-2 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
          Replying to: {replyTo.content}
          <button class="ml-auto text-xs text-red-500 hover:underline" on:click={cancelReply}>Cancel</button>
        </div>
      {/if}
      <form class="flex gap-2 mt-auto" on:submit|preventDefault={sendMessage}>
        <input type="text" class="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ring-accent-500 transition-colors duration-200" placeholder="Type a message..." bind:value={newMessage} disabled={sending} />
        <input type="file" accept="image/*" class="hidden" id="attachment-input" on:change={handleAttachmentChange} />
        <label for="attachment-input" class="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 cursor-pointer">Attach</label>
        {#if attachmentPreview}
          <img src={attachmentPreview} alt="Attachment preview" class="w-10 h-10 object-cover rounded" />
        {/if}
        <button type="submit" class="px-4 py-2 rounded-lg bg-accent-500 text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" disabled={!newMessage.trim() || sending}>
          <Icon src={PaperAirplane} class="w-5 h-5" />
          <span>Send</span>
        </button>
      </form>
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-300">
        <Icon src={ChatBubbleLeftRight} class="w-12 h-12 mb-2 text-accent-500" />
        <div class="text-lg font-semibold">Select a friend or group to start chatting</div>
      </div>
    {/if}
  </section>
</div>

<!-- No <style> block needed, all styles are now Tailwind classes in markup --> 