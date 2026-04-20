import { invoke } from '@tauri-apps/api/core';
import { cloudAuthService } from './cloudAuthService';
import { logger } from '../../utils/logger';

const CLOUD_BASE = 'https://accounts.betterseqta.org';

function getFullPfpUrl(pfpUrl: string | null | undefined): string | null {
  if (!pfpUrl) return null;
  if (pfpUrl.startsWith('http://') || pfpUrl.startsWith('https://')) {
    return pfpUrl;
  }
  if (pfpUrl.startsWith('/pfp/') || pfpUrl.startsWith('/api/files/public/')) {
    return `${CLOUD_BASE}${pfpUrl}`;
  }
  return pfpUrl;
}

/**
 * Syncs cloud profile picture to local if:
 * - sync_cloud_pfp is enabled
 * - cloud user has pfpUrl
 * - pfpUrl differs from last_synced_cloud_pfp_url (or never synced)
 */
export async function syncCloudPfpToLocal(): Promise<void> {
  try {
    const [cloudUser, settings] = await Promise.all([
      cloudAuthService.getUser(),
      invoke<{ sync_cloud_pfp?: boolean; last_synced_cloud_pfp_url?: string }>('get_settings_subset', {
        keys: ['sync_cloud_pfp', 'last_synced_cloud_pfp_url'],
      }),
    ]);

    if (!cloudUser?.pfpUrl || !settings?.sync_cloud_pfp) return;

    const fullUrl = getFullPfpUrl(cloudUser.pfpUrl);
    if (!fullUrl) return;

    const lastSynced = settings.last_synced_cloud_pfp_url ?? '';
    if (lastSynced === cloudUser.pfpUrl) {
      logger.debug('cloudPfpSync', 'syncCloudPfpToLocal', 'Cloud PFP unchanged, skipping');
      return;
    }

    const path = await invoke<string>('save_profile_picture_from_url', { url: fullUrl });
    logger.info('cloudPfpSync', 'syncCloudPfpToLocal', 'Synced cloud PFP to local', { path });

    await invoke('save_settings_merge', {
      patch: { last_synced_cloud_pfp_url: cloudUser.pfpUrl },
    });

    window.dispatchEvent(new CustomEvent('profile-picture-updated'));
  } catch (e) {
    logger.debug('cloudPfpSync', 'syncCloudPfpToLocal', 'Failed to sync cloud PFP (non-critical)', {
      error: e,
    });
  }
}
