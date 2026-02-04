import { invoke } from '@tauri-apps/api/core';
import { BUNDLED_THEMES } from '../generated/themes';
import { themeStoreService, resolveImageUrl } from './themeStoreService';
import { logger } from '../../utils/logger';

export interface ThemeManifest {
  name: string;
  displayName?: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category?: string;
  tags?: string[];
  compatibility: {
    minVersion: string;
    maxVersion: string;
  };
  preview: {
    thumbnail: string;
    screenshots: string[];
  };
  settings: {
    defaultAccentColor: string;
    defaultTheme: 'light' | 'dark' | 'system';
    supportsLightMode: boolean;
    supportsDarkMode: boolean;
    supportsSystemMode: boolean;
    allowUserCustomization?: boolean;
  };
  customProperties: Record<string, string>;
  fonts: {
    primary: string;
    secondary: string;
    monospace: string;
    display?: string;
  };
  animations: {
    duration: string;
    easing: string;
    enableEnhanced: boolean;
    scale?: string;
    fadeIn?: string;
    slideIn?: string;
  };
  features: {
    customScrollbars: boolean;
    glassmorphism: boolean;
    gradients: boolean;
    shadows: boolean;
  };
  colorSchemes?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  accessibility?: {
    highContrast: boolean;
    reducedMotion: boolean;
    focusIndicators: boolean;
    screenReaderOptimized: boolean;
  };
  responsive?: {
    breakpoints: Record<string, string>;
    fluidTypography: boolean;
    adaptiveSpacing: boolean;
  };
}

class ThemeService {
  private currentTheme: string = 'default';
  private loadedThemes: Map<string, ThemeManifest> = new Map();
  private activeCSSLinks: HTMLLinkElement[] = [];
  // Preview management
  private previewCSSLinks: Array<HTMLLinkElement | HTMLStyleElement> = [];
  private disabledDuringPreview: Array<HTMLLinkElement | HTMLStyleElement> = [];
  private previewThemeName: string | null = null;
  private previousThemeName: string | null = null;
  private isPreviewing = false;

  // Utilities for property style management
  private buildPropertiesCss(
    properties: Record<string, string>,
    fonts?: ThemeManifest['fonts'],
  ): string {
    const lines: string[] = [];
    Object.entries(properties || {}).forEach(([key, value]) => {
      const name = key.startsWith('--') ? key : `--${key}`;
      lines.push(`  ${name}: ${value};`);
    });
    if (fonts) {
      lines.push(`  --font-primary: ${fonts.primary};`);
      lines.push(`  --font-secondary: ${fonts.secondary};`);
      lines.push(`  --font-monospace: ${fonts.monospace};`);
      if (fonts.display) lines.push(`  --font-display: ${fonts.display};`);
    }
    return `:root{\n${lines.join('\n')}\n}`;
  }

