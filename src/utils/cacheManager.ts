/**
 * Cache Management Utility
 * Provides functions to clear browser caches that might cause routing issues
 */

import { invoke } from '@tauri-apps/api/core';

export class CacheManager {
  /**
   * Clear all browser caches including service worker cache
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // Clear all cache storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
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
   * Clear only the service worker cache
   */
  static async clearServiceWorkerCache(): Promise<void> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const swCaches = cacheNames.filter(name => name.includes('desqta-static'));
        await Promise.all(
          swCaches.map(cacheName => caches.delete(cacheName))
        );
        console.log('Cleared service worker caches:', swCaches);
      }
    } catch (error) {
      console.error('Failed to clear service worker cache:', error);
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
    
    // Unregister service worker to force re-registration
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => registration.unregister())
      );
      console.log('Unregistered all service workers');
    }

    // Force hard refresh
    window.location.reload();
  }

  /**
   * Check if caches might be causing issues
   */
  static async diagnoseCache(): Promise<{
    hasCaches: boolean;
    cacheNames: string[];
    hasServiceWorker: boolean;
    recommendations: string[];
  }> {
    const diagnosis = {
      hasCaches: false,
      cacheNames: [] as string[],
      hasServiceWorker: false,
      recommendations: [] as string[]
    };

    try {
      // Check cache storage
      if ('caches' in window) {
        diagnosis.cacheNames = await caches.keys();
        diagnosis.hasCaches = diagnosis.cacheNames.length > 0;
      }

      // Check service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        diagnosis.hasServiceWorker = registrations.length > 0;
      }

      // Generate recommendations
      if (diagnosis.hasCaches) {
        diagnosis.recommendations.push('Clear browser cache to resolve potential routing issues');
      }
      if (diagnosis.hasServiceWorker) {
        diagnosis.recommendations.push('Service worker detected - may be caching stale content');
      }
      if (diagnosis.cacheNames.some(name => name.includes('desqta-static-v1'))) {
        diagnosis.recommendations.push('Old service worker cache detected - clear cache to update');
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
