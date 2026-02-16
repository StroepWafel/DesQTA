use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;
use sha2::{Sha256, Digest};
use hex;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeManifest {
    pub name: String,
    #[serde(default = "default_display_name")]
    pub display_name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub preview: ThemePreview,
    pub settings: ThemeSettings,
    pub custom_properties: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub features: ThemeFeatures,
    pub fonts: ThemeFonts,
    #[serde(default)]
    pub animations: ThemeAnimations,
    #[serde(default)]
    pub color_schemes: ThemeColorSchemes,
    #[serde(default)]
    pub accessibility: ThemeAccessibility,
    #[serde(default)]
    pub responsive: ThemeResponsive,
}

fn default_display_name() -> String {
    String::new() // Will be set from name if empty
}

fn default_category() -> String {
    "uncategorized".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemePreview {
    #[serde(default)]
    pub thumbnail: String,
    #[serde(default)]
    pub screenshots: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    #[serde(default = "default_theme_mode")]
    pub default_theme: String,
    #[serde(default = "default_accent_color_value")]
    pub default_accent_color: String,
    #[serde(default)]
    pub allow_user_customization: bool,
    pub auto_switch_time: Option<AutoSwitchTime>,
}

fn default_theme_mode() -> String {
    "dark".to_string()
}

fn default_accent_color_value() -> String {
    "#3b82f6".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AutoSwitchTime {
    pub light: String,
    pub dark: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeFeatures {
    #[serde(default)]
    pub glassmorphism: bool,
    #[serde(default)]
    pub gradients: bool,
    #[serde(default)]
    pub animations: bool,
    #[serde(default)]
    pub custom_fonts: bool,
    #[serde(default)]
    pub dark_mode: bool,
    #[serde(default)]
    pub color_schemes: bool,
    #[serde(default)]
    pub accessibility: bool,
    #[serde(default)]
    pub responsive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeFonts {
    pub primary: String,
    pub secondary: String,
    pub monospace: String,
    #[serde(default = "default_display_font")]
    pub display: String,
}

fn default_display_font() -> String {
    "system-ui, -apple-system, sans-serif".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemeAnimations {
    #[serde(default = "default_animation_duration")]
    pub duration: String,
    #[serde(default = "default_animation_easing")]
    pub easing: String,
    #[serde(default)]
    pub scale: String,
    #[serde(default)]
    pub fade_in: String,
    #[serde(default)]
    pub slide_in: String,
}

impl Default for ThemeAnimations {
    fn default() -> Self {
        Self {
            duration: default_animation_duration(),
            easing: default_animation_easing(),
            scale: String::new(),
            fade_in: String::new(),
            slide_in: String::new(),
        }
    }
}

fn default_animation_duration() -> String {
    "200ms".to_string()
}

fn default_animation_easing() -> String {
    "ease-in-out".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColorSchemes {
    #[serde(default)]
    pub light: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub dark: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeAccessibility {
    #[serde(default)]
    pub high_contrast: bool,
    #[serde(default)]
    pub reduced_motion: bool,
    #[serde(default)]
    pub focus_indicators: bool,
    #[serde(default)]
    pub screen_reader_optimized: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeResponsive {
    #[serde(default)]
    pub breakpoints: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub fluid_typography: bool,
    #[serde(default)]
    pub adaptive_spacing: bool,
}

pub struct ThemeManager {
    app_handle: AppHandle,
}

impl ThemeManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn get_themes_directory(&self) -> Result<PathBuf> {
        use crate::profiles;
        
        // Get current profile directory
        let profile_id = profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string());
        
        let mut profile_dir = profiles::get_profile_dir(&profile_id);
        
        #[cfg(target_os = "android")]
        {
            // On Android, profile_dir is already the correct path
            profile_dir.push("themes");
            if !profile_dir.exists() {
                println!("[ThemeManager] Creating Android themes dir: {:?}", profile_dir);
                fs::create_dir_all(&profile_dir)
                    .map_err(|e| anyhow!("Unable to create themes dir: {}", e))?;
            }
            println!("[ThemeManager] Using Android themes dir: {:?}", profile_dir);
            return Ok(profile_dir);
        }

        #[cfg(not(target_os = "android"))]
        {
            // On desktop, profile_dir is already the correct path
            profile_dir.push("themes");
            if !profile_dir.exists() {
                println!(
                    "[ThemeManager] Creating desktop themes dir: {:?}",
                    profile_dir
                );
                fs::create_dir_all(&profile_dir)
                    .map_err(|e| anyhow!("Unable to create themes dir: {}", e))?;
            }
            println!("[ThemeManager] Using desktop themes dir: {:?}", profile_dir);
            Ok(profile_dir)
        }
    }

    #[allow(dead_code)]
    pub fn get_static_themes_directory(&self) -> PathBuf {
        // Packaged: resource_dir/static/themes or resource_dir/themes
        if let Ok(res_dir) = self.app_handle.path().resource_dir() {
            let cand = res_dir.join("static").join("themes");
            if cand.exists() {
                println!(
                    "[ThemeManager] Using static themes dir (res/static/themes): {:?}",
                    cand
                );
                return cand;
            }
            let cand2 = res_dir.join("themes");
            if cand2.exists() {
                println!(
                    "[ThemeManager] Using static themes dir (res/themes): {:?}",
                    cand2
                );
                return cand2;
            }
        }

        // Dev: walk up from current_exe to locate project root containing /static/themes
        if let Ok(mut cur) = std::env::current_exe() {
            if cur.is_file() {
                if let Some(parent) = cur.parent() {
                    cur = parent.to_path_buf();
                }
            }
            for _ in 0..8 {
                let cand = cur.join("static").join("themes");
                if cand.exists() {
                    println!("[ThemeManager] Using dev static themes dir: {:?}", cand);
                    return cand;
                }
                if let Some(parent) = cur.parent() {
                    cur = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }

        // Fallback to workspace-relative path
        let dev = PathBuf::from("static/themes");
        if dev.exists() {
            println!(
                "[ThemeManager] Using workspace static themes dir: {:?}",
                dev
            );
            return dev;
        }

        PathBuf::from("static/themes")
    }

    pub fn list_available_themes(&self) -> Result<Vec<String>> {
        use std::collections::HashSet;
        let mut set: HashSet<String> = HashSet::new();

        println!("[ThemeManager] Listing available themes...");

        // Scan static themes
        let static_dir = self.get_static_themes_directory();
        if static_dir.exists() {
            println!("[ThemeManager] Scanning static dir: {:?}", static_dir);
            if let Ok(entries) = fs::read_dir(&static_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            if path.join("theme-manifest.json").exists()
                                || path.join("theme.manifest.json").exists()
                            {
                                println!("[ThemeManager] Found static theme: {}", name);
                                set.insert(name.to_string());
                            }
                        }
                    }
                }
            }
        }

        // Scan custom themes from app data directory
        if let Ok(themes_dir) = self.get_themes_directory() {
            println!("[ThemeManager] Scanning custom dir: {:?}", themes_dir);
            if let Ok(entries) = fs::read_dir(&themes_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            if path.join("theme-manifest.json").exists()
                                || path.join("theme.manifest.json").exists()
                            {
                                println!("[ThemeManager] Found custom theme: {}", name);
                                set.insert(name.to_string());
                            }
                        }
                    }
                }
            }
        }

        let list: Vec<String> = set.into_iter().collect();
        println!("[ThemeManager] Total themes: {}", list.len());
        Ok(list)
    }

    pub fn load_theme_manifest(&self, theme_name: &str) -> Result<ThemeManifest> {
        // First try to load from custom themes directory
        if let Ok(themes_dir) = self.get_themes_directory() {
            // Normalize path separators (handle .temp/theme-slug format)
            // Convert forward slashes to platform-specific separators
            let normalized_path = PathBuf::from(theme_name.replace('/', &std::path::MAIN_SEPARATOR.to_string()));
            let custom_manifest_path = themes_dir.join(normalized_path).join("theme-manifest.json");
            if custom_manifest_path.exists() {
                println!(
                    "[ThemeManager] Loading custom manifest: {:?}",
                    custom_manifest_path
                );
                let content = fs::read_to_string(&custom_manifest_path)
                    .map_err(|e| anyhow!("Failed to read custom theme manifest: {}", e))?;
                let mut manifest: ThemeManifest = serde_json::from_str(&content)
                    .map_err(|e| anyhow!("Failed to parse custom theme manifest: {}", e))?;
                // Set display_name from name if it's empty (default from deserialization)
                if manifest.display_name.is_empty() {
                    manifest.display_name = manifest.name.clone();
                }
                return Ok(manifest);
            }
        }

        // Then try static themes directory (skip for temp themes)
        if !theme_name.starts_with(".temp/") && !theme_name.starts_with(".temp\\") {
            let static_dir = self.get_static_themes_directory();
            let normalized_path = PathBuf::from(theme_name.replace('/', &std::path::MAIN_SEPARATOR.to_string()));
            let static_manifest_path = static_dir.join(normalized_path).join("theme-manifest.json");
            if static_manifest_path.exists() {
                println!(
                    "[ThemeManager] Loading static manifest: {:?}",
                    static_manifest_path
                );
                let content = fs::read_to_string(&static_manifest_path)
                    .map_err(|e| anyhow!("Failed to read static theme manifest: {}", e))?;
                let mut manifest: ThemeManifest = serde_json::from_str(&content)
                    .map_err(|e| anyhow!("Failed to parse static theme manifest: {}", e))?;
                // Set display_name from name if it's empty (default from deserialization)
                if manifest.display_name.is_empty() {
                    manifest.display_name = manifest.name.clone();
                }
                return Ok(manifest);
            }
        }

        Err(anyhow!("Theme '{}' not found", theme_name))
    }

    pub fn read_theme_css(&self, theme_name: &str, file_name: &str) -> Result<String> {
        // Prefer custom theme CSS in app data
        if let Ok(themes_dir) = self.get_themes_directory() {
            // Normalize path separators (handle .temp/theme-slug format)
            let normalized_path = PathBuf::from(theme_name.replace('/', &std::path::MAIN_SEPARATOR.to_string()));
            let path = themes_dir.join(normalized_path).join("styles").join(file_name);
            if path.exists() {
                println!("[ThemeManager] Reading custom CSS: {:?}", path);
                return fs::read_to_string(&path)
                    .map_err(|e| anyhow!("Failed to read custom CSS: {}", e));
            }
        }

        // Fallback to static themes CSS (skip for temp themes)
        if !theme_name.starts_with(".temp/") && !theme_name.starts_with(".temp\\") {
            let static_dir = self.get_static_themes_directory();
            let normalized_path = PathBuf::from(theme_name.replace('/', &std::path::MAIN_SEPARATOR.to_string()));
            let static_path = static_dir.join(normalized_path).join("styles").join(file_name);
            if static_path.exists() {
                println!("[ThemeManager] Reading static CSS: {:?}", static_path);
                return fs::read_to_string(&static_path)
                    .map_err(|e| anyhow!("Failed to read static CSS: {}", e));
            }
        }

        Err(anyhow!(
            "CSS file '{}' for theme '{}' not found",
            file_name,
            theme_name
        ))
    }

    pub fn save_custom_theme(&self, theme_name: &str, theme_data: &ThemeManifest) -> Result<()> {
        let themes_dir = self.get_themes_directory()?;
        let theme_dir = themes_dir.join(theme_name);

        // Create theme directory
        println!(
            "[ThemeManager] Saving custom theme '{}' to {:?}",
            theme_name, theme_dir
        );
        fs::create_dir_all(&theme_dir)
            .map_err(|e| anyhow!("Failed to create theme directory: {}", e))?;

        // Save manifest
        let manifest_path = theme_dir.join("theme-manifest.json");
        let manifest_content = serde_json::to_string_pretty(theme_data)
            .map_err(|e| anyhow!("Failed to serialize theme manifest: {}", e))?;
        fs::write(&manifest_path, manifest_content)
            .map_err(|e| anyhow!("Failed to write theme manifest: {}", e))?;
        println!("[ThemeManager] Wrote manifest: {:?}", manifest_path);

        // Generate CSS files based on theme data
        self.generate_theme_css(&theme_dir, theme_data)?;

        Ok(())
    }

    pub fn delete_custom_theme(&self, theme_name: &str) -> Result<()> {
        let themes_dir = self.get_themes_directory()?;
        let theme_dir = themes_dir.join(theme_name);

        if theme_dir.exists() {
            fs::remove_dir_all(&theme_dir)
                .map_err(|e| anyhow!("Failed to delete theme directory: {}", e))?;
        }

        Ok(())
    }

    fn generate_theme_css(&self, theme_dir: &PathBuf, theme_data: &ThemeManifest) -> Result<()> {
        let styles_dir = theme_dir.join("styles");
        fs::create_dir_all(&styles_dir)
            .map_err(|e| anyhow!("Failed to create styles directory: {}", e))?;

        // Generate global.css
        let global_css = self.generate_global_css(theme_data);
        fs::write(styles_dir.join("global.css"), global_css)
            .map_err(|e| anyhow!("Failed to write global.css: {}", e))?;

        // Generate light.css
        let light_css = self.generate_light_css(theme_data);
        fs::write(styles_dir.join("light.css"), light_css)
            .map_err(|e| anyhow!("Failed to write light.css: {}", e))?;

        // Generate dark.css
        let dark_css = self.generate_dark_css(theme_data);
        fs::write(styles_dir.join("dark.css"), dark_css)
            .map_err(|e| anyhow!("Failed to write dark.css: {}", e))?;

        // Generate components.css
        let components_css = self.generate_components_css(theme_data);
        fs::write(styles_dir.join("components.css"), components_css)
            .map_err(|e| anyhow!("Failed to write components.css: {}", e))?;

        Ok(())
    }

    fn generate_global_css(&self, theme_data: &ThemeManifest) -> String {
        let mut css = String::new();

        // Add custom properties
        css.push_str(":root {\n");
        for (key, value) in &theme_data.custom_properties {
            css.push_str(&format!("  {}: {};\n", key, value));
        }

        // Add font properties
        if theme_data.features.custom_fonts {
            css.push_str(&format!(
                "  --font-primary: {};\n",
                theme_data.fonts.primary
            ));
            css.push_str(&format!(
                "  --font-secondary: {};\n",
                theme_data.fonts.secondary
            ));
            css.push_str(&format!(
                "  --font-monospace: {};\n",
                theme_data.fonts.monospace
            ));
            css.push_str(&format!(
                "  --font-display: {};\n",
                theme_data.fonts.display
            ));
        }

        // Add animation properties
        if theme_data.features.animations {
            css.push_str(&format!(
                "  --animation-duration: {};\n",
                theme_data.animations.duration
            ));
            css.push_str(&format!(
                "  --animation-easing: {};\n",
                theme_data.animations.easing
            ));
            css.push_str(&format!(
                "  --animation-scale: {};\n",
                theme_data.animations.scale
            ));
        }

        css.push_str("}\n\n");

        // Add global styles based on features
        if theme_data.features.glassmorphism {
            css.push_str(".glass {\n");
            css.push_str("  backdrop-filter: blur(10px);\n");
            css.push_str("  background: rgba(255, 255, 255, 0.1);\n");
            css.push_str("  border: 1px solid rgba(255, 255, 255, 0.2);\n");
            css.push_str("}\n\n");
        }

        if theme_data.features.animations {
            css.push_str(".animated {\n");
            css.push_str("  transition: all var(--animation-duration) var(--animation-easing);\n");
            css.push_str("}\n\n");

            css.push_str(".hover-scale:hover {\n");
            css.push_str("  transform: scale(var(--animation-scale));\n");
            css.push_str("}\n\n");
        }

        css
    }

    fn generate_light_css(&self, theme_data: &ThemeManifest) -> String {
        let mut css = String::new();

        if !theme_data.color_schemes.light.is_empty() {
            css.push_str(":root {\n");
            for (key, value) in &theme_data.color_schemes.light {
                css.push_str(&format!("  --{}: {};\n", key, value));
            }
            css.push_str("}\n\n");
        }

        css
    }

    fn generate_dark_css(&self, theme_data: &ThemeManifest) -> String {
        let mut css = String::new();

        if !theme_data.color_schemes.dark.is_empty() {
            css.push_str(".dark {\n");
            for (key, value) in &theme_data.color_schemes.dark {
                css.push_str(&format!("  --{}: {};\n", key, value));
            }
            css.push_str("}\n\n");
        }

        css
    }

    fn generate_components_css(&self, theme_data: &ThemeManifest) -> String {
        let mut css = String::new();

        // Generate component-specific styles based on theme features
        css.push_str("/* Component-specific theme styles */\n\n");

        // Button styles
        css.push_str(".btn {\n");
        css.push_str("  background: var(--accent-color);\n");
        css.push_str("  color: white;\n");
        css.push_str("  border: none;\n");
        css.push_str("  border-radius: 8px;\n");
        css.push_str("  padding: 8px 16px;\n");

        if theme_data.features.animations {
            css.push_str("  transition: all var(--animation-duration) var(--animation-easing);\n");
        }

        css.push_str("}\n\n");

        css.push_str(".btn:hover {\n");
        css.push_str("  background: var(--accent-hover);\n");

        if theme_data.features.animations {
            css.push_str("  transform: scale(var(--animation-scale));\n");
        }

        css.push_str("}\n\n");

        // Card styles
        css.push_str(".card {\n");
        css.push_str("  background: var(--surface-color);\n");
        css.push_str("  border: 1px solid var(--border-color);\n");
        css.push_str("  border-radius: 12px;\n");
        css.push_str("  padding: 16px;\n");

        if theme_data.features.glassmorphism {
            css.push_str("  backdrop-filter: blur(10px);\n");
            css.push_str("  background: rgba(255, 255, 255, 0.1);\n");
        }

        css.push_str("}\n\n");

        css
    }

    pub fn import_theme_from_file(&self, file_path: &str) -> Result<String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| anyhow!("Failed to read theme file: {}", e))?;

        let theme_data: ThemeManifest = serde_json::from_str(&content)
            .map_err(|e| anyhow!("Failed to parse theme file: {}", e))?;

        // Validate theme data
        self.validate_theme(&theme_data)?;

        // Save the theme
        self.save_custom_theme(&theme_data.name, &theme_data)?;

        Ok(theme_data.name)
    }

    fn validate_theme(&self, theme_data: &ThemeManifest) -> Result<()> {
        if theme_data.name.is_empty() {
            return Err(anyhow!("Theme name cannot be empty"));
        }

        // Display name defaults to name if empty (handled in deserialization)
        // We don't need to validate it separately

        if theme_data.version.is_empty() {
            return Err(anyhow!("Theme version cannot be empty"));
        }

        // Validate required custom properties
        let required_props = vec!["--background-color", "--text-color", "--accent-color"];
        for prop in required_props {
            if !theme_data.custom_properties.contains_key(prop) {
                return Err(anyhow!("Missing required property: {}", prop));
            }
        }

        Ok(())
    }
}

