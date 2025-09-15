<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import Modal from '$lib/components/Modal.svelte';
  import TodaySchedule from '$lib/components/TodaySchedule.svelte';
  import NoticesPane from '$lib/components/NoticesPane.svelte';
  import UpcomingAssessments from '$lib/components/UpcomingAssessments.svelte';
  import WelcomePortal from '$lib/components/WelcomePortal.svelte';
  import TodoList from '$lib/components/TodoList.svelte';
  import FocusTimer from '$lib/components/FocusTimer.svelte';
  import Homework from '$lib/components/Homework.svelte';
  import ShortcutsWidget from '$lib/components/ShortcutsWidget.svelte';
  import RecentNews from '$lib/components/RecentNews.svelte';
  import MessagesPreview from '$lib/components/MessagesPreview.svelte';

  interface Shortcut {
    name: string;
    icon: string;
    url: string;
  }

  let homepageShortcuts = $state<Shortcut[]>([
    { name: 'Outlook', icon: '📅', url: 'https://outlook.office.com' },
    { name: 'Office365', icon: '🏢', url: 'https://office365.com' },
    { name: 'Google', icon: '🌐', url: 'https://google.com' },
  ]);

  let showPortalModal = $state(false);
  let portalUrl = $state<string>('');

  async function loadHomepageShortcuts() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['shortcuts'] });
      if (subset?.shortcuts && Array.isArray(subset.shortcuts) && subset.shortcuts.length > 0) {
        homepageShortcuts = subset.shortcuts as Shortcut[];
      }
    } catch (e) {
      console.error('Failed to load homepage shortcuts:', e);
    }
  }

  function closeModal() {
    showPortalModal = false;
  }

  onMount(() => {
    loadHomepageShortcuts();
  });
</script>

<div class="p-4 sm:p-6 min-h-screen">
  <!-- Main Dashboard Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
    
    <!-- Top Row - Full Width Components -->
    <div class="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
      <!-- Recent News -->
      <div class="bg-white/80 dark:bg-slate-900/60 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <RecentNews />
      </div>
      
      <!-- Messages Preview -->
      <div class="bg-white/80 dark:bg-slate-900/60 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <MessagesPreview />
      </div>
    </div>

    <!-- Second Row - Today's Schedule (Full Width) -->
    <div class="lg:col-span-12">
      <TodaySchedule />
    </div>

    <!-- Third Row - Shortcuts (Full Width) -->
    <div class="lg:col-span-12">
      <div class="bg-white/80 dark:bg-slate-900/60 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Links</h2>
        <ShortcutsWidget shortcuts={homepageShortcuts} />
      </div>
    </div>

    <!-- Fourth Row - Notices (Full Width) -->
    <div class="lg:col-span-12">
      <NoticesPane />
    </div>

    <!-- Fifth Row - Upcoming Assessments (Full Width) -->
    <div class="lg:col-span-12">
      <UpcomingAssessments />
    </div>

    <!-- Sixth Row - Welcome Portal (Full Width) -->
    <div class="lg:col-span-12">
      <WelcomePortal />
    </div>

    <!-- Bottom Row - Side by Side Components -->
    <div class="lg:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
      <!-- Homework -->
      <div>
        <Homework />
      </div>
      
      <!-- Todo List -->
      <div>
        <TodoList />
      </div>
      
      <!-- Focus Timer -->
      <div>
        <FocusTimer />
      </div>
    </div>
  </div>
</div>

<!-- Portal Modal -->
<Modal
  bind:open={showPortalModal}
  onclose={closeModal}
  maxWidth="w-[80%]"
  maxHeight="h-[80%]"
  className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl"
  ariaLabel="Welcome Portal Modal">
  {#if portalUrl}
    <iframe src={portalUrl} class="w-full h-full rounded-2xl border-0" title="Welcome Portal"></iframe>
  {/if}
</Modal>