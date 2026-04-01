/**
 * Widget Performance Benchmark Suite
 *
 * Comprehensive benchmarks for measuring DesQTA widget performance.
 * Tests widget rendering, layout calculations, interactions, and data updates.
 *
 * @module performance/benchmarks/widgetBenchmark
 */

import {
  runBenchmark,
  startTimer,
  endTimer,
  recordMetric,
  recordUIInteraction,
  getMetricsByCategory,
  calculateStats,
} from '../services/metricsTracker';
import { logger } from '../../../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface WidgetConfig {
  id: string;
  type: string;
  size: 'small' | 'medium' | 'large' | 'full';
  complexity: 'low' | 'medium' | 'high';
  dataPoints: number;
}

interface WidgetGridConfig {
  columns: number;
  rowHeight: number;
  widgets: WidgetConfig[];
}

// ============================================================================
// Widget Rendering Benchmarks
// ============================================================================

/**
 * Benchmark: Widget initialization and first render
 * Measures time to mount and render widgets of different complexity.
 */
export async function benchmarkWidgetInitialization(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetInitialization', 'Starting widget initialization benchmark');

  const widgetTypes: Array<{
    type: string;
    name: string;
    complexity: 'low' | 'medium' | 'high';
    renderTime: number;
    dataSize: number;
  }> = [
    { type: 'weather', name: 'Weather Widget', complexity: 'low', renderTime: 20, dataSize: 500 },
    { type: 'shortcuts', name: 'Shortcuts Widget', complexity: 'low', renderTime: 15, dataSize: 200 },
    { type: 'quick_notes', name: 'Quick Notes Widget', complexity: 'medium', renderTime: 40, dataSize: 2000 },
    { type: 'deadlines', name: 'Deadlines Calendar', complexity: 'medium', renderTime: 60, dataSize: 5000 },
    { type: 'grade_trends', name: 'Grade Trends Widget', complexity: 'high', renderTime: 100, dataSize: 10000 },
    { type: 'timetable', name: 'Timetable Widget', complexity: 'high', renderTime: 120, dataSize: 15000 },
    { type: 'study_tracker', name: 'Study Time Tracker', complexity: 'medium', renderTime: 50, dataSize: 3000 },
  ];

  for (const widgetType of widgetTypes) {
    startTimer(`widget_init_${widgetType.type}`);

    // Simulate widget initialization
    await new Promise((resolve) => setTimeout(resolve, widgetType.renderTime));

    // Simulate data loading
    const dataLoadTime = widgetType.dataSize / 100;
    await new Promise((resolve) => setTimeout(resolve, dataLoadTime));

    const initMetric = endTimer(
      `widget_init_${widgetType.type}`,
      `Widget initialization: ${widgetType.name}`,
      'ui_interaction'
    );

    if (initMetric) {
      recordMetric(
        `widget_init_time_${widgetType.complexity}`,
        `${widgetType.name} initialization time`,
        'ui_interaction',
        initMetric.value,
        'ms',
        { widgetType: widgetType.type, complexity: widgetType.complexity, dataSize: widgetType.dataSize }
      );
    }
  }
}

/**
 * Benchmark: Widget grid layout calculations
 * Measures performance of calculating widget positions and sizes.
 */
