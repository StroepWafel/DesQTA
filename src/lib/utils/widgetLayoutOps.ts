import type { WidgetConfig, WidgetPosition } from '../types/widgets';
import { widgetRegistry } from '../services/widgetRegistry';
import { calculateNextAvailablePosition } from './widgetPosition';

export function getWidgetBounds(widget: WidgetConfig) {
  const definition = widgetRegistry.get(widget.type);
  return {
    minW: widget.position.minW ?? definition?.minSize.w ?? 1,
    minH: widget.position.minH ?? definition?.minSize.h ?? 1,
    maxW: widget.position.maxW ?? definition?.maxSize.w ?? 12,
    maxH: widget.position.maxH ?? definition?.maxSize.h ?? 12,
  };
}

export function canWidgetFitSize(widget: WidgetConfig, w: number, h: number): boolean {
  const { minW, minH, maxW, maxH } = getWidgetBounds(widget);
  return w >= minW && w <= maxW && h >= minH && h <= maxH;
}

export function widgetsOverlap(a: WidgetPosition, b: WidgetPosition): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function centerInPosition(pos: WidgetPosition): { cx: number; cy: number } {
  return { cx: pos.x + pos.w / 2, cy: pos.y + pos.h / 2 };
}

export function pointInPosition(px: number, py: number, pos: WidgetPosition): boolean {
  return px >= pos.x && px < pos.x + pos.w && py >= pos.y && py < pos.y + pos.h;
}

/** True when widget A's center lies inside widget B's grid cell. */
export function isCenterOverWidget(
  dragged: WidgetConfig,
  target: WidgetConfig,
  draggedPos?: WidgetPosition,
): boolean {
  const pos = draggedPos ?? dragged.position;
  const { cx, cy } = centerInPosition(pos);
  return pointInPosition(cx, cy, target.position);
}

export function canSwapWidgets(
  a: WidgetConfig,
  b: WidgetConfig,
  aOrigin: WidgetPosition,
): boolean {
  if (a.id === b.id) return false;
  if (a.stackedIn || b.stackedIn) return false;
  if (a.stack?.memberIds?.length || b.stack?.memberIds?.length) return false;

  const aTargetSize = b.position;
  const bTargetSize = aOrigin;

  return (
    canWidgetFitSize(a, aTargetSize.w, aTargetSize.h) &&
    canWidgetFitSize(b, bTargetSize.w, bTargetSize.h)
  );
}

export function swapWidgetPositions(
  a: WidgetConfig,
  b: WidgetConfig,
  aOrigin: WidgetPosition,
): void {
  const nextA: WidgetPosition = {
    ...a.position,
    x: b.position.x,
    y: b.position.y,
    w: b.position.w,
    h: b.position.h,
  };
  const nextB: WidgetPosition = {
    ...b.position,
    x: aOrigin.x,
    y: aOrigin.y,
    w: aOrigin.w,
    h: aOrigin.h,
  };
  a.position = nextA;
  b.position = nextB;
}

export function isGridWidget(widget: WidgetConfig): boolean {
  return widget.enabled && !widget.stackedIn;
}

export function getStackMembers(layout: WidgetConfig[], host: WidgetConfig): WidgetConfig[] {
  const ids = host.stack?.memberIds ?? [];
  return ids
    .map((id) => layout.find((w) => w.id === id))
    .filter((w): w is WidgetConfig => !!w);
}

export function addWidgetToStackInLayout(
  layout: WidgetConfig[],
  hostId: string,
  memberId: string,
): boolean {
  if (hostId === memberId) return false;

  const host = layout.find((w) => w.id === hostId);
  const member = layout.find((w) => w.id === memberId);
  if (!host || !member) return false;
  if (member.stackedIn) return false;
  if (host.stackedIn) return false;
  if (member.stack?.memberIds?.length) return false;

  if (!host.stack) {
    host.stack = { memberIds: [], activeIndex: 0 };
  }
  if (host.stack.memberIds.includes(memberId)) return false;
  if (host.stack.memberIds.length >= 7) return false;

  host.stack.memberIds.push(memberId);
  member.stackedIn = hostId;
  return true;
}

export function removeWidgetFromStackInLayout(
  layout: WidgetConfig[],
  memberId: string,
  placedOnGrid: WidgetConfig[],
): boolean {
  const member = layout.find((w) => w.id === memberId);
  if (!member?.stackedIn) return false;

  const host = layout.find((w) => w.id === member.stackedIn);
  if (host?.stack) {
    host.stack.memberIds = host.stack.memberIds.filter((id) => id !== memberId);
    if (host.stack.activeIndex >= host.stack.memberIds.length + 1) {
      host.stack.activeIndex = Math.max(0, host.stack.memberIds.length);
    }
  }

  delete member.stackedIn;
  const def = widgetRegistry.get(member.type);
  const pos = calculateNextAvailablePosition(
    placedOnGrid,
    def?.minSize.w ?? 1,
    def?.minSize.h ?? 1,
    def?.defaultSize.w ?? member.position.w,
    def?.defaultSize.h ?? member.position.h,
  );
  member.position = { ...member.position, ...pos };
  return true;
}

export function releaseStackMembers(
  layout: WidgetConfig[],
  hostId: string,
  placedOnGrid: WidgetConfig[],
): void {
  const host = layout.find((w) => w.id === hostId);
  if (!host?.stack?.memberIds.length) return;

  const memberIds = [...host.stack.memberIds];
  for (const memberId of memberIds) {
    removeWidgetFromStackInLayout(layout, memberId, placedOnGrid);
    const released = layout.find((w) => w.id === memberId);
    if (released) placedOnGrid.push(released);
  }
  delete host.stack;
}
