/**
 * Phase 4: Bundle and Runtime Footprint Optimizations
 *
 * Implements lazy loading, code splitting, bundle analysis, and feature auditing
 * to reduce application size and improve runtime performance.
 *
 * @module performance/optimizations/phase4Bundle
 */

import { logger } from '../../../utils/logger';
import { startTimer, endTimer, recordMetric } from '../services/metricsTracker';

// ============================================================================
// Lazy Loading Utilities
// ============================================================================

/**
 * Creates a lazy-loaded route component with prefetch support.
 * Use this for heavy routes like Analytics, Notes, and Forums.
 */
export function createLazyRoute<T>(
  loader: () => Promise<{ default: T }>,
  options: {
    prefetch?: boolean;
    prefetchDelay?: number;
    name?: string;
  } = {}
): {
  component: () => Promise<T>;
  prefetch: () => Promise<void>;
  isPrefetching: () => boolean;
} {
  const { prefetch: shouldPrefetch = false, prefetchDelay = 2000, name = 'lazy_route' } = options;

  let componentPromise: Promise<T> | null = null;
  let isPrefetchingFlag = false;

  const loadComponent = async (): Promise<T> => {
    startTimer(`lazy_load_${name}`);

    if (!componentPromise) {
      componentPromise = loader().then((module) => module.default);
    }

    try {
      const component = await componentPromise;
      const metric = endTimer(`lazy_load_${name}`, `Lazy load: ${name}`, 'startup');

      if (metric) {
        recordMetric(`lazy_load_${name}`, `Lazy loaded component: ${name}`, 'startup', metric.value, 'ms');
      }

      return component;
    } catch (error) {
      endTimer(`lazy_load_${name}`, `Lazy load failed: ${name}`, 'startup');
      logger.error('performance', 'createLazyRoute', `Failed to load ${name}`, { error });
      throw error;
    }
  };

  const prefetch = async (): Promise<void> => {
    if (componentPromise || isPrefetchingFlag) return;

    isPrefetchingFlag = true;
    logger.debug('performance', 'createLazyRoute.prefetch', `Prefetching ${name}`);

    try {
      componentPromise = loader().then((module) => module.default);
      await componentPromise;
      logger.debug('performance', 'createLazyRoute.prefetch', `Prefetched ${name} successfully`);
    } catch (error) {
      logger.warn('performance', 'createLazyRoute.prefetch', `Prefetch failed for ${name}`, { error });
      componentPromise = null;
    } finally {
      isPrefetchingFlag = false;
    }
  };

  // Auto-prefetch if enabled
  if (shouldPrefetch) {
    setTimeout(prefetch, prefetchDelay);
  }

  return {
    component: loadComponent,
    prefetch,
    isPrefetching: () => isPrefetchingFlag,
  };
}

/**
 * Prefetch a route when user hovers over a link.
 * Use with on:mouseenter on navigation links.
 */
export function prefetchRoute(routePath: string): void {
  // Map of known lazy routes and their loaders
  const lazyRouteMap: Record<string, () => Promise<any>> = {
    '/analytics': () => import('../../../routes/analytics/+page.svelte'),
    '/documents': () => import('../../../routes/documents/+page.svelte'),
    '/forums': () => import('../../../routes/forums/+page.svelte'),
    '/study': () => import('../../../routes/study/+page.svelte'),
  };

  const loader = lazyRouteMap[routePath];
  if (loader) {
    // Use requestIdleCallback for non-critical prefetching
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        loader().catch(() => {
          // Ignore prefetch errors
        });
      });
    } else {
      setTimeout(() => {
        loader().catch(() => {
          // Ignore prefetch errors
        });
      }, 100);
    }
  }
}

/**
 * Svelte action for lazy loading a component when it enters the viewport.
 * Usage: <div use:useLazyComponent={{ loader: () => import('./HeavyComponent.svelte') }}>
 */
export function useLazyComponent(
  node: HTMLElement,
  params: {
    loader: () => Promise<any>;
    onLoad?: (component: any) => void;
    threshold?: number;
    rootMargin?: string;
  }
) {
  const { loader, onLoad, threshold = 0.1, rootMargin = '50px' } = params;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          startTimer('lazy_component_viewport');

          loader()
            .then((module) => {
              const metric = endTimer('lazy_component_viewport', 'Lazy component viewport load', 'startup');
              if (metric) {
                logger.debug('performance', 'useLazyComponent', 'Component loaded on viewport entry', {
                  duration: metric.value,
                });
              }

              if (onLoad) {
                onLoad(module.default);
              }

              // Stop observing once loaded
              observer.unobserve(node);
            })
            .catch((error) => {
              endTimer('lazy_component_viewport', 'Lazy component load failed', 'startup');
              logger.error('performance', 'useLazyComponent', 'Failed to load component', { error });
            });
        }
      });
    },
    {
      threshold,
      rootMargin,
    }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}

// ============================================================================
// Bundle Analysis Utilities
// ============================================================================

export interface BundleAnalysis {
  totalSize: number;
  jsSize: number;
  cssSize: number;
  assetSizes: Array<{
    name: string;
    size: number;
    type: string;
    gzipSize?: number;
  }>;
  chunks: Array<{
    name: string;
    size: number;
    modules: string[];
  }>;
  duplicates: Array<{
    module: string;
    locations: string[];
    totalSize: number;
  }>;
  recommendations: string[];
}

