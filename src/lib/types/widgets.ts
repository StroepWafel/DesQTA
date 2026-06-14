/** Bump this whenever the persisted layout schema changes in an incompatible way. */
export const WIDGET_LAYOUT_VERSION = 3;

/** Logical grouping shown in the "Add widget" dialog. */
export type WidgetCategory = 'schedule' | 'academic' | 'communication' | 'tools' | 'reading';

export type WidgetType =
  | 'timetable'
  | 'deadlines'
  | 'grade_trends'
  | 'messages_preview'
  | 'notices'
  | 'news'
  | 'shortcuts'
  | 'quick_notes'
  | 'study_timer'
  | 'weather'
  | 'welcome_portal';

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

export interface WidgetStackState {
  /** Widget ids stacked inside this host (excluding the host itself). */
  memberIds: string[];
  /** 0 = host widget; 1+ = member index */
  activeIndex: number;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  position: WidgetPosition;
  enabled: boolean;
  settings?: Record<string, any>;
  title?: string;
  /** When set, this widget is rendered inside another widget's stack carousel. */
  stackedIn?: string;
  /** Stack container state — only on the host widget. */
  stack?: WidgetStackState;
}

export interface WidgetLayout {
  widgets: WidgetConfig[];
  version: number;
  /** Schema version of the persisted blob. Owned by widgetMigration. */
  layoutVersion?: number;
  lastModified: Date | string;
}

export interface WidgetSize {
  w: number;
  h: number;
}

export interface WidgetSettingsSchemaField {
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  label: string;
  /** Optional inline help text shown beneath the field label. */
  description?: string;
  default?: any;
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
}

export interface WidgetSettingsSchema {
  [key: string]: WidgetSettingsSchemaField;
}

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  /** Logical category used in the Add Widget dialog. Defaults to 'tools'. */
  category?: WidgetCategory;
  icon: any; // Svelte component
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  /** Mobile layout: full-width by definition; height is in grid units. */
  mobileSize?: WidgetSize;
  /** Order in the mobile stack (lower = higher up). Defaults to registration order. */
  mobileOrder?: number;
  /** When false, the widget cannot be resized on the grid. Defaults to true. */
  resizable?: boolean;
  defaultSettings?: Record<string, any>;
  settingsSchema?: WidgetSettingsSchema;
  component: any; // Svelte component constructor
}
