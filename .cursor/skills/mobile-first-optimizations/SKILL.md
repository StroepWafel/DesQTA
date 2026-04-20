---
name: mobile-first-optimizations
description: Optimize DesQTA for mobile-first UX on Tauri Android/iOS. Use when improving mobile layout, navigation, touch targets, safe areas, or when the user asks for mobile-first changes, responsive design for phones, or native mobile feel.
---

# Mobile-First Optimizations

## Platform Detection

**Always use `platformStore`** for mobile detection. Do not add local `isMobile` state or `checkMobile()` in components.

```typescript
import { platformStore } from '$lib/stores/platform';

let isMobile = $derived($platformStore.isMobile);
let isNativeMobile = $derived($platformStore.isNativeMobile);
```

- `isMobile`: true when native mobile (Android/iOS) OR viewport ≤ 640px
- `isNativeMobile`: true only on Tauri iOS/Android
- Breakpoint: 640px (Tailwind `sm`)

Call `platformStore.checkPlatform()` in layout `onMount`; subscribe via `$platformStore` for reactivity.

## Layout Patterns

| Context | Desktop | Mobile |
|---------|---------|--------|
| **Navigation** | Sidebar + header hamburger | Bottom nav (`MobileBottomNav`) + "More" tab opens sidebar |
| **Header** | Hamburger, weather, questionnaire | Logo + search only; no hamburger (use bottom nav "More") |
| **Sidebar** | Open by default | Closed by default; overlay when open |
| **Main content** | `rounded-br-2xl` | Full-bleed, no rounded corners |
| **Content padding** | Standard | `pb-[56px]` to clear fixed bottom nav |

## Key Files

- `src/lib/stores/platform.ts` – platform detection
- `src/lib/components/MobileBottomNav.svelte` – bottom nav (visible when `isMobile && !needsSetup`)
- `src/routes/+layout.svelte` – shell, sidebar state, mobile effects
- `src/lib/components/AppHeader.svelte` – receives `isMobile`, hides hamburger/weather on mobile
- `src/lib/components/AppSidebar.svelte` – overlay on mobile, `min-h-[44px]` on links

## Touch Targets

- Minimum **44px** height for interactive elements (`min-h-[44px]`)
- Use `transition-all duration-200` and `active:scale-95` for tap feedback
- In `app.css`: `touch-action: manipulation` on `button`, `a`, `[role="button"]` for coarse pointers (removes 300ms tap delay)

## Safe Areas

- **Top**: Use `var(--safe-area-top)` for status bar (root layout)
- **Bottom**: Android handles gesture bar; do NOT add `--safe-area-bottom` to nav or main content padding
- `app.css` defines `--safe-area-top` and `--safe-area-bottom`; only top is used in layout
- `viewport-fit=cover` in `app.html` for iOS webview

## Sidebar on Mobile

- Closed by default on load/refresh (effect in layout)
- Opens via bottom nav "More" tab
- Clicking a menu item or overlay closes it (`handlePageNavigation` sets `sidebarOpen = false` when `isMobile`)
- `AppSidebar` calls `onMenuItemClick` on all links

## Responsive Components

- **WidgetGrid**: Single column, `disableDrag`/`disableResize` on mobile
- **Timetable**: Default to `day` view on mobile, `week` on desktop
- **Courses/RSS pages**: Local sidebar closed by default on mobile; `$effect` syncs `sidebarOpen = !isMobile`

## Checklist for New Mobile Features

- [ ] Use `$platformStore.isMobile` (not local state)
- [ ] Touch targets ≥ 44px
- [ ] Hide desktop-only UI when `isMobile`
- [ ] No extra bottom safe-area padding (Android handles it)
- [ ] i18n keys for any new strings
- [ ] Test in Android emulator (`pnpm tauri android dev`)
