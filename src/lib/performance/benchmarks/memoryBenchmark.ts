/**
 * Memory & Leak Detection Benchmark Suite
 *
 * Comprehensive benchmarks for measuring memory consumption,
 * garbage collection impact, and memory leak detection across
 * the DesQTA application.
 *
 * @module performance/benchmarks/memoryBenchmark
 */

import {
  runBenchmark,
  startTimer,
  endTimer,
  recordMetric,
  getMetricsByCategory,
  calculateStats,
} from '../services/metricsTracker';
import { logger } from '../../../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface MemoryGrowthReport {
  component: string;
  initialMemory: number;
  finalMemory: number;
  growthBytes: number;
  growthMB: number;
  leakDetected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// Memory Measurement Utilities
// ============================================================================

/**
 * Get current memory usage from performance.memory API
 */
export function getMemorySnapshot(): MemorySnapshot | null {
  if (typeof performance === 'undefined' || !(performance as any).memory) {
    return null;
  }

  const memory = (performance as any).memory;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    timestamp: performance.now(),
  };
}

/**
 * Calculate memory delta between two snapshots
 */
export function calculateMemoryDelta(
  before: MemorySnapshot,
  after: MemorySnapshot
): {
  usedHeapDelta: number;
  totalHeapDelta: number;
  percentChange: number;
} {
  const usedHeapDelta = after.usedJSHeapSize - before.usedJSHeapSize;
  const totalHeapDelta = after.totalJSHeapSize - before.totalJSHeapSize;
  const percentChange = (usedHeapDelta / before.usedJSHeapSize) * 100;

  return {
    usedHeapDelta,
    totalHeapDelta,
    percentChange,
  };
}

/**
 * Force garbage collection if available (requires --expose-gc flag)
 */
export async function forceGarbageCollection(): Promise<boolean> {
  if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
    try {
      (globalThis as any).gc();
      // Wait for GC to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    } catch (e) {
      return false;
    }
  }
  // Fallback: induce GC through memory pressure
  try {
    const pressure = new Array(1000000).fill(0);
    pressure.length = 0;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return false;
  } catch {
    return false;
  }
}

/**
 * Wait for stable memory (no significant changes over time)
 */
export async function waitForStableMemory(
  stabilityThreshold: number = 1024 * 1024, // 1MB
  maxWaitMs: number = 5000
): Promise<MemorySnapshot | null> {
  const startTime = performance.now();
  let lastSnapshot = getMemorySnapshot();
  let stableCount = 0;

  while (performance.now() - startTime < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const current = getMemorySnapshot();

    if (!current || !lastSnapshot) return null;

    const delta = Math.abs(current.usedJSHeapSize - lastSnapshot.usedJSHeapSize);

    if (delta < stabilityThreshold) {
      stableCount++;
      if (stableCount >= 3) {
        return current;
      }
    } else {
      stableCount = 0;
    }

    lastSnapshot = current;
  }

  return lastSnapshot;
}

// ============================================================================
// Component Memory Benchmarks
// ============================================================================

/**
 * Benchmark: Widget Grid Memory Usage
 * Measures memory consumption of the dashboard widget grid
 */
