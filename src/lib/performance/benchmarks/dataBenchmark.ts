/**
 * Data and Cache Benchmark Suite
 *
 * Benchmarks for measuring cache performance, serialization overhead,
 * IndexedDB operations, and data loading efficiency.
 *
 * @module performance/benchmarks/dataBenchmark
 */

import {
  runBenchmark,
  startTimer,
  endTimer,
  recordMetric,
  recordCacheStats,
  getMetricsByCategory,
  calculateStats,
} from '../services/metricsTracker';
import { cache } from '../../../utils/cache';
import { idbCacheGet, idbCacheSet } from '../../services/idb';
import { logger } from '../../../utils/logger';

// ============================================================================
// Cache Operation Benchmarks
// ============================================================================

/**
 * Benchmark memory cache read/write performance.
 */
export async function benchmarkMemoryCache(): Promise<void> {
  logger.info('performance', 'benchmarkMemoryCache', 'Starting memory cache benchmark');

  const payloadSizes = [
    { name: 'tiny', size: 100, iterations: 1000 },
    { name: 'small', size: 1000, iterations: 500 },
    { name: 'medium', size: 10000, iterations: 200 },
    { name: 'large', size: 100000, iterations: 50 },
    { name: 'xlarge', size: 500000, iterations: 20 },
  ];

  for (const { name, size, iterations } of payloadSizes) {
    const payload = { data: 'x'.repeat(size) };
    const key = `benchmark_mem_${name}`;

    // Benchmark writes
    startTimer(`cache_mem_write_${name}`);
    for (let i = 0; i < iterations; i++) {
      cache.set(`${key}_${i}`, payload, 60);
    }
    const writeMetric = endTimer(
      `cache_mem_write_${name}`,
      `Memory cache write (${name})`,
      'cache'
    );

    if (writeMetric) {
      recordMetric(
        `cache_mem_write_per_op_${name}`,
        `Memory cache write per operation (${name})`,
        'cache',
        writeMetric.value / iterations,
        'ms',
        { size, iterations }
      );
    }

    // Benchmark reads
    startTimer(`cache_mem_read_${name}`);
    for (let i = 0; i < iterations; i++) {
      cache.get(`${key}_${i}`);
    }
    const readMetric = endTimer(
      `cache_mem_read_${name}`,
      `Memory cache read (${name})`,
      'cache'
    );

    if (readMetric) {
      recordMetric(
        `cache_mem_read_per_op_${name}`,
        `Memory cache read per operation (${name})`,
        'cache',
        readMetric.value / iterations,
        'ms',
        { size, iterations }
      );
    }

    // Cleanup
    for (let i = 0; i < iterations; i++) {
      cache.delete(`${key}_${i}`);
    }
  }
}

/**
 * Benchmark IndexedDB read/write performance.
 */
