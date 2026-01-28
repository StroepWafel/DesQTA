import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

/**
 * Service to get cached forum photos for directory display
 */
export const forumPhotoService = {
  /**
   * Get photo data URL for a UUID
   */
  async getPhotoDataUrl(uuid: string | null | undefined): Promise<string | null> {
    if (!uuid || !uuid.trim()) return null;

    try {
      const dataUrl = await invoke<string | null>('get_forum_photo_data_url', {
        uuid: uuid.trim(),
      });
      return dataUrl;
    } catch (e) {
      logger.debug('forumPhotoService', 'getPhotoDataUrl', `Failed to get photo for UUID ${uuid}: ${e}`, {
        error: e,
        uuid,
      });
      return null;
    }
  },

  /**
   * Get photo file path for a UUID
   */
  async getPhotoPath(uuid: string | null | undefined): Promise<string | null> {
    if (!uuid || !uuid.trim()) return null;

    try {
      const path = await invoke<string | null>('get_forum_photo_path', {
        uuid: uuid.trim(),
      });
      return path;
    } catch (e) {
      logger.debug('forumPhotoService', 'getPhotoPath', `Failed to get photo path for UUID ${uuid}: ${e}`, {
        error: e,
        uuid,
      });
      return null;
    }
  },
};
