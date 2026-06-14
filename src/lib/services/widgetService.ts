import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import {
  WIDGET_LAYOUT_VERSION,
  type WidgetConfig,
  type WidgetLayout,
  type WidgetPosition,
} from '../types/widgets';
import { releaseStackMembers } from '../utils/widgetLayoutOps';

/**
 * Single source of truth for cloning a WidgetConfig and its position/settings.
 * Used by the grid engine, migration utilities, and the service itself.
 */
export function cloneWidgetPosition(position: WidgetPosition): WidgetPosition {
  return { ...position };
}

export function cloneWidgetConfig(widget: WidgetConfig): WidgetConfig {
  return {
    ...widget,
    position: cloneWidgetPosition(widget.position),
    settings: widget.settings ? { ...widget.settings } : undefined,
    stack: widget.stack
      ? { memberIds: [...widget.stack.memberIds], activeIndex: widget.stack.activeIndex }
      : undefined,
    stackedIn: widget.stackedIn,
  };
}

export function cloneWidgetLayout(layout: WidgetLayout): WidgetLayout {
  const widgets = Array.isArray(layout.widgets) ? layout.widgets.map(cloneWidgetConfig) : [];

  return {
    ...layout,
    widgets,
    layoutVersion: layout.layoutVersion ?? WIDGET_LAYOUT_VERSION,
    lastModified:
      typeof layout.lastModified === 'string'
        ? new Date(layout.lastModified)
        : new Date(layout.lastModified),
  };
}

function updateLayoutTimestamp(layout: WidgetLayout): WidgetLayout {
  return {
    ...layout,
    lastModified: new Date(),
  };
}

