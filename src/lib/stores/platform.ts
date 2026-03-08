import { writable } from 'svelte/store';

export interface PlatformState {
  isMobile: boolean;
  isNativeMobile: boolean;
  isSmallViewport: boolean;
  /** True on Tauri iOS (needs safe area padding for notch/home indicator) */
  isIOS: boolean;
  /** True on Tauri Linux desktop */
  isLinux: boolean;
  /** True if platform supports biometric (Touch ID, Face ID, Windows Hello, fingerprint) */
  supportsBiometric: boolean;
}

function createPlatformStore() {
  const { subscribe, set, update } = writable<PlatformState>({
    isMobile: false,
    isNativeMobile: false,
    isSmallViewport: false,
    isIOS: false,
    isLinux: false,
    supportsBiometric: false,
  });

  return {
    subscribe,
    set,
    update,
    checkPlatform: () => {
      const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
      const isNativeMobile = tauriPlatform === 'ios' || tauriPlatform === 'android';
      const isIOS = tauriPlatform === 'ios';
      const isLinux = tauriPlatform === 'linux';
      const isSmallViewport =
        typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
      const isMobile = isNativeMobile || isSmallViewport;
      const supportsBiometric =
        tauriPlatform === 'ios' ||
        tauriPlatform === 'android' ||
        tauriPlatform === 'darwin' ||
        tauriPlatform === 'macos' ||
        tauriPlatform === 'windows';
      set({ isMobile, isNativeMobile, isSmallViewport, isIOS, isLinux, supportsBiometric });
      return { isMobile, isNativeMobile, isSmallViewport, isIOS, isLinux, supportsBiometric };
    },
  };
}

export const platformStore = createPlatformStore();
