import type { PerformanceMetric } from '$lib/performance';

/** Row stored in mega test export (crawl-phase session metrics). */
export interface MegaPerfCrawlMetricRow {
  name: string;
  category: string;
  value: number;
  unit: string;
  status: string;
  timestamp: number;
}

export interface MegaPerfBenchmarkRunSummary {
  benchmarkId: string;
  timestamp: number;
  overallScore: number;
  passed: boolean;
  metricCount: number;
  criticalCount: number;
  warningCount: number;
}

export interface MegaPerfReport {
  version: 1;
  capturedAt: number;
  crawlSessionMetricCount: number;
  crawlMetricsTrimmed: boolean;
  crawlMetrics: MegaPerfCrawlMetricRow[];
  benchmarkRuns: MegaPerfBenchmarkRunSummary[];
  /** Sample of per-run metrics for the results UI (capped). */
  benchmarkDetail: Array<{ benchmarkId: string; metrics: PerformanceMetric[] }>;
  syntheticSuite?: {
    success: boolean;
    report: string;
    suiteResults: Array<{ suite: string; passed: boolean; duration: number; score: number }>;
  };
  syntheticError?: string;
  categoryCounts: Record<string, number>;
}
