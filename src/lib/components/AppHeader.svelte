<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import UserDropdown from './UserDropdown.svelte';
  import QuestionnaireWidget from './QuestionnaireWidget.svelte';
  import QuestionnaireModal from './QuestionnaireModal.svelte';
  import {
    Icon,
    Bars3,
    Bell,
    Minus,
    Square2Stack,
    XMark,
    ChatBubbleLeftRight,
    ChatBubbleBottomCenterText,
    ClipboardDocumentList,
    DocumentText,
    CloudArrowUp,
    NoSymbol,
  } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { derived, writable } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import PagesMenu from './PagesMenu.svelte';
  import GlobalSearch from './search/GlobalSearchOptimized.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';
  import { flushAll } from '../services/syncService';
  import {
    questionnaireService,
    type QuestionnaireQuestion,
  } from '../services/questionnaireService';
  import { cloudUserStore } from '../services/cloudAuthService';
  import { _ } from '../i18n';
  import T from './T.svelte';
  import { tooltip } from '$lib/actions/tooltip';

  interface Props {
    sidebarOpen: boolean;
    userInfo?: UserInfo;
    showUserDropdown: boolean;
    isFullscreen?: boolean;
    isMobile?: boolean;
    onToggleSidebar: () => void;
    onToggleUserDropdown: () => void;
    onLogout: () => void;
    onShowAbout: () => void;
    onClickOutside: (event: MouseEvent) => void;
    disableSchoolPicture?: boolean;
  }

  interface UserInfo {
    clientIP: string;
    email: string;
    id: number;
    lastAccessedTime: number;
    meta: {
      code: string;
      governmentID: string;
    };
    personUUID: string;
    saml: [
      {
        autologin: boolean;
        label: string;
        method: string;
        request: string;
        sigalg: URL;
        signature: string;
        slo: boolean;
        url: URL;
      },
    ];
    status: string;
    type: string;
    userCode: string;
    userDesc: string;
    userName: string;
    displayName?: string;
    profilePicture?: string;
  }

  interface Notification {
    notificationID: number;
    type: string;
    timestamp: string;
    report?: {
      title: string;
    };
    coneqtAssessments?: {
      programmeID: number;
      metaclassID: number;
      subtitle: string;
      term: string;
      title: string;
      assessmentID: number;
      subjectCode: string;
    };
    message?: {
      messageID: number;
      title: string;
      subtitle: string;
    };
    forum?: {
      title: string;
      forumID: number;
    };
  }

  interface HeartbeatResponse {
    payload: {
      identifier: string;
      version: string;
      uuid: string;
      notifications: Notification[];
    };
    status: string;
  }

  let {
    sidebarOpen,
    userInfo,
    showUserDropdown,
    isFullscreen = false,
    isMobile = false,
    onToggleSidebar,
    onToggleUserDropdown,
    onLogout,
    onShowAbout,
    onClickOutside,
    disableSchoolPicture = false,
  }: Props = $props();

  const appWindow = Window.getCurrent();
  const isMacOS =
    (import.meta as any).env?.TAURI_ENV_PLATFORM === 'darwin' ||
    (import.meta as any).env?.TAURI_ENV_PLATFORM === 'macos';

  const headerTip = { placement: 'bottom' as const, delay: 350 };
  const toggleSidebarTip = $derived({
    ...headerTip,
    text: $_('header.toggle_sidebar') || 'Toggle sidebar',
  });
  const cloudSignedInTip = $derived({
    ...headerTip,
    text: $_('header.cloud_sync_active_tooltip') || 'Cloud sync active — open Settings to manage sync',
  });
  const cloudSignedOutTip = $derived({
    ...headerTip,
    text: $_('header.cloud_sync_inactive_tooltip') || 'Cloud sync inactive — click to sign in via Settings',
  });
  const notificationsTip = $derived({
    ...headerTip,
    text: $_('header.notifications') || 'Notifications',
  });
  const minimizeTip = $derived({ ...headerTip, text: $_('header.minimize') || 'Minimize' });
  const maximizeTip = $derived({ ...headerTip, text: $_('header.maximize') || 'Maximize' });
  const closeTip = $derived({ ...headerTip, text: $_('header.close') || 'Close' });

  const pages = [
    { nameKey: 'navigation.dashboard', path: '/dashboard' },
    { nameKey: 'navigation.analytics', path: '/analytics' },
    { nameKey: 'navigation.assessments', path: '/assessments' },
    { nameKey: 'navigation.courses', path: '/courses' },
    { nameKey: 'navigation.directory', path: '/directory' },
    { nameKey: 'navigation.goals', path: '/goals' },
    { nameKey: 'navigation.forums', path: '/forums' },
    { nameKey: 'navigation.folios', path: '/folios' },
    { nameKey: 'navigation.messages', path: '/direqt-messages' },
    { nameKey: 'navigation.news', path: '/news' },
    { nameKey: 'navigation.notices', path: '/notices' },
    { nameKey: 'navigation.qr_signin', path: '/qrsignin' },
    { nameKey: 'navigation.reports', path: '/reports' },
    { nameKey: 'navigation.settings', path: '/settings' },
    { nameKey: 'navigation.timetable', path: '/timetable' },
    { nameKey: 'navigation.welcome', path: '/welcome' },
  ];

  const searchStore = writable('');
  const showDropdownStore = writable(false);
  const filteredPages = derived(searchStore, ($search) =>
    $search
      ? pages.filter((p) => {
          const translatedName = $_(`${p.nameKey}`, { default: p.nameKey });
          return translatedName.toLowerCase().includes($search.toLowerCase());
        })
      : pages,
  );

  let selectedIndex = $state(-1);
  let showPagesMenu = $state(false);
  let globalSearchEnabled = $state(false);
  let autoDismissMessageNotifications = $state(false);
  let showNotifications = $state(false);
  let loadingNotifications = $state(false);
  let notifications = $state<Notification[]>([]);
  let unreadNotifications = $state(0);
  let showNotificationsModal = $state(false);
  let showQuestionnaireModal = $state(false);
  let currentQuestion = $state<QuestionnaireQuestion | null>(null);
  let showCloudSignOutInfo = $state(false);

  function handleSelect(page: { nameKey: string; path: string }) {
    searchStore.set('');
    showDropdownStore.set(false);
    goto(page.path);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!$showDropdownStore || $filteredPages.length === 0) return;
    if (e.key === 'ArrowDown') {
      selectedIndex = (selectedIndex + 1) % $filteredPages.length;
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      selectedIndex = (selectedIndex - 1 + $filteredPages.length) % $filteredPages.length;
      e.preventDefault();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      handleSelect($filteredPages[selectedIndex]);
      e.preventDefault();
    }
  }

  function closePagesMenu() {
    showPagesMenu = false;
  }

  async function loadGlobalSearchSetting() {
    logger.debug('AppHeader', 'loadGlobalSearchSetting', 'Loading global search setting');

    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['global_search_enabled'] });
      globalSearchEnabled = subset?.global_search_enabled ?? true; // Default to enabled
      logger.info(
        'AppHeader',
        'loadGlobalSearchSetting',
        `Global search enabled: ${globalSearchEnabled}`,
      );
    } catch (error) {
      logger.error(
        'AppHeader',
        'loadGlobalSearchSetting',
        `Failed to load global search setting: ${error}`,
        { error },
      );
      globalSearchEnabled = true; // Default to enabled on error
    }
  }

  async function loadAutoDismissMessageNotificationsSetting() {
    logger.debug(
      'AppHeader',
      'loadAutoDismissMessageNotificationsSetting',
      'Loading auto dismiss message notifications setting',
    );

    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['auto_dismiss_message_notifications'],
      });
      autoDismissMessageNotifications = subset?.auto_dismiss_message_notifications ?? false; // Default to disabled
      logger.info(
        'AppHeader',
        'loadAutoDismissMessageNotificationsSetting',
        `Auto dismiss message notifications enabled: ${autoDismissMessageNotifications}`,
      );
    } catch (error) {
      logger.error(
        'AppHeader',
        'loadAutoDismissMessageNotificationsSetting',
        `Failed to load auto dismiss message notifications setting: ${error}`,
        { error },
      );
      autoDismissMessageNotifications = false; // Default to disabled on error
    }
  }

  async function fetchNotifications() {
    if (loadingNotifications) return;

    loadingNotifications = true;
    try {
      const response = await seqtaFetch('/seqta/student/heartbeat', {
        method: 'POST',
        body: {
          timestamp: '1970-01-01 00:00:00.0',
          hash: '#?page=/home',
        },
      });

      // Parse response if it's a string
      let parsedResponse = response;
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch (e) {
          console.error('Failed to parse response as JSON:', e);
          return;
        }
      }

      // Handle different possible response structures
      let notificationsData: Notification[] = [];

      if (parsedResponse.payload?.notifications) {
        notificationsData = parsedResponse.payload.notifications;
      } else if (parsedResponse.notifications) {
        notificationsData = parsedResponse.notifications;
      } else if (Array.isArray(parsedResponse)) {
        notificationsData = parsedResponse;
      }

      // Always update notifications, even if empty (to reflect dismissed notifications)
      notifications = notificationsData;
      unreadNotifications = notificationsData.length;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      loadingNotifications = false;
    }
  }

  function toggleNotifications() {
    logger.debug('AppHeader', 'toggleNotifications', 'Toggling notifications panel', { isMobile });

    if (isMobile) {
      showNotificationsModal = !showNotificationsModal;
      if (showNotificationsModal && notifications.length === 0) {
        logger.debug('AppHeader', 'toggleNotifications', 'Fetching notifications for mobile modal');
        fetchNotifications();
      }
    } else {
      showNotifications = !showNotifications;
      if (showNotifications && notifications.length === 0) {
        fetchNotifications();
      }
    }
  }

  function clearNotifications() {
    notifications = [];
    unreadNotifications = 0;
    showNotifications = false;
  }

  function formatNotificationTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  function getNotificationTitle(notification: Notification): string {
    if (notification.report) {
      return notification.report.title;
    } else if (notification.coneqtAssessments) {
      return notification.coneqtAssessments.title;
    } else if (notification.forum) {
      return notification.forum.title;
    } else if (notification.message) {
      return notification.message.title;
    }
    return 'Notification';
  }

  function getNotificationSubtitle(notification: Notification): string {
    if (notification.coneqtAssessments) {
      return `${notification.coneqtAssessments.subjectCode} - ${notification.coneqtAssessments.subtitle}`;
    } else if (notification.forum) {
      return $_('header.notification_forum_subtitle', { default: 'New messages or comments' });
    } else if (notification.message) {
      return notification.message.subtitle;
    }
    return '';
  }

  function getNotificationIcon(notification: Notification) {
    if (notification.type === 'message' || notification.message) return ChatBubbleLeftRight;
    if (notification.type === 'coneqtassessments' || notification.coneqtAssessments)
      return ClipboardDocumentList;
    if (notification.type === 'forum' || notification.forum) return ChatBubbleBottomCenterText;
    if (notification.type === 'report' || notification.report) return DocumentText;
    return Bell;
  }

  async function handleNotificationClick(notification: Notification) {
    if (notification.type === 'coneqtassessments' && notification.coneqtAssessments) {
      const { assessmentID, metaclassID } = notification.coneqtAssessments;
      // Extract year from notification timestamp (fallback to current year if unavailable)
      const notificationYear = new Date(notification.timestamp).getFullYear();
      showNotifications = false;
      showNotificationsModal = false;
      goto(`/assessments/${assessmentID}/${metaclassID}?year=${notificationYear}`);
    } else if (notification.type === 'report') {
      showNotifications = false;
      showNotificationsModal = false;
      // Report notifications don't have UUID in the interface, so just go to reports page
      goto('/reports');
    } else if (
      (notification.type === 'forum' || notification.forum) &&
      notification.forum
    ) {
      showNotifications = false;
      showNotificationsModal = false;
      goto(`/forums/${notification.forum.forumID}`);
    } else if (notification.type === 'message' && notification.message) {
      const id = notification.message.messageID;

      // If auto-dismiss is enabled, dismiss the notification before navigating
      if (autoDismissMessageNotifications) {
        try {
          // Optimistically remove the notification from the list immediately
          notifications = notifications.filter(
            (n) => n.notificationID !== notification.notificationID,
          );
          unreadNotifications = Math.max(0, unreadNotifications - 1);

          // Dismiss on server
          await seqtaFetch('/seqta/student/notification/dismiss', {
            method: 'POST',
            body: {
              ids: [notification.notificationID],
            },
          });
          logger.info(
            'AppHeader',
            'handleNotificationClick',
            `Dismissed message notification ${notification.notificationID}`,
          );

          // Refresh notifications list in background to ensure sync
          fetchNotifications().catch((error) => {
            logger.error(
              'AppHeader',
              'handleNotificationClick',
              `Failed to refresh notifications after dismiss: ${error}`,
              { error },
            );
          });
        } catch (error) {
          logger.error(
            'AppHeader',
            'handleNotificationClick',
            `Failed to dismiss notification: ${error}`,
            { error },
          );
          // Re-fetch to restore the notification if dismiss failed
          await fetchNotifications();
        }
      }

      showNotifications = false;
      showNotificationsModal = false;
      goto(`/direqt-messages?messageID=${id}`);
    }
  }

  onMount(() => {
    loadGlobalSearchSetting();
    loadAutoDismissMessageNotificationsSetting();
    fetchNotifications();
    // Attempt to flush any queued offline changes on header mount
    flushAll().catch(() => {});

    // Add click outside handler for notifications and cloud sign-out info
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showNotifications && !target.closest('.notification-dropdown')) {
        showNotifications = false;
      }
      if (showCloudSignOutInfo && !target.closest('.cloud-status-dropdown')) {
        showCloudSignOutInfo = false;
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  $effect(() => {
    if (!$showDropdownStore || $filteredPages.length === 0) selectedIndex = -1;
  });
  $effect(() => {
    if ($searchStore) selectedIndex = -1;
  });

  // Sort notifications by timestamp descending (latest first)
  let sortedNotifications = $state<Notification[]>([]);

  $effect(() => {
    sortedNotifications = [...notifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  });
</script>

<header
  class="flex relative justify-between items-center px-3 pr-2 w-full h-16 z-[200] theme-bg border-b border-border-subtle {isMobile ? 'rounded-b-2xl' : ''} {isMacOS && !isMobile ? 'pl-4' : ''}">
  <!-- Drag hit-area sits behind controls so buttons/links receive hover + click on Windows -->
  <div
    class="absolute inset-0 z-0"
    data-tauri-drag-region
    aria-hidden="true">
  </div>
  <div class="relative z-10 flex items-center space-x-4">
    <!-- macOS: Traffic lights + app icon on left -->
    {#if isMacOS && !isMobile}
      <div class="flex items-center gap-3 shrink-0">
        <!-- Traffic lights (close, minimize, maximize) -->
        <div class="flex items-center gap-1.5">
          <button
            class="flex justify-center items-center w-3 h-3 rounded-full transition-all duration-200 bg-[#ff5f57] hover:bg-[#ff7b73] active:scale-95"
            onclick={() => appWindow.close()}
            aria-label={$_('header.close', { default: 'Close' })}
            use:tooltip={$_('header.close', { default: 'Close' })}>
          </button>
          <button
            class="flex justify-center items-center w-3 h-3 rounded-full transition-all duration-200 bg-[#febc2e] hover:bg-[#fecf5a] active:scale-95"
            onclick={() => appWindow.minimize()}
            aria-label={$_('header.minimize', { default: 'Minimize' })}
            use:tooltip={$_('header.minimize', { default: 'Minimize' })}>
          </button>
          <button
            class="flex justify-center items-center w-3 h-3 rounded-full transition-all duration-200 bg-[#28c840] hover:bg-[#4dd35a] active:scale-95"
            onclick={() => appWindow.toggleMaximize()}
            aria-label={$_('header.maximize', { default: 'Maximize' })}
            use:tooltip={$_('header.maximize', { default: 'Maximize' })}>
          </button>
        </div>
        <!-- App icon -->
        <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="w-6 h-6 invert dark:invert-0" />
      </div>
    {/if}
    <!-- Hamburger: desktop only (mobile uses bottom nav "More" tab) -->
    {#if !isMobile}
      <button
        class="flex justify-center items-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
        onclick={onToggleSidebar}
        aria-label={$_('header.toggle_sidebar', { default: 'Toggle sidebar' })}
        use:tooltip={toggleSidebarTip}>
        <Icon src={Bars3} class="w-5 h-5" />
      </button>
    {/if}
    <div class="flex items-center gap-3">
      {#if !isMacOS || isMobile}
        <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="invert dark:invert-0 {isMobile ? 'w-7 h-7' : 'w-7 h-7'}" />
      {/if}
      <h1
        class="text-lg font-semibold tracking-tight text-foreground {isMobile ? 'text-base' : ''}">
        DesQTA
      </h1>
      {#if !isMobile}
        <QuestionnaireWidget
          onOpenModal={(question) => {
            currentQuestion = question;
            showQuestionnaireModal = true;
          }} />
      {/if}
    </div>
  </div>
  <div class="relative z-10 flex flex-1 justify-center min-w-0">
    {#if globalSearchEnabled}
      <GlobalSearch />
    {/if}
  </div>

  <div class="relative z-10 flex items-center gap-1">
    <!-- Always show UserDropdown when in app (allows Sign out when session invalid) -->
    <UserDropdown
      userInfo={userInfo}
      {showUserDropdown}
      {onToggleUserDropdown}
      {onLogout}
      {onShowAbout}
      {onClickOutside}
      {disableSchoolPicture} />

    <!-- Cloud sync status indicator -->
    <div class="relative cloud-status-dropdown">
      {#if $cloudUserStore}
        <a
          href="/settings"
          class="flex relative justify-center items-center w-10 h-10 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
          aria-label={$_('header.cloud_signed_in', { default: 'Signed in to BetterSEQTA Plus' })}
          use:tooltip={cloudSignedInTip}>
          <Icon src={CloudArrowUp} class="w-5 h-5" />
        </a>
      {:else}
        <button
          type="button"
          class="flex relative justify-center items-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
          aria-label={$_('header.cloud_not_signed_in', { default: 'Not signed in to BetterSEQTA Plus' })}
          use:tooltip={cloudSignedOutTip}
          onclick={() => (showCloudSignOutInfo = !showCloudSignOutInfo)}>
          <span class="relative inline-flex justify-center items-center">
            <Icon src={CloudArrowUp} class="w-5 h-5" />
            <Icon
              src={NoSymbol}
              class="absolute w-4 h-4 text-destructive pointer-events-none"
              aria-hidden="true" />
          </span>
        </button>
        {#if showCloudSignOutInfo}
          <div
            class="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-4"
            transition:fly={{ y: -4, duration: 150, opacity: 0, easing: (t) => t * (2 - t) }}
            style="transform-origin: top right;">
            <p class="text-sm text-foreground mb-4">
              <T key="header.cloud_signed_out_message" fallback="You're signed out of BetterSEQTA Plus. Sign in via Settings to sync your data across devices." />
            </p>
            <a
              href="/settings"
              class="flex justify-center items-center gap-2 w-full h-10 px-4 text-sm font-medium text-white rounded-lg transition-colors duration-150 bg-accent-500 hover:bg-accent-600"
              onclick={() => (showCloudSignOutInfo = false)}>
              <T key="header.cloud_go_to_settings" fallback="Go to Settings" />
            </a>
          </div>
        {/if}
      {/if}
    </div>

    <div class="relative notification-dropdown">
      <button
        class="flex relative justify-center items-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
        onclick={toggleNotifications}
        aria-label={$_('header.notifications', { default: 'Notifications' })}
        use:tooltip={notificationsTip}>
        <Icon src={Bell} class="w-5 h-5" />
        {#if unreadNotifications > 0}
          <span
            class="flex absolute -top-0.5 -right-0.5 justify-center items-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-destructive rounded-full">
            {unreadNotifications}
          </span>
        {/if}
      </button>

      {#if showNotifications}
        <div
          class="overflow-hidden absolute right-0 z-50 mt-2 w-96 rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)]"
          transition:fly={{ y: -4, duration: 150, opacity: 0, easing: (t) => t * (2 - t) }}
          style="transform-origin: top right;">
          <div class="p-4 border-b border-border-subtle">
            <div class="flex justify-between items-center">
              <h3 class="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-2">
                <Icon src={Bell} class="w-4 h-4" />
                Notifications
              </h3>
              <button
                class="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                onclick={clearNotifications}>
                <Icon src={XMark} class="w-3.5 h-3.5" />
                Clear all
              </button>
            </div>
          </div>

          <div class="p-2 max-h-96 overflow-y-auto">
            {#if loadingNotifications}
              <div class="flex justify-center items-center py-8">
                <div class="w-5 h-5 rounded-full border-2 animate-spin border-accent-500/30 border-t-accent-500"></div>
              </div>
            {:else if notifications.length === 0}
              <div class="py-10 text-center text-muted-foreground">
                <Icon src={Bell} class="mx-auto mb-3 w-10 h-10 opacity-50" />
                <p class="text-sm">No notifications</p>
              </div>
            {:else}
              {#each notifications as notification (notification.notificationID)}
                <button
                  type="button"
                  class="p-3 w-full text-left rounded-lg transition-colors duration-100 cursor-pointer hover:bg-surface-muted"
                  aria-label={getNotificationTitle(notification)}
                  onclick={() => handleNotificationClick(notification)}>
                  <div class="flex gap-3">
                    <div class="shrink-0 mt-1">
                      <Icon src={getNotificationIcon(notification)} class="w-4 h-4 text-accent-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate text-foreground">
                        {getNotificationTitle(notification)}
                      </p>
                      {#if getNotificationSubtitle(notification)}
                        <p class="mt-0.5 text-xs truncate text-muted-foreground">
                          {getNotificationSubtitle(notification)}
                        </p>
                      {/if}
                      <p class="mt-1 text-[11px] text-muted-foreground/80">
                        {formatNotificationTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Window Controls - Desktop Only (hidden on macOS, we use traffic lights on left) -->
    {#if !isMobile && !isMacOS}
      <div class="flex items-center ml-3 gap-1">
        <button
          class="flex justify-center items-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
          onclick={() => appWindow.minimize()}
          aria-label={$_('header.minimize', { default: 'Minimize' })}
          use:tooltip={minimizeTip}>
          <Icon src={Minus} class="w-4 h-4" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors duration-150"
          onclick={() => appWindow.toggleMaximize()}
          aria-label={$_('header.maximize', { default: 'Maximize' })}
          use:tooltip={maximizeTip}>
          <Icon src={Square2Stack} class="w-4 h-4" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-md text-muted-foreground hover:text-white hover:bg-destructive transition-colors duration-150 group"
          onclick={() => appWindow.close()}
          aria-label={$_('header.close', { default: 'Close' })}
          use:tooltip={closeTip}>
          <Icon src={XMark} class="w-4 h-4" />
        </button>
      </div>
    {/if}
  </div>
  {#if showPagesMenu}
    <PagesMenu on:close={closePagesMenu} />
  {/if}
  {#if showNotificationsModal}
    <div
      class="fixed inset-0 z-9999999 flex items-center justify-center bg-foreground/40 mobile-modal-inset"
      role="dialog"
      aria-modal="true"
      aria-label={$_('header.notifications') || 'Notifications'}
      tabindex="0"
      onclick={() => { showNotificationsModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showNotificationsModal = false; }}>
      <div
        class="flex relative flex-col p-0 mx-auto w-full max-w-xl rounded-2xl border border-border bg-card text-card-foreground shadow-[0_24px_56px_-16px_rgba(0,0,0,0.22),0_4px_12px_-4px_rgba(0,0,0,0.08)] pointer-events-auto animate-in"
        role="document">
        <div class="flex justify-between items-center p-4 border-b border-border-subtle">
          <h3 class="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">Notifications</h3>
          <button
            class="h-8 px-3 text-sm font-medium rounded-md transition-colors duration-150 bg-surface-muted text-foreground hover:bg-surface-3"
            onclick={() => { showNotificationsModal = false; }}>
            Close
          </button>
        </div>
        <div class="p-2 max-h-[70vh] overflow-y-auto mobile-modal-max-h">
          {#if loadingNotifications}
            <div class="flex justify-center items-center py-8">
              <div class="w-5 h-5 rounded-full border-2 animate-spin border-accent-500/30 border-t-accent-500"></div>
            </div>
          {:else if sortedNotifications.length === 0}
            <div class="py-10 text-center text-muted-foreground">
              <Icon src={Bell} class="mx-auto mb-3 w-10 h-10 opacity-50" />
              <p class="text-sm">No notifications</p>
            </div>
          {:else}
            {#each sortedNotifications as notification (notification.notificationID)}
              <button
                type="button"
                class="p-3 w-full text-left rounded-lg transition-colors duration-100 cursor-pointer hover:bg-surface-muted"
                aria-label={getNotificationTitle(notification)}
                onclick={() => handleNotificationClick(notification)}>
                <div class="flex gap-3">
                  <div class="shrink-0 mt-1">
                    <Icon src={getNotificationIcon(notification)} class="w-4 h-4 text-accent-500" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate text-foreground">
                      {getNotificationTitle(notification)}
                    </p>
                    {#if getNotificationSubtitle(notification)}
                      <p class="mt-0.5 text-xs truncate text-muted-foreground">
                        {getNotificationSubtitle(notification)}
                      </p>
                    {/if}
                    <p class="mt-1 text-[11px] text-muted-foreground/80">
                      {formatNotificationTime(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
  <QuestionnaireModal
    bind:open={showQuestionnaireModal}
    question={currentQuestion}
    onclose={() => {
      showQuestionnaireModal = false;
    }} />
</header>
