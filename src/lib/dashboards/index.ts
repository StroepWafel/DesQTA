import type { WidgetTemplate } from '../services/widgetTemplates';
import type { WidgetConfig, WidgetLayout } from '../types/widgets';
import { WIDGET_LAYOUT_VERSION } from '../types/widgets';
import { widgetRegistry } from '../services/widgetRegistry';

type BundledDashboardFile = {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  layout: WidgetLayout;
};

const bundledModules = import.meta.glob('./bundled/*.json', { eager: true }) as Record<
  string,
  { default: BundledDashboardFile }
>;

function normalizeBundledWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
  return widgets.map((widget) => {
    const definition = widgetRegistry.get(widget.type);
    if (!definition) return widget;
    return {
      ...widget,
      position: {
        x: widget.position?.x ?? 0,
        y: widget.position?.y ?? 0,
        w: widget.position?.w ?? definition.defaultSize.w,
        h: widget.position?.h ?? definition.defaultSize.h,
        minW: widget.position?.minW ?? definition.minSize.w,
        minH: widget.position?.minH ?? definition.minSize.h,
        maxW: widget.position?.maxW ?? definition.maxSize.w,
        maxH: widget.position?.maxH ?? definition.maxSize.h,
      },
      settings: definition.defaultSettings
        ? { ...definition.defaultSettings, ...(widget.settings || {}) }
        : widget.settings,
    };
  });
}

/** Dashboard layouts shipped with the app (add JSON files under `bundled/`). */
export function getBundledDashboardTemplates(): WidgetTemplate[] {
  return Object.values(bundledModules).map(({ default: file }) => ({
    id: file.id,
    name: file.name,
    description: file.description,
    isDefault: file.isDefault ?? false,
    layout: {
      ...file.layout,
      layoutVersion: file.layout.layoutVersion ?? WIDGET_LAYOUT_VERSION,
      widgets: normalizeBundledWidgets(file.layout.widgets ?? []),
      lastModified: file.layout.lastModified ?? new Date().toISOString(),
    },
  }));
}
