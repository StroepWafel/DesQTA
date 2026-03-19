import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

/**
 * If the profile has no cloud user but was previously signed into BetterSEQTA Plus,
 * show a toast so the user knows to sign in again (e.g. expired refresh token).
 * Uses `invoke` only so `cloudAuthService` can call this without circular imports.
 */
export async function checkCloudSignOutAlert(): Promise<void> {
  try {
    const row = await invoke<{ user: { id: string } | null }>('get_cloud_user');
    if (row?.user) return;

    const state = await invoke<{ previously_signed_into_cloud: boolean }>('get_cloud_state');
    if (!state?.previously_signed_into_cloud) return;

    const { toastStore } = await import('$lib/stores/toast');
    toastStore.warning(
      'You have been signed out of BetterSEQTA Plus. Sign in again in Settings to sync your data.',
    );
    await invoke('set_cloud_state_previously_signed', { value: false });
  } catch (e) {
    logger.debug('cloudSignOutAlert', 'checkCloudSignOutAlert', 'Check failed (non-critical)', {
      error: e,
    });
  }
}