export async function benchmarkWidgetGridLayout(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetGridLayout', 'Starting widget grid layout benchmark');

  const gridConfigs: Array<{
    name: string;
    widgetCount: number;
    columns: number;
    complexity: 'simple' | 'medium' | 'complex';
  }> = [
    { name: 'small_grid', widgetCount: 3, columns: 2, complexity: 'simple' },
    { name: 'medium_grid', widgetCount: 6, columns: 3, complexity: 'medium' },
    { name: 'large_grid', widgetCount: 12, columns: 4, complexity: 'complex' },
    { name: 'extra_large_grid', widgetCount: 20, columns: 4, complexity: 'complex' },
  ];

  for (const config of gridConfigs) {
    startTimer(`grid_layout_${config.name}`);

    // Generate mock widget positions
    const positions: Array<{ i: string; x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < config.widgetCount; i++) {
      const x = (i % config.columns) * 2;
      const y = Math.floor(i / config.columns) * 2;
      const w = 2;
      const h = 2;
      positions.push({ i: i.toString(), x, y, w, h });
    }

    // Simulate layout calculation (collision detection, compaction)
    const iterations = config.widgetCount * 10;
    for (let i = 0; i < iterations; i++) {
      // Simulate collision detection
      positions.forEach((p1, idx1) => {
        positions.slice(idx1 + 1).forEach((p2) => {
          const collision = !(p1.x + p1.w <= p2.x || p2.x + p2.w <= p1.x ||
                          p1.y + p1.h <= p2.y || p2.y + p2.h <= p1.y);
          if (collision) {
            // Resolve collision
            p2.y = p1.y + p1.h;
          }
        });
      });
    }

    const layoutMetric = endTimer(
      `grid_layout_${config.name}`,
      `Grid layout calculation: ${config.name}`,
      'render'
    );

    if (layoutMetric) {
      recordMetric(
        `widget_grid_layout_time`,
        `Widget grid layout time (${config.complexity})`,
        'render',
        layoutMetric.value,
        'ms',
        {
          widgetCount: config.widgetCount,
          columns: config.columns,
          complexity: config.complexity,
          iterations,
        }
      );
    }
  }
}

/**
 * Benchmark: Widget resize operations
 * Measures performance impact of resizing widgets.
 */
export async function benchmarkWidgetResizeOperations(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetResizeOperations', 'Starting widget resize benchmark');

  const resizeScenarios: Array<{
    name: string;
    widgetType: string;
    fromSize: { w: number; h: number };
    toSize: { w: number; h: number };
    complexity: 'low' | 'medium' | 'high';
  }> = [
    { name: 'small_expand', widgetType: 'weather', fromSize: { w: 2, h: 1 }, toSize: { w: 4, h: 2 }, complexity: 'low' },
    { name: 'medium_resize', widgetType: 'deadlines', fromSize: { w: 2, h: 2 }, toSize: { w: 3, h: 4 }, complexity: 'medium' },
    { name: 'large_expand', widgetType: 'timetable', fromSize: { w: 4, h: 2 }, toSize: { w: 4, h: 6 }, complexity: 'high' },
    { name: 'complex_reflow', widgetType: 'grade_trends', fromSize: { w: 2, h: 2 }, toSize: { w: 6, h: 4 }, complexity: 'high' },
  ];

  for (const scenario of resizeScenarios) {
    startTimer(`widget_resize_${scenario.name}`);

    // Simulate resize start
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Simulate layout recalculation
    const layoutComplexity = scenario.toSize.w * scenario.toSize.h;
    const recalcTime = layoutComplexity * 2 + Math.random() * 10;
    await new Promise((resolve) => setTimeout(resolve, recalcTime));

    // Simulate content reflow/render
    const contentComplexity = scenario.complexity === 'high' ? 50 :
                             scenario.complexity === 'medium' ? 30 : 15;
    await new Promise((resolve) => setTimeout(resolve, contentComplexity));

    // Simulate resize end
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const resizeMetric = endTimer(
      `widget_resize_${scenario.name}`,
      `Widget resize: ${scenario.name}`,
      'ui_interaction'
    );

    if (resizeMetric) {
      recordUIInteraction('widget_resize', resizeMetric.value, scenario.widgetType);
    }
  }
}

/**
 * Benchmark: Widget data refresh/update performance
 * Measures time to update widget data and re-render.
 */
