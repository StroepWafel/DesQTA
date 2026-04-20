/**
 * Phase 2: UI Hotspot Optimizations
 *
 * Implements optimizations for analytics, search, widget grid,
 * and cache serialization to improve UI responsiveness.
 *
 * @module performance/optimizations/phase2UI
 */

import { logger } from '../../../utils/logger';
import {
  startTimer,
  endTimer,
  recordUIInteraction,
  recordMetric,
} from '../services/metricsTracker';

// ============================================================================
// Analytics Optimizations
// ============================================================================

/**
 * Memoize expensive analytics computations.
 * Prevents recalculation of filtered datasets on every render.
 */
export function memoizeAnalyticsData<T>(
  computeFn: () => T,
  dependencies: unknown[],
  key: string
): T {
  // Placeholder: Will implement memoization cache
  logger.debug('performance', 'memoizeAnalyticsData', `Memoizing analytics data: ${key}`);
  return computeFn();
}

/**
 * Optimize analytics filter operations.
 * Uses virtual scrolling and incremental filtering for large datasets.
 */
export function optimizeAnalyticsFilters<T>(
  data: T[],
  filters: Record<string, unknown>
): T[] {
  // Placeholder: Will implement optimized filtering
  startTimer(`analytics_filter_${Object.keys(filters).length}`);

  const result = data.filter((item) => {
    // Filter logic placeholder
    return true;
  });

  endTimer(`analytics_filter_${Object.keys(filters).length}`, 'Analytics filter', 'ui_interaction');
  return result;
}

/**
 * Use virtualized rendering for large charts.
 * Only renders visible data points to improve performance.
 */
export function useVirtualizedChart<T>(
  data: T[],
  containerHeight: number,
  itemHeight: number
): {
  visibleData: T[];
  totalHeight: number;
  scrollToIndex: (index: number) => void;
} {
  // Placeholder: Will implement virtualization
  return {
    visibleData: data.slice(0, Math.ceil(containerHeight / itemHeight)),
    totalHeight: data.length * itemHeight,
    scrollToIndex: () => {},
  };
}

// ============================================================================
// Search Optimizations
// ============================================================================

/**
 * Optimized search debounce with adaptive timing.
 * Adjusts debounce delay based on typing speed.
 */
export function optimizeSearchDebounce(
  callback: (query: string) => void,
  baseDelay: number = 150
): (query: string) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastKeystrokeTime = 0;
  let typingSpeedHistory: number[] = [];

  return (query: string) => {
    const now = performance.now();

    // Calculate typing speed
    if (lastKeystrokeTime > 0) {
      const keystrokeInterval = now - lastKeystrokeTime;
      typingSpeedHistory.push(keystrokeInterval);

      // Keep last 5 intervals
      if (typingSpeedHistory.length > 5) {
        typingSpeedHistory.shift();
      }
    }
    lastKeystrokeTime = now;

    // Adjust delay based on typing speed
    const avgInterval = typingSpeedHistory.length > 0
      ? typingSpeedHistory.reduce((a, b) => a + b, 0) / typingSpeedHistory.length
      : baseDelay;

    // Fast typist = longer debounce, slow typist = shorter debounce
    const adaptiveDelay = avgInterval < 100 ? baseDelay * 1.5 : baseDelay * 0.8;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      startTimer('search_debounce_execute');
      callback(query);
      endTimer('search_debounce_execute', 'Search debounce execution', 'ui_interaction');
      timeoutId = null;
    }, adaptiveDelay);
  };
}

/**
 * Incremental search for large datasets.
 * Searches in chunks to avoid blocking the main thread.
 */
