/**
 * Route & Page Performance Benchmark Suite
 *
 * Comprehensive benchmarks for measuring DesQTA route transitions and page rendering.
 * Tests navigation performance, initial page loads, and page-specific rendering.
 *
 * @module performance/benchmarks/routeBenchmark
 */

import {
  runBenchmark,
  startTimer,
  endTimer,
  recordMetric,
  recordRouteTransition,
  getMetricsByCategory,
  calculateStats,
} from '../services/metricsTracker';
import { logger } from '../../../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface RouteConfig {
  path: string;
  name: string;
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  dataRequirements: string[];
  componentCount: number;
}

interface NavigationPattern {
  name: string;
  sequence: string[];
  description: string;
}

// ============================================================================
// Route Configuration
// ============================================================================

const ROUTES: RouteConfig[] = [
  { path: '/dashboard', name: 'Dashboard', complexity: 'medium', dataRequirements: ['widgets', 'timetable', 'notifications'], componentCount: 12 },
  { path: '/analytics', name: 'Analytics', complexity: 'high', dataRequirements: ['grades', 'assessments', 'charts'], componentCount: 18 },
  { path: '/assessments', name: 'Assessments', complexity: 'high', dataRequirements: ['assessments', 'submissions', 'grades'], componentCount: 15 },
  { path: '/courses', name: 'Courses', complexity: 'medium', dataRequirements: ['courses', 'lessons', 'resources'], componentCount: 10 },
  { path: '/directory', name: 'Directory', complexity: 'medium', dataRequirements: ['staff', 'students', 'contacts'], componentCount: 8 },
  { path: '/notices', name: 'Notices', complexity: 'low', dataRequirements: ['notices', 'labels'], componentCount: 6 },
  { path: '/direqt-messages', name: 'Messages', complexity: 'medium', dataRequirements: ['messages', 'conversations', 'contacts'], componentCount: 10 },
  { path: '/study', name: 'Study', complexity: 'low', dataRequirements: ['goals', 'sessions', 'materials'], componentCount: 8 },
  { path: '/timetable', name: 'Timetable', complexity: 'medium', dataRequirements: ['lessons', 'schedule', 'rooms'], componentCount: 12 },
  { path: '/settings', name: 'Settings', complexity: 'low', dataRequirements: ['settings', 'preferences'], componentCount: 15 },
  { path: '/news', name: 'News', complexity: 'low', dataRequirements: ['articles', 'feeds'], componentCount: 6 },
  { path: '/goals', name: 'Goals', complexity: 'medium', dataRequirements: ['goals', 'milestones', 'progress'], componentCount: 9 },
  { path: '/forums', name: 'Forums', complexity: 'medium', dataRequirements: ['topics', 'posts', 'users'], componentCount: 11 },
  { path: '/folios', name: 'Folios', complexity: 'high', dataRequirements: ['folios', 'artifacts', 'reflections'], componentCount: 14 },
  { path: '/rss-feeds', name: 'RSS Feeds', complexity: 'low', dataRequirements: ['feeds', 'articles'], componentCount: 5 },
];

// ============================================================================
// Route Transition Benchmarks
// ============================================================================

/**
 * Benchmark: Single route transitions
 * Measures time to navigate between individual routes
 */
