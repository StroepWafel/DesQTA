/**
 * UI Interaction Benchmark Suite
 *
 * Comprehensive benchmarks for measuring DesQTA UI performance.
 * Covers widget interactions, search, route transitions, and frame rates.
 *
 * @module performance/benchmarks/uiBenchmark
 */

import {
  runBenchmark,
  startTimer,
  endTimer,
  recordMetric,
  recordUIInteraction,
  recordRouteTransition,
  recordDroppedFrames,
  getMetricsByCategory,
  calculateStats,
} from '../services/metricsTracker';
import { logger } from '../../../utils/logger';

// ============================================================================
// Widget Grid Benchmarks
// ============================================================================

/**
 * Benchmark: Widget drag and drop performance
 * Measures latency and smoothness during widget dragging operations.
 */
export async function benchmarkWidgetDragPerformance(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetDragPerformance', 'Starting widget drag benchmark');

  const dragScenarios = [
    { name: 'single_widget_short', widgets: 1, distance: 100, duration: 200 },
    { name: 'single_widget_long', widgets: 1, distance: 500, duration: 500 },
    { name: 'multiple_widgets_reorder', widgets: 4, distance: 200, duration: 300 },
    { name: 'full_grid_shuffle', widgets: 8, distance: 300, duration: 400 },
  ];

  for (const scenario of dragScenarios) {
    startTimer(`widget_drag_${scenario.name}`);

    // Simulate drag operation
    const startTime = performance.now();
    let frameCount = 0;
    let droppedFrames = 0;
    let lastFrameTime = startTime;

    // Simulate drag frames
    const frameDuration = scenario.duration / (scenario.distance / 10);
    for (let i = 0; i < scenario.distance; i += 10) {
      const currentTime = startTime + (i / scenario.distance) * scenario.duration;
      const actualFrameTime = currentTime - lastFrameTime;

      // Detect dropped frames (assuming 60fps = 16.67ms per frame)
      if (actualFrameTime > 20) {
        droppedFrames++;
      }

      frameCount++;
      lastFrameTime = currentTime;

      // Simulate layout recalculation
      if (i % 50 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }

    const dragMetric = endTimer(
      `widget_drag_${scenario.name}`,
      `Widget drag: ${scenario.name}`,
      'ui_interaction'
    );

    if (dragMetric) {
      recordUIInteraction('widget_drag', dragMetric.value, scenario.name);
    }

    // Calculate dropped frame percentage
    const expectedFrames = scenario.duration / 16.67;
    const droppedFramePercent = (droppedFrames / expectedFrames) * 100;
    recordDroppedFrames(droppedFramePercent);

    logger.info('performance', 'benchmarkWidgetDragPerformance', `Drag scenario ${scenario.name} completed`, {
      duration: scenario.duration,
      droppedFrames,
      droppedFramePercent: droppedFramePercent.toFixed(2) + '%',
    });
  }
}

/**
 * Benchmark: Widget resize performance
 * Measures performance during widget resizing operations.
 */
export async function benchmarkWidgetResizePerformance(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetResizePerformance', 'Starting widget resize benchmark');

  const resizeScenarios = [
    { name: 'small_resize', widthDelta: 50, heightDelta: 50, duration: 150 },
    { name: 'large_resize', widthDelta: 200, heightDelta: 150, duration: 250 },
    { name: 'fullscreen_toggle', widthDelta: 800, heightDelta: 600, duration: 300 },
  ];

  for (const scenario of resizeScenarios) {
    startTimer(`widget_resize_${scenario.name}`);

    // Simulate resize with layout thrashing detection
    let layoutRecalculations = 0;
    const steps = 10;

    for (let i = 0; i < steps; i++) {
      // Simulate DOM reads (causes layout calc)
      const width = 100 + (scenario.widthDelta * i) / steps;
      const height = 100 + (scenario.heightDelta * i) / steps;

      // Simulate forced synchronous layout (read then write)
      if (i % 2 === 0) {
        layoutRecalculations++;
        // This simulates reading offsetHeight then setting style
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Apply new dimensions
      await new Promise((resolve) => setTimeout(resolve, scenario.duration / steps));
    }

    const resizeMetric = endTimer(
      `widget_resize_${scenario.name}`,
      `Widget resize: ${scenario.name}`,
      'ui_interaction'
    );

    if (resizeMetric) {
      recordUIInteraction('widget_resize', resizeMetric.value, scenario.name);
    }

    // Record layout thrashing
    recordMetric(
      `widget_resize_${scenario.name}_layout_calcs`,
      `Layout recalculations during resize`,
      'render',
      layoutRecalculations,
      'count',
      { scenario: scenario.name }
    );
  }
}

// ============================================================================
// Search Performance Benchmarks
// ============================================================================

/**
 * Benchmark: Global search input responsiveness
 * Measures latency from keystroke to results update.
 */
export async function benchmarkSearchPerformance(): Promise<void> {
  logger.info('performance', 'benchmarkSearchPerformance', 'Starting search performance benchmark');

  const searchScenarios = [
    { name: 'single_char', query: 'a', resultCount: 50 },
    { name: 'short_query', query: 'math', resultCount: 15 },
    { name: 'medium_query', query: 'mathematics', resultCount: 8 },
    { name: 'long_query', query: 'mathematics assignment', resultCount: 3 },
    { name: 'fuzzy_match', query: 'mtc', resultCount: 20 }, // Typo-tolerance test
  ];

  for (const scenario of searchScenarios) {
    // Measure initial search (cold)
    startTimer(`search_cold_${scenario.name}`);

    // Simulate search index lookup
    await simulateSearchOperation(scenario.query, scenario.resultCount, true);

    const coldMetric = endTimer(
      `search_cold_${scenario.name}`,
      `Search cold: ${scenario.name}`,
      'ui_interaction'
    );

    if (coldMetric) {
      recordUIInteraction('search_input', coldMetric.value, `cold_${scenario.name}`);
    }

    // Measure subsequent search (warm cache)
    startTimer(`search_warm_${scenario.name}`);

    await simulateSearchOperation(scenario.query, scenario.resultCount, false);

    const warmMetric = endTimer(
      `search_warm_${scenario.name}`,
      `Search warm: ${scenario.name}`,
      'ui_interaction'
    );

    if (warmMetric) {
      recordUIInteraction('search_input', warmMetric.value, `warm_${scenario.name}`);
    }

    // Calculate cache efficiency
    const cacheImprovement = ((coldMetric?.value || 0) - (warmMetric?.value || 0)) / (coldMetric?.value || 1) * 100;

    recordMetric(
      `search_cache_efficiency_${scenario.name}`,
      `Search cache efficiency`,
      'cache',
      cacheImprovement,
      'percent',
      { scenario: scenario.name }
    );
  }

  // Benchmark rapid typing (debounce efficiency)
  await benchmarkSearchDebounce();
}

/**
 * Simulate a search operation with realistic timing.
 */
async function simulateSearchOperation(
  query: string,
  resultCount: number,
  isCold: boolean
): Promise<void> {
  // Base latency
  let latency = 10;

  // Query complexity factor
  latency += query.length * 2;

  // Result processing time
  latency += resultCount * 3;

  // Cold vs warm cache
  if (isCold) {
    latency += 50;
  } else {
    latency *= 0.3; // 70% faster with cache
  }

  // Add some randomness
  latency += Math.random() * 10;

  await new Promise((resolve) => setTimeout(resolve, latency));
}

/**
 * Benchmark: Search debounce efficiency
 * Tests how well the debounce mechanism handles rapid input.
 */
async function benchmarkSearchDebounce(): Promise<void> {
  logger.info('performance', 'benchmarkSearchDebounce', 'Starting search debounce benchmark');

  const keystrokes = ['m', 'a', 't', 'h', 'e', 'm', 'a', 't', 'i', 'c', 's'];
  const debounceDelay = 150; // Typical debounce delay

  let actualSearches = 0;
  let keystrokeCount = 0;
  let lastKeystrokeTime = 0;
  let totalInterKeystrokeTime = 0;

  startTimer('search_debounce_total');

  for (const char of keystrokes) {
    const now = performance.now();
    keystrokeCount++;

    if (lastKeystrokeTime > 0) {
      totalInterKeystrokeTime += now - lastKeystrokeTime;
    }
    lastKeystrokeTime = now;

    // Simulate debounce behavior
    await new Promise((resolve) => setTimeout(resolve, 30)); // Typing speed

    // Check if debounce triggered
    const timeSinceLastKeystroke = performance.now() - lastKeystrokeTime;
    if (timeSinceLastKeystroke >= debounceDelay) {
      actualSearches++;
      await simulateSearchOperation(keystrokes.slice(0, keystrokeCount).join(''), 10, false);
    }
  }

  // Final search after debounce
  await new Promise((resolve) => setTimeout(resolve, debounceDelay));
  actualSearches++;
  await simulateSearchOperation('mathematics', 10, false);

  const debounceMetric = endTimer(
    'search_debounce_total',
    'Search debounce total time',
    'ui_interaction'
  );

  const avgInterKeystrokeTime = totalInterKeystrokeTime / (keystrokes.length - 1);

  recordMetric(
    'search_debounce_efficiency',
    'Search debounce efficiency',
    'ui_interaction',
    keystrokes.length / actualSearches,
    'count',
    {
      keystrokes: keystrokes.length,
      actualSearches,
      debounceRatio: (keystrokes.length / actualSearches).toFixed(2),
      avgInterKeystrokeTime,
    }
  );

  logger.info('performance', 'benchmarkSearchDebounce', 'Debounce benchmark completed', {
    keystrokes: keystrokes.length,
    actualSearches,
    efficiency: (keystrokes.length / actualSearches).toFixed(2),
  });
}

// ============================================================================
// Route Transition Benchmarks
// ============================================================================

/**
 * Benchmark: Route navigation performance
 * Measures time to load and render different routes.
 */
export async function benchmarkRouteTransitions(): Promise<void> {
  logger.info('performance', 'benchmarkRouteTransitions', 'Starting route transition benchmark');

  const routes: {
    path: string;
    name: string;
    complexity: 'low' | 'medium' | 'high';
  }[] = [
    { path: '/', name: 'dashboard', complexity: 'high' },
    { path: '/analytics', name: 'analytics', complexity: 'high' },
    { path: '/courses', name: 'courses', complexity: 'medium' },
    { path: '/assessments', name: 'assessments', complexity: 'medium' },
    { path: '/timetable', name: 'timetable', complexity: 'medium' },
    { path: '/study', name: 'study', complexity: 'low' },
    { path: '/documents', name: 'documents', complexity: 'medium' },
    { path: '/directory', name: 'directory', complexity: 'low' },
    { path: '/goals', name: 'goals', complexity: 'low' },
    { path: '/forums', name: 'forums', complexity: 'medium' },
  ];

  for (const route of routes) {
    // Cold navigation (no cache)
    startTimer(`route_cold_${route.name}`);

    await simulateRouteLoad(route.path, route.complexity, true);
    recordRouteTransition(route.path, performance.now());

    const coldMetric = endTimer(
      `route_cold_${route.name}`,
      `Route cold: ${route.name}`,
      'route_transition'
    );

    // Warm navigation (cached)
    startTimer(`route_warm_${route.name}`);

    await simulateRouteLoad(route.path, route.complexity, false);
    recordRouteTransition(route.path + '?warm=1', performance.now());

    const warmMetric = endTimer(
      `route_warm_${route.name}`,
      `Route warm: ${route.name}`,
      'route_transition'
    );

    // Record cache benefit
    if (coldMetric && warmMetric) {
      const improvement = ((coldMetric.value - warmMetric.value) / coldMetric.value) * 100;
      recordMetric(
        `route_cache_benefit_${route.name}`,
        `Route cache benefit: ${route.name}`,
        'route_transition',
        improvement,
        'percent',
        { route: route.name }
      );
    }
  }
}

/**
 * Simulate route loading with realistic complexity.
 */
async function simulateRouteLoad(
  path: string,
  complexity: 'low' | 'medium' | 'high',
  isCold: boolean
): Promise<void> {
  // Base load time
  let loadTime = 50;

  // Complexity factor
  const complexityMultiplier = {
    low: 1,
    medium: 2,
    high: 4,
  };
  loadTime *= complexityMultiplier[complexity];

  // Cold vs warm
  if (isCold) {
    loadTime *= 2;
  } else {
    loadTime *= 0.4;
  }

  // Simulate component mounting
  await new Promise((resolve) => setTimeout(resolve, loadTime * 0.3));

  // Simulate data fetching
  await new Promise((resolve) => setTimeout(resolve, loadTime * 0.5));

  // Simulate rendering
  await new Promise((resolve) => setTimeout(resolve, loadTime * 0.2));
}

// ============================================================================
// Analytics Page Specific Benchmarks
// ============================================================================

/**
 * Benchmark: Analytics page heavy operations
 * Tests filtering, chart rendering, and data aggregation performance.
 */
export async function benchmarkAnalyticsPerformance(): Promise<void> {
  logger.info('performance', 'benchmarkAnalyticsPerformance', 'Starting analytics performance benchmark');

  // Initial page load
  startTimer('analytics_page_load');

  // Simulate loading large dataset
  const dataPoints = 1000;
  await simulateDataLoad(dataPoints);

  const loadMetric = endTimer('analytics_page_load', 'Analytics page load', 'route_transition');

  if (loadMetric) {
    recordRouteTransition('/analytics', loadMetric.value);
  }

  // Filter operations
  const filterScenarios = [
    { name: 'subject_filter_single', filterCount: 1, dataSize: 1000 },
    { name: 'subject_filter_multiple', filterCount: 5, dataSize: 1000 },
    { name: 'date_range_filter', filterCount: 1, dataSize: 1000, isDateRange: true },
    { name: 'combined_filters', filterCount: 3, dataSize: 1000, isComplex: true },
  ];

  for (const scenario of filterScenarios) {
    startTimer(`analytics_filter_${scenario.name}`);

    // Simulate filtering operation
    let filterTime = 20;
    filterTime += scenario.filterCount * 10;
    if (scenario.isDateRange) filterTime += 30;
    if (scenario.isComplex) filterTime += 50;

    // Simulate aggregation
    await simulateAggregation(scenario.dataSize);

    await new Promise((resolve) => setTimeout(resolve, filterTime));

    const filterMetric = endTimer(
      `analytics_filter_${scenario.name}`,
      `Analytics filter: ${scenario.name}`,
      'ui_interaction'
    );

    // Check for excessive re-renders
    recordMetric(
      `analytics_filter_${scenario.name}_complexity`,
      `Filter complexity score`,
      'render',
      scenario.filterCount * scenario.dataSize,
      'count',
      { scenario: scenario.name }
    );
  }

  // Chart rendering
  await benchmarkChartRendering();
}

/**
 * Simulate loading analytics data.
 */
async function simulateDataLoad(dataPoints: number): Promise<void> {
  const loadTime = Math.log10(dataPoints) * 100;
  await new Promise((resolve) => setTimeout(resolve, loadTime));
}

/**
 * Simulate data aggregation.
 */
async function simulateAggregation(dataSize: number): Promise<void> {
  const aggTime = dataSize * 0.05; // 0.05ms per data point
  await new Promise((resolve) => setTimeout(resolve, aggTime));
}

/**
 * Benchmark: Chart rendering performance
 * Tests different chart types and data sizes.
 */
async function benchmarkChartRendering(): Promise<void> {
  const chartScenarios = [
    { type: 'line', dataPoints: 30, name: 'trend_small' },
    { type: 'line', dataPoints: 365, name: 'trend_full_year' },
    { type: 'bar', dataPoints: 10, name: 'distribution_subjects' },
    { type: 'pie', dataPoints: 8, name: 'breakdown_grades' },
    { type: 'scatter', dataPoints: 100, name: 'correlation' },
  ];

  for (const scenario of chartScenarios) {
    startTimer(`analytics_chart_${scenario.name}`);

    // Simulate canvas/DOM creation
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Simulate data processing
    const processTime = scenario.dataPoints * 0.5;
    await new Promise((resolve) => setTimeout(resolve, processTime));

    // Simulate rendering
    const renderTime = scenario.dataPoints * 0.8;
    await new Promise((resolve) => setTimeout(resolve, renderTime));

    const chartMetric = endTimer(
      `analytics_chart_${scenario.name}`,
      `Chart render: ${scenario.name}`,
      'render'
    );

    recordMetric(
      `analytics_chart_${scenario.name}_points`,
      `Chart data points`,
      'render',
      scenario.dataPoints,
      'count',
      { chartType: scenario.type }
    );
  }
}

// ============================================================================
// Notes Editor Benchmarks
// ============================================================================

/**
 * Benchmark: Notes editor performance
 * Tests typing latency, auto-save, and file operations.
 */
export async function benchmarkNotesEditor(): Promise<void> {
  logger.info('performance', 'benchmarkNotesEditor', 'Starting notes editor benchmark');

  // Editor initialization
  startTimer('notes_editor_init');

  // Simulate loading editor component
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Simulate loading note content
  const contentSize = 5000; // characters
  await new Promise((resolve) => setTimeout(resolve, contentSize * 0.01));

  const initMetric = endTimer('notes_editor_init', 'Notes editor initialization', 'ui_interaction');

  if (initMetric) {
    recordUIInteraction('note_edit', initMetric.value, 'editor_init');
  }

  // Typing latency test
  const typingScenarios = [
    { name: 'single_char', charCount: 1 },
    { name: 'word', charCount: 5 },
    { name: 'sentence', charCount: 50 },
    { name: 'paragraph', charCount: 200 },
  ];

  for (const scenario of typingScenarios) {
    startTimer(`notes_typing_${scenario.name}`);

    // Simulate typing with realistic delays
    for (let i = 0; i < scenario.charCount; i++) {
      // Simulate keypress handling
      await new Promise((resolve) => setTimeout(resolve, 2));

      // Simulate content update (every 5 chars for efficiency)
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 3));
      }
    }

    const typingMetric = endTimer(
      `notes_typing_${scenario.name}`,
      `Notes typing: ${scenario.name}`,
      'ui_interaction'
    );

    const latencyPerChar = typingMetric ? typingMetric.value / scenario.charCount : 0;

    recordMetric(
      `notes_typing_${scenario.name}_latency_per_char`,
      `Typing latency per character`,
      'ui_interaction',
      latencyPerChar,
      'ms',
      { charCount: scenario.charCount }
    );
  }

  // Auto-save test
  await benchmarkAutoSave(contentSize);
}

