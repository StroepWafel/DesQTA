/**
 * Startup Service - Instant Offline Mode
 *
 * Loads cached data from SQLite immediately on app startup to enable instant UI rendering.
 * Then triggers background sync to update data from SEQTA API.
 */

import { invoke } from '@tauri-apps/api/core';
import { cache } from '../../utils/cache';
import { logger } from '../../utils/logger';
import { idbCacheGet } from '../services/idb';
import { isOfflineMode } from '../utils/offlineMode';
import { notificationService } from './notificationService';
import { themeStoreService, resolveImageUrl } from './themeStoreService';

/**
 * Load all cached data from SQLite into memory cache for instant access
 * This runs synchronously on startup to populate the UI immediately
 */
export async function loadCachedDataOnStartup(): Promise<void> {
  try {
    logger.info('startup', 'loadCachedDataOnStartup', 'Loading cached data from SQLite');

    // Load common cache keys that pages need immediately
    const cacheKeys = [
      'assessments_overview_data',
      'upcoming_assessments_data',
      'lesson_colours',
      'notices_labels',
    ];

    // Load today's timetable and notices
    const today = new Date();
    const y = today.getFullYear();
    const m = (today.getMonth() + 1).toString().padStart(2, '0');
    const d = today.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Get Monday of current week for timetable
    const getMonday = (d: Date): Date => {
      const copy = new Date(d);
      const day = copy.getDay();
      const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
      copy.setDate(diff);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    const weekStart = getMonday(today);
    const from = `${weekStart.getFullYear()}-${(weekStart.getMonth() + 1).toString().padStart(2, '0')}-${weekStart.getDate().toString().padStart(2, '0')}`;
    const until = new Date(weekStart.getTime() + 4 * 86400000);
    const untilStr = `${until.getFullYear()}-${(until.getMonth() + 1).toString().padStart(2, '0')}-${until.getDate().toString().padStart(2, '0')}`;
    const timetableKey = `timetable_${from}_${untilStr}`;
    const noticesKey = `notices_${dateStr}`;

    cacheKeys.push(timetableKey, noticesKey);

    // Add folios, goals, and forums cache keys
    cacheKeys.push(
      'folios_settings_enabled',
      'goals_settings_enabled',
      'goals_years',
      'forums_settings_enabled',
      'forums_list',
    );

    // Load all cached data in parallel
    const loadPromises = cacheKeys.map(async (key) => {
      try {
        const cached = await idbCacheGet(key);
        if (cached) {
          // Restore to memory cache with appropriate TTL
          let ttl = 60; // default 60 minutes
          if (key === 'lesson_colours') ttl = 10;
          else if (key.startsWith('timetable_')) ttl = 30;
          else if (key.startsWith('notices_')) ttl = 30;
          else if (key === 'assessments_overview_data') ttl = 10;
          else if (
            key === 'folios_settings_enabled' ||
            key === 'goals_settings_enabled' ||
            key === 'forums_settings_enabled'
          )
            ttl = 60;
          else if (key === 'goals_years') ttl = 30;
          else if (key === 'forums_list') ttl = 15;

          cache.set(key, cached, ttl);
          logger.debug('startup', 'loadCachedDataOnStartup', `Loaded ${key} from SQLite`, {
            hasData: !!cached,
            size: JSON.stringify(cached)?.length,
          });
        }
      } catch (e) {
        logger.warn('startup', 'loadCachedDataOnStartup', `Failed to load ${key}`, { error: e });
      }
    });

    await Promise.allSettled(loadPromises);

    logger.info('startup', 'loadCachedDataOnStartup', 'Finished loading cached data from SQLite');
  } catch (e) {
    logger.error('startup', 'loadCachedDataOnStartup', 'Failed to load cached data', { error: e });
  }
}

/**
 * Trigger background sync to update data from SEQTA API
 * This runs after cached data is loaded to update in the background
 */
export async function triggerBackgroundSync(): Promise<void> {
  try {
    // Check if offline mode is forced
    const offline = await isOfflineMode();
    if (offline) {
      logger.info('startup', 'triggerBackgroundSync', 'Skipping background sync (offline mode)');
      return;
    }

    logger.info('startup', 'triggerBackgroundSync', 'Starting background sync');

    // Import warmupService dynamically to avoid circular dependencies
    const { warmUpCommonData } = await import('./warmupService');

    // Run sync in background (don't await - let it run async)
    warmUpCommonData()
      .then(async () => {
        logger.info('startup', 'triggerBackgroundSync', 'Background sync completed');
        // Show success toast notification
        const { toastStore } = await import('../stores/toast');
        toastStore.success('Background sync completed');
      })
      .catch(async (e) => {
        logger.error('startup', 'triggerBackgroundSync', 'Background sync failed', { error: e });
        // Show error toast notification
        const { toastStore } = await import('../stores/toast');
        toastStore.error('Background sync failed');
      });
  } catch (e) {
    logger.error('startup', 'triggerBackgroundSync', 'Failed to trigger background sync', {
      error: e,
    });
  }
}

/**
 * Download theme store images in the background
 * Fetches featured/spotlight themes and caches their thumbnails and screenshots
 */
async function downloadThemeStoreImages(): Promise<void> {
  try {
    // Check if offline mode is forced
    const offline = await isOfflineMode();
    if (offline) {
      logger.debug('startup', 'downloadThemeStoreImages', 'Skipping theme image download (offline mode)');
      return;
    }

    logger.info('startup', 'downloadThemeStoreImages', 'Starting theme store image download');

    // Fetch spotlight themes (featured themes)
    const spotlightResponse = await themeStoreService.getSpotlight();
    if (!spotlightResponse || !spotlightResponse.themes) {
      logger.debug('startup', 'downloadThemeStoreImages', 'No spotlight themes found');
      return;
    }

    const themes = spotlightResponse.themes;
    logger.debug('startup', 'downloadThemeStoreImages', `Found ${themes.length} themes to cache images for`);

    // Download images for each theme in parallel (but don't await - let it run in background)
    const imagePromises: Promise<void>[] = [];

    for (const theme of themes) {
      // Cache thumbnail if available
      if (theme.preview?.thumbnail) {
        imagePromises.push(
          resolveImageUrl(theme.preview.thumbnail, theme.id, 'thumbnail', undefined, theme.updated_at)
            .then(() => {
              logger.debug('startup', 'downloadThemeStoreImages', `Cached thumbnail for theme ${theme.id}`);
            })
            .catch((e) => {
              logger.debug('startup', 'downloadThemeStoreImages', `Failed to cache thumbnail for theme ${theme.id}`, { error: e });
            })
        );
      }

      // Cache screenshots if available
      if (theme.preview?.screenshots && Array.isArray(theme.preview.screenshots)) {
        theme.preview.screenshots.forEach((screenshot, index) => {
          imagePromises.push(
            resolveImageUrl(screenshot, theme.id, 'screenshot', index, theme.updated_at)
              .then(() => {
                logger.debug('startup', 'downloadThemeStoreImages', `Cached screenshot ${index} for theme ${theme.id}`);
              })
              .catch((e) => {
                logger.debug('startup', 'downloadThemeStoreImages', `Failed to cache screenshot ${index} for theme ${theme.id}`, { error: e });
              })
          );
        });
      }
    }

    // Wait for all images to be cached (but don't block startup)
    Promise.allSettled(imagePromises)
      .then(() => {
        logger.info('startup', 'downloadThemeStoreImages', 'Finished downloading theme store images');
      })
      .catch((e) => {
        logger.debug('startup', 'downloadThemeStoreImages', 'Some theme images failed to download (non-critical)', { error: e });
      });
  } catch (e) {
    // Silently fail - don't block startup if theme store is unavailable
    logger.debug('startup', 'downloadThemeStoreImages', 'Theme image download failed (non-critical)', {
      error: e,
    });
  }
}

/**
 * Check for app updates and install automatically in the background (desktop only)
 */
async function checkForUpdatesOnStartup(): Promise<void> {
  try {
    // Only check on desktop (updater plugin is desktop-only)
    const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
    const isDesktop = tauriPlatform !== 'ios' && tauriPlatform !== 'android';

    if (!isDesktop) {
      return;
    }

    // Check if offline mode is forced
    const offline = await isOfflineMode();
    if (offline) {
      logger.debug('startup', 'checkForUpdatesOnStartup', 'Skipping update check (offline mode)');
      return;
    }

    logger.info('startup', 'checkForUpdatesOnStartup', 'Checking for updates...');

    // Dynamically import updater to avoid issues on mobile
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (update?.available) {
      logger.info(
        'startup',
        'checkForUpdatesOnStartup',
        `Update available: ${update.version}, downloading and installing...`,
      );

      // Automatically download and install the update
      await update.downloadAndInstall();

      logger.info(
        'startup',
        'checkForUpdatesOnStartup',
        'Update downloaded and installed. App will restart on next launch.',
      );
    } else {
      logger.debug('startup', 'checkForUpdatesOnStartup', 'App is up to date');
    }
  } catch (error) {
    // Silently fail - don't annoy users with update check errors
    logger.debug(
      'startup',
      'checkForUpdatesOnStartup',
      'Update check/install failed (non-critical)',
      {
        error,
      },
    );
  }
}

/**
 * Initialize startup sequence: load cached data → show UI → sync in background → check for updates
 */
export async function initializeApp(): Promise<void> {
  // Step 1: Load cached data from SQLite immediately (blocks until loaded)
  await loadCachedDataOnStartup();

  // Step 2: Initialize notification system
  try {
    // Migrate localStorage data to database (one-time)
    await notificationService.migrateLocalStorageData();

    // Start background notification checker
    notificationService.startBackgroundChecker();

    // Run initial notification check
    notificationService.checkAndSendDueNotifications().catch((e) => {
      logger.error('startup', 'initializeApp', 'Initial notification check failed', { error: e });
    });

    // Cleanup old notifications (keep last 30 days)
    notificationService.cleanupOldNotifications(30).catch((e) => {
      logger.debug('startup', 'initializeApp', 'Notification cleanup error (non-critical)', {
        error: e,
      });
    });
  } catch (e) {
    logger.error('startup', 'initializeApp', 'Failed to initialize notification system', {
      error: e,
    });
  }

  // Step 3: Trigger background sync (non-blocking)
  triggerBackgroundSync();

  // Step 5: Download theme store images in background (non-blocking)
  downloadThemeStoreImages().catch((e) => {
    logger.debug('startup', 'initializeApp', 'Theme image download error (non-critical)', { error: e });
  });

  // Step 6: Check for updates silently in background (non-blocking, desktop only)
  checkForUpdatesOnStartup().catch((e) => {
    logger.debug('startup', 'initializeApp', 'Update check error (non-critical)', { error: e });
  });
}