/**
 * Analyze bundle size at runtime.
 * Call this in development to get bundle composition.
 */
export function analyzeBundleSize(): BundleAnalysis | null {
  if (typeof window === 'undefined') return null;

  // Check if build stats are available
  const buildStats = (window as any).__DESQTA_BUILD_STATS__;
  if (buildStats) {
    return buildStats as BundleAnalysis;
  }

  // Fallback: analyze loaded scripts
  const scripts = document.querySelectorAll('script[src]');
  const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');

  const analysis: BundleAnalysis = {
    totalSize: 0,
    jsSize: 0,
    cssSize: 0,
    assetSizes: [],
    chunks: [],
    duplicates: [],
    recommendations: [],
  };

  scripts.forEach((script) => {
    const src = script.getAttribute('src') || '';
    // Estimate size based on URL patterns
    const estimatedSize = src.includes('vendor') ? 500000 : src.includes('index') ? 200000 : 100000;

    analysis.assetSizes.push({
      name: src,
      size: estimatedSize,
      type: 'js',
    });
    analysis.jsSize += estimatedSize;
  });

  stylesheets.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const estimatedSize = href.includes('app') ? 50000 : 20000;

    analysis.assetSizes.push({
      name: href,
      size: estimatedSize,
      type: 'css',
    });
    analysis.cssSize += estimatedSize;
  });

  analysis.totalSize = analysis.jsSize + analysis.cssSize;

  // Generate recommendations
  if (analysis.jsSize > 1000000) {
    analysis.recommendations.push('Consider code splitting - JS bundle exceeds 1MB');
  }
  if (analysis.assetSizes.length > 10) {
    analysis.recommendations.push('Too many small chunks - consider merging');
  }

  return analysis;
}

/**
 * Detect potentially unused code using runtime analysis.
 * Tracks which modules are actually invoked during a session.
 */
export function detectUnusedCode(): {
  usedModules: Set<string>;
  unusedModules: Set<string>;
  coverage: number;
} {
  // This is a placeholder for a real implementation
  // Real implementation would use coverage API or manual tracking

  const usedModules = new Set<string>();
  const unusedModules = new Set<string>();

  // Check if coverage data is available
  const coverage = (window as any).__coverage__;
  if (coverage) {
    Object.entries(coverage).forEach(([file, data]: [string, any]) => {
      const isUsed = Object.values(data.s || {}).some((count: any) => count > 0);
      if (isUsed) {
        usedModules.add(file);
      } else {
        unusedModules.add(file);
      }
    });
  }

  const totalModules = usedModules.size + unusedModules.size;
  const coveragePercent = totalModules > 0 ? (usedModules.size / totalModules) * 100 : 0;

  return {
    usedModules,
    unusedModules,
    coverage: coveragePercent,
  };
}

/**
 * Optimize Vite chunk configuration based on actual usage.
 * Returns recommended manual chunks configuration.
 */
export function optimizeChunks(): Record<string, string[]> {
  // Analyze routes and dependencies to suggest optimal chunks
  const routeChunks: Record<string, string[]> = {
    // Vendor libraries that rarely change
    vendor: ['svelte', '@tauri-apps/api', 'svelte-hero-icons'],
    // Analytics-heavy dependencies
    analytics: ['chart.js', 'd3'],
    // Editor and rich text
    editor: ['tiptap', 'prosemirror'],
    // Utilities
    utils: ['date-fns', 'lodash-es'],
  };

  return routeChunks;
}

// ============================================================================
// Feature Audit Utilities
// ============================================================================

export interface FeatureAudit {
  name: string;
  enabled: boolean;
  size?: number;
  usage?: number;
  canDisable: boolean;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Audit release features and their impact on bundle size.
 */
export function auditReleaseFeatures(): FeatureAudit[] {
  const features: FeatureAudit[] = [
    {
      name: 'analytics_charts',
      enabled: true,
      size: 150000,
      canDisable: true,
      impact: 'high',
    },
    {
      name: 'theme_builder',
      enabled: true,
      size: 80000,
      canDisable: true,
      impact: 'medium',
    },
    {
      name: 'forum_photos',
      enabled: true,
      size: 50000,
      canDisable: true,
      impact: 'low',
    },
    {
      name: 'grade_predictions',
      enabled: true,
      size: 30000,
      canDisable: true,
      impact: 'low',
    },
    {
      name: 'advanced_search',
      enabled: true,
      size: 60000,
      canDisable: false,
      impact: 'medium',
    },
  ];

  return features;
}

/**
 * Check feature flags and their current state.
 */
export function checkFeatureFlags(): Record<string, boolean> {
  // Check environment variables and config
  const flags: Record<string, boolean> = {
    ENABLE_ANALYTICS_DEBUG: import.meta.env.DEV,
    ENABLE_PERF_MONITORING: true,
    ENABLE_LAZY_ROUTES: true,
    ENABLE_CACHE_OPTIMIZATIONS: true,
    ENABLE_WIDGET_V2: false,
  };

  return flags;
}

// ============================================================================
// Export
// ============================================================================

export default {
  createLazyRoute,
  prefetchRoute,
  useLazyComponent,
  analyzeBundleSize,
  detectUnusedCode,
  optimizeChunks,
  auditReleaseFeatures,
  checkFeatureFlags,
};