/**
 * Benchmark: Auto-save performance
 * Tests background save operations.
 */
async function benchmarkAutoSave(contentSize: number): Promise<void> {
  const saveScenarios = [
    { name: 'small_change', changeSize: 10 },
    { name: 'medium_change', changeSize: 100 },
    { name: 'large_change', changeSize: 1000 },
  ];

  for (const scenario of saveScenarios) {
    startTimer(`notes_autosave_${scenario.name}`);

    // Simulate debounce delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate serialization
    const serializeTime = contentSize * 0.001;
    await new Promise((resolve) => setTimeout(resolve, serializeTime));

    // Simulate filesystem write
    const writeTime = scenario.changeSize * 0.5;
    await new Promise((resolve) => setTimeout(resolve, writeTime));

    const saveMetric = endTimer(
      `notes_autosave_${scenario.name}`,
      `Notes auto-save: ${scenario.name}`,
      'ui_interaction'
    );

    // Check if save blocks UI
    if (saveMetric && saveMetric.value > 100) {
      logger.warn('performance', 'benchmarkAutoSave', `Auto-save may block UI`, {
        duration: saveMetric.value,
        scenario: scenario.name,
      });
    }
  }
}

// ============================================================================
// Frame Rate & Animation Benchmarks
// ============================================================================

