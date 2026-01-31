---
name: premium-ui-refinement
description: Apply premium animation and UI refinement patterns to create polished, refined user experiences. Use when working on animations, transitions, UI polish, or when the user asks about making elements feel more premium or refined.
---

# Premium UI Refinement

Apply proven animation and visual design patterns to create a premium, refined user experience throughout DesQTA.

## Core Principles

### 1. Easing Functions

**Never use linear easing.** Always use:

- `cubic-bezier(0.4, 0, 0.2, 1)` (Material Design standard)
- `cubicInOut` from `svelte/easing` for Svelte transitions

### 2. Duration Hierarchy

Match duration to element complexity:

- **150-200ms**: Simple UI (buttons, dropdowns, tooltips)
- **300ms**: Moderate changes (sidebars, modals, panels)
- **400-500ms**: Complex content (page sections, data tables)
- **500-1000ms**: Data visualizations (charts, graphs)

### 3. Multi-Property Animations

Combine multiple properties for richer feel:

- Opacity + transform (scale/translate)
- Width + opacity
- Position + scale
- Never animate just one property

### 4. Transform Origin

Set `transform-origin` to logical anchor points:

- Text elements: `left center` (matches reading flow)
- Buttons: `center center` (default)
- Dropdowns: anchor to trigger element

### 5. Stagger Sequential Elements

Use delays for related elements:

- First element: 0ms
- Second: 100ms delay
- Third: 200ms delay
- Creates visual hierarchy

### 6. Visual Effects Layering

Combine effects for depth:

- `backdrop-blur-md` for glassmorphism
- `shadow-2xl` for elevation
- Semi-transparent backgrounds (`bg-white/95`)
- Multiple effects work together

## Common Patterns

### Premium Fade-In

```svelte
<div transition:fade={{ duration: 200 }}>
  <!-- Content -->
</div>
```

### Scale + Fade Animation

```svelte
<div
  class="transition-all duration-200"
  style="animation: fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
  <!-- Content -->
</div>
```

CSS:

```css
@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
```

### Premium Dropdown

```svelte
<div
  transition:fly={{ y: -8, duration: 200, opacity: 0 }}
  class="backdrop-blur-md shadow-2xl bg-white/95 dark:bg-zinc-900/90">
  <!-- Dropdown content -->
</div>
```

### Staggered Sequential Loading

```svelte
<div in:fade={{ duration: 400 }}>Filters</div>
<div in:fade={{ duration: 400, delay: 100 }}>Charts</div>
<div in:fade={{ duration: 400, delay: 200 }}>Table</div>
```

### Chart Animations

```javascript
// Bar chart - animate from bottom
motion: {
  x: { type: "tween", duration: 500, easing: cubicInOut },
  y: { type: "tween", duration: 500, easing: cubicInOut },
  height: { type: "tween", duration: 500, easing: cubicInOut },
  width: { type: "tween", duration: 500, easing: cubicInOut },
}

// Area chart - clip-path reveal
motion={{
  width: { type: "tween", duration: 1000, easing: cubicInOut }
}}
```

### Sidebar/Major UI Transitions

```svelte
<aside
  class="transition-all duration-300 ease-in-out overflow-hidden"
  class:w-full={open}
  class:w-0={!open}
  class:opacity-0={!open}
  class:opacity-100={open}
  class:pointer-events-none={!open}
  class:pointer-events-auto={open}>
```

## Implementation Checklist

When adding or refining animations:

- [ ] Easing function is not linear (use `cubic-bezier(0.4, 0, 0.2, 1)` or `cubicInOut`)
- [ ] Duration matches element complexity (200ms simple, 300ms moderate, 400-500ms complex)
- [ ] Multiple properties animated (opacity + transform, width + opacity, etc.)
- [ ] Transform origin set appropriately for scaling/rotating
- [ ] Sequential elements staggered with delays (100ms, 200ms)
- [ ] Visual effects layered (blur, shadow, transparency)
- [ ] Pointer events managed during transitions
- [ ] Overflow handled correctly (`overflow-hidden` when needed)
- [ ] Responsive behavior considered (mobile vs desktop)
- [ ] Consistent with existing patterns in codebase

## Examples from Codebase

**Editor headings:** `src/components/Editor/EditorStyles.css` (fadeInScale animation)
**User dropdown:** `src/lib/components/UserDropdown.svelte` (fly transition with blur)
**Analytics charts:** `src/lib/components/analytics/` (staggered loading, chart animations)
**Sidebar:** `src/lib/components/AppSidebar.svelte` (multi-property transitions)

## Additional Resources

For detailed analysis of premium animation patterns, see [docs/development/premium-animations-analysis.md](../../docs/development/premium-animations-analysis.md)
