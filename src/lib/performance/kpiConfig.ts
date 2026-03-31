/**
 * KPI Configuration for DesQTA Performance Optimization
 * Defines thresholds, targets, and measurement criteria for all performance metrics.
 */

export type DeviceClass = 'low-end-mobile' | 'mid-desktop' | 'high-end-desktop';

export interface KpiMetricBand {
  target: number;          // Ideal target value
  acceptable: number;      // Acceptable threshold
  warning: number;         // Warning threshold (exceeding indicates concern)
  unit: 'ms' | 's' | '%' | 'bytes' | 'count' | 'fps';
  description: string;
}

export interface KpiCategory {
  name: string;
  description: string;
  metrics: Record<string, KpiMetricBand>;
}

// Startup KPIs - Cold and warm launch times
export const STARTUP_KPIS: Record<string, KpiMetricBand> = {
  // Cold start: App not in memory
  coldLaunchToFirstPaint: {
    target: 500,
    acceptable: 1000,
    warning: 2000,
    unit: 'ms',
    description: 'Time from app launch to first visual content',
  },
  coldLaunchToInteractive: {
    target: 1500,
    acceptable: 2500,
    warning: 4000,
    unit: 'ms',
    description: 'Time from app launch to fully interactive state',
  },
  coldLaunchToDashboardReady: {
    target: 2000,
    acceptable: 3500,
    warning: 6000,
    unit: 'ms',
    description: 'Time until dashboard widgets are populated and usable',
  },

  // Warm start: App in background/resumed
  warmLaunchToInteractive: {
    target: 300,
    acceptable: 600,
    warning: 1000,
    unit: 'ms',
    description: 'Time from resume to fully interactive',
  },

  // Service initialization
  startupServiceInit: {
    target: 100,
    acceptable: 250,
    warning: 500,
    unit: 'ms',
    description: 'Time for startup service initialization',
  },
  warmupServiceCompletion: {
    target: 2000,
    acceptable: 4000,
    warning: 8000,
    unit: 'ms',
    description: 'Time for warmup service to complete all prefetching',
  },
};

// UI Interaction KPIs - Smoothness and responsiveness
export const UI_KPIS: Record<string, KpiMetricBand> = {
  // Frame performance
  droppedFramesPercent: {
    target: 1,
    acceptable: 5,
    warning: 10,
    unit: '%',
    description: 'Percentage of frames dropped during animations/interactions',
  },
  targetFps: {
    target: 60,
    acceptable: 55,
    warning: 45,
    unit: 'fps',
    description: 'Target frames per second during animations',
  },

  // Interaction latency
  widgetDragLatency: {
    target: 16,
    acceptable: 33,
    warning: 50,
    unit: 'ms',
    description: 'Time from drag start to visual feedback',
  },
  widgetResizeLatency: {
    target: 16,
    acceptable: 33,
    warning: 50,
    unit: 'ms',
    description: 'Time from resize start to visual update',
  },
  searchInputLatency: {
    target: 50,
    acceptable: 100,
    warning: 200,
    unit: 'ms',
    description: 'Time from keystroke to search results update',
  },
  routeTransitionLatency: {
    target: 100,
    acceptable: 200,
    warning: 400,
    unit: 'ms',
    description: 'Time for route navigation to complete',
  },

  // Component-specific
  analyticsPageLoad: {
    target: 500,
    acceptable: 1000,
    warning: 2000,
    unit: 'ms',
    description: 'Time to load and render analytics page',
  },
  notesEditorLoad: {
    target: 300,
    acceptable: 600,
    warning: 1000,
    unit: 'ms',
    description: 'Time to load notes editor',
  },
  globalSearchOpen: {
    target: 100,
    acceptable: 200,
    warning: 400,
    unit: 'ms',
    description: 'Time from hotkey to search modal ready',
  },
};

