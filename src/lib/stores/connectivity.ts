/**
 * Central Connectivity Store
 *
 * Provides a single source of truth for network/SEQTA connectivity state.
 * States: online | offline | syncing | degraded | queued
 */

import { writable, get } from 'svelte/store';
import { isOfflineMode, invalidateOfflineModeCache } from '$lib/utils/offlineMode';
import { seqtaFetch } from '../../utils/netUtil';
import { logger } from '../../utils/logger';

export type ConnectivityStatus =
  | 'online'
  | 'offline'
  | 'syncing'
  | 'degraded'
  | 'queued';

export interface ConnectivityState {
  status: ConnectivityStatus;
  queuedCount: number;
  lastHeartbeat: number | null;
  /** True when navigator.onLine is false or dev_force_offline_mode */
  isOffline: boolean;
}

const initialState: ConnectivityState = {
  status: 'online',
  queuedCount: 0,
  lastHeartbeat: null,
  isOffline: false,
};

export const connectivity = writable<ConnectivityState>(initialState);

const HEARTBEAT_INTERVAL_MS = 60_000; // 60s
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

/**
 * Check if SEQTA API is reachable via heartbeat endpoint
 */
export async function checkSeqtaConnectivity(): Promise<boolean> {
  try {
    await seqtaFetch('/seqta/student/heartbeat', {
      method: 'POST',
      body: { heartbeat: true },
    });
    return true;
  } catch (e) {
    logger.debug('connectivity', 'checkSeqtaConnectivity', 'SEQTA heartbeat failed', {
      error: e,
    });
    return false;
  }
}

/**
 * Update connectivity state based on current conditions
 */
export async function updateConnectivity(options?: {
  queuedCount?: number;
  setSyncing?: boolean;
  setOnline?: boolean;
}): Promise<void> {
  const offline = await isOfflineMode();
  const current = get(connectivity);
  const queuedCount = options?.queuedCount ?? current.queuedCount;

  if (options?.setSyncing) {
    connectivity.update((s) => ({ ...s, status: 'syncing' }));
    return;
  }

  if (options?.setOnline) {
    const seqtaOk = await checkSeqtaConnectivity();
    connectivity.update((s) => ({
      ...s,
      status: queuedCount > 0 ? 'queued' : seqtaOk ? 'online' : 'degraded',
      isOffline: false,
      queuedCount,
      lastHeartbeat: seqtaOk ? Date.now() : s.lastHeartbeat,
    }));
    return;
  }

  if (offline) {
    connectivity.update((s) => ({
      ...s,
      status: queuedCount > 0 ? 'queued' : 'offline',
      isOffline: true,
      queuedCount,
    }));
    return;
  }

  if (queuedCount > 0) {
    connectivity.update((s) => ({
      ...s,
      status: 'queued',
      queuedCount,
      isOffline: false,
    }));
    return;
  }

  // Online with no queue - check SEQTA
  const seqtaOk = await checkSeqtaConnectivity();
  connectivity.update((s) => ({
    ...s,
    status: seqtaOk ? 'online' : 'degraded',
    queuedCount,
    isOffline: false,
    lastHeartbeat: seqtaOk ? Date.now() : s.lastHeartbeat,
  }));
}

/**
 * Set queued count (called by queueService)
 */
export function setQueuedCount(count: number): void {
  connectivity.update((s) => {
    const newStatus =
      count > 0
        ? 'queued'
        : s.isOffline
          ? 'offline'
          : s.status === 'syncing'
            ? 'syncing'
            : 'online';
    return {
      ...s,
      queuedCount: count,
      status: newStatus,
    };
  });
}

/**
 * Set syncing state (when flushAll is in progress)
 */
export function setSyncing(syncing: boolean): void {
  if (!syncing) {
    updateConnectivity();
    return;
  }
  connectivity.update((s) => ({ ...s, status: 'syncing' }));
}

/**
 * Start periodic heartbeat when online
 */
function startHeartbeat(): void {
  if (heartbeatIntervalId) return;
  heartbeatIntervalId = setInterval(() => {
    const current = get(connectivity);
    if (current.isOffline || current.status === 'offline') return;
    checkSeqtaConnectivity().then((ok) => {
      if (!ok) {
        connectivity.update((s) => ({ ...s, status: 'degraded' }));
      } else {
        connectivity.update((s) => ({
          ...s,
          status: s.queuedCount > 0 ? 'queued' : 'online',
          lastHeartbeat: Date.now(),
        }));
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop periodic heartbeat
 */
function stopHeartbeat(): void {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

/**
 * Handle online event - run heartbeat and update state
 */
async function handleOnline(): Promise<void> {
  const offline = await isOfflineMode();
  if (offline) return; // dev_force_offline_mode overrides
  startHeartbeat();
  await updateConnectivity();
}

/**
 * Handle offline event
 */
async function handleOffline(): Promise<void> {
  stopHeartbeat();
  const current = get(connectivity);
  connectivity.update((s) => ({
    ...s,
    status: s.queuedCount > 0 ? 'queued' : 'offline',
    isOffline: true,
  }));
}

/**
 * Initialize connectivity store - call once from layout
 */
export function initConnectivity(getQueueCount: () => Promise<number>): void {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  isInitialized = true;

  const setup = async () => {
    const offline = await isOfflineMode();
    const count = await getQueueCount();
    connectivity.update((s) => ({
      ...s,
      isOffline: offline,
      queuedCount: count,
      status: offline
        ? count > 0
          ? 'queued'
          : 'offline'
        : count > 0
          ? 'queued'
          : 'online',
    }));

    if (!offline) {
      const seqtaOk = await checkSeqtaConnectivity();
      connectivity.update((s) => ({
        ...s,
        status:
          count > 0 ? 'queued' : seqtaOk ? 'online' : 'degraded',
        lastHeartbeat: seqtaOk ? Date.now() : null,
      }));
      startHeartbeat();
    }
  };

  window.addEventListener('online', () => {
    handleOnline();
  });

  window.addEventListener('offline', () => {
    handleOffline();
  });

  setup();
}

/**
 * Invalidate and re-check - call when dev_force_offline_mode changes
 */
export async function invalidateConnectivity(): Promise<void> {
  invalidateOfflineModeCache();
  await updateConnectivity();
}
