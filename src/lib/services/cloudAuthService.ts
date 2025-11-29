import { writable } from 'svelte/store';

const API_URL = 'https://accounts.betterseqta.org';

export interface CloudUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
}

export const cloudUserStore = writable<CloudUser | null>(null);

export const cloudAuthService = {
  /**
   * Logs in the user and saves the session token.
   */
  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }

    const data = await response.json();

    // Save token securely.
    localStorage.setItem('bs_token', data.token);
    localStorage.setItem('bs_user', JSON.stringify(data.user));

    cloudUserStore.set(data.user);

    return data;
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
   * Logs out the user.
   */
  logout() {
    localStorage.removeItem('bs_token');
    localStorage.removeItem('bs_user');
    cloudUserStore.set(null);
  },

  /**
   * Gets the stored JWT token.
   */
  getToken() {
    return localStorage.getItem('bs_token');
  },

  /**
   * Gets the stored user info.
   */
  getUser() {
    const user = localStorage.getItem('bs_user');
    try {
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  /**
   * Initializes the store from local storage
   */
  init() {
    const user = this.getUser();
    cloudUserStore.set(user);
    return user;
  },

  /**
   * Fetches the latest user profile from the server.
   */
  async getProfile() {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch profile');
    const data = await response.json();

    // Update local storage and store
    localStorage.setItem('bs_user', JSON.stringify(data));
    cloudUserStore.set(data);

    return data;
  },
};