export async function benchmarkWidgetGridMemory(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetGridMemory', 'Starting widget grid memory benchmark');

  const widgetCounts = [1, 4, 9, 16, 25];
  const results: Array<{
    widgetCount: number;
    baseMemory: number;
    afterRender: number;
    afterGC: number;
    perWidgetOverhead: number;
  }> = [];

  for (const count of widgetCounts) {
    // Baseline
    await forceGarbageCollection();
    const baseline = await waitForStableMemory();
    if (!baseline) continue;

    // Simulate widget data structures
    const widgets = [];
    for (let i = 0; i < count; i++) {
      widgets.push({
        id: `widget_${i}`,
        type: ['weather', 'timetable', 'grades', 'tasks'][i % 4],
        data: generateWidgetData(i),
        config: { position: { x: i % 4, y: Math.floor(i / 4) } },
      });
    }

    const afterRender = getMemorySnapshot();
    if (!afterRender) continue;

    // Force GC and measure retained memory
    await forceGarbageCollection();
    const afterGC = await waitForStableMemory();

    const baseMemory = baseline.usedJSHeapSize;
    const renderMemory = afterRender.usedJSHeapSize;
    const gcMemory = afterGC?.usedJSHeapSize || renderMemory;

    const perWidgetOverhead = (gcMemory - baseMemory) / count;

    results.push({
      widgetCount: count,
      baseMemory,
      afterRender: renderMemory,
      afterGC: gcMemory,
      perWidgetOverhead,
    });

    startTimer(`widget_memory_${count}`);
    recordMetric(
      `widget_grid_memory_${count}`,
      `Widget grid memory: ${count} widgets`,
      'render',
      gcMemory - baseMemory,
      'bytes',
      { widgetCount: count, perWidgetOverhead }
    );
    endTimer(`widget_memory_${count}`, `Widget memory: ${count}`, 'render', 'bytes');

    // Clean up
    widgets.length = 0;
  }

  // Linear growth check
  const perWidgetOverheads = results.map((r) => r.perWidgetOverhead);
  const avgOverhead =
    perWidgetOverheads.reduce((a, b) => a + b, 0) / perWidgetOverheads.length;

  recordMetric(
    'widget_avg_memory_per_widget',
    'Average memory per widget',
    'render',
    avgOverhead,
    'bytes',
    { results }
  );

  logger.info('performance', 'benchmarkWidgetGridMemory', 'Widget grid memory results', {
    avgOverheadBytes: avgOverhead,
    avgOverheadMB: (avgOverhead / 1024 / 1024).toFixed(2),
  });
}

/**
 * Benchmark: Notes Editor Memory Usage
 * Tests memory consumption during note editing
 */
export async function benchmarkNotesEditorMemory(): Promise<void> {
  logger.info('performance', 'benchmarkNotesEditorMemory', 'Starting notes editor memory benchmark');

  const contentSizes = [
    { name: 'empty', charCount: 0 },
    { name: 'small', charCount: 1000 },
    { name: 'medium', charCount: 10000 },
    { name: 'large', charCount: 50000 },
    { name: 'xlarge', charCount: 200000 },
  ];

  for (const size of contentSizes) {
    await forceGarbageCollection();
    const baseline = await waitForStableMemory();
    if (!baseline) continue;

    startTimer(`notes_memory_${size.name}`);

    // Simulate note content
    const noteContent = generateTextContent(size.charCount);
    const editorState = {
      content: noteContent,
      history: generateEditHistory(size.charCount / 100),
      plugins: ['markdown', 'syntax', 'images', 'links'],
      decorations: generateDecorations(size.charCount),
    };

    const afterLoad = getMemorySnapshot();
    if (!afterLoad) continue;

    // Simulate editing operations
    for (let i = 0; i < 50; i++) {
      editorState.history.push({
        type: 'insert',
        position: Math.floor(Math.random() * noteContent.length),
        text: generateTextContent(10),
      });
    }

    const afterEdits = getMemorySnapshot();
    if (!afterEdits) continue;

    // Check for leaks - memory should stabilize
    await forceGarbageCollection();
    const afterGC = await waitForStableMemory();

    const memoryGrowth = (afterGC?.usedJSHeapSize || afterEdits.usedJSHeapSize) - baseline.usedJSHeapSize;
    const bytesPerChar = memoryGrowth / size.charCount;

    recordMetric(
      `notes_editor_memory_${size.name}`,
      `Notes editor memory: ${size.name}`,
      'render',
      memoryGrowth,
      'bytes',
      {
        charCount: size.charCount,
        bytesPerChar,
        historySize: editorState.history.length,
      }
    );

    endTimer(`notes_memory_${size.name}`, `Notes memory: ${size.name}`, 'render', 'bytes');

    // Leak detection for history
    if (size.charCount > 10000) {
      const historyLeakSuspected = editorState.history.length > 1000;
      if (historyLeakSuspected) {
        logger.warn(
          'performance',
          'benchmarkNotesEditorMemory',
          `Potential history memory issue at ${size.name}`,
          { historySize: editorState.history.length }
        );
      }
    }
  }
}

