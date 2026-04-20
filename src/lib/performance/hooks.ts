/**
 * Performance Instrumentation Hooks
 *
 * Svelte-specific hooks and actions for measuring performance in components.
 * These integrate with the metrics tracker to provide easy-to-use performance
 * monitoring throughout the application.
 *
 * @module performance/hooks
 */

import { onMount, onDestroy, tick } from 'svelte';
import { browser } from '$app/environment';
import {
  startTimer,
  endTimer,
  recordMetric,
  mark,
  measure,
  recordRouteTransition,
  recordUIInteraction,
  type MetricCategory,
} from './services/metricsTracker';
import { logger } from '../../utils/logger';

// ============================================================================
// Svelte Actions for Performance Measurement
// ============================================================================

/**
 * Svelte action to measure component render time.
 *
 * Usage: <div use:measureRender={{ name: 'MyComponent', category: 'render' }}>
 */
export function measureRender(
  node: HTMLElement,
  params: { name: string; category?: MetricCategory }
) {
  if (!browser) return {};

  const { name, category = 'render' } = params;
  const startTime = performance.now();

  // Measure initial render
  tick().then(() => {
    const renderTime = performance.now() - startTime;
    recordMetric(
      `render_${name}_initial`,
      `Component ${name} initial render`,
      category,
      renderTime,
      'ms',
      { component: name }
    );
  });

  return {
    destroy() {
      // Could record unmount time if needed
    },
  };
}

/**
 * Svelte action to measure interaction latency on an element.
 *
 * Usage: <button use:measureInteraction={{ name: 'saveButton', type: 'click' }}>
 */
export function measureInteraction(
  node: HTMLElement,
  params: {
    name: string;
    type: 'click' | 'input' | 'drag' | 'resize';
    threshold?: number;
  }
) {
  if (!browser) return {};

  const { name, type, threshold = 50 } = params;
  let interactionStart = 0;

  const handleStart = () => {
    interactionStart = performance.now();
  };

  const handleEnd = () => {
    if (interactionStart === 0) return;
    const duration = performance.now() - interactionStart;
    interactionStart = 0;

    recordUIInteraction(type as any, duration, name);

    if (duration > threshold) {
      logger.warn('performance', 'measureInteraction', `Slow ${type} on ${name}`, {
        duration,
        threshold,
      });
    }
  };

  // Attach appropriate listeners based on interaction type
  if (type === 'click') {
    node.addEventListener('click', handleStart);
    // Use requestAnimationFrame to measure until visual update
    node.addEventListener('click', () => requestAnimationFrame(handleEnd));
  } else if (type === 'input') {
    node.addEventListener('input', handleStart);
    node.addEventListener('input', () => requestAnimationFrame(handleEnd));
  } else if (type === 'drag') {
    node.addEventListener('dragstart', handleStart);
    node.addEventListener('dragend', handleEnd);
  } else if (type === 'resize') {
    node.addEventListener('resizestart', handleStart);
    node.addEventListener('resizeend', handleEnd);
  }

  return {
    destroy() {
      if (type === 'click') {
        node.removeEventListener('click', handleStart);
      } else if (type === 'input') {
        node.removeEventListener('input', handleStart);
      } else if (type === 'drag') {
        node.removeEventListener('dragstart', handleStart);
        node.removeEventListener('dragend', handleEnd);
      } else if (type === 'resize') {
        node.removeEventListener('resizestart', handleStart);
        node.removeEventListener('resizeend', handleEnd);
      }
    },
  };
}

/**
 * Svelte action to measure scroll performance.
 *
 * Usage: <div use:measureScroll={{ name: 'contentArea' }}>
 */
export function measureScroll(node: HTMLElement, params: { name: string }) {
  if (!browser) return {};

  const { name } = params;
  let rafId: number | null = null;
  let scrollCount = 0;
  let lastScrollTime = 0;
  let totalScrollDuration = 0;

  const handleScroll = () => {
    const now = performance.now();
    if (lastScrollTime > 0) {
      totalScrollDuration += now - lastScrollTime;
    }
    lastScrollTime = now;
    scrollCount++;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      // Scroll event handled
    });
  };

  node.addEventListener('scroll', handleScroll, { passive: true });

  return {
    destroy() {
      node.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);

      // Record scroll performance metrics
      if (scrollCount > 0) {
        const avgScrollTime = totalScrollDuration / scrollCount;
        recordMetric(
          `scroll_${name}_avg_time`,
          `Average scroll handling time for ${name}`,
          'render',
          avgScrollTime,
          'ms',
          { component: name, scrollCount }
        );
      }
    },
  };
}

