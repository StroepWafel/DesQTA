---
name: desqta-page-redesign-consistency
description: Redesign DesQTA pages to match the consistent layout and styling used on courses, directory, and analytics. Use when redesigning a page, making pages look consistent, or when the user asks for page layout updates to match other pages.
---

# DesQTA Page Redesign Consistency

## Standard Page Layout

When redesigning a page to match courses, directory, and analytics:

### 1. Root Container

```svelte
<div class="container max-w-none w-full p-5 mx-auto flex flex-col h-full gap-6" in:fade={{ duration: 400 }}>
```

- Use `container max-w-none w-full p-5 mx-auto`
- Use `flex flex-col h-full gap-6` for pages with scrollable content
- Use `space-y-6` for simpler pages
- Add `in:fade={{ duration: 400 }}` for page-level fade-in

### 2. Page Header

```svelte
<div class="shrink-0">
  <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
    <T key="..." fallback="Page Title" />
  </h1>
  <p class="text-zinc-600 dark:text-zinc-400">
    <T key="...page_description" fallback="Short description." />
  </p>
</div>
```

### 3. Card-Style Panels

For panels, sidebars, and content areas:

```
rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-900/60 shadow-lg overflow-hidden
```

### 4. Scrollable Content

- Parent: `flex-1 min-h-0 overflow-hidden` (allows flex child to shrink)
- Scroll child: `flex-1 min-h-0 overflow-y-auto` (not `flex-none`—that breaks scroll)
- Use `[scrollbar-gutter:stable]` for stable layout

### 5. i18n

Add `page_description` key to the page's section in `en.json` and other locale files.

## Reference Pages

- `src/routes/courses/+page.svelte` – Full layout with sidebar
- `src/routes/directory/+page.svelte` – Simpler layout with fade
- `src/routes/analytics/+page.svelte` – Filters and card layout
- `src/routes/direqt-messages/+page.svelte` – Multi-panel layout