/**
 * Benchmark: Assessment Data Memory Usage
 * Tests memory consumption with large assessment datasets
 */
export async function benchmarkAssessmentDataMemory(): Promise<void> {
  logger.info('performance', 'benchmarkAssessmentDataMemory', 'Starting assessment data memory benchmark');

  const datasetSizes = [
    { name: 'minimal', assessmentCount: 10, submissionsPerAssessment: 5 },
    { name: 'small', assessmentCount: 50, submissionsPerAssessment: 10 },
    { name: 'medium', assessmentCount: 200, submissionsPerAssessment: 20 },
    { name: 'large', assessmentCount: 500, submissionsPerAssessment: 30 },
    { name: 'xlarge', assessmentCount: 1000, submissionsPerAssessment: 50 },
  ];

  for (const size of datasetSizes) {
    await forceGarbageCollection();
    const baseline = await waitForStableMemory();
    if (!baseline) continue;

    startTimer(`assessment_memory_${size.name}`);

    // Generate assessment data
    const assessments = [];
    for (let i = 0; i < size.assessmentCount; i++) {
      assessments.push({
        id: i,
        title: `Assessment ${i}`,
        subject: `Subject ${i % 10}`,
        dueDate: new Date(Date.now() + i * 86400000),
        submissions: generateSubmissions(size.submissionsPerAssessment),
        metadata: generateAssessmentMetadata(),
      });
    }

    const afterLoad = getMemorySnapshot();
    if (!afterLoad) continue;

    // Simulate filtering/sorting operations
    const filtered = assessments.filter((a) => a.subject === 'Subject 0');
    const sorted = [...assessments].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const afterOperations = getMemorySnapshot();
    if (!afterOperations) continue;

    await forceGarbageCollection();
    const afterGC = await waitForStableMemory();

    const memoryUsed =
      (afterGC?.usedJSHeapSize || afterOperations.usedJSHeapSize) - baseline.usedJSHeapSize;
    const memoryPerAssessment = memoryUsed / size.assessmentCount;

    recordMetric(
      `assessment_data_memory_${size.name}`,
      `Assessment data memory: ${size.name}`,
      'render',
      memoryUsed,
      'bytes',
      {
        assessmentCount: size.assessmentCount,
        totalSubmissions: size.assessmentCount * size.submissionsPerAssessment,
        memoryPerAssessment,
      }
    );

    endTimer(`assessment_memory_${size.name}`, `Assessment memory: ${size.name}`, 'render', 'bytes');

    // Cleanup references
    assessments.length = 0;
    filtered.length = 0;
    sorted.length = 0;
  }
}

// ============================================================================
// Memory Leak Detection Benchmarks
// ============================================================================

/**
 * Benchmark: Route Transition Memory Leaks
 * Detects memory leaks during route navigation
 */
export async function benchmarkRouteMemoryLeaks(): Promise<void> {
  logger.info('performance', 'benchmarkRouteMemoryLeaks', 'Starting route memory leak benchmark');

  const routes = [
    '/dashboard',
    '/assessments',
    '/courses',
    '/analytics',
    '/notices',
    '/messages',
  ];

  const iterations = 20;
  const memorySnapshots: number[] = [];

  // Initial baseline
  await forceGarbageCollection();
  const baseline = await waitForStableMemory();
  if (!baseline) return;

  for (let i = 0; i < iterations; i++) {
    // Simulate route transition
    const route = routes[i % routes.length];

    // Simulate component mount/unmount
    const componentState = simulateRouteComponent(route);
    componentState.active = true;

    // Simulate some interaction
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Unmount
    componentState.active = false;
    componentState.data = null;

    // Force cleanup
    await forceGarbageCollection();

    if (i % 5 === 0) {
      const snapshot = await waitForStableMemory();
      if (snapshot) {
        memorySnapshots.push(snapshot.usedJSHeapSize);
      }
    }
  }

  // Final measurement
  await forceGarbageCollection();
  const final = await waitForStableMemory();
  if (!final) return;

  // Analyze for leaks
  const memoryGrowth = final.usedJSHeapSize - baseline.usedJSHeapSize;
  const growthPerIteration = memoryGrowth / iterations;

  // Linear regression to detect trend
  const leakDetected = detectMemoryTrend(memorySnapshots);

  recordMetric(
    'route_transition_memory_leak',
    'Route transition memory leak detection',
    'render',
    memoryGrowth,
    'bytes',
    {
      iterations,
      growthPerIteration,
      leakDetected,
      snapshots: memorySnapshots,
    }
  );

  if (leakDetected) {
    logger.warn('performance', 'benchmarkRouteMemoryLeaks', 'Potential memory leak detected in route transitions', {
      memoryGrowth,
      growthPerIteration,
    });
  }
}

