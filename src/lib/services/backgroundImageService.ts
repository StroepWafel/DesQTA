import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

export type BackgroundFit = 'cover' | 'contain' | 'fill';

export async function saveBackgroundImage(base64Data: string): Promise<string> {
  return invoke<string>('save_background_image', { base64Data });
}

export async function deleteBackgroundImage(): Promise<void> {
  await invoke('delete_background_image');
}

export async function hasCustomBackgroundImage(): Promise<boolean> {
  return invoke<boolean>('has_custom_background_image');
}

/** Load background as a data URL (same approach as profile pictures; avoids asset.localhost). */
export async function resolveBackgroundImageUrl(): Promise<string | null> {
  try {
    return await invoke<string | null>('get_background_image_data_url');
  } catch (e) {
    logger.error('backgroundImageService', 'resolveBackgroundImageUrl', `Failed: ${e}`, {
      error: e,
    });
    return null;
  }
}

export function clampBackgroundOpacity(value: number): number {
  return Math.min(1, Math.max(0.2, value));
}

export function clampBackgroundDim(value: number): number {
  return Math.min(0.8, Math.max(0, value));
}

export function normalizeBackgroundFit(fit: string | undefined): BackgroundFit {
  if (fit === 'contain' || fit === 'fill') return fit;
  return 'cover';
}
