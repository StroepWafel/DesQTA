# DesQTA Performance Benchmarks

This directory contains comprehensive performance benchmarks for the DesQTA application. These benchmarks measure various aspects of the app's performance, from startup time to memory usage.

## Available Benchmark Suites

### 1. Startup Benchmarks (`startupBenchmark.ts`)
Measures application startup performance.

**Key Tests:**
- `benchmarkColdStart()` - Cold start from fresh launch
- `benchmarkWarmStart()` - Warm start with cached data
- `benchmarkCacheLoading()` - Cache loading performance
- `benchmarkWarmupService()` - Background warmup service
- `benchmarkDuplicateRequests()` - Request deduplication

**Usage:**
```typescript
import { runStartupBenchmarkSuite, runQuickStartupBenchmark } from '$lib/performance';

// Full suite (5 iterations)
await runStartupBenchmarkSuite(5);

// Quick test for CI
const result = await runQuickStartupBenchmark();
```

### 2. UI Benchmarks (`uiBenchmark.ts`)
Measures user interface responsiveness and rendering performance.

**Key Tests:**
- `benchmarkWidgetDragPerformance()` - Widget drag operations
- `benchmarkWidgetResizePerformance()` - Widget resizing
- `benchmarkSearchPerformance()` - Search input latency
- `benchmarkRouteTransitions()` - Page navigation speed
- `benchmarkAnalyticsPerformance()` - Analytics page rendering
- `benchmarkNotesEditor()` - Text editor performance
- `benchmarkFrameRates()` - Animation frame rates
- `benchmarkMemoryUsage()` - Memory consumption during operations

### 3. Data Benchmarks (`dataBenchmark.ts`)
Measures data layer performance including caching and serialization.

**Key Tests:**
- `benchmarkMemoryCache()` - In-memory cache operations
- `benchmarkIndexedDB()` - IndexedDB read/write
- `benchmarkSerialization()` - JSON serialization overhead
- `benchmarkCacheHitRate()` - Cache effectiveness
- `benchmarkConcurrentDataLoading()` - Parallel data loading
- `benchmarkDuplicatePrevention()` - Duplicate request prevention

### 4. Backend Benchmarks (`backendBenchmark.ts`)
Measures Tauri/Rust backend performance.

**Key Tests:**
- `benchmarkCommandLatency()` - Command round-trip time
- `benchmarkDatabaseOperations()` - SQLite query performance
- `benchmarkFilesystemOperations()` - File I/O performance
- `benchmarkGlobalSearch()` - Search indexing performance
- `benchmarkLoggingPerformance()` - Log writing performance

### 5. Widget Benchmarks (`widgetBenchmark.ts`) ⭐ NEW
Comprehensive widget-specific performance tests.

**Key Tests:**
- `benchmarkWidgetInitialization()` - Widget mount/render time
- `benchmarkWidgetGridLayout()` - Dashboard grid calculations
- `benchmarkWidgetResizeOperations()` - Widget resizing
- `benchmarkWidgetDataRefresh()` - Data update performance
- `benchmarkWidgetDragDrop()` - Drag and drop operations
- `benchmarkWidgetConfiguration()` - Settings changes
- `benchmarkWidgetMemoryUsage()` - Memory consumption
- `benchmarkTimetableWidget()` - Timetable-specific tests
- `benchmarkGradeTrendsWidget()` - Grade chart rendering
- `benchmarkQuickNotesWidget()` - Notes editing performance

**Usage:**
```typescript
import { runWidgetBenchmarkSuite } from '$lib/performance';

// Run all widget tests
await runWidgetBenchmarkSuite(3);
```

### 6. Service Benchmarks (`serviceBenchmark.ts`) ⭐ NEW
Tests for core services performance.

**Key Tests:**
- `benchmarkAuthOperations()` - Authentication performance
- `benchmarkConcurrentAuth()` - Concurrent auth handling
- `benchmarkCacheEviction()` - Cache eviction policies
- `benchmarkCacheConsistency()` - Cache invalidation
- `benchmarkSyncOperations()` - Data synchronization
- `benchmarkDeltaSync()` - Incremental sync efficiency
- `benchmarkWidgetRegistry()` - Widget registration
- `benchmarkWidgetLayout()` - Layout calculations
- `benchmarkSettingsPersistence()` - Settings save/load
- `benchmarkNotificationDispatch()` - Notification handling
- `benchmarkRequestDeduplication()` - Request deduplication
- `benchmarkRequestRetry()` - Retry logic performance

