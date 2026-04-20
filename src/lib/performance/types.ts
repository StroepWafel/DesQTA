/**
 * Performance Types and KPI Definitions
 *
 * Defines all types, interfaces, and constants for the performance
 * monitoring and optimization system.
 */

/**
 * Target device classes for performance benchmarking
 */
export enum DeviceClass {
  LowEndMobile = 'low_end_mobile',      // Budget Android devices
  MidDesktop = 'mid_desktop',           // Standard laptops/PCs
  HighEndDesktop = 'high_end_desktop',  // Powerful workstations
}

/**
 * KPI Categories
 */
export enum KPICategory {
  Startup = 'startup',
  UI = 'ui',
  Data = 'data',
  Backend = 'backend',
  Build = 'build',
}

/**
 * Benchmark phases
 */
export enum Phase {
  Phase1 = 'phase1', // Fast wins: startup deferral, CI cache
  Phase2 = 'phase2', // UI hotspot refactors
  Phase3 = 'phase3', // Backend throughput
  Phase4 = 'phase4', // Bundle/runtime footprint
}

/**
 * Performance metric types
 */
export enum MetricType {
  Duration = 'duration',
  Count = 'count',
  Percentage = 'percentage',
  Size = 'size',
  Timestamp = 'timestamp',
}

/**
 * A single performance measurement
 */
export interface PerformanceMeasurement {
  name: string;
  category: KPICategory;
  type: MetricType;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'fps';
  timestamp: number;
  deviceClass: DeviceClass;
  metadata?: Record<string, unknown>;
}

/**
 * KPI threshold with regression guardrails
 */
export interface KpiThreshold {
  name: string;
  category: KPICategory;
  target: number;
  warning: number;
  critical: number;
  regressionThreshold: number; // Max allowed regression (e.g., 0.1 = 10%)
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'fps';
  description: string;
}

/**
 * Benchmark suite configuration
 */
export interface BenchmarkSuite {
  name: string;
  description: string;
  iterations: number;
  warmupRuns: number;
  deviceClass: DeviceClass;
  measurements: PerformanceMeasurement[];
}

/**
 * KPI Scorecard for tracking all metrics
 */
export interface KPIScorecard {
  generatedAt: string;
  deviceClass: DeviceClass;
  version: string;
  commit?: string;
  metrics: {
    startup: StartupMetrics;
    ui: UIMetrics;
    data: DataMetrics;
    backend: BackendMetrics;
    build: BuildMetrics;
  };
}

/**
 * Startup performance metrics
 */
export interface StartupMetrics {
  // Cold start (fresh app launch)
  coldStartFirstPaint: number;
  coldStartShellInteractive: number;
  coldStartDashboardInteractive: number;

  // Warm start (app was recently used)
  warmStartFirstPaint: number;
  warmStartShellInteractive: number;
  warmStartDashboardInteractive: number;

  // Cache loading
  cacheLoadTime: number;
  cacheKeysLoaded: number;

  // Service initialization
  startupServiceInitTime: number;
  warmupServiceInitTime: number;
}

/**
 * UI performance metrics
 */
export interface UIMetrics {
  // Frame rates
  avgFps: number;
  droppedFramesPercent: number;

  // Interaction latencies (p50, p95)
  widgetDragLatency: LatencyPercentiles;
  searchTypingLatency: LatencyPercentiles;
  notesEditLatency: LatencyPercentiles;
  routeTransitionLatency: Record<string, LatencyPercentiles>;

  // Render performance
  layoutThrashingCount: number;
  longTasksOver50ms: number;
  longTasksOver100ms: number;
}

/**
 * Latency percentiles
 */
export interface LatencyPercentiles {
  p50: number;
  p75: number;
  p95: number;
  p99: number;
}

/**
 * Data/cache performance metrics
 */
export interface DataMetrics {
  cacheHitRate: number;
  cacheMissRate: number;
  duplicateRequestCount: number;
  avgPayloadSize: number;
  maxPayloadSize: number;
  serializationTime: number;
  deserializationTime: number;
}

/**
 * Backend performance metrics
 */
export interface BackendMetrics {
  commandLatency: Record<string, LatencyPercentiles>;
  dbLockWaitTime: number;
  dbQueryTime: LatencyPercentiles;
  filesystemOpTime: LatencyPercentiles;
  avgCommandLatency: number;
  maxCommandLatency: number;
}

/**
 * Build/CI performance metrics
 */
export interface BuildMetrics {
  totalBuildTime: number;
  rustBuildTime: number;
  frontendBuildTime: number;
  ciCacheHitRate: number;
  binarySize: number;
  installerSize: number;
}

/**
 * Performance budget entry
 */
export interface PerformanceBudget {
  metric: string;
  budget: number;
  actual: number;
  status: 'pass' | 'warning' | 'fail';
}

/**
 * Optimization phase status
 */
export interface PhaseStatus {
  phase: Phase;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  startedAt?: string;
  completedAt?: string;
  kpiSnapshotBefore?: KPIScorecard;
  kpiSnapshotAfter?: KPIScorecard;
  improvements: Array<{
    metric: string;
    before: number;
    after: number;
    percentChange: number;
  }>;
}

/**
 * Timing marker for manual instrumentation
 */
