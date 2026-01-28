<script lang="ts">
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { Window } from '@tauri-apps/api/window';
  const appWindow = Window.getCurrent();
  import AboutModal from '../../lib/components/AboutModal.svelte';
  import AppHeader from '../../lib/components/AppHeader.svelte';
  import AppSidebar from '../../lib/components/AppSidebar.svelte';
  import LoginScreen from '../../lib/components/LoginScreen.svelte';
  import LoadingScreen from '../../lib/components/LoadingScreen.svelte';
  import ThemeBuilder from '../../lib/components/ThemeBuilder.svelte';
  import { Toaster } from 'svelte-sonner';
  import { cloudAuthService } from '../../lib/services/cloudAuthService';
  import { cloudSettingsService } from '../../lib/services/cloudSettingsService';
  import { saveSettingsWithQueue } from '../../lib/services/settingsSync';
  import { authService, type UserInfo } from '../../lib/services/authService';
  import { warmUpCommonData } from '../../lib/services/warmupService';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';
  import { useWeather } from '../../lib/composables/useWeather';
  import { useSidebar } from '../../lib/composables/useSidebar';
  import { usePlatform } from '../../lib/composables/usePlatform';
  import '../../app.css';
  import {
    accentColor,
    loadAccentColor,
    theme,
    loadTheme,
    loadCurrentTheme,
  } from '../../lib/stores/theme';
  import { initI18n, locale, availableLocales, _ } from '../../lib/i18n';
  import { themeBuilderSidebarOpen } from '../../lib/stores/themeBuilderSidebar';
  import {
    Icon,
    Home,
    Newspaper,
    ClipboardDocumentList,
    BookOpen,
    ChatBubbleLeftRight,
    DocumentText,
    AcademicCap,
    ChartBar,
    Cog6Tooth,
    CalendarDays,
    User,
    GlobeAlt,
    XMark,
    Rss,
  } from 'svelte-hero-icons';
  import { writable, get } from 'svelte/store';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  export const needsSetup = writable(false);

  let { children } = $props();

  // Core state
  let seqtaUrl = $state<string>('');
  let userInfo = $state<UserInfo | undefined>(undefined);
  let seqtaConfig: any = $state(null);
  let shellReady = $state(false);
  let contentLoading = $state(true);

  // UI state
  let sidebarOpen = $state(true);
  let showUserDropdown = $state(false);
  let showAboutModal = $state(false);

  // Composables
  const weather = useWeather();
  const sidebar = useSidebar();
  const platform = usePlatform();

  // Sync composable state with component state
  let weatherEnabled = $derived(weather.state.enabled);
  let weatherData = $derived(weather.state.data);
  let loadingWeather = $derived(weather.state.loading);
  let weatherError = $derived(weather.state.error);
  let forceUseLocation = $derived(weather.state.forceUseLocation);
  let autoCollapseSidebar = $derived(sidebar.state.autoCollapse);
  let autoExpandSidebarHover = $derived(sidebar.state.autoExpandOnHover);
  let isMobile = $derived(platform.state.isMobile);

  // Settings state
  let disableSchoolPicture = $state(false);
  let enhancedAnimations = $state(true);

  // Teach-specific menu configuration
  const TEACH_MENU = [
    { labelKey: 'navigation.dashboard', icon: Home, path: '/Teach' },
    { labelKey: 'navigation.courses', icon: BookOpen, path: '/Teach/courses' },
    { labelKey: 'navigation.assessments', icon: ClipboardDocumentList, path: '/Teach/assessments' },
    { labelKey: 'navigation.timetable', icon: CalendarDays, path: '/Teach/timetable' },
    { labelKey: 'navigation.messages', icon: ChatBubbleLeftRight, path: '/Teach/messages' },
    { labelKey: 'navigation.rss_feeds', icon: Rss, path: '/Teach/rss-feeds' },
    { labelKey: 'navigation.portals', icon: GlobeAlt, path: '/Teach/portals' },
    { labelKey: 'navigation.notices', icon: DocumentText, path: '/Teach/notices' },
    { labelKey: 'navigation.news', icon: Newspaper, path: '/Teach/news' },
    { labelKey: 'navigation.directory', icon: User, path: '/Teach/directory' },
    { labelKey: 'navigation.reports', icon: ChartBar, path: '/Teach/reports' },
    { labelKey: 'navigation.analytics', icon: AcademicCap, path: '/Teach/analytics' },
    { labelKey: 'navigation.settings', icon: Cog6Tooth, path: '/settings' },
  ];
  let menu = $state([...TEACH_MENU]);
  let menuLoading = $state(true);
  let devMockEnabled = false;

  onMount(() => {
    platform.checkPlatform();
    platform.setupWindowCorners();
  });

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.user-dropdown-container')) {
      showUserDropdown = false;
    }
  };

  const checkSession = async () => {
    logger.logFunctionEntry('teach-layout', 'checkSession');
    try {
      if (devMockEnabled) {
        needsSetup.set(false);
        logger.info('teach-layout', 'checkSession', 'Dev mock enabled; bypassing login');
        await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
        logger.logFunctionExit('teach-layout', 'checkSession', { sessionExists: true });
      } else {
        const sessionExists = await authService.checkSession();
        needsSetup.set(!sessionExists);
        logger.info('teach-layout', 'checkSession', `Session exists: ${sessionExists}`, {
          sessionExists,
        });
        if (sessionExists) {
          await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
        }
        logger.logFunctionExit('teach-layout', 'checkSession', { sessionExists });
      }
    } catch (error) {
      logger.error('teach-layout', 'checkSession', `Failed to check session: ${error}`, { error });
    }
  };

  let unlisten: (() => void) | undefined;

  const setupListeners = async () => {
    logger.debug('teach-layout', 'onMount', 'Setting up reload listener');
    unlisten = await listen<string>('reload', () => {
      logger.info('teach-layout', 'reload_listener', 'Received reload event');
      location.reload();
    });

    // Listen for fullscreen changes from Tauri backend
    await listen<boolean>('fullscreen-changed', (event) => {
      const isFullscreen = event.payload;
      logger.debug('teach-layout', 'fullscreen_listener', `Fullscreen changed: ${isFullscreen}`);

      if (isFullscreen) {
        document.body.classList.remove('rounded-xl');
        const contentDiv = document.querySelector('.overflow-clip.rounded-xl');
        if (contentDiv) {
          contentDiv.classList.remove('rounded-xl');
        }
      } else {
        document.body.classList.add('rounded-xl');
        const contentDiv = document.querySelector('.overflow-clip');
        if (contentDiv) {
          contentDiv.classList.add('rounded-xl');
        }
      }
    });
  };

  onDestroy(() => {
    logger.logComponentUnmount('teach-layout');
    if (unlisten) {
      logger.debug('teach-layout', 'onDestroy', 'Cleaning up reload listener');
      unlisten();
    }
  });

  // Consolidated settings loader
  const loadSettings = async (keys: string[]) => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys });
      return subset || {};
    } catch (e) {
      logger.error('teach-layout', 'loadSettings', `Failed to load settings: ${e}`, {
        keys,
        error: e,
      });
      return {};
    }
  };

  const reloadEnhancedAnimationsSetting = async () => {
    const settings = await loadSettings(['enhanced_animations']);
    enhancedAnimations = settings.enhanced_animations ?? true;
    logger.debug(
      'teach-layout',
      'reloadEnhancedAnimationsSetting',
      `Enhanced animations: ${enhancedAnimations}`,
    );
  };

  const reloadSidebarSettings = async () => {
    await sidebar.loadSettings();
  };

  const handlePageNavigation = () => {
    if (autoCollapseSidebar || isMobile) {
      sidebarOpen = false;
    }
    sidebar.handlePageNavigation();
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (autoExpandSidebarHover && !isMobile) {
      sidebar.handleMouseMove(event);
      const x = event.clientX;
      if (!sidebarOpen && x <= 20) {
        sidebarOpen = true;
      } else if (sidebarOpen && x > 280) {
        sidebarOpen = false;
      }
    }
  };

  const healthCheck = async () => {
    try {
      // Import platformService to check platform
      const { platformService } = await import('$lib/services/platformService');
      const isTeachMode = await platformService.isTeachMode();

      // Teach heartbeat uses different payload format (empty hash)
      const heartbeatBody = isTeachMode
        ? {
            timestamp: '1970-01-01 00:00:00.0',
            hash: '',
          }
        : {
            timestamp: '1970-01-01 00:00:00.0',
            hash: '#?page=/home',
          };

      const response = await seqtaFetch('/seqta/student/heartbeat', {
        method: 'POST',
        body: heartbeatBody,
      });

      const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
      if (
        responseStr.includes('"status":"401"') ||
        responseStr.includes('"status":401') ||
        responseStr.toLowerCase().includes('unauthorized')
      ) {
        logger.warn('teach-layout', 'healthCheck', 'Heartbeat returned 401, logging out');
        await handleLogout();
      }
    } catch (e) {
      // Network errors should not auto-logout; log and continue
      logger.debug('teach-layout', 'healthCheck', 'Heartbeat check failed', { error: e });
    }
  };

  const startLogin = async () => {
    if (!seqtaUrl) {
      logger.error('teach-layout', 'startLogin', 'No valid SEQTA URL found');
      return;
    }

    logger.info('teach-layout', 'startLogin', 'Starting authentication', { url: seqtaUrl });
    await authService.startLogin(seqtaUrl);

    const timer = setInterval(async () => {
      const sessionExists = await authService.checkSession();
      if (sessionExists) {
        clearInterval(timer);
        needsSetup.set(false);
        await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      }
    }, 1000);

    setTimeout(() => clearInterval(timer), 5 * 60 * 1000);
  };

  const handleLogout = async () => {
    const success = await authService.logout();
    if (success) {
      userInfo = undefined;
      showUserDropdown = false;
      await checkSession();
    }
  };

  const syncCloudSettings = async () => {
    try {
      const cloudUser = await cloudAuthService.init();
      if (cloudUser) {
        logger.info('teach-layout', 'syncCloudSettings', 'Cloud user found, fetching settings');
        const settings = await cloudSettingsService.getSettings();
        if (settings) {
          logger.info('teach-layout', 'syncCloudSettings', 'Applying cloud settings');
          await invoke('save_settings_merge', { patch: settings });

          await Promise.all([
            loadAccentColor(),
            loadTheme(),
            loadCurrentTheme(),
            (async () => {
              if (settings.language && settings.language !== get(locale)) {
                locale.set(settings.language);
              }
            })(),
            loadWeatherSettings(),
            loadEnhancedAnimationsSetting(),
            reloadSidebarSettings(),
          ]);
        }
      }
    } catch (e) {
      logger.error('teach-layout', 'syncCloudSettings', 'Failed to sync cloud settings', {
        error: e,
      });
    }
  };

  const changeLanguage = async (languageCode: string) => {
    try {
      locale.set(languageCode);
      await saveSettingsWithQueue({ language: languageCode });
      logger.info('teach-layout', 'changeLanguage', `Language changed to ${languageCode}`);
    } catch (e) {
      logger.error('teach-layout', 'changeLanguage', `Failed to save language preference: ${e}`, {
        error: e,
      });
    }
  };

  const loadUserInfo = async () => {
    const settings = await loadSettings(['disable_school_picture']);
    disableSchoolPicture = settings.disable_school_picture ?? false;
    userInfo = await authService.loadUserInfo({ disableSchoolPicture });
  };

  const loadWeatherSettings = async () => {
    await weather.loadSettings();
  };

  const fetchWeather = async (useIP = false) => {
    await weather.fetchWeather(useIP);
  };

  const sendAnalytics = async () => {
    try {
      await invoke('proxy_request', {
        url: 'https://betterseqta.org/api/analytics/desqta',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });
    } catch (e) {
      logger.debug('teach-layout', 'sendAnalytics', 'Failed to send analytics', { error: e });
    }
  };

  $effect(() => {
    document.documentElement.setAttribute('data-accent-color', '');
    document.documentElement.style.setProperty('--accent-color-value', $accentColor);
    logger.debug('teach-layout', '$effect', 'Applied accent color to root as CSS var', {
      accent: $accentColor,
    });
  });

  const loadEnhancedAnimationsSetting = async () => {
    const settings = await loadSettings(['enhanced_animations']);
    enhancedAnimations = settings.enhanced_animations ?? true;
    logger.info('teach-layout', 'loadEnhancedAnimationsSetting', 'Setting loaded', {
      enhancedAnimations,
    });
  };

  $effect(() => {
    logger.debug('teach-layout', '$effect', 'Enhanced animations effect triggered', {
      enhancedAnimations,
    });
    if (enhancedAnimations) {
      document.body.classList.add('enhanced-animations');
    } else {
      document.body.classList.remove('enhanced-animations');
    }
  });

  const loadSeqtaConfigAndMenu = async () => {
    try {
      if (!devMockEnabled) {
        const sessionExists = await authService.checkSession();
        if (!sessionExists) {
          logger.debug('teach-layout', 'loadSeqtaConfigAndMenu', 'Skipping: not authenticated');
          return;
        }
      }

      // For Teach, we'll use a simplified config loading
      // Teach may have different config endpoints, but for now we'll use the same structure
      menu = [...TEACH_MENU];

      // Filter menu items based on settings (similar to Learn)
      const settings = await loadSettings(['separate_rss_feed']);
      const separateRssFeed = settings.separate_rss_feed ?? false;
      if (!separateRssFeed) {
        menu = menu.filter((item) => item.path !== '/Teach/rss-feeds');
      }
    } catch (e) {
      logger.error('teach-layout', 'loadSeqtaConfigAndMenu', 'Failed to load config/menu', {
        error: e,
      });
    } finally {
      menuLoading = false;
    }
  };

  onMount(async () => {
    logger.logComponentMount('teach-layout');

    // Check if user is actually in Teach mode - redirect to Learn if not
    try {
      const { platformService } = await import('../../lib/services/platformService');
      const isTeachMode = await platformService.isTeachMode();
      if (!isTeachMode) {
        // User is in Learn mode, redirect to Learn dashboard
        const { goto } = await import('$app/navigation');
        goto('/');
        return; // Exit early, don't initialize Teach layout
      }
    } catch (e) {
      logger.error('teach-layout', 'onMount', 'Failed to check platform, redirecting to Learn', {
        error: e,
      });
      const { goto } = await import('$app/navigation');
      goto('/');
      return;
    }

    setupListeners();

    // Initialize theme and i18n first
    await Promise.all([loadAccentColor(), loadTheme(), loadCurrentTheme(), initI18n()]);

    shellReady = true;

    try {
      // Load saved language preference
      try {
        const settings = await loadSettings(['language']);
        if (settings.language && availableLocales.some((l) => l.code === settings.language)) {
          locale.set(settings.language);
        }
      } catch (e) {
        logger.debug('teach-layout', 'onMount', 'Could not load language preference', { error: e });
      }

      // Load dev mock flag early to control session flow
      try {
        const settings = await loadSettings(['dev_sensitive_info_hider']);
        devMockEnabled = settings.dev_sensitive_info_hider ?? false;
      } catch {}

      // Load all settings and check session
      await Promise.all([
        checkSession(),
        loadWeatherSettings(),
        loadEnhancedAnimationsSetting(),
        reloadSidebarSettings(),
        syncCloudSettings(),
      ]);

      // Load cached data from SQLite immediately for instant UI
      const { initializeApp } = await import('../../lib/services/startupService');
      await initializeApp();

      // Background tasks
      if (weatherEnabled) {
        fetchWeather(!forceUseLocation);
      }

      // Validate SEQTA session on app launch
      if (!devMockEnabled && !$needsSetup) {
        try {
          // Import platformService to check platform
          const { platformService } = await import('../../lib/services/platformService');
          const isTeachMode = await platformService.isTeachMode();

          const loginEndpoint = isTeachMode ? '/seqta/ta/login' : '/seqta/student/login';
          const loginBody = isTeachMode
            ? {
                mode: 'normal',
                query: null,
                redirect_url: seqtaUrl ? `${seqtaUrl}/help` : '',
              }
            : {
                mode: 'normal',
                query: null,
                redirect_url: seqtaUrl,
              };

          const response = await seqtaFetch(loginEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: loginBody,
          });

          const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
          const isAuthenticated =
            responseStr.includes('personUUID') || responseStr.includes('userName');

          if (
            !isAuthenticated &&
            (responseStr.includes('error') ||
              responseStr.includes('unauthorized') ||
              responseStr.includes('401'))
          ) {
            logger.warn('teach-layout', 'onMount', 'Session invalid, logging out');
            await handleLogout();
          }
        } catch (e) {
          logger.error('teach-layout', 'onMount', 'SEQTA session check failed', { error: e });
        }
      }

      // Run a one-time heartbeat health check on app open
      await healthCheck();

      // Send startup analytics
      sendAnalytics();

      // Check and apply initial fullscreen styling
      try {
        await invoke('handle_fullscreen_change');
      } catch (e) {
        logger.debug('teach-layout', 'onMount', 'Failed to check initial fullscreen state', {
          error: e,
        });
      }
    } finally {
      contentLoading = false;
    }
  });

  // Consolidated effects
  $effect(() => {
    if (autoCollapseSidebar) handlePageNavigation();
    if ($needsSetup) sidebarOpen = false;
    if ($page.url.pathname === '/settings') reloadSidebarSettings();
  });

  // Mobile detection and event listeners
  onMount(() => {
    const mql = window.matchMedia('(max-width: 640px)');

    const checkMobile = () => {
      const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
      const isNativeMobile = tauriPlatform === 'ios' || tauriPlatform === 'android';
      const isSmallViewport = mql.matches;
      const nextIsMobile = isNativeMobile || isSmallViewport;

      platform.state.isMobile = nextIsMobile;

      if (!isMobile && nextIsMobile) {
        sidebarOpen = false;
      }
    };

    checkMobile();
    const onMqlChange = () => checkMobile();
    try {
      mql.addEventListener('change', onMqlChange);
    } catch {
      // @ts-ignore
      mql.addListener(onMqlChange);
    }

    const events = [
      ['resize', checkMobile],
      ['click', handleClickOutside],
      ['mousemove', handleMouseMove],
    ] as const;

    events.forEach(([event, handler]) =>
      document.addEventListener(event, handler as EventListener),
    );

    return () => {
      events.forEach(([event, handler]) =>
        document.removeEventListener(event, handler as EventListener),
      );
      try {
        mql.removeEventListener('change', onMqlChange);
      } catch {
        // @ts-ignore
        mql.removeListener(onMqlChange);
      }
    };
  });