#[tauri::command]
pub async fn get_available_themes(app: AppHandle) -> Result<Vec<String>, String> {
    let theme_manager = ThemeManager::new(app);
    theme_manager
        .list_available_themes()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_custom_themes(app: AppHandle) -> Result<Vec<String>, String> {
    let theme_manager = ThemeManager::new(app);
    let mut result = Vec::new();
    if let Ok(dir) = theme_manager.get_themes_directory() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        if path.join("theme-manifest.json").exists()
                            || path.join("theme.manifest.json").exists()
                        {
                            result.push(name.to_string());
                        }
                    }
                }
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn read_theme_css(
    app: AppHandle,
    theme_name: String,
    file_name: String,
) -> Result<String, String> {
    let theme_manager = ThemeManager::new(app);
    theme_manager
        .read_theme_css(&theme_name, &file_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_theme_manifest(
    app: AppHandle,
    theme_name: String,
) -> Result<ThemeManifest, String> {
    let theme_manager = ThemeManager::new(app);
    theme_manager
        .load_theme_manifest(&theme_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_custom_theme(
    app: AppHandle,
    theme_name: String,
    theme_data: ThemeManifest,
) -> Result<(), String> {
    let theme_manager = ThemeManager::new(app);
    theme_manager
        .save_custom_theme(&theme_name, &theme_data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_custom_theme(app: AppHandle, theme_name: String) -> Result<(), String> {
    let theme_manager = ThemeManager::new(app);
    theme_manager
        .delete_custom_theme(&theme_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_theme_from_file(app: AppHandle, file_path: String) -> Result<String, String> {
    let theme_manager = ThemeManager::new(app);
    theme_manager
        .import_theme_from_file(&file_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_themes_directory_path(app: AppHandle) -> Result<String, String> {
    let theme_manager = ThemeManager::new(app);
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| e.to_string())?;
    Ok(themes_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn export_theme_to_file(
    file_path: String,
    theme_data: ThemeManifest,
) -> Result<(), String> {
    let theme_json = serde_json::to_string_pretty(&theme_data)
        .map_err(|e| format!("Failed to serialize theme data: {}", e))?;

    fs::write(&file_path, theme_json).map_err(|e| format!("Failed to write theme file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn download_and_install_theme(
    app: AppHandle,
    zip_url: String,
    _theme_id: String,
    theme_slug: String,
    checksum: Option<String>,
) -> Result<String, String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    let theme_dir = themes_dir.join(&theme_slug);

    println!(
        "[ThemeManager] Downloading theme {} from {}",
        theme_slug, zip_url
    );

    // 1. Download ZIP from URL using the global client (handles school networks/SSL)
    use crate::netgrab;
    let client = netgrab::create_client();

    let response = client
        .get(&zip_url)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("Failed to download ZIP: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let zip_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read ZIP bytes: {}", e))?;

    // 2. Verify checksum if provided
    if let Some(expected_checksum) = checksum {
        let mut hasher = Sha256::new();
        hasher.update(&zip_bytes);
        let computed_hash = hex::encode(hasher.finalize());
        
        // Remove "sha256:" prefix if present
        let expected_hash = expected_checksum
            .strip_prefix("sha256:")
            .unwrap_or(&expected_checksum)
            .to_lowercase();

        if computed_hash.to_lowercase() != expected_hash {
            return Err(format!(
                "Checksum mismatch. Expected: {}, Got: {}",
                expected_hash, computed_hash
            ));
        }
        println!("[ThemeManager] Checksum verified successfully");
    }

    // 3. Extract ZIP to app data themes directory
    let mut archive = ZipArchive::new(std::io::Cursor::new(&zip_bytes))
        .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    // Remove existing theme directory if it exists
    if theme_dir.exists() {
        println!("[ThemeManager] Removing existing theme directory: {:?}", theme_dir);
        fs::remove_dir_all(&theme_dir)
            .map_err(|e| format!("Failed to remove existing theme: {}", e))?;
    }

    // Create theme directory
    fs::create_dir_all(&theme_dir)
        .map_err(|e| format!("Failed to create theme directory: {}", e))?;

    // Extract all files from ZIP
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file {} from ZIP: {}", i, e))?;

        let file_path = match file.enclosed_name() {
            Some(path) => path,
            None => continue,
        };

        // Remove the root folder name if ZIP contains {theme-slug}/ structure
        let relative_path = if file_path.starts_with(&theme_slug) {
            file_path.strip_prefix(&format!("{}/", theme_slug))
                .unwrap_or(file_path)
        } else {
            file_path
        };

        let outpath = theme_dir.join(relative_path);

        // Create parent directories if needed
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {:?}: {}", parent, e))?;
        }

        // Skip directories
        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {:?}: {}", outpath, e))?;
            continue;
        }

        // Extract file
        let mut outfile = fs::File::create(&outpath)
            .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
        std::io::copy(&mut file, &mut outfile)
            .map_err(|e| format!("Failed to write file {:?}: {}", outpath, e))?;
    }

    println!("[ThemeManager] Theme extracted successfully to: {:?}", theme_dir);

    // 4. Validate structure (check for theme-manifest.json)
    let manifest_path = theme_dir.join("theme-manifest.json");
    if !manifest_path.exists() {
        return Err(format!(
            "Theme manifest not found at {:?}. Invalid theme structure.",
            manifest_path
        ));
    }

    // 5. Return theme slug - frontend will load manifest using existing load_theme_manifest command
    Ok(theme_slug)
}

#[tauri::command]
pub async fn download_theme_to_temp(
    app: AppHandle,
    zip_url: String,
    theme_slug: String,
    checksum: Option<String>,
) -> Result<String, String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    // Use .temp subfolder for temporary preview themes
    let temp_dir = themes_dir.join(".temp");
    let theme_dir = temp_dir.join(&theme_slug);

    println!(
        "[ThemeManager] Downloading theme {} to temp folder from {}",
        theme_slug, zip_url
    );

    // 1. Download ZIP from URL using the global client (handles school networks/SSL)
    use crate::netgrab;
    let client = netgrab::create_client();

    let response = client
        .get(&zip_url)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("Failed to download ZIP: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let zip_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read ZIP bytes: {}", e))?;

    // 2. Verify checksum if provided
    if let Some(expected_checksum) = checksum {
        let mut hasher = Sha256::new();
        hasher.update(&zip_bytes);
        let computed_hash = hex::encode(hasher.finalize());
        
        // Remove "sha256:" prefix if present
        let expected_hash = expected_checksum
            .strip_prefix("sha256:")
            .unwrap_or(&expected_checksum)
            .to_lowercase();

        if computed_hash.to_lowercase() != expected_hash {
            return Err(format!(
                "Checksum mismatch. Expected: {}, Got: {}",
                expected_hash, computed_hash
            ));
        }
        println!("[ThemeManager] Checksum verified successfully");
    }

    // 3. Extract ZIP to temp directory
    let mut archive = ZipArchive::new(std::io::Cursor::new(&zip_bytes))
        .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    // Remove existing temp theme directory if it exists
    if theme_dir.exists() {
        println!("[ThemeManager] Removing existing temp theme directory: {:?}", theme_dir);
        fs::remove_dir_all(&theme_dir)
            .map_err(|e| format!("Failed to remove existing temp theme: {}", e))?;
    }

    // Create temp directory
    fs::create_dir_all(&theme_dir)
        .map_err(|e| format!("Failed to create temp theme directory: {}", e))?;

    // Extract all files from ZIP
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file {} from ZIP: {}", i, e))?;

        let file_path = match file.enclosed_name() {
            Some(path) => path,
            None => continue,
        };

        // Remove the root folder name if ZIP contains {theme-slug}/ structure
        let relative_path = if file_path.starts_with(&theme_slug) {
            file_path.strip_prefix(&format!("{}/", theme_slug))
                .unwrap_or(file_path)
        } else {
            file_path
        };

        let outpath = theme_dir.join(relative_path);

        // Create parent directories if needed
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {:?}: {}", parent, e))?;
        }

        // Skip directories
        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {:?}: {}", outpath, e))?;
            continue;
        }

        // Extract file
        let mut outfile = fs::File::create(&outpath)
            .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
        std::io::copy(&mut file, &mut outfile)
            .map_err(|e| format!("Failed to write file {:?}: {}", outpath, e))?;
    }

    println!("[ThemeManager] Theme extracted successfully to temp: {:?}", theme_dir);

    // 4. Validate structure (check for theme-manifest.json)
    let manifest_path = theme_dir.join("theme-manifest.json");
    if !manifest_path.exists() {
        return Err(format!(
            "Theme manifest not found at {:?}. Invalid theme structure.",
            manifest_path
        ));
    }

    // 5. Return theme slug with .temp prefix for identification
    Ok(format!(".temp/{}", theme_slug))
}

#[tauri::command]
pub async fn cleanup_temp_theme(
    app: AppHandle,
    theme_slug: String,
) -> Result<(), String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    let temp_dir = themes_dir.join(".temp");
    let theme_dir = temp_dir.join(&theme_slug);

    if theme_dir.exists() {
        println!("[ThemeManager] Cleaning up temp theme: {:?}", theme_dir);
        fs::remove_dir_all(&theme_dir)
            .map_err(|e| format!("Failed to remove temp theme: {}", e))?;
        println!("[ThemeManager] Temp theme cleaned up successfully");
    }

    Ok(())
}

#[tauri::command]
pub async fn cache_theme_image(
    app: AppHandle,
    image_url: String,
    theme_id: String,
    image_type: String, // "thumbnail" or "screenshot"
    image_index: Option<usize>, // For screenshots
) -> Result<String, String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    let images_dir = themes_dir.join("images");
    
    // Create images directory if it doesn't exist
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create images directory: {}", e))?;

    // Generate filename based on theme_id, image_type, and optional index
    let filename = if let Some(index) = image_index {
        format!("{}_{}_{}.jpg", theme_id, image_type, index)
    } else {
        format!("{}_{}.jpg", theme_id, image_type)
    };
    
    let cached_path = images_dir.join(&filename);

    println!(
        "[ThemeManager] Caching theme image {} to {:?}",
        image_url, cached_path
    );

    // Download image using netgrab client (handles school networks/SSL)
    use crate::netgrab;
    let client = netgrab::create_client();

    let response = client
        .get(&image_url)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("Failed to download image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let image_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    // Write image to cache
    fs::write(&cached_path, &image_bytes)
        .map_err(|e| format!("Failed to write cached image: {}", e))?;

    println!("[ThemeManager] Image cached successfully to {:?}", cached_path);

    // Return the cached path as a string (relative to themes directory)
    Ok(format!("images/{}", filename))
}

#[tauri::command]
pub async fn get_cached_image_path(
    app: AppHandle,
    theme_id: String,
    image_type: String,
    image_index: Option<usize>,
    updated_at: Option<u64>, // Unix timestamp
) -> Result<Option<String>, String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    let images_dir = themes_dir.join("images");

    // Generate filename
    let filename = if let Some(index) = image_index {
        format!("{}_{}_{}.jpg", theme_id, image_type, index)
    } else {
        format!("{}_{}.jpg", theme_id, image_type)
    };
    
    let cached_path = images_dir.join(&filename);

    // Check if cached image exists
    if !cached_path.exists() {
        return Ok(None);
    }

    // If updated_at is provided, check if cache is stale
    if let Some(updated_at_ts) = updated_at {
        if let Ok(metadata) = fs::metadata(&cached_path) {
            if let Ok(modified_time) = metadata.modified() {
                if let Ok(duration_since_epoch) = modified_time.duration_since(std::time::UNIX_EPOCH) {
                    let cached_timestamp = duration_since_epoch.as_secs();
                    // If cached image is older than updated_at, it's stale
                    if cached_timestamp < updated_at_ts {
                        println!(
                            "[ThemeManager] Cached image is stale (cached: {}, updated: {})",
                            cached_timestamp, updated_at_ts
                        );
                        return Ok(None);
                    }
                }
            }
        }
    }

    // Return the cached path (relative to themes directory)
    Ok(Some(format!("images/{}", filename)))
}

#[tauri::command]
pub async fn get_cached_image_url(
    app: AppHandle,
    theme_id: String,
    image_type: String,
    image_index: Option<usize>,
) -> Result<Option<String>, String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    let themes_dir_str = themes_dir.to_string_lossy().to_string();
    
    let images_dir = themes_dir.join("images");

    // Generate filename
    let filename = if let Some(index) = image_index {
        format!("{}_{}_{}.jpg", theme_id, image_type, index)
    } else {
        format!("{}_{}.jpg", theme_id, image_type)
    };
    
    let cached_path = images_dir.join(&filename);

    // Check if cached image exists
    if !cached_path.exists() {
        return Ok(None);
    }

    // Return file:// URL for the cached image
    // Convert to absolute path and normalize separators
    let absolute_path = cached_path.canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;
    let path_str = absolute_path.to_string_lossy().replace('\\', "/");
    
    // On Windows, file:// URLs need 3 slashes, on Unix they need 3 slashes too
    Ok(Some(format!("file:///{}", path_str)))
}