// ============================================================================
// Component Lifecycle Hooks
// ============================================================================

/**
 * Hook to measure component mount time.
 *
 * Usage: onMount(measureMount('MyComponent'));
 */
export function measureMount(componentName: string): () => void {
  if (!browser) return () => {};

  const startTime = performance.now();

  return () => {
    const mountTime = performance.now() - startTime;
    recordMetric(
      `component_${componentName}_mount`,
      `Component ${componentName} mount time`,
      'render',
      mountTime,
      'ms',
      { component: componentName }
    );
  };
}

/**
 * Hook to measure component update/render cycles.
 *
 * Usage: $effect(() => { measureUpdate('MyComponent'); });
 */
let updateTimers = new Map<string, number>();

export function measureUpdate(componentName: string): void {
  if (!browser) return;

  const now = performance.now();
  const lastUpdate = updateTimers.get(componentName);

  if (lastUpdate) {
    const timeSinceLastUpdate = now - lastUpdate;
    // Only record if significant time has passed (avoid spam)
    if (timeSinceLastUpdate > 16) {
      recordMetric(
        `component_${componentName}_update`,
        `Component ${componentName} update time`,
        'render',
        timeSinceLastUpdate,
        'ms',
        { component: componentName }
      );
    }
  }

  updateTimers.set(componentName, now);
}

/**
 * Hook to measure async operation time.
 *
 * Usage: const timedFetch = measureAsync('fetchData', fetch);
 */
export function measureAsync<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  category: MetricCategory = 'backend_command'
): T {
  if (!browser) return fn;

  return (async (...args: any[]) => {
    startTimer(`async_${name}`, { args: args.length > 0 ? 'with args' : 'no args' });
    try {
      const result = await fn(...args);
      endTimer(`async_${name}`, `Async operation: ${name}`, category);
      return result;
    } catch (error) {
      endTimer(`async_${name}`, `Async operation: ${name} (failed)`, category);
      throw error;
    }
  }) as T;
}

// ============================================================================
// Navigation & Route Hooks
// ============================================================================

let routeStartTime = 0;
let currentRoute = '';

