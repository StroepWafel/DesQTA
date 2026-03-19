import { invoke } from '@tauri-apps/api/core';
import { queueAdd, queueAll, queueDelete } from './idb';
import { cloudAuthService } from './cloudAuthService';
import {
  cloudSettingsService,
  persistCloudSettingsServerMeta,
  type SettingsSyncInitResponse,
} from './cloudSettingsService';
import { logger } from '../../utils/logger';

/** Keys uploaded on auto-sync and on `client_ahead` full push (excludes local-only cloud metadata). */
export const CLOUD_SYNC_SUBSET_KEYS = [
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
  'quiz_generator_enabled',
  'auto_collapse_sidebar',
  'auto_expand_sidebar_hover',
  'global_search_enabled',
  'dev_sensitive_info_hider',
  'dev_force_offline_mode',
  'accepted_cloud_eula',
  'send_anonymous_usage_statistics',
  'sync_cloud_pfp',
  'language',
  'zoom_level',
  'biometric_enabled',
] as const;

// Queue partial settings patches when offline/errors, and flush on demand

/**
 * Upload current local subset to cloud (e.g. after `client_ahead` from sync-init).
 */
export async function pushFullCloudSettingsSync(): Promise<void> {
  const cloudUser = await cloudAuthService.getUser();
  if (!cloudUser) return;
  const keys = [...CLOUD_SYNC_SUBSET_KEYS];
  const currentSettings = await invoke<Record<string, unknown>>('get_settings_subset', {
    keys,
  });
  await cloudSettingsService.syncSettings({ ...currentSettings });
}

/**
 * Auto-syncs settings to cloud if user is logged in
 * This runs in the background and doesn't block the save operation
 */
async function autoSyncToCloud(patch: Record<string, unknown>): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (cloudUser) {
      const currentSettings = await invoke<Record<string, unknown>>('get_settings_subset', {
        keys: [...CLOUD_SYNC_SUBSET_KEYS],
      });

      const settingsToSync = { ...currentSettings, ...patch };
      await cloudSettingsService.syncSettings(settingsToSync);
      console.log('Auto-synced settings to cloud');
    }
  } catch (e) {
    console.error('Failed to auto-sync to cloud:', e);
  }
}

export async function saveSettingsWithQueue(patch: Record<string, unknown>): Promise<void> {
  if (patch.dashboard_widgets_layout) {
    try {
      const layout = JSON.parse(patch.dashboard_widgets_layout as string);
      const widgets = layout?.widgets || [];
      if (widgets.length === 1 && widgets[0]?.id === 'timetable-page-widget') {
        console.log('Skipping cloud sync for temporary timetable page widget');
        await invoke('save_settings_merge', { patch });
        return;
      }
    } catch {
      // If parsing fails, continue with normal flow
    }
  }

  try {
    await invoke('save_settings_merge', { patch });

    autoSyncToCloud(patch).catch(() => {});
  } catch (e) {
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
      break;
    }
  }
}

function compareSettings(local: Record<string, unknown>, cloud: Record<string, unknown>): boolean {
  const allKeysSet = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);

  for (const key of allKeysSet) {
    const localValue = local?.[key];
    const cloudValue = cloud?.[key];

    const normalizeValue = (val: unknown): unknown => {
      if (val === undefined || val === null) return null;
      if (Array.isArray(val) && val.length === 0) return [];
      if (typeof val === 'object' && val !== null && Object.keys(val as object).length === 0) return {};
      return val;
    };

    if (JSON.stringify(normalizeValue(localValue)) !== JSON.stringify(normalizeValue(cloudValue))) {
      return true;
    }
  }

  return false;
}

/**
 * Legacy: full GET /api/settings + compare (pre sync-init).
 */