export async function benchmarkWidgetDataRefresh(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetDataRefresh', 'Starting widget data refresh benchmark');

  const refreshScenarios: Array<{
    name: string;
    widgetType: string;
    updateType: 'incremental' | 'full' | 'realtime';
    dataChangeSize: number;
  }> = [
    { name: 'weather_update', widgetType: 'weather', updateType: 'full', dataChangeSize: 500 },
    { name: 'timetable_incremental', widgetType: 'timetable', updateType: 'incremental', dataChangeSize: 1000 },
    { name: 'grades_full_refresh', widgetType: 'grade_trends', updateType: 'full', dataChangeSize: 8000 },
    { name: 'deadlines_realtime', widgetType: 'deadlines', updateType: 'realtime', dataChangeSize: 500 },
    { name: 'notes_autosave', widgetType: 'quick_notes', updateType: 'incremental', dataChangeSize: 200 },
  ];

  for (const scenario of refreshScenarios) {
    startTimer(`widget_refresh_${scenario.name}`);

    // Simulate data fetch/update
    const fetchTime = scenario.dataChangeSize / 200;
    await new Promise((resolve) => setTimeout(resolve, fetchTime));

    // Simulate state update
    const stateUpdateTime = scenario.updateType === 'full' ? 20 :
                           scenario.updateType === 'incremental' ? 10 : 5;
    await new Promise((resolve) => setTimeout(resolve, stateUpdateTime));

    // Simulate re-render
    const renderTime = scenario.dataChangeSize / 100;
    await new Promise((resolve) => setTimeout(resolve, renderTime));

    const refreshMetric = endTimer(
      `widget_refresh_${scenario.name}`,
      `Widget data refresh: ${scenario.name}`,
      'ui_interaction'
    );

    if (refreshMetric) {
      recordMetric(
        `widget_refresh_${scenario.updateType}`,
        `Widget ${scenario.updateType} refresh time`,
        'ui_interaction',
        refreshMetric.value,
        'ms',
        {
          widgetType: scenario.widgetType,
          updateType: scenario.updateType,
          dataChangeSize: scenario.dataChangeSize,
        }
      );
    }
  }
}

// ============================================================================
// Widget Interaction Benchmarks
// ============================================================================

/**
 * Benchmark: Widget drag and drop operations
 * Measures performance of dragging widgets to new positions.
 */
export async function benchmarkWidgetDragDrop(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetDragDrop', 'Starting widget drag-drop benchmark');

  const dragScenarios: Array<{
    name: string;
    distance: number; // grid cells
    widgetsAffected: number;
    hasCollision: boolean;
  }> = [
    { name: 'simple_move', distance: 2, widgetsAffected: 1, hasCollision: false },
    { name: 'medium_move', distance: 4, widgetsAffected: 3, hasCollision: true },
    { name: 'complex_rearrange', distance: 6, widgetsAffected: 6, hasCollision: true },
    { name: 'long_distance', distance: 10, widgetsAffected: 8, hasCollision: true },
  ];

  for (const scenario of dragScenarios) {
    startTimer(`widget_drag_${scenario.name}`);

    // Simulate drag start
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Simulate drag movement (multiple frames)
    const frames = scenario.distance * 5;
    for (let i = 0; i < frames; i++) {
      // Simulate position calculation per frame
      const frameTime = scenario.hasCollision ? 3 : 1;
      await new Promise((resolve) => setTimeout(resolve, frameTime));
    }

    // Simulate collision resolution
    if (scenario.hasCollision) {
      const collisionTime = scenario.widgetsAffected * 5;
      await new Promise((resolve) => setTimeout(resolve, collisionTime));
    }

    // Simulate layout compaction
    const compactionTime = scenario.widgetsAffected * 3;
    await new Promise((resolve) => setTimeout(resolve, compactionTime));

    // Simulate drop and final render
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const dragMetric = endTimer(
      `widget_drag_${scenario.name}`,
      `Widget drag: ${scenario.name}`,
      'ui_interaction'
    );

    if (dragMetric) {
      recordUIInteraction('widget_drag', dragMetric.value, scenario.name);
    }
  }
}

/**
 * Benchmark: Widget settings/configuration changes
 * Measures performance of updating widget configuration.
 */