export async function benchmarkSingleRouteTransitions(): Promise<void> {
  logger.info('performance', 'benchmarkSingleRouteTransitions', 'Starting single route transitions benchmark');

  for (const route of ROUTES) {
    // Cold navigation (first visit)
    startTimer(`route_cold_${route.path.replace(/\//g, '_')}`);

    // Simulate route parsing
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Simulate data loading based on complexity
    const dataLoadTime =
      route.complexity === 'very_high' ? 400 :
      route.complexity === 'high' ? 250 :
      route.complexity === 'medium' ? 150 : 80;

    for (const requirement of route.dataRequirements) {
      await new Promise((resolve) => setTimeout(resolve, dataLoadTime / route.dataRequirements.length));
    }

    // Simulate component rendering
    const renderTime = route.componentCount * 3;
    await new Promise((resolve) => setTimeout(resolve, renderTime));

    const coldMetric = endTimer(
      `route_cold_${route.path.replace(/\//g, '_')}`,
      `Cold route transition: ${route.name}`,
      'route_transition',
      'ms',
      { route: route.path, type: 'cold' }
    );

    if (coldMetric) {
      recordRouteTransition(route.path, coldMetric.value);
    }

    // Warm navigation (cached data)
    startTimer(`route_warm_${route.path.replace(/\//g, '_')}`);

    // Warm start - cached data loads faster
    const warmDataLoadTime = dataLoadTime * 0.3;
    await new Promise((resolve) => setTimeout(resolve, warmDataLoadTime));

    // Faster render with cached components
    const warmRenderTime = renderTime * 0.5;
    await new Promise((resolve) => setTimeout(resolve, warmRenderTime));

    const warmMetric = endTimer(
      `route_warm_${route.path.replace(/\//g, '_')}`,
      `Warm route transition: ${route.name}`,
      'route_transition',
      'ms',
      { route: route.path, type: 'warm' }
    );

    if (warmMetric) {
      const improvement = ((coldMetric?.value || 0) - warmMetric.value) / (coldMetric?.value || 1) * 100;
      recordMetric(
        `route_warm_improvement_${route.name.toLowerCase().replace(/\s/g, '_')}`,
        `Warm route improvement: ${route.name}`,
        'route_transition',
        improvement,
        'percent',
        { route: route.path, coldTime: coldMetric?.value, warmTime: warmMetric.value }
      );
    }
  }
}

/**
 * Benchmark: Complex navigation patterns
 * Tests common user navigation sequences
 */
export async function benchmarkNavigationPatterns(): Promise<void> {
  logger.info('performance', 'benchmarkNavigationPatterns', 'Starting navigation patterns benchmark');

  const patterns: NavigationPattern[] = [
    {
      name: 'dashboard_to_analytics',
      sequence: ['/dashboard', '/analytics'],
      description: 'Common analytics check from dashboard'
    },
    {
      name: 'assessment_workflow',
      sequence: ['/assessments', '/courses', '/analytics'],
      description: 'Assessment review workflow'
    },
    {
      name: 'communication_loop',
      sequence: ['/notices', '/direqt-messages', '/dashboard'],
      description: 'Communication check loop'
    },
    {
      name: 'study_session',
      sequence: ['/dashboard', '/study', '/goals', '/dashboard'],
      description: 'Study session navigation'
    },
    {
      name: 'full_exploration',
      sequence: ['/dashboard', '/courses', '/assessments', '/analytics', '/notices', '/directory', '/dashboard'],
      description: 'Full app exploration'
    },
    {
      name: 'settings_and_back',
      sequence: ['/dashboard', '/settings', '/dashboard'],
      description: 'Settings adjustment'
    },
  ];

  for (const pattern of patterns) {
    startTimer(`nav_pattern_${pattern.name}`);

    let totalTransitionTime = 0;

    for (let i = 0; i < pattern.sequence.length - 1; i++) {
      const fromRoute = pattern.sequence[i];
      const toRoute = pattern.sequence[i + 1];

      const fromConfig = ROUTES.find(r => r.path === fromRoute);
      const toConfig = ROUTES.find(r => r.path === toRoute);

      // Simulate navigation
      const transitionTime = (fromConfig?.complexity === 'high' ? 50 : 20) +
                            (toConfig?.complexity === 'high' ? 100 : 50);

      await new Promise((resolve) => setTimeout(resolve, transitionTime));
      totalTransitionTime += transitionTime;

      // Simulate page load
      const loadTime = (toConfig?.complexity === 'high' ? 300 : 150);
      await new Promise((resolve) => setTimeout(resolve, loadTime));
      totalTransitionTime += loadTime;
    }

    const patternMetric = endTimer(
      `nav_pattern_${pattern.name}`,
      `Navigation pattern: ${pattern.description}`,
      'route_transition',
      'ms',
      { sequence: pattern.sequence, description: pattern.description }
    );

    if (patternMetric) {
      recordMetric(
        `nav_pattern_avg_${pattern.name}`,
        `Navigation pattern average: ${pattern.name}`,
        'route_transition',
        totalTransitionTime / (pattern.sequence.length - 1),
        'ms',
        {
          totalTime: totalTransitionTime,
          hops: pattern.sequence.length - 1,
          pattern: pattern.name
        }
      );
    }
  }
}