#[tauri::command]
pub async fn invalidate_theme_image_cache(
    app: AppHandle,
    theme_id: String,
) -> Result<(), String> {
    let theme_manager = ThemeManager::new(app.clone());
    let themes_dir = theme_manager
        .get_themes_directory()
        .map_err(|e| format!("Failed to get themes directory: {}", e))?;

    let images_dir = themes_dir.join("images");

    if !images_dir.exists() {
        return Ok(()); // No cache directory, nothing to invalidate
    }

    println!("[ThemeManager] Invalidating image cache for theme: {}", theme_id);

    // Delete thumbnail
    let thumbnail_path = images_dir.join(format!("{}_thumbnail.jpg", theme_id));
    if thumbnail_path.exists() {
        fs::remove_file(&thumbnail_path)
            .map_err(|e| format!("Failed to remove thumbnail: {}", e))?;
        println!("[ThemeManager] Removed cached thumbnail: {:?}", thumbnail_path);
    }

    // Delete screenshots (try first 20 to cover most cases)
    for i in 0..20 {
        let screenshot_path = images_dir.join(format!("{}_screenshot_{}.jpg", theme_id, i));
        if screenshot_path.exists() {
            fs::remove_file(&screenshot_path)
                .map_err(|e| format!("Failed to remove screenshot {}: {}", i, e))?;
            println!("[ThemeManager] Removed cached screenshot {}: {:?}", i, screenshot_path);
        }
    }

    Ok(())
}
