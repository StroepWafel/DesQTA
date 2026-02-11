const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const ZOOM_STORAGE_KEY = 'desqta-zoom';

export function getZoom(): number {
  if (typeof document === 'undefined') return 1;
  const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
  return stored ? parseFloat(stored) : 1;
}

export function setZoom(zoom: number): number {
  if (typeof document === 'undefined') return 1;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  document.documentElement.style.zoom = String(clamped);
  localStorage.setItem(ZOOM_STORAGE_KEY, String(clamped));
  return clamped;
}

export function zoomIn(): number {
  return setZoom(getZoom() + ZOOM_STEP);
}

export function zoomOut(): number {
  return setZoom(getZoom() - ZOOM_STEP);
}

export function zoomReset(): number {
  return setZoom(1);
}

export function restoreZoom(): void {
  const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
  if (stored) {
    const zoom = parseFloat(stored);
    if (zoom >= ZOOM_MIN && zoom <= ZOOM_MAX) {
      document.documentElement.style.zoom = stored;
    }
  }
}

/** Restore zoom from settings (called by layout after loading from backend) */
export function restoreZoomFromLevel(level: number): void {
  if (typeof document === 'undefined') return;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));
  document.documentElement.style.zoom = String(clamped);
  localStorage.setItem(ZOOM_STORAGE_KEY, String(clamped));
}
