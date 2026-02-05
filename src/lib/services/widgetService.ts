import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import type { WidgetLayout, WidgetConfig } from '../types/widgets';

export const widgetService = {
  async loadLayout(): Promise<WidgetLayout> {
    try {
      const layout = await invoke<WidgetLayout | null>('db_widget_layout_load');

      if (layout) {
        // Ensure widgets is always an array (defensive check for production builds)
        const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];

        // Convert lastModified string to Date
        const layoutWithDate: WidgetLayout = {
          ...layout,
          widgets,
          lastModified:
            typeof layout.lastModified === 'string' ? new Date(layout.lastModified) : new Date(),
        };

        logger.debug('widgetService', 'loadLayout', 'Layout loaded from database', {
          widgetCount: widgets.length,
          version: layout.version,
        });

        return layoutWithDate;
      }

      // No layout found in database, return default
      logger.debug(
        'widgetService',
        'loadLayout',
        'No saved layout found in database, returning default',
      );
      return this.getDefaultLayout();
    } catch (e) {
      logger.error('widgetService', 'loadLayout', `Failed to load layout: ${e}`, { error: e });
      // On error, return default layout
      return this.getDefaultLayout();
    }
  },

  async saveLayout(layout: WidgetLayout): Promise<void> {
    try {
      // Ensure widgets is always an array (defensive check)
      const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];

      // Don't save if layout contains only temporary timetable page widget
      if (widgets.length === 1 && widgets[0]?.id === 'timetable-page-widget') {
        logger.debug('widgetService', 'saveLayout', 'Skipping save for temporary timetable page layout');
        return;
      }

      // Convert Date to ISO string for Rust
      const layoutToSave: WidgetLayout = {
        ...layout,
        widgets,
        lastModified:
          typeof layout.lastModified === 'string'
            ? layout.lastModified
            : layout.lastModified.toISOString(),
        version: layout.version || 1,
      };

      await invoke('db_widget_layout_save', { layout: layoutToSave });
      logger.debug('widgetService', 'saveLayout', 'Layout saved successfully', {
        widgetCount: widgets.length,
        version: layoutToSave.version,
        widgetIds: widgets.map((w) => w.id),
      });
    } catch (e) {
      logger.error('widgetService', 'saveLayout', `Failed to save layout: ${e}`, { error: e });
      throw e;
    }
  },

  getDefaultLayout(): WidgetLayout {
    // Return default widget positions matching current dashboard
    const defaultWidgets: WidgetConfig[] = [
      {
        id: 'upcoming_assessments',
        type: 'upcoming_assessments',
        enabled: true,
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        id: 'messages_preview',
        type: 'messages_preview',
        enabled: true,
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        id: 'today_schedule',
        type: 'today_schedule',
        enabled: true,
        position: { x: 0, y: 4, w: 12, h: 5 }, // Full width
      },
      {
        id: 'notices',
        type: 'notices',
        enabled: true,
        position: { x: 0, y: 9, w: 12, h: 4 }, // Full width
      },
      {
        id: 'shortcuts',
        type: 'shortcuts',
        enabled: true,
        position: { x: 0, y: 13, w: 12, h: 3 }, // Full width
      },
      {
        id: 'news',
        type: 'news',
        enabled: true,
        position: { x: 0, y: 16, w: 12, h: 4 },
      },
      {
        id: 'welcome_portal',
        type: 'welcome_portal',
        enabled: true,
        position: { x: 0, y: 20, w: 12, h: 4 },
      },
      {
        id: 'homework',
        type: 'homework',
        enabled: true,
        position: { x: 0, y: 24, w: 4, h: 4 },
      },
      {
        id: 'todo_list',
        type: 'todo_list',
        enabled: true,
        position: { x: 4, y: 24, w: 4, h: 4 },
      },
      {
        id: 'focus_timer',
        type: 'focus_timer',
        enabled: true,
        position: { x: 8, y: 24, w: 4, h: 4 },
      },
    ];

    return {
      widgets: defaultWidgets,
      version: 1,
      lastModified: new Date(),
    };
  },

  async updateWidgetConfig(widgetId: string, updates: Partial<WidgetConfig>): Promise<void> {
    // Don't save temporary widget configs (e.g., timetable page widget)
    if (widgetId === 'timetable-page-widget') {
      logger.debug('widgetService', 'updateWidgetConfig', 'Skipping save for temporary widget', { widgetId });
      return;
    }
    const layout = await this.loadLayout();
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) {
      Object.assign(widget, updates);
      await this.saveLayout({ ...layout, widgets });
    }
  },

  async addWidget(widget: WidgetConfig): Promise<void> {
    const layout = await this.loadLayout();
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    widgets.push(widget);
    await this.saveLayout({ ...layout, widgets });
  },

  async removeWidget(widgetId: string): Promise<void> {
    const layout = await this.loadLayout();
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    const filteredWidgets = widgets.filter((w) => w.id !== widgetId);
    await this.saveLayout({ ...layout, widgets: filteredWidgets });
  },

  async updateWidgetPosition(
    widgetId: string,
    position: Partial<WidgetConfig['position']>,
  ): Promise<void> {
    const layout = await this.loadLayout();
    const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];
    const widget = widgets.find((w) => w.id === widgetId);
    if (widget) {
      widget.position = { ...widget.position, ...position };
      await this.saveLayout({ ...layout, widgets });
    }
  },

  /**
   * Reset layout to default and save it
   */
  async resetLayout(): Promise<void> {
    try {
      const defaultLayout = this.getDefaultLayout();
      await this.saveLayout(defaultLayout);
      logger.debug('widgetService', 'resetLayout', 'Layout reset to default successfully', {
        widgetCount: defaultLayout.widgets.length,
      });
    } catch (e) {
      logger.error('widgetService', 'resetLayout', `Failed to reset layout: ${e}`, { error: e });
      throw e;
    }
  },
};
