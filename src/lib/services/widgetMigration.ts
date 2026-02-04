import { invoke } from '@tauri-apps/api/core';
import { widgetService } from './widgetService';
import { logger } from '../../utils/logger';

/**
 * Migrates existing static dashboard to widget system
 * This function checks if a layout already exists in the database, and if not, creates a default layout
 * matching the current dashboard structure
 */
export async function migrateToWidgetSystem(): Promise<void> {
  try {
    // Check if a saved layout exists in the database by calling the Rust command directly
    const layout = await invoke<any>('db_widget_layout_load');

    // Ensure widgets is always an array (defensive check for production builds)
    const widgets = Array.isArray(layout?.widgets) ? layout.widgets : [];

    if (!layout || widgets.length === 0) {
      logger.info(
        'widgetMigration',
        'migrateToWidgetSystem',
        'No saved layout found in database, creating default layout',
      );
      // Only save on first-time migration, not on every load
      await widgetService.saveLayout(widgetService.getDefaultLayout());
      logger.info(
        'widgetMigration',
        'migrateToWidgetSystem',
        'Default layout created successfully',
      );
    } else {
      logger.debug(
        'widgetMigration',
        'migrateToWidgetSystem',
        'Layout already exists in database, skipping migration',
        { widgetCount: widgets.length, version: layout.version },
      );
    }
  } catch (e) {
    logger.error('widgetMigration', 'migrateToWidgetSystem', `Migration failed: ${e}`, {
      error: e,
    });
    // Don't throw - allow app to continue with default layout
  }
}

/**
 * Validates and fixes widget layout if needed
 */
export async function validateAndFixLayout(): Promise<void> {
  try {
    const layout = await widgetService.loadLayout();

    // Ensure widgets is always an array (defensive check)
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];

    // Check for invalid widgets (widgets with types that don't exist)
    const validWidgets = widgets.filter((widget) => {
      // Basic validation - check if widget has required fields
      return (
        widget &&
        widget.id &&
        widget.type &&
        widget.position &&
        typeof widget.position.x === 'number' &&
        typeof widget.position.y === 'number' &&
        typeof widget.position.w === 'number' &&
        typeof widget.position.h === 'number'
      );
    });

    // If we filtered out any invalid widgets, save the fixed layout
    if (validWidgets.length !== widgets.length) {
      logger.warn('widgetMigration', 'validateAndFixLayout', 'Removed invalid widgets', {
        originalCount: widgets.length,
        validCount: validWidgets.length,
      });
      await widgetService.saveLayout({ ...layout, widgets: validWidgets });
    }
  } catch (e) {
    logger.error('widgetMigration', 'validateAndFixLayout', `Validation failed: ${e}`, {
      error: e,
    });
  }
}
