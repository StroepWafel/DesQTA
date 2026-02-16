import { cache } from '../../utils/cache';
import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
import { logger } from '../../utils/logger';
import { isOfflineMode } from './offlineMode';

export type SyncState = 'cached' | 'fresh' | 'syncing' | 'failed';

export interface DataLoaderOptions<T> {
  cacheKey: string;
  ttlMinutes?: number;
  context: string; // For logging context (e.g., 'assessments', 'courses')
  functionName: string; // For logging function name
  fetcher: () => Promise<T>;
  onDataLoaded?: (data: T) => void | Promise<void>;
  shouldSyncInBackground?: (data: T) => boolean; // Default: always sync if online
  skipCache?: boolean; // If true, bypass all caching and always fetch fresh data
  updateOnBackgroundSync?: boolean; // If true, call onDataLoaded again when background sync completes (for critical data)
  /** Optional callback for sync state changes - enables "Showing cached data" / "Syncing..." UI */
  reportSyncState?: (state: SyncState) => void;
}

/**
 * Unified data loader utility that handles:
 * 1. Memory cache check
 * 2. IndexedDB fallback
 * 3. Background sync when online
 * 4. Error handling and logging
 */
export async function useDataLoader<T>(options: DataLoaderOptions<T>): Promise<T | null> {
  const {
    cacheKey,
    ttlMinutes = 10,
    context,
    functionName,
    fetcher,
    onDataLoaded,
    shouldSyncInBackground = () => true,
    skipCache = false,
    updateOnBackgroundSync = false,
    reportSyncState,
  } = options;

  try {
    // If skipCache is true, bypass all caching and always fetch fresh
    if (skipCache) {
      logger.debug(context, functionName, `Skipping cache - fetching fresh data`, {
        key: cacheKey,
      });
      const freshData = await fetcher();
      if (onDataLoaded) {
        await onDataLoaded(freshData);
      }
      return freshData;
    }

    // Step 1: Check memory cache first
    const memCached = cache.get<T>(cacheKey);
    if (memCached) {
      logger.debug(context, functionName, `Cache hit (memory)`, { key: cacheKey });
      reportSyncState?.('cached');
      if (onDataLoaded) {
        await onDataLoaded(memCached);
      }
      // Trigger background sync if online
      await triggerBackgroundSync(
        context,
        functionName,
        cacheKey,
        fetcher,
        shouldSyncInBackground,
        memCached,
        onDataLoaded,
        updateOnBackgroundSync,
        ttlMinutes,
        reportSyncState,
      );
      return memCached;
    }

    // Step 2: Check IndexedDB if memory cache expired/missing
    const idbCached = await getWithIdbFallback<T>(cacheKey, cacheKey, () => cache.get<T>(cacheKey));
    if (idbCached) {
      logger.debug(context, functionName, `Cache hit (IndexedDB)`, { key: cacheKey });
      reportSyncState?.('cached');
      // Restore to memory cache
      cache.set(cacheKey, idbCached, ttlMinutes);
      if (onDataLoaded) {
        await onDataLoaded(idbCached);
      }
      // Trigger background sync if online
      await triggerBackgroundSync(
        context,
        functionName,
        cacheKey,
        fetcher,
        shouldSyncInBackground,
        idbCached,
        onDataLoaded,
        updateOnBackgroundSync,
        ttlMinutes,
        reportSyncState,
      );
      return idbCached;
    }

    // Step 3: No cache - fetch fresh data
    logger.debug(context, functionName, `Cache miss - fetching fresh data`, { key: cacheKey });
    const freshData = await fetcher();

    // Cache the fresh data
    cache.set(cacheKey, freshData, ttlMinutes);
    await setIdb(cacheKey, freshData);
    logger.debug(context, functionName, `Data cached (mem+idb)`, { key: cacheKey });
    reportSyncState?.('fresh');

    if (onDataLoaded) {
      await onDataLoaded(freshData);
    }

    return freshData;
  } catch (e) {
    logger.error(context, functionName, `Failed to load data: ${e}`, { key: cacheKey, error: e });
    reportSyncState?.('failed');
    return null;
  }
}

async function triggerBackgroundSync<T>(
  context: string,
  functionName: string,
  cacheKey: string,
  fetcher: () => Promise<T>,
  shouldSync: (data: T) => boolean,
  cachedData: T,
  onDataLoaded?: (data: T) => void | Promise<void>,
  updateOnBackgroundSync = false,
  ttlMinutes = 10,
  reportSyncState?: (state: SyncState) => void,
): Promise<void> {
  const offline = await isOfflineMode();
  if (offline) {
    logger.debug(context, functionName, 'Skipping background sync - offline', { key: cacheKey });
    return;
  }

  if (!shouldSync(cachedData)) {
    logger.debug(context, functionName, 'Skipping background sync - shouldSync returned false', {
      key: cacheKey,
    });
    return;
  }

  logger.debug(context, functionName, 'Starting background sync', { key: cacheKey });
  reportSyncState?.('syncing');

  // Sync in background without blocking
  fetcher()
    .then(async (freshData) => {
      cache.set(cacheKey, freshData, ttlMinutes);
      await setIdb(cacheKey, freshData).catch((e) => {
        logger.debug(context, functionName, 'Failed to update IndexedDB in background sync', {
          error: e,
        });
      });
      logger.debug(context, functionName, 'Background sync completed', { key: cacheKey });
      reportSyncState?.('fresh');

      // If updateOnBackgroundSync is true, call onDataLoaded again with fresh data
      if (updateOnBackgroundSync && onDataLoaded) {
        try {
          await onDataLoaded(freshData);
          logger.debug(context, functionName, 'UI updated with fresh data from background sync', {
            key: cacheKey,
          });
        } catch (e) {
          logger.error(context, functionName, 'Failed to update UI after background sync', {
            key: cacheKey,
            error: e,
          });
        }
      }
    })
    .catch((e) => {
      logger.debug(context, functionName, 'Background sync failed silently', {
        key: cacheKey,
        error: e,
      });
      reportSyncState?.('cached');
    });
}
