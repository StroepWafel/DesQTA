---
name: desqta-flex-scroll-fix
description: Fix scrollable content inside flex containers. Use when a list or content area is not scrollable, or when overflow-y-auto does not work inside a flex layout.
---

# DesQTA Flex Scroll Fix

When content inside a flex container should scroll but doesn't, the parent chain is usually wrong.

## Problem

- Child has `overflow-y-auto` but doesn't scroll
- Parent uses `flex-none` so child sizes to content and never gets a constrained height

## Solution

### Parent (flex container)

```
flex flex-col min-h-0 overflow-hidden
```

- `min-h-0` lets the flex child shrink below its content height
- `overflow-hidden` constrains the scroll to the inner element

### Scrollable Child

```
flex-1 min-h-0 overflow-y-auto
```

- `flex-1` – grow to fill parent
- `min-h-0` – allow shrinking (critical for scroll)
- `overflow-y-auto` – scroll when content overflows

## Wrong Pattern

```svelte
<!-- BAD: flex-none prevents scroll -->
<section class="flex-none min-h-0 ...">
  <div class="overflow-y-auto flex-1 min-h-0">...</div>
</section>
```

## Correct Pattern

```svelte
<!-- GOOD: flex-1 lets section fill parent -->
<section class="flex-1 min-h-0 overflow-hidden ...">
  <div class="overflow-y-auto flex-1 min-h-0">...</div>
</section>
```

## Reference

- `src/routes/direqt-messages/components/MessageList.svelte` – Changed embedded mode from `flex-none` to `flex-1 min-h-0 overflow-hidden` to fix message list scroll
