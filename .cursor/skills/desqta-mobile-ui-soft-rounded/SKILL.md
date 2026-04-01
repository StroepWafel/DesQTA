---
name: desqta-mobile-ui-soft-rounded
description: Apply soft, rounded mobile UI styling for a native feel. Use when improving mobile layout, bottom nav, header, safe areas, or when the user asks for mobile UI to be less square and more rounded.
---

# DesQTA Mobile UI – Soft & Rounded

## Key Patterns

### 1. Bottom Nav (`MobileBottomNav`)

- Rounded top corners in `app.css`:

```css
@media (max-width: 768px) {
  .mobile-bottom-nav {
    border-radius: 1.5rem 1.5rem 0 0;
    border-top: none;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.06);
  }
}
```

- Nav item buttons: `rounded-2xl` (not `rounded-lg`)

### 2. Header & Main Content

- Header on mobile: `rounded-b-2xl`
- Main content on mobile: `rounded-t-2xl overflow-hidden`

### 3. Softer Radius for Cards

Add `mobile-soft` to the scroll container when mobile. In `app.css`:

```css
@media (max-width: 768px) {
  .mobile-soft .rounded-lg { border-radius: 1rem; }
  .mobile-soft .rounded-xl { border-radius: 1.25rem; }
  .mobile-soft .rounded-2xl { border-radius: 1.5rem; }
}
```

### 4. iOS Safe Areas

In `app.css`, `.platform-ios` adds buffer to safe areas. Adjust `+6px` (or `+12px`) for top/bottom:

```css
.platform-ios {
  --safe-area-top: calc(var(--safe-area-inset-top, ...) + 6px);
  --safe-area-bottom: calc(var(--safe-area-inset-bottom, ...) + 6px);
}
```

### 5. Files to Touch

- `src/app.css` – Mobile media queries, `.mobile-bottom-nav`, `.platform-ios`, `.mobile-soft`
- `src/lib/components/MobileBottomNav.svelte` – Nav item styling
- `src/lib/components/AppHeader.svelte` – `rounded-b-2xl` when `isMobile`
- `src/routes/+layout.svelte` – Main `rounded-t-2xl`, `mobile-soft` on scroll div
