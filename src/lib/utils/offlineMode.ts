/**
 * Offline Mode Utility
 * 
 * Provides utilities for checking offline mode status, including dev setting override
 */

import { invoke } from '@tauri-apps/api/core';

// Cache the dev_force_offline_mode flag to avoid spamming settings on every request
let devOfflineModeCache: { value: boolean; timestamp: number } | null = null;
let devOfflineModeInFlight: Promise<boolean> | null = null;
const DEV_OFFLINE_MODE_TTL_MS = 60_000; // 60s TTL

/**
 * Check if offline mode is forced via dev setting
 */
async function getDevForceOfflineMode(): Promise<boolean> {
  const now = Date.now();
  if (devOfflineModeCache && now - devOfflineModeCache.timestamp < DEV_OFFLINE_MODE_TTL_MS) {
    return devOfflineModeCache.value;
  }
  if (devOfflineModeInFlight) {
    return devOfflineModeInFlight;
  }
  devOfflineModeInFlight = (async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['dev_force_offline_mode'] });
      const value = subset?.dev_force_offline_mode ?? false;
      devOfflineModeCache = { value, timestamp: Date.now() };
      return value;
    } catch {
      devOfflineModeCache = { value: false, timestamp: Date.now() };
      return false;
    } finally {
      devOfflineModeInFlight = null;
    }
  })();
  return devOfflineModeInFlight;
}

/**
 * Check if the app should operate in offline mode
 * Returns true if:
 * - Dev setting forces offline mode, OR
 * - Browser reports offline
 */
export async function isOfflineMode(): Promise<boolean> {
  const devForceOffline = await getDevForceOfflineMode();
  if (devForceOffline) {
    return true;
  }
  return !navigator.onLine;
}

/**
 * Invalidate the offline mode cache (call when setting changes)
 */
export function invalidateOfflineModeCache(): void {
  devOfflineModeCache = null;
}

/**
 * Synchronous check for offline mode (uses cached value)
 * Use this for immediate checks, but prefer isOfflineMode() for accuracy
 */
export function isOfflineModeSync(): boolean {
  // If cache exists and is recent, use it
  if (devOfflineModeCache) {
    const now = Date.now();
    if (now - devOfflineModeCache.timestamp < DEV_OFFLINE_MODE_TTL_MS) {
      if (devOfflineModeCache.value) {
        return true;
      }
    }
  }
  // Otherwise check browser online status
  return !navigator.onLine;
}