/** Normalized id for route_* metrics and User Timing marks (matches recordRouteTransition). */
export function routePathToMetricId(pathname: string): string {
  const p = pathname || '/';
  return p.replace(/^\//, '').replace(/\//g, '_') || 'root';
}

/**
 * Call at the start of route navigation.
 */
export function startRouteTransition(route: string): void {
  if (!browser) return;

  currentRoute = route;
  routeStartTime = performance.now();
  const id = routePathToMetricId(route);
  mark(`route_${id}_start`);
}

/**
 * Call when route navigation completes.
 */
export function endRouteTransition(route?: string): void {
  if (!browser || routeStartTime === 0) return;

  const duration = performance.now() - routeStartTime;
  const targetRoute = route || currentRoute;
  const id = routePathToMetricId(targetRoute);

  recordRouteTransition(targetRoute, duration);
  mark(`route_${id}_end`);
  measure(`route_${id}_transition`, `route_${id}_start`, `route_${id}_end`);

  routeStartTime = 0;
}

/**
 * Hook to measure page load performance.
 *
 * Usage: In +page.svelte: measurePageLoad('analytics');
 */
export function measurePageLoad(pageName: string): { onComplete: () => void } {
  if (!browser) return { onComplete: () => {} };

  const startTime = performance.now();
  let isComplete = false;

  return {
    onComplete: () => {
      if (isComplete) return;
      isComplete = true;

      const loadTime = performance.now() - startTime;
      recordMetric(
        `page_${pageName}_load`,
        `Page ${pageName} load time`,
        'route_transition',
        loadTime,
        'ms',
        { page: pageName }
      );

      // Log slow page loads
      if (loadTime > 1000) {
        logger.warn('performance', 'measurePageLoad', `Slow page load: ${pageName}`, {
          loadTime,
        });
      }
    },
  };
}

// ============================================================================
// Startup Timing Hooks
// ============================================================================

type StartupPhase =
  | 'app_start'
  | 'layout_mount'
  | 'cache_load'
  | 'settings_load'
  | 'shell_ready'
  | 'first_paint'
  | 'interactive'
  | 'dashboard_ready';

const startupPhases: StartupPhase[] = [
  'app_start',
  'layout_mount',
  'cache_load',
  'settings_load',
  'shell_ready',
  'first_paint',
  'interactive',
  'dashboard_ready',
];

const phaseTimings = new Map<StartupPhase, number>();

/**
 * Record a startup phase completion.
 */
export function recordStartupPhase(phase: StartupPhase): void {
  if (!browser) return;

  const now = performance.now();
  phaseTimings.set(phase, now);

  mark(`startup_${phase}`);

  // Calculate time from app start
  const appStart = phaseTimings.get('app_start') || now;
  const elapsed = now - appStart;

  recordMetric(
    `startup_phase_${phase}`,
    `Startup phase: ${phase}`,
    'startup',
    elapsed,
    'ms',
    { phase }
  );

  // First perf tick after app instrumentation: performance.now() is already ms since navigation.
  if (phase === 'app_start') {
    recordMetric(
      'startup_cold_start_time',
      'Cold start time from navigation (first instrumentation tick)',
      'startup',
      now,
      'ms',
      { phase }
    );
  }

  // Log progress through startup phases
  if (phase === 'interactive') {
    logger.info('performance', 'recordStartupPhase', 'App became interactive', {
      timeToInteractive: elapsed,
    });
  }
}

/**
 * Get timing data for all startup phases.
 */
export function getStartupTimings(): Record<StartupPhase, number> {
  const result = {} as Record<StartupPhase, number>;
  for (const [phase, time] of phaseTimings) {
    result[phase] = time;
  }
  return result;
}

// ============================================================================
// Batch Measurement Utilities
// ============================================================================

interface BatchMeasurement {
  name: string;
  category: MetricCategory;
  startTime: number;
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
}

const batchMeasurements = new Map<string, BatchMeasurement>();

/**
 * Start a batched measurement.
 * Useful for measuring multiple similar operations (e.g., many cache reads).
 */
export function startBatchMeasurement(name: string, category: MetricCategory): void {
  if (!batchMeasurements.has(name)) {
    batchMeasurements.set(name, {
      name,
      category,
      startTime: performance.now(),
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
    });
  }
}

/**
 * Record a single sample in a batched measurement.
 */
export function recordBatchSample(name: string, duration: number): void {
  const batch = batchMeasurements.get(name);
  if (!batch) return;

  batch.count++;
  batch.totalTime += duration;
  batch.minTime = Math.min(batch.minTime, duration);
  batch.maxTime = Math.max(batch.maxTime, duration);
}

/**
 * End a batched measurement and record aggregated metrics.
 */
export function endBatchMeasurement(name: string): void {
  const batch = batchMeasurements.get(name);
  if (!batch || batch.count === 0) return;

  const avgTime = batch.totalTime / batch.count;

  recordMetric(
    `${name}_batch_avg`,
    `${name} batch average`,
    batch.category,
    avgTime,
    'ms',
    {
      count: batch.count,
      min: batch.minTime,
      max: batch.maxTime,
      total: batch.totalTime,
    }
  );

  batchMeasurements.delete(name);
}

// ============================================================================
// Long Task Detection
// ============================================================================

/**
 * Enable long task detection using PerformanceObserver.
 * Logs warnings when tasks block the main thread for too long.
 */
export function enableLongTaskDetection(thresholdMs: number = 50): () => void {
  if (!browser || !('PerformanceObserver' in window)) return () => {};

  let longTaskCount = 0;
  let totalLongTaskTime = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const duration = (entry as PerformanceEntry).duration;
      if (duration > thresholdMs) {
        longTaskCount++;
        totalLongTaskTime += duration;

        logger.warn('performance', 'longTask', 'Long task detected', {
          duration,
          threshold: thresholdMs,
          count: longTaskCount,
        });

        // Record as metric every 5 long tasks
        if (longTaskCount % 5 === 0) {
          recordMetric(
            'long_tasks_detected',
            'Long tasks detected',
            'render',
            longTaskCount,
            'count',
            { totalTime: totalLongTaskTime }
          );
        }
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // Long task observer not supported
    return () => {};
  }

  // Return cleanup function
  return () => {
    observer.disconnect();
  };
}

// ============================================================================
// Frame Rate Monitoring
// ============================================================================

/**
 * Monitor frame rate during animations or interactions.
 *
 * Usage:
 *   const monitor = startFrameRateMonitor();
 *   // ... do work ...
 *   const stats = monitor.stop();
 */
export function startFrameRateMonitor(): { stop: () => { avgFps: number; minFps: number; samples: number } } {
  if (!browser) {
    return {
      stop: () => ({ avgFps: 60, minFps: 60, samples: 0 }),
    };
  }

  let frames = 0;
  let lastTime = performance.now();
  let fpsValues: number[] = [];
  let rafId: number;

  const sampleFps = () => {
    const now = performance.now();
    const delta = now - lastTime;
    frames++;

    if (delta >= 1000) {
      const fps = (frames * 1000) / delta;
      fpsValues.push(fps);
      frames = 0;
      lastTime = now;
    }

    rafId = requestAnimationFrame(sampleFps);
  };

  rafId = requestAnimationFrame(sampleFps);

  return {
    stop: () => {
      cancelAnimationFrame(rafId);

      if (fpsValues.length === 0) {
        return { avgFps: 60, minFps: 60, samples: 0 };
      }

      const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
      const minFps = Math.min(...fpsValues);

      recordMetric('frame_rate_avg', 'Average frame rate', 'render', avgFps, 'count', {
        minFps,
        samples: fpsValues.length,
      });

      return { avgFps, minFps, samples: fpsValues.length };
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Debounce function that also tracks performance.
 */
export function debounceWithMetrics<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  name: string
): (...args: Parameters<T>) => void {
  if (!browser) return fn;

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = performance.now();

    if (lastCallTime > 0) {
      const timeSinceLastCall = now - lastCallTime;
      recordMetric(
        `debounce_${name}_interval`,
        `Debounce interval for ${name}`,
        'ui_interaction',
        timeSinceLastCall,
        'ms',
        { name }
      );
    }

    lastCallTime = now;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      const executeStart = performance.now();
      fn(...args);
      const executeTime = performance.now() - executeStart;

      recordMetric(
        `debounce_${name}_execute`,
        `Debounce execution time for ${name}`,
        'ui_interaction',
        executeTime,
        'ms',
        { name }
      );

      timeout = null;
    }, wait);
  };
}

