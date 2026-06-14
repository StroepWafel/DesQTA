import { invoke } from '@tauri-apps/api/core';
import { widgetService } from './widgetService';
import { widgetRegistry } from './widgetRegistry';
import { logger } from '../../utils/logger';
import {
  WIDGET_LAYOUT_VERSION,
  type WidgetConfig,
  type WidgetLayout,
  type WidgetType,
} from '../types/widgets';
import { calculateNextAvailablePosition } from '../utils/widgetPosition';

/**
 * If no saved layout exists, write the default layout. Otherwise do nothing.
 * (Used to be misleadingly named `migrateToWidgetSystem`.)
 */
export async function seedDefaultLayoutIfEmpty(): Promise<void> {
  try {
    const layout = await invoke<WidgetLayout | null>('db_widget_layout_load');
    const widgets = Array.isArray(layout?.widgets) ? layout.widgets : [];

    if (!layout || widgets.length === 0) {
      logger.info(
        'widgetMigration',
        'seedDefaultLayoutIfEmpty',
        'No saved layout found in database, seeding default layout',
      );
      await widgetService.saveLayout(widgetService.getDefaultLayout());
    } else {
      logger.debug(
        'widgetMigration',
        'seedDefaultLayoutIfEmpty',
        'Layout already exists in database, skipping seed',
        { widgetCount: widgets.length, version: layout.version },
      );
    }
  } catch (e) {
    logger.error(
      'widgetMigration',
      'seedDefaultLayoutIfEmpty',
      `Seed default layout failed: ${e}`,
      { error: e },
    );
  }
}

// Backwards-compatibility alias so callers that haven't been updated still work.
export const migrateToWidgetSystem = seedDefaultLayoutIfEmpty;

/**
 * Strictly validate a persisted layout against the current registry:
 * - drop widgets whose `type` isn't in the registry
 * - clamp positions to per-widget min/max
 * - resolve overlapping widgets via the position planner
 * - reset `settings` keys that don't pass the widget's schema
 * - stamp the current layoutVersion on the persisted blob
 */
export async function validateAndFixLayout(): Promise<void> {
  try {
    const layout = await widgetService.loadLayout();
    const raw = Array.isArray(layout.widgets) ? layout.widgets : [];

    let changed = false;
    const fixed: WidgetConfig[] = [];

    for (const w of raw) {
      if (!w || !w.id || !w.type || !w.position) {
        changed = true;
        continue;
      }
      const def = widgetRegistry.get(w.type as WidgetType);
      if (!def) {
        changed = true;
        continue;
      }

      const minW = def.minSize.w;
      const minH = def.minSize.h;
      const maxW = def.maxSize.w;
      const maxH = def.maxSize.h;

      const next: WidgetConfig = {
        ...w,
        position: {
          ...w.position,
          x: clamp(w.position.x ?? 0, 0, 12 - minW),
          y: Math.max(0, w.position.y ?? 0),
          w: clamp(w.position.w ?? def.defaultSize.w, minW, maxW),
          h: clamp(w.position.h ?? def.defaultSize.h, minH, maxH),
          minW,
          minH,
          maxW,
          maxH,
        },
        settings: validateSettings(w.settings, def.settingsSchema),
      };

      if (JSON.stringify(next) !== JSON.stringify(w)) changed = true;
      fixed.push(next);
    }

    // Resolve overlaps by re-running the planner for any widgets that collide
    const placed: WidgetConfig[] = [];
    for (const w of fixed) {
      if (collides(w, placed)) {
        const def = widgetRegistry.get(w.type as WidgetType);
        const pos = calculateNextAvailablePosition(
          placed,
          def?.minSize.w ?? 1,
          def?.minSize.h ?? 1,
          def?.defaultSize.w ?? w.position.w,
          def?.defaultSize.h ?? w.position.h,
        );
        w.position = { ...w.position, ...pos };
        changed = true;
      }
      placed.push(w);
    }

    if (changed || layout.layoutVersion !== WIDGET_LAYOUT_VERSION) {
      logger.warn('widgetMigration', 'validateAndFixLayout', 'Fixed layout', {
        before: raw.length,
        after: placed.length,
      });
      await widgetService.saveLayout({
        ...layout,
        widgets: placed,
        layoutVersion: WIDGET_LAYOUT_VERSION,
      });
    }
  } catch (e) {
    logger.error('widgetMigration', 'validateAndFixLayout', `Validation failed: ${e}`, {
      error: e,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function collides(w: WidgetConfig, placed: WidgetConfig[]): boolean {
  return placed.some((p) => {
    return (
      w.position.x < p.position.x + p.position.w &&
      w.position.x + w.position.w > p.position.x &&
      w.position.y < p.position.y + p.position.h &&
      w.position.y + w.position.h > p.position.y
    );
  });
}

function validateSettings(
  raw: Record<string, any> | undefined,
  schema: import('../types/widgets').WidgetSettingsSchema | undefined,
): Record<string, any> | undefined {
  if (!schema) return raw;
  const next: Record<string, any> = {};
  for (const [key, field] of Object.entries(schema)) {
    const value = raw?.[key];
    if (value === undefined || value === null) {
      next[key] = field.default;
      continue;
    }
    switch (field.type) {
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(n)) {
          next[key] = field.default;
        } else {
          next[key] = clamp(n, field.min ?? -Infinity, field.max ?? Infinity);
        }
        break;
      }
      case 'boolean':
        next[key] = typeof value === 'boolean' ? value : field.default;
        break;
      case 'select': {
        const allowed = (field.options ?? []).map((opt) => opt.value);
        next[key] = allowed.includes(value) ? value : field.default;
        break;
      }
      default:
        next[key] = value;
    }
  }
  return next;
}