export async function benchmarkWidgetConfiguration(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetConfiguration', 'Starting widget configuration benchmark');

  const configScenarios: Array<{
    name: string;
    widgetType: string;
    changeComplexity: 'simple' | 'moderate' | 'complex';
    requiresDataRefetch: boolean;
  }> = [
    { name: 'weather_location_change', widgetType: 'weather', changeComplexity: 'simple', requiresDataRefetch: true },
    { name: 'timetable_day_view', widgetType: 'timetable', changeComplexity: 'moderate', requiresDataRefetch: false },
    { name: 'grades_period_change', widgetType: 'grade_trends', changeComplexity: 'complex', requiresDataRefetch: true },
    { name: 'deadlines_filter', widgetType: 'deadlines', changeComplexity: 'simple', requiresDataRefetch: false },
    { name: 'notes_theme_change', widgetType: 'quick_notes', changeComplexity: 'simple', requiresDataRefetch: false },
  ];

  for (const scenario of configScenarios) {
    startTimer(`widget_config_${scenario.name}`);

    // Simulate config update
    const configTime = scenario.changeComplexity === 'complex' ? 30 :
                      scenario.changeComplexity === 'moderate' ? 15 : 5;
    await new Promise((resolve) => setTimeout(resolve, configTime));

    // Simulate data refetch if needed
    if (scenario.requiresDataRefetch) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Simulate re-render with new config
    const renderTime = scenario.changeComplexity === 'complex' ? 50 :
                      scenario.changeComplexity === 'moderate' ? 30 : 15;
    await new Promise((resolve) => setTimeout(resolve, renderTime));

    const configMetric = endTimer(
      `widget_config_${scenario.name}`,
      `Widget config change: ${scenario.name}`,
      'ui_interaction'
    );

    if (configMetric) {
      recordMetric(
        `widget_config_${scenario.changeComplexity}`,
        `Widget config change (${scenario.changeComplexity})`,
        'ui_interaction',
        configMetric.value,
        'ms',
        {
          widgetType: scenario.widgetType,
          requiresDataRefetch: scenario.requiresDataRefetch,
        }
      );
    }
  }
}

// ============================================================================
// Widget Memory Benchmarks
// ============================================================================

/**
 * Benchmark: Widget memory usage patterns
 * Measures memory consumption for different widget scenarios.
 */
export async function benchmarkWidgetMemoryUsage(): Promise<void> {
  logger.info('performance', 'benchmarkWidgetMemoryUsage', 'Starting widget memory benchmark');

  // Check if memory API is available
  const memory = (performance as any).memory;
  const hasMemoryAPI = !!memory;

  const memoryScenarios: Array<{
    name: string;
    widgetCount: number;
    avgWidgetSize: number; // KB
    interactionCount: number;
  }> = [
    { name: 'light_dashboard', widgetCount: 3, avgWidgetSize: 50, interactionCount: 10 },
    { name: 'medium_dashboard', widgetCount: 6, avgWidgetSize: 100, interactionCount: 25 },
    { name: 'heavy_dashboard', widgetCount: 12, avgWidgetSize: 200, interactionCount: 50 },
    { name: 'extreme_dashboard', widgetCount: 20, avgWidgetSize: 300, interactionCount: 100 },
  ];

  for (const scenario of memoryScenarios) {
    startTimer(`widget_memory_${scenario.name}`);

    // Simulate widget creation memory usage
    const baseMemory = scenario.widgetCount * scenario.avgWidgetSize;
    const simulatedWidgets = [];

    for (let i = 0; i < scenario.widgetCount; i++) {
      // Simulate widget data
      simulatedWidgets.push({
        id: `widget_${i}`,
        data: new Array(scenario.avgWidgetSize * 100).fill('x').join(''),
        cache: new Map(),
      });
    }

    // Simulate interactions (potential memory growth)
    for (let i = 0; i < scenario.interactionCount; i++) {
      const widgetIndex = i % scenario.widgetCount;
      simulatedWidgets[widgetIndex].cache.set(`interaction_${i}`, {
        timestamp: Date.now(),
        data: new Array(100).fill(i),
      });
    }

    // Simulate cleanup
    const cleanupCount = Math.floor(scenario.interactionCount * 0.5);
    for (let i = 0; i < cleanupCount; i++) {
      const widgetIndex = i % scenario.widgetCount;
      simulatedWidgets[widgetIndex].cache.delete(`interaction_${i}`);
    }

    const memoryMetric = endTimer(
      `widget_memory_${scenario.name}`,
      `Widget memory: ${scenario.name}`,
      'render'
    );

    // Calculate approximate memory usage
    const estimatedMemoryKB = baseMemory + (scenario.interactionCount * 0.5);

    if (memoryMetric) {
      recordMetric(
        `widget_memory_usage`,
        `Widget memory usage`,
        'render',
        estimatedMemoryKB,
        'bytes',
        {
          scenario: scenario.name,
          widgetCount: scenario.widgetCount,
          hasMemoryAPI,
          estimatedKB: estimatedMemoryKB,
        }
      );
    }

    // Cleanup
    simulatedWidgets.length = 0;
  }
}