</script>

{#if !shellReady}
  <LoadingScreen />
{:else}
  <div class="flex flex-col h-screen">
    {#if !$needsSetup}
      <AppHeader
        {sidebarOpen}
        {weatherEnabled}
        {weatherData}
        {userInfo}
        {showUserDropdown}
        onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
        onToggleUserDropdown={() => (showUserDropdown = !showUserDropdown)}
        onLogout={handleLogout}
        onShowAbout={() => (showAboutModal = true)}
        onClickOutside={handleClickOutside}
        {disableSchoolPicture} />
    {/if}

    <div class="flex relative flex-1 min-h-0">
      {#if !$needsSetup && !menuLoading}
        <AppSidebar {sidebarOpen} {menu} onMenuItemClick={handlePageNavigation} />
      {/if}

      <!-- Mobile Sidebar Overlay -->
      {#if sidebarOpen && isMobile && !$needsSetup}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="fixed inset-0 z-20 bg-black/50 sm:hidden"
          onclick={() => (sidebarOpen = false)}
          role="button"
          tabindex="0"
          aria-label={$_('navigation.close_sidebar', { default: 'Close sidebar overlay' })}>
        </div>
      {/if}

      <!-- Main Content -->
      <main
        class="overflow-y-auto flex-1 border-t rounded-tl-xl {!$needsSetup
          ? 'border-l'
          : ''} border-zinc-200 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-900/50 transition-all duration-200"
        style="margin-right: {$themeBuilderSidebarOpen ? '384px' : '0'};">
        {#if contentLoading}
          <div class="flex items-center justify-center w-full h-full py-12">
            <LoadingScreen inline />
          </div>
        {:else if $needsSetup}
          <LoginScreen
            {seqtaUrl}
            onStartLogin={startLogin}
            onUrlChange={(url) => (seqtaUrl = url)} />
        {:else}
          {@render children()}
        {/if}
      </main>

      <!-- ThemeBuilder Sidebar -->
      {#if $themeBuilderSidebarOpen}
        <aside
          class="flex fixed top-0 right-0 z-50 flex-col w-96 h-full bg-white border-l shadow-xl transition-transform duration-200 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
          <ThemeBuilder>
            {#snippet close()}
              <button
                class="p-2 ml-auto rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                onclick={() => themeBuilderSidebarOpen.set(false)}
                aria-label={$_('common.close_theme_builder', { default: 'Close Theme Builder' })}>
                <Icon src={XMark} class="w-6 h-6" />
              </button>
            {/snippet}
          </ThemeBuilder>
        </aside>
      {/if}
    </div>
  </div>
{/if}
<Toaster
  position="bottom-right"
  theme={$theme === 'dark' ? 'dark' : 'light'}
  richColors
  expand={true}
  closeButton
  offset="20px"
  visibleToasts={5}
  toastOptions={{
    unstyled: true,
    classes: {
      toast:
        'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-lg border rounded-lg px-4 py-3 min-w-[300px] max-w-[500px] flex items-center gap-3 transition-all duration-200',
      title: 'text-sm font-semibold flex-1',
      description: 'text-sm text-zinc-600 dark:text-zinc-400 mt-1',
      success:
        'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      error:
        'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      warning:
        'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      closeButton:
        'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex-shrink-0',
      actionButton:
        'bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity',
      cancelButton:
        'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    },
  }} />
<AboutModal bind:open={showAboutModal} onclose={() => (showAboutModal = false)} />
