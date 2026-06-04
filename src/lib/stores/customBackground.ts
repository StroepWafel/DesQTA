import { writable, get } from 'svelte/store';
import { loadSettings } from '$lib/composables/useLayoutSettings';
import {
  resolveBackgroundImageUrl,
  normalizeBackgroundFit,
  clampBackgroundOpacity,
  clampBackgroundDim,
  type BackgroundFit,
} from '$lib/services/backgroundImageService';
import { logger } from '../../utils/logger';

export interface CustomBackgroundState {
  enabled: boolean;
  fit: BackgroundFit;
  opacity: number;
  dim: number;
  imageUrl: string | null;
  loaded: boolean;
}

const defaultState: CustomBackgroundState = {
  enabled: false,
  fit: 'cover',
  opacity: 1,
  dim: 0,
  imageUrl: null,
  loaded: false,
};

export const customBackground = writable<CustomBackgroundState>({ ...defaultState });

export async function loadCustomBackground(): Promise<void> {
  try {
    const settings = await loadSettings([
      'custom_background_enabled',
      'custom_background_fit',
      'custom_background_opacity',
      'custom_background_dim',
    ]);

    const enabled = settings.custom_background_enabled === true;
    const imageUrl = enabled ? await resolveBackgroundImageUrl() : null;

    customBackground.set({
      enabled: enabled && !!imageUrl,
      fit: normalizeBackgroundFit(settings.custom_background_fit as string | undefined),
      opacity: clampBackgroundOpacity(
        typeof settings.custom_background_opacity === 'number'
          ? settings.custom_background_opacity
          : 1,
      ),
      dim: clampBackgroundDim(
        typeof settings.custom_background_dim === 'number' ? settings.custom_background_dim : 0,
      ),
      imageUrl,
      loaded: true,
    });
  } catch (e) {
    logger.error('customBackground', 'loadCustomBackground', `Failed: ${e}`, { error: e });
    customBackground.set({ ...defaultState, loaded: true });
  }
}

export async function refreshCustomBackgroundImage(): Promise<void> {
  const current = get(customBackground);
  const imageUrl = await resolveBackgroundImageUrl();
  customBackground.set({
    ...current,
    imageUrl,
    enabled: current.enabled && !!imageUrl,
  });
}

export function getBackgroundSizeCss(fit: BackgroundFit): string {
  switch (fit) {
    case 'contain':
      return 'contain';
    case 'fill':
      return '100% 100%';
    default:
      return 'cover';
  }
}
