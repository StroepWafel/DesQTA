import { cloudAuthService } from './cloudAuthService';

const API_URL = 'https://accounts.betterseqta.org';

/**
 * Performs an authenticated API request with 401 retry.
 * When the access token is expired (401), refreshes and retries once.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { body?: string } = {},
): Promise<T> {
  let token = await cloudAuthService.getToken();
  const user = await cloudAuthService.getUser();

  if (!token || !user) return null as T;

  const doRequest = (t: string) =>
    fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${t}`,
        'X-User-ID': user.id,
      },
    });

  let response = await doRequest(token);

  if (response.status === 401) {
    try {
      token = await cloudAuthService.refresh();
      response = await doRequest(token);
    } catch {
      throw new Error('Session expired');
    }
  }

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response as unknown as T;
}

export const cloudSettingsService = {
  /**
   * Fetches the user's settings from the cloud.
   */
  async getSettings() {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();

    if (!token || !user) return null;

    try {
      const data = await apiRequest<Record<string, unknown>>('/api/settings', {
        method: 'GET',
      });
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
  async syncSettings(settings: Record<string, unknown>) {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();
    if (!token || !user) return;

    try {
      const savedData = await apiRequest<unknown>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      console.log('Settings synced successfully');
      return savedData;
    } catch (e) {
      console.error('Sync failed:', e);
      throw e;
    }
  },
};
