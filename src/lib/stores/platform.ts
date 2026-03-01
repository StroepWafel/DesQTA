import { writable } from 'svelte/store';

export interface PlatformState {
  isMobile: boolean;
  isNativeMobile: boolean;
  isSmallViewport: boolean;
  /** True if platform supports biometric (Touch ID, Face ID, Windows Hello, fingerprint) */
  supportsBiometric: boolean;
}

function createPlatformStore() {
  const { subscribe, set, update } = writable<PlatformState>({
    isMobile: false,
    isNativeMobile: false,
    isSmallViewport: false,
    supportsBiometric: false,
  });

  return {
    subscribe,
    set,
    update,
    checkPlatform: () => {
      const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
      const isNativeMobile = tauriPlatform === 'ios' || tauriPlatform === 'android';
      const isSmallViewport =
        typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
      const isMobile = isNativeMobile || isSmallViewport;
      const supportsBiometric =
        tauriPlatform === 'ios' ||
        tauriPlatform === 'android' ||
        tauriPlatform === 'macos' ||
        tauriPlatform === 'windows';
      set({ isMobile, isNativeMobile, isSmallViewport, supportsBiometric });
      return { isMobile, isNativeMobile, isSmallViewport, supportsBiometric };
    },
  };
}

export const platformStore = createPlatformStore();
