export type WidgetType =
  | 'upcoming_assessments'
  | 'messages_preview'
  | 'today_schedule'
  | 'shortcuts'
  | 'notices'
  | 'news'
  | 'welcome_portal'
  | 'homework'
  | 'todo_list'
  | 'focus_timer'
  | 'grade_trends'
  | 'study_time_tracker'
  | 'deadlines_calendar'
  | 'quick_notes'
  | 'weather';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  position: WidgetPosition;
  enabled: boolean;
  settings?: Record<string, any>;
  title?: string;
}

export interface WidgetLayout {
  widgets: WidgetConfig[];
  version: number;
  lastModified: Date | string;
}

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: any; // Svelte component
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  defaultSettings?: Record<string, any>;
  settingsSchema?: WidgetSettingsSchema;
  component: any; // Svelte component constructor
}

export interface WidgetSettingsSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'color';
    label: string;
    default?: any;
    options?: { value: any; label: string }[];
    min?: number;
    max?: number;
  };
}