/**
 * Benchmark: Widget Creation/Destruction Leaks
 * Tests for memory leaks in widget lifecycle
 */
export async function benchmarkWidgetLifecycleLeaks(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetLifecycleLeaks', 'Starting widget lifecycle leak benchmark');

  const widgetTypes = ['weather', 'timetable', 'grades', 'tasks', 'notes'];
  const iterations = 50;

  await forceGarbageCollection();
  const baseline = await waitForStableMemory();
  if (!baseline) return;

  const memoryReadings: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Create widget
    const widget = {
      id: `widget_${i}`,
      type: widgetTypes[i % widgetTypes.length],
      data: generateWidgetData(i),
      listeners: new Map(),
      intervals: new Set<number>(),
    };

    // Simulate event listeners
    widget.listeners.set('click', () => {});
    widget.listeners.set('update', () => {});

    // Simulate intervals (potential leak source)
    widget.intervals.add(window.setInterval(() => {}, 1000));

    // Simulate activity
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Destroy widget - check for proper cleanup
    widget.data = {};

    // Intentionally NOT clearing intervals in some cases to simulate leak
    if (i % 3 === 0) {
      widget.intervals.forEach((id) => clearInterval(id));
      widget.intervals.clear();
    }

    widget.listeners.clear();

    if (i % 10 === 0) {
      await forceGarbageCollection();
      const snapshot = getMemorySnapshot();
      if (snapshot) {
        memoryReadings.push(snapshot.usedJSHeapSize);
      }
    }
  }

  // Final cleanup
  await forceGarbageCollection();
  const final = await waitForStableMemory();
  if (!final) return;

  const totalGrowth = final.usedJSHeapSize - baseline.usedJSHeapSize;
  const leakDetected = totalGrowth > 1024 * 1024; // > 1MB growth indicates leak

  recordMetric(
    'widget_lifecycle_memory_leak',
    'Widget lifecycle memory leak detection',
    'render',
    totalGrowth,
    'bytes',
    {
      iterations,
      leakDetected,
      readings: memoryReadings,
    }
  );

  if (leakDetected) {
    logger.warn('performance', 'benchmarkWidgetLifecycleLeaks', 'Widget lifecycle memory leak detected', {
      totalGrowth,
      avgGrowthPerWidget: totalGrowth / iterations,
    });
  }
}

/**
 * Benchmark: Event Listener Leak Detection
 * Tests for accumulation of event listeners
 */
export async function benchmarkEventListenerLeaks(): Promise<void> {
  logger.info('performance', 'benchmarkEventListenerLeaks', 'Starting event listener leak benchmark');

  const operations = 100;
  const listeners: Array<{ type: string; handler: () => void }> = [];

  await forceGarbageCollection();
  const baseline = await waitForStableMemory();
  if (!baseline) return;

  // Simulate adding listeners without cleanup (leak pattern)
  for (let i = 0; i < operations; i++) {
    const listener = {
      type: ['click', 'scroll', 'resize', 'keydown'][i % 4],
      handler: () => {
        /* handler */
      },
    };

    // Simulate DOM addEventListener
    listeners.push(listener);

    // Only clean up 70% (simulate imperfect cleanup)
    if (i > 0 && Math.random() > 0.3) {
      listeners.splice(Math.floor(Math.random() * listeners.length), 1);
    }
  }

  const afterOperations = getMemorySnapshot();
  if (!afterOperations) return;

  // Proper cleanup
  listeners.length = 0;

  await forceGarbageCollection();
  const afterCleanup = await waitForStableMemory();
  if (!afterCleanup) return;

  const leakedListeners = operations - listeners.length;
  const leakRatio = leakedListeners / operations;

  recordMetric(
    'event_listener_leak_ratio',
    'Event listener leak ratio',
    'render',
    leakRatio * 100,
    'percent',
    {
      totalListeners: operations,
      cleanedUp: listeners.length,
      leaked: leakedListeners,
    }
  );

  if (leakRatio > 0.1) {
    logger.warn('performance', 'benchmarkEventListenerLeaks', 'Event listener leak detected', {
      leakRatio,
      leakedListeners,
    });
  }
}

