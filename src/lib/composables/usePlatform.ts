import { Window } from '@tauri-apps/api/window';
import { platformStore } from '$lib/stores/platform';

const appWindow = Window.getCurrent();

export interface PlatformState {
  isMobile: boolean;
  isNativeMobile: boolean;
  isSmallViewport: boolean;
  isWindows: boolean;
  isIOS: boolean;
  isLinux: boolean;
  supportsBiometric: boolean;
}

/**
 * Platform detection composable
 * Returns state object that can be used with $state() in Svelte components
 *
 * - isNativeMobile: true only on Tauri iOS/Android
 * - isSmallViewport: true when viewport <= 640px (sm breakpoint)
 * - isMobile: true when isNativeMobile OR isSmallViewport (unified mobile layout)
 */
export function usePlatform() {
  const state: PlatformState = {
    isMobile: false,
    isNativeMobile: false,
    isSmallViewport: false,
    isWindows: false,
    isIOS: false,
    isLinux: false,
    supportsBiometric: false,
  };

  const checkPlatform = () => {
    const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
    state.isWindows = tauri_platform === 'windows';
    state.isNativeMobile = tauri_platform === 'ios' || tauri_platform === 'android';
    state.isIOS = tauri_platform === 'ios';
    state.isLinux = tauri_platform === 'linux';
    const isMac =
      tauri_platform === 'macos' ||
      tauri_platform === 'ios' ||
      (typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent));
    state.isSmallViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    state.isMobile = state.isNativeMobile || state.isSmallViewport;
    state.supportsBiometric =
      tauri_platform === 'ios' ||
      tauri_platform === 'android' ||
      tauri_platform === 'macos' ||
      tauri_platform === 'windows';
    platformStore.set({
      isMobile: state.isMobile,
      isNativeMobile: state.isNativeMobile,
      isSmallViewport: state.isSmallViewport,
      isIOS: state.isIOS,
      isLinux: state.isLinux,
      isMac,
      supportsBiometric: state.supportsBiometric,
    });
    return {
      isWindows: state.isWindows,
      isMobile: state.isMobile,
      isNativeMobile: state.isNativeMobile,
      isSmallViewport: state.isSmallViewport,
      isIOS: state.isIOS,
      isLinux: state.isLinux,
      supportsBiometric: state.supportsBiometric,
    };
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
