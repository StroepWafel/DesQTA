import { Window } from '@tauri-apps/api/window';

const appWindow = Window.getCurrent();

export interface PlatformState {
  isMobile: boolean;
  isWindows: boolean;
}

/**
 * Platform detection composable
 * Returns state object that can be used with $state() in Svelte components
 */
export function usePlatform() {
  const state: PlatformState = {
    isMobile: false,
    isWindows: false,
  };

  const checkPlatform = () => {
    const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
    state.isWindows = tauri_platform === 'windows';
    state.isMobile = tauri_platform === 'ios' || tauri_platform === 'android';
    return { isWindows: state.isWindows, isMobile: state.isMobile };
  };

  const setupWindowCorners = () => {
    if (state.isWindows && !state.isMobile) {
      async function updateCorners() {
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) {
          document.body.classList.remove('rounded-xl');
        } else {
          document.body.classList.add('rounded-xl');
        }
      }
      updateCorners();
      appWindow.onResized(updateCorners);
      appWindow.onMoved(updateCorners);
    }
  };

  return {
    state,
    checkPlatform,
    setupWindowCorners,
  };
}