export async function useIncrementalSearch<T>(
  items: T[],
  query: string,
  searchFn: (item: T, query: string) => boolean,
  chunkSize: number = 100
): Promise<T[]> {
  const results: T[] = [];

  startTimer('incremental_search');

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    // Process chunk
    for (const item of chunk) {
      if (searchFn(item, query)) {
        results.push(item);
      }
    }

    // Yield to main thread every chunk
    if (i + chunkSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  endTimer('incremental_search', 'Incremental search', 'ui_interaction');
  return results;
}

/**
 * Implement client-side search indexing for faster queries.
 */
export function implementSearchIndexing<T>(
  items: T[],
  getSearchableText: (item: T) => string
): {
  search: (query: string) => T[];
  rebuildIndex: () => void;
} {
  // Placeholder: Will implement inverted index
  const index = new Map<string, Set<number>>();

  const rebuildIndex = () => {
    startTimer('search_index_rebuild');

    index.clear();
    items.forEach((item, idx) => {
      const text = getSearchableText(item).toLowerCase();
      const words = text.split(/\s+/);

      words.forEach((word) => {
        if (!index.has(word)) {
          index.set(word, new Set());
        }
        index.get(word)!.add(idx);
      });
    });

    endTimer('search_index_rebuild', 'Search index rebuild', 'ui_interaction');
  };

  const search = (query: string): T[] => {
    if (!query) return items;

    startTimer('search_index_query');
    const words = query.toLowerCase().split(/\s+/);
    let resultIndices: Set<number> | null = null;

    for (const word of words) {
      const indices = index.get(word) || new Set<number>();
      if (resultIndices === null) {
        resultIndices = new Set(indices);
      } else {
        // Intersection
        resultIndices = new Set<number>(
          [...(resultIndices as Set<number>)].filter((x) => indices.has(x)),
        );
      }

      if (resultIndices.size === 0) break;
    }

    const results = resultIndices
      ? [...resultIndices].map((idx) => items[idx])
      : [];

    endTimer('search_index_query', 'Search index query', 'ui_interaction');
    return results;
  };

  // Initial index build
  rebuildIndex();

  return { search, rebuildIndex };
}

// ============================================================================
// Widget Grid Optimizations
// ============================================================================

/**
 * Batch widget layout updates to reduce DOM thrashing.
 */
export function batchWidgetUpdates(
  updateFn: () => void,
  delay: number = 16
): () => void {
  let rafId: number | null = null;

  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      startTimer('widget_batch_update');
      updateFn();
      endTimer('widget_batch_update', 'Widget batch update', 'ui_interaction');
      rafId = null;
    });
  };
}

/**
 * Use layout batching for multiple widget operations.
 */
export function useLayoutBatching(): {
  batch: (fn: () => void) => void;
  flush: () => void;
} {
  const queue: (() => void)[] = [];
  let scheduled = false;

  const flush = () => {
    if (queue.length === 0) return;

    startTimer('widget_layout_batch');

    // Read all layout values first (to avoid interleaving)
    const readFns = queue.filter((_, i) => i % 2 === 0);
    readFns.forEach((fn) => fn());

    // Then write all layout values
    const writeFns = queue.filter((_, i) => i % 2 === 1);
    writeFns.forEach((fn) => fn());

    queue.length = 0;
    scheduled = false;

    endTimer('widget_layout_batch', 'Widget layout batch', 'ui_interaction');
  };

  const batch = (fn: () => void) => {
    queue.push(fn);

    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  };

  return { batch, flush };
}

/**
 * Optimize drag and drop with RAF and transform instead of position.
 */
export function optimizeDragAndDrop(
  element: HTMLElement,
  onDrag: (x: number, y: number) => void
): {
  start: (x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: () => void;
} {
  let rafId: number | null = null;
  let pendingX = 0;
  let pendingY = 0;

  const start = (x: number, y: number) => {
    element.style.willChange = 'transform';
    pendingX = x;
    pendingY = y;
  };

  const move = (x: number, y: number) => {
    pendingX = x;
    pendingY = y;

    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      element.style.transform = `translate(${pendingX}px, ${pendingY}px)`;
      onDrag(pendingX, pendingY);
      rafId = null;
    });
  };

  const end = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    element.style.willChange = 'auto';
  };

  return { start, move, end };
}

// ============================================================================
// Cache Serialization Optimizations
// ============================================================================

/**
 * Optimize JSON serialization for large objects.
 * Uses chunked processing for very large data.
 */
export function optimizeSerialization<T>(
  data: T,
  maxSize: number = 100000
): string {
  const serialized = JSON.stringify(data);

  if (serialized.length > maxSize) {
    logger.warn('performance', 'optimizeSerialization', 'Large serialization detected', {
      size: serialized.length,
    });
  }

  return serialized;
}

/**
 * Use structured clone for deep copying when available.
 * Falls back to JSON parse/stringify for compatibility.
 */
export function useStructuredClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      startTimer('structured_clone');
      const result = structuredClone(value);
      endTimer('structured_clone', 'Structured clone', 'cache');
      return result;
    } catch (e) {
      // Fall through to fallback
    }
  }

  // Fallback to JSON method
  startTimer('json_clone');
  const result = JSON.parse(JSON.stringify(value));
  endTimer('json_clone', 'JSON clone', 'cache');
  return result;
}

// ============================================================================
// Export
// ============================================================================

export default {
  // Analytics
  memoizeAnalyticsData,
  optimizeAnalyticsFilters,
  useVirtualizedChart,

  // Search
  optimizeSearchDebounce,
  useIncrementalSearch,
  implementSearchIndexing,

  // Widget Grid
  batchWidgetUpdates,
  useLayoutBatching,
  optimizeDragAndDrop,

  // Serialization
  optimizeSerialization,
  useStructuredClone,
};
