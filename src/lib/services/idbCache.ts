import { idbCacheGet, idbCacheSet } from './idb';
import { logger } from '../../utils/logger';

// SQLite-backed cache wrapper (replaces IndexedDB)
export async function getWithIdbFallback<T>(memKey: string, idbKey: string, memGet: () => T | null): Promise<T | null> {
  const mem = memGet();
  if (mem) return mem;
  const idb = await idbCacheGet<T>(idbKey);
  logger.info('idbCache', 'getWithIdbFallback', 'SQLite fallback read', { memKey, idbKey, hit: !!idb });
  return idb ?? null;
}

export async function setIdb<T>(idbKey: string, value: T): Promise<void> {
  try {
    // Ensure plain JSON-serializable data (avoid Svelte proxies/DataCloneError)
    const plain = JSON.parse(JSON.stringify(value));
    await idbCacheSet(idbKey, plain);
    logger.info('idbCache', 'setIdb', 'SQLite write', { idbKey, size: JSON.stringify(plain)?.length });
  } catch (e) {
    logger.warn('idbCache', 'setIdb', 'SQLite write failed', { idbKey, error: String(e) });
  }
}