export async function benchmarkIndexedDB(): Promise<void> {
  logger.info('performance', 'benchmarkIndexedDB', 'Starting IndexedDB benchmark');

  const payloadSizes = [
    { name: 'tiny', size: 100, iterations: 100 },
    { name: 'small', size: 1000, iterations: 50 },
    { name: 'medium', size: 10000, iterations: 20 },
    { name: 'large', size: 50000, iterations: 10 },
  ];

  for (const { name, size, iterations } of payloadSizes) {
    const payload = { data: 'x'.repeat(size), timestamp: Date.now() };
    const baseKey = `benchmark_idb_${name}`;

    // Benchmark writes
    startTimer(`cache_idb_write_${name}`);
    for (let i = 0; i < iterations; i++) {
      try {
        await idbCacheSet(`${baseKey}_${i}`, payload, 60);
      } catch (e) {
        // IDB might fail in some environments
        logger.warn('performance', 'benchmarkIndexedDB', `IDB write failed for ${name}`, { error: e });
        break;
      }
    }
    const writeMetric = endTimer(
      `cache_idb_write_${name}`,
      `IndexedDB write (${name})`,
      'cache'
    );

    if (writeMetric) {
      recordMetric(
        `cache_idb_write_per_op_${name}`,
        `IndexedDB write per operation (${name})`,
        'cache',
        writeMetric.value / iterations,
        'ms',
        { size, iterations }
      );
    }

    // Benchmark reads
    startTimer(`cache_idb_read_${name}`);
    for (let i = 0; i < iterations; i++) {
      try {
        await idbCacheGet(`${baseKey}_${i}`);
      } catch (e) {
        break;
      }
    }
    const readMetric = endTimer(
      `cache_idb_read_${name}`,
      `IndexedDB read (${name})`,
      'cache'
    );

    if (readMetric) {
      recordMetric(
        `cache_idb_read_per_op_${name}`,
        `IndexedDB read per operation (${name})`,
        'cache',
        readMetric.value / iterations,
        'ms',
        { size, iterations }
      );
    }

    // Cleanup
    for (let i = 0; i < iterations; i++) {
      try {
        await idbCacheSet(`${baseKey}_${i}`, null, 0);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// Serialization Benchmarks
// ============================================================================

/**
 * Benchmark JSON serialization overhead for different payload types.
 */
export async function benchmarkSerialization(): Promise<void> {
  logger.info('performance', 'benchmarkSerialization', 'Starting serialization benchmark');

  const payloadTypes = [
    {
      name: 'simple_object',
      payload: { id: 1, name: 'test', active: true },
    },
    {
      name: 'nested_object',
      payload: {
        id: 1,
        user: {
          name: 'John',
          profile: {
            age: 30,
            preferences: { theme: 'dark', notifications: true },
          },
        },
        items: [1, 2, 3, 4, 5],
      },
    },
    {
      name: 'array_of_objects',
      payload: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'A'.repeat(100),
        metadata: { created: Date.now(), updated: Date.now() },
      })),
    },
    {
      name: 'large_dataset',
      payload: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(500),
      })),
    },
  ];

  const iterations = 100;

  for (const { name, payload } of payloadTypes) {
    const payloadSize = JSON.stringify(payload).length;

    // Benchmark serialization
    startTimer(`serialization_encode_${name}`);
    for (let i = 0; i < iterations; i++) {
      JSON.stringify(payload);
    }
    const encodeMetric = endTimer(
      `serialization_encode_${name}`,
      `JSON stringify (${name})`,
      'cache'
    );

    if (encodeMetric) {
      recordMetric(
        `serialization_encode_per_op_${name}`,
        `JSON stringify per operation (${name})`,
        'cache',
        encodeMetric.value / iterations,
        'ms',
        { payloadSize, iterations }
      );
    }

    const serialized = JSON.stringify(payload);

    // Benchmark deserialization
    startTimer(`serialization_decode_${name}`);
    for (let i = 0; i < iterations; i++) {
      JSON.parse(serialized);
    }
    const decodeMetric = endTimer(
      `serialization_decode_${name}`,
      `JSON parse (${name})`,
      'cache'
    );

    if (decodeMetric) {
      recordMetric(
        `serialization_decode_per_op_${name}`,
        `JSON parse per operation (${name})`,
        'cache',
        decodeMetric.value / iterations,
        'ms',
        { payloadSize, iterations }
      );
    }

    // Total serialization overhead
    startTimer(`serialization_roundtrip_${name}`);
    for (let i = 0; i < iterations; i++) {
      JSON.parse(JSON.stringify(payload));
    }
    const roundtripMetric = endTimer(
      `serialization_roundtrip_${name}`,
      `JSON roundtrip (${name})`,
      'cache'
    );

    if (roundtripMetric) {
      recordMetric(
        `serialization_overhead_${name}`,
        `Serialization overhead per byte (${name})`,
        'cache',
        (roundtripMetric.value / iterations) / payloadSize * 1000,
        'ms',
        { payloadSize, iterations }
      );
    }
  }
}

// ============================================================================
// Cache Hit/Miss Benchmarks
// ============================================================================

/**
 * Benchmark cache hit rate under different access patterns.
 */
