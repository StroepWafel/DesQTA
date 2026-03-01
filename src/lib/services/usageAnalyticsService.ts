import { invoke } from '@tauri-apps/api/core';
import { cloudAuthService } from './cloudAuthService';
import { logger } from '../../utils/logger';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface UsageAnalyticsState {
  tracking_date: string;
  sessions_count: number;
  last_sent_date: string | null;
  pending_date?: string | null;
  pending_sessions?: number;
}

async function getPlatform(): Promise<string> {
  const platform = (import.meta as any).env?.TAURI_ENV_PLATFORM as string | undefined;
  if (platform && ['windows', 'macos', 'linux', 'android', 'ios'].includes(platform)) {
    return platform;
  }
  try {
    const info = await invoke<{ platform: string }>('get_system_info');
    const p = (info?.platform ?? '').toLowerCase();
    if (['windows', 'macos', 'linux', 'android', 'ios'].includes(p)) return p;
  } catch {
    // ignore
  }
  return 'unknown';
}

async function getAppVersion(): Promise<string> {
  try {
    return await invoke<string>('get_app_version');
  } catch {
    return '0.0.0';
  }
}

async function getClientId(): Promise<string | null> {
  try {
    const stored = await invoke<{ client_id: string } | null>('get_reserved_client');
    return stored?.client_id ?? null;
  } catch {
    return null;
  }
}

async function sendUsageReport(payload: {
  date: string;
  sessions_count: number;
  cloud_signed_in: boolean;
  app_version: string;
  platform: string;
  client_id?: string | null;
}): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      date: payload.date,
      sessions_count: payload.sessions_count,
      cloud_signed_in: payload.cloud_signed_in,
      app_version: payload.app_version,
      platform: payload.platform,
    };
    if (payload.client_id) {
      body.client_id = payload.client_id;
    }
    return await invoke<boolean>('send_usage_analytics_report', { payload: body });
  } catch (e) {
    logger.debug('usageAnalytics', 'sendUsageReport', 'Request failed', { error: e });
    return false;
  }
}

async function runCheck(): Promise<void> {
  try {
    const settings = await invoke<{ send_anonymous_usage_statistics?: boolean }>('get_settings_subset', {
      keys: ['send_anonymous_usage_statistics'],
    });
    if (!settings?.send_anonymous_usage_statistics) return;

    const state = await invoke<UsageAnalyticsState>('get_usage_analytics_state');
    const today = new Date().toISOString().slice(0, 10);

    // Send pending data from previous day (set by increment when we crossed into new day)
    const dateToSend = state.pending_date ?? (state.tracking_date !== today ? state.tracking_date : null);
    const sessionsToSend = state.pending_date ? (state.pending_sessions ?? 0) : state.sessions_count;

    if (dateToSend && sessionsToSend > 0) {
      const alreadySent = state.last_sent_date === dateToSend;
      if (!alreadySent) {
        const cloudUser = await cloudAuthService.getUser();
        const success = await sendUsageReport({
          date: dateToSend,
          sessions_count: sessionsToSend,
          cloud_signed_in: !!cloudUser,
          app_version: await getAppVersion(),
          platform: await getPlatform(),
          client_id: await getClientId(),
        });
        if (success) {
          await invoke('mark_usage_analytics_sent_and_reset', { date: dateToSend });
          logger.info('usageAnalytics', 'runCheck', 'Usage report sent', { date: dateToSend });
        }
      } else if (state.pending_date) {
        await invoke('mark_usage_analytics_sent_and_reset', { date: dateToSend });
      }
    }
  } catch (e) {
    logger.debug('usageAnalytics', 'runCheck', 'Check failed (non-critical)', { error: e });
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export const usageAnalyticsService = {
  /**
   * Call on app start: increments session count for today.
   */
  async onAppStart(): Promise<void> {
    try {
      await invoke('increment_usage_analytics_session');
    } catch (e) {
      logger.debug('usageAnalytics', 'onAppStart', 'Failed to increment session', { error: e });
    }
  },

  /**
   * Start the hourly check. Call after user is logged in (or always - service checks opt-in).
   */
  start(): void {
    if (intervalId) return;
    runCheck(); // Run immediately
    intervalId = setInterval(runCheck, CHECK_INTERVAL_MS);
  },

  /**
   * Stop the hourly check (e.g. on logout).
   */
  stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  /**
   * Force send one usage report immediately (for testing). Sends today's data.
   * Returns { success: boolean, error?: string }.
   */
  async sendTestReport(): Promise<{ success: boolean; error?: string }> {
    try {
      const state = await invoke<UsageAnalyticsState>('get_usage_analytics_state');
      const today = new Date().toISOString().slice(0, 10);
      const sessionsToSend =
        state.tracking_date === today ? Math.max(1, state.sessions_count) : 1;

      const cloudUser = await cloudAuthService.getUser();
      const success = await sendUsageReport({
        date: today,
        sessions_count: sessionsToSend,
        cloud_signed_in: !!cloudUser,
        app_version: await getAppVersion(),
        platform: await getPlatform(),
        client_id: await getClientId(),
      });
      return success ? { success: true } : { success: false, error: 'Request failed' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  },
};