export interface TimingMarker {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Performance regression check result
 */
export interface RegressionCheck {
  metric: string;
  baseline: number;
  current: number;
  change: number;
  changePercent: number;
  threshold: number;
  passed: boolean;
}

/**
 * Cache hit/miss tracking
 */
export interface CacheStats {
  key: string;
  hits: number;
  misses: number;
  hitRate: number;
  avgLoadTime: number;
  lastAccessed: number;
  sizeBytes: number;
}

/**
 * Database performance stats
 */
export interface DatabaseStats {
  totalQueries: number;
  avgQueryTime: number;
  maxQueryTime: number;
  lockWaitTime: number;
  connectionPoolSize: number;
  activeConnections: number;
}

/**
 * Predefined KPI thresholds based on device class
 */
export const KPI_THRESHOLDS: Record<DeviceClass, KpiThreshold[]> = {
  [DeviceClass.LowEndMobile]: [
    // Startup
    { name: 'cold_start_interactive', category: KPICategory.Startup, target: 3000, warning: 4000, critical: 5000, regressionThreshold: 0.15, unit: 'ms', description: 'Cold start to interactive' },
    { name: 'warm_start_interactive', category: KPICategory.Startup, target: 1500, warning: 2000, critical: 2500, regressionThreshold: 0.15, unit: 'ms', description: 'Warm start to interactive' },

    // UI
    { name: 'dropped_frames', category: KPICategory.UI, target: 5, warning: 10, critical: 15, regressionThreshold: 0.2, unit: 'percent', description: 'Dropped frames percentage' },
    { name: 'interaction_latency_p95', category: KPICategory.UI, target: 100, warning: 150, critical: 200, regressionThreshold: 0.1, unit: 'ms', description: 'P95 interaction latency' },

    // Data
    { name: 'cache_hit_rate', category: KPICategory.Data, target: 85, warning: 75, critical: 65, regressionThreshold: 0.1, unit: 'percent', description: 'Cache hit rate' },

    // Backend
    { name: 'command_latency_p95', category: KPICategory.Backend, target: 200, warning: 300, critical: 500, regressionThreshold: 0.1, unit: 'ms', description: 'P95 backend command latency' },

    // Build
    { name: 'total_build_time', category: KPICategory.Build, target: 600000, warning: 900000, critical: 1200000, regressionThreshold: 0.1, unit: 'ms', description: 'Total CI build time' },
  ],

  [DeviceClass.MidDesktop]: [
    // Startup
    { name: 'cold_start_interactive', category: KPICategory.Startup, target: 1500, warning: 2000, critical: 2500, regressionThreshold: 0.1, unit: 'ms', description: 'Cold start to interactive' },
    { name: 'warm_start_interactive', category: KPICategory.Startup, target: 500, warning: 750, critical: 1000, regressionThreshold: 0.1, unit: 'ms', description: 'Warm start to interactive' },

    // UI
    { name: 'dropped_frames', category: KPICategory.UI, target: 2, warning: 5, critical: 8, regressionThreshold: 0.15, unit: 'percent', description: 'Dropped frames percentage' },
    { name: 'interaction_latency_p95', category: KPICategory.UI, target: 50, warning: 75, critical: 100, regressionThreshold: 0.1, unit: 'ms', description: 'P95 interaction latency' },

    // Data
    { name: 'cache_hit_rate', category: KPICategory.Data, target: 90, warning: 85, critical: 75, regressionThreshold: 0.1, unit: 'percent', description: 'Cache hit rate' },

    // Backend
    { name: 'command_latency_p95', category: KPICategory.Backend, target: 100, warning: 150, critical: 250, regressionThreshold: 0.1, unit: 'ms', description: 'P95 backend command latency' },

    // Build
    { name: 'total_build_time', category: KPICategory.Build, target: 300000, warning: 450000, critical: 600000, regressionThreshold: 0.1, unit: 'ms', description: 'Total CI build time' },
  ],

  [DeviceClass.HighEndDesktop]: [
    // Startup
    { name: 'cold_start_interactive', category: KPICategory.Startup, target: 800, warning: 1200, critical: 1500, regressionThreshold: 0.1, unit: 'ms', description: 'Cold start to interactive' },
    { name: 'warm_start_interactive', category: KPICategory.Startup, target: 300, warning: 500, critical: 750, regressionThreshold: 0.1, unit: 'ms', description: 'Warm start to interactive' },

    // UI
    { name: 'dropped_frames', category: KPICategory.UI, target: 1, warning: 2, critical: 5, regressionThreshold: 0.15, unit: 'percent', description: 'Dropped frames percentage' },
    { name: 'interaction_latency_p95', category: KPICategory.UI, target: 33, warning: 50, critical: 75, regressionThreshold: 0.1, unit: 'ms', description: 'P95 interaction latency' },

    // Data
    { name: 'cache_hit_rate', category: KPICategory.Data, target: 95, warning: 90, critical: 85, regressionThreshold: 0.1, unit: 'percent', description: 'Cache hit rate' },

    // Backend
    { name: 'command_latency_p95', category: KPICategory.Backend, target: 50, warning: 75, critical: 100, regressionThreshold: 0.1, unit: 'ms', description: 'P95 backend command latency' },

    // Build
    { name: 'total_build_time', category: KPICategory.Build, target: 180000, warning: 240000, critical: 300000, regressionThreshold: 0.1, unit: 'ms', description: 'Total CI build time' },
  ],
};

/**
 * Detect device class based on hardware capabilities
 */
export function detectDeviceClass(): DeviceClass {
  const memory = (navigator as any).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const connection = (navigator as any).connection;

  // Low-end indicators
  if (memory <= 2 || cores <= 2 || connection?.effectiveType === '2g') {
    return DeviceClass.LowEndMobile;
  }

  // High-end indicators
  if (memory >= 8 && cores >= 8 && (!connection || connection?.effectiveType === '4g')) {
    return DeviceClass.HighEndDesktop;
  }

  return DeviceClass.MidDesktop;
}
