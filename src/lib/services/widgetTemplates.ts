import type { WidgetLayout, WidgetConfig } from '../types/widgets';
import { widgetService } from './widgetService';
import { widgetRegistry } from './widgetRegistry';
import { logger } from '../../utils/logger';
import { getBundledDashboardTemplates } from '../dashboards/index';

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  layout: WidgetLayout;
  isDefault: boolean;
}

const SETTINGS_KEY = 'dashboard_widget_templates';

/**
 * Normalize template widgets by merging positions with registry defaults
 * Ensures all widgets have complete position data (minW, minH, maxW, maxH) and default settings
 */
function normalizeTemplateWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
  return widgets.map((widget) => {
    const definition = widgetRegistry.get(widget.type);
    if (!definition) {
      logger.warn(
        'widgetTemplatesService',
        'normalizeTemplateWidgets',
        `Widget type ${widget.type} not found in registry`,
      );
      return widget;
    }

    // Merge position with defaults from registry
    const defaultSize = definition.defaultSize;
    const minSize = definition.minSize;
    const maxSize = definition.maxSize;

    return {
      ...widget,
      position: {
        x: widget.position?.x ?? 0,
        y: widget.position?.y ?? 0,
        w: widget.position?.w ?? defaultSize.w,
        h: widget.position?.h ?? defaultSize.h,
        minW: widget.position?.minW ?? minSize.w,
        minH: widget.position?.minH ?? minSize.h,
        maxW: widget.position?.maxW ?? maxSize.w,
        maxH: widget.position?.maxH ?? maxSize.h,
      },
      // Merge default settings with widget settings
      settings: definition.defaultSettings
        ? { ...definition.defaultSettings, ...(widget.settings || {}) }
        : widget.settings || {},
    };
  });
}

