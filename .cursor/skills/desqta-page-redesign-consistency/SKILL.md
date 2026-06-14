---
name: desqta-page-redesign-consistency
description: Redesign DesQTA pages to match the consistent Lo-fi-inspired layout used on courses, directory, and analytics. Use when redesigning a page, making pages look consistent, or when the user asks for page layout updates to match other pages.
---

# DesQTA Page Redesign Consistency (Lo-fi)

The current visual language is Lo-fi UI inspired: clear hierarchy, generous whitespace, opaque surfaces, calm neutrals, one accent. Cards are NOT translucent and do NOT use `backdrop-blur`.

## Standard Page Layout

### 1. Root container

```svelte
<div class="container mx-auto w-full max-w-none p-5 sm:p-8 flex flex-col gap-6" in:fade={{ duration: 250 }}>
```

- Use `container mx-auto w-full max-w-none p-5 sm:p-8`.
- Use `flex flex-col gap-6` (preferred) or `space-y-6`.
- Use `max-w-3xl xl:max-w-4xl` for reading pages (notices, news, user-documentation).
- Add `in:fade={{ duration: 250 }}` for page-level fade-in. Calmer than the old 400ms.

### 2. Page header (editorial)

```svelte
<header class="flex flex-col gap-1.5">
  <p class="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
    Section
  </p>
  <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
    <T key="navigation.foo" fallback="Page title" />
  </h1>
  <p class="text-sm text-muted-foreground max-w-2xl">
    <T key="foo.description" fallback="Short description." />
  </p>
</header>
```

- Use a small uppercase tracked **eyebrow label** above the h1 (e.g. "Schedule", "Reading", "Insights").
- `h1` uses `text-3xl sm:text-4xl font-semibold tracking-tight text-foreground`.
- Description: `text-sm text-muted-foreground max-w-2xl`.
- If the header has trailing actions (filters, year picker, etc.) make the header `flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`.

### 3. Card-style panels (Lo-fi)

```
bg-card border border-border rounded-xl
```

- Opaque `bg-card` — never `bg-white/80` or `bg-zinc-900/60`.
- 1px `border-border`. Hairline dividers use `border-border-subtle`.
- Optional subtle shadow only on elevated cards: `shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_2px_8px_-4px_rgba(0,0,0,0.06)]`.
- No `backdrop-blur`. No `bg-linear-to-*`.
- Prefer using `ui/Card.svelte` rather than rolling your own.

### 4. Typography utilities

- `.nums-tabular` — apply to grades, dates, counters so columns align.
- `text-foreground` / `text-muted-foreground` / `text-card-foreground` — never raw `text-zinc-*`.
- Eyebrow labels: `text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground`.

### 5. Scrollable content

- Parent: `flex-1 min-h-0 overflow-hidden`.
- Scroll child: `flex-1 min-h-0 overflow-y-auto`.
- Avoid `flex-none` on the scroll container.
- Use `[scrollbar-gutter:stable]` for stable layout where needed.

### 6. i18n

Add `page_description` key to the page's section in `en.json` and other locale files.

## Things to remove when migrating an older page

- `text-zinc-900 dark:text-white` → `text-foreground`.
- `text-zinc-600 dark:text-zinc-400` → `text-muted-foreground`.
- `bg-white/80 dark:bg-zinc-900/60` → `bg-card`.
- `border-zinc-200/50 dark:border-zinc-700/50` → `border-border` or `border-border-subtle`.
- `shadow-lg` / `shadow-2xl` on cards → drop, or use the subtle shadow above.
- `hover:scale-105 active:scale-95` → drop; use `hover:bg-surface-muted` instead.
- `backdrop-blur-md` / `backdrop-blur-xl` → drop.
- `bg-linear-to-*` gradients on surfaces → drop.
- Page-level `in:fade={{ duration: 400 }}` → 250.

## Reference pages

- `src/routes/+page.svelte` – Dashboard editorial header
- `src/routes/courses/+page.svelte` – Full layout with sidebar
- `src/routes/directory/+page.svelte` – Header + trailing actions
- `src/routes/analytics/+page.svelte` – Filters and card layout
- `src/routes/direqt-messages/+page.svelte` – Multi-panel layout
- `src/routes/notices/+page.svelte` – Reading layout with date input