// ============================================================================
// Garbage Collection Impact Benchmarks
// ============================================================================

/**
 * Benchmark: GC Pause Impact
 * Measures the impact of garbage collection on frame times
 */
export async function benchmarkGCPauseImpact(): Promise<void> {
  logger.info('performance', 'benchmarkGCPauseImpact', 'Starting GC pause impact benchmark');

  const gcPauses: number[] = [];
  let frameCount = 0;
  let droppedFrames = 0;
  let lastFrameTime = performance.now();

  // Frame monitoring
  const monitorFrames = () => {
    const now = performance.now();
    const frameTime = now - lastFrameTime;
    lastFrameTime = now;

    frameCount++;

    // Detect dropped frame (> 33ms for 30fps)
    if (frameTime > 33) {
      droppedFrames++;
    }

    if (frameCount < 300) {
      requestAnimationFrame(monitorFrames);
    }
  };

  requestAnimationFrame(monitorFrames);

  // Trigger GC at intervals and measure impact
  for (let i = 0; i < 10; i++) {
    const beforeGC = performance.now();

    // Allocate memory to trigger GC
    const garbage: unknown[] = [];
    for (let j = 0; j < 100000; j++) {
      garbage.push({ id: j, data: new Array(100).fill(j) });
    }

    const gcTriggered = await forceGarbageCollection();
    const gcTime = performance.now() - beforeGC;

    if (gcTriggered || gcTime > 50) {
      gcPauses.push(gcTime);
    }

    // Clear reference
    garbage.length = 0;

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const avgPause = gcPauses.length > 0
    ? gcPauses.reduce((a, b) => a + b, 0) / gcPauses.length
    : 0;
  const maxPause = gcPauses.length > 0 ? Math.max(...gcPauses) : 0;

  recordMetric(
    'gc_average_pause',
    'Average GC pause time',
    'render',
    avgPause,
    'ms',
    { gcPauses }
  );

  recordMetric(
    'gc_max_pause',
    'Maximum GC pause time',
    'render',
    maxPause,
    'ms'
  );

  recordMetric(
    'gc_dropped_frames',
    'Frames dropped during GC',
    'render',
    droppedFrames,
    'count',
    { totalFrames: frameCount }
  );

  logger.info('performance', 'benchmarkGCPauseImpact', 'GC pause impact results', {
    avgPause: avgPause.toFixed(2),
    maxPause: maxPause.toFixed(2),
    droppedFrames,
  });
}

/**
 * Benchmark: Memory Fragmentation
 * Tests memory fragmentation patterns
 */
export async function benchmarkMemoryFragmentation(): Promise<void> {
  logger.info('performance', 'benchmarkMemoryFragmentation', 'Starting memory fragmentation benchmark');

  await forceGarbageCollection();
  const baseline = getMemorySnapshot();
  if (!baseline) return;

  // Allocate objects of varying sizes
  const objects: unknown[] = [];
  const sizes = [64, 256, 1024, 4096, 16384, 65536];

  for (let i = 0; i < 1000; i++) {
    const size = sizes[i % sizes.length];
    objects.push(new Array(size).fill(i));
  }

  const afterAllocation = getMemorySnapshot();
  if (!afterAllocation) return;

  // Free every other object (creates fragmentation)
  for (let i = objects.length - 1; i >= 0; i -= 2) {
    objects[i] = null;
  }

  await forceGarbageCollection();

  // Allocate new objects to fill gaps
  for (let i = 0; i < 500; i++) {
    const size = sizes[i % sizes.length];
    objects.push(new Array(size).fill(i));
  }

  const afterFragmentation = getMemorySnapshot();
  if (!afterFragmentation) return;

  // Calculate fragmentation metrics
  const expectedSize = afterAllocation.usedJSHeapSize;
  const actualSize = afterFragmentation.usedJSHeapSize;
  const overhead = actualSize - expectedSize;

  recordMetric(
    'memory_fragmentation_overhead',
    'Memory fragmentation overhead',
    'render',
    overhead,
    'bytes',
    {
      expectedSize,
      actualSize,
      fragmentationRatio: overhead / expectedSize,
    }
  );

  // Cleanup
  objects.length = 0;
}

// ============================================================================
// Component-Specific Memory Tests
// ============================================================================

/**
 * Benchmark: Timetable Grid Memory
 * Tests memory usage of the timetable component
 */
export async function benchmarkTimetableMemory(): Promise<void> {
  logger.info('performance', 'benchmarkTimetableMemory', 'Starting timetable memory benchmark');

  const weekCounts = [1, 2, 4, 8, 12];

  for (const weeks of weekCounts) {
    await forceGarbageCollection();
    const baseline = await waitForStableMemory();
    if (!baseline) continue;

    startTimer(`timetable_memory_${weeks}w`);

    // Simulate timetable data
    const lessons = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 5; d++) {
        for (let p = 0; p < 8; p++) {
          lessons.push({
            id: `${w}-${d}-${p}`,
            week: w,
            day: d,
            period: p,
            subject: `Subject ${(d * 8 + p) % 10}`,
            room: `Room ${100 + ((d * 8 + p) % 20)}`,
            teacher: `Teacher ${(d * 8 + p) % 15}`,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            metadata: generateLessonMetadata(),
          });
        }
      }
    }

    const afterLoad = getMemorySnapshot();
    if (!afterLoad) continue;

    // Simulate rendering
    const renderedCells = lessons.map((l) => ({
      ...l,
      computedStyle: { top: 0, left: 0, height: 50, width: 100 },
    }));

    const afterRender = getMemorySnapshot();
    if (!afterRender) continue;

    await forceGarbageCollection();
    const afterGC = await waitForStableMemory();

    const memoryUsed = (afterGC?.usedJSHeapSize || afterRender.usedJSHeapSize) - baseline.usedJSHeapSize;
    const memoryPerLesson = memoryUsed / lessons.length;

    recordMetric(
      `timetable_memory_${weeks}w`,
      `Timetable memory: ${weeks} weeks`,
      'render',
      memoryUsed,
      'bytes',
      {
        lessonCount: lessons.length,
        memoryPerLesson,
        weeks,
      }
    );

    endTimer(`timetable_memory_${weeks}w`, `Timetable memory: ${weeks}w`, 'render', 'bytes');

    // Cleanup
    lessons.length = 0;
    renderedCells.length = 0;
  }
}