### 7. Memory & Leak Detection (`memoryBenchmark.ts`) ⭐ NEW
Memory usage analysis and leak detection.

**Key Tests:**
- `benchmarkWidgetGridMemory()` - Widget grid memory usage
- `benchmarkNotesEditorMemory()` - Notes editing memory
- `benchmarkAssessmentDataMemory()` - Assessment data memory
- `benchmarkRouteMemoryLeaks()` - Route transition leaks
- `benchmarkWidgetLifecycleLeaks()` - Widget lifecycle leaks
- `benchmarkEventListenerLeaks()` - Event listener leaks
- `benchmarkGCPauseImpact()` - Garbage collection impact
- `benchmarkMemoryFragmentation()` - Memory fragmentation
- `benchmarkTimetableMemory()` - Timetable memory usage
- `benchmarkAnalyticsChartsMemory()` - Chart memory usage

**Utility Functions:**
```typescript
import { 
  getMemorySnapshot, 
  calculateMemoryDelta, 
  forceGarbageCollection,
  waitForStableMemory 
} from '$lib/performance';

// Take memory snapshot
const before = getMemorySnapshot();

// Run your code...

const after = getMemorySnapshot();
const delta = calculateMemoryDelta(before, after);
console.log(`Memory grew by ${delta.usedHeapDelta} bytes`);
```

### 8. Route & Page Benchmarks (`routeBenchmark.ts`) ⭐ NEW
Page navigation and route transition performance.

**Key Tests:**
- `benchmarkSingleRouteTransitions()` - Individual route loading
- `benchmarkNavigationPatterns()` - Common user flows
- `benchmarkRapidNavigation()` - Quick successive navigation
- `benchmarkDashboardPage()` - Dashboard rendering
- `benchmarkAnalyticsPage()` - Analytics page performance
- `benchmarkAssessmentsPage()` - Assessments list/detail
- `benchmarkNoticesPage()` - Notices loading/filtering
- `benchmarkMessagesPage()` - Messages conversation loading
- `benchmarkSettingsPage()` - Settings operations
- `benchmarkLazyLoading()` - Code splitting performance
- `benchmarkPreloading()` - Predictive loading

**Route Configurations Tested:**
- `/dashboard` - Medium complexity
- `/analytics` - High complexity (charts, data)
- `/assessments` - High complexity (lists, details)
- `/courses` - Medium complexity
- `/directory` - Medium complexity
- `/notices` - Low complexity
- `/direqt-messages` - Medium complexity
- `/study` - Low complexity
- `/settings` - Low complexity

### 9. Network Benchmarks (`networkBenchmark.ts`) ⭐ NEW
Network performance and request handling.

**Key Tests:**
- `benchmarkRequestLatency()` - API endpoint latency
- `benchmarkConcurrentRequests()` - Parallel request handling
- `benchmarkCacheStrategies()` - Caching effectiveness
- `benchmarkCacheInvalidation()` - Invalidation overhead
- `benchmarkPayloadSizes()` - Transfer size impact
- `benchmarkConnectionPooling()` - Connection reuse
- `benchmarkRetryStrategies()` - Retry logic performance
- `benchmarkNetworkConditions()` - Various network speeds

**Network Conditions Tested:**
- Excellent (100 Mbps, 10ms latency)
- Good (50 Mbps, 30ms latency, 1% loss)
- Fair (20 Mbps, 100ms latency, 2% loss)
- Poor (5 Mbps, 200ms latency, 5% loss)
- Offline simulation

## Running Benchmarks

### Complete Benchmark Suite
```typescript
import { runCompleteBenchmarkSuite } from '$lib/performance';

// Run everything
const results = await runCompleteBenchmarkSuite();

// Run specific categories only
const results = await runCompleteBenchmarkSuite({
  startup: true,
  ui: true,
  data: true,
  backend: true,
  widgets: true,    // NEW
  services: true,   // NEW
  memory: true,     // NEW
  routes: true,     // NEW
  network: true,    // NEW
  iterations: 5
});
```

