import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

/**
 * Load a subset of settings from the backend.
 */
export async function loadSettings(keys: string[]): Promise<Record<string, unknown>> {
  try {
    const subset = await invoke<Record<string, unknown>>('get_settings_subset', { keys });
    return subset || {};
  } catch (e) {
    logger.error('layout', 'loadSettings', `Failed to load settings: ${e}`, { keys, error: e });
    return {};
  }
}

export interface UseLayoutSettingsOptions {
  onEnhancedAnimations: (value: boolean) => void;
}

/**
 * Load enhanced animations setting and apply via callback.
 */
export async function loadEnhancedAnimationsSetting(
  options: UseLayoutSettingsOptions,
): Promise<void> {
  const { onEnhancedAnimations } = options;
  const settings = await loadSettings(['enhanced_animations']);
  const value = settings.enhanced_animations ?? true;
  onEnhancedAnimations(value);
  logger.debug('layout', 'loadEnhancedAnimationsSetting', `Enhanced animations: ${value}`);
}
