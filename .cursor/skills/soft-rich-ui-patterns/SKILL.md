---
name: soft-rich-ui-patterns
description: Apply soft, calm UI patterns to create a refined Lo-fi-inspired user experience. Use when styling data visualizations, page layouts, article content, RSS feeds, or panels.
---

# Soft & Rich UI Patterns (Lo-fi era)

DesQTA's current visual language is Lo-fi UI inspired: clear hierarchy, generous whitespace, opaque surfaces, calm neutrals, one accent. These patterns apply that philosophy to data viz, reading content, and panels — no glassmorphism, no `backdrop-blur`, no playful overshoot easing.

## 1. Calm, opaque surfaces

- Panels are **opaque**: `bg-card border border-border rounded-xl`. Never `bg-white/80` / `bg-zinc-900/60` translucency.
- Hairline dividers: `border-border-subtle`.
- Wells / inset panels: `bg-surface-muted`.
- Elevated cards get **one** subtle shadow: `shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_2px_8px_-4px_rgba(0,0,0,0.06)]`. Nothing more.
- No `backdrop-blur`. No `bg-linear-to-*` gradients on surfaces.

## 2. Restrained data visualization

- Lines: use `stroke-2` (refined but legible). Prefer `curveNatural` for trend lines.
- Area fills: a single linear gradient from accent (~30–50% opacity) at the top to transparent at the bottom. Keep colors muted — let the **shape** do the work.
- Axis ticks and gridlines: `border-border-subtle`, very low contrast. They should disappear unless you look for them.
- Numbers always use `.nums-tabular` so columns align.

## 3. Calm motion

- Default easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Page fades: 250ms (was 400). Element fades: 150–200ms.
- No `hover:scale-105`. Use `hover:bg-surface-muted` or `hover:border-border-strong` for hover affordance.
- Stagger only if it genuinely aids comprehension (e.g. revealing a chart). Otherwise everything appears together calmly.

## 4. Polished states

- Loading: use the `WidgetCard` skeleton (`bg-surface-muted animate-pulse` bars) or a small spinner: `border-2 border-accent-500/30 border-t-accent-500 animate-spin`.
- Empty states: small `Icon`, calm message, optional CTA. Use `dashboard/WidgetCard.svelte`'s built-in `empty` slot where possible.
- Inline indicators (e.g. "Saving…"): `text-[10px] uppercase tracking-[0.06em] font-semibold text-muted-foreground`.

## 5. Reading content (notices, news, forums, user-documentation)

- Narrow container: `container mx-auto w-full max-w-3xl xl:max-w-4xl p-5 sm:p-8`.
- Body text: `text-sm leading-relaxed` for descriptions, `prose` from the typography plugin for rich content.
- Article hero images: `bg-surface-muted` placeholder; soft gradient overlay (`from-black/75 via-black/30 to-transparent`) only when text sits on top of the image.

## 6. Typography hierarchy

- Eyebrow labels: `text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground`.
- h1: `text-3xl sm:text-4xl font-semibold tracking-tight text-foreground`.
- h2 / card title: `text-sm font-semibold tracking-tight text-foreground`.
- Body: `text-sm text-foreground` (primary) / `text-muted-foreground` (secondary).
- Never use raw `text-zinc-*` classes — use the semantic tokens.

## Anti-patterns to remove

- `bg-white/80 dark:bg-zinc-900/60`
- `backdrop-blur-md` / `backdrop-blur-xl`
- `shadow-lg` / `shadow-2xl` on default cards
- `hover:scale-105 active:scale-95` chains
- `bg-linear-to-*` gradients on regular panels
- `text-zinc-900 dark:text-white` and `text-zinc-600 dark:text-zinc-400` direct usage
- Animation durations longer than 300ms outside of intentionally orchestrated reveals
