/**
 * Performance Benchmarks Index
 *
 * Centralized exports for all performance benchmark suites.
 *
 * @module performance/benchmarks
 */

// ============================================================================
// Startup Benchmarks
// ============================================================================

export {
  runStartupBenchmarkSuite,
  runQuickStartupBenchmark,
  benchmarkColdStart,
  benchmarkWarmStart,
  benchmarkCacheLoading,
  benchmarkWarmupService,
  benchmarkDuplicateRequests,
} from './startupBenchmark';

// ============================================================================
// UI Benchmarks
// ============================================================================

export {
  benchmarkWidgetDragPerformance,
  benchmarkWidgetResizePerformance,
  benchmarkSearchPerformance,
  benchmarkRouteTransitions,
  benchmarkAnalyticsPerformance,
  benchmarkNotesEditor,
  benchmarkFrameRates,
  benchmarkMemoryUsage,
} from './uiBenchmark';

// ============================================================================
// Data Benchmarks
// ============================================================================

export {
  runDataBenchmarkSuite,
  runQuickDataBenchmark,
  benchmarkMemoryCache,
  benchmarkIndexedDB,
  benchmarkSerialization,
  benchmarkCacheHitRate,
  benchmarkConcurrentDataLoading,
  benchmarkDuplicatePrevention,
} from './dataBenchmark';

// ============================================================================
// Backend Benchmarks
// ============================================================================

export {
  runBackendBenchmarkSuite,
  runQuickBackendBenchmark,
  benchmarkCommandLatency,
  benchmarkDatabaseOperations,
  benchmarkFilesystemOperations,
  benchmarkGlobalSearch,
  benchmarkLoggingPerformance,
} from './backendBenchmark';

// ============================================================================
// Widget Benchmarks
// ============================================================================

export {
  runWidgetBenchmarkSuite,
  runQuickWidgetBenchmark,
  benchmarkWidgetInitialization,
  benchmarkWidgetGridLayout,
  benchmarkWidgetResizeOperations,
  benchmarkWidgetDataRefresh,
  benchmarkWidgetDragDrop,
  benchmarkWidgetConfiguration,
  benchmarkWidgetMemoryUsage,
  benchmarkTimetableWidget,
  benchmarkGradeTrendsWidget,
  benchmarkQuickNotesWidget,
} from './widgetBenchmark';

// ============================================================================
// Service Benchmarks
// ============================================================================

export {
  runServiceBenchmarkSuite,
  runQuickServiceBenchmark,
  benchmarkAuthOperations,
  benchmarkConcurrentAuth,
  benchmarkCacheEviction,
  benchmarkCacheConsistency,
  benchmarkSyncOperations,
  benchmarkDeltaSync,
  benchmarkWidgetRegistry,
  benchmarkWidgetLayout,
  benchmarkSettingsPersistence,
  benchmarkNotificationDispatch,
  benchmarkRequestDeduplication,
  benchmarkRequestRetry,
} from './serviceBenchmark';

// ============================================================================
// Memory & Leak Detection Benchmarks
// ============================================================================

export {
  runMemoryBenchmarkSuite,
  runQuickMemoryBenchmark,
  benchmarkWidgetGridMemory,
  benchmarkNotesEditorMemory,
  benchmarkAssessmentDataMemory,
  benchmarkRouteMemoryLeaks,
  benchmarkWidgetLifecycleLeaks,
  benchmarkEventListenerLeaks,
  benchmarkGCPauseImpact,
  benchmarkMemoryFragmentation,
  benchmarkTimetableMemory,
  benchmarkAnalyticsChartsMemory,
  type MemorySnapshot,
  type MemoryGrowthReport,
  getMemorySnapshot,
  calculateMemoryDelta,
  forceGarbageCollection,
  waitForStableMemory,
} from './memoryBenchmark';

// ============================================================================
// Route & Page Benchmarks
// ============================================================================

export {
  runRouteBenchmarkSuite,
  runQuickRouteBenchmark,
  benchmarkSingleRouteTransitions,
  benchmarkNavigationPatterns,
  benchmarkRapidNavigation,
  benchmarkDashboardPage,
  benchmarkAnalyticsPage,
  benchmarkAssessmentsPage,
  benchmarkNoticesPage,
  benchmarkMessagesPage,
  benchmarkSettingsPage,
  benchmarkLazyLoading,
  benchmarkPreloading,
} from './routeBenchmark';

// ============================================================================
// Network Benchmarks
// ============================================================================

