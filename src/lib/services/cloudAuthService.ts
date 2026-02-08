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
}

export const cloudUserStore = writable<CloudUser | null>(null);

export const cloudAuthService = {
  /**
   * Logs in the user and saves the session token to the current profile.
   */
  async login(login: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }

    const data = await response.json();

    // Save token to backend (profile-specific)
    const user = await invoke<CloudUser>('save_cloud_token', { token: data.token });
    
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
      throw new Error(err.error || 'Registration failed');
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
   * Gets the stored JWT token for the current profile.
   */
  async getToken(): Promise<string | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.token;
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
    await invoke<CloudUser>('save_cloud_token', { token });
    
    cloudUserStore.set(data);

    return data;
  },

  /**
   * Initiates Discord OAuth flow for DesQTA.
   * Opens the user's browser to authenticate with Discord.
   */
  async loginWithDiscord() {
    // Construct the Discord OAuth URL
    const authUrl = new URL(`${API_URL}/api/oauth/desqta/discord`);
    authUrl.searchParams.set('client_id', DESQTA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', DESQTA_REDIRECT_URI);

    // Open browser for Discord authentication
    await openUrl(authUrl.toString());
    
    // The user will be redirected back to desqta://auth/callback with token and user_id
    // Handle the callback in the deep link handler (see lib.rs)
  },

  /**
   * Handles the Discord OAuth callback.
   * Call this when your app receives the callback with token and user_id.
   */
  async handleDiscordCallback(token: string, userId: string) {
    // Save token to backend (profile-specific)
    // This will also fetch and save the user profile
    const user = await invoke<CloudUser>('save_cloud_token', { token });
    
    cloudUserStore.set(user);

    return user;
  },
};
