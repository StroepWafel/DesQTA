import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

const API_URL = 'https://accounts.betterseqta.org';
const DESQTA_CLIENT_ID = 'afa43ee2-397d-4f56-ae0f-ae3f7520bc0d';
const DESQTA_REDIRECT_URI = 'desqta://auth/callback';

export interface CloudUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
  is_admin?: number | null;
}

interface CloudUserWithToken {
  user: CloudUser | null;
  token: string | null;
  refresh_token?: string | null;
}

interface DesqtaConfig {
  client_id: string;
  api_url: string;
  refresh_url: string;
  discord_auth_url: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: CloudUser;
}

interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: CloudUser;
}

export const cloudUserStore = writable<CloudUser | null>(null);

export const cloudAuthService = {
  /**
   * Fetches config from the DesQTA config endpoint (optional, for dynamic URLs).
   */
  async getConfig(): Promise<DesqtaConfig> {
    const res = await fetch(`${API_URL}/api/desqta/config?client_id=${DESQTA_CLIENT_ID}`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  /**
   * Logs in the user via email/password using the DesQTA auth endpoint.
   * Returns access_token, refresh_token, and user for persistent sessions.
   */
  async login(login: string, password: string) {
    const response = await fetch(`${API_URL}/api/desqta/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: DESQTA_CLIENT_ID,
        redirect_uri: DESQTA_REDIRECT_URI,
        login,
        password,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Login failed');
    }

    const data = (await response.json()) as LoginResponse;

    // Save tokens and user to backend (profile-specific)
    const user = await invoke<CloudUser>('save_cloud_token', {
      token: data.access_token,
      refreshToken: data.refresh_token ?? null,
      userJson: data.user ? JSON.stringify(normalizeUserForBackend(data.user)) : null,
    });

    cloudUserStore.set(user);
    return { ...data, user };
  },

  /**
   * Registers a new user.
   */
  async register(email: string, password: string, username: string, displayName: string) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, displayName }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Registration failed');
    }

    return await response.json();
  },

  /**
   * Logs out the user from the current profile.
   */
  async logout() {
    await invoke('clear_cloud_token');
    cloudUserStore.set(null);
  },

  /**
   * Gets the stored access token for the current profile.
   */
  async getToken(): Promise<string | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.token;
  },

  /**
   * Gets the stored refresh token for the current profile.
   */
  async getRefreshToken(): Promise<string | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.refresh_token ?? null;
  },

  /**
   * Gets the stored user info for the current profile.
   */
  async getUser(): Promise<CloudUser | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.user;
  },

  /**
   * Initializes the store from the current profile's cloud token.
   */
  async init(): Promise<CloudUser | null> {
    const user = await this.getUser();
    cloudUserStore.set(user);
    return user;
  },

  /**
   * Refreshes the access token using the refresh token (rolling sessions).
   * On failure, clears tokens and throws.
   */
  async refresh(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_URL}/api/desqta/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: DESQTA_CLIENT_ID,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      await this.logout();
      throw new Error((err as { error?: string }).error || 'Refresh failed');
    }

    const data = (await res.json()) as RefreshResponse;
    const user = await invoke<CloudUser>('save_cloud_token', {
      token: data.access_token,
      refreshToken: data.refresh_token ?? null,
      userJson: data.user ? JSON.stringify(normalizeUserForBackend(data.user)) : null,
    });

    cloudUserStore.set(user);
    return data.access_token;
  },

  /**
   * Fetches the latest user profile from the server and updates the current profile.
   */
  async getProfile(): Promise<CloudUser> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch profile');
    const data = await response.json();

    // Update backend (profile-specific) with latest user data
    await invoke<CloudUser>('save_cloud_token', {
      token,
      refreshToken: null,
      userJson: data ? JSON.stringify(normalizeUserForBackend(data)) : null,
    });

    cloudUserStore.set(data);
    return data;
  },

  /**
   * Initiates Discord OAuth flow for DesQTA.
   * Opens the user's browser to authenticate with Discord.
   */
  async loginWithDiscord() {
    const authUrl = new URL(`${API_URL}/api/oauth/desqta/discord`);
    authUrl.searchParams.set('client_id', DESQTA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', DESQTA_REDIRECT_URI);

    await openUrl(authUrl.toString());
  },

  /**
   * Handles the Discord OAuth callback.
   * Stores both access token and refresh_token when provided (rolling sessions).
   */
  async handleDiscordCallback(token: string, userId: string, refreshToken?: string | null) {
    const user = await this.getProfileWithToken(token);
    await invoke<CloudUser>('save_cloud_token', {
      token,
      refreshToken: refreshToken ?? null,
      userJson: user ? JSON.stringify(normalizeUserForBackend(user)) : null,
    });

    cloudUserStore.set(user);
    return user;
  },

  /**
   * Fetches user profile using a specific token (e.g. from OAuth callback).
   */
  async getProfileWithToken(token: string): Promise<CloudUser> {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  },
};

/**
 * Normalizes user object for backend (Rust expects displayName -> display_name, etc).
 */
function normalizeUserForBackend(user: CloudUser): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    pfpUrl: user.pfpUrl ?? null,
    is_admin: user.is_admin ?? null,
  };
}