// Default templates - normalized with proper positions.
// Built around the consolidated Lo-fi widget set:
// timetable, deadlines, grade_trends, messages_preview, notices, news,
// shortcuts, quick_notes, study_timer, weather, welcome_portal.
function createDefaultTemplates(): WidgetTemplate[] {
  const studentFocus: WidgetTemplate = {
    id: 'student_focus',
    name: 'Student focus',
    description: "Today's schedule, deadlines, and notes.",
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'timetable',
          type: 'timetable',
          enabled: true,
          position: { x: 0, y: 0, w: 8, h: 6 },
          settings: { viewMode: 'today', defaultView: 'today' },
        },
        {
          id: 'deadlines',
          type: 'deadlines',
          enabled: true,
          position: { x: 8, y: 0, w: 4, h: 6 },
        },
        {
          id: 'quick_notes',
          type: 'quick_notes',
          enabled: true,
          position: { x: 0, y: 6, w: 6, h: 5 },
        },
        {
          id: 'messages_preview',
          type: 'messages_preview',
          enabled: true,
          position: { x: 6, y: 6, w: 6, h: 5 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const academic: WidgetTemplate = {
    id: 'academic',
    name: 'Academic overview',
    description: 'Trends and deadlines side-by-side, with the timetable.',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'grade_trends',
          type: 'grade_trends',
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
          id: 'timetable',
          type: 'timetable',
          enabled: true,
          position: { x: 0, y: 6, w: 12, h: 6 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const reading: WidgetTemplate = {
    id: 'reading',
    name: 'Reading',
    description: 'News, notices, and messages — for catching up.',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'notices',
          type: 'notices',
          enabled: true,
          position: { x: 0, y: 0, w: 8, h: 4 },
        },
        {
          id: 'messages_preview',
          type: 'messages_preview',
          enabled: true,
          position: { x: 8, y: 0, w: 4, h: 4 },
        },
        {
          id: 'news',
          type: 'news',
          enabled: true,
          position: { x: 0, y: 4, w: 12, h: 5 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const minimalist: WidgetTemplate = {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Just the timetable, shortcuts, and notes.',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'timetable',
          type: 'timetable',
          enabled: true,
          position: { x: 0, y: 0, w: 12, h: 6 },
        },
        {
          id: 'shortcuts',
          type: 'shortcuts',
          enabled: true,
          position: { x: 0, y: 6, w: 6, h: 3 },
        },
        {
          id: 'quick_notes',
          type: 'quick_notes',
          enabled: true,
          position: { x: 6, y: 6, w: 6, h: 5 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const complete: WidgetTemplate = {
    id: 'complete',
    name: 'Default',
    description: 'The recommended starting layout.',
    isDefault: true,
    layout: widgetService.getDefaultLayout(),
  };

  return [studentFocus, academic, reading, minimalist, complete];
}

export const defaultTemplates: WidgetTemplate[] = [
  ...createDefaultTemplates(),
  ...getBundledDashboardTemplates(),
];

export const widgetTemplatesService = {
  async loadTemplates(): Promise<WidgetTemplate[]> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const settings = await invoke<any>('get_settings_subset', {
        keys: [SETTINGS_KEY],
      });

      if (settings?.[SETTINGS_KEY]) {
        const templatesStr = settings[SETTINGS_KEY];
        const customTemplates: WidgetTemplate[] =
          typeof templatesStr === 'string' ? JSON.parse(templatesStr) : templatesStr;
        return [...defaultTemplates, ...customTemplates];
      }

      return defaultTemplates;
    } catch (e) {
      logger.error('widgetTemplatesService', 'loadTemplates', `Failed to load templates: ${e}`, {
        error: e,
      });
      return defaultTemplates;
    }
  },

  async saveTemplate(template: WidgetTemplate): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const templates = await this.loadTemplates();
      const customTemplates = templates.filter((t) => !t.isDefault);

      // Check if template already exists
      const existingIndex = customTemplates.findIndex((t) => t.id === template.id);
      if (existingIndex >= 0) {
        customTemplates[existingIndex] = template;
      } else {
        customTemplates.push(template);
      }

      await invoke('save_settings_merge', {
        patch: {
          [SETTINGS_KEY]: JSON.stringify(customTemplates),
        },
      });

      logger.debug('widgetTemplatesService', 'saveTemplate', 'Template saved successfully');
    } catch (e) {
      logger.error('widgetTemplatesService', 'saveTemplate', `Failed to save template: ${e}`, {
        error: e,
      });
      throw e;
    }
  },

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const templates = await this.loadTemplates();
      const customTemplates = templates.filter((t) => !t.isDefault && t.id !== templateId);

      await invoke('save_settings_merge', {
        patch: {
          [SETTINGS_KEY]: JSON.stringify(customTemplates),
        },
      });

      logger.debug('widgetTemplatesService', 'deleteTemplate', 'Template deleted successfully');
    } catch (e) {
      logger.error('widgetTemplatesService', 'deleteTemplate', `Failed to delete template: ${e}`, {
        error: e,
      });
      throw e;
    }
  },

  async applyTemplate(templateId: string): Promise<void> {
    try {
      const templates = await this.loadTemplates();
      const template = templates.find((t) => t.id === templateId);

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Normalize template widgets before applying
      const normalizedLayout: WidgetLayout = {
        ...template.layout,
        widgets: normalizeTemplateWidgets(template.layout.widgets),
      };

      // Apply the template layout
      await widgetService.saveLayout(normalizedLayout);
      logger.debug('widgetTemplatesService', 'applyTemplate', 'Template applied successfully');
    } catch (e) {
      logger.error('widgetTemplatesService', 'applyTemplate', `Failed to apply template: ${e}`, {
        error: e,
      });
      throw e;
    }
  },

  async saveCurrentLayoutAsTemplate(name: string, description: string): Promise<WidgetTemplate> {
    try {
      const layout = await widgetService.loadLayout();
      const template: WidgetTemplate = {
        id: `custom_${Date.now()}`,
        name,
        description,
        layout,
        isDefault: false,
      };

      await this.saveTemplate(template);
      return template;
    } catch (e) {
      logger.error(
        'widgetTemplatesService',
        'saveCurrentLayoutAsTemplate',
        `Failed to save template: ${e}`,
        { error: e },
      );
      throw e;
    }
  },
};
