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

  /**
   * Get UUID by name (for directory matching)
   */
  async getUUIDByName(name: string | null | undefined): Promise<string | null> {
    if (!name || !name.trim()) return null;

    try {
      const uuid = await invoke<string | null>('get_forum_photo_uuid_by_name', {
        name: name.trim(),
      });
      return uuid;
    } catch (e) {
      logger.debug('forumPhotoService', 'getUUIDByName', `Failed to get UUID for name ${name}: ${e}`, {
        error: e,
        name,
      });
      return null;
    }
  },
};
