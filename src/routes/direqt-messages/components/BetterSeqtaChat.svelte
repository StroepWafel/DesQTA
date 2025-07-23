<script lang="ts">
import { onMount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from 'svelte-hero-icons';
import { Plus, Inbox, PaperAirplane, Trash, Star, Rss, ChatBubbleLeftRight, UserCircle } from 'svelte-hero-icons';
import { afterUpdate, tick } from 'svelte';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

interface GroupMember {
  id: string;
  displayName?: string;
}

interface Group {
  id: string;
  name: string;
  iconUrl?: string | null;
  members?: GroupMember[];
}

interface Attachment {
  id?: string;
  filename?: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  isPublic?: boolean;
  createdAt?: string;
  userId?: string;
  path?: string;
  updatedAt?: string;
}

interface MessageReply {
  id: string;
  content: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  read: boolean;
  createdAt: string;
  replyToId?: string;
  replyTo?: MessageReply;
  attachmentId?: string;
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
let currentPage = 1;
let hasMoreMessages = true;
let loadingOlderMessages = false;
let newMessage = '';
let sending = false;
let chatEnd: HTMLDivElement | null = null;

let groups: Group[] = [];
let groupsLoading = true;
let groupsError: string | null = null;
let selectedGroup: Group | null = null;
let creatingGroup = false;
let newGroupName = '';
let newGroupMembers: string[] = [];

let replyTo: Message | null = null;
let attachmentFile: File | null = null;
let attachmentPreview: string | null = null;
let uploadingAttachment = false;
let uploadedAttachment: Attachment | null = null;
let sendError: string | null = null;
let messageInput: HTMLInputElement | null = null;

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
    // Create a temporary file path for the upload
    const tempPath = `${file.name}`;
    
    // Convert file to array buffer and save temporarily
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Use Tauri's file system API to write the file temporarily
    await invoke('write_temp_file', { 
      fileName: tempPath, 
      data: Array.from(uint8Array) 
    });
    
    // Upload the file
    const attachment = await invoke<Attachment>('upload_attachment', { 
      token, 
      filePath: tempPath 
    });
    
    // Clean up temporary file
    await invoke('delete_temp_file', { fileName: tempPath });
    
    return attachment;
  } catch (error) {
    console.error('File upload failed:', error);
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
  sendError = null;
  try {
    let attachmentId: string | undefined = undefined;
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
    
    // Refocus the input after all DOM updates are complete
    await tick();
    setTimeout(() => {
      if (messageInput) {
        messageInput.focus();
      }
    }, 10);
  } catch (e) {
    sendError = e instanceof Error ? e.message : String(e) || 'Failed to send message';
    console.error('Failed to send message:', e);
  } finally {
    sending = false;
  }
}

function selectFriend(friend: Friend) {
  selectedFriend = friend;
  selectedGroup = null;
  fetchMessagesForFriend(friend);
}

async function fetchMessagesForFriend(friend: Friend, page: number = 1) {
  if (page === 1) {
  messagesLoading = true;
    currentPage = 1;
    hasMoreMessages = true;
  } else {
    loadingOlderMessages = true;
  }
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    const newMessages = await invoke<Message[]>('get_messages', { token, id: friend.id, page });
    if (page === 1) {
      messages = newMessages;
    } else {
      // Prepend older messages to the beginning of the array
      messages = [...newMessages, ...messages];
    }
    // If we got fewer than 25 messages (default page size), we've reached the end
    hasMoreMessages = newMessages.length >= 25;
    if (page > 1) {
      currentPage = page;
    }
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    if (page === 1) {
    messages = [];
    }
  } finally {
    if (page === 1) {
    messagesLoading = false;
    } else {
      loadingOlderMessages = false;
    }
  }
}

function selectGroup(group: Group) {
  selectedGroup = group;
  selectedFriend = null;
  fetchMessagesForGroup(group);
}