export async function benchmarkCacheHitRate(): Promise<void> {
  logger.info('performance', 'benchmarkCacheHitRate', 'Starting cache hit rate benchmark');

  const scenarios = [
    {
      name: 'sequential',
      description: 'Sequential access pattern',
      accessPattern: (keys: string[], i: number) => keys[i % keys.length],
    },
    {
      name: 'random',
      description: 'Random access pattern',
      accessPattern: (keys: string[]) => keys[Math.floor(Math.random() * keys.length)],
    },
    {
      name: 'hot_keys',
      description: '80% of accesses to 20% of keys (Pareto)',
      accessPattern: (keys: string[]) => {
        // 80% chance to pick from first 20% of keys
        if (Math.random() < 0.8) {
          const hotIndex = Math.floor(Math.random() * (keys.length * 0.2));
          return keys[hotIndex];
        }
        return keys[Math.floor(Math.random() * keys.length)];
      },
    },
  ];

  const numKeys = 100;
  const accessCount = 1000;

  // Populate cache
  const keys = Array.from({ length: numKeys }, (_, i) => `hitrate_key_${i}`);
  for (const key of keys) {
    cache.set(key, { data: `value_${key}` }, 60);
  }

  for (const scenario of scenarios) {
    let hits = 0;
    let misses = 0;

    startTimer(`cache_hitrate_${scenario.name}`);

    for (let i = 0; i < accessCount; i++) {
      const key = scenario.accessPattern(keys, i);
      const value = cache.get(key);
      if (value) {
        hits++;
      } else {
        misses++;
      }
    }

    endTimer(`cache_hitrate_${scenario.name}`, `Cache hit rate (${scenario.name})`, 'cache');

    const hitRate = (hits / accessCount) * 100;
    recordCacheStats(hitRate, 0, {
      benchmark: 'hitrate',
      scenario: scenario.name,
      totalAccesses: accessCount,
      hits,
      misses,
    });

    logger.info('performance', 'benchmarkCacheHitRate', `Hit rate for ${scenario.name}: ${hitRate.toFixed(2)}%`);
  }

  // Cleanup
  for (const key of keys) {
    cache.delete(key);
  }
}

// ============================================================================
// Data Loading Benchmarks
// ============================================================================

/**
 * Benchmark concurrent data loading patterns.
 */
export async function benchmarkConcurrentDataLoading(): Promise<void> {
  logger.info('performance', 'benchmarkConcurrentDataLoading', 'Starting concurrent data loading benchmark');

  const concurrencyLevels = [1, 2, 4, 8, 16];
  const requestsPerLevel = 20;

  for (const concurrency of concurrencyLevels) {
    // Simulate loading data with different concurrency levels
    startTimer(`data_load_concurrent_${concurrency}`);

    const batches = Math.ceil(requestsPerLevel / concurrency);
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, requestsPerLevel - batch * concurrency);
      const promises = Array.from({ length: batchSize }, (_, i) => {
        return new Promise<void>((resolve) => {
          // Simulate network/database delay
          setTimeout(() => {
            cache.set(`concurrent_${batch}_${i}`, { loaded: true }, 60);
            resolve();
          }, 50 + Math.random() * 50);
        });
      });

      await Promise.all(promises);
    }

    const metric = endTimer(
      `data_load_concurrent_${concurrency}`,
      `Concurrent data loading (concurrency: ${concurrency})`,
      'cache'
    );

    if (metric) {
      recordMetric(
        `data_load_time_per_request_${concurrency}`,
        `Time per request at concurrency ${concurrency}`,
        'cache',
        metric.value / requestsPerLevel,
        'ms',
        { concurrency, requests: requestsPerLevel }
      );
    }
  }
}

// ============================================================================
// Duplicate Request Detection
// ============================================================================

/**
 * Benchmark duplicate request detection and prevention.
 */
