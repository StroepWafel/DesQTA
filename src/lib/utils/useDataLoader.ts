import { cache } from '../../utils/cache';
import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
import { logger } from '../../utils/logger';
import { isOfflineMode } from './offlineMode';

export interface DataLoaderOptions<T> {
  cacheKey: string;
  ttlMinutes?: number;
  context: string; // For logging context (e.g., 'assessments', 'courses')
  functionName: string; // For logging function name
  fetcher: () => Promise<T>;
  onDataLoaded?: (data: T) => void | Promise<void>;
  shouldSyncInBackground?: (data: T) => boolean; // Default: always sync if online
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
  } = options;

  try {
    // Step 1: Check memory cache first
    const memCached = cache.get<T>(cacheKey);
    if (memCached) {
      logger.debug(context, functionName, `Cache hit (memory)`, { key: cacheKey });
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
      );
      return memCached;
    }

    // Step 2: Check IndexedDB if memory cache expired/missing
    const idbCached = await getWithIdbFallback<T>(cacheKey, cacheKey, () => cache.get<T>(cacheKey));
    if (idbCached) {
      logger.debug(context, functionName, `Cache hit (IndexedDB)`, { key: cacheKey });
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

    if (onDataLoaded) {
      await onDataLoaded(freshData);
    }

    return freshData;
  } catch (e) {
    logger.error(context, functionName, `Failed to load data: ${e}`, { key: cacheKey, error: e });
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
): Promise<void> {
  const offline = await isOfflineMode();
  if (offline || !shouldSync(cachedData)) {
    return;
  }

  // Sync in background without blocking
  fetcher()
    .then((freshData) => {
      cache.set(cacheKey, freshData, 10); // Use default TTL for background sync
      setIdb(cacheKey, freshData).catch((e) => {
        logger.debug(context, functionName, 'Failed to update IndexedDB in background sync', {
          error: e,
        });
      });
      logger.debug(context, functionName, 'Background sync completed', { key: cacheKey });
    })
    .catch((e) => {
      logger.debug(context, functionName, 'Background sync failed silently', {
        key: cacheKey,
        error: e,
      });
    });
}