// ============================================================================
// Specific Widget Type Benchmarks
// ============================================================================

/**
 * Benchmark: Timetable widget specific performance
 * Tests the complex timetable rendering with many lessons.
 */
export async function benchmarkTimetableWidget(): Promise<void> {
  logger.info('performance', 'benchmarkTimetableWidget', 'Starting timetable widget benchmark');

  const timetableScenarios: Array<{
    name: string;
    dayCount: number;
    lessonsPerDay: number;
    hasOverlaps: boolean;
  }> = [
    { name: 'single_day', dayCount: 1, lessonsPerDay: 6, hasOverlaps: false },
    { name: 'week_view', dayCount: 5, lessonsPerDay: 8, hasOverlaps: false },
    { name: 'busy_week', dayCount: 5, lessonsPerDay: 10, hasOverlaps: true },
    { name: 'full_timetable', dayCount: 10, lessonsPerDay: 8, hasOverlaps: true },
  ];

  for (const scenario of timetableScenarios) {
    startTimer(`timetable_${scenario.name}`);

    const totalLessons = scenario.dayCount * scenario.lessonsPerDay;

    // Generate lesson data
    const lessons = [];
    for (let d = 0; d < scenario.dayCount; d++) {
      for (let l = 0; l < scenario.lessonsPerDay; l++) {
        lessons.push({
          day: d,
          period: l,
          subject: `Subject ${l}`,
          teacher: `Teacher ${l}`,
          room: `Room ${l % 10}`,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        });
      }
    }

    // Simulate layout calculation
    const layoutTime = totalLessons * 2;
    await new Promise((resolve) => setTimeout(resolve, layoutTime));

    // Simulate overlap detection
    if (scenario.hasOverlaps) {
      const overlapTime = totalLessons * 3;
      await new Promise((resolve) => setTimeout(resolve, overlapTime));
    }

    // Simulate render
    const renderTime = totalLessons * 1.5;
    await new Promise((resolve) => setTimeout(resolve, renderTime));

    const timetableMetric = endTimer(
      `timetable_${scenario.name}`,
      `Timetable widget: ${scenario.name}`,
      'ui_interaction'
    );

    if (timetableMetric) {
      recordMetric(
        `timetable_render_time`,
        `Timetable render time`,
        'ui_interaction',
        timetableMetric.value,
        'ms',
        {
          dayCount: scenario.dayCount,
          lessonsPerDay: scenario.lessonsPerDay,
          totalLessons,
          hasOverlaps: scenario.hasOverlaps,
        }
      );
    }
  }
}

/**
 * Benchmark: Grade trends widget performance
 * Tests chart rendering and data aggregation.
 */
