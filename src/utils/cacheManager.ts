/**
 * Cache Management Utility
 * Provides functions to clear browser caches that might cause routing issues
 */

import { invoke } from '@tauri-apps/api/core';

export class CacheManager {
  /**
   * Clear all browser caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // Clear all cache storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        console.log('Cleared all cache storage');
      }

      // Clear localStorage
      if ('localStorage' in window) {
        localStorage.clear();
        console.log('Cleared localStorage');
      }

      // Clear sessionStorage
      if ('sessionStorage' in window) {
        sessionStorage.clear();
        console.log('Cleared sessionStorage');
      }

      // Clear SQLite cache (via Rust backend)
      await this.clearIndexedDBCaches();
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }

  /**
   * Clear SQLite cache (replaces IndexedDB cache clearing)
   */
  static async clearIndexedDBCaches(): Promise<void> {
    try {
      // Clear SQLite cache via Rust backend
      await invoke('db_cache_clear');
      console.log('Cleared SQLite cache');

      // Also cleanup expired entries
      await invoke('db_cache_cleanup_expired');
    } catch (error) {
      console.error('Failed to clear SQLite cache:', error);
    }
  }

  /**
   * Force refresh the current page after clearing caches
   */
  static async clearCachesAndRefresh(): Promise<void> {
    await this.clearAllCaches();

    // Force hard refresh
    window.location.reload();
  }

  /**
   * Check if caches might be causing issues
   */
  static async diagnoseCache(): Promise<{
    hasCaches: boolean;
    cacheNames: string[];
    recommendations: string[];
  }> {
    const diagnosis = {
      hasCaches: false,
      cacheNames: [] as string[],
      recommendations: [] as string[],
    };

    try {
      // Check cache storage
      if ('caches' in window) {
        diagnosis.cacheNames = await caches.keys();
        diagnosis.hasCaches = diagnosis.cacheNames.length > 0;
      }

      // Generate recommendations
      if (diagnosis.hasCaches) {
        diagnosis.recommendations.push('Clear browser cache to resolve potential routing issues');
      }
    } catch (error) {
      console.error('Failed to diagnose cache:', error);
    }

    return diagnosis;
  }
}

// Expose globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).cacheManager = CacheManager;
}
