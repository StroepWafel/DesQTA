import { getContext, setContext } from 'svelte';
import type { WidgetConfig, WidgetLayout } from '../types/widgets';

export const DASHBOARD_EDIT_CONTEXT_KEY = Symbol('dashboard-edit');

export interface DashboardEditContext {
  isEditing: () => boolean;
  layout: () => WidgetLayout;
  getWidgetById: (id: string) => WidgetConfig | undefined;
  draggingWidgetId: () => string | null;
  stackDropTargetId: () => string | null;
  openStackPanelId: () => string | null;
  setOpenStackPanelId: (id: string | null) => void;
  setStackDropTargetId: (id: string | null) => void;
  addToStack: (hostId: string, memberId: string) => Promise<void>;
  removeFromStack: (memberId: string) => Promise<void>;
  setStackActiveIndex: (hostId: string, index: number) => Promise<void>;
  createStack: (hostId: string) => Promise<void>;
}

export function setDashboardEditContext(ctx: DashboardEditContext) {
  setContext(DASHBOARD_EDIT_CONTEXT_KEY, ctx);
}

export function getDashboardEditContext(): DashboardEditContext | undefined {
  return getContext<DashboardEditContext>(DASHBOARD_EDIT_CONTEXT_KEY);
}