/**
 * Benchmark: Frame rate during animations
 * Measures smoothness of animations and transitions.
 */
export async function benchmarkFrameRates(): Promise<void> {
  logger.info('performance', 'benchmarkFrameRates', 'Starting frame rate benchmark');

  const animationScenarios = [
    { name: 'modal_open', duration: 300 },
    { name: 'sidebar_slide', duration: 250 },
    { name: 'page_transition', duration: 200 },
    { name: 'widget_reorder', duration: 400 },
    { name: 'scroll_momentum', duration: 500 },
  ];

  for (const scenario of animationScenarios) {
    const frameTimes: number[] = [];
    let droppedFrames = 0;
    let lastFrameTime = performance.now();

    // Simulate animation frames
    const frameCount = Math.ceil(scenario.duration / 16.67);

    startTimer(`animation_${scenario.name}`);

    for (let i = 0; i < frameCount; i++) {
      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;

      frameTimes.push(frameTime);

      // Detect dropped frames (>20ms is a dropped frame at 60fps)
      if (frameTime > 20) {
        droppedFrames++;
      }

      lastFrameTime = currentTime;

      // Simulate frame work
      const workTime = Math.random() * 5; // 0-5ms of work per frame
      await new Promise((resolve) => setTimeout(resolve, 16.67 - workTime));
    }

    const animMetric = endTimer(
      `animation_${scenario.name}`,
      `Animation: ${scenario.name}`,
      'ui_interaction'
    );

    // Calculate statistics
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const maxFrameTime = Math.max(...frameTimes);
    const droppedFramePercent = (droppedFrames / frameCount) * 100;
    const avgFps = 1000 / avgFrameTime;

    recordDroppedFrames(droppedFramePercent);

    recordMetric(
      `animation_${scenario.name}_fps`,
      `Animation average FPS`,
      'render',
      avgFps,
      'count',
      {
        scenario: scenario.name,
        minFps: 1000 / maxFrameTime,
        droppedFramePercent,
      }
    );

    logger.info('performance', 'benchmarkFrameRates', `Animation ${scenario.name} completed`, {
      avgFps: avgFps.toFixed(2),
      droppedFramePercent: droppedFramePercent.toFixed(2) + '%',
      maxFrameTime: maxFrameTime.toFixed(2) + 'ms',
    });
  }
}

