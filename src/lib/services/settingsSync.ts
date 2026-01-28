import { invoke } from '@tauri-apps/api/core';
import { queueAdd, queueAll, queueDelete } from './idb';
import { cloudAuthService } from './cloudAuthService';
import { cloudSettingsService } from './cloudSettingsService';

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
          'seqta_platform',
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

// Optional: flush on regain connectivity
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSettingsQueue().catch(() => {});
  });
}


