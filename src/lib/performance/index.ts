/**
 * Performance Optimization Module - Main Export Index
 *
 * Centralized exports for the DesQTA performance monitoring and optimization system.
 *
 * @module performance
 */

export { isDevTauriPerformance } from './devTauriContext';
export { installDevTauriPerformanceRuntime, teardownDevTauriPerformanceRuntime } from './devTauriRuntime';
export type { DevPerfGlobal } from './devTauriRuntime';

// ============================================================================
// Core Types & Configuration
// ============================================================================

export * from './types';
export * from './kpiConfig';

// ============================================================================
// Metrics Tracking
// ============================================================================

export {
  // Initialization
  initMetricsTracker,
  initDeviceClass,
  getDeviceClass,

  // Metric Recording
  recordMetric,
  startTimer,
  endTimer,

  // Specialized Metrics
  recordStartupMetric,
  recordUIInteraction,
  recordRouteTransition,
  recordBackendCommand,
  recordCacheStats,
  recordDroppedFrames,

  // User Timing API
  mark,
  measure,

  // Benchmarking
  runBenchmark,
  getMetricsByCategory,
  calculateStats,
  exportMetrics,
  downloadMetrics,

  // Stores
  sessionMetrics,
  benchmarkHistory,

  // Types
  type MetricCategory,
  type DeviceClass,
  type MetricThresholds,
  type PerformanceMetric,
  type BenchmarkResult,
} from './services/metricsTracker';

// ============================================================================
// Benchmarks
// ============================================================================

export {
  // Startup benchmarks
  runStartupBenchmarkSuite,
  runQuickStartupBenchmark,
  benchmarkColdStart,
  benchmarkWarmStart,
  benchmarkCacheLoading,
  benchmarkWarmupService,
  benchmarkDuplicateRequests,

  // UI benchmarks
  benchmarkWidgetDragPerformance,
  benchmarkWidgetResizePerformance,
  benchmarkSearchPerformance,
  benchmarkRouteTransitions,
  benchmarkAnalyticsPerformance,
  benchmarkNotesEditor,
  benchmarkFrameRates,
  benchmarkMemoryUsage,

  // Data benchmarks
  runDataBenchmarkSuite,
  runQuickDataBenchmark,
  benchmarkMemoryCache,
  benchmarkIndexedDB,
  benchmarkSerialization,
  benchmarkCacheHitRate,
  benchmarkConcurrentDataLoading,
  benchmarkDuplicatePrevention,

  // Backend benchmarks
  runBackendBenchmarkSuite,
  runQuickBackendBenchmark,
  benchmarkCommandLatency,
  benchmarkDatabaseOperations,
  benchmarkFilesystemOperations,
  benchmarkGlobalSearch,
  benchmarkLoggingPerformance,

  // Complete suite
  runCompleteBenchmarkSuite,
} from './benchmarks';

// ============================================================================
// Optimizations
// ============================================================================

export {
  // Phase 1
  deferNonCriticalStartup,
  prioritizeStartupTasks,
  executePhasedStartup,
  WarmupPhase,
  getPhaseForTask,
  createDeduplicatedRequest,
  RequestDeduplicator,
  useMemoizedRequest,
  type StartupTask,
  type StartupPriority,

  // Phase 2
  memoizeAnalyticsData,
  optimizeAnalyticsFilters,
  useVirtualizedChart,
  optimizeSearchDebounce,
  useIncrementalSearch,
  implementSearchIndexing,
  batchWidgetUpdates,
  useLayoutBatching,
  optimizeDragAndDrop,
  optimizeSerialization,
  useStructuredClone,

  // Phase 3
  optimizeDatabaseConnection,
  implementConnectionPooling,
  useReadReplica,
  optimizeNotesFilesystem,
  useInMemoryIndex,
  batchFilesystemOps,
  optimizeGlobalSearch,
  useIncrementalIndexing,
  optimizeLoggerFlush,
  useAsyncLogging,
  batchLogWrites,

  // Phase 4
  createLazyRoute,
  prefetchRoute,
  useLazyComponent,
  analyzeBundleSize,
  detectUnusedCode,
  optimizeChunks,
  auditReleaseFeatures,
  checkFeatureFlags,

  // Phase tracking
  registerPhase,
  getPhaseStatus,
  updatePhaseStatus,
  recordPhaseImprovement,
  getPhaseSummary,
  areAllPhasesComplete,
  type PhaseStatus,
  type PhaseImplementation,
} from './optimizations';

// ============================================================================
// Hooks
// ============================================================================

export {
  measureRender,
  measureInteraction,
  measureScroll,
  measureMount,
  measureUpdate,
  measureAsync,
  startRouteTransition,
  endRouteTransition,
  routePathToMetricId,
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
} from './hooks';

// ============================================================================
// Version
// ============================================================================

export const PERFORMANCE_MODULE_VERSION = '1.0.0';