/**
 * Benchmark: Analytics Charts Memory
 * Tests memory usage with various chart types and data sizes
 */
export async function benchmarkAnalyticsChartsMemory(): Promise<void> {
  logger.info('performance', 'benchmarkAnalyticsChartsMemory', 'Starting analytics charts memory benchmark');

  const chartConfigs = [
    { type: 'line', dataPoints: 100 },
    { type: 'bar', dataPoints: 50 },
    { type: 'pie', dataPoints: 20 },
    { type: 'scatter', dataPoints: 500 },
    { type: 'heatmap', dataPoints: 1000 },
  ];

  for (const config of chartConfigs) {
    await forceGarbageCollection();
    const baseline = await waitForStableMemory();
    if (!baseline) continue;

    startTimer(`chart_memory_${config.type}`);

    // Generate chart data
    const data = [];
    for (let i = 0; i < config.dataPoints; i++) {
      data.push({
        x: i,
        y: Math.random() * 100,
        label: `Point ${i}`,
        metadata: { timestamp: Date.now(), source: 'benchmark' },
      });
    }

    // Simulate chart instance
    const chartInstance = {
      type: config.type,
      data,
      scales: { x: {}, y: {} },
      elements: generateChartElements(config.type, config.dataPoints),
      animations: new Map(),
    };

    const afterLoad = getMemorySnapshot();
    if (!afterLoad) continue;

    // Simulate interactions
    for (let i = 0; i < 10; i++) {
      chartInstance.animations.set(i, { start: Date.now(), duration: 300 });
    }

    const afterAnimations = getMemorySnapshot();
    if (!afterAnimations) continue;

    await forceGarbageCollection();
    const afterGC = await waitForStableMemory();

    const memoryUsed = (afterGC?.usedJSHeapSize || afterAnimations.usedJSHeapSize) - baseline.usedJSHeapSize;

    recordMetric(
      `chart_memory_${config.type}`,
      `Chart memory: ${config.type}`,
      'render',
      memoryUsed,
      'bytes',
      {
        chartType: config.type,
        dataPoints: config.dataPoints,
        memoryPerPoint: memoryUsed / config.dataPoints,
      }
    );

    endTimer(`chart_memory_${config.type}`, `Chart memory: ${config.type}`, 'render', 'bytes');

    // Cleanup
    chartInstance.animations.clear();
  }
}