// Data/Cache KPIs - Efficiency and performance
export const CACHE_KPIS: Record<string, KpiMetricBand> = {
  cacheHitRate: {
    target: 85,
    acceptable: 70,
    warning: 50,
    unit: '%',
    description: 'Percentage of cache hits vs total requests',
  },
  duplicateRequestCount: {
    target: 0,
    acceptable: 2,
    warning: 5,
    unit: 'count',
    description: 'Number of duplicate requests during startup/session',
  },
  averagePayloadSize: {
    target: 50000,
    acceptable: 100000,
    warning: 250000,
    unit: 'bytes',
    description: 'Average size of cached payload',
  },
  serializationOverhead: {
    target: 10,
    acceptable: 25,
    warning: 50,
    unit: 'ms',
    description: 'Time spent serializing/deserializing cached data',
  },
  idbReadLatency: {
    target: 50,
    acceptable: 100,
    warning: 250,
    unit: 'ms',
    description: 'IndexedDB read operation latency',
  },
  idbWriteLatency: {
    target: 100,
    acceptable: 200,
    warning: 500,
    unit: 'ms',
    description: 'IndexedDB write operation latency',
  },
};

// Backend/Database KPIs - Command and IO performance
export const BACKEND_KPIS: Record<string, KpiMetricBand> = {
  // Command latency percentiles
  commandLatencyP50: {
    target: 20,
    acceptable: 50,
    warning: 100,
    unit: 'ms',
    description: '50th percentile command latency',
  },
  commandLatencyP95: {
    target: 100,
    acceptable: 200,
    warning: 500,
    unit: 'ms',
    description: '95th percentile command latency',
  },
  commandLatencyP99: {
    target: 200,
    acceptable: 500,
    warning: 1000,
    unit: 'ms',
    description: '99th percentile command latency',
  },

  // Database performance
  dbLockWaitTime: {
    target: 5,
    acceptable: 20,
    warning: 50,
    unit: 'ms',
    description: 'Time waiting for database lock',
  },
  dbQueryLatency: {
    target: 10,
    acceptable: 25,
    warning: 75,
    unit: 'ms',
    description: 'Individual query execution time',
  },

  // Filesystem IO
  notesFileReadLatency: {
    target: 20,
    acceptable: 50,
    warning: 150,
    unit: 'ms',
    description: 'Time to read a note file',
  },
  notesFileWriteLatency: {
    target: 30,
    acceptable: 75,
    warning: 200,
    unit: 'ms',
    description: 'Time to write a note file',
  },
  globalSearchIndexLatency: {
    target: 100,
    acceptable: 250,
    warning: 500,
    unit: 'ms',
    description: 'Time to update global search index',
  },

  // Network
  apiRequestLatency: {
    target: 300,
    acceptable: 800,
    warning: 2000,
    unit: 'ms',
    description: 'External API request round-trip time',
  },
};

// CI/Build KPIs - Development velocity
export const BUILD_KPIS: Record<string, KpiMetricBand> = {
  // Build times
  desktopBuildTime: {
    target: 300,
    acceptable: 600,
    warning: 900,
    unit: 's',
    description: 'Desktop build time (all platforms)',
  },
  mobileBuildTime: {
    target: 400,
    acceptable: 800,
    warning: 1200,
    unit: 's',
    description: 'Mobile build time (iOS + Android)',
  },
  rustCompileTime: {
    target: 60,
    acceptable: 120,
    warning: 300,
    unit: 's',
    description: 'Rust compilation time',
  },

  // Cache performance
  cacheHitRate: {
    target: 90,
    acceptable: 75,
    warning: 50,
    unit: '%',
    description: 'CI dependency cache hit rate',
  },

  // Binary sizes
  windowsBinarySize: {
    target: 50000000,
    acceptable: 80000000,
    warning: 120000000,
    unit: 'bytes',
    description: 'Windows installer size',
  },
  macosBinarySize: {
    target: 60000000,
    acceptable: 100000000,
    warning: 150000000,
    unit: 'bytes',
    description: 'macOS app bundle size',
  },
  linuxBinarySize: {
    target: 60000000,
    acceptable: 90000000,
    warning: 140000000,
    unit: 'bytes',
    description: 'Linux AppImage size',
  },
  iosBinarySize: {
    target: 40000000,
    acceptable: 70000000,
    warning: 100000000,
    unit: 'bytes',
    description: 'iOS IPA size',
  },
  androidBinarySize: {
    target: 35000000,
    acceptable: 60000000,
    warning: 90000000,
    unit: 'bytes',
    description: 'Android APK size',
  },
};

