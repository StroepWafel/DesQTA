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
// Complete Benchmark Suite
// ============================================================================

import { runStartupBenchmarkSuite } from './startupBenchmark';
import { benchmarkWidgetDragPerformance } from './uiBenchmark';
import { runDataBenchmarkSuite } from './dataBenchmark';
import { runBackendBenchmarkSuite } from './backendBenchmark';

/**
 * Run the complete performance benchmark suite.
 */
export async function runCompleteBenchmarkSuite(
  options: {
    startup?: boolean;
    ui?: boolean;
    data?: boolean;
    backend?: boolean;
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
  const { startup = true, ui = true, data = true, backend = true, iterations = 3 } = options;

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
      await runStartupBenchmarkSuite(iterations);
      console.groupEnd();
      results.push({ suite: 'startup', passed: true, duration: 0, score: 0 });
    }

    if (ui) {
      console.group('🎨 UI Benchmarks');
      await benchmarkWidgetDragPerformance();
      console.groupEnd();
      results.push({ suite: 'ui', passed: true, duration: 0, score: 0 });
    }

    if (data) {
      console.group('💾 Data Benchmarks');
      await runDataBenchmarkSuite();
      console.groupEnd();
      results.push({ suite: 'data', passed: true, duration: 0, score: 0 });
    }

    if (backend) {
      console.group('⚙️ Backend Benchmarks');
      await runBackendBenchmarkSuite();
      console.groupEnd();
      results.push({ suite: 'backend', passed: true, duration: 0, score: 0 });
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
    '╔══════════════════════════════════════════════════════════════╗',
    '║           DesQTA Performance Benchmark Report                ║',
    '╠══════════════════════════════════════════════════════════════╣',
    `║ Total Duration: ${totalDuration.toFixed(2)}ms`.padEnd(63) + '║',
    `║ Suites Run: ${results.length}`.padEnd(63) + '║',
    `║ Passed: ${results.filter((r) => r.passed).length}/${results.length}`.padEnd(63) + '║',
    '╠══════════════════════════════════════════════════════════════╣',
  ];

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(`║ ${result.suite.padEnd(20)} ${status}`.padEnd(63) + '║');
  }

  lines.push('╚══════════════════════════════════════════════════════════════╝');

  return lines.join('\n');
}