// ============================================================================
// Suite Runners
// ============================================================================

/**
 * Run the complete memory benchmark suite
 */
export async function runMemoryBenchmarkSuite(): Promise<{
  passed: boolean;
  leaksDetected: boolean;
  reports: MemoryGrowthReport[];
}> {
  logger.info('performance', 'runMemoryBenchmarkSuite', 'Starting complete memory benchmark suite');

  const reports: MemoryGrowthReport[] = [];

  await runBenchmark('memory_widget_grid', benchmarkWidgetGridMemory);
  await runBenchmark('memory_notes_editor', benchmarkNotesEditorMemory);
  await runBenchmark('memory_assessment_data', benchmarkAssessmentDataMemory);
  await runBenchmark('memory_route_leaks', benchmarkRouteMemoryLeaks);
  await runBenchmark('memory_widget_leaks', benchmarkWidgetLifecycleLeaks);
  await runBenchmark('memory_event_listener_leaks', benchmarkEventListenerLeaks);
  await runBenchmark('memory_gc_pauses', benchmarkGCPauseImpact);
  await runBenchmark('memory_fragmentation', benchmarkMemoryFragmentation);
  await runBenchmark('memory_timetable', benchmarkTimetableMemory);
  await runBenchmark('memory_analytics_charts', benchmarkAnalyticsChartsMemory);

  // Generate summary
  const metrics = getMetricsByCategory('render');
  const leakMetrics = metrics.filter((m) => m.name.includes('leak'));

  const leaksDetected = leakMetrics.some((m) => {
    const metadata = m.context as { leakDetected?: boolean };
    return metadata?.leakDetected === true;
  });

  const totalMemoryGrowth = metrics
    .filter((m) => m.unit === 'bytes')
    .reduce((sum, m) => sum + m.value, 0);

  logger.info('performance', 'runMemoryBenchmarkSuite', 'Memory benchmark suite completed', {
    leaksDetected,
    totalMemoryGrowth,
    metricsCollected: metrics.length,
  });

  return {
    passed: !leaksDetected,
    leaksDetected,
    reports,
  };
}

/**
 * Quick memory check for CI/automated testing
 */
