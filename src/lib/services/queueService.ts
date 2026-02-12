/**
 * Unified Queue Service
 *
 * Single source for sync queue operations and the sole handler for online events.
 * Replaces duplicate listeners in syncService and settingsSync.
 */

import { queueAll } from './idb';
import { flushAll } from './syncService';
import { connectivity, setQueuedCount, setSyncing, updateConnectivity } from '$lib/stores/connectivity';

export interface QueueSummary {
  messageDrafts: number;
  settingsPatches: number;
  total: number;
}

export async function getQueueSummary(): Promise<QueueSummary> {
  const items = await queueAll();
  const messageDrafts = items.filter((i) => i.type === 'message_draft').length;
  const settingsPatches = items.filter((i) => i.type === 'settings_patch').length;
  return {
    messageDrafts,
    settingsPatches,
    total: messageDrafts + settingsPatches,
  };
}

export async function flushQueue(): Promise<void> {
  setSyncing(true);
  try {
    await flushAll();
    const summary = await getQueueSummary();
    setQueuedCount(summary.total);
  } finally {
    setSyncing(false);
  }
}

function notifyQueueUpdate(): void {
  getQueueSummary().then((s) => setQueuedCount(s.total));
}

let queueServiceInitialized = false;

/**
 * Initialize queue service - register online handler and queue-changed listener.
 * Call once from layout.
 */
export function initQueueService(): void {
  if (typeof window === 'undefined') return;
  if (queueServiceInitialized) return;
  queueServiceInitialized = true;

  window.addEventListener('online', () => {
    flushQueue().catch(() => {
      // Flush failed (e.g. still offline) - updateConnectivity will run via setSyncing(false)
    });
  });

  window.addEventListener('queue-changed', () => {
    notifyQueueUpdate();
  });
}
