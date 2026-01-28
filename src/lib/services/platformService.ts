import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

export type SEQTAPlatform = 'learn' | 'teach' | 'unknown';

/**
 * Platform detection and management service for SEQTA Learn vs Teach
 */
export const platformService = {
  /**
   * Get the current platform mode (learn or teach)
   * Defaults to 'learn' if not set
   */
  async getPlatform(): Promise<SEQTAPlatform> {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['seqta_platform'],
      });
      const platform = subset?.seqta_platform as SEQTAPlatform | undefined;
      
      // Default to 'learn' if not set
      if (platform === 'teach' || platform === 'learn') {
        return platform;
      }
      
      return 'learn';
    } catch (error) {
      logger.error('platformService', 'getPlatform', `Failed to get platform: ${error}`, { error });
      return 'learn'; // Default to learn on error
    }
  },

  /**
   * Set the current platform mode
   */
  async setPlatform(platform: SEQTAPlatform): Promise<void> {
    try {
      if (platform !== 'learn' && platform !== 'teach' && platform !== 'unknown') {
        logger.warn('platformService', 'setPlatform', `Invalid platform: ${platform}`);
        return;
      }

      const { saveSettingsWithQueue } = await import('./settingsSync');
      await saveSettingsWithQueue({ seqta_platform: platform });
      logger.info('platformService', 'setPlatform', `Platform set to: ${platform}`, { platform });
    } catch (error) {
      logger.error('platformService', 'setPlatform', `Failed to set platform: ${error}`, { error });
      throw error;
    }
  },

  /**
   * Check if currently in Teach mode
   */
  async isTeachMode(): Promise<boolean> {
    const platform = await this.getPlatform();
    return platform === 'teach';
  },

  /**
   * Check if currently in Learn mode
   */
  async isLearnMode(): Promise<boolean> {
    const platform = await this.getPlatform();
    return platform === 'learn';
  },

  /**
   * Get the API endpoint prefix based on current platform
   * Returns '/seqta/ta/' for Teach, '/seqta/student/' for Learn
   */
  async getApiPrefix(): Promise<string> {
    const platform = await this.getPlatform();
    if (platform === 'teach') {
      // Teach uses /seqta/ta/ endpoint prefix
      return '/seqta/ta/';
    }
    return '/seqta/student/';
  },
};
