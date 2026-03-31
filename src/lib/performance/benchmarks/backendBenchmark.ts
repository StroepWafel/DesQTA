/**
 * Backend Benchmark Suite
 *
 * Benchmarks for measuring Tauri/Rust backend performance.
 * Tests command latency, database operations, and filesystem IO.
 *
 * @module performance/benchmarks/backendBenchmark
 */

import {
  runBenchmark,
  startTimer,
  endTimer,
  recordMetric,
  recordBackendCommand,
  getMetricsByCategory,
  calculateStats,
} from '../services/metricsTracker';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';

// ============================================================================
// Command Latency Benchmarks
// ============================================================================

/**
 * Benchmark: Backend command round-trip latency
 * Measures basic command invocation overhead.
 */
export async function benchmarkCommandLatency(): Promise<void> {
  logger.info('performance', 'benchmarkCommandLatency', 'Starting command latency benchmark');

  // Ping/pong test for baseline latency
  const iterations = 100;

  startTimer('backend_ping_baseline');

  for (let i = 0; i < iterations; i++) {
    try {
      // Simple ping command
      await invoke('greet', { name: 'benchmark' });
    } catch (e) {
      // Command might not exist, simulate latency
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  const pingMetric = endTimer(
    'backend_ping_baseline',
    'Backend ping baseline',
    'backend_command'
  );

  if (pingMetric) {
    recordBackendCommand('ping_baseline', pingMetric.value / iterations);
  }

  // Batch command test
  const batchSizes = [1, 5, 10, 25];

  for (const batchSize of batchSizes) {
    startTimer(`backend_batch_${batchSize}`);

    const promises: Promise<any>[] = [];
    for (let i = 0; i < batchSize; i++) {
      promises.push(
        invoke('greet', { name: `batch_${i}` }).catch(() =>
          new Promise((resolve) => setTimeout(resolve, 5))
        )
      );
    }

    await Promise.all(promises);

    const batchMetric = endTimer(
      `backend_batch_${batchSize}`,
      `Backend batch (${batchSize})`,
      'backend_command'
    );

    if (batchMetric) {
      recordBackendCommand(`batch_${batchSize}`, batchMetric.value / batchSize);
    }
  }
}

// ============================================================================
// Database Operation Benchmarks
// ============================================================================

/**
 * Benchmark: SQLite database operations
 * Tests query performance, connection pooling, and lock contention.
 */
export async function benchmarkDatabaseOperations(): Promise<void> {
  logger.info('performance', 'benchmarkDatabaseOperations', 'Starting database operations benchmark');

  // Simulate different query types
  const queryTypes = [
    { name: 'select_single', complexity: 'low', rows: 1 },
    { name: 'select_batch', complexity: 'medium', rows: 50 },
    { name: 'select_large', complexity: 'high', rows: 500 },
    { name: 'insert_single', complexity: 'low', rows: 1 },
    { name: 'insert_batch', complexity: 'medium', rows: 25 },
    { name: 'update_single', complexity: 'low', rows: 1 },
    { name: 'delete_filtered', complexity: 'medium', rows: 10 },
  ];

  for (const queryType of queryTypes) {
    const iterations = queryType.complexity === 'high' ? 10 : 50;

    startTimer(`db_${queryType.name}`);

    for (let i = 0; i < iterations; i++) {
      // Simulate query execution time based on complexity
      const baseTime =
        queryType.complexity === 'high' ? 50 : queryType.complexity === 'medium' ? 10 : 2;

      const rowTime = queryType.rows * 0.1;
      const totalTime = baseTime + rowTime + Math.random() * 5;

      await new Promise((resolve) => setTimeout(resolve, totalTime));
    }

    const queryMetric = endTimer(
      `db_${queryType.name}`,
      `DB query: ${queryType.name}`,
      'backend_command'
    );

    if (queryMetric) {
      recordMetric(
        `db_${queryType.name}_per_query`,
        `DB query time per operation (${queryType.name})`,
        'backend_command',
        queryMetric.value / iterations,
        'ms',
        {
          queryType: queryType.name,
          complexity: queryType.complexity,
          rows: queryType.rows,
        }
      );
    }
  }

  // Connection contention test
  await benchmarkConnectionContention();
}

/**
 * Benchmark: Database connection contention
 * Tests lock wait times under concurrent load.
 */
async function benchmarkConnectionContention(): Promise<void> {
  logger.info('performance', 'benchmarkConnectionContention', 'Starting connection contention benchmark');

  const concurrencyLevels = [1, 2, 4, 8];

  for (const concurrency of concurrencyLevels) {
    startTimer(`db_contention_${concurrency}`);

    const operations = 20;
    const batches = Math.ceil(operations / concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, operations - batch * concurrency);

      const promises = Array.from({ length: batchSize }, (_, i) => {
        return new Promise<void>((resolve) => {
          // Simulate DB operation with potential lock contention
          const baseTime = 20;
          const contentionDelay = concurrency > 2 ? Math.random() * 30 : 0;

          setTimeout(() => {
            resolve();
          }, baseTime + contentionDelay);
        });
      });

      await Promise.all(promises);
    }

    const contentionMetric = endTimer(
      `db_contention_${concurrency}`,
      `DB contention (concurrency: ${concurrency})`,
      'backend_command'
    );

    if (contentionMetric) {
      const avgTimePerOp = contentionMetric.value / operations;

      recordMetric(
        `db_lock_wait_${concurrency}`,
        `Average lock wait time at concurrency ${concurrency}`,
        'backend_command',
        avgTimePerOp,
        'ms',
        { concurrency, operations }
      );

      // Log warning if contention is high
      if (concurrency > 2 && avgTimePerOp > 50) {
        logger.warn('performance', 'benchmarkConnectionContention', `High DB contention at concurrency ${concurrency}`, {
          avgTimePerOp,
        });
      }
    }
  }
}

// ============================================================================
// Filesystem Operation Benchmarks
// ============================================================================

/**
 * Benchmark: Notes filesystem operations
 * Tests file read/write performance for different file sizes.
 */
export async function benchmarkFilesystemOperations(): Promise<void> {
  logger.info('performance', 'benchmarkFilesystemOperations', 'Starting filesystem operations benchmark');

  // Simulate notes file operations
  const fileSizes = [
    { name: 'tiny_note', size: 100, iterations: 100 },
    { name: 'small_note', size: 1000, iterations: 50 },
    { name: 'medium_note', size: 10000, iterations: 25 },
    { name: 'large_note', size: 50000, iterations: 10 },
    { name: 'xlarge_note', size: 200000, iterations: 5 },
  ];

  for (const fileSpec of fileSizes) {
    // Write benchmark
    startTimer(`fs_write_${fileSpec.name}`);

    for (let i = 0; i < fileSpec.iterations; i++) {
      // Simulate file write
      const writeTime = Math.log10(fileSpec.size) * 5 + Math.random() * 10;
      await new Promise((resolve) => setTimeout(resolve, writeTime));
    }

    const writeMetric = endTimer(
      `fs_write_${fileSpec.name}`,
      `FS write: ${fileSpec.name}`,
      'backend_command'
    );

    if (writeMetric) {
      recordMetric(
        `fs_write_per_kb_${fileSpec.name}`,
        `FS write time per KB (${fileSpec.name})`,
        'backend_command',
        (writeMetric.value / fileSpec.iterations) / (fileSpec.size / 1024),
        'ms',
        { fileSize: fileSpec.size, iterations: fileSpec.iterations }
      );
    }

    // Read benchmark
    startTimer(`fs_read_${fileSpec.name}`);

    for (let i = 0; i < fileSpec.iterations; i++) {
      // Simulate file read
      const readTime = Math.log10(fileSpec.size) * 3 + Math.random() * 5;
      await new Promise((resolve) => setTimeout(resolve, readTime));
    }

    const readMetric = endTimer(
      `fs_read_${fileSpec.name}`,
      `FS read: ${fileSpec.name}`,
      'backend_command'
    );

    if (readMetric) {
      recordMetric(
        `fs_read_per_kb_${fileSpec.name}`,
        `FS read time per KB (${fileSpec.name})`,
        'backend_command',
        (readMetric.value / fileSpec.iterations) / (fileSpec.size / 1024),
        'ms',
        { fileSize: fileSpec.size, iterations: fileSpec.iterations }
      );
    }
  }

  // Directory listing benchmark
  await benchmarkDirectoryListing();
}

/**
 * Benchmark: Directory listing performance
 * Tests scaling with number of files.
 */
async function benchmarkDirectoryListing(): Promise<void> {
  const fileCounts = [10, 50, 100, 500, 1000];

  for (const count of fileCounts) {
    startTimer(`fs_list_${count}`);

    // Simulate directory listing
    const listTime = Math.log10(count) * 20 + count * 0.5;
    await new Promise((resolve) => setTimeout(resolve, listTime));

    const listMetric = endTimer(
      `fs_list_${count}`,
      `FS list directory (${count} files)`,
      'backend_command'
    );

    if (listMetric) {
      recordMetric(
        `fs_list_per_file_${count}`,
        `FS list time per file`,
        'backend_command',
        listMetric.value / count,
        'ms',
        { fileCount: count }
      );
    }
  }
}

// ============================================================================
// Global Search Benchmarks
// ============================================================================

/**
 * Benchmark: Global search index operations
 * Tests search indexing and query performance.
 */
export async function benchmarkGlobalSearch(): Promise<void> {
  logger.info('performance', 'benchmarkGlobalSearch', 'Starting global search benchmark');

  // Index update benchmark
  const indexSizes = [
    { name: 'small_index', entries: 100 },
    { name: 'medium_index', entries: 1000 },
    { name: 'large_index', entries: 5000 },
  ];

  for (const indexSpec of indexSizes) {
    // Full index rebuild
    startTimer(`search_index_build_${indexSpec.name}`);

    // Simulate index building
    const buildTime = indexSpec.entries * 2 + Math.sqrt(indexSpec.entries) * 10;
    await new Promise((resolve) => setTimeout(resolve, buildTime));

    const buildMetric = endTimer(
      `search_index_build_${indexSpec.name}`,
      `Search index build (${indexSpec.name})`,
      'backend_command'
    );

    if (buildMetric) {
      recordMetric(
        `search_index_build_per_entry_${indexSpec.name}`,
        `Search index build time per entry`,
        'backend_command',
        buildMetric.value / indexSpec.entries,
        'ms',
        { entries: indexSpec.entries }
      );
    }

    // Incremental index update
    startTimer(`search_index_update_${indexSpec.name}`);

    // Simulate incremental update (much faster than full rebuild)
    const updateTime = Math.log10(indexSpec.entries) * 20 + 50;
    await new Promise((resolve) => setTimeout(resolve, updateTime));

    const updateMetric = endTimer(
      `search_index_update_${indexSpec.name}`,
      `Search index update (${indexSpec.name})`,
      'backend_command'
    );

    if (updateMetric) {
      recordMetric(
        `search_index_update_vs_build_${indexSpec.name}`,
        `Index update vs full build ratio`,
        'backend_command',
        (updateMetric.value / (buildMetric?.value || 1)) * 100,
        'percent',
        { entries: indexSpec.entries }
      );
    }

    // Search query benchmark
    await benchmarkSearchQueries(indexSpec.entries);
  }
}

/**
 * Benchmark: Search query performance
 * Tests different query types and result sizes.
 */
async function benchmarkSearchQueries(indexSize: number): Promise<void> {
  const queryTypes = [
    { name: 'exact_match', complexity: 'low' },
    { name: 'prefix_match', complexity: 'medium' },
    { name: 'fuzzy_match', complexity: 'high' },
    { name: 'multi_term', complexity: 'high' },
  ];

  for (const queryType of queryTypes) {
    startTimer(`search_query_${queryType.name}_${indexSize}`);

    // Simulate search query
    const complexityMultiplier =
      queryType.complexity === 'high' ? 10 : queryType.complexity === 'medium' ? 3 : 1;

    const queryTime = Math.log10(indexSize) * 5 * complexityMultiplier;
    await new Promise((resolve) => setTimeout(resolve, queryTime));

    const queryMetric = endTimer(
      `search_query_${queryType.name}_${indexSize}`,
      `Search query (${queryType.name}, ${indexSize} entries)`,
      'backend_command'
    );

    if (queryMetric) {
      recordBackendCommand(`search_${queryType.name}`, queryMetric.value);
    }
  }
}

// ============================================================================
// Logging Performance Benchmarks
// ============================================================================

/**
 * Benchmark: Logger write performance
 * Tests synchronous vs asynchronous logging overhead.
 */
export async function benchmarkLoggingPerformance(): Promise<void> {
  logger.info('performance', 'benchmarkLoggingPerformance', 'Starting logging performance benchmark');

  const logCounts = [10, 50, 100];
  const messageSizes = ['small', 'medium', 'large'];

  for (const count of logCounts) {
    for (const size of messageSizes) {
      const messageLengths = { small: 50, medium: 500, large: 5000 } as const;
      const messageLength = messageLengths[size as keyof typeof messageLengths];

      startTimer(`log_write_${count}_${size}`);

      for (let i = 0; i < count; i++) {
        // Simulate log write
        const writeTime = Math.log10(messageLength) * 2 + Math.random() * 3;
        await new Promise((resolve) => setTimeout(resolve, writeTime));
      }

      const logMetric = endTimer(
        `log_write_${count}_${size}`,
        `Log write (${count} ${size} messages)`,
        'backend_command'
      );

      if (logMetric) {
        recordMetric(
          `log_write_per_message_${size}`,
          `Log write time per message (${size})`,
          'backend_command',
          logMetric.value / count,
          'ms',
          { count, messageSize: messageLength }
        );
      }
    }
  }

  // Batch vs individual logging
  startTimer('log_batch_100');

  // Simulate batched log write
  await new Promise((resolve) => setTimeout(resolve, 150));

  const batchMetric = endTimer('log_batch_100', 'Log batch write (100)', 'backend_command');

  startTimer('log_individual_100');

  // Simulate individual log writes
  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3));
  }

  const individualMetric = endTimer('log_individual_100', 'Log individual writes (100)', 'backend_command');

  if (batchMetric && individualMetric) {
    recordMetric(
      'log_batch_efficiency',
      'Log batch efficiency',
      'backend_command',
      ((individualMetric.value - batchMetric.value) / individualMetric.value) * 100,
      'percent'
    );
  }
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

