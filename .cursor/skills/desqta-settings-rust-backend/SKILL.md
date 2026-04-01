---
name: desqta-settings-rust-backend
description: Add new settings to the Rust backend so they persist. Use when adding a new setting, config option, or when settings are not saving correctly.
---

# DesQTA Settings – Rust Backend

When adding a new setting that persists, it must be added to the Rust backend. Settings that only exist in the frontend will not save.

## Checklist

1. **Settings struct** (`src-tauri/src/utils/settings.rs`)
2. **Default impl** (`impl Default for Settings`)
3. **Load/merge logic** (where existing JSON is read)

## Add a New Setting

### 1. Add to Settings Struct

```rust
#[serde(default)]
pub your_setting: Option<Vec<String>>,  // or bool, String, etc.
```

### 2. Add to Default impl

```rust
your_setting: None,  // or false, String::new(), etc.
```

### 3. Add Load Logic

Find where similar settings are loaded (e.g. `sidebar_favorites`). Use the appropriate helper:

```rust
// For Option<Vec<String>>
default_settings.your_setting = get_opt_string_array(&existing_json, "your_setting");

// For bool
default_settings.your_setting = get_bool(&existing_json, "your_setting", default_settings.your_setting);

// For Option<String>
default_settings.your_setting = get_opt_string(&existing_json, "your_setting");
```

### 4. Frontend

- Use `saveSettingsWithQueue({ your_setting: value })` to save
- Use `get_settings_subset({ keys: ['your_setting'] })` or `loadSettings(['your_setting'])` to load

## Save Flow

`saveSettingsWithQueue` → `invoke('save_settings_merge', { patch })` → merges into Settings → saves to disk.

## Reference

- `src-tauri/src/utils/settings.rs` – Settings struct, Default, load logic
- `disabled_sidebar_pages` – Example of adding `Option<Vec<String>>`