export const widgetService = {
  async loadLayout(): Promise<WidgetLayout> {
    try {
      const layout = await invoke<WidgetLayout | null>('db_widget_layout_load');

      if (layout) {
        const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];

        const layoutWithDate: WidgetLayout = {
          ...layout,
          widgets,
          layoutVersion: layout.layoutVersion ?? WIDGET_LAYOUT_VERSION,
          lastModified:
            typeof layout.lastModified === 'string' ? new Date(layout.lastModified) : new Date(),
        };

        logger.debug('widgetService', 'loadLayout', 'Layout loaded from database', {
          widgetCount: widgets.length,
          version: layout.version,
          layoutVersion: layoutWithDate.layoutVersion,
        });

        return cloneWidgetLayout(layoutWithDate);
      }

      logger.debug(
        'widgetService',
        'loadLayout',
        'No saved layout found in database, returning default',
      );
      return cloneWidgetLayout(this.getDefaultLayout());
    } catch (e) {
      logger.error('widgetService', 'loadLayout', `Failed to load layout: ${e}`, { error: e });
      return cloneWidgetLayout(this.getDefaultLayout());
    }
  },

  async saveLayout(layout: WidgetLayout): Promise<void> {
    try {
      const widgets = Array.isArray(layout.widgets) ? layout.widgets : [];

      const layoutToSave: WidgetLayout = {
        ...layout,
        widgets,
        layoutVersion: layout.layoutVersion ?? WIDGET_LAYOUT_VERSION,
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
        layoutVersion: layoutToSave.layoutVersion,
      });
    } catch (e) {
      logger.error('widgetService', 'saveLayout', `Failed to save layout: ${e}`, { error: e });
      throw e;
    }
  },

  getDefaultLayout(): WidgetLayout {
    // Default layout uses the consolidated widget set. Widgets are arranged
    // by importance for a typical student day.
    const defaultWidgets: WidgetConfig[] = [
      {
        id: 'timetable',
        type: 'timetable',
        enabled: true,
        position: { x: 0, y: 0, w: 8, h: 6 },
      },
      {
        id: 'deadlines',
        type: 'deadlines',
        enabled: true,
        position: { x: 8, y: 0, w: 4, h: 6 },
      },
      {
        id: 'messages_preview',
        type: 'messages_preview',
        enabled: true,
        position: { x: 0, y: 6, w: 4, h: 4 },
      },
      {
        id: 'notices',
        type: 'notices',
        enabled: true,
        position: { x: 4, y: 6, w: 8, h: 4 },
      },
      {
        id: 'shortcuts',
        type: 'shortcuts',
        enabled: true,
        position: { x: 0, y: 10, w: 8, h: 3 },
      },
      {
        id: 'weather',
        type: 'weather',
        enabled: true,
        position: { x: 8, y: 10, w: 4, h: 3 },
      },
      {
        id: 'news',
        type: 'news',
        enabled: true,
        position: { x: 0, y: 13, w: 12, h: 4 },
      },
    ];

    return {
      widgets: defaultWidgets,
      version: 1,
      layoutVersion: WIDGET_LAYOUT_VERSION,
      lastModified: new Date(),
    };
  },

  updateWidgetInLayout(
    layout: WidgetLayout,
    widgetId: string,
    updates: Omit<Partial<WidgetConfig>, 'position'> & {
      position?: Partial<WidgetConfig['position']>;
    },
  ): WidgetLayout {
    const nextLayout = cloneWidgetLayout(layout);
    const widget = nextLayout.widgets.find((entry) => entry.id === widgetId);
    if (!widget) {
      return nextLayout;
    }

    const nextPosition = updates.position
      ? { ...widget.position, ...updates.position }
      : widget.position;

    Object.assign(widget, updates);
    widget.position = nextPosition;

    return updateLayoutTimestamp(nextLayout);
  },

  insertWidgetIntoLayout(layout: WidgetLayout, widget: WidgetConfig): WidgetLayout {
    const nextLayout = cloneWidgetLayout(layout);
    nextLayout.widgets.push(cloneWidgetConfig(widget));
    return updateLayoutTimestamp(nextLayout);
  },

  removeWidgetFromLayout(layout: WidgetLayout, widgetId: string): WidgetLayout {
    const nextLayout = cloneWidgetLayout(layout);
    const widget = nextLayout.widgets.find((entry) => entry.id === widgetId);
    if (widget) {
      const placed = nextLayout.widgets.filter(
        (w) => w.enabled && !w.stackedIn && w.id !== widgetId,
      );
      if (widget.stack?.memberIds.length) {
        releaseStackMembers(nextLayout.widgets, widgetId, placed);
      }
      if (widget.stackedIn) {
        const host = nextLayout.widgets.find((w) => w.id === widget.stackedIn);
        if (host?.stack) {
          host.stack.memberIds = host.stack.memberIds.filter((id) => id !== widgetId);
        }
      }
    }
    nextLayout.widgets = nextLayout.widgets.filter((widget) => widget.id !== widgetId);
    return updateLayoutTimestamp(nextLayout);
  },

  updateWidgetPositionInLayout(
    layout: WidgetLayout,
    widgetId: string,
    position: Partial<WidgetConfig['position']>,
  ): WidgetLayout {
    return this.updateWidgetInLayout(layout, widgetId, { position });
  },

  async updateWidgetConfig(widgetId: string, updates: Partial<WidgetConfig>): Promise<void> {
    const nextLayout = this.updateWidgetInLayout(await this.loadLayout(), widgetId, updates);
    await this.saveLayout(nextLayout);
  },

  async addWidget(widget: WidgetConfig): Promise<void> {
    const nextLayout = this.insertWidgetIntoLayout(await this.loadLayout(), widget);
    await this.saveLayout(nextLayout);
  },

  async removeWidget(widgetId: string): Promise<void> {
    const nextLayout = this.removeWidgetFromLayout(await this.loadLayout(), widgetId);
    await this.saveLayout(nextLayout);
  },

  async updateWidgetPosition(
    widgetId: string,
    position: Partial<WidgetConfig['position']>,
  ): Promise<void> {
    const nextLayout = this.updateWidgetPositionInLayout(
      await this.loadLayout(),
      widgetId,
      position,
    );
    await this.saveLayout(nextLayout);
  },

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