async function fetchMessagesForGroup(group: Group, page: number = 1) {
  if (page === 1) {
  messagesLoading = true;
    currentPage = 1;
    hasMoreMessages = true;
  } else {
    loadingOlderMessages = true;
  }
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    const newMessages = await invoke<Message[]>('get_messages', { token, id: group.id, page });
    if (page === 1) {
      messages = newMessages;
    } else {
      // Prepend older messages to the beginning of the array
      messages = [...newMessages, ...messages];
    }
    // If we got fewer than 25 messages (default page size), we've reached the end
    hasMoreMessages = newMessages.length >= 25;
    if (page > 1) {
      currentPage = page;
    }
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    if (page === 1) {
    messages = [];
    }
  } finally {
    if (page === 1) {
    messagesLoading = false;
    } else {
      loadingOlderMessages = false;
    }
  }
}

function loadOlderMessages() {
  if (loadingOlderMessages || !hasMoreMessages) return;
  const nextPage = currentPage + 1;
  if (selectedFriend) {
    fetchMessagesForFriend(selectedFriend, nextPage);
  } else if (selectedGroup) {
    fetchMessagesForGroup(selectedGroup, nextPage);
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

// Helper function to get full profile picture URL
function getFullPfpUrl(pfpUrl: string | null | undefined): string | null {
  if (!pfpUrl) return null;
  
  // If it's already a full URL, return as is
  if (pfpUrl.startsWith('http://') || pfpUrl.startsWith('https://')) {
    return pfpUrl;
  }
  
  // If it's a relative path, prepend the base domain
  if (pfpUrl.startsWith('/api/files/public/')) {
    return `https://accounts.betterseqta.adenmgb.com${pfpUrl}`;
  }
  
  // Fallback to DiceBear if it's not a recognized format
  return pfpUrl;
}

onMount(() => {
  fetchToken().then(() => {
    fetchFriends();
    fetchGroups();
  });
});

afterUpdate(() => {
  if (chatEnd) chatEnd.scrollIntoView({ behavior: 'smooth' });
  
  // Ensure input stays focused after updates
  if (messageInput && document.activeElement !== messageInput && !sending) {
    // Only refocus if no other element is intentionally focused
    if (!document.activeElement || document.activeElement === document.body) {
      messageInput.focus();
    }
  }
});
</script>

<div class="flex h-full w-full">
  <!-- Friends sidebar -->
  <aside class="w-64 min-w-[200px] max-w-xs bg-white/10 dark:bg-slate-900/60 border-r border-slate-300/50 dark:border-slate-800/50 shadow-md rounded-xl m-2 p-4 flex flex-col gap-4 backdrop-blur-sm">
    {#if cloudUser}
      <div class="flex items-center gap-3 mb-4">
        {#if cloudUser.pfpUrl}
          <img src={getFullPfpUrl(cloudUser.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${cloudUser.id}`} alt={cloudUser.displayName || cloudUser.username} class="w-10 h-10 rounded-full object-cover" />
    {:else}
          <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${cloudUser.id}`} alt={cloudUser.displayName || cloudUser.username} class="w-10 h-10 rounded-full object-cover" />
              {/if}
        <div>
          <div class="font-semibold text-base text-slate-900 dark:text-white">{cloudUser.displayName || cloudUser.username}</div>
          <div class="text-xs text-slate-500 dark:text-slate-300">{cloudUser.email}</div>
        </div>
      </div>
    {/if}
    
    <div class="flex items-center justify-between mb-2">
      <h2 class="font-semibold text-lg text-slate-900 dark:text-white">Conversations</h2>
      <button class="px-3 py-1 rounded-lg bg-orange-500 text-white text-xs hover:bg-orange-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-orange-500" on:click={() => (creatingGroup = true)}>+ New Group</button>
      </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Groups Section -->
      {#if groupsLoading}
        <div class="text-slate-500 dark:text-slate-300 text-sm mb-4">Loading groups...</div>
      {:else if groupsError}
        <div class="text-red-500 dark:text-red-400 text-sm mb-4">{groupsError}</div>
      {:else if groups.length > 0}
        <div class="mb-6">
          <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 px-2">Groups</h3>
          <div class="space-y-1">
            {#each groups as group}
              <button class="flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-all duration-200 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedGroup?.id === group.id ? 'bg-accent-500/20 text-accent-500' : 'text-slate-900 dark:text-white'}" on:click={() => selectGroup(group)}>
                {#if group.iconUrl}
                  <img src={getFullPfpUrl(group.iconUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`} alt={group.name} class="w-10 h-10 rounded-full object-cover" />
      {:else}
                  <div class="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center">
                    <Icon src={ChatBubbleLeftRight} class="w-5 h-5 text-white" />
                  </div>
                {/if}
                <div class="flex-1 text-left">
                  <div class="font-medium text-sm">{group.name}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">Group</div>
                </div>
              </button>
          {/each}
          </div>
        </div>
      {/if}

      <!-- Direct Messages Section -->
      {#if friendsLoading}
        <div class="text-slate-500 dark:text-slate-300 text-sm">Loading friends...</div>
      {:else if friendsError}
        <div class="text-red-500 dark:text-red-400 text-sm">{friendsError}</div>
      {:else if friends.length === 0}
        <div class="text-slate-500 dark:text-slate-300 text-sm">No friends found.</div>
      {:else}
        <div>
          <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 px-2">Direct Messages</h3>
          <div class="space-y-1">
            {#each friends as friend}
              <button class="flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-all duration-200 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedFriend?.id === friend.id ? 'bg-accent-500/20 text-accent-500' : 'text-slate-900 dark:text-white'}" on:click={() => selectFriend(friend)}>
                {#if friend.pfpUrl}
                  <img src={getFullPfpUrl(friend.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-10 h-10 rounded-full object-cover" />
                {:else}
                  <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-10 h-10 rounded-full object-cover" />
                {/if}
                <div class="flex-1 text-left">
                  <div class="font-medium text-sm">{friend.displayName || friend.username}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">@{friend.username}</div>
                </div>
              </button>
              {/each}
          </div>
        </div>
      {/if}
    </div>

    {#if creatingGroup}
      <div 
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="-1"
        on:click={() => (creatingGroup = false)}
        on:keydown={(e) => e.key === 'Escape' && (creatingGroup = false)}
      >
        <div 
          class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4" 
          role="document"
        >
          <div 
            class="p-6" 
            role="presentation"
            on:click|stopPropagation
            on:keydown|stopPropagation
          >
            <div class="flex items-center justify-between mb-6">
              <h3 id="modal-title" class="text-xl font-semibold text-slate-900 dark:text-white">Create New Group</h3>
              <button 
                type="button"
                class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" 
                on:click={() => (creatingGroup = false)}
                aria-label="Close modal"
              >
                <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form on:submit|preventDefault={createGroup} class="space-y-4">
              <div>
                <label for="group-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Group Name</label>
                <input 
                  id="group-name"
                  type="text" 
                  class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 ring-accent-500 focus:border-transparent transition-all duration-200" 
                  placeholder="Enter group name..." 
                  bind:value={newGroupName} 
                  required 
                />
              </div>
              
              <div>
                <label for="group-members" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Add Members</label>
                <div id="group-members" class="space-y-2 max-h-48 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-lg p-2 bg-slate-50 dark:bg-slate-700/50">
                  {#each friends ?? [] as friend}
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer">
                      <input 
                        type="checkbox" 
                        class="w-4 h-4 text-accent-500 bg-white dark:bg-slate-600 border-slate-300 dark:border-slate-500 rounded focus:ring-accent-500 focus:ring-2" 
                        bind:group={newGroupMembers} 
                        value={friend.id} 
                      />
                      {#if friend.pfpUrl}
                        <img src={getFullPfpUrl(friend.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-8 h-8 rounded-full object-cover" />
                      {:else}
                        <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-8 h-8 rounded-full object-cover" />
                      {/if}
                      <div class="flex-1">
                        <div class="text-sm font-medium text-slate-900 dark:text-white">{friend.displayName || friend.username}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400">@{friend.username}</div>
                      </div>
                    </label>
                  {/each}
                </div>
                {#if newGroupMembers.length > 0}
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">{newGroupMembers.length} member{newGroupMembers.length === 1 ? '' : 's'} selected</p>
                {/if}
              </div>
              
              <div class="flex gap-3 pt-4">
                <button 
                  type="button"
                  class="flex-1 px-4 py-3 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 ring-slate-400" 
                  on:click={() => (creatingGroup = false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  class="flex-1 px-4 py-3 rounded-lg bg-accent-500 text-white font-medium hover:bg-accent-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0 || creatingGroup}
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    {/if}
  </aside>

  <!-- Chat area -->
  <section class="flex-1 flex flex-col h-full bg-white/10 dark:bg-slate-900/60 shadow-md rounded-xl m-2 p-4 backdrop-blur-sm border border-slate-300/50 dark:border-slate-800/50">
    {#if selectedFriend || selectedGroup}
      <div class="flex items-center gap-3 mb-4">
        {#if selectedFriend}
          {#if selectedFriend.pfpUrl}
            <img src={getFullPfpUrl(selectedFriend.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${selectedFriend.id}`} alt={selectedFriend.displayName || selectedFriend.username} class="w-10 h-10 rounded-full object-cover" />
          {:else}
            <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${selectedFriend.id}`} alt={selectedFriend.displayName || selectedFriend.username} class="w-10 h-10 rounded-full object-cover" />
          {/if}
          <span class="font-semibold text-lg text-slate-900 dark:text-white">{selectedFriend.displayName || selectedFriend.username}</span>
        {:else if selectedGroup}
          <span class="font-semibold text-lg text-slate-900 dark:text-white">{selectedGroup.name}</span>
          <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">{selectedGroup.members?.length || 0} members</span>
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
          {#if hasMoreMessages}
            <div class="flex justify-center mb-4">
              <button 
                class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" 
                on:click={loadOlderMessages}
                disabled={loadingOlderMessages}>
                {loadingOlderMessages ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          {/if}
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
                    {#if msg.attachment.mimeType?.startsWith('image/')}
                      <img src="https://accounts.betterseqta.adenmgb.com/api/files/public/{msg.attachment.storedName}" alt={msg.attachment.filename} class="max-w-xs rounded-lg" />
                    {:else}
                      <a href="https://accounts.betterseqta.adenmgb.com/api/files/public/{msg.attachment.storedName}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-500 underline">
                        📎 {msg.attachment.filename || 'Download Attachment'}
                      </a>
                    {/if}
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
      {#if sendError}
        <div class="mb-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
          {sendError}
          <button class="ml-2 text-red-500 hover:underline" on:click={() => sendError = null}>✕</button>
        </div>
      {/if}
      <form class="flex gap-2 mt-auto" on:submit|preventDefault={sendMessage}>
        <input 
          bind:this={messageInput}
          type="text" 
          class="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ring-accent-500 transition-colors duration-200" 
          placeholder="Type a message..." 
          bind:value={newMessage} 
          disabled={sending} />
        <input type="file" accept="image/*" class="hidden" id="attachment-input" on:change={handleAttachmentChange} />
        <label for="attachment-input" class="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 cursor-pointer {uploadingAttachment ? 'opacity-50 cursor-not-allowed' : ''}" class:disabled={uploadingAttachment}>
          {uploadingAttachment ? 'Uploading...' : 'Attach'}
        </label>
        {#if attachmentPreview}
          <div class="relative">
          <img src={attachmentPreview} alt="Attachment preview" class="w-10 h-10 object-cover rounded" />
            <button type="button" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center" on:click={() => { attachmentFile = null; attachmentPreview = null; }}>✕</button>
          </div>
        {/if}
        <button type="submit" class="px-4 py-2 rounded-lg bg-accent-500 text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" disabled={!newMessage.trim() || sending || uploadingAttachment}>
          <Icon src={PaperAirplane} class="w-5 h-5" />
          <span>{sending ? 'Sending...' : 'Send'}</span>
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