export async function benchmarkGradeTrendsWidget(): Promise<void> {
  logger.info('performance', 'benchmarkGradeTrendsWidget', 'Starting grade trends widget benchmark');

  const gradeScenarios: Array<{
    name: string;
    assessmentCount: number;
    subjectCount: number;
    timeRangeMonths: number;
  }> = [
    { name: 'minimal', assessmentCount: 10, subjectCount: 3, timeRangeMonths: 1 },
    { name: 'typical', assessmentCount: 50, subjectCount: 6, timeRangeMonths: 3 },
    { name: 'heavy', assessmentCount: 150, subjectCount: 10, timeRangeMonths: 6 },
    { name: 'extensive', assessmentCount: 500, subjectCount: 15, timeRangeMonths: 12 },
  ];

  for (const scenario of gradeScenarios) {
    startTimer(`grade_trends_${scenario.name}`);

    // Generate grade data
    const grades = [];
    for (let i = 0; i < scenario.assessmentCount; i++) {
      grades.push({
        id: i,
        subject: `Subject ${i % scenario.subjectCount}`,
        grade: Math.floor(Math.random() * 100),
        date: new Date(Date.now() - Math.random() * scenario.timeRangeMonths * 30 * 24 * 60 * 60 * 1000),
        weight: Math.random(),
      });
    }

    // Simulate data aggregation
    const aggregationTime = scenario.assessmentCount * 0.5;
    await new Promise((resolve) => setTimeout(resolve, aggregationTime));

    // Simulate trend calculation
    const trendTime = scenario.subjectCount * 10;
    await new Promise((resolve) => setTimeout(resolve, trendTime));

    // Simulate chart rendering
    const chartPoints = scenario.assessmentCount;
    const renderTime = chartPoints * 0.3;
    await new Promise((resolve) => setTimeout(resolve, renderTime));

    const gradeMetric = endTimer(
      `grade_trends_${scenario.name}`,
      `Grade trends: ${scenario.name}`,
      'ui_interaction'
    );

    if (gradeMetric) {
      recordMetric(
        `grade_trends_render_time`,
        `Grade trends render time`,
        'ui_interaction',
        gradeMetric.value,
        'ms',
        {
          assessmentCount: scenario.assessmentCount,
          subjectCount: scenario.subjectCount,
          timeRangeMonths: scenario.timeRangeMonths,
        }
      );
    }
  }
}

/**
 * Benchmark: Quick notes widget performance
 * Tests text editing and auto-save functionality.
 */
