---
name: create-dashboard-widgets
description: Create new dashboard widgets and layout templates for DesQTA. Use when adding new widget types, creating widget components, defining widget templates, or modifying dashboard layouts. Covers widget registry, component structure, template creation, and position normalization.
---

# Creating Dashboard Widgets and Layouts

Guide for creating new widget types and layout templates in DesQTA's dashboard system.

## Architecture Overview

**Widget System Flow:**

- Widgets defined in `widgetRegistry.ts` (Map of WidgetType → WidgetDefinition)
- Layouts stored in `settings.json` via `widgetService.ts`
- Templates defined in `widgetTemplates.ts` with normalization
- Components rendered dynamically via `WidgetFactory.svelte`
- Grid managed by GridStack.js in `WidgetGrid.svelte`

**Key Files:**

- `src/lib/types/widgets.ts` - TypeScript interfaces
- `src/lib/services/widgetRegistry.ts` - Widget definitions and components
- `src/lib/services/widgetService.ts` - Layout save/load operations
- `src/lib/services/widgetTemplates.ts` - Template definitions
- `src/lib/components/widgets/*.svelte` - Widget component implementations

## Creating a New Widget Type

### Step 1: Add Widget Type to Type Union

**File:** `src/lib/types/widgets.ts`

Add your widget type to the `WidgetType` union:

```typescript
export type WidgetType =
  | 'upcoming_assessments'
  | 'messages_preview'
  // ... existing types
  | 'your_new_widget'; // Add here
```

### Step 2: Create Widget Component

**File:** `src/lib/components/widgets/YourNewWidget.svelte`