export async function benchmarkDuplicatePrevention(): Promise<void> {
  logger.info('performance', 'benchmarkDuplicatePrevention', 'Starting duplicate prevention benchmark');

  // Simulate scenario with duplicate requests
  const uniqueEndpoints = ['user', 'settings', 'timetable', 'assessments', 'notices'];
  const requests = [];
  const requestLog = new Map<string, number>();

  // Generate request pattern with duplicates
  for (let i = 0; i < 100; i++) {
    const endpoint = uniqueEndpoints[Math.floor(Math.random() * uniqueEndpoints.length)];
    requests.push(endpoint);

    // 30% chance of immediate duplicate
    if (Math.random() < 0.3) {
      requests.push(endpoint);
    }
  }

  // Method 1: No deduplication (baseline)
  startTimer('duplicate_baseline');
  let baselineDuplicates = 0;
  const baselineSeen = new Set<string>();

  for (let i = 0; i < requests.length; i++) {
    const req = `${requests[i]}_${i}`;
    if (baselineSeen.has(req)) {
      baselineDuplicates++;
    }
    baselineSeen.add(req);
  }

  endTimer('duplicate_baseline', 'Duplicate detection baseline', 'cache');

  // Method 2: Request deduplication with pending promise tracking
  startTimer('duplicate_with_dedup');
  const pendingRequests = new Map<string, Promise<any>>();
  let dedupedDuplicates = 0;

  for (const endpoint of requests) {
    if (pendingRequests.has(endpoint)) {
      dedupedDuplicates++;
      continue;
    }

    const promise = new Promise((resolve) => {
      setTimeout(() => resolve({ endpoint }), 10);
    });
    pendingRequests.set(endpoint, promise);

    // Simulate completion
    promise.then(() => pendingRequests.delete(endpoint));
  }

  endTimer('duplicate_with_dedup', 'Duplicate detection with deduplication', 'cache');

  // Record results
  recordMetric(
    'duplicate_baseline_count',
    'Duplicate requests without deduplication',
    'cache',
    baselineDuplicates,
    'count'
  );

  recordMetric(
    'duplicate_with_dedup_count',
    'Duplicate requests with deduplication',
    'cache',
    dedupedDuplicates,
    'count'
  );

  recordMetric(
    'duplicate_reduction_percent',
    'Duplicate request reduction percentage',
    'cache',
    ((baselineDuplicates - dedupedDuplicates) / baselineDuplicates) * 100,
    'percent'
  );

  logger.info('performance', 'benchmarkDuplicatePrevention', 'Duplicate prevention results', {
    baseline: baselineDuplicates,
    withDedup: dedupedDuplicates,
    reduction: ((baselineDuplicates - dedupedDuplicates) / baselineDuplicates) * 100,
  });
}

// ============================================================================
// Main Data Benchmark Runner
// ============================================================================

/**
 * Run the complete data/cache benchmark suite.
 */
export async function runDataBenchmarkSuite(): Promise<void> {
  logger.info('performance', 'runDataBenchmarkSuite', 'Starting data benchmark suite');

  await runBenchmark('data_memory_cache', benchmarkMemoryCache);
  await runBenchmark('data_indexeddb', benchmarkIndexedDB);
  await runBenchmark('data_serialization', benchmarkSerialization);
  await runBenchmark('data_cache_hitrate', benchmarkCacheHitRate);
  await runBenchmark('data_concurrent_loading', benchmarkConcurrentDataLoading);
  await runBenchmark('data_duplicate_prevention', benchmarkDuplicatePrevention);

  // Generate summary
  const cacheMetrics = getMetricsByCategory('cache');
  const stats = calculateStats(cacheMetrics);

  logger.info('performance', 'runDataBenchmarkSuite', 'Data benchmark suite completed', {
    metricsCollected: cacheMetrics.length,
    avgMetricValue: stats.mean,
    p95Value: stats.p95,
  });
}

/**
 * Quick data benchmark for CI.
 */
export async function runQuickDataBenchmark(): Promise<{
  memCacheSpeed: number;
  serializationOverhead: number;
  hitRate: number;
}> {
  // Memory cache speed
  startTimer('quick_mem_cache');
  for (let i = 0; i < 100; i++) {
    cache.set(`quick_${i}`, { data: i }, 60);
    cache.get(`quick_${i}`);
  }
  const memCacheMetric = endTimer('quick_mem_cache', 'Quick memory cache test', 'cache');

  // Serialization overhead
  const payload = { data: 'x'.repeat(1000) };
  startTimer('quick_serialization');
  for (let i = 0; i < 100; i++) {
    JSON.parse(JSON.stringify(payload));
  }
  const serializationMetric = endTimer('quick_serialization', 'Quick serialization test', 'cache');

  // Hit rate
  for (let i = 0; i < 50; i++) {
    cache.set(`hitrate_${i}`, { data: i }, 60);
  }
  let hits = 0;
  for (let i = 0; i < 100; i++) {
    if (cache.get(`hitrate_${Math.floor(Math.random() * 50)}`)) {
      hits++;
    }
  }

  return {
    memCacheSpeed: memCacheMetric?.value || 0,
    serializationOverhead: serializationMetric?.value || 0,
    hitRate: hits,
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  runDataBenchmarkSuite,
  runQuickDataBenchmark,
  benchmarkMemoryCache,
  benchmarkIndexedDB,
  benchmarkSerialization,
  benchmarkCacheHitRate,
  benchmarkConcurrentDataLoading,
  benchmarkDuplicatePrevention,
};