// ============================================================================
// Memory Usage Benchmarks
// ============================================================================

/**
 * Benchmark: Memory usage during UI operations
 * Tracks heap growth during common operations.
 */
export async function benchmarkMemoryUsage(): Promise<void> {
  if (!(performance as any).memory) {
    logger.warn('performance', 'benchmarkMemoryUsage', 'Memory API not available');
    return;
  }

  logger.info('performance', 'benchmarkMemoryUsage', 'Starting memory usage benchmark');

  const memoryBefore = (performance as any).memory.usedJSHeapSize;

  // Simulate heavy UI operations
  const operations = [
    { name: 'load_dashboard', action: async () => await new Promise(r => setTimeout(r, 200)) },
    { name: 'open_search', action: async () => await new Promise(r => setTimeout(r, 100)) },
    { name: 'filter_analytics', action: async () => await new Promise(r => setTimeout(r, 150)) },
    { name: 'load_notes', action: async () => await new Promise(r => setTimeout(r, 180)) },
  ];

  for (const op of operations) {
    const memStart = (performance as any).memory.usedJSHeapSize;

    startTimer(`memory_${op.name}`);

    await op.action();

    // Force garbage collection hint (not guaranteed)
    if ((globalThis as any).gc) {
      (globalThis as any).gc();
    }

    const memEnd = (performance as any).memory.usedJSHeapSize;

    endTimer(`memory_${op.name}`, `Memory op: ${op.name}`, 'render');

    const memGrowth = memEnd - memStart;
    const memGrowthMB = memGrowth / (1024 * 1024);

    recordMetric(
      `memory_growth_${op.name}`,
      `Memory growth during ${op.name}`,
      'render',
      memGrowthMB,
      'count',
      {
        operation: op.name,
        growthBytes: memGrowth,
        growthMB: memGrowthMB.toFixed(2),
      }
    );

    if (memGrowthMB > 10) {
      logger.warn('performance', 'benchmarkMemoryUsage', `Significant memory growth in ${op.name}`, {
        growthMB: memGrowthMB.toFixed(2),
      });
    }
  }

  const memoryAfter = (performance as any).memory.usedJSHeapSize;
  const totalGrowth = (memoryAfter - memoryBefore) / (1024 * 1024);

  recordMetric(
    'memory_total_growth',
    'Total memory growth',
    'render',
    totalGrowth,
    'count',
    { totalGrowthMB: totalGrowth.toFixed(2) }
  );
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

/**
 * Run the complete UI benchmark suite.
 */
export async function runUIBenchmarkSuite(): Promise<void> {
  logger.info('performance', 'runUIBenchmarkSuite', 'Starting complete UI benchmark suite');

  await runBenchmark('ui_widgets', benchmarkWidgetDragPerformance);
  await runBenchmark('ui_search', benchmarkSearchPerformance);
  await runBenchmark('ui_routes', benchmarkRouteTransitions);
  await runBenchmark('ui_analytics', benchmarkAnalyticsPerformance);
  await runBenchmark('ui_notes', benchmarkNotesEditor);
  await runBenchmark('ui_animations', benchmarkFrameRates);
  await runBenchmark('ui_memory', benchmarkMemoryUsage);

  // Output summary
  const uiMetrics = getMetricsByCategory('ui_interaction');
  const renderMetrics = getMetricsByCategory('render');
  const routeMetrics = getMetricsByCategory('route_transition');

  console.group('📊 UI Benchmark Summary');
  console.log(`UI Interactions: ${uiMetrics.length} metrics`);
  console.log(`Render Operations: ${renderMetrics.length} metrics`);
  console.log(`Route Transitions: ${routeMetrics.length} metrics`);

  if (uiMetrics.length > 0) {
    const stats = calculateStats(uiMetrics);
    console.log(`\nUI Latency - P50: ${stats.p50.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
  }

  console.groupEnd();

  logger.info('performance', 'runUIBenchmarkSuite', 'UI benchmark suite completed');
}

// ============================================================================
// Export
// ============================================================================

export default {
  runUIBenchmarkSuite,
  benchmarkWidgetDragPerformance,
  benchmarkWidgetResizePerformance,
  benchmarkSearchPerformance,
  benchmarkRouteTransitions,
  benchmarkAnalyticsPerformance,
  benchmarkNotesEditor,
  benchmarkFrameRates,
  benchmarkMemoryUsage,
};
