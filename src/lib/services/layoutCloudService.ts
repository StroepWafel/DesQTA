import { invoke } from '@tauri-apps/api/core';
import { cloudAuthService } from './cloudAuthService';
import { checkCloudSignOutAlert } from './cloudSignOutAlertService';
import {
  cloudSettingsService,
  persistCloudSettingsServerMeta,
} from './cloudSettingsService';
import { pushFullCloudSettingsSync } from './settingsSync';
import {
  loadAccentColor,
  loadTheme,
  loadCurrentTheme,
} from '$lib/stores/theme';
import { get } from 'svelte/store';
import { locale } from '$lib/i18n';
import { logger } from '../../utils/logger';

/** Non-layout callers: background pull + reload when server has newer (e.g. legacy hooks). */
export { autoDownloadSettingsFromCloud } from './settingsSync';

function scheduleReloadForCloudSettings(): void {
  const now = Date.now();
  sessionStorage.setItem('settings_last_reload', String(now));
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        } else if (typeof location !== 'undefined') {
          location.reload();
        }
      } catch (e) {
        logger.error('layoutCloud', 'scheduleReloadForCloudSettings', 'Reload failed', { error: e });
      }
    }, 300);
  });
}

/**
 * Single startup path: one `sync-init`, apply metadata, optional one `client_ahead` POST,
 * merge + reload when `server_has_newer` (then loaders run after reload).
 */
export async function runCloudSettingsStartupSync(options: {
  loadWeatherSettings: () => Promise<void>;
  loadEnhancedAnimationsSetting: () => Promise<void>;
  reloadSidebarSettings: () => Promise<void>;
}): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.init();
    if (!cloudUser) {
      await checkCloudSignOutAlert();
      return;
    }

    const { isOfflineMode } = await import('$lib/utils/offlineMode');
    if (await isOfflineMode()) {
      logger.debug('layoutCloud', 'runCloudSettingsStartupSync', 'Skipping (offline mode)');
      return;
    }

    logger.info('layoutCloud', 'runCloudSettingsStartupSync', 'Cloud user found, sync-init');

    let languageFromCloud: string | undefined;
    let shouldReload = false;

    try {
      const body = await cloudSettingsService.buildSyncInitBody();
      const result = await cloudSettingsService.syncInit(body);

      if (result) {
        const rev = result.server?.settings_revision;
        const at = result.server?.settings_updated_at ?? null;

        switch (result.status) {
          case 'no_remote_settings': {
            if (typeof rev === 'number' && Number.isFinite(rev)) {
              await persistCloudSettingsServerMeta(rev, at);
              sessionStorage.setItem('settings_last_synced_hash', `rev:${rev}`);
            }
            break;
          }
          case 'up_to_date': {
            if (typeof rev === 'number' && Number.isFinite(rev)) {
              await persistCloudSettingsServerMeta(rev, at);
              sessionStorage.setItem('settings_last_synced_hash', `rev:${rev}`);
            }
            break;
          }
          case 'client_ahead': {
            logger.info('layoutCloud', 'runCloudSettingsStartupSync', 'client_ahead — uploading');
            await pushFullCloudSettingsSync();
            break;
          }
          case 'server_has_newer': {
            if (result.settings && typeof result.settings === 'object' && typeof rev === 'number') {
              await invoke('save_settings_merge', {
                patch: {
                  ...result.settings,
                  cloud_settings_server_revision: rev,
                  cloud_settings_server_updated_at: at,
                },
              });
              languageFromCloud =
                typeof result.settings.language === 'string' ? result.settings.language : undefined;
              sessionStorage.setItem('settings_last_synced_hash', `rev:${rev}`);
              shouldReload = true;
            } else {
              logger.warn(
                'layoutCloud',
                'runCloudSettingsStartupSync',
                'server_has_newer without settings payload',
              );
            }
            break;
          }
          default:
            logger.warn('layoutCloud', 'runCloudSettingsStartupSync', 'Unknown sync-init status', {
              status: (result as { status?: string }).status,
            });
        }
      }
    } catch (e) {
      logger.warn('layoutCloud', 'runCloudSettingsStartupSync', 'sync-init failed, GET fallback', {
        error: e,
      });
      const settings = await cloudSettingsService.getSettings();
      if (settings) {
        await invoke('save_settings_merge', { patch: settings });
        languageFromCloud = typeof settings.language === 'string' ? settings.language : undefined;
      }
    }

    if (shouldReload) {
      logger.info('layoutCloud', 'runCloudSettingsStartupSync', 'Applied newer cloud settings, reloading');
      scheduleReloadForCloudSettings();
      return;
    }

    await Promise.all([
      loadAccentColor(),
      loadTheme(),
      loadCurrentTheme(),
      (async () => {
        const { syncCloudPfpToLocal } = await import('./cloudPfpSyncService');
        await syncCloudPfpToLocal();
      })(),
      (async () => {
        if (languageFromCloud && languageFromCloud !== get(locale)) {
          locale.set(languageFromCloud);
        }
      })(),
      options.loadWeatherSettings(),
      options.loadEnhancedAnimationsSetting(),
      options.reloadSidebarSettings(),
    ]);
  } catch (e) {
    logger.error('layoutCloud', 'runCloudSettingsStartupSync', 'Failed', { error: e });
  }
}

/** @deprecated Prefer `runCloudSettingsStartupSync` — kept for call-site compatibility. */
export async function syncCloudSettings(options: {
  loadWeatherSettings: () => Promise<void>;
  loadEnhancedAnimationsSetting: () => Promise<void>;
  reloadSidebarSettings: () => Promise<void>;
}): Promise<void> {
  return runCloudSettingsStartupSync(options);
}

export { checkCloudSignOutAlert };
