---
name: desqta-sidebar-customization
description: Add new sidebar customization features like hiding pages, reordering, or folders. Use when extending the Customize Sidebar dialog, adding menu visibility toggles, or modifying sidebar behavior.
---

# DesQTA Sidebar Customization

## Key Files

- `src/lib/components/SidebarSettingsDialog.svelte` – Customize Sidebar UI
- `src/routes/+layout.svelte` – `applyMenuOrder`, loads menu, filters disabled pages
- `src-tauri/src/utils/settings.rs` – `menu_order`, `sidebar_folders`, `sidebar_favorites`, `disabled_sidebar_pages`

## Adding a "Disable Page" Feature

### 1. Rust Backend

Add `disabled_sidebar_pages: Option<Vec<String>>` to Settings (struct, Default, load logic). See `desqta-settings-rust-backend` skill.

### 2. Layout Filter

In `applyMenuOrder`, load `disabled_sidebar_pages` and filter:

```typescript
const disabledPages = (settings.disabled_sidebar_pages as string[] | undefined) || [];
const disabledSet = new Set(disabledPages);
menu = orderedMenu.filter(
  (item) => !disabledSet.has(item.path) || item.path === '/settings',
);
```

**Important:** Never allow disabling `/settings`—users must be able to re-enable pages.

### 3. SidebarSettingsDialog

- Load `disabled_sidebar_pages` in `loadConfig`
- Add state: `let disabledPages = $state<string[]>([]);`
- Add toggle: `togglePageVisible(path)` – add/remove from `disabledPages`
- Add Eye/EyeSlash button per item (except Settings)
- Save `disabled_sidebar_pages` in `handleSave` and `resetToDefault`
- Visually dim disabled items: `opacity-60 border-amber-200/50` when disabled

### 4. i18n

Add `hide_from_sidebar`, `show_in_sidebar` to settings section.

## Existing Patterns

- **menu_order** – Reorder menu items
- **sidebar_folders** – Group items into folders
- **sidebar_favorites** – Star items
- **disabled_sidebar_pages** – Hide items from sidebar