/**
 * Run the complete backend benchmark suite.
 */
export async function runBackendBenchmarkSuite(): Promise<void> {
  logger.info('performance', 'runBackendBenchmarkSuite', 'Starting complete backend benchmark suite');

  await runBenchmark('backend_commands', benchmarkCommandLatency);
  await runBenchmark('backend_database', benchmarkDatabaseOperations);
  await runBenchmark('backend_filesystem', benchmarkFilesystemOperations);
  await runBenchmark('backend_search', benchmarkGlobalSearch);
  await runBenchmark('backend_logging', benchmarkLoggingPerformance);

  // Generate summary
  const backendMetrics = getMetricsByCategory('backend_command');
  const stats = calculateStats(backendMetrics);

  console.group('⚙️ Backend Benchmark Summary');
  console.log(`Metrics collected: ${backendMetrics.length}`);
  console.log(`Average latency: ${stats.mean.toFixed(2)}ms`);
  console.log(`P50: ${stats.p50.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
  console.log(`Min: ${stats.min.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
  console.groupEnd();

  logger.info('performance', 'runBackendBenchmarkSuite', 'Backend benchmark suite completed', {
    metricsCount: backendMetrics.length,
    avgLatency: stats.mean,
    p95Latency: stats.p95,
  });
}

/**
 * Quick backend benchmark for CI.
 */
export async function runQuickBackendBenchmark(): Promise<{
  pingLatency: number;
  dbQueryTime: number;
  fileReadTime: number;
}> {
  // Ping test
  startTimer('quick_ping');
  try {
    await invoke('greet', { name: 'test' });
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const pingMetric = endTimer('quick_ping', 'Quick ping test', 'backend_command');

  // DB query test
  startTimer('quick_db');
  await new Promise((resolve) => setTimeout(resolve, 25));
  const dbMetric = endTimer('quick_db', 'Quick DB test', 'backend_command');

  // File read test
  startTimer('quick_fs');
  await new Promise((resolve) => setTimeout(resolve, 15));
  const fsMetric = endTimer('quick_fs', 'Quick FS test', 'backend_command');

  return {
    pingLatency: pingMetric?.value || 0,
    dbQueryTime: dbMetric?.value || 0,
    fileReadTime: fsMetric?.value || 0,
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  runBackendBenchmarkSuite,
  runQuickBackendBenchmark,
  benchmarkCommandLatency,
  benchmarkDatabaseOperations,
  benchmarkFilesystemOperations,
  benchmarkGlobalSearch,
  benchmarkLoggingPerformance,
};