/**
 * Throttle function that also tracks performance.
 */
export function throttleWithMetrics<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  name: string
): (...args: Parameters<T>) => void {
  if (!browser) return fn;

  let inThrottle = false;
  let lastCallTime = 0;
  let callCount = 0;
  let throttledCount = 0;

  return (...args: Parameters<T>) => {
    callCount++;

    if (!inThrottle) {
      const executeStart = performance.now();
      fn(...args);
      const executeTime = performance.now() - executeStart;

      recordMetric(
        `throttle_${name}_execute`,
        `Throttle execution time for ${name}`,
        'ui_interaction',
        executeTime,
        'ms',
        { name }
      );

      inThrottle = true;
      lastCallTime = performance.now();

      setTimeout(() => {
        inThrottle = false;

        // Record stats when throttle period ends
        if (callCount > 0) {
          recordMetric(
            `throttle_${name}_stats`,
            `Throttle stats for ${name}`,
            'ui_interaction',
            throttledCount,
            'count',
            {
              totalCalls: callCount,
              throttledCalls: throttledCount,
              throttleRate: throttledCount / callCount,
            }
          );
          callCount = 0;
          throttledCount = 0;
        }
      }, limit);
    } else {
      throttledCount++;
    }
  };
}

// ============================================================================
// Export all hooks
// ============================================================================

export default {
  measureRender,
  measureInteraction,
  measureScroll,
  measureMount,
  measureUpdate,
  measureAsync,
  startRouteTransition,
  endRouteTransition,
  measurePageLoad,
  recordStartupPhase,
  getStartupTimings,
  startBatchMeasurement,
  recordBatchSample,
  endBatchMeasurement,
  enableLongTaskDetection,
  startFrameRateMonitor,
  debounceWithMetrics,
  throttleWithMetrics,
};
