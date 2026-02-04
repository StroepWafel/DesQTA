import type { WidgetLayout, WidgetConfig } from '../types/widgets';
import { widgetService } from './widgetService';
import { widgetRegistry } from './widgetRegistry';
import { logger } from '../../utils/logger';

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

// Default templates - normalized with proper positions
function createDefaultTemplates(): WidgetTemplate[] {
  const studentFocus: WidgetTemplate = {
    id: 'student_focus',
    name: 'Student Focus',
    description: 'Assessments, Schedule, and Todo list',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'upcoming_assessments',
          type: 'upcoming_assessments',
          enabled: true,
          position: { x: 0, y: 0, w: 6, h: 5 },
        },
        {
          id: 'today_schedule',
          type: 'today_schedule',
          enabled: true,
          position: { x: 6, y: 0, w: 6, h: 6 },
        },
        {
          id: 'todo_list',
          type: 'todo_list',
          enabled: true,
          position: { x: 0, y: 5, w: 4, h: 5 },
        },
        {
          id: 'messages_preview',
          type: 'messages_preview',
          enabled: true,
          position: { x: 4, y: 5, w: 8, h: 5 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const analytics: WidgetTemplate = {
    id: 'analytics',
    name: 'Analytics Dashboard',
    description: 'Grade trends, Study time, and Performance',
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
          id: 'study_time_tracker',
          type: 'study_time_tracker',
          enabled: true,
          position: { x: 8, y: 0, w: 4, h: 6 },
        },
        {
          id: 'deadlines_calendar',
          type: 'deadlines_calendar',
          enabled: true,
          position: { x: 0, y: 6, w: 6, h: 6 },
        },
        {
          id: 'upcoming_assessments',
          type: 'upcoming_assessments',
          enabled: true,
          position: { x: 6, y: 6, w: 6, h: 6 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const quickAccess: WidgetTemplate = {
    id: 'quick_access',
    name: 'Quick Access',
    description: 'Shortcuts, Notes, and Weather',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'shortcuts',
          type: 'shortcuts',
          enabled: true,
          position: { x: 0, y: 0, w: 8, h: 4 },
        },
        {
          id: 'weather',
          type: 'weather',
          enabled: true,
          position: { x: 8, y: 0, w: 4, h: 5 },
        },
        {
          id: 'quick_notes',
          type: 'quick_notes',
          enabled: true,
          position: { x: 0, y: 4, w: 6, h: 6 },
        },
        {
          id: 'messages_preview',
          type: 'messages_preview',
          enabled: true,
          position: { x: 6, y: 4, w: 6, h: 6 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const productivityHub: WidgetTemplate = {
    id: 'productivity_hub',
    name: 'Productivity Hub',
    description: 'Focus Timer, Todo List, Quick Notes, and Study Tracker',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'focus_timer',
          type: 'focus_timer',
          enabled: true,
          position: { x: 0, y: 0, w: 4, h: 5 },
        },
        {
          id: 'todo_list',
          type: 'todo_list',
          enabled: true,
          position: { x: 4, y: 0, w: 4, h: 5 },
        },
        {
          id: 'study_time_tracker',
          type: 'study_time_tracker',
          enabled: true,
          position: { x: 8, y: 0, w: 4, h: 5 },
        },
        {
          id: 'quick_notes',
          type: 'quick_notes',
          enabled: true,
          position: { x: 0, y: 5, w: 12, h: 6 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const academicOverview: WidgetTemplate = {
    id: 'academic_overview',
    name: 'Academic Overview',
    description: 'Grade Trends, Assessments, Deadlines, and Schedule',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'grade_trends',
          type: 'grade_trends',
          enabled: true,
          position: { x: 0, y: 0, w: 6, h: 6 },
        },
        {
          id: 'upcoming_assessments',
          type: 'upcoming_assessments',
          enabled: true,
          position: { x: 6, y: 0, w: 6, h: 6 },
        },
        {
          id: 'deadlines_calendar',
          type: 'deadlines_calendar',
          enabled: true,
          position: { x: 0, y: 6, w: 6, h: 6 },
        },
        {
          id: 'today_schedule',
          type: 'today_schedule',
          enabled: true,
          position: { x: 6, y: 6, w: 6, h: 6 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const minimalist: WidgetTemplate = {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean, simple layout with Schedule, Shortcuts, and Notes',
    isDefault: false,
    layout: {
      widgets: normalizeTemplateWidgets([
        {
          id: 'today_schedule',
          type: 'today_schedule',
          enabled: true,
          position: { x: 0, y: 0, w: 12, h: 6 },
        },
        {
          id: 'shortcuts',
          type: 'shortcuts',
          enabled: true,
          position: { x: 0, y: 6, w: 6, h: 4 },
        },
        {
          id: 'quick_notes',
          type: 'quick_notes',
          enabled: true,
          position: { x: 6, y: 6, w: 6, h: 6 },
        },
      ]),
      version: 1,
      lastModified: new Date(),
    },
  };

  const complete: WidgetTemplate = {
    id: 'complete',
    name: 'Complete',
    description: 'All widgets enabled',
    isDefault: true, // Only this one is default
    layout: widgetService.getDefaultLayout(),
  };

  return [
    studentFocus,
    analytics,
    quickAccess,
    productivityHub,
    academicOverview,
    minimalist,
    complete,
  ];
}

export const defaultTemplates: WidgetTemplate[] = createDefaultTemplates();

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