export async function runQuickMemoryBenchmark(): Promise<{
  heapUsedMB: number;
  heapTotalMB: number;
  leakDetected: boolean;
  gcPausesAvg: number;
}> {
  const snapshot = getMemorySnapshot();
  if (!snapshot) {
    return { heapUsedMB: 0, heapTotalMB: 0, leakDetected: false, gcPausesAvg: 0 };
  }

  await benchmarkWidgetLifecycleLeaks();

  const metrics = getMetricsByCategory('render');
  const leakMetric = metrics.find((m) => m.name === 'widget_lifecycle_memory_leak');
  const gcMetric = metrics.find((m) => m.name === 'gc_average_pause');

  return {
    heapUsedMB: Math.round(snapshot.usedJSHeapSize / 1024 / 1024),
    heapTotalMB: Math.round(snapshot.totalJSHeapSize / 1024 / 1024),
    leakDetected: (leakMetric?.context as { leakDetected?: boolean })?.leakDetected || false,
    gcPausesAvg: gcMetric?.value || 0,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateWidgetData(index: number): Record<string, unknown> {
  return {
    id: index,
    title: `Widget ${index}`,
    settings: { enabled: true, refreshRate: 60 },
    data: new Array(100).fill(null).map((_, i) => ({
      id: i,
      value: Math.random(),
      timestamp: Date.now(),
    })),
  };
}

function generateTextContent(charCount: number): string {
  const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'];
  let content = '';
  while (content.length < charCount) {
    content += words[Math.floor(Math.random() * words.length)] + ' ';
  }
  return content.slice(0, charCount);
}

function generateEditHistory(count: number): unknown[] {
  return new Array(Math.min(count, 100)).fill(null).map((_, i) => ({
    type: i % 2 === 0 ? 'insert' : 'delete',
    position: i * 10,
    timestamp: Date.now() - i * 1000,
  }));
}

function generateDecorations(charCount: number): unknown[] {
  const count = Math.min(Math.floor(charCount / 100), 50);
  return new Array(count).fill(null).map((_, i) => ({
    from: i * 100,
    to: i * 100 + 10,
    class: 'highlight',
  }));
}

function generateSubmissions(count: number): unknown[] {
  return new Array(count).fill(null).map((_, i) => ({
    id: i,
    studentId: `student_${i}`,
    submittedAt: new Date(Date.now() - i * 86400000),
    grade: Math.floor(Math.random() * 100),
    attachments: new Array(Math.floor(Math.random() * 3)).fill(null).map((_, j) => ({
      name: `attachment_${j}.pdf`,
      size: Math.floor(Math.random() * 1000000),
    })),
  }));
}

function generateAssessmentMetadata(): Record<string, unknown> {
  return {
    createdBy: 'teacher_1',
    createdAt: Date.now(),
    tags: ['math', 'quiz', 'grade7'],
    settings: { allowLateSubmission: true, maxAttempts: 3 },
    rubric: new Array(5).fill(null).map((_, i) => ({
      criterion: `Criterion ${i}`,
      points: (i + 1) * 10,
    })),
  };
}

function simulateRouteComponent(route: string): { active: boolean; data: unknown } {
  return {
    active: false,
    data: {
      route,
      timestamp: Date.now(),
      state: new Array(1000).fill(null).map((_, i) => ({ id: i, value: Math.random() })),
    },
  };
}

function detectMemoryTrend(readings: number[]): boolean {
  if (readings.length < 3) return false;

  // Simple linear regression
  const n = readings.length;
  const sumX = readings.reduce((sum, _, i) => sum + i, 0);
  const sumY = readings.reduce((sum, val) => sum + val, 0);
  const sumXY = readings.reduce((sum, val, i) => sum + i * val, 0);
  const sumXX = readings.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Positive slope indicates potential leak
  return slope > 1024 * 1024; // > 1MB per measurement
}

function generateLessonMetadata(): Record<string, unknown> {
  return {
    homework: { assigned: true, dueDate: Date.now() + 86400000 },
    resources: new Array(3).fill(null).map((_, i) => ({
      type: 'pdf',
      url: `https://example.com/resource_${i}.pdf`,
    })),
    attendance: { present: 25, absent: 2 },
  };
}

function generateChartElements(type: string, count: number): unknown[] {
  switch (type) {
    case 'line':
      return new Array(count).fill(null).map((_, i) => ({
        x: i,
        y: Math.random() * 100,
        element: { path: `M${i},0 L${i},100` },
      }));
    case 'bar':
      return new Array(count).fill(null).map((_, i) => ({
        x: i,
        height: Math.random() * 100,
        width: 10,
      }));
    case 'pie':
      return new Array(count).fill(null).map((_, i) => ({
        value: Math.random() * 100,
        startAngle: (i / count) * 360,
        endAngle: ((i + 1) / count) * 360,
      }));
    default:
      return [];
  }
}

export default {
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
};