export {
  runNetworkBenchmarkSuite,
  runQuickNetworkBenchmark,
  benchmarkRequestLatency,
  benchmarkConcurrentRequests,
  benchmarkCacheStrategies,
  benchmarkCacheInvalidation,
  benchmarkPayloadSizes,
  benchmarkConnectionPooling,
  benchmarkRetryStrategies,
  benchmarkNetworkConditions,
} from './networkBenchmark';

// ============================================================================
// Complete Benchmark Suite
// ============================================================================

import { runStartupBenchmarkSuite } from './startupBenchmark';
import { benchmarkWidgetDragPerformance } from './uiBenchmark';
import { runDataBenchmarkSuite } from './dataBenchmark';
import { runBackendBenchmarkSuite } from './backendBenchmark';
import { runWidgetBenchmarkSuite } from './widgetBenchmark';
import { runServiceBenchmarkSuite } from './serviceBenchmark';
import { runMemoryBenchmarkSuite } from './memoryBenchmark';
import { runRouteBenchmarkSuite } from './routeBenchmark';
import { runNetworkBenchmarkSuite } from './networkBenchmark';

/**
 * Run the complete performance benchmark suite with all test categories.
 */
export async function runCompleteBenchmarkSuite(
  options: {
    startup?: boolean;
    ui?: boolean;
    data?: boolean;
    backend?: boolean;
    widgets?: boolean;
    services?: boolean;
    memory?: boolean;
    routes?: boolean;
    network?: boolean;
    iterations?: number;
  } = {},
): Promise<{
  success: boolean;
  results: Array<{
    suite: string;
    passed: boolean;
    duration: number;
    score: number;
  }>;
  report: string;
}> {
  const {
    startup = true,
    ui = true,
    data = true,
    backend = true,
    widgets = true,
    services = true,
    memory = true,
    routes = true,
    network = true,
    iterations = 3,
  } = options;

  const results: Array<{
    suite: string;
    passed: boolean;
    duration: number;
    score: number;
  }> = [];

  const startTime = performance.now();

  try {
    if (startup) {
      console.group('🚀 Startup Benchmarks');
      const suiteStart = performance.now();
      await runStartupBenchmarkSuite(iterations);
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'startup', passed: true, duration, score: 0 });
    }

    if (ui) {
      console.group('🎨 UI Benchmarks');
      const suiteStart = performance.now();
      await benchmarkWidgetDragPerformance();
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'ui', passed: true, duration, score: 0 });
    }

    if (data) {
      console.group('💾 Data Benchmarks');
      const suiteStart = performance.now();
      await runDataBenchmarkSuite();
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'data', passed: true, duration, score: 0 });
    }

    if (backend) {
      console.group('⚙️ Backend Benchmarks');
      const suiteStart = performance.now();
      await runBackendBenchmarkSuite();
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'backend', passed: true, duration, score: 0 });
    }

    if (widgets) {
      console.group('📦 Widget Benchmarks');
      const suiteStart = performance.now();
      await runWidgetBenchmarkSuite(iterations);
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'widgets', passed: true, duration, score: 0 });
    }

    if (services) {
      console.group('🔧 Service Benchmarks');
      const suiteStart = performance.now();
      await runServiceBenchmarkSuite();
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'services', passed: true, duration, score: 0 });
    }

    if (memory) {
      console.group('🧠 Memory & Leak Detection');
      const suiteStart = performance.now();
      const memoryResult = await runMemoryBenchmarkSuite();
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({
        suite: 'memory',
        passed: memoryResult.passed,
        duration,
        score: memoryResult.leaksDetected ? 50 : 100,
      });
    }

    if (routes) {
      console.group('🛣️ Route & Page Benchmarks');
      const suiteStart = performance.now();
      await runRouteBenchmarkSuite(iterations);
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'routes', passed: true, duration, score: 0 });
    }

    if (network) {
      console.group('🌐 Network Benchmarks');
      const suiteStart = performance.now();
      await runNetworkBenchmarkSuite();
      const duration = performance.now() - suiteStart;
      console.groupEnd();
      results.push({ suite: 'network', passed: true, duration, score: 0 });
    }
  } catch (error) {
    console.error('Benchmark suite failed:', error);
  }

  const totalDuration = performance.now() - startTime;

  return {
    success: results.every((r) => r.passed),
    results,
    report: generateBenchmarkReport(results, totalDuration),
  };
}

/**
 * Run a quick benchmark suite for CI/automated testing.
 */
