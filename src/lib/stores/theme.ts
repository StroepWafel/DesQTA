import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import { themeService, type ThemeManifest } from '../services/themeService';

// Create a writable store with the default accent color
export const accentColor = writable('#3b82f6');

// Create a writable store for the theme
export const theme = writable<'light' | 'dark' | 'system'>('system');

// New theme system stores
export const currentTheme = writable('default');
export const themeManifest = writable<ThemeManifest | null>(null);
export const customCSS = writable('');
// Previewing theme name (not yet applied)
export const previewingTheme = writable<string | null>(null);

// Derived store for theme properties
export const themeProperties = derived(
  [currentTheme, themeManifest],
  ([$currentTheme, $manifest]) => {
    if (!$manifest) return {};
    return $manifest.customProperties;
  }
);

// Function to get the system theme preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

// Function to apply theme to the DOM
function applyTheme(themeValue: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;

  const resolvedTheme = themeValue === 'system' ? getSystemTheme() : themeValue;

  // Add or remove the dark class
  if (resolvedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Keep the data attribute for compatibility
  document.documentElement.setAttribute('data-theme', resolvedTheme);
}

// Track previous mode to restore after preview
let _previewPreviousMode: 'light' | 'dark' | 'system' | null = null;
let _previewPreviousAccent: string | null = null;

// Function to load the accent color from settings
export async function loadAccentColor() {
  try {
    const subset = await invoke<any>('get_settings_subset', { keys: ['accent_color'] });
    accentColor.set(subset?.accent_color || '#3b82f6');
  } catch (e) {
    console.error('Failed to load accent color:', e);
  }
}

// Function to load the theme from settings
export async function loadTheme() {
  try {
    const subset = await invoke<any>('get_settings_subset', { keys: ['theme'] });
    const loadedTheme = subset?.theme || 'system';
    theme.set(loadedTheme);
    applyTheme(loadedTheme);

    // Listen for system theme changes if using system theme
    if (loadedTheme === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        theme.update((currentTheme) => {
          if (currentTheme === 'system') {
            applyTheme('system');
          }
          return currentTheme;
        });
      };

      // Remove any existing listener first
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    }
  } catch (e) {
    console.error('Failed to load theme:', e);
    // Fallback to system theme
    theme.set('system');
    applyTheme('system');
  }
}

// Function to update the accent color
export async function updateAccentColor(color: string) {
  try {
    const { saveSettingsWithQueue } = await import('../services/settingsSync');
    await saveSettingsWithQueue({ accent_color: color });
    accentColor.set(color);
    logger.debug('themeStore', 'updateAccentColor', 'Accent color updated successfully', { color });
  } catch (e) {
    logger.error('themeStore', 'updateAccentColor', `Failed to update accent color: ${e}`, { error: e, color });
  }
}

// Function to update the theme
export async function updateTheme(newTheme: 'light' | 'dark' | 'system') {
  try {
    const { saveSettingsWithQueue } = await import('../services/settingsSync');
    await saveSettingsWithQueue({ theme: newTheme });
    theme.set(newTheme);
    applyTheme(newTheme);

    // Set up system theme listener if switching to system
    if (newTheme === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        theme.update((currentTheme) => {
          if (currentTheme === 'system') {
            applyTheme('system');
          }
          return currentTheme;
        });
      };

      // Remove any existing listener first
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    }
  } catch (e) {
    console.error('Failed to update theme:', e);
  }
}

// New theme system functions

// Load theme and apply it
export async function loadAndApplyTheme(themeName: string) {
  try {
    await themeService.loadTheme(themeName);
    currentTheme.set(themeName);

    const manifest = await themeService.getThemeManifest(themeName);
    themeManifest.set(manifest);

    // Only fetch what we need
    let subset = await invoke<any>('get_settings_subset', { keys: ['current_theme','accent_color','theme'] });

    if (themeName === 'default') {
      // Reset accent color and theme to defaults, then save once
      const defaultAccent = '#3b82f6';
      const defaultTheme: 'light' | 'dark' | 'system' = 'dark';
      accentColor.set(defaultAccent);
      theme.set(defaultTheme);
      const { saveSettingsWithQueue } = await import('../services/settingsSync');
      await saveSettingsWithQueue({ current_theme: 'default', accent_color: defaultAccent, theme: defaultTheme });
      applyTheme(defaultTheme);
      return;
    }

    if (manifest) {
      // Use manifest values, save once
      const nextAccent = manifest.settings.defaultAccentColor;
      const nextTheme = manifest.settings.defaultTheme;
      accentColor.set(nextAccent);
      theme.set(nextTheme);
      const { saveSettingsWithQueue } = await import('../services/settingsSync');
      await saveSettingsWithQueue({ current_theme: themeName, accent_color: nextAccent, theme: nextTheme });

      // Apply theme visually after stores updated and settings persisted
      applyTheme(nextTheme);
    }
  } catch (error) {
    logger.error('themeStore', 'loadAndApplyTheme', 'Failed to load and apply theme', { error, themeName });
  }
}

// Apply custom CSS
export function applyCustomCSS(css: string) {
  customCSS.set(css);
  // Inject into DOM
  import('../services/cssInjectionService').then(({ cssInjectionService }) => {
    cssInjectionService.injectCustomCSS(css);
  });
}

