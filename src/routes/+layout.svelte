<script lang="ts">
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { Window } from '@tauri-apps/api/window';
  const appWindow = Window.getCurrent();
  import AboutModal from '../lib/components/AboutModal.svelte';
  import AppHeader from '../lib/components/AppHeader.svelte';
  import AppSidebar from '../lib/components/AppSidebar.svelte';
  import LoginScreen from '../lib/components/LoginScreen.svelte';
  import LoadingScreen from '../lib/components/LoadingScreen.svelte';
  import ThemeBuilder from '../lib/components/ThemeBuilder.svelte';
  import { Toaster } from 'svelte-sonner';
  import Onboarding from '../lib/components/Onboarding.svelte';
  import { cloudAuthService } from '../lib/services/cloudAuthService';
  import { cloudSettingsService } from '../lib/services/cloudSettingsService';
  import { saveSettingsWithQueue, flushSettingsQueue } from '../lib/services/settingsSync';
  import { authService, type UserInfo } from '../lib/services/authService';
  import { warmUpCommonData } from '../lib/services/warmupService';
  import { logger } from '../utils/logger';
  import { seqtaFetch } from '../utils/netUtil';
  import { useWeather } from '../lib/composables/useWeather';
  import { useSidebar } from '../lib/composables/useSidebar';
  import { usePlatform } from '../lib/composables/usePlatform';
  import '../app.css';
  import {
    accentColor,
    loadAccentColor,
    theme,
    loadTheme,
    loadCurrentTheme,
  } from '../lib/stores/theme';
  import { themeService } from '../lib/services/themeService';
  import { initI18n, locale, availableLocales, _ } from '../lib/i18n';
  import T from '../lib/components/T.svelte';
  import { themeBuilderSidebarOpen } from '../lib/stores/themeBuilderSidebar';
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
    PencilSquare,
    Rss,
    Flag,
    ChatBubbleBottomCenterText,
    FolderOpen,
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
  let showOnboarding = $state(false);
  let isFullscreen = $state(false);

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
  // Menu configuration with translation keys
  const DEFAULT_MENU = [
    { labelKey: 'navigation.dashboard', icon: Home, path: '/' },
    { labelKey: 'navigation.courses', icon: BookOpen, path: '/courses' },
    { labelKey: 'navigation.assessments', icon: ClipboardDocumentList, path: '/assessments' },
    { labelKey: 'navigation.timetable', icon: CalendarDays, path: '/timetable' },
    { labelKey: 'navigation.study', icon: PencilSquare, path: '/study' },
    { labelKey: 'navigation.goals', icon: Flag, path: '/goals' },
    { labelKey: 'navigation.forums', icon: ChatBubbleBottomCenterText, path: '/forums' },
    { labelKey: 'navigation.folios', icon: FolderOpen, path: '/folios' },
    { labelKey: 'navigation.messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
    { labelKey: 'navigation.rss_feeds', icon: Rss, path: '/rss-feeds' },
    { labelKey: 'navigation.portals', icon: GlobeAlt, path: '/portals' },
    { labelKey: 'navigation.notices', icon: DocumentText, path: '/notices' },
    { labelKey: 'navigation.news', icon: Newspaper, path: '/news' },
    { labelKey: 'navigation.directory', icon: User, path: '/directory' },
    { labelKey: 'navigation.reports', icon: ChartBar, path: '/reports' },
    { labelKey: 'navigation.analytics', icon: AcademicCap, path: '/analytics' },
    { labelKey: 'navigation.settings', icon: Cog6Tooth, path: '/settings' },
  ];
  let menu = $state([...DEFAULT_MENU]);
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
    logger.logFunctionEntry('layout', 'checkSession');
    try {
      if (devMockEnabled) {
        needsSetup.set(false);
        logger.info('layout', 'checkSession', 'Dev mock enabled; bypassing login');
        await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
        logger.logFunctionExit('layout', 'checkSession', { sessionExists: true });
      } else {
        const sessionExists = await authService.checkSession();
        needsSetup.set(!sessionExists);
        logger.info('layout', 'checkSession', `Session exists: ${sessionExists}`, {
          sessionExists,
        });
        if (sessionExists) {
          await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
        }
        logger.logFunctionExit('layout', 'checkSession', { sessionExists });
      }
    } catch (error) {
      logger.error('layout', 'checkSession', `Failed to check session: ${error}`, { error });
    }
  };

  // Remove duplicate onMount - consolidating below

  let unlisten: (() => void) | undefined;
  let checkFullscreenState: (() => Promise<void>) | undefined;

  const setupListeners = async () => {
    logger.debug('layout', 'onMount', 'Setting up reload listener');
    unlisten = await listen<string>('reload', () => {
      logger.info('layout', 'reload_listener', 'Received reload event');
      location.reload();
    });

    // Listen for fullscreen/maximized changes from Tauri backend
    await listen<boolean>('fullscreen-changed', async (event) => {
      isFullscreen = event.payload;
      logger.debug('layout', 'fullscreen_listener', `Window state changed: ${isFullscreen}`);
    });

    // Check fullscreen state only when window state actually changes (event-driven)
    checkFullscreenState = async () => {
      try {
        const [currentFullscreen, currentMaximized] = await Promise.all([
          appWindow.isFullscreen(),
          appWindow.isMaximized().catch(() => false), // Fallback to false if not supported
        ]);
        // Consider both fullscreen and maximized as "fullscreen" for corner removal
        const shouldRemoveCorners = currentFullscreen || currentMaximized;
        if (shouldRemoveCorners !== isFullscreen) {
          isFullscreen = shouldRemoveCorners;
          logger.debug(
            'layout',
            'checkFullscreenState',
            `Window state updated: ${isFullscreen} (fullscreen: ${currentFullscreen}, maximized: ${currentMaximized})`,
          );
        }
      } catch (e) {
        logger.debug('layout', 'checkFullscreenState', 'Failed to check window state', {
          error: e,
        });
      }
    };

    // Check initial state once
    await checkFullscreenState();

    // Listen to Tauri window events - these fire when window state actually changes
    // The backend also emits 'fullscreen-changed' events on Resized/Moved, so we rely on that
    // plus these frontend events as a backup
    appWindow.onResized(checkFullscreenState);
    appWindow.onMoved(checkFullscreenState);
  };

  onDestroy(() => {
    logger.logComponentUnmount('layout');
    if (unlisten) {
      logger.debug('layout', 'onDestroy', 'Cleaning up reload listener');
      unlisten();
    }
    window.removeEventListener('redo-onboarding', handleRedoOnboarding);
  });

  // Consolidated settings loader
  const loadSettings = async (keys: string[]) => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys });
      return subset || {};
    } catch (e) {
      logger.error('layout', 'loadSettings', `Failed to load settings: ${e}`, { keys, error: e });
      return {};
    }
  };

  const reloadEnhancedAnimationsSetting = async () => {
    const settings = await loadSettings(['enhanced_animations']);
    enhancedAnimations = settings.enhanced_animations ?? true;
    logger.debug(
      'layout',
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
      const response = await seqtaFetch('/seqta/student/heartbeat', {
        method: 'POST',
        body: {
          timestamp: '1970-01-01 00:00:00.0',
          hash: '#?page=/home',
        },
      });

      const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
      if (
        responseStr.includes('"status":"401"') ||
        responseStr.includes('"status":401') ||
        responseStr.toLowerCase().includes('unauthorized')
      ) {
        logger.warn('layout', 'healthCheck', 'Heartbeat returned 401, logging out');
        await handleLogout();
      }
    } catch (e) {
      // Network errors should not auto-logout; log and continue
      logger.debug('layout', 'healthCheck', 'Heartbeat check failed', { error: e });
    }
  };

  const startLogin = async () => {
    if (!seqtaUrl) {
      logger.error('layout', 'startLogin', 'No valid SEQTA URL found');
      return;
    }

    logger.info('layout', 'startLogin', 'Starting authentication', { url: seqtaUrl });
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

  const autoDownloadSettingsFromCloud = async () => {
    try {
      const cloudUser = await cloudAuthService.getUser();
      if (!cloudUser) {
        // User not logged in, skip download
        return;
      }

      // Check if offline mode is forced
      const { isOfflineMode } = await import('$lib/utils/offlineMode');
      const offline = await isOfflineMode();
      if (offline) {
        logger.debug('layout', 'autoDownloadSettingsFromCloud', 'Skipping download (offline mode)');
        return;
      }

      // Check if we just reloaded (prevent infinite loop)
      const lastReloadTime = sessionStorage.getItem('settings_last_reload');
      const now = Date.now();
      if (lastReloadTime && now - parseInt(lastReloadTime) < 5000) {
        logger.debug('layout', 'autoDownloadSettingsFromCloud', 'Skipping download (recently reloaded)');
        return;
      }

      // Check if we've already synced these exact settings (prevent re-downloading same settings)
      const lastSyncedHash = sessionStorage.getItem('settings_last_synced_hash');

      logger.info('layout', 'autoDownloadSettingsFromCloud', 'Checking for cloud settings...');

      // Fetch cloud settings first
      const cloudSettings = await cloudSettingsService.getSettings();
      if (!cloudSettings) {
        logger.debug('layout', 'autoDownloadSettingsFromCloud', 'No cloud settings found');
        return;
      }

      // Get all keys from cloud settings to fetch local settings
      const allKeys = Object.keys(cloudSettings);
      
      // Get current local settings for comparison (using all keys from cloud)
      const localSettings = await invoke<any>('get_settings_subset', {
        keys: allKeys,
      });

      // Compare settings more robustly
      // Only compare keys that exist in both objects, and handle undefined/null properly
      const compareSettings = (local: any, cloud: any): boolean => {
        const allKeysSet = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
        const differences: string[] = [];

        for (const key of allKeysSet) {
          const localValue = local?.[key];
          const cloudValue = cloud?.[key];

          // Normalize values for comparison (handle undefined, null, empty arrays/objects)
          const normalizeValue = (val: any): any => {
            if (val === undefined || val === null) return null;
            if (Array.isArray(val) && val.length === 0) return [];
            if (typeof val === 'object' && Object.keys(val).length === 0) return {};
            return val;
          };

          const normalizedLocal = normalizeValue(localValue);
          const normalizedCloud = normalizeValue(cloudValue);

          // Compare JSON strings
          const localStr = JSON.stringify(normalizedLocal);
          const cloudStr = JSON.stringify(normalizedCloud);

          if (localStr !== cloudStr) {
            differences.push(key);
          }
        }

        if (differences.length > 0) {
          logger.debug('layout', 'autoDownloadSettingsFromCloud', 'Settings differ', {
            differentKeys: differences,
            count: differences.length,
          });
          return true;
        }

        return false;
      };

      // Create a hash of cloud settings to check if we've already synced this exact version
      const cloudSettingsHash = btoa(JSON.stringify(cloudSettings)).slice(0, 32);
      
      if (lastSyncedHash === cloudSettingsHash) {
        logger.debug('layout', 'autoDownloadSettingsFromCloud', 'Settings already synced (hash match), skipping download');
        return;
      }

      const settingsChanged = compareSettings(localSettings, cloudSettings);

      if (!settingsChanged) {
        logger.debug('layout', 'autoDownloadSettingsFromCloud', 'Settings are identical, skipping download');
        // Store hash even if identical to prevent re-checking
        sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
        return;
      }

      logger.info('layout', 'autoDownloadSettingsFromCloud', 'Cloud settings differ from local, downloading...');

      // Download and apply cloud settings
      await invoke('save_settings_merge', {
        patch: cloudSettings,
      });

      logger.info('layout', 'autoDownloadSettingsFromCloud', 'Settings downloaded and applied from cloud');

      // Store hash of synced settings and mark reload time BEFORE reload
      sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
      sessionStorage.setItem('settings_last_reload', now.toString());

      // Reload the page to apply the new settings
      logger.info('layout', 'autoDownloadSettingsFromCloud', 'Reloading page to apply settings...');
      
      // Use a small delay to ensure settings are saved, then reload
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            if (typeof window !== 'undefined' && window.location) {
              logger.info('layout', 'autoDownloadSettingsFromCloud', 'Executing reload now...');
              window.location.reload();
            } else if (typeof location !== 'undefined') {
              logger.info('layout', 'autoDownloadSettingsFromCloud', 'Using fallback location.reload()');
              location.reload();
            } else {
              logger.error('layout', 'autoDownloadSettingsFromCloud', 'Cannot reload - neither window.location nor location available');
            }
          } catch (reloadError) {
            logger.error('layout', 'autoDownloadSettingsFromCloud', 'Error during reload', { error: reloadError });
            // Last resort: try direct location.reload()
            try {
              if (typeof location !== 'undefined') {
                location.reload();
              }
            } catch (e) {
              logger.error('layout', 'autoDownloadSettingsFromCloud', 'Fallback reload also failed', { error: e });
            }
          }
        }, 300);
      });
    } catch (e) {
      // Silently fail - don't block startup if cloud download fails
      logger.debug('layout', 'autoDownloadSettingsFromCloud', 'Failed to download settings from cloud (non-critical)', {
        error: e,
      });
    }
  };

  const syncCloudSettings = async () => {
    try {
      // Initialize cloud auth from current profile
      const cloudUser = await cloudAuthService.init();
      if (cloudUser) {
        logger.info('layout', 'syncCloudSettings', 'Cloud user found, fetching settings');
        const settings = await cloudSettingsService.getSettings();
        if (settings) {
          logger.info('layout', 'syncCloudSettings', 'Applying cloud settings');
          // Save merged settings
          await invoke('save_settings_merge', { patch: settings });

          // Reload settings relevant to layout immediately
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
      logger.error('layout', 'syncCloudSettings', 'Failed to sync cloud settings', { error: e });
    }
  };

  // Language change handler
  const changeLanguage = async (languageCode: string) => {
    try {
      locale.set(languageCode);
      const { saveSettingsWithQueue } = await import('$lib/services/settingsSync');
      await saveSettingsWithQueue({ language: languageCode });
      logger.info('layout', 'changeLanguage', `Language changed to ${languageCode}`);
    } catch (e) {
      logger.error('layout', 'changeLanguage', `Failed to save language preference: ${e}`, {
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
      logger.debug('layout', 'sendAnalytics', 'Failed to send analytics', { error: e });
    }
  };

  $effect(() => {
    document.documentElement.setAttribute('data-accent-color', '');
    document.documentElement.style.setProperty('--accent-color-value', $accentColor);
    logger.debug('layout', '$effect', 'Applied accent color to root as CSS var', {
      accent: $accentColor,
    });
  });

  const loadEnhancedAnimationsSetting = async () => {
    const settings = await loadSettings(['enhanced_animations']);
    enhancedAnimations = settings.enhanced_animations ?? true;
    logger.info('layout', 'loadEnhancedAnimationsSetting', 'Setting loaded', {
      enhancedAnimations,
    });
  };

  $effect(() => {
    logger.debug('layout', '$effect', 'Enhanced animations effect triggered', {
      enhancedAnimations,
    });
    if (enhancedAnimations) {
      document.body.classList.add('enhanced-animations');
    } else {
      document.body.classList.remove('enhanced-animations');
    }
  });

  // Listen for redo onboarding event
  const handleRedoOnboarding = async () => {
    try {
      const settings = await loadSettings(['has_been_through_onboarding']);
      if (!settings.has_been_through_onboarding) {
        showOnboarding = true;
        sidebarOpen = true;
      }
    } catch (e) {
      logger.debug('layout', 'handleRedoOnboarding', 'Could not check onboarding status', {
        error: e,
      });
    }
  };

  onMount(async () => {
    logger.logComponentMount('layout');
    setupListeners();

    // Set up redo onboarding listener
    window.addEventListener('redo-onboarding', handleRedoOnboarding);

    // Initialize theme and i18n first
    await Promise.all([loadAccentColor(), loadTheme(), loadCurrentTheme(), initI18n()]);

    // Initialize theme sync in background (don't block startup)
    themeService.initializeThemeSync().catch((e) => {
      logger.error('layout', 'onMount', 'Failed to initialize theme sync', { error: e });
    });

    shellReady = true;

    try {
      // Load saved language preference
      try {
        const settings = await loadSettings(['language']);
        if (settings.language && availableLocales.some((l) => l.code === settings.language)) {
          locale.set(settings.language);
        }
      } catch (e) {
        logger.debug('layout', 'onMount', 'Could not load language preference', { error: e });
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

      // Auto-download settings from cloud in background (non-blocking)
      autoDownloadSettingsFromCloud().catch((e) => {
        logger.debug('layout', 'onMount', 'Settings download error (non-critical)', { error: e });
      });

      // Check if user needs onboarding - DISABLED: Only show when button is pressed in settings
      // try {
      //   const settings = await loadSettings(['has_been_through_onboarding']);
      //   if (!settings.has_been_through_onboarding) {
      //     // Wait a bit for UI to settle
      //     setTimeout(() => {
      //       showOnboarding = true;
      //       sidebarOpen = true; // Ensure sidebar is open for first step
      //     }, 1000);
      //   }
      // } catch (e) {
      //   logger.debug('layout', 'onMount', 'Could not check onboarding status', { error: e });
      // }

      // Load cached data from SQLite immediately for instant UI
      const { initializeApp } = await import('$lib/services/startupService');
      await initializeApp();

      // Background tasks (warmup already triggered by startupService)
      if (weatherEnabled) {
        fetchWeather(!forceUseLocation);
      }

      // Validate SEQTA session on app launch
      if (!devMockEnabled && !$needsSetup) {
        try {
          const response = await seqtaFetch('/seqta/student/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { mode: 'normal', query: null, redirect_url: seqtaUrl },
          });

          const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
          const isAuthenticated = responseStr.includes('site.name.abbrev');

          if (
            !isAuthenticated &&
            (responseStr.includes('error') ||
              responseStr.includes('unauthorized') ||
              responseStr.includes('401'))
          ) {
            logger.warn('layout', 'onMount', 'Session invalid, logging out');
            await handleLogout();
          }
        } catch (e) {
          logger.error('layout', 'onMount', 'SEQTA session check failed', { error: e });
        }
      }

      // Run a one-time heartbeat health check on app open
      await healthCheck();

      // Send startup analytics
      sendAnalytics();

      // Check and apply initial fullscreen state (also check maximized)
      try {
        const [currentFullscreen, currentMaximized] = await Promise.all([
          appWindow.isFullscreen(),
          appWindow.isMaximized().catch(() => false),
        ]);
        isFullscreen = currentFullscreen || currentMaximized;
        logger.debug(
          'layout',
          'onMount',
          `Initial fullscreen/maximized state: ${isFullscreen} (fullscreen: ${currentFullscreen}, maximized: ${currentMaximized})`,
        );
      } catch (e) {
        logger.debug('layout', 'onMount', 'Failed to check initial fullscreen state', { error: e });
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
    // Treat mobile either as a native mobile platform (Tauri)
    // or when viewport is below the `sm` breakpoint (~640px)
    const mql = window.matchMedia('(max-width: 640px)');

    const checkMobile = () => {
      const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
      const isNativeMobile = tauriPlatform === 'ios' || tauriPlatform === 'android';
      const isSmallViewport = mql.matches;
      const nextIsMobile = isNativeMobile || isSmallViewport;

      // Update platform state
      platform.state.isMobile = nextIsMobile;

      // If switching from non-mobile to mobile, ensure sidebar is closed
      if (!isMobile && nextIsMobile) {
        sidebarOpen = false;
      }
    };

    checkMobile();
    const onMqlChange = () => checkMobile();
    try {
      // Modern browsers
      mql.addEventListener('change', onMqlChange);
    } catch {
      // Safari fallback
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

  const loadSeqtaConfigAndMenu = async () => {
    try {
      if (!devMockEnabled) {
        const sessionExists = await authService.checkSession();
        if (!sessionExists) {
          logger.debug('layout', 'loadSeqtaConfigAndMenu', 'Skipping: not authenticated');
          return;
        }
      }

      let config = await invoke('load_seqta_config');
      let latestConfig = null;

      if (!config) {
        // Fetch latest config
        const res = await seqtaFetch('/seqta/student/load/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {},
        });
        latestConfig = typeof res === 'string' ? JSON.parse(res) : res;
        seqtaConfig = latestConfig;
        await invoke('save_seqta_config', { config: latestConfig });
      } else {
        // Check if existing config is outdated
        const res = await seqtaFetch('/seqta/student/load/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {},
        });
        latestConfig = typeof res === 'string' ? JSON.parse(res) : res;
        const isDifferent = await invoke('is_seqta_config_different', { newConfig: latestConfig });

        if (isDifferent) {
          seqtaConfig = latestConfig;
          await invoke('save_seqta_config', { config: latestConfig });
        } else {
          seqtaConfig = config;
        }
      }

      menu = [...DEFAULT_MENU]; // Use default menu configuration

      // Filter menu items based on SEQTA config
      if (latestConfig?.payload) {
        const goalsEnabled = latestConfig.payload['coneqt-s.page.goals']?.value === 'enabled';
        if (!goalsEnabled) {
          menu = menu.filter((item) => item.path !== '/goals');
        }
        const forumsPageEnabled = latestConfig.payload['coneqt-s.page.forums']?.value === 'enabled';
        const forumsGreetingExists = latestConfig.payload['coneqt-s.forum.greeting'] !== undefined;
        const forumsEnabled = forumsPageEnabled || forumsGreetingExists;
        if (!forumsEnabled) {
          menu = menu.filter((item) => item.path !== '/forums');
        }
        const foliosEnabled = latestConfig.payload['coneqt-s.page.folios']?.value === 'enabled';
        if (!foliosEnabled) {
          menu = menu.filter((item) => item.path !== '/folios');
        }
      }

      // Apply menu order from settings
      await applyMenuOrder();

      // Filter RSS feeds menu item based on setting (after menu order is applied)
      const settings = await loadSettings(['separate_rss_feed']);
      const separateRssFeed = settings.separate_rss_feed ?? false;
      if (!separateRssFeed) {
        menu = menu.filter((item) => item.path !== '/rss-feeds');
      }
    } catch (e) {
      logger.error('layout', 'loadSeqtaConfigAndMenu', 'Failed to load config/menu', { error: e });
    } finally {
      menuLoading = false;
    }
  };

  const applyMenuOrder = async () => {
    try {
      const settings = await loadSettings(['menu_order']);
      const menuOrder = settings.menu_order as string[] | undefined;

      // Use current menu state instead of DEFAULT_MENU to preserve filters
      const currentMenu = [...menu];
      const currentMenuMap = new Map(currentMenu.map((item) => [item.path, item]));

      if (menuOrder && Array.isArray(menuOrder) && menuOrder.length > 0) {
        // Reorder menu based on saved order, keeping any new items at the end
        const orderedMenu: typeof DEFAULT_MENU = [];
        const addedPaths = new Set<string>();

        // Add items in saved order (only if they exist in current menu)
        for (const path of menuOrder) {
          const item = currentMenuMap.get(path);
          if (item) {
            orderedMenu.push(item);
            addedPaths.add(path);
          }
        }

        // Add any items not in saved order (new items that exist in current menu)
        for (const item of currentMenu) {
          if (!addedPaths.has(item.path)) {
            orderedMenu.push(item);
          }
        }

        menu = orderedMenu;
      }
      // If no menu order, keep current menu (already filtered)
    } catch (e) {
      logger.error('layout', 'applyMenuOrder', 'Failed to apply menu order', { error: e });
      // Don't reset to DEFAULT_MENU on error, keep current filtered menu
    }
  };

  // Track recent activity when route changes

  // Config/menu loading is handled in checkSession/startLogin
</script>

{#if !shellReady}
  <LoadingScreen />
{:else}
  <div
    class="flex flex-col h-screen w-screen {isFullscreen
      ? ''
      : 'rounded-2xl'} overflow-hidden theme-bg"
    style="outline: none; border: none; margin: 0; padding: 0; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
    {#if !$needsSetup}
      <AppHeader
        {sidebarOpen}
        {weatherEnabled}
        {weatherData}
        {userInfo}
        {showUserDropdown}
        {isFullscreen}
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
        class="overflow-y-auto flex-1 border-t {!$needsSetup ? 'border-l' : ''} {isFullscreen
          ? ''
          : 'rounded-br-2xl'} border-zinc-200 dark:border-zinc-700/50 theme-bg transition-all duration-200"
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
          class="flex fixed top-0 right-0 z-50 flex-col w-96 h-full theme-bg border-l shadow-xl transition-transform duration-200 border-zinc-200 dark:border-zinc-700">
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
        'bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md text-zinc-900 dark:text-zinc-100 shadow-2xl border rounded-xl px-4 py-3 min-w-[300px] max-w-[500px] flex items-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-white/20 dark:border-zinc-700/40',
      title: 'text-sm font-semibold flex-1',
      description: 'text-sm text-zinc-600 dark:text-zinc-400 mt-1',
      success:
        'border-green-200/60 dark:border-green-800/60 bg-green-50/95 dark:bg-green-900/40 backdrop-blur-md text-green-700 dark:text-green-300',
      error:
        'border-red-200/60 dark:border-red-800/60 bg-red-50/95 dark:bg-red-900/40 backdrop-blur-md text-red-700 dark:text-red-300',
      info: 'border-blue-200/60 dark:border-blue-800/60 bg-blue-50/95 dark:bg-blue-900/40 backdrop-blur-md text-blue-700 dark:text-blue-300',
      warning:
        'border-yellow-200/60 dark:border-yellow-800/60 bg-yellow-50/95 dark:bg-yellow-900/40 backdrop-blur-md text-yellow-700 dark:text-yellow-300',
      closeButton:
        'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all duration-200 ease-in-out rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex-shrink-0 transform hover:scale-110 active:scale-95',
      actionButton:
        'bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95',
      cancelButton:
        'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95',
    },
  }} />
<AboutModal bind:open={showAboutModal} onclose={() => (showAboutModal = false)} />
<Onboarding open={showOnboarding} onComplete={() => (showOnboarding = false)} />