  private setStyleTag(
    id: string,
    css: string,
    dataset: Record<string, string> = {},
  ): HTMLStyleElement {
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      Object.entries(dataset).forEach(([k, v]) => ((style as HTMLStyleElement).dataset[k] = v));
      document.head.appendChild(style);
    }
    style.textContent = css;
    return style;
  }

  private removeStyleTag(id: string) {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  async loadTheme(themeName: string): Promise<void> {
    // If it's the default theme, remove all custom theme CSS
    if (themeName === 'default') {
      this.removeActiveCSS();
      this.currentTheme = 'default';
      return;
    }

    try {
      // Load theme manifest
      const manifest = await this.loadThemeManifest(themeName);

      // Load CSS files
      await this.loadThemeCSS(themeName, manifest);

      // Apply custom properties + fonts via dedicated style tag
      this.applyCustomProperties(manifest.customProperties, manifest.fonts, { preview: false });

      // Update current theme
      this.currentTheme = themeName;

      // Save to settings
      await this.saveThemePreference(themeName);
    } catch (error) {
      console.error('Failed to load theme:', error);
      // Fallback to default theme
      await this.loadTheme('default');
    }
  }

  // Start a live preview of a theme without persisting settings
  async startPreview(themeName: string): Promise<ThemeManifest> {
    // If we are already previewing something else, cancel first
    if (this.isPreviewing) {
      await this.cancelPreview();
    }

    this.previousThemeName = this.currentTheme;
    const manifest = await this.loadThemeManifest(themeName);

    // Disable currently active CSS so preview can take precedence
    this.disabledDuringPreview = [];
    this.activeCSSLinks.forEach((el) => {
      try {
        // HTMLLinkElement and HTMLStyleElement both support disabled
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).disabled = true;
        this.disabledDuringPreview.push(el);
      } catch {}
    });

    // Inject preview CSS without removing current theme CSS
    await this.loadPreviewCSS(themeName, manifest);

    // Apply custom properties and fonts for the preview (separate style tag)
    this.applyCustomProperties(manifest.customProperties, manifest.fonts, { preview: true });

    this.previewThemeName = themeName;
    this.isPreviewing = true;
    return manifest;
  }

  // Commit the preview as the active theme, persisting preference
  async applyPreview(): Promise<void> {
    if (!this.isPreviewing || !this.previewThemeName) return;

    // Remove the previously active CSS from the DOM
    this.activeCSSLinks.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this.activeCSSLinks = [];

    // Convert preview links to active
    this.previewCSSLinks.forEach((el) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).disabled = false;
        (el as HTMLElement).setAttribute('data-theme', 'true');
        (el as HTMLElement).removeAttribute('data-theme-preview');
      } catch {}
      this.activeCSSLinks.push(el as HTMLLinkElement);
    });
    this.previewCSSLinks = [];

    // Replace properties style tag: promote preview to active
    const previewProps = document.getElementById('theme-preview-properties');
    if (previewProps) {
      previewProps.removeAttribute('data-theme-preview');
      previewProps.setAttribute('data-theme', 'true');
      previewProps.id = 'theme-properties';
    }

    // Remove disabled originals (already removed), clear preview state
    this.disabledDuringPreview = [];

    // Update state and persist preference
    this.currentTheme = this.previewThemeName;
    await this.saveThemePreference(this.currentTheme);

    this.previewThemeName = null;
    this.previousThemeName = null;
    this.isPreviewing = false;
  }

  // Cancel preview and return to the previously active theme
  async cancelPreview(): Promise<void> {
    if (!this.isPreviewing) return;

    // Remove preview CSS from DOM
    this.previewCSSLinks.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this.previewCSSLinks = [];

    // Remove preview properties style tag
    this.removeStyleTag('theme-preview-properties');

    // Re-enable previously active CSS
    this.disabledDuringPreview.forEach((el) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).disabled = false;
      } catch {}
    });
    this.disabledDuringPreview = [];

    // No need to touch property styles; active tag remains in place

    this.previewThemeName = null;
    this.previousThemeName = null;
    this.isPreviewing = false;
  }

  async loadThemeManifest(themeName: string): Promise<ThemeManifest> {
    // 0) Try bundled themes (works in dev and prod without fetch)
    const bundled = BUNDLED_THEMES?.[themeName];
    if (bundled?.manifest) {
      this.loadedThemes.set(themeName, bundled.manifest as unknown as ThemeManifest);
      return bundled.manifest as unknown as ThemeManifest;
    }

    try {
      // First try to load from backend (supports both static and custom themes)
      const manifest = await invoke<ThemeManifest>('load_theme_manifest', { themeName });
      this.loadedThemes.set(themeName, manifest);
      return manifest;
    } catch (backendError) {
      console.warn('Backend theme loading failed, trying static fallback:', backendError);

      // Fallback to static themes directory
      const manifestPath = `/themes/${themeName}/theme-manifest.json`;

      try {
        const response = await fetch(manifestPath);
        if (!response.ok) {
          throw new Error(`Failed to load theme manifest: ${response.statusText}`);
        }

        const manifest: ThemeManifest = await response.json();
        this.loadedThemes.set(themeName, manifest);
        return manifest;
      } catch (staticError) {
        console.error('Error loading theme manifest from static:', staticError);
        throw staticError;
      }
    }
  }

  async loadThemeCSS(themeName: string, manifest: ThemeManifest): Promise<void> {
    // Remove existing theme CSS
    this.removeActiveCSS();

    // 0) Use bundled CSS if available
    const bundled = BUNDLED_THEMES?.[themeName]?.css;
    if (bundled) {
      const currentMode = this.getCurrentThemeMode();
      const toInject: Array<[string, string | null | undefined]> = [
        ['global.css', bundled.globalCss],
        [`${currentMode}.css`, currentMode === 'dark' ? bundled.darkCss : bundled.lightCss],
        ['components.css', bundled.componentsCss],
      ];
      for (const [id, css] of toInject) {
        if (!css) continue;
        const style = document.createElement('style');
        style.dataset.theme = 'true';
        style.id = `theme-${themeName}-${id}`.replace(/\./g, '-');
        style.textContent = css;
        document.head.appendChild(style);
        this.activeCSSLinks.push(style as unknown as HTMLLinkElement);
      }
      return;
    }

    // Try backend-provided CSS for appdata/static themes
    const tryBackendCss = async (fileName: string) => {
      try {
        const css = await invoke<string>('read_theme_css', { themeName, fileName });
        if (css && css.trim().length > 0) {
          // Inject via style tags to support appdata themes
          const id = `${themeName}-${fileName}`.replace(/\./g, '-');
          const style = document.createElement('style');
          style.dataset.theme = 'true';
          style.id = `theme-${id}`;
          style.textContent = css;
          document.head.appendChild(style);
          this.activeCSSLinks.push(style as unknown as HTMLLinkElement);
          return true;
        }
      } catch {}
      return false;
    };

    const currentMode = this.getCurrentThemeMode();
    const fileNames = ['global.css', `${currentMode}.css`, 'components.css'];

    for (const fileName of fileNames) {
      const ok = await tryBackendCss(fileName);
      if (!ok) {
        // Fallback to static link href if backend read fails
        await this.loadCSSFile(`/themes/${themeName}/styles/${fileName}`);
      }
    }
  }

  // Load CSS for preview without removing currently active CSS
  private async loadPreviewCSS(themeName: string, manifest: ThemeManifest): Promise<void> {
    // 0) Use bundled CSS if available
    const bundled = BUNDLED_THEMES?.[themeName]?.css;
    if (bundled) {
      const currentMode = this.getCurrentThemeMode();
      const toInject: Array<[string, string | null | undefined]> = [
        ['global.css', bundled.globalCss],
        [`${currentMode}.css`, currentMode === 'dark' ? bundled.darkCss : bundled.lightCss],
        ['components.css', bundled.componentsCss],
      ];
      for (const [id, css] of toInject) {
        if (!css) continue;
        const style = document.createElement('style');
        style.dataset.themePreview = 'true';
        style.id = `theme-preview-${themeName}-${id}`.replace(/\./g, '-');
        style.textContent = css;
        document.head.appendChild(style);
        this.previewCSSLinks.push(style);
      }
      return;
    }

    // Try backend-provided CSS for appdata/static themes
    const tryBackendCss = async (fileName: string) => {
      try {
        const css = await invoke<string>('read_theme_css', { themeName, fileName });
        if (css && css.trim().length > 0) {
          const id = `${themeName}-${fileName}`.replace(/\./g, '-');
          const style = document.createElement('style');
          style.dataset.themePreview = 'true';
          style.id = `theme-preview-${id}`;
          style.textContent = css;
          document.head.appendChild(style);
          this.previewCSSLinks.push(style);
          return true;
        }
      } catch {}
      return false;
    };

    const currentMode = this.getCurrentThemeMode();
    const fileNames = ['global.css', `${currentMode}.css`, 'components.css'];
    for (const fileName of fileNames) {
      const ok = await tryBackendCss(fileName);
      if (!ok) {
        // Fallback to static link href if backend read fails
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/themes/${themeName}/styles/${fileName}`;
        link.dataset.themePreview = 'true';
        link.onload = () => {};
        link.onerror = () => {};
        document.head.appendChild(link);
        this.previewCSSLinks.push(link);
      }
    }
  }

  private async loadCSSFile(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = path;
      link.dataset.theme = 'true';

      link.onload = () => {
        this.activeCSSLinks.push(link);
        resolve();
      };

      link.onerror = () => {
        // Silently fail for missing CSS files
        resolve();
      };

      document.head.appendChild(link);
    });
  }

  private removeActiveCSS(): void {
    this.activeCSSLinks.forEach((link) => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });
    this.activeCSSLinks = [];
    // Also remove the active properties style when fully unloading
    this.removeStyleTag('theme-properties');
  }

  private applyCustomProperties(
    properties: Record<string, string>,
    fonts?: ThemeManifest['fonts'],
    opts?: { preview?: boolean },
  ): void {
    const css = this.buildPropertiesCss(properties, fonts);
    const id = opts?.preview ? 'theme-preview-properties' : 'theme-properties';
    const dataset: Record<string, string> = opts?.preview
      ? { themePreview: 'true' }
      : { theme: 'true' };
    this.setStyleTag(id, css, dataset);
  }

  private async loadThemeFonts(_fonts: ThemeManifest['fonts']): Promise<void> {
    // Fonts are applied via CSS variables in the properties style tag now.
  }

  private getCurrentThemeMode(): string {
    // Get current theme mode from the theme store
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      return 'dark';
    } else {
      return 'light';
    }
  }

  private async saveThemePreference(themeName: string): Promise<void> {
    try {
      const { saveSettingsWithQueue } = await import('./settingsSync');
      await saveSettingsWithQueue({ current_theme: themeName });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }

  async getAvailableThemes(): Promise<string[]> {
    const bundled = Object.keys(BUNDLED_THEMES || {});
    let backend: string[] = [];
    let custom: string[] = [];
    try {
      backend = await invoke<string[]>('get_available_themes');
    } catch (error) {
      console.error('Failed to get available themes:', error);
    }
    try {
      custom = await this.getCustomThemes();
    } catch {}
    const all = new Set<string>([...bundled, ...backend, ...custom]);
    return Array.from(all);
  }

  async getCustomThemes(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_custom_themes');
    } catch (error) {
      console.error('Failed to get custom themes:', error);
      return [];
    }
  }

  async getCurrentTheme(): Promise<string> {
    return this.currentTheme;
  }

  async getThemeManifest(themeName: string): Promise<ThemeManifest | null> {
    if (this.loadedThemes.has(themeName)) {
      return this.loadedThemes.get(themeName)!;
    }

    try {
      return await this.loadThemeManifest(themeName);
    } catch (error) {
      return null;
    }
  }

  // Method to reset to default theme (no custom CSS)
  async resetToDefault(): Promise<void> {
    this.removeActiveCSS();
    this.currentTheme = 'default';
    // Remove property style tags
    this.removeStyleTag('theme-properties');
    this.removeStyleTag('theme-preview-properties');

    await this.saveThemePreference('default');
  }

  public setCustomProperties(properties: Record<string, string>): void {
    this.applyCustomProperties(properties, undefined, { preview: false });
  }

  public setThemeFonts(fonts: ThemeManifest['fonts']): void {
    // Merge fonts into the active properties style for consistency
    const css = this.buildPropertiesCss({}, fonts);
    this.setStyleTag('theme-properties', css, { theme: 'true' });
  }

  // Custom theme management methods
  async saveCustomTheme(themeName: string, themeData: any): Promise<void> {
    try {
      await invoke('save_custom_theme', { themeName, themeData });
      // Clear cached themes to force reload
      this.loadedThemes.clear();
    } catch (error) {
      console.error('Failed to save custom theme:', error);
      throw error;
    }
  }

  async deleteCustomTheme(themeName: string): Promise<void> {
    try {
      await invoke('delete_custom_theme', { themeName });
      // Remove from cache
      this.loadedThemes.delete(themeName);
    } catch (error) {
      console.error('Failed to delete custom theme:', error);
      throw error;
    }
  }

  async importThemeFromFile(filePath: string): Promise<string> {
    try {
      const themeName = await invoke<string>('import_theme_from_file', { filePath });
      // Clear cached themes to force reload
      this.loadedThemes.clear();
      return themeName;
    } catch (error) {
      console.error('Failed to import theme from file:', error);
      throw error;
    }
  }

  async getThemesDirectoryPath(): Promise<string> {
    try {
      return await invoke<string>('get_themes_directory_path');
    } catch (error) {
      console.error('Failed to get themes directory path:', error);
      throw error;
    }
  }

  // Enhanced theme loading with better error handling and caching
  async loadThemeWithFallback(themeName: string): Promise<void> {
    try {
      await this.loadTheme(themeName);
    } catch (error) {
      console.error(`Failed to load theme '${themeName}', falling back to default:`, error);
      await this.loadTheme('default');
    }
  }

  // Validate theme data structure
  validateThemeData(themeData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!themeData.name || typeof themeData.name !== 'string') {
      errors.push('Theme name is required and must be a string');
    }

    if (!themeData.displayName || typeof themeData.displayName !== 'string') {
      errors.push('Display name is required and must be a string');
    }

    if (!themeData.version || typeof themeData.version !== 'string') {
      errors.push('Version is required and must be a string');
    }

    if (!themeData.customProperties || typeof themeData.customProperties !== 'object') {
      errors.push('Custom properties are required and must be an object');
    } else {
      const requiredProps = ['--background-color', '--text-color', '--accent-color'];
      for (const prop of requiredProps) {
        if (!themeData.customProperties[prop]) {
          errors.push(`Required property '${prop}' is missing`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Generate theme preview CSS for testing
  generatePreviewCSS(themeData: any): string {
    let css = ':root {\n';

    if (themeData.customProperties) {
      for (const [key, value] of Object.entries(themeData.customProperties)) {
        css += `  ${key}: ${value};\n`;
      }
    }

    if (themeData.fonts && themeData.features?.customFonts) {
      css += `  --font-primary: ${themeData.fonts.primary};\n`;
      css += `  --font-secondary: ${themeData.fonts.secondary};\n`;
      css += `  --font-monospace: ${themeData.fonts.monospace};\n`;
      css += `  --font-display: ${themeData.fonts.display};\n`;
    }

    if (themeData.animations && themeData.features?.animations) {
      css += `  --animation-duration: ${themeData.animations.duration};\n`;
      css += `  --animation-easing: ${themeData.animations.easing};\n`;
      css += `  --animation-scale: ${themeData.animations.scale};\n`;
    }

    css += '}\n';

    return css;
  }

  // Apply temporary theme for preview without saving
  applyTemporaryTheme(themeData: any): void {
    const css = this.generatePreviewCSS(themeData);

    // Remove existing preview styles
    const existingPreview = document.getElementById('theme-preview-styles');
    if (existingPreview) {
      existingPreview.remove();
    }

    // Add new preview styles
    const style = document.createElement('style');
    style.id = 'theme-preview-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Remove temporary theme preview
  removeTemporaryTheme(): void {
    const existingPreview = document.getElementById('theme-preview-styles');
    if (existingPreview) {
      existingPreview.remove();
    }
  }

  // Cloud theme management methods
  async loadCloudTheme(themeId: string): Promise<void> {
    try {
      // Fetch theme details from store
      const themeData = await themeStoreService.getTheme(themeId);
      if (!themeData || !themeData.theme || !themeData.theme.slug) {
        throw new Error('Theme not found in store or invalid structure');
      }

      // Get download URL (zip URL)
      const downloadInfo = await themeStoreService.downloadTheme(themeId);
      if (!downloadInfo) {
        throw new Error('Failed to get download URL');
      }

      // Resolve ZIP URL to full URL (handle relative paths)
      const zipUrl =
        resolveImageUrl(downloadInfo.zip_download_url) || downloadInfo.zip_download_url;
      if (!zipUrl.startsWith('http://') && !zipUrl.startsWith('https://')) {
        throw new Error(`Invalid ZIP URL: ${zipUrl}`);
      }

      // Download ZIP, extract to app directory, and save theme UUID to settings
      const installedThemeName = await invoke<string>('download_and_install_theme', {
        zipUrl: zipUrl,
        themeId: themeId, // UUID from server
        themeSlug: themeData.theme.slug,
        checksum: downloadInfo.checksum,
      });

      // Save downloaded theme UUID and metadata to settings for cross-device sync and update detection
      await this.saveDownloadedThemeId(themeId, {
        version: themeData.theme.version,
        checksum: downloadInfo.checksum,
        updated_at: themeData.theme.updated_at,
      });

      // Load and apply the newly installed theme (this applies accent color and default theme)
      // loadAndApplyTheme will use the existing loadThemeManifest which handles manifest parsing correctly
      const { loadAndApplyTheme } = await import('../stores/theme');
      await loadAndApplyTheme(installedThemeName);
    } catch (error) {
      logger.error('themeService', 'loadCloudTheme', 'Failed to load cloud theme', {
        error,
        themeId,
      });
      throw error;
    }
  }

  async saveDownloadedThemeId(
    themeId: string,
    metadata?: { version: string; checksum: string; updated_at: number },
  ): Promise<void> {
    try {
      const { saveSettingsWithQueue } = await import('./settingsSync');
      // Get current downloaded themes metadata
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['downloaded_theme_ids', 'downloaded_theme_metadata'],
      });
      const currentIds: string[] = subset?.downloaded_theme_ids || [];
      const currentMetadata: Record<
        string,
        { version: string; checksum: string; updated_at: number }
      > = subset?.downloaded_theme_metadata || {};

      // Add theme ID if not already present
      if (!currentIds.includes(themeId)) {
        await saveSettingsWithQueue({
          downloaded_theme_ids: [...currentIds, themeId],
        });
      }

      // Save metadata if provided
      if (metadata) {
        await saveSettingsWithQueue({
          downloaded_theme_metadata: {
            ...currentMetadata,
            [themeId]: metadata,
          },
        });
        logger.debug('themeService', 'saveDownloadedThemeId', 'Saved theme metadata to settings', {
          themeId,
          metadata,
        });
      }
    } catch (error) {
      logger.error('themeService', 'saveDownloadedThemeId', 'Failed to save theme ID', { error });
    }
  }

  async removeDownloadedThemeId(themeId: string): Promise<void> {
    try {
      const { saveSettingsWithQueue } = await import('./settingsSync');
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['downloaded_theme_ids', 'downloaded_theme_metadata'],
      });
      const currentIds: string[] = subset?.downloaded_theme_ids || [];
      const currentMetadata: Record<string, any> = subset?.downloaded_theme_metadata || {};

      await saveSettingsWithQueue({
        downloaded_theme_ids: currentIds.filter((id) => id !== themeId),
        downloaded_theme_metadata: Object.fromEntries(
          Object.entries(currentMetadata).filter(([id]) => id !== themeId),
        ),
      });
      logger.debug('themeService', 'removeDownloadedThemeId', 'Removed theme ID from settings', {
        themeId,
      });
    } catch (error) {
      logger.error('themeService', 'removeDownloadedThemeId', 'Failed to remove theme ID', {
        error,
      });
    }
  }

  async isThemeInstalled(themeSlug: string): Promise<boolean> {
    try {
      const availableThemes = await this.getAvailableThemes();
      return availableThemes.includes(themeSlug);
    } catch {
      return false;
    }
  }

  async syncDownloadedThemes(): Promise<void> {
    try {
      // Get list of downloaded theme UUIDs from settings
      const subset = await invoke<any>('get_settings_subset', { keys: ['downloaded_theme_ids'] });
      const downloadedIds: string[] = subset?.downloaded_theme_ids || [];

      if (downloadedIds.length === 0) {
        logger.debug('themeService', 'syncDownloadedThemes', 'No themes to sync');
        return;
      }

      logger.info('themeService', 'syncDownloadedThemes', 'Starting theme sync', {
        count: downloadedIds.length,
      });

      // For each downloaded theme ID, check if it exists locally
      // If not, re-download it
      for (const themeId of downloadedIds) {
        try {
          const themeData = await themeStoreService.getTheme(themeId);
          if (themeData && themeData.theme && themeData.theme.slug) {
            // Check if theme is already installed locally
            const installed = await this.isThemeInstalled(themeData.theme.slug);
            if (!installed) {
              // Re-download and install
              logger.info(
                'themeService',
                'syncDownloadedThemes',
                `Re-downloading theme ${themeId}`,
                { slug: themeData.theme.slug },
              );
              await this.loadCloudTheme(themeId);
            } else {
              logger.debug('themeService', 'syncDownloadedThemes', 'Theme already installed', {
                themeId,
                slug: themeData.theme.slug,
              });
            }
          } else {
            logger.warn(
              'themeService',
              'syncDownloadedThemes',
              'Theme not found in store or invalid structure',
              {
                themeId,
                hasThemeData: !!themeData,
                hasTheme: !!themeData?.theme,
                hasSlug: !!themeData?.theme?.slug,
              },
            );
          }
        } catch (error) {
          logger.error('themeService', 'syncDownloadedThemes', `Failed to sync theme ${themeId}`, {
            error,
            themeId,
          });
          // Continue with next theme
        }
      }

      logger.info('themeService', 'syncDownloadedThemes', 'Theme sync completed');
    } catch (error) {
      logger.error('themeService', 'syncDownloadedThemes', 'Failed to sync themes', { error });
    }
  }

  // Get installed theme metadata from settings
  async getInstalledThemeMetadata(
    themeId: string,
  ): Promise<{ version: string; checksum: string; updated_at: number } | null> {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['downloaded_theme_metadata'],
      });
      const metadata: Record<string, { version: string; checksum: string; updated_at: number }> =
        subset?.downloaded_theme_metadata || {};
      return metadata[themeId] || null;
    } catch (error) {
      logger.error('themeService', 'getInstalledThemeMetadata', 'Failed to get metadata', {
        error,
      });
      return null;
    }
  }

  // Check if a theme has an update available
  async checkThemeUpdate(themeId: string): Promise<{
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion?: string;
    currentChecksum?: string;
    latestChecksum?: string;
  }> {
    try {
      // Get installed metadata
      const installedMetadata = await this.getInstalledThemeMetadata(themeId);
      if (!installedMetadata) {
        return { hasUpdate: false };
      }

      // Get latest theme data from store
      const themeData = await themeStoreService.getTheme(themeId);
      if (!themeData || !themeData.theme) {
        return { hasUpdate: false };
      }

      const latestVersion = themeData.theme.version;
      const latestUpdatedAt = themeData.theme.updated_at;

      // Check if version changed or updated_at is newer
      const versionChanged = installedMetadata.version !== latestVersion;
      const updatedAtChanged = latestUpdatedAt > installedMetadata.updated_at;

      // Get latest checksum if available
      const downloadInfo = await themeStoreService.downloadTheme(themeId);
      const latestChecksum = downloadInfo?.checksum;

      return {
        hasUpdate: versionChanged || updatedAtChanged,
        currentVersion: installedMetadata.version,
        latestVersion: latestVersion,
        currentChecksum: installedMetadata.checksum,
        latestChecksum: latestChecksum,
      };
    } catch (error) {
      logger.error('themeService', 'checkThemeUpdate', 'Failed to check for updates', {
        error,
        themeId,
      });
      return { hasUpdate: false };
    }
  }

  // Call on app startup after settings load
  async initializeThemeSync(): Promise<void> {
    // Check if we have downloaded themes to sync
    const subset = await invoke<any>('get_settings_subset', { keys: ['downloaded_theme_ids'] });
    const downloadedIds: string[] = subset?.downloaded_theme_ids || [];

    if (downloadedIds.length > 0) {
      // Sync in background (don't block startup)
      this.syncDownloadedThemes().catch((error) => {
        logger.error('themeService', 'initializeThemeSync', 'Failed to sync themes', { error });
      });
    }
  }
}

// Export singleton instance
export const themeService = new ThemeService();
