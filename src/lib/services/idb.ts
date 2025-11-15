// SQLite backend via Tauri commands (replaces IndexedDB)

import { invoke } from '@tauri-apps/api/core';

const STORE_CACHE = 'cache';
const STORE_QUEUE = 'syncQueue';

export type QueueItem = {
  id?: number;
  type: 'settings_patch' | 'message_draft' | 'note_draft';
  payload: any;
  created_at: number;
};

export async function idbCacheSet(
  key: string,
  value: any,
  ttlMinutes?: number | null,
): Promise<void> {
  try {
    await invoke('db_cache_set', { key, value, ttlMinutes: ttlMinutes ?? null });
  } catch (error) {
    console.error('Failed to set cache:', error);
    throw error;
  }
}

export async function idbCacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const result = await invoke<any>('db_cache_get', { key });
    return result as T | undefined;
  } catch (error) {
    console.error('Failed to get cache:', error);
    return undefined;
  }
}

export async function idbCacheDelete(key: string): Promise<void> {
  try {
    await invoke('db_cache_delete', { key });
  } catch (error) {
    console.error('Failed to delete cache:', error);
    throw error;
  }
}

export async function queueAdd(item: Omit<QueueItem, 'id' | 'created_at'>): Promise<number> {
  try {
    const id = await invoke<number>('db_queue_add', {
      itemType: item.type,
      payload: item.payload,
    });
    return id;
  } catch (error) {
    console.error('Failed to add queue item:', error);
    throw error;
  }
}

export async function queueAll(): Promise<QueueItem[]> {
  try {
    const items = await invoke<QueueItem[]>('db_queue_all');
    return items || [];
  } catch (error) {
    console.error('Failed to get queue items:', error);
    return [];
  }
}

export async function queueDelete(id: number): Promise<void> {
  try {
    await invoke('db_queue_delete', { id });
  } catch (error) {
    console.error('Failed to delete queue item:', error);
    throw error;
  }
}
