---
name: soft-rich-ui-patterns
description: Apply soft, organic, and premium UI patterns to create a refined user experience. Use when styling data visualizations, page layouts, article content, RSS feeds, semi-transparent panels, or when the user asks for a soft, rich, premium, or meticulously designed feel.
---

# Soft & Rich UI Patterns

Apply these patterns to achieve a premium, soft, and meticulously designed feel, avoiding rigid or mechanical aesthetics. These are directly inspired by the highly refined `Analytics` page.

## 1. Soft, Organic Data Visualization

- **Natural Curves:** Instead of jagged, straight lines connecting data points, use `curveNatural` (e.g., from d3-shape) for a flowing, organic line that feels elegant and less harsh.
- **Rich Gradients:** Area fills should never be flat. Use a `<linearGradient>` that fades from higher opacity at the top (e.g., 80%) to almost transparent at the bottom (e.g., 10%). This grounds the visual while maintaining an airy, translucent feel.
- **Subtle Stroke Weight:** Use `stroke-2` for chart lines. It is delicate enough to look refined but thick enough to be legible against gradient fills.

## 2. Premium Motion & Easing

- **Material Easing:** Map custom animations (e.g., `@keyframes fadeInUp`) to `cubic-bezier(0.4, 0, 0.2, 1)`. This curve starts quickly and decelerates smoothly, feeling natural and grounded rather than mechanical.
- **Staggered Sequential Loading:** Elements should appear sequentially rather than all at once. Use deliberate animation delays (e.g., 0ms, 100ms, 200ms) to create a sophisticated visual hierarchy as the user reads down the page.
- **Chart Reveal:** Use sweeping reveal animations over longer durations (e.g., 1000ms with `cubicInOut` easing) to match the mental model of a timeline progressing.

## 3. Polished States and Micro-interactions

- **Elegant Loading Spinners:** Avoid generic default spinners. Use a semi-transparent track (e.g., `border-accent-600/30`) with a solid leading edge (`border-t-accent-600`) so it feels deeply integrated into the specific UI theme.
- **Non-intrusive Indicators:** Indicate background tasks with subtle, pulsing badges (`animate-pulse`) and miniature spinners that inform the user without alarming them or locking the UI.
- **Rich Empty States:** Fall back to dedicated `<EmptyState>` components with custom iconography. This ensures the layout remains beautiful and structured even when there is no data to display.

## 4. Typography and Depth

- **Color Contrast Hierarchy:** Establish a soft hierarchy for text. Primary headers should use bold contrast (`text-zinc-900 dark:text-white`), while secondary text and descriptions use softer, recessed tones (`text-zinc-600 dark:text-zinc-400`). This prevents the UI from feeling "loud."
- **Card Encapsulation:** Wrap complex content in standard `<Card.Root>` elements to naturally provide structural padding, subtle borders, and consistent shadows. This lifts the content off the background canvas to create depth without relying on heavy drop-shadows.
- **Contextual Micro-UI:** Use conditional formatting for small details, like trending indicators with specific green/red text colors and naturally scaled icons (`size-4`), providing immediate context at a glance without cluttering the page.

## 5. Semi-Transparent Panels and Glassmorphism

- **Translucent Backgrounds:** Use `bg-white/20 dark:bg-zinc-900/20` (or lighter `bg-white/80` for more opacity) for panels that sit over the page background. Avoid solid opaque fills when a softer, layered feel is desired.
- **Backdrop Blur:** Pair semi-transparent backgrounds with `backdrop-blur-md` for a frosted-glass effect that maintains readability while letting the background show through.
- **List Items:** Use very subtle bases (`bg-white/5 dark:bg-zinc-900/5`) with hover (`hover:bg-white/20 dark:hover:bg-zinc-900/20`) and selected states (`bg-accent/10 dark:bg-accent/15`). Avoid heavy grey fills.

## 6. Article and Content Layouts

- **Article Headers:** Use a proper `<header>` with semantic hierarchy: `<h1>` for the title (`text-2xl sm:text-3xl font-bold leading-tight tracking-tight`), metadata row (source · date) in `text-sm text-zinc-500 dark:text-zinc-400`, and a subtle divider (`h-px bg-zinc-200/60 dark:bg-zinc-700/50`) before the body.
- **Spacing:** Apply consistent padding: `px-6 sm:px-8` for horizontal, `pt-6 pb-6 sm:pt-8 sm:pb-8` for header blocks, `pb-8 sm:pb-12` for content bottom.
- **Readable Body:** For article content (e.g., in iframes), use `max-width: 65ch`, `line-height: 1.75`, `font-size: 16px`, and `p { margin: 0 0 1.25em }` for comfortable reading.

## 7. Flex Layouts and Truncation

- **Prevent Overflow:** Add `min-w-0 overflow-hidden` to flex children that contain truncatable text. Without `min-w-0`, flex items won't shrink below content size and text will be cut off.
- **Truncation Chain:** Ensure the chain from container → content wrapper → text spans has `min-w-0` and `overflow-hidden` where needed. Use `line-clamp-1` or `truncate` on text that should ellipsize.

## Implementation Checklist

- [ ] Are lines and connections organic (curved) rather than sharp/jagged?
- [ ] Do fills use multi-stop gradients that fade smoothly into the background?
- [ ] Are entry animations staggered with natural easing (`cubic-bezier(0.4, 0, 0.2, 1)`)?
- [ ] Do loading, syncing, and empty states look as polished as the populated data states?
- [ ] Is there a clear, soft color contrast hierarchy in the typography?
- [ ] Is complex content appropriately encapsulated in cards to create subtle depth?
- [ ] Do panels use semi-transparent backgrounds with backdrop blur when a soft, layered feel is desired?
- [ ] Do article/content views have proper headers (title, metadata, divider) and consistent spacing?
- [ ] Do flex layouts use `min-w-0 overflow-hidden` where text truncation is needed?