Create a Svelte component following this structure:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Icon, YourIcon } from 'svelte-hero-icons';
  import { logger } from '../../../utils/logger';

  interface Props {
    widget?: any;
    settings?: Record<string, any>;
  }

  let { widget, settings = {} }: Props = $props();

  let loading = $state(true);
  let data = $state<any>(null);

  // Access settings
  const maxItems = $derived(settings.maxItems || 10);

  async function loadData() {
    loading = true;
    try {
      // Load your data here
      // Use invoke() for Tauri commands or services
    } catch (e) {
      logger.error('YourNewWidget', 'loadData', `Failed: ${e}`, { error: e });
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="flex flex-col h-full min-h-0">
  {#if loading}
    <!-- Loading state -->
  {:else if error}
    <!-- Error state -->
  {:else}
    <!-- Widget content -->
  {/if}
</div>
```

**Component Requirements:**

- Accept `widget` and `settings` props
- Use `$state` and `$derived` runes (Svelte 5)
- Include loading and error states
- Apply premium UI refinement (fade/scale transitions, cubic-bezier easing)
- Use responsive classes (`text-sm sm:text-base`, `p-3 sm:p-4`)
- Make content scale to widget size

### Step 3: Register Widget in Registry

**File:** `src/lib/services/widgetRegistry.ts`

Add entry to `widgetRegistry` Map:

```typescript
import YourNewWidget from '../components/widgets/YourNewWidget.svelte';
import { YourIcon } from 'svelte-hero-icons';

export const widgetRegistry = new Map<WidgetType, WidgetDefinition>([
  // ... existing widgets
  [
    'your_new_widget',
    {
      type: 'your_new_widget',
      name: 'Your Widget Name',
      description: 'Brief description of what it does',
      icon: YourIcon, // Heroicon component
      defaultSize: { w: 6, h: 5 }, // Default grid size (12-column grid)
      minSize: { w: 4, h: 4 }, // Minimum size
      maxSize: { w: 12, h: 10 }, // Maximum size
      component: YourNewWidget,
      defaultSettings: {
        // Optional
        maxItems: 10,
        showFilters: true,
      },
      settingsSchema: {
        // Optional - for widget settings UI
        maxItems: {
          type: 'number',
          label: 'Maximum items to show',
          default: 10,
          min: 3,
          max: 20,
        },
        showFilters: {
          type: 'boolean',
          label: 'Show filters',
          default: true,
        },
      },
    },
  ],
]);
```

**Size Guidelines:**

- Grid uses 12 columns
- Heights: 4-6 for compact, 6-8 for standard, 8-10 for detailed
- Widths: 4-6 for sidebar, 6-8 for main, 12 for full-width
- Ensure `minSize.w <= defaultSize.w <= maxSize.w` (same for height)

### Step 4: Add to Default Layout (Optional)

**File:** `src/lib/services/widgetService.ts`

Add widget to `getDefaultLayout()` if it should appear by default:

```typescript
{
  id: 'your_new_widget',
  type: 'your_new_widget',
  enabled: true,
  position: { x: 0, y: 35, w: 6, h: 5 },
},
```

## Creating a New Template

**File:** `src/lib/services/widgetTemplates.ts`

### Template Structure

```typescript
const yourTemplate: WidgetTemplate = {
  id: 'your_template_id',
  name: 'Template Name',
  description: 'What this template provides',
  isDefault: false, // Only "Complete" should be true
  layout: {
    widgets: normalizeTemplateWidgets([
      {
        id: 'widget_id_1',
        type: 'widget_type_1',
        enabled: true,
        position: { x: 0, y: 0, w: 6, h: 5 },
      },
      {
        id: 'widget_id_2',
        type: 'widget_type_2',
        enabled: true,
        position: { x: 6, y: 0, w: 6, h: 5 },
      },
      // ... more widgets
    ]),
    version: 1,
    lastModified: new Date(),
  },
};
```

**Important:**

- Always wrap widgets array with `normalizeTemplateWidgets()` - this ensures complete position data
- Only specify `x`, `y`, `w`, `h` in position - normalization adds `minW`, `minH`, `maxW`, `maxH`
- Use preset sizes: widths `[3, 4, 6, 8, 12]`, heights `[4, 5, 6, 8, 10]`
- Calculate `y` positions to avoid overlaps (each widget's `y + h` should be <= next widget's `y`)

### Adding to Templates Array

Add your template to the `createDefaultTemplates()` return array:

```typescript
return [
  studentFocus,
  analytics,
  quickAccess,
  productivityHub,
  academicOverview,
  minimalist,
  complete,
  yourTemplate, // Add here
];
```

## Position Normalization

**Why it matters:** Widgets need complete position data (`minW`, `minH`, `maxW`, `maxH`) for GridStack to work correctly.

**Automatic normalization:**

- Templates: `normalizeTemplateWidgets()` merges registry defaults
- Layouts: `widgetService.loadLayout()` normalizes on load
- Widgets: Registry defaults applied when missing

**Manual normalization (if needed):**

```typescript
import { widgetRegistry } from './widgetRegistry';

const definition = widgetRegistry.get('widget_type');
const normalizedPosition = {
  x: widget.position.x ?? 0,
  y: widget.position.y ?? 0,
  w: widget.position.w ?? definition.defaultSize.w,
  h: widget.position.h ?? definition.defaultSize.h,
  minW: widget.position.minW ?? definition.minSize.w,
  minH: widget.position.minH ?? definition.minSize.h,
  maxW: widget.position.maxW ?? definition.maxSize.w,
  maxH: widget.position.maxH ?? definition.maxSize.h,
};
```

## Widget Component Best Practices

### Data Loading

**For persistent data:** Use Tauri `db_cache_get`/`db_cache_set`:

```typescript
const data = await invoke('db_cache_get', { key: 'your_key' });
await invoke('db_cache_set', { key: 'your_key', value: data, ttlMinutes: null });
```

**For settings:** Access via `settings` prop:

```typescript
const maxItems = $derived(settings.maxItems || 10);
```

**For API data:** Use existing services or `invoke()` for Tauri commands

### Premium UI Refinement

Apply these patterns consistently:

**Transitions:**

```svelte
<div transition:fade={{ duration: 300, easing: cubicInOut }}>
  <!-- Content -->
</div>
```

**Staggered loading:**

```svelte
{#each items as item, index (item.id)}
  <div transition:fade={{ duration: 300, delay: index * 100 }}>
    <!-- Item -->
  </div>
{/each}
```

**Responsive sizing:**

```svelte
<div class="text-sm sm:text-base lg:text-lg">
  <!-- Scales with widget size -->
</div>
```

**Hover effects:**

```svelte
<div class="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
  <!-- Interactive element -->
</div>
```

### Widget Props

**Required props:**

- `widget?: any` - Widget config (contains `id`, `type`, `position`, etc.)
- `settings?: Record<string, any>` - Widget-specific settings

**Accessing widget ID:**

```typescript
const widgetId = widget?.id || 'default';
```

## Template Design Guidelines

**Layout principles:**

- Avoid overlapping widgets (check `y + h` values)
- Use full width (w: 12) for important widgets (schedule, shortcuts, notices)
- Group related widgets together
- Consider visual hierarchy (larger widgets for primary content)

**Common patterns:**

- **Two-column:** `w: 6` for each widget
- **Three-column:** `w: 4` for each widget
- **Sidebar + main:** `w: 4` sidebar, `w: 8` main
- **Full-width:** `w: 12` for schedules, calendars, lists

**Example template:**

```typescript
const exampleTemplate: WidgetTemplate = {
  id: 'example',
  name: 'Example Layout',
  description: 'Two-column layout with schedule and tasks',
  isDefault: false,
  layout: {
    widgets: normalizeTemplateWidgets([
      // Row 1: Two widgets side by side
      { id: 'widget_1', type: 'type_1', enabled: true, position: { x: 0, y: 0, w: 6, h: 5 } },
      { id: 'widget_2', type: 'type_2', enabled: true, position: { x: 6, y: 0, w: 6, h: 5 } },
      // Row 2: Full-width widget
      { id: 'widget_3', type: 'type_3', enabled: true, position: { x: 0, y: 5, w: 12, h: 6 } },
    ]),
    version: 1,
    lastModified: new Date(),
  },
};
```

## Testing Checklist

After creating a widget or template:

- [ ] Widget appears in "Add Widget" dialog
- [ ] Widget renders correctly in grid
- [ ] Widget resizes within min/max constraints
- [ ] Widget settings (if any) save and load correctly
- [ ] Template applies correctly when selected
- [ ] Template preview shows accurate layout
- [ ] Widget data persists across page reloads
- [ ] Premium animations work smoothly
- [ ] Responsive sizing works at different widget sizes

## Common Issues

**Widget not appearing:**

- Check `WidgetType` union includes your type
- Verify registry entry is correct
- Ensure component import path is correct

**Position not applying:**

- Ensure `normalizeTemplateWidgets()` is called
- Check that registry has correct `minSize`/`maxSize`
- Verify widget positions don't overlap

**Settings not saving:**

- Check `settingsSchema` is defined in registry
- Verify component reads from `settings` prop
- Ensure settings are merged with defaults

## File Reference

**Core files:**

- `src/lib/types/widgets.ts` - Type definitions
- `src/lib/services/widgetRegistry.ts` - Widget registry
- `src/lib/services/widgetService.ts` - Layout persistence
- `src/lib/services/widgetTemplates.ts` - Template definitions
- `src/lib/components/widgets/*.svelte` - Widget components

**Supporting files:**

- `src/lib/components/dashboard/WidgetFactory.svelte` - Dynamic rendering
- `src/lib/components/dashboard/WidgetContainer.svelte` - Wrapper component
- `src/lib/components/dashboard/WidgetGrid.svelte` - Grid management
- `src/lib/components/dashboard/TemplatePreview.svelte` - Template preview