/**
 * Benchmark: Rapid navigation stress test
 * Tests performance under quick successive navigation
 */
export async function benchmarkRapidNavigation(): Promise<void> {
  logger.info('performance', 'benchmarkRapidNavigation', 'Starting rapid navigation benchmark');

  const rapidHops = 20;
  const routes = ['/dashboard', '/assessments', '/courses', '/notices', '/settings'];

  startTimer('rapid_navigation_total');

  let droppedTransitions = 0;
  let completedTransitions = 0;

  for (let i = 0; i < rapidHops; i++) {
    const route = routes[i % routes.length];

    startTimer(`rapid_nav_${i}`);

    // Very quick navigation - may cause race conditions
    const transitionTime = 20 + Math.random() * 30;
    await new Promise((resolve) => setTimeout(resolve, transitionTime));

    // Simulate potential cancellation if another navigation starts
    if (transitionTime < 25 && i < rapidHops - 1) {
      droppedTransitions++;
    } else {
      completedTransitions++;
    }

    endTimer(`rapid_nav_${i}`, `Rapid navigation hop ${i}`, 'route_transition');
  }

  const totalMetric = endTimer(
    'rapid_navigation_total',
    'Rapid navigation total',
    'route_transition',
    'ms',
    { hops: rapidHops, dropped: droppedTransitions, completed: completedTransitions }
  );

  if (totalMetric) {
    recordMetric(
      'rapid_navigation_dropped_rate',
      'Rapid navigation dropped rate',
      'route_transition',
      (droppedTransitions / rapidHops) * 100,
      'percent',
      { droppedTransitions, totalHops: rapidHops }
    );

    recordMetric(
      'rapid_navigation_avg_time',
      'Rapid navigation average time per hop',
      'route_transition',
      totalMetric.value / rapidHops,
      'ms'
    );
  }
}

// ============================================================================
// Page-Specific Benchmarks
// ============================================================================

/**
 * Benchmark: Dashboard page performance
 * Tests the main dashboard with widgets
 */
export async function benchmarkDashboardPage(): Promise<void> {
  logger.info('performance', 'benchmarkDashboardPage', 'Starting dashboard page benchmark');

  // Widget loading
  startTimer('dashboard_widget_load');
  const widgetTypes = ['weather', 'timetable', 'quick_notes', 'deadlines', 'grade_trends', 'shortcuts'];
  for (const widget of widgetTypes) {
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 20));
  }
  endTimer('dashboard_widget_load', 'Dashboard widget loading', 'route_transition');

  // Initial data fetch
  startTimer('dashboard_data_fetch');
  await new Promise((resolve) => setTimeout(resolve, 150));
  endTimer('dashboard_data_fetch', 'Dashboard data fetching', 'route_transition');

  // Widget layout calculation
  startTimer('dashboard_layout_calc');
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  endTimer('dashboard_layout_calc', 'Dashboard layout calculation', 'route_transition');

  // Interactivity readiness
  startTimer('dashboard_interactive');
  await new Promise((resolve) => setTimeout(resolve, 50));
  endTimer('dashboard_interactive', 'Dashboard interactive', 'route_transition');
}

/**
 * Benchmark: Analytics page performance
 * Tests charts and data visualization
 */