async function legacyAutoDownloadSettingsFromGet(): Promise<void> {
  const lastSyncedHash = sessionStorage.getItem('settings_last_synced_hash');
  const now = Date.now();

  const cloudSettings = await cloudSettingsService.getSettings();
  if (!cloudSettings) {
    logger.debug('settingsSync', 'legacyAutoDownload', 'No cloud settings found');
    return;
  }

  const allKeys = Object.keys(cloudSettings);
  const localSettings = await invoke<Record<string, unknown>>('get_settings_subset', {
    keys: allKeys,
  });

  const cloudSettingsHash = btoa(JSON.stringify(cloudSettings)).slice(0, 32);

  if (lastSyncedHash === cloudSettingsHash) {
    logger.debug('settingsSync', 'legacyAutoDownload', 'Already synced (hash match)');
    return;
  }

  if (!compareSettings(localSettings || {}, cloudSettings)) {
    logger.debug('settingsSync', 'legacyAutoDownload', 'Settings identical');
    sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
    return;
  }

  logger.info('settingsSync', 'legacyAutoDownload', 'Cloud settings differ, applying...');

  await invoke('save_settings_merge', {
    patch: cloudSettings,
  });

  sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
  sessionStorage.setItem('settings_last_reload', now.toString());

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        } else if (typeof location !== 'undefined') {
          location.reload();
        }
      } catch (reloadError) {
        logger.error('settingsSync', 'legacyAutoDownload', 'Reload failed', { error: reloadError });
      }
    }, 300);
  });
}

function reloadAfterCloudApply(): void {
  const now = Date.now();
  sessionStorage.setItem('settings_last_reload', now.toString());

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        } else if (typeof location !== 'undefined') {
          location.reload();
        }
      } catch (reloadError) {
        logger.error('settingsSync', 'autoDownloadSettingsFromCloud', 'Error during reload', {
          error: reloadError,
        });
      }
    }, 300);
  });
}

async function handleSyncInitResult(result: SettingsSyncInitResponse): Promise<void> {
  const rev = result.server?.settings_revision;
  const at = result.server?.settings_updated_at ?? null;

  if (typeof rev !== 'number' || !Number.isFinite(rev)) {
    logger.warn('settingsSync', 'autoDownloadSettingsFromCloud', 'sync-init missing server revision');
    return;
  }

  const revisionMarker = `rev:${rev}`;

  switch (result.status) {
    case 'no_remote_settings': {
      await persistCloudSettingsServerMeta(rev, at);
      sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'no_remote_settings');
      return;
    }
    case 'up_to_date': {
      await persistCloudSettingsServerMeta(rev, at);
      sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'up_to_date');
      return;
    }
    case 'client_ahead': {
      logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'client_ahead — uploading local settings');
      await pushFullCloudSettingsSync();
      return;
    }
    case 'server_has_newer': {
      if (!result.settings || typeof result.settings !== 'object') {
        logger.warn('settingsSync', 'autoDownloadSettingsFromCloud', 'server_has_newer but settings missing');
        return;
      }
      await invoke('save_settings_merge', {
        patch: {
          ...result.settings,
          cloud_settings_server_revision: rev,
          cloud_settings_server_updated_at: at,
        },
      });
      sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
      logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Applied newer cloud settings, reloading...');
      reloadAfterCloudApply();
      return;
    }
    default: {
      logger.warn('settingsSync', 'autoDownloadSettingsFromCloud', 'Unknown sync-init status', {
        status: (result as { status?: string }).status,
      });
    }
  }
}

/**
 * Auto-downloads settings from cloud on app launch if user is logged in.
 * Uses POST /api/settings/sync-init; falls back to GET /api/settings if sync-init fails.
 */
export async function autoDownloadSettingsFromCloud(): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (!cloudUser) {
      return;
    }

    const { isOfflineMode } = await import('../utils/offlineMode');
    const offline = await isOfflineMode();
    if (offline) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Skipping download (offline mode)');
      return;
    }

    const lastReloadTime = sessionStorage.getItem('settings_last_reload');
    const now = Date.now();
    if (lastReloadTime && now - parseInt(lastReloadTime, 10) < 5000) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Skipping download (recently reloaded)');
      return;
    }

    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Checking cloud settings (sync-init)...');

    try {
      const body = await cloudSettingsService.buildSyncInitBody();
      const result = await cloudSettingsService.syncInit(body);
      if (result) {
        await handleSyncInitResult(result);
      }
    } catch (e) {
      logger.warn('settingsSync', 'autoDownloadSettingsFromCloud', 'sync-init failed, falling back to GET', {
        error: e,
      });
      await legacyAutoDownloadSettingsFromGet();
    }
  } catch (e) {
    logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Failed (non-critical)', {
      error: e,
    });
  }
}