// Device-class specific adjustments
export const DEVICE_MULTIPLIERS: Record<DeviceClass, { startup: number; ui: number; backend: number }> = {
  'low-end-mobile': {
    startup: 2.5,  // 2.5x slower than baseline
    ui: 1.5,
    backend: 1.2,
  },
  'mid-desktop': {
    startup: 1.0,  // Baseline
    ui: 1.0,
    backend: 1.0,
  },
  'high-end-desktop': {
    startup: 0.6,  // 40% faster than baseline
    ui: 0.5,
    backend: 0.8,
  },
};

// Regression thresholds - when to flag a performance regression
export const REGRESSION_THRESHOLDS = {
  startup: 100,        // ms
  uiInteraction: 50,   // ms
  commandLatency: 10,  // % increase
  binarySize: 5,       // % increase
  buildTime: 15,       // % increase
};

// All KPIs combined
export const ALL_KPIS: Record<string, Record<string, KpiMetricBand>> = {
  startup: STARTUP_KPIS,
  ui: UI_KPIS,
  cache: CACHE_KPIS,
  backend: BACKEND_KPIS,
  build: BUILD_KPIS,
};

// Helper to get adjusted threshold for device class
export function getAdjustedThreshold(
  metric: KpiMetricBand,
  deviceClass: DeviceClass,
  category: 'startup' | 'ui' | 'backend'
): KpiMetricBand {
  const multiplier = DEVICE_MULTIPLIERS[deviceClass][category];
  return {
    ...metric,
    target: Math.round(metric.target * multiplier),
    acceptable: Math.round(metric.acceptable * multiplier),
    warning: Math.round(metric.warning * multiplier),
  };
}

// Helper to determine status based on value
export type KpiStatus = 'excellent' | 'good' | 'warning' | 'critical';

export function getKpiStatus(value: number, threshold: KpiMetricBand): KpiStatus {
  // For metrics where lower is better
  if (['ms', 's', 'bytes', 'count'].includes(threshold.unit)) {
    if (value <= threshold.target) return 'excellent';
    if (value <= threshold.acceptable) return 'good';
    if (value <= threshold.warning) return 'warning';
    return 'critical';
  }
  // For metrics where higher is better (%, fps)
  if (value >= threshold.target) return 'excellent';
  if (value >= threshold.acceptable) return 'good';
  if (value >= threshold.warning) return 'warning';
  return 'critical';
}

// Score calculation (0-100)
export function calculateKpiScore(value: number, threshold: KpiMetricBand): number {
  // For metrics where lower is better
  if (['ms', 's', 'bytes', 'count'].includes(threshold.unit)) {
    if (value <= threshold.target) return 100;
    if (value >= threshold.warning) return 0;
    const range = threshold.warning - threshold.target;
    const overage = value - threshold.target;
    return Math.max(0, Math.round(100 - (overage / range) * 100));
  }
  // For metrics where higher is better
  if (value >= threshold.target) return 100;
  if (value <= threshold.warning) return 0;
  const range = threshold.target - threshold.warning;
  const achievement = value - threshold.warning;
  return Math.max(0, Math.round((achievement / range) * 100));
}

// Export for Phase 1 tracking
export const PHASE_1_TARGETS = {
  startupDeferralSavings: 500,  // ms saved from startup deferral
  duplicateCallsRemoved: 3,      // minimum number of duplicate calls to remove
  sqlitePragmaImprovement: 20,   // % improvement in DB operations
  ciCacheImprovement: 30,        // % reduction in CI times
};

// Export for Phase 2 tracking
export const PHASE_2_TARGETS = {
  analyticsMemoizationReduction: 40,  // % reduction in re-renders
  searchDebounceImprovement: 50,      // ms improvement in search latency
  widgetGridBatchingSavings: 30,      // % reduction in layout thrash
  cacheSerializationReduction: 50,    // % reduction in serialization time
};

// Export for Phase 3 tracking
export const PHASE_3_TARGETS = {
  dbContentionReduction: 30,      // % reduction in lock wait times
  notesIoImprovement: 40,         // % improvement in notes file operations
  searchIndexOptimization: 50,    // % reduction in index update time
  logFlushOptimization: 25,       // % reduction in log IO overhead
};

// Export for Phase 4 tracking
export const PHASE_4_TARGETS = {
  bundleSizeReduction: 10,        // % reduction in bundle size
  lazyLoadingRoutes: 3,           // number of routes to lazy load
  featureFlagAuditItems: 5,       // number of features to audit
};
