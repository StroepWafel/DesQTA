import { invoke } from '@tauri-apps/api/core';
import { BUNDLED_THEMES } from '../generated/themes';

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
  private buildPropertiesCss(properties: Record<string, string>, fonts?: ThemeManifest['fonts']): string {
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

  private setStyleTag(id: string, css: string, dataset: Record<string, string> = {}): HTMLStyleElement {
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
    this.activeCSSLinks.forEach(link => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });
    this.activeCSSLinks = [];
    // Also remove the active properties style when fully unloading
    this.removeStyleTag('theme-properties');
  }

  private applyCustomProperties(properties: Record<string, string>, fonts?: ThemeManifest['fonts'], opts?: { preview?: boolean }): void {
    const css = this.buildPropertiesCss(properties, fonts);
    const id = opts?.preview ? 'theme-preview-properties' : 'theme-properties';
    const dataset = opts?.preview ? { themePreview: 'true' } : { theme: 'true' };
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
      await invoke('save_settings_merge', { patch: { current_theme: themeName } });
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
      errors
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
}

// Export singleton instance
export const themeService = new ThemeService(); 