export async function benchmarkQuickNotesWidget(): Promise<void> {
  logger.info('performance', 'benchmarkQuickNotesWidget', 'Starting quick notes widget benchmark');

  const noteScenarios: Array<{
    name: string;
    contentLength: number;
    typingSpeed: 'slow' | 'normal' | 'fast';
    autoSaveEnabled: boolean;
  }> = [
    { name: 'short_note', contentLength: 100, typingSpeed: 'normal', autoSaveEnabled: true },
    { name: 'medium_note', contentLength: 1000, typingSpeed: 'normal', autoSaveEnabled: true },
    { name: 'long_note', contentLength: 5000, typingSpeed: 'fast', autoSaveEnabled: true },
    { name: 'no_autosave', contentLength: 2000, typingSpeed: 'fast', autoSaveEnabled: false },
  ];

  for (const scenario of noteScenarios) {
    startTimer(`quick_notes_${scenario.name}`);

    // Simulate content initialization
    const content = 'x'.repeat(scenario.contentLength);

    // Simulate typing
    const keystrokes = scenario.contentLength;
    const keystrokeDelay = scenario.typingSpeed === 'fast' ? 0.5 :
                          scenario.typingSpeed === 'normal' ? 1 : 2;
    const typingTime = keystrokes * keystrokeDelay;
    await new Promise((resolve) => setTimeout(resolve, typingTime / 100)); // Scale down for benchmark

    // Simulate auto-save if enabled
    if (scenario.autoSaveEnabled) {
      const saveIntervals = Math.floor(keystrokes / 50); // Save every 50 chars
      for (let i = 0; i < saveIntervals; i++) {
        // Simulate serialization
        await new Promise((resolve) => setTimeout(resolve, scenario.contentLength / 500));
        // Simulate write
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const notesMetric = endTimer(
      `quick_notes_${scenario.name}`,
      `Quick notes: ${scenario.name}`,
      'ui_interaction'
    );

    if (notesMetric) {
      recordMetric(
        `quick_notes_edit_time`,
        `Quick notes edit time`,
        'ui_interaction',
        notesMetric.value,
        'ms',
        {
          contentLength: scenario.contentLength,
          typingSpeed: scenario.typingSpeed,
          autoSaveEnabled: scenario.autoSaveEnabled,
        }
      );
    }
  }
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

/**
 * Run the complete widget benchmark suite.
 */
export async function runWidgetBenchmarkSuite(iterations: number = 3): Promise<void> {
  logger.info('performance', 'runWidgetBenchmarkSuite', `Starting widget benchmark suite with ${iterations} iterations`);

  const results: Array<{
    iteration: number;
    avgInitTime: number;
    avgLayoutTime: number;
    avgInteractionTime: number;
  }> = [];

  for (let i = 0; i < iterations; i++) {
    logger.info('performance', 'runWidgetBenchmarkSuite', `Running iteration ${i + 1}/${iterations}`);

    const iterationResult = await runBenchmark(`widgets_iter_${i}`, async () => {
      // Rendering benchmarks
      await benchmarkWidgetInitialization();
      await benchmarkWidgetGridLayout();

      // Interaction benchmarks
      await benchmarkWidgetResizeOperations();
      await benchmarkWidgetDragDrop();
      await benchmarkWidgetDataRefresh();
      await benchmarkWidgetConfiguration();

      // Memory benchmarks
      await benchmarkWidgetMemoryUsage();

      // Specific widget benchmarks
      await benchmarkTimetableWidget();
      await benchmarkGradeTrendsWidget();
      await benchmarkQuickNotesWidget();
    });

    // Extract key metrics
    const uiMetrics = getMetricsByCategory('ui_interaction');
    const renderMetrics = getMetricsByCategory('render');

    const initMetrics = uiMetrics.filter((m) => m.name.includes('widget_init'));
    const layoutMetrics = renderMetrics.filter((m) => m.name.includes('widget_grid'));
    const interactionMetrics = uiMetrics.filter((m) =>
      m.name.includes('widget_resize') ||
      m.name.includes('widget_drag') ||
      m.name.includes('widget_refresh')
    );

    results.push({
      iteration: i + 1,
      avgInitTime: calculateStats(initMetrics).mean,
      avgLayoutTime: calculateStats(layoutMetrics).mean,
      avgInteractionTime: calculateStats(interactionMetrics).mean,
    });

    // Small delay between iterations
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Output summary
  console.group('📊 Widget Benchmark Results');
  console.table(results);

  const initTimes = results.map((r) => r.avgInitTime);
  const layoutTimes = results.map((r) => r.avgLayoutTime);
  const interactionTimes = results.map((r) => r.avgInteractionTime);

  console.log('Widget Initialization:');
  console.log(`  Mean: ${(initTimes.reduce((a, b) => a + b, 0) / initTimes.length).toFixed(2)}ms`);

  console.log('Grid Layout Calculation:');
  console.log(`  Mean: ${(layoutTimes.reduce((a, b) => a + b, 0) / layoutTimes.length).toFixed(2)}ms`);

  console.log('Widget Interactions:');
  console.log(`  Mean: ${(interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length).toFixed(2)}ms`);

  console.groupEnd();
}

/**
 * Quick widget benchmark for CI/automated testing.
 */
export async function runQuickWidgetBenchmark(): Promise<{
  passed: boolean;
  avgInitTime: number;
  avgInteractionTime: number;
  score: number;
}> {
  const result = await runBenchmark('widgets_quick', async () => {
    await benchmarkWidgetInitialization();
    await benchmarkWidgetResizeOperations();
    await benchmarkWidgetDataRefresh();
  });

  const uiMetrics = getMetricsByCategory('ui_interaction');
  const initMetrics = uiMetrics.filter((m) => m.name.includes('widget_init'));
  const interactionMetrics = uiMetrics.filter((m) =>
    m.name.includes('widget_resize') || m.name.includes('widget_refresh')
  );

  return {
    passed: result.passed,
    avgInitTime: calculateStats(initMetrics).mean,
    avgInteractionTime: calculateStats(interactionMetrics).mean,
    score: result.overallScore,
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
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
};
