import { writable } from 'svelte/store';

export interface PlatformState {
  isMobile: boolean;
  isNativeMobile: boolean;
  isSmallViewport: boolean;
}

function createPlatformStore() {
  const { subscribe, set, update } = writable<PlatformState>({
    isMobile: false,
    isNativeMobile: false,
    isSmallViewport: false,
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
      set({ isMobile, isNativeMobile, isSmallViewport });
      return { isMobile, isNativeMobile, isSmallViewport };
    },
  };
}

export const platformStore = createPlatformStore();