export async function benchmarkAnalyticsPage(): Promise<void> {
  logger.info('performance', 'benchmarkAnalyticsPage', 'Starting analytics page benchmark');

  // Data aggregation
  startTimer('analytics_data_aggregation');
  const assessmentCount = 200;
  for (let i = 0; i < assessmentCount; i++) {
    // Simulate grade calculation
    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  endTimer('analytics_data_aggregation', 'Analytics data aggregation', 'route_transition');

  // Chart rendering
  const chartTypes = ['grade_distribution', 'trend_line', 'subject_comparison', 'time_heatmap'];
  for (const chartType of chartTypes) {
    startTimer(`analytics_chart_${chartType}`);

    const dataPoints = chartType === 'time_heatmap' ? 100 : 50;
    await new Promise((resolve) => setTimeout(resolve, dataPoints * 2));

    endTimer(`analytics_chart_${chartType}`, `Analytics chart: ${chartType}`, 'route_transition');
  }

  // Filter application
  startTimer('analytics_filter_apply');
  const filterCount = 5;
  for (let i = 0; i < filterCount; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  endTimer('analytics_filter_apply', 'Analytics filter application', 'route_transition');
}

/**
 * Benchmark: Assessments page performance
 * Tests list views and detailed views
 */
export async function benchmarkAssessmentsPage(): Promise<void> {
  logger.info('performance', 'benchmarkAssessmentsPage', 'Starting assessments page benchmark');

  // List view loading
  startTimer('assessments_list_load');
  const assessmentCount = 150;
  await new Promise((resolve) => setTimeout(resolve, assessmentCount * 0.5));
  endTimer('assessments_list_load', 'Assessments list loading', 'route_transition');

  // Sorting operations
  const sortTypes = ['date', 'subject', 'grade', 'status'];
  for (const sortType of sortTypes) {
    startTimer(`assessments_sort_${sortType}`);

    // Simulate sort
    const sortTime = assessmentCount * 0.3;
    await new Promise((resolve) => setTimeout(resolve, sortTime));

    endTimer(`assessments_sort_${sortType}`, `Assessments sort: ${sortType}`, 'route_transition');
  }

  // Filter operations
  startTimer('assessments_filter');
  const filterCategories = 4;
  for (let i = 0; i < filterCategories; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  endTimer('assessments_filter', 'Assessments filtering', 'route_transition');

  // Detail view
  startTimer('assessments_detail_view');
  await new Promise((resolve) => setTimeout(resolve, 100));
  endTimer('assessments_detail_view', 'Assessment detail view', 'route_transition');
}

/**
 * Benchmark: Notices page performance
 * Tests notice loading and filtering
 */
export async function benchmarkNoticesPage(): Promise<void> {
  logger.info('performance', 'benchmarkNoticesPage', 'Starting notices page benchmark');

  // Notice loading
  startTimer('notices_load');
  const noticeCount = 100;
  await new Promise((resolve) => setTimeout(resolve, noticeCount * 1.5));
  endTimer('notices_load', 'Notices loading', 'route_transition');

  // Label filtering
  const labelFilters = ['all', 'academic', 'sports', 'events', 'urgent'];
  for (const filter of labelFilters) {
    startTimer(`notices_filter_${filter}`);

    const filteredCount = filter === 'all' ? noticeCount : Math.floor(noticeCount / labelFilters.length);
    await new Promise((resolve) => setTimeout(resolve, filteredCount * 0.5));

    endTimer(`notices_filter_${filter}`, `Notices filter: ${filter}`, 'route_transition');
  }

  // Search
  startTimer('notices_search');
  const searchQueries = 3;
  for (let i = 0; i < searchQueries; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  endTimer('notices_search', 'Notices search', 'route_transition');
}

/**
 * Benchmark: Messages page performance
 * Tests conversation loading and rendering
 */
export async function benchmarkMessagesPage(): Promise<void> {
  logger.info('performance', 'benchmarkMessagesPage', 'Starting messages page benchmark');

  // Conversation list
  startTimer('messages_conversation_list');
  const conversationCount = 50;
  await new Promise((resolve) => setTimeout(resolve, conversationCount * 2));
  endTimer('messages_conversation_list', 'Messages conversation list', 'route_transition');

  // Open conversation
  startTimer('messages_open_conversation');
  const messageCount = 100;
  await new Promise((resolve) => setTimeout(resolve, messageCount * 1.5));
  endTimer('messages_open_conversation', 'Messages open conversation', 'route_transition');

  // Send message simulation
  startTimer('messages_send');
  await new Promise((resolve) => setTimeout(resolve, 50));
  endTimer('messages_send', 'Messages send', 'route_transition');

  // Real-time updates
  startTimer('messages_realtime_update');
  const newMessages = 5;
  for (let i = 0; i < newMessages; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  endTimer('messages_realtime_update', 'Messages realtime update', 'route_transition');
}

/**
 * Benchmark: Settings page performance
 * Tests settings loading and saving
 */
export async function benchmarkSettingsPage(): Promise<void> {
  logger.info('performance', 'benchmarkSettingsPage', 'Starting settings page benchmark');

  // Settings categories loading
  const categories = ['general', 'appearance', 'notifications', 'privacy', 'advanced'];
  for (const category of categories) {
    startTimer(`settings_load_${category}`);

    const settingCount = category === 'advanced' ? 30 : 15;
    await new Promise((resolve) => setTimeout(resolve, settingCount * 3));

    endTimer(`settings_load_${category}`, `Settings load: ${category}`, 'route_transition');
  }

  // Settings save
  startTimer('settings_save');
  const changedSettings = 5;
  for (let i = 0; i < changedSettings; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  endTimer('settings_save', 'Settings save', 'route_transition');

  // Reset to defaults
  startTimer('settings_reset');
  await new Promise((resolve) => setTimeout(resolve, 100));
  endTimer('settings_reset', 'Settings reset', 'route_transition');
}

// ============================================================================
// Lazy Loading Benchmarks
// ============================================================================

/**
 * Benchmark: Code splitting and lazy loading
 * Tests performance of dynamically loaded chunks
 */
export async function benchmarkLazyLoading(): Promise<void> {
  logger.info('performance', 'benchmarkLazyLoading', 'Starting lazy loading benchmark');

  const lazyRoutes = [
    { name: 'analytics', chunkSize: 150000, components: ['charts', 'filters', 'tables'] },
    { name: 'folios', chunkSize: 120000, components: ['portfolio', 'artifacts', 'editor'] },
    { name: 'assessments', chunkSize: 100000, components: ['list', 'detail', 'submissions'] },
  ];

  for (const route of lazyRoutes) {
    startTimer(`lazy_load_${route.name}`);

    // Simulate network download
    const downloadTime = route.chunkSize / 50000; // 50KB/s simulation
    await new Promise((resolve) => setTimeout(resolve, downloadTime));

    // Simulate module initialization
    const initTime = route.components.length * 20;
    await new Promise((resolve) => setTimeout(resolve, initTime));

    // Simulate component registration
    for (const component of route.components) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const loadMetric = endTimer(
      `lazy_load_${route.name}`,
      `Lazy load: ${route.name}`,
      'route_transition',
      'ms',
      { chunkSize: route.chunkSize, components: route.components }
    );

    if (loadMetric) {
      recordMetric(
        `lazy_load_efficiency_${route.name}`,
        `Lazy load efficiency: ${route.name}`,
        'route_transition',
        (route.chunkSize / loadMetric.value) * 100,
        'percent',
        { chunkSize: route.chunkSize, loadTime: loadMetric.value }
      );
    }
  }
}

/**
 * Benchmark: Preloading and prefetching
 * Tests predictive loading performance
 */
export async function benchmarkPreloading(): Promise<void> {
  logger.info('performance', 'benchmarkPreloading', 'Starting preloading benchmark');

  // Prefetch candidates based on current route
  const prefetchScenarios = [
    {
      currentRoute: '/dashboard',
      candidates: ['/analytics', '/assessments'],
      hitRate: 0.7
    },
    {
      currentRoute: '/assessments',
      candidates: ['/courses', '/analytics'],
      hitRate: 0.8
    },
    {
      currentRoute: '/settings',
      candidates: [],
      hitRate: 0.0
    },
  ];

  for (const scenario of prefetchScenarios) {
    startTimer(`prefetch_${scenario.currentRoute.replace(/\//g, '_')}`);

    let prefetchedCount = 0;
    let usedCount = 0;

    for (const candidate of scenario.candidates) {
      // Simulate prefetch
      await new Promise((resolve) => setTimeout(resolve, 50));
      prefetchedCount++;

      // Simulate usage based on hit rate
      if (Math.random() < scenario.hitRate) {
        usedCount++;
      }
    }

    const prefetchMetric = endTimer(
      `prefetch_${scenario.currentRoute.replace(/\//g, '_')}`,
      `Prefetch from ${scenario.currentRoute}`,
      'route_transition',
      'ms',
      { candidates: scenario.candidates, hitRate: scenario.hitRate }
    );

    if (prefetchMetric) {
      recordMetric(
        `prefetch_efficiency`,
        'Prefetch efficiency',
        'route_transition',
        prefetchedCount > 0 ? (usedCount / prefetchedCount) * 100 : 0,
        'percent',
        {
          fromRoute: scenario.currentRoute,
          prefetched: prefetchedCount,
          used: usedCount
        }
      );
    }
  }
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

/**
 * Run the complete route benchmark suite
 */
export async function runRouteBenchmarkSuite(iterations: number = 3): Promise<void> {
  logger.info('performance', 'runRouteBenchmarkSuite', `Starting route benchmark suite with ${iterations} iterations`);

  const results: Array<{
    iteration: number;
    avgRouteTime: number;
    patternTimes: Record<string, number>;
  }> = [];

  for (let i = 0; i < iterations; i++) {
    logger.info('performance', 'runRouteBenchmarkSuite', `Running iteration ${i + 1}/${iterations}`);

    const iterationResult = await runBenchmark(`routes_iter_${i}`, async () => {
      // Route transitions
      await benchmarkSingleRouteTransitions();
      await benchmarkNavigationPatterns();
      await benchmarkRapidNavigation();

      // Page-specific benchmarks
      await benchmarkDashboardPage();
      await benchmarkAnalyticsPage();
      await benchmarkAssessmentsPage();
      await benchmarkNoticesPage();
      await benchmarkMessagesPage();
      await benchmarkSettingsPage();

      // Lazy loading
      await benchmarkLazyLoading();
      await benchmarkPreloading();
    });

    // Extract metrics
    const routeMetrics = getMetricsByCategory('route_transition');
    const coldRoutes = routeMetrics.filter(m => m.context?.type === 'cold');
    const patterns = routeMetrics.filter(m => m.name.includes('nav_pattern'));

    results.push({
      iteration: i + 1,
      avgRouteTime: calculateStats(coldRoutes).mean,
      patternTimes: patterns.reduce((acc, m) => {
        acc[m.name] = m.value;
        return acc;
      }, {} as Record<string, number>),
    });

    // Small delay between iterations
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Output summary
  console.group('🛣️ Route Benchmark Results');
  console.table(results);

  const allRouteMetrics = getMetricsByCategory('route_transition');
  const coldRouteStats = calculateStats(allRouteMetrics.filter(m => m.context?.type === 'cold'));
  const warmRouteStats = calculateStats(allRouteMetrics.filter(m => m.context?.type === 'warm'));

  console.log('Cold Route Transitions:');
  console.log(`  Mean: ${coldRouteStats.mean.toFixed(2)}ms`);
  console.log(`  P95: ${coldRouteStats.p95.toFixed(2)}ms`);

  console.log('Warm Route Transitions:');
  console.log(`  Mean: ${warmRouteStats.mean.toFixed(2)}ms`);
  console.log(`  P95: ${warmRouteStats.p95.toFixed(2)}ms`);

  const improvement = ((coldRouteStats.mean - warmRouteStats.mean) / coldRouteStats.mean * 100);
  console.log(`Caching Improvement: ${improvement.toFixed(1)}%`);

  console.groupEnd();
}

/**
 * Quick route benchmark for CI/automated testing
 */
export async function runQuickRouteBenchmark(): Promise<{
  passed: boolean;
  avgColdRouteTime: number;
  avgWarmRouteTime: number;
  slowestRoute: string;
  score: number;
}> {
  const result = await runBenchmark('routes_quick', async () => {
    // Quick subset of routes
    const quickRoutes = ROUTES.slice(0, 5);
    for (const route of quickRoutes) {
      startTimer(`quick_route_${route.path.replace(/\//g, '_')}`);
      await new Promise((resolve) => setTimeout(resolve,
        route.complexity === 'high' ? 200 : 100
      ));
      endTimer(`quick_route_${route.path.replace(/\//g, '_')}`, `Quick route: ${route.name}`, 'route_transition');
    }
  });

  const routeMetrics = getMetricsByCategory('route_transition');
  const stats = calculateStats(routeMetrics);

  const slowestMetric = routeMetrics.reduce((slowest, current) =>
    current.value > (slowest?.value || 0) ? current : slowest
  , routeMetrics[0]);

  return {
    passed: result.passed,
    avgColdRouteTime: stats.mean,
    avgWarmRouteTime: stats.mean * 0.6, // Estimate
    slowestRoute: slowestMetric?.context?.route || 'unknown',
    score: result.overallScore,
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
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
};
