import { authService, type UserInfo } from './authService';
import { logger } from '../../utils/logger';

export interface LayoutAuthCheckSessionOptions {
  devMockEnabled: boolean;
  needsSetupSet: (value: boolean) => void;
  loadUserInfo: () => Promise<void>;
  loadSeqtaConfigAndMenu: () => Promise<void>;
}

/**
 * Check if a session exists and load user data if authenticated.
 */
export async function checkSession(options: LayoutAuthCheckSessionOptions): Promise<void> {
  const { devMockEnabled, needsSetupSet, loadUserInfo, loadSeqtaConfigAndMenu } = options;
  logger.logFunctionEntry('layoutAuth', 'checkSession');

  try {
    if (devMockEnabled) {
      needsSetupSet(false);
      logger.info('layoutAuth', 'checkSession', 'Dev mock enabled; bypassing login');
      await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      logger.logFunctionExit('layoutAuth', 'checkSession', { sessionExists: true });
      return;
    }

    const sessionExists = await authService.checkSession();
    needsSetupSet(!sessionExists);
    logger.info('layoutAuth', 'checkSession', `Session exists: ${sessionExists}`, {
      sessionExists,
    });

    if (sessionExists) {
      await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
    }
    logger.logFunctionExit('layoutAuth', 'checkSession', { sessionExists });
  } catch (error) {
    logger.error('layoutAuth', 'checkSession', `Failed to check session: ${error}`, { error });
  }
}

export interface LayoutAuthLoadUserInfoOptions {
  loadSettings: (keys: string[]) => Promise<Record<string, unknown>>;
  onDisableSchoolPicture: (value: boolean) => void;
  onUserInfo: (info: UserInfo | undefined) => void;
}

/**
 * Load user info and sync disable_school_picture setting.
 */
export async function loadUserInfo(options: LayoutAuthLoadUserInfoOptions): Promise<void> {
  const { loadSettings, onDisableSchoolPicture, onUserInfo } = options;

  const settings = await loadSettings(['disable_school_picture']);
  const disableSchoolPicture = settings.disable_school_picture ?? false;
  onDisableSchoolPicture(disableSchoolPicture);

  const info = await authService.loadUserInfo({ disableSchoolPicture });
  onUserInfo(info);
}

export interface LayoutAuthHandleLogoutOptions {
  onClearUser: () => void;
  onCloseDropdown: () => void;
  checkSession: () => Promise<void>;
}

/**
 * Log out the user and reset layout state.
 */
export async function handleLogout(options: LayoutAuthHandleLogoutOptions): Promise<void> {
  const { onClearUser, onCloseDropdown, checkSession } = options;

  const success = await authService.logout();
  if (success) {
    onClearUser();
    onCloseDropdown();
    await checkSession();
  }
}

export interface LayoutAuthStartLoginOptions {
  seqtaUrl: string;
  needsSetupSet: (value: boolean) => void;
  loadUserInfo: () => Promise<void>;
  loadSeqtaConfigAndMenu: () => Promise<void>;
}

/**
 * Start the login flow and poll for session creation.
 */
export async function startLogin(options: LayoutAuthStartLoginOptions): Promise<void> {
  const { seqtaUrl, needsSetupSet, loadUserInfo, loadSeqtaConfigAndMenu } = options;

  if (!seqtaUrl) {
    logger.error('layoutAuth', 'startLogin', 'No valid SEQTA URL found');
    return;
  }

  logger.info('layoutAuth', 'startLogin', 'Starting authentication', { url: seqtaUrl });
  await authService.startLogin(seqtaUrl);

  const timer = setInterval(async () => {
    const sessionExists = await authService.checkSession();
    if (sessionExists) {
      clearInterval(timer);
      needsSetupSet(false);
      await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      const { triggerBackgroundSync } = await import('$lib/services/startupService');
      triggerBackgroundSync();
    }
  }, 1000);

  setTimeout(() => clearInterval(timer), 5 * 60 * 1000);
}
