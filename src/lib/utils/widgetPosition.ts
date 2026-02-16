import type { WidgetConfig, WidgetPosition } from '../types/widgets';

/**
 * Checks if two widgets collide (overlap)
 */
function checkCollision(
  newWidget: { x: number; y: number; w: number; h: number },
  existingWidget: { x: number; y: number; w: number; h: number },
): boolean {
  // Check if widgets don't overlap (if any of these conditions are true, they don't collide)
  const noCollision =
    newWidget.x + newWidget.w <= existingWidget.x ||
    newWidget.x >= existingWidget.x + existingWidget.w ||
    newWidget.y + newWidget.h <= existingWidget.y ||
    newWidget.y >= existingWidget.y + existingWidget.h;

  // Return true if they collide (opposite of noCollision)
  return !noCollision;
}

/**
 * Checks if a position is valid (doesn't collide with existing widgets and fits in grid)
 */
function isValidPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  existingWidgets: WidgetConfig[],
  gridColumns: number = 12,
): boolean {
  // Check if widget fits within grid bounds
  if (x < 0 || y < 0 || x + w > gridColumns) {
    return false;
  }

  // Check for collisions with existing enabled widgets
  const newWidgetBounds = { x, y, w, h };
  return !existingWidgets
    .filter((widget) => widget.enabled)
    .some((widget) => {
      const existingBounds = {
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.w,
        h: widget.position.h,
      };
      return checkCollision(newWidgetBounds, existingBounds);
    });
}

/**
 * Calculates the next available position for a new widget
 * Searches from top-left (y=0, x=0) systematically to find the first valid spot
 *
 * @param existingWidgets - Array of existing widgets in the layout
 * @param minW - Minimum width of the new widget
 * @param minH - Minimum height of the new widget
 * @param defaultW - Default width of the new widget
 * @param defaultH - Default height of the new widget
 * @param gridColumns - Number of columns in the grid (default: 12)
 * @returns Position object with x, y, w, h
 */
export function calculateNextAvailablePosition(
  existingWidgets: WidgetConfig[],
  minW: number,
  minH: number,
  defaultW: number,
  defaultH: number,
  gridColumns: number = 12,
): WidgetPosition {
  // Edge case: Empty grid - place at top-left
  const enabledWidgets = existingWidgets.filter((w) => w.enabled);
  if (enabledWidgets.length === 0) {
    return {
      x: 0,
      y: 0,
      w: defaultW,
      h: defaultH,
    };
  }

  // Ensure minW doesn't exceed grid width
  const effectiveMinW = Math.min(minW, gridColumns);
  const effectiveDefaultW = Math.min(defaultW, gridColumns);

  // Try to find a position that fits the default size first
  // Search systematically: start at y=0, try all x positions, then increment y
  const maxY = enabledWidgets.reduce(
    (max, w) => Math.max(max, w.position.y + w.position.h),
    0,
  );

  // Search up to maxY + defaultH to allow placing below existing widgets
  for (let y = 0; y <= maxY + defaultH; y++) {
    // Try all possible x positions for this y
    for (let x = 0; x <= gridColumns - effectiveMinW; x++) {
      // First try default size
      if (isValidPosition(x, y, effectiveDefaultW, defaultH, enabledWidgets, gridColumns)) {
        return {
          x,
          y,
          w: effectiveDefaultW,
          h: defaultH,
        };
      }

      // If default doesn't fit, try minimum size
      if (
        (effectiveDefaultW !== effectiveMinW || defaultH !== minH) &&
        isValidPosition(x, y, effectiveMinW, minH, enabledWidgets, gridColumns)
      ) {
        return {
          x,
          y,
          w: effectiveMinW,
          h: minH,
        };
      }
    }
  }

  // Fallback: If no space found, place at bottom (current behavior)
  // This handles edge cases where grid is very full
  return {
    x: 0,
    y: maxY,
    w: effectiveDefaultW,
    h: defaultH,
  };
}