// Begin live preview of a theme without reloading or persisting
export async function startThemePreview(themeName: string) {
  try {
    // Only capture previous state if not already previewing
    if (!get(previewingTheme)) {
      _previewPreviousMode = get(theme);
      _previewPreviousAccent = get(accentColor);
    }
    // Load manifest first so we can switch light/dark before injecting CSS
    const manifest = await themeService.getThemeManifest(themeName);
    if (manifest?.settings?.defaultTheme) {
      const nextMode = manifest.settings.defaultTheme;
      if (get(theme) !== nextMode) {
        theme.set(nextMode);
      }
      // Allow the DOM to reflect the class change before loading CSS
      await Promise.resolve();
    }
    // Preview accent color from theme manifest, if available
    if (manifest?.settings?.defaultAccentColor) {
      const nextAccent = manifest.settings.defaultAccentColor;
      if (get(accentColor) !== nextAccent) {
        accentColor.set(nextAccent);
      }
    }
    await themeService.startPreview(themeName);
    previewingTheme.set(themeName);
  } catch (error) {
    console.error('Failed to start theme preview:', error);
  }
}

// Cancel a running preview and restore prior look
export async function cancelThemePreview() {
  try {
    await themeService.cancelPreview();
    if (_previewPreviousMode) {
      theme.set(_previewPreviousMode);
    }
    if (_previewPreviousAccent) {
      accentColor.set(_previewPreviousAccent);
    }
  } catch (error) {
    console.error('Failed to cancel theme preview:', error);
  } finally {
    previewingTheme.set(null);
    _previewPreviousMode = null;
    _previewPreviousAccent = null;
  }
}

// Commit the preview as the active theme without reloading
export async function applyPreviewTheme() {
  try {
    const name = get(previewingTheme);
    if (!name) return;

    // Convert preview to active and persist preference
    await themeService.applyPreview();

    // Sync stores and persist accent/theme like loadAndApplyTheme does,
    // but avoid re-injecting CSS (already active from preview)
    currentTheme.set(name);
    const manifest = await themeService.getThemeManifest(name);
    themeManifest.set(manifest);

    if (name === 'default') {
      const defaultAccent = '#3b82f6';
      const defaultTheme: 'light' | 'dark' | 'system' = 'dark';
      accentColor.set(defaultAccent);
      theme.set(defaultTheme);
      const { saveSettingsWithQueue } = await import('../services/settingsSync');
      await saveSettingsWithQueue({ current_theme: 'default', accent_color: defaultAccent, theme: defaultTheme });
    } else if (manifest) {
      const nextAccent = manifest.settings.defaultAccentColor;
      const nextTheme = manifest.settings.defaultTheme;
      accentColor.set(nextAccent);
      theme.set(nextTheme);
      const { saveSettingsWithQueue } = await import('../services/settingsSync');
      await saveSettingsWithQueue({ current_theme: name, accent_color: nextAccent, theme: nextTheme });
    }
  } catch (error) {
    console.error('Failed to apply preview theme:', error);
  } finally {
    previewingTheme.set(null);
    _previewPreviousMode = null;
  }
}

// Load current theme from settings
export async function loadCurrentTheme() {
  try {
    // Load both theme pack name and user's manual theme preference
    const subset = await invoke<any>('get_settings_subset', { keys: ['current_theme','theme'] });
    const savedThemeName: string = subset?.current_theme || 'default';
    const userThemePreference: 'light' | 'dark' | 'system' | undefined = subset?.theme;
    
    currentTheme.set(savedThemeName);

    // Load the theme pack
    await themeService.loadTheme(savedThemeName);

    if (savedThemeName !== 'default') {
      const manifest = await themeService.getThemeManifest(savedThemeName);
      themeManifest.set(manifest);
      if (manifest) {
        // Set accent color from manifest
        accentColor.set(manifest.settings.defaultAccentColor);
        
        // Check if user has manually overridden the theme preference
        // If userThemePreference exists and is a valid theme value, use it instead of manifest default
        if (userThemePreference && ['light', 'dark', 'system'].includes(userThemePreference)) {
          // User has manually set a preference, use that
          theme.set(userThemePreference);
          applyTheme(userThemePreference);
        } else {
          // No manual override, use manifest default
          theme.set(manifest.settings.defaultTheme);
          applyTheme(manifest.settings.defaultTheme);
        }
      }
    } else {
      // Default theme fallback
      const defaultAccent = '#3b82f6';
      // Check if user has manually overridden the theme preference
      const defaultTheme: 'light' | 'dark' | 'system' = 
        (userThemePreference && ['light', 'dark', 'system'].includes(userThemePreference)) 
          ? userThemePreference 
          : 'dark';
      accentColor.set(defaultAccent);
      theme.set(defaultTheme);
      applyTheme(defaultTheme);
    }
  } catch (error) {
    logger.error('themeStore', 'loadCurrentTheme', 'Failed to load current theme', { error });
    currentTheme.set('default');
    // Apply safe defaults
    const defaultAccent = '#3b82f6';
    const defaultTheme: 'light' | 'dark' | 'system' = 'dark';
    accentColor.set(defaultAccent);
    theme.set(defaultTheme);
    applyTheme(defaultTheme);
  }
}

// Reset to default theme
export async function resetToDefault() {
  try {
    await themeService.resetToDefault();
    currentTheme.set('default');
    themeManifest.set(null);
    // Save current_theme to settings
    const { saveSettingsWithQueue } = await import('../services/settingsSync');
    await saveSettingsWithQueue({ current_theme: 'default' });
  } catch (error) {
    console.error('Failed to reset to default theme:', error);
  }
}

// Subscribe to theme changes and apply them
if (typeof window !== 'undefined') {
  theme.subscribe((themeValue) => {
    applyTheme(themeValue);
  });
}
