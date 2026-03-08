import { listen } from '@tauri-apps/api/event';
import { Window } from '@tauri-apps/api/window';
import { logger } from '../../utils/logger';

export interface LayoutListenersOptions {
  appWindow: ReturnType<typeof Window.getCurrent>;
  onFullscreenChange: (isFullscreen: boolean) => void;
}

const isMacOS = import.meta.env.TAURI_ENV_PLATFORM === 'darwin' || import.meta.env.TAURI_ENV_PLATFORM === 'macos';

/**
 * Set up layout event listeners (reload, fullscreen, zoom).
 * On macOS, we avoid calling isMaximized() in resize/move handlers - it causes
 * infinite resize loop and 100% CPU hang (tauri-apps/plugins-workspace#1918).
 * Returns cleanup function to call on destroy.
 */
export async function useLayoutListeners(options: LayoutListenersOptions): Promise<() => void> {
  const { appWindow, onFullscreenChange } = options;

  const unlistenReload = await listen<string>('reload', () => {
    logger.info('layout', 'reload_listener', 'Received reload event');
    location.reload();
  });

  await listen<boolean>('fullscreen-changed', (event) => {
    onFullscreenChange(event.payload);
    logger.debug('layout', 'fullscreen_listener', `Window state changed: ${event.payload}`);
  });

  await listen<string>('zoom', async (event) => {
    const { zoomIn, zoomOut, zoomReset } = await import('$lib/utils/zoom');
    if (event.payload === 'in') zoomIn();
    else if (event.payload === 'out') zoomOut();
    else if (event.payload === 'reset') zoomReset();
  });

  const checkFullscreenState = async () => {
    try {
      const currentFullscreen = await appWindow.isFullscreen();
      const currentMaximized = isMacOS ? false : await appWindow.isMaximized().catch(() => false);
      const shouldRemoveCorners = currentFullscreen || currentMaximized;
      onFullscreenChange(shouldRemoveCorners);
      logger.debug(
        'layout',
        'checkFullscreenState',
        `Window state updated: ${shouldRemoveCorners} (fullscreen: ${currentFullscreen}, maximized: ${currentMaximized})`,
      );
    } catch (e) {
      logger.debug('layout', 'checkFullscreenState', 'Failed to check window state', {
        error: e,
      });
    }
  };

  await checkFullscreenState();

  // On macOS: do NOT register onResized/onMoved - calling isMaximized() from those
  // handlers triggers infinite resize loop. Backend emits fullscreen-changed instead.
  let unlistenResized: (() => void) | undefined;
  let unlistenMoved: (() => void) | undefined;
  if (!isMacOS) {
    unlistenResized = appWindow.onResized(checkFullscreenState);
    unlistenMoved = appWindow.onMoved(checkFullscreenState);
  }

  return () => {
    logger.debug('layout', 'onDestroy', 'Cleaning up layout listeners');
    unlistenReload();
    unlistenResized?.();
    unlistenMoved?.();
  };
}