### Quick Benchmark Suite (for CI)
```typescript
import { runQuickBenchmarkSuite } from '$lib/performance';

// Fast subset for automated testing
const { success, summary, report } = await runQuickBenchmarkSuite();
console.log(report);
// Output:
// ╔══════════════════════════════════════════════════════════════════════╗
// ║           DesQTA Quick Benchmark Report (CI)                         ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║ Total Duration: 1234.56ms                                            ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║ Suite                │ Status    │ Score                               ║
// ╠══════════════════════╪═══════════╪═════════════════════════════════════╣
// ║ startup              │ ✅ PASS   │ 95/100                              ║
// ║ widgets              │ ✅ PASS   │ 88/100                              ║
// ║ memory               │ ✅ PASS   │ 100/100                             ║
// ║ routes               │ ✅ PASS   │ 92/100                              ║
// ║ network              │ ✅ PASS   │ 90/100                              ║
// ╚══════════════════════════════════════════════════════════════════════╝
```

### Individual Benchmarks
```typescript
import { 
  benchmarkWidgetInitialization,
  benchmarkCacheEviction,
  benchmarkRouteMemoryLeaks 
} from '$lib/performance';

// Run single benchmark
await benchmarkWidgetInitialization();
await benchmarkCacheEviction();
const result = await benchmarkRouteMemoryLeaks();
```

## Understanding Results

### Metric Categories
- **Startup** - App initialization metrics
- **UI** - User interaction latencies
- **Route Transition** - Page navigation times
- **Backend Command** - Rust command latency
- **Cache** - Cache hit rates and performance
- **Network** - Request/response metrics
- **Render** - Rendering performance
- **Build** - Build time metrics

### Scoring
Benchmarks return scores from 0-100 based on:
- Target thresholds per device class
- Performance relative to KPIs
- Critical/warning threshold violations

### Device Classes
Benchmarks automatically adjust thresholds based on detected hardware:
- **Low End Mobile** - Budget devices (<4GB RAM, <4 cores)
- **Mid Desktop** - Standard laptops/PCs
- **High End Desktop** - Workstations (>16GB RAM, >8 cores)

## Interpreting Results

### Memory Leak Detection
```typescript
const result = await runMemoryBenchmarkSuite();
if (result.leaksDetected) {
  console.warn('Memory leaks detected!');
  // Review reports for specific components
}
```

### Performance Regression
Compare current results against baselines:
```typescript
// Store baseline results
const baseline = await runCompleteBenchmarkSuite();
localStorage.setItem('perf-baseline', JSON.stringify(baseline));

// Later, compare
const current = await runCompleteBenchmarkSuite();
// Compare metrics and flag regressions > 10%
```

## Best Practices

1. **Run multiple iterations** - Use at least 3 iterations for stable results
2. **Clear caches between runs** - For cold start benchmarks
3. **Close other applications** - Minimize system interference
4. **Use consistent hardware** - Compare results on same device class
5. **Monitor thermals** - Thermal throttling affects results
6. **Check for memory leaks** - Run memory benchmarks regularly
7. **Profile in production** - Use production-like data sizes

## Integration with CI

Add to your CI pipeline:
```yaml
# .github/workflows/performance.yml
- name: Run Performance Tests
  run: |
    pnpm exec vite-node src/lib/performance/ci-runner.ts
```

Example CI runner:
```typescript
// ci-runner.ts
import { runQuickBenchmarkSuite } from '$lib/performance';

async function main() {
  const results = await runQuickBenchmarkSuite();
  
  if (!results.success) {
    console.error('Performance benchmarks failed!');
    process.exit(1);
  }
  
  // Check for regressions
  const minScore = 70;
  for (const [suite, { score }] of Object.entries(results.summary)) {
    if (score < minScore) {
      console.error(`${suite} score ${score} below threshold ${minScore}`);
      process.exit(1);
    }
  }
}

main();
```

## Future Additions

Planned benchmark additions:
- Accessibility performance (screen reader impact)
- Battery usage benchmarks
- Cold start with large datasets
- Multi-tab performance
- PWA offline performance
- Mobile-specific gestures
- Animation smoothness metrics