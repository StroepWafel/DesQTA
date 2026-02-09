import { invoke } from '@tauri-apps/api/core';
import { queueAdd, queueAll, queueDelete } from './idb';
import { cloudAuthService } from './cloudAuthService';
import { cloudSettingsService } from './cloudSettingsService';
import { logger } from '../../utils/logger';

// Queue partial settings patches when offline/errors, and flush on demand

/**
 * Auto-syncs settings to cloud if user is logged in
 * This runs in the background and doesn't block the save operation
 */
async function autoSyncToCloud(patch: Record<string, any>): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (cloudUser) {
      // Get current full settings to sync complete state
      const currentSettings = await invoke<any>('get_settings_subset', {
        keys: [
          'shortcuts',
          'feeds',
          'weather_enabled',
          'weather_city',
          'weather_country',
          'reminders_enabled',
          'force_use_location',
          'accent_color',
          'theme',
          'current_theme',
          'disable_school_picture',
          'enhanced_animations',
          'gemini_api_key',
          'ai_integrations_enabled',
          'grade_analyser_enabled',
          'lesson_summary_analyser_enabled',
          'auto_collapse_sidebar',
          'auto_expand_sidebar_hover',
          'global_search_enabled',
          'dev_sensitive_info_hider',
          'dev_force_offline_mode',
          'accepted_cloud_eula',
          'language',
        ],
      });

      // Merge patch into current settings for sync
      const settingsToSync = { ...currentSettings, ...patch };
      await cloudSettingsService.syncSettings(settingsToSync);
      console.log('Auto-synced settings to cloud');
    }
  } catch (e) {
    // Silently fail - don't block settings save if cloud sync fails
    console.error('Failed to auto-sync to cloud:', e);
  }
}

export async function saveSettingsWithQueue(patch: Record<string, any>): Promise<void> {
  // Skip cloud sync if this is just a widget layout update from the timetable page
  if (patch.dashboard_widgets_layout) {
    try {
      const layout = JSON.parse(patch.dashboard_widgets_layout);
      const widgets = layout?.widgets || [];
      // If it's only the temporary timetable page widget, don't trigger cloud sync
      if (widgets.length === 1 && widgets[0]?.id === 'timetable-page-widget') {
        console.log('Skipping cloud sync for temporary timetable page widget');
        // Still save locally but don't sync to cloud
        await invoke('save_settings_merge', { patch });
        return;
      }
    } catch (e) {
      // If parsing fails, continue with normal flow
    }
  }
  
  try {
    await invoke('save_settings_merge', { patch });
    
    // Auto-sync to cloud in background (non-blocking)
    autoSyncToCloud(patch).catch(() => {
      // Already logged in autoSyncToCloud
    });
  } catch (e) {
    // Queue for later
    await queueAdd({ type: 'settings_patch', payload: patch });
  }
}

export async function flushSettingsQueue(): Promise<void> {
  const items = await queueAll();
  for (const item of items) {
    if (item.type !== 'settings_patch') continue;
    try {
      await invoke('save_settings_merge', { patch: item.payload });
      await queueDelete(item.id!);
    } catch {
      // stop if still failing to avoid spin
      break;
    }
  }
}

/**
 * Auto-downloads settings from cloud on app launch if user is logged in
 * This runs in the background and doesn't block startup
 */
export async function autoDownloadSettingsFromCloud(): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (!cloudUser) {
      // User not logged in, skip download
      return;
    }

    // Check if offline mode is forced
    const { isOfflineMode } = await import('../utils/offlineMode');
    const offline = await isOfflineMode();
    if (offline) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Skipping download (offline mode)');
      return;
    }

    // Check if we just reloaded (prevent infinite loop)
    const lastReloadTime = sessionStorage.getItem('settings_last_reload');
    const now = Date.now();
    if (lastReloadTime && now - parseInt(lastReloadTime) < 5000) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Skipping download (recently reloaded)');
      return;
    }

    // Check if we've already synced these exact settings (prevent re-downloading same settings)
    const lastSyncedHash = sessionStorage.getItem('settings_last_synced_hash');

    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Checking for cloud settings...');

    // Fetch cloud settings first
    const cloudSettings = await cloudSettingsService.getSettings();
    if (!cloudSettings) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'No cloud settings found');
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
        logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Settings differ', {
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
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Settings already synced (hash match), skipping download');
      return;
    }

    const settingsChanged = compareSettings(localSettings, cloudSettings);

    if (!settingsChanged) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Settings are identical, skipping download');
      // Store hash even if identical to prevent re-checking
      sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
      return;
    }

    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Cloud settings differ from local, downloading...');

    // Download and apply cloud settings
    await invoke('save_settings_merge', {
      patch: cloudSettings,
    });

    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Settings downloaded and applied from cloud');

    // Store hash of synced settings and mark reload time BEFORE reload
    sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
    sessionStorage.setItem('settings_last_reload', now.toString());

    // Reload the page to apply the new settings
    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Reloading page to apply settings...');
    
    // Use a small delay to ensure settings are saved, then reload
    // Use requestAnimationFrame to ensure DOM is ready, then reload after a short delay
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (typeof window !== 'undefined' && window.location) {
            logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Executing reload now...');
            window.location.reload();
          } else if (typeof location !== 'undefined') {
            logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Using fallback location.reload()');
            location.reload();
          } else {
            logger.error('settingsSync', 'autoDownloadSettingsFromCloud', 'Cannot reload - neither window.location nor location available');
          }
        } catch (reloadError) {
          logger.error('settingsSync', 'autoDownloadSettingsFromCloud', 'Error during reload', { error: reloadError });
          // Last resort: try direct location.reload()
          try {
            if (typeof location !== 'undefined') {
              location.reload();
            }
          } catch (e) {
            logger.error('settingsSync', 'autoDownloadSettingsFromCloud', 'Fallback reload also failed', { error: e });
          }
        }
      }, 300);
    });
  } catch (e) {
    // Silently fail - don't block startup if cloud download fails
    logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Failed to download settings from cloud (non-critical)', {
      error: e,
    });
  }
}

// Optional: flush on regain connectivity
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSettingsQueue().catch(() => {});
  });
}


