import { cloudAuthService } from './cloudAuthService';

const API_URL = 'https://accounts.betterseqta.org';

export const cloudSettingsService = {
  /**
   * Fetches the user's settings from the cloud.
   */
  async getSettings() {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();

    // Return null or throw if not logged in
    if (!token || !user) return null;

    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-User-ID': user.id, // Redundant if Worker checks token, but good for fallback
        },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const data = await response.json();
      return data;
    } catch (e) {
      console.error('Error fetching settings:', e);
      return null;
    }
  },

  /**
   * Syncs (merges) local settings to the cloud.
   * @param settings The settings object to save.
   */
  async syncSettings(settings: Record<string, any>) {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();
    if (!token || !user) return;

    try {
      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-User-ID': user.id,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      const savedData = await response.json();
      console.log('Settings synced successfully');
      return savedData;
    } catch (e) {
      console.error('Sync failed:', e);
      throw e;
    }
  },
};