export async function runQuickBenchmarkSuite(): Promise<{
  success: boolean;
  summary: Record<string, { passed: boolean; score: number }>;
  report: string;
}> {
  const results: Record<string, { passed: boolean; score: number; duration: number }> = {};

  const startTime = performance.now();

  // Quick startup test
  const { runQuickStartupBenchmark } = await import('./startupBenchmark');
  const startupResult = await runQuickStartupBenchmark();
  results.startup = {
    passed: startupResult.passed,
    score: startupResult.score,
    duration: 0,
  };

  // Quick widget test
  const { runQuickWidgetBenchmark } = await import('./widgetBenchmark');
  const widgetResult = await runQuickWidgetBenchmark();
  results.widgets = {
    passed: widgetResult.passed,
    score: widgetResult.score,
    duration: 0,
  };

  // Quick memory test
  const { runQuickMemoryBenchmark } = await import('./memoryBenchmark');
  const memoryResult = await runQuickMemoryBenchmark();
  results.memory = {
    passed: !memoryResult.leakDetected,
    score: memoryResult.leakDetected ? 0 : 100,
    duration: 0,
  };

  // Quick route test
  const { runQuickRouteBenchmark } = await import('./routeBenchmark');
  const routeResult = await runQuickRouteBenchmark();
  results.routes = {
    passed: routeResult.passed,
    score: routeResult.score,
    duration: 0,
  };

  // Quick network test
  const { runQuickNetworkBenchmark } = await import('./networkBenchmark');
  const networkResult = await runQuickNetworkBenchmark();
  results.network = {
    passed: networkResult.passed,
    score: networkResult.score,
    duration: 0,
  };

  const totalDuration = performance.now() - startTime;

  const summary: Record<string, { passed: boolean; score: number }> = {};
  for (const [key, value] of Object.entries(results)) {
    summary[key] = { passed: value.passed, score: value.score };
  }

  return {
    success: Object.values(results).every((r) => r.passed),
    summary,
    report: generateQuickBenchmarkReport(results, totalDuration),
  };
}

function generateBenchmarkReport(
  results: Array<{
    suite: string;
    passed: boolean;
    duration: number;
    score: number;
  }>,
  totalDuration: number,
): string {
  const lines = [
    '╔══════════════════════════════════════════════════════════════════════╗',
    '║              DesQTA Performance Benchmark Report                     ║',
    '╠══════════════════════════════════════════════════════════════════════╣',
    `║ Total Duration: ${totalDuration.toFixed(2)}ms`.padEnd(71) + '║',
    `║ Suites Run: ${results.length}`.padEnd(71) + '║',
    `║ Passed: ${results.filter((r) => r.passed).length}/${results.length}`.padEnd(71) + '║',
    '╠══════════════════════════════════════════════════════════════════════╣',
    '║ Suite                │ Status    │ Duration    │ Score               ║',
    '╠══════════════════════╪═══════════╪═════════════╪═════════════════════╣',
  ];

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration.toFixed(0)}ms`.padStart(7);
    const score = result.score > 0 ? `${result.score.toFixed(0)}/100` : 'N/A';
    lines.push(
      `║ ${result.suite.padEnd(20)} │ ${status.padEnd(9)} │ ${duration}   │ ${score.padEnd(19)} ║`,
    );
  }

  lines.push('╚══════════════════════════════════════════════════════════════════════╝');

  return lines.join('\n');
}

function generateQuickBenchmarkReport(
  results: Record<string, { passed: boolean; score: number; duration: number }>,
  totalDuration: number,
): string {
  const lines = [
    '╔══════════════════════════════════════════════════════════════════════╗',
    '║           DesQTA Quick Benchmark Report (CI)                         ║',
    '╠══════════════════════════════════════════════════════════════════════╣',
    `║ Total Duration: ${totalDuration.toFixed(2)}ms`.padEnd(71) + '║',
    '╠══════════════════════════════════════════════════════════════════════╣',
    '║ Suite                │ Status    │ Score                               ║',
    '╠══════════════════════╪═══════════╪═════════════════════════════════════╣',
  ];

  for (const [name, result] of Object.entries(results)) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const score = `${result.score.toFixed(0)}/100`;
    lines.push(`║ ${name.padEnd(20)} │ ${status.padEnd(9)} │ ${score.padEnd(35)} ║`);
  }

  lines.push('╚══════════════════════════════════════════════════════════════════════╝');

  return lines.join('\n');
}
